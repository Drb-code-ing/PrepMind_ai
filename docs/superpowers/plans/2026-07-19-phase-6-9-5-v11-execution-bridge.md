# Phase 6.9.5 V11 Product-Acceptance Execution Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give V11 an isolated, attempt-bound success path so a later V11 branch product command can produce valid success evidence without touching V8/V10 history.

**Architecture:** V11 extends its public ledger with V11-identity success records and its private root with a redacted execution manifest bound to the opaque attempt. A V11 runner-ledger adapter supplies the existing runner mechanics; the default composition wires this adapter, V11 checkpoint diagnostics, and existing deterministic default-off/cleanup dependencies without executing them in this offline stage.

**Tech Stack:** Bun, TypeScript, Zod, Jest, Windows native no-reparse I/O, NestJS, Prisma, Docker Compose and Playwright adapters (not invoked during bridge implementation).

---

### Task 1: Define V11 Success Ledger and Execution Manifest Contracts

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-product-acceptance-profile.ts`
- Modify: `apps/server/src/review-agent/review-planner-v11-product-acceptance-diagnostics.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-ledger.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-ledger.native.bun.test.ts`
- Create: `apps/server/src/review-agent/review-planner-v11-product-acceptance-execution.ts`
- Create: `apps/server/src/review-agent/review-planner-v11-product-acceptance-execution.spec.ts`

- [ ] **Step 1: Write failing V11 success/manifest tests**

```ts
expect(() => v11SuccessSchema.parse({ ...success, rawError: 'forbidden' })).toThrow();
expect(() => v11ExecutionManifestSchema.parse({ ...manifest, password: 'forbidden' })).toThrow();
await expect(readV11Ledger(root)).resolves.toEqual({ status: 'evidence_io' });
```

- [ ] **Step 2: Run RED**

Run: V11 execution Jest plus the matching native ledger test. Expected: V11 success/manifest exports and readers are absent.

- [ ] **Step 3: Implement strict V11 success shapes**

Add V11 schema identities and strict records for manifest, slot result, default-off, owner isolation, cleanup, aggregate, and success. Add a V11 private execution manifest bound to attempt hash with only synthetic selectors and browser executable/profile paths. Reject raw credentials, tokens, capabilities, prompts, responses, cookies, facts, errors, and unknown keys.

- [ ] **Step 4: Verify success/failure exclusion**

Native tests must reject a V11 success after failure, a failure after success, incomplete claims, stale/mismatched manifests, cross-lineage identity, unknown leaves, and partial publish.

- [ ] **Step 5: Commit**

Commit: `feat(agent): add V11 execution ledger contracts`

### Task 2: Implement V11 Runner-Ledger Bridge

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-runner.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-runner.spec.ts`
- Modify: `apps/server/src/review-agent/review-planner-v11-product-acceptance-execution.ts`
- Modify: `apps/server/src/review-agent/review-planner-v11-product-acceptance-execution.spec.ts`

- [ ] **Step 1: Write failing adapter tests**

```ts
await runReviewPlannerV8ProductAcceptance(v11Fixture);
expect(v11Ledger.slotResults).toHaveLength(4);
expect(v11Ledger.success).toMatchObject({ schemaVersion: expect.stringContaining('-v11-') });
expect(v11Ledger.v8LeavesWritten).toBe(false);
```

- [ ] **Step 2: Run RED**

Run: `bun --filter @repo/server test -- review-planner-v8-product-acceptance-runner review-planner-v11-product-acceptance-execution --runInBand`.

- [ ] **Step 3: Implement the V11 adapter**

Implement a V11-only runner ledger port with the existing slot order and safety checks. It serializes only V11 records, binds every write to the V11 owner/attempt, finalizes V11 success only after exact cleanup, and routes any runner failure to the existing V11 diagnostics publisher.

- [ ] **Step 4: Verify fake success and failure**

Use fake API/browser/Trace/default-off/cleanup dependencies. Assert four slot results and one V11 success on success; assert one V11 failure plus no V11 success on failure; assert no V8/V10 roots change.

- [ ] **Step 5: Commit**

Commit: `feat(agent): bridge V11 runner acceptance records`

### Task 3: Wire Default V11 Composition and Recovery Selectors

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-composition.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-composition.spec.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-recovery.ts`
- Modify: matching recovery/native specs

- [ ] **Step 1: Write failing no-runtime composition tests**

```ts
await expect(runV11ProductWithFakePorts()).resolves.toMatchObject({ status: 'passed' });
expect(order).toEqual(['preflight', 'owner', 'reserve', 'manifest', 'fixtures', 'journal', 'runner']);
expect(externalRuntimeCalls).toBe(0);
```

- [ ] **Step 2: Run RED**

Run the focused composition/recovery suite. Expected: V11 default composition has no success bridge or execution-manifest lifecycle.

- [ ] **Step 3: Wire attempt-bound resources**

Create execution manifest before resources, bind exact resource selectors to cleanup/default-off recovery, create the V11 runner bridge and diagnostics port, and preserve existing deterministic callbacks. Preflight/owner failure must make zero resource, Docker, browser, API, or provider calls.

- [ ] **Step 4: Verify fresh recovery and historical compatibility**

Native/fake tests prove matching V11 execution-manifest recovery works; stale/mismatch fails closed; V8/V10 evidence remains byte-compatible; global lease blocks concurrent V11/V8/V10/branch/main ownership.

- [ ] **Step 5: Commit**

Commit: `feat(agent): wire V11 execution composition bridge`

### Task 4: Add V11 CLI, Offline Gates, and Documentation

**Files:**
- Create: `apps/server/scripts/review-planner-v11-product-acceptance.ts`
- Create: `apps/server/scripts/review-planner-v11-product-acceptance-recovery.ts`
- Modify: `apps/server/package.json`
- Modify: `AGENTS.md`, `CLAUDE.md`, `README.md`, `DEVLOG.md`, `docs/roadmap.md`, `docs/ai-behavior-acceptance.md`, `docs/acceptance-checklist.md`
- Create: `docs/acceptance/phase-6-9-5-review-planner-v11-offline-checkpoint.md`

- [ ] **Step 1: Write failing CLI/preflight tests**

```ts
expect(parseV11ProductArgs(['--confirm-v10-review-planner-product-acceptance', '--environment=branch']))
  .toThrow('V11_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED');
await expect(v11Preflight(v10ControlledLiveSuccess)).resolves.toMatchObject({ status: 'ready' });
await expect(v11Preflight(v10ProductRecoveryOnly)).resolves.toMatchObject({ status: 'ready' });
```

- [ ] **Step 2: Run RED then implement**

Require V10 committed controlled-Live only; require clean/default-off/empty V11 roots; expose exact V11 confirmation and safe serializer. Keep owner contention as owner-stage `owner_active`, before reservation/resources/runtime.

- [ ] **Step 3: Run offline gates and reviews**

Run focused/full V11 and V8/V10 regressions, server/web/Agent/AI/type gates, Compose `config --quiet`, and diff check. Record that no runtime command was executed. Obtain independent contract/security and operations review with no P0/P1.

- [ ] **Step 4: Commit**

Commit: `docs(agent): record V11 execution bridge checkpoint`

### Task 5: One Later V11 Branch Run

- [ ] Do not execute this task during bridge implementation. Only after Task 4 passes, rebuild the current `server` image and run the exact V11 branch confirmation once. On failure recover once and stop; on success commit branch evidence, merge main, replay main, update documents, push, and verify parity.
