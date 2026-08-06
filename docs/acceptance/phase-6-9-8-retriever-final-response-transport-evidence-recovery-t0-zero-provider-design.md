# Phase 6.9.8 Retriever / FinalResponse Transport Evidence Recovery T0 验收

## 1. 结论

T0 已以 `zero_provider_transport_evidence_design / qualityAuthority=none` 完成独立 Transport Evidence Recovery
设计冻结。它回答的是“如何在不重跑 R5 的前提下，让未来 dispatch/response 失败证据更可判别”，不是恢复 R5
artifact、定位 R5 的唯一根因、证明 Provider 健康或通过 Agent 语义质量门。

本任务只修改设计、计划、验收与当前状态文档；没有修改 TypeScript 生产代码、测试、产品配置或 sealed evidence，
没有读取 credential、调用 DeepSeek/Qwen、启动 Docker/API/browser、写 Trace/BackgroundJob/Outbox 或业务数据。

## 2. 输入事实

T0 只使用 R5 已封存事实：

- run `34eb99be-bdeb-41e5-85cf-3c651ecefc68`；
- guards `16/16` zero-call，实际 Provider calls `4`（Qwen `3`、DeepSeek `1`）；
- 第二个 rewrite pair 的 DeepSeek 在 `provider_dispatch / unknown` 终止，breaker 后 `59` slots 未启动；
- rewrite strict `1/16`、FinalResponse strict `0/16`，semantic/P95/verified aggregate 全为 `null`；
- journal `237 / evidence_published`，validator `ok=true / bundle_valid`，artifact SHA=`423e3f2e...43b1e5`。

这些事实不能反推出 DNS、TLS、代理、账号、余额、模型权限或服务端根因。R5 marker、journal、artifact、validator、
approved tag 与一次性授权继续保持不可变。

## 3. 已冻结决策

- 新 lineage：`phase-6.9.8-retriever-final-response-transport-evidence-v1`；
- 三个 family：`rewrite`、`qwen`、`final_response`；
- 固定阶段：`preflight -> dispatch_started -> response_observed -> usage_observed -> terminal`；
- 固定 `providerBoundary` 与 `reasonCode`，`unknown` 保留为不可判别终态；
- 3 family × 8 固定边界/失败 cases + 6 abort/capability/publication cases，共 `30` cases；
- DNS/TLS/proxy/connection/envelope/schema/stream/usage 子类由 classifier fixture 覆盖，不扩大 runner 分母；
- diagnostic 只保留 fixed enum/bucket、opaque `callId`、stage/wire/count 与 `rawDataRetained=false`；
- capability 由各 family 模块私有签发，绑定 `callId + phase + family + lineage`，single-use 且 fail-closed；
- T1/T2 全部 zero-provider；T3 只有在 T1/T2 通过并取得新数据边界接受与 exact authorization 后才能评估。

完整设计见
[Transport Evidence Recovery 设计](../superpowers/specs/phase-6-9-8-retriever-final-response-transport-evidence-recovery-design.md)，
原子路线见
[Transport Evidence Recovery 实施计划](../superpowers/plans/phase-6-9-8-retriever-final-response-transport-evidence-recovery.md)。

## 4. 如何确定，而不是猜测

T0 不会重新解释历史 R5 的 `unknown`。后续 T1/T2 只通过可控 synthetic delegate 验证：

1. 已知故障是否只能映射到对应固定 bucket；
2. 缺乏足够信号时是否稳定保持 `unknown`；
3. `providerWire` 与 `runnerWire` 是否按阶段单调推进；
4. forged/reused/cross-call/cross-family/out-of-order capability 是否全部 fail-closed；
5. abort、timeout、publication failure 是否仍能形成完整 bounded terminal，而不丢任务或保留 raw。

因此未来最多 3-slot canary 即使获批，也只能回答三个第一方 adapter 的 transport/evidence contract 是否成立，不能
补写 R5 根因，更不能证明 Retriever/FinalResponse 语义、产品可用性或 SLA。

## 5. Authority 与计数

| 项目                                       |   T0 结果 |
| ------------------------------------------ | --------: |
| Provider / DeepSeek / Qwen calls           |   `0/0/0` |
| Credential reads                           |       `0` |
| R5/Task 9C sealed evidence writes          |       `0` |
| 新正式 marker/journal/artifact/claim       | `0/0/0/0` |
| Docker/API/browser                         |   `0/0/0` |
| Trace/BackgroundJob/Outbox/business writes | `0/0/0/0` |
| Quality authority                          |    `none` |

普通 Git 文档提交与分支推送不属于 formal evidence publication，也不会创建 Live reservation 或 recovery claim。

## 6. 验证结果

| 检查                                           | 结果                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| 设计/计划事实、术语与 reader questions 复核    | 通过；历史 R5 `unknown` 保持不可判别，T1/T2/T3 authority 边界明确 |
| 受影响 Markdown Prettier                       | 通过                                                              |
| `git diff --check` / staged `git diff --check` | 通过                                                              |
| 仓库 Markdown 相对链接                         | `356 files / 214 relative links / missing=0`                      |
| 本次新增内容 secret value 扫描                 | 通过；未发现真实 credential value                                 |
| CodeGraph update/ensure                        | 通过；项目索引可用                                                |

本任务只修改文档，因此没有把 TypeScript 单元测试、Docker/API/browser 或 Provider 调用写成 T0 验收证据。独立只读
子代理本轮因平台 `429` 未返回有效结果，未计入通过证据；以上结论由主代理依据当前工作树与可重算检查收口。

## 7. 明确未完成

- T1 strict contract + TDD；
- T2 30-case robustness、classifier fixture 与 durability static checkpoint；
- T3 最多 3-slot transport-only canary（未授权、未实现）；
- Retriever/FinalResponse 新语义质量门、产品 Docker/API/browser/Trace、main；
- Phase 6.9.9/6.9.10/6.10、Phase 8/9 与博客收尾。

当前唯一下一原子任务是 T1。T1 仍不得读取 credential、调用 Provider、创建正式 evidence 或修改 R5/Task 9C sealed
artifact。

## 8. 回顾时可以问

- 为什么 R5 的 `provider_dispatch / unknown` 不能在 T0 被改写成代理或网络故障？
- 为什么已知 fault bucket 与 `unknown` 的稳定区分比直接重跑更重要？
- 为什么 30-case matrix 不包含真实 Provider，也不能形成 Agent 语义 authority？
- 为什么 classifier fixture 不扩大 30-case runner 分母？
- T1/T2 通过后，最多 3-slot canary 仍不能证明什么？
