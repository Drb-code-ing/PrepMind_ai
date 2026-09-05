import assert from 'node:assert/strict';
import test from 'node:test';

import { createChatTurnHandoffResponse } from './chat-turn-handoff-response.ts';

test('returns an AI SDK-compatible 202 handoff stream with bounded correlation facts', async () => {
  const response = createChatTurnHandoffResponse({
    kind: 'created',
    turn: {
      id: 'turn_1',
      conversationId: 'conv_1',
      status: 'QUEUED',
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z',
    },
    backgroundJob: {
      id: 'job_1',
      status: 'QUEUED',
      attempt: 0,
      maxAttempts: 3,
      progress: 0,
      requestedAt: '2026-09-04T00:00:00.000Z',
    },
  });

  assert.equal(response.status, 202);
  assert.equal(response.headers.get('x-prepmind-chat-turn-path'), 'turn-backed');
  assert.equal(response.headers.get('x-prepmind-chat-turn-id'), 'turn_1');
  const body = await response.text();
  assert.match(body, /prepmind-chat-turn-handoff-v1/u);
  assert.match(body, /回答已加入后台处理/u);
  assert.match(body, /正在连接实时进度/u);
  assert.doesNotMatch(body, /刷新页面查看结果/u);
  assert.doesNotMatch(body, /inputHash|prompt|accessToken/u);
});
