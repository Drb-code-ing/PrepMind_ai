# Phase 6.9.7 Tutor / WrongQuestionOrganizer V7 R2 Runner / Lineage / Durability 验收记录

日期：2026-07-28

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

R2 起始提交：`0e408098c83889ecccb03b31520de02816d421c2`

范围：独立 V7 report、paired runner、CLI/approval、marker、hash-chain journal、evidence、recovery、validator 与 V1--V6 双向 lineage；全程 zero-provider。

## 1. 结论

V7 R2 已完成。R1 的第一方 DeepSeek V4 Pro direct adapter 和 8-stage wire capability 现在已经接入独立 V7 runner 与 durable evidence 边界：每个 runtime lane 在调用 adapter 前先取得唯一 reservation；adapter 的 wire stage 通过同一 opaque capability 进入 append queue；成功 lane 必须同时证明完整 8-stage 前缀、`usageDisposition=verified`，以及 executor、dispatch、response、verified usage 四类计数均为 `1`。

R2 还建立了 V7 专用 CLI、一次性 marker、dispatch-before-call hash-chain journal、hard-link evidence、crash-only recovery claim 与 evidence validator。固定分母、guard-first、pair 串行、pair 内最多双 lane、single dispatch、no retry、首个 runtime contract failure breaker、incomplete aggregate 全 `null` 和 synthetic Live 永不成为质量 authority 等停止门均已进入可执行合同。

本结论只证明 V7 runner、lineage、wire evidence 和进程崩溃恢复合同已具备。R2 没有执行正式 V7 Mock 或 Live，没有读取 `.env`/credential、调用 Provider、启动 Docker/API/浏览器、接入产品 composition 或创建仓库 V7 artifact。Phase 6.9.7 仍未完成；下一原子任务仅 R3 zero-network fault matrix 与 static/Mock checkpoint。

## 2. 为什么需要 R2

R1 能在内存中区分 `executor_entered`、HTTP dispatch、HTTP response、structured-output stages 与 verified usage，但它没有 runner、一次性运行名额或 durable journal。仅靠 R1 不能证明某个 stage 在进程崩溃前已经落盘，也不能阻止把 V1--V6 evidence、synthetic delegate 或跨仓库同名文件冒充为 V7 authority。

R2 补齐的是证据链，而不是重新调整 Tutor/Organizer 语义：

- 仍复用 V2 dataset 与 V6 Tutor/Organizer candidate、schema、prompt 和本地 authority；
- 把 runner reservation、wire stage、runtime terminal、pair terminal、breaker、run completion 和 evidence seal 串成单一 hash-chain；
- 分别重算 executor invocation、Provider dispatch、Provider response 和 verified usage，避免继续用一个模糊 invocation 数字覆盖不同传输边界；
- 让崩溃恢复只封存已持久化前缀，不创建 adapter、不读取 key，也不 resume、replay、retry 或 backfill Provider；
- 原生拒绝旧 lineage、错误 provenance、篡改 aggregate、跨 lane dispatch key 与错误 evidence 根路径。

## 3. 交付文件

新增核心合同与 runner：

- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v7-contract.ts`
- `packages/agent/src/evals/run-phase-6-9-tutor-wrong-question-v7-paired.ts`
- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v7-live.ts`
- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v7-durability-contract.ts`

新增 CLI、durability 与 validator：

- `packages/agent/scripts/phase-6-9-7-tutor-wrong-question-v7-cli.ts`
- `packages/agent/scripts/phase-6-9-7-tutor-wrong-question-v7-durability.ts`
- `packages/agent/scripts/phase-6-9-7-tutor-wrong-question-v7-journal-lifecycle.ts`
- `packages/agent/scripts/validate-phase-6-9-7-tutor-wrong-question-v7-evidence.ts`

新增测试与 synthetic fixture：

- `packages/agent/tests/phase-6-9-tutor-organizer-v7-runner-contract.test.ts`
- `packages/agent/tests/phase-6-9-tutor-organizer-v7-durability.test.ts`
- `packages/agent/tests/phase-6-9-tutor-organizer-v7-cli.test.ts`
- `packages/agent/tests/phase-6-9-tutor-organizer-v7-lineage.test.ts`
- `packages/agent/tests/fixtures/phase-6-9-tutor-organizer-v7-runner.ts`

兼容性修改：

- V6 Live runtime case 函数只增加导出，既有行为不变；
- `packages/agent/package.json` 增加 V7 CLI、Mock、Live、seal 与 validate 入口；
- 旧 evidence 敏感字段扫描器只精确放行正式计数字段 `providerResponses`，不放宽正文或凭据扫描。

## 4. 冻结 identity

| 维度              | V7 值                                                          |
| ----------------- | -------------------------------------------------------------- |
| runner            | `phase-6.9.7-tutor-organizer-runner-v7`                        |
| runtime evidence  | `phase-6.9.7-v7-runtime-evidence-v1`                           |
| marker            | `phase-6.9.7-v7-live-marker-v1`                                |
| journal           | `phase-6.9.7-v7-journal-v1`                                    |
| recovery claim    | `phase-6.9.7-v7-recovery-claim-v1`                             |
| evidence envelope | `phase-6.9.7-v7-evidence-envelope-v1`                          |
| approval env      | `PHASE_6_9_7_V7_CONTROLLED_LIVE_APPROVED`                      |
| confirmation      | `I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V7_CONTROLLED_LIVE_ONCE` |
| marker path       | `.tmp/phase-6-9-7-tutor-organizer-v7-controlled-live.marker`   |

冻结 SHA-256：

- source manifest：`sha256:f326af71b02c841077d6914b8236bc8aa277f70dc1bdb59b41714e07c172163d`
- eval policy：`sha256:6e4a4aa1fea194e792fd7a4c5c30fc1909a4c91694ea9ffc5b1c92425f7c097c`
- semantic authority：`sha256:1982561f3e01b4bd1f15f525866df2d34e124c18cd7fb20917c4e004c264f951`

Evidence bundle 必须锚定当前 repository root 下的规范绝对路径。仅 basename 相同、来自另一个仓库根的 marker/journal/evidence 不能通过 validator。

## 5. Runner 与正式质量合同

V7 固定分母保持：

| 指标                      | 固定值 |
| ------------------------- | -----: |
| total cases               |     72 |
| verified zero-call guards |     24 |
| runtime cases             |     48 |
| paired requests           |     24 |
| Organizer decision units  |     32 |

执行顺序和停止门：

1. 24 条 guard 必须全部先执行，且实际 runtime/wire counter 为 0；
2. runtime 按 24 个 pair 串行调度，每个 pair 内 Tutor/Organizer 最多各一个 lane；
3. 每个 lane 只有一个 reservation、一个 dispatch key、一个 adapter capability 和最多一次 Provider dispatch；
4. 首个 runtime contract failure 收口当前 pair，打开 `quality_gate_impossible` breaker，后续 runtime 保留在固定分母中但不启动；
5. semantic 或 model-owned mismatch 记录为质量失败，但不伪装成 transport contract failure；
6. 任一 runtime 未完整、terminal 缺失、usage 未验证、duration 非法或四类 wire aggregate 不完整时，正式 semantic、P95、token 与 CNY 全部为 `null`；
7. production quality gate 要求 48 executor、48 dispatch、48 response、48 verified usage，不能用 Mock、历史记录或未启动项补齐；
8. `synthetic_test` 可以验证调度和失败封存，但永远只能得到 `mock_quality_not_evidence` 或 `quality_gate_failed`，不能成为 controlled-Live authority。

## 6. Durable wire evidence 与 recovery

R2 固定以下 durable 顺序：

1. marker 以 exclusive-create 取得一次性 run identity；
2. journal 初始化并完成文件 fsync 后，才允许 factory 分配 runtime executor；
3. `lane_reserved` 先记录唯一 case/agent/pair/dispatch key；
4. adapter 的每个 wire stage 通过串行 append queue 写入 journal 并完成文件 fsync；`provider_dispatch_started` 的 hook 完成后才进入 fetch delegate；
5. runtime terminal 必须与 reservation、dispatch key、完整 stage prefix、wire version、usage disposition 和四类 counter 一致；
6. pair terminal、breaker 和 run completion 都进入同一 `sequence + previousRecordSha256 + recordSha256` 链；
7. evidence 使用随机 temp `wx`、文件 fsync 与 hard-link final；相同 bytes 幂等，不同 bytes 拒绝覆盖；
8. recovery 只有一个 claimant，且只依据 durable journal prefix 封存 attempted orphan/unknown usage；未 dispatch lane 保持 not-started；
9. recovery 不创建 direct adapter、不读取 component key、不启动任何新 lane，也不 resume/replay/retry/backfill Provider。

回归还覆盖 stale claim rename 后崩溃与重新抢占、same-token ABA、marker/journal tail drift、旧 appender、unknown/cross-lane dispatch key、duplicate/out-of-order stage、post-seal append 和 evidence 路径跨仓库根污染。

## 7. Lineage、provenance 与安全边界

V7 validator 递归拒绝 V1--V6 runner、dataset/run、candidate/projection/prompt/policy、marker/journal/evidence/recovery identity，以及把旧 artifact token 塞入嵌套字段的情况。V1--V6 validators 同样拒绝 V7 envelope；历史 artifact 的 bytes 和物理 SHA 未被修改。

正式 evidence 还会重算并核对：

- report/case identity、固定分母、scheduler 与 gate；
- runtime snapshot 的 wire version、8-stage 前缀、`usageDisposition` 与四类计数；
- journal 中 reservation、dispatch key、terminal、aggregate 与 report 的一一对应；
- CLI、marker、journal 和 evidence 的 executor provenance；
- source manifest、eval policy、semantic authority 与 repository-root path provenance；
- sensitive value、getter、cycle、symbol key、非 plain object、raw error/body/header/prompt/output/credential/URL/token 等禁止内容。

## 8. 验证结果

| Gate                                       | 结果                          |
| ------------------------------------------ | ----------------------------- |
| V7 R2 focused                              | `22/22`，`184` assertions     |
| `@repo/agent` full                         | `852/852`，`11041` assertions |
| `@repo/agent` typecheck                    | exit `0`                      |
| `@repo/agent` lint                         | exit `0`                      |
| V1--V6 historical evidence validators      | 全部 `ok=true`                |
| changed-file Prettier / `git diff --check` | 通过                          |
| Provider/network calls                     | `0`                           |
| repository `.tmp` V7 artifact              | `0`                           |

V6 历史物理 SHA 复核保持不变：

- evidence：`beb9d460dcbe10419af06aab130c04d0410debd2123732523fb4a09ff21ea5e9`
- marker：`cbddba87ec6e491f4e5a5d55c886150eb557e510ff09bd60acfa2ede7c99f988`
- journal：`be91b0c41d9a538c4be651de52621329751852478261f230fed5e06e758c2a2f`

Focused 回放入口：

```powershell
bun test packages/agent/tests/phase-6-9-tutor-organizer-v7-runner-contract.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v7-durability.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v7-cli.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v7-lineage.test.ts
bun --filter @repo/agent typecheck
bun --filter @repo/agent lint
```

这些命令只运行 synthetic/no-network tests，不应设置 component credential，也不应执行 V7 `live`。R2 默认 Mock factory 仍返回 `mock_harness_unavailable`；正式 reviewed Mock 属于 R3。

## 9. 明确保留的 durability 边界

R2 没有把下列事项包装成已解决：

- 当前只对 marker、journal、temp evidence 文件执行 fsync，没有对父目录执行 fsync；它证明文件级写入顺序和进程崩溃恢复，不证明突然断电后目录项一定持久；
- PID、marker、claim 与文件锁是单机进程边界，不是跨主机 lease 或分布式共识；
- dispatch-before-fetch journal 证明客户端进入 delegate 前的本地顺序，不证明 Provider 已接收、执行或计费；
- single dispatch/no retry 是本地 runner 合同，不构成 Provider exactly-once；网络断开时仍可能存在客户端未知的远端结果；
- hard-link evidence 与 recovery claim 保护本仓库单机发布，不代表共享网络文件系统或异构平台拥有相同原子语义。

因此 R2 的正确表述是“crash-aware、fail-closed 的单机 durable evidence”，不是断电级 durability、分布式 lease 或端到端 exactly-once。

## 10. 明确未发生的事项

- 未读取、打印或修改根 `.env`、component credential 或 API key；
- 未调用 DeepSeek 或其它 Provider，verified Provider usage/P95/CNY 不存在；
- 未执行正式 V7 Mock、controlled-Live、curl、单 case 或产品 API 网络探测；
- 未创建仓库 `.tmp` 下的 V7 marker、journal、evidence 或 recovery claim；
- 未启动或重建 Docker、Nest API、Next Web 或可见浏览器；
- 未接入 Tutor Web / Organizer Server composition、gate、Trace persistence 或 Docker allowlist；
- 未创建测试账号、错题、deck、Trace、session，也未修改 PostgreSQL、Redis、MinIO 或业务数据；
- 未删除、覆盖、重跑、恢复或拼接 V1--V6 marker/journal/evidence；
- 未开始 R3、R4 controlled-Live、R5 产品验收、R6 main、Task 13、Phase 6.9.8、Phase 6.10、Phase 8/9 或博客收尾。

## 11. 下一步与回顾入口

下一原子任务仅 V7 R3：使用真实 V6 Tutor/Organizer schema、projection、prompt formatter 和 48 个 runtime input，完成完全 zero-network 的 transport/HTTP/response/structured-output/usage/abort/timeout fault matrix；随后执行 fresh baseline、reviewed V7 Mock、full static/PostgreSQL/Compose、历史 SHA/validators、V7 Live artifact=0 与两路独立复审。

R3 必须保持不读取 `.env`、不调用 Provider、不启动产品 Docker/API/browser。只有 R3 全门通过、单独提交并推送且用户重新接受运行时数据边界并精确授权唯一一次 V7 branch controlled-Live，R4 才可能开始；当前“继续”不构成该授权。

回顾时可以问：

- “R1 的 in-memory wire capability 和 R2 的 durable journal 分别解决什么问题？”
- “为什么 executor、dispatch、response、verified usage 必须拆成四个计数？”
- “为什么完整 8-stage 前缀仍不能证明 Provider exactly-once 或一定已经计费？”
- “为什么 first runtime contract failure 要打开 breaker，但 48 runtime 分母不能缩小？”
- “recovery 为什么只 seal durable prefix，而不能 resume、replay 或补跑 sibling？”
- “为什么 synthetic Live 能测试崩溃封存，却永远不能成为质量 authority？”
- “文件 fsync、父目录 fsync、跨主机 lease 和 Provider exactly-once 的保证边界分别是什么？”
- “为什么 evidence 必须锚定当前 repository root，而不能只比较同名 basename？”
