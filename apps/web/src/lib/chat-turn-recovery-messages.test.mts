import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ChatTurnRecoveryHistoryError,
  removeChatTurnRecoveryMessage,
  resolveChatTurnRecoveryMessage,
  upsertChatTurnRecoveryMessage,
} from './chat-turn-recovery-messages.ts';
import type { StoredChatTurnRecovery } from './db.ts';
import type { ChatTurnReplayProgress } from './chat-turn-replay.ts';

test('adds and updates one transient recovery message without duplicating it', () => {
  const first = upsertChatTurnRecoveryMessage(
    [{ id: 'user_1', role: 'user', content: 'Question' }],
    recovery,
    progress({ status: 'QUEUED' }),
  );
  const second = upsertChatTurnRecoveryMessage(
    first,
    recovery,
    progress({ status: 'ACTIVE', previewText: 'partial answer' }),
  );

  assert.equal(second.length, 2);
  assert.match(second[1]?.content ?? '', /partial answer/);
  assert.match(second[1]?.content ?? '', /正在后台生成回答/);
});

test('replaces a handoff exactly once with the PostgreSQL-authoritative response', () => {
  const pending = upsertChatTurnRecoveryMessage(
    [
      { id: 'user_1', role: 'user', content: 'Question' },
      { id: 'assistant_older', role: 'assistant', content: 'Older answer' },
    ],
    recovery,
    progress({ status: 'ACTIVE' }),
  );
  const withLaterMessage = [
    ...pending,
    { id: 'user_later', role: 'user' as const, content: 'Later question' },
  ];
  const result = {
    kind: 'succeeded' as const,
    response: {
      id: 'response_1',
      role: 'ASSISTANT' as const,
      content: 'durable answer',
      order: 2,
      createdAt: '2026-09-05T00:00:02.000Z',
    },
  };
  const resolved = resolveChatTurnRecoveryMessage(withLaterMessage, recovery, result);
  const duplicate = resolveChatTurnRecoveryMessage(resolved, recovery, result);

  assert.deepEqual(duplicate, [
    { id: 'user_1', role: 'user', content: 'Question' },
    { id: 'assistant_older', role: 'assistant', content: 'Older answer' },
    { id: 'response_1', role: 'assistant', content: 'durable answer' },
    { id: 'user_later', role: 'user', content: 'Later question' },
  ]);
});

test('inserts a recovered durable response by server order when the placeholder is absent', () => {
  const result = {
    kind: 'succeeded' as const,
    response: {
      id: 'response_1',
      role: 'ASSISTANT' as const,
      content: 'durable answer',
      order: 1,
      createdAt: '2026-09-05T00:00:02.000Z',
    },
  };

  const resolved = resolveChatTurnRecoveryMessage(
    [
      { id: 'user_1', role: 'user', content: 'Question' },
      { id: 'user_later', role: 'user', content: 'Later question' },
    ],
    recovery,
    result,
  );

  assert.deepEqual(
    resolved.map((message) => message.id),
    ['user_1', 'response_1', 'user_later'],
  );
});

test('rejects a durable response when a preceding hydrated message is missing', () => {
  const pending = upsertChatTurnRecoveryMessage(
    [{ id: 'user_1', role: 'user', content: 'Question' }],
    recovery,
    progress({ status: 'ACTIVE' }),
  );

  assert.throws(
    () =>
      resolveChatTurnRecoveryMessage(pending, recovery, {
        kind: 'succeeded',
        response: {
          id: 'response_1',
          role: 'ASSISTANT',
          content: 'durable answer',
          order: 2,
          createdAt: '2026-09-05T00:00:02.000Z',
        },
      }),
    ChatTurnRecoveryHistoryError,
  );
});

test('removes only the matching failed or cancelled recovery placeholder', () => {
  const other = {
    ...recovery,
    id: 'user_1\u0000turn_2',
    turnId: 'turn_2',
    placeholderMessageId: 'placeholder_2',
  };
  const messages = upsertChatTurnRecoveryMessage(
    upsertChatTurnRecoveryMessage([], recovery, progress({ status: 'ACTIVE' })),
    other,
    progress({ status: 'ACTIVE' }),
  );

  const remaining = removeChatTurnRecoveryMessage(messages, recovery.turnId);

  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.id, 'placeholder_2');
});

const recovery: StoredChatTurnRecovery = {
  id: 'user_1\u0000turn_1',
  schemaVersion: 'chat-turn-recovery-v1',
  userId: 'user_1',
  conversationId: 'conv_1',
  turnId: 'turn_1',
  backgroundJobId: 'job_1',
  placeholderMessageId: 'placeholder_1',
  status: 'QUEUED',
  transport: 'available',
  cursor: null,
  lastSequence: null,
  previewText: '',
  createdAt: 1_000,
  updatedAt: 1_000,
  expiresAt: 2_000,
};

function progress(overrides: Partial<ChatTurnReplayProgress>): ChatTurnReplayProgress {
  return {
    status: 'ACTIVE',
    transport: 'available',
    cursor: null,
    lastSequence: null,
    previewText: '',
    progress: 20,
    attempt: 1,
    maxAttempts: 3,
    reconnecting: false,
    ...overrides,
  };
}
