# Phase 6.9.4.2 Router / Verifier Mock Candidate Contract

## 1. 结论

Phase 6.9.4.2 已完成 Router 与 Knowledge Verifier 的 Mock candidate 工程 contract。候选路径把模型调用限制在确定性 eligibility 与 safety gate 之后，并统一经过 strict schema、不可变预算、超时/取消和安全 Trace 校验；任一校验失败都回到本地确定性结果或更保守结果。

这不是 Live 验收，也没有在 `phase-6.9-router-verifier-v1` 上运行 Mock/Live paired candidate。当前只证明候选 adapter、Mock runtime 和注入 fake executor 的工程边界，不证明 Router/Verifier 的真实语义质量，不表示生产 Chat 已接入或启用模型路径。

本文件是 2026-07-12 的阶段证据快照，不是持续行为 contract 的事实源。Phase 6.9.4.2 candidate 行为以 `docs/ai-behavior-acceptance.md` 的对应段落为唯一 canonical source；`docs/acceptance-checklist.md` 只提供执行入口。

## 2. 运行信息与范围

| 项目 | 结果 |
| --- | --- |
| 验收日期 | 2026-07-12 |
| 验收基线 Git SHA | `d3839b491dcf8a13e119fea44cdff1683fd35c86` |
| baseline 数据集 | `phase-6.9-router-verifier-v1` |
| candidate 运行方式 | Mock runtime / 注入 fake executor 的本地单元测试 |
| Live provider / model | 未使用 |
| 账号、数据库、Docker、浏览器 | 均未操作 |
| 模型网络请求 | 0 |

`git rev-parse HEAD` 在文档修改前返回上述 SHA；它是 final review code remediation 合并后、本次 fresh 证据所对应的实现基线。验收没有读取 API key，没有启动服务，没有创建测试账号或业务数据，也没有操作 PostgreSQL、Redis、MinIO、Docker 或浏览器。

## 3. Candidate 前置边界

ineligible 表示 deterministic selector 没有授权进入 candidate 路径；safety 命中表示相关材料不得跨越 provider 边界。任一场景仍调用 runtime 都会破坏授权、数据最小化和成本边界，因此两者必须在 prompt 构造与 runtime 之前以 0 invoke 收口。

### 3.1 Router

- `candidateEligible=false` 时保留 strict schema 已验证并重建的本地 deterministic Router 结果（route、confidence、reason 与本地权限位）；它不是对原始对象的字节级透传，额外字段会被剥离。此时 `attempted=false`、runtime invoke 为 0，也不产生 model candidate provenance。
- safety gate 在 eligibility、abort、预算和 runtime 之前扫描用户文本与 active study context；命中指令覆盖、凭据/系统提示词外泄、跨用户访问、虚假写入声明、系统工具、未确认长期记忆或破坏性资料写入时，runtime invoke 为 0。
- safety 结果固定为本地 safe chat：`name=chat`、`confidence=1`、`requiresRag=false`、`requiresHumanApproval=false`，模型不能借 route 输出扩大能力。
- candidate 只返回六种 route、`0..1` confidence 和四种固定 reason code。`requiresRag` / `requiresHumanApproval` 不接收 provider 值，而是由本地 `ROUTE_PERMISSIONS` canonical map 根据 route 重建。

### 3.2 Knowledge Verifier

- prompt injection、credential-like material、系统提示词外泄、任一 chunk `riskLevel=high` 或 `safeForPrompt=false` 都在 eligibility 前整批阻断；结果固定收紧为 `suspicious`，`attempted=false`，runtime invoke 为 0。
- candidate schema 是以 `status` 为判别字段的 strict discriminated union。`trusted`、`suspicious`、`insufficient` 只能携带各自唯一 literal `evidenceCodes`；`conflict` 只能携带 1 到 4 个不重复的固定 conflict code；`skipped`、旧 `evidence` 字段、矛盾 code、重复值和额外字段全部拒绝。
- chunk 先按 score 降序、再按 `chunkId` code-unit 升序稳定排序；最多选择 4 个，发送合成 `chunk_1..4` label、score 与受限 excerpt，不发送 document/chunk 标识或 metadata。超过输入估算预算时整块丢弃尾部 chunk，不做不安全的半结构截断。
- runtime 失败不会放宽资料结论：已有 `conflict` / `suspicious` / `insufficient` 保持限制性状态，deterministic `trusted` 会收紧为 `suspicious`。只有 strict candidate success 才应用候选状态。
- `candidateEligible=false` 时保留已验证 deterministic status（包括 `trusted`）及其限制性语义，但 reason、notice、debug 与 promptAddition 都由本地 deterministic policy 固定模板安全重建；不传播 raw deterministic 正文，也不声称 candidate 曾运行。

## 4. Schema、预算、取消与降级矩阵

| 场景 | runtime invoke | Observation | 本地结果与记账 |
| --- | ---: | --- | --- |
| 输入结构、raw cap、预算对象或 runtime 入口非法 | 0 | `fallback_invalid_input` | Router 使用本地 deterministic 或 safe chat；Verifier 保留限制性状态并把 trusted 收紧为 suspicious；usage 为 0 |
| safety / high-risk / prompt injection 命中 | 0 | `safety_blocked` | Router 固定 safe chat；Verifier 固定 suspicious；预算不消耗 |
| `candidateEligible=false` | 0 | `not_eligible` | Router 保留 strict schema 重建后的 deterministic 结果；Verifier 保留已验证 status/限制性语义并用本地固定模板重建 reason/notice/debug/promptAddition，不传播 raw deterministic 正文；均不产生 candidate provenance，预算不消耗 |
| 调用前 signal 已 abort | 0 | `fallback_aborted` | 使用本地保守结果；预算不消耗 |
| call / input / output 预算不足 | 0 | `fallback_budget_exceeded` | 使用本地保守结果；调用方预算不变 |
| strict output schema 拒绝 | 1 | `fallback_schema_invalid` | 使用本地保守结果；保留安全 runtime Trace 与已预留预算 |
| runtime timeout | 1 | `fallback_timeout` | 使用本地保守结果；只暴露固定 `TIMEOUT` 结构码 |
| runtime 外部取消 | 0 或 1 | `fallback_aborted` | 取消发生在调用前不预留；调用中取消可使用 caller 或 preview budget，均须满足 strict runtime contract |
| live guard、executor、runtime config 或 provider 结构化失败 | 按 runtime 阶段 | `fallback_runtime_error` | 使用本地保守结果；只保留固定错误码和安全 Trace |
| runtime 抛异常、返回畸形 envelope、stale budget、非法 usage/Trace 或额外字段 | 1 | `fallback_runtime_error` + `traceUnavailable=true` | 不信任 runtime telemetry；按 preview budget 记账，usage 标为 unavailable 且数值保持 0 |
| strict candidate success | 1 | `candidate_applied` | 只应用 schema 内字段；Router 权限本地重建，Verifier evidence canonical 排序 |

最终审查还固定了以下 fail-closed 行为：

- 顶层、nested deterministic、budget、runtime 的 hostile getter / Proxy，以及 `AbortSignal.aborted` hostile getter 都被 containment；不传播 getter 中的原始文本，也不继续调用 runtime。
- candidate adapter 在校验时重建预算快照，传给 runtime 的又是独立 snapshot；runtime 原地污染 request budget 不能修改调用方预算或伪造 preview budget。
- 工程 `estimatedInputTokens` 用于调用前预留，不是 provider tokenizer 的硬上限。结构化结果中的真实 provider input usage 可以高于工程估算，不会因此误拒；output usage 仍不得超过本次 request cap 或预留输出量。
- runtime 抛异常或 telemetry 不可验证时不能假装“未消耗”：返回 `traceUnavailable/usageUnavailable`，并推进到 preview budget。后续重试使用该预算会被 call/output 上限阻断，避免 telemetry 不可用时重复调用造成超卖。

## 5. 安全 Envelope 与 Trace

candidate 对外 envelope 只包含业务结果、固定 disposition/reason code、不可变预算快照、usage，以及 contract 有效时的安全 Trace。Trace 只允许 hashed run id、固定 task、mode/provider/model、状态、token 数、最大输出量、耗时、degraded 和固定 error code。

strict envelope/Trace schema 没有 system/user prompt、query、chunk 正文、document/chunk 标识、provider output、provider raw error、stack 或 response headers 的专用字段，并拒绝额外字段。序列化 canary 用例进一步验证：已覆盖的输入、失败消息、额外字段与异常路径没有序列化测试中设置的 prompt、query/chunk、provider output/raw error、credential 与邮箱样本。这是对现有测试样本和路径的有界证据，不是对任意正文的通用 secret-scanner 保证。

Trace 允许的 `model` 是 composition root 提供的受控 identifier，当前 contract 只校验其字符集与长度；本 slice 不把 `model` 字段当作 secret scanner。后续 composition 配置仍不得把 API key、token、cookie 或其他 credential 放入 model identifier。

## 6. Fresh 自动化证据

以下命令均在 `d3839b491dcf8a13e119fea44cdff1683fd35c86` 上 fresh 执行，退出码均为 0；这是 final review code remediation 合并后的证据基线：

| 命令 | 真实结果 |
| --- | --- |
| `bun --filter @repo/agent test` | 227 pass / 0 fail，24 files，2346 expect calls |
| `bun --filter @repo/agent typecheck` | 通过，exit 0 |
| `bun --filter @repo/agent lint` | 通过，exit 0 |
| `bun --filter @repo/agent eval:phase-6-9-4-1` | 100 total / 74 pass / 26 fail / critical 2；input/output tokens 0/0；estimated cost 0 |
| `bun --filter @repo/ai test` | 71 pass / 0 fail，4 files，194 expect calls |
| `bun --filter @repo/ai typecheck` | 通过，exit 0 |
| `bun --filter @repo/ai lint` | 通过，exit 0 |
| `bun --cwd packages/types typecheck` | 通过，exit 0 |
| `git rev-parse HEAD` | `d3839b491dcf8a13e119fea44cdff1683fd35c86` |

补充定向证据：Router candidate 47/47（443 expect）、Verifier candidate 40/40（406 expect）、共享 candidate policy 15/15（84 expect）。定向计数包含在 `@repo/agent` 全量 227 条测试中，不能重复相加成新的总数。

deterministic baseline 保持原样：Router 60 + Verifier 40，共 100 条；74 pass、26 fail、critical failure 2、p95 0ms、token/cost 0。Phase 6.9.4.2 没有改 baseline policy、expected 或数据集，也没有生成 candidate score。

## 7. 启用结论

- Enabled：`no`
- Reason：`paired_candidate_not_run`
- 当前生产路径：继续使用 deterministic Router / Verifier
- 本阶段证明：Mock candidate 工程 contract、零调用安全门、strict schema、预算与降级边界
- 本阶段不证明：候选语义质量、真实 provider 行为、生产延迟/成本或模型路径净收益

Mock 全绿不能替代 same-case Live paired eval。只有 candidate 在同一 `phase-6.9-router-verifier-v1` 上同时满足 Router/Verifier 专属质量、安全、p95 延迟、token 与估算成本门槛，才允许重新评估 Enabled；任一门槛失败都继续 deterministic。

## 8. 未执行事项与下一任务

本任务没有模型网络或账号操作，没有数据库、Redis、MinIO、Docker、浏览器或可见 UI 操作，没有读取 API key，也没有调用任何外部 provider 或真实 Live provider。本地调用了 Mock provider/runtime responder，并通过注入 fake executor 验证 live-shaped contract；全程没有模型网络请求，也不表示 Live 已验。因此不存在账号、会话、数据库对象、容器或浏览器 storage 清理项。

下一任务是 Phase 6.9.4.3：复用同一 case 运行 deterministic / Mock / controlled-Live paired eval，记录 Router 与 Verifier 专项质量、安全、p95 延迟、provider-reported token 和估算成本；验收结束后恢复 Mock 并按实际运行范围清理临时数据。

## 9. 回顾时可以问

- “为什么 candidate eligibility 与 safety gate 必须在 runtime、abort 和预算检查之前？”
- “Router 为什么只让模型选择 route，却不让模型决定 `requiresRag` 或 `requiresHumanApproval`？”
- “Router safety 命中后为什么固定回到 safe chat，而不是采用模型给出的高 confidence route？”
- “Verifier 为什么对一个 high-risk chunk 采用整批阻断，而不是只删除该 chunk 后继续调用模型？”
- “Verifier strict discriminated union 如何防止 trusted 状态携带 conflict evidence，为什么 conflict code 还必须去重？”
- “stable chunk sort、synthetic label 与整块 drop 分别解决了哪些复现性和数据最小化问题？”
- “为什么 provider-reported input usage 高于工程估算可以接受，但 output usage 超过 request cap 必须拒绝？”
- “runtime telemetry 不可用时为什么要推进 preview budget，这怎样阻止无证据重试超卖？”
- “ineligible 到底保留什么：Router 为什么保留 strict schema 重建后的 deterministic 结果，而 Verifier 只保留 status/限制性语义并安全重建 reason/notice/debug/promptAddition？”
- “为什么 `attempted=true` 仍可能没有 Trace，`traceUnavailable/usageUnavailable` 与 preview budget 分别表达什么？”
- “hostile getter、Proxy、AbortSignal 和 runtime 原地预算污染分别试图跨越哪一层信任边界？”
- “227/227 与 71/71 证明了什么，为什么仍然必须保持 `Enabled=no`？”
- “Phase 6.9.4.3 为什么必须在同一 case 上做 deterministic / Mock / controlled-Live paired eval？”
