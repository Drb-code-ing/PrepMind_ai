import { Logger } from '@nestjs/common';
import type { OperatorAuditExport } from '@prisma/client';
import { DelayedError, type Job } from 'bullmq';

import { OperatorAuditExportStorageError } from '../../uploads/storage.service';
import { OperatorAuditExportArchiveError } from '../operator-audit-export-archive.service';
import type {
  ReadyInput,
  TokenInput,
} from '../operator-audit-export-state.repository';
import {
  createOperatorAuditExportWorkerProviders,
  OperatorAuditExportProcessControl,
  OperatorAuditExportQueueConcurrencyService,
  OperatorAuditExportWorkerFatalExitService,
} from '../operator-audit-exports.module';
import { OperatorAuditExportProcessor } from './operator-audit-export.processor';

describe('OperatorAuditExportProcessor', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers the consumer only when a worker role has all three explicit gates', () => {
    const enabled = {
      exportEnabled: true,
      outboxDispatcherEnabled: true,
      maintenanceEnabled: true,
    };
    expect(
      createOperatorAuditExportWorkerProviders({ role: 'api', ...enabled }),
    ).toEqual([]);
    for (const role of ['worker', 'both'] as const) {
      expect(
        createOperatorAuditExportWorkerProviders({ role, ...enabled }),
      ).toEqual(
        expect.arrayContaining([
          OperatorAuditExportProcessor,
          OperatorAuditExportProcessControl,
          OperatorAuditExportQueueConcurrencyService,
          OperatorAuditExportWorkerFatalExitService,
        ]),
      );
      expect(
        createOperatorAuditExportWorkerProviders({
          role,
          ...enabled,
          exportEnabled: false,
        }),
      ).toEqual([]);
      expect(
        createOperatorAuditExportWorkerProviders({
          role,
          ...enabled,
          outboxDispatcherEnabled: false,
        }),
      ).toEqual([]);
      expect(
        createOperatorAuditExportWorkerProviders({
          role,
          ...enabled,
          maintenanceEnabled: false,
        }),
      ).toEqual([]);
    }
  });

  it('handles a rejected worker run immediately without an unhandled rejection', async () => {
    const calls: string[] = [];
    let rejectRun!: (reason: unknown) => void;
    const runPromise = new Promise<void>((_resolve, reject) => {
      rejectRun = reject;
    });
    const catchSpy = jest.spyOn(runPromise, 'catch');
    const fatalExit = { terminateAfterWorkerFailure: jest.fn() };
    const unhandledRejection = jest.fn();
    const queue = {
      setGlobalConcurrency: jest.fn().mockImplementation(() => {
        calls.push('global');
        return Promise.resolve(1);
      }),
    };
    const worker = {
      run: jest.fn().mockImplementation(() => {
        calls.push('run');
        return runPromise;
      }),
    };
    const service = new OperatorAuditExportQueueConcurrencyService(
      queue as never,
      { worker } as never,
      fatalExit as never,
    );
    process.on('unhandledRejection', unhandledRejection);

    try {
      await service.onApplicationBootstrap();

      expect(queue.setGlobalConcurrency).toHaveBeenCalledWith(1);
      expect(worker.run).toHaveBeenCalledTimes(1);
      expect(catchSpy).toHaveBeenCalledTimes(1);
      expect(calls).toEqual(['global', 'run']);

      rejectRun(new Error('redis://secret@127.0.0.1:6379'));
      await new Promise((resolve) => setImmediate(resolve));

      expect(fatalExit.terminateAfterWorkerFailure).toHaveBeenCalledTimes(1);
      expect(unhandledRejection).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandledRejection);
    }
  });

  it('logs only a fixed worker-fatal message before requesting termination', () => {
    const control = { terminate: jest.fn() };
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const fatalExit = new OperatorAuditExportWorkerFatalExitService(control);

    fatalExit.terminateAfterWorkerFailure();

    expect(loggerError).toHaveBeenCalledWith(
      'Operator audit export worker stopped; terminating process',
    );
    expect(control.terminate).toHaveBeenCalledTimes(1);
  });

  it('marks the process failed and sends SIGTERM without exiting tests', () => {
    const previousExitCode = process.exitCode;
    const kill = jest.spyOn(process, 'kill').mockReturnValue(true);

    try {
      process.exitCode = undefined;
      new OperatorAuditExportProcessControl().terminate();

      expect(process.exitCode).toBe(1);
      expect(kill).toHaveBeenCalledWith(process.pid, 'SIGTERM');
    } finally {
      process.exitCode = previousExitCode;
      kill.mockRestore();
    }
  });

  it('falls back to an explicit failed exit when SIGTERM cannot be sent', () => {
    const previousExitCode = process.exitCode;
    const kill = jest.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('signal unavailable');
    });
    const controlledExit = new Error('controlled test exit');
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw controlledExit;
    });

    try {
      process.exitCode = undefined;
      expect(() => new OperatorAuditExportProcessControl().terminate()).toThrow(
        controlledExit,
      );

      expect(process.exitCode).toBe(1);
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      process.exitCode = previousExitCode;
      kill.mockRestore();
      exit.mockRestore();
    }
  });

  it('strictly rejects unknown payload fields before claiming facts', async () => {
    const fixture = createFixture();

    await expect(
      fixture.processor.process(
        job({ exportId: 'export_1', backgroundJobId: 'job_1', extra: true }),
      ),
    ).rejects.toMatchObject({ code: 'OPERATOR_AUDIT_EXPORT_INVALID_PAYLOAD' });
    expect(fixture.state.claim).not.toHaveBeenCalled();
  });

  it('completes stale deliveries without file work', async () => {
    const fixture = createFixture();
    fixture.state.claim.mockResolvedValue({ kind: 'stale' });

    await expect(fixture.processor.process(job())).resolves.toBeUndefined();
    expect(fixture.archive.build).not.toHaveBeenCalled();
  });

  it('delays a busy lease past expiry without handling it as failure', async () => {
    const fixture = createFixture();
    const leaseExpiresAt = new Date('2026-07-10T00:04:00.000Z');
    fixture.state.claim.mockResolvedValue({ kind: 'busy', leaseExpiresAt });
    const bullJob = job();

    await expect(fixture.processor.process(bullJob)).rejects.toBeInstanceOf(
      DelayedError,
    );
    expect(bullJob.moveToDelayed).toHaveBeenCalledWith(
      leaseExpiresAt.getTime() + 1000,
      'bull-token',
    );
    expect(fixture.state.markRetryable).not.toHaveBeenCalled();
    expect(fixture.state.markFailed).not.toHaveBeenCalled();
  });

  it('builds, renews around upload, and atomically selects the ready object', async () => {
    const fixture = createFixture();

    await expect(fixture.processor.process(job())).resolves.toBeUndefined();

    expect(fixture.archive.build).toHaveBeenCalledWith({
      auditExport: fixture.auditExport,
      processingToken: 'token_1',
    });
    expect(fixture.state.renewLease).toHaveBeenCalledTimes(2);
    expect(fixture.storage.writeOperatorAuditExport).toHaveBeenCalledWith(
      'export_1',
      'token_1',
      'C:\\temp\\evidence.zip',
    );
    expect(fixture.state.markReady).toHaveBeenCalledWith(
      expect.objectContaining({
        exportId: 'export_1',
        backgroundJobId: 'job_1',
        processingToken: 'token_1',
        objectKey: 'operator-audit-exports/export_1/attempts/token_1.zip',
      }),
    );
    expect(fixture.storage.deleteOperatorAuditExport).not.toHaveBeenCalled();
    expect(fixture.cleanup).toHaveBeenCalledTimes(1);
  });

  it('stops before upload when renewal proves the lease was lost', async () => {
    const fixture = createFixture();
    fixture.state.renewLease.mockResolvedValueOnce(false);

    await expect(fixture.processor.process(job())).resolves.toBeUndefined();
    expect(fixture.storage.writeOperatorAuditExport).not.toHaveBeenCalled();
    expect(fixture.state.markReady).not.toHaveBeenCalled();
    expect(fixture.cleanup).toHaveBeenCalledTimes(1);
  });

  it('deletes only its attempt object when a newer token wins the ready CAS', async () => {
    const fixture = createFixture();
    fixture.state.markReady.mockResolvedValue({ kind: 'lost-lease' });

    await expect(fixture.processor.process(job())).resolves.toBeUndefined();
    expect(fixture.storage.deleteOperatorAuditExport).toHaveBeenCalledWith(
      'operator-audit-exports/export_1/attempts/token_1.zip',
    );
    expect(fixture.state.markFailed).not.toHaveBeenCalled();
  });

  it('preserves the selected object when READY committed before its ACK was lost', async () => {
    const fixture = createFixture();
    fixture.state.markReady.mockImplementation(
      (input: TokenInput & ReadyInput) => {
        fixture.facts.auditExport = {
          status: 'READY',
          objectKey: input.objectKey,
          processingToken: null,
        };
        fixture.facts.backgroundJob = { status: 'SUCCEEDED' };
        return Promise.reject(new Error('database commit ACK lost'));
      },
    );
    fixture.state.reconcileReady.mockImplementation(
      (input: TokenInput & Pick<ReadyInput, 'objectKey'>) =>
        Promise.resolve(
          fixture.facts.auditExport.status === 'READY' &&
            fixture.facts.auditExport.objectKey === input.objectKey &&
            fixture.facts.backgroundJob.status === 'SUCCEEDED'
            ? { kind: 'committed' }
            : { kind: 'uncertain' },
        ),
    );

    await expect(fixture.processor.process(job())).resolves.toBeUndefined();
    expect(fixture.storage.deleteOperatorAuditExport).not.toHaveBeenCalled();
    expect(fixture.state.markRetryable).not.toHaveBeenCalled();
    expect(fixture.state.markFailed).not.toHaveBeenCalled();
  });

  it('delays an unavailable READY reconciliation without deleting the possible selected object', async () => {
    const fixture = createFixture();
    fixture.state.markReady.mockRejectedValue(
      new Error('database unavailable'),
    );
    fixture.state.reconcileReady.mockRejectedValue(
      new Error('database still unavailable'),
    );
    const bullJob = job();

    await expect(fixture.processor.process(bullJob)).rejects.toBeInstanceOf(
      DelayedError,
    );
    expect(bullJob.moveToDelayed).toHaveBeenCalledWith(
      expect.any(Number),
      'bull-token',
    );
    expect(fixture.storage.deleteOperatorAuditExport).not.toHaveBeenCalled();
    expect(fixture.state.markRetryable).not.toHaveBeenCalled();
    expect(fixture.state.markFailed).not.toHaveBeenCalled();
  });

  it('deletes and completes when reconciliation proves another state did not select its key', async () => {
    const fixture = createFixture();
    fixture.state.markReady.mockRejectedValue(
      new Error('database commit rejected'),
    );
    fixture.state.reconcileReady.mockResolvedValue({ kind: 'unselected' });

    await expect(fixture.processor.process(job())).resolves.toBeUndefined();
    expect(fixture.storage.deleteOperatorAuditExport).toHaveBeenCalledWith(
      'operator-audit-exports/export_1/attempts/token_1.zip',
    );
    expect(fixture.state.markRetryable).not.toHaveBeenCalled();
    expect(fixture.state.markFailed).not.toHaveBeenCalled();
  });

  it('deletes an unselected uploaded attempt and returns current facts to QUEUED on retry', async () => {
    const fixture = createFixture();
    fixture.state.markReady.mockRejectedValue(
      new Error('database unavailable'),
    );
    fixture.state.reconcileReady.mockResolvedValue({ kind: 'current-token' });
    const bullJob = job(undefined, { attemptsMade: 0, attempts: 3 });

    await expect(fixture.processor.process(bullJob)).rejects.toThrow(
      'database unavailable',
    );
    expect(fixture.storage.deleteOperatorAuditExport).toHaveBeenCalledWith(
      'operator-audit-exports/export_1/attempts/token_1.zip',
    );
    expect(fixture.state.markRetryable).toHaveBeenCalledWith(
      expect.objectContaining({
        processingToken: 'token_1',
        errorCode: 'OPERATOR_AUDIT_EXPORT_DATABASE_ERROR',
      }),
    );
    expect(fixture.state.markFailed).not.toHaveBeenCalled();
    expect(fixture.cleanup).toHaveBeenCalledTimes(1);
  });

  it('delays a retryable transition database failure without consuming a Bull attempt', async () => {
    const fixture = createFixture();
    fixture.archive.build.mockRejectedValue(
      new Error('filesystem unavailable'),
    );
    fixture.state.markRetryable.mockRejectedValue(
      new Error('database unavailable'),
    );
    const bullJob = job(undefined, { attemptsMade: 0, attempts: 3 });

    await expect(fixture.processor.process(bullJob)).rejects.toBeInstanceOf(
      DelayedError,
    );
    expect(bullJob.moveToDelayed).toHaveBeenCalledWith(
      expect.any(Number),
      'bull-token',
    );
  });

  it('delays a final transition database failure without consuming the last Bull attempt', async () => {
    const fixture = createFixture();
    fixture.archive.build.mockRejectedValue(
      new Error('filesystem unavailable'),
    );
    fixture.state.markFailed.mockRejectedValue(
      new Error('database unavailable'),
    );
    const bullJob = job(undefined, { attemptsMade: 2, attempts: 3 });

    await expect(fixture.processor.process(bullJob)).rejects.toBeInstanceOf(
      DelayedError,
    );
    expect(bullJob.moveToDelayed).toHaveBeenCalledWith(
      expect.any(Number),
      'bull-token',
    );
  });

  it('deletes the deterministic attempt key when MinIO commits but loses the ACK', async () => {
    const fixture = createFixture();
    fixture.storage.writeOperatorAuditExport.mockRejectedValue(
      new OperatorAuditExportStorageError('unavailable'),
    );

    await expect(fixture.processor.process(job())).rejects.toMatchObject({
      kind: 'unavailable',
    });
    expect(fixture.storage.deleteOperatorAuditExport).toHaveBeenCalledWith(
      'operator-audit-exports/export_1/attempts/token_1.zip',
    );
    expect(fixture.state.markRetryable).toHaveBeenCalledTimes(1);
  });

  it('retries an interval renewal dependency error instead of completing silently', async () => {
    jest.useFakeTimers();
    const fixture = createFixture({ leaseMs: 3_000 });
    let finishBuild!: (value: typeof fixture.archiveResult) => void;
    fixture.archive.build.mockReturnValue(
      new Promise((resolve) => {
        finishBuild = resolve;
      }),
    );
    fixture.state.renewLease.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    try {
      const running = fixture.processor.process(job());
      await Promise.resolve();
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(1_000);
      finishBuild(fixture.archiveResult);

      await expect(running).rejects.toMatchObject({
        code: 'OPERATOR_AUDIT_EXPORT_DATABASE_ERROR',
      });
      expect(fixture.state.markRetryable).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('marks a non-retryable archive limit as failed and discards Bull retries', async () => {
    const fixture = createFixture();
    fixture.archive.build.mockRejectedValue(
      new OperatorAuditExportArchiveError(
        'OPERATOR_AUDIT_EXPORT_ARCHIVE_TOO_LARGE',
        false,
        'too large',
      ),
    );
    const bullJob = job(undefined, { attemptsMade: 0, attempts: 3 });

    await expect(fixture.processor.process(bullJob)).rejects.toMatchObject({
      code: 'OPERATOR_AUDIT_EXPORT_ARCHIVE_TOO_LARGE',
    });
    expect(fixture.state.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'OPERATOR_AUDIT_EXPORT_ARCHIVE_TOO_LARGE',
      }),
    );
    expect(bullJob.discard).toHaveBeenCalledTimes(1);
    expect(fixture.state.markRetryable).not.toHaveBeenCalled();
  });

  it('marks exhausted retryable failures terminal and still rethrows for Bull failure', async () => {
    const fixture = createFixture();
    fixture.archive.build.mockRejectedValue(
      new Error('filesystem unavailable'),
    );

    await expect(
      fixture.processor.process(
        job(undefined, { attemptsMade: 2, attempts: 3 }),
      ),
    ).rejects.toThrow('filesystem unavailable');
    expect(fixture.state.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'OPERATOR_AUDIT_EXPORT_RETRY_EXHAUSTED',
      }),
    );
  });

  it('does not let cleanup failure overwrite a successful ready transition', async () => {
    const fixture = createFixture();
    fixture.cleanup.mockRejectedValue(new Error('cleanup secret path'));

    await expect(fixture.processor.process(job())).resolves.toBeUndefined();
    expect(fixture.state.markReady).toHaveBeenCalledTimes(1);
  });
});

function createFixture(options: { leaseMs?: number } = {}) {
  const cleanup = jest.fn().mockResolvedValue(undefined);
  const auditExport = { id: 'export_1' } as OperatorAuditExport;
  const state = {
    claim: jest.fn().mockResolvedValue({
      kind: 'claimed',
      processingToken: 'token_1',
      leaseExpiresAt: new Date('2026-07-10T00:05:00.000Z'),
      auditExport,
    }),
    renewLease: jest.fn().mockResolvedValue(true),
    markRetryable: jest.fn().mockResolvedValue(true),
    markFailed: jest.fn().mockResolvedValue(true),
    markReady: jest.fn().mockResolvedValue({
      kind: 'ready',
      expiresAt: new Date('2026-07-11T00:00:00.000Z'),
    }),
    reconcileReady: jest.fn().mockResolvedValue({ kind: 'current-token' }),
  };
  const facts = {
    auditExport: {
      status: 'PROCESSING',
      objectKey: null as string | null,
      processingToken: 'token_1' as string | null,
    },
    backgroundJob: { status: 'ACTIVE' },
  };
  const archiveResult = {
    filePath: 'C:\\temp\\evidence.zip',
    fileName: 'evidence.zip',
    archiveSize: 1024,
    recordCount: 3,
    csvSha256: `sha256:${'a'.repeat(64)}`,
    archiveSha256: `sha256:${'b'.repeat(64)}`,
    queryStartedAt: new Date(),
    queryFinishedAt: new Date(),
    effectiveEndAt: new Date(),
    cleanup,
  };
  const archive = {
    build: jest.fn().mockResolvedValue(archiveResult),
  };
  const storage = {
    writeOperatorAuditExport: jest
      .fn()
      .mockResolvedValue(
        'operator-audit-exports/export_1/attempts/token_1.zip',
      ),
    deleteOperatorAuditExport: jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'OPERATOR_AUDIT_EXPORT_LEASE_MS') {
        return options.leaseMs ?? 300_000;
      }
      throw new Error(`Unexpected config key: ${key}`);
    }),
  };
  const processor = new OperatorAuditExportProcessor(
    state as never,
    archive as never,
    storage as never,
    config as never,
  );

  return {
    processor,
    state,
    archive,
    storage,
    cleanup,
    auditExport,
    archiveResult,
    facts,
  };
}

function job(
  data: unknown = { exportId: 'export_1', backgroundJobId: 'job_1' },
  options: { attemptsMade?: number; attempts?: number } = {},
) {
  return {
    data,
    token: 'bull-token',
    attemptsMade: options.attemptsMade ?? 0,
    opts: { attempts: options.attempts ?? 3 },
    moveToDelayed: jest.fn().mockResolvedValue(undefined),
    discard: jest.fn(),
  } as unknown as Job<unknown> & {
    moveToDelayed: jest.Mock;
    discard: jest.Mock;
  };
}
