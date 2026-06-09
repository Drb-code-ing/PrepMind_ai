# PrepMind AI 学习与开发路线图

> 当前日期：2026-06-09。按 Phase 0 ~ Phase 10 顺序推进。

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
| Phase 2.2 | 前端接入后端 Auth | apiClient, TanStack Query, AuthGuard 迁移 | 下一步 |
| Phase 2.3 | 错题/聊天/OCR API | REST API, server state, Dexie 离线缓存 | 规划中 |
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

目标：真正跑起来。当前是纯前端 MVP，不接入后端业务数据库。

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

## Phase 2.2 — 下一步

目标：前端登录体系从 localStorage 模拟迁移到 NestJS Auth API。

计划：

1. 封装 `apiClient`。
   - baseURL
   - `credentials: 'include'`
   - JSON envelope 解析
   - requestId 透传与错误提示
2. 接入 TanStack Query。
   - `useMe`
   - `useLogin`
   - `useRegister`
   - `useLogout`
3. 登录/注册页面调用后端 Auth API。
4. AuthGuard 改为以后端 `/auth/me` 为权威来源。
5. 处理 401：
   - 清理前端 session cache
   - 跳转登录页
   - 保留用户友好的提示
6. 保留 Phase 1 Dexie 数据，暂不迁移错题/聊天/OCR。

验收标准：

- 注册后 PostgreSQL 创建真实用户。
- 登录后后端设置 httpOnly refresh cookie。
- 刷新页面可通过 `/auth/me` 恢复登录态。
- 退出登录会调用 `/auth/logout` 并清理前端缓存。
- 前端 lint/build 通过。
- 后端 lint/build/unit/e2e 通过。

## Phase 2.3 — 规划中

目标：逐步把 Phase 1 本地业务数据迁移到服务端。

范围：

- WrongQuestion CRUD API。
- ChatMessage API。
- OCRRecord API。
- Dexie 降级为离线缓存和乐观更新层。
- TanStack Query 管理 server state。

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
