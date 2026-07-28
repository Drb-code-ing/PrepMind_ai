# Phase 6.9.7 Tutor / WrongQuestionOrganizer V7 Transport Remediation Plan

**目标：** 在 V1--V6 历史完全不可变、V2 dataset 与 V6 语义 candidate 完全不变的前提下，用第一方
DeepSeek V4 Pro direct adapter 和 durable wire evidence 消除 `provider_runtime / unknown` 的传输诊断
盲区，再由同一 72-case 合同决定是否具备一次新的 controlled-Live 资格。

**当前状态：** R0/R1/R2/R3 已完成。唯一 R4 branch controlled-Live run `81529c2c...` 已以
`quality_gate_failed` 封存且不得重跑；R5--R6、产品 Docker/API/可见浏览器与 main 均被阻断。下一原子
任务只能先做新的独立 zero-provider 根因复盘与版本化 remediation 设计。

**设计 authority：**
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v7-remediation-design.md`

## 执行不变量

- 继续在 `codex/phase-6-9-7-tutor-wrong-question-agents` 工作，不创建 worktree 或子分支；
- main agent 编辑、决策、验证和提交；subagent 只读取证；
- 一个 R-task、一次相关文档同步、一个原子提交并推送功能分支；
- V1--V6 run/marker/journal/evidence/dataset/prompt/authority bytes 与 SHA 不改、不删、不重跑、不拼接；
- R0--R3 全部 zero-provider；R4 需要新的精确授权，当前“继续”不构成 Live 授权；
- 固定 `72/24/48/24/32` 分母、guard-first、单 pair/最多双 lane、single dispatch、no-retry、首个
  contract failure breaker 与 incomplete aggregate=`null`；
- gates/live/component key 默认关闭；禁止 Docker prune、`down -v`、volume/database reset、Redis flush
  或 MinIO wipe。

## R0：V6 零 Provider 复盘与 V7 设计

**状态：** [x] 已完成，zero-provider。

**交付：**

- 固定 V6 run、三份 physical SHA、`24/24` guard、2 executor attempts、`0/48` strict 与全部
  `null` aggregate；
- 明确 V6 runner dispatch/executor count 不证明 HTTP 发出或 Provider 接收；
- 记录 AI SDK adapter、V4 Pro middleware 与 generic `unknown` 的证据盲区，不猜测真实根因；
- 冻结 V2 dataset、V6 prompt/candidate/local authority bytes/SHA 不变；
- 冻结第一方 V4 Pro direct adapter、8 个 wire stages、分离 counters、安全 failure taxonomy；
- 冻结 V7 identity、R1--R6 原子路线、停止条件、权限与文档边界。

**验收：**

- [x] V6 evidence/journal/marker 与 failure authority 未修改；
- [x] 未修改任何 TypeScript/source、dataset、prompt、schema、budget 或 product composition；
- [x] 未读取 `.env`/credential、调用 Provider、启动 Docker/API/browser 或修改业务数据；
- [x] R0 只授权下一原子任务 R1，不授权 Live 或额外网络探测。

**验收文档：**
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r0-zero-provider-postmortem.md`

**提交：** `docs(agent): design phase 6.9.7 v7 transport remediation`

## R1：第一方 V4 Pro direct adapter 与 wire diagnostics

**状态：** [x] 已完成，zero-provider。

**交付：**

- 新建 `first-party-deepseek-v4-pro-direct-v1`，固定 endpoint/model/non-thinking/json/no-tools/
  no-retry/request shape；
- 生产 adapter 直接构造 request、调用 fetch、解析 response、执行 non-thinking audit、Zod 与正 usage
  验证，不再经过 `generateObject`；
- 用私有 capability 只投影固定 stage/category/counter，不暴露 fetch/response/error/body/header；
- V7 taxonomy 使用独立私有 enum；现有 `ModelAgentProviderFailureCategory`、Trace schema 与历史 bytes
  不变，并以 exhaustive compile-time projection test 固定两者边界；
- 依次记录 `executor_entered -> request_validated -> provider_dispatch_started ->
provider_response_received -> response_audit_passed -> content_parsed -> schema_validated ->
usage_validated`；
- provider dispatch durable hook 失败时 delegate 必须 0-call；
- lane-local 串行 reducer 固定 duplicate/out-of-order=`harness_internal`、terminal 后 late callback 只 drain，
  并用 barrier 测试 response/abort/timeout 的两种竞态顺序；
- 所有合法 `Response` resolve 都先形成 response stage；1xx/3xx、畸形 status/accessor 固定
  `invalid_response`，exact status 不落盘；
- request/transport/HTTP/response audit/structured output/usage/abort/timeout/harness/unknown 分类与 stage
  combination fail-closed；
- zero-network unit tests 覆盖 V6 Tutor/Organizer 两份 schema 与 key/error/prompt/body 泄漏扫描。

**停止点：** 不创建 V7 runner/CLI/marker/journal/evidence，不读取 credential，不调用 Provider，不接产品。

**建议验证：** AI focused/full、Agent adapter compatibility、typecheck/lint/Prettier、direct delegate
zero-call/one-call counters 与独立安全复审。

**完成证据：** focused `66/66`（`852` assertions）、Agent `830/830`（`10839` assertions）、AI
`224/224`（`1452` assertions），AI/Agent typecheck/lint、Prettier、diff 与独立代码/安全复审通过。
HTTP success/abnormal status、2xx empty body、late response/rejection、complete/abort/timeout 竞态与 V6
Tutor/Organizer schema/prompt SHA compatibility 均已固定。

**验收文档：**
`docs/acceptance/phase-6-9-7-tutor-organizer-v7-r1-zero-provider-adapter.md`

## R2：V7 runner、lineage 与 durable wire evidence

**状态：** [x] 已完成，zero-provider。

**交付：**

- 独立 V7 report/entry/evidence schema、runner、CLI、confirmation、approval env 与 validator；
- V7 marker/journal/evidence/recovery prefix 与 V1--V6 双向隔离；
- report 分离 `executorInvocations/providerDispatches/providerResponses/verifiedUsages`；
- dispatch-before-fetch append+fsync、单调 wire prefix、lane scope、runtime/pair terminal、breaker、run
  completed、evidence sealed 进入 hash-chain journal；
- crash recovery 只 seal durable prefix，不创建 adapter、不读取 key、不 resume/replay/retry；
- complete-only semantic/P95/token/CNY 与 V6 model-owned gates 保持不变；
- 冻结 V7 source manifest、eval policy、runner、wire evidence 与 artifact SHA identities。

**停止点：** 不创建仓库真实 Live artifact，不执行 Mock/Live，不启动 Docker/API/browser。

**完成证据：** 独立 V7 report/entry/evidence、runner、CLI/confirmation/approval、marker、hash-chain
journal、recovery claim、hard-link publisher 与 validator 已实现；固定 `72/24/48/24/32`、guard-first、
single-dispatch、首 contract failure breaker、四类 wire counter、incomplete aggregate=`null` 与 synthetic
Live fail-closed 已冻结。Focused `22/22`（`184` assertions）、Agent full `852/852`（`11041`
assertions）、typecheck/lint、V1--V6 validators 与 V6 physical SHA 均通过。没有读取 `.env`/credential、
调用 Provider、启动 Docker/API/browser 或创建仓库正式 V7 artifact。

**验收文档：**
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r2-runner-lineage.md`

## R3：Zero-network fault matrix 与 static/Mock checkpoint

**状态：** [x] 已完成，zero-provider。

**交付：**

- 真实 V6 Tutor/Organizer schema、projection、prompt formatter 与 48 runtime input 的 synthetic delegate
  compatibility；
- 48 runtime 必须从 `PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES` 以 `subset === 'runtime'` 派生并核对
  frozen dataset SHA；两 lane 必须穿过实际 V6 candidate、projection、decision schema 与 prompt
  formatter，不接受 answer-only/expected-copy fixture；
- request/hook/transport/HTTP/response/non-thinking/content/schema/usage/abort/timeout/harness 故障矩阵；
- 每个故障精确断言 stage prefix、四类 counter、failure category、usage disposition 与 no-leak；
- fresh baseline 与 reviewed V7 Mock；
- Agent/AI/Types/Server/Web focused/full/typecheck/lint/build、Organizer PostgreSQL concurrency、Compose
  default-off、V1--V6 SHA/validators 与 V7 Live artifact=0；
- contract/security/wire 与 docs/history/operations 两路独立终审。

**通过门：** 除专门最终兜底 case 外没有非预期 `unknown`；guard 三类计数均 0；48 条 Mock success 的
executor/dispatch/response/usage 各 48；Mock `24/24` zero-call、`48/48` strict、semantic/model-owned
`1/1/1`。任一门失败都停在 R3，不申请 Live。

**完成证据：** 48 条 runtime 全部从冻结 V2 dataset 派生并穿过真实 V6 candidate、projection、prompt、
strict schema、本地 merger 与第一方 direct adapter；进程内 synthetic fetch 覆盖 transport/HTTP/response/
non-thinking/schema/usage/abort/breaker/sibling attribution，未读取 expected/oracle。Fresh baseline 保持
`12/48` 与 `0.6629642857/0.278125/0.4705446429`；reviewed Mock run `e09baa4a...` 为
`24/24` guard、`48/48` strict、semantic/model-owned `1/1/1`，四类 wire counter 均 `48`，gate
`mock_quality_not_evidence`。Agent/AI/Types/Server/Web、PostgreSQL `12/12`、Compose default-off、
V1--V6 validators/SHA、V7 artifact=0，以及 contract/security/wire 与 docs/history/operations 两路终审
通过；无 Provider、根 `.env`、产品 Docker/API/browser。

**验收文档：**
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r3-static-mock.md`

## R4：唯一 V7 branch controlled-Live

**状态：** [x] 已执行，失败封存。

必须同时满足：R3 clean/pushed、V7 marker/journal/evidence/recovery claim 为 0、V1--V6 SHA/validators
通过、用户重新接受运行当时 DeepSeek 数据边界，并明确授权唯一一次 **Phase 6.9.7
Tutor/Organizer V7 branch controlled-Live**。

执行顺序固定：zero-network preflight -> 进程内 component credential 映射 -> marker/journal -> 24 guard
-> 24 sequential pairs -> report/evidence seal -> validator。失败立即封存，不 retry/resume/replay；成功也
不得重跑。

Live 除 V6 全部门外，还要求 48 executor、48 dispatch、48 response、48 verified usage 与完整 8-stage
success prefix。任一 incomplete lane 使 semantic/P95/token/CNY 全为 `null`。

**执行结果：** zero-network preflight 在 clean/pushed `df5ed8c7` 上确认 V7 artifact=0、V1--V6
validators/SHA 与 V7 focused `26/26` 通过。唯一 run
`81529c2c-79f5-4c21-9cee-e536a2fe78e3` 为 `24/24` guard zero-call；首对 Tutor 完成完整
8-stage wire、`candidate_applied`、verified usage `532/8`，Organizer 已收到 response 并完成
`content_parsed`，但在 `provider_type_validation` 失败。Runner 随即熔断，后续 46 runtime 未启动；最终
wire `2/2/2/1`、strict `1/48`，semantic/P95/token/CNY 全 `null`，gate
`quality_gate_failed`。Evidence/marker/journal 已 seal，bundle validator `ok=true / filesChecked=1`，无
recovery claim。验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-v7-controlled-live-failure.md`。

## R5：产品 Docker / API / 可见浏览器验收

**状态：** [ ] 被 R4 `quality_gate_failed` 阻断，不得开始。

- 将 V7 direct adapter 与冻结 V6 candidates 接入 Tutor Web / Organizer Server composition；
- 保持现有独立 credential/gate/budget/owner/stale/Trace/command 权限；
- Tutor Chat：双语歧义 intent、明确指令 zero-call、transport/schema/usage fallback 与 Trace；
- Organizer：single/batch、topic ordinal、authority confidence、owner/locked/stale/concurrency；
- headed `/chat` 与 `/error-book`，窗口保留供用户观察；
- 只精确清理本轮 synthetic user/question/deck/item/Trace/session/storage；
- 恢复 default-off，不删除 Docker 容器、镜像、卷或持久数据。

## R6：分支收尾、main 合并与回放

**状态：** [ ] 被 R4 失败终态阻断，不得开始。

- 同步最终数值、SHA、wire 边界、DEVLOG 与 acceptance；
- 原子提交并推送功能分支；
- 切到最新 main 后 `git merge --no-ff`，不在功能分支上再开分支；
- main 只重跑 static/Mock 与 default-off Docker/API/可见浏览器，不重跑已消费 Live；
- 精确清理、gates=false、credentials absent、volumes retained；
- 推送 main 并确认本地/远程 SHA parity。

V7 R4 一次性名额已经消费。禁止再次执行 V7 Live、seal/recovery、额外 Provider 探测或把 R3 Mock 与
Tutor 单条成功拼接为通过。下一原子任务只能先建立新的独立 zero-provider 复盘/设计；Phase 6.9.8、
Phase 6.10、Phase 8/9 与两篇面试学习博客继续等待 Phase 6.9.7 和全部 Agent 架构完成。
