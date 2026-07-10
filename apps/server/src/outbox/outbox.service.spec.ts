import { Prisma } from '@prisma/client';

import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  const now = new Date('2026-07-07T00:00:00.000Z');
  const prisma = {
    outboxEvent: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('enqueues a pending event with safe defaults', async () => {
    prisma.outboxEvent.create.mockResolvedValue(row({ status: 'PENDING' }));

    const result = await createService().enqueue({
      type: 'knowledge.document.processing.requested',
      aggregateType: 'Document',
      aggregateId: 'doc_1',
      payload: { documentId: 'doc_1' },
    });

    const createCall = firstMockArg<OutboxCreateCall>(
      prisma.outboxEvent.create,
    );
    expect(createCall.data).toMatchObject({
      type: 'knowledge.document.processing.requested',
      status: 'PENDING',
      aggregateType: 'Document',
      aggregateId: 'doc_1',
      payload: { documentId: 'doc_1' },
      maxAttempts: 5,
    });
    expect(result.status).toBe('PENDING');
  });

  it('returns existing event when idempotency key already exists', async () => {
    prisma.outboxEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.outboxEvent.findUnique.mockResolvedValue(
      row({ status: 'PENDING', idempotencyKey: 'idem_1' }),
    );

    const result = await createService().enqueue({
      type: 'knowledge.document.processing.requested',
      idempotencyKey: 'idem_1',
      payload: { documentId: 'doc_1' },
    });

    expect(prisma.outboxEvent.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: 'idem_1' },
    });
    expect(result.idempotencyKey).toBe('idem_1');
  });

  it('enqueues with only the provided transaction client and propagates failures', async () => {
    const transaction = {
      outboxEvent: {
        create: jest.fn().mockResolvedValue(row({ status: 'PENDING' })),
      },
    };
    const service = createService();
    const input = {
      type: 'operator.audit.export.requested',
      aggregateType: 'OperatorAuditExport',
      aggregateId: 'export_1',
      idempotencyKey: 'operator-audit-export-requested:export_1',
      payload: { exportId: 'export_1', backgroundJobId: 'job_1' },
    };

    await service.enqueueInTransaction(transaction as never, input);

    expect(transaction.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.findUnique).not.toHaveBeenCalled();

    const failure = new Error('transaction database down');
    transaction.outboxEvent.create.mockRejectedValueOnce(failure);
    await expect(
      service.enqueueInTransaction(transaction as never, input),
    ).rejects.toBe(failure);
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.findUnique).not.toHaveBeenCalled();
  });

  it('claims due pending events and locks them for the worker', async () => {
    prisma.outboxEvent.findMany
      .mockResolvedValueOnce([row({ id: 'evt_1', status: 'PENDING' })])
      .mockResolvedValueOnce([
        row({ id: 'evt_1', status: 'PROCESSING', lockedBy: 'worker_1' }),
      ]);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });

    const result = await createService().claimPending({
      workerId: 'worker_1',
      limit: 10,
      now,
    });

    expect(prisma.outboxEvent.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        OR: [
          { status: 'PENDING', nextRunAt: { lte: now } },
          {
            status: 'PROCESSING',
            lockedAt: { lt: new Date('2026-07-06T23:55:00.000Z') },
          },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 10,
    });
    const updateCall = firstMockArg<OutboxUpdateCall>(
      prisma.outboxEvent.updateMany,
    );
    expect(updateCall.where).toMatchObject({ id: 'evt_1' });
    expect(updateCall.data).toMatchObject({
      status: 'PROCESSING',
      lockedBy: 'worker_1',
      lockedAt: now,
      attempts: { increment: 1 },
    });
    expect(result).toHaveLength(1);
  });

  it('does not return events lost to another concurrent claimer', async () => {
    prisma.outboxEvent.findMany.mockResolvedValueOnce([
      row({ id: 'evt_1', status: 'PENDING' }),
    ]);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 0 });

    const result = await createService().claimPending({
      workerId: 'worker_1',
      limit: 10,
      now,
    });

    expect(prisma.outboxEvent.findMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('marks a worker-locked event as succeeded', async () => {
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValue(
      row({ status: 'SUCCEEDED' }),
    );

    const result = await createService().markSucceeded('evt_1', 'worker_1');

    const updateCall = firstMockArg<OutboxUpdateCall>(
      prisma.outboxEvent.updateMany,
    );
    expect(updateCall.where).toEqual({
      id: 'evt_1',
      status: 'PROCESSING',
      lockedBy: 'worker_1',
    });
    expect(updateCall.data).toMatchObject({
      status: 'SUCCEEDED',
      lockedAt: null,
      lockedBy: null,
      processedAt: now,
    });
    expect(result?.status).toBe('SUCCEEDED');
  });

  it('retries a failed event when attempts remain', async () => {
    prisma.outboxEvent.findFirst.mockResolvedValueOnce(
      row({ id: 'evt_1', status: 'PROCESSING', attempts: 1, maxAttempts: 3 }),
    );
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValueOnce(
      row({ status: 'PENDING' }),
    );

    const result = await createService().markFailedOrRetry({
      id: 'evt_1',
      workerId: 'worker_1',
      errorCode: 'HANDLER_FAILED',
      error: new Error('boom with Bearer secret-token-value'),
      now,
    });

    const updateCall = firstMockArg<OutboxUpdateCall>(
      prisma.outboxEvent.updateMany,
    );
    expect(updateCall.where).toEqual({
      id: 'evt_1',
      status: 'PROCESSING',
      lockedBy: 'worker_1',
    });
    expect(updateCall.data).toMatchObject({
      status: 'PENDING',
      lockedAt: null,
      lockedBy: null,
      lastErrorCode: 'HANDLER_FAILED',
      lastError: 'boom with [redacted]',
      nextRunAt: new Date('2026-07-07T00:00:01.000Z'),
    });
    expect(result?.status).toBe('PENDING');
  });

  it('moves a failed event to dead when max attempts is reached', async () => {
    prisma.outboxEvent.findFirst.mockResolvedValueOnce(
      row({ id: 'evt_1', status: 'PROCESSING', attempts: 3, maxAttempts: 3 }),
    );
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValueOnce(row({ status: 'DEAD' }));

    const result = await createService().markFailedOrRetry({
      id: 'evt_1',
      workerId: 'worker_1',
      errorCode: 'HANDLER_FAILED',
      error: new Error('boom'),
      now,
    });

    const updateCall = firstMockArg<OutboxUpdateCall>(
      prisma.outboxEvent.updateMany,
    );
    expect(updateCall.where).toEqual({
      id: 'evt_1',
      status: 'PROCESSING',
      lockedBy: 'worker_1',
    });
    expect(updateCall.data).toMatchObject({
      status: 'DEAD',
      lockedAt: null,
      lockedBy: null,
      processedAt: now,
    });
    expect(result?.status).toBe('DEAD');
  });

  function createService() {
    return new OutboxService(prisma as never);
  }

  type OutboxCreateCall = {
    data: Record<string, unknown>;
  };

  type OutboxUpdateCall = {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  };

  function firstMockArg<T>(mock: jest.Mock): T {
    const calls = mock.mock.calls as unknown[][];
    return calls[0]?.[0] as T;
  }

  function row(input: {
    id?: string;
    status: string;
    attempts?: number;
    maxAttempts?: number;
    lockedBy?: string | null;
    idempotencyKey?: string | null;
  }) {
    return {
      id: input.id ?? 'evt_1',
      type: 'knowledge.document.processing.requested',
      status: input.status,
      aggregateType: 'Document',
      aggregateId: 'doc_1',
      idempotencyKey: input.idempotencyKey ?? null,
      payload: { documentId: 'doc_1' },
      payloadHash: null,
      attempts: input.attempts ?? 0,
      maxAttempts: input.maxAttempts ?? 5,
      nextRunAt: now,
      lockedAt: input.lockedBy ? now : null,
      lockedBy: input.lockedBy ?? null,
      lastErrorCode: null,
      lastError: null,
      processedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }
});
