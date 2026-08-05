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
| RAG 上传/处理/检索链路    | 非 production fake 回归或 Qwen live queue smoke                   | fake 证明工程链路，Qwen 证明真实语义召回与 runtime parity    | fake embedding 不证明真实语义质量 |

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

| 文件                  | 主要用途                                                    |
| --------------------- | ----------------------------------------------------------- |
| 根目录 `.env`         | 后端、Prisma；Compose CLI 显式 `--env-file .env` 时的插值源 |
| `apps/server/.env`    | server/e2e 在服务目录运行时读取                             |
| `apps/web/.env.local` | 本机 `bun --filter @repo/web dev` 读取                      |

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

RAG Docker 验收前在根 `.env` 或宿主环境明确配置 `RAG_EMBEDDING_PROVIDER=qwen`、`RAG_EMBEDDING_MODEL=text-embedding-v4`、`RAG_EMBEDDING_DIMENSIONS=1536`、无凭据 HTTPS `RAG_EMBEDDING_BASE_URL` 和 `QWEN_API_KEY`。`--env-file .env` 只是 Compose CLI 的 `${...}` 插值源，不会把整个文件自动注入每个 service；server/worker 仍只收到 `environment` 明列的共享 RAG runtime allowlist。`web`、`server`、`worker`、`admin` 均不使用 service `env_file`：Web 只接收 Chat/Router/Verifier/Tutor，Server 只接收 Review/Planner/Knowledge/WrongQuestionOrganizer，Worker 只接收 RAG/队列/运维，Admin 只接收后台 URL。宿主别名 `Qwen_API_KEY` / `DASHSCOPE_API_KEY` 仅用于兼容输入，容器内规范化为 `QWEN_API_KEY`。不允许 provider fallback，不允许 production fake。

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

| 命令                                                                                  | 什么时候用                                    | 期望结果                                                  |
| ------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| `bun install`                                                                         | 首次拉仓库或依赖变化后                        | workspace 依赖安装完成                                    |
| `bun run db:generate`                                                                 | Prisma client 缺失或 schema 变化后            | Prisma client 可被 server 引用                            |
| `bun run db:migrate`                                                                  | 数据库迁移变化后                              | PostgreSQL schema 更新完成                                |
| `bun --filter @repo/web lint`                                                         | 前端提交前                                    | ESLint 通过                                               |
| `bun --filter @repo/web test`                                                         | 前端表单、hook、纯函数变化后                  | Web 单测通过                                              |
| `bun --filter @repo/web build`                                                        | 阶段收尾或 Docker Web 前                      | Next build 通过                                           |
| `bun --filter @repo/server lint`                                                      | 后端提交前                                    | ESLint 通过                                               |
| `bun --filter @repo/server test`                                                      | 后端 service / controller / env 变化后        | Jest 单测通过                                             |
| `bun --filter @repo/server test:e2e`                                                  | Auth、鉴权、跨用户隔离、核心 API 变化后       | e2e 通过                                                  |
| `bun --filter @repo/server build`                                                     | 后端收尾、Docker 镜像前                       | Nest build 通过                                           |
| `bun --filter @repo/server smoke:rag-eval`                                            | RAG API / queue / embedding / hybrid 检索验收 | BackgroundJob SUCCEEDED，hybrid scores 完整且无重复 chunk |
| `bun --filter @repo/server smoke:operator-audit-export`                               | 审计证据包真实 API/队列/存储验收              | 权限、ZIP、hash、审计、过期和清理串联通过                 |
| `bun --filter @repo/server readiness:worker`                                          | worker 部署前或排障                           | 返回 ready/degraded/not_ready 和退出码                    |
| `bun --cwd packages/types typecheck`                                                  | API contract 变化后                           | types 包通过类型检查                                      |
| `bun --cwd packages/database test`                                                    | Prisma helper 或数据库包变化后                | database 包测试通过                                       |
| `bun --cwd packages/fsrs test`                                                        | FSRS 算法变化后                               | fsrs 包测试通过                                           |
| `docker compose --env-file .env -f docker/docker-compose.dev.yml ps`                  | 看基础设施容器                                | postgres / redis / minio 状态正常                         |
| `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker ps` | 看全栈与 worker healthcheck                   | worker 显示 healthy 或给出 unhealthy 信号                 |

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

### Phase 6.9.5 历史 V7/V8/V9 lineage（与当前 Phase 6.9.7 无关）

下文的 V7/V8/V9 全部属于 **Phase 6.9.5 Review/Planner** 历史，只用于解释其已消费的 one-shot
evidence 和产品停止门；它们不是当前 **Phase 6.9.7 Tutor/Organizer V7** 的实现、Live 授权或后续路线。
当前 Phase 6.9.7 Tutor/Organizer V7 R4 已执行并以 `quality_gate_failed` 封存；一次性名额已经消费且
不得 retry/resume/replay/backfill。R5 产品验收、R6/main 与后续阶段被阻断，下一步只能先做新的独立
zero-provider 根因复盘与版本化 remediation 设计。

Phase 6.9.5 历史 V7 不是其 V6 retry。Task 1--7 离线工程已完成，但唯一 controlled-Live 已终态为 `finalized / invalid_attempted / closed / 23 / false / evidence_io`。once marker 已消费，无 success seal、token/cost 或 quality counters；V1--V6 tree hash 未改变。不得把 23 attempts 写成 22 runtime 成功、质量通过、零成本或账单。必须保持两个产品 gate 为 `false`，不运行 Docker/浏览器/main/push，不重跑、删除或重建 V7 evidence。5. 只有新 48-case controlled-Live 同时满足 strict、质量、安全、权限、P95、usage/cost 和 zero-call 门时，才能临时开启 Docker Server 内的单个组件 gate，做 authenticated suggestions/plan、Trace 与 headed 浏览器验收。结束后恢复两个 gate 为 `false`，精确清理本轮合成数据但不清理 Docker、volume、PostgreSQL、Redis 或 MinIO。

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

## 10. Phase 6.9.6 Knowledge Agent 验收入口与当前结果

candidate、API/UI、strict paired runner 与 API-only Docker 配置已经实现；唯一 V2 controlled-Live、R7 Docker/API 和可见浏览器分支证据也已存在且不可重跑。本节不授权新的真实模型调用。量化权威见 `docs/superpowers/specs/2026-07-21-phase-6-9-6-knowledge-agents-design.md`，运行证据见 `docs/acceptance/2026-07-21-phase-6-9-6-knowledge-agents.md`。

2026-07-22 当前结果：V1 controlled-Live 的 `quality_gate_failed` 与 R1--R6 产品失败证据保持不可变。唯一 V2 run `10ae2f36-69f6-422c-a99f-6bf6b3aeb226` 为 `24/24` verified zero-call、`48/48` runtime、semantic `0.9875`、`quality_gate_passed`、`0.117498 CNY`；R7 run `38748577-f250-4a7a-ab17-8fd14a63b2a3` 完成 Dedup-only、Organizer-only、双开关、强制失败/default-off，四次 `candidate_applied`，总 usage `3770/446`、`0.013986 CNY`。浏览器 run `012bc3ce-486e-4dce-be32-d29c246f47cd` 完成真实上传/处理/检索和 local/semantic/degraded/error/响应式状态，新增 Live 调用为 0。分支精确清理与默认关闭恢复通过；main `f31335c6` 的 default-off 静态、Docker/API、可见浏览器、精确清理和远程 parity 也已通过，Phase 6.9.6 已完成。

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
13. 独立复审无 Critical/Important 后 `--no-ff` 合并 main；在 main 重跑关键静态、Docker/API 与可见浏览器 default-off 回放，不重跑 V2 controlled-Live 或 R7，推送并确认 `origin/main...HEAD = 0 0`。

完成回执：main focused 为 Agent `118/118`、Types `1/1`、Server `50/50`、Web `7/7`，相应 typecheck/lint/build 均通过；当前源码 Docker server/worker 健康。main `/knowledge` 回放得到 suggestions `200`、upload `201`、process `201`、search `201`，390px 与 1440px 均无横向溢出，显示本地规则 badge 且自动整理控件为 0。唯一合成账号、Document/Chunk/MinIO object/ACCOUNT job/Trace/Session/RefreshToken 和浏览器 storage residue 全为 0；两个 Knowledge gate、live gate、Review/Planner gate 均为 false，Knowledge credential absent，Docker 卷保留。V2 Live 与 R7 未重跑。

## 11. Phase 6.9.7 Tutor / WrongQuestionOrganizer 验收入口（含 V2--V9 R5）

Task 0--11 已完成：72-case baseline、strict contract/projection、Tutor/Organizer package candidate/merger、产品 default-off composition、Organizer owner/write/Trace/API/UI、strict paired Mock/evidence、Docker runtime boundary 与分支全量 checkpoint 均已落地。Task 12 V1、V2 R7、V3 R5、V4 R6、V5 R6、V6 R5、V7 R4、V8 R5 与 V9 R5 九条唯一 controlled-Live 均已执行并以 `quality_gate_failed` 封存，且不可重跑、额外探测或拼接。V9 R0--R4 已完成本地合法 option selection、Provider-like/security/stale/write-authority robustness、独立 runner/lineage/durability 与 reviewed Mock/full checkpoint；唯一 R5 为 `24/24` guard、wire `2/2/0/0`、strict `0/48`，Tutor `provider_runtime / transport`、Organizer sibling `post_dispatch_abort`，正式 aggregate 全 `null`。Artifact 已 seal，validator 通过且无 recovery claim；产品验收、main 与后续阶段继续阻断。下列合同继续作为不可放宽的历史基线：

1. 从已推送最新 main 创建普通 `codex/` 分支，不使用 worktree；一任务一提交并同步核心文档。
2. 冻结 72-case dataset：Tutor/Organizer 各 12 zero-call + 24 runtime，Organizer 共 32 decision units；SHA-256 为 `7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`。未修饰 baseline 为 `6/48`、Tutor `0.4418666667`、Organizer `0.278125`、critical/provider/token/cost `0`；失败 case 不删除，且该零调用不冒充未来 guard 验收。
3. Task 2 已证明 full-field safety scan 先于裁剪/ordinal/runtime：credential、instruction/control、hostile accessor、畸形 UTF-16、unsafe metadata 与超大稀疏结构 fail-closed；公开 Organizer projection 只有 ordinal，没有真实 ID、完整 answer/userNote 或写能力。后续 candidate 必须保持同一顺序，并用实际 runtime counter 证明 provider 前关闭。
4. Tutor 模型不能选择 `answer_direct`、生成自由 prompt、改变 route/RAG/approval 或最终回答；本地 merger 重建完整 TutorStrategy。
5. V1--V4 legacy Organizer 模型不能接收/返回 userId、真实 question/deck ID 或写命令，但可返回有界短 topic label；V5 R3 已进一步收敛为 subject/deck/topic ordinal-only，尚未接产品。真实 subject/deck/item、用户锁定名称、WrongQuestion/FSRS 事实和权限始终由本地保持。
6. Organizer snapshot 来自 owner-scoped `REPEATABLE READ + READ ONLY`；provider 前、candidate 后和 advisory-lock 写事务内均验证 fingerprint，模型调用不在事务/锁内。
7. single/batch 每 HTTP request 最多一次 Organizer provider call，batch 最多 12 个 eligible item；其余 deterministic，失败不阻断错题保存。
8. Tutor/Organizer gate 默认 false，分别只读取 Tutor/Organizer component-specific credential，固定 V4 Pro non-thinking JSON、3000/5000ms timeout、no retry/tools；Organizer 仅允许 `SERVER_ROLE=api|both`，worker 强制关闭。Compose 只把 Tutor 三项投影给 `web`、Organizer 三项投影给 `server`，`worker/admin` 均不接收，四个应用 service 都不使用整份根 `.env` 的 service `env_file`。request cap 0.006/0.016 CNY，24-pair Live 总 cap 0.55 CNY。
9. Mock 只证明 contract；唯一 controlled-Live 需 fresh 用户授权，并满足 24/24 zero-call、48/48 strict runtime、critical=0、两个 semantic score >=0.85、各提升 >=0.15 和全部 P95/usage/cost gate。production gate 还必须验证 `executorProvenance=deepseek_network`；`mock_synthetic` / `synthetic_test` 即使满分也不得通过。Tutor orchestration P95 只包含本地 Tutor strategy + candidate，不得写成 Router/API/最终流式 Chat 产品 P95。
10. Tutor Trace 可 best-effort；Organizer model-influenced command 必须有 persisted safe Trace，否则 candidate 不得影响写入。Trace/API/header 不含 prompt、题目/答案正文、model output、key、URL、cookie、token 或 raw error。
11. Docker/API 分别验证 Tutor candidate/explicit zero-call/failure fallback 与 Organizer single/batch/owner/locked-name/zero-call/组织层 write isolation；可见浏览器保持窗口并覆盖 1440/510/390px。
12. 精确清理本轮 synthetic user/question/group/deck/item/Trace/session/browser storage，恢复 mock/gates=false/key absent，保留容器、镜像和卷；禁止 prune、`down -v`、reset、flush 或 wipe。
13. 独立复审无 Critical/Important 后 `--no-ff` 合入 main；main 不重跑已消费 Live，只验证 committed authority、静态门和 default-off Docker/API/浏览器回放，再推送并核对远程 SHA。

Task 6 完成回执：owner snapshot 使用 `REPEATABLE READ + READ ONLY`、域分离 HMAC 和深冻结完整 fingerprint；产品写路径按事务外双 revalidation、model-free command、owner advisory-lock 写事务内第三 fence 执行。missing/cross-owner 同一 404、用户 authority、force 唯一 relation、同主题并发、rename/move 胜出与旧专题复用均有测试。canonical variant 超过 100 条有界 scan 时 fail-closed，不创建可能重复的 deck。focused `23/23`、Server `2122 passed / 30 skipped`、真实 PostgreSQL E2E `9/9`、Database `7/7`、Server lint/build/diff 通过；Task 6 没有 provider、Live、产品 Docker API 或浏览器结论，后续 Task 7 已补齐 default-off runtime/Trace/abort。

Task 7 完成回执：Organizer 使用 server-only 独立 default-off gate/credential，固定 DeepSeek V4 Pro non-thinking JSON、5000ms、`1/3500/800`、`0.016 CNY` cap，worker 强制关闭。single 最多一次 candidate；batch 最多 12 个 eligible 共享一次 candidate，其余 deterministic；candidate 后 stale 不重调 provider。模型结果只有在同一 runId 的 `command_pending` Trace 原子落库后才能影响本地 command；final 替换失败保留 pending，跨 owner runId 无法替换。HTTP abort 贯穿 snapshot/candidate/command preflight 并清理 listener，事务开始后只完成最小本地写入。focused `126/126`、真实 PostgreSQL AgentTrace/Organizer E2E `16/16`、Server full `226/226 suites / 2146 passed / 30 skipped`、Agent `529/529`、AI `194/194`、typecheck/lint/build/diff 与两路独立复审通过；没有读取根 `.env`/key、provider、controlled-Live、Docker 产品或可见浏览器结论，gate 仍默认关闭。下一任务是 Task 8 strict API runtime metadata 与 `/error-book` 来源状态。

Task 8 完成回执：single/batch 顶层现在通过 shared Zod strict schema 返回 request-level runtime，只允许 `source / disposition / degraded / 可选 traceId`；`hybrid_model` 必须是已持久化 Trace 的 `candidate_applied + degraded=false`，本地 runtime 不返回 traceId，未知字段、provider error、token、费用、prompt、owner/question/deck 映射均 fail-closed。batch item 不重复携带 runtime；候选失败的 degraded 结论不会被 deterministic remainder 覆盖。`/error-book` 只在用户主动批量整理成功后显示“语义整理 / 本地规则 / 安全回退”，degraded 优先，并使用 `w-full + min-w-0 + flex-wrap + break-words` 覆盖 390/510/1440px 静态布局；没有模型重试、自动删除/移动/改名或新增 mutation。Types `42/42`、Web `438/438`、Server `2149 passed / 30 skipped`，focused API/view/page/service/controller、typecheck/lint/build 与 diff 门通过；没有读取 key、调用 provider 或执行 controlled-Live/Docker/可见浏览器，两个生产 gate 仍默认关闭。Task 9/10 后续均已完成，Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 结果见下方 Task 12 回执。

Task 9 完成回执：72-case strict paired runner 固定 `24` zero-call、`48` runtime、`24` paired indexes 与 `32` Organizer decision units。zero-call 实际穿过 candidate/preflight guard并由独立 counter 证明 0；runtime throw/schema/usage 失败保留原分母。两次 Mock 均为 `24/24` zero-call、`48/48` strict runtime、Tutor/Organizer semantic `1/1`、P95 `246/328/328/276ms`、synthetic usage `21948/5647`、cost `0.099726 CNY`；`executorProvenance=mock_synthetic`，所以 `quality_gate_failed` 是 Live-only authority 设计，不是 contract 失败。公共 Live CLI 不接受 executor 注入；无网络 marker/evidence 测试固定 `synthetic_test`，production gate 只接受 `deepseek_network`。旧 `chatProduct*` 已更名为 `tutorOrchestration*`，明确不包含真实 Router、HTTP、RAG 或最终流式模型。focused `14/14`、Agent `543/543`、AI `194/194`、typecheck/lint、两次 Mock CLI、bundle validator 与 diff 门通过；没有读取 key、调用 provider、创建 Live marker/evidence 或执行 Docker/浏览器，两个生产 gate仍默认关闭。证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-paired-eval.md`；Task 10 后续已完成，Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 结果见下方 Task 12 回执。

Task 10 完成回执：tracked `docker/.env.example` 固定 mock/live=false、全部 Agent gate=false、Tutor/Organizer 3000/5000ms 与空 component credential；Compose 只把 Tutor 三项给 `web`、Organizer 三项给 `server`，`worker/admin` 均不接收。`admin` 的整份根 `.env` service 注入已移除，只保留显式 URL。resolved Compose synthetic fixture 同时证明 generic/cross-component key 不会穿透边界；worker 还有模块层强制关闭。新 boundary RED `3/3`、GREEN `3/3`，与 readiness 合跑 `24/24`，Server config/Compose focused `29/29`、Tutor config `5/5`、tracked `config --quiet`、Server/Web build 与 diff 门通过。没有读取根 `.env`/key、调用 provider、启动/重建 Docker service、执行 API/浏览器或创建业务数据。证据见 `docs/acceptance/phase-6-9-7-runtime-boundaries.md`；Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 结果见下方 Task 12 回执。

Task 11 完成回执：focused `97/97`；全量 Agent `543/543`、AI `194/194`、Types `42/42 + tsc --noEmit`、Server `227 suites passed / 3 skipped、2152 passed / 30 skipped`、Web `438/438`，相关 lint/build 与 Compose tracked-example quiet config 通过。Organizer PostgreSQL E2E `10/10`，匹配测试账号残留为 0。deterministic baseline 为 `6/48`、critical `0`、Tutor/Organizer/combined semantic `0.4418666667/0.278125/0.3599958333`、provider/token/cost 全 0；fresh Mock run `0c33c01f-802a-4f53-a6e6-538b7af9abc7` 为 `24/24` zero-call、`48/48` runtime、semantic `1/1/1`、usage `21948/5647`、estimated `0.099726 CNY`，Live-only gate 按设计仍为 `quality_gate_failed`。Mock evidence 经 validator 后按精确路径删除；无 credential/provider/Live marker/evidence/产品 Docker/API/浏览器。完整证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-agents.md`；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 结果见下方 Task 12 回执。

Task 12 V1 完成回执：preflight 修复 Router/Verifier 真实 gate 名称后在 clean `5f2cfcdc` 上执行唯一 branch run `39a62241-0f51-45be-a423-0d13b0b60ae4`。`executorProvenance=deepseek_network`，dataset SHA 为 `7ac2f4b5...2207e`；`24/24` zero-call 通过，但 strict runtime 仅 `27/48`。Tutor semantic `0.3485119048`、提升 `-0.0933547619`；Organizer semantic `0.7000000000`、提升 `0.4218750000`。critical/permission/mutation/broader fallback 为 0，P95 全部通过，48 个 usage case、`21288/3759` tokens 与 `0.086418 CNY` 可验证；最终 `quality_gate_failed`。evidence SHA `be044871...3f34b5`、marker SHA `7cb443f1...f6ecffb`，validator 通过。V1 不得重跑；产品 Docker/API/浏览器与 synthetic 业务数据均未启动，Docker 数据未清理。Phase 6.9.7 未完成，Task 13 不得开始；下一步先做零网络 V2 remediation。

V2 R7 完成回执：唯一 branch run `67ce18dd-e2ed-4a05-8507-2a98898b8ede` 使用
runner-v2、冻结 dataset/SHA、两个 v2 prompt 与 `deepseek_network`。`24/24` guard zero-call
通过，但 Tutor/Organizer 各 24 个 runtime 都在 structured object 前
`fallback_runtime_error`，最终 `0/48` strict runtime、semantic `0/0`、critical `1`、verified
usage `0`、pricing/cost 不可验证，gate 为 `quality_gate_failed`。evidence/marker SHA 分别为
`0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77` /
`ac65ac67bd155f448e498a2c1dd9d7762d1efb4cc720a3cf1153083299c98504`。原始异常未保存，
不能指定 credential/网络/model/endpoint/prompt 单一根因。V2 不得重跑，产品验收未启动。

V3 R0 完成回执：复盘确认 runtime 已有固定 Provider failure category/structured stage，但 paired
case builder 未投影，safe wrapper 还会统一失败并猜测 invocation；scheduler 在首个失败后继续
pair。V3 冻结新 identity、zero-network compatibility harness、真实 dispatch/usage outcome、24
guard 先行、单 pair 最大双并发、首个 runtime contract failure 后 breaker、固定 48 分母、双 lane 隔离、
append-only journal、crash-only seal 与 hard-link evidence。R0 没有 source/credential/provider/
Docker/API/browser/业务数据操作；当时下一步仅 R1 zero-network implementation。完整设计见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v3-remediation-design.md`。

V3 R1 完成回执：新增 `phase-6.9.7-tutor-organizer-runner-v3`、两个 v3 prompt identity 和
`phase-6.9.7-v3-runtime-evidence-v1`，prompt bytes 继续绑定 V2 深冻结 policy，稳定 hash 为
`sha256:91be509194de33c8d99d7a09fa6ef387c6f31aa06d19d8fd970800731047fc6a` /
`sha256:2947cea2a7bc5d64c9daf29d8b371e9825bc0423d707ff173a2c5057ee9fdffd`。投影只接受固定
Provider category、structured-output stage、十阶段单调 ledger 与 execution/usage 枚举；outer
harness dispatch 前后分别保留真实 invocation `0/1`，不猜测或复制 Provider 类别。V1/V2 新字段
保持完全 absent。config/factory/request/non-thinking response audit/schema/abort compatibility matrix
仅使用 sentinel/fake fetch，focused `52/52`、Agent `596/596`、AI `199/199`、V1/V2 validator 与
四个历史 SHA 已通过，V3 Live artifact 为 0。未读取根 `.env`/credential、未调用 Provider、未启动
Docker/API/browser。证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r1-diagnostics-compatibility.md`；该检查点当时下一步仅
R2，后续已完成。

V3 R2 完成回执：独立 V3 paired scheduler 先执行全部 24 条 guard；任一 guard 失败时 48 条
runtime 保留固定分母且实际 dispatch 为 0。runtime 按 pair 顺序推进，同 pair 的 Tutor/Organizer
分别使用独立 AbortController、预算与故障归属；首个 runtime contract failure 打开
`quality_gate_impossible`，收口当前 pair 后停止后续派发。未执行 case 记录
`not_started_quality_breaker`；sibling 忽略 abort 时最多等待 1000ms 并记录
`attempted_orphaned/unknown_after_attempt`，不复制触发 lane 的 Provider category。
`(runId,agent,pairedRunIndex)` ledger 拒绝重复 dispatch；semantic-only mismatch 不提前熔断，
schema/usage/abort/harness failure、lane budget 串用、P95/usage/价格不完整与派生 summary 篡改均
fail-closed。focused `29/29`、Agent `608/608`、AI `199/199`、Agent/AI typecheck/lint、V1/V2
validator、四个历史 SHA、V3 Live artifact=0、Prettier/diff 与两路复审通过。没有读取
credential、调用 Provider、启动 Docker/API/browser 或创建 V3 Live artifact。证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r2-breaker-lane-ledger.md`；该检查点当时下一步仅 R3
独立 CLI/journal/crash-only seal/evidence，后续 R3 已完成。

V3 R3 完成回执：新增 V3 专用 CLI、确认词、授权变量、marker、journal、evidence prefix 与
validator；三版 filename/schema/validator 双向拒绝。marker 以 `wx` 单胜者预留，journal 初始化
fsync 早于 executor 创建，每条 `dispatch_started` fsync 早于对应 executor。append-only journal
通过 sequence、previous SHA、record SHA 与严格 lifecycle state machine 拒绝乱序、重复 terminal、
重复 dispatch、seal 后追加和 identity mismatch。活 marker owner 返回
`live_attempt_in_progress`；死 owner 使用 token recovery claim 单胜者接管，同 claim 只允许一个
appender，takeover 后旧 appender/release 被 fence。零网络 seal 对 dispatch 无 terminal 写
`attempted_orphaned/unknown_after_attempt`，对未 dispatch 写
`not_started_orphaned/absent_not_attempted`，保留固定 72/24/48 分母且永不 resume/replay/retry。
evidence 以随机 temp `wx` + fsync + hard-link final 发布，same bytes 幂等、different bytes 冲突。
durability `21/21`（`228` assertions）、V3 focused `50/50`（`360` assertions）、Agent
`629/629`（`6710` assertions）、AI `199/199`（`1054` assertions）、typecheck/lint、V1/V2
validator、四历史 SHA 与 V3 Live artifact=0 通过。没有读取根 `.env`/credential、调用 Provider、
启动 Docker/API/browser、修改业务数据或开始 Task 13/main。证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r3-crash-safe-evidence.md`；该检查点当时下一步仅 R4。后续 R4 已完成；该检查点当时停在新的 V3 branch controlled-Live 精确授权门，后续 R5 已失败封存。

V3 R4 完成回执：fresh V3 Mock run `116cc321-962f-426c-8a91-f05ab8debc93` 为 `24/24`
zero-call、`48/48` strict runtime、Tutor/Organizer/combined semantic `1/1/1`、P95
`246/328/328/276ms`、usage `21948/5647`、estimated `0.099726 CNY`；Mock 仍按 Live-only
authority 为 `quality_gate_failed`，validator 通过后 evidence 已精确删除。首对 strict failure 的
breaker report 只启动 Tutor/Organizer 各一次，余下 46 runtime 为 zero-call 且固定分母仍为 48。
Agent `629/629`、AI `199/199`、Types `42/42`、Server `2154` tests、Web `439/439`、Organizer
PostgreSQL E2E `12/12`、Compose quiet 与相关 typecheck/lint/build 通过；测试账号残留为 0。V1/V2
四 SHA 和 validator 不变，V3 Live artifact=0，tracked gates=false、component credential empty。
没有读取根 `.env`/key、调用 Provider、启动产品 API/browser 或开始 Task 13/main。证据见
`docs/acceptance/2026-07-25-phase-6-9-7-tutor-organizer-v3-r4-static-mock.md`；R4 当时必须停在新的 V3
branch controlled-Live 精确授权门；后续 R5 结果如下。

V3 R5 失败回执：用户精确授权的唯一 branch run
`ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc` 使用 DeepSeek V4 Pro non-thinking JSON；`24/24`
guard zero-call 通过。第 14 对 Organizer 的 `organizer-runtime-14` 在结构化对象形成后、本地
`dynamic_contract` 命中 `subject_authority_violation`，breaker 进入
`quality_gate_impossible`。最终 executor/usage verified `28/28`、strict runtime `27/48`、剩余
20 个 runtime 为 `not_started_quality_breaker`；Tutor/Organizer/combined semantic 为
`0.5280555556/0.4376201923/0.4828378739`。Latency 分母不完整，authority P95、pricing profile 与
total CNY 均为 `null`，最终 `quality_gate_failed`。

V3 marker/journal/evidence SHA 分别为 `b18a768...be412` / `df14187...d6cff` /
`e24f4e6...22d25c`；file/bundle validator 通过，98 条 journal 以 `breaker_opened ->
run_completed(failed) -> evidence_sealed` 结束，recovery claim 为 0。V1/V2 四 SHA 与 validator
不变，tracked gates=false、component credential empty。V3 不得重跑；R6--R9、产品
Docker/API/browser、Task 13/main 与 Phase 6.10 均不得开始。证据见
`docs/acceptance/2026-07-25-phase-6-9-7-tutor-organizer-v3-controlled-live-failure.md`。

V4 R0 完成回执：只读 V3 bounded evidence 后，Tutor 14 个已执行 runtime 中有两个
`socratic_hint` 和一个 `step_check` 被降级为 `general_follow_up`；10 个 invalid Tutor case 是
breaker 后未执行项。Organizer 14 个已执行 decision 的 subject/action/accepted-topic/
confidence/required-evidence 命中为 `13/14、14/14、5/14、12/14、10/14`；首错只能确认是本地
subject-authority dynamic contract，不能从后置 topic/evidence observation 猜测 raw output 或
Provider 根因。

V4 已冻结新的 runner/prompt/runtime-evidence/approval/marker/journal/evidence/validator identity，
以及细粒度 bounded diagnostics、Tutor/Organizer 单一语义 policy、independent held-out/metamorphic
与 anti-leakage。Dataset/SHA/baseline/`0.85/0.15` 质量门、权限、预算、no-retry、固定分母和
V3 breaker/journal 原则不变；merger 不得自动补 evidence 或修正越权 subject。R1--R5 只允许
zero-network/static/Mock；checkpoint 与新的精确授权完成前不得执行 V4 Live。证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r0-zero-provider-postmortem.md`。

V4 R1 完成回执：新增独立 `phase-6.9.7-v4-bounded-diagnostics-v1`，case 必须互斥为
not-started、contract failure、semantic mismatch 或 semantic match；合同失败另固定
provider/schema/dynamic/merger/usage/latency/safety stage。Tutor 只保留七个布尔语义轴，Organizer
只保留 subject/deck/topic/evidence/confidence 五轴；任何题目、prompt、raw output、Provider 原始
错误、真实 ID 或凭据都不进入该合同。

Organizer 已使用唯一 `context/index -> subject -> deck -> topic -> evidence -> confidence` validator
reason 链；legacy API 只映射同一结果，产品 merger 复用成功 validation 且仍由本地掌握 ID、名称和
写权限。72-case report aggregate 必须由 entries 重算；重复、篡改、跨 agent、guard/runtime 错配和
额外字段全部 fail-closed。V1/V2/V3 V4 字段 absent、旧 validator 拒绝 V4、V4 validator 拒绝旧
report，synthetic SHA 不变。focused `32/32`、Agent `635/635`、typecheck/lint/Prettier/diff check
通过；未读取 credential、调用 Provider、创建 V4 runner/CLI/Live artifact、启动 Docker/API/browser
或修改业务数据。后续 R2 已完成；R5 与新精确授权前不得执行 V4 Live。证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r1-bounded-diagnostics.md`。

V4 R2 完成回执：Tutor V4 使用唯一深冻结 policy，precedence 固定为
`step_check > explain_solution > concept_bridge > socratic_hint > general_follow_up`。以下项目必须共用
该 authority：prompt formatter、primary/allowed evidence validator、evidence resolver、depth
compatibility、candidate merger，以及本地 context/guiding/final-answer/answer-structure invariants。

- [x] active context 只能支持、不能压过具体 primary intent；
- [x] merger 拒绝把已识别的具体 local intent 降级到更低 precedence；
- [x] `general_follow_up` 只由 contextual/ambiguous 且无具体 primary signal 支撑；
- [x] `answer_direct` 不进入模型 schema，继续 provider 前 zero-call；
- [x] 中英文否定 final-answer 表达不提升为 `answer_direct`；
- [x] V4 prompt 无 case ID、expected/accepted label、答案、route/tool/permission/write 能力；
- [x] deterministic detector/baseline 不按 V4 model precedence 重排；
- [x] 历史 paired eval 显式走 V2 policy，V3 prompt SHA 与 V1/V2/V3 artifacts 不变；
- [x] dataset/SHA/expected/metric/threshold/budget/no-retry 不变；
- [x] 未读取 credential、调用 Provider、启动 Docker/API/browser 或修改业务数据。

该检查点当时下一步仅 R3 WrongQuestionOrganizer policy，后续已完成；R4/R5 前不创建 V4 Live
lineage，R5 checkpoint 与新的精确授权前不得执行 V4 Live。证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r2-tutor-semantics.md`。

V4 R3 完成回执：WrongQuestionOrganizer V4 使用唯一深冻结 decision matrix，formatter、dynamic
validator 与 merger 共用 `context/index -> subject -> deck -> topic -> evidence -> confidence`
authority；产品默认 identity 为 `wrong-question-organizer-model-candidate-v4`。

- [x] known subject 只能 `keep_local + structured_subject`，unknown subject 禁止 `keep_local`；
- [x] `reuse_existing` 只引用同学科 deck ordinal，并要求 `existing_deck_overlap`；
- [x] `create_topic` 只接受安全、精确、有题意依据的 topic；
- [x] 明确 `errorType` 要求 `error_pattern`，具体题意要求 `semantic_topic`；
- [x] `insufficient_signal` 仅允许 medium，且不能与正向 evidence 混用；
- [x] high confidence 只由结构化 category/knowledge point、明确错误模式或同学科 overlap 支撑；
- [x] merger 不补 evidence、不纠正越权 subject、不清洗非法 topic；
- [x] owner、ordinal、locked-name、前后 stale fence、single call、budget、abort、no-retry 不变；
- [x] 历史 paired eval 显式走 Organizer V2 candidate，V2 formatter 与 V3 prompt SHA 不变；
- [x] dataset/SHA/baseline/expected/metric/threshold 与 V1/V2/V3 artifacts 不变；
- [x] 未读取 credential、调用 Provider、启动 Docker/API/browser 或修改业务数据。

该检查点当时下一步仅 R4 independent robustness 与 V4 lineage，后续已完成；R5 checkpoint 当时
仍需新的精确授权才可执行 V4 Live。后续唯一 R6 已失败封存且不得重跑。证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r3-organizer-semantics.md`。

V4 R4 完成回执：新增与冻结 72-case dataset 隔离的
`phase-6.9.7-v4-independent-robustness-v1` fixtures，并直接验证实际 V4 candidate prompt 与运行合同。

- [x] Tutor 中英/混合改写、否定、干扰、active-context reorder 与 primary-signal conflict 保持 V4 precedence；
- [x] Organizer authority drift、question/deck reorder、locked name、cross-subject/ordinal/topic/evidence/confidence/schema-negative 全部 fail-closed；
- [x] actual prompt 不包含 case ID、expected、accepted-label、oracle 或冻结答案表；
- [x] Tutor/Organizer lane 独立 abort/预算，single dispatch、no retry 与 write isolation 不变；
- [x] V4 runner/report/evidence envelope 继续固定 72/24/48，guard failure 零 dispatch，首个 contract failure 只收口当前 pair 后 breaker；
- [x] V4 marker `wx` 单胜者，journal append+fsync 与 hash-chain 拒绝乱序/篡改/跨版本；
- [x] recovery claim 防活 owner 误封与 ABA，orphan 只做零网络 seal，不 resume/replay/retry；
- [x] evidence 以 temp `wx` + fsync + hard-link final 发布，same bytes 幂等、different bytes 冲突；
- [x] V1/V2/V3 marker/journal/evidence bytes、validator 与七个 SHA 不变；
- [x] V4 Live CLI 在 R6 前固定返回 `live_not_available_before_r6`。

V4 durability `6/6`（`41 expect()`），R4/V3 focused `68/68`（`548 expect()`）、Agent full
`674/674`（`7094 expect()`）、typecheck/lint 通过。未读取 `.env`/credential、调用 Provider、启动
Docker/API/browser、创建 V4 Live artifact 或修改业务数据。V4 R0--R4 已完成；该检查点当时下一步仅
R5 static/Mock checkpoint 与两路独立终审，后续已完成。R5 当时仍须新的精确一次性 V4
controlled-Live 授权；后续唯一 R6 已失败封存。证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r4-robustness-lineage.md`。

V4 R5 完成回执：fresh Mock run `c1bdf998-6fae-4c32-a4e3-bd6bea053454` 为 `24/24` verified
zero-call、`48/48` strict runtime、Tutor/Organizer/combined semantic `1/1/1`，P95
`246/328/328/276ms`、usage `21948/5647`、estimated `0.099726 CNY`；V4 validator 通过。
`mock_synthetic` 不是 Live authority，因此 gate 按设计保持 `quality_gate_failed`；唯一 Mock evidence 已
按 run ID 精确删除，V4 Live marker/journal/recovery/evidence 为 0。

V4/V3 focused `68/68`（`548 expect()`）、Agent `674/674`（`7094 expect()`）、AI `199/199`
（`1054 expect()`）、Types `42/42`、Server `2154 passed / 30 skipped`、Web `439/439`、Organizer
PostgreSQL E2E `12/12`、Compose quiet、相关 typecheck/lint/build 与两路终审通过；测试账号残留为 0，
tracked gates=false、component credential example empty，V1/V2/V3 validators 与七个历史 SHA 不变。
未读取根 `.env`/credential、调用 Provider、启动产品 Docker/API/browser 或修改业务数据。V4 R0--R5
已完成；该条是 R5 当时停止在 R6 授权门前的 checkpoint。后续唯一 R6 已失败封存。证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r5-static-mock.md`。

V4 R6 完成回执：唯一 run `0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f` 已以
`completed_run / quality_gate_failed` durable seal。`24/24` guard verified zero-call；runner 完成前 6 对，
共启动 12 个 executor，得到 10 个 strict runtime。第 6 对 Tutor 的 raw schema 通过，但在本地
`dynamic_contract` 命中 `invalid_evidence_association`；Organizer sibling 为
`attempted_aborted / unknown_after_attempt`。Breaker 打开后剩余 36 runtime 为
`not_started_quality_breaker`，固定 48 分母不变。

- [x] Tutor/Organizer/combined semantic 为 `0.14410714285714285/0.10372596153846154/0.1239165521978022`；
- [x] critical/permission/mutation/broader fallback 与 Provider failure category 均为 0；
- [x] 11 个 verified usage 为 `9445/652` tokens，可核验部分费用 `0.032247 CNY`；
- [x] 1 个 usage unknown，因此完整 pricing/total CNY 与四个 P95 均为 `null`；
- [x] evidence/journal/marker SHA 分别为 `6ec60be1...d94608`、`8cc65e21...3188e`、`601f62b6...dae2`；
- [x] 58 条 hash-chain journal 与 file/bundle validator 通过，V1/V2/V3 validators 和七个 SHA 不变；
- [x] 未启动产品 Docker/API/browser，未创建 synthetic 产品数据，tracked defaults 保持关闭。

V4 一次性名额已消费且不得重跑；R7--R9、Task 13/main、Phase 6.10 与博客收尾不得开始。若继续只能
先建立与 V1--V4 双向隔离的零 Provider remediation。完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-controlled-live-failure.md`。

V5 R0 完成回执：零 Provider 差分回归 `7 pass / 0 fail / 34 expect()`。

- [x] V1 dataset SHA 保持 `7ac2f4b...2207e`，未改写 frozen case；
- [x] `tutor-runtime-06` 被证明为中文代数 latest text + 英文微积分 active context + 错误 `en` tag；
- [x] `step_check + submitted_step` 与附加 contextual evidence 均为 `candidate_applied`；
- [x] 缺 primary 或错误 evidence 均由产品 candidate 返回
      `fallback_schema_invalid / invalid_evidence_association`；
- [x] canonical diagnostic 如实映射为 `dynamic_contract`，adapter 未单独改判；
- [x] V4 前 5 对中文 Tutor 与 Organizer topic/subject semantic mismatch 继续保留，不因 fixture 缺陷
      翻案；
- [x] 未读取 credential、调用 Provider、创建 V5 artifact、启动 Docker/API/browser 或修改业务数据。

V5 R1 完成回执：聚焦测试 `8 pass / 0 fail / 346 expect()`，Agent 全量
`690 pass / 0 fail / 7600 expect()`；Agent typecheck/lint、Prettier、diff check、本轮 Markdown 本地链接
检查与 V1--V4 四个历史 evidence validator 均通过。

- [x] 新 V2 dataset 固定 `72/24/48/24`、Tutor/Organizer 各 `12+24`，Organizer 32 decision units；
- [x] Tutor runtime 显式 `12 zh / 10 en / 2 mixed`，language/family/latest/context fail-fast coherence；
- [x] Organizer structured/taxonomy subject、3-topic candidates、hidden expected ordinal 与 20/1/3 batch relation 冻结；
- [x] prompt-safe projection 不含 expected、selected ordinal、case/owner/question/deck ID 或 V1 identity；
- [x] dataset/policy/baseline SHA 为 `42803d45...b437b`、`b3913403...f009d`、`0ce7c3ca...116ca`；
- [x] quality gate 固定 semantic `>=0.85`、absolute improvement `>=0.15`、strict `48/48`、guard `24/24` 与安全/延迟/usage/费用边界；
- [x] deterministic baseline `12/48`，Tutor/Organizer/combined `0.6629642857/0.278125/0.4705446429`，Provider/usage/cost 为 0；
- [x] V1 canonical dataset 现场重算 SHA 仍为 `7ac2f4b...2207e`，V1--V4 evidence/validator 未改；
- [x] 两路只读终审无未关闭 Critical/Important；
- [x] 未实现 V5 candidate/paired Mock/Live runner/network CLI，未读取 credential、调用 Provider、启动 Docker/API/browser 或修改业务数据。

该检查点当时的下一步 V5 R2 后续已完成。完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r1-dataset-authority.md`。

V5 R2 完成回执：聚焦测试 `12 pass / 0 fail / 859 expect()`，Agent 全量
`702 pass / 0 fail / 8478 expect()`；Agent typecheck/lint、Prettier 与 V1--V4 四个历史 evidence
validator 均通过。

- [x] `tutor-local-signal-authority-v1` 冻结 latest-text-only detector、否定/引用语境、precedence、
      eligible intent/depth、provenance 与 canonical authority SHA；
- [x] rules/prompt/held-out SHA 为 `a1e9a3b...f4892`、`7c7442ff...c5f87`、
      `d08e8ed5...8ab55`；
- [x] 模型 strict output 仅 `intent/depth/confidence`，不含 evidence、答案、route/tool/permission/write；
- [x] 具体 primary intent 不得降级为 general，active context 不能创建或提升具体 intent；
- [x] 32 条独立 held-out 固定 `13 zh / 12 en / 7 mixed`，覆盖 FP/FN、否定、引用 distractor、
      conflict precedence、context mutation、strict schema、zero-call、single-call/no-retry 与 prompt
      leakage；
- [x] 冻结 V2 Tutor 24 条 runtime detector 对照为 `24/24`；
- [x] 两路只读终审最终无 Critical/Important；
- [x] 未接 product/provider/gate/paired runner，未读取 credential、启动 Docker/API/browser 或修改业务数据。

该检查点当时的下一步 V5 R3 后续已完成。完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r2-tutor-local-signal-authority.md`。

V5 R3 完成回执：聚焦测试 `13 pass / 0 fail / 469 expect()`，Agent 全量
`715 pass / 0 fail / 8965 expect()`；Agent typecheck/lint、根 Web/Server lint、Prettier 与 V1--V4
四个历史 evidence validator 均通过。

- [x] `wrong-question-organizer-shortlist-v5` 冻结 question/deck/topic 稳定排序、规范化去重、duplicate
      deck folding 与 owner-snapshot canonical fingerprint；
- [x] rules/prompt/held-out SHA 为 `9747383...1299d3`、`915084a8...ac69ab`、
      `49336b12...ee097`；
- [x] 模型 strict output 仅 question、subject、deck/topic ordinal 与 confidence，不含自由 subject/topic/
      deck 名称、真实 ID、evidence、answer、route/tool/permission/write；
- [x] structured subject、taxonomy、same-subject deck/topic、locked name 与 command binding 全由本地
      validator/merger 掌权；
- [x] 24 条独立 held-out 固定 `8 zh / 8 en / 8 mixed`，覆盖冻结 V2 全部 32 Organizer decision、
      same/cross-subject batch、reorder/分页/去重/ABA/stale、strict schema、zero-call、single-call/no-retry、
      输入不变与 prompt leakage；
- [x] candidate preflight budget 是 preview，runtime 基于未消费 caller budget 执行唯一实际 reservation，
      无双扣；
- [x] 两路只读终审无 Critical；代码复审预算项经源码与回归关闭，R3 范围测试缺口已补齐；
- [x] 未接 product/provider/gate/paired runner/Trace persistence，未读取 credential、启动 Docker/API/
      browser 或修改业务数据。

该 R3 检查点当时的下一步 V5 R4 已完成。完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r3-organizer-ordinal-shortlist.md`。

V5 R4 完成回执：新增原生 V5 report/runner/CLI/marker/hash-chain journal/hard-link evidence/validator，
固定 `72 cases / 24 guards / 48 runtime / 24 pairs / 32 Organizer decisions`。聚焦测试
`26 pass / 0 fail / 145 expect()`，Agent 全量 `741 pass / 0 fail / 9128 expect()`；Agent
typecheck/lint、Web/Server lint、Prettier、diff check、四份历史 evidence SHA/validator 与两路独立复审
均通过。

- [x] 24 guard 先行，单 pair 调度且 pair 内最多双 lane；首个 runtime contract failure 熔断，未执行项
      仍保留固定分母；
- [x] report schema 从 entries 重算 canonical identity、decision denominator、semantic、usage、safety、
      latency 与 gate，拒绝 partial/tampered aggregate；
- [x] usage/latency/semantic 不完整时 aggregate 为 `null`，不能伪装零成本或质量通过；
- [x] dispatch journal 在 lane/Provider 前 append+fsync；marker/journal/evidence 任一持久化失败消费名额；
- [x] 活 owner 不得误封，dead owner 只允许单胜者 recovery；ABA/tail drift、重复 dispatch、post-seal
      append、不同字节覆盖均 fail-closed；
- [x] recovery 只封存 orphan/unknown usage，不 resume/replay/retry Provider；
- [x] V5 validator 与 V1--V4 validators 双向拒绝 lineage/source/partial/getter/cycle/symbol-key 污染；
- [x] `synthetic_test` Live 固定 `quality_gate_failed`，只有 `deepseek_network` provenance 才可能成为
      quality authority；
- [x] 未读取 `.env`/credential、调用 Provider、接 product composition/gate/Trace persistence、启动
      Docker/API/browser、修改业务数据或创建 V5 Live artifact。

该 R4 检查点当时的下一步 V5 R5 已完成。完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r4-runner-lineage.md`。

V5 R5 完成回执：新增 reviewed public Mock factory 与默认 Mock CLI 路径。Fresh V2-dataset baseline 为
`12/48`、semantic `0.6629642857/0.278125/0.4705446429`；fresh Mock 为 `24/24` zero-call、
`48/48` strict runtime、semantic `1/1/1`。48 次 invocation 是 synthetic Mock executor 计数，不是真实
Provider call；Mock evidence 已精确删除，V5 Live marker/journal/evidence/recovery claim 仍为 0。

- [x] V5 focused `62/62`（1570 assertions）、Agent full `745/745`、AI `199/199`、Types `42/42`；相关 typecheck/
      lint/build 通过，Types 既存 lint 工具解析缺口未冒充成功；
- [x] Web `439/439` 与 17-page production build、Server Docker boundary `3/3` 与 build 通过；
- [x] Organizer PostgreSQL concurrency E2E `12/12`，Compose tracked default-off quiet config 通过；
- [x] V1--V4 evidence SHA 与四版 validator 不变；V5 Live artifact=0；
- [x] contract/security/concurrency 与 docs/history/operations 两路只读终审无 P0--P2；
- [x] 未读取 `.env`/credential、调用 Provider、接产品 gate、启动 Docker/API/browser 或修改业务数据。

V5 R6 失败封存回执：

- [x] 唯一 run `aa637d3a-f7c4-4549-a724-9cdbefdd89c8` 使用 `deepseek_network`，disposition 为
      `completed_run`，最终 `quality_gate_failed`；
- [x] `24/24` guard verified zero-call，6/6 pairs、12/12 dispatch/terminal，无 duplicate；
- [x] `11/48` strict runtime；第 6 对 Tutor `tutor-v2-runtime-06` 为
      `runtime_timeout (3021ms > 3000ms)`，后续 36 runtime 为 `not_started_quality_breaker`；
- [x] critical/permission/mutation/broader fallback/Provider failure 均为 0；
- [x] incomplete semantic、四类 P95、aggregate input/output/CNY 全部为 `null`；11 条 usage 的
      `9761/902`、`0.034695 CNY` 仅作诊断 subtotal；
- [x] evidence SHA `84487b448acd7bd5e65cd523eb7556cd9b3175bc9ba44572e06a78157c45b70a`，
      V5 validator `ok=true`；marker/58-record journal/evidence 已 seal，无 recovery claim；
- [x] V1--V4 evidence SHA/validator 不变；未启动 Docker/API/browser、创建产品账号或修改业务数据；
- [x] 一次性名额已消费，禁止 retry/replay/resume、R7、Task 13/main、Phase 6.10、Phase 8/9 与博客
      收尾。

该段记录 V5 R6 当时的停止点；后续 V6 R0--R4 已完成。R5 checkpoint 与 R6 failure authority 分别见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r5-static-mock.md` 与
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v5-controlled-live-failure.md`。

V6 R0 零 Provider 设计回执：

- [x] V5 run/artifact/SHA/validator 保持不可变，未 retry/resume/replay 或改写正式 `null` 聚合；
- [x] 区分 executor hard timeout、runtime trace、candidate orchestration、paired duration 与 quality P95，
      不把 21ms overshoot 无证据归因到 Provider；
- [x] 冻结 Tutor hard timeout/P95 `3500/2500ms`，Organizer `5000/4500ms` 不变；nearest-rank P95 的
      24-sample gate 固定取升序第 23 个值；
- [x] 冻结 Tutor preferred-depth 与 Organizer confidence local authority；Tutor intent 至少 `21/24`，
      Organizer subject action/ordinal、deck action、target ordinal 三门各至少 `28/32`；
- [x] V2 dataset/expected/baseline bytes/SHA 不变，V6 使用独立 eval/prompt/authority/runner/approval/
      marker/journal/evidence/validator identity；
- [x] 未修改业务源码、读取 credential、调用 Provider、启动 Docker/API/browser 或修改业务数据；
- [x] 用户允许时延边界重评估只记录为设计许可，不是 Live 授权；该段当时下一步为 V6 R1。

完整证据见
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r0-zero-provider-design.md`。

V6 R1 zero-provider source-contract 回执：

- [x] V6 dataset binding/eval policy identity 独立冻结，并在加载时重算 SHA；V2 dataset SHA
      `42803d45...b437b` 与 baseline SHA `0ce7c3ca...116ca` 保持不变；
- [x] Tutor hard-timeout policy 为 `3500ms`、quality P95 为 `2500ms`；Organizer `5000/4500ms`、paired
      `4500ms` 与 Tutor orchestration `6500ms` 均未放宽；
- [x] nearest-rank P95 强制恰好 24 个样本、固定取 zero-based index 22/升序第 23 值，调用方不能覆盖
      分母；23/25/null/NaN/hostile input 均 fail-closed；
- [x] Tutor/Organizer/paired/orchestration 任一 latency lane 不完整时，`complete=false` 且四个 P95
      全部为 `null`，不得排除 timeout 后继续计算；
- [x] Tutor intent 固定至少 `21/24`；Organizer subject decision、deck action、target ordinal 三门各固定
      至少 `28/32`，action 错误时 target ordinal 同时计 false；
- [x] Tutor preferred depth/final strategy 与 Organizer confidence 由本地 authority 重建，模型字段不能
      抵消 model-owned failure；
- [x] V5 Tutor timeout 仍为 `3000ms`，V5 policy SHA 与 V1--V5 source/artifact 未改写；
- [x] focused `15/15`、Agent full `768/768`、typecheck/lint 与两路独立复审通过；
- [x] R1 只验证 fingerprint shape/snapshot/subject/target contract；actual owner shortlist/fingerprint、
      pre/post stale、ABA、locked-name 与 ordinal association 留给 R2；
- [x] 无 candidate/产品 composition/runner/marker/Mock/Live、credential/Provider、Docker/API/browser 或
      业务数据操作；该检查点当时下一步仅 V6 R2，后续 R2 已完成且仍为 zero-provider。

完整证据见
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r1-source-contracts.md`。

V6 R2 zero-provider bounded-candidate 回执：

- [x] 新增公开 `@repo/agent/tutor-v6`；模型 strict output 仅 `{ intentIndex }`，projection 只含安全文本、
      active-context availability、authority SHA 与 eligible ordinal；
- [x] Tutor preferred depth、context use、guiding/final-answer、answer structure 与最终 TutorStrategy 全由
      本地 authority 重建；route/safety/明确指令/abort/预算失败在 runtime 前 zero-call；
- [x] 新增公开 `@repo/agent/wrong-question-organizer-v6`；模型只返回 shortlist fingerprint 与
      subject/deck/topic ordinal，不接触真实 ID、locked name、confidence、reason 或写 command；
- [x] Organizer 在 runtime 前后重新派生 V5 actual owner shortlist，严格核对 owner domain、snapshot
      version/fingerprint、shortlist fingerprint，stale/ABA/cross-subject/ordinal/locked-name 失败整批回退；
- [x] confidence 由结构化信号、knowledge-point/category/error-type 与有界同 subject overlap 本地重建；
      跨语言阅读 overlap 只使用固定等价组，不把所有 reuse 自动判 high；
- [x] 公共 merger 把 validated-shaped 输入还原为 raw ordinal decision 并重新执行完整 validator，拒绝空/
      重复 ordinal、伪造 resolved subject 与 locked-name collision；
- [x] 独立 robustness fixture 覆盖五类 Tutor intent、双语/mixed/否定/引用/context、Organizer 六学科、
      reorder/owner/stale/ABA/locked name，以及实际 prompt 递归 leakage 与污染反例；
- [x] Tutor/Organizer prompt SHA 为 `4f73ae60...a169` / `c5f1f662...3450`，robustness fixture SHA 为
      `314543fe...904b`；V2 dataset/baseline SHA 保持不变；
- [x] focused `24/24`（989 assertions）、Agent full `792/792`（10458 assertions）、typecheck/lint 与
      独立复审通过；expected-driven no-network Mock 只证明 projection/validator/merger，不证明真实模型质量；
- [x] 无产品 composition/gate/Trace persistence、runner/CLI/marker/journal/evidence/Mock/Live、credential/
      Provider、Docker/API/browser 或业务数据操作；该检查点当时下一步仅 V6 R3，后续 R3 已完成。

完整证据见
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r2-bounded-candidates.md`。

V6 R3 zero-provider runner/lineage/durability 回执：

- [x] 新增原生 V6 report/case/evidence schema、paired runner、CLI/approval 与 evidence validator；没有
      从 V1--V5 report 转换、嵌入或拼接；
- [x] 固定 `72/24/48/24/32` 分母、24 guard 先行、pair 串行/双 lane、单 dispatch/no-retry、首个
      runtime contract failure breaker；semantic/model-owned mismatch 不误熔断；
- [x] Tutor/Organizer hard timeout `3500/5000ms` 与单调 deadline/overshoot 接 runner；任一 lane 不完整时
      semantic、四 P95、aggregate token/CNY 全部为 `null`；
- [x] Tutor intent `21/24` 与 Organizer subject/deck/target 三轴各 `28/32` 独立重算，本地 depth/
      confidence 不能抵消模型自有失败；
- [x] marker `wx`、journal 初始化和 dispatch-before-call 文件 fsync、append queue/hash-chain、live-owner、
      dead-owner 单胜 recovery、ABA/tail drift、crash-only seal 与 same-byte hard-link evidence 已覆盖；
- [x] synthetic Live 强制 `quality_gate_failed`；只有未来 `deepseek_network` 可能通过。该 R3 检查点
      当时公共 Mock 无正式 factory 并返回 `mock_harness_unavailable_before_r4`，后续 R4 已完成；
- [x] V6 validator 枚举拒绝 V1--V5 runner/prompt/projection/policy/marker/journal/evidence/recovery，
      V1--V5 validators 同样拒绝 V6 envelope；
- [x] focused `32/32`（225 assertions）、Agent full `824/824`（10727 assertions）、typecheck/lint/
      Prettier 与三路只读复审通过；
- [x] 已知边界保留：只有文件 fsync、无父目录 fsync；claim tail 校验在 appender/seal 二次执行；缺
      stale claim rename 后再次崩溃专测；
- [x] 未读取 credential、调用 Provider、创建仓库真实 V6 marker/journal/evidence/recovery claim、启动
      Docker/API/browser、接产品或修改业务数据；R3 在 R4 前完成，后续 R4 已完成。

完整证据见
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r3-runner-lineage.md`。

V6 R4 zero-provider static/Mock checkpoint 回执：

- [x] 新增公开 `@repo/agent/phase-6-9-7-v6-mock`、reviewed V6 Mock factory、
      `eval:phase-6-9-7:v6:baseline` 与 `eval:phase-6-9-7:v6:mock`；
- [x] 默认 Mock 真实经过 V6 Tutor/Organizer candidates、strict validators、本地 authority mergers 与
      正式 runner；24 guard 不构造 runtime，48 runtime 各一次 synthetic invocation，无重试；
- [x] Mock duration 使用单调时钟而非 V5 固定 latency；output token 为正且受 cap 校验，费用固定
      `0 CNY`，不冒充 Provider usage/账单；
- [x] fresh V2 baseline 为 `12/48`、semantic `0.6629642857/0.278125/0.4705446429`，dataset/baseline SHA
      保持 `42803d45...b437b` / `0ce7c3ca...116ca`；
- [x] fresh V6 Mock run `88d72b3c-b1b9-4b4d-bb56-903b04b437b0` 为 `24/24` zero-call、`48/48`
      strict runtime、semantic `1/1/1`；Tutor intent `24/24`，Organizer subject/deck/target 各 `32/32`；
- [x] 四类 P95 为 `3/1/9.8304/4.1247ms`，usage `37020/1882`、synthetic invocation `48`、费用
      `0 CNY`，report gate 为 `mock_quality_not_evidence`；
- [x] V6 focused `36/36`（309 assertions）、Agent `828/828`（10826 assertions）、AI `199/199`、Types
      `42/42`、Server boundary `3/3`、Web `439/439`、PostgreSQL `12/12`、Compose/default-off 与相关
      typecheck/lint/build 均通过；
- [x] V1--V5 validators 保持 `ok=true`；Mock evidence 按精确 run path 删除，V6 Live marker/journal/
      evidence/recovery claim 与匹配测试账号残留均为 0；
- [x] 未读取 credential、调用 Provider、启动产品 Docker/API/browser、接产品 composition 或把 V6
      `3500ms` 接入产品 executor；Mock 满分不证明真实语义、网络 P95、Provider 账单或产品可用性；
- [x] R3 已知 durability 边界继续保留：无父目录 fsync、claim tail 延后复核、缺 stale-rename 后二次
      崩溃专测；
- [x] contract/security/concurrency 与 docs/history/operations 两路只读复审均 `APPROVED`、无 P0/P1；
      文档复审指出的旧 V2 状态标题已修正，contract 复核确认 folded deck canonical ID 不构成 finding；
- Git 交付边界：本条随 R4 原子提交发布；该条记录当时停止在 R5 授权门前，后续唯一 R5 已失败封存。

完整证据见
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r4-static-mock.md`。

V6 R5 唯一 controlled-Live 失败封存回执：

- [x] 用户接受运行当时 DeepSeek 数据保留/训练边界并精确授权唯一一次 V6 branch run；
- [x] preflight 确认 R4 clean、V6 Live artifact=0、V1--V5 validators 与历史 SHA 通过；
- [x] component credential 只在授权 Bun 进程内映射，未打印、写盘、进入 artifact 或 Git；
- [x] 唯一 run `b18a0a13-a2a0-4cb0-8f9c-296271c0dfa8` 为 `deepseek_network`；
- [x] `24/24` guard zero-call、1 对 dispatched/completed、2 次 Provider invocation、ledger
      reserved/terminal `2/2`；
- [x] Tutor `tutor-v2-runtime-01` 为 `provider_runtime / unknown`，executor `21.2116ms`，不是 timeout，
      structured-output stage 为 `null`；
- [x] Organizer sibling 为 `post_dispatch_abort`；runner 打开 `quality_gate_impossible` breaker，后续 46
      runtime 为 `not_started_quality_breaker`；
- [x] strict runtime `0/48`，正式 semantic、四类 P95、token 与 CNY 全 `null`，最终
      `quality_gate_failed`；
- [x] critical/permission/mutation/broader fallback 为 0，Provider failure 为 1；
- [x] evidence/marker/journal physical SHA 为 `beb9d460...21ea5e9` / `cbddba87...c99f988` /
      `be91b0c4...8c2a2f`，journal 最后一条为 `evidence_sealed`，bundle validator `ok=true`，无 recovery
      claim；
- [x] `unknown` 只说明固定 classifier 未识别异常；脱敏证据不能唯一归因 credential、HTTP、网络、SDK、
      模型、endpoint 或 Provider response；
- [x] 未启动产品 Docker/API/browser、创建 synthetic 账号或修改业务数据；Docker 容器、镜像、卷与
      持久数据未清理；
- [x] V6 一次性名额已消费；禁止 retry/resume/replay/backfill/额外探测、删除或改写 artifact，R6/R7/
      Task 13/main 与后续阶段不得开始。

完整证据见
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v6-controlled-live-failure.md`。

V7 R0 zero-provider postmortem 与设计回执：

- [x] V6 run `b18a0a13...`、`24/24` guard、2 次历史 invocation、`0/48` strict、全部 `null`
      aggregate 与 evidence/marker/journal SHA 保持不可变；
- [x] 明确 V6 runner `dispatch_started` 和 candidate executor invocation 都不能证明 HTTP 已发出、
      DeepSeek 已接收或 response 已返回；
- [x] 核对 AI SDK adapter、fixed failure classifier、V4 Pro non-thinking middleware 与现有 V4 Flash
      direct runtime，未把 `unknown` 武断归因 key、HTTP、网络、SDK、模型或 Provider；
- [x] V7 冻结复用 V2 dataset 与 V6 prompt/candidate/local authority bytes/SHA，不做 Live-driven
      dataset/prompt/semantic tuning；
- [x] 冻结第一方 V4 Pro direct adapter 与 8-stage 单调 wire prefix：executor、request、dispatch、
      response、audit、content、schema、usage；
- [x] 冻结 `executorInvocations/providerDispatches/providerResponses/verifiedUsages` 四类独立计数；
- [x] dispatch durable hook 必须在 fetch delegate 前 append + fsync，hook 失败保持 delegate 0-call；
- [x] failure taxonomy 仅使用 request/transport/HTTP/response/structured/usage/abort/timeout/harness/
      unknown 固定枚举，不持久化 raw error/body/header/prompt/output/key；
- [x] R3 必须以真实 V6 schema/prompt 完成 zero-network fault matrix；除专门兜底 case 外，任何非预期
      `unknown`、stage/counter 不一致或敏感字段泄漏都阻断 Live；
- [x] 冻结 R1 direct adapter -> R2 runner/lineage -> R3 static/Mock/fault matrix -> R4 unique Live ->
      R5 product -> R6 main 的原子路线与逐级停止门；
- [x] 未修改 TypeScript/source、dataset、prompt、schema、budget、timeout、product composition 或业务数据；
- [x] 未读取 `.env`/credential、调用 Provider、启动 Docker/API/browser 或创建/删除任一 Live artifact；
- [x] R0 当时只授权下一原子任务 R1 zero-provider adapter；R2--R6 与任何网络运行均未授权。

完整证据见
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r0-zero-provider-postmortem.md`。

V7 R1 zero-provider direct adapter 与 wire diagnostics 回执：

- [x] 新增 `first-party-deepseek-v4-pro-direct-v1`，固定
      `https://api.deepseek.com/v1/chat/completions`、`deepseek-v4-pro`、non-thinking、JSON-object、
      `stream=false`、no tools/function/json_schema 与 no retry；
- [x] 默认 delegate 才标记 `first_party_deepseek_v4_pro_direct`；任何注入 delegate 永久标记
      `synthetic_test`，不能冒充生产 provenance；
- [x] WeakMap opaque capability 只能 claim 一次，串行 reducer 固定 8-stage 单调前缀、
      first-terminal-wins 与 late response/rejection/abort drain；
- [x] 四类 counter 只由已提交 stage 重算；duplicate/skipped stage、跨 capability、hook I/O、异常
      status/body 与 terminal race 全部 fail-closed，dispatch hook 失败保持 delegate 0-call；
- [x] 私有 request/transport/HTTP/audit/structured/usage/abort/timeout/harness taxonomy 穷尽投影到既有
      public failure contract；没有扩展历史 public enum 或 Trace schema；
- [x] raw provider error/body/header、prompt、output、credential、URL 与 exact HTTP status 不进入 failure
      handoff 或 diagnostics snapshot；
- [x] V6 Tutor/Organizer strict schema 与 prompt SHA `4f73ae60...a169` / `c5f1f662...3450` 保持兼容；
- [x] focused `66/66`、Agent `830/830`、AI `224/224`、AI/Agent typecheck/lint、Prettier、diff 与独立
      code/security review 通过；
- [x] 未读取 `.env`/credential、调用 Provider、启动 Docker/API/browser、修改 V1--V6 artifact、创建
      V7 runner/CLI/env/marker/journal/evidence 或接产品 composition；
- [x] R1 不是 Live、语义质量或产品可用性 authority；该 checkpoint 当时下一原子任务仅 R2，后续
      R2 已完成；R3--R6 与任何 Provider 运行在 R1 时均未授权。

完整证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-v7-r1-zero-provider-adapter.md`。

V7 R2 zero-provider runner / lineage / durability 回执：

- [x] 新增独立 V7 report/case/evidence contract、paired runner、CLI/approval、marker、hash-chain journal、
      hard-link evidence、recovery claim 与 strict validator；
- [x] 固定 source manifest、eval policy、semantic authority、runner/runtime/marker/journal/evidence/recovery
      identity、approval env 与 confirmation；
- [x] 固定 `72/24/48/24/32` 分母、guard-first、pair 串行、pair 内最多双 lane、single dispatch、no retry
      与首个 runtime contract failure `quality_gate_impossible` breaker；
- [x] 每个 runtime lane 使用唯一 reservation/dispatch key/capability；成功 terminal 必须具有 wire version、
      完整 8-stage 前缀、`usageDisposition=verified` 与四类 `1/1/1/1` counter；
- [x] 任一 runtime 未完成、usage 未验证、duration/terminal/wire aggregate 不完整时，正式 semantic/P95/
      token/CNY 全部为 `null`；synthetic Live 永远不能打开生产质量门；
- [x] marker `wx`、journal 初始化文件 fsync、dispatch-before-fetch append queue + 文件 fsync、temp evidence
      文件 fsync + hard-link final、same-byte idempotency 与 different-byte conflict 已进入可执行合同；
- [x] recovery 只 seal durable prefix，不创建 adapter、不读取 key、不 resume/replay/retry/backfill Provider；
      stale claim rename 后再次崩溃、ABA、tail drift 与单胜者重新抢占均有回归；
- [x] V7 递归拒绝 V1--V6 runner/artifact token，V1--V6 validators 同样拒绝 V7；provenance/aggregate/
      runtime snapshot、unknown/cross-lane dispatch key 与 evidence 跨仓库根路径篡改均 fail-closed；
- [x] focused `22/22`（`184` assertions）、Agent `852/852`（`11041` assertions）、typecheck/lint、
      Prettier/diff、V1--V6 validators 与 V6 evidence/marker/journal physical SHA 复核通过；
- [x] 未读取 `.env`/credential、调用 Provider、启动 Docker/API/browser、执行正式 V7 Mock/Live、创建
      仓库 V7 marker/journal/evidence/recovery claim、接产品 composition 或修改业务数据；
- [x] 已知边界如实保留：只有文件 fsync、无父目录 fsync；PID/file fencing 只适用于单机，不证明突然
      断电后的目录项持久性、跨主机 lease 或 Provider exactly-once；
- [x] R2 不是 Live、语义质量或产品可用性 authority；该 checkpoint 当时下一原子任务仅 R3
      zero-network fault matrix/static/Mock，后续已完成。

完整证据见
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r2-runner-lineage.md`。

V7 R3 zero-provider fault matrix / static / Mock 回执：

- [x] 48 条 runtime 全部从冻结 V2 dataset 的 `subset === 'runtime'` 派生，并核对 dataset binding 与两份
      V6 prompt SHA；
- [x] Tutor/Organizer 均穿过真实 V6 candidate、projection、prompt formatter、strict schema、本地
      authority merger 与第一方 V7 direct adapter；synthetic responder 只读取实际 bounded prompt，
      不读取 expected/oracle、真实 ID 或写命令；
- [x] exact URL/header/body/model/non-thinking/JSON/max-token request shape 已固定；injected fetch
      provenance 永久为 `synthetic_test`，report 为 `mock_synthetic`；
- [x] transport、HTTP、response、non-thinking、completion parse、schema、usage 与 abort faults 精确映射到
      stage prefix、private category、usage disposition 与四类 counter；没有非预期 `unknown`；
- [x] first/middle/last breaker 保持固定 48 分母、single dispatch/no retry/no backfill；sibling abort
      lane-local 收口且不复制触发 lane category；
- [x] fresh baseline `12/48`，Tutor/Organizer/combined semantic
      `0.6629642857/0.278125/0.4705446429`；
- [x] reviewed Mock run `e09baa4a-6f48-41c3-bb48-607a72c300df` 为 `24/24` guard、`48/48` strict、
      semantic/model-owned `1/1/1`、wire `48/48/48/48`、usage `22949/1882`、estimated
      `0.080139 CNY`，gate `mock_quality_not_evidence`；
- [x] focused `28/28`（`1028` assertions）、Agent `856/856`（`11881` assertions）、AI
      `224/224`、Types `42/42 + tsc`、Server `2154 passed / 30 skipped`、Web `439/439`、
      PostgreSQL `12/12`、Docker boundary `3/3`、Compose default-off 通过；
- [x] V1--V6 validators/SHA 不变，V7 Live marker/journal/evidence/recovery claim 为 0；Mock evidence
      按精确 path 删除，没有清空 `.tmp`；
- [x] synthetic user/question/group/deck/item/trace 残留为 0；未启动、重建或删除 Docker 容器；
- [x] contract/security/wire 与 docs/history/operations 两路独立终审均 PASS，无
      Critical/Important/Minor；
- [x] 未读取根 `.env`/credential、调用 Provider、执行 `v7:live`、启动产品 Docker/API/browser、接产品
      composition 或修改业务数据；
- [x] R3 不是 Live、供应商 usage/P95/CNY 或产品可用性 authority。该 checkpoint 当时下一任务仅 R4
      精确授权门；后续唯一 R4 已失败封存。

完整证据见
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r3-static-mock.md`。

V7 R4 唯一 branch controlled-Live 回执：

- [x] 用户重新接受运行时 DeepSeek 数据保留/训练边界并明确授权唯一一次 V7 branch Live；
- [x] zero-network preflight 在 clean/pushed `df5ed8c7` 上确认 V7 artifact=0、V1--V6 validators/SHA 与
      V7 focused `26/26` 通过；
- [x] 根 `.env` 未改写；底层 secret 只在授权 Bun 子进程内映射为 Tutor/Organizer component
      credential，key 未打印、写盘、进入参数、evidence 或 Git；
- [x] 唯一 run `81529c2c-79f5-4c21-9cee-e536a2fe78e3` 完成 `24/24` guard zero-call；
- [x] 首对 Tutor `candidate_applied`，完整 8-stage wire，usage `532/8`、estimated `0.001644 CNY`；
- [x] 首对 Organizer 已完成 dispatch/response/audit/JSON parse，在 `provider_type_validation` 失败，
      usage unknown；
- [x] Breaker 使后续 46 runtime 保持 `not_started_quality_breaker`；最终 wire `2/2/2/1`、strict
      `1/48`，semantic/P95/token/CNY 全 `null`，gate `quality_gate_failed`；
- [x] Safety 为 verified zero-call `24`，critical/permission/mutation/broader fallback 均为 `0`；
- [x] Evidence/marker/journal physical SHA 已固定，journal 最后一条为 `evidence_sealed`，bundle validator
      `ok=true / filesChecked=1`，无 recovery claim；
- [x] 没有启动产品 Docker/API/browser、创建 synthetic 业务数据或清理 Docker；R5/R6/main 被阻断；
- [x] 禁止重跑、seal/recovery、curl/单 case/产品 API 探测或把 R3 Mock/Tutor 单条成功拼接为通过。

完整证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-v7-controlled-live-failure.md`。

V8 R0 zero-provider 复盘与设计：

- [x] 只读确认 V7 Organizer failure 位于 JSON parse 后、dynamic authority 前的 static Zod
      `provider_type_validation`；
- [x] 没有读取或恢复 raw model output，也没有猜测具体失败字段或 Provider 外部根因；
- [x] 记录 `json_object` 不执行本地 schema、V6 nested conditional union 与 V7 ideal Mock 的 coverage
      gap；
- [x] 冻结 fixed-shape decision：`questionIndex/subjectIndex(null|integer)/deckAction/targetIndex`；
- [x] fingerprint、subject/deck/topic ordinal、snapshot/stale/locked-name/confidence/真实 ID/write authority
      继续本地掌握；
- [x] bounded diagnostic 只含固定 reason/count/type-shape fingerprint，`rawDataRetained=false`；
- [x] Provider-like schema-negative、metamorphic、held-out、bilingual、hostile/no-leak 与 anti-overfit matrix
      已冻结；
- [x] V8 使用独立 identity/approval/marker/journal/evidence/validator，V1--V7 不修改且必须双向拒绝；
- [x] R0 未读取 credential、调用 Provider、执行 Mock/Live、启动 Docker/API/browser、修改业务数据或合并
      main；
- [x] 下一任务仅 V8 R1 zero-provider fixed-shape contract/diagnostic TDD，不构成任何 Live 授权。

完整设计与证据见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v8-remediation-design.md`、
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v8-remediation.md` 与
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v8-r0-zero-provider-postmortem.md`。

V8 R1--R5 收口回执：

- [x] R1 fixed-shape contract/diagnostic、R2 Provider-like robustness、R3 runner/lineage/durability 与 R4
      reviewed Mock/full checkpoint 均以 zero-provider 方式完成；
- [x] 唯一 R5 run `7ff09c36-50f2-445a-b309-dc9500e5e13c` 为 `24/24` guard、wire
      `4/4/4/4`、`3/48` strict；第二条 Organizer 在 fixed-shape schema 后命中本地
      `dynamic_authority`，正式 aggregate 全 `null`；
- [x] Evidence/marker/journal 已 seal，validator `ok=true/filesChecked=1`，无 recovery claim；
- [x] V8 不得 retry/resume/replay/backfill、seal/recovery 或追加 Provider 探测，R6/R7/main 被阻断。

完整结果见
`docs/acceptance/phase-6-9-7-tutor-organizer-v8-r4-static-mock.md` 与
`docs/acceptance/2026-07-29-phase-6-9-7-tutor-organizer-v8-controlled-live-failure.md`。

V9 R0--R5 收口回执：

- [x] 本地从 validated V5 shortlist 枚举完整合法 option；模型 exact output 只允许
      `decisions[{questionIndex,optionIndex}]`，不回显 fingerprint、不自由组合 subject/action/target；
- [x] 本地继续注入 fingerprint、执行 V6 validator/merger，并保留 owner snapshot、三阶段 stale/write
      fence、locked name、真实 ID、confidence、Trace、预算与 no-retry authority；
- [x] Provider-like/held-out/metamorphic/schema-negative、Unicode/hostile input、abort/stale/final write
      authority 与 no-leak matrix 通过；
- [x] V9 runner 固定 `72/24/48/24/32`、guard-first、pair 串行/双 lane、single dispatch/no retry、
      8-stage wire、reserved/terminal/orphan/not-started accounting、hash-chain journal、hard-link evidence 与
      crash-only recovery；
- [x] reviewed Mock factory 穿过正式 V6 Tutor、V9 Organizer candidate、V6 validator/merger 与 direct
      adapter；只有 fetch 为 synthetic，responder 只读实际 bounded prompt；
- [x] fresh baseline `12/48`，semantic
      `0.6629642857142858/0.278125/0.4705446428571429`；
- [x] Mock run `f039a7d2-c3b2-4286-9630-fee49d365a33` 为 `24/24` guard、`48/48` strict、wire
      `48/48/48/48`、semantic `1/1/1`、synthetic usage `17732/504`、estimated `0.05622 CNY`；
- [x] R4 gate 固定 `mock_quality_not_evidence`；Mock evidence 已精确删除，R4 checkpoint 时 V9
      marker/journal/evidence/recovery claim 为 0；
- [x] Agent/AI/Types/Server/Web 全量、Organizer PostgreSQL `12/12`、Docker boundary/static contract `3/3`、Compose
      default-off、Phase 6.9.6 与 V1--V8 validators、测试账号残留 0 和两路终审通过；
- [x] R4 未读取 `.env`/credential、调用 Provider、执行 V9 Live、启动产品 Docker/API/browser、修改
      业务数据或合并 main；Mock 不证明真实模型、Provider P95/usage/费用或产品可用性；
- [x] R5 在 clean/pushed `ce308da643bfb0b9c150f0612f0c5aa926442687`、local/tracking/remote parity、
      历史 validators 与 artifact=0 前门通过后，依据用户当次精确授权执行唯一 Live；
- [x] run `c530ca02-3ece-4f11-898c-5695c8252bd5` 为 `24/24` guard、pair `1/1`、runtime
      `2/2/0/46`、wire `2/2/0/0`、strict `0/48`；Tutor `transport`，Organizer sibling
      `post_dispatch_abort`，正式 semantic/P95/token/CNY 全 `null`；
- [x] Marker/journal/evidence 已 durable seal，validator `ok=true/filesChecked=1`，无 recovery claim；
      一次性授权已消费，不得 retry/resume/replay/backfill、seal/recovery、改写 artifact 或追加 Provider 探测；
- [x] R6 产品 Docker/API/可见浏览器、R7/main、Phase 6.9.8/6.10/8/9 与博客收尾继续阻断；用户后续
      Architecture Recovery 决策不解封 V9，也不允许把新诊断回填为 V9 authority。

### Phase 6.9.7 Architecture Recovery R1--R3 — Provider Canary Boundary

- [x] 用户明确停止 V10/V11 式整套重试，先定位 Provider transport 链路；该路线是 V9 之后的独立
      Architecture Recovery，不删除、不覆盖、不恢复或重放任何 V1--V9 artifact；
- [x] sealed `first-party-deepseek-v4-pro-direct-v1`、公共 provider category、wire schema、V1--V9
      report/source identity/validator 均未修改；
- [x] 新 adapter `first-party-deepseek-v4-pro-transport-diagnostic-adapter-v1` 只返回 frozen
      `first-party-deepseek-v4-pro-transport-diagnostic-v1` 与九个固定 subtype；
- [x] 分类只读 own data `code/name`、最多四层 cause 和标准 AbortSignal；不调用 hostile getter、
      `toString`，不读取/保留 message/stack/raw error/URL/header/body/prompt/credential；未知与循环 fail-closed；
- [x] 默认 global fetch 才能声明 `first_party_deepseek_v4_pro_transport_diagnostic`；任意 injected fetch
      永久 `synthetic_test`，伪造/hostile dependency 在 wire claim 前拒绝；
- [x] RED 为新 export 不存在；GREEN focused `6/6`（`127` assertions），AI package `232/232`
      （`1586` assertions），V7/V8/V9 相关零网络合同 `59/59`（`3555` assertions）；
- [x] AI/Agent typecheck/lint 通过；V7/V8/V9 历史 validator 均为 `ok=true/filesChecked=1`，
      V9 evidence/journal/marker 前后 SHA-256 一致；
- [x] 三路独立只读复审无 Critical/Important；
- [x] 未调用 DeepSeek、curl、DNS/TLS、产品 API 或 V9 Live/seal/recovery，未启动 Docker/API/browser；
- [x] R2 已建立独立 fact-free request、strict report、diagnostic-only artifact schema、每次
      `1 call / 512 input / 16 output / 0.00200000 CNY` 预算和安全 CLI；版本 namespace 与 V1--V9
      marker/journal/evidence/recovery 完全隔离；
- [x] Runner 只接受 closed synthetic scenario enum、timeout 与 AbortSignal；最终实现已移除初版任意
      fetch/createTransport 注入口，外部不能注入 credential、URL、Live transport 或输出路径；
- [x] outcome、R1 transport subtype、V7 wire 四计数、reservation/usage 与取消/timeout terminal 使用 strict
      invariant；成功 terminal 不被迟到 abort 覆盖，raw error/prompt/key/endpoint 不进入 report/artifact；
- [x] CLI 只允许 `mock` / `fault-matrix`；R2 focused `14/14`（`218` assertions）、AI package
      `246/246`（`1804` assertions）、AI/Agent typecheck/lint 通过；Mock `complete`、fault matrix
      `21/21`，并逐项验证 wire、budget、usage、冻结与 no-raw；
- [x] R2 全程 zero-provider：未读取 `.env`/credential、调用 Provider/curl/DNS/TLS、创建正式 artifact、
      启动 Docker/API/browser、修改业务数据或触碰 V1--V9 sealed artifact；
- [x] 所有 R2 输出固定 `authority=synthetic_test`、artifact `qualityAuthority=none`；synthetic success/
      usage 只证明工程合同，不能证明 HTTP、DeepSeek/DNS/TLS/账号/余额/模型权限/服务端健康或 Agent 语义；
- [x] R3 已建立独立 exact-confirmation controlled-Live CLI、专用 approval/credential、固定 branch 与
      clean/tracking preflight；公开 CLI 固定内部 production ports，不能注入 fetch/transport/URL/model/writer；
- [x] Provider dispatch 前先 exclusive-create owner PID/token marker，并 durable append marker-SHA-bound
      `attempt_reserved`；wire/terminal/publication 使用独立 hash-chain journal，terminal 内嵌 bounded report；
- [x] artifact 固定 `controlled_live / diagnostic_only / qualityAuthority=none`；validator 重新关联
      marker/report/evidence SHA、terminal outcome/report、completion/publication mode、recovery claim 与原始 tail；
- [x] `publication_started` 后任何 I/O failure 永久 fail-closed；crash-only seal 只从 durable prefix 重建
      attempt disposition，活 owner 拒绝、dead owner 单胜者 claim、stale takeover 与 journal drift 均已覆盖；
- [x] 首次授权 CLI 已通过 source/credential preflight，但在 reservation 前因 Windows 默认 evidence root
      尾分隔符被旧字符串围栏误拒绝；Provider invocation/dispatch=0，未创建 marker/journal/claim/artifact；
- [x] 根因已以 `resolve + relative` containment 修复并新增目录 URL 尾分隔符回归；R3 focused `18/18`
      （`123` assertions）、R2 regression `14/14`（`218` assertions）、AI package `264/264`（`1927`
      assertions），AI typecheck/lint、Prettier 与 diff check 通过；独立实现/安全复审
      无未关闭 Critical/Important；
- [x] 本次失败保持 zero-provider：专用 credential 仅完成进程内映射且未输出；未调用 Provider 或执行 seal，
      未启动 Docker/API/browser、修改业务数据或触碰 V1--V9；仓库正式 R3 marker/journal/claim/artifact 为 0；
- [x] 修复后的唯一 run `253a5df5...` 已正常 runtime seal：`transport_failed / connection_refused`、
      `dispatched_no_response`、wire `1/1/0/0`、usage/token/CNY=`null`；7 条 journal 到
      `evidence_published`，artifact SHA=`56fb5b1d...e6c4`，无 recovery claim；
- [x] zero-network 本地复盘发现当前进程 proxy 指向无监听 loopback `127.0.0.1:7897`，根 `.env` 不定义
      proxy；只记录为高度相关但未证实条件，不归因 Provider、DNS/TLS、账号、余额、权限或服务端；
- [x] 唯一 R3 授权已消费；禁止 retry/resume/replay/backfill、Live/seal、删除/改写 artifact、curl 或第二次
      Provider 调用；
- [x] 独立 proxy preflight contract/CLI 已完成：只允许 direct 或一致 loopback HTTP proxy；非空
      `NO_PROXY`、authority 冲突、credential/非法 URL、hostile env 在 listener 前 fail-closed；
- [x] Windows/Bun composition 只快照八个固定 proxy key；不枚举整份 env、不读取 `.env`/credential；
      listener 只连接 loopback、250ms、无 payload，核心 watchdog 覆盖 never-settle 与 abort；
- [x] focused `14/14`（`108` assertions）、R3 regression `18/18`（`123` assertions）、AI full
      `278/278`（`2035` assertions）、typecheck/lint、Prettier/diff 与独立实现/测试/安全复审通过；
- [x] 实际 CLI 以预期 exit `1` 返回 `loopback_proxy_unavailable / configured=4 / probe=1 /
providerCalls=0`；本任务新增 Provider/fetch/credential/marker/journal/artifact 均为 0；
- [x] R3 marker/journal/artifact SHA 保持 `6eef1a...89b6a / 426d64...7f7b / 56fb5b...e6c4`；
      preflight 结果不升级 Provider/network health 或 R3 唯一根因；
- [x] 宿主 Clash Verge core 按既有配置恢复 listener 后，只重跑本地 preflight；fresh 结果为
      `loopback_proxy_ready / configured=4 / probe=1 / providerCalls=0`。未清空/绕过 proxy、修改
      `NO_PROXY`、读取 credential、调用 Provider 或创建 marker/artifact；ready 仍不是 Provider health；
- [x] Provider Canary V2 D0 re-entry 设计已冻结：独立 namespace 与 D0/C1/C2/S1/L1/P1，不复用旧 R3/R4
      approval/credential/confirmation/marker/journal/artifact/recovery identity；
- [x] V2 固定执行顺序为 exact args -> 八变量 proxy preflight -> source parity -> dedicated credential ->
      marker/reservation -> one fact-free dispatch -> bounded terminal/publication；preflight failure 前
      credential/source/marker/Provider 全部 0-call；
- [x] V2 固定 DeepSeek V4 Pro、5000ms、`1/512/16`、`0.00200000 CNY`、no retry；listener ready 只生成
      进程内 single-consume attestation，不保存 proxy URL/port 或网络健康结论；
- [x] R3 marker/journal/artifact SHA 仍为 `6eef1a...89b6a / 426d64...7f7b / 56fb5b...e6c4`，bundle
      validator `ok=true / runId=253a5df5...`；D0 未触碰任何 sealed artifact；
- [x] Provider Canary V2 C1 已建立独立 request/proxy-attestation/budget/report/fault-matrix/CLI identity；
      report 固定 `synthetic_test / qualityAuthority=none / providerHealth=unknown / zeroNetwork=true`；
- [x] preflight ready 只铸造模块私有 `WeakMap` 绑定的进程内空对象 capability；同步 single-consume，plain
      object、clone、伪造、replay 与 8 个并发消费者中的后 7 个全部拒绝；failure/abort 不铸造；
- [x] C1 CLI 只允许 `mock/fault-matrix`，拒绝 Live、credential、URL、proxy override、retry、output；15-case
      closed matrix 为 `15/15`，focused `13/13`（`117` assertions），Recovery regression `59/59`（`566`
      assertions）、AI full `291/291`（`2152` assertions）、typecheck/lint/Prettier/diff 均通过，所有
      raw-retained=false；
- [x] C1 credential/source/marker/provider counter 为 0，V7 wire 固定 `not_started / 0/0/0/0`，budget
      reservation 为 0，usage/费用为 `null`；有效 R2/R3 report 与 V2 report 双向 schema/version rejection；
- [x] C1 未读取 `.env`/credential、调用 Provider、创建 V2 source/marker/journal/artifact/recovery claim、
      启动 Docker/API/browser 或修改业务数据；R3 validator/SHA 与 V1--V9 sealed evidence 不变；
- [x] C2 已完成独立 source、approval/dedicated credential gate、固定 production CLI、exclusive marker、
      hash-chain+fsync journal、bounded terminal、hard-link artifact/strict validator 与 crash-only seal；
- [x] public CLI 只接收 `args + AbortSignal`，root/env/fetch/URL/model/proxy/timeout/clock/UUID/writer/output/
      retry 不可注入；CLI core/testing seam 不从 package index 导出；
- [x] preflight failure 前 source/approval/credential/marker/runtime 为 0-call；source -> approval -> credential ->
      reservation 顺序、single dispatch/no retry、pre/in-flight abort、timeout 与 late completion 已覆盖；
- [x] exclusive marker、wire monotonicity、single terminal/publication winner、live-owner reject、dead-owner
      single-winner seal、terminal publication recovery、journal drift 与 `publication_started` 永久 fail-closed；
- [x] V2/R3 confirmation、filename、marker/schema 双向拒绝；R3 validator 与 marker/journal/artifact SHA
      `6eef1a...89b6a / 426d64...7f7b / 56fb5b...e6c4` 不变；
- [x] C2 focused `32/32`（`214` assertions）、Recovery `91/91`（`780` assertions）、AI full `323/323`
      （`2366` assertions）、typecheck/lint/Prettier/diff 与独立实现/安全/文档复审通过；
- [x] C2/S1 未读取根 `.env`/真实 credential、调用 Provider、启动 Docker/API/browser 或触碰 sealed
      evidence；所有成功 publication 只在自动清理的系统临时测试根，项目根正式 V2 marker/journal/artifact/
      recovery claim 为 0；
- [x] S1 已完成并推送；用户随后重新接受运行时 DeepSeek 数据边界并给出 V2 exact confirmation；
- [x] 唯一 L1 run `dc09214c-0300-4153-8273-e548ac768d20` 为
      `complete / strict_response_with_verified_usage`，response/strict 均为 `true`，wire `1/1/1/1`；
- [x] L1 verified usage 为 input/output `49/5`，费用 `0.00017700 CNY` 且低于 `0.00200000 CNY` cap；
- [x] L1 journal 共 `12` 条并以 `evidence_published` 收口；bundle validator
      `ok=true / evidenceCount=1`，V2 marker/journal/artifact SHA 分别为
      `c3e5ac...b287e5 / c19abf...903d7 / 98368de...a7e4`，无 recovery claim；
- [x] R3 validator 仍 `ok=true`，marker/journal/artifact SHA 仍为
      `6eef1a...89b6a / 426d64...7f7b / 56fb5b...e6c4`；V1--V9/R3 evidence 未改写；
- [x] L1 `status=diagnostic_only / qualityAuthority=none`；只证明本次 fact-free Provider response/usage/evidence，
      不证明 Tutor/Organizer 语义、Provider 长期健康、RAG、业务写入或产品可用；
- [x] L1 名额已消费，禁止重跑、retry/resume/replay/backfill、crash seal 或追加 Provider 探测；
- [x] P1 已以 zero-provider 冻结独立 small-sample lineage、V2 source SHA、4+4 critical guards、8 runtime
      pairs（16 lanes / 12 Organizer decisions）与 manifest SHA `ae667f1c...edf61`；
- [x] P1 deterministic subset baseline 为 Tutor/Organizer/Combined
      `0.7070238095238095 / 0.2375 / 0.47226190476190477`，canonical payload SHA
      `d36d0789...d9f4e`，Provider/token/cost 为 0；G1 已正式复现并冻结 report/file SHA；
- [x] P1 quality gate 固定 guard `8/8` actual zero-call、runtime strict/wire/usage `16/16/16/16`、三个
      semantic `>=0.85`、Tutor/Organizer improvement 各 `>=0.15`、invalid/critical/permission/mutation/
      broader fallback 为 0；incomplete aggregate 全 `null`；
- [x] 8-sample 不产生 P95 authority，只记录 `3500/5000ms` hard timeout 与 median/max；L2 cap 固定
      `16 calls / 37600 input / 8800 output / 0.176 CNY`、no retry/resume/replay/backfill；
- [x] P1 冻结 guard-first、pair-serial、pair 内 sibling lane 独立 terminal、fixed denominator、breaker、
      exclusive marker/hash-chain journal/hard-link artifact/crash-only seal 与历史双向 lineage rejection；
- [x] P1 未读取 credential、调用 Provider/Mock、启动 Docker/API/browser、创建正式 evidence 或修改业务数据；
- [x] G1 已 zero-provider 实现 manifest/baseline/strict report/scorer/gate 与 oracle/candidate/Mock 单向隔离；
      manifest、baseline authority、logical report、physical file、eval policy SHA 分别为
      `ae667f...edf61 / d36d07...d9f4e / ad3aa5...d002 / e8bcbcb5...658b / 1cab77...399a`；
- [x] G1 report 从固定 24 entries 重算 scheduler/wire/semantic/latency/usage/safety/breaker/gate；guard
      不进 runtime wire 分母，pair terminal 与 breaker 后 not-started 守恒，incomplete aggregate 全 `null`，
      8-sample P95 固定 `null`，Mock 永远 `mock_quality_not_evidence`；
- [x] G1 baseline writer 固定路径并使用 exclusive-create、open 前后及 sync 后 parent/path/handle identity
      校验；parent swap、existing symlink 与 post-sync swap 负向测试通过；Node 无 `openat/dirfd` 的同用户竞态
      保留为 trusted-workspace 边界；
- [x] G1 focused `20/20`（135 assertions）、V2 baseline regression `11/11`（371 assertions）、Agent full
      `995/995`（16462 assertions）、typecheck/lint/Prettier/diff、敏感扫描与独立 contract/security 复审通过；
- [x] G1 未读取 credential、调用 Provider、运行 Mock/Live、启动 Docker/API/browser、创建正式 evidence 或
      修改业务数据；authority 仅 `zero_provider_contract_baseline`；
- [x] G2 已 zero-provider 实现固定 production CLI/source authority、guard-first/pair-serial 双 lane runner、
      external-abort 分类、exclusive marker、fsynced hash-chain journal、hard-link artifact/strict validator 与
      crash-only seal；public CLI 只接收 `args + AbortSignal`；
- [x] G2 source admission 要求固定分支、tracked clean、HEAD/upstream/remote、未来 L2 admission 创建/
      绑定的 approved tag、正式 artifact=0 与 Tutor/Organizer/adapter SHA；G2/S2 当时均未创建 tag，因此在
      credential/marker 前 fail-closed；
- [x] G2 runner 先完成 8 guards，再串行执行 8 pairs；pair 内两条 lane 独立 budget/abort/timeout/terminal；
      semantic mismatch 不开 breaker，首 contract failure 保留 sibling terminal 并让后续 14 lane
      `not_started_quality_breaker`；
- [x] 外部父请求取消统一为 `external_abort`；已进入 lane 为 `attempted_aborted`，后续 lane 为
      `not_started_external_abort`，不与 lane 内部 `abort` 混淆；
- [x] crash-only seal 不 preflight/source/approval/credential、不创建 harness/transport、不调用 Provider；第一条
      lane 已 reservation 但 sibling 未 reservation，以及 8 guards 完成但首对未 reservation 两个 anchor 均只
      补当前 pair 零-wire reservation 并立即 `attempted_aborted`，后续 pair 为 quality breaker；不是
      resume/replay/retry；
- [x] validator 拒绝 truncated/CRLF/hash rewrite/extra formal files、duplicate claim、hidden completion mode、
      非普通 marker 与历史 lineage；`publication_started` 后 I/O failure 永久 fail-closed；
- [x] G2 focused `32/32`（857 assertions）、G1+G2 `52/52`（992 assertions）、Agent full
      `1027/1027`（17337 assertions）、typecheck/lint/Prettier/diff、baseline same-bytes、V1--V9/R3/L1
      validators 与 SHA parity 通过；
- [x] G2 未读取 credential、调用 Provider、运行正式 Mock/Live、启动 Docker/API/browser、创建 approved tag 或正式
      L2 marker/journal/artifact/recovery claim；authority 仅 `zero_provider_runner_durability`；
- [x] S2 已 zero-provider 完成 reviewed Mock/static：正式 Tutor V6、Organizer V9、第一方 adapter、strict
      validator、本地 authority/merger 与 G2 runner 全链；responder 不读 expected/oracle，actual 从
      model-owned decision 与本地 authority 重建并与 runtime axes 交叉核验；
- [x] S2 正常结果为 `8/8` guard、`16/16` strict/wire/verified usage、semantic `1/1/1`、gate
      `mock_quality_not_evidence`；S2 `35/35`（603 assertions）、G1+G2+S2 `87/87`（1595 assertions）、
      Agent `1062/1062`、AI `323/323`、Types `42/42 + tsc`、Web `439/439`；
- [x] S2 fault/abort/双 hard-timeout、历史 validator/SHA parity、正式 L2 marker/journal/artifact/recovery=0、
      三路独立终审和 Reader Testing 通过；验收见
      `docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-s2-reviewed-mock-static.md`；
- [x] S2 未读取 credential、调用 Provider、创建 approved tag、启动 Docker/API/browser、修改业务数据或合并
      main。后续独立 L2 admission 已在已推送且 HEAD/upstream/remote parity 的 commit 上创建/绑定 tag，并
      取得 fresh 数据边界接受与 exact authorization；S2 历史 zero-provider 事实不因后续结果改写。
- [x] 唯一 L2 approved source commit、HEAD/upstream/remote 与 tag 均为
      `4c6084455d0cea6b4a5ddd94511bce29c22af1c4`；tracked source clean、正式 artifact=0，fresh preflight 为
      `direct_ready / providerCalls=0`；
- [x] 用户已重新接受本次运行时 DeepSeek 数据边界并给出 exact authorization；credential 只映射到唯一子进程
      专用变量，未打印、写回或进入 CLI/journal/artifact/Git；
- [x] 唯一 L2 run `6918df4f-a4ae-4de0-aa21-c7614ed5861d` 为 guard `8/8`、runtime
      reserved/terminal/orphan/not-started `16/16/0/0`、wire `16/16/16/16`、strict runtime `16/16`；
- [x] L2 Tutor/Organizer/Combined semantic 为
      `0.9141666666666668 / 1 / 0.9570833333333334`，improvement 为
      `0.2071428571428573 / 0.7625`，invalid/critical/permission/mutation/broader fallback/locked-name/
      write-command failure 全为 0；
- [x] L2 verified usage 为 `7032/244`，费用 `0.02256 CNY`；8-pair P95 保持
      `null / insufficient_sample_size_8`，不产生 SLA/产品性能 authority；
- [x] L2 gate 为 `small_sample_quality_gate_passed`，quality authority 为
      `small_sample_semantic_gate`；正式 marker/journal/artifact/recovery claim 为 `1/1/1/0`；
- [x] L2 journal `180` 条并以 `evidence_published` 收口；logical report SHA 为
      `a981e188...eeb8`，physical artifact SHA 为 `a1b51f05...eb0d`，bundle validator `ok=true`；
- [x] L2 名额已消费；禁止 retry/resume/replay/backfill、Live/seal/recovery、追加 Provider 探测、删除或改写
      artifact。其后 P2 只进行 zero-provider full-gate design；48-case、产品 Docker/API/browser、main 与
      Phase 6.9.8 继续阻断。
- [x] P2 冻结独立 `phase-6.9.7-tutor-organizer-full-gate-v1`，固定 `72 entries / 24 guards / 24 pairs /
48 runtime lanes / 32 Organizer decisions`；full manifest SHA 为 `e68e6e27...12c78`；
- [x] P2 fresh deterministic full baseline 保持 `12/48`、Tutor/Organizer/Combined
      `0.6629642857/0.278125/0.4705446429`；source baseline SHA `0ce7c3ca...116ca`，新 baseline authority
      SHA `2ab1030f...a5f2`；Provider/token/cost 全 0；
- [x] P2 full eval policy SHA 为 `11371d16...f503`：三个 full semantic 各 `>=0.85`、两 lane improvement
      各 `>=0.15`，同次 full run 的 L2 anchor subset 也须过 P1 门，但不要求复现 L2 随机实际分数；
- [x] P2 固定 guard/runtime/wire/verified usage `24/48/48/48`、安全/权限/mutation/locked-name/write
      leakage 全 0，以及 incomplete semantic/P95/token/CNY aggregate 全 `null`；
- [x] P2 恢复恰好 24 samples 的四项 nearest-rank P95：Tutor `2500ms`、Organizer/paired `4500ms`、Tutor
      local orchestration `6500ms`；hard timeout 独立为 `3500/5000ms`；
- [x] P2 预算固定 `48 calls / 112800 input / 26400 output / 0<CNY<=0.55`，no
      retry/resume/replay/backfill；
- [x] P2 固定 guard-first、pair-serial、pair 内最大并发 2、独立 sibling terminal、pair-close breaker、
      dispatch-before-call hash-chain+fsync、exclusive marker/hard-link publication 与 crash-only zero-wire seal；
- [x] P2 candidate/adapter 七个 source hash 继续绑定 L2 approved source `4c608445...c22af1c4`；旧 approved
      tag 未移动或重建，新 full-gate tag/marker/journal/artifact/recovery 均未创建；
- [x] P2 未读取 credential、调用 Provider、执行 Mock/Live、启动 Docker/API/browser、修改业务数据或合并
      main；authority 仅 `zero_provider_full_gate_design`，当时只解锁 F1 full contract/baseline；
- [x] F1 实现 exact `72-entry` manifest、48-run deterministic baseline、安全 writer 与 strict
      report/scorer/gate；manifest/source baseline/baseline authority/eval policy SHA 精确复现 P2 冻结值；
- [x] F1 冻结 baseline logical report SHA `16c574b1...2c9` 与 physical file SHA
      `16aa1773...6f73`；validator 对原始 bytes 计算物理 hash，并拒绝 BOM、CRLF、byte/payload/source drift；
- [x] F1 从固定 entries 重算 full 与 L2 anchor semantic、安全、wire、usage、预算和四项 24-sample
      nearest-rank P95；不完整分母时 semantic/anchor/P95/token/CNY 全为 `null`；
- [x] F1 固定 semantic mismatch 不打开 breaker；Mock/synthetic 只返回
      `full_gate_mock_quality_not_evidence / qualityAuthority=none`，只有完整 `deepseek_network` pass 才能形成
      `full_gate_semantic_gate`；
- [x] F1 双向拒绝 V1--V9、R3、Canary L1 与 small-sample lineage；exact import allowlist、credential/network
      静态门和 runtime fetch spy 证明 Provider 调用为 0；
- [x] F1 focused `14/14`、Agent full `1076/1076`、typecheck/lint 通过，四路独立复审均
      `APPROVED`；正式 full-gate marker/journal/artifact/recovery claim、approved tag 与项目根 baseline 均为 0；
- [x] F1 authority 仅 `zero_provider_full_contract_baseline`，未读 credential、未调用 Provider、未启动
      Docker/API/browser、未改业务数据、未合并 main；当时只解锁 F2 one-shot runner/durability/evidence；
- [x] F2 固定 production CLI/source admission，先执行 24 guards，再按 24 pairs 串行推进 48 lanes；pair 内两条
      lane 拥有独立 budget/abort/timeout/terminal，semantic mismatch 不 breaker，contract failure 收口 sibling 后
      breaker；
- [x] F2 exclusive marker、`lane_reserved`/wire/terminal fsynced hash-chain journal、hard-link publication、strict
      recomputing validator 与 crash-only seal 已落地；48-lane reserved/terminal/orphan/not-started 守恒且禁止
      retry/resume/replay/backfill；
- [x] F2 focused `32/32`、Agent full `1108/1108`、typecheck/lint/Prettier/diff、历史 validator/SHA parity 与两路
      独立复审通过；
- [x] F2 authority 仅 `zero_provider_full_runner_durability_evidence`；未读 credential、未调用 Provider、未执行
      正式 Mock/Live、未启动 Docker/API/browser、未改业务数据、未合并 main；approved tag 与正式
      marker/journal/artifact/recovery claim 均为 0；
- [x] S3 reviewed Mock 真实穿过 Tutor V6、Organizer V9、第一方 adapter synthetic fetch、strict validator、
      本地 authority/merger 与 F2 runner；factory SHA 为 `sha256:53bcf0d...da55`；
- [x] S3 正常路径为 `24/24` guard、runtime `48/48/0/0`、strict/wire/verified usage `48/48/48/48`、
      Tutor/Organizer/Combined semantic `1/0.9968750000000001/0.9984375000000001`、L2 anchor `1/1/1`；
- [x] S3 四项 P95 均有完整 24-sample 且低于 frozen cap，synthetic usage `17732/504`、estimated cost
      `0.05622 CNY`，安全/权限/mutation/broader fallback/locked-name/write leak 全为 0；这些不是 Provider
      账单或产品 SLA；
- [x] S3 focused `14/14`、Agent `1122/1122`、AI `323/323`、Types `42/42 + tsc`、Web `439/439`、Server
      build/lint 与非数据库 226 suites/2153 tests 通过；Types lint 因既有 eslint/PATH 问题未通过，Server
      数据库 suites 因 PostgreSQL `127.0.0.1:5433` 未启动未通过；
- [x] S3 fault/abort/semantic mismatch/unknown fault fail-closed、anti-oracle、临时 bundle strict validator 与
      V1--V9/R3/L1/L2 history parity 通过；global fetch/credential/Provider、approved tag 与正式 full-gate
      marker/journal/artifact/recovery claim 全为 0；
- [x] `@repo/ai` shared runtime barrel 不再重导出四个 executable CLI；CLI 文件/package scripts 保留，测试
      直接导入对应文件，CommonJS/Nest/Jest 不再因普通 runtime import 解析 CLI 的 `import.meta`；
- [x] S3 authority 仅 `full_gate_mock_quality_not_evidence / qualityAuthority=none`；它随后只解锁独立 L3
      admission，不形成真实 Provider quality authority；
- [x] L3 admission 已在用户 fresh 数据边界接受与 exact authorization 后完成；approved tag 本地/远端、
      HEAD/upstream/remote 均固定为 `3c5cc6c57fdf6d3366ac695d3305e2cc85fd2599`，七个 source SHA、历史
      V1--V9/R3/L1/L2 validators 与 reservation 前正式文件为 0 均通过；
- [x] L3 fresh preflight 为 `direct_ready / configured=0 / probe=0 / providerCalls=0`；credential 只在唯一
      独立进程内映射为专用变量，未输出、写回、提交或进入 evidence；
- [x] 唯一 L3 run `2b0ac3a0-631f-4c7f-9781-ce0cda94149a` 为 guard `24/24`、runtime
      reserved/terminal/orphan/not-started `22/22/0/26`、wire `22/22/22/21`、strict runtime `21/48`；
- [x] `tutor-v2-runtime-11` 在 response audit/content parse 后以 `attempted_failed / schema / wire 1/1/1/0`
      收口；Organizer sibling 成功，pair close 后 `schema` breaker 令剩余 26 lane 为
      `not_started_quality_breaker`；
- [x] L3 incomplete aggregate 正确保持 semantic/L2 anchor/P95/token/CNY 全 `null`；safety、permission、
      mutation、broader fallback、locked-name 与 write-command failure 全 0；
- [x] L3 marker/journal/artifact SHA 为 `ed0648d...8ebb8 / e8f9046a...d6ef / e081939b...dbe5`；journal
      `296` 条并以 `evidence_published` 收口，validator `ok=true`，recovery claim=0；
- [x] L3 最终 `full_gate_quality_gate_failed / qualityAuthority=none`；名额已消费，禁止
      retry/resume/replay/backfill、Live/seal/recovery、追加 Provider 探测或修改 evidence。产品
      Docker/API/browser、main、Phase 6.9.8 与后续阶段继续阻断；
- [x] Schema Recovery SR0 只读取证 L3、Tutor V6 contract/candidate、第一方 adapter、F2 runner 与 S3
      reviewed Mock；确认失败位于 `content_parsed` 后、`schema_validated` 前，但不推断具体字段、原始输出或
      外部唯一根因；
- [x] SR0 冻结 Provider envelope -> selection projection -> strict projected decision -> local authority/merger；
      只有 canonical integer `intentIndex` 获得模型选择权，depth/策略/answer/权限仍由本地重建；
- [x] SR0 允许无权威 extension fields 在有界 shape audit 后丢弃，但 missing/alias/string/fraction/null/range、
      duplicate key、wrapper/fence/prose/BOM/trailing data 仍 fail-closed，禁止 coercion/default/clamp/retry；
- [x] SR0 bounded diagnostic 只允许 fixed stage/reason/type/count bucket、枚举化 shape SHA 与
      `rawDataRetained=false`，禁止 raw output/hash、Zod path/value、unknown key 名、prompt、credential、用户正文
      或 oracle；
- [x] SR0 冻结独立 `phase-6.9.7-tutor-organizer-full-gate-schema-recovery-v1` lineage、SR1--SR7、source
      admission、journal/report/validator invariants 与逐阶段停止门；旧 L3 tag/artifact/validator 不改写；
- [x] SR0 authority 仅 `zero_provider_full_gate_schema_recovery_design`；未修改 packages/apps 源码，未读取
      credential、调用 Provider、执行正式 Mock/Live、启动 Docker/API/browser、创建正式 artifact/tag 或修改
      业务数据；
- [x] SR1 以 `zero_provider_full_gate_schema_recovery_tdd` 新增 exact-schema raw parser capability、有界 native
      JSON envelope parser、canonical integer `intentIndex` projection、strict projected decision 与 bounded no-raw
      diagnostic；contract SHA 为 `e2453fae...11579`；
- [x] SR1 candidate 最多一次 runtime dispatch、不 retry，继续复用 Tutor V6 local signal/preferred depth、
      `answer_direct` 权限与 merger；budget/abort/usage/Trace 继续 fail-closed；
- [x] SR1 focused/direct `41/41`、V6/V8/V9/F1/S3 兼容 `70/70`、Agent `1135/1135`、AI
      `325/325`、Agent/AI typecheck/lint、Prettier 与 `git diff --check` 通过；
- [x] SR1 未读取 credential、调用 Provider、执行正式 Mock/Live、启动 Docker/API/browser、创建正式
      tag/marker/journal/artifact 或修改业务数据；旧 L3 validator 仍为
      `ok=true / journalRecords=296 / evidence_published`，artifact SHA `e081939b...dbe5`；
- [x] SR2 冻结独立 fixture/responder identity，fixture SHA `43248bfa...0d41e`；responder 只读取实际
      bounded prompt/eligible ordinals，不导入 expected/oracle/scorer/production validator；
- [x] SR2 覆盖全部 24 个 Tutor runtime（含 runtime 11）、18 个 Provider shape、5 个 held-out、Unicode/
      byte/depth/node/key limit、transport/HTTP/response-audit/usage、budget 与 pre/in-flight/post abort；
- [x] SR2 attempted 路径 exactly one dispatch/no retry；schema failure 接入 F2 memory runner 后得到
      `2/2/0/46`，Organizer sibling 收口、46 lane 由 schema breaker 阻断，正式 durability 文件为 0；
- [x] SR2 focused `9/9`（`484` assertions）、兼容 `51/51`（`1133` assertions）、Agent `1144/1144`、
      AI `325/325`、typecheck/Prettier 与旧 L3
      validator 通过；credential/Provider/正式 Mock/Live/Docker/API/browser/业务数据/formal artifact=0；
- [x] SR3 以独立 `phase-6.9.7-tutor-organizer-full-gate-schema-recovery-v1` lineage 建立 report/runner/
      source/CLI/marker/journal/artifact/validator/crash-only recovery；source manifest SHA
      `1a811394...adfbb`；
- [x] SR3 固定 `72/24/48/24/32`，Schema Recovery wrapper 私有持久化
      `schema_stage_started/succeeded/failed`，旧 F2 只作为非持久化 scheduler/metric kernel；
- [x] SR3 strict validator 重算 schema/wire/usage/semantic/anchor/P95/CNY/breaker/publication；截断、CRLF、
      hash/reorder/duplicate terminal/raw field、额外正式文件、旧 lineage 与 artifact mutation 均拒绝；
- [x] SR3 crash-only recovery 只解释 durable prefix，不创建 executor 或 retry/resume/replay/backfill；
      crash-after-usage 保留 wire `1/1/1/1`，但 schema `not_observed`、usage/aggregate 仍为 `null`；
- [x] SR3 CLI 只开放 zero-provider validate/crash-only seal，对依赖结果执行 exact-own-data 白名单；SR5
      confirmation/approval/credential/source admission/marker reservation/harness/executor/fetch ports 未开放；
- [x] SR3 focused `23/23`、兼容 `105/105`（`3633` assertions）、Agent `1167/1167`、AI `325/325`、
      typecheck/lint/Prettier/diff 与独立 contract/security/test-coverage 终审通过；
- [x] SR3 未读取 credential、调用 Provider、执行正式 Mock/Live、启动 Docker/API/browser 或修改业务数据；
      旧 L3 validator/SHA 不变，正式 SR5 files/tag 为 0；
- [x] SR4 使用独立 reviewed Mock factory `phase-6.9.7-tutor-organizer-schema-recovery-reviewed-mock-v1`，
      factory/checkpoint SHA 为 `8f18c1c2...3d44 / 03bb81a6...6960`；
- [x] SR4 fresh baseline 与固定 `72/24/48/24/32` 分母通过；runtime `48/48/0/0`、wire
      `48/48/48/48`、schema `42 canonical + 6 extension discarded`；
- [x] Tutor/Organizer/Combined semantic `1/0.996875/0.9984375`、L2 anchor `1`、usage
      `17732/654`、费用 `0.05712 CNY`；gate 固定
      `schema_recovery_mock_quality_not_evidence / qualityAuthority=none`；
- [x] SR4 fault/pre-abort/fixed-denominator、anti-oracle/no-raw/no-env、SR3 临时 bundle validator、旧/新
      lineage rejection、history parity、Reader Testing 与两路独立终审通过；
- [x] global fetch、credential、Provider、正式 SR5 files/tag、产品 API/browser 与正式业务写入均为 0；
- [x] SR5 admission source commit、HEAD/upstream/remote branch 与 local/remote approved tag 均精确固定在
      `67661f5f...d4441`；SR3 source manifest、SR5 admission manifest 与 runnable bundle SHA 分别为
      `1a811394...adfbb / ce3eccee...d5ddf / 61e6bb60...d08c`；
- [x] 第一次 SR5 CLI 前门 `source_invalid` 发生在 credential/marker/Provider 前，`providerCalls=0`、
      `evidenceSealed=false`、正式文件=0，未消耗唯一 reservation；zero-provider 分解复核通过后才开始正式 run；
- [x] 唯一 SR5 run `63f8a76b...04cb` 为 `live / deepseek_network`，guard `24/24` zero-call，runtime
      `48/48/0/0`，wire `48/48/48/48`，strict `48/48`，schema
      `48 canonical / 0 extension / 0 rejected / 0 not-observed`；
- [x] SR5 Tutor/Organizer/Combined semantic 为
      `0.9736111111/0.9515968407/0.9626039759`，improvement
      `0.3106468254/0.6734718407`，L2 anchor `0.9141666667/0.9041666667/0.9091666667`；Tutor/Organizer/
      paired P95 `1836/2240/2240ms`，usage `20966/789`，费用 `0.067632 CNY`；
- [x] SR5 critical/permission/mutation/broader fallback/locked-name/write leak 全 0，breaker closed；最终
      `schema_recovery_quality_gate_passed / schema_recovery_full_gate_semantic_gate`；
- [x] SR5 marker、628 条 hash-chain journal 与 hard-link artifact 由正常 runtime publication 封存，final event
      `evidence_published`，strict validator `ok=true`，artifact SHA `87dd826b...18be`，recovery claim=0；
- [x] SR5 一次性名额已消费；禁止 retry/resume/replay/backfill、Live/seal/recovery、curl、单 case、产品 API
      或其它 Provider 探测，也禁止移动 approved tag 或修改 L3/SR4/SR5 evidence；
- [x] SR5 只形成固定 72-case/24-pair 分支评测语义 authority，不形成产品、Docker/API/browser、Trace、业务
      写入、SLA 或 main authority；该 checkpoint 当时只解锁 SR6 分支产品验收；
- [x] SR6 新增 SHA-bound `phase-6.9.7-sr6-product-replay-v1`，只在 `AI_PROVIDER_MODE=mock`、全部
      Agent/Live gate 关闭、全部 Provider credential 为空、RAG=fake、API role 与 exact component/request cap
      同时成立时启用；任一条件不符 fail-closed；
- [x] SR6 `sr5_sealed_replay` 绑定 SR5 physical artifact SHA `87dd826b...18be`，但只依据当前 bounded Tutor
      V6 / Organizer V9 prompt 生成 deterministic first-local-option Mock output；不读取/逐字重放 SR5 Provider
      response、Trace、模型原文或业务写入，不读取 expected/oracle；
- [x] Tutor Web product composition 已切换到 Schema Recovery candidate；Organizer Nest single/batch 已切换到
      V9 ordinal-only candidate；两条路径继续保留 signal/depth/answer、owner/真实 ID/locked-name/stale/Trace/
      write command 本地权威；
- [x] replay Trace 固定为 mock identity；Tutor `pricingKnown=false/cost=null`、Organizer
      `pricing=not_applicable/cost=0`，不能冒充 `production_live` 或进入 DeepSeek billing；`both` 总 cap=2 且
      Tutor/Organizer 各最多 1 次；
- [x] Docker/API：Tutor 登录态 + OCR context `/api/chat` 为 `candidate_applied`；Organizer single/batch 为
      `hybrid_model/candidate_applied`，batch `3/3`、locked name 不变；跨账号统一 404 且无 Trace/业务写入；
- [x] forced failure：Tutor 保持 Chat 成功，Organizer 返回
      `local_deterministic/fallback_runtime_error`；没有伪造 Provider usage/费用或丢失本地组织结果；
- [x] 可见 `/chat`、`/error-book`、`/agent-trace` 通过；三张截图 SHA 分别为
      `215b7d67...9dc / 668f9621...2956 / bc564931...e79f`，浏览器清理后窗口保留在 `/login`；
- [x] 精确清理 3 个合成账号、6 道错题、2 个分组、2 个专题、5 个关联项、8 条 Trace/31 steps、8 条
      ChatMessage、16 个 refresh token；业务与 browser storage residue=0；未 reset 数据库、删 volume、Redis
      FLUSH、MinIO wipe、`down -v` 或 prune；
- [x] SR6 replay `4/4`、Tutor/Web `10/10`、Web `444/444`、Server env `87/87`、Agent typecheck、Server
      build、最终源码 Docker server/web build 与 SR5 strict validator 均通过；四路只读复审 APPROVED；
- [x] 最终 server healthy、web `/login=200`、worker healthy；全部 Agent/replay gate=false，server/worker RAG
      为 `qwen/text-embedding-v4/1536`；凭据只检查存在性且未输出值；
- [x] SR6 全程 `providerCalls=0`，只形成分支 zero-provider 产品 composition/权限/Trace/降级/UI/清理证据；
      不提升 SR5 semantic authority，不形成真实模型产品质量、SLA、生产部署或 main authority；当前仅 SR7/main
      合并/推送/default-off 回放待执行，Phase 6.9.8 与后续 Phase 继续阻断；
- [x] SR7 已将 SR6 功能提交 `64d4ff45` 以 `510bbc94` 合并 main 并推送远程；验收发现精确“这一步”句式
      未路由 Tutor 后，从最新 main 新建普通分支，以 `43af2e85` 修复并由 `006f54e9` 再次合并/推送 main；
- [x] 精确 Router 回归 `6/6`、Web server-only 正确 Node runner `25/25`、受影响 Router/runtime/Chat、Agent
      typecheck/lint/Prettier/diff 均通过；错误 Bun runner 结果未计入产品失败；
- [x] main Docker server/web 逐个 build 成功并精确重建；server healthy、web `/login=200`、worker healthy；
      mode=mock、Live=false、全部 Agent/replay gate=false，未执行 `down -v`、prune、database reset、Redis
      `FLUSH*` 或 MinIO wipe；
- [x] Organizer default-off 为 `local_deterministic / gate_disabled / degraded=false / traceId absent`，调用前后
      Trace=0，可见 `/error-book` 显示“本地规则”；
- [x] 修复后的精确 Tutor 句为 `route=tutor / intent=step_check`；Tutor candidate
      `attempted=false / inputTokens=0 / outputTokens=0 / LIVE_CALLS_DISABLED / pricing=unknown`，模型调用总数 0；
      Trace 为 `mock/completed/cost=0`，顶层 Mock token estimate 未误写成 Provider verified usage；
- [x] 四张本地可见浏览器截图 SHA 已固定在 SR7 验收文档；错误路由截图与 Playwright page/console 临时文件
      已精确删除，浏览器窗口保留在空白 `/login`；
- [x] 两个 main 合成账号及 refresh token、错题/Organizer 关系、会话/消息、Trace/steps、tracked Outbox 全部
      精确清理为 0；cookie/local/session/cache/service worker=0，自动重建的 5 个 IndexedDB store rows=0；
- [x] SR7 没有重跑 SR5、启用 SR6 replay 或执行 Provider 探测，只形成 zero-provider main/default-off
      authority。Phase 6.9.7 正式完成，下一阶段仅 Phase 6.9.8 RetrieverAgent / FinalResponseAgent contract；

完整设计与证据见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v9-remediation-design.md`、
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v9-remediation.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-v9-r4-static-mock.md`、
`docs/acceptance/2026-07-30-phase-6-9-7-tutor-organizer-v9-controlled-live-failure.md`、
`docs/acceptance/2026-07-30-phase-6-9-7-architecture-recovery-r1-transport-diagnostics.md`、
`docs/acceptance/2026-07-30-phase-6-9-7-architecture-recovery-r2-provider-health-canary.md` 与
`docs/acceptance/2026-07-30-phase-6-9-7-architecture-recovery-r3-zero-provider-checkpoint.md`、
`docs/acceptance/2026-07-30-phase-6-9-7-architecture-recovery-r3-controlled-live-failure.md`、
`docs/acceptance/2026-07-30-phase-6-9-7-architecture-recovery-proxy-preflight.md`、
`docs/superpowers/specs/phase-6-9-7-architecture-recovery-provider-canary-v2-design.md`、
`docs/superpowers/plans/phase-6-9-7-architecture-recovery-provider-canary-v2.md` 与
`docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-d0-reentry-design.md`、
`docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-c1-zero-network-contract.md` 与
`docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-one-shot-durability.md`、
`docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-l1-success-diagnostic-only.md`、
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-p1-zero-provider-semantic-gate-design.md`、
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-p1-zero-provider-semantic-gate.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-p1-zero-provider-semantic-gate.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-g1-contract-baseline.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-g2-runner-durability.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-s2-reviewed-mock-static.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live.md`、
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate-design.md`、
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-f1-full-contract-baseline.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-f2-runner-durability-evidence.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-s3-reviewed-mock-static.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-l3-controlled-live-quality-gate-failure.md`、
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-design.md`、
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-full-gate-schema-recovery.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r0-zero-provider-design.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r1-zero-provider-tdd.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r2-zero-provider-robustness.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r3-runner-durability.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r4-reviewed-mock-static.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r5-controlled-live-quality-gate-pass.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-sr6-product-acceptance.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-sr7-main-acceptance.md`。

## 12. Phase 6.9.8 Retriever / FinalResponse 验收入口

Task 0 `zero_provider_retriever_final_response_design`：

- [x] 从已推送最新 main `185b8171...` 新建普通分支
      `drb/phase-6-9-8-retriever-final-response-contract`；未使用 worktree、未从功能分支再开分支；
- [x] 记录 `packages/rag/src/retriever.ts` stub、真实 Nest owner-scoped Qwen hybrid search、Chat
      `web-chat-user`、Markdown citation、pre-stream Trace 与 descriptor-only graph；
- [x] 冻结 `AgentExecutionContextV1`、`AgentMessageEnvelopeV1`、`RetrieverRequest/ResultV1`、
      `VerifiedEvidenceBundleV1` 与 `FinalResponseRequest/StreamEventV1`；
- [x] owner/JWT、model/local authority、permission、reason/usage attribution、abort/concurrency/terminal/no-loss
      边界已冻结；
- [x] query rewrite 使用 default-off gate + 4000ms + Web-only 独立 key；FinalResponse 使用 default-off gate +
      20000ms + Web-only 独立 key；generic/其它 Agent credential 不可替代；
- [x] FinalResponse model projection 只含 `citationId/sourceLabel/excerpt/trustLabel`，sourceLabel 为非敏感 ordinal
      alias；真实 title/document/chunk/source ref 不进入 prompt/output/public event；
- [x] owner 与同一 auth receipt/request/bearer token deep-freeze 绑定；safe modelRef 不含 endpoint/credential；
      exactly-once 仅指 server emitter/Trace terminal，不冒充网络交付保证；
- [x] citation/tool status/verified usage/cost/Trace terminal 保持本地 authority；首 token 前后失败与 partial/
      incomplete 规则已冻结；
- [x] 同步 stream 不创建 BackgroundJob/Outbox；未来异步化必须同时设计 BackgroundJob + Durable Outbox +
      idempotency key；
- [x] 固定 16 guard + 16 rewrite runtime + 16 FinalResponse runtime、Recall/nDCG/grounded/citation/P95/token/CNY/
      null aggregate 门；
- [x] DeepSeek run cap 为 32 calls / 0.32 CNY；paired search 最多 32 次 Qwen embedding。Qwen price/cap 未冻结
      时 controlled-Live admission fail-closed；
- [x] Task 0 未修改 apps/packages、未读取 credential、未调用 Provider、未启动 Docker/API/browser、未创建正式
      marker/journal/artifact；
- [x] Task 0 完成后只解锁 Task 1 shared Zod contracts。

Task 1 `zero_provider_retriever_final_response_shared_contract`：

- [x] `AgentExecutionContextV1` strict principal union、opaque owner format、deep-freeze 与同一 auth receipt/request/
      bearer reference binding；`AbortSignal` 保持不可枚举、不可序列化；
- [x] `AgentMessageEnvelopeV1` strict unknown-key/status/payload/degraded/reason/usage invariants；`skipped` 不得携带
      usageRef，同一 modelCallId 只能有一个 direct attribution；
- [x] `RetrieverRequest/ResultV1` 固定 query/context/topK/minScore/filter、hash、hybrid metadata、最多 8 条 evidence
      candidate 与 ID/score/safety/reason 上限；
- [x] `VerifiedEvidenceBundleV1` 通过本地 constructor 创建，最多 4 条；ordinal `sourceLabel`、citation/reason 去重、
      unsafe excerpt 与非本地 bundle fail-closed；
- [x] `FinalResponseRequestV1` 拒绝 owner/token/raw 字段；RAG budget 整层丢弃时 bundle/citation 同步清空；模型
      evidence projection 只有 `citationId/sourceLabel/excerpt/trustLabel`；
- [x] `FinalResponseStreamEventV1` safe modelRef、单调 contiguous sequence、唯一 terminal、terminal-last、exact
      `citationId -> sourceLabel` allowlist 与 pre-token/partial/abort failure invariant；
- [x] hostile getter/proxy、NaN/unsafe integer、unknown key、duplicate reason/citation/message/model attribution、输入
      不变性与返回值 deep-freeze negative tests 通过；
- [x] `@repo/agent` root 与 `@repo/agent/realtime-chat` subpath export 已完成；SR5 历史回归改为 approved-tag Git
      blob bundle/commit/detached anchor 校验，不再错误绑定当前可变 worktree，sealed authority 未改写；
- [x] focused、Agent full/typecheck/lint、Prettier、diff 与独立 contract/history 复审通过；全程 zero-provider，未读
      `.env`/credential，未启动 Docker/API/browser。

当前完成状态与后续边界：

- [x] Task 2 canonical principal 接线、删除 `web-chat-user`、opaque bearer/owner/context binding 与并发/取消回归；
- [x] Task 3 正式 Retriever node、opaque authenticated search port 与 16+16 original-query deterministic
      baseline；
- [x] Task 4 exact-context-bound evidence projector、SafetyGuard/Verifier 保守收紧、4×700 bundle、本地
      structured citation/Markdown adapter、RAG 整层丢弃与脱敏 Trace；
- [x] Task 5 default-off query rewrite candidate、独立预算/凭据、完整字段安全扫描、本地 validator/merger、
      Web-only config/runtime 与 Compose allowlist；authority 仅
      `zero_provider_retriever_query_rewrite_candidate`，reviewed Mock `qualityAuthority=none`、Provider calls=0；
- [x] Task 6 正式 FinalResponseAgent、DeepSeek V4 Pro non-thinking streaming adapter、authenticated/exact-context/
      safety/config/deadline/abort/budget 前置门、本地 citation allowlist 与唯一 terminal ledger、Web-only default-off
      config/runtime/Compose allowlist；authority 仅 `zero_provider_final_response_stream_contract`，
      `qualityAuthority=none`、Provider calls=0；该 checkpoint 当时尚未接 `/api/chat`；
- [x] Task 7 `/api/chat` 已按 canonical auth -> minimal Trace -> Router/Tutor -> Retriever/query rewrite -> Verifier ->
      evidence projector -> Trace prepare -> FinalResponse stream -> terminal finalize 串联；anonymous Mock 在 Provider
      config/Agent runtime 前返回；
- [x] Task 7 realtime Trace `start/prepare/finalize`、preparation digest 幂等、CAS terminal、全局唯一
      `modelCallId`、legacy/late/conflicting 409 与 concurrent finalize 单胜者已实现；步骤只保存固定脱敏摘要与计数；
- [x] Task 7 response cancel/parent abort 会清理底层 reader；stream sequence/citation lockstep/terminal-last/唯一
      terminal fail-closed；Retriever transport/schema failure 保持 no-RAG，bundle/citation/Markdown 整层清零；
      principal binding/abort 分别为 403/499；
- [x] Task 7 authority 为 `zero_provider_chat_composition_terminal_trace`，`qualityAuthority=none`、Provider calls=0，
      两个模型 gate default-off，同步流不创建 BackgroundJob/Outbox；未执行产品 Docker/API/browser、48-case、
      controlled-Live 或 main；
- [x] Task 7 focused Web `17/17`、AgentTracesService `17/17`、Types `42/42 + tsc`、Server build 与受影响
      Web/Server lint 已通过；完整 Web `tsc` 仍有仓库既有 `.test.mts` 类型债，Task 7 新增文件无诊断；数据库 E2E
      已更新，但因 Redis/PostgreSQL 未运行而 `environment_blocked`，不形成真实数据库迁移/API authority；
- [x] Task 8 固定独立 `16 guard + 16 rewrite + 16 FinalResponse` manifest/policy 与 prompt-only Mock responder；
      responder 只读取 production candidate/node 生成的 actual bounded prompt，不导入 manifest/expected/oracle；
- [x] Task 8 guard `16/16` 且 zero-call `16/16`；rewrite strict/usage/runtime `16/16/16`，original/candidate
      Recall@5 `0.875/1`、nDCG@5 `0.56923614767/1`、uplift `0.43076385233`、critical/intent `1/1`；
- [x] Task 8 FinalResponse strict/terminal/usage `16/16/16`，grounded/citation precision/required recall/critical notice
      `1/1/1/1`，false tool success/citation 与全部 critical safety failure 为 0；
- [x] Task 8 strict report/scorer/canonical bytes validator、single-consume/no-retry capability、source admission/parity/
      artifact-zero contract 已完成；admission 核对 Git root/branch/HEAD/upstream/origin ref/clean tree，并从 exact
      commit blobs 重算 bundle SHA，伪造 SHA/ref 漂移/dirty tree/缺 blob 均拒绝；静态报告明确
      `sourceAdmissionExecuted=false`，不冒充 Task 9 正式 admission；
- [x] `.codex/` 已由仓库 `.gitignore` 固定为本地状态目录，不进入提交且不再让 Task 9 admission 永久失败；其它
      untracked 与所有 tracked 漂移仍按 dirty tree 拒绝；
- [x] Task 8 gate 固定 `mock_quality_not_evidence / qualityAuthority=none`；synthetic DeepSeek estimate
      `0.027366 CNY`，P95/Qwen verified/aggregate verified cost 为 `null`；Provider/credential/Qwen calls 与正式
      marker/journal/evidence/recovery 均为 0；
- [x] Task 8 focused `8/8`、受影响 Agent/Web `47/47 + 24/24`、Agent full `1252/1252`、Agent typecheck/lint、
      CLI frozen SHA、Prettier/diff/Compose default-off static 与两路独立只读复审通过；未启动 Docker/API/browser、
      修改业务数据或合并 main；
- [x] Task 9A 依据阿里云百炼官方模型与 OpenAI-compatible Embedding 文档冻结北京区
      `text-embedding-v4 / 1536 / 0.5 CNY per 1M input tokens`、业务空间/legacy endpoint profile、
      `prompt_tokens == total_tokens` 与 32 次单文本最坏 `262144 tokens / 0.131072 CNY` cap；
- [x] Task 9A `@repo/ai` strict direct transport 固定 single call/no retry/AbortSignal、exact request/response/index、
      1536 维 finite non-zero vector、verified usage/CNY 与固定脱敏错误；injected fetch 永久 `synthetic_test`；
- [x] Task 9A focused `8/8`、AI full `337/337`、AI typecheck/lint、Prettier、diff/link/static 与两路只读复审
      通过；未读 credential、未调用 Provider、未创建 approved tag/正式 marker/journal/artifact，authority 仅
      `zero_provider_qwen_embedding_transport_price_contract / qualityAuthority=none`；
- [x] Task 9B 固定 16 guard-first + 16 个 original-Qwen/rewrite-DeepSeek/candidate-Qwen 串行 pair + 16
      FinalResponse 的 64-call schedule；Qwen/DeepSeek 各 32 次独立 attempt/dispatch/response/verified usage/
      token/CNY，cap `0.131072 / 0.32 / total 0.451072 CNY`，不完整 aggregate=`null`；
- [x] Task 9B source admission、双 single-use WeakMap capability、reservation 前 source drift recheck、exclusive
      marker、dispatch-before-call fsynced hash-chain journal、hard-link artifact、strict recomputing validator 与
      crash-only seal 已完成；禁止 retry/resume/replay/backfill；
- [x] Task 9B Reviewed Mock 得到 guard `16/16`、Qwen/DeepSeek wire+usage 各 `32/32/32/32`、rewrite nDCG
      `0.56923614767 -> 1`、FinalResponse/safety 全门通过；gate 固定
      `task9b_mock_quality_not_evidence / qualityAuthority=none`，synthetic CNY/P95 不是 Live authority；
- [x] Task 9B focused `27/27`、Agent full `1279/1279`、AI full `337/337`、Agent typecheck/source lint、
      Prettier/diff/CodeGraph 与独立 authority/durability/contract 复审通过；Provider/credential/Qwen external
      calls=0，approved tag/正式 marker/journal/artifact/recovery=0，未启动 Docker/API/browser；
- [x] Task 9C fresh DeepSeek/Qwen 数据边界接受与 exact one-shot authorization 已消费；approved source/tag/
      HEAD/upstream/origin 均为 `66a009dd...`，source bundle `2c1b2bb3...`，proxy preflight zero-call ready；
- [x] 唯一 run `28b5f92f...` 已正常 durable seal：guard `16/16` zero-call，实际 Provider calls `5/64`，
      Qwen wire/usage `3/3/3/3`、DeepSeek `2/2/1/1`；第二条 DeepSeek rewrite
      `schema_invalid / wire 1/1/0/0` 后剩余 59 次 `not_started_quality_breaker`；
- [x] 最终 rewrite/FinalResponse strict `1/16 / 0/16`，semantic/P95/token/CNY aggregate 全 `null`；gate
      `task9_quality_gate_failed / qualityAuthority=none`。Journal `134`、`evidence_published`、validator `ok=true`、
      report/artifact SHA `c612d6f7... / 7d45329d...`、recovery claim=`null`；
- [x] Task 9C 失败封存边界已记录：禁止 retry/resume/replay/backfill、补跑、seal/recovery、artifact 改写或追加
      Provider 探测；不能把本地 `schema_invalid` 归因为具体 payload/transport/账号/服务端；
- [x] Architecture Recovery R0 已冻结独立 lineage、三类调用阶段机与 `providerWire/runnerWire` 双层观察；明确
      runner response=0 不能单独证明 Provider response=0，也不能反向重写 Task 9C；
- [x] R0 bounded diagnostic 只允许 fixed stage/reason/provider-boundary/type-count bucket 与
      `rawDataRetained=false`；禁止 raw、unknown key、Zod issue/path/value、credential/URL/raw error 及
      raw-derived hash；
- [x] R0 保持 16 guards、64 calls、双 Provider accounting、阈值、预算、owner/citation/local authority、
      no-retry 与 breaker 不变；Provider/credential/formal evidence/Docker/API/browser/business writes 全为 0；
- [x] Recovery R1 strict diagnostic、module-owned opaque rewrite session 与第一方 V7 terminal wire snapshot 只读投影
      已完成；Provider observation 不再接受 caller-supplied 状态，forged/reused/active capability 均 fail-closed；
- [x] R1 focused `11/11`、AI wire/export `25/25`、Agent full `1289/1289`、Agent/AI typecheck/lint 通过；external
      Provider/credential/formal evidence/Docker/API/browser/business writes 全为 0；
- [x] Task 9C 只读 validator 仍为 `ok=true / 134 / evidence_published`；report/artifact SHA 保持
      `c612d6f7164d5491e54422abb2e8504cbb707aeea3b641e8c57285d957b8b4a4 /
7d45329debde6def4c5bc8bbda28609b507a71766ae06e00806e44eaf7b3614c`，旧 namespace 写入=0；
- [x] R1 authority 仅
      `zero_provider_retriever_final_response_architecture_recovery_tdd / qualityAuthority=none`；包内 local mapper
      仍须 R3 source-admitted runner/validator 绑定，不形成 durability、Live、产品或 main authority；
- [x] Recovery R2 新增 `qwen_retrieval/final_response_stream` 两个第一方 wire family、module-owned single-use
      capability 与 terminal snapshot；mutation 不进入 `@repo/ai` 公共 barrel；
- [x] R2 Qwen 将 transport/HTTP/envelope、embedding count/index/dimension/value、usage 分域；FinalResponse 将
      transport/HTTP/stream、terminal missing/duplicate/not-last、false-tool、usage 与 abort 分域；
- [x] 首个畸形 stream event 固定为 `response_observed + stream_event_invalid`，empty/no-event 才是
      `response_not_observed`；两者都不冒充 success，且不保留 raw/error/unknown key/hash；
- [x] R2 forged/reused/active/cross-family/out-of-order capability 与 hostile getter/Proxy 全部 fail-closed；focused
      compatibility `58/58`、AI full `345/345`、Agent full `1301/1301`、Agent/AI typecheck/lint 通过；
- [x] R2 authority 仅
      `zero_provider_retriever_final_response_architecture_recovery_robustness / qualityAuthority=none`；external
      Provider/credential/formal evidence/Docker/API/browser/business writes 全为 0；cost/ranking/citation/Trace/
      delivery/result mapper 仍须 R3 runner/validator/durability 绑定；
- [ ] Recovery R3 runner/durability/admission；R4 reviewed Mock/static；
- [ ] Task 10 分支 Docker/API/可见浏览器/Trace/权限/精确清理；
- [ ] Task 11 文档复审、main `--no-ff`、main default-off 复验与远程 SHA 对齐。

设计、计划、Task 0--9C 与 Architecture Recovery R0--R2 验收见
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-agents-design.md`、
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-agents.md` 与
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
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r0-zero-provider-design.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r1-zero-provider-tdd.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r2-zero-provider-robustness.md`。
