import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getOutboxErrorGuidance,
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
