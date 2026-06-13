# PrepMind AI — 协作上下文

本文件给 Claude/Codex 提供仓库上下文。内容与 `AGENTS.md` 保持一致；如果两者冲突，以当前任务的最新用户要求为准。

## 项目定位

PrepMind AI 是移动端优先的 Web + PWA 智能备考助手。项目按 Phase 0 ~ Phase 10 推进，目标覆盖完整 AI 应用工程链路：Next.js、NestJS、Prisma、PostgreSQL、Redis、LangGraph、RAG、FSRS、MCP 与生产观测。

## 当前阶段

- Phase 0：已完成。
- Phase 1：前端 MVP 已完成。
- Phase 2.1：后端基础与 Auth/User API 已完成。
- Phase 2.2：前端 Auth 已接入后端，已完成。
- Phase 2.3：业务 API 迁移已完成，WrongQuestion、ChatMessage、OCRRecord、新图片上传链路与 Dexie mutationQueue 已接入。
- Phase 2.5：产品体验补全已完成，Chat-first 视觉系统、注册/登录页、个人中心、今日任务手账、错题本与聊天页交互已打磨。
- 下一步：Phase 3 OCR structured output schema、AI 讲题 prompt 与 tool calling 设计。

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
开发环境 CORS 允许 `localhost`、`127.0.0.1` 和私有局域网地址的动态端口，Next.js 自动切到 `3002` 等端口时不需要额外改后端配置。

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
- `/wrong-questions` 已提供错题 CRUD，使用 PostgreSQL 持久化并按当前用户隔离。
- 前端错题本页面已接入服务端 API，Dexie 作为离线缓存。
- `/chat-messages` 已提供聊天历史读取、同步和清空；聊天历史以服务端为权威来源，Dexie 作为本地缓存。
- `/chat-messages/sync` 要保持幂等；前端按消息快照去重，避免同一批聊天消息重复同步触发唯一约束错误。
- `/ocr-records` 已提供 OCR 历史读取、创建 upsert 和删除；OCR 识别结果以服务端为权威来源，Dexie 作为本地缓存。
- WrongQuestion / OCRRecord 服务端同步成功后会按服务端列表替换当前用户 Dexie 缓存；Dexie 只补回旧数据、本地图片预览和尚未同步成功的本地 mutation 记录。
- WrongQuestion / OCRRecord 写操作失败时会写入 Dexie `mutationQueue`；本地记录使用 `syncStatus`、`syncError`、`pendingOperation` 标记同步状态。
- ChatMessage 不进入通用 CRUD mutation queue，继续使用 `/chat-messages/sync` 的会话快照幂等同步。
- 新 OCR 图片会先本地预览，再通过 NestJS `/uploads/images` 上传到 MinIO；OCRRecord 和 WrongQuestion 优先保存 `/uploads/images/users/...` 服务端 URL。
- `/ocr-records` 与 `/wrong-questions` 仍不接收 `data:` base64 图片，前端创建请求前会剥离本地 base64。
- `/api/chat` 已加入上下文窗口，单次模型请求只注入裁剪后的近期聊天消息。
- 有效题目 OCR 会生成 `activeStudyContext`，后续追问会携带当前题目上下文。
- Chat / OCR 流式输出阶段使用渐进 Markdown 渲染：稳定段落实时进入 Markdown / KaTeX，尾部未稳定内容保持轻量文本；展示格式化不回写 OCR 原始内容和 `activeStudyContext`。
- 聊天页自动滚动默认跟随最新输出；用户触摸、滚轮或指针操作内容区后暂停跟随，用户回到底部或开始新一轮生成时恢复。
- 非题目 OCR 不显示保存错题入口，也不套用题目分析框架。
- 今日任务使用 `localStorage prepmind-today:{userId}:{date}` 保存当日完成状态。
- 学习偏好使用 `localStorage prepmind-preferences:{userId}` 保存，当前不进入 Dexie mutationQueue，也不注入 `/api/chat` prompt。
- Phase 2.5 视觉更新不改变 Auth、Chat、OCR、WrongQuestion 的服务端权威来源和同步边界。
- `/api/chat` 与 `/api/ocr` 仍由 Next.js API Route 代理外部 AI 服务。
- 前端生产构建不依赖 `next/font/google`，使用系统字体栈以适配受限网络环境。

## 下一步重点

Phase 3：

- OCR structured output schema。
- AI 讲题 prompt 与 tool calling 设计。
- createWrongQuestion / searchKnowledge / createReviewTask 工具规划。
