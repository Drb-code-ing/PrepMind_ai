# Phase 6.9 真实模型 Agent 与分层记忆体系设计

## 1. 背景与决策

PrepMind 已完成 Phase 6.0 ~ 6.8 的多 Agent 主线，但现状仍是“确定性多 Agent
策略 + `/api/chat` 单次真实模型输出”：Router、Tutor、Verifier、Memory、Review、
Planner、错题组织和资料组织 Agent 都不会独立调用真实模型。这个架构可控、便宜、
容易回归，却还不能支撑 Phase 9 的动态工具选择，也没有形成完整的 Chat 记忆闭环。

当前记忆能力分散在三处：

- Chat 请求只保留预算内的最近消息和当前 OCR 学习上下文；旧消息被裁剪后没有滚动摘要。
- Dexie 和 PostgreSQL 可以恢复聊天记录，但没有会话摘要水位、Agent checkpoint 或多设备
  working state。
- `UserMemoryCandidate` / `UserMemory` 能保存经用户确认的学习档案，但没有 embedding、
  混合召回、Chat 注入或情景记忆。

Phase 8 如果先建立性能基线，Phase 9 再引入多次模型和工具调用，性能模型会被重新改写。
因此路线调整为：

```text
Phase 6.9 真实模型 Agent 与分层记忆
  -> Phase 8 性能、离线与 PWA
  -> Phase 9 MCP Tool 体系
  -> Phase 10 生产部署
```

本阶段采用“共享模型运行时 + 三层记忆 + MCP-ready Orchestrator”的方案。真实模型不是
默认替换所有确定性 policy；每个 Agent 必须经过 deterministic baseline、Mock 工程测试和
Live 小样本对照评测，只有质量收益大于成本、延迟与稳定性代价时才启用模型路径。

## 2. 目标

- 建立供 Chat、Router、Verifier、Memory 和后续 Orchestrator 复用的模型调用运行时。
- 将 Chat 记忆明确拆成瞬时工作记忆、短期会话记忆和长期用户记忆。
- 在旧消息被 token budget 裁剪前生成有水位、可重建的 rolling summary。
- 让高置信确定性路由继续走快速路径，低置信请求才调用 LLM fallback。
- 让 Verifier 在确定性安全过滤后，对复杂语义冲突做受控模型核验。
- 让 MemoryAgent 使用模型提取候选，但稳定长期记忆继续经过用户确认。
- 支持结构化长期记忆和低敏感情景记忆的混合召回，并按独立 token budget 注入 Chat。
- 建立 MCP-ready tool call contract；模型只能提出调用，后端负责执行边界。
- 用固定评测集决定哪些 Agent 启用真实模型，记录被保留为 deterministic 的原因。
- 完整阶段结束后交付一篇详细的面试学习博客。

## 3. 非目标

- 不把所有 Agent 都改成独立 LLM 调用，也不以“Agent 数量”衡量能力。
- 不引入 AutoGen；Agent graph 继续使用 LangGraph。
- 不允许模型直接写数据库、绕过 JWT、ownership、Zod、幂等、审计或用户确认。
- 不让模型决定 FSRS 状态、权限、审计结果、Outbox 状态或工具执行结果。
- 不保存完整私密对话作为长期情景记忆，不把完整 prompt、RAG chunk 或模型回答写入 Trace。
- 不把 Redis 作为聊天或记忆的权威数据源。
- 不在默认 CI 中调用真实模型，不在仓库中保存 API key 或真实用户验收数据。
- 不在本阶段提前实现 Phase 9 的完整 MCP server、外部工具目录或生产授权系统。

## 4. 设计原则

1. **确定性外壳，模型化语义。** 权限、状态机、安全过滤和执行继续确定性；分类歧义、
   语义冲突、信息压缩和候选提取可以交给模型。
2. **PostgreSQL 权威，Redis 加速，Dexie 恢复。** 任何短期或长期记忆都不能只存在于缓存。
3. **分层预算。** 最近消息、会话摘要、学习上下文、长期记忆和工具结果分别分配预算，
   不能让向量召回结果挤掉当前用户问题。
4. **可解释、可撤销、可遗忘。** 用户能看到正式长期记忆和情景记忆摘要，并能停用或删除。
5. **默认最小保存。** 长期层保存结构化事实或摘要，不复制完整原对话。
6. **评测驱动启用。** 真实模型路径必须有 baseline、质量阈值、成本上限和降级路径。

## 5. 总体架构

```text
用户本轮输入
  -> 瞬时工作记忆
     LangGraph/request state
     当前目标、当前题目、用户纠正、最近工具结果
  -> 短期会话记忆
     PostgreSQL ChatMessage + ConversationSummary + ConversationState
     Redis 24h cache/checkpoint + Dexie 离线恢复
  -> 长期记忆召回
     UserMemory（结构化语义记忆）
     UserMemoryEpisode（低敏感情景摘要 + pgvector）
  -> Context Budget Assembler
  -> Router / Tutor / RAG / Verifier / Orchestrator
  -> 最终回答或待确认的 ActionProposal
  -> 脱敏 Trace、摘要推进、候选记忆提取
```

### 5.1 共享模型运行时

`@repo/ai` 提供 provider-neutral 的 `ModelAgentRuntime`，统一处理：

- provider/model 选择、结构化输出 schema、超时、重试和 abort signal；
- mock/live 双开关、输入输出 token 上限、调用次数上限和估算成本；
- 错误分类、降级结果和可写入 Agent Trace 的脱敏 usage metadata；
- 禁止把 key、完整 prompt、完整输出或 provider 原始错误交给 Trace。

`@repo/agent` 只依赖注入的 `ModelInvoker` contract，不读取环境变量或 API key。Next.js
`/api/chat` 和 NestJS MemoryAgent 是 composition root，负责提供经过配置校验的 runtime。
任何 live 调用仍要求 `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true` 同时开启，
并继续执行登录态校验。Mock runtime 必须覆盖所有结构化输出路径。

### 5.2 三层记忆

#### 瞬时工作记忆

生命周期为单次请求或可恢复的短 Agent run，保存：

- 当前用户目标和本轮意图；
- `activeStudyContext` 中的当前题目、OCR 结果和答案边界；
- 尚未完成的 ActionProposal、最近工具名和工具结果摘要；
- 用户对本轮答案的纠正和当前 graph checkpoint。

瞬时层不作为长期用户画像。敏感工具结果只在请求内存在；需要跨请求恢复的字段经过白名单
后写入 `ConversationState`。

#### 短期会话记忆

PostgreSQL 原始 `ChatMessage` 继续是权威历史。新增：

```text
ConversationSummary
  conversationId, userId, summary, coveredThroughOrder
  summaryVersion, sourceMessageCount
  modelProvider, modelName, promptVersion
  createdAt, updatedAt

ConversationState
  conversationId, userId
  activeGoal, activeQuestionId, pendingActionProposal
  lastToolNames, stateVersion, expiresAt
  createdAt, updatedAt
```

`ConversationSummary` 对 `(conversationId, summaryVersion)` 唯一，所有读取同时校验 `userId`。
当未摘要消息达到 12 条，或完整输入预计超过 Chat 输入预算的 70% 时触发增量摘要；摘要只覆盖
完整持久化消息，并用 `coveredThroughOrder` 记录水位。并发更新使用 compare-and-swap：只有旧水位
与读取时一致才能推进，新消息不会被错误标记为已覆盖。摘要失败时继续使用最近消息窗口，不能
阻断 Chat。

`ConversationState` 默认 24 小时过期；PostgreSQL 保留可恢复状态，Redis 只缓存相同版本并使用
24 小时 TTL。缓存 miss、版本不一致或 Redis 不可用时回源 PostgreSQL。Dexie 继续承担本机离线
恢复，不成为跨设备合并裁判。

#### 长期记忆

长期记忆分为两类：

1. `UserMemory`：学习目标、解释偏好、薄弱点、学习习惯等结构化语义记忆。
2. `UserMemoryEpisode`：历史题目结论、用户纠正、重要工具结果和计划调整原因的短摘要。

`UserMemory` 增加以下生命周期字段：

```text
validUntil, lastConfirmedAt, lastUsedAt, useCount
supersedesMemoryId, sensitivity, version
```

`UserMemoryEpisode` 保存：

```text
id, userId, conversationId?, type, summary
embedding vector(1536), importance, confidence, sensitivity
sourceHash, occurredAt, expiresAt, lastUsedAt, useCount
createdAt, updatedAt
```

情景记忆不保存完整原消息，只保存不超过 500 字的摘要和最小来源引用。低敏感情景记忆可自动
生成，默认 30 天过期；被用户固定后可延长，但仍可查看和删除。身份信息、考试目标、长期偏好、
健康、财务、精确位置、账号凭据及其他敏感信息不得自动成为正式长期记忆。

稳定长期记忆继续遵守候选确认流程：模型只创建 `UserMemoryCandidate(PENDING)`，用户确认后
才能成为 `UserMemory(ACTIVE)`。删除长期记忆时同步删除对应 episode embedding 和缓存；禁止
仅从 UI 隐藏而保留不可见向量。

### 5.3 混合召回与上下文预算

长期召回使用以下信号，而不是只按向量相似度排序：

```text
score = semanticSimilarity
      + typeMatch
      + importance
      + confidence
      + recency
      + usageAffinity
      - conflictPenalty
      - duplicationPenalty
```

召回先按 `userId`、status、sensitivity 和有效期过滤，再执行结构化类型匹配与 pgvector 相似度
检索。结果经过去重、冲突检测和 token budget assembler。默认长期记忆预算不超过总输入预算的
15%，最多注入 5 条；当前问题、最近消息和安全 system prompt 的优先级始终更高。

注入内容使用明确边界：记忆是个性化背景，不是事实权威，也不能覆盖用户本轮的新指令。每次
成功使用后 best-effort 更新 `lastUsedAt/useCount`；统计写入失败不影响回答。

## 6. Agent 真实模型化决策与评测

### 6.1 预期决策

| Agent | Phase 6.9 目标路径 | 原因 |
| --- | --- | --- |
| Tool-Using Orchestrator | 真实模型必需，Mock 可回归 | 动态工具选择和参数生成无法只靠固定 route |
| RouterAgent | 高置信 deterministic + 低置信 LLM fallback | 保留常见请求的速度与稳定性，只处理歧义 |
| KnowledgeVerifierAgent | deterministic safety + LLM semantic check | 注入攻击仍由规则拦截，模型只核验复杂冲突 |
| MemoryAgent | deterministic signal gate + LLM candidate extraction | 模型提升归纳能力，候选仍需确认 |
| TutorAgent | 保留 deterministic policy，最终 Chat 模型负责表达 | 避免每次讲题增加一次重复模型调用 |
| ReviewAgent / PlannerAgent | 保留 deterministic | FSRS 和容量事实可解释，模型收益尚未证明 |
| WrongQuestionOrganizerAgent | 保留 deterministic | 分类写库需要稳定、可回归 |
| KnowledgeDedup / Organizer | 保留 deterministic | 删除、替换和归类不能由模型自动决定 |

这张表是待评测的默认结论，不是不可修改的实现假设。每项最终状态必须写入评测报告。

### 6.2 三层评测

1. **Deterministic baseline**：固定数据集运行现有 policy，记录准确率、拒绝率、降级率和耗时。
2. **Mock contract**：验证结构化输出、超时、无效 schema、降级、Trace 和预算，不消耗额度。
3. **Live paired evaluation**：同一脱敏小样本同时运行 baseline 和模型候选，由固定 rubric 比较。

建议固定数据集至少覆盖：

- Router：60 例，包含普通 Chat、讲题、RAG、记忆、复习、歧义和越权请求。
- Verifier：40 例，包含一致、资料不足、事实冲突、过期内容和 prompt injection。
- Memory：40 例，包含明确偏好、偶发陈述、敏感信息、冲突偏好、重复事实和用户纠正。
- Orchestrator：40 例，包含无需工具、单工具、多步骤、参数缺失、危险动作和工具失败。

### 6.3 启用门槛

- Router fallback：歧义子集 macro-F1 相对 baseline 提升至少 10 个百分点；高置信子集不得下降
  超过 2 个百分点；模型路径 p95 额外延迟不超过 2.5 秒。
- Verifier：复杂冲突召回率相对 baseline 提升至少 15 个百分点；prompt injection 放行数必须为
  0；模型失败必须降级到保守 guidance。
- Memory：候选 precision 不低于 0.85；敏感信息自动生效数必须为 0；重复候选率不高于 5%；
  用户拒绝的候选不得通过换写法立即重现。
- Orchestrator：允许工具集合内的工具选择与参数 schema 通过率不低于 90%；越权执行数、未确认
  写操作数和未知工具执行数必须为 0。
- 所有 Agent：单次请求调用次数、输入输出 token 和估算成本均不得超过配置预算；超预算时必须
  有可解释降级结果。

不达标时保留 deterministic 路径并记录原因，不为了“多 Agent 都用了真实模型”降低门槛。
Live 数据集只使用合成或脱敏内容，默认不进入 CI；结果记录模型、provider、promptVersion、
数据集版本、耗时、token 和估算成本。

## 7. MCP-ready Orchestrator 边界

Phase 6.9 只建立协议和本地受控执行器，为 Phase 9 预留：

```text
ToolDescriptor -> ToolCallProposal -> PolicyDecision -> UserConfirmation?
  -> Backend Execution -> ToolResultSummary -> Agent State
```

预留 Memory tools：

```text
memory.search
memory.list
memory.propose
memory.confirm
memory.archive
memory.forget
```

模型输出只能是 Zod 校验后的 `ToolCallProposal`。后端继续负责 JWT、ownership、工具 allowlist、
参数 schema、幂等键、审计、速率限制、敏感类型过滤和用户确认。读工具可以按策略直接执行；
写工具默认生成 ActionProposal，用户明确确认后才执行。工具失败以结构化安全摘要回到 graph，
不把 provider stack、token、cookie 或私有原文返回模型。

## 8. 错误处理与降级

- 模型 runtime 不可用：Router 回到 deterministic route；Verifier 使用保守 guidance；Memory 不创建
  候选；Orchestrator 返回“暂时无法使用工具”，不得猜测执行结果。
- 摘要生成失败：保留旧摘要水位，继续最近消息窗口；下一次满足条件时重试。
- 摘要 schema 无效：丢弃本次输出，不持久化半成品。
- Redis 不可用：回源 PostgreSQL，不影响权威消息和记忆。
- embedding 不可用：只运行结构化长期记忆过滤，情景记忆召回降级为空。
- 冲突记忆：本轮用户明确表达优先；旧记忆标记待确认或被新版本 supersede，不静默覆盖。
- 删除失败：向用户返回失败，不提前从 UI 移除；成功后清理数据库、向量和缓存。
- 工具参数无效或工具未知：拒绝执行并记录脱敏 Trace step。

## 9. 安全、隐私与数据生命周期

- 所有 summary、state、memory 和 episode 查询必须同时限定 `userId` 与资源 id。
- ConversationSummary 是会话压缩数据，不自动升级为长期用户画像。
- 低敏感 episode 自动生成默认 30 天 TTL；过期后由维护任务物理删除 embedding 和记录。
- 正式稳定记忆必须由用户确认；敏感类别永不自动生效。
- Profile 提供正式记忆和情景记忆的查看、停用、删除入口，并说明来源与有效期。
- Trace 只记录 route、状态、模型、token、成本估算、摘要长度和错误码等脱敏元数据。
- API key 只来自被 git 忽略的环境变量，日志、数据库、Trace、测试快照和博客都不得包含 key。
- Live 验收结束后恢复 Mock 配置并清理临时账号、测试会话、候选记忆和 episode。

## 10. 分阶段交付

每个子任务都必须从已推送的最新 `main` 创建新的 `codex/` 分支；不得从功能分支再开分支。
功能分支完成定向测试和验收后用 `--no-ff` 合并 `main`，在 `main` 再验收并推送远程。

### Phase 6.9.1：设计、边界与评测基线

- 本设计文档、路线调整、术语和隐私边界。
- Agent baseline/live paired eval contract 与数据集规范。
- 明确后续文档、验收报告和博客交付物。

### Phase 6.9.2：共享 Model Agent Runtime

- `ModelInvoker` / `ModelAgentRuntime` contract、Mock runtime、live guard、预算和 Trace metadata。
- 先以结构化测试证明超时、schema invalid、预算和降级，再允许 Agent 使用。

### Phase 6.9.3：短期记忆与上下文装配

- `ConversationSummary`、摘要水位、增量摘要和并发 CAS。
- `ConversationState`、Redis cache/checkpoint、Dexie 恢复边界。
- 分层 context budget assembler。

### Phase 6.9.4：Router 与 Verifier 混合模型路径

- Router 低置信 fallback、Verifier 复杂语义核验。
- deterministic、Mock、Live 对照评测；不达标则保留原路径。

### Phase 6.9.5：MemoryAgent 与结构化长期记忆注入

- LLM 候选提取、敏感信息过滤、人审确认、冲突和 supersede。
- ACTIVE 结构化记忆混合检索、独立预算和 Chat 注入。

### Phase 6.9.6：Episodic Memory

- `UserMemoryEpisode`、pgvector、自动低敏摘要、30 天 TTL、查看与删除。
- embedding 降级、过期清理、冲突与遗忘验收。

### Phase 6.9.7：MCP-ready Orchestrator 与阶段验收

- Tool registry contract、proposal、policy decision、确认和安全结果摘要。
- Mock 全链路、预算受控 Live 小样本、Docker 项目启动和可见浏览器验收。
- 汇总 Agent 替换结论，完成详细面试学习博客并同步所有项目文档。

## 11. 测试与验收策略

每个实现任务遵循 TDD：先写失败测试，确认失败原因，再写最小实现并运行定向测试。阶段测试包括：

- `@repo/types`：summary/state/memory/tool/trace Zod contract 和 runtime import。
- `@repo/ai`：Mock/live guard、预算、timeout、schema invalid、provider error sanitization。
- `@repo/agent`：固定 eval set、fallback、冲突、降级和 tool proposal。
- Database：Prisma schema、索引、pgvector、级联删除、TTL 查询和迁移测试。
- Server：JWT、ownership、CAS、候选确认、召回、删除和缓存降级。
- Web：摘要恢复、记忆管理、Chat 注入边界、工具确认和移动端 44px 触摸目标。
- E2E：多用户隔离、并发摘要、模型失败、Redis/embedding 降级和删除闭环。
- Live：仅运行固定小样本，记录 paired eval；不把真实调用加入默认测试套件。

凡改动真实页面，验收时默认打开 headed 可见浏览器，让用户能共同观察。最终阶段必须在 Docker
全栈中启动学习端、API、worker、admin、PostgreSQL、Redis 和 MinIO，创建临时测试账号完成
Chat/记忆/工具边界验收；清理测试数据后恢复 Mock。功能分支验收通过后合并 `main`，再重复关键
测试和项目启动验收，最后推送 `origin/main`。

## 12. 文档与博客规范

每个 6.9.x 任务完成时同步：

- `AGENTS.md`：当前阶段、数据流、安全边界和下一任务；
- `README.md`：用户可见能力、启动方式和真实模型开关；
- `docs/data-flow.md`：请求、摘要、召回、工具调用和降级链路；
- `docs/roadmap.md`：完成状态、验收证据和回顾问题；
- `docs/acceptance-checklist.md` / `docs/ai-behavior-acceptance.md`：Mock、Live、Docker、
  浏览器和清理要求；
- `DEVLOG.md`：提交、原因、验证和“回顾时可以问”。

Phase 6.9.7 完成后新增一篇详细面试学习博客，至少覆盖：

1. 为什么确定性多 Agent 仍需要受控真实模型；
2. 为什么采用瞬时、短期、结构化长期和情景长期记忆；
3. rolling summary 水位、CAS 和上下文预算如何防止丢消息；
4. Router、Verifier、Memory、Orchestrator 的 baseline/live 评测结果；
5. 哪些 Agent 最终启用模型、哪些保留确定性，以及数据依据；
6. pgvector 混合召回、冲突、替代、衰减、遗忘与删除；
7. 工具调用为什么必须经过后端鉴权、schema、幂等、审计和用户确认；
8. Mock/Live/Docker/可见浏览器验收与成本控制；
9. Phase 6.9 如何为 Phase 9 MCP 铺路。

博客不得只罗列代码，必须能回答设计取舍、失败方案、测试证据和面试追问。

## 13. 验收标准

Phase 6.9 完成时必须满足：

- 共享模型运行时能在 Mock 和受控 Live 模式运行，并有统一预算、超时、降级和脱敏 Trace。
- 旧消息裁剪前会生成有水位的滚动摘要；并发、失败和缓存不可用不会丢失权威消息。
- Chat 能按独立预算注入有效结构化长期记忆，不允许记忆覆盖本轮用户指令。
- 低敏情景记忆只保存摘要和 embedding，默认 30 天过期，可查看、可删除。
- 稳定长期记忆仍须用户确认；敏感信息不会自动生效。
- Router、Verifier、Memory、Orchestrator 都有 deterministic/Mock/Live 评测报告。
- Agent 是否启用真实模型由门槛决定；未达标的 Agent 保留 deterministic 并记录原因。
- 未知工具、越权工具和未确认写操作执行数为 0。
- 通过 types、ai、agent、database、server、web、e2e、Docker 和可见浏览器验收。
- 临时账号与验收数据已清理，配置恢复 Mock，代码合并 `main` 并推送远程。
- 项目核心文档和详细面试学习博客已经同步。

## 14. 回顾时可以问

- “Phase 6 原来的多 Agent 为什么不算每个 Agent 都接入了真实模型？”
- “哪些 Agent 在 Phase 6.9 后使用真实模型，评测证据是什么？”
- “为什么 Router 和 Verifier 采用混合路径而不是全部交给 LLM？”
- “ConversationSummary 的水位和 CAS 如何避免并发摘要丢消息？”
- “Redis、PostgreSQL 和 Dexie 在短期记忆里分别负责什么？”
- “结构化长期记忆和 episodic memory 有什么区别？”
- “为什么普通情景记忆可以自动生成，而稳定长期记忆必须确认？”
- “记忆召回如何控制 token、冲突、隐私、过期和删除？”
- “Tool-Using Orchestrator 为什么不能直接执行模型生成的 tool call？”
- “Phase 6.9 如何为 Phase 9 MCP 工具体系提供基础？”
