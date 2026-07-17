# Phase 6.9.5 DeepSeek V4 Pro usage recovery V7 设计

## 1. 决策与当前结论

ReviewAgent / PlannerAgent 的确定性只读业务功能、受限模型候选、owner-scoped facts、本地 merger、预算、超时、降级和 UI 状态已经实现；真实模型质量和产品可用性仍未通过。V1--V6 都是独立且不可重跑的 terminal profile。V6 最终只记录：

```text
state=finalized
status=invalid_attempted
gate=closed
providerAttemptCount=1
usageKnown=false
diagnosticCode=usage_unverifiable
```

零网络追踪确认一个与该结果完全一致的代码缺陷：V6 canary 把 `estimatedInputTokens=96` 同时当成 provider 实际 input usage 的硬上限。AI SDK 会把 structured-output schema 一并发送给 provider，实际 input usage 可以合法地大于工程预估。仓库已有权威规则明确规定“工程输入估算只用于调用前预留，不能把更大的真实 provider input usage 误判为越界”。

离线 fixture 已复现：当 executor 返回合法 object、non-thinking audit 和 `inputTokens=97 / outputTokens=4` 时，V6 仍错误关闭为 `usage_unverifiable`。这证明当前 validator 有误；由于 V6 evidence 不保存 token 或细分 stage，不能反向断言 V6 当时一定就是 97+ token，也不能把本地复现改写成历史 provider 事实。

V7 采用最小修复：保留与生产一致的 OpenAI-compatible non-thinking executor，拆开 preview reservation 与 provider telemetry 语义，并在现有 response audit 中增加不含数值的 usage shape 枚举。V7 不创建第三种 transport。

本设计不授权 provider 调用，不创建 V7 marker/evidence，不运行 48-case、Docker 或浏览器，也不改变两个产品 gate。

## 2. 为什么之前耗时过长

V1--V6 的 once marker、费用上限、历史不可变验证和脱敏 evidence 避免了重复计费、证据改写与敏感信息泄漏，这些工程边界有效。但 V5/V6 的排障重点集中在 schema、JSON mode 和 thinking transport，没有及时复核 canary usage validator 是否遵守共享 runtime 已建立的 preview/actual parity：

```text
estimatedInputTokens = 96
provider input usage = 必须为正安全整数，但允许大于 96
provider output usage = 必须为正安全整数且不得超过 maxOutputTokens
global observed usage/cost = 必须落在整轮 reservation 与 CNY hard cap 内
```

V6 把第一、第二行错误合并，随后 evidence 又只保留 `usage_unverifiable`，导致诊断分辨率不足。正确的后续不是替换 provider 或 transport，而是先修复这个已复现的 contract 违例，并确保未来失败能区分 provider usage shape 与 SDK normalization。

## 3. 方案比较

### 方案 A：只放宽 96-token 上限

删除 `actualInput <= estimatedInput` 即可修复已复现问题，改动最小。但若 provider 真正缺 usage，V7 仍只得到同一个 `usage_unverifiable`，无法判断 provider payload 与 SDK normalization 的边界。

### 方案 B：改用第一方 direct-fetch executor

可以直接控制 raw payload，但会同时改变 transport、错误分类和生产 composition，增加不必要变量。现有 OpenAI-compatible executor 已通过标准 `prompt_tokens/completion_tokens` fake-fetch 回归，没有证据表明必须替换。

### 方案 C：预算语义修复 + 安全 usage-shape audit（采用）

保留 V6 的 exact DeepSeek V4 Pro non-thinking executor；修复 canary 对 provider input usage 的错误上限，同时让现有 cloned-response audit 只增加固定 `usageState`：

```text
missing
invalid
positive
```

该枚举不保存 token 数值、response、content、URL、header 或错误正文。V7 evaluator 用 raw usage state 与 ModelAgentRuntime 结果对账：

- raw `positive` + runtime success：正常使用 runtime 的正 token；
- raw `positive` + runtime `invalid_response`：固定为 `sdk_usage_lost`；
- raw `missing`：固定为 `provider_usage_missing`；
- raw `invalid`：固定为 `provider_usage_invalid`；
- runtime success 但 actual input 大于 preview：允许继续，但纳入整轮 observed usage/cost；
- actual output 超过 request cap、aggregate 超过 reservation 或 CNY hard cap：fail-closed。

这样既修复已确认的本地缺陷，也避免下一次 profile 再留下无法区分来源的 generic evidence。

## 4. Contract 变更

### 4.1 Non-thinking response audit

修改：

```text
packages/ai/src/model-agent-deepseek-v4-pro-nonthinking.ts
packages/ai/tests/model-agent-deepseek-v4-pro-nonthinking.test.ts
```

`DeepSeekV4ProNonThinkingAudit` 在现有 reasoning 字段之外新增 `usageState`。解析规则：

- 没有 plain-object usage，或缺少 `prompt_tokens` / `completion_tokens`：`missing`；
- 任一字段不是正安全整数：`invalid`；
- 两者均为正安全整数：`positive`。

callback 仍只接收冻结的 data-only object。它不携带真实 token 数值；actual token 仍只通过 `StructuredModelExecutor -> ModelAgentRuntime` 的既有 contract 返回。

### 4.2 Canary usage validator

V7 validator 固定规则：

```text
inputTokens  > 0 safe integer
outputTokens > 0 safe integer
outputTokens <= canary maxOutputTokens
inputTokens  <= V7 full-run reservedInputTokens
canary actual cost <= full-run hard cap
```

不得比较 `inputTokens <= estimatedInputTokens`。paired evaluation 结束后，再用 canary + 22 runtime cases 的 provider-reported aggregate 检查 full-run input/output reservation 与 CNY hard cap。

`ModelAgentRuntime` 继续保留调用前不可变 preview reservation；provider usage 大于 preview 不回写或放大已冻结 budget，也不授权额外调用。telemetry 不可验证仍 fail-closed。

### 4.3 V7 安全诊断

V7 terminal diagnostic strict union 至少包含：

```text
transport
structured_output
thinking_not_disabled
provider_usage_missing
provider_usage_invalid
sdk_usage_lost
output_limit_exceeded
usage_reservation_exceeded
cost_limit_exceeded
```

失败 evidence 只保存 diagnostic，不保存 token/cost；complete evidence 才允许保存正 aggregate input/output tokens、冻结 price profile、CNY cost 与 quality counters。

## 5. V7 profile、evidence 与权限

V7 是新的 lineage，不是 V6 retry：

```text
phase-6.9.5-review-planner-controlled-live-v7-deepseek-v4-pro-usage-parity
```

V7 必须拥有独立 schema、目录、once marker、CLI confirmation 和费用 reservation。V1--V6 的目录、文件和 marker 在 reserve、executor 构造、provider 前与 finalization 后执行 existing-only、no-reparse SHA-256 snapshot；任何增删改或 reparse 都在 provider 前 fail-closed。

Review/Planner 权限保持不变：

- 输入只来自当前 JWT owner 的确定性 snapshot；
- Review 只能选择已有 weakness index 与 diagnosis enum；
- Planner 只能选择已有 block order 与 strategy enum；
- facts、FSRS、分钟数、deadline、链接、写权限和本地 merger 仍由 Nest 权威代码决定；
- suggestions API 保持只读，不创建或修改 ReviewTask、Card、ReviewLog、ReviewPreference、WrongQuestion 或 deck；
- `REVIEW_AGENT_MODEL_ENABLED=false` 与 `PLANNER_AGENT_MODEL_ENABLED=false` 继续为默认值。

## 6. TDD 与执行顺序

implementation 必须按以下任务逐个 RED/GREEN/commit：

1. 先新增失败回归：合法 provider `inputTokens=97` 不得被 96-token preview 拒绝；确认当前实现 RED；
2. 扩展 non-thinking audit 的 `usageState`，覆盖 missing/invalid/positive，且不暴露实际数值；
3. 新增 V7 validator/factory，允许 actual input 超 preview，仍限制 output、aggregate reservation 与 CNY cap；
4. 新增 V7 safe diagnostic schema、immutable V1--V6 evidence tree 与 once marker；
5. 新增一次性 V7 CLI，顺序固定为 preflight -> snapshot -> reserve -> recheck -> one canary -> paired only on success -> terminal seal；
6. 运行 48-case Mock：26 verified zero-call、22 runtime、48 strict、0 critical，结论仍为 `mock_quality_not_evidence`；
7. 同步 AGENTS、DEVLOG、roadmap、acceptance、data-flow 与 AI behavior docs；
8. 两轮独立复审和完整离线门禁；
9. 停止并等待用户单独授权 V7 controlled-Live。

关键测试还必须覆盖：

- `inputTokens=96/97/大于 preview 但小于 reservation` 均按真实 usage 计费；
- input 缺失/零/负数/小数、output 缺失/零/负数/小数/超 cap；
- raw positive 但 runtime missing -> `sdk_usage_lost`；
- raw missing/invalid 与 reasoning violation 的独立诊断；
- actual aggregate 超 reservation、CNY 超 cap；
- timeout、abort、one fetch、zero retry；
- prompt、response、token value、credential、URL、header、stack 不进入失败 evidence；
- V1--V6 历史增删改、reparse、duplicate marker、并发 finalizer 与 no-overwrite；
- default gates、Docker allowlist 与 Web/worker 不接收 Review/Planner gate。

离线门禁至少包含：

```powershell
bun --filter @repo/ai test
bun --filter @repo/ai typecheck
bun --filter @repo/ai lint
bun --filter @repo/agent test
bun --filter @repo/server test
bun --filter @repo/server lint
bun --filter @repo/server build
bun --cwd packages/types typecheck
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker config --quiet
git diff --check
```

这些门禁只证明工程 contract，不证明真实模型质量。

## 7. 未来 controlled-Live 与生产验收

V7 离线实现、Mock、文档和两轮独立复审全部通过后，仍需用户再次单独授权。设计批准、代码批准、存在 API key 或此前 V6 授权都不等于 V7 Live 授权。

未来获批的唯一 V7 命令最多执行：

```text
1 fact-free canary + 22 paired runtime cases = 23 provider attempts
```

保留 DeepSeek V4 Pro 非缓存价格快照和 CNY `1.00` hard cap；implementation plan 必须重新计算 fixed reservation。canary 只有在 schema、reasoning、raw usage state、runtime usage、output cap 与成本同时通过后，才可在同一进程进入 paired evaluation。

任一门失败都封存 terminal evidence，并停止 Docker/浏览器/main/push。完整 controlled-Live 通过仍不自动打开产品 gate；后续必须再经用户批准，逐组件临时开启 gate，完成 authenticated suggestions/plan、Trace、可见浏览器、精确清理、main 复验和远程推送。

只有上述步骤全部完成，Phase 6.9.5 才能标记 Review/Planner 真实模型路径完成。

## 8. 回顾问题

- 为什么 V6 的 96-token preview 不能作为 provider actual input usage 上限？
- 为什么本地 97-token fixture 能证明 validator 有缺陷，却不能改写 V6 历史 provider 事实？
- 为什么 V7 保留生产 OpenAI-compatible executor，而不是新建 direct-fetch transport？
- 为什么 usage audit 只保存 shape enum，complete evidence 才保存 token/cost？
- 为什么 V7 controlled-Live 通过后仍不能自动打开产品 gate？

## References

- `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`
- `docs/superpowers/specs/2026-07-17-phase-6-9-5-deepseek-v4-pro-nonthinking-v6-design.md`
- `packages/ai/src/model-agent-provider.ts`
- `packages/ai/src/model-agent-runtime.ts`
- `packages/ai/src/model-agent-deepseek-v4-pro-nonthinking.ts`
- `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.factory.ts`
- `docs/ai-behavior-acceptance.md`
