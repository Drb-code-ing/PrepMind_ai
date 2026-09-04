import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chatMessagesResponseSchema,
  prepareChatMessagesRequestSchema,
  prepareChatMessagesResponseSchema,
} from '../src/api/chat-message.ts';

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

test('turn preparation accepts a bounded user-tail snapshot and rejects ambiguous input', () => {
  const request = {
    conversationId: 'conv_1',
    messages: [
      {
        id: 'msg_1',
        role: 'ASSISTANT',
        content: 'Earlier answer',
        order: 0,
        createdAt: '2026-09-04T00:00:00.000Z',
      },
      {
        id: 'msg_2',
        role: 'USER',
        content: 'Follow-up question',
        order: 1,
      },
    ],
  };

  assert.deepEqual(prepareChatMessagesRequestSchema.parse(request), request);
  assert.deepEqual(
    prepareChatMessagesRequestSchema
      .parse({
        ...request,
        messages: request.messages.map((message) => ({ ...message, order: message.order + 500 })),
      })
      .messages.map((message) => message.order),
    [500, 501],
  );

  for (const invalid of [
    { ...request, unknown: true },
    { ...request, messages: [request.messages[0], { ...request.messages[1], id: 'msg_1' }] },
    { ...request, messages: [request.messages[0], { ...request.messages[1], order: 0 }] },
    {
      ...request,
      messages: [request.messages[0], { ...request.messages[1], order: 2 }],
    },
    { ...request, messages: [{ ...request.messages[1], role: 'ASSISTANT' }] },
  ]) {
    assert.throws(() => prepareChatMessagesRequestSchema.parse(invalid));
  }
});

test('turn preparation response is strict and conversation-bound', () => {
  const response = {
    conversationId: 'conv_1',
    messages: [
      {
        id: 'msg_1',
        userId: 'user_1',
        conversationId: 'conv_1',
        role: 'USER',
        content: 'Question',
        order: 0,
        metadata: null,
        createdAt: '2026-09-04T00:00:00.000Z',
      },
    ],
  };

  assert.deepEqual(prepareChatMessagesResponseSchema.parse(response), response);
  assert.throws(() =>
    prepareChatMessagesResponseSchema.parse({
      ...response,
      messages: [{ ...response.messages[0], conversationId: 'conv_other' }],
    }),
  );
  assert.throws(() => prepareChatMessagesResponseSchema.parse({ ...response, secret: true }));
});
