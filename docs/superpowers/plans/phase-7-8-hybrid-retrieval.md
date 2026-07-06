# Phase 7.8.2 Hybrid Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `/knowledge/search` from pure vector retrieval to a first-pass hybrid retrieval flow that merges vector and keyword candidates.

**Architecture:** Keep the API contract stable. Add a pure `mergeHybridSearchRows()` helper with deterministic tests, then update `KnowledgeSearchService` to execute vector and keyword SQL candidate queries and feed both into the helper.

**Tech Stack:** NestJS 11, TypeScript, Jest, Prisma raw SQL, PostgreSQL pgvector, PostgreSQL full-text search.

---

## File Structure

- Create `apps/server/src/knowledge-documents/hybrid-search.ts`
  - Owns candidate row types, final scoring, dedupe, sorting, filtering, and metadata enrichment.
- Create `apps/server/src/knowledge-documents/hybrid-search.spec.ts`
  - Tests pure hybrid scoring behavior.
- Modify `apps/server/src/knowledge-documents/knowledge-search.service.ts`
  - Runs vector and keyword candidate SQL, then calls `mergeHybridSearchRows()`.
- Modify `apps/server/src/knowledge-documents/knowledge-search.service.spec.ts`
  - Updates search service tests for two SQL calls and hybrid metadata.
- Modify `AGENTS.md`, `DEVLOG.md`, `docs/ai-behavior-acceptance.md`
  - Records Phase 7.8.2 boundaries and verification.

---

## Task 1: Add Pure Hybrid Merge Helper

**Files:**
- Create: `apps/server/src/knowledge-documents/hybrid-search.spec.ts`
- Create: `apps/server/src/knowledge-documents/hybrid-search.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/server/src/knowledge-documents/hybrid-search.spec.ts`:

```ts
import { mergeHybridSearchRows } from './hybrid-search';

describe('mergeHybridSearchRows', () => {
  it('deduplicates rows and keeps the highest vector and keyword scores', () => {
    const hits = mergeHybridSearchRows({
      vectorRows: [
        row('chunk_1', { vectorScore: 0.72, keywordScore: 0 }),
        row('chunk_2', { vectorScore: 0.8, keywordScore: 0 }),
      ],
      keywordRows: [
        row('chunk_1', { vectorScore: 0.7, keywordScore: 0.9 }),
      ],
      topK: 5,
      minScore: 0,
    });

    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({
      chunkId: 'chunk_1',
      score: 0.855,
      metadata: {
        retrieval: {
          mode: 'hybrid',
          vectorScore: 0.72,
          keywordScore: 0.9,
        },
      },
    });
  });

  it('lets keyword-only exact candidates pass the min score threshold', () => {
    const hits = mergeHybridSearchRows({
      vectorRows: [],
      keywordRows: [
        row('chunk_keyword', { vectorScore: 0.31, keywordScore: 1 }),
      ],
      topK: 5,
      minScore: 0.7,
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.chunkId).toBe('chunk_keyword');
    expect(hits[0]?.score).toBe(0.95);
  });

  it('sorts by final score and applies topK', () => {
    const hits = mergeHybridSearchRows({
      vectorRows: [
        row('chunk_a', { vectorScore: 0.7, keywordScore: 0 }),
        row('chunk_b', { vectorScore: 0.95, keywordScore: 0 }),
      ],
      keywordRows: [
        row('chunk_c', { vectorScore: 0.5, keywordScore: 1 }),
      ],
      topK: 2,
      minScore: 0,
    });

    expect(hits.map((hit) => hit.chunkId)).toEqual(['chunk_b', 'chunk_c']);
  });

  it('filters rows below minScore after hybrid scoring', () => {
    const hits = mergeHybridSearchRows({
      vectorRows: [row('chunk_low', { vectorScore: 0.2, keywordScore: 0 })],
      keywordRows: [],
      topK: 5,
      minScore: 0.7,
    });

    expect(hits).toEqual([]);
  });
});

function row(
  chunkId: string,
  scores: { vectorScore: number; keywordScore: number },
) {
  return {
    chunkId,
    documentId: 'doc_1',
    documentName: 'notes.txt',
    content: `${chunkId} content`,
    metadata: { safety: { riskLevel: 'low' } },
    vectorScore: scores.vectorScore,
    keywordScore: scores.keywordScore,
  };
}
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun --filter @repo/server test -- hybrid-search
```

Expected: FAIL because `./hybrid-search` does not exist.

- [ ] **Step 3: Implement helper**

Create `apps/server/src/knowledge-documents/hybrid-search.ts`:

```ts
import type { KnowledgeSearchHit } from '@repo/types/api/knowledge';

export type HybridSearchRow = {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  metadata: unknown;
  vectorScore: number | string | null;
  keywordScore: number | string | null;
};

type MergeHybridSearchRowsInput = {
  vectorRows: HybridSearchRow[];
  keywordRows: HybridSearchRow[];
  topK: number;
  minScore: number;
};

type MergedHybridRow = {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  metadata: Record<string, unknown>;
  vectorScore: number;
  keywordScore: number;
  score: number;
};

export function mergeHybridSearchRows(
  input: MergeHybridSearchRowsInput,
): KnowledgeSearchHit[] {
  const merged = new Map<string, MergedHybridRow>();

  for (const row of [...input.vectorRows, ...input.keywordRows]) {
    const vectorScore = toScore(row.vectorScore);
    const keywordScore = toScore(row.keywordScore);
    const existing = merged.get(row.chunkId);

    if (!existing) {
      const metadata = toMetadataRecord(row.metadata);
      merged.set(row.chunkId, {
        chunkId: row.chunkId,
        documentId: row.documentId,
        documentName: row.documentName,
        content: row.content,
        metadata,
        vectorScore,
        keywordScore,
        score: calculateHybridScore(vectorScore, keywordScore),
      });
      continue;
    }

    existing.vectorScore = Math.max(existing.vectorScore, vectorScore);
    existing.keywordScore = Math.max(existing.keywordScore, keywordScore);
    existing.score = calculateHybridScore(existing.vectorScore, existing.keywordScore);
  }

  return [...merged.values()]
    .filter((row) => row.score >= input.minScore)
    .sort(compareMergedRows)
    .slice(0, input.topK)
    .map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      documentName: row.documentName,
      content: row.content,
      score: row.score,
      metadata: {
        ...row.metadata,
        retrieval: {
          mode: 'hybrid',
          vectorScore: row.vectorScore,
          keywordScore: row.keywordScore,
        },
      },
    }));
}

function calculateHybridScore(vectorScore: number, keywordScore: number) {
  return clampScore(
    Math.max(
      vectorScore,
      keywordScore * 0.95,
      vectorScore * 0.7 + keywordScore * 0.3,
    ),
  );
}

function compareMergedRows(left: MergedHybridRow, right: MergedHybridRow) {
  return (
    right.score - left.score ||
    right.keywordScore - left.keywordScore ||
    right.vectorScore - left.vectorScore ||
    left.documentName.localeCompare(right.documentName) ||
    left.chunkId.localeCompare(right.chunkId)
  );
}

function toScore(value: number | string | null) {
  const score = Number(value ?? 0);
  if (!Number.isFinite(score)) return 0;
  return clampScore(score);
}

function clampScore(score: number) {
  return Math.max(0, Math.min(1, Number(score.toFixed(6))));
}

function toMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (
    typeof metadata === 'object' &&
    metadata !== null &&
    !Array.isArray(metadata)
  ) {
    return metadata as Record<string, unknown>;
  }

  return {};
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
bun --filter @repo/server test -- hybrid-search
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/server/src/knowledge-documents/hybrid-search.ts apps/server/src/knowledge-documents/hybrid-search.spec.ts
git commit -m "feat(server): add hybrid search scoring"
```

Expected: commit succeeds.

---

## Task 2: Integrate Hybrid Retrieval into Knowledge Search

**Files:**
- Modify: `apps/server/src/knowledge-documents/knowledge-search.service.ts`
- Modify: `apps/server/src/knowledge-documents/knowledge-search.service.spec.ts`

- [ ] **Step 1: Update service tests first**

Edit `apps/server/src/knowledge-documents/knowledge-search.service.spec.ts` so the first mapping test mocks two SQL calls:

```ts
prisma.$queryRaw
  .mockResolvedValueOnce([
    {
      chunkId: 'chunk_vector',
      documentId: 'doc_1',
      documentName: 'calculus.md',
      content: 'Green theorem converts a line integral into a double integral.',
      vectorScore: 0.91,
      keywordScore: 0,
      metadata: { sectionTitle: 'Green theorem' },
    },
  ])
  .mockResolvedValueOnce([
    {
      chunkId: 'chunk_keyword',
      documentId: 'doc_1',
      documentName: 'calculus.md',
      content: 'Green theorem exact keyword note.',
      vectorScore: 0.6,
      keywordScore: 1,
      metadata: { sectionTitle: 'Green theorem' },
    },
  ]);
```

Assert:

```ts
expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
expect(result.hits.map((hit) => hit.chunkId)).toEqual([
  'chunk_keyword',
  'chunk_vector',
]);
expect(result.hits[0]?.metadata).toMatchObject({
  retrieval: {
    mode: 'hybrid',
    vectorScore: 0.6,
    keywordScore: 1,
  },
});
```

Update existing tests that mock one SQL result so they mock the vector call first and keyword call second.

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun --filter @repo/server test -- knowledge-search.service
```

Expected: FAIL because service still only performs one query and expects `score`.

- [ ] **Step 3: Update service implementation**

Modify `apps/server/src/knowledge-documents/knowledge-search.service.ts`:

- Replace `KnowledgeSearchRow` with imported `HybridSearchRow`.
- Import `mergeHybridSearchRows`.
- Compute `candidateLimit = Math.min(input.topK * 4, 50)`.
- Execute vector SQL and keyword SQL.
- Return `mergeHybridSearchRows({ vectorRows, keywordRows, topK: input.topK, minScore: input.minScore })`.

The keyword SQL should use:

```sql
WITH keyword_query AS (
  SELECT websearch_to_tsquery('simple', ${input.query}) AS query
)
SELECT
  c.id AS "chunkId",
  c."documentId" AS "documentId",
  d.name AS "documentName",
  c.content AS content,
  c.metadata AS metadata,
  (1 - (c.embedding <=> ${queryVector}::vector))::float AS "vectorScore",
  ts_rank_cd(
    to_tsvector('simple', coalesce(d.name, '') || ' ' || coalesce(c.content, '')),
    keyword_query.query
  )::float AS "keywordScore"
FROM "Chunk" c
JOIN "Document" d ON d.id = c."documentId"
CROSS JOIN keyword_query
WHERE
  c."userId" = ${userId}
  AND d."userId" = ${userId}
  AND d.status = 'DONE'
  AND c.embedding IS NOT NULL
  AND keyword_query.query @@ to_tsvector('simple', coalesce(d.name, '') || ' ' || coalesce(c.content, ''))
ORDER BY "keywordScore" DESC, "vectorScore" DESC
LIMIT ${candidateLimit}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
bun --filter @repo/server test -- knowledge-search.service
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/server/src/knowledge-documents/knowledge-search.service.ts apps/server/src/knowledge-documents/knowledge-search.service.spec.ts
git commit -m "feat(server): use hybrid knowledge search"
```

Expected: commit succeeds.

---

## Task 3: Update Docs and Verify

**Files:**
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/ai-behavior-acceptance.md`

- [ ] **Step 1: Update docs**

Record Phase 7.8.2 as completed, including:

- `/knowledge/search` now uses vector + PostgreSQL full-text keyword candidates.
- API contract remains unchanged.
- `metadata.retrieval` contains `mode`, `vectorScore`, and `keywordScore`.
- First version has no GIN index and no external search engine.
- Live Chat smoke is not required unless Chat prompt or model output changes.

- [ ] **Step 2: Run verification**

Run:

```powershell
bun --filter @repo/server test -- hybrid-search
bun --filter @repo/server test -- knowledge-search.service
bun --filter @repo/server test -- rag-eval-runner
bun --filter @repo/server build
git diff --check
```

Expected: all pass.

- [ ] **Step 3: Commit**

Run:

```powershell
git add AGENTS.md DEVLOG.md docs/ai-behavior-acceptance.md
git commit -m "docs: record hybrid retrieval"
```

Expected: commit succeeds.

---

## Self-Review

- Spec coverage: The plan covers vector candidates, keyword candidates, merge, scoring, metadata, docs, and verification.
- Completeness scan: No unresolved markers or unspecified implementation steps remain.
- Type consistency: `HybridSearchRow` is defined before service integration and maps to `KnowledgeSearchHit`.
- Scope check: tsvector indexes, external search engines, rerankers, UI changes, and Chat prompt changes remain deferred.
