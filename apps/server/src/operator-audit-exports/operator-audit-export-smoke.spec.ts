import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';

import archiver from 'archiver';

import {
  OperatorAuditExportSmokeError,
  cleanupFailedSmokeRun,
  cleanupSmokeRun,
  formatOperatorAuditExportSmokeFailure,
  parseOperatorAuditExportSmokeConfig,
  verifyOperatorAuditExportArchive,
} from '../../scripts/operator-audit-export-smoke';

const VALID_ENV = {
  OPERATOR_AUDIT_EXPORT_SMOKE_ADMIN_TOKEN: 'admin-secret-token',
  OPERATOR_AUDIT_EXPORT_SMOKE_STUDENT_TOKEN: 'student-secret-token',
};

describe('operator audit export smoke configuration', () => {
  it.each([
    'OPERATOR_AUDIT_EXPORT_SMOKE_ADMIN_TOKEN',
    'OPERATOR_AUDIT_EXPORT_SMOKE_STUDENT_TOKEN',
  ] as const)('requires %s without echoing token values', (key) => {
    const env = { ...VALID_ENV, [key]: '   ' };

    expect(() => parseOperatorAuditExportSmokeConfig(env)).toThrow(key);
    try {
      parseOperatorAuditExportSmokeConfig(env);
    } catch (error) {
      expect(String(error)).not.toContain('admin-secret-token');
      expect(String(error)).not.toContain('student-secret-token');
    }
  });

  it.each([
    'not-a-url',
    'ftp://127.0.0.1:3001',
    'http://user:password@127.0.0.1:3001',
    'http://127.0.0.1:3001/api',
  ])('rejects unsafe base URL %s', (baseUrl) => {
    expect(() =>
      parseOperatorAuditExportSmokeConfig({
        ...VALID_ENV,
        OPERATOR_AUDIT_EXPORT_SMOKE_BASE_URL: baseUrl,
      }),
    ).toThrow('OPERATOR_AUDIT_EXPORT_SMOKE_BASE_URL');
  });

  it.each(['9999', '300001', 'not-a-number', '120000.5'])(
    'rejects timeout outside the bounded integer range: %s',
    (timeout) => {
      expect(() =>
        parseOperatorAuditExportSmokeConfig({
          ...VALID_ENV,
          OPERATOR_AUDIT_EXPORT_SMOKE_TIMEOUT_MS: timeout,
        }),
      ).toThrow('OPERATOR_AUDIT_EXPORT_SMOKE_TIMEOUT_MS');
    },
  );

  it('uses safe defaults and trims required tokens', () => {
    expect(parseOperatorAuditExportSmokeConfig(VALID_ENV)).toEqual(
      expect.objectContaining({
        adminToken: 'admin-secret-token',
        studentToken: 'student-secret-token',
        baseUrl: 'http://127.0.0.1:3001',
        timeoutMs: 120_000,
        keepData: false,
        bullmqPrefix: 'prepmind',
      }),
    );
  });

  it('accepts a safe explicit BullMQ prefix and rejects ambiguous prefixes', () => {
    expect(
      parseOperatorAuditExportSmokeConfig({
        ...VALID_ENV,
        BULLMQ_PREFIX: 'local:test-prefix',
      }).bullmqPrefix,
    ).toBe('local:test-prefix');
    expect(() =>
      parseOperatorAuditExportSmokeConfig({
        ...VALID_ENV,
        BULLMQ_PREFIX: 'unsafe prefix',
      }),
    ).toThrow('BULLMQ_PREFIX');
  });

  it.each([
    ['true', true],
    [' TRUE ', true],
    ['false', false],
    [' False ', false],
  ])('parses KEEP_DATA=%s as %s', (value, expected) => {
    expect(
      parseOperatorAuditExportSmokeConfig({
        ...VALID_ENV,
        OPERATOR_AUDIT_EXPORT_SMOKE_KEEP_DATA: value,
      }).keepData,
    ).toBe(expected);
  });

  it('rejects ambiguous KEEP_DATA values', () => {
    expect(() =>
      parseOperatorAuditExportSmokeConfig({
        ...VALID_ENV,
        OPERATOR_AUDIT_EXPORT_SMOKE_KEEP_DATA: '1',
      }),
    ).toThrow('OPERATOR_AUDIT_EXPORT_SMOKE_KEEP_DATA');
  });

  it('formats failures with only a bounded stage and code', () => {
    const error = new OperatorAuditExportSmokeError(
      'download',
      'ARCHIVE_HASH_MISMATCH',
      'raw dependency error admin-secret-token',
    );

    expect(formatOperatorAuditExportSmokeFailure(error)).toBe(
      'Operator audit export smoke: FAIL stage=download code=ARCHIVE_HASH_MISMATCH',
    );
  });

  it('turns cleanup failures into an explicit safe smoke failure', async () => {
    await expect(
      cleanupFailedSmokeRun(() => {
        return Promise.reject(
          new Error('raw cleanup failure admin-secret-token'),
        );
      }),
    ).rejects.toMatchObject({
      stage: 'cleanup',
      code: 'CLEANUP_FAILED',
    });
  });

  it('routes both success and failure cleanup through the safe cleanup boundary', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../scripts/operator-audit-export-smoke.ts'),
      'utf8',
    );
    const runBody = source.slice(
      source.indexOf('export async function runOperatorAuditExportSmoke'),
      source.indexOf('export async function cleanupFailedSmokeRun'),
    );

    expect(runBody).not.toContain('await cleanupSmokeRun(');
    expect(runBody.match(/await cleanupFailedSmokeRun\(/g)).toHaveLength(2);
  });

  it('removes a known strict export prefix even after its database row disappeared', async () => {
    const objectStream = new EventEmitter();
    const removeObject = jest.fn().mockResolvedValue(undefined);
    const removeJob = jest.fn().mockResolvedValue(undefined);
    const runtime = {
      prisma: {
        operatorAuditExport: { findFirst: jest.fn().mockResolvedValue(null) },
        operatorAuditLog: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      },
      exportQueue: {
        getJob: jest.fn().mockResolvedValue({
          data: {
            exportId: 'export_safe_id',
            backgroundJobId: 'background_safe_id',
          },
          isActive: jest.fn().mockResolvedValue(false),
          remove: removeJob,
        }),
      },
      maintenanceQueue: { getJob: jest.fn().mockResolvedValue(null) },
      minio: {
        listObjectsV2: jest.fn(() => objectStream),
        removeObject,
      },
    };
    const cleanup = cleanupSmokeRun(
      { minio: { bucket: 'prepmind-dev' } } as never,
      runtime as never,
      {
        clientRequestId: 'request_safe_id',
        reason: 'safe reason',
        fixtureAuditId: 'fixture_safe_id',
        formulaValue: '=SAFE',
        exportId: 'export_safe_id',
        backgroundJobId: 'background_safe_id',
        maintenanceJobId: 'maintenance_safe_id',
      },
    );
    process.nextTick(() => {
      objectStream.emit('data', {
        name: 'operator-audit-exports/export_safe_id/attempts/token.zip',
      });
      objectStream.emit('end');
    });

    await cleanup;

    expect(runtime.minio.listObjectsV2).toHaveBeenCalledWith(
      'prepmind-dev',
      'operator-audit-exports/export_safe_id/',
      true,
    );
    expect(removeObject).toHaveBeenCalledWith(
      'prepmind-dev',
      'operator-audit-exports/export_safe_id/attempts/token.zip',
    );
    expect(removeJob).toHaveBeenCalledTimes(1);
  });

  it('waits for an exact active Bull job to stop before removing storage', async () => {
    const objectStream = new EventEmitter();
    const order: string[] = [];
    const job = {
      data: {
        exportId: 'export_safe_id',
        backgroundJobId: 'background_safe_id',
      },
      isActive: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
      remove: jest.fn().mockImplementation(() => {
        order.push('job');
        return Promise.resolve();
      }),
    };
    const runtime = {
      prisma: {
        operatorAuditExport: { findFirst: jest.fn().mockResolvedValue(null) },
        operatorAuditLog: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      },
      exportQueue: { getJob: jest.fn().mockResolvedValue(job) },
      maintenanceQueue: { getJob: jest.fn().mockResolvedValue(null) },
      minio: {
        listObjectsV2: jest.fn(() => objectStream),
        removeObject: jest.fn().mockImplementation(() => {
          order.push('object');
          return Promise.resolve();
        }),
      },
    };
    const cleanup = cleanupSmokeRun(
      {
        timeoutMs: 1000,
        minio: { bucket: 'prepmind-dev' },
      } as never,
      runtime as never,
      {
        clientRequestId: 'request_safe_id',
        reason: 'safe reason',
        fixtureAuditId: 'fixture_safe_id',
        formulaValue: '=SAFE',
        exportId: 'export_safe_id',
        backgroundJobId: 'background_safe_id',
        maintenanceJobId: 'maintenance_safe_id',
      },
    );
    setTimeout(() => {
      objectStream.emit('data', {
        name: 'operator-audit-exports/export_safe_id/attempts/token.zip',
      });
      objectStream.emit('end');
    }, 300);

    await cleanup;

    expect(job.isActive).toHaveBeenCalledTimes(2);
    expect(order).toEqual(['job', 'object']);
  });

  it('fails safely when maintenance expires the export and then fails later', async () => {
    const maintenanceJob = {
      data: { schemaVersion: 1 },
      getState: jest
        .fn()
        .mockResolvedValueOnce('active')
        .mockResolvedValueOnce('failed'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const runtime = {
      prisma: {
        operatorAuditExport: { findFirst: jest.fn().mockResolvedValue(null) },
        operatorAuditLog: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      },
      exportQueue: { getJob: jest.fn().mockResolvedValue(null) },
      maintenanceQueue: {
        getJob: jest.fn().mockResolvedValue(maintenanceJob),
      },
      minio: {
        listObjectsV2: jest.fn(),
        removeObject: jest.fn(),
      },
    };

    await expect(
      cleanupSmokeRun(
        {
          timeoutMs: 1000,
          minio: { bucket: 'prepmind-dev' },
        } as never,
        runtime as never,
        {
          clientRequestId: 'request_safe_id',
          reason: 'safe reason',
          fixtureAuditId: 'fixture_safe_id',
          formulaValue: '=SAFE',
          exportId: 'export_safe_id',
          backgroundJobId: 'background_safe_id',
          maintenanceJobId: 'maintenance_safe_id',
        },
      ),
    ).rejects.toMatchObject({
      stage: 'cleanup',
      code: 'MAINTENANCE_JOB_FAILED',
    });
    expect(maintenanceJob.getState).toHaveBeenCalledTimes(2);
    expect(maintenanceJob.remove).toHaveBeenCalledTimes(1);
    expect(runtime.minio.listObjectsV2).not.toHaveBeenCalled();
  });

  it('registers the deterministic smoke command in the server package', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts['smoke:operator-audit-export']).toBe(
      'ts-node -r tsconfig-paths/register scripts/operator-audit-export-smoke.ts',
    );
  });

  it('verifies the exact ZIP entries, CSV BOM/header, hashes, and manifest facts', async () => {
    const csv = Buffer.from(
      '\ufeffid,actorUserId,action,status,targetType,targetId,reason,requestId,ipAddressHash,userAgentHash,errorCode,errorPreview,createdAt\r\n',
      'utf8',
    );
    const csvSha256 = sha256(csv);
    const manifest = {
      schemaVersion: 1,
      exportId: 'export_safe_id',
      range: {
        startAt: '2026-07-10T00:00:00.000Z',
        endAt: '2026-07-11T00:00:00.000Z',
      },
      recordCount: 0,
      recordsFile: 'records.csv',
      recordsSha256: csvSha256,
    };
    const archiveBytes = await buildZip({
      'records.csv': csv,
      'manifest.json': Buffer.from(JSON.stringify(manifest)),
    });

    await expect(
      verifyOperatorAuditExportArchive({
        archiveBytes,
        exportId: manifest.exportId,
        startAt: manifest.range.startAt,
        endAt: manifest.range.endAt,
        recordCount: manifest.recordCount,
        csvSha256,
        archiveSha256: sha256(archiveBytes),
      }),
    ).resolves.toEqual({ recordCount: 0 });
  });

  it('rejects an archive with any unexpected entry', async () => {
    const csv = Buffer.from(
      '\ufeffid,actorUserId,action,status,targetType,targetId,reason,requestId,ipAddressHash,userAgentHash,errorCode,errorPreview,createdAt\r\n',
      'utf8',
    );
    const csvSha256 = sha256(csv);
    const archiveBytes = await buildZip({
      'records.csv': csv,
      'manifest.json': Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          exportId: 'export_safe_id',
          range: {
            startAt: '2026-07-10T00:00:00.000Z',
            endAt: '2026-07-11T00:00:00.000Z',
          },
          recordCount: 0,
          recordsFile: 'records.csv',
          recordsSha256: csvSha256,
        }),
      ),
      'unexpected.txt': Buffer.from('unsafe'),
    });

    await expect(
      verifyOperatorAuditExportArchive({
        archiveBytes,
        exportId: 'export_safe_id',
        startAt: '2026-07-10T00:00:00.000Z',
        endAt: '2026-07-11T00:00:00.000Z',
        recordCount: 0,
        csvSha256,
        archiveSha256: sha256(archiveBytes),
      }),
    ).rejects.toMatchObject({ code: 'ARCHIVE_ENTRIES_INVALID' });
  });
});

function sha256(value: Buffer) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function buildZip(entries: Record<string, Buffer>) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const output = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    output.on('end', () => resolve(Buffer.concat(chunks)));
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    for (const [name, content] of Object.entries(entries)) {
      archive.append(content, { name });
    }
    void archive.finalize();
  });
}
