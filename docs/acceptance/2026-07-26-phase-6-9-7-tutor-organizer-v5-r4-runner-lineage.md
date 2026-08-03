# Phase 6.9.7 Tutor / WrongQuestionOrganizer V5 R4 验收记录

日期：2026-07-26

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

范围：原生 V5 runner、lineage、durable evidence 与生产极端边界；zero-provider。

## 1. 结论

V5 R4 已完成。V5 现在拥有独立 report/case/evidence contract、paired runner、CLI、一次性 marker、
dispatch-before-call hash-chain journal、hard-link evidence、recovery claim 与 validator。固定分母、
guard-first、single-pair dispatch、双 lane 隔离、首错 breaker、unknown usage、crash-only seal、并发单
胜者、ABA/tail fence、不可覆盖发布与 V1--V4 双向 lineage 隔离均已落地并通过回归。

本结论只证明 R4 runner/evidence 工程合同。R4 没有读取 `.env` 或 credential、调用 Provider、接入
产品 composition/gate/Trace persistence、启动 Docker/API/浏览器、修改业务数据或创建 V5 Live
artifact。Phase 6.9.7 仍未完成；下一原子任务仅 V5 R5 static/Mock checkpoint。

## 2. 原生 V5 identity 与文件边界

新增：

- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v5-contract.ts`
- `packages/agent/src/evals/run-phase-6-9-tutor-wrong-question-v5-paired.ts`
- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v5-durability-contract.ts`
- `packages/agent/scripts/phase-6-9-7-tutor-wrong-question-v5-cli.ts`
- `packages/agent/scripts/phase-6-9-7-tutor-wrong-question-v5-durability.ts`
- `packages/agent/scripts/phase-6-9-7-tutor-wrong-question-v5-journal-lifecycle.ts`
- `packages/agent/scripts/validate-phase-6-9-7-tutor-wrong-question-v5-evidence.ts`
- 四组 V5 runner/durability/lineage/CLI tests 与独立 fixture。

冻结 identity：

| 维度              | V5 值                                                          |
| ----------------- | -------------------------------------------------------------- |
| runner            | `phase-6.9.7-tutor-organizer-runner-v5`                        |
| runtime evidence  | `phase-6.9.7-v5-runtime-evidence-v1`                           |
| marker            | `phase-6.9.7-v5-live-marker-v1`                                |
| journal           | `phase-6.9.7-v5-journal-v1`                                    |
| recovery claim    | `phase-6.9.7-v5-recovery-claim-v1`                             |
| evidence envelope | `phase-6.9.7-v5-evidence-envelope-v1`                          |
| approval env      | `PHASE_6_9_7_V5_CONTROLLED_LIVE_APPROVED`                      |
| confirmation      | `I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V5_CONTROLLED_LIVE_ONCE` |
| marker path       | `.tmp/phase-6-9-7-tutor-organizer-v5-controlled-live.marker`   |

Package scripts 已新增 `eval:phase-6-9-7:v5:cli` 与 `eval:phase-6-9-7:v5:validate`。R4 的公共 CLI
没有 Provider/Mock factory；直接执行会以 `runtime_factory_unavailable` 停止，不会创建网络 executor。
R5/R6 必须分别注入经过复审的 Mock/Live factory，不能借用 V1--V4 executor 或 artifact。

## 3. 固定分母与质量重算

V5 report 固定：

| 指标                     | 固定值 |
| ------------------------ | ------ |
| total cases              | 72     |
| verified zero-call guard | 24     |
| runtime cases            | 48     |
| paired requests          | 24     |
| Organizer decision units | 32     |

执行顺序为 24 guard 全部先行，再按 paired index 每次只调度一个 pair；pair 内 Tutor/Organizer 最多
双 lane。首个 runtime contract failure 只收口当前 pair 并打开 breaker，后续 case 标记为未启动但仍
保留在 48 runtime 固定分母。Semantic-only mismatch 不提前熔断。

Report schema 从 72 个 case entry 重算 canonical identity、case/decision denominator、semantic、
strict runtime、safety/permission/mutation/broader fallback、usage、latency、费用与最终 gate。重复 case、
ordinal/agent/pair 错配、identity/metric/aggregate/gate 篡改和 partial aggregate 全部 fail-closed。

只有固定分母要求的 usage、latency、semantic 样本完整时才允许生成相应 aggregate；任何 attempted
lane 的 usage unknown、未完成 latency 或不完整 semantic 都让相关 aggregate 保持 `null`，不能冒充
零 token、零费用或质量通过。`synthetic_test` provenance 的 Live 固定
`quality_gate_failed`；只有未来真实 factory 产生的 `deepseek_network` provenance 才可能成为质量
authority。

## 4. Durable journal、一次性名额与 crash-only recovery

R4 固定以下顺序和终态：

1. marker 使用 `wx` 独占创建，只有一个进程获得一次性 run identity；
2. journal 初始化 append+fsync 后才允许 factory 分配 executor；
3. 每条 `dispatch_started` 必须在对应 lane/Provider 前 append+fsync；
4. journal 以 `sequence + previousRecordSha256 + recordSha256` 验证 guard、dispatch、terminal、pair、
   breaker、run completion 与 evidence seal；
5. evidence 使用随机 temp `wx`、fsync 与 hard-link final；same bytes 幂等，different bytes 拒绝覆盖；
6. marker 成功后，journal 初始化/append/terminal/evidence publish/final seal 任一失败都消费一次性名额；
7. 活 marker owner 不允许 recovery；dead owner 通过 token claim 单胜者接管；
8. takeover 后旧 appender/release、ABA claimant 与 recovery 后 journal tail drift 均被 fence；
9. 已 dispatch 无 terminal 保守封存为 attempted orphan/unknown usage，从未 dispatch 保持 not-started；
10. recovery 只 seal，不 resume/replay/retry Provider，也不补跑 sibling 或后续 pair。

回归覆盖 marker/journal/evidence 发布失败、final append/fsync failure、duplicate dispatch、post-seal
append、journal truncation/hash tamper、live/dead owner、recovery claim concurrency、ABA、tail drift、
sibling abort/orphan、unknown usage、same-byte idempotency 与 different-byte conflict。

## 5. Lineage、安全与历史不可变性

V5 validator 递归拒绝：

- V1--V4 runner/dataset/run/marker/journal/evidence identity；
- `sourceV1CaseId`、legacy/partial/source 字段或旧 artifact path；
- partial metrics/usage/cost、重复/错序 case、篡改 aggregate 与不可重算 gate；
- getter、cycle、symbol-key、非 plain object 与非有限数值污染；
- prompt、题目/答案正文、raw model/provider output、credential、URL、cookie、token、stack 或 raw error。

V1--V4 validators 同样拒绝 V5 report/evidence。只读复核确认四份历史 evidence SHA 未变：

| artifact    | SHA-256                                                            |
| ----------- | ------------------------------------------------------------------ |
| V1 evidence | `be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` |
| V2 evidence | `0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77` |
| V3 evidence | `e24f4e6dd6fc0d0621eee672210b86fe8fbf5dce4664b1184726319b8e22d25c` |
| V4 evidence | `6ec60be1fced72766253e237b892fabb8e1d4ceca555249593d693f5e2d94608` |

四版历史 validator 均返回 `{"ok":true,"filesChecked":1}`。历史 marker/journal/evidence 没有删除、
覆盖、重命名、重建或拼接。

## 6. 验证结果

| 门禁                            | 结果                        |
| ------------------------------- | --------------------------- |
| V5 R4 focused                   | `26/26`，145 assertions     |
| Agent full                      | `741/741`，9128 assertions  |
| Agent TypeScript / lint         | 通过                        |
| Web / Server lint               | 通过                        |
| 本轮 TypeScript Prettier        | 通过                        |
| `git diff --check`              | 通过                        |
| V1--V4 evidence SHA/validators  | 不变且通过                  |
| Provider/network calls          | `0`                         |
| V5 Live marker/journal/evidence | `0`                         |
| 两路独立代码/测试复审           | APPROVED，无未关闭 Critical |

可回放的核心 zero-provider 命令：

```powershell
bun test packages/agent/tests/phase-6-9-tutor-organizer-v5-runner.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v5-durability.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v5-lineage.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v5-cli.test.ts
bun run --cwd packages/agent typecheck
bun run --cwd packages/agent lint
```

这些命令只使用 synthetic/no-network harness 和临时目录。不要设置 component credential，不要执行
V1--V4 Live，也不要把测试中注入的 `synthetic_test` 结果解释为 Provider 或质量验收。

## 7. 明确未做

- 未读取根 `.env`、component credential 或 Provider 数据；
- 未调用 DeepSeek 或其它真实模型；
- 未创建任何 V5 Live marker、journal、recovery claim 或 evidence；
- 未接 Tutor/Organizer 产品 composition、gate、Trace persistence 或 Docker allowlist；
- 未启动或重建 Docker service、API 或可见浏览器；
- 未创建 synthetic 用户/错题/Trace/session；
- 未修改 PostgreSQL、Redis、MinIO、Docker container/image/volume 或业务数据；
- 未执行 R5、controlled-Live、产品验收、Task 13/main、Phase 6.10 或博客收尾。

## 8. 下一步与回顾入口

唯一下一步是 V5 R5 static/Mock checkpoint：fresh deterministic baseline、fresh V5 Mock、受影响全量
Agent/AI/Types/Server/Web 静态门、Organizer PostgreSQL concurrency E2E、Compose default-off、V1--V4
SHA/validator、V5 Live artifact=0 与两路独立终审。

R5 全部通过后仍必须停止。只有用户重新接受当时 Provider 数据边界并明确授权唯一一次 V5 branch
controlled-Live，才能在 R6 创建 V5 marker 和真实 network factory。R4/R5 不能替代该授权，也不能
直接进入产品 Docker/API/浏览器或 main。

回顾时可以问：

- “为什么 V5 R4 必须原生实现 lineage，而不能把 V4 report 转换成 V5？”
- “为什么 dispatch journal 必须在 Provider 调用前 append+fsync？”
- “marker 创建后哪些失败会消费一次性名额，为什么不能重新跑？”
- “attempted orphan、usage unknown 和 incomplete aggregate 为什么必须同时保留？”
- “crash-only recovery、单胜者 claim、ABA fence 与 tail fence 分别防什么？”
- “为什么 synthetic Live 即使 72 case 全过也不能成为质量 authority？”
