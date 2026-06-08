# PrepMind AI — 学习与开发规划

> 3~6 个月 · 大厂 AI 应用方向 · 顶级校招项目标准

---

## 项目概述

**目标不是**：做一个 AI 备考助手。

**而是**：做一个真正能达到字节、腾讯、阿里、DeepSeek、MiniMax 等公司 AI 应用方向简历级项目。

---

## 整体路线图

| 阶段 | 主题 | 周期 | 核心技术 |
|------|------|------|---------|
| Phase 0 | 架构设计 | 1 周 | Monorepo · DDD · ER 图 · API 设计 |
| Phase 1 | MVP | 2 周 | Next15 · React19 · AI SDK · 流式输出 |
| Phase 2 | 后端工程化 | 2 周 | NestJS · Prisma · PostgreSQL · Redis |
| Phase 3 | AI 讲题系统 | 2 周 | OCR · Prompt · Structured Output · Tool Calling |
| Phase 4 | FSRS 记忆系统 | 1 周 | 间隔重复 · Card · Review · 今日复习 |
| Phase 5 | RAG 知识库 | 2 周 | pgvector · Embedding · Hybrid Search · Rerank |
| Phase 6 | 多 Agent 系统 | 2 周 | LangGraph · Router · Tutor · Planner · Memory |
| Phase 7 | 工程化 | 2 周 | BullMQ · EventBus · Swagger · Docker |
| Phase 8 | 高性能优化 | 1 周 | Web Worker · 虚拟列表 · PWA · IndexedDB |
| Phase 9 | MCP Tool 体系 | 2 周 | Search · OCR · FSRS · Plan · Memory |
| Phase 10 | 生产级部署 | 2 周 | OpenTelemetry · Sentry · Prometheus · k6 |

**最终技术栈全景**：PrepMind AI + RAG + FSRS + Agent + MCP

---

## Phase 0：系统设计（1 周）

> 这是很多人会跳过的一步。但实际上：大厂项目 ≠ 写代码，而是先设计。

### 学习目标

- Monorepo
- pnpm workspace
- DDD 思想
- 模块划分
- ER 图设计
- OpenAPI
- 项目结构

### 项目结构

```
prepmind / apps / web / server / packages / ui / types / database / ai / fsrs / rag / agent / mcp / infra / docker / docs
```

### 输出成果

- 数据库 ER 图
- API 设计
- 模块关系图
- Prompt 体系设计
- Agent 设计图
- 技术选型文档

---

## Phase 1：MVP — 最小可行产品（2 周）

> 目标：真正跑起来。
> 状态：已完成（2026-06-08）。当前实现为纯前端 MVP，本地数据使用 localStorage + Dexie。

### 技术栈

- Next 15
- React 19
- TypeScript
- Tailwind 4
- shadcn/ui
- zustand
- tanstack-query
- Vercel AI SDK

### 功能

- 登录（Github OAuth）
- AI 聊天
- 流式输出（SSE）
- 拍照识题
- 图片上传
- 错题本 CRUD
- 今日任务（静态版本）

### 学习要点

- App Router
- Suspense
- Server Component
- Streaming
- useTransition

> 达到：**普通校招项目**

---

## Phase 2：后端工程化（2 周）

### 引入技术

- NestJS
- Prisma
- PostgreSQL
- Redis

### NestJS 核心概念

- Controller
- Service
- Module
- Guard
- Pipe
- Interceptor
- ExceptionFilter

### 用户系统

- JWT
- access token / refresh token
- RBAC（student / admin）

### 数据库模型

- User
- Question
- WrongQuestion
- KnowledgePoint
- ReviewTask
- StudyPlan

> 达到：**中厂项目水平**

---

## Phase 3：AI 讲题系统（2 周）

> 开始进入 AI 核心。

### OCR

支持：图片、PDF、截图

### Structured Output

```json
{ "knowledgePoints": [], "analysis": "", "mistakes": [] }
```

### Prompt 工程

- `prompt/teacher.md`
- `prompt/socratic.md`
- `prompt/planner.md`

### Tool Calling

- createWrongQuestion
- searchKnowledge
- createReviewTask

### 学习要点

- Function Calling
- Schema
- Zod

> 达到：**AI 应用项目**

---

## Phase 4：FSRS 记忆系统（1 周）

> 这是隐藏大杀器。很多项目没有。

### 数据模型

- **Card**（difficulty / stability / retrievability）
- **ReviewLog**
- **ReviewTask**

### 评分系统

- Again
- Hard
- Good
- Easy

→ 今日复习任务

### 学习要点

- SM2 算法
- FSRS
- 间隔重复算法

> 达到：**有壁垒的项目**

---

## Phase 5：RAG 知识库（2 周）

> 真正进入大厂 AI 应用领域。

### 支持上传格式

PDF · PPT · DOCX · Markdown

### RAG 流程

```
Upload → Chunk → Embedding → pgvector → Hybrid Search → Rerank → LLM
```

### 核心技术

- bge-m3
- pgvector
- chunk 策略
- metadata
- rerank
- cache

### 新增数据库模型

- Document
- Chunk
- Embedding

> 达到：**DeepSeek AI 应用味道**

---

## Phase 6：多 Agent 系统（2 周）

> 推荐 LangGraph，不要 AutoGen。

### Agent 架构

```
User → Router → Planner → Tutor / Review → Memory → Response
```

### Agent 清单

- **RouterAgent** — 决定调用谁
- **TutorAgent** — 讲题（苏格拉底模式）
- **ReviewAgent** — 分析错题
- **PlannerAgent** — 制定学习计划
- **MemoryAgent** — 长期记忆

### LangGraph 核心概念

- StateGraph
- Checkpoint
- Memory
- Human-in-loop

> 达到：**高级 AI 应用**

---

## Phase 7：工程化（2 周）

> 这是大厂最爱问的。

### 异步任务队列

- BullMQ
- OCR 异步
- Embedding 异步
- PDF 解析异步

### 缓存与事件

- Redis 缓存
- EventBus
- 事件驱动

```
例：question.created → embedding worker → review worker
```

### API 规范

- OpenAPI
- Swagger
- DTO
- class-validator
- zod

### 容器化

- Docker
- docker-compose

启动：web · server · postgres · redis · minio

> 达到：**大厂项目**

---

## Phase 8：高性能优化（1 周）

> 很多简历喜欢写，真正做的人很少。

### 前端性能

- Web Worker（OCR / FSRS / Embedding）
- React.lazy
- Suspense
- 虚拟列表
- react-virtual

### 加载策略

- 图片懒加载
- 无限滚动

### 离线能力

- IndexedDB 离线缓存
- PWA

> 达到：**前端高级能力**

---

## Phase 9：MCP Tool 体系（2 周）

> 这是 2026 最亮眼部分。

### MCP 工具清单

- **SearchTool** — 知识库搜索
- **OCRTool** — 识题
- **FSRSTool** — 安排复习
- **PlanTool** — 生成计划
- **MemoryTool** — 长期记忆
- **QuestionTool** — 管理错题

### 协议与架构

Agent 通过 MCP 调用工具

- Model Context Protocol
- Tool Registry
- JSON-RPC

> 达到：**DeepSeek / MiniMax 风格项目**

---

## Phase 10：可观测性 + 生产级部署（2 周）

> 最后一步：把项目变成生产级系统。

### 日志与监控

- Pino 日志
- Sentry 错误监控

### 可观测性

- OpenTelemetry 链路追踪
- Prometheus Metrics
- Grafana Dashboard

### CI/CD 与部署

- Github Action
- Docker
- Vercel
- Railway

### 压测

- k6 性能测试

> 达到：**生产级项目**

---

## 最终技术栈全览

| 层级 | 技术 |
|------|------|
| **Frontend** | Next 15 · React 19 · TypeScript · Tailwind 4 · shadcn/ui · zustand · tanstack-query |
| **Backend** | NestJS · Prisma · PostgreSQL · Redis · BullMQ · MinIO |
| **AI** | Vercel AI SDK · OpenAI · DeepSeek · Gemini · LangGraph · MCP |
| **RAG** | pgvector · bge-m3 · rerank · Hybrid Search |
| **Infra** | Docker · GitHub Action · Sentry · OpenTelemetry · Prometheus · Grafana |

---

## 结语

如果目标是字节、腾讯、阿里、米哈游、DeepSeek、MiniMax、月之暗面、百度 AI、智谱、阶跃星辰，那么这个项目完全值得按照 6 个月、Phase 0 ~ Phase 10 来打磨。

### 下一步

像大厂做项目一样，先产出完整的架构设计文档（ER 图、Prisma Schema、Nest 模块划分、LangGraph 流程图、MCP 工具树、事件总线设计、目录结构），再开始写代码。

这一阶段会非常接近真实企业开发流程。
