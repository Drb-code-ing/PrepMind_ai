import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getWorkerCheckTone,
  getWorkerReadinessLabel,
  getWorkerReadinessTone,
  summarizeWorkerReadiness,
} from './worker-readiness-view.ts';

test('worker readiness overall statuses map to operator labels and tones', () => {
  assert.equal(getWorkerReadinessLabel('ready'), 'Ready');
  assert.equal(getWorkerReadinessLabel('degraded'), 'Degraded');
  assert.equal(getWorkerReadinessLabel('not_ready'), 'Not Ready');
  assert.equal(getWorkerReadinessTone('ready'), 'success');
  assert.equal(getWorkerReadinessTone('degraded'), 'warning');
  assert.equal(getWorkerReadinessTone('not_ready'), 'danger');
});

test('worker readiness check statuses map to tones', () => {
  assert.equal(getWorkerCheckTone('pass'), 'success');
  assert.equal(getWorkerCheckTone('warn'), 'warning');
  assert.equal(getWorkerCheckTone('fail'), 'danger');
});

test('worker readiness summary highlights queue mode and issues', () => {
  assert.equal(
    summarizeWorkerReadiness({
      status: 'degraded',
      ready: false,
      serverRole: 'worker',
      knowledgeProcessingMode: 'queue',
      issueCount: 2,
    }),
    'worker / queue，当前有 2 个问题需要处理。',
  );
});
