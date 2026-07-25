# Phase 6.9.7 Tutor / WrongQuestionOrganizer V3 R0 零 Provider 设计验收

日期：2026-07-24

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

起点：`c23d593cc266a9cd92795bc1f6dc3c86fcb50c1b`

状态：V3 R0 设计 checkpoint 已完成；只冻结失败证据、熔断、并发、恢复、路由和后续原子计划。
没有实现 V3 源码，没有获得或执行新的 controlled-Live 授权。

## 1. 为什么需要 V3

V2 唯一 Live `67ce18dd-e2ed-4a05-8507-2a98898b8ede` 保持 `24/24` guard
zero-call，但 48 个 runtime 全部在 structured object 形成前回退：`0/48` strict runtime、
Tutor/Organizer semantic `0/0`、verified usage `0`、critical `1`，最终
`quality_gate_failed`。

安全 evidence 按设计没有原始异常、Provider response、prompt、key 或 stack，因此当前不能把失败
指定为 credential、网络、TLS、endpoint、model、request adapter 或 prompt 中的任一单一问题。
如果直接重跑，只会消费新费用并再次缺少根因证据。

## 2. 历史证据复核

本轮重新读取并计算 V2 文件 SHA-256：

- evidence：`0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77`；
- marker：`ac65ac67bd155f448e498a2c1dd9d7762d1efb4cc720a3cf1153083299c98504`。

与失败 authority 一致。V3 Live marker/journal/evidence artifact 搜索为 0；本轮没有删除、改名、
覆盖或重建 V1/V2 文件。

## 3. 源码链路抽样

主代理与四路只读审查确认：

1. `packages/ai/src/model-agent-provider-failure.ts` 已安全分类
   `http_auth/http_rate_limit/http_client/http_server/transport/structured_output/
invalid_response/unknown`，并只通过 WeakMap 传递固定枚举；
2. `packages/ai/src/model-agent-contract.ts` 的 runtime Trace 已可携带
   `providerFailureCategory` 与 `structuredOutputStage`；
3. Tutor/Organizer candidate observation 的 Trace 在正常 runtime failure 中可以保留这些字段；
4. `run-phase-6-9-tutor-wrong-question-paired.ts` 的 eval result 与
   `buildTutorEntry/buildOrganizerEntry` 没有投影 Trace failure 字段；
5. `safeTutorRuntime/safeOrganizerRuntime` catch 会把外层失败统一写为
   `runtimeInvocations=1/fallback_runtime_error/usage=null`；
6. 当前 scheduler 先并发运行 24 条 zero-call，再对 24 个 paired index 顺序推进，每 pair
   Tutor/Organizer 并发，因此首个失败后仍会继续派发后续 pair。

结论：V2 report 丢失诊断信息与缺少 breaker 是已确认的工程缺口；真实传输根因仍未知。

## 4. 冻结设计

| 维度        | V3 决策                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| history     | V1/V2 marker/evidence 永久不可变，三版 validator 互斥                                                              |
| identity    | 新 runner/prompt/approval/confirmation/marker/journal/evidence                                                     |
| taxonomy    | 复用 `@repo/ai` 固定 Provider enum，不保存自由文本/raw error                                                       |
| stage       | 有界记录 config -> executor -> request -> delegate -> response -> structured -> canonical                          |
| invocation  | 以 dispatch ledger/counter 为 authority，不由 catch 猜测                                                           |
| usage       | 区分 verified、unknown-after-attempt、absent-not-attempted                                                         |
| concurrency | 24 guard 先行；runtime 单 pair 最多双并发，不并发多个 pair                                                         |
| breaker     | 首个显式 `runtimeContractFailure` 使 `48/48` 门不可能通过，收口当前 pair 后停止派发；semantic-only mismatch 不触发 |
| denominator | 未执行 runtime 仍保留在 48 分母，明确 `not_started_quality_breaker`                                                |
| isolation   | Tutor/Organizer 独立 lane；不复制 failure category、不借预算/credential                                            |
| retry       | 无自动 retry、补跑或 replay                                                                                        |
| crash       | marker + append-only journal；崩溃后只 zero-network seal，不 resume                                                |
| evidence    | temp `wx` + fsync + hard-link final；EEXIST/hash mismatch fail-closed                                              |
| product     | 只有唯一 V3 Live 全门通过后才启动新 V3 Docker/API/headed-browser lineage                                           |

## 5. 原子执行路线

为避免再次形成十几轮碎片任务，后续压缩为四个零 Provider 工程 checkpoint：

1. R1：安全诊断投影 + zero-network compatibility harness；
2. R2：strict-gate breaker + 双 lane ledger + 固定分母；
3. R3：独立 V3 CLI + journal + crash-safe evidence；
4. R4：分支 static/Mock/full gates + 独立终审，随后停止请求新授权。

新的精确授权只允许 R5 唯一 V3 branch controlled-Live。失败立即封存；通过后才进入 R6 产品
验收、R7 分支终审、R8 main merge、R9 main default-off 回放和远程推送。

## 6. 安全与操作边界

本轮：

- 没有读取根 `.env` 或 API key；
- 没有调用 DeepSeek 或其它外部 Provider；
- 没有创建 V3 Live marker/journal/evidence；
- 没有启动、停止、重建或清理 Docker；
- 没有创建账号、错题、deck、Trace、session 或浏览器数据；
- 没有修改 source code、数据库、Redis、MinIO、容器、镜像或 volume；
- 没有合并 main 或推送远程；
- tracked Tutor/Organizer gate 的 default-off 结论没有改变。

R0 设计不构成任何网络授权。用户之前的 V1/V2 授权都不能复用到 V3。

## 7. 复审与静态检查

四路前置只读证据审查分别覆盖：

- Provider failure signal 的产生、Trace 传递和 runner 丢失点；
- 当前 pair 调度、预算、abort 与 failure storm；
- V2 failure 的可证实/不可证实边界与 zero-network adapter preflight；
- 文档历史、V3 identity、一次性授权和产品停止条件。

首轮最终复审发现并已修正：

- contract/security：原“non-strict”表述可能与 semantic mismatch 混淆；现已冻结不读取
  expected/semantic 的 `runtimeContractSuccess` predicate，并要求 semantic-only mismatch 继续完整
  48、usage/schema/abort failure 才 breaker；
- docs/history：原文提前声称复审完成但没有结果记录；现改为实际回执；
- wording：把“V3 artifact=0”精确限定为 V3 Live marker/journal/evidence artifact=0。

两路原审查者已完成 follow-up，终审结论如下：

- contract/security：`APPROVED`，无未关闭 Critical、Important 或 Minor；
- docs/history：`APPROVED`，无历史冲突、授权错误、断链或下一步混淆；
- `git diff --check`、文档链接、敏感字段、当前/历史冲突、V1/V2 SHA 与 V3 Live artifact 计数
  已在提交前完成终态复核。

## 8. 当前结论与下一步

Phase 6.9.7 仍未完成；Tutor/Organizer 真实模型产品可用性仍未确认。本 R0 检查点当时的下一步只
执行 R1 零网络源码，不读取 credential、不调用 Provider、不启动 Docker 产品验收。后续 R1 已
完成；该检查点当时下一步仅 R2。后续 R2/R3 也已完成，后续 R4 已完成；当前停在新的 V3 Live 精确授权门；证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r1-diagnostics-compatibility.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r2-breaker-lane-ledger.md`。V1/V2 不得重跑，R8、
Task 13/main、Phase 6.10 均不得开始。

回顾时可以问：

- 为什么 V2 有 runtime Trace failure category，最终 evidence 却没有？
- 为什么 `48/48` 门下首个 runtime contract failure 就足以安全熔断？
- 为什么未执行 case 必须保留分母，unknown usage 不能写成零费用？
- 为什么 Tutor breaker 不能把相同故障类别复制给 Organizer？
- 为什么 crash recovery 只能 seal，不能恢复 Provider 调用？
- R1--R4 分别关闭哪类工程风险，为什么完成后仍需新 Live 授权？
