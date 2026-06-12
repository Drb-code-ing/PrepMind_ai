import assert from 'node:assert/strict';

import { createApiClient } from './api-client.ts';
import {
  createOcrRecordApi,
  mapLocalOcrRecordToCreateRequest,
  mapOcrRecordResponseToLocalRecord,
} from './ocr-record-api.ts';
import type { OcrRecord } from './db.ts';

async function run() {
  testMapsServerResponseToLocalRecord();
  testStripsBase64ImageFromCreateRequest();
  testKeepsServerImageUrlInCreateRequest();
  await testListsOcrRecords();
  await testCreatesOcrRecord();
}

function testMapsServerResponseToLocalRecord() {
  const record = mapOcrRecordResponseToLocalRecord({
    id: 'ocr_1',
    userId: 'user_1',
    groupId: 'group_1',
    imageUrl: 'https://cdn.example.com/ocr.png',
    rawText: 'raw',
    parsedJson: { isQuestion: true, questionText: '题目' },
    status: 'DONE',
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:01.000Z',
  });

  assert.deepEqual(record, {
    id: 'ocr_1',
    userId: 'user_1',
    type: 'ocr-result',
    groupId: 'group_1',
    content: 'raw',
    imageUrl: 'https://cdn.example.com/ocr.png',
    createdAt: Date.parse('2026-06-12T00:00:00.000Z'),
  });
}

function testStripsBase64ImageFromCreateRequest() {
  const record: OcrRecord = {
    id: 'ocr_1',
    userId: 'user_1',
    type: 'ocr-result',
    groupId: 'group_1',
    content: 'raw',
    imageUrl: 'data:image/png;base64,abc',
    createdAt: 1,
  };

  assert.deepEqual(
    mapLocalOcrRecordToCreateRequest(record, {
      isQuestion: false,
      nonQuestionSummary: '普通图片',
    }),
    {
      groupId: 'group_1',
      rawText: 'raw',
      parsedJson: {
        isQuestion: false,
        nonQuestionSummary: '普通图片',
      },
      status: 'DONE',
    },
  );
}

function testKeepsServerImageUrlInCreateRequest() {
  const imageUrl =
    'http://localhost:3001/uploads/images/users/user_1/ocr/group_2/image.png';
  const record: OcrRecord = {
    id: 'ocr_2',
    userId: 'user_1',
    type: 'ocr-result',
    groupId: 'group_2',
    content: 'raw',
    imageUrl,
    createdAt: 1,
  };

  assert.equal(
    mapLocalOcrRecordToCreateRequest(record, {
      isQuestion: true,
      questionText: 'question',
    }).imageUrl,
    imageUrl,
  );
}

async function testListsOcrRecords() {
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
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
        },
        requestId: 'req_1',
      });
    },
  });

  const api = createOcrRecordApi(client);
  const result = await api.list('token_1', {
    page: 1,
    pageSize: 20,
    isQuestion: false,
    keyword: '普通',
  });

  assert.equal(
    requests[0].input,
    'http://localhost:3001/ocr-records?page=1&pageSize=20&keyword=%E6%99%AE%E9%80%9A&isQuestion=false',
  );
  assert.equal(requests[0].authorization, 'Bearer token_1');
  assert.deepEqual(result, { items: [], total: 0, page: 1, pageSize: 20 });
}

async function testCreatesOcrRecord() {
  let body: unknown;
  const client = createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (_input, init) => {
      body = init?.body ? JSON.parse(String(init.body)) : undefined;

      return jsonResponse({
        success: true,
        data: {
          id: 'ocr_1',
          userId: 'user_1',
          groupId: 'group_1',
          imageUrl: null,
          rawText: 'raw',
          parsedJson: { isQuestion: true },
          status: 'DONE',
          createdAt: '2026-06-12T00:00:00.000Z',
          updatedAt: '2026-06-12T00:00:00.000Z',
        },
        requestId: 'req_2',
      });
    },
  });

  const api = createOcrRecordApi(client);
  const result = await api.create(
    'token_1',
    {
      id: 'local_1',
      userId: 'user_1',
      type: 'ocr-result',
      groupId: 'group_1',
      content: 'raw',
      createdAt: Date.parse('2026-06-12T00:00:00.000Z'),
    },
    { isQuestion: true },
  );

  assert.deepEqual(body, {
    groupId: 'group_1',
    rawText: 'raw',
    parsedJson: { isQuestion: true },
    status: 'DONE',
  });
  assert.equal(result.id, 'ocr_1');
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

await run();
