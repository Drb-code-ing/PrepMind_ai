# Phase 6.9.5 V10 Semantic Quality Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the Review/Planner real-model quality contract without changing local fact or write authority, then prove the result through a new one-shot V10 lineage.

**Architecture:** V10 narrows the model schema to selection and ordering fields that production actually merges. Direct structured prompts make the deterministic decision policy and numbered options visible; runtime fixtures derive their expectations from the same visible policy. A new immutable V10 lineage reuses the V9 transport, budget, and fail-closed patterns while adding only safe per-lane aggregate counts.

**Tech Stack:** Bun, TypeScript, Zod, Jest, Bun native tests, DeepSeek JSON-object non-thinking transport, Docker Compose, Prisma, Playwright.

---

### Task 1: Align Candidate Prompt and Product Merge Contract

**Files:**
- Modify: `packages/agent/src/model-candidates/review-planner-model-candidate.ts`
- Modify: `packages/agent/tests/review-planner-model-candidate.test.ts`

- [ ] **Step 1: Write failing prompt-contract and full-permutation tests**

```ts
expect(requests[0]?.userPrompt).toContain('"options"');
expect(requests[0]?.userPrompt).toContain('return every supplied block exactly once');
expect(PLANNER_MODEL_CANDIDATE_SCHEMA.safeParse({ blockOrder: [0, 1] }).success).toBe(true);
expect(PLANNER_MODEL_CANDIDATE_SCHEMA.safeParse({ blockOrder: [0, 1], strategy: 'steady_progress' }).success).toBe(false);
```

- [ ] **Step 2: Run RED**

Run: `bun --cwd packages/agent test review-planner-model-candidate.test.ts`

Expected: prompt-policy assertions fail and the extra Planner label is still accepted.

- [ ] **Step 3: Implement the minimal model-visible policy**

Replace the candidate schemas with index-only output schemas. Build one sanitized direct JSON prompt per lane containing `policy` and indexed `options`; preserve the existing local budget, abort, trace, and merger checks. Derive local observation reason codes from deterministic signals after a candidate is applied, so the model never controls labels that product does not use.

- [ ] **Step 4: Run GREEN and commit**

Run: `bun --cwd packages/agent test review-planner-model-candidate.test.ts`

Commit: `fix(agent): align Review Planner model decisions`

### Task 2: Replace Hidden Runtime Fixture Oracles

**Files:**
- Create: `packages/agent/src/evals/phase-6-9-review-planner-v10-cases.ts`
- Create: `packages/agent/src/evals/run-phase-6-9-review-planner-v10-paired.ts`
- Create: `packages/agent/src/evals/phase-6-9-review-planner-v10-contract.ts`
- Create: `packages/agent/tests/phase-6-9-review-planner-v10-paired.test.ts`
- Keep: `packages/agent/src/evals/phase-6-9-review-planner-cases.ts` and `run-phase-6-9-review-planner-paired.ts` as the V1--V9 historical dataset/runner contract

- [ ] **Step 1: Write failing fixture-policy and non-tautological mock tests**

```ts
expect(deriveFixtureDecision(fixture)).toEqual(fixture.expected);
expect(createPolicyMockResponder(fixture)()).not.toBe(fixture.expected);
expect(report.review.runtime.qualityPasses + report.planner.runtime.qualityPasses).toBe(22);
```

- [ ] **Step 2: Run RED**

Run: `bun --cwd packages/agent test phase-6-9-review-planner-v10-paired.test.ts`

Expected: exports and safe lane aggregate are absent; Mock still returns fixture expected data.

- [ ] **Step 3: Implement visible-policy fixtures and safe lane totals**

Keep `48/26/22` coverage in a new `phase-6.9-review-planner-v3` V10 dataset. Give runtime review weak points explicit priority/confidence evidence; give runtime Planner blocks an explicit overdue or normal visible reason and preserve source order outside overdue blocks. Generate expected decisions with a local policy helper. Change the V10 Mock responder to invoke that helper. Grade only selected weak points and block ordering, while preserving strict, trace, budget, zero-call, and critical safety rules. Add bounded Review/Planner lane aggregates without case content. Do not change the V2 dataset or runner used by V1--V9 historical contracts.

- [ ] **Step 4: Run GREEN and commit**

Run: `bun --cwd packages/agent test phase-6-9-review-planner-v10-paired.test.ts`

Commit: `test(agent): make Review Planner quality oracle derivable`

### Task 3: Build V10 Immutable Controlled-Live Lineage

**Files:**
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v10-semantic-quality.contract.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v10-semantic-quality.factory.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v10-semantic-quality.evidence.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v10-semantic-quality.cli.ts`
- Create: `apps/server/scripts/review-planner-controlled-live-eval-v10-semantic-quality.ts`
- Modify: `apps/server/package.json`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-composition.ts`
- Test: matching Jest/native specs for each new V10 module

- [ ] **Step 1: Write failing V10 profile, safe aggregate, and authority tests**

```ts
expect(V10_CONFIRMATION).toBe('--confirm-controlled-live-v10-deepseek-v4-pro-semantic-quality');
expect(diagnostic.report.review.runtime.qualityPasses).toBeGreaterThanOrEqual(0);
expect(await readV10Evidence(root)).toMatchObject({ terminalReason: 'quality_gate_failed' });
expect(await productPreflight(v10CommittedSuccess)).toMatchObject({ ok: true });
expect(() => v10GateDiagnosticSchema.parse({ ...diagnostic, prompt: 'forbidden' })).toThrow();
expect(() => v10GateDiagnosticSchema.parse({
  ...diagnostic,
  report: { ...diagnostic.report, caseEntries: [] },
})).toThrow();
```

- [ ] **Step 2: Run RED**

Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval-v10-semantic-quality --runInBand`

Expected: V10 modules and V10 authority do not exist.

- [ ] **Step 3: Implement V10 by reusing V9 behavior through a new immutable profile**

Keep V9 exports and evidence bytes untouched. Create a V10 profile with its own gate, confirmation, directory, once marker, stages, V1--V9 snapshot, exact `23/22` ceiling, `4500ms`, CNY `1.00`, and pass-only success seal. Serialize only strict safe aggregate/lane counts; reject unknown fields at every level and forbid raw entries, case ids, prompts, snapshots, model outputs, URLs, credentials, raw errors, and per-case duration/usage. Update product authority to require V10 committed success and ordinary-`H` leaf stability.

- [ ] **Step 4: Run GREEN and commit**

Run: focused V10 Jest/native tests, V9 regression tests, server lint, server build, `git diff --check`

Commit: `feat(agent): add V10 semantic quality lineage`

### Task 4: Offline Gates, Reviews, and One Controlled-Live

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `docs/acceptance-checklist.md`
- Create: `docs/acceptance/phase-6-9-5-review-planner-v10-offline-checkpoint.md`

- [ ] **Step 1: Run all offline gates and independent contract/operations reviews**

Run: V10 focused/Jest/native, V9 regressions, Agent and AI suites, types, Server/Web tests and builds, Compose `config --quiet`, and `git diff --check`.

- [ ] **Step 2: Record the exact default-off and one-shot preflight conditions**

Document V9 terminal history, V10 directory absence, root `.env` injection, V10 eval gate only, V8/V9 eval gates false, product gates false, `deepseek-v4-pro`, JSON-object non-thinking, `4500ms`, `23/22`, and CNY `1.00`.

- [ ] **Step 3: Commit offline gates**

Commit: `docs(agent): record V10 offline gates`

- [ ] **Step 4: Execute only one V10 controlled-Live and read its durable result**

Run only after clean-head preflight, from a fresh PowerShell process so all gates are process-scoped and automatically discarded:

```powershell
$env:AI_PROVIDER_MODE='live'
$env:AI_ENABLE_LIVE_CALLS='true'
$env:REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V10_SEMANTIC_QUALITY_ENABLED='true'
$env:REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED='false'
$env:REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED='false'
$env:REVIEW_AGENT_MODEL_ENABLED='false'
$env:PLANNER_AGENT_MODEL_ENABLED='false'
$env:AI_MODEL='deepseek-v4-pro'
$env:AI_BASE_URL='https://api.deepseek.com/v1'
$env:REVIEW_AGENT_MODEL_TIMEOUT_MS='4500'
$env:PLANNER_AGENT_MODEL_TIMEOUT_MS='4500'
bun --env-file=.env --filter @repo/server eval:review-planner:live:v10:semantic-quality -- --confirm-controlled-live-v10-deepseek-v4-pro-semantic-quality
```

The command must fail closed before reservation if any V8/V9/product gate is not false. It must never write a gate to `.env`; the fresh process exit restores default-off.

If the reader is not committed success, commit only the safe evidence and stop the lineage. If it is committed success, continue to Task 5.

- [ ] **Step 5: Commit the immutable V10 outcome**

Commit: `test(agent): record V10 controlled Live evidence`

### Task 5: Product Acceptance, Main Replay, and Push

**Files:**
- Modify: acceptance evidence and current project documents only after verified branch/main runs

- [ ] **Step 1: Run branch Docker and headed-browser product acceptance**

Use the existing durable runner for Review API -> `/plan` -> default-off restore -> Planner API -> `/today` -> default-off restore. Verify owner isolation, facts unchanged, one trace per request, bounded cost, exact cleanup, and visibly keep the browser open.

- [ ] **Step 2: Commit branch acceptance**

Commit: `test(agent): accept Review Planner V10 on branch`

- [ ] **Step 3: Merge and replay on main**

After the branch is clean and default-off, merge with `git merge --no-ff codex/phase-6-9-5-review-planner-live-diagnostics`. On main, read committed V10 evidence and perform the new four-request product replay without rerunning V10 paired evaluation.

- [ ] **Step 4: Commit, push, and verify parity**

Commit final current docs, push `origin main`, and verify `origin/main` equals local `main`, the worktree is clean, gates are default-off, and synthetic data has no residue.
