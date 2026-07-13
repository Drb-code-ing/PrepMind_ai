# PrepMind AI — 仓库协作指南

PrepMind AI 是移动端优先的 Web + PWA 智能备考助手。Phase 7 工程化已经完成；当前进入 Phase 6.9 真实模型 Agent 与分层记忆补强，完成后再进入 Phase 8 性能与 PWA、Phase 9 MCP Tool 体系。

## 项目快照

| 阶段         | 状态   | 重点                                                                                                               |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------------------ |
| Phase 0      | 已完成 | Monorepo、Prisma 初稿、Docker 基础设施                                                                             |
| Phase 1      | 已完成 | 前端 MVP、AI 聊天、OCR、错题本、今日任务、Dexie 本地持久化                                                         |
| Phase 2.1    | 已完成 | NestJS 后端基础、PostgreSQL、Auth/User API                                                                         |
| Phase 2.2    | 已完成 | 前端 Auth 接入后端，登录态由后端 session 权威控制                                                                  |
| Phase 2.3    | 已完成 | WrongQuestion / ChatMessage / OCRRecord API、MinIO 图片链路、Dexie mutationQueue                                   |
| Phase 2.5    | 已完成 | Chat-first 产品壳层、注册登录页、个人中心、今日任务、错题本和聊天体验打磨                                          |
| Phase 3      | 已完成 | OCR structured output、AI 讲题 prompt、多题保存、tool action proposal 边界                                         |
| Phase 4.1    | 已完成 | WrongQuestion-first FSRS 复习闭环、Review API、今日复习卡                                                          |
| Phase 4.2    | 已完成 | 学习统计页、Review stats/logs API、复习趋势与最近记录                                                              |
| Phase 4.3    | 已完成 | ReviewTask 持久化任务流、今日任务迁移、评分完成、跳过和恢复                                                        |
| Phase 4.4    | 已完成 | 离线评分队列、服务端幂等评分、今日复习待同步状态和 in-app 提醒摘要                                                 |
| Phase 4.5.1  | 已完成 | 复习计划预览、`/review-tasks/plan`、`/plan` 页面、`/stats` ECharts 图表                                            |
| Phase 4.5.2  | 已完成 | `ReviewPreference`、加权压力模型、7 / 14 天计划窗口、今日容量摘要                                                  |
| Phase 5.0    | 已完成 | RAG 知识库设计、可降级 Chat 边界、Phase 5.1 实施计划                                                               |
| Phase 5.1    | 已完成 | RAG 数据模型、`vector(1536)` 索引预留、knowledge API contract                                                      |
| Phase 5.2    | 已完成 | 文档上传、列表、详情、删除与状态 API                                                                               |
| Phase 5.3    | 已完成 | 文档解析、分块、embedding 入库、`POST /knowledge/documents/:id/process`                                            |
| Phase 5.4    | 已完成 | 检索 API、`POST /knowledge/search`、query embedding + pgvector 相似度搜索                                          |
| Phase 5.5    | 已完成 | Chat RAG 增强、知识库上下文注入、Markdown citations                                                                |
| Phase 5.6    | 已完成 | `/knowledge` 学习资料工作台、上传/处理/替换/删除/检索测试前端闭环                                                  |
| Phase 6.0    | 已完成 | Agent Runtime 地基、共享 Agent contract、RouterAgent、阈值 guard、recorder、graph descriptor                       |
| Phase 6.1    | 已完成 | RouterAgent 接入 `/api/chat`、Agent route headers、route-aware prompt、mock route 展示                             |
| Phase 6.2    | 已完成 | TutorAgent 策略层、讲题意图分类、策略 prompt、mock strategy metadata                                               |
| Phase 6.3    | 已完成 | KnowledgeVerifierAgent、RAG 资料可信度评估、资料核对提示、verifier headers                                         |
| Phase 6.4    | 已完成 | WrongQuestionOrganizerAgent、错题学科卡片、专题 deck、错题组织层 API                                               |
| Phase 6.5    | 已完成 | ReviewAgent / PlannerAgent、复习分析、学习计划建议、只读 suggestions API                                           |
| Phase 6.6    | 已完成 | MemoryAgent、长期记忆候选、人审确认、停用/恢复/删除管理                                                            |
| Phase 6.7    | 已完成 | Agent Trace UI、估算成本看板、固定 deterministic eval set                                                          |
| Phase 6.8    | 已完成 | KnowledgeDedupAgent / KnowledgeOrganizerAgent、资料重复/新版/互补判断、只读 suggestions API、`/knowledge` 建议面板 |
| Phase 6.9.1  | 已完成 | Agent eval contract、32 个 seed cases、deterministic baseline、paired eval 报告模板                                |
| Phase 6.9.2  | 已完成 | 共享 `ModelAgentRuntime`、结构化 Mock/Live contract、不可变预算、超时取消、脱敏 Trace                              |
| Phase 6.9.3.1 | 已完成 | ConversationSummary / ConversationState strict contract 与 PostgreSQL/Prisma 地基                           |
| Phase 6.9.3.2 | 已完成 | ConversationState 权威读写、Redis 降级缓存、prepare API 与 Chat history state 恢复                          |
| Phase 6.9.3.3 | 已完成 | 12 条/70% 滚动摘要、凭据防护、ModelAgentRuntime composition、source hash 与 CAS                           |
| Phase 6.9.3.4 | 已完成 | Web prepare 编排、分层 context assembler、Dexie v9 sanitized state 恢复与安全观测                    |
| Phase 6.9.3.5 | 已完成 | Docker Mock/Live 真实验收、DeepSeek JSON structured output、Trace 分层 token、清理与阶段证据           |
| Phase 6.9.4.1 | 已完成 | Router 60 / Verifier 40 扩展评测集、专项 metrics、deterministic baseline 与安全 CLI             |
| Phase 6.9.4.2 | 已完成 | Router / Verifier Mock candidate、零调用安全门、strict schema、不可变预算与安全降级             |
| Phase 6.9.4.3 | 验收未完成 | diagnostics contract 已完成；待新的 controlled-Live，候选保持关闭 |
| Phase 7.0    | 已完成 | `BackgroundJob` 控制面、账号级后台任务读 API、脱敏任务元数据                                                       |
| Phase 7.1    | 已完成 | BullMQ 知识库处理队列、inline / queue 双模式、worker role、`/knowledge` 后台处理状态                               |
| Phase 7.2    | 已完成 | RAG SafetyGuard、chunk 级 prompt injection 风险 metadata、Chat prompt 前过滤、Verifier / UI 安全提示               |
| Phase 7.3    | 已完成 | in-process EventBus 失败隔离、后台任务 summary API、`/knowledge` 后台任务摘要与轮询兜底                            |
| Phase 7.4    | 已完成 | Swagger / OpenAPI debug docs、`/api-docs`、`/api-docs-json`、全局 response envelope 说明                           |
| Phase 7.5    | 已完成 | Swagger 中文说明、核心写接口 request body 示例、multipart 上传文档说明                                             |
| Phase 7.6    | 已完成 | API / worker 进程启动拆分、`SERVER_ROLE=worker` application context、Docker worker profile                         |
| Phase 7.7    | 已完成 | Worker Observability、Redis heartbeat、队列 backlog / worker 在线状态、`/knowledge` 健康状态条                     |
| Phase 7.8.1  | 已完成 | RAG Eval Baseline、固定检索评估集、recall@k / top1 / safety / no-hit 指标                                          |
| Phase 7.8.2  | 已完成 | Hybrid Retrieval、向量候选 + PostgreSQL full-text keyword 候选、去重融合排序                                       |
| Phase 7.8.3  | 已完成 | RAG Eval Smoke、本地 API 级上传/处理/检索/eval 串联验收脚本                                                        |
| Phase 7.8.4  | 已完成 | RAG Eval Smoke 收尾增强、case 防误报 guard、`RAG_EVAL_SMOKE_KEEP_DATA`、面试博客                                   |
| Phase 7.9.1  | 已完成 | Durable Outbox 地基、`OutboxEvent`、claim / retry / dead-letter 状态机                                             |
| Phase 7.9.2  | 已完成 | Outbox Dispatcher 最小闭环、handler registry、知识库 requested 事件入库                                            |
| Phase 7.9.3  | 已完成 | Outbox Dispatcher worker-only 受控运行、生产默认关闭、防重入 tick                                                  |
| Phase 7.9.4  | 已完成 | Outbox Summary / Metrics、worker observability 安全只读指标                                                        |
| Phase 7.10   | 已完成 | Outbox Ops 后端闭环、脱敏列表/详情、`FAILED / DEAD -> PENDING` 安全 requeue                                        |
| Phase 7.11   | 已完成 | Worker Readiness、`/worker-readiness`、部署前 CLI readiness 命令                                                   |
| Phase 7.12   | 已完成 | Docker worker healthcheck、容器级 readiness 状态接入                                                               |
| Phase 7.13   | 已完成 | Docker Web 镜像、Next standalone、全栈 Compose 启动与浏览器验收                                                    |
| Phase 7.14.1 | 已完成 | Operator 权限与操作审计设计文档                                                                                    |
| Phase 7.14.2 | 已完成 | OperatorGuard、系统级诊断入口 admin-only 访问控制                                                                  |
| Phase 7.14.3 | 已完成 | `OperatorAuditLog`、审计 service、脱敏 metadata 与来源 hash                                                        |
| Phase 7.14.4 | 已完成 | Outbox requeue 成功/失败审计接入                                                                                   |
| Phase 7.14.5 | 已完成 | `GET /operator-audit-logs`、admin-only 脱敏审计查询 API                                                            |
| Phase 7.14.6 | 已完成 | `/operator-audit` 管理员审计台、ADMIN 侧边栏入口、脱敏列表筛选                                                     |
| Phase 7.15   | 已完成 | 管理员审计台真实运行验收、Docker dev 诊断开关、`127.0.0.1` hydration 修复                                          |
| Phase 7.16   | 已完成 | 独立桌面端 Admin Console、Outbox Ops 操作页、审计/Worker 页面、学习端后台入口                                      |
| Phase 7.17   | 已完成 | Docker Admin Console service、`3100` 独立容器、全栈 Compose 验收                                                   |
| Phase 7.17.1 | 已完成 | 管理员后台返回学习端 host 对齐、loopback 登录态排障记录                                                            |
| Phase 7.18   | 已完成 | Admin Outbox Ops 产品化、事件详情分区、requeue 后续验证                                                            |
| Phase 7.19   | 已完成 | Admin Console 控制台数据化、真实运维总览、后台管理复盘博客                                                         |
| Phase 7.20   | 已完成 | Operator Audit 详情闭环、审计详情双栏、脱敏详情 API                                                                |
| Phase 7.21   | 已完成 | Admin Ops 交互收口、自定义筛选控件、Outbox requeue 原因必填                                                        |
| Phase 7.22   | 已完成 | Docker Admin Ops 真实验收、普通用户 403 拦截、测试数据清理、后台 favicon 收口                                      |
| Phase 7.23.1 | 已完成 | Operator Audit 180 天保留周期、异步 ZIP 证据包、事务型 Outbox 与 fail-closed 下载审计设计                          |
| Phase 7.23.2 | 已完成 | strict 导出 contract、Prisma export/maintenance 模型、ACCOUNT/SYSTEM job 与生产关闭配置                            |
| Phase 7.23.3 | 已完成 | Serializable 导出申请事务、strict audit、Outbox-only BullMQ 投递                                                   |
| Phase 7.23.4 | 已完成 | 单并发 ZIP Worker、formula-safe CSV、REPEATABLE READ 快照、lease/CAS fencing、attempt-fenced MinIO                 |
| Phase 7.23.5 | 已完成 | 小时级保留维护、24h 逻辑过期、180 天 active-export 水位、stale repair、crash janitor、三队列 readiness             |
| Phase 7.23.6 | 已完成 | 系统级 ADMIN 查询/详情、稳定游标、fail-closed 审计 ZIP 下载                                                        |
| Phase 7.23.7 | 已完成 | `/audit` 审计记录/证据包 tabs、申请/查询/详情/下载 Admin UI                                                        |
| Phase 7.23.8 | 已完成 | Docker API/Worker 拆分验收、下载/过期/清理 smoke、面试博客                                                         |

## 技术栈

| 层级              | 技术                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Frontend          | Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui, TanStack Query, Zustand, Dexie, PWA |
| Backend           | NestJS 11, Prisma, PostgreSQL, Redis, BullMQ                                                 |
| AI                | Vercel AI SDK, OpenAI, DeepSeek, Gemini                                                      |
| Agent / RAG / MCP | LangGraph, pgvector, bge-m3, MCP JSON-RPC                                                    |
| Infra             | Docker, MinIO, Sentry, OpenTelemetry, Prometheus, Grafana                                    |

Agent 框架使用 LangGraph，不使用 AutoGen。
Phase 6 是多 Agent 协作亮点阶段：当前已完成 Agent Runtime 地基、RouterAgent 到 Chat 的轻量接入、TutorAgent 策略层、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent、MemoryAgent、Agent Trace 可观测闭环，以及 KnowledgeDedupAgent / KnowledgeOrganizerAgent 资料管理建议。`TutorAgent`、`KnowledgeVerifierAgent`、`WrongQuestionOrganizerAgent`、`ReviewAgent`、`PlannerAgent`、`MemoryAgent`、`KnowledgeDedupAgent` 与 `KnowledgeOrganizerAgent` 当前都是确定性 policy，不直接调用真实模型；Tutor 负责讲题意图和 prompt 策略，Verifier 只在 RAG 命中后评估资料可信度，WrongQuestionOrganizer 只给错题学科组与专题 deck 建议，Review / Planner 只基于当前用户错题、复习日志、复习计划和偏好生成只读学习建议，Memory 只生成长期记忆候选并等待用户确认，KnowledgeDedup / KnowledgeOrganizer 只基于当前用户资料元数据和少量 chunk 摘要给出重复、新版、互补、集合与标签建议。最终流式输出仍由 `/api/chat` 的既有 mock/live 链路负责；错题组织由 NestJS organizer API 写入独立组织层；复习计划建议由 `/review-agent/suggestions` 读取并展示，不创建未来 `ReviewTask`；长期记忆由 `/memory-agent` 与 `/user-memories` API 管理，不自动注入每次 Chat；资料管理建议由 `/knowledge-agent/suggestions` 读取并在 `/knowledge` 展示，不自动合并、删除、替换、重命名或分类资料。Agent Trace 由 `/agent-traces` 在线账号级 API 持久化脱敏后的路由、步骤、token 和估算成本元数据，`/agent-trace` 提供调试台；它不保存完整 prompt、完整回答、完整 RAG chunk 或 API key，成本看板只展示估算值，不替代模型供应商账单。

Phase 6.9.1 已建立统一评测 contract 和 `phase-6.9-seed-v1`：Router、Verifier、Memory 各 8 个可执行 deterministic case，Orchestrator 8 个 expectation-only case。当前 baseline 为 21/24，通过率 87.5%，并发现 MemoryAgent 会把含示例 API key 的“以后请记住”误提取为偏好候选这一 critical failure。该阶段不调用真实模型、不修饰 baseline 结果；后续 Router、Verifier、Memory、Orchestrator 必须扩充 paired eval，质量、安全、延迟和成本门槛全部通过后才能启用模型路径。

Phase 6.9.2 已在 `@repo/ai` 建立共享 `ModelAgentRuntime`：Mock 与 Live 共用 Zod schema、请求/结果、不可变 run budget 和安全 Trace contract；调用前按请求最大输出量预留预算，避免并发重入超卖。`@repo/ai` 不读取环境变量，API key 与 base URL 只由 composition root 传入 OpenAI-compatible executor closure；runtime 结果和 Trace 不返回完整 prompt、完整模型输出、provider 原始错误、API key、base URL 或 stack。调用方仍需先权威解析 live 双开关，runtime 再检查 `liveCallsEnabled`。

Phase 6.9.3.3 已把滚动摘要接入 `POST /conversation-context/prepare`：达到 12 条未覆盖消息或 summary + 未覆盖窗口达到 `maxInputTokens` 70% 时触发；水位只停在最新完整 assistant 消息，user-only tail 永不覆盖。摘要源仅允许 USER/ASSISTANT，provider 前会脱敏 bearer/cookie、裸 provider key、client secret/password 与 PEM 私钥，credential-like 输出与越界 usage 均不持久化。模型调用严格位于事务外；事务内以 Serializable snapshot 复核目标范围 source hash，并以 `summaryVersion + coveredThroughOrder` CAS 推进单行摘要。

Phase 6.9.3.4 已把 Web request 的 `conversationId`、authenticated prepare、分层 assembler 与 Dexie v9 恢复接入 `/api/chat`。首轮没有 conversationId 时跳过 prepare，服务端 sync 返回 id 后第二轮才调用；live auth 始终先于 prepare。prepare 仅在 token + id 同时存在时执行，默认 10 秒且限定 1~15 秒，向下传播 request abort，网络/timeout/5xx/schema 失败只返回固定 degraded 元数据且不阻断 Mock Chat。assembler 固定保留 base/latest user，独立装配 agent guidance、untrusted state guidance、OCR、完整 recent turns、safe RAG 与 summary；agent/state 合计最多 10% 且分别观测，optional layer 不会制造 413，RAG 整层 drop 时同步清空引用，summary 只在确有 history dropped 时考虑。headers 与 Trace 只含状态、版本、固定 drop code 和 token 计数，不含 summary/prompt/chunk 正文。PostgreSQL 仍是 state/summary 权威源，Redis 是服务端 cache，Dexie v9 只保存当前用户可恢复的 sanitized `activeGoal/activeQuestionId`、版本与有效期；写入按用户串行、版本单调、过期/跨用户/登出 fail-safe，不保存 summary、tool、proposal、prompt 或 token，也不凭 question id 伪造 OCR。

Phase 6.9.3.5 已完成 Docker Mock 与受控 Live 收口。Mock API/浏览器覆盖 12 条触发、复用、多用户、CAS/stale、Dexie 白名单和 Trace；Live 使用 `deepseek-v4-flash` 生成 `conversation-summary-v1`，summary version/watermark 为 `1/15`，provider-reported summary usage 为 `2246/154`，最终 Chat 保留二次函数判别式目标与正确值 `1`。DeepSeek structured output 通过共享 executor 固定 `mode: 'json'`，仍由 Zod strict schema、预算、超时与双开关约束。Trace 只新增 `layerTokens=m/a/s/o/r/k/y` 计数。验收后恢复 Mock，严格清理 7 个合成账号、4 个会话、级联 summary/state/cache 与测试浏览器 storage；详细证据见 `docs/acceptance/2026-07-11-phase-6-9-3-conversation-memory.md`。下一任务是 Phase 6.9.4 Router/Verifier 混合路径。

Phase 6.9.4.1 已固定 `phase-6.9-router-verifier-v1`：Router 60 条覆盖 36 个高置信、16 个歧义、8 个安全边界 case；Verifier 40 条覆盖 trusted/insufficient/complex conflict/stale/prompt injection。deterministic baseline 为 74/100、critical failure 2；Router overall 75%、歧义 macro-F1 52.47%、高置信 86.11%、权限边界 80%，Verifier overall 72.5%、复杂冲突 recall 0%、注入放行 0。该结果不修饰、不启用模型路径；该阶段随后进入 Phase 6.9.4.2 Mock candidate contract。证据见 `docs/acceptance/phase-6-9-4-1-router-verifier-baseline.md`。

Phase 6.9.4.2 已实现 Router / Verifier Mock candidate contract，但尚未接入生产 Chat，也未调用真实模型。Router ineligible 与 safety case 均为零 runtime invoke，safety 固定回到本地 safe chat，权限只由 canonical route map 重建；Verifier 对 prompt injection、high-risk 或 `safeForPrompt=false` 证据整批零调用阻断，使用 literal `evidenceCodes` 的 strict discriminated union、稳定 chunk 排序，并在失败时保留限制性 deterministic 状态、把 trusted 收紧为 suspicious。schema、budget、timeout、abort 和 runtime contract 失败均安全降级；hostile getter/proxy/signal、runtime 预算污染和 telemetry unavailable 按 fail-closed 处理，provider-reported input usage 不会被工程估算误当作硬上限。预算使用隔离 snapshot，telemetry 不可验证时按 preview budget 记账以阻止重试超卖。Envelope/Trace 不含 prompt、query/chunk、provider output/raw error 或 credential 正文。该阶段完成时为 `Enabled=no`、`Reason=paired_candidate_not_run`；Mock 只证明工程 contract，不证明语义质量。证据见 `docs/acceptance/phase-6-9-4-2-router-verifier-mock-candidate.md`；其后由 Phase 6.9.4.3 执行 same-case deterministic / Mock / controlled-Live paired eval。

Phase 6.9.4.3 的同 case paired eval 工程、Mock 验收、两次失败证据检查点与共享 provider diagnostics contract 已完成，但阶段验收未完成。Fresh Mock 为 complete：28 条 eligible case 全部 strict success，72 条 ineligible/safety case 保持零 provider 调用；deterministic baseline 仍为 74/100、critical=2。两次受控 Live 分别在第 3 次和第 1 次 provider attempt 出现固定 `PROVIDER_ERROR` 后 fail-closed 停止；Attempt A 仍因 filename identity mismatch 被 strict validator 拒绝，Attempt B 仍为合法但 `incomplete` 的 canonical evidence，历史文件未改写。共享 `@repo/ai` 现以 `http_auth/http_rate_limit/http_client/http_server/transport/structured_output/invalid_response/unknown` 八类作为唯一权威诊断枚举；AI SDK raw error 在 adapter 边界丢弃，只有默认 dependency identity + 当前 invocation `AbortSignal` scope + one-shot consume 能建立可信 provenance，wrong-scope 不消费、跨 invocation/executor replay 不成立，custom/injected 固定为 `unknown`。Runtime Error/Trace 与 Agent strict sanitizer 要求分类双边一致；paired evidence 只允许 attempted Live `PROVIDER_ERROR` failure 携带分类，counter mismatch、pre-provider、success、Mock 与 not-run 会剥离或拒绝。分类不改变 `usage_unverifiable`、不授权自动重试，也尚未接入生产 Trace API/UI。Router/Verifier 仍为 `enabled=false`，candidate 未接入生产 Chat，production 继续 deterministic。下一任务是从最新 main 发起新的 controlled-Live paired eval；只有 28 次 strict success 与全部质量、安全、延迟、成本门槛通过后才能标记阶段完成。证据见 `docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md`。

## 常用命令

本仓库使用 Bun workspace。Windows 本机开发优先使用 Bun，Docker PostgreSQL 固定宿主机端口 `5433`。

```powershell
bun install

$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

$env:RAG_EMBEDDING_PROVIDER='fake'
# 可选：启用 BullMQ 队列处理知识库文档
# $env:REDIS_URL='redis://127.0.0.1:6379'
# $env:KNOWLEDGE_PROCESSING_MODE='queue'
# $env:SERVER_ROLE='both' # 本地一体化；拆分验证时 server 用 api，worker 进程用 worker
bun --filter @repo/server start:dev
bun --filter @repo/web dev
bun run dev:admin # 或 bun --filter @repo/admin dev，打开 http://127.0.0.1:3100
```

常用验证：

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
bun --filter @repo/server smoke:rag-eval # 需本地 API 与真实或可用 embedding provider 已启动
bun --filter @repo/server readiness:worker # 需本地 PostgreSQL / Redis 可连接，用于部署前 worker readiness 检查
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
```

Docker 全栈本地验收：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

访问入口：

```text
学习端：http://127.0.0.1:3000
管理员后台：http://127.0.0.1:3100
API：http://127.0.0.1:3001
```

后端 e2e 需要 Docker PostgreSQL 正在运行。详细启动说明见 `docs/dev-start.md`。
按功能做阶段验收、Docker 全栈验收、mock/live AI 验收和收尾提交时，优先看 `docs/acceptance-checklist.md`。

## 环境变量

- 根目录 `.env`：后端和 Prisma 使用，至少包含 `DATABASE_URL`、`JWT_SECRET`。
- `apps/server/.env`：server/e2e 在服务目录运行时读取，保持和根 `.env` 一致。
- `apps/web/.env.local`：Next.js API Route 使用；开发默认 `AI_PROVIDER_MODE=mock`，即使存在 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY` 也不会调用真实模型。
- 知识库处理默认 `KNOWLEDGE_PROCESSING_MODE=inline`，业务处理不投递 BullMQ；需要验证 BullMQ 时设置 `KNOWLEDGE_PROCESSING_MODE=queue`、`REDIS_URL=redis://127.0.0.1:6379`。`SERVER_ROLE=api` 只启动 HTTP API 且不注册 worker processor；`SERVER_ROLE=worker` 只创建 Nest application context、不监听 HTTP 端口并注册 worker processor；`SERVER_ROLE=both` 用于本地一体化开发，HTTP 与 worker 同进程。当前 NestJS 仍会初始化 BullMQ 模块，本地开发建议继续启动 redis。Phase 7.7 起 worker / both 角色会通过 BullMQ Redis 连接写入短 TTL heartbeat，默认 `WORKER_HEARTBEAT_INTERVAL_MS=15000`、`WORKER_HEARTBEAT_TTL_SECONDS=45`，用于 `/worker-observability/summary` 和 `/knowledge` 健康状态条判断 worker 最近是否在线。`WORKER_OBSERVABILITY_ENABLED` 默认非 production 开启、production 关闭；production 仅适合受控内网或临时诊断显式开启。
- Phase 7.9.3 起 `OutboxDispatcherRunnerService` 会在 `SERVER_ROLE=worker | both` 且 `OUTBOX_DISPATCHER_ENABLED=true` 时按固定间隔调用 `OutboxDispatcherService.dispatchBatch()`；非 production 默认开启，production 默认关闭，生产环境需要显式设置 `OUTBOX_DISPATCHER_ENABLED=true`。可用 `OUTBOX_DISPATCHER_INTERVAL_MS`、`OUTBOX_DISPATCHER_BATCH_SIZE` 和 `OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS` 控制 tick 间隔、批大小和锁超时。runner 不读取 outbox payload、不绕过 handler registry、不新增 HTTP API 或前端 UI。
- Phase 7.10 起 `OUTBOX_OPS_ENABLED` 控制后端 Outbox Ops 诊断入口；默认非 production 开启、production 关闭。`GET /outbox-events`、`GET /outbox-events/:id` 与 `POST /outbox-events/:id/requeue` 经过 feature gate 和 `JwtAuthGuard`，feature gate 排在认证前，关闭时隐藏为 404。接口只返回脱敏状态、attempts、时间戳、payloadHash、错误码和脱敏错误预览，不返回 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。requeue 只允许 `FAILED / DEAD -> PENDING`，不直接执行 handler，不支持删除、强制成功、跳过、payload 编辑或直接 dispatch。
- Phase 7.14.5 起 `OPERATOR_AUDIT_ENABLED` 控制 Operator Audit 查询入口；默认非 production 开启、production 关闭。`GET /operator-audit-logs` 和 Phase 7.20 新增的 `GET /operator-audit-logs/:id` 都经过 feature gate、`JwtAuthGuard` 和 `OperatorGuard`，关闭时在认证前隐藏为 404。接口只返回脱敏审计列表 / 详情，不返回 `metadata`、outbox payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、access token、refresh token、cookie、原始 IP 或原始 User-Agent。Phase 7.14.6 起前端新增 `/operator-audit` 管理员审计台；管理员会在侧边栏看到“审计”入口，普通用户不显示入口且页面不会主动请求审计 API，真正安全边界仍以后端 guard 为准。
- Phase 7.23.2 起新增审计导出配置地基，但 `OPERATOR_AUDIT_EXPORT_ENABLED` 与 `OPERATOR_AUDIT_MAINTENANCE_ENABLED` 在所有环境都默认 `false`。已固定 180 天审计保留、24 小时导出 TTL、31 天范围、50,000 条记录、64 MiB archive、每管理员 2 个 active / 每小时 10 次、全局 10 个 active、单并发、600 秒 BullMQ lock、300 秒 lease、3600 秒 stale、24 小时投递恢复窗口和 120 秒查询 timeout；worker / both 角色只有在 export、maintenance 与 Outbox Dispatcher 三个 gate 都显式开启时才注册 export processor。processor 本地 concurrency 固定为 1，bootstrap 先设置 BullMQ queue global concurrency=1 再启动 paused Worker，配置拒绝大于 1。production 只要显式开启 `OPERATOR_AUDIT_ENABLED`、`OUTBOX_OPS_ENABLED` 或 `OPERATOR_AUDIT_EXPORT_ENABLED` 任一审计读取/写入/导出路径，就必须提供 trim 后至少 32 字符的 `OPERATOR_AUDIT_FINGERPRINT_SECRET`；非 production 使用至少 32 字符的明确本地 fallback 且禁止记录该值。Phase 7.23.3 起 IP / User-Agent 来源指纹使用该 secret 计算 `hmac-sha256:<64 hex>`，不得记录 secret 或原始来源值；Phase 7.23.5 起 ZIP processor 与保留维护均已实现且 gates 仍默认关闭，Phase 7.23.6 ~ 7.23.8 已补齐查询、下载、Admin UI 与真实 Docker 验收。
- Phase 7.15 起本地 Docker dev compose 会显式开启 `OUTBOX_OPS_ENABLED`、`OPERATOR_AUDIT_ENABLED`、`WORKER_READINESS_ENABLED` 和 `WORKER_OBSERVABILITY_ENABLED`，因为 server 镜像运行态是 `NODE_ENV=production`，不能依赖非 production 默认值来打开诊断入口。Phase 7.23.2 因此只在 `docker/docker-compose.dev.yml` 的 server service 增加可由宿主环境覆盖的 `OPERATOR_AUDIT_FINGERPRINT_SECRET=${OPERATOR_AUDIT_FINGERPRINT_SECRET:-local-dev-audit-fingerprint-change-me}`，避免本地 dev 栈因新生产校验无法启动；该 fallback 不写入 `Dockerfile.server` 的 `ARG / ENV`。真实 production 必须独立提供至少 32 字符的 secret，严禁复用此 local fallback。Next dev 配置允许 `127.0.0.1` 作为 dev origin，避免按本地文档访问 `127.0.0.1:3000` 时只看到 SSR 页面但 React 表单事件未 hydration。真实验收已覆盖管理员 / 普通用户前后端权限、`/operator-audit` 页面、审计 API 和 Outbox requeue 审计写入。
- Phase 7.11 起 `WORKER_READINESS_ENABLED` 控制 worker readiness 诊断入口；默认非 production 开启、production 关闭。`GET /worker-readiness` 经过 feature gate 和 `JwtAuthGuard`，关闭时在认证前隐藏为 404。该接口面向机器和部署检查，只返回安全的 Redis / BullMQ queue / worker heartbeat / outbox readiness 摘要，不返回 payload、prompt、chunk、API key、token、cookie 或用户正文。CLI 命令为 `bun --filter @repo/server readiness:worker`，使用最小只读 Nest module，不导入 `AppModule`，不启动 HTTP API、worker processor、heartbeat 或 outbox dispatcher；异常或超时退出码为 2，not ready / degraded 退出码为 1，ready 退出码为 0。
- Phase 7.12 起 Docker Compose `worker` service 接入容器级 healthcheck，容器内使用 runner 构建产物命令 `bun apps/server/dist/scripts/worker-readiness.js`，不依赖本机 Bun workspace CLI。server 镜像会保留根 `node_modules`、`apps/server/node_modules` 和 `packages`，保证 Bun workspace 依赖与 `@repo/*` 包在容器运行时可解析。`WORKER_READINESS_CLI_TIMEOUT_MS` 默认 `5000`，healthcheck 默认 `interval=30s`、`timeout=10s`、`retries=3`、`start_period=30s`。本地可用 `docker compose -f docker/docker-compose.dev.yml --profile worker ps` 查看 `healthy / unhealthy`。
- Phase 7.13 起 `docker/Dockerfile.web` 已迁移到 Bun workspace + Next standalone 输出，`apps/web/next.config.ts` 使用 `output: 'standalone'` 和 monorepo tracing root。Phase 7.17 起 Docker Compose 全栈验收命令为 `docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin`；本地浏览器访问学习端 `http://127.0.0.1:3000`，管理员后台 `http://127.0.0.1:3100`，API `http://127.0.0.1:3001`。Compose server 默认允许 `http://localhost:3000`、`http://127.0.0.1:3000`、`http://localhost:3100` 和 `http://127.0.0.1:3100`，web 镜像默认 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001` 且 `NEXT_PUBLIC_ADMIN_CONSOLE_URL=http://127.0.0.1:3100`，避免 Docker 本机验收时 localhost / 127.0.0.1 cookie 与 CORS 混用。Compose dev 栈会设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 和 `AI_DEV_MODE_SWITCH_ENABLED=true`，让 standalone 容器内的 `/agent-trace` 仍可展示 Mock / Live 开关；生产部署不要设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true`。
- Swagger / OpenAPI 调试文档默认只在非 production 开启，入口为 `/api-docs` 和 `/api-docs-json`；production 默认关闭，`SWAGGER_ENABLED=true` 只适合受控环境、内网或临时诊断，且不放宽任何 `JwtAuthGuard`。Phase 7.5 起核心写接口补充中文说明和安全 request body 示例，便于本地调试与面试讲解。
- 真实模型验收必须同时设置 `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true`；默认 live 模型为 `deepseek-v4-flash`，并建议保留 `AI_MAX_INPUT_TOKENS=2500`、`AI_MAX_OUTPUT_TOKENS=1200` 预算上限。
- 本地开发可额外设置 `AI_DEV_MODE_SWITCH_ENABLED=true`，在 `/agent-trace` 调试台切换 mock / live；该开关默认仅非 production 可见。Docker Compose dev 的 Next standalone 容器因运行时 `NODE_ENV=production`，需要同时设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 才显示；该本地诊断开关不能用于生产，也不能绕过 `AI_ENABLE_LIVE_CALLS`、API key 或 live Chat 登录校验。
- AI 行为验收规范见 `docs/ai-behavior-acceptance.md`；mock 验工程链路，live 小样本验真实输出体验，fake embedding 不证明 RAG 语义命中质量。

推荐数据库连接：

```text
DATABASE_URL=postgresql://prepmind:devpass@127.0.0.1:5433/prepmind
```

env 文件均被 git 忽略，不提交密钥。

- Phase 7.23.6 起 `GET /operator-audit-exports` 与 `GET /operator-audit-exports/:id` 提供系统级 ADMIN 可见的证据包列表/详情，不按当前管理员过滤 requester；列表按 `createdAt desc, id desc` 使用复合稳定游标，并以每响应一次 `clock_timestamp()` 判断 `canDownload`。显式 mapper 与 shared strict response schema 保证 `objectKey`、`requestHash`、`processingToken`、`leaseExpiresAt`、payload、metadata、secret、token、cookie 等内部字段不会进入 DTO。`POST /operator-audit-exports/:id/download` 不使用 presigned URL；服务端生成安全文件名，返回 `application/zip`、`Cache-Control: no-store, private`、`Content-Disposition`、`Content-Length` 与 `X-Content-SHA256`，`StreamableFile` 是全局 JSON envelope 的明确例外。下载顺序固定为读取 export/数据库时间、打开 MinIO 流、核对 DB archiveSize 为正数且不超过配置上限并与 MinIO stat size 完全一致、strict 写入 `AUDIT_EXPORT_DOWNLOAD`、再返回流；size 不匹配或 strict 审计失败都会销毁已打开流，confirmed missing 才以 CAS 把 READY 标为 `FAILED/EXPORT_FILE_MISSING`。strict audit 失败、size mismatch 与 missing CAS 持久化失败只记录不含 raw error/objectKey/size 的固定 warning。成功下载审计只表示服务端已授权并准备流，不保证浏览器已经持久化全部字节。production gates 继续默认关闭。
- Phase 7.23.7 起 Admin Console `/audit` 使用可键盘操作的“审计记录 / 证据包”tabs，共享 action/status/target/actor 筛选作为申请默认条件。网络/5xx 仅在表单与继承筛选未变化时复用 `clientRequestId`；列表只在 QUEUED/PROCESSING 时轮询，READY 且 `canDownload` 才提供 authenticated Blob 下载与 hash 复制。临时 object URL 始终回收；1440×900 与 1024×768 的模拟验收及 Phase 7.23.8 Docker 真实后端/浏览器全链路均已通过。

## 模块边界

```text
web -> server（HTTP 调用，不直接 import）
server -> database, ai, fsrs, rag, agent, mcp, types
agent -> ai, fsrs, rag, mcp, types
rag -> database, ai, types
fsrs -> types
ai -> types
mcp -> ai, fsrs, rag, types
```

- `packages/` 禁止依赖 `apps/`。
- 同层 packages 禁止循环依赖。
- `@repo/types` 是前后端 API contract 的优先位置，使用 Zod 表达 schema；Swagger / OpenAPI 是 NestJS 调试和展示层，不反向驱动前端 contract。

## 代码约定

- TypeScript strict。
- Prettier：2 空格、单引号、分号、100 字符宽。
- 文件名 kebab-case，类名 PascalCase，变量 camelCase。
- 导入顺序：外部库 -> `@repo/*` -> 相对路径。
- NestJS 遵循 Controller -> Service -> Repository。
- 高频 SQL 查询必须建索引。
- 移动端优先，触摸目标不小于 44x44px。
- PWA 页面要考虑离线静态访问和主屏幕添加体验。

## 当前数据流

- 登录态权威来源：NestJS Auth API + PostgreSQL refresh token + httpOnly cookie。
- Refresh token 已启用 rotation 与 reuse detection；Auth 主链路不依赖 Redis。
- WrongQuestion / ChatMessage / OCRRecord 已迁移到 PostgreSQL，按当前 `userId` 隔离。
- WrongQuestionOrganizer：`WrongQuestionSubjectGroup` / `WrongQuestionDeck` / `WrongQuestionDeckItem` 是错题组织层，按当前 `userId` 隔离；一个错题同一时间只属于当前用户一个 organizer deck，不替代 WrongQuestion / Card / ReviewLog / ReviewTask 事实来源。
- Review：`/reviews` 已支持错题加入复习、学习统计和最近复习日志；`/review-tasks` 已支持今日复习任务、评分完成、跳过、恢复和未来复习计划预览；Card / ReviewLog / ReviewTask / ReviewPreference 以 PostgreSQL 为权威来源。
- `/review-preferences` 读写当前用户账号级复习计划偏好，包括每日分钟、每日卡片上限、提醒时间、提醒开关和计划窗口。
- `/review-tasks/plan` 是只读预览接口，基于 `Card.nextReview`、`Card.difficulty`、`Card.stability` 和 `ReviewPreference` 计算加权压力，不创建未来 `ReviewTask`。
- `/plan` 展示未来 7 / 14 天复习压力、容量状态、原因标签和偏好设置；`/stats` 使用客户端 ECharts 展示趋势、评分分布和卡片状态，避免 SSR hydration 风险。
- ReviewAgent / PlannerAgent：`GET /review-agent/suggestions` 基于当前用户 Card、ReviewLog、ReviewTask 计划、ReviewPreference 和错题组织数据生成只读建议；该接口不创建 `ReviewTask(source=PLANNER)`，不写 Card / ReviewLog / ReviewPreference / WrongQuestion / deck 数据，不进入 Dexie `mutationQueue`。
- MemoryAgent：`UserMemoryCandidate` / `UserMemory` 以 PostgreSQL 为权威来源；`POST /memory-agent/candidates/generate` 基于当前用户聊天偏好信号、错题薄弱点、复习日志和偏好生成去重候选，候选必须由用户在 `/profile` 确认后才成为 `ACTIVE` 记忆；`GET /user-memories`、`PATCH /user-memories/:id`、`DELETE /user-memories/:id` 支持查看、停用、恢复和删除。MemoryAgent 不调用真实模型，不写 Chat / Review / WrongQuestion 事实表，不进入 Dexie `mutationQueue`，当前不把记忆自动注入 `/api/chat`。
- Agent Trace：`AgentTraceRun` / `AgentTraceStep` 以 PostgreSQL 为权威来源；`/api/chat` 在有 access token 时 best-effort 写入脱敏 trace，写入失败只影响 `x-prepmind-agent-trace-recorded=false`，不打断流式回答；`/agent-traces` 是在线账号级 API，不进入 Dexie `mutationQueue`，不保存完整 prompt、完整回答、完整 RAG chunk 或 API key；`/agent-trace` 的成本看板只展示 token 与价格表推导出的估算成本。
- BackgroundJob：`BackgroundJob` 以 PostgreSQL 为权威来源；Phase 7.23.2 增加 `ACCOUNT / SYSTEM` scope 与数据库 CHECK，ACCOUNT 必须有 `userId` 并继续随用户级联删除，SYSTEM 必须 `userId=null` 并独立存活。`BackgroundJobsService` 的 create/find/count/update/list/summary，以及知识库 `DocumentProcessingJobService` 直接执行的 active count、create、active find 与 enqueue-failure update，全部显式限定 `scope=ACCOUNT`；required `userId: string` 签名与账号 DTO 不变，因此账号/知识库路径都不能误读或改写 SYSTEM job。`GET /background-jobs`、`GET /background-jobs/summary` 与 `GET /background-jobs/:id` 仍是经过 `JwtAuthGuard` 的账号级只读 API。
- Durable Outbox：`OutboxEvent` 以 PostgreSQL 为权威来源，用于持久化内部事件的脱敏 metadata、payload hash、幂等键、attempts、锁定信息和重试时间；`OutboxService` 提供 enqueue、claim、success、retry 和 dead-letter 状态机。Phase 7.9.1 只落地 outbox 地基，不替换 BullMQ、`BackgroundJob` 或 in-process `EventBus`，也不自动迁移现有事件发布点；payload 和 lastError 只能保存安全元数据或脱敏错误摘要，不得保存 API key、access token、refresh token、cookie、完整 prompt、完整 RAG chunk、完整模型回答或真实用户私有正文。
- Outbox Dispatcher：`OutboxDispatcherService` 负责 claim `OutboxEvent` 并分发到显式注册的 handler，成功后标记 `SUCCEEDED`，失败后复用 retry / dead-letter 状态机。既有 `knowledge.document.processing.requested` handler 仍只校验安全 metadata，不重投 BullMQ；Phase 7.23.3 新增 `operator.audit.export.requested` handler，严格校验仅含 `exportId/backgroundJobId` 的 payload 与 linked SYSTEM facts，并成为审计导出唯一 PostgreSQL -> Redis/BullMQ bridge。FAILED/EXPIRED export 终态 no-op，PROCESSING/READY + ACTIVE/SUCCEEDED 视为已交付，只有 QUEUED export + QUEUED SYSTEM job 可以检查既有 Bull job 后投递；其余状态组合按 invalid payload 进入 retry/dead-letter。`DocumentProcessingJobService` 原有 queue-first + best-effort observer 语义不变。
- Outbox Dispatcher Runner：`OutboxDispatcherRunnerService` 是 Outbox Dispatcher 的受控运行入口，只在 worker / both 角色且开关开启时运行；单进程内上一轮 tick 未完成时会跳过下一轮，tick 异常只记录脱敏 warning，不打断 worker 进程。production 默认关闭，避免部署后未经确认消费历史 outbox 事件。
- Outbox Summary / Metrics：`OutboxMetricsService` 读取系统级 `OutboxEvent` 状态计数、backlog、最老 pending 年龄和最近错误摘要，并接入 `GET /worker-observability/summary`；该 summary 只读且不返回 payload、完整 `lastError`、`aggregateId`、prompt、chunk、API key、token、cookie 或用户内容。`DEAD` outbox event 会让 worker observability status 进入 `degraded`，pending / processing backlog 会作为独立信号展示。
- Outbox Ops：`GET /outbox-events`、`GET /outbox-events/:id` 和 `POST /outbox-events/:id/requeue` 是受 `OUTBOX_OPS_ENABLED` 与 `JwtAuthGuard` 保护的后端诊断入口，用于本地开发和受控排障。列表与详情只暴露脱敏 DTO；详情中的 `lastErrorPreview` 复用扩展后的 `sanitizeJobError()` 并截断，不泄露常见 API key、access token、refresh token、cookie、`sk-...` key 或供应商 key。分页按 `updatedAt desc, id desc` 使用复合 cursor，避免只按 id 翻页导致漏数据。requeue 使用 `updateMany` 条件更新实现 compare-and-swap，只把 `FAILED / DEAD` 事件重置为 `PENDING`，清理锁与 processedAt，重置 attempts 和 nextRunAt，但不修改 payload、不立即执行 handler。
- Operator Audit：`OperatorAuditLog` 以 PostgreSQL 为权威来源，用于记录 operator/admin 诊断写操作的安全审计元数据。Phase 7.14.3 新增 `OUTBOX_REQUEUE` action、`OperatorAuditService` 和脱敏写入能力；Phase 7.14.4 已把 `POST /outbox-events/:id/requeue` 接入成功/失败审计；Phase 7.14.5 新增 `GET /operator-audit-logs` admin-only 脱敏查询 API；Phase 7.14.6 新增 `/operator-audit` 管理员审计台；Phase 7.20 新增脱敏详情。Phase 7.23.3 将 IP / User-Agent 指纹升级为配置 secret 驱动的 HMAC，并新增可接收 transaction/root Prisma client 的 `recordSuccessStrict()`：导出申请审计写失败会使整个申请事务回滚；现有 `recordSuccess/recordFailure` 仍捕获写入失败，因此 Outbox requeue audit 继续 best-effort。审计记录与查询仍不保存/返回 payload、metadata、原始 IP/User-Agent、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。
- Operator Audit Export：Phase 7.23.2 新增 strict Zod contract、`OperatorAuditExport` 和 singleton `OperatorAuditMaintenanceState`；Phase 7.23.3 新增 `POST /operator-audit-exports`。guard 顺序固定为 audit gate -> export gate -> JWT -> operator，export gate 关闭时认证前 404；shared Zod 失败在 controller 转为安全领域 400 `OPERATOR_AUDIT_EXPORT_INVALID_REQUEST`，strict request audit 失败回滚并返回安全 503 `OPERATOR_AUDIT_EXPORT_AUDIT_FAILED`。申请 service 使用数据库 advisory retention/quota locks 与 database clock，在 Serializable 事务内先处理 actor + clientRequestId 幂等，再校验 31 天/180 天/未来窗口和配额，依次写 Export、`scope=SYSTEM/userId=null` BackgroundJob、只含两个安全 id 的 OutboxEvent、strict `AUDIT_EXPORT_REQUEST`。由于首条 advisory lock 等待会固定 Serializable snapshot，整个无事务外副作用的 interactive transaction 只对 P2034/raw 40001/明确 export 幂等复合 P2002 做最多 5 次 bounded retry；normalized input 与预生成 UUID 跨 attempts 复用，每次 attempt 都重新开 Serializable 事务并重新取锁/DB clock。PostgreSQL commit 是 202 成功边界，API request path 不调用 `queue.add`；safe DTO 仍不返回 `objectKey`、`requestHash`、`processingToken`、payload 或 metadata。Phase 7.23.4 processor 只有在 `worker/both` 与 export/Dispatcher/maintenance 三 gate 全开时注册，本地与 Bull global concurrency 都固定为 1。双表状态仓库使用 database clock、processing token、续租和 CAS 同步迁移 Export 与 linked SYSTEM BackgroundJob；live lease、失败状态 CAS 数据库不确定和 READY reconciliation 不确定都通过 BullMQ `moveToDelayed + DelayedError` 延迟且不消耗失败 attempt。`markReady` commit-ACK ambiguity 下，只有 `READY + SUCCEEDED + 同 objectKey` 视为已提交；明确未选择才删除 attempt，不确定时保留。归档在只读 REPEATABLE READ 事务内按 `(createdAt,id)` 流式分页，生成 UTF-8 BOM/CRLF、固定 13 列且防公式注入的脱敏 CSV 与 manifest v1。Phase 7.23.5 将明文根目录收口到有容量上限的 `/tmp/prepmind-audit-exports`，未选 orphan 由维护与 48h lifecycle 回收。Phase 7.23.6 已完成 list/detail/download 与 fail-closed 下载审计，Phase 7.23.7 已完成证据包 Admin UI，Phase 7.23.8 已完成 Docker 真实下载/过期/清理闭环；production gates 保持关闭。
- Operator Audit Maintenance：Phase 7.23.5 新增每小时 strict `{schemaVersion:1}` BullMQ scheduler 与单并发 processor，仅在 `worker|both` 且 maintenance gate 显式开启时注册。processor 本地 `concurrency=1` 约束单进程消费，应用 bootstrap 同时把 maintenance queue 的 BullMQ global concurrency 固定为 1，约束跨 worker replica 的系统级并发；真实 Redis 双 Worker/双 job 阻塞测试证明第二个 job 保持 waiting、最大 active 为 1。每次运行先用 database clock 写 singleton `RUNNING`，再执行 24h READY 逻辑过期后的 MinIO selected object/prefix 清理与 CAS、FAILED/EXPIRED orphan 清理、DEAD 满 24h 的 `DELIVERY_ABANDONED` 双表终止、lease 过期且 Bull job 非 active 的 stale repair、180 天审计与终态 export metadata 分批删除，最后写 `SUCCEEDED/FAILED` 脱敏状态；不创建账号 BackgroundJob 或 OperatorAuditLog。审计每批最多 1,000、单次最多 20 批，每批新短事务重新取得 retention advisory lock、DB clock 与 `min(now-180d, oldest QUEUED/PROCESSING.startAt)` active-export 水位；真实 PostgreSQL 交错测试证明申请校验持锁后不会在 commit watermark 前被维护删除。PROCESSING orphan 清理始终保留当前 token 的 exact attempt key 与权威 objectKey，并在 list 后删除前重新读取 DB token/lease/status 与 Bull state；stale repair 的最终 CAS 同时限定 token、startedAt 与 lease cutoff。crash janitor 只删除严格目录 grammar、DB lease/token 已安全失效且 Bull job 非 active 的目录，绝不只按年龄删除。Readiness/Observability/CLI/Admin Worker 页保留 knowledge `checks.queue` 并新增 export queue、maintenance queue 与两小时 maintenance freshness；任一队列独立失败只产生安全信号，不泄露 Redis 连接信息。Local Compose 通过 `minio-init` 导入 `operator-audit-exports/` 2 天 expiration/noncurrent、1 天 incomplete multipart 和 delete-marker 规则，并用 192 MiB、0700 tmpfs 承载明文，为严格 `free > 2 * 64 MiB` preflight 留出余量；production versioned bucket 仍必须独立验 delete-marker 配置。
- Admin Console：Phase 7.16 新增独立桌面端 `apps/admin` / `@repo/admin`，默认端口 `3100`，本地命令为 `bun run dev:admin` 或 `bun --filter @repo/admin dev`；Phase 7.17 新增 Docker `admin` service，可通过 `docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin` 启动完整栈。第一版包含控制台、`/outbox`、`/audit` 和 `/worker` 页面，复用既有 admin-only API，不新增后端权限模型；Phase 7.19 起控制台读取真实 Worker / Outbox / Audit 摘要；Phase 7.20 起 `/audit` 支持列表 + 脱敏详情双栏；Phase 7.21 起 `/outbox` 与 `/audit` 使用后台自定义筛选控件替代原生 select，保留 label / combobox / listbox / option / keyboard 语义，Outbox requeue 前端要求填写 reason 并显式确认，切换事件或筛选条件时清空 reason，成功后继续刷新 outbox、audit 和 worker readiness。学习端保留移动端 `/operator-audit`，ADMIN 用户在移动端和桌面端侧边栏都会显示“后台管理”入口，默认跳到 `http://127.0.0.1:3100`，普通用户不可见；后台应用当前仍是桌面优先布局。后台前端只负责体验和引导，真正安全边界仍是后端 `JwtAuthGuard + OperatorGuard`。
- API / worker 进程边界：`SERVER_ROLE=api` 使用 Nest HTTP app，提供 REST API、`/health`、Swagger 和业务入口，但不消费 BullMQ；`SERVER_ROLE=worker` 使用 `NestFactory.createApplicationContext()`，只初始化模块和 BullMQ processor，不监听 HTTP 端口、不提供 `/health`；`SERVER_ROLE=both` 保留本地兼容模式。worker-only 的健康判断依赖进程存活、日志、BullMQ 和 BackgroundJob 状态。
- Worker Observability：`GET /worker-observability/summary` 经过 `JwtAuthGuard` 且受 `WORKER_OBSERVABILITY_ENABLED` 控制，默认只在非 production 开启；production 默认隐藏该接口，避免普通登录用户看到系统级队列和 worker 拓扑信号。该接口组合系统级 BullMQ `knowledge-document-processing` queue counts、Redis worker heartbeat 和账号级 `BackgroundJob` summary，输出 `healthy / degraded / attention / idle` 信号；queue counts 是系统级队列状态，BackgroundJob summary 是当前账号最近任务状态，两者语义不同但互补。heartbeat 只保存不含 hostname / pid 的 opaque worker id、role、队列名和 startedAt / lastSeenAt，不保存文件内容、prompt、RAG chunk、API key、token 或用户输入。`/knowledge` 页面在有资料或处理轮询时展示紧凑健康状态条；该能力只读，不进入 Dexie `mutationQueue`。
- Worker Readiness：`GET /worker-readiness` 和 `bun --filter @repo/server readiness:worker` 用于回答“当前 worker 链路能不能接生产流量 / 能不能作为部署 readiness 通过”。它和 `/health`、`/worker-observability/summary` 分工不同：`/health` 是 API 进程 liveness；`/worker-observability/summary` 是给开发者看的详细观测面；readiness 是机器友好的部署前结论。readiness 组合 Redis / BullMQ queue counts、worker heartbeat 和 outbox summary，输出 `ready / degraded / not_ready`。CLI 使用最小只读 module，不导入 `AppModule`，避免启动普通应用副作用；输出只包含安全摘要与 issues，不打印原始依赖错误、连接串、payload、prompt、chunk、API key、token 或 cookie。
- OpenAPI 调试文档：Phase 7.4 新增 Swagger / OpenAPI debug docs，`/api-docs` 和 `/api-docs-json` 默认在非 production 开启；production 默认关闭，显式 `SWAGGER_ENABLED=true` 只用于受控环境、内网或临时诊断。Phase 7.5 为注册、登录、知识库上传/替换/处理/检索、复习评分和 Agent Trace 写入补充中文描述与安全 request body 示例。Swagger 只描述和展示 REST API，不改变认证、鉴权或业务 contract；受保护接口仍必须经过 `JwtAuthGuard`。全局响应 envelope 语义为成功响应 `{ success, data, requestId }`，错误响应 `{ success, error, requestId }`；字段约束仍以 `@repo/types` Zod schema 为准。
- KnowledgeDedupAgent / KnowledgeOrganizerAgent：`GET /knowledge-agent/suggestions` 经过 `JwtAuthGuard`，按当前 `userId` 读取 `Document` 与每份资料最多少量 `Chunk` 摘要，生成重复资料、疑似新版、互补资料、集合和标签建议；该接口是在线只读建议，不写 Document / Chunk / 分类表，不自动合并、删除、替换、重命名或分类资料，不调用 live 模型，不进入 Dexie `mutationQueue`。
- RAG 文档 API：`/knowledge/documents` 已支持上传、列表、详情、删除和 `PUT /knowledge/documents/:id/file` 替换上传，`POST /knowledge/documents/:id/process` 已支持处理上传文档。
- RAG 文档去重与替换：普通上传会按当前用户 `contentHash` 返回已有同内容资料；替换上传会保留同一 `Document.id`、重置为 `PENDING`，并拒绝替换为其它资料卡片已有的相同内容。替换事务使用 `status + updatedAt + storageKey + contentHash` 做 compare-and-swap，成功后才删除旧 chunks；`PROCESSING` 中的资料禁止替换；并发处理或并发替换导致快照变化时返回 `KNOWLEDGE_DOCUMENT_PROCESSING`，只清理本次新上传对象，不删除旧对象。
- RAG 处理链路：支持 TXT / Markdown / DOCX / PDF 基础文本解析，使用 `@repo/rag` 段落感知分块；每个 chunk 入库前会写入 deterministic `metadata.safety`，用于标记 prompt injection、泄露密钥、隐藏行为、工具/数据写入等风险；embedding provider 已抽象，默认 OpenAI `text-embedding-3-small`，也支持阿里云百炼 / DashScope OpenAI-compatible `qwen` provider（如 `text-embedding-v4` + 业务空间 `/compatible-mode/v1` base URL）；本地开发和测试/e2e 可用 `RAG_EMBEDDING_PROVIDER=fake` 做无成本验收，production 禁止 fake provider。
- RAG 处理模式：`POST /knowledge/documents/:id/process` 默认 inline 同步执行，设置 `KNOWLEDGE_PROCESSING_MODE=queue` 后会创建 `BackgroundJob` 并投递 BullMQ，worker 继续复用同一套 document snapshot 校验和 chunk 写入流程；Redis 是 queue 处理链路的必需依赖，本地开发仍建议随 postgres / minio 一起启动。
- RAG 持久化：`Document` / `Chunk` 以 PostgreSQL + pgvector 为权威来源，`Chunk.embedding` 固定为 `vector(1536)` 并通过 raw SQL 持久化；写入前校验 document/user ownership。处理链路在 claim、清 chunk、写 chunk、标记 DONE / FAILED 时持续校验 `status=PROCESSING + storageKey + contentHash` 快照，chunk 替换事务使用 `SELECT ... FOR UPDATE` 锁定当前 Document 行，避免旧处理流污染新上传资料。
- RAG 状态边界：`Document` 状态流为 `PENDING -> PROCESSING -> DONE / FAILED`，空文本、零 chunk、解析/embedding 失败进入 `FAILED`；forced reprocess 会在同一 processing 快照下先清旧 chunks，避免 stale retrieval。
- RAG 检索 API：`POST /knowledge/search` 已升级为 Hybrid Retrieval：先生成 query embedding，再召回 pgvector cosine vector candidates 和 PostgreSQL full-text keyword candidates，按 `chunkId` 去重融合并输出 `0..1` final score；仍只检索当前用户 `DONE` 文档 chunks，并在命中结果中返回 chunk metadata、safety metadata 和轻量 `metadata.retrieval` 调试信息。Phase 7.8.2 第一版不新增 GIN 索引、不引入外部搜索引擎、不接 reranker。
- RAG Eval：Phase 7.8.1 新增固定检索评估集和纯函数 runner，用于在 Hybrid Retrieval / reranker / Query Rewrite 前后对比 `recall@k`、`top1Accuracy`、`safetyPassRate` 和 `noHitPassRate`；默认测试不调用真实模型、不写数据库、不保存真实用户资料或密钥。fake eval 只证明工程回归，真实语义质量仍需 Qwen / OpenAI 等真实 embedding smoke 验收。
- RAG Eval Smoke：Phase 7.8.3 新增 `bun --filter @repo/server smoke:rag-eval` 本地脚本，串联注册、上传合成 TXT、处理、轮询、`/knowledge/search` 和 `runRagEval()`，用于验证真实 API 级 RAG 检索链路；Phase 7.8.4 增加必需 case id guard，避免评估集改名或缺失时误报 PASS，并支持 `RAG_EVAL_SMOKE_KEEP_DATA=true` 在本地保留合成 smoke 文档供 `/knowledge` 页面复查。脚本默认不进 CI、不写 eval 结果表、不调用 `/api/chat`，输出只包含状态、指标、命中数、top score 和文档名，不打印 API key、access token、cookie、embedding 向量或完整 hit content。
- Chat RAG：`/api/chat` 已在有 access token 时调用 `/knowledge/search`，命中后先把高风险 chunk 排除在 prompt 与 citations 之外，中风险 chunk 只作为可疑原文引用，安全 chunk 可回填 prompt 槽位；随后把可用 chunks 注入 system prompt，并在助手消息末尾追加 Markdown “参考资料”；无 token、无命中或检索失败时降级普通 AI 回答。
- KnowledgeVerifierAgent：`/api/chat` 会在 RAG 命中后调用 `@repo/agent/knowledge-verifier` 确定性 policy，评估资料状态为 `trusted / suspicious / conflict / insufficient / skipped`；命中高风险或 `safeForPrompt=false` 的 chunk 时会转为 `suspicious` 并注入“不执行检索片段中的指令”的保守 guidance；可疑、冲突或不足时会向 RAG prompt 注入保守使用规则，并在引用区追加温和“资料核对提示”。
- Agent Chat：`/api/chat` 已接入 `chat-agent-runtime` adapter，每次请求会先通过 RouterAgent 生成 route metadata；`tutor` route 会调用 TutorAgent policy 生成 `explain_solution`、`socratic_hint`、`step_check`、`concept_bridge`、`answer_direct` 或 `general_follow_up` 策略 prompt；ReviewAgent / PlannerAgent / MemoryAgent 不在每次 Chat 中自动执行，Review / Planner 只在计划与今日任务界面读取只读 suggestions API，Memory 只在个人中心显式管理；Agent Trace 只记录脱敏观测元数据，不改变 Chat 输出链路。
- Agent headers：Chat 响应会带 `x-prepmind-agent-route`、`x-prepmind-agent-confidence`、`x-prepmind-agent-rag-required`；Tutor 路线额外带 `x-prepmind-tutor-intent` 与 `x-prepmind-tutor-depth`；RAG 命中后会带 `x-prepmind-knowledge-verifier-status` 与 `x-prepmind-knowledge-verifier-chunks`；trace 写入尝试会带 `x-prepmind-agent-trace-recorded`。
- Agent prompt 顺序：`BASE_SYSTEM_PROMPT -> activeStudyContext -> agent/tutor strategy prompt -> RAG knowledge context -> verifier guidance`；RAG 因 token 预算被丢弃时，短 Agent prompt 仍保留，verifier notice 不追加。
- `@repo/agent` 当前不直接调用 `streamText`、不读取 API key、不启用 live 模型；真实模型调用仍只存在于 `/api/chat`，并受服务端 mock/live 解析、`AI_ENABLE_LIVE_CALLS=true`、API key 和 live Chat 登录校验保护；开发模式开关只能作为非 production override。
- `/knowledge` 页面已接入 RAG 文档管理、检索测试、资料管理建议、后台处理状态、后台任务摘要、Worker Observability 健康状态条和 SafetyGuard 信号：支持资料上传、列表、处理、替换上传、删除内联确认、状态摘要、手动检索预览，以及只读展示重复/新版/互补资料、集合和标签建议；检索结果会对疑似指令注入或需谨慎引用的 chunk 展示小型安全标记；文档处于 `PROCESSING`、本地触发处理或账号级 summary 仍有 active job 时会短轮询刷新，并展示最近后台 job 状态、后台任务摘要和 worker 在线/队列积压提示，静态 `PENDING` 不无限轮询；资料上传、替换、处理或删除后会失效刷新 knowledge agent suggestions；资料卡片操作使用右上角三点菜单，点击页面其它区域可收起菜单，`DONE` 资料不再展示主按钮式重新处理；该页面为在线能力，不进入 Dexie `mutationQueue`。
- `/error-book` 已升级为学科优先入口：错题首页展示学科卡片，学科内展示专题 deck，专题内展示错题列表；专题支持重命名，详情弹层、备注、掌握状态、删除确认和加入复习保持原有 CRUD 能力。
- Organizer API：`GET /wrong-question-groups`、`GET /wrong-question-groups/:subjectGroupId/decks`、`GET /wrong-question-decks/:deckId/questions`、`POST /wrong-question-organizer/organize/:wrongQuestionId`、`POST /wrong-question-organizer/organize-batch`、`PATCH /wrong-question-decks/:deckId`、`POST /wrong-question-decks/:deckId/items`、`DELETE /wrong-question-decks/:deckId/items/:wrongQuestionId`。
- Organizer API 是在线组织能力，不进入 Dexie `mutationQueue`；创建错题后的自动整理为非阻塞流程，整理失败不影响错题保存。
- ReviewTask 评分支持 `clientMutationId` 幂等；重复提交同一评分命令不会重复写入 `ReviewLog`。
- Dexie 继续作为本地快速恢复、离线兜底、乐观更新和旧图片预览层。
- WrongQuestion / OCRRecord / ReviewTask rating 写失败进入 Dexie `mutationQueue`，在 session 恢复、online、focus 时自动补偿同步。
- 今日任务页会展示本地待同步评分；离线评分不本地推进 FSRS、ReviewLog 或统计，仍以服务端同步成功为准。
- ChatMessage 不进入通用 mutation queue，继续使用 `/chat-messages/sync` 的会话快照幂等同步。
- Chat live 流式结束后会等待短稳定窗口并校验 assistant 内容；若最后仍是 user 或 assistant 为空，不写 Dexie、不同步服务端，并提示“本次回答没有成功生成，请重试”。
- `/chat-messages/sync` 后端会拒绝不完整会话快照，非空快照必须以非空 `ASSISTANT` 消息收尾，防止前端兜底失效时污染 PostgreSQL。
- 新 OCR 图片通过 `/uploads/images` 上传到 MinIO；`/ocr-records` 与 `/wrong-questions` 不接收 `data:` base64 图片。
- `/api/chat` 与 `/api/ocr` 仍由 Next.js API Route 代理 AI 服务；`/api/chat` 默认使用本地 mock 流式响应，只有显式 live 双开关开启后才调用外部模型，live 默认模型为 `deepseek-v4-flash`。
- `/api/chat` 已加入上下文窗口、active OCR 题目上下文预算和输出 token 上限；有效 OCR 题目会生成 `activeStudyContext` 供后续追问承接。
- Chat / OCR 流式输出使用渐进 Markdown 渲染；展示格式化不回写 OCR 原始内容和 `activeStudyContext`。
- 今日任务轻手账与学习偏好仍是 userId scoped localStorage 数据，不进入 mutation queue，也暂不注入 prompt。
- 今日复习卡来自 `/review-tasks/today`，不存入 localStorage；轻手账 checklist 仍保存在 localStorage。

详细数据流见 `docs/data-flow.md`。

## 当前注意事项

- Docker PostgreSQL 使用 `5433 -> 5432` 映射，避免与 Windows 本地 PostgreSQL 冲突。
- Docker 默认保留：未经用户明确授权，不执行 `docker system prune`、`docker compose down -v`，不删除容器、镜像、volume、PostgreSQL 或 MinIO 数据；验收只精确清理本次合成账号/记录和隔离浏览器 storage。
- 启动项目做真实浏览器验收时，默认使用 headed 浏览器并把窗口保持可见，让用户可以同步观察；headless 只作为自动化补充，不能替代明确要求的可见验收。
- 开发环境 CORS 允许 `localhost`、`127.0.0.1` 和私有局域网地址动态端口。
- PostgreSQL 需要 pgvector：`CREATE EXTENSION IF NOT EXISTS vector;`。
- `packages/fsrs` 保持纯算法包，不依赖数据库。
- Phase 7 已完成至 Phase 7.23.8：审计证据包 contract、可靠投递、Worker、维护、查询/下载 API、Admin UI 和 Docker 真实全链路均已验收。Compose 的 server 默认是纯 `api`，独立 worker 独占 Dispatcher/export/maintenance processor；worker 以 `1001:1001` 运行并挂载 `201326592,mode=0700,uid=1001,gid=1001` tmpfs，避免重复消费和 crash janitor 权限错误。
- Phase 7.23.8 的为什么 / 怎么做：202 只证明 PostgreSQL 申请 facts 已提交，不能证明 Outbox、BullMQ、MinIO、ZIP 字节、下载审计和维护删除协作正确；因此新增需要 ADMIN/STUDENT token 的确定性 smoke，真实验证 403 权限矩阵、READY ZIP/headers/SHA、精确归档内容、REQUEST/DOWNLOAD audit、到期 410 和对象删除，并默认精确清理合成数据。Local Compose 的 `minio-init` 导入 2 天 lifecycle 作为异常兜底；24 小时逻辑失效和小时物理清理由应用负责。
- Phase 7.23 的安全边界不变：production gates 默认关闭，不使用 presigned URL，不把 objectKey、payload、metadata、token 或原始来源暴露给客户端；SHA-256 只证明完整性，不是数字签名或不可抵赖；HMAC 来源指纹仍是可关联数据，不是匿名数据；证据包是工程上一致的观察结果，不是法律级数据库快照。
- Phase 7.23.4 的为什么 / 怎么做：BullMQ lock 只能约束 Redis delivery，不能阻止失去 lock/lease 的旧进程继续执行 PostgreSQL 或 MinIO 副作用；因此 Worker 对 Export 与 linked SYSTEM BackgroundJob 使用同一事务的 token CAS，上传对象也把 token 编入 attempt key，最终只由数据库当前 token 选择 object key。审计查询在只读 REPEATABLE READ 快照内先 count 再按复合 keyset 流式导出；CSV 先脱敏、在清理控制字符前检测公式前缀，再由成熟 CSV/ZIP 库完成 quoting 与归档。live lease 使用 `DelayedError` 延迟而不消耗失败 attempt，本地明文与未被选择的 attempt object 都在 best-effort cleanup 中收口。
- 回顾时可以问：“processing token 如何阻止失去 lease 的旧 Worker 覆盖新证据包？”
- Phase 7.23.3 的为什么 / 怎么做：若 API 同时 commit PostgreSQL 再直接 enqueue Redis，任一侧失败都会留下不可恢复的双写窗口；因此申请只在一个 Serializable 事务内写四份 PostgreSQL facts，Outbox Dispatcher 再以确定性 Bull job id 跨到 Redis。request audit fail-closed/strict，Outbox requeue audit 仍 best-effort。真实 PostgreSQL e2e 使用 blocker transaction 和 `pg_locks/pg_stat_activity` 条件轮询，覆盖同 hash 去重、不同请求双成功、只剩一个 active slot 时恰好一成一拒；三场景均实际捕获 Prisma P2034 且 bounded retry 后 facts/配额正确，无任意长 sleep。
- 回顾时可以问：“事务型 Outbox 如何消除 PostgreSQL 成功但 Redis enqueue 失败的双写窗口？”、“为什么 Serializable + advisory lock 仍需要 bounded whole-transaction retry？”、“为什么申请审计必须 strict，而 Outbox requeue audit 仍保持 best-effort？”、“领域 400/503 如何避免 Zod issues 或原始数据库错误泄露？”
- 从 Phase 7.6 起，新建 docs / blogs / plans / specs 文件名优先使用语义化名称，不再加日期前缀；历史带日期文件暂不批量重命名，避免破坏已有引用。
- 向量索引用 raw SQL 创建，Prisma 不直接支持向量索引。

## 下一步

后续最优先：

1. Phase 6.9.4.3 后续：从最新已推送 `main` 开始新的 Router / Verifier controlled-Live paired eval；先核对共享 diagnostics、Live 双开关与 pricing，若失败只记录 `providerFailureCategory` 和既有安全计数，不记录 raw status、URL、body、headers、error 或 credentials，也不盲目重试。
2. 只有新 run 达到 28 次 strict success，且 complete Live 证据同时通过质量、安全、延迟与成本门槛后，才能标记 Phase 6.9.4.3 完成并讨论 Router / Verifier enablement；当前 production 继续 deterministic。
3. 下一会话可直接问：`请从最新已推送 main 开始新的 Phase 6.9.4.3 controlled-Live paired eval；先核对 diagnostics 与双开关，若失败只记录 providerFailureCategory，不记录 raw error。`
4. Phase 6.9 完成后进入 Phase 8 性能/PWA，再进入 Phase 9 MCP Tool 体系；《多 Agent 架构—记忆系统》面试学习博客仍待整个真实模型/记忆阶段完成后编写，本次 diagnostics 文档任务不包含该博客。
5. 回顾时可以问：Phase 6.9.4.3 为什么保留两次 incomplete evidence、为什么不能拼接成功 case、为什么分类不改变 `usage_unverifiable`，以及 scope one-shot 如何封闭 replay？
