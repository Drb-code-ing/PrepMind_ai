# Phase 6.9.4.3 JSON Mode Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 将 Router / Verifier controlled-Live 从 strict-tool 收敛到已验证的 DeepSeek JSON mode，并完成一次可审计的完整 paired eval。

**Architecture:** `@repo/ai` 继续使用 `structuredOutputMode: 'json_object'` 的共享 executor；Agent contract 新增 runner-v3 与 `deepseek_json_object_v1` identity，历史 v1/v2 evidence 只读兼容。CLI 使用标准 DeepSeek URL、固定 JSON instruction、canonical Zod、既有预算/超时/脱敏边界。

**Tech Stack:** Bun, TypeScript, Vercel AI SDK, `@ai-sdk/openai`, Zod, DeepSeek OpenAI-compatible Chat API。

---

### Task 1: AI JSON-mode provider contract

**Files:**
- Modify: `packages/ai/tests/model-agent-provider.test.ts`
- Modify: `packages/ai/src/model-agent-provider.ts` only if RED exposes a missing contract

- [ ] **Step 1: Write the failing test** asserting a live JSON-mode executor sends `response_format: { type: 'json_object' }`, sends no `tools/tool_choice/json_schema`, and accepts the standard `https://api.deepseek.com` base URL.
- [ ] **Step 2: Run the focused AI test and verify it fails** because the current test only covers the old generic JSON path and does not assert the new composition contract.
- [ ] **Step 3: Make the smallest provider/composition change** needed to expose the JSON-mode contract without changing strict-tool behavior or package-level env access.
- [ ] **Step 4: Run focused AI tests, typecheck and lint**; expected all pass with no network.
- [ ] **Step 5: Commit** `test(ai): lock JSON mode provider wire` (or `fix(ai): ...` if implementation changes are required).

### Task 2: Runner-v3 and evidence identity

**Files:**
- Modify: `packages/agent/src/evals/phase-6-9-router-verifier-paired-contract.ts`
- Modify: `packages/agent/src/evals/run-phase-6-9-router-verifier-paired.ts`
- Modify: `packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts`
- Modify: `packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts`

- [ ] **Step 1: Write RED tests** requiring current Live evidence to use `phase-6.9.4.3-runner-v3` + `deepseek_json_object_v1`, while preserving historical v1/v2 validator compatibility and rejecting missing/wrong transport identity.
- [ ] **Step 2: Run the focused contract/runner tests and verify the new expectations fail** against the current v2 strict-tool constants.
- [ ] **Step 3: Implement the v3 constants and identity checks**; keep Mock transport fields forbidden and keep historical evidence read-only compatible.
- [ ] **Step 4: Run the focused contract/runner tests**; expected all pass and no evidence fixture is rewritten.
- [ ] **Step 5: Commit** `feat(agent): add JSON mode runner evidence identity`.

### Task 3: CLI JSON-mode composition and documentation

**Files:**
- Modify: `packages/agent/scripts/phase-6-9-4-3-paired-cli.ts`
- Modify: `packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts`
- Modify: `docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md`
- Modify: `docs/acceptance-checklist.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `README.md`, `AGENTS.md`, `docs/roadmap.md`, `DEVLOG.md`

- [ ] **Step 1: Write RED tests** requiring exact standard base URL, JSON instruction, `structuredOutputMode: 'json_object'`, no strict-tool schema profiles, and runner-v3 output.
- [ ] **Step 2: Run the CLI tests and verify the expected failures** against Beta URL/strict-tool composition.
- [ ] **Step 3: Implement the minimal CLI switch**: standard URL, JSON-mode executor, fixed prompt version/instruction, and v3 evidence identity; retain pricing, key shape, preflight, budget, timeout, cleanup and no-retry boundaries.
- [ ] **Step 4: Run full zero-network gates**: Agent tests, AI tests, typecheck/lint, deterministic baseline, Mock eval, strict validator, forbidden-field scan, and local-link scan.
- [ ] **Step 5: Commit** `feat(agent): resolve paired eval with JSON mode`.
- [ ] **Step 6: Request review, then run one complete controlled-Live** only after the zero-network gates pass; stop on the first failure, preserve evidence, and never patch-run or concatenate history.

### Task 4: Integration and final decision

- [ ] **Step 1: Update all stage docs with actual JSON-mode evidence and result.**
- [ ] **Step 2: Run main-branch verification after `--no-ff` merge.**
- [ ] **Step 3: Push main and verify local/tracking/remote SHA equality.**
- [ ] **Step 4: If complete, record enablement decision; if incomplete, record the terminal fallback decision and keep Router/Verifier disabled.**
