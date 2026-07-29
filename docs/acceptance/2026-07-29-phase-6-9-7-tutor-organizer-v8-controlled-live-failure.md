# Phase 6.9.7 Tutor / WrongQuestionOrganizer V8 R5 Controlled-Live 失败封存

日期：2026-07-29

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

运行前提交：`b487ffe859ff75e5b8375791045da9ef21ddc9de`

唯一 run：`7ff09c36-50f2-445a-b309-dc9500e5e13c`

终态：`quality_gate_failed`

## 1. 结论

用户在 R4 收口后明确“继续，提供所有授权”。该回复按紧邻的授权提示记录为：用户接受本次运行时
DeepSeek 当前账号的数据保留/训练边界，并授权唯一一次 **Phase 6.9.7 Tutor/Organizer V8 branch
controlled-Live**。本次运行已经完成 durability seal，V8 bundle validator 为
`ok=true / filesChecked=1`；一次性名额已经消费，禁止 retry、resume、replay、backfill、额外 Provider
探测，以及删除、覆盖或改写 marker、journal、evidence。

24 条 guard 全部在 Provider 前验证为零调用。Runner 执行前两对 runtime，共 4 次 executor invocation、
4 次 Provider dispatch、4 次 response 和 4 次 wire-level verified usage。两个 Tutor runtime 与第一条
Organizer runtime 成为 `candidate_applied`；第二条 Organizer runtime 已完成完整 8-stage wire、原生 JSON
解析、V8 fixed-shape schema 与 usage 校验，但在本地动态 shortlist authority 校验中成为
`fallback_schema_invalid / dynamic_contract`。Bounded diagnostic 只记录
`reason=dynamic_authority` 与固定 shape 元数据，不保存模型原始 ordinal 或题目内容。

Runner 收口第二对后打开 `quality_gate_impossible` breaker，后续 44 个 runtime 没有启动。最终 strict
runtime 为 `3/48`，正式 semantic、P95、aggregate token 与 CNY 全部按 fail-closed 合同为 `null`。V8
R5 因此失败封存，R6 产品 Docker/API/可见浏览器、R7 main 回放、Phase 6.9.8、Phase 6.10、Phase 8/9
与博客收尾均不得开始。

## 2. 运行前授权门与零 Provider preflight

运行前确认：

- 当前分支为 `codex/phase-6-9-7-tutor-wrong-question-agents`；
- worktree clean，HEAD、remote-tracking ref 与 GitHub remote 都是 `b487ffe859...`；
- V8 Live marker、journal、evidence 与 recovery claim 均为 0；
- V1--V7 七份 sealed evidence validator 全部 `ok=true / filesChecked=1`；
- Agent full 为 `907/907`、`13728` assertions；Agent/AI typecheck 与 lint 均通过；
- R4 committed source、tracked defaults 与 Compose default-off 没有工作区漂移；
- 没有启动产品 Docker service、API 或浏览器，没有创建 synthetic 用户或修改业务数据。

根环境只有既有通用 `DEEPSEEK_API_KEY`，两个 component credential 没有持久化值。授权 launcher 只在同一
Bun 子进程内把底层 secret 映射为 `TUTOR_AGENT_DEEPSEEK_API_KEY` 与
`WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY`。Key 没有打印、写盘、进入命令参数、evidence、
journal、文档或 Git，根 `.env` 没有改写。

运行进程只构造最小配置：

- `PHASE_6_9_7_V8_CONTROLLED_LIVE_APPROVED=true`；
- `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true`；
- Tutor/Organizer 两个独立 gate=true，其它六个受管 Agent gate=false；
- 精确 `https://api.deepseek.com/v1`；
- Tutor/Organizer timeout `3500/5000ms`；
- `deepseek-v4-pro`、non-thinking JSON、`stream=false`、无 tools/retry；
- Tutor 与 Organizer 分别使用 `1/1200/300`、`1/3500/800` lane-local 预算，总费用质量门硬上限
  `0.55 CNY`。

第一次宿主启动命令把 PowerShell Bun shim 交给 `Start-Process`，在创建 Bun 进程前返回
`%1 is not a valid Win32 application`，PID 为 `null`。随即物理复核 V8 artifact 仍为 0，因此该宿主启动
错误没有进入 CLI、没有 reserve marker、没有 Provider 调用，也没有消费一次性名额。之后只改用已验证
的 `bun.exe` 启动上述唯一 run；这不是 Live retry。

## 3. 固定结果

| 项目                                                           | 结果                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| cases / guard / runtime                                        | `72 / 24 / 48`                                                          |
| paired requests / Organizer decisions                          | `24 / 32`                                                               |
| verified guard zero-call                                       | `24/24`                                                                 |
| dispatched / completed pairs                                   | `2 / 2`                                                                 |
| max concurrent pairs / lane operations                         | `1 / 2`                                                                 |
| executor / dispatch / response / verified usage                | `4 / 4 / 4 / 4`                                                         |
| strict runtime                                                 | `3/48`                                                                  |
| breaker                                                        | `quality_gate_impossible`                                               |
| trigger                                                        | `organizer-v2-runtime-02 / wrong_question_organizer / pairedRunIndex=1` |
| critical / provider / permission / mutation / broader fallback | `0 / 0 / 0 / 0 / 0`                                                     |
| semantic / P95 / aggregate token / aggregate CNY               | 全部 `null`                                                             |
| report gate                                                    | `quality_gate_failed`                                                   |

### 3.1 第一对：两个 lane 均成功

`tutor-v2-runtime-01`：

- `candidate_applied`、strict success，六个 semantic axes 全部为 `true`；
- model-owned intent 为 `socratic_hint`；
- executor/runtime/orchestration 为 `1057.8054 / 1060 / 1065.1599ms`，均未越界；
- usage 为 `532 input / 7 output / 0.001638 CNY`；
- 完成完整 8-stage wire。

`organizer-v2-runtime-01`：

- `candidate_applied`、strict success，subject/deck/topic/confidence 四轴全部为 `true`；
- executor/runtime/orchestration 为 `2481.9947 / 2482 / 2494.1056ms`，均未越界；
- usage 为 `501 input / 94 output / 0.002067 CNY`；
- 完成完整 8-stage wire。

### 3.2 第二对：Tutor 成功，Organizer 动态权限失败

`tutor-v2-runtime-02`：

- `candidate_applied`、strict success，六个 semantic axes 全部为 `true`；
- model-owned intent 为 `socratic_hint`；
- executor/runtime/orchestration 为 `1517.3342 / 1517 / 1520.4242ms`，均未越界；
- usage 为 `529 input / 8 output / 0.001635 CNY`；
- 完成完整 8-stage wire。

`organizer-v2-runtime-02`：

- `executionOutcome=executed_failure`；
- `candidateDisposition=fallback_schema_invalid`；
- `failureCategory=dynamic_contract`，不是 Provider/transport failure；
- executor/runtime/orchestration 为 `2833.4083 / 2834 / 2838.4687ms`，均未越界；
- wire 已完成到 `schema_validated -> usage_validated`，lane counter 为 `1/1/1/1`；
- candidate usage 按失败合同为 `unknown_after_attempt / null`；
- bounded diagnostic 为 `dynamic_authority`、`plain_object`、decision bucket `one`、missing/extra/type
  count 均为 0、`rawDataRetained=false`。

其余 22 对、44 个 runtime 保留在固定 48 分母中，并以 `not_started_quality_breaker` 表达；没有补跑、
重试或从 R4 Mock、V1--V7 历史结果补齐。

## 4. V8 修复了什么、仍失败在哪里

V7 Organizer 在 `content_parsed -> provider_type_validation` 失败，无法确认模型是否遵守旧 nested union。
V8 R1--R4 把输出收敛为固定四字段并增加 Provider-like negative matrix。本次四条真实调用都完成
`schema_validated + usage_validated`，证明 fixed-shape transport/schema remediation 实际生效，而不是只在
Mock 中成立。

失败已经移动到本地动态权限层：第二条 Organizer 输出虽然静态 shape 合法，但没有通过当前 owner
snapshot 派生的 shortlist authority。内部可能原因集合包括 fingerprint、question coverage、重复或越界
question、subject authority、eligible deck action、deck/topic ordinal 与 cross-subject 关系。Sealed evidence
故意只保留统一 `dynamic_authority`，没有保存内部 reason code 或原始 ordinal，因此不能唯一断言是哪一种。

后续若继续，不应再次扩写自由组合字段提示词。更稳健的方向是由本地先枚举每题全部合法
`subject/deck/topic` 组合，让模型只返回 `questionIndex + optionIndex`；本地再把 option 映射回真实决策并
继续执行 fingerprint、双 stale fence、locked-name、confidence 和 write authority。这样模型仍负责语义
选择，但不能构造 shortlist 外的权限组合。该方向必须进入新的独立 zero-provider lineage，先设计、TDD、
held-out/Mock，再申请任何新的 Provider 授权。

## 5. 为什么正式聚合必须为 null

V8 质量合同要求 `48/48` strict runtime、48 条完整 wire/verified usage、两个 lane 的完整 latency 样本、
Tutor `21/24` 与 Organizer 三个 model-owned axes 各 `28/32`。本次只有 3 条 strict success，并在第二对
打开 breaker，因此：

- metrics `complete=false`，Tutor/Organizer/combined semantic 全为 `null`；
- latency `complete=false`，四项 P95 全为 `null`；
- usage `complete=false`，aggregate input/output token 与 estimated CNY 全为 `null`；
- 固定分母 model-owned raw count 为 Tutor `2/24`，Organizer 三轴各 `1/32`，不能把未执行项计为正确；
- 三条成功 lane 的单条 usage 不是本轮总账单；第四条 wire usage 虽已验证，但 candidate failure 没有向
  aggregate 暴露 token，因此不能声称总费用等于成功 subtotal、等于 0 或是某个已知账单值。

## 6. Durability 与证据完整性

`.tmp/` 由 `.gitignore` 忽略，以下 artifact 在本机原路径保留，不清空：

- evidence：`.tmp/phase-6-9-7-tutor-organizer-v8-branch-live-7ff09c36-50f2-445a-b309-dc9500e5e13c.json`；
- marker：`.tmp/phase-6-9-7-tutor-organizer-v8-controlled-live.marker`；
- journal：`.tmp/phase-6-9-7-tutor-organizer-v8-controlled-live-7ff09c36-50f2-445a-b309-dc9500e5e13c.journal.jsonl`。

| Artifact                         | SHA-256                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| evidence physical bytes          | `377b82a7ea8c1bbeea69208df422affdb99bfafd15acf0a14857712658971a85` |
| marker physical bytes            | `85caaa575d77475ea12f0dba225c2fe7e7a1b9cc23454588e994eeb5d8ba5da7` |
| journal physical bytes           | `3caaa82de75366fa3929713e988235c47b41b672427ecfe3b7399a656acfefda` |
| report                           | `ec791b742bcc0af90114bf951869eaef43107bdb082762415ed1ed544f3dce9e` |
| sealed pre-evidence journal tail | `159e8a5c84d647bc62c01a5816d307a3717bfaae40aea470d2262f0edd0332b0` |
| final journal record             | `a7ba6e2ecd1a84f38b1a0f9b84c330e0e6db834cdc96567a3beee5d728d88f14` |

Journal 共 70 条记录（sequence `0..69`）；envelope 固定 `journalSequence=68`，最后一条 sequence 69 为
`evidence_sealed`，其 `evidenceSha256` 与 physical evidence SHA 一致。Journal physical SHA、embedded
pre-evidence tail 与最终 record hash 是三个不同概念，不能互换。未创建 recovery claim。

独立 bundle 复核结果：

```json
{ "ok": true, "filesChecked": 1 }
```

## 7. 允许与禁止的后续动作

允许：

- 提交本次 R5 失败验收与当前状态文档，并推送当前功能分支；
- 只读复核 V8 脱敏 evidence、journal、fixed-shape schema、dynamic validator 与本地 shortlist；
- 建立新的独立 zero-provider R0，冻结 option-index authority、细分但不含 raw value 的 bounded reason、
  held-out/metamorphic/anti-overfit 与新 lineage 路线；
- 保持产品 gates/defaults 关闭，保留 Docker 容器、镜像、volume、PostgreSQL、Redis 与 MinIO 数据。

禁止：

- 再次执行 V8 Live、对已完成 run 执行 seal/recovery、修改 marker，或删除/覆盖 evidence/journal；
- 通过 curl、单 case、另一 CLI 或产品 API 探测同一 Provider 路径；
- 启动 V8 R6 产品 Docker/API/可见浏览器验收或执行 R7/main 合并；
- 开始 Phase 6.9.8、Phase 6.10、Phase 8/9 或博客收尾；
- 把 R4 Mock `1/1/1`、本次 `24/24` guard、三条 success 或完整 `4/4/4/4` wire 拼接成两个 Agent
  已真实可用。

## 8. 回顾时可以问

- “V8 相比 V7 真正修复了什么，为什么仍然失败？”
- “为什么完整 8-stage wire 不等于本地 dynamic authority 通过？”
- “`dynamic_authority` 能确认什么，为什么不能猜具体 ordinal？”
- “为什么 `3/48` strict success 后 semantic、P95、token 和 CNY 仍必须为 null？”
- “为什么宿主 Bun shim 启动失败不算 Live retry？”
- “为什么下一版应让模型选择本地合法 option，而不是继续自由拼 subject/deck/topic 字段？”
