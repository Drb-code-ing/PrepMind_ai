# Phase 6.9.5 DeepSeek V4 Pro non-thinking V6 根因验证设计

## 1. 决策、状态与范围

本设计只定义下一条 **零网络根因验证与新的独立 V6 controlled-Live
profile**。它不实现 V6、不创建 V6 evidence/once marker、不调用 provider，
也不改变 Review/Planner 或普通 Chat 的任何生产 gate。

截至 2026-07-17，V5 的唯一 provider attempt 已经封存为：

```text
status=invalid_attempted
gate=closed
providerAttemptCount=1
usageKnown=false
diagnosticCode=structured_output
```

其证据位于
`docs/acceptance/evidence/phase-6-9-5-controlled-live-v5-deepseek-v4-pro/`；
其 once marker 已消耗。V1--V5 都是不可修改、不可重跑、不可拼接的历史
profile。V5 既不证明普通 Chat 不可用，也不证明零费用、模型质量失败或生产
gate 可以开启。

本设计的唯一问题是：**在不改变 Review/Planner 权限与确定性事实边界的前提
下，是否能让 DeepSeek V4 Pro 的 JSON candidate request 明确关闭默认 thinking，
并以零网络 wire test 证明它确实到达 provider request body。** 这是对 V5
`structured_output` 的可证伪根因假设，不是“再试一次”的授权。

以下内容明确不在范围内：

- 不回写、解释、删除或重跑 V1--V5 证据；
- 不将 Qwen 作为失败后的自动 fallback；
- 不改全局 Chat、conversation summary、RAG embedding 或 Phase 6.10 memory；
- 不授予模型写 ReviewTask、修改 FSRS/计划/记忆、调用工具或读取其他账号；
- 不在本设计批准前创建 V6 profile、运行 Docker、浏览器或真实模型。

## 2. 已知事实与根因假设

DeepSeek 官方 thinking-mode 指南说明 V4 Pro 默认启用 thinking，并以
OpenAI-compatible 请求字段关闭：

```json
{ "thinking": { "type": "disabled" } }
```

thinking 模式会把推理内容与普通 `content` 分开返回。V5 使用
`deepseek-v4-pro`、`https://api.deepseek.com/v1`、AI SDK JSON-object transport，
但第一条 fact-free canary 在 structured-output 边界关闭；V5 不保存原始响应，
所以不能把该结果误写为已确认的 provider 根因。

本轮零网络检查同时确认了仓库锁定依赖的实际行为：

```text
ai                 4.3.19
@ai-sdk/openai     1.3.24
```

`createOpenAICompatibleStructuredExecutor()` 的普通 JSON 路径调用
`generateObject({ mode: 'json', maxRetries: 0 })`。在此版本中，
`providerOptions.openai` 只映射 SDK 明确识别的 OpenAI 字段；未知
`thinking` 不会进入 Chat Completions body。相同的 local fake transport
证明了以下两点，且没有网络请求：

| 试验 | 观察到的 request body | 结论 |
| --- | --- | --- |
| `providerOptions.openai.thinking` | 没有 `thinking` | 不能使用任意 providerOptions 假装关闭 thinking |
| 受限 custom `fetch` middleware | `thinking={type:'disabled'}` | 可在固定 V6 transport 中精确写入该字段 |

两次 fake request 都同时确认了 `response_format={type:'json_object'}`、无
`tools`、`tool_choice`、`json_schema`，且每次调用使用 `maxRetries=0`。这只证明
本机 SDK wire 行为，不证明模型语义质量或 V6 将成功。

因此有三个候选路径：

1. 通用 `providerOptions`：实现量最小，但本机实验证明该 SDK 版本不会转发未知
   `thinking` 字段，排除。
2. V6 专用、强类型的 AI SDK custom-fetch transport：保留现有
   `generateObject`、Zod、预算、timeout 与 provider error boundary，只在精确的
   DeepSeek V4 Pro config 上拦截并补充一个常量字段。推荐。
3. 另写 direct-fetch runtime：可以构造字段，但会再次偏离实际
   `createOpenAICompatibleStructuredExecutor` 产品路径，且重新承担响应解析边界；
   本轮排除。

## 3. 推荐架构：V6 专用强类型 transport

在 `@repo/ai` 的 `OpenAICompatibleExecutorConfig` 增加一个封闭的配置变体，
而不是读取任意环境变量、provider option 或 JSON 字符串：

```ts
type DeepSeekV4ProNonThinkingJsonConfig = Readonly<{
  provider: 'deepseek';
  apiKey: string;
  baseURL: 'https://api.deepseek.com/v1';
  model: 'deepseek-v4-pro';
  structuredOutputMode: 'deepseek_v4_pro_nonthinking_json';
  schemaProfiles?: never;
}>;
```

普通 `json_object` 和历史 `deepseek_strict_tool` contract 保持原样。只有这一
literal config 能创建 `createDeepSeekV4ProNonThinkingFetch()`；其他 provider、
URL、模型、mode、schema profile 或动态 option 都在 executor 构造前
`INVALID_MODEL_PROVIDER_CONFIG` 失败。

推荐的数据流如下：

```text
ReviewAgent / PlannerAgent (default gates false)
  -> resolveReviewPlannerLiveExecutorConfig()
  -> deepseek_v4_pro_nonthinking_json (only exact V4 Pro + /v1)
  -> createOpenAI({ fetch: typedNonThinkingFetch })
  -> generateObject(mode=json, maxRetries=0)
  -> typedNonThinkingFetch validates canonical JSON request
  -> adds only thinking={type:'disabled'}
  -> underlying fetch
  -> AI SDK object parse -> local Zod -> deterministic fact merger
```

`typedNonThinkingFetch` 不是通用 proxy，不能从环境变量接受 field、value、host
或 header。它在转发前必须验证：

- URL 精确为 `https://api.deepseek.com/v1/chat/completions`，无 query、hash、
  username 或 password；
- 方法精确为 `POST`，`init.body` 是可解析的 plain JSON object；
- `model==='deepseek-v4-pro'`；
- `response_format` 只有 `{ type: 'json_object' }`；
- `tools`、`tool_choice`、`functions`、`function_call`、top-level
  `json_schema` 都不存在；
- 原 request 没有 `thinking`，然后才加入唯一的 frozen value
  `{ type: 'disabled' }`。

任一检查不满足都在调用底层 fetch 前抛出已脱敏的 transport failure。wrapper
不记录 request body、prompt、completion、URL、header、API key 或底层错误；
上层继续只暴露既有固定 failure category。若未来 SDK 将 fetch 调用形态从当前的
URL string + `RequestInit` 改为其他形式，wrapper 必须 fail-closed，而不是猜测
如何重写请求。

该 wrapper 仅通过 `createOpenAI` 公共 `fetch` middleware capability 注入；它不
monkey-patch SDK、不改全局 `fetch`，也不向普通 Chat provider 传递配置。生产
Review/Planner resolver 可以在精确 V4 Pro + `/v1` 时产生该 typed mode，但两个
业务 gate 保持默认 `false`；因此代码接入本身不会发出调用。

## 4. 权限、通信与失败语义不变

V6 只改变 provider request 的一个固定 transport field。以下链路必须保持本地
权威：

| 责任 | 权威组件 | V6 模型允许做什么 | 不允许做什么 |
| --- | --- | --- | --- |
| 账号与数据范围 | NestJS + JWT owner scope | 读取当前已投影的只读 facts | 访问数据库、跨账号读取 |
| Review candidate | ReviewAgent local merger | 选择固定弱点索引、diagnosis enum | 生成 FSRS 分数、任务、日期或写库 |
| Planner candidate | PlannerAgent local merger | 选择 block 顺序、受限策略 enum | 创建/修改计划或未来 ReviewTask |
| 结构与安全 | Zod + policy/guard | 返回受 schema 约束的 candidate | 绕过 schema、预算、timeout、zero-call guard |
| 最终响应 | deterministic merger/API | 使用已验证 candidate | 把 provider 原文、thinking 或 raw error 返回给浏览器 |

timeout、abort、每次运行的不可变 budget、`maxRetries=0`、正整数 usage、限制性
deterministic fallback 与脱敏 Trace contract 不变。任何 wrapper failure、provider
failure、schema invalid、usage invalid 或预算耗尽都只返回原有 deterministic
suggestion；不能切换到 Qwen、不能启动其它 agent、不能开启 business gate。

## 5. 零网络实现与测试门

在新的 V6 profile 或任何真实调用前，实施必须先完成下列无凭据测试。测试可用
fake fetch 返回固定 JSON，但不得使用真实 endpoint、真实 key、Docker、浏览器
或账号数据。

1. **配置封闭性**：只接受 exact DeepSeek `/v1` + `deepseek-v4-pro` + 新 mode；
   错误 host、path、model、provider、trailing variant、schema profile 和动态
   option 都不创建 provider。
2. **真实 SDK wire**：以当前 `createOpenAI` 和 fake underlying fetch 执行
   `generateObject(mode='json')`；断言最终 body 同时具有
   `response_format:{type:'json_object'}` 与
   `thinking:{type:'disabled'}`，且不具有 tools/tool_choice/functions/
   function_call/json_schema。response 只需一个固定 schema-valid object。
3. **拒绝路径**：fake transport 提供错误 URL、错误 method、不可解析 body、
   预置 thinking、非 JSON response_format 或任一 tool field 时，断言 underlying
   fetch 为零次且错误不含 fixture canary、prompt、key 或 URL。
4. **无 retry**：使一次 fake response 无效，断言只有一次 underlying request；
   正常与失败路径都保留 `maxRetries=0`。
5. **普通回归**：原 `json_object`、strict-tool 和其它 provider 的 request body
   不新增 `thinking`，普通 config 的 provider factory contract 不增加可序列化的
   凭据字段。
6. **usage accounting**：CNY cap 始终用 provider 的 aggregate
   `prompt_tokens + completion_tokens`，绝不从 output 中扣除或忽略 reasoning
   token。若 provider 在 future response 中公开一个安全整数
   `reasoning_tokens`，V6 evidence 仅可记录 `reported`/`not_reported` 状态与安全
   整数；若其为正，canary 以 `thinking_not_disabled` 关闭。若该细项不存在，
   不得把它猜成零，也不得放宽 aggregate cap。
7. **脱敏与证据不变性**：fixture canary、prompt、候选、raw response、key、URL
   和 header 不能进入 errors、Trace、stdout 或 evidence。V1--V5 evidence tree 与
   once marker 的 full SHA-256 snapshot 在 test 前后逐字节一致。

第 6 条的关键是费用上限的保守性：即使 provider 对 reasoning detail 不透明，
V6 仍以返回的完整 completion aggregate 计费；不以“thinking 已请求关闭”推导
零 reasoning 使用或较低账单。供应商账单仍是最终计费事实。

## 6. 未来 V6 profile（尚未创建）

只有在实现、Mock、独立代码复审和用户确认后，才能创建下列新的 lineage。它和
V5 同样的测试集与 cap 是为了可比较性，不代表重试 V5：

```text
profile:      phase-6.9.5-review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking
schema:       phase-6.9.5-review-planner-controlled-live-evidence-v6-deepseek-v4-pro-nonthinking
directory:    docs/acceptance/evidence/phase-6-9-5-controlled-live-v6-deepseek-v4-pro-nonthinking
marker:       .review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking.once
confirmation: --confirm-controlled-live-v6-deepseek-v4-pro-nonthinking
```

V6 preflight 必须同时要求：

```text
AI_PROVIDER_MODE=live
AI_ENABLE_LIVE_CALLS=true
REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V6_ENABLED=true
AI_MODEL=deepseek-v4-pro
AI_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=<existing canonical credential>
REVIEW_AGENT_MODEL_ENABLED=false
PLANNER_AGENT_MODEL_ENABLED=false
```

它沿用用户已批准的 CNY 价格快照和严格上限，但在实现时要重新将该 profile 写死：

```text
provider calls: 1 canary + at most 22 eligible cases = 23
zero-call cases: 26
reserved input:  42,996
reserved output:  9,712
price: CNY 3 / 1M input, CNY 6 / 1M output
worst-case estimate: CNY 0.18726
hard cap: CNY 1.00
```

V6 首先 snapshot V1--V5 的目录和 marker；preflight、历史完整性或 typed
transport check 在 provider 前失败时，`providerAttemptCount=0`。只有成功的
fact-free canary（canonical JSON、正安全整数 aggregate usage、no reported positive
reasoning tokens）才可在同一进程运行一次 frozen 48-case paired evaluation。任何
失败都封存 V6 并停止，不能重跑 V6 或把其计数与任一历史 profile 拼接。

V6 complete 仍需：48 entries、26 verified zero-call、22 runtime attempts、100%
strict schema、0 critical、语义分数至少 90%、P95 不高于 4.5s、合法 usage、CNY
estimate 不高于 1.00。达到这些并不自动开启产品 gate；之后还必须有单独批准的
Docker API、可见浏览器 `/plan` 与 `/today`、仅合成数据清理、main merge
revalidation 和 remote push。

## 7. 执行顺序与人工关口

1. 用户审阅本设计；批准后才写具体 implementation plan。
2. 在新 feature commit 中做零网络 typed transport、配置接入和上述 tests；所有
   business gate 维持 `false`。
3. 运行 Mock、静态、Agent/AI/Server/Web test/build 与 Compose config；独立复审。
4. 将 V6 的 fixed price/cap、evidence schema、hash protection、once-only CLI 和
   safe summary implementation 完成并独立复审。
5. 仅在用户明确批准一条新的 V6 controlled-Live 后，执行一次 exact confirmation。
6. 只有 V6 quality/latency/cost/evidence 全部通过，才向用户申请后续 Docker 与可见
   浏览器验收；浏览器保持打开，两个 gate 在验收后恢复 `false`。

因此，下一次应由用户确认的是“是否同意按这个 V6 专用 non-thinking transport
设计写 implementation plan”，而不是“是否现在调用 DeepSeek”。

## 8. 验收问题索引

- 为什么不能只在 `.env` 中添加一个 thinking 开关？
  - 因为 SDK 不会转发未知 `providerOptions`，动态字段还会扩大 provider 侧权限面；
    V6 仅接受一个编译期固定的值。
- V6 是否会修改现有 Chat 或把 Review/Planner 业务 gate 打开？
  - 不会。它只给 exact V4 Pro Review/Planner candidate transport 增加一条默认关闭的
    typed path。
- 为什么 `reasoning_tokens` 缺失不能按零计算？
  - 缺失只是未报告；费用上限依然使用完整 aggregate completion tokens。
- 为什么 V6 还需要新的 marker 和全部历史 hash？
  - 它是与 V5 独立的受控实验，必须能证明没有覆盖历史 evidence，也必须防止自身
    失败后被静默重跑。

## References

- DeepSeek thinking-mode guide: <https://api-docs.deepseek.com/guides/thinking_mode>
- DeepSeek pricing guide: <https://api-docs.deepseek.com/quick_start/pricing>
- Current V5 closure: `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`
- Current shared executor: `packages/ai/src/model-agent-provider.ts`
