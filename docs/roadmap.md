# PrepMind AI 学习与开发路线图

> 当前状态：项目按 Phase 0 ~ Phase 10 顺序推进，当前 Phase 7.14.6 已完成，后续继续 Phase 7 operator 审计产品化边界、更多后台任务生产化、worker metrics 和生产观测增强。

## 项目目标

PrepMind AI 的目标是做成移动端优先的 AI 学习产品，而不只是聊天 Demo。最终链路包括：

- AI 聊天与拍照识题。
- 错题本与间隔复习。
- RAG 知识库。
- LangGraph Agent。
- MCP 工具体系。
- 可观测性与生产化部署。

## 总体路线

| 阶段 | 主题 | 核心技术 | 状态 |
| --- | --- | --- | --- |
| Phase 0 | 架构设计 | Monorepo, Prisma, Docker | 已完成 |
| Phase 1 | 前端 MVP | Next.js, Dexie, AI SDK, OCR | 已完成 |
| Phase 2.1 | 后端基础与鉴权 | Bun, NestJS, Prisma, PostgreSQL, JWT | 已完成 |
| Phase 2.2 | 前端接入后端 Auth | apiClient, TanStack Query, AuthGuard 迁移 | 已完成 |
| Phase 2.3 | 业务 API 迁移 | REST API, server state, Dexie 离线缓存 | 已完成 |
| Phase 2.5 | 产品体验补全 | Chat-first UI, Auth UI, 个人中心, 今日任务, 视觉系统 | 已完成 |
| Phase 3 | AI 讲题系统 | OCR structured output, Prompt, 多题保存, Tool Action Boundary | 已完成 |
| Phase 4 | FSRS 记忆系统 | Card, ReviewLog, ReviewTask, ReviewPreference | 已完成主线，后续可扩展提醒调度 |
| Phase 5 | RAG 知识库 | pgvector, Embedding, Hybrid Search, Rerank | 已完成主线，Phase 5.6 已完成 |
| Phase 6 | 多 Agent 系统 | LangGraph, Router, Retriever, Tutor, Verifier, Planner, Memory, WrongQuestionOrganizer, KnowledgeDedup, KnowledgeOrganizer, Agent Trace | 已完成主线，Phase 6.8 已完成 |
| Phase 7 | 工程化增强 | BullMQ, BackgroundJob, RAG SafetyGuard, EventBus, Swagger, Docker, Worker Observability, Durable Outbox, Worker Readiness, Operator Audit | 已启动，Phase 7.14.6 已完成 |
| Phase 8 | 高性能优化 | Web Worker, 虚拟列表, PWA, IndexedDB | 规划中 |
| Phase 9 | MCP Tool 体系 | JSON-RPC, Tool Registry, Tool Calling | 规划中 |
| Phase 10 | 生产级部署 | OpenTelemetry, Sentry, Prometheus, k6 | 规划中 |

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
- embedding provider 已抽象，默认 OpenAI `text-embedding-3-small`，支持阿里云百炼 / DashScope OpenAI-compatible `qwen` provider（如 `text-embedding-v4`），测试/e2e 使用 fake provider。
- `Chunk.embedding vector(1536)` 通过 raw SQL 持久化，写入前校验 document/user ownership。
- `Document` 状态流为 `PENDING -> PROCESSING -> DONE / FAILED`；空文本、零 chunk、解析或 embedding 失败进入 `FAILED`。
- forced reprocess 会先清旧 chunks，避免 stale retrieval。

Phase 5.4 已完成检索 API：

- 新增 `POST /knowledge/search`。
- 使用 query embedding + pgvector cosine search 检索当前用户 `DONE` 文档 chunks。
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

- Phase 6 是 PrepMind 的核心亮点阶段，使用 LangGraph 编排多 Agent，不使用 AutoGen。
- 总体 Agent 拆分：`RouterAgent`、`RetrieverAgent`、`TutorAgent / AnswerAgent`、`KnowledgeVerifierAgent`、`FinalResponseAgent`、`WrongQuestionOrganizerAgent`、`ReviewAgent`、`PlannerAgent`、`MemoryAgent`、`KnowledgeDedupAgent`、`KnowledgeOrganizerAgent`。
- Phase 6.0 已完成 Agent Runtime 地基：共享 Agent contract、`AgentState`、`ActionProposal`、RouterAgent、阈值 guard、运行 recorder、graph descriptor 和降级链路。
- Phase 6.1 已完成 Router + Tutor Chat 接入：`/api/chat` 通过 `chat-agent-runtime` adapter 调用 RouterAgent，并保留原有 streaming、RAG、OCR activeStudyContext、mock/live 双开关和 token 预算。
- Phase 6.2 已完成 TutorAgent 策略层：`TutorAgent` 作为确定性 policy 识别 `explain_solution`、`socratic_hint`、`step_check`、`concept_bridge`、`answer_direct` 和 `general_follow_up`，并生成短策略 prompt 与 mock strategy metadata。
- Phase 6.3 已完成 KnowledgeVerifierAgent：`@repo/agent/knowledge-verifier` 作为确定性 policy 在 RAG 命中后评估资料状态为 `trusted / suspicious / conflict / insufficient / skipped`，并向 Chat RAG prompt 注入保守使用规则。
- Phase 6.4 已完成 WrongQuestionOrganizerAgent：`@repo/agent/wrong-question-organizer` 作为确定性 policy，根据错题结构化字段和已有 deck 摘要推荐学科组与专题 deck。
- Phase 6.5 已完成 ReviewAgent / PlannerAgent：`@repo/agent/review` 和 `@repo/agent/planner` 作为确定性 policy，基于当前用户错题、复习日志、ReviewTask 计划和偏好生成只读复习诊断与学习计划建议。
- Phase 6.6 已完成 MemoryAgent：`@repo/agent/memory` 作为确定性 policy，基于当前用户学习信号生成长期记忆候选；`UserMemoryCandidate` 和 `UserMemory` 以 PostgreSQL 为权威来源，候选必须经用户确认后才成为正式记忆。
- Phase 6.7 已完成 Agent Trace / Eval：新增固定 deterministic eval set、`/agent-traces` 在线账号级观测 API、`/api/chat` best-effort trace capture、估算成本看板和 `/agent-trace` 调试台；trace 写入失败不影响 streaming / 流式回答。
- Phase 6.8 已完成 KnowledgeDedupAgent / KnowledgeOrganizerAgent：`@repo/agent/knowledge-dedup` 和 `@repo/agent/knowledge-organizer` 作为确定性 policy，基于当前用户资料元数据和少量 chunk 摘要判断重复资料、疑似新版、互补资料，并给出集合与标签建议；`GET /knowledge-agent/suggestions` 是认证、用户隔离、只读的在线建议 API，`/knowledge` 页面已展示资料管理建议面板。
- 后续 Agent 架构优化执行文档见 `docs/superpowers/plans/2026-06-29-agent-architecture-optimization.md`，重点是状态控制面、工具可靠性、RAG 冲突处理、后台任务事件化和 Reflexion 验收，而不是立刻放开全自主写操作。
- TutorAgent、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent、MemoryAgent、KnowledgeDedupAgent 与 KnowledgeOrganizerAgent 当前都不直接调用真实模型；最终 Chat 输出仍由 `/api/chat` 的现有 mock/live 模型链路负责，Organizer 写库只发生在 NestJS organizer API 内，Review / Planner 只通过 `/review-agent/suggestions` 返回建议，Memory 只通过 `/memory-agent` 与 `/user-memories` 管理候选和正式记忆，KnowledgeDedup / KnowledgeOrganizer 只通过 `/knowledge-agent/suggestions` 返回只读资料建议，Agent Trace 只记录脱敏观测元数据。
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
- ReviewAgent / PlannerAgent 边界：只读建议，不创建 `ReviewTask(source=PLANNER)`，不写 Card / ReviewLog / ReviewPreference / WrongQuestion / deck，不调用 live 模型，不进入 Dexie `mutationQueue`。
- MemoryAgent API 已落地：`GET /memory-agent/candidates`、`POST /memory-agent/candidates/generate`、`POST /memory-agent/candidates/:id/accept`、`POST /memory-agent/candidates/:id/reject`、`GET /user-memories`、`PATCH /user-memories/:id`、`DELETE /user-memories/:id`。
- MemoryAgent 边界：候选需用户确认，不静默创建正式记忆；不写 Chat / Review / WrongQuestion 事实表，不调用 live 模型，不进入 Dexie `mutationQueue`，不自动注入 Chat prompt。
- Agent Trace 边界：`/agent-traces` 不进入 Dexie `mutationQueue`，不保存完整 prompt、完整回答、完整 RAG chunk 或 API key；`/agent-trace` 成本看板只展示估算成本，不替代供应商账单。
- KnowledgeAgent 边界：`/knowledge-agent/suggestions` 经过 `JwtAuthGuard`，Service 层所有 `Document` / `Chunk` 查询都带当前 `userId`，只读取每份资料最多少量 chunk 摘要；该接口不写 Document / Chunk / 分类表，不调用 live 模型，不进入 Dexie `mutationQueue`，失败只影响建议面板，不影响上传、处理、替换、删除和检索。
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

### Phase 7.8 — RAG Eval / Hybrid Retrieval / Smoke（已完成）

- Phase 7.8.1 新增固定 RAG 检索评估集和纯函数 runner，用 `recall@k`、`top1Accuracy`、`safetyPassRate`、`noHitPassRate` 衡量检索质量。
- Phase 7.8.2 将 `/knowledge/search` 升级为 Hybrid Retrieval：向量候选 + PostgreSQL full-text keyword 候选，按 chunk 去重后融合排序。
- Phase 7.8.3 新增 `bun --filter @repo/server smoke:rag-eval`，串联注册、上传合成 TXT、处理、轮询、检索和 eval。
- Phase 7.8.4 增加必需 case id guard，避免评估集改名或缺失时误报 PASS；新增 `RAG_EVAL_SMOKE_KEEP_DATA=true`，便于本地保留合成资料到 `/knowledge` 页面复查。
- 本阶段明确 fake eval 只能证明工程回归，真实语义质量仍需 Qwen / OpenAI 等真实 embedding smoke 验收。
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

### Phase 7 后续方向

- Operator Audit 产品化边界：评估是否需要只读详情、导出策略、保留周期和更细 operator role。
- 更多后台任务生产化：OCR 批处理、批量 embedding、PDF 解析、复习提醒调度等。
- Worker 观测增强：按部署形态补 BullMQ metrics、Prometheus 指标、队列延迟和告警阈值。
- Outbox 生产化：更多业务事件接入、dead-letter 修复工作流、生产开关流程和审计查询体验。

### Phase 8 — 高性能优化

- Web Worker、虚拟列表、IndexedDB 离线策略、PWA 完整体验。

### Phase 9 — MCP Tool 体系

- Tool Registry、JSON-RPC、Search/OCR/FSRS/Plan/Memory tools。

### Phase 10 — 生产级部署

- OpenTelemetry、Sentry、Prometheus / Grafana、k6、CI/CD。
