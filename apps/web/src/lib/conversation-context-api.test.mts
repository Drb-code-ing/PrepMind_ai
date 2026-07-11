import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONVERSATION_CONTEXT_PREPARE_FAILED,
  prepareConversationContextSafely,
  prepareConversationContext,
} from './conversation-context-api.ts';

const response = {
  conversationId: 'conv_1',
  summaryBuffer: 'Earlier summary',
  coveredThroughOrder: 11,
  summaryVersion: 1,
  summaryStatus: 'generated' as const,
  state: {
    conversationId: 'conv_1',
    activeGoal: 'Review calculus',
    activeQuestionId: null,
    stateVersion: 1,
    expiresAt: '2026-07-12T01:00:00.000Z',
    updatedAt: '2026-07-11T01:00:00.000Z',
  },
  debug: {
    uncoveredMessageCount: 12,
    triggerReason: 'message_count' as const,
    modelMode: 'mock' as const,
    errorCode: null,
  },
};

test('posts an authenticated strict prepare request and propagates abort', async () => {
  const controller = new AbortController();
  let captured:
    | { path: string; body: unknown; accessToken?: string | null; signal?: AbortSignal | null }
    | undefined;
  const client = {
    async post<T>(
      path: string,
      body: unknown,
      options?: { accessToken?: string | null; signal?: AbortSignal | null },
    ) {
      captured = { path, body, ...options };
      return response as T;
    },
  };

  const result = await prepareConversationContext(
    {
      accessToken: 'token_1',
      request: { conversationId: 'conv_1', maxInputTokens: 2500 },
      signal: controller.signal,
    },
    client,
  );

  assert.deepEqual(result, response);
  assert.equal(captured?.path, '/conversation-context/prepare');
  assert.deepEqual(captured?.body, { conversationId: 'conv_1', maxInputTokens: 2500 });
  assert.equal(captured?.accessToken, 'token_1');
  assert.equal(captured?.signal, controller.signal);
});

test('rejects unknown prepare request fields before posting', async () => {
  let postCalls = 0;
  const client = {
    async post<T>() {
      postCalls += 1;
      return response as T;
    },
  };

  await assert.rejects(
    prepareConversationContext(
      {
        accessToken: 'token_1',
        request: {
          conversationId: 'conv_1',
          maxInputTokens: 2500,
          rawPrompt: 'must not cross the client boundary',
        },
      },
      client,
    ),
  );

  assert.equal(postCalls, 0);
});

test('rejects invalid prepare request fields before posting', async () => {
  let postCalls = 0;
  const client = {
    async post<T>() {
      postCalls += 1;
      return response as T;
    },
  };

  await assert.rejects(
    prepareConversationContext(
      {
        accessToken: 'token_1',
        request: { conversationId: '', maxInputTokens: 199 },
      },
      client,
    ),
  );

  assert.equal(postCalls, 0);
});

test('rejects a non-strict prepare response', async () => {
  const client = {
    async post<T>() {
      return { ...response, summaryBuffer: null } as T;
    },
  };

  await assert.rejects(
    prepareConversationContext(
      {
        accessToken: 'token_1',
        request: { conversationId: 'conv_1', maxInputTokens: 2500 },
      },
      client,
    ),
  );
});

test('returns a fixed degraded result without exposing raw failure data', async () => {
  const warnings: unknown[][] = [];
  const client = {
    async post<T>() {
      throw new Error('provider body contains token_very_secret and Earlier summary');
      return undefined as T;
    },
  };

  const result = await prepareConversationContextSafely(
    {
      accessToken: 'token_very_secret',
      request: { conversationId: 'conv_1', maxInputTokens: 2500 },
    },
    client,
    { warn: (...values: unknown[]) => warnings.push(values) },
  );

  assert.deepEqual(result, {
    conversationId: 'conv_1',
    summaryBuffer: null,
    coveredThroughOrder: null,
    summaryVersion: null,
    summaryStatus: 'degraded',
    state: null,
    safeErrorCode: CONVERSATION_CONTEXT_PREPARE_FAILED,
  });
  assert.deepEqual(warnings, [['[ConversationContext] prepare failed']]);
  const serialized = JSON.stringify({ result, warnings });
  assert.doesNotMatch(serialized, /token_very_secret|Earlier summary|provider body/i);
});
