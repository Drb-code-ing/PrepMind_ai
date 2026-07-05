import type { BackgroundJobSummaryResponse } from '@repo/types/api/background-job';
import type { WorkerHeartbeatResponse } from '@repo/types/api/worker-observability';

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
          queues: ['document-processing'],
          startedAt: '2026-07-05T10:00:00.000Z',
          lastSeenAt: '2026-07-05T10:00:15.000Z',
        },
      ],
    });

    const result = await service.getSummary('user-1');

    expect(result.signals.status).toBe('healthy');
    expect(result.workers.onlineCount).toBe(1);
    expect(result.workers.latestHeartbeat?.workerId).toBe('worker-1');
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
          queues: ['document-processing'],
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
    expect(result.signals.message).toBe('当前为同步处理模式，队列 worker 不参与处理。');
  });
});

function createService(input: {
  role: 'api' | 'worker' | 'both';
  mode: 'inline' | 'queue';
  counts: QueueCounts;
  heartbeats: WorkerHeartbeatResponse[];
  backgroundJobs?: BackgroundJobSummaryResponse;
}) {
  const redisValues = input.heartbeats.map((heartbeat) => JSON.stringify(heartbeat));
  const redis = {
    keys: jest.fn().mockResolvedValue(redisValues.map((_, index) => `key-${index}`)),
    mget: jest.fn().mockResolvedValue(redisValues),
  };
  const queue = {
    getJobCounts: jest.fn().mockResolvedValue(input.counts),
    isPaused: jest.fn().mockResolvedValue(input.counts.paused > 0),
    client: Promise.resolve(redis),
  };
  const backgroundJobs = {
    getSummary: jest
      .fn()
      .mockResolvedValue(input.backgroundJobs ?? createBackgroundJobSummary()),
  };

  return new WorkerObservabilityService(queue as never, backgroundJobs as never, {
    role: input.role,
    knowledgeProcessingMode: input.mode,
    heartbeatTtlSeconds: 45,
    prefix: 'prepmind',
  });
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
