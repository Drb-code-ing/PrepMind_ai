# PrepMind AI 学习与开发路线图

> 当前日期：2026-06-14。项目按 Phase 0 ~ Phase 10 顺序推进，当前 Phase 4.1 已完成，Phase 4 继续推进。

## 项目目标

PrepMind AI 的目标是做成移动端优先的 AI 学习产品，而不只是聊天 Demo。最终链路包括：

- AI 聊天与拍照识题。
- 错题本与间隔复习。
- RAG 知识库。
- LangGraph Agent。
- MCP 工具体系。
- 可观测性与生产化部署。

## 总体路线

| 阶段 | 主题 | 核心技术 | 状态 |
| --- | --- | --- | --- |
| Phase 0 | 架构设计 | Monorepo, Prisma, Docker | 已完成 |
| Phase 1 | 前端 MVP | Next.js, Dexie, AI SDK, OCR | 已完成 |
| Phase 2.1 | 后端基础与鉴权 | Bun, NestJS, Prisma, PostgreSQL, JWT | 已完成 |
| Phase 2.2 | 前端接入后端 Auth | apiClient, TanStack Query, AuthGuard 迁移 | 已完成 |
| Phase 2.3 | 业务 API 迁移 | REST API, server state, Dexie 离线缓存 | 已完成 |
| Phase 2.5 | 产品体验补全 | Chat-first UI, Auth UI, 个人中心, 今日任务, 视觉系统 | 已完成 |
| Phase 3 | AI 讲题系统 | OCR structured output, Prompt, 多题保存, Tool Action Boundary | 已完成 |
| Phase 4 | FSRS 记忆系统 | Card, ReviewLog, ReviewTask | 进行中，Phase 4.1 已完成 |
| Phase 5 | RAG 知识库 | pgvector, Embedding, Hybrid Search, Rerank | 规划中 |
| Phase 6 | 多 Agent 系统 | LangGraph, Router, Tutor, Planner, Memory | 规划中 |
| Phase 7 | 工程化增强 | BullMQ, EventBus, Swagger, Docker | 规划中 |
| Phase 8 | 高性能优化 | Web Worker, 虚拟列表, PWA, IndexedDB | 规划中 |
| Phase 9 | MCP Tool 体系 | JSON-RPC, Tool Registry, Tool Calling | 规划中 |
| Phase 10 | 生产级部署 | OpenTelemetry, Sentry, Prometheus, k6 | 规划中 |

## 已完成阶段

### Phase 0 — 架构设计

- 建立 monorepo 目录、基础 packages、Prisma schema 初稿和 Docker Compose 基础设施。

### Phase 1 — 前端 MVP

- 完成本地登录、AI 聊天、OCR、错题本、今日任务和 Dexie 本地持久化。
- 建立聊天与 OCR 统一时间线，支持 Markdown、GFM 和数学公式渲染。

### Phase 2.1 — 后端基础与鉴权

- 迁移到 Bun workspace。
- 落地 NestJS Config / Database / Health / Auth / Users 模块。
- Auth 支持注册、登录、`/auth/me`、refresh token rotation、logout。
- 接入 PostgreSQL、Prisma migration、统一响应 envelope、异常过滤器和 requestId。

### Phase 2.2 — 前端接入后端 Auth

- 封装 `apiClient`，接入 TanStack Query。
- 登录/注册、AuthGuard、session 恢复和登出改为调用 NestJS Auth API。
- Dexie 不再作为登录态权威来源，只保留业务离线缓存职责。

### Phase 2.3 — 业务 API 迁移

- WrongQuestion / ChatMessage / OCRRecord API 已迁移到 PostgreSQL。
- 新 OCR 图片通过 MinIO 保存服务端 URL。
- Dexie 降级为本地快速恢复、离线兜底、乐观更新和旧图片预览层。
- WrongQuestion / OCRRecord 写失败进入 Dexie mutationQueue，后续自动补偿同步。
- ChatMessage 使用 `/chat-messages/sync` 的会话快照幂等同步，不进入通用 mutation queue。
- `/api/chat` 加入上下文窗口；有效题目 OCR 生成 `activeStudyContext`，支持围绕当前题目继续追问。

### Phase 2.5 — 产品体验补全

- 保持 Chat-first 主入口，侧边栏作为导航层。
- 统一注册登录页、聊天页、错题本、今日任务和个人中心视觉系统。
- 补齐个人中心、本地学习偏好、今日任务轻学习手账和 CRUD 轻提示。
- 优化 Chat / OCR 渐进 Markdown 渲染和自动滚动交互。

### Phase 3 — AI 讲题系统

目标：把“OCR Markdown 结果 + 前端解析”升级为更稳定的题目结构化识别和可扩展讲题链路。

已完成：

- 新增 `@repo/types/api/ocr-question`，定义 OCR structured output schema。
- `/api/ocr` 改为 display Markdown + structured JSON envelope 输出协议。
- OCRRecord `parsedJson` 保存结构化结果，旧 OCR 历史继续通过 legacy adapter 兜底。
- `activeStudyContext` 从结构化题目生成，支持题目 id、题型、难度和识别提醒。
- 保存错题优先使用结构化字段；多题使用 `sourceGroupId:questionId` 独立防重。
- 前端增加多题卡片、单题保存和批量保存入口。
- `createWrongQuestion` / `searchKnowledge` / `createReviewTask` 已作为 tool action proposal 边界预留，暂不自动执行。

阶段验收：

- AI 输出结构稳定，前端不再依赖脆弱 Markdown 文本解析作为主要数据来源。
- 用户追问能承接 OCR 题目上下文。
- 非题目输入不会显示错题保存入口。
- 多题图片有明确拆题和保存策略。

## 后续阶段摘要

### Phase 4 — FSRS 记忆系统

Phase 4.1 已完成第一轮错题复习闭环：

- `@repo/fsrs` 已实现纯调度器。
- Prisma `Card` 支持 `wrongQuestionId`，`ReviewLog` 记录评分日志。
- NestJS 新增 Review API，支持错题加入复习、今日到期卡片和评分。
- 错题详情可加入复习计划，今日任务可查看答案并提交 Again / Hard / Good / Easy。

Phase 4 后续继续补齐：

- 复习历史与统计。
- 更完整的 ReviewTask 数据流。
- 离线评分队列与提醒策略。

### Phase 5 — RAG 知识库

- 文档上传、Chunk、Embedding。
- pgvector 检索、Hybrid Search、Rerank。

### Phase 6 — 多 Agent 系统

- RouterAgent、TutorAgent、ReviewAgent、PlannerAgent、MemoryAgent。

### Phase 7 — 工程化增强

- BullMQ、EventBus、Swagger / OpenAPI、后台任务。

### Phase 8 — 高性能优化

- Web Worker、虚拟列表、IndexedDB 离线策略、PWA 完整体验。

### Phase 9 — MCP Tool 体系

- Tool Registry、JSON-RPC、Search/OCR/FSRS/Plan/Memory tools。

### Phase 10 — 生产级部署

- OpenTelemetry、Sentry、Prometheus / Grafana、k6、CI/CD。
