# PrepMind AI 开发日志

> 维护规则：`DEVLOG.md` 记录阶段级里程碑、关键工程决策和验收结果，不写逐提交流水账。每个关键阶段必须保留“目标 / 为什么 / 主要内容 / 边界 / 验收 / 回顾时可以问”，方便接手、复盘和面试表达。精简只压缩重复和噪声，不能删掉理解项目所需的动机、关键步骤和决策依据。完整路线看 `docs/roadmap.md`，当前数据边界看 `docs/data-flow.md`，面试复盘看 `docs/blogs/`，具体实现追溯看 `git log`。

## 当前快照

更新时间：2026-07-09

当前阶段：Phase 7.19 已完成，后续继续 Phase 7 后台管理产品化边界、更多后台任务生产化和生产观测增强。

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
| Phase 7.15 | 已完成 | 管理员审计台真实运行验收、Docker dev 诊断开关、`127.0.0.1` hydration 修复 |
| Phase 7.16 | 已完成 | 独立桌面端 Admin Console、Outbox Ops 操作页、审计/Worker 页面、学习端后台入口 |
| Phase 7.17 | 已完成 | Docker Admin Console service、`3100` 独立容器、全栈 Compose 验收 |
| Phase 7.17.1 | 已完成 | 管理员后台返回学习端 host 对齐、loopback 登录态排障记录 |
| Phase 7.18 | 已完成 | Admin Outbox Ops 产品化、事件详情分区、requeue 后续验证 |
| Phase 7.19 | 已完成 | Admin Console 控制台数据化、真实运维总览、后台管理复盘博客 |

## 近期关键记录

### 2026-07-09 - Phase 7.19 Admin Console 控制台数据化

目标：把独立管理员后台首页从“能跳转到各个运维页面”的入口页，升级成管理员一打开就能看到系统当前状态的真实运维总览。

为什么：
- Phase 7.16 ~ 7.18 已经有独立 Admin Console、Docker admin service、Outbox Ops、操作审计和 Worker Readiness，但首页如果只是静态导航，就不像真正的企业后台。
- 管理员进入后台时，第一眼应该知道“现在有没有需要处理的任务链路风险”，而不是先逐个页面点进去找。
- 面试表达上，这一步能把后台管理讲成一套运维产品闭环：总览发现风险，Outbox 处理事件，Audit 复盘操作，Worker Readiness 验证恢复。

主要内容：
- `/` 控制台使用 TanStack Query 读取 `workerReadinessApi.get()`、`outboxApi.list(FAILED / DEAD)` 和 `operatorAuditApi.list(OUTBOX_REQUEUE)`。
- 新增 `admin-dashboard-view.ts`，把 readiness、outbox 和 audit 信号聚合为顶部状态、关注项数量、FAILED / DEAD 数量和最近审计数量。
- 顶部状态区根据 read error、`not_ready`、DEAD outbox、`degraded`、FAILED outbox 和审计失败生成不同严重度。
- 中部三块信号继续对应 `/worker`、`/outbox`、`/audit`，但展示真实状态摘要，而不是静态说明。
- 最近关注区按风险优先展示 DEAD / FAILED 事件、readiness issue 和最近审计结果。
- 同步补了一篇面试学习博客 `docs/blogs/admin-console-ops-platform.md`，覆盖今天整个后台管理产品化链路，而不是只写控制台首页。

边界：
- 不新增后端 API，不改变权限模型，不放宽 CORS、feature gate、`JwtAuthGuard` 或 `OperatorGuard`。
- 控制台只读取脱敏 DTO，不展示 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。
- 不新增批量 requeue、删除事件、跳过事件、立即 dispatch 或 payload 修改。
- 数据读取失败时显示异常状态，不使用假数据伪装健康。

验收：
- `node --experimental-strip-types --test apps/admin/src/lib/*.test.mts`
- `bun --filter @repo/admin lint`
- `bun --filter @repo/admin build`
- Docker 使用 `subst P: "E:\PrepMind_ai智能备考助手"` 映射路径后重建 `admin`，浏览器访问 `http://localhost:3100/`。
- 浏览器验收确认控制台读取真实 Worker readiness、FAILED / DEAD Outbox 数量和最近审计记录；内部入口跳转到 `/worker` 正常。

回顾时可以问：
- “为什么后台首页不能只是导航页？”
- “控制台如何聚合 Worker Readiness、Outbox 和 Operator Audit？”
- “为什么读取失败要作为一个明确运维状态，而不是静默兜底？”
- “Admin Console 前端总览和后端 OperatorGuard 的安全边界怎么分工？”
- “今天的后台管理链路如何从发现问题、处理问题到复盘问题形成闭环？”

### 2026-07-09 - Phase 7.18 Admin Outbox Ops 产品化

目标：把独立后台里的 `/outbox` 从“能查列表、能点 requeue”的工程调试页，升级成管理员能理解失败原因、判断是否适合重新入队、执行安全 requeue，并知道后续去哪里验证恢复的单事件操作工作流。

为什么：
- Outbox requeue 会改变系统级事件状态，如果页面只给一个按钮，管理员很容易把 handler missing、invalid payload 这类根因未修复的问题误当成“重试一下就好”。
- Phase 7.15 ~ 7.17 已经把权限、审计、Worker Readiness 和独立 Admin Console 搭起来了，下一步需要把这些能力串成真正可操作、可解释、可复盘的后台流程。
- 面试表达上，这一步能讲清楚“后台运维页面不是堆 API 返回值”，而是把状态机、错误分类、审计和后续观测做成产品化闭环。

主要内容：
- `apps/admin/src/lib/outbox-view.ts` 增加 Outbox 展示 helper：只允许 `FAILED / DEAD` 进入 requeue 流程；`PENDING / PROCESSING / SUCCEEDED` 给出只读原因；handler missing、invalid payload、Redis/数据库/超时和未知错误给出不同处理建议。
- `/outbox` 详情页重构为五个分区：生命周期、事件身份、诊断建议、重新入队操作、后续验证。
- 重新入队操作保留“操作原因 + 显式确认 + 按钮禁用”三段式保护；requeue 成功后刷新 outbox 列表、详情、operator audit 和 worker readiness 缓存，避免 20 秒 staleTime 内看到旧信号。
- 后续验证区直接给出 `/worker` 和 `/audit` 入口，让管理员知道 requeue 后要看 Worker Readiness、Outbox backlog 和操作审计，而不是以为按钮点完就代表任务已经执行完成。
- 列表选中态增加 `aria-pressed` 与左侧强调条，不再只依赖背景色判断当前选中事件。
- 增加静态 contract test，防止页面暴露完整 payload 或增加批量 requeue、删除、跳过、立即 dispatch、payload 修改等危险入口；浏览器验收中发现 aftercare 文案容易暗示危险操作名后，补充测试并改成“不会改写事件数据或事件结果”。

边界：
- 本阶段不改后端 API contract，不新增权限模型，不绕过 `JwtAuthGuard + OperatorGuard`。
- 页面仍只展示脱敏 DTO、`payloadHash`、错误 code / preview、状态和时间戳，不展示完整 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。
- requeue 仍只是安全状态流转：`FAILED / DEAD -> PENDING`，不立即执行 handler，不改写事件数据，不改写事件结果。
- 不做批量操作、删除事件、跳过事件、立即 dispatch、payload 修改、审计导出或保留周期策略。

验收：
- `node --experimental-strip-types --test apps/admin/src/lib/outbox-page-contract.test.mts apps/admin/src/lib/outbox-view.test.mts`
- `bun --filter @repo/admin lint`
- `bun --filter @repo/admin build`
- Docker 使用 `subst P: "E:\PrepMind_ai智能备考助手"` 规避中文路径 BuildKit header bug 后，重建并启动 `admin`，浏览器访问 `http://localhost:3100/outbox`。
- 浏览器验收覆盖：管理员登录态可进入 Outbox Ops；FAILED 事件详情展示五个分区；详情不展示完整 payload；invalid payload 提示先修生产方/数据契约；Redis timeout 事件提示依赖恢复后再 requeue；原因和确认未满足时按钮禁用；requeue 后事件回到 `PENDING`、attempts 重置、后续验证区更新；`/audit` 能看到脱敏 requeue 审计；清理测试数据后 `/worker` 回到 `Ready` 且 `backlog=false`。

回顾时可以问：
- “为什么 Outbox Ops 页面不能只做一个 requeue 按钮？”
- “handler missing、invalid payload 和 Redis timeout 三类错误为什么要给不同操作建议？”
- “requeue 为什么只是状态机里的 `FAILED / DEAD -> PENDING`，而不是立刻执行 handler？”
- “为什么 requeue 成功后要同时刷新 outbox、audit 和 worker readiness？”
- “前端页面隐藏危险入口和后端 `OperatorGuard` 的安全职责有什么区别？”

### 2026-07-09 - Phase 7.17.1 管理员后台返回学习端登录态修复

目标：修复从独立管理员后台点击“返回学习端”后，学习端看起来又要求重新登录的问题，并把本机 `localhost` / `127.0.0.1` 混用导致的登录态排障经验沉淀到文档里。

为什么：
- Phase 7.16 / 7.17 已经把学习端和管理员后台拆成两个 Next app，用户会在 `3000` 和 `3100` 两个端口之间跳转。
- 本机浏览器会把 `localhost` 和 `127.0.0.1` 当成不同 host；如果后台通过 `localhost:3100` 打开，却硬跳回 `127.0.0.1:3000`，前端状态、refresh cookie 和 API 请求 host 就可能不一致。
- 这个问题表面像“鉴权失效”或“后台返回后掉登录”，但根因不是后端 `JwtAuthGuard` 坏了，而是本机 loopback host 混用让 session recovery 链路不稳定。

主要内容：
- 后台“返回学习端”不再硬编码 `http://127.0.0.1:3000`，而是优先使用 `NEXT_PUBLIC_LEARNING_APP_URL`，未配置时跟随当前页面的 `window.location.hostname` 跳回对应的 `3000`。
- 学习端和管理员后台的 API client 在浏览器端会对齐 loopback host：当页面是 `localhost` 时，把本机 API base 也解析为 `localhost:3001`；当页面是 `127.0.0.1` 时，则解析为 `127.0.0.1:3001`。
- 新增回归测试覆盖后台返回 URL、admin API base 和 web API base 的 loopback host 对齐规则。
- `docs/dev-start.md` 补充管理员后台和学习端跳转时的 host 选择建议，避免后续手动验收再次踩坑。

边界：
- 这次不改变后端鉴权模型、不改变 cookie 策略、不放宽 CORS 和 `OperatorGuard`。
- `NEXT_PUBLIC_LEARNING_APP_URL` 仍可用于显式覆盖学习端地址；自动对齐只处理本机 `localhost` / `127.0.0.1` 场景，不改外部域名。
- 前端 host 对齐只是本地开发和 Docker dev 验收体验修复，真正权限仍由后端 session、access token、`JwtAuthGuard` 和 `OperatorGuard` 控制。

验收：
- `node --experimental-strip-types --test apps/admin/src/lib/*.test.mts`
- `node --experimental-strip-types --test apps/web/src/lib/api-client.test.mts apps/web/src/lib/sidebar-nav.test.mts`
- `bun --filter @repo/admin lint`
- `bun --filter @repo/web lint`
- `bun --filter @repo/admin build`
- `bun --filter @repo/web build`
- Docker 重建并启动 `web / admin / server` 后，浏览器访问 `http://localhost:3100/worker`，确认“返回学习端”链接为 `http://localhost:3000`，点击后直接进入 `http://localhost:3000/chat`，没有回到登录页。

回顾时可以问：
- “为什么 `localhost` 和 `127.0.0.1` 在浏览器登录态里不能随便混用？”
- “为什么这个问题看起来像鉴权失败，但根因其实是前端 host 和 refresh cookie 链路不一致？”
- “后台返回学习端为什么要跟随当前 hostname，而不是固定写死 `127.0.0.1`？”
- “Docker dev、本机 dev 和生产域名场景下，前端 API base 应该怎么区分？”

### 2026-07-09 - Phase 7.17 Docker Admin Console Service

目标：把 Phase 7.16 的独立管理员后台从“只能本机 `bun run dev:admin` 启动”推进到 Docker Compose 一等服务，让本地全栈部署形态和我们讲的架构边界一致。

为什么：
- Phase 7.16 已经把学习端和管理员后台拆成两个 Next app，但 Docker 里还只有 `web / server / worker`，部署拓扑不完整。
- 管理员后台应该能像企业项目一样单独启动、单独暴露端口、单独验收，而不是永远依赖学习端 dev server。
- 面试讲架构时可以清楚解释：`web` 是学生学习 PWA，`admin` 是 operator 控制台，`server` 是 API，`worker` 是后台任务进程。

主要内容：
- 新增 `docker/Dockerfile.admin`，用 Bun workspace + Next standalone 构建 `@repo/admin`，容器端口为 `3100`。
- `docker/docker-compose.dev.yml` 新增 `admin` service，依赖 `server`，浏览器访问 `http://127.0.0.1:3100`。
- Docker `web` service 增加 `NEXT_PUBLIC_ADMIN_CONSOLE_URL=http://127.0.0.1:3100`，学习端 ADMIN 侧边栏“后台管理”默认跳转到管理员后台容器。
- Docker `server` CORS 默认补充 `http://localhost:3100` 和 `http://127.0.0.1:3100`。
- 修复 `Dockerfile.web` / `Dockerfile.server` 的 workspace manifest 缺口：根 workspace 是 `apps/*`，所以 deps 层必须复制 `apps/admin/package.json`，否则 `bun install --frozen-lockfile` 会失败。
- 新增/扩展 Docker 静态契约测试，覆盖 admin Dockerfile、admin compose service、web 管理后台 URL 和 workspace manifest 完整性。

边界：
- 本阶段不新增新的后台业务页面，不新增新的后端 API 或权限模型。
- 不做生产域名、TLS、反向代理、镜像推送或 Kubernetes 配置。
- 管理员后台前端只是体验层，真正安全边界仍是后端 `JwtAuthGuard + OperatorGuard`。

验收：
- `bun --filter @repo/server test -- docker-compose-readiness --runInBand`
- `docker compose -f docker/docker-compose.dev.yml --profile worker build admin`
- `docker compose -f docker/docker-compose.dev.yml --profile worker build web`
- `docker compose -f docker/docker-compose.dev.yml --profile worker build server`
- `docker compose -f docker/docker-compose.dev.yml --profile worker build worker`
- `docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin`
- `docker compose -f docker/docker-compose.dev.yml --profile worker ps`：`web` 暴露 `3000`，`admin` 暴露 `3100`，`server` 暴露 `3001`，`worker` 为 `healthy`。
- 浏览器验收：`http://127.0.0.1:3000` 学习端可加载；`http://127.0.0.1:3100` 管理员后台可加载；管理员可看控制台、Outbox Ops、操作审计和 Worker Readiness；普通用户请求 `/operator-audit-logs`、`/worker-readiness`、`/outbox-events` 均返回 403。
- 中文路径下 Docker Compose `--build` 仍可能触发 Docker Desktop gRPC non-printable ASCII，本次使用 `subst P: "E:\PrepMind_ai智能备考助手"` 映射 ASCII 路径完成全栈验收。

回顾时可以问：
- “为什么 `admin` 要做成独立 Docker service，而不是继续塞进 `web`？”
- “Docker 里的 `web / admin / server / worker` 各自承担什么职责？”
- “为什么 Dockerfile 的 deps 层必须复制所有 workspace package.json？”
- “管理员后台前端门禁和后端 OperatorGuard 的安全边界有什么区别？”

### 2026-07-09 - Phase 7.16 桌面端 Admin Console 第一版

目标：把管理员诊断能力从学习端移动页面里抽出来，形成独立的桌面端后台管理入口，让 Outbox requeue、审计查询和 worker readiness 更像企业项目里的运维后台。

为什么：
- 全部堆在学习端侧边栏会让普通学习产品变臃肿；管理员工具应该和学生学习路径分离。
- `/operator-audit` 适合作为移动端/轻量审计入口，但 Outbox requeue 需要详情、确认、原因输入和错误建议，更适合电脑屏幕。
- 后续如果继续加 operator 页面，例如 outbox 详情、任务重放、告警、导出、保留周期配置，独立 admin app 更容易扩展。

主要内容：
- 新增 `apps/admin` Next.js workspace，包名 `@repo/admin`，默认端口 `3100`，根命令 `bun run dev:admin`。
- 新增后台登录、会话恢复和 `ADMIN` 前端门禁；真正安全边界仍由后端 `JwtAuthGuard + OperatorGuard` 保证。
- 新增后台控制台、`/outbox`、`/audit`、`/worker` 页面。
- `Outbox Ops` 复用 `GET /outbox-events`、`GET /outbox-events/:id` 和 `POST /outbox-events/:id/requeue`，支持筛选、脱敏详情、原因输入、显式确认和 requeue。
- `Outbox Ops` 对 `OUTBOX_HANDLER_NOT_FOUND` / handler missing 类错误给出“先修复代码，不要盲目重新入队”的提示。
- `操作审计` 复用 `GET /operator-audit-logs`，展示 `OUTBOX_REQUEUE` 的成功/失败、target、reason、actor、错误摘要。
- `Worker Readiness` 复用 `GET /worker-readiness`，展示 Redis、BullMQ queue、worker heartbeat 和 outbox readiness。
- 学习端保留 `/operator-audit`；ADMIN 用户在移动端和桌面端侧边栏都会看到“后台管理”入口，普通用户和匿名用户不显示；后台应用本身仍是桌面优先布局。

边界：
- 本阶段不新增独立 Docker `admin` service；本地用 `bun run dev:admin` 启动，后端仍可连接 Docker PostgreSQL / Redis / MinIO。
- 不新增后端接口、不放宽鉴权、不做批量 requeue、不删除 outbox event、不编辑 payload、不直接执行 handler。
- 前端隐藏入口只是体验层，不作为权限边界；所有系统级诊断仍以后端 guard 为准。

验收：
- `node --experimental-strip-types --test apps/admin/src/lib/*.test.mts`
- `node --experimental-strip-types --test apps/web/src/lib/sidebar-nav.test.mts`
- `bun --filter @repo/admin lint`
- `bun --filter @repo/admin build`
- `bun --filter @repo/web lint`
- `bun --filter @repo/server test -- outbox-ops.controller operator-audit.controller worker-readiness.controller --runInBand`
- 浏览器验收：访问 `http://127.0.0.1:3100`，验证管理员登录、控制台、Outbox Ops、审计、Worker 页面；普通账号只能看到无权限状态。

回顾时可以问：
- “为什么这次选择独立 `apps/admin`，而不是继续往学习端侧边栏塞页面？”
- “Outbox requeue 为什么必须有原因输入和确认框？”
- “为什么 handler missing 的 DEAD event 不应该盲目 requeue？”
- “后台管理前端和后端 OperatorGuard 的职责边界是什么？”

### 2026-07-09 - Phase 7.15 收尾：审计筛选控件与 requeue 手动排障说明
目标：把管理员审计台从“能用”继续推进到“手动排障时不容易误操作”，同时把用户反馈的原生下拉框视觉问题收掉。

为什么：
- `/operator-audit` 是移动端优先的管理诊断页，原生 `<select>` 在浏览器里会弹出系统样式蓝色选项框，视觉上割裂，也不像 App 内部控件。
- requeue 是会改变 outbox 状态的高权限操作，必须让开发者知道什么时候该重试、什么时候不能重试，以及它不会绕过状态机直接执行 handler。
- Phase 7.15 验收中出现过 `OUTBOX_HANDLER_NOT_FOUND` 类测试事件导致 worker readiness 降级，这正好说明“看到 DEAD 就盲目 requeue”是不对的，必须先判断根因。

主要内容：
- `/operator-audit` 的 action / status 筛选从原生 `<select>` 改为自定义 `FilterSelect`，使用 button + listbox + check icon，保留 44px 触控目标、焦点样式和 `aria-haspopup/listbox/option` 语义。
- `apps/web/src/lib/operator-audit-ui-integration.test.mts` 增加防回归断言：页面必须包含 `FilterSelect` 和 `role="listbox"`，且不能再出现原生 `<select>`。
- `docs/dev-start.md` 增加 Outbox requeue 手动排障流程，明确 `FAILED / DEAD -> PENDING`、需要先修根因、不要对 unknown handler / invalid payload 盲目 requeue，并给出 PowerShell API 调试示例。
- `docs/dev-start.md` 增加中文路径下 Docker build 的 `subst P:` 规避方案；直接在中文路径 build 仍会触发 Docker gRPC non-printable ASCII，但通过 ASCII 映射路径加 `--project-name docker` 可成功重建 server/web 镜像。

边界：
- 本次不新增前端 outbox 列表页或一键 requeue 按钮；当前 requeue 仍是 admin-only 后端诊断 API，审计台负责查看 requeue 审计记录。
- requeue 不编辑 payload、不直接执行 handler、不强制成功、不删除事件。
- UI 只改善筛选控件，不改变 `/operator-audit-logs` 查询 contract 或后端鉴权。

验收：
- `node --experimental-strip-types --test apps/web/src/lib/operator-audit-ui-integration.test.mts`
- `node --experimental-strip-types --test apps/web/src/lib/operator-audit-view.test.mts`
- `bun --filter @repo/web lint`
- `bun --filter @repo/web build`
- `docker compose -f docker/docker-compose.dev.yml --profile worker exec -T worker sh -lc "bun apps/server/dist/scripts/worker-readiness.js"`
- `docker compose --project-name docker -f P:\docker\docker-compose.dev.yml --project-directory P:\ --profile worker build server web`

回顾时可以问：
- “为什么 requeue 不是直接执行 handler，而是回到 PENDING 等 worker 正常消费？”
- “为什么 unknown handler 的 DEAD event 不能靠 requeue 解决？”
- “审计筛选控件为什么要用自定义 listbox，而不是浏览器原生 select？”
- “为什么中文路径下 Docker compose build 会失败，而 `subst P:` 后可以成功？”

### 2026-07-09 - Phase 7.15 Operator Audit 真实运行验收与本地诊断收口

目标：把管理员审计台从“代码和单元测试完成”推进到“真实前后端可以跑、管理员能用、普通用户被拦截、审计记录可查”的验收状态。

为什么：
- Phase 7.14 已经补齐 `OperatorGuard`、审计写入、审计查询 API 和前端页面，但真实运行时仍可能被环境、旧镜像、登录态或前端 hydration 问题挡住。
- Docker server 镜像运行态是 `NODE_ENV=production`，而 Outbox Ops / Operator Audit / Worker Readiness / Worker Observability 默认 production 关闭；本地 dev compose 如果不显式打开，就会表现为管理员也访问 404。
- Next dev server 在 `127.0.0.1` 下会阻止 dev resource；如果项目文档让用户访问 `127.0.0.1:3000`，就必须允许这个 dev origin，否则页面 SSR 能看见，但 React 事件不挂载，登录表单会像“点了没反应”。

主要内容：
- `docker/docker-compose.dev.yml` 为 server service 显式设置 `OUTBOX_OPS_ENABLED=true`、`OPERATOR_AUDIT_ENABLED=true`、`WORKER_READINESS_ENABLED=true`、`WORKER_OBSERVABILITY_ENABLED=true`，保证本地 Docker dev 栈的诊断入口可验收。
- `apps/server/src/worker-readiness/docker-compose-readiness.spec.ts` 增加 compose 回归测试，防止本地诊断开关和 `127.0.0.1` dev origin 再被漏掉。
- `apps/web/next.config.ts` 增加 `allowedDevOrigins: ['127.0.0.1']`，修复从 `127.0.0.1:3000` 打开 dev 前端时客户端 hydration 不完整的问题。
- 创建本地验收账号：管理员 `phase715-admin-20260709000525@example.com`、普通用户 `phase715-student-20260709000525@example.com`；通过 Docker PostgreSQL 只把管理员测试账号升级为 `ADMIN`。
- 通过真实 `POST /outbox-events/:id/requeue` 生成 `OUTBOX_REQUEUE / SUCCEEDED` 审计记录，再用 `/operator-audit` 页面读取脱敏列表。

边界：
- 这次不新增审计详情页、导出、保留周期、批量操作或更细 operator role。
- 前端“审计”入口只是体验层；真正权限仍由后端 `JwtAuthGuard + OperatorGuard` 控制。
- Docker build 在当前中文路径下触发 Docker gRPC header 非 ASCII 问题，未把 Docker server/web 镜像重建作为完成条件；改用本机前后端 + Docker PostgreSQL/Redis/MinIO 验证最新源码，数据仍使用同一个 Docker 数据库。
- 浏览器登录态验收优先使用 `localhost:3000` 与 `localhost:3001` 保持 cookie host 一致；`127.0.0.1` 已单独验证 hydration 正常。

验收：
- `bun --filter @repo/server test -- docker-compose-readiness --runInBand`
- `GET /operator-audit-logs`：管理员返回 200，普通用户返回 403。
- `POST /outbox-events/:id/requeue`：管理员返回 201，并写入一条脱敏 `OUTBOX_REQUEUE` 审计记录。
- 浏览器验收：普通用户侧边栏不显示“审计”；普通用户直达 `/operator-audit` 显示无权限且不请求 `/operator-audit-logs`；管理员侧边栏显示“审计 管理员操作留痕”；管理员点击入口进入 `/operator-audit`，审计筛选和最近记录可见。

回顾时可以问：
- “为什么 Docker dev compose 里要显式打开诊断 feature gate，而不是依赖 `NODE_ENV` 默认值？”
- “为什么普通用户访问审计页时前端不请求审计 API，但后端仍必须返回 403？”
- “为什么 `127.0.0.1` 页面能看到 SSR 内容，却可能因为 dev origin 限制导致按钮事件不生效？”
- “为什么本地验收账号改成 ADMIN 后必须重新登录？”

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

1. Operator Audit 产品化边界：是否需要审计详情、导出策略、保留周期和更细 operator role。
2. 更多后台任务生产化：OCR 批处理、批量 embedding、PDF 解析、复习提醒调度。
3. Worker 观测增强：按部署形态补 BullMQ metrics、Prometheus 指标、队列延迟和告警阈值。
4. Outbox 生产化：更多业务事件接入、dead-letter 修复工作流、生产开关流程。
5. 生产观测：OpenTelemetry、Sentry、Prometheus / Grafana、k6。

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
- `docs/blogs/admin-console-ops-platform.md`：后台管理、Admin Console、Outbox Ops、审计和控制台总览面试学习博客。
