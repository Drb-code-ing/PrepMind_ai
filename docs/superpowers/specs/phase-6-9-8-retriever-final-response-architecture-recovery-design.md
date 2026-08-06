# Phase 6.9.8 Retriever / FinalResponse Architecture Recovery 设计

> - 日期：2026-08-05
> - 状态：R0--R4 zero-provider 完成；下一步仅 R5 controlled-Live admission（未授权）
> - 分支：`drb/phase-6-9-8-retriever-final-response-contract`
> - 起始提交：`7026dc4cac83bb656b81739abcb68287c133066a`
> - R0 authority：`zero_provider_retriever_final_response_architecture_recovery_design`
> - 当前 checkpoint authority：`architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`
> - Quality Authority：`none`
> - 独立 lineage：`phase-6.9.8-retriever-final-response-architecture-recovery-v1`

## 1. 决策摘要

唯一 Task 9C controlled-Live run `28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2` 永久保持
`task9_quality_gate_failed / qualityAuthority=none`。本设计不重跑、不恢复、不改写该 run，只基于 sealed
report/journal、当前源码合同和 zero-provider synthetic fixtures 建立新的诊断与评测 lineage。

当前能确认的事实只有：

- Guard `16/16` pass 且 zero-call；
- 固定分母仍是 `16 guards + 64 Provider calls`；
- 四条调用成功，第五条 `rewrite_02.rewrite_candidate_model` 以
  `schema_invalid / wire 1/1/0/0` 终止；
- Qwen wire/usage 为 `3/3/3/3`，DeepSeek 为 `2/2/1/1`；
- breaker 把剩余 59 次调用收为 `not_started_quality_breaker`；
- 正式 semantic、P95、Provider token/CNY aggregate 全为 `null`；
- journal `134` 条并以 `evidence_published` 收口，validator `ok=true`，recovery claim=`null`。

`schema_invalid` 目前把多层本地失败压成同一结果：Model runtime、candidate disposition、provenance、Trace、
usage、第一方 wire counters、live harness postcondition，以及 runner call-result schema 都可能落到这个总括错误。
此外，Task 9 runner 只有在 harness 成功返回后才追加 `response_received`；因此 Provider 已响应但后续本地校验失败
时，外层 wire 仍可能表现为 `1/1/0/0`。这解释了为什么 sealed evidence 不能把当前失败直接写成“Provider 返回了
错误 JSON”，也不能据此归因 transport、账号或服务端。

本次恢复采用以下方案：

1. 建立独立 lineage，不修改 Task 9C marker、journal、artifact、tag、CLI 或 validator；
2. 把 Provider wire、模型 runtime、候选投影、本地 authority、stream ledger、usage/cost 与 runner result 分成
   可验证的阶段；
3. 每个阶段只产生固定 enum/bucket 的 bounded diagnostic，不保存或派生任何业务原文；
4. 同时覆盖 DeepSeek rewrite、Qwen retrieval 与 DeepSeek FinalResponse stream，避免修完 rewrite 后在下一链路
   再次失去定位能力；
5. 保持原 16 guards、64-call 分母、质量阈值、预算、权限、no-retry 与 breaker 语义不变；
6. R0--R4 全部 zero-provider。任何未来 Live 都必须使用新的 admission、tag、授权与 evidence namespace，由用户
   届时单独决策。

## 2. Task 9C 不可变事实与非结论

| 项目                                 | Sealed Task 9C 事实                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Run                                  | `28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2`                                                              |
| Source/tag                           | `66a009ddb40b14d5117cfc0ec785a0d328708c5b` / `phase-6-9-8-retriever-final-response-task9b-approved` |
| Gate / authority                     | `task9_quality_gate_failed / none`                                                                  |
| Guard                                | `16/16` zero-call                                                                                   |
| Calls                                | `4 succeeded / 1 failed / 59 not-started`                                                           |
| Failure call                         | `rewrite_02.rewrite_candidate_model`                                                                |
| Failure boundary                     | `schema_invalid / wire 1/1/0/0`                                                                     |
| DeepSeek / Qwen wire                 | `2/2/1/1` / `3/3/3/3`                                                                               |
| Rewrite / Final strict               | `1/16` / `0/16`                                                                                     |
| Semantic / P95 / aggregate token/CNY | 全 `null`                                                                                           |
| Journal / publication                | `134 / evidence_published`                                                                          |
| Validator / recovery claim           | `ok=true / null`                                                                                    |

这些事实不能推出：

- 具体 JSON 字段、Zod issue、Provider completion 或模型回答内容；
- Provider 是否已返回 HTTP body、何时完成 content parse、失败是否来自额外字段；
- DNS、TLS、proxy、账号、余额、模型权限或服务端的唯一根因；
- 失败调用的 verified usage 或费用为 0；
- Retriever/FinalResponse 真实语义、SLA、产品或 main 可用。

新诊断也不得反向“补全”或重新解释 Task 9C。旧 run 在新代码完成后仍保持同一 sealed 终态。

## 3. 当前链路与结构性缺口

### 3.1 Rewrite 调用链

```text
Task 9 runner reserveCall
  -> runner wire dispatch_started
  -> live harness.runRewriteModel
  -> first-party DeepSeek direct adapter + in-memory wire diagnostics
  -> ModelAgentRuntime.invokeStructured
  -> RetrieverQueryRewrite candidate sanitizer
  -> candidate disposition / provenance / Trace / usage
  -> live harness combined postcondition
  -> runner call-result strict schema
  -> runner wire response_received / usage_verified
```

现有 live harness 用一个布尔表达式同时校验：

- runtime invocation 恰好一次；
- candidate `ok=true` 且 disposition=`candidate_applied`；
- provenance=`deepseek_network` 且 attempted=true；
- Trace succeeded、provider/model 精确匹配；
- usage input/output 合法；
- direct-adapter snapshot succeeded，dispatch/response/usage 均为 1。

任一条件不满足都抛出同一个 `schema_invalid`。candidate 自身对 strict schema、unsafe output、local authority
保留失败会安全回退为 `candidate_rejected` 或 `failed_fallback_original`，但 live harness 又把这些不同结果压成同一
Task 9 failure。

### 3.2 Qwen retrieval 调用链

Qwen 原始查询与候选查询分别执行单文本 embedding + 本地 corpus embedding、1536 维校验、verified usage/CNY、
cosine + keyword hybrid ranking，再投影为 retrieval result。当前已有 `response_invalid`、`usage_invalid` 等公共类别，
但仍缺少 embedding count、dimension、finite/non-zero vector、usage、ranking 与 runner result 的阶段化诊断。

### 3.3 FinalResponse 调用链

FinalResponse 是流式协议，不是单字段 structured output。它包含 Provider stream、server-ledger event、唯一 terminal、
terminal-last、citation ledger、grounding/notice、false tool success、Trace、usage/cost、TTFT/total/end-to-end 等本地
合同。当前 live harness 同样把多个 postcondition 汇总为 `schema_invalid`。Recovery 不得把它简化为 Tutor 式单一
ordinal projection，也不得把未知字段直接丢弃后视为成功。

### 3.4 两套 wire 语义

当前至少存在两层不同观察：

1. **Provider wire**：第一方 adapter 是否 dispatch、收到 Provider response、得到 verified usage；
2. **Runner lifecycle**：harness 是否完整返回可通过 call-result schema 的本地结果。

新 lineage 必须同时记录并验证这两层，不能再用 runner `response_received` 代替 Provider response，也不能用
Provider response 代替本地 strict success。

## 4. 目标与非目标

### 4.1 目标

- 对三类调用形成阶段互斥、有限、可重算的诊断；
- 能区分 Provider response 未观察、Provider response 已观察但 runtime/candidate/stream/local result 失败；
- 保留现有 fail-closed fallback、权限、本地证据与 citation authority；
- 让 runner、journal、artifact 与 validator 对同一阶段机达成一致；
- 用 synthetic Provider-like fixtures 在 zero-provider 条件覆盖成功、失败、恶意对象、取消、超时与 durability；
- 未来若完整 quality gate 失败，仍能在不保存 raw 的前提下定位到 bounded stage/reason。

### 4.2 非目标

- 不恢复 Task 9C raw response，不猜测当前失败具体字段；
- 不放宽 prompt、schema、local authority、citation、owner 或安全策略；
- 不修改 dataset、expected、scorer、阈值、预算、timeout 或 64-call 分母；
- 不添加 retry、repair prompt、JSON extraction、coercion、default、clamp、resume、replay 或 backfill；
- 不把 Qwen embedding、DeepSeek rewrite 和 FinalResponse stream 合并成一个通用弱 schema；
- 不执行 Provider、Docker/API/browser、业务写入、main 或后续 Phase。

## 5. 信任域与权限边界

新架构固定五层信任域：

1. **Source/admission authority**：只由新 source manifest、commit/tag parity 与 opaque admission capability 创建；
2. **Provider transport observation**：只由第一方 adapter 内部 capability 记录 dispatch/response/usage，调用方不能
   伪造；
3. **Protocol/runtime validation**：解析 Provider envelope 或 stream event，并产生 bounded stage terminal；
4. **Local product authority**：owner、query policy、ranking、citation、grounding、tool/write prohibition 与成本重算
   继续由本地代码决定；
5. **Runner/durability authority**：固定调度、breaker、journal、artifact 与 validator 只接受上述能力产生的结果。

模型和 Provider 永远无权修改：

- owner、run/request identity、bearer capability；
- `topK`、`minScore`、source/document filters；
- allowed citation ids、citation ordinal、价格 profile 或预算；
- route、tool permission、写命令、BackgroundJob/Outbox；
- expected/oracle、评分阈值或是否通过 gate。

anonymous、expired、cross-owner、foreign capability、principal drift、parent abort 必须在 dispatch 前 fail-closed，并
保持 Provider calls=0。

## 6. Bounded Diagnostic 合同

诊断版本固定为 `phase-6.9.8-retriever-final-response-bounded-diagnostic-v1`。每个 call 只能由模块内 opaque
capability 产生一个最终 diagnostic terminal；journal 可以记录多个阶段事件，但只能由同一 capability 按固定阶段机
产生，并最终收敛到一个 terminal summary。外部调用者不能传入、选择、覆盖或补写 stage/reason。若多个内部失败
条件同时成立，mapper 必须按冻结的 deterministic precedence 选择最早失败阶段；不能以后出现的宽泛错误覆盖更早的
精确边界。

### 6.1 允许字段

```text
diagnosticVersion
callPhase
stage
reasonCode
providerBoundary
topLevelTypeBucket
fieldCountBucket
terminalCountBucket
rawDataRetained=false
```

字段全部是 strict enum/literal：

- `callPhase`：沿用四个冻结 phase；
- `providerBoundary`：`not_dispatched / dispatched_no_response / response_observed /
response_and_usage_observed / not_applicable / unknown`；
- `topLevelTypeBucket`：`object / array / string / number / boolean / null / not_observed / unknown`；
- `fieldCountBucket`：`0 / 1 / 2_4 / 5_plus / not_observed / unknown`；
- `terminalCountBucket`：`0 / 1 / 2_plus / not_applicable / unknown`；
- `rawDataRetained` 永远是 literal `false`。

新诊断不保存 `shapeFingerprint`。尤其禁止保存任何由 completion、prompt、query、chunk、answer、unknown key、
owner、credential 或 raw error 派生的 hash；即使 SHA-256 不可逆，也可能形成关联或低熵猜测 oracle。

### 6.2 固定 stage

公共阶段：

- `admission`
- `request_contract`
- `provider_dispatch`
- `provider_response`
- `provider_envelope`
- `runtime_result`
- `trace_contract`
- `usage_contract`
- `cost_contract`
- `call_result_contract`
- `applied`

Rewrite 专属阶段：

- `rewrite_candidate_projection`
- `rewrite_local_authority`

Qwen retrieval 专属阶段：

- `embedding_contract`
- `ranking_contract`

FinalResponse 专属阶段：

- `stream_event_contract`
- `terminal_ledger`
- `citation_ledger`
- `delivery_contract`

每个 call family 使用固定子图，禁止跳阶段或使用另一 family 的专属阶段。`applied` 只表示该 call 完成本地 strict
result，不等于整份 gate、产品或 main 通过。

### 6.3 固定 reasonCode

公共 reason：

- `invalid_input`
- `principal_binding_invalid`
- `capability_invalid`
- `aborted_before_dispatch`
- `aborted_after_dispatch`
- `timeout`
- `transport_failure`
- `http_auth`
- `http_rate_limit`
- `http_client`
- `http_server`
- `response_not_observed`
- `provider_envelope_invalid`
- `runtime_result_invalid`
- `provenance_invalid`
- `trace_missing`
- `trace_status_invalid`
- `trace_identity_invalid`
- `dispatch_count_invalid`
- `response_count_invalid`
- `usage_missing`
- `usage_invalid`
- `cost_mismatch`
- `result_shape_invalid`
- `phase_mismatch`
- `unknown`
- `applied`（唯一成功终态 reason；R0 列表漏写，R1 合同补全；不表示整份 gate、产品或 main 通过）

Rewrite reason：

- `candidate_not_applied`
- `candidate_rejected`
- `fallback_original`
- `rewrite_authority_invalid`
- `unsafe_rewrite`

Qwen reason：

- `embedding_count_invalid`
- `embedding_dimension_invalid`
- `embedding_value_invalid`
- `ranking_invalid`

FinalResponse reason：

- `stream_event_invalid`
- `terminal_missing`
- `terminal_duplicate`
- `terminal_not_last`
- `citation_ledger_invalid`
- `grounding_invalid`
- `critical_notice_missing`
- `false_tool_success`
- `delivery_invalid`

任何未映射异常都退化为 `unknown`。Diagnostic 失败不能改变原主 lane 的 fail-closed terminal，不能触发 retry，也
不能把 unknown 改写成 transport 或 schema 的猜测。

### 6.4 禁止保存

- Provider response/completion、stream delta、prompt、原始/改写 query、recent turns、active context；
- chunk、document、citation text、答案、题目、用户输入或业务 ID；
- credential、URL、header、cookie、proxy、env value；
- Error message/stack/cause、Zod issue/path/value、unknown key 名；
- getter/Proxy/toJSON 返回值、对象 dump、截断 raw、base64 或 raw-derived hash；
- expected/oracle、scorer 中间答案、模型选择提示或业务写命令。

Report、journal、CLI stdout/stderr 与测试 snapshot 都受同一禁止清单约束。

## 7. 三类调用的阶段机

### 7.1 DeepSeek rewrite

```text
admission -> request_contract -> provider_dispatch -> provider_response
  -> provider_envelope -> runtime_result -> rewrite_candidate_projection
  -> rewrite_local_authority -> trace_contract -> usage_contract
  -> cost_contract -> call_result_contract -> applied
```

关键区分：

- runtime 返回 `SCHEMA_INVALID` 与 candidate `candidate_rejected` 不再合并；
- `failed_fallback_original` 继续是安全产品 fallback，但在 quality eval 中以独立 reason 失败；
- Provider response observed 只能由第一方 transport capability 证明；
- candidate disposition、Trace、usage 和 wire counters 分开校验；
- `executedQuery` 仍需本地实体、数字、公式、约束和 unsafe pattern 校验，不做模型输出修复。

### 7.2 Qwen retrieval

```text
admission -> request_contract -> provider_dispatch -> provider_response
  -> provider_envelope -> embedding_contract -> usage_contract
  -> cost_contract -> ranking_contract -> call_result_contract -> applied
```

原始查询与候选查询继续是两次独立调用；不能共享 usage 或把 sibling 成功补到失败 lane。Embedding count、连续 index、
1536 维、finite/non-zero vector、`prompt_tokens == total_tokens`、北京区 price profile 与本地 hybrid ranking 均由
本地 authority 校验。

### 7.3 DeepSeek FinalResponse stream

```text
admission -> request_contract -> provider_dispatch -> provider_response
  -> stream_event_contract -> terminal_ledger -> citation_ledger
  -> trace_contract -> usage_contract -> cost_contract
  -> delivery_contract -> call_result_contract -> applied
```

FinalResponse 必须保持 server-ledger：唯一 terminal、terminal-last、citation allowlist、grounding/critical notice、
false-tool-success、TTFT/total/end-to-end 与本地 cost 重算。客户端断连仍只影响 delivery，不得改写已完成的本地
terminal；但 eval 的 parent abort/timeout 必须按固定 stage 收口。

### 7.4 R1 已落地的 rewrite authority

R1 已在 zero-provider 边界实现 §7.1：module-owned rewrite session 只绑定一个尚未使用的真实 V7 wire capability；
foreign、duplicate/reused capability 与 active snapshot 都不能推进 Provider authority。`@repo/ai` 只公开 frozen
snapshot reader，claim/advance/fail/abort/complete mutation 继续不从 barrel 导出。Rewrite diagnostic 不再接受
caller-supplied dispatch/response/envelope/usage status，而是只从 terminal wire stage/counter/failure/usage disposition
确定性投影；synthetic TDD 也必须真实穿过第一方 DeepSeek direct adapter 的 injected fetch。

这仍只是 R1 contract/TDD：包内 local mapper transition 不进入 `@repo/agent` 公共 barrel，且 R3 未来必须把它与
source-admitted runner/result/Trace/cost validator 绑定后，才可能形成 durability authority。R1 不形成 Qwen、
FinalResponse、Mock、Live、产品或 main authority。验收见
[R1 zero-provider diagnostic contract / rewrite TDD](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r1-zero-provider-tdd.md)。

### 7.5 R2 已落地的 Qwen / FinalResponse wire authority

R2 已在 zero-provider 边界补齐独立 `qwen_retrieval` 与 `final_response_stream` wire family。两个 family 都使用
module-owned WeakMap capability、single claim、严格单调 stage 与 terminal frozen snapshot；`@repo/ai` 只公开
create/read，mutation transition 仍留在第一方 adapter 内。Recovery session 只接受尚未使用、family 匹配且未被
其它 session 绑定的 capability，forged/reused/active/cross-family 均 fail-closed。

Qwen 第一方 adapter 现在能区分 transport/HTTP/envelope、embedding count/index、dimension、finite/non-zero value 与
usage；FinalResponse 第一方 stream adapter 能区分 transport/HTTP、stream event、terminal missing/duplicate/not-last、
false tool success、usage 与 abort。第一条实际 stream event 即使畸形，也只表示
`response_observed + stream_event_invalid`，不表示 success；只有完全未观察到 Response/event 才是
`response_not_observed`。两条链路都不保存 raw、prompt/query、credential、URL/error、unknown key 或 raw-derived
hash。

R2 的 cost/ranking/citation/Trace/delivery/result mapper 仍只接收包内 fixed status，必须由 R3 的 source-admitted
runner、strict validator 与 durability lifecycle 绑定，才能形成正式 evidence。R2 authority 仅为
`zero_provider_retriever_final_response_architecture_recovery_robustness / qualityAuthority=none`，不形成 Provider、
语义、产品或 main authority。验收见
[R2 zero-provider Qwen / FinalResponse robustness](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r2-zero-provider-robustness.md)。

### 7.6 R3 已落地的 Runner / Durability / Admission authority

R3 已在 zero-provider 边界把 R1/R2 的三类 terminal observation 接入独立
`phase-6.9.8-retriever-final-response-architecture-recovery-v1` runner。固定调度为 `16 guards + 16 rewrite pairs +
16 FinalResponse cases = 64 Provider call slots`；每条调用分别记录 reservation/dispatch/harness-return/verified-result
的 `runnerWire`，以及第一方 executor/dispatch/response/verified-usage 的 `providerWire`。首个失败打开 breaker 后，
未开始调用不生成 diagnostic、usage 或费用；分母不完整时 semantic、P95、token 与 CNY aggregate 全为 `null`。

共享 runner-observation 模块只保留严格记录校验，不再导出 capability issuer。Rewrite、Qwen 与 FinalResponse 各自在
模块私有 WeakMap 中签发、保存和单次消费 observation，精确绑定 `callId + phase + family`；forged、active、reused、
cross-call 与 cross-family capability 均 fail-closed。Synthetic outcome 永远保持 `synthetic_test`，不能升级为
controlled-Live authority。

Source admission 已绑定 branch、HEAD/upstream/origin/new approved ref parity、clean tree、formal evidence=0、冻结
identity 与完整 source bundle SHA，并用 admission/reservation 两个 opaque capability 分离 runner 使用权和 evidence
预留权。Durability 已实现 exclusive marker、reservation-before-dispatch、fsynced hash-chain diagnostic journal、
exclusive temp + hard-link artifact、strict replay/recompute validator 与 crash-only seal；`run_terminal` 后或
`publication_started` 后崩溃均只恢复 terminal publication，不继续 Provider 工作。Recovery claim 绑定
`recovery_claimed.previousHash`，即使攻击者重算后续 hash，claim-tail drift 仍被拒绝。

R3 只在隔离临时目录运行 synthetic durability/fault tests；没有执行正式 R3 CLI、创建 approved tag/marker/journal/
artifact/recovery claim、读取 credential 或调用 Provider。其 authority 仅为
`zero_provider_retriever_final_response_architecture_recovery_runner_durability_admission / qualityAuthority=none`，不形成
reviewed Mock、Live、产品、SLA 或 main authority。验收见
[R3 zero-provider runner / durability / admission](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r3-runner-durability-admission.md)。

### 7.7 R4 reviewed Mock / static checkpoint

R4 已把 Task 8 的真实 Retriever/FinalResponse production node、ledger 和 prompt-only reviewed Mock 路径接入 R3
runner。固定结果为 `16/16` guard zero-call、`64/64` provider slots、`runnerWire/providerWire=64/64/64/64`、
diagnostic `applied=64`，rewrite/FinalResponse strict 各 `16/16`，安全失败为 0。R4 report 的 gate 固定为
`architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`；synthetic usage/cost 只用于本地预算和
一致性检查，`aggregateVerifiedProviderCostCny` 保持 `null`。

R4 不创建 formal evidence，不读取 credential，不启动 Provider/Docker/API/browser，不执行业务写入；Task 9C
sealed SHA 与旧 validator 只读 parity 保持。R4 只能证明固定 Mock fixture 的本地结构与 scorer 自洽，不形成真实模型、
产品、SLA 或 main authority。验收见
[R4 reviewed Mock / static](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock-static.md)。

## 8. Result、Wire 与 Gate

新 lineage 继续保留公共 `failureReason` 以兼容 report 聚合，同时新增 strict bounded diagnostic。Validator 必须同时
重算：

- `runnerWire`：reservation/dispatch/harness-return/verified-result；
- `providerWire`：第一方 adapter dispatch/response/verified-usage；
- diagnostic 阶段单调性与 call-family 合法子图；
- call result 的 phase、usage、cost、Trace、quality metric；
- guard-first、rewrite pair serial、FinalResponse-after-rewrite 调度；
- breaker 后所有后续调用为 `not_started_quality_breaker`，且不复制失败 sibling diagnostic。

只有 `runnerWire=1/1/1/1`、`providerWire=1/1/1/1`、diagnostic=`applied` 和对应 local strict result 全部成立，
单 call 才可成功。任一响应/usage/分母不完整时，相关 Provider token/CNY、semantic 与 P95 aggregate 继续为
`null`，不能按 0 或已完成前缀相加。

质量门保持 Task 9B 冻结值：

- 16 guards 全部 pass 且 zero-call；
- 16 original Qwen + 16 rewrite DeepSeek + 16 candidate Qwen + 16 FinalResponse DeepSeek；
- Qwen/DeepSeek 各 32 calls，no retry/replay/resume/backfill；
- rewrite、retrieval、FinalResponse、安全、P95 与成本阈值不降低；
- 只有完整新 lineage `controlled_live` gate pass 才可能形成新的 branch eval semantic authority；
- 即使未来 gate pass，也不自动形成产品、SLA、Docker/API/browser、Trace 或 main authority。

## 9. Journal、Artifact 与 Validator

旧 Task 9C evidence namespace 完全只读。新 lineage 使用新的 source manifest、approval、marker、journal、artifact、
validator 和 recovery prefix。

R3 journal 在既有 call lifecycle 外增加：

```text
diagnostic_stage_started
diagnostic_stage_succeeded
diagnostic_stage_failed
```

Journal 只记录 call identity、固定 stage/reason/bucket、providerBoundary、`rawDataRetained=false` 与既有 hash-chain
元数据。Hash-chain 只能覆盖经过 strict allowlist schema 校验后的 canonical journal record bytes；这些 bytes 不得
夹带 request、response、error、URL、path、unknown key 或其它隐藏字段。它可以校验 journal 完整性，但不得对
Provider/业务 raw 计算或保存 hash。

Validator 必须拒绝：

- unknown/extra field、free text、raw-derived hash、URL 或 error message；
- 非单调 stage、重复 terminal、失败后成功、跨 family stage；
- Provider response 在 dispatch 前、usage 在 response 前、applied 在 usage/result 前；
- caller-supplied provider/model/price/usage/Trace/diagnostic；
- 任一 sibling/call 复用或污染另一 call 的 usage、cost、wire、diagnostic 或 terminal；
- 旧 Task 9/Phase 6.9.7 lineage、tag、marker 或 artifact；
- incomplete denominator 却出现 semantic/P95/token/CNY aggregate；
- journal reorder/duplicate/truncate/tamper、marker collision、path traversal、symlink/hard-link ABA 与 publication
  conflict。

Crash-only recovery 只允许解释当前新 lineage 的 durable prefix；不创建 Provider executor、不读取 credential、不
执行未开始 call、不 retry/resume/replay/backfill。正常 `evidence_published` 后 seal 必须拒绝。

## 10. Zero-provider Fault Matrix

R1--R4 至少覆盖：

1. Rewrite canonical success、candidate rejected、fallback original、runtime result invalid、Trace/provenance/usage/
   wire/result 分支；
2. Qwen embedding count/index/dimension/finite/non-zero/usage/price/ranking 分支；
3. FinalResponse chunk/event shape、terminal 0/1/2+、terminal order、citation allowlist、grounding、critical notice、
   false tool success、usage/cost/latency/delivery 分支；
4. malformed JSON、BOM、fence、prose、trailing/multiple top-level、duplicate key、深度/宽度/节点/字节限制；
5. hostile getter、Proxy、symbol、cycle、non-plain prototype、toJSON/coercion/iterator；
6. pre/in/post-dispatch abort、hard timeout、transport 与 bounded HTTP categories；
7. usage missing/negative/fraction/overflow/provider mismatch、caller fake cost/Trace/wire/diagnostic；
8. anonymous、expired、cross-owner、foreign capability、principal drift 全部 pre-dispatch zero-call；
9. prompt/oracle/credential/URL/raw error/unknown key/hash 泄漏扫描；
10. fixed 16 guards + 64 calls、pair serial、breaker、aggregate null 与 no retry；
11. crash at reserve/dispatch/response/diagnostic/usage/terminal/publication，journal/marker/artifact tamper；
12. legacy Task 9C validator/SHA parity 与新旧 lineage 双向拒绝。

所有 synthetic Provider-like fixture 都只能读取实际 bounded request，不得读取 expected、scorer 或正式 artifact 来
生成答案。Expected 只进入 runner 后置 scorer。

## 11. Source Admission

R3 source manifest 已绑定：

- Task 8 manifest、Task 3 baseline、Task 9 eval policy 与 scorer；
- 三类 provider request/response/stream contract；
- bounded diagnostic schema、mapper、阶段机与禁止字段扫描；
- Retriever candidate/local authority、Qwen ranking、FinalResponse server-ledger/citation authority；
- 双 wire result、runner/report/journal/artifact/validator；
- reviewed fixture/factory、anti-oracle 与 hostile-input tests；
- new approved source commit/tag 及 local/upstream/origin parity。

旧 tag `phase-6-9-8-retriever-final-response-task9b-approved` 永久指向 Task 9C source，不得移动或复用。R0 不创建
新 tag，也不定义未来 exact authorization 文本。

任何未来 Provider 调用前至少需要：

1. R1--R4 各自完成独立提交、推送和复审；
2. 新 source manifest、clean tree、HEAD/upstream/origin/new approved tag parity；
3. 只读核对 Task 9C marker/journal/artifact SHA 与 validator parity，禁止写入旧 namespace；
4. 新 lineage 正式 marker/journal/artifact/recovery claim 为 0；
5. fresh zero-provider proxy preflight ready；
6. 用户重新接受当次 DeepSeek + Qwen 数据边界；
7. 用户给出新 lineage 的精确一次性授权；
8. 三项专用 credential 只在所有门通过后映射到唯一隔离进程。

任一条件不满足都保持 zero-provider，不创建 marker、不读取 credential。

## 12. 原子路线

| 阶段 | 内容                                                                     | 当前状态              |
| ---- | ------------------------------------------------------------------------ | --------------------- |
| R0   | sealed 只读复盘、三链路阶段机、bounded diagnostic、独立 lineage 与路线   | 已完成，zero-provider |
| R1   | strict diagnostic contract、opaque capability、阶段机与 rewrite TDD      | 已完成，zero-provider |
| R2   | Qwen/FinalResponse 集成、hostile/provider-like/fault matrix              | 已完成，zero-provider |
| R3   | 独立 report/runner/source/CLI/journal/artifact/validator/crash-only seal | 已完成，zero-provider |
| R4   | 64-call reviewed Mock/static、history parity、Reader Testing             | 已完成，zero-provider |
| R5   | 仅在全新 admission 与用户新授权后可能执行的一次 controlled-Live          | 未授权、未开始        |
| R6   | 仅 R5 pass 后的 Docker/API/可见浏览器/Trace/权限/精确清理                | 阻断                  |
| R7   | 仅 R6 pass 后的 main 合并、远程推送与 default-off 回放                   | 阻断                  |

每个阶段单独提交并推送当前 Phase 6.9.8 功能分支；不创建 worktree 或从当前分支再派生子分支。Phase 6.9.8
当前源码尚未进入 main，因此不能从缺少 Task 0--9B 基线的 main 开始 Recovery；同时也禁止为了满足分支形式而
提前把失败 gate 合并 main。

## 13. R0--R4 当前禁止事项

- 不运行 Task 9C production CLI、seal、curl、单 case或产品 API Provider 探测；
- 不删除、移动、改写、重建 Task 9C tag/marker/journal/artifact；
- 不从成功的四条 call、旧 Mock 或其它 Phase evidence 拼接通过；
- 不把 `schema_invalid` 写成错误 JSON、额外字段、transport 或 Provider 唯一根因；
- 不保存 raw、raw-derived hash、unknown key、Zod issue、prompt、query、chunk、answer、credential 或 error；
- 不修改产品 gate、`.env`、Docker、数据库、BackgroundJob、Outbox 或业务数据；
- 不降低分母、质量门、预算、安全、owner、citation 或 local authority；
- 不执行 R5 Live、Task 10/11 或 main；下一原子任务仅在新的用户授权边界下准备 R5 fresh admission。

## 14. 回顾时可以问

- 为什么 `wire 1/1/0/0` 不能证明 Provider 没有返回响应？
- 当前哪些不同分支会被压缩成同一个 `schema_invalid`？
- 为什么 Recovery 必须同时覆盖 rewrite、Qwen retrieval 和 FinalResponse stream？
- `providerWire` 与 `runnerWire` 分别证明什么，为什么不能互相替代？
- 为什么 candidate fallback 是安全产品行为，却仍应在质量 gate 中失败并保留独立 reason？
- 为什么 diagnostic 不保存 raw hash 或 unknown key 名？
- FinalResponse 为什么不能照搬 Tutor 的单 ordinal schema recovery？
- 为什么完整分母失败时，四条成功费用仍不能作为 run aggregate？
- 为什么 R3 完成后仍不能创建正式 tag/evidence、读取 credential 或请求 Live 授权？
- 为什么 observation 必须由三个第一方模块各自私有签发，而不能暴露一个共享 issuer？
- `run_terminal` 后崩溃与普通 crash-only recovery 的 publication authority 有什么区别？
- 为什么 Phase 6.9.8 Recovery 继续留在当前功能分支，而不能从缺少基线的 main 新建？
