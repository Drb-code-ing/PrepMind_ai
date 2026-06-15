import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiClientError } from './api-client.ts';
import type { MutationQueueItem } from './db.ts';
import {
  classifyMutationFlushError,
  flushMutationItem,
} from './mutation-queue-flush.ts';

const baseItem: MutationQueueItem = {
  id: 'queue_1',
  userId: 'user_1',
  entity: 'wrongQuestion',
  operation: 'delete',
  entityId: 'wrong_1',
  dedupeKey: 'user_1:wrongQuestion:wrong_1',
  payload: { id: 'wrong_1' },
  status: 'pending',
  retryCount: 0,
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
};

const reviewTaskRatingItem: MutationQueueItem = {
  id: 'queue_review_1',
  userId: 'user_1',
  entity: 'reviewTask',
  operation: 'rating',
  entityId: 'task_1',
  dedupeKey: 'user_1:reviewTask:task_1:rating',
  payload: {
    taskId: 'task_1',
    request: {
      rating: 3,
      reviewedAt: '2026-06-14T08:00:00.000Z',
      reviewDurationMs: 12_000,
      clientMutationId: '11111111-1111-4111-8111-111111111111',
    },
    taskSnapshot: {
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
    },
  },
  status: 'pending',
  retryCount: 0,
  createdAt: '2026-06-14T08:00:00.000Z',
  updatedAt: '2026-06-14T08:00:00.000Z',
};

test('treats delete 404 as success', () => {
  const error = new ApiClientError('not found', {
    status: 404,
    code: 'WRONG_QUESTION_NOT_FOUND',
  });

  assert.deepEqual(classifyMutationFlushError(baseItem, error), {
    outcome: 'success',
  });
});

test('treats duplicated wrong question create as success', () => {
  const item: MutationQueueItem = {
    ...baseItem,
    operation: 'create',
    payload: { record: { id: 'wrong_1' } },
  };
  const error = new ApiClientError('duplicated', {
    status: 409,
    code: 'WRONG_QUESTION_DUPLICATED',
  });

  assert.deepEqual(classifyMutationFlushError(item, error), {
    outcome: 'success',
  });
});

test('does not retry auth failures', () => {
  const error = new ApiClientError('unauthorized', {
    status: 401,
    code: 'AUTH_UNAUTHORIZED',
  });

  assert.deepEqual(classifyMutationFlushError(baseItem, error), {
    outcome: 'terminal',
    reason: 'unauthorized',
  });
});

test('retries network and server failures', () => {
  assert.equal(
    classifyMutationFlushError(
      baseItem,
      new ApiClientError('network', { status: 0, code: 'NETWORK_ERROR' }),
    ).outcome,
    'retry',
  );
  assert.equal(
    classifyMutationFlushError(
      baseItem,
      new ApiClientError('server', { status: 503, code: 'SERVICE_UNAVAILABLE' }),
    ).outcome,
    'retry',
  );
});

test('classifies review task rating network and auth failures', () => {
  assert.equal(
    classifyMutationFlushError(
      reviewTaskRatingItem,
      new ApiClientError('network', { status: 0, code: 'NETWORK_ERROR' }),
    ).outcome,
    'retry',
  );
  assert.equal(
    classifyMutationFlushError(
      reviewTaskRatingItem,
      new ApiClientError('server', { status: 500, code: 'SERVER_ERROR' }),
    ).outcome,
    'retry',
  );
  assert.deepEqual(
    classifyMutationFlushError(
      reviewTaskRatingItem,
      new ApiClientError('unauthorized', { status: 401, code: 'AUTH_UNAUTHORIZED' }),
    ),
    {
      outcome: 'terminal',
      reason: 'unauthorized',
    },
  );
});

test('flushes wrong question update through provided API', async () => {
  const calls: unknown[] = [];
  const item: MutationQueueItem = {
    ...baseItem,
    operation: 'update',
    payload: { patch: { userNote: 'saved later' } },
  };

  const result = await flushMutationItem(item, 'access-token', {
    wrongQuestions: {
      create: async () => {
        throw new Error('unexpected create');
      },
      update: async (_token, id, patch) => {
        calls.push({ id, patch });
        return { id, userNote: 'saved later' };
      },
      delete: async () => {
        throw new Error('unexpected delete');
      },
    },
    ocrRecords: {
      create: async () => {
        throw new Error('unexpected ocr create');
      },
      delete: async () => {
        throw new Error('unexpected ocr delete');
      },
    },
    reviewTasks: {
      submitRating: async () => {
        throw new Error('unexpected review task rating');
      },
    },
  });

  assert.equal(result.outcome, 'success');
  assert.deepEqual(calls, [{ id: 'wrong_1', patch: { userNote: 'saved later' } }]);
});

test('flushes review task rating through provided API', async () => {
  const calls: unknown[] = [];

  const result = await flushMutationItem(reviewTaskRatingItem, 'access-token', {
    wrongQuestions: {
      create: async () => {
        throw new Error('unexpected wrong question create');
      },
      update: async () => {
        throw new Error('unexpected wrong question update');
      },
      delete: async () => {
        throw new Error('unexpected wrong question delete');
      },
    },
    ocrRecords: {
      create: async () => {
        throw new Error('unexpected ocr create');
      },
      delete: async () => {
        throw new Error('unexpected ocr delete');
      },
    },
    reviewTasks: {
      submitRating: async (token, taskId, request) => {
        calls.push({ token, taskId, request });
        return { ok: true };
      },
    },
  });

  assert.equal(result.outcome, 'success');
  assert.deepEqual(calls, [
    {
      token: 'access-token',
      taskId: 'task_1',
      request: {
        rating: 3,
        reviewedAt: '2026-06-14T08:00:00.000Z',
        reviewDurationMs: 12_000,
        clientMutationId: '11111111-1111-4111-8111-111111111111',
      },
    },
  ]);
});
