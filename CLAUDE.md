# PrepMind AI — AI 智能备考助手

面向大厂 AI 应用方向的校招级项目。技术栈覆盖 Next.js + NestJS + LangGraph + MCP，目标是 3~6 个月完成 Phase 0~10，产出完整的生产级 AI 应用。

**定位**：移动端优先的 Web + PWA 应用。学生主要用手机刷题、拍照识题和 AI 对话，交互体验要接近原生 App。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui, zustand, Dexie, PWA |
| Frontend Phase 2 | TanStack Query 管理 API server state |
| Backend | NestJS 11, Prisma, PostgreSQL, Redis, BullMQ |
| AI | Vercel AI SDK, OpenAI, DeepSeek, Gemini |
| Agent | LangGraph（不要 AutoGen） |
| RAG | pgvector, bge-m3, Hybrid Search, Rerank |
| MCP | Model Context Protocol, JSON-RPC |
| Infra | Docker, Sentry, OpenTelemetry, Prometheus, Grafana |

## 当前本机命令

本仓库根脚本仍按 pnpm 设计，但当前 Windows 本机 pnpm store 存在权限问题，开发验证优先使用 npm workspace 命令。

| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装 workspace 依赖 |
| `npm --workspace @repo/web run dev` | 启动前端，默认 port 3000 |
| `npm --workspace @repo/web run lint` | 前端 lint |
| `npm --workspace @repo/web run build` | 前端构建 |
| `npm --workspace @repo/server run start:dev` | 启动后端，默认 port 3001 |
| `npm --workspace @repo/server run build` | 后端构建 |
| `npm --workspace @repo/server run test` | 后端测试 |
| `pnpm docker:up` | 启动 PG/Redis/MinIO；pnpm 恢复前可直接用 docker compose 命令 |

## 目录结构

```text
prepmind/
├── apps/
│   ├── web/                    # Next.js 前端（App Router, src/）
│   └── server/                 # NestJS 后端服务
├── packages/
│   ├── types/                  # 共享 TypeScript 类型 + Zod schemas
│   ├── database/               # Prisma schema + 数据访问
│   ├── ai/                     # LLM 调用封装
│   ├── fsrs/                   # FSRS 间隔重复算法核心
│   ├── rag/                    # RAG 核心
│   ├── agent/                  # LangGraph Agent
│   ├── mcp/                    # MCP 工具注册 + JSON-RPC
│   └── ui/                     # 共享 React 组件
├── docker/
├── infra/
└── docs/
```

## 模块依赖规则

```text
web → server（HTTP 调用，不直接 import）
server → database, ai, fsrs, rag, agent, mcp, types
agent → ai, fsrs, rag, mcp, types
rag → database, ai, types
fsrs → types
ai → types
mcp → ai, fsrs, rag, types
```

- `packages/` 内模块禁止依赖 `apps/`。
- 同层 packages 禁止循环依赖。
- `types` 是所有模块的基础依赖。
- Agent 框架使用 LangGraph，不使用 AutoGen。

## 代码约定

- TypeScript strict 模式。
- Prettier：2 空格、单引号、分号、100 字符宽。
- 文件名 kebab-case，类名 PascalCase，变量 camelCase。
- 导入顺序：外部库 → `@repo/*` → 相对路径。
- NestJS 使用 Controller → Service → Repository。
- Zod 用于 DTO 验证和 API Schema。
- 高频 SQL 查询必须建索引。
- 移动端优先，用 `sm:`/`md:`/`lg:` 向上适配。
- 触摸目标最小 44×44px。
- PWA 页面要考虑离线静态访问和主屏幕添加体验。

## 当前进度

严格按照 `docs/roadmap.md` 的 Phase 0 ~ Phase 10 顺序推进。

### Phase 0 — 已完成

- Monorepo + 设计文档。
- Prisma Schema 初稿。
- Docker 基础设施配置。

### Phase 1 — MVP 进行中

目标：真正跑起来。当前是纯前端 MVP，不接入数据库服务端。

- [x] 登录/注册页面 UI + 正则校验
- [x] zustand userStore + localStorage 持久化
- [x] AuthGuard 登录守卫
- [x] 移动端优先布局 + PWA manifest + shadcn/ui
- [x] AI 聊天 + 流式输出（Vercel AI SDK + DeepSeek SSE）
- [x] AI 回复 Markdown + GFM + 数学公式渲染
- [x] chatStore 临时状态管理（inputDraft 切页面不丢）
- [x] 代码质量审查 + 性能优化（React.memo, rAF 节流, useRef）
- [x] 拍照识题 + 图片上传 + OCR 流式输出
- [x] Dexie 本地持久化：`messages`、`ocrRecords`、`wrongQuestions`
- [x] OCR 与聊天统一时间线
- [x] 错题本 CRUD（本地版）
- [x] 今日任务（静态版本）

## Phase 1 数据流

- localStorage：只保存 `prepmind-user` 和 `prepmind-chat`。
- 今日任务静态版使用 `prepmind-today:{userId}:{yyyy-mm-dd}` 保存当天完成状态。
- Dexie 数据库：`prepmind-db`。
- Dexie 表：
  - `messages`：聊天消息，按 `userId` 隔离。
  - `ocrRecords`：OCR 图片与识别结果，按 `userId` 隔离，使用 `groupId` 绑定同一次 OCR。
  - `wrongQuestions`：错题本记录，按 `userId` 隔离，使用 `sourceGroupId` 防重复保存。
- OCR 是当前错题唯一来源：AI 识别题目，用户点击保存后写入错题本。
- 错题分类由 AI 输出字段优先决定，前端解析失败时按关键词兜底。
- 退出登录只清除登录态，不删除 IndexedDB 业务数据；同一账号重新登录可恢复自己的历史。
- 详细数据流见 `docs/data-flow.md`。

## 当前注意事项

- pnpm 9.x/11.x 在本机仍可能出现 `ERR_PNPM_EPERM` 权限错误，目前优先用 npm。
- PostgreSQL 必须启用 pgvector：`CREATE EXTENSION IF NOT EXISTS vector;`。
- 异步任务后续用 BullMQ：OCR、Embedding、PDF 解析都走队列。
- 向量索引用 raw SQL 创建，Prisma 不直接支持向量索引。
- MCP 工具注册中心规划在 `packages/mcp/src/registry.ts`。
- SSE 流式输出当前由 Next.js API Route 代理，Phase 2 再接 NestJS。
- `packages/fsrs` 应保持纯算法包，不依赖数据库。

## 下一步

- 暂不引入统一请求/响应拦截器；Phase 2 接入 NestJS API 后再封装 `apiClient`。
- 为 OCR 输出设计更严格的 AI schema。
- 为 Phase 2 准备 Auth、WrongQuestion、ChatMessage、OCRRecord API。
- Phase 2 恢复 TanStack Query，并将 Dexie 降级为离线缓存。
