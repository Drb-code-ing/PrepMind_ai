# Phase 6.9.7 Tutor / WrongQuestionOrganizer V9 R4 Static/Mock Checkpoint

日期：2026-07-29

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

checkpoint 起点：`a88ff533`

## 1. 结论

V9 R4 reviewed Mock/full checkpoint 已完成，结论严格限定为 **zero-provider 工程验收通过**。

正式源码现在提供 V9 reviewed Mock factory。默认 V9 Mock CLI 让 Tutor 穿过未修改的正式 V6
candidate 链，让 WrongQuestionOrganizer 穿过 V9 本地合法 option authority、exact
`questionIndex + optionIndex` selection candidate、V6 validator/merger 与第一方 direct adapter；只有
adapter 的 `fetch` delegate 是进程内 synthetic responder。fresh deterministic baseline、reviewed Mock、
Provider-like/selection fault matrix、全量静态门、Organizer PostgreSQL 并发 E2E、Compose default-off、
历史 evidence validators、精确残留检查与两路独立终审均已通过。

本 checkpoint 没有读取根 `.env` 或任何 credential，没有调用 DeepSeek 或其它 Provider，没有启动产品
Web/Server/Worker/Admin/MinIO、调用产品 API 或打开浏览器，也没有修改业务数据。Mock 满分只表示当前
候选、schema、local authority、runner 与证据合同在合成输入下闭合；它不证明真实模型语义质量、真实
Provider P95/usage/费用或产品可用性。

V9 R0--R4 已完成。下一原子任务只能是 R5 新的精确一次性 V9 branch controlled-Live 授权门；R6 产品
Docker/API/可见浏览器、R7/main、Phase 6.9.8、Phase 6.10、Phase 8/9 与两篇面试学习博客继续阻断。

## 2. R4 实现

- 主要实现：
  `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v9-runtime.ts`、
  `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v9-mock.ts` 与
  `packages/agent/scripts/phase-6-9-7-tutor-wrong-question-v9-cli.ts`；
- 主要回归：
  `packages/agent/tests/phase-6-9-tutor-organizer-v9-mock.test.ts`、
  `packages/agent/tests/phase-6-9-tutor-organizer-v9-fault-matrix.test.ts` 与
  `packages/agent/tests/phase-6-9-tutor-organizer-v9-cli.test.ts`；
- 新增公开子路径 `@repo/agent/phase-6-9-7-v9-mock`、V9 evaluation runtime 与 reviewed Mock factory；
- V9 CLI 的 `mock` 模式默认注入 reviewed factory；`live` 没有显式 R5 factory 时继续返回
  `live_runtime_unavailable_until_r5`，不会创建一次性 marker；
- Tutor 复用 V7 Mock 已验证的正式 V6 Tutor candidate、prompt、strict schema、local merger 与 direct
  adapter 路径，没有为 R4 另造较宽松候选；
- Organizer 从冻结 V2 runtime case 重建本地 shortlist，经 V9 option builder/projection 与 exact
  selection schema，再由本地注入 fingerprint 并执行 V6 validator/merger；模型侧仍不接触真实 ID、
  owner、locked name、confidence、write command 或 stale/write authority；
- synthetic responder 只解析实际 bounded system/user prompt，按 prompt 中的 option 生成
  `{decisions:[{questionIndex,optionIndex}]}`；源码扫描和测试固定禁止读取 expected/oracle 或调用生产
  validator/builder 生成答案；
- 24 条 guard 不构造 runtime，48 条 runtime 每 lane 最多一次 executor/dispatch，无 retry、resume、
  replay 或 backfill；
- reviewed Mock factory identity：
  `sha256:e0918cbfa23ee4463c569f49db69b026d97f47597ab7cf9621579bf10465bf08`。

## 3. Fresh deterministic baseline

- dataset：冻结的 V2 72-case dataset；
- 完整 runtime：`12/48`；
- Tutor semantic：`0.6629642857142858`；
- Organizer semantic：`0.278125`；
- combined semantic：`0.4705446428571429`；
- Provider invocation / token / cost：`0 / 0 / 0 CNY`。

这是未修饰的本地 deterministic baseline。R4 没有修改 dataset、expected、baseline、semantic policy、
threshold、预算、timeout 或失败 case。

## 4. Fresh V9 reviewed Mock

- run ID：`f039a7d2-c3b2-4286-9630-fee49d365a33`；
- 固定分母：`72 cases / 24 guard / 48 runtime / 24 paired requests / 32 Organizer decisions`；
- 每个 paired request 固定包含一条 Tutor lane 与一条 Organizer lane，因此 24 pair 对应 48 runtime；
- guard：`24/24` verified zero-call；
- strict runtime：`48/48`；
- wire：executor / dispatch / response / verified usage 为 `48/48/48/48`；
- Tutor / Organizer / combined semantic：`1 / 1 / 1`；
- synthetic usage：`17732 / 504`；
- Mock estimated cost：`0.05622 CNY`；
- latency evidence：完整并通过冻结上限（Tutor candidate `2500ms`、Organizer candidate `4500ms`、paired
  candidate `4500ms`、Tutor orchestration `6500ms`）；Mock evidence 已按设计删除，因此本 checkpoint 不把
  当次非权威具体 P95 数值另存为 durable authority；
- gate：`mock_quality_not_evidence`；
- V9 bundle validator：`ok=true / filesChecked=1`。

这里的 48 次 dispatch/response 与 token/CNY 都是 synthetic fetch 产生的 Mock telemetry，不是真实
DeepSeek 请求、账单或网络时延。`filesChecked=1` 是 validator 对当时唯一临时 Mock evidence 的校验结果；
校验完成后该文件已按精确 run path 删除。因此 R4 结束时正式 V9 marker、journal、evidence 与 recovery
claim 均为 `0`，两者不矛盾。

## 5. Fault matrix 与安全边界

R4 fault matrix 直接复用 reviewed factory，而不是只向 runner 注入理想化结果。它覆盖：

- fetch 同步抛错/异步拒绝、HTTP auth/rate-limit/client/server、异常 status、空响应、畸形 JSON；
- reasoning content/positive reasoning tokens、缺失或畸形 completion、schema mismatch；
- usage missing/zero/negative/fractional/overflow；
- selection wrapper、额外字段、numeric string、缺 option、重复 question、question/option 越界；
- first/middle/last breaker、固定 48 分母、single dispatch/no retry/no backfill；
- cooperative 与 ignored sibling abort 的 lane-local bounded settlement。

Transport/HTTP/response/schema/usage failure 均投影到真实 8-stage wire prefix 与固定私有 category；
selection static/dynamic failure 只保留 bounded reason 和 `rawDataRetained=false`。报告不保留 synthetic
credential、raw response、prompt、model output、真实映射、未知字段正文或错误正文。

## 6. 全量验证证据

| 范围                            | 结果                                                   |
| ------------------------------- | ------------------------------------------------------ |
| R4 focused                      | `12/12`，`1717 assertions`                             |
| V9 full                         | `62/62`，`2430 assertions`                             |
| Agent full                      | `969/969`，`16228 assertions`                          |
| Agent typecheck / lint          | 通过 / 通过                                            |
| AI full                         | `226/226`                                              |
| AI typecheck / lint             | 通过 / 通过                                            |
| Types tests / typecheck         | `42/42` / 通过                                         |
| Web full                        | `439/439`                                              |
| Web lint / production build     | 通过 / 通过；17 个页面生成                             |
| Server no-database suites       | `226 suites / 2153 tests`                              |
| Server PostgreSQL integration   | `1/1`；合计 `227 suites / 2154 tests / 30 skipped`     |
| Server readiness CLI            | `9/9`                                                  |
| Server lint / build             | 通过 / 通过                                            |
| Organizer PostgreSQL E2E        | `12/12`                                                |
| Docker boundary/static contract | `3/3`，`phase-6-9-7-docker-runtime-boundaries.spec.ts` |
| Compose tracked default-off     | `config --quiet` 通过                                  |
| 合成测试账号残留                | `0`                                                    |

初始高并发全量验证曾出现三类环境噪声：3 个历史 Agent 5 秒 timeout、Web
`VirtualAlloc/ENOMEM`、Server readiness 子进程异常。保持产品 timeout 与历史合同不变后，改用低并发
串行重跑，以上门全部通过。Organizer PostgreSQL E2E 第一次只启动 PostgreSQL、Redis 停止，Nest/
BullMQ 持续重连导致测试进程超时；恢复既有 `docker-postgres-1` 与 `docker-redis-1` 后 `12/12` 通过。
没有重建、删除、prune 或清卷，也没有启动其它产品容器。

## 7. 历史不可变性与独立终审

- Phase 6.9.6 bundle validator：`ok=true / evidenceCount=4`；
- Phase 6.9.7 V1--V8 sealed bundle validators：八版均 `ok=true / filesChecked=1`；
- 没有修改、删除、重命名、seal、recover 或拼接 V1--V8 marker/journal/evidence；
- V9 Mock evidence 已精确删除，正式 V9 artifact 为 0；
- contract/security/code 终审：APPROVED，无 Critical/Important/Minor；
- test/fault-matrix/operations 终审：APPROVED，无 Critical/Important。

## 8. 明确未完成

- 没有执行 V9 controlled-Live，没有真实模型 semantic、Provider network P95、真实 usage 或账单证据；
- 没有把 V9 candidate 作为新的产品 production authority；现有 Tutor/Organizer 产品 gate 仍默认关闭；
- 没有启动 authenticated Docker API 或可见 `/chat`、`/error-book` 浏览器验收；
- 没有合并或推送 main，也没有执行 main default-off replay；
- 没有完成 Phase 6.9.7、Phase 6 全部 Agent、可执行 LangGraph 或 Phase 6.10 分层记忆；
- 没有开始 Phase 6.9.8/6.9.9/6.9.10、Phase 8/9 或《多 Agent 架构》《记忆系统》博客收尾。

## 9. 停止条件与下一步

R4 必须先 clean commit、推送当前功能分支，并核对 local/tracking/remote SHA 一致。之后仍须停止在 R5
授权门前。只有用户在运行当时重新接受 DeepSeek 当前账号的数据保留/训练边界，并明确授权唯一一次
Phase 6.9.7 Tutor/Organizer V9 branch controlled-Live，才允许进入 R5。普通“继续”“好的”“所有权限”
或任何 V1--V8 历史授权都不能替代该精确授权。

可以这样回顾：

- “为什么 V9 Mock semantic `1/1/1` 仍不能证明真实模型可用？”
- “V9 如何把 Organizer 从自由组合 subject/action/target 收敛为本地 option selection？”
- “怎样证明 synthetic responder 只读实际 bounded prompt，没有读取 expected/oracle？”
- “为什么 R4 结束后 V9 artifact 必须为 0？”
- “R5 前 local/tracking/remote、历史 validators 与哪些 gate 必须再次核对？”
