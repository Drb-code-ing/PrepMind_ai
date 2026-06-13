import assert from 'node:assert/strict';
import test from 'node:test';

import { db } from './db.ts';

test('database exposes the local mutation queue table', () => {
  assert.ok(db.mutationQueue);
  assert.ok(db.tables.some((table) => table.name === 'mutationQueue'));
});

