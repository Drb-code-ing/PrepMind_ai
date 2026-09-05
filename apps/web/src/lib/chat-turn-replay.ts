import type { ChatStreamEventsResponse, ChatTurnStatusResponse } from '@repo/types/api/chat-stream';

import { ApiClientError } from './api-client.ts';

export const CHAT_TURN_REPLAY_PAGE_LIMIT = 100;
export const CHAT_TURN_REPLAY_DELAYS_MS = [250, 500, 1_000, 2_000] as const;
const MAX_IMMEDIATE_RECHECKS = 4;
const MAX_MISSING_DURABLE_RESPONSE_CHECKS = 4;
const MAX_DEDUP_ENTRIES = 512;

type PendingTurnStatus = 'QUEUED' | 'ACTIVE';
type ReplayTransport = 'available' | 'status_only';
type DurableResponse = NonNullable<ChatTurnStatusResponse['response']>;

export type ChatTurnReplayProgress = Readonly<{
  status: PendingTurnStatus;
  transport: ReplayTransport;
  cursor: string | null;
  lastSequence: number | null;
  previewText: string;
  progress: number;
  attempt: number;
  maxAttempts: number;
  reconnecting: boolean;
}>;

export type ChatTurnReplayResult =
  | { kind: 'succeeded'; response: DurableResponse }
  | { kind: 'failed' | 'cancelled'; errorCode: string | null };

export type ChatTurnReplayInput = Readonly<{
  accessToken: string;
  turnId: string;
  conversationId: string;
  signal: AbortSignal;
  initial?: Partial<
    Pick<ChatTurnReplayProgress, 'status' | 'transport' | 'cursor' | 'lastSequence' | 'previewText'>
  >;
  onProgress?: (progress: ChatTurnReplayProgress) => void;
}>;

type ChatTurnReplayApi = Readonly<{
  getStatus: (
    accessToken: string,
    turnId: string,
    options: { signal: AbortSignal },
  ) => Promise<ChatTurnStatusResponse>;
  getEvents: (
    accessToken: string,
    turnId: string,
    query: { cursor?: string; limit: number },
    options: { signal: AbortSignal },
  ) => Promise<ChatStreamEventsResponse>;
}>;

export type ChatTurnReplayDependencies = Readonly<{
  api: ChatTurnReplayApi;
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  delays?: readonly number[];
}>;

export class ChatTurnReplayError extends Error {
  readonly code: 'CONTEXT_MISMATCH' | 'DURABLE_RESPONSE_INVALID' | 'REQUEST_REJECTED';

  constructor(code: ChatTurnReplayError['code'], message: string) {
    super(message);
    this.name = 'ChatTurnReplayError';
    this.code = code;
  }
}

export async function followChatTurn(
  input: ChatTurnReplayInput,
  dependencies: ChatTurnReplayDependencies,
): Promise<ChatTurnReplayResult> {
  const wait = dependencies.wait ?? waitForDelay;
  const delays = dependencies.delays?.length ? dependencies.delays : CHAT_TURN_REPLAY_DELAYS_MS;
  let delayIndex = 0;
  let status: PendingTurnStatus = input.initial?.status ?? 'QUEUED';
  let transport: ReplayTransport = input.initial?.transport ?? 'available';
  let cursor = input.initial?.cursor ?? null;
  let lastSequence = input.initial?.lastSequence ?? null;
  let previewText = input.initial?.previewText ?? '';
  let immediateRechecks = 0;
  let missingDurableResponseChecks = 0;
  const seenCursors = new Set<string>();
  const seenEventIds = new Set<string>();

  while (true) {
    throwIfAborted(input.signal);
    let durable: ChatTurnStatusResponse;
    try {
      durable = await dependencies.api.getStatus(input.accessToken, input.turnId, {
        signal: input.signal,
      });
    } catch (error) {
      throwIfAborted(input.signal);
      if (!isRetryableReplayError(error)) {
        throw new ChatTurnReplayError('REQUEST_REJECTED', 'Chat turn status request was rejected');
      }
      emitProgress(input, {
        status,
        transport,
        cursor,
        lastSequence,
        previewText,
        progress: 0,
        attempt: 0,
        maxAttempts: 1,
        reconnecting: true,
      });
      await wait(nextDelay(delays, delayIndex++), input.signal);
      continue;
    }

    assertDurableContext(durable, input.turnId, input.conversationId);
    const terminal = readDurableTerminal(durable);
    if (terminal) return terminal;

    status = durable.turn.status === 'ACTIVE' ? 'ACTIVE' : status;
    const jobProgress = durable.backgroundJob?.progress ?? 0;
    const jobAttempt = durable.backgroundJob?.attempt ?? 0;
    const jobMaxAttempts = durable.backgroundJob?.maxAttempts ?? 1;
    if (durable.turn.status === 'SUCCEEDED') {
      missingDurableResponseChecks += 1;
      transport = 'status_only';
      if (missingDurableResponseChecks >= MAX_MISSING_DURABLE_RESPONSE_CHECKS) {
        throw new ChatTurnReplayError(
          'DURABLE_RESPONSE_INVALID',
          'Succeeded Chat turn has no matching durable response',
        );
      }
      emitProgress(input, {
        status,
        transport,
        cursor,
        lastSequence,
        previewText,
        progress: jobProgress,
        attempt: jobAttempt,
        maxAttempts: jobMaxAttempts,
        reconnecting: true,
      });
      await wait(nextDelay(delays, delayIndex++), input.signal);
      continue;
    }
    missingDurableResponseChecks = 0;
    emitProgress(input, {
      status,
      transport,
      cursor,
      lastSequence,
      previewText,
      progress: jobProgress,
      attempt: jobAttempt,
      maxAttempts: jobMaxAttempts,
      reconnecting: false,
    });

    let immediateRecheck = false;
    let observedProgress = false;
    if (transport === 'available') {
      try {
        const replay = await dependencies.api.getEvents(
          input.accessToken,
          input.turnId,
          {
            ...(cursor === null ? {} : { cursor }),
            limit: CHAT_TURN_REPLAY_PAGE_LIMIT,
          },
          { signal: input.signal },
        );
        throwIfAborted(input.signal);
        if (replay.transport === 'unavailable' || replay.cursorState === 'expired') {
          transport = 'status_only';
          observedProgress = true;
        } else {
          const applied = applyReplayPage(
            replay,
            input.turnId,
            { cursor, lastSequence, previewText },
            seenCursors,
            seenEventIds,
          );
          if (!applied.ok) {
            transport = 'status_only';
            observedProgress = true;
          } else {
            cursor = applied.cursor;
            lastSequence = applied.lastSequence;
            previewText = applied.previewText;
            immediateRecheck = applied.terminalObserved || replay.hasMore;
            observedProgress = applied.appliedCount > 0;
          }
        }
      } catch (error) {
        throwIfAborted(input.signal);
        if (isRetryableReplayError(error)) {
          emitProgress(input, {
            status,
            transport,
            cursor,
            lastSequence,
            previewText,
            progress: jobProgress,
            attempt: jobAttempt,
            maxAttempts: jobMaxAttempts,
            reconnecting: true,
          });
        } else {
          transport = 'status_only';
        }
      }
    }

    emitProgress(input, {
      status,
      transport,
      cursor,
      lastSequence,
      previewText,
      progress: jobProgress,
      attempt: jobAttempt,
      maxAttempts: jobMaxAttempts,
      reconnecting: false,
    });
    if (immediateRecheck && immediateRechecks < MAX_IMMEDIATE_RECHECKS) {
      immediateRechecks += 1;
      delayIndex = 0;
      continue;
    }
    immediateRechecks = 0;
    if (observedProgress) delayIndex = 0;
    await wait(nextDelay(delays, delayIndex++), input.signal);
  }
}

function readDurableTerminal(status: ChatTurnStatusResponse): ChatTurnReplayResult | null {
  if (status.turn.status === 'SUCCEEDED') {
    if (!status.response || status.turn.responseMessageId !== status.response.id) {
      return null;
    }
    return { kind: 'succeeded', response: status.response };
  }
  if (status.turn.status === 'FAILED') {
    return { kind: 'failed', errorCode: status.turn.errorCode };
  }
  if (status.turn.status === 'CANCELLED') {
    return { kind: 'cancelled', errorCode: status.turn.errorCode };
  }
  return null;
}

function assertDurableContext(
  status: ChatTurnStatusResponse,
  turnId: string,
  conversationId: string,
) {
  if (status.turn.id !== turnId || status.turn.conversationId !== conversationId) {
    throw new ChatTurnReplayError('CONTEXT_MISMATCH', 'Chat turn status context is inconsistent');
  }
  if (
    status.response &&
    status.turn.responseMessageId !== null &&
    status.turn.responseMessageId !== status.response.id
  ) {
    throw new ChatTurnReplayError(
      'DURABLE_RESPONSE_INVALID',
      'Chat turn response identity is inconsistent',
    );
  }
}

function applyReplayPage(
  replay: ChatStreamEventsResponse,
  turnId: string,
  state: Readonly<{
    cursor: string | null;
    lastSequence: number | null;
    previewText: string;
  }>,
  seenCursors: Set<string>,
  seenEventIds: Set<string>,
):
  | {
      ok: true;
      cursor: string | null;
      lastSequence: number | null;
      previewText: string;
      appliedCount: number;
      terminalObserved: boolean;
    }
  | { ok: false } {
  let cursor = state.cursor;
  let lastSequence = state.lastSequence;
  let previewText = state.previewText;
  let appliedCount = 0;
  let terminalObserved = false;

  for (let index = 0; index < replay.events.length; index += 1) {
    const current = replay.events[index];
    const previous = replay.events[index - 1];
    if (!current || current.event.turnId !== turnId) return { ok: false };
    if (
      previous &&
      (compareCursors(current.cursor, previous.cursor) <= 0 ||
        current.event.sequence !== previous.event.sequence + 1)
    ) {
      return { ok: false };
    }
  }

  for (const record of replay.events) {
    if (seenCursors.has(record.cursor) || seenEventIds.has(record.event.eventId)) continue;
    if (cursor !== null && compareCursors(record.cursor, cursor) <= 0) {
      if (lastSequence !== null && record.event.sequence > lastSequence) return { ok: false };
      continue;
    }
    if (lastSequence !== null) {
      if (record.event.sequence <= lastSequence) continue;
      if (record.event.sequence !== lastSequence + 1) return { ok: false };
    }

    rememberBounded(seenCursors, record.cursor);
    rememberBounded(seenEventIds, record.event.eventId);
    cursor = record.cursor;
    lastSequence = record.event.sequence;
    appliedCount += 1;
    if (record.event.type === 'text_delta') {
      previewText += record.event.text;
      if (previewText.length > 100_000) return { ok: false };
    }
    if (record.event.type === 'response_completed' || record.event.type === 'response_failed') {
      terminalObserved = true;
    }
  }

  if (
    replay.hasMore &&
    (replay.events.length === 0 || replay.nextCursor !== replay.events.at(-1)?.cursor)
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    cursor,
    lastSequence,
    previewText,
    appliedCount,
    terminalObserved,
  };
}

function emitProgress(input: ChatTurnReplayInput, progress: ChatTurnReplayProgress) {
  throwIfAborted(input.signal);
  input.onProgress?.(progress);
}

function isRetryableReplayError(error: unknown) {
  return (
    error instanceof ApiClientError &&
    error.code !== 'REQUEST_ABORTED' &&
    (error.status === 0 ||
      error.status === 408 ||
      error.status === 425 ||
      error.status === 429 ||
      error.status >= 500)
  );
}

function nextDelay(delays: readonly number[], index: number) {
  const value = delays[Math.min(index, delays.length - 1)];
  return typeof value === 'number' && value >= 1 ? value : 1;
}

function compareCursors(left: string, right: string) {
  const [leftTime = '0', leftSequence = '0'] = left.split('-');
  const [rightTime = '0', rightSequence = '0'] = right.split('-');
  const timeDifference = compareDecimalCursorParts(leftTime, rightTime);
  if (timeDifference !== 0) return timeDifference;
  return compareDecimalCursorParts(leftSequence, rightSequence);
}

function compareDecimalCursorParts(left: string, right: string) {
  const normalizedLeft = left.replace(/^0+/, '') || '0';
  const normalizedRight = right.replace(/^0+/, '') || '0';
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length < normalizedRight.length ? -1 : 1;
  }
  if (normalizedLeft === normalizedRight) return 0;
  return normalizedLeft < normalizedRight ? -1 : 1;
}

function rememberBounded(values: Set<string>, value: string) {
  values.add(value);
  if (values.size <= MAX_DEDUP_ENTRIES) return;
  const oldest = values.values().next().value;
  if (typeof oldest === 'string') values.delete(oldest);
}

function throwIfAborted(signal: AbortSignal) {
  if (!signal.aborted) return;
  const error = new Error('Chat turn replay was aborted');
  error.name = 'AbortError';
  throw error;
}

function waitForDelay(milliseconds: number, signal: AbortSignal) {
  throwIfAborted(signal);
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      const error = new Error('Chat turn replay was aborted');
      error.name = 'AbortError';
      reject(error);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
