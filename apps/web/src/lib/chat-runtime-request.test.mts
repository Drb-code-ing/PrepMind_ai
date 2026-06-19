import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChatRuntimeRequestBody } from './chat-runtime-request.ts';

test('builds chat request body with active context and access token', () => {
  const body = buildChatRuntimeRequestBody({
    requestBody: { existing: true },
    messages: [{ role: 'user', content: 'question' }],
    activeContext: {
      type: 'ocr-question',
      questionText: 'question from OCR',
    },
    accessToken: 'token',
  });

  assert.deepEqual(body, {
    existing: true,
    messages: [{ role: 'user', content: 'question' }],
    activeContext: {
      type: 'ocr-question',
      questionText: 'question from OCR',
    },
    accessToken: 'token',
  });
});

test('normalizes missing access token to null', () => {
  const body = buildChatRuntimeRequestBody({
    messages: [{ role: 'user', content: 'question' }],
    activeContext: null,
    accessToken: undefined,
  });

  assert.equal(body.accessToken, null);
});
