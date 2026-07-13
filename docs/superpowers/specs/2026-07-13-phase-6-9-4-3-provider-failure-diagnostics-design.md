# Phase 6.9.4.3 共享 Provider 失败诊断设计

> 日期：2026-07-13
> 状态：已实施并完成 Mock/fake executor 验收，待新的 controlled-Live paired eval
> 关联阶段：Phase 6.9.4.3 Router / Verifier paired eval 受控 Live 验收
> 前置证据：`docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md`

## 1. 结论

共享 `@repo/ai` Provider / `ModelAgentRuntime` 边界现已增加固定、脱敏的 Provider 失败分类，Router / Verifier paired eval 也已按严格位置合同消费该分类。顶层错误码继续保持 `PROVIDER_ERROR`，没有新增自动重试，也没有扩展数据库、生产 Trace API 或 UI。

该设计解决的是共享基础设施缺口，而不是只为 Phase 6.9.4.3 写一次性诊断脚本。完成后，当前 Router / Verifier、既有 ConversationSummary 以及未来 Memory、Orchestrator、MCP Agent 等所有复用 `ModelAgentRuntime` 的模型路径，都可以得到同一套安全故障语义。

共享诊断代码已完成测试、审查并合并至 `main`；本次文档收口没有新增真实模型调用。旧的两次 Live 失败证据继续原样保留，不覆盖、不改写。下一步不是启用候选，而是从最新已推送 `main` 发起一轮新的 controlled-Live paired eval。

## 2. 背景与问题

Phase 6.9.4.3 的 deterministic 和 Mock paired eval 已完成，但两次受控 Live 均在已越过 provider boundary 后停止：

- Attempt A：3 次 provider attempt，其中 2 次 strict success，第 3 次得到 `PROVIDER_ERROR`；
- Attempt B：1 次 provider attempt，0 次 strict success，随后得到 `PROVIDER_ERROR`；
- 两次运行都按 `usage_unverifiable` fail-closed，Router / Verifier 保持 `enabled=false`；
- 生产 Chat 继续使用 deterministic 路径，没有接入候选模型。

实施前，`packages/ai/src/model-agent-provider.ts` 捕获所有 provider 调用异常后只抛出 `MODEL_AGENT_PROVIDER_REQUEST_FAILED`，`packages/ai/src/model-agent-runtime.ts` 又将所有非超时、非取消异常映射为 `PROVIDER_ERROR`。因此既有 A/B 证据无法区分鉴权、限流、HTTP 客户端错误、服务端错误、网络传输问题、structured output 失败、无效响应和未知异常。

这是刻意的隐私边界带来的可观测性缺口：原始异常没有泄露，但安全分类也被一起丢失。本次实施在不放松隐私边界的前提下补回了最小、稳定、可复用的诊断信息；它只说明失败落在哪个安全类别，不声称给出供应商根因。

## 3. 方案选择

### 3.1 采用：共享 Runtime 分类，Eval 立即消费，生产展示后置

Provider adapter 在最靠近 AI SDK 的位置完成分类，只向 Runtime 传递固定枚举和安全的 retryable 判定。Runtime 将分类放进结构化 Error / Trace；candidate sanitizer 校验合同；paired eval 将分类写入下一次 Live 失败证据。

优点：

- 一次实现即可复用于当前和未来所有 Agent 模型路径；
- 分类发生在拥有 AI SDK 类型信息的正确边界，不需要解析错误字符串；
- Eval 可以立刻恢复诊断能力，同时不扩大生产 API/UI 范围；
- 保留 `PROVIDER_ERROR` 兼容性，不迫使所有调用方理解供应商细节。

### 3.2 不采用：本任务同时接入生产 Trace API / UI

该方案会同时修改数据库或服务端 DTO、在线 Trace API 和前端调试台。在 Live 合同尚未重新验证前扩大持久化与展示面，增加迁移、权限和兼容性成本。本任务只建立共享数据源，生产展示应在真实诊断分类经过受控 Live 验证后单独设计。

### 3.3 不采用：仅在 paired eval 包装器中增加旁路诊断

该方案改动小，但会复制 AI SDK 识别逻辑，ConversationSummary 和未来 Agent 仍然只能看到单一 `PROVIDER_ERROR`。它无法满足“一劳永逸”的共享基础设施目标。

## 4. 目标与非目标

### 4.1 目标

1. 对越过 provider boundary 后的失败给出固定、低基数、无正文的分类。
2. 保持现有顶层错误码、预算预留、超时、取消和安全降级语义。
3. 让 Error、Trace、candidate sanitizer 和 paired eval evidence 对分类保持一致。
4. 让历史 Phase 6.9.4.3 evidence 在新代码下仍可验证。
5. 用单元测试证明原始错误内容、HTTP 细节和凭据不会传播。

### 4.2 非目标

- 不增加自动重试、退避、provider fallback 或熔断器；
- 不记录 HTTP 状态码、URL、请求体、响应体、Headers 或 SDK 原始 message；
- 不修改 Agent 的语义策略、prompt、数据集、质量阈值或 enablement 门槛；
- 不修改数据库、Prisma、NestJS Agent Trace API、Web / Admin UI 或 Docker；
- 不在本任务中再次调用真实模型；
- 不把分类当作供应商 SLA、账单或根因的最终证明。

## 5. 共享合同

### 5.1 固定枚举

`@repo/ai` 新增并导出唯一的分类常量和类型，供 Runtime、candidate sanitizer 与 eval contract 复用：

```ts
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
```

分类含义固定如下：

| 分类 | 含义 | 典型来源 |
| --- | --- | --- |
| `http_auth` | Provider 拒绝身份或权限 | HTTP 401 / 403 |
| `http_rate_limit` | Provider 限流 | HTTP 429 |
| `http_client` | 其他明确的客户端请求错误 | HTTP 400~499，排除 401 / 403 / 429 |
| `http_server` | Provider 服务端错误 | HTTP 500~599 |
| `transport` | 请求未获得可分类的 HTTP 响应 | AI SDK `APICallError` 无状态码 |
| `structured_output` | 模型输出无法生成或满足 structured output | `NoObjectGeneratedError`、`JSONParseError`、`TypeValidationError` |
| `invalid_response` | Provider 返回空响应或 SDK 无法接受的响应数据 | `EmptyResponseBodyError`、`InvalidResponseDataError` |
| `unknown` | 无法通过安全类型守卫分类 | 普通 Error、非法状态码、hostile object / proxy |

分类优先级为 structured output、invalid response、HTTP、unknown。只检查最外层异常，不遍历 `cause`，避免从嵌套错误读取正文或触发 hostile getter。

### 5.2 Error 与 Trace 字段

`ModelAgentError` 和 `ModelAgentTrace` 分别增加可选字段：

```ts
providerFailureCategory?: ModelAgentProviderFailureCategory;
```

合同不变量：

1. 字段只允许与 `PROVIDER_ERROR` 同时存在。
2. 同一失败结果的 `error.providerFailureCategory` 与 `trace.providerFailureCategory` 必须同时存在且完全相等。
3. 共享 Runtime 新产生的所有 `PROVIDER_ERROR` 都必须携带分类；无法识别时使用 `unknown`。
4. 成功结果、`TIMEOUT`、`ABORTED`、`SCHEMA_INVALID`、预算、配置和其他非 Provider 错误不得携带该字段。
5. 字段在 TypeScript 公共类型中保持 optional，以兼容历史 evidence、已有测试 fixture 和外部构造的旧结果；Runtime 自身的行为由测试收紧为“Provider 失败必有分类”。
6. 顶层 `code/errorCode` 仍是 `PROVIDER_ERROR`，现有调用方不需要分支处理八个新错误码。

保留顶层 `PROVIDER_ERROR` 是为了维持调用方的稳定失败语义和 fail-closed 分支；八类低基数值只承担诊断职责，不能升级成新的控制流、重试策略或 enablement 旁路。字段的合法位置只有两处：共享 Runtime 失败结果的 `error.providerFailureCategory` 与 `trace.providerFailureCategory`，以及第 9.1 节限定的 paired Live observed entry。生产 Trace API / UI 当前没有接入该字段。

`structured_output` 与 Runtime 的 `SCHEMA_INVALID` 不能混用：前者表示默认 AI SDK dependency 在 provider adapter 内生成或解析 structured output 时失败，尚未向 Runtime 返回可供共享 schema 校验的对象，因此仍是 `PROVIDER_ERROR + structured_output`；后者表示 executor 已成功返回对象，但 Runtime 随后的共享 Zod schema 校验失败，是非 Provider 错误，不得携带分类。

`ModelAgentError.retryable` 保留现有字段，但由本地固定规则生成，不触发实际重试：

| 分类 | `retryable` |
| --- | --- |
| `http_rate_limit`、`http_server`、`transport` | `true` |
| `http_auth`、`http_client`、`structured_output`、`invalid_response`、`unknown` | `false` |

`TIMEOUT` 继续为 `retryable=true`，`ABORTED` 和其他现有错误保持原语义。任何自动重试都必须在未来单独设计，并重新评估费用、幂等与 usage 不可验证风险。

## 6. Provider adapter 分类边界

### 6.1 AI SDK 类型守卫

当前锁定依赖为 `ai@4.3.19`、`@ai-sdk/openai@1.3.24`。adapter 使用 AI SDK 导出的静态 `isInstance(error)` 守卫识别：

- `APICallError`；
- `NoObjectGeneratedError`；
- `EmptyResponseBodyError`；
- `InvalidResponseDataError`；
- `JSONParseError`；
- `TypeValidationError`。

只有 `APICallError` 通过守卫后才读取 `statusCode`；可读取 `isRetryable` 做测试交叉验证，但公共 retryable 仍以第 5.2 节固定映射为准，避免 SDK 版本改变业务语义。所有守卫和允许字段读取都包在异常边界内，任何 getter / proxy 异常直接降级为 `unknown`。

adapter 明确禁止读取或传播以下字段：

- `url`、`requestBodyValues`；
- `responseHeaders`、`responseBody`、`data`；
- `message`、`stack`、`cause`；
- JSON 原文、校验失败值或模型生成正文。

### 6.2 内部安全信号

adapter 不再把 AI SDK raw error 带出边界，而是创建内部 Provider failure signal。该信号只携带枚举分类和当前 invocation 的 `AbortSignal` scope，不保留原始异常引用，也不设置原始异常为 `cause`；URL、请求/响应、headers、message、stack 与 cause 在 adapter catch 边界即被丢弃。

实现使用模块私有 `WeakMap<object, { category, scope }>` 创建和识别信号，而不是信任普通对象上的公开 `category` 字段。可信 provenance 同时要求创建 executor 时使用默认 dependency 对象 identity、信号属于当前 Runtime invocation 的 `AbortSignal` scope，并且只允许成功消费一次。wrong-scope 读取不会删除信号，same-scope 第一次读取后即删除；因此跨 invocation / executor replay 不能复用分类。

信号的 `name` 和 `message` 是固定常量；Runtime 只通过私有读取函数取得分类。该内部机制不从 `@repo/ai` 根导出，不成为业务调用方 API。任何 custom / injected dependency 即使抛出真实或伪造的 AI SDK error，也只能建立 `unknown` 信号；公开 SDK marker 只用于分类，不建立可信 provenance。

Provider 初始化阶段继续使用现有安全配置校验和固定初始化错误。本任务只诊断实际 `generateObject` 请求边界，不把配置或 composition root 失败伪装成一次 provider attempt。

## 7. Runtime 数据流与取消优先级

数据流如下：

```text
AI SDK error
  -> provider adapter 安全分类并丢弃原异常
  -> 内部不可伪造 failure signal
  -> ModelAgentRuntime 解析为 PROVIDER_ERROR + category
  -> ModelAgentError / ModelAgentTrace
  -> candidate strict sanitizer
  -> Phase 6.9.4.3 Live evidence entry
```

Runtime 的执行异常分类从单一 `ModelAgentErrorCode` 改为内部结构，例如：

```ts
type ExecutionFailure = {
  code: ModelAgentErrorCode;
  providerFailureCategory?: ModelAgentProviderFailureCategory;
};
```

取消优先级保持不变：

1. 外部 `AbortSignal` 已取消或执行中取消，结果必须为 `ABORTED`；
2. Runtime timeout 触发，结果必须为 `TIMEOUT`；
3. 只有未被上述取消覆盖的 executor 异常才能成为 `PROVIDER_ERROR`；
4. 未经共享 adapter 包装的普通 executor 异常，以及 custom / injected dependency 的失败，均成为 `PROVIDER_ERROR + unknown`。

因此 provider 在收到内部 abort 后抛出的网络异常不能覆盖 Runtime 已确定的 timeout / abort，也不能附带 Provider 分类。

预算语义不变：调用前仍预留完整 input/output budget；一旦越过 executor 边界后失败，仍返回已预留的 budget snapshot，usage 保持零且 paired eval 继续将该 attempt 视为 usage 不可验证。新增分类只解释失败类型，不伪造 token usage。

## 8. Candidate sanitizer

`packages/agent/src/model-candidates/model-candidate-runtime-result.ts` 继续是 Agent 层对共享 Runtime 结果的 strict trust boundary。它需要：

1. 从共享分类常量构建 strict Zod enum，不复制自由字符串；
2. 在 Error 和 Trace schema 中只接受可选固定分类；
3. 对 `PROVIDER_ERROR` 校验 Error / Trace 分类同时存在或同时缺失，并在存在时相等；
4. 对所有其他 error code 拒绝任何分类；
5. 成功结果拒绝任何分类；
6. rebuild 时只复制经过验证的枚举，不复制 message、额外属性或原对象引用；
7. 继续用固定错误文案替换 Runtime message；
8. 对 hostile getter、proxy、未知枚举、分类不一致和非法组合返回 `null`，触发现有 fail-closed candidate fallback。

“同时缺失”仅用于兼容旧 fixture、旧调用方和历史 A/B evidence；它不会新增 schema failure。共享 Runtime 新生成的 Provider 失败必须始终有分类。这样既不改变历史 artifact 的原 strict validator 判定，又不允许下一次受控 Live 悄悄退回无诊断状态。

## 9. Paired eval 与 evidence

### 9.1 Entry 合同

Phase 6.9.4.3 candidate observed entry 增加可选 `providerFailureCategory`。它仅在以下条件全部满足时合法：

- `lane === 'live'`；
- `entryStatus === 'observed'`；
- `providerAttempted === true`；
- `strictSuccess === false`；
- `runtimeErrorCode === 'PROVIDER_ERROR'`。

成功、Mock、deterministic、zero-call 和 `not_run` entry 均禁止该字段。runner 只能从已通过 sanitizer 的 Runtime Trace 复制枚举，不从异常 message、CLI stderr 或环境变量推断。

### 9.2 向后兼容

现有 Attempt A / B evidence 没有分类；字段保持 optional，且不修改或重写历史 JSON。兼容性的准确含义是“缺失字段不会新增 schema failure”，不是把旧 evidence 的其他缺陷转绿：

- Attempt A 仍因 filename identity mismatch 返回 exit `3 / profile_mismatch`，不能成为 canonical evidence；
- Attempt B 仍返回 exit `0 / ok=true / live / incomplete`，不是 complete Live 质量证据；
- 新 runner 遇到共享 Runtime `PROVIDER_ERROR` 时必须把分类写入 entry；
- 非法位置、未知值、Error / Trace 不一致和泄漏 canary 均被拒绝。

下一次受控 Live evidence 若再次发生 Provider 失败，验收文档只记录固定分类、attempt 数和既有安全计数，不记录状态码或原始响应。如果仍然只得到缺失分类，应视为诊断合同回归，禁止继续探测。

### 9.3 Enablement 不变

分类不改变 fail-closed 决策：任一 provider attempt usage 不可验证、运行不完整或质量门槛未通过，Router / Verifier 仍为 `enabled=false`。诊断能力不能绕过质量、安全、延迟和成本门槛。

## 10. 安全与隐私

以下内容禁止出现在 Error、Trace、candidate envelope、evidence、测试快照、日志和验收文档中：

- 完整 prompt、query、RAG chunk、模型正文；
- API key、Authorization、cookie、token、client secret；
- provider URL、请求体、响应体、Headers；
- 原始错误 message、stack、cause、SDK data；
- structured output 的原始 JSON 文本和 Zod 失败值。

安全验证使用高辨识度 canary 构造上述字段，序列化最终 Error / Trace / evidence 后逐项断言不存在。测试只检查固定枚举、固定安全 message 和既有计数。

低基数枚举本身允许进入共享 Runtime Trace 和 eval evidence，但本任务不授权将其持久化到生产数据库或暴露给 Web / Admin。后续若要展示，需要单独审查权限、保留周期和运维语义。

## 11. 测试设计

实施必须遵循 TDD，先写失败测试再实现。所有测试使用注入依赖或 SDK 错误对象，不访问网络、不读取真实 `.env` key。

### 11.1 `@repo/ai` Provider 测试

- HTTP 401 / 403 -> `http_auth`；
- HTTP 429 -> `http_rate_limit`；
- 其余 4xx -> `http_client`；
- 5xx -> `http_server`；
- 无状态码 `APICallError` -> `transport`；
- structured output 三类错误 -> `structured_output`；
- 空响应 / 无效响应 -> `invalid_response`；
- 普通 Error、非法状态码、hostile getter / proxy -> `unknown`；
- 每一类都验证固定 message、无 raw error reference、无 URL/body/header/cause 泄漏；
- 成功对象与 provider usage 映射保持不变。

### 11.2 Runtime 测试

- Provider 失败的 Error / Trace 分类存在且一致；
- 普通 executor 异常安全降级为 `unknown`；
- success、schema invalid、budget、config、timeout、abort 均无分类；
- timeout / abort 优先于 provider 在 abort 后抛出的错误；
- 失败后的 budget snapshot、zero usage 和调用次数保持现有语义；
- Runtime 结果整体序列化后不含 canary。

### 11.3 Agent sanitizer 测试

- 合法 Provider 分类被保留；
- 历史 Error / Trace 同时无分类仍被接受；
- Error / Trace 分类不一致、单边存在、未知枚举被拒绝；
- 非 `PROVIDER_ERROR`、成功结果和 hostile object 携带分类被拒绝；
- rebuild 只返回白名单字段和固定 failure message。

### 11.4 Paired eval / evidence 测试

- Live attempted Provider 失败复制分类；
- Mock、zero-call、not-run、success 不出现分类；
- 老 evidence fixture 仍通过 validator；
- 新 evidence 非法组合和泄漏 canary 被拒绝；
- 现有 `usage_unverifiable`、stop evidence、coverage 和 enablement 结果不变。

## 12. 验证命令

本次零网络实施验收实际运行：

```powershell
bun --cwd packages/ai test
bun --cwd packages/ai typecheck
bun --cwd packages/ai lint
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/agent lint
```

结果为 `@repo/ai` 125 passed / 0 failed、`@repo/agent` 333 passed / 0 failed，两个包的 typecheck 与 lint 均 exit 0。Attempt A strict validator 为 exit `3 / profile_mismatch`；Attempt B strict validator 为 exit `0 / ok=true / live / incomplete`。两份 artifact 的 Git blob hash 分别保持 `330a5cfcfda64a4c90b60e0e711ee6f2ce69b6c6` 与 `dd6cb8f2e543c4b89c009d9198b3d89f344ce594`。

以上验证全部使用 Mock、fake executor 或历史只读 evidence，没有新的真实模型调用，也没有启动或操作 Docker、PostgreSQL、Redis、MinIO。真正的下一次 controlled-Live paired eval 是独立验收任务。

## 13. 实施结果与提交证据

实现按四个语义任务进入 `main`：

- Task 1：`40fe48c` / merge `4581287`，建立 `@repo/ai` 唯一八类合同与私有 signal；
- Task 2：`49a4a6e` / merge `578539e`，接通 Provider / Runtime，并封闭跨 invocation / executor replay；
- Task 3：`d4658d2` / merge `c55f8f2`，完成 candidate strict 双边 sanitizer 与历史双缺失兼容；
- Task 4：`dc10b01` / merge `c920673`，把分类限制在 attempted Live `PROVIDER_ERROR` failure evidence，counter mismatch、pre-provider、success、Mock 与 not-run 均剥离。

共享诊断分类已接通 Error、Trace、sanitizer 和 paired evidence，但没有接入生产 Agent Trace API / UI。Router / Verifier candidate 仍未接入生产 Chat，生产继续 deterministic。

## 14. 完成标准

共享诊断增强的 Mock/fake executor 实施结果满足：

1. 八类固定分类在共享 `@repo/ai` 合同中只有一个权威定义；
2. Provider adapter 不读取或保留原始敏感字段；
3. Runtime Error / Trace 分类一致，取消、预算和 usage 语义无回归；
4. candidate sanitizer 对合法分类白名单重建，对非法组合 fail-closed；
5. paired eval 只在 attempted Live `PROVIDER_ERROR` failure 的合法最终边界保留固定分类；
6. 历史 Attempt A / B evidence 未修改，缺失分类字段不会改变各自原 strict validator 结论；
7. `@repo/ai` 与 `@repo/agent` 相关 test、typecheck、lint 全部通过；
8. Task 1–4 代码已经审查、合并并推送至 `main`；
9. 本诊断实施与文档验收没有新增真实模型调用；
10. Router / Verifier 仍保持 disabled，直到后续完整 controlled-Live paired eval 的全部 enablement 门槛通过。

这只表示诊断合同及其零网络工程验收完成，不表示 Phase 6.9.4.3 或 controlled-Live 质量验收完成。

## 15. 后续任务

1. 从最新已推送 `main` 单独发起新的 controlled-Live paired eval，先核对 diagnostics 合同与 Live 双开关；
2. 若 attempted Provider 失败，只记录 `providerFailureCategory`，不记录 raw status、URL、request/response、headers、message、stack、cause、prompt、output 或 credentials；
3. 根据固定分类决定是处理鉴权/配置、限流、structured-output 兼容性，还是等待 provider 恢复，不盲目重试；
4. 只有 28 次 strict success 与质量、安全、延迟、成本门槛全部通过，Phase 6.9.4.3 才能完成并讨论 enablement；
5. Live 合同稳定后，再单独评估是否把分类接入生产 Trace API / UI；
6. Phase 6.9 及整个真实模型/记忆阶段完成后，再编写《多 Agent 架构—记忆系统》面试学习博客。
