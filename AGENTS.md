# PrepMind AI — 仓库协作指南

PrepMind AI 是移动端优先的 Web + PWA 智能备考助手。项目按 Phase 0 ~ Phase 10 推进，当前 Phase 7.17 已完成，后续继续 Phase 7 后台管理产品化边界、更多后台任务生产化和生产观测增强。

## 项目快照

| 阶段 | 状态 | 重点 |
| --- | --- | --- |
| Phase 0 | 已完成 | Monorepo、Prisma 初稿、Docker 基础设施 |
| Phase 1 | 已完成 | 前端 MVP、AI 聊天、OCR、错题本、今日任务、Dexie 本地持久化 |
| Phase 2.1 | 已完成 | NestJS 后端基础、PostgreSQL、Auth/User API |
| Phase 2.2 | 已完成 | 前端 Auth 接入后端，登录态由后端 session 权威控制 |
| Phase 2.3 | 已完成 | WrongQuestion / ChatMessage / OCRRecord API、MinIO 图片链路、Dexie mutationQueue |
| Phase 2.5 | 已完成 | Chat-first 产品壳层、注册登录页、个人中心、今日任务、错题本和聊天体验打磨 |
| Phase 3 | 已完成 | OCR structured output、AI 讲题 prompt、多题保存、tool action proposal 边界 |
| Phase 4.1 | 已完成 | WrongQuestion-first FSRS 复习闭环、Review API、今日复习卡 |
| Phase 4.2 | 已完成 | 学习统计页、Review stats/logs API、复习趋势与最近记录 |
| Phase 4.3 | 已完成 | ReviewTask 持久化任务流、今日任务迁移、评分完成、跳过和恢复 |
| Phase 4.4 | 已完成 | 离线评分队列、服务端幂等评分、今日复习待同步状态和 in-app 提醒摘要 |
| Phase 4.5.1 | 已完成 | 复习计划预览、`/review-tasks/plan`、`/plan` 页面、`/stats` ECharts 图表 |
| Phase 4.5.2 | 已完成 | `ReviewPreference`、加权压力模型、7 / 14 天计划窗口、今日容量摘要 |
| Phase 5.0 | 已完成 | RAG 知识库设计、可降级 Chat 边界、Phase 5.1 实施计划 |
| Phase 5.1 | 已完成 | RAG 数据模型、`vector(1536)` 索引预留、knowledge API contract |
| Phase 5.2 | 已完成 | 文档上传、列表、详情、删除与状态 API |
| Phase 5.3 | 已完成 | 文档解析、分块、embedding 入库、`POST /knowledge/documents/:id/process` |
| Phase 5.4 | 已完成 | 检索 API、`POST /knowledge/search`、query embedding + pgvector 相似度搜索 |
| Phase 5.5 | 已完成 | Chat RAG 增强、知识库上下文注入、Markdown citations |
| Phase 5.6 | 已完成 | `/knowledge` 学习资料工作台、上传/处理/替换/删除/检索测试前端闭环 |
| Phase 6.0 | 已完成 | Agent Runtime 地基、共享 Agent contract、RouterAgent、阈值 guard、recorder、graph descriptor |
| Phase 6.1 | 已完成 | RouterAgent 接入 `/api/chat`、Agent route headers、route-aware prompt、mock route 展示 |
| Phase 6.2 | 已完成 | TutorAgent 策略层、讲题意图分类、策略 prompt、mock strategy metadata |
| Phase 6.3 | 已完成 | KnowledgeVerifierAgent、RAG 资料可信度评估、资料核对提示、verifier headers |
| Phase 6.4 | 已完成 | WrongQuestionOrganizerAgent、错题学科卡片、专题 deck、错题组织层 API |
| Phase 6.5 | 已完成 | ReviewAgent / PlannerAgent、复习分析、学习计划建议、只读 suggestions API |
| Phase 6.6 | 已完成 | MemoryAgent、长期记忆候选、人审确认、停用/恢复/删除管理 |
| Phase 6.7 | 已完成 | Agent Trace UI、估算成本看板、固定 deterministic eval set |
| Phase 6.8 | 已完成 | KnowledgeDedupAgent / KnowledgeOrganizerAgent、资料重复/新版/互补判断、只读 suggestions API、`/knowledge` 建议面板 |
| Phase 7.0 | 已完成 | `BackgroundJob` 控制面、账号级后台任务读 API、脱敏任务元数据 |
| Phase 7.1 | 已完成 | BullMQ 知识库处理队列、inline / queue 双模式、worker role、`/knowledge` 后台处理状态 |
| Phase 7.2 | 已完成 | RAG SafetyGuard、chunk 级 prompt injection 风险 metadata、Chat prompt 前过滤、Verifier / UI 安全提示 |
| Phase 7.3 | 已完成 | in-process EventBus 失败隔离、后台任务 summary API、`/knowledge` 后台任务摘要与轮询兜底 |
| Phase 7.4 | 已完成 | Swagger / OpenAPI debug docs、`/api-docs`、`/api-docs-json`、全局 response envelope 说明 |
| Phase 7.5 | 已完成 | Swagger 中文说明、核心写接口 request body 示例、multipart 上传文档说明 |
| Phase 7.6 | 已完成 | API / worker 进程启动拆分、`SERVER_ROLE=worker` application context、Docker worker profile |
| Phase 7.7 | 已完成 | Worker Observability、Redis heartbeat、队列 backlog / worker 在线状态、`/knowledge` 健康状态条 |
| Phase 7.8.1 | 已完成 | RAG Eval Baseline、固定检索评估集、recall@k / top1 / safety / no-hit 指标 |
| Phase 7.8.2 | 已完成 | Hybrid Retrieval、向量候选 + PostgreSQL full-text keyword 候选、去重融合排序 |
| Phase 7.8.3 | 已完成 | RAG Eval Smoke、本地 API 级上传/处理/检索/eval 串联验收脚本 |
| Phase 7.8.4 | 已完成 | RAG Eval Smoke 收尾增强、case 防误报 guard、`RAG_EVAL_SMOKE_KEEP_DATA`、面试博客 |
| Phase 7.9.1 | 已完成 | Durable Outbox 地基、`OutboxEvent`、claim / retry / dead-letter 状态机 |
| Phase 7.9.2 | 已完成 | Outbox Dispatcher 最小闭环、handler registry、知识库 requested 事件入库 |
| Phase 7.9.3 | 已完成 | Outbox Dispatcher worker-only 受控运行、生产默认关闭、防重入 tick |
| Phase 7.9.4 | 已完成 | Outbox Summary / Metrics、worker observability 安全只读指标 |
| Phase 7.10 | 已完成 | Outbox Ops 后端闭环、脱敏列表/详情、`FAILED / DEAD -> PENDING` 安全 requeue |
| Phase 7.11 | 已完成 | Worker Readiness、`/worker-readiness`、部署前 CLI readiness 命令 |
| Phase 7.12 | 已完成 | Docker worker healthcheck、容器级 readiness 状态接入 |
| Phase 7.13 | 已完成 | Docker Web 镜像、Next standalone、全栈 Compose 启动与浏览器验收 |
| Phase 7.14.1 | 已完成 | Operator 权限与操作审计设计文档 |
| Phase 7.14.2 | 已完成 | OperatorGuard、系统级诊断入口 admin-only 访问控制 |
| Phase 7.14.3 | 已完成 | `OperatorAuditLog`、审计 service、脱敏 metadata 与来源 hash |
| Phase 7.14.4 | 已完成 | Outbox requeue 成功/失败审计接入 |
| Phase 7.14.5 | 已完成 | `GET /operator-audit-logs`、admin-only 脱敏审计查询 API |
| Phase 7.14.6 | 已完成 | `/operator-audit` 管理员审计台、ADMIN 侧边栏入口、脱敏列表筛选 |
| Phase 7.15 | 已完成 | 管理员审计台真实运行验收、Docker dev 诊断开关、`127.0.0.1` hydration 修复 |
| Phase 7.16 | 已完成 | 独立桌面端 Admin Console、Outbox Ops 操作页、审计/Worker 页面、学习端后台入口 |
| Phase 7.17 | 已完成 | Docker Admin Console service、`3100` 独立容器、全栈 Compose 验收 |

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui, TanStack Query, Zustand, Dexie, PWA |
| Backend | NestJS 11, Prisma, PostgreSQL, Redis, BullMQ |
| AI | Vercel AI SDK, OpenAI, DeepSeek, Gemini |
| Agent / RAG / MCP | LangGraph, pgvector, bge-m3, MCP JSON-RPC |
| Infra | Docker, MinIO, Sentry, OpenTelemetry, Prometheus, Grafana |

Agent 框架使用 LangGraph，不使用 AutoGen。
Phase 6 是多 Agent 协作亮点阶段：当前已完成 Agent Runtime 地基、RouterAgent 到 Chat 的轻量接入、TutorAgent 策略层、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent、MemoryAgent、Agent Trace 可观测闭环，以及 KnowledgeDedupAgent / KnowledgeOrganizerAgent 资料管理建议。`TutorAgent`、`KnowledgeVerifierAgent`、`WrongQuestionOrganizerAgent`、`ReviewAgent`、`PlannerAgent`、`MemoryAgent`、`KnowledgeDedupAgent` 与 `KnowledgeOrganizerAgent` 当前都是确定性 policy，不直接调用真实模型；Tutor 负责讲题意图和 prompt 策略，Verifier 只在 RAG 命中后评估资料可信度，WrongQuestionOrganizer 只给错题学科组与专题 deck 建议，Review / Planner 只基于当前用户错题、复习日志、复习计划和偏好生成只读学习建议，Memory 只生成长期记忆候选并等待用户确认，KnowledgeDedup / KnowledgeOrganizer 只基于当前用户资料元数据和少量 chunk 摘要给出重复、新版、互补、集合与标签建议。最终流式输出仍由 `/api/chat` 的既有 mock/live 链路负责；错题组织由 NestJS organizer API 写入独立组织层；复习计划建议由 `/review-agent/suggestions` 读取并展示，不创建未来 `ReviewTask`；长期记忆由 `/memory-agent` 与 `/user-memories` API 管理，不自动注入每次 Chat；资料管理建议由 `/knowledge-agent/suggestions` 读取并在 `/knowledge` 展示，不自动合并、删除、替换、重命名或分类资料。Agent Trace 由 `/agent-traces` 在线账号级 API 持久化脱敏后的路由、步骤、token 和估算成本元数据，`/agent-trace` 提供调试台；它不保存完整 prompt、完整回答、完整 RAG chunk 或 API key，成本看板只展示估算值，不替代模型供应商账单。

## 常用命令

本仓库使用 Bun workspace。Windows 本机开发优先使用 Bun，Docker PostgreSQL 固定宿主机端口 `5433`。

```powershell
bun install

$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

$env:RAG_EMBEDDING_PROVIDER='fake'
# 可选：启用 BullMQ 队列处理知识库文档
# $env:REDIS_URL='redis://127.0.0.1:6379'
# $env:KNOWLEDGE_PROCESSING_MODE='queue'
# $env:SERVER_ROLE='both' # 本地一体化；拆分验证时 server 用 api，worker 进程用 worker
bun --filter @repo/server start:dev
bun --filter @repo/web dev
bun run dev:admin # 或 bun --filter @repo/admin dev，打开 http://127.0.0.1:3100
```

常用验证：

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
bun --filter @repo/server smoke:rag-eval # 需本地 API 与真实或可用 embedding provider 已启动
bun --filter @repo/server readiness:worker # 需本地 PostgreSQL / Redis 可连接，用于部署前 worker readiness 检查
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
```

Docker 全栈本地验收：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

访问入口：

```text
学习端：http://127.0.0.1:3000
管理员后台：http://127.0.0.1:3100
API：http://127.0.0.1:3001
```

后端 e2e 需要 Docker PostgreSQL 正在运行。详细启动说明见 `docs/dev-start.md`。
按功能做阶段验收、Docker 全栈验收、mock/live AI 验收和收尾提交时，优先看 `docs/acceptance-checklist.md`。

## 环境变量

- 根目录 `.env`：后端和 Prisma 使用，至少包含 `DATABASE_URL`、`JWT_SECRET`。
- `apps/server/.env`：server/e2e 在服务目录运行时读取，保持和根 `.env` 一致。
- `apps/web/.env.local`：Next.js API Route 使用；开发默认 `AI_PROVIDER_MODE=mock`，即使存在 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY` 也不会调用真实模型。
- 知识库处理默认 `KNOWLEDGE_PROCESSING_MODE=inline`，业务处理不投递 BullMQ；需要验证 BullMQ 时设置 `KNOWLEDGE_PROCESSING_MODE=queue`、`REDIS_URL=redis://127.0.0.1:6379`。`SERVER_ROLE=api` 只启动 HTTP API 且不注册 worker processor；`SERVER_ROLE=worker` 只创建 Nest application context、不监听 HTTP 端口并注册 worker processor；`SERVER_ROLE=both` 用于本地一体化开发，HTTP 与 worker 同进程。当前 NestJS 仍会初始化 BullMQ 模块，本地开发建议继续启动 redis。Phase 7.7 起 worker / both 角色会通过 BullMQ Redis 连接写入短 TTL heartbeat，默认 `WORKER_HEARTBEAT_INTERVAL_MS=15000`、`WORKER_HEARTBEAT_TTL_SECONDS=45`，用于 `/worker-observability/summary` 和 `/knowledge` 健康状态条判断 worker 最近是否在线。`WORKER_OBSERVABILITY_ENABLED` 默认非 production 开启、production 关闭；production 仅适合受控内网或临时诊断显式开启。
- Phase 7.9.3 起 `OutboxDispatcherRunnerService` 会在 `SERVER_ROLE=worker | both` 且 `OUTBOX_DISPATCHER_ENABLED=true` 时按固定间隔调用 `OutboxDispatcherService.dispatchBatch()`；非 production 默认开启，production 默认关闭，生产环境需要显式设置 `OUTBOX_DISPATCHER_ENABLED=true`。可用 `OUTBOX_DISPATCHER_INTERVAL_MS`、`OUTBOX_DISPATCHER_BATCH_SIZE` 和 `OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS` 控制 tick 间隔、批大小和锁超时。runner 不读取 outbox payload、不绕过 handler registry、不新增 HTTP API 或前端 UI。
- Phase 7.10 起 `OUTBOX_OPS_ENABLED` 控制后端 Outbox Ops 诊断入口；默认非 production 开启、production 关闭。`GET /outbox-events`、`GET /outbox-events/:id` 与 `POST /outbox-events/:id/requeue` 经过 feature gate 和 `JwtAuthGuard`，feature gate 排在认证前，关闭时隐藏为 404。接口只返回脱敏状态、attempts、时间戳、payloadHash、错误码和脱敏错误预览，不返回 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。requeue 只允许 `FAILED / DEAD -> PENDING`，不直接执行 handler，不支持删除、强制成功、跳过、payload 编辑或直接 dispatch。
- Phase 7.14.5 起 `OPERATOR_AUDIT_ENABLED` 控制 Operator Audit 查询入口；默认非 production 开启、production 关闭。`GET /operator-audit-logs` 经过 feature gate、`JwtAuthGuard` 和 `OperatorGuard`，关闭时在认证前隐藏为 404。接口只返回脱敏审计列表和 cursor，不返回 `metadata`、outbox payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、access token、refresh token、cookie、原始 IP 或原始 User-Agent。Phase 7.14.6 起前端新增 `/operator-audit` 管理员审计台；管理员会在侧边栏看到“审计”入口，普通用户不显示入口且页面不会主动请求审计 API，真正安全边界仍以后端 guard 为准。
- Phase 7.15 起本地 Docker dev compose 会显式开启 `OUTBOX_OPS_ENABLED`、`OPERATOR_AUDIT_ENABLED`、`WORKER_READINESS_ENABLED` 和 `WORKER_OBSERVABILITY_ENABLED`，因为 server 镜像运行态是 `NODE_ENV=production`，不能依赖非 production 默认值来打开诊断入口。Next dev 配置允许 `127.0.0.1` 作为 dev origin，避免按本地文档访问 `127.0.0.1:3000` 时只看到 SSR 页面但 React 表单事件未 hydration。真实验收已覆盖管理员 / 普通用户前后端权限、`/operator-audit` 页面、审计 API 和 Outbox requeue 审计写入。
- Phase 7.11 起 `WORKER_READINESS_ENABLED` 控制 worker readiness 诊断入口；默认非 production 开启、production 关闭。`GET /worker-readiness` 经过 feature gate 和 `JwtAuthGuard`，关闭时在认证前隐藏为 404。该接口面向机器和部署检查，只返回安全的 Redis / BullMQ queue / worker heartbeat / outbox readiness 摘要，不返回 payload、prompt、chunk、API key、token、cookie 或用户正文。CLI 命令为 `bun --filter @repo/server readiness:worker`，使用最小只读 Nest module，不导入 `AppModule`，不启动 HTTP API、worker processor、heartbeat 或 outbox dispatcher；异常或超时退出码为 2，not ready / degraded 退出码为 1，ready 退出码为 0。
- Phase 7.12 起 Docker Compose `worker` service 接入容器级 healthcheck，容器内使用 runner 构建产物命令 `bun apps/server/dist/scripts/worker-readiness.js`，不依赖本机 Bun workspace CLI。server 镜像会保留根 `node_modules`、`apps/server/node_modules` 和 `packages`，保证 Bun workspace 依赖与 `@repo/*` 包在容器运行时可解析。`WORKER_READINESS_CLI_TIMEOUT_MS` 默认 `5000`，healthcheck 默认 `interval=30s`、`timeout=10s`、`retries=3`、`start_period=30s`。本地可用 `docker compose -f docker/docker-compose.dev.yml --profile worker ps` 查看 `healthy / unhealthy`。
- Phase 7.13 起 `docker/Dockerfile.web` 已迁移到 Bun workspace + Next standalone 输出，`apps/web/next.config.ts` 使用 `output: 'standalone'` 和 monorepo tracing root。Phase 7.17 起 Docker Compose 全栈验收命令为 `docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin`；本地浏览器访问学习端 `http://127.0.0.1:3000`，管理员后台 `http://127.0.0.1:3100`，API `http://127.0.0.1:3001`。Compose server 默认允许 `http://localhost:3000`、`http://127.0.0.1:3000`、`http://localhost:3100` 和 `http://127.0.0.1:3100`，web 镜像默认 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001` 且 `NEXT_PUBLIC_ADMIN_CONSOLE_URL=http://127.0.0.1:3100`，避免 Docker 本机验收时 localhost / 127.0.0.1 cookie 与 CORS 混用。Compose dev 栈会设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 和 `AI_DEV_MODE_SWITCH_ENABLED=true`，让 standalone 容器内的 `/agent-trace` 仍可展示 Mock / Live 开关；生产部署不要设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true`。
- Swagger / OpenAPI 调试文档默认只在非 production 开启，入口为 `/api-docs` 和 `/api-docs-json`；production 默认关闭，`SWAGGER_ENABLED=true` 只适合受控环境、内网或临时诊断，且不放宽任何 `JwtAuthGuard`。Phase 7.5 起核心写接口补充中文说明和安全 request body 示例，便于本地调试与面试讲解。
- 真实模型验收必须同时设置 `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true`；默认 live 模型为 `deepseek-v4-flash`，并建议保留 `AI_MAX_INPUT_TOKENS=2500`、`AI_MAX_OUTPUT_TOKENS=1200` 预算上限。
- 本地开发可额外设置 `AI_DEV_MODE_SWITCH_ENABLED=true`，在 `/agent-trace` 调试台切换 mock / live；该开关默认仅非 production 可见。Docker Compose dev 的 Next standalone 容器因运行时 `NODE_ENV=production`，需要同时设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 才显示；该本地诊断开关不能用于生产，也不能绕过 `AI_ENABLE_LIVE_CALLS`、API key 或 live Chat 登录校验。
- AI 行为验收规范见 `docs/ai-behavior-acceptance.md`；mock 验工程链路，live 小样本验真实输出体验，fake embedding 不证明 RAG 语义命中质量。

推荐数据库连接：

```text
DATABASE_URL=postgresql://prepmind:devpass@127.0.0.1:5433/prepmind
```

env 文件均被 git 忽略，不提交密钥。

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
- `@repo/types` 是前后端 API contract 的优先位置，使用 Zod 表达 schema；Swagger / OpenAPI 是 NestJS 调试和展示层，不反向驱动前端 contract。

## 代码约定

- TypeScript strict。
- Prettier：2 空格、单引号、分号、100 字符宽。
- 文件名 kebab-case，类名 PascalCase，变量 camelCase。
- 导入顺序：外部库 -> `@repo/*` -> 相对路径。
- NestJS 遵循 Controller -> Service -> Repository。
- 高频 SQL 查询必须建索引。
- 移动端优先，触摸目标不小于 44x44px。
- PWA 页面要考虑离线静态访问和主屏幕添加体验。

## 当前数据流

- 登录态权威来源：NestJS Auth API + PostgreSQL refresh token + httpOnly cookie。
- Refresh token 已启用 rotation 与 reuse detection；Auth 主链路不依赖 Redis。
- WrongQuestion / ChatMessage / OCRRecord 已迁移到 PostgreSQL，按当前 `userId` 隔离。
- WrongQuestionOrganizer：`WrongQuestionSubjectGroup` / `WrongQuestionDeck` / `WrongQuestionDeckItem` 是错题组织层，按当前 `userId` 隔离；一个错题同一时间只属于当前用户一个 organizer deck，不替代 WrongQuestion / Card / ReviewLog / ReviewTask 事实来源。
- Review：`/reviews` 已支持错题加入复习、学习统计和最近复习日志；`/review-tasks` 已支持今日复习任务、评分完成、跳过、恢复和未来复习计划预览；Card / ReviewLog / ReviewTask / ReviewPreference 以 PostgreSQL 为权威来源。
- `/review-preferences` 读写当前用户账号级复习计划偏好，包括每日分钟、每日卡片上限、提醒时间、提醒开关和计划窗口。
- `/review-tasks/plan` 是只读预览接口，基于 `Card.nextReview`、`Card.difficulty`、`Card.stability` 和 `ReviewPreference` 计算加权压力，不创建未来 `ReviewTask`。
- `/plan` 展示未来 7 / 14 天复习压力、容量状态、原因标签和偏好设置；`/stats` 使用客户端 ECharts 展示趋势、评分分布和卡片状态，避免 SSR hydration 风险。
- ReviewAgent / PlannerAgent：`GET /review-agent/suggestions` 基于当前用户 Card、ReviewLog、ReviewTask 计划、ReviewPreference 和错题组织数据生成只读建议；该接口不创建 `ReviewTask(source=PLANNER)`，不写 Card / ReviewLog / ReviewPreference / WrongQuestion / deck 数据，不进入 Dexie `mutationQueue`。
- MemoryAgent：`UserMemoryCandidate` / `UserMemory` 以 PostgreSQL 为权威来源；`POST /memory-agent/candidates/generate` 基于当前用户聊天偏好信号、错题薄弱点、复习日志和偏好生成去重候选，候选必须由用户在 `/profile` 确认后才成为 `ACTIVE` 记忆；`GET /user-memories`、`PATCH /user-memories/:id`、`DELETE /user-memories/:id` 支持查看、停用、恢复和删除。MemoryAgent 不调用真实模型，不写 Chat / Review / WrongQuestion 事实表，不进入 Dexie `mutationQueue`，当前不把记忆自动注入 `/api/chat`。
- Agent Trace：`AgentTraceRun` / `AgentTraceStep` 以 PostgreSQL 为权威来源；`/api/chat` 在有 access token 时 best-effort 写入脱敏 trace，写入失败只影响 `x-prepmind-agent-trace-recorded=false`，不打断流式回答；`/agent-traces` 是在线账号级 API，不进入 Dexie `mutationQueue`，不保存完整 prompt、完整回答、完整 RAG chunk 或 API key；`/agent-trace` 的成本看板只展示 token 与价格表推导出的估算成本。
- BackgroundJob：`BackgroundJob` 以 PostgreSQL 为权威来源；`GET /background-jobs`、`GET /background-jobs/summary` 与 `GET /background-jobs/:id` 是经过 `JwtAuthGuard` 的账号级只读 API，只返回状态、资源类型、资源 id、时间戳、错误摘要和脱敏 metadata，不保存完整文件内容、prompt、RAG chunk、API key 或 access token；summary 的 `activeCount` 使用账号级真实 active count，最近失败/跳过/成功摘要基于最新 50 条任务窗口。
- Durable Outbox：`OutboxEvent` 以 PostgreSQL 为权威来源，用于持久化内部事件的脱敏 metadata、payload hash、幂等键、attempts、锁定信息和重试时间；`OutboxService` 提供 enqueue、claim、success、retry 和 dead-letter 状态机。Phase 7.9.1 只落地 outbox 地基，不替换 BullMQ、`BackgroundJob` 或 in-process `EventBus`，也不自动迁移现有事件发布点；payload 和 lastError 只能保存安全元数据或脱敏错误摘要，不得保存 API key、access token、refresh token、cookie、完整 prompt、完整 RAG chunk、完整模型回答或真实用户私有正文。
- Outbox Dispatcher：`OutboxDispatcherService` 负责 claim `OutboxEvent` 并分发到显式注册的 handler，成功后标记 `SUCCEEDED`，失败后复用 retry / dead-letter 状态机；Phase 7.9.2 只注册 `knowledge.document.processing.requested`，该 handler 只校验安全 metadata，不重投 BullMQ、不写 `Document`、不写 `BackgroundJob`、不保存用户内容。`DocumentProcessingJobService` 在 BullMQ enqueue 成功后 best-effort 写入 requested outbox event，outbox 写入失败不影响原有用户请求、BullMQ 主链路或 in-process EventBus 发布。
- Outbox Dispatcher Runner：`OutboxDispatcherRunnerService` 是 Outbox Dispatcher 的受控运行入口，只在 worker / both 角色且开关开启时运行；单进程内上一轮 tick 未完成时会跳过下一轮，tick 异常只记录脱敏 warning，不打断 worker 进程。production 默认关闭，避免部署后未经确认消费历史 outbox 事件。
- Outbox Summary / Metrics：`OutboxMetricsService` 读取系统级 `OutboxEvent` 状态计数、backlog、最老 pending 年龄和最近错误摘要，并接入 `GET /worker-observability/summary`；该 summary 只读且不返回 payload、完整 `lastError`、`aggregateId`、prompt、chunk、API key、token、cookie 或用户内容。`DEAD` outbox event 会让 worker observability status 进入 `degraded`，pending / processing backlog 会作为独立信号展示。
- Outbox Ops：`GET /outbox-events`、`GET /outbox-events/:id` 和 `POST /outbox-events/:id/requeue` 是受 `OUTBOX_OPS_ENABLED` 与 `JwtAuthGuard` 保护的后端诊断入口，用于本地开发和受控排障。列表与详情只暴露脱敏 DTO；详情中的 `lastErrorPreview` 复用扩展后的 `sanitizeJobError()` 并截断，不泄露常见 API key、access token、refresh token、cookie、`sk-...` key 或供应商 key。分页按 `updatedAt desc, id desc` 使用复合 cursor，避免只按 id 翻页导致漏数据。requeue 使用 `updateMany` 条件更新实现 compare-and-swap，只把 `FAILED / DEAD` 事件重置为 `PENDING`，清理锁与 processedAt，重置 attempts 和 nextRunAt，但不修改 payload、不立即执行 handler。
- Operator Audit：`OperatorAuditLog` 以 PostgreSQL 为权威来源，用于记录 operator/admin 诊断写操作的安全审计元数据。Phase 7.14.3 新增 `OUTBOX_REQUEUE` action、`OperatorAuditService` 和脱敏写入能力；Phase 7.14.4 已把 `POST /outbox-events/:id/requeue` 接入成功/失败审计；Phase 7.14.5 新增 `GET /operator-audit-logs` admin-only 脱敏查询 API；Phase 7.14.6 新增 `/operator-audit` 管理员审计台，管理员侧边栏显示“审计”入口，用于手动筛选 action、status、targetType、targetId 和 actorUserId。审计记录包含 actor、action、status、target、reason、requestId、IP/User-Agent hash、错误 code 和截断后的脱敏错误预览，不保存 outbox payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、access token、refresh token、cookie 或原始 IP/User-Agent。审计查询只返回脱敏 DTO，不返回 `metadata` 或任何业务 payload；审计日志不会随 actor user 删除而级联删除，actor 删除后保留审计记录并把 `actorUserId` 置空；审计写入失败只记录脱敏 warning，不影响主操作。前端页面和导航只是运维体验层，不承担最终鉴权。
- Admin Console：Phase 7.16 新增独立桌面端 `apps/admin` / `@repo/admin`，默认端口 `3100`，本地命令为 `bun run dev:admin` 或 `bun --filter @repo/admin dev`；Phase 7.17 新增 Docker `admin` service，可通过 `docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin` 启动完整栈。第一版包含控制台、`/outbox`、`/audit` 和 `/worker` 页面，复用既有 admin-only API，不新增后端权限模型；学习端保留移动端 `/operator-audit`，ADMIN 用户在移动端和桌面端侧边栏都会显示“后台管理”入口，默认跳到 `http://127.0.0.1:3100`，普通用户不可见；后台应用当前仍是桌面优先布局。后台前端只负责体验和引导，真正安全边界仍是后端 `JwtAuthGuard + OperatorGuard`。
- API / worker 进程边界：`SERVER_ROLE=api` 使用 Nest HTTP app，提供 REST API、`/health`、Swagger 和业务入口，但不消费 BullMQ；`SERVER_ROLE=worker` 使用 `NestFactory.createApplicationContext()`，只初始化模块和 BullMQ processor，不监听 HTTP 端口、不提供 `/health`；`SERVER_ROLE=both` 保留本地兼容模式。worker-only 的健康判断依赖进程存活、日志、BullMQ 和 BackgroundJob 状态。
- Worker Observability：`GET /worker-observability/summary` 经过 `JwtAuthGuard` 且受 `WORKER_OBSERVABILITY_ENABLED` 控制，默认只在非 production 开启；production 默认隐藏该接口，避免普通登录用户看到系统级队列和 worker 拓扑信号。该接口组合系统级 BullMQ `knowledge-document-processing` queue counts、Redis worker heartbeat 和账号级 `BackgroundJob` summary，输出 `healthy / degraded / attention / idle` 信号；queue counts 是系统级队列状态，BackgroundJob summary 是当前账号最近任务状态，两者语义不同但互补。heartbeat 只保存不含 hostname / pid 的 opaque worker id、role、队列名和 startedAt / lastSeenAt，不保存文件内容、prompt、RAG chunk、API key、token 或用户输入。`/knowledge` 页面在有资料或处理轮询时展示紧凑健康状态条；该能力只读，不进入 Dexie `mutationQueue`。
- Worker Readiness：`GET /worker-readiness` 和 `bun --filter @repo/server readiness:worker` 用于回答“当前 worker 链路能不能接生产流量 / 能不能作为部署 readiness 通过”。它和 `/health`、`/worker-observability/summary` 分工不同：`/health` 是 API 进程 liveness；`/worker-observability/summary` 是给开发者看的详细观测面；readiness 是机器友好的部署前结论。readiness 组合 Redis / BullMQ queue counts、worker heartbeat 和 outbox summary，输出 `ready / degraded / not_ready`。CLI 使用最小只读 module，不导入 `AppModule`，避免启动普通应用副作用；输出只包含安全摘要与 issues，不打印原始依赖错误、连接串、payload、prompt、chunk、API key、token 或 cookie。
- OpenAPI 调试文档：Phase 7.4 新增 Swagger / OpenAPI debug docs，`/api-docs` 和 `/api-docs-json` 默认在非 production 开启；production 默认关闭，显式 `SWAGGER_ENABLED=true` 只用于受控环境、内网或临时诊断。Phase 7.5 为注册、登录、知识库上传/替换/处理/检索、复习评分和 Agent Trace 写入补充中文描述与安全 request body 示例。Swagger 只描述和展示 REST API，不改变认证、鉴权或业务 contract；受保护接口仍必须经过 `JwtAuthGuard`。全局响应 envelope 语义为成功响应 `{ success, data, requestId }`，错误响应 `{ success, error, requestId }`；字段约束仍以 `@repo/types` Zod schema 为准。
- KnowledgeDedupAgent / KnowledgeOrganizerAgent：`GET /knowledge-agent/suggestions` 经过 `JwtAuthGuard`，按当前 `userId` 读取 `Document` 与每份资料最多少量 `Chunk` 摘要，生成重复资料、疑似新版、互补资料、集合和标签建议；该接口是在线只读建议，不写 Document / Chunk / 分类表，不自动合并、删除、替换、重命名或分类资料，不调用 live 模型，不进入 Dexie `mutationQueue`。
- RAG 文档 API：`/knowledge/documents` 已支持上传、列表、详情、删除和 `PUT /knowledge/documents/:id/file` 替换上传，`POST /knowledge/documents/:id/process` 已支持处理上传文档。
- RAG 文档去重与替换：普通上传会按当前用户 `contentHash` 返回已有同内容资料；替换上传会保留同一 `Document.id`、重置为 `PENDING`，并拒绝替换为其它资料卡片已有的相同内容。替换事务使用 `status + updatedAt + storageKey + contentHash` 做 compare-and-swap，成功后才删除旧 chunks；`PROCESSING` 中的资料禁止替换；并发处理或并发替换导致快照变化时返回 `KNOWLEDGE_DOCUMENT_PROCESSING`，只清理本次新上传对象，不删除旧对象。
- RAG 处理链路：支持 TXT / Markdown / DOCX / PDF 基础文本解析，使用 `@repo/rag` 段落感知分块；每个 chunk 入库前会写入 deterministic `metadata.safety`，用于标记 prompt injection、泄露密钥、隐藏行为、工具/数据写入等风险；embedding provider 已抽象，默认 OpenAI `text-embedding-3-small`，也支持阿里云百炼 / DashScope OpenAI-compatible `qwen` provider（如 `text-embedding-v4` + 业务空间 `/compatible-mode/v1` base URL）；本地开发和测试/e2e 可用 `RAG_EMBEDDING_PROVIDER=fake` 做无成本验收，production 禁止 fake provider。
- RAG 处理模式：`POST /knowledge/documents/:id/process` 默认 inline 同步执行，设置 `KNOWLEDGE_PROCESSING_MODE=queue` 后会创建 `BackgroundJob` 并投递 BullMQ，worker 继续复用同一套 document snapshot 校验和 chunk 写入流程；Redis 是 queue 处理链路的必需依赖，本地开发仍建议随 postgres / minio 一起启动。
- RAG 持久化：`Document` / `Chunk` 以 PostgreSQL + pgvector 为权威来源，`Chunk.embedding` 固定为 `vector(1536)` 并通过 raw SQL 持久化；写入前校验 document/user ownership。处理链路在 claim、清 chunk、写 chunk、标记 DONE / FAILED 时持续校验 `status=PROCESSING + storageKey + contentHash` 快照，chunk 替换事务使用 `SELECT ... FOR UPDATE` 锁定当前 Document 行，避免旧处理流污染新上传资料。
- RAG 状态边界：`Document` 状态流为 `PENDING -> PROCESSING -> DONE / FAILED`，空文本、零 chunk、解析/embedding 失败进入 `FAILED`；forced reprocess 会在同一 processing 快照下先清旧 chunks，避免 stale retrieval。
- RAG 检索 API：`POST /knowledge/search` 已升级为 Hybrid Retrieval：先生成 query embedding，再召回 pgvector cosine vector candidates 和 PostgreSQL full-text keyword candidates，按 `chunkId` 去重融合并输出 `0..1` final score；仍只检索当前用户 `DONE` 文档 chunks，并在命中结果中返回 chunk metadata、safety metadata 和轻量 `metadata.retrieval` 调试信息。Phase 7.8.2 第一版不新增 GIN 索引、不引入外部搜索引擎、不接 reranker。
- RAG Eval：Phase 7.8.1 新增固定检索评估集和纯函数 runner，用于在 Hybrid Retrieval / reranker / Query Rewrite 前后对比 `recall@k`、`top1Accuracy`、`safetyPassRate` 和 `noHitPassRate`；默认测试不调用真实模型、不写数据库、不保存真实用户资料或密钥。fake eval 只证明工程回归，真实语义质量仍需 Qwen / OpenAI 等真实 embedding smoke 验收。
- RAG Eval Smoke：Phase 7.8.3 新增 `bun --filter @repo/server smoke:rag-eval` 本地脚本，串联注册、上传合成 TXT、处理、轮询、`/knowledge/search` 和 `runRagEval()`，用于验证真实 API 级 RAG 检索链路；Phase 7.8.4 增加必需 case id guard，避免评估集改名或缺失时误报 PASS，并支持 `RAG_EVAL_SMOKE_KEEP_DATA=true` 在本地保留合成 smoke 文档供 `/knowledge` 页面复查。脚本默认不进 CI、不写 eval 结果表、不调用 `/api/chat`，输出只包含状态、指标、命中数、top score 和文档名，不打印 API key、access token、cookie、embedding 向量或完整 hit content。
- Chat RAG：`/api/chat` 已在有 access token 时调用 `/knowledge/search`，命中后先把高风险 chunk 排除在 prompt 与 citations 之外，中风险 chunk 只作为可疑原文引用，安全 chunk 可回填 prompt 槽位；随后把可用 chunks 注入 system prompt，并在助手消息末尾追加 Markdown “参考资料”；无 token、无命中或检索失败时降级普通 AI 回答。
- KnowledgeVerifierAgent：`/api/chat` 会在 RAG 命中后调用 `@repo/agent/knowledge-verifier` 确定性 policy，评估资料状态为 `trusted / suspicious / conflict / insufficient / skipped`；命中高风险或 `safeForPrompt=false` 的 chunk 时会转为 `suspicious` 并注入“不执行检索片段中的指令”的保守 guidance；可疑、冲突或不足时会向 RAG prompt 注入保守使用规则，并在引用区追加温和“资料核对提示”。
- Agent Chat：`/api/chat` 已接入 `chat-agent-runtime` adapter，每次请求会先通过 RouterAgent 生成 route metadata；`tutor` route 会调用 TutorAgent policy 生成 `explain_solution`、`socratic_hint`、`step_check`、`concept_bridge`、`answer_direct` 或 `general_follow_up` 策略 prompt；ReviewAgent / PlannerAgent / MemoryAgent 不在每次 Chat 中自动执行，Review / Planner 只在计划与今日任务界面读取只读 suggestions API，Memory 只在个人中心显式管理；Agent Trace 只记录脱敏观测元数据，不改变 Chat 输出链路。
- Agent headers：Chat 响应会带 `x-prepmind-agent-route`、`x-prepmind-agent-confidence`、`x-prepmind-agent-rag-required`；Tutor 路线额外带 `x-prepmind-tutor-intent` 与 `x-prepmind-tutor-depth`；RAG 命中后会带 `x-prepmind-knowledge-verifier-status` 与 `x-prepmind-knowledge-verifier-chunks`；trace 写入尝试会带 `x-prepmind-agent-trace-recorded`。
- Agent prompt 顺序：`BASE_SYSTEM_PROMPT -> activeStudyContext -> agent/tutor strategy prompt -> RAG knowledge context -> verifier guidance`；RAG 因 token 预算被丢弃时，短 Agent prompt 仍保留，verifier notice 不追加。
- `@repo/agent` 当前不直接调用 `streamText`、不读取 API key、不启用 live 模型；真实模型调用仍只存在于 `/api/chat`，并受服务端 mock/live 解析、`AI_ENABLE_LIVE_CALLS=true`、API key 和 live Chat 登录校验保护；开发模式开关只能作为非 production override。
- `/knowledge` 页面已接入 RAG 文档管理、检索测试、资料管理建议、后台处理状态、后台任务摘要、Worker Observability 健康状态条和 SafetyGuard 信号：支持资料上传、列表、处理、替换上传、删除内联确认、状态摘要、手动检索预览，以及只读展示重复/新版/互补资料、集合和标签建议；检索结果会对疑似指令注入或需谨慎引用的 chunk 展示小型安全标记；文档处于 `PROCESSING`、本地触发处理或账号级 summary 仍有 active job 时会短轮询刷新，并展示最近后台 job 状态、后台任务摘要和 worker 在线/队列积压提示，静态 `PENDING` 不无限轮询；资料上传、替换、处理或删除后会失效刷新 knowledge agent suggestions；资料卡片操作使用右上角三点菜单，点击页面其它区域可收起菜单，`DONE` 资料不再展示主按钮式重新处理；该页面为在线能力，不进入 Dexie `mutationQueue`。
- `/error-book` 已升级为学科优先入口：错题首页展示学科卡片，学科内展示专题 deck，专题内展示错题列表；专题支持重命名，详情弹层、备注、掌握状态、删除确认和加入复习保持原有 CRUD 能力。
- Organizer API：`GET /wrong-question-groups`、`GET /wrong-question-groups/:subjectGroupId/decks`、`GET /wrong-question-decks/:deckId/questions`、`POST /wrong-question-organizer/organize/:wrongQuestionId`、`POST /wrong-question-organizer/organize-batch`、`PATCH /wrong-question-decks/:deckId`、`POST /wrong-question-decks/:deckId/items`、`DELETE /wrong-question-decks/:deckId/items/:wrongQuestionId`。
- Organizer API 是在线组织能力，不进入 Dexie `mutationQueue`；创建错题后的自动整理为非阻塞流程，整理失败不影响错题保存。
- ReviewTask 评分支持 `clientMutationId` 幂等；重复提交同一评分命令不会重复写入 `ReviewLog`。
- Dexie 继续作为本地快速恢复、离线兜底、乐观更新和旧图片预览层。
- WrongQuestion / OCRRecord / ReviewTask rating 写失败进入 Dexie `mutationQueue`，在 session 恢复、online、focus 时自动补偿同步。
- 今日任务页会展示本地待同步评分；离线评分不本地推进 FSRS、ReviewLog 或统计，仍以服务端同步成功为准。
- ChatMessage 不进入通用 mutation queue，继续使用 `/chat-messages/sync` 的会话快照幂等同步。
- Chat live 流式结束后会等待短稳定窗口并校验 assistant 内容；若最后仍是 user 或 assistant 为空，不写 Dexie、不同步服务端，并提示“本次回答没有成功生成，请重试”。
- `/chat-messages/sync` 后端会拒绝不完整会话快照，非空快照必须以非空 `ASSISTANT` 消息收尾，防止前端兜底失效时污染 PostgreSQL。
- 新 OCR 图片通过 `/uploads/images` 上传到 MinIO；`/ocr-records` 与 `/wrong-questions` 不接收 `data:` base64 图片。
- `/api/chat` 与 `/api/ocr` 仍由 Next.js API Route 代理 AI 服务；`/api/chat` 默认使用本地 mock 流式响应，只有显式 live 双开关开启后才调用外部模型，live 默认模型为 `deepseek-v4-flash`。
- `/api/chat` 已加入上下文窗口、active OCR 题目上下文预算和输出 token 上限；有效 OCR 题目会生成 `activeStudyContext` 供后续追问承接。
- Chat / OCR 流式输出使用渐进 Markdown 渲染；展示格式化不回写 OCR 原始内容和 `activeStudyContext`。
- 今日任务轻手账与学习偏好仍是 userId scoped localStorage 数据，不进入 mutation queue，也暂不注入 prompt。
- 今日复习卡来自 `/review-tasks/today`，不存入 localStorage；轻手账 checklist 仍保存在 localStorage。

详细数据流见 `docs/data-flow.md`。

## 当前注意事项

- Docker PostgreSQL 使用 `5433 -> 5432` 映射，避免与 Windows 本地 PostgreSQL 冲突。
- 开发环境 CORS 允许 `localhost`、`127.0.0.1` 和私有局域网地址动态端口。
- PostgreSQL 需要 pgvector：`CREATE EXTENSION IF NOT EXISTS vector;`。
- `packages/fsrs` 保持纯算法包，不依赖数据库。
- Phase 7 已落地知识库文档处理队列地基、RAG SafetyGuard、事件可观测小闭环、Swagger / OpenAPI debug docs、核心写接口中文说明、API / worker 进程启动拆分、Worker Observability 健康摘要、Durable Outbox 持久事件地基、Outbox Dispatcher 最小消费闭环、worker-only 受控运行入口、Outbox Summary / Metrics 只读观测、Outbox Ops 后端脱敏排障与安全 requeue、Worker Readiness 部署前检查、Docker worker healthcheck、Docker Web / API / Worker 全栈 Compose 验收、OperatorGuard、OperatorAuditLog 审计地基、Operator Audit 脱敏查询 API、管理员审计台、真实管理员/普通用户前后端验收、独立桌面端 Admin Console 第一版，以及 Docker Admin Console service；后续异步任务可继续把 OCR、Embedding、PDF 解析、提醒调度等接入 BullMQ / outbox dispatcher / 事件总线。
- 从 Phase 7.6 起，新建 docs / blogs / plans / specs 文件名优先使用语义化名称，不再加日期前缀；历史带日期文件暂不批量重命名，避免破坏已有引用。
- 向量索引用 raw SQL 创建，Prisma 不直接支持向量索引。

## 下一步

后续最优先：

1. Phase 7 后续：评估后台管理只读详情、导出策略、保留周期、更细 operator role，再继续更多后台任务生产化、worker metrics 细化和生产诊断边界收口。
