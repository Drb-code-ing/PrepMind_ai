# Phase 6.9.7 Tutor / WrongQuestionOrganizer V7 R1 Direct Adapter & Wire Diagnostics

日期：2026-07-28

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

R1 起始提交：`87d390db`

终态：R1 已完成，zero-provider；下一原子任务仅 R2 runner/lineage。

## 1. 结论

R1 已把 V7 R0 冻结的第一方 DeepSeek V4 Pro direct adapter 与 wire diagnostics 落成可执行、可测试的
package contract。它可以区分 executor、request、dispatch、response、audit、content、schema 与 usage，
也能把 executor invocation、provider dispatch、provider response、verified usage 分开计数。

本任务没有读取 `.env` 或 credential，没有调用 Provider，没有启动 Docker、API 或浏览器；没有创建 V7
runner、CLI、approval env、marker、journal、evidence 或 recovery claim，也没有接入 Tutor Web、Organizer
Server 或其它产品 composition。因此 R1 只证明 zero-network adapter/wire 工程边界，不是新的 Live、语义
质量、Provider 可用性或产品验收结论。

## 2. 为什么需要 R1

V6 唯一 run `b18a0a13-a2a0-4cb0-8f9c-296271c0dfa8` 已以 `quality_gate_failed` 封存。它的 2 次历史
invocation 只证明 candidate executor 被尝试，不能证明 HTTP 请求已经离开进程、DeepSeek 已接收请求或
response 已返回。首个 Tutor 的 `provider_runtime / unknown` 也不能在脱敏证据下唯一归因 credential、
网络、HTTP、SDK request shape、模型或 Provider response。

R1 不修改 prompt/dataset 来追逐这条失败，而是在请求真正进入 delegate 的边界建立可验证的单调事实。
这样 R2/R3 才能用 durable journal 与同一 V6 schema/prompt fault matrix 判断失败发生在哪个阶段，而不是
继续把不同 transport failure 压缩成一个不可定位的 `unknown`。

## 3. 交付文件与职责

新增：

- `packages/ai/src/first-party-deepseek-v4-pro-direct.ts`：第一方 V4 Pro direct adapter；
- `packages/ai/src/phase-6-9-7-v7-wire-diagnostics.ts`：opaque capability、串行 reducer、stage/counter 与
  私有 failure taxonomy；
- `packages/ai/tests/first-party-deepseek-v4-pro-direct.test.ts`：request、failure、race、no-leak 与
  zero-network transport matrix；
- `packages/agent/tests/phase-6-9-tutor-organizer-v7-direct-adapter-compatibility.test.ts`：真实 V6
  Tutor/Organizer schema 与 prompt SHA compatibility。

修改：

- `packages/ai/src/index.ts`：只公开 adapter、diagnostics factory、固定 identity 与安全 types；内部
  transition helpers 不从 package root 暴露；
- `packages/ai/src/model-agent-provider-failure.ts`：增加受信第一方 failure handoff，按 invocation
  AbortSignal scope 一次性消费，不保存原始异常；
- `packages/ai/tests/model-agent-exports.test.ts` 与
  `packages/ai/tests/model-agent-provider-failure.test.ts`：固定公共导出边界、scope、one-shot 与 no-leak。

## 4. Direct adapter contract

Identity：`first-party-deepseek-v4-pro-direct-v1`。

请求形状固定为：

```text
POST https://api.deepseek.com/v1/chat/completions
model = deepseek-v4-pro
thinking = { type: "disabled" }
response_format = { type: "json_object" }
stream = false
max_tokens = 已验证的 StructuredModelExecutor maxOutputTokens
messages = 固定 system/user 两条消息
```

请求不发送 tools、function、tool_choice 或 json_schema，也没有 retry loop。Adapter 对 config/request
执行 exact own-data key 校验，并要求固定 provider/base URL/model、受限可见 ASCII credential、可调用的
`schema.safeParse`、字符串 prompt、正安全整数 `maxOutputTokens` 与原生 AbortSignal；配置或 request
contract 不合法时 fail-closed。Prompt 的非空/长度边界与具体 token cap 仍由上游 candidate/runtime authority
负责，R1 direct adapter 不重复声明这部分业务约束。

默认依赖才标记 `first_party_deepseek_v4_pro_direct`。任何测试注入 fetch delegate 永久标记
`synthetic_test`，不能取得 production provenance。测试 seam 只返回 strict executor result，不向业务层暴露
response、header、body 或 raw error。

## 5. Wire state 与计数

Diagnostics identity：`phase-6.9.7-v7-wire-diagnostics-v1`。

每个 capability 只能被一个 adapter claim 一次，并只允许形成下面的单调前缀：

```text
executor_entered
  -> request_validated
  -> provider_dispatch_started
  -> provider_response_received
  -> response_audit_passed
  -> content_parsed
  -> schema_validated
  -> usage_validated
```

四类计数不接收调用方数字，而是只从已提交 stage 重算：

- `executorInvocations`：是否提交 `executor_entered`；
- `providerDispatches`：是否提交 `provider_dispatch_started`；
- `providerResponses`：是否提交 `provider_response_received`；
- `verifiedUsages`：是否提交 `usage_validated`。

R1 adapter 在调用 fetch delegate 前等待 dispatch hook 成功；hook 失败时 delegate 为 0-call。R1 还没有
journal，因此 append + fsync 的 durable 实现属于 R2；R2 必须把同一 hook 接到 durable journal，不能把
R1 的 in-memory test callback 写成已经完成持久化。

串行 reducer 固定以下并发语义：

- duplicate、skip、倒序、伪造或重复 claim 在 terminal 前 fail-closed；
- 第一个 success/failure/abort/timeout terminal 冻结 stage、category 与 counter；
- terminal 后晚到的 response、delegate rejection 或 AbortSignal 只 drain，不增加 stage/counter，也不覆盖
  原 terminal；
- response 已 durable 后再 abort/timeout，既有 response counter 不回滚；
- capability 与 invocation scope 不匹配时不能读取或复用受信 failure。

## 6. Failure taxonomy 与脱敏边界

V7 私有 taxonomy 固定覆盖：

- request contract；
- transport；
- HTTP auth / rate limit / client / server；
- response audit / invalid response；
- provider JSON parse / type validation / object missing；
- usage validation；
- pre/post-dispatch abort、runtime timeout；
- harness/evidence I/O；
- final `unknown` fallback。

私有 taxonomy 通过 compile-time exhaustive map 投影到既有
`ModelAgentProviderFailureCategory`；没有扩展 public enum 或历史 Trace schema。401/403、429、其它 4xx 与
5xx 只保留类别，不保存 exact status。合法 `Response` resolve 会先形成 response stage；1xx/3xx、越界、
非整数、NaN/Infinity 或 hostile status accessor 固定 `invalid_response`。200/299 的合法 JSON 可以完成；
204 或 200 empty body 形成 response 后以 `invalid_response` 关闭。

Response audit 拒绝 reasoning content 或正 reasoning token；content 仍经过 JSON parse、真实 Zod strict
schema 与正安全整数 usage。Failure handoff 和 diagnostics snapshot 不保存 raw provider error、cause、stack、
URL、request/response body、header、prompt、model output、credential 或 sentinel canary。

## 7. V6 compatibility

R1 未修改 V2 dataset、V6 candidate、projection、local authority 或 prompt formatter。Compatibility test 让
direct adapter 的成功 response 实际经过两份 V6 strict schema，并复核 prompt SHA：

- Tutor：`4f73ae60e708ed9ba08bc5533cc489626543ca09e0396777ef4d725c9656a169`；
- Organizer：`c5f1f662ba380283aa08ffe2dc194874c9420b1c6b34ffc86107e476101f3450`。

模型权限仍不变：Tutor 只选择 eligible intent ordinal，本地重建 depth/TutorStrategy；Organizer 只选择
owner shortlist 中的 subject/deck/topic ordinal，本地重建 confidence、真实 ID、locked name、command 与
全部写权限。

## 8. 验证证据

| Gate                             | 结果                          |
| -------------------------------- | ----------------------------- |
| R1 focused 5 files               | `66/66`，`852` assertions     |
| `@repo/ai` full                  | `224/224`，`1452` assertions  |
| `@repo/agent` full               | `830/830`，`10839` assertions |
| `@repo/ai` typecheck / lint      | exit `0`                      |
| `@repo/agent` typecheck / lint   | exit `0`                      |
| changed-file Prettier            | exit `0`                      |
| `git diff --check`               | exit `0`                      |
| independent code/security review | 无未关闭 P0/P1/P2             |

Focused matrix 包含 exact request/provenance、dispatch hook zero-call、single-call/no-retry、HTTP 100--599
分类与边界、2xx empty/malformed body、non-thinking audit、content/schema/usage failure、hostile config/
accessor/proxy、duplicate/skipped stage、late response/rejection、abort/timeout/complete 竞态、one-shot failure
handoff、public export 边界，以及 V6 Tutor/Organizer compatibility。

## 9. 明确未发生的事项

- 未读取或修改根 `.env`、component credential 或任何 API key；
- 未调用 DeepSeek 或其它 Provider，verified Provider usage/cost/P95 均不存在；
- 未启动 Docker service、Nest API、Next Web 或可见浏览器；
- 未创建或修改业务账号、WrongQuestion、deck、Trace、session、PostgreSQL、Redis 或 MinIO 数据；
- 未创建 V7 runner、CLI、approval variable、marker、journal、evidence、recovery claim 或 Live artifact；
- 未接 Tutor/Organizer 产品 composition，现有 product gate/default-off 行为没有改变；
- 未修改、删除、重跑、恢复或拼接 V1--V6 marker/journal/evidence。

## 10. 停止门与下一步

R1 到此完成并停止。下一原子任务仅 R2：建立独立 V7 report/runner/CLI/lineage/durability，把 R1
`appendStage` boundary 接入 dispatch-before-fetch append + fsync，并保持全过程 zero-provider。

R3 fault matrix、R4 controlled-Live、R5 Docker/API/可见浏览器、R6 main、Task 13、Phase 6.9.8、Phase
6.10、Phase 8/9 与两篇博客均未开始。只有未来 R3 全门通过、分支 clean/pushed，并由用户重新接受运行
当时的数据边界和精确授权一次 V7 branch controlled-Live，R4 才可能运行。

## 11. 回顾时可以问

- “为什么 V6 的 executor invocation 不能等同于 HTTP dispatch？”
- “R1 的 dispatch hook 与 R2 的 append + fsync 分别负责什么？”
- “为什么 response counter 也不能证明模型成功或供应商已经计费？”
- “first-terminal-wins 如何处理 timeout 后晚到的 response 或 rejection？”
- “为什么 synthetic delegate 永远不能取得 production provenance？”
- “为什么 direct adapter 通过仍不能宣称 Tutor/Organizer 真实模型可用？”
