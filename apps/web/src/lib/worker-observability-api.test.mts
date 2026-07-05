import assert from 'node:assert/strict';

import { createWorkerObservabilityApi } from './worker-observability-api';

const api = createWorkerObservabilityApi({
  get: async (path, options) => {
    assert.equal(path, '/worker-observability/summary');
    assert.equal(options?.accessToken, 'token-1');
    return {
      server: { role: 'api', knowledgeProcessingMode: 'queue' },
      queue: {
        name: 'document-processing',
        counts: {
          waiting: 0,
          active: 0,
          delayed: 0,
          completed: 0,
          failed: 0,
          paused: 0,
        },
        isPaused: false,
        hasBacklog: false,
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
        status: 'idle',
        hasWorkerHeartbeat: false,
        queueModeWithoutWorker: true,
        queueBacklogWithoutWorker: false,
        hasRecentFailures: false,
        message: '后台处理空闲。',
      },
    };
  },
});

const result = await api.getSummary('token-1');
assert.equal(result.signals.status, 'idle');
