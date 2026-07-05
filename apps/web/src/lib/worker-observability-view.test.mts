import assert from 'node:assert/strict';

import {
  getWorkerObservabilityTone,
  getWorkerObservabilityUnavailableMessage,
  getWorkerObservabilityWorkerLabel,
  shouldShowWorkerObservabilityStrip,
} from './worker-observability-view.ts';

assert.equal(getWorkerObservabilityTone('healthy'), 'success');
assert.equal(getWorkerObservabilityTone('attention'), 'warning');
assert.equal(getWorkerObservabilityTone('degraded'), 'danger');
assert.equal(getWorkerObservabilityTone('idle'), 'neutral');

assert.equal(shouldShowWorkerObservabilityStrip(0, false), false);
assert.equal(shouldShowWorkerObservabilityStrip(1, false), true);
assert.equal(shouldShowWorkerObservabilityStrip(0, true), true);

assert.equal(
  getWorkerObservabilityWorkerLabel({
    heartbeatTtlSeconds: 45,
    onlineCount: 1,
    latestHeartbeat: {
      workerId: 'worker-1',
      serverRole: 'worker',
      queues: ['document-processing'],
      startedAt: '2026-07-05T10:00:00.000Z',
      lastSeenAt: '2026-07-05T10:00:15.000Z',
    },
  }),
  'worker 在线',
);

assert.equal(
  getWorkerObservabilityWorkerLabel({
    heartbeatTtlSeconds: 45,
    onlineCount: 0,
    latestHeartbeat: null,
  }),
  '暂未检测到 worker',
);

assert.equal(
  getWorkerObservabilityUnavailableMessage(),
  '后台健康状态暂不可用',
);
