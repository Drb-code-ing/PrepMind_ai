# PrepMind AI 智能备考助手

PrepMind AI 是一个移动端优先的 AI 智能备考助手，目标是把“拍照识题、AI 讲题、错题本、间隔复习、知识库检索、Agent 工具调用”串成一个完整的学习产品。

这个仓库不是一次性 Demo，而是按 Phase 0 到 Phase 10 逐步推进的 AI 应用工程项目。当前已经完成前端 MVP、后端 Auth、业务数据服务端迁移、本地缓存工程化收尾与产品体验补全，Phase 2.5 已完成。

## 当前状态

| 阶段 | 主题 | 状态 |
| --- | --- | --- |
| Phase 0 | Monorepo、架构设计、Prisma 初稿、Docker 基础设施 | 已完成 |
| Phase 1 | 前端 MVP：AI 聊天、OCR、错题本、今日任务、本地持久化 | 已完成 |
| Phase 2.1 | NestJS 后端基础、PostgreSQL、Auth/User API、测试覆盖 | 已完成 |
| Phase 2.2 | 前端接入后端 Auth，登录态迁移到真实 session | 已完成 |
| Phase 2.3 | WrongQuestion、ChatMessage、OCRRecord、图片上传链路与本地缓存工程化 | 已完成 |
| Phase 2.5 | Chat-first 产品壳层、注册/登录页视觉统一、个人中心、今日任务和交互打磨 | 已完成 |
| Phase 3+ | Structured Output、Tool Calling、FSRS、RAG、LangGraph、MCP | 规划中 |

## 已实现能力

- 真实登录注册：NestJS Auth API、JWT access token、httpOnly refresh token、refresh token rotation 与 reuse detection。
- AI 聊天：基于 Vercel AI SDK 的流式输出，支持 Markdown、GFM、数学公式和上下文窗口裁剪。
- 拍照识题：图片上传、OCR 流式识别、题目上下文注入，用户可以继续追问“这一步为什么这样做”。
- 错题本：服务端 CRUD、用户级数据隔离、保存成功反馈、备注、掌握状态、删除确认。
- 聊天历史：服务端 ChatMessage API 持久化，刷新后可恢复历史。
- OCR 历史：服务端 OCRRecord API，按用户隔离，支持本地缓存兜底。
- 图片存储：新 OCR 图片上传到 MinIO，OCRRecord / WrongQuestion 优先保存服务端图片 URL。
- 本地缓存：Dexie 作为离线缓存、快速恢复和乐观更新层，不再作为登录态权威来源。
- 失败补偿：WrongQuestion / OCRRecord 写操作失败时进入本地 mutation queue，恢复网络或重新聚焦后自动补偿同步。
- 移动端优先：PWA 方向，触摸交互、流式输出、自动滚动都按移动端体验优化。
- 产品体验：Chat-first 主入口、注册/登录页、侧边栏、今日任务、错题本、个人中心和聊天页已统一到亮色轻漫画视觉系统。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, TanStack Query, Zustand, Dexie |
| Backend | NestJS 11, Prisma, PostgreSQL, JWT, Zod |
| AI | Vercel AI SDK, OpenAI / DeepSeek API |
| Storage | PostgreSQL, MinIO, IndexedDB |
| Infra | Docker Compose, pgvector, Redis |
| Planned | FSRS, RAG, LangGraph, MCP, BullMQ, OpenTelemetry, Sentry, Prometheus |

## 架构概览

```mermaid
flowchart LR
  User[Student] --> Web[Next.js Web / PWA]

  Web --> ApiClient[apiClient + TanStack Query]
  Web --> NextApi[Next.js API Routes]
  Web --> Dexie[Dexie / IndexedDB Cache]

  ApiClient --> Server[NestJS REST API]
  NextApi --> LLM[OpenAI / DeepSeek]

  Server --> Prisma[Prisma]
  Prisma --> Postgres[(PostgreSQL + pgvector)]
  Server --> MinIO[(MinIO)]
  Server --> Redis[(Redis / planned queues)]

  LLM --> Web
  Postgres --> Server
  MinIO --> Server
```

当前边界：

- 登录态权威来源是 NestJS Auth API + PostgreSQL refresh token。
- WrongQuestion / ChatMessage / OCRRecord 的权威来源已经迁移到 PostgreSQL。
- `/api/chat` 与 `/api/ocr` 仍由 Next.js API Routes 代理外部 AI 服务。
- Dexie 负责本地快速恢复、离线兜底、乐观更新和旧图片预览。
- Phase 2.5 视觉更新不改变 Auth、Chat、OCR、WrongQuestion 的数据流边界。

## 数据流示例

### AI 聊天

```text
用户输入
  -> Next.js Chat UI
  -> /api/chat
  -> 上下文窗口裁剪 + activeStudyContext 注入
  -> OpenAI / DeepSeek SSE
  -> 渐进式 Markdown 流式渲染
  -> Dexie 本地缓存
  -> POST /chat-messages/sync
  -> PostgreSQL
```

### 拍照识题与保存错题

```text
用户选择图片
  -> 本地即时预览
  -> POST /uploads/images -> MinIO
  -> POST /api/ocr -> 外部 OCR 模型 SSE
  -> POST /ocr-records
  -> 生成 activeStudyContext
  -> 用户确认保存
  -> POST /wrong-questions
  -> 成功：PostgreSQL + Dexie 缓存
  -> 失败：Dexie mutationQueue 暂存，后续自动补偿同步
```

## Monorepo 结构

```text
apps/
  web/       Next.js 前端应用
  server/    NestJS 后端服务

packages/
  database/  Prisma schema、migration、database client
  types/     共享 Zod schema 与 API 类型
  ai/        AI 能力封装预留
  fsrs/      间隔重复算法包预留
  rag/       RAG 能力预留
  agent/     LangGraph Agent 预留
  mcp/       MCP 工具体系预留
  ui/        共享 UI 组件预留

docker/      本地开发基础设施
docs/        架构、数据流、路线图和启动文档
```

## 本地启动

项目使用 Bun workspace。Windows 本机开发推荐使用 Docker Desktop 启动 PostgreSQL / Redis / MinIO。

### 1. 安装依赖

```powershell
bun install
```

### 2. 启动基础设施

本项目本机 PostgreSQL 固定使用宿主机 `5433`，避免和 Windows 本地 PostgreSQL 的 `5432` 冲突。

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
```

### 3. 配置环境变量

根目录 `.env`：

```text
DATABASE_URL=postgresql://prepmind:devpass@127.0.0.1:5433/prepmind
JWT_SECRET=dev-secret-change-me
```

`apps/server/.env` 保持和根目录 `.env` 一致。

`apps/web/.env.local`：

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
DEEPSEEK_API_KEY=your_deepseek_api_key
OPENAI_API_KEY=your_openai_api_key
```

只需要配置一个可用的模型 API key 即可。

### 4. 初始化数据库

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun run db:generate
bun run db:migrate
```

### 5. 启动后端与前端

后端：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
bun --filter @repo/server start:dev
```

前端：

```powershell
bun --filter @repo/web dev
```

默认访问：

```text
Web: http://localhost:3000
API: http://localhost:3001
Health: http://localhost:3001/health
MinIO Console: http://127.0.0.1:9001
```

MinIO 默认账号：

```text
minioadmin / minioadmin
```

## 常用命令

```powershell
# 前端
bun --filter @repo/web lint
bun --filter @repo/web build

# 后端
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e

# packages
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
```

## 当前重点与下一步

Phase 3 计划：

- OCR structured output schema。
- AI 讲题字段标准化。
- Tool Calling：创建错题、检索知识点、创建复习任务。

更长期：

- FSRS 记忆系统。
- RAG 知识库与 pgvector 检索。
- LangGraph 多 Agent 系统。
- MCP 工具体系。
- 生产级可观测性与部署。

## 设计原则

- 移动端优先：学生主要在手机上刷题、拍照和追问。
- 服务端权威：登录态与核心业务数据逐步迁移到 PostgreSQL。
- 本地优先体验：Dexie 保留快速恢复、离线兜底、乐观更新和历史图片预览。
- 类型共享：请求/响应 schema 优先放入 `@repo/types`，前后端共用 Zod。
- 阶段推进：先把主链路跑稳，再逐步引入 FSRS、RAG、Agent、MCP 和生产观测。

## 文档入口

- [开发路线图](./docs/roadmap.md)
- [数据流说明](./docs/data-flow.md)
- [本地启动命令](./docs/dev-start.md)
- [架构设计文档](./docs/architecture.md)
- [开发日志](./DEVLOG.md)

## 项目声明

这是一个学习与作品集导向的 AI 应用工程项目，当前仍在快速迭代中。仓库中的 Phase 规划会随着实现进度持续更新，README 会保持描述当前真实状态，而不是提前包装成已经完工的产品。
