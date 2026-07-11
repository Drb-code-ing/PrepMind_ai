import assert from 'node:assert/strict';
import test from 'node:test';

import { chatMessagesResponseSchema } from '../src/api/chat-message.ts';

test('chat history accepts only sanitized optional conversation state', () => {
  const response = {
    conversationId: 'conv_1',
    messages: [],
    state: {
      conversationId: 'conv_1',
      activeGoal: '复习导数',
      activeQuestionId: null,
      stateVersion: 1,
      expiresAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-11T00:00:00.000Z',
    },
  };

  assert.equal(chatMessagesResponseSchema.parse(response).state?.stateVersion, 1);
  assert.throws(() =>
    chatMessagesResponseSchema.parse({
      ...response,
      state: { ...response.state, pendingActionProposal: { unsafe: true } },
    }),
  );
  assert.throws(() =>
    chatMessagesResponseSchema.parse({
      ...response,
      state: { ...response.state, conversationId: 'conv_other' },
    }),
  );
});
