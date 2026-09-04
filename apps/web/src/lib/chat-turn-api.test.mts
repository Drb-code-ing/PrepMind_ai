import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiClientError, createApiClient } from './api-client.ts';
import {
  buildChatTurnEnqueueRequest,
  createChatTurnApi,
  isRetryableChatTurnEnqueueError,
  prepareChatTurnSubmission,
  resolveChatTurnSubmissionPath,
} from './chat-turn-api.ts';
import type { StoredMessage } from './db.ts';

const baseMessages: StoredMessage[] = [
  {
    id: 'msg_1',
    userId: 'user_1',
    role: 'user',
    content: '解释这道题',
    order: 0,
    createdAt: 1_718_169_600_000,
  },
  {
    id: 'msg_2',
    userId: 'user_1',
    role: 'assistant',
    content: '先看条件。',
    order: 1,
    createdAt: 1_718_169_601_000,
  },
];

test('builds a stable bounded request without sending message content', async () => {
  const request = await buildRequest(baseMessages);
  const reorderedRequest = await buildRequest([...baseMessages].reverse());

  assert.deepEqual(request, reorderedRequest);
  assert.deepEqual(request.inputMessageIds, ['msg_1', 'msg_2']);
  assert.match(request.inputHash, /^sha256:[0-9a-f]{64}$/);
  assert.match(request.clientRequestId, /^web-chat-turn-v1-[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(request).includes('解释这道题'), false);
  assert.equal(JSON.stringify(request).includes('先看条件'), false);
});

test('separates input identity from owner and budget request identity', async () => {
  const original = await buildRequest(baseMessages);
  const contentChanged = await buildRequest(
    baseMessages.map((message) =>
      message.id === 'msg_2' ? { ...message, content: '条件和结论都要核对。' } : message,
    ),
  );
  const budgetChanged = await buildChatTurnEnqueueRequest({
    ownerId: 'user_1',
    conversationId: 'conv_1',
    messages: baseMessages,
    budgetPolicyVersion: 'chat-budget-v2',
  });

  assert.notEqual(original.inputHash, contentChanged.inputHash);
  assert.notEqual(original.clientRequestId, contentChanged.clientRequestId);
  assert.equal(original.inputHash, budgetChanged.inputHash);
  assert.notEqual(original.clientRequestId, budgetChanged.clientRequestId);
});

test('fails closed on cross-owner, duplicate, per-message, and aggregate bounds', async () => {
  await assert.rejects(
    buildRequest([{ ...baseMessages[0], userId: 'user_2' }]),
    /authenticated owner/,
  );
  await assert.rejects(
    buildRequest([baseMessages[0], { ...baseMessages[1], id: baseMessages[0].id }]),
    /unique/,
  );
  await assert.rejects(
    buildRequest([{ ...baseMessages[0], content: 'x'.repeat(100_001) }]),
    /at most 100000/,
  );
  await assert.rejects(
    buildRequest(
      Array.from({ length: 21 }, (_, index) => ({
        ...baseMessages[0],
        id: `msg_${index}`,
        order: index,
        content: 'x'.repeat(100_000),
      })),
    ),
    /total message content/,
  );
});

test('keeps snapshot sync as an explicit compatibility path', () => {
  assert.deepEqual(
    resolveChatTurnSubmissionPath({ conversationId: null, messagesPersisted: true }),
    { kind: 'snapshot-sync', reason: 'conversation-not-ready' },
  );
  assert.deepEqual(
    resolveChatTurnSubmissionPath({ conversationId: 'conv_1', messagesPersisted: false }),
    { kind: 'snapshot-sync', reason: 'messages-not-persisted' },
  );
  assert.deepEqual(
    resolveChatTurnSubmissionPath({ conversationId: 'conv_1', messagesPersisted: true }),
    { kind: 'enqueue' },
  );
});

test('prepares either one bounded enqueue request or the compatibility fallback', async () => {
  let digestCalls = 0;
  const fallback = await prepareChatTurnSubmission(
    {
      ownerId: 'user_1',
      conversationId: null,
      messages: baseMessages,
      messagesPersisted: false,
      budgetPolicyVersion: 'chat-budget-v1',
    },
    {
      digest: async () => {
        digestCalls += 1;
        return 'a'.repeat(64);
      },
    },
  );
  const enqueue = await prepareChatTurnSubmission({
    ownerId: 'user_1',
    conversationId: 'conv_1',
    messages: baseMessages,
    messagesPersisted: true,
    budgetPolicyVersion: 'chat-budget-v1',
  });

  assert.deepEqual(fallback, {
    kind: 'snapshot-sync',
    reason: 'conversation-not-ready',
  });
  assert.equal(digestCalls, 0);
  assert.equal(enqueue.kind, 'enqueue');
  if (enqueue.kind === 'enqueue') {
    assert.deepEqual(enqueue.request.inputMessageIds, ['msg_1', 'msg_2']);
  }
});

test('enqueues bounded facts through the authenticated API client', async () => {
  let captured: { path: string; body: unknown; options: unknown } | undefined;
  const client = {
    post: async function post<T>(path: string, body: unknown, options?: unknown) {
      captured = { path, body, options };
      return safeResponse() as T;
    },
  };
  const request = await buildRequest(baseMessages);

  const result = await createChatTurnApi(client).enqueue('token_1', request);

  assert.equal(result.turn.id, 'turn_1');
  assert.deepEqual(captured, {
    path: '/chat-turns',
    body: request,
    options: { accessToken: 'token_1', expectedStatus: 202 },
  });
});

test('requires HTTP 202 and rejects unknown fields in the safe response', async () => {
  const wrongStatusClient = createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async () => Response.json({ success: true, data: safeResponse() }, { status: 200 }),
  });
  const unsafeClient = {
    post: async function post<T>() {
      return { ...safeResponse(), prompt: 'must not pass' } as T;
    },
  };
  const request = await buildRequest(baseMessages);

  await assert.rejects(
    createChatTurnApi(wrongStatusClient).enqueue('token_1', request),
    (error) => error instanceof ApiClientError && error.code === 'UNEXPECTED_STATUS',
  );
  await assert.rejects(createChatTurnApi(unsafeClient).enqueue('token_1', request));
});

test('classifies only transport and transient HTTP failures as retryable', () => {
  assert.equal(
    isRetryableChatTurnEnqueueError(
      new ApiClientError('offline', { status: 0, code: 'NETWORK_ERROR' }),
    ),
    true,
  );
  assert.equal(
    isRetryableChatTurnEnqueueError(
      new ApiClientError('busy', { status: 429, code: 'TOO_MANY_REQUESTS' }),
    ),
    true,
  );
  assert.equal(
    isRetryableChatTurnEnqueueError(
      new ApiClientError('cancelled', { status: 0, code: 'REQUEST_ABORTED' }),
    ),
    false,
  );
  assert.equal(
    isRetryableChatTurnEnqueueError(
      new ApiClientError('conflict', {
        status: 409,
        code: 'CHAT_TURN_IDEMPOTENCY_CONFLICT',
      }),
    ),
    false,
  );
  assert.equal(isRetryableChatTurnEnqueueError(new Error('invalid local input')), false);
});

function buildRequest(messages: readonly StoredMessage[]) {
  return buildChatTurnEnqueueRequest({
    ownerId: 'user_1',
    conversationId: 'conv_1',
    messages,
    budgetPolicyVersion: 'chat-budget-v1',
  });
}

function safeResponse() {
  return {
    kind: 'created' as const,
    turn: {
      id: 'turn_1',
      conversationId: 'conv_1',
      status: 'QUEUED' as const,
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z',
    },
    backgroundJob: {
      id: 'job_1',
      status: 'QUEUED' as const,
      attempt: 0,
      maxAttempts: 3,
      progress: 0,
      requestedAt: '2026-09-04T00:00:00.000Z',
    },
  };
}
