# Phase 5.3 Document Processing And Embedding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn uploaded knowledge documents from `PENDING` records into parsed, chunked, embedded `Chunk` rows that are ready for Phase 5.4 search.

**Architecture:** Keep `packages/rag` pure for chunking and embedding shape validation. Add a NestJS processing layer that reads MinIO objects, parses document text, batches embeddings, writes pgvector rows through raw SQL, and moves `Document` through `PENDING -> PROCESSING -> DONE / FAILED`; do not add search, Chat RAG injection, citations, or frontend pages in this phase.

**Tech Stack:** Bun workspace, NestJS 11, Prisma, PostgreSQL + pgvector, MinIO, Zod, Jest, Supertest, `mammoth`, `pdf-parse`, OpenAI embeddings.

---

## Scope

Phase 5.3 ships:

1. Shared process request contract and RAG processing env config.
2. `packages/rag` paragraph-aware chunker and embedding vector helpers.
3. MinIO knowledge document read helper with knowledge-specific errors.
4. Server document parser for TXT / Markdown / DOCX / PDF basic text.
5. Server embedding provider abstraction with OpenAI default and fake-provider tests.
6. Raw SQL chunk persistence for `vector(1536)`.
7. Authenticated `POST /knowledge/documents/:id/process`.
8. Unit and e2e coverage for success, failure, retry, force reprocess, and user isolation.
9. Documentation sync after verification.

Out of scope:

- `POST /knowledge/search`.
- Chat prompt injection and citations.
- `/knowledge` frontend page.
- Offline upload queue.
- BullMQ worker wiring.
- High-fidelity PDF layout, table reconstruction, image OCR, formula recognition.

## File Structure

Create:

- `packages/rag/tests/chunker.test.ts`
  Unit tests for paragraph-aware splitting, overlap, metadata, token count, and vector validation.
- `apps/server/src/knowledge-documents/document-parser.service.ts`
  Parses uploaded TXT / Markdown / DOCX / PDF into cleaned text plus weak metadata.
- `apps/server/src/knowledge-documents/document-parser.service.spec.ts`
  Parser tests with in-memory buffers and mocked DOCX / PDF extraction.
- `apps/server/src/knowledge-documents/embedding.service.ts`
  Defines embedding provider interface, OpenAI provider, batch validation, and server-facing service.
- `apps/server/src/knowledge-documents/embedding.service.spec.ts`
  Unit tests for batching, missing key, dimension mismatch, and provider failure.
- `apps/server/src/knowledge-documents/chunk-persistence.service.ts`
  Owns raw SQL vector inserts and chunk replacement transactions.
- `apps/server/src/knowledge-documents/chunk-persistence.service.spec.ts`
  Unit tests for vector formatting, max chunk guard, delete-before-insert, and user-scoped writes.
- `apps/server/src/knowledge-documents/document-processing.service.ts`
  Orchestrates status claim, storage read, parse, chunk, embed, persist, and failure state.
- `apps/server/src/knowledge-documents/document-processing.service.spec.ts`
  Unit tests for status transitions, conflicts, force reprocess, empty text, and cross-user isolation.

Modify:

- `packages/types/src/api/knowledge.ts`
  Add process request schema and response alias.
- `packages/types/tests/knowledge.test.mts`
  Add process request contract coverage.
- `packages/rag/package.json`
  Add a package test script.
- `packages/rag/src/chunker.ts`
  Replace the current stub with pure chunking utilities.
- `packages/rag/src/embedder.ts`
  Replace the current stub with provider types and vector validation helpers.
- `packages/rag/src/index.ts`
  Export new chunking and embedding helpers.
- `apps/server/package.json`
  Add parser and embedding dependencies.
- `apps/server/src/config/env.ts`
  Add RAG embedding and chunking config.
- `apps/server/src/uploads/storage.service.ts`
  Add `readKnowledgeDocumentObject()` without changing image read behavior.
- `apps/server/src/uploads/storage.service.spec.ts`
  Add knowledge read tests.
- `apps/server/src/knowledge-documents/knowledge-documents.controller.ts`
  Add process endpoint.
- `apps/server/src/knowledge-documents/knowledge-documents.module.ts`
  Register new processing services.
- `apps/server/test/knowledge-documents.e2e-spec.ts`
  Add upload -> process -> DONE coverage and failure coverage.
- `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/data-flow.md`, `docs/roadmap.md`, `DEVLOG.md`
  Update only after implementation and verification pass.

Do not modify:

- `apps/web/src/**`
- Chat route or prompt files.
- `packages/rag/src/retriever.ts`
- `packages/rag/src/reranker.ts`

---

### Task 1: Extend Contracts, Config, And Dependencies

**Files:**

- Modify: `packages/types/src/api/knowledge.ts`
- Modify: `packages/types/tests/knowledge.test.mts`
- Modify: `apps/server/src/config/env.ts`
- Modify: `apps/server/package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Add failing process contract tests**

In `packages/types/tests/knowledge.test.mts`, extend imports:

```ts
  knowledgeDocumentProcessRequestSchema,
  knowledgeDocumentProcessResponseSchema,
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
  testProcessRequest();
  testSearchRequest();
  testSearchResponse();
  testDeleteResponse();
}
```

Add:

```ts
function testProcessRequest() {
  assert.deepEqual(knowledgeDocumentProcessRequestSchema.parse({}), {
    force: false,
  });
  assert.deepEqual(knowledgeDocumentProcessRequestSchema.parse({ force: true }), {
    force: true,
  });
  assert.throws(() =>
    knowledgeDocumentProcessRequestSchema.parse({ force: true, extra: true }),
  );

  const response = knowledgeDocumentProcessResponseSchema.parse(
    createDocumentPayload({
      status: 'DONE',
      chunkCount: 2,
      processedAt: '2026-06-18T10:00:00.000Z',
    }),
  );
  assert.equal(response.status, 'DONE');
  assert.equal(response.chunkCount, 2);
}
```

- [ ] **Step 2: Run the failing contract test**

Run:

```powershell
bun packages/types/tests/knowledge.test.mts
```

Expected: fail because process schemas are not exported.

- [ ] **Step 3: Implement process contract schemas**

In `packages/types/src/api/knowledge.ts`, add after delete response schema:

```ts
export const knowledgeDocumentProcessRequestSchema = z
  .object({
    force: z.boolean().default(false),
  })
  .strict();

export const knowledgeDocumentProcessResponseSchema = knowledgeDocumentResponseSchema;
```

Add types near existing knowledge document types:

```ts
export type KnowledgeDocumentProcessRequest = z.infer<
  typeof knowledgeDocumentProcessRequestSchema
>;
export type KnowledgeDocumentProcessResponse = z.infer<
  typeof knowledgeDocumentProcessResponseSchema
>;
```

- [ ] **Step 4: Add RAG env schema**

In `apps/server/src/config/env.ts`, extend `envSchema` after `UPLOAD_DOCUMENT_MAX_BYTES`:

```ts
  RAG_EMBEDDING_PROVIDER: z.enum(['openai']).default('openai'),
  RAG_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
  RAG_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  RAG_EMBEDDING_BATCH_SIZE: z.coerce.number().int().min(1).max(128).default(32),
  RAG_CHUNK_TARGET_TOKENS: z.coerce.number().int().min(100).max(2000).default(650),
  RAG_CHUNK_OVERLAP_TOKENS: z.coerce.number().int().min(0).max(500).default(80),
  RAG_CHUNK_MAX_TOKENS: z.coerce.number().int().min(200).max(3000).default(900),
  RAG_MAX_CHUNKS_PER_DOCUMENT: z.coerce.number().int().min(1).max(2000).default(500),
  OPENAI_API_KEY: z.string().optional(),
```

In tests that instantiate `ServerEnv`, add matching values:

```ts
    RAG_EMBEDDING_PROVIDER: 'openai',
    RAG_EMBEDDING_MODEL: 'text-embedding-3-small',
    RAG_EMBEDDING_DIMENSIONS: 1536,
    RAG_EMBEDDING_BATCH_SIZE: 32,
    RAG_CHUNK_TARGET_TOKENS: 650,
    RAG_CHUNK_OVERLAP_TOKENS: 80,
    RAG_CHUNK_MAX_TOKENS: 900,
    RAG_MAX_CHUNKS_PER_DOCUMENT: 500,
    OPENAI_API_KEY: 'test-openai-key',
```

- [ ] **Step 5: Add server dependencies**

Run:

```powershell
bun add --filter @repo/server mammoth pdf-parse openai
```

Expected: `apps/server/package.json` and `bun.lock` change.

- [ ] **Step 6: Run contract and server type checks**

Run:

```powershell
bun packages/types/tests/knowledge.test.mts
bun --cwd packages/types typecheck
bun --filter @repo/server build
```

Expected: all exit 0.

- [ ] **Step 7: Commit contracts and config**

Run:

```powershell
git add packages/types/src/api/knowledge.ts packages/types/tests/knowledge.test.mts apps/server/src/config/env.ts apps/server/package.json bun.lock
git commit -m "feat: add knowledge processing contracts"
```

---

### Task 2: Implement Pure RAG Chunking Helpers

**Files:**

- Modify: `packages/rag/package.json`
- Modify: `packages/rag/src/chunker.ts`
- Modify: `packages/rag/src/embedder.ts`
- Modify: `packages/rag/src/index.ts`
- Create: `packages/rag/tests/chunker.test.ts`

- [ ] **Step 1: Add package test script**

In `packages/rag/package.json`, update scripts:

```json
{
  "scripts": {
    "lint": "eslint src/",
    "test": "bun test tests",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Write failing chunker tests**

Create `packages/rag/tests/chunker.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import {
  assertEmbeddingDimensions,
  splitDocument,
  tokenizeApprox,
} from '../src/index';

describe('splitDocument', () => {
  it('keeps a short document as a single chunk with metadata', () => {
    const chunks = splitDocument({
      documentId: 'doc_1',
      sourceName: 'notes.md',
      text: '# 格林公式\n\n格林公式可以把闭曲线积分转化为二重积分。',
      metadata: { parser: 'markdown-basic' },
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      index: 0,
      metadata: {
        documentId: 'doc_1',
        sourceName: 'notes.md',
        chunkIndex: 0,
        parser: 'markdown-basic',
        sectionTitle: '格林公式',
      },
    });
    expect(chunks[0]?.tokenCount).toBeGreaterThan(0);
  });

  it('splits long text and keeps bounded overlap', () => {
    const text = Array.from({ length: 80 }, (_, index) => `第${index}段内容用于测试分块。`)
      .join('\n\n');
    const chunks = splitDocument(
      {
        documentId: 'doc_2',
        sourceName: 'long.txt',
        text,
      },
      { targetTokens: 80, overlapTokens: 12, maxTokens: 120 },
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.tokenCount <= 120)).toBe(true);
    expect(chunks.map((chunk) => chunk.index)).toEqual(
      chunks.map((_, index) => index),
    );
  });
});

describe('embedding helpers', () => {
  it('estimates token count for chinese and english text', () => {
    expect(tokenizeApprox('格林公式 Green theorem')).toBeGreaterThanOrEqual(4);
  });

  it('throws when vector dimensions do not match', () => {
    expect(() => assertEmbeddingDimensions([0.1, 0.2], 3)).toThrow(
      'Expected embedding dimension 3 but received 2',
    );
  });
});
```

- [ ] **Step 3: Run the failing chunker tests**

Run:

```powershell
bun --cwd packages/rag test
```

Expected: fail because `splitDocument`, `tokenizeApprox`, and `assertEmbeddingDimensions` are not exported.

- [ ] **Step 4: Implement chunker**

Replace `packages/rag/src/chunker.ts` with:

```ts
export type ChunkInput = {
  documentId: string;
  sourceName: string;
  text: string;
  metadata?: Record<string, unknown>;
};

export type ChunkingOptions = {
  targetTokens: number;
  overlapTokens: number;
  maxTokens: number;
};

export type TextChunk = {
  content: string;
  index: number;
  tokenCount: number;
  metadata: Record<string, unknown>;
};

const defaultOptions: ChunkingOptions = {
  targetTokens: 650,
  overlapTokens: 80,
  maxTokens: 900,
};

export function splitDocument(
  input: ChunkInput,
  options: Partial<ChunkingOptions> = {},
): TextChunk[] {
  const resolved = { ...defaultOptions, ...options };
  const units = splitIntoUnits(input.text);
  const chunks: TextChunk[] = [];
  let current: string[] = [];
  let currentTokens = 0;
  let sectionTitle = findSectionTitle(units);

  for (const unit of units) {
    if (isHeading(unit)) {
      sectionTitle = normalizeHeading(unit);
    }

    const pieces = splitOversizedUnit(unit, resolved.maxTokens);
    for (const piece of pieces) {
      const pieceTokens = tokenizeApprox(piece);
      const shouldFlush =
        current.length > 0 && currentTokens + pieceTokens > resolved.targetTokens;

      if (shouldFlush) {
        pushChunk(chunks, current, currentTokens, input, sectionTitle);
        current = buildOverlap(current, resolved.overlapTokens);
        currentTokens = tokenizeApprox(current.join('\n\n'));
      }

      current.push(piece);
      currentTokens += pieceTokens;
    }
  }

  if (current.length > 0) {
    pushChunk(chunks, current, tokenizeApprox(current.join('\n\n')), input, sectionTitle);
  }

  return chunks.map((chunk, index) => ({
    ...chunk,
    index,
    metadata: { ...chunk.metadata, chunkIndex: index },
  }));
}

export function tokenizeApprox(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  const englishTokens = normalized.match(/[a-zA-Z0-9_]+/g)?.length ?? 0;
  const cjkChars = normalized.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const punctuation = normalized.match(/[，。！？；：,.!?;:]/g)?.length ?? 0;
  return Math.max(1, englishTokens + Math.ceil(cjkChars / 1.8) + punctuation);
}

function splitIntoUnits(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((unit) => unit.trim())
    .filter(Boolean);
}

function splitOversizedUnit(unit: string, maxTokens: number): string[] {
  if (tokenizeApprox(unit) <= maxTokens) return [unit];
  const sentences = unit
    .split(/(?<=[。！？；.!?;])\s*/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return splitByCharacters(unit, maxTokens);
  return sentences.flatMap((sentence) => splitOversizedUnit(sentence, maxTokens));
}

function splitByCharacters(unit: string, maxTokens: number): string[] {
  const windowSize = Math.max(200, Math.floor(maxTokens * 1.6));
  const pieces: string[] = [];
  for (let index = 0; index < unit.length; index += windowSize) {
    pieces.push(unit.slice(index, index + windowSize).trim());
  }
  return pieces.filter(Boolean);
}

function pushChunk(
  chunks: TextChunk[],
  units: string[],
  tokenCount: number,
  input: ChunkInput,
  sectionTitle: string | null,
) {
  const content = units.join('\n\n').trim();
  if (!content) return;
  chunks.push({
    content,
    index: chunks.length,
    tokenCount,
    metadata: {
      ...input.metadata,
      documentId: input.documentId,
      sourceName: input.sourceName,
      sectionTitle,
    },
  });
}

function buildOverlap(units: string[], overlapTokens: number): string[] {
  if (overlapTokens <= 0) return [];
  const overlap: string[] = [];
  let count = 0;
  for (let index = units.length - 1; index >= 0; index -= 1) {
    const unit = units[index];
    if (!unit) continue;
    const nextCount = count + tokenizeApprox(unit);
    if (nextCount > overlapTokens && overlap.length > 0) break;
    overlap.unshift(unit);
    count = nextCount;
    if (count >= overlapTokens) break;
  }
  return overlap;
}

function isHeading(unit: string): boolean {
  return /^#{1,6}\s+\S/.test(unit);
}

function normalizeHeading(unit: string): string {
  return unit.replace(/^#{1,6}\s+/, '').trim();
}

function findSectionTitle(units: string[]): string | null {
  const heading = units.find(isHeading);
  return heading ? normalizeHeading(heading) : null;
}
```

- [ ] **Step 5: Implement embedding helpers**

Replace `packages/rag/src/embedder.ts` with:

```ts
export type EmbeddingProvider = {
  model: string;
  dimensions: number;
  embedBatch(texts: string[]): Promise<number[][]>;
};

export function assertEmbeddingDimensions(vector: number[], dimensions: number) {
  if (vector.length !== dimensions) {
    throw new Error(
      `Expected embedding dimension ${dimensions} but received ${vector.length}`,
    );
  }
}

export function assertEmbeddingBatchDimensions(
  vectors: number[][],
  dimensions: number,
  expectedCount: number,
) {
  if (vectors.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} embeddings but received ${vectors.length}`,
    );
  }

  vectors.forEach((vector) => assertEmbeddingDimensions(vector, dimensions));
}
```

Update `packages/rag/src/index.ts`:

```ts
export * from './chunker';
export * from './embedder';
export { retriever } from './retriever';
export { reranker } from './reranker';
```

- [ ] **Step 6: Run rag tests and typecheck**

Run:

```powershell
bun --cwd packages/rag test
bun --cwd packages/rag typecheck
```

Expected: both exit 0.

- [ ] **Step 7: Commit rag helpers**

Run:

```powershell
git add packages/rag/package.json packages/rag/src/chunker.ts packages/rag/src/embedder.ts packages/rag/src/index.ts packages/rag/tests/chunker.test.ts
git commit -m "feat: add rag document chunking helpers"
```

---

### Task 3: Add Knowledge Document Read Helper

**Files:**

- Modify: `apps/server/src/uploads/storage.service.ts`
- Modify: `apps/server/src/uploads/storage.service.spec.ts`

- [ ] **Step 1: Add failing storage read tests**

In `apps/server/src/uploads/storage.service.spec.ts`, import `Readable`:

```ts
import { Readable } from 'node:stream';
```

Add tests near existing read-key tests:

```ts
  it('reads a knowledge document object with document errors', async () => {
    minioClient.statObject.mockResolvedValue({
      metaData: { 'content-type': 'text/plain' },
    });
    minioClient.getObject.mockResolvedValue(Readable.from(['hello']));

    const result = await createService().readKnowledgeDocumentObject(
      'users/user_1/knowledge/notes.txt',
    );

    expect(result.contentType).toBe('text/plain');
    expect(minioClient.statObject).toHaveBeenCalledWith(
      'prepmind-dev',
      'users/user_1/knowledge/notes.txt',
    );
  });

  it('returns a knowledge document not found error for unsafe document read keys', async () => {
    await expect(
      createService().readKnowledgeDocumentObject('../secret.txt'),
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND' });
  });

  it('returns a knowledge read failure when MinIO read fails', async () => {
    minioClient.statObject.mockRejectedValue(new Error('minio unavailable'));

    await expect(
      createService().readKnowledgeDocumentObject('users/user_1/knowledge/missing.txt'),
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_DOCUMENT_READ_FAILED' });
  });
```

- [ ] **Step 2: Run failing storage tests**

Run:

```powershell
bun --filter @repo/server test -- storage.service.spec.ts
```

Expected: fail because `readKnowledgeDocumentObject()` does not exist.

- [ ] **Step 3: Implement knowledge read helper**

In `apps/server/src/uploads/storage.service.ts`, add:

```ts
  async readKnowledgeDocumentObject(objectKey: string): Promise<{
    stream: Readable;
    contentType: string;
  }> {
    const safeKey = this.assertKnowledgeDocumentObjectKey(objectKey);
    try {
      return await this.readStoredObject(safeKey);
    } catch {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_READ_FAILED',
        '无法读取资料文件',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
```

Refactor existing `readObject()` to reuse a private helper:

```ts
  async readObject(objectKey: string): Promise<{
    stream: Readable;
    contentType: string;
  }> {
    const safeKey = this.assertReadableObjectKey(objectKey);
    try {
      return await this.readStoredObject(safeKey);
    } catch {
      throw new AppError(
        'UPLOAD_IMAGE_NOT_FOUND',
        '图片不存在',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async readStoredObject(objectKey: string): Promise<{
    stream: Readable;
    contentType: string;
  }> {
    const stat = await this.minioClient.statObject(this.bucket, objectKey);
    const stream = await this.minioClient.getObject(this.bucket, objectKey);
    const metadata =
      typeof stat.metaData === 'object' && stat.metaData !== null
        ? (stat.metaData as Record<string, string | undefined>)
        : {};

    return {
      stream,
      contentType:
        metadata['content-type'] ??
        metadata['Content-Type'] ??
        'application/octet-stream',
    };
  }
```

Add:

```ts
  private assertKnowledgeDocumentObjectKey(objectKey: string): string {
    const safeKey = this.assertStorageObjectKey(objectKey);
    if (!safeKey.includes('/knowledge/')) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_NOT_FOUND',
        '资料不存在',
        HttpStatus.NOT_FOUND,
      );
    }
    return safeKey;
  }
```

- [ ] **Step 4: Run storage tests**

Run:

```powershell
bun --filter @repo/server test -- storage.service.spec.ts
```

Expected: exit 0 and existing image read behavior still uses image error codes.

- [ ] **Step 5: Commit storage read helper**

Run:

```powershell
git add apps/server/src/uploads/storage.service.ts apps/server/src/uploads/storage.service.spec.ts
git commit -m "feat: add knowledge document read helper"
```

---

### Task 4: Implement Document Parser Service

**Files:**

- Create: `apps/server/src/knowledge-documents/document-parser.service.ts`
- Create: `apps/server/src/knowledge-documents/document-parser.service.spec.ts`
- Modify: `apps/server/src/knowledge-documents/knowledge-documents.module.ts`

- [ ] **Step 1: Write parser tests**

Create `apps/server/src/knowledge-documents/document-parser.service.spec.ts`:

```ts
import { HttpStatus } from '@nestjs/common';

import { DocumentParserService } from './document-parser.service';

jest.mock('mammoth', () => ({
  __esModule: true,
  default: {
    extractRawText: jest.fn().mockResolvedValue({ value: 'Docx text\n\n第二段' }),
  },
}));

jest.mock('pdf-parse', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({ text: 'Pdf text\n\n第二页', numpages: 2 }),
}));

describe('DocumentParserService', () => {
  const service = new DocumentParserService();

  it('parses and normalizes txt documents', async () => {
    const result = await service.parse({
      name: 'notes.txt',
      type: 'TXT',
      mimeType: 'text/plain',
      buffer: Buffer.from('第一行\r\n\r\n\r\n第二行\0'),
    });

    expect(result.text).toBe('第一行\n\n第二行');
    expect(result.metadata).toMatchObject({
      sourceName: 'notes.txt',
      mimeType: 'text/plain',
      parser: 'txt-basic',
    });
  });

  it('extracts markdown headings', async () => {
    const result = await service.parse({
      name: 'notes.md',
      type: 'MD',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# 第一章\n\n## 格林公式\n\n正文'),
    });

    expect(result.metadata.headings).toEqual(['第一章', '格林公式']);
  });

  it('parses docx through mammoth', async () => {
    const result = await service.parse({
      name: 'notes.docx',
      type: 'DOCX',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('docx'),
    });

    expect(result.text).toContain('Docx text');
    expect(result.metadata.parser).toBe('docx-mammoth');
  });

  it('parses pdf through pdf-parse', async () => {
    const result = await service.parse({
      name: 'notes.pdf',
      type: 'PDF',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF'),
    });

    expect(result.text).toContain('Pdf text');
    expect(result.metadata.pageCount).toBe(2);
  });

  it('rejects empty parsed text', async () => {
    await expect(
      service.parse({
        name: 'empty.txt',
        type: 'TXT',
        mimeType: 'text/plain',
        buffer: Buffer.from('   \n\n   '),
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_EMPTY_TEXT',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  });
});
```

- [ ] **Step 2: Run failing parser tests**

Run:

```powershell
bun --filter @repo/server test -- document-parser.service.spec.ts
```

Expected: fail because parser service does not exist.

- [ ] **Step 3: Implement parser service**

Create `apps/server/src/knowledge-documents/document-parser.service.ts`:

```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import type { KnowledgeDocumentType } from '@repo/types/api/knowledge';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

import { AppError } from '../common/errors/app-error';

export type ParseDocumentInput = {
  name: string;
  type: KnowledgeDocumentType;
  mimeType: string;
  buffer: Buffer;
};

export type ParsedDocument = {
  text: string;
  metadata: {
    sourceName: string;
    mimeType: string;
    parser: string;
    pageCount?: number;
    headings?: string[];
  };
};

@Injectable()
export class DocumentParserService {
  async parse(input: ParseDocumentInput): Promise<ParsedDocument> {
    const parsed = await this.parseByType(input);
    const text = normalizeText(parsed.text);
    if (!text) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_EMPTY_TEXT',
        '资料中没有可解析的文本',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return {
      text,
      metadata: {
        sourceName: input.name,
        mimeType: input.mimeType,
        ...parsed.metadata,
      },
    };
  }

  private async parseByType(input: ParseDocumentInput): Promise<ParsedDocument> {
    if (input.type === 'TXT') {
      return {
        text: input.buffer.toString('utf8'),
        metadata: { sourceName: input.name, mimeType: input.mimeType, parser: 'txt-basic' },
      };
    }

    if (input.type === 'MD') {
      const text = input.buffer.toString('utf8');
      return {
        text,
        metadata: {
          sourceName: input.name,
          mimeType: input.mimeType,
          parser: 'markdown-basic',
          headings: extractMarkdownHeadings(text),
        },
      };
    }

    if (input.type === 'DOCX') {
      const result = await mammoth.extractRawText({ buffer: input.buffer });
      return {
        text: result.value,
        metadata: {
          sourceName: input.name,
          mimeType: input.mimeType,
          parser: 'docx-mammoth',
        },
      };
    }

    const result = await pdfParse(input.buffer);
    return {
      text: result.text,
      metadata: {
        sourceName: input.name,
        mimeType: input.mimeType,
        parser: 'pdf-basic',
        pageCount: result.numpages,
      },
    };
  }
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\0/g, '')
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractMarkdownHeadings(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.match(/^#{1,6}\s+(.+)$/)?.[1]?.trim())
    .filter((heading): heading is string => Boolean(heading));
}
```

- [ ] **Step 4: Register parser service**

In `apps/server/src/knowledge-documents/knowledge-documents.module.ts`, add provider:

```ts
import { DocumentParserService } from './document-parser.service';
```

Update providers:

```ts
  providers: [KnowledgeDocumentsService, DocumentParserService],
```

- [ ] **Step 5: Run parser tests and server build**

Run:

```powershell
bun --filter @repo/server test -- document-parser.service.spec.ts
bun --filter @repo/server build
```

Expected: both exit 0.

- [ ] **Step 6: Commit parser service**

Run:

```powershell
git add apps/server/src/knowledge-documents/document-parser.service.ts apps/server/src/knowledge-documents/document-parser.service.spec.ts apps/server/src/knowledge-documents/knowledge-documents.module.ts
git commit -m "feat: parse knowledge document text"
```

---

### Task 5: Implement Embedding And Chunk Persistence Services

**Files:**

- Create: `apps/server/src/knowledge-documents/embedding.service.ts`
- Create: `apps/server/src/knowledge-documents/embedding.service.spec.ts`
- Create: `apps/server/src/knowledge-documents/chunk-persistence.service.ts`
- Create: `apps/server/src/knowledge-documents/chunk-persistence.service.spec.ts`
- Modify: `apps/server/src/knowledge-documents/knowledge-documents.module.ts`

- [ ] **Step 1: Write embedding service tests**

Create `apps/server/src/knowledge-documents/embedding.service.spec.ts`:

```ts
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ServerEnv } from '../config/env';
import { EmbeddingService, type ServerEmbeddingProvider } from './embedding.service';

describe('EmbeddingService', () => {
  const baseEnv: ServerEnv = {
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
    UPLOAD_DOCUMENT_MAX_BYTES: 20 * 1024 * 1024,
    RAG_EMBEDDING_PROVIDER: 'openai',
    RAG_EMBEDDING_MODEL: 'text-embedding-3-small',
    RAG_EMBEDDING_DIMENSIONS: 1536,
    RAG_EMBEDDING_BATCH_SIZE: 2,
    RAG_CHUNK_TARGET_TOKENS: 650,
    RAG_CHUNK_OVERLAP_TOKENS: 80,
    RAG_CHUNK_MAX_TOKENS: 900,
    RAG_MAX_CHUNKS_PER_DOCUMENT: 500,
    OPENAI_API_KEY: 'test-openai-key',
  };

  it('embeds text in configured batches and validates dimensions', async () => {
    const provider: ServerEmbeddingProvider = {
      model: 'fake',
      dimensions: 1536,
      embedBatch: jest.fn(async (texts) => texts.map(() => Array(1536).fill(0.1))),
    };

    const vectors = await createService(provider).embedChunks(['a', 'b', 'c']);

    expect(vectors).toHaveLength(3);
    expect(provider.embedBatch).toHaveBeenCalledTimes(2);
  });

  it('rejects dimension mismatch', async () => {
    const provider: ServerEmbeddingProvider = {
      model: 'fake',
      dimensions: 2,
      embedBatch: jest.fn(async () => [[0.1, 0.2]]),
    };

    await expect(createService(provider).embedChunks(['a'])).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });
  });

  it('rejects provider failures with a stable app error', async () => {
    const provider: ServerEmbeddingProvider = {
      model: 'fake',
      dimensions: 1536,
      embedBatch: jest.fn(async () => {
        throw new Error('provider down');
      }),
    };

    await expect(createService(provider).embedChunks(['a'])).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
    });
  });

  function createService(provider: ServerEmbeddingProvider) {
    const config = {
      get: jest.fn((key: keyof ServerEnv) => baseEnv[key]),
    } as unknown as ConfigService<ServerEnv, true>;
    return new EmbeddingService(config, provider);
  }
});
```

- [ ] **Step 2: Write chunk persistence tests**

Create `apps/server/src/knowledge-documents/chunk-persistence.service.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';

import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { ChunkPersistenceService } from './chunk-persistence.service';

describe('ChunkPersistenceService', () => {
  const tx = {
    chunk: { deleteMany: jest.fn() },
    $executeRaw: jest.fn(),
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (txArg: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  const config = {
    get: jest.fn((key: keyof ServerEnv) => {
      if (key === 'RAG_MAX_CHUNKS_PER_DOCUMENT') return 2;
      return undefined;
    }),
  } as unknown as ConfigService<ServerEnv, true>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('replaces document chunks through a transaction', async () => {
    await createService().replaceDocumentChunks({
      documentId: 'doc_1',
      userId: 'user_1',
      chunks: [
        {
          content: 'chunk one',
          index: 0,
          tokenCount: 2,
          metadata: { sourceName: 'notes.txt' },
          embedding: Array(1536).fill(0.1),
        },
      ],
    });

    expect(tx.chunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc_1', userId: 'user_1' },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects too many chunks before writing', async () => {
    await expect(
      createService().replaceDocumentChunks({
        documentId: 'doc_1',
        userId: 'user_1',
        chunks: [
          createChunk(0),
          createChunk(1),
          createChunk(2),
        ],
      }),
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_DOCUMENT_TOO_MANY_CHUNKS' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  function createService() {
    return new ChunkPersistenceService(
      prisma as unknown as PrismaService,
      config,
    );
  }

  function createChunk(index: number) {
    return {
      content: `chunk ${index}`,
      index,
      tokenCount: 2,
      metadata: { sourceName: 'notes.txt' },
      embedding: Array(1536).fill(0.1),
    };
  }
});
```

- [ ] **Step 3: Run failing service tests**

Run:

```powershell
bun --filter @repo/server test -- embedding.service.spec.ts chunk-persistence.service.spec.ts
```

Expected: fail because the services do not exist.

- [ ] **Step 4: Implement embedding service**

Create `apps/server/src/knowledge-documents/embedding.service.ts`:

```ts
import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  assertEmbeddingBatchDimensions,
  type EmbeddingProvider,
} from '@repo/rag';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';

export type ServerEmbeddingProvider = EmbeddingProvider;

@Injectable()
export class EmbeddingService {
  private readonly dimensions: number;
  private readonly batchSize: number;

  constructor(
    private readonly configService: ConfigService<ServerEnv, true>,
    @Optional()
    @Inject('EMBEDDING_PROVIDER')
    private readonly injectedProvider?: ServerEmbeddingProvider,
  ) {
    this.dimensions = this.configService.get('RAG_EMBEDDING_DIMENSIONS', {
      infer: true,
    });
    this.batchSize = this.configService.get('RAG_EMBEDDING_BATCH_SIZE', {
      infer: true,
    });
  }

  async embedChunks(texts: string[]): Promise<number[][]> {
    try {
      const provider = this.injectedProvider ?? this.createOpenAIProvider();
      if (provider.dimensions !== this.dimensions) {
        throw new Error(
          `Configured dimensions ${this.dimensions} do not match provider dimensions ${provider.dimensions}`,
        );
      }

      const vectors: number[][] = [];
      for (let index = 0; index < texts.length; index += this.batchSize) {
        const batch = texts.slice(index, index + this.batchSize);
        const embedded = await provider.embedBatch(batch);
        assertEmbeddingBatchDimensions(embedded, this.dimensions, batch.length);
        vectors.push(...embedded);
      }
      return vectors;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        'KNOWLEDGE_EMBEDDING_FAILED',
        '生成向量失败，请稍后重试',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private createOpenAIProvider(): ServerEmbeddingProvider {
    const apiKey = this.configService.get('OPENAI_API_KEY', { infer: true });
    if (!apiKey) {
      throw new AppError(
        'KNOWLEDGE_EMBEDDING_FAILED',
        '生成向量失败，请稍后重试',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const model = this.configService.get('RAG_EMBEDDING_MODEL', { infer: true });
    const client = new OpenAI({ apiKey });

    return {
      model,
      dimensions: this.dimensions,
      embedBatch: async (texts) => {
        const response = await client.embeddings.create({
          model,
          input: texts,
          dimensions: this.dimensions,
        });
        return response.data.map((item) => item.embedding);
      },
    };
  }
}
```

- [ ] **Step 5: Implement chunk persistence service**

Create `apps/server/src/knowledge-documents/chunk-persistence.service.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';

export type PersistableChunk = {
  content: string;
  index: number;
  tokenCount: number;
  metadata: Record<string, unknown>;
  embedding: number[];
};

@Injectable()
export class ChunkPersistenceService {
  private readonly maxChunks: number;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService<ServerEnv, true>,
  ) {
    this.maxChunks = configService.get('RAG_MAX_CHUNKS_PER_DOCUMENT', {
      infer: true,
    });
  }

  async replaceDocumentChunks(input: {
    documentId: string;
    userId: string;
    chunks: PersistableChunk[];
  }) {
    if (input.chunks.length > this.maxChunks) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_TOO_MANY_CHUNKS',
        '资料过长，请拆分后再上传',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.chunk.deleteMany({
        where: { documentId: input.documentId, userId: input.userId },
      });

      for (const chunk of input.chunks) {
        await tx.$executeRaw`
          INSERT INTO "Chunk"
            ("id", "documentId", "content", "embedding", "metadata", "index", "tokenCount", "userId", "createdAt")
          VALUES
            (
              ${`chunk_${randomUUID()}`},
              ${input.documentId},
              ${chunk.content},
              ${toVectorLiteral(chunk.embedding)}::vector,
              ${JSON.stringify(chunk.metadata)}::jsonb,
              ${chunk.index},
              ${chunk.tokenCount},
              ${input.userId},
              NOW()
            )
        `;
      }
    });
  }
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.map(formatVectorNumber).join(',')}]`;
}

function formatVectorNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error('Embedding contains a non-finite number');
  }
  return Number(value).toString();
}
```

- [ ] **Step 6: Register services**

In `apps/server/src/knowledge-documents/knowledge-documents.module.ts`, add imports:

```ts
import { ChunkPersistenceService } from './chunk-persistence.service';
import { EmbeddingService } from './embedding.service';
```

Update providers:

```ts
  providers: [
    KnowledgeDocumentsService,
    DocumentParserService,
    {
      provide: 'EMBEDDING_PROVIDER',
      useValue: null,
    },
    EmbeddingService,
    ChunkPersistenceService,
  ],
```

- [ ] **Step 7: Run service tests and build**

Run:

```powershell
bun --filter @repo/server test -- embedding.service.spec.ts chunk-persistence.service.spec.ts
bun --filter @repo/server build
```

Expected: both exit 0.

- [ ] **Step 8: Commit embedding and persistence services**

Run:

```powershell
git add apps/server/src/knowledge-documents/embedding.service.ts apps/server/src/knowledge-documents/embedding.service.spec.ts apps/server/src/knowledge-documents/chunk-persistence.service.ts apps/server/src/knowledge-documents/chunk-persistence.service.spec.ts apps/server/src/knowledge-documents/knowledge-documents.module.ts
git commit -m "feat: add knowledge embedding persistence"
```

---

### Task 6: Add Document Processing Service And API

**Files:**

- Create: `apps/server/src/knowledge-documents/document-processing.service.ts`
- Create: `apps/server/src/knowledge-documents/document-processing.service.spec.ts`
- Modify: `apps/server/src/knowledge-documents/knowledge-documents.controller.ts`
- Modify: `apps/server/src/knowledge-documents/knowledge-documents.module.ts`

- [ ] **Step 1: Write processing service tests**

Create `apps/server/src/knowledge-documents/document-processing.service.spec.ts`:

```ts
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';

import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../uploads/storage.service';
import { ChunkPersistenceService } from './chunk-persistence.service';
import { DocumentParserService } from './document-parser.service';
import { DocumentProcessingService } from './document-processing.service';
import { EmbeddingService } from './embedding.service';

describe('DocumentProcessingService', () => {
  const now = new Date('2026-06-18T10:00:00.000Z');
  const documentRow = {
    id: 'doc_1',
    name: 'notes.txt',
    type: 'TXT',
    size: 12,
    mimeType: 'text/plain',
    storageKey: 'users/user_1/knowledge/notes.txt',
    status: 'PENDING',
    sourceType: 'UPLOAD',
    errorMessage: null,
    contentHash: 'sha256:abc',
    processedAt: null,
    userId: 'user_1',
    createdAt: now,
    updatedAt: now,
    _count: { chunks: 0 },
  };
  const prisma = {
    document: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const storage = {
    readKnowledgeDocumentObject: jest.fn(),
  };
  const parser = {
    parse: jest.fn(),
  };
  const embedding = {
    embedChunks: jest.fn(),
  };
  const persistence = {
    replaceDocumentChunks: jest.fn(),
  };
  const config = {
    get: jest.fn((key: keyof ServerEnv) => {
      const values = {
        RAG_CHUNK_TARGET_TOKENS: 650,
        RAG_CHUNK_OVERLAP_TOKENS: 80,
        RAG_CHUNK_MAX_TOKENS: 900,
      };
      return values[key as keyof typeof values];
    }),
  } as unknown as ConfigService<ServerEnv, true>;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.document.findFirst.mockResolvedValue(documentRow);
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.document.update.mockImplementation(({ data }) =>
      Promise.resolve({
        ...documentRow,
        ...data,
        processedAt: data.processedAt ?? null,
        _count: { chunks: data.status === 'DONE' ? 1 : 0 },
      }),
    );
    storage.readKnowledgeDocumentObject.mockResolvedValue({
      stream: Readable.from(['hello world']),
      contentType: 'text/plain',
    });
    parser.parse.mockResolvedValue({
      text: 'hello world',
      metadata: { sourceName: 'notes.txt', parser: 'txt-basic' },
    });
    embedding.embedChunks.mockResolvedValue([Array(1536).fill(0.1)]);
    persistence.replaceDocumentChunks.mockResolvedValue(undefined);
  });

  it('processes a pending document into done chunks', async () => {
    const result = await createService().processDocument('user_1', 'doc_1', {
      force: false,
    });

    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'doc_1', userId: 'user_1', status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'PROCESSING', errorMessage: null },
    });
    expect(persistence.replaceDocumentChunks).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc_1',
        userId: 'user_1',
      }),
    );
    expect(result.status).toBe('DONE');
  });

  it('rejects processing documents owned by another user', async () => {
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      createService().processDocument('user_2', 'doc_1', { force: false }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  });

  it('rejects an already done document without force', async () => {
    prisma.document.findFirst.mockResolvedValue({ ...documentRow, status: 'DONE' });

    await expect(
      createService().processDocument('user_1', 'doc_1', { force: false }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_ALREADY_DONE',
      statusCode: HttpStatus.CONFLICT,
    });
  });

  it('marks document failed when parsing fails after claim', async () => {
    parser.parse.mockRejectedValue(new Error('parse failed'));

    await expect(
      createService().processDocument('user_1', 'doc_1', { force: false }),
    ).rejects.toThrow('parse failed');
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc_1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: expect.any(String),
      }),
      include: { _count: { select: { chunks: true } } },
    });
  });

  function createService() {
    return new DocumentProcessingService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      parser as unknown as DocumentParserService,
      embedding as unknown as EmbeddingService,
      persistence as unknown as ChunkPersistenceService,
      config,
    );
  }
});
```

- [ ] **Step 2: Run failing processing tests**

Run:

```powershell
bun --filter @repo/server test -- document-processing.service.spec.ts
```

Expected: fail because processing service does not exist.

- [ ] **Step 3: Implement processing service**

Create `apps/server/src/knowledge-documents/document-processing.service.ts`:

```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { splitDocument } from '@repo/rag';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../uploads/storage.service';
import { ChunkPersistenceService } from './chunk-persistence.service';
import { DocumentParserService } from './document-parser.service';
import { EmbeddingService } from './embedding.service';

@Injectable()
export class DocumentProcessingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly parserService: DocumentParserService,
    private readonly embeddingService: EmbeddingService,
    private readonly chunkPersistenceService: ChunkPersistenceService,
    private readonly configService: ConfigService<ServerEnv, true>,
  ) {}

  async processDocument(
    userId: string,
    documentId: string,
    options: { force: boolean },
  ) {
    const document = await this.findOwned(userId, documentId);
    this.assertProcessable(document.status, options.force);

    await this.claimDocument(userId, documentId, options.force);

    try {
      const object = await this.storageService.readKnowledgeDocumentObject(
        document.storageKey,
      );
      const buffer = await streamToBuffer(object.stream);
      const parsed = await this.parserService.parse({
        name: document.name,
        type: document.type,
        mimeType: document.mimeType,
        buffer,
      });
      const chunks = splitDocument(
        {
          documentId,
          sourceName: document.name,
          text: parsed.text,
          metadata: parsed.metadata,
        },
        {
          targetTokens: this.configService.get('RAG_CHUNK_TARGET_TOKENS', {
            infer: true,
          }),
          overlapTokens: this.configService.get('RAG_CHUNK_OVERLAP_TOKENS', {
            infer: true,
          }),
          maxTokens: this.configService.get('RAG_CHUNK_MAX_TOKENS', {
            infer: true,
          }),
        },
      );
      const vectors = await this.embeddingService.embedChunks(
        chunks.map((chunk) => chunk.content),
      );

      await this.chunkPersistenceService.replaceDocumentChunks({
        documentId,
        userId,
        chunks: chunks.map((chunk, index) => ({
          ...chunk,
          embedding: vectors[index] ?? [],
        })),
      });

      const done = await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'DONE',
          errorMessage: null,
          processedAt: new Date(),
        },
        include: this.documentInclude,
      });
      return this.toResponse(done);
    } catch (error) {
      await this.markFailed(documentId, error);
      throw error;
    }
  }

  private readonly documentInclude = {
    _count: { select: { chunks: true } },
  } as const;

  private async findOwned(userId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
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

  private assertProcessable(status: string, force: boolean) {
    if (status === 'PROCESSING') {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_PROCESSING',
        '资料正在处理中',
        HttpStatus.CONFLICT,
      );
    }

    if (status === 'DONE' && !force) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_ALREADY_DONE',
        '资料已经处理完成',
        HttpStatus.CONFLICT,
      );
    }
  }

  private async claimDocument(userId: string, documentId: string, force: boolean) {
    const statuses = force ? ['PENDING', 'FAILED', 'DONE'] : ['PENDING', 'FAILED'];
    const result = await this.prisma.document.updateMany({
      where: { id: documentId, userId, status: { in: statuses } },
      data: { status: 'PROCESSING', errorMessage: null },
    });

    if (result.count !== 1) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_PROCESSING',
        '资料正在处理中',
        HttpStatus.CONFLICT,
      );
    }
  }

  private async markFailed(documentId: string, error: unknown) {
    const message =
      error instanceof AppError ? error.message : '资料处理失败，请稍后重试';
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        errorMessage: message,
      },
      include: this.documentInclude,
    });
  }

  private toResponse(document: {
    id: string;
    name: string;
    type: 'PDF' | 'DOCX' | 'MD' | 'TXT';
    size: number;
    mimeType: string;
    status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
    sourceType: 'UPLOAD' | 'NOTE' | 'WRONG_QUESTION' | 'OCR' | 'CHAT';
    errorMessage: string | null;
    contentHash: string | null;
    processedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { chunks: number };
  }) {
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

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
```

- [ ] **Step 4: Add process endpoint**

In `apps/server/src/knowledge-documents/knowledge-documents.controller.ts`, add imports:

```ts
import { Body } from '@nestjs/common';
import { knowledgeDocumentProcessRequestSchema } from '@repo/types/api/knowledge';
import { DocumentProcessingService } from './document-processing.service';
```

Update constructor:

```ts
  constructor(
    private readonly knowledgeDocumentsService: KnowledgeDocumentsService,
    private readonly documentProcessingService: DocumentProcessingService,
  ) {}
```

Add before `@Get(':id')` so it is not captured by the detail route:

```ts
  @Post(':id/process')
  process(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = knowledgeDocumentProcessRequestSchema.parse(body ?? {});
    return this.documentProcessingService.processDocument(user.id, id, input);
  }
```

In module, import and register:

```ts
import { DocumentProcessingService } from './document-processing.service';
```

Add provider:

```ts
    DocumentProcessingService,
```

- [ ] **Step 5: Run processing tests and server build**

Run:

```powershell
bun --filter @repo/server test -- document-processing.service.spec.ts
bun --filter @repo/server build
```

Expected: both exit 0.

- [ ] **Step 6: Commit processing API**

Run:

```powershell
git add apps/server/src/knowledge-documents/document-processing.service.ts apps/server/src/knowledge-documents/document-processing.service.spec.ts apps/server/src/knowledge-documents/knowledge-documents.controller.ts apps/server/src/knowledge-documents/knowledge-documents.module.ts
git commit -m "feat: process knowledge documents"
```

---

### Task 7: Add E2E Processing Coverage

**Files:**

- Modify: `apps/server/test/knowledge-documents.e2e-spec.ts`

- [ ] **Step 1: Mock embedding provider in e2e module**

In `apps/server/test/knowledge-documents.e2e-spec.ts`, add provider override before `.compile()`:

```ts
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('EMBEDDING_PROVIDER')
      .useValue({
        model: 'fake-e2e',
        dimensions: 1536,
        embedBatch: async (texts: string[]) =>
          texts.map(() => Array(1536).fill(0.01)),
      })
      .compile();
```

- [ ] **Step 2: Add e2e success and failure tests**

Append tests:

```ts
  it('processes an uploaded txt document into chunks', async () => {
    const user = await registerUser('knowledge-process');

    const uploadResponse = await request(server)
      .post('/knowledge/documents')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .attach('file', Buffer.from('第一段内容\n\n第二段内容'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    const uploaded = knowledgeDocumentUploadResponseSchema.parse(
      getSuccessData(uploadResponse),
    );

    const processResponse = await request(server)
      .post(`/knowledge/documents/${uploaded.id}/process`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({})
      .expect(201);

    const processed = knowledgeDocumentProcessResponseSchema.parse(
      getSuccessData(processResponse),
    );
    expect(processed.status).toBe('DONE');
    expect(processed.chunkCount).toBeGreaterThan(0);
    expect(processed.processedAt).not.toBeNull();
  });

  it('marks empty text documents as failed', async () => {
    const user = await registerUser('knowledge-empty');

    const uploadResponse = await request(server)
      .post('/knowledge/documents')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .attach('file', Buffer.from('     '), {
        filename: 'empty.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    const uploaded = knowledgeDocumentUploadResponseSchema.parse(
      getSuccessData(uploadResponse),
    );

    await request(server)
      .post(`/knowledge/documents/${uploaded.id}/process`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({})
      .expect(422);

    await request(server)
      .get(`/knowledge/documents/${uploaded.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200)
      .expect((response) => {
        const detail = getSuccessData(response) as { status: string };
        expect(detail.status).toBe('FAILED');
      });
  });
```

Update imports:

```ts
  knowledgeDocumentProcessResponseSchema,
```

- [ ] **Step 3: Run e2e**

Run:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --cwd packages/database prisma migrate deploy
bun --filter @repo/server test:e2e -- --runInBand knowledge-documents.e2e-spec.ts
```

Expected: all knowledge document e2e tests pass.

- [ ] **Step 4: Commit e2e coverage**

Run:

```powershell
git add apps/server/test/knowledge-documents.e2e-spec.ts apps/server/src/knowledge-documents/knowledge-documents.module.ts
git commit -m "test: cover knowledge document processing"
```

---

### Task 8: Final Verification And Documentation Sync

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
bun --cwd packages/rag test
bun --cwd packages/rag typecheck
bun --filter @repo/server test -- storage.service.spec.ts document-parser.service.spec.ts embedding.service.spec.ts chunk-persistence.service.spec.ts document-processing.service.spec.ts knowledge-documents.service.spec.ts
bun --filter @repo/server build
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --cwd packages/database prisma migrate deploy
bun --filter @repo/server test:e2e -- --runInBand knowledge-documents.e2e-spec.ts
```

Expected:

- Contract tests pass.
- Types package typecheck passes.
- RAG tests and typecheck pass.
- Server unit tests pass.
- Server build exits 0.
- Database migration deploy shows no pending migrations after applying current migrations.
- Knowledge document e2e passes.

- [ ] **Step 2: Update docs to mark Phase 5.3 complete**

In `README.md`, update Phase status:

```md
| Phase 5.3 | 资料解析、分块、embedding 入库 | 已完成 |
```

In `docs/data-flow.md`, update RAG boundary:

```md
- RAG 知识库：Phase 5.3 已完成上传资料的解析、分块、embedding 入库和 `Document` 状态流转；`Chunk` 以 PostgreSQL + pgvector 为权威来源。检索 API、Chat RAG 注入、引用展示和知识库页面仍在后续阶段。
```

In `docs/roadmap.md`, update Phase 5 split:

```md
- Phase 5.3：解析、分块、embedding 入库。（已完成）
- Phase 5.4：知识库检索 API。（下一步）
```

In `AGENTS.md` and `CLAUDE.md`, update current data flow:

```md
- RAG：Phase 5.3 已完成资料处理链路，上传文档可从 `PENDING` 进入 `PROCESSING` 并生成 `DONE` chunks；解析失败、空文本或 embedding 失败会进入 `FAILED`。检索和 Chat RAG 注入仍未接入，Chat 继续保持普通回答能力。
```

In `DEVLOG.md`, under `2026-06-18`, append:

```md
**Phase 5.3 文档解析与 embedding 入库**

- 新增资料处理入口 `POST /knowledge/documents/:id/process`。
- 支持 TXT / Markdown / DOCX / PDF 基础文本解析，解析为空时进入 `FAILED`。
- 新增 `packages/rag` 段落感知分块与 embedding 维度校验工具。
- 新增 OpenAI embedding provider 抽象，默认对齐 `text-embedding-3-small` 与 `vector(1536)`。
- 新增 raw SQL chunk persistence，集中写入 `Chunk.embedding` pgvector 字段。
- 本阶段仍不实现 search API、Chat RAG 注入、citations 和 `/knowledge` 前端页面。
```

Update DEVLOG bottom checklist:

```md
- [x] Phase 5.3：解析、分块、embedding 入库。
- [ ] Phase 5.4：知识库检索 API。
```

- [ ] **Step 3: Run docs checks**

Run:

```powershell
git diff --check
rg -n "Phase 5.3.*下一步|解析、分块、embedding 入库。\\（下一步\\）|当前尚未实现解析" README.md AGENTS.md CLAUDE.md docs/data-flow.md docs/roadmap.md DEVLOG.md
```

Expected:

- `git diff --check` exits 0.
- `rg` returns no stale Phase 5.3-next wording in active docs.

- [ ] **Step 4: Commit docs**

Run:

```powershell
git add README.md AGENTS.md CLAUDE.md docs/data-flow.md docs/roadmap.md DEVLOG.md
git commit -m "docs: mark phase 5.3 processing complete"
```

- [ ] **Step 5: Final git check**

Run:

```powershell
git status --short --branch
git log --oneline -10
```

Expected:

- Worktree is clean.
- Recent commits include contracts, RAG chunking, storage read, parser, embedding persistence, process API, e2e, and docs.

## Self-Review Checklist

- Phase 5.3 only processes documents; no search API, Chat RAG injection, citations, or frontend page is added.
- `Document.status` always exits `PROCESSING` through `DONE` or `FAILED`.
- Cross-user processing returns not found.
- Raw SQL chunk writes are isolated in `ChunkPersistenceService`.
- `Chunk.id` is generated in server code because the database column has no SQL default.
- Embedding dimensions are checked before persistence.
- `text-embedding-3-small` and `vector(1536)` stay aligned.
- Tests avoid external OpenAI calls through injected fake providers.
- Parser failures and empty text become user-readable `Document.errorMessage`.
- RAG failures do not affect upload/list/delete, Chat, wrong questions, reviews, plan, or stats.
