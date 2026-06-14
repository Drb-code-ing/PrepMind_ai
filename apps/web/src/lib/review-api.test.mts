import assert from 'node:assert/strict';

import { createApiClient } from './api-client.ts';
import { createReviewApi } from './review-api.ts';

async function run() {
  await testCreatesReviewCardFromWrongQuestion();
  await testReadsCardByWrongQuestion();
  await testReadsTodayTasksWithDate();
  await testSubmitsRating();
  await testReadsReviewStats();
  await testReadsReviewLogs();
}

async function testCreatesReviewCardFromWrongQuestion() {
  const requests: CapturedRequest[] = [];
  const reviewApi = createReviewApi(createTestClient(requests, createCardResponse()));

  const result = await reviewApi.createFromWrongQuestion('token_1', 'wrong_1');

  assert.equal(requests[0].input, 'http://localhost:3001/reviews/cards/from-wrong-question');
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].authorization, 'Bearer token_1');
  assert.deepEqual(requests[0].body, { wrongQuestionId: 'wrong_1' });
  assert.equal(result.created, true);
}

async function testReadsCardByWrongQuestion() {
  const requests: CapturedRequest[] = [];
  const reviewApi = createReviewApi(createTestClient(requests, { card: null }));

  const result = await reviewApi.getByWrongQuestion('token_1', 'wrong_1');

  assert.equal(
    requests[0].input,
    'http://localhost:3001/reviews/cards/by-wrong-question/wrong_1',
  );
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].authorization, 'Bearer token_1');
  assert.deepEqual(result, { card: null });
}

async function testReadsTodayTasksWithDate() {
  const requests: CapturedRequest[] = [];
  const reviewApi = createReviewApi(
    createTestClient(requests, {
      date: '2026-06-14',
      dueCount: 0,
      newCount: 0,
      learningCount: 0,
      reviewCount: 0,
      tasks: [],
    }),
  );

  const result = await reviewApi.getTodayTasks('token_1', '2026-06-14');

  assert.equal(
    requests[0].input,
    'http://localhost:3001/reviews/tasks/today?date=2026-06-14',
  );
  assert.equal(result.date, '2026-06-14');
}

async function testSubmitsRating() {
  const requests: CapturedRequest[] = [];
  const reviewApi = createReviewApi(
    createTestClient(requests, {
      card: createCardResponse().card,
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
    }),
  );

  const result = await reviewApi.submitRating('token_1', 'card_1', {
    rating: 3,
    reviewedAt: '2026-06-14T08:00:00.000Z',
    reviewDurationMs: 12000,
  });

  assert.equal(requests[0].input, 'http://localhost:3001/reviews/cards/card_1/rating');
  assert.equal(requests[0].method, 'POST');
  assert.deepEqual(requests[0].body, {
    rating: 3,
    reviewedAt: '2026-06-14T08:00:00.000Z',
    reviewDurationMs: 12000,
  });
  assert.equal(result.log.rating, 3);
}

async function testReadsReviewStats() {
  const requests: CapturedRequest[] = [];
  const reviewApi = createReviewApi(
    createTestClient(requests, {
      range: '7d',
      fromDate: '2026-06-08',
      toDate: '2026-06-14',
      totalReviews: 1,
      reviewedCards: 1,
      dueCards: 0,
      accuracyLikeRate: 1,
      streakDays: 1,
      ratingCounts: { again: 0, hard: 0, good: 1, easy: 0 },
      stateCounts: { NEW: 0, LEARNING: 0, REVIEW: 1, RELEARNING: 0 },
      dailyReviews: [
        { date: '2026-06-08', count: 0 },
        { date: '2026-06-09', count: 0 },
        { date: '2026-06-10', count: 0 },
        { date: '2026-06-11', count: 0 },
        { date: '2026-06-12', count: 0 },
        { date: '2026-06-13', count: 0 },
        { date: '2026-06-14', count: 1 },
      ],
    }),
  );

  const result = await reviewApi.getStats('token_1', {
    range: '7d',
    endDate: '2026-06-14',
    timezoneOffsetMinutes: -480,
  });

  assert.equal(
    requests[0].input,
    'http://localhost:3001/reviews/stats?range=7d&endDate=2026-06-14&timezoneOffsetMinutes=-480',
  );
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].authorization, 'Bearer token_1');
  assert.equal(result.totalReviews, 1);
}

async function testReadsReviewLogs() {
  const requests: CapturedRequest[] = [];
  const reviewApi = createReviewApi(
    createTestClient(requests, {
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
            questionText: 'Compute 2 + 2.',
            subject: '数学',
            knowledgePoints: ['加法'],
            status: 'UNRESOLVED',
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  );

  const result = await reviewApi.getLogs('token_1', { page: 1, pageSize: 20 });

  assert.equal(requests[0].input, 'http://localhost:3001/reviews/logs?page=1&pageSize=20');
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].authorization, 'Bearer token_1');
  assert.equal(result.items[0]?.wrongQuestion?.subject, '数学');
}

function createTestClient(requests: CapturedRequest[], data: unknown) {
  return createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (input, init) => {
      requests.push({
        input: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      return jsonResponse({
        success: true,
        data,
        requestId: 'req_1',
      });
    },
  });
}

function createCardResponse() {
  return {
    card: {
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
    },
    created: true,
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

type CapturedRequest = {
  input: string;
  method: string;
  authorization: string | null;
  body: unknown;
};

await run();
