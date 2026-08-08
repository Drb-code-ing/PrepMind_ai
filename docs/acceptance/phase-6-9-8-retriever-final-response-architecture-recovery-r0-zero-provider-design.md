# Phase 6.9.8 Retriever / FinalResponse Architecture Recovery R0 验收

## 1. 结论

R0 已以 `zero_provider_retriever_final_response_architecture_recovery_design / qualityAuthority=none` 完成独立
Architecture Recovery 设计冻结。它解决的是“下一轮如何获得可定位、无 raw 的证据”，不是修复完成、质量通过或
Live 授权。

本次没有修改 TypeScript 生产代码、测试、Task 9C evidence 或产品配置；没有读取 credential、调用 DeepSeek/Qwen、
执行 Task 9C CLI/seal、启动 Docker/API/browser 或修改业务数据。

## 2. 输入事实

R0 只读取：

- Task 9C 失败验收与只读 validator；
- sealed report/journal 中已有固定字段；
- 当前 Task 9 live harness、runner、candidate、Qwen 与 FinalResponse 合同；
- Phase 6.9.7 Schema Recovery 的 bounded diagnostic、durability 与独立 lineage 经验。

Task 9C 保持：

- run `28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2`；
- `task9_quality_gate_failed / qualityAuthority=none`；
- `4 succeeded / 1 failed / 59 not_started_quality_breaker`；
- failure `rewrite_02.rewrite_candidate_model / schema_invalid / wire 1/1/0/0`；
- semantic/P95/token/CNY aggregate 全 `null`；
- journal `134 / evidence_published`、validator `ok=true`、recovery claim=`null`。

R0 没有恢复 Provider response，也没有把失败归因到具体 JSON、transport、账号或服务端。

## 3. 发现的结构性缺口

源码审计确认：

1. rewrite live harness 把 invocation、candidate disposition、provenance、Trace、usage 与 adapter counters 合并为一个
   postcondition，任一失败都抛 `schema_invalid`；
2. runner 的 call-result strict schema/phase mismatch 也抛同一 `schema_invalid`；
3. runner 只在 harness 返回后记录 `response_received`，所以外层 `wire response=0` 不能排除 Provider response 已在
   内层被观察；
4. Qwen retrieval 和 FinalResponse stream 也存在多个 schema/usage/ledger 阶段，不能只修当前 rewrite；
5. sealed Task 9C 没有足够 diagnostic 区分上述分支，且 raw 已按合同不保留。

## 4. 已冻结设计

- 新 lineage：`phase-6.9.8-retriever-final-response-architecture-recovery-v1`；
- 新 diagnostic：`phase-6.9.8-retriever-final-response-bounded-diagnostic-v1`；
- 分离 `providerWire` 与 `runnerWire`；
- 三类独立阶段机：DeepSeek rewrite、Qwen retrieval、DeepSeek FinalResponse stream；
- diagnostic 只允许 fixed stage/reason/type/count bucket 与 `rawDataRetained=false`；
- 明确不保存 `shapeFingerprint` 或其它 raw-derived hash；
- 保持 16 guards、64 calls、质量阈值、预算、权限、no-retry 与 breaker 不变；
- 新 runner/durability/admission/reviewed Mock 必须先全部 zero-provider 完成；
- 任何未来 Live 必须重新取得 new tag/source parity、fresh 数据边界接受与精确授权。

完整设计见
[Architecture Recovery 设计](../superpowers/specs/phase-6-9-8-retriever-final-response-architecture-recovery-design.md)，
原子路线见
[Architecture Recovery 实施计划](../superpowers/plans/phase-6-9-8-retriever-final-response-architecture-recovery.md)。

## 5. 安全与权限验收

R0 明确拒绝：

- Provider completion/stream delta、prompt、query、turn、chunk、answer、业务 ID；
- credential、URL、header、cookie、proxy/env value、raw error/stack/cause；
- Zod issue/path/value、unknown key、getter/Proxy/toJSON 结果；
- raw、截断 raw、可逆编码或 raw-derived hash；
- caller-supplied owner、Provider/model、Trace、usage、cost、wire 或 diagnostic；
- retry、repair、coercion、default、clamp、resume、replay、backfill；
- cross-owner、expired、foreign capability 或 principal drift 后的 Provider dispatch。

Hash-chain 未来只用于 journal 完整性，不对 Provider 或业务 raw 计算 hash。

## 6. Authority 与计数

| 项目                                          |   R0 结果 |
| --------------------------------------------- | --------: |
| Provider calls                                |       `0` |
| DeepSeek calls                                |       `0` |
| Qwen calls                                    |       `0` |
| Credential reads                              |       `0` |
| Task 9C evidence writes                       |       `0` |
| Recovery formal marker/journal/artifact/claim | `0/0/0/0` |
| Docker/API/browser                            |   `0/0/0` |
| Business writes                               |       `0` |
| Quality authority                             |    `none` |

R0 没有创建 approved tag、authorization/confirmation 文本或专用 credential mapping。

本次完成后的普通 Git 文档提交与分支推送不属于 formal evidence publication，也不会创建 Recovery marker、journal、
artifact 或 recovery claim。

## 7. 明确未完成

- R1 diagnostic contract、opaque capability 与 rewrite TDD；
- R2 Qwen/FinalResponse integration 与 fault matrix；
- R3 report/runner/source/CLI/durability/validator；
- R4 64-call reviewed Mock/static；
- R5 controlled-Live、R6 产品验收、R7 main；
- Task 10/11、Phase 6.9.8 收口与后续阶段。

因此当前唯一下一原子任务是 R1 zero-provider diagnostic contract / rewrite TDD。

## 8. 停止边界

- Task 9C 一次性名额已消费，禁止运行原 CLI、seal、curl、单 case或产品 API Provider 探测；
- approved tag、marker、journal、artifact 保持不可变；
- 不从四条成功调用、Mock 或其它 Phase evidence 拼接质量结论；
- R0 不解锁 credential、Provider、Docker/API/browser、Task 10/11 或 main；
- R1 必须在本 R0 文档提交、推送和只读复审完成后单独开始。

## 9. 验证结果

| 检查                               | 结果                                                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task 9C sealed bundle validator    | `ok=true`；run `28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2`；journal `134 / evidence_published`；report/artifact SHA 保持 `c612d6f7...b8b4a4 / 7d45329d...3614c` |
| 本次 13 个 Markdown 文件 Prettier  | 通过                                                                                                                                                       |
| `git diff --check`                 | 通过；仅有工作区既有 LF/CRLF 提示，无 whitespace error                                                                                                     |
| 仓库 Markdown 相对链接             | `363 files / 180 links / missing=0`                                                                                                                        |
| 当前状态冲突扫描                   | `stale_conflicts=0`                                                                                                                                        |
| 本次新增内容 credential value 扫描 | `added_secret_values=0`                                                                                                                                    |
| CodeGraph project ensure           | `Already up to date`                                                                                                                                       |
| 独立只读复审                       | failure map、历史模式、security、docs scope、无上下文 reader 与 Task 9C failure boundary 六路均无 blocker                                                  |

本任务只修改文档，因此没有把 TypeScript 单元测试、Docker/API/browser 或 Provider 调用写成 R0 验收证据。

## 10. 回顾时可以问

- 为什么 Task 9C 的 `schema_invalid` 实际覆盖多个不同本地阶段？
- 为什么 runner `wire response=0` 不能直接证明 Provider 没响应？
- 为什么 `providerWire` 与 `runnerWire` 必须分开？
- 为什么 Recovery 要同时覆盖 Qwen、rewrite 和 FinalResponse stream？
- 为什么 diagnostic 连 raw hash 和 unknown key 名也不保存？
- 为什么 R0 设计通过仍是 `qualityAuthority=none`？
