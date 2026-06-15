# PrepMind AI 智能备考助手

PrepMind AI 是一个移动端优先的 AI 智能备考助手，目标是把拍照识题、AI 讲题、错题本、间隔复习、知识库检索和 Agent 工具调用串成完整学习闭环。

项目不是一次性 Demo，而是按 Phase 0 到 Phase 10 逐步推进的 AI 应用工程项目。当前已完成前端 MVP、后端鉴权、业务数据服务端迁移、结构化 OCR、AI 讲题上下文、FSRS 复习闭环、学习统计、ReviewTask 持久化任务流和离线评分队列。下一步进入 Phase 4.5：复习提醒与长期计划策略。

## 当前状态

| 阶段 | 主题 | 状态 |
| --- | --- | --- |
| Phase 0 | Monorepo、架构设计、Prisma 初稿、Docker 基础设施 | 已完成 |
| Phase 1 | 前端 MVP：AI 聊天、OCR、错题本、今日任务、本地持久化 | 已完成 |
| Phase 2.1 | NestJS 后端基础、PostgreSQL、Auth/User API、测试覆盖 | 已完成 |
| Phase 2.2 | 前端接入后端 Auth，登录态迁移到真实 session | 已完成 |
| Phase 2.3 | WrongQuestion、ChatMessage、OCRRecord、图片上传链路、本地补偿队列 | 已完成 |
| Phase 2.5 | Chat-first 产品壳层、注册登录页、个人中心、今日任务、交互体验 | 已完成 |
| Phase 3 | AI 讲题系统：structured output、prompt、多题保存、tool action 边界 | 已完成 |
| Phase 4.1 | WrongQuestion-first FSRS 复习闭环、Review API、今日复习卡 | 已完成 |
| Phase 4.2 | 学习统计页、Review stats/logs API、复习趋势与最近记录 | 已完成 |
| Phase 4.3 | ReviewTask 持久化任务流、评分完成、跳过和恢复 | 已完成 |
| Phase 4.4 | 离线评分队列、服务端幂等评分、待同步状态和 in-app 提醒摘要 | 已完成 |
| Phase 4.5 | 复习提醒与长期计划策略 | 下一步 |

## 已实现能力

- 真实登录注册：NestJS Auth API、JWT access token、httpOnly refresh token、refresh token rotation 与 reuse detection。
- AI 聊天：流式输出、Markdown / GFM / 数学公式渲染、上下文窗口裁剪。
- 拍照识题：图片上传、OCR 流式识别、结构化题目输出、多题拆分、有效题目上下文注入，支持围绕当前题目继续追问。
- 错题本：服务端 CRUD、用户级数据隔离、备注、掌握状态、删除确认和操作反馈。
- AI 讲题上下文：OCR structured output 写入 `OcrRecord.parsedJson`，`activeStudyContext` 从结构化题目生成。
- FSRS 复习：错题可加入复习计划，支持 Again / Hard / Good / Easy 四档评分和下一次复习调度。
- 今日复习任务：`ReviewTask` 持久化 pending / completed / skipped / cancelled 生命周期，支持跳过和恢复。
- 离线评分：ReviewTask rating 支持 `clientMutationId` 幂等，弱网失败进入 Dexie mutation queue，待同步期间不本地推进 FSRS 或统计。
- 学习统计：`/stats` 展示复习总览、7 天 / 30 天趋势、评分分布、卡片状态和最近复习记录。
- 历史恢复：聊天历史和 OCR 历史已进入 PostgreSQL，Dexie 负责本地快速恢复和离线兜底。
- 图片存储：新 OCR 图片上传到 MinIO，OCRRecord / WrongQuestion 优先保存服务端图片 URL。
- 离线补偿：WrongQuestion / OCRRecord / ReviewTask rating 写操作失败时进入 Dexie mutation queue，网络恢复后自动补偿同步。
- 产品体验：Chat-first 主入口，注册登录页、侧边栏、今日任务、错题本、个人中心和聊天页统一到亮色轻漫画视觉系统。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, TanStack Query, Zustand, Dexie |
| Backend | NestJS 11, Prisma, PostgreSQL, JWT, Zod |
| AI | Vercel AI SDK, OpenAI / DeepSeek API |
| Review | FSRS, Card, ReviewLog, ReviewTask |
| Storage | PostgreSQL, MinIO, IndexedDB / Dexie |
| Infra | Docker Compose, pgvector, Redis |
| Planned | RAG, LangGraph, MCP, BullMQ, OpenTelemetry, Sentry, Prometheus |

## 架构概览

```mermaid
flowchart LR
  User[Student] --> Web[Next.js Web / PWA]
  Web --> ApiClient[apiClient + TanStack Query]
  Web --> NextApi[Next.js API Routes]
  Web --> Dexie[Dexie / IndexedDB]
  ApiClient --> Server[NestJS REST API]
  NextApi --> LLM[OpenAI / DeepSeek]
  Server --> Prisma[Prisma]
  Server --> FSRS[@repo/fsrs]
  Prisma --> Postgres[(PostgreSQL + pgvector)]
  Server --> MinIO[(MinIO)]
  Server --> Redis[(Redis / planned queues)]
```

当前边界：

- 登录态权威来源是 NestJS Auth API + PostgreSQL refresh token。
- WrongQuestion / ChatMessage / OCRRecord 权威来源已迁移到 PostgreSQL。
- Card / ReviewLog / ReviewTask 权威来源是 PostgreSQL，学习统计以 ReviewLog 为事实来源。
- `/api/chat` 与 `/api/ocr` 仍由 Next.js API Routes 代理外部 AI 服务。
- Dexie 负责本地快速恢复、离线兜底、乐观更新和旧图片预览；ReviewTask rating 已进入 mutation queue，但服务端仍是 FSRS 与统计权威来源。

## Monorepo 结构

```text
apps/
  web/       Next.js 前端应用
  server/    NestJS 后端服务

packages/
  database/  Prisma schema、migration、database client
  types/     共享 Zod schema 与 API 类型
  ai/        AI 能力封装预留
  fsrs/      FSRS 间隔重复调度算法
  rag/       RAG 能力预留
  agent/     LangGraph Agent 预留
  mcp/       MCP 工具体系预留
  ui/        共享 UI 组件预留

docker/      本地开发基础设施
docs/        架构、数据流、路线图和启动文档
```

## 本地启动

项目使用 Bun workspace。Windows 本机开发推荐使用 Docker Desktop 启动 PostgreSQL / Redis / MinIO。

```powershell
bun install

$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun run db:generate
bun run db:migrate

bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

默认访问：

```text
Web: http://localhost:3000
API: http://localhost:3001
Health: http://localhost:3001/health
MinIO Console: http://127.0.0.1:9001
```

更完整的环境变量、Prisma 和 Docker 命令见 [docs/dev-start.md](./docs/dev-start.md)。

## 常用验证

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

## 下一步

Phase 4 后续聚焦复习策略完整性：

1. Phase 4.5：复习提醒与长期计划策略。
2. Phase 5：RAG 知识库与 pgvector 检索。

## 文档入口

- [开发路线图](./docs/roadmap.md)
- [数据流说明](./docs/data-flow.md)
- [本地启动命令](./docs/dev-start.md)
- [架构设计文档](./docs/architecture.md)
- [开发日志](./DEVLOG.md)

## 项目声明

这是一个学习与作品集导向的 AI 应用工程项目，仍在快速迭代中。README 只描述当前真实状态，不把后续 Phase 包装成已经完成的能力。
