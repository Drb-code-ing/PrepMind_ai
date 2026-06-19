# PrepMind AI — 仓库协作指南

PrepMind AI 是移动端优先的 Web + PWA 智能备考助手。项目按 Phase 0 ~ Phase 10 推进，当前 Phase 5.6 已完成，后续进入 Phase 6。

## 项目快照

| 阶段 | 状态 | 重点 |
| --- | --- | --- |
| Phase 0 | 已完成 | Monorepo、Prisma 初稿、Docker 基础设施 |
| Phase 1 | 已完成 | 前端 MVP、AI 聊天、OCR、错题本、今日任务、Dexie 本地持久化 |
| Phase 2.1 | 已完成 | NestJS 后端基础、PostgreSQL、Auth/User API |
| Phase 2.2 | 已完成 | 前端 Auth 接入后端，登录态由后端 session 权威控制 |
| Phase 2.3 | 已完成 | WrongQuestion / ChatMessage / OCRRecord API、MinIO 图片链路、Dexie mutationQueue |
| Phase 2.5 | 已完成 | Chat-first 产品壳层、注册登录页、个人中心、今日任务、错题本和聊天体验打磨 |
| Phase 3 | 已完成 | OCR structured output、AI 讲题 prompt、多题保存、tool action proposal 边界 |
| Phase 4.1 | 已完成 | WrongQuestion-first FSRS 复习闭环、Review API、今日复习卡 |
| Phase 4.2 | 已完成 | 学习统计页、Review stats/logs API、复习趋势与最近记录 |
| Phase 4.3 | 已完成 | ReviewTask 持久化任务流、今日任务迁移、评分完成、跳过和恢复 |
| Phase 4.4 | 已完成 | 离线评分队列、服务端幂等评分、今日复习待同步状态和 in-app 提醒摘要 |
| Phase 4.5.1 | 已完成 | 复习计划预览、`/review-tasks/plan`、`/plan` 页面、`/stats` ECharts 图表 |
| Phase 4.5.2 | 已完成 | `ReviewPreference`、加权压力模型、7 / 14 天计划窗口、今日容量摘要 |
| Phase 5.0 | 已完成 | RAG 知识库设计、可降级 Chat 边界、Phase 5.1 实施计划 |
| Phase 5.1 | 已完成 | RAG 数据模型、`vector(1536)` 索引预留、knowledge API contract |
| Phase 5.2 | 已完成 | 文档上传、列表、详情、删除与状态 API |
| Phase 5.3 | 已完成 | 文档解析、分块、embedding 入库、`POST /knowledge/documents/:id/process` |
| Phase 5.4 | 已完成 | 检索 API、`POST /knowledge/search`、query embedding + pgvector 相似度搜索 |
| Phase 5.5 | 已完成 | Chat RAG 增强、知识库上下文注入、Markdown citations |
| Phase 5.6 | 已完成 | `/knowledge` 学习资料工作台、上传/处理/删除/检索测试前端闭环 |

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui, TanStack Query, Zustand, Dexie, PWA |
| Backend | NestJS 11, Prisma, PostgreSQL, Redis, BullMQ |
| AI | Vercel AI SDK, OpenAI, DeepSeek, Gemini |
| Agent / RAG / MCP | LangGraph, pgvector, bge-m3, MCP JSON-RPC |
| Infra | Docker, MinIO, Sentry, OpenTelemetry, Prometheus, Grafana |

Agent 框架使用 LangGraph，不使用 AutoGen。
Phase 6 是多 Agent 协作亮点阶段：`KnowledgeVerifierAgent` 用于在 RAG 检索命中后、最终回答前评估资料片段和回答初稿，避免 AI 盲从错误笔记；`WrongQuestionOrganizerAgent` 用于把错题本组织为学科卡片和专题 deck，用户可重命名、移动和合并专题，用户修改不被 AI 自动覆盖。

## 常用命令

本仓库使用 Bun workspace。Windows 本机开发优先使用 Bun，Docker PostgreSQL 固定宿主机端口 `5433`。

```powershell
bun install

$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

$env:RAG_EMBEDDING_PROVIDER='fake'
bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

常用验证：

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

后端 e2e 需要 Docker PostgreSQL 正在运行。详细启动说明见 `docs/dev-start.md`。

## 环境变量

- 根目录 `.env`：后端和 Prisma 使用，至少包含 `DATABASE_URL`、`JWT_SECRET`。
- `apps/server/.env`：server/e2e 在服务目录运行时读取，保持和根 `.env` 一致。
- `apps/web/.env.local`：Next.js API Route 使用；开发默认 `AI_PROVIDER_MODE=mock`，即使存在 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY` 也不会调用真实模型。
- 真实模型验收必须同时设置 `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true`；默认 live 模型为 `deepseek-v4-flash`，并建议保留 `AI_MAX_INPUT_TOKENS=2500`、`AI_MAX_OUTPUT_TOKENS=1200` 预算上限。

推荐数据库连接：

```text
DATABASE_URL=postgresql://prepmind:devpass@127.0.0.1:5433/prepmind
```

env 文件均被 git 忽略，不提交密钥。

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
- `@repo/types` 是前后端 API contract 的优先位置，使用 Zod 表达 schema。

## 代码约定

- TypeScript strict。
- Prettier：2 空格、单引号、分号、100 字符宽。
- 文件名 kebab-case，类名 PascalCase，变量 camelCase。
- 导入顺序：外部库 -> `@repo/*` -> 相对路径。
- NestJS 遵循 Controller -> Service -> Repository。
- 高频 SQL 查询必须建索引。
- 移动端优先，触摸目标不小于 44x44px。
- PWA 页面要考虑离线静态访问和主屏幕添加体验。

## 当前数据流

- 登录态权威来源：NestJS Auth API + PostgreSQL refresh token + httpOnly cookie。
- Refresh token 已启用 rotation 与 reuse detection；Auth 主链路不依赖 Redis。
- WrongQuestion / ChatMessage / OCRRecord 已迁移到 PostgreSQL，按当前 `userId` 隔离。
- Review：`/reviews` 已支持错题加入复习、学习统计和最近复习日志；`/review-tasks` 已支持今日复习任务、评分完成、跳过、恢复和未来复习计划预览；Card / ReviewLog / ReviewTask / ReviewPreference 以 PostgreSQL 为权威来源。
- `/review-preferences` 读写当前用户账号级复习计划偏好，包括每日分钟、每日卡片上限、提醒时间、提醒开关和计划窗口。
- `/review-tasks/plan` 是只读预览接口，基于 `Card.nextReview`、`Card.difficulty`、`Card.stability` 和 `ReviewPreference` 计算加权压力，不创建未来 `ReviewTask`。
- `/plan` 展示未来 7 / 14 天复习压力、容量状态、原因标签和偏好设置；`/stats` 使用客户端 ECharts 展示趋势、评分分布和卡片状态，避免 SSR hydration 风险。
- RAG 文档 API：`/knowledge/documents` 已支持上传、列表、详情和删除，`POST /knowledge/documents/:id/process` 已支持处理上传文档。
- RAG 处理链路：支持 TXT / Markdown / DOCX / PDF 基础文本解析，使用 `@repo/rag` 段落感知分块；embedding provider 已抽象，默认 OpenAI-compatible `text-embedding-3-small`，本地开发和测试/e2e 可用 `RAG_EMBEDDING_PROVIDER=fake` 做无成本验收，production 禁止 fake provider。
- RAG 持久化：`Document` / `Chunk` 以 PostgreSQL + pgvector 为权威来源，`Chunk.embedding` 固定为 `vector(1536)` 并通过 raw SQL 持久化；写入前校验 document/user ownership。
- RAG 状态边界：`Document` 状态流为 `PENDING -> PROCESSING -> DONE / FAILED`，空文本、零 chunk、解析/embedding 失败进入 `FAILED`；forced reprocess 会先清旧 chunks，避免 stale retrieval。
- RAG 检索 API：`POST /knowledge/search` 已支持 query embedding + pgvector 相似度搜索，只检索当前用户 `DONE` 文档 chunks，支持 `limit`、`minScore` 和按 `documentId` 过滤。
- Chat RAG：`/api/chat` 已在有 access token 时调用 `/knowledge/search`，命中后把 chunks 注入 system prompt，并在助手消息末尾追加 Markdown “参考资料”；无 token、无命中或检索失败时降级普通 AI 回答。
- `/knowledge` 页面已接入 RAG 文档管理与检索测试：支持资料上传、列表、处理/重新处理、删除内联确认、状态摘要和手动检索预览；该页面为在线能力，不进入 Dexie `mutationQueue`。
- Phase 6 再接 `KnowledgeVerifierAgent` 评估资料可信度。
- ReviewTask 评分支持 `clientMutationId` 幂等；重复提交同一评分命令不会重复写入 `ReviewLog`。
- Dexie 继续作为本地快速恢复、离线兜底、乐观更新和旧图片预览层。
- WrongQuestion / OCRRecord / ReviewTask rating 写失败进入 Dexie `mutationQueue`，在 session 恢复、online、focus 时自动补偿同步。
- 今日任务页会展示本地待同步评分；离线评分不本地推进 FSRS、ReviewLog 或统计，仍以服务端同步成功为准。
- ChatMessage 不进入通用 mutation queue，继续使用 `/chat-messages/sync` 的会话快照幂等同步。
- 新 OCR 图片通过 `/uploads/images` 上传到 MinIO；`/ocr-records` 与 `/wrong-questions` 不接收 `data:` base64 图片。
- `/api/chat` 与 `/api/ocr` 仍由 Next.js API Route 代理 AI 服务；`/api/chat` 默认使用本地 mock 流式响应，只有显式 live 双开关开启后才调用外部模型，live 默认模型为 `deepseek-v4-flash`。
- `/api/chat` 已加入上下文窗口、active OCR 题目上下文预算和输出 token 上限；有效 OCR 题目会生成 `activeStudyContext` 供后续追问承接。
- Chat / OCR 流式输出使用渐进 Markdown 渲染；展示格式化不回写 OCR 原始内容和 `activeStudyContext`。
- 今日任务轻手账与学习偏好仍是 userId scoped localStorage 数据，不进入 mutation queue，也暂不注入 prompt。
- 今日复习卡来自 `/review-tasks/today`，不存入 localStorage；轻手账 checklist 仍保存在 localStorage。

详细数据流见 `docs/data-flow.md`。

## 当前注意事项

- Docker PostgreSQL 使用 `5433 -> 5432` 映射，避免与 Windows 本地 PostgreSQL 冲突。
- 开发环境 CORS 允许 `localhost`、`127.0.0.1` 和私有局域网地址动态端口。
- PostgreSQL 需要 pgvector：`CREATE EXTENSION IF NOT EXISTS vector;`。
- `packages/fsrs` 保持纯算法包，不依赖数据库。
- 后续异步任务使用 BullMQ：OCR、Embedding、PDF 解析等走队列。
- 向量索引用 raw SQL 创建，Prisma 不直接支持向量索引。

## 下一步

后续最优先：

1. Phase 6：LangGraph 多 Agent 系统，其中 `KnowledgeVerifierAgent` 负责 RAG 资料可信度评估，`WrongQuestionOrganizerAgent` 采用“学科卡片优先、内部专题分化”的错题本组织方式。
2. Phase 7：BullMQ 后台任务、事件总线和生产化工程增强。
