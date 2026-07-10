import { Prisma } from '@prisma/client';
import type { OperatorAuditExportCreateRequest } from '@repo/types/api/operator-audit-export';

import type { EnqueueOutboxEventInput } from '../outbox/outbox.service';
import { OperatorAuditExportRequestService } from './operator-audit-export-request.service';

describe('OperatorAuditExportRequestService', () => {
  const databaseNow = new Date('2026-07-10T12:00:00.000Z');
  const queue = { add: jest.fn() };
  const operationOrder: string[] = [];
  let lockIndex = 0;
  let currentDatabaseNow = databaseNow;
  let savedExport: ReturnType<typeof exportRow> | null;

  const transaction = {
    $executeRaw: jest.fn(() => {
      lockIndex += 1;
      if (lockIndex % 2 === 1) {
        operationOrder.push('retention-lock');
      } else {
        operationOrder.push('quota-lock');
      }
      return Promise.resolve(1);
    }),
    $queryRaw: jest.fn(() => {
      operationOrder.push('database-now');
      return Promise.resolve([{ now: currentDatabaseNow }]);
    }),
    operatorAuditExport: {
      findUnique: jest.fn(() => Promise.resolve(savedExport)),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        operationOrder.push('export-create');
        savedExport = exportRow(data);
        return Promise.resolve(savedExport);
      }),
    },
    backgroundJob: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        operationOrder.push('background-job-create');
        return Promise.resolve({ ...data, id: data.id as string });
      }),
    },
    outboxEvent: {
      create: jest.fn(),
    },
    operatorAuditLog: {
      create: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, number | string> = {
        OPERATOR_AUDIT_RETENTION_DAYS: 180,
        OPERATOR_AUDIT_EXPORT_MAX_RANGE_DAYS: 31,
        OPERATOR_AUDIT_EXPORT_PER_ADMIN_ACTIVE_LIMIT: 2,
        OPERATOR_AUDIT_EXPORT_PER_ADMIN_HOURLY_LIMIT: 10,
        OPERATOR_AUDIT_EXPORT_GLOBAL_ACTIVE_LIMIT: 10,
      };
      return values[key];
    }),
  };
  const outbox = {
    enqueueInTransaction: jest.fn<
      Promise<Record<string, unknown>>,
      [unknown, EnqueueOutboxEventInput]
    >((_client, input) => {
      operationOrder.push('outbox-create');
      return Promise.resolve({ id: 'outbox_1', ...input });
    }),
  };
  const audit = {
    recordSuccessStrict: jest.fn(() => {
      operationOrder.push('audit-create');
      return Promise.resolve();
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    operationOrder.length = 0;
    lockIndex = 0;
    currentDatabaseNow = databaseNow;
    savedExport = null;
    transaction.operatorAuditExport.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    outbox.enqueueInTransaction.mockImplementation((_client, input) => {
      operationOrder.push('outbox-create');
      return Promise.resolve({ id: 'outbox_1', ...input });
    });
    audit.recordSuccessStrict.mockReset().mockImplementation(() => {
      operationOrder.push('audit-create');
      return Promise.resolve();
    });
  });

  it('atomically creates the export, SYSTEM job, outbox event, and strict audit in order', async () => {
    const result = await createService().create(
      'user_admin',
      createInput({
        reason: '  INC-2026-0710 evidence review  ',
        targetType: '  OutboxEvent  ',
        targetId: '  evt_1  ',
        actorUserId: '  user_actor  ',
      }),
      createRequest(),
    );

    expect(operationOrder).toEqual([
      'retention-lock',
      'quota-lock',
      'database-now',
      'export-create',
      'background-job-create',
      'outbox-create',
      'audit-create',
    ]);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    const createdExport = firstCreateData(
      transaction.operatorAuditExport.create,
    );
    const createdBackgroundJob = firstCreateData(
      transaction.backgroundJob.create,
    );
    expect(createdExport.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(createdExport.backgroundJobId).toMatch(/^[0-9a-f-]{36}$/);
    expect(createdExport).toMatchObject({
      requestedByUserId: 'user_admin',
      status: 'QUEUED',
      startAt: new Date('2026-07-01T00:00:00.000Z'),
      endAt: new Date('2026-07-10T00:00:00.000Z'),
      snapshotAt: databaseNow,
      filterAction: 'OUTBOX_REQUEUE',
      filterStatus: 'FAILED',
      filterTargetType: 'OutboxEvent',
      filterTargetId: 'evt_1',
      filterActorUserId: 'user_actor',
      reason: 'INC-2026-0710 evidence review',
    });
    expect(createdExport.requestHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(createdBackgroundJob).toMatchObject({
      id: createdExport.backgroundJobId,
      scope: 'SYSTEM',
      userId: null,
      queueName: 'operator-audit-export',
      jobName: 'generate-operator-audit-export',
      status: 'QUEUED',
      resourceType: 'OPERATOR_AUDIT_EXPORT',
      resourceId: createdExport.id,
    });
    expect(outbox.enqueueInTransaction).toHaveBeenCalledWith(transaction, {
      type: 'operator.audit.export.requested',
      aggregateType: 'OperatorAuditExport',
      aggregateId: createdExport.id,
      idempotencyKey: `operator-audit-export-requested:${String(createdExport.id)}`,
      payload: {
        exportId: createdExport.id,
        backgroundJobId: createdBackgroundJob.id,
      },
    });
    expect(audit.recordSuccessStrict).toHaveBeenCalledWith(transaction, {
      actorUserId: 'user_admin',
      action: 'AUDIT_EXPORT_REQUEST',
      targetType: 'OperatorAuditExport',
      targetId: createdExport.id,
      reason: 'INC-2026-0710 evidence review',
      request: createRequest(),
      now: databaseNow,
    });
    expect(queue.add).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: createdExport.id,
      requestedByUserId: 'user_admin',
      backgroundJobId: createdBackgroundJob.id,
      status: 'QUEUED',
      filters: {
        action: 'OUTBOX_REQUEUE',
        status: 'FAILED',
        targetType: 'OutboxEvent',
        targetId: 'evt_1',
        actorUserId: 'user_actor',
      },
      canDownload: false,
    });
    expect(JSON.stringify(result)).not.toContain('requestHash');
  });

  it('maps strict request audit failure to safe 503 while Prisma rolls back every fact', async () => {
    const failure = new Error(
      'audit database down password=private-database-secret',
    );
    const transactionEvents: string[] = [];
    audit.recordSuccessStrict.mockRejectedValue(failure);
    prisma.$transaction.mockImplementationOnce(async (callback) => {
      transactionEvents.push('begin');
      try {
        return await callback(transaction);
      } catch (error) {
        transactionEvents.push('rollback');
        throw error;
      }
    });

    const error: unknown = await createService()
      .create('user_admin', createInput(), createRequest())
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      code: 'OPERATOR_AUDIT_EXPORT_AUDIT_FAILED',
      statusCode: 503,
      message: 'Operator audit export request audit failed',
    });
    if (error instanceof Error) {
      expect(error.message).not.toContain('private-database-secret');
    }

    expect(transactionEvents).toEqual(['begin', 'rollback']);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.operatorAuditExport.create).toHaveBeenCalledTimes(1);
    expect(transaction.backgroundJob.create).toHaveBeenCalledTimes(1);
    expect(outbox.enqueueInTransaction).toHaveBeenCalledTimes(1);
    expect(audit.recordSuccessStrict).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: 'Prisma P2034',
      failure: knownPrismaError('P2034'),
    },
    {
      name: 'raw PostgreSQL 40001',
      failure: { code: '40001' },
    },
  ])(
    'retries the complete transaction when strict audit fails with $name',
    async ({ failure }) => {
      const transactionEvents: string[] = [];
      let attempt = 0;
      audit.recordSuccessStrict
        .mockRejectedValueOnce(failure)
        .mockImplementationOnce(() => {
          operationOrder.push('audit-create');
          return Promise.resolve();
        });
      prisma.$transaction.mockImplementation(async (callback) => {
        attempt += 1;
        transactionEvents.push(`begin:${attempt}`);
        try {
          const result = await callback(transaction);
          transactionEvents.push(`commit:${attempt}`);
          return result;
        } catch (error) {
          transactionEvents.push(`rollback:${attempt}`);
          savedExport = null;
          throw error;
        }
      });

      await expect(
        createService().create('user_admin', createInput(), createRequest()),
      ).resolves.toMatchObject({ status: 'QUEUED' });

      expect(transactionEvents).toEqual([
        'begin:1',
        'rollback:1',
        'begin:2',
        'commit:2',
      ]);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(transaction.$executeRaw).toHaveBeenCalledTimes(4);
      expect(transaction.$queryRaw).toHaveBeenCalledTimes(2);
      expect(transaction.operatorAuditExport.create).toHaveBeenCalledTimes(2);
      expect(transaction.backgroundJob.create).toHaveBeenCalledTimes(2);
      expect(outbox.enqueueInTransaction).toHaveBeenCalledTimes(2);
      expect(audit.recordSuccessStrict).toHaveBeenCalledTimes(2);
    },
  );

  it('retries the complete Serializable transaction after Prisma P2034 and reuses generated ids', async () => {
    const failure = knownPrismaError('P2034');
    let attempt = 0;
    prisma.$transaction.mockImplementation(async (callback) => {
      attempt += 1;
      const result = await callback(transaction);
      if (attempt === 1) {
        savedExport = null;
        throw failure;
      }
      return result;
    });

    await expect(
      createService().create('user_admin', createInput(), createRequest()),
    ).resolves.toMatchObject({ status: 'QUEUED' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(4);
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(2);
    expect(transaction.operatorAuditExport.create).toHaveBeenCalledTimes(2);
    const exportCreates = allCreateData(transaction.operatorAuditExport.create);
    const backgroundJobCreates = allCreateData(
      transaction.backgroundJob.create,
    );
    expect(new Set(exportCreates.map((data) => data.id)).size).toBe(1);
    expect(new Set(backgroundJobCreates.map((data) => data.id)).size).toBe(1);
    expect(exportCreates[0]?.backgroundJobId).toBe(backgroundJobCreates[0]?.id);
  });

  it('retries the complete transaction after raw PostgreSQL serialization failure 40001', async () => {
    const failure = Object.assign(new Error('serialization failure'), {
      code: '40001',
    });
    let attempt = 0;
    prisma.$transaction.mockImplementation(async (callback) => {
      attempt += 1;
      const result = await callback(transaction);
      if (attempt === 1) {
        savedExport = null;
        throw failure;
      }
      return result;
    });

    await expect(
      createService().create('user_admin', createInput(), createRequest()),
    ).resolves.toMatchObject({ status: 'QUEUED' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(4);
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('retries the export idempotency composite P2002 and returns the committed same-hash export', async () => {
    const failure = knownPrismaError('P2002', {
      modelName: 'OperatorAuditExport',
      target: ['requestedByUserId', 'clientRequestId'],
    });
    let attempt = 0;
    prisma.$transaction.mockImplementation(async (callback) => {
      attempt += 1;
      const result = await callback(transaction);
      if (attempt === 1) throw failure;
      return result;
    });

    const result = await createService().create(
      'user_admin',
      createInput(),
      createRequest(),
    );

    expect(result.id).toBe(savedExport?.id);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(transaction.operatorAuditExport.create).toHaveBeenCalledTimes(1);
    expect(transaction.backgroundJob.create).toHaveBeenCalledTimes(1);
    expect(outbox.enqueueInTransaction).toHaveBeenCalledTimes(1);
    expect(audit.recordSuccessStrict).toHaveBeenCalledTimes(1);
  });

  it('retries the export idempotency composite P2002 and returns 409 for a different hash', async () => {
    const failure = knownPrismaError('P2002', {
      modelName: 'OperatorAuditExport',
      target: ['requestedByUserId', 'clientRequestId'],
    });
    let attempt = 0;
    prisma.$transaction.mockImplementation(async (callback) => {
      attempt += 1;
      const result = await callback(transaction);
      if (attempt === 1) {
        savedExport = savedExport
          ? { ...savedExport, requestHash: `sha256:${'0'.repeat(64)}` }
          : null;
        throw failure;
      }
      return result;
    });

    await expect(
      createService().create('user_admin', createInput(), createRequest()),
    ).rejects.toMatchObject({
      code: 'OPERATOR_AUDIT_EXPORT_IDEMPOTENCY_CONFLICT',
      statusCode: 409,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(transaction.operatorAuditExport.create).toHaveBeenCalledTimes(1);
    expect(audit.recordSuccessStrict).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-retryable failures or unrelated P2002 targets', async () => {
    const databaseFailure = new Error('database unavailable');
    prisma.$transaction.mockRejectedValueOnce(databaseFailure);

    await expect(
      createService().create('user_admin', createInput(), createRequest()),
    ).rejects.toBe(databaseFailure);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    const unrelatedUniqueFailure = knownPrismaError('P2002', {
      modelName: 'OperatorAuditExport',
      target: ['backgroundJobId'],
    });
    prisma.$transaction.mockRejectedValueOnce(unrelatedUniqueFailure);

    await expect(
      createService().create('user_admin', createInput(), createRequest()),
    ).rejects.toBe(unrelatedUniqueFailure);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('stops after five retryable transaction failures and rethrows the original failure', async () => {
    const failure = knownPrismaError('P2034');
    prisma.$transaction.mockRejectedValue(failure);

    await expect(
      createService().create('user_admin', createInput(), createRequest()),
    ).rejects.toBe(failure);
    expect(prisma.$transaction).toHaveBeenCalledTimes(5);
  });

  it('replays the same actor and clientRequestId with the same request hash without a second audit', async () => {
    const service = createService();
    const input = createInput();

    const first = await service.create('user_admin', input, createRequest());
    const second = await service.create('user_admin', input, createRequest());

    expect(second).toEqual(first);
    expect(transaction.operatorAuditExport.create).toHaveBeenCalledTimes(1);
    expect(transaction.backgroundJob.create).toHaveBeenCalledTimes(1);
    expect(outbox.enqueueInTransaction).toHaveBeenCalledTimes(1);
    expect(audit.recordSuccessStrict).toHaveBeenCalledTimes(1);
    expect(transaction.operatorAuditExport.count).toHaveBeenCalledTimes(3);
  });

  it('replays the same hash after the rolling retention window moves past the original request', async () => {
    const service = createService();
    const input = createInput();
    const first = await service.create('user_admin', input, createRequest());
    currentDatabaseNow = new Date('2027-01-10T12:00:00.000Z');

    const replay = await service.create('user_admin', input, createRequest());

    expect(replay).toEqual(first);
    expect(transaction.operatorAuditExport.count).toHaveBeenCalledTimes(3);
    expect(transaction.operatorAuditExport.create).toHaveBeenCalledTimes(1);
    expect(transaction.backgroundJob.create).toHaveBeenCalledTimes(1);
    expect(outbox.enqueueInTransaction).toHaveBeenCalledTimes(1);
    expect(audit.recordSuccessStrict).toHaveBeenCalledTimes(1);
  });

  it('returns idempotency conflict before rolling-window validation after clock drift', async () => {
    const service = createService();
    const input = createInput();
    await service.create('user_admin', input, createRequest());
    currentDatabaseNow = new Date('2027-01-10T12:00:00.000Z');

    await expect(
      service.create(
        'user_admin',
        { ...input, reason: 'different normalized request' },
        createRequest(),
      ),
    ).rejects.toMatchObject({
      code: 'OPERATOR_AUDIT_EXPORT_IDEMPOTENCY_CONFLICT',
      statusCode: 409,
    });
    expect(transaction.operatorAuditExport.count).toHaveBeenCalledTimes(3);
    expect(transaction.operatorAuditExport.create).toHaveBeenCalledTimes(1);
    expect(transaction.backgroundJob.create).toHaveBeenCalledTimes(1);
    expect(outbox.enqueueInTransaction).toHaveBeenCalledTimes(1);
    expect(audit.recordSuccessStrict).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of clientRequestId for a different normalized request', async () => {
    savedExport = exportRow({
      requestHash: `sha256:${'0'.repeat(64)}`,
      clientRequestId: createInput().clientRequestId,
    });

    await expect(
      createService().create('user_admin', createInput(), createRequest()),
    ).rejects.toMatchObject({
      code: 'OPERATOR_AUDIT_EXPORT_IDEMPOTENCY_CONFLICT',
      statusCode: 409,
    });
    expect(transaction.operatorAuditExport.count).not.toHaveBeenCalled();
    expect(audit.recordSuccessStrict).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'start equal to end',
      input: { startAt: '2026-07-10T00:00:00.000Z' },
    },
    {
      name: 'start later than end',
      input: { startAt: '2026-07-10T00:00:00.001Z' },
    },
    {
      name: 'more than the configured 31 day range',
      input: {
        startAt: '2026-05-31T23:59:59.999Z',
        endAt: '2026-07-02T00:00:00.000Z',
      },
    },
    {
      name: 'before the database retention boundary',
      input: { startAt: '2026-01-11T11:59:59.999Z' },
    },
    {
      name: 'ending after database time',
      input: { endAt: '2026-07-10T12:00:00.001Z' },
    },
  ])('rejects an invalid request window: $name', async ({ input }) => {
    await expect(
      createService().create('user_admin', createInput(input), createRequest()),
    ).rejects.toMatchObject({
      code: 'OPERATOR_AUDIT_EXPORT_INVALID_REQUEST',
      statusCode: 400,
    });
    expect(transaction.operatorAuditExport.findUnique).toHaveBeenCalledTimes(1);
    expect(transaction.operatorAuditExport.count).not.toHaveBeenCalled();
    expect(transaction.operatorAuditExport.create).not.toHaveBeenCalled();
  });

  it('accepts a range exactly on the 31-day and retention boundaries', async () => {
    await expect(
      createService().create(
        'user_admin',
        createInput({
          startAt: '2026-01-11T12:00:00.000Z',
          endAt: '2026-02-11T12:00:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({ status: 'QUEUED' });
  });

  it.each([
    { name: 'per-admin active', counts: [2], expectedCalls: 1 },
    { name: 'per-admin hourly', counts: [0, 10], expectedCalls: 2 },
    { name: 'global active', counts: [0, 0, 10], expectedCalls: 3 },
  ])('enforces the $name export quota', async ({ counts, expectedCalls }) => {
    transaction.operatorAuditExport.count.mockReset();
    for (const count of counts) {
      transaction.operatorAuditExport.count.mockResolvedValueOnce(count);
    }

    await expect(
      createService().create('user_admin', createInput(), createRequest()),
    ).rejects.toMatchObject({
      code: 'OPERATOR_AUDIT_EXPORT_LIMIT_REACHED',
      statusCode: 429,
    });
    expect(transaction.operatorAuditExport.count).toHaveBeenCalledTimes(
      expectedCalls,
    );
    expect(transaction.operatorAuditExport.create).not.toHaveBeenCalled();
  });

  it('checks idempotency before quota counts and has no direct Queue dependency', async () => {
    savedExport = exportRow({ requestHash: `sha256:${'0'.repeat(64)}` });
    const service = createService();

    await expect(
      service.create('user_admin', createInput(), createRequest()),
    ).rejects.toMatchObject({
      code: 'OPERATOR_AUDIT_EXPORT_IDEMPOTENCY_CONFLICT',
    });

    expect(transaction.operatorAuditExport.count).not.toHaveBeenCalled();
    expect(service).not.toHaveProperty('queue');
    expect(queue.add).not.toHaveBeenCalled();
  });

  function createService() {
    return new OperatorAuditExportRequestService(
      prisma as never,
      config as never,
      outbox as never,
      audit as never,
    );
  }

  function createInput(
    overrides: Partial<OperatorAuditExportCreateRequest> = {},
  ): OperatorAuditExportCreateRequest {
    return {
      clientRequestId: '1f01912c-7a3e-4e90-a26d-e49c9a314f63',
      startAt: '2026-07-01T00:00:00.000Z',
      endAt: '2026-07-10T00:00:00.000Z',
      reason: 'INC-2026-0710 evidence review',
      action: 'OUTBOX_REQUEUE',
      status: 'FAILED',
      targetType: 'OutboxEvent',
      targetId: 'evt_1',
      actorUserId: 'user_actor',
      ...overrides,
    };
  }

  function createRequest() {
    return {
      requestId: 'req_1',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Playwright' },
    };
  }

  function firstCreateData(mock: jest.Mock) {
    const calls = mock.mock.calls as unknown[][];
    return (calls[0]?.[0] as { data: Record<string, unknown> }).data;
  }

  function allCreateData(mock: jest.Mock) {
    const calls = mock.mock.calls as unknown[][];
    return calls.map(
      (call) => (call[0] as { data: Record<string, unknown> }).data,
    );
  }

  function knownPrismaError(code: string, meta?: Record<string, unknown>) {
    return new Prisma.PrismaClientKnownRequestError('Prisma operation failed', {
      code,
      clientVersion: 'test',
      meta,
    });
  }

  function exportRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'export_1',
      requestedByUserId: 'user_admin',
      clientRequestId: createInput().clientRequestId,
      requestHash: `sha256:${'a'.repeat(64)}`,
      backgroundJobId: 'job_1',
      status: 'QUEUED' as const,
      startAt: new Date('2026-07-01T00:00:00.000Z'),
      endAt: new Date('2026-07-10T00:00:00.000Z'),
      snapshotAt: databaseNow,
      filterAction: 'OUTBOX_REQUEUE' as const,
      filterStatus: 'FAILED' as const,
      filterTargetType: 'OutboxEvent',
      filterTargetId: 'evt_1',
      filterActorUserId: 'user_actor',
      reason: 'INC-2026-0710 evidence review',
      objectKey: null,
      fileName: null,
      archiveSize: null,
      recordCount: null,
      csvSha256: null,
      archiveSha256: null,
      schemaVersion: 1,
      errorCode: null,
      errorPreview: null,
      processingToken: null,
      leaseExpiresAt: null,
      requestedAt: databaseNow,
      startedAt: null,
      completedAt: null,
      expiresAt: null,
      expiredAt: null,
      createdAt: databaseNow,
      updatedAt: databaseNow,
      ...overrides,
    };
  }
});
