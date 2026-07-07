import { OutboxMetricsService } from './outbox-metrics.service';

describe('OutboxMetricsService', () => {
  const now = new Date('2026-07-07T03:00:00.000Z');
  const prisma = {
    outboxEvent: {
      groupBy: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.outboxEvent.groupBy.mockResolvedValue([]);
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.findMany.mockResolvedValue([]);
  });

  it('summarizes outbox counts and backlog', async () => {
    prisma.outboxEvent.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { _all: 2 } },
      { status: 'PROCESSING', _count: { _all: 1 } },
      { status: 'SUCCEEDED', _count: { _all: 5 } },
      { status: 'DEAD', _count: { _all: 1 } },
    ]);

    const result = await createService().getSummary(now);

    expect(result.counts).toEqual({
      pending: 2,
      processing: 1,
      succeeded: 5,
      failed: 0,
      dead: 1,
      total: 9,
    });
    expect(result.hasBacklog).toBe(true);
  });

  it('computes oldest pending age in milliseconds', async () => {
    prisma.outboxEvent.findFirst.mockResolvedValue({
      id: 'evt_old',
      createdAt: new Date('2026-07-07T02:59:30.000Z'),
    });

    const result = await createService().getSummary(now);

    expect(result.oldestPendingAgeMs).toBe(30000);
  });

  it('returns null oldest pending age when no pending event exists', async () => {
    const result = await createService().getSummary(now);

    expect(result.oldestPendingAgeMs).toBeNull();
  });

  it('returns only safe recent error fields', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 'evt_1',
        type: 'knowledge.document.processing.requested',
        status: 'DEAD',
        lastErrorCode: 'OUTBOX_INVALID_PAYLOAD',
        lastError: 'secret should not leave service',
        aggregateId: 'doc_secret',
        payload: { prompt: 'do not leak' },
        attempts: 5,
        maxAttempts: 5,
        updatedAt: new Date('2026-07-07T03:00:00.000Z'),
      },
    ]);

    const result = await createService().getSummary(now);

    expect(result.recentErrors).toEqual([
      {
        id: 'evt_1',
        type: 'knowledge.document.processing.requested',
        status: 'DEAD',
        lastErrorCode: 'OUTBOX_INVALID_PAYLOAD',
        attempts: 5,
        maxAttempts: 5,
        updatedAt: '2026-07-07T03:00:00.000Z',
      },
    ]);
    expect(JSON.stringify(result.recentErrors)).not.toContain('secret');
    expect(JSON.stringify(result.recentErrors)).not.toContain('doc_secret');
    expect(JSON.stringify(result.recentErrors)).not.toContain('prompt');
  });

  function createService() {
    return new OutboxMetricsService(prisma as never);
  }
});
