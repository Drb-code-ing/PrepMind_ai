import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { conversationContextPrepareResponseSchema } from '@repo/types/api/conversation-context';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { CONVERSATION_STATE_REDIS } from '../src/conversation-context/conversation-state-cache.service';
import { PrismaService } from '../src/database/prisma.service';

describe('ConversationContextController (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  const emails: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET ??= 'dev-secret-change-me';
    process.env.DATABASE_URL =
      'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind';

    const redis = {
      get: jest.fn().mockRejectedValue(new Error('raw redis secret text')),
      set: jest.fn().mockRejectedValue(new Error('raw redis secret text')),
      del: jest.fn().mockRejectedValue(new Error('raw redis secret text')),
      disconnect: jest.fn(),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CONVERSATION_STATE_REDIS)
      .useValue(redis)
      .compile();

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
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    }
    await app?.close();
  });

  it('prepares sanitized state, isolates ownership, rejects internal fields, and cascades', async () => {
    const owner = await registerUser('context-owner');
    const other = await registerUser('context-other');
    const sync = await request(server)
      .post('/chat-messages/sync')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        messages: [
          {
            id: `u-${Date.now()}`,
            role: 'USER',
            content: '复习导数',
            order: 0,
          },
          {
            id: `a-${Date.now()}`,
            role: 'ASSISTANT',
            content: '先看定义',
            order: 1,
          },
        ],
      })
      .expect(201);
    const conversationId = getSuccessData<{ conversationId: string }>(
      sync,
    ).conversationId;

    const preparedResponse = await request(server)
      .post('/conversation-context/prepare')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        conversationId,
        maxInputTokens: 2500,
        statePatch: { activeGoal: '复习导数', activeQuestionId: 'question_1' },
      })
      .expect(201);
    const prepared = conversationContextPrepareResponseSchema.parse(
      getSuccessData(preparedResponse),
    );
    expect(prepared).toMatchObject({
      conversationId,
      summaryStatus: 'not_needed',
      state: {
        conversationId,
        activeGoal: '复习导数',
        activeQuestionId: 'question_1',
        stateVersion: 1,
      },
      debug: { uncoveredMessageCount: 2, modelMode: 'none' },
    });
    expect(JSON.stringify(prepared)).not.toContain('raw redis secret text');

    await request(server)
      .post('/conversation-context/prepare')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ conversationId, maxInputTokens: 2500 })
      .expect(404)
      .expect((response) => {
        expect(getErrorBody(response).error.code).toBe(
          'CHAT_CONVERSATION_NOT_FOUND',
        );
      });

    await request(server)
      .post('/conversation-context/prepare')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        conversationId,
        maxInputTokens: 2500,
        statePatch: { pendingActionProposal: { unsafe: true } },
      })
      .expect(400);

    await request(server)
      .delete(`/chat-messages?conversationId=${conversationId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    await expect(
      prisma.conversationState.findUnique({ where: { conversationId } }),
    ).resolves.toBeNull();
  });

  async function registerUser(label: string) {
    const email = `conversation-context-${label}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}@example.com`;
    emails.push(email);
    const response = await request(server)
      .post('/auth/register')
      .send({ email, password: 'Passw0rd!2026', name: label })
      .expect(201);
    const data = getSuccessData<AuthResponse>(response);
    return { accessToken: data.accessToken, userId: data.user.id };
  }
});

function getSuccessData<T = unknown>(response: SupertestResponse): T {
  const body = response.body as SuccessEnvelope<T>;
  expect(body.success).toBe(true);
  return body.data;
}

function getErrorBody(response: SupertestResponse): ErrorEnvelope {
  const body = response.body as ErrorEnvelope;
  expect(body.success).toBe(false);
  return body;
}

type SuccessEnvelope<T> = { success: true; data: T; requestId: string };
type ErrorEnvelope = {
  success: false;
  error: { code: string; message: string };
  requestId: string;
};
type AuthResponse = { user: { id: string }; accessToken: string };
