# Phase 6.9.7 Architecture Recovery Provider Canary V2 实施计划

日期：2026-07-30

当前状态：D0/C1/C2/S1/L1 已完成；唯一 L1 已成功封存，下一步仅 P1 zero-provider 小样本语义门设计

设计 authority：
`docs/superpowers/specs/phase-6-9-7-architecture-recovery-provider-canary-v2-design.md`

历史 R3 run `253a5df5-c443-4950-b517-849efb941728` 已失败封存且不得重跑。当前 proxy preflight 已从历史
`loopback_proxy_unavailable` 变为一次新的 `loopback_proxy_ready / providerCalls=0` 本地诊断；这不产生
Provider/network/Agent/product authority。

## D0：Re-entry 设计与身份冻结

状态：[x] 完成，zero-provider。

交付：

- 冻结 Provider Canary V2 namespace，不复用旧 R3/R4 confirmation、marker、journal、artifact 或 recovery；
- 冻结 `preflight -> source -> credential -> marker -> single dispatch -> terminal -> publication` 顺序；
- 冻结 preflight success 只生成进程内 opaque attestation，不持久化 proxy URL/port 或网络健康结论；
- 冻结 fact-free request、DeepSeek V4 Pro、5000ms、`1/512/16`、`0.00200000 CNY` 和 no retry；
- 冻结 V2 专用 approval、credential、confirmation 和 evidence prefix；
- 冻结 C1/C2/S1/L1/P1 路线、测试矩阵、R3 SHA parity 与 exact authorization 停止门。

验收：
`docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-d0-reentry-design.md`

## C1：Proxy-capability-bound Zero-network Contract

状态：[x] 完成，zero-network / zero-provider。

范围：

- 新增 V2 request/proxy-attestation/budget/report contract 与 strict schema；
- preflight ready 才能 mint 一次消费的 opaque capability，调用方不能伪造 plain `{ok:true}`；
- credential accessor、source reader、marker writer 与 Provider delegate 在 preflight failure 前均为 0-call；
- 复用 R1 subtype、R2 fact-free semantics 与 V7 wire，但 V2 顶层 identity 独立；
- 实现 closed synthetic fault matrix，覆盖 ready/non-ready、hostile env、abort/hang、capability replay/concurrency；
- CLI 只允许 zero-network `mock/fault-matrix`，明确拒绝 Live、credential、URL、proxy override、retry、output。

通过门：focused、R2/R3/proxy regression、AI full、typecheck/lint/Prettier/diff、R3 SHA/validator parity；无
credential、Provider、marker/journal/artifact、Docker/API/browser。

实际证据：focused `13/13`（`117` assertions）、closed fault matrix `15/15`、Recovery regression `59/59`
（`566` assertions）、AI full `291/291`（`2152` assertions）、typecheck/lint/Prettier/diff、R2/R3/V2
双向 identity rejection、进程内 opaque capability single-consume 与全 downstream/wire 0-call 均通过。验收见
`docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-c1-zero-network-contract.md`。

## C2：独立 One-shot / Durability / Evidence

状态：[x] 完成，zero-provider。

范围：

- 新增 V2 source、CLI、approval、credential、marker、hash-chain journal、artifact、validator 与 crash-only seal；
- 公开 CLI 固定 production ports，不接受 fetch/URL/model/clock/UUID/writer/output/retry 注入；
- source gate 要求固定分支、tracked clean、`HEAD == @{u}` 与 remote parity；
- proxy preflight 在 credential read、marker、reservation 之前执行；
- marker `wx`、attempt reservation fsync、single dispatch/no retry、bounded terminal、exclusive publish；
- crash-only seal 不读 credential、不构造 transport、不 resume/replay Provider；
- V2/R3 双向 lineage、filename、confirmation、artifact 与 recovery rejection。

通过门：只运行 fake ports/synthetic transport；V2 正式 marker/journal/artifact 数量为 0；R3 与 V1--V9
sealed evidence 不变。

实际证据：C2 focused `32/32`（`214` assertions）；固定 public composition、package testing seam 隔离、
preflight/source/approval/credential/reservation 顺序、single dispatch/no retry、abort/timeout/late completion、
exclusive marker、hash-chain journal、hard-link publication、live-owner reject、dead-owner single-winner seal、
terminal recovery、journal drift 与 publication fail-closed 均通过。验收见
`docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-one-shot-durability.md`。

## S1：Branch Static / Zero-provider Checkpoint

状态：[x] 完成，zero-provider。

范围：

- fresh C1/C2 focused 与 fault matrix；
- AI full、typecheck/lint、Prettier、diff；
- R2/R3/proxy regression 与 R3 bundle/SHA parity；
- tracked worktree clean、branch/upstream/remote parity；
- V2 marker/journal/artifact/recovery claim 全为 0；
- 至少三路独立 contract/security/test/docs 终审；
- 同步 AGENTS、DEVLOG、README、roadmap、data-flow、dev-start、AI acceptance、checklist。

S1 完成后提交并推送，必须停止在 L1 exact authorization 门前。

实际证据：Architecture Recovery `91/91`（`780` assertions）、AI full `323/323`（`2366`
assertions）、typecheck/lint/Prettier/diff、R3 validator/SHA、正式 V2 artifact=0 与独立实现/安全/文档复审均
通过；相关项目文档已同步。该 checkpoint 当时停止在 L1 授权门前。

## L1：唯一 Provider Canary V2 Controlled-Live

状态：[x] 唯一运行已完成并封存，不得重跑。

前置必须全部成立：

- 用户重新接受运行当时 DeepSeek 数据保留/训练边界；
- 用户给出 exact confirmation：
  `I_AUTHORIZE_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_ONCE`；
- S1 commit 已推送，source/remote parity 与 V2 artifact=0 通过；
- zero-provider proxy preflight fresh ready；
- 专用 approval/credential 只映射到单个授权进程且不写 `.env`。

运行最多一次 fact-free dispatch。无论 complete、transport、HTTP、schema、usage、abort、timeout 或 I/O 终态，
都必须封存且不得 retry/resume/replay/backfill。普通“继续”“开始”“同意”不是 L1 授权。

实际证据：用户重新接受运行时 DeepSeek 数据边界并给出 exact confirmation 后，唯一 run
`dc09214c-0300-4153-8273-e548ac768d20` 在 source commit `8d463e8c...` 上完成。结果为
`complete / strict_response_with_verified_usage`，response/strict 均为 `true`，wire `1/1/1/1`，usage
`49/5`，费用 `0.00017700 CNY`。Journal `12` 条并以 `evidence_published` 收口，validator
`ok=true / evidenceCount=1`，artifact SHA 为 `98368de...a7e4`；`status=diagnostic_only /
qualityAuthority=none`。验收见
`docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-l1-success-diagnostic-only.md`。

## P1：L1 后路线决策

状态：[ ] 已由 L1 success 解锁，但当前仅允许 zero-provider 设计，不允许执行 semantic eval。

- L1 已完整观察 strict response 与 verified usage：下一原子任务只规划新的小样本 semantic gate；
- L1 其它终态：回到独立 zero-provider 架构决策；
- 任何情况下都不直接进入 48-case、产品 Docker/API/browser、main、Phase 6.9.8/6.10/8/9；
- 任何情况下都不改写 R3、V9 或其它 sealed evidence。
