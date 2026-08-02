# Phase 6.9.7 Tutor / Organizer P2 全量质量门实施计划

日期：2026-08-01

当前状态：P2/F1/F2/S3 已完成；后续唯一 L3 已以 `full_gate_quality_gate_failed` 封存

设计 authority：
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate-design.md`

## P2：Zero-provider full-gate 设计冻结

状态：[x] 完成，zero-provider。

交付：

- 新建独立 `phase-6.9.7-tutor-organizer-full-gate-v1` lineage；
- 固定完整 V2 dataset：72 entries、24 guards、24 pairs、48 runtime lanes、32 Organizer decisions；
- 冻结 manifest SHA `e68e6e27...12c78`；
- 现场重算 full deterministic baseline `12/48`，Tutor/Organizer/Combined
  `0.6629642857 / 0.278125 / 0.4705446429`；
- 冻结 baseline authority SHA `2ab1030f...a5f2` 与 eval policy SHA `11371d16...f503`；
- 固定 full semantic 与 improvement 门，并增加不额外调用 Provider 的 L2 anchor subset 门；
- 恢复四项 24-sample nearest-rank P95，区分 `3500/5000ms` hard timeout；
- 固定 `48 calls / 112800 input / 26400 output / 0.55 CNY` 全局 cap，其中 Tutor 为
  `28800/7200`、Organizer 为 `84000/19200`，数学最坏费用为 `0.528 CNY`；
- 固定 guard-first、pair-serial、pair 内最大并发 2、sibling terminal、breaker、任务丢失与 crash-only seal；
- 固定全新 source tag、approval、credential、confirmation、marker、journal、artifact 与 validator namespace；
- 固定 candidate/adapter hash 必须与 L2 approved source 一致；
- 明确 P2 只解锁 F1，不授权 full Live、产品或 main。

验收：
`docs/acceptance/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate.md`

## F1：Full Manifest / Baseline / Contract / Gate

状态：[x] 完成，zero-provider。

建议源码：

- `packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-manifest.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-contract.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-baseline.ts`；
- 对应 focused tests、held-out/metamorphic 与历史 lineage rejection fixtures。

必须完成：

1. 实现 exact 72-entry manifest 并现场重算 `e68e6e27...12c78`；
2. 用未修饰 deterministic functions 复现 `0ce7c3ca...116ca` 与 P2 baseline authority
   `2ab1030f...a5f2`；
3. 从 P2 的 `not_generated_in_p2` 状态生成并冻结 baseline logical report/physical file SHA，使用 fixed
   ignored path 与安全 writer；不得把 P2 authority/document hash 冒充这两个 F1 SHA；
4. 实现 strict report、full scorer、L2 anchor subset scorer 与 `11371d16...f503` policy；
5. 固定 24 guards、48 runtime、32 decisions、四维 wire、48 usage 与全部安全分母；
6. 实现恰好 24 samples 的四项 nearest-rank P95，任一不完整时 aggregate 全 `null`；
7. 实现 Mock/synthetic 永不 pass，以及 V1--V9/R3/L1/small-sample/full-gate 双向 rejection；
8. 保持 candidate/adapter 七个 source hash 与 L2 approved source 一致；
9. 完成 focused/full/typecheck/lint/Prettier、敏感扫描与独立 contract/security review；
10. 正式 full-gate marker/journal/artifact/recovery claim 保持 0。

F1 不读取 credential、不调用 Provider、不创建 approved tag、不启动 Docker/API/browser。F1 完成后独立提交并
推送，下一步才是 F2。

完成证据：manifest/source baseline/baseline authority/eval policy SHA 已精确复现
`e68e6e27...12c78 / 0ce7c3ca...116ca / 2ab1030f...a5f2 / 11371d16...f503`；baseline logical
report/physical file SHA 冻结为 `16c574b1...2c9 / 16aa1773...6f73`。Focused `14/14`、Agent full
`1076/1076`、typecheck/lint 与四路独立复审通过；Provider/credential/tag/正式 evidence/Docker 均为 0。验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-f1-full-contract-baseline.md`。

## F2：One-shot Runner / Durability / Evidence

状态：[x] 完成，zero-provider。

必须完成：

1. Public CLI 只接受固定 production args + AbortSignal；
2. preflight -> source -> approval -> dedicated credential -> marker -> guards -> pairs -> publication 顺序固定；
3. 24 guards 真实穿过 candidate guard，四维 wire 全 0；
4. 24 pairs 严格串行，pair 内最大两 lane，独立 budget/abort/timeout/terminal；
5. `lane_reserved` 与 dispatch stage 在 delegate 前 hash-chain + fsync；
6. reserved/terminal/orphan/not-started 与 48-lane fixed denominator 守恒；
7. semantic mismatch 不 breaker，contract/safety failure 收口 sibling 后 breaker；
8. exclusive marker、hard-link artifact、strict recomputing validator 与 crash-only seal；
9. fault matrix 覆盖 concurrent start、external abort、timeout、usage、publication/crash race、hostile filesystem；
10. 正式 full-gate marker/journal/artifact/recovery claim 保持 0。

完成证据：固定 production CLI/source admission、24 guards + 24 serial pairs/48 lanes、独立
budget/abort/timeout、exclusive marker、fsynced hash-chain journal、hard-link artifact、strict recomputing
validator 与 crash-only seal 均已落地。Focused `32/32`、Agent full `1108/1108`、typecheck/lint 通过；
authority 仅 `zero_provider_full_runner_durability_evidence`，正式 approved tag/marker/journal/artifact/recovery
claim 均为 0。F2 未读取 credential、未调用 Provider、未执行正式 Mock/Live、未启动产品。验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-f2-runner-durability-evidence.md`。

## S3：Reviewed Mock / Static Checkpoint

状态：[x] 完成，zero-provider。

必须完成：

- fresh full baseline 与全部 SHA parity；
- reviewed Mock 真实穿过两条 candidate、第一方 adapter、strict validator、local merger 与 F2 runner；
- `24/24` guard、`48/48` strict/wire/usage、full 与 anchor subset semantic 只得到
  `full_gate_mock_quality_not_evidence`；
- latency/budget/breaker/abort/locked-name/no-write/option reorder/anti-overfit fault matrix；
- Agent/AI/Types/Server/Web 受影响全量、typecheck/lint/Prettier/diff；
- 历史 V1--V9/R3/L1/L2 validator 与 artifact SHA parity；
- 正式 full-gate文件为 0；至少三路独立复审和无上下文 Reader Testing；
- 同步全部工程文档，独立提交并推送后停止。

S3 当时不创建 approved tag。后续独立 L3 admission 已在已推送且 parity 的 S3 commit 上创建并绑定
`phase-6-9-7-tutor-organizer-full-gate-s3-approved`；该 tag 现固定在 `3c5cc6c...`，不得移动或重建。

完成证据：factory SHA 为 `sha256:53bcf0d...da55`；正常路径为 `24/24` guard、`48/48`
strict/wire/verified usage、Tutor/Organizer/Combined semantic `1/0.9968750000000001/0.9984375000000001`、
L2 anchor `1/1/1`，gate 固定 `full_gate_mock_quality_not_evidence / qualityAuthority=none`。Focused
`14/14`、Agent `1122/1122`、AI `323/323`、Types `42/42 + tsc`、Web `439/439`、Server 非数据库
226 suites/2153 tests 通过；正式 tag/bundle 与 Provider 调用为 0。验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-s3-reviewed-mock-static.md`。

## L3：唯一 Full-gate Controlled-Live

状态：[x] 唯一 run 已执行并以 `full_gate_quality_gate_failed` 封存。

前置必须全部成立：

- F1/F2/S3 已分别验收、提交并推送；
- fixed branch、tracked clean、HEAD/upstream/remote/tag/approved commit parity；
- candidate/adapter hashes 与 L2 approved source 一致；
- 历史 sealed evidence validator/SHA parity；新 full-gate artifact=0；
- fresh zero-provider proxy preflight ready；
- 用户在当前 L3 admission 中重新给出固定数据边界语句：
  `我已接受本次运行时 DeepSeek 当前账号的数据保留/训练边界。`；admission 只记录固定 disposition/provider/
  accountScope/statementVersion/acceptedAt，不保存原始聊天正文；
- 用户给出 exact confirmation：
  `I_AUTHORIZE_PHASE_6_9_7_TUTOR_ORGANIZER_FULL_GATE_L3_CONTROLLED_LIVE_ONCE`；
- 专用 approval/credential 只映射到唯一进程，不写 `.env`、CLI、日志或 evidence。

L3 无论 pass、semantic fail、transport/HTTP/schema/usage/timeout/abort 或 I/O failure都只执行一次并 durable
seal，禁止 retry/resume/replay/backfill、单 case 补跑或追加 Provider 探测。

实际 run `2b0ac3a0-631f-4c7f-9781-ce0cda94149a` 为 guard `24/24`、runtime `22/22/0/26`、wire
`22/22/22/21`、strict `21/48`；Tutor runtime 11 在 response/content parse 后发生 schema failure，breaker
阻止剩余 26 lane。最终 semantic/P95/token/CNY 全 `null`、journal `296`、validator `ok=true`、recovery
claim=0、`qualityAuthority=none`。完整证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-l3-controlled-live-quality-gate-failure.md`。

## SR0--SR4：独立 Full-gate Schema Recovery

状态：SR0 [x]、SR1 [x]、SR2 [x]、SR3 [x]、SR4 [x] 完成，zero-provider；SR5 fresh admission 为下一任务，
尚未授权。

SR0 只读取证 L3 schema boundary，冻结 Provider envelope -> canonical `intentIndex` selection projection ->
strict projected decision -> local authority/merger、bounded no-raw diagnostic、新 journal/report/validator 与独立
SR1--SR7 lineage。它不修改或重跑 L3。SR1 已实现 contract/diagnostic TDD，SR2 已完成 Provider-like、
held-out、metamorphic、no-leak 与 fault robustness matrix；SR3 已完成独立 report/runner/source/CLI、
schema-stage durability、strict validator 与 crash-only recovery；SR4 reviewed Mock/static 又得到 `48/48`
strict/wire/usage、schema `42 canonical + 6 extension discarded` 与 semantic `1/0.996875/0.9984375`，但 authority
仅 `schema_recovery_mock_quality_not_evidence / qualityAuthority=none`。当前只允许进入 SR5 fresh admission；
在 fresh 数据边界接受、exact authorization、approved source/tag/remote parity 前，禁止 credential、Provider、
正式 Live、产品 Docker/API/browser、approved tag 与正式 SR5 artifact。完整路线见
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-full-gate-schema-recovery.md`。

## R6 / R7：产品与 main

状态：[ ] 旧 full-gate-v1 路线永久阻断。

本路线原合同要求 L3 得到 `full_gate_quality_gate_passed / full_gate_semantic_gate` 后才能开始 R6；但唯一 L3
已经失败封存，因此旧 R6/R7 永久阻断。未来产品与 main 验收只能在独立 Schema Recovery 的 SR5 quality pass
后，按 SR6 branch Docker/API/可见浏览器/Trace/精确清理，再到 SR7 main 合并、推送与 default-off 回放的顺序
推进；不得回填、重跑或改写本 L3。

P2/F1/F2/S3/L3 任何一个都不能替代 R6/R7 产品 authority。
