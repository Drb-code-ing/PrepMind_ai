import { HttpStatus } from '@nestjs/common';

import { AppError } from '../common/errors/app-error';
import { OperatorAuditExportQueryService } from './operator-audit-export-query.service';

describe('OperatorAuditExportQueryService', () => {
  const databaseNow = new Date('2026-07-11T12:00:00.000Z');
  const operatorAuditExport = {
    findMany: jest.fn<(options: unknown) => Promise<unknown[]>>(),
    findFirst: jest.fn<(options: unknown) => Promise<unknown>>(),
  };
  const prisma = {
    operatorAuditExport,
    $queryRaw: jest.fn().mockResolvedValue([{ now: databaseNow }]),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ now: databaseNow }]);
  });

  it('lists system-wide exports with a safe projection and database-time download eligibility', async () => {
    operatorAuditExport.findMany.mockResolvedValue([
      exportRow({
        id: 'export_admin_a',
        requestedByUserId: 'admin_a',
        status: 'READY',
        expiresAt: new Date('2026-07-11T12:00:01.000Z'),
      }),
      exportRow({
        id: 'export_admin_b',
        requestedByUserId: 'admin_b',
        status: 'READY',
        expiresAt: new Date('2026-07-11T12:00:00.000Z'),
      }),
    ]);

    const result = await createService().list({ limit: 20 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(operatorAuditExport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 21,
      }),
    );
    const listCalls = JSON.stringify(operatorAuditExport.findMany.mock.calls);
    expect(listCalls).toContain('"objectKey":true');
    expect(listCalls).toContain('"requestHash":false');
    expect(listCalls).toContain('"processingToken":false');
    expect(listCalls).toContain('"leaseExpiresAt":false');
    expect(
      JSON.stringify(operatorAuditExport.findMany.mock.calls),
    ).not.toContain('currentAdmin');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: 'export_admin_a',
      requestedByUserId: 'admin_a',
      filters: {
        action: 'OUTBOX_REQUEUE',
        status: 'FAILED',
        targetType: 'OutboxEvent',
        targetId: 'evt_1',
        actorUserId: 'actor_1',
      },
      canDownload: true,
    });
    expect(result.items[1]?.canDownload).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(
      /objectKey|requestHash|processingToken|leaseExpiresAt|payload|metadata|secret|cookie/i,
    );
  });

  it('uses a createdAt/id predicate for stable cursor pagination and creation filters', async () => {
    const cursorCreatedAt = new Date('2026-07-10T10:00:00.000Z');
    operatorAuditExport.findFirst.mockResolvedValue({
      id: 'cursor_export',
      createdAt: cursorCreatedAt,
    });
    operatorAuditExport.findMany.mockResolvedValue([]);

    await createService().list({
      status: 'FAILED',
      requestedByUserId: 'admin_a',
      createdFrom: '2026-07-01T00:00:00.000Z',
      createdTo: '2026-07-11T00:00:00.000Z',
      cursor: 'cursor_export',
      limit: 7,
    });

    expect(operatorAuditExport.findFirst).toHaveBeenCalledWith({
      where: { id: 'cursor_export' },
      select: { id: true, createdAt: true },
    });
    expect(operatorAuditExport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'FAILED',
          requestedByUserId: 'admin_a',
          createdAt: {
            gte: new Date('2026-07-01T00:00:00.000Z'),
            lte: new Date('2026-07-11T00:00:00.000Z'),
          },
          OR: [
            { createdAt: { lt: cursorCreatedAt } },
            { createdAt: cursorCreatedAt, id: { lt: 'cursor_export' } },
          ],
        },
        take: 8,
      }),
    );
  });

  it('returns the last visible id as next cursor without exposing internal fields', async () => {
    operatorAuditExport.findMany.mockResolvedValue([
      exportRow({ id: 'export_3' }),
      exportRow({ id: 'export_2' }),
      exportRow({ id: 'export_1' }),
    ]);

    const result = await createService().list({ limit: 2 });

    expect(result.items.map((item) => item.id)).toEqual([
      'export_3',
      'export_2',
    ]);
    expect(result.nextCursor).toBe('export_2');
  });

  it('returns an impossible predicate for an unknown cursor', async () => {
    operatorAuditExport.findFirst.mockResolvedValue(null);
    operatorAuditExport.findMany.mockResolvedValue([]);

    await createService().list({ cursor: 'missing_cursor', limit: 20 });

    expect(operatorAuditExport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ id: 'missing_cursor' }, { id: { not: 'missing_cursor' } }],
        },
      }),
    );
  });

  it('gets a cross-admin detail with one database clock read and no internals', async () => {
    operatorAuditExport.findFirst.mockResolvedValue(
      exportRow({ requestedByUserId: 'admin_a' }),
    );

    const result = await createService().getDetail('export_1');

    expect(operatorAuditExport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'export_1' } }),
    );
    const detailCalls = JSON.stringify(
      operatorAuditExport.findFirst.mock.calls,
    );
    expect(detailCalls).toContain('"objectKey":true');
    expect(detailCalls).toContain('"requestHash":false');
    expect(detailCalls).toContain('"processingToken":false');
    expect(detailCalls).toContain('"leaseExpiresAt":false');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.requestedByUserId).toBe('admin_a');
    expect(JSON.stringify(result)).not.toMatch(
      /objectKey|requestHash|processingToken|leaseExpiresAt|payload|metadata|secret|cookie/i,
    );
  });

  it('returns a safe 404 for an unknown export', async () => {
    operatorAuditExport.findFirst.mockResolvedValue(null);

    const error: unknown = await createService()
      .getDetail('missing')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: 'OPERATOR_AUDIT_EXPORT_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  function createService() {
    return new OperatorAuditExportQueryService(prisma as never);
  }

  function exportRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'export_1',
      requestedByUserId: 'admin_a',
      backgroundJobId: 'job_1',
      status: 'READY',
      startAt: new Date('2026-07-01T00:00:00.000Z'),
      endAt: new Date('2026-07-10T00:00:00.000Z'),
      snapshotAt: new Date('2026-07-10T12:00:00.000Z'),
      filterAction: 'OUTBOX_REQUEUE',
      filterStatus: 'FAILED',
      filterTargetType: 'OutboxEvent',
      filterTargetId: 'evt_1',
      filterActorUserId: 'actor_1',
      reason: 'INC evidence review',
      objectKey: 'operator-audit-exports/export_1/attempts/token_1.zip',
      fileName: 'operator-audit-export.zip',
      archiveSize: 128,
      recordCount: 1,
      csvSha256: `sha256:${'a'.repeat(64)}`,
      archiveSha256: `sha256:${'b'.repeat(64)}`,
      schemaVersion: 1,
      errorCode: null,
      errorPreview: null,
      requestedAt: new Date('2026-07-10T12:00:00.000Z'),
      startedAt: new Date('2026-07-10T12:00:01.000Z'),
      completedAt: new Date('2026-07-10T12:00:02.000Z'),
      expiresAt: new Date('2026-07-12T12:00:00.000Z'),
      expiredAt: null,
      createdAt: new Date('2026-07-10T12:00:00.000Z'),
      updatedAt: new Date('2026-07-10T12:00:02.000Z'),
      ...overrides,
    };
  }
});
