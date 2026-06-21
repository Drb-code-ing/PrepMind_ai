import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';
import { chatMessagesResponseSchema } from '@repo/types/api/chat-message';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../src/database/prisma.service';

describe('ChatMessagesController (e2e)', () => {
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

    await app?.close();
  });

  it('syncs, lists, isolates, and clears current user chat messages', async () => {
    const owner = await registerUser('chat-owner');
    const other = await registerUser('chat-other');

    const syncResponse = await request(server)
      .post('/chat-messages/sync')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        messages: [
          {
            id: `user-${Date.now()}`,
            role: 'USER',
            content: 'Explain Green theorem',
            order: 0,
            createdAt: '2026-06-11T00:00:00.000Z',
          },
          {
            id: `assistant-${Date.now()}`,
            role: 'ASSISTANT',
            content: 'Use boundary orientation first.',
            order: 1,
            createdAt: '2026-06-11T00:00:01.000Z',
          },
        ],
      })
      .expect(201);

    const synced = chatMessagesResponseSchema.parse(
      getSuccessData(syncResponse),
    );
    expect(synced.conversationId).toEqual(expect.any(String));
    expect(synced.messages).toHaveLength(2);
    expect(synced.messages[0].userId).toBe(owner.userId);

    const listResponse = await request(server)
      .get(`/chat-messages?conversationId=${synced.conversationId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const listed = chatMessagesResponseSchema.parse(
      getSuccessData(listResponse),
    );
    expect(listed.conversationId).toBe(synced.conversationId);
    expect(listed.messages.map((message) => message.content)).toEqual([
      'Explain Green theorem',
      'Use boundary orientation first.',
    ]);

    await request(server)
      .get(`/chat-messages?conversationId=${synced.conversationId}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(getSuccessData(response)).toEqual({
          conversationId: null,
          messages: [],
        });
      });

    await request(server)
      .post('/chat-messages/sync')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({
        conversationId: synced.conversationId,
        messages: [],
      })
      .expect(404)
      .expect((response) => {
        const body = getErrorBody(response);
        expect(body.error.code).toBe('CHAT_CONVERSATION_NOT_FOUND');
      });

    await request(server)
      .delete(`/chat-messages?conversationId=${synced.conversationId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(getSuccessData(response)).toEqual({ ok: true });
      });

    const afterClearResponse = await request(server)
      .get(`/chat-messages?conversationId=${synced.conversationId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(getSuccessData(afterClearResponse)).toEqual({
      conversationId: null,
      messages: [],
    });
  });

  it('rejects incomplete chat snapshots before replacing server history', async () => {
    const owner = await registerUser('chat-incomplete');

    await request(server)
      .post('/chat-messages/sync')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        messages: [
          {
            id: `user-only-${Date.now()}`,
            role: 'USER',
            content: 'This request did not receive an assistant reply.',
            order: 0,
            createdAt: '2026-06-21T00:00:00.000Z',
          },
        ],
      })
      .expect(400)
      .expect((response) => {
        const body = getErrorBody(response);
        expect(body.error.code).toBe('CHAT_SYNC_INCOMPLETE_ASSISTANT');
      });
  });

  async function registerUser(label: string) {
    const email = `chat-message-${label}-${Date.now()}-${Math.random()
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
