# PrepMind 本地启动命令

> 适用于 Windows PowerShell。本地开发数据库使用 Docker PostgreSQL + pgvector。
> 如果你想按功能验收而不是只启动项目，先看 `docs/acceptance-checklist.md`。

## 0. 先看这里：Prisma Studio、数据库和管理员账号

本项目本地开发默认使用 Docker PostgreSQL，宿主机访问端口是 `5433`：

```text
postgresql://prepmind:devpass@127.0.0.1:5433/prepmind
```

如果你只是想打开 Prisma Studio 看数据，推荐在项目根目录运行：

```powershell
bun run db:studio
```

这条命令会走仓库脚本，自动读取根目录 `.env` 里的 `DATABASE_URL`。

如果你想先确认 Prisma 连接的是不是同一个库，运行：

```powershell
bun run db:status
```

看到 `Database schema is up to date!`，说明 schema 和数据库已经对齐。不要执行 `prisma migrate reset`、`docker compose down -v` 这类会清空数据的命令。

你之前运行的：

```powershell
bun --cwd packages/database prisma studio
```

它是“直接从 database package 目录启动 Prisma CLI”的裸命令。这个命令本身没有问题，但它不会自动帮你读取根目录 `.env`；如果当前 PowerShell 没有提前设置 `$env:DATABASE_URL`，Studio 就会弹 `Prisma Client Error / Unable to run script`，看起来像没有数据。

如果你一定要用这条裸命令，先设置连接串：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --cwd packages/database prisma studio
```

也可以使用 database package 里的脚本命令，它同样会自动读取根目录 `.env`：

```powershell
bun --cwd packages/database prisma:studio
```

三种打开方式的区别：

| 命令 | 是否自动读取根 `.env` | 推荐程度 | 说明 |
| --- | --- | --- | --- |
| `bun run db:studio` | 是 | 推荐 | 在项目根目录执行，最不容易连错库 |
| `bun --cwd packages/database prisma:studio` | 是 | 可用 | 直接调用 database package 的脚本 |
| `bun --cwd packages/database prisma studio` | 否 | 不推荐裸用 | 必须先手动设置 `$env:DATABASE_URL` |

如果你要把某个本地账号升级为管理员，推荐直接在 Docker PostgreSQL 容器里执行 SQL：

```powershell
docker compose -f docker/docker-compose.dev.yml exec postgres psql -U prepmind -d prepmind -c "UPDATE \"User\" SET role='ADMIN' WHERE email='你的邮箱@example.com';"
```

这条命令和 Prisma Studio 不是一类东西：Prisma Studio 是浏览器里的数据库查看/编辑工具；`docker compose exec postgres psql ...` 是直接进入 PostgreSQL 容器执行 SQL，更适合快速改角色。改完后需要退出登录再重新登录，让新的 access token 带上 `ADMIN` 角色。

判断“Docker psql”和“本机 psql”的方法很简单：

| 命令长相 | psql 运行在哪里 | 是否需要本机安装 psql | 连接到哪里 |
| --- | --- | --- | --- |
| `docker compose ... exec postgres psql ...` | Docker 的 `postgres` 容器里 | 不需要 | Compose 里的 PostgreSQL |
| `psql "postgresql://..." ...` | Windows 本机 | 需要 | 由连接串决定；本项目 `127.0.0.1:5433` 通常映射到 Docker PostgreSQL |

可以用下面命令确认 Docker PostgreSQL 是否把端口暴露到了本机：

```powershell
docker compose -f docker/docker-compose.dev.yml ps
```

如果看到 `postgres` 行里有 `5433->5432`，那 `postgresql://prepmind:devpass@127.0.0.1:5433/prepmind` 连接的就是 Docker 里的数据库。

管理员重新登录后，侧边栏会显示“审计”入口；普通用户不会看到该入口。真正的安全边界仍然是后端 `JwtAuthGuard + OperatorGuard`，前端入口只负责体验分流。

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

Phase 7.13 起，Docker Compose 也可以直接拉起完整 Web + API + Worker 本地栈：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web
```

验收入口：

```text
Web:    http://127.0.0.1:3000
API:    http://127.0.0.1:3001/health
Worker: docker compose -f docker/docker-compose.dev.yml --profile worker ps
```

Phase 7.17 起，Docker Compose 也提供独立管理员后台 `admin` service。需要一次性启动学习端、管理员后台、API、worker 和基础设施时，使用：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

对应入口：

```text
学习端：http://127.0.0.1:3000
管理员后台：http://127.0.0.1:3100
API：http://127.0.0.1:3001
Worker 健康：docker compose -f docker/docker-compose.dev.yml --profile worker ps
```

这些容器的职责分别是：

- `web`：学生/学习端 PWA，默认端口 `3000`。
- `admin`：管理员后台，默认端口 `3100`，包含控制台、Outbox Ops、操作审计和 Worker Readiness。
- `server`：NestJS HTTP API，默认端口 `3001`。
- `worker`：后台任务 worker，不对外暴露业务 HTTP 入口，健康状态看 Docker healthcheck。
- `postgres` / `redis` / `minio`：本地数据库、队列和对象存储依赖。

### 本机前端和 Docker 前端怎么选

项目里有两种启动前端的方式，它们看到的都是同一个页面入口 `http://127.0.0.1:3000`，但运行位置和读取的 env 文件不同。

| 方式 | 启动命令 | 适合场景 | 前端 env 改哪里 |
| --- | --- | --- | --- |
| 本机前端 | `bun --filter @repo/web dev` | 日常改 UI、调页面、热更新最快 | `apps/web/.env.local` |
| Docker 前端 | `docker compose -f docker/docker-compose.dev.yml --profile worker up -d web` | 验收 Docker 部署、Next standalone 打包产物、完整容器链路 | 项目根目录 `.env` |

如果你看到 Docker Desktop 里有 `docker-web-1`，或者你是用 `docker compose ... web` 启动页面，那就是 Docker 前端。Docker Compose 会把根目录 `.env` 里的变量传给 `web` service；这时只改 `apps/web/.env.local` 不会影响容器里的前端。

如果你是在终端直接跑 `bun --filter @repo/web dev`，那就是本机前端。它读取 `apps/web/.env.local`，改完后重启这个前端 dev server 即可。

启用 `/agent-trace` 里的 Mock / Live 手动切换，推荐保持默认 Mock，只打开 live guard：

```env
AI_PROVIDER_MODE=mock
AI_ENABLE_LIVE_CALLS=true
AI_DEV_MODE_SWITCH_ENABLED=true
DEEPSEEK_API_KEY=你的 key
# 或者使用 OPENAI_API_KEY=你的 key
```

这样页面默认仍是 Mock，只有你在 `/agent-trace` 手动点 Live 后才会走真实模型。若希望启动后默认就是 Live，把 `AI_PROVIDER_MODE` 改成：

```env
AI_PROVIDER_MODE=live
```

修改 Docker 前端 env 后，重启 `web` 容器即可：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --force-recreate web
```

这只会重启前端容器，不会清 PostgreSQL、MinIO 或 Redis 数据。普通 `up -d`、`--force-recreate web`、重启前端都不会删数据。不要执行下面这类会删除卷或清理工作区的命令，除非你明确知道后果：

```powershell
docker compose -f docker/docker-compose.dev.yml down -v
docker volume rm ...
git clean -fdx
```

`docker/Dockerfile.web` 使用 Bun workspace 和 Next standalone 输出；`apps/web/next.config.ts` 设置了 `output: 'standalone'`。Compose 默认把 server CORS 配成 `http://localhost:3000,http://127.0.0.1:3000`，并把 Web 镜像默认 API 地址设为 `http://127.0.0.1:3001`，避免浏览器验收时混用 `localhost` 和 `127.0.0.1` 造成 cookie / CORS 问题。由于 standalone 容器内 `NODE_ENV=production`，Compose dev 栈会额外设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 和 `AI_DEV_MODE_SWITCH_ENABLED=true`，让 `/agent-trace` 仍可展示本地 Mock / Live 调试开关；生产部署不要设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true`。

Phase 7.15 起，Compose dev 的 server service 也会显式设置这些本地诊断开关：

```env
OUTBOX_OPS_ENABLED=true
OPERATOR_AUDIT_ENABLED=true
WORKER_READINESS_ENABLED=true
WORKER_OBSERVABILITY_ENABLED=true
```

原因是 server 镜像运行态是 `NODE_ENV=production`，这些诊断入口在 production 默认关闭；本地开发栈如果不显式打开，管理员访问 `/operator-audit` 或 `/outbox-events` 会看到 404。生产部署不要照搬这些本地开关，除非是在受控内网或临时诊断场景下明确开启。

本机 `bun --filter @repo/web dev` 也可以访问 `http://127.0.0.1:3000`；`apps/web/next.config.ts` 已允许 `127.0.0.1` 作为 Next dev origin，避免页面 SSR 可见但按钮事件没有 hydration。做登录态验收时，推荐前端地址和 API 地址使用同一组 host，例如都用 `localhost`，或都用 `127.0.0.1`；不要一个用 `localhost`、另一个用 `127.0.0.1`，否则 refresh cookie 在全页刷新后可能不能稳定恢复。

Phase 7.12 起，`worker` service 自带 Docker healthcheck。它在容器内运行的是构建产物：

```text
bun apps/server/dist/scripts/worker-readiness.js
```

不要把它和本机命令 `bun --filter @repo/server readiness:worker` 混在一起：本机开发命令会走 Bun workspace script，容器内 healthcheck 直接执行 runner 镜像里的构建产物。server 镜像会保留根 `node_modules`、`apps/server/node_modules` 和 `packages`，保证 Bun workspace 依赖与 `@repo/*` 包在容器运行时可解析。

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
GET http://127.0.0.1:3001/worker-readiness
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
前端：http://127.0.0.1:3000
后端：http://127.0.0.1:3001
健康检查：http://127.0.0.1:3001/health
Swagger UI：http://127.0.0.1:3001/api-docs
OpenAPI JSON：http://127.0.0.1:3001/api-docs-json
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

### 本地管理员账号

`/operator-audit`、`/outbox-events`、`/worker-readiness` 等 operator 诊断入口要求当前登录用户的 `role=ADMIN`。本地开发最简单的方式是先在前端正常注册一个账号，然后把这个账号升级为管理员。

如果数据库跑在 Docker Compose 里：

```powershell
docker compose -f docker/docker-compose.dev.yml exec postgres psql -U prepmind -d prepmind -c "UPDATE \"User\" SET role='ADMIN' WHERE email='your-email@example.com';"
```

如果直接用本机 PostgreSQL：

```powershell
psql "postgresql://prepmind:devpass@127.0.0.1:5433/prepmind" -c "UPDATE \"User\" SET role='ADMIN' WHERE email='your-email@example.com';"
```

然后退出登录并重新登录，让新的 access token 带上 `ADMIN` 角色。管理员账号会在侧边栏看到“审计”入口，普通用户不会看到；也可以直接访问：

```text
http://localhost:3000/operator-audit
```

注意：前端页面只做体验拦截，真正的权限仍由后端 `JwtAuthGuard` 和 `OperatorGuard` 判断。

### Outbox requeue 手动排障流程

`requeue` 的意思是“重新入队”。在本项目里，它不是重新执行接口，也不是强制把失败任务改成成功，而是把一条已经 `FAILED` 或 `DEAD` 的 `OutboxEvent` 安全地重置为 `PENDING`，等待 worker 里的 outbox dispatcher 下一轮按正常状态机重新 claim 和执行。

什么时候需要 requeue：

- `/worker-readiness` 或 `bun --filter @repo/server readiness:worker` 提示 outbox 有 `DEAD` / `FAILED` 风险。
- `/outbox-events?status=DEAD` 或 `/outbox-events?status=FAILED` 能看到失败事件。
- 你已经确认根因修好了，例如 Redis / 数据库 / 外部 provider 恢复、代码 bug 已修、handler 已注册、配置已补齐。

什么时候不要 requeue：

- 错误是 `OUTBOX_HANDLER_NOT_FOUND`，说明事件类型没有注册 handler，直接 requeue 只会再次失败。
- 错误是 payload 或 metadata 不合法，需要先修数据来源或代码。
- 你还不知道这个事件为什么失败。
- 你只是想“清掉红色状态”。这种情况应该先看详情和 readiness issues，而不是重试。

管理员手动操作 API 示例：

```powershell
# 1. 先用管理员账号登录，拿到 accessToken。
#    最简单方式：浏览器登录后用前端页面操作；如果走 API，则用登录接口返回的 accessToken。

# 2. 查看 DEAD 事件列表
$env:ACCESS_TOKEN='你的管理员 accessToken'
Invoke-RestMethod `
  -Method Get `
  -Uri 'http://127.0.0.1:3001/outbox-events?status=DEAD&limit=20' `
  -Headers @{ Authorization = "Bearer $env:ACCESS_TOKEN" }

# 3. 查看某条事件详情，重点看 status、canRequeue、eventType、lastErrorCode、lastErrorPreview
Invoke-RestMethod `
  -Method Get `
  -Uri 'http://127.0.0.1:3001/outbox-events/这里替换成事件ID' `
  -Headers @{ Authorization = "Bearer $env:ACCESS_TOKEN" }

# 4. 确认根因已修复后重新入队
Invoke-RestMethod `
  -Method Post `
  -Uri 'http://127.0.0.1:3001/outbox-events/这里替换成事件ID/requeue' `
  -ContentType 'application/json' `
  -Headers @{ Authorization = "Bearer $env:ACCESS_TOKEN" } `
  -Body '{"reason":"已修复失败根因，手动重新入队"}'
```

执行成功后：

- 这条 event 会从 `FAILED / DEAD` 变回 `PENDING`，`attempts` 重置为 `0`，锁和 `processedAt` 会清空。
- 它不会立刻在 HTTP 请求里执行 handler；真正执行仍由 worker 的 outbox dispatcher 负责。
- `/operator-audit` 会出现一条 `OUTBOX_REQUEUE / SUCCEEDED` 审计记录；如果 requeue 失败，也会尽量记录 `OUTBOX_REQUEUE / FAILED`。
- 再看 `/worker-readiness`、`/worker-observability/summary` 或 worker 日志，确认状态是否恢复。

### 管理员后台（桌面端）启动命令

Phase 7.16 起，管理员不再只能在学习端侧边栏里看一个移动端审计页。项目新增独立后台管理应用 `@repo/admin`，适合电脑屏幕使用，默认端口是 `3100`。

最常用启动方式：

```powershell
# 1. 先启动后端依赖
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

# 2. 启动后端 API
$env:POSTGRES_PORT='5433'
$env:OUTBOX_OPS_ENABLED='true'
$env:OPERATOR_AUDIT_ENABLED='true'
$env:WORKER_READINESS_ENABLED='true'
bun --filter @repo/server start:dev

# 3. 另开一个 PowerShell，启动管理员后台
bun run dev:admin
# 等价命令：
# bun --filter @repo/admin dev
```

打开地址：

```text
http://127.0.0.1:3100
```

后台管理当前包含三个入口：

- `Outbox Ops`：查看 `FAILED / DEAD` 等 Outbox 事件，确认根因修复后填写原因并重新入队。
- `操作审计`：查看 `OUTBOX_REQUEUE` 等管理员诊断写操作的脱敏审计记录。
- `Worker Readiness`：查看 Redis、BullMQ queue、worker heartbeat 和 outbox backlog 是否满足部署/接流量条件。

注意边界：

- 必须使用 `role=ADMIN` 的账号登录；普通账号会看到无权限状态，后端仍由 `JwtAuthGuard + OperatorGuard` 做最终鉴权。
- 学习端已有的移动端 `/operator-audit` 不删除；管理员在学习端侧边栏会额外看到“后台管理”入口，移动端和桌面端都会显示，默认跳到 `http://127.0.0.1:3100`。后台应用当前仍是桌面优先布局，手机上主要用于临时进入和查看。
- 如果想修改学习端侧边栏里的后台地址，设置 `apps/web/.env.local` 或 Docker 前端环境变量：

```text
NEXT_PUBLIC_ADMIN_CONSOLE_URL=http://127.0.0.1:3100
```

Phase 7.17 起 Docker 全栈启动已经包含单独的 `admin` service。日常改后台 UI 时仍推荐本机跑 `bun run dev:admin`，因为热更新最快；做部署形态或验收时使用 Docker：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

Docker `web` service 会通过 `NEXT_PUBLIC_ADMIN_CONSOLE_URL=http://127.0.0.1:3100` 把学习端 ADMIN 侧边栏的“后台管理”入口指向管理员后台。Docker `server` service 已允许 `http://localhost:3100` 和 `http://127.0.0.1:3100` 作为本地 CORS origin。真正权限仍由后端 `JwtAuthGuard + OperatorGuard` 判断，不能只依赖前端隐藏入口。

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

打开 `/agent-trace` 后会看到 `AI 模式` 开关。该开关只在 `AI_DEV_MODE_SWITCH_ENABLED=true` 且处于非 production 运行时可见；Docker Compose dev 栈因为使用 Next standalone 产物，会通过 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 显式声明这是本地开发诊断容器，从而允许按钮在 `NODE_ENV=production` 的容器里显示。切到 Live 仍要求已配置 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`，并且真实 Chat 请求仍需要登录态通过 `/auth/me` 校验。未满足 live guard 或 API key 时，页面会禁用 Live 选项并展示原因。

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

### 中文路径下 Docker build 报 non-printable ASCII

如果项目放在中文路径下，直接运行下面命令可能失败：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

典型错误是：

```text
failed to dial gRPC ... header key "x-docker-expose-session-sharedkey" contains value with non-printable ASCII characters
```

这不是 server 或 web 代码坏了，而是 Docker Desktop build session 对当前工作路径里的非 ASCII 字符不稳定。解决方式是给项目映射一个纯 ASCII 盘符，然后从这个盘符执行 build：

```powershell
subst P: "E:\PrepMind_ai智能备考助手"
$env:COMPOSE_BAKE='false'
docker compose --project-name docker -f P:\docker\docker-compose.dev.yml --project-directory P:\ --profile worker up -d --build postgres redis minio server worker web admin
```

注意：

- `--project-name docker` 不能省略，否则 Compose 可能因为 `P:\` 根路径没有目录名而提示 `project name must not be empty`。
- 这只是路径映射，不会复制项目，也不会影响 PostgreSQL / Redis / MinIO 数据。
- 构建完成后，仍然可以回到原项目目录运行普通命令；如果想取消映射，用 `subst P: /D`。

### Docker 前端真实模型配置补充

Docker 前端通过 `docker/docker-compose.dev.yml` 的 `env_file: ../.env` 读取根目录 `.env`。因此 Docker 前端要改根 `.env`，本机 `bun --filter @repo/web dev` 前端要改 `apps/web/.env.local`。

日常建议两边都保持：

```env
AI_PROVIDER_MODE=mock
AI_DEV_MODE_SWITCH_ENABLED=true
AI_ENABLE_LIVE_CALLS=false
```

需要在 `/agent-trace` 手动切到 Live 时，只把对应 env 文件里的 `AI_ENABLE_LIVE_CALLS` 改成 `true`，然后重启对应前端即可。Docker 前端重启命令：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --force-recreate web
```

Docker Web 容器内部访问后端使用 `PREPMIND_INTERNAL_API_BASE_URL=http://server:3001`，浏览器访问后端仍使用 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001`。这两个地址不要混用：前者解决容器内 `/api/chat`、`/api/dev/ai-mode` 校验登录态，后者给浏览器页面访问本机后端。
