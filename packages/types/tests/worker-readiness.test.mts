import assert from 'node:assert/strict';

import {
  workerReadinessResponseSchema,
  type WorkerReadinessResponse,
} from '../src/api/worker-readiness.ts';

const readiness: WorkerReadinessResponse = {
  ready: false,
  status: 'not_ready',
  checkedAt: '2026-07-08T01:00:00.000Z',
  server: {
    role: 'api',
    knowledgeProcessingMode: 'queue',
  },
  checks: {
    redis: {
      status: 'pass',
      message: 'Redis is reachable.',
    },
    queue: {
      status: 'pass',
      message: 'Queue is readable.',
      counts: {
        waiting: 2,
        active: 0,
        delayed: 0,
        failed: 0,
        paused: 0,
      },
      isPaused: false,
      hasBacklog: true,
    },
    auditExportQueue: {
      status: 'pass',
      message: 'Audit export queue is readable.',
      counts: { waiting: 0, active: 0, delayed: 0, failed: 0, paused: 0 },
      isPaused: false,
      hasBacklog: false,
    },
    auditMaintenanceQueue: {
      status: 'pass',
      message: 'Audit maintenance queue is readable.',
      counts: { waiting: 0, active: 0, delayed: 0, failed: 0, paused: 0 },
      isPaused: false,
      hasBacklog: false,
    },
    auditMaintenance: {
      status: 'pass',
      message: 'Audit maintenance is current.',
      enabled: true,
      lastSucceededAt: '2026-07-08T00:00:00.000Z',
      overdue: false,
    },
    workers: {
      status: 'fail',
      message: 'Queue backlog exists but no worker heartbeat is online.',
      onlineCount: 0,
      latestHeartbeatAt: null,
    },
    outbox: {
      status: 'pass',
      message: 'No dead outbox events.',
      deadCount: 0,
      hasBacklog: false,
      oldestPendingAgeMs: null,
    },
  },
  issues: ['Queue backlog exists but no worker heartbeat is online.'],
};

const parsed = workerReadinessResponseSchema.parse(readiness);

assert.equal(parsed.status, 'not_ready');
assert.equal(parsed.checks.queue.counts.waiting, 2);
assert.equal(parsed.checks.workers.message.includes('backlog'), true);
