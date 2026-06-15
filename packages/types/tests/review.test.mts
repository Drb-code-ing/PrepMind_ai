import assert from 'node:assert/strict';

import {
  createReviewCardFromWrongQuestionRequestSchema,
  reviewLogSchema,
  reviewLogListResponseSchema,
  reviewRatingRequestSchema,
  reviewStatsQuerySchema,
  reviewStatsResponseSchema,
  reviewTodayTasksResponseSchema,
} from '../src/api/review.ts';

function run() {
  testCreateCardRequest();
  testRatingRequest();
  testRatingRequestWithClientMutationId();
  testRatingRequestRejectsInvalidClientMutationId();
  testReviewLogWithNullClientMutationId();
  testReviewLogWithOmittedClientMutationId();
  testTodayTasksResponse();
  testStatsQuery();
  testStatsResponse();
  testReviewLogListResponse();
}

function testCreateCardRequest() {
  const result = createReviewCardFromWrongQuestionRequestSchema.parse({
    wrongQuestionId: 'wrong_1',
  });

  assert.equal(result.wrongQuestionId, 'wrong_1');
}

function testRatingRequest() {
  const result = reviewRatingRequestSchema.parse({
    rating: 4,
    reviewedAt: '2026-06-14T08:00:00.000Z',
    reviewDurationMs: 12000,
  });

  assert.equal(result.rating, 4);
  assert.equal(result.clientMutationId, undefined);
}

function testRatingRequestWithClientMutationId() {
  const result = reviewRatingRequestSchema.parse({
    rating: 4,
    reviewedAt: '2026-06-14T08:00:00.000Z',
    reviewDurationMs: 12000,
    clientMutationId: '550e8400-e29b-41d4-a716-446655440000',
  });

  assert.equal(result.clientMutationId, '550e8400-e29b-41d4-a716-446655440000');
}

function testRatingRequestRejectsInvalidClientMutationId() {
  assert.throws(() =>
    reviewRatingRequestSchema.parse({
      rating: 4,
      clientMutationId: 'not-a-uuid',
    }),
  );
}

function testReviewLogWithNullClientMutationId() {
  const result = reviewLogSchema.parse(createReviewLogPayload({ clientMutationId: null }));

  assert.equal(result.clientMutationId, null);
}

function testReviewLogWithOmittedClientMutationId() {
  const payload = createReviewLogPayload();
  delete payload.clientMutationId;

  const result = reviewLogSchema.parse(payload);

  assert.equal(result.clientMutationId, null);
}

function testTodayTasksResponse() {
  const result = reviewTodayTasksResponseSchema.parse({
    date: '2026-06-14',
    dueCount: 1,
    newCount: 1,
    learningCount: 0,
    reviewCount: 0,
    tasks: [
      {
        cardId: 'card_1',
        dueAt: '2026-06-14T08:00:00.000Z',
        state: 'NEW',
        reviewCount: 0,
        lapses: 0,
        source: 'wrongQuestion',
        wrongQuestion: {
          id: 'wrong_1',
          questionText: 'Compute 2x + 5 = 13.',
          subject: '数学',
          knowledgePoints: ['一元一次方程'],
          answer: 'x = 4',
          analysis: 'Move 5 then divide by 2.',
          imageUrl: null,
          status: 'UNRESOLVED',
        },
      },
    ],
  });

  assert.equal(result.tasks[0]?.source, 'wrongQuestion');
  assert.equal(result.tasks[0]?.wrongQuestion?.status, 'UNRESOLVED');
}

function testStatsQuery() {
  const result = reviewStatsQuerySchema.parse({
    range: '30d',
    endDate: '2026-06-14',
    timezoneOffsetMinutes: -480,
  });

  assert.equal(result.range, '30d');
  assert.equal(result.endDate, '2026-06-14');
  assert.equal(result.timezoneOffsetMinutes, -480);
  assert.throws(() => reviewStatsQuerySchema.parse({ range: '90d' }));
}

function testStatsResponse() {
  const result = reviewStatsResponseSchema.parse({
    range: '7d',
    fromDate: '2026-06-08',
    toDate: '2026-06-14',
    totalReviews: 3,
    reviewedCards: 2,
    dueCards: 1,
    accuracyLikeRate: 0.67,
    streakDays: 2,
    ratingCounts: {
      again: 1,
      hard: 0,
      good: 1,
      easy: 1,
    },
    stateCounts: {
      NEW: 1,
      LEARNING: 0,
      REVIEW: 2,
      RELEARNING: 0,
    },
    dailyReviews: [
      { date: '2026-06-08', count: 0 },
      { date: '2026-06-09', count: 0 },
      { date: '2026-06-10', count: 0 },
      { date: '2026-06-11', count: 0 },
      { date: '2026-06-12', count: 1 },
      { date: '2026-06-13', count: 1 },
      { date: '2026-06-14', count: 1 },
    ],
  });

  assert.equal(result.ratingCounts.good, 1);
  assert.equal(result.stateCounts.REVIEW, 2);
}

function testReviewLogListResponse() {
  const result = reviewLogListResponseSchema.parse({
    items: [
      {
        id: 'log_1',
        cardId: 'card_1',
        rating: 3,
        scheduledDays: 1,
        elapsedDays: 0,
        reviewDurationMs: 12000,
        reviewedAt: '2026-06-14T08:00:00.000Z',
        nextReview: '2026-06-15T08:00:00.000Z',
        currentCardState: 'REVIEW',
        wrongQuestion: {
          id: 'wrong_1',
          questionText: 'Compute 2x + 5 = 13.',
          subject: '数学',
          knowledgePoints: ['一元一次方程'],
          status: 'UNRESOLVED',
        },
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
  });

  assert.equal(result.items[0]?.wrongQuestion?.subject, '数学');
  assert.equal(result.items[0]?.currentCardState, 'REVIEW');
}

function createReviewLogPayload(input: Partial<Record<string, unknown>> = {}) {
  return {
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
    ...input,
  };
}

run();
