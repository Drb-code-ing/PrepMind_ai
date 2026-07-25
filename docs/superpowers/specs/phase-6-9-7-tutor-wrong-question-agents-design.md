# Phase 6.9.7 Tutor / Wrong-Question Organizer Hybrid Agents Design

日期：2026-07-23
状态：设计冻结；Task 1--11 已完成，Tutor 与 WrongQuestionOrganizer 的 default-off composition、strict API runtime metadata、来源状态、72-case strict paired Mock 工程门、Docker allowlist/角色隔离/回滚合同与分支全量 checkpoint 均已通过；V1 与 V2 两条唯一 controlled-Live 均已失败封存且不得重跑，产品验收与 Task 13 main 收尾未开始；V3 R0--R2 已完成零 Provider 设计、安全诊断/零网络 compatibility、strict-gate breaker、固定分母与双 lane ledger，下一步仅 R3 独立 CLI/journal/crash-only seal/evidence
上游权威：`docs/superpowers/specs/2026-07-15-phase-6-9-agent-architecture-completion-design.md`

## 1. 决策、目标与价值

Phase 6.9.7 把两个仍是纯确定性策略的业务 Agent 升级为受治理的混合模型路径：

- `TutorAgent` 负责决定“这次应该怎么教”，不是最终回答模型；
- `WrongQuestionOrganizerAgent` 负责提出错题学科与专题组织建议，不能直接拥有身份、事实或数据库权限。

本阶段采用同一原则：**模型负责有限语义判断，本地代码负责事实、权限、安全、预算、最终结果和写入。**

这两个 Agent 的触发方式和风险不同，因此不强行共用一套编排：

- Tutor 是 `/api/chat` 内的在线低延迟只读策略节点；
- WrongQuestionOrganizer 是 NestJS 认证 API 后的组织层写路径，必须把模型建议与授权写命令物理分离。

阶段完成后，用户可以在受控开关下真正使用模型理解隐含教学意图和低置信错题语义；默认开关关闭时仍保留现有确定性产品能力。阶段完成不代表 Phase 6.9 全部完成，也不进入 Phase 6.10 记忆系统。

## 2. Task 0 冻结时的实现事实与缺口

### 2.1 TutorAgent

当前 `packages/agent/src/nodes/tutor.ts` 仅使用中英文关键词，把输入归为：

- `explain_solution`
- `socratic_hint`
- `step_check`
- `concept_bridge`
- `answer_direct`
- `general_follow_up`

它随后本地计算深度、回答结构、是否追问、是否给最终答案，并生成短 `promptAddition`。`apps/web/src/lib/chat-agent-runtime.ts` 只在 Router 返回 `tutor` 时调用该 policy；最终流式回答仍由 `/api/chat` 的现有 Chat 模型生成。

现有优点必须保留：

- 明确指令响应快，不需要额外模型调用；
- Tutor 不写数据库、不执行工具、不修改 Router 权限；
- 策略失败可回退到 generic tutor prompt；
- intent/depth 已通过 headers 和 Agent Trace 安全观测。

现有缺口：

- “我还是不懂”“这里呢”“我算到这一步了”一类隐含或上下文指代容易落入 `general_follow_up`；
- 关键词冲突只能靠固定优先级，不能理解用户究竟想要提示、纠错还是完整讲解；
- 没有 Tutor 专属 candidate schema、eligibility、预算、独立 gate、usage/cost 和 paired eval；
- Trace 目前只有 Router/Verifier 的模型 observation，没有 Tutor 模型 provenance。

Task 3 已补齐 package candidate/merger；Task 5 又把它接入 Web server-only composition：固定 DeepSeek V4 Pro non-thinking JSON、3000ms、独立 `1/1200/300` 预算与 `0.006 CNY` cap，只读取 `TUTOR_AGENT_DEEPSEEK_API_KEY`。live access/context prepare 后只注册 Tutor factory；非 Tutor final route 不创建 Tutor bundle/runtime 或读取 component credential，Live executor/runtime 只在 final canonical `route=tutor` 且 implicit/contextual/conflicting candidate 真正调用时构造一次；失败保留原 route 与 deterministic strategy。安全 header/Trace、request abort、Router/Verifier 预算隔离和 Docker web-only allowlist 均已完成静态/Mock 验证。Task 9 已补齐专项 paired runner、一次性 CLI 与 evidence validator，但 production gate 仍默认关闭，尚未执行 controlled-Live、Docker API 或可见浏览器验收。

### 2.2 WrongQuestionOrganizerAgent

当前 `packages/agent/src/nodes/wrong-question-organizer.ts` 按以下优先级生成组织结果：

```text
knowledgePoint -> category -> errorType -> 未分类错题
```

NestJS `WrongQuestionOrganizerService` 以 JWT 得到的 canonical `userId` 查询错题和已有 deck，随后写入：

- `WrongQuestionSubjectGroup`
- `WrongQuestionDeck`
- `WrongQuestionDeckItem`

现有优点必须保留：

- Controller 全部经过 `JwtAuthGuard`；
- 查询和写入按当前 `userId` 隔离；
- `userId + wrongQuestionId` 唯一约束保证一题同一时间只有一个 deck item；
- `force=false` 时已有组织结果保持幂等返回；
- 自动整理失败不影响错题保存。

现有缺口：

- `questionText / analysis / answer / userNote` 没有参与语义判断；
- 专题匹配只是字符串包含关系，跨表达、同义词和专业课术语识别弱；
- 用户可变字段只做 trim/空白压缩，缺少完整字段的 credential、instruction、控制字符和 hostile accessor 防护；
- `organizeBatch` 逐题调用且整体非原子；若直接把模型接到 `organizeOne`，最多 50 次外部调用并可能形成并发重复 deck；
- 没有 owner snapshot、模型前后 stale fence、安全 Trace、usage/cost 或模型来源状态。

## 3. 方案比较与决定

### 3.1 全部请求都调用模型

拒绝。明确的“只给答案”、已有 deck item、完整知识点或不安全输入不需要模型；对批量整理逐题调用还会扩大延迟、成本和失败面。

### 3.2 让模型自由生成 prompt、subject、deck ID 和写操作

拒绝。它会把模型输出变成身份、事实和数据库命令，无法证明跨用户隔离、用户锁定名称、幂等和并发安全。

### 3.3 受限候选 + 本地权威 merger

采用。两个模型 candidate 都只能读取经过安全投影的本地 ordinal，并返回 strict enum/ordinal/有界 label；本地代码重新构建所有真实 ID、权限位、prompt guidance、理由、description、confidence、Trace 与写命令。

模型配置固定为 DeepSeek V4 Pro non-thinking JSON-object profile。原因是项目已对该 profile 建立结构化输出、正数 usage 和 CNY `3/6 per million` 的真实验收基础；本阶段仍建立新的独立 dataset、prompt、一次性授权和 evidence，不能复用 Phase 6.9.5/6.9.6 的质量结论。

## 4. 职责与权限矩阵

| 能力                      | Tutor 模型         | Organizer 模型     | 本地权威                             |
| ------------------------- | ------------------ | ------------------ | ------------------------------------ |
| 识别隐含意图              | 可                 | 不适用             | eligibility 与安全门                 |
| 选择教学深度              | 可在受限枚举内建议 | 不适用             | 最终深度与结构组合校验               |
| 生成最终回答              | 不可               | 不可               | 既有 Chat 最终模型                   |
| 选择已有专题              | 不适用             | 只能返回 ordinal   | owner map 与真实 deck ID             |
| 建议新专题标签            | 不适用             | 只能返回有界 label | 文本 guard、名称和 description       |
| 决定用户身份/权限         | 不可               | 不可               | JWT + owner-scoped service           |
| 修改 WrongQuestion 事实   | 不可               | 不可               | 本阶段无此写能力                     |
| 写 SubjectGroup/Deck/Item | 不可               | 不可               | 授权 command transaction             |
| 覆盖用户锁定名称          | 不可               | 不可               | 永久拒绝                             |
| 执行工具/MCP              | 不可               | 不可               | Phase 6.9.10 之后的受控 Orchestrator |

## 5. 目标数据流

### 5.1 实时 Tutor 链

```text
authenticated /api/chat request
  -> deterministic Router / governed Router candidate
  -> canonical route + permissions
  -> route=tutor ?
      -> deterministic Tutor policy
      -> explicit/high-confidence instruction: zero-call local strategy
      -> implicit/contextual/ambiguous intent:
           full-field safety projection
           Tutor model candidate (one bounded call)
           strict schema + local Tutor merger
      -> canonical TutorStrategy + short promptAddition
  -> existing RAG / Verifier path when independently eligible
  -> existing final Chat streaming model
  -> safe headers + best-effort Agent Trace
```

Tutor candidate 不得跳过 live Chat 登录校验，也不改变 `requiresRag` 或 `requiresHumanApproval`。若 Router 最终不是 `tutor`，Tutor 必须 provider 前零调用。

### 5.2 WrongQuestionOrganizer 链

```text
authenticated organize-one / organize-batch
  -> canonical userId
  -> owner-scoped REPEATABLE READ + READ ONLY snapshot
  -> existing item / fixed high-confidence structured signal / safety eligibility
  -> deterministic result
  -> eligible low-confidence items only:
       safe ordinal projection
       one bounded Organizer model call per HTTP request
       strict schema + local merger
  -> post-candidate snapshot revalidation
  -> persisted safe Trace required before model result may influence a write
  -> short write transaction + owner advisory lock + in-transaction stale fence
  -> local authorized command writes organization layer
  -> safe response runtime metadata
```

Provider 调用不在数据库事务内。批量请求最多把 12 个 eligible item 放入同一次模型调用；其余 item 使用 deterministic 结果，不允许把 endpoint `limit=50` 变成 50 次 provider 调用。

## 6. 模型、开关、凭据、预算与成本

### 6.1 独立配置

新增根环境变量：

```env
TUTOR_AGENT_MODEL_ENABLED=false
WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED=false
TUTOR_AGENT_MODEL_TIMEOUT_MS=3000
WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS=5000
TUTOR_AGENT_DEEPSEEK_API_KEY=
WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY=
```

完整 Live conjunction：

```text
AI_PROVIDER_MODE=live
AND AI_ENABLE_LIVE_CALLS=true
AND 对应组件 gate=true
AND base URL exactly https://api.deepseek.com/v1
AND the matching component-specific credential is present
AND fixed model/profile/pricing known
AND request eligible/safe/not aborted
AND immutable reservation succeeds
```

任一条件失败都不会创建 Live executor 或调用 provider。默认 gate 永远为 `false`。两个变量是独立的能力凭据入口，不会回退读取通用 `DEEPSEEK_API_KEY`、Chat、Review/Planner 或 Knowledge 凭据。操作者可以在根 `.env` 中有意识地让两变量引用同一个底层 secret，但 Compose 仍按组件名隔离注入、轮换和审计。Docker 只允许：

- `web` 接收 Tutor gate、timeout 和 `TUTOR_AGENT_DEEPSEEK_API_KEY`；
- `server` 仅在 `SERVER_ROLE=api|both` 时接收 WrongQuestionOrganizer gate、timeout 和 `WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY`；
- `SERVER_ROLE=worker` 即使宿主伪造注入 WrongQuestionOrganizer gate/key，也强制关闭该 runtime；
- `worker`、`admin` 不接收这些 gate 或 credential。

Task 10 已把该设计落到 tracked Compose：四个应用 service 都不使用整份根 `.env` 的 service `env_file`，根 env 只做 `${...}` 插值；`admin` 只保留显式 URL。tracked example 固定 mock/live=false、全部 Agent gate=false、两条 component credential 为空。静态 source guard 与 resolved synthetic Compose fixture 同时证明 web/server 正向投影、worker/admin 负向隔离以及 generic/cross-component key 不可替代；`config --quiet` 只完成无输出解析，不构成 Docker 产品验收。

### 6.2 固定 profile

| 字段             | 固定值                                                        |
| ---------------- | ------------------------------------------------------------- |
| provider         | `deepseek`                                                    |
| model            | `deepseek-v4-pro`                                             |
| base URL         | `https://api.deepseek.com/v1`，不得接受路径、协议或 host 变体 |
| transport        | non-thinking JSON object, no tools, `maxRetries=0`            |
| Tutor prompt     | `tutor-model-candidate-v1`                                    |
| Organizer prompt | `wrong-question-organizer-model-candidate-v1`                 |
| 价格快照         | 非缓存 input `3 CNY/1M`，output `6 CNY/1M`                    |
| 价格来源         | 用户提供的 2026-07-18 DeepSeek 官方价格截图                   |

### 6.3 不可变预算

| 作用域                       | calls |  input | output | worst-case CNY | hard cap |
| ---------------------------- | ----: | -----: | -----: | -------------: | -------: |
| Tutor request                |     1 |   1200 |    300 |         0.0054 |   0.0060 |
| Organizer request            |     1 |   3500 |    800 |         0.0153 |   0.0160 |
| paired index                 |     2 |   4700 |   1100 |         0.0207 |   0.0220 |
| 唯一 24-pair controlled-Live |    48 | 112800 |  26400 |         0.4968 |     0.55 |

预算按最大输出预留且不退款；实际 usage 必须为正安全整数、不得超过单槽 reservation 或总 ceiling。未知/被篡改价格、`0/0` usage、缺失 usage、超预算或超 cap 都视为失败，不能显示为零成本成功。

## 7. Tutor candidate contract

### 7.1 Eligibility 与 zero-call

以下情况保持 deterministic provider 前零调用：

- gate/global Live 关闭；
- final route 不是 `tutor`；
- 用户明确要求直接答案、提示、步骤检查、概念解释或完整解法，且只有一个强信号；
- 空输入、超长输入、abort、预算不足；
- credential、private key、Bearer/cookie、instruction override、控制字符或 hostile accessor；
- 无法安全取得 `latestUserText` / `activeStudyContext` 的普通自有数据快照。

模型只处理隐含、上下文指代、多个冲突教学信号或 deterministic `general_follow_up` 且确有学习上下文的请求。

### 7.2 安全投影

`tutor-model-projection-v1` 只读取普通自有数据属性，并在裁剪前扫描完整 latest user text 和 active study context。单字段超过 `16,384` UTF-16 code units、两字段合计超过 `24,576`、安全扫描失败或最终 token reservation 超过 `1200` 时都保持 zero-call。通过扫描后，`latestText` 最多保留 `480` 个 Unicode scalar，`activeStudyContext` excerpt 最多保留 `640` 个 Unicode scalar；截断不得切开 surrogate pair，且必须在 ordinal/metadata 组装后重新证明输入预算。模型只看到：

- `latestText` 的有界安全文本；
- 是否存在 active context，以及有界安全 excerpt；
- deterministic intent/depth；
- 本地检测到的固定 ambiguity signal codes。

模型看不到 userId、conversationId、token、cookie、API key、Router provider 原文、RAG chunk、Trace ID 或写操作能力。

### 7.3 Strict output

```ts
{
  intent:
    | 'explain_solution'
    | 'socratic_hint'
    | 'step_check'
    | 'concept_bridge'
    | 'general_follow_up';
  depth: 'brief' | 'standard' | 'deep';
  confidence: 'medium' | 'high';
  evidenceCodes: Array<
    | 'contextual_reference'
    | 'implicit_hint_request'
    | 'submitted_step'
    | 'concept_gap'
    | 'full_explanation_request'
    | 'ambiguous_intent'
  >;
}
```

`answer_direct` 不在模型可选集合中：明确要求直接答案的请求已由确定性零调用路径处理，模型不能在歧义场景扩大“直接给最终答案”的权限。

### 7.4 Local merger

本地 merger：

- 重新计算 `shouldAskGuidingQuestion`、`shouldGiveFinalAnswer` 和 answer structure；
- 只允许与 intent 相容的 depth/section 组合；
- `socratic_hint` 永远不含 `final_answer`，`answer_direct` 只能来自显式本地信号；
- active context 是否可用由本地事实决定；
- `promptAddition` 只由固定模板生成，不使用模型自由文本；
- schema、usage、timeout、abort、budget 或 runtime 失败回到原 deterministic strategy。

## 8. WrongQuestionOrganizer candidate 与写入隔离

### 8.1 Owner snapshot

`wrong-question-organizer-owner-snapshot-v1` 在同一 bounded PostgreSQL `REPEATABLE READ`、`READ ONLY` 事务中取得：

- canonical owner 下的目标错题；
- 当前组织 item（如有）；
- owner 下相关 subject group、最多 20 个 deck 及 `nameLocked`；
- 每个 deck 的有界关键词摘要；
- 目标 WrongQuestion 所有可能影响投影/merger 的字段和版本。

fingerprint 覆盖 owner 的域分离 HMAC、wrongQuestion ID/version、结构化字段的完整 hash、现有 group/deck identity/name/lock/version、projection/prompt/schema version。raw userId 不进入模型或 Trace。

跨 owner/不存在目标继续返回同一 404；不能通过差异化 reason 泄露资源是否属于其他用户。

### 8.2 Eligibility 与批量上限

以下情况 provider 前零调用：

- `force=false` 且已有 organizer item；
- 非 fallback 的安全知识点/分类与同 subject 已有 deck 经过 NFKC、大小写和空白规范化后精确匹配；
- subject 非空，且现有 `organizeWrongQuestion()` deterministic confidence `>= 0.72`；该阈值要求至少有 knowledgePoint，或同时具备 category + errorType，不能仅靠 fallback/模糊字符串包含达到；
- 无可用语义正文；
- owner mismatch、stale、gate/global Live 关闭、abort、预算不足；
- 任一完整投影字段含 credential/instruction/control/hostile accessor。

单题请求最多 1 次调用。批量请求最多选取 12 个低置信、安全、未组织 item，组成一次 call；未入选和失败 item 继续 deterministic，不重试。这里的“低置信”固定为 subject 缺失，或上述 deterministic confidence `< 0.72`，或只有非精确的 deck 语义候选；它不是可由模型或环境变量调整的阈值。

### 8.3 安全投影与 strict output

模型只看到 `q0..q11`、`d0..d19` ordinal、受限 subject hint、category/error type/knowledge point、经过完整扫描后裁剪的 question/analysis 摘要，以及 existing deck 的安全名称/关键词。模型看不到 UUID、userId、图片 URL、source record、数据库时间、完整答案、rawContent 或写操作。

Task 2 固定的投影上限为：question excerpt `480`、analysis excerpt `320`、结构化 label `80`、最多 3 个 knowledge point；deck name `80`、最多 8 个 keyword 且每个 `60` Unicode scalar。`topicLabel` 为 NFKC canonical 的 `2..24` 个受限字符，并继续接受 post-schema credential/instruction/URL/Markdown/HTML/control/reserved-name guard。`nameLocked` 保留在本地 snapshot/merger，不进入模型投影。

```ts
{
  decisions: Array<{
    questionIndex: number;
    subject: 'keep_local' | 'math' | 'english' | 'politics' | 'computer' | 'major' | 'other';
    deck:
      | { action: 'reuse_existing'; deckIndex: number }
      | { action: 'create_topic'; topicLabel: string };
    confidence: 'medium' | 'high';
    evidenceCodes: Array<
      | 'structured_subject'
      | 'semantic_topic'
      | 'existing_deck_overlap'
      | 'error_pattern'
      | 'insufficient_signal'
    >;
  }>;
}
```

动态 validator 要求每个已投影 eligible question 恰好出现一次，并拒绝缺失、部分、重复/越界 question、跨 subject deck、额外字段、非法 action、空 label 和未投影 ordinal。任一 decision 缺失或非法都会使整批 candidate 失效，整批使用逐题 deterministic 结果；不把“部分成功”混入一次 model-influenced command。`topicLabel` 必须通过长度、Unicode、credential、instruction、URL、Markdown/HTML、控制字符和保留名称 guard。

### 8.4 Local merger 与授权 command

本地 merger：

- 非空且安全的原 WrongQuestion subject 是本地事实，模型只能 `keep_local`；只有 subject 缺失时才可映射固定 taxonomy；
- existing deck ID 仅由内部 ordinal map 还原；`nameLocked=true` 可以被选择，但不能被改名或改 description；
- 新 deck 名由安全 `topicLabel` 生成，description、reason、confidence 和 source 由本地模板重建；
- 模型不得改变 WrongQuestion、Card、ReviewLog、ReviewTask、ReviewPreference 或用户手动移动/重命名事实；
- model-influenced result 只有在正数 usage、价格验证和 Agent Trace 持久化全部成功时才可进入 command，否则使用 deterministic result。

写入通过独立 `wrong-question-organizer-command-v1`：

1. provider 后重新构建并比较完整 owner fingerprint；
2. 开启短事务并取得 canonical owner-scoped PostgreSQL advisory transaction lock；
3. 在事务内重新验证 target/version、existing item、group/deck identity 与 `nameLocked`；
4. 按本地 command upsert subject group/deck/item；
5. 同题 force path 仍先删除其他 deck relation，再 upsert 唯一 item；
6. 并发请求在锁后发现已完成时返回同一权威结果，不创建空重复 deck。

模型调用绝不持有 advisory lock 或数据库事务。

Task 6 实现状态：NestJS organize-one/batch 写路径已使用上述 snapshot、事务外双 fence 与 model-free command；rename/move/remove 也取得同一 owner lock，真实 PostgreSQL 并发回归证明同主题不创建重复空 deck、force relation 唯一、用户 rename/move 最终权威。精确同名 deck 使用全量查询复用；canonical variant 只扫描有界 100 条，窗口溢出时返回 stale 而不冒险创建重复专题。Task 6 当时没有 runtime、Trace admission 或 provider；后续 Task 7 已在该写边界外接入 runtime/Trace/abort，provider 仍不进入事务或锁。

## 9. 通信、Trace 与响应 metadata

### 9.1 版本化通信

两个 Agent 的模型层都返回 package 内的 strict envelope：

```text
agent + schemaVersion + promptVersion + disposition
+ fixed reasonCodes + verified usage + duration + budget snapshot
```

不得在跨层 DTO 中传递 prompt、provider output、raw error、key、base URL、userId、完整题目/答案或数据库对象。

### 9.2 Tutor Trace

Tutor 延续 Chat 的 best-effort Trace 语义：Trace 写失败不能中断流式回答。新增安全 observation 只记录：

- attempted/disposition/reason code；
- candidate duration、正数 usage、known-price cost provenance；
- 最终本地 intent/depth；
- 不记录用户文本、active context、prompt 或模型原文。

响应新增安全 header，例如 `x-prepmind-tutor-model-disposition`；未知字段和自由文本不会进入 header。

### 9.3 Organizer Trace 与 API runtime

Organizer 的模型结果可能影响组织层写入，因此 Trace 是 model-influenced command 的 admission 条件。当前 `apps/server/src/agent-traces/agent-traces.service.ts` 的 `createTrace(userId, input)` 已按 `id_userId` 执行 run upsert，并在同一个数据库事务中删除/重建该 run 的 steps；事务失败会回滚而保留上一次完整版本。Task 7 已采用同一 request-scoped 稳定 `runId` 的两阶段调用：先持久化 parent + deterministic + candidate + `command_pending` admission trace，成功后才允许模型结果进入短写事务；写事务完成后再以同一 `runId` 原子替换为最终 command step。最终 upsert 失败时，首次 admission trace 仍保留且 command 不会被伪报为已记录完成。真实 PostgreSQL contract 已覆盖两次同 runId 调用、step 原子替换、finalize 失败回滚和跨 owner 拒绝，不只 mock `createTrace`。现有顶层 `costEstimate` 保持 USD 语义，不把 CNY 冒充 USD。Task 8 才把以下 strict API runtime metadata 暴露给产品：

- `source=local_deterministic | hybrid_model`
- `disposition` 固定枚举
- `degraded` boolean
- `traceId` 仅在已持久化时返回

`hybrid_model` 只在至少一个 candidate decision 通过本地 merger、正 usage/价格/预算校验、首次 Trace admission，并实际进入授权 command 时返回；仅尝试模型但因 schema/stale/Trace/abort/command preflight 回退时返回 `local_deterministic + degraded=true`。正常 gate-off、已有 item 或高置信 zero-call 返回 `local_deterministic + degraded=false`。不得返回 token、费用、provider error、prompt、question/deck UUID 映射或重试按钮语义。

Task 8 已实现这组产品边界：single 与 batch 都只在 response 顶层返回一次 strict runtime，batch item 不携带模型细节；candidate scope 的来源/降级结论对整次 batch 有权威性，不会被后续 deterministic remainder 覆盖。`/error-book` 只在用户主动批量整理成功后显示语义/本地/安全回退来源，degraded 优先；API strict parse 拒绝未知或敏感字段，页面不显示 traceId 或提供模型重试/自动 mutation。该实现是 default-off 静态/Mock/contract 证据，不是 controlled-Live 或产品浏览器验收。

## 10. 固定评测合同

### 10.1 Dataset

冻结 `phase-6.9-tutor-wrong-question-v1` 共 72 条合成 case：

| lane                   | zero-call | runtime | 合计 |
| ---------------------- | --------: | ------: | ---: |
| Tutor                  |        12 |      24 |   36 |
| WrongQuestionOrganizer |        12 |      24 |   36 |
| 总计                   |        24 |      48 |   72 |

24 个 runtime paired index 每个同时执行 Tutor 与 Organizer，失败仍保留在分母。Organizer 的 paired index `0..19` 各投影 1 个 question，`20..23` 各投影 3 个 question，因此固定为 24 cases / 32 decision units；Task 1 还必须发布 canonical dataset JSON 的 SHA-256，后续报告同时校验 case count、decision count 和 hash。24 条 zero-call 必须实际穿过 candidate/preflight guard，并由独立 runtime counter 证明 0 调用，不能回显 expected reason 自证。

Task 9 已按该合同实现：Mock 为 `24/24` verified zero-call、`48/48` strict runtime，Tutor/Organizer semantic 均为 `1`；`executorProvenance=mock_synthetic` 使 production gate 按设计保持 `quality_gate_failed`。公共 Live CLI 不接受注入 executor；无网络测试使用 `synthetic_test` provenance，production gate 只接受 `deepseek_network`。完整工程证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-paired-eval.md`。

Tutor runtime 覆盖中英文上下文指代、隐含提示、步骤提交、概念卡点、完整讲解、冲突信号和 active context。Organizer runtime 覆盖缺 subject 语义分类、专业课主题、同义专题复用、相近但不同专题、新专题 label、错误类型与多条批量一致性。

critical cases 至少包括：

- Tutor hint 不得变成 direct final answer；
- prompt injection/credential 不得进入 provider；
- Organizer 不得返回未投影/跨 owner deck；
- user-locked name 不得被覆盖；
- provider output 不得直接产生数据库写命令。

### 10.2 指标与门槛

每个 Tutor runtime case 固定标注 `expectedIntent`、`expectedDepth`、`expectedContextUse`、`expectedGuidingQuestion`、`expectedFinalAnswer` 和有序 `expectedAnswerStructure`。每个 Organizer runtime case 对每个 projected question 固定标注 `expectedSubject`、`expectedDeckAction`、可选 `expectedDeckIndex`、`canonicalTopicLabel + acceptedTopicLabels`、`expectedConfidence`、`requiredEvidenceCodes` 与 `allowedEvidenceCodes`。缺失、非法、fallback 或额外输出仍保留在原分母，不以“无法评分”删除。

Tutor semantic score：

```text
0.55 * intent macro-F1
+ 0.20 * depth accuracy
+ 0.15 * context-use accuracy
+ 0.10 * pedagogy policy accuracy
```

其中：

- intent macro-F1 在 24 个 Tutor runtime case 的五个模型可选 intent 上按类计算后等权平均；非法/缺失输出记作 `__invalid__`，只会造成原标签 false negative，不能被跳过；
- depth accuracy 是 canonical local merger 最终 depth 的逐 case exact-match 均值；
- context-use accuracy 是最终 `shouldUseActiveStudyContext` 与 `expectedContextUse` 的逐 case exact-match 均值，不能用“case 有 context”代替“策略应使用 context”；
- pedagogy policy accuracy 只有在 guiding-question、final-answer 两个 boolean 和有序 `answerStructure` 全部与标注一致时该 case 才得 1，否则得 0。

Organizer semantic score：

```text
0.30 * subject accuracy
+ 0.25 * deck action accuracy
+ 0.20 * existing-deck precision
+ 0.15 * topic-label F1
+ 0.10 * evidence/confidence accuracy
```

其中每个 projected question decision 是一个评分单位，batch case 的全部 decision 都进入分母：

- subject accuracy 是本地 merger 后 canonical subject enum 的 exact-match 均值；
- deck action accuracy 要求 action exact match；`reuse_existing` 还必须命中同一 projected deck ordinal；
- existing-deck precision 为全部预测 `reuse_existing` 中正确 action + ordinal 的 `TP / (TP + FP)`；冻结数据集保证至少一个 expected reuse，若模型一次也不预测 reuse，该项为 `0`；
- topic-label F1 只在 expected `create_topic` decision 上计算。先对输出做 NFKC、trim、连续空白折叠和 ASCII lowercase；若命中该 decision 的 `acceptedTopicLabels`，映射回 `canonicalTopicLabel`，否则映射为独立 `__unexpected__` 类，再对冻结 canonical labels 计算 macro-F1；
- evidence/confidence accuracy 只有 confidence exact match、全部 required evidence 存在、且没有超出 allowed evidence 时该 decision 才得 1。

报告可以额外给出 `combinedSemanticScore = 0.5 * tutorSemanticScore + 0.5 * organizerSemanticScore`，只用于比较整体趋势；production gate 仍分别检查两个 lane，不能用高分 lane 抵消低分 lane。Task 1 已冻结未修饰 baseline：Tutor `0.44186666666666674`、Organizer `0.278125`、combined `0.3599958333333334`、完整命中 `6/48`、critical `0`；权威明细与 dataset SHA-256 见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-baseline.md`。

`canonical strict runtime success` 的定义是：该 runtime case 的独立 counter 恰好观测一次 executor 调用；strict schema 与动态关联校验通过；usage 为正安全整数且价格/预算/cap 重算一致；disposition 为 `candidate_applied`；没有 timeout、abort、degraded 或 deterministic fallback。它是 eval envelope 的成功定义，不替代 Organizer 产品阶段的 Trace/write admission。

延迟统一使用单调时钟，并冻结以下计时窗口：

- Tutor/Organizer candidate duration：从调用 `ModelAgentRuntime.run()` 前一刻，到 strict parse、动态校验、usage/价格校验完成；包含 provider 网络时间，不含 dataset load、owner snapshot、projection、Trace 和数据库 command；
- paired candidate duration：从同一 paired index 的两个 `run()` 并发 dispatch 前一刻，到两个 canonical envelope 完成；不含 fixture/evidence I/O，不是完整 HTTP endpoint 时延；
- Tutor orchestration duration：从本地 `buildTutorStrategy()` 开始，到 Tutor candidate strict 结果和本地 merger 就绪；包含 Tutor 本地策略准备与 candidate，不含真实 Router model、`/api/chat` HTTP、登录/body parse、RAG、Verifier、最终 Chat 模型和流式传输。

Task 9 终审修正了原设计中的命名冲突：旧称“Chat Router+Tutor product duration”无法由固定 48-call paired runner真实测量，也与后续 Task 12 的产品验收职责重叠。字段已改为 `tutorOrchestration*`，只作为离线 candidate 编排余量门；真实 Router/Tutor 产品链路、API 和流式体验仍必须在 Task 12 的 Docker/API 与可见浏览器中独立验收，不能由该指标代替。

Tutor/Organizer runtime timeout 分别固定 `3000/5000ms`，因此 `2500/4500ms` candidate P95 都保留至少 `500ms` abort/解析余量；timeout/fallback 样本仍计入 strict-success 分母，不能从延迟或质量报告删除。

Production quality gate 同时要求：

- `24/24` verified zero-call；
- `48/48` canonical strict runtime success；
- critical failure `0`；
- Tutor semantic score `>= 0.85`；
- Organizer semantic score `>= 0.85`；
- 两个 lane 均比冻结 deterministic baseline 绝对提升 `>= 0.15`；
- Tutor candidate P95 `<= 2500ms`；
- Organizer candidate P95 `<= 4500ms`；
- 双候选 paired candidate P95 `<= 4500ms`；
- Tutor orchestration P95 `<= 6500ms`；该指标不是产品端到端 P95；
- usage、价格、逐 case/aggregate CNY 和 request/total cap 全部可验证。

Mock 满分只证明 contract，不通过 Live-only production quality gate。

## 11. 失败与降级矩阵

| 失败                          | Tutor                                     | Organizer                                  |
| ----------------------------- | ----------------------------------------- | ------------------------------------------ |
| gate/config/credential        | deterministic strategy                    | deterministic organization                 |
| unsafe projection             | generic/原 deterministic strategy，0-call | deterministic/未分类，0-call               |
| owner mismatch                | 不适用                                    | 同一 404，0-call                           |
| abort                         | 不启动或丢弃 candidate                    | 不写 model-influenced command              |
| budget/cost                   | deterministic                             | deterministic                              |
| timeout/provider/schema/usage | deterministic                             | deterministic                              |
| post-candidate stale          | 丢弃 candidate                            | 丢弃 candidate，重新走本地 command         |
| Trace failure                 | 回答继续，标记未记录                      | candidate 不得影响写入，改用 deterministic |
| write transaction conflict    | 不适用                                    | bounded retry/权威重读；不重调 provider    |

任何失败都不得扩大权限、伪造调用成功、重试 provider 或阻断错题事实保存。

## 12. 验收、清理与不可变证据

顺序固定：

1. deterministic baseline；
2. candidate/schema/projection/fallback Mock；
3. 产品 composition Mock；
4. 分支全量静态/Mock checkpoint；
5. 用户重新明确授权唯一一次 controlled-Live；
6. Live quality gate 通过后，分别执行 Tutor Chat 和 Organizer single/batch Docker/API；
7. 可见浏览器验收 `/chat` 与 `/error-book`，窗口保持可见；
8. 精确清理本阶段合成账号、错题、group/deck/item、Trace、session 和浏览器 storage；
9. 恢复 mock、两个组件 gate=false、两条 component-specific credential 均不注入容器；
10. 提交分支，`--no-ff` 合并 main；
11. main 只做 committed authority 校验、静态门和 default-off Docker/API/浏览器回放，不重跑已消费 Live；
12. 推送 `main` 并核对本地/远程 SHA。

Live evidence 使用独立一次性 marker 和 immutable publish，不能删除、覆盖、重跑或与其他 Phase evidence 拼接。证据只保存聚合结构化字段、hash、usage、latency、cost 和固定 failure code，不保存 prompt、题目正文、模型原文、credential、URL、cookie、stack 或 raw error。

禁止 Docker prune、`down -v`、volume/database reset、Redis flush 和 MinIO wipe。只删除本轮有记录的合成资源，保留现有容器、镜像和数据卷。

2026-07-24 当前边界：上述顺序的 V1 run `39a62241...` 与后续 V2 R7 run `67ce18dd...`
均已以 `quality_gate_failed` 封存，并按固定停止条件没有进入产品验收。V1/V2 都不得重跑；V2
为 `24/24` zero-call、`0/48` strict runtime、semantic `0/0`、verified usage `0`，失败发生在
结构化对象形成前且未保存原始异常，不能指定单一根因。后续只能先做零 Provider V3 失败复盘
设计；当前没有新的网络授权。V2 authority 见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v2-remediation-design.md` 与
`docs/acceptance/2026-07-24-phase-6-9-7-tutor-organizer-v2-controlled-live-failure.md`。

## 13. 非目标与后续阶段

本阶段不做：

- 不把 Tutor 变成 FinalResponseAgent；
- 不让 WrongQuestionOrganizer 修改错题事实、FSRS 或复习任务；
- 不新增自动删除/移动/批量改名能力；
- 不实现完整可执行 LangGraph；只准备纯 candidate node 与授权 command node 的稳定接口；
- 不实现 MemoryAgent、记忆注入或 Episodic Memory；
- 不开始《多 Agent 架构》或《记忆系统》博客收尾。

只有 Phase 6.9.7 未来新的质量 authority、产品验收、main 回放与远程推送完成后，下一阶段才是 Phase 6.9.8 Retriever/FinalResponse 正式化；当前 V2 失败不能绕过该门。Phase 6.9.10 才把纯决策节点和授权 command 节点接入最小 graph family。

## 14. 文档同步与回顾问题

每个原子任务同步其实际影响到 `AGENTS.md`、`README.md`、`DEVLOG.md`、`docs/roadmap.md`、`docs/data-flow.md`、AI 行为/验收文档、开发启动文档和专项 acceptance。历史失败证据只加当前边界说明，不改写原始结论。

回顾时可以问：

- 为什么 TutorAgent 不是最终回答模型？
- 为什么明确教学指令保持 zero-call，而隐含意图才调用模型？
- 为什么 `answer_direct` 不允许由 Tutor 模型在歧义场景选出？
- 为什么 WrongQuestionOrganizer 的模型结果不能直接写 deck？
- 为什么 batch 最多一次 provider call，却仍可以整理多道错题？
- 为什么 Organizer Trace 失败必须丢弃模型建议，而 Tutor Trace 仍是 best-effort？
- owner snapshot、post-candidate fence 和写事务内 fence 分别防什么？
- default-off 为什么不等于 Agent 不可用？
