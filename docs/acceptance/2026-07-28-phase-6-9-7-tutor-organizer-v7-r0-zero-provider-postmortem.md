# Phase 6.9.7 Tutor / WrongQuestionOrganizer V7 R0 Zero-Provider Postmortem

日期：2026-07-28

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

起始提交：`a1844abfd15cc42821c87838d7bdfb905f850021`

终态：R0 文档与设计 checkpoint 完成；V7 尚未实现、未调用 Provider。

## 1. 结论

V6 唯一 controlled-Live 已完整失败封存，但其 `provider_runtime / unknown` 无法区分 request middleware、
fetch transport、HTTP、response audit、SDK generic failure 或其它未分类边界。约 21ms 不是 timeout，也
不足以支持任何具体根因判断。

R0 决定不再修改 dataset、prompt 或 Agent 语义策略。V7 将冻结复用 V2 dataset 与 V6 Tutor/Organizer
candidate/local authority，唯一 remediation 是第一方 DeepSeek V4 Pro direct adapter、durable wire
stages、分离 counters 和真实 V6 schema/prompt 的 zero-network fault matrix。

本轮没有读取 `.env` 或 credential，没有调用 Provider，没有启动 Docker/API/browser，没有修改源码、
业务数据或 V1--V6 artifact。R0 只允许进入 R1 zero-provider adapter 实现，不授权 V7 Live。

## 2. V6 failure authority 核对

保持不变：

- run `b18a0a13-a2a0-4cb0-8f9c-296271c0dfa8`；
- `24/24` guard zero-call、1 对 dispatched/completed；
- 当前历史 schema 记录 2 次 Provider invocation、`0/48` strict runtime；
- Tutor `provider_runtime / unknown`、Organizer `post_dispatch_abort`；
- 后续 46 runtime 未启动；
- semantic/P95/token/CNY 全部 `null`，gate `quality_gate_failed`；
- evidence/marker/journal physical SHA 为
  `beb9d460dcbe10419af06aab130c04d0410debd2123732523fb4a09ff21ea5e9` /
  `cbddba87ec6e491f4e5a5d55c886150eb557e510ff09bd60acfa2ede7c99f988` /
  `be91b0c41d9a538c4be651de52621329751852478261f230fed5e06e758c2a2f`；
- journal 已 `evidence_sealed`，bundle validator `ok=true`，无 recovery claim。

V6 的 2 次 invocation 证明 candidate executor 尝试，不等于两个 HTTP 请求已由操作系统发出，也不等于
DeepSeek 已接收或处理。R0 没有重开 V6 artifact 来补充事实。

## 3. 源码链路取证

当前生产 adapter 位于 `packages/ai/src/model-agent-provider.ts`：默认路径调用 AI SDK
`generateObject`，catch boundary 再通过 `model-agent-provider-failure.ts` 的官方 marker classifier 投影
固定 category。非官方/generic error 最终为 `unknown`。

V4 Pro non-thinking middleware 位于
`packages/ai/src/model-agent-deepseek-v4-pro-nonthinking.ts`：它验证 AI SDK 生成的 request、注入
`thinking: { type: 'disabled' }` 并 audit response；其 request/response safety rejection 是 generic
fixed-message error，
不会携带可由当前 classifier 区分的固定 category。

仓库已有 `first-party-deepseek-v4-runtime.ts`，但它只固定 `deepseek-v4-flash`，且 fetch reject 与所有
non-2xx 都收敛为同一个 transport error；它没有 V4 Pro non-thinking response audit 和 V7 wire counters，
因此不能直接冒充 V7 完成。

V6 runner 的 `dispatch_started` 在 harness operation 前持久化；V6 live harness 的 invocation recorder 在
candidate executor 边界计数。两者都位于可证明的 HTTP response 之前。现有 evidence 又有意不保存 raw
error/body/header/prompt/output，所以无法对历史 `unknown` 做更细的事后还原。

## 4. 冻结的 V7 方案

### 4.1 不改语义

- dataset 继续是 `phase-6.9-tutor-wrong-question-v2` / SHA
  `42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b`；
- baseline SHA 继续是
  `0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca`；
- Tutor/Organizer V6 prompt SHA 继续是
  `4f73ae60e708ed9ba08bc5533cc489626543ca09e0396777ef4d725c9656a169` /
  `c5f1f662ba380283aa08ffe2dc194874c9420b1c6b34ffc86107e476101f3450`；
- Tutor depth / Organizer confidence authority SHA 继续是
  `b57a828e14294f712a6547be2ac168b1d58b79cdc5b9aecbb071304f4e5ae7af` /
  `a46eda402e8c39cdc965277375e8a2aeea27e41c98cda7fd4ba513a9cb520475`；
- Tutor 模型仍只选 intent ordinal；Organizer 模型仍只选 subject/deck/topic ordinal；
- depth、confidence、真实 ID、locked name、全部写权限仍由本地 authority。

### 4.2 新增 wire evidence

V7 stage 单调序列冻结为：

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

V7 将分别报告 executor invocation、provider dispatch、provider response、verified usage；不再用一个
“Provider invocation”计数覆盖所有边界。Dispatch event 必须在 fetch delegate 前 append + fsync，hook
失败则 delegate 0-call。任何 stage 都不保存正文。

### 4.3 安全分类

R0 冻结 request contract、transport、HTTP auth/rate/client/server、response audit/invalid response、
structured-output stages、usage validation、abort/timeout、harness/evidence 与 unknown 兜底。HTTP exact
status、原始异常和 response body 不进入 evidence。

R3 必须用 synthetic delegate 对真实 V6 schemas/prompts 覆盖这些边界。V7 taxonomy 是私有 wire
contract，现有 `ModelAgentProviderFailureCategory` 与 Trace schema 不扩展；R1 需要穷尽的显式投影测试。
重复/跳级 stage 固定为 `harness_internal`，late platform callback 在 terminal 后只 drain；1xx/3xx 与
畸形 status 固定为 `invalid_response`。除专门验证最终兜底的 case 外，任何非预期 `unknown` 都阻断
Live。

## 5. 原子路线与停止门

1. R1：第一方 V4 Pro direct adapter 与 zero-network wire diagnostics；
2. R2：V7 runner/CLI/marker/journal/evidence/recovery/validator；
3. R3：真实 V6 schema/prompt fault matrix、fresh Mock、full static 与两路复审；
4. R4：仅 R3 全门通过并获得新精确授权后执行唯一 V7 Live；
5. R5：仅 R4 全门通过后做产品 Docker/API/可见浏览器；
6. R6：仅 R5 通过后合并 main、default-off 回放并推送远程。

V7 任一 Live 终态都只 seal 一次，不 retry/resume/replay。R4 以前不得创建 V7 Live marker/journal/
evidence，不得 curl、单 case 或通过产品 API 探测 Provider。

## 6. R0 验收回执

- [x] V6 failure authority、run、计数、null aggregate 与 artifact SHA 保持不变；
- [x] 区分 runner dispatch、executor invocation、HTTP dispatch、HTTP response 与 verified usage；
- [x] 没有把 V6 `unknown` 归因 credential、HTTP、网络、SDK、模型或 Provider；
- [x] 冻结复用 V2 dataset 与 V6 candidate/prompt/local authority，不做 Live-driven tuning；
- [x] 冻结 direct adapter、8-stage wire contract、分离 counters 与安全 failure taxonomy；
- [x] 冻结 V7 私有 taxonomy/public provider category 投影边界、并发 reducer 与异常 status 归类；
- [x] 冻结 R3 canonical V2 cases/V6 candidate/projection/schema/prompt imports，禁止 answer-only fixture；
- [x] 冻结独立 V7 runner/approval/artifact identity 与 R1--R6 路线；
- [x] 未修改 TypeScript/source、dataset、prompt、schema、budget、timeout 或 product composition；
- [x] 未读取 `.env`/credential、调用 Provider、启动 Docker/API/browser 或修改业务数据；
- [x] 未创建、删除、覆盖或重跑任何 V1--V7 Live artifact；
- [x] adapter/wire/security 独立复审无 P0；其 P1/P2 已写成 R1 私有 enum、reducer、status 与 canonical
      import 的可执行门；
- [x] docs/history 独立复审发现的 Phase 6.9.5 V7/V8 与当前 Phase 6.9.7 V7 lineage 歧义已消除；
- [x] 当前下一原子任务仅 R1 zero-provider adapter，不存在 Live 授权。

## 7. 回顾时可以问

- “为什么 V6 的两次 Provider invocation 不能证明 HTTP 请求已经发出？”
- “为什么 V7 要把 executor、dispatch、response 和 usage 拆成四个计数？”
- “dispatch-before-fetch fsync 能证明什么，又不能证明什么？”
- “为什么第一方 direct adapter 比继续解析 AI SDK generic error 更适合这次问题？”
- “为什么 V7 不再修改 prompt、dataset 或 Tutor/Organizer authority？”
- “为什么 fault matrix 出现非预期 unknown 就不能申请 Live？”
- “为什么 wire diagnostics 更清楚仍不等于 Agent 质量或产品可用性通过？”
