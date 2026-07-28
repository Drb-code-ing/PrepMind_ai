# Phase 6.9.7 Tutor / WrongQuestionOrganizer V7 Transport Remediation Design

日期：2026-07-28

状态：R0 已完成；V7 仅完成零 Provider 根因复盘与设计，尚未实现 direct adapter、runner、Mock、
Live 或产品接线。本文件不构成任何 Provider 调用授权。

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

实施计划：
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v7-remediation.md`

V6 failure authority：
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v6-controlled-live-failure.md`

R0 acceptance：
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r0-zero-provider-postmortem.md`

## 1. 决策摘要

V7 不是 V6 retry，也不再修改 dataset、prompt、Tutor/Organizer candidate 或本地语义 authority。
V6 唯一 run `b18a0a13-a2a0-4cb0-8f9c-296271c0dfa8` 已以
`quality_gate_failed` 封存；其 marker、33 条 journal、evidence、SHA、固定分母与全部 `null`
aggregate 均不可修改、删除或重跑。

V6 首个 Tutor 在约 `21ms` 内成为 `provider_runtime / unknown`。现有证据只能证明 runner 持久化了
lane dispatch、candidate executor 被进入两次并收到了一个受信但未分类的失败；不能证明 HTTP 请求已经
离开进程、DeepSeek 已接收请求，或 Provider 返回了某个 HTTP 状态。继续改 prompt、放宽 timeout 或用
额外 curl 探测都不能修复这个诊断盲区。

因此 V7 是传输与诊断专项 remediation：

1. 复用 V2 dataset、V6 candidate/prompt/local-authority 的原始 bytes 与 SHA；
2. 为 DeepSeek V4 Pro non-thinking 新建第一方 direct adapter，不再由 AI SDK generic error marker
   推断 wire 阶段；
3. 用无正文、固定枚举的 durable wire events 区分 executor、request、dispatch、response、audit、
   parse、schema 与 usage；
4. 将 `executorInvocations`、`providerDispatches`、`providerResponses` 和 verified usage 分开计数；
5. 先用真实 V6 schema/prompt 做完整 zero-network fault matrix，再决定是否允许一次新的 V7 Live。

V7 保留 `unknown` 作为最后一道安全兜底，但 R3 预期故障若落入非预期 `unknown`，就不得申请 Live。

## 2. V6 只读取证与根因边界

### 2.1 不可变事实

- run：`b18a0a13-a2a0-4cb0-8f9c-296271c0dfa8`；
- guard：`24/24` verified zero-call；
- runner pair：1 对 dispatched/completed；
- 当前报告所称 Provider invocation：2；strict runtime：`0/48`；
- Tutor：`provider_runtime / unknown`，executor duration `21.2116ms`；
- Organizer：`post_dispatch_abort`；
- 后续 46 runtime：`not_started_quality_breaker`；
- semantic、四类 P95、token、CNY：全部 `null`；
- evidence / marker / journal physical SHA：
  `beb9d460dcbe10419af06aab130c04d0410debd2123732523fb4a09ff21ea5e9` /
  `cbddba87ec6e491f4e5a5d55c886150eb557e510ff09bd60acfa2ede7c99f988` /
  `be91b0c41d9a538c4be651de52621329751852478261f230fed5e06e758c2a2f`。

### 2.2 当前链路为什么无法定位

V6 runner 的 `dispatch_started` 在进入两个 harness lane 前 append + file fsync。它证明 runner 已为该
lane 预留并持久化执行意图，不等于 HTTP delegate 已被调用。Candidate 的 invocation recorder 在
executor 边界计数，也不能证明操作系统已发送网络字节或 Provider 已接收请求。

当前 V4 Pro 路径是：

```text
V6 runner dispatch_started
  -> V6 candidate executor recorder
  -> ModelAgentRuntime
  -> createOpenAICompatibleStructuredExecutor
  -> AI SDK generateObject
  -> DeepSeek V4 Pro non-thinking fetch middleware
  -> global fetch
```

`createOpenAICompatibleStructuredExecutor` 只对 AI SDK 官方 error marker 做固定分类。V4 Pro
middleware 的 request safety 拒绝、response non-thinking audit 拒绝或其它 generic error 可能在外层被
压缩成同一个 `unknown`。Fetch/SDK 的 generic failure 也可能走到相同结果。Evidence 按安全合同不保存
原始异常、HTTP body/header、prompt 或模型输出，因此无法事后重新分类。

### 2.3 根因矩阵

| 可能边界                            | V6 能否区分        | V7 的安全证据                                      |
| ----------------------------------- | ------------------ | -------------------------------------------------- |
| executor 未进入 / 本地 harness 失败 | 部分               | `executor_entered` 是否存在                        |
| request/config contract 拒绝        | 否                 | `request_validated` 缺失 + fixed failure code      |
| dispatch journal/hook 失败          | 否                 | 无 `provider_dispatch_started`，delegate 必须为 0  |
| fetch delegate 拒绝 / 网络异常      | 否                 | dispatch 有、response 无、`transport`              |
| HTTP 401/403/429/其它 4xx/5xx       | 否                 | response 有 + 固定 HTTP category                   |
| 2xx body 非 JSON 或响应形状非法     | 否                 | response 有、audit 未通过、`invalid_response`      |
| thinking/reasoning audit 拒绝       | 否                 | response 有、`response_audit`                      |
| content JSON 解析失败               | 部分               | audit 通过、content 未解析、固定 structured stage  |
| Zod schema 不匹配                   | 部分               | content parsed、schema 未通过                      |
| usage 缺失/非法/非正整数            | 只见 unknown usage | schema 通过、usage 未通过、`usage_validation`      |
| abort / hard timeout                | 部分               | 固定 abort/timeout category + last completed stage |
| 未覆盖异常                          | `unknown`          | `unknown` 仍保留，但阻断 Live 前置门               |

该矩阵是设计假设，不是对 V6 根因的追溯结论。V7 不把某一行写成 V6 已确认原因。

## 3. 冻结复用的语义 authority

V7 不创建 V3 dataset，也不调 prompt 来适配 V6 首条失败：

| Contract                           | 冻结 identity / SHA-256                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| dataset                            | `phase-6.9-tutor-wrong-question-v2`                                |
| dataset SHA                        | `42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b` |
| deterministic baseline SHA         | `0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca` |
| V6 dataset binding SHA             | `3306cc399730f85b3281c90f226f629873d9755325415b69a0263a0f57b96153` |
| Tutor V6 prompt SHA                | `4f73ae60e708ed9ba08bc5533cc489626543ca09e0396777ef4d725c9656a169` |
| Organizer V6 prompt SHA            | `c5f1f662ba380283aa08ffe2dc194874c9420b1c6b34ffc86107e476101f3450` |
| Tutor depth authority SHA          | `b57a828e14294f712a6547be2ac168b1d58b79cdc5b9aecbb071304f4e5ae7af` |
| Organizer confidence authority SHA | `a46eda402e8c39cdc965277375e8a2aeea27e41c98cda7fd4ba513a9cb520475` |
| V6 robustness fixture SHA          | `314543fe1694c0caa2b8fc48fa79a1bfcd751eb0431664ffafb9ceee3103904b` |

Tutor 模型仍只选择本地 eligible `intentIndex`；preferred depth、answer boundary 与 TutorStrategy 由
本地重建。Organizer 模型仍只选择 actual owner shortlist 中的 subject/deck/topic ordinal；confidence、
真实 ID、locked name、reason/description、command binding 与写权限继续由本地重建。

## 4. V7 第一方 direct adapter

### 4.1 传输合同

R1 新建 V4 Pro 专用 direct adapter，生产路径不调用 `generateObject`，也不复用只支持
`deepseek-v4-flash` 且把所有非 2xx 收敛为单一 transport failure 的现有 V4 Flash direct runtime。

Adapter 固定：

- endpoint：`https://api.deepseek.com/v1/chat/completions`；
- model：`deepseek-v4-pro`；
- `thinking: { type: 'disabled' }`；
- `response_format: { type: 'json_object' }`；
- `stream: false`，无 tools/function/json_schema，无自动 retry；
- system/user prompt 与 `max_tokens` 来自已验证的 `StructuredModelExecutor` input；
- caller AbortSignal 与 Tutor `3500ms` / Organizer `5000ms` hard deadline 保持独立；
- response content 最终仍须经过现有 V6 Zod strict schema，本地 merger 不变。

Adapter 自己构造并验证 request，不解析 AI SDK 生成的 request。生产 factory 不向业务层暴露 fetch、
response 或 error；测试 seam 仅用于 zero-network delegate，不能取得 production provenance。

V7 wire failure taxonomy 是 adapter/runner 私有 contract，不是对
`packages/ai/src/model-agent-contract.ts` 中 `ModelAgentProviderFailureCategory` 的静默扩展。R1 必须定义
独立 `Phase697V7WireFailureCategory`，并在 StructuredModelExecutor 兼容边界使用穷尽、可编译检查的显式
投影：同名 HTTP/transport 保持原分类，`response_audit` 投影为 `invalid_response`，三个 structured-output
stage 投影为 `structured_output`，其余 request/cancellation/harness/evidence 私有原因只能投影为现有
`unknown` 或由既有 abort/timeout 边界收口。现有 public enum、Trace schema 与 V1--V6 bytes 不改变；测试
必须用 `satisfies Record<Phase697V7WireFailureCategory, ...>` 或等价 never-check 证明没有遗漏。

### 4.2 固定 wire stages

每个 runtime 只能形成下面的单调前缀，不能跳过、倒退、重复或跨 lane 复制：

1. `executor_entered`；
2. `request_validated`；
3. `provider_dispatch_started`；
4. `provider_response_received`；
5. `response_audit_passed`；
6. `content_parsed`；
7. `schema_validated`；
8. `usage_validated`。

`provider_dispatch_started` 必须在调用 fetch delegate 前 append + fsync。若这个 durable hook 失败，
delegate 调用数必须为 0。`provider_response_received` 在 fetch resolve 为 `Response` 后记录，不论最终
HTTP category 是否成功。后续 hook 失败按本地 evidence/harness failure 收口，不吞掉已经发生的 dispatch
或 response 事实。

每个 lane 只有一个私有 reducer owner，所有 stage/abort/timeout/settlement intent 先进入同一串行队列再
改变状态。相同 stage 的第二次提交、跳级、倒退或跨 lane capability 使用在 terminal 前一律固定为
`harness_internal`；不能静默去重。第一个 terminal transition 冻结 stage/counter，已经冻结后到达的原生
AbortSignal 或 fetch settlement 只做 drain，不得新增 stage、改变 category 或再次计数，也不视为第二次
adapter stage 提交。Abort 在 dispatch 前观察为 `pre_dispatch_abort`；dispatch 后观察为
`post_dispatch_abort`，且已经 durable 的 response stage 不得被回滚。R1 必须用受控 barrier 覆盖
response/abort、timeout/response 与重复 callback 的两种到达顺序，证明 reducer 结果由队列顺序而非并发
写入决定。

这些 stage 只说明本进程观察到的边界：dispatch 不能证明 TCP 发送或 Provider 接收；response 只能证明
客户端拿到 HTTP response，不能单独证明模型已成功推理。

### 4.3 分离计数

V7 report 和 journal 必须分别重算：

- `executorInvocations`：`executor_entered` 数量；
- `providerDispatches`：durable `provider_dispatch_started` 数量；
- `providerResponses`：durable `provider_response_received` 数量；
- `verifiedUsages`：`usage_validated` 且正安全整数 usage 已绑定当前 lane 的数量；
- `strictRuntimeSuccesses`：schema、usage、本地 dynamic contract 与 merger 全部通过的数量。

任何计数缺失、超出固定分母、和 stage prefix 不一致或由 report 直接信任调用方传入，都必须
fail-closed。V6 的“2 次 Provider invocation”继续按其历史 schema 原样保留，不反向改名或改写。

## 5. 安全失败 taxonomy

V7 只允许固定 enum，不把 error message、cause、stack、URL、HTTP body/header、prompt、response、key 或
model output 传出 adapter：

| Domain            | 固定分类                                                                       |
| ----------------- | ------------------------------------------------------------------------------ |
| local request     | `request_contract`                                                             |
| wire transport    | `transport`                                                                    |
| HTTP              | `http_auth` / `http_rate_limit` / `http_client` / `http_server`                |
| response policy   | `response_audit` / `invalid_response`                                          |
| structured output | `provider_json_parse` / `provider_type_validation` / `provider_object_missing` |
| usage             | `usage_validation`                                                             |
| cancellation      | `pre_dispatch_abort` / `post_dispatch_abort` / `runtime_timeout`               |
| harness/evidence  | `harness_internal` / `evidence_io`                                             |
| final fallback    | `unknown`                                                                      |

HTTP exact status 不进入 evidence；401/403 归 `http_auth`、429 归 `http_rate_limit`、其余 4xx/5xx 只保留
类别。Fetch delegate resolve 为通过本地 `Response` brand check 的对象后先形成
`provider_response_received`；随后 1xx/3xx、非安全整数/越界 status 或 status accessor failure 固定为
`invalid_response`，不得猜测成 transport/HTTP success。未通过 Response brand check 的 resolved value
同样为 `invalid_response`，但不能伪造 response stage。其它未知 throw 才进入最终 `unknown`。
`unknown` 能让生产安全降级，但 R3 fault matrix 中除专门验证最终兜底的 case 外，任何非预期
`unknown` 都阻断 R4。

Failure domain、last completed stage、wire counters 与 usage disposition 必须由同一个 reducer 交叉
校验。例如 `http_auth` 必须有 dispatch+response、不能有 audit passed；`transport` 必须有 dispatch、不能
有 response；`request_contract` 不能有 dispatch；`usage_validation` 必须至少完成 schema validation。

## 6. V7 runner、lineage 与 durability

V7 使用全新 identity：

| 维度                    | V7 namespace                              |
| ----------------------- | ----------------------------------------- |
| direct adapter          | `first-party-deepseek-v4-pro-direct-v1`   |
| eval policy             | `phase-6.9.7-v7-eval-policy-v1`           |
| runner                  | `phase-6.9.7-tutor-organizer-runner-v7`   |
| runtime evidence        | `phase-6.9.7-v7-wire-evidence-v1`         |
| approval env            | `PHASE_6_9_7_V7_CONTROLLED_LIVE_APPROVED` |
| marker/journal/evidence | 独立 `v7` 前缀                            |

R2 冻结上述 source manifest SHA、confirmation token、marker schema、journal version、evidence envelope、
validator 与 recovery claim。V7 validator 递归拒绝 V1--V6 runner/artifact identity，V1--V6 validators
也必须拒绝 V7；V6 report、entry 或 wire counter 不复制进 V7 report。

V7 继承并补强 V6 的运行不变量：

- 24 guard 全部先行，runtime 前 executor/dispatch/response 均必须为 0；
- 24 pair 串行，每 pair 最多 Tutor + Organizer 双 lane；单 lane 只允许一次 dispatch，无 retry；
- 首个 runtime contract failure 收口当前 pair 并打开 `quality_gate_impossible` breaker；
- 未启动项仍留在固定 48 分母，不复制 sibling failure，不从历史/Mock 补齐；
- dispatch-before-fetch、runtime terminal、pair terminal、breaker、run completed 与 evidence sealed 进入
  sequence/hash-chain journal；
- crash recovery 只从 durable prefix seal，不读取 credential、不创建 adapter、不 resume/replay；
- evidence 使用 temp fsync + exclusive hard-link；同 bytes 幂等，不同 bytes 拒绝覆盖。

V6 已知 durability 边界继续如实保留，除非 R2 用专门测试关闭：当前只有文件 fsync、没有父目录
fsync；claim 获取时的 tail 会在 appender/seal 二次校验；stale claim rename 后再次崩溃仍缺专测。V7
不得把单主机 PID/文件 fencing 表述为跨主机 lease 或 Provider exactly-once。

## 7. Zero-network fault matrix 与质量门

R3 必须使用真实 V6 Tutor/Organizer schema、projection、prompt formatter 和 48 个 runtime input，但所有
delegate 都是进程内 synthetic，不读取 `.env` 或 credential，不访问网络。

Canonical import 不得由测试手写替身替代：runtime input 必须来自
`PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES` 并以 `subset === 'runtime'` 得到固定 48 条，同时核对
`PHASE_6_9_TUTOR_WRONG_QUESTION_V2_FROZEN_DATASET_SHA256`；Tutor 必须穿过
`runTutorV6ModelCandidate`、`projectTutorV6ModelInput`、`TUTOR_V6_MODEL_DECISION_SCHEMA` 与
`formatTutorV6ModelPolicyForPrompt`；Organizer 必须穿过
`runWrongQuestionOrganizerV6ModelCandidate`、`projectWrongQuestionOrganizerV6ModelInput`、
`WRONG_QUESTION_ORGANIZER_V6_MODEL_DECISION_SCHEMA` 与
`formatWrongQuestionOrganizerV6ModelPolicyForPrompt`。R3 还要核对两份 frozen prompt SHA 与
`PHASE_6_9_7_V6_DATASET_BINDING_SHA256`。Synthetic delegate 只能替代 wire response，不能退回
answer-only fixture、复制 expected decision 或绕过实际 candidate request formatter/schema。

至少覆盖：

- config/request shape、forbidden fields、thinking disabled、exact endpoint/model；
- pre-dispatch journal/hook failure，证明 delegate 0-call；
- fetch reject、同步 throw、abort before/after dispatch、hard timeout；
- 401/403/429/其它 4xx/5xx 与异常 status；
- 2xx empty/malformed JSON、非法 response shape、reasoning content/positive reasoning tokens；
- completion 缺失、JSON parse、exact fence、Zod mismatch；
- usage missing/zero/negative/fraction/overflow 与合法正 usage；
- callback/hook throw、hostile accessor/proxy、跨 lane scope、重复/跳 stage；
- first/middle/last failure、sibling abort、orphan、journal crash/recovery 与 lineage mismatch；
- key/header/body/error/prompt/model output 的递归泄漏扫描。

R3 只有在下面全部成立时才可进入新的授权门：

- fresh baseline bytes/SHA 与 V6 prompt/authority SHA 不变；
- fresh Mock 为 `24/24` zero-call、`48/48` strict runtime、semantic/model-owned `1/1/1`；
- 每个预期 synthetic fault 的 category/stage/counters 精确匹配；
- 除专门的最终兜底测试外没有非预期 `unknown`；
- guard executor/dispatch/response 全为 0，runtime 成功路径四类计数各为 48；
- V1--V6 validators/SHA 不变，V7 Live artifact 为 0；
- full static、typecheck/lint、Organizer PostgreSQL concurrency、Compose default-off 与两路复审通过。

R4 若未来获得新的精确授权，语义与性能门完全复用 V6：`24/24` zero-call、`48/48` strict、critical/
permission/mutation/broader fallback=0、Tutor/Organizer/combined semantic 各 `>=0.85`、相对 baseline 两 lane
各提升 `>=0.15`、Tutor/Organizer/paired/Tutor-orchestration P95 分别 `<=2500/4500/4500/6500ms`、Tutor
intent `>=21/24`、Organizer 三轴各 `>=28/32`、usage/price/CNY 完整且总费用 `<=0.55 CNY`。新增 wire
门要求 48 executor、48 dispatch、48 response、48 verified usage 和 8-stage success prefix 全部一致。

任一 lane 不完整时 semantic/P95/token/CNY 全部保持 `null`。Wire diagnostics 只提高可定位性，不降低
质量门，也不能让一次失败自动重试。

## 8. 原子实施路线

1. **R0**：V6 零 Provider 复盘、V7 设计/计划/acceptance 与核心文档同步。（已完成）
2. **R1**：第一方 V4 Pro direct adapter、固定 failure taxonomy、wire stage/counter capability 与
   zero-network adapter tests；不创建 V7 runner/artifact。（待开始）
3. **R2**：独立 V7 report/runner/CLI/approval/marker/journal/evidence/recovery/validator，绑定 V6
   candidate bytes 与 wire events；不创建真实 Live artifact。（未开始）
4. **R3**：真实 V6 schema/prompt fault matrix、fresh baseline/Mock、full static/PostgreSQL/Compose、历史
   validators 与两路终审。（未开始，zero-provider）
5. **R4**：只有 R3 全门通过且用户重新精确授权后，执行唯一 V7 branch controlled-Live；任何终态只
   seal 一次，不 retry/resume/replay。（未授权）
6. **R5**：只有 R4 全门通过后，才把 V7 adapter/V6 candidates 接入产品 composition，做 Docker API、
   可见 `/chat`/`/error-book`、Trace、default-off 与精确清理。（被阻断）
7. **R6**：只有 R5 通过后，才同步最终文档、推送分支、`--no-ff` 合并 main、main default-off 回放并
   推送远程。（被阻断）

每个 R-task 单独提交并推送当前功能分支，不创建 worktree 或子分支。R0 完成只授权下一原子任务 R1，
不授权 R2--R6 或任何网络调用。

## 9. 非目标与禁止事项

- 不重跑、恢复、删除、改写或拼接 V1--V6；
- 不修改 V2 dataset/expected、V6 prompt/candidate/local authority、预算、P95 或语义阈值；
- 不把 V6 `unknown` 武断归因为 key、网络、HTTP、SDK、模型或 Provider；
- 不保存 raw prompt/model output、response/error/body/header、credential、URL、真实用户文本/ID；
- 不把 fixed wire event 当成 Provider receipt、billing 或模型成功证明；
- R0--R3 不读取 `.env`/credential，不调用 Provider，不启动产品 Docker/API/browser；
- R4 前不创建 V7 marker/journal/evidence，不执行 curl、单 case 或产品 API 网络探测；
- R4 未通过前不接产品、不开始 R5/R6/Task 13/main/Phase 6.9.8；
- 不进入 Phase 6.10、Phase 8/9 或两篇博客收尾。
