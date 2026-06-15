import assert from 'node:assert/strict';
import test from 'node:test';

import type { ReviewTaskItemResponse } from '@repo/types/api/review-task';

import { ApiClientError } from './api-client.ts';
import type { MutationQueueItem } from './db.ts';
import { mergeMutationQueueItems } from './mutation-queue.ts';
import {
  createReviewTaskRatingQueueItem,
  isRetryableReviewTaskRatingError,
  readReviewTaskRatingPayload,
} from './review-task-offline.ts';

const reviewedAt = '2026-06-14T08:00:00.000Z';
const clientMutationId = '11111111-1111-4111-8111-111111111111';

test('creates a review task rating queue item with stable dedupe and payload', () => {
  const task = createTaskPayload();
  const request = {
    rating: 3 as const,
    reviewedAt,
    reviewDurationMs: 12_000,
    clientMutationId,
  };

  const item = createReviewTaskRatingQueueItem({
    userId: 'user_1',
    task,
    request,
    now: new Date('2026-06-14T09:00:00.000Z'),
  });

  assert.equal(item.entity, 'reviewTask');
  assert.equal(item.operation, 'rating');
  assert.equal(item.entityId, 'task_1');
  assert.equal(item.dedupeKey, 'user_1:reviewTask:task_1:rating');
  assert.equal(item.status, 'pending');
  assert.equal(item.retryCount, 0);
  assert.equal(item.createdAt, '2026-06-14T09:00:00.000Z');
  assert.deepEqual(item.payload, {
    taskId: 'task_1',
    request,
    taskSnapshot: task,
  });
});

test('reads and rejects review task rating payloads at runtime', () => {
  const payload = {
    taskId: 'task_1',
    request: {
      rating: 4,
      reviewedAt,
      clientMutationId,
    },
    taskSnapshot: createTaskPayload(),
  };

  assert.deepEqual(readReviewTaskRatingPayload(payload), payload);
  assert.throws(
    () =>
      readReviewTaskRatingPayload({
        ...payload,
        request: { ...payload.request, clientMutationId: undefined },
      }),
    /Invalid review task rating payload/,
  );
  assert.throws(
    () =>
      readReviewTaskRatingPayload({
        ...payload,
        request: { ...payload.request, rating: 5 },
      }),
    /Invalid review task rating payload/,
  );
});

test('rejects review task rating payload with invalid client mutation id', () => {
  assert.throws(
    () =>
      readReviewTaskRatingPayload({
        taskId: 'task_1',
        request: {
          rating: 4,
          reviewedAt,
          clientMutationId: 'not-a-uuid',
        },
        taskSnapshot: createTaskPayload(),
      }),
    /Invalid review task rating payload/,
  );
});

test('rejects review task rating payload with invalid reviewed at datetime', () => {
  assert.throws(
    () =>
      readReviewTaskRatingPayload({
        taskId: 'task_1',
        request: {
          rating: 4,
          reviewedAt: 'not-a-date',
          clientMutationId,
        },
        taskSnapshot: createTaskPayload(),
      }),
    /Invalid review task rating payload/,
  );
});

test('classifies review task rating retryability', () => {
  assert.equal(
    isRetryableReviewTaskRatingError(
      new ApiClientError('network', { status: 0, code: 'NETWORK_ERROR' }),
    ),
    true,
  );
  assert.equal(
    isRetryableReviewTaskRatingError(
      new ApiClientError('server', { status: 503, code: 'SERVICE_UNAVAILABLE' }),
    ),
    true,
  );
  assert.equal(isRetryableReviewTaskRatingError(new Error('plain failure')), true);
  assert.equal(
    isRetryableReviewTaskRatingError(
      new ApiClientError('unauthorized', { status: 401, code: 'AUTH_UNAUTHORIZED' }),
    ),
    false,
  );
  assert.equal(
    isRetryableReviewTaskRatingError(
      new ApiClientError('bad request', { status: 400, code: 'BAD_REQUEST' }),
    ),
    false,
  );
});

test('merges repeated review task ratings by keeping the incoming request', () => {
  const task = createTaskPayload();
  const existing = {
    ...createReviewTaskRatingQueueItem({
      userId: 'user_1',
      task,
      request: {
        rating: 2,
        reviewedAt,
        clientMutationId: '22222222-2222-4222-8222-222222222222',
      },
      now: new Date('2026-06-14T09:00:00.000Z'),
    }),
    status: 'failed',
    retryCount: 2,
    lastError: 'network',
    nextRetryAt: '2026-06-14T09:10:00.000Z',
  } satisfies MutationQueueItem;
  const incoming = createReviewTaskRatingQueueItem({
    userId: 'user_1',
    task,
    request: {
      rating: 4,
      reviewedAt: '2026-06-14T09:05:00.000Z',
      reviewDurationMs: 18_000,
      clientMutationId: '33333333-3333-4333-8333-333333333333',
    },
    now: new Date('2026-06-14T09:05:00.000Z'),
  });

  const merged = mergeMutationQueueItems(existing, incoming);

  assert.ok(merged);
  assert.equal(merged.id, existing.id);
  assert.equal(merged.createdAt, existing.createdAt);
  assert.equal(merged.updatedAt, incoming.updatedAt);
  assert.equal(merged.status, 'pending');
  assert.equal(merged.retryCount, 0);
  assert.equal(merged.lastError, undefined);
  assert.equal(merged.nextRetryAt, undefined);
  assert.deepEqual(merged.payload, incoming.payload);
});

function createTaskPayload(input: Partial<ReviewTaskItemResponse> = {}): ReviewTaskItemResponse {
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
