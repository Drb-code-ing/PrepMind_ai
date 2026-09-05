import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('keeps a ChatTurn handoff placeholder out of snapshot sync and blocks overlapping submit', async () => {
  const source = await readFile(new URL('./chat-runtime-provider.tsx', import.meta.url), 'utf8');
  const pendingIndex = source.indexOf('hasPendingChatTurnHandoff(runtimeMessages)');
  const completionIndex = source.indexOf('const completionGuard = getChatCompletionGuard');

  assert.ok(pendingIndex >= 0);
  assert.ok(completionIndex > pendingIndex);
  assert.match(source, /omitChatTurnHandoffMessages\(runtimeMessages\)\.map/u);
  assert.match(
    source,
    /chatTurnRecoveryRef\.current \|\|[\s\S]*?hasPendingChatTurnHandoff\([\s\S]*?messagesRef\.current[\s\S]*?setChatError\('上一条回答仍在后台处理中，请等待完成后再继续发送/u,
  );
  assert.match(
    source,
    /chatTurnRecoveryRef\.current \|\|[\s\S]*?hasPendingChatTurnHandoff\(runtimeMessages\)[\s\S]*?return;/u,
  );
  assert.match(
    source,
    /conversationStateRestore[\s\S]*?readLatestForUser\([\s\S]*?userId,[\s\S]*?restoredConversationId,[\s\S]*?\)/u,
  );
});
