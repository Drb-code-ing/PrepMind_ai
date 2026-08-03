# Phase 6.9.7 Tutor / WrongQuestionOrganizer V7 R4 Controlled-Live 失败封存

日期：2026-07-28

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

运行前提交：`df5ed8c77946370d46a58b249f43c34715766009`

唯一 run：`81529c2c-79f5-4c21-9cee-e536a2fe78e3`

终态：`quality_gate_failed`

## 1. 结论

用户已接受运行当时 DeepSeek 账号的数据保留/训练边界，并明确授权唯一一次
**Phase 6.9.7 Tutor/Organizer V7 branch controlled-Live**。本次运行已经完成 durability seal，V7
bundle validator 为 `ok=true / filesChecked=1`；一次性名额已经消费，禁止 retry、resume、replay、
backfill、删除、覆盖或改写 marker、journal 与 evidence。

24 条 guard 全部在 Provider 前验证为零调用。第一对 runtime 的 Tutor 与 Organizer 双 lane 都完成
Provider dispatch 并收到 response：Tutor 通过完整 8-stage wire contract，成为
`candidate_applied`；Organizer 的 content 已成功解析为 JSON，但在真实 V6 Organizer Zod contract 的
`provider_type_validation` 阶段失败。Runner 收口当前 pair 后打开 `quality_gate_impossible` breaker，
后续 46 个 runtime 没有启动。

最终四类 wire counter 为 `2 / 2 / 2 / 1`，即 executor、dispatch、response 都是 2，verified usage
只有 Tutor 1 条；strict runtime 为 `1/48`。正式 semantic、P95、token 与 CNY aggregate 按 fail-closed
合同全部为 `null`。因此 V7 R4 失败封存，R5 产品 Docker/API/可见浏览器、R6 main 回放、Task 13、
Phase 6.9.8、Phase 6.10、Phase 8/9 与博客收尾不得开始。

## 2. 运行前授权门与零网络 preflight

运行前重新确认：

- 当前分支为 `codex/phase-6-9-7-tutor-wrong-question-agents`；
- worktree clean，运行前 HEAD 与 remote-tracking ref 都是 `df5ed8c779...`；
- V7 Live marker、journal、evidence 与 recovery claim 均为 0；
- V1--V6 evidence validators 全部 `ok=true / filesChecked=1`；
- V6 evidence/journal/marker physical SHA 分别保持
  `beb9d460...` / `be91b0c4...` / `cbddba87...`；
- V7 runner/durability/CLI/lineage/fault-matrix 最小回归为 `26/26`、`1015` assertions；
- 没有启动产品 Docker service、API 或浏览器，也没有创建 synthetic 用户或修改业务数据。

凭据只在同一个授权 Bun 子进程内，把根 `.env` 中已有的底层 secret 映射为：

- `TUTOR_AGENT_DEEPSEEK_API_KEY`；
- `WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY`。

Key 没有打印、写盘、进入命令参数、evidence、journal、文档或 Git，根 `.env` 没有改写。运行进程只
构造最小配置：

- `PHASE_6_9_7_V7_CONTROLLED_LIVE_APPROVED=true`；
- `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true`；
- Tutor/Organizer 两个独立 gate=true；
- 其它六个受管 Agent gate=false；
- 精确 `https://api.deepseek.com/v1`；
- Tutor/Organizer timeout `3500/5000ms`。

执行器固定 `deepseek-v4-pro`、`deepseek_v4_pro_direct_json`、non-thinking JSON、stream=false、无
tools/retry。Tutor 与 Organizer 分别使用 `1/1200/300`、`1/3500/800` 的 lane-local 预算，总费用
质量门硬上限保持 `0.55 CNY`。执行顺序为：配置解析 -> marker reservation -> journal 初始化并 fsync
-> 24 guard -> sequential pairs（pair 内最多双 lane）-> report/evidence seal -> bundle validator。

## 3. 固定结果

| 项目                                                           | 结果                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| cases / guard / runtime                                        | `72 / 24 / 48`                                                          |
| paired requests / Organizer decisions                          | `24 / 32`                                                               |
| verified guard zero-call                                       | `24/24`                                                                 |
| dispatched / completed pairs                                   | `1 / 1`                                                                 |
| max concurrent pairs / lane operations                         | `1 / 2`                                                                 |
| executor / dispatch / response / verified usage                | `2 / 2 / 2 / 1`                                                         |
| strict runtime                                                 | `1/48`                                                                  |
| breaker                                                        | `quality_gate_impossible`                                               |
| trigger                                                        | `organizer-v2-runtime-01 / wrong_question_organizer / pairedRunIndex=0` |
| critical / provider / permission / mutation / broader fallback | `0 / 1 / 0 / 0 / 0`                                                     |
| semantic / P95 / aggregate token / aggregate CNY               | 全部 `null`                                                             |
| report gate                                                    | `quality_gate_failed`                                                   |

### 3.1 Tutor terminal

`tutor-v2-runtime-01`：

- `executionOutcome=executed_success`；
- `candidateDisposition=candidate_applied`；
- `strictRuntimeSuccess=true`；
- 六个 semantic axes 全部为 `true`；
- model-owned intent 为 `socratic_hint`；
- executor/runtime/orchestration duration 为 `609.2382 / 610 / 614.3804ms`；
- 三个 deadline 均未越界；
- usage 为 `532 input / 8 output / 0.001644 CNY`；
- wire 依次完成 `executor_entered -> request_validated -> provider_dispatch_started ->
provider_response_received -> response_audit_passed -> content_parsed -> schema_validated ->
usage_validated`。

这一条只证明首个 Tutor 样本成功，不代表 24 条 Tutor runtime、正式 P95、整体语义门或产品 Chat
链路已经通过。

### 3.2 Organizer terminal

`organizer-v2-runtime-01`：

- `executionOutcome=executed_failure`；
- `candidateDisposition=fallback_runtime_error`；
- `failureCategory=structured_output`；
- `providerFailureCategory=structured_output`；
- `structuredOutputStage=provider_type_validation`；
- executor/runtime/orchestration duration 为 `1793.5406 / 1794 / 1798.5811ms`；
- 三个 deadline 均未越界；
- `usageDisposition=unknown_after_attempt`，usage=`null`；
- wire 到 `content_parsed` 为止，未进入 `schema_validated` 或 `usage_validated`；
- lane counter 为 `1 executor / 1 dispatch / 1 response / 0 verified usage`。

余下 23 对、46 个 runtime 保留在固定 48 分母中，并以 `not_started_quality_breaker` 表达；没有补跑、
重试或从 R3 Mock、V1--V6 历史结果补齐。

## 4. 为什么正式聚合必须为 null

V7 质量合同要求 `48/48` strict runtime、48 条完整 8-stage wire prefix、48 条 verified usage、两个
lane 的完整 latency 样本，以及 Tutor `21/24` 和 Organizer 三个 model-owned axes 各 `28/32`。本次只有
一条 Tutor strict success，Organizer 首条 contract failure 后即安全熔断，因此：

- metrics `complete=false`，Tutor/Organizer/combined semantic 全为 `null`；
- latency `complete=false`，四项 P95 全为 `null`；
- usage `complete=false`，aggregate input/output token 与 estimated CNY 全为 `null`；
- Tutor model-owned raw count 为 `1/24`，Organizer 三轴均为 `0/32`，不能把未执行项计为正确；
- Tutor 单条 `0.001644 CNY` 是已验证 lane usage，不是本次 Provider 总账单；Organizer usage 未验证，
  因而不能声称总成本等于 Tutor subtotal、等于 0 或已知不超过某个实际账单值。

## 5. 失败根因的证据边界

当前能够确认：

1. 两个 lane 都进入第一方 direct adapter、完成 dispatch 并收到 Provider response；
2. Organizer response 通过 response audit，`message.content` 是可解析 JSON；
3. 解析后的 JSON 值没有通过真实 V6 Organizer Zod schema，故失败在
   `provider_type_validation`，且发生在 5000ms hard timeout 之前；
4. Runner 没有把 Organizer failure 复制给 Tutor，Tutor 独立完成成功 terminal；
5. Evidence、journal 与 marker 不保存 raw response、model output、prompt、header、credential 或原始错误。

V6 Organizer schema 要求严格的 `shortlistFingerprint + decisions` 顶层形状，以及受限的 question、
subject、deck、topic ordinal。缺失或额外字段、fingerprint 不符、decision 数量/重复/越界、非法
subject/deck/topic 组合等都可能落入同一 stage；但当前脱敏证据没有保存原始模型输出，因此不能唯一确认
是哪一种 shape mismatch。

这次结果可以排除“根本没有收到 response”与“只是在运行器外失败”，但不能据此武断归因 API key、
HTTP 状态、网络、endpoint、SDK request shape、某一个具体模型字段或 Provider 内部行为。任何 curl、单
case、另一 CLI 或产品 API 探测都会产生新的 Provider 调用，构成事实上的 retry，故 V7 禁止执行。

## 6. Durability 与证据完整性

`.tmp/` 由 `.gitignore` 忽略，以下 artifact 在本机原路径保留，不清空：

- evidence：`.tmp/phase-6-9-7-tutor-organizer-v7-branch-live-81529c2c-79f5-4c21-9cee-e536a2fe78e3.json`；
- marker：`.tmp/phase-6-9-7-tutor-organizer-v7-controlled-live.marker`；
- journal：`.tmp/phase-6-9-7-tutor-organizer-v7-controlled-live-81529c2c-79f5-4c21-9cee-e536a2fe78e3.journal.jsonl`。

| Artifact                         | SHA-256                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| evidence physical bytes          | `3cf3c077097c474f3a029e0c433e53fba5ee75093adf47f69b06846bbf92bc9f` |
| marker physical bytes            | `e7b9acc0509b6ba299f7a84c63958b05ff9eb3c7620b0743407c61e312f9562d` |
| journal physical bytes           | `1e84d624922b2444edf23847f3d2e547be01f14fa94ff246a291a6a04547d82d` |
| report                           | `18e11c79332d677e7a5f1b1bd7515a1db7f1a120e2192b7309d313fed42cd499` |
| sealed pre-evidence journal tail | `7eb4b58801d2f920ccd195082e17d58f7221b1ce663de90646b99b79e89d689f` |

Journal 共 47 条记录（sequence `0..46`）；envelope 固定 `journalSequence=45`，最后一条 sequence 46 为
`evidence_sealed`，其 `evidenceSha256` 与 physical evidence SHA 一致。Journal physical SHA 与 embedded
tail record hash 是两个不同概念，不能互换。

Marker 的 `state=attempt_reserved` 是一次性 reservation schema 的固定值，不是可变终态字段；真正终态由
envelope `disposition=completed_run`、journal `run_completed + evidence_sealed` 与 bundle validator 共同
证明。未创建 recovery claim。

独立 bundle 复核结果：

```json
{ "ok": true, "filesChecked": 1 }
```

## 7. 允许与禁止的后续动作

允许：

- 提交本次 R4 失败验收与相关当前状态文档，并推送当前功能分支；
- 只读复核已封存的脱敏 evidence、journal、schema、prompt formatter 与 adapter classifier；
- 设计新的独立 zero-provider forensic/remediation 版本，先增加安全 shape reason/fingerprint 与 synthetic
  schema-negative matrix，再经过新的 static/Mock checkpoint；
- 保持产品 gates/defaults 关闭，保留 Docker 容器、镜像、volume、PostgreSQL、Redis 与 MinIO 数据。

禁止：

- 再次执行 V7 Live、对已完成 run 执行 seal、修改 marker、删除/覆盖 evidence 或使用 recovery replay；
- 通过手工 curl、单 case、另一 CLI 或产品 API 探测同一 Provider 路径；
- 启动 V7 R5 产品 Docker/API/可见浏览器验收；
- 执行 R6/main 合并，开始 Task 13、Phase 6.9.8、Phase 6.10、Phase 8/9 或博客收尾；
- 把 R3 Mock `1/1/1`、本次 24/24 guard 或首个 Tutor success 拼接成两个 Agent 已真实可用。

如果继续推进，下一原子任务只能先做新的独立、zero-provider R0 根因复盘与版本化 remediation 设计。
必须冻结本次 stage/counter/SHA，保持 V7 不可重跑，并为未来任何新 Live 使用新的 runner、approval、
marker、journal 与 evidence identity；本记录不授权后续 Provider 调用。

## 8. 回顾时可以问

- “为什么 `content_parsed` 仍不能证明 Organizer 输出符合业务 schema？”
- “为什么首个 Tutor 成功不能覆盖 Organizer failure 或剩余 46 个未执行 runtime？”
- “四类 wire counter `2/2/2/1` 分别证明什么？”
- “为什么 Tutor 的 `0.001644 CNY` 不能当作本轮总费用？”
- “为什么 validator 通过只证明证据完整，不证明质量门通过？”
- “为什么 V7 失败后必须新建独立 zero-provider remediation，而不能补跑一个 Organizer case？”
