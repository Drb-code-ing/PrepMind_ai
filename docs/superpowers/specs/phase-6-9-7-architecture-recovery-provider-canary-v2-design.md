# Phase 6.9.7 Architecture Recovery Provider Canary V2 Re-entry 设计

日期：2026-07-30

状态：D0/C1/C2/S1 已完成，zero-provider；当前停在尚未授权的 L1 controlled-Live 门前

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

起始提交：`32c78d52fa75c868b07d2933f3a0cb0f7f29daee`

历史 authority：

- R3 failure：
  `docs/acceptance/2026-07-30-phase-6-9-7-architecture-recovery-r3-controlled-live-failure.md`
- R3 sealed run：`253a5df5-c443-4950-b517-849efb941728`
- proxy preflight：
  `docs/acceptance/2026-07-30-phase-6-9-7-architecture-recovery-proxy-preflight.md`

本文件不授权读取 credential、调用 Provider、创建正式 marker/journal/artifact、运行 Tutor/Organizer
小样本或 48-case、启动产品 Docker/API/browser、修改业务数据、合并 main，或执行任何 R3
retry/resume/replay/backfill/seal/recovery。

## 1. 决策摘要

R3 已经以一次 durable dispatch、零 HTTP Response 和
`transport_failed / connection_refused` 正常封存。后续 zero-provider proxy preflight 首次确认当前
loopback 端口无人监听；宿主代理程序恢复后，同一安全 preflight 又得到：

```text
loopback_proxy_ready / configured=4 / probe=1 / providerCalls=0
```

这证明新的外部调用路线已经满足一个**本地 TCP 前置条件**，但仍不能证明代理转发、DNS、TLS、DeepSeek
HTTP、账号、余额、模型权限、限流或服务端健康。不能复用已经消费的 R3，也不能直接回到原计划 R4。

新路线命名为 **Provider Canary V2**。它只做一件事：在全新一次性 authority 下执行最多一次 fact-free
DeepSeek V4 Pro health canary，判断是否能观察到 strict response 和 verified usage。它不运行 Agent
semantic eval，不接产品，不把 listener ready 写成 Provider health。

为避免与旧 R3/R4 混淆，V2 使用语义阶段名：

| 阶段 | 目的                                                       |
| ---- | ---------------------------------------------------------- |
| D0   | 冻结 re-entry 设计、边界、身份与执行顺序                   |
| C1   | 实现 proxy-capability-bound zero-network contract/faults   |
| C2   | 实现独立 one-shot CLI、marker、journal、artifact/validator |
| S1   | 完成 branch static/zero-provider checkpoint 与终审         |
| L1   | 用户重新确认数据边界并精确授权唯一 controlled-Live         |
| P1   | 仅按 L1 终态决定是否规划小样本 semantic gate               |

截至 2026-07-30，D0/C1/C2/S1 已完成。C1 落地独立 request/proxy-attestation/budget/report identity、
进程内 single-consume capability、15-case closed synthetic fault matrix 与只允许 `mock/fault-matrix` 的
CLI。C2 又完成固定 production composition、source、专用授权、exclusive marker、hash-chain journal、
bounded terminal、hard-link artifact、strict validator 与 crash-only seal；S1 完成 branch zero-provider 静态门与
终审。项目根正式 V2 artifact 保持 0，下一步只能是新的 L1 exact authorization。

## 2. 已知事实与不可推导事项

已知事实：

- R3 sealed artifact 证明 executor/dispatch/response/usage 为 `1/1/0/0`；
- R3 bounded subtype 为 `connection_refused`，但 artifact 不保存 socket peer；
- 旧宿主快照中四个 HTTP(S) proxy 变量一致指向 loopback，监听为 0；
- 当前重新运行的 preflight 为 `loopback_proxy_ready`，Provider call 仍为 0；
- R3 marker、journal、artifact SHA 与 validator 仍保持不变。

不可推导：

- 不能把当前 listener 认定为 R3 当时实际拒绝连接的唯一 socket；
- 不能由 TCP accept 推导代理能转发 HTTPS；
- 不能由代理进程存在推导 DNS/TLS/Provider/账号健康；
- 不能把下一次 canary success 推导为 Tutor/Organizer semantic 或产品可用；
- 不能把下一次 canary failure 回填、覆盖或解释为 R3/V9 的新证据。

## 3. 独立 identity

V2 顶层 namespace 固定为：

```text
phase-6.9.7-architecture-recovery-provider-canary-v2
```

C1/C2 必须在该 namespace 下分别版本化 request、proxy attestation、budget、report、source、marker、journal、
artifact、validator 和 CLI。以下旧 identity 一律只能作为只读历史依赖或 parity target，不能作为 V2
authority：

- `phase-6.9.7-architecture-recovery-r2-provider-canary-*`；
- `phase-6.9.7-architecture-recovery-r3-provider-canary-*`；
- 旧 R3 approval、credential、confirmation、marker、journal、claim、artifact；
- Tutor/Organizer V1--V9 runner、marker、journal、evidence 与 recovery。

V2 未来专用运行入口冻结为：

```text
approval env:
PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_APPROVED=true

credential env:
PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_DEEPSEEK_API_KEY

exact confirmation:
I_AUTHORIZE_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_ONCE
```

这些名称在 S1 之前只用于拒绝路径测试；不得写入根 `.env`，不得提前运行。

V2 正式本机证据路径冻结为新的前缀：

```text
.tmp/phase-6-9-7-architecture-recovery-provider-canary-v2.once.json
.tmp/phase-6-9-7-architecture-recovery-provider-canary-v2.journal.jsonl
.tmp/phase-6-9-7-architecture-recovery-provider-canary-v2-<runId>.json
.tmp/phase-6-9-7-architecture-recovery-provider-canary-v2.recovery.json
```

任何 V2 reader/validator 都必须拒绝 R2/R3/V1--V9 文件名、version、run lineage 和旧 confirmation。

## 4. 最小能力复用与隔离

允许复用的纯工程能力：

- R1 固定九类 transport subtype 的 no-raw diagnostic projection；
- R2 fact-free prompt、strict `{ "ok": true }` schema 与 `1/512/16` 预算语义；
- V7 八阶段 wire capability 和 executor/dispatch/response/verified-usage 四类独立计数；
- 当前 proxy preflight 的八变量 allowlist、loopback-only parser 与 250ms watchdog；
- 仓库已有 SHA-256、exclusive-create、fsync、hard-link 与 source-parity 工具的实现经验。

必须独立实现或显式版本化：

- V2 top-level request/report/artifact/source identity；
- preflight success 产生的不可伪造、单次消费 proxy attestation；
- V2 marker/journal/artifact/recovery path 与 validator；
- V2 approval、credential、confirmation 和 package script；
- V2 source manifest 与 R3 sealed parity 检查。

C1/C2 不导入 R3 顶层 contract、R3 marker/journal/artifact identity，且不修改 R3
contract/runner/durability/CLI。R3 只通过物理 SHA 与既有 validator 做只读 parity。

C1 实际边界不包含 source、approval、credential reader、marker、journal、artifact、validator、recovery、fetch
或 Provider delegate。Preflight ready 后仅在模块私有 `WeakMap` 中绑定一个空对象 capability；同步消费使第一
个调用方成为唯一胜者，clone、伪造、replay 与并发其余消费者全部拒绝。V7 wire 固定 `not_started`，所有
executor/dispatch/response/usage 与 downstream counter 为 0，budget 未 reservation，实际 usage/费用为 `null`。

## 5. 固定执行顺序

V2 默认 composition 的顺序不可交换：

```text
exact CLI argument validation
  -> snapshot only 8 proxy / NO_PROXY keys
  -> zero-provider proxy preflight
       -> not ready: stop, no credential read, no source reader, no marker
       -> ready: mint one opaque in-memory proxy attestation
  -> fixed branch + tracked clean + HEAD == tracking/remote source checks
  -> read V2 approval and dedicated credential only
  -> validate credential shape without logging it
  -> exclusive-create V2 marker
  -> append attempt_reserved + proxy/source hashes + fsync
  -> construct fixed first-party DeepSeek transport
  -> append provider_dispatch_started before delegate boundary
  -> at most one fact-free dispatch, no retry/resume/replay/backfill
  -> append bounded terminal report
  -> exclusive artifact publish + strict validation
```

为什么 preflight 必须早于 credential：如果本地 listener 已知不可用，就没有理由让进程读取模型密钥、创建
一次性 marker 或消耗 Provider authority。为什么 source 检查仍在 credential 前：dirty/ahead/behind/错误分支
同样属于本地可判定的零调用拒绝条件。

Proxy attestation 只在当前进程内有效，固定记录 preflight version、mode、configured count、listener
disposition、probe count 与 `providerCalls=0`，不保存 URL/host/port。它不是认证 token，也不能跨进程持久化为
“网络健康”。Listener 在 preflight 后消失属于正常 TOCTOU；唯一 dispatch 若因此失败，V2 只按真实 wire
prefix 封存，不重跑。

## 6. Canary request、模型与预算

L1 固定：

```text
model: deepseek-v4-pro
endpoint: https://api.deepseek.com/v1/chat/completions
thinking: disabled
response format: JSON object
stream/tools/retry: false / none / 0
timeout: 5000ms
system: Return exactly one JSON object with ok=true. Use no tools or external facts.
user: Run the fact-free provider health canary.
schema: { "ok": true }
budget: 1 call / 512 input / 16 output / 0.00200000 CNY
```

模型、URL、timeout、budget、output path、fetch、proxy、retry 和 response schema 都不能由 CLI 参数覆盖。
Verified usage 缺失或非法时，即使 content 为 `{ "ok": true }` 也不是 `complete`；实际 token、费用与 cap
结论保持 `null`，不能伪造为 0。

## 7. Failure 与 durability

V2 report 只保留 fixed enum、boolean、counter、nullable verified usage/cost、source hash 和 SHA 关联；禁止
prompt、response body、raw error、message、stack、URL、header、credential、proxy URL/port、DNS address、
socket peer 或模型原始输出。

固定失败大类：

- `preflight_rejected`：proxy、source、approval 或 credential 在 marker 前失败；
- `not_dispatched`：marker 已保留，但 executor/dispatch 前终止；
- `dispatched_no_response`：dispatch 已 durable，未观察 Response；
- `response_observed`：观察 Response，但 HTTP/JSON/schema/usage 未完整通过；
- `complete`：strict content、verified usage、预算与 artifact 全部通过；
- `evidence_io`：durable publication 或 validation 失败。

Marker 一旦成功创建，L1 名额即消费。进程崩溃只允许使用 V2 专用 zero-provider seal：读取 durable prefix、
校验 owner 不再存活、获得单胜者 claim，并封存同一 attempt；它不得读取 credential、构造 transport、调用
Provider 或补发请求。若 `publication_started` 已 durable，则任何后续 I/O failure 永久 fail-closed，不二次
publish。R3 seal 命令对 V2 无效，V2 seal 命令也必须拒绝 R3 文件。

## 8. Source 与 sealed parity

S1/L1 source gate 固定要求：

- branch 精确为 `codex/phase-6-9-7-tutor-wrong-question-agents`；
- tracked worktree clean；用户未跟踪 `.codex/config.toml` 保留且不提交；
- `HEAD == @{u}`，并显式核对远程 ref parity；
- V2 marker/journal/artifact/recovery claim 数量为 0；
- R3 bundle validator 仍 `ok=true`；
- R3 marker/journal/artifact 物理 SHA 保持：
  `6eef1a...89b6a / 426d64...7f7b / 56fb5b...e6c4`；
- V1--V9 sealed evidence 与 validators 不被 V2 source 变更触碰。

## 9. 测试与审查门

C1 必须覆盖：

- direct/loopback-ready/non-ready/abort/hang/hostile env；
- ready 仍为 `providerCalls=0`，且不能伪造为 Provider health；
- preflight failure 前 credential getter/read counter 为 0；
- opaque attestation single-consume、replay/concurrency 拒绝；
- V2 identity 与 R2/R3 双向 schema/version rejection；
- raw proxy/credential/error 不进入 report/stdout。

C2/S1 必须覆盖：

- exact args/approval/credential/source gate 顺序；
- marker/journal/dispatch/terminal/publication monotonicity；
- single dispatch/no retry、pre/in-flight abort、timeout 与 late completion；
- crash-only seal、活 owner拒绝、single-winner、journal drift 与 publication fail-closed；
- V2 与 R3 marker/journal/artifact/confirmation 双向隔离；
- R3 SHA/validator parity；
- AI focused/full、typecheck、lint、Prettier、`git diff --check`；
- 至少三路独立 contract/security/test/docs 复审无未关闭 Critical/Important。

所有 C1/C2/S1 测试必须使用进程内 synthetic/fake ports，`providerCalls=0`，不读取真实 credential，不启动
Docker/API/browser。

C1 fresh 验收为 focused `13/13`（`117` assertions）与 fault matrix `15/15`；有效 R2/R3 report 与 V2 report
已完成双向 identity rejection。C1 验收见
`docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-c1-zero-network-contract.md`。

C2/S1 fresh 验收为 C2 focused `32/32`（`214` assertions）、Recovery regression `91/91`（`780`
assertions）、AI full `323/323`（`2366` assertions），typecheck/lint/Prettier/diff 均通过；正式 V2
marker/journal/artifact/recovery claim 为 0，R3 validator 与三份物理 SHA 不变。验收见
`docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-one-shot-durability.md`。

## 10. 停止门与后续决策

S1 已完成并提交、推送；当前必须停止。L1 只能在用户重新接受**运行当时** DeepSeek 数据保留/训练边界，并给出
冻结 exact confirmation 后执行一次。普通“继续”“开始”“同意”不能替代 L1 精确授权。

L1 终态处理：

- `complete + response observed + verified usage + artifact valid`：只允许规划新的小样本 Tutor/Organizer
  semantic gate；仍不直接运行 48-case、产品或 main；
- 任何其它终态：正常封存 V2，禁止 retry/resume/replay/backfill，并回到零 Provider 架构决策；
- 无论结果如何，都不改写 R3、V9 或其它历史 evidence。

回顾时可以问：

- 为什么 listener ready 之后仍需新的 V2 identity 和精确授权？
- 为什么 proxy preflight 必须发生在 credential read 和 marker reservation 之前？
- 为什么 V2 success 也只能解锁小样本设计，而不能直接证明 Agent 可用？
- 为什么 V2 不复用 R3 marker/journal/artifact，即使底层工程思想相同？
- 为什么 preflight 后 listener 消失应封存失败，而不是自动重试？
