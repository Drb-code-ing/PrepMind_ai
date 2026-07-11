import { createHash, randomUUID } from 'node:crypto';

import { PrismaClient } from '@repo/database';
import { authUserSchema, type AuthUser } from '@repo/types/api/auth';
import {
  operatorAuditExportDetailResponseSchema,
  type OperatorAuditExportDetailResponse,
} from '@repo/types/api/operator-audit-export';
import { Queue } from 'bullmq';
import { Client as MinioClient } from 'minio';
import * as unzipper from 'unzipper';
import { z } from 'zod';

import {
  MAINTAIN_OPERATOR_AUDIT_JOB,
  OPERATOR_AUDIT_EXPORT_QUEUE,
  OPERATOR_AUDIT_MAINTENANCE_QUEUE,
} from '../src/operator-audit-exports/operator-audit-export.constants';
import { generateOperatorAuditExportPayloadSchema } from '../src/operator-audit-exports/jobs/generate-operator-audit-export.job';

type SmokeEnvironment = Record<string, string | undefined>;

const AUDIT_CSV_HEADER =
  'id,actorUserId,action,status,targetType,targetId,reason,requestId,ipAddressHash,userAgentHash,errorCode,errorPreview,createdAt\r\n';
const maintenanceJobPayloadSchema = z
  .object({ schemaVersion: z.literal(1) })
  .strict();

export type OperatorAuditExportSmokeConfig = {
  adminToken: string;
  studentToken: string;
  baseUrl: string;
  timeoutMs: number;
  keepData: boolean;
  databaseUrl: string;
  redisUrl: string;
  bullmqPrefix: string;
  minio: {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
  };
};

type Envelope<T> = {
  success?: boolean;
  data?: T;
  error?: { code?: string };
};

type SmokeRun = {
  clientRequestId: string;
  reason: string;
  fixtureAuditId: string;
  formulaValue: string;
  exportId: string;
  backgroundJobId: string;
  maintenanceJobId: string;
};

type SmokeRuntime = {
  prisma: PrismaClient;
  exportQueue: Queue;
  maintenanceQueue: Queue;
  minio: MinioClient;
};

type SmokeResult = {
  exportId: string;
  recordCount: number;
  requestAuditCount: number;
  downloadAuditCount: number;
  expired: true;
  objectDeleted: true;
};

export class OperatorAuditExportSmokeError extends Error {
  constructor(
    readonly stage: string,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OperatorAuditExportSmokeError';
  }
}

export function parseOperatorAuditExportSmokeConfig(
  env: SmokeEnvironment,
): OperatorAuditExportSmokeConfig {
  return {
    adminToken: requiredSecret(env, 'OPERATOR_AUDIT_EXPORT_SMOKE_ADMIN_TOKEN'),
    studentToken: requiredSecret(
      env,
      'OPERATOR_AUDIT_EXPORT_SMOKE_STUDENT_TOKEN',
    ),
    baseUrl: parseBaseUrl(
      env.OPERATOR_AUDIT_EXPORT_SMOKE_BASE_URL ?? 'http://127.0.0.1:3001',
    ),
    timeoutMs: parseTimeout(
      env.OPERATOR_AUDIT_EXPORT_SMOKE_TIMEOUT_MS ?? '120000',
    ),
    keepData: parseBoolean(
      'OPERATOR_AUDIT_EXPORT_SMOKE_KEEP_DATA',
      env.OPERATOR_AUDIT_EXPORT_SMOKE_KEEP_DATA ?? 'false',
    ),
    databaseUrl:
      env.DATABASE_URL ??
      'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind',
    redisUrl: env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    bullmqPrefix: parseBullmqPrefix(env.BULLMQ_PREFIX ?? 'prepmind'),
    minio: {
      endPoint: env.MINIO_ENDPOINT ?? '127.0.0.1',
      port: parsePort('MINIO_PORT', env.MINIO_PORT ?? '9000'),
      useSSL: parseBoolean('MINIO_USE_SSL', env.MINIO_USE_SSL ?? 'false'),
      accessKey: env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: env.MINIO_SECRET_KEY ?? 'minioadmin',
      bucket: env.MINIO_BUCKET ?? 'prepmind-dev',
    },
  };
}

export function formatOperatorAuditExportSmokeFailure(error: unknown) {
  if (error instanceof OperatorAuditExportSmokeError) {
    return `Operator audit export smoke: FAIL stage=${safeLabel(error.stage)} code=${safeLabel(error.code)}`;
  }
  return 'Operator audit export smoke: FAIL stage=unknown code=UNEXPECTED_ERROR';
}

export async function verifyOperatorAuditExportArchive(input: {
  archiveBytes: Buffer;
  exportId: string;
  startAt: string;
  endAt: string;
  recordCount: number;
  csvSha256: string;
  archiveSha256: string;
  formulaValue?: string;
}) {
  if (sha256(input.archiveBytes) !== input.archiveSha256) {
    throw smokeError('download', 'ARCHIVE_HASH_MISMATCH');
  }

  try {
    const archive = await unzipper.Open.buffer(input.archiveBytes);
    const entries = archive.files.map((entry) => entry.path).sort();
    if (
      entries.length !== 2 ||
      entries[0] !== 'manifest.json' ||
      entries[1] !== 'records.csv'
    ) {
      throw smokeError('archive', 'ARCHIVE_ENTRIES_INVALID');
    }

    const csvEntry = archive.files.find(
      (entry) => entry.path === 'records.csv',
    );
    const manifestEntry = archive.files.find(
      (entry) => entry.path === 'manifest.json',
    );
    if (!csvEntry || !manifestEntry) {
      throw smokeError('archive', 'ARCHIVE_ENTRIES_INVALID');
    }

    const csv = await csvEntry.buffer();
    if (
      csv.length < 3 ||
      !csv.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) ||
      !csv.subarray(3).toString('utf8').startsWith(AUDIT_CSV_HEADER)
    ) {
      throw smokeError('archive', 'CSV_FORMAT_INVALID');
    }
    if (sha256(csv) !== input.csvSha256) {
      throw smokeError('archive', 'CSV_HASH_MISMATCH');
    }
    if (
      input.formulaValue &&
      !csv.toString('utf8').includes(`'${input.formulaValue}`)
    ) {
      throw smokeError('archive', 'CSV_FORMULA_GUARD_MISSING');
    }

    const manifest = parseManifest(await manifestEntry.buffer());
    if (
      manifest.schemaVersion !== 1 ||
      manifest.exportId !== input.exportId ||
      manifest.range?.startAt !== input.startAt ||
      manifest.range?.endAt !== input.endAt ||
      manifest.recordCount !== input.recordCount ||
      manifest.recordsFile !== 'records.csv' ||
      manifest.recordsSha256 !== input.csvSha256
    ) {
      throw smokeError('archive', 'MANIFEST_MISMATCH');
    }

    return { recordCount: input.recordCount };
  } catch (error) {
    if (error instanceof OperatorAuditExportSmokeError) throw error;
    throw smokeError('archive', 'ARCHIVE_INVALID');
  }
}

export async function runOperatorAuditExportSmoke(
  config: OperatorAuditExportSmokeConfig,
) {
  process.env.DATABASE_URL = config.databaseUrl;
  const runtime = createRuntime(config);
  const run: SmokeRun = {
    clientRequestId: randomUUID(),
    reason: `Phase 7.23.8 smoke ${randomUUID()}`,
    fixtureAuditId: `audit_smoke_${randomUUID()}`,
    formulaValue: `=PREPMIND_SMOKE_${randomUUID().replaceAll('-', '')}`,
    exportId: '',
    backgroundJobId: '',
    maintenanceJobId: `audit-maintenance-smoke-${randomUUID()}`,
  };
  let succeeded = false;
  let result: SmokeResult | undefined;
  let hasFailure = false;
  let failure: Error | undefined;

  try {
    const admin = await readCurrentUser(
      config,
      config.adminToken,
      'auth-admin',
    );
    const student = await readCurrentUser(
      config,
      config.studentToken,
      'auth-student',
    );
    if (admin.role !== 'ADMIN')
      throw smokeError('auth-admin', 'ADMIN_REQUIRED');
    if (student.role !== 'STUDENT') {
      throw smokeError('auth-student', 'STUDENT_REQUIRED');
    }

    const databaseNow = await readDatabaseClock(runtime.prisma);
    const startAt = new Date(databaseNow.getTime() - 60 * 60 * 1000);
    const endAt = new Date(databaseNow.getTime() - 1000);
    await runtime.prisma.operatorAuditLog.create({
      data: {
        id: run.fixtureAuditId,
        actorUserId: admin.id,
        action: 'OUTBOX_REQUEUE',
        status: 'SUCCEEDED',
        targetType: 'OperatorAuditExportSmokeFixture',
        targetId: run.clientRequestId,
        reason: run.formulaValue,
        requestId: `smoke-${run.clientRequestId}`,
        createdAt: new Date(databaseNow.getTime() - 5000),
      },
    });

    const createBody = {
      clientRequestId: run.clientRequestId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      reason: run.reason,
    };
    await expectForbidden(
      config,
      config.studentToken,
      '/operator-audit-exports',
      {
        method: 'GET',
      },
    );
    await expectForbidden(
      config,
      config.studentToken,
      '/operator-audit-exports',
      {
        method: 'POST',
        body: JSON.stringify(createBody),
        headers: { 'content-type': 'application/json' },
      },
    );

    const created = await requestExportDetail(
      config,
      config.adminToken,
      '/operator-audit-exports',
      {
        method: 'POST',
        body: JSON.stringify(createBody),
        headers: { 'content-type': 'application/json' },
      },
      202,
      'create',
    );
    run.exportId = created.id;
    run.backgroundJobId = created.backgroundJobId;

    const ready = await waitForExportStatus(
      config,
      config.adminToken,
      run.exportId,
      ['READY', 'FAILED'],
      'ready',
    );
    if (ready.status !== 'READY') {
      throw smokeError('ready', ready.errorCode ?? 'EXPORT_FAILED');
    }
    if (
      ready.recordCount === null ||
      ready.csvSha256 === null ||
      ready.archiveSha256 === null ||
      ready.archiveSize === null
    ) {
      throw smokeError('ready', 'READY_FACTS_MISSING');
    }

    await expectForbidden(
      config,
      config.studentToken,
      `/operator-audit-exports/${encodeURIComponent(run.exportId)}/download`,
      { method: 'POST' },
    );

    const archiveBytes = await downloadArchive(
      config,
      config.adminToken,
      ready,
    );
    await verifyOperatorAuditExportArchive({
      archiveBytes,
      exportId: run.exportId,
      startAt: ready.startAt,
      endAt: ready.endAt,
      recordCount: ready.recordCount,
      csvSha256: ready.csvSha256,
      archiveSha256: ready.archiveSha256,
      formulaValue: run.formulaValue,
    });

    const [requestAuditCount, downloadAuditCount] = await Promise.all([
      countSuccessfulAudit(
        runtime.prisma,
        admin.id,
        run.exportId,
        'AUDIT_EXPORT_REQUEST',
      ),
      countSuccessfulAudit(
        runtime.prisma,
        admin.id,
        run.exportId,
        'AUDIT_EXPORT_DOWNLOAD',
      ),
    ]);
    if (requestAuditCount !== 1) {
      throw smokeError('audit', 'REQUEST_AUDIT_COUNT_INVALID');
    }
    if (downloadAuditCount !== 1) {
      throw smokeError('audit', 'DOWNLOAD_AUDIT_COUNT_INVALID');
    }

    const object = await runtime.prisma.operatorAuditExport.findFirst({
      where: {
        id: run.exportId,
        clientRequestId: run.clientRequestId,
        reason: run.reason,
      },
      select: { objectKey: true },
    });
    if (!object?.objectKey) throw smokeError('expire', 'OBJECT_KEY_MISSING');
    const expireNow = await readDatabaseClock(runtime.prisma);
    await runtime.prisma.operatorAuditExport.updateMany({
      where: {
        id: run.exportId,
        status: 'READY',
        clientRequestId: run.clientRequestId,
        reason: run.reason,
      },
      data: { expiresAt: new Date(expireNow.getTime() - 1000) },
    });
    await runtime.maintenanceQueue.add(
      MAINTAIN_OPERATOR_AUDIT_JOB,
      { schemaVersion: 1 },
      {
        jobId: run.maintenanceJobId,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    const expired = await waitForExportStatus(
      config,
      config.adminToken,
      run.exportId,
      ['EXPIRED', 'FAILED'],
      'expire',
    );
    if (expired.status !== 'EXPIRED') {
      throw smokeError('expire', expired.errorCode ?? 'EXPORT_NOT_EXPIRED');
    }
    await expectStatus(
      config,
      config.adminToken,
      `/operator-audit-exports/${encodeURIComponent(run.exportId)}/download`,
      { method: 'POST' },
      410,
      'expired-download',
    );
    if (
      await hasMinioObjects(
        runtime.minio,
        config.minio.bucket,
        exportPrefix(run.exportId),
      )
    ) {
      throw smokeError('expire', 'OBJECT_NOT_DELETED');
    }

    if (!config.keepData) {
      await cleanupFailedSmokeRun(() => cleanupSmokeRun(config, runtime, run));
    }
    succeeded = true;
    result = {
      exportId: run.exportId,
      recordCount: ready.recordCount,
      requestAuditCount,
      downloadAuditCount,
      expired: true,
      objectDeleted: true,
    };
  } catch (error) {
    failure = normalizeThrownError(error);
    hasFailure = true;
  } finally {
    if (!succeeded && !config.keepData) {
      try {
        await cleanupFailedSmokeRun(() =>
          cleanupSmokeRun(config, runtime, run),
        );
      } catch (error) {
        failure = normalizeThrownError(error);
        hasFailure = true;
      }
    }
    const closeResults = await Promise.allSettled([
      runtime.exportQueue.close(),
      runtime.maintenanceQueue.close(),
      runtime.prisma.$disconnect(),
    ]);
    const closeSelection = selectSmokeFailureAfterClose(
      failure,
      hasFailure,
      closeResults,
    );
    hasFailure = closeSelection.hasFailure;
    failure = closeSelection.hasFailure ? closeSelection.failure : undefined;
  }
  if (hasFailure && failure) throw failure;
  if (!result) throw smokeError('unknown', 'RESULT_MISSING');
  return result;
}

export async function cleanupFailedSmokeRun(cleanup: () => Promise<void>) {
  try {
    await cleanup();
  } catch {
    throw smokeError('cleanup', 'CLEANUP_FAILED');
  }
}

export function selectSmokeFailureAfterClose(
  currentFailure: unknown,
  hasCurrentFailure: boolean,
  closeResults: PromiseSettledResult<unknown>[],
): { hasFailure: false } | { hasFailure: true; failure: Error } {
  if (hasCurrentFailure) {
    return { hasFailure: true, failure: normalizeThrownError(currentFailure) };
  }
  return closeResults.some((result) => result.status === 'rejected')
    ? {
        hasFailure: true,
        failure: smokeError('close', 'RESOURCE_CLOSE_FAILED'),
      }
    : { hasFailure: false };
}

function requiredSecret(env: SmokeEnvironment, key: string) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function parseBaseUrl(value: string) {
  const key = 'OPERATOR_AUDIT_EXPORT_SMOKE_BASE_URL';
  try {
    const url = new URL(value.trim());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error('unsafe URL');
    }
    return url.origin;
  } catch {
    throw new Error(`${key} must be a safe HTTP(S) origin`);
  }
}

function parseTimeout(value: string) {
  const key = 'OPERATOR_AUDIT_EXPORT_SMOKE_TIMEOUT_MS';
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 10_000 || parsed > 300_000) {
    throw new Error(`${key} must be an integer between 10000 and 300000`);
  }
  return parsed;
}

function parseBoolean(key: string, value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`${key} must be true or false`);
}

function parsePort(key: string, value: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`${key} must be a valid port`);
  }
  return parsed;
}

function parseBullmqPrefix(value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9:_-]{1,80}$/.test(normalized)) {
    throw new Error('BULLMQ_PREFIX must contain only safe prefix characters');
  }
  return normalized;
}

function safeLabel(value: string) {
  return /^[A-Z0-9_-]{1,80}$/i.test(value) ? value : 'INVALID_LABEL';
}

function sha256(value: Buffer) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function parseManifest(value: Buffer): {
  schemaVersion?: unknown;
  exportId?: unknown;
  range?: { startAt?: unknown; endAt?: unknown };
  recordCount?: unknown;
  recordsFile?: unknown;
  recordsSha256?: unknown;
} {
  try {
    const parsed: unknown = JSON.parse(value.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid manifest');
    }
    return parsed;
  } catch {
    throw smokeError('archive', 'MANIFEST_INVALID');
  }
}

function smokeError(stage: string, code: string) {
  return new OperatorAuditExportSmokeError(stage, code, code);
}

function normalizeThrownError(error: unknown) {
  return error instanceof Error
    ? error
    : smokeError('unknown', 'UNEXPECTED_ERROR');
}

function createRuntime(config: OperatorAuditExportSmokeConfig): SmokeRuntime {
  const redis = parseRedisConnection(config.redisUrl);
  return {
    prisma: new PrismaClient(),
    exportQueue: new Queue(OPERATOR_AUDIT_EXPORT_QUEUE, {
      connection: redis,
      prefix: config.bullmqPrefix,
    }),
    maintenanceQueue: new Queue(OPERATOR_AUDIT_MAINTENANCE_QUEUE, {
      connection: redis,
      prefix: config.bullmqPrefix,
    }),
    minio: new MinioClient(config.minio),
  };
}

function parseRedisConnection(value: string) {
  try {
    const url = new URL(value);
    if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error();
    const database = url.pathname === '/' ? 0 : Number(url.pathname.slice(1));
    if (!Number.isInteger(database) || database < 0) throw new Error();
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password || undefined,
      db: database,
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    };
  } catch {
    throw smokeError('config', 'REDIS_URL_INVALID');
  }
}

async function readCurrentUser(
  config: OperatorAuditExportSmokeConfig,
  token: string,
  stage: string,
): Promise<AuthUser> {
  const data = await requestJson(
    config,
    token,
    '/auth/me',
    { method: 'GET' },
    200,
    stage,
  );
  const parsed = authUserSchema.safeParse(data);
  if (!parsed.success) throw smokeError(stage, 'AUTH_RESPONSE_INVALID');
  return parsed.data;
}

async function requestExportDetail(
  config: OperatorAuditExportSmokeConfig,
  token: string,
  path: string,
  init: RequestInit,
  expectedStatus: number,
  stage: string,
) {
  const data = await requestJson(
    config,
    token,
    path,
    init,
    expectedStatus,
    stage,
  );
  const parsed = operatorAuditExportDetailResponseSchema.safeParse(data);
  if (!parsed.success) throw smokeError(stage, 'EXPORT_RESPONSE_INVALID');
  return parsed.data;
}

async function requestJson(
  config: OperatorAuditExportSmokeConfig,
  token: string,
  path: string,
  init: RequestInit,
  expectedStatus: number,
  stage: string,
): Promise<unknown> {
  const response = await safeFetch(config, token, path, init, stage);
  const text = await response.text();
  if (response.status !== expectedStatus) {
    throw smokeError(stage, readSafeApiCode(text) ?? `HTTP_${response.status}`);
  }
  try {
    const envelope = JSON.parse(text) as Envelope<unknown>;
    if (envelope.success !== true || envelope.data === undefined) {
      throw new Error();
    }
    return envelope.data;
  } catch {
    throw smokeError(stage, 'JSON_ENVELOPE_INVALID');
  }
}

async function expectForbidden(
  config: OperatorAuditExportSmokeConfig,
  token: string,
  path: string,
  init: RequestInit,
) {
  return expectStatus(config, token, path, init, 403, 'student-guard');
}

async function expectStatus(
  config: OperatorAuditExportSmokeConfig,
  token: string,
  path: string,
  init: RequestInit,
  expectedStatus: number,
  stage: string,
) {
  const response = await safeFetch(config, token, path, init, stage);
  await response.arrayBuffer();
  if (response.status !== expectedStatus) {
    throw smokeError(stage, `HTTP_${response.status}`);
  }
}

async function safeFetch(
  config: OperatorAuditExportSmokeConfig,
  token: string,
  path: string,
  init: RequestInit,
  stage: string,
) {
  try {
    return await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...init.headers,
      },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch {
    throw smokeError(stage, 'NETWORK_ERROR');
  }
}

function readSafeApiCode(text: string) {
  try {
    const envelope = JSON.parse(text) as Envelope<unknown>;
    const code = envelope.error?.code;
    return typeof code === 'string' && /^[A-Z0-9_-]{1,120}$/.test(code)
      ? code
      : undefined;
  } catch {
    return undefined;
  }
}

async function waitForExportStatus(
  config: OperatorAuditExportSmokeConfig,
  token: string,
  exportId: string,
  terminalStatuses: Array<OperatorAuditExportDetailResponse['status']>,
  stage: string,
) {
  const deadline = Date.now() + config.timeoutMs;
  while (Date.now() < deadline) {
    const detail = await requestExportDetail(
      config,
      token,
      `/operator-audit-exports/${encodeURIComponent(exportId)}`,
      { method: 'GET' },
      200,
      stage,
    );
    if (terminalStatuses.includes(detail.status)) return detail;
    await sleep(1000);
  }
  throw smokeError(stage, 'TIMEOUT');
}

async function downloadArchive(
  config: OperatorAuditExportSmokeConfig,
  token: string,
  detail: OperatorAuditExportDetailResponse,
) {
  const response = await safeFetch(
    config,
    token,
    `/operator-audit-exports/${encodeURIComponent(detail.id)}/download`,
    { method: 'POST' },
    'download',
  );
  if (response.status !== 200) {
    const text = await response.text();
    throw smokeError(
      'download',
      readSafeApiCode(text) ?? `HTTP_${response.status}`,
    );
  }
  const contentType = response.headers.get('content-type') ?? '';
  const cacheControl = response.headers.get('cache-control') ?? '';
  const disposition = response.headers.get('content-disposition') ?? '';
  const headerSha256 = response.headers.get('x-content-sha256') ?? '';
  const contentLength = Number(response.headers.get('content-length'));
  if (!contentType.toLowerCase().startsWith('application/zip')) {
    throw smokeError('download', 'CONTENT_TYPE_INVALID');
  }
  if (!cacheControl.toLowerCase().includes('no-store')) {
    throw smokeError('download', 'CACHE_CONTROL_INVALID');
  }
  if (!/^attachment; filename="[A-Za-z0-9._-]+\.zip"$/.test(disposition)) {
    throw smokeError('download', 'FILENAME_INVALID');
  }
  if (headerSha256 !== detail.archiveSha256) {
    throw smokeError('download', 'ARCHIVE_HEADER_HASH_MISMATCH');
  }
  const archiveBytes = Buffer.from(await response.arrayBuffer());
  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength !== archiveBytes.length ||
    contentLength !== detail.archiveSize
  ) {
    throw smokeError('download', 'CONTENT_LENGTH_INVALID');
  }
  return archiveBytes;
}

async function readDatabaseClock(prisma: PrismaClient) {
  try {
    const [clock] = await prisma.$queryRaw<Array<{ now: Date }>>`
      SELECT clock_timestamp() AS now
    `;
    if (!clock) throw new Error();
    return clock.now;
  } catch {
    throw smokeError('database', 'DATABASE_CLOCK_FAILED');
  }
}

function countSuccessfulAudit(
  prisma: PrismaClient,
  actorUserId: string,
  exportId: string,
  action: 'AUDIT_EXPORT_REQUEST' | 'AUDIT_EXPORT_DOWNLOAD',
) {
  return prisma.operatorAuditLog.count({
    where: {
      actorUserId,
      action,
      status: 'SUCCEEDED',
      targetType: 'OperatorAuditExport',
      targetId: exportId,
    },
  });
}

async function hasMinioObjects(
  client: MinioClient,
  bucket: string,
  prefix: string,
) {
  return (await listMinioObjects(client, bucket, prefix)).length > 0;
}

function listMinioObjects(client: MinioClient, bucket: string, prefix: string) {
  return new Promise<string[]>((resolve, reject) => {
    const names: string[] = [];
    const stream = client.listObjectsV2(bucket, prefix, true);
    stream.on('data', (item) => {
      if (item.name) names.push(item.name);
    });
    stream.on('error', () =>
      reject(smokeError('storage', 'MINIO_LIST_FAILED')),
    );
    stream.on('end', () => resolve(names));
  });
}

export async function cleanupSmokeRun(
  config: OperatorAuditExportSmokeConfig,
  runtime: SmokeRuntime,
  run: SmokeRun,
) {
  const exactExport = run.exportId
    ? await runtime.prisma.operatorAuditExport.findFirst({
        where: {
          id: run.exportId,
          clientRequestId: run.clientRequestId,
          reason: run.reason,
        },
        select: { id: true, backgroundJobId: true },
      })
    : await runtime.prisma.operatorAuditExport.findFirst({
        where: { clientRequestId: run.clientRequestId, reason: run.reason },
        select: { id: true, backgroundJobId: true },
      });
  const cleanupExportId = exactExport?.id ?? run.exportId;
  const cleanupBackgroundJobId =
    exactExport?.backgroundJobId ?? run.backgroundJobId;
  await settleMaintenanceJob(
    runtime.maintenanceQueue,
    run.maintenanceJobId,
    config.timeoutMs,
  );
  if (cleanupExportId && cleanupBackgroundJobId) {
    await removeExportJobBeforeFacts(
      runtime.exportQueue,
      cleanupExportId,
      cleanupBackgroundJobId,
      config.timeoutMs,
    );
  }
  if (cleanupExportId) {
    const objects = await listMinioObjects(
      runtime.minio,
      config.minio.bucket,
      exportPrefix(cleanupExportId),
    );
    for (const object of objects) {
      await runtime.minio.removeObject(config.minio.bucket, object);
    }
  }
  if (exactExport) {
    run.exportId = exactExport.id;
    run.backgroundJobId = exactExport.backgroundJobId;
    await runtime.prisma.$transaction([
      runtime.prisma.operatorAuditLog.deleteMany({
        where: {
          targetType: 'OperatorAuditExport',
          targetId: exactExport.id,
          reason: run.reason,
        },
      }),
      runtime.prisma.outboxEvent.deleteMany({
        where: {
          aggregateType: 'OperatorAuditExport',
          aggregateId: exactExport.id,
        },
      }),
      runtime.prisma.backgroundJob.deleteMany({
        where: { id: exactExport.backgroundJobId, scope: 'SYSTEM' },
      }),
      runtime.prisma.operatorAuditExport.deleteMany({
        where: {
          id: exactExport.id,
          clientRequestId: run.clientRequestId,
          reason: run.reason,
        },
      }),
    ]);
  }
  await runtime.prisma.operatorAuditLog.deleteMany({
    where: {
      id: run.fixtureAuditId,
      targetType: 'OperatorAuditExportSmokeFixture',
      targetId: run.clientRequestId,
      reason: run.formulaValue,
    },
  });
}

async function settleMaintenanceJob(
  queue: Queue,
  maintenanceJobId: string,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  let job = await queue.getJob(maintenanceJobId);
  while (job) {
    if (!maintenanceJobPayloadSchema.safeParse(job.data).success) {
      throw smokeError('cleanup', 'MAINTENANCE_JOB_MISMATCH');
    }
    const state = await job.getState();
    if (state === 'active') {
      if (Date.now() >= deadline) {
        throw smokeError('cleanup', 'MAINTENANCE_JOB_ACTIVE');
      }
      await sleep(Math.min(250, Math.max(1, deadline - Date.now())));
      job = await queue.getJob(maintenanceJobId);
      continue;
    }
    if (state === 'failed') {
      await job.remove();
      throw smokeError('cleanup', 'MAINTENANCE_JOB_FAILED');
    }
    await job.remove();
    return;
  }
}

async function removeExportJobBeforeFacts(
  queue: Queue,
  exportId: string,
  backgroundJobId: string,
  timeoutMs: number,
) {
  const job = await queue.getJob(backgroundJobId);
  if (!job) return;
  const payload = generateOperatorAuditExportPayloadSchema.safeParse(job.data);
  if (
    !payload.success ||
    payload.data.exportId !== exportId ||
    payload.data.backgroundJobId !== backgroundJobId
  ) {
    throw smokeError('cleanup', 'EXPORT_JOB_MISMATCH');
  }
  const deadline = Date.now() + timeoutMs;
  while (await job.isActive()) {
    if (Date.now() >= deadline) {
      throw smokeError('cleanup', 'EXPORT_JOB_ACTIVE');
    }
    await sleep(Math.min(250, Math.max(1, deadline - Date.now())));
  }
  await job.remove();
}

function exportPrefix(exportId: string) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(exportId)) {
    throw smokeError('cleanup', 'EXPORT_ID_INVALID');
  }
  return `operator-audit-exports/${exportId}/`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  try {
    const config = parseOperatorAuditExportSmokeConfig(process.env);
    const result = await runOperatorAuditExportSmoke(config);
    process.stdout.write(
      [
        'Operator audit export smoke: PASS',
        `export=${result.exportId} records=${result.recordCount} requestAudit=${result.requestAuditCount} downloadAudit=${result.downloadAuditCount} expired=${result.expired} objectDeleted=${result.objectDeleted}`,
      ].join('\n') + '\n',
    );
  } catch (error) {
    process.stderr.write(`${formatOperatorAuditExportSmokeFailure(error)}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();
