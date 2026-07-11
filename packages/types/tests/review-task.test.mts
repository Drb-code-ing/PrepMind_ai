import assert from 'node:assert/strict';

import {
  reviewTaskActionResponseSchema,
  reviewTaskListQuerySchema,
  reviewTaskListResponseSchema,
  reviewTaskPlanQuerySchema,
  reviewTaskPlanResponseSchema,
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
  testPlanQuery();
  testPlanResponse();
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
      clientMutationId: '550e8400-e29b-41d4-a716-446655440000',
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
  assert.equal(result.log.clientMutationId, '550e8400-e29b-41d4-a716-446655440000');
}

function testActionResponse() {
  const result = reviewTaskActionResponseSchema.parse({
    task: createTaskPayload({ status: 'SKIPPED' }),
  });

  assert.equal(result.task.status, 'SKIPPED');
}

function testPlanQuery() {
  const defaultQuery = reviewTaskPlanQuerySchema.parse({});
  assert.equal(defaultQuery.days, 7);
  assert.equal(defaultQuery.timezoneOffsetMinutes, 0);
  assert.equal(defaultQuery.startDate, undefined);

  const timezoneQuery = reviewTaskPlanQuerySchema.parse({
    timezoneOffsetMinutes: '-480',
  });
  assert.equal(timezoneQuery.timezoneOffsetMinutes, -480);

  const explicitQuery = reviewTaskPlanQuerySchema.parse({
    days: '14',
    startDate: '2026-06-16',
    timezoneOffsetMinutes: '0',
  });
  assert.equal(explicitQuery.days, 14);
  assert.equal(explicitQuery.startDate, '2026-06-16');

  assert.throws(() => reviewTaskPlanQuerySchema.parse({ days: '0' }));
  assert.throws(() => reviewTaskPlanQuerySchema.parse({ days: '15' }));
  assert.throws(() => reviewTaskPlanQuerySchema.parse({ startDate: '2026/06/16' }));
  assert.throws(() => reviewTaskPlanQuerySchema.parse({ startDate: '2026-13-01' }));
  assert.throws(() => reviewTaskPlanQuerySchema.parse({ startDate: '2026-02-31' }));
  assert.throws(() => reviewTaskPlanQuerySchema.parse({ timezoneOffsetMinutes: '-841' }));
  assert.throws(() => reviewTaskPlanQuerySchema.parse({ timezoneOffsetMinutes: '841' }));
}

function testPlanResponse() {
  const result = reviewTaskPlanResponseSchema.parse({
    startDate: '2026-06-16',
    endDate: '2026-06-22',
    generatedThroughDate: '2026-06-22',
    summary: {
      overdueCount: 1,
      todayDueCount: 2,
      upcomingDueCount: 3,
      estimatedTotalMinutes: 12,
      peakDay: { date: '2026-06-18', count: 3 },
      intensity: 'normal',
      capacityStatus: 'under',
      dailyMinutes: 25,
      dailyCardLimit: 12,
    },
    days: [
      {
        date: '2026-06-16',
        label: '浠婂ぉ',
        dueCount: 2,
        overdueCount: 1,
        pendingCount: 1,
        completedCount: 0,
        skippedCount: 0,
        estimatedMinutes: 4,
        intensity: 'light',
        pressureScore: 2,
        capacityStatus: 'under',
        reasons: [],
      },
    ],
    suggestion: {
      title: '鍏堝鐞嗛€炬湡鍗?',
      description: '浠婂ぉ鍏堝畬鎴?1 寮犻€炬湡鍗★紝鍐嶈繘鍏ユ甯稿涔犺妭濂忋€?',
      actionLabel: '鍘讳粖鏃ヤ换鍔?',
      actionHref: '/today',
    },
  });

  assert.equal(result.summary.peakDay?.date, '2026-06-18');
  assert.equal(result.days[0]?.intensity, 'light');

  const nullablePeakDayResult = reviewTaskPlanResponseSchema.parse(
    createPlanResponseEdgePayload({ peakDay: null }),
  );
  assert.equal(nullablePeakDayResult.summary.peakDay, null);

  assert.throws(() =>
    reviewTaskPlanResponseSchema.parse(createPlanResponseEdgePayload({ intensity: 'extreme' })),
  );
}

function createPlanResponseEdgePayload(summary: Partial<Record<string, unknown>> = {}) {
  return {
    startDate: '2026-06-16',
    endDate: '2026-06-22',
    generatedThroughDate: '2026-06-22',
    summary: {
      overdueCount: 1,
      todayDueCount: 2,
      upcomingDueCount: 3,
      estimatedTotalMinutes: 12,
      peakDay: { date: '2026-06-18', count: 3 },
      intensity: 'normal',
      capacityStatus: 'under',
      dailyMinutes: 25,
      dailyCardLimit: 12,
      ...summary,
    },
    days: [
      {
        date: '2026-06-16',
        label: 'Today',
        dueCount: 2,
        overdueCount: 1,
        pendingCount: 1,
        completedCount: 0,
        skippedCount: 0,
        estimatedMinutes: 4,
        intensity: 'light',
        pressureScore: 2,
        capacityStatus: 'under',
        reasons: [],
      },
    ],
    suggestion: {
      title: 'Start with overdue cards',
      description: 'Clear overdue review cards first.',
      actionLabel: 'Go to today',
      actionHref: '/today',
    },
  };
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
