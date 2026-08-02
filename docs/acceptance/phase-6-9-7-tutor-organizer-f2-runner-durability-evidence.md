# Phase 6.9.7 Tutor / Organizer F2 Runner / Durability / Evidence 验收

日期：2026-08-01

状态：F2 验收完成；后续 S3 已完成，唯一 L3 已失败封存

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

F1 基线提交：`4a1873f63187e5158f60295b2e5de962f0328c59`

## 1. 结论与 authority

F2 已把 F1 的 full manifest/report/scorer/gate 接入独立的 production CLI、source admission、完整
24-guard/24-pair runner、exclusive marker、fsynced hash-chain journal、hard-link artifact、strict bundle
validator 与 crash-only seal。实现和测试均在 zero-provider 边界内完成，没有读取 `.env` 或 credential，没有
调用 Provider，也没有创建正式 full-gate evidence。

```text
checkpoint authority: zero_provider_full_runner_durability_evidence
lineage: phase-6.9.7-tutor-organizer-full-gate-v1
providerCalls: 0
approved S3 tag: 0
formal marker/journal/artifact/recovery claim: 0/0/0/0
reviewed Mock / controlled-Live: not run / not run
Docker/API/browser/main: not run / not run / not run / not merged
```

该 authority 只证明 one-shot 执行和证据持久化合同已实现并通过 synthetic fault tests；不证明 DeepSeek
可达、真实 Tutor/Organizer 语义、48-case 质量、P95、费用、产品 API/页面或生产可用性。

## 2. 本次交付

新增 production/eval 源码：

- `packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-authority.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-cli-core.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-durability.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-live.ts`；
- `packages/agent/src/evals/run-phase-6-9-tutor-organizer-full-gate.ts`；
- `packages/agent/scripts/phase-6-9-7-tutor-organizer-full-gate-cli.ts`；
- `packages/agent/scripts/validate-phase-6-9-7-tutor-organizer-full-gate-evidence.ts`。

新增四组 focused tests 与共享 fixture，覆盖 CLI/authority、runner、durability、lineage/security；同时在
`packages/agent/package.json` 增加 `full-gate:cli/live/seal/validate` 固定入口。`live` script 没有内嵌 exact
confirmation，直接运行会在 preflight 前 fail-closed；本阶段没有运行 `live` 或 `seal`。

## 3. Admission 与权限边界

Public production CLI 只接收 `args + AbortSignal`。repository root、process env、clock、UUID、writer、模型、
URL、adapter、transport、runner、durability 与 validator ports 均由 production composition 固定，调用方不能
注入 fetch、model、URL、root、env、retry、resume 或 evidence path。

正常 admission 顺序固定为：

```text
exact CLI confirmation
  -> zero-provider proxy preflight + opaque single consume
  -> source admission
  -> dedicated approval
  -> dedicated credential
  -> exclusive marker + initial fsynced journal
  -> 24 guards
  -> 24 serial pairs / 48 runtime lanes
  -> run terminal
  -> hard-link publication
  -> strict bundle validation
```

Source admission 要求：

- 当前分支必须是 `codex/phase-6-9-7-tutor-wrong-question-agents`；
- tracked worktree clean，且 `HEAD == upstream == remote == approved tag commit`；
- approved ref 固定为 `refs/tags/phase-6-9-7-tutor-organizer-full-gate-s3-approved`；
- 七个 Tutor/Organizer/adapter source hash 必须等于 F1 冻结值；
- 正式 full-gate marker/journal/artifact/recovery 文件数必须为 0。

S3 approved tag 当前不存在，因此未来 production path 会在 approval、credential 和 marker 前 fail-closed。
F2 没有创建、移动或推送该 tag。专用 approval env
`PHASE_6_9_7_TUTOR_ORGANIZER_FULL_GATE_L3_APPROVED` 的值必须精确等于 L3 exact confirmation；专用
credential 只接受 `PHASE_6_9_7_TUTOR_ORGANIZER_FULL_GATE_L3_DEEPSEEK_API_KEY`，不能借用 generic 或其它
Agent key。

## 4. Runner、并发与任务守恒

Runner 直接消费 F1 固定 manifest 与 strict report builder，不另行解释分母、semantic、P95、usage、费用或
gate：

- 先按固定顺序完成 `24` 条 guard；任一 guard 未证明 actual zero-call，则 `48` 条 runtime 全部保持
  zero-wire `not_started_quality_breaker`；
- guard 全通过后按 `pairedRunIndex=0..23` 串行推进 `24` 对；每对 Tutor/Organizer 最大并发 2；
- 每条 lane 独立创建 budget、AbortController、`3500/5000ms` hard timeout、wire capability 与 terminal；
- `lane_reserved` 必须 durable 后才跨 harness boundary；wire stage 由第一方 adapter 单调提交；
- Tutor 额外记录 local orchestration duration，Organizer 对应字段必须为 `null`；
- semantic mismatch 不开 breaker；transport/HTTP/schema/usage/timeout/abort/internal 等 contract failure 先收口
  当前 pair 的两个 terminal，再把后续 lane 固定为 `not_started_quality_breaker`；
- 父请求取消使用 `external_abort`，与 lane-local `abort`/`timeout` 分开；
- terminal append I/O 失败不在进程内重试，留下可由 crash-only seal 解释的 durable prefix；
- 最终仍由 F1 report builder 重算 72-entry fixed denominator，不能删除失败或未启动 entry。

测试覆盖正常 `24/24` guard、`48/48` runtime/wire/usage，semantic mismatch 后继续执行、首 pair contract
failure 后 `2` reserved/terminal + `46` not-started、guard failure 的 runtime zero-call、四类 Provider failure、
双 hard timeout、父取消、terminal append failure 与 no-retry。

## 5. Durability、publication 与 crash-only seal

正式 bundle 使用独立 L3 namespace：

```text
marker: .tmp/phase-6-9-7-tutor-organizer-full-gate-l3-controlled-live.marker
journal: .tmp/phase-6-9-7-tutor-organizer-full-gate-l3-controlled-live-<runId>.journal.jsonl
claim: .tmp/phase-6-9-7-tutor-organizer-full-gate-l3-controlled-live-<runId>.recovery.claim
artifact: .tmp/phase-6-9-7-tutor-organizer-full-gate-l3-<scope>-controlled-live-<runId>.json
```

- marker、journal、claim 与 artifact 临时文件使用 exclusive create；普通文件、symlink、目录或路径逃逸均拒绝；
- journal 对 `attempt_reserved / guard_terminal / lane_reserved / wire_stage / lane_terminal /
lane_not_started / pair_terminal / recovery_claimed / run_terminal / publication_started /
evidence_published` 逐条编号、前向 hash-chain 并执行 file fsync；
- artifact 先写入并 fsync 临时普通文件，再用 exclusive hard link 发布；`publication_started` 后冲突或 I/O
  failure 永久 fail-closed，不二次发布；
- strict validator 从 marker/journal/source/case entries 重新构建 report，并重算 runtime accounting、wire、
  semantic、P95、usage、CNY、gate、logical SHA 与 physical artifact SHA；同时拒绝 truncated/CRLF/hash rewrite、
  重复 claim、额外正式文件或 artifact 自报 aggregate；
- crash-only seal 不执行 preflight、不读取 approval/credential、不构造 harness/transport，也不调用 Provider。
  它只为当前已打开或待锚定 pair 补零-wire reservation/`attempted_aborted` terminal，后续 pair 保持
  `not_started_quality_breaker`；若 run terminal 已 durable，只允许原 report publication recovery；
- dead-owner claim 使用 single-winner fencing；live owner、stale claim、journal drift、duplicate claim 与
  `publication_started` 后恢复均 fail-closed。

该合同仍是 trusted single-user workspace 内的单机本地 durability，不宣称跨主机 distributed lease、Provider
exactly-once 或突然断电后的目录项持久性。

## 6. 验证记录

```text
Focused F2: 32 pass / 0 fail / 2105 assertions
Agent full: 1108 pass / 0 fail / 20172 assertions / 132 files
Agent typecheck: PASS
Agent lint: PASS
Changed-file Prettier: PASS
git diff --check: PASS
historical validators / SHA parity: PASS
formal approved tag/marker/journal/artifact/recovery claim: 0/0/0/0/0
Provider / credential / Docker / API / browser calls: 0/0/0/0/0
```

Focused 的 32 个测试分为：

- CLI/source/approval/credential/public-entry authority：`9`；
- 24-guard/24-pair runner、breaker/timeout/abort/no-retry：`9`；
- marker/journal/publication/recovery/hostile filesystem：`10`；
- full-gate 与 V1--V9/R3/Canary/Small-sample 双向 lineage/security：`4`。

两路独立只读复审没有发现阻断项：source admission、48-lane accounting、wire/timeout/budget、hash-chain、
exclusive marker、hard-link publication、crash seal、validator 与 zero-provider 边界均有对应实现和测试。Approval
env 的值等于 exact confirmation 是本 F2 实现的明确约定，已由 focused test 固定，并在本页与运维文档同步。

## 7. 本阶段未做与下一步

F2 没有执行正式 reviewed Mock、controlled-Live、curl、单 case或其它 Provider 探测；没有读取 credential、创建
approved tag/正式 bundle、启动 Docker/API/browser、创建账号/Trace/业务数据、合并 main 或推进 Phase 6.9.8。

S3 已按上述边界完成 reviewed Mock/static checkpoint：真实穿过两条受治理 candidate、第一方 adapter 的
synthetic fetch seam、strict validator、本地 merger 与 F2 runner，并完成 full/anchor semantic、P95、预算、
breaker、abort、locked-name/no-write、anti-overfit、全量静态、历史 parity 与 Reader Testing。S3 仍是
zero-provider，不创建 approved tag；完整证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-s3-reviewed-mock-static.md`。

后续 L3 已在 fresh admission 下执行唯一 run `2b0ac3a0...`，但 Tutor schema failure 在 22/48 lane 后打开
breaker，最终 `full_gate_quality_gate_failed / qualityAuthority=none`。本 identity 不得重跑，产品
Docker/API/可见浏览器验收继续阻断；详见
`docs/acceptance/phase-6-9-7-tutor-organizer-l3-controlled-live-quality-gate-failure.md`。

后续 Schema Recovery SR0 已冻结独立 schema-recovery-v1 lineage 与 bounded schema stage journal/validator
设计；它不修改 F2/L3 runner、journal 或 artifact。其后 SR1--SR4 的 TDD、robustness、独立
runner/lineage/durability 与 reviewed Mock/static 已 zero-provider 完成。SR4 只具有 Mock authority。唯一 SR5
run `63f8a76b...04cb` 随后以 `schema_recovery_full_gate_semantic_gate` durable seal；它不覆盖本页或 L3/SR4
历史，且不形成产品 authority。当前下一任务仅 SR6 分支产品验收。见
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r5-controlled-live-quality-gate-pass.md`。

回顾时可以问：

- 为什么 `lane_reserved` 必须在跨 harness boundary 前 fsync？
- 为什么 pair 内允许双 lane，而 pair 之间必须串行？
- 为什么 semantic mismatch 不 breaker，contract failure 却要在收口 sibling 后 breaker？
- 为什么 crash-only seal 只能解释 durable prefix，不能 resume/replay Provider？
- 为什么 F2 有完整 production CLI，仍不能宣称真实模型或产品可用？
