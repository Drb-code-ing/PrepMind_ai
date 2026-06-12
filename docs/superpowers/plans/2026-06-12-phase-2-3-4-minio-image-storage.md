# Phase 2.3.4 MinIO Image Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move new OCR and wrong-question images from browser-only Dexie previews to server-backed MinIO URLs.

**Architecture:** Add a NestJS `UploadsModule` that accepts authenticated multipart image uploads, stores objects in MinIO, and serves them back through a stable backend URL. The frontend keeps immediate local previews, uploads the image in parallel with OCR, then persists the returned `imageUrl` into OCRRecord and WrongQuestion APIs while preserving old Dexie fallback behavior.

**Tech Stack:** Bun workspace, NestJS 11, `@nestjs/platform-express`, MinIO SDK, Prisma/PostgreSQL, Next.js 16, TanStack Query, Dexie, Zod shared API contracts.

---

## Scope Check

This plan implements the approved design in `docs/superpowers/specs/2026-06-12-phase-2-3-4-minio-image-storage-design.md`.

It includes:

- Shared upload API contract.
- Server env config and MinIO dependency.
- Server uploads/storage module.
- Upload and read e2e coverage.
- Frontend upload API and hook.
- OCR runtime integration.
- WrongQuestion image propagation through existing mapper.
- Docs and verification.

It excludes:

- Presigned direct upload.
- Historical Dexie base64 migration.
- Object lifecycle cleanup.
- CDN or production image authorization.

## File Structure

- Create `packages/types/src/api/upload.ts`: shared Zod schemas and upload response/request types.
- Modify `packages/types/package.json`: export `@repo/types/api/upload`.
- Modify `packages/types/src/index.ts`: root export for upload schemas.
- Modify `apps/server/package.json` and `bun.lock`: add `minio` and `@types/multer`.
- Modify `apps/server/src/config/env.ts`: MinIO and upload env schema.
- Create `apps/server/src/uploads/storage.service.ts`: MinIO client wrapper, validation, key generation, upload/read helpers.
- Create `apps/server/src/uploads/uploads.controller.ts`: `POST /uploads/images` and `GET /uploads/images/*objectKey`.
- Create `apps/server/src/uploads/uploads.module.ts`: module wiring.
- Create `apps/server/src/uploads/storage.service.spec.ts`: unit tests for validation and key safety.
- Create `apps/server/test/uploads.e2e-spec.ts`: authenticated upload/read integration test.
- Modify `apps/server/src/app.module.ts`: import `UploadsModule`.
- Create `apps/web/src/lib/upload-api.ts`: FormData API client for image upload.
- Create `apps/web/src/lib/upload-api.test.mts`: pure fetch/FormData contract tests.
- Create `apps/web/src/hooks/use-upload-image.ts`: TanStack mutation wrapper.
- Modify `apps/web/src/components/providers/ocr-runtime-provider.tsx`: upload image in OCR flow and persist server image URL.
- Modify `apps/web/src/lib/ocr-record-api.test.mts`: assert server URL is preserved and base64 is still stripped.
- Modify `apps/web/src/lib/wrong-question-api.test.mts`: assert server URL is sent to `/wrong-questions`.
- Modify `docs/data-flow.md`, `docs/dev-start.md`, `CLAUDE.md`, `AGENTS.md`, `DEVLOG.md`: document MinIO image flow and commands.

---

### Task 1: Shared Upload API Contract

**Files:**

- Create: `packages/types/src/api/upload.ts`
- Modify: `packages/types/package.json`
- Modify: `packages/types/src/index.ts`
- Test: `bun --cwd packages/types typecheck`

- [ ] **Step 1: Write the upload contract**

Create `packages/types/src/api/upload.ts`:

```ts
import { z } from 'zod';

export const uploadImagePurposeSchema = z.enum([
  'ocr',
  'wrong-question',
  'profile',
]);

export const uploadImageMimeTypeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const uploadImageResponseSchema = z.object({
  objectKey: z.string().min(1).max(512),
  imageUrl: z.string().url().max(2_048),
  mimeType: uploadImageMimeTypeSchema,
  size: z.number().int().positive(),
});

export const uploadImageFormSchema = z.object({
  purpose: uploadImagePurposeSchema.default('ocr'),
  groupId: z.string().min(1).max(100).optional(),
});

export type UploadImagePurpose = z.infer<typeof uploadImagePurposeSchema>;
export type UploadImageMimeType = z.infer<typeof uploadImageMimeTypeSchema>;
export type UploadImageResponse = z.infer<typeof uploadImageResponseSchema>;
export type UploadImageForm = z.infer<typeof uploadImageFormSchema>;
```

- [ ] **Step 2: Export the contract**

Modify `packages/types/package.json` exports:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./api/common": "./src/api/common.ts",
    "./api/auth": "./src/api/auth.ts",
    "./api/wrong-question": "./src/api/wrong-question.ts",
    "./api/chat-message": "./src/api/chat-message.ts",
    "./api/ocr-record": "./src/api/ocr-record.ts",
    "./api/upload": "./src/api/upload.ts"
  }
}
```

Modify `packages/types/src/index.ts` by adding:

```ts
export * from './api/upload';
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
bun --cwd packages/types typecheck
```

Expected: exit code 0.

- [ ] **Step 4: Commit**

```powershell
git add packages/types/src/api/upload.ts packages/types/package.json packages/types/src/index.ts
git commit -m "feat: add upload API contract"
```

---

### Task 2: Server Dependencies And Environment Config

**Files:**

- Modify: `apps/server/package.json`
- Modify: `bun.lock`
- Modify: `apps/server/src/config/env.ts`
- Modify: `.env.example` if present at repo root
- Modify: `docker/.env.example`
- Test: `bun --filter @repo/server build`

- [ ] **Step 1: Add dependencies**

Run:

```powershell
bun --cwd apps/server add minio
bun --cwd apps/server add -d @types/multer
```

Expected:

- `apps/server/package.json` includes `minio`.
- `apps/server/package.json` includes `@types/multer` in `devDependencies`.
- `bun.lock` changes.

- [ ] **Step 2: Extend server env schema**

Modify `apps/server/src/config/env.ts`:

```ts
import { z } from 'zod';

const booleanStringSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    return value.toLowerCase() === 'true';
  });

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  REFRESH_COOKIE_NAME: z.string().default('prepmind_refresh'),
  MINIO_ENDPOINT: z.string().min(1).default('127.0.0.1'),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: booleanStringSchema.default(false),
  MINIO_ACCESS_KEY: z.string().min(1).default('minioadmin'),
  MINIO_SECRET_KEY: z.string().min(1).default('minioadmin'),
  MINIO_BUCKET: z.string().min(1).default('prepmind-dev'),
  PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:3001'),
  UPLOAD_IMAGE_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(8 * 1024 * 1024),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function parseEnv(config: Record<string, unknown>): ServerEnv {
  return envSchema.parse(config);
}
```

- [ ] **Step 3: Update environment examples**

Add these keys to the existing env examples:

```text
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=prepmind-dev
PUBLIC_API_BASE_URL=http://localhost:3001
UPLOAD_IMAGE_MAX_BYTES=8388608
```

- [ ] **Step 4: Run server build**

Run:

```powershell
bun --filter @repo/server build
```

Expected: exit code 0.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/package.json bun.lock apps/server/src/config/env.ts .env.example docker/.env.example
git commit -m "chore: configure minio upload environment"
```

If root `.env.example` does not exist, omit it from `git add`.

---

### Task 3: Storage Service Unit Tests

**Files:**

- Create: `apps/server/src/uploads/storage.service.spec.ts`
- Create: `apps/server/src/uploads/storage.service.ts`
- Test: `bun --cwd apps/server test storage.service.spec.ts`

- [ ] **Step 1: Write failing storage service tests**

Create `apps/server/src/uploads/storage.service.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';

import type { ServerEnv } from '../config/env';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  const config = {
    get: jest.fn((key: keyof ServerEnv) => {
      const values: ServerEnv = {
        NODE_ENV: 'test',
        PORT: 3001,
        DATABASE_URL: 'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'dev-secret-change-me',
        JWT_ACCESS_EXPIRES_IN: '15m',
        REFRESH_TOKEN_DAYS: 30,
        CORS_ORIGIN: 'http://localhost:3000',
        REFRESH_COOKIE_NAME: 'prepmind_refresh',
        MINIO_ENDPOINT: '127.0.0.1',
        MINIO_PORT: 9000,
        MINIO_USE_SSL: false,
        MINIO_ACCESS_KEY: 'minioadmin',
        MINIO_SECRET_KEY: 'minioadmin',
        MINIO_BUCKET: 'prepmind-dev',
        PUBLIC_API_BASE_URL: 'http://localhost:3001',
        UPLOAD_IMAGE_MAX_BYTES: 8 * 1024 * 1024,
      };
      return values[key];
    }),
  } as unknown as ConfigService<ServerEnv, true>;

  const minioClient = {
    bucketExists: jest.fn(),
    makeBucket: jest.fn(),
    putObject: jest.fn(),
    statObject: jest.fn(),
    getObject: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    minioClient.bucketExists.mockResolvedValue(true);
    minioClient.putObject.mockResolvedValue({ etag: 'etag_1' });
  });

  function createService() {
    return new StorageService(config, minioClient);
  }

  it('uploads supported images under a user scoped object key', async () => {
    const result = await createService().uploadImage('user_1', {
      file: {
        buffer: Buffer.from('image'),
        mimetype: 'image/png',
        size: 5,
        originalname: 'paper.png',
      } as Express.Multer.File,
      purpose: 'ocr',
      groupId: 'ocr-1',
    });

    expect(result.objectKey).toMatch(/^users\/user_1\/ocr\/ocr-1\/[a-f0-9-]+\.png$/);
    expect(result.imageUrl).toBe(`http://localhost:3001/uploads/images/${result.objectKey}`);
    expect(result.mimeType).toBe('image/png');
    expect(result.size).toBe(5);
    expect(minioClient.putObject).toHaveBeenCalledWith(
      'prepmind-dev',
      result.objectKey,
      Buffer.from('image'),
      5,
      { 'Content-Type': 'image/png' },
    );
  });

  it('creates the bucket before the first upload when it does not exist', async () => {
    minioClient.bucketExists.mockResolvedValue(false);

    await createService().uploadImage('user_1', {
      file: {
        buffer: Buffer.from('image'),
        mimetype: 'image/jpeg',
        size: 5,
        originalname: 'paper.jpg',
      } as Express.Multer.File,
      purpose: 'ocr',
      groupId: 'ocr-1',
    });

    expect(minioClient.makeBucket).toHaveBeenCalledWith('prepmind-dev');
  });

  it('rejects unsupported mime types', async () => {
    await expect(
      createService().uploadImage('user_1', {
        file: {
          buffer: Buffer.from('text'),
          mimetype: 'text/plain',
          size: 5,
          originalname: 'paper.txt',
        } as Express.Multer.File,
        purpose: 'ocr',
        groupId: 'ocr-1',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_IMAGE_INVALID_TYPE' });
  });

  it('rejects files larger than the configured limit', async () => {
    await expect(
      createService().uploadImage('user_1', {
        file: {
          buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
          mimetype: 'image/webp',
          size: 8 * 1024 * 1024 + 1,
          originalname: 'large.webp',
        } as Express.Multer.File,
        purpose: 'ocr',
        groupId: 'ocr-1',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_IMAGE_TOO_LARGE' });
  });

  it('rejects unsafe object keys before reading', async () => {
    expect(() => createService().assertReadableObjectKey('../secret')).toThrow(
      expect.objectContaining({ code: 'UPLOAD_IMAGE_NOT_FOUND' }),
    );
    expect(() => createService().assertReadableObjectKey('users\\user_1\\x.png')).toThrow(
      expect.objectContaining({ code: 'UPLOAD_IMAGE_NOT_FOUND' }),
    );
    expect(() => createService().assertReadableObjectKey('documents/file.png')).toThrow(
      expect.objectContaining({ code: 'UPLOAD_IMAGE_NOT_FOUND' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun --cwd apps/server test storage.service.spec.ts
```

Expected: FAIL because `./storage.service` does not exist.

- [ ] **Step 3: Implement `StorageService`**

Create `apps/server/src/uploads/storage.service.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import type { UploadImageMimeType, UploadImagePurpose } from '@repo/types/api/upload';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';

type MinioClientLike = Pick<
  MinioClient,
  'bucketExists' | 'makeBucket' | 'putObject' | 'statObject' | 'getObject'
>;

type UploadImageInput = {
  file: Express.Multer.File | undefined;
  purpose: UploadImagePurpose;
  groupId?: string;
};

const mimeExtensions: Record<UploadImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class StorageService {
  private readonly bucket: string;
  private readonly publicApiBaseUrl: string;
  private readonly maxImageBytes: number;
  private bucketReadyPromise: Promise<void> | null = null;

  constructor(
    private readonly configService: ConfigService<ServerEnv, true>,
    private readonly minioClient: MinioClientLike = new MinioClient({
      endPoint: configService.get('MINIO_ENDPOINT', { infer: true }),
      port: configService.get('MINIO_PORT', { infer: true }),
      useSSL: configService.get('MINIO_USE_SSL', { infer: true }),
      accessKey: configService.get('MINIO_ACCESS_KEY', { infer: true }),
      secretKey: configService.get('MINIO_SECRET_KEY', { infer: true }),
    }),
  ) {
    this.bucket = this.configService.get('MINIO_BUCKET', { infer: true });
    this.publicApiBaseUrl = this.configService
      .get('PUBLIC_API_BASE_URL', { infer: true })
      .replace(/\/+$/, '');
    this.maxImageBytes = this.configService.get('UPLOAD_IMAGE_MAX_BYTES', { infer: true });
  }

  async uploadImage(userId: string, input: UploadImageInput) {
    const file = input.file;
    if (!file) {
      throw new AppError('UPLOAD_IMAGE_REQUIRED', '请选择要上传的图片', HttpStatus.BAD_REQUEST);
    }

    const mimeType = this.assertSupportedMimeType(file.mimetype);
    if (file.size > this.maxImageBytes) {
      throw new AppError('UPLOAD_IMAGE_TOO_LARGE', '图片大小超过限制', HttpStatus.PAYLOAD_TOO_LARGE);
    }

    await this.ensureBucket();
    const objectKey = this.createObjectKey({
      userId,
      purpose: input.purpose,
      groupId: input.groupId,
      mimeType,
    });

    await this.minioClient.putObject(this.bucket, objectKey, file.buffer, file.size, {
      'Content-Type': mimeType,
    });

    return {
      objectKey,
      imageUrl: this.toPublicImageUrl(objectKey),
      mimeType,
      size: file.size,
    };
  }

  async readObject(objectKey: string): Promise<{
    stream: Readable;
    contentType: string;
  }> {
    const safeKey = this.assertReadableObjectKey(objectKey);
    try {
      const stat = await this.minioClient.statObject(this.bucket, safeKey);
      const stream = await this.minioClient.getObject(this.bucket, safeKey);
      return {
        stream,
        contentType:
          stat.metaData?.['content-type'] ??
          stat.metaData?.['Content-Type'] ??
          'application/octet-stream',
      };
    } catch {
      throw new AppError('UPLOAD_IMAGE_NOT_FOUND', '图片不存在', HttpStatus.NOT_FOUND);
    }
  }

  assertReadableObjectKey(objectKey: string): string {
    const trimmed = objectKey.trim();
    if (
      !trimmed ||
      trimmed.includes('..') ||
      trimmed.includes('\\') ||
      trimmed.startsWith('/') ||
      !trimmed.startsWith('users/')
    ) {
      throw new AppError('UPLOAD_IMAGE_NOT_FOUND', '图片不存在', HttpStatus.NOT_FOUND);
    }
    return trimmed;
  }

  private assertSupportedMimeType(value: string): UploadImageMimeType {
    if (value === 'image/jpeg' || value === 'image/png' || value === 'image/webp') {
      return value;
    }

    throw new AppError(
      'UPLOAD_IMAGE_INVALID_TYPE',
      '仅支持 JPG、PNG、WebP 图片',
      HttpStatus.BAD_REQUEST,
    );
  }

  private async ensureBucket() {
    this.bucketReadyPromise ??= (async () => {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket);
      }
    })();

    await this.bucketReadyPromise;
  }

  private createObjectKey({
    userId,
    purpose,
    groupId,
    mimeType,
  }: {
    userId: string;
    purpose: UploadImagePurpose;
    groupId?: string;
    mimeType: UploadImageMimeType;
  }) {
    const safeGroupId = sanitizeSegment(groupId || 'ungrouped');
    return [
      'users',
      sanitizeSegment(userId),
      purpose,
      safeGroupId,
      `${randomUUID()}.${mimeExtensions[mimeType]}`,
    ].join('/');
  }

  private toPublicImageUrl(objectKey: string) {
    return `${this.publicApiBaseUrl}/uploads/images/${objectKey}`;
  }
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100) || 'unknown';
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
bun --cwd apps/server test storage.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/uploads/storage.service.ts apps/server/src/uploads/storage.service.spec.ts
git commit -m "feat: add minio storage service"
```

---

### Task 4: Uploads Controller And Module

**Files:**

- Create: `apps/server/src/uploads/uploads.controller.ts`
- Create: `apps/server/src/uploads/uploads.module.ts`
- Modify: `apps/server/src/app.module.ts`
- Test: `bun --filter @repo/server build`

- [ ] **Step 1: Write controller**

Create `apps/server/src/uploads/uploads.controller.ts`:

```ts
import type { Response } from 'express';
import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { uploadImageFormSchema } from '@repo/types/api/upload';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { StorageService } from './storage.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storageService: StorageService) {}

  @Post('images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: unknown,
  ) {
    const input = uploadImageFormSchema.parse(body);
    return this.storageService.uploadImage(user.id, {
      file,
      purpose: input.purpose,
      groupId: input.groupId,
    });
  }

  @Get('images/*objectKey')
  async readImage(
    @Param('objectKey') objectKeyParam: string | string[],
    @Res() response: Response,
  ) {
    const objectKey = Array.isArray(objectKeyParam)
      ? objectKeyParam.join('/')
      : objectKeyParam;
    const image = await this.storageService.readObject(objectKey);

    response.setHeader('Content-Type', image.contentType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    image.stream.pipe(response);
  }
}
```

- [ ] **Step 2: Write module**

Create `apps/server/src/uploads/uploads.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { UploadsController } from './uploads.controller';
import { StorageService } from './storage.service';

@Module({
  controllers: [UploadsController],
  providers: [StorageService],
  exports: [StorageService],
})
export class UploadsModule {}
```

- [ ] **Step 3: Register module**

Modify `apps/server/src/app.module.ts`:

```ts
import { UploadsModule } from './uploads/uploads.module';
```

Add `UploadsModule` to `imports` after `OcrRecordsModule`:

```ts
imports: [
  ConfigModule,
  DatabaseModule,
  HealthModule,
  AuthModule,
  UsersModule,
  WrongQuestionsModule,
  ChatMessagesModule,
  OcrRecordsModule,
  UploadsModule,
],
```

- [ ] **Step 4: Build**

Run:

```powershell
bun --filter @repo/server build
```

Expected: exit code 0.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/uploads/uploads.controller.ts apps/server/src/uploads/uploads.module.ts apps/server/src/app.module.ts
git commit -m "feat: add image upload controller"
```

---

### Task 5: Uploads E2E Tests

**Files:**

- Create: `apps/server/test/uploads.e2e-spec.ts`
- Test: `bun --filter @repo/server test:e2e`

- [ ] **Step 1: Write e2e tests**

Create `apps/server/test/uploads.e2e-spec.ts`:

```ts
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
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  const emails: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET ??= 'dev-secret-change-me';
    process.env.DATABASE_URL ??=
      'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind';
    process.env.MINIO_ENDPOINT ??= '127.0.0.1';
    process.env.MINIO_PORT ??= '9000';
    process.env.MINIO_USE_SSL ??= 'false';
    process.env.MINIO_ACCESS_KEY ??= 'minioadmin';
    process.env.MINIO_SECRET_KEY ??= 'minioadmin';
    process.env.MINIO_BUCKET ??= 'prepmind-dev-test';
    process.env.PUBLIC_API_BASE_URL ??= 'http://localhost:3001';

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
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

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
```

- [ ] **Step 2: Run e2e**

Run with Docker PostgreSQL and MinIO already running:

```powershell
bun --filter @repo/server test:e2e
```

Expected: PASS. If MinIO is not running, start infrastructure first:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
```

- [ ] **Step 3: Commit**

```powershell
git add apps/server/test/uploads.e2e-spec.ts
git commit -m "test: cover image upload API"
```

---

### Task 6: Frontend Upload API And Hook

**Files:**

- Create: `apps/web/src/lib/upload-api.test.mts`
- Create: `apps/web/src/lib/upload-api.ts`
- Create: `apps/web/src/hooks/use-upload-image.ts`
- Test: `node --experimental-strip-types apps/web/src/lib/upload-api.test.mts`

- [ ] **Step 1: Write failing upload API test**

Create `apps/web/src/lib/upload-api.test.mts`:

```ts
import assert from 'node:assert/strict';

import { ApiClientError } from './api-client.ts';
import { createUploadApi } from './upload-api.ts';

async function run() {
  await testUploadsImageWithFormDataAndAuth();
  await testThrowsEnvelopeErrors();
}

async function testUploadsImageWithFormDataAndAuth() {
  const requests: Array<{
    input: string;
    authorization: string | null;
    bodyIsFormData: boolean;
    purpose: FormDataEntryValue | null;
    groupId: FormDataEntryValue | null;
    fileName: string | undefined;
  }> = [];

  const api = createUploadApi({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (input, init) => {
      const headers = new Headers(init?.headers);
      const body = init?.body as FormData;
      const file = body.get('file') as File;
      requests.push({
        input: String(input),
        authorization: headers.get('authorization'),
        bodyIsFormData: body instanceof FormData,
        purpose: body.get('purpose'),
        groupId: body.get('groupId'),
        fileName: file.name,
      });

      return jsonResponse({
        success: true,
        data: {
          objectKey: 'users/user_1/ocr/group_1/image.png',
          imageUrl: 'http://localhost:3001/uploads/images/users/user_1/ocr/group_1/image.png',
          mimeType: 'image/png',
          size: 8,
        },
        requestId: 'req_1',
      });
    },
  });

  const result = await api.uploadImage('token_1', new File(['12345678'], 'paper.png', {
    type: 'image/png',
  }), {
    purpose: 'ocr',
    groupId: 'group_1',
  });

  assert.equal(requests[0].input, 'http://localhost:3001/uploads/images');
  assert.equal(requests[0].authorization, 'Bearer token_1');
  assert.equal(requests[0].bodyIsFormData, true);
  assert.equal(requests[0].purpose, 'ocr');
  assert.equal(requests[0].groupId, 'group_1');
  assert.equal(requests[0].fileName, 'paper.png');
  assert.equal(result.mimeType, 'image/png');
});

async function testThrowsEnvelopeErrors() {
  const api = createUploadApi({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async () =>
      jsonResponse(
        {
          success: false,
          error: {
            code: 'UPLOAD_IMAGE_INVALID_TYPE',
            message: '仅支持 JPG、PNG、WebP 图片',
          },
          requestId: 'req_error',
        },
        400,
      ),
  });

  await assert.rejects(
    () =>
      api.uploadImage('token_1', new File(['hello'], 'note.txt', {
        type: 'text/plain',
      }), {
        purpose: 'ocr',
      }),
    (error) =>
      error instanceof ApiClientError &&
      error.status === 400 &&
      error.code === 'UPLOAD_IMAGE_INVALID_TYPE' &&
      error.requestId === 'req_error',
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

await run();
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/upload-api.test.mts
```

Expected: FAIL because `./upload-api.ts` does not exist.

- [ ] **Step 3: Implement upload API**

Create `apps/web/src/lib/upload-api.ts`:

```ts
import {
  uploadImageResponseSchema,
  type UploadImagePurpose,
  type UploadImageResponse,
} from '@repo/types/api/upload';

import { ApiClientError } from './api-client';

type FetchLike = typeof fetch;

type CreateUploadApiOptions = {
  baseUrl: string;
  fetchImpl?: FetchLike;
};

type ApiFailureBody = {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId?: string;
};

type ApiSuccessBody<T> = {
  success: true;
  data: T;
  requestId?: string;
};

export function createUploadApi({
  baseUrl,
  fetchImpl = fetch,
}: CreateUploadApiOptions) {
  return {
    async uploadImage(
      accessToken: string,
      file: File,
      options: { purpose: UploadImagePurpose; groupId?: string },
    ) {
      const body = new FormData();
      body.append('file', file);
      body.append('purpose', options.purpose);
      if (options.groupId) body.append('groupId', options.groupId);

      let response: Response;
      try {
        response = await fetchImpl(toUrl(baseUrl, '/uploads/images'), {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          credentials: 'include',
          body,
        });
      } catch {
        throw new ApiClientError('网络连接失败，请检查网络后重试', {
          status: 0,
          code: 'NETWORK_ERROR',
        });
      }

      const payload = await parseJson(response);
      if (isApiSuccess<unknown>(payload)) {
        return uploadImageResponseSchema.parse(payload.data);
      }
      if (isApiFailure(payload)) {
        throw new ApiClientError(payload.error.message, {
          status: response.status,
          code: payload.error.code,
          requestId: payload.requestId,
        });
      }

      throw new ApiClientError('服务响应格式异常', {
        status: response.status,
        code: 'INVALID_API_RESPONSE',
      });
    },
  };
}

async function parseJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new ApiClientError('服务响应格式异常', {
      status: response.status,
      code: 'INVALID_API_RESPONSE',
    });
  }
}

function isApiSuccess<T>(value: unknown): value is ApiSuccessBody<T> {
  return isRecord(value) && value.success === true && 'data' in value;
}

function isApiFailure(value: unknown): value is ApiFailureBody {
  return (
    isRecord(value) &&
    value.success === false &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export const uploadApi = createUploadApi({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001',
});

export type { UploadImageResponse };
```

- [ ] **Step 4: Implement hook**

Create `apps/web/src/hooks/use-upload-image.ts`:

```ts
'use client';

import { useMutation } from '@tanstack/react-query';
import type { UploadImagePurpose } from '@repo/types/api/upload';

import { uploadApi } from '@/lib/upload-api';
import { useUserStore } from '@/stores/userStore';

export function useUploadImage() {
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      file,
      purpose,
      groupId,
    }: {
      file: File;
      purpose: UploadImagePurpose;
      groupId?: string;
    }) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }

      return uploadApi.uploadImage(accessToken, file, { purpose, groupId });
    },
  });
}
```

- [ ] **Step 5: Run test to verify GREEN**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/upload-api.test.mts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/lib/upload-api.ts apps/web/src/lib/upload-api.test.mts apps/web/src/hooks/use-upload-image.ts
git commit -m "feat: add frontend image upload API"
```

---

### Task 7: OCR Runtime Image Upload Integration

**Files:**

- Modify: `apps/web/src/components/providers/ocr-runtime-provider.tsx`
- Modify: `apps/web/src/lib/ocr-record-api.test.mts`
- Modify: `apps/web/src/lib/wrong-question-api.test.mts`
- Test: `node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts`
- Test: `node --experimental-strip-types apps/web/src/lib/wrong-question-api.test.mts`

- [ ] **Step 1: Extend OCRRecord API test**

In `apps/web/src/lib/ocr-record-api.test.mts`, add a test near `testStripsBase64ImageFromCreateRequest()`:

```ts
function testKeepsServerImageUrlInCreateRequest() {
  const record: OcrRecord = {
    id: 'ocr_2',
    userId: 'user_1',
    type: 'ocr-result',
    groupId: 'group_2',
    content: 'raw',
    imageUrl: 'http://localhost:3001/uploads/images/users/user_1/ocr/group_2/image.png',
    createdAt: 1,
  };

  assert.equal(
    mapLocalOcrRecordToCreateRequest(record, {
      isQuestion: true,
      questionText: '题目',
    }).imageUrl,
    'http://localhost:3001/uploads/images/users/user_1/ocr/group_2/image.png',
  );
}
```

Add it to `run()`:

```ts
testKeepsServerImageUrlInCreateRequest();
```

- [ ] **Step 2: Extend WrongQuestion API test**

In `apps/web/src/lib/wrong-question-api.test.mts`, the existing `testMapsLocalRecordToCreateRequest()` already expects an HTTPS image URL to pass through. Add one server-local URL assertion to make the MinIO route explicit:

```ts
function testKeepsServerUploadImageUrlInCreateRequest() {
  const local: WrongQuestionRecord = {
    id: 'local_3',
    userId: 'user_1',
    source: 'ocr',
    sourceRecordId: 'ocr_3',
    sourceGroupId: 'group_3',
    imageUrl: 'http://localhost:3001/uploads/images/users/user_1/ocr/group_3/image.png',
    questionText: '题干',
    subject: '数学',
    category: '极限',
    knowledgePoints: ['极限'],
    analysis: '分析',
    answer: '答案',
    errorType: '',
    userNote: '',
    rawContent: 'raw',
    status: 'unresolved',
    createdAt: 1,
    updatedAt: 1,
  };

  assert.equal(
    mapLocalWrongQuestionToCreateRequest(local).imageUrl,
    'http://localhost:3001/uploads/images/users/user_1/ocr/group_3/image.png',
  );
}
```

Add it to `run()`:

```ts
testKeepsServerUploadImageUrlInCreateRequest();
```

- [ ] **Step 3: Run tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts
node --experimental-strip-types apps/web/src/lib/wrong-question-api.test.mts
```

Expected: PASS if existing mappers already preserve non-`data:` URLs.

- [ ] **Step 4: Integrate upload mutation in OCR runtime**

Modify imports in `apps/web/src/components/providers/ocr-runtime-provider.tsx`:

```ts
import { useUploadImage } from '@/hooks/use-upload-image';
```

Inside `OcrRuntimeProvider`, add:

```ts
const uploadImage = useUploadImage();
```

Inside `startOcr`, after initial OCR messages are inserted and before the `/api/ocr` request:

```ts
let uploadedImageUrl: string | undefined;
const uploadPromise = uploadImage
  .mutateAsync({
    file: image.file,
    purpose: 'ocr',
    groupId,
  })
  .then((uploaded) => {
    uploadedImageUrl = uploaded.imageUrl;
    const withServerImage = ocrMsgRef.current.map((message) =>
      message.groupId === groupId && message.type === 'user'
        ? { ...message, imageUrl: uploaded.imageUrl }
        : message,
    );
    ocrMsgRef.current = withServerImage;
    setOcrMessages(withServerImage);
    return uploaded;
  })
  .catch((error) => {
    logBackgroundSyncError('[Image upload]', error);
    return null;
  });
```

Before creating `finalResultRecord`, wait for upload completion:

```ts
await uploadPromise;
```

Set final result image URL:

```ts
const finalResultRecord: OcrRecord = {
  id: resultMsgId,
  userId,
  type: 'ocr-result',
  groupId,
  content: fullContent,
  imageUrl: uploadedImageUrl,
  createdAt: Date.now() + 1,
};
```

Update final OCR mapping so both user and result records prefer server URL when available:

```ts
const finalOcr = ocrMsgRef.current.map((message) => {
  if (message.groupId !== groupId) return message;
  if (message.id === resultMsgId) {
    return {
      ...message,
      id: persistedResultRecord.id,
      content: fullContent,
      imageUrl: persistedResultRecord.imageUrl ?? uploadedImageUrl ?? message.imageUrl,
    };
  }
  if (message.type === 'user' && uploadedImageUrl) {
    return { ...message, imageUrl: uploadedImageUrl };
  }
  return message;
});
```

Add `uploadImage` to the `useCallback` dependency array.

- [ ] **Step 5: Run frontend focused tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts
node --experimental-strip-types apps/web/src/lib/wrong-question-api.test.mts
bun --filter @repo/web lint
```

Expected: exit code 0 for each command.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/components/providers/ocr-runtime-provider.tsx apps/web/src/lib/ocr-record-api.test.mts apps/web/src/lib/wrong-question-api.test.mts
git commit -m "feat: upload OCR images during recognition"
```

---

### Task 8: Ensure WrongQuestion Uses Uploaded OCR Image URL

**Files:**

- Inspect: `apps/web/src/components/chat/*`
- Inspect: `apps/web/src/components/providers/chat-runtime-provider.tsx`
- Modify only if needed: component that builds `WrongQuestionRecord` from OCR result.
- Test: `node --experimental-strip-types apps/web/src/lib/wrong-question-api.test.mts`

- [ ] **Step 1: Locate wrong-question creation**

Run:

```powershell
rg "useCreateWrongQuestion|sourceRecordId|sourceGroupId|canSaveOcrResult" apps/web/src
```

Expected: find the component that builds the local `WrongQuestionRecord` for OCR save.

- [ ] **Step 2: Verify image source**

The record builder must set:

```ts
imageUrl: resultRecord.imageUrl ?? userRecord.imageUrl,
```

If it currently only uses local user preview, change it to prefer the OCR result record image URL first. This matters because after Task 7 the result record should contain the server URL.

- [ ] **Step 3: Add or update a focused test if a pure helper exists**

If wrong-question construction is already behind a pure helper, add:

```ts
assert.equal(
  buildWrongQuestionFromOcr({
    resultRecord: {
      imageUrl: 'http://localhost:3001/uploads/images/users/user_1/ocr/group_1/image.png',
    },
    userRecord: {
      imageUrl: 'blob:http://localhost/local-preview',
    },
  }).imageUrl,
  'http://localhost:3001/uploads/images/users/user_1/ocr/group_1/image.png',
);
```

If no pure helper exists, keep the code change scoped and rely on `wrong-question-api.test.mts` plus manual browser smoke in Task 10.

- [ ] **Step 4: Run tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/wrong-question-api.test.mts
bun --filter @repo/web lint
```

Expected: exit code 0.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src
git commit -m "fix: prefer uploaded image URL for wrong questions"
```

Only include files touched in this task.

---

### Task 9: Documentation And Local Startup Updates

**Files:**

- Modify: `docs/data-flow.md`
- Modify: `docs/dev-start.md`
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Update data flow**

In `docs/data-flow.md`, update image strategy from “base64 only in Dexie” to:

```text
OCR 图片新数据流：
用户选择图片
  -> 本地 preview URL 即时展示
  -> POST /uploads/images
  -> MinIO object
  -> OCRRecord.imageUrl
  -> WrongQuestion.imageUrl
  -> Dexie 缓存服务端 URL

旧数据仍兼容：
服务端 imageUrl 缺失时，前端继续使用 Dexie 中按 groupId/id 合并回来的本地预览。
```

- [ ] **Step 2: Update dev start**

In `docs/dev-start.md`, add MinIO notes:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
```

Document:

```text
MinIO API: http://127.0.0.1:9000
MinIO Console: http://127.0.0.1:9001
Default login: minioadmin / minioadmin
Default bucket created by server on first upload: prepmind-dev
```

- [ ] **Step 3: Update CLAUDE.md and AGENTS.md**

Add a current data flow bullet:

```text
新 OCR 图片会先上传到 NestJS `/uploads/images`，后端写入 MinIO 并返回 `/uploads/images/users/...` 图片 URL；OCRRecord 和 WrongQuestion 优先保存该服务端 URL，Dexie 只作为预览和旧数据兜底。
```

- [ ] **Step 4: Update DEVLOG.md**

Under `2026-06-12（Day 7）`, add a concise subsection:

```markdown
**Phase 2.3.4 MinIO 图片存储迁移**

- 新增图片上传 API 设计与实现。
- OCR 新图片上传到 MinIO，OCRRecord / WrongQuestion 保存服务端 URL。
- 保留 Dexie 图片预览作为旧数据和上传失败兜底。
```

After final verification, add the actual commands that passed.

- [ ] **Step 5: Commit**

```powershell
git add docs/data-flow.md docs/dev-start.md CLAUDE.md AGENTS.md DEVLOG.md
git commit -m "docs: update minio image storage flow"
```

---

### Task 10: Full Verification And Browser Smoke

**Files:**

- No source file changes expected unless verification exposes a defect.

- [ ] **Step 1: Run focused frontend tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/upload-api.test.mts
node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts
node --experimental-strip-types apps/web/src/lib/wrong-question-api.test.mts
node --experimental-strip-types apps/web/src/lib/server-cache-sync.test.mts
node --experimental-strip-types apps/web/src/lib/wrong-question-parser.test.mts
```

Expected: all PASS.

- [ ] **Step 2: Run server tests**

Run:

```powershell
bun --cwd apps/server test storage.service.spec.ts
bun --filter @repo/server test
```

Expected: all suites PASS.

- [ ] **Step 3: Run lint/build/typecheck**

Run:

```powershell
bun --filter @repo/web lint
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
```

Expected: exit code 0 for every command.

- [ ] **Step 4: Run e2e with Docker infra**

Run:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
bun --filter @repo/server test:e2e
```

Expected:

- Auth e2e PASS.
- WrongQuestion e2e PASS.
- ChatMessage e2e PASS.
- OCRRecord e2e PASS.
- Uploads e2e PASS.

- [ ] **Step 5: Browser smoke**

Start local servers:

```powershell
bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

Manual flow:

1. Register or login.
2. Open `/chat`.
3. Upload a small question image.
4. Confirm OCR starts immediately while upload happens in the background.
5. Wait for OCR completion.
6. Save to wrong-question book.
7. Refresh `/chat`; OCR image still renders.
8. Open `/error-book`; card and detail image still render.
9. Clear browser IndexedDB only, login again, open `/error-book`; image still renders from `/uploads/images/...`.

Browser console expected:

- No 404 for `/favicon.ico`.
- No 404 for `/icons/icon-192.png`.
- No 404 for `/uploads/images/...` after successful upload.
- No hydration mismatch.

- [ ] **Step 6: Stop dev processes**

If this session started dev servers, stop them before final response. Use the terminal process handles or close the PowerShell jobs started for this task.

- [ ] **Step 7: Final commit if fixes were needed**

If verification required source fixes:

```powershell
git add <changed-files>
git commit -m "fix: stabilize minio image upload flow"
```

If no fixes were needed, do not create an empty commit.

## Self-Review Notes

- Spec coverage: upload API, MinIO storage, env config, OCR integration, WrongQuestion propagation, old Dexie fallback, docs, and verification are each mapped to a task.
- Placeholder scan: the plan avoids unresolved placeholder markers and gives concrete file paths, code snippets, commands, and expected outcomes.
- Type consistency: shared upload response uses `objectKey`, `imageUrl`, `mimeType`, and `size` across backend, frontend, and tests.
- Scope control: no Prisma migration is included because `OcrRecord.imageUrl` and `WrongQuestion.imageUrl` already exist.
