# PrepMind AI 数据流

> 当前版本：2026-07-11。Phase 7 工程化已完成；Phase 6.9.1 已建立 Agent deterministic/Mock/Live 统一评测 contract 和 seed baseline。当前生产数据流仍保持 Phase 6.8 边界：已有 Agent 都是 deterministic policy，最终模型输出仍只由 `/api/chat` 的 mock/live 链路负责，长期记忆尚不自动注入 Chat。本文只描述当前有效边界，未来模型运行时和分层记忆只有实现并验收后才会写成现行数据流。

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
- 资料管理 Agent 职责：KnowledgeDedupAgent / KnowledgeOrganizerAgent 只基于当前用户资料元数据和少量 chunk 摘要生成重复、新版、互补、集合和标签建议；`/knowledge-agent/suggestions` 是认证、用户隔离、在线只读 API，不自动合并、删除、替换、重命名或分类资料。
- Agent 职责：`@repo/agent` 提供 Agent state、ActionProposal contract、RouterAgent、阈值 guard、运行 recorder、graph descriptor、TutorAgent policy、KnowledgeVerifierAgent policy、WrongQuestionOrganizerAgent policy、ReviewAgent policy、PlannerAgent policy、MemoryAgent policy、KnowledgeDedupAgent policy 和 KnowledgeOrganizerAgent policy；Agent package 不直接写库、不直接调用真实模型。
- Agent 评测职责：`@repo/agent` 的 Phase 6.9 eval contract 统一 case run、summary 和模型路径启用决策；seed baseline 只运行纯 deterministic policy，不访问网络、数据库、Docker 或 API key。Orchestrator 当前只有 expectation-only case，不能被当作已实现能力。
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
  -> chat-agent-runtime 调用 RouterAgent
  -> tutor route 时调用 TutorAgent policy 生成讲题策略 prompt
  -> 有 accessToken 时检索知识库，命中后调用 KnowledgeVerifierAgent 评估资料可信度
  -> resolveChatProviderStatus() 基于 env 与开发调试开关判断 mock / live
  -> buildChatRequestBudget() 统一预算 system prompt、activeStudyContext、近期聊天历史
  -> 有 accessToken 时 best-effort 写入 /agent-traces 脱敏观测元数据
  -> mock data stream 或 OpenAI / DeepSeek SSE
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
- `tutor` route 会调用 TutorAgent policy，生成 `explain_solution`、`socratic_hint`、`step_check`、`concept_bridge`、`answer_direct` 或 `general_follow_up` 策略。
- Agent prompt 顺序为 `BASE_SYSTEM_PROMPT -> activeStudyContext -> agent/tutor strategy prompt -> RAG knowledge context -> verifier / safety guidance`；RAG knowledge context 只接收 SafetyGuard 过滤后的可用 chunk；当 RAG prompt 因 token 预算被丢弃时，短 Agent prompt 仍保留。
- Chat 响应会带 `x-prepmind-agent-route`、`x-prepmind-agent-confidence`、`x-prepmind-agent-rag-required`；Tutor 路线额外带 `x-prepmind-tutor-intent` 与 `x-prepmind-tutor-depth`。
- RAG 命中后会调用 KnowledgeVerifierAgent，输出 `trusted / suspicious / conflict / insufficient / skipped`；响应头带 `x-prepmind-knowledge-verifier-status` 与 `x-prepmind-knowledge-verifier-chunks`。
- KnowledgeVerifierAgent 是确定性 policy，不调用真实模型、不修改用户资料、不阻断 Chat；可疑、冲突或不足时只向 prompt 注入保守使用规则，并在引用区追加温和“资料核对提示”。
- `@repo/agent` 当前不直接调用 `streamText`、不读取 API key、不启用 live 模型；真实模型调用仍只存在于 `/api/chat`。
- ReviewAgent / PlannerAgent / MemoryAgent 不在每次 Chat 中自动执行；复习建议只通过 `/review-agent/suggestions` 在计划和今日任务界面读取，长期记忆只在 `/profile` 显式管理。
- 当前不在 `/api/chat` 读取 `/user-memories`，也不把 `UserMemory` 自动注入 Chat prompt。
- `/api/chat` 在有 access token 时会 best-effort 构造 Agent Trace payload 并调用 `/agent-traces`；trace 写入失败不影响流式回答，只通过 `x-prepmind-agent-trace-recorded=false` 暴露。
- Agent Trace payload 在写入前会裁剪并脱敏用户输入预览、step summary 和错误信息；服务端也会再次裁剪和脱敏，防止保存 `DEEPSEEK_API_KEY`、`OPENAI_API_KEY`、`Authorization: Bearer ...` 或 `Cookie: ...` 等敏感片段。
- `/agent-trace` 的 token 与成本只做估算，用于调试 Agent 链路和观察趋势，不作为供应商真实账单或财务凭证。
- Chat / OCR 展示层的格式化不回写 `activeStudyContext`。
- 流式输出使用渐进 Markdown 渲染：稳定段落进入 Markdown / KaTeX，尾部未稳定内容保持轻量文本。
- 自动滚动默认跟随输出；用户触摸、滚轮或指针操作内容区后暂停，新一轮生成或回到底部时恢复。

服务端 ChatMessage API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/chat-messages` | 读取当前用户会话消息，支持 `conversationId` |
| `POST` | `/chat-messages/sync` | 幂等同步当前会话快照，无 `conversationId` 时创建默认会话 |
| `DELETE` | `/chat-messages` | 清空当前用户会话，支持 `conversationId` |

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

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/agent-traces` | 写入或替换当前用户一次 Agent Trace run 及 steps，写入内容必须是脱敏后的元数据 |
| `GET` | `/agent-traces` | 分页读取当前用户最近 trace，可按 route、mode、status 过滤 |
| `GET` | `/agent-traces/summary` | 读取近 1 到 30 天 trace 汇总、route 分布、verifier 分布和估算成本 |
| `GET` | `/agent-traces/:id` | 读取当前用户单次 trace 详情与步骤 |

Agent Trace 边界：

- `/agent-traces` 经过 `JwtAuthGuard`，所有读写都按当前 `userId` 隔离。
- Trace 是在线账号级观测能力，不进入 Dexie `mutationQueue`；离线或弱网时不补写历史 trace。
- Trace 不保存完整 prompt、完整模型回答、完整 RAG chunk、access token、refresh token 或 API key。
- `inputPreview`、`inputSummary`、`outputSummary` 和 `errorMessage` 只用于调试摘要，长度受 schema 与服务端双重限制。
- fixed deterministic eval set 位于 `@repo/agent`，用于回归 RouterAgent、TutorAgent、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent、MemoryAgent、KnowledgeDedupAgent 和 KnowledgeOrganizerAgent 的确定性 policy 行为，不替代 live 输出体验验收。

## 4. RAG 知识库数据流

Phase 5.0 已完成 RAG 设计，Phase 5.1 已完成数据模型与 shared contract 地基，Phase 5.2 已完成文档上传与状态 API，Phase 5.3 已完成文档处理与 embedding 入库，Phase 5.4 已完成检索 API，Phase 5.5 已完成 Chat RAG 增强和 Markdown citations，Phase 5.6 已完成 `/knowledge` 前端资料工作台。Phase 6.3 已接入资料可信度评估 Agent，Phase 6.8 已接入资料管理建议 Agent。Phase 7.0 / 7.1 已把文档处理升级为可切换 inline / BullMQ queue 的后台任务链路。

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
  -> Embedding provider 生成向量
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
  -> pgvector cosine search 当前用户 DONE 文档 chunks
  -> 过滤低于 minScore 的结果
  -> 返回 KnowledgeSearchResponse(hits)，包含 chunk metadata.safety
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

资料管理建议数据流：

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
- embedding provider 已抽象，默认 OpenAI `text-embedding-3-small`，并支持阿里云百炼 / DashScope OpenAI-compatible `qwen` provider（例如 `text-embedding-v4`）；测试/e2e 使用 fake provider。
- `POST /knowledge/search` 只检索当前用户 `DONE` 文档 chunks，不跨用户、不检索未处理或失败文档。
- 检索失败作为 RAG 增强失败处理，Chat 必须降级为普通 AI 回答。
- KnowledgeVerifierAgent 只消费 `/knowledge/search` 的命中结果，不单独读取数据库；无命中返回 `skipped`，可信资料返回 `trusted`，低分或过短资料返回 `insufficient`，包含“可能有误 / 待核对 / 不确定 / wrong / contradict”等风险标记时返回 `suspicious`，多个片段出现互斥答案标记时返回 `conflict`。
- verifier 结果只影响 prompt guidance、引用区提示和 debug headers，不修改 Document / Chunk，不自动纠错用户资料。
- KnowledgeDedupAgent / KnowledgeOrganizerAgent 只消费当前用户 `Document` 元数据和裁剪后的少量 `Chunk` 摘要；`exact_duplicate` 主要解释同 `contentHash` 历史或异常数据，`possible_revision` 表示文件名高度相似但内容 hash 不同，`complementary` 表示同主题但更适合共存，`insufficient_signal` 表示资料太少或未处理不足以判断。
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
- 本地开发和自动化验收可使用 `RAG_EMBEDDING_PROVIDER=fake` 生成稳定伪向量，便于无 API key、无成本验证上传、处理和检索闭环；production 禁止 fake provider。真实 embedding 可使用 `RAG_EMBEDDING_PROVIDER=openai` + `OPENAI_API_KEY`，或 `RAG_EMBEDDING_PROVIDER=qwen` + `RAG_EMBEDDING_BASE_URL` + `Qwen_API_KEY` / `QWEN_API_KEY` / `DASHSCOPE_API_KEY`。

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
  -> 成功：PostgreSQL + Dexie 缓存
  -> 非阻塞触发 WrongQuestionOrganizerAgent
  -> upsert WrongQuestionSubjectGroup / WrongQuestionDeck / WrongQuestionDeckItem
  -> 失败：Dexie mutationQueue 暂存，后续自动补偿同步
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
- WrongQuestionOrganizerAgent 是确定性 policy，不调用真实模型、不读取 API key，只根据错题结构化字段和已有 deck 摘要输出组织建议。
- 一个错题同一时间只属于当前用户一个 organizer deck，服务端通过 `userId + wrongQuestionId` 唯一约束防止同一错题被重复归入多个专题。

服务端 OCRRecord API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/ocr-records` | 读取当前用户 OCR 历史，支持分页、状态、关键词和 `isQuestion` |
| `GET` | `/ocr-records/:id` | 读取当前用户 OCR 详情 |
| `POST` | `/ocr-records` | 创建或按 `userId + groupId` upsert OCR 结果 |
| `DELETE` | `/ocr-records/:id` | 删除当前用户 OCR 记录 |

服务端 WrongQuestion API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/wrong-questions` | 分页列表，支持 `status`、`subject`、`keyword` |
| `GET` | `/wrong-questions/:id` | 当前用户错题详情 |
| `POST` | `/wrong-questions` | 创建错题，`sourceGroupId` 用于同用户防重复 |
| `PATCH` | `/wrong-questions/:id` | 更新题目字段、备注、掌握状态 |
| `DELETE` | `/wrong-questions/:id` | 删除当前用户错题 |

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

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/wrong-question-groups` | 读取当前用户学科卡片摘要 |
| `GET` | `/wrong-question-groups/:subjectGroupId/decks` | 读取当前用户某学科下专题 deck |
| `GET` | `/wrong-question-decks/:deckId/questions` | 读取当前用户某专题下错题列表 |
| `POST` | `/wrong-question-organizer/organize/:wrongQuestionId` | 整理单道错题，写入组织层 |
| `POST` | `/wrong-question-organizer/organize-batch` | 批量整理当前用户未归类错题 |
| `PATCH` | `/wrong-question-decks/:deckId` | 更新专题名称、描述和锁定状态 |
| `POST` | `/wrong-question-decks/:deckId/items` | 手动把错题移动到专题 |
| `DELETE` | `/wrong-question-decks/:deckId/items/:wrongQuestionId` | 只移除专题关联，不删除错题 |

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
  -> @repo/agent analyzeReview() + planStudy()
  -> read-only study suggestions
  -> /plan full suggestion and /today compact suggestion
```

- `GET /review-agent/suggestions` 经过 `JwtAuthGuard`，按当前 `userId` 聚合数据。
- ReviewAgent 负责识别薄弱知识点、逾期压力、Again / Hard 信号、低稳定度和高难度卡片。
- PlannerAgent 负责结合 ReviewAgent 输出、未来计划窗口和 `ReviewPreference` 生成今日重点、周计划节奏、容量提示和建议 block。
- 该建议链路不创建 `ReviewTask(source=PLANNER)`，不更新 Card / ReviewLog / ReviewPreference / WrongQuestion / deck 数据，不调用 live 模型，不进入 Dexie `mutationQueue`。
- 今日任务页读取当天 plan 摘要，展示“今日预计 N 分钟”和容量状态；plan 查询失败不影响今日复习主列表。
- 学习统计页 `/stats` 不在前端扫描原始表，只读取服务端聚合后的 Review stats/logs，并用客户端 ECharts 渲染趋势、评分分布和卡片状态。
- `/reviews/stats` 基于 `Card` / `ReviewLog` 聚合复习次数、掌握率、连续复习、评分分布、卡片状态和每日趋势。
- `/reviews/logs` 返回当前用户最近复习记录和错题摘要，`ReviewLog` 通过关联 `card.userId` 隔离用户。

服务端 Review API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/reviews/cards/from-wrong-question` | 将当前用户错题加入复习计划，重复加入返回已有卡片 |
| `GET` | `/reviews/cards/by-wrong-question/:wrongQuestionId` | 读取错题对应复习卡状态 |
| `GET` | `/reviews/tasks/today` | 旧派生视图；前端主链路已迁移到 `/review-tasks/today` |
| `GET` | `/reviews/stats` | 读取 7 天 / 30 天复习统计，支持用户本地日期分桶 |
| `GET` | `/reviews/logs` | 分页读取当前用户最近复习日志 |
| `POST` | `/reviews/cards/:cardId/rating` | 提交 Again / Hard / Good / Easy 评分，更新 Card 并写 ReviewLog |

服务端 ReviewTask API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/review-tasks/today` | 懒生成并读取当前用户本地日期的 ReviewTask，支持 `date`、`timezoneOffsetMinutes`、`includeCompleted` |
| `GET` | `/review-tasks/plan` | 只读预览未来复习压力，支持 `days`、`startDate`、`timezoneOffsetMinutes` |
| `GET` | `/review-tasks` | 分页读取 ReviewTask，支持 `date` 与 `status` 过滤 |
| `POST` | `/review-tasks/:taskId/rating` | 提交评分，支持 `clientMutationId` 幂等，事务内更新 Card、写入 ReviewLog、完成 ReviewTask |
| `POST` | `/review-tasks/:taskId/skip` | 跳过待复习任务，只更新 ReviewTask |
| `POST` | `/review-tasks/:taskId/reopen` | 恢复已跳过任务到待复习，只更新 ReviewTask |

服务端 ReviewPreference API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/review-preferences` | 读取当前用户复习计划偏好；无记录时返回默认偏好 |
| `PATCH` | `/review-preferences` | 更新当前用户复习计划偏好，只写入提交字段 |

## 8. MemoryAgent 与长期记忆

```text
用户打开个人中心
  -> MemoryAgentPanel
  -> GET /memory-agent/candidates?status=PENDING
  -> GET /user-memories?status=ACTIVE
  -> 用户点击生成候选
  -> POST /memory-agent/candidates/generate
  -> MemoryAgentService 聚合当前用户学习信号
  -> @repo/agent/memory deterministic policy
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

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/memory-agent/candidates` | 读取当前用户记忆候选，默认 `status=PENDING` |
| `POST` | `/memory-agent/candidates/generate` | 聚合当前用户学习信号并生成去重候选 |
| `POST` | `/memory-agent/candidates/:id/accept` | 确认候选并创建或返回正式记忆 |
| `POST` | `/memory-agent/candidates/:id/reject` | 忽略候选，不创建正式记忆 |
| `GET` | `/user-memories` | 读取当前用户正式记忆，默认 `status=ACTIVE` |
| `PATCH` | `/user-memories/:id` | 更新标题、内容或 `ACTIVE / ARCHIVED` 状态 |
| `DELETE` | `/user-memories/:id` | 删除当前用户正式记忆 |

## 9. Dexie 与离线补偿

Dexie 当前职责：

| 表 | 作用 | 权威来源 |
| --- | --- | --- |
| `messages` | 聊天消息本地缓存 | `/chat-messages` |
| `ocrRecords` | OCR 历史本地缓存、本地图片预览兜底 | `/ocr-records` |
| `wrongQuestions` | 错题本本地缓存、乐观更新 | `/wrong-questions` |
| `mutationQueue` | WrongQuestion / OCRRecord / ReviewTask rating 失败写操作补偿队列 | 本地暂存，最终以服务端为准 |

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

| Key | 内容 | 说明 |
| --- | --- | --- |
| `prepmind-chat` | 输入框草稿 | 本地体验状态 |
| `prepmind-today:{userId}:{date}` | 轻手账 checklist 完成状态 | 当前不承载 ReviewTask 复习任务 |
| `prepmind-preferences:{userId}` | 学习目标、讲解偏好、每日强度 | Phase 2.5 本地偏好，暂不注入 prompt |

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
