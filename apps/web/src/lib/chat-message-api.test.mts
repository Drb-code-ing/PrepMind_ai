import assert from 'node:assert/strict';

import { createApiClient } from './api-client.ts';
import {
  createChatMessageApi,
  mapChatMessageResponseToLocalRecord,
  mapLocalMessagesToSyncRequest,
} from './chat-message-api.ts';
import type { StoredMessage } from './db.ts';

async function run() {
  testMapsServerResponseToLocalRecord();
  testMapsLocalMessagesToSyncRequest();
  await testListsChatMessages();
  await testSyncsChatMessages();
}

function testMapsServerResponseToLocalRecord() {
  const record = mapChatMessageResponseToLocalRecord({
    id: 'msg_1',
    userId: 'user_1',
    conversationId: 'conv_1',
    role: 'ASSISTANT',
    content: 'hello',
    order: 1,
    metadata: null,
    createdAt: '2026-06-11T00:00:00.000Z',
  });

  assert.deepEqual(record, {
    id: 'msg_1',
    userId: 'user_1',
    role: 'assistant',
    content: 'hello',
    order: 1,
    createdAt: Date.parse('2026-06-11T00:00:00.000Z'),
  });
}

function testMapsLocalMessagesToSyncRequest() {
  const messages: StoredMessage[] = [
    {
      id: 'msg_1',
      userId: 'user_1',
      role: 'user',
      content: 'hi',
      order: 0,
      createdAt: 1,
    },
    {
      id: 'msg_2',
      userId: 'user_1',
      role: 'assistant',
      content: 'hello',
      order: 1,
      createdAt: 2,
    },
  ];

  assert.deepEqual(mapLocalMessagesToSyncRequest(messages, 'conv_1'), {
    conversationId: 'conv_1',
    messages: [
      {
        id: 'msg_1',
        role: 'USER',
        content: 'hi',
        order: 0,
        createdAt: '1970-01-01T00:00:00.001Z',
      },
      {
        id: 'msg_2',
        role: 'ASSISTANT',
        content: 'hello',
        order: 1,
        createdAt: '1970-01-01T00:00:00.002Z',
      },
    ],
  });
}

async function testListsChatMessages() {
  const requests: Array<{ input: string; authorization: string | null }> = [];
  const client = createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (input, init) => {
      requests.push({
        input: String(input),
        authorization: new Headers(init?.headers).get('authorization'),
      });

      return jsonResponse({
        success: true,
        data: {
          conversationId: 'conv_1',
          messages: [],
        },
        requestId: 'req_1',
      });
    },
  });
  const chatMessageApi = createChatMessageApi(client);

  const result = await chatMessageApi.list('token_1', { conversationId: 'conv_1' });

  assert.equal(requests[0].input, 'http://localhost:3001/chat-messages?conversationId=conv_1');
  assert.equal(requests[0].authorization, 'Bearer token_1');
  assert.deepEqual(result, { conversationId: 'conv_1', messages: [] });
}

async function testSyncsChatMessages() {
  let body: unknown;
  const client = createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (_input, init) => {
      body = init?.body ? JSON.parse(String(init.body)) : undefined;

      return jsonResponse({
        success: true,
        data: {
          conversationId: 'conv_1',
          messages: [
            {
              id: 'msg_1',
              userId: 'user_1',
              conversationId: 'conv_1',
              role: 'USER',
              content: 'hi',
              order: 0,
              metadata: null,
              createdAt: '2026-06-11T00:00:00.000Z',
            },
          ],
        },
        requestId: 'req_2',
      });
    },
  });
  const chatMessageApi = createChatMessageApi(client);

  const result = await chatMessageApi.sync('token_1', [
    {
      id: 'msg_1',
      userId: 'user_1',
      role: 'user',
      content: 'hi',
      order: 0,
      createdAt: Date.parse('2026-06-11T00:00:00.000Z'),
    },
  ]);

  assert.deepEqual(body, {
    messages: [
      {
        id: 'msg_1',
        role: 'USER',
        content: 'hi',
        order: 0,
        createdAt: '2026-06-11T00:00:00.000Z',
      },
    ],
  });
  assert.equal(result.conversationId, 'conv_1');
  assert.equal(result.messages[0]?.role, 'user');
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

await run();
