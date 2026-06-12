import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';
import { uploadImageResponseSchema } from '@repo/types/api/upload';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../src/database/prisma.service';

describe('UploadsController (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let server: App;
  let prisma: PrismaService | undefined;
  const emails: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET ??= 'dev-secret-change-me';
    process.env.DATABASE_URL ??= 'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind';
    process.env.MINIO_ENDPOINT = '127.0.0.1';
    process.env.MINIO_PORT = '9000';
    process.env.MINIO_USE_SSL = 'false';
    process.env.MINIO_ACCESS_KEY = 'minioadmin';
    process.env.MINIO_SECRET_KEY = 'minioadmin';
    process.env.MINIO_BUCKET = 'prepmind-dev-test';
    process.env.PUBLIC_API_BASE_URL = 'http://localhost:3001';

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

  it('requires authentication for image uploads', async () => {
    await request(server)
      .post('/uploads/images')
      .field('purpose', 'ocr')
      .attach('file', Buffer.from([1, 2, 3]), {
        filename: 'paper.png',
        contentType: 'image/png',
      })
      .expect(401);
  });

  it('rejects non-image uploads', async () => {
    const user = await registerUser('upload-invalid');

    await request(server)
      .post('/uploads/images')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .field('purpose', 'ocr')
      .attach('file', Buffer.from('hello'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(400)
      .expect((response) => {
        expect(getErrorBody(response).error.code).toBe('UPLOAD_IMAGE_INVALID_TYPE');
      });
  });

  it('uploads and reads an image through the backend image URL', async () => {
    const user = await registerUser('upload-valid');
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const uploadResponse = await request(server)
      .post('/uploads/images')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .field('purpose', 'ocr')
      .field('groupId', 'ocr-e2e')
      .attach('file', pngBytes, {
        filename: 'paper.png',
        contentType: 'image/png',
      })
      .expect(201);

    const uploaded = uploadImageResponseSchema.parse(getSuccessData(uploadResponse));
    expect(uploaded.objectKey).toContain(`users/${user.userId}/ocr/ocr-e2e/`);
    expect(uploaded.imageUrl).toContain('/uploads/images/users/');

    const imagePath = new URL(uploaded.imageUrl).pathname;
    await request(server)
      .get(imagePath)
      .expect(200)
      .expect('Content-Type', /image\/png/);
  });

  async function registerUser(label: string) {
    const email = `upload-${label}-${Date.now()}-${Math.random()
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
