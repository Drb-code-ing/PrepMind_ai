# PrepMind 本地启动与运维

这份文档只保留当前可执行的启动、配置、验证和排障步骤。旧阶段的逐次命令与回执已移到
[`docs/archive/dev-start-history.md`](archive/dev-start-history.md)，不能用来判断当前状态。

## 1. 前置条件

- Windows、PowerShell、Bun `1.3.14`、Docker Desktop。
- Docker Compose 提供 PostgreSQL + pgvector、Redis 和 MinIO；宿主 PostgreSQL 端口约定为 `5433`。
- 不提交 `.env`、`.env.local`、token 或模型 key。根目录 `.env` 仅用于本机配置和 Compose 插值。

首次配置：

```powershell
bun install
Copy-Item docker/.env.example .env
```

Mock 开发无需真实 Provider key。把本地 RAG 设置为 `fake`，或按第 4 节配置真实 Qwen。

## 2. 启动基础设施

```powershell
$env:POSTGRES_PORT = '5433'
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d postgres redis minio
docker compose --env-file .env -f docker/docker-compose.dev.yml ps
```

推荐本机连接串：

```text
postgresql://prepmind:devpass@127.0.0.1:5433/prepmind
```

首次启动或 schema 有变化时，先生成 client 并部署迁移：

```powershell
$env:DATABASE_URL = 'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun run db:generate
bun run db:migrate
```

已有数据卷缺少已提交迁移时，只运行 `prisma migrate deploy`；禁止 `migrate reset`、`down -v`、删除 volume、Redis flush
或 MinIO wipe。Docker 数据卷必须保留。

## 3. 日常开发

终端 A，启动 API：

```powershell
$env:DATABASE_URL = 'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET = 'dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER = 'fake'
bun run dev:server
```

终端 B，启动学习端：

```powershell
bun run dev
```

可选管理员端：

```powershell
bun run dev:admin
```

入口：

| 服务              | 地址                                              |
| ----------------- | ------------------------------------------------- |
| 学习端            | <http://127.0.0.1:3000>                           |
| API health        | <http://127.0.0.1:3001/health>                    |
| Swagger           | <http://127.0.0.1:3001/api-docs>（非 production） |
| Admin             | <http://127.0.0.1:3100>                           |
| MinIO API/Console | <http://127.0.0.1:9000> / <http://127.0.0.1:9001> |

登录验收时，前端和 API 统一使用 `localhost` 或统一使用 `127.0.0.1`，避免 cookie/CORS host 不一致。

## 4. RAG 配置

### Mock/无 key

```powershell
$env:RAG_EMBEDDING_PROVIDER = 'fake'
$env:KNOWLEDGE_PROCESSING_MODE = 'inline'
```

`fake` 只用于非 production 开发和自动测试，不可作为语义召回质量证据。

### Qwen 真实 embedding

```powershell
$env:RAG_EMBEDDING_PROVIDER = 'qwen'
$env:RAG_EMBEDDING_MODEL = 'text-embedding-v4'
$env:RAG_EMBEDDING_DIMENSIONS = '1536'
$env:RAG_EMBEDDING_BASE_URL = 'https://<your-workspace>/compatible-mode/v1'
$env:QWEN_API_KEY = '<local-secret>'
```

production 必须显式提供 provider、model、无凭据的 HTTPS base URL、1536 dimensions 和规范 `QWEN_API_KEY`；缺少或不匹配时
在 Provider 调用前 fail-closed，不在 Qwen/OpenAI/fake 之间自动 fallback。宿主兼容输入 `Qwen_API_KEY` / `DASHSCOPE_API_KEY`
会在 Compose 内规范化为 `QWEN_API_KEY`。

### Queue 模式

`inline` 是默认处理模式。需要验证 BullMQ 时，确保 Redis 已启动并显式设置：

```powershell
$env:REDIS_URL = 'redis://127.0.0.1:6379'
$env:KNOWLEDGE_PROCESSING_MODE = 'queue'
$env:SERVER_ROLE = 'both'
bun run dev:server
```

进程角色：

| `SERVER_ROLE` | 行为                                              |
| ------------- | ------------------------------------------------- |
| `api`         | 只提供 HTTP API，不注册 BullMQ processor          |
| `worker`      | 只创建 Nest application context，不监听 HTTP 端口 |
| `both`        | 本地一体化，同时提供 HTTP 和 worker               |

拆分验证：两个终端分别使用 `SERVER_ROLE=api` 与 `SERVER_ROLE=worker`。Docker Compose 的 `server` 固定为 `api`，独立
`worker` 承担队列、Outbox Dispatcher 和维护 processor。

## 5. Docker 全栈

需要验证 Worker、Admin 或容器内 Next standalone 时：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build `
  postgres redis minio minio-init server worker web admin
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker exec server `
  sh -lc "cd /app/packages/database && bun prisma migrate deploy"
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker ps
```

`migrate deploy` 只应用仓库中尚未执行的增量迁移，不得改成 `migrate reset`。保留旧 volume 启动新代码时必须先执行；若迁移发生在
`server/worker` 已启动之后，再用 `docker compose ... restart server worker` 让长驻进程重新建立干净连接。

`worker` healthcheck 使用容器内的 `bun apps/server/dist/scripts/worker-readiness.js`。查看状态和日志：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker ps
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker logs --tail 120 server worker minio-init
```

Docker Desktop 在中文路径下遇到已知 Bake gRPC shared-key 错误时，只在当前 PowerShell 设置
`$env:COMPOSE_BAKE='false'`，按服务分别 build，再使用 `up -d --no-build`；不要清理 build cache、容器或卷。

## 6. Chat 与 Agent 模式

日常默认保持：

```text
AI_PROVIDER_MODE=mock
AI_ENABLE_LIVE_CALLS=false
所有组件 MODEL_ENABLED=false
```

真实模型必须同时满足全局开关、组件 gate、匹配凭据、HTTPS allowlist、预算、超时、结构化 schema 和安全 eligibility。组件 gate
包括 Router、KnowledgeVerifier、Tutor、Retriever query rewrite、FinalResponse、Review、Planner、KnowledgeDedup 和
KnowledgeOrganizer；具体变量和预算见 [`phase-6-agent-runtime-audit.md`](acceptance/phase-6-agent-runtime-audit.md)。

`/api/chat` 先完成认证/owner 绑定，再按 bridge gate 分流：

```text
PREPMIND_CHAT_TURN_BRIDGE_ENABLED=false
  -> Router/Tutor -> Retriever -> KnowledgeVerifier -> FinalResponse stream

PREPMIND_CHAT_TURN_BRIDGE_ENABLED=true + conversation ready
  -> POST /chat-messages/prepare -> POST /chat-turns -> 202 handoff
```

首轮没有 conversation id 时仍走兼容路径以建立会话。bridge 开启后无效消息窗口或 admission 失败会 fail-closed，不静默回退同步
Provider。模型只产生 bounded candidate；owner、权限、业务事实、写命令和最终安全边界由本地代码掌握。

Chat response worker 当前是 `deterministic-worker-v1`，用于验证 claim、幂等、重试和 durable terminal commit，不要把它说成真实模型。
详见 [`phase-6-chat-response-worker.md`](acceptance/phase-6-chat-response-worker.md)。

Chat Stream 传输层已提供两个只读、JWT 保护的恢复入口：

```text
GET /chat-turns/:turnId
GET /chat-turns/:turnId/events?cursor=<redis-stream-id>&limit=100
```

事件回放是 bounded Redis Stream（默认 `256` 条、`512 KiB`、`24 h` TTL）。`transport=unavailable` 或 `cursorState=expired` 时，
客户端必须读取第一个状态接口；PostgreSQL 的 turn/assistant response 才是权威。当前 `/api/chat` 已返回 turn handoff，但浏览器尚未
主动调用这两个入口或接入 SSE。实现和 focused 证据见
[`phase-6-chat-stream-replay.md`](acceptance/phase-6-chat-stream-replay.md) 与
[`phase-6-chat-turn-api-bridge.md`](acceptance/phase-6-chat-turn-api-bridge.md)。

## 7. 常用验证

代码与 package：

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e       # 需要 Docker PostgreSQL
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
git diff --check
```

后台链路：

```powershell
bun --filter @repo/server readiness:worker
bun --filter @repo/server smoke:rag-eval
```

`readiness:worker` 是部署前机器检查，退出码 `0=ready`、`1=degraded/not_ready`、`2=异常或超时`；它不会启动完整 App 或打印
连接串、payload、prompt、chunk、key、token。`smoke:rag-eval` 要求 queue 模式，检查 `BackgroundJob=SUCCEEDED`、hybrid mode、
`keywordScore`/`vectorScore` 和无重复 `chunkId`。

Chat Stream focused 回归：

```powershell
bun --filter @repo/server test -- --runInBand chat-turns
bun --filter @repo/server test -- --runInBand config/swagger.spec.ts
```

ChatTurn Web adapter 与 product bridge focused 回归（不需要 Provider）：

```powershell
node --experimental-transform-types --test `
  apps/web/src/lib/api-client.test.mts `
  apps/web/src/lib/chat-turn-api.test.mts `
  apps/web/src/lib/chat-message-api.test.mts `
  apps/web/src/lib/chat-turn-bridge.test.mts `
  apps/web/src/lib/chat-turn-handoff-response.test.mts `
  apps/web/src/lib/chat-turn-handoff.test.mts
bun --filter @repo/server test -- --runInBand chat-messages
```

这些回归证明 bounded request、append-only prepare、严格 `202`、handoff 隔离和 abort/offline 分类；仍需 Docker/可见浏览器证明
真实 `useChat` 消费时序。即使该验收通过，也不证明浏览器已经具备 SSE/断线恢复。

Agent focused eval、controlled-Live 和产品验收只能运行对应 acceptance 文档明确的入口；历史一次性授权不可复用。

## 8. Prisma 与观测

```powershell
bun run db:status
bun run db:studio
```

`db:studio` 和 `db:status` 从仓库脚本读取根 `.env`，比在 package 目录直接运行裸 Prisma CLI 更不容易连错库。

只读观测入口：

- `/health`：API liveness。
- `/worker-readiness`：机器可读的 worker readiness（受 gate 保护）。
- `/worker-observability/summary`：队列、heartbeat、Outbox 的脱敏开发观测。
- `/outbox-events`、`/operator-audit-logs`：受 gate 和权限保护的运维查询。

这些接口都不得暴露 payload、prompt、RAG chunk、模型回答、API key、token、cookie 或原始错误。

## 9. 停止与清理

优先停止进程或使用：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker stop
```

不得执行：

- `docker system prune`、`docker compose down -v`、volume 删除；
- `prisma migrate reset`、数据库全量清空；
- Redis `FLUSHDB` / `FLUSHALL`、MinIO wipe；
- `git clean -fdx` 覆盖本地配置或用户文件。

阶段验收只精确清理本轮创建的合成账号、记录、对象和浏览器 storage，并在验收文档记录范围。浏览器验收默认使用 headed
窗口并保持可见，非必要不要关闭窗口。

## 10. 相关文档

- [`docs/project-status.md`](project-status.md)：当前项目快照
- [`docs/acceptance/phase-6-agent-runtime-audit.md`](acceptance/phase-6-agent-runtime-audit.md)：Agent 矩阵与缺口
- [`docs/roadmap.md`](roadmap.md)：当前路线
- [`docs/data-flow.md`](data-flow.md)：数据流
- [`docs/acceptance-checklist.md`](acceptance-checklist.md)：功能验收清单
- [`docs/ai-behavior-acceptance.md`](ai-behavior-acceptance.md)：AI 行为验收规则
- [`DEVLOG.md`](../DEVLOG.md)：历史事实与回执
