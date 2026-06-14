import assert from 'node:assert/strict';

import {
  reviewTaskActionResponseSchema,
  reviewTaskListQuerySchema,
  reviewTaskListResponseSchema,
  reviewTaskRatingResponseSchema,
  reviewTaskStatusSchema,
  reviewTaskTodayQuerySchema,
  reviewTaskTodayResponseSchema,
} from '../src/api/review-task.ts';

function run() {
  testStatus();
  testTodayQuery();
  testTodayResponse();
  testListQueryAndResponse();
  testRatingResponse();
  testActionResponse();
}

function testStatus() {
  assert.equal(reviewTaskStatusSchema.parse('PENDING'), 'PENDING');
  assert.throws(() => reviewTaskStatusSchema.parse('DONE'));
}

function testTodayQuery() {
  const result = reviewTaskTodayQuerySchema.parse({
    date: '2026-06-14',
    timezoneOffsetMinutes: '-480',
    includeCompleted: 'false',
  });

  assert.equal(result.date, '2026-06-14');
  assert.equal(result.timezoneOffsetMinutes, -480);
  assert.equal(result.includeCompleted, false);

  const booleanResult = reviewTaskTodayQuerySchema.parse({
    includeCompleted: true,
  });
  assert.equal(booleanResult.includeCompleted, true);
}

function testTodayResponse() {
  const result = reviewTaskTodayResponseSchema.parse({
    date: '2026-06-14',
    pendingCount: 1,
    completedCount: 1,
    skippedCount: 1,
    tasks: [createTaskPayload()],
  });

  assert.equal(result.tasks[0]?.status, 'PENDING');
  assert.equal(result.tasks[0]?.wrongQuestion?.subject, '数学');
}

function testListQueryAndResponse() {
  const query = reviewTaskListQuerySchema.parse({
    page: '2',
    pageSize: '10',
    status: 'SKIPPED',
    date: '2026-06-14',
  });
  assert.equal(query.page, 2);
  assert.equal(query.status, 'SKIPPED');

  const response = reviewTaskListResponseSchema.parse({
    items: [createTaskPayload({ status: 'SKIPPED' })],
    total: 1,
    page: 2,
    pageSize: 10,
  });
  assert.equal(response.items[0]?.status, 'SKIPPED');
}

function testRatingResponse() {
  const result = reviewTaskRatingResponseSchema.parse({
    task: createTaskPayload({ status: 'COMPLETED', reviewLogId: 'log_1' }),
    card: createCardPayload({ state: 'REVIEW' }),
    log: {
      id: 'log_1',
      cardId: 'card_1',
      rating: 3,
      scheduledDays: 1,
      elapsedDays: 0,
      reviewDurationMs: 12000,
      stabilityBefore: 0,
      stabilityAfter: 1,
      difficultyBefore: 5,
      difficultyAfter: 4.85,
      reviewedAt: '2026-06-14T08:00:00.000Z',
    },
  });

  assert.equal(result.task.status, 'COMPLETED');
  assert.equal(result.log.rating, 3);
}

function testActionResponse() {
  const result = reviewTaskActionResponseSchema.parse({
    task: createTaskPayload({ status: 'SKIPPED' }),
  });

  assert.equal(result.task.status, 'SKIPPED');
}

function createTaskPayload(input: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'task_1',
    userId: 'user_1',
    cardId: 'card_1',
    reviewLogId: null,
    scheduledDate: '2026-06-14',
    dueAt: '2026-06-14T08:00:00.000Z',
    status: 'PENDING',
    source: 'FSRS',
    completedAt: null,
    skippedAt: null,
    createdAt: '2026-06-14T08:00:00.000Z',
    updatedAt: '2026-06-14T08:00:00.000Z',
    card: createCardPayload(),
    wrongQuestion: {
      id: 'wrong_1',
      questionText: 'Compute 2 + 2.',
      subject: '数学',
      knowledgePoints: ['加法'],
      answer: '4',
      analysis: '2 + 2 = 4.',
      imageUrl: null,
      status: 'UNRESOLVED',
    },
    ...input,
  };
}

function createCardPayload(input: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'card_1',
    userId: 'user_1',
    questionId: null,
    wrongQuestionId: 'wrong_1',
    difficulty: 5,
    stability: 0,
    retrievability: 1,
    lastReview: null,
    nextReview: '2026-06-14T08:00:00.000Z',
    reviewCount: 0,
    lapses: 0,
    state: 'NEW',
    suspendedAt: null,
    createdAt: '2026-06-14T08:00:00.000Z',
    updatedAt: '2026-06-14T08:00:00.000Z',
    ...input,
  };
}

run();
