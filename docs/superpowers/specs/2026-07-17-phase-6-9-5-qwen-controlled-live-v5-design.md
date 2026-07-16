# Phase 6.9.5 Review / Planner Qwen controlled-Live v5 设计

## 1. 决策与范围

ReviewAgent / PlannerAgent 尚未通过真实模型验收。v1、v2、v3、v4 四个
DeepSeek controlled-Live profile 都已经各自消耗了一次 provider attempt，并以
`invalid_attempted / structured_output / gate=closed` 终局关闭。v3/v4 额外记录的
受信内部 stage 是 `provider_json_parse`。它们是历史事实，不能删除、重跑、覆盖、
拼接，或作为 48-case / Docker / 浏览器验收的替代证据。

本设计提出一个**独立的 Qwen Chat v5 profile**。它的目的不是“再试一次
DeepSeek”，也不是给 Review/Planner 增加任意供应商 fallback；而是在不读取现有
`.env`、不调用 provider、也不修改业务代码的前提下，先设计一个能独立验证
OpenAI-compatible JSON 路径的最小候选。

v5 仍然只允许模型在本地确定性事实快照中选择 Review 弱点索引/诊断枚举，或重排
Planner 已有 block/选择策略枚举。JWT owner、事实聚合、FSRS、分钟数、链接、预算、
写操作、schema、权限和所有 fallback 继续由本地代码权威控制。它不进入 Phase 6.10
记忆、MCP 或任何写入型 Agent。

## 2. 已知事实、根因假设与不作的推断

### 已知事实

- v2 已把受控 Review canary 改为满足 canonical candidate schema 的无事实请求；
  v4 又完成了封闭式 fenced-JSON 归一化与 provenance 边界复审。
- v3/v4 仍在 provider 边界后以 `provider_json_parse` 关闭。每次都保留了原子、
  脱敏 evidence，且 `providerAttemptCount=1`、`usageKnown=false`；这绝不是
  zero-call、零费用或质量失败的结论。
- 仓库已有用于 RAG embedding 的 Qwen 配置和 `QWEN_API_KEY` 兼容读取路径，但目前
  没有已验收的 Qwen Chat model、Chat base URL、JSON-mode contract 或 Qwen Chat
  价格快照。本设计没有读取根 `.env`，因此也不声称 credential、模型权限或余额有效。

### 当前最强但未证实的假设

1. 连续的 `provider_json_parse` 更像是 DeepSeek Chat 响应在现有受信 adapter 的
   JSON 解析边界不兼容，而不是 Review/Planner 事实、权限、evidence I/O 或已修复的
   v1 local schema probe 问题。
2. 由于原始 provider body 按安全合同被丢弃，不能把该分类进一步断言为“模型没有
   生成 JSON”“某个 SDK bug”“余额问题”或“DeepSeek 服务故障”。
3. 使用独立、显式配置的 Qwen Chat JSON-object path 可以检验 provider/model
   compatibility 是否是关键变量；它不会证明四次 DeepSeek closure 的精确原因。

因此，v5 的结果只能说明新的 Qwen profile 是否通过自己的质量、安全、成本和产品
验收。无论成功或失败，都不得反向改写 v1--v4 的结论。

## 3. 需要操作者确认的输入（当前阻止实施和 Live）

在写任何 v5 实现或启动一次 provider 调用前，操作者需要提供下表中的完整、可复核值。
之前提供的 Qwen embedding 配置或 API key 不能代替这些 Chat 决策。

| 决策 | 必须提供的精确值 | 原因 | 建议 |
| --- | --- | --- | --- |
| Chat model | 一个供应商当前支持的完整 `QWEN_CHAT_MODEL` 标识 | 模型名决定 JSON 支持、价格和审计身份 | 不使用默认值，也不从 `AI_MODEL` 推断 |
| Chat endpoint | `QWEN_CHAT_BASE_URL` 的官方 OpenAI-compatible HTTPS 根 URL 和部署区域 | DashScope 区域/兼容端点会影响授权与计费 | 仅接受选定官方 host 的精确 `/compatible-mode/v1` 根，不接受 proxy/自定义 host |
| JSON 支持 | 该 model + endpoint 支持 Chat Completions `response_format: { type: "json_object" }` 的官方资料链接或截图 | `mode: 'json'` 是 v5 的唯一 structured transport，不可凭 embedding 支持推断 | 必须与 model/region 同一价格页或产品页对应 |
| 价格快照 | 非缓存 input/output 单价、货币、计量单位、适用上下文/缓存条件、来源日期和来源链接或截图 | 受控 Live 必须在 provider 前计算最坏成本，不能把未知单价写成 0 | 以精确 model/region 的公开价格为准；若原始货币不是 USD，还需换汇来源/日期 |
| 总费用上限 | 此 v5 canary + 最多 22 条 eligible case 的总 USD 上限 | 价格已知仍需要独立的支出授权 | 建议先采用 USD 0.10；这是新授权，不复用其他阶段的历史 cap |

价格 profile 不接受环境变量中的任意浮点数。实施时应把操作者确认的快照以一个
版本化、审查过的 profile 写进 `@repo/ai`，包括 model identity、input/output
USD-per-million、来源日期、缓存前提和原始货币换算依据。环境变量只能选择 profile
ID，不能临时篡改单价。这样不会把 token 成本从“集中、可回归的估算”退化为不可审计的
运行时数字。

对于当前固定上限，provider 前的 worst case 为一条 canary 加 22 条 eligible case：

```text
maxInputTokens  = 96 + 22 * 1950 = 42,996
maxOutputTokens = 32 + 22 * 440  = 9,712
maxCostUsd = 42,996 / 1,000,000 * inputUsdPerMillion
           + 9,712 / 1,000,000 * outputUsdPerMillion
```

若价格 profile 缺失、model/profile 不精确匹配、货币换算依据缺失，或上式超过已确认
cap，v5 preflight 必须在 provider 前关闭，`providerAttemptCount=0`。

## 4. Qwen Chat 的显式、无 fallback 配置

v5 不能复用或重解释 `AI_MODEL`、`AI_BASE_URL`、`DEEPSEEK_API_KEY`、
`OPENAI_API_KEY`、`Qwen_API_KEY` 或 `DASHSCOPE_API_KEY`。这些变量仍可由现有
Chat、summary 或 embedding 链路按自己的既有 contract 使用，但不参与 v5 Qwen Chat
选择。

v5 仅读取下列 allowlist，空值、未知值或任一不匹配均 fail-closed：

```text
AI_PROVIDER_MODE=live
AI_ENABLE_LIVE_CALLS=true
REVIEW_PLANNER_LIVE_PROVIDER=qwen
QWEN_CHAT_ENABLED=true
QWEN_CHAT_CONTROLLED_LIVE_V5_ENABLED=true
QWEN_CHAT_MODEL=<operator-confirmed exact model>
QWEN_CHAT_BASE_URL=<operator-confirmed exact official compatible root>
QWEN_CHAT_PRICE_PROFILE=<operator-confirmed versioned profile id>
QWEN_API_KEY=<canonical Qwen Chat credential only>
REVIEW_AGENT_MODEL_ENABLED=false
PLANNER_AGENT_MODEL_ENABLED=false
```

规则如下：

- `REVIEW_PLANNER_LIVE_PROVIDER` 没有默认值；其值不是精确 `qwen` 时，v5 不能构造
  Qwen executor。Qwen 不能因 DeepSeek/OpenAI 缺失而被自动选择，反之亦然。
- `QWEN_CHAT_ENABLED` 与 v5 controlled-Live gate 都默认 `false`。两者均为 `true`
  仍不等于业务启用；它只允许独立 v5 command 在一次性 profile 内检查。
- Qwen Chat 只接受 canonical `QWEN_API_KEY`。为了避免 embedding 的历史兼容 alias
  意外打开 Chat，`Qwen_API_KEY`/`DASHSCOPE_API_KEY` 对 v5 一律无效。
- `QWEN_CHAT_BASE_URL` 必须是无 username/password/query/fragment 的 HTTPS URL，且归一化
  后精确匹配操作者批准的 DashScope-compatible root。实现不得把任意 `*.aliyuncs.com`、
  OpenAI-compatible proxy 或 `AI_BASE_URL` 当作等价端点。
- `QWEN_CHAT_MODEL` 必须等于价格 profile 的 model identity。即使格式安全但无法匹配
  profile，也不能调用 provider。
- 业务生产启用仍需要独立的
  `REVIEW_AGENT_MODEL_ENABLED=true` / `PLANNER_AGENT_MODEL_ENABLED=true`。在 v5
  diagnostic 和 48-case Live 中这两个 gate 必须为 `false`；只有后续 Docker product
  验收才在 **server 容器** 短暂设置所需的一个或两个 gate，并在完成后恢复 `false`。

该设计避免修改全局 Chat 的 provider 选择。Qwen v5 的 configuration parser 和
executor factory 是 Review/Planner 专用的窄入口；它不通过泛化“按 hostname 猜 provider”
的路径，也不因现有全局 live env 校验而偷偷取用 DeepSeek/OpenAI credential。

## 5. 严格 OpenAI-compatible JSON transport

v5 使用一个明确 provider 为 `'qwen'` 的 OpenAI-compatible structured executor。
它不是把 `createOpenAI` 的任意 endpoint 配置开放给生产调用。

请求固定满足：

```text
Chat Completions + response_format: { type: "json_object" }
AI SDK mode: "json"
maxRetries: 0
no tools, no tool_choice, no json_schema, no search/tool extension
canonical REVIEW_MODEL_CANDIDATE_SCHEMA / PLANNER_MODEL_CANDIDATE_SCHEMA
```

`json_object` 仅要求 provider 返回 JSON；canonical Zod schema 仍然负责字段、长度、
索引、去重、枚举和跨字段约束。本地 merger 仍从原始 deterministic snapshot 重建事实，
所以一个合法但不合语义的 Qwen JSON 只能触发安全 fallback，不能决定分钟数、FSRS、链接、
任务或写入。

V5 不应复用 v4 的 `createFirstPartyDeepSeekV4Runtime` 或其 direct-fetch 适配器。它应有
单独的、provider typed 的 `createFirstPartyQwenChatRuntime`，其唯一 transport 是上述
JSON-object wire。底层 OpenAI-compatible executor 扩展 `provider: 'qwen'` 这一封闭
union；不得用 `'openai'` 冒充 Qwen，也不得添加一个泛型 `'custom'` provider。

所有 provider failure 继续仅映射为现有的 bounded category/stage。stdout、Agent Trace、
HTTP、browser、evidence 和文档都不得包含 prompt、模型 JSON、raw provider error、URL、
status/header、key 或 stack。成功路径必须有 provider-reported 正 input 与 output usage；
未知 usage、负数、越界、schema invalid、timeout 或取消都关门并回退。

## 6. v5 profile、一次性 evidence 与执行顺序

v5 是新的 lineage，而非 v4 retry。它需要独立、严格的 profile descriptor：

```ts
const CONTROLLED_LIVE_V5_QWEN_PROFILE = {
  id: 'phase-6.9.5-review-planner-controlled-live-v5-qwen',
  evidenceSchemaVersion:
    'phase-6.9.5-review-planner-controlled-live-evidence-v5-qwen',
  evidenceDirectory:
    'docs/acceptance/evidence/phase-6-9-5-controlled-live-v5-qwen',
  onceLockLeaf: '.review-planner-controlled-live-v5-qwen.once',
  providerId: 'qwen',
} as const;
```

v5 reservation 继续使用既有的 Windows HANDLE-relative/no-reparse writer。在只写入新的
v5 目录之前，它必须校验每个 v1--v4 evidence 与 once marker 的 hash。junction、
parent/root swap、意外文件、lock conflict、preflight failure、writer/finalizer failure
都必须是 zero provider call，且绝不遗留根目录外文件。

持久化的 safe summary 可以标识固定 `providerId: 'qwen'` 与已批准的
`pricingProfileId`；不得包含 base URL、credential、prompt、output、raw error、
headers、stack 或用户事实。完成的 48-case report 可以保存安全计数、p95、
`pricingKnown`、`costWithinCap` 和有界数值 token/cost estimate。`invalid_attempted`
记录或缺失 usage 都不得被转写为 zero cost。

唯一允许的顺序是：

1. 在没有 provider credential 的情况下运行 no-network tests，验证 Qwen config parser、
   canonical-key rule、精确 endpoint/profile binding、JSON-object wire shape、
   model/profile/cost mismatch rejection、stage containment、native evidence races、
   v1--v4 hashes 以及 default-off UI。
2. 生成普通的 48-case Mock report。它仍是 `mock_quality_not_evidence`；这一步不允许
   任何 Qwen provider call。
3. 取得独立 spec 与 quality approval，确认 section 3 的表格、工作树 clean 且没有
   v5 lock/evidence，之后才能以精确的 v5 confirmation argument 启动一个子进程。
4. 在构造 Qwen executor 前 reserve v5 evidence。仅进行一次无事实 JSON canary
   （`96` input / `32` output token reservation、`4500 ms`、zero retries）。若它没有
   complete 且正数 verified usage，finalize v5 为 closed 并停止。
5. 只有 complete canary 才能在同一 v5 process 中运行一次 frozen 48-case Live evaluator。
   26 条 zero-call cases 仍为 zero provider calls；余下 22 条每条最多一次调用，并保持
   既有 `1950 / 440` budget 与 `4500 ms` limit。
6. 只有既有 report 达到 `quality_gate_passed` 才继续：48 entries、26 条 zero-call
   boundaries 完整、strict schema rate 100%、semantic rate 至少 90%、critical failures 0、
   p95 不超过 4500 ms、usage/cost 可验证，且 cost 在预批准 cap 内。
7. 只有此后才执行 Docker authenticated suggestions/`/plan` 和 visible-browser acceptance。
   Qwen Chat config 与 business gates 只临时投影到 server container；Web 与 worker 不接收
   Qwen Chat model/base/price/gate。之后恢复两个 business gates 为 false，并精确删除仅有的
   synthetic account/Trace data。

任一不通过的分支都是 v5 terminal。它不能重跑，也不能授权 v6；除非先完成另一个独立、
no-network 的 root-cause design 与 review。

## 7. 最小实现面与离线验证策略

本次仅新增本设计文档，不修改下列代码。后续实施最小应涉及：

| 范围 | 预期职责 |
| --- | --- |
| `packages/ai/src/model-agent-provider.ts` | 将 provider union 封闭地扩展为 `qwen`，保持 JSON-object wire 和零 retry；不加入 custom/proxy provider。 |
| `packages/ai/src/first-party-qwen-chat-runtime.ts` | 新建 Qwen-only typed runtime，拒绝非精确 model/base/profile。 |
| `packages/ai/src/ai-cost-estimator.ts` 及测试 | 加入操作者批准、版本化的 Qwen Chat 价格 profile；未知或不匹配价格 fail-closed。 |
| `apps/server/src/review-agent/review-planner-qwen-config.ts` 及测试 | 独立 allowlist parser，读取 canonical Qwen Chat 配置，不借用全局 DeepSeek/OpenAI vars。 |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v5-qwen-*` | 新 profile 的 evidence, factory, CLI, script, strict confirmation 与 once-only sequence。 |
| `apps/server/src/review-agent/review-planner-model-config.ts`、module 及测试 | 只在 v5 quality 通过后增加显式 `qwen` 生产选择；保持 server-only and default-off。 |
| `apps/server/src/config/env.ts`、`docker/docker-compose.dev.yml` 及 compose/readiness tests | 仅将 Qwen Chat allowlist 投影到 server；现有 embedding Qwen 配置不变，worker 不接收 Chat gate/base/model/price。 |
| `apps/web` model-status tests | 保持安全的 applied/degraded bounded status，不展示模型文本或 provider diagnostics。 |
| acceptance/DEVLOG/roadmap/data-flow 文档 | 只在实际终局证据产生后更新；不得提前宣称 v5 通过。 |

建议的最小离线门不需要读取真实 `.env` 或网络：

- fake executor 断言 Qwen request 是 `mode: 'json'`，具有 `maxRetries: 0`，没有
  tools/tool-choice/schema extension；canonical Zod 仍拒绝非法 object；
- allowlist tests 证明 `AI_MODEL`、`AI_BASE_URL`、DeepSeek/OpenAI keys 和 embedding
  aliases 均不能选择 Qwen Chat；canonical `QWEN_API_KEY` 缺失时零 executor；
- price tests 证明 model/profile mismatch、unknown model、缺少换汇 metadata 和超 cap
  都在 provider 前失败；
- v1--v4 real artifact byte-hash tests、v5 junction/root/ancestor swap/recovery race tests
  证明新 profile 既不改历史也不向根外写入；
- CLI tests 覆盖错误 confirmation、任何 gate false、已有 v5 lock/evidence、未验证 usage、
  canary failure、48-case failure 和第二次调用，全部零额外 attempt；
- full Agent/AI/Server/Web static tests、Compose `config --quiet`、fresh Mock report、
  forbidden-content scans和独立 spec/quality review 全部通过后，才可以请求一次 v5 Live
  授权。

## 8. 非目标与后续决策

- 不把 Qwen embedding 的可用性当作 Chat JSON-mode 验收。
- 不从环境变量接受 arbitrary provider、模型、URL 或单价；不引入 automatic
  DeepSeek/OpenAI/Qwen fallback。
- 不重跑 v1--v4，不修改其 evidence/once markers，也不扩大 timeout/token budget/重试。
- 不在 v5 通过前改变 `REVIEW_AGENT_MODEL_ENABLED` 或
  `PLANNER_AGENT_MODEL_ENABLED` 的默认 `false`。
- 不新建 Git 分支：本设计应提交到当前
  `codex/phase-6-9-5-review-planner-live-diagnostics` 分支。只有在 v5 design 获批并
  准备实施时，才由主任务按“从最新 main 开新分支”的仓库规则决定后续分支；不得从当前
  feature branch 再嵌套开分支。

在操作者给出 section 3 的 model、endpoint、JSON 支持和价格/cap 决策前，正确状态是：
Qwen v5 **仅完成离线设计，未实施、未授权、未调用**；Review/Planner 的 production
gate 仍保持关闭。
