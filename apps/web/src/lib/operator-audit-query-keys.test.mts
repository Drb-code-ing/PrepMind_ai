import assert from 'node:assert/strict';

import { operatorAuditQueryKeys } from './operator-audit-query-keys.ts';

assert.deepEqual(operatorAuditQueryKeys.all, ['operator-audit-logs']);
assert.deepEqual(operatorAuditQueryKeys.user('admin_1'), ['operator-audit-logs', 'admin_1']);
assert.deepEqual(
  operatorAuditQueryKeys.list('admin_1', {
    action: 'OUTBOX_REQUEUE',
    status: 'FAILED',
    targetType: 'OUTBOX_EVENT',
    targetId: 'event_1',
    actorUserId: 'admin_1',
    limit: 50,
    cursor: 'cursor_1',
  }),
  [
    'operator-audit-logs',
    'admin_1',
    'list',
    {
      action: 'OUTBOX_REQUEUE',
      status: 'FAILED',
      targetType: 'OUTBOX_EVENT',
      targetId: 'event_1',
      actorUserId: 'admin_1',
      limit: 50,
      cursor: 'cursor_1',
    },
  ],
);
assert.deepEqual(operatorAuditQueryKeys.list('admin_1', {}), [
  'operator-audit-logs',
  'admin_1',
  'list',
  {
    action: undefined,
    status: undefined,
    targetType: undefined,
    targetId: undefined,
    actorUserId: undefined,
    limit: 20,
    cursor: undefined,
  },
]);
