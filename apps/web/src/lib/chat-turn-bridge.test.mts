import assert from 'node:assert/strict';
import test from 'node:test';

import {
  admitChatTurnBridge,
  resolveChatTurnBridgeConfig,
  resolveChatTurnBridgeDecision,
} from './chat-turn-bridge.ts';

const messages = [
  {
    id: 'msg_1',
    role: 'user' as const,
    content: 'Question',
    createdAt: '2026-09-04T00:00:00.000Z',
  },
];

test('ChatTurn bridge is opt-in and validates its budget policy only when enabled', () => {
  assert.deepEqual(resolveChatTurnBridgeConfig({}), {
    enabled: false,
    budgetPolicyVersion: 'chat-budget-v1',
  });
  assert.deepEqual(
    resolveChatTurnBridgeConfig({
      PREPMIND_CHAT_TURN_BRIDGE_ENABLED: 'true',
      PREPMIND_CHAT_TURN_BUDGET_POLICY_VERSION: 'chat-budget-v2',
    }),
    { enabled: true, budgetPolicyVersion: 'chat-budget-v2' },
  );
  assert.throws(() =>
    resolveChatTurnBridgeConfig({
      PREPMIND_CHAT_TURN_BRIDGE_ENABLED: 'true',
      PREPMIND_CHAT_TURN_BUDGET_POLICY_VERSION: ' ',
    }),
  );
});

test('ChatTurn bridge keeps only explicit safe legacy paths for rollout compatibility', () => {
  assert.deepEqual(
    resolveChatTurnBridgeDecision({
      config: resolveChatTurnBridgeConfig({}),
      conversationId: 'conv_1',
      messages,
    }),
    { kind: 'legacy', reason: 'disabled' },
  );
  assert.deepEqual(
    resolveChatTurnBridgeDecision({
      config: { enabled: true, budgetPolicyVersion: 'chat-budget-v1' },
      conversationId: null,
      messages,
    }),
    { kind: 'legacy', reason: 'conversation-not-ready' },
  );
  assert.deepEqual(
    resolveChatTurnBridgeDecision({
      config: { enabled: true, budgetPolicyVersion: 'chat-budget-v1' },
      conversationId: 'conv_1',
      messages: [{ ...messages[0], id: null }],
    }),
    { kind: 'reject', reason: 'message-identity-unavailable' },
  );
});

test('ChatTurn bridge selects a bounded contiguous tail with durable absolute orders', () => {
  const longConversation = Array.from({ length: 1_002 }, (_, index) => ({
    id: `msg_${index}`,
    role: (index === 1_001 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `message ${index}`,
  }));

  const decision = resolveChatTurnBridgeDecision({
    config: { enabled: true, budgetPolicyVersion: 'chat-budget-v1' },
    conversationId: 'conv_1',
    messages: longConversation,
  });

  assert.equal(decision.kind, 'enqueue');
  if (decision.kind !== 'enqueue') return;
  assert.equal(decision.prepareRequest.messages.length, 1_000);
  assert.equal(decision.prepareRequest.messages[0]?.id, 'msg_2');
  assert.equal(decision.prepareRequest.messages[0]?.order, 2);
  assert.equal(decision.prepareRequest.messages.at(-1)?.order, 1_001);
});

test('ChatTurn bridge rejects an invalid bounded window instead of falling through to Provider', () => {
  const decision = resolveChatTurnBridgeDecision({
    config: { enabled: true, budgetPolicyVersion: 'chat-budget-v1' },
    conversationId: 'conv_1',
    messages: [{ ...messages[0], content: 'x'.repeat(100_001) }],
  });

  assert.deepEqual(decision, { kind: 'reject', reason: 'message-window-invalid' });
});

test('ChatTurn bridge persists the snapshot before enqueueing bounded references', async () => {
  const calls: string[] = [];
  const enqueueBodies: unknown[] = [];
  const dependencies = {
    prepareMessages: async () => {
      calls.push('prepare');
      return {
        conversationId: 'conv_1',
        messages: [
          {
            id: 'msg_1',
            userId: 'user_1',
            role: 'user' as const,
            content: 'Question',
            order: 0,
            createdAt: Date.parse('2026-09-04T00:00:00.000Z'),
          },
        ],
      };
    },
    enqueueTurn: async (_token: string, body: unknown) => {
      calls.push('enqueue');
      enqueueBodies.push(body);
      return {
        kind: 'created' as const,
        turn: {
          id: 'turn_1',
          conversationId: 'conv_1',
          status: 'QUEUED' as const,
          createdAt: '2026-09-04T00:00:01.000Z',
          updatedAt: '2026-09-04T00:00:01.000Z',
        },
        backgroundJob: {
          id: 'job_1',
          status: 'QUEUED' as const,
          attempt: 0,
          maxAttempts: 3,
          progress: 0,
          requestedAt: '2026-09-04T00:00:01.000Z',
        },
      };
    },
  };
  const decision = resolveChatTurnBridgeDecision({
    config: { enabled: true, budgetPolicyVersion: 'chat-budget-v1' },
    conversationId: 'conv_1',
    messages,
  });
  assert.equal(decision.kind, 'enqueue');
  if (decision.kind !== 'enqueue') return;

  const first = await admitChatTurnBridge(
    {
      ownerId: 'user_1',
      accessToken: 'token_1',
      decision,
    },
    dependencies,
  );
  const second = await admitChatTurnBridge(
    {
      ownerId: 'user_1',
      accessToken: 'token_1',
      decision,
    },
    dependencies,
  );

  assert.equal(first.turn.id, 'turn_1');
  assert.equal(second.turn.id, 'turn_1');
  assert.deepEqual(calls, ['prepare', 'enqueue', 'prepare', 'enqueue']);
  assert.deepEqual(enqueueBodies[0], enqueueBodies[1]);
  assert.deepEqual(Object.keys(enqueueBodies[0] as object).sort(), [
    'budgetPolicyVersion',
    'clientRequestId',
    'conversationId',
    'inputHash',
    'inputMessageIds',
  ]);
  assert.doesNotMatch(JSON.stringify(enqueueBodies[0]), /Question/u);
});

test('ChatTurn bridge fails closed when preparation fails or changes owner facts', async () => {
  const decision = resolveChatTurnBridgeDecision({
    config: { enabled: true, budgetPolicyVersion: 'chat-budget-v1' },
    conversationId: 'conv_1',
    messages,
  });
  assert.equal(decision.kind, 'enqueue');
  if (decision.kind !== 'enqueue') return;

  let enqueueCalls = 0;
  await assert.rejects(() =>
    admitChatTurnBridge(
      { ownerId: 'user_1', accessToken: 'token_1', decision },
      {
        prepareMessages: async () => {
          throw new Error('prepare unavailable');
        },
        enqueueTurn: async () => {
          enqueueCalls += 1;
          throw new Error('must not run');
        },
      },
    ),
  );
  assert.equal(enqueueCalls, 0);

  await assert.rejects(
    () =>
      admitChatTurnBridge(
        { ownerId: 'user_1', accessToken: 'token_1', decision },
        {
          prepareMessages: async () => ({
            conversationId: 'conv_1',
            messages: [
              {
                id: 'msg_1',
                userId: 'user_2',
                role: 'user',
                content: 'Question',
                order: 0,
                createdAt: Date.parse('2026-09-04T00:00:00.000Z'),
              },
            ],
          }),
          enqueueTurn: async () => {
            throw new Error('must not run');
          },
        },
      ),
    /owner/u,
  );
});
