import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getOperatorAuditActionLabel,
  getOperatorAuditStatusLabel,
  getOperatorAuditStatusTone,
  hasOperatorAuditFilters,
} from './operator-audit-view.ts';

test('operator audit labels explain requeue audit records', () => {
  assert.equal(getOperatorAuditActionLabel('OUTBOX_REQUEUE'), 'Outbox 重新入队');
  assert.equal(getOperatorAuditActionLabel('AUDIT_EXPORT_REQUEST'), '申请审计证据包');
  assert.equal(getOperatorAuditActionLabel('AUDIT_EXPORT_DOWNLOAD'), '下载审计证据包');
  assert.equal(getOperatorAuditStatusLabel('SUCCEEDED'), '成功');
  assert.equal(getOperatorAuditStatusLabel('FAILED'), '失败');
  assert.equal(getOperatorAuditStatusTone('SUCCEEDED'), 'success');
  assert.equal(getOperatorAuditStatusTone('FAILED'), 'danger');
});

test('operator audit detects active filters', () => {
  assert.equal(hasOperatorAuditFilters({}), false);
  assert.equal(hasOperatorAuditFilters({ targetId: '   ' }), false);
  assert.equal(hasOperatorAuditFilters({ action: 'OUTBOX_REQUEUE' }), true);
  assert.equal(hasOperatorAuditFilters({ targetId: 'evt_1' }), true);
});
