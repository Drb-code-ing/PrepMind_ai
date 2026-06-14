# PrepMind AI — 仓库协作指南

PrepMind AI 是移动端优先的 Web + PWA 智能备考助手。项目按 Phase 0 ~ Phase 10 推进，当前 Phase 4.3 已完成，Phase 4 继续推进。

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

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui, TanStack Query, Zustand, Dexie, PWA |
| Backend | NestJS 11, Prisma, PostgreSQL, Redis, BullMQ |
| AI | Vercel AI SDK, OpenAI, DeepSeek, Gemini |
| Agent / RAG / MCP | LangGraph, pgvector, bge-m3, MCP JSON-RPC |
| Infra | Docker, MinIO, Sentry, OpenTelemetry, Prometheus, Grafana |

Agent 框架使用 LangGraph，不使用 AutoGen。

## 常用命令

本仓库使用 Bun workspace。Windows 本机开发优先使用 Bun，Docker PostgreSQL 固定宿主机端口 `5433`。

```powershell
bun install

$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

常用验证：

```powershell
bun --filter @repo/web lint
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
- `apps/web/.env.local`：Next.js API Route 使用，包含 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`。

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
- Review：`/reviews` 已支持错题加入复习、学习统计和最近复习日志；`/review-tasks` 已支持今日复习任务、评分完成、跳过和恢复；Card / ReviewLog / ReviewTask 以 PostgreSQL 为权威来源。
- Dexie 继续作为本地快速恢复、离线兜底、乐观更新和旧图片预览层。
- WrongQuestion / OCRRecord 写失败进入 Dexie `mutationQueue`，在 session 恢复、online、focus 时自动补偿同步。
- ChatMessage 不进入通用 mutation queue，继续使用 `/chat-messages/sync` 的会话快照幂等同步。
- 新 OCR 图片通过 `/uploads/images` 上传到 MinIO；`/ocr-records` 与 `/wrong-questions` 不接收 `data:` base64 图片。
- `/api/chat` 与 `/api/ocr` 仍由 Next.js API Route 代理外部 AI 服务。
- `/api/chat` 已加入上下文窗口；有效 OCR 题目会生成 `activeStudyContext` 供后续追问承接。
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

Phase 4 后续最优先：

1. 离线评分队列与提醒策略。
2. 复习提醒与长期计划策略。
