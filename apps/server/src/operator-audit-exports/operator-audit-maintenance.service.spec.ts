/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { OperatorAuditMaintenanceService } from './operator-audit-maintenance.service';
import { createOperatorAuditExportObjectKey } from '../uploads/storage.service';

describe('OperatorAuditMaintenanceService', () => {
  const now = new Date('2026-07-10T08:00:00.000Z');

  function setup(overrides: Record<string, unknown> = {}) {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ now }]),
      operatorAuditExport: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      operatorAuditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      backgroundJob: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      outboxEvent: { findFirst: jest.fn().mockResolvedValue(null) },
      ...overrides,
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ now }]),
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      operatorAuditExport: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      operatorAuditMaintenanceState: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const storage = {
      deleteOperatorAuditExport: jest.fn().mockResolvedValue(undefined),
      listOperatorAuditExportObjects: jest.fn().mockResolvedValue([]),
    };
    const queue = { getJob: jest.fn().mockResolvedValue(null) };
    const janitor = { run: jest.fn().mockResolvedValue(0) };
    const config = {
      get: jest.fn(
        (key: string) =>
          ({
            OPERATOR_AUDIT_RETENTION_DAYS: 180,
            OPERATOR_AUDIT_EXPORT_TTL_HOURS: 24,
            OPERATOR_AUDIT_EXPORT_STALE_AFTER_MS: 3_600_000,
            OPERATOR_AUDIT_EXPORT_DELIVERY_RECOVERY_HOURS: 24,
          })[key],
      ),
    };
    return {
      service: new OperatorAuditMaintenanceService(
        prisma as never,
        storage as never,
        queue as never,
        config as never,
        janitor as never,
      ),
      prisma,
      tx,
      storage,
      queue,
      janitor,
    };
  }

  it('deletes the selected object and orphan prefix before CAS expiring READY export', async () => {
    const ctx = setup();
    ctx.prisma.operatorAuditExport.findMany.mockResolvedValueOnce([
      {
        id: 'export_1',
        status: 'READY',
        objectKey: 'operator-audit-exports/export_1/attempts/token_1.zip',
        expiresAt: now,
      },
    ]);
    ctx.storage.listOperatorAuditExportObjects.mockResolvedValueOnce([
      'operator-audit-exports/export_1/attempts/token_1.zip',
      'operator-audit-exports/export_1/attempts/orphan.zip',
    ]);

    const result = await ctx.service.run();

    expect(result.expiredExportCount).toBe(1);
    expect(ctx.storage.deleteOperatorAuditExport).toHaveBeenCalledTimes(2);
    expect(ctx.tx.operatorAuditExport.updateMany).toHaveBeenCalledWith({
      where: { id: 'export_1', status: 'READY', expiresAt: { lte: now } },
      data: { status: 'EXPIRED', objectKey: null, expiredAt: now },
    });
    expect(
      ctx.prisma.operatorAuditMaintenanceState.upsert,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: 'SUCCEEDED',
          expiredExportCount: 1,
        }),
      }),
    );
  });

  it('keeps READY metadata when storage listing is unavailable', async () => {
    const ctx = setup();
    ctx.prisma.operatorAuditExport.findMany.mockResolvedValueOnce([
      {
        id: 'export_1',
        status: 'READY',
        objectKey: 'operator-audit-exports/export_1/attempts/token_1.zip',
        expiresAt: now,
      },
    ]);
    ctx.storage.listOperatorAuditExportObjects.mockRejectedValueOnce(
      new Error('api_key=secret endpoint'),
    );

    await expect(ctx.service.run()).rejects.toThrow();
    expect(ctx.tx.operatorAuditExport.updateMany).not.toHaveBeenCalled();
    expect(
      ctx.prisma.operatorAuditMaintenanceState.upsert,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    expect(
      JSON.stringify(
        ctx.prisma.operatorAuditMaintenanceState.upsert.mock.calls,
      ),
    ).not.toContain('api_key=secret');
  });

  it('removes every object under a terminal export prefix, including a stale selected key', async () => {
    const ctx = setup();
    const selected =
      'operator-audit-exports/export_failed/attempts/token_1.zip';
    ctx.prisma.operatorAuditExport.findMany.mockImplementation(
      (args: { where?: { OR?: unknown } }) =>
        args.where?.OR
          ? Promise.resolve([
              { id: 'export_failed', status: 'FAILED', objectKey: selected },
            ])
          : Promise.resolve([]),
    );
    ctx.storage.listOperatorAuditExportObjects.mockResolvedValue([selected]);
    await ctx.service.run();
    expect(ctx.storage.deleteOperatorAuditExport).toHaveBeenCalledWith(
      selected,
    );
  });

  it('uses an active export watermark and a fresh advisory-locked transaction for each 1000-row batch', async () => {
    const ctx = setup();
    ctx.tx.operatorAuditExport.findFirst.mockResolvedValue({
      startAt: new Date('2026-01-01T00:00:00Z'),
    });
    ctx.tx.operatorAuditLog.findMany
      .mockResolvedValueOnce(
        Array.from({ length: 1000 }, (_, index) => ({ id: `audit_${index}` })),
      )
      .mockResolvedValueOnce([]);
    ctx.tx.operatorAuditLog.deleteMany.mockResolvedValueOnce({ count: 1000 });

    const result = await ctx.service.run();

    expect(result.deletedAuditCount).toBe(1000);
    expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(ctx.tx.operatorAuditLog.findMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date('2026-01-01T00:00:00.000Z') } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 1000,
      select: { id: true },
    });
  });

  it('stops audit deletion after exactly 20 batches in one run', async () => {
    const ctx = setup();
    const ids = Array.from({ length: 1000 }, (_, index) => ({
      id: `audit_${index}`,
    }));
    ctx.tx.operatorAuditLog.findMany.mockResolvedValue(ids);
    ctx.tx.operatorAuditLog.deleteMany.mockResolvedValue({ count: 1000 });
    const result = await ctx.service.run();
    expect(result.deletedAuditCount).toBe(20_000);
    expect(ctx.tx.operatorAuditLog.deleteMany).toHaveBeenCalledTimes(20);
  });

  it('deletes terminal export metadata older than retention only after its prefix is empty', async () => {
    const ctx = setup();
    ctx.prisma.operatorAuditExport.findMany.mockImplementation(
      (args: { where?: { createdAt?: unknown } }) =>
        args.where?.createdAt
          ? Promise.resolve([{ id: 'export_old' }])
          : Promise.resolve([]),
    );
    ctx.tx.operatorAuditExport.deleteMany.mockResolvedValue({ count: 1 });
    ctx.storage.listOperatorAuditExportObjects.mockResolvedValue([]);
    const result = await ctx.service.run();
    expect(result.deletedExportCount).toBe(1);
    expect(ctx.tx.operatorAuditExport.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['export_old'] },
          status: { in: ['FAILED', 'EXPIRED'] },
        }),
      }),
    );
  });

  it('preserves a DEAD delivery inside 24h and atomically fails it after 24h', async () => {
    const young = setup();
    young.prisma.operatorAuditExport.findMany.mockImplementation(
      (args: { where?: { OR?: unknown } }) =>
        args.where?.OR
          ? Promise.resolve([
              {
                id: 'export_young',
                backgroundJobId: 'job_young',
                status: 'QUEUED',
                requestedAt: new Date(now.getTime() - 23 * 3_600_000),
              },
            ])
          : Promise.resolve([]),
    );
    young.tx.outboxEvent.findFirst.mockResolvedValue({
      status: 'DEAD',
      updatedAt: new Date(now.getTime() - 23 * 3_600_000),
    });
    await young.service.run();
    expect(young.tx.operatorAuditExport.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );

    const old = setup();
    old.prisma.operatorAuditExport.findMany.mockImplementation(
      (args: { where?: { OR?: unknown } }) =>
        args.where?.OR
          ? Promise.resolve([
              {
                id: 'export_old',
                backgroundJobId: 'job_old',
                status: 'QUEUED',
                requestedAt: new Date(now.getTime() - 25 * 3_600_000),
              },
            ])
          : Promise.resolve([]),
    );
    old.tx.outboxEvent.findFirst.mockResolvedValue({
      status: 'DEAD',
      updatedAt: new Date(now.getTime() - 25 * 3_600_000),
    });
    await old.service.run();
    expect(old.tx.operatorAuditExport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'export_old', status: 'QUEUED' },
        data: expect.objectContaining({
          status: 'FAILED',
          errorCode: 'DELIVERY_ABANDONED',
        }),
      }),
    );
    expect(old.tx.backgroundJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'job_old', scope: 'SYSTEM' }),
        data: expect.objectContaining({
          status: 'FAILED',
          errorCode: 'DELIVERY_ABANDONED',
        }),
      }),
    );
  });

  it('does not fail stale PROCESSING while BullMQ is active but fails expired non-active lease', async () => {
    const active = setup();
    active.prisma.operatorAuditExport.findMany.mockImplementation(
      (args: { where?: { OR?: unknown } }) =>
        args.where?.OR
          ? Promise.resolve([
              {
                id: 'export_1',
                backgroundJobId: 'job_1',
                status: 'PROCESSING',
                startedAt: new Date(now.getTime() - 2 * 3_600_000),
                leaseExpiresAt: new Date(now.getTime() - 1),
                processingToken: 'token_1',
              },
            ])
          : Promise.resolve([]),
    );
    active.queue.getJob.mockResolvedValue({
      getState: jest.fn().mockResolvedValue('active'),
    });
    await active.service.run();
    expect(active.tx.operatorAuditExport.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );

    const stale = setup();
    stale.prisma.operatorAuditExport.findMany.mockImplementation(
      (args: { where?: { OR?: unknown } }) =>
        args.where?.OR
          ? Promise.resolve([
              {
                id: 'export_1',
                backgroundJobId: 'job_1',
                status: 'PROCESSING',
                startedAt: new Date(now.getTime() - 2 * 3_600_000),
                leaseExpiresAt: new Date(now.getTime() - 1),
                processingToken: 'token_1',
              },
            ])
          : Promise.resolve([]),
    );
    stale.queue.getJob.mockResolvedValue({
      getState: jest.fn().mockResolvedValue('failed'),
    });
    await stale.service.run();
    expect(stale.tx.operatorAuditExport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          errorCode: 'STALE_PROCESSING',
        }),
      }),
    );
  });

  it('does not clean attempt objects while a stale-looking PROCESSING Bull job is still active', async () => {
    const ctx = setup();
    ctx.prisma.operatorAuditExport.findMany.mockImplementation(
      (args: { where?: { OR?: unknown } }) =>
        args.where?.OR
          ? Promise.resolve([
              {
                id: 'export_1',
                backgroundJobId: 'job_1',
                status: 'PROCESSING',
                objectKey: null,
                startedAt: new Date(now.getTime() - 2 * 3_600_000),
                leaseExpiresAt: new Date(now.getTime() - 1),
                processingToken: 'token_1',
              },
            ])
          : Promise.resolve([]),
    );
    ctx.queue.getJob.mockResolvedValue({
      getState: jest.fn().mockResolvedValue('active'),
    });
    ctx.storage.listOperatorAuditExportObjects.mockResolvedValue([
      'operator-audit-exports/export_1/attempts/token_1.zip',
    ]);
    await ctx.service.run();
    expect(ctx.storage.deleteOperatorAuditExport).not.toHaveBeenCalled();
  });

  it('deletes only old attempts while preserving the current PROCESSING token attempt', async () => {
    const ctx = setup();
    const currentKey = createOperatorAuditExportObjectKey(
      'export_1',
      'token_current',
    );
    const oldKey = createOperatorAuditExportObjectKey('export_1', 'token_old');
    const row = {
      id: 'export_1',
      backgroundJobId: 'job_1',
      status: 'PROCESSING',
      objectKey: null,
      startedAt: new Date(now.getTime() - 2 * 3_600_000),
      leaseExpiresAt: new Date(now.getTime() - 1),
      processingToken: 'token_current',
    };
    ctx.prisma.operatorAuditExport.findMany.mockImplementation(
      (args: { where?: { OR?: unknown } }) =>
        args.where?.OR ? Promise.resolve([row]) : Promise.resolve([]),
    );
    ctx.prisma.operatorAuditExport.findUnique.mockResolvedValue(row);
    ctx.queue.getJob.mockResolvedValue({
      getState: jest.fn().mockResolvedValue('failed'),
    });
    ctx.storage.listOperatorAuditExportObjects.mockResolvedValue([
      currentKey,
      oldKey,
    ]);

    await ctx.service.run();

    expect(ctx.storage.deleteOperatorAuditExport).toHaveBeenCalledWith(oldKey);
    expect(ctx.storage.deleteOperatorAuditExport).not.toHaveBeenCalledWith(
      currentKey,
    );
  });

  it.each([
    [
      'a token switch',
      {
        processingToken: 'token_new',
        leaseExpiresAt: new Date(now.getTime() + 60_000),
      },
    ],
    [
      'a same-token lease renewal',
      {
        processingToken: 'token_current',
        leaseExpiresAt: new Date(now.getTime() + 60_000),
      },
    ],
  ])(
    'aborts PROCESSING orphan deletion after list observes %s',
    async (_label, changed) => {
      const ctx = setup();
      const currentKey = createOperatorAuditExportObjectKey(
        'export_1',
        'token_current',
      );
      const oldKey = createOperatorAuditExportObjectKey(
        'export_1',
        'token_old',
      );
      const row = {
        id: 'export_1',
        backgroundJobId: 'job_1',
        status: 'PROCESSING',
        objectKey: null,
        startedAt: new Date(now.getTime() - 2 * 3_600_000),
        leaseExpiresAt: new Date(now.getTime() - 1),
        processingToken: 'token_current',
      };
      ctx.prisma.operatorAuditExport.findMany.mockImplementation(
        (args: { where?: { OR?: unknown } }) =>
          args.where?.OR ? Promise.resolve([row]) : Promise.resolve([]),
      );
      let listed = false;
      ctx.prisma.operatorAuditExport.findUnique.mockImplementation(() =>
        Promise.resolve({
          ...row,
          ...(listed ? changed : {}),
        }),
      );
      ctx.queue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('failed'),
      });
      ctx.storage.listOperatorAuditExportObjects.mockImplementation(() => {
        listed = true;
        return Promise.resolve([currentKey, oldKey]);
      });

      await ctx.service.run();

      expect(
        ctx.storage.listOperatorAuditExportObjects.mock.invocationCallOrder[0],
      ).toBeLessThan(
        ctx.prisma.operatorAuditExport.findUnique.mock.invocationCallOrder[0],
      );
      expect(ctx.storage.deleteOperatorAuditExport).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'the same token renews its lease',
      'token_current',
      new Date(now.getTime() + 60_000),
    ],
    ['the processing token changes', 'token_new', new Date(now.getTime() - 1)],
  ])(
    'does not fail PROCESSING facts when %s before the final CAS',
    async (_label, databaseToken, databaseLeaseExpiresAt) => {
      const ctx = setup();
      const staleCutoff = new Date(now.getTime() - 3_600_000);
      const row = {
        id: 'export_1',
        backgroundJobId: 'job_1',
        status: 'PROCESSING',
        objectKey: null,
        startedAt: new Date(now.getTime() - 2 * 3_600_000),
        leaseExpiresAt: new Date(now.getTime() - 1),
        processingToken: 'token_current',
      };
      ctx.prisma.operatorAuditExport.findMany.mockImplementation(
        (args: { where?: { OR?: unknown } }) =>
          args.where?.OR ? Promise.resolve([row]) : Promise.resolve([]),
      );
      ctx.prisma.operatorAuditExport.findUnique.mockResolvedValue({
        ...row,
        processingToken: databaseToken,
        leaseExpiresAt: databaseLeaseExpiresAt,
      });
      ctx.queue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('failed'),
      });
      ctx.tx.operatorAuditExport.updateMany.mockImplementation(
        (args: {
          where?: {
            processingToken?: string;
            startedAt?: { lte?: Date };
            leaseExpiresAt?: { lte?: Date };
          };
          data?: { status?: string };
        }) => {
          if (args.data?.status !== 'FAILED')
            return Promise.resolve({ count: 1 });
          const tokenMatches =
            args.where?.processingToken === undefined ||
            args.where.processingToken === databaseToken;
          const startedAtMatches =
            args.where?.startedAt?.lte === undefined ||
            row.startedAt <= args.where.startedAt.lte;
          const leaseMatches =
            args.where?.leaseExpiresAt?.lte === undefined ||
            databaseLeaseExpiresAt <= args.where.leaseExpiresAt.lte;
          return Promise.resolve({
            count: tokenMatches && startedAtMatches && leaseMatches ? 1 : 0,
          });
        },
      );

      await ctx.service.run();

      expect(ctx.tx.operatorAuditExport.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'export_1',
          status: 'PROCESSING',
          processingToken: 'token_current',
          startedAt: { lte: staleCutoff },
          leaseExpiresAt: { lte: now },
        },
        data: {
          status: 'FAILED',
          processingToken: null,
          leaseExpiresAt: null,
          completedAt: now,
          errorCode: 'STALE_PROCESSING',
          errorPreview: 'STALE_PROCESSING',
        },
      });
      expect(ctx.tx.backgroundJob.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    },
  );
});
