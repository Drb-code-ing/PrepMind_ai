/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

import { Prisma, type OperatorAuditExport } from '@prisma/client';
import * as unzipper from 'unzipper';

import type { PrismaService } from '../database/prisma.service';
import {
  OperatorAuditExportArchiveError,
  OperatorAuditExportArchiveService,
} from './operator-audit-export-archive.service';

const QUERY_STARTED = new Date('2026-07-10T00:00:01.000Z');
const QUERY_FINISHED = new Date('2026-07-10T00:00:02.000Z');

describe('OperatorAuditExportArchiveService', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = join(tmpdir(), `prepmind-archive-spec-${randomUUID()}`);
    await mkdir(tempRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('builds a two-entry ZIP from a stable read-only REPEATABLE READ snapshot', async () => {
    const fixture = createFixture({
      rows: [
        auditRow({
          id: 'audit_1',
          createdAt: new Date('2026-07-09T00:00:00Z'),
        }),
        auditRow({
          id: 'audit_2',
          createdAt: new Date('2026-07-09T01:00:00Z'),
        }),
      ],
    });
    const result = await fixture.service.build({
      auditExport: exportRow(),
      processingToken: 'token_1',
    });

    expect(fixture.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      }),
    );
    expect(fixture.tx.$executeRawUnsafe).toHaveBeenNthCalledWith(
      1,
      'SET TRANSACTION READ ONLY',
    );
    expect(fixture.tx.$executeRawUnsafe).toHaveBeenNthCalledWith(
      2,
      'SET LOCAL statement_timeout = 120000',
    );
    expect(fixture.tx.operatorAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1000,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          actorUserId: true,
          action: true,
          status: true,
          targetType: true,
          targetId: true,
          reason: true,
          requestId: true,
          ipAddressHash: true,
          userAgentHash: true,
          errorCode: true,
          errorPreview: true,
          createdAt: true,
          metadata: false,
        },
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2026-07-01T00:00:00.000Z'),
            lte: new Date('2026-07-10T00:00:00.000Z'),
          },
          action: 'AUDIT_EXPORT_REQUEST',
          status: 'SUCCEEDED',
          targetType: 'OperatorAuditExport',
          targetId: 'target_1',
          actorUserId: 'admin_1',
        }),
      }),
    );

    const archiveBytes = await readFile(result.filePath);
    const zip = await unzipper.Open.buffer(archiveBytes);
    expect(zip.files.map((entry) => entry.path).sort()).toEqual([
      'manifest.json',
      'records.csv',
    ]);
    const csvBytes = await zip.files
      .find((entry) => entry.path === 'records.csv')!
      .buffer();
    const manifestBytes = await zip.files
      .find((entry) => entry.path === 'manifest.json')!
      .buffer();
    const manifest: unknown = JSON.parse(manifestBytes.toString('utf8'));

    expect([...csvBytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(manifest).toEqual({
      schemaVersion: 1,
      exportId: 'export_123456789',
      generatedAt: QUERY_FINISHED.toISOString(),
      queryStartedAt: QUERY_STARTED.toISOString(),
      queryFinishedAt: QUERY_FINISHED.toISOString(),
      effectiveEndAt: '2026-07-10T00:00:00.000Z',
      requestedByUserId: 'admin_1',
      reason: 'compliance evidence',
      snapshotAt: '2026-07-10T00:00:00.000Z',
      range: {
        startAt: '2026-07-01T00:00:00.000Z',
        endAt: '2026-07-11T00:00:00.000Z',
      },
      filters: {
        action: 'AUDIT_EXPORT_REQUEST',
        status: 'SUCCEEDED',
        targetType: 'OperatorAuditExport',
        targetId: 'target_1',
        actorUserId: 'admin_1',
      },
      recordCount: 2,
      recordsFile: 'records.csv',
      recordsSha256: result.csvSha256,
    });
    expect(manifestBytes.toString('utf8').endsWith('\n')).toBe(true);
    expect(result).toMatchObject({
      fileName: 'prepmind-operator-audit-20260701-20260711-export_1.zip',
      archiveSize: archiveBytes.length,
      recordCount: 2,
      csvSha256: sha256(csvBytes),
      archiveSha256: sha256(archiveBytes),
      queryStartedAt: QUERY_STARTED,
      queryFinishedAt: QUERY_FINISHED,
      effectiveEndAt: new Date('2026-07-10T00:00:00.000Z'),
    });
    expect((await stat(result.filePath)).isFile()).toBe(true);

    await result.cleanup();
    await expect(stat(result.filePath)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('creates a valid archive with a header-only CSV and null manifest filters', async () => {
    const fixture = createFixture({ rows: [] });
    const result = await fixture.service.build({
      auditExport: exportRow({
        filterAction: null,
        filterStatus: null,
        filterTargetType: null,
        filterTargetId: null,
        filterActorUserId: null,
      }),
      processingToken: 'token_2',
    });
    const zip = await unzipper.Open.file(result.filePath);
    const manifest: unknown = JSON.parse(
      (
        await zip.files
          .find((entry) => entry.path === 'manifest.json')!
          .buffer()
      ).toString('utf8'),
    );

    expect(result.recordCount).toBe(0);
    expect(manifest).toMatchObject({
      filters: {
        action: null,
        status: null,
        targetType: null,
        targetId: null,
        actorUserId: null,
      },
    });
    await result.cleanup();
  });

  it('paginates 1,000 rows at a time with a stable createdAt/id keyset', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) =>
      auditRow({ id: `audit_${String(index).padStart(4, '0')}` }),
    );
    const lastRecord = auditRow({ id: 'audit_1000' });
    const fixture = createFixture({
      count: 1001,
      pages: [firstPage, [lastRecord]],
    });

    const result = await fixture.service.build({
      auditExport: exportRow(),
      processingToken: 'token_page',
    });

    expect(result.recordCount).toBe(1001);
    expect(fixture.tx.operatorAuditLog.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        take: 1000,
        where: {
          AND: [
            expect.any(Object),
            {
              OR: [
                { createdAt: { gt: firstPage[999].createdAt } },
                {
                  createdAt: firstPage[999].createdAt,
                  id: { gt: 'audit_0999' },
                },
              ],
            },
          ],
        },
      }),
    );
    await result.cleanup();
  });

  it('redacts secrets from manifest text fields', async () => {
    const fixture = createFixture({ rows: [] });
    const result = await fixture.service.build({
      auditExport: exportRow({
        reason: 'Bearer secret-token',
        filterTargetType: 'Cookie: refresh=secret-cookie',
        filterTargetId: 'QWEN_API_KEY=secret-provider',
      }),
      processingToken: 'token_manifest',
    });
    const zip = await unzipper.Open.file(result.filePath);
    const manifestBytes = await zip.files
      .find((entry) => entry.path === 'manifest.json')!
      .buffer();
    const serialized = manifestBytes.toString('utf8');

    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('secret-cookie');
    expect(serialized).not.toContain('secret-provider');
    expect(JSON.parse(serialized)).toMatchObject({
      reason: '[redacted]',
      filters: {
        targetType: '[redacted]',
        targetId: '[redacted]',
      },
    });
    await result.cleanup();
  });

  it('fails and cleans plaintext files when archiver emits a warning', async () => {
    const fakeArchive = Object.assign(new PassThrough(), {
      file: jest.fn(),
      finalize: jest.fn(function (this: PassThrough) {
        this.emit('warning', new Error('source disappeared'));
        this.end();
        return Promise.resolve();
      }),
    });
    const fixture = createFixture({
      rows: [],
      archiveFactory: jest.fn(() => fakeArchive),
    });

    await expect(
      fixture.service.build({
        auditExport: exportRow(),
        processingToken: 'token_warning',
      }),
    ).rejects.toMatchObject({
      code: 'OPERATOR_AUDIT_EXPORT_ARCHIVE_BUILD_FAILED',
      retryable: true,
    });
    expect(await readdir(tempRoot)).toEqual([]);
  });

  it('rejects the pre-count limit and cleans plaintext temp files', async () => {
    const fixture = createFixture({ count: 50_001, maxRecords: 50_000 });

    await expect(
      fixture.service.build({
        auditExport: exportRow(),
        processingToken: 'token_3',
      }),
    ).rejects.toMatchObject({
      code: 'OPERATOR_AUDIT_EXPORT_TOO_MANY_RECORDS',
      retryable: false,
    });
    expect(await readdir(tempRoot)).toEqual([]);
  });

  it('enforces the streamed row limit even when pre-count is stale', async () => {
    const fixture = createFixture({
      count: 1,
      maxRecords: 1,
      rows: [auditRow({ id: 'audit_1' }), auditRow({ id: 'audit_2' })],
    });

    await expect(
      fixture.service.build({
        auditExport: exportRow(),
        processingToken: 'token_4',
      }),
    ).rejects.toMatchObject({
      code: 'OPERATOR_AUDIT_EXPORT_TOO_MANY_RECORDS',
      retryable: false,
    });
    expect(await readdir(tempRoot)).toEqual([]);
  });

  it('rejects insufficient temporary disk before creating plaintext files', async () => {
    const fixture = createFixture({ freeBytes: 2_000, maxArchiveBytes: 1_000 });

    await expect(
      fixture.service.build({
        auditExport: exportRow(),
        processingToken: 'token_5',
      }),
    ).rejects.toMatchObject({
      code: 'OPERATOR_AUDIT_EXPORT_TEMP_DISK_INSUFFICIENT',
      retryable: false,
    });
    expect(await readdir(tempRoot)).toEqual([]);
  });

  it('aborts archives beyond the configured byte ceiling and cleans temp files', async () => {
    const fixture = createFixture({ maxArchiveBytes: 100, freeBytes: 10_000 });

    await expect(
      fixture.service.build({
        auditExport: exportRow(),
        processingToken: 'token_6',
      }),
    ).rejects.toMatchObject({
      code: 'OPERATOR_AUDIT_EXPORT_ARCHIVE_TOO_LARGE',
      retryable: false,
    });
    expect(await readdir(tempRoot)).toEqual([]);
  });

  function createFixture(options: {
    rows?: ReturnType<typeof auditRow>[];
    pages?: ReturnType<typeof auditRow>[][];
    count?: number;
    maxRecords?: number;
    maxArchiveBytes?: number;
    freeBytes?: number;
    archiveFactory?: (...args: never[]) => unknown;
  }) {
    const rows = options.rows ?? [];
    const pages = options.pages ?? [rows];
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ now: QUERY_STARTED }])
        .mockResolvedValueOnce([{ now: QUERY_FINISHED }]),
      operatorAuditLog: {
        count: jest.fn().mockResolvedValue(options.count ?? rows.length),
        findMany: jest
          .fn()
          .mockImplementation(() => Promise.resolve(pages.shift() ?? [])),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const values = {
      OPERATOR_AUDIT_EXPORT_QUERY_TIMEOUT_MS: 120_000,
      OPERATOR_AUDIT_EXPORT_MAX_RECORDS: options.maxRecords ?? 50_000,
      OPERATOR_AUDIT_EXPORT_MAX_ARCHIVE_BYTES:
        options.maxArchiveBytes ?? 64 * 1024 * 1024,
    };
    const service = new OperatorAuditExportArchiveService(
      prisma,
      { get: jest.fn((key: keyof typeof values) => values[key]) } as never,
      {
        tempRoot,
        statfs: jest.fn().mockResolvedValue({
          bavail: options.freeBytes ?? 1024 * 1024 * 1024,
          bsize: 1,
        }),
        ...(options.archiveFactory
          ? { archiveFactory: options.archiveFactory }
          : {}),
      },
    );
    return { service, prisma, tx };
  }
});

function exportRow(
  overrides: Partial<OperatorAuditExport> = {},
): OperatorAuditExport {
  return {
    id: 'export_123456789',
    requestedByUserId: 'admin_1',
    startAt: new Date('2026-07-01T00:00:00.000Z'),
    endAt: new Date('2026-07-11T00:00:00.000Z'),
    snapshotAt: new Date('2026-07-10T00:00:00.000Z'),
    filterAction: 'AUDIT_EXPORT_REQUEST',
    filterStatus: 'SUCCEEDED',
    filterTargetType: 'OperatorAuditExport',
    filterTargetId: 'target_1',
    filterActorUserId: 'admin_1',
    reason: 'compliance evidence',
    ...overrides,
  } as OperatorAuditExport;
}

function auditRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'audit_1',
    actorUserId: 'admin_1',
    action: 'AUDIT_EXPORT_REQUEST' as const,
    status: 'SUCCEEDED' as const,
    targetType: 'OperatorAuditExport',
    targetId: 'target_1',
    reason: 'compliance evidence',
    requestId: 'request_1',
    ipAddressHash: `hmac-sha256:${'a'.repeat(64)}`,
    userAgentHash: `hmac-sha256:${'b'.repeat(64)}`,
    errorCode: null,
    errorPreview: null,
    createdAt: new Date('2026-07-09T00:00:00.000Z'),
    ...overrides,
  };
}

function sha256(value: Buffer) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

expect(OperatorAuditExportArchiveError).toBeDefined();
