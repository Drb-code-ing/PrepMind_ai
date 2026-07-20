# Phase 6.9.5 V12 Product Lineage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven development task-by-task. Each task is TDD-first and independently committed.

**Goal:** Build an isolated V12 Review/Planner product-acceptance lineage that can perform one new branch controlled-Live without modifying V11 history.

**Architecture:** V12 owns its profile, evidence, recovery and CLI boundaries. It reuses only the deterministic four-slot execution engine through a V12-specific adapter. Normal application model gates stay default-off.

**Tech Stack:** Bun, TypeScript, NestJS, Prisma, Docker Compose, native Windows no-reparse durable I/O, Playwright/Chrome.

---

### Task 1: V12 identity, CLI and zero-side-effect preflight

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-product-acceptance-profile.ts`
- Create: `apps/server/src/review-agent/review-planner-v12-product-acceptance-*.ts`
- Create: matching `*.spec.ts`
- Modify: `apps/server/package.json`, `docs/acceptance-checklist.md`

- [ ] Write tests that reject every V11 confirmation/profile/root in V12 and
  prove V12 invalid confirmation or preflight reaches no owner, Docker,
  browser, API or provider boundary.
- [ ] Add V12 confirmation, schemas and unique public/recovery/execution/browser
  paths; add V12 product and recovery CLI scripts.
- [ ] Run focused tests and commit `feat(agent): add V12 acceptance identity`.

### Task 2: V12 durable ledger, attempt binding and earliest recovery

**Files:**
- Create: `apps/server/src/review-agent/review-planner-v12-product-acceptance-ledger.ts`
- Create: `apps/server/src/review-agent/review-planner-v12-product-acceptance-recovery.ts`
- Create: native Bun tests and focused specs

- [ ] Write native failing tests for V12 root isolation, one reservation,
  matching public/private attempt evidence, earliest no-checkpoint recovery,
  malformed checkpoint failure, and V11 byte/root immutability.
- [ ] Implement V12-only lease, ledger, execution manifest and recovery journal
  by applying the proven V11 no-reparse rules to V12 paths.
- [ ] Run native/focused tests and commit `feat(agent): add V12 durable recovery`.

### Task 3: V12 diagnostics, adapter and thin composition

**Files:**
- Create: `review-planner-v12-product-acceptance-diagnostics.ts`,
  `review-planner-v12-product-acceptance-execution.ts`,
  `review-planner-v12-product-acceptance-composition.ts` and tests
- Modify: `review-planner-v8-product-acceptance-runner.ts` and its tests

- [ ] Write failing tests proving V12 checkpoint/failure projection contains
  only fixed safe fields and that V8 runner can use V12 diagnostics without
  V11 profile access.
- [ ] Add the V12 adapter and composition with component-scoped live activation,
  strict facts/trace/slot checks, default-off restore and exact cleanup.
- [ ] Run focused tests and commit `feat(agent): wire V12 execution composition`.

### Task 4: Offline gates and immutable-history review

**Files:**
- Modify: V12 specs, acceptance checklist, DEVLOG, roadmap and AI behavior docs
- Create: `docs/acceptance/phase-6-9-5-review-planner-v12-offline-checkpoint.md`

- [ ] Run V12 Mock/fake, V11 regression, native, Agent/AI/Web/type/build/lint
  and Compose static gates.
- [ ] Record only gate counts, default-off proof, V10 authority, V11 terminal
  identity, V12 empty roots and cost/timeout bounds.
- [ ] Obtain independent contract and operations reviews, then commit
  `docs(agent): record V12 offline checkpoint`.

### Task 5: One V12 branch product, main replay and release

**Files:**
- Create V12 branch/main evidence only after the corresponding run
- Modify current acceptance/docs only after verified results

- [ ] Rebuild only `server` with `COMPOSE_BAKE=false`; verify healthy mock/default-off.
- [ ] Run exactly one V12 branch command with a headed browser. If it recovers,
  stop this lineage; never retry product.
- [ ] On success, verify evidence/cleanup, commit branch acceptance, merge
  `--no-ff` to main, execute one V12 main replay, verify browser/default-off,
  commit, push `origin/main` and prove SHA parity.
