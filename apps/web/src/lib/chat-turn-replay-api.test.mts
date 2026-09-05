import assert from 'node:assert/strict';
import test from 'node:test';

import { createChatTurnReplayApi } from './chat-turn-replay-api.ts';

test('reads owner-bound durable status with bearer auth and abort propagation', async () => {
  const controller = new AbortController();
  let captured: { path: string; options: unknown } | undefined;
  const api = createChatTurnReplayApi({
    async get<T>(path: string, options?: unknown) {
      captured = { path, options };
      return statusResponse() as T;
    },
  });

  const result = await api.getStatus(' token_1 ', 'turn_1', {
    signal: controller.signal,
  });

  assert.equal(result.turn.status, 'ACTIVE');
  assert.deepEqual(captured, {
    path: '/chat-turns/turn_1',
    options: {
      accessToken: 'token_1',
      expectedStatus: 200,
      signal: controller.signal,
    },
  });
});

test('reads bounded replay pages with an encoded cursor and strict response schema', async () => {
  const calls: Array<{ path: string; options: unknown }> = [];
  const api = createChatTurnReplayApi({
    async get<T>(path: string, options?: unknown) {
      calls.push({ path, options });
      return eventsResponse() as T;
    },
  });

  const result = await api.getEvents('token_1', 'turn_1', {
    cursor: '1718169600000-2',
    limit: 32,
  });

  assert.equal(result.events[0]?.event.type, 'text_delta');
  assert.deepEqual(calls, [
    {
      path: '/chat-turns/turn_1/events?limit=32&cursor=1718169600000-2',
      options: { accessToken: 'token_1', expectedStatus: 200 },
    },
  ]);
});

test('fails before transport for missing auth, unsafe ids, and invalid cursor bounds', async () => {
  let calls = 0;
  const api = createChatTurnReplayApi({
    async get<T>() {
      calls += 1;
      return eventsResponse() as T;
    },
  });

  await assert.rejects(api.getStatus(' ', 'turn_1'), /access token/);
  await assert.rejects(api.getStatus('token_1', '../turn_1'), /turnId is invalid/);
  await assert.rejects(api.getEvents('token_1', 'turn_1', { cursor: 'not-a-cursor' }));
  await assert.rejects(api.getEvents('token_1', 'turn_1', { limit: 257 }));
  assert.equal(calls, 0);
});

test('rejects unknown status and replay response fields', async () => {
  const unsafeStatus = createChatTurnReplayApi({
    async get<T>() {
      return { ...statusResponse(), prompt: 'must not pass' } as T;
    },
  });
  const unsafeEvents = createChatTurnReplayApi({
    async get<T>() {
      return { ...eventsResponse(), providerPayload: 'must not pass' } as T;
    },
  });

  await assert.rejects(unsafeStatus.getStatus('token_1', 'turn_1'));
  await assert.rejects(unsafeEvents.getEvents('token_1', 'turn_1'));
});

function statusResponse() {
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

function eventsResponse() {
  return {
    events: [
      {
        cursor: '1718169600001-0',
        event: {
          schemaVersion: 'chat-turn-stream-v1' as const,
          turnId: 'turn_1',
          sequence: 1,
          eventId: 'event_1',
          type: 'text_delta' as const,
          text: '第一段',
        },
      },
    ],
    nextCursor: null,
    cursorState: 'ok' as const,
    transport: 'available' as const,
    hasMore: false,
    terminal: false,
  };
}
