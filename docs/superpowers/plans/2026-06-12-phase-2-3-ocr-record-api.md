# OCRRecord API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 2.3 OCRRecord API and connect the frontend OCR flow so OCR records have a PostgreSQL-backed source of truth while Dexie remains the local cache.

**Architecture:** Reuse the existing Prisma `OcrRecord` model. Add shared Zod API contracts, a NestJS guarded REST module, frontend API mapping/hooks, and then wire the chat page OCR completion path to save server records and cache them locally. Image base64 stays local; the API rejects `data:` image URLs and reserves `imageUrl` for future MinIO/OSS URLs.

**Tech Stack:** Bun workspace, TypeScript, Zod, NestJS 11, Prisma/PostgreSQL, TanStack Query, Dexie, Next.js 16.

---

## File Structure

- Create `packages/types/src/api/ocr-record.ts`
  - Shared schemas and types for OCRRecord create/list/detail/delete.
- Modify `packages/types/package.json`
  - Export `@repo/types/api/ocr-record`.
- Create `apps/server/src/ocr-records/ocr-records.module.ts`
  - Registers controller and service.
- Create `apps/server/src/ocr-records/ocr-records.controller.ts`
  - Parses shared Zod schemas and applies `JwtAuthGuard`.
- Create `apps/server/src/ocr-records/ocr-records.service.ts`
  - Implements list/get/create-upsert/delete with user scoping.
- Create `apps/server/src/ocr-records/ocr-records.service.spec.ts`
  - Unit tests for upsert, filtering, ownership, and image validation.
- Modify `apps/server/src/app.module.ts`
  - Imports `OcrRecordsModule`.
- Create `apps/server/test/ocr-records.e2e-spec.ts`
  - E2E coverage for auth, CRUD, upsert, and user isolation.
- Create `apps/web/src/lib/ocr-record-api.ts`
  - Maps server DTOs to local Dexie `OcrRecord` records and strips base64 image URLs.
- Create `apps/web/src/lib/ocr-record-api.test.mts`
  - Local mapper and request tests.
- Create `apps/web/src/hooks/use-ocr-records.ts`
  - TanStack Query list/create/delete hooks.
- Modify `apps/web/src/app/(chat)/chat/page.tsx`
  - Load server OCR records after Dexie hydration.
  - Save final OCR result to server after stream completion.
  - Use server OCRRecord id as `sourceRecordId` when saving wrong questions.
- Modify `docs/data-flow.md`, `docs/roadmap.md`, `DEVLOG.md`, `CLAUDE.md`, `AGENTS.md`
  - Document OCRRecord API completion after implementation.

---

## Task 1: Shared OCRRecord API Contract

**Files:**
- Create: `packages/types/src/api/ocr-record.ts`
- Modify: `packages/types/package.json`

- [ ] **Step 1: Add the shared OCRRecord schema**

Create `packages/types/src/api/ocr-record.ts`:

```ts
import { z } from 'zod';

export const ocrRecordStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'DONE',
  'FAILED',
]);

export const ocrParsedPayloadSchema = z
  .object({
    isQuestion: z.boolean(),
    nonQuestionSummary: z.string().max(5_000).optional(),
    subject: z.string().max(50).optional(),
    questionText: z.string().max(20_000).optional(),
    category: z.string().max(100).optional(),
    knowledgePoints: z.array(z.string().min(1).max(100)).max(20).optional(),
    analysis: z.string().max(30_000).optional(),
    answer: z.string().max(20_000).optional(),
    errorSuggestion: z.string().max(100).optional(),
  })
  .passthrough();

export const serverImageUrlSchema = z
  .string()
  .url()
  .refine((value) => !value.startsWith('data:'), {
    message: 'Base64 data URLs are not supported',
  });

export const ocrRecordSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  groupId: z.string().min(1),
  imageUrl: z.string().nullable(),
  rawText: z.string(),
  parsedJson: ocrParsedPayloadSchema.nullable(),
  status: ocrRecordStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createOcrRecordRequestSchema = z.object({
  groupId: z.string().min(1).max(100),
  rawText: z.string().trim().min(1).max(100_000),
  parsedJson: ocrParsedPayloadSchema.optional(),
  imageUrl: serverImageUrlSchema.optional(),
  status: ocrRecordStatusSchema.default('DONE'),
});

export const listOcrRecordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: ocrRecordStatusSchema.optional(),
  keyword: z.string().min(1).max(100).optional(),
  isQuestion: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const ocrRecordListResponseSchema = z.object({
  items: z.array(ocrRecordSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type OcrRecordStatus = z.infer<typeof ocrRecordStatusSchema>;
export type OcrParsedPayload = z.infer<typeof ocrParsedPayloadSchema>;
export type OcrRecordResponse = z.infer<typeof ocrRecordSchema>;
export type CreateOcrRecordRequest = z.infer<
  typeof createOcrRecordRequestSchema
>;
export type ListOcrRecordsQuery = z.infer<typeof listOcrRecordsQuerySchema>;
export type OcrRecordListResponse = z.infer<
  typeof ocrRecordListResponseSchema
>;
```

- [ ] **Step 2: Export the package subpath**

Modify `packages/types/package.json`:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./api/common": "./src/api/common.ts",
    "./api/auth": "./src/api/auth.ts",
    "./api/wrong-question": "./src/api/wrong-question.ts",
    "./api/chat-message": "./src/api/chat-message.ts",
    "./api/ocr-record": "./src/api/ocr-record.ts"
  }
}
```

- [ ] **Step 3: Verify the shared type package**

Run:

```powershell
bun --cwd packages/types typecheck
```

Expected: exit code `0`.

- [ ] **Step 4: Commit shared contract**

```powershell
git add packages/types/package.json packages/types/src/api/ocr-record.ts
git commit -m "feat: add OCR record API contract"
```

---

## Task 2: Backend OCRRecords Module

**Files:**
- Create: `apps/server/src/ocr-records/ocr-records.service.spec.ts`
- Create: `apps/server/src/ocr-records/ocr-records.service.ts`
- Create: `apps/server/src/ocr-records/ocr-records.controller.ts`
- Create: `apps/server/src/ocr-records/ocr-records.module.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Write the service unit tests first**

Create `apps/server/src/ocr-records/ocr-records.service.spec.ts`:

```ts
import { OcrRecordsService } from './ocr-records.service';
import { PrismaService } from '../database/prisma.service';

describe('OcrRecordsService', () => {
  const now = new Date('2026-06-12T00:00:00.000Z');
  const record = {
    id: 'ocr_1',
    userId: 'user_1',
    groupId: 'group_1',
    imageUrl: null,
    rawText: '## 识别结果\n题目',
    parsedJson: {
      isQuestion: true,
      questionText: '计算极限',
      knowledgePoints: ['极限'],
    },
    status: 'DONE' as const,
    createdAt: now,
    updatedAt: now,
  };
  const prisma = {
    $transaction: jest.fn(),
    ocrRecord: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createService() {
    return new OcrRecordsService(prisma as unknown as PrismaService);
  }

  it('lists records scoped to the current user with filters', async () => {
    prisma.ocrRecord.findMany.mockResolvedValue([record]);
    prisma.ocrRecord.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation((queries: unknown[]) =>
      Promise.all(queries),
    );

    const result = await createService().list('user_1', {
      page: 1,
      pageSize: 20,
      status: 'DONE',
      keyword: '极限',
      isQuestion: true,
    });

    expect(prisma.ocrRecord.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        status: 'DONE',
        rawText: { contains: '极限', mode: 'insensitive' },
        parsedJson: { path: ['isQuestion'], equals: true },
      },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      items: [{ id: 'ocr_1', groupId: 'group_1' }],
    });
  });

  it('returns the owned record detail', async () => {
    prisma.ocrRecord.findFirst.mockResolvedValue(record);

    await expect(createService().getById('user_1', 'ocr_1')).resolves.toMatchObject({
      id: 'ocr_1',
      userId: 'user_1',
    });
    expect(prisma.ocrRecord.findFirst).toHaveBeenCalledWith({
      where: { id: 'ocr_1', userId: 'user_1' },
    });
  });

  it('throws OCR_RECORD_NOT_FOUND for unowned records', async () => {
    prisma.ocrRecord.findFirst.mockResolvedValue(null);

    await expect(createService().getById('user_2', 'ocr_1')).rejects.toMatchObject({
      code: 'OCR_RECORD_NOT_FOUND',
    });
  });

  it('upserts records by user id and group id', async () => {
    prisma.ocrRecord.upsert.mockResolvedValue(record);

    const result = await createService().create('user_1', {
      groupId: 'group_1',
      rawText: '## 识别结果\n题目',
      parsedJson: { isQuestion: true, questionText: '计算极限' },
      status: 'DONE',
    });

    expect(prisma.ocrRecord.upsert).toHaveBeenCalledWith({
      where: {
        userId_groupId: {
          userId: 'user_1',
          groupId: 'group_1',
        },
      },
      update: {
        rawText: '## 识别结果\n题目',
        parsedJson: { isQuestion: true, questionText: '计算极限' },
        imageUrl: undefined,
        status: 'DONE',
      },
      create: {
        userId: 'user_1',
        groupId: 'group_1',
        rawText: '## 识别结果\n题目',
        parsedJson: { isQuestion: true, questionText: '计算极限' },
        imageUrl: undefined,
        status: 'DONE',
      },
    });
    expect(result.id).toBe('ocr_1');
  });

  it('rejects base64 image urls', async () => {
    await expect(
      createService().create('user_1', {
        groupId: 'group_1',
        rawText: 'text',
        imageUrl: 'data:image/png;base64,abc',
        status: 'DONE',
      }),
    ).rejects.toMatchObject({ code: 'OCR_RECORD_IMAGE_NOT_SUPPORTED' });
  });

  it('deletes only owned records', async () => {
    prisma.ocrRecord.findFirst.mockResolvedValue({ id: 'ocr_1' });
    prisma.ocrRecord.delete.mockResolvedValue(record);

    await expect(createService().delete('user_1', 'ocr_1')).resolves.toEqual({
      ok: true,
    });
    expect(prisma.ocrRecord.delete).toHaveBeenCalledWith({
      where: { id: 'ocr_1' },
    });
  });
});
```

- [ ] **Step 2: Run the service test and confirm it fails**

Run:

```powershell
bun --filter @repo/server test -- ocr-records.service
```

Expected: FAIL because `apps/server/src/ocr-records/ocr-records.service.ts` does not exist.

- [ ] **Step 3: Implement the service**

Create `apps/server/src/ocr-records/ocr-records.service.ts`:

```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateOcrRecordRequest,
  ListOcrRecordsQuery,
} from '@repo/types/api/ocr-record';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class OcrRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListOcrRecordsQuery) {
    const where = this.buildListWhere(userId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ocrRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.ocrRecord.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getById(userId: string, id: string) {
    const item = await this.prisma.ocrRecord.findFirst({
      where: { id, userId },
    });

    if (!item) {
      throw this.notFound();
    }

    return this.toResponse(item);
  }

  async create(userId: string, input: CreateOcrRecordRequest) {
    this.assertSupportedImageUrl(input.imageUrl);

    const item = await this.prisma.ocrRecord.upsert({
      where: {
        userId_groupId: {
          userId,
          groupId: input.groupId,
        },
      },
      update: {
        rawText: input.rawText,
        parsedJson: input.parsedJson as Prisma.InputJsonValue | undefined,
        imageUrl: input.imageUrl,
        status: input.status,
      },
      create: {
        userId,
        groupId: input.groupId,
        rawText: input.rawText,
        parsedJson: input.parsedJson as Prisma.InputJsonValue | undefined,
        imageUrl: input.imageUrl,
        status: input.status,
      },
    });

    return this.toResponse(item);
  }

  async delete(userId: string, id: string): Promise<{ ok: true }> {
    await this.ensureOwned(userId, id);
    await this.prisma.ocrRecord.delete({
      where: { id },
    });

    return { ok: true };
  }

  private async ensureOwned(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.ocrRecord.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      throw this.notFound();
    }
  }

  private buildListWhere(
    userId: string,
    query: ListOcrRecordsQuery,
  ): Prisma.OcrRecordWhereInput {
    const where: Prisma.OcrRecordWhereInput = { userId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.keyword) {
      where.rawText = { contains: query.keyword, mode: 'insensitive' };
    }
    if (query.isQuestion !== undefined) {
      where.parsedJson = {
        path: ['isQuestion'],
        equals: query.isQuestion,
      };
    }

    return where;
  }

  private assertSupportedImageUrl(imageUrl: string | undefined): void {
    if (imageUrl?.startsWith('data:')) {
      throw new AppError(
        'OCR_RECORD_IMAGE_NOT_SUPPORTED',
        'OCR 图片暂不支持上传 base64，请先保存在本地缓存',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private toResponse(item: OcrRecordRecord) {
    return {
      id: item.id,
      userId: item.userId,
      groupId: item.groupId,
      imageUrl: item.imageUrl,
      rawText: item.rawText,
      parsedJson: item.parsedJson,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private notFound(): AppError {
    return new AppError(
      'OCR_RECORD_NOT_FOUND',
      'OCR 记录不存在',
      HttpStatus.NOT_FOUND,
    );
  }
}

type OcrRecordRecord = Prisma.OcrRecordGetPayload<object>;
```

- [ ] **Step 4: Implement module and controller**

Create `apps/server/src/ocr-records/ocr-records.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  createOcrRecordRequestSchema,
  listOcrRecordsQuerySchema,
} from '@repo/types/api/ocr-record';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { OcrRecordsService } from './ocr-records.service';

@Controller('ocr-records')
@UseGuards(JwtAuthGuard)
export class OcrRecordsController {
  constructor(private readonly ocrRecordsService: OcrRecordsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = listOcrRecordsQuerySchema.parse(query);
    return this.ocrRecordsService.list(user.id, input);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ocrRecordsService.getById(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = createOcrRecordRequestSchema.parse(body);
    return this.ocrRecordsService.create(user.id, input);
  }

  @Delete(':id')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ocrRecordsService.delete(user.id, id);
  }
}
```

Create `apps/server/src/ocr-records/ocr-records.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { OcrRecordsController } from './ocr-records.controller';
import { OcrRecordsService } from './ocr-records.service';

@Module({
  imports: [AuthModule],
  controllers: [OcrRecordsController],
  providers: [OcrRecordsService],
})
export class OcrRecordsModule {}
```

Modify `apps/server/src/app.module.ts`:

```ts
import { OcrRecordsModule } from './ocr-records/ocr-records.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    WrongQuestionsModule,
    ChatMessagesModule,
    OcrRecordsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

- [ ] **Step 5: Run backend unit tests**

Run:

```powershell
bun --filter @repo/server test -- ocr-records.service
```

Expected: PASS.

- [ ] **Step 6: Commit backend module**

```powershell
git add apps/server/src/app.module.ts apps/server/src/ocr-records
git commit -m "feat: add OCR record backend API"
```

---

## Task 3: Backend OCRRecord E2E

**Files:**
- Create: `apps/server/test/ocr-records.e2e-spec.ts`

- [ ] **Step 1: Add e2e coverage**

Create `apps/server/test/ocr-records.e2e-spec.ts`:

```ts
import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';
import { ocrRecordListResponseSchema, ocrRecordSchema } from '@repo/types/api/ocr-record';

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

    const list = ocrRecordListResponseSchema.parse(getSuccessData(listResponse));
    expect(list.items).toHaveLength(1);
    expect(list.items[0].id).toBe(created.id);
    expect(list.total).toBe(1);

    const detailResponse = await request(server)
      .get(`/ocr-records/${created.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(ocrRecordSchema.parse(getSuccessData(detailResponse)).id).toBe(created.id);

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
```

- [ ] **Step 2: Run OCRRecord e2e**

Run with Docker PostgreSQL available:

```powershell
bun --filter @repo/server test:e2e -- ocr-records
```

Expected: PASS.

- [ ] **Step 3: Run backend verification**

Run:

```powershell
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
```

Expected: all pass.

- [ ] **Step 4: Commit e2e coverage**

```powershell
git add apps/server/test/ocr-records.e2e-spec.ts
git commit -m "test: cover OCR record API"
```

---

## Task 4: Frontend OCRRecord API Client and Hooks

**Files:**
- Create: `apps/web/src/lib/ocr-record-api.ts`
- Create: `apps/web/src/lib/ocr-record-api.test.mts`
- Create: `apps/web/src/hooks/use-ocr-records.ts`

- [ ] **Step 1: Write frontend mapper tests first**

Create `apps/web/src/lib/ocr-record-api.test.mts`:

```ts
import assert from 'node:assert/strict';

import { createApiClient } from './api-client.ts';
import {
  createOcrRecordApi,
  mapLocalOcrRecordToCreateRequest,
  mapOcrRecordResponseToLocalRecord,
} from './ocr-record-api.ts';
import type { OcrRecord } from './db.ts';

async function run() {
  testMapsServerResponseToLocalRecord();
  testStripsBase64ImageFromCreateRequest();
  await testListsOcrRecords();
  await testCreatesOcrRecord();
}

function testMapsServerResponseToLocalRecord() {
  const record = mapOcrRecordResponseToLocalRecord({
    id: 'ocr_1',
    userId: 'user_1',
    groupId: 'group_1',
    imageUrl: 'https://cdn.example.com/ocr.png',
    rawText: 'raw',
    parsedJson: { isQuestion: true, questionText: '题目' },
    status: 'DONE',
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:01.000Z',
  });

  assert.deepEqual(record, {
    id: 'ocr_1',
    userId: 'user_1',
    type: 'ocr-result',
    groupId: 'group_1',
    content: 'raw',
    imageUrl: 'https://cdn.example.com/ocr.png',
    createdAt: Date.parse('2026-06-12T00:00:00.000Z'),
  });
}

function testStripsBase64ImageFromCreateRequest() {
  const record: OcrRecord = {
    id: 'ocr_1',
    userId: 'user_1',
    type: 'ocr-result',
    groupId: 'group_1',
    content: 'raw',
    imageUrl: 'data:image/png;base64,abc',
    createdAt: 1,
  };

  assert.deepEqual(
    mapLocalOcrRecordToCreateRequest(record, {
      isQuestion: false,
      nonQuestionSummary: '普通图片',
    }),
    {
      groupId: 'group_1',
      rawText: 'raw',
      parsedJson: {
        isQuestion: false,
        nonQuestionSummary: '普通图片',
      },
      status: 'DONE',
    },
  );
}

async function testListsOcrRecords() {
  const requests: Array<{ input: string; authorization: string | null }> = [];
  const client = createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (input, init) => {
      requests.push({
        input: String(input),
        authorization: new Headers(init?.headers).get('authorization'),
      });

      return jsonResponse({
        success: true,
        data: {
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
        },
        requestId: 'req_1',
      });
    },
  });

  const api = createOcrRecordApi(client);
  const result = await api.list('token_1', {
    page: 1,
    pageSize: 20,
    isQuestion: false,
    keyword: '普通',
  });

  assert.equal(
    requests[0].input,
    'http://localhost:3001/ocr-records?page=1&pageSize=20&keyword=%E6%99%AE%E9%80%9A&isQuestion=false',
  );
  assert.equal(requests[0].authorization, 'Bearer token_1');
  assert.deepEqual(result, { items: [], total: 0, page: 1, pageSize: 20 });
}

async function testCreatesOcrRecord() {
  let body: unknown;
  const client = createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (_input, init) => {
      body = init?.body ? JSON.parse(String(init.body)) : undefined;

      return jsonResponse({
        success: true,
        data: {
          id: 'ocr_1',
          userId: 'user_1',
          groupId: 'group_1',
          imageUrl: null,
          rawText: 'raw',
          parsedJson: { isQuestion: true },
          status: 'DONE',
          createdAt: '2026-06-12T00:00:00.000Z',
          updatedAt: '2026-06-12T00:00:00.000Z',
        },
        requestId: 'req_2',
      });
    },
  });

  const api = createOcrRecordApi(client);
  const result = await api.create(
    'token_1',
    {
      id: 'local_1',
      userId: 'user_1',
      type: 'ocr-result',
      groupId: 'group_1',
      content: 'raw',
      createdAt: Date.parse('2026-06-12T00:00:00.000Z'),
    },
    { isQuestion: true },
  );

  assert.deepEqual(body, {
    groupId: 'group_1',
    rawText: 'raw',
    parsedJson: { isQuestion: true },
    status: 'DONE',
  });
  assert.equal(result.id, 'ocr_1');
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

await run();
```

- [ ] **Step 2: Run the mapper test and confirm it fails**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts
```

Expected: FAIL because `apps/web/src/lib/ocr-record-api.ts` does not exist.

- [ ] **Step 3: Implement frontend API mapping**

Create `apps/web/src/lib/ocr-record-api.ts`:

```ts
import {
  createOcrRecordRequestSchema,
  ocrRecordListResponseSchema,
  ocrRecordSchema,
  type CreateOcrRecordRequest,
  type ListOcrRecordsQuery,
  type OcrParsedPayload,
  type OcrRecordResponse,
} from '@repo/types/api/ocr-record';

import type { OcrRecord } from './db';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
  post: <T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null },
  ) => Promise<T>;
  delete: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

export type OcrRecordListFilters = {
  page?: number;
  pageSize?: number;
  status?: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  keyword?: string;
  isQuestion?: boolean;
};

export function createOcrRecordApi(client: ApiClient) {
  return {
    async list(accessToken: string, filters: OcrRecordListFilters = {}) {
      const response = ocrRecordListResponseSchema.parse(
        await client.get<unknown>(`/ocr-records${toQueryString(filters)}`, {
          accessToken,
        }),
      );

      return {
        ...response,
        items: response.items.map(mapOcrRecordResponseToLocalRecord),
      };
    },

    async getById(accessToken: string, id: string) {
      return mapOcrRecordResponseToLocalRecord(
        ocrRecordSchema.parse(
          await client.get<unknown>(`/ocr-records/${id}`, { accessToken }),
        ),
      );
    },

    async create(
      accessToken: string,
      record: OcrRecord,
      parsedJson: OcrParsedPayload,
    ) {
      const request = mapLocalOcrRecordToCreateRequest(record, parsedJson);
      return mapOcrRecordResponseToLocalRecord(
        ocrRecordSchema.parse(
          await client.post<unknown>('/ocr-records', request, { accessToken }),
        ),
      );
    },

    async delete(accessToken: string, id: string) {
      return client.delete<{ ok: true }>(`/ocr-records/${id}`, { accessToken });
    },
  };
}

export function mapOcrRecordResponseToLocalRecord(
  response: OcrRecordResponse,
): OcrRecord {
  return {
    id: response.id,
    userId: response.userId,
    type: 'ocr-result',
    groupId: response.groupId,
    content: response.rawText,
    imageUrl: response.imageUrl ?? undefined,
    createdAt: Date.parse(response.createdAt),
  };
}

export function mapLocalOcrRecordToCreateRequest(
  record: OcrRecord,
  parsedJson: OcrParsedPayload,
): CreateOcrRecordRequest {
  const request = createOcrRecordRequestSchema.parse({
    groupId: record.groupId ?? record.id,
    rawText: record.content,
    parsedJson,
    imageUrl: toServerImageUrl(record.imageUrl),
    status: record.content.trim() ? 'DONE' : 'FAILED',
  });

  return stripUndefined(request);
}

function toQueryString(filters: OcrRecordListFilters) {
  const query: Partial<ListOcrRecordsQuery> = {};

  if (filters.page !== undefined) query.page = filters.page;
  if (filters.pageSize !== undefined) query.pageSize = filters.pageSize;
  if (filters.status !== undefined) query.status = filters.status;
  if (filters.keyword) query.keyword = filters.keyword;
  if (filters.isQuestion !== undefined) query.isQuestion = filters.isQuestion;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    search.set(key, String(value));
  }

  const value = search.toString();
  return value ? `?${value}` : '';
}

function toServerImageUrl(value: string | undefined) {
  const imageUrl = value?.trim();
  if (!imageUrl || imageUrl.startsWith('data:')) return undefined;
  return imageUrl;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}
```

- [ ] **Step 4: Implement hooks**

Create `apps/web/src/hooks/use-ocr-records.ts`:

```ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OcrParsedPayload } from '@repo/types/api/ocr-record';

import { apiClient } from '@/lib/api-client';
import {
  createOcrRecordApi,
  type OcrRecordListFilters,
} from '@/lib/ocr-record-api';
import type { OcrRecord } from '@/lib/db';
import { useUserStore } from '@/stores/userStore';

const ocrRecordApi = createOcrRecordApi(apiClient);

export const ocrRecordQueryKeys = {
  all: ['ocr-records'] as const,
  list: (filters: OcrRecordListFilters) =>
    [...ocrRecordQueryKeys.all, 'list', filters] as const,
};

export function useOcrRecords(filters: OcrRecordListFilters = {}) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: ocrRecordQueryKeys.list(filters),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return ocrRecordApi.list(accessToken, filters);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useCreateOcrRecord() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      record,
      parsedJson,
    }: {
      record: OcrRecord;
      parsedJson: OcrParsedPayload;
    }) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return ocrRecordApi.create(accessToken, record, parsedJson);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ocrRecordQueryKeys.all });
    },
  });
}

export function useDeleteOcrRecord() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      await ocrRecordApi.delete(accessToken, id);
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ocrRecordQueryKeys.all });
    },
  });
}
```

- [ ] **Step 5: Run frontend API tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts
```

Expected: PASS.

- [ ] **Step 6: Commit frontend API layer**

```powershell
git add apps/web/src/lib/ocr-record-api.ts apps/web/src/lib/ocr-record-api.test.mts apps/web/src/hooks/use-ocr-records.ts
git commit -m "feat: add OCR record frontend API"
```

---

## Task 5: Connect OCRRecord API to Chat Page

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/page.tsx`
- Test: `apps/web/src/lib/ocr-record-api.test.mts`

- [ ] **Step 1: Import the OCRRecord hook and parsed type**

Modify imports in `apps/web/src/app/(chat)/chat/page.tsx`:

```ts
import { useCreateOcrRecord, useOcrRecords } from '@/hooks/use-ocr-records';
import type { OcrParsedPayload } from '@repo/types/api/ocr-record';
```

- [ ] **Step 2: Add helper to convert ParsedWrongQuestion to OcrParsedPayload**

Add near `createActiveStudyContextFromOcr`:

```ts
function toOcrParsedPayload(parsed: ParsedWrongQuestion): OcrParsedPayload {
  return {
    isQuestion: parsed.isQuestion,
    nonQuestionSummary: parsed.nonQuestionSummary || undefined,
    subject: parsed.subject || undefined,
    questionText: parsed.questionText || undefined,
    category: parsed.category || undefined,
    knowledgePoints: parsed.knowledgePoints,
    analysis: parsed.analysis || undefined,
    answer: parsed.answer || undefined,
    errorSuggestion: parsed.errorType || undefined,
  };
}
```

- [ ] **Step 3: Initialize server OCR query and mutation**

Inside `ChatView`, next to chat message hooks:

```ts
const ocrRecordsQuery = useOcrRecords({ pageSize: 50 });
const createOcrRecord = useCreateOcrRecord();
```

- [ ] **Step 4: Hydrate OCR records from server into Dexie**

Add a `serverOcrHydratedRef` next to the existing `serverMessagesHydratedRef` declaration:

```ts
const serverOcrHydratedRef = useRef(false);
```

Add effect after `saveOcrToDb`:

```ts
useEffect(() => {
  if (serverOcrHydratedRef.current) return;
  if (!ocrRecordsQuery.data) return;

  serverOcrHydratedRef.current = true;
  const serverItems = ocrRecordsQuery.data.items;
  if (serverItems.length === 0) return;

  const merged = mergeOcrRecordsPreservingLocalImages(serverItems, ocrMsgRef.current);
  setOcrMessages(merged);
  setActiveStudyContext(getLatestActiveStudyContext(merged));
  void saveOcrToDb(merged);
}, [ocrRecordsQuery.data, saveOcrToDb]);
```

Add this helper inside `ChatView`, below `saveOcrToDb`, so it can close over the current `userId`:

```ts
function mergeOcrRecordsPreservingLocalImages(
  serverItems: OcrRecord[],
  localItems: OcrRecord[],
) {
  const localUserImagesByGroup = new Map(
    localItems
      .filter((item) => item.type === 'user' && item.groupId && item.imageUrl)
      .map((item) => [item.groupId as string, item.imageUrl as string]),
  );
  const localResultImagesByGroup = new Map(
    localItems
      .filter((item) => item.type === 'ocr-result' && item.groupId && item.imageUrl)
      .map((item) => [item.groupId as string, item.imageUrl as string]),
  );

  const userRecords = Array.from(localUserImagesByGroup.entries()).map(
    ([groupId, imageUrl]) => ({
      id: `${groupId}-user`,
      userId,
      type: 'user' as const,
      groupId,
      content: '',
      imageUrl,
      createdAt:
        localItems.find((item) => item.groupId === groupId && item.type === 'user')
          ?.createdAt ?? Date.now(),
    }),
  );

  const resultRecords = serverItems.map((item) => ({
    ...item,
    imageUrl:
      item.imageUrl ??
      (item.groupId ? localResultImagesByGroup.get(item.groupId) : undefined),
  }));

  return [...userRecords, ...resultRecords].sort((a, b) => a.createdAt - b.createdAt);
}
```

- [ ] **Step 5: Save OCR result to server after stream completion**

In the success path after `finalResultRecord` is created and before `setActiveStudyContext(...)`, add:

```ts
const parsed = parseOcrResult(fullContent);
let persistedResultRecord = finalResultRecord;
try {
  persistedResultRecord = await createOcrRecord.mutateAsync({
    record: finalResultRecord,
    parsedJson: toOcrParsedPayload(parsed),
  });
} catch (error) {
  console.warn(
    error instanceof Error
      ? `OCR record sync failed: ${error.message}`
      : 'OCR record sync failed',
  );
}
const finalOcr = ocrMsgRef.current.map((m) =>
  m.id === resultMsgId
    ? {
        ...m,
        id: persistedResultRecord.id,
        content: fullContent,
        imageUrl: m.imageUrl ?? persistedResultRecord.imageUrl,
      }
    : m,
);
setActiveStudyContext(createActiveStudyContextFromOcr(persistedResultRecord));
```

Remove the old `finalOcr` calculation that only patches `content`.

- [ ] **Step 6: Preserve server OCR id when saving wrong questions**

The current save flow already uses:

```ts
sourceRecordId: result.id,
sourceGroupId,
```

After Step 5, `result.id` will be the server `OcrRecord.id` for records saved after this change. No extra field is needed.

- [ ] **Step 7: Run focused frontend tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts
node --experimental-strip-types apps/web/src/lib/wrong-question-parser.test.mts
bun --filter @repo/web lint
```

Expected: all pass.

- [ ] **Step 8: Commit chat page integration**

```powershell
git add "apps/web/src/app/(chat)/chat/page.tsx"
git commit -m "feat: sync OCR records from chat"
```

---

## Task 6: Final Verification and Documentation

**Files:**
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `DEVLOG.md`
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Run full local verification**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts
node --experimental-strip-types apps/web/src/lib/chat-message-api.test.mts
node --experimental-strip-types apps/web/src/lib/wrong-question-api.test.mts
node --experimental-strip-types apps/web/src/lib/wrong-question-parser.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
bun --cwd packages/types typecheck
```

Expected: all pass. If `web build` fails due to Google Fonts network access, rerun it only after confirming the failure is network/font fetch related and record that exact limitation in the final status.

- [ ] **Step 2: Update data-flow documentation**

In `docs/data-flow.md`, change the current version summary to state:

```text
WrongQuestion、ChatMessage 与 OCRRecord 后端 API 及前端接入已完成；图片二进制仍保留在 Dexie，后续迁移到 MinIO/OSS。
```

Update OCR flow:

```text
POST /api/ocr
  -> 外部 AI OCR SSE
  -> parseOcrResult(content)
  -> POST /ocr-records
  -> PostgreSQL OcrRecord
  -> Dexie ocrRecords 缓存
  -> 有效题目生成 activeStudyContext
  -> 保存错题时 sourceRecordId 指向服务端 OCRRecord.id
```

- [ ] **Step 3: Update roadmap and handoff docs**

In `docs/roadmap.md`, move OCRRecord API from next priority to completed Phase 2.3 work. Keep next priorities as:

```text
1. 图片从 base64 迁移到 MinIO/OSS URL。
2. Dexie 离线 mutation 队列与乐观更新层。
3. Phase 3 OCR structured output schema 与 tool calling 设计。
```

In `CLAUDE.md` and `AGENTS.md`, update current data flow:

```text
- `/ocr-records` 已提供 OCR 历史读取、创建/upsert 和删除；OCR 原始记录以服务端为权威来源，Dexie 作为本地缓存。
- 图片二进制暂不上传服务端，当前设备预览仍保存在 Dexie；后续迁移到 MinIO/OSS。
```

- [ ] **Step 4: Update DEVLOG**

Append under the current date section:

```text
**Phase 2.3 OCRRecord API 与前端 OCR 历史迁移**

- 新增 `@repo/types/api/ocr-record`，定义 OCRRecord schema、创建请求、列表查询和列表响应。
- 新增后端 `/ocr-records` API：列表、详情、创建/upsert、删除。
- OCRRecord API 接入 JWT 鉴权，所有读写按当前 `userId` 隔离。
- 同一用户重复提交相同 `groupId` 时执行 upsert，避免重复 OCR 记录。
- 前端新增 `ocr-record-api` 与 hooks，OCR 识别完成后同步服务端并写入 Dexie 缓存。
- 保存错题时 `sourceRecordId` 指向服务端 OCRRecord id。
- 图片 base64 仍仅保存在 Dexie，本阶段不上传服务端。
```

Add verification command results after running Step 1.

- [ ] **Step 5: Commit docs**

```powershell
git add docs/data-flow.md docs/roadmap.md DEVLOG.md CLAUDE.md AGENTS.md
git commit -m "docs: update OCR record data flow"
```

- [ ] **Step 6: Final git status check**

Run:

```powershell
git status --short
```

Expected: only unrelated local ignored/untracked items such as `.playwright-mcp/` remain.
