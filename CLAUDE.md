# PrepMind AI — AI 智能备考助手

本文件是 Claude/Codex 在本仓库协作时的项目上下文。内容与 `AGENTS.md` 保持一致，优先按这里的阶段状态和工程约定执行。

## 项目定位

PrepMind AI 是移动端优先的 Web + PWA 智能备考助手。项目按 Phase 0 ~ Phase 10 推进，目标覆盖完整 AI 应用工程链路：Next.js、NestJS、Prisma、PostgreSQL、Redis、LangGraph、RAG、FSRS、MCP 与生产观测。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui, zustand, Dexie, PWA |
| Frontend Phase 2 | TanStack Query |
| Backend | NestJS 11, Prisma, PostgreSQL, Redis, BullMQ |
| AI | Vercel AI SDK, OpenAI, DeepSeek, Gemini |
| Agent | LangGraph，不使用 AutoGen |
| RAG | pgvector, bge-m3, Hybrid Search, Rerank |
| MCP | Model Context Protocol, JSON-RPC |
| Infra | Docker, Sentry, OpenTelemetry, Prometheus, Grafana |

## 本机命令

当前使用 Bun workspace。pnpm 在本机可能有权限问题，不作为默认验证方式。

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

bun --cwd packages/database test
bun --cwd packages/fsrs test
```

## 环境变量

- 根目录 `.env`：后端和 Prisma 使用。
- `apps/server/.env`：server e2e 在服务目录运行时读取。
- `apps/web/.env.local`：Next.js API Route 使用。
- 本机数据库端口固定为 `5433`：

```text
DATABASE_URL=postgresql://prepmind:devpass@127.0.0.1:5433/prepmind
```

这些文件被 `.gitignore` 忽略，不提交密钥。

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
- `packages/fsrs` 保持纯算法包。
- NestJS 使用 Controller -> Service -> Repository。
- DTO 和 API contract 优先放入 `@repo/types`，用 Zod 表达。

## 当前阶段状态

### Phase 0 — 已完成

- Monorepo 与基础设计。
- Prisma schema 初稿。
- Docker 基础设施。

### Phase 1 — 已完成

- 纯前端 MVP。
- localStorage 保存登录态和 UI 草稿。
- Dexie 保存 `messages`、`ocrRecords`、`wrongQuestions`。
- AI Chat/OCR 通过 Next.js API Route 代理。
- 错题本 CRUD 与今日任务静态版已完成。

### Phase 2.1 — 已完成

- Bun workspace 迁移。
- Docker PostgreSQL + pgvector 使用本机 5433。
- Prisma Auth schema + migration。
- NestJS Config、Database、Health 基础模块。
- 统一响应 envelope、异常过滤器、requestId。
- Auth API：register、login、me、refresh、logout。
- Refresh token 使用服务端哈希存储和 httpOnly cookie。
- Users API：读取和更新当前用户资料。
- `@repo/types` 新增 Auth/Common API schemas。
- AuthService 单元测试和 Auth e2e 覆盖。

## 当前数据流

- 前端登录 UI 尚未接入 Phase 2.1 Auth API，仍使用 Phase 1 localStorage 模拟登录。
- 后端 Auth API 已可独立工作，是 Phase 2.2 前端迁移的目标接口。
- `/api/chat` 与 `/api/ocr` 仍在 Next.js 侧代理外部 AI 服务。
- PostgreSQL 当前是后端用户和 refresh token 的权威数据源。
- Dexie 暂时仍是聊天、OCR、错题和今日任务的前端本地业务数据源。

## 下一步

Phase 2.2：

- 封装前端 `apiClient`。
- 接入 TanStack Query。
- 前端登录/注册迁移到 NestJS Auth API。
- 实现 session 恢复、401 处理和登出清理。
- Dexie 降级为离线缓存层，为后续 WrongQuestion/Chat/OCR API 迁移做准备。
