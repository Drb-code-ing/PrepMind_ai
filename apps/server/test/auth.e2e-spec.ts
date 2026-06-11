import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';
import { authResponseSchema, authUserSchema } from '@repo/types/api/auth';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../src/database/prisma.service';

const REFRESH_COOKIE_NAME = 'prepmind_refresh';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  let email: string;
  let shouldCleanup = false;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET ??= 'dev-secret-change-me';
    process.env.DATABASE_URL ??=
      'postgresql://prepmind:devpass@localhost:5432/prepmind';

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
  });

  afterEach(async () => {
    if (!email || !shouldCleanup) return;

    await prisma.user.deleteMany({
      where: { email },
    });

    shouldCleanup = false;
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, authenticates, refreshes, and logs out with http-only refresh cookies', async () => {
    email = `student-${Date.now()}@example.com`;
    const password = 'Passw0rd!2026';

    const registerResponse = await request(server)
      .post('/auth/register')
      .send({
        email,
        password,
        name: 'Phase 2 Student',
      })
      .expect(201);

    const registered = authResponseSchema.parse(
      getSuccessData(registerResponse),
    );
    const registerCookie = getRefreshCookie(registerResponse);
    shouldCleanup = true;

    expect(registered.user.email).toBe(email);
    expect(registered.user.name).toBe('Phase 2 Student');
    expect(registerCookie).toContain(`${REFRESH_COOKIE_NAME}=`);
    expect(registerCookie).toContain('HttpOnly');

    const loginResponse = await request(server)
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(201);

    const loggedIn = authResponseSchema.parse(getSuccessData(loginResponse));
    const loginCookie = getRefreshCookie(loginResponse);

    expect(loggedIn.user.id).toBe(registered.user.id);
    expect(loggedIn.accessToken).toEqual(expect.any(String));

    const meResponse = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${loggedIn.accessToken}`)
      .expect(200);

    const me = authUserSchema.parse(getSuccessData(meResponse));
    expect(me.id).toBe(registered.user.id);
    expect(me.email).toBe(email);

    const refreshResponse = await request(server)
      .post('/auth/refresh')
      .set('Cookie', loginCookie)
      .expect(201);

    const refreshed = authResponseSchema.parse(getSuccessData(refreshResponse));
    const refreshedCookie = getRefreshCookie(refreshResponse);

    expect(refreshed.user.id).toBe(registered.user.id);
    expect(refreshed.accessToken).toEqual(expect.any(String));
    expect(refreshedCookie).not.toBe(loginCookie);

    await request(server)
      .post('/auth/refresh')
      .set('Cookie', loginCookie)
      .expect(401)
      .expect((response) => {
        const body = getErrorBody(response);

        expect(body.success).toBe(false);
        expect(body.error.code).toBe('AUTH_REFRESH_REUSED');
        expect(getRefreshCookie(response)).toContain(
          `${REFRESH_COOKIE_NAME}=;`,
        );
      });

    await request(server)
      .post('/auth/refresh')
      .set('Cookie', refreshedCookie)
      .expect(401)
      .expect((response) => {
        const body = getErrorBody(response);

        expect(body.success).toBe(false);
        expect(body.error.code).toBe('AUTH_REFRESH_INVALID');
      });

    const reloginResponse = await request(server)
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(201);
    const reloginCookie = getRefreshCookie(reloginResponse);

    await request(server)
      .post('/auth/logout')
      .set('Cookie', reloginCookie)
      .expect(201)
      .expect((response) => {
        expect(getSuccessData(response)).toEqual({ ok: true });
        expect(getRefreshCookie(response)).toContain(
          `${REFRESH_COOKIE_NAME}=;`,
        );
      });

    await request(server)
      .post('/auth/refresh')
      .set('Cookie', reloginCookie)
      .expect(401)
      .expect((response) => {
        const body = getErrorBody(response);

        expect(body.success).toBe(false);
        expect(body.error.code).toBe('AUTH_REFRESH_INVALID');
      });
  });
});

function getRefreshCookie(response: SupertestResponse): string {
  const setCookieHeader = response.headers['set-cookie'] as
    | string
    | string[]
    | undefined;
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const cookie = cookies.find((value) =>
    value.startsWith(`${REFRESH_COOKIE_NAME}=`),
  );

  expect(cookie).toBeDefined();
  return cookie!;
}

function getSuccessData(response: SupertestResponse): unknown {
  const body = response.body as SuccessEnvelope<unknown>;

  expect(body.success).toBe(true);
  expect(typeof body.requestId).toBe('string');
  return body.data;
}

function getErrorBody(response: SupertestResponse): ErrorEnvelope {
  const body = response.body as ErrorEnvelope;

  expect(typeof body.requestId).toBe('string');
  return body;
}

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  requestId: string;
};

type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId: string;
};
