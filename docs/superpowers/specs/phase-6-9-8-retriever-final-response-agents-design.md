# Phase 6.9.8 RetrieverAgent / FinalResponseAgent 正式化设计

> 状态：Task 9C 与 Architecture Recovery R5 均已失败封存；Transport Evidence Recovery T0 已完成，下一步 T1 zero-provider contract/TDD；R6/R7、产品/main 与后续阶段阻断
> 日期：2026-08-05
> 分支：`drb/phase-6-9-8-retriever-final-response-contract`
> Design Authority：`zero_provider_retriever_final_response_design`
> Current Checkpoint Authority：`architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`

## 1. 决策与目标

Phase 6.9.8 不新增两个只有名字的 prompt wrapper，而是把当前隐含在 RAG 和 `/api/chat` 中的职责拆成
可验证、可组合、可降级的正式 Agent contract：

1. `RetrieverAgent` 负责把受控问题转换为检索请求，并调用当前用户范围内的 Qwen embedding +
   PostgreSQL vector/keyword hybrid search；复杂多轮问题可进入受限 query rewrite candidate。
2. `KnowledgeVerifierAgent` 继续负责证据可信度语义判断；新的本地 evidence projector 同时依据
   deterministic safety 与 Verifier 结论生成 `VerifiedEvidenceBundle`。
3. `FinalResponseAgent` 只消费经过预算裁剪、权限确认和证据投影的上下文，使用真实模型生成最终回答；
   citation、工具执行状态和权限声明继续由本地权威生成。
4. 清除 Chat 编排中的 `userId: 'web-chat-user'`。身份只能来自 NestJS 对 JWT 的认证结果；客户端和模型
   都不能提供或覆盖 owner。
5. 建立从 Router/Tutor/Retriever/Verifier 到 FinalResponse 的版本化通信、abort、预算、Trace 和失败降级
   contract，为 Phase 6.9.10 owner-aware executable graph/tool 接入提供阻断门。

Task 0 只冻结设计、数值门槛和实施顺序，不修改运行时代码，不读取凭据，不调用 Provider，也不启动
Docker 或浏览器。

## 2. 当前实现事实

### 2.1 Task 0 起点：Retriever 仍是隐含能力

- `packages/rag/src/retriever.ts` 仍是抛出 `Not implemented` 的 stub，没有生产调用方。
- 真实检索位于 NestJS `KnowledgeSearchService`：先生成 query embedding，再以
  `c.userId = owner && d.userId = owner && d.status = DONE` 执行向量与关键词召回，最后按 `chunkId`
  合并、排序和截断。
- `POST /knowledge/search` 由 `JwtAuthGuard + CurrentUser` 得到 canonical `user.id`；客户端只传
  Bearer token 和 query/topK/minScore，不能传 userId。
- Web `searchKnowledgeForChat` 负责调用该 API、执行 deterministic safety/Verifier、构造 prompt 和
  Markdown citation。禁用、无 token、无命中、HTTP/schema/fetch 失败均降级为空结果。

因此 Phase 6.9.8 不重写已经通过 Docker 验收的 hybrid search，而是在它外面建立正式 Agent contract、
owner binding、query rewrite 和 Trace。

### 2.2 FinalResponse 仍是隐含能力

- `/api/chat` 直接调用 `streamText` 生成 live 文本；Mock 使用本地 `createMockChatText`。
- citation 在模型文本结束后由本地 `appendCitationMarkdown` 追加，但当前只是普通 Markdown 文本，不是
  结构化 stream event。
- Agent Trace 在最终模型 stream 开始前写入，`finishedAt`、输出 token 和成本仍是预算估算，不能证明最终
  stream 完成、真实 usage 或 abort 终态。
- 当前模型编排收到固定 `web-chat-user`；知识检索本身虽由后端 token 正确隔离，但 Agent state 的 identity
  不是 canonical owner。

Phase 6.9.8 必须修复这些边界，不能把现有 live Chat 简单改名为 FinalResponseAgent 后宣称完成。

## 3. Authority 分层

| 领域        | 权威来源                                          | 模型允许做什么                            | 模型不得做什么                                           |
| ----------- | ------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| 身份        | NestJS JWT 校验和数据库 owner                     | 不接收身份字段                            | 提供、猜测或覆盖 owner/userId                            |
| 是否检索    | Router canonical route + 本地 policy              | query rewrite candidate 可建议更清晰表达  | 打开 RAG、扩大 topK、选择其他用户资料                    |
| 检索结果    | owner-scoped hybrid search                        | 不改变 chunk/document identity 或分数     | 伪造来源、命中、score 或 document filter                 |
| 证据安全    | deterministic SafetyGuard + local projector       | Verifier 只给受限 trust decision/guidance | 放行被阻断正文、传播 provider raw output                 |
| 最终正文    | FinalResponse model                               | 生成回答、解释和不确定性表达              | 改 route、权限、citation、工具执行状态                   |
| citation    | `VerifiedEvidenceBundle` + local renderer         | 可依据投影后的证据生成正文                | 创建 citation event、选择 bundle 外来源或伪造来源        |
| 写操作/工具 | 后端 policy/executor；本阶段为空                  | 只能描述“未执行/不可用”                   | 宣称保存、删除、创建计划或工具成功                       |
| usage/cost  | provider verified usage + versioned price profile | 不自报 usage/cost                         | 用估算值冒充 verified usage                              |
| Trace       | 本地 runtime instrumentation                      | 不写 Trace                                | 保存 prompt、回答、chunk、token、credential 或 raw error |

## 4. 本地执行上下文

跨 Agent DTO 不携带 Bearer token、cookie 或可变数据库对象。composition root 另外持有以下只读上下文：

```ts
type AgentExecutionContextV1 = {
  runId: string;
  requestId: string;
  principal:
    | {
        kind: 'authenticated';
        ownerId: string;
        authority: 'server_jwt';
      }
    | {
        kind: 'anonymous';
      };
  deadlineAt: string;
  signal: AbortSignal;
};
```

约束：

- `ownerId` 只能由服务器认证响应创建，不能从 Chat request body、model output 或 query parameter 读取。
- `ownerId` 是 1--128 字符的 server-assigned opaque identifier，只接受 `[A-Za-z0-9_-]`；context 必须由同一
  auth receipt 一次创建并 deep-freeze，后续节点不能替换 principal。composition root 持有同一 bearer token
  调用 `/knowledge/search`，不得另传一个 ownerId；Task 2 必须覆盖 token/owner/request binding 与跨请求串用。
- `ownerId` 只在本地权限与数据访问层使用，不进入模型 prompt、public response header 或 Trace summary。
- anonymous 只允许无 owner 数据的本地 Mock/普通 Chat；Retriever、Verifier、所有 live Agent candidate 与
  owner Trace 必须在 Provider 构造前被拒绝，并保持 zero-call。
- 请求携带无效 token 时返回 401，不允许静默降级成 anonymous。
- `AbortSignal` 仅作为进程内控制对象传播，不序列化进 DTO、数据库或模型输入。

## 5. 跨 Agent 通信 envelope

所有新 DTO 使用 strict Zod、拒绝 unknown key，并固定 `agent-message-v1`：

```ts
type AgentMessageEnvelopeV1<T> = {
  schemaVersion: 'agent-message-v1';
  runId: string;
  messageId: string;
  parentMessageId?: string;
  producer: AgentNodeName;
  consumer: AgentNodeName;
  status: 'completed' | 'degraded' | 'skipped' | 'failed';
  reasonCodes: AgentReasonCode[];
  degraded: boolean;
  usageRef?: {
    modelCallId: string;
    attribution: 'direct' | 'shared' | 'cache';
    attempted: boolean;
    cached: boolean;
  };
  payload?: T;
};
```

本地 validator 必须强制：

- `completed` 必须有 payload、`degraded=false`；
- `skipped` 不得有 provider usage，`attempted=false`；
- `degraded/failed` 至少有一个固定 reason code；
- cache hit 必须 `attempted=false/cached=true/usage=0`，且不能跳过 owner/safety eligibility；
- 同一个 `modelCallId` 的 usage/cost 只记一次，其余 Agent 只能通过 `usageRef` 引用；
- reason code、agent name、schema version 和数组大小均使用冻结 allowlist。

## 6. RetrieverAgent contract

### 6.1 输入

`RetrieverRequestV1` 只包含检索所需的有界数据：

- `originalQuery`：trim 后 1--2000 字符；
- 最近最多 4 条 user/assistant turn 的受限 query-rewrite context，每条最多 500 字符；
- 可选 active question/goal 摘要，每项最多 300 字符并标记为 untrusted context；
- canonical `requiresRag`；
- 本地 policy：`topK 1--8`、`minScore 0--1`、允许的 source/status filter；
- `runId/requestId/deadline` 引用，不包含 token、ownerId、完整 summary 或资料正文。

### 6.2 Query rewrite

生产默认关闭的 `RETRIEVER_QUERY_REWRITE_MODEL_ENABLED` 只在下列条件全部满足时允许一次调用；timeout 与
credential 分别固定为 `RETRIEVER_QUERY_REWRITE_MODEL_TIMEOUT_MS=4000` 和仅 Web runtime 可见的
`RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY`：

- authenticated canonical principal；
- Router 要求 RAG，且问题存在多轮指代、省略或需要结合 active question；
- 输入通过 credential/prompt-injection/长度/Unicode/control-character 安全门；
- gate、global Live、精确模型/endpoint、独立 credential、预算和 deadline 均有效；
- 原 query 不是已经完整、独立、可检索的明确表达。

模型使用 DeepSeek V4 Pro non-thinking JSON，只返回一个有界 `rewrittenQuery`。本地仍负责：

- 长度、字符和 credential 扫描；
- 关键实体/约束保留；
- 原 query 与 rewrite 的选择；
- topK/minScore/document filter；
- 失败时回到 original query 或 no-RAG。

模型不得看到知识库 chunk、document ID、ownerId、expected relevance 或 scorer oracle。
`originalQuery`、每条 recent turn 与 active question/goal 必须分别扫描后再组合；任何一段 unsafe 都不能通过删掉
边界后重新拼接来绕过 eligibility，且 raw model/provider error 不进入 fallback reason 或 Trace。

### 6.3 输出

`RetrieverResultV1` 固定包含：

- original/executed query 的 hash reference；原文只在下一节点确实需要时有界传递；
- rewrite `attempted/disposition/reason`；
- retrieval mode=`hybrid`、topK/minScore、latency、request correlation；
- 最多 8 个 `EvidenceCandidateV1`：稳定 document/chunk/citation ID、最多 700 字符 excerpt、score、
  vectorScore、keywordScore、安全 metadata 与 `truncated`；
- `completed/degraded/skipped/failed`、固定 reason codes 和可选 usageRef。

Retriever 只召回，不决定证据可以进入最终 prompt。

## 7. VerifiedEvidenceBundle

`VerifiedEvidenceBundleV1` 必须由本地 projector 创建，不能直接接受模型对象：

```ts
type VerifiedEvidenceBundleV1 = {
  schemaVersion: 'verified-evidence-bundle-v1';
  bundleId: string;
  runId: string;
  status: 'trusted' | 'suspicious' | 'conflict' | 'insufficient' | 'skipped';
  reasonCodes: EvidenceReasonCode[];
  entries: Array<{
    citationId: string;
    sourceRef: string;
    documentId: string;
    chunkId: string;
    sourceLabel: string;
    excerpt: string;
    trustLabel: 'trusted' | 'caution';
    safetyCodes: string[];
    truncated: boolean;
  }>;
  userNotice?: string;
};
```

硬边界：

- 最多 4 条 entry，每条 excerpt 最多 700 字符；
- `citationId` 使用本地生成的固定格式并全局去重；模型可见的 `sourceLabel` 只能是本地生成的非敏感 ordinal
  alias（例如“资料 1”，最多 32 字符），不能直接复用用户文档标题。真实 display name 仅留在本地 renderer，
  仍须经过 control/bidi/credential/injection 清洗与 120 字符上限；
- prompt injection、credential material、high-risk、cross-owner、unknown safety state 的正文必须在
  projector 前丢弃，不能只靠 `trustLabel` 标记后继续传递；
- Verifier timeout/schema/provider failure 只能把结果收紧为 suspicious/insufficient；
- `documentId/chunkId` 只用于本地 citation/Trace correlation，不进入 FinalResponse model prompt、模型输出或
  public stream event；
- bundle 被 context budget 整层丢弃时，citation 列表必须同步清空。

## 8. FinalResponseAgent contract

### 8.1 输入

`FinalResponseRequestV1` 只消费：

- 已裁剪的 latest user + recent conversation；
- canonical Router decision；
- 受限 Tutor guidance；
- 可选 `VerifiedEvidenceBundleV1`；
- 当前阶段固定为空的 `ToolResultSummary[]`；
- context budget、允许 citation ID 集合、request deadline 与 abort；
- 不包含 ownerId、token、完整数据库对象、provider raw output 或未验证 chunk。

`FinalResponseRequestV1` 可以在进程内持有完整 bundle 引用，但 adapter 在构造模型输入前必须再次投影为
`citationId/sourceLabel/excerpt/trustLabel`；真实 `documentId/chunkId/sourceRef/safetyCodes` 只留在本地 renderer
和 correlation map。模型不可通过 prompt、tool、header、Trace 或错误信息观察这些本地 ID。

### 8.2 模型和本地 authority

FinalResponse 使用 DeepSeek V4 Pro non-thinking streaming，真实模型路径是必需能力。独立配置固定为
`FINAL_RESPONSE_AGENT_MODEL_ENABLED=false`、`FINAL_RESPONSE_AGENT_MODEL_TIMEOUT_MS=20000` 与仅 Web runtime
可见的 `FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY`。两条新能力还必须同时满足全局
`AI_PROVIDER_MODE=live + AI_ENABLE_LIVE_CALLS=true`；任一 gate、timeout、credential、endpoint、model 或 price
identity 不合法都在 transport 构造前 fail-closed，且不得借用通用 `DEEPSEEK_API_KEY` 或其它 Agent credential。

模型只生成正文；本地 adapter 负责：

- 结构化 stream lifecycle；
- citation allowlist、结构化 citation event 和最终 Markdown/视图渲染；模型正文中的普通文本不能创建
  citation authority；
- “工具未执行/结果不完整/失败”的固定状态表达；
- usage、费用、finish reason 与 Trace finalization；
- provider failure 的固定诚实提示。

Task 0 尚未证明现有 AI SDK `streamText` transport 满足 V4 Pro exact endpoint、non-thinking、verified usage、
abort 与结构化 terminal contract；Task 6 必须实现并专项验证 adapter，不能把当前 live Chat 直接改名后宣称
完成。

模型在首 token 前不可用时返回固定的“回答暂时不可用，可稍后重试”终态。首 token 后失败时保留已经发送的
正文，但 terminal 必须标记 `partial/incomplete`，追加固定“生成中断，内容可能不完整”提示，并禁止发送
citation 或任何工具成功状态。两种失败都保留用户消息，不后台重试，不伪造答案、引用、保存、计划或工具执行
成功。

### 8.3 Stream event

`FinalResponseStreamEventV1` 为 strict union：

1. `response_started`：response/run ID、mode、safe `modelRef`；`modelRef` 只能来自本地 allowlist（例如
   `deepseek-v4-pro-nonthinking-v1`），不得包含 endpoint、base URL、credential、部署名或 provider raw metadata；
2. `text_delta`：单调 sequence + bounded text；
3. `citations`：只由本地 renderer 生成，只接受本地 bundle 中的 citation；
4. `response_completed`：finish reason、verified usageRef、Trace terminal；
5. `response_failed`：固定 safe error code、retryable、用户可见固定提示。

同一 run 必须恰好一个 terminal event。乱序、重复 sequence、terminal 后 delta、未知 event 或 citation
越权均 fail-closed。

这里的 exactly-once 是服务端进程内 emitter/ledger 与 Trace terminal 不变量，不声称网络恰好交付一次。客户端
断连可能收不到 terminal，但服务端必须在 abort race 中只落一个 terminal；不得因网络不可见而自动重放或二次
计费。

## 9. Trace 与成本

新的实时 Chat Trace 至少包含以下 step：

```text
RouterAgent
TutorAgent? / RetrieverQueryRewriteCandidate?
RetrieverAgent?
KnowledgeVerifierAgent?
EvidenceProjector?
FinalResponseAgent
```

要求：

- 先创建 run/`running` 记录，stream terminal 后再 finalize；不得在 Provider stream 前写
  `completed/finishedAt`；
- Retriever 记录 mode、hit count、latency、rewrite disposition 和固定 reason，不保存 query/chunk 正文；
- FinalResponse 记录 TTFT、total duration、finish reason、verified input/output usage 和价格 profile；
- 估算 token 与 provider verified usage 分字段保存，不能互相替代；
- Trace finalization 失败不撤回已经发送的正文，但必须标记 `trace_unavailable`；该 run 不能形成
  controlled-Live 质量 authority；
- Trace 不保存 prompt、回答、chunk、summary、tool payload、ownerId、token、cookie、base URL、stack 或
  provider raw error。

## 10. 并发、取消与任务不丢失

- 每个 Chat request 使用独立 immutable context、budget、runId 和 requestId；禁止跨请求共享可变 budget。
- parent abort 必须向 query rewrite、knowledge search、Verifier、FinalResponse stream 与 Trace terminal
  传播；每个 listener/timer 在 terminal 后清理。
- 所有 Provider adapter `maxRetries=0`；自动 retry 不得制造重复费用或不一致 Trace。
- response event sequence 单调、terminal exactly-once；并发请求不能覆盖彼此的 run、citation 或 usage。
- Phase 6.9.8 的 FinalResponse 是同步 request/stream，不写 `BackgroundJob`，因此本阶段不需要同时写
  Outbox。若未来把生成改成异步任务，则 `BackgroundJob + Durable Outbox + idempotency key` 必须一起设计，
  禁止只写队列或只写 job。
- 浏览器断开后只允许终止当前 run；不得后台静默重放或继续收费。用户显式重试必须创建新 run。

## 11. 失败与降级矩阵

| 失败点                                         | 固定结果                                          | 允许继续                        |
| ---------------------------------------------- | ------------------------------------------------- | ------------------------------- |
| 无/无效认证                                    | Retriever/owner Agent zero-call；无效 token=401   | anonymous Mock 普通 Chat 可继续 |
| query rewrite ineligible/gate-off              | original query hybrid search                      | 是                              |
| rewrite timeout/schema/budget/provider failure | original query 或 no-RAG，标记 degraded           | 是                              |
| knowledge search failure                       | 空 evidence + `retrieval_failed`                  | FinalResponse 可用通用知识回答  |
| safety block                                   | 被阻断正文不进入 Verifier/FinalResponse           | 是，但无引用                    |
| Verifier failure                               | suspicious/insufficient                           | 是，必须保守提示                |
| context budget 丢 RAG                          | bundle/citation 同时清空                          | 是                              |
| FinalResponse 首 token 前失败                  | 固定诚实不可用响应                                | 不伪造等价答案                  |
| FinalResponse 首 token 后失败                  | partial/incomplete terminal，无 citation/工具成功 | 保留已发送正文并显式标记不完整  |
| client abort                                   | terminal=aborted、无 retry                        | 用户可显式重试                  |
| Trace unavailable                              | 回答可交付，run 无质量 authority                  | 是                              |
| usage/price unknown                            | 费用 authority=null，production gate fail-closed  | Mock 可继续                     |

## 12. 模型、预算与数值门槛

### 12.1 冻结模型

- Retriever embedding/search：Qwen `text-embedding-v4` / 1536 + PostgreSQL hybrid；
- query rewrite：DeepSeek `deepseek-v4-pro` non-thinking JSON；
- FinalResponse：DeepSeek `deepseek-v4-pro` non-thinking streaming；
- DeepSeek price profile：`deepseek-v4-pro-cny-2026-07-15`，input/output `3/6 CNY / 1M tokens`；
- Provider endpoint、模型、thinking、price profile 任一漂移都必须在调用前 fail-closed。

Task 9A 已在 2026-08-05 依据阿里云百炼官方 `text-embedding-v4` 模型页与 OpenAI-compatible Embedding
接口页冻结北京区价格 profile `qwen-text-embedding-v4-cn-beijing-cny-2026-08-05`：普通同步文本输入
`0.5 CNY / 1M input tokens`，输出不计费；响应必须提供 `usage.prompt_tokens` 与 `usage.total_tokens`，且本能力
要求二者相等。北京区 endpoint profile 只允许业务空间
`https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` 或官方仍兼容的 legacy
`https://dashscope.aliyuncs.com/compatible-mode/v1`，并固定 `/embeddings`、`text-embedding-v4`、1536 维。
Task 9 的 32 次单文本 query embedding 以官方单文本 `8192 tokens` 上限冻结最坏情况预算：最多
`262144 input tokens / 0.131072 CNY`。这只是 admission/transport 合同；usage、price、任一分母不完整仍使正式
aggregate 为 `null`，Task 9A 不形成 Live 成本或质量 authority。

### 12.2 单请求预算

| 能力                 | 调用 | input/output |  hard timeout | 单次 DeepSeek cap |
| -------------------- | ---: | -----------: | ------------: | ----------------: |
| query rewrite        |    1 |   1200 / 160 |        4000ms |         0.005 CNY |
| FinalResponse        |    1 |  2500 / 1200 |       20000ms |         0.015 CNY |
| Phase 6.9.8 增量合计 |    2 |  3700 / 1360 | 各自 deadline |         0.020 CNY |

Router/Tutor/Verifier 继续使用自己的既有独立或共享预算，不能把它们的 usage 复制进 Retriever/FinalResponse。
一次实时 Chat 最多 6 次模型调用：DeepSeek Router/Tutor/rewrite/Verifier/FinalResponse 最多各一次，Qwen query
embedding 最多一次；每次必须有唯一 `modelCallId` 和不重复 usage。被 policy 跳过的节点不占调用次数。

### 12.3 Dataset 与质量门

冻结 `phase-6.9.8-retriever-final-response-v1` 共 48 case：

- 16 Retriever guard：认证/owner、安全、明确 query、gate/config/budget/abort；
- 16 Retriever rewrite runtime：中文/英文、多轮指代、省略、active question、冲突上下文；
- 16 FinalResponse runtime：trusted/suspicious/conflict/insufficient/no-RAG、citation、abort、工具未执行与
  provider failure。

正式 gate 同时要求：

- guard `16/16`，应 zero-call 的 rewrite/embedding/FinalResponse counter 全为 0；
- rewrite runtime `16/16` strict response + verified usage；
- FinalResponse runtime `16/16` terminal + verified usage；
- owner/cross-user/credential/injection/blocked-evidence/false-tool-success/false-citation failure 全为 0；
- Retriever `Recall@5 >= 0.90`、`nDCG@5 >= 0.85`，eligible subset 相对 original-query baseline
  `nDCG@5 >= +0.08`，critical target recall=1；
- rewrite intent-preservation `>= 0.95`，unsafe rewrite=0；
- FinalResponse grounded rubric `>= 0.90`，citation precision=1，required citation recall `>= 0.90`，
  conflict/insufficient notice critical recall=1；
- rewrite P95 `<=3500ms`，hybrid retrieval P95 `<=5500ms`；
- FinalResponse TTFT P95 `<=5000ms`、total P95 `<=15000ms`、Chat end-to-end P95 `<=20000ms`；
- 16 rewrite + 16 FinalResponse 的 DeepSeek run cap `<=0.32 CNY`；Qwen 最多 32 calls、
  `262144 input tokens / 0.131072 CNY`，usage/cost 独立列示且必须可验证；
- paired Retriever runtime 对每个 case 分别运行 original-query baseline 与 rewritten-query candidate，Qwen query
  embedding 最多 `32` 次；价格 profile 未冻结前 Qwen cap 和总成本 aggregate 均为 `null`，Task 9 不得 admission；
- report 不完整、usage/price unknown、任何 critical failure 或任一分母缺失都使正式 aggregate 为 `null`，
  production gate fail-closed。

Mock 满分只形成 `mock_quality_not_evidence`，不能启用 production gate。controlled-Live 仍需新的数据边界
接受和精确一次性授权；任何 Phase 6.9.7 授权不能复用。

## 13. 实施顺序

| Task | 原子关注点                                                                                             | Provider         |
| ---- | ------------------------------------------------------------------------------------------------------ | ---------------- |
| 0    | 设计、通信/权限/预算/评测门冻结                                                                        | 0                |
| 1    | shared envelope、principal、Retriever/Bundle/FinalResponse Zod contract 与 negative tests              | 0                |
| 2    | canonical principal 接入 Chat，清除 placeholder identity，认证/owner regression                        | 0                |
| 3    | RetrieverAgent node + 既有 hybrid-search adapter + deterministic baseline                              | 0                |
| 4    | local evidence projector + `VerifiedEvidenceBundle` + structured citation adapter                      | 0                |
| 5    | query rewrite candidate、独立 gate/credential/budget/timeout 与 Mock                                   | 0                |
| 6    | FinalResponseAgent node、专项 streaming adapter、stream event、固定 failure 与 local citation renderer | 0                |
| 7    | Chat composition、end-to-end Trace finalization、abort/concurrency/no-loss                             | 0                |
| 8    | 48-case baseline、reviewed Mock、strict report/validator 与 static checkpoint                          | 0                |
| 9A   | Qwen 北京区官方 price/endpoint/usage contract 与严格 direct transport/fault matrix                     | 0                |
| 9B   | paired runner、DeepSeek/Qwen 独立 accounting、source admission、durability/validator/CLI               | 0                |
| 9C   | 唯一 controlled-Live paired eval；未授权不得开始                                                       | 需 fresh 授权    |
| 10   | 分支 Docker/API/可见浏览器/Trace/权限/清理/default-off 验收                                            | 仅按 Task 9 结论 |
| 11   | 文档复审、main `--no-ff`、main default-off 复验与远程 SHA 对齐                                         | 0                |

每个 Task 一个提交。不得从功能分支再开分支，不使用 worktree；Phase 6.9.8 完成前不得开始
Phase 6.9.9/6.9.10/6.10/8/9 或博客收尾。

Task 3 的 zero-provider PostgreSQL owner isolation/baseline 测试必须注入固定 embedding 或 fake embedding port，
不能调用 Qwen。Task 9A/9B 仍然必须使用 injected transport、保持 Provider/credential 计数为 0；只有 Task 9C
在 fresh admission 后才允许消费独立 DeepSeek/Qwen credential。两类 credential、attempt、verified usage 与费用
必须分开记账。

## 14. Task 0 完成标准

- 当前真实 RAG/Chat/Trace/identity 缺口有源码证据；
- 职责、输入输出、authority、权限、通信、降级、Trace、并发和任务丢失边界已冻结；
- dataset、质量/P95/token/CNY/zero-call 门与任务顺序已固定；
- 新文档与 AGENTS/README/roadmap/data-flow/acceptance/DEVLOG 一致；
- 只执行文档与静态链接/格式验证，`providerCalls=0`；
- Task 0 只解锁 Task 1 shared contracts，不解锁 runtime、Live、Docker 或产品验收。

## 15. 回顾时可以问

- “为什么现有 Qwen hybrid search 已可用，RetrieverAgent 仍不能算正式完成？”
- “为什么 query rewrite 模型只能建议 query，不能决定 owner、topK 或 document filter？”
- “为什么 VerifiedEvidenceBundle 必须由本地 projector 生成，而不能直接相信 Verifier 输出？”
- “为什么 FinalResponse 模型生成正文，但 citation 和工具执行状态仍由本地 authority 控制？”
- “为什么 Trace 必须在 stream terminal 后 finalize，不能在调用模型前先写 completed？”
- “同步 FinalResponse 为什么不需要 BackgroundJob/Outbox，什么时候两者必须一起加入？”
- “为什么 Mock 满分和旧 Chat live 可用都不能替代 Phase 6.9.8 controlled-Live paired gate？”

## 16. 实施 checkpoint（2026-08-04）

Task 1 已在 `zero_provider_retriever_final_response_shared_contract` authority 下实现本设计的 shared contract
地基：canonical principal/envelope、Retriever request/result、local-only VerifiedEvidenceBundle、FinalResponse
request/model evidence projection 与 strict stream event/ledger。输入先做 bounded plain snapshot，再执行 strict Zod 与
跨字段校验；返回值 deep-freeze。`AbortSignal` 保持进程内、不可枚举，不进入序列化 DTO。

该 checkpoint 只证明 contract 与 negative-test 边界，不表示 Nest JWT 已接 Chat、`web-chat-user` 已删除、
Retriever/FinalResponse node 已执行、Qwen/DeepSeek 已调用，或 structured citation/terminal Trace 已接入产品。当时
只解锁 Task 2 canonical principal / Chat access；完整证据见
`../../acceptance/phase-6-9-8-task-1-shared-communication-contracts.md`。

Task 2 随后以 `zero_provider_retriever_final_response_chat_access` 把 `/auth/me` strict `AuthUser.id` 投影为
`/api/chat` 的 canonical principal，删除固定 `web-chat-user`，并以 WeakMap bearer capability 绑定同一 auth
response、原始 Request 与 execution context。无 token Mock 只创建 anonymous context；无 token Live、无效/
过期 token 与 binding failure 均在 Agent runtime 前 fail-closed。带 token 的 Mock 也必须认证一次；Conversation、
authenticated-only RAG 与 owner Trace 只读取同一绑定 bearer。客户端身份字段被拒绝，owner/token 不进入
prompt/header/Trace，两个 owner 反序认证不串 context/token。

Task 2 的 Web full、非测试源码 typecheck、受影响 lint、Server Auth focused 与独立安全复审通过，全程未读
credential、未调用 Provider，也未执行 Docker/API/browser。它只解锁 Task 3 Retriever node + deterministic
baseline；尚未形成 Retriever/FinalResponse runtime、query rewrite、evidence projector、structured stream/terminal
Trace、Mock/Live、产品或 main authority。完整证据见
`../../acceptance/phase-6-9-8-task-2-canonical-principal-chat-access.md`。

## 16. Task 3 完成回执（2026-08-04）

Task 3 以 `zero_provider_retriever_original_query_deterministic_baseline` 把 Task 0 的 Retriever 设计落成正式
node/port，但没有改写 Task 0 的设计 authority：

- `packages/rag` 使用 WeakMap 保存 exact execution scope 与 executor，公开 port 只含 schema version；
- `@repo/agent` Retriever 固定 `topK=8/minScore=0.72/knowledge_document/DONE`，只执行 original query，rewrite
  固定 `gate_off/attempted=false`；
- Web server-only adapter 复用 authenticated `/knowledge/search`，owner 只由后端 JWT authority 解析，bearer 每次
  执行从 Task 2 三引用 capability 临时读取；
- stable dedupe/rank/tie、single search、deadline/abort、strict response、blocked-body replacement 与 query-SHA-only
  Trace 已通过回归；
- 16 guard + 16 runtime baseline 固定 manifest/report SHA `8a1788aa...654d / a1478f22...6442`，Recall@5/
  nDCG@5/Top1/no-hit/critical recall 为 `1/0.813219437888/0.571428571429/1/1`；Qwen/rewrite/
  FinalResponse/Provider calls=0。

该结果只形成 `qualityAuthority=deterministic_baseline_only`。PostgreSQL owner-isolation E2E 使用 fixed fake 1536
embedding；没有产品 Web/Server Docker/API/browser、真实 Qwen/DeepSeek、P95/token/CNY/SLA 或 main authority，
legacy Chat RAG 也尚未切换到该 node。该 checkpoint 当时只解锁 Task 4 VerifiedEvidenceBundle/evidence projector；完整证据见
`../../acceptance/phase-6-9-8-task-3-retriever-node-deterministic-baseline.md`。

## 17. Task 4 完成回执（2026-08-04）

Task 4 以 `zero_provider_verified_evidence_projector` 落成本设计第 7 节的本地证据 authority，但不改写
Task 0 的设计 authority，也不提前接入 Task 5--7 runtime：

- 正式 Retriever result、VerifiedEvidenceBundle、citation projection、FinalResponse request 与 model projection
  均通过进程内 WeakMap 绑定同一个 exact `AgentExecutionContextV1`；结构 clone、低层 bundle constructor、跨
  owner/context 复用、run/request/deadline 漂移与缺失 context 均 fail-closed；
- projector 先执行 deterministic owner/safety eligibility，再按 Verifier
  `trusted/suspicious/conflict/insufficient/skipped` 收紧；Verifier unavailable 只能维持或收紧，不能把证据升级；
- prompt injection、credential、high-risk、control character、unknown safety、blocked 与 cross-owner body 在
  bundle 前删除；最多保留 4 条，每条截断到 700 UTF-16 code units；稳定 score/tie 排序和 Retriever 的
  `documentId + chunkId` citation identity 不受输入重排影响；
- 模型只可见 `citationId/sourceLabel/excerpt/trustLabel`；结构化 citation allowlist 与兼容 Markdown fragment
  均由本地 adapter 生成。`ragIncluded=false` 时 bundle、allowlist、citation 和 Markdown 整层清零；
- Trace summary 只保存固定 disposition/status/reason 与计数，不保存正文、owner、token 或 credential。

该 checkpoint 的质量 authority 仅是本地 safety/permission/projection contract；没有读取 credential、调用
Qwen/DeepSeek、接入 `/api/chat`、实现 FinalResponseAgent/structured stream terminal，或执行 Docker/API/browser/
Live/main。该 checkpoint 当时只解锁 Task 5 query rewrite candidate；完整证据见
`../../acceptance/phase-6-9-8-task-4-verified-evidence-projector.md`。

## 18. Task 5 完成回执（2026-08-04）

Task 5 以 `zero_provider_retriever_query_rewrite_candidate` 落成本设计的受限 query rewrite candidate，但不改写
Task 0 的设计 authority，也不提前接入 Task 6--8：

- `@repo/agent` 新增 DeepSeek V4 Pro non-thinking strict `{ rewrittenQuery }` candidate；authenticated、
  `requiresRag=true`、安全输入、存在多轮指代/省略或 active context、deadline/abort/预算有效均先于 config、
  credential 与 runtime factory；
- original query、每条 recent turn、active question/goal 分段扫描；本地 validator 保留实体、公式、数字和约束，
  本地 merger 决定 original/rewritten query。模型无权修改 owner、`topK/minScore` 或 document filter；
- 独立 Web server-only default-off config/runtime 固定 `1/1200/160`、4000ms、`0.005 CNY` cap、一次调用、no
  retry；Compose 只向 `web` 投影 gate/timeout/独立 key，generic/sibling credential 不可替代；
- Retriever node 可消费 applied rewrite 并继续使用本地冻结 policy；candidate/schema/runtime/abort 失败均安全回
  original query，Trace/observation 不保存 query、prompt、owner、credential 或 raw error。

本 checkpoint 只通过 reviewed Mock 与静态回归，Mock `qualityAuthority=none`，不能证明 rewrite uplift、真实
DeepSeek/Qwen、P95/usage/CNY 或产品可用。全程未读 `.env`/credential、未调用 Provider，也未启动 Docker/API/
browser、接入 `/api/chat` 或合并 main。Task 6 FinalResponseAgent、Task 7 composition、Task 8 48-case gate 与后续
任务在该 checkpoint 当时仍未完成；该 checkpoint 当时只解锁 Task 6。完整证据见
`../../acceptance/phase-6-9-8-task-5-retriever-query-rewrite-candidate.md`。

## 19. Task 6 完成回执（2026-08-04）

Task 6 以 `zero_provider_final_response_stream_contract` 落成本设计的 FinalResponse node 与 streaming contract，
但不改写 Task 0 的设计 authority，也不提前形成 Task 7/8 或产品 authority：

- `@repo/ai` 新增独立 DeepSeek V4 Pro non-thinking streaming adapter，固定 exact
  `/v1/chat/completions`、`stream=true`、`stream_options.include_usage=true`、`max_tokens=1200`、no
  tools/reasoning/retry，并严格核对 step/final finish reason 与 verified usage；
- `@repo/agent` 新增 authenticated-only FinalResponse node；exact context、完整模型字段安全、config、abort/
  deadline、输入预算均先于 executor，固定 `20000ms / 1 call / 2500 input / 1200 output / 0.015 CNY`；
- Citation 只由本地 allowlist 生成，模型无 citation/tool authority。首 token 前后失败、partial text、连续
  sequence 与 exactly-one terminal 由本地 ledger 验证；citation/completed 先封存再 best-effort 投递，断连不
  改写本地 completed，也不声称网络 exactly-once；
- Web server-only default-off config/runtime 使用组件专用 key 与 single-consume executor factory；Compose 仅向
  `web` 投影 gate/timeout/key，generic/sibling credential 不可替代。

本 checkpoint 全程未读 `.env`/credential、未调用 Provider，也未接 `/api/chat`、启动产品 Docker/API/browser、
执行 48-case/controlled-Live 或合并 main。`qualityAuthority=none`，因此不能证明真实模型质量、产品可用性、
Trace、P95 或 SLA；当前只解锁 Task 7 Chat composition 与 terminal Trace。完整证据见
`../../acceptance/phase-6-9-8-task-6-final-response-stream-contract.md`。

## 20. Task 7 完成回执（2026-08-05）

Task 7 以 `zero_provider_chat_composition_terminal_trace` 将 Task 0--6 的正式节点接入 `/api/chat`，但不改写 Task 0
的设计 authority，也不提前形成 Task 8 质量、controlled-Live、产品或 main authority：

- composition 固定为 canonical auth -> minimal RUNNING Trace -> context -> Router/Tutor -> Retriever/query rewrite ->
  Verifier -> local evidence projector -> Trace prepare -> FinalResponse stream -> terminal finalize；anonymous Mock 在
  Provider config 与全部 Agent runtime 前返回；
- realtime Trace 新增 `start/prepare/finalize` 三阶段。Start 只写 run/modelCall/conversation/mode/time 和 pending/zero
  placeholder；prepare 以 digest 幂等写固定脱敏 step；finalize 用 CAS 收口，并可在 prepare ACK 不确定时原子补写
  同一 preparation。Legacy overwrite、late prepare、conflicting retry 与第二个 concurrent finalize 均 fail-closed；
- Retriever transport/schema failure 继续 no-RAG；`ragIncluded=false` 时 bundle、allowlist、citation 与 Markdown
  同时清空。Principal binding invalid 与 abort 分别保持 403/499，不被误报为普通检索失败；
- AI SDK text channel 只承载正文、本地 citation Markdown 与诚实失败提示。Sequence、citation lockstep、唯一
  terminal 和 terminal-last 由本地 ledger 校验；response cancel/parent abort 都会终止 request scope 并单次取消
  底层 reader，清理 listener；
- Trace steps 只接受固定节点、枚举、reason/count summary；不保存 query、chunk、owner、token、prompt、回答正文、
  `inputHash` 或 `inputPreview`。同步 stream 不创建 BackgroundJob/Outbox，也不后台 replay；
- 两个模型 gate 继续 default-off，Provider calls=0，`qualityAuthority=none`。数据库 E2E 已更新，但因本地 Redis/
  PostgreSQL 未运行而 `environment_blocked`；未执行 Docker/API/browser、48-case、controlled-Live 或 main。

Task 7 只解锁 Task 8 48-case deterministic baseline、reviewed Mock 与 static checkpoint。完整证据见
`../../acceptance/phase-6-9-8-task-7-chat-composition-terminal-trace.md`。

## 21. Task 8 完成回执（2026-08-05）

Task 8 以 `zero_provider_retriever_final_response_reviewed_mock_static` 落成本设计的 48-case 静态质量门，但不改写
Task 0 的设计 authority，也不提前形成 Task 9 controlled-Live、产品或 main authority：

- 独立 `phase-6.9.8-retriever-final-response-v1` manifest 固定 `16 guard + 16 rewrite + 16 FinalResponse`；
  manifest/policy/Mock factory/report SHA 为 `3734b698...31d8 / e7f19f34...1464 / d9fa0ddc...c51 /
02294586...1be`，并单独锚定 Task 3 manifest/report；
- guard 实际穿过 production eligibility/context authority，得到 `16/16` pass 与 `16/16` zero-call；
- rewrite 两侧都穿过 production Retriever node 与同一 fake ranked search authority；candidate 只消费真实 bounded
  prompt，再经过本地 validator/merger。strict/usage/runtime 为 `16/16/16`，original/candidate Recall@5
  `0.875/1`、nDCG@5 `0.56923614767/1`、uplift `0.43076385233`，critical/intent 为 `1/1`；
- FinalResponse actual 穿过 Retriever、evidence projector、strict request、prompt-only executor、production node 与
  local terminal/citation ledger；expected 只进入后置 scorer。strict/terminal/usage 为 `16/16/16`，grounded、
  citation precision/recall 与 critical notice 均为 `1`，false tool/citation 为 0；
- report/canonical bytes 不保存 prompt、回答、owner、chunk、credential 或 raw error；mutation/UTF-8/SHA drift
  fail-closed。Single-run capability 在执行前消费；source admission 会核对 actual Git root/branch/HEAD/upstream/
  origin ref/clean tree，并从 exact commit blobs 重算 bundle SHA，伪造 claim 不可通过。仓库 `.gitignore` 仅排除
  本地 `.codex/` 状态，其他 untracked/tracked drift 仍会关闭 admission。静态报告仍明确
  `sourceAdmissionExecuted=false`，不冒充 Task 9 admission；
- gate 固定 `mock_quality_not_evidence / qualityAuthority=none`；synthetic DeepSeek estimate `0.027366 CNY`，P95、
  Qwen verified cost 与 aggregate verified cost 为 `null`；Provider/credential/Qwen calls 和正式 marker/journal/
  evidence/recovery 均为 0。

Task 8 focused `8/8`、Agent full `1252/1252`、typecheck/lint、CLI frozen report、Prettier/diff、Compose default-off
静态检查与两路独立只读复审通过。未启动 Docker/API/browser、修改业务数据、创建 approved tag/正式 evidence 或
合并 main。Task 8 完成后按当时边界停止；后续审计把 Task 9 拆成 zero-provider 的 9A/9B 与唯一
controlled-Live 9C。Source parity、fresh 数据边界接受、精确一次性授权与专用 credential admission 的条件只
适用于 9C，9A/9B 继续严格保持 zero-provider。Task 8 完整证据见
`../../acceptance/phase-6-9-8-task-8-retriever-final-response-reviewed-mock-static.md`。

## 22. Task 9A 完成回执（2026-08-05）

Task 8 终审发现，虽然静态 source admission schema 已存在，但正式 Task 9 尚没有可核验 Qwen usage/费用
transport。Task 9 因而拆成 9A/9B/9C，避免在取得一次性授权后才临时编写 runner：

- `@repo/ai` 新增隔离的 `qwen-text-embedding-v4-provider-v1` direct transport；不读取 env、不记录 endpoint/key/
  provider raw error、不 retry，也不拥有 source admission、marker 或 artifact；
- config 只接受北京业务空间或 legacy 北京域名、exact `/compatible-mode/v1`、`text-embedding-v4`、1536 维与已审计
  price profile；请求固定 `/embeddings`、float encoding、redirect error、credential omit；
- response 只接受 exact list/model/id/data/usage，按唯一连续 index 重排，逐向量检查 1536 个有限数且非零；
  `prompt_tokens == total_tokens` 且不超过每文本 8192，费用由 `0.5 CNY / 1M input tokens` 本地重算；
- injected fetch 永久标记 `synthetic_test`。Fault matrix 覆盖 endpoint/config/request、HTTP/transport/abort、JSON/
  content-type、shape/index/vector/usage 与 no-retry；全程真实 Qwen/DeepSeek/credential calls=0。

Task 9A authority 仅 `zero_provider_qwen_embedding_transport_price_contract / qualityAuthority=none`。它只解锁
Task 9B runner/durability，不创建 approved tag/marker/journal/artifact，也不授权 Task 9C、Docker/API/browser 或
main。完整证据见
`../../acceptance/phase-6-9-8-task-9a-qwen-embedding-transport-price-contract.md`。

## 23. Task 9B 完成回执（2026-08-05）

Task 9B 已在 `zero_provider_retriever_final_response_runner_durability / qualityAuthority=none` 边界完成：

- 独立 Task 9 report/gate 固定 16 guard-first、16 个
  `original Qwen -> DeepSeek rewrite -> candidate Qwen` 串行 pair 与 16 个 DeepSeek FinalResponse；完整调用分母
  64，Qwen/DeepSeek 各 32；
- Qwen cap 为 `262144 input tokens / 0.131072 CNY`，DeepSeek cap 为 `0.32 CNY`，总 cap 为
  `0.451072 CNY`。attempt/dispatch/response/verified usage/token/CNY 按 Provider 独立记录；任何分母、usage、
  price 或 terminal 不完整都会使相关 aggregate=`null`；
- source admission 绑定 fixed branch、HEAD/upstream/origin/approved tag、clean tree、formal-artifact-zero 与
  exact-commit blob bundle SHA。Runner 与 reservation 分别消费独立 WeakMap capability；reservation 前重新核对
  Git observation，调用者不能伪造 authority/source/credentialReads；
- durability 固定 exclusive marker、dispatch-before-call fsynced hash-chain journal、hard-link artifact、strict
  recomputing validator 与 crash-only seal。Evidence lifecycle I/O failure 直接终止 runner，不伪装为 Provider failure；
  recovery 只解释 durable prefix，不读取 credential、不执行调用、不 retry/resume/replay/backfill；
- future Task 9C CLI 顺序已冻结为 exact argv -> source -> data boundary -> authorization -> 3 dedicated credentials
  -> marker -> runner -> artifact -> validator，但本 Task 未执行该 CLI。

Reviewed Mock 得到 guard `16/16`、Qwen/DeepSeek wire+usage 各 `32/32/32/32`、rewrite original/candidate nDCG@5
`0.56923614767/1`、FinalResponse/safety 全门通过；gate 固定
`task9b_mock_quality_not_evidence / qualityAuthority=none`。Factory/report SHA 为
`38e35703...a586 / 820d7b2a...f07`。Focused `27/27`、Agent full `1279/1279`、AI full `337/337`、
typecheck/lint 与三路独立复审通过。

Task 9B 未读取 credential、调用 Provider、创建 approved tag/正式 marker/journal/artifact/recovery、启动
Docker/API/browser 或修改业务数据。它只解锁 Task 9C fresh admission + 唯一 controlled-Live，不授权产品/main 或
后续阶段。完整证据见
`../../acceptance/phase-6-9-8-task-9b-runner-durability-admission.md`。

## 24. Task 9C 失败封存回执（2026-08-05）

唯一 Task 9C controlled-Live 已在 source commit/tag `66a009dd...`、fresh DeepSeek/Qwen 数据边界接受与 exact
one-shot authorization 下执行。Run `28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2` 得到：

- guards `16/16` pass/zero-call；固定 64-call 分母不变；
- `4 succeeded / 1 failed / 59 not_started_quality_breaker`；
- Qwen attempts/dispatches/responses/verified usage `3/3/3/3`；DeepSeek `2/2/1/1`；
- `rewrite_01` 完整成功，`rewrite_02.rewrite_candidate_model` 在 dispatch 后以
  `schema_invalid / wire 1/1/0/0` 失败；
- rewrite/FinalResponse strict `1/16 / 0/16`；semantic/P95/provider token/CNY aggregate 全 `null`；
- gate `task9_quality_gate_failed / qualityAuthority=none`；journal `134` 条并以 `evidence_published` 收口；
- strict validator `ok=true`，report/artifact SHA `c612d6f7...b8b4a4 / 7d45329d...3614c`，recovery claim=`null`。

当前 `schema_invalid` 是 live harness 与 runner 的本地 strict schema/contract 总括边界。Artifact 不保留 Provider
原文或足以区分 candidate disposition、Trace/usage/wire invariant 与 runner result schema 的 bounded diagnostic，
因此不能进一步归因具体字段、模型内容、transport、账号或服务端。

Task 9C 的一次性名额已消费，禁止 retry/resume/replay/backfill、seal/recovery、artifact 改写或追加 Provider
探测。该失败不形成 Retriever/FinalResponse 质量、产品、SLA、Docker/API/browser、Trace 或 main authority；Task
10/11 继续阻断。若继续，必须先建立独立 zero-provider bounded-diagnostic Architecture Recovery 设计和新 lineage，
不能把它包装成 Task 9C retry。完整证据见
`../../acceptance/phase-6-9-8-task-9c-controlled-live-quality-gate-failure.md`。

## 25. Architecture Recovery R0--R4 后续状态（2026-08-06）

独立 R0 已在不改写 Task 9C 的前提下完成三链路 bounded-diagnostic 设计：

- 新 lineage `phase-6.9.8-retriever-final-response-architecture-recovery-v1`；
- 分离第一方 `providerWire` 与 runner lifecycle `runnerWire`；
- 分别冻结 DeepSeek rewrite、Qwen retrieval、DeepSeek FinalResponse stream 的阶段机；
- diagnostic 只允许 fixed stage/reason/provider-boundary/type-count bucket 与
  `rawDataRetained=false`；
- 禁止 completion/stream/prompt/query/chunk/answer/credential/raw error/unknown key 及 raw-derived hash；
- 保持 16 guards、64 calls、双 Provider accounting、阈值、预算、权限、no-retry 与 breaker 不变；
- R0 未修改 TypeScript、读取 credential、调用 Provider、创建正式 evidence 或执行产品/main 验收。

R1 随后已完成 strict bounded diagnostic、module-owned opaque rewrite session 与第一方 V7 terminal wire snapshot
只读投影。Provider observation 不接受 caller-supplied 状态，forged/reused/active capability 均 fail-closed；focused
`11/11`、AI wire/export `25/25`、Agent full `1289/1289` 通过。

R2 又新增独立 `qwen_retrieval` 与 `final_response_stream` 第一方 wire family，以及各自 recovery session。Qwen
按 transport/HTTP/envelope/embedding/usage 分域；FinalResponse 按 transport/HTTP/stream/terminal/false-tool/usage
分域，首个畸形 stream event 固定为 `response_observed + stream_event_invalid`。两者都只保留 fixed bucket，
forged/reused/active/cross-family capability 均 fail-closed。Focused compatibility `58/58`、AI full `345/345`、
Agent full `1301/1301` 通过。

R3 随后完成固定 16-guard/64-call report/runner、source admission、`providerWire/runnerWire`、三个模块私有
observation authority、exclusive marker、reservation-before-dispatch、fsynced hash-chain journal、hard-link
artifact、strict validator、crash-only seal 与 zero-provider CLI。所有 durability artifact 只在临时 synthetic root
验证；正式 approved tag/marker/journal/artifact/recovery claim 均为 0。Focused `39/39`、Agent full
`1318/1318`、AI full `345/345`、typecheck/lint 与 Task 9C validator/SHA parity 通过。

R4 随后把 Task 8 production Retriever/FinalResponse node、ledger 与 prompt-only reviewed Mock 接入 R3 runner，
固定 guards `16/16` zero-call、双 wire `64/64/64/64`、diagnostic `64 applied`、rewrite/FinalResponse `16/16`。
Gate 固定为 `architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`；Provider、credential、formal
evidence 均为 0，synthetic cost 仅用于本地预算回归，verified provider cost 保持 `null`。R0--R4 均为
zero-provider。其后唯一 R5 run `34eb99be...fc68` 在第二个 rewrite pair 的 DeepSeek
`provider_dispatch / unknown` 后以 `architecture_recovery_quality_gate_failed / qualityAuthority=none` durable seal；
external calls `4`，rewrite strict `1/16`、FinalResponse `0/16`，正式 aggregate 为 `null`。R5 禁止重跑，R6/R7、
Task 10/11 和后续阶段继续阻断。完整设计、实施计划与验收见：

- [Architecture Recovery 设计](./phase-6-9-8-retriever-final-response-architecture-recovery-design.md)
- [Architecture Recovery 实施计划](../plans/phase-6-9-8-retriever-final-response-architecture-recovery.md)
- [Architecture Recovery R0 验收](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r0-zero-provider-design.md)
- [Architecture Recovery R1 验收](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r1-zero-provider-tdd.md)
- [Architecture Recovery R2 验收](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r2-zero-provider-robustness.md)
- [Architecture Recovery R3 验收](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r3-runner-durability-admission.md)
- [Architecture Recovery R4 验收](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock-static.md)
- [Architecture Recovery R5 验收](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r5-controlled-live.md)
