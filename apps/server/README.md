# PrepMind AI Server

这是 PrepMind AI 的 NestJS 后端应用，负责认证、业务 API、Chat/Agent composition、RAG、后台任务和运维观测。它不是独立模板项目；从仓库根目录按 monorepo 脚本启动。

## 先读文档

- [当前状态](../../docs/current-status.md)：阶段、authority、R5 准入和禁止动作。
- [分支关系](../../docs/branch-map.md)：功能分支、main 合并与回放证据。
- [本地启动](../../docs/dev-start.md)：Docker、环境变量、数据库和服务启动。
- [数据流](../../docs/data-flow.md)：API、Agent、RAG、BackgroundJob、Worker 和 Outbox 边界。
- [统一验收](../../docs/acceptance-checklist.md)：接口、浏览器、worker 和精确清理。

## 启动

在仓库根目录执行：

```powershell
bun install
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
bun --filter @repo/server start:dev
```

默认 API 地址为 `http://127.0.0.1:3001`（以当前环境日志为准）。Swagger 在非 production 受配置控制，不能绕过鉴权。

## 运行角色

| 角色                 | 作用                                                      | HTTP       |
| -------------------- | --------------------------------------------------------- | ---------- |
| `SERVER_ROLE=api`    | Nest HTTP app、REST、health、Swagger                      | 监听       |
| `SERVER_ROLE=worker` | application context、BullMQ processor、BackgroundJob 更新 | 不监听     |
| `SERVER_ROLE=both`   | 本机一体化开发便利模式                                    | 监听并消费 |

Compose 验收使用 `api + worker` 拆分；`both` 只用于本机快速开发，不代表容器生产拓扑。

## 常用命令

```powershell
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
```

数据库 e2e 通常要求 PostgreSQL 在 `127.0.0.1:5433`、Redis 和 MinIO 已运行。环境不满足时记录 `environment_blocked`，不要用 `prisma migrate reset` 或 `docker compose down -v` 清理环境。

## 边界规则

- `apps/server` 可以依赖 `packages/*`，`packages/*` 不得依赖 `apps/server`。
- Agent package 不读取 API key；真实 executor 只能在 server-only composition root late-bind。
- API 以当前 canonical owner 做鉴权和数据隔离；模型不能决定 owner、事实、FSRS、写权限、citation 或 terminal。
- Chat/Agent gate 默认关闭。Mock/fake 通过不代表真实模型或产品可用；controlled-Live 需要单独的数据边界接受和 exact authorization。
- 验收只允许精确清理本轮合成数据；禁止删除 Docker volume、flush Redis、wipe MinIO 或追加 Provider 探测。
