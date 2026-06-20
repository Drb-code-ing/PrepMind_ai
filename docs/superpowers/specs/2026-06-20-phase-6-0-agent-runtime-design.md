# Phase 6.0 Agent Runtime Design

## 背景

Phase 5 已经完成 RAG 知识库主链路，项目进入 Phase 6：使用 LangGraph 构建多 Agent 协作系统。

Phase 6 的目标不是把 prompt 拆成多个 Agent 名字，而是把 PrepMind 已有的聊天、OCR 讲题、RAG、错题本、FSRS 复习和学习计划能力组织成可观测、可降级、可人审、可持续扩展的工作流。

本设计只覆盖 Phase 6.0 的 Agent Runtime 地基。后续 TutorAgent、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent 和 MemoryAgent 都应该建立在这套地基之上。

## 设计目标

1. 使用 LangGraph `StateGraph` 建立统一 Agent 编排层。
2. 定义统一 `AgentState`，承载用户输入、会话上下文、OCR 题目、RAG 命中、复习数据、长期记忆候选、工具调用建议和最终回答。
3. 区分实时 Agent 和异步阈值 Agent，避免每次聊天都触发高成本分析。
4. 所有关键写操作走 `ActionProposal`，由用户确认后再写入服务端事实数据。
5. 建立 Agent 运行日志和步骤日志，方便调试、复盘、演示和后续成本分析。
6. 保留 Checkpoint 边界，为长流程恢复、页面切换不中断和后续 Human-in-loop 打基础。
7. 所有 Agent 失败都必须可降级，不能阻塞 Chat 主链路。

## 非目标

- 不在 Phase 6.0 完整实现所有业务 Agent。
- 不改写 FSRS 调度算法。
- 不让 Agent 静默修改错题、复习任务、资料或长期记忆。
- 不把所有聊天内容无差别写入长期记忆。
- 不强制每次 Chat 都调用 RAG、ReviewAgent 或 MemoryAgent。
- 不在 Phase 6.0 引入复杂后台队列；BullMQ 可留到 Phase 7 或 Phase 6 后续子阶段接入。

## 总体原则

### 实时主链路优先低延迟

用户聊天和讲题必须快。实时链路只允许放必要节点：

- `RouterAgent`
- `TutorAgent / AnswerAgent`
- 条件触发的 `RetrieverAgent`
- 条件触发的 `KnowledgeVerifierAgent`
- `FinalResponseAgent`

如果 Router 判断当前问题不需要资料检索、不需要复习分析、不需要计划建议，就直接进入普通讲题或问答链路。

### 分析型 Agent 采用异步阈值触发

`ReviewAgent`、`MemoryAgent`、`PlannerAgent`、`WrongQuestionOrganizerAgent` 不应该每次对话都跑。它们适合在事件或阈值满足后执行，例如：

- 新增错题累计到一定数量。
- 同一知识点或同一专题错题重复出现。
- 连续使用达到一定天数。
- 用户打开计划页或主动点击生成分析。
- 用户上传或替换资料。

### Agent 给建议，用户做确认

Agent 产物应以建议、原因、置信度、引用和风险提示的形式保存。涉及写库的动作必须生成 `ActionProposal`：

- 保存长期记忆。
- 修改错题专题。
- 合并或替换资料。
- 创建学习计划建议。
- 批量整理错题。

用户确认后才调用服务端 API 写入事实数据。

### 数据事实源保持清晰

- Auth / User 事实来自 NestJS + PostgreSQL。
- WrongQuestion 事实来自 WrongQuestion API。
- Review 事实来自 Card / ReviewLog / ReviewTask / ReviewPreference。
- RAG 事实来自 Document / Chunk / pgvector。
- Agent 结果只是建议和评估，不能覆盖事实源。

## Agent 分层

### 实时 Agent

| Agent | 职责 | 触发方式 | 是否允许写库 |
| --- | --- | --- | --- |
| RouterAgent | 判断用户意图和工作流 | 每次 Chat / 工具入口 | 否 |
| TutorAgent / AnswerAgent | 讲题、追问、普通问答 | Router 选择 | 否 |
| RetrieverAgent | 检索用户资料 chunks | Router 判断需要 RAG 时 | 否 |
| KnowledgeVerifierAgent | 评估资料和回答可信度 | RAG 命中且回答依赖资料时 | 否 |
| FinalResponseAgent | 统一最终输出格式 | 每次实时工作流结束 | 否 |

### 异步或阈值 Agent

| Agent | 职责 | 触发方式 | 写入方式 |
| --- | --- | --- | --- |
| WrongQuestionOrganizerAgent | 学科卡片和专题 deck 建议 | 新错题、未归类错题阈值、用户主动整理 | `ActionProposal` 后确认 |
| ReviewAgent | 错题和复习表现分析 | 错题/复习行为达到统计意义 | `ActionProposal` 后确认 |
| PlannerAgent | 学习计划建议 | 打开计划页、每日首次登录、偏好变化 | 建议优先，确认后写入 |
| MemoryAgent | 长期记忆候选提取 | 明确偏好、周期总结、反复薄弱点 | 用户确认或可撤销 |
| KnowledgeDedupAgent | 资料重复、更新、互补判断 | 上传或替换资料 | 用户确认合并/替换/保留 |

## 阈值策略

### ReviewAgent 触发条件

满足任一条件即可生成复习分析候选：

- 新增错题数量达到 5 道。
- 同一知识点错题达到 3 道。
- 同一专题最近复习失败达到 3 次。
- 用户连续使用达到 7 天。
- 用户点击“生成学习分析”。

ReviewAgent 不直接改变 FSRS，不直接创建 ReviewTask，只输出薄弱点、错因类型、建议复习专题和原因。

### MemoryAgent 触发条件

满足任一条件即可生成长期记忆候选：

- 用户明确表达偏好，例如“以后都用这种方式讲”。
- 同一薄弱点在多次错题或复习中反复出现。
- 连续使用达到 7 天后做一次学习偏好总结。
- 最近有效学习消息累计达到 20 条。
- 用户确认某条资料提示或错题归类建议有长期价值。

MemoryAgent 只能写入候选记忆。候选记忆需要用户确认，或者至少提供撤销入口。

### WrongQuestionOrganizerAgent 触发条件

满足任一条件即可生成错题整理建议：

- 保存错题成功后进入轻量归类队列。
- 未归类错题达到 3 道。
- 同一学科新增错题达到 5 道。
- 用户点击“整理错题本”。
- 用户手动移动或重命名专题后，记录用户偏好，后续整理尊重该偏好。

用户重命名、移动、合并后的专题拥有更高优先级，Agent 不自动覆盖。

### PlannerAgent 触发条件

满足任一条件即可刷新计划建议：

- 用户打开 `/plan` 或今日任务页。
- 每日首次登录。
- ReviewPreference 发生变化。
- 逾期卡片增加达到 5 张。
- 用户点击“生成学习计划”。

计划建议可以缓存，避免每次进入页面都调用模型。

## AgentState 设计

`AgentState` 应该表达当前工作流需要的最小公共上下文：

```ts
type AgentRoute =
  | 'chat'
  | 'tutor'
  | 'rag_answer'
  | 'wrong_question_organize'
  | 'review_analysis'
  | 'study_plan'
  | 'memory_reflection'
  | 'knowledge_dedup';

type AgentState = {
  runId: string;
  userId: string;
  conversationId?: string;
  input: {
    text: string;
    attachments?: Array<{
      type: 'image' | 'document';
      url: string;
      metadata?: Record<string, unknown>;
    }>;
  };
  route?: {
    name: AgentRoute;
    confidence: number;
    reason: string;
    requiresRag: boolean;
    requiresHumanApproval: boolean;
  };
  chatContext?: {
    recentMessages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
    activeStudyContext?: string;
  };
  ragContext?: {
    query: string;
    chunks: Array<{
      documentId: string;
      documentTitle: string;
      chunkId: string;
      content: string;
      score: number;
    }>;
  };
  verifierResult?: {
    status: 'trusted' | 'suspicious' | 'conflict' | 'insufficient' | 'skipped';
    reason: string;
    userNotice?: string;
  };
  reviewContext?: {
    dueCount?: number;
    overdueCount?: number;
    weakKnowledgePoints?: string[];
  };
  proposals: ActionProposal[];
  finalResponse?: {
    markdown: string;
    citations?: Array<{
      documentId: string;
      title: string;
      chunkId: string;
      score: number;
    }>;
  };
  errors: Array<{
    node: string;
    message: string;
    recoverable: boolean;
  }>;
};
```

Phase 6.0 可以先落地这个状态结构的核心字段，后续按 Agent 子阶段扩展。

## ActionProposal 设计

`ActionProposal` 是 Human-in-loop 的统一出口：

```ts
type ActionProposal = {
  id: string;
  type:
    | 'SAVE_MEMORY'
    | 'ORGANIZE_WRONG_QUESTION'
    | 'MERGE_WRONG_QUESTION_DECK'
    | 'CREATE_STUDY_PLAN'
    | 'REPLACE_KNOWLEDGE_DOCUMENT'
    | 'MERGE_KNOWLEDGE_DOCUMENT';
  title: string;
  summary: string;
  reason: string;
  confidence: number;
  payload: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: string;
};
```

前端可以把它展示成建议卡片。用户接受后，服务端再调用对应业务 API。

## 运行日志设计

Phase 6.0 应预留两层日志。

`AgentRun`：

- `id`
- `userId`
- `conversationId`
- `route`
- `status`
- `startedAt`
- `finishedAt`
- `totalDurationMs`
- `inputTokenEstimate`
- `outputTokenEstimate`
- `modelProvider`
- `modelName`
- `costEstimate`

`AgentStep`：

- `id`
- `runId`
- `node`
- `status`
- `startedAt`
- `finishedAt`
- `durationMs`
- `inputSummary`
- `outputSummary`
- `errorMessage`

日志第一版可以只记录摘要，不保存完整敏感内容。后续如果要保存完整输入输出，需要明确隐私边界。

## Checkpoint 策略

Phase 6.0 先定义边界，不要求完整长任务恢复：

- 短实时 Chat 可以不强依赖持久化 checkpoint。
- 涉及 Human-in-loop 的 ActionProposal 必须可恢复。
- 异步阈值 Agent 的运行状态应可恢复，避免重复执行。
- 页面切换不能导致已经开始的实时响应丢失，这部分沿用现有 Chat runtime 能力，Phase 6 后续可和 checkpoint 汇合。

## 成本控制

1. 默认开发环境继续使用 mock 模型。
2. 真实模型调用必须通过 live 双开关控制。
3. RouterAgent 第一版应尽量使用轻量规则 + 小模型，而不是每次调用高成本模型。
4. ReviewAgent、MemoryAgent、PlannerAgent 默认走阈值触发或手动触发。
5. 对同一天同一用户同类分析做缓存，避免重复生成。
6. AgentRun 记录 token 和成本估算，方便发现异常调用。
7. RAG 命中但资料很弱时，不强行调用 Verifier，可直接降级普通回答。

验收阶段允许在必要时启用真实模型，但必须同时满足：

- `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true` 显式开启。
- 保留 `AI_MAX_INPUT_TOKENS=2500` 和 `AI_MAX_OUTPUT_TOKENS=1200` 或更低预算。
- 优先使用低成本模型，例如 `deepseek-v4-flash`。
- 每次 live 验收前明确测试用例数量，避免开放式手动长测。
- AgentRun 必须记录模型、token 估算和成本估算。
- live 验收只用于确认模型理解、讲题准确性、Verifier 判断质量和最终输出质量；普通回归测试继续使用 mock。

## 降级策略

- Router 失败：按普通 Chat 处理。
- Retriever 失败：跳过 RAG，普通回答，并可轻提示资料检索暂不可用。
- Verifier 失败：使用 AnswerAgent 的保守回答，不强引用资料。
- FinalResponse 失败：返回 AnswerAgent 的原始 markdown。
- 异步 Agent 失败：记录失败日志，不影响用户主流程。
- ActionProposal 写入失败：保留前端提示，不修改事实数据。

## Phase 6.0 验收标准

1. `@repo/agent` 能导出基础 `AgentState` 类型、route 类型、proposal 类型和 graph 创建入口。
2. Router skeleton 能把输入路由到至少两个分支：普通 Chat 和 Tutor。
3. Agent runtime 能返回结构化结果，而不是只返回字符串。
4. AgentRun / AgentStep 至少有内存或服务端可替换接口，后续能落库。
5. ActionProposal 类型和状态流明确，后续业务 Agent 可以复用。
6. ReviewAgent、MemoryAgent 等分析型 Agent 不在每次 Chat 中自动执行。
7. 任一节点抛错时，主链路能降级，不让用户看到未处理异常。
8. 单元测试覆盖 Router、阈值判断、proposal 状态和降级逻辑。

## 后续阶段建议

1. Phase 6.1：RouterAgent + TutorAgent，包装现有 Chat/OCR 讲题链路。
2. Phase 6.2：RetrieverAgent + FinalResponseAgent，重构现有 Chat RAG 注入。
3. Phase 6.3：KnowledgeVerifierAgent，增加资料可信度评估和冲突提示。
4. Phase 6.4：WrongQuestionOrganizerAgent，落地学科卡片 + 专题 deck。
5. Phase 6.5：ReviewAgent + PlannerAgent，生成复习分析和学习计划建议。
6. Phase 6.6：MemoryAgent，长期记忆候选、人审确认和撤销。
7. Phase 6.7：Agent Trace UI、成本看板和固定评测集。
