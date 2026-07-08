# PrepMind AI 开发日志

> 维护规则：`DEVLOG.md` 只记录阶段级里程碑、关键工程决策和验收结果，不堆叠逐提交流水账。每个关键阶段必须写清“为什么做、做了什么、边界是什么、怎么验收”，方便后续接手、复盘和面试表达。完整路线看 `docs/roadmap.md`，当前数据边界看 `docs/data-flow.md`，面试复盘看 `docs/blogs/`，具体实现追溯看 `git log`。

## 当前快照

更新时间：2026-07-08

当前阶段：Phase 7.14.4 已完成，后续继续 Phase 7 operator 审计与运维诊断生产化。

| 阶段 | 状态 | 关键词 |
| --- | --- | --- |
| Phase 0 | 已完成 | Monorepo、Prisma 初稿、Docker 基础设施 |
| Phase 1 | 已完成 | 前端 MVP、AI 聊天、OCR、错题本、Dexie |
| Phase 2 | 已完成 | NestJS、Auth、PostgreSQL、业务 API 迁移、MinIO |
| Phase 3 | 已完成 | OCR structured output、讲题 prompt、多题保存 |
| Phase 4 | 已完成 | FSRS、ReviewTask、离线评分、学习统计、复习计划 |
| Phase 5 | 已完成 | RAG 数据模型、文档处理、检索、Chat RAG、`/knowledge` |
| Phase 6 | 已完成 | 多 Agent、Trace、Memory、Review/Planner、Knowledge agents |
| Phase 7.0 | 已完成 | BackgroundJob 控制面 |
| Phase 7.1 | 已完成 | BullMQ 文档处理队列、inline / queue 双模式 |
| Phase 7.2 | 已完成 | RAG SafetyGuard、prompt injection chunk 过滤 |
| Phase 7.3 | 已完成 | EventBus 失败隔离、后台任务 summary、`/knowledge` 任务摘要 |
| Phase 7.4 | 已完成 | Swagger / OpenAPI debug docs、`/api-docs`、response envelope 说明 |
| Phase 7.5 | 已完成 | Swagger 中文说明、核心写接口 request body 示例 |
| Phase 7.6 | 已完成 | API / worker 启动拆分、worker-only application context、Docker worker profile |
| Phase 7.7 | 已完成 | Worker Observability、Redis heartbeat、队列 backlog 与 `/knowledge` 健康状态条 |
| Phase 7.8.1 | 已完成 | RAG Eval Baseline、固定检索评估集、recall@k / top1 / safety / no-hit 指标 |
| Phase 7.8.2 | 已完成 | Hybrid Retrieval、向量候选 + PostgreSQL full-text keyword 候选、融合排序 |
| Phase 7.8.3 | 已完成 | RAG Eval Smoke、本地 API 级上传/处理/检索/eval 串联验收 |
| Phase 7.8.4 | 已完成 | RAG Eval Smoke 收尾增强、case guard、keep-data 开关、面试博客 |
| Phase 7.9.1 | 已完成 | Durable Outbox 地基、`OutboxEvent`、claim / retry / dead-letter 状态机 |
| Phase 7.9.2 | 已完成 | Outbox Dispatcher 最小闭环、handler registry、知识库 requested 事件入库 |
| Phase 7.9.3 | 已完成 | Outbox Dispatcher worker-only 受控运行、生产默认关闭、防重入 tick |
| Phase 7.9.4 | 已完成 | Outbox Summary / Metrics、worker observability 安全只读指标 |
| Phase 7.10 | 已完成 | Outbox Ops 后端闭环、脱敏列表/详情、安全 requeue |
| Phase 7.11 | 已完成 | Worker Readiness、`/worker-readiness`、部署前 CLI readiness 命令 |
| Phase 7.12 | 已完成 | Docker worker healthcheck、容器级 readiness 状态接入 |
| Phase 7.13 | 已完成 | Docker Web 镜像、Next standalone、全栈 Compose 启动与浏览器验收 |
| Phase 7.14.1 | 已完成 | Operator 权限与操作审计设计文档 |
| Phase 7.14.2 | 已完成 | OperatorGuard、系统级诊断入口 admin-only 访问控制 |
| Phase 7.14.3 | 已完成 | OperatorAuditLog、审计 service、脱敏 metadata 与来源 hash |
| Phase 7.14.4 | 已完成 | Outbox requeue 成功/失败审计接入 |

## 近期关键记录

### 2026-07-08 - Phase 7.14.3 / 7.14.4 OperatorAuditLog + Outbox Requeue Audit

本轮目标：在 OperatorGuard 之后补上操作审计地基，并把 `POST /outbox-events/:id/requeue` 接入成功/失败留痕，避免审计 service 变成未接主链路的死码。

完成内容：
- Prisma schema 新增 `OperatorAuditAction`、`OperatorAuditStatus` 和 `OperatorAuditLog`，并补充迁移文件。
- `User` 增加 `operatorAuditLogs` 关系，审计日志按 actor、action、target、status 建索引。
- 新增 `OperatorAuditService` 和 `OperatorAuditModule`，支持 `recordSuccess()` / `recordFailure()`。
- 审计记录只保存 actor、action、status、target、reason、requestId、IP/User-Agent hash、错误 code 和截断后的脱敏错误预览。
- metadata 改为 allowlist，只允许 `previousStatus`、`nextStatus`、`attemptsBefore`、`attemptsAfter`、`payloadHash`、`lastErrorCode`、`source` 等安全字段；reason / requestId / errorCode / errorPreview 均做脱敏和截断。
- 审计日志外键使用 `onDelete: SetNull`，actor user 删除后保留审计记录。
- `OutboxOpsController.requeue()` 成功时记录 `OUTBOX_REQUEUE / SUCCEEDED`，失败时记录 `OUTBOX_REQUEUE / FAILED` 后继续抛出原错误。
- `OutboxModule` 导入 `OperatorAuditModule`；审计写入失败只记录脱敏 warning，不影响 requeue 主操作。

验证结果：
- `bun --filter @repo/server test -- operator-audit.service --runInBand`
- `bun --filter @repo/server test -- outbox-ops.controller --runInBand`
- `bun --cwd apps/server eslint src/operator-audit`
- `bun --filter @repo/server build`
- `bun --cwd packages/database test`
- `bun run db:generate`

边界：
- 本轮不新增前端页面、不开放审计日志查询接口、不保存 payload、prompt、chunk、API key、token、cookie 或原始 IP/User-Agent。

### 2026-07-08 - Unified Acceptance Checklist

本轮目标：把本机启动、Docker 全栈、mock/live AI、RAG、worker readiness、Outbox Ops、Swagger 和核心产品页面验收整理成统一入口，避免命令散落在多篇设计文档和博客里。

完成内容：
- 新增 `docs/acceptance-checklist.md`，按验收场景说明应该启动什么、看什么页面、跑什么命令，以及 mock / fake / live / Docker 分别能证明什么。
- 在 `docs/dev-start.md` 和 `AGENTS.md` 增加统一验收入口链接。
- 将阶段收尾的 Docker 全栈验收命令统一为带 `--build`，避免复用旧镜像导致误判。
- 补齐 `/today`、`/plan`、`/stats`、`/error-book`、`/profile` 等核心产品页面验收点。

验证结果：
- `git diff --check`

### 2026-07-08 - Phase 7.14.2 OperatorGuard

本轮目标：把 Outbox Ops、Worker Observability 和 HTTP Worker Readiness 从“普通登录用户可访问的诊断入口”升级为 admin/operator-only 入口，为后续 outbox requeue 操作审计打地基。

完成内容：
- 新增 `OperatorGuard`，基于 `JwtAuthGuard` 写入的 `request.user.role` 判断 `ADMIN` 权限；普通 `STUDENT` 或未附加 user 的请求返回 403。
- `AuthModule` 注册并导出 `OperatorGuard`，供 outbox、worker observability 和 worker readiness 模块复用。
- `OutboxOpsController` guard 顺序升级为 `OutboxOpsEnabledGuard -> JwtAuthGuard -> OperatorGuard`，保留 feature gate 优先隐藏为 404 的边界。
- `WorkerObservabilityController` guard 顺序升级为 `WorkerObservabilityEnabledGuard -> JwtAuthGuard -> OperatorGuard`，禁用时先隐藏为 404，开启后也避免普通登录用户看到系统级 queue counts / worker heartbeat。
- `WorkerReadinessController` guard 顺序升级为 `WorkerReadinessEnabledGuard -> JwtAuthGuard -> OperatorGuard`，HTTP readiness 面向受控诊断；CLI readiness 不受影响，继续作为部署机器检查入口。

验证结果：
- `bun --filter @repo/server test -- operator.guard outbox-ops.controller worker-observability.controller worker-readiness.controller --runInBand`

边界：
- 本轮不新增 Prisma 审计表，不记录 requeue 操作日志；审计落地留给 Phase 7.14.3 / 7.14.4。
- 本轮不改变 Worker Readiness CLI、Docker healthcheck、Chat、RAG、Agent Trace 写入或普通账号级业务 API。

### 2026-07-08 - Phase 7.13 Docker Web / Full Stack Compose

本轮目标：把 Phase 7.12 已跑通的 API / worker / readiness 容器链路扩展到 Web 容器，完成本地 Docker Compose 全栈启动与浏览器验收。

完成内容：
- `docker/Dockerfile.web` 从旧 pnpm 写法迁移到 Bun workspace，复用完整 workspace manifests、`bun install --frozen-lockfile` 和 `bun --filter @repo/web build`。
- `apps/web/next.config.ts` 开启 `output: 'standalone'` 并设置 monorepo tracing root，保证 Docker runner 能复制 Next standalone 产物。
- Web 镜像构建阶段默认 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001`，Compose server 默认允许 `http://localhost:3000,http://127.0.0.1:3000`，避免本机浏览器验收时 localhost / 127.0.0.1 混用导致 CORS 或 cookie 问题。
- Compose dev 栈额外设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 与 `AI_DEV_MODE_SWITCH_ENABLED=true`，让 Next standalone Web 容器即使 `NODE_ENV=production` 也能在 `/agent-trace` 展示本地 Mock / Live 开关；该能力只面向本地开发诊断，生产部署不得开启 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true`。
- 延续 Phase 7.12 的 `.dockerignore`、Prisma Client generate 和 Bun workspace runtime 布局，保证 web / server 镜像都能在 Docker 内真实构建。

验收结果：
- `bun --filter @repo/web lint`
- `bun --filter @repo/web test`
- `bun --filter @repo/web build`
- `docker compose -f docker/docker-compose.dev.yml --profile worker build web`
- `docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web`
- `docker compose -f docker/docker-compose.dev.yml --profile worker ps`：`web` / `server` up，`worker` healthy。
- HTTP smoke：`http://127.0.0.1:3000` 返回 200，`http://127.0.0.1:3001/health` 返回 `status=ok`。
- Playwright 浏览器验收：注册临时账号后跳转 `/chat`，刷新后仍保持聊天页；登录后刷新期间未捕获到新增 console error。未登录时 `/auth/refresh` 返回 401 属于匿名刷新探测，不影响登录注册链路。

边界：
- 本轮是本地 Docker Compose 全栈验收，不引入 Kubernetes、生产域名、TLS、CI 镜像推送或云部署。
- Web 容器默认 API 地址面向本机验收；后续生产部署仍应通过构建参数或环境配置传入真实 API origin。

### 2026-07-08 - Phase 7.12 Docker Worker Healthcheck

本轮目标：把 Phase 7.11 已完成的 worker readiness CLI 接入 Docker Compose worker service，让本地容器编排能直接看到 worker 是 `healthy` 还是 `unhealthy`。

完成内容：
- `docker/docker-compose.dev.yml` 的 `worker` service 新增 healthcheck。
- 容器内 healthcheck 使用 runner 构建产物命令 `bun apps/server/dist/scripts/worker-readiness.js`，不依赖本机 Bun workspace CLI。
- `worker` service 新增 `WORKER_READINESS_CLI_TIMEOUT_MS=${WORKER_READINESS_CLI_TIMEOUT_MS:-5000}`，healthcheck 默认 `interval=30s`、`timeout=10s`、`retries=3`、`start_period=30s`。
- 新增 `docker-compose-readiness.spec.ts`，回归验证 worker service 必须配置 readiness healthcheck 和超时参数。
- 修复 server Dockerfile 的 Bun workspace 镜像布局：deps 阶段复制完整 workspace package manifests，runner 阶段保留根 `node_modules`、`apps/server/node_modules` 和 `packages`，避免内部 `@repo/*` 包或 `.bun` store 链接在容器内解析失败。
- 更新 `docs/dev-start.md` 和 `AGENTS.md`，说明本机 CLI 与容器 healthcheck 的命令区别，以及如何用 `docker compose ... ps` 查看健康状态。

验收结果：
- `bun --filter @repo/server test -- docker-compose-readiness`
- `bun --filter @repo/server test -- worker-readiness docker-compose-readiness`
- `bun --cwd apps/server eslint src/worker-readiness`
- `bun --filter @repo/server build`
- `docker compose -f docker/docker-compose.dev.yml --profile worker config`
- `git diff --check`

边界：
- 本轮不改 Chat / RAG prompt / Tutor 输出 / live model 调用链路，因此不需要真实模型 smoke。
- 本轮只接入本地 Docker Compose worker healthcheck，不引入 Kubernetes readiness probe、Prometheus 指标或生产部署平台配置。
- Docker 容器内使用 `bun apps/server/dist/scripts/worker-readiness.js`；本机开发仍使用 `bun --filter @repo/server readiness:worker`。

### 2026-07-08 - Phase 7.11 Worker Readiness

本轮目标：在已有 `/health` 和 `/worker-observability/summary` 之外，补一个更适合机器和部署系统使用的 worker readiness 判断，回答“当前后台 worker 链路能不能接流量 / 能不能通过部署前检查”。

完成内容：
- 新增 `@repo/types/api/worker-readiness` contract，定义 `ready / degraded / not_ready`、各检查项状态、queue counts、worker heartbeat 摘要、outbox backlog 摘要和 issues。
- 新增 `WORKER_READINESS_ENABLED`，默认非 production 开启、production 关闭；HTTP 入口 `GET /worker-readiness` 使用 feature gate + `JwtAuthGuard`，关闭时在认证前隐藏为 404。
- 新增 `WorkerReadinessService`，组合 Redis / BullMQ queue counts、worker heartbeat 和 outbox summary，区分 queue 模式硬失败与 inline 模式 warning。
- 新增 `WorkerReadinessModule`，通过显式 factory 注入 BullMQ queue、`OutboxMetricsService` 和 `ConfigService`，避免 Nest runtime DI 把泛型配置参数识别成 `Object`。
- 新增 CLI：`bun --filter @repo/server readiness:worker`。CLI 使用最小只读 Nest module，不导入 `AppModule`，不启动 HTTP API、worker processor、heartbeat 或 outbox dispatcher。
- CLI 增加有界 timeout 和受控错误输出：ready 退出码 `0`，degraded / not ready 退出码 `1`，脚本异常、配置错误或超时退出码 `2`；输出不打印原始依赖错误、连接串、payload、prompt、chunk、API key、token 或 cookie。
- 明确三类健康入口分工：`/health` 是 API liveness，`/worker-observability/summary` 是开发者调试观测面，`/worker-readiness` / CLI 是机器友好的部署前 readiness。

验收结果：
- `bun --filter @repo/server test -- env`
- `bun --cwd packages/types typecheck`
- `bun packages/types/tests/worker-readiness.test.mts`
- `bun --filter @repo/server test -- worker-readiness`
- `bun --cwd apps/server eslint src/worker-readiness scripts/worker-readiness.ts`
- `bun --filter @repo/server build`
- `git diff --check`
- 手动 CLI smoke：Redis 未启动时 `bun --filter @repo/server readiness:worker` 返回退出码 `2`，只输出受控失败文案，不打印 raw `AggregateError`。

边界：
- 本轮不新增前端页面，不改变 Chat / RAG prompt / Tutor 输出 / live model 调用链路，因此不需要真实模型 smoke。
- Readiness 不替代 `/worker-observability/summary` 的详细排障信息，也不替代 `/health` 的 API liveness。
- CLI 只读检查，不消费 BullMQ、不 dispatch outbox、不 requeue、不修改业务数据。
- Readiness 输出只能包含安全状态摘要，不返回 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、access token、refresh token、cookie 或连接串。

### 2026-07-07 - Phase 7.10 Outbox Ops

本轮目标：给 Phase 7.9 durable outbox 补上安全的后端操作闭环，让开发者能在不暴露 payload 的前提下查看失败事件，并在修复根因后手动 requeue。

完成内容：
- 新增 `@repo/types/api/outbox` contract，统一列表、详情、requeue request / response 的 Zod schema。
- 新增 `OUTBOX_OPS_ENABLED`，默认非 production 开启、production 关闭；关闭时通过 feature gate 在认证前返回 404，避免暴露诊断面。
- 新增 `OutboxOpsService` 与 `OutboxOpsController`，支持脱敏列表、脱敏详情和 `FAILED / DEAD` requeue。
- 列表分页按 `updatedAt desc, id desc` 使用复合 cursor，修复只按 id 翻页可能漏数据的问题。
- `lastErrorPreview` 复用扩展后的 `sanitizeJobError()`，覆盖 Bearer、access / refresh token、cookie、`sk-...`、Qwen / DashScope / OpenAI 等常见 key 形态。
- requeue 使用条件 `updateMany` 做 compare-and-swap，只把 `FAILED / DEAD` 重置为 `PENDING`，清理锁信息和 processedAt，重置 attempts 和 nextRunAt，不立即执行 handler。
- 新增 e2e 覆盖认证、脱敏响应和 requeue 状态流转。

验收结果：
- `bun --cwd packages/types typecheck`
- `bun --filter @repo/server test -- outbox-ops env`
- `bun --filter @repo/server test -- outbox-ops job-error-sanitizer`
- `bun --cwd apps/server eslint src/outbox src/jobs/job-error-sanitizer.ts src/jobs/job-error-sanitizer.spec.ts`
- `bun --filter @repo/server build`
- `bun --cwd apps/server jest --config ./test/jest-e2e.json --runInBand --testTimeout=30000 --forceExit --verbose outbox-ops`

边界：
- 本轮不新增前端页面，不改变 Chat / RAG prompt / live model 调用链路，因此不需要真实模型 smoke。
- Outbox Ops 不返回 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。
- 不支持删除、强制成功、跳过、payload 编辑或直接 dispatch；生产环境仍需要后续 admin/operator 权限模型和操作审计后再考虑开放。

### 2026-07-07 - Phase 7.9 收尾验收与 Review 修复

本轮目标：对 Phase 7.9 durable outbox 收尾做代码 review 后修正可验证的问题，并把本地验收命令跑到可复现状态。

完成内容：
- 修复 knowledge document processing 相关 touched files 的 lint / 测试类型问题。
- `DocumentProcessingJobService` 对 best-effort outbox enqueue 失败增加脱敏 warning 日志，避免后台事件写入失败被静默吞掉；日志只包含 documentId、backgroundJobId 和脱敏后的错误摘要。
- `OutboxDispatcherService` 修正统计口径：只有 `markSucceeded()` / `markFailedOrRetry()` 真正完成数据库状态流转时，才计入 `succeeded` / `failed`，避免 worker 锁丢失时出现“指标看起来成功/失败，但数据库没变”的误报。
- `bun --filter @repo/server lint` 会执行 `eslint --fix`，本轮清理了完整 server lint 暴露的测试类型和格式问题。
- 补齐前端 `worker-observability-api` 测试 fixture 中 Phase 7.9 新增的 `outbox` 和 outbox signals 字段。
- 稳定 `apps/server` 的 `test:e2e` 脚本：改为 `--runInBand --testTimeout=30000`，避免并发启动多个 Nest e2e app 时 beforeAll 偶发超时。

验收结果：
- `bun --filter @repo/server test`
- `bun --filter @repo/server lint`
- `bun --filter @repo/server build`
- `bun --filter @repo/server test:e2e`
- `bun --filter @repo/web lint`
- `bun --filter @repo/web test`
- `bun --filter @repo/web build`
- `bun --cwd packages/types typecheck`
- `bun --cwd packages/database test`
- `bun --cwd packages/fsrs test`

边界：
- 本轮没有新增业务功能、HTTP API、前端页面或模型调用链路。
- 修复集中在 review 发现的问题、测试 fixture、lint 可复现性和 e2e 命令稳定性。
- `test:e2e` 初次默认并发运行失败，原因是 e2e hook 默认 5 秒超时；脚本改成串行和 30 秒超时后，标准命令通过。

### 2026-07-07 - Phase 7.9.4 Outbox Summary / Metrics

本轮目标：给已经能落库、消费和自动 tick 的 outbox 补上只读观测面，让开发者能看到 outbox 是否积压、是否出现 dead-letter，以及最近失败错误码。

完成内容：
- `@repo/types` 的 `workerObservabilitySummaryResponseSchema` 新增 `outbox` summary 和 `hasOutboxBacklog` / `hasDeadOutboxEvents` signals。
- 新增 `OutboxMetricsService`，统计 `PENDING / PROCESSING / SUCCEEDED / FAILED / DEAD` 数量、最老 pending 年龄和最近错误摘要。
- `OutboxMetricsService` 只返回安全字段：`id`、`type`、`status`、`lastErrorCode`、attempts、maxAttempts、updatedAt；不返回 payload、完整 `lastError`、`aggregateId` 或用户内容。
- `WorkerObservabilityService` 接入 outbox summary；`DEAD` outbox event 会让 status 进入 `degraded`，pending / processing backlog 作为独立信号展示。
- `WorkerObservabilityModule` import `OutboxModule` 并通过 DI 注入 `OutboxMetricsService`。
- 新增设计文档 `docs/superpowers/specs/phase-7-9-outbox-summary-metrics-design.md` 和执行计划 `docs/superpowers/plans/phase-7-9-outbox-summary-metrics.md`。
- 新增完整面试学习博客 `docs/blogs/durable-outbox-worker-observability.md`，复盘 BullMQ、BackgroundJob、EventBus、Durable Outbox、Dispatcher Runner 和 Summary/Metrics 的分工。

验证：
- `bun --filter @repo/server test -- outbox-metrics`
- `bun --filter @repo/server test -- outbox`
- `bun --filter @repo/server test -- worker-observability`
- `bun --cwd packages/types typecheck`
- `bun --cwd apps/server eslint src/outbox src/worker-observability`
- `bun --filter @repo/server build`

边界：
- Phase 7.9.4 不新增独立 outbox HTTP API、不新增前端页面、不新增 admin action、不接 Prometheus / Grafana。
- Outbox summary 是系统级只读观测信号，仍通过现有 `/worker-observability/summary`、`JwtAuthGuard` 和 `WORKER_OBSERVABILITY_ENABLED` 边界暴露。
- 本阶段不改变 Chat、RAG prompt、模型调用、前端页面或 `/api/chat` live / mock 行为，因此不需要 live 模型 smoke。

### 2026-07-07 - Phase 7.9.3 Outbox Dispatcher Runner

本轮目标：让 Phase 7.9.2 的 `OutboxDispatcherService.dispatchBatch()` 从“可手动调用”升级为 worker 进程中的受控自动消费入口，同时保持生产默认关闭和清晰的 worker/api 边界。

完成内容：
- 新增 outbox dispatcher env controls：`OUTBOX_DISPATCHER_ENABLED`、`OUTBOX_DISPATCHER_INTERVAL_MS`、`OUTBOX_DISPATCHER_BATCH_SIZE`、`OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS`。
- 新增 `OutboxDispatcherRunnerService`，只在 `SERVER_ROLE=worker | both` 且开关开启时按固定间隔调用 dispatcher。
- runner 启动时触发一次非阻塞 tick，随后按 interval tick；上一轮还在运行时跳过下一轮，避免单进程内重入。
- tick 失败只记录脱敏 warning，不打断 worker 进程；`onModuleDestroy()` 会清理 timer。
- `OutboxModule` 通过 factory 注册 runner，保持 ConfigService 注入和 Nest DI 编译可测。
- 新增设计文档 `docs/superpowers/specs/phase-7-9-outbox-dispatcher-runner-design.md` 和执行计划 `docs/superpowers/plans/phase-7-9-outbox-dispatcher-runner.md`。

验证：
- `bun --filter @repo/server test -- env`
- `bun --filter @repo/server test -- outbox-dispatcher-runner`
- `bun --filter @repo/server test -- outbox`
- `bun --cwd apps/server eslint src/outbox`
- `bun --filter @repo/server build`

边界：
- Phase 7.9.3 不新增 HTTP API、不新增前端页面、不接 Prometheus / Grafana、不新增 BullMQ repeatable job。
- runner 不读取 outbox payload、不动态执行 handler、不绕过 Phase 7.9.2 的显式 handler registry。
- production 默认关闭，避免部署后未经确认消费历史 outbox 事件。
- 本阶段不改变 Chat、RAG prompt、模型调用、前端页面或 `/api/chat` live / mock 行为，因此不需要 live 模型 smoke。

### 2026-07-07 - Phase 7.9.2 Outbox Dispatcher

本轮目标：让 Phase 7.9.1 落库的 `OutboxEvent` 不只是“保存下来”，而是进入一个可测试的消费闭环：claim、分发 handler、成功标记、失败 retry / dead-letter。

完成内容：

- 新增 `outbox.handlers.ts`，用显式 registry 注册 `knowledge.document.processing.requested` handler，避免根据 payload 动态执行任意函数。
- 新增 `OutboxDispatcherService`，批量 claim outbox events，逐条调用 handler，成功后 `markSucceeded()`，失败后 `markFailedOrRetry()`；单条失败不阻断同批次后续事件。
- `knowledge.document.processing.requested` handler 第一版只做观测型 payload 校验，不重投 BullMQ、不改 `Document`、不改 `BackgroundJob`、不写用户内容。
- `DocumentProcessingJobService` 在 BullMQ enqueue 成功后 best-effort 写入 requested outbox event；outbox 写入失败不影响原有 queue 主链路或 in-process EventBus 发布。
- 新增设计文档 `docs/superpowers/specs/phase-7-9-outbox-dispatcher-design.md` 和执行计划 `docs/superpowers/plans/phase-7-9-outbox-dispatcher.md`。

验证：

- `bun --filter @repo/server test -- outbox.handlers`
- `bun --filter @repo/server test -- outbox.dispatcher outbox.handlers`
- `bun --filter @repo/server test -- document-processing-job`
- `bun --cwd apps/server eslint src/outbox`
- `bun --filter @repo/server build`

边界：

- Phase 7.9.2 不新增自动 scheduler loop、不公开 HTTP API、不新增前端页面、不接 Prometheus / Grafana。
- 本阶段不替换 BullMQ、`BackgroundJob` 或 in-process `EventBus`，只把知识库 requested 事件作为低风险真实接入点写入 outbox。
- 本阶段不改变 Chat、RAG prompt、模型调用、前端页面或 `/api/chat` live / mock 行为，因此不需要 live 模型 smoke。
- requested outbox payload 只能包含 `userId`、`documentId`、`backgroundJobId`、`force`，不保存文件内容、chunk、prompt、API key、access token、cookie 或模型回答。

### 2026-07-07 - Phase 7.9.1 Durable Outbox

本轮目标：补上跨进程可靠事件的持久化地基，避免后续继续依赖纯 in-process EventBus 时产生“看起来发布了，但进程重启就丢”的假可靠性。

完成内容：

- 新增 `OutboxEventStatus` 与 `OutboxEvent` Prisma 模型，保存事件类型、聚合对象、幂等键、脱敏 payload、payload hash、attempts、锁定信息、下次运行时间和 dead-letter 状态。
- 新增数据库 migration `20260707000100_add_outbox_event`，包含 `status + nextRunAt + createdAt`、`lockedBy + lockedAt`、`aggregateType + aggregateId + createdAt` 和 `type + status + createdAt` 查询索引。
- 新增 `OutboxService` 与 `OutboxModule`，提供 `enqueue()`、`claimPending()`、`markSucceeded()` 和 `markFailedOrRetry()`。
- `claimPending()` 第一版使用 `findMany + conditional updateMany`，claim 时重新校验 due pending 或过期 processing 状态，避免并发 worker 返回未抢到的事件。
- 失败事件按 attempts 指数退避重试，达到 `maxAttempts` 后进入 `DEAD`；错误信息复用 `sanitizeJobError()`，不写入 token、cookie 或 API key。

验证：

- `bun --cwd packages/database prisma:generate`
- `bun --cwd packages/database test`
- `bun --filter @repo/server test -- outbox`
- `bun --filter @repo/server build`
- 子代理规格审核：APPROVED。
- 子代理代码质量审核：APPROVED；补充了错误脱敏断言和并发 claim loser 测试。

边界：

- Phase 7.9.1 只落地 durable outbox 地基，不替换 BullMQ、`BackgroundJob` 或 in-process `EventBus`。
- 本阶段不迁移现有事件发布点，不新增 outbox dispatcher，不暴露 Prometheus / Grafana 指标。
- 本阶段不改变 Chat、RAG prompt、模型调用、前端页面或 `/api/chat` live / mock 行为，因此不需要 live 模型 smoke。
- `OutboxEvent.payload` 和 `lastError` 只能保存安全元数据或脱敏错误摘要，不得保存 API key、access token、refresh token、cookie、完整 prompt、完整 RAG chunk、完整模型回答或真实用户私有正文。

### 2026-07-06 - Phase 7.8.4 RAG Eval Hardening

本轮目标：对 Phase 7.8.3 的 RAG Eval Smoke 做小收尾，避免未来评估 case 漂移时误报 PASS，并补一篇能用于面试复盘的学习博客。

完成内容：

- 新增 `selectRagEvalSmokeCases()`，固定 smoke 必需 case id，并在缺失时提前抛错，避免空跑或少跑后误报通过。
- 新增 `shouldKeepRagEvalSmokeData()`，支持 `RAG_EVAL_SMOKE_KEEP_DATA=true | 1 | yes`。
- `smoke:rag-eval` 默认仍 best-effort 删除临时文档；开启 keep-data 后保留合成 smoke 文档，方便在 `/knowledge` 页面复查。
- 新增面试博客 `docs/blogs/rag-eval-and-hybrid-retrieval.md`，讲清 fake embedding、RAG Eval baseline、Hybrid Retrieval、真实 API smoke 和 Chat live 验收的分层边界。

验证：

- `bun --filter @repo/server test -- rag-eval-smoke-config`
- `bun --filter @repo/server test -- rag-eval-report rag-eval-runner`
- `bun --filter @repo/server build`
- `git diff --check`
- `bun --filter @repo/server smoke:rag-eval`

边界：

- keep-data 只用于本地复查，不进入默认 CI。
- smoke 仍不调用 `/api/chat`，不证明最终模型回答质量。
- 脚本不打印 API key、access token、cookie、embedding 向量或完整 hit content。

### 2026-07-06 - Phase 7.8.3 RAG Eval Smoke

本轮目标：在 RAG Eval baseline 和 Hybrid Retrieval 之后，补上一条本地 API 级真实链路 smoke，验证上传、处理、检索和 eval 指标能在运行中的服务上串起来。

完成内容：

- 新增 `formatRagEvalSmokeReport()` 纯函数，把 `RagEvalSummary` 和每个 case 的 hit 摘要格式化为可读终端报告。
- 新增 `bun --filter @repo/server smoke:rag-eval`，脚本会注册临时账号、上传合成 TXT、触发处理、轮询 `DONE`、调用 `/knowledge/search`，再把真实 hits 喂给 `runRagEval()`。
- smoke 默认只覆盖精确术语、语义改写和跨语言薄弱点 3 个正向 case；SafetyGuard 和无关查询边界继续由固定单测/后续专项 smoke 覆盖，避免把低分候选误判为链路失败。
- 脚本只输出状态、指标、命中数、top score 和文档名，不打印 API key、access token、cookie、embedding 向量或完整 hit content。

验证：

- `bun --filter @repo/server test -- rag-eval-report`
- `bun --filter @repo/server test -- rag-eval-runner`
- `bun --filter @repo/server build`
- `git diff --check`
- `bun --filter @repo/server smoke:rag-eval`，结果 `Status: PASS`、`Passed: 3/3`、`Recall@K: 100.0%`、`Top1 Accuracy: 100.0%`

边界：

- 这是 RAG 检索链路 smoke，不是 Chat live 验收；本阶段不改 `/api/chat`、RAG prompt 或最终模型输出。
- smoke 创建的测试资料是合成内容，脚本会 best-effort 删除临时文档；临时用户暂不清理，因为当前没有用户删除 API。

### 2026-07-06 - Phase 7.8.2 Hybrid Retrieval

本轮目标：在 Phase 7.8.1 RAG Eval 基线之后，把 `/knowledge/search` 从纯向量检索升级为第一版 Hybrid Retrieval，补强精确术语、专有名词和英文短语场景。

完成内容：

- 新增 `mergeHybridSearchRows()` 纯函数，合并 vector candidates 与 keyword candidates，按 `chunkId` 去重并输出 `0..1` final score。
- `/knowledge/search` 现在执行两路候选召回：pgvector cosine vector SQL + PostgreSQL `websearch_to_tsquery('simple', query)` full-text keyword SQL。
- 响应 contract 保持不变，`metadata` 中额外带轻量 `retrieval.mode/vectorScore/keywordScore`，用于调试和后续 eval。
- 第一版不新增 GIN 索引、不引入 Elasticsearch / Meilisearch、不接 reranker，不改 Chat RAG prompt。

验证：

- `bun --filter @repo/server test -- hybrid-search`
- `bun --filter @repo/server test -- knowledge-search.service`
- `bun --filter @repo/server test -- rag-eval-runner`
- `bun --filter @repo/server build`
- `git diff --check`

边界：

- Hybrid Retrieval 改的是知识库检索排序，不改变最终 Chat 模型调用和引用格式，因此本轮不要求 live Chat smoke。
- PostgreSQL inline full-text 第一版主要补强英文术语、专有名词和短语；中文分词与大规模性能优化留给后续 GIN index / reranker 阶段。

### 2026-07-06 - Phase 7.8.1 RAG Eval Baseline

本轮目标：在改动 Hybrid Retrieval 之前，先建立稳定的 RAG 检索质量评估基线。

完成内容：

- 新增固定 RAG eval cases，覆盖精确术语、语义改写、跨语言、无关查询和 SafetyGuard 边界。
- 新增纯函数 eval runner，输入检索 hits，输出 `recall@k`、`top1Accuracy`、`safetyPassRate` 和 `noHitPassRate`。
- 第一版不改 `/knowledge/search` 线上行为，不改 Chat prompt，不调用真实模型。

验证：

- `bun --filter @repo/server test -- rag-eval-runner`
- `bun --filter @repo/server build`
- `git diff --check`

边界：

- fake eval 只证明工程回归，不证明真实语义质量。
- Qwen embedding smoke 仍用于真实语义检索验收。

### 2026-07-06 - Qwen Embedding Provider

本轮目标：让 RAG 真实 embedding 验收不再只能依赖 OpenAI key，支持使用阿里云百炼 / DashScope 的 OpenAI compatible embedding 服务。

完成内容：

- `RAG_EMBEDDING_PROVIDER` 新增 `qwen`。
- `EmbeddingService` 支持 `RAG_EMBEDDING_BASE_URL`、`Qwen_API_KEY`、`QWEN_API_KEY`、`DASHSCOPE_API_KEY`。
- 推荐本地真实 RAG 验收使用 `text-embedding-v4`、业务空间 `/compatible-mode/v1` base URL、`RAG_EMBEDDING_DIMENSIONS=1536` 和 `RAG_EMBEDDING_BATCH_SIZE=10`。

边界：

- 不提交真实 key，不在日志中打印 key。
- 仍保持 pgvector `vector(1536)` 不变，避免本阶段引入向量维度 migration。
- 旧 fake embedding chunk 不能用于真实语义召回判断；切换 qwen 后需要重新处理资料。

验证：

- `bun --filter @repo/server test -- embedding.service env`
- `bun --filter @repo/server build`
- `QWEN_EMBEDDING_SMOKE_OK dimension=1536 finite=true`，只确认返回维度和数值合法，不打印 key 或向量内容。

### 2026-07-05 - Phase 7.7 Worker Observability

本轮目标：补上 Phase 7.6 拆出 worker 进程后的观测缺口，让开发和面试展示时能回答“任务是否在排队、worker 是否在线、最近是否失败”这三个问题，而不是只看 BackgroundJob 结果表。

完成内容：

- 新增 `@repo/types/api/worker-observability` contract，统一描述 server role、knowledge processing mode、BullMQ queue counts、worker heartbeat、BackgroundJob summary 和综合信号。
- 新增 `WorkerHeartbeatService`：仅在 `SERVER_ROLE=worker | both` 写 Redis 短 TTL heartbeat，复用 BullMQ queue client，不引入第二套 Redis 客户端。
- 新增 `WorkerObservabilityService`：聚合 `knowledge-document-processing` queue counts、worker heartbeat 和账号级 `BackgroundJobsService.getSummary()`。
- 新增 `GET /worker-observability/summary`，经过 `JwtAuthGuard`，并受 `WORKER_OBSERVABILITY_ENABLED` 控制；默认非 production 开启、production 关闭，Swagger tag 为 `Worker Observability`。
- `/knowledge` 页面新增紧凑健康状态条，展示 worker 在线状态、等待/处理中/失败数量，以及 `healthy / degraded / attention / idle` 对应提示；知识库为空且没有处理轮询时不显示该状态条，避免误报“暂不可用”。
- 新增 `apps/web/src/lib/worker-observability-api.ts`、view helper、TanStack Query hook 和相关测试。
- 新增设计与执行文档：`docs/superpowers/specs/phase-7-worker-observability-design.md`、`docs/superpowers/plans/phase-7-worker-observability.md`。
- 新增面试学习博客：`docs/blogs/phase-7-worker-observability.md`。

边界：

- BackgroundJob 是账号级任务历史和状态，不等于 worker 在线；worker heartbeat 是进程最近活跃信号，不等于任务成功；queue counts 是系统级队列积压，不按用户隔离。三者组合展示，不能混成一个事实源。
- Worker Observability 返回系统级 queue counts 和 worker heartbeat，因此 production 默认关闭；若生产临时开启，必须放在受控内网或诊断窗口里，不应作为面向普通用户的长期公开能力。
- worker-only 仍不提供 HTTP `/health`；它不监听端口，健康判断继续依赖进程存活、日志、BullMQ、Redis heartbeat 和 BackgroundJob 状态。
- heartbeat 只保存不含 hostname / pid 的 opaque worker id、role、队列名、startedAt 和 lastSeenAt，不保存文件内容、prompt、RAG chunk、API key、token 或用户输入。
- 本阶段不改 Chat prompt、RAG prompt、模型路由或真实模型调用链路，因此不需要 live 模型 smoke。

验证：以下命令已在 Phase 7.7 收尾时通过。

- `bun --cwd packages/types typecheck`
- `bun packages/types/tests/worker-observability.test.mts`
- `bun --filter @repo/server test -- worker-observability`
- `bun --filter @repo/web test -- worker-observability knowledge`
- `bun --filter @repo/server build`
- `bun --filter @repo/web build`
- `docker compose -f docker/docker-compose.dev.yml --profile worker config`
- `git diff --check`

### 2026-07-02 - Phase 7.6 Worker Split

本轮目标：把 Phase 7.1 预留的 `SERVER_ROLE=api | worker | both` 从“是否注册 worker processor”推进到真正的进程启动边界，让 `worker` 不再占用 HTTP 端口。

完成内容：

- 新增 `apps/server/src/bootstrap/server-bootstrap.ts`，把 server bootstrap 从 `main.ts` 拆成可测试 helper。
- `SERVER_ROLE=api`：创建 Nest HTTP app，提供 REST API、`/health` 和 Swagger，但不注册 BullMQ worker processor。
- `SERVER_ROLE=worker`：使用 `NestFactory.createApplicationContext(AppModule)`，只初始化模块和 BullMQ processor，不调用 `listen()`，不占用 HTTP 端口。
- `SERVER_ROLE=both`：保留本地开发一体化模式，HTTP API 和 worker processor 同进程。
- `main.ts` 收敛为 `void bootstrapServer()`，减少启动入口里的不可测逻辑。
- Docker Compose 增加 `worker` profile：默认开发仍是 `both + inline`，拆分验证时可用 server `api + queue` 搭配 worker service。
- 新增执行计划：`docs/superpowers/plans/phase-7-worker-split.md`。从本阶段开始，新建 docs / blogs / plans / specs 文件名优先使用语义化名称，不再加日期前缀。

边界：

- worker-only 第一版不提供 HTTP `/health`；它不监听端口，健康判断先依赖进程存活、日志、BullMQ 和 BackgroundJob 状态。
- 本阶段不改文档处理业务语义、不改 BullMQ 重试策略、不引入 dead letter queue / durable outbox。
- 本阶段不改 Chat prompt、RAG prompt、模型路由或真实模型调用链路，因此不需要 live 模型 smoke。

### 2026-07-02 - Phase 7.5 OpenAPI Request Bodies

本轮目标：把 Phase 7.4 的 Swagger 从“接口地图”推进到“可读、可调试的中文接口文档”，让本地联调和面试讲解时能直接看到核心写接口应该怎么传参。

完成内容：

- 为 `POST /auth/register`、`POST /auth/login` 补充中文说明和 JSON request body 示例。
- 为 `POST /knowledge/documents` 和 `PUT /knowledge/documents/:id/file` 补充 `multipart/form-data` 与 `file` 字段说明。
- 为 `POST /knowledge/documents/:id/process`、`POST /knowledge/search`、`POST /review-tasks/:taskId/rating`、`POST /agent-traces` 补充安全 JSON 示例。
- 高价值接口的 `summary`、`description`、成功响应说明改为中文描述，同时保留 `response envelope`、路径、字段名和 header 等英文契约标识。
- Swagger 顶部说明已中文化；面向用户的接口标题不再使用“脱敏”这类工程黑话，改用“隐藏敏感内容”“Agent 调试记录”等更容易理解的说法。
- 增加 OpenAPI JSON 回归测试，要求核心调试接口必须有 request body，并继续校验文档不泄露 API key、cookie、token、完整 prompt、完整回答、完整 RAG chunk 或原始 payload。
- 新增设计与执行文档：`docs/superpowers/specs/2026-07-02-phase-7-5-openapi-request-bodies-design.md`、`docs/superpowers/plans/2026-07-02-phase-7-5-openapi-request-bodies.md`。

边界：

- Phase 7.5 只改 Swagger / OpenAPI 元数据和文档，不改变接口运行时行为。
- request body 示例只用于 Swagger UI 展示，不是新的事实源；字段约束仍以 `@repo/types` Zod schema 和服务端解析为准。
- Agent Trace 示例只放已经隐藏敏感内容的摘要、token 估算和成本估算，不放完整 prompt、完整回答或完整 RAG chunk。
- 本阶段不改 Chat prompt、RAG prompt、模型路由或流式输出，因此不需要 live 模型 smoke。

### 2026-07-02 - Phase 7.4 Swagger / OpenAPI Docs

本轮目标：给越来越多的 NestJS REST API 补一个可发现、可调试、适合面试展示的 Swagger / OpenAPI 入口，同时避免让 Swagger 变成第二套 contract 事实来源。

完成内容：

- 新增 Swagger / OpenAPI debug docs，入口为 `/api-docs` 和 `/api-docs-json`。
- 文档默认在非 production 开启；production 默认关闭。
- `SWAGGER_ENABLED=true` 只适合受控环境、内网或临时诊断，不作为公开调试入口。
- Swagger 接入不放宽 `JwtAuthGuard`，受保护接口仍按原有认证和 userId 隔离规则执行。
- 明确 `@repo/types` Zod schemas remain source of truth；Swagger 是调试/展示层，不反向驱动前端 contract。
- 文档补充全局 response envelope：成功响应 `{ success, data, requestId }`，错误响应 `{ success, error, requestId }`。
- 新增面试学习博客：`docs/blogs/phase-7-openapi-docs.md`。

边界：

- Phase 7.4 不改 Chat prompt、RAG prompt、模型路由或流式输出，因此不需要 live 模型 smoke。
- OpenAPI 文档不应包含 API key、cookie、token、完整 prompt、完整回答、完整 RAG chunk、后台任务原始 payload 或真实用户内容示例。
- Swagger 只帮助接口发现和调试，不替代 `@repo/types`、服务端测试或前端调用层校验。

### 2026-07-02 - Phase 7.3 Event Observability

本轮目标：让后台任务不只是“扔进队列”，而是能被前端和开发者安全地看见。

完成内容：

- `InProcessEventBus.publish()` 改为返回 `{ delivered, failed }`。
- 单个 EventBus handler 抛错不会阻断后续 handler。
- EventBus handler 失败会记录脱敏 warning，只包含事件类型与 delivered / failed 计数，不打印完整 payload。
- 新增 `GET /background-jobs/summary`，经过 `JwtAuthGuard`，按当前 `userId` 隔离。
- summary 中 `activeCount` 使用账号级真实 active count，避免旧的 active job 被最新 50 条窗口漏掉。
- summary 中 `failedCount` / `staleSkippedCount` / `succeededCount` 仍表达最近 50 条任务窗口内的摘要。
- `/knowledge` 新增后台任务摘要提示。
- `/knowledge` 在处理中文档、本地刚触发处理或 summary 仍有 active job 时短轮询；静态 `PENDING` 或健康 recent jobs 不无限轮询。
- 更新 `AGENTS.md`、`docs/roadmap.md`、`docs/data-flow.md`、`docs/ai-behavior-acceptance.md`。
- 新增面试复盘博客：`docs/blogs/phase-7-event-observability.md`。

审核中发现并修复：

- 页面最初把 summary 固定传为 `undefined`，导致 active job 不能靠 summary 自身持续轮询。
- `activeCount` 最初只基于最近 50 条计算，语义容易误导 UI，改为真实账号级 count。
- EventBus 最初吞掉 handler 异常但没有可观测 warning，补充了脱敏日志。
- 设计文档末尾多余空行导致 `git diff --check main...HEAD` 失败，已清理。

验证：以下命令已在 Phase 7.3 收尾时通过。

- `bun --cwd packages/types typecheck`
- `bun packages/types/tests/background-job.test.mts`
- `bun --filter @repo/server test -- event-bus background-jobs`
- `bun --filter @repo/web test -- background-job knowledge-view`
- `bun --filter @repo/server build`
- `bun --filter @repo/web build`
- `git diff --check`

边界：

- Phase 7.3 不改 Chat prompt、RAG citation、Tutor 输出或真实模型调用链路，因此不需要 live 模型 smoke。
- EventBus 当前仍是 in-process 非持久事件总线，不是 durable outbox。

### 2026-06-30 - Phase 7.2 RAG SafetyGuard

本轮目标：把用户上传资料视为低信任证据，避免 RAG 检索片段中的恶意指令影响模型。

完成内容：

- `@repo/rag` 增加 deterministic chunk safety classifier。
- 文档处理时把 `metadata.safety` 写入每个 chunk。
- `/knowledge/search` 返回 safety metadata。
- Chat RAG prompt 组装前过滤 high-risk chunk。
- medium-risk chunk 只作为可疑原文引用，不作为可执行指令。
- `KnowledgeVerifierAgent` 对高风险或 `safeForPrompt=false` 的资料输出保守 guidance。
- `/knowledge` 检索结果展示安全标记。
- 补充 `docs/ai-behavior-acceptance.md` 和面试复盘博客 `docs/blogs/phase-7-rag-safety-guard.md`。

验收要点：

- mock / e2e 覆盖固定 prompt-injection 样本。
- live/browser smoke 记录在 `docs/ai-behavior-acceptance.md`。
- Trace 和 BackgroundJob 仍只保存脱敏元数据，不保存完整恶意 chunk、prompt、API key、token 或 cookie。

### 2026-06-30 - Phase 7.0 / 7.1 Background Jobs

本轮目标：把知识库文档处理从同步接口升级为可切换的后台任务链路。

完成内容：

- 新增 `BackgroundJob` 数据模型和 `@repo/types/api/background-job` contract。
- 新增 `GET /background-jobs` 与 `GET /background-jobs/:id`，均经过 `JwtAuthGuard`，按当前账号隔离。
- 拆分 `DocumentProcessingService`，inline 和 worker 共用同一套解析、分块、embedding、snapshot 校验和 chunk 写入逻辑。
- `KNOWLEDGE_PROCESSING_MODE=inline | queue` 控制处理模式。
- queue 模式下创建 `BackgroundJob` 并投递 BullMQ。
- `SERVER_ROLE=api | worker | both` 控制 worker processor 注册。
- worker 处理时持续校验 `status + storageKey + contentHash` 快照，避免旧处理流污染新资料。
- `/knowledge` 展示文档后台处理状态，并只在活跃处理时轮询。

边界：

- Redis 是 queue 链路必需依赖。
- BackgroundJob 只保存脱敏任务元数据，不保存完整文件、prompt、RAG chunk、API key 或 token。
- queue smoke 证明后台任务链路可靠，不证明 Chat live 输出质量。

### 2026-06-29 - Phase 6.8 Knowledge Agents

本轮目标：补齐资料管理方向的多 Agent 能力，让知识库不只会检索，也能给资料组织建议。

完成内容：

- 新增 `KnowledgeDedupAgent` 与 `KnowledgeOrganizerAgent` deterministic policy。
- 新增 `@repo/types/api/knowledge-agent` contract。
- 新增 `GET /knowledge-agent/suggestions`，经过 `JwtAuthGuard`，按当前 `userId` 读取资料元数据和少量 chunk 摘要。
- `/knowledge` 展示重复资料、疑似新版、互补资料、集合和标签建议。
- 建议链路只读，不自动合并、删除、替换、重命名或分类资料。
- fixed deterministic eval set 覆盖 KnowledgeDedup / KnowledgeOrganizer。

边界：

- 不调用 live 模型。
- 不写 Document / Chunk / 分类表。
- 不进入 Dexie `mutationQueue`。
- 建议失败不影响上传、处理、替换、删除和检索。

### 2026-06-28 - Phase 6.6 / 6.7 Memory 与 Trace

Phase 6.6 完成：

- 新增 `UserMemoryCandidate` / `UserMemory` 数据模型。
- 新增 `/memory-agent` 与 `/user-memories` API。
- `/profile` 支持生成长期记忆候选、确认、忽略、停用、恢复和删除。
- MemoryAgent 是确定性 policy，不调用真实模型。
- `UserMemory` 当前不自动注入 `/api/chat`。

Phase 6.7 完成：

- 新增 Agent Trace contract、Prisma 模型和 `/agent-traces` API。
- `/api/chat` 在有 access token 时 best-effort 写入脱敏 trace。
- `/agent-trace` 展示路由、步骤、降级、token 和估算成本。
- fixed deterministic eval set 覆盖当前确定性 Agent policy。
- Trace 不保存完整 prompt、完整回答、完整 RAG chunk 或 API key。

### 2026-06-22 - Phase 6.5 ReviewAgent / PlannerAgent

完成内容：

- 新增 `ReviewAgent` 与 `PlannerAgent` deterministic policy。
- 新增 `GET /review-agent/suggestions`。
- `/plan` 展示完整学习计划建议。
- `/today` 展示紧急复习建议。
- 建议只读，不创建未来 `ReviewTask(source=PLANNER)`，不写 Card / ReviewLog / ReviewPreference / WrongQuestion / deck。

### 2026-06-21 - Phase 6.3 / 6.4 Verifier 与错题组织

Phase 6.3 完成：

- `KnowledgeVerifierAgent` 在 RAG 命中后评估资料可信度。
- 可疑、冲突或不足时向 prompt 注入保守使用规则，并在引用区追加资料核对提示。
- 补齐 Chat live 小样本验收规范和空回答兜底。

Phase 6.4 完成：

- `WrongQuestionOrganizerAgent` 推荐学科组与专题 deck。
- 新增 `WrongQuestionSubjectGroup`、`WrongQuestionDeck`、`WrongQuestionDeckItem` 组织层。
- `/error-book` 升级为学科卡片 -> 专题 deck -> 错题列表下钻结构。
- 组织层独立于 WrongQuestion / Card / ReviewLog / ReviewTask 事实层。

### 2026-06-20 - Phase 6.0 / 6.1 / 6.2 Agent Runtime 与 Tutor

完成内容：

- 新增 Agent Runtime 基础 contract、`AgentState`、`ActionProposal`、RouterAgent、阈值 guard、recorder 和 graph descriptor。
- `/api/chat` 接入 RouterAgent，响应头输出 route metadata。
- Tutor route 调用 TutorAgent deterministic policy。
- TutorAgent 支持 `explain_solution`、`socratic_hint`、`step_check`、`concept_bridge`、`answer_direct`、`general_follow_up` 策略。
- Agent package 不直接调用 `streamText`，不读取 API key，不启用 live 模型。

## 阶段摘要

### Phase 0 - 项目初始化

- 建立 Bun workspace / monorepo。
- 初始化 `apps/web`、`apps/server` 和 `packages/*`。
- 建立 Prisma schema、Docker Compose 基础设施和协作文档。

### Phase 1 - 前端 MVP

- 完成移动端优先 Web / PWA 壳层。
- 完成 AI 聊天、OCR、错题本、今日任务和 Dexie 本地持久化。
- 建立 Chat / OCR 统一时间线和 Markdown / KaTeX 渲染。

### Phase 2 - 后端与业务数据迁移

- 落地 NestJS 11、PostgreSQL、Auth / User API。
- 登录态迁移为后端 session 权威控制。
- WrongQuestion / ChatMessage / OCRRecord API 迁移到 PostgreSQL。
- MinIO 接入新 OCR 图片链路。
- Dexie 保留为本地快速恢复、离线兜底、乐观更新和 mutation queue。
- Phase 2.5 完成 Chat-first 产品壳层、注册登录页、个人中心、今日任务、错题本和聊天体验打磨。

### Phase 3 - OCR 与讲题结构化

- OCR 输出升级为 display Markdown + structured JSON envelope。
- 保存错题优先使用结构化字段。
- 多题图片支持单题保存和批量保存。
- `activeStudyContext` 支持围绕当前题目追问。
- tool action proposal 边界预留，但不自动执行。

### Phase 4 - FSRS 复习系统

- WrongQuestion-first FSRS 复习闭环完成。
- `Card`、`ReviewLog`、`ReviewTask`、`ReviewPreference` 以 PostgreSQL 为权威来源。
- 今日任务迁移到持久化 ReviewTask。
- 评分支持 `clientMutationId` 幂等。
- 离线评分进入 Dexie `mutationQueue`，但不本地推进 FSRS / ReviewLog / 统计。
- `/plan` 支持未来 7 / 14 天加权复习压力预览。
- `/stats` 使用 ECharts 展示复习趋势、评分分布和卡片状态。

### Phase 5 - RAG 知识库

- 完成 Document / Chunk 数据模型和 `vector(1536)` pgvector 预留。
- 支持 TXT / Markdown / DOCX / PDF 基础解析。
- 完成段落感知分块、embedding 入库和检索 API。
- `/api/chat` 支持 RAG 上下文注入和 Markdown citations。
- `/knowledge` 支持上传、处理、替换、删除、状态摘要和检索测试。
- 文档去重、替换上传和处理快照保护已落地。

### Phase 6 - 多 Agent 系统

- 使用 LangGraph，不使用 AutoGen。
- 已完成 RouterAgent、TutorAgent、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent、MemoryAgent、KnowledgeDedupAgent、KnowledgeOrganizerAgent。
- 当前列出的 Agent 均为确定性 policy，不直接调用真实模型。
- Agent Trace 提供脱敏可观测闭环。
- Review / Planner / Memory / Knowledge agents 都遵循“只读建议或人审确认”边界，不在每次 Chat 中自动写库或自动注入。

### Phase 7 - 工程化增强

- Phase 7.0：BackgroundJob 控制面完成。
- Phase 7.1：BullMQ 知识库处理队列完成，支持 inline / queue 双模式和 worker role。
- Phase 7.2：RAG SafetyGuard 完成，chunk 级 prompt injection 风险 metadata、Chat prompt 前过滤和 UI 安全信号已落地。
- Phase 7.3：Event Observability 完成，EventBus 失败隔离、后台任务 summary API 和 `/knowledge` 任务摘要轮询兜底已落地。
- Phase 7.4：Swagger / OpenAPI debug docs 完成，`/api-docs` 与 `/api-docs-json` 非 production 默认开启，production 默认关闭，并明确 response envelope、`@repo/types` contract 优先级和认证边界。
- Phase 7.5：OpenAPI request body 示例完成，注册/登录、知识库上传/替换/处理/检索、复习评分和 Agent Trace 写入已补中文说明与安全示例。
- Phase 7.6：API / worker 进程启动拆分完成，`worker` 角色不再监听 HTTP，Docker Compose 提供 worker profile。
- Phase 7.7：Worker Observability 完成，Redis heartbeat、BullMQ queue counts、BackgroundJob summary 和 `/knowledge` 健康状态条已落地。
- Phase 7.8.1：RAG Eval Baseline 完成，固定检索评估集和 `recall@k` / `top1Accuracy` / `safetyPassRate` / `noHitPassRate` 指标已落地。
- Phase 7.8.2：Hybrid Retrieval 完成，`/knowledge/search` 支持 vector candidates + PostgreSQL full-text keyword candidates 融合排序。
- Phase 7.8.3：RAG Eval Smoke 完成，本地 API 级上传、处理、检索和 eval 串联验收脚本已落地。
- Phase 7.8.4：RAG Eval Hardening 完成，smoke case 防误报 guard、`RAG_EVAL_SMOKE_KEEP_DATA` 本地复查开关和面试博客已落地。
- Phase 7.9.1：Durable Outbox 地基完成，`OutboxEvent`、claim / retry / dead-letter 状态机和服务层测试已落地。
- Phase 7.9.2：Outbox Dispatcher 最小闭环完成，显式 handler registry、dispatcher service 和知识库 requested outbox 事件入库已落地。
- Phase 7.9.3：Outbox Dispatcher Runner 完成，worker-only 受控 tick、生产默认关闭和防重入执行已落地。
- Phase 7.9.4：Outbox Summary / Metrics 完成，系统级 outbox 只读摘要接入 Worker Observability，Phase 7.9 面试博客已落地。
- Phase 7.10：Outbox Ops 后端闭环完成，脱敏列表/详情、安全 requeue、feature gate 前置和 e2e 验收已落地。
- Phase 7.11：Worker Readiness 完成，`/worker-readiness` 和 `bun --filter @repo/server readiness:worker` 已落地，用于部署前机器检查，不替代 `/health` 或 `/worker-observability/summary`。
- Phase 7.12：Docker Worker Healthcheck 完成，`worker` service 已接入容器内 `bun apps/server/dist/scripts/worker-readiness.js` readiness 检查，可通过 `docker compose ... ps` 查看 `healthy / unhealthy`。
- Phase 7.13：Docker Web / Full Stack Compose 完成，`web` 镜像已迁移 Bun + Next standalone，Compose 可拉起 `postgres / redis / minio / server / worker / web`，浏览器注册到 `/chat` 链路已验收。

## 当前验证基线

常用全量验证：

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
bun --filter @repo/server readiness:worker
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
```

Phase 7.7 worker observability 任务验证：本阶段文档收口需要至少运行以下命令。

```powershell
bun --cwd packages/types typecheck
bun packages/types/tests/worker-observability.test.mts
bun --filter @repo/server test -- worker-observability
bun --filter @repo/web test -- worker-observability knowledge
bun --filter @repo/server build
bun --filter @repo/web build
docker compose -f docker/docker-compose.dev.yml --profile worker config
git diff --check
```

AI 行为验收规则：

- mock 验工程链路。
- live 小样本验真实输出体验。
- fake embedding 不证明 RAG 语义命中质量。
- 改 Chat prompt、RAG prompt、Tutor 输出或真实模型策略时，必须按 `docs/ai-behavior-acceptance.md` 做 live smoke。
- 纯后台任务、API contract、UI 状态和文档更新不需要 live 模型验收。

## 下一步

Phase 7 后续优先级：

1. 更多后台任务生产化：OCR 批处理、批量 embedding、PDF 解析、复习提醒调度等。
2. Worker 观测增强：后续按部署形态补 BullMQ metrics、Prometheus 指标和容器 readiness 接入。
3. 生产观测：OpenTelemetry、Sentry、Prometheus / Grafana、k6。
4. Outbox 生产化：补操作审计表、admin/operator 权限模型、dead-letter 修复工作流和更多业务事件接入。

## 参考文档

- `AGENTS.md`：当前协作规范和最新项目快照。
- `README.md`：项目入口和启动说明。
- `docs/roadmap.md`：完整 Phase 路线。
- `docs/data-flow.md`：当前有效数据流和边界。
- `docs/ai-behavior-acceptance.md`：mock / live / RAG / Agent 验收规范。
- `docs/blogs/phase-7-rag-safety-guard.md`：RAG SafetyGuard 面试复盘。
- `docs/blogs/phase-7-event-observability.md`：后台任务可观测面试复盘。
- `docs/blogs/phase-7-openapi-docs.md`：Swagger / OpenAPI debug docs 面试学习博客。
- `docs/blogs/phase-7-worker-split.md`：API / worker 启动拆分面试学习博客。
- `docs/blogs/phase-7-worker-observability.md`：Worker Observability 面试学习博客。
- `docs/blogs/rag-eval-and-hybrid-retrieval.md`：RAG Eval、Hybrid Retrieval 和真实检索验收面试学习博客。
- `docs/blogs/durable-outbox-worker-observability.md`：Durable Outbox、Dispatcher Runner 和后台观测面试学习博客。
- `docs/blogs/worker-readiness-deployment-checks.md`：Worker Readiness、部署前检查和 CLI 退出码面试学习博客。
