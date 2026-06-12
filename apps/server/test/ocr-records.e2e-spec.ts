import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';
import {
  ocrRecordListResponseSchema,
  ocrRecordSchema,
} from '@repo/types/api/ocr-record';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../src/database/prisma.service';

describe('OcrRecordsController (e2e)', () => {
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

  it('creates, upserts, lists, reads, isolates, and deletes OCR records', async () => {
    const owner = await registerUser('ocr-owner');
    const other = await registerUser('ocr-other');
    const groupId = `ocr-group-${Date.now()}`;

    const createResponse = await request(server)
      .post('/ocr-records')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        groupId,
        rawText: '## 识别结果\n题目\n\n## 题目\n计算极限。',
        parsedJson: {
          isQuestion: true,
          questionText: '计算极限。',
          knowledgePoints: ['极限'],
        },
        status: 'DONE',
      })
      .expect(201);

    const created = ocrRecordSchema.parse(getSuccessData(createResponse));
    expect(created.userId).toBe(owner.userId);
    expect(created.groupId).toBe(groupId);
    expect(created.parsedJson?.isQuestion).toBe(true);

    const upsertResponse = await request(server)
      .post('/ocr-records')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        groupId,
        rawText: '## 识别结果\n非题目\n\n## 内容说明\n普通图片。',
        parsedJson: {
          isQuestion: false,
          nonQuestionSummary: '普通图片。',
        },
        status: 'DONE',
      })
      .expect(201);

    const upserted = ocrRecordSchema.parse(getSuccessData(upsertResponse));
    expect(upserted.id).toBe(created.id);
    expect(upserted.rawText).toContain('非题目');
    expect(upserted.parsedJson?.isQuestion).toBe(false);

    const listResponse = await request(server)
      .get('/ocr-records?isQuestion=false&keyword=普通')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const list = ocrRecordListResponseSchema.parse(
      getSuccessData(listResponse),
    );
    expect(list.items).toHaveLength(1);
    expect(list.items[0].id).toBe(created.id);
    expect(list.total).toBe(1);

    const detailResponse = await request(server)
      .get(`/ocr-records/${created.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(ocrRecordSchema.parse(getSuccessData(detailResponse)).id).toBe(
      created.id,
    );

    await request(server)
      .get(`/ocr-records/${created.id}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .expect(404)
      .expect((response) => {
        expect(getErrorBody(response).error.code).toBe('OCR_RECORD_NOT_FOUND');
      });

    await request(server)
      .post('/ocr-records')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        groupId: `${groupId}-base64`,
        rawText: 'text',
        imageUrl: 'data:image/png;base64,abc',
      })
      .expect(400)
      .expect((response) => {
        expect(getErrorBody(response).error.code).toBe(
          'OCR_RECORD_IMAGE_NOT_SUPPORTED',
        );
      });

    await request(server)
      .delete(`/ocr-records/${created.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(getSuccessData(response)).toEqual({ ok: true });
      });
  });

  async function registerUser(label: string) {
    const email = `ocr-record-${label}-${Date.now()}-${Math.random()
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
