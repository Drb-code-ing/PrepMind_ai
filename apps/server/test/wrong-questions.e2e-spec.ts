import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../src/database/prisma.service';

describe('WrongQuestionsController (e2e)', () => {
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

  it('creates, lists, reads, updates, and deletes wrong questions for the current user', async () => {
    const user = await registerUser('owner');
    const sourceGroupId = `ocr-group-${Date.now()}`;

    const createResponse = await request(server)
      .post('/wrong-questions')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        source: 'OCR',
        sourceRecordId: 'ocr-record-1',
        sourceGroupId,
        imageUrl: 'https://cdn.example.com/question.png',
        questionText: '计算曲线积分。',
        subject: '高等数学',
        category: '曲线积分',
        knowledgePoints: ['格林公式', '曲线积分'],
        analysis: '使用格林公式转化为二重积分。',
        answer: '12',
        errorType: '概念混淆',
        userNote: '注意正向边界。',
        rawContent: 'OCR raw markdown',
      })
      .expect(201);

    const created = getSuccessData<WrongQuestionResponse>(createResponse);
    expect(created.id).toEqual(expect.any(String));
    expect(created.userId).toBe(user.userId);
    expect(created.source).toBe('OCR');
    expect(created.sourceGroupId).toBe(sourceGroupId);
    expect(created.status).toBe('UNRESOLVED');

    const listResponse = await request(server)
      .get('/wrong-questions?subject=高等数学&keyword=格林')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    const list = getSuccessData<WrongQuestionListResponse>(listResponse);
    expect(list.items).toHaveLength(1);
    expect(list.items[0].id).toBe(created.id);
    expect(list.total).toBe(1);
    expect(list.page).toBe(1);
    expect(list.pageSize).toBe(20);

    const detailResponse = await request(server)
      .get(`/wrong-questions/${created.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    expect(getSuccessData<WrongQuestionResponse>(detailResponse).id).toBe(
      created.id,
    );

    const updateResponse = await request(server)
      .patch(`/wrong-questions/${created.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        status: 'RESOLVED',
        userNote: '已掌握，复习时看面积方向。',
      })
      .expect(200);

    const updated = getSuccessData<WrongQuestionResponse>(updateResponse);
    expect(updated.status).toBe('RESOLVED');
    expect(updated.userNote).toBe('已掌握，复习时看面积方向。');

    await request(server)
      .delete(`/wrong-questions/${created.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(getSuccessData(response)).toEqual({ ok: true });
      });

    await request(server)
      .get(`/wrong-questions/${created.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(404)
      .expect((response) => {
        const body = getErrorBody(response);
        expect(body.error.code).toBe('WRONG_QUESTION_NOT_FOUND');
      });
  });

  it('does not expose another user wrong question and rejects duplicate source groups', async () => {
    const owner = await registerUser('owner-isolation');
    const other = await registerUser('other-isolation');
    const sourceGroupId = `duplicate-group-${Date.now()}`;

    const createResponse = await request(server)
      .post('/wrong-questions')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send(buildWrongQuestionPayload({ sourceGroupId }))
      .expect(201);
    const created = getSuccessData<WrongQuestionResponse>(createResponse);

    await request(server)
      .get(`/wrong-questions/${created.id}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .expect(404)
      .expect((response) => {
        const body = getErrorBody(response);
        expect(body.error.code).toBe('WRONG_QUESTION_NOT_FOUND');
      });

    await request(server)
      .post('/wrong-questions')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send(buildWrongQuestionPayload({ sourceGroupId }))
      .expect(409)
      .expect((response) => {
        const body = getErrorBody(response);
        expect(body.error.code).toBe('WRONG_QUESTION_DUPLICATED');
      });
  });

  async function registerUser(label: string) {
    const email = `wrong-question-${label}-${Date.now()}-${Math.random()
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
});

function buildWrongQuestionPayload(input: { sourceGroupId: string }) {
  return {
    source: 'OCR',
    sourceGroupId: input.sourceGroupId,
    questionText: '判断函数极限是否存在。',
    subject: '高等数学',
    category: '极限',
    knowledgePoints: ['极限定义'],
    analysis: '从左右极限分别讨论。',
    answer: '不存在',
    errorType: '计算错误',
    rawContent: 'raw',
  };
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
  userId: string;
  source: 'OCR' | 'MANUAL' | 'CHAT';
  sourceRecordId: string | null;
  sourceGroupId: string | null;
  imageUrl: string | null;
  questionText: string;
  subject: string;
  category: string;
  knowledgePoints: string[];
  analysis: string;
  answer: string;
  errorType: string | null;
  userNote: string | null;
  rawContent: string | null;
  status: 'UNRESOLVED' | 'RESOLVED';
  createdAt: string;
  updatedAt: string;
};

type WrongQuestionListResponse = {
  items: WrongQuestionResponse[];
  total: number;
  page: number;
  pageSize: number;
};
