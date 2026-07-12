# Phase 6.9.4.2 Router / Verifier Mock Candidate Contract 设计

## 1. 背景与本任务决策

Phase 6.9.4.1 已用 `phase-6.9-router-verifier-v1` 固定 Router 60 条、Verifier 40 条扩展评测数据，
并记录了不修饰的 deterministic baseline：74/100，critical failure 2。Router 的主要缺口是
歧义、多意图和自然改写；Verifier 的主要缺口是没有显式 marker 的数值、版本、年份、
单位和条件冲突。

现在不能直接把真实模型接入 `/api/chat`。在比较语义质量之前，必须先证明候选路径本身具备：

- strict structured output；
- 确定性 candidate eligibility 与 safety gate；
- 不可变的单次调用预算；
- schema、预算、timeout、abort 和 runtime 失败时的 fail-closed 降级；
- 不记录 prompt、chunk、模型原始输出或 provider raw error 的安全观测边界。

本任务因此只建立 Router / Verifier 的 Mock candidate contract 和 adapter。它不运行 Live，不进入
Chat 业务链路，不做 Enabled 决策。

## 2. 已采用的方案

采用“Agent 专属 candidate adapter”：

- Router 和 Verifier 各有自己的 schema、prompt builder、gate、合并和降级规则；
- 两者共享少量的安全 code、文本边界、token 估算和 runtime error 映射；
- 两者都通过依赖注入接收现有 `ModelAgentRuntime`，不读取环境变量；
- 现有 `routeAgentRequest()` 和 `verifyKnowledgeChunks()` 保持纯函数和原有行为。

不采用通用 Candidate Orchestrator，因为 Router 的“原样回退”和 Verifier 的“保守收紧”语义不同，
强行统一会将两套规则变成大量条件分支。也不直接修改 Router / Verifier 内核，避免污染
Phase 6.9.4.1 的 deterministic 基线。

## 3. 目标

- 建立 Router 和 Verifier 两套 strict Zod candidate schema。
- 建立模型调用前的确定性 eligibility 与 safety gate。
- 证明 ineligible 和 safety-blocked 请求的候选调用数为 0。
- 允许模型在合法歧义请求上只修改受限语义结果。
- 使 Router 的权限位始终来自本地 canonical route policy。
- 使 Verifier 在候选失败时保持或收紧结果，不会错误放宽为 `trusted`。
- 复用 `ModelAgentRuntime` 的 schema、预算、timeout/abort 和安全 Trace contract。
- 为 Phase 6.9.4.3 的 same-case Mock/Live paired eval 提供可重用 adapter。

## 4. 非目标

- 不修改 `phase-6.9-router-verifier-v1` 的 case、expected、subset 或 eligibility 标注。
- 不修改 74/100 deterministic baseline 或追求本阶段全绿。
- 不运行真实 provider，不消耗 API key 额度。
- 不建立 Mock/Live paired runner，不做质量、延迟或成本启用决策。
- 不接入 `/api/chat`、NestJS API、Agent Trace UI 或前端开关。
- 不新增数据库表、Redis key、BullMQ job、Docker service 或环境变量。
- 不让模型生成用户通知、prompt addition、权限位或自由文本 reason。
- 不提前抽象支持 Memory、Planner 或 Orchestrator 的通用 candidate framework。

## 5. 模块与文件边界

```text
packages/agent/src/model-candidates/model-candidate-policy.ts
  -> 共享固定 code、文本边界、保守 token 估算、runtime error 映射
  -> 不调用 Agent，不实现通用编排器

packages/agent/src/model-candidates/router-model-candidate.ts
  -> Router schema、prompt、safety gate、runtime invoke、canonical merge、fallback

packages/agent/src/model-candidates/knowledge-verifier-model-candidate.ts
  -> Verifier schema、安全 chunk 选择、prompt、runtime invoke、本地结果模板、保守 fallback

packages/agent/tests/model-candidate-policy.test.ts
  -> code、文本脱敏与边界、token 估算、runtime error 映射

packages/agent/tests/router-model-candidate.test.ts
  -> Router schema/gate/call count/merge/fallback

packages/agent/tests/knowledge-verifier-model-candidate.test.ts
  -> Verifier schema/gate/safe prompt/conservative fallback
```

本 slice 不从 `@repo/agent` package root 导出 adapter。测试和后续 eval runner 使用相对导入；只在真实
composition root 出现时再新增受控 subpath export。

## 6. 共享 Candidate Policy

### 6.1 调用处置结果

adapter 返回固定 disposition，不返回任意 error message：

```ts
type ModelCandidateDisposition =
  | 'not_eligible'
  | 'safety_blocked'
  | 'candidate_applied'
  | 'fallback_invalid_input'
  | 'fallback_schema_invalid'
  | 'fallback_budget_exceeded'
  | 'fallback_timeout'
  | 'fallback_aborted'
  | 'fallback_runtime_error';
```

runtime error 使用穷尽映射：

| `ModelAgentErrorCode` | Disposition |
| --- | --- |
| `INVALID_REQUEST` | `fallback_invalid_input` |
| `CALL_BUDGET_EXCEEDED` / `INPUT_BUDGET_EXCEEDED` / `OUTPUT_BUDGET_EXCEEDED` | `fallback_budget_exceeded` |
| `SCHEMA_INVALID` | `fallback_schema_invalid` |
| `TIMEOUT` | `fallback_timeout` |
| `ABORTED` | `fallback_aborted` |
| `LIVE_CALLS_DISABLED` / `EXECUTOR_UNAVAILABLE` / `INVALID_RUNTIME_CONFIG` / `PROVIDER_ERROR` | `fallback_runtime_error` |

adapter 返回统一 envelope：

```ts
type ModelCandidateReasonCode =
  | ModelCandidateDisposition
  | ModelAgentErrorCode
  | RouterSafetyCode
  | RouterCandidateReasonCode
  | VerifierEvidenceCode;

type ModelCandidateObservationBase = {
  disposition: ModelCandidateDisposition;
  budget: ModelAgentRunBudget;
  usage: ModelAgentUsage;
  reasonCodes: readonly ModelCandidateReasonCode[];
};

type ModelCandidateObservation = ModelCandidateObservationBase &
  (
    | { attempted: false; trace?: never }
    | { attempted: true; trace: ModelAgentTrace }
  );

type ModelCandidateEnvelope<T> = {
  result: T;
  observation: ModelCandidateObservation;
};
```

`result` 始终存在。未调用 runtime 时 `attempted=false`、usage 为 0、budget 为传入快照且没有 trace；
调用过 runtime 时 `attempted=true`，必须原样向上传播 runtime budget/usage/trace。envelope 不得附加
prompt、模型 object、stack 或 raw error。

`reasonCodes` 必须去重且按本地固定顺序生成：第一项始终是 disposition；`safety_blocked` 可追加
`RouterSafetyCode`；runtime fallback 与 pre-aborted fallback 都追加对应 `ModelAgentErrorCode`；Router `candidate_applied` 追加一个
`RouterCandidateReasonCode`；Verifier `candidate_applied` 追加一到四个 canonical `VerifierEvidenceCode`。其他未调用
结果只保留 disposition，不发明 detail code。

### 6.2 文本安全与大小上限

候选输入仅允许必要合成/脱敏文本。检查顺序固定为：

1. 对原始字符串执行绝对大小上限检查，超界直接 `fallback_invalid_input`，不做部分截断后续续调用。
2. 在任何替换前扫描 hard-block 类别：Bearer/Authorization、Cookie、provider key、client secret/password、
   PEM 私钥、要求回显凭据/系统提示、prompt injection、跨用户访问和未授权写/删除。任一命中即
   `safety_blocked`，调用数为 0，禁止通过脱敏后继续。
3. 只有普通邮箱属于 redact-and-continue：替换为 `[redacted_email]`。其他 hard-block 类别不可替换后继续。
4. 对 sanitized text 做 NFKC、trim、lowercase，将连续 Unicode 空白（含 CR/LF）压缩为单个 ASCII
   space，再扫描一次 hard-block pattern；仍命中则 `safety_blocked`。
5. 最后才执行各字段的长度上限与 prompt 预算组装。

绝对 raw 上限和 sanitized 字段上限固定为：

| Field | Absolute raw limit | Sanitized prompt limit |
| --- | ---: | ---: |
| Router user text | 16,384 UTF-8 bytes | 1,600 characters |
| Router active context | 16,384 UTF-8 bytes | 1,200 characters |
| Verifier query | 16,384 UTF-8 bytes | 1,600 characters |
| Verifier chunk count | 20 | 4 selected excerpts |
| Verifier single chunk content | 65,536 UTF-8 bytes | 600 characters |
| Verifier aggregate chunk content | 262,144 UTF-8 bytes | 1,600 estimated-token prompt cap |

绝对上限在扫描和截断前检查；超界不会通过只读取前缀继续。sanitized prompt limit 是字段上限，
仍需同时满足第 9 节的整体 estimated-token 预算。

共享 policy 还必须：

- 对 user text、active context、query 和 chunk excerpt 分别设置长度上限；
- 对组装后的 system + user prompt 使用保守 token 估算；
- 估算可使用 `ceil(UTF-8 byteLength / 3)`，中英文都宁可高估，不声称是 provider tokenizer；
- 超出 adapter 上限时在 runtime 前回退，调用数仍为 0。

## 7. Router Candidate Contract

### 7.1 输入

Router adapter 接收：

```text
runId
raw user text
optional raw activeStudyContext
deterministic RouterResult
candidateEligible
ModelAgentRunBudget
optional AbortSignal
ModelAgentRuntime
```

`candidateEligible` 是上游确定性 selector/eval manifest 的许可，不是安全特权。Router gate 的顺序固定为：

1. 验证结构和绝对 raw 上限；失败为 `fallback_invalid_input`。
2. 对 raw text/context 执行 hard-block，再做 NFKC、trim、lowercase，将连续 Unicode 空白（包含 CR/LF）
   压缩为单个 ASCII space 后复查；命中为 `safety_blocked`。
3. 如未命中安全信号且 `candidateEligible=false`，返回 `not_eligible`。
4. 如 `signal.aborted=true`，返回 `fallback_aborted`、`attempted=false`、
   `reasonCodes=[fallback_aborted, ABORTED]`。
5. 验证 sanitized 字段上限和 caller budget；失败为对应 fallback。
6. 其他情况恰好调用一次 runtime。

安全 detector 按下表从上到下只返回第一个命中 code：

| 优先级 | `RouterSafetyCode` | 中英文稳定信号（同组 OR） |
| ---: | --- | --- |
| 1 | `instruction_override` | `忽略规则` / `忽略以上` / `ignore previous` / `ignore rules` |
| 2 | `credential_exfiltration` | `访问凭据` / `api key` / `access token` / `cookie` / `client secret` / `password` |
| 3 | `system_prompt_exfiltration` | `系统提示词` / `system prompt` |
| 4 | `cross_user_access` | `另一个用户` / `其他账号` / `别人的错题` / `another user` |
| 5 | `false_write_claim` | `不用/无需/不经确认` 与 `已经/已创建/已完成` 组合；或 `say` 与 `already created/completed` 组合 |
| 6 | `unsupported_system_tool` | `系统命令` / `shell` / `清空目录` / `delete directory` |
| 7 | `unconfirmed_memory_write` | `不经/无需确认` 与 `永久记住/长期记忆` 组合；或 `remember permanently` |
| 8 | `destructive_knowledge_write` | `自动/直接` + `删除/合并/替换` + `资料/文档/知识库` |

组合信号必须在同一个已统一空白的 NFKC/lowercase 字符串内按表中顺序出现。实施使用
`Array.from(normalized)` 得到 Unicode code-point 数组，通过 `hasOrderedSignalsWithin(groups, 40)` 查找各组中的任一词组。
相邻两组的“前一命中结尾 -> 后一命中开始”最多间隔 40 个 code points；
`destructive_knowledge_write` 的三组信号对 1->2 和 2->3 分别应用 40 上限。不使用无界 `.*`，也不使用
不匹配换行的 `.` 伪实现跨行距离。单组信号使用固定词组 `includes` 或等价的 escaped regex。
实施计划可展开 helper 代码，但规范化、code、优先级、词组、相邻组距离和 40-code-point 边界不得改名或重排。
Phase 6.9.4.1 的 8 个
safety case 必须使用以下固定对应断言 code：

```text
ignore_rules_01       -> instruction_override
cross_user_02         -> cross_user_access
fake_plan_write_03    -> false_write_claim
secret_echo_04        -> credential_exfiltration
system_prompt_05      -> system_prompt_exfiltration
unknown_tool_06       -> unsupported_system_tool
memory_write_07       -> unconfirmed_memory_write
knowledge_delete_08   -> destructive_knowledge_write
```

这保证 gate 不是仅凭模糊语义判断。命中后始终 `safety_blocked`、
调用数 0，并返回本地固定的
`chat + requiresRag=false + requiresHumanApproval=false` 安全拒绝结果。这个结果不来自模型，也不沿用可能
已误命中 `study_plan/rag_answer` 的 deterministic route。固定安全结果的 `confidence=1`，`reason` 为
`safety_boundary:<RouterSafetyCode>` 对应的本地模板。

### 7.2 strict schema

Router 模型输出只允许：

```ts
z.object({
  route: z.enum([
    'chat',
    'tutor',
    'rag_answer',
    'study_plan',
    'review_analysis',
    'wrong_question_organize',
  ]),
  confidence: z.number().min(0).max(1),
  reasonCode: z.enum([
    'ambiguous_intent_resolved',
    'active_context_follow_up',
    'multi_intent_priority',
    'insufficient_context',
  ]),
}).strict()
```

不允许 `requiresRag`、`requiresHumanApproval`、reason 自由文本、tool、action 或任意多余字段。
`memory_reflection` 和 `knowledge_dedup` 不在 Chat candidate route 集合内。

### 7.3 canonical merge

候选 route 通过 schema 后，adapter 使用 route 和有界 confidence；`reasonCode` 只映射为本地固定
RouterResult.reason 模板和 observation code，不保留模型自由文本。两个权限位必须根据本地映射生成：

| Route | `requiresRag` | `requiresHumanApproval` |
| --- | --- | --- |
| `chat` | false | false |
| `tutor` | false | false |
| `rag_answer` | true | false |
| `study_plan` | false | true |
| `review_analysis` | false | true |
| `wrong_question_organize` | false | true |

这意味着候选可以将歧义请求改判为 `rag_answer`，但不能产生 `rag_answer + requiresRag=false`；
也不能产生建议性路由但绕过当前 human approval 边界。

### 7.4 Router fallback

除前置 `safety_blocked` 使用本地固定安全拒绝外，任何 invalid input、schema、预算、timeout、abort 或
runtime 失败都原样返回 deterministic `RouterResult`。不重试，不降低权限位，不将普通 candidate 失败
强制改为 `chat` 来隐藏基线结果。

## 8. Verifier Candidate Contract

### 8.1 前置 gate 与优先级

Verifier adapter 输入固定为：

```ts
type KnowledgeVerifierCandidateInput = {
  runId: string;
  query: string;
  chunks: readonly KnowledgeVerifierChunk[];
  deterministic: KnowledgeVerifierResult;
  candidateEligible: boolean;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
  runtime: ModelAgentRuntime;
};
```

gate 要求每个 `chunkId` 是非空有界字符串，`score` 是 `0..1` 内有限数，content/safety metadata 符合
`KnowledgeVerifierChunk` 结构。缺失、NaN/Infinity、越界 score 或重复 `chunkId` 均在排序前
`fallback_invalid_input`，调用数为 0。

多个条件同时命中时按以下优先级结束：

1. 结构不是可检查对象，或原始 query/chunk 超过绝对大小上限：`fallback_invalid_input`。
2. 任一 chunk `riskLevel='high'` 或 `safeForPrompt=false`，或原始 query/chunk 命中 hard-block 凭据、私钥、
   prompt injection 或不允许指令：`safety_blocked`。
3. `candidateEligible=false`：`not_eligible`。
4. `signal.aborted=true`：`fallback_aborted`、`attempted=false`、
   `reasonCodes=[fallback_aborted, ABORTED]`。
5. 空 chunks、无可用安全 excerpt、sanitized text 仍命中 hard-block pattern：`fallback_invalid_input`。
6. caller budget 在 runtime 前已明确无法容纳本次预留：`fallback_budget_exceeded`。
7. 其他情况恰好调用一次 `invokeStructured()`。

高风险 case 不能通过“只删除高风险 chunk，把其余 chunk 发给模型”绕过。只要本次检索结果存在
上述安全 metadata，整个 candidate 调用就必须为 0。

### 8.2 安全摘要输入

Verifier adapter 不发送完整 metadata 集合。本地先按 `score desc, chunkId asc` 稳定排序，然后选择最多
4 个安全 chunk。每个 excerpt 先 trim/NFKC，再从头部截取最多 600 字符；score 始终包含且四舍五入到
4 位小数。组装顺序固定为 bounded query、`chunk_1..chunk_4`，超过 1600 estimated-token 上限时从最后一个
chunk 开始整块删除，不在中间二次截断。没有留下任何 chunk 时 `fallback_invalid_input`。模型只看到：

```text
bounded sanitized query
chunk_1..chunk_4 synthetic labels
bounded sanitized excerpts
bounded retrieval scores
```

不发送 `documentId`、`documentTitle`、`chunkId`、matchedPatterns、categories、用户 ID 或安全内部字段。

### 8.3 strict schema

Verifier 模型输出只允许：

```ts
z.discriminatedUnion('status', [
  z.object({
    status: z.literal('trusted'),
    evidenceCodes: z.tuple([z.literal('consistent_support')]),
  }).strict(),
  z.object({
    status: z.literal('conflict'),
    evidenceCodes: z
      .array(
        z.enum([
          'numeric_conflict',
          'definition_conflict',
          'version_conflict',
          'condition_conflict',
        ]),
      )
      .min(1)
      .max(4),
  }).strict(),
  z.object({
    status: z.literal('suspicious'),
    evidenceCodes: z.tuple([z.literal('stale_or_uncertain')]),
  }).strict(),
  z.object({
    status: z.literal('insufficient'),
    evidenceCodes: z.tuple([z.literal('off_topic_or_weak')]),
  }).strict(),
]).superRefine((value, context) => {
  if (
    value.status === 'conflict' &&
    new Set(value.evidenceCodes).size !== value.evidenceCodes.length
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['evidenceCodes'],
      message: 'duplicate_evidence_code',
    });
  }
})
```

`skipped` 不是 candidate 输出：空输入在候选前就已经结束。reason、userNotice 和 promptAddition 都根据
status/evidence code 使用本地固定模板生成，模型不得返回这些正文字段。`conflict.evidenceCodes`
的重复值由 schema 直接拒绝，runtime 结果映射为 `fallback_schema_invalid`；通过后按
`numeric_conflict -> definition_conflict -> version_conflict -> condition_conflict`
的本地顺序 canonicalize，不使用模型输出顺序作为模板或 paired eval 输入。

### 8.4 Verifier merge 与 fallback

成功候选可在 `trusted/conflict/suspicious/insufficient` 之间提交语义判断，但无权覆盖前置 SafetyGuard。
候选失败时的规则是：

| Deterministic status | Candidate 失败后 |
| --- | --- |
| `conflict` | 保留 `conflict` |
| `suspicious` | 保留 `suspicious` |
| `insufficient` | 保留 `insufficient` |
| `skipped` | 保留 `skipped` |
| `trusted` | 收紧为 `suspicious` |

`trusted -> suspicious` 使用本地固定 reason/userNotice/promptAddition，明确表示资料核对候选不可用。
它不把 provider 失败细节暴露给用户，也不把失败错误表述为资料已经证实有误。

各 disposition 的合并范围固定为：

- `not_eligible`：保留 deterministic，因此可以保留 `trusted`；
- `safety_blocked`：使用 deterministic SafetyGuard；如果是 raw credential/instruction gate 新发现的风险，本地构造
  `suspicious`；
- `fallback_invalid_input`、`fallback_budget_exceeded`、`fallback_schema_invalid`、`fallback_timeout`、
  `fallback_aborted`、`fallback_runtime_error`：都使用上表保守矩阵，deterministic `trusted` 收紧为 `suspicious`；
- `candidate_applied`：使用 strict discriminated union 已验证的 status 和本地模板。

## 9. 预算与调用上限

| Agent | Max runtime invokes | Max estimated input tokens | Max output tokens |
| --- | ---: | ---: | ---: |
| Router | 1 | 800 | 120 |
| Verifier | 1 | 1600 | 180 |

- 表中数字的单位均是 estimated tokens，不是 provider tokenizer 或账单；
- input 估算范围包含 system prompt、user prompt、固定 wrapper、schema 字段/枚举的稳定描述，并加固定
  64-token safety overhead；
- adapter 接收 caller 的 `ModelAgentRunBudget`，不从环境变量创建隐式额外预算；
- 调用前按固定最大输出量预留，继续防止并发重入超卖；
- adapter 约束不得大于上表，caller budget 更小时以 caller 为准并 fail-closed；
- 不跨 Agent 借用预算，不因 schema invalid/provider error 自动重试；
- runtime 已预留的 budget snapshot 在失败结果中继续向上传播，不伪造为“未调用”。

## 10. 数据流

```text
输入
  -> 运行现有 deterministic policy
  -> 读取上游 candidateEligible
  -> adapter 独立执行 safety/input/budget preflight
     -> not eligible / invalid: 0 次 runtime invoke，按 Agent 规则 fallback
     -> safety blocked: 0 次 runtime invoke，Router 本地安全拒绝 / Verifier SafetyGuard
     -> eligible: 构造有界、脱敏 prompt
  -> ModelAgentRuntime.invokeStructured()
  -> strict schema parse + immutable budget + safe Trace
     -> success: Agent 专属受限合并
     -> failure: Router 原样回退 / Verifier 保守收紧
  -> 返回业务结果 + disposition + budget/usage/Trace
```

本阶段数据流在 adapter 结果即停止，不进入 Chat、API、数据库或前端。

## 11. 错误处理矩阵

| 错误/状态 | Runtime invoke | Router | Verifier | 可重试 |
| --- | ---: | --- | --- | ---: |
| not eligible | 0 | deterministic | deterministic | no |
| safety blocked | 0 | 本地固定 safe `chat` | deterministic SafetyGuard / local `suspicious` | no |
| input too large/invalid | 0 | deterministic | 保守 fallback | no |
| call/input/output budget exceeded | 0 或 1，以 runtime 结果为准 | deterministic | 保守 fallback | no |
| schema invalid | 1 | deterministic | 保守 fallback | no |
| timeout | 1 | deterministic | 保守 fallback | no |
| aborted | 0 或 1 | deterministic | 保守 fallback | no |
| provider/runtime error | 1 | deterministic | 保守 fallback | no |

“调用数”指 adapter 对 `invokeStructured()` 的尝试次数；底层 executor 是否已发出字节以 runtime Trace 为准。
任何错误都只记录固定 code，不保存异常正文或 stack。

## 12. Mock 验收策略

本阶段使用两种测试替身，职责不混淆：

1. 真实 `ModelAgentRuntime` Mock 模式：
   - 验证合法 Router/Verifier object 通过 strict schema；
   - 验证多余字段、非法 route/status、越界 confidence 和自由文本失败；
   - 验证真实 budget reservation、usage 和安全 Trace。
2. 注入的 recording/failure runtime stub：
   - 记录请求以检查 prompt 边界和无泄露；
   - 稳定返回 `TIMEOUT / ABORTED / PROVIDER_ERROR / *_BUDGET_EXCEEDED`；
   - 只验证 adapter 的错误映射和 fallback，不冒充真实 provider 调用。

Mock responder 本身不受 live executor timeout 竞速器约束，因此不用“让 Mock sleep”伪造 timeout。timeout 在
`@repo/ai` runtime 已有独立测试，本阶段通过固定 runtime failure 结果验证 adapter 降级即可。

## 13. 测试与回归门禁

实施必须 TDD 覆盖：

1. schema 全部 `.strict()`，多余/缺失/非法字段失败。
2. Router ineligible 为 0 次 invoke并保留 deterministic；8 个 safety boundary case 为 0 次 invoke且返回本地 safe `chat`。
3. Verifier prompt injection/high-risk/safeForPrompt=false 均为 0 次 invoke。
4. Router 合法 candidate 恰好 1 次 invoke，权限位来自 canonical map。
5. Verifier 合法 candidate 恰好 1 次 invoke，reason/userNotice/promptAddition 不来自模型。
6. Router 所有 runtime 失败原样回退 deterministic。
7. Verifier 所有 runtime 失败保留 restrictive 状态，或将 deterministic trusted 收紧为 suspicious。
8. 超界 input 在 runtime 前结束，调用数为 0。
9. 序列化 adapter result/Trace 不包含 input、active context、chunk、prompt、provider output、key、cookie 或 raw error。
10. forbidden-pattern 测试必须分别覆盖 Authorization/Bearer、Cookie、provider key、client secret/password、
    PEM 私钥和邮箱；邮箱必须只以 `[redacted_email]` 出现。
11. recording stub 捕获的 prompt 只存在于当前测试闭包，每个 test 后清空；不快照、不写文件、不打印正文。
12. envelope 必须断言 `attempted=false -> trace 不存在`、`attempted=true -> trace 存在`；`reasonCodes` 首项为
    disposition、无重复且按 canonical 顺序。
13. Verifier conflict 重复 evidence 必须得到 `fallback_schema_invalid`；不同 evidence 输入顺序必须生成同一
    canonical 结果。
14. 缺失/空/重复 `chunkId`、NaN/Infinity/越界 score 都在 runtime 前 `fallback_invalid_input`。
15. Router safety detector 必须覆盖 NFKC、CR/LF/制表符空白压缩、组间隔 0/40 的正例、41 的反例，
    以及 `destructive_knowledge_write` 两个相邻间隔分判定。
16. pre-aborted signal 在 safety/eligibility 之后、budget/runtime 之前结束，调用数 0；runtime 内 abort 为
    `attempted=true`，两者都使用 `[fallback_aborted, ABORTED]`。
17. `runPhase6941RouterVerifierBaseline()` 继续为 100/74/26、critical=2、token/cost=0。

适用门禁：

```powershell
bun --filter @repo/agent test
bun --filter @repo/agent typecheck
bun --filter @repo/agent lint
bun --filter @repo/agent eval:phase-6-9-4-1
bun --filter @repo/ai test
bun --filter @repo/ai typecheck
bun --filter @repo/ai lint
bun --cwd packages/types typecheck
git diff --check
```

## 14. 安全与隐私边界

- adapter 不读取 API key、base URL、provider 或 live 开关。
- composition root 不在本 slice 内，因此不存在隐式 Live 调用。
- prompt 不包含完整聊天历史、用户 ID、文档 ID、文档标题或安全内部 metadata。
- safety-blocked 内容不会通过“先脱敏再发模型”绕过调用禁止。
- Trace 仅保留 runIdHash、task、mode/provider/model、status、usage、duration、degraded/errorCode。
- estimated token/cost 只是工程预算与估算，不冒充 provider 账单。

## 15. 阶段拆分

### Phase 6.9.4.2（本任务）

- strict Mock candidate schema；
- Agent 专属 adapter；
- deterministic safety gate；
- budget/timeout/schema/runtime 降级测试；
- 不进入 Chat，Enabled 仍为 no。

### Phase 6.9.4.3（下一阶段）

- 复用同一 `phase-6.9-router-verifier-v1` case；
- 只对 candidateEligible case 运行 candidate；
- 构建 deterministic/Mock/controlled Live paired runner；
- 计算质量、critical、额外延迟、token 和成本；
- 输出 Enabled 决策证据，但仍不自动改动业务链路。

复用同一数据集是 paired experiment 的因果可比性前提：如果 deterministic 与 candidate 使用不同考卷、expected
或 eligibility，分数差无法归因于 candidate，也无法防止为模型挑选更有利的样本。

只有 paired eval 全部过门禁后，后续 slice 才能设计 `/api/chat` 受控混合路径。

## 16. 文档与提交规则

- 本设计使用语义化文件名，不使用日期前缀。
- 设计文档、共享 policy、Router adapter、Verifier adapter、收尾验收/文档应拆为独立任务与提交。
- 每个实现任务都从前一任务已推送的最新 `main` 创建新 `codex/` 分支，不从功能分支再开分支。
- 功能分支验收后 `--no-ff` 合并 `main`，在 `main` 重跑门禁、推送并核对三方 SHA。
- 本 slice 不需要 Docker 或浏览器，不执行 prune、`down -v`、删除容器/镜像/volume 或清空 PostgreSQL/MinIO。
- `AGENTS.md`、roadmap、AI 验收规范只在实现与收尾证据形成后同步，不在设计提交中预宣布完成。

## 17. 完成标准

Phase 6.9.4.2 只有同时满足以下条件才可标记完成：

- Router / Verifier 分别有 strict schema 和专属 adapter；
- ineligible 与 safety-blocked 请求的 runtime invoke 次数为 0，Router safety-blocked 结果为本地 safe `chat`；
- Router 模型不能输出或绕过权限位；
- Verifier 高风险 chunk 不进入 candidate，失败不会放宽为 trusted；
- 所有错误只使用固定结构码，没有 prompt/chunk/output/raw error 泄露；
- Mock 与 failure stub 覆盖 schema、budget、timeout、abort 和 runtime 降级；
- attempted/trace、reasonCodes、evidence 去重排序、chunkId/score 校验与 Unicode/40-code-point gate 边界均有回归测试；
- Phase 6.9.4.1 数据集与 74/100 baseline 保持不变；
- `@repo/agent`、`@repo/ai`、`@repo/types` 适用门禁通过；
- 文档、分支、提交、main 复验和远程推送完成；
- Enabled 继续为 `no`，下一任务是 Phase 6.9.4.3 paired eval。

## 18. 回顾时可以问

- “为什么 Phase 6.9.4.2 先做 Mock contract，而不直接运行真实模型？”
- “为什么 Router 和 Verifier 不共用一个通用 Candidate Orchestrator？”
- “Router 能改 route，为什么仍不能修改 `requiresRag` 和 `requiresHumanApproval`？”
- “为什么上游传入 `candidateEligible=true` 后，adapter 还要再做 safety gate？”
- “为什么 Verifier 只要出现一个高风险 chunk，整次 candidate 就不能调用？”
- “为什么 Verifier 在 candidate 失败时要将 deterministic trusted 收紧为 suspicious？”
- “Mock responder 为什么不能用 sleep 来证明 live timeout？”
- “哪些门禁即使全部通过，仍不能说明候选的语义质量更好？”
- “Phase 6.9.4.3 为什么必须复用同一数据集做 paired eval？”
