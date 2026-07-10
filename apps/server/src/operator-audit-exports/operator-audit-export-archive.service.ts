import { createHash } from 'node:crypto';
import { createWriteStream, type StatsFs } from 'node:fs';
import {
  chmod,
  mkdir,
  realpath,
  rm,
  statfs as nodeStatfs,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { once } from 'node:events';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type OperatorAuditExport } from '@prisma/client';
import archiver from 'archiver';
import { stringify } from 'csv-stringify';

import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { sanitizeJobError } from '../jobs/job-error-sanitizer';
import {
  formatOperatorAuditCsvRecord,
  OPERATOR_AUDIT_CSV_COLUMNS,
} from './operator-audit-export-csv';

const TEMP_SEGMENT_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const CSV_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

export function getOperatorAuditExportTempRoot() {
  return join(tmpdir(), 'prepmind-audit-exports');
}

export async function prepareOperatorAuditExportTempRoot(root: string) {
  const safeTmpRoot = await realpath(tmpdir());
  const requestedRoot = resolve(root);
  if (!isBeneathOrEqual(safeTmpRoot, requestedRoot)) {
    throw new Error('Operator audit export temp root is outside os.tmpdir');
  }
  await mkdir(requestedRoot, { recursive: true, mode: 0o700 });
  const resolvedRoot = await realpath(requestedRoot);
  if (!isBeneathOrEqual(safeTmpRoot, resolvedRoot)) {
    throw new Error(
      'Operator audit export temp root resolves outside os.tmpdir',
    );
  }
  if (process.platform !== 'win32') await chmod(resolvedRoot, 0o700);
}

function isBeneathOrEqual(root: string, target: string) {
  const path = relative(root, target);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}
const PAGE_SIZE = 1000;

export const OPERATOR_AUDIT_ARCHIVE_RUNTIME = Symbol(
  'OPERATOR_AUDIT_ARCHIVE_RUNTIME',
);

export type OperatorAuditArchiveResult = {
  filePath: string;
  fileName: string;
  archiveSize: number;
  recordCount: number;
  csvSha256: `sha256:${string}`;
  archiveSha256: `sha256:${string}`;
  queryStartedAt: Date;
  queryFinishedAt: Date;
  effectiveEndAt: Date;
  cleanup: () => Promise<void>;
};

export class OperatorAuditExportArchiveError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = 'OperatorAuditExportArchiveError';
  }
}

type ArchiveRuntime = {
  tempRoot: string;
  statfs: (path: string) => Promise<Pick<StatsFs, 'bavail' | 'bsize'>>;
  archiveFactory: typeof archiver;
};

@Injectable()
export class OperatorAuditExportArchiveService {
  private readonly runtime: ArchiveRuntime;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ServerEnv, true>,
    @Optional()
    @Inject(OPERATOR_AUDIT_ARCHIVE_RUNTIME)
    runtime?: Partial<ArchiveRuntime>,
  ) {
    this.runtime = {
      tempRoot: runtime?.tempRoot ?? getOperatorAuditExportTempRoot(),
      statfs: runtime?.statfs ?? nodeStatfs,
      archiveFactory: runtime?.archiveFactory ?? archiver,
    };
  }

  async build(input: {
    auditExport: OperatorAuditExport;
    processingToken: string;
  }): Promise<OperatorAuditArchiveResult> {
    assertTempSegment(input.auditExport.id);
    assertTempSegment(input.processingToken);

    const maxArchiveBytes = this.positiveIntegerConfig(
      'OPERATOR_AUDIT_EXPORT_MAX_ARCHIVE_BYTES',
    );
    await prepareOperatorAuditExportTempRoot(this.runtime.tempRoot);
    await this.assertTemporaryDisk(maxArchiveBytes);

    const tempDirectory = join(
      this.runtime.tempRoot,
      `prepmind-audit-export-${input.auditExport.id}-${input.processingToken}`,
    );
    let createdDirectory = false;

    try {
      await mkdir(tempDirectory, { mode: 0o700 });
      createdDirectory = true;
      const csvPath = join(tempDirectory, 'records.csv');
      const manifestPath = join(tempDirectory, 'manifest.json');
      const archivePath = join(tempDirectory, 'evidence.zip');
      const query = await this.writeCsvSnapshot(input.auditExport, csvPath);
      const csvSha256 = query.csvSha256;
      const manifest = this.createManifest(input.auditExport, query, csvSha256);
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      const archive = await this.writeArchive(
        archivePath,
        csvPath,
        manifestPath,
        maxArchiveBytes,
      );
      const cleanup = () => rm(tempDirectory, { recursive: true, force: true });

      return {
        filePath: archivePath,
        fileName: createFileName(input.auditExport),
        archiveSize: archive.size,
        recordCount: query.recordCount,
        csvSha256,
        archiveSha256: archive.sha256,
        queryStartedAt: query.queryStartedAt,
        queryFinishedAt: query.queryFinishedAt,
        effectiveEndAt: query.effectiveEndAt,
        cleanup,
      };
    } catch (error) {
      if (createdDirectory) {
        await rm(tempDirectory, { recursive: true, force: true }).catch(
          () => undefined,
        );
      }
      throw error;
    }
  }

  private async writeCsvSnapshot(
    auditExport: OperatorAuditExport,
    csvPath: string,
  ) {
    const output = createWriteStream(csvPath, {
      flags: 'wx',
      mode: 0o600,
    });
    const csvHash = createHash('sha256');
    csvHash.update(CSV_BOM);
    output.write(CSV_BOM);
    const stringifier = stringify({
      header: true,
      columns: [...OPERATOR_AUDIT_CSV_COLUMNS],
      record_delimiter: '\r\n',
    });
    const hashTap = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        csvHash.update(chunk);
        callback(null, chunk);
      },
    });
    const csvCompletion = pipeline(stringifier, hashTap, output);
    const queryTimeoutMs = this.validatedQueryTimeout();

    try {
      const query = await this.prisma.$transaction(
        async (transaction) => {
          await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
          await transaction.$executeRawUnsafe(
            `SET LOCAL statement_timeout = ${queryTimeoutMs}`,
          );
          const queryStartedAt = await readDatabaseClock(transaction);
          const effectiveEndAt = new Date(
            Math.min(
              auditExport.endAt.getTime(),
              auditExport.snapshotAt.getTime(),
            ),
          );
          const where = createAuditWhere(auditExport, effectiveEndAt);
          const maxRecords = this.positiveIntegerConfig(
            'OPERATOR_AUDIT_EXPORT_MAX_RECORDS',
          );
          const expectedCount = await transaction.operatorAuditLog.count({
            where,
          });
          if (expectedCount > maxRecords) throw tooManyRecords();

          let recordCount = 0;
          let cursor: { id: string; createdAt: Date } | undefined;
          while (true) {
            const page = await transaction.operatorAuditLog.findMany({
              where: cursor ? addKeysetCursor(where, cursor) : where,
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              take: PAGE_SIZE,
              select: OPERATOR_AUDIT_EXPORT_SELECT,
            });
            if (page.length === 0) break;
            recordCount += page.length;
            if (recordCount > maxRecords) throw tooManyRecords();

            for (const record of page) {
              if (!stringifier.write(formatOperatorAuditCsvRecord(record))) {
                await once(stringifier, 'drain');
              }
            }
            const last = page.at(-1);
            if (!last || page.length < PAGE_SIZE) break;
            cursor = { id: last.id, createdAt: last.createdAt };
          }
          const queryFinishedAt = await readDatabaseClock(transaction);
          return {
            recordCount,
            queryStartedAt,
            queryFinishedAt,
            effectiveEndAt,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          timeout: queryTimeoutMs + 5_000,
        },
      );
      stringifier.end();
      await csvCompletion;
      return {
        ...query,
        csvSha256: `sha256:${csvHash.digest('hex')}` as const,
      };
    } catch (error) {
      stringifier.destroy();
      output.destroy();
      await csvCompletion.catch(() => undefined);
      throw error;
    }
  }

  private createManifest(
    auditExport: OperatorAuditExport,
    query: {
      recordCount: number;
      queryStartedAt: Date;
      queryFinishedAt: Date;
      effectiveEndAt: Date;
    },
    csvSha256: `sha256:${string}`,
  ) {
    return {
      schemaVersion: 1,
      exportId: auditExport.id,
      generatedAt: query.queryFinishedAt.toISOString(),
      queryStartedAt: query.queryStartedAt.toISOString(),
      queryFinishedAt: query.queryFinishedAt.toISOString(),
      effectiveEndAt: query.effectiveEndAt.toISOString(),
      requestedByUserId: auditExport.requestedByUserId,
      reason: sanitizeManifestText(auditExport.reason, 240),
      snapshotAt: auditExport.snapshotAt.toISOString(),
      range: {
        startAt: auditExport.startAt.toISOString(),
        endAt: auditExport.endAt.toISOString(),
      },
      filters: {
        action: auditExport.filterAction,
        status: auditExport.filterStatus,
        targetType: sanitizeManifestText(auditExport.filterTargetType, 120),
        targetId: sanitizeManifestText(auditExport.filterTargetId, 200),
        actorUserId: sanitizeManifestText(auditExport.filterActorUserId, 100),
      },
      recordCount: query.recordCount,
      recordsFile: 'records.csv',
      recordsSha256: csvSha256,
    };
  }

  private async writeArchive(
    archivePath: string,
    csvPath: string,
    manifestPath: string,
    maxArchiveBytes: number,
  ) {
    const archiveHash = createHash('sha256');
    let archiveSize = 0;
    const sizeAndHashTap = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        archiveSize += chunk.length;
        archiveHash.update(chunk);
        if (archiveSize > maxArchiveBytes) {
          callback(archiveTooLarge());
          return;
        }
        callback(null, chunk);
      },
    });
    const zip = this.runtime.archiveFactory('zip', { zlib: { level: 9 } });
    const output = createWriteStream(archivePath, {
      flags: 'wx',
      mode: 0o600,
    });
    const completion = pipeline(zip, sizeAndHashTap, output);
    zip.on('warning', () => {
      zip.destroy(
        new OperatorAuditExportArchiveError(
          'OPERATOR_AUDIT_EXPORT_ARCHIVE_BUILD_FAILED',
          true,
          'Audit export archive source became unavailable',
        ),
      );
    });
    zip.file(csvPath, { name: 'records.csv' });
    zip.file(manifestPath, { name: 'manifest.json' });

    await Promise.all([zip.finalize(), completion]);
    return {
      size: archiveSize,
      sha256: `sha256:${archiveHash.digest('hex')}` as const,
    };
  }

  private async assertTemporaryDisk(maxArchiveBytes: number) {
    const fileSystem = await this.runtime.statfs(this.runtime.tempRoot);
    const freeBytes = Number(fileSystem.bavail) * Number(fileSystem.bsize);
    if (!Number.isSafeInteger(freeBytes) || freeBytes <= 2 * maxArchiveBytes) {
      throw new OperatorAuditExportArchiveError(
        'OPERATOR_AUDIT_EXPORT_TEMP_DISK_INSUFFICIENT',
        false,
        'Temporary disk does not have enough free space',
      );
    }
  }

  private validatedQueryTimeout() {
    const timeout = this.positiveIntegerConfig(
      'OPERATOR_AUDIT_EXPORT_QUERY_TIMEOUT_MS',
    );
    if (timeout < 1_000 || timeout > 3_600_000) {
      throw new OperatorAuditExportArchiveError(
        'OPERATOR_AUDIT_EXPORT_INVALID_CONFIG',
        false,
        'Audit export query timeout is invalid',
      );
    }
    return timeout;
  }

  private positiveIntegerConfig(
    key:
      | 'OPERATOR_AUDIT_EXPORT_QUERY_TIMEOUT_MS'
      | 'OPERATOR_AUDIT_EXPORT_MAX_RECORDS'
      | 'OPERATOR_AUDIT_EXPORT_MAX_ARCHIVE_BYTES',
  ) {
    const value = this.config.get(key, { infer: true });
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new OperatorAuditExportArchiveError(
        'OPERATOR_AUDIT_EXPORT_INVALID_CONFIG',
        false,
        'Audit export numeric configuration is invalid',
      );
    }
    return value;
  }
}

const OPERATOR_AUDIT_EXPORT_SELECT = {
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
} satisfies Prisma.OperatorAuditLogSelect;

async function readDatabaseClock(transaction: Prisma.TransactionClient) {
  const [clock] = await transaction.$queryRaw<Array<{ now: Date }>>`
    SELECT clock_timestamp() AS now
  `;
  if (!clock) throw new Error('Database clock query returned no rows');
  return clock.now;
}

function createAuditWhere(
  auditExport: OperatorAuditExport,
  effectiveEndAt: Date,
): Prisma.OperatorAuditLogWhereInput {
  return {
    createdAt: { gte: auditExport.startAt, lte: effectiveEndAt },
    ...(auditExport.filterAction ? { action: auditExport.filterAction } : {}),
    ...(auditExport.filterStatus ? { status: auditExport.filterStatus } : {}),
    ...(auditExport.filterTargetType
      ? { targetType: auditExport.filterTargetType }
      : {}),
    ...(auditExport.filterTargetId
      ? { targetId: auditExport.filterTargetId }
      : {}),
    ...(auditExport.filterActorUserId
      ? { actorUserId: auditExport.filterActorUserId }
      : {}),
  };
}

function addKeysetCursor(
  where: Prisma.OperatorAuditLogWhereInput,
  cursor: { id: string; createdAt: Date },
): Prisma.OperatorAuditLogWhereInput {
  return {
    AND: [
      where,
      {
        OR: [
          { createdAt: { gt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { gt: cursor.id } },
        ],
      },
    ],
  };
}

function createFileName(auditExport: OperatorAuditExport) {
  return (
    [
      'prepmind-operator-audit',
      compactDate(auditExport.startAt),
      compactDate(auditExport.endAt),
      auditExport.id.slice(0, 8),
    ].join('-') + '.zip'
  );
}

function compactDate(value: Date) {
  return value.toISOString().slice(0, 10).replaceAll('-', '');
}

function assertTempSegment(value: string) {
  if (!TEMP_SEGMENT_PATTERN.test(value)) {
    throw new OperatorAuditExportArchiveError(
      'OPERATOR_AUDIT_EXPORT_INVALID_INPUT',
      false,
      'Audit export temporary path identifier is invalid',
    );
  }
}

function tooManyRecords() {
  return new OperatorAuditExportArchiveError(
    'OPERATOR_AUDIT_EXPORT_TOO_MANY_RECORDS',
    false,
    'Audit export record limit exceeded',
  );
}

function archiveTooLarge() {
  return new OperatorAuditExportArchiveError(
    'OPERATOR_AUDIT_EXPORT_ARCHIVE_TOO_LARGE',
    false,
    'Audit export archive byte limit exceeded',
  );
}

function sanitizeManifestText(value: string | null, maxLength: number) {
  return value === null
    ? null
    : sanitizeJobError(value, '').slice(0, maxLength);
}
