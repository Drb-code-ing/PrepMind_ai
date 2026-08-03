# Phase 6.9.7 Architecture Recovery Provider Canary V2 C2/S1 验收

日期：2026-07-30

状态：C2 与 S1 已完成，zero-provider；下一步停在 L1 新数据边界与 exact authorization 门前

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 为什么需要 C2

C1 只证明了 proxy preflight、opaque attestation 和 closed synthetic contract；它没有提供一次真实
controlled-Live 应有的一次性名额、durable dispatch、崩溃收口和不可覆盖 evidence。若直接进入 Provider，
进程崩溃、并发运行或发布失败会留下“是否调用过、是否还能重跑、哪份 evidence 有 authority”无法回答的窗口。

C2 因此先完成独立 V2 one-shot 边界。它不是一次 Live，也不证明 Provider、Tutor/Organizer 或产品可用；它只
证明未来 L1 若获精确授权，最多一次 fact-free dispatch 能按固定顺序进入 durable terminal，并在正常或崩溃
路径上 fail-closed 封存。

## 2. 已完成的工程边界

固定 production composition：

```text
exact args
  -> 8-key proxy snapshot and zero-provider preflight
  -> source branch/tracking/remote/R3 parity
  -> approval and dedicated credential
  -> exclusive marker and fsynced attempt reservation
  -> one fixed first-party transport, no retry/resume/replay
  -> monotonic 8-stage wire journal and bounded terminal
  -> exclusive hard-link artifact publication and strict validation
```

实现包括：

- V2 独立 source/report/marker/journal/artifact/recovery/version/filename/confirmation；
- public CLI 只接收 `args + AbortSignal`，调用者不能注入 root、env、fetch、URL、model、proxy、timeout、
  clock、UUID、writer、output、retry、resume 或 replay；
- 测试注入 seam 独立存在且不从 `@repo/ai` package index 导出；
- marker 使用 exclusive create；journal 使用 sequence、previous hash、record hash 与每次 append 后 fsync；
- wire stage 单调，dispatch stage 必须在 delegate boundary 前 durable；single terminal 与 single publication
  各只有一个胜者；
- artifact 由 source/proxy/report/terminal 的实际 SHA 关联构建，不能由调用方提供任意 terminal report SHA；
- `publication_started` 一旦 durable，后续失败永久 `evidence_io`，不允许二次发布；
- crash-only seal 不执行 preflight、不读 credential、不构造 transport、不调用 Provider；活 owner 拒绝，死
  owner 由 single-winner claim 收口；已有 runtime terminal 只允许原样完成 publication recovery；
- V2 与 R3 的 confirmation、marker、journal、artifact、recovery filename/schema 双向隔离；R3 顶层
  contract、runner、durability、CLI 与 sealed artifact 未改写。

## 3. 验证结果

```text
C2 focused: 32/32 passed, 214 assertions
Architecture Recovery regression: 91/91 passed, 780 assertions
AI full: 323/323 passed, 2366 assertions
AI typecheck: passed
AI lint: passed
Prettier: passed
git diff --check: passed
```

重点 fault 覆盖：

- preflight failure 前 source/approval/credential/marker/fake runtime 全 0-call；
- source 在 approval 前，approval 在 dedicated credential 前；
- invalid credential、额外参数与所有 override shape 在 reservation 前拒绝；
- single dispatch/no retry、pre/in-flight abort、timeout、late completion 与 forged transport；
- exclusive marker、journal creation failure、wire out-of-order、terminal/publication race；
- live-owner reject、dead-owner single-winner seal、terminal-before-publication recovery；
- journal drift、R3-only root rejection 与 `publication_started` 永久 fail-closed；
- public package 导出 production CLI，但不导出 CLI core 或 testing seam。

所有 runtime/publication 成功路径都只发生在系统临时目录的 fake-port 测试根中，并在测试后精确删除。测试
seam 为覆盖 production state machine 会返回 controlled-live-shaped synthetic fixture；它不是正式 V2 artifact，
也不产生 `controlled_live` authority。

## 4. Zero-provider 与历史证据

本阶段没有：

- 读取根 `.env` 或真实 DeepSeek credential；
- 调用 Provider、curl、产品 API 或 Tutor/Organizer runner；
- 启动 Docker、server、web 或浏览器；
- 创建项目根目录正式 V2 marker、journal、artifact 或 recovery claim；
- 运行 R3 retry/resume/replay/backfill/seal/recovery；
- 删除、改写或拼接 V1--V9 sealed evidence。

项目根目录正式 V2 文件数量保持 `0`。R3 bundle 仍为：

```text
validator: ok=true
runId: 253a5df5-c443-4950-b517-849efb941728
marker SHA-256:   6eef1a3244b162e42fb784f7601e3518653fc40297735cfeb8ed2c2eb0c89b6a
journal SHA-256:  426d64622ef71b88aa4154ca479fcc823d0d23a90c6f7daae0bb4a3cebcb7f7b
artifact SHA-256: 56fb5b1d196d2af9cc4aab5476d766d87ca9d794896e3c93df9268d13e62e6c4
```

这些 SHA 只证明 sealed R3 bytes 未变。C2/S1 的 synthetic success 不能覆盖 R3 的
`transport_failed / connection_refused`，也不能把当前 proxy listener ready 升级为 Provider health。

## 5. S1 发布门与下一步

S1 在提交、推送后按同一 source reader 复核固定分支、tracked clean、`HEAD == @{u}`、真实 remote ref、
正式 V2 artifact=0、R3 validator 与三份物理 SHA。用户未跟踪的 `.codex/config.toml` 保留且不提交。

S1 完成后必须停止。普通“继续”“开始”“同意”均不授权 L1。唯一可接受的 L1 confirmation 是：

```text
I_AUTHORIZE_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_ONCE
```

并且用户必须重新接受**运行当时** DeepSeek 当前账号的数据保留/训练边界。即使未来 L1 得到 strict response
与 verified usage，也只允许规划新的小样本 Tutor/Organizer semantic gate，不能直接运行 48-case、产品
Docker/API/browser、合并 main 或进入 Phase 6.9.8/6.10。

回顾时可以问：

- 为什么 marker 创建就消费 L1 名额，而不是 Provider 返回后才消费？
- 为什么 `publication_started` 后不能自动重试发布？
- crash-only seal 如何避免把崩溃误写成 zero-call 或重跑资格？
- 为什么 testing seam 的 controlled-live-shaped fixture 不是 Live authority？
- 为什么 C2/S1 完成后仍必须重新确认数据边界并给出 exact authorization？
