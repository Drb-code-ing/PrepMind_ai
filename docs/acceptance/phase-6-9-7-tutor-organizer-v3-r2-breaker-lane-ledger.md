# Phase 6.9.7 Tutor / Organizer V3 R2 Breaker 与双 Lane Ledger 验收

日期：2026-07-25

状态：R2 已完成；本轮严格停止在 R3 前。

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 目标与必要性

V1/V2 paired runner 会在 runtime 已经不可能满足固定 `48/48 strict success` 后继续派发后续
Provider 调用。V2 因而形成了 48-call failure storm；同时，未执行、已尝试但 usage 未知、同 pair
sibling abort 与本地 harness failure 缺少独立终态，低样本 P95 和不完整费用还可能被误读为成功
性能。

R2 新增独立 V3 scheduler/report，不改写 V1/V2。目标是在首个 runtime contract failure 后立即
熔断后续 pair，同时保留完整 72-case / 48-runtime 固定分母、真实调用边界、每条 lane 自己的故障
归属和保守费用状态。

## 2. 主要实现

- 新增独立 `runPhase697TutorOrganizerPairedEvalV3`，先执行 24 条 guard；任一 guard 失败时，48 条
  runtime 全部以 `not_started_case_guard / runtimeInvocations=0` 保留，实际 runtime 调用为 0。
- runtime 按 `pairedRunIndex=0..23` 串行推进；同一 pair 只允许 Tutor/Organizer 各一个并发操作，
  最大 lane 并发为 2，不并发多个 pair。
- `(runId, agent, pairedRunIndex)` in-process ledger 先 reserve、后 terminal；重复 dispatch key 与非法
  terminal fail-closed。全成功时为 `48 reserved / 48 terminal`，提前熔断只统计实际已预留 lane。
- `runtimeContractSuccess` 只读取 invocation、schema、candidate disposition、canonical diagnostic、
  latency、usage/价格和四类 safety failure；不读取 fixture expected、intent、subject、topic 或
  semantic score。`executed_success` 由该 predicate 派生。
- 首个 predicate failure 打开 `quality_gate_impossible`，只 abort 当前 pair 的另一条独立 lane；触发
  lane 不 abort 自己，Tutor/Organizer 不共享 AbortController、预算或故障类别。
- sibling 正常收口时保留自己的真实结果；delegate 后 abort 为 `attempted_aborted`。忽略 abort 的
  sibling 在默认 1000ms 的调度层窗口后以 `attempted_orphaned / unknown_after_attempt` 收口，不复制
  触发 lane 的 Provider category；未进入 delegate 则保留为 not-started。
- 后续 pair 全部写为 `not_started_quality_breaker`，category/stage/usage 为 `null`；不 retry、不补跑、
  不借用另一 lane 预算，也不从固定 48 分母删除。
- V3 report 固定重算 metrics、lane summary、execution outcome/category/stage counters、ledger、P95
  样本完整性和 CNY。只要不是 48 条 strict success，`latencySampleComplete=false`、完整 pricing/cost
  authority 关闭，最终 gate 必须失败。
- 旧 harness 只增加可选 `signal` 透传；V1/V2 exported runner 的调度、字段、identity、validator 与
  历史 evidence bytes 均未改变。

## 3. 生产极端边界

| 边界                           | 结果                                                                      |
| ------------------------------ | ------------------------------------------------------------------------- |
| 首 / 中 / 末 pair failure      | 分别只派发 1 / 6 / 24 个 pair；剩余 runtime 仍在固定分母                  |
| Tutor-first / Organizer-first  | 首个 failure 成为 trigger；另一 lane 只保留自身 abort/failure 归因        |
| sibling 忽略 abort             | 有界收口为 orphaned + unknown usage，不阻塞整轮、不伪造 Provider category |
| semantic-only mismatch         | 48 条 runtime 继续完整执行，最终仅由冻结 semantic metric 判定             |
| guard mismatch                 | runtime 调用 0；48 条 runtime 为 `not_started_case_guard`                 |
| usage 越过本 lane cap          | strict predicate 失败；不能借用另一 lane 的 `3500/800` 或 `1200/300`      |
| duplicate ledger key           | 固定错误 `PHASE_6_9_7_V3_DUPLICATE_DISPATCH`，无第二次 dispatch           |
| report counter/P95/budget 篡改 | strict V3 schema 复算并拒绝                                               |
| raw harness canary             | 不进入 report；Provider prompt/response/raw error/credential 仍不保存     |

## 4. 验收结果

| 门禁                            | 结果                         |
| ------------------------------- | ---------------------------- |
| R2 focused V3 contract/runner   | `29 passed / 132 expect()`   |
| Agent full                      | `608 passed / 6479 expect()` |
| AI full                         | `199 passed / 1054 expect()` |
| Agent typecheck / lint          | exit `0`                     |
| AI typecheck / lint             | exit `0`                     |
| V1 evidence validator           | `ok=true, filesChecked=1`    |
| V2 evidence validator           | `ok=true, filesChecked=1`    |
| V1/V2 evidence + marker SHA     | 四项与 R1 记录完全一致       |
| V3 Live marker/journal/evidence | `0`                          |
| Prettier / `git diff --check`   | pass                         |

V1/V2 SHA-256 仍为：

- V1 evidence `be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5`；
  marker `7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`；
- V2 evidence `0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77`；
  marker `ac65ac67bd155f448e498a2c1dd9d7762d1efb4cc720a3cf1153083299c98504`。

## 5. 权限与停止边界

本任务没有读取根 `.env` 或真实 credential，没有调用 DeepSeek/其它 Provider，没有启动 Docker、API
或可见浏览器，没有创建 V3 CLI/授权变量/marker/journal/Live evidence，也没有修改数据库、Redis、
MinIO 或业务数据。V1/V2 两条失败历史没有重跑、删除、覆盖、重建或重新解释。

R2 的 Mock/静态通过只证明 scheduler、contract、并发、abort 和固定分母工程边界，不证明
Tutor/Organizer 真实模型质量或产品可用。Phase 6.9.7 仍未完成；Task 13/main、Phase 6.10 与产品
Docker/API/browser 仍禁止开始。

## 6. 下一步与回顾问题

该检查点当时下一步只能执行 R3：新增独立 V3 CLI、一次性 marker、append-only hash-chain
journal、crash-only orphan sealer、hard-link evidence publisher 与 V3 validator。后续 R3 已完成；
后续 R4 已完成；唯一 V3 R5 又以 `quality_gate_failed` 封存，R6--R9 不得开始。

回顾时可以问：

- 为什么首个 runtime contract failure 就足以熔断，而 semantic mismatch 不能提前熔断？
- 为什么未执行 runtime 必须保留在 48 分母，不能删除或补跑？
- 为什么 Tutor failure 不能把 auth/transport category 复制给 Organizer sibling？
- `attempted_aborted`、`attempted_orphaned` 与 `not_started_quality_breaker` 分别证明什么？
- 为什么 unknown usage 不能记成零费用，Mock 满分也不能成为 Live 质量 authority？

本交付与源码、测试、相关文档使用一个原子提交：
`feat(agent): stop phase 6.9.7 v3 failure storms`。
