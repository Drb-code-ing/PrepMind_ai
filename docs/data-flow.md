# PrepMind AI 数据流

> 当前版本：2026-06-22。Phase 6.5 已完成 Agent Runtime 地基、RouterAgent 到 Chat 的轻量接入、TutorAgent 策略层、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent 和 PlannerAgent；Chat 仍保留 Phase 5 RAG 增强、默认 mock 与 live 调用成本保护。本文只描述当前仍然有效的数据流边界，历史实现细节见 `DEVLOG.md`。

## 1. 当前边界

- 登录态权威来源：NestJS Auth API + PostgreSQL refresh token + httpOnly cookie。
- 业务数据权威来源：WrongQuestion、ChatMessage、OCRRecord 均已迁移到 PostgreSQL。
- 错题组织层职责：`WrongQuestionSubjectGroup` / `WrongQuestionDeck` / `WrongQuestionDeckItem` 只负责学科卡片、专题 deck 和错题归属视图，不替代 WrongQuestion / Card / ReviewLog / ReviewTask 事实来源。
- 本地缓存职责：Dexie 负责快速恢复、离线兜底、乐观更新、旧图片预览和 mutation queue。
- AI 代理职责：`/api/chat` 与 `/api/ocr` 仍由 Next.js API Route 代理 AI 服务；`/api/chat` 开发默认 mock，live 调用需要显式双开关。
- 图片存储职责：新 OCR 图片通过 NestJS `/uploads/images` 上传到 MinIO。
- 复习系统职责：错题可生成 FSRS 复习卡，Card / ReviewLog / ReviewTask / ReviewPreference 以 PostgreSQL 为权威来源。
- RAG 知识库职责：Phase 5.6 已完成 `Document` / `Chunk` 数据模型、`vector(1536)` 索引预留、knowledge API contract、`/knowledge/documents` 上传/列表/详情/删除/替换 API、`POST /knowledge/documents/:id/process` 文档处理 API、`POST /knowledge/search` 检索 API、`/api/chat` 知识库上下文注入与 Markdown citations，以及 `/knowledge` 前端资料工作台。
- Agent 职责：`@repo/agent` 提供 Agent state、ActionProposal contract、RouterAgent、阈值 guard、运行 recorder、graph descriptor、TutorAgent policy、KnowledgeVerifierAgent policy、WrongQuestionOrganizerAgent policy、ReviewAgent policy 和 PlannerAgent policy；Agent package 不直接写库、不直接调用真实模型。
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
  -> getAiProviderStatus() 判断 mock / live
  -> buildChatRequestBudget() 统一预算 system prompt、activeStudyContext、近期聊天历史
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
- Chat 默认输入预算为 2500 tokens、输出上限为 1200 tokens，可通过 `AI_MAX_INPUT_TOKENS` 和 `AI_MAX_OUTPUT_TOKENS` 调整；超出输入预算会返回 413。
- live 模式会在服务端打印不含密钥的用量估算日志，包含模式、模型、输入估算、输出上限、消息数量和是否带 active context。
- AI 行为验收规范见 `docs/ai-behavior-acceptance.md`；mock 验工程链路，live 小样本验真实输出体验，fake embedding 不证明 RAG 语义命中质量。
- 完整聊天历史仍保存于 PostgreSQL 与 Dexie。
- `activeStudyContext` 来自有效 OCR 题目，用于承接“这一步为什么这样做”等追问。
- RouterAgent 会为 Chat 请求生成 route metadata，当前主要用于区分 `chat`、`tutor`、`rag_answer`、`study_plan`、`review_analysis` 和 `wrong_question_organize` 等路线。
- `tutor` route 会调用 TutorAgent policy，生成 `explain_solution`、`socratic_hint`、`step_check`、`concept_bridge`、`answer_direct` 或 `general_follow_up` 策略。
- Agent prompt 顺序为 `BASE_SYSTEM_PROMPT -> activeStudyContext -> agent/tutor strategy prompt -> RAG knowledge context`；当 RAG prompt 因 token 预算被丢弃时，短 Agent prompt 仍保留。
- Chat 响应会带 `x-prepmind-agent-route`、`x-prepmind-agent-confidence`、`x-prepmind-agent-rag-required`；Tutor 路线额外带 `x-prepmind-tutor-intent` 与 `x-prepmind-tutor-depth`。
- RAG 命中后会调用 KnowledgeVerifierAgent，输出 `trusted / suspicious / conflict / insufficient / skipped`；响应头带 `x-prepmind-knowledge-verifier-status` 与 `x-prepmind-knowledge-verifier-chunks`。
- KnowledgeVerifierAgent 是确定性 policy，不调用真实模型、不修改用户资料、不阻断 Chat；可疑、冲突或不足时只向 prompt 注入保守使用规则，并在引用区追加温和“资料核对提示”。
- `@repo/agent` 当前不直接调用 `streamText`、不读取 API key、不启用 live 模型；真实模型调用仍只存在于 `/api/chat`。
- ReviewAgent / PlannerAgent 不在每次 Chat 中自动执行；复习建议只通过 `/review-agent/suggestions` 在计划和今日任务界面读取。
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

## 4. RAG 知识库数据流

Phase 5.0 已完成 RAG 设计，Phase 5.1 已完成数据模型与 shared contract 地基，Phase 5.2 已完成文档上传与状态 API，Phase 5.3 已完成文档处理与 embedding 入库，Phase 5.4 已完成检索 API，Phase 5.5 已完成 Chat RAG 增强和 Markdown citations，Phase 5.6 已完成 `/knowledge` 前端资料工作台。Phase 6.3 已接入资料可信度评估 Agent，Phase 6.4 已接入错题组织 Agent。

文档处理数据流：

```text
用户上传学习资料
  -> POST /knowledge/documents
  -> contentHash 检查同用户重复资料
  -> MinIO 保存原文件
  -> Document(status=PENDING, sourceType=UPLOAD)
  -> POST /knowledge/documents/:id/process
  -> Document(status=PROCESSING)
  -> TXT / Markdown / DOCX / PDF 基础文本解析
  -> @repo/rag 段落感知分块
  -> Embedding provider 生成向量
  -> Chunk.embedding vector(1536) raw SQL 写入 pgvector
  -> Document(status=DONE / FAILED)
```

资料替换数据流：

```text
用户在资料卡片中选择重新上传
  -> PUT /knowledge/documents/:id/file multipart
  -> 校验 document/user ownership
  -> contentHash 检查是否命中同用户其它资料
  -> MinIO 保存新原文件
  -> 事务内删除旧 chunks
  -> 更新同一个 Document(id 不变, status=PENDING)
  -> 尽力删除旧 MinIO 对象
  -> 用户重新触发处理入库
```

当前检索数据流：

```text
用户查询
  -> POST /knowledge/search
  -> knowledgeSearchRequestSchema 校验 query / limit / minScore / documentId
  -> EmbeddingService 生成 query embedding
  -> pgvector cosine search 当前用户 DONE 文档 chunks
  -> 过滤低于 minScore 的结果
  -> 返回 KnowledgeSearchResponse(hits)
```

当前 Chat RAG 数据流：

```text
用户提问
  -> ChatRuntimeProvider 将 accessToken 放入 /api/chat 请求体
  -> /api/chat 使用最新用户消息调用 /knowledge/search
  -> 无 token / 无资料 / 未命中 / 检索失败：普通 AI 回答
  -> 命中知识库：调用 KnowledgeVerifierAgent 评估 retrieved chunks
  -> 注入 chunks 与 verifier guidance 到 system prompt
  -> AI 回答，并在助手消息末尾追加 Markdown 参考资料
  -> suspicious / conflict / insufficient 时追加“资料核对提示”
```

当前 `/knowledge` 页面数据流：

```text
用户打开知识库页面
  -> useKnowledgeDocumentList({ limit: 50 })
  -> GET /knowledge/documents
  -> 展示资料状态摘要和卡片列表

用户上传资料
  -> useUploadKnowledgeDocument()
  -> POST /knowledge/documents multipart
  -> 新资料 Document(status=PENDING) 或返回同 contentHash 的已有 Document
  -> 列表失效刷新

用户在资料卡片菜单中重新上传
  -> useReplaceKnowledgeDocumentFile()
  -> PUT /knowledge/documents/:id/file multipart
  -> 同一个 Document 重置为 PENDING，旧 chunks 清空
  -> 列表、详情和检索缓存失效刷新

用户点击处理
  -> useProcessKnowledgeDocument()
  -> POST /knowledge/documents/:id/process
  -> Document(status=DONE / FAILED)
  -> 列表、详情和检索缓存失效刷新

用户手动检索测试
  -> useSearchKnowledge()
  -> POST /knowledge/search
  -> 展示命中文档、片段序号、相似度和内容摘要
```

关键约定：

- RAG 只增强回答，不阻断回答。
- 第一版资料来源以用户上传 PDF / DOCX / TXT / Markdown 为主。
- `Document.sourceType` 已预留 `UPLOAD`、`NOTE`、`WRONG_QUESTION`、`OCR` 和 `CHAT`；OCR、错题和聊天沉淀当前仍不自动入库。
- Phase 5.3 文档 API 按当前 `userId` 隔离，上传原文件进入 MinIO，`Document(PENDING, sourceType=UPLOAD)` 进入 PostgreSQL。
- `POST /knowledge/documents` 会按当前用户与 `contentHash` 做轻量去重；上传重复内容时返回已有 `Document`，并清理本次临时 MinIO 对象。
- `PUT /knowledge/documents/:id/file` 用于更新同一资料卡片的原文件；替换后保留原 `Document.id`，清空旧 chunks，状态回到 `PENDING`，用户需要重新处理入库。
- 替换上传如果命中当前用户其它资料的相同 `contentHash`，服务端返回 `KNOWLEDGE_DOCUMENT_DUPLICATE`，避免产生两个内容相同的资料卡片。
- `POST /knowledge/documents/:id/process` 写入前校验 document/user ownership。
- `Document` 状态流为 `PENDING -> PROCESSING -> DONE / FAILED`；空文本、零 chunk、解析失败或 embedding 失败进入 `FAILED`。
- forced reprocess 会先清旧 chunks，避免 stale retrieval。
- embedding provider 已抽象，默认 OpenAI-compatible `text-embedding-3-small`，测试/e2e 使用 fake provider。
- `POST /knowledge/search` 只检索当前用户 `DONE` 文档 chunks，不跨用户、不检索未处理或失败文档。
- 检索失败作为 RAG 增强失败处理，Chat 必须降级为普通 AI 回答。
- KnowledgeVerifierAgent 只消费 `/knowledge/search` 的命中结果，不单独读取数据库；无命中返回 `skipped`，可信资料返回 `trusted`，低分或过短资料返回 `insufficient`，包含“可能有误 / 待核对 / 不确定 / wrong / contradict”等风险标记时返回 `suspicious`，多个片段出现互斥答案标记时返回 `conflict`。
- verifier 结果只影响 prompt guidance、引用区提示和 debug headers，不修改 Document / Chunk，不自动纠错用户资料。
- `/api/chat` 只把 access token 用于服务端代理检索，不写入日志、不注入 prompt、不保存到 ChatMessage。
- citations 第一版以 Markdown 追加到助手消息底部，不新增 ChatMessage schema 字段。
- `/knowledge` 页面是在线资料管理入口，文件上传、替换、解析、embedding、检索测试和知识库删除不进入 Dexie `mutationQueue`。
- `/knowledge` 资料卡片使用右上角三点菜单承载处理、重新上传和删除；点击页面其它区域会收起菜单；`DONE` 资料不再展示主按钮式“重新处理”，避免用户把已完成状态误解为必须再次处理。
- `Document` / `Chunk` 查询必须按当前 `userId` 隔离，禁止跨用户检索。
- `Chunk.embedding` 固定为 `vector(1536)`，向量索引和 embedding 持久化使用 raw SQL。
- 本地开发和自动化验收可使用 `RAG_EMBEDDING_PROVIDER=fake` 生成稳定伪向量，便于无 API key、无成本验证上传、处理和检索闭环；production 禁止 fake provider，真实 embedding 仍使用 OpenAI-compatible provider。

## 5. OCR 与错题本

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

## 6. FSRS 复习

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

## 7. Dexie 与离线补偿

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
- ReviewTask skip / reopen：当前只在线更新 ReviewTask，不进入离线补偿队列。
- 图片上传：上传失败不阻塞 OCR，不自动静默迁移历史 base64。
- 今日任务轻手账 checklist 和学习偏好：仍是 localStorage 本地轻状态。

冲突处理：

- 删除操作服务端返回 404 视为成功。
- WrongQuestion 重复创建返回 `WRONG_QUESTION_DUPLICATED` 视为已存在。
- 401 / 403 不重试；网络错误和 5xx 按退避策略重试。
- 服务端列表仍是已同步数据的权威来源；本地只保留未同步 mutation 记录作为补偿。

## 8. localStorage

| Key | 内容 | 说明 |
| --- | --- | --- |
| `prepmind-chat` | 输入框草稿 | 本地体验状态 |
| `prepmind-today:{userId}:{date}` | 轻手账 checklist 完成状态 | 当前不承载 ReviewTask 复习任务 |
| `prepmind-preferences:{userId}` | 学习目标、讲解偏好、每日强度 | Phase 2.5 本地偏好，暂不注入 prompt |

学习偏好后续如果要影响 AI 讲解风格，需要在个性化讲解阶段单独设计 prompt 注入边界。

## 9. PostgreSQL / Prisma

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

## 10. Phase 3 数据流改进

Phase 3 已将 OCR 识别链路从 Markdown-first 升级为 structured output：

1. `/api/ocr` 要求模型同时输出可展示 Markdown 和结构化 JSON envelope。
2. 前端完成阶段提取 `OcrStructuredResult`，并保存到 `OcrRecord.parsedJson`。
3. `activeStudyContext` 从结构化题目对象生成，后续追问继续承接当前题目。
4. 保存错题优先使用结构化字段，多题按 `sourceGroupId:questionId` 生成独立防重 key。
5. 旧 OCR 历史继续通过 legacy adapter 和 `parseOcrResult()` 兜底。
6. `createWrongQuestion`、`searchKnowledge`、`createReviewTask` 已保留为 tool action proposal 边界，暂不自动写库。
