# PrepMind AI 当前状态

更新时间：2026-09-04
用途：给开发者和协作 Agent 提供一个短、可核对的项目快照。阶段细节和原始证据仍以 `docs/acceptance/` 为准。

## 一句话结论

PrepMind 的产品基础和大部分 Agent 合同已经落地，但 **Phase 6 Agent 运行时总审计仍未结束**。当前最新原子任务已在
deterministic Worker durable baseline 上补齐 Chat Stream contract、Redis bounded replay、owner-bound 状态查询和认证
`POST /chat-turns` 入队 seam；它仍不是 `/api/chat` turn-backed 产品断线恢复，也不是真实模型 Worker。

## 当前基线

- 文档入口分层整理已合并并推送；2026-09-04 的 ticket 01 已从 `main=a8a0697a` 开分支实现并以 `--no-ff` 合并推送为
  `main=582f2aef`，补齐认证 `POST /chat-turns` durable admission seam。开始新任务前用 `git rev-parse main` 与
  `git rev-parse origin/main` 核对当前主线。
- 默认运行模式：`AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`，所有组件模型 gate 关闭。
- 业务事实权威：PostgreSQL；Redis/BullMQ 负责缓存和队列；MinIO 负责对象存储；Dexie 负责本地恢复/离线补偿。
- Docker 数据必须保留。验收只允许清理本次创建的合成数据和隔离浏览器状态。

## 能力分层

| 能力                        | 当前结论                                                                                                     | 边界                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| 产品基础                    | 已实现并有阶段验收                                                                                           | 真实部署仍需独立环境检查                                                                                                              |
| RAG                         | Qwen `text-embedding-v4` / 1536；向量 + PostgreSQL full-text hybrid rank                                     | 当前没有 reranker；`fake` 只用于非生产测试                                                                                            |
| Router / Verifier           | 混合路径已实现，确定性安全门优先                                                                             | gate 默认关闭；不能用单条 smoke 推断所有 Agent                                                                                        |
| Tutor / Organizer           | 受限 candidate、权限与本地 merger 已实现，历史语义/产品证据分开保存                                          | 真实模型质量与产品 gate 仍需逐项确认                                                                                                  |
| Review / Planner            | 只读建议与受限 candidate 已实现                                                                              | 共享 ledger、持续运行证据和独立产品 Live 仍待补齐                                                                                     |
| Knowledge Dedup / Organizer | owner-scoped shortlist、受限 candidate 与 deterministic fallback 已实现                                      | 需要最新矩阵确认真实产品 smoke 状态                                                                                                   |
| Retriever / FinalResponse   | `/api/chat` 主回答链有真实模型 smoke；历史质量门失败证据不可重跑                                             | 不能据此证明上游每个 Agent 或 SLA                                                                                                     |
| Chat response worker        | Outbox -> BullMQ -> claim -> durable terminal commit；Stream contract、Redis bounded replay 和状态查询已实现 | 当前 generator 是 `deterministic-worker-v1`；`/api/chat` 尚未 turn-backed，浏览器未接入 replay；全链路 ledger、真实模型 Worker 未完成 |
| ChatTurn enqueue API        | JWT owner-bound `POST /chat-turns`；strict request/response contract；`202` 安全投影；复用同一 Turn/Job/Outbox 事务 | 当前只证明 durable admission；Web adapter、`/api/chat` bridge、Worker 产品切换和真实模型仍未完成 |
| MemoryAgent                 | PostgreSQL 候选/确认/停用/删除流程已实现                                                                     | 当前无模型 gate、自动注入或完整分层记忆实现                                                                                           |
| Tool-Using Orchestrator     | 未实现                                                                                                       | 仅在治理 catalog/规划中出现                                                                                                           |

## 证据怎么读

1. `implemented`：源码和静态/单元合同存在。
2. `mock/static validated`：reviewed Mock 或确定性回归通过，不代表 Provider。
3. `controlled-Live`：绑定独立 source/tag/授权的一次性真实 Provider 运行，失败也必须封存且禁止重跑。
4. `product real-model smoke`：指定产品入口在指定配置下成功，不自动覆盖其他 Agent。
5. `production-used`：需要持续运行、观测和业务证据，目前不因一次测试宣称。

历史 controlled-Live、marker、journal、report、artifact 和 tag 均是只读证据；不要 retry、replay、backfill、移动或改写。

## 下一步顺序

1. 完成 Phase 6 Agent 审计：逐项确认通信、owner/权限、并发、预算 ledger、取消、Trace 和真实模型产品 smoke。
2. 完成 Web enqueue adapter（ticket 02），再按依赖推进 `/api/chat` bridge、浏览器 replay、全链路 ledger 与 lease recovery。
3. 将 `/api/chat` 切换到已建立的 turn-backed + Redis/SSE replay 合同，并保留旧 snapshot sync 兼容窗口。
4. 为 Chat Worker 接入独立真实模型 gate、usage/cost 记录和产品 controlled smoke；继续保持默认 mock/off。
5. 在全部 Agent 架构完成后，设计并实现分层记忆：瞬时上下文、短期会话缓存、长期持久化记忆；再按用户要求编写两篇独立面试博客。
6. 之后进入 Phase 8 性能/PWA、Phase 9 MCP Tool 体系和 Phase 10 生产部署。

## 权威入口

- Agent 矩阵与缺口：[`phase-6-agent-runtime-audit.md`](acceptance/phase-6-agent-runtime-audit.md)
- ChatTurn 入队 API：[`phase-6-chat-turn-enqueue-api.md`](acceptance/phase-6-chat-turn-enqueue-api.md)
- Chat Stream 合同与回放：[`phase-6-chat-stream-replay.md`](acceptance/phase-6-chat-stream-replay.md)
- 本地启动与运维：[`dev-start.md`](dev-start.md)
- 当前路线：[`roadmap.md`](roadmap.md)
- 数据流：[`data-flow.md`](data-flow.md)
- 功能验收清单：[`acceptance-checklist.md`](acceptance-checklist.md)
- 历史开发事实：[`../DEVLOG.md`](../DEVLOG.md)
