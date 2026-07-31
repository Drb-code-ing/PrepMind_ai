# Phase 6.9.7 Tutor / Organizer P1 小样本语义门实施计划

日期：2026-07-31

当前状态：P1、G1 已完成；下一原子任务为 G2 zero-provider one-shot runner / durability / evidence

设计 authority：
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-p1-zero-provider-semantic-gate-design.md`

## P1：Zero-provider 设计冻结

状态：[x] 完成，zero-provider。

交付：

- 固定独立 `phase-6.9.7-tutor-organizer-small-sample-v1` lineage；
- 从 frozen V2 dataset 固定 4+4 guard 与 8 对 runtime，manifest SHA 为
  `ae667f1c086ef67d37e5e5570612a21850bca6b10f53ea85b607c150e84edf61`；
- 只读计算未修饰 small-sample baseline：Tutor/Organizer/Combined
  `0.7070238095238095 / 0.2375 / 0.47226190476190477`，canonical authority payload SHA 为
  `d36d0789a19b89f814f66130c6ca8e92ab7eaf76bde597ccba80454e93fd9f4e`；
- 覆盖 Tutor 5 intents、3 languages、conflicting signals，以及 Organizer 6 subjects、create/reuse、
  batch、locked-name、no-write；
- 固定 semantic `>=0.85`、两 lane 相对 small-sample baseline 各提升 `>=0.15`、16/16 strict/wire/usage、
  8/8 guard zero-call 与 critical/permission/mutation=0；
- 固定 8-sample 不产生 P95 authority，只使用 `3500/5000ms` hard timeout、sample median/max；
- 固定 `16 calls / 37600 input / 8800 output / 0.17600000 CNY` 全局 cap；
- 固定 guard-first、pair-serial、pair 内双 lane 隔离、fixed denominator、breaker、aggregate-null；
- 固定全新 approval/credential/confirmation/marker/journal/artifact/validator namespace 与 L2 exact
  authorization；
- 明确 L2 pass 也只解锁 P2 zero-provider full-gate 设计，不直接授权产品或 main。

验收：
`docs/acceptance/phase-6-9-7-tutor-organizer-p1-zero-provider-semantic-gate.md`

## G1：Manifest / Baseline / Contract / Quality Gate

状态：[x] 已完成，zero-provider。

建议源码：

- `packages/agent/src/evals/phase-6-9-tutor-organizer-small-sample-manifest.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-small-sample-contract.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-small-sample-baseline.ts`；
- 对应 focused tests 与 held-out/metamorphic fixtures。

必须完成：

1. RED：manifest ID/order/source SHA 漂移、缺 intent/subject/action/critical coverage、重复 pair 和跨 pair
   mismatch 全拒绝；
2. GREEN：实现深冻结 manifest、canonical hash 与 source dataset/policy binding；
3. 在任何 candidate/prompt 改动前运行未修饰 deterministic subset baseline，必须复现 P1 冻结数值，再冻结
   正式 report bytes、SHA、各 axis、完整命中与 critical count；
4. 实现独立 strict report/schema/scorer/gate，固定 8 guards、16 runtime、12 Organizer decisions；
5. Semantic 复用既有权重，但 expected/oracle、candidate、Mock responder 与 selection manifest 单向隔离；
6. 8-sample latency 只生成 median/max，既有 24-sample P95 helper 对该路线必须返回/保持 `null`；
7. 任一 runtime/wire/duration/usage/pricing 不完整时 semantic/latency/token/CNY aggregate 全 `null`；
8. 冻结 `deepseek-v4-pro-cny-2026-07-15`、`3/6 CNY per 1M`、logical canonical SHA 与 physical file SHA
   的独立字段；
9. Report 固定为 artifact 内唯一 strict embedded object，冻结字段组、logical SHA、journal terminal hash 与
   physical artifact SHA 关系；
10. V1--V9、R3/R4、Canary V2 L1 report/manifest/schema 双向 rejection。

实际冻结 SHA：

- manifest：`ae667f1c...edf61`；
- baseline authority：`d36d0789...d9f4e`；
- baseline logical report：`ad3aa54d...d002`；
- baseline physical file：`e8bcbcb5...658b`；
- eval policy：`1cab7786...399a`。

Focused `20/20`、V2 baseline regression `11/11`、Agent full `995/995`、typecheck/lint 与独立
contract/security 复审通过。Baseline writer 使用 fixed path、exclusive-create、open 前后及 sync 后
parent/path/handle identity 校验；Node 无 `openat/dirfd` 的同用户恶意竞态如实保留为 trusted-workspace
边界。验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-g1-contract-baseline.md`。

G1 验收后只允许进入 G2；禁止读取 credential 或调用 Provider。

## G2：One-shot Runner / Durability / Evidence

状态：[ ] 下一原子任务，必须 zero-provider。

建议源码：

- `packages/agent/src/evals/run-phase-6-9-tutor-organizer-small-sample.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-small-sample-durability.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-small-sample-live.ts`；
- public CLI、validator、crash-only seal 与 focused tests。

必须完成：

1. Public CLI 只接受固定 production args + AbortSignal；拒绝 caller 注入 fetch/URL/model/root/clock/UUID/
   writer/output/retry；
2. preflight -> source -> approval -> dedicated credential -> exclusive marker -> guards -> pairs -> publication
   顺序不可交换；
3. proxy attestation 由 module-private `WeakMap` 持有、同步 single-consume；plain/clone/replay/cross-process 与
   caller injection 全拒绝，evidence 只保留安全 enum/stage；
4. 8 guards 必须执行真实 admission path并证明 executor/dispatch/response/usage 全 0；
5. pair 串行、pair 内最多双 lane；lane 独立 budget/abort/timeout/terminal，一条 lane 失败不能吞掉 sibling；
6. `lane_reserved` 与 dispatch stage 在 Provider 前 hash-chain + fsync；reserved/terminal/orphan/not-started 守恒；
7. 首个 contract failure 关闭当前 pair 后 breaker，semantic mismatch 不提前停；
8. marker exclusive-create、single terminal/publication、hard-link artifact、strict recomputing validator；
9. crash-only seal 不读取 credential、不 preflight、不构造 transport、不调用 Provider、不 retry/resume/replay；
10. synthetic fault matrix 覆盖 preflight/source/approval/credential、transport/HTTP/schema/usage/timeout/abort、
    sibling isolation、concurrent start、crash/publication race 与 hostile filesystem metadata；
11. 正式 marker/journal/artifact/recovery claim 数量保持 0。

## S2：Reviewed Mock / Static Checkpoint

状态：[ ] 被 G2 阻断，zero-provider。

必须完成：

- fresh deterministic baseline 与 frozen SHA parity；
- reviewed Mock 真实穿过两条 candidate、strict validator、本地 merger 与 runner；Mock responder 不读 oracle；
- 8/8 guard zero-call、16/16 strict/wire/usage、semantic `1/1/1` 只得到
  `mock_quality_not_evidence`；
- focused + Agent/AI/Types/Server/Web 受影响全量、typecheck/lint/Prettier/diff；
- option reorder、held-out/metamorphic、anti-overfit/prompt leak、abort/budget/stale/locked/no-write fault matrix；
- V1--V9、R3、Canary V2 L1 bundle validator 与物理 SHA parity；
- 项目根正式新 marker/journal/artifact/recovery claim=0；
- 至少三路独立实现/安全/测试文档终审和无上下文 Reader Testing；
- 同步 AGENTS、DEVLOG、README、roadmap、data-flow、dev-start、AI acceptance、checklist。

S2 必须独立提交并推送。完成后停止在 L2 授权门前。

## L2：唯一 Small-sample Controlled-Live

状态：[ ] 未授权、不得运行。

前置必须全部成立：

- S2 commit 已推送且 branch/HEAD/upstream/remote parity、tracked clean、新 artifact=0；
- S2 acceptance 已冻结 `approvedRunnableSourceCommit`，L2 source reader 要求
  `HEAD == upstream == remote == approvedRunnableSourceCommit`；
- 历史 sealed evidence validator/SHA 全保持；
- fresh zero-provider proxy preflight ready；
- 用户重新接受运行当时 DeepSeek 当前账号的数据保留/训练边界；
- 用户给出 exact confirmation：
  `I_AUTHORIZE_PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_CONTROLLED_LIVE_ONCE`；
- approval env 固定 `PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_APPROVED`，专用 credential 固定
  `PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_DEEPSEEK_API_KEY`；只进入唯一进程，不写 `.env`、CLI、
  日志或 evidence，通用/产品/Canary/其它 Agent key 不能替代。

L2 只运行一次 8-pair manifest。任何终态都必须 durable seal，禁止 retry/resume/replay/backfill、补跑单 case、
curl/产品 API 追加探测、删除/改写 artifact 或 crash seal 已完成 run。

## P2：L2 后路线决策

状态：[ ] 被 L2 阻断，必须先 zero-provider。

- `small_sample_quality_gate_passed`：只允许设计新的 24-pair full semantic gate；
- 其它任何终态：只允许只读/zero-provider 复盘，不允许重跑 L2 或放宽 P1 门；
- 两种终态都不直接进入产品 Docker/API/browser、main、Phase 6.9.8/6.10/8/9。
