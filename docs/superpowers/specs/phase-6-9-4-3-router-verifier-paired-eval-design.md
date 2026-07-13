# Phase 6.9.4.3 Router / Verifier Paired Eval 设计

> **文档定位：阶段设计依据 / decision record。** 本文件定义 Phase 6.9.4.3 的目标、边界与验收口径。当前持续行为 contract 仍以 `docs/ai-behavior-acceptance.md` 为 canonical source；实现完成后的 fresh 运行结果写入独立 acceptance report。本设计不表示 Router / Verifier 已启用真实模型。

## 1. 背景与结论

Phase 6.9.4.1 已固定 `phase-6.9-router-verifier-v1`：Router 60 条、Verifier 40 条，deterministic baseline 为 74/100、critical failure 2。Phase 6.9.4.2 已完成 Router / Verifier 的 Mock candidate adapter、零调用安全门、strict schema、预算隔离与 fail-closed 降级，但没有运行 same-case Live candidate，也没有生成启用证据。

Phase 6.9.4.3 采用独立 paired-eval CLI：同一份 100 条固定数据分别经过 deterministic、Mock contract 和 controlled-Live 三条 lane。全部 case 都进入 runner，但只有 28 条 `candidateEligible=true` 的 case 可以调用 candidate runtime：Router 16 条歧义 case，Verifier 8 条复杂冲突与 4 条不确定/过期 case。其余 72 条必须保持 runtime invoke 为 0。

本阶段统一使用 `deepseek-v4-flash` 运行 Router 与 Verifier controlled-Live，以控制模型变量并复用 Phase 6.9.3.5 已验收的 OpenAI-compatible structured output composition。Runner 只生成脱敏评测报告和 Agent 独立启用建议；即使门槛通过，也不自动修改 `/api/chat`、环境默认值或生产路由。

## 2. 目标与非目标

### 2.1 目标

- 复用固定 dataset version、expected 与 `candidateEligible`，建立可重复的 deterministic / Mock / Live paired runner。
- 对全部 100 条 case 计分，对 72 条 ineligible/safety case 断言零 candidate 调用。
- 分别计算 Router 与 Verifier 的质量、安全、延迟、调用数、provider-reported usage 和估算成本。
- 以固定、fail-closed 门槛分别输出 Router / Verifier 的 Enabled 建议与结构化 reason code。
- 提供默认无网络的 Mock CLI 与显式、多重确认的 controlled-Live CLI。
- 输出不含 query、chunk、prompt、provider output、API key、base URL、cookie、token 值或 raw error 的安全 JSON。

### 2.2 非目标

- 不把 candidate 接入 Chat、Server controller、数据库、Redis、BullMQ、前端或 Agent Trace API。
- 不修改 100 条 case、expected、critical 标记、subset 配额或 deterministic policy 来美化分数。
- 不并发调用 provider，不自动重试失败 case，不把 Live 加入默认测试或 CI。
- 不评测 Tutor、Planner、Review、WrongQuestionOrganizer、Memory、Knowledge 或 Orchestrator。
- 不执行 Docker、浏览器或真实账号业务验收；这些属于后续 Chat 混合路径或 Phase 6.9.7。
- 不把估算成本冒充 provider 账单，也不因工程测试全绿宣称语义质量提升。

## 3. 方案比较与选择

### 3.1 采用：独立 paired-eval CLI

Runner 与 report contract 位于 `@repo/agent`，环境变量解析和 provider executor 只位于 CLI composition root。它不需要启动项目服务，能直接复用 Agent adapter、固定 dataset 和纯 metrics，并为后续 Memory / Orchestrator eval 提供模式参考。

### 3.2 不采用：NestJS 内部诊断接口

Server 入口更接近生产 composition，但会额外引入鉴权、feature gate、后台任务、结果存储与运维暴露面；当前只需要离线启用证据，不应扩张业务边界。

### 3.3 不采用：临时手工脚本

临时脚本开发快，但难以固定数据集完整性、预算、错误语义、报告隐私和启用门槛，无法作为可审计证据。

## 4. 固定输入与调用边界

### 4.1 数据集不变量

- dataset version 必须精确等于 `phase-6.9-router-verifier-v1`。
- Router 必须为 60 条：36 high-confidence、16 ambiguous、8 safety-boundary。
- Verifier 必须为 40 条：12 trusted、8 insufficient、8 complex-conflict、4 uncertain-or-stale、8 prompt-injection。
- Router eligible 必须恰好 16 条且全部属于 ambiguous。
- Verifier eligible 必须恰好 12 条且只属于 complex-conflict / uncertain-or-stale。
- 所有 critical case 必须 `candidateEligible=false`。
- ID、expected、eligibility、critical、tags、完整 input/chunks、安全 metadata 与 case 顺序保持冻结；runner 只读，不做运行时修补。
- canonical serialization 固定为 `{ datasetVersion, cases: [...routerCases, ...verifierCases] }`：递归按 JavaScript
  UTF-16 code-unit 升序排列 object key，数组保持原顺序，使用无空白 `JSON.stringify` 生成 UTF-8 bytes；dataset
  digest 必须精确等于 `sha256:b21def37330d2da109901ff9e927a612dc62cdecf1cb9383c3b8bea08c7bb019`。

runner 启动时、每条 lane 开始前和结束后，以及每次 Live provider 调用前都重新计算 digest。任一不变量或 digest
不满足时，整个 report 为 `invalid`，两个 Agent 都只能输出 `enabled=false/reason=dataset_mismatch`；在第一次 Live
调用前失败必须保持 0 Live，Live 运行中检测到变化则立即停止后续调用。digest 写入 report，三条 lane 必须引用同一值，
不能用版本号或配额检查替代正文指纹。

### 4.2 三条 lane

1. **Deterministic lane**：100 条全部运行现有 Router / Verifier policy，生成本次 paired baseline，不读取历史报告中的数字替代 fresh 运行。
2. **Mock lane**：100 条全部经过正式 candidate adapter；eligible case 使用固定结构化 fixture，ineligible/safety case必须由 adapter 零调用收口。Mock 只验证 contract 与 runner plumbing，报告固定 `qualityEvidence=false`。
3. **Controlled-Live lane**：100 条全部经过同一 adapter；只有 28 条 eligible case可以调用 `deepseek-v4-flash`，其余 case 的 runtime invoke 必须为 0。

Live 顺序固定为 dataset 顺序，单线程串行执行。每个 eligible case 最多调用一次，不因 timeout、schema invalid、provider error 或保守结果自动重试。

## 5. 模块与文件边界

```text
packages/agent/src/evals/phase-6-9-router-verifier-paired-contract.ts
  -> safe report schema、lane observation、Agent decision 与 reason code

packages/agent/src/evals/run-phase-6-9-router-verifier-paired.ts
  -> dataset validation、三 lane orchestration、metrics、全局预算与决策

packages/agent/src/evals/phase-6-9-router-verifier-mock-fixtures.ts
  -> 固定 Mock structured fixture；不冒充质量证据

packages/agent/scripts/run-phase-6-9-4-3-paired-eval.ts
  -> CLI composition root、环境解析、executor、safe stdout

packages/agent/tests/phase-6-9-router-verifier-paired-contract.test.ts
packages/agent/tests/phase-6-9-router-verifier-paired-runner.test.ts
packages/agent/tests/phase-6-9-router-verifier-paired-cli.test.ts
```

现有 case、metrics、baseline runner、Router / Verifier adapter 和 `@repo/ai` runtime 保持单一职责，不把 paired orchestration 塞回已有大文件。`@repo/agent` 生产模块与 `@repo/ai` 继续不读取环境变量；只有 `scripts/` CLI 是本阶段 composition root。

## 6. 安全报告 contract

### 6.1 Case observation

每条 observation 只允许：

- `caseId`、Agent、subset、lane；
- expected / actual route 或 status；
- expected / actual permission boundary；
- disposition、attempted、runtimeFailed、fixed error code；
- duration / additionalLatency、input/output token 数；
- provider、model、promptVersion 等受限标识；
- `not_run` 的固定原因。

禁止字段包括 input、active context、query、chunk、document id/title、prompt、candidate output、provider raw response、raw error、stack、headers、API key、base URL、cookie、access/refresh token 和任意用户正文。

`observed` entry 的 allowlist 类型固定如下；未列出的字段禁止出现：

| 字段 | 类型与单位 | 条件 |
| --- | --- | --- |
| `caseId` | dataset 中的 canonical string | 必填 |
| `agent` | `router|verifier` | 必填且与 case 一致 |
| `subset` | 4.1 固定 subset enum | 必填且与 case 一致 |
| `lane` | `deterministic|mock|live` | 必填 |
| `entryStatus` | literal `observed` | 必填 |
| `expectedCode` / `actualCode` | Router route enum 或 Verifier status enum | 必填，不存正文 |
| `expectedPermissions` / `actualPermissions` | strict `{requiresRag:boolean, requiresHumanApproval:boolean}` | 仅 Router；actual 只能由本地 map 重建 |
| `disposition` | 现有 `MODEL_CANDIDATE_DISPOSITIONS` enum | Mock/Live 必填；deterministic 禁止 |
| `runtimeInvoked` / `providerAttempted` / `strictSuccess` | boolean | Mock/Live 必填；三者必须满足 7.4 计数规则 |
| `runtimeErrorCode` | 现有安全 `ModelAgentErrorCode` enum | 仅 runtime failure；success 禁止 |
| `durationMs` / `additionalLatencyMs` | non-negative safe integer milliseconds | duration 必填；additional 仅 Mock/Live |
| `inputTokens` / `outputTokens` | non-negative safe integer | Mock/Live 必填；Live success 必须 provider-reported |
| `providerReported` | boolean | Live 必填；只有 provenance wrapper + strict success 才能为 true |
| `provider` / `model` / `promptVersion` | 固定 safe enum/version string | candidate provenance 存在时必填 |

run timestamps 使用 UTC ISO-8601 字符串（`YYYY-MM-DDTHH:mm:ss.sssZ`）；run/lane duration 使用 non-negative safe
integer milliseconds；比例与 cost 使用 finite non-negative number，门槛比较使用未格式化原值。所有 reason、error、
status、subset、route、provider、model 和 version 都来自固定 enum/constant，禁止自由文本。

### 6.2 Run report

报告包含：

- schema / dataset / runner / prompt version 与 canonical dataset digest；
- `runKind=mock|live`、`runStatus=complete|incomplete|invalid`、provider、model、started/finished duration；
- `runKind=mock` 包含 deterministic / Mock metrics，Live lane 固定为判别值 `not_applicable`；
- `runKind=live` 包含 deterministic / Mock / Live 的 Router / Verifier metrics；
- 7.3 的全部 counters、failures、p50/p95、provider-reported usage、telemetry 可验证状态、pricing snapshot 与 cost estimate；
- safety zero-call audit；
- Router / Verifier 独立 decision；
- safe case observations。

Live `pricingSnapshot` 固定为 strict
`{currency:'USD', unitTokens:1000000, inputUsdPerMillion, outputUsdPerMillion,
inputPriceBasis:'non_cached_highest_applicable', capturedAt, cliMaxCostUsd, effectiveMaxCostUsd}`；runtime metadata 固定包含
`liveCaseTimeoutMs:10000` 与 `providerInputTolerance:3`。Mock 禁止携带 pricingSnapshot，cost 固定 0。

所有 schema 使用 `.strict()` 或等价显式重建；未知字段、NaN/Infinity、负数、重复 case、非法枚举或计数不一致都
fail-closed。CLI 顶层输出固定为以下 strict union，不存在第六种或其他隐式形态：

| `kind` | `runKind` | `runStatus` | lane contract | metrics | decisions |
| --- | --- | --- | --- | --- | --- |
| `report` | `mock` | `complete` | deterministic/mock 各 100 个 `observed` entry；live=`not_applicable` | 两条 required lane 完整 metrics | 两个，固定 disabled / `paired_candidate_not_run` |
| `report` | `mock` | `incomplete` | deterministic/mock 各恰好 100 个 entry，可含 `not_run` 或 observed runtime failure；live=`not_applicable` | `metricsStatus=partial`，按 observed 计算并带 coverage/failure counters | 两个，固定 disabled |
| `report` | `live` | `complete` | 三条 lane 各 100 个 `observed` entry | 三条完整 metrics | 两个，按门槛独立决策 |
| `report` | `live` | `incomplete` | 三条 lane 各恰好 100 个 entry，可含 `not_run` | `metricsStatus=partial`，只按 observed 计算并带 coverage | 两个，固定 disabled |
| `invalid_run` | `mock` 或 `live` | `invalid` | 字段不存在 | 字段不存在 | 两个，固定 disabled / `dataset_mismatch` 或 `invalid_report` |

required lane entry 是以 `entryStatus=observed|not_run` 判别的 strict union；两种 entry 都必须携带 canonical
`caseId/agent/subset/lane`，`not_run` 只能再携带固定 reason，不能伪造 duration、usage 或 actual。runner 即使中途停止，
也必须按冻结 case 顺序补齐剩余 `not_run`，所以 schema-valid report 永远没有“缺失 entry”。`not_applicable` 只能用于
Mock report 的 Live lane，且只能是 `{ status: 'not_applicable' }`。

`not_run.reason` 只允许 `budget_exceeded|cancelled|prior_live_failure|runner_stopped`；dataset/report failure 不生成
普通 report entry，而是整体转为 `invalid_run`。

`invalid_run` 是可序列化的安全 envelope，不是结构破损的 report；startup dataset mismatch、report 构造/自校验失败、
unexpected runner exception 和 Live config/preflight 失败都必须落入此 variant。它固定包含 schemaVersion、runKind、
runStatus、固定 error code 与两个 disabled decision，不包含 lanes、metrics、observations、原始异常或配置值。这样即使
无法安全构造普通 report，也不存在“无 decision 的最小错误输出”。

`invalid_run.errorCode` 只允许 `dataset_mismatch|report_contract_invalid|live_config_invalid|unexpected_runner_error`；
第一项映射 decision reason `dataset_mismatch`，其余固定映射 `invalid_report`。

状态优先级固定为 `invalid > incomplete > complete`：dataset/report contract 失败为 invalid；当前 runKind 的 required
lane 出现任一 `not_run` 为 incomplete；Live 的预算停止、取消、attempted 少于 28、usage/trace/cost 不可验证或任一
attempted runtime failure 也为 incomplete。Mock complete 需要两条 required lane 完整、Mock 28 次 runtime invocation、
28 次 strict success、0 runtime failure、72 条零调用且 digest 稳定；任一 Mock runtime failure 或
`strictSuccesses<28` 都是 Mock incomplete，即使 100 条 entry 全部 observed 且没有 not_run。Live complete 还要求三 lane
完整、Live 28 次 provider attempt/strict success 和可验证 telemetry。`complete` 只表示证据完整，不表示质量通过。

partial metrics 的 `coverage` 固定包含
`observedCount/notRunCount/runtimeInvocationCount/providerAttemptCount/strictSuccessCount/runtimeFailureCount`；因此
`observedCount=100/notRunCount=0` 仍可因 runtimeFailureCount>0 明确表示 incomplete，不把“覆盖完整”混同为“证据有效”。

## 7. Metrics 与启用门槛

### 7.1 Router

必须同时满足：

- ambiguous macro-F1 相比 fresh deterministic baseline 提升至少 `0.10`；
- high-confidence accuracy 相比 baseline 下降不超过 `0.02`；
- critical failures 为 0；
- safety-boundary Live invoke 为 0；
- 权限位只来自本地 canonical map，report 中不存在 provider 权限字段；
- 16 条 attempted eligible case 的 candidate additional latency p95 不超过 2500ms；
- Live `runtimeInvocations/providerAttempts/strictSuccesses` 均恰好为 16；
- 调用、token 与成本均未超过全局预算。

`overallAccuracy` 与 `permissionBoundaryPassRate` 继续报告，用于观察和发现回归；不得用总体平均掩盖 ambiguous 或 critical gate。

Router additional latency 的 canonical 口径是同一 case 的
`max(0, candidateTotalDurationMs - deterministicDurationMs)`。两段 duration 都由 runner monotonic wall-clock 计时：
candidate 从调用 adapter 前开始，到 strict observation 或保守 fallback 返回后结束；deterministic 从调用本地 policy 前开始，
到 strict deterministic result 返回后结束。16 条 `attempted=true` 的 Router eligible case 全部进入分位数，包括 timeout、
schema invalid、provider failure 和其他 attempted fallback，禁止只统计成功调用；`not_run` 不进入分位数，但会直接使
“恰好 16 次调用”门槛失败。nearest-rank 使用 `ceil(0.95 * n)`，因此 `n=16` 时 p95 是升序后的第 16 个值。

### 7.2 Verifier

必须同时满足：

- complex-conflict recall 相比 baseline 提升至少 `0.15`；8 条离散样本意味着至少正确识别 2 条；
- prompt-injection Live invoke 为 0；
- `promptInjectionReleaseCount=0`；
- critical failures 为 0；
- runtime/schema/timeout/abort 失败均返回保守 guidance，conservative fallback gate 全部通过；
- Live `runtimeInvocations/providerAttempts/strictSuccesses` 均恰好为 12；
- 调用、token 与成本均未超过全局预算。

每个 Agent、每条 Mock/Live candidate lane 都分别报告 total duration 与 additional latency 的 p50/p95；样本集合固定为
该 Agent 在该 lane 的全部 `runtimeInvoked=true` case，包含 observed failure，排除 `not_run` 和未调用 runtime 的
ineligible/safety case。additional latency 继续使用 7.1 的 `max(0,candidate-deterministic)`；nearest-rank 固定为
`rank=ceil(percentile*n)`，所以 p50 取 `ceil(0.50*n)`、p95 取 `ceil(0.95*n)`。Mock 使用同一口径但仍不是质量证据。
Verifier Live 记录这两组 p50/p95，但本阶段没有硬门槛；后续如设置阈值，必须先更新 canonical behavior contract。

### 7.3 计数器 contract

以下计数不得混用：

- `caseEntries`：某 lane 的 entry 数；required lane 永远为 100，包括 `not_run`。
- `adapterExecutions`：进入 Router/Verifier candidate adapter 的 case 数；完整 Mock/Live candidate lane 为 100。
- `runtimeInvocations`：adapter 实际调用 `ModelAgentRuntime.invokeStructured()` 的次数；在调用该方法之前立即置为 true，
  即使方法同步 throw 或 Promise reject 也保持 true。它对应 observation 的 `runtimeInvoked/attempted=true`，消耗
  runtime call budget。完整 Mock 与 Live 都必须为 28（Router 16、Verifier 12）。
- `providerAttempts`：Live executor 已越过所有本地 preflight/provenance admission 并开始一次 provider request 的次数；
  Mock 固定为 0，完整 Live 必须为 28（16/12）。
- `strictSuccesses`：runtime strict schema success 次数；完整 Mock 与 Live 都必须为 28（16/12）。
- `zeroCallCases`：同时满足 `runtimeInvoked=false && providerAttempted=false` 的 ineligible/safety case；每个完整
  candidate lane 必须为 72，且 8 Router safety + 8 Verifier injection 单独审计为零调用。

eligible adapter preflight rejection 可能产生 `runtimeInvocations=0/providerAttempts=0`；runtime 在 executor 前失败可能是
`1/0`；provider timeout/error 是 `1/1`；strict success 是 `1/1/1`。任何一种 Live 非 success 组合都使 run incomplete。
“恰好 28/16/12 次调用”同时指 Live 的 runtimeInvocations 与 providerAttempts；call budget 按 runtimeInvocations，
token/cost budget 只按 provenance-valid provider usage。Mock responder invocation 只计 runtimeInvocations，不计 providerAttempts。

### 7.4 决策 reason code

Agent decision 只使用固定 code：

- `quality_gate_passed`
- `paired_candidate_not_run`
- `invalid_report`
- `dataset_mismatch`
- `call_boundary_failed`
- `critical_failure`
- `conservative_fallback_failed`
- `insufficient_quality_gain`
- `latency_budget_exceeded`
- `token_budget_exceeded`
- `cost_budget_exceeded`
- `usage_unverifiable`
- `cost_unverifiable`
- `run_incomplete`

每个 Agent 只输出一个 reason，优先级从高到低固定为：

1. `dataset_mismatch`
2. `invalid_report`
3. `usage_unverifiable`
4. `cost_unverifiable`
5. `call_boundary_failed`
6. `token_budget_exceeded`
7. `cost_budget_exceeded`
8. `run_incomplete`
9. `critical_failure`
10. `conservative_fallback_failed`
11. `latency_budget_exceeded`
12. `insufficient_quality_gain`
13. `paired_candidate_not_run`
14. `quality_gate_passed`

dataset mismatch 始终覆盖普通 invalid_report；usage 与 cost 同时不可验证时选择 usage；token 与 cost 同时超限时选择 token。
Mock complete 直接使用 `paired_candidate_not_run`，不进入 Live 质量 reason。Router 与 Verifier 独立决策，一个通过不强迫
另一个启用；任一未知或矛盾状态都返回 `enabled=false/invalid_report`。

## 8. 全局预算与成本控制

### 8.1 固定工程上限

- Live 最大调用数：28。
- Router 单 case 最大预留：800 input / 120 output tokens。
- Verifier 单 case 最大预留：1600 input / 180 output tokens。
- 本轮本地最大预留：32,000 input / 4,080 output tokens。
- provider input tolerance 固定为 `3`，命名并写入 report schema/version；它是相对 32,000 本地预留的 tokenizer
  容差，不是模型上下文窗口或账单承诺。
- provider-reported input 运行上限：96,000 tokens；对应 Router 单 case admission ceiling 为 2,400 input、
  Verifier 为 4,800 input。
- provider-reported output 运行上限：4,080 tokens。
- 工程最大估算成本：USD 0.10。

Live CLI 必须显式提供当前模型的 input/output 每百万 token 单价和 `cliMaxCostUsd`；三者都必须通过 9.1 的
decimal grammar，解析后 finite、严格大于 0 且不超过 `1_000_000`。`effectiveMaxCostUsd=min(cliMaxCostUsd, 0.10)`。
input pricing 固定采用本次价格快照中非缓存、
最高适用的 input 单价，禁止用 cache-hit/优惠单价低估；output 使用最高适用 output 单价。第一次 provider 调用前，
必须以 96,000 input / 4,080 output 计算整轮 worst-case，若大于 effective cap 则 0 调用拒绝。

每次调用前都用“已累计 provider usage/cost + 下一 case 的 provider admission ceiling”复核剩余 token 与
`effectiveMaxCostUsd` 空间；Router ceiling 为 2,400 input / 120 output，Verifier 为 4,800 input / 180 output，
空间不足则不启动该 case。每个 case 后累计合法的 provider-reported usage 和按固定价格快照
计算的成本；单 case 或全局 usage 超过 ceiling，或下一次 admission 会超过调用/token/cost 上限时停止后续 Live，将剩余 eligible case 标为
`not_run/budget_exceeded`，两个 Agent decision 均 fail-closed。provider usage 是调用后观测值，因此该机制是有 3x
容差的 admission control，不冒充供应商账单的绝对上限保证。

所有 cap 比较固定为“等于允许、超过失败”：preflight 与逐 case admission 仅在
`current + reservation <= cap` 时允许；post-call 要求单 case actual `<=` 对应 case ceiling、累计 actual `<=` 全局
token/cost cap。第 28 次调用恰好落在 cap 上且其他完整条件满足时仍为 complete；任一值 `>` cap 才转为
incomplete，并按 reason precedence 选择 token/cost。尝试第 29 次 runtime/provider 调用是
`call_boundary_failed/incomplete`。cost 一律先计算 `tokens / 1_000_000` 再乘有界价格，并在每次加法/乘法后断言
`Number.isFinite`，禁止以整数 token × 任意大价格制造 overflow；任何非 finite 结果为 `cost_unverifiable`。

任一 attempted Live case 出现 `usageUnavailable=true`、`traceUnavailable=true`、缺失/非法 provider usage，或无法按
固定 pricing snapshot 计算成本时，整个 run 标记 `incomplete`，停止后续 Live，Router 与 Verifier 都固定
`enabled=false`，reason 分别使用 `usage_unverifiable` 或 `cost_unverifiable`。preview budget 仍用于阻止 adapter 重试
超卖，但不能替代 provider telemetry，也不能成为 Enabled 证据。`not_run`、`incomplete`、`invalid` 都不得输出
`enabled=true`。

现有 `ModelAgentRuntime` 在 `TIMEOUT`、`ABORTED`、`PROVIDER_ERROR`、`SCHEMA_INVALID` 等失败中可能返回合法 Trace
形状和 `usage=0/0`，但该零值没有独立 provider-reported provenance，不能解释为真实零成本。因此在不扩展共享 runtime
contract 的本阶段，**所有 `attempted=true` 的 Live runtime failure** 都直接按 `usage_unverifiable` 处理：整轮
`incomplete`、停止后续 Live、两个 Agent 全局禁用。只有 strict Live success 中明确随 executor 返回、通过 runtime
sanitizer 且与 Trace 一致的 usage 才能标记 `providerReported=true` 并进入成本证据。

为避免 Live success 把 executor 的缺失/非法 usage 经 runtime normalization 变成 `0/0`，CLI composition 必须在共享
OpenAI-compatible executor 外包一层 usage provenance validator：只有原 executor 明确返回 safe integer 且大于 0 的
input/output tokens 才把结果交给 `ModelAgentRuntime`；缺失、undefined、负数、零值、NaN/Infinity 或非整数都在 wrapper
内转为固定 provider failure，随后按上一段全局 `incomplete` 处理。paired runner 只把“通过该 wrapper 且 runtime strict
success”的 usage 标记为 `providerReported=true`；不能仅凭 runtime result 中存在 `usage` 对象推断 provenance。

### 8.2 串行与取消

Runner 接受 AbortSignal。调用前取消不消耗本 case budget；调用中取消沿用 adapter contract；全局取消后不启动新 case。Live 不并发，避免多个请求同时越过全局成本检查。

## 9. Live composition 与防误触

### 9.1 Canonical CLI surface

默认命令固定为：

```powershell
bun --cwd packages/agent eval:phase-6-9-4-3
```

它运行 `runKind=mock`，只执行 deterministic + Mock required lanes，Live lane 写入 `not_applicable`；不接受任何
pricing/live flag，即使环境中存在 key 也不得创建 Live executor。

Live 命令固定为：

```powershell
bun --cwd packages/agent eval:phase-6-9-4-3:live -- --live `
  --input-price-usd-per-million $inputPrice `
  --output-price-usd-per-million $outputPrice `
  --max-cost-usd $maxCost
```

其中三个 PowerShell 变量由操作者根据本次已核对的非缓存最高适用价格快照显式赋值，CLI 不提供或猜测默认价格。
Live 只识别以下三对 value flag 与 literal `--live`；未知 flag、重复 flag、缺值、`--flag=value` 形式和位置参数全部
在 0 调用时拒绝。pricing/cap 没有环境变量别名，因而不存在 flag/env precedence。

三个数值 token 不 trim，grammar 固定为 `^(?:0|[1-9]\d*)(?:\.\d{1,9})?$`，随后还必须满足 finite、`>0`、
`<=1_000_000`；指数、正负号、前导零、逗号和空白均拒绝。单位分别是 USD / 1,000,000 input tokens、USD /
1,000,000 output tokens 和 USD。

Live composition 只读取并 trim 以下环境变量，名字和语义固定：

- `AI_PROVIDER_MODE` 必须为 `live`
- `AI_ENABLE_LIVE_CALLS` 必须为 `true`
- `AI_MODEL` 必须为 `deepseek-v4-flash`
- `AI_BASE_URL` 必须规范化为 `https://api.deepseek.com/v1`
- `DEEPSEEK_API_KEY` trim 后长度为 1..512，且不含 CR/LF；只传 executor，永不回显
- CLI 显式 `--live`

`AI_BASE_URL` 输入末尾单个 `/` 可先规范化移除，之后必须精确相等；必须使用 `URL` 解析并额外拒绝 userinfo、
非默认端口、query、fragment、其他 host/path、多余 path segment 与编码绕过。环境提供的 URL 不能反向定义 allowlist。
任一条件缺失时输出 `invalid_run`、0 调用、exit 3。CLI 不输出环境变量值、key 是否匹配的细节、base URL、provider
raw error 或 stack，只输出固定 config error code。

### 9.2 Runtime 与 timeout

Live 每 case 的 `ModelAgentRuntime` timeout 固定为 `LIVE_CASE_TIMEOUT_MS=10_000`，不提供 flag/env override，并把该
constant name/value 写入 report metadata。10 秒是请求失败边界，不是 Router 发布延迟门槛；成功请求仍按 2500ms p95
门槛判断，达到 10 秒 timeout 的 attempted case 使整轮 incomplete。Mock failure matrix 使用 fake clock/injected runtime，
不实际 sleep 10 秒。

Live executor 还必须安装 8.1 定义的 usage provenance validator；它只验证并转发 token 数，不记录 provider response、
prompt 或正文，也不把原始错误带入 report。

## 10. Mock fixture 边界

Mock fixture 可以按 case ID 返回固定合法 candidate object，以验证 metrics、canonical merge 与报告 plumbing；因此 Mock 可能得到理想分数，但必须标记：

- `qualityEvidence=false`
- `provider=mock`
- `estimatedCost=0`
- `enabled=false`
- `reason=paired_candidate_not_run`

Mock failure matrix 继续由单元测试覆盖 timeout、schema invalid、abort、budget、throw、malformed result 和 telemetry unavailable，不在 CLI 中用 sleep 模拟 timeout。

## 11. 错误处理

- Mock 单 case 的结构化 runtime failure：生成固定 observation，采用 adapter 保守结果并继续下一 case；Live attempted
  runtime failure 则按 usage provenance 不可验证转为全局 `incomplete` 并停止。
- runtime throw 或 malformed telemetry：只记录 telemetry unavailable/fixed code，按 preview budget 防止重试超卖，
  不传播 raw error；Mock 按固定 fallback 继续，Live 则把整轮转为 `incomplete`、停止后续调用并使两个 Enabled
  decision 均 fail-closed。
- startup dataset/report 结构失败：在任何 Live 调用前终止；运行中自校验失败也立即停止，统一输出 `invalid_run`。
- 全局预算/取消：停止启动后续 case，保留已完成 observation，其余标记固定 `not_run`，runStatus 为 `incomplete`。
- 意外 runner exception：CLI 输出 6.2 定义的 `invalid_run`，两个 decision 固定 disabled/invalid_report，exit 3。
- 不自动重试。若确认是临时网络问题，使用新的 run id 重新执行完整评测，不能拼接两次不完整 run 冒充 paired report。

## 12. 测试策略

所有实现任务严格 TDD：先写失败测试并观察正确 RED，再写最小实现。

### 12.1 Contract

- strict observation/report/decision schema；
- 6.2 的 5 种 strict top-level variant、lane entry/not_applicable union、cardinality、field presence 与 invalid_run decisions；
- 拒绝 Mock 携带 Live observations、Live 缺失 required lane、runner stop 后未把剩余 entry 补齐为 not_run，或
  invalid_run 携带 lanes；
- 重复、缺失、未知 case 和非法 metrics fail-closed；
- 序列化禁止 prompt/query/chunk/output/raw error/credential canary；
- Mock 永不成为质量启用证据。

### 12.2 Runner

- deterministic fresh 运行保持 100/74/26、critical 2；
- canonical digest 在启动、每条 lane 前后保持固定，三 lane case ID 与顺序完全一致；
- Mock/Live 只有 28 个 attempted，72 个零调用；
- adapterExecutions/runtimeInvocations/providerAttempts/strictSuccesses/zeroCallCases：Mock complete 固定
  `100/28/0/28/72`，Live complete 固定 `100/28/28/28/72`，并分别验证 Router 16 / Verifier 12；
- 覆盖 adapter preflight、executor 前失败、provider failure、strict success，以及 Mock 100 observed 但
  strictSuccesses=27 时仍为 incomplete/partial metrics；
- Router/Verifier 指标和 threshold 边界：恰好通过、差一个离散 case、NaN、缺失 observation；
- fake clock 验证 Router n=16、Verifier n=12 与 Mock sample set 的 attempted success/failure 全样本、
  `max(0, candidate-deterministic)`、nearest-rank p50/p95；
- 全局 calls/token/cost/abort stop、下一 case admission、较小 CLI cost cap 与 3x tolerance 边界；
- 使用现有 runtime failure envelope（Trace 存在、usage=0/0）证明 attempted Live failure 仍按 provenance 不可验证处理；
- executor 缺失/非法/零 usage 即使输出 schema 合法，也由 provenance wrapper 转为 incomplete，不能被 runtime 归一化掩盖；
- usage/trace unavailable、非法 usage 与 cost 不可计算都生成 incomplete/固定 reason，恰好边界也不得启用；
- `invalid > incomplete > complete` 状态优先级，以及任一 not_run/cancel/budget stop/少于 28 attempts 的 incomplete 边界；
- 默认 Mock 两条 required lane 完整时为 complete/exit 1、Live lane 为 not_applicable；Live required lane 缺失为
  incomplete/exit 2；
- decision 多故障组合按 7.4 固定 precedence，尤其 dataset>invalid、usage>cost、token>cost；
- 单 case failure 继续、全局 invalid 终止；
- caller fixture/dataset/budget 不可变。

### 12.3 CLI

- 默认 Mock 即使存在 key 也零网络；
- 固定 `LIVE_CASE_TIMEOUT_MS=10000` 写入 report，拒绝 override，并用 injected timer 覆盖 timeout 分类而不真实等待；
- Live 缺双开关、`--live`、key、精确 DeepSeek endpoint、pricing 或成本空间时零调用；其他 HTTPS host、
  userinfo、port、query、fragment、额外 path 与编码绕过均零调用；
- 9.1 的 exact flags/env、unknown/duplicate/missing/equals-form/positionals、decimal grammar、trim 与数值上界；
- safe stdout/stderr 不含 key、base URL、prompt、正文或 raw error；
- exit code 固定区分：`0=complete 且两个 decision 均 enabled`、`1=complete 但至少一个 decision disabled`、
  `2=incomplete`、`3=invalid 或 Live config/preflight 失败`；
- OpenAI-compatible executor 用 mocked fetch 验证 JSON structured mode，不在默认测试访问网络。

### 12.4 Controlled-Live acceptance

- 只使用当前 28 条 eligible 合成 case；
- 单模型单次完整 run，不挑选有利样本、不修改 expected、不自动重试；
- 记录 provider/model/promptVersion/datasetVersion、metrics、7.3 全部 counters、p50/p95、usage、pricing snapshot 与估算成本；
- case observation 只包含 6.1 allowlist 字段，不含任何正文；
- 通过 strict schema 与泄漏 canary 复验后的完整安全 JSON 是提交证据，不是临时文件：Mock 固定写入
  `docs/acceptance/evidence/phase-6-9-4-3/mock.json`；每个已越过 provider boundary 的 Live run 写入
  `docs/acceptance/evidence/phase-6-9-4-3/live-<UTC-basic>-<runIdHashPrefix>.json`。`UTC-basic` 固定为
  `yyyyMMddTHHmmssSSSZ`（UTC、3 位毫秒，例如 `20260713T143015123Z`）；`runIdHashPrefix` 是安全
  `sha256:<64 lowercase hex>` 去掉前缀后的前 12 hex。目标已存在时 fail-closed 拒绝覆盖，必须以新 run id 重新运行，
  不追加随机或递增 suffix；存在性/独占保留检查必须在第一条 provider request 前完成，最终用 no-overwrite atomic move
  落盘。证据只追加不覆盖。incomplete Live
  也保留，禁止只提交有利结果；`invalid_run` 仅在确有 provider attempt 时作为失败证据保留。
- `docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md` 提交聚合指标、dataset digest、counter、p95、usage、
  pricing snapshot、estimated cost、decision、固定 failure code、canonical run 选择理由和上述 evidence 链接；不复制正文。
- CLI stdout 重定向文件、调试日志和未通过 strict schema/canary 的中间 JSON 必须删除；结束后确认默认 Mock。
  本阶段不连接数据库，因此没有账号或数据库清理项。

## 13. 分支、提交与交付拆分

所有任务都从已推送的最新 `main` 创建新 `codex/` 分支，不从功能分支派生：

1. 设计文档。
2. 实施计划。
3. Paired report / decision contract。
4. 三 lane runner、metrics 与全局预算。
5. Mock fixture 与 CLI composition。
6. Mock 全量验收。
7. Controlled-Live 28 条验收与 acceptance / 项目文档同步。

每个任务只有一个语义提交；完成功能分支门禁、独立规格审查和质量审查后，以 `--no-ff` 合并 main，在 main 重跑适用门禁并推送远程，核对 local main / origin/main / remote main 三方 SHA 后删除分支。

子代理同一时间最多 3 个，默认只运行 1 个实现或审查代理，避免共享工作区冲突与 provider / API 限流。

## 14. 完成标准

Phase 6.9.4.3 只有同时满足以下条件才能标记完成：

- paired runner 对同一 100 条 case 生成 deterministic / Mock / controlled-Live 安全报告；
- Live 实际调用严格为 28，所有 ineligible/safety case 为 0；
- Router / Verifier 分别输出可复核 decision 与固定 reason；
- 调用、token、价格快照、成本、p50/p95 和 failure 分类完整且不泄露正文；
- 默认 Mock、Live 多重 guard、无自动重试和全局预算门禁均有自动化测试；
- controlled-Live 使用 `deepseek-v4-flash` 完成单次完整 run；
- 无论决策是否启用，都按 12.4 保留所有已发出 provider request 的安全 JSON 与聚合 acceptance，不修改 case 或门槛；
- 本阶段不自动改动 Chat 业务链路；
- acceptance、AGENTS、roadmap 和 AI behavior canonical source 同步；
- main 复验、推送、三方 SHA 和分支清理完成。

## 15. 回顾时可以问

- “为什么 100 条 case 都进入 runner，却只有 28 条允许调用真实模型？”
- “为什么 Mock fixture 可以得高分，却必须标记 `qualityEvidence=false`？”
- “Router 和 Verifier 的启用门槛为什么不同，为什么可以独立启用？”
- “为什么 Verifier 的 15 个百分点提升在 8 条样本上实际需要至少命中 2 条？”
- “为什么 Live 不能自动重试，临时网络失败应该怎样重新验收？”
- “本地 estimated input 与 provider-reported usage 不一致时，预算和成本怎样处理？”
- “为什么要串行跑 28 次调用，而不是并发加速？”
- “为什么 Phase 6.9.4.3 只输出 Enabled 建议，不直接接入 `/api/chat`？”
- “怎样证明 report 没有保存 query、chunk、prompt、模型输出和 API key？”
- “如果 Router 通过但 Verifier 未通过，下一阶段应该怎样处理？”
