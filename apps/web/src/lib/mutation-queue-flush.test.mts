import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiClientError, apiClient } from './api-client.ts';
import { db, type MutationQueueItem } from './db.ts';
import {
  classifyMutationFlushError,
  flushMutationItem,
  flushMutationQueue,
} from './mutation-queue-flush.ts';
import { TERMINAL_RETRY_AT } from './mutation-queue.ts';

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

test('treats unsupported wrong question rating as terminal without deleting', async () => {
  let deleteCalls = 0;
  const item: MutationQueueItem = {
    ...baseItem,
    operation: 'rating',
    payload: { id: 'wrong_1' },
  };

  const result = await flushMutationItem(item, 'access-token', {
    wrongQuestions: {
      create: async () => {
        throw new Error('unexpected create');
      },
      update: async () => {
        throw new Error('unexpected update');
      },
      delete: async () => {
        deleteCalls += 1;
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

  assert.equal(result.outcome, 'terminal');
  if (result.outcome === 'terminal') {
    assert.equal(result.reason, 'UNSUPPORTED_WRONG_QUESTION_MUTATION');
  }
  assert.equal(deleteCalls, 0);
});

test('treats unsupported ocr record rating as terminal without deleting', async () => {
  let deleteCalls = 0;
  const item: MutationQueueItem = {
    ...baseItem,
    entity: 'ocrRecord',
    operation: 'rating',
    entityId: 'ocr_1',
    payload: { id: 'ocr_1' },
  };

  const result = await flushMutationItem(item, 'access-token', {
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
        deleteCalls += 1;
      },
    },
    reviewTasks: {
      submitRating: async () => {
        throw new Error('unexpected review task rating');
      },
    },
  });

  assert.equal(result.outcome, 'terminal');
  if (result.outcome === 'terminal') {
    assert.equal(result.reason, 'UNSUPPORTED_OCR_RECORD_MUTATION');
  }
  assert.equal(deleteCalls, 0);
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

test('flushes due review task rating and only removes the queue item locally', async () => {
  const item: MutationQueueItem = {
    ...reviewTaskRatingItem,
    id: 'queue_review_summary_1',
  };
  const queueItems = new Map<string, MutationQueueItem>([[item.id, { ...item }]]);
  const deletedIds: string[] = [];
  let localWrongQuestionWriteCount = 0;
  let localOcrWriteCount = 0;
  const originalMutationQueue = db.mutationQueue;
  const originalWrongQuestions = db.wrongQuestions;
  const originalOcrRecords = db.ocrRecords;
  const originalPost = apiClient.post;

  const taskSnapshot = (
    reviewTaskRatingItem.payload as {
      taskSnapshot: { card: unknown };
    }
  ).taskSnapshot;

  try {
    db.mutationQueue = {
      where: (field: keyof MutationQueueItem) => ({
        equals: (value: unknown) => ({
          toArray: async () =>
            Array.from(queueItems.values()).filter((queueItem) => queueItem[field] === value),
        }),
      }),
      update: async (id: string, patch: Partial<MutationQueueItem>) => {
        const existing = queueItems.get(id);
        if (existing) {
          queueItems.set(id, { ...existing, ...patch });
        }
        return 1;
      },
      delete: async (id: string) => {
        deletedIds.push(id);
        queueItems.delete(id);
      },
    } as unknown as typeof db.mutationQueue;
    db.wrongQuestions = {
      put: async () => {
        localWrongQuestionWriteCount += 1;
        throw new Error('unexpected wrong question write');
      },
      delete: async () => {
        localWrongQuestionWriteCount += 1;
        throw new Error('unexpected wrong question delete');
      },
    } as unknown as typeof db.wrongQuestions;
    db.ocrRecords = {
      put: async () => {
        localOcrWriteCount += 1;
        throw new Error('unexpected ocr write');
      },
      delete: async () => {
        localOcrWriteCount += 1;
        throw new Error('unexpected ocr delete');
      },
    } as unknown as typeof db.ocrRecords;
    apiClient.post = async () => ({
      task: {
        ...taskSnapshot,
        status: 'COMPLETED',
        reviewLogId: 'log_1',
        completedAt: '2026-06-14T08:00:00.000Z',
        updatedAt: '2026-06-14T08:00:00.000Z',
      },
      card: taskSnapshot.card,
      log: {
        id: 'log_1',
        cardId: 'card_1',
        rating: 3,
        clientMutationId: '11111111-1111-4111-8111-111111111111',
        scheduledDays: 0,
        elapsedDays: 0,
        reviewDurationMs: 12_000,
        stabilityBefore: 0,
        stabilityAfter: 1,
        difficultyBefore: 5,
        difficultyAfter: 4.8,
        reviewedAt: '2026-06-14T08:00:00.000Z',
      },
    });

    const summary = await flushMutationQueue({
      userId: 'user_1',
      accessToken: 'access-token',
      now: new Date('2026-06-14T08:01:00.000Z'),
    });

    assert.deepEqual(summary, {
      successCount: 1,
      retryCount: 0,
      terminalCount: 0,
      reviewRatingSuccessCount: 1,
    });
    assert.deepEqual(deletedIds, [item.id]);
    assert.equal(queueItems.has(item.id), false);
    assert.equal(localWrongQuestionWriteCount, 0);
    assert.equal(localOcrWriteCount, 0);
  } finally {
    db.mutationQueue = originalMutationQueue;
    db.wrongQuestions = originalWrongQuestions;
    db.ocrRecords = originalOcrRecords;
    apiClient.post = originalPost;
  }
});

test('marks terminal queue items with sentinel retry time and does not retry them', async () => {
  const item: MutationQueueItem = {
    ...baseItem,
    id: 'queue_terminal_1',
    operation: 'delete',
    entityId: 'wrong_terminal_1',
    payload: { id: 'wrong_terminal_1' },
  };
  const queueItems = new Map<string, MutationQueueItem>([[item.id, { ...item }]]);
  const apiDeleteCalls: string[] = [];
  const queueDeletedIds: string[] = [];
  const queueUpdates: Array<{ id: string; patch: Partial<MutationQueueItem> }> = [];
  const originalMutationQueue = db.mutationQueue;
  const originalDelete = apiClient.delete;

  try {
    db.mutationQueue = {
      where: (field: keyof MutationQueueItem) => ({
        equals: (value: unknown) => ({
          toArray: async () =>
            Array.from(queueItems.values()).filter((queueItem) => queueItem[field] === value),
        }),
      }),
      update: async (id: string, patch: Partial<MutationQueueItem>) => {
        queueUpdates.push({ id, patch });
        const existing = queueItems.get(id);
        if (existing) {
          queueItems.set(id, { ...existing, ...patch });
        }
        return 1;
      },
      delete: async (id: string) => {
        queueDeletedIds.push(id);
        queueItems.delete(id);
      },
    } as unknown as typeof db.mutationQueue;
    apiClient.delete = async (path: string) => {
      apiDeleteCalls.push(path);
      throw new ApiClientError('bad request', {
        status: 400,
        code: 'BAD_REQUEST',
      });
    };

    const firstSummary = await flushMutationQueue({
      userId: 'user_1',
      accessToken: 'access-token',
      now: new Date('2026-06-14T08:01:00.000Z'),
    });

    assert.deepEqual(firstSummary, {
      successCount: 0,
      retryCount: 0,
      terminalCount: 1,
      reviewRatingSuccessCount: 0,
    });
    assert.deepEqual(apiDeleteCalls, ['/wrong-questions/wrong_terminal_1']);
    assert.deepEqual(queueDeletedIds, []);

    const terminalItem = queueItems.get(item.id);
    assert.ok(terminalItem);
    assert.equal(terminalItem.status, 'failed');
    assert.equal(terminalItem.retryCount, 1);
    assert.equal(terminalItem.nextRetryAt, TERMINAL_RETRY_AT);

    const updateCountAfterTerminal = queueUpdates.length;
    const secondSummary = await flushMutationQueue({
      userId: 'user_1',
      accessToken: 'access-token',
      now: new Date('2026-06-14T08:02:00.000Z'),
    });

    assert.deepEqual(secondSummary, {
      successCount: 0,
      retryCount: 0,
      terminalCount: 0,
      reviewRatingSuccessCount: 0,
    });
    assert.deepEqual(apiDeleteCalls, ['/wrong-questions/wrong_terminal_1']);
    assert.deepEqual(queueDeletedIds, []);
    assert.equal(queueUpdates.length, updateCountAfterTerminal);
  } finally {
    db.mutationQueue = originalMutationQueue;
    apiClient.delete = originalDelete;
  }
});
