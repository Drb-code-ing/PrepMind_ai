# PrepMind AI — AI 智能备考助手

面向大厂 AI 应用方向的校招级项目。技术栈覆盖 Next.js + NestJS + LangGraph + MCP，
目标是 3~6 个月完成 Phase 0~10，产出一个完整的生产级 AI 应用。

## 技术栈

| 层级     | 技术                                                              |
| -------- | ----------------------------------------------------------------- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui, zustand  |
| Backend  | NestJS 11, Prisma, PostgreSQL, Redis, BullMQ                      |
| AI       | Vercel AI SDK, OpenAI, DeepSeek, Gemini                           |
| Agent    | LangGraph（不要 AutoGen）                                         |
| RAG      | pgvector, bge-m3, Hybrid Search, Rerank                           |
| MCP      | Model Context Protocol, JSON-RPC                                  |
| Infra    | Docker, Sentry, OpenTelemetry, Prometheus, Grafana                |

## 命令

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装所有 workspace 依赖 |
| `pnpm dev` | 启动前端 (port 3000) |
| `pnpm dev:server` | 启动后端 (port 3001) |
| `pnpm build` | 构建全部 |
| `pnpm db:migrate` | 运行数据库迁移 |
| `pnpm db:studio` | 打开 Prisma Studio |
| `pnpm db:generate` | 生成 Prisma Client |
| `pnpm docker:up` | 启动基础设施（PG/Redis/MinIO） |
| `pnpm lint` | 代码检查 |
| `pnpm test` | 运行全部测试 |

## 目录结构

```
prepmind/
├── apps/
│   ├── web/                    # Next.js 前端（App Router, src/ 目录）→ @repo/web
│   └── server/                 # NestJS 后端服务 → @repo/server
├── packages/
│   ├── types/                  # 共享 TypeScript 类型 + Zod schemas → @repo/types
│   ├── database/               # Prisma schema + 数据访问 → @repo/database
│   ├── ai/                     # LLM 调用封装 → @repo/ai
│   ├── fsrs/                   # FSRS 间隔重复算法核心 → @repo/fsrs
│   ├── rag/                    # RAG 核心 → @repo/rag
│   ├── agent/                  # LangGraph Agent → @repo/agent
│   ├── mcp/                    # MCP 工具注册 + JSON-RPC → @repo/mcp
│   └── ui/                     # 共享 React 组件 → @repo/ui
├── docker/                     # Dockerfile + docker-compose
├── infra/                      # k6 压测 / Grafana / Prometheus
└── docs/                       # 设计文档
```

## 模块依赖规则（铁律）

```
web → server（HTTP 调用，不直接 import）
server → database, ai, fsrs, rag, agent, mcp, types
agent → ai, fsrs, rag, mcp, types
rag → database, ai, types
fsrs → database, types
ai → types
mcp → ai, fsrs, rag, types
```

- **packages/ 内模块禁止依赖 apps/**
- **同层 packages 无循环依赖**
- **types 是所有模块的基础依赖**

## 代码约定

- **语言**：TypeScript strict 模式
- **格式化**：Prettier（2 空格，单引号，分号，100 字符宽）
- **命名**：文件名 kebab-case，类名 PascalCase，变量 camelCase
- **导入顺序**：外部库 → @repo/* → 相对路径
- **NestJS 模式**：Controller → Service → Repository
- **Zod 用于**：DTO 验证 + API Schema
- **SQL 索引**：高频查询必须建索引，Prisma `@@index` 或 raw SQL

## 开发路线

严格按照 `docs/roadmap.md` 的 Phase 0 ~ Phase 10 顺序推进。

### 当前进度：Phase 1 — MVP（2 周）

> 目标：真正跑起来。纯前端 MVP，不涉及数据库。

**Phase 0 已完成** ✅（Monorepo + 设计文档）

**Phase 1 待完成**
- [ ] 实现登录（Github OAuth）
- [ ] 实现 AI 聊天 + 流式输出（SSE）
- [ ] 拍照识题 + 图片上传
- [ ] 错题本 CRUD
- [ ] 今日任务（静态版本）

## 注意事项

- **pnpm 工作正常**：使用 pnpm 9.x，store 在 `C:/Users/Lenovo/AppData/Local/pnpm-store-fresh`
- **npmrc 已配置 npmmirror 镜像**加速下载
- **PostgreSQL 必须启用 pgvector 扩展**：`CREATE EXTENSION IF NOT EXISTS vector;`
- **Agent 框架用 LangGraph，不要用 AutoGen**
- **异步任务用 BullMQ**：OCR、Embedding、PDF 解析都走队列
- **向量索引单独建**：Prisma 不支持向量类型，用 raw SQL 创建 ivfflat 索引
- **MCP 工具注册中心**在 `packages/mcp/src/registry.ts`
- **SSE 流式输出**用 Next.js API Route 代理到 NestJS
- **fsrs 包是纯算法**：不依赖数据库，方便测试

## 设计文档

- `docs/architecture.md` — 完整系统架构 + 目录树 + 数据库 Schema + API + Agent + MCP + 部署
- `docs/roadmap.md` — Phase 0~10 学习路线规划
- `docs/*.docx` — 原始 Word 版文档（桌面也有副本）
