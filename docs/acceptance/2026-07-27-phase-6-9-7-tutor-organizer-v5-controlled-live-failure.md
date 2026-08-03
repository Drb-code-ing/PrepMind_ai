# Phase 6.9.7 Tutor / WrongQuestionOrganizer V5 R6 Controlled-Live 失败封存

日期：2026-07-27

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

R5 checkpoint：`d8fb9965`

## 1. 结论

用户接受当前 DeepSeek 账号的数据保留/训练边界，并明确授权唯一一次 V5 branch
controlled-Live。唯一 run `aa637d3a-f7c4-4549-a724-9cdbefdd89c8` 使用
`deepseek-v4-pro` non-thinking JSON 与 `deepseek_network` provenance 完成并 durable seal，最终为
`quality_gate_failed`。

24 个 guard 全部通过且真实 zero-call。Runner 顺序完成前 6 个 paired requests，共启动 12 次
Provider invocation；其中 11 个 runtime strict success。第 6 对的 Tutor
`tutor-v2-runtime-06` 在 `3021ms` 返回 `runtime_timeout`，越过冻结的 `3000ms` timeout，触发
`quality_gate_impossible` breaker。同对 Organizer 已在 `2224ms` strict success；其余 36 个 runtime
固定保留在 48 分母内并记录为 `not_started_quality_breaker`，没有补跑、重试、resume 或 replay。

V5 R6 已失败封存且不得重跑。R7 产品 Docker/API/可见浏览器、R8 分支收尾与 main 回放、Task 13、
Phase 6.10、Phase 8/9 与博客收尾均不得开始。Phase 6.9.7 和两个 Agent 的生产验收仍未完成，
tracked 产品 gates 保持默认关闭。

## 2. Live 实现与前置门

R6 在唯一运行前补齐并验证了真实 Live 边界：

- V5 CLI 默认创建 DeepSeek V4 Pro non-thinking executor，不再依赖测试 factory；
- Live 配置在 marker 前 fail-closed，executor 只在 marker 与 journal 初始化持久化后创建；
- 默认真实路径固定 `executorProvenance=deepseek_network`；注入式测试路径固定
  `synthetic_test`，不能成为质量 authority；
- marker、harness、report 和 evidence validator 强制 provenance 一致；
- component credential、双 gate、HTTPS URL、timeout、24 guard zero-call、single-call/no-retry、
  schema/provider/usage/abort 与 prompt 泄漏均有静态回归。

Live 前后受影响静态结果：

| 门                             | 结果                       |
| ------------------------------ | -------------------------- |
| V5 focused                     | `78/78`，`1961 expect()`   |
| Agent full                     | `753/753`，`9260 expect()` |
| AI full                        | `199/199`，`1054 expect()` |
| Agent / AI typecheck、lint     | 全部 exit `0`              |
| CodeGraph                      | 当前源码已同步             |
| 独立复审                       | 无 P0/P1                   |
| V1 / V2 / V3 / V4 evidence SHA | 与 R5 全部一致             |

根 `.env` 的通用 DeepSeek credential 只在本次授权进程内映射为 Tutor/Organizer 两个
component-specific 变量；密钥未打印、未写入源码、文档、artifact 或 Git。临时无密钥 launcher 已在
运行后删除。Live 进程使用：

- `AI_PROVIDER_MODE=live`、`AI_ENABLE_LIVE_CALLS=true`；
- Tutor/Organizer 两个目标 gate 为 `true`，其它 Agent gate 不参与；
- `https://api.deepseek.com/v1`、`deepseek-v4-pro`、non-thinking JSON；
- Tutor `3000ms / 1-1200-300`；Organizer `5000ms / 1-3500-800`；
- 无 tools、无 retry，组件 key 不进入 marker、journal 或 evidence。

## 3. 唯一 Live 结果

### 3.1 执行与安全

| 指标                      | 结果                                                                |
| ------------------------- | ------------------------------------------------------------------- |
| run / scope / disposition | `aa637d3a-f7c4-4549-a724-9cdbefdd89c8` / `branch` / `completed_run` |
| guard                     | `24/24` verified zero-call                                          |
| paired scheduler          | `6 dispatched / 6 completed`，双 lane 最大并发 `2`                  |
| Provider invocation       | `12` started，`11` usage verified，`1` usage unknown                |
| strict runtime            | `11/48`：Tutor `5`、Organizer `6`                                   |
| breaker                   | `quality_gate_impossible`，trigger `tutor-v2-runtime-06` / pair `5` |
| timeout                   | Tutor `3021ms > 3000ms`，`runtime_timeout`                          |
| 后续未执行                | `36` runtime，全部 `not_started_quality_breaker`                    |
| safety                    | critical / permission / mutation / broader fallback 均 `0`          |
| Provider failure          | `0`；timeout entry 的 provider category 为 `null`                   |

第 6 对 Organizer 已成功形成 strict canonical result，Tutor 则在本地冻结 timeout 边界收口为
`fallback_timeout / unknown_after_attempt`。该终态不冒充 Provider error、zero-call、成功或零成本；也
不能因为只超出 `21ms` 就改写 frozen timeout 或重跑同一 run。

### 3.2 正式聚合与只读诊断 subtotal

报告固定 48 个 runtime 分母，但只有 11 个 strict result，故 authority 字段必须保持：

- `metrics.complete=false`，Tutor / Organizer / combined semantic 均为 `null`；
- `latency.complete=false`，Tutor / Organizer / paired / orchestration P95 均为 `null`；
- `usage.complete=false`，provider invocations 为 `12`、verified runtime 为 `11`，但 aggregate input、
  output 与 estimated CNY 均为 `null`；
- 最终 gate 为 `quality_gate_failed`。

为后续零 Provider 复盘，可从 11 个已验证 case entry 独立重算以下 subtotal；这些数值不是正式聚合、
不能与 48-case threshold 比较，也不能与 Mock/历史 run 拼接：

- verified usage subtotal：input `9761`、output `902`、estimated `0.034695 CNY`；
- 已执行 Tutor 5 条的 axis mean 为 `0.9`，其中 depth `2/5`，其它五个轴均 `5/5`；
- 已执行 Organizer 6 条的 axis mean 为 `0.7083333333`，subject/deck `6/6`、topic `5/6`、
  confidence `0/6`。

这些局部结果只说明下一版复盘应同时检查 Tutor tail latency/depth 与 Organizer confidence/topic；它们
不证明 V5 已达到语义质量门或生产可用。

## 4. Durable evidence

| artifact    | SHA-256                                                            |
| ----------- | ------------------------------------------------------------------ |
| V5 evidence | `84487b448acd7bd5e65cd523eb7556cd9b3175bc9ba44572e06a78157c45b70a` |
| V5 journal  | `a8b8bcbfbbce9b5d8e62919edf24c71d2440cd94c74737d01fccb5c6204e8506` |
| V5 marker   | `c3a3eb063677303591b858f0667c94bd8d30f993cf060736e54f1bf3b18c9e75` |

Evidence 路径：
`.tmp/phase-6-9-7-tutor-organizer-v5-branch-live-aa637d3a-f7c4-4549-a724-9cdbefdd89c8.json`。

Journal 共 58 条 hash-chain records：

- `journal_initialized=1`、`guard_terminal=24`；
- `dispatch_started=12`、`runtime_terminal=12`、`pair_terminal=6`；
- `breaker_opened=1`、`run_completed=1`、`evidence_sealed=1`。

Evidence validator 返回 `{"ok":true,"filesChecked":1}`。最后一条 journal record 是
`evidence_sealed(completed_run)`，绑定 evidence SHA 与 seal 前 journal tail；不存在 recovery claim。
V1--V4 evidence SHA 与四版 validator 均保持不变：

- V1 `be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5`；
- V2 `0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77`；
- V3 `e24f4e6dd6fc0d0621eee672210b86fe8fbf5dce4664b1184726319b8e22d25c`；
- V4 `6ec60be1fced72766253e237b892fabb8e1d4ceca555249593d693f5e2d94608`。

## 5. 没有执行的产品步骤

本轮没有启动、重建或停止产品 Docker service，没有调用认证产品 API、打开浏览器、创建 synthetic
用户/错题/deck/Trace/session，也没有修改 PostgreSQL、Redis 或 MinIO 业务数据。特别没有执行
`docker compose down -v`、Docker prune、volume/container/image 删除、database reset、Redis flush
或 MinIO wipe。

R6 的进程级 Live/gate/component credential 随进程退出，不改变 tracked default-off 配置。失败结果
不允许临时启用 Tutor/Organizer 产品 gate，也不允许以 deterministic fallback 可用为理由进入 R7。

## 6. 后续边界

V5 R6 的一次性名额已经消费。下一步只能先做零 Provider 复盘并设计与 V1--V5 双向隔离的新版本，
至少回答：

1. Tutor 第 6 条为何越过冻结 3000ms，是 Provider tail latency、客户端计时/取消边界还是 timeout
   policy 与真实链路不匹配；
2. Tutor 已执行样本的 depth 与 Organizer confidence/topic 为什么仍不稳定；
3. 如何在不改写 V2 dataset/expected/threshold、不重用 V5 marker/evidence、不针对 Live case
   过拟合的前提下增加独立 held-out 证据。

用户已允许新版本基于上述复盘重新评估 Tutor 时延边界。该许可不改变 V5 的失败结论，不允许重跑
V5，也不放宽安全、权限、固定分母、无重试或 durable evidence 不可变性；它本身不是新的 Provider
调用授权。

新版本必须有新的 dataset/policy 变更说明（如有）、runner、授权、marker、journal、evidence 与 validator
identity，并先完成新的 static/Mock checkpoint；再次调用 Provider 仍需用户新的数据边界确认与精确
授权。当前不得开始产品验收、main 合并、Phase 6.10 或两篇面试学习博客收尾。

回顾时可以问：

- “V5 为什么只超时 21ms 也必须失败封存，而不能原 run 重试？”
- “为什么 11 条 usage 能算诊断 subtotal，正式 token/费用仍必须是 null？”
- “为什么 Organizer 第 6 条成功后，runner 仍在 Tutor timeout 打开 breaker？”
- “V5 failure seal 怎样证明 guard zero-call、dispatch-before-call、固定分母和未重试？”
