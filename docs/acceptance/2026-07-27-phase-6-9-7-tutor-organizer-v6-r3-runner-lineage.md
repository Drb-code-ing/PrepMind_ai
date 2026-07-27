# Phase 6.9.7 Tutor / WrongQuestionOrganizer V6 R3 验收记录

日期：2026-07-27

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

范围：独立 V6 runner、lineage、durable evidence 与生产极端边界；zero-provider。

## 1. 结论

V6 R3 已完成。V6 现在拥有独立 report/case/evidence contract、paired runner、CLI/approval、一次性
marker、dispatch-before-call hash-chain journal、hard-link evidence、recovery claim 与 evidence
validator。固定分母、guard-first、pair 内双 lane、首个 runtime contract failure breaker、deadline
overshoot、usage unknown、crash-only seal、并发单胜 recovery、ABA/tail fence、不可覆盖发布与
V1--V5 双向 lineage 隔离均已落地并通过回归。

本结论只证明 R3 runner/evidence 工程合同。R3 没有读取 `.env` 或 credential、调用 Provider、发布
正式 Mock factory/checkpoint、接入产品 composition/gate/Trace persistence、启动 Docker/API/浏览器、
修改业务数据或创建仓库真实 V6 Live artifact。Phase 6.9.7 仍未完成；下一原子任务仅 V6 R4
static/Mock checkpoint。

## 2. 独立 V6 交付与 identity

新增：

- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v6-contract.ts`
- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v6-durability-contract.ts`
- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v6-eval-case.ts`
- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v6-live.ts`
- `packages/agent/src/evals/run-phase-6-9-tutor-wrong-question-v6-paired.ts`
- `packages/agent/scripts/phase-6-9-7-tutor-wrong-question-v6-cli.ts`
- `packages/agent/scripts/phase-6-9-7-tutor-wrong-question-v6-durability.ts`
- `packages/agent/scripts/phase-6-9-7-tutor-wrong-question-v6-journal-lifecycle.ts`
- `packages/agent/scripts/validate-phase-6-9-7-tutor-wrong-question-v6-evidence.ts`
- V6 runner、CLI、durability、lineage 四组测试与独立 synthetic fixture。

冻结 identity：

| 维度              | V6 值                                                          |
| ----------------- | -------------------------------------------------------------- |
| runner            | `phase-6.9.7-tutor-organizer-runner-v6`                        |
| runtime evidence  | `phase-6.9.7-v6-runtime-evidence-v1`                           |
| marker            | `phase-6.9.7-v6-live-marker-v1`                                |
| journal           | `phase-6.9.7-v6-journal-v1`                                    |
| recovery claim    | `phase-6.9.7-v6-recovery-claim-v1`                             |
| evidence envelope | `phase-6.9.7-v6-evidence-envelope-v1`                          |
| approval env      | `PHASE_6_9_7_V6_CONTROLLED_LIVE_APPROVED`                      |
| confirmation      | `I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V6_CONTROLLED_LIVE_ONCE` |
| marker path       | `.tmp/phase-6-9-7-tutor-organizer-v6-controlled-live.marker`   |

`packages/agent/package.json` 新增 `eval:phase-6-9-7:v6:cli` 与
`eval:phase-6-9-7:v6:validate`。没有注册 `v6:mock`：R4 前公共 CLI 没有经过复审的正式 Mock factory，直接
执行 `mock` 会返回 `mock_harness_unavailable_before_r4`。Live CLI 虽已有 fail-closed contract，但 R3
没有授权，严禁为了“试一下”运行、创建 marker 或读取 component credential。

## 3. 固定分母、调度与质量重算

V6 report 固定：

| 指标                     | 固定值 |
| ------------------------ | ------ |
| total cases              | 72     |
| verified zero-call guard | 24     |
| runtime cases            | 48     |
| paired requests          | 24     |
| Organizer decision units | 32     |

24 个 guard 必须全部先行并由 runtime counter 证明 zero-call。随后 24 个 pair 串行调度；每个 pair 内
Tutor/Organizer 最多双 lane。每个 lane 只有一次 dispatch、独立 budget/abort/failure attribution，且
`dispatch_started` 必须先于 executor 调用持久化。首个 runtime contract failure 只收口当前 pair 并打开
breaker；semantic/model-owned mismatch 不误熔断。后续 case 仍保留在 48 runtime 固定分母中。

Report 从 case entries 重算 identity、固定分母、strict runtime、semantic、model-owned axes、safety/
permission/mutation/broader fallback、deadline、usage、P95、费用与最终 gate。Tutor intent 必须至少
`21/24`；Organizer subject、deck、target ordinal 三轴分别至少 `28/32`。本地重建的 depth/confidence
不能抵消这些模型自有指标。

Tutor executor hard timeout 为 `3500ms`，Organizer 为 `5000ms`；每条 duration/overshoot 必须是有限、
非负、单调可验证值。四类 P95 各自要求恰好 24 个样本并取 nearest-rank 升序第 23 值。任何 attempted
lane 出现 usage unknown、缺 terminal、无效 duration 或运行不完整，正式 semantic/P95/token/CNY
全部保持 `null`，不能删除慢样本、把未启动项移出分母或用历史/Mock 补齐。

`synthetic_test` 可在测试临时目录验证 Live 调度和失败证据，但 gate 强制要求
`executorProvenance=deepseek_network`；因此 synthetic Live 无论分数多高都只能
`quality_gate_failed`，不能成为 controlled-Live authority。

## 4. Durable journal、一次性名额与 crash-only recovery

R3 固定以下顺序和终态：

1. marker 使用 `wx` 独占创建，只有一个进程获得一次性 run identity；
2. journal 初始化写入并完成文件 fsync 后，才允许 factory 分配 network executor；
3. 每条 `dispatch_started` 在对应 lane/executor 前进入串行 append queue 并完成文件 fsync；
4. journal 以 `sequence + previousRecordSha256 + recordSha256` 验证 guard、dispatch、terminal、pair、
   breaker、run completion 与 evidence seal；
5. close 会等待 append queue drain，避免未完成写入在进程正常收口时丢失；
6. evidence 使用随机 temp `wx`、文件 fsync 与 hard-link final；same bytes 幂等，different bytes 拒绝
   覆盖；
7. marker 成功后，journal/evidence/final seal 任一失败都消费一次性名额；
8. 活 marker owner 不允许 recovery；dead owner 通过 token claim 单胜者接管；
9. takeover 后旧 appender/release、ABA claimant 与 journal tail drift 均被 fence；
10. 已 dispatch 无 terminal 保守封存为 attempted orphan/unknown usage，从未 dispatch 保持 not-started；
11. recovery 只 seal，不 resume/replay/retry Provider，也不补跑 sibling 或后续 pair。

回归覆盖 marker/journal/evidence 发布失败、append/fsync failure、duplicate dispatch、post-seal append、
journal truncation/hash tamper、live/dead owner、recovery claim concurrency、ABA、tail drift、sibling
abort/orphan、unknown usage、same-byte idempotency 与 different-byte conflict。

## 5. Lineage、安全与历史不可变性

V6 validator 递归拒绝：

- V1--V5 runner、dataset/run、candidate/projection/prompt、policy、marker/journal/evidence/recovery
  identity 与旧 artifact path；
- `sourceV1CaseId`、legacy/partial/source 字段、partial metrics/usage/cost、重复/错序 case、篡改
  aggregate 与不可重算 gate；
- getter、cycle、symbol-key、非 plain object、非有限数值和路径污染；
- prompt、题目/答案正文、raw model/provider output、credential、URL、cookie、token、stack 或 raw error。

V1--V5 validators 同样拒绝 V6 report/evidence。R3 补齐了 V1--V4 candidate/projection/prompt SHA、V3/
V4 marker/journal/evidence/recovery 与 V4 bounded-diagnostic identity 的枚举回归，避免只拒绝旧 runner
却遗漏旧 prompt lineage。历史 artifacts 没有被删除、覆盖、重命名、重建或拼接。

## 6. 验证结果

| 门禁                          | 结果                              |
| ----------------------------- | --------------------------------- |
| V6 R3 focused                 | `32/32`，225 assertions           |
| Agent full                    | `824/824`，10727 assertions       |
| Agent TypeScript / lint       | 通过                              |
| 本轮 TypeScript/Markdown 格式 | Prettier 通过                     |
| Provider/network calls        | `0`                               |
| 仓库真实 V6 Live artifacts    | `0`                               |
| 三路独立只读复审              | 无 P0/P1 阻断；lineage 无 P2 阻断 |

可回放的核心 zero-provider 命令：

```powershell
bun test packages/agent/tests/phase-6-9-tutor-organizer-v6-runner.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v6-durability.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v6-lineage.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v6-cli.test.ts
bun run --cwd packages/agent typecheck
bun run --cwd packages/agent lint
```

这些命令只使用 synthetic/no-network harness 与测试临时目录。不要设置 component credential，不要执行
V1--V5 或 V6 Live，也不要把测试中的 `synthetic_test` 失败 artifact 解释成 Provider、Mock checkpoint
或质量验收。

## 7. 独立复审与已知 durability 边界

三路只读复审未发现 P0/P1 阻断，lineage/validator 未发现 P2 阻断。以下边界保留并明确不冒充已解决：

- 当前持久化对 marker/journal/temp evidence 文件执行 fsync，但没有对父目录执行 fsync；因此它证明
  进程崩溃和文件级写入顺序，不证明突然断电后的目录项持久性；
- recovery claim 获取时不直接重读 journal tail，后续 `open appender` / `seal` 会再次校验 tail；
- 当前没有专门覆盖 stale recovery claim 被 rename 后立即再次崩溃的残留清理测试；
- 测试注入可以在临时目录走 synthetic Live 并形成失败 artifact；production quality gate 的
  `deepseek_network` 强约束保证它不能通过，但它也不等于“完全无法生成测试 artifact”。

这些边界不改变 R3 zero-provider checkpoint，也不能推导跨主机分布式 lease、Provider exactly-once 或
断电级 durability 已完成。R4 可以补回归或进一步收紧，但不得因此偷跑 Provider。

## 8. 明确未做

- 未读取根 `.env`、component credential 或 Provider 数据；
- 未调用 DeepSeek 或其它真实模型；
- 未创建仓库真实 V6 marker、journal、recovery claim 或 evidence；
- 未发布正式 V6 Mock factory/checkpoint；
- 未接 Tutor/Organizer 产品 composition、gate、Trace persistence 或 Docker allowlist；
- 未把 V6 `3500ms` hard timeout 接入现有产品 executor；
- 未启动或重建 Docker service、API 或可见浏览器；
- 未创建 synthetic 用户/错题/Trace/session；
- 未修改 PostgreSQL、Redis、MinIO、Docker container/image/volume 或业务数据；
- 未执行 R4/R5、controlled-Live、产品验收、Task 13/main、Phase 6.10 或博客收尾。

## 9. 下一步与回顾入口

唯一下一步是 V6 R4 static/Mock checkpoint：实现并复审正式 Mock factory，执行 fresh V2 deterministic
baseline、fresh V6 Mock、受影响 Agent/AI/Types/Server/Web focused/full/typecheck/lint/build、Organizer
PostgreSQL concurrency E2E、Compose default-off/worker isolation、V1--V5 artifact SHA/validators、V6
Live artifact=0 与两路独立终审。

R4 全部通过并原子提交/推送功能分支后仍必须停止。只有用户重新接受运行当时 DeepSeek 数据边界并
明确授权唯一一次 V6 branch controlled-Live，才允许 R5 在 zero-network preflight 通过后、首次
Provider 调用前创建 V6 marker/journal。R3/R4 不能替代该授权，也不能直接进入产品 Docker/API/
浏览器或 main。

回顾时可以问：

- “为什么 V6 R3 必须原生实现 lineage，而不能把 V5 report 转成 V6？”
- “为什么 dispatch journal 必须在 executor 调用前 append+fsync？”
- “为什么 fixed denominator 与 complete-only aggregate 必须同时存在？”
- “attempted orphan、usage unknown、sibling abort 和 breaker 未启动项分别表达什么？”
- “文件 fsync、父目录 fsync和跨主机 lease 的保证边界有什么区别？”
- “为什么 synthetic Live 可以测试失败证据，却永远不能成为质量 authority？”
