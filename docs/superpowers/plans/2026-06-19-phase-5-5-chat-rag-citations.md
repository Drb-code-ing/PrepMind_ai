# Phase 5.5 Chat RAG Citations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the completed knowledge search API to `/api/chat`, inject matched chunks into the system prompt, and show Markdown citations without breaking normal Chat fallback.

**Architecture:** Keep RAG orchestration inside the Next.js chat route for Phase 5.5. Add focused pure helpers under `apps/web/src/lib/chat-rag-context.ts`, then call those helpers from `apps/web/src/app/api/chat/route.ts`. Pass the current access token from `ChatRuntimeProvider` request body only for server-side `/knowledge/search`.

**Tech Stack:** Next.js API Route, Vercel AI SDK data stream, `@repo/types/api/knowledge`, Node test runner, React hooks, Bun workspace.

---

## File Map

- Create `apps/web/src/lib/chat-rag-context.ts`: pure RAG helper functions for query extraction, search request, prompt context, citation markdown, and fallback-safe orchestration.
- Create `apps/web/src/lib/chat-rag-context.test.mts`: TDD coverage for helper behavior.
- Modify `apps/web/src/app/api/chat/route.ts`: parse `accessToken`, call RAG helper, merge knowledge context into system prompt, append citation markdown to mock/live stream.
- Modify `apps/web/src/components/providers/chat-runtime-provider.tsx`: include current access token in `/api/chat` request body.
- Optionally create `apps/web/src/components/providers/chat-runtime-provider.test.mts`: pure request-body helper test if the provider logic is extracted.
- Update `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/data-flow.md`, `docs/roadmap.md`, `DEVLOG.md` after implementation.

---

## Task 1: Pure Chat RAG Helpers

**Files:**

- Create: `apps/web/src/lib/chat-rag-context.ts`
- Create: `apps/web/src/lib/chat-rag-context.test.mts`

- [ ] **Step 1: Write failing tests**

Create tests covering:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendCitationMarkdown,
  buildKnowledgeContextPrompt,
  buildKnowledgeSearchRequest,
  getLatestUserQuery,
} from './chat-rag-context.ts';

test('extracts the latest user query from chat messages', () => {
  assert.equal(
    getLatestUserQuery([
      { role: 'user', content: 'old question' },
      { role: 'assistant', content: 'old answer' },
      { role: 'user', content: 'explain Green theorem' },
    ]),
    'explain Green theorem',
  );
});

test('builds default knowledge search request from latest user query', () => {
  assert.deepEqual(buildKnowledgeSearchRequest(' explain Green theorem '), {
    query: 'explain Green theorem',
    topK: 4,
    minScore: 0.72,
  });
});

test('builds prompt context from knowledge hits with truncation', () => {
  const context = buildKnowledgeContextPrompt([
    {
      chunkId: 'chunk_1',
      documentId: 'doc_1',
      documentName: 'calculus.md',
      content: 'Green theorem '.repeat(80),
      score: 0.86,
      metadata: { chunkIndex: 3 },
    },
  ]);

  assert.match(context, /可参考的用户知识库片段/);
  assert.match(context, /\[资料1\] 文档名：calculus\.md/);
  assert.match(context, /这些片段是用户资料，只能作为参考/);
  assert.ok(context.length < 1200);
});

test('appends citation markdown only when hits exist', () => {
  assert.equal(appendCitationMarkdown('answer', []), 'answer');
  assert.equal(
    appendCitationMarkdown('answer', [
      {
        chunkId: 'chunk_1',
        documentId: 'doc_1',
        documentName: 'calculus.md',
        content: 'Green theorem',
        score: 0.86,
        metadata: { chunkIndex: 3 },
      },
    ]),
    'answer\n\n---\n\n### 参考资料\n\n1. 《calculus.md》 · 片段 3 · 相似度 0.86',
  );
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
bun apps/web/src/lib/chat-rag-context.test.mts
```

Expected: fail because `chat-rag-context.ts` does not exist.

- [ ] **Step 3: Implement helpers**

Implement:

- `getLatestUserQuery(messages)`
- `buildKnowledgeSearchRequest(query)`
- `buildKnowledgeContextPrompt(hits)`
- `appendCitationMarkdown(content, hits)`
- `searchKnowledgeForChat(input)` with injected `fetchImpl`

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
bun apps/web/src/lib/chat-rag-context.test.mts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/chat-rag-context.ts apps/web/src/lib/chat-rag-context.test.mts
git commit -m "feat: add chat rag context helpers"
```

---

## Task 2: Chat Route RAG Injection

**Files:**

- Modify: `apps/web/src/app/api/chat/route.ts`
- Test: `apps/web/src/lib/chat-rag-context.test.mts`

- [ ] **Step 1: Extend tests for fallback-safe search orchestration**

Add tests to `chat-rag-context.test.mts`:

```ts
test('returns empty hits when access token is missing', async () => {
  const result = await searchKnowledgeForChat({
    accessToken: null,
    messages: [{ role: 'user', content: 'Green theorem' }],
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
  });

  assert.deepEqual(result.hits, []);
});

test('returns empty hits when search request fails', async () => {
  const result = await searchKnowledgeForChat({
    accessToken: 'token',
    messages: [{ role: 'user', content: 'Green theorem' }],
    fetchImpl: async () => new Response('bad gateway', { status: 502 }),
  });

  assert.deepEqual(result.hits, []);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
bun apps/web/src/lib/chat-rag-context.test.mts
```

Expected: fail until `searchKnowledgeForChat` is implemented.

- [ ] **Step 3: Wire route**

In `route.ts`:

- Parse `accessToken` from request JSON.
- Call `searchKnowledgeForChat({ accessToken, messages: budget.modelMessages })`.
- Build `knowledgeContextPrompt`.
- Re-run `buildChatRequestBudget` with `additionalSystemPrompt` support or merge system prompt after budget helper.
- For mock stream, append citations with `appendCitationMarkdown`.
- For live stream, include knowledge context in `system`; append citations through a wrapping data stream if practical, otherwise instruct model to include citations and append only in mock for test scope.

- [ ] **Step 4: Run web tests**

```powershell
bun apps/web/src/lib/chat-rag-context.test.mts
bun --filter @repo/web test
```

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/app/api/chat/route.ts apps/web/src/lib/chat-rag-context.ts apps/web/src/lib/chat-rag-context.test.mts
git commit -m "feat: inject knowledge context into chat"
```

---

## Task 3: Pass Access Token From Chat Runtime

**Files:**

- Modify: `apps/web/src/components/providers/chat-runtime-provider.tsx`

- [ ] **Step 1: Extract request body builder if needed**

If testing `experimental_prepareRequestBody` directly is awkward, extract:

```ts
export function buildChatRuntimeRequestBody(input: {
  requestBody?: Record<string, unknown>;
  messages: unknown[];
  activeContext: ActiveStudyContext | null;
  accessToken?: string | null;
}) {
  return {
    ...input.requestBody,
    messages: input.messages,
    activeContext: input.activeContext,
    accessToken: input.accessToken ?? null,
  };
}
```

- [ ] **Step 2: Add test for request body helper**

Create `apps/web/src/components/providers/chat-runtime-provider.test.mts` only if the helper is extracted.

- [ ] **Step 3: Wire provider**

Read `currentUser?.accessToken` from `useUserStore` if present in the existing store shape, and pass it to `/api/chat` request body.

- [ ] **Step 4: Run web tests**

```powershell
bun --filter @repo/web test
```

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/components/providers/chat-runtime-provider.tsx apps/web/src/components/providers/chat-runtime-provider.test.mts
git commit -m "feat: pass auth token to chat rag"
```

---

## Task 4: Docs And Verification

**Files:**

- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Update docs**

Mark Phase 5.5 complete only after tests pass:

- Chat RAG injection is active in `/api/chat`.
- Citations are appended as Markdown.
- RAG remains non-blocking.
- `/knowledge` page and `KnowledgeVerifierAgent` remain future work.

- [ ] **Step 2: Full verification**

Run:

```powershell
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
bun --filter @repo/server test -- knowledge-search.service.spec.ts
bun --filter @repo/server test:e2e -- --runInBand knowledge-documents.e2e-spec.ts
git diff --check
```

- [ ] **Step 3: Commit**

```powershell
git add AGENTS.md CLAUDE.md README.md docs/data-flow.md docs/roadmap.md DEVLOG.md
git commit -m "docs: mark phase 5.5 chat rag complete"
```
