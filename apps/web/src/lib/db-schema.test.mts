import assert from 'node:assert/strict';
import test from 'node:test';

import { db } from './db.ts';

test('database exposes the local mutation queue table', () => {
  assert.ok(db.mutationQueue);
  assert.ok(db.tables.some((table) => table.name === 'mutationQueue'));
});

test('database v9 exposes the sanitized conversation state table and exact indexes', () => {
  const table = db.tables.find((candidate) => candidate.name === 'conversationStates');
  assert.ok(table);
  assert.equal(table.schema.primKey.src, 'id');
  assert.equal(table.schema.primKey.unique, true);
  assert.deepEqual(
    table.schema.indexes.map((index) => index.src),
    ['userId', '[userId+conversationId]', 'expiresAt', 'updatedAt'],
  );
});
