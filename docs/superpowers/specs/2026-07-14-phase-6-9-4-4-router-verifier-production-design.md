# Phase 6.9.4.4 Router / Verifier 真实模型生产接入设计

## 状态与已确认决策

- 日期：2026-07-14
- 基线：`main@e09ad437b695f11d60fbbc3caa045ec18cc10994`
- 前置证据：Phase 6.9.4.3 JSON-mode controlled Live 为 28/28 structured success、72/72 zero-call；Verifier 质量门通过，Router 仅超过旧延迟门槛，用户已接受歧义路由额外约 2～4.5 秒、最长 5 秒的产品权衡。
- 已批准方案：Verifier 接入真实模型；Router 使用“本地安全与高置信快速路径 + 歧义请求真实模型”的混合路由。
- 本阶段完成后再逐个评估 Tutor、Planner、Memory、Organizer 等 Agent 是否需要模型化，不在本设计中顺带改造。

## 为什么需要这一阶段

当前生产 Chat 仍直接调用同步的 `routeAgentRequest()` 和 `verifyKnowledgeChunks()`。Phase 6.9.4.3 证明了 Router / Verifier candidate 的结构化模型 contract 可用，但评测结论不会自动改变生产调用链。因此，现在的 Router / Verifier 仍是 deterministic policy，真实模型只存在于评测 runner。

本阶段把模型用在需要语义判断的职责上：Router 判断歧义、多意图和上下文指代；Verifier 判断多份资料之间的数值、定义、版本、条件和时效冲突。本地代码继续掌握权限、安全、预算、schema、超时与失败降级。这里保留 deterministic guard 不是用规则冒充 Agent，而是避免让概率模型决定访问权限或放行不可信材料。

## 目标

1. 歧义 Router 请求在全局 Live 双开关和 Router 独立开关均启用时调用真实模型。
2. 安全且确实需要语义核对的 RAG 结果调用真实 Verifier 模型。
3. 高置信 Router、权限边界、prompt injection、高风险证据和不需要语义核对的 Verifier 请求保持零模型调用。
4. 一次 Chat 最多两次 Agent 模型调用；Router 与 Verifier 共享请求级不可变预算。
5. 任意模型、网络、timeout、schema、telemetry 或预算失败都不阻断最终 Chat，并按职责安全降级。
6. Agent Trace、headers 和成本看板能区分是否调用、结果、耗时和 token，但不记录 prompt、query、chunk 或 provider 原始信息。
7. Mock、controlled Live、Docker 全栈和浏览器均能证明生产路径，而不仅是 eval runner。

## 非目标

- 不让模型决定账号权限、数据库写入、工具调用、记忆写入、资料删除/合并或 MCP 执行。
- 不把所有 Router / Verifier 请求强制发送给模型。
- 不在本阶段模型化其他 Agent。
- 不更换最终 `/api/chat` 的既有流式回答模型。
- 不修改 RAG 召回算法、embedding provider 或混合排序。
- 不把模型原始输出直接拼入最终 prompt。

## 方案比较

### 方案 A：歧义 Router + semantic-needed Verifier（采用）

所有请求先经过本地 deterministic 结果和 candidate adapter；只有 eligibility policy 命中的请求才真正 invoke runtime。它复用已经通过安全评测的 adapter，能保证高置信和安全边界零调用，同时让模型承担真正需要语义理解的部分。

### 方案 B：所有 Router / Verifier 请求都调用模型

实现表面简单，但会给高置信请求稳定增加延迟和成本，扩大 provider 故障面；Verifier controlled Live 也只为复杂冲突与 stale/uncertain 范围提供启用证据。因此不采用。

### 方案 C：继续 shadow，不影响生产结果

风险最低，但用户看不到 Agent 效果，且无法证明真实调用已经进入 Chat 主链。Phase 6.9.4.3 已完成受控评测，本阶段目标正是生产接入，因此不采用。

## 总体数据流

```text
authenticated /api/chat
  -> deterministic Router
  -> Router eligibility policy
  -> Router candidate adapter（所有请求都经过）
       safety / ineligible -> zero call
       eligible -> real structured model -> canonical local route rebuild
       failure -> deterministic route
  -> route-aware Tutor / RAG decision
  -> hybrid knowledge search
  -> deterministic Verifier
  -> Verifier eligibility policy
  -> Verifier candidate adapter（所有 RAG 结果都经过）
       unsafe / ineligible -> zero call or local restrictive result
       eligible -> real structured model -> canonical local notice/prompt rebuild
       failure -> restrictive fallback
  -> context assembler
  -> safe Agent Trace + headers + estimated cost
  -> existing final Chat stream
```

Candidate adapter 必须接收所有请求，而不是只在 caller 判断 eligible 后才调用。这样 adapter 内部已有的凭据、system prompt、instruction override、high-risk chunk 和 hostile input guard 不会被绕过；`runtime.invokeStructured()` 才受 eligibility 限制。

## 组件设计

### 1. Agent package 出口与 eligibility policy

`@repo/agent` 新增稳定 subpath exports，公开 Router / Verifier candidate adapter、observation 类型和纯 eligibility policy，不再让 Web 使用评测目录的相对路径。

Router eligibility 至少识别：

- 两种以上 route 语义信号碰撞；
- “继续、为什么、那一步”等需要上下文消歧的短指代；
- 资料引用与讲题意图混合；
- 复习、计划、错题等多意图优先级冲突；
- 上下文不足但 deterministic policy 给出专门 route。

固定 Router 60 case 必须达到：16 个 ambiguous eligible；36 个高置信和 8 个安全边界 zero-call。不能只用 `confidence < 0.75`，因为既有歧义 case 中存在 0.80～0.86 的 deterministic confidence。

Verifier eligibility 至少识别：

- 安全的多 chunk 数值、定义、版本或条件差异；
- 安全但包含 stale / uncertain / 版本时效信号的材料；
- 单一、一致、明显无关或信息不足的证据保持本地路径；
- prompt injection、credential-like、`riskLevel=high` 或 `safeForPrompt=false` 必须 zero-call。

固定 Verifier 40 case 要用生产 policy 复核 eligibility；controlled Live 已覆盖的 8 个复杂冲突和 4 个 stale/uncertain 是本阶段允许启用的最小范围。若 policy 扩大调用范围，必须先补 paired Live 证据。

### 2. Web server-only runtime composition

Web 新增 `server-only` composition root，复用 `@repo/ai`：

- `createOpenAICompatibleStructuredExecutor()`；
- `createModelAgentRuntime()`；
- `createModelAgentBudget()`。

环境配置复用 `AI_PROVIDER_MODE`、`AI_ENABLE_LIVE_CALLS`、`AI_MODEL`、`AI_BASE_URL`、`DEEPSEEK_API_KEY` / `OPENAI_API_KEY`，新增：

- `ROUTER_MODEL_ENABLED`；
- `KNOWLEDGE_VERIFIER_MODEL_ENABLED`；
- `ROUTER_MODEL_TIMEOUT_MS`，固定约束范围并默认 5000；
- `KNOWLEDGE_VERIFIER_MODEL_TIMEOUT_MS`，固定约束范围并默认 4000。

两个 Agent 独立开关默认关闭，只有全局 Live 双开关和对应 Agent 开关均为明确 `true` 才允许真实 provider 调用。实施与验收必须在本地 Bun / Docker 环境显式启用它们，证明不是“代码接了但运行仍关闭”。生产部署也必须显式 opt-in，便于单 Agent 回滚。

Structured output 固定使用 Phase 6.9.4.3 已完成 28/28 的 `json_object` 路径，canonical Zod 仍是最终权威；本阶段不重新启用失败过的 DeepSeek strict-tool 路径。API key、base URL 和 executor 只存在于 server-only 模块，不进入 Client Component、响应 body 或浏览器 bundle。

Router 与 Verifier 使用独立 runtime timeout，但共享同一个请求级预算初值：

```text
maxCalls=2
maxInputTokens=2400
maxOutputTokens=800
```

Router envelope 返回的 budget snapshot 传给 Verifier；Router zero-call 时预算不变，Router attempted 时 Verifier 只能使用剩余额度。最终 Chat 模型的 context/output budget 与 Agent candidate budget 分离。

### 3. 异步 Router 生产编排

保留现有同步 `buildChatAgentDecision()` 作为 deterministic 单元和兼容入口，新增异步生产 wrapper。它先生成 deterministic route，再调用 Router candidate adapter，并返回：

- canonical `ChatAgentDecision`；
- Router observation；
- 供 Verifier 继续使用的 budget snapshot。

模型只能建议白名单 route。`requiresRag`、`requiresHumanApproval` 等权限位必须继续由 candidate adapter 的 canonical route map 重建；模型不得返回或覆盖权限字段。Router timeout 为 5 秒，传播 `req.signal`，失败立即使用 deterministic route。

### 4. Verifier 生产编排

`searchKnowledgeForChat()` 保持账号级 RAG API 与 SafetyGuard 顺序，在获取并校验搜索结果后：

1. 生成 deterministic verifier result；
2. 对原始 hits 计算 eligibility；
3. 所有结果进入 Verifier candidate adapter；
4. adapter 只截取稳定排序后的最多 4 个 chunk、每段最多 600 code points；
5. 模型结果通过 strict discriminated union 后，由本地模板重建 reason、notice 和 promptAddition；
6. `selectRagHitsForPrompt()` 与最终 citation 过滤仍由本地安全逻辑决定。

模型失败时，deterministic `trusted` 必须收紧为 `suspicious`；不能因为 timeout、schema invalid 或 telemetry unavailable 放行不确定资料。Verifier timeout 为 4 秒，并继续传播 request abort。

### 5. Trace、headers 与成本

Router / Verifier observation 只进入安全元数据：

- `attempted`；
- `disposition`；
- 固定 `reasonCodes`；
- provider-reported usage 或 usage unavailable；
- duration；
- 固定 error / provider failure category；
- budget snapshot。

新增 headers 只包含固定枚举和布尔值，例如：

- `x-prepmind-router-model-attempted`；
- `x-prepmind-router-model-disposition`；
- `x-prepmind-verifier-model-attempted`；
- `x-prepmind-verifier-model-disposition`。

Agent Trace 的 Router / Verifier step 记录 attempted、disposition、duration 和 token 计数。顶层估算成本把 candidate 实际 usage 加入既有最终 Chat 估算，避免看板系统性漏算 Agent 调用；仍明确它是估算值，不替代 provider 账单。

禁止记录：完整 prompt、query、active context、chunk、模型 raw output、provider raw error、key、base URL、token、cookie、用户资料正文或 stack。

## 错误处理

- Agent 独立开关关闭：adapter 仍执行本地安全与 contract 路径，但 runtime invoke 为零；Trace 使用固定 disabled/not-eligible 信号。
- provider 配置不完整：server-only resolver 返回固定 disabled reason，Router deterministic fallback，Verifier restrictive fallback，最终 Chat 继续。
- timeout / abort：Router 回 deterministic；Verifier 保守收紧；不重试，`maxRetries=0`。
- schema / runtime contract invalid：raw output 不进入日志或 prompt，使用既有固定 disposition。
- telemetry unavailable：按 preview reservation 记账，防止同一请求继续超卖。
- Trace API 失败：不阻断 Chat，现有 800ms trace timeout 保持。

## 测试与验收

### 自动化

- `@repo/agent` candidate exports 和 hostile input contract；
- Router 60/60 eligibility expectation；
- Verifier 40/40 eligibility expectation；
- 36 高置信 + 8 Router safety、28 Verifier ineligible/safety 均 zero-call；
- 请求共享预算最多 2 calls / 2400 input / 800 output；
- timeout、abort、schema invalid、runtime throw、usage unavailable 和预算污染；
- route 权限位 canonical rebuild；
- Verifier trusted failure 收紧；
- Web env resolver、server-only composition、异步 Router、RAG Verifier、headers、Trace/cost 脱敏；
- Mock Chat 回归、Web/server lint/test/build/typecheck。

### controlled Live 与 Docker

1. 先用 API/Mock 证明 zero-call 和 fallback，不产生真实费用。
2. 显式开启 Router / Verifier Agent gates，使用 DeepSeek `json_object`。
3. Router 至少覆盖歧义多意图、上下文短指代和 provider timeout fallback。
4. Verifier 使用当前真实 Qwen hybrid RAG，覆盖复杂冲突、stale/uncertain、安全阻断和 restrictive fallback。
5. Trace / headers 只核对固定元数据与 token/duration，不读取敏感正文。
6. Docker server/worker/web 全栈启动；浏览器窗口可见并保持打开，让用户看到真实模型 Chat 路由和资料核对提示。
7. 验收后精确清理本轮账号、文档、trace 和关联任务；不删除 volume、数据库、Redis 或 MinIO。

## 发布顺序与完成标准

实施按以下原子任务推进：

1. package exports + server-only runtime composition，不接 Chat；
2. Router / Verifier eligibility policy 与固定集；
3. 异步 Router 接入；
4. Verifier 接入；
5. Trace / headers / cost；
6. Mock、controlled Live、Docker 与可见浏览器验收；
7. 文档、阶段证据、整体审查、main 复验与推送。

只有以下条件同时满足才标记 Phase 6.9.4.4 完成：生产 Chat 确实出现受控真实 Router / Verifier 调用；所有安全和高置信 case 保持 zero-call；失败降级不阻断 Chat；质量、延迟、预算、usage provenance 和成本边界通过；Docker / 浏览器验收通过；合并 main 后复验并推送远程。

多 Agent + 分层记忆的面试学习博客仍在整个相关阶段全部完成后统一撰写，本任务只同步 Phase 6.9.4.4 的设计、计划、实现与验收证据。
