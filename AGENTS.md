# PrepMind AI — AI 智能备考助手

面向大厂 AI 应用方向的校招级项目。技术栈覆盖 Next.js + NestJS + LangGraph + MCP，目标是按 Phase 0 ~ Phase 10 逐步推进，产出完整的生产级 AI 应用。

**定位**：移动端优先的 Web + PWA 应用。学生主要用手机刷题、拍照识题和 AI 对话，交互体验要接近原生 App。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui, zustand, Dexie, PWA |
| Frontend Phase 2 | TanStack Query 管理 API server state |
| Backend | NestJS 11, Prisma, PostgreSQL, Redis, BullMQ |
| AI | Vercel AI SDK, OpenAI, DeepSeek, Gemini |
| Agent | LangGraph，不使用 AutoGen |
| RAG | pgvector, bge-m3, Hybrid Search, Rerank |
| MCP | Model Context Protocol, JSON-RPC |
| Infra | Docker, Sentry, OpenTelemetry, Prometheus, Grafana |

## 当前本机命令

当前仓库使用 Bun workspace。Windows 本机 pnpm store 仍可能有权限问题，开发验证优先使用 Bun。

| 命令 | 说明 |
| --- | --- |
| `bun install` | 安装 workspace 依赖 |
| `$env:POSTGRES_PORT='5433'; docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio` | 启动本地基础设施 |
| `bun --filter @repo/web dev` | 启动前端，默认 port 3000 |
| `bun --filter @repo/server start:dev` | 启动后端，默认 port 3001 |
| `bun --filter @repo/web lint` | 前端 lint |
| `bun --filter @repo/web build` | 前端构建 |
| `bun --filter @repo/server lint` | 后端 lint |
| `bun --filter @repo/server build` | 后端构建 |
| `bun --filter @repo/server test` | 后端单元测试 |
| `bun --filter @repo/server test:e2e` | 后端 e2e 测试，需要 Docker PostgreSQL 5433 正在运行 |
| `bun --cwd packages/database test` | database package 类型检查 |
| `bun --cwd packages/fsrs test` | fsrs package 类型检查 |

## 本地环境变量

- 根目录 `.env`：后端和 Prisma 使用，至少包含 `DATABASE_URL`、`JWT_SECRET`。
- `apps/server/.env`：当前 Bun/Nest e2e 在服务目录运行时会读取，保持和根 `.env` 一致。
- `apps/web/.env.local`：Next.js API Route 使用，包含 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`。
- 本机 Docker PostgreSQL 固定使用宿主机 `5433`，推荐：

```text
DATABASE_URL=postgresql://prepmind:devpass@127.0.0.1:5433/prepmind
```

这些 env 文件都被 git 忽略，不提交密钥。

## 模块依赖规则

```text
web -> server（HTTP 调用，不直接 import）
server -> database, ai, fsrs, rag, agent, mcp, types
agent -> ai, fsrs, rag, mcp, types
rag -> database, ai, types
fsrs -> types
ai -> types
mcp -> ai, fsrs, rag, types
```

- `packages/` 内模块禁止依赖 `apps/`。
- 同层 packages 禁止循环依赖。
- `types` 是所有模块的基础依赖。
- Agent 框架使用 LangGraph，不使用 AutoGen。

## 代码约定

- TypeScript strict 模式。
- Prettier：2 空格、单引号、分号、100 字符宽。
- 文件名 kebab-case，类名 PascalCase，变量 camelCase。
- 导入顺序：外部库 -> `@repo/*` -> 相对路径。
- NestJS 使用 Controller -> Service -> Repository。
- Zod 用于 DTO 验证和 API Schema。
- 高频 SQL 查询必须建索引。
- 移动端优先，用 `sm:`/`md:`/`lg:` 向上适配。
- 触摸目标最小 44x44px。
- PWA 页面要考虑离线静态访问和主屏幕添加体验。

## 当前进度

严格按照 `docs/roadmap.md` 的 Phase 0 ~ Phase 10 顺序推进。

### Phase 0 — 已完成

- Monorepo + 设计文档。
- Prisma Schema 初稿。
- Docker 基础设施配置。

### Phase 1 — MVP 已完成

- 登录/注册页面 UI + 正则校验。
- Phase 1 本地模拟登录与 AuthGuard。
- AI 聊天 + 流式输出。
- AI 回复 Markdown + GFM + 数学公式渲染。
- 拍照识题 + 图片上传 + OCR 流式输出。
- Dexie 本地持久化：`messages`、`ocrRecords`、`wrongQuestions`。
- OCR 与聊天统一时间线。
- 错题本 CRUD（本地版）。
- 今日任务（静态版本）。

### Phase 2.1 — 后端基础与鉴权已完成

- Bun workspace 迁移。
- Docker PostgreSQL + pgvector 固定本机端口 5433。
- Prisma Auth schema 与 migration。
- NestJS Config / Database / Health 模块。
- 统一响应 envelope、异常过滤器、requestId。
- AuthModule：注册、登录、`/auth/me`、refresh token 轮换、logout。
- UsersModule：当前用户资料读取与更新。
- 共享 `@repo/types/api/auth`、`@repo/types/api/common`。
- Auth 单元测试与 e2e 覆盖。

### Phase 2.2 — 前端接入后端 Auth 已完成

- 前端新增 `apiClient`，统一处理 response envelope、cookie、错误和 requestId。
- 恢复 TanStack Query，管理 Auth/User server state。
- 登录/注册页面已迁移到 NestJS Auth API。
- `AuthGuard` 改为以后端 session 为权威来源。
- 应用启动通过 `/auth/refresh` 恢复 session。
- 登出调用 `/auth/logout` 并清理前端 session cache。
- Dexie 仍作为离线业务数据缓存，不再作为登录态权威来源。

### Phase 2.3 — 业务 API 迁移已完成

- 后端已新增 WrongQuestion CRUD API，使用 Prisma/PostgreSQL 持久化。
- WrongQuestion API 已接入 `JwtAuthGuard`，所有读写按当前 `userId` 隔离。
- 已提供 `@repo/types/api/wrong-question` 共享 Zod schema 与请求/响应类型。
- 前端新增 `wrong-question-api` 与 TanStack Query hooks。
- 聊天页保存错题已改为先写服务端，再同步 Dexie 缓存。
- 错题本页面已从服务端读取、更新和删除错题，Dexie 作为离线缓存。
- 后端已新增 ChatMessage API，支持读取、批量同步和清空当前用户聊天历史。
- 前端聊天页启动时先读 Dexie 快速恢复，再以服务端聊天历史为权威来源同步。
- 后端已新增 OCRRecord API，支持读取、创建 upsert 和删除当前用户 OCR 历史。
- 前端聊天页 OCR 完成后先写入服务端 OCRRecord，再同步 Dexie 缓存。
- 后端已新增 Uploads API，`POST /uploads/images` 将登录用户图片写入 MinIO，`GET /uploads/images/users/...` 通过后端稳定 URL 读取图片。
- 前端 OCR 选择图片后会本地即时预览，同时并行上传到 MinIO；OCRRecord / WrongQuestion 优先保存服务端图片 URL。
- `/api/chat` 已加入上下文窗口，单次模型请求只注入裁剪后的近期聊天消息。
- OCR 有效题目会生成 `activeStudyContext`，后续追问会携带当前题目上下文。
- 非题目 OCR 不显示保存错题入口，也不套用题目分析框架。
- 已新增 Dexie `mutationQueue`，WrongQuestion / OCRRecord 写操作失败时进入本地补偿队列。
- WrongQuestion 创建、更新、删除支持乐观写入与失败暂存；session 恢复、online、focus 时自动尝试 flush。
- OCRRecord 创建失败时保留本地 OCR 历史并进入补偿队列。
- ChatMessage 不进入通用 CRUD mutation queue，继续使用 `/chat-messages/sync` 的会话快照幂等同步。
- 历史 base64 图片不自动静默迁移，仅作为当前设备旧数据预览兜底；新图片继续走 MinIO URL。

## 当前数据流摘要

- 前端登录态权威来源：NestJS Auth API + PostgreSQL refresh token + httpOnly cookie。
- 前端运行态保存 access token 和当前用户；刷新页面通过 refresh cookie 恢复。
- Refresh token 已启用 rotation；旧 RT 重放时会撤销同 family 的活跃 RT 并强制重新登录。
- Phase 2 Auth 主链路不依赖 Redis，refresh token 状态存放在 PostgreSQL。
- WrongQuestion 服务端 CRUD 已进入 PostgreSQL，API 路径为 `/wrong-questions`。
- 前端错题本已接入 `/wrong-questions`，Dexie 继续作为离线缓存。
- ChatMessage 服务端 API 已进入 PostgreSQL，API 路径为 `/chat-messages`。
- 聊天历史以服务端为权威来源，Dexie 继续作为本地缓存。
- `/chat-messages/sync` 要保持幂等；前端按消息快照去重，避免同一批聊天消息重复同步触发唯一约束错误。
- OCRRecord 服务端 API 已进入 PostgreSQL，API 路径为 `/ocr-records`。
- OCR 识别结果以服务端为权威来源，Dexie 继续作为本地缓存。
- WrongQuestion / OCRRecord 服务端同步成功后会按服务端列表替换当前用户 Dexie 缓存；Dexie 只补回旧数据、本地图片预览和尚未同步成功的本地 mutation 记录。
- WrongQuestion / OCRRecord 写操作失败时会写入 Dexie `mutationQueue`；本地记录使用 `syncStatus`、`syncError`、`pendingOperation` 标记同步状态。
- ChatMessage 不进入通用 CRUD mutation queue，继续使用 `/chat-messages/sync` 的会话快照幂等同步。
- 新 OCR 图片会先本地预览，再通过 NestJS `/uploads/images` 上传到 MinIO；OCRRecord 和 WrongQuestion 优先保存 `/uploads/images/users/...` 服务端 URL。
- `/ocr-records` 与 `/wrong-questions` 仍不接收 `data:` base64 图片，前端创建请求前会剥离本地 base64。
- Chat / OCR 流式输出阶段使用渐进 Markdown 渲染：稳定段落实时进入 Markdown / KaTeX，尾部未稳定内容保持轻量文本；展示格式化不回写 OCR 原始内容和 `activeStudyContext`。
- 聊天页自动滚动默认跟随最新输出；用户触摸、滚轮或指针操作内容区后暂停跟随，用户回到底部或开始新一轮生成时恢复。
- 今日任务仍主要保存在 Dexie。
- `/api/chat`、`/api/ocr` 仍由 Next.js API Route 代理外部 AI 服务。
- 前端生产构建不依赖 `next/font/google`，使用系统字体栈以适配受限网络环境。
- PostgreSQL 当前承载后端用户、refresh token、后续错题/聊天/OCR 等服务端数据模型。
- 详细数据流见 `docs/data-flow.md`。

## 当前注意事项

- 本机 PostgreSQL 使用 Docker 的 `5433 -> 5432` 映射，避免与 Windows 本地 PostgreSQL 服务冲突。
- 后端开发环境 CORS 会允许 `localhost`、`127.0.0.1` 和私有局域网地址的动态端口，方便 Next.js 自动切换端口和手机真机测试。
- PostgreSQL 必须启用 pgvector：`CREATE EXTENSION IF NOT EXISTS vector;`。
- `packages/fsrs` 保持纯算法包，不依赖数据库。
- 异步任务后续用 BullMQ：OCR、Embedding、PDF 解析都走队列。
- 向量索引用 raw SQL 创建，Prisma 不直接支持向量索引。
- MCP 工具注册中心规划在 `packages/mcp/src/registry.ts`。

## 下一步

Phase 3 最优先：

- OCR structured output schema。
- AI 讲题 prompt 与 tool calling 设计。
- createWrongQuestion / searchKnowledge / createReviewTask 工具规划。
