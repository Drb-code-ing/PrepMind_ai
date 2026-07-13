# Phase 6.9.4.3 Provider Failure Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 在共享 @repo/ai Provider/Runtime 边界建立八类脱敏失败诊断，并让 Phase 6.9.4.3 paired eval 在不泄露原始错误的前提下记录分类。

**Architecture:** AI SDK 异常只在 Provider adapter 内通过官方 isInstance 守卫分类，随后立即丢弃原始异常，并通过模块私有 WeakMap 信号把固定枚举传给 ModelAgentRuntime。Runtime Error/Trace、Agent strict sanitizer 和 paired evidence 逐层校验同一枚举；历史 evidence 继续兼容，生产 Trace API/UI、数据库和自动重试保持不变。

**Tech Stack:** TypeScript、Bun test、Zod 3、Vercel AI SDK 4.3.19、@ai-sdk/openai 1.3.24、共享 @repo/ai Runtime、@repo/agent paired eval。

---

## 0. 执行约束

- 本计划只做 Mock/fake executor 测试，所有 Task 禁止设置 AI_PROVIDER_MODE=live 或 AI_ENABLE_LIVE_CALLS=true。
- 不读取、打印或注入根 .env 的 DEEPSEEK_API_KEY。
- 不启动、清空或重建 Docker、PostgreSQL、Redis、MinIO、volume 和测试账号。
- 不修改 Prisma、NestJS Trace API、Web/Admin UI、Chat prompt、数据集、质量阈值和 enablement 决策。
- 每个 Task 都必须从当时最新、已推送且工作区干净的 main 新开 codex/ 分支；不得从上一个功能分支开分支。
- 每个 Task 只产生一个语义提交；先做规格审查，再做质量审查，然后 --no-ff 合并 main、在 main 复验、推送、核对本地/origin/远程 SHA，最后删除已合并分支。
- 使用子代理时按顺序执行实现、规格审查、质量审查，同一时刻最多一个审查代理；全局并发子代理不得超过 3。
- 任何失败测试都要确认是预期缺口导致，不得用放宽 schema、删除断言或跳过测试的方式转绿。
- 历史 evidence 文件只读：
  - docs/acceptance/evidence/phase-6-9-4-3/live-20260713T122743752Z-46b0f4785861.json
  - docs/acceptance/evidence/phase-6-9-4-3/live-20260713T124435253Z-4d37573c86dc.json
- “历史兼容”的精确定义是缺失 providerFailureCategory 不会新增 schema failure，同时保持原有 validator 判定：Attempt A 仍因既有 filename identity mismatch 被拒绝，Attempt B 仍应通过并保持 live/incomplete。不得为了让 Attempt A 通过而改写文件或放宽 identity guard。

## 1. 文件职责图

### 新建文件

- packages/ai/src/model-agent-provider-failure.ts：AI SDK 异常分类、固定安全 signal、模块私有 WeakMap 注册表。
- packages/ai/tests/model-agent-provider-failure.test.ts：八类映射、hostile object、防泄漏和不可伪造测试。
- packages/agent/tests/model-candidate-runtime-result.test.ts：candidate sanitizer 独立合同矩阵。

### 修改文件

- packages/ai/src/model-agent-contract.ts：唯一分类常量、类型以及 Error/Trace 可选字段。
- packages/ai/src/model-agent-provider.ts：把 generateObject 异常转换为内部安全 signal。
- packages/ai/src/model-agent-runtime.ts：保留 timeout/abort 优先级，并把安全分类写入 Error/Trace。
- packages/ai/src/model-agent-safety.ts：固定 retryable 映射与安全错误重建。
- packages/ai/tests/model-agent-provider.test.ts：adapter 分类与无自动重试回归。
- packages/ai/tests/model-agent-runtime.test.ts：Error/Trace 一致性、unknown fallback、取消优先级和防泄漏。
- packages/agent/src/model-candidates/model-candidate-runtime-result.ts：strict schema、合法组合校验和白名单重建。
- packages/agent/src/evals/phase-6-9-router-verifier-paired-contract.ts：evidence entry 可选分类及位置不变量。
- packages/agent/src/evals/run-phase-6-9-router-verifier-paired.ts：从 sanitizer 后的 Trace 复制分类，并在 provider counter 不一致时移除。
- packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts：历史兼容和非法 evidence 组合。
- packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts：Live attempted failure 分类传播。
- packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts：validator 对新旧 evidence 的兼容。
- docs/superpowers/specs/2026-07-13-phase-6-9-4-3-provider-failure-diagnostics-design.md：实施状态。
- docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md：诊断实现检查点和下一任务。
- docs/acceptance-checklist.md：受控 Live 前的分类合同检查。
- docs/roadmap.md：Phase 6.9.4.3 当前进度。
- AGENTS.md：仓库交接快照和下一任务。

## 2. Task 级 Git 模板

每个 Task 开始前执行以下只读门禁；branch-name 替换为该 Task 明确给出的分支名：

~~~powershell
git switch main
git fetch origin main
if (git status --porcelain) { throw 'WORKTREE_NOT_CLEAN' }
$local = (git rev-parse main).Trim()
$tracking = (git rev-parse origin/main).Trim()
$remote = (((git ls-remote --heads origin main).Trim()) -split '\s+')[0]
if ($local -ne $tracking -or $local -ne $remote) { throw 'MAIN_NOT_SYNCED' }
git switch -c branch-name main
~~~

每个 Task 的提交只能 stage 其 Files 清单。提交后先检查 feature diff，再按该 Task 给出的 main 验证命令完成合并：

~~~powershell
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'STAGED_DIFF_CHECK_FAILED' }
git commit -m "task-specific-message"
git switch main
git merge --no-ff branch-name -m "task-specific-merge-message"
~~~

main 验证成功后执行：

~~~powershell
git push origin main
git fetch origin main
$local = (git rev-parse main).Trim()
$tracking = (git rev-parse origin/main).Trim()
$remote = (((git ls-remote --heads origin main).Trim()) -split '\s+')[0]
if ($local -ne $tracking -or $local -ne $remote) { throw 'POST_PUSH_SHA_MISMATCH' }
git branch -d branch-name
if (git status --porcelain) { throw 'POST_TASK_WORKTREE_NOT_CLEAN' }
~~~

---

### Task 1: 建立共享分类合同和不可伪造 Provider failure signal

**Branch:** codex/phase-6-9-4-3-provider-failure-contract

**Commit:** feat(ai): classify provider failures safely

**Files:**

- Create: packages/ai/src/model-agent-provider-failure.ts
- Create: packages/ai/tests/model-agent-provider-failure.test.ts
- Modify: packages/ai/src/model-agent-contract.ts

- [ ] **Step 1: 从最新已推送 main 创建 Task 1 分支**

按第 2 节门禁创建 codex/phase-6-9-4-3-provider-failure-contract。

- [ ] **Step 2: 写分类合同和防泄漏失败测试**

新建 packages/ai/tests/model-agent-provider-failure.test.ts，使用以下完整测试骨架：

~~~ts
import { describe, expect, test } from 'bun:test';
import {
  APICallError,
  EmptyResponseBodyError,
  InvalidResponseDataError,
  JSONParseError,
  NoObjectGeneratedError,
  TypeValidationError,
} from 'ai';

import { MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES } from '../src/model-agent-contract';
import {
  createModelAgentProviderFailureSignal,
  readModelAgentProviderFailureCategory,
} from '../src/model-agent-provider-failure';

const RAW_CANARY = 'RAW_PROVIDER_SECRET_CANARY';

describe('model agent provider failure classification', () => {
  test('freezes the eight low-cardinality categories', () => {
    expect(MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES).toEqual([
      'http_auth',
      'http_rate_limit',
      'http_client',
      'http_server',
      'transport',
      'structured_output',
      'invalid_response',
      'unknown',
    ]);
  });

  test.each([
    [apiError(401), 'http_auth'],
    [apiError(403), 'http_auth'],
    [apiError(429), 'http_rate_limit'],
    [apiError(400), 'http_client'],
    [apiError(422), 'http_client'],
    [apiError(500), 'http_server'],
    [apiError(503), 'http_server'],
    [apiError(undefined), 'transport'],
    [
      new NoObjectGeneratedError({
        message: RAW_CANARY,
        cause: new Error(RAW_CANARY),
        text: RAW_CANARY,
        response: undefined as never,
        usage: undefined as never,
        finishReason: undefined as never,
      }),
      'structured_output',
    ],
    [new JSONParseError({ text: RAW_CANARY, cause: new Error(RAW_CANARY) }), 'structured_output'],
    [new TypeValidationError({ value: RAW_CANARY, cause: new Error(RAW_CANARY) }), 'structured_output'],
    [new EmptyResponseBodyError({ message: RAW_CANARY }), 'invalid_response'],
    [new InvalidResponseDataError({ data: RAW_CANARY, message: RAW_CANARY }), 'invalid_response'],
    [apiError(600), 'unknown'],
    [new Error(RAW_CANARY), 'unknown'],
  ] as const)('maps a guarded SDK error to %s', (error, expected) => {
    const signal = createModelAgentProviderFailureSignal(error);

    expect(readModelAgentProviderFailureCategory(signal)).toBe(expected);
    expect(signal.name).toBe('ModelAgentProviderFailure');
    expect(signal.message).toBe('MODEL_AGENT_PROVIDER_REQUEST_FAILED');
    expect((signal as Error & { cause?: unknown }).cause).toBeUndefined();
    expect([signal.name, signal.message, JSON.stringify(signal)].join('|')).not.toContain(RAW_CANARY);
  });

  test('contains hostile values and refuses forged public fields', () => {
    const hostile = new Proxy({}, {
      get() {
        throw new Error(RAW_CANARY);
      },
      getPrototypeOf() {
        throw new Error(RAW_CANARY);
      },
    });
    const signal = createModelAgentProviderFailureSignal(hostile);

    expect(readModelAgentProviderFailureCategory(signal)).toBe('unknown');
    expect(readModelAgentProviderFailureCategory({ category: 'http_auth' })).toBeUndefined();
    expect(readModelAgentProviderFailureCategory(Object.create(signal))).toBeUndefined();
    expect(JSON.stringify(signal)).not.toContain(RAW_CANARY);
  });
});

function apiError(statusCode: number | undefined) {
  return new APICallError({
    message: RAW_CANARY,
    url: 'https://private.example/' + RAW_CANARY,
    requestBodyValues: { secret: RAW_CANARY },
    statusCode,
    responseHeaders: { authorization: RAW_CANARY },
    responseBody: RAW_CANARY,
    cause: new Error(RAW_CANARY),
    isRetryable: true,
    data: { raw: RAW_CANARY },
  });
}
~~~

- [ ] **Step 3: 运行测试并确认红灯来自缺失合同**

Run:

~~~powershell
bun test packages/ai/tests/model-agent-provider-failure.test.ts
~~~

Expected: FAIL，错误明确指向 MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES 或 model-agent-provider-failure 模块不存在；不得出现网络请求。

- [ ] **Step 4: 在共享合同中增加唯一枚举和可选字段**

在 packages/ai/src/model-agent-contract.ts 的 Provider 类型后增加：

~~~ts
export const MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES = [
  'http_auth',
  'http_rate_limit',
  'http_client',
  'http_server',
  'transport',
  'structured_output',
  'invalid_response',
  'unknown',
] as const;

export type ModelAgentProviderFailureCategory =
  (typeof MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES)[number];
~~~

将 ModelAgentError 和 ModelAgentTrace 精确扩展为：

~~~ts
export type ModelAgentError = {
  code: ModelAgentErrorCode;
  message: string;
  retryable: boolean;
  providerFailureCategory?: ModelAgentProviderFailureCategory;
};
~~~

~~~ts
export type ModelAgentTrace = ModelAgentUsage & {
  runIdHash: string;
  task: ModelAgentTask | 'invalid_request';
  mode: ModelAgentMode;
  provider: ModelAgentProvider;
  model: string;
  status: 'succeeded' | 'failed';
  maxOutputTokens: number;
  durationMs: number;
  degraded: boolean;
  errorCode?: ModelAgentErrorCode;
  providerFailureCategory?: ModelAgentProviderFailureCategory;
};
~~~

- [ ] **Step 5: 实现内部 classifier 和 WeakMap signal**

新建 packages/ai/src/model-agent-provider-failure.ts：

~~~ts
import {
  APICallError,
  EmptyResponseBodyError,
  InvalidResponseDataError,
  JSONParseError,
  NoObjectGeneratedError,
  TypeValidationError,
} from 'ai';

import type { ModelAgentProviderFailureCategory } from './model-agent-contract';

const FAILURE_SIGNAL_NAME = 'ModelAgentProviderFailure';
const FAILURE_SIGNAL_MESSAGE = 'MODEL_AGENT_PROVIDER_REQUEST_FAILED';
const FAILURE_CATEGORIES = new WeakMap<object, ModelAgentProviderFailureCategory>();

export function createModelAgentProviderFailureSignal(error: unknown): Error {
  const signal = new Error(FAILURE_SIGNAL_MESSAGE);
  signal.name = FAILURE_SIGNAL_NAME;
  FAILURE_CATEGORIES.set(signal, classifyModelAgentProviderFailure(error));
  return signal;
}

export function readModelAgentProviderFailureCategory(
  value: unknown,
): ModelAgentProviderFailureCategory | undefined {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return undefined;
  }
  try {
    return FAILURE_CATEGORIES.get(value);
  } catch {
    return undefined;
  }
}

function classifyModelAgentProviderFailure(
  error: unknown,
): ModelAgentProviderFailureCategory {
  if (
    safeGuard(() => NoObjectGeneratedError.isInstance(error)) ||
    safeGuard(() => JSONParseError.isInstance(error)) ||
    safeGuard(() => TypeValidationError.isInstance(error))
  ) {
    return 'structured_output';
  }
  if (
    safeGuard(() => EmptyResponseBodyError.isInstance(error)) ||
    safeGuard(() => InvalidResponseDataError.isInstance(error))
  ) {
    return 'invalid_response';
  }
  if (!safeGuard(() => APICallError.isInstance(error))) return 'unknown';

  try {
    const statusCode = error.statusCode;
    if (statusCode === undefined) return 'transport';
    if (!Number.isSafeInteger(statusCode)) return 'unknown';
    if (statusCode === 401 || statusCode === 403) return 'http_auth';
    if (statusCode === 429) return 'http_rate_limit';
    if (statusCode >= 400 && statusCode <= 499) return 'http_client';
    if (statusCode >= 500 && statusCode <= 599) return 'http_server';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function safeGuard(check: () => boolean): boolean {
  try {
    return check();
  } catch {
    return false;
  }
}
~~~

不要从 packages/ai/src/index.ts 导出 model-agent-provider-failure；Provider 和 Runtime 使用相对路径导入，业务调用方只能看到公共枚举与 Error/Trace 字段。

- [ ] **Step 6: 运行 Task 1 全量验证**

Run:

~~~powershell
bun test packages/ai/tests/model-agent-provider-failure.test.ts
bun --cwd packages/ai test
bun --cwd packages/ai typecheck
bun --cwd packages/ai lint
~~~

Expected: 新测试全绿；@repo/ai 全量 test、typecheck、lint exit 0；无网络调用。

- [ ] **Step 7: 规格审查后再做质量审查**

规格审查逐项确认八类映射、仅外层错误、不读 cause、WeakMap 不可伪造、内部模块不从根导出。规格审查通过后，质量审查检查静态守卫异常、非法 status、对象引用和 canary 泄漏。修复必须重新运行 Step 6。

- [ ] **Step 8: 提交、合并、main 复验并推送**

Stage 仅限 Task 1 三个文件，提交：

~~~powershell
git add packages/ai/src/model-agent-contract.ts packages/ai/src/model-agent-provider-failure.ts packages/ai/tests/model-agent-provider-failure.test.ts
git diff --cached --check
git commit -m "feat(ai): classify provider failures safely"
git switch main
git merge --no-ff codex/phase-6-9-4-3-provider-failure-contract -m "merge: phase 6.9.4.3 provider failure contract"
bun --cwd packages/ai test
bun --cwd packages/ai typecheck
bun --cwd packages/ai lint
git push origin main
~~~

核对三方 SHA 后删除 codex/phase-6-9-4-3-provider-failure-contract。

---

### Task 2: 在 Provider adapter 和 Runtime 中传播安全分类

**Branch:** codex/phase-6-9-4-3-provider-runtime-diagnostics

**Commit:** feat(ai): propagate provider failure categories

**Files:**

- Modify: packages/ai/src/model-agent-provider.ts
- Modify: packages/ai/src/model-agent-runtime.ts
- Modify: packages/ai/src/model-agent-safety.ts
- Modify: packages/ai/tests/model-agent-provider.test.ts
- Modify: packages/ai/tests/model-agent-runtime.test.ts

- [ ] **Step 1: 从最新已推送 main 创建 Task 2 分支**

按第 2 节门禁创建 codex/phase-6-9-4-3-provider-runtime-diagnostics。

- [ ] **Step 2: 写 adapter 与 Runtime 失败传播测试**

在 packages/ai/tests/model-agent-provider.test.ts 增加 APICallError 和 readModelAgentProviderFailureCategory 导入，并新增：

~~~ts
it('converts a rate-limit SDK error to a fixed internal signal without raw fields', async () => {
  const rawCanary = 'RAW_RATE_LIMIT_RESPONSE_CANARY';
  const executor = createOpenAICompatibleStructuredExecutor(
    {
      provider: 'deepseek',
      apiKey: 'example-redacted-key',
      baseURL: 'https://api.deepseek.com',
      model: 'deepseek-test',
    },
    {
      createProvider: () => () => ({}),
      generateStructured: async () => {
        throw new APICallError({
          message: rawCanary,
          url: 'https://private.example/' + rawCanary,
          requestBodyValues: { rawCanary },
          statusCode: 429,
          responseHeaders: { authorization: rawCanary },
          responseBody: rawCanary,
          cause: new Error(rawCanary),
          isRetryable: true,
        });
      },
    },
  );

  let caught: unknown;
  try {
    await executor({
      schema,
      systemPrompt: 'system',
      userPrompt: 'question',
      maxOutputTokens: 40,
      signal: new AbortController().signal,
    });
  } catch (error) {
    caught = error;
  }

  expect(readModelAgentProviderFailureCategory(caught)).toBe('http_rate_limit');
  expect(String(caught)).toBe('ModelAgentProviderFailure: MODEL_AGENT_PROVIDER_REQUEST_FAILED');
  expect(JSON.stringify(caught)).not.toContain(rawCanary);
});
~~~

在 packages/ai/tests/model-agent-runtime.test.ts 将现有 provider error 断言收紧为：

~~~ts
expect(result.error).toEqual({
  code: 'PROVIDER_ERROR',
  message: 'Model provider request failed.',
  retryable: false,
  providerFailureCategory: 'unknown',
});
expect(result.trace).toMatchObject({
  status: 'failed',
  errorCode: 'PROVIDER_ERROR',
  providerFailureCategory: 'unknown',
});
~~~

并在 timeout、abort、schema failure 与 success 测试中分别增加：

~~~ts
expect(result.trace.providerFailureCategory).toBeUndefined();
~~~

在 timeout/abort 失败结果中同时断言：

~~~ts
expect(result.error.providerFailureCategory).toBeUndefined();
~~~

- [ ] **Step 3: 运行定向测试并确认红灯**

Run:

~~~powershell
bun test packages/ai/tests/model-agent-provider.test.ts packages/ai/tests/model-agent-runtime.test.ts
~~~

Expected: FAIL；adapter 仍抛旧固定 Error，Runtime Error/Trace 还没有 providerFailureCategory，旧 PROVIDER_ERROR retryable 仍为 true。

- [ ] **Step 4: 让 Provider adapter 抛出内部安全 signal**

在 packages/ai/src/model-agent-provider.ts 导入：

~~~ts
import { createModelAgentProviderFailureSignal } from './model-agent-provider-failure';
~~~

把 executor 的 catch 精确替换为：

~~~ts
    } catch (error) {
      throw createModelAgentProviderFailureSignal(error);
    }
~~~

初始化 catch 保持 MODEL_AGENT_PROVIDER_INITIALIZATION_FAILED，不把初始化失败算作 provider attempt。

- [ ] **Step 5: 固定安全错误与 retryable 映射**

在 packages/ai/src/model-agent-safety.ts 增加类型导入：

~~~ts
import type {
  ModelAgentError,
  ModelAgentErrorCode,
  ModelAgentProviderFailureCategory,
} from './model-agent-contract';
~~~

增加固定集合并替换 createSafeModelAgentError：

~~~ts
const RETRYABLE_PROVIDER_FAILURES =
  new Set<ModelAgentProviderFailureCategory>([
    'http_rate_limit',
    'http_server',
    'transport',
  ]);

export function createSafeModelAgentError(
  code: ModelAgentErrorCode,
  providerFailureCategory?: ModelAgentProviderFailureCategory,
): ModelAgentError {
  const safeProviderCategory =
    code === 'PROVIDER_ERROR'
      ? providerFailureCategory ?? 'unknown'
      : undefined;
  return {
    code,
    message: ERROR_MESSAGES[code],
    retryable:
      code === 'TIMEOUT' ||
      (safeProviderCategory !== undefined &&
        RETRYABLE_PROVIDER_FAILURES.has(safeProviderCategory)),
    ...(safeProviderCategory
      ? { providerFailureCategory: safeProviderCategory }
      : {}),
  };
}
~~~

- [ ] **Step 6: 让 Runtime Error 与 Trace 使用同一分类**

在 packages/ai/src/model-agent-runtime.ts 导入 ModelAgentProviderFailureCategory 和 readModelAgentProviderFailureCategory，增加：

~~~ts
type ExecutionFailure = {
  code: ModelAgentErrorCode;
  providerFailureCategory?: ModelAgentProviderFailureCategory;
};
~~~

把执行 catch 改为：

~~~ts
      } catch (error) {
        const executionFailure = classifyExecutionError(error);
        return failure(
          input,
          request,
          reservation.budget,
          executionFailure.code,
          startedAt,
          now,
          executionFailure.providerFailureCategory,
        );
      }
~~~

把 classifyExecutionError 替换为：

~~~ts
function classifyExecutionError(error: unknown): ExecutionFailure {
  if (error === TIMEOUT_ERROR) return { code: 'TIMEOUT' };
  if (error === ABORTED_ERROR) return { code: 'ABORTED' };
  return {
    code: 'PROVIDER_ERROR',
    providerFailureCategory:
      readModelAgentProviderFailureCategory(error) ?? 'unknown',
  };
}
~~~

扩展 failure 的最后一个参数，并只调用一次安全错误工厂：

~~~ts
function failure<T>(
  runtime: CreateModelAgentRuntimeInput,
  request: unknown,
  budget: unknown,
  code: ModelAgentErrorCode,
  startedAt: number | null,
  now: () => number,
  providerFailureCategory?: ModelAgentProviderFailureCategory,
): ModelAgentResult<T> {
  const usage = { inputTokens: 0, outputTokens: 0 };
  const error = createSafeModelAgentError(code, providerFailureCategory);
  return {
    ok: false,
    error,
    budget: safeBudgetSnapshot(budget),
    usage,
    trace: trace(
      runtime,
      request,
      usage,
      'failed',
      startedAt,
      now,
      code,
      error.providerFailureCategory,
    ),
  };
}
~~~

扩展 trace 参数和返回值：

~~~ts
function trace(
  runtime: CreateModelAgentRuntimeInput,
  request: unknown,
  usage: ModelAgentUsage,
  status: ModelAgentTrace['status'],
  startedAt: number | null,
  now: () => number,
  errorCode?: ModelAgentErrorCode,
  providerFailureCategory?: ModelAgentProviderFailureCategory,
): ModelAgentTrace {
  const safeRequest = safeTraceRequest(request);
  return {
    runIdHash: hashModelAgentRunId(safeRequest.runId),
    task: safeRequest.task,
    mode: runtime.mode,
    provider: runtime.provider,
    model: runtime.model,
    status,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    maxOutputTokens: safeRequest.maxOutputTokens,
    durationMs: calculateDuration(startedAt, now),
    degraded: status === 'failed',
    ...(errorCode ? { errorCode } : {}),
    ...(errorCode === 'PROVIDER_ERROR' && providerFailureCategory
      ? { providerFailureCategory }
      : {}),
  };
}
~~~

现有 executeLive 的 cancellationCode ?? error 逻辑保持不变，保证 timeout/abort 优先。

- [ ] **Step 7: 运行 Task 2 全量验证**

Run:

~~~powershell
bun test packages/ai/tests/model-agent-provider.test.ts packages/ai/tests/model-agent-runtime.test.ts
bun --cwd packages/ai test
bun --cwd packages/ai typecheck
bun --cwd packages/ai lint
~~~

Expected: 全绿；500 fake response 仍只有 1 次 fetch；Runtime plain executor error 为 PROVIDER_ERROR + unknown；timeout/abort 无分类；无 raw canary。

- [ ] **Step 8: 规格审查后再做质量审查**

规格审查确认顶层错误码未扩张、Runtime 每个 PROVIDER_ERROR 必有分类、Error/Trace 一致、usage/budget 不变。质量审查重点检查 adapter 是否保留 raw reference、trace 是否可能在非 Provider 错误上携带分类、取消竞态是否回归。修复后重跑 Step 7。

- [ ] **Step 9: 提交、合并、main 复验并推送**

~~~powershell
git add packages/ai/src/model-agent-provider.ts packages/ai/src/model-agent-runtime.ts packages/ai/src/model-agent-safety.ts packages/ai/tests/model-agent-provider.test.ts packages/ai/tests/model-agent-runtime.test.ts
git diff --cached --check
git commit -m "feat(ai): propagate provider failure categories"
git switch main
git merge --no-ff codex/phase-6-9-4-3-provider-runtime-diagnostics -m "merge: phase 6.9.4.3 provider runtime diagnostics"
bun --cwd packages/ai test
bun --cwd packages/ai typecheck
bun --cwd packages/ai lint
git push origin main
~~~

核对三方 SHA 后删除 codex/phase-6-9-4-3-provider-runtime-diagnostics。

---

### Task 3: 收紧 Agent candidate Runtime sanitizer

**Branch:** codex/phase-6-9-4-3-candidate-provider-diagnostics

**Commit:** feat(agent): sanitize provider failure categories

**Files:**

- Create: packages/agent/tests/model-candidate-runtime-result.test.ts
- Modify: packages/agent/src/model-candidates/model-candidate-runtime-result.ts

- [ ] **Step 1: 从最新已推送 main 创建 Task 3 分支**

按第 2 节门禁创建 codex/phase-6-9-4-3-candidate-provider-diagnostics。

- [ ] **Step 2: 新建 sanitizer 合同测试**

新建 packages/agent/tests/model-candidate-runtime-result.test.ts：

~~~ts
import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import {
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  type ModelAgentProviderFailureCategory,
} from '@repo/ai';

import { sanitizeModelCandidateRuntimeResult } from '../src/model-candidates/model-candidate-runtime-result.ts';

const callerBudget = {
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: 100,
  usedInputTokens: 0,
  maxOutputTokens: 50,
  usedOutputTokens: 0,
};
const previewBudget = {
  ...callerBudget,
  usedCalls: 1,
  usedInputTokens: 20,
  usedOutputTokens: 30,
};
const dataSchema = z.object({ route: z.literal('chat') }).strict();

describe('model candidate runtime result sanitizer', () => {
  test.each(MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES)(
    'preserves legal provider category %s in error and trace',
    (category) => {
      const result = sanitizeModelCandidateRuntimeResult({
        value: providerFailure(category),
        dataSchema,
        task: 'router_fallback',
        maxOutputTokens: 30,
        callerBudget,
        previewBudget,
      });

      expect(result).not.toBeNull();
      expect(result?.ok).toBe(false);
      if (!result || result.ok) throw new Error('expected failure');
      expect(result.error.message).toBe('Model agent runtime returned a structured failure.');
      expect(result.error.providerFailureCategory).toBe(category);
      expect(result.trace.providerFailureCategory).toBe(category);
    },
  );

  test('accepts a historical provider failure only when both category fields are absent', () => {
    const result = sanitizeModelCandidateRuntimeResult({
      value: providerFailure(),
      dataSchema,
      task: 'router_fallback',
      maxOutputTokens: 30,
      callerBudget,
      previewBudget,
    });
    expect(result?.ok).toBe(false);
    if (!result || result.ok) throw new Error('expected failure');
    expect(result.error.providerFailureCategory).toBeUndefined();
    expect(result.trace.providerFailureCategory).toBeUndefined();
  });

  test('rejects one-sided, mismatched, unknown and non-provider categories', () => {
    const oneSided = providerFailure('http_auth');
    delete oneSided.trace.providerFailureCategory;
    const mismatched = providerFailure('http_auth');
    mismatched.trace.providerFailureCategory = 'http_server';
    const unknown = providerFailure('http_auth') as unknown as Record<string, unknown>;
    (unknown.error as Record<string, unknown>).providerFailureCategory = 'raw_status_429';
    const timeout = providerFailure('transport');
    timeout.error.code = 'TIMEOUT';
    timeout.trace.errorCode = 'TIMEOUT';

    for (const value of [oneSided, mismatched, unknown, timeout]) {
      expect(sanitize(value)).toBeNull();
    }
  });

  test('rejects a success trace category and hostile runtime objects', () => {
    const success = {
      ok: true as const,
      data: { route: 'chat' as const },
      budget: previewBudget,
      usage: { inputTokens: 20, outputTokens: 7 },
      trace: {
        runIdHash: 'sha256:' + 'a'.repeat(64),
        task: 'router_fallback' as const,
        mode: 'live' as const,
        provider: 'deepseek' as const,
        model: 'deepseek-v4-flash',
        status: 'succeeded' as const,
        inputTokens: 20,
        outputTokens: 7,
        maxOutputTokens: 30,
        durationMs: 1,
        degraded: false,
        providerFailureCategory: 'transport' as const,
      },
    };
    const hostile = new Proxy({}, {
      get() {
        throw new Error('RAW_SANITIZER_PROXY_CANARY');
      },
    });

    expect(sanitize(success)).toBeNull();
    expect(sanitize(hostile)).toBeNull();
  });
});

function sanitize(value: unknown) {
  return sanitizeModelCandidateRuntimeResult({
    value,
    dataSchema,
    task: 'router_fallback',
    maxOutputTokens: 30,
    callerBudget,
    previewBudget,
  });
}

function providerFailure(category?: ModelAgentProviderFailureCategory) {
  return {
    ok: false as const,
    error: {
      code: 'PROVIDER_ERROR' as
        | 'PROVIDER_ERROR'
        | 'TIMEOUT',
      message: 'RAW_RUNTIME_MESSAGE_CANARY',
      retryable: false,
      ...(category ? { providerFailureCategory: category } : {}),
    },
    budget: { ...previewBudget },
    usage: { inputTokens: 0, outputTokens: 0 },
    trace: {
      runIdHash: 'sha256:' + 'a'.repeat(64),
      task: 'router_fallback' as const,
      mode: 'live' as const,
      provider: 'deepseek' as const,
      model: 'deepseek-v4-flash',
      status: 'failed' as const,
      inputTokens: 0,
      outputTokens: 0,
      maxOutputTokens: 30,
      durationMs: 1,
      degraded: true,
      errorCode: 'PROVIDER_ERROR' as
        | 'PROVIDER_ERROR'
        | 'TIMEOUT',
      ...(category ? { providerFailureCategory: category } : {}),
    },
  };
}
~~~

- [ ] **Step 3: 运行新测试并确认红灯**

Run:

~~~powershell
bun test packages/agent/tests/model-candidate-runtime-result.test.ts
~~~

Expected: FAIL；strict schema 当前拒绝合法分类，或 rebuild 丢失分类。

- [ ] **Step 4: 扩展 strict schema 和合同不变量**

在 packages/agent/src/model-candidates/model-candidate-runtime-result.ts 从 @repo/ai 导入 MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES 与 ModelAgentProviderFailureCategory，并增加：

~~~ts
const PROVIDER_FAILURE_CATEGORY_SCHEMA =
  z.enum(MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES);
~~~

在 failure error schema 与 trace schema 中分别增加：

~~~ts
providerFailureCategory: PROVIDER_FAILURE_CATEGORY_SCHEMA.optional(),
~~~

在 success 分支不变量中增加：

~~~ts
candidate.trace.providerFailureCategory !== undefined
~~~

在 failure 分支不变量中增加：

~~~ts
!hasConsistentProviderFailureCategory(
  candidate.error.code,
  candidate.error.providerFailureCategory,
  candidate.trace.providerFailureCategory,
)
~~~

实现 helper：

~~~ts
function hasConsistentProviderFailureCategory(
  errorCode: ModelAgentErrorCode,
  errorCategory: ModelAgentProviderFailureCategory | undefined,
  traceCategory: ModelAgentProviderFailureCategory | undefined,
): boolean {
  if (errorCode !== 'PROVIDER_ERROR') {
    return errorCategory === undefined && traceCategory === undefined;
  }
  return (
    (errorCategory === undefined && traceCategory === undefined) ||
    (errorCategory !== undefined && errorCategory === traceCategory)
  );
}
~~~

failure 白名单重建中增加：

~~~ts
      ...(candidate.error.providerFailureCategory
        ? {
            providerFailureCategory:
              candidate.error.providerFailureCategory,
          }
        : {}),
~~~

rebuildTrace 返回值增加：

~~~ts
    ...(value.providerFailureCategory
      ? { providerFailureCategory: value.providerFailureCategory }
      : {}),
~~~

不要复制 runtime 原始 message，也不要接受自由字符串。

- [ ] **Step 5: 运行 Task 3 全量验证**

Run:

~~~powershell
bun test packages/agent/tests/model-candidate-runtime-result.test.ts
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/agent lint
~~~

Expected: 新矩阵全绿，既有 Router/Verifier candidate fixture 无分类时仍通过；hostile 值 fail-closed；全量 Agent 测试无回归。

- [ ] **Step 6: 规格审查后再做质量审查**

规格审查确认 optional 只为历史兼容、Provider 分类双边一致、成功和非 Provider 错误禁止分类。质量审查检查 Zod strict、重建对象、proxy/getter 和 mutation，不允许直接返回 candidate 原对象。修复后重跑 Step 5。

- [ ] **Step 7: 提交、合并、main 复验并推送**

~~~powershell
git add packages/agent/src/model-candidates/model-candidate-runtime-result.ts packages/agent/tests/model-candidate-runtime-result.test.ts
git diff --cached --check
git commit -m "feat(agent): sanitize provider failure categories"
git switch main
git merge --no-ff codex/phase-6-9-4-3-candidate-provider-diagnostics -m "merge: phase 6.9.4.3 candidate provider diagnostics"
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/agent lint
git push origin main
~~~

核对三方 SHA 后删除 codex/phase-6-9-4-3-candidate-provider-diagnostics。

---

### Task 4: 把分类写入 paired eval 和 strict evidence

**Branch:** codex/phase-6-9-4-3-eval-provider-diagnostics

**Commit:** feat(agent): record provider failure categories

**Files:**

- Modify: packages/agent/src/evals/phase-6-9-router-verifier-paired-contract.ts
- Modify: packages/agent/src/evals/run-phase-6-9-router-verifier-paired.ts
- Modify: packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts
- Modify: packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts
- Modify: packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts

- [ ] **Step 1: 从最新已推送 main 创建 Task 4 分支**

按第 2 节门禁创建 codex/phase-6-9-4-3-eval-provider-diagnostics。

- [ ] **Step 2: 写 evidence 合法位置与历史兼容测试**

在 paired contract test 增加测试，使用现有 buildReport helper：

~~~ts
test('accepts historical missing diagnostics and constrains new diagnostics to attempted Live provider failures', () => {
  const historical = buildReport('live', 'incomplete');
  expect(parsePhase6943Output(historical).ok).toBe(true);

  const diagnosed = structuredClone(historical);
  if (diagnosed.kind !== 'report' || diagnosed.runKind !== 'live') {
    throw new Error('expected live report');
  }
  const failure = diagnosed.lanes.live.entries.find(
    (entry) =>
      entry.entryStatus === 'observed' &&
      entry.lane === 'live' &&
      entry.runtimeErrorCode === 'PROVIDER_ERROR',
  );
  if (!failure || failure.entryStatus !== 'observed' || failure.lane !== 'live') {
    throw new Error('missing provider failure');
  }
  failure.providerFailureCategory = 'http_rate_limit';
  expect(parsePhase6943Output(diagnosed).ok).toBe(true);

  const successTamper = structuredClone(buildReport('live', 'complete'));
  if (successTamper.kind !== 'report' || successTamper.runKind !== 'live') {
    throw new Error('expected complete live report');
  }
  const success = successTamper.lanes.live.entries.find(
    (entry) =>
      entry.entryStatus === 'observed' &&
      entry.lane === 'live' &&
      entry.strictSuccess,
  );
  if (!success || success.entryStatus !== 'observed' || success.lane !== 'live') {
    throw new Error('missing live success');
  }
  success.providerFailureCategory = 'transport';
  expect(parsePhase6943Output(successTamper).ok).toBe(false);

  const unknownTamper = structuredClone(diagnosed) as unknown as {
    lanes: { live: { entries: Array<Record<string, unknown>> } };
  };
  const unknownFailure = unknownTamper.lanes.live.entries.find(
    (entry) => entry.runtimeErrorCode === 'PROVIDER_ERROR',
  );
  if (!unknownFailure) throw new Error('missing unknown failure');
  unknownFailure.providerFailureCategory = 'raw_http_429';
  expect(parsePhase6943Output(unknownTamper).ok).toBe(false);
});
~~~

在 paired runner test 的 successfulLiveDependencies options 增加：

~~~ts
failureCategory?: ModelAgentProviderFailureCategory;
~~~

让 failAt fixture 的 Error 与 Trace 同时使用 failureCategory，默认 http_rate_limit。然后在 stops Live after an attempted failure 测试中增加：

~~~ts
const failure = output.lanes.live.entries[failureIndex];
expect(failure).toMatchObject({
  runtimeErrorCode: 'PROVIDER_ERROR',
  providerFailureCategory: 'http_rate_limit',
});
expect(JSON.stringify(output)).not.toContain('RAW_PROVIDER_SECRET_CANARY');
~~~

在 paired CLI test 的 incomplete evidence 验证中增加：

~~~ts
if (incomplete.kind !== 'report' || incomplete.runKind !== 'live') {
  throw new Error('expected incomplete live report');
}
const diagnosedFailure = incomplete.lanes.live.entries.find(
  (entry) =>
    entry.entryStatus === 'observed' &&
    entry.lane === 'live' &&
    entry.runtimeErrorCode === 'PROVIDER_ERROR',
);
expect(diagnosedFailure).toMatchObject({
  providerFailureCategory: 'unknown',
});
const historical = structuredClone(incomplete);
const historicalFailure = historical.lanes.live.entries.find(
  (entry) =>
    entry.entryStatus === 'observed' &&
    entry.lane === 'live' &&
    entry.runtimeErrorCode === 'PROVIDER_ERROR',
);
if (
  !historicalFailure ||
  historicalFailure.entryStatus !== 'observed' ||
  historicalFailure.lane !== 'live'
) {
  throw new Error('missing historical failure');
}
delete historicalFailure.providerFailureCategory;
expect(
  validatePhase6943Evidence({
    profile: 'live',
    file: liveReportPath(historical),
    raw: JSON.stringify(historical),
  }),
).toEqual({ ok: true, profile: 'live', runStatus: 'incomplete' });
~~~

- [ ] **Step 3: 运行定向测试并确认红灯**

Run:

~~~powershell
bun test packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts
~~~

Expected: FAIL；entry strict schema 尚不接受分类，runner 尚未传播分类。

- [ ] **Step 4: 扩展 paired entry schema 和不变量**

在 packages/agent/src/evals/phase-6-9-router-verifier-paired-contract.ts 从 @repo/ai 导入 MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES，并增加：

~~~ts
const PROVIDER_FAILURE_CATEGORY_SCHEMA =
  z.enum(MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES);
~~~

在两个 candidate entry schema 的 runtimeErrorCode 后增加：

~~~ts
providerFailureCategory: PROVIDER_FAILURE_CATEGORY_SCHEMA.optional(),
~~~

在 superRefine 中计算：

~~~ts
  const legalProviderFailureCategory =
    entry.lane === 'live' &&
    entry.providerAttempted &&
    !entry.strictSuccess &&
    entry.runtimeErrorCode === 'PROVIDER_ERROR';
~~~

并把以下条件加入现有非法条件总表达式：

~~~ts
(entry.providerFailureCategory !== undefined &&
  !legalProviderFailureCategory)
~~~

字段保持 optional，不升级 PHASE_6943_REPORT_SCHEMA_VERSION，确保 Attempt A/B 旧 JSON 继续可验证。

- [ ] **Step 5: 从 sanitizer 后的 Trace 传播分类**

在 packages/agent/src/evals/run-phase-6-9-router-verifier-paired.ts 导入 ModelAgentProviderFailureCategory，并给 CandidateSummary 增加：

~~~ts
providerFailureCategory?: ModelAgentProviderFailureCategory;
~~~

在 summarizeCandidateEnvelope 的 runtimeErrorCode 完成收紧后计算：

~~~ts
  const providerFailureCategory =
    traceValid &&
    runtimeErrorCode === 'PROVIDER_ERROR'
      ? trace?.providerFailureCategory
      : undefined;
~~~

返回 CandidateSummary 时增加：

~~~ts
    ...(providerFailureCategory
      ? { providerFailureCategory }
      : {}),
~~~

candidateFields 只给 Live Provider failure 添加分类：

~~~ts
    ...(lane === 'live' &&
    candidate.runtimeErrorCode === 'PROVIDER_ERROR' &&
    candidate.providerFailureCategory
      ? {
          providerFailureCategory:
            candidate.providerFailureCategory,
        }
      : {}),
~~~

applyLiveBoundary 必须移除不满足最终 provider counter 的分类，使用以下形态重建：

~~~ts
  const {
    providerFailureCategory: candidateProviderFailureCategory,
    ...entryWithoutProviderFailureCategory
  } = entry;
  const providerFailureCategory =
    providerAttempted &&
    !strictSuccess &&
    runtimeErrorCode === 'PROVIDER_ERROR'
      ? candidateProviderFailureCategory
      : undefined;
  return {
    ...entryWithoutProviderFailureCategory,
    disposition,
    providerAttempted,
    strictSuccess,
    ...(runtimeErrorCode ? { runtimeErrorCode } : {}),
    ...(!runtimeErrorCode ? { runtimeErrorCode: undefined } : {}),
    ...(providerFailureCategory
      ? { providerFailureCategory }
      : {}),
    providerReported: strictSuccess,
  };
~~~

这样 pre-provider failure、counter mismatch、success、Mock、not-run 都不会携带分类。

- [ ] **Step 6: 更新 runner fixture 为合法双边分类**

在 runner test 的 structuredFailure helper 增加可选 category 参数，并在 Error/Trace 中使用同一字段：

~~~ts
function structuredFailure(
  request: ModelAgentRequest<unknown>,
  code: 'TIMEOUT' | 'ABORTED' | 'CALL_BUDGET_EXCEEDED' | 'EXECUTOR_UNAVAILABLE' | 'PROVIDER_ERROR',
  reserved: boolean,
  providerFailureCategory?: ModelAgentProviderFailureCategory,
): ModelAgentResult<never> {
  const reservation = reserveModelAgentBudget(request.budget, {
    inputTokens: request.estimatedInputTokens,
    outputTokens: request.maxOutputTokens,
  });
  if (!reservation.ok) throw new Error('expected reservation');
  const budget = reserved ? reservation.budget : request.budget;
  return {
    ok: false,
    error: {
      code,
      message: 'sanitized failure',
      retryable: code === 'TIMEOUT',
      ...(code === 'PROVIDER_ERROR' && providerFailureCategory
        ? { providerFailureCategory }
        : {}),
    },
    budget,
    usage: { inputTokens: 0, outputTokens: 0 },
    trace: {
      runIdHash: hashModelAgentRunId(request.runId),
      task: request.task,
      mode: 'mock',
      provider: 'mock',
      model: 'phase-6-9-4-3-test-fixture-v1',
      status: 'failed',
      inputTokens: 0,
      outputTokens: 0,
      maxOutputTokens: request.maxOutputTokens,
      durationMs: 0,
      degraded: true,
      errorCode: code,
      ...(code === 'PROVIDER_ERROR' && providerFailureCategory
        ? { providerFailureCategory }
        : {}),
    },
  };
}
~~~

failAt 调用传入：

~~~ts
options.failureCategory ?? 'http_rate_limit'
~~~

- [ ] **Step 7: 运行 Task 4 全量和历史 evidence 验证**

Run:

~~~powershell
bun test packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/agent lint
bun packages/agent/scripts/validate-phase-6-9-4-3-evidence.ts --profile live --file docs/acceptance/evidence/phase-6-9-4-3/live-20260713T122743752Z-46b0f4785861.json
bun packages/agent/scripts/validate-phase-6-9-4-3-evidence.ts --profile live --file docs/acceptance/evidence/phase-6-9-4-3/live-20260713T124435253Z-4d37573c86dc.json
~~~

Expected:

- 定向和全量 Agent 测试全绿；
- typecheck/lint exit 0；
- Attempt B 返回 ok=true/live/incomplete；
- Attempt A 仍保持原有 filename identity 失败事实，不修改文件；若 validator 返回 profile_mismatch，只记录为既有预期，不把它改写成 canonical；
- git status 不出现两个历史 JSON 的修改；
- 无真实 provider attempt。

- [ ] **Step 8: 规格审查后再做质量审查**

规格审查确认分类只出现在 attempted Live PROVIDER_ERROR、旧 evidence 缺失分类仍合法、report version 不变、enablement 和 usage_unverifiable 不变。质量审查检查 union narrowing、undefined 属性、JSON 序列化、counter mismatch 和 raw canary。修复后重跑 Step 7。

- [ ] **Step 9: 提交、合并、main 复验并推送**

~~~powershell
git add packages/agent/src/evals/phase-6-9-router-verifier-paired-contract.ts packages/agent/src/evals/run-phase-6-9-router-verifier-paired.ts packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts
git diff --cached --check
git commit -m "feat(agent): record provider failure categories"
git switch main
git merge --no-ff codex/phase-6-9-4-3-eval-provider-diagnostics -m "merge: phase 6.9.4.3 eval provider diagnostics"
bun --cwd packages/ai test
bun --cwd packages/ai typecheck
bun --cwd packages/ai lint
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/agent lint
git push origin main
~~~

核对三方 SHA 后删除 codex/phase-6-9-4-3-eval-provider-diagnostics。

---

### Task 5: 阶段文档、最终零网络验收与交接

**Branch:** codex/phase-6-9-4-3-provider-diagnostics-docs

**Commit:** docs(agent): record provider failure diagnostics

**Files:**

- Modify: docs/superpowers/specs/2026-07-13-phase-6-9-4-3-provider-failure-diagnostics-design.md
- Modify: docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md
- Modify: docs/acceptance-checklist.md
- Modify: docs/roadmap.md
- Modify: AGENTS.md

- [ ] **Step 1: 从最新已推送 main 创建 Task 5 分支**

按第 2 节门禁创建 codex/phase-6-9-4-3-provider-diagnostics-docs。

- [ ] **Step 2: 收集可复核的实现事实**

Run:

~~~powershell
git log --oneline --decorate -12
bun --cwd packages/ai test
bun --cwd packages/ai typecheck
bun --cwd packages/ai lint
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/agent lint
bun packages/agent/scripts/validate-phase-6-9-4-3-evidence.ts --profile live --file docs/acceptance/evidence/phase-6-9-4-3/live-20260713T124435253Z-4d37573c86dc.json
~~~

记录命令真实输出中的测试数量、exit code 和 Task 1~4 提交 SHA。不得估算测试数量，不得写“应该通过”。

- [ ] **Step 3: 更新设计状态**

把设计文档顶部状态改为：

~~~markdown
> 状态：已实施并完成 Mock/fake executor 验收，待新的 controlled-Live paired eval
~~~

在完成标准后增加实施结果，明确：

- 八类枚举只有 @repo/ai 一个权威来源；
- Error/Trace/sanitizer/evidence 合同已接通；
- Attempt A/B 未改写；
- 没有新增真实模型调用；
- Router/Verifier 仍 disabled；
- 生产 Trace API/UI 仍未接入分类。

同时把设计第 9.2 节的历史兼容表述校正为：缺失分类不产生新的 schema failure，但 Attempt A/B 的原有 strict validator 判定保持不变；Attempt A 仍是 filename identity mismatch，Attempt B 仍为合法 live/incomplete。

- [ ] **Step 4: 更新 canonical acceptance**

在 docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md 增加“安全 Provider 失败诊断检查点”章节，写入以下完整事实：

~~~markdown
共享 @repo/ai 现在把 Provider 请求失败安全分类为 http_auth、http_rate_limit、http_client、http_server、transport、structured_output、invalid_response 或 unknown；顶层错误码仍为 PROVIDER_ERROR。分类发生在 AI SDK adapter 边界，原始 URL、request body、response body、headers、message、stack、cause、prompt、output 与凭据不会进入 Error、Trace 或 evidence。

ModelAgentRuntime 对新 Provider 失败保证 Error/Trace 分类一致；timeout 与 abort 继续优先，普通外部 executor 异常固定降级为 unknown。Agent candidate sanitizer 只白名单重建合法枚举；paired eval 只允许 attempted Live PROVIDER_ERROR failure entry 携带分类。历史 Attempt A/B evidence 字段缺失仍兼容，文件未覆盖、未改写。

本检查点只完成诊断合同和零网络测试，不是 Phase 6.9.4.3 Live 质量验收完成。Router / Verifier 继续 enabled=false，生产 Chat 继续 deterministic。下一任务是从最新 main 单独执行一次新的 controlled-Live paired eval；若再次失败，只记录固定分类，不记录原始 Provider 错误。
~~~

把“下一任务”从 provider failure diagnosis 更新为“新的 controlled-Live paired eval”，但保留 28 strict success 和质量/安全/延迟/成本全部通过才可完成阶段的门槛。

- [ ] **Step 5: 同步 checklist、roadmap 和 AGENTS.md**

在 docs/acceptance-checklist.md 的 Phase 6.9.4.3 部分加入：

~~~markdown
- controlled-Live 前必须确认共享 Provider failure diagnostics 测试通过；新的 attempted PROVIDER_ERROR evidence 必须携带八类固定枚举之一，Error/Trace 必须一致。
- timeout、abort、schema/budget/config failure 不得携带 providerFailureCategory；历史 evidence 可缺失该字段但不得改写。
- 分类不改变 usage_unverifiable、run incomplete 或 enablement fail-closed 结论；禁止保存状态码、URL、请求/响应正文、headers、raw error 或凭据。
~~~

在 docs/roadmap.md 更新 Phase 6.9.4.3 进度：诊断合同已完成，下一步是新 controlled-Live paired eval；阶段仍未完成。

在 AGENTS.md：

- Phase 6.9.4.3 表格保持“验收未完成”；
- 描述补充共享八类诊断已完成；
- 下一任务改为新的 controlled-Live paired eval；
- 保留 candidate 未接生产 Chat、Router/Verifier disabled 和不得盲目重试。

- [ ] **Step 6: 文档自检**

Run:

~~~powershell
$placeholderPattern = ('T' + 'BD|T' + 'ODO|FIX' + 'ME|待' + '定|待' + '补')
rg -n $placeholderPattern docs/superpowers/specs/2026-07-13-phase-6-9-4-3-provider-failure-diagnostics-design.md docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md docs/acceptance-checklist.md docs/roadmap.md AGENTS.md
git diff --check
git diff -- docs/superpowers/specs/2026-07-13-phase-6-9-4-3-provider-failure-diagnostics-design.md docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md docs/acceptance-checklist.md docs/roadmap.md AGENTS.md
~~~

Expected: 占位符扫描零命中；diff check exit 0；文档不宣称 Phase 6.9.4.3 或 Live 验收完成；下一任务和回顾问题一致。

- [ ] **Step 7: 最终全量零网络验收**

Run:

~~~powershell
bun --cwd packages/ai test
bun --cwd packages/ai typecheck
bun --cwd packages/ai lint
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/agent lint
bun packages/agent/scripts/validate-phase-6-9-4-3-evidence.ts --profile live --file docs/acceptance/evidence/phase-6-9-4-3/live-20260713T124435253Z-4d37573c86dc.json
git diff --check
git status --short
~~~

Expected: 所有 test/typecheck/lint exit 0；canonical Attempt B 返回 ok=true/live/incomplete；只有 Task 5 五个文档文件待提交；没有 evidence JSON、环境文件、Docker 文件或业务代码改动。

本任务无需启动 Server、Web、浏览器或 Docker，因为没有 API、UI、数据库和运行部署面变化。新的 controlled-Live 是下一独立任务，不得夹在本 Task 中执行。

- [ ] **Step 8: 规格审查后再做质量审查**

规格审查逐条对照设计第 4~15 节，确认代码与文档均覆盖且没有越界。质量审查检查分类语义、隐私表述、历史证据身份、命令结果和回顾问题是否可复核。修复后重跑 Step 6~7。

- [ ] **Step 9: 提交、合并、main 最终复验并推送**

~~~powershell
git add docs/superpowers/specs/2026-07-13-phase-6-9-4-3-provider-failure-diagnostics-design.md docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md docs/acceptance-checklist.md docs/roadmap.md AGENTS.md
git diff --cached --check
git commit -m "docs(agent): record provider failure diagnostics"
git switch main
git merge --no-ff codex/phase-6-9-4-3-provider-diagnostics-docs -m "merge: phase 6.9.4.3 provider diagnostics docs"
bun --cwd packages/ai test
bun --cwd packages/ai typecheck
bun --cwd packages/ai lint
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/agent lint
bun packages/agent/scripts/validate-phase-6-9-4-3-evidence.ts --profile live --file docs/acceptance/evidence/phase-6-9-4-3/live-20260713T124435253Z-4d37573c86dc.json
git status --short --branch
git push origin main
~~~

核对本地 main、origin/main 与远程 main SHA 完全一致，删除 codex/phase-6-9-4-3-provider-diagnostics-docs，并确认工作区干净。

---

## 3. 完成判定

实施者只有在以下事实全部有最新命令证据时才能宣布本计划完成：

1. @repo/ai 八类固定枚举只有一个权威定义。
2. AI SDK raw error 在 adapter 边界被丢弃，内部 signal 不可通过公开字段伪造。
3. 新 Runtime PROVIDER_ERROR 的 Error/Trace 分类存在且一致；其他错误无分类。
4. retryable 只按本地固定表生成，代码没有自动重试。
5. candidate sanitizer 对新分类白名单重建，对非法组合 fail-closed，同时接受历史双边缺失。
6. paired evidence 只在 attempted Live PROVIDER_ERROR failure 上记录分类。
7. Attempt A/B 文件未修改，Attempt B 仍通过 strict validator 且保持 incomplete。
8. @repo/ai 与 @repo/agent 的 test、typecheck、lint 全部通过。
9. 每个 Task 都独立分支、独立提交、--no-ff 合并、main 复验、推送并删除分支。
10. 没有真实模型调用、Docker 清理、数据库操作、生产 Chat 接入或 Router/Verifier enablement。
11. acceptance、checklist、roadmap、AGENTS.md 能说明做了什么、为什么做、如何验证和下一步如何提问。
12. Phase 6.9.4.3 仍标记验收未完成，下一独立任务才是新的 controlled-Live paired eval。

## 4. 建议回顾问题

- 为什么保留顶层 PROVIDER_ERROR，而不新增八个 Runtime error code？
- AI SDK 原始异常在哪一层被丢弃，为什么不能遍历 cause？
- WeakMap signal 如何阻止 hostile executor 伪造分类？
- structured_output 与 Runtime 的 SCHEMA_INVALID 有什么区别？
- 为什么历史 evidence 可以缺失分类，而新 Runtime 失败必须有分类？
- providerFailureCategory 在哪些 Error、Trace 和 evidence 组合中合法？
- 为什么分类不会触发自动重试，也不会改变 usage_unverifiable？
- 下一次 controlled-Live 如果得到 http_rate_limit、structured_output 或 unknown，分别应该如何决策？
- 当前 Router/Verifier 是否已接入生产 Chat，Phase 6.9.4.3 为什么仍未完成？
- 这套共享诊断边界如何复用于后续 Memory、Orchestrator 和 Phase 9 MCP Agent？
