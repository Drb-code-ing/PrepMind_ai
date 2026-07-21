# PrepMind 统一验收与调试清单

这份文档是日常开发、阶段收尾、面试复盘前的统一入口。它不替代
`docs/dev-start.md`、`docs/ai-behavior-acceptance.md` 和各阶段设计文档，而是回答一个更直接的问题：

> 我现在改完一个功能，应该启动什么、看什么页面、跑什么命令，才能说明它真的可用？

## 0. Phase 6.9.5 历史 Product-Acceptance checkpoint（非当前阻断）

> 当前状态索引（2026-07-20）：V19 及本节以下 V8/V9 文本均为不可改写的历史 checkpoint，不可把其“未完成/不得进入产品验收”理解为当前状态。V10 仍是唯一语义质量 authority；V22 的 `operation_failed -> recovered` 保留为独立历史。修复 Trace 计时耦合后，独立 DeepSeek V4 Pro Docker API 与可见 `/plan` 验收为 `candidate_applied`；main default-off replay 已通过，gate 保持关闭、合成账户/Trace 已清理。详见 `docs/acceptance/2026-07-20-phase-6-9-5-review-planner-production.md`。

V10 controlled-Live 仍是唯一语义质量 authority。V11--V22 都是不可重跑、不可复用的历史，其中 V22 终态为 `operation_failed -> recovered`；本节原有 V19 product/recovery 命令已过期，严禁执行。

main default-off replay 已完成。本段流程保留给后续同类阶段：提交并复验分支，`git switch main`，`git merge --no-ff <branch>`，确认当前 branch/HEAD 为 `main`，再重建 `server`/`web`、验证健康与环境开关、用新的合成账户确认两种 suggestion 均为 deterministic、精确清理账号与 Trace，最后完成证据复核与推送。禁止 `down -v`、prune、volume 清理、数据库 reset、Redis flush 或 MinIO wipe。当前验收记录见 `docs/acceptance/2026-07-20-phase-6-9-5-review-planner-production.md`。

## 1. 先判断本次要验收什么

| 场景                      | 推荐模式                                                          | 能证明什么                                                   | 不能证明什么                      |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------- |
| 普通 UI、表单、鉴权、CRUD | 本机 Bun + Docker 基础设施                                        | 页面交互、接口联通、校验和鉴权边界                           | Docker standalone 打包是否可用    |
| 后台任务、队列、worker    | Docker PostgreSQL / Redis + `SERVER_ROLE=both` 或 API/worker 拆分 | BullMQ、BackgroundJob、heartbeat、轮询和状态流               | 容器级 readiness 是否健康         |
| Docker 部署链路           | Docker Compose 全栈                                               | Web/API/Worker 容器能否一起启动，worker healthcheck 是否工作 | 本机热更新开发体验                |
| Chat / Agent 工程链路     | Mock AI                                                           | route headers、prompt 拼接、trace、RAG 降级、UI 渲染         | 真实模型回答质量                  |
| Chat / Agent 真实体验     | Live AI 小样本                                                    | Tutor 风格、RAG 引用自然度、真实模型是否遵守 guard           | 大规模稳定性和成本                |
| Agent 模型路径决策        | deterministic baseline + Mock contract + Live paired eval         | 相同数据集上的质量、安全、延迟、token 与成本净收益           | 单次演示不能证明应启用模型        |
| RAG 上传/处理/检索链路    | 非 production fake 回归或 Qwen live queue smoke                 | fake 证明工程链路，Qwen 证明真实语义召回与 runtime parity | fake embedding 不证明真实语义质量 |

一句话规则：**mock / fake 验工程链路，live 验真实体验；Docker 验部署形态，本机 Bun 验开发效率。**

浏览器验收约定：凡阶段验收包含真实页面操作，默认使用 headed 浏览器并保留可见窗口，让协作者
能够同步观察登录、点击、状态变化和下载过程。Headless 仍可用于快速自动化回归、固定视口截图和
console/page error 扫描，但记录中必须明确标注，且不能替代用户要求的可见浏览器验收。

## 2. 环境预检

开始验收前先确认这几件事：

```powershell
git status --short --branch
docker version
docker compose version
```

验收和排障不授权破坏性清理。禁止 `docker compose down -v`、删除 volume、Prisma/数据库 reset、Redis `FLUSHDB` / `FLUSHALL` 和 MinIO wipe；只能精确删除本次合成账号、记录、对象与隔离浏览器 storage。

常用端口：

| 服务          | 地址                                               |
| ------------- | -------------------------------------------------- |
| Web           | `http://127.0.0.1:3000` 或本机 Next dev 的实际端口 |
| API           | `http://127.0.0.1:3001`                            |
| PostgreSQL    | `127.0.0.1:5433`                                   |
| Redis         | `127.0.0.1:6379`                                   |
| MinIO API     | `http://127.0.0.1:9000`                            |
| MinIO Console | `http://127.0.0.1:9001`                            |

关键 env 文件分工：

| 文件                  | 主要用途                                     |
| --------------------- | -------------------------------------------- |
| 根目录 `.env`         | 后端、Prisma；Compose CLI 显式 `--env-file .env` 时的插值源 |
| `apps/server/.env`    | server/e2e 在服务目录运行时读取              |
| `apps/web/.env.local` | 本机 `bun --filter @repo/web dev` 读取       |

真实模型验收必须同时满足：

```env
AI_PROVIDER_MODE=live
AI_ENABLE_LIVE_CALLS=true
```

如果只是希望在 `/agent-trace` 页面手动切换 mock/live，推荐保持默认 mock，只打开 live guard：

```env
AI_PROVIDER_MODE=mock
AI_ENABLE_LIVE_CALLS=true
AI_DEV_MODE_SWITCH_ENABLED=true
```

Docker Web 因为运行的是 Next standalone，Compose dev 栈还需要：

```env
PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true
```

注意：这些开关不能绕过登录态、API key 或 live Chat 的服务端校验。

## 3. 启动方式

### 3.1 本机 Bun 开发模式

适合日常改 UI、接口和体验。

```powershell
$env:POSTGRES_PORT='5433'
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d postgres redis minio

$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER='fake'
bun --filter @repo/server start:dev
```

另开一个终端：

```powershell
bun --filter @repo/web dev
```

验收入口：

```text
Web:     http://127.0.0.1:3000
API:     http://127.0.0.1:3001/health
Swagger: http://127.0.0.1:3001/api-docs
```

### 3.2 本机 API / Worker 拆分

适合验证 queue 模式和 worker-only 进程。

终端 A：API only。

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER='fake'
$env:REDIS_URL='redis://127.0.0.1:6379'
$env:KNOWLEDGE_PROCESSING_MODE='queue'
$env:SERVER_ROLE='api'
bun --filter @repo/server start:dev
```

终端 B：worker only。

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER='fake'
$env:REDIS_URL='redis://127.0.0.1:6379'
$env:KNOWLEDGE_PROCESSING_MODE='queue'
$env:SERVER_ROLE='worker'
bun --filter @repo/server start:dev
```

worker-only 不监听 HTTP 端口，所以不要期待它有 `/health`。看它是否正常，主要看进程、日志、BullMQ、BackgroundJob、Worker Observability 和 readiness。

### 3.3 Docker 全栈模式

适合阶段收尾、部署链路和浏览器完整验收。

首次空数据库或 schema 变化后，先按 `docs/dev-start.md` 执行 `bun run db:generate` 和
`bun run db:migrate`。阶段收尾建议带 `--build`，避免验收到旧镜像。

```powershell
$env:KNOWLEDGE_PROCESSING_MODE='queue'
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio minio-init server worker web admin
```

若 Docker Desktop 在多服务 Bake 会话初始化阶段报 gRPC shared-key 非打印字符错误，RAG server/worker 可使用非破坏性绕过：

```powershell
$env:COMPOSE_BAKE='false'
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker build server
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker build worker
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --no-build postgres redis minio server worker
Remove-Item Env:COMPOSE_BAKE
```

不要为该宿主工具异常清理 build cache、container 或 volume，也不要执行 `down -v`。

RAG Docker 验收前在根 `.env` 或宿主环境明确配置 `RAG_EMBEDDING_PROVIDER=qwen`、`RAG_EMBEDDING_MODEL=text-embedding-v4`、`RAG_EMBEDDING_DIMENSIONS=1536`、无凭据 HTTPS `RAG_EMBEDDING_BASE_URL` 和 `QWEN_API_KEY`。`--env-file .env` 只是 Compose CLI 的 `${...}` 插值源，不会把整个文件自动注入每个 service；server/worker 仍只收到 `environment` 明列的共享 RAG runtime allowlist。`web` 不使用根 `.env` 的 service `env_file`，只接收显式 Chat、Router、Verifier runtime allowlist；Review/Planner gate 与 timeout 只进入 `server`。`admin` 的独立 `env_file` 是另一层 Compose 配置，但不执行 Chat provider。宿主别名 `Qwen_API_KEY` / `DASHSCOPE_API_KEY` 仅用于兼容输入，容器内规范化为 `QWEN_API_KEY`。不允许 provider fallback，不允许 production fake。

Compose 配置静态检查只运行不输出解析凭据的命令：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker config --quiet
```

验收入口：

```text
Web:    http://127.0.0.1:3000
API:    http://127.0.0.1:3001/health
Worker: docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker ps
```

查看日志：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker logs -f server
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker logs -f worker
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker logs -f web
```

只重启 Docker 前端：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --force-recreate web
```

这个命令不会清空 PostgreSQL、Redis 或 MinIO 数据。不要随手运行 `down -v`、`git clean -fdx` 这类会删除数据或工作区文件的命令。

### 3.4 Operator Audit 证据包真实全链路

为什么要验：单测无法证明 API/Worker 拆分、Outbox 到 BullMQ、MinIO ZIP、下载审计、维护删除和
Admin Blob 下载在真实容器拓扑中能够一起工作。

自动门禁：

```powershell
bun test packages/types/tests/operator-audit-export.test.mts packages/types/tests/operator-audit.test.mts packages/types/tests/worker-readiness.test.mts packages/types/tests/worker-observability.test.mts
bun --cwd packages/types typecheck
bun --cwd packages/database prisma:generate
bun packages/database/scripts/prisma-with-root-env.mjs migrate deploy
bun --cwd packages/database test
bun --filter @repo/server test -- operator-audit-export outbox background-jobs operator-audit worker-readiness worker-observability storage server-bootstrap response-envelope docker-compose-readiness --runInBand
bun --filter @repo/server test:e2e
bun --cwd apps/server eslint src/operator-audit-exports src/operator-audit src/outbox src/background-jobs src/worker-readiness src/worker-observability src/uploads src/common/interceptors src/bootstrap scripts/operator-audit-export-smoke.ts
bun --filter @repo/server build
bun --filter @repo/admin test
bun --filter @repo/admin lint
bun --filter @repo/admin build
git diff --check
```

Docker 路线：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio minio-init server worker web admin
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker ps
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker logs --tail 120 server worker minio-init
$env:OPERATOR_AUDIT_EXPORT_SMOKE_ADMIN_TOKEN='<本轮临时 ADMIN token>'
$env:OPERATOR_AUDIT_EXPORT_SMOKE_STUDENT_TOKEN='<本轮临时 STUDENT token>'
$env:OPERATOR_AUDIT_EXPORT_SMOKE_KEEP_DATA='false'
$env:BULLMQ_PREFIX='prepmind'
bun --filter @repo/server smoke:operator-audit-export
```

token 准备与角色提升见 `docs/dev-start.md` 的“本地管理员账号准备”和“审计证据包 Docker 验收”；
提升 ADMIN 后必须重新登录取得新 token。不要用长期账号，验收完成后另行删除临时账号和 refresh token。

验收矩阵：

| 路径             | ADMIN                        | STUDENT |
| ---------------- | ---------------------------- | ------- |
| list/detail      | 200，系统级可见              | 403     |
| create           | 202 或幂等返回同一事实       | 403     |
| READY download   | ZIP + no-store + SHA headers | 403     |
| EXPIRED download | 410                          | 403     |

必须同时确认：

- `server` 只运行 API，`worker` 独占 Dispatcher/export/maintenance processor，worker 为 healthy。
- `minio-init` 退出 0；lifecycle 是 48 小时兜底，应用 24 小时逻辑过期不依赖它。
- ZIP 仅有 `records.csv`、`manifest.json`；CSV 有 BOM/固定表头/formula-safe cell；manifest 与响应
  SHA-256 能匹配实际字节。
- `AUDIT_EXPORT_REQUEST` 与 `AUDIT_EXPORT_DOWNLOAD` 各一条；下载审计表示服务端授权并准备流，
  不表示浏览器一定已持久化全部字节。
- 把合成 export 的到期时间推进到数据库过去后，维护将其变为 EXPIRED、下载返回 410、MinIO
  对象消失，Worker Readiness 回到无 backlog 的预期状态。
- Admin 浏览器在 1440×900 完成申请→READY→下载→审计记录→EXPIRED，console/page error 为 0、
  body 无横向溢出；普通用户看不到后台入口且后端仍明确 403。
- smoke 默认 cleanup 后，本次 export/audit/outbox/SYSTEM job、Bull job、MinIO object 均无残留；
  预先创建的 ADMIN/STUDENT 测试账号与 refresh token 需要在整轮浏览器验收结束后另行删除。

功能分支验收通过并提交后，必须 `--no-ff` 合并 `main`，在 `main` 重新运行同一组测试、build、
Docker build/start 和 smoke，最后才允许推送 `origin/main`。生产 gates 仍默认关闭；本地 Compose 的
fallback HMAC secret 和离线 `minio/mc` 兼容镜像都不能带入生产。

回顾时可以问：为什么证据包要同时验 PostgreSQL facts、BullMQ delivery、ZIP 字节、下载审计和
MinIO 删除，而不能把“接口返回 202”当作完成？

## 4. 页面验收路线

### 4.1 登录与注册

页面：

```text
/login
/register
```

检查点：

- 登录页和注册页在手机视口下应整体显示，不应该靠滚动才能看完整表单。
- 邮箱格式错误应即时提示。
- 密码长度不够应提示，登录和注册都不能只做一边。
- 提交失败后继续输入，校验仍然应生效。
- 未登录访问受保护页面，例如 `/chat`，应跳转到 `/login`。
- 点击退出登录应有确认或轻提示，不应该误触直接退出。

接口辅助检查：

```powershell
curl.exe -i http://127.0.0.1:3001/auth/me
```

未登录时应返回 401。

### 4.2 Chat / Agent / Mock-Live 切换

页面：

```text
/chat
/agent-trace
```

检查点：

- 默认 mock 模式下，Chat 应能流式显示回答，不消耗真实模型额度。
- `/agent-trace` 在开发开关开启时，应能看到 mock / live 切换入口。
- 切到 live 前，必须确认 `AI_ENABLE_LIVE_CALLS=true` 且存在供应商 API key。
- live Chat 必须登录，不能绕过 `/auth/me` 校验。
- Chat 响应 headers 可用于确认 Agent 路由：
  - `x-prepmind-agent-route`
  - `x-prepmind-agent-confidence`
  - `x-prepmind-agent-rag-required`
  - `x-prepmind-knowledge-verifier-status`
  - `x-prepmind-agent-trace-recorded`

mock 验收重点是工程链路；live 小样本才验真实输出质量。推荐 live 每轮只跑 3 到 5 个固定用例，结束后切回 mock。

Phase 6.9 的 Agent 模型路径不得只凭主观体验开启。先运行 deterministic baseline，再用相同 case
运行 Mock contract 和受控 Live candidate，按 `docs/acceptance/phase-6-9-agent-eval-template.md`
记录质量、安全、p95 延迟、token 和估算成本。Critical failure 必须为 0；未达到 Agent 专属门槛时
继续使用 deterministic。Phase 6.9.1 只有 seed baseline，不调用真实模型，也不证明 Orchestrator
已经实现。

评测 score、提升阈值或 critical failure count 非有限、越界、非整数或为负时，启用决策必须
`invalid_metrics` fail-closed。评测 run 只保存受限结构码 outcome，不保存任意 detail 原文。

Phase 6.9.4.1 的固定评测地基还必须满足：

- `phase-6.9-seed-v1` 的历史 21/24 baseline 不变；新 `phase-6.9-router-verifier-v1` 恰好为 Router 60 / Verifier 40；
- `bun --filter @repo/agent eval:phase-6-9-4-1` 只运行 deterministic，token/cost 为 0，不读取 provider env；
- Router 单独记录 overall、ambiguous macro-F1、high-confidence、permission boundary、critical；Verifier 单独记录 overall、complex conflict recall、conservative fallback、prompt injection release、critical；
- safety/prompt injection case candidate ineligible，critical failure 不能被总体通过率抵消；
- baseline 报告只写 case ID 和结构码，不写 query/chunk/prompt/output；当前 Enabled=no，直到同版本 Mock/Live paired eval 同时通过质量、安全、延迟和成本门槛；
- 该纯函数 slice 不需要 Docker；不得为验收执行 prune、down -v 或删除 volume。

Phase 6.9.4.2 Mock candidate 的执行入口如下；行为 contract 只以 `docs/ai-behavior-acceptance.md` 的 Phase 6.9.4.2 段为 canonical source：

- 运行 Router candidate、Verifier candidate、共享 policy 定向测试，以及 `bun --filter @repo/agent test` 全量回归和 `bun --filter @repo/agent eval:phase-6-9-4-1` baseline；
- 对阶段 acceptance 执行 placeholder/乱码与 credential-value 隐私扫描，并核对报告仍为 `Enabled=no`、`Reason=paired_candidate_not_run`；
- 阶段 acceptance 只记录本次证据，不复制或替代 canonical behavior contract。

Phase 6.9.4.3 paired eval 的安全执行入口如下；默认命令必须保持 Mock，Live 只能在操作者确认 pricing 与单次进程 key 后执行：

```powershell
bun run --cwd packages/agent test
bun run --cwd packages/agent typecheck
bun run --cwd packages/agent lint
bun run --cwd packages/agent eval:phase-6-9-4-1
bun run --cwd packages/agent eval:phase-6-9-4-3
bun run --cwd packages/agent eval:phase-6-9-4-3:validate -- --profile mock --file docs/acceptance/evidence/phase-6-9-4-3/mock.json
```

Mock paired CLI 的预期退出码为 1：报告 complete，但 Router / Verifier 仍 disabled。受控 Live 必须额外满足：

- 同时设置 `AI_PROVIDER_MODE=live`、`AI_ENABLE_LIVE_CALLS=true`、固定 model/base URL，并显式传 `--live`、non-cache highest input/output USD per million 与 `--max-cost-usd 0.10`；不得把 key 或 pricing 写入仓库、命令日志或 evidence；
- 正式运行前先清除 key 并关闭双开关做 zero-call rehearsal；预期 exit 3、`live_config_invalid`、provider attempt 0、Live evidence 文件数不变；
- 一次完整命令从 100 条 case 的开头串行运行，不重试单 case；任何 rerun 都必须使用新 run ID 并保留此前 attempted evidence，禁止拼接报告；
- complete Live 的固定 counters 应为 `caseEntries=100`、`adapterExecutions=100`、`runtimeInvocations=28`、`providerAttempts=28`、`strictSuccesses=28`、`zeroCallCases=72`；incomplete 必须同时记录 observed/notRun、实际 counters 与停止原因，不能用完整目标值覆盖；
- 文件名必须由 safe stdout 的 `startedAt + runIdHash` 机械推导并执行 `eval:phase-6-9-4-3:validate -- --profile live --file <canonical-path>`；不得按 mtime 猜测或覆盖旧文件；
- 检查 provider-reported per-case usage、aggregate usage、p50/p95、pricing snapshot、estimated cost、10 秒 timeout metadata，以及 Router / Verifier 两项独立 decision/reason；
- headroom contract 固定为 Router/Verifier 单次 local output `400/400`、provider ceiling `400/400`、28-call local/provider global output `11,200`；pricing preflight 必须用 `96,000 input + 11,200 output`，旧价格快照 worst-case 为 USD 0.017418937304；
- 扫描 JSON/Markdown 中的 forbidden key、credential value、prompt/query/chunk/output/raw-error canary；验证结束后清除进程 key、恢复 Mock，不清理 Docker、数据库、Redis、MinIO 或 volume；
- 历史 Attempt D 为 exit 2 / incomplete：`observed/notRun=52/48`、`providerAttempts/strictSuccesses=16/15`、固定失败 `router_ambiguous_mixed_chat_16 / structured_output`；最新 canonical Attempt E 为 exit 2 / incomplete：`observed/notRun=37/63`、`providerAttempts/strictSuccesses=1/0`、固定失败 `router_ambiguous_notes_tutor_01 / http_client`、usage 0/0；两项 decision 均为 `usage_unverifiable`，strict validator exit 0 只证明 incomplete evidence 合法，不代表模型质量或 Provider 兼容性通过；
- 新 controlled-Live 前必须通过共享 diagnostics 测试：八类枚举只从 `@repo/ai` 读取，attempted Live `PROVIDER_ERROR` failure 的 Error / Trace 分类必须存在且一致，evidence 必须携带八类之一；custom / injected executor 只能为 `unknown`；
- timeout、abort、`SCHEMA_INVALID`、budget、config、success、pre-provider、Mock、deterministic、zero-call 与 `not_run` 均不得携带分类；provider counter mismatch 时必须在最终 Live 边界剥离分类；
- candidate sanitizer 只接受 Error / Trace 双边一致的白名单枚举。历史 Attempt A / B 允许分类字段双边缺失，但不得改写：A 仍为 filename identity mismatch，B 仍为 `live / incomplete`；
- `providerFailureCategory` 不改变 `usage_unverifiable`、`incomplete` 或 enablement 的 fail-closed 结论，也不授权自动重试；不得保存 raw HTTP status、URL、request/response body、headers、message、stack、cause、prompt、output 或 credentials；
- 若新的 controlled-Live 再失败，只记录固定分类和既有安全计数：`http_auth` 先核对授权配置，`http_rate_limit` 服从 provider 窗口，`structured_output` 核对 schema、prompt 与 token headroom，`http_client/http_server/transport/invalid_response/unknown` 按各自边界诊断；任何类别都不得盲目重跑或绕过 runner 探测；
- Attempt C 的 `structured_output` 与历史 `61/120`、`108/120` output usage 已触发并完成 headroom 修复；Attempt D 在 400-token 下取得连续 15 条 strict success，成功 output 为 59~341，但最后一条仍 `structured_output`。不得据此盲目继续抬高 cap；由此触发的零网络 prompt/schema/provider compatibility 韧性分析与实现现已完成；
- Attempt E 的 strict-tool wire 作为历史实验保留，不与新 run 拼接。当前 controlled-Live 已收敛为标准 `https://api.deepseek.com` + `response_format=json_object`，请求不得包含 tools/tool_choice/json_schema；
- structured-output resilience checkpoint 必须验证：默认 `json_object` 行为不变；strict tool 只允许精确 `https://api.deepseek.com/beta`、唯一 forced `model_agent_result`、`strict:true`，不得有 `response_format/json_schema`、handler、业务副作用或 MCP；
- schema compiler 必须按 canonical schema object identity 查找已注册 Router/Verifier profile，只做审批过的非原地兼容投影并深冻结；canonical Zod 仍为最终权威，未注册/未支持/hostile input 必须在 fetch 前 fail-closed；
- Live 受控 preflight 必须按 schema 编译/校验 -> 安全 start timestamp -> dependencies/strict executor 本地初始化与权威快照 -> arm attempt callback -> UUID/evidence fs/reservation -> runner/Provider attempt 执行；schema 只有明确 `true` 才继续，初始化抛错、malformed/hostile dependencies 或 arm 前同步 callback 必须为 `live_config_invalid`、0 UUID、0 evidence、0 Provider attempt 且不泄漏 canary；
- 新 Live evidence 必须使用 runner-v3 + `deepseek_json_object_v1` + `phase-6.9.4.3-json-mode-v1`；runner、顶层 promptVersion 与 candidate entry promptVersion 必须一致。历史 v1/v2 Live 只读兼容，Mock 禁止 transport 字段；
- fresh 零网络门禁应为 AI 151 passed、Agent 345 passed、typecheck/lint exit 0、baseline 74/100 critical=2；Mock complete 的 `caseEntries/runtimeInvocations/providerAttempts/strictSuccesses/zeroCallCases = 100/28/0/28/72`；负向 Live config exit 3 且不得新增 evidence。不读 key、不启用双开关、不调真实模型；
- 不变运行边界必须是 Router 800/400、Verifier 1600/400、global 28 calls / 96,000 provider input / 11,200 provider output、单 case 10 秒、`maxRetries=0`；
- 证据见 `docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md`。唯一一次 JSON-mode controlled-Live 已完整跑 100 cases，28/28 strict success、72/72 zero-call，Verifier 通过；Router additional P95 `4264ms` 超门槛，故记录 terminal deterministic fallback，Phase 6.9.4.3 仍未全部通过。不得重跑或新增 transport；Verifier 结果只作为后续集成依据。

回顾时可以问：“如何机械证明 hostile schema 或本地初始化失败没有创建 UUID/evidence、也没有进入 Provider attempt？”“为什么 Mock counters complete 仍不是 Live 质量证据？”

以上 Phase 6.9.4.3 内容是历史 eval checklist 和当时结论，不改写、不重跑、不拼接；它不再表示 Router 永久禁止模型。

Phase 6.9.4.4 Task 9 Router/Verifier 分支验收必须覆盖，并在以下内容完成后结束：

- Docker Web 显式传入 `ROUTER_MODEL_ENABLED=false`、`KNOWLEDGE_VERIFIER_MODEL_ENABLED=false`、`ROUTER_MODEL_TIMEOUT_MS=5000`、`KNOWLEDGE_VERIFIER_MODEL_TIMEOUT_MS=4000`，默认关闭并支持两个组件独立回滚；
- 高置信与安全 Router、prompt injection/high-risk Verifier 保持 zero-call；歧义 Router 与 semantic-needed Verifier 在 controlled-Live 中出现真实 `candidate_applied`；
- Router 与 Verifier 共享单请求 `2 calls / 2400 input / 800 output` 预算，JSON-object output 仍由 canonical Zod、timeout、abort、无重试和安全 fallback 约束；
- Trace/headers 只记录固定 attempted/disposition/duration/usage/error code，不包含 prompt、query、chunk、provider raw error、key、base URL、token 或 cookie；
- 完整 branch gates、Mock、controlled-Live、Docker 全栈与可见浏览器通过；精确清理本轮合成数据，不清理 Docker、volume、数据库、Redis 或 MinIO；
- 提交本轮 acceptance evidence 与 current docs；该提交是 Task 9 的终点，不在 Task 9 合并 main、复验 main 或推送；
- 文档明确本阶段只完成 Router/Verifier，不代表 Memory、Orchestrator 或整个 Phase 6 完成；后续先完成全部 Agent，再进入 Phase 6.10 分层记忆。

Phase 6.9.4.4 Task 10 与 Task 9 分离，只在 Task 9 evidence/current-doc 提交完成后执行：

- 最终 spec / 质量复核，并重跑完整 branch gates；
- `--no-ff` 合并 main；
- 在 main 重跑静态、controlled-Live、Docker 与可见浏览器关键验收；
- 推送远程并比较本地 main、远程 main 与验收记录 SHA。

下一会话可以复制：“请继续 Phase 6.9.4.4 Task 9：在当前分支完成完整 gates、Mock、controlled-Live、Docker、可见浏览器验收、精确清理合成数据，并提交 evidence/current docs；不要开始 Task 10，不要提前进入记忆系统。”

Phase 6.9.2 共享 Model Agent Runtime 还必须持续覆盖：

- Mock/Live 走同一 Zod schema、请求/结果、预算与 Trace contract；schema invalid 必须 fail-closed；
- run budget 只接受有限非负整数，调用前按 `maxOutputTokens` 不可变预留，call/input/output 任一超限都不得执行 responder/executor；
- live disabled、executor 缺失和请求已 abort 必须在预算预留前拒绝；timeout 与外部 abort 必须分类明确并清理 timer/listener；
- `@repo/ai` 不读取 env，OpenAI-compatible executor 只接受安全 HTTPS URL，API key 只存在于 closure；
- result/Trace 不得包含 system/user prompt、完整模型输出、provider 原始错误、API key、base URL、response headers 或 stack；
- 本阶段只用 Mock 与注入 fake executor 验工程 contract，不调用真实模型，不证明 Agent 语义质量，也不证明 Router/Verifier/Memory 已模型化。

Phase 6.9.3.3 滚动摘要 Mock 验收还必须覆盖：12 条与 70% 两种触发、user-only tail 不推进、已覆盖原文不重复制造 pressure、输入凭据脱敏、输出凭据拒绝、模型失败不写库、目标范围变化 stale、更高 order 新消息不误判、first-create/update CAS 仅一次模型调用。Docker 默认必须是 Mock/Live false 且不得写入或透传真实 key；真实摘要体验已在 6.9.3.5 以受控 Live 小样本补齐。

Phase 6.9.3.4 Web context Mock 工程验收必须覆盖：

- request 携带 optional conversationId；首轮无 id 跳过 prepare，sync 获得 id 后第二轮才 prepare；
- provider 配置与 live 401/403 在 prepare 前完成；prepare 只接受 token + id，默认 10 秒、限定 1~15 秒并传播 request abort；
- prepare network/timeout/5xx/schema failure 返回固定 degraded，Mock Chat 仍可 streaming，日志不含 raw error、token 或 summary；
- assembler 永不丢 base/latest user；agent/state guidance 独立记账且合计最多 10%，OCR 优先，recent 只保留完整轮次，RAG 不安全截断时整层 drop 并清引用，summary 只在 history dropped 时加入；
- mandatory 超限才返回 413；任意 optional layer 都必须裁剪或 drop，不能制造 413；
- summary status/version/dropped layers headers 与 Agent Trace 只含 bounded metadata，不含 summary/prompt/chunk/state 正文；
- Dexie v9 只保存 sanitized state；版本倒退不覆盖、并发写/clear 串行、过期/跨用户/key mismatch 不恢复、logout/clear 删除，序列化结果不含 summary/tool/proposal/prompt/token；
- Provider 恢复只设置安全 conversation state/conversationId，不依据 activeQuestionId 伪造 OCR 全文，unmount、身份变化或迟到旧请求不得 setState/复活旧用户 cache。

本 slice 的单元测试、lint 与 build 只证明 Mock 工程边界，不证明真实摘要语义质量，也不等同于 headed 浏览器验收。Docker Mock、受控 Live 小样本、临时数据清理与阶段证据已由 Phase 6.9.3.5 完成。

Phase 6.9.3.4 本地 headed Mock 已补充完成：真实注册与首轮降级、sync 后 conversationId、Dexie sanitized state、消息数触发 `generated/version=1`、刷新后 `reused/version=1`、刷新后的首条新增消息继续 sync、console/page error 为 0、临时账号清理为 0 remaining。该证据不替代 Phase 6.9.3.5 的 Docker 全栈 Mock 与受控 Live。

Phase 6.9.3.5 Docker/Live 收口必须且已经覆盖：

- 全栈 `postgres/redis/minio/server/worker/web/admin` 使用当前分支产物启动，worker healthy；
- Mock API 覆盖 `generated -> reused`、跨用户 404、CAS/stale 和 credential rejection；headed Mock 覆盖 Trace layer token、Dexie 白名单、console/page error 0 与无横向溢出；
- Live 必须同时开启 `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true`，使用固定小样本和单次摘要预算，不输出 key/base URL/摘要正文；
- OpenAI-compatible structured output 仍经过 JSON mode、strict Zod schema、预算、超时和错误脱敏，不允许因 provider 兼容性绕过 contract；
- 记录 provider/model/promptVersion、summary version/watermark、provider-reported summary usage/耗时，以及最终回答是否保留目标和纠正；本地估算预留、provider usage 和 Chat Trace 估算都不能冒充 provider 账单；
- 可见浏览器保留 Chat/Trace 页面供共同观察，Trace 只显示 `summary=true` 与 `layerTokens=m/a/s/o/r/k/y` 等 bounded metadata；
- 结束后恢复 Mock，只按严格合成账号前缀清理 User/Conversation/ChatMessage/Summary/State、Redis cache 和隔离浏览器 storage，不 reset 数据库；
- 完整证据见 `docs/acceptance/2026-07-11-phase-6-9-3-conversation-memory.md`。

### 4.3 知识库 / RAG

页面：

```text
/knowledge
```

检查点：

- 上传 TXT / Markdown / PDF / DOCX 后，资料应进入 `PENDING`。
- 点击处理后，inline 模式应同步处理；queue 模式必须显式设置 `KNOWLEDGE_PROCESSING_MODE=queue`，创建后台任务并由 worker 消费。
- 处理成功后资料应变为 `DONE`，并能在手动检索里命中。
- queue smoke 必须轮询到关联 `BackgroundJob=SUCCEEDED`，不能只以 `Document=DONE` 或 HTTP 2xx 代替。
- 当前检索是 pgvector cosine vector candidates + PostgreSQL full-text keyword candidates，按 `chunkId` 去重后 hybrid rank，无 reranker。
- 每个 smoke 命中必须带有限数值 `metadata.retrieval.keywordScore` 与 `vectorScore`、`mode=hybrid`，同一 case 不得出现重复 `chunkId`；还应展示资料来源和必要的 SafetyGuard 标记。
- 恶意指令注入内容不能进入最终 Chat prompt；高风险 chunk 应被过滤或作为不可信材料处理。
- 资料管理建议只读展示，不应自动删除、合并、重命名或分类资料。
- fake embedding 只能证明上传、解析、分块、入库和检索 API 可用；当前真实语义质量标准验收使用 Qwen `text-embedding-v4` / 1536。Phase 7.8.5 真实 Docker smoke 已通过 3/3，queue `BackgroundJob=SUCCEEDED`，provider/key/base URL 缺失时在 provider 调用前 fail-closed；证据见 `docs/acceptance/2026-07-14-rag-runtime-parity.md`。

API 级 smoke：

```powershell
bun --filter @repo/server smoke:rag-eval
```

保留合成 smoke 数据供页面复查：

```powershell
$env:RAG_EVAL_SMOKE_KEEP_DATA='true'
bun --filter @repo/server smoke:rag-eval
```

### 4.4 复习、错题与记忆核心产品流

页面：

```text
/today
/plan
/stats
/error-book
/profile
```

检查点：

- `/today` 应展示今日复习任务；评分完成、跳过、恢复后状态要即时更新。
- ReviewTask 评分要带 `clientMutationId`，重复提交同一评分不能重复写 `ReviewLog`。
- `/plan` 应展示未来 7 / 14 天复习压力、容量状态和偏好设置入口；它是只读预览，不创建未来任务。
- `/stats` 应展示复习趋势、评分分布和卡片状态，刷新后不应出现 hydration 错误。
- `/error-book` 应按学科卡片进入专题 deck，再进入错题列表；重命名、备注、掌握状态、删除确认和加入复习都要保留。
- 创建或更新错题后，错题组织层失败不能影响错题事实表保存。
- `/profile` 中 MemoryAgent 只生成长期记忆候选；候选必须人工确认后才成为 `ACTIVE` 记忆。
- Memory、Review / Planner、Knowledge suggestions 都是只读或人审能力，不应自动写事实表或绕过用户确认。

### 4.5 Worker Observability / Readiness

页面与接口：

```text
/knowledge
GET /worker-observability/summary
GET /worker-readiness
```

CLI：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:REDIS_URL='redis://127.0.0.1:6379'
$env:KNOWLEDGE_PROCESSING_MODE='queue'
$env:SERVER_ROLE='worker'
bun --filter @repo/server readiness:worker
```

退出码含义：

| 退出码 | 含义                                                            |
| ------ | --------------------------------------------------------------- |
| `0`    | ready，可以通过 readiness                                       |
| `1`    | degraded / not ready，依赖可读但存在队列、worker 或 outbox 风险 |
| `2`    | 脚本异常、配置错误或依赖超时                                    |

Docker worker healthcheck：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker ps
```

worker 行显示 `healthy` 才表示容器级 readiness 通过。容器内 healthcheck 跑的是构建产物 `bun apps/server/dist/scripts/worker-readiness.js`，不是本机 workspace script。

### 4.6 Outbox Ops

接口：

```text
GET /outbox-events
GET /outbox-events/:id
POST /outbox-events/:id/requeue
```

检查点：

- 接口必须登录。
- `OUTBOX_OPS_ENABLED=false` 时应在认证前隐藏为 404。
- 列表和详情只能返回脱敏 DTO，不得暴露 payload、aggregateId、prompt、RAG chunk、模型回答、API key、token、cookie 或用户正文。
- requeue 只允许 `FAILED / DEAD -> PENDING`，不直接执行 handler，不修改 payload。

### 4.7 Swagger / OpenAPI

页面：

```text
/api-docs
/api-docs-json
```

检查点：

- 非 production 默认开启。
- production 默认关闭，只有受控环境才能显式设置 `SWAGGER_ENABLED=true`。
- Swagger 只是调试展示层，不替代 `@repo/types` 的 Zod contract。
- 受保护接口仍必须走 `JwtAuthGuard`。
- 示例里不能放真实 token、cookie、API key、完整 prompt、完整模型回答或完整 RAG chunk。

Swagger 手动调试受保护接口时，先通过登录接口拿到 `accessToken`，再点页面右上角 Authorize，填入 Bearer token。

## 5. 命令索引

| 命令                                                                  | 什么时候用                              | 期望结果                                  |
| --------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------- |
| `bun install`                                                         | 首次拉仓库或依赖变化后                  | workspace 依赖安装完成                    |
| `bun run db:generate`                                                 | Prisma client 缺失或 schema 变化后      | Prisma client 可被 server 引用            |
| `bun run db:migrate`                                                  | 数据库迁移变化后                        | PostgreSQL schema 更新完成                |
| `bun --filter @repo/web lint`                                         | 前端提交前                              | ESLint 通过                               |
| `bun --filter @repo/web test`                                         | 前端表单、hook、纯函数变化后            | Web 单测通过                              |
| `bun --filter @repo/web build`                                        | 阶段收尾或 Docker Web 前                | Next build 通过                           |
| `bun --filter @repo/server lint`                                      | 后端提交前                              | ESLint 通过                               |
| `bun --filter @repo/server test`                                      | 后端 service / controller / env 变化后  | Jest 单测通过                             |
| `bun --filter @repo/server test:e2e`                                  | Auth、鉴权、跨用户隔离、核心 API 变化后 | e2e 通过                                  |
| `bun --filter @repo/server build`                                     | 后端收尾、Docker 镜像前                 | Nest build 通过                           |
| `bun --filter @repo/server smoke:rag-eval`                            | RAG API / queue / embedding / hybrid 检索验收 | BackgroundJob SUCCEEDED，hybrid scores 完整且无重复 chunk |
| `bun --filter @repo/server smoke:operator-audit-export`               | 审计证据包真实 API/队列/存储验收        | 权限、ZIP、hash、审计、过期和清理串联通过 |
| `bun --filter @repo/server readiness:worker`                          | worker 部署前或排障                     | 返回 ready/degraded/not_ready 和退出码    |
| `bun --cwd packages/types typecheck`                                  | API contract 变化后                     | types 包通过类型检查                      |
| `bun --cwd packages/database test`                                    | Prisma helper 或数据库包变化后          | database 包测试通过                       |
| `bun --cwd packages/fsrs test`                                        | FSRS 算法变化后                         | fsrs 包测试通过                           |
| `docker compose --env-file .env -f docker/docker-compose.dev.yml ps`                  | 看基础设施容器                          | postgres / redis / minio 状态正常         |
| `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker ps` | 看全栈与 worker healthcheck             | worker 显示 healthy 或给出 unhealthy 信号 |

## 6. 什么结果才算通过

代码层面：

- lint、test、build 至少覆盖本次改动相关 package。
- Auth / 鉴权 / 用户隔离 / 后台任务状态机改动，应优先补 e2e 或已有 e2e 继续通过。
- 修改 API contract 时，`@repo/types` 应同步更新并 typecheck。

浏览器层面：

- 用户真实路径能跑通，而不是只看接口返回。
- 移动端视口不应出现遮挡、错位、按钮太小或需要不合理滚动。
- 错误提示要让用户知道怎么改，而不是只暴露后端错误。
- 退出、删除、requeue 等高风险操作应有确认、权限或 feature gate。

AI / RAG 层面：

- mock 模式通过只说明工程链路稳定。
- fake embedding 通过只说明 RAG 管道稳定。
- 真实 RAG 验收要明确记录 Qwen `text-embedding-v4` / 1536、queue `BackgroundJob=SUCCEEDED`、hybrid `keywordScore` / `vectorScore` 证据和无重复 `chunkId`；不得以 provider fallback 或 reranker 解释结果。Phase 7.8.5 已按此口径完成 3/3 真实验收，见 `docs/acceptance/2026-07-14-rag-runtime-parity.md`。
- 修改 Chat prompt、Tutor 策略、RAG 引用、KnowledgeVerifier guidance 后，应做 live 小样本。
- live 验收记录里只写状态、headers、是否命中、是否有引用和人工判断，不记录 API key、完整 prompt 或完整用户隐私正文。

部署层面：

- API `/health` 只说明 API 进程活着。
- `/worker-observability/summary` 说明开发者可观测状态。
- `/worker-readiness` 和 `readiness:worker` 才是 worker 链路能否接任务的 readiness 结论。
- Docker `worker` 的 `healthy` 说明容器内 readiness CLI 也能跑通。

## 7. 常见问题

### 7.1 我明明改了代码，页面还是旧行为

优先检查是否有旧 dev server 或 Docker Web 容器还在跑：

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002 -ErrorAction SilentlyContinue
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker ps
```

本机前端读 `apps/web/.env.local`；Docker 前端读根目录 `.env`。改错 env 文件后，页面不会按预期变化。

### 7.2 为什么短密码有时返回 401，有时返回 400

如果请求打到旧 server，可能还是旧校验逻辑。重启 server 后，格式校验类错误应在业务认证前返回 400；账号密码不匹配才是 401。

### 7.3 `/worker-readiness` 能不能直接在浏览器打开

可以，但它是受保护接口，需要登录态或 Bearer token。部署前更推荐用 CLI：

```powershell
bun --filter @repo/server readiness:worker
```

### 7.4 Swagger 里的 accessToken 从哪里拿

本地调试时可以先调用登录接口：

```text
POST /auth/login
```

响应里的 `data.accessToken` 是短期 token。复制到 Swagger Authorize 里即可。不要把这个 token 写进文档、截图或 git。

### 7.5 Docker 前端和本机前端会影响后端数据吗

不会。它们只是两种 Web 运行方式，都会访问同一个后端和数据库。普通重启前端不会清数据。验收时禁止 `docker compose ... down -v`、volume 删除、数据库 reset、Redis flush 或 MinIO wipe。

## 8. 收尾提交前清单

每一步完成后都要提交时，建议按这个顺序：

```powershell
git status --short
git diff --check
```

然后跑本次相关验证。例如只改文档，至少跑：

```powershell
git diff --check
```

如果改了前端：

```powershell
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
```

如果改了后端：

```powershell
bun --filter @repo/server test
bun --filter @repo/server lint
bun --filter @repo/server build
```

如果改了鉴权、跨用户隔离、知识库、后台任务或 outbox：

```powershell
bun --filter @repo/server test:e2e
```

最后再提交：

```powershell
git add <changed-files>
git commit -m "<本次提交说明>"
```

## 9. Phase 6.9.5 Review / Planner 受控模型验收

Review / Planner 的建议页不是 Chat 自动调用入口。先由 JWT owner-scoped Nest service 计算确定性事实与建议，再由可选模型 candidate 选择现有索引/枚举，最后仍由本地 merger 重建只读结果。模型不得创建或修改复习任务、卡片、日志、偏好、错题或资料。

执行顺序固定如下：

1. 先跑 Agent、AI、Server、Web、types 的无凭据静态门；任一失败就停止，不进入诊断或 Live。
2. 用唯一、尚不存在的 `.tmp/phase-6-9-5-live-diagnostic-mock-<utc>.json` 执行 `bun --filter @repo/agent eval:review-planner -- --mode mock --out <path>`。预期为 48 cases、26 zero-call、48 strict successes 和 `mock_quality_not_evidence`；Mock 不得打开 production gate。
3. 复核 `main...HEAD`、server/web/worker 的环境 allowlist、owner isolation、zero-call safety、默认 `false` gate、每个批准 profile 的一次 attempt/零 retry 和 evidence 脱敏。不得把 prompt、用户 facts、provider 原文、base URL、key、header、cookie 或 stack 写进报告。
   - 当前 `phase-6.9-review-planner-v2` 的 26 条 zero-call 不得由报告直接构造，必须实际执行 candidate safety/eligibility/budget/abort guard 并写入 `zeroCallVerified=true`；任一 runtime call 或不一致记录都必须得到 `zero_call_boundary_failed`。
   - 22 条 runtime case 需要覆盖多个 Review diagnosis / focus 与 Planner strategy / block order。Mock 的 48/48 只证明结构、预算、降级与安全边界，不证明真实模型语义质量。
4. 只有前三步全部通过，才可在独立进程中用精确确认参数执行一个已批准 profile 的 server-only controlled diagnostic。该 profile 诊断失败时保存固定类别、保持 gate 关闭并停止；禁止用历史 run、该 profile 的重试或 Docker 成功替代诊断结论。若要提出新 profile，必须先有新的零网络根因设计与复审，且 evidence/once marker/计数必须完全隔离。

DeepSeek V4 Pro v5 已执行其唯一 canary 并终态关闭：`invalid_attempted / closed / providerAttemptCount=1 / usageKnown=false / structured_output`。因此 v5 的 48-case、Docker、浏览器、main 合并与推送均未执行，v5 marker 已消耗且不可重跑。V6 的 Task 1--6 已在独立 lineage 中完成 default-off typed non-thinking transport、resolver/factory、evidence/CLI、Mock、复审与离线文档：精确 DeepSeek V4 Pro `/v1` request 固定写入 `thinking:{type:'disabled'}`，本地拒绝 tool/schema drift 与 reasoning-content response；V1--V5 immutable no-reparse snapshot 在 V6 preflight 前复核。用户授权后，V6 唯一 canary 已封存为 `finalized / invalid_attempted / closed / 1 / false / usage_unverifiable`。V6 离线 wire、fake CLI 31/31、focused V6 suite 61/61、native 15/15 与 Mock 48/26/22/48/0 都不构成真实模型通过，两个业务 gate 继续保持 `false`。

V7 不是 V6 retry。Task 1--7 离线工程已完成，但唯一 controlled-Live 已终态为 `finalized / invalid_attempted / closed / 23 / false / evidence_io`。once marker 已消费，无 success seal、token/cost 或 quality counters；V1--V6 tree hash 未改变。不得把 23 attempts 写成 22 runtime 成功、质量通过、零成本或账单。必须保持两个产品 gate 为 `false`，不运行 Docker/浏览器/main/push，不重跑、删除或重建 V7 evidence。
5. 只有新 48-case controlled-Live 同时满足 strict、质量、安全、权限、P95、usage/cost 和 zero-call 门时，才能临时开启 Docker Server 内的单个组件 gate，做 authenticated suggestions/plan、Trace 与 headed 浏览器验收。结束后恢复两个 gate 为 `false`，精确清理本轮合成数据但不清理 Docker、volume、PostgreSQL、Redis 或 MinIO。

当前 v1--v6 都是独立关闭证据，计数不得拼接：v1--v4 为 `invalid_attempted / structured_output`，v5 为 `invalid_attempted / closed / 1 / false / structured_output`，V6 为 `invalid_attempted / closed / 1 / false / usage_unverifiable`；所有 once marker 已消耗且不可重试。V6 48-case、Docker、浏览器、main 合并与推送都被终态关闭；不得从其 fact-free canary 推导模型质量、可用性、zero-call、零成本或账单。一次离线 Mock proof 为 48 cases / 26 verified zero-call / 22 Mock runtime / 48 strict / 0 critical、`mock_quality_not_evidence`，其 `.tmp` 已删除。完整静态验证在 lint-style 修复后重新通过 AI、Agent、Server、shared types、Web 测试/lint/build，以及 Compose `config --quiet` 和 `git diff --check`；这些都是 V6 pre-Live checks，而非 Live、Docker 或浏览器验收。

若要继续，不得再授权或执行 V7；必须先为新 lineage 完成零网络 stage-diagnostic 设计、TDD、独立复审与新的明确 Live 授权。新 stage 只能是无内容、固定枚举，不保存 prompt、response、credential、raw error 或失败 token/cost。

Task 7 contract/security 与 acceptance/operations 两轮离线复审已通过，但 V7 实际 Live terminal gate 未通过；原定的 `48/26/22/48/48/0`、P95、usage/cost 与 success seal 均不能从现有 `evidence_io` 反推。因此本轮不得开启任一 Review/Planner 产品 gate 或进入产品验收。

V8 completion contract 已在 `docs/superpowers/specs/phase-6-9-5-v8-stage-diagnostics-completion-design.md` 冻结。实施和验收必须额外满足：

1. V8 使用独立 profile/eval gate/confirmation/evidence/once marker/success seal，V1--V7 继续只读；15 个 stage marker 必须是固定文件名、零字节、append-only、exclusive-create 的合法连续前缀。
2. once marker、15 个 stage marker 与 success seal 必须先在各自固定 private prepare leaf 完成 write-through/flush/checked-close，再从同一 no-reparse directory HANDLE existing-only 重开并 exclusive rename 到 public leaf；rename 是唯一 commit 点。prepare/reopen/rename 失败不得出现对应 public leaf，rename 后 cleanup close failure 不得删除、重试或撤销 committed；禁止路径型 `MoveFileExW`。
   - I/O API 只接收 committed leaf，prepare 固定内部派生为 `<committed>.prepare`；V8 只允许 once、15-stage enum、success 三类 committed leaf，拒绝同名、任意 pair、覆盖或 `.prepare` 输入。
   - durability scope 只覆盖 local fixed NTFS 的 process crash/restart，不宣称物理断电或其他 volume；preflight 必须查询 volume 并 provider 前 fail-closed，native child hard-exit 必须分别证明 rename 前无 public leaf、rename 后 fresh reader 可恢复。
   - 任一 prepare/public leaf 遗留都表示 consumed/blocked；若失败早于首个 prepare 成功创建，只能证明本 invocation 零重试/零 provider，后续 invocation 仍需新的用户明确授权。
3. V8 Live 前完成 RED/GREEN、native race/reparse/write-denied、fake 48/26/22/48/48/0、完整静态门与两轮独立复审。paired Live 时 `REVIEW_AGENT_MODEL_ENABLED=false`、`PLANNER_AGENT_MODEL_ENABLED=false`。
4. 只有 V8 public reader 读取 committed success，且 stage manifest、candidate、success seal、V1--V7 tree、23 attempts、P95、positive usage、CNY cap 和全部质量计数匹配，才可进入产品验收。
5. 产品验收使用两个 `phase695-v8-accept-<UTC>` 隔离账号和精确 id 清单：
   - Review-only：`Review=true / Planner=false`，authenticated suggestions 的 Review observation 必须为 `attempted=true / candidate_applied / live_candidate / degraded=false / positive usage`，Planner 必须为 `not_eligible / local_deterministic`；headed `/plan` 与对应 Trace 必须通过。
   - 立即恢复两 gate 为 `false`，`--force-recreate server`，探测 suggestions 回到 deterministic；不得只重建 `web`。
   - Planner-only：`Review=false / Planner=true`，执行对称 API 断言、headed `/today` 与 Trace；随后再次恢复 default-off 并重建 `server`。
   - Token A 不得读取 Token B 的 owner facts 或 Trace。模型调用前后 Card、ReviewLog、ReviewTask、ReviewPreference、WrongQuestion、deck 与计划事实必须一致。
6. Trace 必须实际持久化，steps 为 `deterministic_review / review_candidate / deterministic_planner / planner_candidate`，目标 candidate 的 disposition 为 `candidate_applied`、usage 为正、pricing 状态与模型一致；不得包含 prompt、response、key、URL 或 raw error。
7. 分支与 main 的产品验收各最多 4 次模型请求。runner 与 server 都为每组件持有 `remainingRequests=2` 原子 admission：runner 在任何 await/HTTP dispatch/`route.continue()` 前同步 check-and-decrement，server 在 `ModelAgentRuntime` 前以一次性 capability 再 claim；任一失败都 provider 前 abort。显式 API 消耗一次，Playwright route 只放行一个 suggestions network request并在浏览器侧阻断第二个，Trace 差值必须证明每组件恰好 2 次 live attempts；owner-isolation 只在 gate-off/default-off server 下做零 Live 读取。两轮总 reservation 不超过 `15_600 / 3_520`；价格 profile 固定为 `deepseek-v4-pro-cny-noncached-2026-07-18-v8-product-acceptance`，来源是用户提供的 2026-07-18 DeepSeek 官方价格截图，按非缓存 input CNY `3/1M`、output CNY `6/1M` 和 verified 整数 token 精确计算，未舍入值判 cap、evidence 8 位 `ROUND_HALF_UP`；worst case `0.06792000`，hard cap CNY `0.10000000`。超出 admission、usage 或费用立即关闭 gate，不刷新重试；V4 Pro 的现有 USD Trace 必须保持 `pricingKnown=false / costEstimate=0`，不得编造汇率。
8. 合并 main 后不得重跑已消费的 V8 paired lineage。main 重新读取 committed evidence，运行完整静态门与 default-off Docker smoke，再按上述 hard cap 重放 Review-only/Planner-only 产品路径；它是产品 replay，不改写 paired evidence。
9. 清理按记录的精确账号、refresh token、Card/log/task/preference、WrongQuestion/deck、Trace 与浏览器 storage 执行并断言零残留。禁止 reset、flush、wipe、`down`、`down -v`、prune 或 volume 删除。
10. 推送后必须核对本地 main、`origin/main` 与 evidence SHA；关机前清除进程级 Live/eval/gate/key，重建 default-off `server`，关闭浏览器/Bun/辅助进程，并只用 `docker compose ... stop` 停止服务、保留全部 Docker 资源和数据。
11. branch/main 证据必须分别写入 `docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/{branch,main}/acceptance.json`、`plan.png`、`today.png`。JSON 只保存安全 observation/Trace 汇总、哈希账号 id、commit SHA、`pairedEvidenceSha256 / planScreenshotSha256 / todayScreenshotSha256`、调用/usage/CNY cost 计数和验收布尔值；JSON 不自哈希，不得保存 email、token、cookie、prompt、response、用户事实、原始 Trace、key、URL、header、raw error 或 stack。

2026-07-18 离线 checkpoint：上述 V8 stage evidence、CLI/factory、product admission、branch/main durable ledger、recovery 与 executable Docker/API/Prisma/headed-browser composition 已实现；Server `1265 passed / 30 skipped`、Review E2E `3/3`、Web `409/409`，Windows native、Agent/AI/types、lint/build、Compose `config --quiet` 与 diff check 全部 exit 0，最终 contract/security 和 acceptance/operations 复审无未关闭 Critical/Important。此 checkpoint 仍不是 Live 或产品验收：V8 evidence/once marker 不存在，两个产品 gate 为 `false`，不得跳过唯一 V8 success gate 直接进入 Docker 产品路径。

随后唯一 V8 controlled-Live 已消费：CLI stdout 为 `invalid_attempted / closed / 23 / false / invalid_response`；落盘 231-byte provisional 为 `attempted / 0 / false / transport`；public reader 为 `0 / evidence_io / lastStage=.stage-080-paired-returned`。durable prefix 无 `.stage-090` 或 success seal，因此 checklist 第 4 项 committed success 条件未成立，第 5--11 项 branch/main 产品路径全部禁止。不得把 CLI 23 冒充 durable terminal，也不得把落盘/public 0 解释为 zero-call、质量或零费用；V8 不可重跑。

### V9 历史 offline checkpoint 与唯一 Live 终态

截至 `683a209` 的以下项目是 V9 运行前 checkpoint；唯一 V9 controlled-Live 现已消费，后续不得以本段作为重跑授权。

1. V1--V8 evidence/marker 只读且 fresh snapshot 一致；不得删除、覆盖、重命名、拼接或用 `git show` 构造历史成功。
2. V9 evidence directory、once marker 与 success seal 在首次授权运行前必须不存在；当时仓库满足“不存在”，这不是成功证据。
3. `REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED` 只能在单次授权进程显式开启；`REVIEW_AGENT_MODEL_ENABLED` 与 `PLANNER_AGENT_MODEL_ENABLED` 必须保持未设置或 `false`。eval gate 不授权产品调用。
4. Product authority 只能接受 `finalized / complete / closed / passed`、`providerCount=23`、`pairedAdmissionCount=22` 和 lowercase 64-hex `evidenceSha256`；diagnostic-only、pending、`evidence_io`、未知 profile 或非法 hash 必须关闭。
5. Authority 读取前后都要列举完整 V9 leaf，并用 `git ls-files -v --full-name -- <dir>` 验证实际 leaf 精确 tracked 且全部为 ordinary `H`。lowercase assume-unchanged、`S` skip-worktree、缺 tracked leaf、额外 untracked leaf、leaf drift 或 commit/branch/clean drift 均不得进入 ready。
6. 上述任一失败必须在 owner/ledger reservation、Prisma account/fixture、Docker server recreate、headed browser 与产品 provider request 前阻断；不得回退 legacy V8 reader。
7. V9 离线证据为 focused `136/136`、Server `1381 passed / 30 skipped`、Review E2E `3/3`、Web `409/409`、AI `190/190`、Agent `406/406`、types/typecheck exit 0、Windows native 正确 cwd 合计 `133/133`、product acceptance `131/131`，以及 lint/build/Compose/diff exit 0。V5/V6 cwd 是命令入口契约，不是代码失败；这些计数均不是 V9 Live 证据。
8. 运行前没有 V9 Live、provider usage/cost、Docker/API/browser/Trace 产品验收、main replay 或 push。只有 public reader 返回第 4 项 committed success，才可另行申请 product acceptance；即使 Live 成功也不自动开启产品 gate 或宣告 Phase 6.9.5 完成。
9. 单独明确授权后，唯一 package script 为 `eval:review-planner:live:v9:gate-diagnostics`，exact confirmation 为 `--confirm-controlled-live-v9-deepseek-v4-pro-gate-diagnostics`，实际从根目录加载凭据的完整命令为 `bun --env-file=.env --filter @repo/server eval:review-planner:live:v9:gate-diagnostics -- --confirm-controlled-live-v9-deepseek-v4-pro-gate-diagnostics`；本 checklist 记录命令不等于运行授权。
10. Reserve 前 preflight blocked 必须是 `0-call / 0-reservation / 0-once / 0-evidence`，再次尝试仍需重新授权；一旦 reservation/once 存在，后续任一失败都永久封存，同一 V9 禁止重跑、删除、覆盖或重建。

V9 的一次实际运行遵守第 10 项后段：durable reader 为 `finalized / invalid_attempted / closed / quality_gate_failed`，`23` provider attempts、`22` paired admissions、`26` verified zero-call、`48` strict successes、P95 `1396ms`、usage `7943/510` 和 CNY `0.026889/1.00`；但 quality `30/48`、semantic `4/22`、critical `2` 未通过。没有 success seal，故第 4 项 committed success 不成立；Docker、headed browser、Trace 产品验收、main replay 和 push 必须继续禁止，产品 gate 默认关闭。

完整离线记录见 `docs/acceptance/phase-6-9-5-review-planner-v9-offline-checkpoint.md`。

### V10 committed Live outcome and product precondition

V10 不重跑或改写 V1--V9，且只让模型返回生产实际合并的 Review `focusIndexes` 与 Planner `blockOrder`。唯一 controlled-Live 已 exit `0`，public reader 五次 fresh read 均为 `complete / passed`：`23` provider attempts、`22` paired admissions、`48/48` strict/quality、critical `0`、P95 `1465ms`、usage `5764/232`、CNY `0.018684/1.00`，schema/quality/P95/usage/attempt/admission/cost 全通过。V1--V9 manifest 仍为 `36` entries / `61a6e4a956784a59a8b8639d4c94d6fd870bce5dd8549a026abf02a0e7cb769d`；V10 evidence/once/success seal 已封存且不可改写。

根 `.env` 未改，普通环境继续 mock/default-off；V8/V9 eval 与 `REVIEW_AGENT_MODEL_ENABLED` / `PLANNER_AGENT_MODEL_ENABLED` 均保持 `false`。V10 safe writer/reader 只持久化 strict lane aggregate，拒绝 prompt、snapshot、output、raw error、URL、credential、cookie、stack 和 per-case timing/usage。旧 V8 branch 产品验收 evidence 已以 recovery-only terminal 归档：一次遗漏 preflight 参数的失败为 `0-call`，首次实际分支尝试暴露 runner parse bug；恢复过程没有新 provider 调用且 cleanup 为零。它不是 V10 Live failure，V8 evidence 不得 reset、重用或扩展。V10 branch product-acceptance 现亦已单独终态为 `recovery_only`：它在 `slot-01-review-api` claim 后无 result leaf 而发生脱敏 `operation_failed`，recovery 没有新 provider/API/browser 调用且精确清理为零。该 terminal 不能推导原 slot 是 zero-call 或 zero-cost，也不能进入 main、push 或 Phase completion。后续必须建立全新、不重用 V10 product ledger 的 V11 lineage，先以 fixed safe failure checkpoint 完成 Mock/fake 证明与独立复审，再在新授权下运行一次 product 分支验收。完整归档见 `docs/acceptance/phase-6-9-5-review-planner-v10-product-acceptance-recovery.md`。

完整结果、证据边界和产品顺序见 `docs/acceptance/phase-6-9-5-review-planner-v10-offline-checkpoint.md`。

任何后续 Qwen Chat v5 只能遵循独立设计 `docs/superpowers/specs/2026-07-17-phase-6-9-5-qwen-controlled-live-v5-design.md`：在受审计的精确 model/endpoint/JSON 支持、价格 profile 和独立费用 cap 齐备之前，preflight 必须 provider 前关闭，且不得重试或改写 v1--v4。

## 10. Phase 6.9.6 Knowledge Agent 验收入口（controlled-Live 前）

candidate、API/UI、strict Mock paired runner 与 API-only Docker 配置已经实现；本节不授权当前调用真实模型，也不表示 controlled-Live、Docker 或浏览器产品证据已存在。量化权威见 `docs/superpowers/specs/2026-07-21-phase-6-9-6-knowledge-agents-design.md`。

1. 确认工作从已推送的最新 main 创建普通 `codex/` 分支；只有主工作目录，不从功能分支开分支，不创建非必要 worktree。
2. 固定 `phase-6.9-knowledge-agents-v1` 的 72 个 case ID、expected 与 digest。先记录 deterministic baseline，不为满足门槛改写 expected 或删除失败 case。
3. 24 条 zero-call case 必须实际进入 Dedup/Organizer candidate，穿过 gate/safety/ownership/embedding/budget/abort guard，并由 runtime counter 证明 0 invocation；exact hash 不能调用 provider。
4. Qwen shortlist 只读取 canonical owner 的 `DONE`、安全、1536 维 Chunk embedding。Document/chunk/score 来自同一 `REPEATABLE READ` snapshot；provider 前重验 owner/updatedAt/hash/status/chunk identity，漂移为 `snapshot_stale` 零调用。验证每文档最多 6 个稳定样本、阈值 0.78、最多 12 pair、稳定排序、target document 补入、跨用户候选为 0、API/Trace 不含向量或 chunk 正文。
5. Mock candidate 验证 `knowledge-model-projection-v1` 在裁剪/ordinal 前逐字段扫描完整 filename 和每段 summary，并交叉检查持久化 safety metadata；strict 类型/字节/字符、未知/重复/越界 index、非法 relation/evidence、标签字符/长度/数量、hostile getter/proxy、credential、prompt injection、timeout、abort、预算污染、usage/Trace 不一致全部 fail-closed。
6. 本地 merger 必须保留 exact hash、时间、document status、真实 ID、recommendation 与全部权限；`semantic_duplicate` 只允许 `review_manually`，`possible_revision` 缺少本地版本/时间证据时不得声称新版。Prisma create/update/delete 与 MinIO mutation 计数必须为 0。
7. 两个 server-only gate 默认均为 false；真实 composition 还需全局 Live 双开关、API-only `KNOWLEDGE_AGENT_DEEPSEEK_API_KEY`、精确 DeepSeek HTTPS base URL 与已知 pricing。该 credential 不能借用 Chat 的 `DEEPSEEK_API_KEY` 或 Review/Planner 产品凭据，worker/web/admin 不接收 Knowledge key/gate/timeout。预算固定 `2 calls / 6000 input / 1200 output`，Dedup 3000/500、Organizer 3000/700、各 4500ms、SDK retry 0、单请求 CNY cap 0.03。
8. 只有用户再次明确授权后才能执行 controlled-Live。48 个 runtime case 必须复用同一 dataset，并按 Dedup/Organizer `pairedRunIndex=0..23` 组成 24 次并行请求；usage 为 provider-reported 正安全整数并与 reservation/runtime/Trace 一致，总费用 <= 1.00 CNY。任一 schema、质量、critical、P95、usage 或成本门失败都保持产品 gate 关闭。
9. Live 质量门为：Dedup macro-F1 >= 0.85、revision recall >= 0.85、无关 false-positive <= 0.10；Organizer subject top-1 >= 0.88、tag micro-F1 >= 0.80、collection pairwise-F1 >= 0.80；semantic score 固定为 `0.35*Dedup macro-F1 + 0.15*revision recall + 0.20*subject top-1 + 0.15*tag micro-F1 + 0.15*collection pairwise-F1`，只比较同一 48 runtime case，非法/失败按错误预测，绝对提升 >=0.10。P95 为 24 个观测值 nearest-rank 第 23 个，包含 attempted success/fallback/error/timeout，不含 zero-call，branch/main 不拼接；critical、跨用户、越界 ID 和写操作为 0。
10. 分支产品验收分别运行 Dedup-only、Organizer-only、双开关 API；可见 `/knowledge` 覆盖 hybrid/local/degraded、空态、失败态和移动端。模型失败不得影响上传、处理、替换、检索或 RAG Chat。
11. Trace 使用一个 Knowledge parent run 和两个 candidate step，provider call 只记账一次；验证 disposition、正 usage、pricing/cost 和 API 双向一致，但禁止把 aggregate API duration 与 candidate-step duration 做精确相等比较。
12. 精确清理 synthetic user/document/chunk/object/BackgroundJob/Trace/browser storage 并断言 0；验证 SDK/Nest logger、HTTP debug、telemetry、stdout、evidence 和临时目录不含 prompt、filename/summary 正文、provider body/header、credential 或 raw error。外部 provider retention 必须在启用前文档化，不得声称本地清理删除了 provider 日志。恢复 `AI_PROVIDER_MODE=mock`、live=false、两个 Knowledge gate=false。禁止 prune、`down -v`、volume/database reset、Redis flush 或 MinIO wipe。
13. 独立复审无 Critical/Important 后 `--no-ff` 合并 main；在 main 重跑关键静态、Docker、可见浏览器 default-off 和必要的受控 authority 回放，推送并确认 `origin/main...HEAD = 0 0`。
