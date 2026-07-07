import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  outboxEventDetailResponseSchema,
  outboxEventListResponseSchema,
} from '@repo/types/api/outbox';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';

import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../src/database/prisma.service';

describe('OutboxOpsController (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  let token: string;
  const email = `outbox-ops-${Date.now()}@example.com`;
  const testType = `test.outbox.ops.${Date.now()}`;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET ??= 'dev-secret-change-me';
    process.env.OUTBOX_OPS_ENABLED = 'true';
    process.env.DATABASE_URL ??=
      'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind';

    const { AppModule } =
      jest.requireActual<typeof import('../src/app.module')>(
        '../src/app.module',
      );
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();

    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    await prisma.outboxEvent.deleteMany({ where: { type: testType } });

    const register = await request(server).post('/auth/register').send({
      email,
      password: 'Password123!',
    });
    token = getSuccessData<AuthResponse>(register).accessToken;
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { type: testType } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
    delete process.env.OUTBOX_OPS_ENABLED;
  });

  it('requires authentication', async () => {
    await request(server).get('/outbox-events').expect(401);
  });

  it('lists sanitized outbox events', async () => {
    await prisma.outboxEvent.create({
      data: {
        type: testType,
        status: 'DEAD',
        payload: { secret: 'do-not-return' },
        payloadHash: 'sha256:test',
        attempts: 5,
        maxAttempts: 5,
        lastErrorCode: 'TEST_ERROR',
        lastError: 'failed with Bearer secret-token',
      },
    });

    const response = await request(server)
      .get(`/outbox-events?status=DEAD&type=${testType}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const list = outboxEventListResponseSchema.parse(getSuccessData(response));

    expect(list.items).toHaveLength(1);
    expect(JSON.stringify(response.body)).not.toContain('do-not-return');
    expect(JSON.stringify(response.body)).not.toContain('secret-token');
    expect(JSON.stringify(response.body)).not.toContain('aggregateId');
    expect(list.items[0]).toEqual(
      expect.objectContaining({
        type: testType,
        status: 'DEAD',
        canRequeue: true,
      }),
    );
  });

  it('returns sanitized detail and requeues a dead event', async () => {
    const event = await prisma.outboxEvent.create({
      data: {
        type: testType,
        status: 'DEAD',
        payload: { documentId: 'doc_secret' },
        payloadHash: 'sha256:test',
        attempts: 5,
        maxAttempts: 5,
        lastErrorCode: 'TEST_ERROR',
        lastError: 'failed with Bearer secret-token',
      },
    });

    const detailResponse = await request(server)
      .get(`/outbox-events/${event.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const detail = outboxEventDetailResponseSchema.parse(
      getSuccessData(detailResponse),
    );

    expect(detail.lastErrorPreview).toBe('failed with [redacted]');
    expect(JSON.stringify(detailResponse.body)).not.toContain('doc_secret');
    expect(JSON.stringify(detailResponse.body)).not.toContain('secret-token');

    const requeuedResponse = await request(server)
      .post(`/outbox-events/${event.id}/requeue`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'fixed test config' })
      .expect(201);
    const requeued = outboxEventDetailResponseSchema.parse(
      getSuccessData(requeuedResponse),
    );

    expect(requeued.status).toBe('PENDING');
    expect(requeued.attempts).toBe(0);
    expect(requeued.canRequeue).toBe(false);
  });
});

function getSuccessData<T = unknown>(response: SupertestResponse): T {
  const body = response.body as SuccessEnvelope<T>;

  expect(body.success).toBe(true);
  expect(typeof body.requestId).toBe('string');
  return body.data;
}

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  requestId: string;
};

type AuthResponse = {
  accessToken: string;
};
