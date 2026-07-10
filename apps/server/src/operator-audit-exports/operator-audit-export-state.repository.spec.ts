/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
import type { OperatorAuditExport } from '@prisma/client';

import type { PrismaService } from '../database/prisma.service';
import { generateOperatorAuditExportPayloadSchema } from './jobs/generate-operator-audit-export.job';
import { OperatorAuditExportStateRepository } from './operator-audit-export-state.repository';

const NOW = new Date('2026-07-10T00:00:00.000Z');
const LIVE_LEASE = new Date('2026-07-10T00:04:00.000Z');

describe('OperatorAuditExportStateRepository', () => {
  it('strictly accepts only the two non-empty job identifiers', () => {
    expect(
      generateOperatorAuditExportPayloadSchema.parse({
        exportId: 'export_1',
        backgroundJobId: 'job_1',
      }),
    ).toEqual({ exportId: 'export_1', backgroundJobId: 'job_1' });
    expect(() =>
      generateOperatorAuditExportPayloadSchema.parse({
        exportId: '',
        backgroundJobId: 'job_1',
      }),
    ).toThrow();
    expect(() =>
      generateOperatorAuditExportPayloadSchema.parse({
        exportId: 'export_1',
        backgroundJobId: 'job_1',
        extra: true,
      }),
    ).toThrow();
  });

  it('claims fresh QUEUED linked facts using database time and one transaction', async () => {
    const fixture = createFixture();
    const repository = createRepository(fixture.prisma);

    const result = await repository.claim({
      exportId: 'export_1',
      backgroundJobId: 'job_1',
    });

    expect(result).toEqual({
      kind: 'claimed',
      processingToken: expect.any(String),
      leaseExpiresAt: new Date('2026-07-10T00:05:00.000Z'),
      auditExport: expect.objectContaining({ status: 'PROCESSING' }),
    });
    expect(fixture.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(fixture.tx.operatorAuditExport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'export_1',
          backgroundJobId: 'job_1',
          status: 'QUEUED',
        }),
        data: expect.objectContaining({
          status: 'PROCESSING',
          leaseExpiresAt: new Date('2026-07-10T00:05:00.000Z'),
        }),
      }),
    );
    expect(fixture.tx.backgroundJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'job_1',
          scope: 'SYSTEM',
          userId: null,
          status: 'QUEUED',
        }),
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('reclaims an expired PROCESSING lease with a new token', async () => {
    const fixture = createFixture({
      auditExport: {
        status: 'PROCESSING',
        processingToken: 'old-token',
        leaseExpiresAt: new Date('2026-07-09T23:59:59.000Z'),
      },
      backgroundJob: { status: 'ACTIVE' },
    });
    const result = await createRepository(fixture.prisma).claim({
      exportId: 'export_1',
      backgroundJobId: 'job_1',
    });

    expect(result).toMatchObject({ kind: 'claimed' });
    if (result.kind !== 'claimed') throw new Error('expected claimed');
    expect(result.processingToken).not.toBe('old-token');
    expect(fixture.tx.operatorAuditExport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PROCESSING',
          processingToken: 'old-token',
          leaseExpiresAt: { lte: NOW },
        }),
      }),
    );
  });

  it('returns busy for a live PROCESSING lease without mutating either fact', async () => {
    const fixture = createFixture({
      auditExport: {
        status: 'PROCESSING',
        processingToken: 'live-token',
        leaseExpiresAt: LIVE_LEASE,
      },
      backgroundJob: { status: 'ACTIVE' },
    });

    await expect(
      createRepository(fixture.prisma).claim({
        exportId: 'export_1',
        backgroundJobId: 'job_1',
      }),
    ).resolves.toEqual({ kind: 'busy', leaseExpiresAt: LIVE_LEASE });
    expect(fixture.tx.operatorAuditExport.updateMany).not.toHaveBeenCalled();
    expect(fixture.tx.backgroundJob.updateMany).not.toHaveBeenCalled();
  });

  it('returns stale for mismatched SYSTEM job facts', async () => {
    const fixture = createFixture({ backgroundJob: { scope: 'ACCOUNT' } });

    await expect(
      createRepository(fixture.prisma).claim({
        exportId: 'export_1',
        backgroundJobId: 'job_1',
      }),
    ).resolves.toEqual({ kind: 'stale' });
    expect(fixture.tx.operatorAuditExport.updateMany).not.toHaveBeenCalled();
  });

  it('rolls back a claim when the linked job CAS loses', async () => {
    const fixture = createFixture();
    fixture.tx.backgroundJob.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      createRepository(fixture.prisma).claim({
        exportId: 'export_1',
        backgroundJobId: 'job_1',
      }),
    ).resolves.toEqual({ kind: 'stale' });
    expect(fixture.rolledBack).toHaveBeenCalledTimes(1);
  });

  it('renews only the current PROCESSING token and linked ACTIVE job', async () => {
    const fixture = createFixture({
      auditExport: { status: 'PROCESSING', processingToken: 'token_1' },
      backgroundJob: { status: 'ACTIVE' },
    });
    const repository = createRepository(fixture.prisma);

    await expect(repository.renewLease(tokenInput('token_1'))).resolves.toBe(
      true,
    );
    expect(fixture.tx.operatorAuditExport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PROCESSING',
          processingToken: 'token_1',
        }),
        data: { leaseExpiresAt: new Date('2026-07-10T00:05:00.000Z') },
      }),
    );
    expect(fixture.tx.backgroundJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );

    fixture.tx.operatorAuditExport.updateMany.mockResolvedValueOnce({
      count: 0,
    });
    await expect(
      repository.renewLease(tokenInput('zombie-token')),
    ).resolves.toBe(false);
  });

  it('marks retryable failure QUEUED on both facts and clears the lease', async () => {
    const fixture = processingFixture();

    await expect(
      createRepository(fixture.prisma).markRetryable({
        ...tokenInput('token_1'),
        errorCode: 'MINIO_UNAVAILABLE',
        error: new Error('Bearer secret-token'),
      }),
    ).resolves.toBe(true);

    expect(fixture.tx.operatorAuditExport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'QUEUED',
          processingToken: null,
          leaseExpiresAt: null,
          errorCode: 'MINIO_UNAVAILABLE',
          errorPreview: '[redacted]',
        }),
      }),
    );
    expect(fixture.tx.backgroundJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'QUEUED' }),
      }),
    );
  });

  it('marks terminal failure on both facts with a bounded safe preview', async () => {
    const fixture = processingFixture();

    await expect(
      createRepository(fixture.prisma).markFailed({
        ...tokenInput('token_1'),
        errorCode: 'ARCHIVE_FAILED',
        error: new Error(`QWEN_API_KEY=secret ${'x'.repeat(400)}`),
      }),
    ).resolves.toBe(true);

    const exportData = fixture.tx.operatorAuditExport.updateMany.mock
      .calls[0][0].data as Record<string, unknown>;
    expect(exportData).toMatchObject({
      status: 'FAILED',
      processingToken: null,
      leaseExpiresAt: null,
      errorCode: 'ARCHIVE_FAILED',
      completedAt: NOW,
    });
    expect(String(exportData.errorPreview)).not.toContain('secret');
    expect(String(exportData.errorPreview).length).toBeLessThanOrEqual(240);
    expect(fixture.tx.backgroundJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', finishedAt: NOW }),
      }),
    );
  });

  it('marks READY atomically with database TTL and rejects a zombie token', async () => {
    const fixture = processingFixture();
    const repository = createRepository(fixture.prisma);
    const readyInput = {
      ...tokenInput('token_1'),
      objectKey: 'operator-audit-exports/export_1/attempts/token_1.zip',
      fileName: 'safe.zip',
      archiveSize: 1024,
      recordCount: 3,
      csvSha256: `sha256:${'a'.repeat(64)}`,
      archiveSha256: `sha256:${'b'.repeat(64)}`,
    };

    await expect(repository.markReady(readyInput)).resolves.toEqual({
      kind: 'ready',
      expiresAt: new Date('2026-07-11T00:00:00.000Z'),
    });
    expect(fixture.tx.operatorAuditExport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'READY',
          objectKey: readyInput.objectKey,
          processingToken: null,
          leaseExpiresAt: null,
          expiresAt: new Date('2026-07-11T00:00:00.000Z'),
        }),
      }),
    );
    expect(fixture.tx.backgroundJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUCCEEDED', progress: 100 }),
      }),
    );

    fixture.tx.operatorAuditExport.updateMany.mockResolvedValueOnce({
      count: 0,
    });
    await expect(
      repository.markReady({ ...readyInput, processingToken: 'old-token' }),
    ).resolves.toEqual({ kind: 'lost-lease' });
  });

  it('rolls back READY when the SYSTEM job CAS loses', async () => {
    const fixture = processingFixture();
    fixture.tx.backgroundJob.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      createRepository(fixture.prisma).markReady({
        ...tokenInput('token_1'),
        objectKey: 'operator-audit-exports/export_1/attempts/token_1.zip',
        fileName: 'safe.zip',
        archiveSize: 1,
        recordCount: 0,
        csvSha256: `sha256:${'a'.repeat(64)}`,
        archiveSha256: `sha256:${'b'.repeat(64)}`,
      }),
    ).resolves.toEqual({ kind: 'lost-lease' });
    expect(fixture.rolledBack).toHaveBeenCalledTimes(1);
  });

  it('reconciles an ACK-lost READY commit only when both linked facts selected the attempt key', async () => {
    const objectKey = 'operator-audit-exports/export_1/attempts/token_1.zip';
    const fixture = createFixture({
      auditExport: {
        status: 'READY',
        processingToken: null,
        objectKey,
      },
      backgroundJob: { status: 'SUCCEEDED' },
    });

    await expect(
      createRepository(fixture.prisma).reconcileReady({
        ...tokenInput('token_1'),
        objectKey,
      }),
    ).resolves.toEqual({ kind: 'committed' });
  });

  it('distinguishes a current lease from an attempt key that is definitely unselected', async () => {
    const objectKey = 'operator-audit-exports/export_1/attempts/token_1.zip';
    const current = processingFixture();

    await expect(
      createRepository(current.prisma).reconcileReady({
        ...tokenInput('token_1'),
        objectKey,
      }),
    ).resolves.toEqual({ kind: 'current-token' });

    const newer = createFixture({
      auditExport: {
        status: 'PROCESSING',
        processingToken: 'token_2',
        objectKey: null,
      },
      backgroundJob: { status: 'ACTIVE' },
    });
    await expect(
      createRepository(newer.prisma).reconcileReady({
        ...tokenInput('token_1'),
        objectKey,
      }),
    ).resolves.toEqual({ kind: 'unselected' });
  });

  it('returns uncertain when paired facts disagree or still reference the attempt key', async () => {
    const objectKey = 'operator-audit-exports/export_1/attempts/token_1.zip';
    const fixture = createFixture({
      auditExport: {
        status: 'PROCESSING',
        processingToken: 'token_2',
        objectKey,
      },
      backgroundJob: { status: 'ACTIVE' },
    });

    await expect(
      createRepository(fixture.prisma).reconcileReady({
        ...tokenInput('token_1'),
        objectKey,
      }),
    ).resolves.toEqual({ kind: 'uncertain' });
  });

  it('proves a terminal pair did not select the current attempt key', async () => {
    const fixture = createFixture({
      auditExport: {
        status: 'FAILED',
        processingToken: null,
        objectKey: null,
      },
      backgroundJob: { status: 'FAILED' },
    });

    await expect(
      createRepository(fixture.prisma).reconcileReady({
        ...tokenInput('token_1'),
        objectKey: 'operator-audit-exports/export_1/attempts/token_1.zip',
      }),
    ).resolves.toEqual({ kind: 'unselected' });
  });
});

function createRepository(prisma: PrismaService) {
  return new OperatorAuditExportStateRepository(prisma, config());
}

function config() {
  return {
    get: jest.fn((key: string) => {
      if (key === 'OPERATOR_AUDIT_EXPORT_LEASE_MS') return 300_000;
      if (key === 'OPERATOR_AUDIT_EXPORT_TTL_HOURS') return 24;
      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as never;
}

function tokenInput(processingToken: string) {
  return {
    exportId: 'export_1',
    backgroundJobId: 'job_1',
    processingToken,
  };
}

function processingFixture() {
  return createFixture({
    auditExport: { status: 'PROCESSING', processingToken: 'token_1' },
    backgroundJob: { status: 'ACTIVE' },
  });
}

function createFixture(overrides?: {
  auditExport?: Partial<OperatorAuditExport>;
  backgroundJob?: Record<string, unknown>;
}) {
  const auditExport = {
    id: 'export_1',
    backgroundJobId: 'job_1',
    status: 'QUEUED',
    processingToken: null,
    leaseExpiresAt: null,
    ...overrides?.auditExport,
  } as OperatorAuditExport;
  const backgroundJob = {
    id: 'job_1',
    userId: null,
    scope: 'SYSTEM',
    queueName: 'operator-audit-export',
    jobName: 'generate-operator-audit-export',
    status: 'QUEUED',
    resourceType: 'OPERATOR_AUDIT_EXPORT',
    resourceId: 'export_1',
    ...overrides?.backgroundJob,
  };
  const rolledBack = jest.fn();
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ now: NOW }]),
    operatorAuditExport: {
      findUnique: jest
        .fn()
        .mockImplementation(() => Promise.resolve(auditExport)),
      updateMany: jest.fn().mockImplementation(({ data }) => {
        Object.assign(auditExport, data);
        return Promise.resolve({ count: 1 });
      }),
    },
    backgroundJob: {
      findUnique: jest.fn().mockResolvedValue(backgroundJob),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => {
      const exportSnapshot = { ...auditExport };
      const jobSnapshot = { ...backgroundJob };
      try {
        return await callback(tx);
      } catch (error) {
        Object.assign(auditExport, exportSnapshot);
        Object.assign(backgroundJob, jobSnapshot);
        rolledBack();
        throw error;
      }
    }),
  } as unknown as PrismaService;

  return { prisma, tx, auditExport, backgroundJob, rolledBack };
}
