import assert from 'node:assert/strict';
import test from 'node:test';

import type { OcrRecord, WrongQuestionRecord } from './db.ts';
import {
  mergeOcrRecordsFromServer,
  mergeWrongQuestionsFromServer,
} from './server-cache-sync.ts';

const cachedWrongQuestion: WrongQuestionRecord = {
  id: 'wrong_1',
  userId: 'user_1',
  source: 'ocr',
  sourceRecordId: 'ocr_1',
  sourceGroupId: 'group_1',
  imageUrl: 'data:image/png;base64,local',
  questionText: 'stale question',
  subject: '数学',
  category: '导数',
  knowledgePoints: ['导数'],
  analysis: '',
  answer: '',
  errorType: '',
  userNote: '',
  rawContent: '',
  status: 'unresolved',
  createdAt: 1,
  updatedAt: 1,
};

test('wrong question cache follows server authority and keeps local image previews', () => {
  const serverItem: WrongQuestionRecord = {
    ...cachedWrongQuestion,
    id: 'wrong_2',
    sourceGroupId: 'group_2',
    imageUrl: undefined,
    questionText: 'server question',
    createdAt: 2,
    updatedAt: 2,
  };
  const cachedImageForServerItem: WrongQuestionRecord = {
    ...cachedWrongQuestion,
    id: 'wrong_2',
    sourceGroupId: 'group_2',
    imageUrl: 'data:image/png;base64,preserved',
  };

  const merged = mergeWrongQuestionsFromServer(
    [serverItem],
    [cachedWrongQuestion, cachedImageForServerItem],
  );

  assert.deepEqual(
    merged.map((item) => item.id),
    ['wrong_2'],
  );
  assert.equal(merged[0].questionText, 'server question');
  assert.equal(merged[0].imageUrl, 'data:image/png;base64,preserved');
});

test('wrong question cache clears when server returns no items', () => {
  assert.deepEqual(mergeWrongQuestionsFromServer([], [cachedWrongQuestion]), []);
});

test('ocr cache follows server authority and keeps matching local user image records', () => {
  const staleUser: OcrRecord = {
    id: 'group_stale-user',
    userId: 'user_1',
    type: 'user',
    groupId: 'group_stale',
    imageUrl: 'data:image/png;base64,stale',
    content: '',
    createdAt: 1,
  };
  const localUser: OcrRecord = {
    id: 'group_1-user',
    userId: 'user_1',
    type: 'user',
    groupId: 'group_1',
    imageUrl: 'data:image/png;base64,kept',
    content: '',
    createdAt: 2,
  };
  const localResult: OcrRecord = {
    id: 'group_1-local-result',
    userId: 'user_1',
    type: 'ocr-result',
    groupId: 'group_1',
    imageUrl: 'data:image/png;base64,result-image',
    content: 'local result',
    createdAt: 3,
  };
  const serverResult: OcrRecord = {
    id: 'group_1-server-result',
    userId: 'user_1',
    type: 'ocr-result',
    groupId: 'group_1',
    content: 'server result',
    createdAt: 4,
  };

  const merged = mergeOcrRecordsFromServer(
    [serverResult],
    [staleUser, localUser, localResult],
  );

  assert.deepEqual(
    merged.map((item) => item.id),
    ['group_1-user', 'group_1-server-result'],
  );
  assert.equal(merged[0].imageUrl, 'data:image/png;base64,kept');
  assert.equal(merged[1].content, 'server result');
  assert.equal(merged[1].imageUrl, 'data:image/png;base64,result-image');
});

test('ocr cache clears when server returns no records', () => {
  const localUser: OcrRecord = {
    id: 'group_1-user',
    userId: 'user_1',
    type: 'user',
    groupId: 'group_1',
    imageUrl: 'data:image/png;base64,stale',
    content: '',
    createdAt: 1,
  };

  assert.deepEqual(mergeOcrRecordsFromServer([], [localUser]), []);
});

test('wrong question cache keeps local failed items while following server authority', () => {
  const localFailed: WrongQuestionRecord = {
    ...cachedWrongQuestion,
    id: 'wrong_failed',
    sourceGroupId: 'group_failed',
    questionText: 'local unsynced',
    syncStatus: 'failed',
    pendingOperation: 'create',
  };

  const merged = mergeWrongQuestionsFromServer([], [localFailed]);

  assert.deepEqual(
    merged.map((item) => item.id),
    ['wrong_failed'],
  );
  assert.equal(merged[0].syncStatus, 'failed');
});

test('wrong question cache hides pending delete items from merged cache', () => {
  const pendingDelete: WrongQuestionRecord = {
    ...cachedWrongQuestion,
    syncStatus: 'failed',
    pendingOperation: 'delete',
  };

  assert.deepEqual(mergeWrongQuestionsFromServer([], [pendingDelete]), []);
});

test('ocr cache keeps local failed result records while following server authority', () => {
  const localFailed: OcrRecord = {
    id: 'ocr_failed',
    userId: 'user_1',
    type: 'ocr-result',
    groupId: 'group_failed',
    imageUrl: 'data:image/png;base64,local',
    content: 'local failed sync',
    createdAt: 1,
    syncStatus: 'failed',
    pendingOperation: 'create',
  };

  const merged = mergeOcrRecordsFromServer([], [localFailed]);

  assert.deepEqual(
    merged.map((item) => item.id),
    ['ocr_failed'],
  );
});
