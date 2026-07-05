# PrepMind AI 开发日志

> 维护规则：`DEVLOG.md` 只记录阶段级里程碑、关键工程决策和验收结果，不再堆叠逐提交流水账。完整路线看 `docs/roadmap.md`，当前数据边界看 `docs/data-flow.md`，面试复盘看 `docs/blogs/`，具体实现追溯看 `git log`。

## 当前快照

更新时间：2026-07-05

当前阶段：Phase 7.7 已完成，后续继续 Phase 7 工程化增强。

| 阶段 | 状态 | 关键词 |
| --- | --- | --- |
| Phase 0 | 已完成 | Monorepo、Prisma 初稿、Docker 基础设施 |
| Phase 1 | 已完成 | 前端 MVP、AI 聊天、OCR、错题本、Dexie |
| Phase 2 | 已完成 | NestJS、Auth、PostgreSQL、业务 API 迁移、MinIO |
| Phase 3 | 已完成 | OCR structured output、讲题 prompt、多题保存 |
| Phase 4 | 已完成 | FSRS、ReviewTask、离线评分、学习统计、复习计划 |
| Phase 5 | 已完成 | RAG 数据模型、文档处理、检索、Chat RAG、`/knowledge` |
| Phase 6 | 已完成 | 多 Agent、Trace、Memory、Review/Planner、Knowledge agents |
| Phase 7.0 | 已完成 | BackgroundJob 控制面 |
| Phase 7.1 | 已完成 | BullMQ 文档处理队列、inline / queue 双模式 |
| Phase 7.2 | 已完成 | RAG SafetyGuard、prompt injection chunk 过滤 |
| Phase 7.3 | 已完成 | EventBus 失败隔离、后台任务 summary、`/knowledge` 任务摘要 |
| Phase 7.4 | 已完成 | Swagger / OpenAPI debug docs、`/api-docs`、response envelope 说明 |
| Phase 7.5 | 已完成 | Swagger 中文说明、核心写接口 request body 示例 |
| Phase 7.6 | 已完成 | API / worker 启动拆分、worker-only application context、Docker worker profile |
| Phase 7.7 | 已完成 | Worker Observability、Redis heartbeat、队列 backlog 与 `/knowledge` 健康状态条 |

## 近期关键记录

### 2026-07-05 - Phase 7.7 Worker Observability

本轮目标：补上 Phase 7.6 拆出 worker 进程后的观测缺口，让开发和面试展示时能回答“任务是否在排队、worker 是否在线、最近是否失败”这三个问题，而不是只看 BackgroundJob 结果表。

完成内容：

- 新增 `@repo/types/api/worker-observability` contract，统一描述 server role、knowledge processing mode、BullMQ queue counts、worker heartbeat、BackgroundJob summary 和综合信号。
- 新增 `WorkerHeartbeatService`：仅在 `SERVER_ROLE=worker | both` 写 Redis 短 TTL heartbeat，复用 BullMQ queue client，不引入第二套 Redis 客户端。
- 新增 `WorkerObservabilityService`：聚合 `knowledge-document-processing` queue counts、worker heartbeat 和账号级 `BackgroundJobsService.getSummary()`。
- 新增 `GET /worker-observability/summary`，经过 `JwtAuthGuard`，并受 `WORKER_OBSERVABILITY_ENABLED` 控制；默认非 production 开启、production 关闭，Swagger tag 为 `Worker Observability`。
- `/knowledge` 页面新增紧凑健康状态条，展示 worker 在线状态、等待/处理中/失败数量，以及 `healthy / degraded / attention / idle` 对应提示；知识库为空且没有处理轮询时不显示该状态条，避免误报“暂不可用”。
- 新增 `apps/web/src/lib/worker-observability-api.ts`、view helper、TanStack Query hook 和相关测试。
- 新增设计与执行文档：`docs/superpowers/specs/phase-7-worker-observability-design.md`、`docs/superpowers/plans/phase-7-worker-observability.md`。
- 新增面试学习博客：`docs/blogs/phase-7-worker-observability.md`。

边界：

- BackgroundJob 是账号级任务历史和状态，不等于 worker 在线；worker heartbeat 是进程最近活跃信号，不等于任务成功；queue counts 是系统级队列积压，不按用户隔离。三者组合展示，不能混成一个事实源。
- Worker Observability 返回系统级 queue counts 和 worker heartbeat，因此 production 默认关闭；若生产临时开启，必须放在受控内网或诊断窗口里，不应作为面向普通用户的长期公开能力。
- worker-only 仍不提供 HTTP `/health`；它不监听端口，健康判断继续依赖进程存活、日志、BullMQ、Redis heartbeat 和 BackgroundJob 状态。
- heartbeat 只保存不含 hostname / pid 的 opaque worker id、role、队列名、startedAt 和 lastSeenAt，不保存文件内容、prompt、RAG chunk、API key、token 或用户输入。
- 本阶段不改 Chat prompt、RAG prompt、模型路由或真实模型调用链路，因此不需要 live 模型 smoke。

验证：以下命令已在 Phase 7.7 收尾时通过。

- `bun --cwd packages/types typecheck`
- `bun packages/types/tests/worker-observability.test.mts`
- `bun --filter @repo/server test -- worker-observability`
- `bun --filter @repo/web test -- worker-observability knowledge`
- `bun --filter @repo/server build`
- `bun --filter @repo/web build`
- `docker compose -f docker/docker-compose.dev.yml --profile worker config`
- `git diff --check`

### 2026-07-02 - Phase 7.6 Worker Split

本轮目标：把 Phase 7.1 预留的 `SERVER_ROLE=api | worker | both` 从“是否注册 worker processor”推进到真正的进程启动边界，让 `worker` 不再占用 HTTP 端口。

完成内容：

- 新增 `apps/server/src/bootstrap/server-bootstrap.ts`，把 server bootstrap 从 `main.ts` 拆成可测试 helper。
- `SERVER_ROLE=api`：创建 Nest HTTP app，提供 REST API、`/health` 和 Swagger，但不注册 BullMQ worker processor。
- `SERVER_ROLE=worker`：使用 `NestFactory.createApplicationContext(AppModule)`，只初始化模块和 BullMQ processor，不调用 `listen()`，不占用 HTTP 端口。
- `SERVER_ROLE=both`：保留本地开发一体化模式，HTTP API 和 worker processor 同进程。
- `main.ts` 收敛为 `void bootstrapServer()`，减少启动入口里的不可测逻辑。
- Docker Compose 增加 `worker` profile：默认开发仍是 `both + inline`，拆分验证时可用 server `api + queue` 搭配 worker service。
- 新增执行计划：`docs/superpowers/plans/phase-7-worker-split.md`。从本阶段开始，新建 docs / blogs / plans / specs 文件名优先使用语义化名称，不再加日期前缀。

边界：

- worker-only 第一版不提供 HTTP `/health`；它不监听端口，健康判断先依赖进程存活、日志、BullMQ 和 BackgroundJob 状态。
- 本阶段不改文档处理业务语义、不改 BullMQ 重试策略、不引入 dead letter queue / durable outbox。
- 本阶段不改 Chat prompt、RAG prompt、模型路由或真实模型调用链路，因此不需要 live 模型 smoke。

### 2026-07-02 - Phase 7.5 OpenAPI Request Bodies

本轮目标：把 Phase 7.4 的 Swagger 从“接口地图”推进到“可读、可调试的中文接口文档”，让本地联调和面试讲解时能直接看到核心写接口应该怎么传参。

完成内容：

- 为 `POST /auth/register`、`POST /auth/login` 补充中文说明和 JSON request body 示例。
- 为 `POST /knowledge/documents` 和 `PUT /knowledge/documents/:id/file` 补充 `multipart/form-data` 与 `file` 字段说明。
- 为 `POST /knowledge/documents/:id/process`、`POST /knowledge/search`、`POST /review-tasks/:taskId/rating`、`POST /agent-traces` 补充安全 JSON 示例。
- 高价值接口的 `summary`、`description`、成功响应说明改为中文描述，同时保留 `response envelope`、路径、字段名和 header 等英文契约标识。
- Swagger 顶部说明已中文化；面向用户的接口标题不再使用“脱敏”这类工程黑话，改用“隐藏敏感内容”“Agent 调试记录”等更容易理解的说法。
- 增加 OpenAPI JSON 回归测试，要求核心调试接口必须有 request body，并继续校验文档不泄露 API key、cookie、token、完整 prompt、完整回答、完整 RAG chunk 或原始 payload。
- 新增设计与执行文档：`docs/superpowers/specs/2026-07-02-phase-7-5-openapi-request-bodies-design.md`、`docs/superpowers/plans/2026-07-02-phase-7-5-openapi-request-bodies.md`。

边界：

- Phase 7.5 只改 Swagger / OpenAPI 元数据和文档，不改变接口运行时行为。
- request body 示例只用于 Swagger UI 展示，不是新的事实源；字段约束仍以 `@repo/types` Zod schema 和服务端解析为准。
- Agent Trace 示例只放已经隐藏敏感内容的摘要、token 估算和成本估算，不放完整 prompt、完整回答或完整 RAG chunk。
- 本阶段不改 Chat prompt、RAG prompt、模型路由或流式输出，因此不需要 live 模型 smoke。

### 2026-07-02 - Phase 7.4 Swagger / OpenAPI Docs

本轮目标：给越来越多的 NestJS REST API 补一个可发现、可调试、适合面试展示的 Swagger / OpenAPI 入口，同时避免让 Swagger 变成第二套 contract 事实来源。

完成内容：

- 新增 Swagger / OpenAPI debug docs，入口为 `/api-docs` 和 `/api-docs-json`。
- 文档默认在非 production 开启；production 默认关闭。
- `SWAGGER_ENABLED=true` 只适合受控环境、内网或临时诊断，不作为公开调试入口。
- Swagger 接入不放宽 `JwtAuthGuard`，受保护接口仍按原有认证和 userId 隔离规则执行。
- 明确 `@repo/types` Zod schemas remain source of truth；Swagger 是调试/展示层，不反向驱动前端 contract。
- 文档补充全局 response envelope：成功响应 `{ success, data, requestId }`，错误响应 `{ success, error, requestId }`。
- 新增面试学习博客：`docs/blogs/phase-7-openapi-docs.md`。

边界：

- Phase 7.4 不改 Chat prompt、RAG prompt、模型路由或流式输出，因此不需要 live 模型 smoke。
- OpenAPI 文档不应包含 API key、cookie、token、完整 prompt、完整回答、完整 RAG chunk、后台任务原始 payload 或真实用户内容示例。
- Swagger 只帮助接口发现和调试，不替代 `@repo/types`、服务端测试或前端调用层校验。

### 2026-07-02 - Phase 7.3 Event Observability

本轮目标：让后台任务不只是“扔进队列”，而是能被前端和开发者安全地看见。

完成内容：

- `InProcessEventBus.publish()` 改为返回 `{ delivered, failed }`。
- 单个 EventBus handler 抛错不会阻断后续 handler。
- EventBus handler 失败会记录脱敏 warning，只包含事件类型与 delivered / failed 计数，不打印完整 payload。
- 新增 `GET /background-jobs/summary`，经过 `JwtAuthGuard`，按当前 `userId` 隔离。
- summary 中 `activeCount` 使用账号级真实 active count，避免旧的 active job 被最新 50 条窗口漏掉。
- summary 中 `failedCount` / `staleSkippedCount` / `succeededCount` 仍表达最近 50 条任务窗口内的摘要。
- `/knowledge` 新增后台任务摘要提示。
- `/knowledge` 在处理中文档、本地刚触发处理或 summary 仍有 active job 时短轮询；静态 `PENDING` 或健康 recent jobs 不无限轮询。
- 更新 `AGENTS.md`、`docs/roadmap.md`、`docs/data-flow.md`、`docs/ai-behavior-acceptance.md`。
- 新增面试复盘博客：`docs/blogs/phase-7-event-observability.md`。

审核中发现并修复：

- 页面最初把 summary 固定传为 `undefined`，导致 active job 不能靠 summary 自身持续轮询。
- `activeCount` 最初只基于最近 50 条计算，语义容易误导 UI，改为真实账号级 count。
- EventBus 最初吞掉 handler 异常但没有可观测 warning，补充了脱敏日志。
- 设计文档末尾多余空行导致 `git diff --check main...HEAD` 失败，已清理。

验证：以下命令已在 Phase 7.3 收尾时通过。

- `bun --cwd packages/types typecheck`
- `bun packages/types/tests/background-job.test.mts`
- `bun --filter @repo/server test -- event-bus background-jobs`
- `bun --filter @repo/web test -- background-job knowledge-view`
- `bun --filter @repo/server build`
- `bun --filter @repo/web build`
- `git diff --check`

边界：

- Phase 7.3 不改 Chat prompt、RAG citation、Tutor 输出或真实模型调用链路，因此不需要 live 模型 smoke。
- EventBus 当前仍是 in-process 非持久事件总线，不是 durable outbox。

### 2026-06-30 - Phase 7.2 RAG SafetyGuard

本轮目标：把用户上传资料视为低信任证据，避免 RAG 检索片段中的恶意指令影响模型。

完成内容：

- `@repo/rag` 增加 deterministic chunk safety classifier。
- 文档处理时把 `metadata.safety` 写入每个 chunk。
- `/knowledge/search` 返回 safety metadata。
- Chat RAG prompt 组装前过滤 high-risk chunk。
- medium-risk chunk 只作为可疑原文引用，不作为可执行指令。
- `KnowledgeVerifierAgent` 对高风险或 `safeForPrompt=false` 的资料输出保守 guidance。
- `/knowledge` 检索结果展示安全标记。
- 补充 `docs/ai-behavior-acceptance.md` 和面试复盘博客 `docs/blogs/phase-7-rag-safety-guard.md`。

验收要点：

- mock / e2e 覆盖固定 prompt-injection 样本。
- live/browser smoke 记录在 `docs/ai-behavior-acceptance.md`。
- Trace 和 BackgroundJob 仍只保存脱敏元数据，不保存完整恶意 chunk、prompt、API key、token 或 cookie。

### 2026-06-30 - Phase 7.0 / 7.1 Background Jobs

本轮目标：把知识库文档处理从同步接口升级为可切换的后台任务链路。

完成内容：

- 新增 `BackgroundJob` 数据模型和 `@repo/types/api/background-job` contract。
- 新增 `GET /background-jobs` 与 `GET /background-jobs/:id`，均经过 `JwtAuthGuard`，按当前账号隔离。
- 拆分 `DocumentProcessingService`，inline 和 worker 共用同一套解析、分块、embedding、snapshot 校验和 chunk 写入逻辑。
- `KNOWLEDGE_PROCESSING_MODE=inline | queue` 控制处理模式。
- queue 模式下创建 `BackgroundJob` 并投递 BullMQ。
- `SERVER_ROLE=api | worker | both` 控制 worker processor 注册。
- worker 处理时持续校验 `status + storageKey + contentHash` 快照，避免旧处理流污染新资料。
- `/knowledge` 展示文档后台处理状态，并只在活跃处理时轮询。

边界：

- Redis 是 queue 链路必需依赖。
- BackgroundJob 只保存脱敏任务元数据，不保存完整文件、prompt、RAG chunk、API key 或 token。
- queue smoke 证明后台任务链路可靠，不证明 Chat live 输出质量。

### 2026-06-29 - Phase 6.8 Knowledge Agents

本轮目标：补齐资料管理方向的多 Agent 能力，让知识库不只会检索，也能给资料组织建议。

完成内容：

- 新增 `KnowledgeDedupAgent` 与 `KnowledgeOrganizerAgent` deterministic policy。
- 新增 `@repo/types/api/knowledge-agent` contract。
- 新增 `GET /knowledge-agent/suggestions`，经过 `JwtAuthGuard`，按当前 `userId` 读取资料元数据和少量 chunk 摘要。
- `/knowledge` 展示重复资料、疑似新版、互补资料、集合和标签建议。
- 建议链路只读，不自动合并、删除、替换、重命名或分类资料。
- fixed deterministic eval set 覆盖 KnowledgeDedup / KnowledgeOrganizer。

边界：

- 不调用 live 模型。
- 不写 Document / Chunk / 分类表。
- 不进入 Dexie `mutationQueue`。
- 建议失败不影响上传、处理、替换、删除和检索。

### 2026-06-28 - Phase 6.6 / 6.7 Memory 与 Trace

Phase 6.6 完成：

- 新增 `UserMemoryCandidate` / `UserMemory` 数据模型。
- 新增 `/memory-agent` 与 `/user-memories` API。
- `/profile` 支持生成长期记忆候选、确认、忽略、停用、恢复和删除。
- MemoryAgent 是确定性 policy，不调用真实模型。
- `UserMemory` 当前不自动注入 `/api/chat`。

Phase 6.7 完成：

- 新增 Agent Trace contract、Prisma 模型和 `/agent-traces` API。
- `/api/chat` 在有 access token 时 best-effort 写入脱敏 trace。
- `/agent-trace` 展示路由、步骤、降级、token 和估算成本。
- fixed deterministic eval set 覆盖当前确定性 Agent policy。
- Trace 不保存完整 prompt、完整回答、完整 RAG chunk 或 API key。

### 2026-06-22 - Phase 6.5 ReviewAgent / PlannerAgent

完成内容：

- 新增 `ReviewAgent` 与 `PlannerAgent` deterministic policy。
- 新增 `GET /review-agent/suggestions`。
- `/plan` 展示完整学习计划建议。
- `/today` 展示紧急复习建议。
- 建议只读，不创建未来 `ReviewTask(source=PLANNER)`，不写 Card / ReviewLog / ReviewPreference / WrongQuestion / deck。

### 2026-06-21 - Phase 6.3 / 6.4 Verifier 与错题组织

Phase 6.3 完成：

- `KnowledgeVerifierAgent` 在 RAG 命中后评估资料可信度。
- 可疑、冲突或不足时向 prompt 注入保守使用规则，并在引用区追加资料核对提示。
- 补齐 Chat live 小样本验收规范和空回答兜底。

Phase 6.4 完成：

- `WrongQuestionOrganizerAgent` 推荐学科组与专题 deck。
- 新增 `WrongQuestionSubjectGroup`、`WrongQuestionDeck`、`WrongQuestionDeckItem` 组织层。
- `/error-book` 升级为学科卡片 -> 专题 deck -> 错题列表下钻结构。
- 组织层独立于 WrongQuestion / Card / ReviewLog / ReviewTask 事实层。

### 2026-06-20 - Phase 6.0 / 6.1 / 6.2 Agent Runtime 与 Tutor

完成内容：

- 新增 Agent Runtime 基础 contract、`AgentState`、`ActionProposal`、RouterAgent、阈值 guard、recorder 和 graph descriptor。
- `/api/chat` 接入 RouterAgent，响应头输出 route metadata。
- Tutor route 调用 TutorAgent deterministic policy。
- TutorAgent 支持 `explain_solution`、`socratic_hint`、`step_check`、`concept_bridge`、`answer_direct`、`general_follow_up` 策略。
- Agent package 不直接调用 `streamText`，不读取 API key，不启用 live 模型。

## 阶段摘要

### Phase 0 - 项目初始化

- 建立 Bun workspace / monorepo。
- 初始化 `apps/web`、`apps/server` 和 `packages/*`。
- 建立 Prisma schema、Docker Compose 基础设施和协作文档。

### Phase 1 - 前端 MVP

- 完成移动端优先 Web / PWA 壳层。
- 完成 AI 聊天、OCR、错题本、今日任务和 Dexie 本地持久化。
- 建立 Chat / OCR 统一时间线和 Markdown / KaTeX 渲染。

### Phase 2 - 后端与业务数据迁移

- 落地 NestJS 11、PostgreSQL、Auth / User API。
- 登录态迁移为后端 session 权威控制。
- WrongQuestion / ChatMessage / OCRRecord API 迁移到 PostgreSQL。
- MinIO 接入新 OCR 图片链路。
- Dexie 保留为本地快速恢复、离线兜底、乐观更新和 mutation queue。
- Phase 2.5 完成 Chat-first 产品壳层、注册登录页、个人中心、今日任务、错题本和聊天体验打磨。

### Phase 3 - OCR 与讲题结构化

- OCR 输出升级为 display Markdown + structured JSON envelope。
- 保存错题优先使用结构化字段。
- 多题图片支持单题保存和批量保存。
- `activeStudyContext` 支持围绕当前题目追问。
- tool action proposal 边界预留，但不自动执行。

### Phase 4 - FSRS 复习系统

- WrongQuestion-first FSRS 复习闭环完成。
- `Card`、`ReviewLog`、`ReviewTask`、`ReviewPreference` 以 PostgreSQL 为权威来源。
- 今日任务迁移到持久化 ReviewTask。
- 评分支持 `clientMutationId` 幂等。
- 离线评分进入 Dexie `mutationQueue`，但不本地推进 FSRS / ReviewLog / 统计。
- `/plan` 支持未来 7 / 14 天加权复习压力预览。
- `/stats` 使用 ECharts 展示复习趋势、评分分布和卡片状态。

### Phase 5 - RAG 知识库

- 完成 Document / Chunk 数据模型和 `vector(1536)` pgvector 预留。
- 支持 TXT / Markdown / DOCX / PDF 基础解析。
- 完成段落感知分块、embedding 入库和检索 API。
- `/api/chat` 支持 RAG 上下文注入和 Markdown citations。
- `/knowledge` 支持上传、处理、替换、删除、状态摘要和检索测试。
- 文档去重、替换上传和处理快照保护已落地。

### Phase 6 - 多 Agent 系统

- 使用 LangGraph，不使用 AutoGen。
- 已完成 RouterAgent、TutorAgent、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent、MemoryAgent、KnowledgeDedupAgent、KnowledgeOrganizerAgent。
- 当前列出的 Agent 均为确定性 policy，不直接调用真实模型。
- Agent Trace 提供脱敏可观测闭环。
- Review / Planner / Memory / Knowledge agents 都遵循“只读建议或人审确认”边界，不在每次 Chat 中自动写库或自动注入。

### Phase 7 - 工程化增强

- Phase 7.0：BackgroundJob 控制面完成。
- Phase 7.1：BullMQ 知识库处理队列完成，支持 inline / queue 双模式和 worker role。
- Phase 7.2：RAG SafetyGuard 完成，chunk 级 prompt injection 风险 metadata、Chat prompt 前过滤和 UI 安全信号已落地。
- Phase 7.3：Event Observability 完成，EventBus 失败隔离、后台任务 summary API 和 `/knowledge` 任务摘要轮询兜底已落地。
- Phase 7.4：Swagger / OpenAPI debug docs 完成，`/api-docs` 与 `/api-docs-json` 非 production 默认开启，production 默认关闭，并明确 response envelope、`@repo/types` contract 优先级和认证边界。
- Phase 7.5：OpenAPI request body 示例完成，注册/登录、知识库上传/替换/处理/检索、复习评分和 Agent Trace 写入已补中文说明与安全示例。
- Phase 7.6：API / worker 进程启动拆分完成，`worker` 角色不再监听 HTTP，Docker Compose 提供 worker profile。
- Phase 7.7：Worker Observability 完成，Redis heartbeat、BullMQ queue counts、BackgroundJob summary 和 `/knowledge` 健康状态条已落地。

## 当前验证基线

常用全量验证：

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
```

Phase 7.7 worker observability 任务验证：本阶段文档收口需要至少运行以下命令。

```powershell
bun --cwd packages/types typecheck
bun packages/types/tests/worker-observability.test.mts
bun --filter @repo/server test -- worker-observability
bun --filter @repo/web test -- worker-observability knowledge
bun --filter @repo/server build
bun --filter @repo/web build
docker compose -f docker/docker-compose.dev.yml --profile worker config
git diff --check
```

AI 行为验收规则：

- mock 验工程链路。
- live 小样本验真实输出体验。
- fake embedding 不证明 RAG 语义命中质量。
- 改 Chat prompt、RAG prompt、Tutor 输出或真实模型策略时，必须按 `docs/ai-behavior-acceptance.md` 做 live smoke。
- 纯后台任务、API contract、UI 状态和文档更新不需要 live 模型验收。

## 下一步

Phase 7 后续优先级：

1. Durable outbox / metrics：当事件需要跨进程可靠投递时，把 in-process EventBus 升级为持久化 outbox 或指标系统接入。
2. 更多后台任务生产化：OCR 批处理、批量 embedding、PDF 解析、复习提醒调度等。
3. Worker 观测增强：后续按部署形态补 BullMQ metrics、CLI health check 或容器 readiness。
4. 生产观测：OpenTelemetry、Sentry、Prometheus / Grafana、k6。

## 参考文档

- `AGENTS.md`：当前协作规范和最新项目快照。
- `README.md`：项目入口和启动说明。
- `docs/roadmap.md`：完整 Phase 路线。
- `docs/data-flow.md`：当前有效数据流和边界。
- `docs/ai-behavior-acceptance.md`：mock / live / RAG / Agent 验收规范。
- `docs/blogs/phase-7-rag-safety-guard.md`：RAG SafetyGuard 面试复盘。
- `docs/blogs/phase-7-event-observability.md`：后台任务可观测面试复盘。
- `docs/blogs/phase-7-openapi-docs.md`：Swagger / OpenAPI debug docs 面试学习博客。
- `docs/blogs/phase-7-worker-split.md`：API / worker 启动拆分面试学习博客。
- `docs/blogs/phase-7-worker-observability.md`：Worker Observability 面试学习博客。
