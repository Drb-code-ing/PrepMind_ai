# Phase 6.9.4.3 Structured Output 韧性设计

> 日期：2026-07-14
> 状态：设计已实施并完成零网络 checkpoint；Phase 6.9.4.3 controlled-Live 仍未完成
> 关联证据：Attempt E `live-20260714T071444506Z-65042475cbaf.json`（Attempt D 仍作为历史 headroom evidence）
> 当前固定失败 case：`router_ambiguous_notes_tutor_01`

## 1. 结论

Attempt D 已把 Router 真实 strict success 推进到 15/16，但最后一个 eligible case 仍以 `PROVIDER_ERROR / structured_output` fail-closed。成功输出最高为 341 tokens，没有触及 400-token 上限，因此继续增加输出上限或直接重跑都缺少证据支持。

本设计采用 **DeepSeek strict Function Calling 作为受控 structured-output transport**：模型只允许调用一个不会执行任何业务逻辑的合成函数，并通过 `strict: true` 让 Provider 按 JSON Schema 生成参数；返回值仍必须经过现有本地 strict Zod 校验。每个 case 仍最多一次 Provider 调用，不自动重试，不读取或保存 raw output。

普通 `json_object` 路径继续保留为默认兼容策略；DeepSeek strict tool 必须显式选择，只用于新的 Phase 6.9.4.3 controlled-Live paired eval。Conversation Summary、生产 Chat 和尚未启用的 Router / Verifier 生产候选路径不随本任务改变。

2026-07-14 已完成上述设计的零网络实施与 Mock 验收。这个 checkpoint 证明的是 schema compatibility、strict-tool wire、Live preflight 和 evidence contract 的工程韧性，不是真实模型语义质量通过。Router / Verifier 仍为 `enabled=false`，生产继续使用 deterministic policy。

随后从新 `main@5d964c51a948d4603a1fcff5c52dba66b0581725` 执行 Attempt E。官方 Chat Completion 文档列出 `deepseek-v4-flash`，独立的 Tool Calls 指南描述通用 Beta endpoint 与 strict schema 约束；本地 fake-fetch 捕获的 SDK wire 与这些公开基础约束一致：单一 forced `model_agent_result`、`strict:true`、全 object properties required、`additionalProperties:false`，且不含 `response_format`。Tool Calls 指南没有明确声明该模型的 strict-tool compatibility；Attempt E 又在首个 eligible case 得到 `PROVIDER_ERROR / http_client` 并 fail-closed，因此 Provider/模型级 compatibility 与语义质量仍未通过。

## 2. 问题与证据边界

### 2.1 Attempt D 固定事实

| 字段 | 结果 |
| --- | ---: |
| observed / notRun | 52 / 48 |
| runtime invocations / provider attempts | 16 / 16 |
| strict successes | 15 |
| 失败 case | `router_ambiguous_mixed_chat_16` |
| 失败分类 | `PROVIDER_ERROR / structured_output` |
| 成功 output 范围 | 59~341 |
| 成功 usage | 4,446 input / 2,185 output |
| 部分可审计成本 | USD 0.001297004654663 |
| Router / Verifier | `enabled=false / usage_unverifiable` |

失败输入为“我该继续学还是休息一下？”，没有 active context。现有安全合同不保存 Provider 原始输出、SDK raw error、prompt 或响应正文，因此不能从 evidence 精确断言它属于：

- 无对象或空内容；
- JSON parse 失败；
- JSON 合法但不满足 Router strict schema；
- Provider 在 structured-output 生成阶段的其他失败。

本设计解决的是已经被证明存在的 **Provider schema enforcement 缺口**，不把无法观测的具体 raw failure 写成既定事实。

### 2.2 当前真实 wire 行为

当前锁定依赖为：

- `ai@4.3.19`；
- `@ai-sdk/openai@1.3.24`。

共享 executor 当前固定调用：

```ts
generateObject({
  mode: 'json',
  schema,
  maxRetries: 0,
});
```

`deepseek-v4-flash` 不在该 SDK 的 OpenAI reasoning-model 识别集合内，且当前模型配置没有开启 `structuredOutputs`。因此 SDK 实际向 DeepSeek 发送：

```json
{
  "response_format": { "type": "json_object" }
}
```

Zod schema 会被写进提示词，但不会成为 Provider 级 schema contract。Provider 返回文本后，AI SDK 才在本地执行 JSON parse 与 schema validation；任一步失败都会在当前安全分类中落为 `structured_output`。

DeepSeek 官方 Chat API 也只把普通 JSON Output 定义为 `text | json_object`，并要求调用方在 prompt 中自行描述 JSON 格式；它没有为普通 JSON Output 声明 `json_schema` response format。官方 strict JSON Schema 能力位于 Beta Function Calling 的 `strict: true` 模式。

参考：

- [DeepSeek Create Chat Completion](https://api-docs.deepseek.com/api/create-chat-completion)
- [DeepSeek Tool Calls / strict 模式](https://api-docs.deepseek.com/zh-cn/guides/tool_calls)

### 2.3 为什么 Conversation Summary 成功不能证明 Router 稳定

Conversation Summary 使用同一共享 executor 和 400-token 上限，但其 schema 只有一个自由文本字段：

```ts
{ summary: string }
```

Router 包含六值 route enum、四值 reasonCode enum、0~1 number 和 strict object；Verifier 还包含状态与 evidenceCodes 的关联约束。Summary 的一次真实成功只能证明普通 JSON Output 可以工作，不能证明更严格、多枚举 schema 在所有 case 上稳定。

## 3. 方案比较

### 3.1 方案 A：只强化 prompt 或增加 few-shot

优点是改动最小。缺点是 Provider 仍只保证“合法 JSON”，字段、枚举和交叉约束仍依赖模型自觉遵守；它无法封闭当前 wire contract 缺口，因此不采用为主方案。

Prompt 仍应保持简洁、明确，但它只能承担语义分类说明，不能冒充 schema enforcement。

### 3.2 方案 B：在 JSON mode 直接开启 `structuredOutputs`

当前 SDK 会把该组合转换为：

```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": { "strict": true }
  }
}
```

DeepSeek 当前普通 Chat API 文档没有声明支持该 response format。直接开启可能把本地 structured-output 失败变成 HTTP 400 或 Provider compatibility failure，因此拒绝。

### 3.3 方案 C：DeepSeek Beta strict tool + 本地 Zod

采用。原因如下：

1. DeepSeek 官方明确声明 strict Function Calling 会按函数 JSON Schema 生成参数；
2. 当前 SDK 能生成 `tool_choice`、唯一函数、`strict: true` 和参数 schema；
3. 不需要执行任何真实工具，函数调用只作为结构化结果信封；
4. 仍保留本地 Zod，Provider 约束不是最终信任边界；
5. 保持一次调用、零重试和现有预算合同。

风险是该能力仍标记为 Beta。因此它只进入受控评测，不直接进入生产；后续 controlled-Live 仍必须用完整 28-case strict success 和现有质量、安全、延迟、token、成本门槛证明可用性。

## 4. 目标与非目标

### 4.1 目标

1. 为共享 OpenAI-compatible executor 增加显式、可审计的 structured-output transport 策略。
2. 让 DeepSeek Router / Verifier 评测使用 Provider 级 strict tool schema，而不是 prompt-only schema。
3. 保持 canonical Zod schema 为最终权威，并对 Provider schema 进行兼容投影。
4. 在零网络测试中固定实际 wire body，防止 SDK 升级或配置漂移悄悄退回 `json_object`。
5. 保持一次调用、无重试、预算不可变、取消/超时优先和无正文诊断。
6. 不影响 Conversation Summary、Mock、历史 evidence 和生产 deterministic 路径。

### 4.2 非目标

- 不读取、持久化或打印 Provider raw output、raw error、HTTP body、prompt 或凭据；
- 不增加自动 repair、第二次模型调用、retry、provider fallback 或 run 拼接；
- 不继续提高 Router / Verifier 的 400-token 上限；
- 不放宽 route、reasonCode、status、evidenceCodes 或权限映射；
- 不修改 100-case dataset、28 eligible / 72 zero-call 边界或 enablement 门槛；
- 不接入 `/api/chat`、生产 Trace API/UI、数据库或浏览器页面；
- 不把 Beta strict tool 的零网络 wire 验证写成真实模型质量通过。

## 5. 共享 executor 策略

### 5.1 显式模式

`OpenAICompatibleExecutorConfig` 增加显式模式，命名固定为：

```ts
type StructuredOutputMode =
  | 'json_object'
  | 'deepseek_strict_tool';
```

合同：

- 未提供时保持 `json_object`，确保 Conversation Summary 和已有调用方行为不变；
- `deepseek_strict_tool` 只允许 `provider='deepseek'`；
- 当前评测只允许 `model='deepseek-v4-flash'`；
- strict tool 只允许规范化后的官方地址 `https://api.deepseek.com/beta`；
- HTTP、代理域名、用户名密码、端口、query、fragment、额外 path 和相似 hostname 全部拒绝；
- 模式、Provider、模型或地址不匹配时在 executor 初始化阶段以固定安全错误拒绝，不创建可调用的 Live executor。

这里不根据 hostname 或 model 名称自动猜测模式。显式配置能避免未来 OpenAI、代理或其他兼容供应商被错误发送 DeepSeek Beta 专用 wire contract。

### 5.2 strict tool wire contract

strict mode 使用 OpenAI chat model settings：

```ts
provider.chat(model, { structuredOutputs: true })
```

并调用：

```ts
generateObject({
  mode: 'tool',
  schema: providerCompatibleSchema,
  schemaName: 'model_agent_result',
  schemaDescription: 'Return exactly one validated model-agent result.',
  maxRetries: 0,
});
```

预期 wire 必须同时满足：

- `response_format` 不存在；
- 只有一个 `model_agent_result` function；
- `tool_choice` 强制选择该 function；
- `function.strict === true`；
- `function.parameters` 只含批准的 schema 结构；
- `max_tokens === 400`；
- 单次 executor invocation 最多一次 fetch。

这个 function 没有 executor、handler、MCP server、数据库写入或外部副作用。AI SDK 只把 function arguments 解析为 object，因此它不属于 Phase 9 的业务 Tool，也不会改变 Router “不执行工具”的权限边界。

## 6. Canonical schema 与 Provider schema

### 6.1 双层职责

两层 schema 职责固定如下：

| 层 | 职责 | 权威性 |
| --- | --- | --- |
| Provider strict-tool schema | 尽可能在生成阶段约束 JSON 形状 | 非最终权威 |
| 当前 Zod schema | 校验完整字段、枚举、关联约束和自定义 refinement | 最终权威 |

Provider 返回对象后，AI SDK 和 `ModelAgentRuntime` 仍必须使用当前 canonical Zod schema 校验。任何 Provider 接受但本地 Zod 拒绝的对象继续 fail-closed，不允许 candidate applied。

### 6.2 当前 schema 的零网络 wire 检查

Router 当前生成的 JSON Schema 主要包含：

- strict object；
- string enum；
- number minimum / maximum；
- 所有属性 required；
- `additionalProperties: false`。

Verifier 当前 Zod discriminated union 还会生成：

- 顶层 `anyOf`；
- `const`；
- 单元素 tuple 的数组型 `items`；
- `minItems / maxItems`；
- draft-07 `$schema` 标记。

DeepSeek strict 文档明确展示了 object、array、number、enum、anyOf、`$ref` 等能力，但没有把 `const`、tuple `items`、`minItems / maxItems` 或 draft 元数据列为稳定子集。为避免 Router 修好后在 Verifier 才暴露第二个兼容问题，不能把原始 SDK 生成 schema 不加检查地发送给 Provider。

### 6.3 兼容投影

共享 AI 层使用 AI SDK `zodSchema()` 得到 `{ jsonSchema, validate }`，对 `jsonSchema` 做纯函数、非原地的 DeepSeek strict-tool 兼容投影，同时保留原始 `validate`：

1. 删除仅用于声明 draft 的顶层 `$schema`；
2. 把 `{ const: value }` 等价转换为 `{ enum: [value] }`；
3. 把单元素 tuple `items: [schema]` 转换为同一元素 schema，并从 Provider schema 删除 `minItems / maxItems`；数组长度仍由 canonical Zod 校验；
4. 递归验证每个 object 的所有 properties 都位于 required，且 `additionalProperties === false`；
5. 只接受当前 Router / Verifier 实际需要、且 DeepSeek strict 文档支持的低复杂度关键字；
6. 遇到多元素 tuple、可选 object 字段、自由 additional properties、未知关键字或无法安全复制的值时，必须在 Provider 调用前拒绝；
7. 不把 `superRefine` 伪造为 Provider 能力。Verifier conflict evidence 去重和 status/evidenceCodes 的完整关联仍由 canonical Zod 校验。

投影结果只用于 Provider 参数 schema，不替换导出的 Router / Verifier Zod schema，也不改变 TypeScript 业务类型。

### 6.4 不可变与安全要求

- 不修改调用方传入的 Zod schema 或 SDK `jsonSchema` 对象；
- 编译后的 Provider schema 进行深冻结或只读重建；
- 不读取用户 prompt、query、chunk 或模型输出来构建 schema；
- schema 编译错误只返回固定低基数本地错误，不附带 schema dump、路径正文或异常 stack；
- paired CLI 在 Live preflight 中预编译 Router 与 Verifier 两个固定 schema；任一不兼容都以零 Provider 调用退出。

### 6.5 固定 schema profile registry

`deepseek_strict_tool` executor 不在每次调用时临时接受任意 schema。composition root 必须在创建 executor 时显式注册固定 profile：

```ts
[
  { name: 'router_candidate_v1', schema: ROUTER_MODEL_CANDIDATE_SCHEMA },
  {
    name: 'knowledge_verifier_candidate_v1',
    schema: KNOWLEDGE_VERIFIER_MODEL_CANDIDATE_SCHEMA,
  },
]
```

factory 先完成两个 profile 的兼容投影、验证和只读快照，再创建 Provider model。运行时按 canonical schema object identity 只读取已编译 profile；未注册 schema、重复 name、重复 schema identity 或编译失败统一抛出固定 `MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED`，不得进入 fetch。

paired CLI 把该本地错误映射为 `live_config_invalid`，provider attempt 计数保持 0。这样既避免在用户输入到来后动态生成 Provider contract，也保证 Conversation Summary 不会意外进入只为 Router / Verifier 注册的 strict-tool executor。

## 7. Paired CLI 与运行边界

新的 controlled-Live 使用：

- Provider：`deepseek`；
- model：`deepseek-v4-flash`；
- base URL：`https://api.deepseek.com/beta`；
- structured mode：`deepseek_strict_tool`；
- dataset、prompt version、预算和 pricing snapshot 保持不变。

CLI 继续只从根 `.env` 读取 `DEEPSEEK_API_KEY` 这一项；Beta base URL 可以在单次受控子进程中显式覆盖，不要求永久修改 `.env`。地址仍经过 exact normalization，禁止任意 endpoint。

Live 前置顺序固定为：

```text
CLI flags / 双开关 / key / pricing / cost 校验
  -> exact DeepSeek Beta URL 校验
  -> Router / Verifier provider schema 预编译
  -> executor 创建
  -> 从 case 1 开始的单次完整 paired run
```

任一 preflight 失败都必须：

- 对外返回 `live_config_invalid`；共享 factory 内部只允许固定 `MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED`；
- provider attempts 保持 0；
- 不创建新的 Live evidence；
- 不泄露 key、base URL、schema 正文或内部异常。

72 条 ineligible / safety case 继续保持零 Runtime invoke、零 Provider attempt。只有原固定的 16 条 Router ambiguous 和 12 条 Verifier semantic case 可以进入 strict tool。

## 8. 错误、预算与隐私

### 8.1 错误语义

- HTTP、transport、invalid-response 和 structured-output 仍使用现有八类共享 Provider diagnostics；
- strict tool 没有生成 tool call、arguments 不能解析或 canonical Zod 拒绝时继续 fail-closed；
- 本任务不新增原始错误字段，也不拆分或持久化 raw parse/schema 细节；
- preflight schema incompatibility 是本地配置/contract 失败，不得伪装成一次已发生的 Provider attempt；
- Runtime timeout / external abort 继续高于 Provider failure 分类。

### 8.2 调用和预算

- Router：最多 1 call、800 local input、400 output；
- Verifier：最多 1 call、1,600 local input、400 output；
- 全局：最多 28 calls、96,000 provider input、11,200 provider output；
- `maxRetries=0`；
- 不增加 repair call 或 continuation call；
- 失败后的 usage 不可验证语义不变，不能用 reservation 冒充 Provider-reported usage。

### 8.3 隐私

Error、Trace、evidence、stdout、文档和 Git 禁止包含：

- 完整 prompt、query、chunk、Provider output；
- API key、Authorization、Cookie、token、client secret；
- HTTP request/response body、headers、raw URL；
- SDK raw error、message、stack、cause；
- function arguments 原文或 schema validation 的失败值。

允许观测的仍只有固定枚举、成功/失败、预算、脱敏 Trace、Provider-reported usage 和聚合成本。

## 9. TDD 与验收设计

实施必须从失败测试开始，至少覆盖以下组别。

### 9.1 共享 AI 层

1. 默认模式仍发送 `json_object`，现有 Conversation Summary contract 不变；
2. strict tool 发送官方 Beta endpoint、唯一 forced tool、`strict: true`，且无 `response_format`；
3. Router 实际 schema wire snapshot 符合批准子集；
4. Verifier 实际 schema 完成 `const -> enum`、单元素 tuple 转换以及 `$schema / minItems / maxItems` 删除；
5. canonical Zod 仍拒绝错误 enum、extra field、重复 conflict evidence 和非法 status/evidence 组合；
6. 不支持的 schema 在 fetch 前失败；
7. invalid/missing tool call 安全归类且 raw content 不泄露；
8. 单次 invocation 不会发生第二次 fetch；
9. injected/custom dependencies 仍只能产生 `unknown` provenance；
10. timeout、abort、budget 和 one-shot diagnostics 合同保持通过。

### 9.2 Agent / paired eval

1. 100 条 Mock 仍为 complete，28 eligible、72 zero-call 不变；
2. deterministic baseline 仍为 74/100、critical=2；
3. strict-tool preflight 在错误 `/v1`、代理、伪造 hostname 或不兼容 schema 时 0 provider call；
4. cost preflight 仍使用 96,000 / 11,200 worst-case；
5. historical Attempt A/B/C/D evidence 保持原判定且 Git blob 不改写；
6. 新 evidence 必须标识受控 strict-tool profile，防止与旧 `json_object` run 混淆；
7. Mock/fake tests 不读取 `.env` key，也不访问网络。

### 9.3 完成设计后的真实验收门槛

本设计实施、合并 main、main 复验并推送后，才允许从新的 main 创建独立 controlled-Live 分支。Phase 6.9.4.3 只有同时满足以下条件才能完成：

- 28/28 eligible case strict success；
- 72/72 ineligible / safety case 零 Provider 调用；
- Router / Verifier 全部质量、安全、权限边界门槛通过；
- latency、token、usage provenance 和成本门槛通过；
- strict validator 返回 complete canonical Live evidence；
- Router / Verifier enablement 决策不被 incomplete、usage 不可验证或 critical failure 阻断。

任何一项不满足都继续 `enabled=false`，不得与历史 partial run 拼接，也不得通过重试某一个失败 case 补齐报告。

## 10. 实施 checkpoint

### 10.1 已完成的工程边界

- `303b88a feat(ai): compile strict tool schema profiles`：完成 identity-only profile registry、非原地兼容投影、深冻结与 hostile input fail-closed。Provider projection 只做审批过的删除/等价转换；完整长度、状态关联和自定义 refinement 仍由 canonical Zod 最终裁决。
- `bdb7cb5 feat(ai): add DeepSeek strict tool transport`：保留默认 `json_object`，新增显式 `deepseek_strict_tool`。该模式只允许 `deepseek-v4-flash` 与精确 `https://api.deepseek.com/beta`，只发送唯一 forced synthetic function `model_agent_result`、`strict: true`，不带 `response_format/json_schema`。合成函数没有 handler、业务执行、副作用或 MCP 语义。
- `2100e10 feat(agent): use strict tool paired profile`：schema 编译/校验提前到 UUID、evidence reservation、Provider factory 与 runner 之前；只有显式返回 `true` 才能继续。最终审查又将 dependencies/strict executor 本地初始化及权威快照纳入 UUID/evidence 之前的受控 preflight；schema 返回非 `true`或抛错，以及初始化抛错、返回 malformed/hostile dependencies 或在 arm 前同步触发 attempt callback，都以 `live_config_invalid` 零 UUID、零 evidence、零 Provider attempt 结束。

Live evidence 从此使用 `phase-6.9.4.3-runner-v2` 和 `deepseek_strict_tool_v1`。历史 runner v1 Live evidence 只读兼容，不改写；Mock v1/v2 都禁止携带 Live transport 字段，避免伪造真实 Provider lane。

### 10.2 不变合同与零网络证据

- dataset 仍为 100 条；28 条 eligible、72 条 design-time zero-call；
- Router 仍为 800 local input / 400 output，Verifier 仍为 1,600 local input / 400 output；
- 全局仍为 28 calls / 96,000 provider input / 11,200 provider output，单 case timeout 仍为 10 秒，`maxRetries=0`；
- deterministic baseline 仍为 74/100、critical=2；fresh Mock 为 complete，`caseEntries/runtimeInvocations/providerAttempts/strictSuccesses/zeroCallCases = 100/28/0/28/72`；
- fresh gates：AI 151 passed，Agent 344 passed，AI/Agent typecheck 与 lint 均 exit 0；
- zero-call Live config 验收为 exit 3，Live evidence 数量 `4 -> 4`，证明配置失败没有预留证据或进入 Provider；
- 历史 validator：Attempt A exit 3 / `profile_mismatch`，Attempt B/C/D/E 均 exit 0 / `incomplete`；Git blob hash 依次为 `330a5cfcfda64a4c90b60e0e711ee6f2ce69b6c6`、`dd6cb8f2e543c4b89c009d9198b3d89f344ce594`、`ede0a9f5576996a2bad7a9dfb60cd135047d4edf`、`bc9f4e2efc70d26723d56418bebf327e1e75383e`、`368c91f817ad76272a495f77ff1d4d6f90695429`。

实施与批准设计、实施计划及历史 paired contract 一致：单 case 10 秒，Router / Verifier 单次 output 400，全局 output cap 11,200。

### 10.3 Attempt E 诊断边界

- Attempt E 运行 100 条 case，`adapterExecutions/runtimeInvocations/providerAttempts/strictSuccesses/zeroCallCases = 37/1/1/0/36`，`observed/notRun=37/63`，首个失败为 `router_ambiguous_notes_tutor_01`，report duration 204ms / failing case 157ms，usage 0/0，`providerReported=false`；
- `http_client` 是当前安全低基数分类，已排除 401/403 (`http_auth`) 与 429 (`http_rate_limit`)，但仍包含 400、402、422 等 4xx；系统不保存 raw status、body、headers、message 或 stack，因此不能把它进一步猜成 schema、余额或 Provider 版本问题；
- 官方文档与零网络 wire 对照只能排除“客户端使用未公开模型标识”“非 Beta endpoint”“缺失 strict/tool/schema 基础字段”等构造错误，不能排除模型级 feature/provider compatibility，不能证明服务端已接受请求，也不能证明账户余额或账单状态；
- 因此不重试、不绕过 runner、不读取 raw provider error。下一任务先做零网络 diagnostics/compatibility 设计与 Mock 门禁，必要时增加固定的 `http_payment` / `http_invalid_request` 等安全分类，再申请新的完整 Live。

### 10.4 不是完成声明

零网络 checkpoint 本身没有读取真实 key、设置 Live 双开关或调用真实模型；Attempt E 是随后唯一一次受控真实调用，结束后已恢复 Mock 并清除进程 key。Attempt D 的 15/16 strict success 与 `router_ambiguous_mixed_chat_16 / structured_output` 仍是历史事实；Attempt E 的 `router_ambiguous_notes_tutor_01 / http_client` 不能与历史 run 拼接，也不代表 Phase 6.9.4.3 完成。

## 11. 文档与提交边界

本任务按以下提交粒度推进：

1. 设计文档：只固定调查结论、架构与验收边界；
2. 用户审阅设计后，单独编写 TDD 实施计划；
3. 实施阶段按共享 executor、schema compatibility、paired CLI/evidence contract 分任务提交；
4. 每个任务完成后更新相应设计、计划、acceptance、roadmap/AGENTS/README/DEVLOG；
5. 每个任务分支合并 main 后在 main 再验收并推送远程，核对 local main / origin main / remote SHA；
6. controlled-Live 必须是实现和 Mock 验收后的新独立任务，不与代码实现提交混在一起。

## 12. 回顾时可以问

- 为什么 Attempt D 不能继续通过增加 `maxOutputTokens` 解决？
- 当前传给 `generateObject()` 的 Zod schema 为什么没有变成 DeepSeek Provider 级 schema？
- `json_object`、`json_schema` 和 strict Function Calling 的差别是什么？
- 合成的 `model_agent_result` function 为什么不属于业务工具，也不会执行副作用？
- 为什么 strict tool 后仍要保留本地 canonical Zod？
- Verifier 的 `const` 和 tuple schema 为什么需要兼容投影？
- 为什么 schema compatibility 必须在 Provider attempt 之前完成？
- 为什么使用 Beta 能力仍不能直接启用 Router / Verifier？
- 新 controlled-Live 为什么必须从 100 条 case 开头重新运行，不能只补最后 13 条？
- 哪些条件满足后 Phase 6.9.4.3 才能真正完成？
- 零网络 checkpoint 已经证明了什么，又为什么不能宣布 controlled-Live 完成？
- 为什么 schema 校验和 strict executor 本地初始化都必须在 UUID/evidence 前完成，且 schema 只有明确 `true` 才能继续？
- runner v2 为什么要标记 `deepseek_strict_tool_v1`，而历史 v1 Live 只读兼容？
- Attempt E 的 `http_client` 为什么不能直接等同于 422 schema error 或 402 余额不足？
- 本地 wire 符合官方公开基础约束，为什么仍需要模型级 Provider compatibility diagnostics？

下一会话可以直接问：

> 请先检查 Phase 6.9.4.3 Attempt E evidence；将本分支合并 main、main 复验并推送后，从新 main 开零网络 Provider compatibility diagnostics 任务，先区分 402 与参数类 4xx，不要重跑 Live。

## 13. 关联文档

- [Phase 6.9.4.3 Paired Eval 设计](./phase-6-9-4-3-router-verifier-paired-eval-design.md)
- [共享 Provider 失败诊断设计](./2026-07-13-phase-6-9-4-3-provider-failure-diagnostics-design.md)
- [Structured Output Headroom 设计](./2026-07-14-phase-6-9-4-3-structured-output-headroom-design.md)
- [Phase 6.9.4.3 验收记录](../../acceptance/phase-6-9-4-3-router-verifier-paired-eval.md)
- [Attempt D canonical incomplete evidence](../../acceptance/evidence/phase-6-9-4-3/live-20260714T032310330Z-991994cb5bb5.json)
- [Attempt E strict-tool incomplete evidence](../../acceptance/evidence/phase-6-9-4-3/live-20260714T071444506Z-65042475cbaf.json)
- [DeepSeek Tool Calls Guide](https://api-docs.deepseek.com/guides/tool_calls)
- [DeepSeek Create Chat Completion](https://api-docs.deepseek.com/api/create-chat-completion)
- [DeepSeek Error Codes](https://api-docs.deepseek.com/quick_start/error_codes)
