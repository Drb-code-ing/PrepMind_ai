# PrepMind AI — 协作上下文

本文件给 Claude/Codex 提供仓库快速上下文。详细规则以 `AGENTS.md` 为准，阶段规划看 `docs/roadmap.md`，数据流看 `docs/data-flow.md`。

## 当前阶段

PrepMind AI 是移动端优先的 Web + PWA 智能备考助手。当前 Phase 5.3 已完成，后续进入 Phase 5.4。

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

下一步：

1. Phase 5.4：检索 API。
2. Phase 6：LangGraph 多 Agent 系统，其中 `KnowledgeVerifierAgent` 负责 RAG 资料可信度评估，`WrongQuestionOrganizerAgent` 负责未来错题本学科卡片与专题 deck 归纳。

## 常用命令

```powershell
bun install

$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

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
- Phase 6 多 Agent 规划：`KnowledgeVerifierAgent` 在 RAG 检索命中后、最终回答前评估资料片段和回答初稿，避免 AI 盲从错误笔记；`WrongQuestionOrganizerAgent` 让错题首页按学科卡片优先展示，学科内部按 AI 专题 deck 下钻；AI 可生成默认专题名，但用户重命名、移动和合并拥有最终优先级。

## 当前数据流

- Auth：NestJS Auth API + PostgreSQL refresh token + httpOnly cookie；refresh token 已启用 rotation 与 reuse detection。
- WrongQuestion：`/wrong-questions` 是服务端权威来源，Dexie 作为离线缓存和乐观更新层。
- ChatMessage：`/chat-messages` 持久化聊天历史；`/chat-messages/sync` 使用会话快照幂等同步，不进入通用 mutation queue。
- OCRRecord：`/ocr-records` 持久化 OCR 历史；有效题目 OCR 会生成 `activeStudyContext` 供后续追问承接。
- Review：`/reviews` 已支持错题加入复习、学习统计和最近复习日志；`/review-tasks` 已支持今日复习任务、评分完成、跳过、恢复和未来复习计划预览；Card / ReviewLog / ReviewTask / ReviewPreference 以 PostgreSQL 为权威来源。
- Plan：`/review-tasks/plan` 只读预览未来复习压力，基于 `Card.nextReview`、`Card.difficulty`、`Card.stability` 和账号级 `ReviewPreference` 计算加权压力，不创建未来 `ReviewTask`。
- Preference：`/review-preferences` 读写每日分钟、每日卡片上限、提醒时间、提醒开关和 7 / 14 天计划窗口。
- Stats：`/stats` 使用客户端 ECharts 展示趋势、评分分布和卡片状态。
- RAG 文档 API：`/knowledge/documents` 支持上传、列表、详情和删除，`POST /knowledge/documents/:id/process` 支持处理上传文档。
- RAG 处理链路：TXT / Markdown / DOCX / PDF 可做基础文本解析，`@repo/rag` 负责段落感知分块；embedding provider 已抽象，默认 OpenAI-compatible `text-embedding-3-small`，测试/e2e 使用 fake provider。
- RAG 持久化：`Document` / `Chunk` 以 PostgreSQL + pgvector 为权威来源，`Chunk.embedding` 固定为 `vector(1536)` 并通过 raw SQL 持久化；处理前校验 document/user ownership。
- RAG 状态边界：`Document` 状态流为 `PENDING -> PROCESSING -> DONE / FAILED`，空文本、零 chunk、解析/embedding 失败进入 `FAILED`；forced reprocess 会先清旧 chunks，避免 stale retrieval。
- RAG 当前未实现 search API、Chat RAG 注入、citations 和 `/knowledge` 前端页面；Chat 未上传资料、未命中或检索失败时仍降级普通 AI 回答。
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
