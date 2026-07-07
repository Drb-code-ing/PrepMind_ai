import type { BackgroundJobSummaryResponse } from '@repo/types/api/background-job';
import type {
  WorkerHeartbeatResponse,
  WorkerObservabilityOutboxSummary,
} from '@repo/types/api/worker-observability';

import { WorkerObservabilityService } from './worker-observability.service';

type QueueCounts = {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: number;
};

describe('WorkerObservabilityService', () => {
  it('reports attention when queue has backlog without heartbeat', async () => {
    const service = createService({
      role: 'api',
      mode: 'queue',
      counts: {
        waiting: 2,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
        paused: 0,
      },
      heartbeats: [],
    });

    const result = await service.getSummary('user-1');

    expect(result.signals.status).toBe('attention');
    expect(result.signals.queueBacklogWithoutWorker).toBe(true);
    expect(result.signals.message).toBe(
      '已有待处理任务，但暂未检测到 worker 在线。',
    );
  });

  it('reports attention when an active job has no heartbeat', async () => {
    const service = createService({
      role: 'api',
      mode: 'queue',
      counts: {
        waiting: 0,
        active: 1,
        delayed: 0,
        completed: 0,
        failed: 0,
        paused: 0,
      },
      heartbeats: [],
    });

    const result = await service.getSummary('user-1');

    expect(result.queue.hasBacklog).toBe(true);
    expect(result.signals.status).toBe('attention');
    expect(result.signals.queueBacklogWithoutWorker).toBe(true);
  });

  it('reports degraded when the queue is paused even with a heartbeat', async () => {
    const service = createService({
      role: 'api',
      mode: 'queue',
      counts: {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
        paused: 0,
      },
      isPaused: true,
      heartbeats: [
        {
          workerId: 'worker-1',
          serverRole: 'worker',
          queues: ['knowledge-document-processing'],
          startedAt: '2026-07-05T10:00:00.000Z',
          lastSeenAt: '2026-07-05T10:00:15.000Z',
        },
      ],
    });

    const result = await service.getSummary('user-1');

    expect(result.queue.isPaused).toBe(true);
    expect(result.signals.status).toBe('degraded');
  });

  it('reports healthy when queue mode has a recent heartbeat and no failures', async () => {
    const service = createService({
      role: 'api',
      mode: 'queue',
      counts: {
        waiting: 0,
        active: 1,
        delayed: 0,
        completed: 2,
        failed: 0,
        paused: 0,
      },
      heartbeats: [
        {
          workerId: 'worker-1',
          serverRole: 'worker',
          queues: ['knowledge-document-processing'],
          startedAt: '2026-07-05T10:00:00.000Z',
          lastSeenAt: '2026-07-05T10:00:15.000Z',
        },
      ],
    });

    const result = await service.getSummary('user-1');

    expect(result.signals.status).toBe('healthy');
    expect(result.workers.onlineCount).toBe(1);
    expect(result.workers.latestHeartbeat?.workerId).toBe('worker-1');
    expect(result.queue.name).toBe('knowledge-document-processing');
  });

  it('reports degraded when recent background jobs failed', async () => {
    const service = createService({
      role: 'api',
      mode: 'queue',
      counts: {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 2,
        failed: 0,
        paused: 0,
      },
      heartbeats: [
        {
          workerId: 'worker-1',
          serverRole: 'worker',
          queues: ['knowledge-document-processing'],
          startedAt: '2026-07-05T10:00:00.000Z',
          lastSeenAt: '2026-07-05T10:00:15.000Z',
        },
      ],
      backgroundJobs: { ...createBackgroundJobSummary(), failedCount: 1 },
    });

    const result = await service.getSummary('user-1');

    expect(result.signals.status).toBe('degraded');
    expect(result.signals.hasRecentFailures).toBe(true);
  });

  it('reports idle in inline mode without queue activity', async () => {
    const service = createService({
      role: 'both',
      mode: 'inline',
      counts: {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
        paused: 0,
      },
      heartbeats: [],
    });

    const result = await service.getSummary('user-1');

    expect(result.signals.status).toBe('idle');
    expect(result.signals.message).toBe(
      '当前为同步处理模式，队列 worker 不参与处理。',
    );
  });

  it('ignores malformed heartbeat payloads', async () => {
    const service = createService({
      role: 'api',
      mode: 'queue',
      counts: {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
        paused: 0,
      },
      heartbeats: [
        {
          workerId: '',
          serverRole: 'worker',
          queues: ['knowledge-document-processing'],
          startedAt: 'not-a-date',
          lastSeenAt: '2026-07-05T10:00:15.000Z',
        },
      ],
    });

    const result = await service.getSummary('user-1');

    expect(result.workers.onlineCount).toBe(0);
    expect(result.signals.hasWorkerHeartbeat).toBe(false);
  });

  it('includes outbox summary in the worker observability response', async () => {
    const service = createService({
      role: 'worker',
      mode: 'queue',
      counts: emptyQueueCounts(),
      heartbeats: [],
      outbox: {
        ...createOutboxSummary(),
        counts: {
          pending: 2,
          processing: 1,
          succeeded: 5,
          failed: 0,
          dead: 0,
          total: 8,
        },
        hasBacklog: true,
        oldestPendingAgeMs: 120000,
      },
    });

    const result = await service.getSummary('user-1');

    expect(result.outbox.hasBacklog).toBe(true);
    expect(result.outbox.oldestPendingAgeMs).toBe(120000);
    expect(result.signals.hasOutboxBacklog).toBe(true);
  });

  it('reports degraded when outbox has dead events', async () => {
    const service = createService({
      role: 'worker',
      mode: 'queue',
      counts: emptyQueueCounts(),
      heartbeats: [
        {
          workerId: 'worker-1',
          serverRole: 'worker',
          queues: ['knowledge-document-processing'],
          startedAt: '2026-07-05T10:00:00.000Z',
          lastSeenAt: '2026-07-05T10:00:15.000Z',
        },
      ],
      outbox: {
        ...createOutboxSummary(),
        counts: {
          pending: 0,
          processing: 0,
          succeeded: 1,
          failed: 0,
          dead: 1,
          total: 2,
        },
        recentErrors: [
          {
            id: 'evt_1',
            type: 'knowledge.document.processing.requested',
            status: 'DEAD',
            lastErrorCode: 'OUTBOX_INVALID_PAYLOAD',
            attempts: 5,
            maxAttempts: 5,
            updatedAt: '2026-07-07T03:00:00.000Z',
          },
        ],
      },
    });

    const result = await service.getSummary('user-1');

    expect(result.signals.status).toBe('degraded');
    expect(result.signals.hasDeadOutboxEvents).toBe(true);
    expect(result.signals.hasRecentFailures).toBe(true);
  });
});

function createService(input: {
  role: 'api' | 'worker' | 'both';
  mode: 'inline' | 'queue';
  counts: QueueCounts;
  isPaused?: boolean;
  heartbeats: WorkerHeartbeatResponse[];
  backgroundJobs?: BackgroundJobSummaryResponse;
  outbox?: WorkerObservabilityOutboxSummary;
}) {
  const redisValues = input.heartbeats.map((heartbeat) =>
    JSON.stringify(heartbeat),
  );
  const redis = {
    keys: jest
      .fn()
      .mockResolvedValue(redisValues.map((_, index) => `key-${index}`)),
    mget: jest.fn().mockResolvedValue(redisValues),
  };
  const queue = {
    getJobCounts: jest.fn().mockResolvedValue(input.counts),
    isPaused: jest
      .fn()
      .mockResolvedValue(input.isPaused ?? input.counts.paused > 0),
    client: Promise.resolve(redis),
  };
  const backgroundJobs = {
    getSummary: jest
      .fn()
      .mockResolvedValue(input.backgroundJobs ?? createBackgroundJobSummary()),
  };
  const outbox = {
    getSummary: jest
      .fn()
      .mockResolvedValue(input.outbox ?? createOutboxSummary()),
  };

  return new WorkerObservabilityService(
    queue as never,
    backgroundJobs as never,
    outbox as never,
    {
      role: input.role,
      knowledgeProcessingMode: input.mode,
      heartbeatTtlSeconds: 45,
      prefix: 'prepmind',
    },
  );
}

function createBackgroundJobSummary(): BackgroundJobSummaryResponse {
  return {
    activeCount: 0,
    failedCount: 0,
    staleSkippedCount: 0,
    succeededCount: 0,
    totalRecentCount: 0,
    latestJob: null,
  };
}

function createOutboxSummary(): WorkerObservabilityOutboxSummary {
  return {
    counts: {
      pending: 0,
      processing: 0,
      succeeded: 0,
      failed: 0,
      dead: 0,
      total: 0,
    },
    hasBacklog: false,
    oldestPendingAgeMs: null,
    recentErrors: [],
  };
}

function emptyQueueCounts(): QueueCounts {
  return {
    waiting: 0,
    active: 0,
    delayed: 0,
    completed: 0,
    failed: 0,
    paused: 0,
  };
}
