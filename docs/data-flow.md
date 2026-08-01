# PrepMind AI 数据流

> 当前版本：2026-08-02。Phase 7 核心工程化与 Phase 7.8.5 RAG runtime parity 已完成真实 Docker 验收。Router/Verifier、Review/Planner 与 Phase 6.9.6 Knowledge Agents 的生产验收均已完成并恢复默认关闭，失败历史保持不可变。Phase 6.9.7 V1--V9 Live 均以 `quality_gate_failed` 封存且不得重跑。V9 R0--R4 已完成本地合法 option selection、Provider-like/security/stale/write-authority robustness、独立 runner/lineage/durability 与 reviewed Mock/full checkpoint；唯一 R5 run `c530ca02...` 为 `24/24` guard、wire `2/2/0/0`、strict `0/48`，Tutor 在 response 前 `provider_runtime / transport`，Organizer sibling `post_dispatch_abort`，正式 semantic/P95/token/CNY 全 `null`。Artifact 已 seal、validator 通过且无 recovery claim；产品 Docker/API/browser、main 与后续阶段仍被阻断。
>
> 用户随后决定停止整套 Vn 重试并进入独立 Architecture Recovery。R1/R2/R3、proxy preflight、Provider Canary V2 D0/C1/C2/S1/L1、P1/G1/G2/S2、唯一 L2 与 P2/F1/F2/S3 均已按独立边界完成。唯一 L3 run `2b0ac3a0-631f-4c7f-9781-ce0cda94149a` 已走完整 admission、真实 `deepseek_network` runner 与 runtime publication：24 guards 保持 zero-call，22 条 runtime lane 收到 response，21 条完成 strict/usage；`tutor-v2-runtime-11` 的 schema failure 打开 breaker，剩余 26 lane 未启动。终态为 `full_gate_quality_gate_failed / qualityAuthority=none`，semantic/P95/token/CNY 全 `null`，journal `296` 条、validator `ok=true`、无 recovery claim。R3/L1/L2/L3 不得重跑；产品/main 与后续阶段继续阻断。

## 1. 当前边界

- 登录态权威来源：NestJS Auth API + PostgreSQL refresh token + httpOnly cookie。
- 业务数据权威来源：WrongQuestion、ChatMessage、OCRRecord 均已迁移到 PostgreSQL。
- 错题组织层职责：`WrongQuestionSubjectGroup` / `WrongQuestionDeck` / `WrongQuestionDeckItem` 只负责学科卡片、专题 deck 和错题归属视图，不替代 WrongQuestion / Card / ReviewLog / ReviewTask 事实来源。
- 本地缓存职责：Dexie 负责快速恢复、离线兜底、乐观更新、旧图片预览和 mutation queue。
- AI 代理职责：`/api/chat` 与 `/api/ocr` 仍由 Next.js API Route 代理 AI 服务；`/api/chat` 开发默认 mock，live 调用需要显式双开关。
- 图片存储职责：新 OCR 图片通过 NestJS `/uploads/images` 上传到 MinIO。
- 复习系统职责：错题可生成 FSRS 复习卡，Card / ReviewLog / ReviewTask / ReviewPreference 以 PostgreSQL 为权威来源。
- 长期记忆职责：`UserMemoryCandidate` / `UserMemory` 以 PostgreSQL 为权威来源；MemoryAgent 只生成候选，候选必须经用户确认后才成为正式记忆。
- Agent Trace 职责：`AgentTraceRun` / `AgentTraceStep` 以 PostgreSQL 为权威来源；`/agent-traces` 提供账号级在线观测 API，`/agent-trace` 展示路由、步骤、降级、token 和估算成本；trace 只保存脱敏元数据，不保存完整 prompt、完整回答、完整 RAG chunk 或 API key。
- 后台任务职责：`BackgroundJob` 以 PostgreSQL 为权威来源；`/background-jobs` 与 `/background-jobs/summary` 提供账号级只读任务观测 API，当前服务知识库文档处理队列；job 只保存状态、资源类型、资源 id、时间戳、错误摘要和脱敏 metadata。
- API / worker 职责：`SERVER_ROLE=api` 启动 Nest HTTP app，只提供 REST API、`/health` 和 Swagger，不消费 BullMQ；`SERVER_ROLE=worker` 启动 Nest application context，只注册 worker processor，不监听 HTTP 端口；`SERVER_ROLE=both` 保留本地一体化模式。worker-only 第一版没有 HTTP `/health`，健康判断依赖进程存活、日志、BullMQ 和 BackgroundJob 状态。
- Worker Observability 职责：`/worker-observability/summary` 聚合系统级 `knowledge-document-processing` queue counts、Redis worker heartbeat 和当前账号 BackgroundJob summary；该接口经过 `JwtAuthGuard` 且受 `WORKER_OBSERVABILITY_ENABLED` 控制，默认非 production 开启、production 关闭。queue counts 不按用户隔离，heartbeat 只表达 worker 最近是否在线，BackgroundJob summary 才是账号级任务窗口；三者不能互相替代。
- Operator Audit 职责：`OperatorAuditLog` 以 PostgreSQL 为权威来源，记录 operator/admin 诊断写操作的安全审计元数据。Phase 7.14.3 / 7.14.4 已落审计模型、`OperatorAuditService` 和 outbox requeue 成功/失败留痕；Phase 7.14.5 新增 `GET /operator-audit-logs` admin-only 脱敏查询 API，用于受控排障和事故复盘；Phase 7.14.6 新增前端页面 `/operator-audit`，管理员侧边栏显示“审计”入口，普通用户不显示入口；Phase 7.15 已完成真实管理员/普通用户前后端验收，并修复本地 Docker dev 诊断开关与 `127.0.0.1` dev hydration 问题。审计记录只保存 actor、action、status、target、reason、requestId、IP/User-Agent hash、错误 code 和截断后的脱敏错误预览，不保存 payload、aggregateId、prompt、RAG chunk、模型回答、API key、token、cookie 或原始 IP/User-Agent。查询 API 不返回 `metadata` 或业务 payload；actor user 删除时保留审计记录并把 `actorUserId` 置空。前端页面只有当前会话 `role=ADMIN` 时才请求审计 API，真正鉴权仍以后端 guard 为准。
- OpenAPI debug docs 职责：Phase 7.4 adds Swagger / OpenAPI debug docs；Phase 7.5 为核心写接口补充中文说明和安全 request body 示例。`/api-docs` 和 `/api-docs-json` 默认在非 production 开启，production 默认关闭。`SWAGGER_ENABLED=true` 只适合受控环境、内网或临时诊断，不放宽 `JwtAuthGuard`，也不改变任一业务 API 的 userId 隔离、写入语义或 response envelope。
- RAG 知识库职责：Phase 5.6 已完成 `Document` / `Chunk` 数据模型、`vector(1536)` 索引预留、knowledge API contract、`/knowledge/documents` 上传/列表/详情/删除/替换 API、`POST /knowledge/documents/:id/process` 文档处理 API、`POST /knowledge/search` 检索 API、`/api/chat` 知识库上下文注入与 Markdown citations，以及 `/knowledge` 前端资料工作台；Phase 7.2 已补齐 chunk safety metadata、检索结果安全信号、Chat prompt 前过滤和 Verifier 保守 guidance。
- 资料管理 Agent 职责：KnowledgeDedupAgent / KnowledgeOrganizerAgent 已可从同一 owner snapshot 生成 deterministic facts、owner-scoped Qwen Chunk embedding shortlist，并在完整安全投影和双 stale fence 后选择性调用受限 DeepSeek V4 Pro candidate；本地 merger 始终重建真实 ID、时间、recommendation 与权限。`/knowledge-agent/suggestions` 是认证、用户隔离、在线只读 API，不自动合并、删除、替换、重命名或分类资料；默认 gate 关闭时仍返回 deterministic 建议。
- Agent 职责：`@repo/agent` 提供 Agent state、ActionProposal contract、RouterAgent、阈值 guard、运行 recorder、graph descriptor、业务 policy 以及 Router/Verifier structured-model candidate；package 不读取 env、不直接写库，真实 executor 只由 server-only composition root 注入。当前 11 个 graph 名称仍是 descriptor，Retriever/FinalResponse 职责隐含于 RAG/Chat 链路，Tool-Using Orchestrator 尚未实现。
- Agent 评测职责：`@repo/agent` 的 Phase 6.9 eval contract 统一 case run、summary 和模型路径启用决策；seed baseline 只运行纯 deterministic policy，不访问网络、数据库、Docker 或 API key。Orchestrator 当前只有 expectation-only case，不能被当作已实现能力。
- Model Agent Runtime 职责：`@repo/ai` 只接收调用方注入的 Mock responder 或结构化 executor，统一 Zod schema、不可变 run budget、超时/取消、安全错误和脱敏 Trace。package 不读取 env；API key 与 base URL 只存在于 composition root 创建的 executor closure。V7 R1 新增的 V4 Pro direct adapter 仍只是一种 `StructuredModelExecutor`；V9 R4 reviewed Mock 让正式 Tutor/Organizer candidate 穿过该 adapter，但只注入进程内 synthetic fetch。V9 R5 唯一 Live 证明两条 lane 能进入第一方 durable dispatch 边界，但没有 Provider response，因此不形成语义、usage、费用或产品 authority。其 wire capability 只暴露固定 stage/category/counter，不暴露 fetch、response 或 raw error。调用方先解析 live 双开关，runtime 再检查 `liveCallsEnabled`；结果与 Trace 不包含完整 prompt、完整输出、provider 原始错误、API key、base URL 或 stack。
- Provider Transport Diagnostic 职责：Recovery R1 的新 adapter 只在实例内存中保存 frozen `version + subtype`，用 own data descriptor 和最多四层 cause 将 fetch throw 映射为九个固定类别；公共 runtime/error/Trace 仍只接收原有 `transport`。Recovery R2 仅在独立 zero-network canary runner 中用模块内 synthetic responder 消费该 adapter。Recovery R3 的真实 composition 仍与产品 Tutor/Organizer 分离，只能在 exact confirmation、专用 credential、clean/tracking source 和未消费 marker 同时满足时构造一次 transport；结果只进入 diagnostic-only artifact，不能反向诊断 V9，也不能自动成为 Provider 外部健康或 Agent 语义事实。
- Provider Canary V2 职责：C1 的 proxy attestation 只存在于当前进程并只能消费一次；C2 public CLI 固定执行 preflight -> source -> approval/dedicated credential -> exclusive marker -> single fact-free dispatch -> terminal -> publication，不接受 transport 或输出注入。Marker、hash-chain journal 与 hard-link artifact 只解决一次性执行和证据 durability，不负责 Tutor/Organizer 语义、产品接线或业务写入。唯一 L1 已以 `complete / strict_response_with_verified_usage` 封存，但仍为 `qualityAuthority=none`；它只向 P1 提供一次 Provider health diagnostic，不得成为 semantic 或产品输入。
- Small-sample G2 职责：public CLI 只接收 `args + AbortSignal`，固定 preflight -> source -> approval -> dedicated credential -> marker -> guards -> pairs -> publication；G2 当时要求未来 L2 source admission 绑定专用 approved tag，S2 本身不创建该 tag。Runner 先执行 8 guards，再串行推进 8 pairs，pair 内 Tutor/Organizer lane 各自拥有 budget/abort/timeout/terminal。Crash-only seal 只补当前开放/待锚定 pair 的零-wire reservation 并立即 `attempted_aborted`，后续 pair 为 `not_started_quality_breaker`；不读取 credential、不构造 transport、不调用 Provider，也不是 resume/replay。G2 只形成 `zero_provider_runner_durability`。
- Small-sample S2 职责：在 G2 runner 上注入 reviewed `mock_synthetic` harness；Responder 只读取实际 bounded prompt，Tutor/Organizer actual 从 model-owned decision 与本地 authority/merger 重建，再与 runtime semantic axes 交叉核验。S2 验证 locked-name/no-write、25 类 transport/HTTP/schema/usage fault、父取消与 `3500/5000ms` 双 hard timeout，但不读取 credential、不调用 Provider、不创建正式 artifact 或 approved tag；gate 永远是 `mock_quality_not_evidence`，不能替代真实 L2 语义 authority。
- Small-sample L2 职责：独立 admission 将 pushed S2 source commit/tag、fresh proxy attestation、exact authorization 与专用 credential 绑定到唯一进程；G2 runner 真实执行 8 guards + 8 pairs，并把 reservation、wire、terminal 和 publication durable 写入 marker/hash-chain journal/hard-link artifact。唯一 run 已以 `small_sample_quality_gate_passed / small_sample_semantic_gate` 收口；它不连接产品或 main，只向后续 P2 提供设计准入。
- Full-gate P2 职责：zero-provider 固定完整 72-entry manifest、full deterministic baseline、全量与 L2 anchor subset 双层语义门、四项 24-sample P95、48-call/0.55 CNY cap、pair-serial/双 lane、breaker 与 crash-only durability。P2 只形成 `zero_provider_full_gate_design`，不创建 full-gate tag/evidence、不调用 Provider。
- Full-gate F1 职责：把 P2 设计固化为 exact manifest、deterministic baseline、安全 writer、strict report/scorer/gate 与历史 lineage 双向拒绝。所有正式 aggregate 都从 72 条固定 entry 重算；分母不完整时 semantic/anchor/P95/token/CNY 全为 `null`，Mock/synthetic 永远 `qualityAuthority=none`。F1 只形成 `zero_provider_full_contract_baseline`。
- Full-gate F2 职责：把 F1 contract 接入固定 production CLI/source admission、24-guard/24-pair runner、独立 lane budget/abort/timeout、exclusive marker、fsynced hash-chain journal、hard-link artifact、strict validator 与 crash-only seal。F2 只形成 `zero_provider_full_runner_durability_evidence`。
- Full-gate S3 职责：把 reviewed `mock_synthetic` composition 接到 F2 runner，真实穿过 Tutor V6、Organizer V9、第一方 adapter、strict validator 与本地 merger，并在完整 72-entry 分母上验证 full/anchor semantic、四项 P95、预算、breaker/abort、locked-name/no-write、durability 与 anti-oracle。S3 gate 永远是 `full_gate_mock_quality_not_evidence / qualityAuthority=none`，不创建 approved tag 或正式 bundle。
- 会话状态职责：`POST /conversation-context/prepare` 固定执行 ownership -> state patch/cache/PG -> 已有 summary -> uncovered count。PostgreSQL 是 state 权威源；Redis key 是 user/conversation 的 SHA-256 组合且最长 TTL 24 小时，只保存 public state。客户端只能 patch active goal/question，内部 action/tool 字段不会进入 request/response/cache。缓存 miss、Redis error、坏 JSON、schema mismatch 或过期都会安全回源/返回 PG 结果。
- 本地轻状态：今日任务轻手账 checklist 和学习偏好继续使用 userId scoped localStorage。

```text
用户操作
  -> Next.js Client
  -> TanStack Query / React state
  -> apiClient 或 Next.js API Route
  -> NestJS REST API / 外部 AI 服务
  -> PostgreSQL / MinIO
  -> Dexie / localStorage 本地兜底
```

## 2. Auth

```text
登录 / 注册
  -> authApi
  -> apiClient
  -> NestJS Auth API
  -> Prisma User + RefreshToken
  -> Set-Cookie: prepmind_refresh=httpOnly
  -> 返回 { user, accessToken }
  -> userStore 运行态 session
```

```text
刷新页面
  -> AuthSessionProvider
  -> POST /auth/refresh
  -> 校验 refresh cookie
  -> refresh token rotation
  -> 返回新的 { user, accessToken }
  -> 恢复前端 session
```

关键约定：

- refresh token 只以 hash 形式保存在 PostgreSQL。
- refresh token 已启用 rotation 与 reuse detection。
- 旧 RT 重放时，服务端撤销同 family 活跃 token 并强制重新登录。
- 当前 Auth 主链路不依赖 Redis。
- refresh 失败视为未登录，不弹全局错误。

## 3. AI 聊天

```text
用户输入文本
  -> ChatInputBar
  -> /api/chat
  -> server-only Agent bundle 创建 Router/Verifier runtime、共享预算与独立 Tutor runtime/预算
  -> chat-agent-runtime 先执行 deterministic Router eligibility；歧义请求可调用 Router model candidate
  -> final tutor route 时先执行 Tutor policy；隐含/上下文/冲突意图可调用 Tutor model candidate
  -> 有 accessToken 时检索知识库，命中后先执行 deterministic safety，再按 semantic-needed eligibility 调用 Verifier model candidate
  -> resolveChatProviderStatus() 基于 env 与开发调试开关判断 mock / live
  -> buildChatRequestBudget() 统一预算 system prompt、activeStudyContext、近期聊天历史
  -> 有 accessToken 时 best-effort 写入 /agent-traces 脱敏观测元数据
  -> mock data stream 或 OpenAI / DeepSeek SSE；request abort 传播到最终 streamText
  -> StreamingMarkdownRenderer 渐进渲染
  -> Dexie messages 本地缓存
  -> POST /chat-messages/sync
  -> PostgreSQL
```

关键约定：

- `/api/chat` 不注入完整历史，只注入裁剪后的近期上下文和当前活跃题目上下文。
- `/api/chat` 默认 `AI_PROVIDER_MODE=mock`，不要求 API key，也不会调用真实模型；`.env.local` 里存在 key 不会自动启用 live。
- 真实模型验收必须同时设置 `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true`；live 默认模型为 `deepseek-v4-flash`，也可通过 `AI_MODEL` 覆盖。
- 本地开发可额外设置 `AI_DEV_MODE_SWITCH_ENABLED=true`，在 `/agent-trace` 中使用开发调试开关切换 mock / live；该开关仅在非 production 可见，且不能绕过 `AI_ENABLE_LIVE_CALLS`、API key 或 live Chat 登录校验。
- Chat 默认输入预算为 2500 tokens、输出上限为 1200 tokens，可通过 `AI_MAX_INPUT_TOKENS` 和 `AI_MAX_OUTPUT_TOKENS` 调整；超出输入预算会返回 413。
- live 模式会在服务端打印不含密钥的用量估算日志，包含模式、模型、输入估算、输出上限、消息数量和是否带 active context。
- AI 行为验收规范见 `docs/ai-behavior-acceptance.md`；mock 验工程链路，live 小样本验真实输出体验，fake embedding 不证明 RAG 语义命中质量。
- 完整聊天历史仍保存于 PostgreSQL 与 Dexie。
- `activeStudyContext` 来自有效 OCR 题目，用于承接“这一步为什么这样做”等追问。
- RouterAgent 会为 Chat 请求生成 route metadata，当前主要用于区分 `chat`、`tutor`、`rag_answer`、`study_plan`、`review_analysis` 和 `wrong_question_organize` 等路线。
- `tutor` route 会调用 TutorAgent policy，生成 `explain_solution`、`socratic_hint`、`step_check`、`concept_bridge`、`answer_direct` 或 `general_follow_up` 策略。Task 5 起，final route 为 Tutor 且属于隐含、上下文或冲突意图时可进入独立 default-off candidate；明确教学指令、非 Tutor route、配置无效、不安全输入或 abort 保持 provider 前零调用。
- Agent prompt 顺序为 `BASE_SYSTEM_PROMPT -> activeStudyContext -> agent/tutor strategy prompt -> RAG knowledge context -> verifier / safety guidance`；RAG knowledge context 只接收 SafetyGuard 过滤后的可用 chunk；当 RAG prompt 因 token 预算被丢弃时，短 Agent prompt 仍保留。
- Chat 响应会带 `x-prepmind-agent-route`、`x-prepmind-agent-confidence`、`x-prepmind-agent-rag-required`；Tutor 路线额外带 `x-prepmind-tutor-intent`、`x-prepmind-tutor-depth` 以及固定、脱敏的 Tutor model disposition/reason/usage/CNY headers。
- RAG 命中后会调用 KnowledgeVerifierAgent，输出 `trusted / suspicious / conflict / insufficient / skipped`；响应头带 `x-prepmind-knowledge-verifier-status` 与 `x-prepmind-knowledge-verifier-chunks`。
- KnowledgeVerifierAgent 保留确定性 safety policy；Phase 6.9.4.4 功能分支已接 semantic-needed 真实模型候选。prompt injection/high-risk 保持零调用，模型失败只能收紧为保守 guidance，不修改用户资料、不阻断 Chat。
- `@repo/agent` 不直接调用 `streamText`、不读取 API key；Router/Verifier/Tutor candidate 只消费调用方注入的 `ModelAgentRuntime`。最终回答仍由 `/api/chat` 既有 mock/live provider 流式生成，Tutor candidate 只选择并由本地重建教学策略。
- `/api/chat` 使用同一个 `req.signal` 取消 conversation prepare、Tutor candidate 与最终 `streamText.abortSignal`；客户端断开后不继续生成最终流。已完成的上游调用不会伪装成未发生，Trace/usage 仍按各自 admission contract 处理。
- `@repo/ai` 的 `ModelAgentRuntime` 不替换最终流式 provider；Router/Verifier 已完成结构化候选的生产验收且组件 gate 默认关闭。Tutor 与 WrongQuestionOrganizer 的 V1--V9 Live 均已失败封存，产品验收没有启动。V9 R0--R4 证明 option selection、runner/durability 与 reviewed Mock 的 zero-provider 工程边界；唯一 R5 又只证明两条 lane 进入 durable dispatch 后在 response 前 transport/abort，仍没有真实语义、usage、费用、产品或质量 authority，也不证明 Router/API/最终流式 Chat 或 Organizer 产品真实质量。Memory 与其余未完成节点仍按各自后续任务推进。
- `ConversationState` 已由 prepare 与 Chat history 读写/恢复；`ConversationSummary` 在 prepare 中按 12 条/70% 触发并持久化，摘要源只包含 USER/ASSISTANT。模型调用期间不持有数据库事务；成功输出经过常见凭据与 usage 检查后，Serializable 事务只复核目标水位内消息 hash，并用 summaryVersion + 旧水位 CAS 写入。更高 order 的新消息不使当前目标 stale，目标范围正文变化则拒绝推进。
- Web request 携带 optional `conversationId`：首轮没有 id 时不调用 prepare，Chat sync 返回 id 后第二轮才进入。`/api/chat` 固定先完成 request/provider/live auth，再在 access token + id 同时存在时调用 prepare；默认 timeout 10 秒且限定 1~15 秒，并组合 request abort。network/timeout/5xx/schema failure 只生成固定 `degraded`，不泄露 raw error/token/summary，也不阻断 Mock streaming。
- Context assembler 的 mandatory 是 base system prompt 与 latest non-empty user；Agent guidance、untrusted state guidance、OCR、recent complete turns、safe RAG、summary 是独立 bounded layer。agent/state 合计最多 10% 且分别记 token/drop metadata；OCR 当前题优先，recent 不留孤立旧 user/assistant，RAG 空间不足整层 drop 并同步清空 hits/verifier/safety/citations，summary 仅在确有 history dropped 时考虑。optional layer 不制造 413；summary 未纳入不回滚数据库水位。
- Mock/live response 只通过 `x-prepmind-conversation-summary-status`、`x-prepmind-conversation-summary-version` 和 `x-prepmind-context-dropped-layers` 暴露固定状态；Agent Trace 只记录实际 conversationId、计数、版本与 bounded codes，不保存 summary、prompt、RAG chunk 或 state 正文。
- PostgreSQL 继续是 ConversationState/ConversationSummary 权威源，Redis 只做服务端 public-state cache，Dexie v9 `conversationStates` 只保存 `activeGoal`、`activeQuestionId`、stateVersion、expiresAt、updatedAt 与身份键。local write/clear 按 user 串行，serverVersion 不低于 local 才覆盖；过期、坏 schema、key/user mismatch、logout/clear 与迟到请求均 fail-safe。Dexie 不存 summary、pending proposal、tool names、prompt 或 token，也不根据 activeQuestionId 伪造 OCR 题面。
- Phase 6.9.3.5 已验证真实 OpenAI-compatible structured output 边界：共享 executor 对 strict object generation 固定使用 JSON mode，再交给 Zod schema、不可变预算、超时和 live 双开关；provider 原始错误、key 和 base URL 仍不出 adapter。DeepSeek Live summary 成功后，Web 只把安全 summary buffer 交给 assembler；Trace 记录 `summary=true` 与 `layerTokens=m/a/s/o/r/k/y`，不复制 summary/prompt/chunk。Mock/Live 验收结束后 server/web 恢复 Mock，合成用户、权威数据、Redis cache 与浏览器站点数据均清理。
- ReviewAgent / PlannerAgent / MemoryAgent 不在每次 Chat 中自动执行；复习建议只通过 `/review-agent/suggestions` 在计划和今日任务界面读取，长期记忆只在 `/profile` 显式管理。
- 当前不在 `/api/chat` 读取 `/user-memories`，也不把 `UserMemory` 自动注入 Chat prompt。
- `/api/chat` 在有 access token 时会 best-effort 构造 Agent Trace payload 并调用 `/agent-traces`；trace 写入失败不影响流式回答，只通过 `x-prepmind-agent-trace-recorded=false` 暴露。
- Agent Trace payload 在写入前会裁剪并脱敏用户输入预览、step summary 和错误信息；服务端也会再次裁剪和脱敏，防止保存 `DEEPSEEK_API_KEY`、`OPENAI_API_KEY`、`Authorization: Bearer ...` 或 `Cookie: ...` 等敏感片段。
- `/agent-trace` 的 token 与成本只做估算，用于调试 Agent 链路和观察趋势，不作为供应商真实账单或财务凭证。
- Chat / OCR 展示层的格式化不回写 `activeStudyContext`。
- 流式输出使用渐进 Markdown 渲染：稳定段落进入 Markdown / KaTeX，尾部未稳定内容保持轻量文本。
- 自动滚动默认跟随输出；用户触摸、滚轮或指针操作内容区后暂停，新一轮生成或回到底部时恢复。

服务端 ChatMessage API：

| 方法     | 路径                  | 说明                                                     |
| -------- | --------------------- | -------------------------------------------------------- |
| `GET`    | `/chat-messages`      | 读取当前用户会话消息，支持 `conversationId`              |
| `POST`   | `/chat-messages/sync` | 幂等同步当前会话快照，无 `conversationId` 时创建默认会话 |
| `DELETE` | `/chat-messages`      | 清空当前用户会话，支持 `conversationId`                  |

Chat 同步保护：

- 流式生成中不写 Dexie、不同步 `/chat-messages/sync`。
- 流式结束后等待短稳定窗口，避免 `useChat` 节流合并最后文本时提前同步半截 assistant 内容。
- 流式结束后若最后一条仍是 user，视为 assistant 未成功生成，不写 Dexie、不同步服务端。
- 流式结束后若 assistant 内容为空白，视为无效回复，不写 Dexie、不同步服务端。
- 页面隐藏或关闭时的 Dexie flush 也会复用同一完成态校验，不保存流式中的半截内容。
- 本地或服务端历史恢复时，会裁掉尾部 user-only 或空 assistant 的不完整历史。
- 后端 `/chat-messages/sync` 会拒绝非空但没有非空 `ASSISTANT` 收尾的快照，作为服务端最后防线。
- UI 显示“本次回答没有成功生成，请重试”，并记录 debug 信息；后续正常 assistant 生成后清除该错误。

ChatMessage 不进入通用 CRUD mutation queue，继续使用会话快照幂等同步。

服务端 Agent Trace API：

| 方法   | 路径                    | 说明                                                                          |
| ------ | ----------------------- | ----------------------------------------------------------------------------- |
| `POST` | `/agent-traces`         | 写入或替换当前用户一次 Agent Trace run 及 steps，写入内容必须是脱敏后的元数据 |
| `GET`  | `/agent-traces`         | 分页读取当前用户最近 trace，可按 route、mode、status 过滤                     |
| `GET`  | `/agent-traces/summary` | 读取近 1 到 30 天 trace 汇总、route 分布、verifier 分布和估算成本             |
| `GET`  | `/agent-traces/:id`     | 读取当前用户单次 trace 详情与步骤                                             |

Agent Trace 边界：

- `/agent-traces` 经过 `JwtAuthGuard`，所有读写都按当前 `userId` 隔离。
- Trace 是在线账号级观测能力，不进入 Dexie `mutationQueue`；离线或弱网时不补写历史 trace。
- Trace 不保存完整 prompt、完整模型回答、完整 RAG chunk、access token、refresh token 或 API key。
- `inputPreview`、`inputSummary`、`outputSummary` 和 `errorMessage` 只用于调试摘要，长度受 schema 与服务端双重限制。
- 现有 fixed deterministic eval set 位于 `@repo/agent`，用于回归已实现 policy，不替代 live 输出体验验收。最终治理范围是 11 个逻辑节点加 Tool-Using Orchestrator；Retriever、FinalResponse 和 Orchestrator 仍需正式 node/graph contract 与独立验收。

## 4. RAG 知识库数据流

Phase 5.0 已完成 RAG 设计，Phase 5.1 已完成数据模型与 shared contract 地基，Phase 5.2 已完成文档上传与状态 API，Phase 5.3 已完成文档处理与 embedding 入库，Phase 5.4 已完成检索 API，Phase 5.5 已完成 Chat RAG 增强和 Markdown citations，Phase 5.6 已完成 `/knowledge` 前端资料工作台。Phase 6.3 已接入资料可信度评估 Agent，Phase 6.8 已接入资料管理建议 Agent。Phase 7.0 / 7.1 已把文档处理升级为可切换 inline / BullMQ queue 的后台任务链路；Phase 7.8.5 已完成 Qwen `text-embedding-v4` / 1536 runtime parity 真实 Docker 验收。official smoke 3/3，queue `BackgroundJob=SUCCEEDED`，provider/key/base URL 缺失时在 provider 调用前 fail-closed；证据见 `docs/acceptance/2026-07-14-rag-runtime-parity.md`。

文档处理数据流：

```text
用户上传学习资料
  -> POST /knowledge/documents
  -> contentHash 检查同用户重复资料
  -> MinIO 保存原文件
  -> Document(status=PENDING, sourceType=UPLOAD)
  -> POST /knowledge/documents/:id/process
  -> 使用 status + storageKey + contentHash 快照条件 claim Document(status=PROCESSING)
  -> TXT / Markdown / DOCX / PDF 基础文本解析
  -> @repo/rag 段落感知分块
  -> @repo/rag classifyRagChunkSafety() 写入 Chunk.metadata.safety
  -> 当前真实路径：Qwen text-embedding-v4 生成 1536 维向量
  -> 事务内 SELECT ... FOR UPDATE 锁定同一 processing 快照
  -> Chunk.embedding vector(1536) raw SQL 写入 pgvector
  -> 使用同一快照条件标记 Document(status=DONE / FAILED)
```

队列模式文档处理数据流：

```text
用户点击处理
  -> POST /knowledge/documents/:id/process
  -> KNOWLEDGE_PROCESSING_MODE=queue
  -> 创建 BackgroundJob(resourceType=KNOWLEDGE_DOCUMENT, status=QUEUED)
  -> 投递 BullMQ knowledge-document-processing job
  -> API 返回 Document(status=PROCESSING, processing.backgroundJobId, processing.mode=queue)
  -> worker 根据 SERVER_ROLE=worker|both 注册 processor
  -> SERVER_ROLE=worker 时该进程只运行 application context，不监听 HTTP
  -> worker / both 角色定期写入 Redis heartbeat
  -> 标记 BackgroundJob(ACTIVE)
  -> 复用 DocumentProcessingService 解析、分块、embedding 和 chunk 写入
  -> 成功：Document(DONE) + BackgroundJob(SUCCEEDED)
  -> 失败：Document(FAILED) + BackgroundJob(FAILED)
  -> 快照变化：不写 chunks，BackgroundJob(STALE_SKIPPED)
```

资料替换数据流：

```text
用户在资料卡片中选择重新上传
  -> PUT /knowledge/documents/:id/file multipart
  -> 校验 document/user ownership
  -> contentHash 检查是否命中同用户其它资料
  -> MinIO 保存新原文件
  -> 事务内按 status + updatedAt + storageKey + contentHash 条件更新同一个 Document(id 不变, status=PENDING)
  -> 条件更新成功后删除旧 chunks
  -> 事务成功后尽力删除旧 MinIO 对象；事务失败只清理本次新上传对象
  -> 用户重新触发处理入库
```

当前检索数据流：

```text
用户查询
  -> POST /knowledge/search
  -> knowledgeSearchRequestSchema 校验 query / topK / minScore
  -> EmbeddingService 生成 query embedding
  -> pgvector cosine 召回当前用户 DONE 文档 vector candidates
  -> PostgreSQL full-text 召回当前用户 DONE 文档 keyword candidates
  -> 按 chunkId 去重，融合 vectorScore / keywordScore 做 hybrid rank
  -> 过滤低于 minScore 的结果（当前无 reranker）
  -> 返回 KnowledgeSearchResponse(hits)，包含 metadata.safety 与 metadata.retrieval
```

当前 Chat RAG 数据流：

```text
用户提问
  -> ChatRuntimeProvider 将 accessToken 放入 /api/chat 请求体
  -> /api/chat 使用最新用户消息调用 /knowledge/search
  -> 无 token / 无资料 / 未命中 / 检索失败：普通 AI 回答
  -> 命中知识库：先过滤 high-risk chunks，medium-risk chunks 只作为可疑原文引用
  -> 调用 KnowledgeVerifierAgent 评估 raw retrieved chunks 与 safety metadata
  -> 注入过滤后的 chunks 与 verifier / safety guidance 到 system prompt
  -> AI 回答，并在助手消息末尾追加 Markdown 参考资料
  -> suspicious / conflict / insufficient 时追加“资料核对提示”
```

资料管理建议默认关闭 gate 时的 fallback 数据流：

```text
用户打开 /knowledge
  -> useKnowledgeAgentSuggestions({ limit: 20 })
  -> GET /knowledge-agent/suggestions
  -> KnowledgeAgentService 使用 JwtAuthGuard 的当前 userId 查询 Document
  -> 每份资料最多读取少量 Chunk 摘要并裁剪文本
  -> @repo/agent analyzeKnowledgeDedup()
  -> @repo/agent organizeKnowledgeDocuments()
  -> 返回重复、新版、互补、集合和标签建议
  -> /knowledge 只读展示建议，不提供自动合并/删除/分类按钮
```

Phase 6.9.6 当前数据流（已实现，生产 gate 默认关闭）：

```text
用户打开 /knowledge
  -> GET /knowledge-agent/suggestions + JwtAuthGuard
  -> REPEATABLE READ 按 canonical userId 查询最多 20 份 Document/安全 Chunk/score
  -> 深冻结 owner snapshot + fingerprint；provider 前重验 owner/version/chunk identity
  -> exact contentHash / 本地事实
  -> owner-scoped safe Chunk embedding shortlist（最多 12 对）
  -> filename/每段 summary 全字段安全扫描，再裁剪并做 ordinal 投影
  -> Dedup / Organizer safety eligibility
  -> API server 读取独立 Knowledge credential + 两个独立 default-off gate
  -> 全局 Live 双开关 / 精确 DeepSeek HTTPS / 已知价格 / 冻结 reservation
  -> 两个 model candidate 并行共享 2-call / 6000-in / 1200-out 预算（0.03 CNY cap）
  -> strict schema + local merger 重建 ID、时间、recommendation 与权限
  -> 返回 hybrid_model 或 local_deterministic 安全状态
  -> /knowledge 继续只读展示，不执行整理写操作
```

该数据流已经由唯一 V2 controlled-Live 与 R7 Docker/API 验证：Dedup-only、Organizer-only 和双开关均得到 `candidate_applied`，exact hash/credential/injection/unsafe/cross-owner guard 保持 provider 前零调用；强制 provider 失败返回本地降级且上传、处理、列表、检索不受影响。可见浏览器使用真实 Docker 路径完成上传、处理和 Qwen 混合检索；semantic/degraded/error 只做绑定 R7 strict response authority 的渲染回放，未产生第二轮模型调用。分支验收后 API 恢复 mock/default-off，synthetic 数据和浏览器 storage 清理为 0。main 合并与最终文档提交已完成真实 Docker 上传/处理/混合检索、default-off 本地建议、桌面/移动端无溢出和精确清理；没有再次调用 provider，远程 parity 已确认。

Phase 6.9.7 增量数据流（Task 0--11 已完成；V1--V6 六条唯一 Live 均质量失败并封存；V6 R5
证据已 seal，产品验收未启动）：

```text
/api/chat
  -> final canonical Router route
  -> route=tutor
  -> explicit/high-confidence Tutor intent: deterministic zero-call
  -> implicit/contextual/conflicting Tutor intent: safe projection -> bounded candidate
  -> strict result/usage/budget admission -> local merger 重建 TutorStrategy/prompt
  -> 既有 Final Chat streaming / RAG / Verifier / 413 保持不变
  -> req.signal 同时取消 Tutor candidate 与最终 streamText
  -> 固定 Tutor model headers + best-effort Trace

POST /wrong-question-organizer/organize/:id 或 organize-batch
  -> JwtAuthGuard canonical userId
  -> HTTP request aborted signal；结束时清理 listener
  -> Task 6: REPEATABLE READ + READ ONLY owner snapshot/fingerprint
  -> provider/decision 前 revalidation
  -> default-off / existing / high-confidence / unsafe：deterministic zero-call
  -> eligible single 或 batch 最多 12 条：一次 ordinal-only DeepSeek candidate
  -> candidate 后 revalidation；stale 不重调 provider
  -> 同一 stable runId 原子持久化 command_pending admission Trace
  -> Trace 失败：丢弃模型结果，回到 deterministic decision
  -> 深冻结 model-free OrganizerCommand
  -> owner advisory-lock write transaction 内第三次 fence
  -> 本地 command 只写 SubjectGroup/Deck/DeckItem
  -> command commit 失败：同 runId failed terminal Trace + 请求失败，不伪造成功
  -> command 后同 runId 原子全量替换 final Trace
  -> final Trace 失败：保留 command_pending，不回滚已授权业务写入
  -> single/batch 顶层 strict runtime：local_deterministic | hybrid_model
  -> /error-book 主动批量整理成功后显示语义整理 / 本地规则 / 安全回退
  -> 未写入题仍满足 deckItems:none，可由后续 organize-batch 补偿

Task 9 offline paired eval
  -> 读取冻结 72-case dataset 与 SHA-256
  -> 24 条 zero-call 实际穿过 candidate/preflight guard，独立 counter=0
  -> 24 个 paired index：Tutor runtime || Organizer runtime
  -> 失败仍留在 48 runtime / 32 Organizer decision 分母
  -> 重算 strict schema、semantic、critical、P95、usage 与 CNY
  -> executor provenance：mock_synthetic | synthetic_test | deepseek_network
  -> 只有 authorized Live + deepseek_network 可进入 production quality gate
  -> immutable evidence + strict filename/runId/sensitive-data validator

Task 10 deployment boundary
  -> 宿主根 .env 只做 Compose 插值，不整份注入 service
  -> web allowlist：Tutor gate / 3000ms / Tutor component key
  -> server allowlist：WrongQuestionOrganizer gate / 5000ms / Organizer component key
  -> worker/admin：两组能力均 absent；worker 模块再次强制 gate=false
  -> generic/cross-component key 不可替代；tracked defaults 全部 gate=false
  -> config --quiet 只验证解析，不启动 service、不输出 credential

Task 11 branch checkpoint
  -> 同一 HEAD 重跑 focused + Agent/AI/Types/Server/Web full/static
  -> Organizer PostgreSQL E2E + 测试账号残留=0
  -> 重新生成 deterministic baseline + fresh strict Mock
  -> Mock: 24/24 zero-call + 48/48 runtime + semantic 1/1/1
  -> mock_synthetic provenance => Live-only quality_gate_failed
  -> validator 后精确删除 Mock evidence；不创建 Live marker/evidence
  -> 停在 Task 12 新授权门；gates=false

Task 12 V1 controlled-Live
  -> clean preflight 修复并验证其它六个生产 Agent gate 全关
  -> 进程级注入 Tutor/Organizer 两条组件变量；不修改根 .env
  -> 唯一 deepseek_network 72-case run；marker 先占用且不可删除/重跑
  -> 24/24 zero-call；27/48 strict runtime
  -> Tutor semantic 0.3485119048，absolute improvement -0.0933547619
  -> Organizer semantic 0.7000000000，absolute improvement 0.4218750000
  -> 安全、P95、usage、0.086418 CNY 通过，但最终 quality_gate_failed
  -> evidence/marker + SHA + validator 封存
  -> 停止：不启动 Docker/API/browser，不创建 synthetic 产品数据

V2 R6 static/Mock checkpoint
  -> V2 marker wx 并发竞争：一个 winner，其余 live_already_attempted
  -> marker 目录/存储故障：evidence_io_failed，executor zero-call
  -> evidence 随机 temp wx -> hard-link final authority -> best-effort temp cleanup
  -> orphan temp 不阻塞；target EEXIST 与普通 link I/O 故障分开
  -> 同题 normal/force 与 single/batch PostgreSQL 竞争收敛到唯一 owner authority
  -> fresh V2 Mock 24/24 zero-call + 48/48 runtime + semantic 1/1
  -> 精确删除 Mock evidence；V1 SHA 不变，V2 Live marker/evidence=0
  -> 停在 R7 新精确授权门；gates=false

V2 R7 unique controlled-Live
  -> clean preflight + 两个 component credential 的进程级映射；其它 Agent gate=false
  -> marker wx 先占用唯一 V2 lineage；runner-v2 / deepseek_network / 72 cases
  -> 24/24 guard zero-call
  -> Tutor 24 + Organizer 24 runtime 全部 fallback_runtime_error
  -> structured object 未形成：rawSchemaValid=false，canonical stage/reason=null/null
  -> 0/48 strict runtime；semantic 0/0；critical=1；verified usage=0
  -> evidence/marker hard-link authority + SHA + V2 validator 封存
  -> quality_gate_failed：不重跑、不进入 R8 Docker/API/browser
  -> 后续进入零 Provider V3 R0 设计；gates=false

V3 R0 zero-provider design
  -> 复用 @repo/ai 固定 provider failure category / structured stage
  -> paired evidence 增加 bounded stage + dispatch/usage outcome；不保存 raw error
  -> 24 guard 先行；runtime 单 pair 最多 Tutor+Organizer 双并发
  -> 首个 runtime contract failure => quality_gate_impossible，收口当前 pair 后停止后续派发
  -> 未执行 runtime 仍留在 48 分母；category=null；无 retry/补跑
  -> Tutor/Organizer lane、credential、budget、abort、failure attribution 相互隔离
  -> marker + append-only journal + hard-link evidence；crash 后只 seal，不 resume
  -> R0 只冻结设计；gates=false

V3 R1 diagnostics + zero-network compatibility
  -> runtime Trace fixed category/stage -> safe V3 projection；raw error/content 不落盘
  -> config_validated -> ... -> applied 十阶段只能单调推进
  -> delegate-boundary recorder 是 runtimeInvocations 0/1 authority
  -> outer harness catch -> harness_internal_error；不猜 Provider category
  -> usage verified / unknown_after_attempt / absent_not_attempted 分离
  -> V1/V2 case/report 的全部 V3 字段继续 absent
  -> config/factory/request/response audit/schema/abort 仅 synthetic/fake fetch，外部网络 0
  -> R1 checkpoint 当时 V3 Live marker/journal/evidence artifact 0

V3 R2 strict breaker + dual-lane ledger
  -> 24 guard 全先行；任一失败时 48 runtime 保留且真实 runtime 0-call
  -> runtime 按 pair 0..23 串行；每 pair Tutor/Organizer 各一条独立 lane，最大并发 2
  -> (runId, agent, pairedRunIndex) reserve/terminal，重复 key fail-closed
  -> runtimeContractSuccess 只读 invocation/schema/canonical/latency/usage/safety，不读 semantic expected
  -> 首个 contract failure => quality_gate_impossible，只 abort 当前 sibling
  -> sibling 保留自身 failure/abort；忽略 abort 则有界收口为 orphaned + unknown usage
  -> 后续 runtime => not_started_quality_breaker；固定 48 分母，无 retry/补跑/预算借用
  -> metrics/P95/usage/CNY/lane/outcome counters 由 V3 schema 重算；不完整门失败
  -> V1/V2 validator + 四 SHA 不变；R2 checkpoint 当时 V3 Live artifact 0

V3 R3 crash-safe evidence
  -> 独立 V3 CLI / confirmation / approval env / marker / journal / evidence / validator
  -> marker wx 单胜者；journal_initialized fsync 早于 executor 创建
  -> 每条 dispatch_started fsync 早于对应 executor；sequence + previous SHA + record SHA
  -> guard / dispatch / runtime terminal / pair / breaker / run / seal 严格状态机
  -> marker owner 活跃 => live_attempt_in_progress；死 owner => token recovery claim 单胜者
  -> claim 只允许一个 appender；takeover 后旧 appender/release 被 fence，不触碰新 owner
  -> dispatch 无 terminal => attempted_orphaned + unknown_after_attempt
  -> 未 dispatch => not_started_orphaned + absent_not_attempted；不 resume/replay/retry
  -> temp wx + fsync + hard-link final；same bytes 幂等，不同 bytes 拒绝覆盖
  -> V1/V2 validator + 四 SHA 不变；R4 static/Mock 已通过
  -> 唯一 V3 R5: marker -> journal -> 28 dispatch/terminal -> breaker -> run failed -> evidence sealed
  -> R5 quality_gate_failed；不得重跑或进入 R6--R9

V4 R0 zero-provider postmortem
  -> 读取 V3 bounded evidence；不读取 prompt/raw output/credential
  -> Tutor executed semantic mismatch: 2 hint + 1 step 被降级为 general_follow_up
  -> Organizer executed observations: topic/evidence 弱；首错仍是 subject authority dynamic contract
  -> executed mismatch / dynamic failure / breaker not-started 分开，不互相改写
  -> 冻结 V4-only axis/stage/reason + Tutor/Organizer 单一 policy source
  -> 冻结独立 V4 runner/prompt/marker/journal/evidence/validator
  -> R1--R5 zero-network/static/Mock；R5 当时没有新精确授权则不进入 V4 Live；后续 R6 已消费并失败

V4 R1 bounded diagnostics
  -> hostile-safe clone + strict V4 case projection；不保存题目/prompt/raw output/credential
  -> not_started | executed_contract_failure | executed_semantic_mismatch | executed_semantic_match
  -> contract failure 必须记录 provider/schema/dynamic/merger/usage/latency/safety stage
  -> Organizer raw-schema/dynamic failure 必须携带唯一 validator 的 stage/axis/reason
  -> context/index -> subject -> deck -> topic -> evidence -> confidence；legacy 只映射同一结果
  -> candidate 将成功 validation 直接交给 merger；merger 只重建本地 ordinal/ID/name/write authority
  -> 72-case report 从 entries 重算 stage/axis/reason aggregate，拒绝重复、篡改和 guard/runtime 错配
  -> V1/V2/V3 V4 字段 absent；旧 validator 拒绝 V4，V4 validator 拒绝旧 report
  -> 后续 R2 已完成；仍为 zero-network

V4 R2 Tutor semantic authority
  -> frozen V4 policy: step_check > explain_solution > concept_bridge > socratic_hint > general_follow_up
  -> formatter + validator + evidence resolver + depth compatibility 共用 policy
  -> buildTutorStrategyFromIntent 从同一 policy 派生 context/guiding/final-answer/structure
  -> candidate merger: 具体 local intent 只允许同级或更高 precedence，禁止降级为 general
  -> answer_direct 继续 local zero-call；模型无 final answer / route / tool / permission / write
  -> historical paired eval -> runTutorModelCandidateV2 -> 原 V2 prompt bytes / V3 prompt SHA
  -> product default-off candidate -> tutor-model-candidate-v4
  -> deterministic detector/baseline 不重排；dataset/SHA/expected/metrics 不变
  -> 后续 R3 已完成；仍为 zero-network

V4 R3 Organizer semantic authority
  -> frozen V4 policy: context/index -> subject -> deck -> topic -> evidence -> confidence
  -> known subject -> keep_local + structured_subject；unknown subject 禁止 keep_local
  -> reuse_existing -> same-subject deck ordinal + existing_deck_overlap
  -> create_topic -> 安全精确 topic；semantic_topic/error_pattern 按输入事实要求
  -> insufficient_signal 仅 medium 且不与正向 evidence 混用；high 必须有强事实支撑
  -> formatter + dynamic validator + merger 共用 policy；merger 不修复非法模型输出
  -> owner/ordinal/locked-name/stale fences/single call/budget/abort/no-retry 不变
  -> historical paired eval -> runWrongQuestionOrganizerModelCandidateV2
  -> product default-off candidate -> wrong-question-organizer-model-candidate-v4
  -> 后续 R4 已完成；仍为 zero-network

V4 R4 independent robustness + evidence lineage
  -> versioned fixture 与 72-case dataset 分离；不复制冻结 expected/accepted-label/oracle
  -> Tutor: 中英/混合改写、否定、噪声、context reorder 与 primary-signal 冲突
  -> Organizer: authority drift、question/deck reorder、locked name、ordinal/topic/evidence/confidence/schema-negative
  -> actual V4 candidate prompt 扫描 case ID/expected/accepted-label/oracle 泄漏
  -> abort、lane budget、single dispatch、no retry 与 write isolation fail-closed
  -> transient V3 scheduler result -> V4 entry/report；持久化回调只接收 V4 identity
  -> V4 marker wx -> journal initialized/fsync -> dispatch_started/fsync -> terminal/pair/breaker/run/seal
  -> sequence + previous SHA + record SHA；固定 72/24/48，duplicate/reorder/tamper/cross-version 拒绝
  -> recovery claim 单胜者 + ABA fence；orphan 只 seal，不 resume/replay/retry
  -> temp wx + fsync + hard-link final；same bytes 幂等，different bytes 拒绝覆盖
  -> V1/V2/V3 validators/SHA 不变；R4 当时 V4 Live CLI 在 R6 前返回 live_not_available_before_r6
  -> 后续 R5 已完成，唯一 R6 已执行并失败封存

V4 R5 static/Mock checkpoint
  -> fresh Mock: 24/24 zero-call + 48/48 strict runtime + semantic 1/1/1
  -> mock_synthetic -> quality_gate_failed；不形成 Live authority
  -> full static + Organizer PostgreSQL 12/12 + Compose default-off
  -> V1/V2/V3 validator/SHA immutable；V4 artifacts=0；测试账号残留=0
  -> 两路终审 PASS；该条记录 R5 当时停止在 R6 授权门前

V4 R6 unique controlled-Live
  -> 24 guard -> 24/24 verified zero-call
  -> pair 0..5 顺序 dispatch；每 pair Tutor/Organizer 双 lane，合计 12 executor started
  -> 前 5 对 10 strict runtime；pair 5 Tutor dynamic_contract -> invalid_evidence_association
  -> Organizer sibling attempted_aborted / unknown_after_attempt；不冒充 zero-call 或完整费用
  -> quality_gate_impossible breaker；后续 36 runtime -> not_started_quality_breaker
  -> fixed 48 denominator -> Tutor/Organizer semantic 0.14410714285714285/0.10372596153846154
  -> journal 58 records + evidence_sealed；file/bundle validator 通过
  -> quality_gate_failed -> 一次性名额消费，不重跑，不进入 R7--R9/Docker/browser/main

V5 R0 zero-provider root cause
  -> 读取冻结 V1 dataset + bounded V4 evidence；不读取 raw prompt/model output/credential
  -> tutor-runtime-06: 中文代数 latestText + 英文微积分 activeContext + 错误 en tag
  -> exact input -> product runTutorModelCandidate -> canonical diagnostic
  -> submitted_step -> candidate_applied
  -> missing/wrong primary evidence -> fallback_schema_invalid / invalid_evidence_association
  -> adapter 只投影 product rejection；不是独立误判源
  -> V4 前 5 对仍保留中文 Tutor 与 Organizer topic/subject 真实 semantic mismatch
  -> 冻结 V5: V2 coherent dataset -> Tutor local evidence authority -> Organizer ordinal shortlist

V5 R1 zero-provider dataset authority
  -> 显式构造 72 cases -> 24 guard + 48 runtime -> 24 paired requests
  -> Tutor definition -> language + exerciseFamily + latestText + coherent activeContext
  -> Organizer definition -> structured/taxonomy subject + 3 topic candidates + hidden expected ordinal
  -> module-load coherence -> count/id/pair/language/family/subject/topic/batch fail-closed
  -> prompt-safe projection -> 不导出 expected/case/owner/question/deck ID 或 V1 identity
  -> freeze dataset SHA 42803d45...b437b + policy SHA b3913403...f009d
  -> deterministic baseline 12/48 -> semantic 0.6629642857/0.278125/0.4705446429
  -> freeze baseline SHA 0ce7c3ca...116ca；provider/usage/cost = 0
  -> R2 前停止点：无 V5 Live 授权，不启动 Docker/API/browser

V5 R2 zero-provider Tutor local-signal authority
  -> latest text + optional active context + safety metadata
  -> strict clone/full scan -> local signal detector
  -> precedence: step > explain > concept > hint > general
  -> frozen authority: signals + negated + eligible intent/depth + provenance + canonical SHA
  -> direct/explicit/no-signal/route/abort/safety/budget -> provider 前 zero-call
  -> bounded projection -> injected no-network runtime，最多一次调用，无 retry
  -> strict model output: intent + depth + confidence
  -> local authority validator -> local TutorStrategy merger -> candidate/fallback
  -> 32 held-out + 24/24 V2 runtime detector 对照通过
  -> R2 当时停止在 R3 前；仍无产品接线或 V5 Live 授权

V5 R3 zero-provider Organizer ordinal shortlist
  -> trusted owner snapshot source -> strict clone + full-field safety scan
  -> stable question/deck ordering + normalized keyword/topic/deck dedupe
  -> structured subject or bounded taxonomy -> topic/deck ordinal authority
  -> owner/snapshot/question/deck/topic/rules -> canonical shortlist fingerprint
  -> pre-call source revalidation -> budget preview -> injected no-network runtime
  -> strict subject/deck/topic ordinal decision，最多一次调用，无 retry
  -> post-call source revalidation -> dynamic same-subject association validator
  -> local merger resolves real ID/name + command binding；不执行 mutation
  -> reorder 保持等价；分页/去重/ordinal/owner/content ABA 变化 fail-closed
  -> R3 当时停止在 R4 前；仍无产品接线或 V5 Live 授权

V5 R4 zero-provider runner / lineage / extreme boundaries
  -> native V5 report/case/evidence schema；拒绝 V1--V4 lineage 与 partial aggregate
  -> 24 guards first -> fixed 72/24/48/24/32 denominator
  -> one pair at a time -> Tutor + Organizer 最多双 lane -> first contract failure breaker
  -> dispatch key single winner -> append + fsync journal before either lane/provider entry
  -> lane-specific terminal -> abort/orphan/usage unknown 不复制 sibling 失败
  -> case entries -> recompute identity/semantic/usage/safety/latency/gate；incomplete -> null
  -> marker wx -> hash-chain journal -> hard-link evidence -> evidence_sealed terminal
  -> active owner cannot seal；dead owner single-winner recovery + marker/tail/file-identity ABA fence
  -> recovery only seals fixed terminal；never retry/resume/replay provider
  -> synthetic_test Live -> quality_gate_failed；only deepseek_network may quality pass
  -> R4 停止点：无 V5 Live artifact、产品接线、Provider、Docker/API/browser

V5 R5 zero-provider static / Mock checkpoint
  -> reviewed public Mock factory -> Tutor/Organizer V5 candidate -> validator -> local merger
  -> 24 guard 不构造 runtime；48 runtime 各执行一次 synthetic Mock executor
  -> fresh baseline 12/48；fresh Mock 24/24 zero-call + 48/48 strict runtime + semantic 1/1/1
  -> synthetic invocation 不是真实 Provider call；mock_quality_not_evidence
  -> Agent/AI/Types/Server/Web static + Organizer PostgreSQL 12/12 + Compose default-off
  -> V1--V4 SHA/validator 不变；V5 Mock evidence 精确删除；V5 Live artifact=0

V5 R6 unique branch controlled-Live
  -> marker 前配置/credential/provenance fail-closed
  -> marker + journal_initialized fsync -> create deepseek_network executor
  -> 24 guards -> 24/24 zero-call -> sequential paired scheduler
  -> 前 6 pairs 启动 12 次 Provider invocation -> 11 strict runtime
  -> pair 5 Tutor runtime-06: 3021ms > 3000ms -> runtime_timeout
  -> pair terminal -> quality_gate_impossible breaker -> 后续 36 runtime 不启动
  -> incomplete semantic/latency/usage/cost aggregate 全部 null
  -> quality_gate_failed -> run completed -> evidence sealed；禁止 retry/resume/replay

V6 R0 zero-provider design
  -> read-only V5 evidence/journal/marker + exact SHA verification
  -> runtime trace / candidate orchestration / paired duration 分层，不猜 Provider latency
  -> Tutor hard timeout 3500ms；Tutor P95 2500ms 不变
  -> Organizer hard timeout/P95 5000/4500ms 不变
  -> Tutor model: eligible intent ordinal -> local preferred depth/strategy authority
  -> Organizer model: subject/deck/topic ordinal -> local confidence authority
  -> model-owned axes 单独 gate，local derived fields 不得掩盖模型质量
  -> V2 dataset/expected/baseline bytes 不变；V6 eval/runner/artifact identity 独立
  -> no source/runtime/credential/Provider/Docker/API/browser/data mutation

V6 R1 zero-provider source contracts
  -> bind unchanged V2 dataset/baseline -> independent V6 dataset/eval policy SHA
  -> monotonic executor/runtime/orchestration/paired duration + deadline overshoot
  -> exactly 24 samples per P95 -> sorted index 22 / one-based 23
  -> any incomplete/invalid lane -> complete=false -> all four P95 null
  -> Tutor model-owned intent >=21/24 -> local preferred depth/final strategy
  -> Organizer model-owned subject/deck/target ordinal each >=28/32 -> local confidence
  -> fingerprint shape/snapshot/subject/target contract only
  -> actual owner shortlist/fingerprint/stale/ABA/locked-name composition deferred to R2
  -> no candidate/runner/marker/Mock/Live/credential/Provider/Docker/API/browser/data mutation

V6 R2 zero-provider bounded candidates
  -> Tutor safe projection -> eligible intent ordinals -> model returns only intentIndex
  -> local preferred-depth authority -> rebuild context/guiding/final-answer/answer structure
  -> Organizer actual owner shortlist -> canonical fingerprint + subject/deck/topic ordinals
  -> pre-runtime re-derive shortlist -> one bounded runtime call -> post-runtime re-derive shortlist
  -> owner/snapshot/fingerprint/stale/ABA/ordinal/locked-name mismatch -> whole-batch fail-closed
  -> local confidence/real IDs/names/reason/description/command binding; model has no write permission
  -> public merger revalidates raw ordinal decision; hostile accessors are never invoked
  -> independent robustness + recursive actual-prompt leakage scanner; V2 bytes/SHA unchanged
  -> no product composition/Trace persistence/runner/marker/Mock/Live/credential/Provider/Docker/API/browser

V6 R3 zero-provider runner/lineage/durability
  -> 24 guard first -> sequential 24 pairs -> at most Tutor+Organizer lanes per pair
  -> dispatch_started append+file-fsync before executor -> one dispatch/no retry per lane
  -> first runtime contract failure -> settle current pair -> quality breaker -> fixed denominator retained
  -> monotonic deadline/overshoot + 3500/5000ms hard timeout -> complete-only P95/semantic/usage/CNY
  -> marker wx -> hash-chain journal/append queue -> live-owner/dead-owner single recovery/ABA fence
  -> temp file fsync + hard-link evidence -> same bytes idempotent/different bytes rejected
  -> V1--V5/V6 bidirectional lineage rejection; synthetic_test can never quality pass
  -> R3 stop point: no reviewed Mock factory/real artifact/credential/Provider/product/Docker/API/browser

V6 R4 zero-provider static/Mock checkpoint
  -> reviewed Mock factory -> V6 candidates -> strict validators -> local authority mergers -> V6 runner
  -> fresh baseline 12/48; fresh Mock 24/24 zero-call + 48/48 strict runtime
  -> semantic/model-owned 1/1/1; monotonic local P95; synthetic usage 37020/1882; cost 0 CNY
  -> gate mock_quality_not_evidence; Mock evidence deleted by exact run path; Live artifacts remain 0
  -> full static + PostgreSQL 12/12 + Compose default-off + V1--V5 validators
  -> no credential/Provider/product Docker/API/browser/product wiring; 3500ms not in product executor

V6 R5 unique branch controlled-Live
  -> approved process-only component credentials -> marker/journal fsync -> 24/24 guard zero-call
  -> first pair dispatches Tutor + Organizer once; ledger reserved/terminal entries 2/2
  -> Tutor provider_runtime/unknown at about 21ms -> Organizer sibling post_dispatch_abort
  -> quality_gate_impossible breaker -> remaining 46 runtime not_started_quality_breaker
  -> 2 provider invocations + 0/48 strict runtime; semantic/P95/token/CNY all null
  -> completed_run evidence -> evidence_sealed -> bundle validator ok; no recovery claim
  -> V6 terminal quality_gate_failed; no retry/replay/probe and no R6/R7/main

V7 R0 zero-provider transport-remediation design
  -> freeze V2 dataset + V6 prompt/candidate/local-authority bytes and SHA
  -> distinguish runner dispatch, executor invocation, HTTP dispatch, HTTP response, verified usage
  -> first-party V4 Pro direct adapter; do not infer wire stage from AI SDK generic error markers
  -> executor_entered -> request_validated -> provider_dispatch_started -> provider_response_received
  -> response_audit_passed -> content_parsed -> schema_validated -> usage_validated
  -> provider dispatch hook append+fsync before fetch; hook failure keeps delegate zero-call
  -> fixed request/transport/HTTP/audit/structured/usage/abort/timeout/harness taxonomy; no raw content
  -> R0 当时只允许 R1；无 source implementation/provider/Docker/API/browser/live artifact

V7 R1 zero-provider direct adapter + wire diagnostics
  -> first-party-deepseek-v4-pro-direct-v1 + phase-6.9.7-v7-wire-diagnostics-v1
  -> exact /v1/chat/completions + deepseek-v4-pro + non-thinking JSON-object + stream=false
  -> no tools / retry；默认 delegate=production provenance，注入 delegate=synthetic_test
  -> opaque capability single claim -> lane-local serial reducer -> first-terminal-wins + late drain
  -> eight monotonic stages -> executor/dispatch/response/verified-usage counters
  -> dispatch stage hook 在 fetch delegate 前完成；hook failure -> delegate zero-call
  -> private taxonomy -> exhaustive shared failure projection；raw error/body/header/prompt/key 不交接
  -> canonical V6 Tutor/Organizer schema + frozen prompt SHA compatibility
  -> no V7 runner/CLI/env/marker/journal/evidence/product wiring/provider/Docker/API/browser
  -> R1 checkpoint 当时只允许 R2 zero-provider runner/lineage；后续 R2 已完成

V7 R2 zero-provider runner + lineage + durable wire evidence
  -> independent report/runner/CLI/approval/marker/journal/evidence/recovery/validator
  -> fixed 72/24/48/24/32; guard-first; serial pairs; at most two lanes; single dispatch; no retry
  -> lane_reserved -> durable eight-stage wire prefix -> runtime/pair terminal -> breaker/run completion
  -> recompute executor/dispatch/response/verified-usage counters from journal and report
  -> first runtime contract failure -> close current pair -> quality_gate_impossible -> later lanes not started
  -> incomplete runtime/usage/duration/wire aggregate -> formal semantic/P95/token/CNY all null
  -> recovery seals durable prefix only; no adapter/key/provider/resume/replay/retry/backfill
  -> V1--V6 bidirectional lineage + provenance/path/aggregate tamper fail-closed
  -> no formal Mock/Live, V7 artifact, credential, Provider, product wiring, Docker/API/browser
  -> R3 zero-network fault matrix/static/Mock only was next

V7 R3 zero-provider fault matrix + reviewed static/Mock checkpoint
  -> frozen V2 runtime cases -> real V6 candidate/projection/prompt/schema/local merger
  -> first-party direct adapter -> injected in-process synthetic fetch -> bounded ordinal-only response
  -> exact transport/HTTP/response/non-thinking/schema/usage failure category + stage + four counters
  -> first/middle/last breaker + lane-local sibling abort attribution + no retry/backfill
  -> fresh baseline 12/48; reviewed Mock 24/24 guard + 48/48 strict + semantic/model-owned 1/1/1
  -> executor/dispatch/response/verified usage 48/48/48/48; gate mock_quality_not_evidence
  -> full static + PostgreSQL 12/12 + Compose default-off + V1--V6 validators + V7 artifact 0
  -> no credential/Provider/product wiring/Docker/API/browser; R4 exact authorization gate was next

V7 R4 unique branch controlled-Live terminal
  -> zero-network preflight -> process-only component credential mapping -> marker/journal fsync
  -> 24/24 guard zero-call -> first runtime pair dispatches Tutor + Organizer lanes
  -> Tutor response -> content/schema/usage validated -> candidate_applied -> wire 1/1/1/1
  -> Organizer response -> response audit -> content parsed -> provider_type_validation failure
  -> close pair -> quality_gate_impossible -> later 46 runtime not_started_quality_breaker
  -> aggregate wire 2/2/2/1; strict 1/48; semantic/P95/token/CNY null
  -> run_completed -> hard-link evidence -> evidence_sealed -> validator ok
  -> no retry/resume/replay/backfill; R5/R6/main blocked

V8 R0 zero-provider remediation design
  -> read sealed stage/counters only; never recover raw output or retry V7
  -> json_object provider fence != local Zod schema enforcement
  -> V6 nested conditional union + ideal Mock leaves provider-shape coverage gap
  -> freeze fixed decision shape: questionIndex + subjectIndex + deckAction + targetIndex
  -> dynamic fingerprint/subject/deck/topic/snapshot/write authority remains local
  -> bounded reason/count/type-shape hash; rawDataRetained=false
  -> new V8 identity and R1-R7 gates; no source/runtime/Mock/Live/product wiring in R0

V8 R1-R5 closure
  -> fixed-shape candidate -> Provider-like robustness -> independent runner/durability -> reviewed Mock
  -> unique Live: 24/24 guard -> 4 complete wire lanes -> 3/48 strict
  -> second Organizer passes static schema, then fails local dynamic_authority
  -> quality_gate_failed -> V8 sealed; no retry/product/main

V9 R0-R3 option-selection and durable runner
  -> owner-scoped validated V5 shortlist
  -> local option builder enumerates complete valid subject/deck/topic decisions
  -> bounded prompt exposes option labels + indexes, never real IDs/write command/fingerprint
  -> model exact output: decisions[{questionIndex, optionIndex}]
  -> local map injects shortlist fingerprint -> V6 validator -> V6 merger
  -> pre/post/final stale-write authority remains local
  -> independent 72/24/48/24/32 runner + 8-stage wire + durable lane/journal/evidence/recovery

V9 R4 reviewed Mock
  -> CLI mock injects reviewed factory; live remains unavailable until R5
  -> Tutor -> unchanged V6 production candidate
  -> Organizer -> V9 option selection -> V6 validator/merger
  -> both -> first-party direct adapter -> synthetic fetch only
  -> responder reads actual bounded prompt; never expected/oracle
  -> 24/24 guard zero-call -> 48/48 strict -> wire 48/48/48/48 -> semantic 1/1/1
  -> mock_quality_not_evidence -> validate exact evidence -> delete exact Mock path
  -> V9 marker/journal/evidence/recovery = 0; no Provider/product/main
```

```text
V9 R5 唯一 controlled-Live
  -> 24 guard -> candidate guard -> verified Provider zero-call 24/24
  -> reserve pair 0 Tutor + Organizer lanes -> append/fsync lane_reserved
  -> Tutor executor -> request_validated -> provider_dispatch_started
  -> Organizer executor -> request_validated -> provider_dispatch_started
  -> Tutor response 前 transport failure -> provider_runtime / transport
  -> sibling abort Organizer -> post_dispatch_abort
  -> terminal 2 -> quality_gate_impossible breaker -> remaining runtime not_started 46
  -> wire 2/2/0/0 -> strict 0/48 -> semantic/P95/token/CNY null
  -> marker/journal/evidence durable seal -> validator ok -> no recovery claim
  -> no retry/probe/product Docker/main
```

```text
Architecture Recovery R1（zero-provider）
  -> 保留 sealed first-party direct adapter V1 与现有 public transport projection
  -> 新 diagnostic adapter 包装 V1 的 fetch delegate
  -> delegate throw
       -> signal already aborted ? aborted
       -> own data code/name + bounded cause depth <= 4
       -> fixed subtype only:
          timeout / dns / tls / proxy / connection_refused /
          connection_reset / network_unreachable / unknown
  -> readTransportDiagnostic() 仅返回 frozen version + subtype
  -> 不读取 getter/message/stack，不保存 raw error/URL/header/body/prompt/key
  -> 不写 ModelAgentTrace、V1--V9 report/evidence/validator
  -> injected fetch 永久 synthetic；默认 global fetch 才可声明 diagnostic provenance
  -> R2 前不读取 credential、不调用 Provider、不创建 canary artifact
```

```text
Architecture Recovery R2（zero-network synthetic contract）
  -> CLI 只接受 mock | fault-matrix
  -> exact fact-free request + strict { ok: true } schema
  -> closed scenario enum（20 个模块内脚本）
       -> Response / fixed throw / abort wait
       -> 无调用方 fetch / transport / credential / env 注入口
  -> diagnostic wrapper -> sealed V1 direct adapter -> synthetic responder
  -> 每次调用 reserve 1 call / 512 input / 16 output / 0.00200000 CNY cap
  -> wire executor / dispatch / response / verified usage 独立计数
  -> bounded outcome + R1 transport subtype + no raw error
  -> Mock complete；fault matrix 21/21（含 pre-abort 与 runner timeout）
  -> authority=synthetic_test / qualityAuthority=none
  -> 不写正式 artifact，不证明 HTTP、Provider usage/cost 或外部健康
  -> 下一步真实 canary 必须取得新的明确授权
```

```text
Architecture Recovery R3（zero-provider controlled-Live boundary）
  -> exact confirmation + approval env + dedicated credential
  -> fixed branch + clean tracked worktree + HEAD == tracking commit
  -> public CLI 固定内部 production ports；无 fetch/URL/model/writer/retry 注入口
  -> evidence root 经 resolve 标准化；relative containment 拒绝父目录/绝对逃逸
       -> 首次授权 CLI 的 Windows 目录 URL 尾分隔符曾在此被旧字符串围栏误拒绝
       -> reservation 前终止；Provider invocation/dispatch=0；marker/journal/claim/artifact=0
       -> 修复后旧 exact confirmation 不复用，等待新 exact confirmation
  -> exclusive marker(owner PID/token) + marker SHA
  -> attempt_reserved + fsync
  -> single fact-free dispatch / no retry
  -> monotonic wire_stage hash-chain
  -> runtime_terminal(report + report SHA)
  -> publication_started（此后 I/O failure 永久 fail-closed）
  -> exclusive hard-link artifact -> evidence_published -> strict validator
  -> crash-only seal 只消费 durable prefix，不读 credential、不创建 transport、不重放 Provider
  -> artifact authority=controlled_live / status=diagnostic_only / qualityAuthority=none
  -> 唯一 run 253a5df5... 正常 runtime seal
       -> wire 1/1/0/0 -> transport_failed / connection_refused
       -> dispatched_no_response -> usage/token/CNY=null
       -> 7-record journal -> evidence_published -> recovery claim=null
  -> zero-network correlation：proxy -> loopback:7897；listener=0；未证实为唯一 socket 根因
  -> R3 不得重跑；R4、小样本、48-case、产品/main 继续阻断
```

```text
Architecture Recovery proxy preflight（independent / zero-provider）
  -> CLI composition 只读取固定 8 个 proxy / NO_PROXY key
       -> Windows/Bun accessor -> own-data snapshot
       -> 不枚举整份 env，不读取 .env 或模型 credential
  -> exact own-data validation
       -> NO_PROXY 非空 -> no_proxy_unsupported
       -> proxy authority 冲突 -> proxy_config_conflict
       -> credential / 非 HTTP / 非 loopback / 非法端口 / path/query/hash -> fail-closed
  -> proxy absent -> direct_ready / listenerProbeCalls=0 / providerCalls=0
  -> coherent loopback HTTP proxy
       -> core-owned 250ms watchdog
       -> one TCP connect to 127.0.0.1 or ::1 / no payload / immediate destroy
       -> listening -> loopback_proxy_ready
       -> refused or timed out -> loopback_proxy_unavailable
       -> throw or abnormal result -> listener_probe_failed
       -> external abort -> aborted
  -> output only version + enum + boolean + counters; no URL/raw error/socket peer
  -> first actual: loopback_proxy_unavailable / configured=4 / probe=1 / providerCalls=0
  -> diagnostic-only：不创建 marker/journal/artifact，不证明 HTTP/DNS/TLS/Provider/账号健康
  -> V2 C2 已实现固定 ordering；L1 已按该顺序完成唯一 dispatch 并封存
  -> R3/V2/L2 均不得重跑；原 R4、48-case、产品/main 继续阻断
```

```text
Architecture Recovery Provider Canary V2（D0/C1/C2/S1/L1 complete）
  -> independent namespace；不复用 R3/R4 confirmation/marker/journal/artifact/recovery
  -> semantic stages：D0 design -> C1 contract -> C2 durability -> S1 static -> L1 Live -> P1 decision
  -> C1 actual closed path
       -> CLI exact one arg：mock | fault-matrix
       -> module-owned synthetic env/probe；无 host credential/source/Provider port
       -> proxy preflight rejected -> no attestation
       -> proxy preflight ready -> mint empty in-memory WeakMap capability
       -> synchronous single-consume；clone/forgery/replay/concurrent losers rejected
       -> report synthetic_test / none / unknown / zeroNetwork=true
       -> downstream credential/source/marker/delegate/call = 0/0/0/0/0
       -> V7 wire not_started = executor/dispatch/response/usage 0/0/0/0
       -> fault matrix 15/15；rawDataRetained=false
  -> C2 tested production ordering
       -> exact CLI args
       -> snapshot only 8 proxy / NO_PROXY keys
       -> proxy preflight
            -> rejected: credential/source/marker/Provider all 0-call
            -> ready: mint one in-memory single-consume attestation
       -> source branch/clean/tracking/remote parity
       -> read V2 approval + dedicated credential
       -> exclusive V2 marker + durable attempt reservation
       -> one fact-free dispatch / 5000ms / 1-512-16 / 0.002 CNY / no retry
       -> bounded terminal -> exclusive artifact -> strict validator
  -> durability
       -> exclusive marker + sequence/previousHash/recordHash + fsync
       -> 8-stage wire monotonicity；dispatch stage durable before delegate boundary
       -> single terminal + single publication winner
       -> publication_started 后永久 evidence_io，不二次 publish
       -> crash-only seal：不 preflight/credential/transport/Provider；live owner reject；dead owner single winner
       -> existing runtime terminal 只允许原 report 的 publication recovery
  -> package boundary
       -> public CLI 只接 args + AbortSignal
       -> test core/seam 不从 @repo/ai index 导出
       -> V2/R3 confirmation/filename/marker/schema 双向拒绝
  -> listener ready 不是代理转发、DNS/TLS、Provider、账号或产品 authority
  -> D0 actual：loopback_proxy_ready / configured=4 / probe=1 / providerCalls=0
  -> S1：C2 32/32；Recovery 91/91；AI 323/323；R3 SHA/validator unchanged；formal V2 artifact=0
  -> L1 actual：run dc09214c... / complete / strict response + verified usage
       -> wire 1/1/1/1；usage 49/5；cost 0.00017700 CNY
       -> journal 12 records -> evidence_published；validator ok=true；artifact 98368de...a7e4
       -> diagnostic_only / qualityAuthority=none；no recovery claim；不得重跑
  -> P1 complete：zero-provider small-sample semantic gate 设计已冻结
  -> G1 complete：manifest/baseline/report/scorer/gate 与 oracle 隔离已 zero-provider 落地
  -> G2 complete：one-shot runner/source/authority/journal/marker/artifact/validator/seal 已落地
  -> S2 complete：reviewed candidate/adapter/validator/merger + fault/static/history checkpoint
       -> 8/8 guard；16/16 strict/wire/usage；semantic 1/1/1
       -> mock_quality_not_evidence；formal L2 artifact=0；approved tag=0
  -> L2 complete：source/tag 4c608445...c22af1c4 + data-boundary + exact authorization
       -> run 6918df4f...；8/8 guard；16/16 strict/wire/usage
       -> semantic 0.9141666667/1/0.9570833333；usage 7032/244；0.02256 CNY
       -> journal 180 -> evidence_published；validator ok=true；artifact a1b51f...eb0d
       -> small_sample_semantic_gate；P95=null；不得重跑
  -> P2 complete：zero-provider full-gate design 已冻结
       -> 72/24/48/24/32；manifest e68e6e27...12c78
       -> baseline authority 2ab1030f...a5f2；policy 11371d16...f503
       -> 24-sample P95；48 calls / 0.55 CNY；new durability lineage
  -> F1 complete：zero-provider full contract/baseline 已落地
       -> logical/physical baseline 16c574b1...2c9 / 16aa1773...6f73
       -> strict scorer/gate + anchor/P95/null aggregate + lineage rejection
       -> focused 14/14；Agent full 1076/1076；providerCalls=0
  -> F2 complete：zero-provider one-shot runner/durability/evidence 已落地
       -> 24 guards + 24 serial pairs / 48 lanes；independent budget/abort/timeout
       -> exclusive marker + fsynced hash-chain journal + hard-link artifact + strict validator
       -> crash-only seal；focused 32/32；Agent full 1108/1108；formal bundle/tag=0
  -> S3 complete：zero-provider reviewed Mock/static
       -> 24/24 guard；48/48 strict/wire/usage；semantic 1/0.996875/0.9984375
       -> L2 anchor 1/1/1；full_gate_mock_quality_not_evidence；formal bundle/tag=0
  -> L3 failed sealed：run 2b0ac3a0... / deepseek_network / full_gate_quality_gate_failed
       -> approved source/tag 3c5cc6c...；fresh preflight direct_ready / providerCalls=0
       -> 24 guards zero-call；runtime 22/22/0/26；wire 22/22/22/21；strict 21/48
       -> tutor runtime-11 response parsed -> schema failure -> breaker；remaining 26 not-started
       -> semantic / anchor / P95 / token / CNY = null；safety failures=0
       -> journal 296 -> evidence_published；validator ok=true；recovery claim=0
  -> current stop：L3 不得重跑；不执行产品/main/Phase 6.9.8
```

```text
P1/G1/G2 Small-sample Semantic Gate（design + contract/baseline + durability / providerCalls=0）
  -> source dataset phase-6.9-tutor-wrong-question-v2 / SHA 42803d45...b437b
  -> manifest ae667f1c...edf61
       -> Tutor guards 4：route / credential / injection / hostile accessor
       -> Organizer guards 4：owner / credential / injection / hostile accessor
       -> runtime pairs 8：01/08/10/12/15/19/23/24
       -> 16 lanes / 12 Organizer decisions
       -> Tutor 5 intents + zh/en/mixed/conflicting
       -> Organizer 6 subjects + create/reuse + single/batch + locked/no-write
  -> deterministic subset baseline / providerCalls=0
       -> Tutor 5/8 / semantic 0.7070238095238095
       -> Organizer 0/12 / semantic 0.2375
       -> Combined 0.47226190476190477
       -> canonical payload d36d0789...d9f4e
       -> logical report ad3aa54d...d002 / physical file e8bcbcb5...658b
  -> G1 strict contract / eval policy 1cab7786...399a
       -> fixed 24-entry order + source/oracle binding
       -> aggregate/wire/usage/scheduler/gate 全由 entries 重算
       -> incomplete formal aggregates = null / P95 = null
       -> Mock = mock_quality_not_evidence / prior lineage rejected
  -> future Live quality gate
       -> guards 8/8 zero-call
       -> runtime strict/wire/verified usage 16/16/16/16
       -> Tutor/Organizer/Combined semantic >=0.85
       -> Tutor/Organizer improvement >=0.15
       -> critical/permission/mutation/broader fallback = 0
  -> latency：8 values 不生成 P95；3500/5000ms hard timeout + median/max only
  -> budget：16 calls / 37600 input / 8800 output / 0.176 CNY / no retry
  -> execution：guard-first -> pair-serial -> independent sibling lanes -> fixed denominator
  -> lineage：new marker/journal/artifact/validator；拒绝 V1--V9/R3/R4/L1 identity
  -> G2 production boundary
       -> public CLI only args + AbortSignal；fixed internal production ports
       -> preflight -> future L2 admission tag -> approval -> dedicated credential -> marker
       -> lane_reserved/wire/terminal/publication fsynced hash-chain
       -> exclusive hard-link artifact + strict recomputing validator
       -> crash-only seal：current pair zero-wire attempted_aborted；later pairs quality-breaker
       -> parent request cancellation = external_abort；lane-local cancellation = abort
       -> focused 32/32；formal marker/journal/artifact/recovery claim = 0
  -> S2 reviewed Mock/static
       -> actual bounded prompt only；responder 不读 expected/oracle
       -> actual 由 model-owned decision + local authority + merger 重建
       -> semantic axes / locked name / no-write cross-check
       -> 35/35 focused；8/8 guard；16/16 strict/wire/usage；semantic 1/1/1
       -> mock_quality_not_evidence；formal L2 files=0；S2 不创建 approved tag
  -> L2 unique controlled-Live
       -> exact source/tag + fresh data boundary + exact authorization
       -> 8/8 guard；16/16 strict/wire/usage；semantic 0.9141666667/1/0.9570833333
       -> durable seal；small_sample_semantic_gate；P95=null；no retry/replay
  -> P2 complete：full manifest/baseline/policy/P95/budget/durability design
  -> F1 complete：full contract/baseline/writer/scorer/gate
  -> next：F2 zero-provider one-shot runner/durability/evidence
  -> 不直接授权 48-case Live、产品或 main
```

```text
P2 Full-gate Design（providerCalls=0）
  -> identity：phase-6.9.7-tutor-organizer-full-gate-v1
  -> full manifest
       -> source V2 dataset 42803d45...b437b / source policy b3913403...f009d
       -> 12 Tutor guards + 12 Organizer guards + 24 runtime pairs
       -> 72 entries / 48 runtime lanes / 32 Organizer decisions
       -> manifest e68e6e27...12c78
  -> deterministic full baseline
       -> 12/48 complete；semantic 0.6629642857/0.278125/0.4705446429
       -> source report 0ce7c3ca...116ca / P2 authority 2ab1030f...a5f2
  -> full eval policy 11371d16...f503
       -> full Tutor/Organizer/Combined >=0.85；two improvements >=0.15
       -> same-run L2 anchor subset also passes P1 thresholds
       -> 24/24 guard；48/48 strict/wire/usage；all safety failures=0
  -> latency
       -> 24 samples / nearest-rank 23
       -> Tutor 2500；Organizer/paired 4500；Tutor local orchestration 6500
       -> hard timeout 3500/5000；incomplete aggregates=null
  -> budget：48 calls / 112800 input / 26400 output / 0<CNY<=0.55 / no retry
  -> execution：guard-first -> pairs serial -> sibling lanes max concurrency 2
       -> independent abort/terminal -> pair-close breaker -> fixed denominator
       -> dispatch-before-call hash-chain+fsync -> hard-link publication -> crash-only seal
  -> lineage：new source tag/approval/credential/marker/journal/artifact/validator
       -> candidate/adapter hashes stay equal to L2 approved source 4c608445...c22af1c4
       -> reject V1--V9/R3/L1/P1--L2 identities in both directions
  -> authority：zero_provider_full_gate_design
  -> F1 implementation
       -> authority：zero_provider_full_contract_baseline
       -> baseline logical/physical SHA：16c574b1...2c9 / 16aa1773...6f73
       -> Mock gate：full_gate_mock_quality_not_evidence；qualityAuthority=none
       -> Live pass only：full_gate_quality_gate_passed / full_gate_semantic_gate
  -> next only F2；no tag/credential/Provider/Docker/product/main
```

Tutor Task 3/5 已完成受治理 candidate 与 Web default-off composition；Organizer Task 4/6/7/8 已完成 candidate、owner/write fencing、server-only runtime、Trace/API/UI 来源闭环。Task 9--11 建立 72-case paired evidence 与分支 checkpoint；Task 12 V1 证明一次真实 provider/usage/费用路径，但 canonical strict runtime 与语义质量不足。V2 R1--R6 完成 prompt/contract、anti-overfit、独立 lineage、一次性 evidence、请求取消、失败终态、同题跨路由写入收敛和未写题补偿；R7 则在结构化对象形成前全量 runtime 失败。V3 R0--R4 已把有界 failure evidence、breaker、固定分母、双 lane 隔离、真实 invocation、dispatch ledger、usage/P95 fail-closed、dispatch-before-call hash-chain journal、活 owner/recovery claim、orphan seal、hard-link evidence 与 static/Mock checkpoint 落地。唯一 V3 R5 的 28 个 runtime 均获得 verified usage；第 14 对 Organizer 的结构化对象在本地 subject authority 动态合同失败后熔断，剩余 20 个 runtime 不启动，固定分母仍为 48，journal 完整封存 `quality_gate_failed`。V4 R0 又把已执行语义偏差、动态合同失败与 breaker 未执行分开并冻结新设计；V4 R1 已落地独立 case/report diagnostics、合同 stage、两 Agent bounded 语义轴、Organizer 单一 reason 链和历史隔离；V4 R2/R3 分别把 Tutor 与 Organizer 的 formatter/validator/merger 及本地不变量收敛为深冻结 policy，同时让历史 paired eval 显式保留 V2 prompt path。V4 R4 再以独立 fixtures 验证 anti-overfit、prompt leakage、authority/reorder/abort/budget/write isolation，并建立与三版历史双向隔离的 V4 marker/journal/recovery/evidence；R5 通过 fresh Mock、全量静态、PostgreSQL E2E、Compose default-off、历史 SHA/validator 与零残留 checkpoint。六步都没有改写历史 Live authority 或调用 Provider。Organizer 仍是同步 API，不冒充 durable job 或跨实例 provider exactly-once；本地 journal/claim 也不证明跨主机分布式 lease、Provider exactly-once 或突然断电后的目录元数据持久性。两个 candidate 仍不拥有最终回答、RAG/approval、userId/真实 ID、用户锁定名称或数据库写权限；default-off 时继续使用本地确定性策略。V1/V2/V3 都不得重跑；后续唯一 V4 R6 已经失败封存且同样不得重跑。V4 完整边界见 `docs/superpowers/specs/phase-6-9-7-tutor-organizer-v4-remediation-design.md`；R1--R5 证据见 `docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r1-bounded-diagnostics.md`、`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r2-tutor-semantics.md`、`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r3-organizer-semantics.md`、`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r4-robustness-lineage.md` 与 `docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r5-static-mock.md`。

后续唯一 V4 R6 已使用独立 identity 执行并失败封存；V5 R0 随后区分坏 fixture、产品 candidate 拒绝
与真实语义弱点。V5 R1--R5 又冻结独立 V2 coherent dataset/policy/baseline、Tutor local-signal
authority、Organizer ordinal shortlist、原生 runner/lineage 与 reviewed static/Mock checkpoint。唯一 V5
R6 再使用独立 `deepseek_network` identity 执行：`24/24` guard zero-call、6 对完成、12 次 Provider
invocation、`11/48` strict runtime；第 6 对 Tutor 在 `3021ms` 越过冻结 `3000ms` timeout 后打开
breaker，后续 36 runtime 没有启动。正式 semantic/P95/token/总费用因不完整全部为 `null`；11 条
verified entry 的 subtotal 只能用于复盘。Evidence、58 条 hash-chain journal 与一次性 marker authority
已封存，V1--V4 SHA/validator 不变且不存在 recovery claim。V5 不得重跑，也不得进入 R7、产品
Docker/API/browser、Task 13/main、Phase 6.10、Phase 8/9 或博客收尾。V6 R0--R4 后续已完成零
Provider 设计、source contracts、bounded candidates、actual shortlist 双 stale composition、独立
robustness、runner/lineage/durability 与 reviewed static/Mock checkpoint。唯一 V6 R5 又在首对 Tutor
`provider_runtime / unknown` 后熔断，Organizer sibling aborted；2 次 invocation、`0/48` strict runtime，
正式聚合全 `null`。Artifact 已 seal 且 validator 通过；V6 不得重跑或进入产品验收。R3 的文件 fsync
不等于父目录 fsync 或跨主机 lease；recovery claim 的 journal tail 在
appender/seal 二次校验，且尚缺 stale claim rename 后再次崩溃的专门测试。
V7 R0 随后只读拆分现有 runner dispatch、candidate executor、AI SDK/middleware 与 HTTP wire 边界；冻结
第一方 V4 Pro direct adapter、8-stage wire prefix、executor/dispatch/response/usage 四类计数和 R1--R6
路线。V7 R1 已实现 adapter 与 capability；V7 R2 又把同一 capability 接入独立 runner、一次性 marker、
hash-chain journal、hard-link evidence、crash-only recovery 与双向 lineage。V7 R3 再用真实 V6
candidate/schema/projection/prompt/merger 和冻结 48 runtime 完成 zero-network fault matrix 与 reviewed
Mock；只有 fetch delegate 为 synthetic，`mock_quality_not_evidence` 不改变产品 authority。唯一 V7 R4
随后执行：首对 Tutor 完成 8-stage success，Organizer 在 `content_parsed` 后于
`provider_type_validation` 失败，wire `2/2/2/1`、strict `1/48`，正式 aggregate 全 `null`。Artifact 已
seal 且 validator 通过；V7 不得重跑，R5/R6/main 被阻断。当前产品仍走既有 default-off composition。
V8 R0--R4 随后完成 fixed-shape contract、bounded diagnostic、Provider-like robustness、独立 runner/
durability 与 reviewed Mock；唯一 R5 已在 static schema 后命中本地 `dynamic_authority` 并失败封存。
V9 R0--R3 再把 Organizer 收敛为本地完整合法 option + 模型 exact index selection，并建立独立
runner/lineage/durability；R4 reviewed Mock 已穿过正式 V6 Tutor、V9 Organizer、V6 merger 与 direct
adapter，只有 fetch 为 synthetic。Mock run `f039a7d2...` 为 `24/24` guard、`48/48` strict、wire
`48/48/48/48`、semantic `1/1/1`，gate 固定 `mock_quality_not_evidence`；evidence 已精确删除，R4
checkpoint 当时正式 V9 artifact=0。唯一 R5 随后在 pair 0 的 Provider response 前以 Tutor transport 与
Organizer sibling abort 结束，wire `2/2/0/0`、strict `0/48`、正式聚合全 `null`。V9 artifact 已 seal，
不得重跑或追加探测；仍无 V9 真实语义或产品结论。
详见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r0-zero-provider-root-cause.md` 与
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r1-dataset-authority.md`、
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r2-tutor-local-signal-authority.md` 与
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r3-organizer-ordinal-shortlist.md` 与
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r4-runner-lineage.md` 与
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r5-static-mock.md` 与
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v5-controlled-live-failure.md` 与
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r0-zero-provider-design.md` 与
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r1-source-contracts.md` 与
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r2-bounded-candidates.md` 与
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r3-runner-lineage.md` 与
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r4-static-mock.md` 与
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v6-controlled-live-failure.md`、
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v7-remediation-design.md` 与
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r0-zero-provider-postmortem.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-v7-r1-zero-provider-adapter.md` 与
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r2-runner-lineage.md`、
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r3-static-mock.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-v7-controlled-live-failure.md`、
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v8-remediation-design.md` 与
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v8-r0-zero-provider-postmortem.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-v8-r4-static-mock.md`、
`docs/acceptance/2026-07-29-phase-6-9-7-tutor-organizer-v8-controlled-live-failure.md`、
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v9-remediation-design.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-v9-r4-static-mock.md`、
`docs/acceptance/2026-07-30-phase-6-9-7-tutor-organizer-v9-controlled-live-failure.md`。

当前 `/knowledge` 页面数据流：

```text
用户打开知识库页面
  -> useKnowledgeDocumentList({ limit: 50 })
  -> useKnowledgeAgentSuggestions({ limit: 20 })
  -> GET /knowledge/documents
  -> GET /knowledge-agent/suggestions
  -> 展示资料状态摘要和卡片列表
  -> 展示重复、可能新版、互补资料、集合和标签建议

用户上传资料
  -> useUploadKnowledgeDocument()
  -> POST /knowledge/documents multipart
  -> 新资料 Document(status=PENDING) 或返回同 contentHash 的已有 Document
  -> 列表和资料管理建议失效刷新

用户在资料卡片菜单中重新上传
  -> useReplaceKnowledgeDocumentFile()
  -> PUT /knowledge/documents/:id/file multipart
  -> 同一个 Document 重置为 PENDING，旧 chunks 清空
  -> 列表、详情、检索缓存和资料管理建议失效刷新

用户点击处理
  -> useProcessKnowledgeDocument()
  -> POST /knowledge/documents/:id/process
  -> inline: Document(status=DONE / FAILED)
  -> queue: Document(status=PROCESSING) + BackgroundJob(status=QUEUED / ACTIVE / SUCCEEDED / FAILED / STALE_SKIPPED)
  -> 处理中的资料和最新后台 job 短轮询刷新
  -> 列表、详情、检索缓存、后台 job 和资料管理建议失效刷新

用户手动检索测试
  -> useSearchKnowledge()
  -> POST /knowledge/search
  -> 展示命中文档、片段序号、相似度和内容摘要

用户删除资料
  -> DELETE /knowledge/documents/:id
  -> 列表、详情、检索缓存和资料管理建议失效刷新
```

关键约定：

- RAG 只增强回答，不阻断回答。
- 用户上传资料是低信任证据，不是系统、开发者或工具调用指令。
- `Chunk.metadata.safety` 是确定性安全分类元数据；它用于 prompt 过滤、Verifier guidance 和 UI 安全提示，不会自动删除、隔离、重写或替换用户资料。
- high-risk chunk 不进入 Chat prompt 或 citations；medium-risk chunk 只能作为明确标记的可疑原文引用；low-risk / safe chunk 可正常参与 RAG。
- 第一版资料来源以用户上传 PDF / DOCX / TXT / Markdown 为主。
- `Document.sourceType` 已预留 `UPLOAD`、`NOTE`、`WRONG_QUESTION`、`OCR` 和 `CHAT`；OCR、错题和聊天沉淀当前仍不自动入库。
- Phase 5.3 文档 API 按当前 `userId` 隔离，上传原文件进入 MinIO，`Document(PENDING, sourceType=UPLOAD)` 进入 PostgreSQL。
- `POST /knowledge/documents` 会按当前用户与 `contentHash` 做轻量去重；上传重复内容时返回已有 `Document`，并清理本次临时 MinIO 对象。
- `PUT /knowledge/documents/:id/file` 用于更新同一资料卡片的原文件；替换后保留原 `Document.id`，清空旧 chunks，状态回到 `PENDING`，用户需要重新处理入库；`PROCESSING` 中的资料禁止替换，避免旧 worker 与新文件交叉污染。
- 替换上传如果命中当前用户其它资料的相同 `contentHash`，服务端返回 `KNOWLEDGE_DOCUMENT_DUPLICATE`，避免产生两个内容相同的资料卡片。
- `PUT /knowledge/documents/:id/file` 在事务内使用 `status + updatedAt + storageKey + contentHash` 做 compare-and-swap；若资料已被处理或其它替换请求修改，返回 `KNOWLEDGE_DOCUMENT_PROCESSING`，并只清理本次新上传对象，不删除旧对象。
- `POST /knowledge/documents/:id/process` 写入前校验 document/user ownership，并在 claim、清 chunk、写 chunk、标记 DONE / FAILED 时持续校验 `status=PROCESSING + storageKey + contentHash` 快照，避免旧处理流污染新上传资料。
- `KNOWLEDGE_PROCESSING_MODE` 支持 `inline | queue`，默认 `inline`；`inline` 不投递 BullMQ，适合作为本地和降级 fallback；`queue` 需要 `REDIS_URL` 和已注册的 BullMQ worker。
- `SERVER_ROLE` 支持 `api | worker | both`：`api` 提供 HTTP API 但不注册 worker；`worker` 只创建 Nest application context 并注册 worker，不监听 HTTP 端口；`both` 同时提供 HTTP 与 worker，主要用于本地一体化开发。
- `WORKER_HEARTBEAT_INTERVAL_MS` 默认 15000，`WORKER_HEARTBEAT_TTL_SECONDS` 默认 45；heartbeat 通过 BullMQ Redis 连接写入，内容只包含不含 hostname / pid 的 opaque worker id、role、队列名、startedAt 和 lastSeenAt。
- `/worker-observability/summary` 默认只在非 production 开启；production 若显式 `WORKER_OBSERVABILITY_ENABLED=true`，也应只用于受控内网或临时诊断。
- Redis 是 queue 处理链路的必需依赖；当前 NestJS 会初始化 BullMQ 模块，本地开发建议继续随 postgres / minio 一起启动 redis。
- `Document` 状态流为 `PENDING -> PROCESSING -> DONE / FAILED`；空文本、零 chunk、解析失败或 embedding 失败进入 `FAILED`。
- forced reprocess 会在同一 processing 快照下先清旧 chunks，避免 stale retrieval；chunk 替换事务会使用 `SELECT ... FOR UPDATE` 锁定当前 Document 行。
- 当前真实 embedding 标准路径是 Qwen `text-embedding-v4` / 1536。production 必须显式提供 provider/model，Qwen 还必须提供无凭据 HTTPS base URL 和规范 `QWEN_API_KEY`；缺失或不匹配即 fail-closed，无 provider fallback。`Qwen_API_KEY` / `DASHSCOPE_API_KEY` 仅是宿主兼容输入，Docker server/worker 内部规范化为 `QWEN_API_KEY` 并共用同一 RAG runtime allowlist；`fake` 仅用于非 production 测试。
- `POST /knowledge/search` 只检索当前用户 `DONE` 文档 chunks，不跨用户、不检索未处理或失败文档。
- `POST /knowledge/search` 使用 pgvector cosine + PostgreSQL full-text 两路候选，按 `chunkId` 去重后 hybrid rank；`metadata.retrieval` 记录 `vectorScore` / `keywordScore`，当前无 reranker。
- 检索失败作为 RAG 增强失败处理，Chat 必须降级为普通 AI 回答。
- KnowledgeVerifierAgent 只消费 `/knowledge/search` 的命中结果，不单独读取数据库；无命中返回 `skipped`，可信资料返回 `trusted`，低分或过短资料返回 `insufficient`，包含“可能有误 / 待核对 / 不确定 / wrong / contradict”等风险标记时返回 `suspicious`，多个片段出现互斥答案标记时返回 `conflict`。
- verifier 结果只影响 prompt guidance、引用区提示和 debug headers，不修改 Document / Chunk，不自动纠错用户资料。
- KnowledgeDedupAgent / KnowledgeOrganizerAgent 已接入 embedding shortlist 与受限模型 candidate；当前生产 gate 默认关闭，所以在线默认仍走 deterministic fallback。`exact_duplicate` 的 hash 结论继续零调用；模型只产生受限关系、标签和集合建议，不自动修改资料。Knowledge credential/gate/timeout 只进入 API server，不进入 worker/web/admin，也不借用 Chat 或 Review/Planner 产品凭据。唯一 V2 Live 与 R7 分支产品证据已证明 gated candidate 可用；default-off 表示安全回滚状态，不表示模型链路不可用。
- `/knowledge-agent/suggestions` 经过 `JwtAuthGuard`，Service 层先校验可选 `documentId` 归属，再按当前 `userId` 读取最近资料；如果目标资料不在 recent limit 中，会补入目标资料参与分析，避免 targeted 查询因为分页窗口漏掉目标。
- KnowledgeAgent suggestions 只读，不写 Document / Chunk，不写资料集合或标签表，不自动清理 MinIO，不修改资料状态，不进入 Dexie `mutationQueue`，失败只影响建议面板。
- `GET /background-jobs`、`GET /background-jobs/summary` 和 `GET /background-jobs/:id` 经过 `JwtAuthGuard`，所有查询都按当前 `userId` 隔离；当前 `/knowledge` 用列表 API 展示单份资料的最近后台状态，用 summary API 展示账号级后台任务摘要。
- summary API 中 `activeCount` 使用账号级真实 active count，避免旧的 QUEUED / ACTIVE job 因不在最新 50 条窗口内被漏掉；`failedCount`、`staleSkippedCount`、`succeededCount` 表示最近 50 条任务窗口内的摘要。
- `InProcessEventBus` 是进程内非持久事件总线，不保证跨进程投递；`publish()` 会隔离单个 handler 失败并返回 `{ delivered, failed }`，失败 warning 只记录事件类型和计数，不记录完整 payload。
- `/knowledge` 只在存在处理中文档、本地刚触发处理或 summary 显示 active job 时短轮询后台任务摘要；静态 `PENDING` 或纯健康 recent jobs 不触发无限轮询。
- `BackgroundJob` 对外只暴露脱敏的 `payloadPreview` 与 `resultSummary`，例如 documentId、文件名预览、处理模式、chunk 数和耗时，不保存原文内容、完整 chunk、prompt、API key、access token 或 cookie。
- `/api/chat` 只把 access token 用于服务端代理检索，不写入日志、不注入 prompt、不保存到 ChatMessage。
- citations 第一版以 Markdown 追加到助手消息底部，不新增 ChatMessage schema 字段。
- `/knowledge` 页面是在线资料管理入口，文件上传、替换、解析、embedding、检索测试、后台 job 观测和知识库删除不进入 Dexie `mutationQueue`。
- `/knowledge` 页面只在存在 `PROCESSING` 文档或本地刚触发处理时短轮询文档列表与后台 job；静态 `PENDING` 不触发无限轮询，避免空耗请求。
- `/knowledge` 页面展示的资料管理建议是辅助判断，不是事实来源；用户仍然需要手动决定是否保留、替换或删除资料。
- `/knowledge` 资料卡片使用右上角三点菜单承载处理、重新上传和删除；点击页面其它区域会收起菜单；`DONE` 资料不再展示主按钮式“重新处理”，避免用户把已完成状态误解为必须再次处理。
- `Document` / `Chunk` 查询必须按当前 `userId` 隔离，禁止跨用户检索。
- `Chunk.embedding` 固定为 `vector(1536)`，向量索引和 embedding 持久化使用 raw SQL。
- API 级 RAG smoke 必须显式运行 `KNOWLEDGE_PROCESSING_MODE=queue`，轮询到 `BackgroundJob=SUCCEEDED`，并验证 `mode=hybrid`、有限 `keywordScore` / `vectorScore` 与同 case 无重复 `chunkId`。本地开发和自动化验收可使用 `RAG_EMBEDDING_PROVIDER=fake` 生成稳定伪向量，但它不证明真实语义质量。

## 5. OpenAPI 调试文档

```text
开发者或面试展示
  -> GET /api-docs
  -> Swagger UI 浏览核心 REST API、tags、认证标记、响应说明和核心写接口 request body 示例

自动化或工具检查
  -> GET /api-docs-json
  -> OpenAPI JSON
  -> 校验核心 tags、response envelope 描述和敏感内容缺失
```

关键约定：

- Swagger / OpenAPI 是调试和展示层，不是新的 contract 事实来源。
- `@repo/types` Zod schemas remain source of truth；字段变更仍应先改共享 schema、服务端 DTO / pipe、前端调用和测试，再同步 Swagger 描述。
- Swagger 不能反向驱动前端 contract，也不能替代 `@repo/types` 的 Zod runtime validation。
- Phase 7.5 起，注册、登录、知识库上传/替换/处理/检索、复习评分和 Agent Trace 写入有中文说明与安全 request body 示例；这些示例只用于调试展示，不代表新的 schema 来源。Swagger UI 中优先使用“隐藏敏感内容”这类直观说法，避免把“脱敏”这类安全术语直接丢给读者。
- 全局 response envelope 必须在文档中讲清：成功响应是 `{ success, data, requestId }`，错误响应是 `{ success, error, requestId }`；业务对象位于 `data` 中，错误详情位于 `error` 中。
- `/api-docs` 和 `/api-docs-json` 默认在非 production 开启；production 默认关闭。
- production 中显式 `SWAGGER_ENABLED=true` 只适合受控环境、内网或临时诊断，不应作为公开调试入口。
- 接入 Swagger 不放宽 `JwtAuthGuard`；受保护接口仍需要现有认证，并继续按当前 `userId` 隔离。
- OpenAPI 文档不得写入 API key、cookie、access token、refresh token、完整 prompt、完整回答、完整 RAG chunk、后台任务原始 payload 或真实用户内容示例。
- Phase 7.4 / 7.5 / 7.6 不改 Chat prompt、RAG prompt、模型路由或流式输出，因此不需要 live 模型 smoke。

## 6. OCR 与错题本

```text
用户选择图片或拍照
  -> 本地 preview URL 即时展示
  -> 并行：
      A. POST /api/ocr -> 外部 OCR 模型 SSE
      B. POST /uploads/images -> MinIO -> 服务端图片 URL
  -> OCR 输出完成
  -> 提取 OcrStructuredResult
  -> 写入 OcrRecord.parsedJson
  -> POST /ocr-records
  -> 若为有效题目：从结构化题目生成 activeStudyContext
  -> 用户确认保存错题
  -> POST /wrong-questions
  -> 错题保存成功：PostgreSQL + Dexie 缓存
     -> 非阻塞触发 WrongQuestionOrganizerAgent
     -> 成功：upsert WrongQuestionSubjectGroup / WrongQuestionDeck / WrongQuestionDeckItem
     -> 整理失败/取消：不回滚错题；保持 deckItems:none，后续 organize-batch 补偿
  -> 错题保存失败：Dexie mutationQueue 暂存，后续自动补偿同步
```

关键约定：

- `/api/ocr` 输出 display Markdown + structured JSON envelope。
- `OcrStructuredResult` 是 OCR 完成态的主要数据来源，旧 Markdown parser 仅作为历史记录和异常输出兜底。
- 当前错题来源仍以 OCR 为主。
- 非题目 OCR 不生成 `activeStudyContext`，不显示保存错题入口，也不套用题目分析框架。
- 保存错题入口只在有效题目 OCR 输出结束后出现。
- 多题 OCR 会拆成独立题目对象，错题防重 key 使用 `sourceGroupId:questionId`。
- `activeStudyContext` 从结构化题目对象生成，包含题目 id、题型、难度和识别提醒。
- `sourceRecordId` 指向服务端 `OcrRecord.id`。
- `/ocr-records` 与 `/wrong-questions` 不接收 `data:` base64 图片；前端创建请求前会剥离本地 base64。
- 新图片优先保存 `/uploads/images/users/...` 服务端 URL。
- 上传失败不阻塞 OCR，当前设备 Dexie 继续保留本地预览作为兜底。
- 创建错题后的自动整理是非阻塞流程，整理失败不影响错题保存结果。
- WrongQuestionOrganizerAgent 默认 gate 关闭时继续运行确定性 policy；Task 6--8 已接入 owner snapshot、三阶段 fence、model-free command、server-only runtime、Trace、HTTP abort 与 strict 来源状态。V2 R6 又验证 provider abort 无 Trace/command、command 失败终态、同题 single/batch/force 写入收敛和未写题 batch 补偿；仍没有 V2 Live 或产品验收。
- 一个错题同一时间只属于当前用户一个 organizer deck，服务端通过 `userId + wrongQuestionId` 唯一约束防止同一错题被重复归入多个专题。
- Organizer 在线调用不进入 Dexie `mutationQueue`、BullMQ 或 Outbox；失败由当前请求显式返回，未写入题由用户后续 batch 补偿。若未来自动后台整理，必须另建 durable job/outbox 与幂等恢复合同。

服务端 OCRRecord API：

| 方法     | 路径               | 说明                                                         |
| -------- | ------------------ | ------------------------------------------------------------ |
| `GET`    | `/ocr-records`     | 读取当前用户 OCR 历史，支持分页、状态、关键词和 `isQuestion` |
| `GET`    | `/ocr-records/:id` | 读取当前用户 OCR 详情                                        |
| `POST`   | `/ocr-records`     | 创建或按 `userId + groupId` upsert OCR 结果                  |
| `DELETE` | `/ocr-records/:id` | 删除当前用户 OCR 记录                                        |

服务端 WrongQuestion API：

| 方法     | 路径                   | 说明                                          |
| -------- | ---------------------- | --------------------------------------------- |
| `GET`    | `/wrong-questions`     | 分页列表，支持 `status`、`subject`、`keyword` |
| `GET`    | `/wrong-questions/:id` | 当前用户错题详情                              |
| `POST`   | `/wrong-questions`     | 创建错题，`sourceGroupId` 用于同用户防重复    |
| `PATCH`  | `/wrong-questions/:id` | 更新题目字段、备注、掌握状态                  |
| `DELETE` | `/wrong-questions/:id` | 删除当前用户错题                              |

错题组织层数据流：

```text
打开错题本首页
  -> GET /wrong-question-groups
  -> 展示学科卡片、错题数、未掌握数和已掌握数

进入某个学科
  -> GET /wrong-question-groups/:subjectGroupId/decks
  -> 展示专题 deck、知识点、难度和掌握进度

进入某个专题
  -> GET /wrong-question-decks/:deckId/questions
  -> 复用 WrongQuestion response 展示专题内错题

用户重命名专题
  -> PATCH /wrong-question-decks/:deckId
  -> nameLocked=true，后续 AI 建议不覆盖用户命名
```

服务端 Organizer API：

| 方法     | 路径                                                   | 说明                          |
| -------- | ------------------------------------------------------ | ----------------------------- |
| `GET`    | `/wrong-question-groups`                               | 读取当前用户学科卡片摘要      |
| `GET`    | `/wrong-question-groups/:subjectGroupId/decks`         | 读取当前用户某学科下专题 deck |
| `GET`    | `/wrong-question-decks/:deckId/questions`              | 读取当前用户某专题下错题列表  |
| `POST`   | `/wrong-question-organizer/organize/:wrongQuestionId`  | 整理单道错题，写入组织层      |
| `POST`   | `/wrong-question-organizer/organize-batch`             | 批量整理当前用户未归类错题    |
| `PATCH`  | `/wrong-question-decks/:deckId`                        | 更新专题名称、描述和锁定状态  |
| `POST`   | `/wrong-question-decks/:deckId/items`                  | 手动把错题移动到专题          |
| `DELETE` | `/wrong-question-decks/:deckId/items/:wrongQuestionId` | 只移除专题关联，不删除错题    |

组织层边界：

- `WrongQuestionSubjectGroup` / `WrongQuestionDeck` / `WrongQuestionDeckItem` 只服务错题本展示和手动整理，不修改 WrongQuestion 正文、答案、错因或备注。
- Organizer 不推进 FSRS，不写 Card / ReviewLog / ReviewTask。
- Organizer API 在线直连服务端，不进入 Dexie `mutationQueue`。
- `/error-book` 若 organizer API 不可用，会回退到原有平铺错题列表，避免错题本不可用。

权限边界：

- 所有业务 API 均经过 `JwtAuthGuard`。
- Service 层读写必须带当前 `userId` 条件。
- 访问不存在或不属于当前用户的数据，返回业务级 not found。
- 同一用户重复提交相同 `sourceGroupId`，返回 `WRONG_QUESTION_DUPLICATED`。

## 7. FSRS 复习

```text
错题详情
  -> POST /reviews/cards/from-wrong-question
  -> Card(wrongQuestionId) 写入 PostgreSQL
  -> 今日任务读取 /review-tasks/today
  -> 懒生成当日本地日期的 ReviewTask
  -> 用户查看答案并选择 Again / Hard / Good / Easy
  -> POST /review-tasks/:taskId/rating + clientMutationId
  -> @repo/fsrs 计算下一次复习时间
  -> 事务内更新 Card + 写入 ReviewLog(clientMutationId) + 完成 ReviewTask
  -> /plan 只读预览未来 Card.nextReview 加权压力
  -> /stats 读取 /reviews/stats 与 /reviews/logs
```

关键约定：

- Phase 4.1 使用 WrongQuestion-first 复习模型，不强制先迁移到 Question。
- `@repo/fsrs` 是纯调度算法包，不依赖 Prisma、NestJS、浏览器或系统时间副作用。
- `ReviewTask` 是 Phase 4.3 新增的持久化任务层，只记录 pending / completed / skipped / cancelled 生命周期。
- Card / ReviewLog / ReviewTask 均按当前 `userId` 隔离，所有 Review API 经过 `JwtAuthGuard`。
- ReviewTask 评分使用前端生成的 `clientMutationId` 幂等提交；服务端写入 `ReviewLog.clientMutationId`，同一评分命令重试不会重复写 `ReviewLog`。
- 复习评分在线成功时写入 PostgreSQL；离线或可重试失败时进入 Dexie `mutationQueue` 的 `reviewTask/rating`。
- 离线评分不会本地推进 FSRS、Card、ReviewLog 或统计；今日任务页只展示待同步状态，服务端同步成功后刷新 ReviewTask 和 Review stats 查询。
- `/review-tasks/today` 按当前用户本地日期懒生成到期任务，同一 `cardId + scheduledDate` 不重复创建。
- `ReviewPreference` 是 PostgreSQL 权威的账号级复习计划偏好，包含每日分钟、每日卡片上限、提醒时间、提醒开关、周末模式和计划窗口。
- `/review-preferences` 支持当前用户读取和 PATCH 偏好，前端保存成功后失效复习偏好与 ReviewTask 计划查询。
- `/review-tasks/plan` 是只读未来计划预览，只读取 `Card.nextReview`、`Card.difficulty` 和 `Card.stability` 计算未来压力，不创建未来 `ReviewTask`。
- 当前复习压力模型已升级为加权模型：`dueCount + overdueCount + overduePenalty + difficultPenalty + unstablePenalty`。
- `estimatedMinutes = max(reviewCount * 2, ceil(pressureScore * 2))`；容量状态根据预计分钟、卡片数量和 `ReviewPreference.dailyMinutes / dailyCardLimit` 计算为 `under / near / over`。
- `/review-tasks/:taskId/rating` 在事务内更新 Card、写入 ReviewLog、完成 ReviewTask，并关联 `reviewLogId`。
- `/review-tasks/:taskId/skip` 与 `/review-tasks/:taskId/reopen` 只改变 ReviewTask 状态，不更新 Card，也不写 ReviewLog。
- 今日任务页读取 persisted ReviewTask，评分、跳过和恢复后通过 TanStack Query 失效重新读取。
- 复习计划页 `/plan` 不执行评分和任务生成，只展示未来 7 / 14 天计划预览和容量偏好；今日任务仍是复习执行入口。
- ReviewAgent / PlannerAgent 只读建议流：

```text
Card + ReviewLog + ReviewTask plan + ReviewPreference + WrongQuestionDeck
  -> GET /review-agent/suggestions
  -> Nest 根据 JWT userId 建立 owner-scoped fact snapshot
  -> @repo/agent analyzeReview() + planStudy() deterministic baseline
  -> 仅在全局 Live、对应业务 gate、HTTPS provider、凭据与预算均满足时，调用受限 Review/Planner candidate
  -> 本地 merger 只接收弱点索引、block 排序和策略枚举，重新建立事实、分钟数、链接和只读建议
  -> read-only study suggestions + safe modelObservations
  -> /plan full suggestion and /today compact suggestion
```

- `GET /review-agent/suggestions` 经过 `JwtAuthGuard`，按当前 `userId` 聚合数据。
- ReviewAgent 负责识别薄弱知识点、逾期压力、Again / Hard 信号、低稳定度和高难度卡片。
- PlannerAgent 负责结合 ReviewAgent 输出、未来计划窗口和 `ReviewPreference` 生成今日重点、周计划节奏、容量提示和建议 block。
- 该建议链路不创建 `ReviewTask(source=PLANNER)`，不更新 Card / ReviewLog / ReviewPreference / WrongQuestion / deck 数据，不进入 Dexie `mutationQueue`。Phase 6.9.5 的 DeepSeek V4 Pro Docker API 和可见 `/plan` 已验证 candidate 路径，但 FSRS 与容量事实仍由后端确定。
- `REVIEW_AGENT_MODEL_ENABLED` 与 `PLANNER_AGENT_MODEL_ENABLED` 是仅 Nest HTTP server 的独立 rollback gate，默认均为 `false`，不会投影到 Web 或 worker；gate 缺失、超时、schema/usage 不可验证或任一安全门失败时只能返回 deterministic 建议和脱敏的降级状态。验收通过后也恢复 default-off。
- 2026-07-16~17 的 v1--v6 server-only controlled-Live profile 均在独立 once marker 下终态关闭，计数不可合并；v1--v4 为 `invalid_attempted / structured_output`，v5 为 `invalid_attempted / closed / 1 / false / structured_output`，V6 为 `invalid_attempted / closed / 1 / false / usage_unverifiable`。V6 表示 provider boundary 被触达一次但 usage 不可验证，不是 zero-call、零成本、账单或质量结论。私有 evidence 不进入用户建议、Trace、Docker 或浏览器数据流；六个 marker 均已消耗，当前阶段不得重跑 profile 或执行 V6 48-case/Docker/浏览器后续验收；两个业务 gate 继续默认 `false`。
- V7 诊断工程不改变产品数据流。唯一 Live 已封存 once marker 与 `finalized evidence_io` JSON，无 success seal、token/cost、prompt、response、credential、raw error 或 quality counters。这些证据只允许推导 23 次 provider attempts 与 terminal gate 关闭，不允许把模型候选注入 `/review-agent/suggestions`。因此当前 suggestions 继续走 deterministic read-only path，V7 不得重跑或作为 Docker/Web/worker/API 入口。
- V8 设计同样不改变当前产品数据流：它只为新的 server-only paired lineage 增加零字节、固定枚举、append-only stage markers 与独立 evidence。只有 V8 committed success 后才允许临时启用 Nest `server` 的单个 Review 或 Planner gate；Web/worker 不消费这些 gate，且每个组件验完必须重建 default-off `server`。
- 今日任务页读取当天 plan 摘要，展示“今日预计 N 分钟”和容量状态；plan 查询失败不影响今日复习主列表。
- 学习统计页 `/stats` 不在前端扫描原始表，只读取服务端聚合后的 Review stats/logs，并用客户端 ECharts 渲染趋势、评分分布和卡片状态。
- `/reviews/stats` 基于 `Card` / `ReviewLog` 聚合复习次数、掌握率、连续复习、评分分布、卡片状态和每日趋势。
- `/reviews/logs` 返回当前用户最近复习记录和错题摘要，`ReviewLog` 通过关联 `card.userId` 隔离用户。

服务端 Review API：

| 方法   | 路径                                                | 说明                                                           |
| ------ | --------------------------------------------------- | -------------------------------------------------------------- |
| `POST` | `/reviews/cards/from-wrong-question`                | 将当前用户错题加入复习计划，重复加入返回已有卡片               |
| `GET`  | `/reviews/cards/by-wrong-question/:wrongQuestionId` | 读取错题对应复习卡状态                                         |
| `GET`  | `/reviews/tasks/today`                              | 旧派生视图；前端主链路已迁移到 `/review-tasks/today`           |
| `GET`  | `/reviews/stats`                                    | 读取 7 天 / 30 天复习统计，支持用户本地日期分桶                |
| `GET`  | `/reviews/logs`                                     | 分页读取当前用户最近复习日志                                   |
| `POST` | `/reviews/cards/:cardId/rating`                     | 提交 Again / Hard / Good / Easy 评分，更新 Card 并写 ReviewLog |

服务端 ReviewTask API：

| 方法   | 路径                           | 说明                                                                                                |
| ------ | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `GET`  | `/review-tasks/today`          | 懒生成并读取当前用户本地日期的 ReviewTask，支持 `date`、`timezoneOffsetMinutes`、`includeCompleted` |
| `GET`  | `/review-tasks/plan`           | 只读预览未来复习压力，支持 `days`、`startDate`、`timezoneOffsetMinutes`                             |
| `GET`  | `/review-tasks`                | 分页读取 ReviewTask，支持 `date` 与 `status` 过滤                                                   |
| `POST` | `/review-tasks/:taskId/rating` | 提交评分，支持 `clientMutationId` 幂等，事务内更新 Card、写入 ReviewLog、完成 ReviewTask            |
| `POST` | `/review-tasks/:taskId/skip`   | 跳过待复习任务，只更新 ReviewTask                                                                   |
| `POST` | `/review-tasks/:taskId/reopen` | 恢复已跳过任务到待复习，只更新 ReviewTask                                                           |

服务端 ReviewPreference API：

| 方法    | 路径                  | 说明                                           |
| ------- | --------------------- | ---------------------------------------------- |
| `GET`   | `/review-preferences` | 读取当前用户复习计划偏好；无记录时返回默认偏好 |
| `PATCH` | `/review-preferences` | 更新当前用户复习计划偏好，只写入提交字段       |

## 8. MemoryAgent 与长期记忆

```text
用户打开个人中心
  -> MemoryAgentPanel
  -> GET /memory-agent/candidates?status=PENDING
  -> GET /user-memories?status=ACTIVE
  -> 用户点击生成候选
  -> POST /memory-agent/candidates/generate
  -> MemoryAgentService 聚合当前用户学习信号
  -> @repo/agent/memory 当前 deterministic policy；Phase 6.9.9 增加敏感 gate + 真实模型候选提取
  -> UserMemoryCandidate(PENDING)
  -> 用户确认 / 忽略候选
  -> UserMemory(ACTIVE) 或 UserMemoryCandidate(REJECTED)
  -> 用户停用 / 恢复 / 删除正式记忆
  -> PATCH /user-memories/:id 或 DELETE /user-memories/:id
```

关键约定：

- `UserMemoryCandidate` 表示系统建议“是否记住这件事”，不是已经生效的长期记忆。
- `UserMemory` 表示用户确认过的长期记忆，可以被停用、恢复或删除。
- MemoryAgent 是确定性 policy，不读取 API key，不调用真实模型，不调用 `streamText`。
- 候选生成只读取当前用户聊天偏好信号、错题薄弱点、复习日志、复习偏好和已有记忆摘要，所有查询必须带 `userId` 隔离。
- `POST /memory-agent/candidates/generate` 使用 `sourceHash` 去重，避免相同用户重复刷出近似候选。
- `accept` 必须由用户显式触发，并在事务内把 `PENDING` 候选转为 `ACCEPTED`，同时创建或返回关联的 `ACTIVE` 记忆。
- `reject` 只更新候选状态，不创建正式记忆。
- MemoryAgent 不写 ChatMessage、WrongQuestion、Card、ReviewLog、ReviewTask、ReviewPreference 或 organizer deck 数据。
- 记忆管理是在线账号级能力，不进入 Dexie `mutationQueue`。
- 当前不在 `/api/chat` 自动读取或注入 `UserMemory`；后续若启用个性化回答，需要单独设计开关、预算和可见提示。

服务端 MemoryAgent API：

| 方法     | 路径                                  | 说明                                        |
| -------- | ------------------------------------- | ------------------------------------------- |
| `GET`    | `/memory-agent/candidates`            | 读取当前用户记忆候选，默认 `status=PENDING` |
| `POST`   | `/memory-agent/candidates/generate`   | 聚合当前用户学习信号并生成去重候选          |
| `POST`   | `/memory-agent/candidates/:id/accept` | 确认候选并创建或返回正式记忆                |
| `POST`   | `/memory-agent/candidates/:id/reject` | 忽略候选，不创建正式记忆                    |
| `GET`    | `/user-memories`                      | 读取当前用户正式记忆，默认 `status=ACTIVE`  |
| `PATCH`  | `/user-memories/:id`                  | 更新标题、内容或 `ACTIVE / ARCHIVED` 状态   |
| `DELETE` | `/user-memories/:id`                  | 删除当前用户正式记忆                        |

## 9. Dexie 与离线补偿

Dexie 当前职责：

| 表               | 作用                                                             | 权威来源                   |
| ---------------- | ---------------------------------------------------------------- | -------------------------- |
| `messages`       | 聊天消息本地缓存                                                 | `/chat-messages`           |
| `ocrRecords`     | OCR 历史本地缓存、本地图片预览兜底                               | `/ocr-records`             |
| `wrongQuestions` | 错题本本地缓存、乐观更新                                         | `/wrong-questions`         |
| `mutationQueue`  | WrongQuestion / OCRRecord / ReviewTask rating 失败写操作补偿队列 | 本地暂存，最终以服务端为准 |

mutation queue 流程：

```text
WrongQuestion / OCRRecord / ReviewTask rating 写操作
  -> 乐观更新 TanStack Query / Dexie
  -> 调用 NestJS API
  -> 成功：服务端返回覆盖本地缓存，syncStatus=synced
  -> 失败：写入 mutationQueue，业务记录标记 syncStatus=failed；ReviewTask rating 只展示待同步状态
  -> session 恢复 / online / focus 时 flushMutationQueue
  -> 成功后清理 mutationQueue，并刷新 ReviewTask / Review stats 查询
```

进入队列的操作：

- WrongQuestion：create / update / delete。
- OCRRecord：create；delete 已预留在 flush 逻辑中。
- ReviewTask：rating。

不进入队列的操作：

- ChatMessage：使用 `/chat-messages/sync` 会话快照幂等同步。
- WrongQuestionOrganizer：学科卡片、专题 deck、移动和重命名是在线组织能力，不进入通用 mutation queue。
- ReviewAgent / PlannerAgent：复习诊断和学习计划建议是在线只读能力，不进入通用 mutation queue。
- MemoryAgent：候选生成、确认、忽略和正式记忆管理是在线账号级能力，不进入通用 mutation queue。
- Agent Trace：`/agent-traces` 是在线账号级观测能力，只记录脱敏元数据；trace 写入失败不需要离线补偿，不进入通用 mutation queue。
- BackgroundJob：`/background-jobs` 与 `/background-jobs/summary` 是在线账号级只读观测能力，只记录后台任务脱敏元数据；任务状态不进入 Dexie `mutationQueue`。
- Worker Observability：`/worker-observability/summary` 是在线只读运维观测能力，默认 production 关闭；返回的 queue counts 是系统级信号，heartbeat 是 worker 在线信号，不进入 Dexie `mutationQueue`，也不保存用户内容。
- Operator Audit：operator/admin 诊断写操作审计是在线运维留痕和只读复盘能力，不进入 Dexie `mutationQueue`；审计写入失败只记录脱敏 warning，不影响主操作，审计查询失败也不触发离线补偿。
- KnowledgeAgent suggestions：`/knowledge-agent/suggestions` 是在线只读资料管理建议，不写资料事实表，失败不需要离线补偿，不进入通用 mutation queue。
- ReviewTask skip / reopen：当前只在线更新 ReviewTask，不进入离线补偿队列。
- 图片上传：上传失败不阻塞 OCR，不自动静默迁移历史 base64。
- 今日任务轻手账 checklist 和学习偏好：仍是 localStorage 本地轻状态。

冲突处理：

- 删除操作服务端返回 404 视为成功。
- WrongQuestion 重复创建返回 `WRONG_QUESTION_DUPLICATED` 视为已存在。
- 401 / 403 不重试；网络错误和 5xx 按退避策略重试。
- 服务端列表仍是已同步数据的权威来源；本地只保留未同步 mutation 记录作为补偿。

## 10. localStorage

| Key                              | 内容                         | 说明                                |
| -------------------------------- | ---------------------------- | ----------------------------------- |
| `prepmind-chat`                  | 输入框草稿                   | 本地体验状态                        |
| `prepmind-today:{userId}:{date}` | 轻手账 checklist 完成状态    | 当前不承载 ReviewTask 复习任务      |
| `prepmind-preferences:{userId}`  | 学习目标、讲解偏好、每日强度 | Phase 2.5 本地偏好，暂不注入 prompt |

学习偏好后续如果要影响 AI 讲解风格，需要在个性化讲解阶段单独设计 prompt 注入边界。

## 11. PostgreSQL / Prisma

当前已落地的核心模型：

- `User`
- `RefreshToken`
- `Conversation`
- `ChatMessage`
- `OcrRecord`
- `WrongQuestion`
- `WrongQuestionSubjectGroup`
- `WrongQuestionDeck`
- `WrongQuestionDeckItem`
- `Question`
- `Card`
- `ReviewLog`（`clientMutationId` 用于 ReviewTask rating 幂等）
- `ReviewTask`
- `ReviewPreference`
- `UserMemoryCandidate`
- `UserMemory`
- `AgentTraceRun`
- `AgentTraceStep`
- `BackgroundJob`
- `OutboxEvent`
- `OperatorAuditLog`
- `Document`
- `Chunk`

本机 Docker PostgreSQL 映射：

```text
localhost:5433 -> container:5432
```

Prisma migration 状态期望：

```text
Database schema is up to date
```

## 12. Phase 3 数据流改进

Phase 3 已将 OCR 识别链路从 Markdown-first 升级为 structured output：

1. `/api/ocr` 要求模型同时输出可展示 Markdown 和结构化 JSON envelope。
2. 前端完成阶段提取 `OcrStructuredResult`，并保存到 `OcrRecord.parsedJson`。
3. `activeStudyContext` 从结构化题目对象生成，后续追问继续承接当前题目。
4. 保存错题优先使用结构化字段，多题按 `sourceGroupId:questionId` 生成独立防重 key。
5. 旧 OCR 历史继续通过 legacy adapter 和 `parseOcrResult()` 兜底。
6. `createWrongQuestion`、`searchKnowledge`、`createReviewTask` 已保留为 tool action proposal 边界，暂不自动写库。
