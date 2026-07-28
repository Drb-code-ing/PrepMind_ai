# Phase 6.9.7 Tutor / WrongQuestionOrganizer V8 R4 Static/Mock 验收记录

日期：2026-07-28

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

R4 起始提交：`3ab373de362a36376fa3ec500be32d014e673af1`

范围：reviewed V8 Mock、Provider-like fault matrix、fresh baseline、全量静态/PostgreSQL/Compose
checkpoint；全程 zero-provider。

## 1. 结论

V8 R4 已完成。默认 V8 Mock CLI 不再以 `runtime_factory_unavailable` 结束，而是接入经过复审的
Mock factory：Tutor 复用没有变化的 V7/V6 正式 candidate 链；WrongQuestionOrganizer 则穿过 V8
fixed-shape candidate、strict schema、动态 owner authority validator、V6 本地 merger 与第一方
DeepSeek V4 Pro direct adapter。唯一替换点是 adapter 的 `fetch` delegate，且 executor/report provenance
分别固定为 `synthetic_test` / `mock_synthetic`，不能冒充真实 Provider。

进程内 responder 只读取实际 bounded system/user prompt，从公开的 subject/deck/topic ordinal 中作选择；
它不读取 dataset `expected`、oracle、真实业务 ID、owner、locked name、confidence 或写 command。Fresh
Mock 得到 `24/24` guard zero-call、`48/48` strict runtime、Tutor/Organizer/Combined semantic `1/1/1`
以及 wire `48/48/48/48`。

这些结果证明 fixed-shape request/response、wire stage、bounded diagnostic、single-dispatch、breaker、
usage、预算和本地 authority merger 的工程合同自洽；不证明 DeepSeek 真实生成质量、真实网络 P95、供应商
usage/账单、Tutor Chat 或 Organizer 产品 API/浏览器可用性。Gate 因此固定为
`mock_quality_not_evidence`。

R4 收口后，下一原子任务仅为 R5 新的一次 V8 branch controlled-Live 授权门。普通“继续”“开始”或
任何 V1--V7 历史授权都不构成 R5 授权；R6 产品验收、R7/main、Phase 6.9.8 及后续阶段继续阻断。

## 2. 为什么需要 R4

V7 reviewed Mock 能穿过旧 V6 nested output，但没有覆盖真实 Provider 常见的 fixed-shape 漂移；V8 R1/R2
已经收敛 schema 与负例，R3 又建立独立 runner/evidence lineage，但在 R4 前还没有一条正式 reviewed
Mock 同时证明以下链路：

1. 默认 CLI 真实选择 V8 factory，而不是测试注入 harness；
2. Tutor 与 Organizer 共享一个 24-pair scheduler，仍保持 lane 隔离、single dispatch 与 no retry；
3. Organizer 的 canonical success 真实经过 V8 fixed-shape schema 和动态 authority，而不是沿用 V6
   nested responder；
4. V6 nested shape、extra/missing field、数字字符串、`null` target、fingerprint/重复题/subject/target
   authority drift 都被拒绝，并只留下 bounded no-raw diagnostic；
5. Mock evidence 可以被 V8 validator 验证后精确删除，Live marker/journal/evidence 不会被创建。

因此 R4 是 R5 前的工程完整性 checkpoint，而不是为了重复证明已通过的语义结论。

## 3. 实现边界

新增：

- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v8-mock.ts`；
- `@repo/agent/phase-6-9-7-v8-mock` package export；
- `packages/agent/tests/phase-6-9-tutor-organizer-v8-fault-matrix.test.ts`；
- 默认 V8 CLI Mock factory 与 evidence validator 回归。

Reviewed Mock 固定：

- exact `https://api.deepseek.com/v1/chat/completions` request shape；
- `deepseek-v4-pro`、`thinking.disabled`、`response_format=json_object`、`stream=false`；
- Tutor `1200/300`、Organizer `3500/800` token 边界；
- 24 guard 复用正式 zero-call cases，48 runtime 复用冻结 V2 dataset；
- Tutor 继续复用 V7/V6 candidate；Organizer 使用 V8 fixed-shape output；
- responder 只解析实际 bounded prompt，不导入 expected/oracle；
- Mock 不创建 Live once marker、journal 或 recovery claim；
- Live configuration、approval、confirmation、marker 和 harness factory 路径没有放宽。

## 4. Provider-like 与生产极端边界

V8 R4 fault matrix 除了复用 V7 transport/HTTP/response/usage faults，还新增：

- 旧 V6 nested shape；
- decision extra field、missing `subjectIndex`；
- numeric-string `targetIndex`、`null` target；
- shortlist fingerprint drift；
- duplicate question ordinal；
- subject authority 与 target authority drift；
- first/middle/last breaker 位置；
- sibling abort 的 lane-local attribution；
- report 对 synthetic credential、raw error/body/reasoning/schema payload 的泄漏扫描。

Static shape failure 保持 `structured_output / provider_type_validation`，dynamic authority failure 保持
`dynamic_contract`。两者都携带固定 reason/count/type-shape fingerprint 与
`rawDataRetained=false`；guard、未启动和纯 transport/abort 不伪造字段级原因。任一 runtime contract
failure 收口当前 pair 后打开 breaker，后续 runtime 保留在固定 48 分母中，不 retry、replay、backfill
或缩小分母。

## 5. Fresh baseline 与 reviewed V8 Mock

Fresh deterministic baseline：

| 指标                |                                                               结果 |
| ------------------- | -----------------------------------------------------------------: |
| dataset SHA-256     | `42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b` |
| complete hits       |                                                            `12/48` |
| Tutor semantic      |                                               `0.6629642857142858` |
| Organizer semantic  |                                                         `0.278125` |
| Combined semantic   |                                               `0.4705446428571429` |
| Provider/token/cost |                                                                `0` |

Fresh reviewed V8 Mock：

| 指标                                            |                                   结果 |
| ----------------------------------------------- | -------------------------------------: |
| run ID                                          | `c8635a6a-0fbe-4d03-a7c9-9dd41c612d7c` |
| validator                                       |             `ok=true / filesChecked=1` |
| guard zero-call                                 |                                `24/24` |
| strict runtime                                  |                                `48/48` |
| Tutor / Organizer / Combined semantic           |                            `1 / 1 / 1` |
| Tutor intent                                    |                                `24/24` |
| Organizer subject / deck / target ordinal       |                `32/32 / 32/32 / 32/32` |
| executor / dispatch / response / verified usage |                    `48 / 48 / 48 / 48` |
| synthetic input / output tokens                 |                         `23010 / 1459` |
| synthetic estimated cost                        |                         `0.077784 CNY` |
| Tutor / Organizer P95                           |                             `6 / 2 ms` |
| paired candidate / Tutor orchestration P95      |                  `10.9255 / 8.2513 ms` |
| gate                                            |            `mock_quality_not_evidence` |

Mock evidence 已按唯一 run 的精确 path 删除，没有清空 `.tmp`。V8 marker、journal、Live evidence 与
recovery claim 检查为 0；V1--V7 sealed artifacts 保留且没有被删除、覆盖、recover、重跑或改写。

## 6. 验收矩阵

| Gate                                         | 结果                                                            |
| -------------------------------------------- | --------------------------------------------------------------- |
| V8 R4 focused                                | `51/51`，`1787` assertions                                      |
| CLI + fault matrix                           | `11/11`，`927` assertions                                       |
| Post-doc five-file V8 regression             | `29/29`，`1114` expect calls                                    |
| `@repo/agent` full                           | `907/907`，`13728` assertions                                   |
| Agent typecheck / lint                       | 通过                                                            |
| `@repo/ai` full                              | `226/226`，`1459` assertions                                    |
| AI typecheck / lint                          | 通过                                                            |
| `@repo/types`                                | `42/42` + typecheck 通过                                        |
| `@repo/server` full                          | `227` suites passed / `3` skipped；`2154` passed / `30` skipped |
| Server no-fix ESLint / build                 | 通过                                                            |
| `@repo/web` full                             | `439/439`                                                       |
| Web ESLint / production build                | 通过；17 个页面生成                                             |
| Organizer PostgreSQL E2E                     | `12/12`                                                         |
| Docker runtime boundary focused              | `3/3`                                                           |
| Compose tracked default-off `config --quiet` | exit `0`                                                        |
| V1--V7 canonical evidence validators         | 全部 `ok=true / filesChecked=1`                                 |
| contract/security/wire 独立终审              | APPROVED，无 Critical/Important                                 |
| docs/history/operations 独立终审             | APPROVED，无 Critical/Important/Minor                           |

`@repo/types` 当前 package 没有独立可运行的 ESLint dependency/config。本轮真实执行并记录的是测试与
typecheck，没有伪称 Types lint 通过，也没有为 R4 顺带扩大工具配置范围。

第一次 Server full 与其它五个全量任务并发时，唯一 readiness CLI subprocess 超过测试 harness 的 15 秒
外层上限；相同测试隔离运行 `9/9` 通过，CLI 实际约 5.2 秒。Organizer E2E 的第一次命令则遗漏
`test/jest-e2e.json`，Jest 没有发现测试，不是断言失败。修正验证入口后，Organizer E2E `12/12`、
Server no-fix lint/build 均通过；Server full 最终以 `--runInBand` 完整通过。没有为环境负载噪声修改
readiness 业务实现或放宽其产品 timeout。

PostgreSQL E2E 只复用既有 Docker PostgreSQL，没有启动、重建、删除容器或清理卷。Tracked Compose
只执行 `config --quiet`，没有输出解析后的 credential，也没有启动产品 service。

终审额外要求在发布前物理复核 artifact，而不能只引用文档声明。最终精确 `find` 检查无输出，证明当前
workspace 的 V8 marker/journal/evidence/recovery path 为 0；`git diff --check`、Agent typecheck/lint 和全部
改动文件 Prettier check 也再次通过。

## 7. 明确未发生

- 未读取、打印或修改根 `.env`、component credential 或 API key；
- 未调用 DeepSeek 或其它 Provider，未执行 V8 Live；
- 未创建 V8 Live marker、journal、evidence 或 recovery claim；
- 未启动或重建产品 Docker service、Nest API、Next Web 或可见浏览器；
- 未接入 V8 Tutor Web / Organizer Server 产品 composition；
- 未创建测试账号，未修改 PostgreSQL、Redis、MinIO 业务数据；
- 未执行 Docker `down -v`、prune、volume/database reset、Redis flush 或 MinIO wipe；
- 未开始 R5、R6、R7/main、Phase 6.9.8、Phase 6.10、Phase 8/9 或博客收尾。

## 8. 下一步与授权门

R4 独立提交并推送、local/remote SHA 一致，且双路最终复审没有未关闭 Critical/Important 后，下一原子
任务才是 V8 R5。执行前必须重新同时满足：

1. V8 Live marker/journal/evidence/recovery claim 仍为 0；
2. V1--V7 validators 与 physical history 继续通过；
3. R4 committed source、tracked defaults 与 Compose default-off 没有漂移；
4. 用户接受运行当时 DeepSeek 当前账号的数据保留/训练边界；
5. 用户精确授权唯一一次 `Phase 6.9.7 Tutor/Organizer V8 branch controlled-Live`。

R5 无论通过或失败都只允许 seal 一次，不 retry、resume、replay 或 backfill。只有 R5 全部门通过，R6
产品 Docker/API/可见浏览器才可能开始；只有 R6 与复审通过，R7/main 才可能开始。

回顾时可以问：

- “V8 Mock 为什么能证明 fixed-shape 工程合同，却不能证明 DeepSeek 真实质量？”
- “为什么 responder 必须读取实际 bounded prompt，而不能读取 expected/oracle？”
- “V8 如何区分 static shape failure 与 dynamic authority failure，又不保存 raw output？”
- “为什么 Server parallel full 的 readiness timeout 是验证负载噪声，而不是产品 timeout 回归？”
- “为什么 R4 满分仍不能跳过 R5 controlled-Live？”
