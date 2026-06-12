import assert from 'node:assert/strict';

import {
  createOcrRecordRequestSchema,
  listOcrRecordsQuerySchema,
  ocrRecordSchema,
} from '../src/api/ocr-record.ts';

function run() {
  testCreateRequestDefaultsToDone();
  testCreateRequestAllowsImageUrlForServiceValidation();
  testListQueryCoercesPaginationAndQuestionFilter();
  testOcrRecordResponseAcceptsParsedPayload();
}

function testCreateRequestDefaultsToDone() {
  const result = createOcrRecordRequestSchema.parse({
    groupId: 'ocr-1',
    rawText: '## 识别结果\n题目',
    parsedJson: {
      isQuestion: true,
      questionText: '计算极限。',
    },
  });

  assert.equal(result.status, 'DONE');
}

function testCreateRequestAllowsImageUrlForServiceValidation() {
  const result = createOcrRecordRequestSchema.parse({
    groupId: 'ocr-1',
    rawText: 'raw',
    imageUrl: 'data:image/png;base64,abc',
  });

  assert.equal(result.imageUrl, 'data:image/png;base64,abc');
}

function testListQueryCoercesPaginationAndQuestionFilter() {
  const result = listOcrRecordsQuerySchema.parse({
    page: '2',
    pageSize: '10',
    isQuestion: 'false',
  });

  assert.deepEqual(result, {
    page: 2,
    pageSize: 10,
    isQuestion: false,
  });
}

function testOcrRecordResponseAcceptsParsedPayload() {
  const result = ocrRecordSchema.parse({
    id: 'ocr_1',
    userId: 'user_1',
    groupId: 'group_1',
    imageUrl: null,
    rawText: 'raw',
    parsedJson: {
      isQuestion: false,
      nonQuestionSummary: '普通图片',
    },
    status: 'DONE',
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:01.000Z',
  });

  assert.equal(result.parsedJson?.isQuestion, false);
}

run();
