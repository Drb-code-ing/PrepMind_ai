import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TERMINAL_RETRY_AT,
  createMutationQueueItem,
  enqueueMutationQueueItem,
  getNextRetryAt,
  mergeMutationQueueItems,
  shouldAttemptMutation,
} from './mutation-queue.ts';
import type { MutationQueueItem } from './db.ts';

test('creates a pending queue item with a stable dedupe key', () => {
  const item = createMutationQueueItem(
    {
      userId: 'user_1',
      entity: 'wrongQuestion',
      operation: 'update',
      entityId: 'wrong_1',
      payload: { patch: { userNote: 'keep this' } },
    },
    new Date('2026-06-13T00:00:00.000Z'),
  );

  assert.equal(item.status, 'pending');
  assert.equal(item.retryCount, 0);
  assert.equal(item.dedupeKey, 'user_1:wrongQuestion:wrong_1');
  assert.equal(item.createdAt, '2026-06-13T00:00:00.000Z');
});

test('merges repeated update operations by keeping the latest patch', () => {
  const first = createMutationQueueItem(
    {
      userId: 'user_1',
      entity: 'wrongQuestion',
      operation: 'update',
      entityId: 'wrong_1',
      payload: { patch: { status: 'resolved' } },
    },
    new Date('2026-06-13T00:00:00.000Z'),
  );
  const second = createMutationQueueItem(
    {
      userId: 'user_1',
      entity: 'wrongQuestion',
      operation: 'update',
      entityId: 'wrong_1',
      payload: { patch: { userNote: 'final note' } },
    },
    new Date('2026-06-13T00:00:01.000Z'),
  );

  const merged = mergeMutationQueueItems(first, second);

  assert.ok(merged);
  assert.equal(merged.operation, 'update');
  assert.deepEqual(merged.payload, {
    patch: { status: 'resolved', userNote: 'final note' },
  });
  assert.equal(merged.updatedAt, '2026-06-13T00:00:01.000Z');
});

test('drops a local-only create when it is deleted before syncing', () => {
  const create = createMutationQueueItem({
    userId: 'user_1',
    entity: 'wrongQuestion',
    operation: 'create',
    entityId: 'local_1',
    payload: { record: { id: 'local_1' } },
  });
  const remove = createMutationQueueItem({
    userId: 'user_1',
    entity: 'wrongQuestion',
    operation: 'delete',
    entityId: 'local_1',
    payload: { id: 'local_1' },
  });

  assert.equal(mergeMutationQueueItems(create, remove), null);
});

test('collapses update followed by delete into delete', () => {
  const update = createMutationQueueItem({
    userId: 'user_1',
    entity: 'ocrRecord',
    operation: 'update',
    entityId: 'ocr_1',
    payload: { patch: { syncStatus: 'failed' } },
  });
  const remove = createMutationQueueItem({
    userId: 'user_1',
    entity: 'ocrRecord',
    operation: 'delete',
    entityId: 'ocr_1',
    payload: { id: 'ocr_1' },
  });

  const merged = mergeMutationQueueItems(update, remove);

  assert.ok(merged);
  assert.equal(merged.operation, 'delete');
  assert.deepEqual(merged.payload, { id: 'ocr_1' });
});

test('calculates bounded retry backoff', () => {
  const now = new Date('2026-06-13T00:00:00.000Z');

  assert.equal(getNextRetryAt(0, now), '2026-06-13T00:00:10.000Z');
  assert.equal(getNextRetryAt(1, now), '2026-06-13T00:00:30.000Z');
  assert.equal(getNextRetryAt(2, now), '2026-06-13T00:02:00.000Z');
  assert.equal(getNextRetryAt(3, now), undefined);
});

test('skips future retry items and allows due items', () => {
  const now = new Date('2026-06-13T00:00:00.000Z');
  const item = createMutationQueueItem({
    userId: 'user_1',
    entity: 'wrongQuestion',
    operation: 'update',
    entityId: 'wrong_1',
    payload: { patch: {} },
  });

  assert.equal(
    shouldAttemptMutation({ ...item, nextRetryAt: '2026-06-13T00:00:01.000Z' }, now),
    false,
  );
  assert.equal(
    shouldAttemptMutation({ ...item, nextRetryAt: '2026-06-12T23:59:59.000Z' }, now),
    true,
  );
});

test('skips terminal retry sentinel items', () => {
  const now = new Date('2026-06-13T00:00:00.000Z');
  const item = createMutationQueueItem({
    userId: 'user_1',
    entity: 'wrongQuestion',
    operation: 'delete',
    entityId: 'wrong_1',
    payload: { id: 'wrong_1' },
  });

  assert.equal(shouldAttemptMutation({ ...item, nextRetryAt: TERMINAL_RETRY_AT }, now), false);
});

test('enqueue merges with an existing item through a provided store', async () => {
  const writes: MutationQueueItem[] = [];
  const existing = createMutationQueueItem({
    userId: 'user_1',
    entity: 'wrongQuestion',
    operation: 'update',
    entityId: 'wrong_1',
    payload: { patch: { status: 'resolved' } },
  });
  const incoming = createMutationQueueItem({
    userId: 'user_1',
    entity: 'wrongQuestion',
    operation: 'update',
    entityId: 'wrong_1',
    payload: { patch: { userNote: 'queued note' } },
  });

  const result = await enqueueMutationQueueItem(incoming, {
    findByDedupeKey: async () => existing,
    put: async (item) => {
      writes.push(item);
    },
    delete: async () => {
      throw new Error('unexpected delete');
    },
  });

  assert.ok(result);
  assert.equal(result.id, existing.id);
  assert.deepEqual(result.payload, {
    patch: { status: 'resolved', userNote: 'queued note' },
  });
  assert.deepEqual(writes, [result]);
});

test('enqueue removes an unsynced local create when delete is queued', async () => {
  const deletedIds: string[] = [];
  const existing = createMutationQueueItem({
    userId: 'user_1',
    entity: 'wrongQuestion',
    operation: 'create',
    entityId: 'wrong_local',
    payload: { record: { id: 'wrong_local' } },
  });
  const incoming = createMutationQueueItem({
    userId: 'user_1',
    entity: 'wrongQuestion',
    operation: 'delete',
    entityId: 'wrong_local',
    payload: { id: 'wrong_local' },
  });

  const result = await enqueueMutationQueueItem(incoming, {
    findByDedupeKey: async () => existing,
    put: async () => {
      throw new Error('unexpected put');
    },
    delete: async (id) => {
      deletedIds.push(id);
    },
  });

  assert.equal(result, null);
  assert.deepEqual(deletedIds, [existing.id]);
});
