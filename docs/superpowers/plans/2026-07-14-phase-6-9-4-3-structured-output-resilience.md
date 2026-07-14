# Phase 6.9.4.3 Structured Output Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Router / Verifier controlled-Live paired eval 增加 DeepSeek Beta strict-tool structured output，在保持 canonical Zod、单调用、零重试和生产候选关闭的前提下消除 prompt-only JSON schema enforcement 缺口。

**Architecture:** `@repo/ai` 新增纯函数 schema compatibility compiler，把固定 Zod profile 投影成 DeepSeek strict-tool 支持的 JSON Schema 子集；共享 Provider executor 通过显式模式选择现有 `json_object` 或唯一 forced strict tool。Phase 6.9.4.3 CLI 在任何 evidence reservation 或 Provider 构造前预编译 Router / Verifier profile，Live report 以 runner v2 + `deepseek_strict_tool_v1` 标识新 transport，历史 v1 evidence 继续只读兼容。

**Tech Stack:** TypeScript、Bun test、Zod 3、Vercel AI SDK 4.3、`@ai-sdk/openai` 1.3、DeepSeek OpenAI-compatible Beta Tool Calls、`@repo/ai`、`@repo/agent`

**Design:** [Phase 6.9.4.3 Structured Output 韧性设计](../specs/2026-07-14-phase-6-9-4-3-structured-output-resilience-design.md)

---

## 执行前提

当前设计与计划位于文档分支 `codex/phase-6-9-4-3-router-structured-resilience-design`。开始生产代码前必须：

1. 提交本计划并由用户确认执行方式；
2. `--no-ff` 合并文档分支到最新 `main`；
3. 在 `main` 复验文档与链接并推送远程；
4. 核对 local `main`、`origin/main` 与远程 SHA 一致；
5. 从该最新 `main` 创建 `codex/phase-6-9-4-3-structured-output-resilience`，不得从当前文档分支继续开分支。

本计划实施阶段不读取 `.env` key、不设置 Live 双开关、不访问真实 Provider、不操作 Docker。controlled-Live 是实现合并后的下一独立任务。

## 文件职责

- Create `packages/ai/src/model-agent-structured-schema.ts`：固定 schema profile 校验、DeepSeek strict-tool compatibility projection、不可变 registry。
- Create `packages/ai/tests/model-agent-structured-schema.test.ts`：Schema RED/GREEN、hostile input、canonical validate 与深冻结测试。
- Modify `packages/ai/src/model-agent-provider.ts`：显式 structured mode、strict chat model、forced tool、profile identity lookup。
- Modify `packages/ai/tests/model-agent-provider.test.ts`：默认 JSON wire 回归、strict-tool 真实 SDK wire、零重试与无泄漏测试。
- Modify `packages/ai/src/index.ts`：只导出公开 schema profile 类型与 compiler；不导出 Provider raw internals。
- Modify `packages/agent/scripts/phase-6-9-4-3-paired-cli.ts`：Beta exact URL、固定 Router/Verifier profile preflight、strict executor composition。
- Modify `packages/agent/src/evals/phase-6-9-router-verifier-paired-contract.ts`：runner v2、Live transport identity 与历史 v1 兼容。
- Modify `packages/agent/src/evals/run-phase-6-9-router-verifier-paired.ts`：新 Live report 写入 `deepseek_strict_tool_v1`。
- Modify `packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts`：0-attempt preflight、实际 Router/Verifier wire 与 URL 测试。
- Modify `packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts`：v1/v2 transport 位置合同。
- Modify `packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts`：runner v2 report identity 与既有 28/72 边界。
- Modify `docs/superpowers/specs/2026-07-14-phase-6-9-4-3-structured-output-resilience-design.md`：实施状态与最终偏差记录。
- Modify `docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md`：零网络实现证据、验证数字与下一步。
- Modify `docs/ai-behavior-acceptance.md`、`docs/acceptance-checklist.md`、`docs/roadmap.md`：持续 AI/验收/阶段合同。
- Modify `AGENTS.md`、`README.md`、`DEVLOG.md`：项目快照、回顾入口、提交链与下一会话提问。

## Task 1: DeepSeek strict-tool schema compatibility compiler

**Files:**
- Create: `packages/ai/src/model-agent-structured-schema.ts`
- Create: `packages/ai/tests/model-agent-structured-schema.test.ts`
- Modify: `packages/ai/src/index.ts`

- [ ] **Step 1: 写 profile、Router-like 和 Verifier-like 投影失败测试**

在新测试文件中使用真实 Zod 结构，不复制 Provider 返回正文：

```ts
import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

import {
  compileDeepSeekStrictToolSchemaProfiles,
  MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED,
} from '../src/model-agent-structured-schema';

const routerSchema = z.object({
  route: z.enum(['chat', 'tutor']),
  confidence: z.number().min(0).max(1),
  reasonCode: z.enum(['ambiguous_intent_resolved', 'insufficient_context']),
}).strict();

const verifierSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('trusted'),
    evidenceCodes: z.tuple([z.literal('consistent_support')]),
  }).strict(),
  z.object({
    status: z.literal('conflict'),
    evidenceCodes: z.array(z.enum(['numeric_conflict', 'version_conflict']))
      .min(1).max(2),
  }).strict(),
]).superRefine((value, context) => {
  if (value.status === 'conflict' && new Set(value.evidenceCodes).size !== value.evidenceCodes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'duplicate evidence' });
  }
});

describe('DeepSeek strict-tool schema profiles', () => {
  it('projects literals and one-item tuples into the documented strict subset', () => {
    const registry = compileDeepSeekStrictToolSchemaProfiles([
      { name: 'router_candidate_v1', schema: routerSchema },
      { name: 'knowledge_verifier_candidate_v1', schema: verifierSchema },
    ]);

    const router = registry.resolve(routerSchema);
    const verifier = registry.resolve(verifierSchema);
    expect(router?.providerSchema.jsonSchema).not.toHaveProperty('$schema');
    expect(JSON.stringify(verifier?.providerSchema.jsonSchema)).not.toContain('"const"');
    expect(JSON.stringify(verifier?.providerSchema.jsonSchema)).not.toContain('"items":[');
    expect(JSON.stringify(verifier?.providerSchema.jsonSchema)).not.toContain('"minItems"');
    expect(JSON.stringify(verifier?.providerSchema.jsonSchema)).not.toContain('"maxItems"');
    expect(JSON.stringify(verifier?.providerSchema.jsonSchema)).toContain(
      '"enum":["consistent_support"]',
    );
  });

  it('keeps canonical Zod validation authoritative after projection', async () => {
    const registry = compileDeepSeekStrictToolSchemaProfiles([
      { name: 'knowledge_verifier_candidate_v1', schema: verifierSchema },
    ]);
    const validate = registry.resolve(verifierSchema)?.providerSchema.validate;
    expect(await validate?.({
      status: 'conflict',
      evidenceCodes: ['numeric_conflict', 'numeric_conflict'],
    })).toMatchObject({ success: false });
  });

  it.each([
    [],
    [{ name: 'Bad-Name', schema: routerSchema }],
    [{ name: 'same', schema: routerSchema }, { name: 'same', schema: verifierSchema }],
    [{ name: 'one', schema: routerSchema }, { name: 'two', schema: routerSchema }],
  ])('rejects malformed or duplicate profile registries', (profiles) => {
    expect(() => compileDeepSeekStrictToolSchemaProfiles(profiles as never)).toThrow(
      MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED,
    );
  });
});
```

另加独立测试覆盖：可选 object 字段、`additionalProperties` 不为 `false`、多元素 tuple、未知 schema keyword、getter/proxy 抛错；全部只允许固定错误消息，不能包含 canary。

- [ ] **Step 2: 运行新测试并确认 RED**

Run：

```powershell
bun test packages/ai/tests/model-agent-structured-schema.test.ts
```

Expected：FAIL，原因是模块或 `compileDeepSeekStrictToolSchemaProfiles` 尚不存在；不得因测试语法或模块路径拼写错误失败。

- [ ] **Step 3: 实现最小公开类型、固定错误和 registry**

在新源文件建立以下公开合同：

```ts
import { zodSchema } from 'ai';
import type { z } from 'zod';

export const MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED =
  'MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED' as const;

export type ModelAgentStructuredSchemaProfile = Readonly<{
  name: string;
  schema: z.ZodTypeAny;
}>;

export type CompiledModelAgentStructuredSchemaProfile = Readonly<{
  name: string;
  canonicalSchema: z.ZodTypeAny;
  providerSchema: ReturnType<typeof zodSchema>;
}>;

export type ModelAgentStructuredSchemaRegistry = Readonly<{
  resolve(schema: z.ZodTypeAny):
    | CompiledModelAgentStructuredSchemaProfile
    | null;
}>;
```

`compileDeepSeekStrictToolSchemaProfiles()` 必须：

```ts
export function compileDeepSeekStrictToolSchemaProfiles(
  profiles: readonly ModelAgentStructuredSchemaProfile[],
): ModelAgentStructuredSchemaRegistry {
  try {
    if (!Array.isArray(profiles) || profiles.length < 1 || profiles.length > 16) {
      throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
    }
    const names = new Set<string>();
    const schemas = new Set<z.ZodTypeAny>();
    const compiled = new WeakMap<object, CompiledModelAgentStructuredSchemaProfile>();

    for (const profile of profiles) {
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(profile.name) ||
          names.has(profile.name) || schemas.has(profile.schema)) {
        throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
      }
      const canonical = zodSchema(profile.schema);
      const projected = deepFreeze(projectStrictSchema(canonical.jsonSchema));
      const item = Object.freeze({
        name: profile.name,
        canonicalSchema: profile.schema,
        providerSchema: Object.freeze({ ...canonical, jsonSchema: projected }),
      });
      names.add(profile.name);
      schemas.add(profile.schema);
      compiled.set(profile.schema, item);
    }

    return Object.freeze({
      resolve(schema: z.ZodTypeAny) {
        return compiled.get(schema) ?? null;
      },
    });
  } catch {
    throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
  }
}
```

`projectStrictSchema()` 只向 Provider 保留当前实际需要的 `type/properties/required/additionalProperties/enum/anyOf/items/minimum/maximum/description`：删除顶层 `$schema` 和数组 `minItems/maxItems`，把 `const` 转为单值 `enum`，把长度为 1 的 tuple items 转为普通 items；递归要求 object 的 property keys 与 required 完全一致且 `additionalProperties === false`。数组长度、status/evidence 关联与自定义 refinement 继续由 canonical Zod 校验。所有复制都创建新对象，不修改 AI SDK 或 Zod 返回值。

- [ ] **Step 4: 导出 compiler 并重跑 GREEN**

在 `packages/ai/src/index.ts` 增加：

```ts
export * from './model-agent-structured-schema';
```

Run：

```powershell
bun test packages/ai/tests/model-agent-structured-schema.test.ts
bun run --cwd packages/ai typecheck
bun run --cwd packages/ai lint
```

Expected：新测试全部 PASS；typecheck/lint exit 0；没有网络请求。

- [ ] **Step 5: 提交 Task 1**

```powershell
git add packages/ai/src/model-agent-structured-schema.ts packages/ai/src/index.ts packages/ai/tests/model-agent-structured-schema.test.ts
git diff --cached --check
git commit -m "feat(ai): compile strict tool schema profiles"
```

Expected：只包含 compiler、export 和对应测试。

## Task 2: Shared Provider executor strict-tool transport

**Files:**
- Modify: `packages/ai/src/model-agent-provider.ts`
- Modify: `packages/ai/tests/model-agent-provider.test.ts`

- [ ] **Step 1: 写显式模式与真实 SDK wire RED 测试**

保留现有“real AI SDK JSON wire mode”测试，并新增 strict tool 测试。使用 `globalThis.fetch` fake，不调用网络：

```ts
it('uses one forced DeepSeek strict tool without json_schema response format', async () => {
  const originalFetch = globalThis.fetch;
  const requestBodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({
      id: 'chatcmpl-local',
      object: 'chat.completion',
      created: 1,
      model: 'deepseek-v4-flash',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'model_agent_result',
              arguments: '{"route":"chat"}',
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 21, completion_tokens: 8, total_tokens: 29 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const executor = createOpenAICompatibleStructuredExecutor({
      provider: 'deepseek',
      apiKey: 'example-redacted-key',
      baseURL: 'https://api.deepseek.com/beta',
      model: 'deepseek-v4-flash',
      structuredOutputMode: 'deepseek_strict_tool',
      schemaProfiles: [{ name: 'router_candidate_v1', schema }],
    });
    await expect(executor({
      schema,
      systemPrompt: 'system',
      userPrompt: 'question',
      maxOutputTokens: 400,
      signal: new AbortController().signal,
    })).resolves.toMatchObject({ object: { route: 'chat' } });

    const body = requestBodies[0];
    expect(requestBodies).toHaveLength(1);
    expect(body?.response_format).toBeUndefined();
    expect(body?.tool_choice).toEqual({
      type: 'function', function: { name: 'model_agent_result' },
    });
    expect(body?.tools).toEqual([
      expect.objectContaining({
        type: 'function',
        function: expect.objectContaining({
          name: 'model_agent_result', strict: true,
        }),
      }),
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
```

补充表驱动 RED：strict mode 结合 `/v1`、OpenAI provider、非 `deepseek-v4-flash`、空/重复 profiles、未注册 invocation schema，全部固定失败；`generateStructured` 调用次数为 0，序列化错误不含 key/base URL/canary。

- [ ] **Step 2: 运行 Provider 测试并确认 RED**

```powershell
bun test packages/ai/tests/model-agent-provider.test.ts
```

Expected：strict mode config、`provider.chat()` 或 `mode: 'tool'` 断言失败；现有 JSON mode 测试继续通过。

- [ ] **Step 3: 扩展配置和 dependency 类型**

把配置定义为严格 union：

```ts
type BaseExecutorConfig = {
  provider: 'deepseek' | 'openai';
  apiKey: string;
  baseURL: string;
  model: string;
};

export type OpenAICompatibleExecutorConfig = BaseExecutorConfig & (
  | {
      structuredOutputMode?: 'json_object';
      schemaProfiles?: never;
    }
  | {
      structuredOutputMode: 'deepseek_strict_tool';
      schemaProfiles: readonly ModelAgentStructuredSchemaProfile[];
    }
);

type ProviderClient = {
  (model: string): unknown;
  chat(model: string, settings: { structuredOutputs: true }): unknown;
};

type GenerateStructuredInput = {
  model: unknown;
  mode: 'json' | 'tool';
  schema: z.ZodTypeAny | ReturnType<typeof zodSchema>;
  schemaName?: 'model_agent_result';
  schemaDescription?: 'Return exactly one validated model-agent result.';
  system: string;
  prompt: string;
  maxTokens: number;
  maxRetries: 0;
  abortSignal: AbortSignal;
};
```

默认 dependency 只在 `mode === 'tool'` 时向 `generateObject()` 传 `schemaName/schemaDescription`。不要设置 repair function、tools executor、`maxRetries > 0` 或第二次 generate。

- [ ] **Step 4: 实现 config normalization、model 选择和 profile identity lookup**

固定规则：

```ts
const mode = config.structuredOutputMode ?? 'json_object';
const registry = mode === 'deepseek_strict_tool'
  ? compileDeepSeekStrictToolSchemaProfiles(config.schemaProfiles)
  : null;

if (mode === 'deepseek_strict_tool' &&
    (config.provider !== 'deepseek' ||
     model !== 'deepseek-v4-flash' ||
     normalizeExactDeepSeekBetaUrl(baseURL) === null)) {
  throw new Error('INVALID_MODEL_PROVIDER_CONFIG');
}

const provider = dependencies.createProvider({ apiKey, baseURL });
const modelHandle = mode === 'deepseek_strict_tool'
  ? provider.chat(model, { structuredOutputs: true })
  : provider(model);
```

executor invocation 在进入 Provider catch 边界前解析 profile：

```ts
const profile = registry?.resolve(input.schema);
if (registry && !profile) {
  throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
}

const request = registry
  ? {
      model: modelHandle,
      mode: 'tool' as const,
      schema: profile!.providerSchema,
      schemaName: 'model_agent_result' as const,
      schemaDescription: 'Return exactly one validated model-agent result.' as const,
    }
  : {
      model: modelHandle,
      mode: 'json' as const,
      schema: input.schema,
    };
```

随后只调用一次 `dependencies.generateStructured()`。Provider/SDK 异常仍走当前 trusted one-shot failure signal；本地未注册 schema 固定错误不得被包装成含 Provider 分类的 raw error。

- [ ] **Step 5: 更新 injected provider fixtures 并确认 GREEN**

测试 helper 使用 callable + `.chat`，避免每个测试手写不一致 stub：

```ts
function providerClient(
  defaultModel: (model: string) => unknown,
  strictModel: (model: string, settings: { structuredOutputs: true }) => unknown = defaultModel,
) {
  return Object.assign(defaultModel, { chat: strictModel });
}
```

Run：

```powershell
bun test packages/ai/tests/model-agent-provider.test.ts packages/ai/tests/model-agent-provider-failure.test.ts packages/ai/tests/model-agent-structured-schema.test.ts
bun run --cwd packages/ai typecheck
bun run --cwd packages/ai lint
```

Expected：全部 PASS；真实 SDK fake-fetch 只记录一次请求；默认 JSON 测试仍断言 `response_format={type:'json_object'}`；strict tool 无 `json_schema`。

- [ ] **Step 6: 提交 Task 2**

```powershell
git add packages/ai/src/model-agent-provider.ts packages/ai/tests/model-agent-provider.test.ts
git diff --cached --check
git commit -m "feat(ai): add DeepSeek strict tool transport"
```

## Task 3: Paired CLI preflight and evidence transport identity

**Files:**
- Modify: `packages/agent/scripts/phase-6-9-4-3-paired-cli.ts`
- Modify: `packages/agent/src/evals/phase-6-9-router-verifier-paired-contract.ts`
- Modify: `packages/agent/src/evals/run-phase-6-9-router-verifier-paired.ts`
- Modify: `packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts`
- Modify: `packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts`
- Modify: `packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts`

- [ ] **Step 1: 写 Beta URL、preflight、profile composition RED 测试**

把既有 CLI JSON mode 测试改成 strict-tool 期望，并新增：

```ts
expect(DEEPSEEK_BASE_URL).toBe('https://api.deepseek.com/beta');
expect(capturedConfig).toMatchObject({
  provider: 'deepseek',
  baseURL: 'https://api.deepseek.com/beta',
  model: 'deepseek-v4-flash',
  structuredOutputMode: 'deepseek_strict_tool',
});
expect((capturedConfig as { schemaProfiles: unknown[] }).schemaProfiles).toHaveLength(2);
```

URL 表驱动必须拒绝 `/v1`、`/beta/extra`、端口、query、fragment、userinfo、proxy、Unicode/percent-encoded hostname/path。新增 hostile compiler dependency 测试：preflight 返回 false 或抛出时，`randomUUID`、evidence fs、Provider factory、runner 调用次数全部为 0，结果为 `live_config_invalid` 且 `evidencePath=null`。

- [ ] **Step 2: 写 runner v2 / transport identity RED 测试**

在 contract 测试固定：

```ts
expect(PHASE_6943_RUNNER_VERSION).toBe('phase-6.9.4.3-runner-v2');
expect(PHASE_6943_STRUCTURED_OUTPUT_MODE).toBe('deepseek_strict_tool_v1');
```

测试矩阵：

- 新 v2 Live complete/incomplete 必须包含 `structuredOutputMode`；
- v2 Live 缺失、改为 `json_object` 或多余字段必须拒绝；
- 历史 v1 Live 缺失该字段继续按原结果解析；
- v1 Live 伪造该字段必须拒绝；
- Mock v1/v2 都不得出现该字段；
- Attempt A/B/C/D 文件不改写并保持原 validator 判定。

- [ ] **Step 3: 运行三组 Agent 测试并确认 RED**

```powershell
bun test packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts
```

Expected：旧 `/v1`、JSON executor、runner v1 和缺失 transport identity 导致预期断言失败；不得改动 28/72、预算或质量 metrics。

- [ ] **Step 4: 实现固定 profile preflight 与 strict executor composition**

CLI 导入两个 authoritative schema：

```ts
import { KNOWLEDGE_VERIFIER_MODEL_CANDIDATE_SCHEMA } from
  '../src/model-candidates/knowledge-verifier-model-candidate.ts';
import { ROUTER_MODEL_CANDIDATE_SCHEMA } from
  '../src/model-candidates/router-model-candidate.ts';

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/beta';
const PHASE_6943_SCHEMA_PROFILES = Object.freeze([
  Object.freeze({ name: 'router_candidate_v1', schema: ROUTER_MODEL_CANDIDATE_SCHEMA }),
  Object.freeze({
    name: 'knowledge_verifier_candidate_v1',
    schema: KNOWLEDGE_VERIFIER_MODEL_CANDIDATE_SCHEMA,
  }),
]);
```

`normalizeDeepSeekUrl()` 只接受 pathname `/beta`。composition dependency 增加纯 preflight：

```ts
validateLiveStructuredSchemas(): boolean;
```

默认实现调用 `compileDeepSeekStrictToolSchemaProfiles(PHASE_6943_SCHEMA_PROFILES)` 并只返回 boolean，不输出 schema/error。`executePhase6943Cli()` 在 `randomUUID()` 和 `reservePhase6943Evidence()` 之前执行；失败直接返回 `buildPhase6943InvalidRun('live', 'live_config_invalid')`。

`createPhase6943LiveDependencies()` 使用：

```ts
createExecutor({
  provider: 'deepseek',
  apiKey: config.apiKey,
  baseURL: DEEPSEEK_BASE_URL,
  model: DEEPSEEK_MODEL,
  structuredOutputMode: 'deepseek_strict_tool',
  schemaProfiles: PHASE_6943_SCHEMA_PROFILES,
});
```

保留 `withPhase6943UsageProvenance`、一次调用、10 秒 timeout、11,200 output cap 和现有 cost admission。

- [ ] **Step 5: 实现 runner v2 的向后兼容 evidence contract**

固定常量：

```ts
const PHASE_6943_LEGACY_RUNNER_VERSION =
  'phase-6.9.4.3-runner-v1' as const;
export const PHASE_6943_RUNNER_VERSION =
  'phase-6.9.4.3-runner-v2' as const;
export const PHASE_6943_STRUCTURED_OUTPUT_MODE =
  'deepseek_strict_tool_v1' as const;
```

`REPORT_BASE_SCHEMA.runnerVersion` 接受 legacy/current；Live fields 增加可选 literal。顶层 `superRefine` 固定：current Live 必须有该字段，legacy Live 必须没有，所有 Mock 禁止。新 `buildLiveReport()` 写入：

```ts
structuredOutputMode: PHASE_6943_STRUCTURED_OUTPUT_MODE,
```

不要修改 report schema version、dataset digest、prompt version、历史 JSON 或 enablement thresholds。

- [ ] **Step 6: 用真实 Router/Verifier schema 做零网络 SDK wire GREEN**

在 CLI 测试通过 real shared executor + fake fetch 连续调用两个 profile，Provider response 分别返回合法 tool arguments。断言：

```ts
expect(requestBodies).toHaveLength(2);
for (const body of requestBodies) {
  expect(body.response_format).toBeUndefined();
  expect(body.tool_choice).toEqual({
    type: 'function', function: { name: 'model_agent_result' },
  });
  expect((body.tools as Array<{ function: { strict: boolean } }>)[0]
    ?.function.strict).toBe(true);
}
expect(JSON.stringify(requestBodies[0])).not.toContain('"$schema"');
expect(JSON.stringify(requestBodies[1])).not.toContain('"const"');
expect(JSON.stringify(requestBodies[1])).not.toContain('"items":[');
```

该测试必须在 `finally` 恢复 `globalThis.fetch`，不得读取 `.env`。

- [ ] **Step 7: 重跑目标测试并确认 GREEN**

```powershell
bun test packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts
bun run --cwd packages/agent typecheck
bun run --cwd packages/agent lint
```

Expected：目标测试全部 PASS；Mock counters 仍为 `100/28/0/28/72`；preflight failure 的 Provider/evidence 调用均为 0。

- [ ] **Step 8: 提交 Task 3**

```powershell
git add packages/agent/scripts/phase-6-9-4-3-paired-cli.ts packages/agent/src/evals/phase-6-9-router-verifier-paired-contract.ts packages/agent/src/evals/run-phase-6-9-router-verifier-paired.ts packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts
git diff --cached --check
git commit -m "feat(agent): use strict tool paired profile"
```

## Task 4: Zero-network regression, historical evidence and documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-07-14-phase-6-9-4-3-structured-output-resilience-design.md`
- Modify: `docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `docs/acceptance-checklist.md`
- Modify: `docs/roadmap.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: 运行 AI 全量门禁**

```powershell
bun test packages/ai/tests
bun run --cwd packages/ai typecheck
bun run --cwd packages/ai lint
```

Expected：全部 exit 0；输出中不存在真实 HTTP 请求、credential 或 Provider raw body。

- [ ] **Step 2: 运行 Agent 全量门禁和 deterministic baseline**

```powershell
bun test packages/agent/tests
bun run --cwd packages/agent typecheck
bun run --cwd packages/agent lint
bun run --cwd packages/agent eval:phase-6-9-4-1
```

Expected：tests/typecheck/lint exit 0；baseline 仍为 `74/100、critical=2`。

- [ ] **Step 3: 运行 fresh Mock 和 strict validator**

```powershell
bun run --cwd packages/agent eval:phase-6-9-4-3
bun run --cwd packages/agent eval:phase-6-9-4-3:validate -- --profile mock --file docs/acceptance/evidence/phase-6-9-4-3/mock.json
```

Expected：Mock CLI 为预期 exit 1、`mock / complete / paired_candidate_not_run`；strict validator exit 0；100 cases、28 runtime invocations、0 Provider attempts、28 strict successes、72 zero-call。

- [ ] **Step 4: 逐个验证历史 Live evidence 且不改写 blob**

```powershell
bun run --cwd packages/agent eval:phase-6-9-4-3:validate -- --profile live --file docs/acceptance/evidence/phase-6-9-4-3/live-20260713T122743752Z-46b0f4785861.json
bun run --cwd packages/agent eval:phase-6-9-4-3:validate -- --profile live --file docs/acceptance/evidence/phase-6-9-4-3/live-20260713T124435253Z-4d37573c86dc.json
bun run --cwd packages/agent eval:phase-6-9-4-3:validate -- --profile live --file docs/acceptance/evidence/phase-6-9-4-3/live-20260714T022627206Z-08bddedf3f64.json
bun run --cwd packages/agent eval:phase-6-9-4-3:validate -- --profile live --file docs/acceptance/evidence/phase-6-9-4-3/live-20260714T032310330Z-991994cb5bb5.json
git hash-object docs/acceptance/evidence/phase-6-9-4-3/live-20260713T122743752Z-46b0f4785861.json docs/acceptance/evidence/phase-6-9-4-3/live-20260713T124435253Z-4d37573c86dc.json docs/acceptance/evidence/phase-6-9-4-3/live-20260714T022627206Z-08bddedf3f64.json docs/acceptance/evidence/phase-6-9-4-3/live-20260714T032310330Z-991994cb5bb5.json
```

Expected：Attempt A 仍为预期 exit 3 / profile mismatch；B/C/D exit 0 且仍为 incomplete；四个 blob 依次保持 `330a5cfcfda64a4c90b60e0e711ee6f2ce69b6c6`、`dd6cb8f2e543c4b89c009d9198b3d89f344ce594`、`ede0a9f5576996a2bad7a9dfb60cd135047d4edf`、`bc9f4e2efc70d26723d56418bebf327e1e75383e`。

- [ ] **Step 5: 运行 0-call Live preflight 负向验收**

在不设置 Live 双开关、不给合法 Beta profile 的环境下运行一次 CLI，并比较 evidence 文件数量：

```powershell
$before = (Get-ChildItem docs/acceptance/evidence/phase-6-9-4-3/live-*.json).Count
bun run --cwd packages/agent eval:phase-6-9-4-3:live -- --live --input-price-usd-per-million 0.147119403 --output-price-usd-per-million 0.294238805 --max-cost-usd 0.10
$exit = $LASTEXITCODE
$after = (Get-ChildItem docs/acceptance/evidence/phase-6-9-4-3/live-*.json).Count
if ($exit -ne 3 -or $before -ne $after) { throw 'zero-call preflight contract failed' }
```

Expected：exit 3 / `live_config_invalid`；evidence 数量不变；不得读取或输出 `.env` key。

- [ ] **Step 6: 同步高质量文档**

文档必须明确记录：

- Attempt D 的 15/16 与固定失败事实，不把 strict tool 写成已完成 Live；
- 旧 `json_object` 只保证合法 JSON，Zod 曾只在本地执行；
- 新 `deepseek_strict_tool_v1` 的 Beta、唯一 forced function、无业务执行语义；
- Router/Verifier canonical Zod 与 Provider compatibility projection 的双层职责；
- v2 新 evidence 与 v1 历史 evidence 的兼容规则；
- 100/28/72、400/400、96,000/11,200、10 秒、`maxRetries=0` 均不变；
- Router/Verifier 仍 `enabled=false`，生产 Chat 仍 deterministic；
- 下一步只能是合并后从新 main 发起独立 controlled-Live；
- “回顾时可以问”与下一会话可复制问题。

`DEVLOG.md` 记录四个任务的 RED/GREEN 命令、通过数字、提交 SHA 和未调用真实模型；不要复制测试 stdout 或任何敏感环境值。

- [ ] **Step 7: 文档/隐私/格式验证**

```powershell
git diff --check
rg -n "Authorization: Bearer|BEGIN .*PRIVATE KEY|api[_ -]?key\s*[:=]|access[_ -]?token\s*[:=]|client[_ -]?secret\s*[:=]" packages/ai packages/agent docs AGENTS.md README.md DEVLOG.md
git status --short
```

Expected：`git diff --check` exit 0；隐私扫描只有既有安全测试/规范中的固定检测表达式，不出现真实 credential、Provider output 或 raw error；没有 evidence JSON 改动。

- [ ] **Step 8: 提交 Task 4**

```powershell
git add docs/superpowers/specs/2026-07-14-phase-6-9-4-3-structured-output-resilience-design.md docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md docs/ai-behavior-acceptance.md docs/acceptance-checklist.md docs/roadmap.md AGENTS.md README.md DEVLOG.md
git diff --cached --check
git commit -m "docs(agent): record strict tool checkpoint"
```

## Task 5: Review, merge, main re-verification and push

**Files:**
- No new implementation files; only review fixes if required.

- [ ] **Step 1: 规格逐项审查**

逐条对照设计第 4~10 节和本计划，确认：显式模式、Beta exact URL、两个固定 profiles、compatibility projection、forced tool、canonical Zod、zero-call preflight、v1/v2 evidence、28/72、无 retry、生产 disabled 全部有代码和测试。发现缺口必须先写 RED 再修复，并单独提交 review fix。

- [ ] **Step 2: 质量与安全审查**

重点检查：hostile getter/proxy、对象原地修改、schema identity 混淆、profile name 重复、Provider model 创建顺序、未注册 schema 泄漏、默认 JSON 回归、error provenance、fetch 恢复、历史 evidence mutation、key/base URL/raw body 序列化。

- [ ] **Step 3: 在任务分支重新运行最终门禁**

```powershell
bun test packages/ai/tests
bun run --cwd packages/ai typecheck
bun run --cwd packages/ai lint
bun test packages/agent/tests
bun run --cwd packages/agent typecheck
bun run --cwd packages/agent lint
bun run --cwd packages/agent eval:phase-6-9-4-1
bun run --cwd packages/agent eval:phase-6-9-4-3
git diff main...HEAD --check
git status --short --branch
```

Expected：所有门禁符合 Task 4 已记录结果；工作区干净；无真实模型调用。

- [ ] **Step 4: `--no-ff` 合并回 main**

```powershell
git switch main
git pull --ff-only origin main
git merge --no-ff codex/phase-6-9-4-3-structured-output-resilience -m "merge: phase 6.9.4.3 structured output resilience"
```

Expected：产生独立 merge commit；不得 squash 或从任务分支继续创建下一个分支。

- [ ] **Step 5: 在 main 重复最终门禁**

```powershell
bun test packages/ai/tests
bun run --cwd packages/ai typecheck
bun run --cwd packages/ai lint
bun test packages/agent/tests
bun run --cwd packages/agent typecheck
bun run --cwd packages/agent lint
bun run --cwd packages/agent eval:phase-6-9-4-1
bun run --cwd packages/agent eval:phase-6-9-4-3
git status --short --branch
```

Expected：与任务分支结果一致；main 工作区干净。

- [ ] **Step 6: 推送、核对三方 SHA、删除任务分支**

```powershell
git push origin main
$local = git rev-parse main
$tracking = git rev-parse origin/main
$remote = (git ls-remote origin refs/heads/main).Split("`t")[0]
if ($local -ne $tracking -or $local -ne $remote) { throw 'main SHA mismatch' }
git branch -d codex/phase-6-9-4-3-structured-output-resilience
```

Expected：local/origin/remote main SHA 完全一致；只删除已合并的本地任务分支；Docker、volume、数据库和浏览器均未操作。

## 后续独立任务

本计划完成不等于 Phase 6.9.4.3 完成。随后从新的已推送 `main` 创建独立 controlled-Live 分支，才允许使用根 `.env` 的 `DEEPSEEK_API_KEY` 和单次子进程 Beta base URL。只有新 run 达到 28/28 strict success、72/72 zero-call，并通过质量、安全、权限、延迟、token、usage provenance 与成本门槛，Router / Verifier 才能从 `usage_unverifiable` 进入 enablement 决策；否则继续关闭且不得拼接历史 run。
