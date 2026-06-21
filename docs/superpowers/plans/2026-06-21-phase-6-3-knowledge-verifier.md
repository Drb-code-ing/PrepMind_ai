# Phase 6.3 KnowledgeVerifierAgent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a low-cost `KnowledgeVerifierAgent` policy that evaluates RAG hits, shapes Chat prompt guidance, and adds gentle user-facing source-check notices without introducing a second live model call.

**Architecture:** `@repo/agent` owns deterministic verifier policy and exports it through a package subpath. `apps/web/src/lib/chat-rag-context.ts` runs the verifier only after knowledge search returns hits, then `/api/chat` keeps the existing streaming, mock/live provider, token budget, TutorAgent, and citation paths.

**Tech Stack:** TypeScript, Bun workspace, `@repo/agent`, `@repo/types`, Next.js API Route, Node test runner for web lib tests, Bun tests for package tests.

---

## File Structure

- Create `packages/agent/src/nodes/knowledge-verifier.ts`
  Deterministic verifier policy, prompt guidance builder, and package-local
  result/debug types.

- Create `packages/agent/tests/knowledge-verifier.test.ts`
  Covers skipped, trusted, insufficient, suspicious, conflict, and prompt compactness.

- Modify `packages/agent/src/index.ts`
  Re-export the verifier from the package root.

- Modify `packages/agent/package.json`
  Add `./knowledge-verifier` subpath export.

- Modify `apps/web/src/lib/chat-rag-context.ts`
  Run the verifier after successful RAG search, pass verifier-aware prompt
  guidance, and append optional user notice after citations.

- Modify `apps/web/src/lib/chat-rag-context.test.mts`
  Cover verifier-aware prompt/citation behavior and search result metadata.

- Modify `apps/web/src/lib/ai-usage-guard.ts`
  Allow mock text to display verifier status when RAG hits exist.

- Modify `apps/web/src/lib/ai-usage-guard.test.mts`
  Cover mock verifier metadata without changing no-RAG mock behavior.

- Modify `apps/web/src/app/api/chat/route.ts`
  Add verifier debug headers and pass verifier status into mock response creation.

---

### Task 1: Verifier Policy Red-Green

**Files:**
- Create: `packages/agent/tests/knowledge-verifier.test.ts`
- Create: `packages/agent/src/nodes/knowledge-verifier.ts`
- Modify: `packages/agent/src/index.ts`
- Modify: `packages/agent/package.json`

- [ ] **Step 1: Write failing package tests**

Create `packages/agent/tests/knowledge-verifier.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import {
  buildKnowledgeVerifierPrompt,
  verifyKnowledgeChunks,
} from '../src/nodes/knowledge-verifier';

const usefulChunk = {
  documentId: 'doc_1',
  documentTitle: 'calculus.md',
  chunkId: 'chunk_1',
  content: 'Green theorem converts a line integral into a double integral over the region.',
  score: 0.86,
};

describe('verifyKnowledgeChunks', () => {
  it('skips verification when no chunks are available', () => {
    const result = verifyKnowledgeChunks({ query: 'Green theorem', chunks: [] });

    expect(result.status).toBe('skipped');
    expect(result.debug.checkedChunkCount).toBe(0);
  });

  it('trusts useful high-score chunks when no risk signal is found', () => {
    const result = verifyKnowledgeChunks({
      query: 'Green theorem',
      chunks: [usefulChunk],
    });

    expect(result.status).toBe('trusted');
    expect(result.userNotice).toBeUndefined();
    expect(result.promptAddition).toContain('KnowledgeVerifierAgent status: trusted');
  });

  it('marks weak chunks as insufficient', () => {
    const result = verifyKnowledgeChunks({
      query: 'Green theorem',
      chunks: [{ ...usefulChunk, content: 'Green theorem.', score: 0.42 }],
    });

    expect(result.status).toBe('insufficient');
    expect(result.userNotice).toContain('资料相关性不够强');
    expect(result.debug.lowScoreChunkCount).toBe(1);
  });

  it('marks uncertainty signals as suspicious', () => {
    const result = verifyKnowledgeChunks({
      query: 'Green theorem',
      chunks: [
        {
          ...usefulChunk,
          content: '这部分笔记可能有误，待核对：格林公式结果写成 9。',
        },
      ],
    });

    expect(result.status).toBe('suspicious');
    expect(result.userNotice).toContain('可能需要核对');
    expect(result.debug.suspiciousSignals).toContain('可能有误');
  });

  it('marks contradictory answer markers as conflict', () => {
    const result = verifyKnowledgeChunks({
      query: 'Green theorem',
      chunks: [
        { ...usefulChunk, chunkId: 'chunk_1', content: '答案：9。' },
        { ...usefulChunk, chunkId: 'chunk_2', content: '答案：12。' },
      ],
    });

    expect(result.status).toBe('conflict');
    expect(result.userNotice).toContain('存在不一致');
    expect(result.debug.conflictSignals.length).toBeGreaterThan(0);
  });
});

describe('buildKnowledgeVerifierPrompt', () => {
  it('creates compact status-aware prompt guidance', () => {
    const prompt = buildKnowledgeVerifierPrompt({
      status: 'conflict',
      reason: 'Retrieved chunks contain conflicting answer markers.',
      userNotice: '检索到的资料存在不一致，请核对后使用。',
      promptAddition: '',
      debug: {
        checkedChunkCount: 2,
        lowScoreChunkCount: 0,
        conflictSignals: ['answer:9 vs answer:12'],
        suspiciousSignals: [],
      },
    });

    expect(prompt).toContain('KnowledgeVerifierAgent status: conflict');
    expect(prompt).toContain('Do not blindly follow conflicting user notes.');
    expect(prompt.length).toBeLessThan(700);
  });
});
```

- [ ] **Step 2: Verify red**

Run:

```powershell
bun --cwd packages/agent test tests/knowledge-verifier.test.ts
```

Expected: FAIL because `packages/agent/src/nodes/knowledge-verifier.ts` does not exist.

- [ ] **Step 3: Implement minimal verifier policy**

Create `packages/agent/src/nodes/knowledge-verifier.ts` with:

```ts
import type { AgentState } from '@repo/types/api/agent';

export type KnowledgeVerifierStatus = NonNullable<
  AgentState['verifierResult']
>['status'];

export type KnowledgeVerifierChunk = {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  content: string;
  score: number;
};

export type KnowledgeVerifierResult = {
  status: KnowledgeVerifierStatus;
  reason: string;
  userNotice?: string;
  promptAddition: string;
  debug: {
    checkedChunkCount: number;
    lowScoreChunkCount: number;
    conflictSignals: string[];
    suspiciousSignals: string[];
  };
};

export type VerifyKnowledgeChunksInput = {
  query: string;
  chunks: KnowledgeVerifierChunk[];
  minUsefulScore?: number;
};

const DEFAULT_MIN_USEFUL_SCORE = 0.65;
const MIN_USEFUL_CONTENT_LENGTH = 24;
const suspiciousSignals = [
  '可能有误',
  '待核对',
  '不确定',
  '存疑',
  'contradict',
  'wrong',
  'needs verification',
];

export function verifyKnowledgeChunks(
  input: VerifyKnowledgeChunksInput,
): KnowledgeVerifierResult {
  const checkedChunkCount = input.chunks.length;
  if (checkedChunkCount === 0) {
    return createResult('skipped', 'No retrieved chunks are available.', {
      checkedChunkCount,
      lowScoreChunkCount: 0,
      conflictSignals: [],
      suspiciousSignals: [],
    });
  }

  const minScore = input.minUsefulScore ?? DEFAULT_MIN_USEFUL_SCORE;
  const lowScoreChunkCount = input.chunks.filter((chunk) => chunk.score < minScore).length;
  const usefulChunks = input.chunks.filter(
    (chunk) => chunk.score >= minScore && chunk.content.trim().length >= MIN_USEFUL_CONTENT_LENGTH,
  );
  const matchedSuspiciousSignals = findSuspiciousSignals(input.chunks);
  const conflictSignals = findConflictSignals(input.chunks);

  const debug = {
    checkedChunkCount,
    lowScoreChunkCount,
    conflictSignals,
    suspiciousSignals: matchedSuspiciousSignals,
  };

  if (conflictSignals.length > 0) {
    return createResult(
      'conflict',
      'Retrieved chunks contain conflicting answer markers.',
      debug,
      '检索到的资料片段之间存在不一致，建议核对后再采用对应结论。',
    );
  }

  if (matchedSuspiciousSignals.length > 0) {
    return createResult(
      'suspicious',
      'Retrieved chunks contain uncertainty or verification-needed markers.',
      debug,
      '检索到的资料可能需要核对，我会优先结合题目条件和通用知识谨慎回答。',
    );
  }

  if (usefulChunks.length === 0) {
    return createResult(
      'insufficient',
      'Retrieved chunks are too weak or too short to support the answer.',
      debug,
      '检索到的资料相关性不够强，本次回答会更多依赖题目条件和通用知识。',
    );
  }

  return createResult('trusted', 'Retrieved chunks look usable as supporting evidence.', debug);
}

export function buildKnowledgeVerifierPrompt(result: KnowledgeVerifierResult) {
  const lines = [
    `KnowledgeVerifierAgent status: ${result.status}`,
    `Verifier reason: ${result.reason}`,
    ...buildStatusInstructions(result.status),
  ];

  return lines.join('\n');
}

function createResult(
  status: KnowledgeVerifierStatus,
  reason: string,
  debug: KnowledgeVerifierResult['debug'],
  userNotice?: string,
): KnowledgeVerifierResult {
  const base = {
    status,
    reason,
    userNotice,
    debug,
  };

  return {
    ...base,
    promptAddition: buildKnowledgeVerifierPrompt({
      ...base,
      promptAddition: '',
    }),
  };
}

function findSuspiciousSignals(chunks: KnowledgeVerifierChunk[]) {
  const text = chunks.map((chunk) => chunk.content.toLowerCase()).join('\n');
  return suspiciousSignals.filter((signal) => text.includes(signal.toLowerCase()));
}

function findConflictSignals(chunks: KnowledgeVerifierChunk[]) {
  const answers = new Set<string>();
  for (const chunk of chunks) {
    for (const value of extractAnswerMarkers(chunk.content)) {
      answers.add(value);
    }
  }

  if (answers.size <= 1) return [];
  return [`answer:${Array.from(answers).join(' vs answer:')}`];
}

function extractAnswerMarkers(text: string) {
  const matches = text.matchAll(/(?:答案|结果|answer)\s*[:：]\s*([^\s。；;,.，]+)/gi);
  return Array.from(matches, (match) => match[1]?.trim()).filter(Boolean);
}

function buildStatusInstructions(status: KnowledgeVerifierStatus) {
  if (status === 'trusted') {
    return ['Use retrieved chunks as supporting evidence, but still reason from the problem conditions.'];
  }

  if (status === 'conflict') {
    return [
      'Do not blindly follow conflicting user notes.',
      'Explain the reasoning basis before choosing a conclusion.',
      'Mention that the referenced material may need checking when relevant.',
    ];
  }

  if (status === 'suspicious') {
    return [
      'Treat retrieved chunks as possibly unreliable.',
      'Prefer problem conditions, standard concepts, and explicit reasoning over the note wording.',
      'Mention that the referenced material may need checking when relevant.',
    ];
  }

  if (status === 'insufficient') {
    return [
      'Do not force citations as proof.',
      'Answer normally from the problem conditions and general knowledge.',
    ];
  }

  return ['No retrieved knowledge needs verifier guidance.'];
}
```

- [ ] **Step 4: Export verifier package entrypoints**

Modify `packages/agent/src/index.ts`:

```ts
export * from './graph';
export * from './nodes/knowledge-verifier';
export * from './nodes/tutor';
export * from './recorder';
export * from './router';
export * from './runtime';
export * from './state';
export * from './thresholds';
```

Modify `packages/agent/package.json`:

```json
"./knowledge-verifier": "./src/nodes/knowledge-verifier.ts"
```

- [ ] **Step 5: Verify green**

Run:

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add packages/agent/src/nodes/knowledge-verifier.ts packages/agent/tests/knowledge-verifier.test.ts packages/agent/src/index.ts packages/agent/package.json
git commit -m "feat: add knowledge verifier agent policy"
```

---

### Task 2: RAG Context Integration

**Files:**
- Modify: `apps/web/src/lib/chat-rag-context.ts`
- Modify: `apps/web/src/lib/chat-rag-context.test.mts`

- [ ] **Step 1: Write failing web RAG tests**

Extend `apps/web/src/lib/chat-rag-context.test.mts` with tests that assert:

```ts
const suspiciousHit = {
  ...greenTheoremHit,
  content: '这部分笔记可能有误，待核对：格林公式结果写成 9。',
};

test('builds verifier-aware prompt context for suspicious hits', () => {
  const verifier = verifyKnowledgeForChat([suspiciousHit]);
  const context = buildKnowledgeContextPrompt([suspiciousHit], verifier);

  assert.equal(verifier.status, 'suspicious');
  assert.match(context, /KnowledgeVerifierAgent status: suspicious/);
  assert.match(context, /不要盲从/);
});

test('appends verifier notice after citations for suspicious hits', () => {
  const verifier = verifyKnowledgeForChat([suspiciousHit]);
  const markdown = appendCitationMarkdown('answer', [suspiciousHit], verifier);

  assert.match(markdown, /### 参考资料/);
  assert.match(markdown, /### 资料核对提示/);
  assert.match(markdown, /可能需要核对/);
});

test('does not append verifier notice for trusted hits', () => {
  const verifier = verifyKnowledgeForChat([greenTheoremHit]);
  const markdown = appendCitationMarkdown('answer', [greenTheoremHit], verifier);

  assert.doesNotMatch(markdown, /资料核对提示/);
});
```

- [ ] **Step 2: Verify red**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/chat-rag-context.test.mts
```

Expected: FAIL because `verifyKnowledgeForChat` and verifier-aware parameters do not exist.

- [ ] **Step 3: Implement verifier-aware RAG helpers**

In `apps/web/src/lib/chat-rag-context.ts`:

```ts
import {
  verifyKnowledgeChunks,
  type KnowledgeVerifierResult,
} from '@repo/agent/knowledge-verifier';
```

Add `verifierResult?: KnowledgeVerifierResult` to `ChatKnowledgeSearchResult`.

Add:

```ts
export function verifyKnowledgeForChat(hits: KnowledgeSearchHit[]) {
  return verifyKnowledgeChunks({
    query: '',
    chunks: hits.map((hit) => ({
      documentId: hit.documentId,
      documentTitle: hit.documentName,
      chunkId: hit.chunkId,
      content: hit.content,
      score: hit.score,
    })),
  });
}
```

Update `buildKnowledgeContextPrompt(hits, verifierResult?)` and append
`verifierResult.promptAddition` after existing RAG usage rules when provided.

Update `appendCitationMarkdown(content, hits, verifierResult?)` to append:

```markdown
### 资料核对提示

${verifierResult.userNotice}
```

only when `verifierResult.userNotice` exists.

In `searchKnowledgeForChat`, return:

```ts
return {
  hits: parsed.data.hits,
  verifierResult: verifyKnowledgeForChat(parsed.data.hits),
};
```

No token budget behavior changes.

- [ ] **Step 4: Verify green**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/chat-rag-context.test.mts
bun --filter @repo/web test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/src/lib/chat-rag-context.ts apps/web/src/lib/chat-rag-context.test.mts
git commit -m "feat: apply knowledge verifier to chat rag context"
```

---

### Task 3: Chat Route Headers and Mock Visibility

**Files:**
- Modify: `apps/web/src/lib/ai-usage-guard.ts`
- Modify: `apps/web/src/lib/ai-usage-guard.test.mts`
- Modify: `apps/web/src/app/api/chat/route.ts`

- [ ] **Step 1: Add failing mock/header tests**

Extend `apps/web/src/lib/ai-usage-guard.test.mts`:

```ts
test('shows knowledge verifier status in mock output when provided', () => {
  const text = createMockChatText({
    hasActiveContext: false,
    latestUserText: '根据我的笔记回答',
    agentRoute: 'rag_answer',
    verifierStatus: 'suspicious',
  });

  assert.match(text, /KnowledgeVerifierAgent/);
  assert.match(text, /suspicious/);
});
```

- [ ] **Step 2: Verify red**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/ai-usage-guard.test.mts
```

Expected: FAIL because `verifierStatus` is not supported.

- [ ] **Step 3: Add verifier status to mock text**

In `apps/web/src/lib/ai-usage-guard.ts` import:

```ts
import type { KnowledgeVerifierStatus } from '@repo/agent/knowledge-verifier';
```

Extend `createMockChatText` input with:

```ts
verifierStatus?: KnowledgeVerifierStatus;
```

Add a helper:

```ts
function formatMockKnowledgeVerifier(status?: KnowledgeVerifierStatus) {
  if (!status || status === 'skipped') return '';
  return `KnowledgeVerifierAgent status: ${status}. Mock mode shows verifier metadata only and does not call a live model.`;
}
```

Render the helper near existing Agent/Tutor mock metadata.

- [ ] **Step 4: Pass verifier data from `/api/chat`**

In `apps/web/src/app/api/chat/route.ts`:

- pass `knowledgeResult.verifierResult` to `buildKnowledgeContextPrompt`;
- pass it to `appendCitationMarkdown`;
- add safe headers:

```ts
'x-prepmind-knowledge-verifier-status':
  knowledgeResult.verifierResult?.status ?? 'skipped',
'x-prepmind-knowledge-verifier-chunks':
  String(knowledgeResult.verifierResult?.debug.checkedChunkCount ?? 0),
```

- pass `verifierStatus: knowledgeResult.verifierResult?.status` into
  `createMockChatText`.

- [ ] **Step 5: Verify green**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/ai-usage-guard.test.mts
bun --filter @repo/web test
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add apps/web/src/lib/ai-usage-guard.ts apps/web/src/lib/ai-usage-guard.test.mts apps/web/src/app/api/chat/route.ts
git commit -m "feat: expose knowledge verifier in chat responses"
```

---

### Task 4: Verification, Live Smoke, and Docs

**Files:**
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md` if it exists and tracks current phase.

- [ ] **Step 1: Run full static and test checks**

Run:

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
```

Expected: PASS.

- [ ] **Step 2: Confirm no extra live calls were introduced**

Run:

```powershell
rg "streamText|AI_ENABLE_LIVE_CALLS|AI_PROVIDER_MODE|OPENAI_API_KEY|DEEPSEEK_API_KEY" packages/agent apps/web/src/lib apps/web/src/app/api/chat
```

Expected: `packages/agent/src/nodes/knowledge-verifier.ts` has no provider calls or API key access.

- [ ] **Step 3: Run mock browser smoke**

Start the project in mock mode and verify:

- ordinary Chat still responds;
- a RAG no-hit request does not show a source-check notice;
- mock response can expose verifier status when hits are available;
- browser console has no new errors.

- [ ] **Step 4: Run small live smoke**

Use no more than 3 fixed prompts with `deepseek-v4-flash`:

```powershell
$env:AI_PROVIDER_MODE='live'
$env:AI_ENABLE_LIVE_CALLS='true'
$env:AI_MODEL='deepseek-v4-flash'
$env:AI_MAX_INPUT_TOKENS='2500'
$env:AI_MAX_OUTPUT_TOKENS='1200'
```

Expected:

- no-hit request answers normally;
- trusted hit answers naturally with citation;
- suspicious/conflict hit avoids blind trust and includes a gentle核对提示。

Stop the live server after smoke.

- [ ] **Step 5: Update docs**

Update docs to record:

- Phase 6.3 completed;
- `KnowledgeVerifierAgent` is deterministic and RAG-only in this phase;
- Chat remains non-blocking;
- live calls remain guarded by `AI_PROVIDER_MODE=live` and
  `AI_ENABLE_LIVE_CALLS=true`;
- Phase 6.4 next step.

- [ ] **Step 6: Commit docs**

Run:

```powershell
git add docs/data-flow.md docs/roadmap.md AGENTS.md CLAUDE.md
git commit -m "docs: wrap up phase 6 knowledge verifier"
```

---

## Self-Review Checklist

- The verifier only runs when RAG hits exist.
- The verifier does not call a live model.
- Chat remains usable with no token, no docs, no hits, retrieval failure, or verifier failure.
- TutorAgent prompt additions still precede RAG/verifier guidance.
- User-facing notices are gentle and do not declare user notes definitively wrong.
- Headers expose status/count metadata only, not source text or prompts.
- Tests cover package policy, web RAG prompt/citation behavior, mock visibility, and no-hit behavior.
- Live validation is intentionally small and uses the guarded cheap model.

