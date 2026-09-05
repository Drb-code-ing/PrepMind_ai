import { createHash } from 'node:crypto';

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  chatStreamEventDraftSchema,
  chatStreamEventSchema,
  type ChatStreamEventDraft,
  type ChatStreamEventRecord,
} from '@repo/types/api/chat-stream';
import { z } from 'zod';

import { CHAT_RESPONSE_QUEUE } from './chat-turn.constants';

export const CHAT_STREAM_OPTIONS = Symbol('CHAT_STREAM_OPTIONS');

/**
 * The store only needs the small Redis surface below. Keeping it narrower than
 * ioredis makes the failure and concurrency contracts straightforward to test.
 */
export interface ChatStreamRedis {
  eval(
    script: string,
    numberOfKeys: number,
    ...args: string[]
  ): Promise<unknown>;
  xrange(
    key: string,
    start: string,
    end: string,
    ...args: string[]
  ): Promise<unknown>;
  disconnect?(): void;
}

export type ChatStreamStoreOptions = Readonly<{
  prefix?: string;
  maxEvents?: number;
  maxBytes?: number;
  ttlSeconds?: number;
  operationTimeoutMs?: number;
}>;

export type ChatStreamAppendResult =
  | { disposition: 'appended' | 'duplicate'; cursor: string }
  | { disposition: 'unavailable' }
  | {
      disposition: 'rejected';
      reason: 'terminal' | 'sequence_conflict';
    };

export type ChatStreamReadResult =
  | {
      disposition: 'available';
      events: readonly ChatStreamEventRecord[];
      nextCursor: string | null;
      hasMore: boolean;
      cursorState: 'initial' | 'ok';
    }
  | {
      disposition: 'cursor_expired';
      events: readonly [];
      nextCursor: null;
      hasMore: false;
      cursorState: 'expired';
    }
  | {
      disposition: 'unavailable';
      events: readonly [];
      nextCursor: null;
      hasMore: false;
      cursorState: 'initial' | 'ok';
    };

const DEFAULT_PREFIX = 'prepmind';
const DEFAULT_MAX_EVENTS = 256;
const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_TTL_SECONDS = 86_400;
const DEFAULT_OPERATION_TIMEOUT_MS = 1_500;
const MAX_EVENT_BYTES = 16 * 1024;
const EVENT_STORAGE_OVERHEAD_BYTES = 256;
const CURSOR_PATTERN = /^\d+-\d+$/;
const STREAM_EVENT_FIELD = 'event';

/**
 * XADD is guarded by one Lua script so two worker deliveries cannot allocate
 * the same sequence number. Redis is deliberately a transport cache: failures
 * return a bounded disposition and never make the durable database transition
 * fail.
 */
const APPEND_SCRIPT = `
local entries = redis.call('XRANGE', KEYS[1], '-', '+')
local hasTerminalEntry = false
for _, entry in ipairs(entries) do
  local fields = entry[2]
  local eventId = ''
  local eventHash = ''
  local terminal = '0'
  for index = 1, #fields, 2 do
    local field = fields[index]
    local value = fields[index + 1]
    if field == 'eventId' then eventId = value end
    if field == 'eventHash' then eventHash = value end
    if field == 'terminal' then terminal = value end
  end
  if eventId == ARGV[2] then
    if eventHash == ARGV[3] then return {0, entry[1]} end
    return {-2, entry[1]}
  end
  if terminal == '1' then hasTerminalEntry = true end
end
if hasTerminalEntry or redis.call('GET', KEYS[3]) then return {-4, ''} end
local sequence = redis.call('INCR', KEYS[2]) - 1
local id = redis.call(
  'XADD', KEYS[1], '*',
  'eventId', ARGV[2],
  'eventHash', ARGV[3],
  'sequence', tostring(sequence),
  'event', ARGV[1],
  'bytes', ARGV[4],
  'terminal', ARGV[5]
)
if ARGV[5] == '1' then redis.call('SET', KEYS[3], id) end
redis.call('XTRIM', KEYS[1], 'MAXLEN', '=', ARGV[6])
local current = redis.call('XRANGE', KEYS[1], '-', '+')
while #current > tonumber(ARGV[6]) do
  local removed = false
  for index = 1, #current do
    local candidate = current[index]
    local fields = candidate[2]
    local terminal = '0'
    for fieldIndex = 1, #fields, 2 do
      if fields[fieldIndex] == 'terminal' then
        terminal = fields[fieldIndex + 1]
      end
    end
    if terminal ~= '1' then
      redis.call('XDEL', KEYS[1], candidate[1])
      table.remove(current, index)
      removed = true
      break
    end
  end
  if not removed then break end
end
local totalBytes = 0
for _, entry in ipairs(current) do
  local fields = entry[2]
  for index = 1, #fields, 2 do
    if fields[index] == 'bytes' then
      totalBytes = totalBytes + (tonumber(fields[index + 1]) or 0)
    end
  end
end
while totalBytes > tonumber(ARGV[7]) and #current > 0 do
  local oldestIndex = nil
  for index = 1, #current do
    local fields = current[index][2]
    local terminal = '0'
    for fieldIndex = 1, #fields, 2 do
      if fields[fieldIndex] == 'terminal' then
        terminal = fields[fieldIndex + 1]
      end
    end
    if terminal ~= '1' then
      oldestIndex = index
      break
    end
  end
  if oldestIndex == nil then break end
  local oldest = current[oldestIndex]
  local oldestBytes = 0
  local fields = oldest[2]
  for index = 1, #fields, 2 do
    if fields[index] == 'bytes' then
      oldestBytes = tonumber(fields[index + 1]) or 0
    end
  end
  redis.call('XDEL', KEYS[1], oldest[1])
  totalBytes = totalBytes - oldestBytes
  table.remove(current, oldestIndex)
end
redis.call('EXPIRE', KEYS[1], ARGV[8])
redis.call('EXPIRE', KEYS[2], ARGV[8])
redis.call('EXPIRE', KEYS[3], ARGV[8])
return {1, id, tostring(sequence)}
`;

const appendResultSchema = z.union([
  z.tuple([z.number(), z.string()]),
  z.tuple([z.number(), z.string(), z.string()]),
]);

const streamEntrySchema = z.tuple([z.string(), z.array(z.string())]);

@Injectable()
export class ChatStreamStore {
  private readonly logger = new Logger(ChatStreamStore.name);
  private readonly prefix: string;
  private readonly maxEvents: number;
  private readonly maxBytes: number;
  private readonly ttlSeconds: number;
  private readonly operationTimeoutMs: number;

  constructor(
    @InjectQueue(CHAT_RESPONSE_QUEUE)
    private readonly queue: Queue | ChatStreamRedis,
    @Optional()
    @Inject(CHAT_STREAM_OPTIONS)
    options: ChatStreamStoreOptions = {},
  ) {
    this.prefix = options.prefix ?? DEFAULT_PREFIX;
    this.maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    this.operationTimeoutMs =
      options.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS;
    if (
      !Number.isInteger(this.maxEvents) ||
      this.maxEvents < 1 ||
      !Number.isInteger(this.maxBytes) ||
      this.maxBytes < MAX_EVENT_BYTES ||
      !Number.isInteger(this.ttlSeconds) ||
      this.ttlSeconds < 1 ||
      !Number.isInteger(this.operationTimeoutMs) ||
      this.operationTimeoutMs < 1
    ) {
      throw new Error('Invalid chat stream store bounds');
    }
  }

  async append(
    userId: string,
    turnId: string,
    draft: ChatStreamEventDraft,
  ): Promise<ChatStreamAppendResult> {
    const parsedDraft = chatStreamEventDraftSchema.parse(draft);
    const key = this.key(userId, turnId);
    const eventJson = JSON.stringify(parsedDraft);
    const eventBytes =
      Buffer.byteLength(eventJson, 'utf8') + EVENT_STORAGE_OVERHEAD_BYTES;
    if (eventBytes > Math.min(MAX_EVENT_BYTES, this.maxBytes)) {
      return { disposition: 'rejected', reason: 'sequence_conflict' };
    }

    const eventHash = createHash('sha256').update(eventJson).digest('hex');
    const terminal =
      parsedDraft.type === 'response_completed' ||
      parsedDraft.type === 'response_failed'
        ? '1'
        : '0';

    try {
      const redis = await this.withOperationTimeout(this.redis());
      const raw = await this.withOperationTimeout(
        redis.eval(
          APPEND_SCRIPT,
          3,
          key,
          `${key}:sequence`,
          `${key}:terminal`,
          eventJson,
          parsedDraft.eventId,
          eventHash,
          String(eventBytes),
          terminal,
          String(this.maxEvents),
          String(this.maxBytes),
          String(this.ttlSeconds),
        ),
      );
      const parsed = appendResultSchema.safeParse(raw);
      if (!parsed.success) {
        this.logger.warn('CHAT_STREAM_APPEND_INVALID_REDIS_RESULT');
        return { disposition: 'unavailable' };
      }
      const [code, cursor] = parsed.data;
      if (code === 1) return { disposition: 'appended', cursor };
      if (code === 0) return { disposition: 'duplicate', cursor };
      if (code === -4) return { disposition: 'rejected', reason: 'terminal' };
      return { disposition: 'rejected', reason: 'sequence_conflict' };
    } catch {
      this.logger.warn('CHAT_STREAM_APPEND_UNAVAILABLE');
      return { disposition: 'unavailable' };
    }
  }

  async read(
    userId: string,
    turnId: string,
    options: { cursor?: string; limit: number },
  ): Promise<ChatStreamReadResult> {
    const cursor = options.cursor;
    if (cursor !== undefined && !CURSOR_PATTERN.test(cursor)) {
      throw new Error('Invalid chat stream cursor');
    }
    const limit = Math.min(
      Math.max(Math.trunc(options.limit), 1),
      this.maxEvents,
    );
    const key = this.key(userId, turnId);
    try {
      if (cursor !== undefined) {
        const redis = await this.withOperationTimeout(this.redis());
        const snapshot = this.entries(
          await this.withOperationTimeout(
            redis.xrange(key, '-', '+', 'COUNT', String(this.maxEvents + 1)),
          ),
        );
        const firstCursor = snapshot[0]?.[0];
        if (!firstCursor || compareStreamIds(cursor, firstCursor) < 0) {
          return {
            disposition: 'cursor_expired',
            events: [],
            nextCursor: null,
            hasMore: false,
            cursorState: 'expired',
          };
        }
      }

      const start = cursor === undefined ? '-' : `(${cursor}`;
      const redis = await this.withOperationTimeout(this.redis());
      const raw = await this.withOperationTimeout(
        redis.xrange(key, start, '+', 'COUNT', String(limit + 1)),
      );
      const entries = this.entries(raw);
      const hasMore = entries.length > limit;
      const selected = hasMore ? entries.slice(0, limit) : entries;
      const events: ChatStreamEventRecord[] = [];
      let malformed = false;
      for (const entry of selected) {
        const record = this.parseEntry(turnId, entry);
        if (record) events.push(record);
        else malformed = true;
      }
      if (malformed) {
        return {
          disposition: 'unavailable',
          events: [],
          nextCursor: null,
          hasMore: false,
          cursorState: cursor === undefined ? 'initial' : 'ok',
        };
      }
      return {
        disposition: 'available',
        events,
        nextCursor: hasMore ? (events.at(-1)?.cursor ?? null) : null,
        hasMore,
        cursorState: cursor === undefined ? 'initial' : 'ok',
      };
    } catch {
      this.logger.warn('CHAT_STREAM_READ_UNAVAILABLE');
      return {
        disposition: 'unavailable',
        events: [],
        nextCursor: null,
        hasMore: false,
        cursorState: cursor === undefined ? 'initial' : 'ok',
      };
    }
  }

  private async redis(): Promise<ChatStreamRedis> {
    if ('eval' in this.queue) return this.queue;
    return (await this.queue.client) as unknown as ChatStreamRedis;
  }

  private async withOperationTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('CHAT_STREAM_REDIS_OPERATION_TIMEOUT')),
            this.operationTimeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private parseEntry(
    turnId: string,
    entry: [string, string[]],
  ): ChatStreamEventRecord | null {
    const [cursor, fields] = entry;
    const values = new Map<string, string>();
    for (let index = 0; index < fields.length; index += 2) {
      const field = fields[index];
      const value = fields[index + 1];
      if (field !== undefined && value !== undefined) values.set(field, value);
    }
    const eventJson = values.get(STREAM_EVENT_FIELD);
    const sequence = Number(values.get('sequence'));
    if (!eventJson || !Number.isInteger(sequence) || sequence < 0) {
      this.logger.warn('CHAT_STREAM_ENTRY_INVALID');
      return null;
    }
    try {
      const draft = chatStreamEventDraftSchema.parse(JSON.parse(eventJson));
      const event = chatStreamEventSchema.parse({
        ...draft,
        schemaVersion: 'chat-turn-stream-v1',
        turnId,
        sequence,
      });
      return { cursor, event };
    } catch {
      this.logger.warn('CHAT_STREAM_ENTRY_INVALID');
      return null;
    }
  }

  private entries(value: unknown): [string, string[]][] {
    const parsed = z.array(streamEntrySchema).safeParse(value);
    if (!parsed.success) {
      throw new Error('Invalid Redis stream entries');
    }
    return parsed.data;
  }

  private key(userId: string, turnId: string) {
    const digest = createHash('sha256')
      .update(`${userId}\u0000${turnId}`)
      .digest('hex');
    return `${this.prefix}:chat-stream:${digest}`;
  }
}

function compareStreamIds(left: string, right: string) {
  const leftParts = left.split('-').map(Number);
  const rightParts = right.split('-').map(Number);
  if (leftParts[0] !== rightParts[0]) {
    return (leftParts[0] ?? 0) - (rightParts[0] ?? 0);
  }
  return (leftParts[1] ?? 0) - (rightParts[1] ?? 0);
}
