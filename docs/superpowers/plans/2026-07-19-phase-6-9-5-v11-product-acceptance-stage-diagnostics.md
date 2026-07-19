# Phase 6.9.5 V11 Product-Acceptance Stage Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a new V11 Review/Planner product-acceptance lineage diagnostically recoverable without exposing sensitive runtime data or changing the immutable V10 controlled-Live result.

**Architecture:** The generic product-acceptance ledger gains a strict, append-only checkpoint chain. The runner advances it before each external or validation boundary; recovery copies only the last safe checkpoint into a terminal failure record. V11 is isolated by profile identity and references committed V10 Live evidence; V8/V10 historical evidence remains untouched.

**Tech Stack:** TypeScript, Zod, Jest, Bun native NTFS tests, Docker Compose and Playwright adapters (not invoked by this offline task).

---

### Task 1: Define V11 Identity and Safe Checkpoint Contract

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-product-acceptance-profile.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-ledger.ts`
- Test: `apps/server/src/review-agent/review-planner-v8-product-acceptance-ledger.native.bun.test.ts`

- [ ] Write native tests that reserve V11 only, reject invalid/out-of-order/duplicate checkpoint values, reject forbidden keys, and verify V8/V10 readers retain their current contracts.
- [ ] Run the focused native test and observe failure because V11/profile/checkpoint APIs do not exist.
- [ ] Add V11 profile/schema identity and a strict `slot + stage` append-only ledger record. Only the current slot may advance; successful sealing includes the expected final checkpoint state.
- [ ] Run the focused native test again and commit the green contract.

### Task 2: Record Runner Boundaries and Recover the Last Safe Stage

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-runner.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-runner.spec.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-recovery.ts`
- Test: `apps/server/src/review-agent/review-planner-v8-product-acceptance-ledger.native.bun.test.ts`

- [ ] Write runner tests that make `dispatchApi`, `assertRequestResult`, and `readPersistedTraces` fail independently, then assert the persisted safe checkpoint is `api_dispatch`, `api_response_validate`, or `api_trace_read` with no raw error/capability leakage.
- [ ] Run the focused Jest test and observe failure because checkpoints are absent.
- [ ] Advance the checkpoint before each listed runner boundary. Recovery validates and copies only the last checkpoint into its terminal record; a missing/malformed checkpoint stays fail-closed.
- [ ] Run the focused Jest/native tests, V8/V10 regressions, typecheck, lint, and `git diff --check`; then commit the green implementation.

### Task 3: Record Offline Evidence and Prepare the Separate Product Gate

**Files:**
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `docs/acceptance-checklist.md`
- Create: `docs/acceptance/phase-6-9-5-review-planner-v11-offline-checkpoint.md`

- [ ] Record V10 controlled-Live as the immutable semantic-quality authority and V10 branch product evidence as recovery-only historical evidence.
- [ ] Record V11's new, empty directory/confirmation/profile requirements, finite checkpoint contract, no-retry/no-model-call scope of this task, and required gate order for a future separate Docker/headed-browser product acceptance.
- [ ] Run documentation consistency checks, full relevant offline suite, and `git diff --check`; commit the checkpoint.
