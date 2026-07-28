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

| 命令                                        | 是否自动读取根 `.env` | 推荐程度   | 说明                               |
| ------------------------------------------- | --------------------- | ---------- | ---------------------------------- |
| `bun run db:studio`                         | 是                    | 推荐       | 在项目根目录执行，最不容易连错库   |
| `bun --cwd packages/database prisma:studio` | 是                    | 可用       | 直接调用 database package 的脚本   |
| `bun --cwd packages/database prisma studio` | 否                    | 不推荐裸用 | 必须先手动设置 `$env:DATABASE_URL` |

如果你要把某个本地账号升级为管理员，推荐直接在 Docker PostgreSQL 容器里执行 SQL：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml exec postgres psql -U prepmind -d prepmind -c "UPDATE \"User\" SET role='ADMIN' WHERE email='你的邮箱@example.com';"
```

这条命令和 Prisma Studio 不是一类东西：Prisma Studio 是浏览器里的数据库查看/编辑工具；`docker compose exec postgres psql ...` 是直接进入 PostgreSQL 容器执行 SQL，更适合快速改角色。改完后需要退出登录再重新登录，让新的 access token 带上 `ADMIN` 角色。

判断“Docker psql”和“本机 psql”的方法很简单：

| 命令长相                                    | psql 运行在哪里             | 是否需要本机安装 psql | 连接到哪里                                                         |
| ------------------------------------------- | --------------------------- | --------------------- | ------------------------------------------------------------------ |
| `docker compose ... exec postgres psql ...` | Docker 的 `postgres` 容器里 | 不需要                | Compose 里的 PostgreSQL                                            |
| `psql "postgresql://..." ...`               | Windows 本机                | 需要                  | 由连接串决定；本项目 `127.0.0.1:5433` 通常映射到 Docker PostgreSQL |

可以用下面命令确认 Docker PostgreSQL 是否把端口暴露到了本机：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml ps
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
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d postgres redis minio

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
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d postgres redis minio
```

启动后端：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER='fake'
bun --filter @repo/server start:dev
```

`RAG_EMBEDDING_PROVIDER='fake'` 只用于非 production 本地开发和自动测试，可在没有 API key 的情况下完成知识库上传、处理和检索工程回归；production 会拒绝 fake。当前真实 RAG embedding 标准路径是 Qwen `text-embedding-v4` / 1536。

使用阿里云百炼 / DashScope 的 OpenAI compatible embedding 时，可按截图里的业务空间 base URL 配置：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER='qwen'
$env:RAG_EMBEDDING_MODEL='text-embedding-v4'
$env:RAG_EMBEDDING_BASE_URL='https://你的业务空间域名/compatible-mode/v1'
$env:RAG_EMBEDDING_DIMENSIONS='1536'
$env:RAG_EMBEDDING_BATCH_SIZE='32'
$env:QWEN_API_KEY='你的 key'
bun --filter @repo/server start:dev
```

production 必须显式提供 `RAG_EMBEDDING_PROVIDER` 和 `RAG_EMBEDDING_MODEL`。Qwen 还必须提供不含 username/password/query/hash 的 HTTPS `RAG_EMBEDDING_BASE_URL` 与规范 `QWEN_API_KEY`；provider、model、base URL 或匹配凭据任一缺失即 fail-closed，不会从 Qwen 自动 fallback 到 OpenAI/fake，反之亦然。`Qwen_API_KEY` 和 `DASHSCOPE_API_KEY` 仅作为宿主兼容输入；Docker Compose 会在 server/worker 容器内统一规范化为 `QWEN_API_KEY`。不要把真实 key 写进 git。真实 embedding 验收要重新处理资料，旧的 fake embedding chunk 不能用于判断语义召回质量。

默认文档处理模式是 `KNOWLEDGE_PROCESSING_MODE='inline'`，后端收到 `POST /knowledge/documents/:id/process` 后会在 API 进程内直接完成解析、分块、embedding 和入库，不投递 BullMQ。当前 NestJS 仍会初始化 BullMQ 模块，所以本地开发建议继续启动 redis；需要验证 Phase 7 BullMQ 队列链路时，使用 queue 模式启动：

```powershell
$env:POSTGRES_PORT='5433'
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d postgres redis minio

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

Docker Compose 也提供了 worker profile。Phase 7.23.8 起，Compose 的 `server` 固定为
`SERVER_ROLE=api`，不允许宿主环境把完整栈的 API 容器覆盖成 `both`；否则 API 会写 worker heartbeat，
在独立 worker 宕机时造成在线/readiness 假阳性。完整栈中的 Dispatcher、审计导出 processor 和维护 processor
只由独立 `worker` 承担，避免 API 容器与 worker 容器重复消费。server/worker 的 RAG runtime allowlist 保持一致，包括 provider/model/base URL/dimensions/batch size/chunk 预算/timeout 与规范 Qwen key。拆分验证 queue 链路时必须在宿主显式设置 `KNOWLEDGE_PROCESSING_MODE=queue`，不依赖 Compose 或进程默认：

```powershell
$env:POSTGRES_PORT='5433'
$env:SERVER_ROLE='api'
$env:KNOWLEDGE_PROCESSING_MODE='queue'
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d postgres redis minio server worker
```

Phase 7.13 起，Docker Compose 也可以直接拉起完整 Web + API + Worker 本地栈：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web
```

验收入口：

```text
Web:    http://127.0.0.1:3000
API:    http://127.0.0.1:3001/health
Worker: docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker ps
```

Phase 7.17 起，Docker Compose 也提供独立管理员后台 `admin` service。需要一次性启动学习端、管理员后台、API、worker 和基础设施时，使用：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio minio-init server worker web admin
```

对应入口：

```text
学习端：http://127.0.0.1:3000
管理员后台：http://127.0.0.1:3100
API：http://127.0.0.1:3001
Worker 健康：docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker ps
```

这些容器的职责分别是：

- `web`：学生/学习端 PWA，默认端口 `3000`。
- `admin`：管理员后台，默认端口 `3100`，包含控制台、Outbox Ops、操作审计和 Worker Readiness。
- `server`：NestJS HTTP API，默认端口 `3001`。
- `worker`：后台任务 worker，不对外暴露业务 HTTP 入口，健康状态看 Docker healthcheck。
- `postgres` / `redis` / `minio`：本地数据库、队列和对象存储依赖。

### 审计证据包 Docker 验收

本地 Compose 会显式打开审计读取、导出、维护和 Outbox Dispatcher；应用代码中的 production
默认值仍全部关闭。必须先部署 migration，再启动包含 `minio-init` 的完整栈：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun packages/database/scripts/prisma-with-root-env.mjs migrate deploy
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio minio-init server worker web admin
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker ps
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker logs --tail 120 server worker minio-init
```

`minio-init` 应退出 0，并为 `operator-audit-exports/` 写入 2 天 expiration/noncurrent、
delete-marker 与 1 天 incomplete multipart 规则。应用层 READY 到期后立即返回 410，小时维护负责正常
物理删除，MinIO lifecycle 只是约 48 小时的异常兜底；对象存储按天计算和扫描，不承诺恰好在
READY+48:00 删除。worker 的明文临时目录挂载为 192 MiB tmpfs，
`mode=0700,uid=1001,gid=1001`；镜像运行用户同为 `1001:1001`，否则 crash janitor 会因 EPERM
无法访问目录。

证据包链路观测三个队列：`operator-audit-export`、`operator-audit-maintenance` 和既有
`knowledge-document-processing`；BullMQ key prefix 默认是 `prepmind`。申请 API 只提交 PostgreSQL facts，必须由
worker 内的 Outbox Dispatcher 把事件投递到 export queue，所以不要只启动 `server` 后期待证据包完成。

准备专用 ADMIN/STUDENT token 后运行确定性 smoke：

```powershell
$env:OPERATOR_AUDIT_EXPORT_SMOKE_ADMIN_TOKEN='<临时 ADMIN access token>'
$env:OPERATOR_AUDIT_EXPORT_SMOKE_STUDENT_TOKEN='<临时 STUDENT access token>'
$env:OPERATOR_AUDIT_EXPORT_SMOKE_BASE_URL='http://127.0.0.1:3001'
$env:OPERATOR_AUDIT_EXPORT_SMOKE_TIMEOUT_MS='120000'
$env:OPERATOR_AUDIT_EXPORT_SMOKE_KEEP_DATA='false'
# 仅在部署修改过默认前缀时设置，并与 worker 保持一致
$env:BULLMQ_PREFIX='prepmind'
bun --filter @repo/server smoke:operator-audit-export
```

两个 token 应来自本轮专用临时账号：先通过 `/auth/register` 创建 ADMIN 候选和 STUDENT，再按本文
“本地管理员账号准备”只提升候选账号，重新登录以取得带 ADMIN role 的新 access token。不要复用
长期真实账号；验收结束后删除这两个测试账号及其 refresh token。若 KEEP_DATA=true，先按终端输出的
安全 export id 检查，再通过 Prisma/数据库按 `clientRequestId + reason + export id` 精确删除该轮 facts，
严禁按时间范围或整个 prefix 批量清空共享环境。

期望输出只有安全摘要：

```text
Operator audit export smoke: PASS
export=<id> records=<count> requestAudit=1 downloadAudit=1 expired=true objectDeleted=true
```

脚本会验证 STUDENT list/create/download 均为 403、ADMIN 申请到 READY、ZIP 头和响应头、
`records.csv`/`manifest.json`、CSV/ZIP SHA-256、申请/下载审计、到期 410 与 MinIO 删除；默认
`finally` 精确清理本次 export/audit/outbox/SYSTEM job、Bull jobs 和对象。ADMIN/STUDENT 测试账号
由验收人员预先准备，不属于脚本 cleanup，验收结束后要另行删除。只有排障时才把 KEEP_DATA 设为
true，并在检查后人工清理。token、ZIP 内容、object key、payload 和 metadata 都不应写进日志或文档。

### 本机前端和 Docker 前端怎么选

项目里有两种启动前端的方式，它们看到的都是同一个页面入口 `http://127.0.0.1:3000`，但运行位置和读取的 env 文件不同。

| 方式        | 启动命令                                                                                     | 适合场景                                                 | 前端 env 改哪里       |
| ----------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------- |
| 本机前端    | `bun --filter @repo/web dev`                                                                 | 日常改 UI、调页面、热更新最快                            | `apps/web/.env.local` |
| Docker 前端 | `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d web` | 验收 Docker 部署、Next standalone 打包产物、完整容器链路 | 项目根目录 `.env`     |

如果你看到 Docker Desktop 里有 `docker-web-1`，或者你是用 `docker compose ... web` 启动页面，那就是 Docker 前端。Compose 只用根目录 `.env` 为 `${...}` 做插值，并把 `docker-compose.dev.yml` 中明确列出的 Web allowlist 注入 `web`；它不会把整个根 `.env` 作为 Web 的 `env_file`。这时只改 `apps/web/.env.local` 不会影响容器里的前端。

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
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --force-recreate web
```

这只会重启前端容器，不会清 PostgreSQL、MinIO 或 Redis 数据。普通 `up -d`、`--force-recreate web`、重启前端都不会删数据。验收和排障时明确禁止 `docker compose down -v`、删除 volume、Prisma/数据库 reset、Redis `FLUSHDB` / `FLUSHALL`、MinIO wipe 以及 `git clean -fdx`；不要把破坏性命令作为“恢复环境”步骤。

当前 Compose 为 PostgreSQL 和 MinIO 分别使用 `docker_pgdata` 与 `docker_miniodata` 命名卷。普通 `docker compose down` 会删除容器但保留这两个卷；`down -v` 才会连卷一起删除。Phase 6.9.3.5 之前的 MinIO service 没有挂载命名卷，因此那次旧容器被删除后，旧对象不能承诺恢复；从当前版本起普通容器重建不会再连带删除 `/data`。Redis 仍没有持久卷，只承担可降级 cache/queue，本地重建后应允许从 PostgreSQL 权威数据恢复。

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
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker ps
```

如果 worker readiness 通过，`worker` 行会显示 `healthy`；如果 Redis、数据库、队列、heartbeat 或 outbox readiness 不满足条件，会变成 `unhealthy`。排查时先看 worker 日志：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker logs -f worker
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

API 级 RAG smoke 使用 `bun --filter @repo/server smoke:rag-eval`。脚本只接受 queue 模式，必须轮询到 `BackgroundJob=SUCCEEDED`，并校验命中的 `keywordScore`、`vectorScore`、`mode=hybrid` 与每个 case 无重复 `chunkId`；任一证据缺失都应失败。当前检索是 pgvector cosine + PostgreSQL full-text 两路候选、`chunkId` 去重 hybrid rank，没有 reranker。

Phase 7.8.5 真实 Docker 验收已使用 Qwen `text-embedding-v4` / 1536 通过 3/3，queue `BackgroundJob=SUCCEEDED`，缺 provider/key/base URL 的启动检查均在 provider 调用前 fail-closed。证据见 `docs/acceptance/2026-07-14-rag-runtime-parity.md`。

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
docker compose --env-file .env -f docker/docker-compose.dev.yml exec postgres psql -U prepmind -d prepmind -c "UPDATE \"User\" SET role='ADMIN' WHERE email='your-email@example.com';"
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
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d postgres redis minio

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
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

Docker `web` service 会通过 `NEXT_PUBLIC_ADMIN_CONSOLE_URL=http://127.0.0.1:3100` 把学习端 ADMIN 侧边栏的“后台管理”入口指向管理员后台。Docker `server` service 已允许 `http://localhost:3100` 和 `http://127.0.0.1:3100` 作为本地 CORS origin。真正权限仍由后端 `JwtAuthGuard + OperatorGuard` 判断，不能只依赖前端隐藏入口。

### 后台返回学习端后又要登录怎么办

优先检查你是不是混用了 `localhost` 和 `127.0.0.1`。这两个地址都指向本机，但在浏览器里属于不同 host，前端状态、refresh cookie 和 API 请求恢复链路不会天然共享。

推荐做法是同一轮验收里统一使用一组地址：

```text
方案 A：
学习端：http://localhost:3000
管理员后台：http://localhost:3100
API：http://localhost:3001

方案 B：
学习端：http://127.0.0.1:3000
管理员后台：http://127.0.0.1:3100
API：http://127.0.0.1:3001
```

不要这样混用：

```text
后台：http://localhost:3100
学习端：http://127.0.0.1:3000
API：http://127.0.0.1:3001
```

Phase 7.17.1 起，管理员后台的“返回学习端”会默认跟随当前 hostname：你用 `localhost:3100` 打开后台，它会回到 `localhost:3000`；你用 `127.0.0.1:3100` 打开后台，它会回到 `127.0.0.1:3000`。学习端和管理员后台的浏览器 API base 也会在本机 loopback 场景下自动对齐当前 hostname，减少因为 host 混用导致的 session recovery 问题。

如果你显式配置了 `NEXT_PUBLIC_LEARNING_APP_URL`，后台会优先使用这个值。此时要确认它和你实际打开后台用的 host 是同一组；否则仍可能表现为“从后台回学习端后像是掉登录”。这类问题通常不是后端鉴权失效，而是本机浏览器 host 不一致导致登录态恢复不稳定。

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
docker compose --env-file .env -f docker/docker-compose.dev.yml ps
```

停止容器：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml stop postgres redis minio
```

停止并移除容器：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml down
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

### Docker Desktop 打开后只看到 Gordon

Docker Desktop 4.81 默认可能停在左侧 `Gordon` AI 页面；它不是容器列表，也不表示服务消失。点击左侧 `Containers` 查看 Compose services，`Images` 查看镜像，`Volumes` 查看 `docker_pgdata` / `docker_miniodata`。如果刚执行过普通 `docker compose down`，容器会被删除，因此 `Containers` 可能暂时为空；命名卷仍可在 `Volumes` 看到。重新运行本页的全栈 `up -d` 命令即可创建容器，不要为了“找回服务”执行 `down -v` 或删除卷。

### Docker Desktop 多服务 build 报 non-printable ASCII

部分 Docker Desktop 版本在多服务 Compose Bake 会话初始化时，直接运行下面命令可能失败：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

典型错误是：

```text
failed to dial gRPC ... header key "x-docker-expose-session-sharedkey" contains value with non-printable ASCII characters
```

这不是 server/worker 代码或 provider 配置坏了，而是 Docker Desktop 的 BuildKit/Compose session 在多服务 build 下不稳定。RAG API/worker 验收可关闭当前终端的 Compose Bake 委托，分别构建两个镜像，再对精确服务列表使用 `--no-build`：

```powershell
$env:COMPOSE_BAKE='false'
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker build server
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker build worker
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --no-build postgres redis minio server worker
Remove-Item Env:COMPOSE_BAKE
```

注意：

- `COMPOSE_BAKE=false` 只是当前 PowerShell 会话的本机诊断绕行；不要写进仓库或生产配置，Docker Desktop 修复后应去掉它复测。
- server 和 worker 必须使用两条独立 `build` 命令；重新合并为多服务 build 可能复现同一 session header 错误。
- 不要为这个宿主工具异常执行 builder cache 清理、image/container/volume 删除、`down -v` 或数据库 reset；这些操作不会修复 Compose 会话头，反而可能破坏现有数据。

### `minio/mc` 无法拉取

先确认 Docker Hub 或公司镜像源是否可达。Phase 7.23.8 的离线验收曾因外网不可用，临时使用本机
兼容镜像实现 Compose 所需的四条 `mc` 命令，并用真实 MinIO SDK 核对 lifecycle；这只是未提交的
本地 workaround，不是官方镜像拉取成功，也不是生产部署方案。恢复网络后应重新拉取并使用官方
`minio/mc`，生产还要单独验证 versioned bucket 的 delete-marker 清理行为。

### Docker server / web 真实模型配置补充

> 当前 Compose 以 `docker/docker-compose.dev.yml` 为准：`server`、`worker`、`web`、`admin` 都不再通过 service `env_file` 导入整份根 `.env`，只接收各自 `environment` 中明列的 allowlist。`web` 接收 Chat、Router、Verifier 与 Tutor；`server` 接收 Review/Planner、KnowledgeDedup/Organizer 与 WrongQuestionOrganizer；`worker` 只接收 RAG/队列/运维变量；`admin` 只接收后台所需 URL。根 `.env` 只是宿主 Compose 插值输入，不会整份进入任一容器。

Compose CLI 不会因为 `-f docker/docker-compose.dev.yml` 自动把仓库根 `.env` 当作该文件的插值源；标准命令必须显式传 `--env-file .env` 做 `${VAR:-default}` 替换。CLI `--env-file` 仅影响 Compose 插值，不等于 service `env_file`。Tutor 只使用 `TUTOR_AGENT_DEEPSEEK_API_KEY`，WrongQuestionOrganizer 只使用 `WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY`；generic key、另一组件 key、Review/Planner 或 Knowledge credential 都不能替代。Review/Planner、Knowledge 与 WrongQuestionOrganizer 的 gate/timeout 只进入 `server`；`SERVER_ROLE=worker` 即使被宿主额外伪造注入 Organizer gate/key，模块也强制关闭 executor。Compose 的 RAG 默认占位是 `qwen` + `text-embedding-v4` + 1536，但 production-mode 容器仍要求 provider/model 显式且与对应凭据匹配；Qwen base URL 必须是无凭据 HTTPS URL。宿主传入的 `Qwen_API_KEY` / `DASHSCOPE_API_KEY` 只是兼容别名，容器内统一为 `QWEN_API_KEY`。仓库只提交变量名和空/default 引用，不提交值。

不要运行或粘贴会输出完整解析配置的 `docker compose config`；静态校验只使用：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker config --quiet
```

在不读取根 `.env` 的静态/CI 检查中，改用受版本控制且只有占位值的模板：

```powershell
docker compose --env-file docker/.env.example -f docker/docker-compose.dev.yml --profile worker config --quiet
```

两条命令成功时都不输出解析后的 key；不要把 `--quiet` 换成 `config`、`config --environment` 或 `config --format json` 后粘贴终端结果。

Docker 栈要改根 `.env`，本机 `bun --filter @repo/web dev` 前端要改 `apps/web/.env.local`。

日常建议两边都保持：

```env
AI_PROVIDER_MODE=mock
AI_DEV_MODE_SWITCH_ENABLED=true
AI_ENABLE_LIVE_CALLS=false
ROUTER_MODEL_ENABLED=false
KNOWLEDGE_VERIFIER_MODEL_ENABLED=false
ROUTER_MODEL_TIMEOUT_MS=5000
KNOWLEDGE_VERIFIER_MODEL_TIMEOUT_MS=4000
TUTOR_AGENT_MODEL_ENABLED=false
TUTOR_AGENT_MODEL_TIMEOUT_MS=3000
TUTOR_AGENT_DEEPSEEK_API_KEY=
WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED=false
WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS=5000
WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY=
REVIEW_AGENT_MODEL_ENABLED=false
PLANNER_AGENT_MODEL_ENABLED=false
REVIEW_AGENT_MODEL_TIMEOUT_MS=4500
PLANNER_AGENT_MODEL_TIMEOUT_MS=4500
KNOWLEDGE_AGENT_DEEPSEEK_API_KEY=
KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED=false
KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED=false
KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS=4500
KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS=4500
```

Phase 6.9.4.4 的两个 Agent gate 是独立 rollback 开关，不能用一个总开关替代。Router 的 deterministic safety/high-confidence 路径始终零调用，只有 ambiguous/contextual 请求才有资格进入真实模型；Verifier 只有在 RAG 证据通过 prompt injection、high-risk、credential material 等本地安全门且需要语义核验时才调用模型。两者共享每个 Chat request 的 `maxCalls=2`、`maxInputTokens=2400`、`maxOutputTokens=800` 预算，timeout 分别是 5 秒和 4 秒。Provider 使用 JSON-object mode，canonical Zod 仍是结构和安全语义权威；失败、timeout、schema invalid、预算耗尽或 abort 均回退到限制性 deterministic 结果。Trace/headers 只记录有界状态、固定 reason、usage 与降级元数据，不记录 prompt、query、chunk、provider output、raw error 或 credential。

### Phase 6.9.7 Tutor / WrongQuestionOrganizer 部署与 checkpoint 边界（Task 10--12 / V2 R7 / V3 R0--R5 / V4 R0--R6 / V5 R0--R6 / V6 R0--R5）

Tutor candidate 只在 Next `web` 的 `/api/chat` server runtime 中运行。Compose 只向 `web` 投影 `TUTOR_AGENT_MODEL_ENABLED`、固定 3000ms timeout 与 `TUTOR_AGENT_DEEPSEEK_API_KEY`；`server`、`worker`、`admin` 不接收。独立 key 不能由 `DEEPSEEK_API_KEY`、Review/Planner、Knowledge 或 Organizer key 替代。

真实 executor 只有在 `AI_PROVIDER_MODE=live`、`AI_ENABLE_LIVE_CALLS=true`、Tutor gate=true、`AI_BASE_URL=https://api.deepseek.com/v1`、独立 key 非空、价格/timeout 已知且请求 eligibility 安全时才创建。模型固定 `deepseek-v4-pro` non-thinking JSON、无 tools/retry；单请求预算 `1 call / 1200 input / 300 output`，硬 cap `0.006 CNY`，并与 Router -> Verifier 的共享预算隔离。非 Tutor final route、明确教学指令、不安全输入、abort 或任一配置失败都保持 zero-call；运行失败保留 deterministic Tutor strategy。

WrongQuestionOrganizer candidate 只在 Nest `server` 的 `SERVER_ROLE=api|both` 中运行。Compose 只向 `server` 投影 `WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED`、固定 5000ms timeout 与 `WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY`；`web`、`worker`、`admin` 不接收。真实配置固定 DeepSeek V4 Pro non-thinking JSON、无 tools/retry、`1 call / 3500 input / 800 output` 与 `0.016 CNY` cap；generic 或 Tutor key 都不能替代 Organizer key。worker 模块还会在代码层把 gate 强制为 false，Compose 隔离和运行时隔离缺一不可。

Task 10 只完成部署 allowlist、tracked example、角色隔离测试和回滚说明；它本身没有启动 Docker service、执行 API 或可见浏览器验收。日常开发必须保持两个 gate=false、两条 component key 空；不要把 `config --quiet` 或 Mock 解释为真实模型可用性。Task 5/7/10 证据分别见 `docs/acceptance/phase-6-9-7-tutor-web-runtime.md`、`docs/acceptance/phase-6-9-7-wrong-question-organizer-runtime.md` 与 `docs/acceptance/phase-6-9-7-runtime-boundaries.md`。

Task 11 已在不读取 credential、不调用 provider、不启动产品 Docker/API/浏览器的前提下完成分支 focused/full/static、fresh strict Mock、Organizer PostgreSQL E2E、Compose quiet config 与残留检查。Mock 的 `quality_gate_failed` 是 Live-only authority 预期结果，不能通过修改本节配置把它变成产品验收。该 checkpoint 的历史证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-agents.md`。

Task 12 唯一 V1 Live 已在进程级把现有底层 secret 映射到两个 component-specific 变量；CLI/runtime 仍只读取组件变量，没有让 generic key 绕过能力边界，也没有修改根 `.env`。run `39a62241...` 的 zero-call、安全、延迟、usage 和费用门通过，但 strict runtime 为 `27/48`，Tutor/Organizer semantic `0.3485119048/0.7`，最终 `quality_gate_failed`。V1 marker/evidence 不得删除或重跑；按合同没有启动/重建 Docker service、调用产品 API、打开浏览器或创建 synthetic 数据。历史权威记录见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-controlled-live.md`。

V2 R0--R6 后执行的唯一 R7 run `67ce18dd...` 保持 `24/24` guard zero-call，但 48 个 runtime 全部在结构化对象前 `fallback_runtime_error`，最终 `0/48` strict runtime、semantic `0/0`、verified usage `0`、`quality_gate_failed`。V2 evidence/marker 已封存且不得重跑；原始异常未保存，不能把失败指定为 credential、网络、模型、endpoint 或 prompt 的单一问题。按合同没有启动 R8 Docker/API/browser。当前继续保持两个 gate=false、component key 空。

V3 R1 已完成 failure/stage 投影、真实 invocation recorder 与 zero-network compatibility harness；
V3 R2 已新增 guard-first、首个 runtime contract failure 熔断、固定 48 runtime 分母、双 lane 独立
abort/预算/故障归属、单 dispatch ledger 与 sibling orphan 有界收口。V3 R3 又新增独立 CLI、一次性
marker、dispatch-before-call hash-chain journal、活 owner/recovery claim、zero-network seal 与
hard-link evidence。V3 R4 已完成 fresh Mock、breaker/failure report、分支全量静态门、PostgreSQL
E2E、历史不可变性与独立复审。唯一 V3 R5 run `ff2e1a54...` 保持 `24/24` guard zero-call，但在
第 14 对 Organizer `subject_authority_violation` 后熔断，最终 `27/48` strict runtime、
Tutor/Organizer semantic `0.5280555556/0.4376201923` 与 `quality_gate_failed`；marker/journal/evidence
已封存且不得重跑。开发者可以用下面的命令重放 R1--R4 静态合同；测试只使用
sentinel/fake fetch/Mock，不读取根 `.env` 或真实 key，也不会启动 Docker：

```powershell
bun test packages/agent/tests/model-candidate-runtime-result.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-v3-contract.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-v3-runner.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-v3-durability.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-paired-runner.test.ts packages/ai/tests/model-agent-v3-zero-network-compatibility.test.ts
```

R3 CLI 已注册 `eval:phase-6-9-7:v3:mock|live|seal|validate`。其中 V3 `live` 一次性名额已由 R5
消费，严禁再次执行；完整 run 已有 `evidence_sealed`，也不得再用 `seal` 改写。设计见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v3-remediation-design.md`，R1--R4 证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r1-diagnostics-compatibility.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r2-breaker-lane-ledger.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r3-crash-safe-evidence.md` 与
`docs/acceptance/2026-07-25-phase-6-9-7-tutor-organizer-v3-r4-static-mock.md`；R5 失败 authority 见
`docs/acceptance/2026-07-25-phase-6-9-7-tutor-organizer-v3-controlled-live-failure.md`。

V4 R0--R5 已完成且都为 zero-network。产品 Tutor/Organizer candidate 的 prompt identity 分别是
`tutor-model-candidate-v4` 与 `wrong-question-organizer-model-candidate-v4`，但 tracked gates 仍为
`false`；两条 V4 路径各自从一份深冻结 policy 派生 formatter、validator、merger 和本地不变量。
历史 paired eval 则显式调用 Tutor/Organizer V2 policy，以保持 V2 prompt bytes、V3 prompt SHA 和
已封存 evidence 不变。不要用历史 V1/V2/V3 CLI 试跑 V4，也不要把 V2 candidate 接回产品 runtime。

R4 已新增与 72-case authority 隔离的 independent robustness fixtures，以及独立 V4 runner/report、
CLI/validator、marker/journal/recovery/evidence durability。下面的回归命令只使用 Mock/synthetic
executor 和临时目录，不读取 `.env`、不创建网络 executor、不启动 Docker：

```powershell
bun test packages/agent/tests/phase-6-9-tutor-v4-semantics.test.ts packages/agent/tests/tutor-model-contract.test.ts packages/agent/tests/tutor-model-candidate.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-baseline.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-v3-contract.test.ts
bun test packages/agent/tests/phase-6-9-wrong-question-organizer-v4-semantics.test.ts packages/agent/tests/wrong-question-organizer-model-contract.test.ts packages/agent/tests/wrong-question-organizer-model-candidate.test.ts packages/agent/tests/phase-6-9-wrong-question-organizer-v2-robustness.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-v2-prompt-leakage.test.ts
bun test packages/agent/tests/phase-6-9-tutor-wrong-question-v4-independent-robustness.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-v4-lineage.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-v4-durability.test.ts
bun run --cwd packages/agent eval:phase-6-9-7:v4:mock
bun run --cwd packages/agent typecheck
```

R5 fresh Mock run `c1bdf998-6fae-4c32-a4e3-bd6bea053454` 为 `24/24` verified zero-call、`48/48`
strict runtime、Tutor/Organizer/combined semantic `1/1/1`，P95 `246/328/328/276ms`、usage
`21948/5647`、estimated `0.099726 CNY`；`mock_synthetic` provenance 使 Live-only gate 按设计保持
`quality_gate_failed`。Agent/AI/Types/Server/Web 全量、Organizer PostgreSQL E2E `12/12`、Compose
default-off、历史 SHA/validator、V4 artifact=0、测试账号零残留与两路终审均通过。完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r5-static-mock.md`。

R5 当时的 `eval:phase-6-9-7:v4:live` 在 R6 前硬返回 `live_not_available_before_r6`；后续用户已重新
确认 DeepSeek retention/training 边界并精确授权唯一一次 V4 branch run。Run
`0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f` 已 durable seal 为 `quality_gate_failed`：`24/24` guard
zero-call、6 对完成、12 executor started、`10/48` strict runtime；第 6 对 Tutor 命中
`invalid_evidence_association`，Organizer sibling attempted-aborted 且 usage unknown，剩余 36 runtime
因 breaker 未启动。完整费用与 P95 均保持 `null`。

V4 一次性名额已经消费，禁止再次运行 `eval:phase-6-9-7:v4:live`，也不得删除/覆盖/重建 marker、
journal 或 evidence。R7--R9 产品 Docker/API/可见浏览器、Task 13/main、Phase 6.10 与博客收尾均不得
开始。若继续，只能先新建与 V1--V4 双向隔离的零 Provider remediation；它必须有新的 runner、
授权变量、marker/journal/evidence/validator identity，并先完成新的 static/Mock checkpoint。禁止
`docker compose down -v`、Docker prune、container/image/volume 删除、database reset、Redis flush
或 MinIO wipe。完整失败证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-controlled-live-failure.md`。

V5 R0 已在不读取 `.env`、不调用 Provider、不启动 Docker 的条件下定位根因。下面命令只运行 exact
fixture/product-candidate/diagnostic 差分回归：

```powershell
bun test packages/agent/tests/phase-6-9-tutor-wrong-question-v5-root-cause.test.ts
```

预期为 `7 pass / 0 fail / 34 expect()`。它证明 V1 `tutor-runtime-06` 同时含中文代数 latest text、
英文微积分 active context 与错误 `en` tag；也证明合法 `submitted_step` 会由产品 candidate 应用，
缺 primary/错误 evidence 才由同一 candidate 拒绝，V4 diagnostic 只是映射拒绝结果。

该测试不是 V5 Mock/Live，也不允许运行任何 V4 Live 命令。V5 R1 已新增独立
`phase-6.9-tutor-wrong-question-v2` dataset/coherence、冻结 policy 与 deterministic baseline。下面命令
仍然不读取 credential 或调用 Provider：

```powershell
bun test packages/agent/tests/phase-6-9-tutor-wrong-question-v2-cases.test.ts
bun run --cwd packages/agent eval:phase-6-9-7:v5:baseline
```

预期聚焦测试为 `8 pass / 346 expect()`；baseline 固定 `12/48` complete，Tutor/Organizer/combined
semantic 为 `0.6629642857/0.278125/0.4705446429`。Dataset/policy/baseline SHA 分别固定为
`42803d45...b437b`、`b3913403...f009d`、`0ce7c3ca...116ca`。

V5 R2 也保持 zero-provider。下面命令验证 Tutor local-signal authority、三字段 bounded candidate、32 条
independent fixture 与冻结 V2 的 24 条 Tutor runtime 对照，不会读取 credential 或发起网络请求：

```powershell
bun test packages/agent/tests/tutor-v5-local-signal-authority.test.ts
```

预期为 `12 pass / 0 fail / 859 expect()`。Rules/prompt/held-out SHA 分别固定为
`a1e9a3b...f4892`、`7c7442ff...c5f87`、`d08e8ed5...8ab55`。该命令使用注入式 Mock/no-network
runtime，只证明本地 authority、contract 与安全边界，不是 Provider、Docker/API/browser 或产品验收。

V5 R3 同样保持 zero-provider。下面命令验证 Organizer owner-snapshot shortlist、ordinal-only contract、
local merger、24 条 independent fixture、冻结 V2 的 32 个 Organizer decision，以及
reorder/分页/去重/ABA/stale/cross-subject 边界，不会读取 credential 或发起网络请求：

```powershell
bun test packages/agent/tests/wrong-question-organizer-v5-shortlist.test.ts
```

预期为 `13 pass / 0 fail / 469 expect()`。Shortlist rules/model prompt/held-out SHA 分别固定为
`9747383...1299d3`、`915084a8...ac69ab`、`49336b12...ee097`。该命令使用注入式
Mock/no-network runtime，只证明 package authority、contract、budget/abort/stale 与写隔离，不是
Provider、Docker/API/browser 或产品验收。

V5 R4 继续保持 zero-provider，新增原生 V5 report/runner/CLI/marker/hash-chain journal/hard-link
evidence/validator 与 crash-only recovery。下面命令只运行 synthetic/no-network runner 与临时目录
durability 测试；不会读取 `.env`、创建 Provider executor、启动 Docker 或写业务数据：

```powershell
bun test packages/agent/tests/phase-6-9-tutor-organizer-v5-runner.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v5-durability.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v5-lineage.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v5-cli.test.ts
bun run --cwd packages/agent typecheck
```

预期 R4 聚焦结果为 `26 pass / 0 fail / 145 expect()`。V5 report 固定 `72 cases / 24 guards /
48 runtime / 24 pairs / 32 Organizer decisions`；24 guard 先行、单 pair 调度、pair 内最多双 lane，首个
runtime contract failure 后熔断。Dispatch journal 必须在 Provider 前 append+fsync；marker、journal 或
evidence 发布失败会消费一次性名额，恢复只允许 seal，不允许 resume/replay/retry。Usage、latency 或
semantic 样本不完整时聚合值保持 `null`。测试注入的 `synthetic_test` Live 永远不能通过质量门；只有
后续真实 CLI 自建的 `deepseek_network` provenance 才可能成为质量 authority。

R4 没有接产品 composition/gate、Provider、Trace persistence、Docker/API/browser，也没有创建 V5 Live
artifact。后续 R5 static/Mock checkpoint 已完成，仍为 zero-provider。设计、计划与 R1--R5 证据见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v5-remediation-design.md`、
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v5-remediation.md` 与
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r1-dataset-authority.md`、
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r2-tutor-local-signal-authority.md`、
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r3-organizer-ordinal-shortlist.md` 与
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r4-runner-lineage.md` 与
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r5-static-mock.md`。

V5 R5 的公开 Mock 入口使用正式源码 reviewed factory；它不会读取 `.env`、创建 Live marker 或调用真实
Provider：

```powershell
bun --filter @repo/agent eval:phase-6-9-7:v5:baseline
bun --filter @repo/agent eval:phase-6-9-7:v5:mock
```

Fresh baseline 预期 `12/48` complete、semantic
`0.6629642857/0.278125/0.4705446429`；fresh Mock 预期 `24/24` zero-call、`48/48` strict runtime、
semantic `1/1/1`，gate 为 `mock_quality_not_evidence`。Mock 报告中的 48 次 invocation 是 synthetic
executor 计数，不是真实 Provider call；output/cost 为 0 也不代表真实模型 token/账单。

R5 完成后，用户已重新确认当前 DeepSeek 数据保留/训练边界并精确授权唯一一次 V5 branch
controlled-Live。根 `.env` 的通用 key 只在授权进程内映射为两个 component-specific 变量，未打印、
写盘或进入 artifact。唯一 run `aa637d3a-f7c4-4549-a724-9cdbefdd89c8` 为 `24/24` guard
zero-call、12 次 Provider invocation、`11/48` strict runtime；第 6 对 Tutor
`tutor-v2-runtime-06` 在 `3021ms` 越过冻结 `3000ms` timeout 后打开 breaker，后续 36 runtime 未启动，
最终 `quality_gate_failed`。正式 semantic/P95/token/总费用聚合均为 `null`。

V5 R6 一次性名额已消费。严禁再次运行 V5 network CLI，严禁删除、覆盖或重建 V5 marker、journal、
evidence，也不得使用 seal/recovery 去 resume、replay 或补跑 Provider。日常开发仍保持 mock、live=false、
Tutor/Organizer gate=false、component key empty；产品 Docker/API/browser 未开始。该终态当时只允许先做
零 Provider 复盘与独立版本设计，不能进入 V5 R7、Task 13/main、Phase 6.10、Phase 8/9 或博客收尾。
完整失败证据见
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v5-controlled-live-failure.md`。

V6 R0--R4 后续已完成且均为 zero-provider：设计、source contracts、package 级 bounded candidates、独立
runner/CLI/lineage/durability contract 与 reviewed static/Mock checkpoint 已落地。不要把 V5 CLI 改参数后
当成 V6，也不要手工创建 `v6` Live artifact。V6 policy 已冻结 Tutor executor hard timeout `3500ms`
与 Tutor candidate P95 `<=2500ms`
的独立含义；Organizer 继续 `5000/4500ms`。每类 P95 必须恰好 24 个样本并取升序第 23 个值；任一
lane 不完整时四个 P95 全为 `null`。R3 runner 已接入 `3500/5000ms` deadline contract，但仍没有把
V6 timeout/candidate 接入产品 executor/composition。

R3 的安全本地复验入口不会读取 `.env` 或创建仓库真实 artifact：

```powershell
bun test packages/agent/tests/phase-6-9-tutor-organizer-v6-runner.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v6-durability.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v6-lineage.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v6-cli.test.ts
bun --filter @repo/agent typecheck
bun --filter @repo/agent lint
```

R4 已注册正式 baseline/Mock 入口；两条命令不会读取 credential 或调用 Provider：

```powershell
bun --filter @repo/agent eval:phase-6-9-7:v6:baseline
bun --filter @repo/agent eval:phase-6-9-7:v6:mock
```

Fresh baseline 应保持 `12/48`、semantic `0.6629642857/0.278125/0.4705446429`；fresh Mock 应为
`24/24` zero-call、`48/48` strict runtime、semantic/model-owned `1/1/1`，gate 固定为
`mock_quality_not_evidence`。Mock 命令会输出本次 `runId` 与精确 evidence path；复验结束只能删除该
Mock 文件，不得清空 `.tmp`。48 次 invocation、正 output token、本机 P95 与 `0 CNY` 都是 synthetic
工程证据，不是 Provider 调用、网络 P95 或账单。

唯一 V6 R5 branch controlled-Live 已按 run `b18a0a13-a2a0-4cb0-8f9c-296271c0dfa8` 执行并
`quality_gate_failed`：`24/24` guard zero-call、2 次 Provider invocation、`0/48` strict runtime；首个
Tutor 为 `provider_runtime / unknown`，Organizer sibling aborted，正式 semantic/P95/token/CNY 全部为
`null`。Evidence/marker/journal 已 seal，bundle validator `ok=true`，无 recovery claim。

V6 一次性名额已消费。严禁再次运行 `v6:cli -- live ...`、手工 curl/单 case/产品 API 探测、删除或
覆盖 marker/journal/evidence、调用 seal/recovery 做 replay，也不得进入 R6 产品 Docker/API/浏览器或
R7/main。日常开发继续保持 mock、live=false、Tutor/Organizer gate=false、component key empty；不要
清空 `.tmp`，不要 prune、`down -v`、reset、flush 或 wipe。设计、计划与 R3--R5 验收见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v6-remediation-design.md` 与
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v6-remediation.md`、
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r3-runner-lineage.md` 与
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r4-static-mock.md`、
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v6-controlled-live-failure.md`。

V7 R0 已完成零 Provider transport-remediation 设计，但尚未实现任何 V7 runtime、CLI、script、env、
marker、journal 或 evidence 入口。当前不要尝试运行猜测出来的 `v7` 命令，也不要把
`PHASE_6_9_7_V7_CONTROLLED_LIVE_APPROVED` 写入根 `.env`。R0 的“继续”只允许下一原子任务 R1 实现
第一方 DeepSeek V4 Pro direct adapter 与 zero-network tests。

R1--R3 的本地验证必须使用 synthetic fetch delegate 和 sentinel credential，不读取根 `.env`，不访问
网络。V7 wire contract 将固定区分：

```text
executor_entered
  -> request_validated
  -> provider_dispatch_started
  -> provider_response_received
  -> response_audit_passed
  -> content_parsed
  -> schema_validated
  -> usage_validated
```

同时分别报告 executor invocation、provider dispatch、provider response 与 verified usage。Dispatch hook
必须在 fetch delegate 前 append + fsync；hook 失败时 synthetic delegate 必须保持 0-call。阶段事件只保存
固定枚举，不保存 request/response/error/body/header/prompt/model output 或 key。R3 除专门验证最终兜底的
case 外出现非预期 `unknown` 时必须停止，不得申请 Live。

V7 设计和当前停止门见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v7-remediation-design.md`、
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v7-remediation.md` 与
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r0-zero-provider-postmortem.md`。只有 R3
static/Mock/fault-matrix 全门通过、分支 clean/pushed 且用户重新精确授权后，未来 R4 才能创建唯一 V7
Live artifact；R5 产品 Docker/API/可见浏览器与 R6 main 回放继续逐级阻断。

### Phase 6.9.5 Review / Planner 模型建议配置

Review / Planner 只在 Nest Server 的 suggestions 编排中使用模型，不能由浏览器参数、Chat 模式切换或 worker 启用。两个组件各自有独立 gate，日常开发和 Docker 默认均保持 `false`；只设置 `AI_PROVIDER_MODE=live` 或 `AI_ENABLE_LIVE_CALLS=true` 不会绕过它们。

Docker `web` 继续显式接收 Chat、Router、Verifier 的服务端 provider allowlist，保证既有 `/api/chat` Live 验收不会因迁移而变为 503；但 Review/Planner 的 gate 与 timeout 只投影给 `server`，不会投影给 `web` 或 `worker`。因此不要把 Review/Planner 变量添加到 `NEXT_PUBLIC_*`、Docker build args、web environment 或 worker environment。

在本机执行无凭据回归时，只设置数据库/JWT 等测试必需配置，并确保没有注入 `AI_PROVIDER_MODE`、`AI_ENABLE_LIVE_CALLS`、provider key、Review/Planner gate 或 timeout。通过静态门后可运行本地 Mock（不会创建 provider executor）：

```powershell
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
bun --filter @repo/agent eval:review-planner -- --mode mock --out ".tmp/phase-6-9-5-live-diagnostic-mock-$stamp.json"
```

Mock 只能得到 `mock_quality_not_evidence`，不能开启 gate。controlled-Live 必须遵循 `docs/acceptance-checklist.md` 的单诊断、单次运行和证据规则；不要把 key 写进命令历史、文档、截图或 Git。

### Phase 6.9.6 KnowledgeDedup / Organizer 模型建议配置

Knowledge 两个 candidate 只在 Nest `server` 的 owner-scoped suggestions 编排中运行。Compose 仅把 `KNOWLEDGE_AGENT_DEEPSEEK_API_KEY`、两个独立 gate 和两个 4500ms timeout 投影给 API server；worker/web/admin 都不接收这些变量。独立凭据可以由 secret manager 与其它 DeepSeek 能力引用同一个底层 secret，但变量名和能力边界必须分开，不能借用 `DEEPSEEK_API_KEY` 或 `REVIEW_PLANNER_PRODUCT_DEEPSEEK_API_KEY`。

真实候选必须同时满足 `AI_PROVIDER_MODE=live`、`AI_ENABLE_LIVE_CALLS=true`、对应 Knowledge gate=true、精确无凭据 DeepSeek HTTPS base URL、有效独立凭据、已知价格、owner snapshot eligibility 与可证明的冻结 reservation。Dedup/Organizer 可单独开启和回滚；两个候选共享 `2 calls / 6000 input / 1200 output`，单请求最坏 `0.0252 CNY`，硬 cap `0.03 CNY`，SDK 不自动重试。任一条件失败都回到只读本地建议。

controlled-Live 只允许使用合成账号和合成资料，必须先获得新的明确授权，并先记录/接受供应商账号的数据保留和训练设置；本地清理不能声称删除供应商日志。验收结束必须清空当前进程的 Knowledge credential、恢复 `AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false` 和两个 Knowledge gate=false，只精确清理本轮 synthetic 数据。禁止执行 `docker compose down -v`、Docker prune、volume/database reset、Redis flush 或 MinIO wipe。

Phase 6.9.4.4 Task 8 当时只把 Router/Verifier 变量显式传入 Docker `web` runtime；`web` 不使用根 `.env` 的 `env_file`，也没有把凭据放进 build args 或 `NEXT_PUBLIC_*` 客户端变量。Review/Planner gate 与 timeout 不属于 Web allowlist，只由 `server` 消费。Phase 6.9.4.3 additional P95 `4264ms` 是当时的历史延迟 verdict，不是永久禁止 Router 模型的产品决定；后续 Task 9/10 已完成 controlled-Live、Docker、可见浏览器和 main 复验，并恢复两个 gate 默认关闭。权威架构路线见 `docs/superpowers/specs/2026-07-15-phase-6-9-agent-architecture-completion-design.md`；这不代表 Memory、Orchestrator、其余 Agent 或 Phase 6 已完成。

`/agent-trace` 的 `AI 模式` 开关只切换最终 Chat 流式回答的 Mock / Live 请求模式，不会替 Router/Verifier/Tutor 打开 Agent runtime gate。仅设置 `AI_ENABLE_LIVE_CALLS=true` 时，若 `AI_PROVIDER_MODE` 仍为 `mock` 或对应组件 gate 仍为 `false`，Agent 候选路径仍不会调用真实模型。

Phase 6.9.4.4 Task 9 的受控 Docker Live 必须在未跟踪的根 `.env` 中临时同时提供完整运行条件。下面只列非敏感值；还必须通过根 `.env` 或受控 secret 注入与所选 provider 匹配的有效 key，例如 DeepSeek 使用 `DEEPSEEK_API_KEY`、OpenAI 使用 `OPENAI_API_KEY`，但不要把 key 值复制到命令、终端输出、日志或文档：

```env
AI_PROVIDER_MODE=live
AI_ENABLE_LIVE_CALLS=true
AI_MODEL=deepseek-v4-flash
AI_BASE_URL=https://api.deepseek.com
ROUTER_MODEL_ENABLED=true
KNOWLEDGE_VERIFIER_MODEL_ENABLED=true
ROUTER_MODEL_TIMEOUT_MS=5000
KNOWLEDGE_VERIFIER_MODEL_TIMEOUT_MS=4000
```

只验收一个组件或独立 rollback 时，只把当前目标组件 gate 设为 `true`，另一个保持 `false`。`AI_MODEL`、HTTPS provider base URL 与安全注入的 key 必须互相匹配。根 `.env` 仅是下列 Compose 命令的插值输入；Compose 再将解析后的明确 Web allowlist 注入 `web`。修改后只重建精确的 `web` service：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --force-recreate web
```

验收结束后必须把当前 PowerShell 与本地 env 恢复为 `AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`、`ROUTER_MODEL_ENABLED=false`、`KNOWLEDGE_VERIFIER_MODEL_ENABLED=false`、`TUTOR_AGENT_MODEL_ENABLED=false`、`WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED=false`、`REVIEW_AGENT_MODEL_ENABLED=false`、`PLANNER_AGENT_MODEL_ENABLED=false`、`KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED=false`、`KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED=false`，并清空临时 Tutor、WrongQuestionOrganizer 与 Knowledge credential，保留 5000/4000、3000、5000 与 4500/4500 timeout。Router/Verifier/Tutor 属于 `web` runtime，Review/Planner、Knowledge 与 WrongQuestionOrganizer 属于 Nest `server` runtime；恢复后精确重建并探测 `web server`，不能只重建其中一个：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --force-recreate web server
```

只验收 Review/Planner、Knowledge 或 WrongQuestionOrganizer 时只需重建 `server`。不要运行会打印完整解析内容的 `docker compose config`，不要输出 env 文件或 key；静态解析只能使用本节前述 `config --quiet`。

Docker Web 容器内部访问后端使用 `PREPMIND_INTERNAL_API_BASE_URL=http://server:3001`，浏览器访问后端仍使用 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001`。这两个地址不要混用：前者解决容器内 `/api/chat`、`/api/dev/ai-mode` 校验登录态，后者给浏览器页面访问本机后端。

### Phase 6.9.5 产品验收与关机收口

Phase 6.9.5 已完成真实模型分支验收和 main default-off replay。V10 是唯一语义质量 authority；V22 的 `operation_failed -> recovered` 与 V11--V21 历史均不可重跑、不可恢复或拼接。下列命令保留为后续同类阶段的 main replay 模板：先提交并复验分支，`git switch main`，`git merge --no-ff <branch>`，再确认当前 branch/HEAD 为 `main`。只有随后才可执行 Docker 重建；全程禁止开启 Review/Planner 或 live-call gate，也禁止执行任何 V19/V20/V21/V22 accept/recover 命令。

```powershell
$env:AI_PROVIDER_MODE = 'mock'
$env:AI_ENABLE_LIVE_CALLS = 'false'
$env:REVIEW_AGENT_MODEL_ENABLED = 'false'
$env:PLANNER_AGENT_MODEL_ENABLED = 'false'
$env:REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED = 'false'
$env:REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS = '0'
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d --build --no-deps server web
curl.exe -fsS http://127.0.0.1:3001/health
```

每次重建后都要读取 `/review-agent/suggestions` 的 `modelObservations`，确认 Review/Planner 都是 `not_eligible / local_deterministic`，不存在 live usage/Trace。不要把 gate 或 key 写入命令行、日志、文档或截图。

合并 main 后不重跑已经消费的 paired lineage；只重新读取 V10/V22 与分支验收 evidence，完成静态/构建、Docker default-off、可见浏览器和精确 synthetic cleanup replay。

若用户要求验收后关机，必须先完成：精确删除本轮合成账号/业务记录/Trace 和浏览器 storage；清除当前 PowerShell 的 Live/eval/gate/key；重建 default-off `server`；关闭 headed 浏览器、Playwright、本地 Bun 与辅助进程；确认 Git clean 且本地/远程 main SHA 一致。最后只使用：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker stop
```

`stop` 保留容器、镜像、network、PostgreSQL/MinIO volume 与所有数据。关机收口禁止 `down`、`down -v`、prune、container/image/volume 删除、数据库 reset、Redis flush 或 MinIO wipe。
