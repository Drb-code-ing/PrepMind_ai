# PrepMind AI — 协作上下文

本文件给 Claude/Codex 提供仓库快速上下文。详细规则以 `AGENTS.md` 为准，阶段规划看 `docs/roadmap.md`，数据流看 `docs/data-flow.md`。

## 当前阶段

PrepMind AI 是移动端优先的 Web + PWA 智能备考助手。当前处于 Phase 6.9.5：V10 controlled-Live 是唯一语义质量权威，V10 product terminal 为 recovery-only。V11 branch product CLI 已完成离线接线，产品 gate 仍默认关闭；通过复审后才可执行唯一一次 Docker/headed-browser 验收。

已完成主线：

- Phase 1：前端 MVP，包含 AI 聊天、OCR、错题本、今日任务和 Dexie 本地持久化。
- Phase 2.1：NestJS 后端基础、PostgreSQL、Auth/User API、统一响应和测试覆盖。
- Phase 2.2：前端 Auth 接入后端，登录态由 NestJS session 权威控制。
- Phase 2.3：WrongQuestion / ChatMessage / OCRRecord API、MinIO 图片上传、Dexie mutationQueue。
- Phase 2.5：Chat-first 产品壳层、注册登录页、个人中心、今日任务、错题本和聊天体验打磨。
- Phase 3：OCR structured output、结构化 activeStudyContext、多题保存策略和 tool action proposal 边界。
- Phase 4.1：WrongQuestion-first FSRS 复习闭环、Review API、今日复习卡。
- Phase 4.2：学习统计页、Review stats/logs API、复习趋势与最近记录。
- Phase 4.3：ReviewTask 持久化任务流、今日任务迁移、评分完成、跳过和恢复。
- Phase 4.4：离线评分队列、服务端幂等评分、今日复习待同步状态和 in-app 提醒摘要。
- Phase 4.5.1：复习计划预览、`/review-tasks/plan`、`/plan` 页面、`/stats` ECharts 图表。
- Phase 4.5.2：`ReviewPreference`、加权压力模型、7 / 14 天计划窗口和今日容量摘要。
- Phase 5.0：RAG 知识库设计、可降级 Chat 边界、Phase 5.1 数据模型与 contract 实施计划。
- Phase 5.1：RAG 数据模型、`vector(1536)` 索引预留和 knowledge API contract。
- Phase 5.2：文档上传、列表、详情、删除与状态 API。
- Phase 5.3：`POST /knowledge/documents/:id/process`、TXT / Markdown / DOCX / PDF 基础文本解析、段落感知分块和 embedding 入库。
- Phase 5.4：`POST /knowledge/search`、query embedding、pgvector 相似度搜索和当前用户 DONE chunks 隔离检索。
- Phase 5.5：`/api/chat` 接入 RAG 检索、知识库上下文注入和 Markdown citations。
- Phase 5.6：`/knowledge` 学习资料工作台，支持上传、列表、处理、替换上传、删除和检索测试。
- Phase 6.0：Agent Runtime 地基，包含共享 Agent contract、RouterAgent、阈值 guard、运行 recorder、graph descriptor 和降级链路。
- Phase 6.1：RouterAgent 接入 `/api/chat`，保留原有 streaming、RAG、OCR activeStudyContext、mock/live 成本保护和 token 预算。
- Phase 6.2：TutorAgent 策略层，支持讲题意图分类、策略 prompt、Tutor debug headers 和 mock strategy metadata。
- Phase 6.3：KnowledgeVerifierAgent，支持 RAG 命中后的资料可信度评估、verifier prompt guidance、资料核对提示和 verifier debug headers。
- Phase 6.4：WrongQuestionOrganizerAgent，支持错题学科卡片、专题 deck、组织层 API 和 `/error-book` 学科优先下钻。
- Phase 6.5：ReviewAgent / PlannerAgent，只读生成复习分析、今日重点和学习计划建议，展示在 `/plan` 与 `/today`。

下一步：

1. 以 V10 committed success 为唯一 paired-eval 依据，进行分支 Docker/headed-browser 验收；每个组件验收后恢复产品 gate 为 `false`。
2. 只有分支验收、清理、`--no-ff` main 合并和 main replay 全部通过后，才可 push；随后才继续其余 Agent 架构和 Phase 6.10 记忆工作。

## 常用命令

```powershell
bun install

$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

$env:RAG_EMBEDDING_PROVIDER='fake'
bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

验证：

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

后端 e2e 需要 Docker PostgreSQL 运行在 `127.0.0.1:5433`。

## 环境变量

- 根目录 `.env`：后端与 Prisma 使用。
- `apps/server/.env`：server/e2e 在服务目录运行时读取。
- `apps/web/.env.local`：Next.js API Route 使用。
- Chat 开发默认走本地 mock：`AI_PROVIDER_MODE` 未设置或为 `mock` 时不调用真实模型；真实验收必须同时设置 `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true`，live 默认模型为 `deepseek-v4-flash`。
- AI 行为验收规范见 `docs/ai-behavior-acceptance.md`；mock 验工程链路，live 小样本验真实输出体验，fake embedding 不证明 RAG 语义命中质量。

推荐数据库连接：

```text
DATABASE_URL=postgresql://prepmind:devpass@127.0.0.1:5433/prepmind
```

## 模块边界

```text
web -> server（HTTP 调用，不直接 import）
server -> database, ai, fsrs, rag, agent, mcp, types
agent -> ai, fsrs, rag, mcp, types
rag -> database, ai, types
fsrs -> types
ai -> types
mcp -> ai, fsrs, rag, types
```

- `packages/` 禁止依赖 `apps/`。
- 同层 packages 禁止循环依赖。
- API contract 优先放入 `@repo/types`，用 Zod 表达。
- Agent 框架使用 LangGraph，不使用 AutoGen。
- Phase 6 多 Agent 规划：Router / KnowledgeVerifier 已具备模型/规则混合生产路径并恢复默认 gate 关闭；Tutor、WrongQuestionOrganizer、Memory、KnowledgeDedup 与 KnowledgeOrganizer 仍是确定性 policy。Review / Planner 的确定性只读 baseline 仍是当前产品行为，另有 server-only 受限模型 candidate；V1--V9 均为只读历史，V9 以 `quality_gate_failed` 封存。V10 收窄为 `focusIndexes` / `blockOrder` 后，唯一 `deepseek-v4-pro` JSON-object non-thinking Live 已通过：`23/22`、`48/48` strict/quality、critical `0`、P95 `1465ms`、usage `5764/232`、CNY `0.018684/1.00`。V1--V9 manifest 未变，V10 evidence/success seal immutable。根 `.env` 未改，V8/V9 eval 和 `REVIEW_AGENT_MODEL_ENABLED` / `PLANNER_AGENT_MODEL_ENABLED` 保持默认关闭，因此当前产品仍不会调用 Review/Planner 模型；先完成分支 Docker/headed-browser 验收，再考虑 main。模型不能决定 owner、facts、FSRS、分钟数、链接、任务或写权限；完整结果见 `docs/acceptance/phase-6-9-5-review-planner-v10-offline-checkpoint.md`。

## 当前数据流

- Auth：NestJS Auth API + PostgreSQL refresh token + httpOnly cookie；refresh token 已启用 rotation 与 reuse detection。
- WrongQuestion：`/wrong-questions` 是服务端权威来源，Dexie 作为离线缓存和乐观更新层。
- WrongQuestionOrganizer：`WrongQuestionSubjectGroup` / `WrongQuestionDeck` / `WrongQuestionDeckItem` 是错题组织层，按当前 `userId` 隔离；一个错题同一时间只属于当前用户一个 organizer deck，不替代 WrongQuestion / Card / ReviewLog / ReviewTask 事实来源。
- ChatMessage：`/chat-messages` 持久化聊天历史；`/chat-messages/sync` 使用会话快照幂等同步，不进入通用 mutation queue。
- OCRRecord：`/ocr-records` 持久化 OCR 历史；有效题目 OCR 会生成 `activeStudyContext` 供后续追问承接。
- Review：`/reviews` 已支持错题加入复习、学习统计和最近复习日志；`/review-tasks` 已支持今日复习任务、评分完成、跳过、恢复和未来复习计划预览；Card / ReviewLog / ReviewTask / ReviewPreference 以 PostgreSQL 为权威来源。
- Plan：`/review-tasks/plan` 只读预览未来复习压力，基于 `Card.nextReview`、`Card.difficulty`、`Card.stability` 和账号级 `ReviewPreference` 计算加权压力，不创建未来 `ReviewTask`。
- ReviewAgent / PlannerAgent：`/review-agent/suggestions` 经过 `JwtAuthGuard`，按当前 `userId` 聚合 Card、ReviewLog、ReviewTask 计划、ReviewPreference 和错题组织摘要，返回只读复习诊断与计划建议；不写 Card / ReviewLog / ReviewPreference / WrongQuestion / deck，也不进入 Dexie `mutationQueue`。
- Preference：`/review-preferences` 读写每日分钟、每日卡片上限、提醒时间、提醒开关和 7 / 14 天计划窗口。
- Stats：`/stats` 使用客户端 ECharts 展示趋势、评分分布和卡片状态。
- RAG 文档 API：`/knowledge/documents` 支持上传、列表、详情、删除和 `PUT /knowledge/documents/:id/file` 替换上传，`POST /knowledge/documents/:id/process` 支持处理上传文档。
- RAG 文档去重：普通上传会按当前用户 `contentHash` 返回已有同内容资料；替换上传保留同一 `Document.id`、清空旧 chunks、重置为 `PENDING`，并拒绝替换为其它资料卡片已有的相同内容。
- RAG 处理链路：TXT / Markdown / DOCX / PDF 可做基础文本解析，`@repo/rag` 负责段落感知分块；embedding provider 已抽象，默认 OpenAI-compatible `text-embedding-3-small`，本地开发和测试/e2e 可用 `RAG_EMBEDDING_PROVIDER=fake` 做无成本验收，production 禁止 fake provider。
- RAG 持久化：`Document` / `Chunk` 以 PostgreSQL + pgvector 为权威来源，`Chunk.embedding` 固定为 `vector(1536)` 并通过 raw SQL 持久化；处理前校验 document/user ownership。
- RAG 状态边界：`Document` 状态流为 `PENDING -> PROCESSING -> DONE / FAILED`，空文本、零 chunk、解析/embedding 失败进入 `FAILED`；forced reprocess 会先清旧 chunks，避免 stale retrieval。
- RAG 检索 API：`POST /knowledge/search` 已支持 query embedding + pgvector 相似度搜索，只检索当前用户 `DONE` 文档 chunks，支持 `limit`、`minScore` 和按 `documentId` 过滤。
- Chat RAG：`/api/chat` 已在有 access token 时调用 `/knowledge/search`，命中后把 chunks 注入 system prompt，并在助手消息末尾追加 Markdown “参考资料”；未上传资料、未命中或检索失败时仍降级普通 AI 回答。
- KnowledgeVerifierAgent：`/api/chat` 会在 RAG 命中后先执行本地 safety/eligibility gate；只有 semantic-needed 且安全的证据才可进入受控模型候选，gate 关闭或模型失败时回退确定性 policy。评估状态仍为 `trusted / suspicious / conflict / insufficient / skipped`，可疑、冲突或不足时会注入保守使用规则并追加温和“资料核对提示”。
- Chat live 流式结束后会等待短稳定窗口并校验 assistant 内容；若最后仍是 user 或 assistant 为空，不写 Dexie、不同步服务端，并提示“本次回答没有成功生成，请重试”。
- `/chat-messages/sync` 后端会拒绝不完整会话快照，非空快照必须以非空 `ASSISTANT` 消息收尾，防止前端兜底失效时污染 PostgreSQL。
- Agent Chat：`/api/chat` 已接入 `chat-agent-runtime` adapter，每次请求会通过 RouterAgent 生成 route metadata；`tutor` route 会调用 TutorAgent policy，生成 `explain_solution`、`socratic_hint`、`step_check`、`concept_bridge`、`answer_direct` 或 `general_follow_up` 策略。
- Agent headers：Chat 响应带 `x-prepmind-agent-route`、`x-prepmind-agent-confidence`、`x-prepmind-agent-rag-required`；Tutor 路线额外带 `x-prepmind-tutor-intent` 与 `x-prepmind-tutor-depth`；RAG 命中后会带 `x-prepmind-knowledge-verifier-status` 与 `x-prepmind-knowledge-verifier-chunks`。
- Agent prompt 顺序：`BASE_SYSTEM_PROMPT -> activeStudyContext -> agent/tutor strategy prompt -> RAG knowledge context -> verifier guidance`；RAG 因 token 预算被丢弃时，短 Agent prompt 仍保留，verifier notice 不追加。
- `@repo/agent` 不读取 API key；真实模型 executor 只能由 app/server composition root 注入，并同时受全局 Live 双开关、组件独立 gate、预算、超时与安全 eligibility 保护。Review/Planner 当前产品 gate 默认 `false`；V9 离线 CLI 的存在不代表 Live 已运行或产品模型已启用。
- `/knowledge` 页面已接入 RAG 文档管理与检索测试：支持资料上传、列表、处理、替换上传、删除内联确认、状态摘要和手动检索预览；资料卡片操作使用右上角三点菜单，点击页面其它区域可收起菜单，`DONE` 资料不再展示主按钮式重新处理；该页面在线直连 knowledge API，不进入 Dexie `mutationQueue`。
- `/error-book` 已升级为学科优先入口：错题首页展示学科卡片，学科内展示专题 deck，专题内展示错题列表；专题支持重命名，详情弹层、备注、掌握状态、删除确认和加入复习保持原有 CRUD 能力。
- Organizer API：`GET /wrong-question-groups`、`GET /wrong-question-groups/:subjectGroupId/decks`、`GET /wrong-question-decks/:deckId/questions`、`POST /wrong-question-organizer/organize/:wrongQuestionId`、`POST /wrong-question-organizer/organize-batch`、`PATCH /wrong-question-decks/:deckId`、`POST /wrong-question-decks/:deckId/items`、`DELETE /wrong-question-decks/:deckId/items/:wrongQuestionId`；在线直连 organizer API，不进入 Dexie `mutationQueue`。
- ReviewTask rating：评分请求带 `clientMutationId`，服务端用 `ReviewLog.clientMutationId` 做幂等，重复提交同一命令不重复写日志。
- Upload：新 OCR 图片通过 `/uploads/images` 上传 MinIO，业务 API 不接收 `data:` base64 图片。
- Offline：WrongQuestion / OCRRecord / ReviewTask rating 写失败进入 Dexie `mutationQueue`，session 恢复、online、focus 时自动 flush。
- Today：离线评分只展示本地待同步状态，不本地推进 FSRS、ReviewLog 或统计；同步成功后刷新今日复习和统计。
- AI：`/api/chat` 与 `/api/ocr` 仍由 Next.js API Route 代理 AI 服务；Chat 默认 mock 流式响应，live 模式需要 `AI_PROVIDER_MODE=live` 和 `AI_ENABLE_LIVE_CALLS=true` 双开关，默认使用 `deepseek-v4-flash`。
- AI 成本保护：`/api/chat` 统一估算 system prompt、activeStudyContext 和近期消息 token，默认输入上限 2500、输出上限 1200，live 调用会打印用量估算日志。
- UI：Chat / OCR 流式输出使用渐进 Markdown 渲染，自动滚动遵循用户滚动意图。

## 文档入口

- `docs/roadmap.md`：阶段路线。
- `docs/data-flow.md`：当前数据流。
- `docs/dev-start.md`：本地启动。
- `DEVLOG.md`：按日期记录开发日志，待办统一放文末。
