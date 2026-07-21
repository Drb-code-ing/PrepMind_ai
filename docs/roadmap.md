# PrepMind AI 学习与开发路线图

> 当前状态：Phase 7 核心工程化里程碑已推进至 7.23.8；Phase 7.8.5 RAG runtime parity 补强已完成真实 Docker 验收。当前先完成 Phase 6.9 全部 Agent 架构，再进入 Phase 6.10 分层记忆；随后依次进入 Phase 8 性能/PWA、Phase 9 MCP Tool 体系。

## 项目目标

PrepMind AI 的目标是做成移动端优先的 AI 学习产品，而不只是聊天 Demo。最终链路包括：

- AI 聊天与拍照识题。
- 错题本与间隔复习。
- RAG 知识库。
- LangGraph Agent。
- MCP 工具体系。
- 可观测性与生产化部署。

## 总体路线

| 阶段      | 主题              | 核心技术                                                                                                                                                 | 状态                           |
| --------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Phase 0   | 架构设计          | Monorepo, Prisma, Docker                                                                                                                                 | 已完成                         |
| Phase 1   | 前端 MVP          | Next.js, Dexie, AI SDK, OCR                                                                                                                              | 已完成                         |
| Phase 2.1 | 后端基础与鉴权    | Bun, NestJS, Prisma, PostgreSQL, JWT                                                                                                                     | 已完成                         |
| Phase 2.2 | 前端接入后端 Auth | apiClient, TanStack Query, AuthGuard 迁移                                                                                                                | 已完成                         |
| Phase 2.3 | 业务 API 迁移     | REST API, server state, Dexie 离线缓存                                                                                                                   | 已完成                         |
| Phase 2.5 | 产品体验补全      | Chat-first UI, Auth UI, 个人中心, 今日任务, 视觉系统                                                                                                     | 已完成                         |
| Phase 3   | AI 讲题系统       | OCR structured output, Prompt, 多题保存, Tool Action Boundary                                                                                            | 已完成                         |
| Phase 4   | FSRS 记忆系统     | Card, ReviewLog, ReviewTask, ReviewPreference                                                                                                            | 已完成主线，后续可扩展提醒调度 |
| Phase 5   | RAG 知识库        | Qwen Embedding, pgvector cosine, PostgreSQL full-text, Hybrid Search                                                                                       | 主线已完成；Phase 7.8.5 runtime parity 已完成 |
| Phase 6   | 多 Agent 系统     | LangGraph, Router, Retriever, Tutor, Verifier, Planner, MemoryAgent, Orchestrator, Agent Eval                                                            | Phase 6.9.4.4 已在 main 完成；继续完成其余 Agent |
| Phase 6.10 | 分层记忆系统     | 结构化长期记忆注入、Episodic Memory、embedding、混合召回、过期、查看、删除与遗忘                                                                         | 全部 Agent 架构验收后启动      |
| Phase 7   | 工程化增强        | BullMQ, BackgroundJob, RAG SafetyGuard, EventBus, Swagger, Docker, Worker Observability, Durable Outbox, Worker Readiness, Operator Audit, Admin Console | 核心里程碑至 7.23.8；7.8.5 补强已完成 |
| Phase 8   | 高性能优化        | Web Worker, 虚拟列表, PWA, IndexedDB                                                                                                                     | 规划中                         |
| Phase 9   | MCP Tool 体系     | JSON-RPC, Tool Registry, Tool Calling                                                                                                                    | 规划中                         |
| Phase 10  | 生产级部署        | OpenTelemetry, Sentry, Prometheus, k6                                                                                                                    | 规划中                         |

## 已完成阶段

### Phase 0 — 架构设计

- 建立 monorepo 目录、基础 packages、Prisma schema 初稿和 Docker Compose 基础设施。

### Phase 1 — 前端 MVP

- 完成本地登录、AI 聊天、OCR、错题本、今日任务和 Dexie 本地持久化。
- 建立聊天与 OCR 统一时间线，支持 Markdown、GFM 和数学公式渲染。

### Phase 2.1 — 后端基础与鉴权

- 迁移到 Bun workspace。
- 落地 NestJS Config / Database / Health / Auth / Users 模块。
- Auth 支持注册、登录、`/auth/me`、refresh token rotation、logout。
- 接入 PostgreSQL、Prisma migration、统一响应 envelope、异常过滤器和 requestId。

### Phase 2.2 — 前端接入后端 Auth

- 封装 `apiClient`，接入 TanStack Query。
- 登录/注册、AuthGuard、session 恢复和登出改为调用 NestJS Auth API。
- Dexie 不再作为登录态权威来源，只保留业务离线缓存职责。

### Phase 2.3 — 业务 API 迁移

- WrongQuestion / ChatMessage / OCRRecord API 已迁移到 PostgreSQL。
- 新 OCR 图片通过 MinIO 保存服务端 URL。
- Dexie 降级为本地快速恢复、离线兜底、乐观更新和旧图片预览层。
- WrongQuestion / OCRRecord 写失败进入 Dexie mutationQueue，后续自动补偿同步。
- ChatMessage 使用 `/chat-messages/sync` 的会话快照幂等同步，不进入通用 mutation queue。
- `/api/chat` 加入上下文窗口；有效题目 OCR 生成 `activeStudyContext`，支持围绕当前题目继续追问。
- `/api/chat` 开发默认本地 mock，真实模型调用需要 `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true` 双开关，默认使用 `deepseek-v4-flash`，并受输入 / 输出 token 预算保护。

### Phase 2.5 — 产品体验补全

- 保持 Chat-first 主入口，侧边栏作为导航层。
- 统一注册登录页、聊天页、错题本、今日任务和个人中心视觉系统。
- 补齐个人中心、本地学习偏好、今日任务轻学习手账和 CRUD 轻提示。
- 优化 Chat / OCR 渐进 Markdown 渲染和自动滚动交互。

### Phase 3 — AI 讲题系统

目标：把“OCR Markdown 结果 + 前端解析”升级为更稳定的题目结构化识别和可扩展讲题链路。

已完成：

- 新增 `@repo/types/api/ocr-question`，定义 OCR structured output schema。
- `/api/ocr` 改为 display Markdown + structured JSON envelope 输出协议。
- OCRRecord `parsedJson` 保存结构化结果，旧 OCR 历史继续通过 legacy adapter 兜底。
- `activeStudyContext` 从结构化题目生成，支持题目 id、题型、难度和识别提醒。
- 保存错题优先使用结构化字段；多题使用 `sourceGroupId:questionId` 独立防重。
- 前端增加多题卡片、单题保存和批量保存入口。
- `createWrongQuestion` / `searchKnowledge` / `createReviewTask` 已作为 tool action proposal 边界预留，暂不自动执行。

阶段验收：

- AI 输出结构稳定，前端不再依赖脆弱 Markdown 文本解析作为主要数据来源。
- 用户追问能承接 OCR 题目上下文。
- 非题目输入不会显示错题保存入口。
- 多题图片有明确拆题和保存策略。

## 后续阶段摘要

### Phase 4 — FSRS 记忆系统

Phase 4.1 已完成第一轮错题复习闭环：

- `@repo/fsrs` 已实现纯调度器。
- Prisma `Card` 支持 `wrongQuestionId`，`ReviewLog` 记录评分日志。
- NestJS 新增 Review API，支持错题加入复习、今日到期卡片和评分。
- 错题详情可加入复习计划，今日任务可查看答案并提交 Again / Hard / Good / Easy。

Phase 4.2 已完成学习统计：

- 新增 `/reviews/stats` 与 `/reviews/logs`，基于 `Card` / `ReviewLog` / `WrongQuestion` 服务端聚合统计。
- 新增 `/stats` 学习统计页，展示复习总览、趋势、评分分布、卡片状态和最近复习记录。
- 侧边栏和今日任务页已新增学习统计入口。

Phase 4.3 已完成 ReviewTask 数据流：

- 新增持久化 `ReviewTask` 表，记录复习任务 pending / completed / skipped / cancelled 生命周期。
- 新增 `/review-tasks/today`、列表、评分、跳过和恢复 API。
- 今日任务页已迁移到 persisted ReviewTask，评分会完成任务并关联 ReviewLog。
- 跳过和恢复只改变 ReviewTask 状态，`/stats` 仍以 ReviewLog 为统计事实来源。
- `/stats` 复习趋势图已从密集柱状图收敛为稀疏刻度的轻量面积折线图。

Phase 4.4 已完成离线评分队列与提醒摘要：

- `POST /review-tasks/:taskId/rating` 支持 `clientMutationId` 幂等，重复提交同一评分命令不会重复写入 ReviewLog。
- Dexie `mutationQueue` 支持 `reviewTask/rating`，弱网或离线评分可在 session 恢复、online、focus 时自动补偿同步。
- 今日任务页展示本地待同步评分状态，评分按钮和跳过按钮会在待同步期间禁用，避免重复操作。
- 离线评分不本地推进 FSRS、ReviewLog 或统计，服务端同步成功后刷新今日复习和统计。
- 今日任务页新增 in-app 复习提醒摘要：今日待复习、已逾期、下一张和待同步评分。

Phase 4.5.1 已完成复习计划预览与统计图表升级：

- 新增 `GET /review-tasks/plan` 只读接口，基于 `Card.nextReview` 计算未来复习压力，不创建未来 ReviewTask。
- 新增 `/plan` 页面，展示未来 7 天复习压力、每日安排和高峰日提示。
- 今日任务页新增复习计划入口，未来日期只提示“到期后处理”，今日仍跳转 `/today`。
- `/stats` 升级为客户端 ECharts 图表，覆盖复习趋势、评分分布和卡片状态，保留空数据与 fallback 展示。

Phase 4.5.2 已完成复习容量偏好与加权压力模型：

- 新增 `ReviewPreference` 账号级复习偏好，支持每日分钟、每日卡片上限、提醒时间、提醒开关和 7 / 14 天计划窗口。
- 新增 `/review-preferences` 读取与 PATCH API，偏好以 PostgreSQL 为权威来源。
- `/review-tasks/plan` 压力模型升级为 `到期数量 + 逾期惩罚 + 难度权重 + 稳定性权重 + 用户每日容量约束`。
- `/plan` 展示容量偏好、压力分、容量状态、原因标签和 7 / 14 天计划。
- `/today` 展示当天预计复习分钟与容量状态，仍不改变离线评分语义。

Phase 4 后续如继续扩展，可围绕浏览器通知、BullMQ 定时提醒和更细的长期计划策略推进；当前主线已进入 Phase 5。

### Phase 5 — RAG 知识库

Phase 5.0 已完成设计与 Phase 5.1 实施计划：

- 明确 RAG 是 Chat 的增强层，不是阻塞层；无资料、未命中或检索失败时继续普通 AI 回答。
- 第一版资料来源以用户上传 PDF / TXT / Markdown 为主，OCR、错题和聊天沉淀只预留 `sourceType`。
- 复用现有 `Document` / `Chunk` 草案模型，后续以 PostgreSQL + pgvector 为权威来源。
- Phase 5.1 先落地数据模型、pgvector 索引预留和 `@repo/types` knowledge API contract。

Phase 5.1 已完成 RAG 数据模型和共享 contract 基础：

- `Document` 补齐 `sourceType`、`errorMessage`、`contentHash` 和 `processedAt`。
- `Chunk` 补齐 `tokenCount`，`embedding` 固定为 `vector(1536)`。
- 新增 `DocumentSourceType`，第一版以 `UPLOAD` 为主，预留 `NOTE`、`WRONG_QUESTION`、`OCR` 和 `CHAT`。
- 新增 `@repo/types/api/knowledge`，覆盖文档响应、列表查询、列表响应、检索请求和检索响应 schema。
- 新增 pgvector ivfflat 索引迁移，为后续相似度检索预留。

Phase 5.2 已完成文档上传与状态 API：

- `/knowledge/documents` 支持上传、列表、详情和删除。
- 支持 PDF / DOCX / Markdown / TXT，上传原文件保存到 MinIO。
- 服务端创建 `Document(PENDING, sourceType=UPLOAD)`，以 PostgreSQL 为权威来源。
- 所有文档 API 按当前 `userId` 隔离；删除会级联未来 chunks，并尽力删除 MinIO 对象。

Phase 5.3 已完成文档处理与 embedding 入库：

- 新增 `POST /knowledge/documents/:id/process`。
- 支持 TXT / Markdown / DOCX / PDF 基础文本解析。
- 使用 `@repo/rag` 段落感知分块。
- 当前真实 embedding 标准路径为 Qwen `text-embedding-v4` / 1536；production 要求 provider/model 显式配置，Qwen 还要求无凭据 HTTPS base URL 和规范 `QWEN_API_KEY`，不做 provider fallback。`fake` 仅用于非 production 测试。
- `Chunk.embedding vector(1536)` 通过 raw SQL 持久化，写入前校验 document/user ownership。
- `Document` 状态流为 `PENDING -> PROCESSING -> DONE / FAILED`；空文本、零 chunk、解析或 embedding 失败进入 `FAILED`。
- forced reprocess 会先清旧 chunks，避免 stale retrieval。

Phase 5.4 已完成检索 API：

- 新增 `POST /knowledge/search`。
- 当前检索先后召回 pgvector cosine 向量候选与 PostgreSQL full-text 关键词候选两路结果，按 `chunkId` 去重后 hybrid rank；无 reranker。
- 支持 `limit`、`minScore` 和按 `documentId` 过滤。
- 检索结果返回 score、chunk metadata 和 document metadata。

Phase 5.5 已完成 Chat RAG 增强与引用展示：

- `/api/chat` 在有 access token 时调用 `/knowledge/search`，使用最新用户消息构造检索请求。
- 命中知识库后将 chunks 注入 system prompt，作为回答参考而不是绝对真理。
- 助手消息末尾追加 Markdown “参考资料”，展示文档名、片段序号和相似度。
- 无 token、无资料、无命中、检索失败或 token 预算不足时降级为普通 Chat，不阻塞用户提问。
- 资料可信度评估已在 Phase 6.3 通过 `KnowledgeVerifierAgent` 接入。

Phase 5.6 已完成知识库页面体验打磨：

- 新增 `/knowledge` 学习资料工作台。
- 前端新增 knowledge API client、TanStack Query hooks 和展示 helper。
- 页面支持资料上传、列表读取、处理、替换上传、删除内联确认、状态摘要和检索测试。
- 服务端按同用户 `contentHash` 做轻量去重：重复上传返回已有资料；替换上传保留同一 `Document.id` 并重置为 `PENDING`，并通过快照条件避免并发处理或并发替换覆盖当前资料。
- 文档处理链路在 claim、清 chunk、写 chunk、标记完成/失败时持续校验 `status=PROCESSING + storageKey + contentHash`，chunk 替换事务使用 `SELECT ... FOR UPDATE` 锁定当前 Document 行，避免旧处理流写入新资料 chunks。
- 资料卡片改为右上角三点菜单承载处理、重新上传和删除，点击页面其它区域可收起菜单，已入库资料不再展示主按钮式重新处理。
- 检索测试展示命中文档、片段序号、相似度和内容摘要；无命中时明确提示 Chat 仍可普通回答。
- 侧边栏新增“知识库”入口，保持 Chat-first 主入口不变。
- 页面在线直连 knowledge API，不进入 Dexie `mutationQueue`。

后续拆分：

- Phase 5.1：RAG 数据模型、pgvector 索引预留、knowledge API contract。（已完成）
- Phase 5.2：文档上传与状态 API。（已完成）
- Phase 5.3：解析、分块、embedding 入库。（已完成）
- Phase 5.4：检索 API。（已完成）
- Phase 5.5：Chat RAG 增强和引用展示。（已完成）
- Phase 5.6：知识库页面体验打磨。（已完成）

### Phase 6 — 多 Agent 系统

- Phase 6 是 PrepMind 的核心亮点阶段，目标使用 LangGraph 编排多 Agent，不使用 AutoGen；当前只有 graph descriptor 与分散的 policy/service orchestration，Phase 6.9.10 才完成可执行图。
- 总体 Agent 拆分为 11 个当前逻辑节点：`RouterAgent`、`RetrieverAgent`、`TutorAgent`、`KnowledgeVerifierAgent`、`FinalResponseAgent`、`WrongQuestionOrganizerAgent`、`ReviewAgent`、`PlannerAgent`、`MemoryAgent`、`KnowledgeDedupAgent`、`KnowledgeOrganizerAgent`，外加待实现的 `Tool-Using Orchestrator`。`TutorAgent / AnswerAgent` 是旧能力合称，不重复计数。
- 2026-07-15 路线决策：先完成 12 个 Agent/Orchestrator 的模型路径、通信、权限、可执行 LangGraph 与全链路验收，再进入 Phase 6.10 分层记忆；权威设计见 `docs/superpowers/specs/2026-07-15-phase-6-9-agent-architecture-completion-design.md`。
- Phase 6.0 已完成 Agent Runtime 地基：共享 Agent contract、`AgentState`、`ActionProposal`、RouterAgent、阈值 guard、运行 recorder、graph descriptor 和降级链路。
- Phase 6.1 已完成 Router + Tutor Chat 接入：`/api/chat` 通过 `chat-agent-runtime` adapter 调用 RouterAgent，并保留原有 streaming、RAG、OCR activeStudyContext、mock/live 双开关和 token 预算。
- Phase 6.2 已完成 TutorAgent 策略层：`TutorAgent` 作为确定性 policy 识别 `explain_solution`、`socratic_hint`、`step_check`、`concept_bridge`、`answer_direct` 和 `general_follow_up`，并生成短策略 prompt 与 mock strategy metadata。
- Phase 6.3 已完成 KnowledgeVerifierAgent：`@repo/agent/knowledge-verifier` 作为确定性 policy 在 RAG 命中后评估资料状态为 `trusted / suspicious / conflict / insufficient / skipped`，并向 Chat RAG prompt 注入保守使用规则。
- Phase 6.4 已完成 WrongQuestionOrganizerAgent：`@repo/agent/wrong-question-organizer` 作为确定性 policy，根据错题结构化字段和已有 deck 摘要推荐学科组与专题 deck。
- Phase 6.5 已完成 ReviewAgent / PlannerAgent：`@repo/agent/review` 和 `@repo/agent/planner` 作为确定性 policy，基于当前用户错题、复习日志、ReviewTask 计划和偏好生成只读复习诊断与学习计划建议。
- Phase 6.6 已完成 MemoryAgent：`@repo/agent/memory` 作为确定性 policy，基于当前用户学习信号生成长期记忆候选；`UserMemoryCandidate` 和 `UserMemory` 以 PostgreSQL 为权威来源，候选必须经用户确认后才成为正式记忆。
- Phase 6.7 已完成 Agent Trace / Eval：新增固定 deterministic eval set、`/agent-traces` 在线账号级观测 API、`/api/chat` best-effort trace capture、估算成本看板和 `/agent-trace` 调试台；trace 写入失败不影响 streaming / 流式回答。2026-07-15 补齐默认 Live `deepseek-v4-flash` 的集中 USD 价格快照，新的 Trace 正确标记 `pricingKnown=true`；未知模型保持“未配置单价”，旧 Trace 不回填。
- Phase 6.8 已完成 KnowledgeDedupAgent / KnowledgeOrganizerAgent：`@repo/agent/knowledge-dedup` 和 `@repo/agent/knowledge-organizer` 作为确定性 policy，基于当前用户资料元数据和少量 chunk 摘要判断重复资料、疑似新版、互补资料，并给出集合与标签建议；`GET /knowledge-agent/suggestions` 是认证、用户隔离、只读的在线建议 API，`/knowledge` 页面已展示资料管理建议面板。
- Phase 6.9.1 已完成 Agent 评测基线：统一 deterministic/Mock/Live run、summary 和模型路径启用决策 contract；`phase-6.9-seed-v1` 包含 Router、Verifier、Memory 各 8 个可执行 case 和 Orchestrator 8 个 expectation-only case。当前 deterministic baseline 为 21/24，并记录 1 个 MemoryAgent 敏感凭据 critical failure，作为后续候选模型必须超越的证据。
- Phase 6.9.2 已完成共享 Model Agent Runtime：`@repo/ai` 统一 Mock/Live Zod 结构化输出、不可变 run budget、live guard、超时/取消、安全错误与脱敏 Trace；OpenAI-compatible executor 由 composition root 注入，API key 不进入 package 配置、结果或 Trace。本阶段未迁移 Chat streaming、未模型化业务 Agent、未调用真实模型。
- Phase 6.9.3.3 已完成 rolling summary/CAS：prepare 按 12 条未覆盖消息或 70% token pressure 触发，只覆盖完整 assistant 轮次；ModelAgentRuntime 调用在事务外，Serializable 事务内复核 source hash 并用 summaryVersion CAS 推进。输入/输出凭据、usage 上限、first-create/update/stale race 均 fail-closed。
- Phase 6.9.3.4 已完成 Web context 编排：conversationId 在 sync 后进入后续 request，live auth 先于 token+id prepare；10 秒有界 timeout/request abort 与固定 degraded 允许 Mock Chat 继续。assembler 独立预算 agent/state/OCR/recent/RAG/summary，mandatory 只由 base/latest user 触发 413，optional 不会触发；RAG drop 清引用，summary 仅在 dropped history 时注入，headers/Trace 不含正文。Dexie v9 只缓存 sanitized state，并以用户级串行队列、版本单调、expiry 和身份清理保证恢复安全。
- Phase 6.9.3.5 已完成 Docker Mock/Live 收口：Mock 覆盖 12 条触发、复用、ownership、CAS/stale、Dexie 白名单与安全 Trace；DeepSeek Live 通过共享 executor JSON mode 生成 strict `conversation-summary-v1`，version/watermark 为 `1/15`，最终 Chat 保留二次函数判别式与正确值 `1`。Trace 新增 bounded `layerTokens`，不含正文。结束后恢复 Mock，并严格清理 7 个合成账号、4 个会话、级联 summary/state/cache 和测试浏览器 storage；证据见 `docs/acceptance/2026-07-11-phase-6-9-3-conversation-memory.md`。
- Phase 6.9.4.1 已固定 Router 60 / Verifier 40 的 `phase-6.9-router-verifier-v1`、专项 metrics 和 deterministic CLI。baseline 为 74/100、critical=2；Router 歧义 macro-F1 52.47%，Verifier 复杂冲突 recall 0%，prompt injection release 0。当前 Enabled=no，失败样本保留给后续同 case candidate 对照；证据见 `docs/acceptance/phase-6-9-4-1-router-verifier-baseline.md`。
- Phase 6.9.4.2 已完成 Router / Verifier Mock candidate contract：candidate eligibility 与 safety gate 在 runtime 前零调用拦截，Router 权限只由 canonical map 重建，Verifier high-risk 整批阻断并使用 literal evidence code 的 strict discriminated union 与稳定 chunk 排序。schema、budget、timeout、abort、hostile accessor、runtime budget mutation 和 telemetry unavailable 均 fail-closed；真实 provider input usage 不会被工程估算误拒，无法验证 telemetry 时按 preview budget 记账防止重试超卖。Envelope/Trace 不含 prompt、chunk、output、raw error 或 credential 正文。当前 `Enabled=no`、`Reason=paired_candidate_not_run`；Mock 只证明工程 contract。证据见 `docs/acceptance/phase-6-9-4-2-router-verifier-mock-candidate.md`。
- Phase 6.9.4.3 的 deterministic/Mock、五次不可拼接 Live、diagnostics、400-token headroom、strict-tool 历史实验、JSON-mode resolution 与唯一完整 controlled-Live 已完成。新 run 固定 runner-v3 + `deepseek_json_object_v1`，结果为 `28/28 strict success`、`72/72 zero-call`；Verifier 通过，Router additional P95 `4264ms` 超门槛。Fresh Agent/AI 为 345/151 passed，Mock 为 `100/28/0/28/72`。当时的生产决策是 Router 继续 deterministic；该延迟失败作为历史证据保留，不再解释为永久禁止 Router 模型。后续 Phase 6.9.4.4 已完成高置信/安全 zero-call、歧义 Router 真实模型和失败 deterministic fallback 的受控生产接入并恢复默认关闭。证据见 `docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md`。
- Phase 6.9.4.4 Task 8 已完成 Docker Web runtime 接线与默认关闭配置。Router 的安全/高置信请求保持 deterministic zero-call，歧义/上下文请求才允许真实模型；Verifier 仅在 RAG 证据通过 prompt injection、high-risk、credential material 等本地零调用安全门后，按 semantic-needed 调用模型。独立 gate、5 秒/4 秒 timeout、共享单请求 `2 calls / 2400 input / 800 output` 预算、JSON-object + canonical Zod、限制性 fallback 与安全 Trace/headers 均为生产边界。Task 9 controlled-Live、Docker、可见浏览器验收前 gate 继续默认关闭。权威路线见 `docs/superpowers/specs/2026-07-15-phase-6-9-agent-architecture-completion-design.md`；Memory、Orchestrator、其余 Agent 与 Phase 6 尚未完成。
- Phase 6.9.4.4 已完成。Task 9 分支 gates 为 Agent 374/374、AI 151/151、Web remediation 后 407/407、Server 735 passed / 2 skipped；最小 controlled-Live harness 为 5/5 strict success。Task 10 在 main merge commit `b58e8d5` 重跑静态门禁：AI 151/151、Server 737 passed / 2 skipped、Web 407/407、lint/build/typecheck 与 Compose 全部通过。可见 Docker 浏览器复验 Router contextual-reference `candidate_applied / 4048ms / 295+240 tokens`、Verifier conflict `candidate_applied / 2618ms / 536+186 tokens` 与 injection provider 前 `safety_blocked / 0-call`；新的 `deepseek-v4-flash` Trace 为 `pricingKnown=true / 0.000389 USD`。两次历史 `study_plan` timeout 继续作为 fallback 时延风险保留。`de41de9` 修复 Docker Chat RAG internal API 优先级，direct/Chat parity 通过。Docker 已恢复 Mock/default-off，各轮 synthetic PostgreSQL/Redis/浏览器数据清理为 0；Admin 本轮未改源码，其镜像重建受 Prisma 官方二进制外部网络失败阻断，现有容器仍返回 200。证据见 `docs/acceptance/2026-07-14-phase-6-9-4-4-router-verifier-production.md`。
- Phase 6.9.5 的 ReviewAgent / PlannerAgent 已完成受限只读真实模型路径。模型只返回产品实际合并的 `focusIndexes` / `blockOrder`；本地 merger 始终掌握 owner-scoped facts、FSRS、分钟数、链接、任务与全部写权限。V10 唯一 controlled-Live 是语义质量 authority：`23/22`、`48/48` strict/quality、critical `0`、P95 `1465ms`、usage `5764/232`、CNY `0.018684/1.00`。V22 的一次 product 终止与 recovery 均作为不可重跑历史保留；修复 aggregate API timing 与 candidate-step Trace timing 的错误精确耦合后，用户授权下的独立 DeepSeek V4 Pro Docker API 与可见 `/plan` 验收均返回 `candidate_applied`。main `3aff6cc` 已完成静态、新镜像 Docker、可见 deterministic `/plan` 和精确清理回放；两个产品 gate 和 live-call gate 保持 `false`。完整记录见 `docs/acceptance/2026-07-20-phase-6-9-5-review-planner-production.md`。
- V9 唯一 controlled-Live 已完成并封存：`23` provider attempts、`22` paired admissions、`26` verified zero-call、`48` strict successes，P95 `1396ms`、usage `7943/510`、CNY `0.026889/1.00` 均在门内；但 quality `30/48`、semantic `4/22`、critical `2` 导致 durable reader 为 `finalized / invalid_attempted / closed / quality_gate_failed`。V1--V9 继续只读；没有 success seal，Review/Planner 产品 gate 缺省关闭，产品仍 deterministic。Product authority 只接受 `finalized / complete / closed / passed + 23 provider / 22 paired admission + lowercase SHA-256`，当前在 ledger、Prisma、Docker、浏览器前阻断，不回退 V8 或 `git show`。详情见 `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`。
- 后续 Agent 架构优化执行文档见 `docs/superpowers/plans/2026-06-29-agent-architecture-optimization.md`，重点是状态控制面、工具可靠性、RAG 冲突处理、后台任务事件化和 Reflexion 验收，而不是立刻放开全自主写操作。
- 当前离线补强已将评测集固定为 `phase-6.9-review-planner-v2`：26 条 zero-call case 必须实际经过候选安全/资格/预算/abort gate，22 条 runtime case 覆盖多种诊断、排序和策略；`zeroCallVerified` 进入 report contract，任何意外调用都会关闭生产决策。live provider 缺失、非法或 `0/0` usage 只会 `invalid_response` 回退，Trace 仅在成功且正数 usage、集中单价完整时显示已知估算成本。以上不构成新的 Live、Docker 或浏览器证据，两个业务 gate 仍为 `false`。
- 独立 Qwen Chat v5 目前只有零网络设计文档：`docs/superpowers/specs/2026-07-17-phase-6-9-5-qwen-controlled-live-v5-design.md`。它不重试或替代 v1--v5；在实现或一次 provider 调用前，仍需受审计的精确 Qwen Chat 价格 profile、来源日期/计量依据与独立总费用上限。
- 当前实现事实：Router/Verifier 已完成混合模型生产接入且默认 gate 已恢复关闭；KnowledgeDedup 与 KnowledgeOrganizer 已完成受治理 candidate、本地权威 merger、owner snapshot/stale fence、owner-scoped pgvector shortlist 与 default-off DeepSeek runtime composition，但尚未编排到产品 API 或完成真实 provider 验收；Tutor、WrongQuestionOrganizer 与 Memory 仍是 deterministic policy。Review/Planner 的 V9 失败作为只读历史保留，后续 V10 语义质量 authority、独立 DeepSeek V4 Pro Docker API/可见浏览器验收和 main default-off replay 已证明其受限真实模型 candidate 可用；产品 gates=false 表示默认安全回滚状态，不再表示“真实模型不可用”。FinalResponse 由既有 `/api/chat` mock/live 链路承担；Retriever 由 Qwen embedding + pgvector/关键词混合检索承担。
- 模型目标：Review、Planner、KnowledgeDedup、KnowledgeOrganizer、FinalResponse、Memory 候选提取和 Orchestrator 必须有真实模型参与；Router、Tutor、Verifier、WrongQuestionOrganizer 与 Retriever 使用模型/规则混合路径。权限、安全、事实计算、schema、预算、人审和写库仍由本地权威代码控制。
- 当前不把 `UserMemory` 自动注入 `/api/chat`，也不在每次 Chat 中自动执行 MemoryAgent；后续个性化回答需要单独设计用户开关、prompt 预算和可见提示。
- RAG 资料不是绝对真理，只是用户私有上下文证据；KnowledgeVerifierAgent 会在检索命中后评估资料片段，避免 AI 盲从错误笔记。
- 当用户上传资料可能有误时，AI 应优先给出更可靠的解法，并轻提示用户核对对应笔记片段，而不是盲从错误资料或直接宣称用户笔记错误。
- 错题整理作为 Phase 6 的明确子模块已落地：错题本首页按学科卡片优先展示，例如“高等数学”“大学英语”；学科内部再按专题 deck 拆分，例如“曲线积分与格林公式”“四级阅读长难句”。
- `WrongQuestionOrganizerAgent` 基于结构化 OCR、错题知识点、错因、题型、难度和用户备注，推荐错题所属学科组与专题 deck，并在没有合适专题时生成默认专题名。
- `KnowledgeDedupAgent / KnowledgeOrganizerAgent` 资料管理方向已落地：用户打开 `/knowledge` 时，前端调用 `GET /knowledge-agent/suggestions` 展示疑似重复、疑似新版、同主题互补、资料集合和标签建议；建议只帮助用户判断，不自动删除、合并、替换、重命名或写入分类。
- 用户拥有最终组织权：可重命名卡片、移动错题、合并专题；用户手动修改后的名称需要锁定，AI 后续只做建议，不自动覆盖。
- 数据模型已落地 `WrongQuestionSubjectGroup`、`WrongQuestionDeck` 和 `WrongQuestionDeckItem`，保持 WrongQuestion / Card / ReviewLog / ReviewTask 作为事实来源，错题集只作为组织层。
- Organizer API 已落地：`GET /wrong-question-groups`、`GET /wrong-question-groups/:subjectGroupId/decks`、`GET /wrong-question-decks/:deckId/questions`、`POST /wrong-question-organizer/organize/:wrongQuestionId`、`POST /wrong-question-organizer/organize-batch`、`PATCH /wrong-question-decks/:deckId`、`POST /wrong-question-decks/:deckId/items`、`DELETE /wrong-question-decks/:deckId/items/:wrongQuestionId`。
- `/error-book` 已升级为学科卡片 -> 专题 deck -> 错题列表的下钻结构，保留错题详情、备注、掌握状态、删除确认和加入复习。
- ReviewAgent / PlannerAgent API 已落地：`GET /review-agent/suggestions` 经过认证，按当前用户读取 Card、ReviewLog、ReviewTask 计划、ReviewPreference 和错题组织摘要，生成 `/plan` 完整建议与 `/today` 紧凑建议。
- ReviewAgent / PlannerAgent 当前边界：只读建议，不创建 `ReviewTask(source=PLANNER)`，不写 Card / ReviewLog / ReviewPreference / WrongQuestion / deck，不进入 Dexie `mutationQueue`。Phase 6.9.5 真实模型路径已验收但 gate 默认关闭；FSRS、容量事实、写操作和用户确认始终由后端控制。
- MemoryAgent API 已落地：`GET /memory-agent/candidates`、`POST /memory-agent/candidates/generate`、`POST /memory-agent/candidates/:id/accept`、`POST /memory-agent/candidates/:id/reject`、`GET /user-memories`、`PATCH /user-memories/:id`、`DELETE /user-memories/:id`。
- MemoryAgent 当前边界：候选需用户确认，不静默创建正式记忆；不写 Chat / Review / WrongQuestion 事实表，不进入 Dexie `mutationQueue`，不自动注入 Chat prompt。Phase 6.9.9 只增加受控真实模型候选提取；Chat 注入、召回与情景记忆延后至 Phase 6.10。
- Agent Trace 边界：`/agent-traces` 不进入 Dexie `mutationQueue`，不保存完整 prompt、完整回答、完整 RAG chunk 或 API key；`/agent-trace` 成本看板只展示估算成本，不替代供应商账单。
- KnowledgeAgent 当前边界：`/knowledge-agent/suggestions` 经过 `JwtAuthGuard`，Service 在单个 `REPEATABLE READ` + `READ ONLY` 事务内按当前 `userId` 构造最多 20 份资料的不可变 owner snapshot，并在 provider 前和 candidate 后重验完整 fingerprint；该接口不写 Document / Chunk / 分类表，不进入 Dexie `mutationQueue`，失败只影响建议面板。Phase 6.9.6 已完成受限语义 candidate、本地 merger、owner-scoped pgvector shortlist、default-off DeepSeek runtime、独立 gate 并行 dispatch、strict runtime metadata、parent+2-step Trace、`/knowledge` local/hybrid/degraded 只读来源状态，以及 strict Mock paired runner/evidence validator；全阶段继续禁止自动删除、替换、合并或分类。
- Phase 6.9.6 推荐方案复用当前用户已持久化的 Qwen `text-embedding-v4` / 1536 安全 Chunk embedding，按 `knowledge-semantic-shortlist-v1` 形成最多 12 个候选 pair；DeepSeek V4 Pro 只裁决本地 ordinal 与严格关系/标签 schema，本地 merger 重建 document ID、时间、recommendation 和全部权限。数据集 `phase-6.9-knowledge-agents-v1` 共 72 case，其中 24 条已经在 Mock runner 中以独立 guard 结果和 runtime counter 验证 provider 前零调用，48 条组成 24 次 Dedup/Organizer paired runtime；两个 server gate 继续默认关闭。当前已完成 baseline、strict schema、安全 projection、两个 candidate/merger、owner snapshot/双 stale fence、owner-scoped pgvector shortlist、default-off DeepSeek runtime/精确价格/共享预算、Service/API/Trace 并行编排、`/knowledge` 来源 UI、strict Mock/Live CLI/evidence contract，以及 API-only Docker credential/gate/timeout 运维边界；尚未执行 controlled-Live 和 Docker/浏览器生产验收。详见 `docs/superpowers/specs/2026-07-21-phase-6-9-6-knowledge-agents-design.md`。
- Phase 6 总体设计见 `docs/superpowers/specs/2026-06-19-phase-6-multi-agent-collaboration-design.md`；错题整理详细设计见 `docs/superpowers/specs/2026-06-21-phase-6-4-wrong-question-organizer-design.md`；复习计划 Agent 详细设计见 `docs/superpowers/specs/2026-06-22-phase-6-5-review-planner-agent-design.md`；MemoryAgent 详细设计见 `docs/superpowers/specs/2026-06-28-phase-6-6-memory-agent-design.md`；Agent Trace / Eval 详细设计见 `docs/superpowers/specs/2026-06-28-phase-6-7-agent-trace-eval-design.md`；KnowledgeDedupAgent / KnowledgeOrganizerAgent 详细设计见 `docs/superpowers/specs/2026-06-29-phase-6-8-knowledge-agents-design.md`。
- Phase 6.0 / 6.1 / 6.2 / 6.3 / 6.4 / 6.5 / 6.6 / 6.7 / 6.8 详细设计与实施计划见 `docs/superpowers/specs/2026-06-20-phase-6-0-agent-runtime-design.md`、`docs/superpowers/specs/2026-06-20-phase-6-1-router-tutor-chat-integration-design.md`、`docs/superpowers/specs/2026-06-20-phase-6-2-tutor-agent-policy-design.md`、`docs/superpowers/specs/2026-06-21-phase-6-3-knowledge-verifier-design.md`、`docs/superpowers/specs/2026-06-21-phase-6-4-wrong-question-organizer-design.md`、`docs/superpowers/specs/2026-06-22-phase-6-5-review-planner-agent-design.md`、`docs/superpowers/specs/2026-06-28-phase-6-6-memory-agent-design.md`、`docs/superpowers/specs/2026-06-28-phase-6-7-agent-trace-eval-design.md`、`docs/superpowers/specs/2026-06-29-phase-6-8-knowledge-agents-design.md` 以及对应 `docs/superpowers/plans/` 文件；Phase 6.8 实施计划见 `docs/superpowers/plans/2026-06-29-phase-6-8-knowledge-agents.md`。

后续拆分：

- Phase 6.0：Agent Runtime 地基。（已完成）
- Phase 6.1：RouterAgent + Tutor 路由接入 Chat。（已完成）
- Phase 6.2：TutorAgent 策略层。（已完成）
- Phase 6.3：`KnowledgeVerifierAgent`，RAG 命中后评估资料可信度与温和资料核对提示。（已完成）
- Phase 6.4：`WrongQuestionOrganizerAgent`，错题本学科卡片和专题 deck。（已完成）
- Phase 6.5：`ReviewAgent / PlannerAgent`，复习分析和学习计划建议。（已完成）
- Phase 6.6：`MemoryAgent`，长期记忆候选、人审确认和撤销。（已完成）
- Phase 6.7：Agent Trace UI、估算成本看板和固定评测集。（已完成）
- Phase 6.8：`KnowledgeDedupAgent / KnowledgeOrganizerAgent`，资料重复、新版、互补判断和只读资料整理建议。（已完成）
- Phase 6.9.1：Agent eval contract、seed baseline、评测报告模板和路线调整。（已完成）
- Phase 6.9.2：共享 Model Agent Runtime、Mock runtime、live guard、预算与脱敏 Trace。（已完成）
- Phase 6.9.3.1：ConversationSummary / ConversationState contract 与 PostgreSQL/Prisma 地基。（已完成）
- Phase 6.9.3.2：ConversationState、Redis 降级缓存与 prepare API。（已完成）
- Phase 6.9.3.3：滚动摘要、ModelAgentRuntime、source hash 与并发 CAS。（已完成）
- Phase 6.9.3.4：Web prepare、分层 context assembler 与 Dexie 恢复。（已完成）
- Phase 6.9.3.5：Docker Mock、受控 Live、临时数据清理与阶段证据。（已完成）
- Phase 6.9.4.1：Router/Verifier 扩展数据集、专项指标与 deterministic baseline。（已完成）
- Phase 6.9.4.2：Router/Verifier Mock candidate contract 与安全降级。（已完成）
- Phase 6.9.4.3：同 case deterministic / Mock / controlled-Live paired eval；当前 Live complete，但 Router `latency_budget_exceeded`，候选与生产路径保持关闭。（验收未完成）
- Phase 6.9.4.3 diagnostics：无正文、固定码的共享 provider failure 分类与 evidence 合同。（已完成零网络验收）
- Phase 6.9.4.3 headroom：Router/Verifier 400-token 单次 output、11,200 global cap 与 pricing/strict evidence contract。（已完成 TDD）
- Phase 6.9.4.3 Attempt D：400-token headroom 后 Router 15/16 strict success，最后固定 case 仍 `structured_output`。（已完成证据检查点）
- Phase 6.9.4.3 structured-output resilience：DeepSeek Beta strict-tool transport、schema compiler、零副作用 preflight、runner v2 evidence（已完成零网络 checkpoint）
- Phase 6.9.4.3 Attempt E：strict-tool 首个 eligible case 为 `http_client`；客户端 wire 符合公开基础约束，但模型级 compatibility 与具体 4xx 未知。（已完成证据检查点）
- Phase 6.9.4.3 JSON-mode resolution：runner-v3 / `deepseek_json_object_v1`、标准 URL、prompt/evidence identity 与零网络门禁。（已完成 checkpoint）
- Phase 6.9.4.3 controlled-Live：JSON mode 完整运行成功，Router latency gate 失败，terminal deterministic fallback。（已完成结论）
- Phase 6.9.4.4 Task 8：Router/Verifier Docker Web gates、默认关闭配置与运维文档。（已完成）
- Phase 6.9.4.4 Task 9：在分支完成完整 gates、Mock、controlled-Live、Docker、可见浏览器验收、合成数据精确清理和 evidence/current-doc 提交。（已完成）
- Phase 6.9.4.4 Task 10：最终 spec/质量复核、完整分支 gates、`--no-ff` 合并 main、main 静态/controlled-Live/Docker/可见浏览器复验、精确清理和远程同步。（已完成）
- Phase 6.9.5：ReviewAgent / PlannerAgent 真实模型路径与只读权限边界。V10 是唯一语义质量 authority；V22 `operation_failed -> recovered` 及其他历史 lineages 不可重跑或改写。修复独立计时边界的错误精确比较后，受控 DeepSeek V4 Pro Docker API 与可见 `/plan` 验收均返回 `candidate_applied`；main default-off replay 确认确定性 0-call 路径，synthetic account/Trace 清理为 0，两个 gate 与 live-call gate 均保持 default-off。（已完成）
- Phase 6.9.6.1：已冻结 `phase-6.9-knowledge-agents-v1` 的 72-case contract（40 Dedup / 32 Organizer、24 zero-call / 48 runtime、24 个 paired index）与五项 weighted semantic 指标。未经修饰的 deterministic baseline 为 `12/48`、critical `0`、semantic `0.2322452551`；未调用 provider，24 条 zero-call 尚未实际穿过 candidate guard。证据见 `docs/acceptance/phase-6-9-6-1-knowledge-agent-baseline.md`。（已完成）
- Phase 6.9.6 Task 2：已实现 strict Dedup/Organizer candidate schema、动态 duplicate/range/evidence 校验、完整字段先扫描再裁剪的 `knowledge-model-projection-v1`、ordinal-only 深冻结输出和 hostile accessor fail-closed；focused `10/10`、Agent typecheck/lint 通过，无 provider/Docker。（已完成地基）
- Phase 6.9.6 Task 3：已实现 Dedup 受治理 candidate 与本地权威 merger；exact-hash pair 在 provider 前剔除并保持 deterministic 权威，semantic duplicate/revision/complementary 只能生成只读建议，所有失败安全回退。仅使用 Mock/注入式无网络 executor，未调用真实 provider。（已完成）
- Phase 6.9.6 Task 4：已实现 Organizer 受治理 candidate 与本地权威 merger；安全 projection/ordinal 映射、最终最多 3 个标签、最多 5 个集合、post-schema 文本安全拒绝和全失败 deterministic fallback 均有测试。focused `12/12`、AI `192/192`、Agent/AI typecheck/lint 通过，仅使用无网络 executor。（已完成）
- Phase 6.9.6 Task 5：已实现 bounded owner snapshot 与 provider-preflight stale fence；target ownership/list/chunks 在同一 `REPEATABLE READ` + `READ ONLY` 事务中完成，raw user ID 不进入快照，域分离 HMAC 与完整 canonical fingerprint 覆盖 target、Document、selected chunk 全文 hash/safety/selection。事务外 revalidation 漂移或异常均 fail-closed 到 deterministic 本地建议。focused `13/13`、Server build 通过；下一步 Task 6 接入 owner-scoped pgvector shortlist。（已完成）
- Phase 6.9.6 Task 6：已实现 owner-scoped Qwen pgvector semantic shortlist；每份 `DONE` 资料最多稳定采样 6 个 safe Chunk，文档 pair 使用 top-3 cosine mean，`>=0.78`、最多 12 对并带 medium/high evidence band。两侧 Chunk/Document owner、Qwen `text-embedding-v4` / 1536 provenance、安全 metadata、exact non-empty hash、target 和返回行均 fail-closed；selected Chunk 与 pair score 进入 snapshot fingerprint/preflight。新处理 Chunk 会持久化 embedding provenance，旧无 provenance Chunk 继续走 deterministic。focused `44/44`、Server lint/build/diff 通过；下一步 Task 7 接 default-off gates、DeepSeek runtime、价格和共享预算。（已完成）
- Phase 6.9.6 Task 7：已实现两个 default-off Knowledge server gate、DeepSeek V4 Pro non-thinking JSON runtime、4500ms timeout、精确 DeepSeek base URL/credential/price eligibility，以及并行前冻结的 `2 calls / 6000 input / 1200 output` 共享预算（Dedup `3000/500`、Organizer `3000/700`）。最坏费用 `0.0252 CNY <= 0.03 CNY`；unknown price、错误 URL、缺 key、hostile getter/proxy、abort 或 usage 不可验证均 fail-closed，worker role 强制关闭。focused `90/90`、Server lint/build/diff 通过；runtime 尚未编排到 API，下一步 Task 8。（已完成）
- Phase 6.9.6 Task 8：已把两个 candidate 接入 Knowledge suggestions API；独立 gate 决定是否启动，冻结 reservation 先于 Promise，eligible candidate 并行。candidate 后第二次 fingerprint fence 防止 TOCTOU；strict metadata 只有已持久化 Trace 与 verified usage/price 才允许 `hybrid_model / candidate_applied`，其他状态全部本地回退。Trace 为 parent + Dedup/Organizer 两 step，usageRef 去重，CNY 只写明确 CNY provenance，不污染现有 USD 顶层 cost；HTTP abort 传播到候选。Knowledge `47/47`、Types `39/39`、Server lint/build、Types typecheck/diff 通过，两轮复审无 Critical/Important；双 gate 仍默认关闭，下一步 Task 9。（已完成）
- Phase 6.9.6 Task 9：`/knowledge` 已把 strict runtime metadata 映射为语义建议、本地规则与安全降级三态，且 degraded 优先于 hybrid candidate；来源说明在空建议 response 下仍展示。页面不显示 cost、prompt、provider error、Trace/document ID，不提供 retry 或自动 mutation，并保持既有 loading/error/empty 与资料操作。Web `413/413`、lint/build、focused strict API/view/page tests 和两轮复审通过；双 gate 仍默认关闭，下一步 Task 10 paired runner/CLI/evidence validator。（已完成）
- Phase 6.9.6 Task 10：已实现 72-case strict Mock/Live paired runner、CLI 与 evidence validator。24 条 zero-call 由实际 candidate guard/独立 preflight 条件和 executor counter 证明 0 调用，不再回显 expected reason；48 runtime 保留完整分母并组成 24 次并行请求。报告重算版本、case、质量、安全、exact-hash、P95、usage 与逐 case/总 CNY 成本；Mock 满分仍不能通过 Live production gate。CLI 需要 fresh 显式授权和完整 live conjunction，marker 一次性消费，Live evidence 以 hard-link 不可变发布，filename 与 mode/scope/runId 强绑定，stdout 只含聚合信息。focused `16/16`、Agent typecheck/lint、Mock CLI/validator 与两轮复审通过；未调用 provider/Docker，下一步 Task 11。（已完成）
- Phase 6.9.6 Task 11：Compose 只向 API server 投影独立 `KNOWLEDGE_AGENT_DEEPSEEK_API_KEY`、两个 default-off gate 与两个 4500ms timeout；worker/web/admin 不接收，worker role 即使被伪造注入也不创建 executor。Knowledge 不借用通用 Chat 或 Review/Planner 产品凭据，Review/Planner acceptance 也拒绝 Knowledge key/gate 同时开启。运维合同已记录完整 Live conjunction、独立回滚、`0.03 CNY` request cap、synthetic-only、provider retention 前置、default-off/key 清空和禁止破坏性 Docker 清理；未启动容器或 provider。下一步 Task 12 分支静态/Mock 验收。（已完成）
- Phase 6.9.6 Task 12：分支 Knowledge focused 为 Agent `114/114`、Types `1/1`、Server `50/50`、Web `7/7`；全量为 Agent `465/465`、Types `39/39`、Server `2110 passed / 30 skipped`、Web `413/413`，typecheck/lint/build/diff 门均通过。Mock 为 `24/24` verified zero-call、`48/48` strict runtime、semantic `1`、P95 `286/348/348ms`、estimated `0.068526 CNY`，Live-only gate 按设计仍为 `quality_gate_failed`。Windows evidence 字节与历史 Review/Planner bridge tests 已作不放宽生产 authority 的 hermetic 收口；未调用 provider 或做产品 Docker/浏览器验收，双 gate 保持关闭。下一步必须先取得新的 controlled-Live 明确授权。（已完成 checkpoint，Phase 6.9.6 未完成）
- Phase 6.9.7：TutorAgent / WrongQuestionOrganizerAgent 混合模型路径。（规划中）
- Phase 6.9.8：RetrieverAgent / FinalResponseAgent 正式化与通信 contract。（规划中）
- Phase 6.9.9：MemoryAgent 敏感凭据修复、40-case paired eval 与真实模型候选提取，不做 Chat 注入。（规划中）
- Phase 6.9.10：MCP-ready Orchestrator、工具权限、可执行 LangGraph 与全 Agent 阶段验收。（规划中）
- Phase 6.10：全部 Agent 完成后再实施结构化长期记忆注入与 Episodic Memory。（规划中）

回顾时可以问：

- “普通 `json_object` 与 DeepSeek Beta strict tool 分别保证什么？”
- “为什么 Provider schema 需要兼容投影，但 canonical Zod 仍是最终权威？”
- “零网络 checkpoint 已经 151/345 tests passed，为什么 Router/Verifier 仍不能启用？”

下一会话可以复制：“我明确授权执行一次 Phase 6.9.6 Task 13 branch controlled-Live；按 `docs/superpowers/plans/2026-07-21-phase-6-9-6-knowledge-agents.md` 的一次性门禁执行，失败不得重跑，完成后再进入 Docker/可见浏览器验收。”

### 2026-07-20 Phase 6.9.5 V12 host-wiring correction

V12's earlier fake default host has been replaced with a real default-off host
composition. It performs read-only preflight, reserves and writes V12-only
non-secret resource selectors before creating synthetic resources, and then
uses lineage-neutral V8 Docker/API/browser/Trace/default-off/cleanup
mechanics. `review_api_setup / not_started` preserves a recoverable terminal
when setup fails before provider dispatch. No V12 product/recovery CLI,
Docker, browser, API or provider operation has run; the two gates remain
`false`. Refreshed independent contract and operations reviews have no
unresolved P0/P1; fresh user authorization is still required before the
single V12 branch product command.

The V12 hardening pass adds attempt/checkpoint-bound failure evidence,
one-time recovered terminal semantics, `DATABASE_URL` fingerprint continuity,
owner-after-preflight revalidation, default-off recovery after a half-recorded
activation, and a 30-second headed-browser observation boundary. These are
offline controls, not product evidence.

### Phase 7 — 工程化增强

Phase 7.0 / 7.1 已完成知识库后台处理地基：

- 新增 `BackgroundJob` 数据模型和 `@repo/types/api/background-job` contract，用于记录后台任务状态、资源类型、资源 id、时间戳、错误摘要和脱敏 metadata。
- 新增 `GET /background-jobs` 与 `GET /background-jobs/:id`，均经过 `JwtAuthGuard`，按当前 `userId` 隔离读取账号级后台任务。
- 知识库文档处理从 controller 中拆出 `DocumentProcessingService`，inline 和 worker 共用同一套解析、分块、embedding、snapshot 校验和 chunk 写入逻辑。
- `KNOWLEDGE_PROCESSING_MODE=inline | queue` 控制文档处理模式；默认 `inline` 不投递 BullMQ，作为本地和降级 fallback。
- `KNOWLEDGE_PROCESSING_MODE=queue` 时，`POST /knowledge/documents/:id/process` 会创建 `BackgroundJob` 并投递 BullMQ；`SERVER_ROLE=api | worker | both` 用于拆分进程职责：`api` 只提供 HTTP、不消费队列，`worker` 只运行 application context 并消费队列，`both` 用于本地一体化开发。Redis 是 queue 处理链路的必需依赖。
- `PROCESSING` 中的资料禁止替换；worker 处理时持续校验 `status + storageKey + contentHash` 快照，快照变化时标记 `STALE_SKIPPED`，不写入旧 chunks。
- `/knowledge` 页面已展示后台处理状态；文档处于 `PROCESSING` 或本地刚触发处理时短轮询，静态 `PENDING` 不无限轮询。
- 队列 smoke 验证的是 RAG 上传、解析、分块、embedding 入库和后台任务可靠性，不替代 Chat live 模型回答质量验收。

### Phase 7.2 — RAG SafetyGuard（已完成）

- 用户上传资料被视为低信任证据，不再默认等同于可执行的系统、开发者或工具调用指令。
- `@repo/rag` 提供 deterministic chunk safety classifier，文档处理时把 `riskLevel`、`categories`、`matchedPatterns` 和 `safeForPrompt` 写入 `Chunk.metadata.safety`。
- `/knowledge/search` 返回 safety metadata；Chat RAG prompt assembly 会在模型调用前过滤高风险 chunk，中风险 chunk 仅作为可疑原文引用，安全 chunk 可回填 prompt 槽位。
- `KnowledgeVerifierAgent` 会把高风险或 `safeForPrompt=false` 的检索证据转成 `suspicious` guidance，明确要求不要执行检索片段中的指令。
- `/knowledge` 检索结果展示简短安全标记，但 SafetyGuard 不自动删除、隔离、重写或替换用户资料。
- fixed mock / e2e 覆盖了 prompt injection 样本；如果后续改动最终 Chat 输出体验，仍需按 `docs/ai-behavior-acceptance.md` 做 live smoke。
- 执行计划与实现背景见 `docs/superpowers/plans/2026-06-30-phase-7-rag-safety-guard.md`，学习博客见 `docs/blogs/phase-7-rag-safety-guard.md`。

### Phase 7.3 — Event Observability（已完成）

- `InProcessEventBus.publish()` 返回 `{ delivered, failed }`，单个 handler 抛错不会阻断后续 handler；失败会记录只含事件类型与计数的脱敏 warning，不打印完整 payload。
- `GET /background-jobs/summary` 已接入 `JwtAuthGuard`，按当前 `userId` 隔离，返回账号级 active count、最近 50 条任务窗口内的失败/跳过/成功摘要和 latest job。
- `/knowledge` 页面新增后台任务摘要提示：有 active job 时继续短轮询；没有处理中文档且没有 active job 时停止轮询，避免静态页面无限请求。
- Phase 7.3 仍不改变 Chat prompt、RAG citation 或真实模型调用链路，因此验收重点是 mock / 单元 / build / 浏览器工程链路，不要求 live 模型 smoke。
- 设计与执行计划见 `docs/superpowers/specs/2026-07-02-phase-7-3-event-observability-design.md` 和 `docs/superpowers/plans/2026-07-02-phase-7-3-event-observability.md`；面试复盘博客见 `docs/blogs/phase-7-event-observability.md`。

### Phase 7.4 — Swagger / OpenAPI debug docs（已完成）

- Phase 7.4 adds Swagger / OpenAPI debug docs，用于本地联调、接口发现和面试展示，不替代共享 contract。
- `/api-docs` 提供 Swagger UI，`/api-docs-json` 提供 OpenAPI JSON；两者默认在非 production 开启。
- production 默认关闭 Swagger；只有显式 `SWAGGER_ENABLED=true` 时才暴露，且只适合受控环境、内网或临时诊断。
- 接入 Swagger 不放宽 `JwtAuthGuard`，受保护接口仍按现有登录态、access token 和服务端 userId 隔离规则执行。
- `@repo/types` Zod schemas remain source of truth；Swagger 是调试/展示层，不反向驱动前端 contract 或替代前后端共享 schema。
- Swagger 文档说明全局 response envelope：成功响应为 `{ success, data, requestId }`，错误响应为 `{ success, error, requestId }`，避免读者误以为 Controller 直接返回裸业务对象。
- 本阶段不改 Chat prompt、RAG prompt、模型路由或流式输出，因此不需要 live 模型 smoke；验收重点是 OpenAPI JSON 可生成、核心 tags 可发现、文档不泄露敏感内容。
- 设计背景见 `docs/superpowers/specs/2026-07-02-phase-7-4-openapi-docs-design.md`；面试学习博客见 `docs/blogs/phase-7-openapi-docs.md`。

### Phase 7.5 — OpenAPI 中文说明与 request body 示例（已完成）

- 为核心写接口补充中文 `summary`、`description` 和成功响应说明，方便本地调试和面试讲解。
- 为 `POST /auth/register`、`POST /auth/login`、`POST /knowledge/documents/:id/process`、`POST /knowledge/search`、`POST /review-tasks/:taskId/rating`、`POST /agent-traces` 补充 JSON request body 示例。
- 为 `POST /knowledge/documents` 和 `PUT /knowledge/documents/:id/file` 补充 `multipart/form-data` 与 `file` 字段说明。
- 示例只使用安全占位值，不写入真实 token、cookie、API key、完整 prompt、完整回答、完整 RAG chunk 或真实用户内容。
- `@repo/types` Zod schemas 仍是字段约束与运行时校验的事实源；Swagger 示例只是展示层，不反向驱动前端 contract。
- 验收重点是 OpenAPI JSON 中 request body 可发现、multipart 上传结构可见、敏感示例继续被测试拦截。
- 设计背景见 `docs/superpowers/specs/2026-07-02-phase-7-5-openapi-request-bodies-design.md`；执行计划见 `docs/superpowers/plans/2026-07-02-phase-7-5-openapi-request-bodies.md`。

### Phase 7.6 — API / worker 启动拆分（已完成）

- `main.ts` 已收敛为 `bootstrapServer()`，启动角色判断进入可测试 helper。
- `SERVER_ROLE=api` 创建 Nest HTTP app，提供 REST API、`/health` 和 Swagger，不注册 BullMQ worker processor。
- `SERVER_ROLE=worker` 使用 `NestFactory.createApplicationContext(AppModule)`，只初始化模块和 worker processor，不调用 `listen()`，不占用 HTTP 端口。
- `SERVER_ROLE=both` 保留本地一体化开发模式，同进程提供 HTTP 和 worker。
- Docker Compose 新增 `worker` profile；默认开发仍可使用 `both + inline`，拆分验证时使用 server `api + queue` 搭配 worker service。
- worker-only 第一版没有 HTTP `/health`，健康判断依赖进程存活、日志、BullMQ 和 BackgroundJob 状态；后续如果容器编排需要 readiness，再补 CLI health check 或 metrics。
- 本阶段不改 Chat prompt、RAG prompt、模型路由或真实模型调用链路，因此不需要 live 模型 smoke。
- 设计背景见 `docs/superpowers/specs/phase-7-worker-split-design.md`；执行计划见 `docs/superpowers/plans/phase-7-worker-split.md`；学习博客见 `docs/blogs/phase-7-worker-split.md`。

### Phase 7.7 — Worker Observability（已完成）

- 新增 `@repo/types/api/worker-observability` contract，统一描述 server role、processing mode、queue counts、worker heartbeat、BackgroundJob summary 和综合健康信号。
- 新增 `WorkerHeartbeatService`：仅 `SERVER_ROLE=worker | both` 写 Redis 短 TTL heartbeat，复用 BullMQ Redis 连接。
- 新增 `GET /worker-observability/summary`，经过 `JwtAuthGuard` 且受 `WORKER_OBSERVABILITY_ENABLED` 控制；默认非 production 开启、production 关闭。
- summary 聚合系统级 BullMQ `knowledge-document-processing` queue counts、worker heartbeat 和当前账号 BackgroundJob summary；三者语义互补，不互相替代。
- `/knowledge` 页面新增健康状态条，展示 worker 在线、等待/处理中/失败数量和 `healthy / degraded / attention / idle` 提示；当 summary 自身仍有队列活动、active job 或异常信号时继续短轮询，避免状态陈旧。
- heartbeat 只保存不含 hostname / pid 的 opaque worker id、role、队列名、startedAt 和 lastSeenAt，不保存文件内容、prompt、RAG chunk、API key、token 或用户输入。
- 本阶段不改 Chat prompt、RAG prompt、模型路由或真实模型调用链路，因此不需要 live 模型 smoke。
- 设计背景见 `docs/superpowers/specs/phase-7-worker-observability-design.md`；执行计划见 `docs/superpowers/plans/phase-7-worker-observability.md`；学习博客见 `docs/blogs/phase-7-worker-observability.md`。

### Phase 7.8 — RAG Eval / Hybrid Retrieval / Smoke

- Phase 7.8.1 新增固定 RAG 检索评估集和纯函数 runner，用 `recall@k`、`top1Accuracy`、`safetyPassRate`、`noHitPassRate` 衡量检索质量。
- Phase 7.8.2 将 `/knowledge/search` 升级为 Hybrid Retrieval：向量候选 + PostgreSQL full-text keyword 候选，按 chunk 去重后融合排序。
- Phase 7.8.3 新增 `bun --filter @repo/server smoke:rag-eval`，串联注册、上传合成 TXT、处理、轮询、检索和 eval。
- Phase 7.8.4 增加必需 case id guard，避免评估集改名或缺失时误报 PASS；新增 `RAG_EVAL_SMOKE_KEEP_DATA=true`，便于本地保留合成资料到 `/knowledge` 页面复查。
- Phase 7.8.5 完成 RAG runtime parity 实施：当前真实路径统一为 Qwen `text-embedding-v4` / 1536；production provider/model 显式且 provider-aware fail-closed，Qwen 要求无凭据 HTTPS base URL 与规范 `QWEN_API_KEY`，无 provider fallback；Docker server/worker 共用 RAG allowlist，宿主 key 别名仅作兼容输入并在容器内规范化。
- Phase 7.8.5 同步加固 queue smoke：必须显式 `KNOWLEDGE_PROCESSING_MODE=queue`，轮询 `BackgroundJob=SUCCEEDED`，验证 `keywordScore` / `vectorScore`、`mode=hybrid` 与无重复 `chunkId`。真实 Docker 验收使用 Qwen `text-embedding-v4` / 1536 通过 3/3，`BackgroundJob=SUCCEEDED`，缺 provider/key/base URL 的启动检查均在 provider 调用前 fail-closed；证据见 `docs/acceptance/2026-07-14-rag-runtime-parity.md`。
- fake eval 只能证明工程回归，不证明真实语义质量。当前检索为 pgvector cosine + PostgreSQL full-text 两路候选、`chunkId` 去重 hybrid rank，无 reranker。
- 设计与执行计划见 `docs/superpowers/plans/phase-7-8-rag-eval-baseline.md`、`docs/superpowers/plans/phase-7-8-hybrid-retrieval.md`、`docs/superpowers/plans/phase-7-8-rag-eval-smoke.md`、`docs/superpowers/plans/phase-7-8-4-rag-eval-hardening.md`；面试博客见 `docs/blogs/rag-eval-and-hybrid-retrieval.md`。

### Phase 7.9 — Durable Outbox / Dispatcher / Metrics（已完成）

- Phase 7.9.1 新增 `OutboxEvent`、`OutboxService` 和 enqueue / claim / success / retry / dead-letter 状态机，用于持久化内部事件的脱敏 metadata、payload hash、幂等键、attempts 和锁定信息。
- Phase 7.9.2 新增 `OutboxDispatcherService` 和显式 handler registry，先注册 `knowledge.document.processing.requested`，并在 BullMQ enqueue 成功后 best-effort 写入 requested outbox event。
- Phase 7.9.3 新增 `OutboxDispatcherRunnerService`，只在 `SERVER_ROLE=worker | both` 且 `OUTBOX_DISPATCHER_ENABLED=true` 时受控运行；production 默认关闭，避免未经确认消费历史事件。
- Phase 7.9.4 新增 `OutboxMetricsService`，读取系统级状态计数、backlog、最老 pending 年龄和最近错误摘要，并接入 `/worker-observability/summary`。
- Durable Outbox 不替换 BullMQ、BackgroundJob 或 in-process EventBus；payload 和 lastError 只能保存安全元数据或脱敏错误摘要。
- 设计与执行计划见 `docs/superpowers/plans/phase-7-9-durable-outbox.md`、`docs/superpowers/plans/phase-7-9-outbox-dispatcher.md`、`docs/superpowers/plans/phase-7-9-outbox-dispatcher-runner.md`、`docs/superpowers/plans/phase-7-9-outbox-summary-metrics.md`；面试博客见 `docs/blogs/durable-outbox-worker-observability.md`。

### Phase 7.10 — Outbox Ops（已完成）

- 新增 `@repo/types/api/outbox` contract，统一 outbox 列表、详情和 requeue 请求/响应 schema。
- 新增 `OUTBOX_OPS_ENABLED`，默认非 production 开启、production 关闭；关闭时通过 feature gate 在认证前返回 404。
- 新增 `GET /outbox-events`、`GET /outbox-events/:id` 和 `POST /outbox-events/:id/requeue`，接口经过 feature gate、`JwtAuthGuard` 和后续 OperatorGuard 保护。
- 列表和详情只返回脱敏 DTO，不返回 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。
- requeue 使用条件 `updateMany` 做 compare-and-swap，只允许 `FAILED / DEAD -> PENDING`，不直接执行 handler，不支持删除、强制成功、跳过、payload 编辑或直接 dispatch。
- 设计与执行计划见 `docs/superpowers/specs/phase-7-10-outbox-ops-design.md` 和 `docs/superpowers/plans/phase-7-10-outbox-ops.md`。

### Phase 7.11 — Worker Readiness（已完成）

- 新增 `@repo/types/api/worker-readiness` contract，定义 `ready / degraded / not_ready`、Redis / BullMQ / heartbeat / outbox 检查项和 issues。
- 新增 `GET /worker-readiness`，默认非 production 开启、production 关闭；HTTP 入口受 feature gate、`JwtAuthGuard` 和后续 OperatorGuard 保护。
- 新增 `bun --filter @repo/server readiness:worker` CLI，使用最小只读 Nest module，不导入 `AppModule`，不启动 HTTP API、worker processor、heartbeat 或 outbox dispatcher。
- CLI 退出码语义：ready 为 `0`，degraded / not ready 为 `1`，异常、配置错误或超时为 `2`。
- Readiness 和 `/health`、`/worker-observability/summary` 分工不同：`/health` 是 API liveness，observability 是开发者诊断面，readiness 是机器友好的部署前结论。
- 设计与执行计划见 `docs/superpowers/specs/phase-7-11-worker-readiness-design.md` 和 `docs/superpowers/plans/phase-7-11-worker-readiness.md`；面试博客见 `docs/blogs/worker-readiness-deployment-checks.md`。

### Phase 7.12 — Docker Worker Healthcheck（已完成）

- `docker/docker-compose.dev.yml` 的 `worker` service 新增 healthcheck，容器内执行 `bun apps/server/dist/scripts/worker-readiness.js`。
- `worker` service 新增 `WORKER_READINESS_CLI_TIMEOUT_MS`，并配置 healthcheck interval、timeout、retries 和 start_period。
- 新增 docker compose readiness 回归测试，确保 worker service 必须配置 readiness healthcheck。
- 修复 server Dockerfile 的 Bun workspace runtime 布局，保留根 `node_modules`、`apps/server/node_modules` 和 `packages`，避免容器内解析内部 `@repo/*` 失败。
- 本阶段只接入本地 Docker Compose worker healthcheck，不引入 Kubernetes readiness probe、Prometheus 指标或生产部署平台配置。

### Phase 7.13 — Docker Web / Full Stack Compose（已完成）

- `docker/Dockerfile.web` 从旧 pnpm 写法迁移到 Bun workspace，使用完整 workspace manifests、`bun install --frozen-lockfile` 和 `bun --filter @repo/web build`。
- `apps/web/next.config.ts` 开启 `output: 'standalone'` 并设置 monorepo tracing root，保证 Docker runner 能复制 Next standalone 产物。
- Compose dev 栈可拉起 `postgres / redis / minio / server / worker / web`，并完成浏览器注册到 `/chat` 的全栈验收。
- Compose dev 额外设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 与 `AI_DEV_MODE_SWITCH_ENABLED=true`，让本地 Docker Web 容器也能展示 mock / live 开关；该能力不得用于生产部署。
- 本阶段是本地 Docker Compose 全栈验收，不引入 Kubernetes、生产域名、TLS、CI 镜像推送或云部署。

### Phase 7.14 — Operator 权限与操作审计（已完成到 7.14.6）

- Phase 7.14.1 完成 operator 权限与操作审计设计文档，明确诊断写操作需要权限、审计、脱敏和受控查询边界。
- Phase 7.14.2 新增 `OperatorGuard`，把 Outbox Ops、Worker Observability 和 HTTP Worker Readiness 升级为 admin/operator-only；guard 顺序统一为 feature gate -> JWT -> Operator。
- Phase 7.14.3 新增 `OperatorAuditLog`、`OperatorAuditService` 和 `OperatorAuditModule`，审计记录只保存 actor、action、status、target、reason、requestId、IP/User-Agent hash、错误 code 和脱敏错误预览。
- Phase 7.14.4 把 `POST /outbox-events/:id/requeue` 接入 `OUTBOX_REQUEUE` 成功/失败审计；审计写入失败只记录脱敏 warning，不影响 requeue 主操作。
- Phase 7.14.5 新增 `GET /operator-audit-logs` admin-only 脱敏查询 API，并新增 `OPERATOR_AUDIT_ENABLED`，默认非 production 开启、production 关闭。
- Phase 7.14.6 新增前端页面 `/operator-audit`；管理员侧边栏显示“审计”入口，可按 action、status、targetType、targetId、actorUserId 筛选脱敏审计记录，普通用户不显示入口且页面不会主动请求审计 API。
- Operator Audit 不返回 `metadata`、payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、access token、refresh token、cookie、原始 IP 或原始 User-Agent。
- 设计与执行计划见 `docs/superpowers/specs/phase-7-14-operator-access-audit-design.md` 和 `docs/superpowers/plans/phase-7-14-operator-audit-query.md`。

### Phase 7.15 — Operator Audit 真实运行验收与本地诊断收口（已完成）

- 本地 Docker dev compose 显式开启 `OUTBOX_OPS_ENABLED`、`OPERATOR_AUDIT_ENABLED`、`WORKER_READINESS_ENABLED` 和 `WORKER_OBSERVABILITY_ENABLED`，避免 server 镜像 `NODE_ENV=production` 时本地诊断入口被默认隐藏为 404。
- `apps/web/next.config.ts` 允许 `127.0.0.1` 作为 Next dev origin，修复按本地文档访问 `127.0.0.1:3000` 时 SSR 页面可见但 React 事件未 hydration 的问题。
- 通过真实测试账号完成前后端验收：普通用户不显示“审计”入口，直达 `/operator-audit` 只显示无权限且不请求审计 API；管理员侧边栏显示“审计”，进入页面后可读取脱敏审计列表。
- 通过真实 `POST /outbox-events/:id/requeue` 写入 `OUTBOX_REQUEUE / SUCCEEDED` 审计记录，并在 `/operator-audit` 最近记录中展示 target、reason、requestId、IP/User-Agent hash 等脱敏字段。
- 本阶段不新增审计详情、导出、保留周期、批量操作或更细 operator role；后续继续评估 Operator Audit 产品化边界。

### Phase 7.16 — 桌面端 Admin Console 第一版（已完成）

- 新增独立 Next.js workspace `@repo/admin`，默认端口 `3100`，根命令 `bun run dev:admin` 等价于 `bun --filter @repo/admin dev`。
- 管理员后台第一版包含 `Outbox Ops`、`操作审计` 和 `Worker Readiness` 三个页面，复用既有后端 admin-only API：`/outbox-events`、`/operator-audit-logs`、`/worker-readiness`。
- `Outbox Ops` 支持状态/类型筛选、脱敏详情、错误处理建议、操作原因和显式确认后 requeue；遇到 unknown handler 类错误时提示先修代码，不鼓励盲目重试。
- 学习端保留移动端 `/operator-audit`；ADMIN 用户侧边栏新增“后台管理”入口，移动端和桌面端都会显示，默认跳到 `http://127.0.0.1:3100`，普通用户不可见；后台应用当前仍是桌面优先布局。
- 本阶段不新增独立 Docker `admin` service、不新增后端权限模型、不做批量 requeue / 删除 / payload 编辑；后端 `JwtAuthGuard + OperatorGuard` 仍是真正安全边界。
- 设计与执行计划见 `docs/superpowers/plans/phase-7-16-admin-console.md`；启动命令见 `docs/dev-start.md` 的“管理员后台（桌面端）启动命令”。

### Phase 7.17 — Docker Admin Console Service（已完成）

- 新增 `docker/Dockerfile.admin`，使用 Bun workspace + Next standalone 构建 `@repo/admin`，运行端口固定为 `3100`。
- `docker/docker-compose.dev.yml` 新增 `admin` service；本地完整栈可用 `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin` 一次性启动。
- Docker `web` service 新增 `NEXT_PUBLIC_ADMIN_CONSOLE_URL=http://127.0.0.1:3100`，学习端 ADMIN 侧边栏“后台管理”默认跳转到 Docker 管理员后台。
- Docker `server` CORS 默认允许 `http://localhost:3100` 与 `http://127.0.0.1:3100`，避免管理员后台能加载但浏览器 API 被 CORS 拦截。
- 修复 `Dockerfile.web` 和 `Dockerfile.server` 的 Bun workspace manifest 契约：根 workspace 是 `apps/*`，因此 web/server 镜像依赖层也必须复制 `apps/admin/package.json`，否则 `bun install --frozen-lockfile` 会认为 lockfile 需要变化。
- 完成 Docker 全栈验收：`web` 暴露 `3000`、`admin` 暴露 `3100`、`server` 暴露 `3001`、`worker` healthcheck 为 healthy；浏览器验证学习端、管理员后台、Outbox Ops、操作审计、Worker Readiness 和普通用户 403 拦截。
- 本阶段不新增新后台页面、不新增后端权限模型、不做生产域名/TLS/反向代理；管理员后台仍是体验层，真正安全边界仍是后端 `JwtAuthGuard + OperatorGuard`。
- 设计文档见 `docs/superpowers/specs/phase-7-17-admin-docker-design.md`；执行计划见 `docs/superpowers/plans/phase-7-17-admin-docker.md`；启动命令见 `docs/dev-start.md`。

### Phase 7.17.1 — 管理员后台返回学习端登录态修复（已完成）

- 修复管理员后台“返回学习端”硬编码 `127.0.0.1:3000` 导致的本机 loopback host 混用问题。
- 后台返回学习端时默认跟随当前 hostname：`localhost:3100` 回到 `localhost:3000`，`127.0.0.1:3100` 回到 `127.0.0.1:3000`；仍支持 `NEXT_PUBLIC_LEARNING_APP_URL` 显式覆盖。
- 学习端和管理员后台的浏览器 API base 在本机 `localhost` / `127.0.0.1` 场景下自动对齐当前 hostname，减少 refresh cookie / session recovery 因 host 不一致而失败。
- 补充回归测试和 `docs/dev-start.md` 排障说明，明确这类问题通常不是后端鉴权失效，而是本机浏览器 host 不一致导致登录态恢复不稳定。
- 本阶段不改变后端鉴权模型、不改变 cookie 策略、不放宽 CORS 或 `OperatorGuard`。

### Phase 7.18 — Admin Outbox Ops 产品化（已完成）

- `/outbox` 详情视图按生命周期、事件身份、诊断建议、重新入队操作和后续验证分区，让管理员先理解事件状态和失败原因，再决定是否操作。
- requeue 文案明确它只做 `FAILED / DEAD -> PENDING` 状态流转，不立即执行 handler，不改写事件数据，也不改写事件结果。
- handler missing、invalid payload、依赖超时和未知错误会给出不同操作建议，避免把所有失败都误当成“重试一下”。
- 页面继续只展示脱敏 DTO 和 `payloadHash`，不展示完整 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。
- 页面不提供批量 requeue、删除事件、跳过事件、立即 dispatch 或 payload 修改等高风险入口；真正安全边界仍由后端 feature gate、`JwtAuthGuard`、`OperatorGuard` 和 operator audit 保证。
- requeue 成功后会刷新 outbox、audit 和 worker readiness 查询缓存，后续验证入口直接跳到 `/worker` 与 `/audit`。
- 浏览器验收覆盖 Redis timeout 型失败事件重新入队、审计记录写入、Worker Readiness 恢复为 `Ready`，并清理验收测试数据。

### Phase 7.19 — Admin Console 控制台数据化（已完成）

- `/` 管理员控制台从静态入口页升级为真实运维总览，读取 `GET /worker-readiness`、`GET /outbox-events` 和 `GET /operator-audit-logs`。
- 控制台展示 Worker readiness、FAILED / DEAD Outbox 数量、最近 requeue 审计数量和综合关注项，按 `healthy / attention / danger / read error` 语义生成顶部状态。
- 最近关注区按风险优先提示 DEAD / FAILED 事件、readiness issue 和最近审计结果，入口继续跳到 `/outbox`、`/worker`、`/audit` 详情页。
- 控制台数据读取失败时明确提示检查后端服务、诊断开关和管理员权限，不使用假数据兜底。
- 后台壳层保持固定侧边栏 + 独立工作区滚动；主工作区隐藏粗原生滚动条，Outbox 列表和详情仍保持独立滚动。
- 本阶段不新增后端 API、不放宽 `JwtAuthGuard + OperatorGuard`、不暴露 payload 或敏感元数据，也不新增批量 requeue 等高风险操作。
- 面试学习博客见 `docs/blogs/admin-console-ops-platform.md`。

### Phase 7.20 — Operator Audit 详情闭环（已完成）

- 新增 `operatorAuditLogDetailResponseSchema` 与 `GET /operator-audit-logs/:id`，复用脱敏审计 DTO，只返回单条审计上下文，不返回 `metadata`、payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token、cookie、原始 IP 或原始 User-Agent。
- `OperatorAuditService.getDetail()` 使用显式 `select` 排除 `metadata`，不存在时返回 `OPERATOR_AUDIT_LOG_NOT_FOUND`。
- Admin Console `/audit` 从纯列表升级为列表 + 详情双栏；点击审计记录后右侧展示操作上下文、目标对象、来源指纹和错误摘要。
- 审计详情面板保留独立滚动，列表选中态使用 `aria-pressed` 和左侧强调条，避免只靠颜色识别。
- 本阶段不新增审计导出、保留周期配置、更细 operator role、批量操作或敏感原始字段展示；真正安全边界仍是后端 feature gate、`JwtAuthGuard` 和 `OperatorGuard`。
- `docs/blogs/admin-console-ops-platform.md` 已补充“审计详情为什么重要”。

### Phase 7.21 — Admin Ops 交互收口（已完成）

- 新增 `AdminFilterSelect`，在 Admin Console `/outbox` 与 `/audit` 替代浏览器原生 `select`，避免系统蓝色高亮、粗边框和割裂的下拉体验。
- 自定义筛选控件保留 `role="combobox"`、`role="listbox"`、`role="option"`、label 关联、`aria-selected`、`aria-activedescendant`、上下键切换和可滚动列表，不把审美优化做成不可访问的假控件。
- `/outbox` requeue 前端操作从“原因可选 + 确认”收紧为“原因必填 + 显式确认”，并在切换事件或筛选条件时清空 reason，减少管理员事后无法复盘为什么重试或 reason 跨事件残留的风险。
- 继续保持边界：不新增后端 API、不新增批量 requeue、不允许删除 / 跳过 / 立即 dispatch / payload 编辑；真正安全边界仍是后端 feature gate、`JwtAuthGuard`、`OperatorGuard` 和服务层状态机。
- 补充静态 contract test，防止 `/outbox` 和 `/audit` 回退到原生 `<select>`，并防止 requeue 操作绕过 reason guard。

### Phase 7.22 — Docker Admin Ops 真实验收收口（已完成）

- 使用 Docker Compose dev 全栈验收 `postgres / redis / minio / server / worker / web / admin`，真实访问 `http://127.0.0.1:3100` 管理员后台和 `http://127.0.0.1:3001` API。
- 通过真实 ADMIN 账号完成 `/outbox -> requeue -> /audit -> /worker` 闭环：确认自定义筛选控件未回退原生 `<select>`、requeue 必须填写 reason 并勾选确认、审计记录可查看详情、worker readiness 能反映并恢复 outbox backlog。
- 使用临时普通账号验证 admin-only 后端边界：携带普通用户 token 访问 `GET /outbox-events?status=FAILED` 返回 `403`，说明安全边界不依赖前端隐藏入口。
- 验收后清理临时 OutboxEvent、OperatorAuditLog、RefreshToken 和测试账号，容器内 `worker-readiness` CLI 恢复 `ready`，避免测试数据长期污染本地环境。
- 新增 Admin Console `favicon.svg` 和 `metadata.icons`，减少后台浏览器调试时的 favicon 404 噪声。

### Phase 7.23 — Operator Audit 保留周期与证据包导出（已完成）

- Phase 7.23.1 已完成正式设计：`docs/superpowers/specs/phase-7-23-operator-audit-retention-export-design.md`。
- Phase 7.23.2 ~ 7.23.8 已按 `docs/superpowers/plans/phase-7-23-operator-audit-retention-export.md` 完成 contract/schema、事务投递、fenced ZIP Worker、retention maintenance、查询下载 API、Admin UI 与 Docker 真实验收。
- 默认保留 `OperatorAuditLog` 180 天；证据包定位为事故排障交接，最多覆盖 31 天和 50,000 条脱敏记录。
- Phase 7.23.2 已固定 strict contract，以及 `OperatorAuditExport` / maintenance schema；safe DTO 严格排除 object key、request hash、processing token、payload 与 metadata。requester 删除时 `requestedByUserId` 置空，export 与唯一 `backgroundJobId` 保留。
- `BackgroundJob` 通过数据库 CHECK 区分 ACCOUNT/SYSTEM：ACCOUNT 继续随 user 级联删除，SYSTEM 必须 `userId=null` 并独立存活；账号 service 所有 create/find/count/update/list/summary，以及知识库 direct count/create/find/failure-update 路径，都显式限制 `scope=ACCOUNT`。
- 为什么 / 怎么做：导出执行跨越请求人生命周期，所以先用 FK/CHECK/唯一索引固定事实所有权，再用 strict contract 固定安全边界；contract、env/service 和真实 PostgreSQL e2e 分别执行 RED/GREEN。
- 配置已固定 180 天、24 小时、31 天、50,000 条、64 MiB、配额/并发/lease/lock/stale/query timeout 默认值及相对约束；export 与 maintenance 在所有环境默认关闭，production 显式开启 Operator Audit、Outbox Ops 或 audit export 任一路径都必须提供 trim 后至少 32 字符的 fingerprint secret。Phase 7.23.3 已使用该 secret 把来源指纹升级为 HMAC，不保存 secret 或原始 IP/User-Agent。
- Phase 7.23.3 让 `POST /operator-audit-exports` 的 PostgreSQL commit 成为 202 成功边界：Serializable 事务先取得 retention/quota advisory locks 与 database clock，校验 range/retention/future/idempotency/quota，再原子写入 Export、SYSTEM BackgroundJob、OutboxEvent 与 strict `AUDIT_EXPORT_REQUEST`。首条 lock 等待会固定 Serializable snapshot，因此对 P2034/raw 40001/明确 export 幂等复合 P2002 做最多 5 次 whole-transaction retry，每次重新取锁/DB clock且不产生事务外副作用。
- API request path 不直接调用 BullMQ；Outbox Dispatcher 是唯一 Redis bridge。`operator.audit.export.requested` payload 只有 export/job id，handler 复核 linked SYSTEM facts、用 BackgroundJob id 作为 Bull job id，并把 Redis 失败交回既有 retry/dead-letter 状态机。
- Dispatcher 状态采用白名单：FAILED/EXPIRED 终态 no-op，PROCESSING/READY + ACTIVE/SUCCEEDED 视为已投递，只有 QUEUED+QUEUED 可投递，其余组合按 invalid payload 失败。
- 申请审计 fail-closed/strict；既有 Outbox requeue audit 仍 best-effort。DEAD 在 24 小时设计恢复窗口内可经既有受审计 requeue 恢复，知识库 queue-first + best-effort observer 边界不变。
- controller 将 shared Zod 失败转换为安全领域 400，将 strict request-audit 失败转换为回滚后的安全领域 503；Swagger 显式描述 strict body 并禁止 additional properties。真实 PostgreSQL 并发 e2e 通过 blocker lock + `pg_locks/pg_stat_activity` 条件轮询覆盖同 hash、不同请求与 quota 最后一槽，实际捕获 P2034 后均满足事实计数与配额。
- Phase 7.23.4 新增只在 `worker|both` 且 export、Outbox Dispatcher、maintenance 三个 gate 全部显式开启时注册的 processor。本地 concurrency 固定为 1，Worker 以 `autorun=false` 注册，bootstrap 先设置 BullMQ queue global concurrency=1 再启动消费，因此多副本也不能突破单并发。状态仓库用 database clock、processing token、lease renewal 和双表事务 CAS 同步 Export/SYSTEM BackgroundJob；live lease 或失败状态 CAS 结果不确定时使用 `moveToDelayed + DelayedError`，真实 BullMQ 5.79.2/Redis 验证 delayed 不增加失败 attempt。
- 归档在只读 REPEATABLE READ 快照内先 count、再按 `(createdAt,id)` 每页 1,000 条流式读取，pre-count/stream 同时限制 50,000 条且 select 显式排除 metadata。CSV 固定 13 列、UTF-8 BOM/CRLF，secret sanitizer 后先检测公式前缀再清控制字符；ZIP 只包含 `records.csv/manifest.json` 并保存 CSV / archive SHA-256。
- MinIO key 使用 `operator-audit-exports/<exportId>/attempts/<processingToken>.zip`；只有当前 token 的数据库 CAS 能选择 object key。`markReady` commit 后 ACK 丢失时会用 Export + SYSTEM BackgroundJob 双事实 reconciliation：已选择同 key 则保留并成功，明确未选择才删除；结果不确定时保留对象并 delayed，未选 orphan 留给 Phase 7.23.5 维护回收。`0700/0600` 仅在 POSIX/Linux 容器形成权限保证，Windows 本地沿用 temp ACL；`expiresAt` 固定为 ready 后 24 小时，但到期对象自动删除仍属于 Phase 7.23.5。
- 导出申请和下载采用 fail-closed audit；CSV 必须防 formula injection，下载不暴露 MinIO object key。
- 维护任务使用活跃导出水位保护临近 180 天边界的数据，并分批清理到期对象、历史审计和导出元数据。
- Phase 7.23.6 已提供系统级 ADMIN list/detail 与 `POST /operator-audit-exports/:id/download`：列表使用 `(createdAt,id)` 稳定游标与每响应一次 DB clock，DTO 通过显式 mapper + strict schema 排除存储/fencing/internal 字段；下载使用服务端安全文件名、`no-store, private`、长度与 SHA-256 headers，Nest `StreamableFile` 绕过全局 JSON envelope。DB archiveSize 必须为正数且不超过配置上限，打开对象流后还必须与 MinIO stat size 完全一致；size mismatch 或 strict audit 失败都先销毁流，confirmed missing 才 CAS 为 `FAILED/EXPORT_FILE_MISSING`。相关异常只写固定安全 warning。成功下载审计只表示服务端已授权并准备流，不保证浏览器持久化全部字节。
- Phase 7.23.7 将 Admin Console `/audit` 升级为可键盘操作的“审计记录 / 证据包”tabs，共享 filters 作为申请默认条件；网络/5xx 仅在完整表单未变化时复用 `clientRequestId`，只对 QUEUED/PROCESSING 轮询，READY 且 `canDownload` 才提供 authenticated Blob 下载与 hash 复制。
- Headless Chromium 在 1440×900 与 1024×768 确定性模拟 QUEUED→PROCESSING→READY，覆盖 tabs 键盘、错误关联、固定轨道、零 console/page error 与横向溢出；不冒充真实后端验收。
- Phase 7.23.8 将 Compose server 默认角色收口为 `api`，独立 worker 独占 Dispatcher/export/maintenance processor；镜像用户与 192 MiB `0700` tmpfs 对齐为 `1001:1001`。确定性 smoke 真实覆盖 ADMIN/STUDENT 权限、申请→READY→ZIP 下载、CSV/manifest/hash、REQUEST/DOWNLOAD 审计、过期 410、维护删除与精确 cleanup；Docker 浏览器路线同时覆盖 Admin UI 和普通用户拦截。
- 真实验收发现并修复 Compose 重复 processor 风险、`minio-init` shell 参数被 Compose 拆分、worker/tmpfs UID/GID 不一致、smoke 遗漏 BullMQ `prepmind` prefix，以及 Outbox Ops e2e 的过期权限 fixture。离线 `minio/mc` 兼容镜像只用于本机断网验收，未提交且不属于生产方案。
- 当前边界：production gates 仍关闭；不提供 presigned URL、legal hold、WORM、数字签名/不可抵赖或法律级数据库快照。SHA-256 只做完整性校验，来源指纹仍是关联数据。运行手册与验收清单见 `docs/dev-start.md`、`docs/acceptance-checklist.md`，面试复盘见 `docs/blogs/operator-audit-retention-export.md`。
- Phase 7.23.5 已实现每小时 strict maintenance scheduler/processor：processor 本地 `concurrency=1`，worker/both 启动 bootstrap 再把 maintenance queue 的 BullMQ global concurrency 固定为 1，跨 worker replica 仍保持系统级单并发；真实 Redis 双 Worker/双 job 阻塞验证最大 active 为 1。24h READY 逻辑过期后先清 MinIO selected object 与严格 prefix，再 CAS EXPIRED；FAILED/EXPIRED orphan、DEAD 满 24h delivery、过期 lease 且 Bull job 非 active 的 stale PROCESSING、180 天审计和终态 export metadata 都进入有界修复/清理。每个 1,000 条审计批次在新短事务中重新取得 retention advisory lock、database clock 与 active-export 水位，单次最多 20 批；真实 PostgreSQL 交错验证 request commit watermark 前不会被删。
- Phase 7.23.5 同时新增严格 crash janitor、`os.tmpdir()/prepmind-audit-exports` 0700/192MiB tmpfs 明文边界、三队列 heartbeat/readiness/observability/CLI/Admin Worker 卡片与两小时 maintenance freshness。192 MiB 为严格 `free > 2 * 64 MiB` preflight 留出余量；PROCESSING orphan 清理会保护当前 token exact key/objectKey，并在 list 后删除前复核 DB/Bull 状态，stale repair 最终 CAS 同时限定 token、startedAt 和 lease cutoff。Local Compose 的 `minio-init` 导入 2 天 expiration/noncurrent、1 天 incomplete multipart 和 delete-marker lifecycle；24h 是逻辑失效、小时任务是正常物理清理、48h 是异常兜底。production versioned bucket 仍需独立验证 delete-marker 清理。
- Phase 7.23.8 已完成 Docker 真实验收、后端下载全链路与博客。
- 回顾时可以问：为什么下载必须在打开对象流之后、返回字节之前 fail-closed 写审计？
- 回顾时可以问：前端为什么要在网络失败后复用 clientRequestId，而不是每次点击都生成新 UUID？

回顾时可以问：

- “活跃导出水位如何避免 180 天清理与长时间导出互相踩踏？”
- “为什么 ACCOUNT BackgroundJob 保留 `ON DELETE CASCADE`，SYSTEM job 却要求 `userId=null`？”
- “为什么 export 与 background job 用唯一 id 关联但不建外键？”
- “strict response schema 如何防止内部存储/投递字段被未来 API 意外暴露？”
- “为什么 Phase 7.23.2 落了配置却仍让 export/maintenance 在所有环境默认关闭？”
- “事务型 Outbox 如何消除 PostgreSQL 成功但 Redis enqueue 失败的双写窗口？”
- “processing token 如何阻止失去 lease 的旧 Worker 覆盖新证据包？”
- “为什么 Serializable + advisory lock 仍需要 bounded whole-transaction retry？”
- “为什么 request audit 必须 strict，而 Outbox requeue audit 仍保持 best-effort？”
- “领域 400/503 如何避免验证细节和原始数据库错误泄露？”

### Phase 7 后续方向

- 后台管理产品化边界：Phase 7.23 已完成审计保留周期与证据包导出；后续再评估更细 operator role 和更多运维页面。
- 更多后台任务生产化：OCR 批处理、批量 embedding、PDF 解析、复习提醒调度等。
- Worker 观测增强：按部署形态补 BullMQ metrics、Prometheus 指标、队列延迟和告警阈值。
- Outbox 生产化：更多业务事件接入、dead-letter 修复工作流、生产开关流程和审计查询体验。

### Phase 8 — 高性能优化

- Web Worker、虚拟列表、IndexedDB 离线策略、PWA 完整体验。

### Phase 9 — MCP Tool 体系

- Tool Registry、JSON-RPC、Search/OCR/FSRS/Plan/Memory tools。

### Phase 10 — 生产级部署

- OpenTelemetry、Sentry、Prometheus / Grafana、k6、CI/CD。
