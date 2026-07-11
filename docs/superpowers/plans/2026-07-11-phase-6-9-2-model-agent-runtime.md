# Phase 6.9.2 Shared Model Agent Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `@repo/ai` 建立供 Router、Verifier、Memory、摘要和 Orchestrator 复用的结构化模型运行时，统一 Mock/Live guard、Zod 输出、调用预算、超时、脱敏错误和安全 Trace metadata。

**Architecture:** `@repo/ai` 只接收调用方注入的 executor，不读取环境变量；API key 只被 OpenAI-compatible executor closure 持有。每个 Agent run 使用独立不可变 budget state，所有调用先 fail-closed 预留预算，再执行 Mock responder 或 Live executor。运行结果只返回结构化 data、usage、next budget 和脱敏 metadata，不返回完整 prompt、完整输出、API key、base URL 或 provider 原始错误。

**Tech Stack:** TypeScript strict、Bun test、Zod 3、Vercel AI SDK 4、OpenAI-compatible provider

---

## 范围与文件结构

- Delete: `packages/ai/src/llm-factory.ts` — 删除没有真实能力且无人使用的 provider 占位工厂。
- Delete: `packages/ai/src/streaming.ts` — 删除会直接抛 `Not implemented` 的占位导出。
- Create: `packages/ai/src/model-agent-contract.ts` — task、config、budget、request、result、executor、trace contract。
- Create: `packages/ai/src/model-agent-budget.ts` — 不可变 run budget 创建和 fail-closed reservation。
- Create: `packages/ai/src/model-agent-runtime.ts` — Mock/Live 结构化调用、timeout、schema parse、错误分类。
- Create: `packages/ai/src/model-agent-provider.ts` — OpenAI/DeepSeek 兼容的 AI SDK `generateObject` executor。
- Create: `packages/ai/src/model-agent-safety.ts` — 固定安全错误、结构码和 trace metadata 构造。
- Create: `packages/ai/tests/model-agent-budget.test.ts` — 数值、调用次数和累计 token 门槛。
- Create: `packages/ai/tests/model-agent-runtime.test.ts` — Mock/Live、schema、timeout、abort、错误脱敏。
- Create: `packages/ai/tests/model-agent-provider.test.ts` — provider adapter 参数与 usage 映射，不访问网络。
- Create: `packages/ai/eslint.config.mjs` — AI workspace 自包含语义 lint。
- Modify: `packages/ai/package.json`, `bun.lock`, `packages/ai/src/index.ts` — scripts、依赖和公开导出。
- Modify: `AGENTS.md`, `README.md`, `docs/roadmap.md`, `docs/data-flow.md`, `docs/acceptance-checklist.md`, `docs/ai-behavior-acceptance.md`, `DEVLOG.md` — 同步现行边界和下一任务。

本任务不修改 `/api/chat` streaming，不接入任何业务 Agent，不调用真实模型，不启动 Docker 或浏览器。

## 实施任务

### Task 1: 共享 Model Agent Runtime

整个 Phase 6.9.2 使用一个实现分支和一个实现提交。以下步骤均为同一任务内的 TDD 小步。

- [ ] **Step 1: 写 budget 与非法配置的失败测试**

创建 `packages/ai/tests/model-agent-budget.test.ts`，使用期望 API：

```ts
import { describe, expect, it } from 'bun:test';

import {
  createModelAgentBudget,
  reserveModelAgentBudget,
} from '../src/model-agent-budget';

describe('model agent run budget', () => {
  it('reserves calls and cumulative tokens immutably', () => {
    const initial = createModelAgentBudget({
      maxCalls: 2,
      maxInputTokens: 1000,
      maxOutputTokens: 400,
    });
    const first = reserveModelAgentBudget(initial, {
      inputTokens: 300,
      outputTokens: 120,
    });

    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('expected reservation');
    expect(first.budget).toEqual({
      maxCalls: 2,
      usedCalls: 1,
      maxInputTokens: 1000,
      usedInputTokens: 300,
      maxOutputTokens: 400,
      usedOutputTokens: 120,
    });
    expect(initial.usedCalls).toBe(0);
  });

  it.each([
    { maxCalls: 0, maxInputTokens: 1000, maxOutputTokens: 400 },
    { maxCalls: 2, maxInputTokens: Number.NaN, maxOutputTokens: 400 },
    { maxCalls: 2, maxInputTokens: 1000, maxOutputTokens: -1 },
  ])('rejects invalid limits fail-closed', (limits) => {
    expect(() => createModelAgentBudget(limits)).toThrow('INVALID_MODEL_AGENT_BUDGET');
  });
});
```

追加测试：累计 call/input/output 任一超限分别返回 `CALL_BUDGET_EXCEEDED`、
`INPUT_BUDGET_EXCEEDED`、`OUTPUT_BUDGET_EXCEEDED`；`NaN/Infinity/负数/小数 token` 返回
`INVALID_MODEL_AGENT_BUDGET`，不能因为数值比较为 false 而放行。

- [ ] **Step 2: 运行 budget 测试并确认 RED**

Run: `bun test packages/ai/tests/model-agent-budget.test.ts`

Expected: FAIL，原因是 `model-agent-budget` 不存在。

- [ ] **Step 3: 实现 contract 和不可变 budget**

`model-agent-contract.ts` 定义：

```ts
import type { z } from 'zod';

export type ModelAgentTask =
  | 'conversation_summary'
  | 'router_fallback'
  | 'knowledge_verification'
  | 'memory_candidate_extraction'
  | 'tool_orchestration';
export type ModelAgentMode = 'mock' | 'live';
export type ModelAgentProvider = 'mock' | 'deepseek' | 'openai';

export type ModelAgentRunBudget = {
  maxCalls: number;
  usedCalls: number;
  maxInputTokens: number;
  usedInputTokens: number;
  maxOutputTokens: number;
  usedOutputTokens: number;
};

export type ModelAgentRequest<T> = {
  runId: string;
  task: ModelAgentTask;
  schema: z.ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
  estimatedInputTokens: number;
  maxOutputTokens: number;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
};

export type StructuredModelExecutor = <T>(input: {
  schema: z.ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
  signal: AbortSignal;
}) => Promise<{
  object: unknown;
  usage?: { inputTokens?: number; outputTokens?: number };
}>;
```

`model-agent-budget.ts` 必须只接受有限非负整数；limits 必须大于 0。Reservation 失败返回
`{ ok:false, code }`，成功返回新 budget，不修改输入对象。预留 output 使用请求的
`maxOutputTokens`，成功后再用 provider 实际 usage 只做观测，不退还预算，避免并发重入超卖。

- [ ] **Step 4: 运行 budget 测试并确认 GREEN**

Run: `bun test packages/ai/tests/model-agent-budget.test.ts`

Expected: 全部 PASS，0 FAIL。

- [ ] **Step 5: 写 Mock runtime 的失败测试**

创建 `packages/ai/tests/model-agent-runtime.test.ts`，使用 Zod schema：

```ts
import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { createModelAgentBudget } from '../src/model-agent-budget';
import { createModelAgentRuntime } from '../src/model-agent-runtime';

const routeSchema = z.object({ route: z.enum(['chat', 'tutor']) }).strict();

it('parses mock output through the same schema without live executor', async () => {
  const runtime = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'mock-agent-runtime',
    liveCallsEnabled: false,
    timeoutMs: 100,
    mockResponder: () => ({ route: 'tutor' }),
  });
  const result = await runtime.invokeStructured({
    runId: 'run_1',
    task: 'router_fallback',
    schema: routeSchema,
    systemPrompt: 'system',
    userPrompt: 'question',
    estimatedInputTokens: 20,
    maxOutputTokens: 30,
    budget: createModelAgentBudget({
      maxCalls: 1,
      maxInputTokens: 100,
      maxOutputTokens: 50,
    }),
  });

  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  expect(result.data).toEqual({ route: 'tutor' });
  expect(result.trace).toMatchObject({
    mode: 'mock', provider: 'mock', model: 'mock-agent-runtime',
    task: 'router_fallback', inputTokens: 20, maxOutputTokens: 30,
  });
  expect(JSON.stringify(result)).not.toContain('question');
});
```

追加失败测试：Mock 输出 schema invalid 返回 `SCHEMA_INVALID`；prompt 为空、input estimate 非法、
单次 output 超 budget 均在调用 responder 前拒绝；result/trace 不含 system/user prompt。

- [ ] **Step 6: 运行 Mock runtime 测试并确认 RED**

Run: `bun test packages/ai/tests/model-agent-runtime.test.ts`

Expected: FAIL，原因是 `model-agent-runtime` 不存在。

- [ ] **Step 7: 实现安全错误和 Mock runtime**

Runtime factory config 固定为：

```ts
export type CreateModelAgentRuntimeInput = {
  mode: ModelAgentMode;
  provider: ModelAgentProvider;
  model: string;
  liveCallsEnabled: boolean;
  timeoutMs: number;
  mockResponder?: (input: { task: ModelAgentTask }) => unknown | Promise<unknown>;
  executor?: StructuredModelExecutor;
  now?: () => number;
};
```

配置中的 model 必须是 1~120 字符的结构化名称，timeout 必须是 50~60,000ms 的有限整数。
Runtime 先校验请求与 budget、执行 reservation，再调用 responder。所有失败只返回：

```ts
type ModelAgentErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_RUNTIME_CONFIG'
  | 'LIVE_CALLS_DISABLED'
  | 'EXECUTOR_UNAVAILABLE'
  | 'CALL_BUDGET_EXCEEDED'
  | 'INPUT_BUDGET_EXCEEDED'
  | 'OUTPUT_BUDGET_EXCEEDED'
  | 'SCHEMA_INVALID'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'PROVIDER_ERROR';
```

错误 message 使用固定安全文案；不得拼接 raw error。Trace 只包含 runId hash、task、mode、provider、
model、成功/失败、结构错误码、input/output token、maxOutputTokens、durationMs 和 degraded；不得包含
prompt、object、API key、baseURL 或 stack。

- [ ] **Step 8: 写 Live guard、timeout 与脱敏失败测试**

在 runtime 测试追加：

- mode=`live` 且 `liveCallsEnabled=false`：返回 `LIVE_CALLS_DISABLED`，executor 调用数 0；
- mode=`live` 且没有 executor：返回 `EXECUTOR_UNAVAILABLE`；
- executor resolve 合法 object：返回 parsed data 与规范化 usage；
- executor 抛含 credential/provider 原文的 Error：只返回 `PROVIDER_ERROR` 固定文案；
- executor 超过 timeout：AbortSignal 变为 aborted，返回 `TIMEOUT`；
- 外部 signal 先 abort：返回 `ABORTED`；
- executor 返回负数、NaN 或小数 usage：观测 token 归一为非负整数 0，不影响已预留 budget；
- 所有失败 result JSON 都不含 systemPrompt、userPrompt、raw error、API key 形态或 provider response。

- [ ] **Step 9: 运行 Live 测试并确认 RED，再实现 GREEN**

Run: `bun test packages/ai/tests/model-agent-runtime.test.ts`

Expected RED: Live/timeout/error 分支断言失败。

实现时 timeout 使用内部 `AbortController` 和明确清理 timer；外部 signal 通过 listener 转发并在
finally 移除。Zod parse 失败统一 `SCHEMA_INVALID`；其他 executor rejection 统一
`PROVIDER_ERROR`，超时和外部 abort 分开分类。然后重跑，Expected GREEN: 全部 PASS。

- [ ] **Step 10: 写 provider adapter 的失败测试**

创建 `packages/ai/tests/model-agent-provider.test.ts`，向 factory 注入 fake `createProvider` 和
`generateObject`，断言：

- provider factory 收到 trim 后的 apiKey/baseURL，但返回的 executor 对象没有公开 key 字段；
- executor 向 `generateObject` 传 model、schema、system、prompt、maxTokens 和 abortSignal；
- AI SDK usage `promptTokens/completionTokens` 映射为 `inputTokens/outputTokens`；
- 空 key、非 HTTPS baseURL、空 model 在调用依赖前 fail-closed；
- provider 原始 response 和 headers 不进入 executor 返回值。

Run: `bun test packages/ai/tests/model-agent-provider.test.ts`

Expected: FAIL，原因是 provider adapter 不存在。

- [ ] **Step 11: 实现 OpenAI-compatible structured executor**

`createOpenAICompatibleStructuredExecutor()` 接收：

```ts
type OpenAICompatibleExecutorConfig = {
  provider: 'deepseek' | 'openai';
  apiKey: string;
  baseURL: string;
  model: string;
};
```

默认依赖使用 `createOpenAI()` 和 AI SDK `generateObject()`；测试可注入等价 dependency object。
只允许 HTTPS baseURL；本地 Mock 不使用该 adapter。闭包之外只返回 `StructuredModelExecutor`，
不得暴露 config 或 provider instance。完成后 provider 测试必须全绿。

- [ ] **Step 12: 清理占位实现并建立稳定公开导出**

确认 `rg` 没有消费者后删除 `llm-factory.ts` 和 `streaming.ts`。`packages/ai/src/index.ts` 只导出：

```ts
export * from './model-agent-budget.ts';
export * from './model-agent-contract.ts';
export * from './model-agent-provider.ts';
export * from './model-agent-runtime.ts';
export * from './model-agent-safety.ts';
```

`packages/ai/package.json` 增加 `test: "bun test tests"`、`zod` 显式 dependency 和与
`@repo/agent` 同标准的 workspace ESLint/Prettier devDependencies；新增独立 flat config。
Runtime import 测试必须从 `@repo/ai` 导入 factory 并断言占位 `streamText/generateObject` 不再导出。

- [ ] **Step 13: 同步文档**

文档必须说明：

- Phase 6.9.2 只交付共享结构化 runtime，现有 `/api/chat` streaming 行为与 Web provider 未迁移；
- `@repo/ai` 不读 env，API key 只在 composition root 创建 executor 时传入 closure；
- Mock 和 Live 使用同一 Zod schema、budget、result 和 trace contract；
- live 双开关仍由调用方权威解析，runtime 再检查 `liveCallsEnabled`，形成双层 guard；
- raw prompt/output/error/key/baseURL 不进入 result 或 Trace；
- 本阶段没有任何真实模型调用，下一任务 Phase 6.9.3 是 ConversationSummary、ConversationState
  与分层 context budget，不应描述 Router/Verifier/Memory 已模型化；
- Phase 6.9.7 详细面试博客继续保留。

`DEVLOG.md` 记录为什么、实现、边界、测试和回顾问题：

- “为什么 ModelAgentRuntime 不直接读取环境变量？”
- “为什么 budget 要在调用前按 max output 预留，而不是等待 usage 后扣减？”
- “为什么 Phase 6.9.2 不迁移现有 Chat streaming？”
- “Mock 和 Live 如何保证使用同一结构化 contract？”

- [ ] **Step 14: 完整验证与独立审查**

Run:

```powershell
bun --cwd packages/ai test
bun --cwd packages/ai typecheck
bun --cwd packages/ai lint
bun --cwd packages/ai prettier --check "src/**/*.ts" "tests/**/*.ts" "eslint.config.mjs" --end-of-line auto
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
git diff --check
```

Expected: AI runtime 全套测试通过，AI/Agent typecheck 通过，lint/format/diff check 退出码 0。
再做只读独立审查，重点检查 fail-open 数值、budget 并发语义、timeout listener/timer 清理、schema
绕过、raw error/prompt/key 泄露和 provider adapter 是否意外公开 config。

- [ ] **Step 15: 创建唯一实现提交**

确认 diff 只包含本计划文件、AI runtime/tests/tooling、lockfile 和同步文档，没有 `.env`、真实 key、
provider 原始响应或用户数据。提交：

```powershell
git add packages/ai bun.lock AGENTS.md README.md DEVLOG.md `
  docs/roadmap.md docs/data-flow.md docs/acceptance-checklist.md `
  docs/ai-behavior-acceptance.md `
  docs/superpowers/plans/2026-07-11-phase-6-9-2-model-agent-runtime.md
git commit -m "feat(ai): add shared model agent runtime"
```

- [ ] **Step 16: 功能分支验收、合并 main、复验并推送**

在功能分支重跑 Step 14。通过后：

```powershell
git switch main
git merge --no-ff codex/phase-6-9-2-model-agent-runtime -m "merge: phase 6.9.2 model agent runtime"
```

在 `main` 再完整运行 Step 14，显式检查每个 native command 的退出码；通过后
`git push origin main`，核对本地、tracking ref 和远程 SHA 一致。本任务没有真实页面和 live
调用，因此不启动 Docker/浏览器；后续接入真实 Agent 行为时再执行受控 Live 与可见浏览器验收。
