# PrepMind 统一验收与调试清单

这份文档是日常开发、阶段收尾、面试复盘前的统一入口。它不替代
`docs/dev-start.md`、`docs/ai-behavior-acceptance.md` 和各阶段设计文档，而是回答一个更直接的问题：

> 我现在改完一个功能，应该启动什么、看什么页面、跑什么命令，才能说明它真的可用？

## 1. 先判断本次要验收什么

| 场景                      | 推荐模式                                                          | 能证明什么                                                   | 不能证明什么                      |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------- |
| 普通 UI、表单、鉴权、CRUD | 本机 Bun + Docker 基础设施                                        | 页面交互、接口联通、校验和鉴权边界                           | Docker standalone 打包是否可用    |
| 后台任务、队列、worker    | Docker PostgreSQL / Redis + `SERVER_ROLE=both` 或 API/worker 拆分 | BullMQ、BackgroundJob、heartbeat、轮询和状态流               | 容器级 readiness 是否健康         |
| Docker 部署链路           | Docker Compose 全栈                                               | Web/API/Worker 容器能否一起启动，worker healthcheck 是否工作 | 本机热更新开发体验                |
| Chat / Agent 工程链路     | Mock AI                                                           | route headers、prompt 拼接、trace、RAG 降级、UI 渲染         | 真实模型回答质量                  |
| Chat / Agent 真实体验     | Live AI 小样本                                                    | Tutor 风格、RAG 引用自然度、真实模型是否遵守 guard           | 大规模稳定性和成本                |
| Agent 模型路径决策        | deterministic baseline + Mock contract + Live paired eval         | 相同数据集上的质量、安全、延迟、token 与成本净收益           | 单次演示不能证明应启用模型        |
| RAG 上传/处理/检索链路    | fake embedding 或 live embedding smoke                            | fake 证明工程链路，live embedding 证明语义召回               | fake embedding 不证明真实语义质量 |

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
| 根目录 `.env`         | 后端、Prisma、Docker Web service 的 env 来源 |
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
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

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
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio minio-init server worker web admin
```

验收入口：

```text
Web:    http://127.0.0.1:3000
API:    http://127.0.0.1:3001/health
Worker: docker compose -f docker/docker-compose.dev.yml --profile worker ps
```

查看日志：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker logs -f server
docker compose -f docker/docker-compose.dev.yml --profile worker logs -f worker
docker compose -f docker/docker-compose.dev.yml --profile worker logs -f web
```

只重启 Docker 前端：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --force-recreate web
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
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio minio-init server worker web admin
docker compose -f docker/docker-compose.dev.yml --profile worker ps
docker compose -f docker/docker-compose.dev.yml --profile worker logs --tail 120 server worker minio-init
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

Phase 6.9.2 共享 Model Agent Runtime 还必须持续覆盖：

- Mock/Live 走同一 Zod schema、请求/结果、预算与 Trace contract；schema invalid 必须 fail-closed；
- run budget 只接受有限非负整数，调用前按 `maxOutputTokens` 不可变预留，call/input/output 任一超限都不得执行 responder/executor；
- live disabled、executor 缺失和请求已 abort 必须在预算预留前拒绝；timeout 与外部 abort 必须分类明确并清理 timer/listener；
- `@repo/ai` 不读取 env，OpenAI-compatible executor 只接受安全 HTTPS URL，API key 只存在于 closure；
- result/Trace 不得包含 system/user prompt、完整模型输出、provider 原始错误、API key、base URL、response headers 或 stack；
- 本阶段只用 Mock 与注入 fake executor 验工程 contract，不调用真实模型，不证明 Agent 语义质量，也不证明 Router/Verifier/Memory 已模型化。

### 4.3 知识库 / RAG

页面：

```text
/knowledge
```

检查点：

- 上传 TXT / Markdown / PDF / DOCX 后，资料应进入 `PENDING`。
- 点击处理后，inline 模式应同步处理；queue 模式应创建后台任务并由 worker 消费。
- 处理成功后资料应变为 `DONE`，并能在手动检索里命中。
- 检索结果应展示 score、资料来源和必要的 SafetyGuard 标记。
- 恶意指令注入内容不能进入最终 Chat prompt；高风险 chunk 应被过滤或作为不可信材料处理。
- 资料管理建议只读展示，不应自动删除、合并、重命名或分类资料。
- fake embedding 只能证明上传、解析、分块、入库和检索 API 可用；真实语义质量要用 Qwen / OpenAI 等真实 embedding 验证。

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
docker compose -f docker/docker-compose.dev.yml --profile worker ps
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
| `bun --filter @repo/server smoke:rag-eval`                            | RAG API / embedding / 检索链路验收      | 上传、处理、检索、eval 串联通过           |
| `bun --filter @repo/server smoke:operator-audit-export`               | 审计证据包真实 API/队列/存储验收        | 权限、ZIP、hash、审计、过期和清理串联通过 |
| `bun --filter @repo/server readiness:worker`                          | worker 部署前或排障                     | 返回 ready/degraded/not_ready 和退出码    |
| `bun --cwd packages/types typecheck`                                  | API contract 变化后                     | types 包通过类型检查                      |
| `bun --cwd packages/database test`                                    | Prisma helper 或数据库包变化后          | database 包测试通过                       |
| `bun --cwd packages/fsrs test`                                        | FSRS 算法变化后                         | fsrs 包测试通过                           |
| `docker compose -f docker/docker-compose.dev.yml ps`                  | 看基础设施容器                          | postgres / redis / minio 状态正常         |
| `docker compose -f docker/docker-compose.dev.yml --profile worker ps` | 看全栈与 worker healthcheck             | worker 显示 healthy 或给出 unhealthy 信号 |

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
docker compose -f docker/docker-compose.dev.yml --profile worker ps
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

不会。它们只是两种 Web 运行方式，都会访问同一个后端和数据库。普通重启前端不会清数据；真正危险的是带 volume 删除的命令，比如 `docker compose ... down -v`。

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
