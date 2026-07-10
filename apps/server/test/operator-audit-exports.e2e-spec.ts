import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  operatorAuditExportDetailResponseSchema,
  operatorAuditExportListResponseSchema,
} from '@repo/types/api/operator-audit-export';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';

import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { OperatorAuditService } from '../src/operator-audit/operator-audit.service';
import {
  OperatorAuditExportStorageError,
  StorageService,
} from '../src/uploads/storage.service';

const ZIP_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x65, 0x32, 0x65]);
const ARCHIVE_SHA256 = `sha256:${'b'.repeat(64)}`;

describe('OperatorAuditExportController (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  let adminA: TestIdentity;
  let adminB: TestIdentity;
  let student: TestIdentity;
  let readyExportId: string;
  let strictAuditFailureExportId: string | null = null;
  let strictAuditFailureStream: Readable | null = null;
  const emails: string[] = [];
  const exportIds: string[] = [];
  const auditIds: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET ??= 'dev-secret-change-me';
    process.env.DATABASE_URL ??=
      'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind';
    process.env.OPERATOR_AUDIT_ENABLED = 'true';
    process.env.OPERATOR_AUDIT_EXPORT_ENABLED = 'true';
    process.env.SERVER_ROLE = 'api';
    process.env.OPERATOR_AUDIT_MAINTENANCE_ENABLED = 'false';
    process.env.OUTBOX_DISPATCHER_ENABLED = 'false';
    process.env.OPERATOR_AUDIT_FINGERPRINT_SECRET =
      'e2e-operator-audit-fingerprint-secret';

    app = await createApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    const audit = app.get(OperatorAuditService);
    const recordSuccessStrict = audit.recordSuccessStrict.bind(audit);
    jest
      .spyOn(audit, 'recordSuccessStrict')
      .mockImplementation(async (client, input) => {
        if (input.targetId === strictAuditFailureExportId) {
          throw new Error('forced strict audit failure');
        }
        return recordSuccessStrict(client, input);
      });

    adminA = await registerIdentity('admin-a', 'ADMIN');
    adminB = await registerIdentity('admin-b', 'ADMIN');
    student = await registerIdentity('student', 'STUDENT');
    readyExportId = await seedExport(adminA.id, {
      status: 'READY',
      fileName: 'operator-audit-export.zip',
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.operatorAuditLog.deleteMany({
        where: {
          OR: [
            { id: { in: auditIds } },
            { targetId: { in: exportIds }, targetType: 'OperatorAuditExport' },
          ],
        },
      });
      await prisma.operatorAuditExport.deleteMany({
        where: { id: { in: exportIds } },
      });
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    }
    await app?.close();
    delete process.env.OPERATOR_AUDIT_ENABLED;
    delete process.env.OPERATOR_AUDIT_EXPORT_ENABLED;
    delete process.env.OPERATOR_AUDIT_MAINTENANCE_ENABLED;
    delete process.env.OUTBOX_DISPATCHER_ENABLED;
    delete process.env.OPERATOR_AUDIT_FINGERPRINT_SECRET;
    delete process.env.SERVER_ROLE;
  });

  it('returns 404 before authentication when the export gate is disabled', async () => {
    const config = app.get(ConfigService);
    config.set('OPERATOR_AUDIT_EXPORT_ENABLED', false);
    try {
      await request(server).get('/operator-audit-exports').expect(404);
    } finally {
      config.set('OPERATOR_AUDIT_EXPORT_ENABLED', true);
    }
  });

  it('requires authentication when the gates are enabled', async () => {
    await request(server).get('/operator-audit-exports').expect(401);
  });

  it('forbids STUDENT create, list, detail, and download endpoints', async () => {
    const authorization = { Authorization: `Bearer ${student.token}` };
    const endAt = new Date(Date.now() - 60_000);

    await request(server)
      .post('/operator-audit-exports')
      .set(authorization)
      .send({
        clientRequestId: randomUUID(),
        startAt: new Date(endAt.getTime() - 3_600_000).toISOString(),
        endAt: endAt.toISOString(),
        reason: 'Student must never create an export',
      })
      .expect(403);
    await request(server)
      .get('/operator-audit-exports')
      .set(authorization)
      .expect(403);
    await request(server)
      .get(`/operator-audit-exports/${readyExportId}`)
      .set(authorization)
      .expect(403);
    await request(server)
      .post(`/operator-audit-exports/${readyExportId}/download`)
      .set(authorization)
      .expect(403);
  });

  it('allows ADMIN B to download ADMIN A evidence as raw ZIP with safe headers and audit actor B', async () => {
    const response = await request(server)
      .post(`/operator-audit-exports/${readyExportId}/download`)
      .set('Authorization', `Bearer ${adminB.token}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const body = response.body as Buffer;
    expect(Buffer.isBuffer(body)).toBe(true);
    expect([...body.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(response.headers['content-type']).toContain('application/zip');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="operator-audit-export.zip"',
    );
    expect(response.headers['cache-control']).toBe('no-store, private');
    expect(response.headers['x-content-sha256']).toBe(ARCHIVE_SHA256);
    expect(response.headers['content-length']).toBe(String(ZIP_BYTES.length));
    expect(body.toString('utf8')).not.toContain('"success"');
    expect(body.toString('utf8')).not.toContain('"data"');

    const downloadAudit = await prisma.operatorAuditLog.findFirst({
      where: {
        action: 'AUDIT_EXPORT_DOWNLOAD',
        targetType: 'OperatorAuditExport',
        targetId: readyExportId,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(downloadAudit).toMatchObject({
      actorUserId: adminB.id,
      status: 'SUCCEEDED',
    });
  });

  it('lists and reads cross-admin exports without leaking internal fields', async () => {
    const listResponse = await request(server)
      .get(`/operator-audit-exports?requestedByUserId=${adminA.id}&limit=100`)
      .set('Authorization', `Bearer ${adminB.token}`)
      .expect(200);
    const list = operatorAuditExportListResponseSchema.parse(
      getSuccessData(listResponse),
    );
    expect(list.items.some((item) => item.id === readyExportId)).toBe(true);
    expectNoInternals(listResponse.body);

    const detailResponse = await request(server)
      .get(`/operator-audit-exports/${readyExportId}`)
      .set('Authorization', `Bearer ${adminB.token}`)
      .expect(200);
    const detail = operatorAuditExportDetailResponseSchema.parse(
      getSuccessData(detailResponse),
    );
    expect(detail).toMatchObject({
      id: readyExportId,
      requestedByUserId: adminA.id,
      canDownload: true,
    });
    expectNoInternals(detailResponse.body);
  });

  it('returns 410 for an expired export and 409 for FAILED or QUEUED', async () => {
    const expiredId = await seedExport(adminA.id, { status: 'EXPIRED' });
    const failedId = await seedExport(adminA.id, { status: 'FAILED' });
    const queuedId = await seedExport(adminA.id, { status: 'QUEUED' });

    await expectError(expiredId, 410, 'OPERATOR_AUDIT_EXPORT_EXPIRED');
    await expectError(failedId, 409, 'OPERATOR_AUDIT_EXPORT_NOT_READY');
    await expectError(queuedId, 409, 'OPERATOR_AUDIT_EXPORT_NOT_READY');
  });

  it('returns safe 502 and CAS-marks READY failed when storage confirms missing', async () => {
    const missingId = await seedExport(adminA.id, {
      status: 'READY',
      objectKey: `operator-audit-exports/missing_${randomUUID()}/attempts/token.zip`,
    });

    await expectError(missingId, 502, 'OPERATOR_AUDIT_EXPORT_FILE_UNAVAILABLE');

    await expect(
      prisma.operatorAuditExport.findUnique({
        where: { id: missingId },
        select: { status: true, errorCode: true, objectKey: true },
      }),
    ).resolves.toEqual({
      status: 'FAILED',
      errorCode: 'EXPORT_FILE_MISSING',
      objectKey: null,
    });
  });

  it('returns safe 503 without ZIP bytes and destroys the stream when strict audit fails', async () => {
    strictAuditFailureExportId = await seedExport(adminA.id, {
      status: 'READY',
    });

    const response = await request(server)
      .post(`/operator-audit-exports/${strictAuditFailureExportId}/download`)
      .set('Authorization', `Bearer ${adminB.token}`)
      .expect(503);

    expect(getErrorBody(response).error.code).toBe(
      'OPERATOR_AUDIT_EXPORT_AUDIT_FAILED',
    );
    expect(response.headers['content-type']).toContain('application/json');
    expect(JSON.stringify(response.body)).not.toContain('PK');
    expect(strictAuditFailureStream?.destroyed).toBe(true);
    strictAuditFailureExportId = null;
  });

  it('returns legacy and HMAC fingerprints only as opaque correlation values', async () => {
    const legacy = `sha256:${'1'.repeat(64)}`;
    const hmac = `hmac-sha256:${'2'.repeat(64)}`;
    const created = await prisma.operatorAuditLog.createManyAndReturn({
      data: [
        {
          actorUserId: adminA.id,
          action: 'AUDIT_EXPORT_REQUEST',
          status: 'SUCCEEDED',
          targetType: 'FingerprintE2E',
          targetId: `legacy_${randomUUID()}`,
          ipAddressHash: legacy,
          userAgentHash: legacy,
        },
        {
          actorUserId: adminB.id,
          action: 'AUDIT_EXPORT_DOWNLOAD',
          status: 'SUCCEEDED',
          targetType: 'FingerprintE2E',
          targetId: `hmac_${randomUUID()}`,
          ipAddressHash: hmac,
          userAgentHash: hmac,
        },
      ],
      select: { id: true },
    });
    auditIds.push(...created.map((item) => item.id));

    const response = await request(server)
      .get('/operator-audit-logs?targetType=FingerprintE2E&limit=100')
      .set('Authorization', `Bearer ${adminB.token}`)
      .expect(200);
    const serialized = JSON.stringify(getSuccessData(response));

    expect(serialized).toContain(legacy);
    expect(serialized).toContain(hmac);
    expect(serialized).not.toContain('127.0.0.1');
    expect(serialized).not.toContain('Playwright');
  });

  async function createApp() {
    const { AppModule } =
      jest.requireActual<typeof import('../src/app.module')>(
        '../src/app.module',
      );
    const builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StorageService)
      .useValue({
        readOperatorAuditExport: (objectKey: string) => {
          if (objectKey.includes('/missing_')) {
            return Promise.reject(
              new OperatorAuditExportStorageError('missing'),
            );
          }
          const stream = Readable.from([ZIP_BYTES]);
          if (objectKey.includes(strictAuditFailureExportId ?? '__never__')) {
            strictAuditFailureStream = stream;
          }
          return Promise.resolve({
            stream,
            contentType: 'application/zip' as const,
            size: ZIP_BYTES.length,
          });
        },
      });
    const moduleFixture: TestingModule = await builder.compile();
    const instance =
      moduleFixture.createNestApplication<INestApplication<App>>();
    instance.use(cookieParser());
    instance.useGlobalFilters(new HttpExceptionFilter());
    instance.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await instance.init();
    return instance;
  }

  async function registerIdentity(label: string, role: 'ADMIN' | 'STUDENT') {
    const email = `audit-export-api-${label}-${randomUUID()}@example.com`;
    const password = 'Password123!';
    emails.push(email);
    const registered = await request(server)
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    const data = getSuccessData<AuthResponse>(registered);
    if (role === 'ADMIN') {
      await prisma.user.update({ where: { id: data.user.id }, data: { role } });
    }
    const login = await request(server)
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const authenticated = getSuccessData<AuthResponse>(login);
    return {
      id: authenticated.user.id,
      token: authenticated.accessToken,
    };
  }

  async function seedExport(
    requestedByUserId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const id = randomUUID();
    const now = new Date();
    exportIds.push(id);
    await prisma.operatorAuditExport.create({
      data: {
        id,
        requestedByUserId,
        clientRequestId: randomUUID(),
        requestHash: `sha256:${'a'.repeat(64)}`,
        backgroundJobId: randomUUID(),
        status: 'READY',
        startAt: new Date(now.getTime() - 86_400_000),
        endAt: new Date(now.getTime() - 60_000),
        snapshotAt: now,
        reason: `audit export e2e ${id}`,
        objectKey: `operator-audit-exports/${id}/attempts/token.zip`,
        fileName: 'operator-audit-export.zip',
        archiveSize: ZIP_BYTES.length,
        recordCount: 2,
        csvSha256: `sha256:${'c'.repeat(64)}`,
        archiveSha256: ARCHIVE_SHA256,
        completedAt: now,
        expiresAt: new Date(now.getTime() + 86_400_000),
        processingToken: 'must-never-leak',
        leaseExpiresAt: new Date(now.getTime() + 60_000),
        ...overrides,
      },
    });
    return id;
  }

  async function expectError(exportId: string, status: number, code: string) {
    const response = await request(server)
      .post(`/operator-audit-exports/${exportId}/download`)
      .set('Authorization', `Bearer ${adminB.token}`)
      .expect(status);
    expect(getErrorBody(response).error.code).toBe(code);
  }
});

function expectNoInternals(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    'objectKey',
    'requestHash',
    'processingToken',
    'leaseExpiresAt',
    'payload',
    'metadata',
    'secret',
    'cookie',
  ]) {
    expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
}

function getSuccessData<T = unknown>(response: SupertestResponse): T {
  const body = response.body as SuccessEnvelope<T>;
  expect(body.success).toBe(true);
  expect(typeof body.requestId).toBe('string');
  return body.data;
}

function getErrorBody(response: SupertestResponse): ErrorEnvelope {
  const body = response.body as ErrorEnvelope;
  expect(body.success).toBe(false);
  expect(typeof body.requestId).toBe('string');
  return body;
}

function binaryParser(
  response: NodeJS.ReadableStream,
  callback: (error: Error | null, body?: Buffer) => void,
) {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer | string) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', (error: Error) => callback(error));
}

type TestIdentity = { id: string; token: string };
type AuthResponse = {
  accessToken: string;
  user: { id: string };
};
type SuccessEnvelope<T> = { success: true; data: T; requestId: string };
type ErrorEnvelope = {
  success: false;
  error: { code: string; message: string };
  requestId: string;
};
