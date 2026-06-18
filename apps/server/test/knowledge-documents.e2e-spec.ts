import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';
import {
  knowledgeDocumentDeleteResponseSchema,
  knowledgeDocumentListResponseSchema,
  knowledgeDocumentUploadResponseSchema,
} from '@repo/types/api/knowledge';

import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../src/database/prisma.service';

describe('KnowledgeDocumentsController (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let server: App;
  let prisma: PrismaService | undefined;
  const emails: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET ??= 'dev-secret-change-me';
    process.env.DATABASE_URL ??=
      'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind';
    process.env.MINIO_ENDPOINT = '127.0.0.1';
    process.env.MINIO_PORT = '9000';
    process.env.MINIO_USE_SSL = 'false';
    process.env.MINIO_ACCESS_KEY = 'minioadmin';
    process.env.MINIO_SECRET_KEY = 'minioadmin';
    process.env.MINIO_BUCKET = 'prepmind-dev-test';
    process.env.PUBLIC_API_BASE_URL = 'http://localhost:3001';
    process.env.UPLOAD_DOCUMENT_MAX_BYTES = String(20 * 1024 * 1024);

    const { AppModule } =
      jest.requireActual<typeof import('../src/app.module')>('../src/app.module');
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
    if (prisma && emails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: emails } },
      });
    }

    await app?.close();
  });

  it('requires authentication for document uploads', async () => {
    await request(server)
      .post('/knowledge/documents')
      .attach('file', Buffer.from('%PDF'), {
        filename: 'calculus.pdf',
        contentType: 'application/pdf',
      })
      .expect(401);
  });

  it('rejects unsupported document types', async () => {
    const user = await registerUser('knowledge-invalid');

    await request(server)
      .post('/knowledge/documents')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .attach('file', Buffer.from('zip'), {
        filename: 'archive.zip',
        contentType: 'application/zip',
      })
      .expect(400)
      .expect((response) => {
        expect(getErrorBody(response).error.code).toBe(
          'KNOWLEDGE_DOCUMENT_INVALID_TYPE',
        );
      });
  });

  it('uploads, lists, reads, and deletes a knowledge document', async () => {
    const user = await registerUser('knowledge-valid');

    const uploadResponse = await request(server)
      .post('/knowledge/documents')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'calculus.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const uploaded = knowledgeDocumentUploadResponseSchema.parse(
      getSuccessData(uploadResponse),
    );
    expect(uploaded.name).toBe('calculus.pdf');
    expect(uploaded.status).toBe('PENDING');
    expect(uploaded.sourceType).toBe('UPLOAD');
    expect(uploaded.chunkCount).toBe(0);

    const listResponse = await request(server)
      .get('/knowledge/documents?status=PENDING&sourceType=UPLOAD')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    const list = knowledgeDocumentListResponseSchema.parse(
      getSuccessData(listResponse),
    );
    expect(list.items.some((item) => item.id === uploaded.id)).toBe(true);

    await request(server)
      .get(`/knowledge/documents/${uploaded.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(getSuccessData(response)).toMatchObject({ id: uploaded.id });
      });

    const deleteResponse = await request(server)
      .delete(`/knowledge/documents/${uploaded.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(
      knowledgeDocumentDeleteResponseSchema.parse(getSuccessData(deleteResponse)),
    ).toEqual({ ok: true });

    await request(server)
      .get(`/knowledge/documents/${uploaded.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(404);
  });

  it('does not expose documents across users', async () => {
    const userA = await registerUser('knowledge-user-a');
    const userB = await registerUser('knowledge-user-b');

    const uploadResponse = await request(server)
      .post('/knowledge/documents')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .attach('file', Buffer.from('notes'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    const uploaded = knowledgeDocumentUploadResponseSchema.parse(
      getSuccessData(uploadResponse),
    );

    await request(server)
      .get(`/knowledge/documents/${uploaded.id}`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(404);

    const listResponse = await request(server)
      .get('/knowledge/documents')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(200);
    const list = knowledgeDocumentListResponseSchema.parse(
      getSuccessData(listResponse),
    );
    expect(list.items.some((item) => item.id === uploaded.id)).toBe(false);
  });

  async function registerUser(label: string) {
    const email = `knowledge-${label}-${Date.now()}-${Math.random()
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
