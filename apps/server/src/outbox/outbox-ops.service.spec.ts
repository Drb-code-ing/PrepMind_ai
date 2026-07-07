import { HttpStatus } from '@nestjs/common';

import { OutboxOpsService } from './outbox-ops.service';

const objectContaining = <T extends object>(value: T) =>
  expect.objectContaining(value) as unknown as T;

describe('OutboxOpsService', () => {
  const now = new Date('2026-07-07T10:00:00.000Z');
  const prisma = {
    outboxEvent: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists sanitized outbox events without payload or aggregate id', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      row({ id: 'evt_2', status: 'DEAD', lastError: 'Bearer secret-token' }),
    ]);

    const result = await createService().list({ limit: 20 });

    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 21,
      select: objectContaining({
        payload: true,
        aggregateId: false,
      }),
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'evt_2',
        hasPayload: true,
        hasLastError: true,
        canRequeue: true,
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('secret-token');
    expect(JSON.stringify(result)).not.toContain('doc_1');
    expect(result.nextCursor).toBeNull();
  });

  it('applies status, type, and cursor filters', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([]);

    await createService().list({
      status: 'FAILED',
      type: 'knowledge.document.processing.requested',
      limit: 10,
      cursor: 'evt_9',
    });

    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'FAILED',
          type: 'knowledge.document.processing.requested',
          id: { lt: 'evt_9' },
        },
        take: 11,
      }),
    );
  });

  it('returns nextCursor when there are more rows than the requested limit', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      row({ id: 'evt_3' }),
      row({ id: 'evt_2' }),
      row({ id: 'evt_1' }),
    ]);

    const result = await createService().list({ limit: 2 });

    expect(result.items.map((item) => item.id)).toEqual(['evt_3', 'evt_2']);
    expect(result.nextCursor).toBe('evt_2');
  });

  it('returns sanitized event detail with redacted error preview', async () => {
    prisma.outboxEvent.findFirst.mockResolvedValue(
      row({
        id: 'evt_1',
        status: 'DEAD',
        lastError: 'provider failed with Bearer secret-token-value',
      }),
    );

    const result = await createService().getDetail('evt_1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'evt_1',
        lastErrorPreview: 'provider failed with [redacted]',
        payloadHash: 'sha256:payload',
      }),
    );
    expect(JSON.stringify(result)).not.toContain('secret-token-value');
  });

  it('throws not found when detail row is missing', async () => {
    prisma.outboxEvent.findFirst.mockResolvedValue(null);

    await expect(createService().getDetail('missing')).rejects.toMatchObject({
      code: 'OUTBOX_EVENT_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  });

  it('requeues failed and dead events to pending without executing handlers', async () => {
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValue(
      row({ id: 'evt_1', status: 'PENDING', attempts: 0 }),
    );

    const result = await createService().requeue('evt_1', now);

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'evt_1', status: { in: ['FAILED', 'DEAD'] } },
      data: {
        status: 'PENDING',
        attempts: 0,
        lockedAt: null,
        lockedBy: null,
        processedAt: null,
        nextRunAt: now,
      },
    });
    expect(result.status).toBe('PENDING');
    expect(result.canRequeue).toBe(false);
  });

  it('rejects requeue for non-requeueable statuses', async () => {
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 0 });
    prisma.outboxEvent.findFirst.mockResolvedValue(
      row({ id: 'evt_1', status: 'PROCESSING' }),
    );

    await expect(createService().requeue('evt_1', now)).rejects.toMatchObject({
      code: 'OUTBOX_EVENT_NOT_REQUEUEABLE',
      statusCode: HttpStatus.CONFLICT,
    });
  });

  it('returns conflict when requeue loses the transition race', async () => {
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 0 });
    prisma.outboxEvent.findFirst
      .mockResolvedValueOnce(row({ id: 'evt_1', status: 'DEAD' }))
      .mockResolvedValueOnce(row({ id: 'evt_1', status: 'DEAD' }));

    await expect(createService().requeue('evt_1', now)).rejects.toMatchObject({
      code: 'OUTBOX_EVENT_REQUEUE_CONFLICT',
      statusCode: HttpStatus.CONFLICT,
    });
  });

  function createService() {
    return new OutboxOpsService(prisma as never);
  }

  function row(
    overrides: Partial<{
      id: string;
      status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'DEAD';
      attempts: number;
      lastError: string | null;
    }> = {},
  ) {
    return {
      id: overrides.id ?? 'evt_1',
      type: 'knowledge.document.processing.requested',
      status: overrides.status ?? 'FAILED',
      attempts: overrides.attempts ?? 3,
      maxAttempts: 5,
      nextRunAt: now,
      lockedAt: null,
      lockedBy: null,
      processedAt: null,
      lastErrorCode: 'OUTBOX_HANDLER_FAILED',
      lastError: overrides.lastError ?? 'provider failed',
      createdAt: now,
      updatedAt: now,
      payload: { documentId: 'doc_1' },
      payloadHash: 'sha256:payload',
    };
  }
});
