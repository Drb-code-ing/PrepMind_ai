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
  });

  assert.equal(result.outcome, 'success');
  assert.deepEqual(calls, [{ id: 'wrong_1', patch: { userNote: 'saved later' } }]);
});

