import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getOutboxAftercare,
  getOutboxErrorGuidance,
  getOutboxReadOnlyReason,
  getOutboxStatusTone,
  isOutboxEventRequeueable,
  normalizeOutboxReason,
} from './outbox-view.ts';

test('only failed and dead outbox events are requeueable', () => {
  assert.equal(isOutboxEventRequeueable('FAILED'), true);
  assert.equal(isOutboxEventRequeueable('DEAD'), true);
  assert.equal(isOutboxEventRequeueable('PENDING'), false);
  assert.equal(isOutboxEventRequeueable('PROCESSING'), false);
  assert.equal(isOutboxEventRequeueable('SUCCEEDED'), false);
});

test('unknown handler errors warn operators to fix code before requeue', () => {
  const guidance = getOutboxErrorGuidance({
    lastErrorCode: 'OUTBOX_HANDLER_NOT_FOUND',
    lastErrorPreview: 'No outbox handler registered for event type legacy.created',
  });

  assert.equal(guidance.tone, 'danger');
  assert.match(guidance.message, /先修复代码/);
  assert.match(guidance.message, /不要盲目重新入队/);
});

test('invalid payload errors warn operators to fix producer data before requeue', () => {
  const guidance = getOutboxErrorGuidance({
    lastErrorCode: 'OUTBOX_INVALID_PAYLOAD',
    lastErrorPreview: 'Outbox event payload documentId must be a non-empty string',
  });

  assert.equal(guidance.tone, 'danger');
  assert.match(guidance.message, /payload|数据|契约/);
  assert.match(guidance.message, /先修复/);
});

test('transient dependency errors allow requeue after dependency recovery', () => {
  const guidance = getOutboxErrorGuidance({
    lastErrorCode: 'REDIS_TIMEOUT',
    lastErrorPreview: 'Redis connection timeout while dispatching outbox batch',
  });

  assert.equal(guidance.tone, 'warning');
  assert.match(guidance.message, /依赖|Redis|超时/);
  assert.match(guidance.message, /恢复/);
});

test('unknown errors ask operators to inspect logs and readiness before requeue', () => {
  const guidance = getOutboxErrorGuidance({
    lastErrorCode: null,
    lastErrorPreview: 'Unexpected dispatch failure',
  });

  assert.equal(guidance.tone, 'warning');
  assert.match(guidance.message, /日志|readiness|Worker/i);
});

test('read-only status explains why requeue is unavailable', () => {
  assert.match(getOutboxReadOnlyReason('PENDING'), /等待 worker/);
  assert.match(getOutboxReadOnlyReason('PROCESSING'), /正在处理/);
  assert.match(getOutboxReadOnlyReason('SUCCEEDED'), /已经成功/);
  assert.equal(getOutboxReadOnlyReason('FAILED'), null);
  assert.equal(getOutboxReadOnlyReason('DEAD'), null);
});

test('aftercare explains requeue state-machine behavior and follow-up pages', () => {
  const aftercare = getOutboxAftercare({
    eventId: 'evt_123',
    status: 'PENDING',
    requeued: true,
  });

  assert.match(aftercare.title, /已重新入队/);
  assert.match(aftercare.message, /PENDING/);
  assert.match(aftercare.message, /不会立刻执行 handler/);
  assert.doesNotMatch(aftercare.message, /强制成功|force success/i);
  assert.equal(aftercare.links.worker.href, '/worker');
  assert.equal(aftercare.links.audit.href, '/audit');

  const defaultAftercare = getOutboxAftercare({
    eventId: 'evt_123',
    status: 'FAILED',
    requeued: false,
  });

  assert.doesNotMatch(defaultAftercare.message, /强制成功|force success/i);
});

test('status tone highlights operator attention states', () => {
  assert.equal(getOutboxStatusTone('DEAD'), 'danger');
  assert.equal(getOutboxStatusTone('FAILED'), 'warning');
  assert.equal(getOutboxStatusTone('PROCESSING'), 'info');
  assert.equal(getOutboxStatusTone('PENDING'), 'neutral');
  assert.equal(getOutboxStatusTone('SUCCEEDED'), 'success');
});

test('requeue reason is trimmed and optional', () => {
  assert.deepEqual(normalizeOutboxReason('  retry after fix  '), { reason: 'retry after fix' });
  assert.deepEqual(normalizeOutboxReason('   '), {});
});
