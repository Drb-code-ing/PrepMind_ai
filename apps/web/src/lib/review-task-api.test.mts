import assert from 'node:assert/strict';

import { createApiClient } from './api-client.ts';
import { createReviewTaskApi } from './review-task-api.ts';

async function run() {
  await testReadsTodayTasks();
  await testListsTasks();
  await testSubmitsRating();
  await testSkipsAndReopensTask();
}

async function testReadsTodayTasks() {
  const requests: CapturedRequest[] = [];
  const reviewTaskApi = createReviewTaskApi(
    createTestClient(requests, {
      date: '2026-06-14',
      pendingCount: 1,
      completedCount: 0,
      skippedCount: 0,
      tasks: [createTaskPayload()],
    }),
  );

  const result = await reviewTaskApi.getToday('token_1', {
    date: '2026-06-14',
    timezoneOffsetMinutes: -480,
    includeCompleted: false,
  });

  assert.equal(
    requests[0].input,
    'http://localhost:3001/review-tasks/today?date=2026-06-14&timezoneOffsetMinutes=-480&includeCompleted=false',
  );
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].authorization, 'Bearer token_1');
  assert.equal(result.pendingCount, 1);
}

async function testListsTasks() {
  const requests: CapturedRequest[] = [];
  const reviewTaskApi = createReviewTaskApi(
    createTestClient(requests, {
      items: [createTaskPayload({ status: 'SKIPPED' })],
      total: 1,
      page: 2,
      pageSize: 10,
    }),
  );

  const result = await reviewTaskApi.list('token_1', {
    page: 2,
    pageSize: 10,
    date: '2026-06-14',
    status: 'SKIPPED',
  });

  assert.equal(
    requests[0].input,
    'http://localhost:3001/review-tasks?page=2&pageSize=10&date=2026-06-14&status=SKIPPED',
  );
  assert.equal(result.items[0]?.status, 'SKIPPED');
}

async function testSubmitsRating() {
  const requests: CapturedRequest[] = [];
  const reviewTaskApi = createReviewTaskApi(
    createTestClient(requests, {
      task: createTaskPayload({ status: 'COMPLETED', reviewLogId: 'log_1' }),
      card: createCardPayload({ state: 'REVIEW' }),
      log: createLogPayload(),
    }),
  );

  const result = await reviewTaskApi.submitRating('token_1', 'task_1', {
    rating: 3,
    reviewedAt: '2026-06-14T08:00:00.000Z',
    reviewDurationMs: 12000,
  });

  assert.equal(requests[0].input, 'http://localhost:3001/review-tasks/task_1/rating');
  assert.equal(requests[0].method, 'POST');
  assert.deepEqual(requests[0].body, {
    rating: 3,
    reviewedAt: '2026-06-14T08:00:00.000Z',
    reviewDurationMs: 12000,
  });
  assert.equal(result.task.status, 'COMPLETED');
  assert.equal(result.log.rating, 3);
}

async function testSkipsAndReopensTask() {
  const skipRequests: CapturedRequest[] = [];
  const skipApi = createReviewTaskApi(
    createTestClient(skipRequests, {
      task: createTaskPayload({ status: 'SKIPPED' }),
    }),
  );

  const skipped = await skipApi.skip('token_1', 'task_1');
  assert.equal(skipRequests[0].input, 'http://localhost:3001/review-tasks/task_1/skip');
  assert.equal(skipRequests[0].method, 'POST');
  assert.equal(skipped.task.status, 'SKIPPED');

  const reopenRequests: CapturedRequest[] = [];
  const reopenApi = createReviewTaskApi(
    createTestClient(reopenRequests, {
      task: createTaskPayload({ status: 'PENDING' }),
    }),
  );

  const reopened = await reopenApi.reopen('token_1', 'task_1');
  assert.equal(
    reopenRequests[0].input,
    'http://localhost:3001/review-tasks/task_1/reopen',
  );
  assert.equal(reopened.task.status, 'PENDING');
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

function createLogPayload() {
  return {
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
