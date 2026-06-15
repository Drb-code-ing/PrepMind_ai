import assert from 'node:assert/strict';
import test from 'node:test';

import { TERMINAL_RETRY_AT } from '../lib/mutation-queue.ts';
import type { MutationQueueItem, MutationStatus } from '../lib/db.ts';
import * as pendingRatingsModule from './use-review-task-pending-ratings.ts';

type PendingRatingsModule = typeof pendingRatingsModule & {
  collectPendingReviewTaskRatings?: (items: MutationQueueItem[]) => {
    pendingByTaskId: Record<
      string,
      {
        rating: 1 | 2 | 3 | 4;
        reviewedAt: string;
        clientMutationId: string;
      }
    >;
    pendingCount: number;
  };
};

const reviewedAt = '2026-06-14T08:00:00.000Z';

test('collects pending and retryable failed review task ratings', () => {
  const result = collectPendingReviewTaskRatings([
    createQueueItem({
      id: 'queue_pending',
      taskId: 'task_pending',
      rating: 3,
      status: 'pending',
    }),
    createQueueItem({
      id: 'queue_failed_retryable',
      taskId: 'task_failed_retryable',
      rating: 2,
      status: 'failed',
      nextRetryAt: '2026-06-14T09:10:00.000Z',
    }),
  ]);

  assert.equal(result.pendingCount, 2);
  assert.equal(result.pendingByTaskId.task_pending?.rating, 3);
  assert.equal(result.pendingByTaskId.task_failed_retryable?.rating, 2);
});

test('filters terminal review task ratings', () => {
  const result = collectPendingReviewTaskRatings([
    createQueueItem({
      id: 'queue_retryable',
      taskId: 'task_retryable',
      rating: 4,
      status: 'failed',
      nextRetryAt: '2026-06-14T09:10:00.000Z',
    }),
    createQueueItem({
      id: 'queue_terminal',
      taskId: 'task_terminal',
      rating: 1,
      status: 'failed',
      nextRetryAt: TERMINAL_RETRY_AT,
    }),
  ]);

  assert.equal(result.pendingCount, 1);
  assert.equal(result.pendingByTaskId.task_retryable?.rating, 4);
  assert.equal(result.pendingByTaskId.task_terminal, undefined);
});

test('skips invalid review task rating payloads', () => {
  const result = collectPendingReviewTaskRatings([
    {
      ...createQueueItem({
        id: 'queue_invalid',
        taskId: 'task_invalid',
        rating: 1,
      }),
      payload: {
        taskId: 'task_invalid',
        request: {
          rating: 5,
          reviewedAt,
          clientMutationId: '11111111-1111-4111-8111-111111111111',
        },
        taskSnapshot: createTaskSnapshot('task_invalid'),
      },
    },
    createQueueItem({
      id: 'queue_valid',
      taskId: 'task_valid',
      rating: 2,
    }),
  ]);

  assert.equal(result.pendingCount, 1);
  assert.equal(result.pendingByTaskId.task_invalid, undefined);
  assert.equal(result.pendingByTaskId.task_valid?.rating, 2);
});

function collectPendingReviewTaskRatings(items: MutationQueueItem[]) {
  const collect = (pendingRatingsModule as PendingRatingsModule).collectPendingReviewTaskRatings;
  assert.equal(typeof collect, 'function', 'collectPendingReviewTaskRatings should be exported');
  return collect(items);
}

function createQueueItem(input: {
  id: string;
  taskId: string;
  rating: 1 | 2 | 3 | 4;
  status?: MutationStatus;
  nextRetryAt?: string;
}): MutationQueueItem {
  return {
    id: input.id,
    userId: 'user_1',
    entity: 'reviewTask',
    operation: 'rating',
    entityId: input.taskId,
    dedupeKey: `user_1:reviewTask:${input.taskId}:rating`,
    payload: {
      taskId: input.taskId,
      request: {
        rating: input.rating,
        reviewedAt,
        clientMutationId: '11111111-1111-4111-8111-111111111111',
      },
      taskSnapshot: createTaskSnapshot(input.taskId),
    },
    status: input.status ?? 'pending',
    retryCount: 0,
    createdAt: '2026-06-14T08:00:00.000Z',
    updatedAt: '2026-06-14T08:00:00.000Z',
    nextRetryAt: input.nextRetryAt,
  };
}

function createTaskSnapshot(taskId: string) {
  return {
    id: taskId,
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
      subject: 'math',
      knowledgePoints: ['addition'],
      answer: '4',
      analysis: '2 + 2 = 4.',
      imageUrl: null,
      status: 'UNRESOLVED',
    },
  };
}
