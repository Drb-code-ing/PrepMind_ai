# Phase 6.9.8 Retriever / FinalResponse Transport Evidence Recovery 设计

> 状态：T0/T1/T2/T3-A 与 T3-C zero-provider guard 已完成；T3-B controlled canary 已执行一次并以配置失败 durable seal
> 日期：2026-08-06
> Lineage：`phase-6.9.8-retriever-final-response-transport-evidence-v1`
> 基线：`drb/phase-6-9-8-retriever-final-response-contract`（继续使用现有 Phase 6.9.8 基线，不创建嵌套分支）
> Authority：`zero_provider_transport_evidence_t3_configuration_guard / qualityAuthority=none`（T3 失败封存；不构成语义质量 authority）

## 1. 决策摘要

R5 的唯一 controlled-Live 已经 durable seal，但在第二个 rewrite pair 的 DeepSeek
`provider_dispatch / unknown` 处终止。sealed evidence 只能证明“进入真实第一方 dispatch 后，在 response 前
发生了未细分的 bounded failure，并由 breaker 安全收口”；它不能证明 DNS、TLS、代理、账号、余额、模型权限或
服务端是唯一根因。

本决策选择建立一条独立的 Transport Evidence Recovery lineage，先做 zero-provider 的可判别性验证，再决定是否
值得申请新的极小 Provider canary。它不是 R5 retry、artifact recovery、产品验收或质量门放宽。

核心原则：

1. 复用现有 diagnostic schema、`providerWire/runnerWire` 规则、模块私有 observation、source admission 和
   proxy preflight 的安全边界；不改写 R5/Task 9C 的 marker、journal、artifact、validator 或 SHA。
2. 把“阶段边界”和“失败类别”分开：`provider_dispatch` 只表示发生在哪个阶段，不能直接推断具体网络根因。
3. 只保留固定 enum/bucket、opaque `callId`、阶段序列和计数；`rawDataRetained=false` 始终成立。
4. 在没有稳定分类能力前，不申请新的真实调用；不能用重试来替代可观测性。

## 2. 已知事实与未知事实

### 2.1 已知事实

- R5 run：`34eb99be-bdeb-41e5-85cf-3c651ecefc68`。
- guards：`16/16` 通过且 zero-call；external Provider calls `4`（Qwen `3`、DeepSeek `1`）。
- 第二个 rewrite pair 的 DeepSeek 在 `provider_dispatch / unknown` 终止；breaker 后 `59` slots 未启动。
- rewrite strict `1/16`、FinalResponse strict `0/16`；正式 semantic、P95、verified usage/CNY aggregate 全为 `null`。
- journal `237` 条以 `evidence_published` 收口，validator `ok=true / bundle_valid`，recovery claim=`null`。
- 产品 gate、Docker/API/browser、Trace 业务验收和 main authority 均未被 R5 解锁。

### 2.2 明确未知

- `unknown` 是否源于本地代理、socket、TLS、HTTP、Provider envelope、SDK 适配或其它边界。
- Provider 是否实际收到完整请求、返回了任何可观察 response，或只在本地 dispatch 前后失败。
- 账号、余额、模型权限和服务端状态是否参与了失败。

这些未知项不能由 R5 artifact 反向补全，也不能通过 curl、单 case 或追加探测补证。

## 3. 备选方案与取舍

| 方案                                   | 做法                                                                              | 不选择的原因                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| A. 直接重跑 R5                         | 复制 64-slot runner 或换 proxy 再试                                               | 违反一次性 lineage 边界；即使成功也无法说明前次 `unknown` 的根因     |
| B. 直接放宽 schema/降级为 Mock         | 把 dispatch failure 视为可接受或绕过本地 authority                                | 会把未知失败伪装成质量通过，不能提升真实模型 authority               |
| C. 只做 Provider health canary         | 只验证一次 HTTP/usage 成功                                                        | health 不等于三条 Agent 链路的阶段可观测性，不能解释 response 前边界 |
| D. Transport Evidence Recovery（采用） | 先用零网络 fault matrix 验证阶段、wire、诊断 bucket 的可判别性，再评估极小 canary | 成本和风险最低，且每个结论都可被独立证伪                             |

## 4. 范围与禁止事项

### 4.1 范围

覆盖三条第一方链路，但只验证 transport/evidence contract：

- `rewrite`：DeepSeek query-rewrite adapter 的 dispatch、response、usage 边界；
- `qwen`：Qwen embedding adapter 的 dispatch、embedding envelope、usage 边界；
- `final_response`：DeepSeek streaming adapter 的 dispatch、首个 event、terminal、usage 边界。

### 4.2 禁止事项

- T0/T1/T2/T3-A 不读取 `.env`、任何真实 credential 或用户正文；T3-B 若获得独立授权，只能在 durable reservation
  之后 late-bind 三项受控 credential，值不得进入输出或 evidence；
- 不调用 Provider、Docker/API/browser、产品 Chat 或 Trace persistence；
- 不修改 R5/Task 9C 的任何 sealed artifact、marker、journal、tag 或 validator；
- 不 retry/resume/replay/backfill，不执行 seal/recovery，不降低分母或质量门；
- 不保存 raw response、prompt、query、chunk、answer、URL、credential、Zod path/value、unknown key 或
  raw-derived hash；
- 不把 synthetic success、transport ready 或分类成功写成 Provider health、Agent semantic 或产品可用。

## 5. 新 lineage 的最小 contract

### 5.1 固定阶段与边界

每个 observation 只能从下列阶段序列中产生，阶段不能跳跃：

```text
preflight
  -> dispatch_started
  -> response_observed
  -> usage_observed
  -> terminal
```

允许的 `providerBoundary` 只有：

- `not_dispatched`
- `dispatched_no_response`
- `response_observed`
- `response_and_usage_observed`
- `unknown`

`unknown` 是“不足以判别”的终态，不得被映射成任何具体网络根因。

### 5.2 固定诊断 bucket

`reasonCode` 采用固定集合：

`applied | aborted | timeout | dns | tls | proxy | connection_refused | connection_reset |
network_unreachable | http_status | envelope_invalid | schema_invalid | stream_event_invalid |
usage_invalid | unknown`

分类器只能依据注入式 delegate 的 bounded signal 和已验证 wire；不得读取或派生 raw error 文本。

### 5.3 观察权限

Rewrite、Qwen、FinalResponse 各自维持模块私有 WeakMap/WeakSet capability，并绑定：

`callId + phase + family + lineage`

共享模块只能验证私有模块已经签发的 frozen snapshot，不能导出可调用 issuer。forged、active、reused、
cross-call、cross-family、out-of-order 和跨 lineage capability 必须 fail-closed。

### 5.4 数据最小化

每个诊断记录最多包含：

```text
lineage, callId, family, phase, stage, reasonCode,
providerBoundary, runnerWire, providerWire, diagnosticStages,
rawDataRetained=false
```

`callId` 由本地固定 manifest 生成，不由 raw response、prompt 或 credential 派生。输入含未知字段时 strict parser
fail-closed；上游只能把它映射为已有的 `envelope_invalid` 或 `schema_invalid` 固定 bucket，绝不保留字段名或值。

## 6. Zero-provider 验证矩阵

固定基线为 3 个 family × 8 个边界/失败类 = `24` cases，另加 `6` 个竞态/权限 cases，共 `30` cases：

| 类别     | 8 个固定输入                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------- |
| 阶段边界 | `not_dispatched`、`dispatched_no_response`、`response_observed`、`response_and_usage_observed` |
| 受控失败 | `aborted`、`timeout`、`transport_error`、`contract_error`                                      |

其中 `transport_error` 与 `contract_error` 是固定分母中的代表性 runner case；所有 DNS、TLS、proxy、
connection-refused、connection-reset、network-unreachable、envelope、schema、stream event、usage 子类另由
classifier fixture 覆盖，但不增加 runner denominator，也不得把子类成功拼成额外 runtime。

额外 6 个 cases 固定为：

1. parent abort 与 child timeout 同时发生；
2. abort 发生在 dispatch 前后边界；
3. forged capability；
4. reused capability；
5. cross-family/cross-call capability；
6. publication/validator 输入缺字段。

### 6.1 Zero-provider gate

- Provider calls `0`；credential reads `0`；正式 marker/journal/artifact/recovery claim `0`；
- 30/30 cases 都产生可重算的 bounded result，且没有 raw/prompt/credential/user text；
- wire 与 stage sequence 完全匹配，未知类别保持 `unknown`，不能被强制升级；
- R5、Task 9C validator/SHA parity 只读通过；
- 不产生 semantic、P95、verified usage/CNY 或产品 authority。

## 7. T3-A zero-provider admission（已完成）

T3-A 在任何真实调用之前冻结并验证 canary 的入口 contract：

- source admission 绑定 branch、HEAD、upstream、origin、approved source ref、clean tree、formal artifact count=0、
  T2 gate 和固定 source bundle SHA；
- admission 与 reservation 使用两个模块私有 single-consume opaque capability，不能伪造、复制、复用或跨 authority；
- fresh proxy preflight 使用新的 UUID nonce，receipt 只允许 `direct_ready` 或 `loopback_proxy_ready`，且
  `providerCalls=0`；
- CLI gate 顺序固定为 `argv -> source -> T2 -> proxy -> data boundary -> authorization -> runner`，proxy watchdog 为
  `1000ms`；
- zero-provider runner 固定 `rewrite -> qwen -> final_response` 三槽位、最多 3 slots、总预算 `0.024096 CNY`
  （`0.005 + 0.004096 + 0.015`，每个 slot 各一次；不复用 Task 9 的 32-call Qwen cap），首错
  breaker 保留未启动 suffix，所有 Provider/credential/fetch/formal evidence/product/Trace counters 为 0。

T3-A focused `12/12`（49 assertions）、Agent full `1360/1360`（23805 expect()，169 files）、typecheck/lint/Prettier/
`git diff --check` 均通过。详细证据见
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-zero-provider-admission.md`。

## 8. T3-B controlled canary 终态（已执行一次）

用户在新的运行时接受 DeepSeek/Qwen 数据边界并授权一次 T3。唯一 run
`075e2d5f-682b-426d-847e-f5a6ce5b97c6` 在 source commit
`2423baf3768c245d2e4d6ea0038c6fb1bf8f9bc7` 上通过 source/T2/proxy/boundary/approval，随后在 late-bound credential
gate 以 `configuration_invalid` 停止。三个 slot 均未启动，`providerCalls=0`、`credentialReads=0`，breaker reason 为
`configuration`；进程退出后已 crash-only seal，journal `7` 条、validator `ok=true`，report/artifact SHA 记录见
[`T3 controlled canary 验收记录`](../../acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-controlled-canary-failure.md)。

这次失败的 sealed fact 仅是：在 durable reservation 之后、首个 Provider slot 之前，late-bound credential gate 返回了
`configuration_invalid`；三个 slot 均未启动。静态复盘把“受控命令未显式绑定仓库根 `.env`”列为需要修复的
configuration-composition 风险/假设，而不是已由 sealed evidence 唯一证实的根因。不能归因 DNS、TLS、代理、账号、
余额、模型权限或服务端，也不能证明 Provider health 或 Agent 语义。一次性名额已消费，禁止 retry/resume/replay/
backfill、seal/recovery、curl、单 case 或追加 Provider 探测。随后提交 `3d903055` 为受控脚本增加显式
`--env-file=../../.env` 并提供独立 crash-only seal CLI；该修复只能作为未来新 lineage 的入口 guard，不得用于本 run。

T3 形成的 authority 仅为 `controlled_live_transport_evidence_t3`，`qualityAuthority=none`；不解锁产品、Docker/API/
browser、Trace、SLA、main 或 Phase 6.9.8 后续任务。

## 8.1 T3-C configuration composition guard（zero-provider）

T3 失败后新增独立静态 guard，验证 `@repo/agent` controlled package script 的
`bun --env-file=../../.env` 从 package cwd 稳定解析仓库根 `.env`，并验证 crash-only seal CLI 不携带 credential、
`process.env`、fetch 或 Provider port。该 guard 只读取 tracked package/source 文本，不读取实际 `.env`，不执行 controlled
script，不创建 formal evidence。focused `2/2`（10 assertions）、typecheck/lint/`git diff --check` 通过；authority 固定为
`zero_provider_transport_evidence_t3_configuration_guard / qualityAuthority=none`。它只防止配置入口回归，不恢复 T3
一次性名额，也不形成 Provider、semantic、产品或 main authority。

## 9. 实施顺序

1. T0：本 ADR/设计与实施计划，冻结事实、边界、矩阵和停止条件（已完成）；
2. T1：zero-provider strict contract + TDD，复用现有 diagnostic/wire 校验但使用新 lineage namespace（已完成）；
3. T2：30-case robustness、abort/timeout/capability/durability static checkpoint（已完成，
   `transport_evidence_t2_zero_provider_passed`）；
4. T3-A：zero-provider source admission、三槽位 runner 与 CLI gate（已完成，
   `transport_evidence_t3_admission_ready`）；
5. T3-B（已执行并封存）：最多 3-slot transport canary 在 credential configuration gate 失败；单次 durable seal，不能直接进入产品。
6. T3-C（已完成）：zero-provider configuration composition guard，防止 package/root `.env` 入口回归。

每个任务单独提交并推送；T1/T2/T3-A/T3-B/T3-C 完成后同步 AGENTS、DEVLOG、README、roadmap、acceptance checklist、dev-start、
data-flow、AI behavior acceptance 和本设计/计划。T3-B 只在本次精确授权后 late-bind credential；本次名额已消费。

## 10. 通过定义与下一决策

T3-A 的 zero-provider 条件已满足；T3-B 唯一 run 已在 credential configuration gate 失败并 durable seal。该结果不
构成 Provider health、Agent semantic、产品或 main authority，也不提供可重跑的修复窗口。补充的显式根 `.env` 加载
（提交 `3d903055`）只改善未来新 lineage 的入口可审计性，不能恢复本次一次性名额。

Transport Evidence Recovery 当前只允许：读取既有 marker/journal/report/artifact、运行 strict validator、同步文档和
进行 zero-provider 设计审查。禁止 retry/resume/replay/backfill、seal/recovery、curl、单 case 或追加 Provider 探测。
若未来产品路线仍需要真实 Retriever/FinalResponse 语义，必须另立任务并重新定义 source、数据边界、预算、权限和产品
验收；不能从本 T3 失败自动进入 R6、R7/main、Phase 6.9.9/6.9.10/6.10、Phase 8/9 或博客收尾。

## 11. 回顾时可以问

- 为什么 `provider_dispatch` 是阶段事实，不是 DNS/TLS/代理根因？
- 为什么要把 `providerWire` 与 `runnerWire` 分开？
- 为什么 `unknown` 必须保留为终态，不能“尽量猜一个原因”？
- 为什么 T3-A 的 zero-provider cases 通过仍不能把 T3-B 的配置失败写成 Provider 根因？
- 为什么新 lineage 不能复用本次 T3 的 tag、credential、marker、artifact 或授权？
