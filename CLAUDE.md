# PrepMind AI - 协作上下文

本文件只提供兼容入口；完整协作规则以 [`AGENTS.md`](AGENTS.md) 为准。每次开始工作先读：

1. [`docs/project-status.md`](docs/project-status.md)
2. [`docs/acceptance/phase-6-agent-runtime-audit.md`](docs/acceptance/phase-6-agent-runtime-audit.md)
3. 按任务需要读取 [`docs/dev-start.md`](docs/dev-start.md)、[`docs/data-flow.md`](docs/data-flow.md) 和对应验收文档

## 当前快照

- 最新原子任务完成了 ChatTurn/BackgroundJob/Outbox -> BullMQ 的 deterministic Worker durable baseline。
- Phase 6 Agent 运行时审计仍在进行；graph 是 `catalog_only`，Tool-Using Orchestrator 尚未实现。
- 默认 `AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`、所有组件 gate=false。
- MemoryAgent 目前生成确定性候选；分层记忆和记忆自动注入后置。
- 真实模型、Mock、controlled-Live、产品 smoke 和 production-used 必须分级描述，不能互相替代。

## 常用命令

```powershell
bun install
Copy-Item docker/.env.example .env
$env:POSTGRES_PORT = '5433'
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d postgres redis minio
$env:DATABASE_URL = 'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun run db:generate
bun run db:migrate
bun run dev:server
bun run dev
```

代码验证：

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
git diff --check
```

## 不可违反的边界

- 普通任务使用 `drb/*` Git 分支、一任务一提交、推送分支、`--no-ff` 合并 main、推送 main、合并后复验；默认不使用 worktree。
- 不执行 `docker system prune`、`down -v`、volume 删除、数据库 reset、Redis flush 或 MinIO wipe；只精确清理本轮合成数据。
- 不提交 `.env`、key、token、cookie、用户正文、完整 prompt/回答或 Provider 原文。
- 以下用户文件保持原样，不得暂存或提交：
  `apps/server/src/wrong-question-organizer/wrong-question-organizer-agent-trace.ts`、
  `apps/server/src/wrong-question-organizer/wrong-question-organizer.service.spec.ts`、
  `apps/server/src/wrong-question-organizer/wrong-question-organizer.service.ts`。
- 真实浏览器验收默认 headed 且窗口保持可见，非必要不要关闭。

## 模块边界

```text
web -> server（HTTP，不直接 import）
server -> database, ai, fsrs, rag, agent, mcp, types
agent -> ai, fsrs, rag, mcp, types
rag -> database, ai, types
```

`packages/` 不得依赖 `apps/`；API contract 优先放在 `@repo/types` 的 Zod schema。Agent 只消费 owner-bound、bounded projection，
本地代码掌握身份、权限、业务事实和写操作。
