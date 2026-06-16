import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  reviewTaskActionResponseSchema,
  reviewTaskPlanResponseSchema,
  reviewTaskRatingResponseSchema,
  reviewTaskTodayResponseSchema,
} from '@repo/types/api/review-task';
import { reviewStatsResponseSchema } from '@repo/types/api/review';
import type { CreateWrongQuestionRequest } from '@repo/types/api/wrong-question';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';

import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../src/database/prisma.service';

describe('ReviewTasksController (e2e)', () => {
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

  it('returns the current user review task plan without creating tasks', async () => {
    const userA = await registerAndLogin('review-task-plan-a');
    const userB = await registerAndLogin('review-task-plan-b');
    const wrongQuestion = await createWrongQuestion(userA.accessToken, {
      questionText: 'Preview 3 x 7.',
      subject: '数学',
      category: '乘法',
      knowledgePoints: ['乘法'],
      answer: '21',
      analysis: '3 x 7 = 21.',
    });
    const cardResponse = await request(server)
      .post('/reviews/cards/from-wrong-question')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ wrongQuestionId: wrongQuestion.id })
      .expect(201);
    const card = getSuccessData<CreateReviewCardResponse>(cardResponse).card;
    await prisma.card.update({
      where: { id: card.id },
      data: { nextReview: new Date('2026-06-16T08:00:00.000Z') },
    });

    const planResponse = await request(server)
      .get(
        '/review-tasks/plan?startDate=2026-06-16&days=7&timezoneOffsetMinutes=-480',
      )
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);
    const plan = reviewTaskPlanResponseSchema.parse(
      getSuccessData(planResponse),
    );

    expect(plan.startDate).toBe('2026-06-16');
    expect(plan.endDate).toBe('2026-06-22');
    expect(plan.summary.todayDueCount).toBe(1);
    expect(plan.summary.overdueCount).toBe(0);
    expect(plan.summary.upcomingDueCount).toBe(0);
    expect(plan.summary.peakDay).toEqual({ date: '2026-06-16', count: 1 });
    expect(plan.days[0]).toMatchObject({
      date: '2026-06-16',
      dueCount: 1,
      overdueCount: 0,
      estimatedMinutes: 2,
    });
    expect(plan.suggestion).toMatchObject({
      title: '今天保持节奏',
      actionHref: '/today',
    });

    const taskCount = await prisma.reviewTask.count({
      where: { userId: userA.userId, cardId: card.id },
    });
    expect(taskCount).toBe(0);

    const otherPlanResponse = await request(server)
      .get(
        '/review-tasks/plan?startDate=2026-06-16&days=7&timezoneOffsetMinutes=-480',
      )
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(200);
    const otherPlan = reviewTaskPlanResponseSchema.parse(
      getSuccessData(otherPlanResponse),
    );
    expect(otherPlan.summary.todayDueCount).toBe(0);
    expect(otherPlan.summary.peakDay).toBeNull();
  });

  it('rejects review task plan windows longer than 14 days', async () => {
    const user = await registerAndLogin('review-task-plan-invalid');

    await request(server)
      .get(
        '/review-tasks/plan?startDate=2026-06-16&days=15&timezoneOffsetMinutes=-480',
      )
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(400);
  });

  it('runs the persisted review task lifecycle for the current user only', async () => {
    const userA = await registerAndLogin('review-task-a');
    const userB = await registerAndLogin('review-task-b');
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
    await prisma.card.update({
      where: { id: card.id },
      data: { nextReview: new Date('2026-06-14T08:00:00.000Z') },
    });

    const todayResponse = await request(server)
      .get('/review-tasks/today?date=2026-06-14&timezoneOffsetMinutes=-480')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);
    const today = reviewTaskTodayResponseSchema.parse(
      getSuccessData(todayResponse),
    );
    expect(today.pendingCount).toBe(1);
    expect(today.tasks).toHaveLength(1);
    expect(today.tasks[0]?.wrongQuestion?.subject).toBe('数学');
    const task = today.tasks[0];
    expect(task?.status).toBe('PENDING');

    const duplicateCheckResponse = await request(server)
      .get('/review-tasks/today?date=2026-06-14&timezoneOffsetMinutes=-480')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);
    const duplicateCheck = reviewTaskTodayResponseSchema.parse(
      getSuccessData(duplicateCheckResponse),
    );
    expect(duplicateCheck.tasks).toHaveLength(1);

    const otherTodayResponse = await request(server)
      .get('/review-tasks/today?date=2026-06-14&timezoneOffsetMinutes=-480')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(200);
    const otherToday = reviewTaskTodayResponseSchema.parse(
      getSuccessData(otherTodayResponse),
    );
    expect(otherToday.pendingCount).toBe(0);
    expect(otherToday.tasks).toHaveLength(0);

    const skippedResponse = await request(server)
      .post(`/review-tasks/${task?.id}/skip`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(201);
    const skipped = reviewTaskActionResponseSchema.parse(
      getSuccessData(skippedResponse),
    );
    expect(skipped.task.status).toBe('SKIPPED');

    const reopenedResponse = await request(server)
      .post(`/review-tasks/${task?.id}/reopen`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(201);
    const reopened = reviewTaskActionResponseSchema.parse(
      getSuccessData(reopenedResponse),
    );
    expect(reopened.task.status).toBe('PENDING');

    const clientMutationId = '11111111-1111-4111-8111-111111111111';
    const ratingRequest = {
      rating: 3,
      reviewedAt: '2026-06-14T08:00:00.000Z',
      reviewDurationMs: 12000,
      clientMutationId,
    };

    const ratingResponse = await request(server)
      .post(`/review-tasks/${task?.id}/rating`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send(ratingRequest)
      .expect(201);
    const rating = reviewTaskRatingResponseSchema.parse(
      getSuccessData(ratingResponse),
    );
    expect(rating.task.status).toBe('COMPLETED');
    expect(rating.task.reviewLogId).toBe(rating.log.id);
    expect(rating.log.clientMutationId).toBe(clientMutationId);
    expect(rating.card.state).toBe('REVIEW');

    const replayResponse = await request(server)
      .post(`/review-tasks/${task?.id}/rating`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send(ratingRequest)
      .expect(201);
    const replay = reviewTaskRatingResponseSchema.parse(
      getSuccessData(replayResponse),
    );
    expect(replay.log.id).toBe(rating.log.id);
    expect(replay.task.id).toBe(rating.task.id);
    expect(replay.task.reviewLogId).toBe(rating.task.reviewLogId);
    expect(replay.log.clientMutationId).toBe(clientMutationId);

    const logCount = await prisma.reviewLog.count({
      where: { clientMutationId },
    });
    expect(logCount).toBe(1);

    await request(server)
      .post(`/review-tasks/${task?.id}/rating`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({
        ...ratingRequest,
        clientMutationId: '22222222-2222-4222-8222-222222222222',
      })
      .expect(409)
      .expect((response) => {
        expect(getErrorBody(response).error.code).toBe(
          'REVIEW_TASK_NOT_PENDING',
        );
      });

    const pendingOnlyResponse = await request(server)
      .get(
        '/review-tasks/today?date=2026-06-14&timezoneOffsetMinutes=-480&includeCompleted=false',
      )
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);
    const pendingOnly = reviewTaskTodayResponseSchema.parse(
      getSuccessData(pendingOnlyResponse),
    );
    expect(pendingOnly.completedCount).toBe(1);
    expect(pendingOnly.tasks).toHaveLength(0);

    const statsResponse = await request(server)
      .get(
        '/reviews/stats?range=7d&endDate=2026-06-14&timezoneOffsetMinutes=-480',
      )
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);
    const stats = reviewStatsResponseSchema.parse(
      getSuccessData(statsResponse),
    );
    expect(stats.totalReviews).toBe(1);
    expect(stats.ratingCounts.good).toBe(1);
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

function getErrorBody(response: SupertestResponse): ErrorEnvelope {
  const body = response.body as ErrorEnvelope;

  expect(body.success).toBe(false);
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
