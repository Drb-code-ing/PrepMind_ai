# PrepMind AI — 协作上下文

本文件给 Claude/Codex 提供仓库快速上下文。详细规则以 `AGENTS.md` 为准，阶段规划看 `docs/roadmap.md`，数据流看 `docs/data-flow.md`。

## 当前阶段

PrepMind AI 是移动端优先的 Web + PWA 智能备考助手。当前 Phase 4.5.1 已完成，Phase 4.5 继续推进。

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

下一步 Phase 4 后续：

1. Phase 4.5.2：复习提醒策略与更长期计划设置。
2. Phase 5：RAG 知识库与 pgvector 检索。

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

- Auth：NestJS Auth API + PostgreSQL refresh token + httpOnly cookie；refresh token 已启用 rotation 与 reuse detection。
- WrongQuestion：`/wrong-questions` 是服务端权威来源，Dexie 作为离线缓存和乐观更新层。
- ChatMessage：`/chat-messages` 持久化聊天历史；`/chat-messages/sync` 使用会话快照幂等同步，不进入通用 mutation queue。
- OCRRecord：`/ocr-records` 持久化 OCR 历史；有效题目 OCR 会生成 `activeStudyContext` 供后续追问承接。
- Review：`/reviews` 已支持错题加入复习、学习统计和最近复习日志；`/review-tasks` 已支持今日复习任务、评分完成、跳过、恢复和未来复习计划预览；Card / ReviewLog / ReviewTask 以 PostgreSQL 为权威来源。
- Plan：`/review-tasks/plan` 只读预览未来复习压力，基于 `Card.nextReview` 计算，不创建未来 `ReviewTask`。
- Stats：`/stats` 使用客户端 ECharts 展示趋势、评分分布和卡片状态。
- ReviewTask rating：评分请求带 `clientMutationId`，服务端用 `ReviewLog.clientMutationId` 做幂等，重复提交同一命令不重复写日志。
- Upload：新 OCR 图片通过 `/uploads/images` 上传 MinIO，业务 API 不接收 `data:` base64 图片。
- Offline：WrongQuestion / OCRRecord / ReviewTask rating 写失败进入 Dexie `mutationQueue`，session 恢复、online、focus 时自动 flush。
- Today：离线评分只展示本地待同步状态，不本地推进 FSRS、ReviewLog 或统计；同步成功后刷新今日复习和统计。
- AI：`/api/chat` 与 `/api/ocr` 仍由 Next.js API Route 代理外部 AI 服务。
- UI：Chat / OCR 流式输出使用渐进 Markdown 渲染，自动滚动遵循用户滚动意图。

## 文档入口

- `docs/roadmap.md`：阶段路线。
- `docs/data-flow.md`：当前数据流。
- `docs/dev-start.md`：本地启动。
- `DEVLOG.md`：按日期记录开发日志，待办统一放文末。
