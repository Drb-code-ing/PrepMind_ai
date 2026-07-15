# Phase 6.9 Agent 架构完成路线设计

## 1. 决策与适用范围

本文件记录 2026-07-15 确认的产品与工程决策，并作为 Phase 6.9 后续路线的权威来源：

1. 先完成全部 Agent 的模型路径、职责边界、通信 contract、权限控制、可执行编排与全链路验收，再进入新的分层记忆建设。
2. `MemoryAgent` 的语义候选提取属于 Agent 架构；结构化长期记忆的 Chat 注入、情景记忆、召回、过期、查看和删除属于后续记忆阶段。
3. `ReviewAgent`、`PlannerAgent`、`KnowledgeDedupAgent`、`KnowledgeOrganizerAgent` 必须有真实模型参与。评测用于决定调用条件、预算、prompt、降级和上线门槛，不再用于决定是否完全放弃模型路径。
4. Router 采用真实模型与 deterministic guard 混合路径。Phase 6.9.4.3 的 Router P95 `4264ms` 是历史评测结论和生产约束证据，不是永久禁止 Router 模型的产品决定。
5. 全部 Agent 完成后编写独立的《多 Agent 架构》面试学习博客；分层记忆完成后再编写独立的《记忆系统》博客。题目与最终结构由用户届时确认。

本决策不改写 Phase 6.9.4.3 已发生的评测事实，也不允许用新产品决策修改历史 evidence。历史报告回答“当时为什么没有启用”，本文件回答“后续产品如何继续演进”。

## 2. 当前实现事实

`createAgentGraph()` 当前声明 11 个逻辑节点，但只是 graph descriptor，不是完整可执行的 LangGraph `StateGraph`。`RetrieverAgent` 与 `FinalResponseAgent` 主要由现有 RAG 和 `/api/chat` 流式链路承担，尚无独立的 `@repo/agent` 节点实现；Tool-Using Orchestrator 尚未加入当前 graph descriptor。

descriptor 中的 `thresholdNodes` 也不是当前真实调度器：Review/Planner 和 Knowledge 建议由页面查询触发，Memory 候选由用户按钮触发，WrongQuestionOrganizer 由保存后的受保护回调或批量整理触发。当前 Chat 编排还使用内部占位 `userId`；在接入 owner-aware graph 或工具前，必须改为后端认证得到的 canonical identity，模型与客户端都不能提供身份依据。

因此，“完成 Agent 架构”同时包含：

- 为有语义职责的 Agent 建立受控真实模型路径；
- 把隐含在 Chat/RAG service 中的 Retriever 与 FinalResponse 职责正式化；
- 建立 Agent 间稳定、脱敏、可验证的通信 contract；
- 建立后端权威权限与写操作确认边界；
- 把 descriptor 补成可执行、可恢复、可观测的 LangGraph 编排；
- 完成 Mock、controlled-Live、Docker、可见浏览器和 main 分支复验。

`TutorAgent / AnswerAgent` 是旧文档中的能力合称，当前正式节点按 `TutorAgent` 与 `FinalResponseAgent` 分工，不重复计数。`CriticRubric` 是评测基础设施，不是线上业务 Agent。Conversation summarizer、SafetyGuard、Agent Trace、预算控制和 ModelAgentRuntime 是共享基础设施，不计入业务 Agent 数量。

## 3. Agent 清单与模型路径

| Agent | 权威职责 | 初步模型路径 | 不得越过的边界 |
| --- | --- | --- | --- |
| RouterAgent | 识别意图并选择 Chat、Tutor、RAG、复习、计划、错题整理等路线 | 高置信与安全请求 deterministic；歧义、多意图、上下文指代调用真实模型 | 不决定权限，不直接执行工具或写库；`requiresRag` / `requiresHumanApproval` 由本地 canonical map 重建 |
| TutorAgent | 选择直接答案、苏格拉底提示、步骤检查、概念衔接或完整解法等教学策略 | 明确指令走规则；隐含学习意图和复杂追问走真实模型 | 只输出教学策略和受限 prompt guidance，不写学习事实或越过 FinalResponse |
| RetrieverAgent | 把问题转换为检索请求并召回当前用户资料 | Qwen embedding + 向量/关键词混合检索保留；复杂多轮问题可使用模型 query rewrite | JWT、ownership、document filters、topK 和安全过滤由后端决定；不得让模型看到其他用户资料 |
| KnowledgeVerifierAgent | 判断 RAG 证据是否可信、冲突、过期、不足或含注入攻击 | deterministic safety + 真实模型语义核验 | prompt injection/high-risk 零调用阻断；失败只允许收紧，不能把可疑证据放宽为可信 |
| FinalResponseAgent | 汇总用户问题、会话上下文、Agent 决策、RAG 与工具结果并生成最终回答 | 真实模型必需 | 只消费经过裁剪与标记的上下文；不得声称未执行的写操作或工具结果 |
| WrongQuestionOrganizerAgent | 为错题建议学科组、知识点与专题 deck | 高置信结构化信号走规则；低置信语义分类与相近专题匹配走真实模型 | 用户锁定名称不可覆盖；模型只产生受限建议，写入仍经过当前用户 API、schema 与显式操作 |
| ReviewAgent | 基于 FSRS、错题、Again、难度、稳定性和近期表现诊断薄弱点 | 真实模型必须参与定性诊断；指标与事实由 deterministic 计算 | 不改写 Card、ReviewLog、FSRS 状态或 ReviewPreference；输出只读诊断与有证据的原因 |
| PlannerAgent | 根据 Review、未来到期压力、每日容量和偏好生成学习计划建议 | 真实模型必须参与计划权衡与个性化表达 | 容量、时长上限与到期事实由本地校验；未经确认不创建未来 ReviewTask |
| MemoryAgent | 从聊天和学习信号中提取长期记忆候选 | deterministic 敏感信息 gate + 真实模型候选提取 | 本阶段只完成候选提取；凭据/隐私过滤、证据绑定、去重和用户确认由后端控制，不自动注入 Chat |
| KnowledgeDedupAgent | 判断完全重复、语义重复、疑似新版与互补资料 | hash 零调用；embedding + 真实模型处理语义关系 | 不自动删除、替换或合并；模型只返回文档 ID 间的受限关系和证据码 |
| KnowledgeOrganizerAgent | 生成资料主题、学科、标签与集合建议 | 真实模型必须参与语义分类与聚类建议 | 不自动重命名、分类或写库；ownership、标签 schema 与用户确认由后端控制 |
| Tool-Using Orchestrator | 规划多步任务，选择 Agent/MCP 工具，生成参数并消费安全结果摘要 | 真实模型必需 | 模型只能提出 `ToolCallProposal`；后端负责 allowlist、JWT、ownership、schema、幂等、限流、审计和写操作确认 |

“真实模型必须参与”不等于“每个请求都额外调用一次模型”。高置信零调用、批处理、共享结构化调用或语义缓存可以降低延迟和成本，但必须保留可执行、可评测的真实模型路径，不能用固定规则冒充语义 Agent。Qwen embedding 属于 Retriever 的真实模型能力；Phase 6.9.8 必须正式化并评测复杂多轮 query rewrite，但只有在 paired eval 证明净收益时才启用生成模型 rewrite。

任何包含用户数据的语义缓存都必须按 canonical owner、agent、schemaVersion、promptVersion、model、safety state 和 sanitized input hash 隔离，并设置有界 TTL。跨用户只允许复用不含用户输入或私有资料的公共模板/公开模型工件；cache hit 不能跳过 ownership/safety eligibility，也不能冒充 provider attempt。

## 4. Agent 通信与数据流

### 4.1 实时 Chat 主链

```text
Authenticated Chat Request
  -> RouterAgent
  -> TutorAgent? / RetrieverAgent?
  -> KnowledgeVerifierAgent? -> local evidence projector -> VerifiedEvidenceBundle?
  -> Orchestrator? -> ToolCallProposal -> Backend Policy/Execution -> ToolResultSummary
  -> FinalResponseAgent
  -> Safe Agent Trace
```

- Router 只传递 canonical route、confidence、固定 reason code 和本地权限位，不传 provider 原始输出。
- Tutor 只传递教学策略、深度、回答结构和短 guidance。
- Retriever 向 Verifier 传递当前用户的有界证据集合、安全 metadata 与稳定 chunk ID；它不能自行决定证据可进入最终 prompt。
- Verifier 只输出状态、固定证据码、用户提示和受限 guidance，不传播 provider raw error。随后由本地 evidence projector 同时依据 deterministic safety 与 Verifier 结论生成 `VerifiedEvidenceBundle`，仅包含允许进入 FinalResponse 的有界 excerpt、source/citation ID、trust label、截断标记和 safety code；被阻断的正文不得继续传递。
- Orchestrator 只消费工具目录的安全 descriptor，并只把 `ToolResultSummary` 返回 graph；完整 payload、credential、stack 和私有原文不得进入模型。
- FinalResponse 只生成回答，不反向改变 route、权限、业务事实或工具执行状态。

### 4.2 阈值与显式业务链

```text
WrongQuestion facts -> WrongQuestionOrganizerAgent -> bounded suggestion -> authorized organizer API
Review facts + FSRS plan -> ReviewAgent -> PlannerAgent -> read-only suggestions -> optional user-confirmed action
Document metadata/chunk summaries -> KnowledgeDedupAgent -> KnowledgeOrganizerAgent -> read-only suggestions
Chat/learning signals -> MemoryAgent -> sanitized candidate -> user review
```

Agent 之间不共享可变数据库对象，不接收客户端声明的 `userId` 作为权限依据。跨 Agent 通信使用 Zod 校验的版本化 DTO；每个输出明确 `runId`、`agent`、`schemaVersion`、`status`、`reasonCodes`、`usageRef` 和 `degraded`，正文只在下一节点确实需要时以独立、受预算约束的字段传递。

若一次 provider call 同时服务多个 Agent，Trace 创建一个 parent `modelCallId` 并只记账一次 input/output token counts 与成本；各 Agent step 通过 `usageRef` 引用它，不重复累加。cache hit 标记 `attempted=false/cached=true/usage=0` 并记录安全版本哈希，不伪造调用。默认不做主观 token 拆分；确需分摊时必须使用固定、版本化算法并保留总量守恒测试。

## 5. 权限与执行原则

1. **身份权威在后端。** JWT 解析出的账号身份和数据库 ownership 是唯一用户边界，模型和客户端都不能重写。
2. **建议与执行分离。** Agent 输出是 decision、strategy、diagnosis、plan 或 proposal；写数据库、调用工具和创建任务由受保护的 service 执行。
3. **写操作按风险授权。** 删除、替换、合并、改名、创建未来任务和外部工具写操作必须显式确认。用户已发起的“保存错题/整理错题”可以授权受限、可撤销的组织层 upsert，但模型不能借此修改错题事实、用户锁定名称或执行其他写操作；历史幂等 API 仍需保留唯一键与事务边界。
4. **安全门先于模型。** 凭据、prompt injection、越权资源、未知工具和危险参数在 provider 调用前 fail-closed。
5. **失败不扩大权限。** timeout、schema invalid、provider failure、budget exhaustion 或 abort 只能降级到本地保守结果，不能绕过 guard 或伪造执行成功。
6. **可观测但不泄密。** Trace 只记录固定状态、reason code、耗时、input/output token counts、成本估算和哈希标识，不记录完整 prompt、回答、chunk、工具 payload、API key、access/refresh token、cookie、base URL 或 stack。

### 5.1 可重放安全的确认 contract

高风险 `ToolCallProposal` 必须先由后端持久化为不可变待确认记录，并绑定：canonical user、proposal ID、tool/descriptor version、canonical parameter hash、目标 resource/version、policy version、expiresAt、一次性 confirmation nonce 和 idempotency key。确认时必须重新认证当前用户、校验 ownership/role/schema/policy、比较 resource version、防止参数替换，并通过 CAS 完成 `PENDING -> EXECUTING`；过期、已使用、资源变化或 hash 不一致一律拒绝。执行结果与审计绑定同一 proposal/idempotency key，重放不得产生第二次副作用。

“保存错题/整理错题”的低风险组织层授权只在当前已认证请求或其带同一 operation ID 的有界异步任务内有效；仅允许创建/更新当前错题的 group/deck/item，任务结束即失效，不形成账号级持续授权。用户锁定名称、错题事实、删除/移动和跨 deck 批量变更仍需独立 API 权限或确认。

### 5.2 工具结果 contract

`ToolResultSummary` 至少包含 `callId`、`toolName`、`status`、`dataClassification`、稳定 source references、受限结果字段、`truncated`、trust label 和固定 error code。只有同一 canonical owner 且回答确实需要的最小字段才能进入 graph；credential、完整 payload、provider/server raw error 与无关私有原文必须删除。FinalResponse 必须能够区分“真实执行成功”“安全摘要不完整”“工具失败”和“未执行”，不得根据缺失字段猜测结果。

## 6. 评测与上线决策

每个 Agent 依次通过 deterministic baseline、Mock contract、controlled-Live paired eval、生产编排 Mock（真实 composition root 与 orchestration、Mock provider）、Docker 和用户可见业务入口验收。没有独立 UI 的 Agent 通过真实业务入口、Trace 页面与 API 证据验收，不为验收临时制造无产品价值的页面。通用门槛包括：

- critical safety failure 为 0；
- 权限、未知工具和未确认写操作执行数为 0；
- structured output、schema、timeout、abort、预算和降级可回归；
- provider/model、promptVersion、datasetVersion、usage provenance、P95 延迟和成本可追踪；
- 模型失败不阻断主业务，且降级结果不比 deterministic 安全边界更宽松。

对用户已指定必须模型化的 Agent，未达到质量、延迟或成本门槛时保持生产 gate 关闭并继续优化，不把其永久改回纯 deterministic。对混合 Agent，评测同时决定 zero-call 范围与模型调用范围。

本总设计不替代各 Agent 的专项启用规范。每个 Agent 开始实现前必须先固定 datasetVersion、质量指标与数值门槛、critical cases、P95 timeout、单次/请求级 token 与成本上限、zero-call/fallback 范围，并经对应设计文档批准；缺少任一数值门槛不得开启 production gate。

模型失败的最小降级语义为：Router 回到 canonical local route；Tutor 使用 generic tutor guidance；Retriever 使用原 query 的 owner-scoped 混合检索或无 RAG；Verifier 收紧为 suspicious/insufficient；WrongQuestionOrganizer 回到高置信结构化归类或未分类；Review/Planner 回到只读 deterministic facts baseline；Memory 不创建候选；Knowledge Agent 只保留 exact-hash/本地高置信结论；Orchestrator 不执行工具并返回未执行状态。FinalResponse 是用户输出终点，模型不可用时返回固定、诚实的暂不可用响应并保留用户消息，不伪造回答、引用或执行成功。“不阻断主业务”指不破坏业务事实与后续重试能力，不承诺主模型故障时仍能生成等价答案。

## 7. 修订后的阶段顺序

1. **Phase 6.9.4.4**：完成 Router / Verifier 混合生产路径、Docker、controlled-Live、可见浏览器验收、main 复验与推送。
2. **Phase 6.9.5**：ReviewAgent / PlannerAgent 真实模型候选、paired eval、生产只读建议与权限边界。
3. **Phase 6.9.6**：KnowledgeDedupAgent / KnowledgeOrganizerAgent 的 embedding + 真实模型语义判断、只读建议和人审边界。
4. **Phase 6.9.7**：TutorAgent / WrongQuestionOrganizerAgent 的混合模型路径与业务写入隔离。
5. **Phase 6.9.8**：RetrieverAgent / FinalResponseAgent 职责正式化、`VerifiedEvidenceBundle`、通信 contract、端到端 Trace；清除 Chat 内部占位 `userId`，改用后端认证得到的 canonical identity，并把这一项设为 owner-aware graph/tool 接入的阻断门。
6. **Phase 6.9.9**：MemoryAgent 敏感凭据缺陷修复、40-case paired eval 和真实模型候选提取；不在本阶段实现 Chat 记忆注入。
7. **Phase 6.9.10**：MCP-ready Orchestrator、可重放安全的工具权限/确认 contract、可执行 LangGraph graph family、全 Agent 协作与阶段验收。
8. **Phase 6.10**：在全部 Agent 验收完成后，实施结构化长期记忆注入、Episodic Memory、embedding、混合召回、30 天过期、查看、删除和遗忘闭环。
9. **Phase 8 / Phase 9**：随后进入性能/PWA 与完整 MCP Tool 体系。

每个新阶段必须从已推送的最新 `main` 开 `codex/` 分支，不从功能分支再开分支。每个计划任务只包含一个可独立验证的关注点并对应一个提交；contract/schema、candidate/policy、runtime composition、业务集成、Trace、Docker/文档和验收证据原则上拆成不同任务。阶段完成后 `--no-ff` 合并 main，在 main 重跑关键静态、Live、Docker 和可见浏览器验收，再推送远程并核对 SHA。

这里的可执行 LangGraph 是一组共享 contract 与治理规则下的 graph family，不是把所有触发方式塞进一个高权限单体图：实时 Chat graph 负责 Router/Tutor/Retriever/Verifier/FinalResponse；Review/Planner、Knowledge 建议、Memory candidate 和 WrongQuestion organization 使用各自最小状态的显式/事件 graph；Orchestrator 通过受限 proposal 调用已注册 Agent/tool subgraph。graph 之间不共享可变 state，也不继承调用方没有的权限。

Phase 6.9.10 只建设 provider-neutral 的 `ToolDescriptor -> ToolCallProposal -> PolicyDecision -> Confirmation -> Executor -> ToolResultSummary` 内部 contract，并用少量现有 first-party read/proposal 工具完成可执行评测；不实现外部 MCP server、JSON-RPC transport、第三方 OAuth、远程工具市场或生产外部授权。Phase 9 再把该内部 contract 适配为完整 MCP Tool 体系，避免提前扩张或重复建设。

Phase 6.9.9 的候选继续以 PostgreSQL owner-scoped `PENDING` 记录跨设备展示；候选在 accepted/rejected 或创建后 30 天到期。拒绝后删除候选正文，只保留 30 天的安全 source hash/suppression metadata，防止模型立即换写法重提；接受后才形成正式结构化记忆。该候选 TTL 不等于 Phase 6.10 Episodic Memory TTL。

Phase 6.10 的 30 天过期仅适用于普通低敏 Episodic Memory，从 `createdAt` 计算且普通 recall 不自动续期；到期后立即停止召回，并由维护任务物理删除记录与 embedding。用户显式固定或确认的结构化长期记忆使用独立生命周期，不套用这一 TTL。

## 8. 文档与博客交付

每个 Agent 子阶段验收后同步：

- `AGENTS.md`：当前状态、边界、配置、证据、下一任务和可复制追问；
- `README.md`：用户可见能力、模型开关和运行方式；
- `docs/roadmap.md`：阶段状态、提交与验收证据；
- `docs/data-flow.md`：Agent 通信、权限和降级数据流；
- `docs/ai-behavior-acceptance.md` / `docs/acceptance-checklist.md`：Mock、Live、Docker、浏览器和清理要求；
- `docs/dev-start.md`：新增环境变量、Docker 和启动差异；
- `DEVLOG.md`：完成内容、原因、验证结果以及“回顾时可以问”。

博客分为两个独立交付物：

1. 全部 Agent 与 Orchestrator 验收后编写《多 Agent 架构》面试学习博客，重点覆盖 LangGraph、模型/规则混合、Agent 通信、权限、工具、人审、Trace、评测、成本和失败降级。
2. Phase 6.10 完成后编写《记忆系统》面试学习博客，重点覆盖瞬时/短期/长期/情景记忆、CAS、embedding、混合召回、冲突、衰减、过期、遗忘与删除。

两篇博客的最终题目、结构和写作时间由用户另行确认，不在某个 Agent 子任务中提前收尾。达到对应技术里程碑表示“具备写作条件”，博客不会被静默取消；是否在进入下一工程阶段前立即写作，由用户在里程碑验收时决定。

## 9. 当前完成标准

Phase 6.9 只有在以下条件全部满足后才算 Agent 架构完成：

- 12 个受治理组件的职责、输入输出、触发点、通信与权限边界均有代码和文档依据；
- 必须模型化的 Agent 存在通过门槛的真实模型路径，混合 Agent 的 zero-call 与 model-call 范围有固定评测；
- Retriever、FinalResponse 与 Orchestrator 不再只是文档中的逻辑名称；
- LangGraph 是可执行编排而非仅 descriptor，且具备循环上限、预算、abort、降级和 Trace；
- 内部占位身份已清除；未知工具、越权访问、跨用户读取、确认重放、参数替换和未确认写操作执行数均为 0；
- 分支与 main 均通过静态、Mock、controlled-Live、Docker 和可见浏览器验收；
- 核心文档已同步，远程 main SHA 与本地一致。

达到以上标准后，才能把 Phase 6.10 分层记忆列为当前开发任务。

## 10. 回顾时可以问

- “当前 12 个 Agent/Orchestrator 分别负责什么，哪些是真实实现，哪些曾经只是逻辑节点？”
- “为什么 Review、Planner、KnowledgeDedup 和 KnowledgeOrganizer 必须有真实模型参与？”
- “Agent 之间传什么，不传什么，为什么不共享可变业务对象？”
- “为什么模型可以提出计划或工具调用，却不能决定权限和直接写库？”
- “Router 6.9.4.3 延迟失败为什么是历史证据，而不是永久禁止模型？”
- “MemoryAgent 的候选提取为什么属于 Agent 阶段，而记忆注入和召回属于 Phase 6.10？”
- “什么时候写多 Agent 博客，什么时候写记忆系统博客？”
