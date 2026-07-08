# PrepMind 本地启动命令

> 适用于 Windows PowerShell。Phase 2 开发数据库使用 Docker PostgreSQL + pgvector。

## 1. 端口约定

Docker 容器内 PostgreSQL 仍是 `5432`，本机宿主端口固定为 `5433`：

```text
localhost:5433 -> docker-postgres-1:5432
```

推荐本机连接串：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
```

不要使用 `localhost:5432`，它可能被 Windows 本地 PostgreSQL 服务占用或干扰。

## 2. 首次准备

```powershell
bun install

$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun run db:generate
bun run db:migrate
```

如果当前使用 worktree，需要把本地 env 同步到 worktree：

```powershell
Copy-Item E:\PrepMind_ai智能备考助手\.env .env
Copy-Item E:\PrepMind_ai智能备考助手\apps\web\.env.local apps\web\.env.local
Copy-Item .env apps\server\.env
```

确认 `.env` 和 `apps/server/.env` 里的 `DATABASE_URL` 都指向 `5433`。

## 3. 日常启动

启动基础设施：

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
```

启动后端：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER='fake'
bun --filter @repo/server start:dev
```

`RAG_EMBEDDING_PROVIDER='fake'` 只用于本地开发和浏览器 smoke，可在没有 API key 的情况下完成知识库上传、处理和检索测试；真实 embedding 验收时改为 `openai` 或 `qwen` 并配置对应 API key。

使用阿里云百炼 / DashScope 的 OpenAI compatible embedding 时，可按截图里的业务空间 base URL 配置：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER='qwen'
$env:RAG_EMBEDDING_MODEL='text-embedding-v4'
$env:RAG_EMBEDDING_BASE_URL='https://你的业务空间域名/compatible-mode/v1'
$env:RAG_EMBEDDING_DIMENSIONS='1536'
$env:RAG_EMBEDDING_BATCH_SIZE='10'
$env:Qwen_API_KEY='你的 key'
bun --filter @repo/server start:dev
```

`Qwen_API_KEY`、`QWEN_API_KEY`、`DASHSCOPE_API_KEY` 三个变量任选其一即可；不要把真实 key 写进 git。真实 embedding 验收要重新处理资料，旧的 fake embedding chunk 不能用于判断语义召回质量。

默认文档处理模式是 `KNOWLEDGE_PROCESSING_MODE='inline'`，后端收到 `POST /knowledge/documents/:id/process` 后会在 API 进程内直接完成解析、分块、embedding 和入库，不投递 BullMQ。当前 NestJS 仍会初始化 BullMQ 模块，所以本地开发建议继续启动 redis；需要验证 Phase 7 BullMQ 队列链路时，使用 queue 模式启动：

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER='fake'
$env:REDIS_URL='redis://127.0.0.1:6379'
$env:KNOWLEDGE_PROCESSING_MODE='queue'
$env:SERVER_ROLE='both'
bun --filter @repo/server start:dev
```

`SERVER_ROLE` 可选 `api | worker | both`：

- `api`：只启动 HTTP API，不注册 BullMQ worker processor，适合和独立 worker 进程搭配。
- `worker`：只创建 Nest application context，不监听 HTTP 端口，只注册 worker processor。
- `both`：本地一体化模式，同一个进程既提供 HTTP，也消费队列。

本地最省事用 `both`；`inline` 仍是默认 fallback。需要验证真正 API / worker 拆分时，建议开两个终端：

```powershell
# 终端 A：API only
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER='fake'
$env:REDIS_URL='redis://127.0.0.1:6379'
$env:KNOWLEDGE_PROCESSING_MODE='queue'
$env:SERVER_ROLE='api'
bun --filter @repo/server start:dev

# 终端 B：worker only，不监听 3001
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER='fake'
$env:REDIS_URL='redis://127.0.0.1:6379'
$env:KNOWLEDGE_PROCESSING_MODE='queue'
$env:SERVER_ROLE='worker'
bun --filter @repo/server start:dev
```

Docker Compose 也提供了 worker profile。默认 `server` 仍按 `SERVER_ROLE=${SERVER_ROLE:-both}`、`KNOWLEDGE_PROCESSING_MODE=${KNOWLEDGE_PROCESSING_MODE:-inline}` 启动；拆分验证时可以这样运行：

```powershell
$env:POSTGRES_PORT='5433'
$env:SERVER_ROLE='api'
$env:KNOWLEDGE_PROCESSING_MODE='queue'
docker compose -f docker/docker-compose.dev.yml --profile worker up -d postgres redis minio server worker
```

Phase 7.12 起，`worker` service 自带 Docker healthcheck。它在容器内运行的是构建产物：

```text
node dist/scripts/worker-readiness.js
```

不要把它和本机命令 `bun --filter @repo/server readiness:worker` 混在一起：本机开发用 Bun workspace，容器内 runner 镜像只保证有 Node 和已经构建好的 `dist`。

查看 worker 容器健康状态：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker ps
```

如果 worker readiness 通过，`worker` 行会显示 `healthy`；如果 Redis、数据库、队列、heartbeat 或 outbox readiness 不满足条件，会变成 `unhealthy`。排查时先看 worker 日志：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker logs -f worker
```

默认 healthcheck 参数：

```text
interval: 30s
timeout: 10s
retries: 3
start_period: 30s
WORKER_READINESS_CLI_TIMEOUT_MS: 5000
```

worker-only 进程第一版没有 HTTP `/health`，因为它不监听端口；观察它是否正常，主要看进程存活、日志、BullMQ 队列和 `/background-jobs` / `/background-jobs/summary` 状态。

Phase 7.7 之后还可以用 Worker Observability 看后台处理健康状态。非 production 默认开启；production 默认关闭，避免普通登录用户看到系统级队列和 worker 拓扑信号。相关环境变量：

```powershell
$env:WORKER_HEARTBEAT_INTERVAL_MS='15000'
$env:WORKER_HEARTBEAT_TTL_SECONDS='45'
# production 临时诊断才显式开启；本地开发通常不用设置
# $env:WORKER_OBSERVABILITY_ENABLED='true'
```

`SERVER_ROLE=worker` 或 `both` 会通过 BullMQ Redis 连接写入短 TTL heartbeat；`GET /worker-observability/summary` 会组合系统级 queue counts、worker heartbeat 和当前账号 BackgroundJob summary。这个接口经过登录校验，但 queue counts 是系统级信号，因此不要把它当成面向普通用户的长期公开生产接口。

queue 模式 smoke 建议在浏览器打开 `/knowledge`：上传 TXT / Markdown / PDF / DOCX，点击处理，观察资料状态进入 `PROCESSING`，页面展示后台任务状态，最终变为 `DONE` 或 `FAILED`。这只能证明 RAG 处理队列可靠，不证明 `/api/chat` 真实模型回答质量；Chat live 验收仍按本文 AI 调用模式和 `docs/ai-behavior-acceptance.md` 执行。

如果启用了 Worker Observability，`/knowledge` 会在有资料或处理轮询时展示一个紧凑健康状态条：它会提示 worker 最近是否在线、队列是否有等待/处理中任务、最近任务是否失败。知识库为空且没有处理任务时不显示该状态条，避免把“没有可观测对象”误报成“后台不可用”。

Phase 7.11 之后还可以用 Worker Readiness 做部署前机器检查。它和前面的两个入口分工不同：

- `/health`：只回答 API 进程是否活着，适合 HTTP liveness。
- `/worker-observability/summary`：给开发者看的详细观测面，适合手动排障。
- `/worker-readiness` / CLI：给部署系统或本地验收用的 readiness 结论，适合判断 worker 链路现在能不能接任务。

HTTP readiness 入口需要登录态，并受 `WORKER_READINESS_ENABLED` 控制；默认非 production 开启、production 关闭：

```text
GET http://localhost:3001/worker-readiness
```

部署前或本地终端可以直接跑 CLI：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:REDIS_URL='redis://127.0.0.1:6379'
$env:KNOWLEDGE_PROCESSING_MODE='queue'
$env:SERVER_ROLE='worker'
bun --filter @repo/server readiness:worker
```

退出码语义：

- `0`：`ready`，可通过 readiness。
- `1`：`degraded` 或 `not_ready`，依赖可读但存在队列、worker 或 outbox 风险。
- `2`：脚本异常、配置错误或依赖超时。

CLI 默认 10 秒超时，可临时调小方便验证失败路径：

```powershell
$env:WORKER_READINESS_CLI_TIMEOUT_MS='3000'
bun --filter @repo/server readiness:worker
```

CLI 使用最小只读 Nest module，不导入完整 `AppModule`，不会启动 HTTP API、worker processor、heartbeat 或 outbox dispatcher；输出也不会打印连接串、payload、prompt、chunk、API key、token 或 cookie。

启动前端：

```powershell
bun --filter @repo/web dev
```

访问地址：

```text
前端：http://localhost:3000
后端：http://localhost:3001
健康检查：http://localhost:3001/health
Swagger UI：http://localhost:3001/api-docs
OpenAPI JSON：http://localhost:3001/api-docs-json
MinIO API：http://127.0.0.1:9000
MinIO Console：http://127.0.0.1:9001
```

Phase 7.4 adds Swagger / OpenAPI debug docs，Phase 7.5 补齐核心写接口中文说明和安全 request body 示例。`/api-docs` 和 `/api-docs-json` 默认在非 production 环境开启，方便本地联调、查看核心 REST API tags、认证标记、response envelope 说明，以及注册/登录、知识库上传/替换/处理/检索、复习评分和 Agent Trace 写入的传参结构。production 默认关闭；如果临时诊断确实需要暴露文档，只能在受控环境或内网显式设置：

```powershell
$env:SWAGGER_ENABLED='true'
bun --filter @repo/server start:dev
```

`SWAGGER_ENABLED=true` 不会放宽 `JwtAuthGuard`，受保护接口仍需要登录态和 access token。Swagger 只作为调试/展示层，`@repo/types` Zod schemas remain source of truth；前端 contract 不从 OpenAPI 反向生成或反向驱动。Swagger 中的 request body 示例只展示安全占位值，不代表新的契约事实源，也不能放真实 token、cookie、API key、完整 prompt、完整回答或完整 RAG chunk。文档中的响应也遵循全局 response envelope：成功响应是 `{ success, data, requestId }`，错误响应是 `{ success, error, requestId }`。

MinIO 默认登录：

```text
minioadmin / minioadmin
```

默认 bucket 由后端首次上传时自动创建：

```text
prepmind-dev
```

## 4. AI 调用模式

前端 `/api/chat` 开发默认走本地 mock 流式响应，不消耗 DeepSeek / OpenAI 额度。即使 `apps/web/.env.local` 里存在 API key，只要不显式开启 live，也不会调用真实模型。

开发与自动化测试推荐：

```powershell
$env:AI_PROVIDER_MODE='mock'
bun --filter @repo/web dev
```

真实模型验收时才开启：

```powershell
$env:AI_PROVIDER_MODE='live'
$env:AI_ENABLE_LIVE_CALLS='true'
$env:AI_MODEL='deepseek-v4-flash'
$env:AI_MAX_INPUT_TOKENS='2500'
$env:AI_MAX_OUTPUT_TOKENS='1200'
bun --filter @repo/web dev
```

`AI_MODEL` 未设置时默认使用更便宜的 `deepseek-v4-flash`。`AI_MAX_INPUT_TOKENS` 会同时约束 system prompt、`activeStudyContext` 和近期消息；超限会返回 413。live 模式会在服务端输出不含密钥的用量估算日志。

如果需要在本地开发过程中从页面里随时切换 mock / live，可以启用开发调试开关：

```powershell
$env:AI_PROVIDER_MODE='mock'
$env:AI_ENABLE_LIVE_CALLS='true'
$env:AI_DEV_MODE_SWITCH_ENABLED='true'
$env:AI_MODEL='deepseek-v4-flash'
$env:AI_MAX_INPUT_TOKENS='2500'
$env:AI_MAX_OUTPUT_TOKENS='1200'
bun --filter @repo/web dev
```

打开 `/agent-trace` 后会看到 `AI 模式` 开关。该开关只在 `NODE_ENV != production` 且 `AI_DEV_MODE_SWITCH_ENABLED=true` 时可见；切到 Live 仍要求已配置 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`，并且真实 Chat 请求仍需要登录态通过 `/auth/me` 校验。未满足 live guard 或 API key 时，页面会禁用 Live 选项并展示原因。

## 5. 常用验证

```powershell
bun --filter @repo/web lint
bun --filter @repo/web build

bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e

bun --cwd packages/database test
bun --cwd packages/types typecheck
bun --cwd packages/fsrs test
```

前端已移除 `next/font/google`，生产构建使用系统字体栈，受限网络下不应再因为 Google Fonts 拉取失败。

## 6. Prisma

生成 Prisma Client：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun run db:generate
```

执行 migration：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun run db:migrate
```

查看 migration 状态：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
packages\database\node_modules\.bin\prisma.exe migrate status --schema packages/database/prisma/schema.prisma
```

期望输出包含：

```text
Database schema is up to date!
```

## 7. Docker 常用命令

查看容器：

```powershell
docker compose -f docker/docker-compose.dev.yml ps
```

停止容器：

```powershell
docker compose -f docker/docker-compose.dev.yml stop postgres redis minio
```

停止并移除容器：

```powershell
docker compose -f docker/docker-compose.dev.yml down
```

## 8. 常见问题

### Prisma Client 没初始化

执行：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun run db:generate
```

当前 `db:generate` 会自动运行 `packages/database/scripts/repair-prisma-client.mjs`，修复 Bun workspace 下 Prisma Client 生成路径和运行路径不一致的问题。

### e2e 提示 DATABASE_URL / JWT_SECRET undefined

检查：

```powershell
Test-Path .env
Test-Path apps\server\.env
```

`bun --filter @repo/server test:e2e` 在当前环境下需要 `apps/server/.env` 也存在。

### Auth e2e 注册返回 500

优先检查 `.env` 和 `apps/server/.env` 是否误连 `localhost:5432`。本项目本机开发应使用：

```text
127.0.0.1:5433
```

### Docker 命令不可用

确认 Docker Desktop 已启动：

```powershell
docker version
docker compose version
wsl --list --verbose
```

`docker-desktop` 应为 `Running`，并且 `VERSION` 为 `2`。
