# PrepMind AI 当前状态

> 快照日期：2026-08-06
> 适用范围：当前协作与下一阶段决策
> 说明：本页是“现在应该相信什么、下一步允许做什么”的短入口；每个数字和运行结论仍以对应验收文档为证据权威。

## 一分钟结论

PrepMind AI 的 Phase 7 核心工程化、Phase 6.9.7 Tutor/Organizer 主线和 Phase 6.9.8 Retriever/FinalResponse 工程地基已完成到当前 checkpoint。

当前停在 **Phase 6.9.8 Architecture Recovery R4**：

- R0--R4 zero-provider 设计、diagnostic、runner/durability 与 reviewed Mock/static 均已完成。
- R4 的唯一 authority 是 `architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`。
- R4 证明本地生产节点、双 wire、bounded diagnostic、runner 和 scorer 在 Mock 上自洽；不证明真实 Provider、真实模型质量、产品可用性、SLA 或 main 可用性。
- R5 准入前零网络检查已完成：proxy `direct_ready / providerCalls=0`，当前治理分支 source-admission 按固定 lineage 安全返回 `source_admission_invalid`；详见 [R5 admission readiness](./acceptance/phase-6-9-8-retriever-final-response-r5-admission-readiness-zero-provider.md)。
- 下一步是 **R5 fresh admission**，目前“未授权、未开始”。普通“继续”不等于 Provider 一次性授权。

分支是否已进入 `main` 不看“完成”字样，而看 [分支关系](./branch-map.md) 中的 source tip、merge commit 和 main replay 三项证据。

## 当前允许与禁止

当前文档工作在 `drb/docs-governance-main`；它从 `main=185b8171` 创建并以 merge commit `9a2d6056`
纳入已推送的 R4 基线。`main` 与本地 `origin/main` 仍为 `185b8171`，没有被本次文档审阅修改。
完整 source/merge/replay 关系见 [branch-map.md](./branch-map.md)。

| 范围                       | 当前状态       | 允许动作                                    | 明确禁止                                            |
| -------------------------- | -------------- | ------------------------------------------- | --------------------------------------------------- |
| R4 reviewed Mock           | 已完成         | 阅读验收、复核代码、维护 zero-provider 测试 | 把 Mock 数字写成真实模型质量                        |
| Task 9C sealed Live        | 失败封存       | 只读校验既有 marker/journal/report/artifact | retry、resume、replay、backfill、追加 Provider 探测 |
| R5 fresh admission         | 未授权、未开始 | 先讨论方案和安全边界                        | 读取 credential、调用 Provider、创建 Live evidence  |
| 产品 Docker/API/可见浏览器 | R5 之前阻断    | 维护文档或零网络测试                        | 以 R4 Mock 解锁产品验收或 main                      |
| Phase 6.10 分层记忆        | 尚未开始       | 继续完善 Agent 架构文档                     | 在当前 Agent 路线未收口前提前进入                   |

不要执行 `docker compose down -v`、volume/prune、数据库 reset、Redis flush 或 MinIO wipe。验收只允许精确清理本轮合成账号、Trace、Outbox 和浏览器隔离数据。

## 关键证据入口

| 结论                                | 证据                                                                                                                                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 6.9.8 R4 Mock-only checkpoint | [R4 reviewed Mock/static](./acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock-static.md)                                                                                                                |
| R0--R3 recovery 设计与 durability   | [Architecture Recovery 设计](./superpowers/specs/phase-6-9-8-retriever-final-response-architecture-recovery-design.md)、[R3 验收](./acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r3-runner-durability-admission.md) |
| Task 9C 失败封存                    | [Task 9C controlled-Live failure](./acceptance/phase-6-9-8-task-9c-controlled-live-quality-gate-failure.md)                                                                                                                                  |
| Phase 6.9.7 已完成但 authority 分层 | [Tutor/Organizer SR7 main 验收](./acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-sr7-main-acceptance.md)                                                                                                                   |
| 当前真实数据流                      | [data-flow.md](./data-flow.md)                                                                                                                                                                                                               |
| 阶段路线与下一步                    | [roadmap.md](./roadmap.md)                                                                                                                                                                                                                   |
| 本地启动与验收命令                  | [dev-start.md](./dev-start.md)、[acceptance-checklist.md](./acceptance-checklist.md)                                                                                                                                                         |

## Agent 能力边界（当前产品视角）

“代码里有 candidate”不等于“产品默认会调用模型”。当前统一按下面三层理解：

1. **本地事实与权限层**：owner、业务事实、FSRS、索引、写权限、citation、terminal 和 fallback 必须由本地代码掌权。
2. **模型候选层**：模型只能在组件 gate、eligibility、预算、超时和 schema 全部通过时提出受限候选。
3. **产品启用层**：生产 gate 默认关闭；只有独立 controlled-Live、产品验收和 main default-off 回放都通过，才讨论启用。

当前各类证据的含义见 [文档规范](./documentation-guide.md) 的 authority 词汇表，不要把 `diagnostic_only`、`mock_quality_not_evidence`、`semantic_gate` 和 `product_default_off` 混用。

## 下一阶段的准入清单（R5）

只有以下项目全部重新满足，才可以执行唯一一次 R5 controlled-Live：

- 当前分支 clean，source commit/tag 与远程 parity 可复现；
- 分支关系已在 [branch-map.md](./branch-map.md) 登记，且 merge 后回放证据与目标分支一致；
- R4 formal evidence 仍为零，历史 Task 9C evidence SHA 只读 parity；
- zero-provider proxy preflight 重新通过；
- 用户重新接受当次 DeepSeek/Qwen 数据保留与训练边界；
- 用户给出与本次 lineage 匹配的精确一次性授权；
- credential 只在 late-binding 的受控子进程中出现，不写入文档、日志、artifact 或仓库；
- 运行失败也必须 durable seal，且不得自动重试或扩大范围。

R5 通过后仍需单独判断产品 Docker/API/可见浏览器和 main authority；R5 不是自动解锁全部后续阶段的通行证。

R5 的运行分支交接见 [branch-map.md](./branch-map.md#r5-的固定-lineage-交接2026-08-06)：正式运行不能使用当前文档治理分支，必须回到已推送的 R4 fixed lineage；这不是从功能分支再开子分支。

## 如何向协作者提问

可以直接复制下面的句式，减少上下文漂移：

- **查状态**：`请以 docs/current-status.md 为入口，说明当前阶段、唯一 authority、已完成证据和下一步阻断。`
- **查某个 Agent**：`请区分 deterministic、Mock、controlled-Live、product-default-off 和 main authority，并给出对应验收文档。`
- **继续零网络工作**：`继续当前 R4/R5 之前的 zero-provider 任务，不读取 credential、不调用 Provider、不启动产品验收。`
- **申请真实模型验收**：先明确数据边界，再写出 lineage、调用次数、预算、失败封存和精确授权；没有 exact authorization 不执行。
- **验收浏览器**：`请使用 headed 可见浏览器，保留窗口，记录 URL、账号范围、关键点击、Trace/费用和精确清理证据。`
- **更新文档**：`完成任务后同步 DEVLOG、current-status、roadmap、相关 acceptance，并说明哪些历史文档保持 as-of 不变。`

## 读者快速判断

遇到任何“已完成”表述，先问四个问题：

1. 完成的是设计、deterministic baseline、Mock、真实 Live、产品验收，还是 main replay？
2. `authority` 是什么？能否被后续阶段使用？
3. 是否有真实 Provider calls、verified usage、P95 和业务写入证据？
4. 证据是当前状态，还是带日期的历史 checkpoint？

答不出其中任意一项，就回到对应验收文档，不要只看 README 或 DEVLOG 的一句摘要。
