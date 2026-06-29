import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  agentTraceDetailResponseSchema,
  agentTraceListResponseSchema,
  agentTraceSummaryResponseSchema,
} from '@repo/types/api/agent-trace';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';

import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../src/database/prisma.service';

describe('AgentTracesController (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  const emails: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET ??= 'dev-secret-change-me';
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
  });

  afterAll(async () => {
    if (emails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: emails } },
      });
    }

    if (app) {
      await app.close();
    }
  });

  it('records and returns agent traces for the authenticated user', async () => {
    const user = await registerAndLogin('agent-traces-owner');
    const runId = `trace-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const createResponse = await request(server)
      .post('/agent-traces')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send(createTracePayload(runId))
      .expect(201);
    const created = agentTraceDetailResponseSchema.parse(
      getSuccessData(createResponse),
    );

    expect(created.run.id).toBe(runId);
    expect(created.run.userId).toBe(user.userId);
    expect(created.run.status).toBe('degraded');
    expect(created.run.inputPreview?.length).toBeLessThanOrEqual(80);
    expect(created.steps[0]?.inputSummary).toContain(
      'DEEPSEEK_API_KEY=[redacted]',
    );

    const listResponse = await request(server)
      .get('/agent-traces?limit=5&mode=live&status=degraded')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    const list = agentTraceListResponseSchema.parse(
      getSuccessData(listResponse),
    );

    expect(list.runs.some((run) => run.id === runId)).toBe(true);

    const summaryResponse = await request(server)
      .get('/agent-traces/summary?days=7')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    const summary = agentTraceSummaryResponseSchema.parse(
      getSuccessData(summaryResponse),
    );

    expect(summary.totalRuns).toBeGreaterThanOrEqual(1);
    expect(summary.liveRuns).toBeGreaterThanOrEqual(1);
    expect(
      summary.routeBreakdown.some((item) => item.route === 'rag_answer'),
    ).toBe(true);

    const detailResponse = await request(server)
      .get(`/agent-traces/${runId}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    const detail = agentTraceDetailResponseSchema.parse(
      getSuccessData(detailResponse),
    );

    expect(detail.run.id).toBe(runId);
    expect(detail.steps).toHaveLength(1);
  });

  it('does not expose traces across users', async () => {
    const owner = await registerAndLogin('agent-traces-owner-isolation');
    const other = await registerAndLogin('agent-traces-other-isolation');
    const runId = `trace-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    await request(server)
      .post('/agent-traces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send(createTracePayload(runId))
      .expect(201);

    await request(server)
      .get(`/agent-traces/${runId}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .expect(404);
  });

  it('rejects unauthenticated trace requests', async () => {
    await request(server).get('/agent-traces').expect(401);
  });

  async function registerAndLogin(label: string) {
    const email = `${label}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}@example.com`;
    const password = 'Passw0rd!2026';
    emails.push(email);

    await request(server)
      .post('/auth/register')
      .send({
        email,
        password,
        name: label,
      })
      .expect(201);

    const response = await request(server)
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);
    const data = getSuccessData<AuthResponse>(response);

    return {
      accessToken: data.accessToken,
      userId: data.user.id,
    };
  }
});

function createTracePayload(runId: string) {
  return {
    runId,
    conversationId: null,
    route: 'rag_answer',
    confidence: 0.91,
    status: 'degraded',
    mode: 'live',
    modelProvider: 'deepseek',
    modelName: 'deepseek-v4-flash',
    inputTokenEstimate: 800,
    outputTokenEstimate: 1200,
    maxOutputTokens: 1200,
    pricingKnown: false,
    costEstimate: 0.0034,
    ragHitCount: 2,
    verifierStatus: 'suspicious',
    verifierChunkCount: 2,
    degraded: true,
    inputHash: 'hash_2',
    inputPreview: '根据我的资料回答'.repeat(20),
    startedAt: '2026-06-28T08:00:00.000Z',
    finishedAt: '2026-06-28T08:00:02.000Z',
    totalDurationMs: 2000,
    steps: [
      {
        node: 'RouterAgent',
        status: 'completed',
        startedAt: '2026-06-28T08:00:00.000Z',
        finishedAt: '2026-06-28T08:00:00.020Z',
        durationMs: 20,
        inputSummary: '资料型问题 DEEPSEEK_API_KEY=sk-secret',
        outputSummary: 'route=rag_answer',
        errorMessage: null,
      },
    ],
  };
}

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
  user: {
    id: string;
  };
  accessToken: string;
};
