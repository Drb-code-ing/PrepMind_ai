# Phase 5.1 RAG Data Model And Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing RAG database placeholder into a stable Phase 5.1 foundation by adding knowledge metadata fields, pgvector indexes, and shared Zod API contracts.

**Architecture:** Reuse the existing Prisma `Document` / `Chunk` models instead of introducing parallel tables. This phase only defines storage shape and shared API contracts; upload, parsing, embedding, search, Chat RAG injection, and `/knowledge` UI stay out of scope for later Phase 5 slices.

**Tech Stack:** Bun workspace, Prisma, PostgreSQL + pgvector, TypeScript, Zod, `@repo/types`, existing `@repo/database` package.

---

## Scope

Phase 5.1 ships the foundation for later RAG work:

1. Extend the current `Document` model with source, error, hash, and processing metadata.
2. Extend the current `Chunk` model with token count.
3. Add database indexes needed by document lists and future vector search.
4. Add shared `@repo/types` schemas for knowledge documents and search contracts.
5. Add contract tests so backend and frontend can build later phases against stable shapes.

Out of scope:

- File upload endpoints.
- MinIO object write/delete behavior.
- Text extraction and PDF parsing.
- Chunking implementation.
- Embedding provider implementation.
- `POST /knowledge/search` backend implementation.
- Chat prompt injection and citations rendering.
- `/knowledge` frontend page.

## File Structure

Create:

- `packages/database/prisma/migrations/<timestamp>_extend_rag_documents/migration.sql`  
  Adds `sourceType`, `errorMessage`, `contentHash`, `processedAt`, `tokenCount`, document list index, and vector index.
- `packages/types/src/api/knowledge.ts`  
  Shared Zod schemas and TypeScript types for Phase 5 knowledge APIs.
- `packages/types/tests/knowledge.test.mts`  
  Contract tests for knowledge document schemas, upload response, list query, search request, and search response.

Modify:

- `packages/database/prisma/schema.prisma`  
  Extend existing `Document` / `Chunk`; add `DocumentSourceType`; add indexes.
- `packages/types/package.json`  
  Export `./api/knowledge`.
- `packages/types/src/api/index.ts`  
  Export knowledge API contracts.

Do not modify:

- `apps/server/src/**`  
  No server routes in Phase 5.1.
- `apps/web/src/**`  
  No UI or API client in Phase 5.1.
- `packages/rag/src/retriever.ts`  
  Keep placeholder until Phase 5.4 search implementation.

---

### Task 1: Add Knowledge API Contracts First

**Files:**

- Create: `packages/types/src/api/knowledge.ts`
- Create: `packages/types/tests/knowledge.test.mts`
- Modify: `packages/types/src/api/index.ts`
- Modify: `packages/types/package.json`

- [ ] **Step 1: Create failing contract tests**

Create `packages/types/tests/knowledge.test.mts`:

```ts
import assert from 'node:assert/strict';

import {
  knowledgeDocumentListQuerySchema,
  knowledgeDocumentResponseSchema,
  knowledgeDocumentSourceTypeSchema,
  knowledgeDocumentStatusSchema,
  knowledgeDocumentTypeSchema,
  knowledgeSearchRequestSchema,
  knowledgeSearchResponseSchema,
} from '../src/api/knowledge.ts';

function run() {
  testEnums();
  testDocumentResponse();
  testListQuery();
  testSearchRequest();
  testSearchResponse();
}

function testEnums() {
  assert.equal(knowledgeDocumentTypeSchema.parse('PDF'), 'PDF');
  assert.equal(knowledgeDocumentStatusSchema.parse('DONE'), 'DONE');
  assert.equal(knowledgeDocumentSourceTypeSchema.parse('UPLOAD'), 'UPLOAD');

  assert.throws(() => knowledgeDocumentTypeSchema.parse('HTML'));
  assert.throws(() => knowledgeDocumentStatusSchema.parse('READY'));
  assert.throws(() => knowledgeDocumentSourceTypeSchema.parse('WEB'));
}

function testDocumentResponse() {
  const result = knowledgeDocumentResponseSchema.parse(createDocumentPayload());

  assert.equal(result.id, 'doc_1');
  assert.equal(result.sourceType, 'UPLOAD');
  assert.equal(result.errorMessage, null);
  assert.equal(result.chunkCount, 3);
}

function testListQuery() {
  const defaultQuery = knowledgeDocumentListQuerySchema.parse({});
  assert.equal(defaultQuery.limit, 20);
  assert.equal(defaultQuery.status, undefined);

  const explicitQuery = knowledgeDocumentListQuerySchema.parse({
    status: 'FAILED',
    sourceType: 'UPLOAD',
    limit: '10',
    cursor: 'doc_1',
  });

  assert.equal(explicitQuery.status, 'FAILED');
  assert.equal(explicitQuery.sourceType, 'UPLOAD');
  assert.equal(explicitQuery.limit, 10);
  assert.equal(explicitQuery.cursor, 'doc_1');

  assert.throws(() => knowledgeDocumentListQuerySchema.parse({ limit: '0' }));
  assert.throws(() => knowledgeDocumentListQuerySchema.parse({ limit: '101' }));
  assert.throws(() => knowledgeDocumentListQuerySchema.parse({ status: 'READY' }));
}

function testSearchRequest() {
  const result = knowledgeSearchRequestSchema.parse({
    query: '格林公式怎么用？',
    topK: '8',
    minScore: '0.72',
  });

  assert.equal(result.query, '格林公式怎么用？');
  assert.equal(result.topK, 8);
  assert.equal(result.minScore, 0.72);

  const defaults = knowledgeSearchRequestSchema.parse({ query: '线性代数' });
  assert.equal(defaults.topK, 5);
  assert.equal(defaults.minScore, 0.7);

  assert.throws(() => knowledgeSearchRequestSchema.parse({ query: '' }));
  assert.throws(() => knowledgeSearchRequestSchema.parse({ query: 'x', topK: '0' }));
  assert.throws(() => knowledgeSearchRequestSchema.parse({ query: 'x', topK: '21' }));
  assert.throws(() => knowledgeSearchRequestSchema.parse({ query: 'x', minScore: '1.1' }));
}

function testSearchResponse() {
  const result = knowledgeSearchResponseSchema.parse({
    hits: [
      {
        chunkId: 'chunk_1',
        documentId: 'doc_1',
        documentName: '高等数学笔记.pdf',
        content: '格林公式用于将闭曲线积分转化为二重积分。',
        score: 0.86,
        metadata: { page: 3, sourceName: '高等数学笔记.pdf' },
      },
    ],
  });

  assert.equal(result.hits[0]?.documentName, '高等数学笔记.pdf');
  assert.equal(result.hits[0]?.score, 0.86);

  const empty = knowledgeSearchResponseSchema.parse({ hits: [] });
  assert.equal(empty.hits.length, 0);

  assert.throws(() =>
    knowledgeSearchResponseSchema.parse({
      hits: [{ chunkId: 'chunk_1', score: 1.2 }],
    }),
  );
}

function createDocumentPayload(input: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'doc_1',
    name: '高等数学笔记.pdf',
    type: 'PDF',
    size: 2048,
    mimeType: 'application/pdf',
    status: 'DONE',
    sourceType: 'UPLOAD',
    errorMessage: null,
    contentHash: 'sha256:abc',
    chunkCount: 3,
    processedAt: '2026-06-17T08:00:00.000Z',
    createdAt: '2026-06-17T07:59:00.000Z',
    updatedAt: '2026-06-17T08:00:00.000Z',
    ...input,
  };
}

run();
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
bun packages/types/tests/knowledge.test.mts
```

Expected: fail because `packages/types/src/api/knowledge.ts` does not exist.

- [ ] **Step 3: Create the knowledge contract file**

Create `packages/types/src/api/knowledge.ts`:

```ts
import { z } from 'zod';

const numericQuerySchema = (defaultValue: number, min: number, max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    if (typeof value === 'string') {
      return Number(value);
    }
    return value;
  }, z.number().int().min(min).max(max).default(defaultValue));

const floatQuerySchema = (defaultValue: number, min: number, max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    if (typeof value === 'string') {
      return Number(value);
    }
    return value;
  }, z.number().min(min).max(max).default(defaultValue));

export const knowledgeDocumentTypeSchema = z.enum(['PDF', 'DOCX', 'MD', 'TXT']);
export const knowledgeDocumentStatusSchema = z.enum(['PENDING', 'PROCESSING', 'DONE', 'FAILED']);
export const knowledgeDocumentSourceTypeSchema = z.enum([
  'UPLOAD',
  'NOTE',
  'WRONG_QUESTION',
  'OCR',
  'CHAT',
]);

export const knowledgeDocumentResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: knowledgeDocumentTypeSchema,
  size: z.number().int().nonnegative(),
  mimeType: z.string(),
  status: knowledgeDocumentStatusSchema,
  sourceType: knowledgeDocumentSourceTypeSchema,
  errorMessage: z.string().nullable(),
  contentHash: z.string().nullable(),
  chunkCount: z.number().int().nonnegative(),
  processedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const knowledgeDocumentListQuerySchema = z
  .object({
    status: knowledgeDocumentStatusSchema.optional(),
    sourceType: knowledgeDocumentSourceTypeSchema.optional(),
    limit: numericQuerySchema(20, 1, 100),
    cursor: z.string().optional(),
  })
  .strict();

export const knowledgeDocumentListResponseSchema = z.object({
  items: z.array(knowledgeDocumentResponseSchema),
  nextCursor: z.string().nullable(),
});

export const knowledgeSearchRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(2000),
    topK: numericQuerySchema(5, 1, 20),
    minScore: floatQuerySchema(0.7, 0, 1),
  })
  .strict();

export const knowledgeSearchHitSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  documentName: z.string(),
  content: z.string(),
  score: z.number().min(0).max(1),
  metadata: z.record(z.unknown()),
});

export const knowledgeSearchResponseSchema = z.object({
  hits: z.array(knowledgeSearchHitSchema),
});

export type KnowledgeDocumentType = z.infer<typeof knowledgeDocumentTypeSchema>;
export type KnowledgeDocumentStatus = z.infer<typeof knowledgeDocumentStatusSchema>;
export type KnowledgeDocumentSourceType = z.infer<typeof knowledgeDocumentSourceTypeSchema>;
export type KnowledgeDocumentResponse = z.infer<typeof knowledgeDocumentResponseSchema>;
export type KnowledgeDocumentListQuery = z.infer<typeof knowledgeDocumentListQuerySchema>;
export type KnowledgeDocumentListResponse = z.infer<typeof knowledgeDocumentListResponseSchema>;
export type KnowledgeSearchRequest = z.infer<typeof knowledgeSearchRequestSchema>;
export type KnowledgeSearchHit = z.infer<typeof knowledgeSearchHitSchema>;
export type KnowledgeSearchResponse = z.infer<typeof knowledgeSearchResponseSchema>;
```

- [ ] **Step 4: Export the contract**

Add to `packages/types/src/api/index.ts`:

```ts
export * from './knowledge';
```

Add to `packages/types/package.json` `exports`:

```json
"./api/knowledge": "./src/api/knowledge.ts",
```

- [ ] **Step 5: Run contract test**

Run:

```powershell
bun packages/types/tests/knowledge.test.mts
```

Expected: pass with no output.

- [ ] **Step 6: Run typecheck**

Run:

```powershell
bun --cwd packages/types typecheck
```

Expected: exit code 0.

- [ ] **Step 7: Commit contracts**

Run:

```powershell
git add packages/types/src/api/knowledge.ts packages/types/src/api/index.ts packages/types/package.json packages/types/tests/knowledge.test.mts
git commit -m "feat: add knowledge api contracts"
```

---

### Task 2: Extend Prisma RAG Models

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_extend_rag_documents/migration.sql`

- [ ] **Step 1: Update Prisma schema**

In `packages/database/prisma/schema.prisma`, update the RAG section to include the new enum and fields:

```prisma
// ---------- RAG 知识库 ----------
model Document {
  id           String             @id @default(cuid())
  name         String
  type         DocumentType
  size         Int
  mimeType     String
  storageKey   String
  status       ProcessStatus      @default(PENDING)
  sourceType   DocumentSourceType @default(UPLOAD)
  errorMessage String?            @db.Text
  contentHash  String?
  processedAt  DateTime?
  userId       String
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  chunks Chunk[]

  @@index([userId, status, updatedAt])
  @@index([userId, sourceType, updatedAt])
  @@index([contentHash])
}

enum DocumentType {
  PDF
  DOCX
  MD
  TXT
}

enum DocumentSourceType {
  UPLOAD
  NOTE
  WRONG_QUESTION
  OCR
  CHAT
}

enum ProcessStatus {
  PENDING
  PROCESSING
  DONE
  FAILED
}

model Chunk {
  id         String                 @id @default(cuid())
  documentId String
  content    String                 @db.Text
  embedding  Unsupported("vector")?
  metadata   Json
  index      Int
  tokenCount Int?
  userId     String
  createdAt  DateTime               @default(now())

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@index([userId])
}
```

- [ ] **Step 2: Create migration with Prisma**

Run:

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --cwd packages/database prisma migrate dev --name extend_rag_documents
```

Expected:

- A new migration directory appears under `packages/database/prisma/migrations`.
- Prisma reports migration applied.

- [ ] **Step 3: Verify migration SQL contains safe additions**

Open the generated `migration.sql`. It should contain statements equivalent to:

```sql
CREATE TYPE "DocumentSourceType" AS ENUM ('UPLOAD', 'NOTE', 'WRONG_QUESTION', 'OCR', 'CHAT');

ALTER TABLE "Document"
ADD COLUMN "sourceType" "DocumentSourceType" NOT NULL DEFAULT 'UPLOAD',
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "contentHash" TEXT,
ADD COLUMN "processedAt" TIMESTAMP(3);

ALTER TABLE "Chunk"
ADD COLUMN "tokenCount" INTEGER;

CREATE INDEX "Document_userId_status_updatedAt_idx" ON "Document"("userId", "status", "updatedAt");
CREATE INDEX "Document_userId_sourceType_updatedAt_idx" ON "Document"("userId", "sourceType", "updatedAt");
CREATE INDEX "Document_contentHash_idx" ON "Document"("contentHash");
```

If Prisma generates equivalent names, keep Prisma output. Do not hand-edit index names unless PostgreSQL reports a conflict.

- [ ] **Step 4: Add vector index to migration**

Append this statement to the same migration after column additions:

```sql
CREATE INDEX IF NOT EXISTS "Chunk_embedding_vector_cosine_idx"
ON "Chunk"
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100);
```

Keep the existing `CREATE EXTENSION IF NOT EXISTS vector;` from the Phase 2 baseline migration. Do not duplicate it unless local migration replay fails without it; if needed, add:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

at the top of this migration.

- [ ] **Step 5: Generate Prisma Client**

Run:

```powershell
bun --cwd packages/database prisma:generate
```

Expected: Prisma Client generated and `repair-prisma-client.mjs` completes.

- [ ] **Step 6: Run database package typecheck**

Run:

```powershell
bun --cwd packages/database test
```

Expected: exit code 0.

- [ ] **Step 7: Commit Prisma model and migration**

Run:

```powershell
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat: extend rag document schema"
```

---

### Task 3: Add Contract Coverage For List Responses And Failed Documents

**Files:**

- Modify: `packages/types/tests/knowledge.test.mts`

- [ ] **Step 1: Add tests for failed documents and list response**

Add two functions:

```ts
function testFailedDocumentResponse() {
  const result = knowledgeDocumentResponseSchema.parse(
    createDocumentPayload({
      status: 'FAILED',
      errorMessage: 'Embedding provider rejected the input.',
      processedAt: null,
      chunkCount: 0,
    }),
  );

  assert.equal(result.status, 'FAILED');
  assert.equal(result.errorMessage, 'Embedding provider rejected the input.');
  assert.equal(result.processedAt, null);
}

function testListResponse() {
  const result = knowledgeDocumentListResponseSchema.parse({
    items: [createDocumentPayload()],
    nextCursor: 'doc_2',
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.nextCursor, 'doc_2');

  const empty = knowledgeDocumentListResponseSchema.parse({
    items: [],
    nextCursor: null,
  });
  assert.equal(empty.nextCursor, null);
}
```

Update imports:

```ts
knowledgeDocumentListResponseSchema,
```

Update `run()`:

```ts
function run() {
  testEnums();
  testDocumentResponse();
  testFailedDocumentResponse();
  testListQuery();
  testListResponse();
  testSearchRequest();
  testSearchResponse();
}
```

- [ ] **Step 2: Run tests**

Run:

```powershell
bun packages/types/tests/knowledge.test.mts
```

Expected: pass with no output.

- [ ] **Step 3: Run all existing package type checks affected by contracts**

Run:

```powershell
bun --cwd packages/types typecheck
bun --cwd packages/database test
```

Expected: both commands exit 0.

- [ ] **Step 4: Commit test coverage**

Run:

```powershell
git add packages/types/tests/knowledge.test.mts
git commit -m "test: cover knowledge contract edge cases"
```

---

### Task 4: Verify Migration Replay On Dev Database

**Files:**

- No source edits expected.

- [ ] **Step 1: Ensure Docker dependencies are running**

Run:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
```

Expected: postgres, redis, and minio containers are running.

- [ ] **Step 2: Apply migrations from the package command path**

Run:

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --cwd packages/database prisma migrate deploy
```

Expected:

```text
No pending migrations to apply.
```

or successful application of the new Phase 5.1 migration.

- [ ] **Step 3: Confirm Prisma sees the new fields**

Run:

```powershell
bun --cwd packages/database prisma:generate
bun --filter @repo/server build
```

Expected:

- Prisma Client generation succeeds.
- Server build exits 0.

- [ ] **Step 4: Confirm no uncommitted migration drift**

Run:

```powershell
git status --short
```

Expected: no modified files. If Prisma changed generated files inside ignored `node_modules`, Git status should still be clean.

---

### Task 5: Sync Planning Docs After Phase 5.1 Lands

**Files:**

- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Update data flow**

In `docs/data-flow.md`, add a concise Phase 5.1 note near the current data-flow list:

```md
- RAG 知识库已完成 Phase 5.1 数据模型与 contract 基础：`Document` / `Chunk` 继续以 PostgreSQL + pgvector 为权威来源，当前只定义资料状态、来源、分块和检索响应边界，尚未接入上传、解析、embedding 和 Chat RAG 注入。
```

- [ ] **Step 2: Update roadmap**

In `docs/roadmap.md`, change Phase 5 status from planning to in progress and add:

```md
Phase 5.1 已完成 RAG 数据模型和共享 contract 基础：

- `Document` / `Chunk` 补齐资料来源、处理错误、hash、处理时间和 tokenCount。
- `@repo/types` 新增 knowledge API schema。
- pgvector 检索索引进入迁移预留。

下一步 Phase 5.2：文档上传与状态 API。
```

- [ ] **Step 3: Update AGENTS and CLAUDE**

In both files, update the snapshot from:

```md
当前 Phase 4.5.2 已完成，下一步进入 Phase 5。
```

to:

```md
当前 Phase 5.1 已完成，Phase 5 继续推进。
```

Add or update the Phase table line:

```md
| Phase 5.1 | 已完成 | RAG 知识库数据模型、pgvector 索引预留、knowledge API contract |
```

- [ ] **Step 4: Update README**

In `README.md`, update the current progress sentence to mention:

```md
Phase 5 已进入 RAG 知识库建设，当前完成数据模型与共享 API contract 基础。
```

- [ ] **Step 5: Commit docs**

Run:

```powershell
git add docs/data-flow.md docs/roadmap.md AGENTS.md CLAUDE.md README.md
git commit -m "docs: mark phase 5.1 rag foundation complete"
```

---

### Task 6: Final Verification

**Files:**

- No source edits expected.

- [ ] **Step 1: Run type and package checks**

Run:

```powershell
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --filter @repo/server build
```

Expected: all exit 0.

- [ ] **Step 2: Run direct contract test**

Run:

```powershell
bun packages/types/tests/knowledge.test.mts
```

Expected: pass with no output.

- [ ] **Step 3: Verify migration deploy**

Run:

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --cwd packages/database prisma migrate deploy
```

Expected: no pending migrations after the new migration has been applied.

- [ ] **Step 4: Check Git state**

Run:

```powershell
git status --short --branch
git log --oneline -5
```

Expected:

- Working tree clean.
- Recent commits include knowledge contracts, RAG schema, tests, and docs.

## Implementation Notes

- Keep `ProcessStatus` values as `PENDING / PROCESSING / DONE / FAILED` to match the existing Prisma enum. Do not rename `DONE` to `READY` in Phase 5.1; use `DONE` in contracts too.
- Keep database model names as `Document` and `Chunk` in Phase 5.1 to avoid a destructive rename. Use user-facing names like “KnowledgeDocument” only in docs and API schema names.
- Do not introduce server routes until Phase 5.2. Contracts can define response shapes before controllers exist.
- Do not add `apps/web` code in Phase 5.1. Frontend integration begins when upload/list APIs exist.
- If vector index creation fails because existing rows have null embeddings, keep the index as written; PostgreSQL ivfflat supports nulls by ignoring them for vector search.

