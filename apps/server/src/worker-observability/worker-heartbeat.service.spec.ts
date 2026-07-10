/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { WorkerHeartbeatService } from './worker-heartbeat.service';

describe('WorkerHeartbeatService', () => {
  const redis = {
    set: jest.fn(),
    del: jest.fn(),
  };
  const queue = {
    client: Promise.resolve(redis),
  };
  const logger = {
    warn: jest.fn(),
    log: jest.fn(),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    redis.set.mockReset();
    redis.del.mockReset();
    logger.warn.mockReset();
    logger.log.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not write heartbeat for api role', async () => {
    const service = new WorkerHeartbeatService(queue as never, {
      role: 'api',
      heartbeatIntervalMs: 15_000,
      heartbeatTtlSeconds: 45,
      prefix: 'prepmind',
      now: () => new Date('2026-07-05T10:00:00.000Z'),
      workerId: 'api-1',
      logger,
    });

    await service.onModuleInit();

    expect(redis.set).not.toHaveBeenCalled();
  });

  it('writes a ttl heartbeat for worker role', async () => {
    const service = new WorkerHeartbeatService(queue as never, {
      role: 'worker',
      heartbeatIntervalMs: 15_000,
      heartbeatTtlSeconds: 45,
      prefix: 'prepmind',
      now: () => new Date('2026-07-05T10:00:00.000Z'),
      workerId: 'worker-1',
      logger,
    });

    await service.onModuleInit();

    expect(redis.set).toHaveBeenCalledWith(
      'prepmind:worker-heartbeat:worker-1',
      expect.stringContaining('"serverRole":"worker"'),
      'EX',
      45,
    );
    const rawHeartbeat: unknown = redis.set.mock.calls[0]?.[1];
    expect(typeof rawHeartbeat).toBe('string');
    const heartbeat = JSON.parse(String(rawHeartbeat)) as unknown;
    expect(heartbeat).toEqual(
      expect.objectContaining({
        queues: [
          'knowledge-document-processing',
          'operator-audit-export',
          'operator-audit-maintenance',
        ],
      }),
    );

    await service.onModuleDestroy();
  });
});
