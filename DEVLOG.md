# PrepMind AI 开发日志

> 维护规则：`DEVLOG.md` 记录阶段级里程碑、关键工程决策和验收结果，不写逐提交流水账。每个关键阶段必须保留“目标 / 为什么 / 主要内容 / 边界 / 验收 / 回顾时可以问”，方便接手、复盘和面试表达。精简只压缩重复和噪声，不能删掉理解项目所需的动机、关键步骤和决策依据。完整路线看 `docs/roadmap.md`，当前数据边界看 `docs/data-flow.md`，面试复盘看 `docs/blogs/`，具体实现追溯看 `git log`。

## 当前快照

更新时间：2026-07-08

当前阶段：Phase 7.14.6 已完成，后续继续 Phase 7 operator 审计与运维诊断生产化。

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
| Phase 7.4 | 已完成 | Swagger / OpenAPI debug docs、`/api-docs`、response envelope |
| Phase 7.5 | 已完成 | Swagger 中文说明、核心写接口 request body 示例 |
| Phase 7.6 | 已完成 | API / worker 启动拆分、worker-only application context |
| Phase 7.7 | 已完成 | Worker Observability、Redis heartbeat、队列 backlog |
| Phase 7.8.1 | 已完成 | RAG Eval Baseline、固定评估集、recall / top1 / safety 指标 |
| Phase 7.8.2 | 已完成 | Hybrid Retrieval、向量候选 + PostgreSQL full-text 融合排序 |
| Phase 7.8.3 | 已完成 | RAG Eval Smoke、本地 API 级上传/处理/检索/eval 串联 |
| Phase 7.8.4 | 已完成 | RAG Eval Smoke 收尾增强、case guard、keep-data 开关 |
| Phase 7.9.1 | 已完成 | Durable Outbox 地基、claim / retry / dead-letter 状态机 |
| Phase 7.9.2 | 已完成 | Outbox Dispatcher 最小闭环、handler registry |
| Phase 7.9.3 | 已完成 | Outbox Dispatcher worker-only 受控运行、防重入 tick |
| Phase 7.9.4 | 已完成 | Outbox Summary / Metrics、worker observability 只读指标 |
| Phase 7.10 | 已完成 | Outbox Ops 后端闭环、脱敏列表/详情、安全 requeue |
| Phase 7.11 | 已完成 | Worker Readiness、`/worker-readiness`、部署前 CLI |
| Phase 7.12 | 已完成 | Docker worker healthcheck、容器级 readiness |
| Phase 7.13 | 已完成 | Docker Web 镜像、Next standalone、全栈 Compose 验收 |
| Phase 7.14.1 | 已完成 | Operator 权限与操作审计设计文档 |
| Phase 7.14.2 | 已完成 | OperatorGuard、系统级诊断入口 admin-only |
| Phase 7.14.3 | 已完成 | `OperatorAuditLog`、审计 service、脱敏 metadata 与来源 hash |
| Phase 7.14.4 | 已完成 | Outbox requeue 成功/失败审计接入 |
| Phase 7.14.5 | 已完成 | `GET /operator-audit-logs`、admin-only 脱敏审计查询 API |
| Phase 7.14.6 | 已完成 | `/operator-audit` 管理员审计台、ADMIN 侧边栏入口、脱敏列表筛选 |

## 近期关键记录

### 2026-07-08 - Phase 7.14.6 收尾：Prisma Studio 排障与 Admin 导航入口

目标：把本地查看数据库和管理员审计入口从“知道内部命令的人才能用”调整为更接近真实开发者体验。

为什么：
- 用户用 `bun --cwd packages/database prisma studio` 打开 Studio 时，Prisma CLI 可能读不到根目录 `.env`，从而报 `DATABASE_URL` 缺失或在 Studio 里弹 `Prisma Client Error`，容易误判为“数据库没有数据”。
- 本地数据库当前确实有 `User` 数据；问题核心是命令运行目录、环境变量读取和 migration 状态，而不是账号数据丢失。
- `/operator-audit` 已经具备 admin-only 页面和后端 guard，管理员仍要手动输入地址不符合产品使用习惯；但普通用户不能看到这个入口。

主要内容：
- 新增 Prisma CLI 包装脚本，`db:studio` / `db:status` / `db:generate` / `db:migrate` 会优先读取根目录 `.env`，减少 `DATABASE_URL` 因工作目录不同丢失的问题。
- 新增 `bun run db:status`，用于快速确认当前 Prisma 连接的数据库和 migration 状态。
- 对当前 Docker PostgreSQL 执行安全 migration deploy，补上 `OperatorAuditLog` migration；没有执行 reset，没有清库。
- `/operator-audit` 从“隐藏手动地址”调整为“管理员侧边栏可见入口”；普通用户和未登录用户不展示该按钮，页面本身仍保留前端 ADMIN 拦截，后端 `JwtAuthGuard + OperatorGuard` 仍是真正安全边界。
- `docs/dev-start.md` 顶部补充 Prisma Studio、psql 改 admin、命令差异和侧边栏入口说明。

边界：
- 前端导航只负责体验分流，不替代后端权限。
- `migrate dev` 如果提示 reset，不能为了省事清库；本地已有数据时优先分析 drift，必要时只用 deploy 应用未执行 migration。
- Prisma Studio 是数据库查看/编辑工具，不是升级管理员账号的唯一方式；快速改角色更适合用容器内 psql。

验收：
- `bun run db:status`
- Docker PostgreSQL `User` 表确认有 45 条账号记录。
- `bun apps/web/src/lib/sidebar-nav.test.mts`

回顾时可以问：
- “为什么同一个数据库，用 Prisma Studio 看不到数据不一定代表数据丢了？”
- “`bun run db:studio` 和 `docker compose exec postgres psql ...` 分别解决什么问题？”
- “为什么 admin 导航可以前端隐藏，但真正鉴权必须在后端？”
- “为什么看到 Prisma 要 reset 时不能直接照做？”

### 2026-07-08 - Phase 7.14.6 Operator Audit Hidden Admin Page

目标：给已经完成的 Operator Audit 查询 API 补一个受控的前端查看入口，让管理员不用直接连数据库或手写请求，也能在产品里查看脱敏审计记录。

为什么：
- 只有后端 API 时，排障仍然需要 Swagger、curl 或数据库查询，对本地验收和面试展示都不够直观。
- 审计页面不能出现在普通学习用户导航里，否则会让用户误以为这是普通功能，也会暴露不必要的运维入口。
- 前端可以做体验拦截和空状态提示，但真正权限必须继续由后端 `OperatorAuditEnabledGuard -> JwtAuthGuard -> OperatorGuard` 控制。

主要内容：
- 新增 `apps/web/src/lib/operator-audit-api.ts`，复用 `@repo/types/api/operator-audit` Zod schema 解析 `/operator-audit-logs` 响应。
- 新增 `operatorAuditQueryKeys` 与 `useOperatorAuditLogs()`，只有当前会话 `currentUser.role === 'ADMIN'` 时才启用请求。
- 新增隐藏页面 `/operator-audit`，不加入普通侧边栏或个人中心主导航；管理员可手动访问。
- 页面支持按 `action`、`status`、`targetType`、`targetId`、`actorUserId` 筛选，展示审计时间、操作者、目标、原因、requestId、错误码、脱敏错误预览和 IP/User-Agent hash。
- 普通用户访问时展示无权限说明，不主动请求审计 API；未登录仍由 `(main)` layout 的 `AuthGuard` 处理。
- 页面只展示脱敏字段，不展示 payload、metadata、aggregateId、prompt、RAG chunk、模型回答、API key、token、cookie 或用户正文。

边界：
- 前端页面不是安全边界，只是体验层；不能用它替代后端 OperatorGuard。
- 本轮不做审计详情页、不做导出、不做审计删除/编辑、不做保留周期策略、不新增更细的 operator role。
- 当前分页使用“下一页”读取下一批结果，不做复杂无限列表缓存，避免 React effect 合并分页带来的状态副作用。

验收：
- `node --experimental-strip-types --test apps/web/src/lib/operator-audit-api.test.mts`
- `node --experimental-strip-types --test apps/web/src/lib/operator-audit-query-keys.test.mts`
- `node --experimental-strip-types --test apps/web/src/lib/operator-audit-view.test.mts`
- `node --experimental-strip-types --test apps/web/src/lib/operator-audit-ui-integration.test.mts`
- `bun --filter @repo/web lint`

回顾时可以问：
- “为什么 `/operator-audit` 不放进普通导航？”
- “前端 ADMIN 拦截和后端 OperatorGuard 的职责有什么区别？”
- “这个页面为什么只展示脱敏 DTO，不展示 metadata 或 payload？”
- “为什么第一版选择隐藏页面和筛选列表，而不是完整管理后台？”

### 2026-07-08 - Phase 7.14.5 Operator Audit Query API

目标：把已写入数据库的 operator 审计日志变成可受控查询的后端 API，回答“谁在什么时候做了什么、为什么做、结果如何”。

为什么：
- 高权限诊断写操作不能只靠“有权限”，还要能追踪、复盘和排障。
- 只写审计日志但没有受控查询入口，事故时仍要手动连数据库查，不适合生产化。
- 查询入口必须只返回脱敏字段，避免排障入口变成敏感数据泄露入口。

主要内容：
- 新增 `@repo/types/api/operator-audit` contract，包含 action/status、列表 query 和脱敏 response DTO。
- `packages/types/package.json` 增加 `./api/operator-audit` 子路径导出，修复 NodeNext 下 server 无法解析新增 contract 的问题。
- `OperatorAuditService.list()` 支持 `action`、`status`、`targetType`、`targetId`、`actorUserId`、`limit`、`cursor` 过滤。
- 分页按 `createdAt desc, id desc` 使用复合 cursor，避免同时间戳数据漏查。
- 新增 `GET /operator-audit-logs`，guard 顺序为 `OperatorAuditEnabledGuard -> JwtAuthGuard -> OperatorGuard`。
- 新增 `OPERATOR_AUDIT_ENABLED`：默认非 production 开启、production 关闭，关闭时在认证前隐藏为 404。

边界：
- 不做前端页面、不做审计导出、不提供详情接口、不支持删除或编辑审计日志。
- 查询结果不返回 `metadata`、outbox payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、access token、refresh token、cookie、原始 IP 或原始 User-Agent。

验收：
- `bun test packages/types/tests/operator-audit.test.mts`
- `bun --cwd packages/types typecheck`
- `bun --filter @repo/server test -- operator-audit.controller operator-audit.service env --runInBand`
- `bun --cwd apps/server eslint src/operator-audit src/config/env.ts src/config/env.spec.ts src/app.module.ts`
- `bun --filter @repo/server build`

回顾时可以问：
- “Operator Audit 查询 API 为什么要单独加 feature gate？”
- “`GET /operator-audit-logs` 返回哪些字段，为什么不返回 metadata？”
- “这里的复合 cursor 是怎么避免翻页漏数据的？”
- “为什么权限和审计是两层不同的生产安全能力？”

### 2026-07-08 - Phase 7.14.3 / 7.14.4 OperatorAuditLog + Outbox Requeue Audit

目标：在 OperatorGuard 之后补上操作审计地基，并把 `POST /outbox-events/:id/requeue` 接入成功/失败留痕，避免审计 service 变成死码。

为什么：
- `requeue` 会改变后台事件状态，属于 operator 诊断写操作，需要留下可追责记录。
- 审计写入要 best-effort，不能因为审计系统异常阻断原本的修复操作。
- 审计日志要长期保留，即使 actor user 后续被删除，也不能丢失历史操作链路。

主要内容：
- Prisma 新增 `OperatorAuditAction`、`OperatorAuditStatus`、`OperatorAuditLog` 和 migration。
- `OperatorAuditService` 支持 `recordSuccess()` / `recordFailure()`。
- metadata 改为 allowlist，只允许 `previousStatus`、`nextStatus`、`attemptsBefore`、`attemptsAfter`、`payloadHash`、`lastErrorCode`、`source` 等安全字段。
- reason / requestId / errorCode / errorPreview 均做脱敏和截断。
- `OperatorAuditLog.actorUserId` 使用 nullable + `onDelete: SetNull`，actor 删除后审计记录保留。
- `OutboxOpsController.requeue()` 成功记录 `OUTBOX_REQUEUE / SUCCEEDED`，失败记录 `OUTBOX_REQUEUE / FAILED` 后继续抛出原错误。

边界：
- 不新增前端页面，不开放审计查询接口，不保存 payload、prompt、chunk、API key、token、cookie 或原始 IP/User-Agent。

验收：
- `bun --filter @repo/server test -- operator-audit.service outbox-ops.controller --runInBand`
- `bun --cwd apps/server eslint src/operator-audit src/outbox/outbox-ops.controller.ts src/outbox/outbox-ops.controller.spec.ts`
- `bun --filter @repo/server build`
- `bun --cwd packages/database test`
- `bun run db:generate`

回顾时可以问：
- “OperatorAuditLog 为什么 actorUserId 要 nullable + SetNull？”
- “审计 metadata 为什么用 allowlist，而不是黑名单过滤？”
- “Outbox requeue 成功和失败分别怎么记录审计？”
- “审计写入失败为什么不能影响 requeue 主流程？”

### 2026-07-08 - Phase 7.14.2 OperatorGuard

目标：把 Outbox Ops、Worker Observability、HTTP Worker Readiness 从普通登录用户可访问的诊断入口升级为 admin/operator-only。

为什么：
- 这些接口暴露的是系统级队列、worker、readiness 或 outbox 状态，不是普通学生账号应看到的业务数据。
- feature gate 只能控制入口是否开放，不能替代角色权限。
- 后续 requeue、审计查询等高权限能力都需要统一 operator 权限地基。

主要内容：
- 新增 `OperatorGuard`，基于 `request.user.role === 'ADMIN'` 判断权限。
- `AuthModule` 注册并导出 `OperatorGuard`。
- `OutboxOpsController`、`WorkerObservabilityController`、`WorkerReadinessController` 的 guard 顺序统一为 feature gate -> JWT -> operator。
- feature gate 仍优先返回 404，避免关闭时暴露诊断面。

边界：
- 不新增审计表，不记录 requeue 操作日志；审计写入留给 Phase 7.14.3 / 7.14.4。
- 不影响 Worker Readiness CLI、Docker healthcheck、Chat、RAG、Agent Trace 或普通业务 API。

验收：
- `bun --filter @repo/server test -- operator.guard outbox-ops.controller worker-observability.controller worker-readiness.controller --runInBand`

回顾时可以问：
- “OperatorGuard 和 JwtAuthGuard 的职责有什么区别？”
- “为什么 guard 顺序要 feature gate -> JWT -> Operator？”
- “为什么关闭诊断入口时返回 404 而不是 403？”
- “普通用户访问 worker observability 会有什么风险？”

### 2026-07-08 - Phase 7.13 Docker Web / Full Stack Compose

目标：把 API / worker / readiness 容器链路扩展到 Web 容器，完成本地 Docker Compose 全栈启动与浏览器验收。

为什么：
- 之前只验证了 API / worker，不能证明用户从浏览器访问 Docker Web 容器的完整链路可用。
- Next standalone 在 monorepo + Bun workspace 下容易出现依赖复制和 tracing root 问题，需要真实容器构建验证。
- 本地 compose 全栈能让后续验收更接近部署形态。

主要内容：
- `docker/Dockerfile.web` 迁移到 Bun workspace + Next standalone。
- `apps/web/next.config.ts` 开启 `output: 'standalone'` 并设置 monorepo tracing root。
- Compose dev 栈拉起 `postgres / redis / minio / server / worker / web`。
- Web 容器支持本地 dev AI mode switch 展示，受 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 约束。
- 修复 server Dockerfile 的 Bun workspace runtime 布局，避免内部 `@repo/*` 包或 `.bun` store 链接在容器内解析失败。

边界：
- 本轮是本地 Docker Compose 验收，不引入 Kubernetes、生产域名、TLS、CI 镜像推送或云部署。

验收：
- `bun --filter @repo/web lint`
- `bun --filter @repo/web test`
- `bun --filter @repo/web build`
- `docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web`
- HTTP smoke：`http://127.0.0.1:3000` 返回 200，`http://127.0.0.1:3001/health` 返回 `status=ok`。
- Playwright 浏览器验收：注册临时账号后跳转 `/chat`，刷新后仍保持登录态。

回顾时可以问：
- “Docker Web 镜像为什么要用 Next standalone？”
- “monorepo 下 Dockerfile.web 需要复制哪些 workspace 文件？”
- “为什么本地 Web 容器也要支持 mock/live 开关展示？”
- “这轮 Docker 全栈验收证明了什么，没证明什么？”

### 2026-07-08 - Phase 7.12 Docker Worker Healthcheck

目标：把 worker readiness CLI 接入 Docker Compose worker service，让容器编排能看到 `healthy / unhealthy`。

为什么：
- worker-only 进程不监听 HTTP，不能靠 `/health` 判断它是否能处理后台任务。
- 容器层 healthcheck 能让 Docker Compose 直接暴露 worker 健康状态，降低本地部署排障成本。
- readiness CLI 已经存在，复用它比再写一套容器专用检查更一致。

主要内容：
- `docker/docker-compose.dev.yml` 的 `worker` service 新增 healthcheck。
- 容器内 healthcheck 使用 `bun apps/server/dist/scripts/worker-readiness.js`。
- 新增 `WORKER_READINESS_CLI_TIMEOUT_MS` 和 healthcheck interval/timeout/retries/start_period。
- 新增 docker compose readiness 回归测试。
- 更新启动文档，区分本机 CLI 与容器 healthcheck。

边界：
- 不改 Chat、RAG prompt、Tutor 输出或 live model 链路，不需要真实模型 smoke。
- 不引入 Kubernetes readiness probe、Prometheus 指标或生产部署平台配置。

验收：
- `bun --filter @repo/server test -- worker-readiness docker-compose-readiness`
- `bun --cwd apps/server eslint src/worker-readiness`
- `bun --filter @repo/server build`
- `docker compose -f docker/docker-compose.dev.yml --profile worker config`
- `git diff --check`

回顾时可以问：
- “worker-only 为什么没有 HTTP health endpoint？”
- “Docker healthcheck 调的是本机 CLI 还是容器内构建产物？”
- “`docker compose ps` 里的 healthy 到底代表什么？”
- “readiness CLI 和容器 healthcheck 的区别是什么？”

### 2026-07-08 - Phase 7.11 Worker Readiness

目标：在 `/health` 和 `/worker-observability/summary` 之外，补一个适合机器和部署系统使用的 worker readiness 判断。

为什么：
- `/health` 只能说明 API 进程活着，不能说明后台 worker 链路可接流量。
- `/worker-observability/summary` 面向开发者排障，信息更细；readiness 要给机器一个明确可判断结论。
- 部署前检查需要稳定退出码和安全摘要，不能打印连接串、payload 或原始依赖错误。

主要内容：
- 新增 `@repo/types/api/worker-readiness` contract。
- 新增 `WORKER_READINESS_ENABLED`，默认非 production 开启、production 关闭。
- 新增 `WorkerReadinessService`，组合 Redis、BullMQ queue counts、worker heartbeat 和 outbox summary。
- 新增 HTTP 入口 `GET /worker-readiness` 和 CLI `bun --filter @repo/server readiness:worker`。
- CLI 使用最小只读 Nest module，不导入 `AppModule`，不启动 HTTP、worker processor、heartbeat 或 outbox dispatcher。
- readiness 输出区分 `ready / degraded / not_ready`，异常或超时退出码为 2。

边界：
- Readiness 不替代 `/worker-observability/summary` 的详细排障信息，也不替代 `/health` 的 API liveness。
- CLI 只读检查，不消费 BullMQ、不 dispatch outbox、不 requeue、不修改业务数据。

验收：
- `bun --filter @repo/server test -- env`
- `bun --cwd packages/types typecheck`
- `bun --filter @repo/server test -- worker-readiness`
- `bun --cwd apps/server eslint src/worker-readiness scripts/worker-readiness.ts`
- `bun --filter @repo/server build`
- `git diff --check`

回顾时可以问：
- “`/health`、worker observability、worker readiness 三者怎么分工？”
- “readiness CLI 为什么不能导入 AppModule？”
- “退出码 0 / 1 / 2 分别代表什么？”
- “readiness 输出为什么不能打印原始错误？”

### 2026-07-07 - Phase 7.10 Outbox Ops

目标：给 durable outbox 补上安全的后端操作闭环，让开发者能在不暴露 payload 的前提下查看失败事件，并在修复根因后手动 requeue。

为什么：
- durable outbox 有了持久事件和重试状态后，必须能安全查看失败事件，否则排障仍然只能查数据库。
- dead / failed 事件需要可控 requeue，但 requeue 不能绕过状态机或直接执行 handler。
- outbox payload 可能间接关联业务上下文，诊断 API 必须默认隐藏敏感内容。

主要内容：
- 新增 `@repo/types/api/outbox` contract。
- 新增 `OUTBOX_OPS_ENABLED`，默认非 production 开启、production 关闭。
- 新增 `OutboxOpsService` / `OutboxOpsController`，支持脱敏列表、脱敏详情和 `FAILED / DEAD` requeue。
- 列表分页按 `updatedAt desc, id desc` 使用复合 cursor。
- `lastErrorPreview` 复用 `sanitizeJobError()`，覆盖 Bearer、access/refresh token、cookie、`sk-...`、Qwen/DashScope/OpenAI key 等形态。
- requeue 使用条件 `updateMany` 做 compare-and-swap，只把 `FAILED / DEAD` 重置为 `PENDING`，不立即执行 handler。

边界：
- 不返回 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。
- 不支持删除、强制成功、跳过、payload 编辑或直接 dispatch。

验收：
- `bun --cwd packages/types typecheck`
- `bun --filter @repo/server test -- outbox-ops env`
- `bun --filter @repo/server test -- outbox-ops job-error-sanitizer`
- `bun --cwd apps/server eslint src/outbox src/jobs/job-error-sanitizer.ts src/jobs/job-error-sanitizer.spec.ts`
- `bun --filter @repo/server build`
- `bun --cwd apps/server jest --config ./test/jest-e2e.json --runInBand --testTimeout=30000 --forceExit --verbose outbox-ops`

回顾时可以问：
- “Outbox Ops 为什么只返回脱敏列表和详情？”
- “requeue 为什么用 updateMany 做 compare-and-swap？”
- “FAILED / DEAD -> PENDING 为什么不直接执行 handler？”
- “`sanitizeJobError()` 主要防什么泄露？”

### 2026-07-06 / 2026-07-07 - Phase 7.9 Durable Outbox

目标：把关键内部事件从纯 in-process 链路推进到可重试、可观测、可受控消费的 durable outbox 地基。

为什么：
- in-process EventBus 失败后无法跨进程持久重试，适合轻量通知，不适合需要可靠投递的内部事件。
- outbox 可以把“业务事务”和“异步事件”连接起来，为后续生产化 worker 链路打地基。
- dispatcher runner 需要受控开启，避免生产部署后未经确认消费历史事件。

主要内容：
- Phase 7.9.1：新增 `OutboxEvent`、enqueue / claim / success / retry / dead-letter 状态机。
- Phase 7.9.2：新增 dispatcher service 和显式 handler registry，先接入 `knowledge.document.processing.requested`。
- Phase 7.9.3：新增 worker-only dispatcher runner，支持生产默认关闭、防重入 tick、batch size 和 lock timeout。
- Phase 7.9.4：新增 outbox summary / metrics，接入 worker observability。

边界：
- 不替换 BullMQ、`BackgroundJob` 或现有 in-process EventBus。
- dispatcher handler 不保存用户正文、prompt、chunk、API key、token 或 cookie。
- production 默认不自动消费历史 outbox，需要显式开启。

验收：
- `bun --filter @repo/server test -- outbox`
- `bun --filter @repo/server test -- outbox-dispatcher`
- `bun --filter @repo/server test -- outbox-dispatcher-runner`
- `bun --filter @repo/server test -- outbox-metrics worker-observability`
- `bun --filter @repo/server build`

回顾时可以问：
- “Durable Outbox 和 EventBus / BullMQ 的区别是什么？”
- “claim / retry / dead-letter 状态机怎么防重复消费？”
- “为什么 dispatcher 要显式 handler registry？”
- “为什么 production 默认不自动开启 dispatcher runner？”

### 2026-07-06 - Phase 7.8 RAG Eval / Hybrid Retrieval

目标：给 RAG 检索质量建立可回归的评估基线，并把检索从单纯向量召回升级为 hybrid retrieval。

为什么：
- fake embedding 只能验证工程链路，不能证明真实语义检索质量。
- 没有固定评估集时，每次改检索排序都很难判断是变好了还是变差了。
- 纯向量召回容易漏掉关键词明确的问题，hybrid retrieval 能补充关键词候选。

主要内容：
- Phase 7.8.1：新增固定检索评估集和 `recall@k`、`top1Accuracy`、`safetyPassRate`、`noHitPassRate` 指标。
- Phase 7.8.2：`/knowledge/search` 支持 vector candidates + PostgreSQL full-text keyword candidates 融合排序。
- Phase 7.8.3：新增 `bun --filter @repo/server smoke:rag-eval`，串联注册、上传、处理、检索和 eval。
- Phase 7.8.4：新增必需 case id guard，避免评估集改名或缺失时误报 PASS；支持 `RAG_EVAL_SMOKE_KEEP_DATA=true`。
- 补充 Qwen embedding 配置与真实检索 smoke 说明。

边界：
- fake eval 只证明工程回归，不证明真实语义质量。
- smoke 默认不进 CI、不保存 API key、token、cookie、embedding 向量或完整 hit content。

验收：
- `bun --cwd packages/types typecheck`
- `bun --filter @repo/server test -- rag-eval`
- `bun --filter @repo/server smoke:rag-eval`
- `bun --filter @repo/server build`

回顾时可以问：
- “RAG Eval 的 recall@k / top1 / safety / no-hit 指标分别看什么？”
- “Hybrid Retrieval 怎么融合向量候选和关键词候选？”
- “fake eval 和真实 embedding smoke 分别证明什么？”
- “为什么要有 case id guard 防误报？”

### 2026-07-02 / 2026-07-05 - Phase 7.3 ~ 7.7 Observability / OpenAPI / Worker Split

目标：把后台任务、接口文档和 worker 进程边界做成更可调试、更适合本地验收和面试讲解的工程化能力。

为什么：
- Phase 7 开始后，后台任务、worker、诊断 API 增多，如果没有观测和文档入口，开发者很难知道系统现在发生了什么。
- Swagger 用来帮助本地调试和面试展示，但不能变成第二套 contract 来源。
- API / worker 拆分能让后台任务进程独立部署和独立观测。

主要内容：
- Phase 7.3：EventBus handler 失败隔离，新增 `GET /background-jobs/summary` 和 `/knowledge` 后台任务摘要轮询兜底。
- Phase 7.4：新增 Swagger / OpenAPI debug docs，入口 `/api-docs` 和 `/api-docs-json`。
- Phase 7.5：核心写接口补中文 request body 示例，Swagger 顶部说明中文化。
- Phase 7.6：拆分 `SERVER_ROLE=api | worker | both`，worker-only 不监听 HTTP。
- Phase 7.7：新增 Redis heartbeat、BullMQ queue counts、worker observability summary 和 `/knowledge` 健康状态条。

边界：
- Swagger 是调试/展示层，不替代 `@repo/types` contract。
- worker observability 默认 production 关闭，不返回 payload、prompt、chunk、API key、token 或 cookie。
- 这组改动不改 Chat prompt / RAG prompt / live model 策略。

验收：
- `bun --cwd packages/types typecheck`
- `bun --filter @repo/server test -- event-bus background-jobs worker-observability`
- `bun --filter @repo/web test -- background-job knowledge-view`
- `bun --filter @repo/server build`
- `bun --filter @repo/web build`
- `docker compose -f docker/docker-compose.dev.yml --profile worker config`
- `git diff --check`

回顾时可以问：
- “EventBus 失败隔离解决了什么问题？”
- “Swagger 为什么只是展示层，不是 contract 事实源？”
- “`SERVER_ROLE=api | worker | both` 分别适合什么场景？”
- “Worker Observability 的 queue counts、heartbeat、BackgroundJob summary 各代表什么？”

### 2026-06-30 - Phase 7.0 / 7.1 / 7.2 Background Jobs + RAG SafetyGuard

目标：把知识库文档处理从同步接口升级为可切换的后台任务链路，并把用户上传资料视为低信任 RAG 证据。

为什么：
- 文档解析、分块、embedding 可能耗时，同步接口会拖慢用户请求，也不利于失败重试。
- 用户上传资料可能包含恶意 prompt injection，RAG 不能把检索片段当成可信指令。
- inline / queue 双模式可以兼顾本地简单开发和后台任务生产化。

主要内容：
- 新增 `BackgroundJob` 数据模型和 `@repo/types/api/background-job` contract。
- `KNOWLEDGE_PROCESSING_MODE=inline | queue` 控制文档处理模式。
- queue 模式创建 `BackgroundJob` 并投递 BullMQ；worker 处理时持续校验 `status + storageKey + contentHash` 快照。
- `/knowledge` 展示文档后台处理状态，只在活跃处理时轮询。
- `@repo/rag` 增加 deterministic chunk safety classifier。
- 文档处理时写入 `metadata.safety`，检索 API 返回 safety metadata。
- Chat RAG prompt 组装前过滤 high-risk chunk；medium-risk chunk 只作为可疑引用。
- `KnowledgeVerifierAgent` 对高风险或 `safeForPrompt=false` 的资料输出保守 guidance。

边界：
- Redis 是 queue 链路必需依赖。
- BackgroundJob 只保存脱敏任务元数据，不保存完整文件、prompt、RAG chunk、API key 或 token。
- SafetyGuard 不执行检索片段里的指令，只把资料当证据。

验收：
- mock / e2e 覆盖固定 prompt-injection 样本。
- live/browser smoke 记录在 `docs/ai-behavior-acceptance.md`。
- Trace 和 BackgroundJob 仍只保存脱敏元数据。

回顾时可以问：
- “为什么知识库处理要支持 inline / queue 双模式？”
- “BullMQ 在文档处理链路里负责什么？”
- “RAG SafetyGuard 怎么判断高风险 chunk？”
- “Chat prompt 前为什么要过滤 high-risk chunk？”

### 2026-06-20 ~ 2026-06-29 - Phase 6 Multi-Agent

目标：落地多 Agent 协作亮点，并保持确定性 policy、可观测和只读建议边界。

为什么：
- 单一 Chat 链路难以承载讲题、资料核对、错题组织、复习规划、长期记忆等多种职责。
- 多 Agent 能把复杂任务拆成可解释的策略层，但当前阶段要先保证确定性和可验收。
- 只读建议和人审确认能降低自动写库、自动误分类、自动污染记忆的风险。

主要内容：
- Phase 6.0 / 6.1 / 6.2：新增 Agent Runtime contract、RouterAgent、TutorAgent 策略层，`/api/chat` 输出 route headers。
- Phase 6.3：`KnowledgeVerifierAgent` 在 RAG 命中后评估资料可信度，并注入保守使用 guidance。
- Phase 6.4：`WrongQuestionOrganizerAgent` 推荐学科组与专题 deck，`/error-book` 升级为学科 -> 专题 -> 错题下钻结构。
- Phase 6.5：`ReviewAgent` / `PlannerAgent` 提供只读学习建议，不创建未来 `ReviewTask(source=PLANNER)`。
- Phase 6.6：`MemoryAgent` 生成长期记忆候选，必须用户确认后才成为 active memory。
- Phase 6.7：Agent Trace 持久化脱敏 route、step、token 和估算成本元数据。
- Phase 6.8：`KnowledgeDedupAgent` / `KnowledgeOrganizerAgent` 提供资料重复、新版、互补、集合和标签建议。

边界：
- 当前 Phase 6 Agent 都是确定性 policy，不直接调用真实模型。
- Review / Planner / Memory / Knowledge agents 都遵循“只读建议或人审确认”，不在每次 Chat 中自动写库或自动注入。
- Agent Trace 不保存完整 prompt、完整回答、完整 RAG chunk 或 API key。

验收：
- fixed deterministic eval set 覆盖当前确定性 Agent policy。
- mock 验证工程链路；涉及 Chat 输出体验时按 `docs/ai-behavior-acceptance.md` 做 live 小样本验收。

回顾时可以问：
- “Phase 6 每个 Agent 各自负责什么？”
- “为什么这些 Agent 当前是 deterministic policy，不直接调用真实模型？”
- “RouterAgent / TutorAgent / KnowledgeVerifierAgent 在 Chat 链路里的顺序是什么？”
- “MemoryAgent 为什么必须用户确认后才成为长期记忆？”

## 早期里程碑索引

> 说明：2026-06-05 ~ 2026-06-19 的早期 DEVLOG 曾经按日记录，后来在多轮文档清理中被压缩。这里按 `git log -- DEVLOG.md` 恢复成阶段索引，详细内容可用对应提交追溯。

| 日期 | 阶段 | 主要进展 | 回顾时可以问 | 追溯线索 |
| --- | --- | --- | --- | --- |
| 2026-06-05 | Phase 0 | 新增 DEVLOG，记录 pnpm / monorepo 恢复与项目初始化。 | “项目最初的 monorepo 和 Docker 基础怎么搭的？” | `2f9c2cb`、`ef1a580` |
| 2026-06-06 | Phase 1 | 登录模块、AI 聊天、上下文传递规划、开发博客更新。 | “Phase 1 的登录和聊天 MVP 怎么组织状态？” | `2797be2`、`8311a6a`、`af62415` |
| 2026-06-07 | Phase 1 | Day 3 开发日志，规划 Phase 1 -> Phase 2 存储迁移。 | “为什么从本地存储逐步迁移到后端权威数据？” | `31b6649` |
| 2026-06-08 | Phase 1 | Dexie 迁移、OCR 流式、错题本 CRUD、今日任务静态版、Phase 1 收官。 | “Dexie 在 Phase 1 里承担了哪些离线和本地恢复职责？” | `9f59fbf`、`4a92f87`、`b64b94d`、`a8d864f`、`375e2cb` |
| 2026-06-09 | Phase 2.1 | 后端基础与 Auth/User API 收口，准备 Phase 2.2。 | “NestJS 后端和 Auth/User API 是怎么作为后端地基落地的？” | `b2fb4b9` |
| 2026-06-11 | Phase 2.2 | Auth flow、refresh token reuse detection、WrongQuestion API、前端接入和动态 CORS。 | “登录态为什么改成后端 session 权威控制？” | `65ad246`、`8ebc04f`、`cc132b5`、`d022234`、`6a68627` |
| 2026-06-12 | Phase 2.3 | OCRRecord、ChatMessage sync、MinIO 图片链路、chat streaming 稳定性和 Phase 2.3 handoff。 | “WrongQuestion / ChatMessage / OCRRecord 如何迁移到 PostgreSQL？” | `12614a4`、`265ba42`、`909260d`、`53802c9`、`3d6f99b` |
| 2026-06-13 | Phase 2.3 / 2.5 | Phase 2.3 稳定化，Chat-first 产品壳层和体验打磨。 | “为什么产品壳层改成 Chat-first？” | `122aea2`、`537e458`、`c723e0b` |
| 2026-06-14 | Phase 3 / 4.1 ~ 4.3 | AI 讲题结构化、FSRS 复习流、学习统计、ReviewTask 任务流。 | “OCR structured output 和 FSRS 复习闭环是怎么连起来的？” | `7a1dc6e`、`34b779c`、`c2a57bc`、`f27f054` |
| 2026-06-15 | Phase 4.4 | 离线评分队列、浏览器验证和复习评分流。 | “ReviewTask 评分为什么需要 clientMutationId 幂等？” | `332ffa4`、`b15131e` |
| 2026-06-16 | Phase 4.5.1 | 复习计划预览、统计图表、review pressure model 初步规划。 | “复习计划预览和学习统计页面怎么计算压力？” | `c08ed16`、`031fc90`、`ed55e12` |
| 2026-06-17 | Phase 4.5.2 / 5.0 | ReviewPreference、加权压力模型、Phase 5 RAG 规划。 | “ReviewPreference 如何影响 7/14 天复习计划？” | `1c00f76`、`9294416` |
| 2026-06-18 | Phase 5.1 / 5.2 | RAG 数据模型、知识库上传 API、wrong-question organizer 规划。 | “RAG 的 Document / Chunk 模型和上传 API 怎么设计？” | `9d38faf`、`1031872`、`f844b3e` |
| 2026-06-19 | Phase 5.3 ~ 5.6 | 文档处理、检索 API、Chat RAG、`/knowledge` 页面、live AI guard、Phase 6 多 Agent 规划。 | “文档解析、分块、embedding、检索和 Chat RAG 是怎么串起来的？” | `1ec1644`、`2038e6a`、`ae97b49`、`542df8d`、`631c6c1` |

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

当前 Phase 7 operator / worker / outbox 方向常用定向验证：

```powershell
bun test packages/types/tests/operator-audit.test.mts
bun --cwd packages/types typecheck
bun --filter @repo/server test -- operator-audit outbox-ops worker-readiness worker-observability env --runInBand
bun --cwd apps/server eslint src/operator-audit src/outbox src/worker-readiness src/worker-observability src/config
bun --filter @repo/server build
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

1. Operator Audit 产品化边界：是否需要只读详情、导出策略、保留周期和更细 operator role。
2. 更多后台任务生产化：OCR 批处理、批量 embedding、PDF 解析、复习提醒调度。
3. Worker 观测增强：按部署形态补 BullMQ metrics、Prometheus 指标和容器 readiness。
4. 生产观测：OpenTelemetry、Sentry、Prometheus / Grafana、k6。
5. Outbox 生产化：dead-letter 修复工作流、更多业务事件接入、生产开关流程。

## 参考文档

- `AGENTS.md`：当前协作规范和最新项目快照。
- `README.md`：项目入口和启动说明。
- `docs/roadmap.md`：完整 Phase 路线。
- `docs/data-flow.md`：当前有效数据流和边界。
- `docs/acceptance-checklist.md`：统一验收入口。
- `docs/ai-behavior-acceptance.md`：mock / live / RAG / Agent 验收规范。
- `docs/blogs/phase-7-rag-safety-guard.md`：RAG SafetyGuard 面试复盘。
- `docs/blogs/phase-7-event-observability.md`：后台任务可观测面试复盘。
- `docs/blogs/phase-7-openapi-docs.md`：Swagger / OpenAPI debug docs 面试学习博客。
- `docs/blogs/phase-7-worker-split.md`：API / worker 启动拆分面试学习博客。
- `docs/blogs/phase-7-worker-observability.md`：Worker Observability 面试学习博客。
- `docs/blogs/rag-eval-and-hybrid-retrieval.md`：RAG Eval、Hybrid Retrieval 和真实检索验收面试学习博客。
- `docs/blogs/durable-outbox-worker-observability.md`：Durable Outbox、Dispatcher Runner 和后台观测面试学习博客。
- `docs/blogs/worker-readiness-deployment-checks.md`：Worker Readiness、部署前检查和 CLI 退出码面试学习博客。
