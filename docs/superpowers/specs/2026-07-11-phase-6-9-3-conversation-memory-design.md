# Phase 6.9.3 短期会话记忆与分层上下文装配设计

## 1. 背景与本阶段决策

Phase 6.9.2 已在 `@repo/ai` 建立共享 `ModelAgentRuntime`，但当前 Chat 仍只把预算内的最近消息、
当前 OCR 题目、Agent guidance 和 RAG 片段交给最终模型。旧消息一旦被裁剪就不再参与回答；
`AgentState.chatContext.summaryBuffer` 与 `contextPolicy` 虽已有 contract 和纯函数测试，生产
`/api/chat` 尚未读取会话摘要，也没有 `ConversationSummary`、`ConversationState` 或摘要水位。

本阶段采用以下方案：

- PostgreSQL 保存权威的滚动摘要和可恢复会话状态；
- `/api/chat` 在有登录态与 `conversationId` 时，先调用 NestJS 准备会话上下文；
- 达到阈值时由 NestJS 通过 Phase 6.9.2 runtime 生成增量摘要并以 CAS 推进水位；
- Redis 只缓存 `ConversationState`，不可用时回源 PostgreSQL；
- Web 使用纯函数分层装配 system、当前问题、OCR、近期消息、RAG 与摘要；
- Mock 与 Live 共用 schema、预算、错误和 Trace contract，Live 完成固定小样本验收。

没有 `conversationId`、未登录、摘要失败或 Redis 不可用时，Chat 保持当前最近消息窗口降级，
不得阻断回答。

## 2. 目标

- 在旧消息被裁剪前生成有水位、可重建、用户隔离的 rolling summary。
- 同一轮 Chat 可以使用刚推进的摘要，而不是等待不可靠的浏览器后置任务。
- 建立 PostgreSQL 权威、Redis 加速、Dexie 只恢复本机状态的清晰边界。
- 用显式层级与 token lane 防止摘要或 RAG 挤掉当前用户问题。
- 让摘要 Mock/Live 使用同一 Zod schema 和 `ModelAgentRuntime`。
- 在并发同步、并发摘要和消息快照变化时 fail-closed，不错误推进水位。
- 暴露脱敏 context policy 与摘要状态，便于 Agent Trace、测试和面试回顾。

## 3. 非目标

- 不把 `ConversationSummary` 自动升级为 `UserMemory` 或用户画像。
- 不在本阶段实现 Router/Verifier 模型 fallback、长期记忆召回或 Episodic Memory。
- 不把 Redis 或 Dexie 作为跨设备权威来源。
- 不把完整消息、摘要正文、模型原始输出或 provider 错误写入 Agent Trace。
- 不为摘要引入 BullMQ、BackgroundJob 或 Durable Outbox；失败由下一次满足条件的 Chat 重试。
- 不改变现有 ChatMessage 快照同步为逐条事件流，也不改最终 Chat streaming provider。
- 不在默认 CI 中调用真实模型。

## 4. 方案比较

### 方案 A：Chat 前由 NestJS 权威准备上下文（采用）

`/api/chat` 在调用最终模型前请求 NestJS `prepare` API。NestJS 读取持久化消息、判断阈值、
必要时生成摘要、执行 CAS，并返回当前安全摘要和状态。优点是摘要能立即参与本轮回答，权限、
水位与并发控制集中在服务端；代价是触发摘要的少数轮次增加一次受控模型延迟。

### 方案 B：聊天快照同步后由浏览器触发摘要（不采用）

优点是主 Chat 前置延迟低；缺点是浏览器关闭、弱网、刷新或同步失败会漏触发，多设备下也难以
决定谁推进权威水位。

### 方案 C：摘要进入 BullMQ 后台队列（本阶段不采用）

队列适合重型异步任务和可靠重试，但摘要可能赶不上用户下一轮提问。本阶段只做单会话、单次
受控模型调用，引入 BackgroundJob、Outbox 和 worker 状态机会扩大范围。若后续真实运行证明
摘要 p95 延迟无法接受，再单独设计异步预热，不在 6.9.3 预埋双路径。

## 5. 总体数据流

```text
用户发送新问题
  -> ChatRuntimeProvider 携带 conversationId + messages + activeStudyContext
  -> Next.js /api/chat 验证请求与 live 权限
  -> 有 accessToken + conversationId 时调用 NestJS
     POST /conversation-context/prepare
       -> JwtAuthGuard + conversation userId ownership
       -> 读取当前 ConversationSummary
       -> 读取 coveredThroughOrder 之后的完整持久化消息
       -> count >= 12 或完整上下文估算 >= 输入预算 70% 时触发摘要
       -> ModelAgentRuntime(mock/live) 生成结构化摘要
       -> 重新读取目标消息并核对 sourceHash
       -> CAS 推进 summaryVersion + coveredThroughOrder
       -> Redis/PG 读取 ConversationState
       -> 返回 summaryBuffer、state 与脱敏 prepare metadata
  -> Context Budget Assembler 分层装配
  -> 现有 Router/Tutor/RAG/Verifier policy
  -> 现有 Chat mock/live streaming
  -> 回答完成后继续使用现有 /chat-messages/sync 快照同步
```

摘要只覆盖调用 `prepare` 时已经持久化且回答完整的消息。当前尚未产生 assistant 回答的新问题
不会进入本次摘要；它仍由 `/api/chat` 请求体作为当前问题参与本轮模型调用。

## 6. 数据模型

### 6.1 ConversationSummary

每个会话只保存一条当前滚动摘要：

```text
ConversationSummary
  id                    String @id
  conversationId        String @unique
  userId                String
  summary               Text
  coveredThroughOrder   Int
  sourceMessageCount    Int
  sourceHash            String
  summaryVersion        Int
  modelMode             MOCK | LIVE
  modelProvider         String
  modelName             String
  promptVersion         String
  inputTokenCount       Int
  outputTokenCount      Int
  createdAt             DateTime
  updatedAt             DateTime
```

索引至少包含 `(userId, conversationId)`；Conversation 删除时 summary 级联删除。所有读写同时
限定 `conversationId + userId`。

Phase 6.9 总体设计曾给出 `(conversationId, summaryVersion)` 版本行方案；6.9.3 收敛为每会话
一条当前摘要并使用 `summaryVersion` 做 CAS。旧摘要是可重建的派生私密数据，没有业务审计价值，
不保留多份副本更符合默认最小保存原则。

`sourceHash` 使用固定版本序列化后的 `message.id/order/role/content` 计算 SHA-256，只用于确认模型
调用前后目标消息未变化；不得记录原始序列化内容。

### 6.2 ConversationState

```text
ConversationState
  id                     String @id
  conversationId         String @unique
  userId                 String
  activeGoal             String?
  activeQuestionId       String?
  pendingActionProposal  Json?
  lastToolNames          String[]
  stateVersion           Int
  expiresAt              DateTime
  createdAt              DateTime
  updatedAt              DateTime
```

默认 TTL 为 24 小时。过期 state 视为不存在，可由后续维护任务物理删除；本阶段不新增维护 worker。
`pendingActionProposal` 和 `lastToolNames` 为 Phase 6.9.7 预留，但 6.9.3 的客户端 API 不允许写入，
只允许内部受控 service 在未来按 schema 更新。当前客户端只可提交裁剪后的 `activeGoal` 与
`activeQuestionId`，且不能把 state 当作 system 指令直接注入模型。

Conversation 删除时 state 级联删除。User 删除继续通过 Conversation 级联清理 summary/state。

### 6.3 数据库约束

- `coveredThroughOrder >= -1`，无摘要时数据库中不存在 summary 行。
- `sourceMessageCount > 0`、`summaryVersion > 0`、token count 均为非负安全整数。
- `expiresAt > updatedAt` 由 service 和测试保证；数据库增加适合当前 Prisma/PostgreSQL 的 CHECK。
- `modelProvider/modelName/promptVersion/sourceHash` 使用有界字符串；summary 使用有界 service 校验。
- 高频读取使用 `conversationId @unique` 与 `(userId, updatedAt)` 索引。

## 7. 摘要触发与增量算法

### 7.1 触发条件

满足任一条件才尝试推进：

1. `coveredThroughOrder` 之后至少有 12 条完整持久化消息；
2. 原始持久化消息与当前请求预计超过 `maxInputTokens` 的 70%。

未达到阈值返回 `not_needed`；已有可用摘要但无需推进时返回 `reused`。阈值只用于触发，最终
是否把摘要放入 prompt 仍由 Context Budget Assembler 决定。

### 7.2 摘要输入

模型输入只包含：

- 上一版摘要（如有）；
- 水位之后、目标水位之前的完整 user/assistant 消息；
- 固定 summary prompt version；
- 禁止保存凭据、系统提示、工具私密原文和未经用户表达的推断的规则。

进入 provider 前先做 credential-like pattern redaction；输出再次检查凭据形态、长度和 Zod schema。
摘要要求保留当前学习目标、题目引用、用户纠正、尚未解决的问题和必要结论，同时明确不确定性；
不得把偶发陈述写成长期偏好。

默认单次摘要 budget：`maxCalls=1`，最大输入 1600 tokens，最大输出 400 tokens，timeout 8 秒。
具体值通过有界配置读取，非法配置 fail-closed 回默认值。provider 实际 usage 只用于观测，run budget
仍按调用前最大输出预留。

### 7.3 CAS 与 source hash

1. 读取当前 summaryVersion、水位和目标消息快照。
2. 计算目标 `coveredThroughOrder`、sourceMessageCount 与 sourceHash。
3. 在事务外调用模型，避免长事务持有数据库连接或行锁。
4. 调用完成后重新读取相同 order 范围并重算 sourceHash。
5. hash 不一致则丢弃本次输出，返回 `stale_snapshot`，不推进水位。
6. 已有 summary 使用 `updateMany(where: id + userId + summaryVersion + coveredThroughOrder)` CAS；
   更新数不是 1 时返回 `cas_conflict`。
7. 首次摘要使用 `conversationId @unique` 创建；唯一冲突表示其他请求已成功，当前结果丢弃。

新消息若 order 高于本次目标水位，不会让本次结果失效；它们留给下一轮增量摘要。同步快照若修改
了目标范围内任一消息，即使 order 和 id 相同，sourceHash 也会阻止旧模型结果覆盖新事实。

### 7.4 失败与重试

- `LIVE_CALLS_DISABLED / EXECUTOR_UNAVAILABLE`：返回旧摘要或空摘要，Chat 继续。
- `TIMEOUT / PROVIDER_ERROR`：不推进水位；下一次仍满足条件时可重试。
- `SCHEMA_INVALID / credential_output_rejected`：丢弃输出，不保存半成品。
- `stale_snapshot / cas_conflict`：不立即循环模型调用；下一轮重新读取权威结果。
- 所有 warning 只包含固定 code、conversation hash、版本和耗时，不含消息或摘要正文。

## 8. ModelAgentRuntime 组合边界

NestJS 是摘要模型调用的 composition root：

- `@repo/ai` 继续不读取 env 或 API key；
- server 解析 `AI_PROVIDER_MODE`、`AI_ENABLE_LIVE_CALLS`、model、base URL 和 key；
- Mock responder 与 Live executor 都输出同一 strict Zod schema；
- summary task 使用 `conversation_summary`，独立 run budget，不复用最终 Chat output budget；
- live 必须同时满足 provider mode、全局 live gate、有效 key/HTTPS endpoint 与登录态；
- config、result 和 Trace 不含 key、base URL、完整 prompt、完整输出或 raw error。

Mock responder 生成稳定、受限、可断言的合成摘要，只证明触发、水位、CAS、schema 和上下文装配。
Live 小样本才证明摘要语义质量。

## 9. Conversation Context API

### 9.1 Endpoint

```text
POST /conversation-context/prepare
```

经过 `JwtAuthGuard`，只接受当前用户拥有的 conversation：

```text
request
  conversationId      required
  maxInputTokens      bounded integer
  statePatch?
    activeGoal?       max 300 chars
    activeQuestionId? max 100 chars

response
  conversationId
  summaryBuffer       string | null
  coveredThroughOrder number | null
  summaryVersion      number | null
  summaryStatus       not_needed | reused | generated | degraded |
                      stale_snapshot | cas_conflict
  state               sanitized ConversationState | null
  debug
    uncoveredMessageCount
    triggerReason     message_count | token_pressure | none
    modelMode         mock | live | none
    errorCode         bounded safe code | null
```

响应不返回 sourceHash、完整消息、模型 prompt、raw output、provider error、key、base URL、token 或
cookie。不存在或不属于当前用户统一返回 404，避免资源枚举。

### 9.2 Next.js 调用

Chat 请求体新增可选 `conversationId`。仅当同时存在 access token 与 conversationId 时调用 prepare；
首轮新会话、匿名 Mock 和离线恢复继续走当前路径。prepare 网络/5xx/timeout 只记录固定安全 warning，
按无摘要降级。401/403 不绕过现有 Chat live 登录校验。

prepare 使用独立短超时；前端请求 abort 时同步中止后端 prepare 请求。Next route 不缓存跨用户
summary，也不把 summary 返回浏览器。

## 10. ConversationState、Redis 与 Dexie

### 10.1 PostgreSQL 与 Redis

PostgreSQL 是唯一权威来源。Redis key 包含 userId 与 conversationId 的 hash，value 只保存 strict
state DTO、stateVersion 和 expiresAt，TTL 最长 24 小时：

```text
读取：Redis hit + schema valid + version valid -> 返回
     Redis miss/invalid/unavailable -> PostgreSQL -> best-effort 回填

写入：PostgreSQL CAS/upsert 成功 -> best-effort 更新 Redis
     Redis 写失败 -> 记录固定 warning，仍返回 PostgreSQL 结果
```

Redis 数据不得包含 ChatMessage、summary 正文、prompt、token、cookie 或 API key。删除 Conversation
后 best-effort 删除 cache key；cache 删除失败不会让已删除数据库记录重新出现，因为读取仍校验
PostgreSQL ownership/version。

### 10.2 Dexie

Dexie 新增本机只读恢复缓存时，只保存：conversationId、sanitized state、stateVersion、expiresAt 和
updatedAt。它不保存服务端 summary 正文，也不推进 summary 水位。

离线时可以用 Dexie 恢复 UI 的当前题目/目标提示；重新联网后 PostgreSQL stateVersion 更高或相等
时服务端覆盖本机缓存。客户端不得把过期 Dexie state 静默覆盖服务端，也不得跨 userId 复用。

## 11. 分层 Context Budget Assembler

现有 `buildChatRequestBudget()` 升级为显式层输入，而不是把 Agent 与 RAG 先拼成一个不可区分的
additional prompt：

```text
mandatory
  base/safety system prompt
  latest user message

bounded layers
  agent guidance / current ConversationState guidance
  active OCR study context
  recent complete conversation turns
  safe RAG context
  conversation summary
```

默认 lane：

| Layer                |                    默认上限 | 规则                                |
| -------------------- | --------------------------: | ----------------------------------- |
| Base + latest user   |                    实际需要 | mandatory，超限返回 413             |
| Agent/state guidance |                  总预算 10% | 只允许受控短 guidance               |
| Active study context |                  总预算 20% | 按字段裁剪，不丢当前 questionText   |
| Recent messages      |                  总预算 40% | 保留最近完整轮次与当前消息          |
| Safe RAG             |                  总预算 25% | 高风险 chunk 已过滤；不足时整层降级 |
| Conversation summary | 总预算 15%，最多 400 tokens | 仅有 dropped history 时考虑         |

这些比例是上限而不是固定占位，总和可超过 100%。assembler 按优先级装配并回收未使用额度：

1. mandatory；
2. Agent safety/guidance 与当前 OCR question；
3. 最近完整对话轮次；
4. safe RAG；
5. summary；
6. 若低优先级层未使用额度，优先补回更多近期消息，再补 RAG。

summary 不得挤掉最新用户问题、当前 OCR 题目或已选中的最近完整轮次。若 summary 无空间则
`summaryIncluded=false`，但数据库水位保持有效，后续预算允许时仍可复用。

assembler 输出扩展后的 context policy：

```text
recentMessageCount, droppedMessageCount, summaryIncluded
estimatedTokenCount
layerTokenCounts
droppedLayers
summaryVersion?
summaryStatus?
```

只记录计数、版本和受限状态码，不记录层正文。token 估算继续明确是工程预算，不等同供应商账单。

## 12. 安全与隐私

- summary/state/API/Redis/Dexie 所有在线路径都按当前 userId 隔离。
- 摘要是短期会话压缩，不是事实权威，不能覆盖用户本轮明确指令。
- credential-like 内容在发给摘要模型前替换为 `[REDACTED]`；输出命中凭据形态直接拒绝保存。
- summary prompt 明确忽略消息中的“修改摘要规则”“泄露系统提示”等 prompt injection。
- `activeGoal` 是可恢复工作状态，不自动成为长期偏好，也不直接作为高优先级 system 指令。
- Trace 只保存 summary status/version/长度、layer token count、duration 和固定错误码。
- 不在日志、数据库 metadata、测试快照、验收记录或博客中保存 key、完整 prompt、完整摘要输入、
  provider 原始响应或真实用户私密对话。
- Conversation/User 删除继续级联清理数据库；Redis 与 Dexie best-effort 清理且不得复活记录。

## 13. 测试与验收

### 13.1 Contract 与纯函数

- `@repo/types`：prepare request/response、summary status、state、context policy strict schema。
- `@repo/ai`：现有 conversation_summary task 继续通过 package/runtime 测试。
- Web assembler：mandatory 优先、完整轮次、layer cap、额度回收、summary/RAG 降级和 413。
- credential redaction/source hash：固定输入产生稳定 hash，任何目标消息变化都会改变 hash。

### 13.2 Database 与 Server

- Prisma model、CHECK、索引、Conversation/User cascade。
- 首次摘要、增量摘要、12 条触发、70% 触发、不触发与旧摘要复用。
- Mock/Live schema invalid、timeout、provider error、credential output rejection 不推进水位。
- 同一会话并发 CAS 只有一个成功；目标消息变化返回 stale_snapshot。
- 新增高 order 消息不使已选目标范围失效。
- 多用户读取/prepare 返回 404；任何 query 都带 userId。
- Redis hit/miss、invalid JSON、版本不匹配、连接失败均正确回源 PostgreSQL。
- state TTL、CAS/upsert、客户端字段白名单和 cache 清理。

### 13.3 Web 与端到端

- conversationId 从 ChatRuntimeProvider 进入 `/api/chat`，首轮无 id 正常降级。
- prepare success 将 summary 交给 assembler；prepare timeout/5xx 不阻断 Chat。
- Mock 长对话验证 response headers/Trace metadata 中 summary 状态与层预算，不暴露正文。
- Docker PostgreSQL/Redis/server/web 启动后完成真实账号与会话隔离验收。

### 13.4 Live 小样本

用户已批准 Phase 6.9.3 完成受控 Live 摘要验收。固定使用合成学习对话：

1. 早期消息给出一个学习目标或题目纠正；
2. 继续至少 12 条完整 user/assistant 消息，使早期内容离开近期窗口；
3. 下一轮触发 Live rolling summary；
4. 再提问早期目标，确认最终回答能使用摘要且不把它说成长期档案；
5. 检查 summary version/waterline/context policy 与模型 token/耗时预算；
6. 用 credential-like 合成文本验证不会进入 provider 输入或持久化摘要；
7. 验收后恢复 Mock，清理临时账号、会话、summary/state 与 Redis cache。

页面验收使用 headed 可见浏览器，让用户共同观察 Chat；功能分支验收后 `--no-ff` 合并 main，
main 再运行同一测试和关键 Docker/Live 验收，最后推送远程。

## 14. 文档与交付边界

实现完成时同步：

- `AGENTS.md`：Phase 6.9.3 状态、summary/state/Redis/Dexie 权威边界与下一任务；
- `README.md`：长对话摘要能力、Mock/Live 开关和用户可见边界；
- `docs/data-flow.md`：prepare、摘要触发/CAS、context assembler 与降级链路；
- `docs/roadmap.md`：6.9.3 完成证据与 6.9.4 下一任务；
- `docs/acceptance-checklist.md`、`docs/ai-behavior-acceptance.md`：Mock/Live/Docker/清理；
- `DEVLOG.md`：为什么做、关键决策、验证和回顾问题。

Phase 6.9.7 的详细面试学习博客继续保留。本阶段不单独写重复博客，但 DEVLOG 必须支持回答：

- “为什么摘要要有 coveredThroughOrder、sourceHash 和 CAS？”
- “为什么 PostgreSQL 是权威而 Redis/Dexie 只能做缓存？”
- “为什么摘要不能自动成为长期记忆？”
- “分层 context budget 如何防止摘要或 RAG 挤掉当前问题？”
- “为什么 Phase 6.9.3 选择 Chat 前同步准备，而不是 BullMQ？”

## 15. 下一阶段

Phase 6.9.4 在本阶段稳定的 summary/context contract 上实现：

- RouterAgent 高置信 deterministic + 低置信模型 fallback；
- KnowledgeVerifierAgent deterministic safety + 复杂语义模型核验；
- deterministic/Mock/Live paired eval 与启用门槛。

  6.9.4 不得绕过 6.9.3 的 context assembler、live 双开关、预算、用户隔离或脱敏 Trace。
