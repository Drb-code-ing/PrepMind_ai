import assert from 'node:assert/strict';

import { createApiClient } from './api-client.ts';
import {
  createWrongQuestionApi,
  mapLocalWrongQuestionToCreateRequest,
  mapWrongQuestionResponseToLocalRecord,
  mapWrongQuestionStatusToApi,
  mapWrongQuestionStatusToLocal,
} from './wrong-question-api.ts';
import {
  getWrongQuestionFocusHref,
  getWrongQuestionFocusId,
} from './wrong-question-navigation.ts';
import type { WrongQuestionRecord } from './db.ts';

async function run() {
  testBuildsFocusHref();
  testReadsFocusIdFromSearchParams();
  testMapsStatuses();
  testMapsServerResponseToLocalRecord();
  testMapsLocalRecordToCreateRequest();
  testOmitsLocalDataUrlImageFromCreateRequest();
  testKeepsServerUploadImageUrlInCreateRequest();
  await testListsWrongQuestionsWithFilters();
  await testUpdatesWrongQuestion();
}

function testBuildsFocusHref() {
  assert.equal(getWrongQuestionFocusHref('wrong_1'), '/error-book?focus=wrong_1');
  assert.equal(getWrongQuestionFocusHref('wrong 1'), '/error-book?focus=wrong+1');
  assert.equal(getWrongQuestionFocusHref(''), '/error-book');
  assert.equal(getWrongQuestionFocusHref(undefined), '/error-book');
}

function testReadsFocusIdFromSearchParams() {
  assert.equal(getWrongQuestionFocusId(new URLSearchParams('focus=wrong_1')), 'wrong_1');
  assert.equal(getWrongQuestionFocusId(new URLSearchParams('focus=')), null);
  assert.equal(getWrongQuestionFocusId(new URLSearchParams('page=1')), null);
}

function testMapsStatuses() {
  assert.equal(mapWrongQuestionStatusToApi('unresolved'), 'UNRESOLVED');
  assert.equal(mapWrongQuestionStatusToApi('resolved'), 'RESOLVED');
  assert.equal(mapWrongQuestionStatusToLocal('UNRESOLVED'), 'unresolved');
  assert.equal(mapWrongQuestionStatusToLocal('RESOLVED'), 'resolved');
}

function testMapsServerResponseToLocalRecord() {
  const record = mapWrongQuestionResponseToLocalRecord({
    id: 'wrong_1',
    userId: 'user_1',
    source: 'OCR',
    sourceRecordId: null,
    sourceGroupId: 'group_1',
    imageUrl: null,
    questionText: '题干',
    subject: '数学',
    category: '极限',
    knowledgePoints: ['极限'],
    analysis: '分析',
    answer: '答案',
    errorType: null,
    userNote: null,
    rawContent: null,
    status: 'RESOLVED',
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T01:00:00.000Z',
  });

  assert.deepEqual(record, {
    id: 'wrong_1',
    userId: 'user_1',
    source: 'ocr',
    sourceRecordId: undefined,
    sourceGroupId: 'group_1',
    imageUrl: undefined,
    questionText: '题干',
    subject: '数学',
    category: '极限',
    knowledgePoints: ['极限'],
    analysis: '分析',
    answer: '答案',
    errorType: '',
    userNote: '',
    rawContent: '',
    status: 'resolved',
    createdAt: Date.parse('2026-06-11T00:00:00.000Z'),
    updatedAt: Date.parse('2026-06-11T01:00:00.000Z'),
  });
}

function testMapsLocalRecordToCreateRequest() {
  const local: WrongQuestionRecord = {
    id: 'local_1',
    userId: 'user_1',
    source: 'ocr',
    sourceRecordId: 'ocr_1',
    sourceGroupId: 'group_1',
    imageUrl: 'https://cdn.example.com/q.png',
    questionText: '题干',
    subject: '数学',
    category: '极限',
    knowledgePoints: ['极限'],
    analysis: '分析',
    answer: '答案',
    errorType: '计算错误',
    userNote: '',
    rawContent: 'raw',
    status: 'unresolved',
    createdAt: 1,
    updatedAt: 1,
  };

  assert.deepEqual(mapLocalWrongQuestionToCreateRequest(local), {
    source: 'OCR',
    sourceRecordId: 'ocr_1',
    sourceGroupId: 'group_1',
    imageUrl: 'https://cdn.example.com/q.png',
    questionText: '题干',
    subject: '数学',
    category: '极限',
    knowledgePoints: ['极限'],
    analysis: '分析',
    answer: '答案',
    errorType: '计算错误',
    rawContent: 'raw',
  });
}

function testOmitsLocalDataUrlImageFromCreateRequest() {
  const local: WrongQuestionRecord = {
    id: 'local_2',
    userId: 'user_1',
    source: 'ocr',
    sourceRecordId: 'ocr_2',
    sourceGroupId: 'group_2',
    imageUrl: 'data:image/png;base64,abcdefg',
    questionText: '题干',
    subject: '数学',
    category: '极限',
    knowledgePoints: ['极限'],
    analysis: '分析',
    answer: '答案',
    errorType: '',
    userNote: '',
    rawContent: 'raw',
    status: 'unresolved',
    createdAt: 1,
    updatedAt: 1,
  };

  assert.equal(mapLocalWrongQuestionToCreateRequest(local).imageUrl, undefined);
}

function testKeepsServerUploadImageUrlInCreateRequest() {
  const imageUrl =
    'http://localhost:3001/uploads/images/users/user_1/ocr/group_3/image.png';
  const local: WrongQuestionRecord = {
    id: 'local_3',
    userId: 'user_1',
    source: 'ocr',
    sourceRecordId: 'ocr_3',
    sourceGroupId: 'group_3',
    imageUrl,
    questionText: 'question',
    subject: 'math',
    category: 'calculus',
    knowledgePoints: ['calculus'],
    analysis: 'analysis',
    answer: 'answer',
    errorType: '',
    userNote: '',
    rawContent: 'raw',
    status: 'unresolved',
    createdAt: 1,
    updatedAt: 1,
  };

  assert.equal(mapLocalWrongQuestionToCreateRequest(local).imageUrl, imageUrl);
}

async function testListsWrongQuestionsWithFilters() {
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
          page: 2,
          pageSize: 10,
        },
        requestId: 'req_1',
      });
    },
  });
  const wrongQuestionApi = createWrongQuestionApi(client);

  const result = await wrongQuestionApi.list('token_1', {
    page: 2,
    pageSize: 10,
    status: 'resolved',
    subject: '数学',
    keyword: '极限',
  });

  assert.equal(
    requests[0].input,
    'http://localhost:3001/wrong-questions?page=2&pageSize=10&status=RESOLVED&subject=%E6%95%B0%E5%AD%A6&keyword=%E6%9E%81%E9%99%90',
  );
  assert.equal(requests[0].authorization, 'Bearer token_1');
  assert.deepEqual(result, { items: [], total: 0, page: 2, pageSize: 10 });
}

async function testUpdatesWrongQuestion() {
  let body: unknown;
  const client = createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (_input, init) => {
      body = init?.body ? JSON.parse(String(init.body)) : undefined;

      return jsonResponse({
        success: true,
        data: {
          id: 'wrong_1',
          userId: 'user_1',
          source: 'OCR',
          sourceRecordId: null,
          sourceGroupId: null,
          imageUrl: null,
          questionText: '题干',
          subject: '数学',
          category: '极限',
          knowledgePoints: [],
          analysis: '',
          answer: '',
          errorType: null,
          userNote: '已掌握',
          rawContent: null,
          status: 'RESOLVED',
          createdAt: '2026-06-11T00:00:00.000Z',
          updatedAt: '2026-06-11T01:00:00.000Z',
        },
        requestId: 'req_2',
      });
    },
  });
  const wrongQuestionApi = createWrongQuestionApi(client);

  const result = await wrongQuestionApi.update('token_1', 'wrong_1', {
    status: 'resolved',
    userNote: '已掌握',
  });

  assert.deepEqual(body, {
    status: 'RESOLVED',
    userNote: '已掌握',
  });
  assert.equal(result.status, 'resolved');
  assert.equal(result.userNote, '已掌握');
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

await run();
