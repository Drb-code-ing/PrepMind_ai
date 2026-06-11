# PrepMind AI 学习与开发路线图

> 当前日期：2026-06-12。按 Phase 0 ~ Phase 10 顺序推进。

## 项目目标

PrepMind AI 不是简单聊天应用，而是面向 AI 应用工程岗位的完整校招级项目。最终形态覆盖：

- 移动端优先 Web + PWA
- AI 聊天与拍照识题
- 错题本与间隔复习
- RAG 知识库
- LangGraph Agent
- MCP 工具体系
- 可观测性与生产化部署

## 总体路线

| 阶段 | 主题 | 核心技术 | 状态 |
| --- | --- | --- | --- |
| Phase 0 | 架构设计 | Monorepo, Prisma, Docker | 已完成 |
| Phase 1 | 前端 MVP | Next.js, Dexie, AI SDK, OCR | 已完成 |
| Phase 2.1 | 后端基础与鉴权 | Bun, NestJS, Prisma, PostgreSQL, JWT | 已完成 |
| Phase 2.2 | 前端接入后端 Auth | apiClient, TanStack Query, AuthGuard 迁移 | 已完成 |
| Phase 2.3 | 错题/聊天/OCR API | REST API, server state, Dexie 离线缓存 | 进行中 |
| Phase 3 | AI 讲题系统 | OCR, Structured Output, Tool Calling | 规划中 |
| Phase 4 | FSRS 记忆系统 | Card, ReviewLog, ReviewTask | 规划中 |
| Phase 5 | RAG 知识库 | pgvector, Embedding, Hybrid Search, Rerank | 规划中 |
| Phase 6 | 多 Agent 系统 | LangGraph, Router, Tutor, Planner, Memory | 规划中 |
| Phase 7 | 工程化增强 | BullMQ, EventBus, Swagger, Docker | 规划中 |
| Phase 8 | 高性能优化 | Web Worker, 虚拟列表, PWA, IndexedDB | 规划中 |
| Phase 9 | MCP Tool 体系 | JSON-RPC, Tool Registry, Tool Calling | 规划中 |
| Phase 10 | 生产级部署 | OpenTelemetry, Sentry, Prometheus, k6 | 规划中 |

## Phase 0 — 已完成

- Monorepo 结构。
- 基础架构文档。
- Prisma schema 初稿。
- Docker Compose 基础设施。

## Phase 1 — 已完成

目标：真正跑起来。该阶段是纯前端 MVP，不接入后端业务数据库。

- 登录/注册 UI 与本地模拟账号。
- AuthGuard 登录守卫。
- AI 聊天与流式输出。
- Markdown / GFM / 数学公式渲染。
- 拍照识题与 OCR 流式输出。
- Dexie 本地持久化：聊天、OCR、错题本。
- 错题本 CRUD。
- 今日任务静态版。
- 本地账号级数据隔离。

## Phase 2.1 — 已完成

目标：建立后端工程基础和可独立验证的 Auth API。

- Bun workspace 迁移。
- Docker PostgreSQL + pgvector 本机 5433 固定端口。
- Prisma Auth schema 与 migration。
- NestJS ConfigModule、DatabaseModule、HealthModule。
- 统一响应 envelope。
- 全局异常过滤器。
- requestId middleware。
- AuthModule：
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me`
  - `POST /auth/refresh`
  - `POST /auth/logout`
- Refresh token httpOnly cookie 与服务端哈希存储。
- UsersModule：
  - `GET /users/me`
  - `PATCH /users/me`
- 共享 API schemas：
  - `@repo/types/api/auth`
  - `@repo/types/api/common`
- Auth 单元测试与 e2e 覆盖。
- 本地启动文档：`docs/dev-start.md`。

## Phase 2.2 — 已完成

目标：前端登录体系从 localStorage 模拟迁移到 NestJS Auth API。

- 封装 `apiClient`：
  - baseURL
  - `credentials: 'include'`
  - JSON envelope 解析
  - 结构化错误与 requestId
- 接入 TanStack Query：
  - `useMe`
  - `useLogin`
  - `useRegister`
  - `useLogout`
  - `useRefreshSession`
- 登录/注册页面调用后端 Auth API。
- AuthGuard 改为以后端 session 为权威来源。
- 应用启动时通过 `/auth/refresh` 恢复 session。
- 登出调用 `/auth/logout` 并清理前端 session cache。
- 手机号验证码登录暂未开放，页面明确提示使用邮箱登录。
- 保留 Phase 1 Dexie 业务数据，暂不迁移错题/聊天/OCR。

验收结果：

- 注册后 PostgreSQL 创建真实用户。
- 登录后后端设置 httpOnly refresh cookie。
- 刷新页面可通过 refresh cookie 恢复登录态。
- 退出登录调用后端 logout 并清理前端状态。
- 前端 lint/build 通过。
- 后端 lint/build/unit/e2e 通过。

## Phase 2.3 — 进行中

目标：逐步把 Phase 1 本地业务数据迁移到服务端。

范围：

- WrongQuestion CRUD API（后端与前端接入已完成）。
- ChatMessage API（后端与前端接入已完成）。
- OCRRecord API。
- Dexie 降级为离线缓存和乐观更新层。
- 图片从 base64 迁移到 MinIO/OSS URL。
- TanStack Query 管理业务 server state。

当前已完成：

- 新增 `@repo/types/api/wrong-question`。
- 新增后端 `/wrong-questions` CRUD API。
- 接入 JWT 鉴权、用户级数据隔离、`sourceGroupId` 防重复。
- 新增前端 `wrong-question-api` 与 TanStack Query hooks。
- 聊天页保存错题已写入服务端并同步 Dexie 缓存。
- 错题本页面已从服务端读取、更新和删除错题。
- 新增 WrongQuestion service 单测与 e2e 测试。
- 新增 `@repo/types/api/chat-message`。
- 新增后端 `/chat-messages` API：
  - `GET /chat-messages`
  - `POST /chat-messages/sync`
  - `DELETE /chat-messages`
- 聊天页启动后从服务端恢复消息；服务端无记录但 Dexie 有旧消息时，首次同步会迁移本地历史。
- 聊天消息继续由 `/api/chat` 代理外部 AI SSE，完成后批量同步到 NestJS ChatMessage API。
- 新增 ChatMessage service 单测与 e2e 测试。
- 新增聊天上下文窗口，单次模型请求只注入裁剪后的近期消息，完整历史仍保存在 Dexie / PostgreSQL。
- OCR 有效题目会生成 `activeStudyContext`，后续追问可承接当前题目上下文。
- 非题目 OCR 不显示保存错题入口，也不套用题目分析框架。
- OCR 流式输出期间支持停止输出，并限制继续发送新消息。
- 优化数学公式和紧凑步骤文本渲染，提高聊天与讲题内容可读性。

下一步优先级：

1. OCRRecord API。
2. 图片从 base64 迁移到 MinIO/OSS URL。
3. Dexie 离线 mutation 队列与乐观更新层。
4. Phase 3 OCR structured output schema 与 tool calling 设计。

## 后续阶段摘要

### Phase 3 — AI 讲题系统

- OCR structured output。
- 题目字段 schema。
- Tool Calling：创建错题、检索知识点、创建复习任务。

### Phase 4 — FSRS 记忆系统

- Card / ReviewLog / ReviewTask。
- Again / Hard / Good / Easy 评分。
- 今日复习任务。

### Phase 5 — RAG 知识库

- 文档上传。
- Chunk。
- Embedding。
- pgvector。
- Hybrid Search + Rerank。

### Phase 6 — 多 Agent 系统

- RouterAgent。
- TutorAgent。
- ReviewAgent。
- PlannerAgent。
- MemoryAgent。

### Phase 7 — 工程化增强

- BullMQ。
- EventBus。
- Swagger / OpenAPI。
- 后台任务。

### Phase 8 — 高性能优化

- Web Worker。
- 虚拟列表。
- IndexedDB 离线策略。
- PWA 完整体验。

### Phase 9 — MCP Tool 体系

- Tool Registry。
- JSON-RPC。
- Search/OCR/FSRS/Plan/Memory tools。

### Phase 10 — 生产级部署

- OpenTelemetry。
- Sentry。
- Prometheus / Grafana。
- k6 压测。
- CI/CD。
