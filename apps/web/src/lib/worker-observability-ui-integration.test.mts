import assert from 'node:assert/strict';

import {
  getWorkerObservabilityTone,
  getWorkerObservabilityWorkerLabel,
} from './worker-observability-view.ts';

assert.equal(getWorkerObservabilityTone('attention'), 'warning');
assert.equal(
  getWorkerObservabilityWorkerLabel({
    heartbeatTtlSeconds: 45,
    onlineCount: 0,
    latestHeartbeat: null,
  }),
  '暂未检测到 worker',
);
