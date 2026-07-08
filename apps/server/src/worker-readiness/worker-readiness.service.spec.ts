import type { WorkerObservabilityOutboxSummary } from '@repo/types/api/worker-observability';
import { workerReadinessResponseSchema } from '@repo/types/api/worker-readiness';

import { WorkerReadinessService } from './worker-readiness.service';

type QueueCounts = {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  paused: number;
};

type Heartbeat = {
  workerId: string;
  serverRole: 'api' | 'worker' | 'both';
  queues: string[];
  startedAt: string;
  lastSeenAt: string;
};

describe('WorkerReadinessService', () => {
  const now = new Date('2026-07-08T01:00:00.000Z');

  it('reports ready in queue mode when Redis, queue, heartbeat, and outbox are healthy', async () => {
    const service = createService({
      mode: 'queue',
      heartbeats: [
        {
          workerId: 'worker-1',
          serverRole: 'worker',
          queues: ['knowledge-document-processing'],
          startedAt: '2026-07-08T00:59:00.000Z',
          lastSeenAt: '2026-07-08T00:59:45.000Z',
        },
      ],
    });

    const result = await service.getReadiness(now);

    expect(workerReadinessResponseSchema.parse(result)).toEqual(result);
    expect(result.ready).toBe(true);
    expect(result.status).toBe('ready');
    expect(result.checks.redis.status).toBe('pass');
    expect(result.checks.queue.status).toBe('pass');
    expect(result.checks.workers.status).toBe('pass');
    expect(result.checks.workers.onlineCount).toBe(1);
    expect(result.checks.workers.latestHeartbeatAt).toBe(
      '2026-07-08T00:59:45.000Z',
    );
    expect(result.checks.outbox.status).toBe('pass');
    expect(result.issues).toEqual([]);
  });

  it('reports not_ready in queue mode when backlog exists and no heartbeat is online', async () => {
    const service = createService({
      mode: 'queue',
      counts: {
        waiting: 2,
        active: 0,
        delayed: 0,
        failed: 0,
        paused: 0,
      },
      heartbeats: [],
    });

    const result = await service.getReadiness(now);

    expect(result.ready).toBe(false);
    expect(result.status).toBe('not_ready');
    expect(result.checks.queue.hasBacklog).toBe(true);
    expect(result.checks.workers.status).toBe('fail');
    expect(result.checks.workers.message).toBe(
      'Queue backlog exists but no worker heartbeat is online.',
    );
    expect(result.issues).toContain(
      'Queue backlog exists but no worker heartbeat is online.',
    );
  });

  it('reports degraded in queue mode when idle with no heartbeat online', async () => {
    const service = createService({
      mode: 'queue',
      counts: emptyQueueCounts(),
      heartbeats: [],
    });

    const result = await service.getReadiness(now);

    expect(result.ready).toBe(false);
    expect(result.status).toBe('degraded');
    expect(result.checks.queue.hasBacklog).toBe(false);
    expect(result.checks.workers.status).toBe('warn');
    expect(result.checks.workers.message).toBe(
      'Queue mode has no worker heartbeat online.',
    );
  });

  it('does not require worker heartbeat in inline mode', async () => {
    const service = createService({
      mode: 'inline',
      counts: emptyQueueCounts(),
      heartbeats: [],
    });

    const result = await service.getReadiness(now);

    expect(result.ready).toBe(true);
    expect(result.status).toBe('ready');
    expect(result.checks.workers.status).toBe('pass');
    expect(result.checks.workers.message).toBe(
      'Inline mode does not require worker heartbeat.',
    );
    expect(result.checks.workers.onlineCount).toBe(0);
  });

  it('reports not_ready when the queue is paused', async () => {
    const service = createService({
      mode: 'queue',
      counts: emptyQueueCounts(),
      isPaused: true,
      heartbeats: [
        {
          workerId: 'worker-1',
          serverRole: 'worker',
          queues: ['knowledge-document-processing'],
          startedAt: '2026-07-08T00:59:00.000Z',
          lastSeenAt: '2026-07-08T00:59:45.000Z',
        },
      ],
    });

    const result = await service.getReadiness(now);

    expect(result.ready).toBe(false);
    expect(result.status).toBe('not_ready');
    expect(result.checks.queue.status).toBe('fail');
    expect(result.checks.queue.isPaused).toBe(true);
    expect(result.issues).toContain('Queue is paused.');
  });

  it('reports not_ready when outbox has dead events', async () => {
    const service = createService({
      mode: 'queue',
      heartbeats: [
        {
          workerId: 'worker-1',
          serverRole: 'worker',
          queues: ['knowledge-document-processing'],
          startedAt: '2026-07-08T00:59:00.000Z',
          lastSeenAt: '2026-07-08T00:59:45.000Z',
        },
      ],
      outbox: {
        ...createOutboxSummary(),
        counts: {
          pending: 0,
          processing: 0,
          succeeded: 4,
          failed: 0,
          dead: 1,
          total: 5,
        },
        recentErrors: [
          {
            id: 'evt_secret',
            type: 'knowledge.document.processing.requested',
            status: 'DEAD',
            lastErrorCode: 'OUTBOX_INVALID_PAYLOAD',
            attempts: 5,
            maxAttempts: 5,
            updatedAt: '2026-07-08T00:58:00.000Z',
          },
        ],
      },
    });

    const result = await service.getReadiness(now);

    expect(result.ready).toBe(false);
    expect(result.status).toBe('not_ready');
    expect(result.checks.outbox.status).toBe('fail');
    expect(result.checks.outbox.deadCount).toBe(1);
    expect(JSON.stringify(result)).not.toContain('evt_secret');
    expect(JSON.stringify(result)).not.toContain('OUTBOX_INVALID_PAYLOAD');
  });

  it('reports not_ready in queue mode when Redis or BullMQ throws', async () => {
    const service = createService({
      mode: 'queue',
      queueError: new Error('redis://token@localhost leaked raw connection'),
      outbox: createOutboxSummary(),
    });

    const result = await service.getReadiness(now);

    expect(result.ready).toBe(false);
    expect(result.status).toBe('not_ready');
    expect(result.checks.redis.status).toBe('fail');
    expect(result.checks.queue.status).toBe('fail');
    expect(result.checks.workers.status).toBe('fail');
    expect(JSON.stringify(result)).not.toContain('token');
    expect(JSON.stringify(result)).not.toContain('redis://');
  });
});

function createService(input: {
  role?: 'api' | 'worker' | 'both';
  mode: 'inline' | 'queue';
  counts?: QueueCounts;
  isPaused?: boolean;
  heartbeats?: Heartbeat[];
  outbox?: WorkerObservabilityOutboxSummary;
  queueError?: Error;
}) {
  const counts = input.counts ?? emptyQueueCounts();
  const heartbeats = input.heartbeats ?? [];
  const redisValues = heartbeats.map((heartbeat) => JSON.stringify(heartbeat));
  const redis = {
    keys: jest
      .fn()
      .mockResolvedValue(redisValues.map((_, index) => `key-${index}`)),
    mget: jest.fn().mockResolvedValue(redisValues),
  };
  const queue = input.queueError
    ? {
        getJobCounts: jest.fn().mockRejectedValue(input.queueError),
        isPaused: jest.fn().mockRejectedValue(input.queueError),
        client: Promise.reject(input.queueError),
      }
    : {
        getJobCounts: jest.fn().mockResolvedValue(counts),
        isPaused: jest.fn().mockResolvedValue(input.isPaused ?? false),
        client: Promise.resolve(redis),
      };
  const outbox = {
    getSummary: jest
      .fn()
      .mockResolvedValue(input.outbox ?? createOutboxSummary()),
  };

  return new WorkerReadinessService(queue as never, outbox as never, {
    role: input.role ?? 'api',
    knowledgeProcessingMode: input.mode,
    prefix: 'prepmind',
    logger: { warn: jest.fn() },
  });
}

function emptyQueueCounts(): QueueCounts {
  return {
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 0,
    paused: 0,
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
