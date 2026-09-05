import { chatStreamCursorSchema } from '@repo/types/api/chat-stream';
import {
  chatTurnHandoffAnnotationSchema,
  type ChatTurnHandoffAnnotation,
} from '@repo/types/api/chat-turn';

import type { StoredChatTurnRecovery } from './db.ts';

const CHAT_TURN_RECOVERY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PREVIEW_LENGTH = 100_000;

type ChatTurnRecoveryTable = {
  get: (id: string) => Promise<StoredChatTurnRecovery | undefined>;
  put: (value: StoredChatTurnRecovery) => Promise<unknown>;
  delete: (id: string) => Promise<unknown>;
  where: (field: 'userId') => {
    equals: (value: string) => {
      delete: () => Promise<unknown>;
      toArray: () => Promise<StoredChatTurnRecovery[]>;
    };
  };
};

type RecoveryCheckpoint = Pick<
  StoredChatTurnRecovery,
  'status' | 'transport' | 'cursor' | 'lastSequence' | 'previewText'
>;

const userOperationQueues = new Map<string, Promise<void>>();

export function createChatTurnRecoveryRecord(
  input: Readonly<{
    userId: string;
    handoff: ChatTurnHandoffAnnotation;
    placeholderMessageId: string;
    createdAt: number;
  }>,
  now: () => number = Date.now,
): StoredChatTurnRecovery {
  const userId = requireBoundedValue(input.userId, 'userId', 128);
  const handoff = chatTurnHandoffAnnotationSchema.parse(input.handoff);
  if (handoff.status !== 'QUEUED' && handoff.status !== 'ACTIVE') {
    throw new Error('Only a pending Chat turn can be recovered');
  }
  const placeholderMessageId = requireBoundedValue(
    input.placeholderMessageId,
    'placeholderMessageId',
    256,
  );
  if (!Number.isSafeInteger(input.createdAt) || input.createdAt < 0) {
    throw new TypeError('createdAt is invalid');
  }
  const timestamp = now();
  return {
    id: recoveryKey(userId, handoff.turnId),
    schemaVersion: 'chat-turn-recovery-v1',
    userId,
    conversationId: handoff.conversationId,
    turnId: handoff.turnId,
    backgroundJobId: handoff.backgroundJobId,
    placeholderMessageId,
    status: handoff.status,
    transport: 'available',
    cursor: null,
    lastSequence: null,
    previewText: '',
    createdAt: input.createdAt,
    updatedAt: timestamp,
    expiresAt: timestamp + CHAT_TURN_RECOVERY_TTL_MS,
  };
}

export function createChatTurnRecoveryCache(
  table: ChatTurnRecoveryTable,
  now: () => number = Date.now,
) {
  return {
    begin(record: StoredChatTurnRecovery) {
      return serializeUserOperation(record.userId, async () => {
        const parsed = validateStoredRecovery(record);
        if (!parsed) throw new Error('Chat turn recovery record is invalid');
        try {
          const current = validateStoredRecovery(await table.get(parsed.id));
          const next =
            current && sameBinding(current, parsed)
              ? {
                  ...parsed,
                  status: current.status,
                  transport: current.transport,
                  cursor: current.cursor,
                  lastSequence: current.lastSequence,
                  previewText: current.previewText,
                  createdAt: current.createdAt,
                  updatedAt: Math.max(current.updatedAt, parsed.updatedAt),
                  expiresAt: Math.max(current.expiresAt, parsed.expiresAt),
                }
              : parsed;
          const records = await table.where('userId').equals(parsed.userId).toArray();
          for (const candidate of records) {
            if (candidate.id !== parsed.id && candidate.conversationId === parsed.conversationId) {
              await table.delete(candidate.id).catch(() => undefined);
            }
          }
          await table.put(next);
          return next;
        } catch {
          return parsed;
        }
      });
    },

    checkpoint(id: string, userId: string, checkpoint: RecoveryCheckpoint) {
      return serializeUserOperation(userId, async () => {
        try {
          const current = validateStoredRecovery(await table.get(id));
          if (!current || current.userId !== userId) return null;
          if (
            current.lastSequence !== null &&
            checkpoint.lastSequence !== null &&
            checkpoint.lastSequence < current.lastSequence
          ) {
            return current;
          }
          const next = validateStoredRecovery({
            ...current,
            ...checkpoint,
            updatedAt: now(),
            expiresAt: now() + CHAT_TURN_RECOVERY_TTL_MS,
          });
          if (!next) return null;
          await table.put(next);
          return next;
        } catch {
          return null;
        }
      });
    },

    readLatestForUser(userId: string, conversationId: string | null = null) {
      return serializeUserOperation(userId, async () => {
        try {
          const records = await table.where('userId').equals(userId).toArray();
          let latest: StoredChatTurnRecovery | null = null;
          for (const candidate of records) {
            const record = validateStoredRecovery(candidate);
            if (!record || record.userId !== userId || record.expiresAt <= now()) {
              await table.delete(candidate.id).catch(() => undefined);
              continue;
            }
            if (conversationId !== null && record.conversationId !== conversationId) continue;
            if (!latest || record.updatedAt > latest.updatedAt) latest = record;
          }
          return latest;
        } catch {
          return null;
        }
      });
    },

    remove(id: string, userId: string) {
      return serializeUserOperation(userId, async () => {
        try {
          const current = validateStoredRecovery(await table.get(id));
          if (current?.userId === userId) await table.delete(id);
        } catch {
          // Recovery metadata is best-effort; PostgreSQL remains authoritative.
        }
      });
    },

    clearUser(userId: string) {
      return serializeUserOperation(userId, async () => {
        await table
          .where('userId')
          .equals(userId)
          .delete()
          .catch(() => undefined);
      });
    },
  };
}

function recoveryKey(userId: string, turnId: string) {
  return `${userId}\u0000${turnId}`;
}

function validateStoredRecovery(value: unknown): StoredChatTurnRecovery | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<StoredChatTurnRecovery>;
  const handoff = chatTurnHandoffAnnotationSchema.safeParse({
    type: 'prepmind-chat-turn-handoff-v1',
    turnId: record.turnId,
    conversationId: record.conversationId,
    status: record.status,
    backgroundJobId: record.backgroundJobId,
  });
  if (
    record.schemaVersion !== 'chat-turn-recovery-v1' ||
    typeof record.userId !== 'string' ||
    !record.userId ||
    !handoff.success ||
    (record.status !== 'QUEUED' && record.status !== 'ACTIVE') ||
    record.id !== recoveryKey(record.userId, handoff.data.turnId) ||
    typeof record.placeholderMessageId !== 'string' ||
    !record.placeholderMessageId ||
    record.placeholderMessageId.length > 256 ||
    (record.transport !== 'available' && record.transport !== 'status_only') ||
    (record.cursor !== null && !chatStreamCursorSchema.safeParse(record.cursor).success) ||
    (record.lastSequence !== null &&
      (typeof record.lastSequence !== 'number' ||
        !Number.isSafeInteger(record.lastSequence) ||
        record.lastSequence < 0 ||
        record.lastSequence > 1_000_000)) ||
    typeof record.previewText !== 'string' ||
    record.previewText.length > MAX_PREVIEW_LENGTH ||
    !isTimestamp(record.createdAt) ||
    !isTimestamp(record.updatedAt) ||
    !isTimestamp(record.expiresAt) ||
    record.expiresAt <= record.updatedAt
  ) {
    return null;
  }
  return record as StoredChatTurnRecovery;
}

function sameBinding(left: StoredChatTurnRecovery, right: StoredChatTurnRecovery) {
  return (
    left.userId === right.userId &&
    left.turnId === right.turnId &&
    left.conversationId === right.conversationId &&
    left.backgroundJobId === right.backgroundJobId &&
    left.placeholderMessageId === right.placeholderMessageId
  );
}

function requireBoundedValue(value: string, field: string, maxLength: number) {
  if (typeof value !== 'string') throw new TypeError(`${field} is required`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new TypeError(`${field} is invalid`);
  }
  return normalized;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function serializeUserOperation<T>(userId: string, operation: () => Promise<T>) {
  const previous = userOperationQueues.get(userId) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(operation);
  const settled = result.then(
    () => undefined,
    () => undefined,
  );
  userOperationQueues.set(userId, settled);
  void settled.finally(() => {
    if (userOperationQueues.get(userId) === settled) userOperationQueues.delete(userId);
  });
  return result;
}
