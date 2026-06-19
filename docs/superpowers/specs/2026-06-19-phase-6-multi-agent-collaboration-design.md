# Phase 6 Multi-Agent Collaboration Design

## 背景

Phase 5 正在把 RAG 知识库从“资料入库”推进到“可检索、可注入 Chat”。但 RAG 本身只负责检索相关资料，不应把用户上传资料当作绝对真理。真实学习场景里，用户笔记、资料摘抄和错题整理都可能存在错误。如果 AI 盲从错误资料，会降低答案正确性。

Phase 6 的核心目标是用 LangGraph 把 PrepMind 从单一 AI 调用升级为多 Agent 协作系统：不同 Agent 分别负责路由、检索、讲题、复习规划、错题整理、资料可信度评估和最终回答整合。

Agent 框架使用 LangGraph，不使用 AutoGen。

## 总体定位

Phase 6 多 Agent 系统是 PrepMind 的最大产品亮点之一。它不是简单把 prompt 拆成多个名字，而是把学习业务拆成可观测、可测试、可降级的节点：

- Chat 仍然必须可降级：没有资料、没有命中、检索失败或评估失败时，仍按普通 AI 能力回答。
- RAG 是证据来源，不是标准答案来源。
- Agent 给出建议和判断，关键写操作仍要尊重用户确认与服务端权限边界。
- 用户手动修改的学习资料、错题组织和复习选择拥有最终优先级。

## 推荐 Agent 拆分

### RouterAgent

负责识别用户意图并决定走哪条工作流：

- 普通问答。
- OCR 题目追问。
- RAG 资料增强问答。
- 错题保存或错题整理建议。
- 复习计划、学习统计或今日任务建议。

RouterAgent 不直接生成最终答案，只选择工作流和必要工具。

### RetrieverAgent

负责调用 Phase 5 的检索 API：

- 根据用户问题和 activeStudyContext 生成检索 query。
- 从用户知识库检索相关 chunks。
- 返回来源、相似度、文档信息和片段内容。

RetrieverAgent 只负责“找相关片段”，不判断片段是否正确。

### TutorAgent / AnswerAgent

负责生成讲解初稿：

- 结合用户问题、题目上下文、RAG chunks 和通用学科知识回答。
- prompt 中必须明确：用户资料可能有误，不可盲从。
- 当资料不足时，按通用知识正常回答，并避免伪造引用。

### KnowledgeVerifierAgent

负责在 AI 最终输出前评估资料和答案可信度。这是对 RAG 的质量门禁，不是绝对裁判。

职责：

- 判断检索片段是否与基础学科知识冲突。
- 判断多个检索片段之间是否互相矛盾。
- 判断 AnswerAgent 初稿是否被可疑资料带偏。
- 给出结构化评估结果：`trusted`、`suspicious`、`conflict`、`insufficient`。
- 当用户资料可能有误时，生成面向用户的轻提示，例如“你的笔记中这部分可能需要核对”。

它不负责：

- 直接修改用户笔记。
- 宣称系统绝对判定用户资料错误。
- 阻断 Chat 普通回答。
- 替代教材、标准答案或人工校对。

### FinalResponseAgent

负责整合最终输出：

- 资料可信时：基于资料回答，并展示引用来源。
- 资料可疑时：优先给出更可靠的解法，同时提示用户核对对应资料片段。
- 资料冲突时：说明存在冲突，给出判断依据，避免直接采用错误片段。
- 资料不足时：正常回答，不强行引用。

### WrongQuestionOrganizerAgent

负责错题本组织结构升级。它不是讲题 Agent，而是“错题整理 Agent”。

职责：

- 将错题本首页从平铺列表升级为“学科卡片优先”，例如“高等数学”“大学英语”。
- 在学科内部按 AI 归纳出的专题 deck 下钻，例如“曲线积分与格林公式”“四级阅读长难句”。
- 基于结构化 OCR、错题知识点、错因、题型、难度、用户备注和复习表现，推荐学科组与专题 deck。
- 没有合适专题时，生成简洁、可读、面向学习的默认专题名。
- 给出归类原因和置信度。

用户拥有最终组织权：

- 用户可以重命名学科卡片或专题 deck。
- 用户可以移动错题、合并专题、删除专题关联。
- 用户手动修改后的名称需要锁定，AI 后续只做建议，不自动覆盖。

更完整设计见 `docs/superpowers/specs/2026-06-18-phase-6-wrong-question-organizer-agent-design.md`。

### KnowledgeDedupAgent / KnowledgeOrganizerAgent

负责学习资料的重复、更新和组织建议。Phase 5.6 已有基于 `contentHash` 的轻量去重和同卡片替换上传，但真实资料管理还会遇到“同一份笔记的新版”“相似但互补的资料”“重复摘抄”“局部修订”等情况，单纯 hash 无法判断。

职责：

- 判断新上传资料是否是已有资料的完全重复、更新版、局部修订或互补资料。
- 在用户重新上传资料时，给出“替换当前卡片”“合并到已有资料”“保留为新资料”的建议。
- 对相似资料生成简洁的差异摘要，例如新增章节、删除段落或重点变化。
- 尊重用户手动选择：用户选择保留、替换或合并后，后续 Agent 不自动覆盖。

它不负责：

- 在未获得用户确认时删除资料。
- 直接改写原始上传文件。
- 替代 `KnowledgeVerifierAgent` 判断资料内容是否正确。
- 阻塞 Chat 普通回答。

### PlannerAgent

负责把 FSRS、ReviewTask、ReviewPreference、学习统计和错题专题结合起来：

- 识别高压力复习日。
- 识别薄弱专题。
- 推荐今日学习重点。
- 后续可结合 WrongQuestionOrganizerAgent 的专题 deck 和 RAG 资料片段生成计划建议。

PlannerAgent 不直接改变 FSRS 算法，计划建议仍以服务端 ReviewTask / Card 数据为事实来源。

### MemoryAgent

负责沉淀用户偏好和长期学习线索：

- 用户常选的解释风格。
- 用户反复出错的知识点。
- 用户手动修正过的错题组织偏好。
- 用户对资料可信度提示的处理结果。

MemoryAgent 只记录明确有价值的长期偏好，不把所有聊天内容无差别写入长期记忆。

## RAG + Verifier 工作流

```text
用户提问
  -> RouterAgent 判断是否需要知识库增强
  -> RetrieverAgent 检索用户资料 chunks
  -> TutorAgent / AnswerAgent 生成回答初稿
  -> KnowledgeVerifierAgent 评估资料片段与回答初稿
  -> FinalResponseAgent 输出最终回答、引用和资料核对提示
```

降级规则：

- 没有资料：跳过 Retriever / Verifier，普通回答。
- 没有命中：普通回答，不伪造引用。
- 检索失败：普通回答，并可轻提示“资料检索暂不可用”。
- Verifier 失败：不阻塞回答，使用 AnswerAgent 的保守回答，并避免强引用。

## 错题整理工作流

```text
保存错题成功
  -> WrongQuestionOrganizerAgent 读取结构化错题字段
  -> 推荐学科组与专题 deck
  -> 服务端写入 deck 关联和置信度
  -> 错题本首页展示学科卡片

用户重命名 / 移动 / 合并
  -> 写入用户偏好或锁定字段
  -> 后续 Agent 归类尊重用户选择
```

## 数据边界

- RAG 文档、Chunk 和 embedding 以 PostgreSQL + pgvector 为权威来源。
- 资料重复与更新判断第一阶段以 `contentHash` 和同用户文档归属为硬边界；Phase 6 Agent 只提供相似资料和版本关系建议，不直接覆盖文档事实。
- 错题事实仍以 WrongQuestion 为权威来源。
- 复习事实仍以 Card / ReviewLog / ReviewTask / ReviewPreference 为权威来源。
- Agent 结果应以建议、评估、引用、原因和置信度形式保存，不直接覆盖事实数据。
- 用户确认后的修改才进入服务端权威数据。

## 分阶段落地

1. Phase 6.0：多 Agent 总体编排设计，明确 LangGraph 节点、状态、降级和观测边界。
2. Phase 6.1：RouterAgent + 基础 Agent runtime，先只包装现有 Chat / OCR / Review 能力。
3. Phase 6.2：RAG Chat 工作流接入 RetrieverAgent、AnswerAgent、FinalResponseAgent。
4. Phase 6.3：接入 KnowledgeVerifierAgent，完成资料可信度评估、冲突提示和保守回答策略。
5. Phase 6.4：补充 KnowledgeDedupAgent / KnowledgeOrganizerAgent 设计与资料版本建议 contract。
6. Phase 6.5：补充错题集数据模型与 contract。
7. Phase 6.6：错题本 UI 改为学科卡片 + 专题 deck 下钻。
8. Phase 6.7：接入 WrongQuestionOrganizerAgent，实现错题保存后的归类建议。
9. Phase 6.8：PlannerAgent 联动复习压力、错题专题和 RAG 资料片段，生成学习建议。
10. Phase 6.9：MemoryAgent 沉淀用户偏好和长期学习线索。

## 验收标准

- 无资料、无命中、检索失败或 Verifier 失败时，Chat 仍能正常回答。
- 命中资料时，回答可以引用用户资料，但不会盲从明显错误片段。
- 当资料片段可疑时，回答能提示用户核对资料，而不是直接宣称用户笔记错误。
- 上传相似资料或更新笔记时，系统能给出替换、合并或保留建议，并尊重用户最终选择。
- 错题本首页可以按学科卡片展示，学科内部按专题 deck 下钻。
- 用户重命名、移动和合并错题专题后，AI 后续整理不会自动覆盖用户选择。
- Agent 的每个关键节点可记录输入、输出、状态和失败原因，方便调试与演示。
