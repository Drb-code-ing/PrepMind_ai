# Phase 5.4 Knowledge Search API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement authenticated `POST /knowledge/search` so processed user documents can be retrieved by pgvector cosine similarity.

**Architecture:** Keep Phase 5.4 backend-only. Add a focused `KnowledgeSearchService` for query embedding, vector literal validation, pgvector raw SQL, and response mapping. Add a separate `KnowledgeSearchController` under `@Controller('knowledge')` so the existing `KnowledgeDocumentsController` can keep its `knowledge/documents` base path unchanged.

**Tech Stack:** NestJS 11, Prisma, PostgreSQL + pgvector, Zod shared contracts, Jest, Supertest, Bun workspace.

---

## File Structure

- Create `apps/server/src/knowledge-documents/knowledge-search.service.ts`  
  Owns query embedding, vector validation, raw pgvector query, stable error wrapping, and `KnowledgeSearchResponse` mapping.
- Create `apps/server/src/knowledge-documents/knowledge-search.service.spec.ts`  
  Unit tests for vector validation, empty hits, row mapping, user/status filtering through SQL shape, and database error wrapping.
- Create `apps/server/src/knowledge-documents/knowledge-search.controller.ts`  
  Authenticated route for `POST /knowledge/search`.
- Modify `apps/server/src/knowledge-documents/knowledge-documents.module.ts`  
  Register the new controller and service.
- Modify `apps/server/test/knowledge-documents.e2e-spec.ts`  
  Add authenticated route coverage, current-user isolation, successful hit retrieval, and empty hits below `minScore`.
- Modify docs after implementation: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/data-flow.md`, `docs/roadmap.md`, `DEVLOG.md`.

---

### Task 1: Knowledge Search Service

**Files:**
- Create: `apps/server/src/knowledge-documents/knowledge-search.service.spec.ts`
- Create: `apps/server/src/knowledge-documents/knowledge-search.service.ts`

- [ ] **Step 1: Write the failing service tests**

Create `apps/server/src/knowledge-documents/knowledge-search.service.spec.ts`:

```ts
import { HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import type { PrismaService } from '../database/prisma.service';
import type { EmbeddingService } from './embedding.service';
import { KnowledgeSearchService } from './knowledge-search.service';

describe('KnowledgeSearchService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  };
  const embedding = {
    embedChunks: jest.fn(),
  };
  const config = {
    get: jest.fn((key: keyof ServerEnv) => {
      if (key === 'RAG_EMBEDDING_DIMENSIONS') return 3;
      return undefined;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    embedding.embedChunks.mockResolvedValue([[1, 0, 0]]);
    prisma.$queryRaw.mockResolvedValue([]);
  });

  it('embeds the query and maps pgvector rows to search hits', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        chunkId: 'chunk_1',
        documentId: 'doc_1',
        documentName: 'calculus.md',
        content: 'Green theorem converts a line integral into a double integral.',
        score: 0.91,
        metadata: { sectionTitle: 'Green theorem' },
      },
    ]);

    const result = await createService().search('user_1', {
      query: 'Green theorem',
      topK: 5,
      minScore: 0.7,
    });

    expect(embedding.embedChunks).toHaveBeenCalledWith(['Green theorem']);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      hits: [
        {
          chunkId: 'chunk_1',
          documentId: 'doc_1',
          documentName: 'calculus.md',
          content: 'Green theorem converts a line integral into a double integral.',
          score: 0.91,
          metadata: { sectionTitle: 'Green theorem' },
        },
      ],
    });
  });

  it('returns empty hits when pgvector returns no rows', async () => {
    const result = await createService().search('user_1', {
      query: 'not in notes',
      topK: 5,
      minScore: 0.7,
    });

    expect(result).toEqual({ hits: [] });
  });

  it('rejects an invalid query embedding before executing sql', async () => {
    embedding.embedChunks.mockResolvedValue([[1, 0]]);

    await expect(
      createService().search('user_1', {
        query: 'Green theorem',
        topK: 5,
        minScore: 0.7,
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects non-finite query embedding values before executing sql', async () => {
    embedding.embedChunks.mockResolvedValue([[1, Number.NaN, 0]]);

    await expect(
      createService().search('user_1', {
        query: 'Green theorem',
        topK: 5,
        minScore: 0.7,
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('wraps database failures as a stable search error', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));

    await expect(
      createService().search('user_1', {
        query: 'Green theorem',
        topK: 5,
        minScore: 0.7,
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_SEARCH_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });
  });

  it('does not wrap existing app errors from embedding', async () => {
    const failure = new AppError(
      'KNOWLEDGE_EMBEDDING_FAILED',
      'Embedding provider failed',
      HttpStatus.BAD_GATEWAY,
    );
    embedding.embedChunks.mockRejectedValue(failure);

    await expect(
      createService().search('user_1', {
        query: 'Green theorem',
        topK: 5,
        minScore: 0.7,
      }),
    ).rejects.toBe(failure);
  });

  function createService() {
    return new KnowledgeSearchService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService<ServerEnv, true>,
      embedding as unknown as EmbeddingService,
    );
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
bun --filter @repo/server test -- knowledge-search.service.spec.ts
```

Expected: FAIL because `./knowledge-search.service` does not exist.

- [ ] **Step 3: Implement `KnowledgeSearchService`**

Create `apps/server/src/knowledge-documents/knowledge-search.service.ts`:

```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  KnowledgeSearchRequest,
  KnowledgeSearchResponse,
} from '@repo/types/api/knowledge';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { EmbeddingService } from './embedding.service';

type KnowledgeSearchRow = {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number | string;
  metadata: unknown;
};

@Injectable()
export class KnowledgeSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<ServerEnv, true>,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async search(
    userId: string,
    input: KnowledgeSearchRequest,
  ): Promise<KnowledgeSearchResponse> {
    const [queryEmbedding] = await this.embeddingService.embedChunks([
      input.query,
    ]);
    const embeddingDimensions = this.configService.get(
      'RAG_EMBEDDING_DIMENSIONS',
      { infer: true },
    );
    const queryVector = this.toPgVectorLiteral(
      queryEmbedding ?? [],
      embeddingDimensions,
    );

    try {
      const rows = await this.prisma.$queryRaw<KnowledgeSearchRow[]>`
        SELECT
          c.id AS "chunkId",
          c."documentId" AS "documentId",
          d.name AS "documentName",
          c.content AS content,
          c.metadata AS metadata,
          (1 - (c.embedding <=> ${queryVector}::vector))::float AS score
        FROM "Chunk" c
        JOIN "Document" d ON d.id = c."documentId"
        WHERE
          c."userId" = ${userId}
          AND d."userId" = ${userId}
          AND d.status = 'DONE'
          AND c.embedding IS NOT NULL
          AND (1 - (c.embedding <=> ${queryVector}::vector)) >= ${input.minScore}
        ORDER BY c.embedding <=> ${queryVector}::vector ASC
        LIMIT ${input.topK}
      `;

      return {
        hits: rows.map((row) => ({
          chunkId: row.chunkId,
          documentId: row.documentId,
          documentName: row.documentName,
          content: row.content,
          score: Number(row.score),
          metadata: this.toMetadataRecord(row.metadata),
        })),
      };
    } catch (error) {
      throw this.createSearchError(error);
    }
  }

  private toPgVectorLiteral(vector: number[], embeddingDimensions: number) {
    if (vector.length !== embeddingDimensions) {
      throw new AppError(
        'KNOWLEDGE_EMBEDDING_FAILED',
        `Expected embedding dimension ${embeddingDimensions} but received ${vector.length}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const values = vector.map((value, index) => {
      if (!Number.isFinite(value)) {
        throw new AppError(
          'KNOWLEDGE_EMBEDDING_FAILED',
          `Embedding vector contains a non-finite value at index ${index}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      return String(value);
    });

    return `[${values.join(',')}]`;
  }

  private toMetadataRecord(metadata: unknown): Record<string, unknown> {
    if (typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata)) {
      return metadata as Record<string, unknown>;
    }

    return {};
  }

  private createSearchError(cause: unknown) {
    if (cause instanceof AppError) {
      return cause;
    }

    const error = new AppError(
      'KNOWLEDGE_SEARCH_FAILED',
      'Knowledge search failed',
      HttpStatus.BAD_GATEWAY,
    );
    (error as AppError & { cause?: unknown }).cause = cause;
    return error;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
bun --filter @repo/server test -- knowledge-search.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/knowledge-documents/knowledge-search.service.ts apps/server/src/knowledge-documents/knowledge-search.service.spec.ts
git commit -m "feat: add knowledge search service"
```

---

### Task 2: Knowledge Search API Route

**Files:**
- Create: `apps/server/src/knowledge-documents/knowledge-search.controller.ts`
- Modify: `apps/server/src/knowledge-documents/knowledge-documents.module.ts`
- Test: `apps/server/test/knowledge-documents.e2e-spec.ts`

- [ ] **Step 1: Write failing e2e tests**

Modify imports in `apps/server/test/knowledge-documents.e2e-spec.ts`:

```ts
import {
  knowledgeDocumentDeleteResponseSchema,
  knowledgeDocumentListResponseSchema,
  knowledgeDocumentProcessResponseSchema,
  knowledgeDocumentUploadResponseSchema,
  knowledgeSearchResponseSchema,
} from '@repo/types/api/knowledge';
```

Replace the top-level fake embedding with deterministic vectors:

```ts
const embedBatch = jest.fn(async (texts: string[]) =>
  texts.map(createFakeEmbedding),
);
```

Add these tests before `registerUser`:

```ts
  it('requires authentication for knowledge search', async () => {
    await request(server)
      .post('/knowledge/search')
      .send({ query: 'Green theorem' })
      .expect(401);
  });

  it('searches processed chunks for the current user only', async () => {
    const userA = await registerUser('knowledge-search-a');
    const userB = await registerUser('knowledge-search-b');
    const userADocument = await uploadAndProcessTextDocument(
      userA.accessToken,
      'green-a.txt',
      'Green theorem converts line integrals into double integrals.',
    );
    const userBDocument = await uploadAndProcessTextDocument(
      userB.accessToken,
      'green-b.txt',
      'Green theorem secret note from another user.',
    );

    const response = await request(server)
      .post('/knowledge/search')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ query: 'Green theorem', topK: 5, minScore: 0.5 })
      .expect(201);
    const result = knowledgeSearchResponseSchema.parse(
      getSuccessData(response),
    );

    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits.some((hit) => hit.documentId === userADocument.id)).toBe(true);
    expect(result.hits.some((hit) => hit.documentId === userBDocument.id)).toBe(false);
    expect(result.hits[0]?.score).toBeGreaterThanOrEqual(0.5);
  });

  it('returns empty hits when all results are below minScore', async () => {
    const user = await registerUser('knowledge-search-empty');
    await uploadAndProcessTextDocument(
      user.accessToken,
      'green-empty.txt',
      'Green theorem converts line integrals into double integrals.',
    );

    const response = await request(server)
      .post('/knowledge/search')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ query: 'unrelated biology notes', topK: 5, minScore: 0.5 })
      .expect(201);
    const result = knowledgeSearchResponseSchema.parse(
      getSuccessData(response),
    );

    expect(result).toEqual({ hits: [] });
  });
```

Add helper functions inside the `describe` block before `registerUser`:

```ts
  async function uploadAndProcessTextDocument(
    accessToken: string,
    filename: string,
    content: string,
  ) {
    const uploadResponse = await request(server)
      .post('/knowledge/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from(content), {
        filename,
        contentType: 'text/plain',
      })
      .expect(201);
    const uploaded = knowledgeDocumentUploadResponseSchema.parse(
      getSuccessData(uploadResponse),
    );

    const processResponse = await request(server)
      .post(`/knowledge/documents/${uploaded.id}/process`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);
    return knowledgeDocumentProcessResponseSchema.parse(
      getSuccessData(processResponse),
    );
  }
```

Add `createFakeEmbedding` outside the `describe` block:

```ts
function createFakeEmbedding(text: string): number[] {
  const vector = Array(1536).fill(0);
  if (/green theorem|line integral/i.test(text)) {
    vector[0] = 1;
    return vector;
  }

  vector[1] = 1;
  return vector;
}
```

- [ ] **Step 2: Run e2e tests to verify they fail**

Run:

```powershell
bun --filter @repo/server test:e2e -- --runInBand knowledge-documents.e2e-spec.ts
```

Expected: FAIL with 404 for `POST /knowledge/search`.

- [ ] **Step 3: Implement controller and module wiring**

Create `apps/server/src/knowledge-documents/knowledge-search.controller.ts`:

```ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { knowledgeSearchRequestSchema } from '@repo/types/api/knowledge';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { KnowledgeSearchService } from './knowledge-search.service';

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeSearchController {
  constructor(private readonly knowledgeSearchService: KnowledgeSearchService) {}

  @Post('search')
  search(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = knowledgeSearchRequestSchema.parse(body ?? {});
    return this.knowledgeSearchService.search(user.id, input);
  }
}
```

Modify `apps/server/src/knowledge-documents/knowledge-documents.module.ts`:

```ts
import { KnowledgeSearchController } from './knowledge-search.controller';
import { KnowledgeSearchService } from './knowledge-search.service';
```

Then update the module metadata:

```ts
  controllers: [KnowledgeDocumentsController, KnowledgeSearchController],
  providers: [
    KnowledgeDocumentsService,
    KnowledgeSearchService,
    DocumentProcessingService,
    DocumentParserService,
    EmbeddingService,
    ChunkPersistenceService,
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: (): ServerEmbeddingProvider | undefined => undefined,
    },
  ],
  exports: [
    KnowledgeDocumentsService,
    KnowledgeSearchService,
    DocumentProcessingService,
  ],
```

- [ ] **Step 4: Run tests to verify route passes**

Run:

```powershell
bun --filter @repo/server test -- knowledge-search.service.spec.ts
bun --filter @repo/server test:e2e -- --runInBand knowledge-documents.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/knowledge-documents apps/server/test/knowledge-documents.e2e-spec.ts
git commit -m "feat: expose knowledge search api"
```

---

### Task 3: Documentation And Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Update current phase documentation**

Apply these wording changes consistently:

```md
Phase 5.4 已完成：`POST /knowledge/search` 检索 API，基于 query embedding 和 pgvector cosine search 返回当前用户 DONE 文档下的相关 chunks。
```

Update data-flow RAG boundary:

```md
RAG 当前已支持文档上传、处理入库和后端检索 API；Chat RAG 注入、citations 和 `/knowledge` 前端页面仍在后续阶段。无资料、无命中或检索失败时，后续 Chat 接入必须降级为普通 AI 回答。
```

Update next step:

```md
Phase 5.5：Chat RAG 增强与引用展示。
```

- [ ] **Step 2: Run full relevant verification**

Run:

```powershell
bun packages/types/tests/knowledge.test.mts
bun --filter @repo/server test -- knowledge-search.service.spec.ts knowledge-documents/embedding.service.spec.ts knowledge-documents/document-processing.service.spec.ts
bun --filter @repo/server test:e2e -- --runInBand knowledge-documents.e2e-spec.ts
bun --filter @repo/server build
bun --filter @repo/server lint
git diff --check
```

Expected:

- Types knowledge contract passes.
- Service and processing tests pass.
- Knowledge e2e passes.
- Server build exits 0.
- Server lint exits 0.
- `git diff --check` exits 0.

- [ ] **Step 3: Commit docs**

```powershell
git add AGENTS.md CLAUDE.md README.md docs/data-flow.md docs/roadmap.md DEVLOG.md
git commit -m "docs: mark phase 5.4 knowledge search complete"
```

---

## Self-Review Checklist

- [ ] Spec coverage: API route, auth, current-user isolation, DONE-only retrieval, minScore/topK, empty hits, stable errors, and no Chat integration are covered.
- [ ] Placeholder scan: no incomplete placeholder tasks remain.
- [ ] Type consistency: all snippets use `KnowledgeSearchRequest`, `KnowledgeSearchResponse`, `KnowledgeSearchService`, and `KnowledgeSearchController` consistently.
- [ ] Verification coverage: unit, e2e, build, lint, and whitespace checks are included.
