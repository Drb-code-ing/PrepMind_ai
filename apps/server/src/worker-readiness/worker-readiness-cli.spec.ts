import type { WorkerReadinessResponse } from '@repo/types/api/worker-readiness';
import { MODULE_METADATA } from '@nestjs/common/constants';

import { AppModule } from '../app.module';
import { OutboxModule } from '../outbox/outbox.module';
import {
  formatWorkerReadiness,
  getWorkerReadinessExitCode,
  runWorkerReadinessCli,
  withWorkerReadinessTimeout,
  WorkerReadinessCliModule,
} from '../../scripts/worker-readiness';

describe('worker readiness CLI helpers', () => {
  it.each([
    ['ready', 0],
    ['degraded', 1],
    ['not_ready', 1],
  ] as const)(
    'maps %s readiness status to exit code %i',
    (status, expectedExitCode) => {
      expect(
        getWorkerReadinessExitCode({
          ...createReadiness(),
          ready: status === 'ready',
          status,
        }),
      ).toBe(expectedExitCode);
    },
  );

  it('formats a human-readable safe summary without raw secrets or payloads', () => {
    const result = formatWorkerReadiness({
      ...createReadiness(),
      accessToken: 'secret-access-token',
      payload: { raw: 'raw-payload-value' },
      prompt: 'raw-prompt-value',
      chunk: 'raw-chunk-value',
      cookie: 'raw-cookie-value',
      apiKey: 'raw-api-key-value',
      lastError: 'raw-last-error-value',
    } as WorkerReadinessResponse & Record<string, unknown>);

    expect(result).toContain('Worker readiness: degraded');
    expect(result).toContain('Checked at: 2026-07-08T01:00:00.000Z');
    expect(result).toContain('Server: role=worker mode=queue');
    expect(result).toContain('Redis: pass - Redis is reachable.');
    expect(result).toContain(
      'Queue: warn - Queue has failed jobs. counts(waiting=1 active=2 delayed=3 failed=4 paused=5) paused=false backlog=true',
    );
    expect(result).toContain(
      'Workers: pass - At least one worker heartbeat is online. online=1 latest=2026-07-08T00:59:45.000Z',
    );
    expect(result).toContain(
      'Outbox: warn - Outbox has pending or processing events. dead=0 backlog=true oldestPendingAgeMs=60000',
    );
    expect(result).toContain('Issues:');
    expect(result).toContain('- Queue has failed jobs.');
    expect(result).not.toContain('accessToken');
    expect(result).not.toContain('secret-access-token');
    expect(result).not.toContain('payload');
    expect(result).not.toContain('raw-payload-value');
    expect(result).not.toContain('raw-prompt-value');
    expect(result).not.toContain('raw-chunk-value');
    expect(result).not.toContain('raw-cookie-value');
    expect(result).not.toContain('raw-api-key-value');
    expect(result).not.toContain('raw-last-error-value');
  });

  it('uses a minimal read-only module instead of the full application module', () => {
    const imports =
      (Reflect.getMetadata(
        MODULE_METADATA.IMPORTS,
        WorkerReadinessCliModule,
      ) as unknown[]) ?? [];
    const controllers =
      (Reflect.getMetadata(
        MODULE_METADATA.CONTROLLERS,
        WorkerReadinessCliModule,
      ) as unknown[]) ?? [];

    expect(imports).not.toContain(AppModule);
    expect(imports).not.toContain(OutboxModule);
    expect(controllers).toEqual([]);
  });

  it('fails readiness checks with a bounded timeout', async () => {
    await expect(
      withWorkerReadinessTimeout(new Promise(() => undefined), 1),
    ).rejects.toThrow('Worker readiness timed out.');
  });

  it('maps CLI timeout failures to exit code 2 without printing raw errors', async () => {
    const stdout = { write: jest.fn() };
    const stderr = { write: jest.fn() };
    const close = jest.fn().mockResolvedValue(undefined);

    const exitCode = await runWorkerReadinessCli({
      createApplicationContext: jest.fn().mockResolvedValue({
        close,
        get: () => ({
          getReadiness: () => new Promise(() => undefined),
        }),
      }),
      stdout,
      stderr,
      timeoutMs: 1,
    });

    expect(exitCode).toBe(2);
    expect(stdout.write).not.toHaveBeenCalled();
    expect(stderr.write).toHaveBeenCalledWith(
      'Worker readiness CLI failed: unexpected script/config/timeout failure.\n',
    );
    expect(stderr.write).not.toHaveBeenCalledWith(
      expect.stringContaining('REDIS_URL'),
    );
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('suppresses dependency console errors and only prints controlled CLI output', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const stdout = { write: jest.fn() };
    const stderr = { write: jest.fn() };

    try {
      const exitCode = await runWorkerReadinessCli({
        createApplicationContext: jest.fn().mockImplementation(() => {
          console.error('raw dependency AggregateError with REDIS_URL');
          return Promise.reject(new Error('raw failure with REDIS_URL'));
        }),
        stdout,
        stderr,
        timeoutMs: 50,
      });

      expect(exitCode).toBe(2);
      expect(stdout.write).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect(stderr.write).toHaveBeenCalledWith(
        'Worker readiness CLI failed: unexpected script/config/timeout failure.\n',
      );
      expect(stderr.write).not.toHaveBeenCalledWith(
        expect.stringContaining('REDIS_URL'),
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});

function createReadiness(): WorkerReadinessResponse {
  return {
    ready: false,
    status: 'degraded',
    checkedAt: '2026-07-08T01:00:00.000Z',
    server: {
      role: 'worker',
      knowledgeProcessingMode: 'queue',
    },
    checks: {
      redis: {
        status: 'pass',
        message: 'Redis is reachable.',
      },
      queue: {
        status: 'warn',
        message: 'Queue has failed jobs.',
        counts: {
          waiting: 1,
          active: 2,
          delayed: 3,
          failed: 4,
          paused: 5,
        },
        isPaused: false,
        hasBacklog: true,
      },
      workers: {
        status: 'pass',
        message: 'At least one worker heartbeat is online.',
        onlineCount: 1,
        latestHeartbeatAt: '2026-07-08T00:59:45.000Z',
      },
      outbox: {
        status: 'warn',
        message: 'Outbox has pending or processing events.',
        deadCount: 0,
        hasBacklog: true,
        oldestPendingAgeMs: 60000,
      },
    },
    issues: ['Queue has failed jobs.'],
  };
}
