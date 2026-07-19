# PrepMind AI — 仓库协作指南

PrepMind AI 是移动端优先的 Web + PWA 智能备考助手。Phase 7 核心工程化已完成；Phase 7.8.5 RAG runtime parity 已完成真实 Docker 验收。当前先完成 Phase 6.9 全部真实模型 Agent 架构、通信、权限、可执行 LangGraph 与生产验收，再进入 Phase 6.10 分层记忆补强；随后进入 Phase 8 性能与 PWA、Phase 9 MCP Tool 体系。

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
| Phase 6.9.4.3 | 验收未完成 | JSON-mode 完整 Live 已完成；28/28、72/72 通过但 Router P95 延迟失败，当时结论为 terminal deterministic fallback |
| Phase 6.9.4.4 | 已完成 | Router/Verifier 混合生产接入；Task 10 已合并 main 并完成静态、Docker、真实模型、可见浏览器、Trace 价格与精确清理复验 |
| Phase 6.9.5 | 验收未完成 | V9 唯一 Live 已完成并因质量门失败封存；产品 gate 默认关闭，Docker/浏览器验收与 main 合并均未进入 |
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
| Phase 7.8.5  | 已完成 | RAG runtime parity、Qwen `text-embedding-v4` / 1536、provider-aware fail-closed、queue/hybrid smoke 3/3 真实验收 |
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
| Agent / RAG / MCP | LangGraph, Qwen `text-embedding-v4` / 1536, pgvector + PostgreSQL full-text, MCP JSON-RPC    |
| Infra             | Docker, MinIO, Sentry, OpenTelemetry, Prometheus, Grafana                                    |

Agent 目标框架使用 LangGraph，不使用 AutoGen；当前仓库只有 graph descriptor 与分散的 policy/service orchestration，尚未完成可执行 `StateGraph`。
Phase 6 是多 Agent 协作亮点阶段：当前已完成 Agent Runtime 地基、RouterAgent 到 Chat 的轻量接入、TutorAgent 策略层、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent、MemoryAgent、Agent Trace 可观测闭环，以及 KnowledgeDedupAgent / KnowledgeOrganizerAgent 资料管理建议。Router / Verifier 已完成模型/规则混合的生产验收，但默认 gate 已恢复关闭；`TutorAgent`、`WrongQuestionOrganizerAgent`、`MemoryAgent`、`KnowledgeDedupAgent` 与 `KnowledgeOrganizerAgent` 仍是确定性 policy。Review / Planner 已具备受限只读模型 candidate；V1--V9 是只读历史，V9 唯一 controlled-Live 以 `quality_gate_failed` 封存：`23` provider attempts、`22` paired admissions、quality `30/48`、semantic `4/22`、critical `2`，但 P95、usage、cost 通过。没有 success seal，独立 V9 eval gate 与两条 Review/Planner 产品 gate 均缺省关闭，因此当前项目仍只返回确定性建议，不能称为 Review/Planner 真实模型可用。Tutor 负责讲题意图和 prompt 策略，Verifier 只在 RAG 命中后评估资料可信度，WrongQuestionOrganizer 只给错题学科组与专题 deck 建议，Review / Planner 只基于当前用户错题、复习日志、复习计划和偏好生成只读学习建议，Memory 只生成长期记忆候选并等待用户确认，KnowledgeDedup / KnowledgeOrganizer 只基于当前用户资料元数据和少量 chunk 摘要给出重复、新版、互补、集合与标签建议。最终流式输出仍由 `/api/chat` 的既有 mock/live 链路负责；错题组织由 NestJS organizer API 写入独立组织层；复习计划建议由 `/review-agent/suggestions` 读取并展示，不创建未来 `ReviewTask`；长期记忆由 `/memory-agent` 与 `/user-memories` API 管理，不自动注入每次 Chat；资料管理建议由 `/knowledge-agent/suggestions` 读取并在 `/knowledge` 展示，不自动合并、删除、替换、重命名或分类资料。facts、FSRS、分钟数、链接、写库与权限始终由本地权威代码决定。Agent Trace 由 `/agent-traces` 在线账号级 API 持久化脱敏后的路由、步骤、token 和估算成本元数据，`/agent-trace` 提供调试台；它不保存完整 prompt、完整回答、完整 RAG chunk 或 API key，成本看板只展示估算值，不替代模型供应商账单。

2026-07-15 的后续权威路线覆盖 12 个受治理组件：11 个当前逻辑节点 `RouterAgent`、`TutorAgent`、`RetrieverAgent`、`KnowledgeVerifierAgent`、`FinalResponseAgent`、`WrongQuestionOrganizerAgent`、`ReviewAgent`、`PlannerAgent`、`MemoryAgent`、`KnowledgeDedupAgent`、`KnowledgeOrganizerAgent`，以及待实现的 `Tool-Using Orchestrator`。当前 `createAgentGraph()` 仍只是 descriptor；Retriever/FinalResponse 主要隐含在 RAG/Chat 链路，Orchestrator 尚未实现。目标路径为：Router、Tutor、Verifier、WrongQuestionOrganizer、Retriever 使用模型/规则混合；Review、Planner、KnowledgeDedup、KnowledgeOrganizer、FinalResponse、Memory 候选提取与 Orchestrator 必须有真实模型参与。权限、安全、事实计算、schema、预算、人审和写库保持本地权威。必须先完成全部 Agent 架构，再进入 Phase 6.10 记忆注入与 Episodic Memory。完整设计见 `docs/superpowers/specs/2026-07-15-phase-6-9-agent-architecture-completion-design.md`。

Phase 6.9.1 已建立统一评测 contract 和 `phase-6.9-seed-v1`：Router、Verifier、Memory 各 8 个可执行 deterministic case，Orchestrator 8 个 expectation-only case。当前 baseline 为 21/24，通过率 87.5%，并发现 MemoryAgent 会把含示例 API key 的“以后请记住”误提取为偏好候选这一 critical failure。该阶段不调用真实模型、不修饰 baseline 结果；这是早期四类 seed 的历史范围，不代表最终治理范围。后续所有模型化/混合 Agent 都必须有职责匹配的 baseline、Mock、controlled-Live、降级、权限、延迟和成本证据。

Phase 6.9.2 已在 `@repo/ai` 建立共享 `ModelAgentRuntime`：Mock 与 Live 共用 Zod schema、请求/结果、不可变 run budget 和安全 Trace contract；调用前按请求最大输出量预留预算，避免并发重入超卖。`@repo/ai` 不读取环境变量，API key 与 base URL 只由 composition root 传入 OpenAI-compatible executor closure；runtime 结果和 Trace 不返回完整 prompt、完整模型输出、provider 原始错误、API key、base URL 或 stack。调用方仍需先权威解析 live 双开关，runtime 再检查 `liveCallsEnabled`。

Phase 6.9.3.3 已把滚动摘要接入 `POST /conversation-context/prepare`：达到 12 条未覆盖消息或 summary + 未覆盖窗口达到 `maxInputTokens` 70% 时触发；水位只停在最新完整 assistant 消息，user-only tail 永不覆盖。摘要源仅允许 USER/ASSISTANT，provider 前会脱敏 bearer/cookie、裸 provider key、client secret/password 与 PEM 私钥，credential-like 输出与越界 usage 均不持久化。模型调用严格位于事务外；事务内以 Serializable snapshot 复核目标范围 source hash，并以 `summaryVersion + coveredThroughOrder` CAS 推进单行摘要。

Phase 6.9.3.4 已把 Web request 的 `conversationId`、authenticated prepare、分层 assembler 与 Dexie v9 恢复接入 `/api/chat`。首轮没有 conversationId 时跳过 prepare，服务端 sync 返回 id 后第二轮才调用；live auth 始终先于 prepare。prepare 仅在 token + id 同时存在时执行，默认 10 秒且限定 1~15 秒，向下传播 request abort，网络/timeout/5xx/schema 失败只返回固定 degraded 元数据且不阻断 Mock Chat。assembler 固定保留 base/latest user，独立装配 agent guidance、untrusted state guidance、OCR、完整 recent turns、safe RAG 与 summary；agent/state 合计最多 10% 且分别观测，optional layer 不会制造 413，RAG 整层 drop 时同步清空引用，summary 只在确有 history dropped 时考虑。headers 与 Trace 只含状态、版本、固定 drop code 和 token 计数，不含 summary/prompt/chunk 正文。PostgreSQL 仍是 state/summary 权威源，Redis 是服务端 cache，Dexie v9 只保存当前用户可恢复的 sanitized `activeGoal/activeQuestionId`、版本与有效期；写入按用户串行、版本单调、过期/跨用户/登出 fail-safe，不保存 summary、tool、proposal、prompt 或 token，也不凭 question id 伪造 OCR。

Phase 6.9.3.5 已完成 Docker Mock 与受控 Live 收口。Mock API/浏览器覆盖 12 条触发、复用、多用户、CAS/stale、Dexie 白名单和 Trace；Live 使用 `deepseek-v4-flash` 生成 `conversation-summary-v1`，summary version/watermark 为 `1/15`，provider-reported summary usage 为 `2246/154`，最终 Chat 保留二次函数判别式目标与正确值 `1`。DeepSeek structured output 通过共享 executor 固定 `mode: 'json'`，仍由 Zod strict schema、预算、超时与双开关约束。Trace 只新增 `layerTokens=m/a/s/o/r/k/y` 计数。验收后恢复 Mock，严格清理 7 个合成账号、4 个会话、级联 summary/state/cache 与测试浏览器 storage；详细证据见 `docs/acceptance/2026-07-11-phase-6-9-3-conversation-memory.md`。下一任务是 Phase 6.9.4 Router/Verifier 混合路径。

Phase 6.9.4.1 已固定 `phase-6.9-router-verifier-v1`：Router 60 条覆盖 36 个高置信、16 个歧义、8 个安全边界 case；Verifier 40 条覆盖 trusted/insufficient/complex conflict/stale/prompt injection。deterministic baseline 为 74/100、critical failure 2；Router overall 75%、歧义 macro-F1 52.47%、高置信 86.11%、权限边界 80%，Verifier overall 72.5%、复杂冲突 recall 0%、注入放行 0。该结果不修饰、不启用模型路径；该阶段随后进入 Phase 6.9.4.2 Mock candidate contract。证据见 `docs/acceptance/phase-6-9-4-1-router-verifier-baseline.md`。

Phase 6.9.4.2 已实现 Router / Verifier Mock candidate contract，但尚未接入生产 Chat，也未调用真实模型。Router ineligible 与 safety case 均为零 runtime invoke，safety 固定回到本地 safe chat，权限只由 canonical route map 重建；Verifier 对 prompt injection、high-risk 或 `safeForPrompt=false` 证据整批零调用阻断，使用 literal `evidenceCodes` 的 strict discriminated union、稳定 chunk 排序，并在失败时保留限制性 deterministic 状态、把 trusted 收紧为 suspicious。schema、budget、timeout、abort 和 runtime contract 失败均安全降级；hostile getter/proxy/signal、runtime 预算污染和 telemetry unavailable 按 fail-closed 处理，provider-reported input usage 不会被工程估算误当作硬上限。预算使用隔离 snapshot，telemetry 不可验证时按 preview budget 记账以阻止重试超卖。Envelope/Trace 不含 prompt、query/chunk、provider output/raw error 或 credential 正文。该阶段完成时为 `Enabled=no`、`Reason=paired_candidate_not_run`；Mock 只证明工程 contract，不证明语义质量。证据见 `docs/acceptance/phase-6-9-4-2-router-verifier-mock-candidate.md`；其后由 Phase 6.9.4.3 执行 same-case deterministic / Mock / controlled-Live paired eval。

Phase 6.9.4.3 的同 case paired eval 工程、Mock 验收、共享 provider diagnostics、400-token headroom、五次不可拼接 Live 证据、strict-tool 历史实验、JSON-mode resolution 零网络 checkpoint 与唯一一次完整 JSON-mode controlled-Live 均已完成，但阶段验收仍未完成。历史 Attempt D/E 不可与新 run 拼接；新 run 为 `28/28 strict success`、`72/72 zero-call`，Verifier `quality_gate_passed`，Router `latency_budget_exceeded`（additional P95 `4264ms`），因此 Router terminal fallback 为 deterministic。

当前零网络 checkpoint 将新的 controlled-Live 收敛到标准 DeepSeek JSON Output：精确 `https://api.deepseek.com`、`response_format: { type: 'json_object' }`，不发送 tools/tool_choice/json_schema。Provider 只保证合法 JSON，canonical Zod 仍是结构、长度、关联约束与安全语义的最终权威。新 evidence 固定 runner-v3 + `deepseek_json_object_v1` + `phase-6.9.4.3-json-mode-v1`，并强制 runner、顶层 promptVersion 与所有 candidate entry promptVersion 一致；历史 runner v1/v2 只读兼容，Mock 禁止携带 Live transport 字段。预算、10 秒超时、`maxRetries=0`、zero-call gate、usage/cost provenance 和最早 Live preflight 顺序保持不变。

Fresh gates 为 AI 151 passed、Agent 345 passed、typecheck/lint exit 0；deterministic baseline 仍为 74/100、critical=2；fresh Mock 为 complete，`caseEntries/runtimeInvocations/providerAttempts/strictSuccesses/zeroCallCases = 100/28/0/28/72`；唯一 JSON-mode Live 为 complete、`28/28/72`，Router 因 additional P95 `4264ms` 关闭，Verifier paired decision 通过。这是 Phase 6.9.4.3 当时的生产结论与历史证据，不改写也不再拼接；它不再表示永久禁止 Router 模型。后续 Phase 6.9.4.4 已完成高置信/安全 zero-call、歧义 Router 真实模型、semantic-needed Verifier 与 deterministic fallback 的生产接入并恢复默认关闭。证据见 `docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md`。

Phase 6.9.4.4 Task 8 已补齐 Docker Web runtime 配置与运维文档：Router 对安全边界和高置信请求保持 deterministic zero-call，只对歧义、多意图或上下文指代请求调用真实模型；Verifier 只对已通过本地安全门、确需语义判断的 RAG 证据调用模型。两者 gate 可独立回滚，默认均为 `false`；Router / Verifier timeout 分别为 5 秒 / 4 秒，共享单请求预算固定 `maxCalls=2`、`maxInputTokens=2400`、`maxOutputTokens=800`。Provider 使用 JSON-object mode，但 canonical Zod 仍负责结构与安全语义；prompt injection、high-risk、credential material 在 provider 前零调用。失败、timeout、schema invalid 或预算耗尽只回退到限制性 deterministic 结果；Trace / headers 只暴露固定状态、reason code、usage 与降级元数据，不含 prompt、query、chunk、provider output、credential 或 raw error。Task 9 完成 controlled-Live、Docker、可见浏览器验收前，两条 gate 必须保持默认关闭。权威路线见 `docs/superpowers/specs/2026-07-15-phase-6-9-agent-architecture-completion-design.md`；这只完成 Router/Verifier 子阶段配置，不代表 Memory、Orchestrator、全部 Agent 或 Phase 6 已完成。

Phase 6.9.4.4 已完成。Task 9 的 Harness Router/Verifier 5/5 均为 `candidate_applied`；可见 Docker 浏览器保留两次 `study_plan` Router 约 5 秒 timeout 的限制性 fallback，同时以不同类别 contextual-reference 样本取得 `candidate_applied / tutor / 3262ms / 289+177 tokens`。Task 10 已在 `main` merge commit `b58e8d5` 复验：Router contextual reference 为 `candidate_applied / 4048ms / 295+240 tokens`，Verifier conflict 为 `candidate_applied / 2618ms / 536+186 tokens`，injection 在 provider 前 `safety_blocked / 0-call`；新的 `deepseek-v4-flash` Trace 显示 `pricingKnown=true` 和 `0.000389 USD` token 估算。Server 737 passed / 2 skipped、Web 407/407、lint/build/typecheck 与 Compose 均通过；Docker 已恢复 Mock/default-off，各轮 synthetic PostgreSQL/Redis/浏览器数据均清理为 0。成功与 timeout 必须并列保留。Admin 本轮未改源码；其镜像重建受 Prisma 官方二进制外部网络失败阻断，现有容器仍 200。证据见 `docs/acceptance/2026-07-14-phase-6-9-4-4-router-verifier-production.md`。

Phase 6.9.5 已完成 ReviewAgent / PlannerAgent 的受限只读候选、owner-scoped server composition、独立预算/超时/安全降级、固定 Mock、受控诊断、Docker 环境边界和前端安全状态的工程准备。本地 merger 始终重建用户 facts、FSRS、分钟数、链接和全部写权限；模型只能选择 snapshot 中的弱点索引、计划 block 排序和策略枚举。v1--v4 都在各自一次 provider attempt 后以 `invalid_attempted / structured_output` 关闭，v3/v4 仅在独立 evidence 中记录 `structuredOutputStage=provider_json_parse`；v5 使用与生产候选一致的 `deepseek-v4-pro` JSON-object executor，同样在唯一 canary 后关闭为 `invalid_attempted / closed / providerAttemptCount=1 / usageKnown=false / structured_output`。V6 唯一获批 canary 已封存为 `state=finalized / status=invalid_attempted / gate=closed / providerAttemptCount=1 / usageKnown=false / diagnosticCode=usage_unverifiable`。这六条计数不可合并、不得重跑，且不构成 quality pass、zero-call、零成本或生产可用性证明。V6 的 48-case/Docker/浏览器/main 复验与推送均未执行；独立 V7 的终态见下一段，不能把它写成 V6 retry。`REVIEW_AGENT_MODEL_ENABLED=false` 与 `PLANNER_AGENT_MODEL_ENABLED=false` 继续是默认生产状态，项目仍返回确定性只读建议。证据见 `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`。

2026-07-17 的离线可信度补强把评测数据集升级为 `phase-6.9-review-planner-v2`：26 条 zero-call 必须实际穿过 candidate 安全、资格、预算或 abort guard，runtime counter 为 0 才能标记 `zeroCallVerified=true`；22 条 runtime fixture 覆盖不同诊断、索引、策略和排序。live provider 只有同时返回正安全整数 input/output usage 才可成功；缺失、非法或 `0/0` usage 固定 fail-closed 为 `PROVIDER_ERROR / invalid_response`，保留预留预算并回退。Review/Planner Trace 仅在成功、usage 可验证、定价表完整时写已知估算成本，未知情况不得显示零成本成功。该补强不改写 v1--v5 evidence/marker；V6 transport 的 reasoning detail 也永不从 aggregate output token 中扣除。两个业务 gate 继续默认 `false`。

2026-07-17 的 DeepSeek V4 Pro v5 CLI 已执行其唯一一次 provider canary，证据封存为 `invalid_attempted / closed / 1 / false / structured_output`；因此 v5 48-case、Docker、浏览器、main 合并和推送均未执行，v5 marker 不得重跑。V6 是独立的 non-thinking lineage：Task 1--6 完成后已在用户明确授权下执行其唯一 canary，evidence/marker 已封存为 `invalid_attempted / closed / 1 / false / usage_unverifiable`。V1--V5 hash 已复核且没有改写；V6 也不得重跑，两个业务 gate 保持 `false`，且不得以 V5、Qwen、Mock 或 Docker 成功替代自己的质量结论。

2026-07-18 已在用户授权下执行唯一 V7 controlled-Live。运行前 preflight 与 `deepseek-v4-pro / deepseek-v1 / nonthinking JSON / 4500ms`、CNY 1.00 hard cap、V1--V6 `18 entries / 9f8cc9a7d5ba83d630fa5806f19aaa74066352de92bb04631813c17feaa230ba` 全部匹配，两个产品 gate 固定为 `false`。终态为 `finalized / invalid_attempted / closed / providerAttemptCount=23 / usageKnown=false / evidence_io`；once marker 已消费，目录无 success seal、JSON 无 token/cost。最窄可证边界是：全部 23 个允许的 provider attempts 被安全计数后，paired-result/orchestration failure 或 evidence finalization/history I/O failure 被折叠为 `evidence_io`；现有脱敏终态无法再唯一定位。V7 不可重跑，不得进入 Docker/浏览器/main/push，不得声称 provider 质量通过、零成本或 Review/Planner 真实模型可用。

2026-07-18 已冻结独立 V8 completion 设计：使用零字节、固定枚举、append-only、exclusive-create stage markers，V1--V7 immutable snapshot、全新 confirmation/eval gate/evidence/success seal 和原有 48/26/22 质量预算；V8 不修改或复用 V7。只有 V8 committed Live success 后才允许按 Review-only -> default-off -> Planner-only -> default-off 顺序重建 Nest `server`，完成 authenticated API、`/plan`、`/today`、Trace、owner isolation 与只读事实验收。已消费的 V8 paired lineage 不在 main 重跑；main 只复验 committed evidence、静态门与受预算约束的产品路径。完整设计见 `docs/superpowers/specs/phase-6-9-5-v8-stage-diagnostics-completion-design.md`。

2026-07-18 V8 离线工程已收口到 `faa97a8`：durable stage/evidence、DeepSeek V4 Pro non-thinking factory/CLI、server-only product admission、branch/main durable slot/usage ledger、recovery-only 路径和真实 Docker/API/Prisma/可见 Chrome composition 均已按 TDD 实现。最终离线门为 Server `1265 passed / 30 skipped`、Review E2E `3/3`、Web `409/409`，Windows I/O/V8 evidence/product ledger native、Agent/AI/types、Server/Web lint/build、Compose `config --quiet` 与 `git diff --check` 全部 exit 0；contract/security 与 acceptance/operations 最终复审无未关闭 Critical/Important。

随后执行的唯一 V8 controlled-Live 已关闭：CLI safe stdout 为 `invalid_attempted / closed / 23 / false / invalid_response`；durable prefix 到 `.stage-080-paired-returned`，没有 `.stage-090-report-validated` 或 success seal。落盘 231-byte 文件仍是 provisional `state=attempted / 0 / false / transport`，public reader 进一步投影为 `invalid_attempted / closed / 0 / false / evidence_io / lastStage=.stage-080-paired-returned`。因此只有 CLI stdout 支撑 23 次计数，落盘文件不提供 durable provider/quality/usage/cost 结论；两个 0 都不得解释为 zero-call。V1--V7 仍为 20 entries / tree hash `6078891e6c962bc5c8e57471017d7f64e210c5f4ffd867c96136e33983ac2bd6`。V8 不可重跑，两个产品 gate 仍为 `false`，不得进入 branch/main 产品验收。

2026-07-19 的 V9 Task 1--5 离线收口没有重跑或改写 V1--V8。V9 新增独立 aggregate gate diagnostics、durable evidence、一次性 CLI 和 product authority。随后唯一 V9 controlled-Live 在根 `.env` 显式注入后运行：预检前一次 `preflight_invalid` 为零调用、零 reservation、零 once、零 evidence；实际运行创建 V9 once/evidence，完成 `23` provider attempts、`22` paired admissions、`26` verified zero-call、`48` strict successes，却以 `quality_gate_failed` 封存。quality 为 `30/48`，semantic 为 `4/22`，critical 为 `2`；P95 `1396ms`、usage `7943/510`、CNY `0.026889/1.00` 及其余 gates 均通过。V9 不可重跑；没有 success seal，独立 V9 eval gate 与两条 Review/Planner 产品 gate 仍缺省关闭，产品继续 deterministic。

2026-07-19 的 V10 是对 V9 质量 contract 的最小修复，尚未执行 controlled-Live：模型只返回产品实际合并的 `focusIndexes`（Review）或 `blockOrder`（Planner），本地仍拥有 owner、facts、FSRS、分钟数、链接、写权限和最终只读结果。V1--V9 保持 immutable；fresh manifest 为 `36` entries / `61a6e4a956784a59a8b8639d4c94d6fd870bce5dd8549a026abf02a0e7cb769d`，V10 evidence directory、once marker 与 success seal 均不存在。离线门已通过但不构成 Live：V10/V8/V9/composition Jest `266/266`、Agent `409/409` 与 typecheck、server lint/build、V10 native `3/3`、`git diff --check`。唯一命令只能从根目录以 `bun --env-file=.env` 注入凭据（绝不改写 `.env`）并在独立进程中开启 V10 eval gate；V8/V9 eval gate 和两条产品 gate 必须显式 `false`。配置固定为 `deepseek-v4-pro`、JSON-object non-thinking、`4500ms`、`23/22` 上限和 CNY `1.00` hard cap。V10 writer/reader 只能发布 strict safe lane aggregate，拒绝 prompt、snapshot、model output、raw error、URL、credential、cookie、stack 及 per-case timing/usage；任何失败都封存 V10 且不得进入 Docker、浏览器、main 或 push。详情见 `docs/acceptance/phase-6-9-5-review-planner-v10-offline-checkpoint.md`。

V9 product authority 只接受 `finalized / complete / closed / passed`、`providerCount=23`、`pairedAdmissionCount=22` 与 lowercase 64-hex evidence SHA-256；还要求完整 V9 leaf 集合全部以 ordinary `H` 被 Git 精确跟踪，并在 authority 读取前后保持 leaf、commit、branch、clean 状态一致。pending、`evidence_io`、未知 profile、非法 hash、assume-unchanged、skip-worktree、缺失/额外 leaf 或漂移都在 ledger、Prisma、Docker、浏览器之前 fail-closed；没有 legacy V8 reader 或 `git show` 回退。

离线证据为：V9 focused `136/136`；Server `1381 passed / 30 skipped`；Review E2E `3/3`；Web `409/409`；AI `190/190`；Agent `406/406`；shared types typecheck exit 0；Review/Planner Windows native 按各自正确 cwd 合计 `133/133`（V5/V6 的 cwd 约束属于命令入口契约，不是代码失败）；product acceptance `131/131`；lint/build/Compose/diff 均 exit 0；contract/security 复审 PASS 且无未关闭 Critical/Important。这些只证明 V9 离线工程边界，不是 Live、provider quality、Docker 产品验收或 Phase 6.9.5 完成证据。

2026-07-15 已修复在线 Agent Trace 成本表与默认 Live 模型脱节：`deepseek-v4-flash` 采用受控 Live 评测已记录的非缓存 USD 价格快照，新的 Trace 会写入非零估算与 `pricingKnown=true`；未知模型仍 fail-safe 显示“未配置单价”，旧 Trace 不回填，避免伪造历史成本。成本仅为 token 估算，不替代供应商账单；价格变更必须连同集中表、测试和 `docs/ai-behavior-acceptance.md` 一起提交。

下一会话可以问：“请从 V10 offline checkpoint 开始，先独立复审并确认唯一 controlled-Live 的进程级 gates；不得改写 V1--V9、`.env` 或提前进入产品验收。”

## 常用命令

本仓库使用 Bun workspace。Windows 本机开发优先使用 Bun，Docker PostgreSQL 固定宿主机端口 `5433`。

```powershell
bun install

$env:POSTGRES_PORT='5433'
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d postgres redis minio

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
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

RAG queue / Docker 验收必须在宿主环境显式设置 `KNOWLEDGE_PROCESSING_MODE=queue`；真实 embedding 使用 `RAG_EMBEDDING_PROVIDER=qwen`、`RAG_EMBEDDING_MODEL=text-embedding-v4`、`RAG_EMBEDDING_DIMENSIONS=1536`、无凭据的 HTTPS `RAG_EMBEDDING_BASE_URL` 与规范 `QWEN_API_KEY`。Compose CLI 必须显式使用 `--env-file .env` 做 `${...}` 插值；这不是 service `env_file`，server/worker 仍只收到 Compose `environment` 明列的 allowlist。静态校验只运行 `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker config --quiet`，不输出可能含凭据的完整解析配置。

若 Docker Desktop 多服务 Bake 会话报 gRPC shared-key 非打印字符错误，只在当前 PowerShell 会话设置 `$env:COMPOSE_BAKE='false'`，分别 `build server` / `build worker`，再对精确服务列表执行 `up -d --no-build`。不要通过清理 build cache、container 或 volume 排障，禁止 `down -v`；完整命令见 `docs/dev-start.md`。

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
- 知识库处理默认 `KNOWLEDGE_PROCESSING_MODE=inline`，业务处理不投递 BullMQ；需要验证 BullMQ 时必须显式设置 `KNOWLEDGE_PROCESSING_MODE=queue`、`REDIS_URL=redis://127.0.0.1:6379`，不得依赖隐式默认。`SERVER_ROLE=api` 只启动 HTTP API 且不注册 worker processor；`SERVER_ROLE=worker` 只创建 Nest application context、不监听 HTTP 端口并注册 worker processor；`SERVER_ROLE=both` 用于本地一体化开发，HTTP 与 worker 同进程。当前 NestJS 仍会初始化 BullMQ 模块，本地开发建议继续启动 redis。Phase 7.7 起 worker / both 角色会通过 BullMQ Redis 连接写入短 TTL heartbeat，默认 `WORKER_HEARTBEAT_INTERVAL_MS=15000`、`WORKER_HEARTBEAT_TTL_SECONDS=45`，用于 `/worker-observability/summary` 和 `/knowledge` 健康状态条判断 worker 最近是否在线。`WORKER_OBSERVABILITY_ENABLED` 默认非 production 开启、production 关闭；production 仅适合受控内网或临时诊断显式开启。
- RAG 真实 embedding 的当前标准路径是 Qwen `text-embedding-v4`，固定 1536 维。production 必须显式提供 provider 和 model；Qwen 还必须提供不含 username/password/query/hash 的 HTTPS base URL 与规范 `QWEN_API_KEY`。provider、model、base URL 或匹配凭据缺失时 fail-closed，不在 Qwen/OpenAI/fake 之间自动 fallback。`Qwen_API_KEY` / `DASHSCOPE_API_KEY` 只作为宿主兼容输入，Docker server/worker 内部统一规范化为 `QWEN_API_KEY`；两者使用同一组 RAG runtime allowlist。`fake` 仅允许非 production 本地开发和自动测试。
- Phase 7.9.3 起 `OutboxDispatcherRunnerService` 会在 `SERVER_ROLE=worker | both` 且 `OUTBOX_DISPATCHER_ENABLED=true` 时按固定间隔调用 `OutboxDispatcherService.dispatchBatch()`；非 production 默认开启，production 默认关闭，生产环境需要显式设置 `OUTBOX_DISPATCHER_ENABLED=true`。可用 `OUTBOX_DISPATCHER_INTERVAL_MS`、`OUTBOX_DISPATCHER_BATCH_SIZE` 和 `OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS` 控制 tick 间隔、批大小和锁超时。runner 不读取 outbox payload、不绕过 handler registry、不新增 HTTP API 或前端 UI。
- Phase 7.10 起 `OUTBOX_OPS_ENABLED` 控制后端 Outbox Ops 诊断入口；默认非 production 开启、production 关闭。`GET /outbox-events`、`GET /outbox-events/:id` 与 `POST /outbox-events/:id/requeue` 经过 feature gate 和 `JwtAuthGuard`，feature gate 排在认证前，关闭时隐藏为 404。接口只返回脱敏状态、attempts、时间戳、payloadHash、错误码和脱敏错误预览，不返回 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。requeue 只允许 `FAILED / DEAD -> PENDING`，不直接执行 handler，不支持删除、强制成功、跳过、payload 编辑或直接 dispatch。
- Phase 7.14.5 起 `OPERATOR_AUDIT_ENABLED` 控制 Operator Audit 查询入口；默认非 production 开启、production 关闭。`GET /operator-audit-logs` 和 Phase 7.20 新增的 `GET /operator-audit-logs/:id` 都经过 feature gate、`JwtAuthGuard` 和 `OperatorGuard`，关闭时在认证前隐藏为 404。接口只返回脱敏审计列表 / 详情，不返回 `metadata`、outbox payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、access token、refresh token、cookie、原始 IP 或原始 User-Agent。Phase 7.14.6 起前端新增 `/operator-audit` 管理员审计台；管理员会在侧边栏看到“审计”入口，普通用户不显示入口且页面不会主动请求审计 API，真正安全边界仍以后端 guard 为准。
- Phase 7.23.2 起新增审计导出配置地基，但 `OPERATOR_AUDIT_EXPORT_ENABLED` 与 `OPERATOR_AUDIT_MAINTENANCE_ENABLED` 在所有环境都默认 `false`。已固定 180 天审计保留、24 小时导出 TTL、31 天范围、50,000 条记录、64 MiB archive、每管理员 2 个 active / 每小时 10 次、全局 10 个 active、单并发、600 秒 BullMQ lock、300 秒 lease、3600 秒 stale、24 小时投递恢复窗口和 120 秒查询 timeout；worker / both 角色只有在 export、maintenance 与 Outbox Dispatcher 三个 gate 都显式开启时才注册 export processor。processor 本地 concurrency 固定为 1，bootstrap 先设置 BullMQ queue global concurrency=1 再启动 paused Worker，配置拒绝大于 1。production 只要显式开启 `OPERATOR_AUDIT_ENABLED`、`OUTBOX_OPS_ENABLED` 或 `OPERATOR_AUDIT_EXPORT_ENABLED` 任一审计读取/写入/导出路径，就必须提供 trim 后至少 32 字符的 `OPERATOR_AUDIT_FINGERPRINT_SECRET`；非 production 使用至少 32 字符的明确本地 fallback 且禁止记录该值。Phase 7.23.3 起 IP / User-Agent 来源指纹使用该 secret 计算 `hmac-sha256:<64 hex>`，不得记录 secret 或原始来源值；Phase 7.23.5 起 ZIP processor 与保留维护均已实现且 gates 仍默认关闭，Phase 7.23.6 ~ 7.23.8 已补齐查询、下载、Admin UI 与真实 Docker 验收。
- Phase 7.15 起本地 Docker dev compose 会显式开启 `OUTBOX_OPS_ENABLED`、`OPERATOR_AUDIT_ENABLED`、`WORKER_READINESS_ENABLED` 和 `WORKER_OBSERVABILITY_ENABLED`，因为 server 镜像运行态是 `NODE_ENV=production`，不能依赖非 production 默认值来打开诊断入口。Phase 7.23.2 因此只在 `docker/docker-compose.dev.yml` 的 server service 增加可由宿主环境覆盖的 `OPERATOR_AUDIT_FINGERPRINT_SECRET=${OPERATOR_AUDIT_FINGERPRINT_SECRET:-local-dev-audit-fingerprint-change-me}`，避免本地 dev 栈因新生产校验无法启动；该 fallback 不写入 `Dockerfile.server` 的 `ARG / ENV`。真实 production 必须独立提供至少 32 字符的 secret，严禁复用此 local fallback。Next dev 配置允许 `127.0.0.1` 作为 dev origin，避免按本地文档访问 `127.0.0.1:3000` 时只看到 SSR 页面但 React 表单事件未 hydration。真实验收已覆盖管理员 / 普通用户前后端权限、`/operator-audit` 页面、审计 API 和 Outbox requeue 审计写入。
- Phase 7.11 起 `WORKER_READINESS_ENABLED` 控制 worker readiness 诊断入口；默认非 production 开启、production 关闭。`GET /worker-readiness` 经过 feature gate 和 `JwtAuthGuard`，关闭时在认证前隐藏为 404。该接口面向机器和部署检查，只返回安全的 Redis / BullMQ queue / worker heartbeat / outbox readiness 摘要，不返回 payload、prompt、chunk、API key、token、cookie 或用户正文。CLI 命令为 `bun --filter @repo/server readiness:worker`，使用最小只读 Nest module，不导入 `AppModule`，不启动 HTTP API、worker processor、heartbeat 或 outbox dispatcher；异常或超时退出码为 2，not ready / degraded 退出码为 1，ready 退出码为 0。
- Phase 7.12 起 Docker Compose `worker` service 接入容器级 healthcheck，容器内使用 runner 构建产物命令 `bun apps/server/dist/scripts/worker-readiness.js`，不依赖本机 Bun workspace CLI。server 镜像会保留根 `node_modules`、`apps/server/node_modules` 和 `packages`，保证 Bun workspace 依赖与 `@repo/*` 包在容器运行时可解析。`WORKER_READINESS_CLI_TIMEOUT_MS` 默认 `5000`，healthcheck 默认 `interval=30s`、`timeout=10s`、`retries=3`、`start_period=30s`。本地可用 `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker ps` 查看 `healthy / unhealthy`。
- Phase 7.13 起 `docker/Dockerfile.web` 已迁移到 Bun workspace + Next standalone 输出，`apps/web/next.config.ts` 使用 `output: 'standalone'` 和 monorepo tracing root。Phase 7.17 起 Docker Compose 全栈验收命令为 `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin`；本地浏览器访问学习端 `http://127.0.0.1:3000`，管理员后台 `http://127.0.0.1:3100`，API `http://127.0.0.1:3001`。Compose server 默认允许 `http://localhost:3000`、`http://127.0.0.1:3000`、`http://localhost:3100` 和 `http://127.0.0.1:3100`，web 镜像默认 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001` 且 `NEXT_PUBLIC_ADMIN_CONSOLE_URL=http://127.0.0.1:3100`，避免 Docker 本机验收时 localhost / 127.0.0.1 cookie 与 CORS 混用。Compose dev 栈会设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 和 `AI_DEV_MODE_SWITCH_ENABLED=true`，让 standalone 容器内的 `/agent-trace` 仍可展示 Mock / Live 开关；生产部署不要设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true`。
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
- MemoryAgent：`UserMemoryCandidate` / `UserMemory` 以 PostgreSQL 为权威来源；`POST /memory-agent/candidates/generate` 基于当前用户聊天偏好信号、错题薄弱点、复习日志和偏好生成去重候选，候选必须由用户在 `/profile` 确认后才成为 `ACTIVE` 记忆；`GET /user-memories`、`PATCH /user-memories/:id`、`DELETE /user-memories/:id` 支持查看、停用、恢复和删除。当前实现不调用真实模型、不写 Chat / Review / WrongQuestion 事实表、不进入 Dexie `mutationQueue`，也不把记忆自动注入 `/api/chat`；Phase 6.9.9 只增加受控真实模型候选提取，记忆注入与 Episodic Memory 延后至全部 Agent 完成后的 Phase 6.10。
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
- Admin Console：Phase 7.16 新增独立桌面端 `apps/admin` / `@repo/admin`，默认端口 `3100`，本地命令为 `bun run dev:admin` 或 `bun --filter @repo/admin dev`；Phase 7.17 新增 Docker `admin` service，可通过 `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin` 启动完整栈。第一版包含控制台、`/outbox`、`/audit` 和 `/worker` 页面，复用既有 admin-only API，不新增后端权限模型；Phase 7.19 起控制台读取真实 Worker / Outbox / Audit 摘要；Phase 7.20 起 `/audit` 支持列表 + 脱敏详情双栏；Phase 7.21 起 `/outbox` 与 `/audit` 使用后台自定义筛选控件替代原生 select，保留 label / combobox / listbox / option / keyboard 语义，Outbox requeue 前端要求填写 reason 并显式确认，切换事件或筛选条件时清空 reason，成功后继续刷新 outbox、audit 和 worker readiness。学习端保留移动端 `/operator-audit`，ADMIN 用户在移动端和桌面端侧边栏都会显示“后台管理”入口，默认跳到 `http://127.0.0.1:3100`，普通用户不可见；后台应用当前仍是桌面优先布局。后台前端只负责体验和引导，真正安全边界仍是后端 `JwtAuthGuard + OperatorGuard`。
- API / worker 进程边界：`SERVER_ROLE=api` 使用 Nest HTTP app，提供 REST API、`/health`、Swagger 和业务入口，但不消费 BullMQ；`SERVER_ROLE=worker` 使用 `NestFactory.createApplicationContext()`，只初始化模块和 BullMQ processor，不监听 HTTP 端口、不提供 `/health`；`SERVER_ROLE=both` 保留本地兼容模式。worker-only 的健康判断依赖进程存活、日志、BullMQ 和 BackgroundJob 状态。
- Worker Observability：`GET /worker-observability/summary` 经过 `JwtAuthGuard` 且受 `WORKER_OBSERVABILITY_ENABLED` 控制，默认只在非 production 开启；production 默认隐藏该接口，避免普通登录用户看到系统级队列和 worker 拓扑信号。该接口组合系统级 BullMQ `knowledge-document-processing` queue counts、Redis worker heartbeat 和账号级 `BackgroundJob` summary，输出 `healthy / degraded / attention / idle` 信号；queue counts 是系统级队列状态，BackgroundJob summary 是当前账号最近任务状态，两者语义不同但互补。heartbeat 只保存不含 hostname / pid 的 opaque worker id、role、队列名和 startedAt / lastSeenAt，不保存文件内容、prompt、RAG chunk、API key、token 或用户输入。`/knowledge` 页面在有资料或处理轮询时展示紧凑健康状态条；该能力只读，不进入 Dexie `mutationQueue`。
- Worker Readiness：`GET /worker-readiness` 和 `bun --filter @repo/server readiness:worker` 用于回答“当前 worker 链路能不能接生产流量 / 能不能作为部署 readiness 通过”。它和 `/health`、`/worker-observability/summary` 分工不同：`/health` 是 API 进程 liveness；`/worker-observability/summary` 是给开发者看的详细观测面；readiness 是机器友好的部署前结论。readiness 组合 Redis / BullMQ queue counts、worker heartbeat 和 outbox summary，输出 `ready / degraded / not_ready`。CLI 使用最小只读 module，不导入 `AppModule`，避免启动普通应用副作用；输出只包含安全摘要与 issues，不打印原始依赖错误、连接串、payload、prompt、chunk、API key、token 或 cookie。
- OpenAPI 调试文档：Phase 7.4 新增 Swagger / OpenAPI debug docs，`/api-docs` 和 `/api-docs-json` 默认在非 production 开启；production 默认关闭，显式 `SWAGGER_ENABLED=true` 只用于受控环境、内网或临时诊断。Phase 7.5 为注册、登录、知识库上传/替换/处理/检索、复习评分和 Agent Trace 写入补充中文描述与安全 request body 示例。Swagger 只描述和展示 REST API，不改变认证、鉴权或业务 contract；受保护接口仍必须经过 `JwtAuthGuard`。全局响应 envelope 语义为成功响应 `{ success, data, requestId }`，错误响应 `{ success, error, requestId }`；字段约束仍以 `@repo/types` Zod schema 为准。
- KnowledgeDedupAgent / KnowledgeOrganizerAgent：`GET /knowledge-agent/suggestions` 经过 `JwtAuthGuard`，按当前 `userId` 读取 `Document` 与每份资料最多少量 `Chunk` 摘要，生成重复资料、疑似新版、互补资料、集合和标签建议；当前实现是 deterministic 在线只读建议。Phase 6.9.6 必须增加 embedding + 真实模型语义判断，但仍不写 Document / Chunk / 分类表，不自动合并、删除、替换、重命名或分类资料，不进入 Dexie `mutationQueue`。
- RAG 文档 API：`/knowledge/documents` 已支持上传、列表、详情、删除和 `PUT /knowledge/documents/:id/file` 替换上传，`POST /knowledge/documents/:id/process` 已支持处理上传文档。
- RAG 文档去重与替换：普通上传会按当前用户 `contentHash` 返回已有同内容资料；替换上传会保留同一 `Document.id`、重置为 `PENDING`，并拒绝替换为其它资料卡片已有的相同内容。替换事务使用 `status + updatedAt + storageKey + contentHash` 做 compare-and-swap，成功后才删除旧 chunks；`PROCESSING` 中的资料禁止替换；并发处理或并发替换导致快照变化时返回 `KNOWLEDGE_DOCUMENT_PROCESSING`，只清理本次新上传对象，不删除旧对象。
- RAG 处理链路：支持 TXT / Markdown / DOCX / PDF 基础文本解析，使用 `@repo/rag` 段落感知分块；每个 chunk 入库前会写入 deterministic `metadata.safety`，用于标记 prompt injection、泄露密钥、隐藏行为、工具/数据写入等风险。当前真实 embedding 标准路径为 Qwen `text-embedding-v4` / 1536；production 配置 provider-aware fail-closed，不做 provider fallback，`fake` 仅用于非 production 测试。
- RAG 处理模式：`POST /knowledge/documents/:id/process` 默认 inline 同步执行，设置 `KNOWLEDGE_PROCESSING_MODE=queue` 后会创建 `BackgroundJob` 并投递 BullMQ，worker 继续复用同一套 document snapshot 校验和 chunk 写入流程；Redis 是 queue 处理链路的必需依赖，本地开发仍建议随 postgres / minio 一起启动。
- RAG 持久化：`Document` / `Chunk` 以 PostgreSQL + pgvector 为权威来源，`Chunk.embedding` 固定为 `vector(1536)` 并通过 raw SQL 持久化；写入前校验 document/user ownership。处理链路在 claim、清 chunk、写 chunk、标记 DONE / FAILED 时持续校验 `status=PROCESSING + storageKey + contentHash` 快照，chunk 替换事务使用 `SELECT ... FOR UPDATE` 锁定当前 Document 行，避免旧处理流污染新上传资料。
- RAG 状态边界：`Document` 状态流为 `PENDING -> PROCESSING -> DONE / FAILED`，空文本、零 chunk、解析/embedding 失败进入 `FAILED`；forced reprocess 会在同一 processing 快照下先清旧 chunks，避免 stale retrieval。
- RAG 检索 API：`POST /knowledge/search` 已升级为 Hybrid Retrieval：先生成 query embedding，再召回 pgvector cosine vector candidates 和 PostgreSQL full-text keyword candidates，按 `chunkId` 去重后做 hybrid rank 并输出 `0..1` final score；仍只检索当前用户 `DONE` 文档 chunks，并在命中结果中返回 chunk metadata、safety metadata 和轻量 `metadata.retrieval.{vectorScore,keywordScore}` 调试信息。当前无 reranker，不引入外部搜索引擎。
- RAG Eval：Phase 7.8.1 新增固定检索评估集和纯函数 runner，用于在 Hybrid Retrieval / reranker / Query Rewrite 前后对比 `recall@k`、`top1Accuracy`、`safetyPassRate` 和 `noHitPassRate`；默认测试不调用真实模型、不写数据库、不保存真实用户资料或密钥。fake eval 只证明工程回归；当前真实语义质量标准验收必须使用 Qwen `text-embedding-v4` / 1536，不得通过 provider fallback 获得结论。
- RAG Eval Smoke：`bun --filter @repo/server smoke:rag-eval` 当前强制 queue 处理路径，必须轮询到 `BackgroundJob=SUCCEEDED`，并校验每个命中都有 `keywordScore` / `vectorScore`、`mode=hybrid`、同一 case 无重复 `chunkId`；缺失任一证据即 fail-closed。`RAG_EVAL_SMOKE_KEEP_DATA=true` 仅用于本地复查合成文档。脚本默认不进 CI、不写 eval 结果表、不调用 `/api/chat`，不打印 API key、access token、cookie、embedding 向量或完整 hit content。Phase 7.8.5 真实 Docker 验收已以 Qwen `text-embedding-v4` / 1536 完成 3/3，queue `BackgroundJob=SUCCEEDED`，三项缺配置启动检查均在 provider 调用前 fail-closed；证据见 `docs/acceptance/2026-07-14-rag-runtime-parity.md`。
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
- Docker 默认保留：未经用户明确授权，禁止执行 `docker system prune`、`docker compose down -v`、volume 删除、数据库 reset、Redis `FLUSHDB` / `FLUSHALL` 或 MinIO wipe；不删除容器、镜像、volume、PostgreSQL、Redis 或 MinIO 数据。验收只精确清理本次合成账号/记录、合成对象和隔离浏览器 storage。
- 启动项目做真实浏览器验收时，默认使用 headed 浏览器并把窗口保持可见，让用户可以同步观察；headless 只作为自动化补充，不能替代明确要求的可见验收。
- 开发环境 CORS 允许 `localhost`、`127.0.0.1` 和私有局域网地址动态端口。
- PostgreSQL 需要 pgvector：`CREATE EXTENSION IF NOT EXISTS vector;`。
- `packages/fsrs` 保持纯算法包，不依赖数据库。
- Phase 7 核心工程化里程碑已推进至 Phase 7.23.8：审计证据包 contract、可靠投递、Worker、维护、查询/下载 API、Admin UI 和该链路 Docker 真实验收已完成；Phase 7.8.5 RAG runtime parity 补强也已完成真实 Docker 验收。Compose 的 server 默认是纯 `api`，独立 worker 独占 Dispatcher/export/maintenance processor；worker 以 `1001:1001` 运行并挂载 `201326592,mode=0700,uid=1001,gid=1001` tmpfs，避免重复消费和 crash janitor 权限错误。
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

1. Phase 6.9.4.4 已在 main 完成：Mock、controlled-Live、Docker、Router/Verifier 可见浏览器、注入零调用、Trace 价格、RAG internal parity 与精确清理均有 evidence；生产 gate 已恢复默认关闭。
2. V1--V9 保持只读历史；V9 唯一 Live 已以 `quality_gate_failed` 封存，故 V9 committed success 不成立，Review/Planner 产品 gate 默认关闭，产品验收被阻断。先完成最小质量修复的新 lineage，不能重跑或改写历史。
3. 后续按 Phase 6.9.5～6.9.10 依次完成 Review/Planner、KnowledgeDedup/Organizer、Tutor/WrongQuestionOrganizer、Retriever/FinalResponse、MemoryAgent 候选提取和 MCP-ready Orchestrator；不得提前进入记忆注入或 Episodic Memory。
4. 全部 Agent 架构完成后进入 Phase 6.10 分层记忆，再进入 Phase 8 性能/PWA 与 Phase 9 MCP Tool 体系。
5. 未来分别编写《多 Agent 架构》和《记忆系统》两篇面试学习博客，具体题目与结构由用户届时确认。
6. 下一会话可直接问：`请复核 V9 offline checkpoint 与 Live 授权前提；保持产品 gate 关闭，不得改写 V1--V8 或提前进入产品验收。`
