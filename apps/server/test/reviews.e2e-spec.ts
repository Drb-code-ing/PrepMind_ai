import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  reviewLogListResponseSchema,
  reviewStatsResponseSchema,
} from '@repo/types/api/review';
import type { CreateWrongQuestionRequest } from '@repo/types/api/wrong-question';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../src/database/prisma.service';

describe('ReviewsController (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  const emails: string[] = [];

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

  afterAll(async () => {
    if (emails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: emails } },
      });
    }

    await app.close();
  });

  it('returns review stats and logs for the current user only', async () => {
    const userA = await registerAndLogin('review-stats-a');
    const userB = await registerAndLogin('review-stats-b');
    const wrongQuestion = await createWrongQuestion(userA.accessToken, {
      questionText: 'Compute 2 + 2.',
      subject: '数学',
      category: '基础运算',
      knowledgePoints: ['加法'],
      answer: '4',
      analysis: '2 + 2 = 4.',
    });
    const cardResponse = await request(server)
      .post('/reviews/cards/from-wrong-question')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ wrongQuestionId: wrongQuestion.id })
      .expect(201);
    const card = getSuccessData<CreateReviewCardResponse>(cardResponse).card;

    await request(server)
      .post(`/reviews/cards/${card.id}/rating`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({
        rating: 3,
        reviewedAt: '2026-06-14T08:00:00.000Z',
        reviewDurationMs: 12000,
      })
      .expect(201);

    const statsResponse = await request(server)
      .get('/reviews/stats?range=7d&endDate=2026-06-14&timezoneOffsetMinutes=-480')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);
    const stats = reviewStatsResponseSchema.parse(getSuccessData(statsResponse));
    expect(stats.totalReviews).toBe(1);
    expect(stats.ratingCounts.good).toBe(1);
    expect(stats.dailyReviews).toHaveLength(7);

    const logsResponse = await request(server)
      .get('/reviews/logs?page=1&pageSize=20')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);
    const logs = reviewLogListResponseSchema.parse(getSuccessData(logsResponse));
    expect(logs.total).toBe(1);
    expect(logs.items[0]?.wrongQuestion?.subject).toBe('数学');

    const otherStatsResponse = await request(server)
      .get('/reviews/stats?range=7d&endDate=2026-06-14&timezoneOffsetMinutes=-480')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(200);
    const otherStats = reviewStatsResponseSchema.parse(
      getSuccessData(otherStatsResponse),
    );
    expect(otherStats.totalReviews).toBe(0);
  });

  async function registerAndLogin(label: string) {
    const email = `${label}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}@example.com`;
    emails.push(email);

    const response = await request(server)
      .post('/auth/register')
      .send({
        email,
        password: 'Passw0rd!2026',
        name: label,
      })
      .expect(201);
    const data = getSuccessData<AuthResponse>(response);

    return {
      accessToken: data.accessToken,
      userId: data.user.id,
    };
  }

  async function createWrongQuestion(
    accessToken: string,
    payload: Partial<CreateWrongQuestionRequest>,
  ) {
    const response = await request(server)
      .post('/wrong-questions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        source: 'MANUAL',
        questionText: 'Compute 2 + 2.',
        subject: '数学',
        category: '基础运算',
        knowledgePoints: ['加法'],
        analysis: '2 + 2 = 4.',
        answer: '4',
        ...payload,
      })
      .expect(201);

    return getSuccessData<WrongQuestionResponse>(response);
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

type WrongQuestionResponse = {
  id: string;
  questionText: string;
  subject: string;
};

type CreateReviewCardResponse = {
  card: {
    id: string;
  };
  created: boolean;
};
