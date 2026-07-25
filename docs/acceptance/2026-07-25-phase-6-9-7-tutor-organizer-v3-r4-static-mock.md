# Phase 6.9.7 V3 R4 — Tutor / WrongQuestionOrganizer Static & Mock Checkpoint

日期：2026-07-25

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

checkpoint 起点：`648727a5`

状态：R4 分支 static/Mock checkpoint 已完成。V3 fresh Mock、首失败熔断报告、全量静态门、
PostgreSQL 并发 E2E、历史不可变性与两路独立复审均已关闭；该检查点当时 V3 Live marker、
journal、evidence 与 recovery claim 为 `0`，两个产品 gate 默认关闭，并必须先停下取得一次新的
`Phase 6.9.7 Tutor/Organizer V3 branch controlled-Live` 精确授权。后续 R5 结果见第 9 节。

本 checkpoint 没有读取根 `.env` 或真实 credential，没有调用 DeepSeek、OpenAI、Qwen 或其它
Provider，也没有启动产品 API、浏览器验收或修改真实业务数据。Mock 只证明工程合同，不能证明真实
模型质量或生产可用性。

## 1. R4 验收结果

| 范围                                  | 结果                                                            |
| ------------------------------------- | --------------------------------------------------------------- |
| V3 focused                            | `50/50`，`360 expect()`                                         |
| Agent full                            | `629/629`，`6710 expect()`                                      |
| Agent typecheck / lint                | exit `0` / exit `0`                                             |
| AI full                               | `199/199`，`1054 expect()`                                      |
| AI typecheck / lint                   | exit `0` / exit `0`                                             |
| Types tests / typecheck               | `42/42` / exit `0`                                              |
| Server full                           | `227` suites passed / `3` skipped；`2154` passed / `30` skipped |
| Server no-fix lint / build            | exit `0` / exit `0`                                             |
| Web full                              | `439/439`                                                       |
| Web lint / production build           | exit `0` / exit `0`；17 routes                                  |
| WrongQuestionOrganizer PostgreSQL E2E | `12/12`                                                         |
| Compose tracked example               | `config --quiet` exit `0`，无 stdout                            |

第一次 Server full 因 Docker Desktop 尚未运行、`127.0.0.1:5433` 不可达而中断；这不是代码断言
失败。随后只启动现有 Docker Desktop 与 `docker-postgres-1`，确认 PostgreSQL accepting connections
后补跑一次完整 Server 门，结果如上。没有执行 `prune`、`down -v`、reset、flush、删容器、删镜像或
删卷，其它产品容器没有被本 checkpoint 当作验收证据。

`packages/types` 的既有 `lint` script 没有声明/安装自身 ESLint 依赖；本机 registry 不可达，因此
`bun --filter @repo/types lint` 终止于 `bun: command not found: eslint`。这不是 Types 源码失败；Types
tests 与 `tsc --noEmit` 均通过，本轮也没有修改 Types 源码。该工具链缺口保留为独立原子任务，不能
在 R4 中临时安装依赖或改写 lockfile。

Organizer E2E 完成后，数据库中 `wrong-question-organizer-%@example.com` 测试账号计数为 `0`；级联
组织层与 Trace 无本轮残留。

## 2. 冻结 deterministic baseline

- dataset：`phase-6.9-tutor-wrong-question-v1`
- dataset SHA-256：`7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`
- cases：72；zero-call：24；runtime：48；paired requests：24；Organizer decisions：32
- 完整 runtime：`6/48`；critical failure：`0`
- Tutor semantic：`0.44186666666666674`
- Organizer semantic：`0.278125`
- combined semantic：`0.3599958333333334`
- provider / input / output / cost：`0 / 0 / 0 / 0 CNY`

baseline 没有经过模型候选 guard，只量化未修饰本地 policy 的语义缺口；R4 没有因 Mock 满分改写
它。

## 3. Fresh V3 Mock all-success

- run ID：`116cc321-962f-426c-8a91-f05ab8debc93`
- evidence SHA-256：`4b6be1377fef1c8f45be5ddea405e3757ec57182ae7166d86a28d7939d98b498`
- runner：`phase-6.9.7-tutor-organizer-runner-v3`
- disposition：`mock_direct`
- `24/24` verified zero-call；`48/48` executor started、usage verified 与 strict runtime
- Tutor / Organizer / combined semantic：`1 / 1 / 1`
- P95：Tutor `246ms`；Organizer `328ms`；paired candidate `328ms`；Tutor orchestration `276ms`
- verified usage：input `21948`；output `5647`
- estimated cost：`0.099726 CNY`
- V3 validator：`{"ok":true,"filesChecked":1}`
- report gate：`quality_gate_failed`

Mock 的 `quality_gate_failed` 是 Live-only authority 设计：Mock 即使满分也不能启用产品 gate。唯一
Mock evidence 已按 run ID 精确删除，没有清空 `.tmp`，也没有创建 Live durability artifact。

## 4. Breaker / failure Mock report

使用独立 synthetic run `00000000-0000-4000-8000-000000000499` 在首个 Tutor runtime 注入 strict
schema failure。固定报告结果：

- 24 个 guard 先完成且全部 zero-call；
- pair `0` 同时启动 Tutor/Organizer，各实际调用 `1` 次；
- Tutor 首个 strict contract failure 打开 `quality_gate_impossible` breaker；
- 余下 `46` 个 runtime 为 `not_started_quality_breaker`，固定 runtime 分母仍为 `48`；
- `executorStartedCases=2`、`usageVerifiedCases=2`、`notStartedCases=70`；
- latency sample 不完整，P95、价格与总费用按合同为不可用，不用部分样本伪造通过；
- gate 固定 `quality_gate_failed`，没有 evidence 文件或 Provider 调用。

V3 runner full test 还覆盖 pair `5`、pair `23` 熔断、双 lane abort 隔离、Organizer-first 故障归属、
忽略 abort 的 sibling orphan、有界 usage failure、guard failure 0 runtime 与 dispatch ledger 重复拒绝。

## 5. 历史不可变性与默认关闭

- V1 evidence SHA-256：`be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5`
- V1 marker SHA-256：`7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`
- V2 evidence SHA-256：`0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77`
- V2 marker SHA-256：`ac65ac67bd155f448e498a2c1dd9d7762d1efb4cc720a3cf1153083299c98504`
- V1 / V2 validator：均 `{"ok":true,"filesChecked":1}`
- V3 Live marker / journal / evidence / recovery claim：`0 / 0 / 0 / 0`
- tracked `TUTOR_AGENT_MODEL_ENABLED=false`
- tracked `WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED=false`
- 两条 component credential example：空值

R4 没有设置 V3 approval 变量，没有读取或打印根 `.env`，generic DeepSeek key 也不能替代任一组件
credential。

## 6. Recovery claim 的精确边界

R3/R4 的 claim 只在单主机 PID liveness 合同内协调一个 recovery owner。正常生产路径中，仍存活的
owner 不能被 takeover，release 前 token 检查会拒绝已明确失去 claim 的旧 lease。它不承诺在测试
override、错误的进程存活判断或跨主机文件系统上消除 `assertOwned -> rename` 之间的所有 TOCTOU；
因此不把 claim 描述成分布式 lease，也不宣称 Provider exactly-once。该限定不改变 crash-only、
不重放、不重试的安全策略。

## 7. 独立复审

R4 文档与运行证据完成后执行两路只读终审：

- contract/security/concurrency：`APPROVED`，无 Critical/Important；固定分母、breaker、双 lane
  abort、usage/latency fail-closed 与 recovery claim 的单主机边界均和实现一致；
- operations/acceptance/history：初审发现两项 Important（本节占位符未回填、R3 durability 计数简写
  不精确），均已修正；复审 `APPROVED`，无遗留 Critical/Important。

两路均已关闭 Critical/Important；R4 可以形成 clean commit，并在新的精确授权点停止。

## 8. 本 checkpoint 没有完成什么

- 没有执行 V3 controlled-Live，没有真实语义、网络 P95、token 或账单证据；
- 没有启用 Tutor/Organizer 产品 gate，没有证明两条产品模型路径可用；
- 没有启动 authenticated Docker API 或可见 `/chat`、`/error-book` 浏览器验收；
- 没有合并 main、执行 main default-off replay 或推送远程；
- 没有完成 Phase 6.9.7、Phase 6 全部 Agent、可执行 LangGraph 或 Phase 6.10 分层记忆。

## 9. 停止条件与下一步

R4 clean commit 后当时必须停止。继续前，用户需要重新确认 DeepSeek 当前账号的数据保留/训练
边界，并明确授权：

> 我已接受 DeepSeek 当前账号的数据保留/训练边界，并明确授权执行一次 Phase 6.9.7 Tutor/Organizer V3 branch controlled-Live。

后续状态：用户按上文给出精确授权，唯一 R5 run `ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc`
已执行并以 `quality_gate_failed` durable seal。R4 的 static/Mock 结论保持历史不变，但不再是当前授权
状态，也不授权重跑 V3 或进入产品验收。R5 authority 见
`docs/acceptance/2026-07-25-phase-6-9-7-tutor-organizer-v3-controlled-live-failure.md`。

回顾时可以问：

- 为什么 Mock semantic `1/1` 仍然是 `quality_gate_failed`？
- breaker 为什么必须保留 48 个 runtime 固定分母，而不能删除未运行 case？
- 为什么 dispatch 前 fsync、崩溃后只 seal 能避免重复真实模型调用？
- recovery claim 能保证什么，为什么它不是跨主机分布式 lease？
- V3 Live 通过后还要经过哪些 Docker/API/可见浏览器和 main 回放步骤？
