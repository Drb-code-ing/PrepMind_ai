# PrepMind AI — 开发日志

按日期记录每天做了什么，方便回顾进度。

---

## 2026-06-05（Day 1）

### 今天完成了

**项目规划**
- 整理了 AI 智能备考助手的学习与开发规划文档（Phase 0~10，共 11 个阶段）
- 从 DeepSeek 导出了完整的架构设计文档（10 章节：系统架构、Monorepo、数据库、API、Agent、MCP 等）
- 两份文档都转成了 Markdown 格式放在 `docs/` 目录

**项目初始化**
- 初始化了 Git 仓库
- 搭建了 npm workspaces 的 Monorepo 结构
- 创建了 Next.js 16 前端应用（`apps/web`）
- 创建了 NestJS 11 后端服务（`apps/server`）
- 创建了 8 个 workspace 包骨架：
  - `@repo/types` — 共享类型 + Zod schemas
  - `@repo/database` — Prisma + 数据访问
  - `@repo/ai` — LLM 调用封装
  - `@repo/fsrs` — FSRS 间隔重复算法
  - `@repo/rag` — RAG 核心
  - `@repo/agent` — LangGraph Agent
  - `@repo/mcp` — MCP 工具注册
  - `@repo/ui` — 共享 React 组件
- 完成了 Prisma Schema 设计（12 个 model：User, Account, Session, Question, WrongQuestion, Card, ReviewLog, Document, Chunk, ChatMessage 等）
- 配置了 Docker Compose（PostgreSQL+pgvector, Redis, MinIO）
- 编写了 CLAUDE.md 项目指引

**验证**
- `npm install` 成功（1031 个包）
- NestJS 类型检查通过
- Next.js 编译通过
- 首次 Git 提交完成（96 files, 18,163 insertions）

### 踩的坑
- pnpm 有 SQLite 错误，换成了 npm workspaces
- `create-next-app` 会自动生成 `pnpm-workspace.yaml`，和根目录冲突，需要删除
- `nest new` 安装依赖也会失败，需要从根目录统一安装

### 明天计划
- 启动 PostgreSQL（Docker），运行 Prisma 首次迁移
- 搭建 NestJS 基础 API 网关 + Swagger
- 实现 JWT 认证模块
