import assert from 'node:assert/strict';

import {
  getWorkerObservabilityPollInterval,
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
assert.equal(getWorkerObservabilityPollInterval(undefined, false, 5000), false);
assert.equal(getWorkerObservabilityPollInterval(undefined, true, 5000), 5000);
assert.equal(
  getWorkerObservabilityPollInterval(
    {
      server: { role: 'api', knowledgeProcessingMode: 'queue' },
      queue: {
        name: 'knowledge-document-processing',
        counts: {
          waiting: 2,
          active: 0,
          delayed: 0,
          completed: 0,
          failed: 0,
          paused: 0,
        },
        isPaused: false,
        hasBacklog: true,
      },
      workers: {
        heartbeatTtlSeconds: 45,
        onlineCount: 0,
        latestHeartbeat: null,
      },
      backgroundJobs: {
        activeCount: 0,
        failedCount: 0,
        staleSkippedCount: 0,
        succeededCount: 0,
        totalRecentCount: 0,
        latestJob: null,
      },
      signals: {
        status: 'attention',
        hasWorkerHeartbeat: false,
        queueModeWithoutWorker: true,
        queueBacklogWithoutWorker: true,
        hasRecentFailures: false,
        message: '已有待处理任务，但暂未检测到 worker 在线。',
      },
    },
    false,
    5000,
  ),
  5000,
);

assert.equal(
  getWorkerObservabilityPollInterval(
    {
      server: { role: 'api', knowledgeProcessingMode: 'queue' },
      queue: {
        name: 'knowledge-document-processing',
        counts: {
          waiting: 0,
          active: 0,
          delayed: 0,
          completed: 0,
          failed: 3,
          paused: 0,
        },
        isPaused: false,
        hasBacklog: false,
      },
      workers: {
        heartbeatTtlSeconds: 45,
        onlineCount: 1,
        latestHeartbeat: {
          workerId: 'worker-1',
          serverRole: 'worker',
          queues: ['knowledge-document-processing'],
          startedAt: '2026-07-05T10:00:00.000Z',
          lastSeenAt: '2026-07-05T10:00:15.000Z',
        },
      },
      backgroundJobs: {
        activeCount: 0,
        failedCount: 1,
        staleSkippedCount: 0,
        succeededCount: 0,
        totalRecentCount: 1,
        latestJob: null,
      },
      signals: {
        status: 'degraded',
        hasWorkerHeartbeat: true,
        queueModeWithoutWorker: false,
        queueBacklogWithoutWorker: false,
        hasRecentFailures: true,
        message: '最近有后台任务失败，请查看任务详情。',
      },
    },
    false,
    5000,
  ),
  false,
);

assert.equal(
  getWorkerObservabilityWorkerLabel({
    heartbeatTtlSeconds: 45,
    onlineCount: 1,
    latestHeartbeat: {
      workerId: 'worker-1',
      serverRole: 'worker',
      queues: ['knowledge-document-processing'],
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
