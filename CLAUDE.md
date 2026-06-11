# PrepMind AI — 协作上下文

本文件给 Claude/Codex 提供仓库上下文。内容与 `AGENTS.md` 保持一致；如果两者冲突，以当前任务的最新用户要求为准。

## 项目定位

PrepMind AI 是移动端优先的 Web + PWA 智能备考助手。项目按 Phase 0 ~ Phase 10 推进，目标覆盖完整 AI 应用工程链路：Next.js、NestJS、Prisma、PostgreSQL、Redis、LangGraph、RAG、FSRS、MCP 与生产观测。

## 当前阶段

- Phase 0：已完成。
- Phase 1：前端 MVP 已完成。
- Phase 2.1：后端基础与 Auth/User API 已完成。
- Phase 2.2：前端 Auth 已接入后端，已完成。
- 下一步：Phase 2.3，迁移错题/聊天/OCR 业务 API。

## 开发命令

```powershell
bun install

$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

bun --filter @repo/web dev
bun --filter @repo/server start:dev

bun --filter @repo/web lint
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
```

后端 e2e 需要 Docker PostgreSQL 运行在 `127.0.0.1:5433`。

## 环境变量

- 根目录 `.env`：后端与 Prisma 使用。
- `apps/server/.env`：server/e2e 在服务目录运行时读取。
- `apps/web/.env.local`：Next.js API Route 使用。

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

## 当前数据流

- 前端登录/注册已调用 NestJS Auth API。
- refresh token 使用 httpOnly cookie，服务端只存 hash。
- refresh token 已启用 rotation；旧 RT 重放时会撤销同 family 的活跃 RT 并强制重新登录。
- Phase 2 Auth 主链路不依赖 Redis，refresh token 状态存放在 PostgreSQL。
- 前端运行态保存 access token 与当前用户。
- 应用启动时调用 `/auth/refresh` 恢复 session。
- `AuthGuard` 以后端 session 为权威来源。
- Dexie 仍保存 Phase 1 业务数据：聊天、OCR、错题本、今日任务。
- `/api/chat` 与 `/api/ocr` 仍由 Next.js API Route 代理外部 AI 服务。

## 下一步重点

Phase 2.3：

- WrongQuestion CRUD API。
- ChatMessage API。
- OCRRecord API。
- Dexie 作为离线缓存与乐观更新层。
- 图片存储从 base64 迁移到 MinIO/OSS URL。
