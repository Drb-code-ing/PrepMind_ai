# Phase 6.9.4.3 Structured Output Headroom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Router / Verifier structured-output 单次上限统一为 400，并同步 Phase 6.9.4.3 paired eval 的 local/provider/global token 与成本合同。

**Architecture:** candidate 层负责单次 request/reservation，paired runner 负责跨 28 次调用的 admission，strict contract 机械重算 evidence，CLI 在网络前用同一全局上限做 pricing preflight。只修改这些既有边界的固定值，不新增 retry、repair parser 或生产 Chat 接入。

**Tech Stack:** TypeScript、Bun test、Zod 3、Vercel AI SDK 4、`@repo/agent`、`@repo/ai`

---

## 文件职责

- `packages/agent/src/model-candidates/router-model-candidate.ts`：Router 单次 400-token request/reservation。
- `packages/agent/src/model-candidates/knowledge-verifier-model-candidate.ts`：Verifier 单次 400-token request/reservation。
- `packages/agent/src/evals/run-phase-6-9-router-verifier-paired.ts`：per-agent budget、Live ceiling 与 28-call global cap。
- `packages/agent/src/evals/phase-6-9-router-verifier-paired-contract.ts`：strict evidence 的单次/aggregate output 与 reservation-cost 上界。
- `packages/agent/scripts/phase-6-9-4-3-paired-cli.ts`：零网络 pricing preflight 的 provider output cap。
- `packages/agent/tests/*.test.ts`：RED/GREEN 回归与边界证明。
- `docs/*`、`AGENTS.md`、`README.md`：持续合同、路线图、验收命令和回顾入口。

### Task 1: Candidate request headroom RED → GREEN

**Files:**
- Modify: `packages/agent/tests/router-model-candidate.test.ts`
- Modify: `packages/agent/tests/knowledge-verifier-model-candidate.test.ts`
- Modify: `packages/agent/src/model-candidates/router-model-candidate.ts`
- Modify: `packages/agent/src/model-candidates/knowledge-verifier-model-candidate.ts`

- [x] **Step 1: 先把既有 request/Trace 断言改为 400**

```ts
expect(request.maxOutputTokens).toBe(400);
expect(request.budget.maxOutputTokens).toBe(400);
expect(result.observation.trace?.maxOutputTokens).toBe(400);
```

同时把专门构造“恰好在 request output 上界”的 Verifier usage 从 180 改为 400；通用 budget helper 的示例 120 不属于 candidate 固定合同，不机械改写。

- [x] **Step 2: 运行目标测试并确认 RED**

```powershell
bun test packages/agent/tests/router-model-candidate.test.ts packages/agent/tests/knowledge-verifier-model-candidate.test.ts
```

Expected：至少一个断言显示 actual 仍为 Router 120 或 Verifier 180，而 expected 为 400；不得因语法错误失败。

- [x] **Step 3: 最小修改两个 candidate 常量**

```ts
const MAX_OUTPUT_TOKENS = 400;
```

- [x] **Step 4: 重跑目标测试并确认 GREEN**

```powershell
bun test packages/agent/tests/router-model-candidate.test.ts packages/agent/tests/knowledge-verifier-model-candidate.test.ts
```

Expected：目标测试全部通过。

### Task 2: Paired runner / strict contract / CLI RED → GREEN

**Files:**
- Modify: `packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts`
- Modify: `packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts`
- Modify: `packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts`
- Modify: `packages/agent/src/evals/run-phase-6-9-router-verifier-paired.ts`
- Modify: `packages/agent/src/evals/phase-6-9-router-verifier-paired-contract.ts`
- Modify: `packages/agent/scripts/phase-6-9-4-3-paired-cli.ts`

- [x] **Step 1: 更新边界测试的期望值**

```ts
const routerCeiling = { inputTokens: 2_400, outputTokens: 400 };
const verifierCeiling = { inputTokens: 4_800, outputTokens: 400 };
const completeGlobalUsage = {
  inputTokens: 96_000,
  outputTokens: 11_200,
  providerReported: true,
};
```

cost-stop 与 exact-equality 测试必须用 400 重新计算 reservation；strict contract 测试名改为 canonical `2400/400`；CLI preflight 增加一个定价边界用例，证明按 11,200 而非 4,080 计算时会在网络前拒绝。

- [x] **Step 2: 运行三组测试并确认 RED**

```powershell
bun test packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts
```

Expected：旧实现因 120/180/4,080/4,980 与新期望不一致而失败；Provider attempt 仍为 0。

- [x] **Step 3: 同步生产固定值**

```ts
// run-phase-6-9-router-verifier-paired.ts
const ROUTER_BUDGET = {
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: 800,
  usedInputTokens: 0,
  maxOutputTokens: 400,
  usedOutputTokens: 0,
};
const VERIFIER_BUDGET = {
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: 1_600,
  usedInputTokens: 0,
  maxOutputTokens: 400,
  usedOutputTokens: 0,
};
const GLOBAL_CAPS = {
  calls: 28,
  localInputTokens: 32_000,
  localOutputTokens: 11_200,
  providerInputTokens: 96_000,
  providerOutputTokens: 11_200,
  engineeringCostUsd: 0.1,
};
const LIVE_CASE_CEILINGS = {
  router: { inputTokens: 2_400, outputTokens: 400 },
  verifier: { inputTokens: 4_800, outputTokens: 400 },
};

// phase-6-9-router-verifier-paired-contract.ts
const LIVE_PROVIDER_CEILINGS = {
  router: { inputTokens: 2_400, outputTokens: 400 },
  verifier: { inputTokens: 4_800, outputTokens: 400 },
} as const;
const MAX_LIVE_RESERVATION_COST_USD = 5_200;

// phase-6-9-4-3-paired-cli.ts
const PROVIDER_OUTPUT_TOKEN_CAP = 11_200;
```

并把 strict aggregate usage 的两个 `> 4_080` 判断改为 `> 11_200`。

- [x] **Step 4: 重跑三组测试并确认 GREEN**

```powershell
bun test packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts
```

Expected：全部通过；Mock complete counters 仍为 `100/28/0/28/72`。

### Task 3: 文档同步与全量验收

**Files:**
- Modify: `docs/superpowers/specs/phase-6-9-4-3-router-verifier-paired-eval-design.md`
- Modify: `docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `docs/acceptance-checklist.md`
- Modify: `docs/roadmap.md`
- Modify: `AGENTS.md`
- Modify: `README.md`

- [x] **Step 1: 同步持续合同，不改写历史 evidence**

文档必须同时写明：新 output `400/400`、global `11,200`、worst-case `USD 0.017418937304`、仍为 28 calls / 72 zero-call / no retry / strict schema / candidate disabled；Attempt A/B/C 保留其运行当时的 120/180/4,080 事实。

- [x] **Step 2: 全量验证**

```powershell
bun test packages/agent/tests
bun run --cwd packages/agent typecheck
bun run --cwd packages/agent lint
bun run --cwd packages/agent eval:phase-6-9-4-1
bun run --cwd packages/agent eval:phase-6-9-4-3
bun run --cwd packages/agent eval:phase-6-9-4-3:validate -- --profile mock --file docs/acceptance/evidence/phase-6-9-4-3/mock.json
bun run --cwd packages/agent eval:phase-6-9-4-3:validate -- --profile live --file docs/acceptance/evidence/phase-6-9-4-3/live-20260714T022627206Z-08bddedf3f64.json
git diff --check
```

Expected：Agent tests/typecheck/lint exit 0；baseline `74/100、critical=2`；Mock CLI 为预期 exit 1 / complete；Mock/Live validator exit 0；历史 evidence blob 不变；无 credential/raw output 泄漏。

- [x] **Step 3: 规格审查、质量审查、单任务提交与 main 复验**

提交信息固定为：

```text
fix(agent): increase structured output headroom
```

合并信息固定为：

```text
merge: phase 6.9.4.3 structured output headroom
```

按仓库规范执行独立规格/质量审查，修复 Critical/Important；`--no-ff` 合并 main 后重复适用门禁，推送远程，核对 local/origin/remote main SHA，删除任务分支。下一任务才允许新的 controlled-Live。
