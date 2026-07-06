# Phase 7.8.4 RAG Eval Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the RAG Eval smoke script against false PASS results, add a local keep-data switch, and document the RAG eval story for interview review.

**Architecture:** Extract smoke case selection and keep-data parsing into a small pure module under `apps/server/src/knowledge-documents/evals/`, test it with Jest, then keep the script as a thin HTTP orchestrator. Documentation updates stay separate from code changes.

**Tech Stack:** TypeScript, Jest, Bun workspace, Node native fetch/FormData/Blob, existing RAG Eval runner and smoke script.

---

## File Structure

- Create `apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.ts`
  - Owns required smoke case ids, case selection guard, and keep-data env parsing.
- Create `apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.spec.ts`
  - Verifies correct case selection, missing-case failure, and keep-data parsing.
- Modify `apps/server/scripts/rag-eval-smoke.ts`
  - Uses config helper and skips cleanup when keep-data is enabled.
- Create `docs/blogs/rag-eval-and-hybrid-retrieval.md`
  - Interview learning blog for RAG eval baseline, hybrid retrieval, and real API smoke.
- Modify `AGENTS.md`, `DEVLOG.md`, `docs/ai-behavior-acceptance.md`
  - Records Phase 7.8.4 status and boundaries.

---

## Task 1: Add Smoke Config Helper With TDD

**Files:**
- Create: `apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.spec.ts`
- Create: `apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.spec.ts`:

```ts
import {
  RAG_EVAL_SMOKE_CASE_IDS,
  selectRagEvalSmokeCases,
  shouldKeepRagEvalSmokeData,
} from './rag-eval-smoke-config';
import type { RagEvalCase } from './rag-eval.types';

describe('selectRagEvalSmokeCases', () => {
  it('returns required smoke cases in configured order', () => {
    const cases = selectRagEvalSmokeCases([
      testCase('cross-language-weak-points'),
      testCase('exact-blue-lantern'),
      testCase('semantic-review-pressure'),
      testCase('unused-case'),
    ]);

    expect(cases.map((testCase) => testCase.id)).toEqual(
      RAG_EVAL_SMOKE_CASE_IDS,
    );
  });

  it('throws when a required smoke case is missing', () => {
    expect(() =>
      selectRagEvalSmokeCases([
        testCase('exact-blue-lantern'),
        testCase('semantic-review-pressure'),
      ]),
    ).toThrow(
      'RAG eval smoke cases are missing required ids: cross-language-weak-points',
    );
  });
});

describe('shouldKeepRagEvalSmokeData', () => {
  it.each(['true', 'TRUE', '1', 'yes', 'YES'])(
    'enables keep-data for %s',
    (value) => {
      expect(
        shouldKeepRagEvalSmokeData({ RAG_EVAL_SMOKE_KEEP_DATA: value }),
      ).toBe(true);
    },
  );

  it.each([undefined, '', 'false', '0', 'no', 'anything-else'])(
    'disables keep-data for %s',
    (value) => {
      expect(
        shouldKeepRagEvalSmokeData({ RAG_EVAL_SMOKE_KEEP_DATA: value }),
      ).toBe(false);
    },
  );
});

function testCase(id: string): RagEvalCase {
  return {
    id,
    name: id,
    query: id,
    topK: 5,
    shouldHaveHit: true,
  };
}
```

- [ ] **Step 2: Run RED verification**

Run:

```powershell
bun --filter @repo/server test -- rag-eval-smoke-config
```

Expected: FAIL because `./rag-eval-smoke-config` does not exist.

- [ ] **Step 3: Implement helper**

Create `apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.ts`:

```ts
import type { RagEvalCase } from './rag-eval.types';

export const RAG_EVAL_SMOKE_CASE_IDS = [
  'exact-blue-lantern',
  'semantic-review-pressure',
  'cross-language-weak-points',
] as const;

type RagEvalSmokeCaseId = (typeof RAG_EVAL_SMOKE_CASE_IDS)[number];

type RagEvalSmokeEnv = {
  RAG_EVAL_SMOKE_KEEP_DATA?: string;
};

export function selectRagEvalSmokeCases(cases: RagEvalCase[]) {
  const casesById = new Map(cases.map((testCase) => [testCase.id, testCase]));
  const selected = RAG_EVAL_SMOKE_CASE_IDS.map((caseId) =>
    casesById.get(caseId),
  );
  const missingIds = RAG_EVAL_SMOKE_CASE_IDS.filter(
    (_caseId, index) => !selected[index],
  );

  if (missingIds.length > 0) {
    throw new Error(
      `RAG eval smoke cases are missing required ids: ${missingIds.join(', ')}`,
    );
  }

  return selected as RagEvalCaseWithSmokeId[];
}

export function shouldKeepRagEvalSmokeData(env: RagEvalSmokeEnv) {
  const value = env.RAG_EVAL_SMOKE_KEEP_DATA?.trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

type RagEvalCaseWithSmokeId = RagEvalCase & {
  id: RagEvalSmokeCaseId;
};
```

- [ ] **Step 4: Run GREEN verification**

Run:

```powershell
bun --filter @repo/server test -- rag-eval-smoke-config
```

Expected: PASS.

- [ ] **Step 5: Commit helper**

Run:

```powershell
git add apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.ts apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.spec.ts
git commit -m "feat(server): harden rag eval smoke config"
```

Expected: commit succeeds.

---

## Task 2: Wire Keep-Data Into Smoke Script

**Files:**
- Modify: `apps/server/scripts/rag-eval-smoke.ts`

- [ ] **Step 1: Update imports and smoke case selection**

Modify the top of `apps/server/scripts/rag-eval-smoke.ts`:

```ts
import { ragEvalCases } from '../src/knowledge-documents/evals/rag-eval-cases';
import {
  selectRagEvalSmokeCases,
  shouldKeepRagEvalSmokeData,
} from '../src/knowledge-documents/evals/rag-eval-smoke-config';
```

Remove local `SMOKE_CASE_IDS` and replace local `smokeCases` with:

```ts
const smokeCases = selectRagEvalSmokeCases(ragEvalCases);
```

- [ ] **Step 2: Parse keep-data once in main**

Inside `main()`, after `pollIntervalMs`, add:

```ts
  const keepData = shouldKeepRagEvalSmokeData(process.env);
```

- [ ] **Step 3: Skip cleanup when keep-data is enabled**

Replace the `finally` cleanup block with:

```ts
  } finally {
    if (accessToken && documentId) {
      if (keepData) {
        process.stderr.write(
          `RAG eval smoke kept document ${documentId} for local inspection because RAG_EVAL_SMOKE_KEEP_DATA=true.\n`,
        );
      } else {
        await deleteDocument(baseUrl, accessToken, documentId).catch((error) => {
          process.stderr.write(
            `Warning: failed to delete smoke document: ${messageOf(error)}\n`,
          );
        });
      }
    }
  }
```

- [ ] **Step 4: Run script-related verification**

Run:

```powershell
bun --filter @repo/server test -- rag-eval-smoke-config
bun --filter @repo/server build
```

Expected: both PASS.

- [ ] **Step 5: Commit script wiring**

Run:

```powershell
git add apps/server/scripts/rag-eval-smoke.ts
git commit -m "feat(server): support rag eval smoke keep data"
```

Expected: commit succeeds.

---

## Task 3: Add Interview Blog and Phase Docs

**Files:**
- Create: `docs/blogs/rag-eval-and-hybrid-retrieval.md`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/ai-behavior-acceptance.md`

- [ ] **Step 1: Create blog**

Create `docs/blogs/rag-eval-and-hybrid-retrieval.md` with sections:

```markdown
# RAG Eval、Hybrid Retrieval 和真实检索验收：我是怎么把“能跑”变成“可信”的

## 这篇文章解决什么问题

## 为什么 fake embedding 不能证明 RAG 完成

## 第一层：固定 RAG Eval Baseline

## 第二层：Hybrid Retrieval

## 第三层：真实 API Smoke

## 为什么 smoke 不等于 Chat live 验收

## 这套方案面试怎么讲

## 可以继续优化什么
```

Content must be Chinese, conversational, interview-friendly, and include small code snippets for the eval runner input and smoke command. It must not include real API keys, tokens, or private user content.

- [ ] **Step 2: Update phase docs**

Update `AGENTS.md` and `DEVLOG.md` to mark Phase 7.8.4 as completed and mention:

- smoke case guard prevents false PASS when required case ids drift.
- `RAG_EVAL_SMOKE_KEEP_DATA=true` keeps the synthetic smoke document for local inspection.
- no default CI live embedding requirement.

Update `docs/ai-behavior-acceptance.md` Phase 7.8.3 section or add Phase 7.8.4 section with the same boundary.

- [ ] **Step 3: Run doc checks**

Run:

```powershell
rg "Phase 7.8.4|RAG_EVAL_SMOKE_KEEP_DATA|rag-eval-and-hybrid-retrieval" AGENTS.md DEVLOG.md docs/ai-behavior-acceptance.md docs/blogs/rag-eval-and-hybrid-retrieval.md
git diff --check
```

Expected: `rg` finds the new content and `git diff --check` exits 0.

- [ ] **Step 4: Commit docs**

Run:

```powershell
git add AGENTS.md DEVLOG.md docs/ai-behavior-acceptance.md docs/blogs/rag-eval-and-hybrid-retrieval.md
git commit -m "docs: explain rag eval hardening"
```

Expected: commit succeeds.

---

## Task 4: Final Verification

**Files:**
- No source edits expected unless verification reveals a defect.

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
bun --filter @repo/server test -- rag-eval-smoke-config
bun --filter @repo/server test -- rag-eval-report rag-eval-runner
```

Expected: PASS.

- [ ] **Step 2: Run build**

Run:

```powershell
bun --filter @repo/server build
```

Expected: PASS.

- [ ] **Step 3: Run diff check**

Run:

```powershell
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 4: Run smoke when local API is available**

Run:

```powershell
bun --filter @repo/server smoke:rag-eval
```

Expected: `Status: PASS`.

Optionally run keep-data smoke:

```powershell
$env:RAG_EVAL_SMOKE_KEEP_DATA='true'
bun --filter @repo/server smoke:rag-eval
Remove-Item Env:RAG_EVAL_SMOKE_KEEP_DATA
```

Expected: script reports that the document was kept for local inspection.

---

## Self-Review

- Spec coverage: The plan covers case guard, keep-data switch, blog, and phase docs.
- Placeholder scan: No placeholder tasks remain.
- Type consistency: Smoke config helper uses existing `RagEvalCase`; script keeps existing HTTP orchestration.
- Scope check: This does not start durable outbox / metrics and does not change retrieval ranking or Chat behavior.
