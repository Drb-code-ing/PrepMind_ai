# PrepMind AI 学习与开发路线图

> 当前状态：项目按 Phase 0 ~ Phase 10 顺序推进，当前 Phase 6.6 已完成，后续进入 Phase 6.7 Agent Trace UI、成本看板和固定评测集。

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
| Phase 6 | 多 Agent 系统 | LangGraph, Router, Retriever, Tutor, Verifier, Planner, Memory, WrongQuestionOrganizer | 进行中，Phase 6.6 已完成 |
| Phase 7 | 工程化增强 | BullMQ, EventBus, Swagger, Docker | 规划中 |
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
- embedding provider 已抽象，默认 OpenAI-compatible `text-embedding-3-small`，测试/e2e 使用 fake provider。
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
- 服务端按同用户 `contentHash` 做轻量去重：重复上传返回已有资料；替换上传保留同一 `Document.id`、清空旧 chunks 并重置为 `PENDING`。
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
- 总体 Agent 拆分：`RouterAgent`、`RetrieverAgent`、`TutorAgent / AnswerAgent`、`KnowledgeVerifierAgent`、`FinalResponseAgent`、`WrongQuestionOrganizerAgent`、`ReviewAgent`、`PlannerAgent`、`MemoryAgent`。
- Phase 6.0 已完成 Agent Runtime 地基：共享 Agent contract、`AgentState`、`ActionProposal`、RouterAgent、阈值 guard、运行 recorder、graph descriptor 和降级链路。
- Phase 6.1 已完成 Router + Tutor Chat 接入：`/api/chat` 通过 `chat-agent-runtime` adapter 调用 RouterAgent，并保留原有 streaming、RAG、OCR activeStudyContext、mock/live 双开关和 token 预算。
- Phase 6.2 已完成 TutorAgent 策略层：`TutorAgent` 作为确定性 policy 识别 `explain_solution`、`socratic_hint`、`step_check`、`concept_bridge`、`answer_direct` 和 `general_follow_up`，并生成短策略 prompt 与 mock strategy metadata。
- Phase 6.3 已完成 KnowledgeVerifierAgent：`@repo/agent/knowledge-verifier` 作为确定性 policy 在 RAG 命中后评估资料状态为 `trusted / suspicious / conflict / insufficient / skipped`，并向 Chat RAG prompt 注入保守使用规则。
- Phase 6.4 已完成 WrongQuestionOrganizerAgent：`@repo/agent/wrong-question-organizer` 作为确定性 policy，根据错题结构化字段和已有 deck 摘要推荐学科组与专题 deck。
- Phase 6.5 已完成 ReviewAgent / PlannerAgent：`@repo/agent/review` 和 `@repo/agent/planner` 作为确定性 policy，基于当前用户错题、复习日志、ReviewTask 计划和偏好生成只读复习诊断与学习计划建议。
- Phase 6.6 已完成 MemoryAgent：`@repo/agent/memory` 作为确定性 policy，基于当前用户学习信号生成长期记忆候选；`UserMemoryCandidate` 和 `UserMemory` 以 PostgreSQL 为权威来源，候选必须经用户确认后才成为正式记忆。
- TutorAgent、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent 与 MemoryAgent 当前都不直接调用真实模型；最终 Chat 输出仍由 `/api/chat` 的现有 mock/live 模型链路负责，Organizer 写库只发生在 NestJS organizer API 内，Review / Planner 只通过 `/review-agent/suggestions` 返回建议，Memory 只通过 `/memory-agent` 与 `/user-memories` 管理候选和正式记忆。
- Phase 6.6 不把 `UserMemory` 自动注入 `/api/chat`，也不在每次 Chat 中自动执行 MemoryAgent；后续个性化回答需要单独设计用户开关、prompt 预算和可见提示。
- RAG 资料不是绝对真理，只是用户私有上下文证据；KnowledgeVerifierAgent 会在检索命中后评估资料片段，避免 AI 盲从错误笔记。
- 当用户上传资料可能有误时，AI 应优先给出更可靠的解法，并轻提示用户核对对应笔记片段，而不是盲从错误资料或直接宣称用户笔记错误。
- 错题整理作为 Phase 6 的明确子模块已落地：错题本首页按学科卡片优先展示，例如“高等数学”“大学英语”；学科内部再按专题 deck 拆分，例如“曲线积分与格林公式”“四级阅读长难句”。
- `WrongQuestionOrganizerAgent` 基于结构化 OCR、错题知识点、错因、题型、难度和用户备注，推荐错题所属学科组与专题 deck，并在没有合适专题时生成默认专题名。
- `KnowledgeDedupAgent / KnowledgeOrganizerAgent` 作为资料管理方向预留：后续可在用户更新资料或上传相似资料时评估是否属于同一份笔记的新版、重复资料或互补资料，并给出合并、替换或保留建议。
- 用户拥有最终组织权：可重命名卡片、移动错题、合并专题；用户手动修改后的名称需要锁定，AI 后续只做建议，不自动覆盖。
- 数据模型已落地 `WrongQuestionSubjectGroup`、`WrongQuestionDeck` 和 `WrongQuestionDeckItem`，保持 WrongQuestion / Card / ReviewLog / ReviewTask 作为事实来源，错题集只作为组织层。
- Organizer API 已落地：`GET /wrong-question-groups`、`GET /wrong-question-groups/:subjectGroupId/decks`、`GET /wrong-question-decks/:deckId/questions`、`POST /wrong-question-organizer/organize/:wrongQuestionId`、`POST /wrong-question-organizer/organize-batch`、`PATCH /wrong-question-decks/:deckId`、`POST /wrong-question-decks/:deckId/items`、`DELETE /wrong-question-decks/:deckId/items/:wrongQuestionId`。
- `/error-book` 已升级为学科卡片 -> 专题 deck -> 错题列表的下钻结构，保留错题详情、备注、掌握状态、删除确认和加入复习。
- ReviewAgent / PlannerAgent API 已落地：`GET /review-agent/suggestions` 经过认证，按当前用户读取 Card、ReviewLog、ReviewTask 计划、ReviewPreference 和错题组织摘要，生成 `/plan` 完整建议与 `/today` 紧凑建议。
- ReviewAgent / PlannerAgent 边界：只读建议，不创建 `ReviewTask(source=PLANNER)`，不写 Card / ReviewLog / ReviewPreference / WrongQuestion / deck，不调用 live 模型，不进入 Dexie `mutationQueue`。
- MemoryAgent API 已落地：`GET /memory-agent/candidates`、`POST /memory-agent/candidates/generate`、`POST /memory-agent/candidates/:id/accept`、`POST /memory-agent/candidates/:id/reject`、`GET /user-memories`、`PATCH /user-memories/:id`、`DELETE /user-memories/:id`。
- MemoryAgent 边界：候选需用户确认，不静默创建正式记忆；不写 Chat / Review / WrongQuestion 事实表，不调用 live 模型，不进入 Dexie `mutationQueue`，不自动注入 Chat prompt。
- Phase 6 总体设计见 `docs/superpowers/specs/2026-06-19-phase-6-multi-agent-collaboration-design.md`；错题整理详细设计见 `docs/superpowers/specs/2026-06-21-phase-6-4-wrong-question-organizer-design.md`；复习计划 Agent 详细设计见 `docs/superpowers/specs/2026-06-22-phase-6-5-review-planner-agent-design.md`；MemoryAgent 详细设计见 `docs/superpowers/specs/2026-06-28-phase-6-6-memory-agent-design.md`。
- Phase 6.0 / 6.1 / 6.2 / 6.3 / 6.4 / 6.5 / 6.6 详细设计与实施计划见 `docs/superpowers/specs/2026-06-20-phase-6-0-agent-runtime-design.md`、`docs/superpowers/specs/2026-06-20-phase-6-1-router-tutor-chat-integration-design.md`、`docs/superpowers/specs/2026-06-20-phase-6-2-tutor-agent-policy-design.md`、`docs/superpowers/specs/2026-06-21-phase-6-3-knowledge-verifier-design.md`、`docs/superpowers/specs/2026-06-21-phase-6-4-wrong-question-organizer-design.md`、`docs/superpowers/specs/2026-06-22-phase-6-5-review-planner-agent-design.md`、`docs/superpowers/specs/2026-06-28-phase-6-6-memory-agent-design.md` 以及对应 `docs/superpowers/plans/` 文件。

后续拆分：

- Phase 6.0：Agent Runtime 地基。（已完成）
- Phase 6.1：RouterAgent + Tutor 路由接入 Chat。（已完成）
- Phase 6.2：TutorAgent 策略层。（已完成）
- Phase 6.3：`KnowledgeVerifierAgent`，RAG 命中后评估资料可信度与温和资料核对提示。（已完成）
- Phase 6.4：`WrongQuestionOrganizerAgent`，错题本学科卡片和专题 deck。（已完成）
- Phase 6.5：`ReviewAgent / PlannerAgent`，复习分析和学习计划建议。（已完成）
- Phase 6.6：`MemoryAgent`，长期记忆候选、人审确认和撤销。（已完成）
- Phase 6.7：Agent Trace UI、成本看板和固定评测集。（下一步）

### Phase 7 — 工程化增强

- BullMQ、EventBus、Swagger / OpenAPI、后台任务。

### Phase 8 — 高性能优化

- Web Worker、虚拟列表、IndexedDB 离线策略、PWA 完整体验。

### Phase 9 — MCP Tool 体系

- Tool Registry、JSON-RPC、Search/OCR/FSRS/Plan/Memory tools。

### Phase 10 — 生产级部署

- OpenTelemetry、Sentry、Prometheus / Grafana、k6、CI/CD。
