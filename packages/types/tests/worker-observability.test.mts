import assert from 'node:assert/strict';

import {
  workerObservabilitySummaryResponseSchema,
  type WorkerObservabilitySummaryResponse,
} from '../src/api/worker-observability.ts';

const baseSummary: WorkerObservabilitySummaryResponse = {
  server: {
    role: 'api',
    knowledgeProcessingMode: 'queue',
  },
  queue: {
    name: 'knowledge-document-processing',
    counts: {
      waiting: 2,
      active: 0,
      delayed: 0,
      completed: 4,
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
    activeCount: 2,
    failedCount: 0,
    staleSkippedCount: 0,
    succeededCount: 4,
    totalRecentCount: 6,
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
};

const parsed = workerObservabilitySummaryResponseSchema.parse(baseSummary);
assert.equal(parsed.signals.status, 'attention');
assert.equal(parsed.queue.counts.waiting, 2);

const healthy = workerObservabilitySummaryResponseSchema.parse({
  ...baseSummary,
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
  signals: {
    ...baseSummary.signals,
    status: 'healthy',
    hasWorkerHeartbeat: true,
    queueModeWithoutWorker: false,
    queueBacklogWithoutWorker: false,
    message: '后台处理正常，worker 最近在线。',
  },
});

assert.equal(healthy.workers.onlineCount, 1);
