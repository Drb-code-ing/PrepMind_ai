import assert from 'node:assert/strict';
import test from 'node:test';

import * as chatRuntimeRequest from '../../lib/chat-runtime-request.ts';

test('reads the current runtime context for every prepared chat request', () => {
  assert.equal(typeof chatRuntimeRequest.createChatRuntimeRequestBodyPreparer, 'function');
  let conversationId: string | null = 'conv_1';
  let activeContext = {
    type: 'ocr-question' as const,
    questionText: 'question from OCR',
  };
  let accessToken: string | null = 'token_1';
  const prepareRequestBody = chatRuntimeRequest.createChatRuntimeRequestBodyPreparer({
    getConversationId: () => conversationId,
    getActiveContext: () => activeContext,
    getAccessToken: () => accessToken,
  });

  assert.deepEqual(
    prepareRequestBody({
      requestBody: { existing: true },
      messages: [{ role: 'user', content: 'first question' }],
    }),
    {
      existing: true,
      messages: [{ role: 'user', content: 'first question' }],
      activeContext,
      accessToken: 'token_1',
      conversationId: 'conv_1',
    },
  );

  conversationId = 'conv_2';
  activeContext = {
    type: 'ocr-question',
    questionText: 'updated OCR question',
  };
  accessToken = 'token_2';

  const nextBody = prepareRequestBody({
    messages: [{ role: 'user', content: 'next question' }],
  });
  assert.equal(nextBody.conversationId, 'conv_2');
  assert.equal(nextBody.accessToken, 'token_2');
  assert.deepEqual(nextBody.activeContext, activeContext);
});
