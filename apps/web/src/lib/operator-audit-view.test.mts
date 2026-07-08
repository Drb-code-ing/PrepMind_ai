import assert from 'node:assert/strict';

import {
  formatOperatorAuditDateTime,
  getOperatorAuditActionLabel,
  getOperatorAuditStatusLabel,
  getOperatorAuditStatusTone,
  hasOperatorAuditFilters,
} from './operator-audit-view.ts';

assert.equal(getOperatorAuditActionLabel('OUTBOX_REQUEUE'), 'Outbox 重新入队');
assert.equal(getOperatorAuditStatusLabel('SUCCEEDED'), '成功');
assert.equal(getOperatorAuditStatusLabel('FAILED'), '失败');
assert.equal(getOperatorAuditStatusTone('SUCCEEDED'), 'success');
assert.equal(getOperatorAuditStatusTone('FAILED'), 'danger');
assert.equal(formatOperatorAuditDateTime('2026-07-08T08:30:00.000Z').includes('2026'), true);
assert.equal(formatOperatorAuditDateTime('bad-date'), '时间未知');
assert.equal(hasOperatorAuditFilters({}), false);
assert.equal(hasOperatorAuditFilters({ targetId: '  ' }), false);
assert.equal(hasOperatorAuditFilters({ targetId: 'event_1' }), true);
assert.equal(hasOperatorAuditFilters({ status: 'FAILED' }), true);
