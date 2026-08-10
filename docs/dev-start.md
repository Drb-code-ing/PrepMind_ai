# PrepMind 本地启动命令

> 适用于 Windows PowerShell。本地开发数据库使用 Docker PostgreSQL + pgvector。
> 如果你想按功能验收而不是只启动项目，先看 `docs/acceptance-checklist.md`。

## 当前 Schema Recovery SR5 Live 入口与 proxy 修复（zero-provider，2026-08-10）

SR5 Live 首次入口在 proxy 前门以 `proxy_preflight_not_ready` fail-closed，未读取 credential、未调用 Provider、未创建正式 evidence。
修复提交 `b531adef` 已以 merge=`671188bb` 合并并推送 main；修复后的 focused 回归为 `11/11`（39 assertions），功能分支在新 Live admission
前仍需快进到该最终 main。
本节只验证生产形状入口与前门，不执行真实模型。Live 固定 `8 guards + 6 rewrite pairs + 6 FinalResponse`、DeepSeek
`12` + Qwen `12`（共 `24` slots）、最大并发 `1`、pair-serial、预算 `37,600/8,800/0.176 CNY`，禁止 retry/resume/replay/backfill。

安全的 help/validate/recover 路径不会加载 `.env` 或 credential；package script 显式使用 `bun --no-env-file`。唯一 RUN
参数必须同时满足最终 source/tag parity、正式 evidence namespace=0、loopback/direct proxy preflight、当次数据边界和 exact
authorization；只有这些前门通过后才会 selective-read 根 `.env` 的三个 SR5 credential。不要在 source/main parity 收口前运行
RUN，也不要把本轮旧授权复用到新 source。

```powershell
bun run --cwd packages/agent eval:phase-6-9-8:schema-recovery:sr5:live -- --help
bun run --cwd packages/agent eval:phase-6-9-8:schema-recovery:sr5:live:validate
bun run --cwd packages/agent eval:phase-6-9-8:schema-recovery:sr5:live:recover
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live.test.ts
```

当前预期是 help 成功、validate/recover 在无正式 bundle 时 fail-closed，focused Live `11/11`（39 assertions）。这些命令
`providerCalls=0 / credentialReads=0 / formalEvidence=0 / businessWrites=0`，不创建正式 marker/journal/report/artifact，
不启动或清理 Docker/PostgreSQL/Redis/MinIO/API/browser。完整实现回执见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-implementation-zero-provider.md`；proxy accessor 修复回执见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-proxy-snapshot-fix-zero-provider.md`。

### 历史 Schema Recovery SR5 runner/durability 入口（zero-provider，2026-08-10）

当前普通分支为 `main`。功能分支
`drb/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner` 已以 `--no-ff` 合并为 `b2b5b9c9`，合并后二次
zero-provider 回放通过。本入口运行固定 `8/6/6` reviewed-Mock runner，并验证 source-bound reservation、hash-chain journal、
hard-link artifact、strict validator 与 crash-only recovery。approved tag 尚未创建，真实 source gate 与 provider dispatch
关闭，不读取 `.env`/credential。

```powershell
bun run --cwd packages/agent eval:phase-6-9-8:schema-recovery:sr5:runner -- --help
bun run --cwd packages/agent eval:phase-6-9-8:schema-recovery:sr5:runner
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner*.test.ts
bun run --cwd packages/agent typecheck
bun run --cwd packages/agent lint
git diff --check
```

CLI help 与 focused `25/25`（82 assertions）回归应显示 `providerCalls=0`、`credentialReads=0`；CLI run 的 runtime 应为
`12/12/12/12` wire、`12/0/0` succeeded/failed/notStarted，gate=`schema_recovery_mock_quality_not_evidence`，
`qualityAuthority=none`。临时 evidence 会在临时 root 清理，正式 namespace 保持 `0`。完整回执见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-durability-zero-provider.md`。这不是
controlled-Live，不启动项目浏览器，不创建正式 evidence。

### 上游 SR5 admission contract（zero-provider）

如需只读检查 source/tag/bundle 准入合同，使用：

```powershell
bun run --cwd packages/agent eval:phase-6-9-8:schema-recovery:sr5:admission -- --help
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.test.ts packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr5-source-admission.test.ts
```

旧 approved tag 只绑定修复前 source，当前修复 source 的 tag parity 预期 fail-closed；该命令不读取 `.env`、不调用 Provider、不创建正式
marker/journal/report/artifact/recovery claim，也不授权 controlled-Live。回执见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-admission-zero-provider.md`。

## 历史 Schema Recovery SR4 reviewed Mock 入口（zero-provider，2026-08-09）

历史普通分支为 `main`（SR4 功能分支已以 `--no-ff` 合并并推送远程）；SR4 固定
`8 guards + 6 rewrite + 6 FinalResponse`
与 `12` 次 candidate invocation，最大并发 `1`，每 lane single dispatch、首错 breaker；它真实穿过 Retriever、bounded
schema parser、synthetic Qwen port、evidence projector、FinalResponse、local merger 与 SR3 runner。

安全回放（只使用内存/OS 临时目录，结束自动清理）：

```powershell
bun --cwd packages/agent eval:phase-6-9-8:schema-recovery:sr4:mock
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr4-reviewed-mock.test.ts
```

默认结果为 guards `8/8`、runtime `12/12/12/12`、schema `4 canonical + 2 extension discarded + 0 rejected`、
FinalResponse strict `6`、节点计数 `18/6/6/6/6`、synthetic Qwen port `18`；gate=
`schema_recovery_mock_quality_not_evidence / qualityAuthority=none`。focused `11/11`（99 assertions）、组合 `74/74`（734
assertions）、Agent full `1488/1488`、AI full `345/345`、Types `42/42 + tsc`、Web `487/487` 与 Server build 已通过。

SR4 全程 `providerCalls=0 / credentialReads=0 / businessWrites=0 / formalEvidence=0`，不读 root `.env`、不调用
DeepSeek/Qwen、不启动或清理 Docker/PostgreSQL/Redis/MinIO/API/browser、不写 Trace/BackgroundJob/Outbox/业务数据。
SR4 不是真实模型质量、产品 `/api/chat`、P95/SLA 或 `main` authority；未来 SR5 必须重新接受当次数据边界并给出 exact
authorization。

## 历史 Schema Recovery SR3 入口（zero-provider，2026-08-09）

历史普通分支为 `drb/phase-6-9-8-retriever-final-response-schema-recovery-sr3`，历史基线
`main == origin/main == 849af1c84231a4c0fbe54426ddae02d0a1b28a30`。SR3 固定 `8 guards + 6 rewrite + 6 FinalResponse`
与 `12` 次 candidate invocation，最大并发 `1`；已实现 source admission、strict runner、hash-chain durability、hard-link
publication、validate 与 crash-only recover/seal CLI。authority=
`zero_provider_retriever_final_response_schema_recovery_runner_durability / qualityAuthority=none`。

安全回放（默认在临时目录，结束自动清理）：

```powershell
bun --cwd packages/agent eval:phase-6-9-8:schema-recovery:sr3
bun --cwd packages/agent eval:phase-6-9-8:schema-recovery:sr3:validate
bun --cwd packages/agent eval:phase-6-9-8:schema-recovery:sr3:recover
```

`validate`/`recover` 针对当前仓库没有正式 SR3 bundle 时会 fail-closed；不要为了让它通过而创建或修改正式
evidence。SR3 全程不读 root `.env`、不调用 DeepSeek/Qwen、不启动/清理 Docker、PostgreSQL、Redis、MinIO、API、browser，
不写 Trace/BackgroundJob/Outbox/业务数据。合并前验收命令与证据见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr3-zero-provider-runner-durability.md`。当前回归计数为 focused
`15/15`（49 assertions）、SR1+SR2+SR3+Task 9B 组合 `63/63`（635 assertions，14 files）、Agent full `1477/1477`
（24908 expect()，189 files）、AI full `345/345`（2662 expect()）。

## 历史 Schema Recovery SR2 入口（zero-provider，2026-08-09）

P1 L2 唯一 controlled-Live 已失败封存，SR0/SR1/SR2 已合并并推送；历史 SR2 merge 为
`17ce07ba386f3a54eb4fdfffdf050b561c319754`，不是当前 main HEAD。SR2 功能分支为
`drb/phase-6-9-8-retriever-final-response-schema-recovery-sr2`。SR2 使用
`reviewed_mock/mock/mock` 合成 runtime，不读取根 `.env`/credential，不调用 Provider，不启动 Docker/API/browser，也不执行
任何 `live`、`controlled`、`seal`、`recover`、`replay` 或 `backfill` 命令。实现、计划、验收见：

```text
docs/superpowers/specs/phase-6-9-8-retriever-final-response-schema-recovery-design.md
docs/superpowers/plans/phase-6-9-8-retriever-final-response-schema-recovery.md
docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr0-zero-provider-design.md
docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr1-zero-provider-tdd.md
docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr2-zero-provider-robustness.md
```

SR2 只允许执行 focused/全量 zero-provider tests、typecheck/lint/Prettier、`git diff --check`、精确新 namespace 扫描和
git parity；不得读取真实 credential 或执行网络。SR2 fixture 覆盖 `5` held-out、`24` Provider-like shape、`7` fault、
`4` metamorphic case，bounded diagnostic 只存在于 candidate outcome sidecar，Retriever node 会在产品边界丢弃；不要把历史
`.tmp` 文件计入新 lineage，也不要为了验收清理 Docker、数据库、Redis 或 MinIO。

```powershell
bun --filter @repo/agent eval:phase-6-9-8:schema-recovery:sr2
bun test packages/agent/tests/retriever-schema-recovery-contract.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr2-provider-robustness.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr2-runtime-metamorphic.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr2-fault-runner.test.ts `
  packages/agent/tests/retriever-query-rewrite-model-candidate.test.ts `
  packages/agent/tests/retriever-node.test.ts
bun --filter @repo/agent test
bun --filter @repo/ai test
bun run --cwd packages/agent typecheck
bun run --cwd packages/agent lint
```

当前 SR2 focused 回执为 `12/12`（329 assertions）；组合回执为 `43/43`（743 assertions），Agent full 为
`1462/1462`（24841 expect()，184 files），AI full 为 `345/345`。
这些命令均使用 in-memory synthetic runtime，不读取 `.env`、不调用 Provider，也不产生正式 evidence。SR2 只解锁 SR3；
未来 controlled-Live 必须重新接受当次 DeepSeek/Qwen 数据边界并取得绑定新 source 的 exact authorization。

## 历史 Transport Evidence Recovery 入口（T3 已失败封存）

T3-A 的 zero-provider admission/runner 已完成；唯一 T3 controlled canary
`075e2d5f-682b-426d-847e-f5a6ce5b97c6` 已在 late-bound credential gate 以
`transport_evidence_t3_controlled_canary_failed` durable seal。planned/started/completed=`3/0/0`、
Provider/credential=`0/0`、journal `7`、validator `ok=true`，authority=`controlled_live_transport_evidence_t3 / qualityAuthority=none`。
失败属于 CLI/configuration 边界，不能归因 Provider 根因；一次性名额已消费，不得重跑或追加探测。
详细证据见 `docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-controlled-canary-failure.md`。
T3-C configuration guard 已验证 package/root `.env` 路径与 seal CLI 的静态边界，不读取真实 `.env`。

T3-A 本身只运行 zero-provider admission/runner，不读取 `.env` credential、不调用 DeepSeek/Qwen、不启动 Docker/API/browser，
也不创建正式 marker/journal/artifact。它验证 source parity、T2 gate、fresh proxy nonce、三槽位顺序、预算和首错
breaker。

```powershell
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-transport-evidence-t3-admission.test.ts
bun --filter @repo/agent test
bun --filter @repo/agent typecheck
bun --filter @repo/agent lint
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-transport-evidence-t3-configuration.test.ts
```

受控 package script 已固定从包目录显式加载仓库根 `.env`：

```powershell
bun --env-file=.env --filter @repo/agent eval:phase-6-9-8:transport-evidence:t3:controlled
```

该命令只适用于未来另立 lineage 且重新授权的 canary；本次 T3 已消费，严禁执行。已提供
`eval:phase-6-9-8:transport-evidence:t3:seal`，只用于封存尚未发布的 crash-only 配置/中断前缀，不能恢复或重放已发布 run。
只读复核使用：

```powershell
bun --filter @repo/agent eval:phase-6-9-8:transport-evidence:t3:validate
```

不要使用 `docker compose down -v`、删除 volume、数据库 reset、Redis flush 或 MinIO wipe。

## 0. 先看这里：Prisma Studio、数据库和管理员账号

本项目本地开发默认使用 Docker PostgreSQL，宿主机访问端口是 `5433`：

```text
postgresql://prepmind:devpass@127.0.0.1:5433/prepmind
```

如果你只是想打开 Prisma Studio 看数据，推荐在项目根目录运行：

```PowerShell
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
长期真实账号；验收结束后删除这两个测试账号及其 refresh token。若 KEEP\_DATA=true，先按终端输出的
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
由验收人员预先准备，不属于脚本 cleanup，验收结束后要另行删除。只有排障时才把 KEEP\_DATA 设为
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

### e2e 提示 DATABASE\_URL / JWT\_SECRET undefined

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

### Phase 6.9.7 Tutor / WrongQuestionOrganizer 部署与 checkpoint 边界（Task 10--12 / V2--V9）

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

V7 R0--R3 已完成 transport-remediation 设计、第一方 DeepSeek V4 Pro direct adapter、wire
diagnostics、独立 runner/CLI/lineage/durable evidence、完整 fault matrix 与 reviewed static/Mock。唯一 V7
R4 branch controlled-Live run `81529c2c-79f5-4c21-9cee-e536a2fe78e3` 随后已执行并
`quality_gate_failed`：`24/24` guard zero-call；首对 Tutor 完成 8-stage success，Organizer 在收到
response、完成 JSON parse 后于 `provider_type_validation` 失败；最终 wire `2/2/2/1`、strict
`1/48`，正式 semantic/P95/token/CNY 全为 `null`。Evidence/marker/journal 已 seal，bundle validator
`ok=true / filesChecked=1`，无 recovery claim。

V7 一次性名额已经消费。严禁运行
`bun --filter @repo/agent eval:phase-6-9-7:v7:live`，也不得手工创建/修改 marker/journal/evidence、调用
`v7:seal`/recovery、把 `PHASE_6_9_7_V7_CONTROLLED_LIVE_APPROVED` 写入根 `.env`，或通过 curl、单
case、另一 CLI、产品 API 做追加 Provider 探测。R5 产品 Docker/API/可见浏览器与 R6 main 回放被
阻断；日常开发继续保持 mock、live=false、Tutor/Organizer gate=false、component key empty。

V7 wire contract 固定区分：

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

同时分别报告 executor invocation、provider dispatch、provider response 与 verified usage。R1 adapter 会
在 fetch delegate 前等待 dispatch hook；hook 失败时 synthetic delegate 保持 0-call。R2 已把该 hook 接入
append queue + 文件 fsync 的 durable journal，并冻结 `lane_reserved -> wire stage -> runtime/pair terminal ->
breaker/run completion -> evidence seal` 顺序。阶段事件只保存固定枚举，不保存 request/response/error/body/
header/prompt/model output 或 key。Recovery 只封存 durable prefix，不创建 adapter、不读取 key，也不
resume/replay/retry Provider。

当前 durability 只保证单机文件级顺序：没有父目录 fsync，不证明突然断电后的目录项持久；PID/file
fencing 不是跨主机 lease，single dispatch/no retry 也不构成 Provider exactly-once。R3 fault matrix 已
证明预期 transport/HTTP/response/schema/usage faults 没有落入非预期 `unknown`，stage/counter 与
no-leak 门通过；这仍不证明 Provider 已收到请求或真实模型质量。

R3 可安全回放的命令只有 no-network baseline/Mock/tests 与静态门；不要把 mode 改成 `live`：

```powershell
bun test packages/agent/tests/phase-6-9-tutor-organizer-v7-runner-contract.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v7-durability.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v7-cli.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v7-lineage.test.ts packages/agent/tests/phase-6-9-tutor-organizer-v7-fault-matrix.test.ts
bun --filter @repo/agent eval:phase-6-9-7:v7:mock
bun --filter @repo/agent typecheck
bun --filter @repo/agent lint
```

`v7:mock` 会创建本次 Mock evidence；验证后只能按 stdout 给出的精确 path 删除该文件，不得清空
`.tmp`。48 次 synthetic executor/dispatch/response/usage、synthetic token/P95/CNY 都不是 Provider
调用、真实网络性能或供应商账单。

V7 设计和当前停止门见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v7-remediation-design.md`、
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v7-remediation.md` 与
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r0-zero-provider-postmortem.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-v7-r1-zero-provider-adapter.md` 与
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r2-runner-lineage.md`、
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r3-static-mock.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-v7-controlled-live-failure.md`。V7 R4 已失败封存且不可
重跑。V8 R0--R5 已完成并失败封存，见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v8-remediation-design.md`、
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v8-remediation.md` 与
`docs/acceptance/2026-07-29-phase-6-9-7-tutor-organizer-v8-controlled-live-failure.md`。

V9 R0--R4 随后完成本地完整合法 option authority、exact `questionIndex + optionIndex` contract、
Provider-like/security/stale/write-authority robustness、独立 runner/lineage/durability 与 reviewed Mock。
唯一 V9 R5 run `c530ca02-3ece-4f11-898c-5695c8252bd5` 为 `24/24` guard、wire `2/2/0/0`、
strict `0/48`；Tutor 在 Provider response 前成为 `provider_runtime / transport`，Organizer sibling 为
`post_dispatch_abort`，正式 semantic/P95/token/CNY 全 `null`。Marker/journal/evidence 已 seal，validator
`ok=true/filesChecked=1`，无 recovery claim。完整终态见
`docs/acceptance/2026-07-30-phase-6-9-7-tutor-organizer-v9-controlled-live-failure.md`。

当前不得运行任何 V7/V8/V9 Live、seal/recovery、curl、单 case 或产品 API 探测；不得删除、覆盖或改写
V9 artifact，也不得启动 V9 R6 产品 Docker/API/浏览器或 R7/main。日常开发继续保持 mock、
live=false、Tutor/Organizer gate=false 与 component key empty。已有容器、镜像和卷保持不变，禁止 prune、
`down -v`、reset、flush 或 wipe。若未来改变产品路线，必须作为新的用户决策和独立阶段规划，不能通过
新 runner、marker 或版本号把它包装为 V9 retry。

V9 失败后已进入独立 Architecture Recovery，不再复制 V10/V11 式整套 Live runner。R1 新增
`first-party-deepseek-v4-pro-transport-diagnostic-adapter-v1`：它包装而不修改 sealed V1
direct adapter，只把 future fetch throw 在当前 adapter 内存中分为九个固定 subtype。公共
`providerFailureCategory=transport`、V1--V9 report/schema/validator/artifact 和产品 composition 均不变。
R1 未读取 credential、调用 Provider 或解封 V9；安全回放命令仅为：

```powershell
bun test packages/ai/tests/first-party-deepseek-v4-pro-transport-diagnostic.test.ts
bun --filter @repo/ai typecheck
bun --filter @repo/ai lint
```

注入 fetch 永久是 `synthetic_test`，上述命令不读根 `.env`、不发网络请求，也不创建正式
canary artifact。完整边界见
`docs/acceptance/2026-07-30-phase-6-9-7-architecture-recovery-r1-transport-diagnostics.md`。

R2 已完成独立 zero-network Provider health canary contract/runner。它不读取 env，也不允许调用方注入
fetch、transport、credential、URL 或 artifact path；`mock` 与 `fault-matrix` 都只使用模块内 closed
synthetic responder。日常安全回归命令为：

```powershell
bun test packages/ai/tests/phase-6-9-7-architecture-recovery-r2-canary-contract.test.ts packages/ai/tests/phase-6-9-7-architecture-recovery-r2-canary-runner.test.ts packages/ai/tests/phase-6-9-7-architecture-recovery-r2-canary-cli.test.ts
bun --filter @repo/ai eval:phase-6-9-7:recovery-r2:canary -- mock
bun --filter @repo/ai eval:phase-6-9-7:recovery-r2:canary -- fault-matrix
```

CLI 只接受精确的 `mock` 或 `fault-matrix` 单参数；`live`、`--mode live`、`--out`、重复或未知参数都
fail-closed。Mock `complete` 与 fault matrix `21/21` 的 authority 都是 `synthetic_test`，其中 token 是
合成响应值，不是 Provider telemetry；不能据此判断 DNS/TLS、代理、账号、余额、模型权限、服务端或
DeepSeek 健康。R2 没有正式 artifact writer、marker、journal、seal/recovery 或一次性 Live 授权消费。

不得自行给 R2 CLI 增加 Live 参数、读取根 `.env`、运行 curl/Provider、复用 V9 marker/evidence，或直接
启动 48-case、产品 Docker/API/browser 与 main 验收。R2 的历史 zero-network 证据见
`docs/acceptance/2026-07-30-phase-6-9-7-architecture-recovery-r2-provider-health-canary.md`。

R3 controlled-Live 已失败封存。日常安全回归仍只运行测试，不需要 approval 或 credential，也不得因为
回归通过而再次运行 Live：

```powershell
bun test packages/ai/tests/phase-6-9-7-architecture-recovery-r3-canary-contract.test.ts packages/ai/tests/phase-6-9-7-architecture-recovery-r3-canary-runner.test.ts packages/ai/tests/phase-6-9-7-architecture-recovery-r3-canary-durability-cli.test.ts
bun test packages/ai/tests/phase-6-9-7-architecture-recovery-r2-canary-contract.test.ts packages/ai/tests/phase-6-9-7-architecture-recovery-r2-canary-runner.test.ts packages/ai/tests/phase-6-9-7-architecture-recovery-r2-canary-cli.test.ts
```

历史上正式 R3 CLI 固定检查当前 branch、tracked worktree clean 和 `HEAD == @{u}`，并要求以下一次性条件；
当前授权已消费，下面的变量与参数不得再次用于执行：

- `PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CONTROLLED_LIVE_APPROVED=true`；
- 专用 `PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_DEEPSEEK_API_KEY`，不能借用通用或 Agent credential；
- 唯一参数 `I_AUTHORIZE_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CONTROLLED_LIVE_ONCE`；
- 固定 `5000ms`、一次 `1/512/16`、`0.00200000 CNY` hard cap、no retry/resume/replay。

首次旧授权 CLI 已完成 source/credential preflight，但 Windows 目录 URL 产生的默认 evidence root 带尾分隔符，
旧字符串围栏在 reservation 前误判越界。该进程 Provider invocation/dispatch=`0`，没有 marker/journal/claim/
artifact，也不适用 crash-only seal。实现现已使用 `resolve + relative` containment 并覆盖尾分隔符回归；旧 exact
confirmation 已使用且源码变化，不得复用。修复提交推送后取得的新 exact confirmation 也已由下述唯一 run
消费。公开 `runPhase697ArchitectureRecoveryR3CanaryCli` 只接受 input，内部固定 production ports；不能注入
fetch、transport、URL、model、writer 或 output path。

设计上只有正式尝试已创建 marker/journal 且进程中断时，独立确认词
`I_SEAL_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_INTERRUPTED_ATTEMPT_WITHOUT_PROVIDER` 可执行 crash-only
seal。它不读取 credential、不调用 Provider、不 retry/resume/replay，只从 durable prefix 封存
`not_dispatched / dispatched_no_response / response_observed`。`publication_started` 后任何 I/O failure
永久 fail-closed，不得再次 publish。当前 run 已正常到 `evidence_published`，不符合 seal 条件。

修复后的唯一 R3 canary 已由 run `253a5df5-c443-4950-b517-849efb941728` 消费并正常封存。不得再次设置
R3 approval/credential 或运行 Live/seal：artifact 为 `dispatched_no_response`，wire `1/1/0/0`，终态
`transport_failed / connection_refused`，usage/token/CNY 全 `null`；7 条 journal 已到 `evidence_published`，
无 recovery claim。

封存后的本地检查发现当前进程 HTTP(S) proxy 指向无监听的 loopback `127.0.0.1:7897`；该条件高度相关但
不是 sealed evidence 已证实的唯一根因。不得通过 curl、清空 proxy、单 case 或第二次 Provider 调用验证。
未观察到 HTTP Response 前，不启动小样本或 48-case。完整 R3 工程证据见
`docs/acceptance/2026-07-30-phase-6-9-7-architecture-recovery-r3-controlled-live-failure.md`。

### Phase 6.9.7 Architecture Recovery Proxy Preflight

独立 zero-provider preflight 已完成。它不接受参数、不读取根 `.env` 或任何模型 credential、不调用
`fetch`/Provider，也不创建 R3 或新的 marker、journal、artifact。CLI 只快照当前进程八个固定 key：
`NO_PROXY/no_proxy`、`HTTPS_PROXY/https_proxy`、`HTTP_PROXY/http_proxy`、`ALL_PROXY/all_proxy`。

```powershell
bun --filter @repo/ai diagnose:phase-6-9-7:recovery:proxy-preflight
```

可接受状态只有两种：

- 所有 proxy key 均 absent/空，返回 `direct_ready`；
- 所有已配置 proxy key 严格一致指向显式 `http://127.0.0.1:<port>` 或
  `http://[::1]:<port>`，且一次 250ms loopback TCP listener probe 成功。

`NO_PROXY` 非空、大小写/类型 proxy authority 冲突、URL 携带 credential、非 HTTP、非 loopback、
缺端口或非法端口、path/query/hash、控制字符与 hostile descriptor 都会 fail-closed。Listener probe 只建立
本地 TCP 连接，连接后立即销毁且不发送 payload；核心 runner 自己强制 250ms watchdog。Exit `1` 表示
环境前置条件不满足，不是 Provider 测试失败。

首次实际输出为 `loopback_proxy_unavailable / configuredProxyVariables=4 / listenerProbeCalls=1 /
providerCalls=0`。宿主 Clash Verge core 按既有配置恢复 listener 后，只重跑同一安全命令，fresh 输出为
`loopback_proxy_ready / configuredProxyVariables=4 / listenerProbeCalls=1 / providerCalls=0`。不要自动清空或
绕过 proxy，也不要通过 curl、DNS/TLS、单 case、产品 API 或第二次 Provider 调用补证。Ready 只证明当前
本地 listener 前置条件，不证明代理转发或 Provider health。R3 继续禁止
retry/resume/replay/backfill、Live/seal、删除/改写 artifact；原 R4、产品/main 与后续阶段仍被阻断。历史
preflight 证据见
`docs/acceptance/2026-07-30-phase-6-9-7-architecture-recovery-proxy-preflight.md`。

### Phase 6.9.7 Architecture Recovery Provider Canary V2

Provider Canary V2 D0/C1/C2/S1/L1 已完成。它不复用旧 R3/R4 approval、credential、confirmation、marker、
journal、artifact 或 recovery identity；阶段使用 D0/C1/C2/S1/L1/P1。C2 已新增固定 production CLI、
source、marker、hash-chain journal、artifact/validator 与 crash-only seal，S1 已完成 zero-provider 静态门。唯一
L1 run `dc09214c-0300-4153-8273-e548ac768d20` 已成功封存；其解锁的 P1 zero-provider 设计与后续 G1
contract/baseline、G2 one-shot runner/durability、S2 reviewed Mock/static 均已完成。其后唯一 L2 已在独立
source/tag admission、fresh 数据边界接受和 exact authorization 下完成并 durable seal；P2 full-gate design、
F1 full contract/baseline、F2 runner/durability/evidence 与 S3 reviewed Mock/static 均已 zero-provider 完成。
其后唯一 L3 已执行并以 `full_gate_quality_gate_failed / qualityAuthority=none` 正常封存；不得重跑，产品与
main 继续阻断。

C1 固定验收命令：

```powershell
bun --filter @repo/ai test:phase-6-9-7:recovery:provider-canary-v2:c1
```

该命令只接受内置 `fault-matrix` 路径，运行 15 个模块内 synthetic 场景；不会读取宿主 `.env`、模型
credential 或 source，不会创建 marker/journal/artifact，也不会构造 fetch/Provider transport。Fresh 结果为
`scenarioCount=15 / passed=15 / failed=0 / providerCalls=0`。不要给它追加 Live、URL、proxy、credential、
retry 或 output 参数；这些输入必须以 exit `1` 拒绝。

C2/S1 固定验收命令：

```powershell
bun test packages/ai/tests/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-contract.test.ts `
  packages/ai/tests/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-runner.test.ts `
  packages/ai/tests/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-durability.test.ts `
  packages/ai/tests/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-cli.test.ts
bun test packages/ai/tests/*architecture-recovery*.test.ts
bun --cwd packages/ai test
bun --cwd packages/ai typecheck
bun --cwd packages/ai lint
```

上述测试只使用系统临时目录、fake ports 与 closed synthetic transport；成功路径测试会创建临时
marker/journal/artifact 并精确删除，不创建项目根正式证据。Fresh 结果分别为 C2 `32/32`、Recovery
`91/91`、AI full `323/323`。

L1 实际按以下固定顺序完成：

```text
exact args
  -> snapshot only 8 proxy keys
  -> zero-provider preflight
  -> fixed branch + tracked clean + HEAD/upstream/remote parity
  -> read V2 dedicated approval/credential
  -> V2 marker + durable reservation
  -> one fact-free Provider dispatch / no retry
  -> bounded terminal + exclusive evidence
```

Preflight 失败时不能读取 credential、执行 source reader、创建 marker 或调用 Provider。Preflight ready 只生成
进程内 single-consume attestation，不保存 proxy URL/port，也不等于网络健康。C1/C2/S1 只使用 synthetic/
fake ports，全程 `providerCalls=0`。L1 在用户重新接受运行时数据边界并给出 exact authorization 后运行一次：
`complete / strict_response_with_verified_usage`，wire `1/1/1/1`，usage `49/5`，费用 `0.00017700 CNY`，
validator `ok=true`。Production 入口 `eval:phase-6-9-7:recovery:provider-canary-v2` 的名额已经消费，禁止再次
执行、retry/resume/replay/backfill 或 crash seal。

只读复核本地 sealed bundle 可使用：

```powershell
bun --no-env-file -e "import { validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle as validate } from './packages/ai/src/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-durability.ts'; console.log(JSON.stringify(await validate({ root: process.cwd() })));"
```

期望固定摘要为 `ok=true / evidenceCount=1 / runId=dc09214c... / journalRecords=12 /
finalJournalEvent=evidence_published / outcome=complete`。该命令只读本地 evidence，不读取 `.env` 或调用
Provider；不要添加 credential、Live 参数、output、recovery 或任何网络探测。

完整设计、计划与 D0 验收：

- `docs/superpowers/specs/phase-6-9-7-architecture-recovery-provider-canary-v2-design.md`；
- `docs/superpowers/plans/phase-6-9-7-architecture-recovery-provider-canary-v2.md`；
- `docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-d0-reentry-design.md`；
- `docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-c1-zero-network-contract.md`；
- `docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-one-shot-durability.md`；
- `docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-l1-success-diagnostic-only.md`。

P1/G1/G2/S2/L2 小样本设计、contract、durability 与 sealed evidence 入口：

- `docs/superpowers/specs/phase-6-9-7-tutor-organizer-p1-zero-provider-semantic-gate-design.md`；
- `docs/superpowers/plans/phase-6-9-7-tutor-organizer-p1-zero-provider-semantic-gate.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-p1-zero-provider-semantic-gate.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-g1-contract-baseline.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-g2-runner-durability.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-s2-reviewed-mock-static.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live.md`。

P2/F1/F2/S3 full-gate zero-provider 与唯一 L3 sealed evidence 入口：

- `docs/superpowers/specs/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate-design.md`；
- `docs/superpowers/plans/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-f1-full-contract-baseline.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-f2-runner-durability-evidence.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-s3-reviewed-mock-static.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-l3-controlled-live-quality-gate-failure.md`。

P1 冻结 4+4 guards、8 runtime pairs、manifest `ae667f1c...edf61`、deterministic subset baseline payload
`d36d0789...d9f4e`、quality/budget/lineage/authorization contract。G1 已新增唯一安全的 baseline 生成命令；它
只写 fixed ignored path，不读取环境变量、credential、Provider、Mock/Live 或 candidate：

```powershell
Set-Location packages/agent
bun run eval:phase-6-9-7:small-sample:baseline
bun test tests/phase-6-9-tutor-organizer-small-sample-g1.test.ts
```

首次输出只能是 `created`，相同 bytes 的重复检查为 `same_bytes`；冲突、symlink 或 parent/path identity 漂移
必须失败。固定 logical report SHA 为 `ad3aa54d...d002`，physical file SHA 为 `e8bcbcb5...658b`。不要把这条
命令当成 Mock/Live runner，也不要手工挑 case、调用 Provider 或复用 L1 confirmation。

G2 的本地 focused 验证只运行 synthetic fault matrix 和临时目录 durability，不读取 credential 或创建项目根
正式 L2 文件：

```powershell
Set-Location packages/agent
bun test `
  tests/phase-6-9-tutor-organizer-small-sample-cli-authority-g2.test.ts `
  tests/phase-6-9-tutor-organizer-small-sample-runner-g2.test.ts `
  tests/phase-6-9-tutor-organizer-small-sample-durability-g2.test.ts `
  tests/phase-6-9-tutor-organizer-small-sample-crash-lineage-g2.test.ts
bun run typecheck
bun run lint
```

Public production CLI 只接收 `args + AbortSignal`。唯一 L2 已完成，因此现在不得运行
`eval:phase-6-9-7:small-sample:live` 或 `eval:phase-6-9-7:small-sample:seal`。执行前 source gate 曾要求独立
L2 admission 创建并绑定专用 `phase-6-9-7-tutor-organizer-small-sample-s2-approved` tag；该 tag 现已固定在
实际运行 source commit `4c608445...c22af1c4`，不得移动或重建。Crash-only seal 只适用于未完成的
dead-owner attempt；已正常 `evidence_published` 的 run 禁止 seal/recovery。

G2 recovery 只为当前开放/待锚定 pair 补零-wire reservation 并立即 `attempted_aborted`，后续 pair 为
`not_started_quality_breaker`；这不是 resume/replay/retry，也不构造 harness/transport 或调用 Provider。外部父
请求取消统一为 `external_abort`，与 lane 内部 `abort` 分开。

S2 的安全本地复核命令只运行 reviewed synthetic fetch，不读取 `.env`/credential、不调用 Provider，也不创建
正式 marker/journal/artifact/recovery claim：

```powershell
Set-Location packages/agent
bun test tests/phase-6-9-tutor-organizer-small-sample-s2-reviewed-mock.test.ts
bun run typecheck
bun run lint
```

期望 focused 为 `35/35`。正常路径固定 `8/8` guard、`16/16` strict/wire/verified usage、semantic
`1/1/1`、gate `mock_quality_not_evidence`；fault matrix 还验证 25 类 transport/HTTP/response/schema/usage、
parent abort、single-dispatch/no-backfill 与 Tutor/Organizer `3500/5000ms` hard timeout。不要把 synthetic
token/费用或本机 median/max 写成 Provider 账单、P95 或产品延迟。

L1 与 L2 均已消费并完成，不得再次运行。L2 唯一 run
`6918df4f-a4ae-4de0-aa21-c7614ed5861d` 为 guard `8/8`、strict/wire/verified usage
`16/16/16/16`、Tutor/Organizer/Combined semantic
`0.9141666666666668 / 1 / 0.9570833333333334`、usage `7032/244`、费用 `0.02256 CNY`，最终
`small_sample_quality_gate_passed / small_sample_semantic_gate`。8-pair P95 仍为
`null / insufficient_sample_size_8`。

只读复核 sealed L2 bundle 可使用：

```powershell
bun run --cwd packages/agent eval:phase-6-9-7:small-sample:validate
```

期望摘要为 `ok=true / journalRecords=180 / finalJournalEvent=evidence_published / artifact
SHA=a1b51f05...eb0d`。该命令只读本地 bundle，不读取 credential、不调用 Provider，也不创建 recovery claim。
禁止 retry/resume/replay/backfill、单 case/网络追加探测、删除或改写 artifact。P2 已完成但只形成
`zero_provider_full_gate_design`；F1/F2 随后已把 full manifest/baseline/report/scorer/gate、安全 writer、固定
production CLI/source admission、完整 runner、durability 与 strict evidence validator 落地，authority 分别仅
`zero_provider_full_contract_baseline` / `zero_provider_full_runner_durability_evidence`。S3 随后已完成 reviewed
Mock/static，得到 `24/24` guard、`48/48` strict/wire/usage、semantic `1/0.996875/0.9984375` 与 anchor
`1/1/1`，但 authority 仍为 `full_gate_mock_quality_not_evidence / qualityAuthority=none`。唯一 L3 随后已在
approved source `3c5cc6c...` 上执行并正常封存：run `2b0ac3a0-631f-4c7f-9781-ce0cda94149a`，guard
`24/24`、runtime `22/22/0/26`、wire `22/22/22/21`、strict `21/48`；Tutor runtime 11 的 schema failure
打开 breaker。最终 `full_gate_quality_gate_failed / qualityAuthority=none`，semantic/P95/token/CNY 全
`null`。L3 不得重跑，产品、main 与 Phase 6.9.8 仍被阻断。

P2/F1 固定值为：dataset `72/24/48/24/32`，manifest `e68e6e27...12c78`，full baseline `12/48` 与
semantic `0.6629642857/0.278125/0.4705446429`，source baseline `0ce7c3ca...116ca`，baseline authority
`2ab1030f...a5f2`，logical report `16c574b1...2c9`，physical file `16aa1773...6f73`，eval policy
`11371d16...f503`。安全本地复核只运行 fixed F1 test、typecheck 与 lint：

```powershell
Set-Location packages/agent
bun test tests/phase-6-9-tutor-organizer-full-gate-f1.test.ts
bun run typecheck
bun run lint
```

Focused 期望为 `14/14`。测试只在系统临时目录验证 writer，并以 runtime fetch spy 证明调用次数为 0；不会读取
`.env`/credential、调用 Provider、创建 approved tag 或正式 marker/journal/artifact/recovery claim。不要运行任何
`live`/`seal` 命令、手工创建 full-gate `.tmp` 文件，或把 F1 的 Mock/schema pass 当成 48-case/产品质量证据。

F2 已完成后的安全本地复核命令为：

```powershell
Set-Location packages/agent
bun test tests/phase-6-9-tutor-organizer-full-gate-f1.test.ts `
  tests/phase-6-9-tutor-organizer-full-gate-cli-authority-f2.test.ts `
  tests/phase-6-9-tutor-organizer-full-gate-durability-f2.test.ts `
  tests/phase-6-9-tutor-organizer-full-gate-lineage-security-f2.test.ts `
  tests/phase-6-9-tutor-organizer-full-gate-runner-f2.test.ts
bun run typecheck
bun run lint
```

Focused 期望为 `32/32`，Agent full 为 `1108/1108`。这些测试只使用 synthetic/fault ports 与系统临时目录；
F2 authority 仅 `zero_provider_full_runner_durability_evidence`。

S3 的安全本地复核命令为：

```powershell
Set-Location packages/agent
bun test tests/phase-6-9-tutor-organizer-full-gate-s3-reviewed-mock.test.ts
bun run typecheck
bun run lint
```

Focused 期望为 `14/14`。正常结果固定 `24/24` guard、`48/48` strict/wire/verified usage、Tutor/Organizer/
Combined semantic `1/0.9968750000000001/0.9984375000000001`、L2 anchor `1/1/1`，但 gate 必须保持
`full_gate_mock_quality_not_evidence / qualityAuthority=none`。该测试只使用 synthetic fetch 和系统临时隔离
bundle；global fetch、credential 与 Provider 调用为 0。L3 source tag 现已固定在 `3c5cc6c...`，不得移动、
删除或重建。不要运行 `full-gate:live`、`full-gate:seal`、production CLI，也不要手工修改正式
marker/journal/artifact/recovery claim。

L3 现有 sealed bundle 的唯一安全入口是只读 validator：

```powershell
bun run --cwd packages/agent eval:phase-6-9-7:full-gate:validate
```

期望摘要为 `ok=true / runId=2b0ac3a0... / gate=full_gate_quality_gate_failed /
qualityAuthority=none / journalRecords=296 / finalJournalEvent=evidence_published / artifact
SHA=e081939b...dbe5`。该 validator 不读取 credential、不调用 Provider，也不创建 recovery claim。不要把
22 次 response、21 次 verified usage、S3 Mock 或 L2 小样本成功拼接为完整 full-gate pass。L3 失败证明与
停止门见
`docs/acceptance/phase-6-9-7-tutor-organizer-l3-controlled-live-quality-gate-failure.md`。

以下 Full-gate Schema Recovery SR0--SR5 记录属于 Phase 6.9.7 历史 lineage，不是当前 Phase 6.9.8 Retriever/FinalResponse SR5 admission；不得把该历史 Live 当作当前授权。

Full-gate Schema Recovery SR0--SR4 已完成 zero-provider 设计、TDD、robustness、独立 runner/durability 与
reviewed Mock/static。唯一 SR5 controlled-Live run `63f8a76b-1c2a-403d-b774-0235caae04cb` 已以
`schema_recovery_quality_gate_passed / schema_recovery_full_gate_semantic_gate` durable seal；strict/wire/usage
`48/48/48/48`，semantic `0.9736111111/0.9515968407/0.9626039759`，journal `628`、validator `ok=true`、
recovery claim=0。SR6 又在 `providerCalls=0` 边界完成 Tutor/Organizer 分支产品 Docker/API/可见浏览器/Trace/
forced-failure/权限隔离与精确清理；SR7 随后完成 main 合并、远程发布与 default-off Docker/API/可见浏览器/
Trace/清理，并补齐精确“这一步”Tutor 路由回归。全部 Agent/replay/Live gate 均保持关闭。SR5 一次性名额
已经消费。当前安全边界为：

- 不运行任何 `full-gate:live`、SR5 production CLI、`seal`、recovery、curl、单 case 或其它 Provider 探测；
- 不修改/移动/删除 L3 或 SR5 marker、journal、artifact、recovery claim 或 approved tag；
- 不再次启用 `PHASE_6_9_7_SR6_PRODUCT_REPLAY_ENABLED`，不重做 SR6 success/forced-failure replay，也不重复
  执行已经完成的 SR7 default-off Docker/API/browser 验收；
- 只允许读取当前源码与 sealed bundle、运行只读 strict validator；后续开发必须从最新 main 新开 Phase 6.9.8
  普通分支，不得借 SR7 名义调用 Provider；
- SR1--SR3 测试只使用 injected synthetic data/runtime 与系统临时目录，`globalThis.fetch=0`、credential
  read=0、formal
  artifact=0；
- SR1 已实现 exact-schema raw parser、有界 Provider envelope、canonical `intentIndex` projection、strict
  projected decision、bounded no-raw diagnostic 与一次性 V6 candidate seam；contract SHA 为
  `e2453faeb077faa76ab018a038790cd5a7e73f617be800c0958c098361511579`；
- SR2 fixture SHA 为 `43248bfa...0d41e`；prompt-only responder 覆盖 24 个 Tutor runtime、18 个 Provider
  shape、5 个 held-out、fault/abort 与 F2 sibling/breaker，不读取 expected/oracle 或 L3 raw；
- SR3 使用独立 `schema-recovery-v1` report/runner/source/CLI、schema-stage hash-chain journal、hard-link
  artifact、strict validator 与 crash-only recovery；source manifest SHA 为 `1a811394...adfbb`；
- SR3 crash-only recovery 只解释 durable prefix，不创建 executor、不 retry/resume/replay/backfill；公共 CLI 只
  允许 bundle validation 或 crash-only seal；
- SR4 reviewed Mock factory SHA 为 `8f18c1c2...3d44`，固定结果为 `48/48` strict/wire/usage、schema
  `42 canonical + 6 extension discarded`、semantic `1/0.996875/0.9984375`，但 gate 仅
  `schema_recovery_mock_quality_not_evidence / qualityAuthority=none`；
- SR5 approved source/tag 固定在 `67661f5f...d4441`，不得移动；正式 `.tmp` 文件恰好为一个 marker、一个
  journal 和一个 branch artifact；
- SR6 replay 绑定 physical artifact SHA `87dd826b...18be`，但只依据当前 bounded Tutor V6 / Organizer V9
  prompt 生成 deterministic Mock output；不读取或逐字重放 SR5 Provider response/Trace，不增加 semantic
  authority；
- SR6 产品验收已完成：Tutor `/api/chat`、Organizer single/batch、Trace/Mock 计费、forced failure、owner/
  locked-name/write isolation、可见浏览器、精确清理与最终源码 Docker/default-off 均通过；
- SR7 main/default-off 验收已完成：Organizer 为 `local_deterministic/gate_disabled` 且不创建 Trace；精确 Tutor
  step-check 为 `route=tutor / step_check / attempted=false / 0 token / LIVE_CALLS_DISABLED`，Trace 为 Mock、成本
  0；两个合成账号、tracked Outbox 与浏览器业务数据 residue=0；
- Phase 6.9.7 已完成。Phase 6.9.8 Task 0--9B 工程地基也已完成；Task 8 只形成
  `zero_provider_retriever_final_response_reviewed_mock_static / qualityAuthority=none`。固定 48-case 的 guard、rewrite、
  FinalResponse 均 `16/16`，Provider/credential/Qwen 与正式 marker/journal/evidence/recovery 均为 0；两个模型 gate
  仍 default-off，同步流不创建 BackgroundJob/Outbox。Task 7 数据库 E2E 的 Redis/PostgreSQL
  `environment_blocked` 历史不由 Task 8 倒写为通过。Task 9A 只冻结 Qwen 北京区 official
  price/endpoint/usage 与 strict direct transport。Task 9B 又固定 16 guard + 64-call runner、Qwen/DeepSeek 各 32
  次独立 accounting、source admission、durability/validator/CLI；Reviewed Mock gate 仍为
  `task9b_mock_quality_not_evidence / qualityAuthority=none`，Provider/credential/approved tag/正式 evidence 当时全为
  0。唯一 Task 9C run `28b5f92f...` 随后已正常 durable seal：guard `16/16`，Provider `5/64`，Qwen
  `3/3/3/3`、DeepSeek `2/2/1/1`；第二条 DeepSeek rewrite 在 dispatch 后以
  `schema_invalid / wire 1/1/0/0` 失败，剩余 59 次 not-started。最终 `task9_quality_gate_failed /
qualityAuthority=none`，journal `134`、validator `ok=true`、recovery claim=`null`。Task 9C 不得重跑；产品/main、
  Phase 6.9.9/6.9.10/6.10/8/9 与博客收尾继续阻断。
- Phase 6.9.8 Architecture Recovery R0--R4 已完成 zero-provider 设计、diagnostic robustness、runner/durability/
  admission：新 lineage 同时覆盖 rewrite、Qwen
  retrieval 与 FinalResponse stream，分离 `providerWire/runnerWire`，diagnostic 禁止 raw/unknown-key/raw-hash；R1
  只从第一方 V7 terminal wire snapshot 推导 rewrite Provider boundary。R2 新增 Qwen/FinalResponse 两个第一方
  wire family，覆盖 embedding/stream/terminal/usage；首个畸形 stream event 固定为
  `response_observed + stream_event_invalid`。R3 再固定 16-guard/64-call runner、模块私有 single-use observation、
  双 wire accounting、source admission、fsynced journal、hard-link artifact、strict validator 与 crash-only recovery；
  forged/reused/active/cross-call/cross-family capability 均 fail-closed。R4 reviewed Mock/static 已完成：guards
  `16/16` zero-call、双 wire `64/64/64/64`、diagnostic `64 applied`、rewrite/FinalResponse `16/16`，gate 固定
  `architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`。R0--R4 不新增环境变量、gate、credential
  mapping、Docker profile 或正式 evidence；该 R4 checkpoint 后续解锁的唯一 R5 已失败封存，R6 继续阻断。

### Phase 6.9.8 Architecture Recovery R5（唯一 Live 已封存）

R5 已完成实现、独立复审和 zero-provider 回归，固定调度为 `16 guards + 16 rewrite pairs + 16 FinalResponse = 64`
slots。DeepSeek rewrite、Qwen original/candidate retrieval 与 DeepSeek FinalResponse stream 均使用真实第一方
adapter；三项 credential 只由授权 CLI 子进程 late-bind，产品 gate、Docker Compose、Nest server/worker 与浏览器
默认配置不改变。focused `18/18`、CLI `6/6`、Agent `1329/1329`，typecheck/lint/Prettier 通过。

用户已接受：

```text
I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_DEEPSEEK_AND_QWEN_DATA_BOUNDARY
```

并授权：

```text
I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_CONTROLLED_LIVE_ONCE
```

在分支 clean、tracking/remote/approved tag 完全同 commit 且 formal evidence=0 后，唯一入口已执行一次。下面的命令仅作
历史审计记录，禁止再次复制执行：

```powershell
bun --filter @repo/agent eval:phase-6-9-8:architecture-recovery:r5:cli I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_CONTROLLED_LIVE_ONCE
```

CLI 当时会先校验 source/data boundary/approval，再 late-bind 三项 R5 专用 key，随后 reservation、guards、64 slots、
publication 和 strict validator。不要把通用 `DEEPSEEK_API_KEY` 或 Qwen 产品 key 复制到 R5 变量；不要在主代理
上下文打印 key。本次没有发生 reservation 后异常；下列 seal 命令只记录历史 crash-only 边界，当前禁止执行：

```powershell
bun --filter @repo/agent eval:phase-6-9-8:architecture-recovery:r5:seal
```

之后必须执行一次只读校验：

```powershell
bun --filter @repo/agent eval:phase-6-9-8:architecture-recovery:r5:validate
```

无论 gate pass/fail 都不得 retry、resume、replay、backfill、curl、单 case 或追加 Provider 探测；只有完整
`controlled_live` gate pass 才能进入 R6 产品 Docker/API/可见浏览器验收。完整边界与结果记录见
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r5-controlled-live.md`。

本次唯一结果为 run `34eb99be-bdeb-41e5-85cf-3c651ecefc68`、
`architecture_recovery_quality_gate_failed / qualityAuthority=none`：guards `16/16` zero-call，第二个 rewrite pair
的 DeepSeek 在 `provider_dispatch / unknown` 失败；external calls `4`，Qwen `3`、DeepSeek `1`，breaker 后 `59`
slots 未启动；rewrite strict `1/16`、FinalResponse `0/16`，正式 semantic/P95/usage/cost aggregate 为 `null`。Journal
`237`、final event `evidence_published`、recovery claim=`null`、validator `ok=true / bundle_valid`，artifact SHA=
`423e3f2e4dcb442a71a346334624642ca7c14ed898c894b5180910d04943b1e5`。R5 一次性名额已消费，禁止再次运行上述 Live
入口或 seal/recovery；R6 产品验收仍阻断。sealed diagnostic 不足以归因 DNS/TLS/代理/账号/余额/权限/服务端根因。
正式 CLI 启动前曾因 `.env` UTF-8 BOM 发生一次环境加载退出；没有进入 admission/reservation、没有 Provider call，
不计为 Live。上述 run 是唯一 R5 controlled-Live。

### Transport Evidence Recovery T0/T1/T2（T2 robustness + durability 已完成）

T0 已冻结 zero-provider transport/evidence contract；T1 已提供 strict parser 与三条 family 私有 capability seam；
T2 已用注入式 ports 完成固定 `30`-case matrix、`15` classifier fixture 与 synthetic durability。最终 focused
`11/11`、Agent `1348/1348`、typecheck/lint/Prettier 通过，formal evidence=0。当前仍没有已授权的 Live CLI；如需
T3 transport canary，必须先重新接受当次 DeepSeek/Qwen 数据边界并给出 exact authorization。在此之前不得运行任何
`live`、`seal`、`recovery`、curl、单 case 或产品 API Provider 命令。设计与计划见：

- `docs/superpowers/specs/phase-6-9-8-retriever-final-response-transport-evidence-recovery-design.md`
- `docs/superpowers/plans/phase-6-9-8-retriever-final-response-transport-evidence-recovery.md`
- `docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t1-zero-provider-tdd.md`
- `docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t2-zero-provider-robustness-durability.md`

T1/T2 安全回归命令：

```powershell
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-transport-evidence-contract.test.ts
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-transport-evidence-t2.test.ts
bun --filter @repo/agent test
bun --filter @repo/agent typecheck
bun --filter @repo/agent lint
```

这些命令只运行本地 contract/测试，不读取 credential、不访问 Provider、不创建正式 marker/journal/artifact。

SR7 完整证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-sr7-main-acceptance.md`。

### Phase 6.9.8 Task 0--9C 运行边界

Task 5/6 已把 Retriever query rewrite 与 FinalResponse 的三项变量分别加入 tracked safe example 与 Docker
Compose `web` allowlist；默认仍关闭，不会因为根 `.env` 有通用 key 或 Chat Live 开关而启用。不要开启 gate、
复制通用 key，或把这些变量投影给其它服务：

```dotenv
RETRIEVER_QUERY_REWRITE_MODEL_ENABLED=false
RETRIEVER_QUERY_REWRITE_MODEL_TIMEOUT_MS=4000
RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY=
FINAL_RESPONSE_AGENT_MODEL_ENABLED=false
FINAL_RESPONSE_AGENT_MODEL_TIMEOUT_MS=20000
FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY=
```

两组变量只允许显式投影给 Next `web` server runtime，不能注入 Nest `server`、`worker`、`admin` 或浏览器
client bundle；独立 key 不能由 `DEEPSEEK_API_KEY`、Tutor/Organizer、Review/Planner 或 Knowledge credential
替代。Task 7 已把两组 runtime bundle 接入 `/api/chat`，但 tracked default 仍为 false；普通本地启动不会执行
query rewrite 或新的真实 FinalResponse Provider stream，只走 gate-off/Mock/安全降级路径。Task 8 的静态 runner
只使用 prompt-only in-process Mock 与固定 fake search，不读取模型 credential、调用 Qwen/DeepSeek、启动 Docker/
API/browser 或修改业务数据。Task 9A 的 Qwen provider module 同样不读取 env，所有测试只使用 injected fetch；
它没有接入产品 RAG service，也没有创建正式 evidence。Task 9B 只用 synthetic capability/transport 和临时目录
验证 runner/durability。Task 9C production CLI 随后已执行唯一一次并以失败 gate 正常发布 artifact；该运行只在
受限进程内映射 3 项评测 credential，没有打开产品 query-rewrite/FinalResponse/Chat gate。现有 approved tag、
marker、journal 与 artifact 必须保留；禁止再次设置 9C 授权变量、运行 production CLI、seal/recovery、curl、单
case 或产品 API Provider 探测。

Architecture Recovery R0--R4 不需要也不允许在 `.env`、Compose 或本地终端新增任何开关。R4 使用
synthetic/injected transport 完成；R5 唯一 production CLI 已消费并失败封存，现在不再存在合法的 Recovery Live/
seal/recovery 命令，禁止再次设置授权变量或追加 Provider 探测。

Task 8 的安全静态回归命令：

```powershell
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-task8.test.ts
bun --filter @repo/agent eval:phase-6-9-8:static
```

Task 9A 的安全 provider/export 回归命令：

```powershell
bun test packages/ai/tests/qwen-text-embedding-v4-provider.test.ts packages/ai/tests/model-agent-exports.test.ts
```

Task 9B 的安全 zero-provider focused 回归命令：

```powershell
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-task9b-contract.test.ts packages/agent/tests/phase-6-9-8-retriever-final-response-task9b-runner.test.ts packages/agent/tests/phase-6-9-8-retriever-final-response-task9b-durability.test.ts packages/agent/tests/phase-6-9-8-retriever-final-response-task9b-lineage-cli.test.ts packages/agent/tests/phase-6-9-8-retriever-final-response-task9b-live-config.test.ts
```

Architecture Recovery R1 的安全 zero-provider 回归命令：

```powershell
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.test.ts packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-rewrite.test.ts packages/ai/tests/model-agent-exports.test.ts
bun test packages/ai/tests/first-party-deepseek-v4-pro-direct.test.ts packages/ai/tests/model-agent-exports.test.ts
bun --filter @repo/agent eval:phase-6-9-8:task9:validate
```

前两条只运行 injected synthetic adapter/contract tests；第三条只读重算已封存 Task 9C bundle。三条命令都不读取
credential、不访问 Provider，也不会创建 marker/journal/artifact。不要把 R1 test 的 `applied` 当成 Live、产品或
质量门通过。

Architecture Recovery R0--R4 的安全 zero-provider 回归命令：

```powershell
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-*.test.ts
bun --filter @repo/agent test
bun --filter @repo/ai test
bun --filter @repo/agent typecheck
bun --filter @repo/agent lint
bun --filter @repo/agent eval:phase-6-9-8:task9:validate
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock.test.ts
bun --cwd=packages/agent run eval:phase-6-9-8:architecture-recovery:r4:mock
```

前五条只运行源码/临时 synthetic runner 与 durability tests；Task 9C validate 只读验证旧 sealed bundle；R4 两条命令
只运行 reviewed Mock/static，不读取 credential、不访问 Provider、不创建正式 evidence。不要运行
`eval:phase-6-9-8:architecture-recovery:cli` 或 `eval:phase-6-9-8:architecture-recovery:seal`：R3 没有正式 evidence，
这两个 zero-provider maintenance 入口也不是日常测试命令，更不是 R4/Live 授权。

`eval:phase-6-9-8:task9:cli` 的唯一 Task 9C 名额已消费，不得再次执行。当前 artifact 已由正常 runtime 到达
`evidence_published`，因此 `eval:phase-6-9-8:task9:seal` 也不得执行；它不是普通检查或失败重试命令。只读验证
现有 bundle 只能使用 `eval:phase-6-9-8:task9:validate`。

CLI 只输出固定 schema/authority/SHA、计数、指标和 synthetic cost；不输出 prompt、回答、owner、chunk、credential、
URL 或 raw error。`mock_quality_not_evidence` 不是运行真实模型的开关，也不能作为 Task 9 authorization。

Task 7 新增 realtime Trace 数据库迁移与 `start -> prepare -> finalize` API。若要在未来 Task 10 产品验收时运行
数据库 E2E，必须先按本文件正常启动 PostgreSQL `127.0.0.1:5433` 与 Redis `127.0.0.1:6379`；本 Task 7 没有为
补齐环境而启动 Docker，现有 E2E 结果为 `environment_blocked`，不能写成迁移/API 已真实验收。

设计、Task 0--9C 与 Architecture Recovery R0--R5 验收见
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-agents-design.md` 与
`docs/acceptance/phase-6-9-8-task-0-retriever-final-response-contract.md`、
`docs/acceptance/phase-6-9-8-task-1-shared-communication-contracts.md`、
`docs/acceptance/phase-6-9-8-task-2-canonical-principal-chat-access.md`、
`docs/acceptance/phase-6-9-8-task-3-retriever-node-deterministic-baseline.md`、
`docs/acceptance/phase-6-9-8-task-4-verified-evidence-projector.md`、
`docs/acceptance/phase-6-9-8-task-5-retriever-query-rewrite-candidate.md` 与
`docs/acceptance/phase-6-9-8-task-6-final-response-stream-contract.md` 与
`docs/acceptance/phase-6-9-8-task-7-chat-composition-terminal-trace.md` 与
`docs/acceptance/phase-6-9-8-task-8-retriever-final-response-reviewed-mock-static.md` 与
`docs/acceptance/phase-6-9-8-task-9a-qwen-embedding-transport-price-contract.md` 与
`docs/acceptance/phase-6-9-8-task-9b-runner-durability-admission.md` 与
`docs/acceptance/phase-6-9-8-task-9c-controlled-live-quality-gate-failure.md`、
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-architecture-recovery-design.md`、
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-architecture-recovery.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r0-zero-provider-design.md`、
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r1-zero-provider-tdd.md`、
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r2-zero-provider-robustness.md`、
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r3-runner-durability-admission.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock-static.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r5-controlled-live.md`。

SR7 收口后的 Docker 期望状态：server/web 均为 `AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`、
`PHASE_6_9_7_SR6_PRODUCT_REPLAY_ENABLED=false`、request cap `0`，Router/Verifier/Tutor/Review/Planner/Knowledge/
Organizer gate 全部 false。RAG server/worker 仍为 `qwen / text-embedding-v4 / 1536`；只检查 credential 是否存在，
禁止输出值。不得用 `down -v`、prune、database reset、Redis `FLUSH*` 或 MinIO wipe 来“恢复环境”。

SR1--SR5 安全回归命令（除只读 validator 外均为静态/zero-provider；不要替换为任何
`eval:*:live/seal` 或 SR5 production CLI 命令）：

```powershell
bun test packages/ai/tests/first-party-deepseek-v4-pro-direct.test.ts packages/ai/tests/model-agent-strict-json-content-policy.test.ts packages/agent/tests/tutor-schema-recovery-contract.test.ts packages/agent/tests/tutor-schema-recovery-model-candidate.test.ts
bun test packages/agent/tests/tutor-schema-recovery-sr2-provider-robustness.test.ts packages/agent/tests/tutor-schema-recovery-sr2-runtime-metamorphic.test.ts packages/agent/tests/tutor-schema-recovery-sr2-fault-runner.test.ts
bun test packages/agent/tests/phase-6-9-tutor-organizer-schema-recovery-sr3-runner.test.ts packages/agent/tests/phase-6-9-tutor-organizer-schema-recovery-sr3-journal-validator.test.ts packages/agent/tests/phase-6-9-tutor-organizer-schema-recovery-sr3-crash-publication.test.ts packages/agent/tests/phase-6-9-tutor-organizer-schema-recovery-sr3-lineage-cli-security.test.ts
bun test packages/agent/tests/phase-6-9-tutor-organizer-schema-recovery-sr4-reviewed-mock.test.ts
bun test packages/agent/tests/phase-6-9-tutor-organizer-schema-recovery-sr5-authority-cli.test.ts
bun run --cwd packages/ai typecheck
bun run --cwd packages/agent typecheck
bun run --cwd packages/ai lint
bun run --cwd packages/agent lint
bun run --cwd packages/agent eval:phase-6-9-7:schema-recovery:validate
```

`eval:phase-6-9-7:schema-recovery:validate` 是当前唯一允许读取正式 SR5 bundle 的运维命令；它不读取
credential、不调用 Provider、不创建或修改 evidence。禁止运行 `eval:phase-6-9-7:schema-recovery:sr5`、任何
`seal`/recovery 命令，或为了“再确认一次”创建/移动/修改 marker、journal、artifact。

设计、计划与 SR0--SR6 验收分别见：

- `docs/superpowers/specs/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-design.md`；
- `docs/superpowers/plans/phase-6-9-7-tutor-organizer-full-gate-schema-recovery.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r0-zero-provider-design.md`。
- `docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r1-zero-provider-tdd.md`。
- `docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r2-zero-provider-robustness.md`。
- `docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r3-runner-durability.md`。
- `docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r4-reviewed-mock-static.md`。
- `docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r5-controlled-live-quality-gate-pass.md`。
- `docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-sr6-product-acceptance.md`。

`@repo/ai` 根 `index.ts` 是 Nest/Web 共用 runtime barrel，不重导出带 `import.meta` / top-level await 的
executable CLI；CLI 文件和 package scripts 仍是固定入口，CLI tests 直接导入对应文件。不要为方便导入而把
CLI-only modules 重新加入 shared barrel，否则 CommonJS/Nest/Jest 会在普通 runtime import 时加载可执行模块。

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
