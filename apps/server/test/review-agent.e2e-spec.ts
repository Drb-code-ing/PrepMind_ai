import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { reviewAgentSuggestionResponseSchema } from '@repo/types/api/review-agent';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';

import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { ReviewAgentService } from '../src/review-agent/review-agent.service';

describe('ReviewAgentController (e2e)', () => {
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

  it('returns review and planner suggestions for the authenticated user', async () => {
    const user = await registerAndLogin('review-agent-suggestions');

    const response = await request(server)
      .get(
        '/review-agent/suggestions?days=7&startDate=2026-06-22&timezoneOffsetMinutes=-480',
      )
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    const suggestions = reviewAgentSuggestionResponseSchema.parse(
      getSuccessData(response),
    );

    expect(typeof suggestions.review.summary).toBe('string');
    expect(typeof suggestions.planner.headline).toBe('string');
    expect(typeof suggestions.planSummary.dailyMinutes).toBe('number');
    expect(suggestions.modelObservations?.version).toBe(1);
    expect(suggestions.modelObservations?.review).toMatchObject({
      attempted: false,
      provenance: 'local_deterministic',
    });
    expect(suggestions.modelObservations?.planner).toMatchObject({
      attempted: false,
      provenance: 'local_deterministic',
    });
    expect(JSON.stringify(suggestions)).not.toMatch(
      /api.?key|base.?url|prompt|raw.error/i,
    );
  });

  it('rejects unauthenticated review agent suggestion requests', async () => {
    await request(server)
      .get(
        '/review-agent/suggestions?days=7&startDate=2026-06-22&timezoneOffsetMinutes=-480',
      )
      .expect(401);
  });

  it('passes the exact temporary acceptance header separately and never echoes it', async () => {
    const user = await registerAndLogin('review-agent-acceptance-header');
    const capability = 'temporary-e2e-acceptance-capability';
    const service = app.get(ReviewAgentService);
    const getSuggestions = jest.spyOn(service, 'getSuggestions');

    const response = await request(server)
      .get(
        '/review-agent/suggestions?days=7&startDate=2026-06-22&timezoneOffsetMinutes=-480',
      )
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('x-prepmind-review-planner-acceptance', capability)
      .expect(200);

    expect(getSuggestions).toHaveBeenCalledWith(
      user.userId,
      expect.objectContaining({ days: 7 }),
      capability,
    );
    expect(JSON.stringify(response.body)).not.toContain(capability);
    expect(response.headers).not.toHaveProperty(
      'x-prepmind-review-planner-acceptance',
    );
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
