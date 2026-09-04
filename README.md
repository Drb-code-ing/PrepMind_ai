# PrepMind AI

PrepMind AI 是一个移动端优先的智能备考助手，把拍照识题、AI 讲题、知识库检索、错题整理和间隔复习串成一个学习闭环。
这是一个持续演进的 Bun + Next.js + NestJS AI 应用工程项目，不是把模型调用包在页面上的一次性 Demo。

## 项目亮点

- **从题目到复习闭环**：OCR 识题、结构化题目上下文、错题本、FSRS 复习、今日任务和计划统计。
- **可控的 AI 编排**：Router、Tutor、Retriever、Verifier、FinalResponse、Review/Planner 和 Knowledge agents 都有明确的
  输入投影、权限边界、预算、超时与降级策略。
- **Hybrid RAG**：使用 Qwen `text-embedding-v4` 生成 1536 维向量，同时召回 pgvector 相似度和 PostgreSQL full-text
  关键词结果，再按 `chunkId` 去重融合排序。
- **可靠后台任务**：BackgroundJob、Durable Outbox、BullMQ、Worker readiness/observability 和 Admin 审计工具形成可追踪的
  异步处理基础。
- **安全优先的真实模型路径**：默认 Mock；真实模型必须经过全局开关、组件 gate、owner/auth、预算、超时和结构化 schema 校验。

## 当前状态

更新时间：2026-09-05。完整矩阵见 [`docs/project-status.md`](docs/project-status.md) 和
[`Phase 6 Agent 运行时审计`](docs/acceptance/phase-6-agent-runtime-audit.md)。

| 范围                    | 当前结论                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0-5               | 产品基础、鉴权、OCR、错题/复习、RAG 和主要页面已实现，并有对应阶段验收                                                                          |
| Phase 6 Agent           | 合同和多个受限 candidate 已实现；总审计仍在进行，不能把所有 Agent 说成真实模型已完成                                                            |
| Phase 7 工程化          | BackgroundJob、Outbox、Worker、Readiness、Admin/Audit 等核心子阶段已完成；Chat Stream bounded replay 已实现，Worker 仍是 deterministic baseline |
| `/api/chat`             | 默认关闭的 bridge 已接 durable prepare/enqueue/`202` handoff；浏览器 SSE/replay 和真实模型 Worker 仍待完成                                      |
| 分层记忆                | MemoryAgent 当前生成确定性候选；瞬时/短期/长期统一实现尚未开始                                                                                  |
| Tool-Using Orchestrator | 尚未实现，不能列入已完成能力                                                                                                                    |

状态术语严格区分：

- `implemented`：源码和静态/单元合同存在。
- `mock/static validated`：reviewed Mock 或确定性回归通过，不代表 Provider 质量。
- `controlled-Live`：绑定独立 source/tag/授权的一次性真实 Provider 运行，成功或失败都必须封存。
- `product real-model smoke`：指定产品入口在指定配置下成功，不自动覆盖其他 Agent。
- `production-used`：需要持续运行、观测和业务证据，目前不由一次测试宣称。

历史 controlled-Live 的 marker、journal、report、artifact 和 tag 均为只读证据，不得 retry、replay、backfill、移动或改写。

## 核心能力

- **账户与数据隔离**：NestJS Auth API、JWT access token、httpOnly refresh token rotation/reuse detection，以及 owner-scoped API。
- **AI 讲题**：流式 Markdown/GFM/数学公式、OCR `activeStudyContext`、Tutor strategy 和安全降级。
- **错题与复习**：错题 CRUD、学科/专题组织、FSRS 四档评分、ReviewTask 生命周期、离线幂等评分和 7/14 天计划预览。
- **知识库**：TXT/Markdown/DOCX/PDF 解析、段落感知分块、MinIO 原文件、PostgreSQL + pgvector chunks、Hybrid Retrieval 和
  `KnowledgeVerifierAgent` 安全提示。
- **Agent 运行时**：Router、Tutor、Retriever、Verifier、FinalResponse、Review、Planner、Memory、KnowledgeDedup/Organizer
  与 WrongQuestionOrganizer 的 typed contract、candidate 和本地 authority；详见审计矩阵。
- **异步与运维**：知识库队列、Chat response durable baseline、Outbox Ops、Worker readiness/observability、Operator Audit 和
  受 gate 保护的证据包导出。
- **Chat 恢复合同**：`chat-turn-stream-v1`、owner-bound status 和 Redis bounded replay 已实现；`/api/chat` 可在 gate 后返回 durable
  turn handoff，浏览器自动 SSE/replay 与断线恢复仍待接入。

## 架构概览

```mermaid
flowchart LR
  Student[Student] --> Web[Next.js Web / PWA shell]
  Web --> NextAPI[Next.js API routes]
  Web --> Server[NestJS API]
  NextAPI --> Agents[Agent composition + gates]
  Agents --> Model[Mock / provider adapters]
  Server --> DB[(PostgreSQL + pgvector)]
  Server --> Queue[(Redis / BullMQ)]
  Server --> Object[(MinIO)]
  Agents --> Server
```

`packages/agent/src/graph/index.ts` 是治理 catalog，不是执行器。产品编排的 source of truth 在 Web/API composition；模型只消费
typed、owner-bound、bounded projection，不能决定身份、业务事实、写权限或最终安全边界。

## 技术栈

| 层      | 技术                                                                             |
| ------- | -------------------------------------------------------------------------------- |
| Web     | Next.js 16, React 19, TypeScript, Tailwind CSS 4, TanStack Query, Zustand, Dexie |
| API     | NestJS 11, Prisma, PostgreSQL, JWT, Zod                                          |
| AI      | Vercel AI SDK, OpenAI-compatible/DeepSeek adapters, LangGraph contracts          |
| RAG     | Qwen `text-embedding-v4` / 1536, pgvector cosine + PostgreSQL full-text          |
| Jobs    | Redis, BullMQ, Durable Outbox, BackgroundJob                                     |
| Storage | MinIO, PostgreSQL, IndexedDB/Dexie                                               |
| Tooling | Bun workspace, Docker Compose, Playwright                                        |

## Monorepo

```text
apps/
  web/       学习端 Next.js 应用
  server/    NestJS API、Worker 和脚本
  admin/     管理员控制台
packages/
  agent/     Agent contract、policy、candidate、eval
  ai/        模型 adapter 与 runtime
  database/  Prisma schema、migration、client
  rag/       解析、分块和检索基础
  fsrs/      间隔重复算法
  types/     共享 Zod/API contract
  mcp/       MCP 工具体系预留
docker/      本地 PostgreSQL、Redis、MinIO 与应用 Compose
docs/        当前指南、路线和验收证据
```

## 快速开始

要求：Windows + PowerShell、Bun `1.3.14`、Docker Desktop。首次配置复制示例环境文件；真实密钥只放在未跟踪的 `.env`，不要提交。

```powershell
git clone <your-repository-url>
cd PrepMind_ai智能备考助手
bun install
Copy-Item docker/.env.example .env

# 无需真实模型的本地开发
$env:POSTGRES_PORT = '5433'
$env:RAG_EMBEDDING_PROVIDER = 'fake'
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d postgres redis minio

$env:DATABASE_URL = 'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun run db:generate
bun run db:migrate
```

另开两个终端启动学习端和 API：

```powershell
bun run dev:server
bun run dev
```

可选管理员前端：

```powershell
bun run dev:admin
```

访问地址：

| 服务          | 地址                           |
| ------------- | ------------------------------ |
| 学习端        | <http://127.0.0.1:3000>        |
| API health    | <http://127.0.0.1:3001/health> |
| Admin         | <http://127.0.0.1:3100>        |
| MinIO Console | <http://127.0.0.1:9001>        |

完整启动、迁移、队列和排障说明见 [`docs/dev-start.md`](docs/dev-start.md)。停止本地服务优先使用 `docker compose stop`；不要使用
`down -v`、volume 删除、数据库 reset、Redis flush 或 MinIO wipe。

## Docker 全栈

需要验证独立 Worker、队列或 Admin 时：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build `
  postgres redis minio server worker web admin
```

队列 RAG 需显式设置 `KNOWLEDGE_PROCESSING_MODE=queue`。真实 RAG 需显式提供 Qwen provider、HTTPS base URL、`text-embedding-v4`、
1536 dimensions 和 `QWEN_API_KEY`；缺配置时应在 Provider 调用前 fail-closed。不要输出 `docker compose config` 的完整结果，
其中可能包含敏感配置。

## 模型与 gate

日常默认配置：

```text
AI_PROVIDER_MODE=mock
AI_ENABLE_LIVE_CALLS=false
ROUTER_MODEL_ENABLED=false
KNOWLEDGE_VERIFIER_MODEL_ENABLED=false
TUTOR_AGENT_MODEL_ENABLED=false
RETRIEVER_QUERY_REWRITE_MODEL_ENABLED=false
FINAL_RESPONSE_AGENT_MODEL_ENABLED=false
REVIEW_AGENT_MODEL_ENABLED=false
PLANNER_AGENT_MODEL_ENABLED=false
KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED=false
KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED=false
```

组件 gate 还受 server-only composition、匹配凭据、预算、超时、schema 和安全 eligibility 约束。不要仅打开一个环境变量就把
功能称为生产可用；真实模型验收必须按 [`docs/ai-behavior-acceptance.md`](docs/ai-behavior-acceptance.md) 和 Agent 审计矩阵执行。

## 验证命令

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test -- --runInBand chat-turns
bun --filter @repo/server test -- --runInBand config/swagger.spec.ts
bun --filter @repo/server test:e2e       # 需要 Docker PostgreSQL
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
git diff --check
```

RAG queue、Worker readiness、Agent focused eval 和真实模型 smoke 的专用命令集中在 `docs/dev-start.md` 与对应 acceptance 文档；
不要把 synthetic usage 当作供应商账单。

## 文档入口

- [`docs/project-status.md`](docs/project-status.md)：当前项目快照和下一步
- [`docs/acceptance/phase-6-agent-runtime-audit.md`](docs/acceptance/phase-6-agent-runtime-audit.md)：Agent 总矩阵、通信、权限、预算和缺口
- [`docs/acceptance/phase-6-chat-stream-replay.md`](docs/acceptance/phase-6-chat-stream-replay.md)：Chat Stream 合同、Redis replay 和 Worker 发布证据
- [`docs/acceptance/phase-6-chat-turn-api-bridge.md`](docs/acceptance/phase-6-chat-turn-api-bridge.md)：`/api/chat` durable admission 与 handoff 验收
- [`docs/dev-start.md`](docs/dev-start.md)：本地启动与运维
- [`docs/roadmap.md`](docs/roadmap.md)：当前路线
- [`docs/data-flow.md`](docs/data-flow.md)：业务和 Agent 数据流
- [`docs/acceptance-checklist.md`](docs/acceptance-checklist.md)：按功能验收清单
- [`docs/ai-behavior-acceptance.md`](docs/ai-behavior-acceptance.md)：Mock/Live 行为验收规则
- [`docs/architecture.md`](docs/architecture.md)：架构说明
- [`DEVLOG.md`](DEVLOG.md)：按日期追加的开发事实和历史回执

## 后续路线

1. 完成 Phase 6 Agent 审计：统一通信、owner/权限、并发、预算 ledger、取消、Trace 和真实模型产品 smoke。
2. 将现有 turn status/Redis replay 接入浏览器 SSE 与断线恢复，再补全链路 ledger 和真实模型 Worker。
3. 完成全部 Agent 架构后实现分层记忆，再分别编写《多 Agent 架构》和《记忆系统》面试学习博客。
4. 进入 Phase 8 性能/PWA、Phase 9 MCP Tool 体系和 Phase 10 生产部署。

## 贡献约定

请先阅读 [`AGENTS.md`](AGENTS.md)。每个逻辑任务单独提交并推送功能分支，使用 `--no-ff` 合并回 `main`，合并后再次验证并推送。
不要提交任何 `.env`、密钥、用户正文或未脱敏 Provider 响应。
