import assert from 'node:assert/strict';
import test from 'node:test';

import { filterRecordsForUser, getScopedUserId } from './user-scope.ts';

test('filters records to the active user and hides unowned legacy records', () => {
  const records = [
    { id: 'message-a', userId: 'user-a' },
    { id: 'message-b', userId: 'user-b' },
    { id: 'legacy-message' },
  ];

  assert.deepEqual(
    filterRecordsForUser(records, 'user-a').map((record) => record.id),
    ['message-a'],
  );
  assert.deepEqual(filterRecordsForUser(records, null), []);
});

test('requires a logged-in user id before writing local business records', () => {
  assert.equal(getScopedUserId({ id: 'user-a' }), 'user-a');
  assert.throws(() => getScopedUserId(null), /登录状态/);
});
