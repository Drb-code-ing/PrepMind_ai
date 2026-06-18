# Phase 5.2 Knowledge Upload API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Phase 5.2 backend foundation that uploads knowledge documents to MinIO and exposes authenticated document status APIs.

**Architecture:** Extend the existing Phase 5.1 `Document` model and `@repo/types/api/knowledge` contracts. Reuse the current NestJS auth, response envelope, Prisma service, and MinIO-backed `StorageService`; do not implement parsing, chunking, embedding, search, Chat RAG injection, or frontend pages in this phase.

**Tech Stack:** Bun workspace, NestJS 11, Prisma, PostgreSQL, MinIO, Multer/FileInterceptor, Zod, Jest, Supertest.

---

## File Structure

Create:

- `apps/server/src/knowledge-documents/knowledge-documents.controller.ts`  
  Authenticated REST controller for upload, list, detail, and delete.
- `apps/server/src/knowledge-documents/knowledge-documents.service.ts`  
  Owns Document persistence, user isolation, content hash, response mapping, and storage cleanup.
- `apps/server/src/knowledge-documents/knowledge-documents.module.ts`  
  Wires controller/service with `AuthModule` and `UploadsModule`.
- `apps/server/src/knowledge-documents/knowledge-documents.service.spec.ts`  
  Unit tests for service ownership, response mapping, deletion, and rollback.
- `apps/server/test/knowledge-documents.e2e-spec.ts`  
  E2E coverage for auth, upload validation, list/detail/delete, and cross-user isolation.

Modify:

- `packages/types/src/api/knowledge.ts`  
  Add Phase 5.2 upload/delete/detail schemas and document MIME schemas.
- `packages/types/tests/knowledge.test.mts`  
  Add contract tests for upload response, delete response, and document MIME/type boundaries.
- `apps/server/src/config/env.ts`  
  Add `UPLOAD_DOCUMENT_MAX_BYTES` with 20MB default.
- `apps/server/src/uploads/storage.service.ts`  
  Add knowledge document object upload/delete helpers while keeping image behavior unchanged.
- `apps/server/src/uploads/storage.service.spec.ts`  
  Add storage tests for knowledge documents and delete behavior.
- `apps/server/src/app.module.ts`  
  Import `KnowledgeDocumentsModule`.
- `DEVLOG.md`, `docs/data-flow.md`, `docs/roadmap.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`  
  Update only after implementation is verified.

Do not modify:

- `apps/web/src/**`
- `packages/rag/src/**`
- `packages/agent/src/**`
- Any Chat RAG prompt or retrieval code

---

## Task 1: Extend Knowledge Contracts

**Files:**

- Modify: `packages/types/src/api/knowledge.ts`
- Modify: `packages/types/tests/knowledge.test.mts`

- [ ] **Step 1: Add failing contract tests**

Append these imports in `packages/types/tests/knowledge.test.mts`:

```ts
  knowledgeDocumentDeleteResponseSchema,
  knowledgeDocumentMimeTypeSchema,
  knowledgeDocumentUploadResponseSchema,
```

Update `run()`:

```ts
function run() {
  testEnums();
  testDocumentMimeTypes();
  testDocumentResponse();
  testUploadResponse();
  testFailedDocumentResponse();
  testListQuery();
  testListResponse();
  testSearchRequest();
  testSearchResponse();
  testDeleteResponse();
}
```

Add tests:

```ts
function testDocumentMimeTypes() {
  assert.equal(knowledgeDocumentMimeTypeSchema.parse('application/pdf'), 'application/pdf');
  assert.equal(knowledgeDocumentMimeTypeSchema.parse('text/plain'), 'text/plain');
  assert.equal(
    knowledgeDocumentMimeTypeSchema.parse(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );

  assert.throws(() => knowledgeDocumentMimeTypeSchema.parse('image/png'));
  assert.throws(() => knowledgeDocumentMimeTypeSchema.parse('application/zip'));
}

function testUploadResponse() {
  const result = knowledgeDocumentUploadResponseSchema.parse(createDocumentPayload());

  assert.equal(result.status, 'DONE');
  assert.equal(result.contentHash, 'sha256:abc');
}

function testDeleteResponse() {
  assert.deepEqual(knowledgeDocumentDeleteResponseSchema.parse({ ok: true }), { ok: true });
  assert.throws(() => knowledgeDocumentDeleteResponseSchema.parse({ ok: false }));
}
```

- [ ] **Step 2: Run the failing contract test**

Run:

```powershell
bun packages/types/tests/knowledge.test.mts
```

Expected: fail because the new schemas are not exported yet.

- [ ] **Step 3: Implement the contract schemas**

In `packages/types/src/api/knowledge.ts`, add after `knowledgeDocumentTypeSchema`:

```ts
export const knowledgeDocumentMimeTypeSchema = z.enum([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/x-markdown',
  'text/plain',
]);
```

Update `knowledgeDocumentResponseSchema.mimeType`:

```ts
  mimeType: knowledgeDocumentMimeTypeSchema,
```

Add after `knowledgeDocumentResponseSchema`:

```ts
export const knowledgeDocumentUploadResponseSchema = knowledgeDocumentResponseSchema;

export const knowledgeDocumentDetailResponseSchema = knowledgeDocumentResponseSchema;

export const knowledgeDocumentDeleteResponseSchema = z.object({
  ok: z.literal(true),
});
```

Add types:

```ts
export type KnowledgeDocumentMimeType = z.infer<typeof knowledgeDocumentMimeTypeSchema>;
export type KnowledgeDocumentUploadResponse = z.infer<
  typeof knowledgeDocumentUploadResponseSchema
>;
export type KnowledgeDocumentDetailResponse = z.infer<
  typeof knowledgeDocumentDetailResponseSchema
>;
export type KnowledgeDocumentDeleteResponse = z.infer<
  typeof knowledgeDocumentDeleteResponseSchema
>;
```

- [ ] **Step 4: Run contract tests and typecheck**

Run:

```powershell
bun packages/types/tests/knowledge.test.mts
bun --cwd packages/types typecheck
```

Expected: both exit 0.

- [ ] **Step 5: Commit contracts**

Run:

```powershell
git add packages/types/src/api/knowledge.ts packages/types/tests/knowledge.test.mts
git commit -m "feat: extend knowledge document contracts"
```

---

## Task 2: Extend Storage Service For Knowledge Documents

**Files:**

- Modify: `apps/server/src/config/env.ts`
- Modify: `apps/server/src/uploads/storage.service.ts`
- Modify: `apps/server/src/uploads/storage.service.spec.ts`

- [ ] **Step 1: Write failing storage tests**

In `apps/server/src/uploads/storage.service.spec.ts`, extend `configValues`:

```ts
    UPLOAD_DOCUMENT_MAX_BYTES: 20 * 1024 * 1024,
```

Extend `minioClient`:

```ts
    removeObject: jest.fn(),
```

Add tests:

```ts
  it('uploads supported knowledge documents under a user scoped object key', async () => {
    const result = await createService().uploadKnowledgeDocument('user_1', {
      file: {
        buffer: Buffer.from('pdf'),
        mimetype: 'application/pdf',
        size: 3,
        originalname: 'calculus.pdf',
      } as Express.Multer.File,
    });

    expect(result.objectKey).toMatch(/^users\/user_1\/knowledge\/[a-f0-9-]+\.pdf$/);
    expect(result.mimeType).toBe('application/pdf');
    expect(result.type).toBe('PDF');
    expect(result.originalName).toBe('calculus.pdf');
    expect(minioClient.putObject).toHaveBeenCalledWith(
      'prepmind-dev',
      result.objectKey,
      Buffer.from('pdf'),
      3,
      { 'Content-Type': 'application/pdf' },
    );
  });

  it('rejects unsupported knowledge document types', async () => {
    await expect(
      createService().uploadKnowledgeDocument('user_1', {
        file: {
          buffer: Buffer.from('zip'),
          mimetype: 'application/zip',
          size: 3,
          originalname: 'archive.zip',
        } as Express.Multer.File,
      }),
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_DOCUMENT_INVALID_TYPE' });
  });

  it('rejects knowledge documents larger than the configured limit', async () => {
    await expect(
      createService().uploadKnowledgeDocument('user_1', {
        file: {
          buffer: Buffer.alloc(20 * 1024 * 1024 + 1),
          mimetype: 'application/pdf',
          size: 20 * 1024 * 1024 + 1,
          originalname: 'large.pdf',
        } as Express.Multer.File,
      }),
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_DOCUMENT_TOO_LARGE' });
  });

  it('deletes an uploaded object by key', async () => {
    await createService().deleteObject('users/user_1/knowledge/doc.pdf');

    expect(minioClient.removeObject).toHaveBeenCalledWith(
      'prepmind-dev',
      'users/user_1/knowledge/doc.pdf',
    );
  });
```

- [ ] **Step 2: Run the failing storage tests**

Run:

```powershell
bun --filter @repo/server test -- storage.service.spec.ts
```

Expected: fail because `UPLOAD_DOCUMENT_MAX_BYTES`, `uploadKnowledgeDocument()`, and `deleteObject()` do not exist.

- [ ] **Step 3: Add document max size env**

In `apps/server/src/config/env.ts`, add after `UPLOAD_IMAGE_MAX_BYTES`:

```ts
  UPLOAD_DOCUMENT_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(20 * 1024 * 1024),
```

- [ ] **Step 4: Implement storage helpers**

In `apps/server/src/uploads/storage.service.ts`:

1. Add imports:

```ts
import type {
  KnowledgeDocumentMimeType,
  KnowledgeDocumentType,
} from '@repo/types/api/knowledge';
```

2. Extend `MinioClientLike`:

```ts
  'bucketExists' | 'makeBucket' | 'putObject' | 'statObject' | 'getObject' | 'removeObject'
```

3. Add type:

```ts
type UploadKnowledgeDocumentInput = {
  file: Express.Multer.File | undefined;
};
```

4. Add constants:

```ts
const documentMimeTypes: Record<
  KnowledgeDocumentMimeType,
  { extension: string; type: KnowledgeDocumentType }
> = {
  'application/pdf': { extension: 'pdf', type: 'PDF' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extension: 'docx',
    type: 'DOCX',
  },
  'text/markdown': { extension: 'md', type: 'MD' },
  'text/x-markdown': { extension: 'md', type: 'MD' },
  'text/plain': { extension: 'txt', type: 'TXT' },
};
```

5. Add constructor field:

```ts
  private readonly maxDocumentBytes: number;
```

Initialize it:

```ts
    this.maxDocumentBytes = this.configService.get('UPLOAD_DOCUMENT_MAX_BYTES', {
      infer: true,
    });
```

6. Add methods:

```ts
  async uploadKnowledgeDocument(userId: string, input: UploadKnowledgeDocumentInput) {
    const file = input.file;
    if (!file) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_REQUIRED',
        '请选择要上传的资料文件',
        HttpStatus.BAD_REQUEST,
      );
    }

    const documentType = this.assertSupportedDocument(file);
    if (file.size > this.maxDocumentBytes) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_TOO_LARGE',
        '资料文件大小超过限制',
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    await this.ensureBucket();
    const objectKey = [
      'users',
      sanitizeSegment(userId),
      'knowledge',
      `${randomUUID()}.${documentType.extension}`,
    ].join('/');

    await this.minioClient.putObject(
      this.bucket,
      objectKey,
      file.buffer,
      file.size,
      { 'Content-Type': documentType.mimeType },
    );

    return {
      objectKey,
      mimeType: documentType.mimeType,
      type: documentType.type,
      size: file.size,
      originalName: file.originalname || 'untitled',
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    const safeKey = this.assertStorageObjectKey(objectKey);
    await this.minioClient.removeObject(this.bucket, safeKey);
  }

  private assertSupportedDocument(file: Express.Multer.File): {
    mimeType: KnowledgeDocumentMimeType;
    extension: string;
    type: KnowledgeDocumentType;
  } {
    const mimeType = this.normalizeDocumentMimeType(file.mimetype, file.originalname);
    const documentType = documentMimeTypes[mimeType];
    if (!documentType) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_INVALID_TYPE',
        '仅支持 PDF、DOCX、Markdown 和 TXT 资料',
        HttpStatus.BAD_REQUEST,
      );
    }
    return { mimeType, ...documentType };
  }

  private normalizeDocumentMimeType(
    mimeType: string,
    originalName: string | undefined,
  ): KnowledgeDocumentMimeType {
    if (mimeType in documentMimeTypes) {
      return mimeType as KnowledgeDocumentMimeType;
    }

    const lowerName = (originalName ?? '').toLowerCase();
    if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) {
      return 'text/markdown';
    }

    throw new AppError(
      'KNOWLEDGE_DOCUMENT_INVALID_TYPE',
      '仅支持 PDF、DOCX、Markdown 和 TXT 资料',
      HttpStatus.BAD_REQUEST,
    );
  }

  private assertStorageObjectKey(objectKey: string): string {
    const trimmed = objectKey.trim();
    if (
      !trimmed ||
      trimmed.includes('..') ||
      trimmed.includes('\\') ||
      trimmed.startsWith('/') ||
      !trimmed.startsWith('users/')
    ) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_NOT_FOUND',
        '资料不存在',
        HttpStatus.NOT_FOUND,
      );
    }
    return trimmed;
  }
```

- [ ] **Step 5: Run storage tests**

Run:

```powershell
bun --filter @repo/server test -- storage.service.spec.ts
```

Expected: exit 0.

- [ ] **Step 6: Commit storage helpers**

Run:

```powershell
git add apps/server/src/config/env.ts apps/server/src/uploads/storage.service.ts apps/server/src/uploads/storage.service.spec.ts
git commit -m "feat: add knowledge document storage helpers"
```

---

## Task 3: Add Knowledge Documents Service And Controller

**Files:**

- Create: `apps/server/src/knowledge-documents/knowledge-documents.service.ts`
- Create: `apps/server/src/knowledge-documents/knowledge-documents.controller.ts`
- Create: `apps/server/src/knowledge-documents/knowledge-documents.module.ts`
- Create: `apps/server/src/knowledge-documents/knowledge-documents.service.spec.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Write failing service tests**

Create `apps/server/src/knowledge-documents/knowledge-documents.service.spec.ts`:

```ts
import { HttpStatus } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../uploads/storage.service';
import { KnowledgeDocumentsService } from './knowledge-documents.service';

describe('KnowledgeDocumentsService', () => {
  const now = new Date('2026-06-18T10:00:00.000Z');
  const documentRow = {
    id: 'doc_1',
    name: 'calculus.pdf',
    type: 'PDF',
    size: 3,
    mimeType: 'application/pdf',
    storageKey: 'users/user_1/knowledge/doc.pdf',
    status: 'PENDING',
    sourceType: 'UPLOAD',
    errorMessage: null,
    contentHash: 'sha256:49f68a5c8493ec2c0bf489821c21fc3b',
    processedAt: null,
    userId: 'user_1',
    createdAt: now,
    updatedAt: now,
    _count: { chunks: 0 },
  };
  const prisma = {
    document: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };
  const storage = {
    uploadKnowledgeDocument: jest.fn(),
    deleteObject: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  function createService() {
    return new KnowledgeDocumentsService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
    );
  }

  it('uploads a document and creates a pending row', async () => {
    const file = {
      buffer: Buffer.from('pdf'),
      mimetype: 'application/pdf',
      size: 3,
      originalname: 'calculus.pdf',
    } as Express.Multer.File;
    storage.uploadKnowledgeDocument.mockResolvedValue({
      objectKey: 'users/user_1/knowledge/doc.pdf',
      mimeType: 'application/pdf',
      type: 'PDF',
      size: 3,
      originalName: 'calculus.pdf',
    });
    prisma.document.create.mockResolvedValue(documentRow);

    const result = await createService().createUploadDocument('user_1', file);

    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        name: 'calculus.pdf',
        type: 'PDF',
        size: 3,
        mimeType: 'application/pdf',
        storageKey: 'users/user_1/knowledge/doc.pdf',
        status: 'PENDING',
        sourceType: 'UPLOAD',
        contentHash: expect.stringMatching(/^sha256:/),
      },
      include: { _count: { select: { chunks: true } } },
    });
    expect(result.status).toBe('PENDING');
    expect(result.chunkCount).toBe(0);
  });

  it('deletes uploaded object when database create fails', async () => {
    storage.uploadKnowledgeDocument.mockResolvedValue({
      objectKey: 'users/user_1/knowledge/orphan.pdf',
      mimeType: 'application/pdf',
      type: 'PDF',
      size: 3,
      originalName: 'calculus.pdf',
    });
    prisma.document.create.mockRejectedValue(new Error('database down'));

    await expect(
      createService().createUploadDocument('user_1', {
        buffer: Buffer.from('pdf'),
        mimetype: 'application/pdf',
        size: 3,
        originalname: 'calculus.pdf',
      } as Express.Multer.File),
    ).rejects.toThrow('database down');
    expect(storage.deleteObject).toHaveBeenCalledWith('users/user_1/knowledge/orphan.pdf');
  });

  it('lists only current user documents with optional filters', async () => {
    prisma.document.findMany.mockResolvedValue([documentRow]);

    const result = await createService().list('user_1', {
      status: 'PENDING',
      sourceType: 'UPLOAD',
      limit: 20,
    });

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', status: 'PENDING', sourceType: 'UPLOAD' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 21,
      include: { _count: { select: { chunks: true } } },
    });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('throws not found for cross-user detail access', async () => {
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(createService().getById('user_2', 'doc_1')).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  });

  it('deletes owned document and its storage object', async () => {
    prisma.document.findFirst.mockResolvedValue(documentRow);
    prisma.document.delete.mockResolvedValue(documentRow);

    const result = await createService().delete('user_1', 'doc_1');

    expect(storage.deleteObject).toHaveBeenCalledWith('users/user_1/knowledge/doc.pdf');
    expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 'doc_1' } });
    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run the failing service test**

Run:

```powershell
bun --filter @repo/server test -- knowledge-documents.service.spec.ts
```

Expected: fail because the module files do not exist.

- [ ] **Step 3: Implement the service**

Create `apps/server/src/knowledge-documents/knowledge-documents.service.ts`:

```ts
import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { KnowledgeDocumentListQuery } from '@repo/types/api/knowledge';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../uploads/storage.service';

@Injectable()
export class KnowledgeDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async createUploadDocument(userId: string, file: Express.Multer.File | undefined) {
    const uploaded = await this.storageService.uploadKnowledgeDocument(userId, { file });

    try {
      const document = await this.prisma.document.create({
        data: {
          userId,
          name: uploaded.originalName,
          type: uploaded.type,
          size: uploaded.size,
          mimeType: uploaded.mimeType,
          storageKey: uploaded.objectKey,
          status: 'PENDING',
          sourceType: 'UPLOAD',
          contentHash: this.createContentHash(file?.buffer ?? Buffer.alloc(0)),
        },
        include: this.documentInclude,
      });

      return this.toResponse(document);
    } catch (error) {
      await this.safeDeleteObject(uploaded.objectKey);
      throw error;
    }
  }

  async list(userId: string, query: KnowledgeDocumentListQuery) {
    const where: Prisma.DocumentWhereInput = { userId };
    if (query.status) where.status = query.status;
    if (query.sourceType) where.sourceType = query.sourceType;

    const documents = await this.prisma.document.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      include: this.documentInclude,
    });
    const items = documents.slice(0, query.limit);
    const next = documents.length > query.limit ? items.at(-1)?.id ?? null : null;

    return {
      items: items.map((document) => this.toResponse(document)),
      nextCursor: next,
    };
  }

  async getById(userId: string, id: string) {
    const document = await this.findOwned(userId, id);
    return this.toResponse(document);
  }

  async delete(userId: string, id: string): Promise<{ ok: true }> {
    const document = await this.findOwned(userId, id);
    await this.safeDeleteObject(document.storageKey);
    await this.prisma.document.delete({ where: { id } });
    return { ok: true };
  }

  private readonly documentInclude = {
    _count: { select: { chunks: true } },
  } satisfies Prisma.DocumentInclude;

  private async findOwned(userId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, userId },
      include: this.documentInclude,
    });

    if (!document) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_NOT_FOUND',
        '资料不存在',
        HttpStatus.NOT_FOUND,
      );
    }

    return document;
  }

  private createContentHash(buffer: Buffer) {
    return `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
  }

  private async safeDeleteObject(objectKey: string) {
    try {
      await this.storageService.deleteObject(objectKey);
    } catch {
      // Storage cleanup is best-effort; database ownership remains authoritative.
    }
  }

  private toResponse(document: KnowledgeDocumentRecord) {
    return {
      id: document.id,
      name: document.name,
      type: document.type,
      size: document.size,
      mimeType: document.mimeType,
      status: document.status,
      sourceType: document.sourceType,
      errorMessage: document.errorMessage,
      contentHash: document.contentHash,
      chunkCount: document._count.chunks,
      processedAt: document.processedAt?.toISOString() ?? null,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}

type KnowledgeDocumentRecord = Prisma.DocumentGetPayload<{
  include: { _count: { select: { chunks: true } } };
}>;
```

- [ ] **Step 4: Implement controller and module**

Create `apps/server/src/knowledge-documents/knowledge-documents.controller.ts`:

```ts
import {
  CallHandler,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  mixin,
  type NestInterceptor,
  type Type,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Observable } from 'rxjs';
import { knowledgeDocumentListQuerySchema } from '@repo/types/api/knowledge';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import type { ServerEnv } from '../config/env';
import { KnowledgeDocumentsService } from './knowledge-documents.service';

@Controller('knowledge/documents')
@UseGuards(JwtAuthGuard)
export class KnowledgeDocumentsController {
  constructor(
    private readonly knowledgeDocumentsService: KnowledgeDocumentsService,
  ) {}

  @Post()
  @UseInterceptors(createKnowledgeDocumentFileInterceptor())
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.knowledgeDocumentsService.createUploadDocument(user.id, file);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = knowledgeDocumentListQuerySchema.parse(query);
    return this.knowledgeDocumentsService.list(user.id, input);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.knowledgeDocumentsService.getById(user.id, id);
  }

  @Delete(':id')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.knowledgeDocumentsService.delete(user.id, id);
  }
}

function createKnowledgeDocumentFileInterceptor(): Type<NestInterceptor> {
  class KnowledgeDocumentFileInterceptor implements NestInterceptor {
    private readonly delegate: NestInterceptor;

    constructor(
      @Inject(ConfigService)
      private readonly configService: ConfigService<ServerEnv, true>,
    ) {
      const maxDocumentBytes = this.configService.get('UPLOAD_DOCUMENT_MAX_BYTES', {
        infer: true,
      });
      this.delegate = new (FileInterceptor('file', {
        limits: {
          fileSize: maxDocumentBytes,
        },
      }))();
    }

    intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Observable<unknown> | Promise<Observable<unknown>> {
      return this.delegate.intercept(context, next);
    }
  }

  return mixin(KnowledgeDocumentFileInterceptor);
}
```

Create `apps/server/src/knowledge-documents/knowledge-documents.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { KnowledgeDocumentsController } from './knowledge-documents.controller';
import { KnowledgeDocumentsService } from './knowledge-documents.service';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [KnowledgeDocumentsController],
  providers: [KnowledgeDocumentsService],
  exports: [KnowledgeDocumentsService],
})
export class KnowledgeDocumentsModule {}
```

Modify `apps/server/src/app.module.ts`:

```ts
import { KnowledgeDocumentsModule } from './knowledge-documents/knowledge-documents.module';
```

Add it after `UploadsModule`:

```ts
    UploadsModule,
    KnowledgeDocumentsModule,
```

- [ ] **Step 5: Run service tests**

Run:

```powershell
bun --filter @repo/server test -- knowledge-documents.service.spec.ts
```

Expected: exit 0.

- [ ] **Step 6: Run server build**

Run:

```powershell
bun --filter @repo/server build
```

Expected: exit 0.

- [ ] **Step 7: Commit module**

Run:

```powershell
git add apps/server/src/app.module.ts apps/server/src/knowledge-documents
git commit -m "feat: add knowledge documents api"
```

---

## Task 4: Add Knowledge Documents E2E Coverage

**Files:**

- Create: `apps/server/test/knowledge-documents.e2e-spec.ts`

- [ ] **Step 1: Write e2e tests**

Create `apps/server/test/knowledge-documents.e2e-spec.ts`:

```ts
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

import { AppModule } from '../src/app.module';
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
```

- [ ] **Step 2: Run e2e with Docker dependencies**

Run:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --cwd packages/database prisma migrate deploy
bun --filter @repo/server test:e2e -- --runInBand knowledge-documents.e2e-spec.ts
```

Expected: e2e exits 0.

- [ ] **Step 3: Commit e2e tests**

Run:

```powershell
git add apps/server/test/knowledge-documents.e2e-spec.ts
git commit -m "test: cover knowledge document api"
```

---

## Task 5: Final Verification And Documentation Sync

**Files:**

- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Run full affected verification**

Run:

```powershell
bun packages/types/tests/knowledge.test.mts
bun --cwd packages/types typecheck
bun --filter @repo/server test -- storage.service.spec.ts knowledge-documents.service.spec.ts
bun --filter @repo/server build
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --cwd packages/database prisma migrate deploy
bun --filter @repo/server test:e2e -- --runInBand knowledge-documents.e2e-spec.ts
```

Expected:

- Contract tests pass.
- Typecheck passes.
- Server unit tests pass.
- Server build exits 0.
- Migrations show no pending migration.
- Knowledge documents e2e passes.

- [ ] **Step 2: Update docs to mark Phase 5.2 complete**

In `README.md`, add Phase 5.2 to current status as completed only after Step 1 passes:

```md
| Phase 5.2 | 文档上传与状态 API | 已完成 |
```

In `docs/data-flow.md`, update RAG boundary:

```md
- RAG 知识库职责：Phase 5.2 已完成资料上传、文档列表、详情和删除 API；上传文件保存到 MinIO，`Document(PENDING, sourceType=UPLOAD)` 以 PostgreSQL 为权威来源，解析、embedding、检索和 Chat 注入仍未接入。
```

In `docs/roadmap.md`, update Phase 5 split:

```md
- Phase 5.2：文档上传与状态 API。（已完成）
- Phase 5.3：解析、分块、embedding 入库。（下一步）
```

In `AGENTS.md` and `CLAUDE.md`, update current data flow:

```md
- RAG：Phase 5.2 已完成文档上传与状态 API，`Document` 记录以 PostgreSQL 为权威来源，原文件存储在 MinIO；解析、embedding、检索和 Chat RAG 注入仍在后续阶段。
```

In `DEVLOG.md`, under `2026-06-18`, append a `Phase 5.2 文档上传与状态 API` subsection:

```md
**Phase 5.2 文档上传与状态 API**

- 新增 KnowledgeDocuments API：上传、列表、详情和删除。
- 上传资料写入 MinIO，服务端创建 `Document(PENDING, sourceType=UPLOAD)`。
- 资料文件支持 PDF / DOCX / Markdown / TXT，并通过 `UPLOAD_DOCUMENT_MAX_BYTES` 控制大小。
- 所有文档 API 按当前 `userId` 隔离；删除文档会级联删除未来 chunks 并尽力删除 MinIO 对象。
- 本阶段仍不实现解析、embedding、检索 API、Chat RAG 注入和知识库页面。
```

Update DEVLOG bottom checklist:

```md
- [x] Phase 5.2：文档上传与状态 API。
- [ ] Phase 5.3：解析、分块、embedding 入库。
```

- [ ] **Step 3: Run docs checks**

Run:

```powershell
git diff --check
rg -n "Phase 5.2.*下一步|当前尚未实现资料上传|文档上传与状态 API。\\(下一步\\)" README.md AGENTS.md CLAUDE.md docs/data-flow.md docs/roadmap.md DEVLOG.md
```

Expected:

- `git diff --check` exits 0.
- `rg` returns no stale Phase 5.2-next wording except historical plan files.

- [ ] **Step 4: Commit docs**

Run:

```powershell
git add README.md AGENTS.md CLAUDE.md docs/data-flow.md docs/roadmap.md DEVLOG.md
git commit -m "docs: mark phase 5.2 knowledge upload complete"
```

- [ ] **Step 5: Final git check**

Run:

```powershell
git status --short --branch
git log --oneline -8
```

Expected:

- Worktree is clean.
- Recent commits include contracts, storage helpers, API, e2e tests, and docs.

## Self-Review Checklist

- Phase 5.2 only uploads and tracks document status; no parser, embedding, search, Chat RAG, or UI code is added.
- Every read/write path uses current `userId`.
- MinIO object keys are scoped under `users/{userId}/knowledge/`.
- Upload failure does not create a `Document`.
- Database create failure triggers best-effort object cleanup.
- Delete is idempotent with missing storage object, but not with missing database row.
- `@repo/types/api/knowledge` remains the shared contract source.
- All docs describe Phase 5.2 as backend API foundation, not a usable RAG search feature.
