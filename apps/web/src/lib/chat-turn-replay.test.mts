import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiClientError } from './api-client.ts';
import {
  ChatTurnReplayError,
  followChatTurn,
  type ChatTurnReplayProgress,
} from './chat-turn-replay.ts';

test('drains replay pages, preserves the cursor, and completes from PostgreSQL status', async () => {
  const progress: ChatTurnReplayProgress[] = [];
  const eventCursors: Array<string | undefined> = [];
  let statusCalls = 0;
  let eventCalls = 0;

  const result = await followChatTurn(
    baseInput((value) => progress.push(value)),
    {
      api: {
        async getStatus() {
          statusCalls += 1;
          return statusCalls < 3 ? activeStatus() : succeededStatus('authoritative answer');
        },
        async getEvents(_token, _turnId, query) {
          eventCursors.push(query.cursor);
          eventCalls += 1;
          if (eventCalls === 1) {
            return replayPage(
              [
                eventRecord('100-0', 0, 'started', {
                  type: 'response_started',
                  mode: 'mock',
                  generator: 'deterministic-worker-v1',
                }),
                eventRecord('100-1', 1, 'delta-1', {
                  type: 'text_delta',
                  text: 'partial ',
                }),
              ],
              { hasMore: true, nextCursor: '100-1' },
            );
          }
          return replayPage([
            eventRecord('100-2', 2, 'delta-2', {
              type: 'text_delta',
              text: 'answer',
            }),
            eventRecord('100-3', 3, 'completed', {
              type: 'response_completed',
              responseMessageId: 'response_1',
              finishReason: 'stop',
              generator: 'deterministic-worker-v1',
            }),
          ]);
        },
      },
      wait: async () => {
        assert.fail('hasMore and terminal events must trigger an immediate status recheck');
      },
    },
  );

  assert.equal(result.kind, 'succeeded');
  assert.deepEqual(eventCursors, [undefined, '100-1']);
  assert.ok(progress.some((value) => value.previewText === 'partial answer'));
});

test('yields through bounded backoff when immediate replay pages keep arriving', async () => {
  const delays: number[] = [];
  let statusCalls = 0;
  let eventCalls = 0;
  const result = await followChatTurn(baseInput(), {
    api: {
      async getStatus() {
        statusCalls += 1;
        return statusCalls < 7 ? activeStatus() : succeededStatus('authoritative answer');
      },
      async getEvents() {
        const sequence = eventCalls;
        eventCalls += 1;
        const cursor = `${100 + sequence}-0`;
        return replayPage(
          [
            eventRecord(cursor, sequence, `delta-${sequence}`, {
              type: 'text_delta',
              text: 'x',
            }),
          ],
          { hasMore: true, nextCursor: cursor },
        );
      },
    },
    delays: [5, 10],
    wait: async (milliseconds) => {
      delays.push(milliseconds);
    },
  });

  assert.equal(result.kind, 'succeeded');
  assert.equal(eventCalls, 6);
  assert.deepEqual(delays, [5]);
});

test('falls back to bounded status polling when the cursor expires', async () => {
  const progress: ChatTurnReplayProgress[] = [];
  const delays: number[] = [];
  let statusCalls = 0;
  let eventCalls = 0;
  const result = await followChatTurn(
    baseInput((value) => progress.push(value), {
      cursor: '50-0',
      lastSequence: 1,
      previewText: 'already shown',
    }),
    {
      api: {
        async getStatus() {
          statusCalls += 1;
          return statusCalls < 3 ? activeStatus() : succeededStatus('durable answer');
        },
        async getEvents() {
          eventCalls += 1;
          return replayPage([], {
            cursorState: 'expired',
            transport: 'available',
          });
        },
      },
      delays: [10, 20],
      wait: async (milliseconds) => {
        delays.push(milliseconds);
      },
    },
  );

  assert.equal(result.kind, 'succeeded');
  assert.equal(eventCalls, 1);
  assert.deepEqual(delays, [10, 20]);
  assert.ok(progress.some((value) => value.transport === 'status_only'));
});

test('uses capped reconnect backoff for transient status failures', async () => {
  const delays: number[] = [];
  let calls = 0;
  const result = await followChatTurn(baseInput(), {
    api: {
      async getStatus() {
        calls += 1;
        if (calls < 4) {
          throw new ApiClientError('offline', { status: 0, code: 'NETWORK_ERROR' });
        }
        return succeededStatus('recovered');
      },
      async getEvents() {
        assert.fail('events are not read before durable status succeeds');
      },
    },
    delays: [5, 10],
    wait: async (milliseconds) => {
      delays.push(milliseconds);
    },
  });

  assert.equal(result.kind, 'succeeded');
  assert.deepEqual(delays, [5, 10, 10]);
});

test('bounds a succeeded status without its durable response and never trusts replay instead', async () => {
  const delays: number[] = [];
  let statusCalls = 0;

  await assert.rejects(
    followChatTurn(baseInput(), {
      api: {
        async getStatus() {
          statusCalls += 1;
          return { ...succeededStatus('missing'), response: null };
        },
        async getEvents() {
          assert.fail('a succeeded durable status must not fall back to Redis content');
        },
      },
      delays: [5, 10],
      wait: async (milliseconds) => {
        delays.push(milliseconds);
      },
    }),
    (error) => error instanceof ChatTurnReplayError && error.code === 'DURABLE_RESPONSE_INVALID',
  );

  assert.equal(statusCalls, 4);
  assert.deepEqual(delays, [5, 10, 10]);
});

test('degrades corrupt or foreign event pages without trusting them as terminal', async () => {
  const progress: ChatTurnReplayProgress[] = [];
  let statusCalls = 0;
  let eventCalls = 0;
  const result = await followChatTurn(
    baseInput((value) => progress.push(value)),
    {
      api: {
        async getStatus() {
          statusCalls += 1;
          return statusCalls === 1 ? activeStatus() : succeededStatus('safe durable answer');
        },
        async getEvents() {
          eventCalls += 1;
          return replayPage([
            {
              ...eventRecord('100-0', 0, 'foreign', {
                type: 'response_failed',
                errorCode: 'INTERNAL_FAILURE',
                phase: 'before_first_token',
              }),
              event: {
                ...eventRecord('100-0', 0, 'foreign', {
                  type: 'response_failed',
                  errorCode: 'INTERNAL_FAILURE',
                  phase: 'before_first_token',
                }).event,
                turnId: 'turn_foreign',
              },
            },
          ]);
        },
      },
      wait: async () => undefined,
    },
  );

  assert.equal(result.kind, 'succeeded');
  assert.equal(eventCalls, 1);
  assert.ok(progress.some((value) => value.transport === 'status_only'));
});

test('degrades an out-of-order replay page instead of checkpointing past an event', async () => {
  const progress: ChatTurnReplayProgress[] = [];
  let statusCalls = 0;
  const result = await followChatTurn(
    baseInput((value) => progress.push(value)),
    {
      api: {
        async getStatus() {
          statusCalls += 1;
          return statusCalls === 1 ? activeStatus() : succeededStatus('safe durable answer');
        },
        async getEvents() {
          return replayPage([
            eventRecord('100-2', 0, 'delta-1', { type: 'text_delta', text: 'first' }),
            eventRecord('100-1', 1, 'delta-2', { type: 'text_delta', text: 'second' }),
          ]);
        },
      },
      wait: async () => undefined,
    },
  );

  assert.equal(result.kind, 'succeeded');
  assert.ok(progress.some((value) => value.transport === 'status_only'));
  assert.equal(
    progress.some((value) => value.previewText.length > 0),
    false,
  );
});

test('returns failed and cancelled only from durable turn status', async () => {
  for (const status of ['FAILED', 'CANCELLED'] as const) {
    const result = await followChatTurn(baseInput(), {
      api: {
        async getStatus() {
          return terminalStatus(status);
        },
        async getEvents() {
          assert.fail('terminal durable status stops replay');
        },
      },
    });
    assert.equal(result.kind, status === 'FAILED' ? 'failed' : 'cancelled');
  }
});

test('rejects status from another turn or conversation and stops after abort', async () => {
  await assert.rejects(
    followChatTurn(baseInput(), {
      api: {
        async getStatus() {
          return { ...activeStatus(), turn: { ...activeStatus().turn, id: 'turn_foreign' } };
        },
        async getEvents() {
          assert.fail('context mismatch stops before replay');
        },
      },
    }),
    (error) => error instanceof ChatTurnReplayError && error.code === 'CONTEXT_MISMATCH',
  );

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    followChatTurn(
      { ...baseInput(), signal: controller.signal },
      {
        api: {
          async getStatus() {
            assert.fail('aborted recovery performs no request');
          },
          async getEvents() {
            assert.fail('aborted recovery performs no request');
          },
        },
      },
    ),
    (error) => error instanceof Error && error.name === 'AbortError',
  );
});

function baseInput(
  onProgress?: (progress: ChatTurnReplayProgress) => void,
  initial?: Parameters<typeof followChatTurn>[0]['initial'],
) {
  return {
    accessToken: 'token_1',
    turnId: 'turn_1',
    conversationId: 'conv_1',
    signal: new AbortController().signal,
    ...(initial ? { initial } : {}),
    ...(onProgress ? { onProgress } : {}),
  };
}

function activeStatus() {
  return {
    turn: {
      id: 'turn_1',
      conversationId: 'conv_1',
      status: 'ACTIVE' as const,
      responseMessageId: null,
      errorCode: null,
      startedAt: '2026-09-05T00:00:01.000Z',
      finishedAt: null,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:01.000Z',
    },
    backgroundJob: {
      id: 'job_1',
      status: 'ACTIVE' as const,
      attempt: 1,
      maxAttempts: 3,
      progress: 25,
      errorCode: null,
      requestedAt: '2026-09-05T00:00:00.000Z',
      startedAt: '2026-09-05T00:00:01.000Z',
      finishedAt: null,
    },
    response: null,
  };
}

function succeededStatus(content: string) {
  return {
    ...activeStatus(),
    turn: {
      ...activeStatus().turn,
      status: 'SUCCEEDED' as const,
      responseMessageId: 'response_1',
      finishedAt: '2026-09-05T00:00:02.000Z',
    },
    backgroundJob: {
      ...activeStatus().backgroundJob,
      status: 'SUCCEEDED' as const,
      progress: 100,
      finishedAt: '2026-09-05T00:00:02.000Z',
    },
    response: {
      id: 'response_1',
      role: 'ASSISTANT' as const,
      content,
      order: 2,
      createdAt: '2026-09-05T00:00:02.000Z',
    },
  };
}

function terminalStatus(status: 'FAILED' | 'CANCELLED') {
  return {
    ...activeStatus(),
    turn: {
      ...activeStatus().turn,
      status,
      errorCode:
        status === 'FAILED' ? ('INTERNAL_FAILURE' as const) : ('CANCELLED_BY_USER' as const),
      finishedAt: '2026-09-05T00:00:02.000Z',
    },
    backgroundJob: {
      ...activeStatus().backgroundJob,
      status,
      errorCode: status === 'FAILED' ? 'INTERNAL_FAILURE' : 'CANCELLED_BY_USER',
      finishedAt: '2026-09-05T00:00:02.000Z',
    },
  };
}

function replayPage(
  events: ReturnType<typeof eventRecord>[],
  overrides: Partial<{
    nextCursor: string | null;
    cursorState: 'initial' | 'ok' | 'expired';
    transport: 'available' | 'unavailable';
    hasMore: boolean;
    terminal: boolean;
  }> = {},
) {
  return {
    events,
    nextCursor: overrides.nextCursor ?? null,
    cursorState: overrides.cursorState ?? 'ok',
    transport: overrides.transport ?? 'available',
    hasMore: overrides.hasMore ?? false,
    terminal: overrides.terminal ?? false,
  };
}

function eventRecord(
  cursor: string,
  sequence: number,
  eventId: string,
  event:
    | { type: 'response_started'; mode: 'mock' | 'live'; generator: string }
    | { type: 'text_delta'; text: string }
    | {
        type: 'response_completed';
        responseMessageId: string;
        finishReason: 'stop' | 'length' | 'content_filter';
        generator: string;
      }
    | {
        type: 'response_failed';
        errorCode: 'INTERNAL_FAILURE';
        phase: 'before_first_token';
      },
) {
  return {
    cursor,
    event: {
      schemaVersion: 'chat-turn-stream-v1' as const,
      turnId: 'turn_1',
      sequence,
      eventId,
      ...event,
    },
  };
}
