# Phase 6.8 Knowledge Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build lightweight `KnowledgeDedupAgent / KnowledgeOrganizerAgent` as deterministic, read-only knowledge management suggestions.

**Architecture:** Add shared Zod contracts in `@repo/types`, deterministic policies in `@repo/agent`, a NestJS authenticated read-only `/knowledge-agent/suggestions` API, and a compact `/knowledge` page panel. No new database tables, no automatic merge/delete/classification writes, no live model calls.

**Tech Stack:** TypeScript, Zod, Bun test, NestJS 11, Prisma, Next.js 16, TanStack Query, Tailwind 4.

---

## File Map

- Create `packages/types/src/api/knowledge-agent.ts`: request/response schemas and exported types.
- Modify `packages/types/src/api/index.ts`: export knowledge-agent API.
- Modify `packages/types/package.json`: add `./api/knowledge-agent` export.
- Create `packages/types/tests/knowledge-agent.test.mts`: schema regression tests.
- Create `packages/agent/src/nodes/knowledge-dedup.ts`: deterministic dedup policy.
- Create `packages/agent/src/nodes/knowledge-organizer.ts`: deterministic organizer policy.
- Modify `packages/agent/src/index.ts`: export new policies.
- Modify `packages/agent/package.json`: add subpath exports.
- Create `packages/agent/tests/knowledge-dedup.test.ts`: dedup policy tests.
- Create `packages/agent/tests/knowledge-organizer.test.ts`: organizer policy tests.
- Create `apps/server/src/knowledge-agent/knowledge-agent.module.ts`: Nest module.
- Create `apps/server/src/knowledge-agent/knowledge-agent.controller.ts`: authenticated controller.
- Create `apps/server/src/knowledge-agent/knowledge-agent.service.ts`: Prisma aggregation and policy adapter.
- Create `apps/server/src/knowledge-agent/knowledge-agent.service.spec.ts`: service tests.
- Modify `apps/server/src/app.module.ts`: register `KnowledgeAgentModule`.
- Create `apps/web/src/lib/knowledge-agent-api.ts`: client wrapper.
- Create `apps/web/src/lib/knowledge-agent-api.test.mts`: API client tests.
- Create `apps/web/src/lib/knowledge-agent-query-keys.ts`: TanStack Query keys.
- Create `apps/web/src/lib/knowledge-agent-query-keys.test.mts`: key stability tests.
- Create `apps/web/src/lib/knowledge-agent-view.ts`: display helper.
- Create `apps/web/src/lib/knowledge-agent-view.test.mts`: display helper tests.
- Create `apps/web/src/hooks/use-knowledge-agent-suggestions.ts`: query hook.
- Modify `apps/web/src/app/(main)/knowledge/page.tsx`: render suggestions panel.
- Modify `AGENTS.md`, `docs/roadmap.md`, `docs/data-flow.md`: record Phase 6.8 boundaries.

---

### Task 1: Shared Knowledge Agent Contract

**Files:**
- Create: `packages/types/src/api/knowledge-agent.ts`
- Modify: `packages/types/src/api/index.ts`
- Modify: `packages/types/package.json`
- Test: `packages/types/tests/knowledge-agent.test.mts`

- [ ] **Step 1: Write failing schema tests**

Create `packages/types/tests/knowledge-agent.test.mts`:

```ts
import { describe, expect, it } from 'bun:test';

import {
  knowledgeAgentSuggestionQuerySchema,
  knowledgeAgentSuggestionResponseSchema,
} from '../src/api/knowledge-agent';

describe('knowledge agent API schemas', () => {
  it('normalizes suggestion query defaults from URL query values', () => {
    expect(knowledgeAgentSuggestionQuerySchema.parse({})).toEqual({
      limit: 20,
    });
    expect(
      knowledgeAgentSuggestionQuerySchema.parse({
        documentId: 'doc_1',
        limit: '50',
      }),
    ).toEqual({
      documentId: 'doc_1',
      limit: 50,
    });
  });

  it('parses read-only dedup and organizer suggestions', () => {
    const parsed = knowledgeAgentSuggestionResponseSchema.parse({
      generatedAt: '2026-06-29T00:00:00.000Z',
      dedup: {
        summary: '发现 1 条疑似新版资料。',
        items: [
          {
            kind: 'possible_revision',
            severity: 'warning',
            documentIds: ['doc_old', 'doc_new'],
            title: '疑似新版讲义',
            reason: '文件名高度相似，但内容 hash 不同。',
            recommendation: 'review_manually',
            confidence: 0.78,
            signals: ['filenameOverlap', 'differentContentHash'],
          },
        ],
        signals: ['revisionCandidate'],
      },
      organizer: {
        summary: '建议按数学讲义整理 2 份资料。',
        collections: [
          {
            name: '数学讲义',
            description: '数学相关讲义和笔记资料。',
            documentIds: ['doc_old', 'doc_new'],
            reason: '资料名称和摘要都包含数学主题。',
            confidence: 0.82,
            signals: ['subject:math', 'type:notes'],
          },
        ],
        tags: [
          {
            documentId: 'doc_new',
            labels: ['数学', '讲义'],
            reason: '从文件名识别出数学讲义。',
            confidence: 0.8,
          },
        ],
        signals: ['topicCluster'],
      },
    });

    expect(parsed.dedup.items[0]?.kind).toBe('possible_revision');
    expect(parsed.organizer.collections[0]?.name).toBe('数学讲义');
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun --cwd packages/types test knowledge-agent
```

Expected: fail because `../src/api/knowledge-agent` does not exist.

- [ ] **Step 3: Implement schema and exports**

Create `packages/types/src/api/knowledge-agent.ts` with:

```ts
import { z } from 'zod';

const numericQuerySchema = (defaultValue: number, min: number, max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'string') return Number(value);
    return value;
  }, z.number().int().min(min).max(max).default(defaultValue));

export const knowledgeDedupSuggestionKindSchema = z.enum([
  'exact_duplicate',
  'possible_revision',
  'complementary',
  'insufficient_signal',
]);

export const knowledgeDedupRecommendationSchema = z.enum([
  'use_existing',
  'replace_old',
  'keep_both',
  'review_manually',
]);

export const knowledgeAgentSuggestionQuerySchema = z
  .object({
    documentId: z.string().trim().min(1).optional(),
    limit: numericQuerySchema(20, 1, 50),
  })
  .strict();

export const knowledgeDedupItemSchema = z.object({
  kind: knowledgeDedupSuggestionKindSchema,
  severity: z.enum(['info', 'warning']),
  documentIds: z.array(z.string()).min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  recommendation: knowledgeDedupRecommendationSchema,
  confidence: z.number().min(0).max(1),
  signals: z.array(z.string()),
});

export const knowledgeDedupResultSchema = z.object({
  summary: z.string(),
  items: z.array(knowledgeDedupItemSchema),
  signals: z.array(z.string()),
});

export const knowledgeOrganizerCollectionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  documentIds: z.array(z.string()).min(1),
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1),
  signals: z.array(z.string()),
});

export const knowledgeOrganizerTagSchema = z.object({
  documentId: z.string(),
  labels: z.array(z.string()).min(1),
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const knowledgeOrganizerResultSchema = z.object({
  summary: z.string(),
  collections: z.array(knowledgeOrganizerCollectionSchema),
  tags: z.array(knowledgeOrganizerTagSchema),
  signals: z.array(z.string()),
});

export const knowledgeAgentSuggestionResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  dedup: knowledgeDedupResultSchema,
  organizer: knowledgeOrganizerResultSchema,
});

export type KnowledgeAgentSuggestionQuery = z.infer<
  typeof knowledgeAgentSuggestionQuerySchema
>;
export type KnowledgeDedupSuggestionKind = z.infer<
  typeof knowledgeDedupSuggestionKindSchema
>;
export type KnowledgeDedupRecommendation = z.infer<
  typeof knowledgeDedupRecommendationSchema
>;
export type KnowledgeDedupItem = z.infer<typeof knowledgeDedupItemSchema>;
export type KnowledgeDedupResult = z.infer<typeof knowledgeDedupResultSchema>;
export type KnowledgeOrganizerCollection = z.infer<
  typeof knowledgeOrganizerCollectionSchema
>;
export type KnowledgeOrganizerTag = z.infer<typeof knowledgeOrganizerTagSchema>;
export type KnowledgeOrganizerResult = z.infer<typeof knowledgeOrganizerResultSchema>;
export type KnowledgeAgentSuggestionResponse = z.infer<
  typeof knowledgeAgentSuggestionResponseSchema
>;
```

Modify `packages/types/src/api/index.ts`:

```ts
export * from './knowledge-agent';
```

Modify `packages/types/package.json` exports:

```json
"./api/knowledge-agent": "./src/api/knowledge-agent.ts"
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```powershell
bun --cwd packages/types test knowledge-agent
bun --cwd packages/types typecheck
```

Expected: both pass.

- [ ] **Step 5: Commit**

```powershell
git add packages/types/src/api/knowledge-agent.ts packages/types/src/api/index.ts packages/types/package.json packages/types/tests/knowledge-agent.test.mts
git commit -m "feat(types): add knowledge agent contract"
```

---

### Task 2: Deterministic Agent Policies

**Files:**
- Create: `packages/agent/src/nodes/knowledge-dedup.ts`
- Create: `packages/agent/src/nodes/knowledge-organizer.ts`
- Modify: `packages/agent/src/index.ts`
- Modify: `packages/agent/package.json`
- Test: `packages/agent/tests/knowledge-dedup.test.ts`
- Test: `packages/agent/tests/knowledge-organizer.test.ts`

- [ ] **Step 1: Write failing policy tests**

Create `packages/agent/tests/knowledge-dedup.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import { analyzeKnowledgeDedup } from '../src/nodes/knowledge-dedup';

const now = '2026-06-29T00:00:00.000Z';

describe('analyzeKnowledgeDedup', () => {
  it('detects exact duplicate documents by content hash', () => {
    const result = analyzeKnowledgeDedup({
      now,
      documents: [
        document('doc_1', '高数讲义.pdf', 'PDF', 'sha256:same'),
        document('doc_2', '高数讲义 copy.pdf', 'PDF', 'sha256:same'),
      ],
    });

    expect(result.items[0]?.kind).toBe('exact_duplicate');
    expect(result.items[0]?.recommendation).toBe('use_existing');
  });

  it('detects possible revisions by normalized filename and different hash', () => {
    const result = analyzeKnowledgeDedup({
      now,
      targetDocumentId: 'doc_2',
      documents: [
        document('doc_1', '线性代数讲义-v1.pdf', 'PDF', 'sha256:old'),
        document('doc_2', '线性代数讲义-v2.pdf', 'PDF', 'sha256:new'),
      ],
    });

    expect(result.items[0]?.kind).toBe('possible_revision');
    expect(result.items[0]?.documentIds).toEqual(['doc_2', 'doc_1']);
  });

  it('marks same-topic different documents as complementary', () => {
    const result = analyzeKnowledgeDedup({
      now,
      documents: [
        document('doc_1', '考研数学 极限讲义.pdf', 'PDF', 'sha256:a'),
        document('doc_2', '考研数学 极限练习题.pdf', 'PDF', 'sha256:b'),
      ],
    });

    expect(result.items.some((item) => item.kind === 'complementary')).toBe(true);
  });
});

function document(id: string, name: string, type: 'PDF' | 'DOCX' | 'MD' | 'TXT', contentHash: string) {
  return {
    id,
    name,
    type,
    size: 1024,
    status: 'DONE' as const,
    sourceType: 'UPLOAD' as const,
    contentHash,
    chunkCount: 3,
    processedAt: now,
    createdAt: now,
    updatedAt: now,
    chunkSummaries: [],
  };
}
```

Create `packages/agent/tests/knowledge-organizer.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import { organizeKnowledgeDocuments } from '../src/nodes/knowledge-organizer';

const now = '2026-06-29T00:00:00.000Z';

describe('organizeKnowledgeDocuments', () => {
  it('groups same subject documents into a collection', () => {
    const result = organizeKnowledgeDocuments({
      now,
      documents: [
        document('doc_1', '高等数学 导数讲义.pdf', ['导数、极限、函数']),
        document('doc_2', '高等数学 导数练习.pdf', ['导数应用题']),
      ],
    });

    expect(result.collections[0]?.name).toBe('数学资料');
    expect(result.collections[0]?.documentIds).toEqual(['doc_1', 'doc_2']);
  });

  it('returns document tags even when there is no collection', () => {
    const result = organizeKnowledgeDocuments({
      now,
      documents: [document('doc_1', '大学英语 阅读笔记.md', ['reading comprehension'])],
    });

    expect(result.collections).toEqual([]);
    expect(result.tags[0]?.labels).toContain('英语');
    expect(result.tags[0]?.labels).toContain('笔记');
  });
});

function document(id: string, name: string, chunkSummaries: string[]) {
  return {
    id,
    name,
    type: 'PDF' as const,
    size: 1024,
    status: 'DONE' as const,
    sourceType: 'UPLOAD' as const,
    contentHash: `sha256:${id}`,
    chunkCount: chunkSummaries.length,
    processedAt: now,
    createdAt: now,
    updatedAt: now,
    chunkSummaries,
  };
}
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
bun --filter @repo/agent test knowledge
```

Expected: fail because new policy modules do not exist.

- [ ] **Step 3: Implement minimal deterministic policies**

Implement exported types and functions:

```ts
export type KnowledgeAgentDocumentInput = {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'MD' | 'TXT';
  size: number;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  sourceType: 'UPLOAD' | 'NOTE' | 'WRONG_QUESTION' | 'OCR' | 'CHAT';
  contentHash: string | null;
  chunkCount: number;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  chunkSummaries: readonly string[];
};
```

`knowledge-dedup.ts` must:

- prefer target document order when `targetDocumentId` is passed
- compare non-null `contentHash`
- normalize filenames by lowercasing, removing extensions, removing `copy`, `副本`, `v1`, `v2`, version punctuation, whitespace
- compare topic tokens from filename and chunk summaries
- cap output to 5 suggestions

`knowledge-organizer.ts` must:

- infer subject labels with a deterministic keyword map
- infer resource type labels with a deterministic keyword map
- create collections only when at least two documents share a subject
- always emit tags for documents with at least one inferred label

Update exports:

```ts
export * from './nodes/knowledge-dedup.ts';
export * from './nodes/knowledge-organizer.ts';
```

Update `packages/agent/package.json`:

```json
"./knowledge-dedup": "./src/nodes/knowledge-dedup.ts",
"./knowledge-organizer": "./src/nodes/knowledge-organizer.ts"
```

- [ ] **Step 4: Run agent tests**

Run:

```powershell
bun --filter @repo/agent test knowledge
bun --filter @repo/agent typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add packages/agent/src/nodes/knowledge-dedup.ts packages/agent/src/nodes/knowledge-organizer.ts packages/agent/src/index.ts packages/agent/package.json packages/agent/tests/knowledge-dedup.test.ts packages/agent/tests/knowledge-organizer.test.ts
git commit -m "feat(agent): add knowledge management policies"
```

---

### Task 3: Server Knowledge Agent API

**Files:**
- Create: `apps/server/src/knowledge-agent/knowledge-agent.module.ts`
- Create: `apps/server/src/knowledge-agent/knowledge-agent.controller.ts`
- Create: `apps/server/src/knowledge-agent/knowledge-agent.service.ts`
- Create: `apps/server/src/knowledge-agent/knowledge-agent.service.spec.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Write failing service tests**

Create `apps/server/src/knowledge-agent/knowledge-agent.service.spec.ts` with tests that mock Prisma and verify:

```ts
it('builds read-only suggestions from current user documents and capped chunk summaries', async () => {
  prisma.document.findMany.mockResolvedValue([
    {
      id: 'doc_1',
      userId: 'user_1',
      name: '高等数学 导数讲义.pdf',
      type: 'PDF',
      size: 1024,
      mimeType: 'application/pdf',
      status: 'DONE',
      sourceType: 'UPLOAD',
      errorMessage: null,
      contentHash: 'sha256:a',
      processedAt: new Date('2026-06-28T00:00:00.000Z'),
      createdAt: new Date('2026-06-28T00:00:00.000Z'),
      updatedAt: new Date('2026-06-28T00:00:00.000Z'),
      chunks: [{ content: '导数 极限 函数', index: 0 }],
      _count: { chunks: 1 },
    },
    {
      id: 'doc_2',
      userId: 'user_1',
      name: '高等数学 导数练习.pdf',
      type: 'PDF',
      size: 2048,
      mimeType: 'application/pdf',
      status: 'DONE',
      sourceType: 'UPLOAD',
      errorMessage: null,
      contentHash: 'sha256:b',
      processedAt: new Date('2026-06-28T00:00:00.000Z'),
      createdAt: new Date('2026-06-28T00:00:00.000Z'),
      updatedAt: new Date('2026-06-28T00:00:00.000Z'),
      chunks: [{ content: '导数应用题', index: 0 }],
      _count: { chunks: 1 },
    },
  ]);

  const result = await service.getSuggestions('user_1', { limit: 20 });

  expect(prisma.document.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { userId: 'user_1' },
      take: 20,
    }),
  );
  expect(result.organizer.collections[0]?.name).toBe('数学资料');
});
```

Add a second test:

```ts
it('does not write documents, chunks, or suggestions while generating advice', async () => {
  await service.getSuggestions('user_1', { limit: 20 });

  expect(prisma.document.create).not.toHaveBeenCalled();
  expect(prisma.document.update).not.toHaveBeenCalled();
  expect(prisma.document.updateMany).not.toHaveBeenCalled();
  expect(prisma.document.delete).not.toHaveBeenCalled();
  expect(prisma.chunk.create).not.toHaveBeenCalled();
  expect(prisma.chunk.deleteMany).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun --filter @repo/server test -- knowledge-agent
```

Expected: fail because `KnowledgeAgentService` does not exist.

- [ ] **Step 3: Implement module/controller/service**

Controller:

```ts
@Controller('knowledge-agent')
@UseGuards(JwtAuthGuard)
export class KnowledgeAgentController {
  constructor(private readonly service: KnowledgeAgentService) {}

  @Get('suggestions')
  getSuggestions(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.service.getSuggestions(
      user.id,
      knowledgeAgentSuggestionQuerySchema.parse(query),
    );
  }
}
```

Service requirements:

- query documents with `where: { userId, ...(documentId ? { OR: [{ id: documentId }, {}] } : {}) }` is not acceptable because `{}` in OR is ambiguous; instead:
  - if `documentId` exists, first verify target with `findFirst({ where: { id: documentId, userId } })`
  - then fetch recent documents for same user with `findMany({ where: { userId }, take: limit })`
- select only capped chunks:

```ts
chunks: {
  select: { content: true, index: true },
  orderBy: { index: 'asc' },
  take: 3,
}
```

- map chunk content to `content.slice(0, 180)`
- call `analyzeKnowledgeDedup` and `organizeKnowledgeDocuments`
- return `KnowledgeAgentSuggestionResponse`

Register `KnowledgeAgentModule` in `AppModule`.

- [ ] **Step 4: Run server tests**

Run:

```powershell
bun --filter @repo/server test -- knowledge-agent
bun --filter @repo/server build
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/knowledge-agent apps/server/src/app.module.ts
git commit -m "feat(server): add knowledge agent suggestions api"
```

---

### Task 4: Web API, Query Keys, and View Helpers

**Files:**
- Create: `apps/web/src/lib/knowledge-agent-api.ts`
- Create: `apps/web/src/lib/knowledge-agent-api.test.mts`
- Create: `apps/web/src/lib/knowledge-agent-query-keys.ts`
- Create: `apps/web/src/lib/knowledge-agent-query-keys.test.mts`
- Create: `apps/web/src/lib/knowledge-agent-view.ts`
- Create: `apps/web/src/lib/knowledge-agent-view.test.mts`
- Create: `apps/web/src/hooks/use-knowledge-agent-suggestions.ts`

- [ ] **Step 1: Write failing web tests**

Create `apps/web/src/lib/knowledge-agent-api.test.mts`:

```ts
import { describe, expect, it } from 'bun:test';

import { createKnowledgeAgentApi } from './knowledge-agent-api';

describe('knowledge agent api', () => {
  it('builds suggestion query params and parses response', async () => {
    const calls: string[] = [];
    const api = createKnowledgeAgentApi({
      get: async (path) => {
        calls.push(path);
        return {
          generatedAt: '2026-06-29T00:00:00.000Z',
          dedup: { summary: '', items: [], signals: [] },
          organizer: { summary: '', collections: [], tags: [], signals: [] },
        };
      },
    });

    await api.getSuggestions('token', { documentId: 'doc_1', limit: 30 });

    expect(calls[0]).toBe('/knowledge-agent/suggestions?limit=30&documentId=doc_1');
  });
});
```

Create `apps/web/src/lib/knowledge-agent-view.test.mts`:

```ts
import { describe, expect, it } from 'bun:test';

import {
  getKnowledgeAgentEmptyMessage,
  getKnowledgeDedupTone,
  getKnowledgeOrganizerCollectionSummary,
} from './knowledge-agent-view';

describe('knowledge agent view helpers', () => {
  it('uses a clear empty message when suggestions have no signal', () => {
    expect(getKnowledgeAgentEmptyMessage()).toContain('处理更多资料');
  });

  it('maps warning dedup suggestions to danger tone', () => {
    expect(getKnowledgeDedupTone({ severity: 'warning' })).toBe('warning');
  });

  it('summarizes collection document counts', () => {
    expect(
      getKnowledgeOrganizerCollectionSummary({
        name: '数学资料',
        documentIds: ['doc_1', 'doc_2'],
      }),
    ).toBe('数学资料 · 2 份资料');
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
bun --filter @repo/web test -- knowledge-agent
```

Expected: fail because helper modules do not exist.

- [ ] **Step 3: Implement API, query keys, view helpers, hook**

`knowledge-agent-api.ts`:

```ts
import {
  knowledgeAgentSuggestionQuerySchema,
  knowledgeAgentSuggestionResponseSchema,
  type KnowledgeAgentSuggestionQuery,
} from '@repo/types/api/knowledge-agent';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

export function createKnowledgeAgentApi(client: ApiClient) {
  return {
    async getSuggestions(accessToken: string, query: KnowledgeAgentSuggestionQuery) {
      const parsed = knowledgeAgentSuggestionQuerySchema.parse(query);
      const params = new URLSearchParams();
      params.set('limit', String(parsed.limit));
      if (parsed.documentId) params.set('documentId', parsed.documentId);

      return knowledgeAgentSuggestionResponseSchema.parse(
        await client.get<unknown>(`/knowledge-agent/suggestions?${params.toString()}`, {
          accessToken,
        }),
      );
    },
  };
}
```

`knowledge-agent-query-keys.ts`:

```ts
import type { KnowledgeAgentSuggestionQuery } from '@repo/types/api/knowledge-agent';

export const knowledgeAgentQueryKeys = {
  all: ['knowledge-agent'] as const,
  suggestions: (userId: string, query: KnowledgeAgentSuggestionQuery) =>
    [...knowledgeAgentQueryKeys.all, 'suggestions', userId, query] as const,
};
```

`use-knowledge-agent-suggestions.ts` follows `use-review-agent-suggestions.ts` style.

- [ ] **Step 4: Run web tests**

Run:

```powershell
bun --filter @repo/web test -- knowledge-agent
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/knowledge-agent-api.ts apps/web/src/lib/knowledge-agent-api.test.mts apps/web/src/lib/knowledge-agent-query-keys.ts apps/web/src/lib/knowledge-agent-query-keys.test.mts apps/web/src/lib/knowledge-agent-view.ts apps/web/src/lib/knowledge-agent-view.test.mts apps/web/src/hooks/use-knowledge-agent-suggestions.ts
git commit -m "feat(web): add knowledge agent client helpers"
```

---

### Task 5: Knowledge Page Suggestions Panel

**Files:**
- Modify: `apps/web/src/app/(main)/knowledge/page.tsx`
- Test: `apps/web/src/lib/knowledge-agent-view.test.mts`

- [ ] **Step 1: Add failing display helper test for panel readiness**

Extend `knowledge-agent-view.test.mts`:

```ts
it('detects whether there is anything actionable to render', () => {
  expect(
    hasKnowledgeAgentSuggestions({
      dedup: { summary: '', items: [], signals: [] },
      organizer: { summary: '', collections: [], tags: [], signals: [] },
    }),
  ).toBe(false);

  expect(
    hasKnowledgeAgentSuggestions({
      dedup: {
        summary: '',
        items: [
          {
            kind: 'complementary',
            severity: 'info',
            documentIds: ['doc_1', 'doc_2'],
            title: '同主题互补资料',
            reason: '主题相近。',
            recommendation: 'keep_both',
            confidence: 0.7,
            signals: [],
          },
        ],
        signals: [],
      },
      organizer: { summary: '', collections: [], tags: [], signals: [] },
    }),
  ).toBe(true);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun --filter @repo/web test -- knowledge-agent-view
```

Expected: fail because `hasKnowledgeAgentSuggestions` is not implemented.

- [ ] **Step 3: Implement helper and page panel**

In page:

- import `Brain`, `Layers`, or existing lucide icons
- import `useKnowledgeAgentSuggestions`
- call `useKnowledgeAgentSuggestions({ limit: 20 })`
- render panel after `KnowledgeSummaryCard`
- panel states:
  - loading: compact `LoadingPanel`
  - error: compact warning text, no retry button required
  - empty: message from `getKnowledgeAgentEmptyMessage()`
  - suggestions: list dedup items and collection cards

Do not add action buttons that mutate data.

- [ ] **Step 4: Run focused web tests and build**

Run:

```powershell
bun --filter @repo/web test -- knowledge-agent
bun --filter @repo/web build
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add 'apps/web/src/app/(main)/knowledge/page.tsx' apps/web/src/lib/knowledge-agent-view.ts apps/web/src/lib/knowledge-agent-view.test.mts
git commit -m "feat(web): show knowledge agent suggestions"
```

---

### Task 6: Documentation and Final Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/data-flow.md`
- Optional create: `docs/dev-blog/2026-06-29-phase-6-8-knowledge-agents.md`

- [ ] **Step 1: Update docs**

Document:

- Phase 6.8 completed scope.
- `KnowledgeDedupAgent / KnowledgeOrganizerAgent` are deterministic policy and read-only suggestions.
- `/knowledge-agent/suggestions` is authenticated and user-scoped.
- No automatic delete/merge/classification writes.
- Suggestions do not enter Dexie `mutationQueue`.

- [ ] **Step 2: Run final verification**

Run:

```powershell
bun --filter @repo/agent test
bun --cwd packages/types typecheck
bun --filter @repo/server test
bun --filter @repo/server build
bun --filter @repo/web test
bun --filter @repo/web build
git diff --check
```

Expected: all commands pass. Do not run `bun --filter @repo/server lint` unless explicitly requested, because the repo notes warn it may apply `--fix` and mutate unrelated files.

- [ ] **Step 3: Commit docs**

```powershell
git add AGENTS.md docs/roadmap.md docs/data-flow.md docs/dev-blog/2026-06-29-phase-6-8-knowledge-agents.md
git commit -m "docs: record phase 6.8 knowledge agents"
```

- [ ] **Step 4: Push branch**

Run:

```powershell
git push -u origin codex/phase-6-8-knowledge-agents
```

Expected: branch pushed successfully.
