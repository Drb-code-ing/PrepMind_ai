# Phase 6.9.5 V11 Product Safe Failure Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new V11 product-acceptance lineage that safely identifies the durable operation boundary of a failed product run without exposing sensitive runtime content or altering V10 evidence.

**Architecture:** V11 owns a new profile, ledger, recovery journal, browser root, confirmation, and strict safe schemas. The existing V10 controlled-Live success remains the only semantic-quality authority. A V11-only checkpoint port records append-only fixed enum states before external boundaries; public failures and recovery terminals project only the last safe checkpoint and a conservative provider-call state.

**Tech Stack:** Bun, TypeScript, Jest, Windows native no-reparse I/O tests, NestJS, Prisma, Docker Compose, Playwright.

---

### Task 1: Archive V10 Terminal Evidence and Freeze the V11 Design

**Files:**
- Create: `docs/acceptance/phase-6-9-5-review-planner-v10-product-acceptance-recovery.md`
- Create: `docs/superpowers/specs/2026-07-19-phase-6-9-5-v11-product-safe-failure-diagnostics-design.md`
- Modify: `DEVLOG.md`
- Modify: `docs/acceptance-checklist.md`

- [x] **Step 1: Record only safe V10 terminal facts**

State that V10 product ledger is terminal `recovery_only`, that `slot-01-review-api` lacks a result, and that recovery made no new provider/API/browser calls. Explicitly state that this cannot prove the original slot was zero-call or zero-cost.

- [x] **Step 2: Freeze V11 boundaries**

Require a new V11 profile and fixed diagnostic enum; prohibit changing V10 controlled-Live or V10 product evidence and prohibit raw errors, prompt, response, credentials, tokens, URLs, headers, user facts, and per-request usage in V11 diagnostics.

- [x] **Step 3: Commit the V10 archive**

Commit: `test(agent): archive V10 product recovery attempt`

### Task 2: Add V11 Profile and Strict Safe Failure Contracts

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-product-acceptance-profile.ts`
- Modify: `apps/server/src/review-agent/review-planner-product-acceptance-profile.spec.ts`
- Create: `apps/server/src/review-agent/review-planner-v11-product-acceptance-diagnostics.ts`
- Create: `apps/server/src/review-agent/review-planner-v11-product-acceptance-diagnostics.spec.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-ledger.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-ledger.native.bun.test.ts`

- [ ] **Step 1: Write failing V11 profile and schema tests**

```ts
expect(REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.failure).toBe(
  'phase-6.9.5-v11-product-acceptance-failure-v1',
);
expect(REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath('branch')).toBe(
  'docs/acceptance/evidence/phase-6-9-5-v11-product-acceptance/branch',
);
expect(() => v11FailureSchema.parse({ ...failure, rawError: 'forbidden' })).toThrow();
expect(() => v11CheckpointSchema.parse({ ...checkpoint, checkpoint: 'arbitrary' })).toThrow();
```

- [ ] **Step 2: Run RED**

Run: `bun --filter @repo/server test -- review-planner-v11-product-acceptance-diagnostics review-planner-product-acceptance-profile --runInBand`

Expected: V11 profile, checkpoint enum, and failure schema exports are absent.

- [ ] **Step 3: Implement the minimal V11 contract**

Add canonical V11 profile identity, new roots/confirmations/schema literals, fixed checkpoint enum, `not_started | indeterminate` provider state, and strict schemas. Permit profile normalization only from matching V11 raw identity to the shared internal shape; never accept V8/V10 identities in V11 readers.

- [ ] **Step 4: Add V11 ledger reader/writer tests**

Write native tests that V11 records exactly one public failure leaf, rejects unknown fields/cross-lineage schema identity/inconsistent provider state, and keeps V8/V10 leaf sets byte-stable.

- [ ] **Step 5: Run GREEN and commit**

Run: profile/diagnostic Jest, V11 native ledger test, existing V8/V10 ledger native tests, and `git diff --check`.

Commit: `feat(agent): add V11 safe failure evidence contract`

### Task 3: Add Append-Only V11 Checkpoint and Recovery Projection

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-recovery.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-recovery.spec.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-ledger.native.bun.test.ts`

- [ ] **Step 1: Write failing recovery checkpoint tests**

```ts
await journal.appendCheckpoint(v11Checkpoint('review_api_dispatch', 'indeterminate'));
await expect(journal.appendCheckpoint(v11Checkpoint('review_api_facts_before', 'not_started')))
  .rejects.toThrow('V11_PRODUCT_ACCEPTANCE_CHECKPOINT_ORDER_INVALID');
await journal.finalizeRecoveryOnly();
expect(await readV11FailureProjection(root)).toMatchObject({
  checkpoint: 'review_api_dispatch',
  providerCallState: 'indeterminate',
});
```

- [ ] **Step 2: Run RED**

Run: `bun --filter @repo/server test -- review-planner-v8-product-acceptance-recovery --runInBand` and the V11 native recovery case.

Expected: journal has no checkpoint API or V11 recovery projection.

- [ ] **Step 3: Implement append-only checkpoint leaves**

Allow the recovery journal to append only monotonic V11 checkpoint leaves. Each leaf stores the strict fixed record. Add a V11 public failure projection and make recovery terminal validate and repeat only the final safe fields. Keep V8/V10 allowed leaves and terminal serializers unchanged.

- [ ] **Step 4: Verify crash and cleanup behavior**

Use a fresh-process native test to hard-exit after a V11 dispatch checkpoint, then run recovery-only and prove: zero new provider/API/browser calls, mock/default-off restoration, exact cleanup, and the same `indeterminate` checkpoint projection.

- [ ] **Step 5: Run GREEN and commit**

Run: recovery Jest/native suites and `git diff --check`.

Commit: `feat(agent): project V11 diagnostic checkpoints on recovery`

### Task 4: Split Runner Boundaries and Publish Safe V11 Failures

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-runner.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-runner.spec.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-composition.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-composition.spec.ts`

- [ ] **Step 1: Write failing boundary-injection tests**

```ts
fixture.dependencies.captureTraceBaseline.mockRejectedValueOnce(new Error('hidden'));
await expect(runReviewPlannerV8ProductAcceptance(fixture.input)).rejects.toThrow();
expect(fixture.diagnostics.checkpoints).toEqual([
  'review_api_activate',
  'review_api_facts_before',
  'review_api_trace_baseline',
]);
expect(fixture.diagnostics.failure).toEqual({
  checkpoint: 'review_api_trace_baseline',
  providerCallState: 'not_started',
});
```

Add one test each for API dispatch, observation validation, trace wait, trace canonicalization, slot record, browser launch/dispatch/default-off, and a V10 regression proving no diagnostic leaf or profile change.

- [ ] **Step 2: Run RED**

Run: `bun --filter @repo/server test -- review-planner-v8-product-acceptance-runner --runInBand`

Expected: runner has no split baseline port or V11 checkpoint/failure callbacks.

- [ ] **Step 3: Implement V11-only diagnostics port**

Canonicalize V8/V10/V11 profile singletons. Split trace baseline from dispatch in the composition port. Before every listed boundary, durably checkpoint. Immediately before a request can reach suggestions, set state to `indeterminate`. On caught V11 operation failure, publish the one strict public failure projection before default-off and cleanup. V8/V10 keep existing generic behavior and leaf sets.

- [ ] **Step 4: Run GREEN and commit**

Run: focused runner/composition tests, V11 native ledger/recovery tests, server lint, server build, and `git diff --check`.

Commit: `feat(agent): diagnose V11 product failure boundaries`

### Task 5: Add V11 CLI, Authority, Offline Gates, and Reviews

**Files:**
- Create: `apps/server/scripts/review-planner-v11-product-acceptance.ts`
- Create: `apps/server/scripts/review-planner-v11-product-acceptance-recovery.ts`
- Modify: `apps/server/package.json`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-composition.ts`
- Modify: `docs/acceptance-checklist.md`
- Modify: `DEVLOG.md`
- Create: `docs/acceptance/phase-6-9-5-review-planner-v11-offline-checkpoint.md`

- [ ] **Step 1: Write failing CLI/authority tests**

```ts
expect(parseReviewPlannerV11ProductAcceptanceArguments([
  '--confirm-v10-review-planner-product-acceptance',
  '--environment=branch',
], 'product')).toThrow('V11_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED');
await expect(productPreflight(v10ControlledLiveSuccess)).resolves.toMatchObject({ status: 'ready' });
await expect(productPreflight(v10ProductRecoveryOnly)).resolves.toMatchObject({ status: 'ready' });
```

The final assertion deliberately proves V11 authorizes from V10 **controlled-Live** success, never from V10 product recovery.

- [ ] **Step 2: Run RED**

Run: `bun --filter @repo/server test -- review-planner-v8-product-acceptance-composition review-planner-product-acceptance-profile --runInBand`

Expected: V11 CLI and profile authority are absent.

- [ ] **Step 3: Implement V11 entry points and preflight**

Add exact V11 product/recovery confirmations and package commands. V11 preflight requires a clean HEAD, V10 committed controlled-Live evidence, all default-off gates, an empty V11 root, and existing global runtime lease availability. It must not read V10 product recovery as an authority and must fail before fixture/Docker/browser/provider work on any invalid condition.

- [ ] **Step 4: Run offline verification and independent reviews**

Run focused V11 Jest/native tests, V8/V10 regressions, Agent/AI suites, server/web tests and builds, types, Compose `config --quiet`, and `git diff --check`. Record default-off, V10 authority, V11 absence/empty-root, exact budget, and no-sensitive-data checks. Obtain independent contract/security and operations reviews with no open P0/P1.

- [ ] **Step 5: Commit the offline checkpoint**

Commit: `docs(agent): record V11 product diagnostic checkpoint`

### Task 6: One V11 Branch Product Run, Main Replay, and Push

**Files:**
- Create: `docs/acceptance/evidence/phase-6-9-5-v11-product-acceptance/branch/*` only after the branch run
- Create: `docs/acceptance/evidence/phase-6-9-5-v11-product-acceptance/main/*` only after main replay
- Modify: current docs only after verified branch/main results

- [ ] **Step 1: Rebuild only the current branch `server` image**

Run with `COMPOSE_BAKE=false`: `docker compose --env-file .env -f docker/docker-compose.dev.yml build server`. Do not run `down`, `down -v`, `prune`, cache cleanup, volume deletion, or database reset.

- [ ] **Step 2: Run exactly one V11 branch product command**

Run the exact V11 confirmation with `--environment=branch`. Keep the acceptance browser headed. If it fails, run only V11 recovery confirmation, commit its strict terminal evidence, and stop; no retry or main merge.

- [ ] **Step 3: On branch success, retain visible evidence and commit**

Verify four unique traces, bounded cost/usage, owner isolation, facts unchanged, default-off receipts, strict cleanup zero, and a V11 success seal. Open a normal mock/default-off learning window after acceptance and leave it visible. Commit: `test(agent): accept Review Planner V11 on branch`.

- [ ] **Step 4: Merge and replay on main only after branch success**

Merge with `git merge --no-ff codex/phase-6-9-5-review-planner-live-diagnostics`. Read committed V10 controlled-Live and V11 branch evidence without rerunning either controlled-Live. Execute the single V11 main four-request replay, keep browser visible, then commit evidence/docs.

- [ ] **Step 5: Push and prove parity**

Push `origin/main`; verify local `main` equals `origin/main`, worktree clean, server mock/default-off, product gates false, provider credentials absent from server, and synthetic residue zero. Phase 6.9.5 is complete only if all prior conditions passed.
