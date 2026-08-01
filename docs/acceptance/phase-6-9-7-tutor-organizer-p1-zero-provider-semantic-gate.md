# Phase 6.9.7 Tutor / Organizer P1 Zero-provider 小样本语义门验收

日期：2026-07-31

状态：P1 设计验收完成；后续 G1/G2/S2 与唯一 L2 已完成，下一步仅 P2 zero-provider 设计

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 本次实际完成

本次只读复核 Provider Canary V2 L1 与现有 Tutor/Organizer V2 dataset、semantic metrics、V9
lineage/durability 后，冻结了全新的 small-sample 路线：

```text
route: phase-6.9.7-tutor-organizer-small-sample-v1
source dataset: phase-6.9-tutor-wrong-question-v2
source SHA: 42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b
manifest SHA: ae667f1c086ef67d37e5e5570612a21850bca6b10f53ea85b607c150e84edf61
guards: 4 Tutor + 4 Organizer
runtime: 8 pairs / 16 lanes / 12 Organizer decisions
provider calls in P1: 0
```

Runtime pair IDs 固定为 `01/08/10/12/15/19/23/24`，对应 0-based `pairedRunIndex`
`0/7/9/11/14/18/22/23`。它覆盖 Tutor 全部 5 intents、zh/en/mixed、conflicting-signal，以及 Organizer
全部 6 subjects、create/reuse、single/batch、structured subject、locked-name 和 no-write command。

Guard 固定覆盖 Tutor route/credential/injection/hostile input 与 Organizer owner/credential/injection/hostile
input。8 条 guard 均须在未来 runner 中实际穿过 admission path 并证明 0-call，当前文档本身不声称已运行。

只读 deterministic subset 审计得到：

```text
baseline payload SHA: d36d0789a19b89f814f66130c6ca8e92ab7eaf76bde597ccba80454e93fd9f4e
Tutor scoredCases/fullMatches/semantic: 8 / 5 / 0.7070238095238095
Tutor intent/depth/context/pedagogy: 0.5809523809523809 / 0.875 / 1 / 0.625
Organizer scoredDecisions/fullMatches/semantic: 12 / 0 / 0.2375
Organizer subject/action/reuse/topic/evidence-confidence:
  0.16666666666666666 / 0.75 / 0 / 0 / 0
Combined semantic: 0.47226190476190477
Critical/provider/token/cost: 0 / 0 / 0 / 0
```

这是未修饰本地规则在固定子集上的 baseline，不是 reviewed Mock，更不是 Provider 结果。理论满分相对
Tutor/Organizer baseline 的提升为 `0.2929761904761905 / 0.7625`，因此固定 `>=0.15` improvement 门可达。
后续 G1 已用正式 contract 复现这些值并冻结独立 report/file SHA；没有复用 72-case full baseline SHA。

## 2. 冻结的质量、延迟和预算

质量门固定为：

- 8/8 guard verified zero-call；
- 16/16 runtime strict success，wire `16/16/16/16`，verified usage/pricing 完整；
- Tutor、Organizer、Combined semantic 各 `>=0.85`；
- Tutor/Organizer 相对独立 small-sample deterministic baseline 各提升 `>=0.15`；
- invalid、critical、permission、mutation、broader fallback、locked-name change、write leakage 全为 0；
- `executorProvenance=deepseek_network`；Mock/synthetic 永远不能 quality pass；
- 任一 runtime/wire/duration/usage/pricing 不完整时 semantic/latency/token/CNY aggregate 全 `null`。

现有 P95 helper 只接受 24 values；本次 8-pair 设计明确不伪造 P95。未来只记录 lane durations、sample
median/max，Tutor/Organizer hard timeout 为 `3500/5000ms`，P95 字段固定 `null /
insufficient_sample_size_8`。因此未来 L2 pass 也不能产生 SLA 或产品性能 authority。

费用上限冻结为：

```text
Tutor: 8 calls / 9600 input / 2400 output / 0.048 CNY
Organizer: 8 calls / 28000 input / 6400 output / 0.128 CNY
Total: 16 calls / 37600 input / 8800 output / 0.176 CNY
Per pair: 0.022 CNY
Retry/resume/replay/backfill: 0
```

Pricing profile 固定 `deepseek-v4-pro-cny-2026-07-15`、input/output `3/6 CNY per 1M tokens`。价格或计费
边界若在未来变化，L2 必须 fail-closed 并先做新的 zero-provider pricing decision，不能静默改数值。

## 3. 并发、丢失与证据边界

未来 runner 被要求 guard-first、pair-serial，pair 内最多并发两条独立 lane。Tutor/Organizer 分别持有 budget、
AbortController、timeout 和 terminal；sibling failure 不能覆盖另一条真实终态。已 reserved lane 必须 durable
terminal，未开始 lane 必须以固定 not-started 原因占据原分母。

Marker 创建即消费名额；journal 在 Provider delegate 前写入 reservation/dispatch stage 并 fsync；crash-only
seal 只能封存 durable prefix，不能读取 credential、preflight、调用 Provider 或补跑。Artifact 独占发布，strict
validator 必须从 marker/journal/source 重算 aggregate。该路线使用全新 identity，并与 V1--V9、R3/R4、Canary
V2 L1 双向拒绝。

Wire `16/16/16/16` 固定指
`executorEntered/providerDispatchStarted/providerResponseReceived/verifiedUsageObserved`。S2 不自引用或预填
尚未产生的 commit，也不创建 approved tag；未来独立 L2 admission 才把唯一
`approvedRunnableSourceCommit` 冻结为已经推送且 parity 的 S2 commit，并创建/绑定 tag。L2 必须满足
`HEAD == upstream == remote == approvedRunnableSourceCommit`。
四个 wire 计数的分母都只包含 16 条 runtime lane；8 条 guard 另计且各维必须为 0。

Report 固定为 artifact 内唯一 strict embedded object，不另写第二份物理 report；artifact 同时绑定
`reportLogicalSha256`、journal terminal hash 与 physical artifact SHA。Proxy attestation 是同进程
module-private `WeakMap` capability，fresh ready 后同步 single-consume；plain/clone/replay/cross-process 与外部
注入都拒绝，evidence 只记录安全 enum/counter/stage，不持久化 URL/port 或 capability。

## 4. 本阶段未做事项

本次没有：

- 读取根 `.env` 或任何 DeepSeek credential；
- 调用 Provider、运行小样本/48-case、Mock 或 synthetic Live；
- 创建正式 marker/journal/artifact/recovery claim；
- 修改 candidate/runtime/product source、gate、prompt、schema 或数据库；
- 启动 Docker、API、可见浏览器或修改业务数据；
- 合并 main 或解锁 Phase 6.9.8/6.10/8/9。

因此本次 authority 仅为 `zero_provider_design`，不是 `small_sample_semantic_gate`，更不是 production
acceptance。

### 4.1 文档与只读证据终检

P1 收口完成以下 zero-provider 检查：

- 从设计文档的完整 canonical JSON payload 重算 manifest
  `ae667f1c086ef67d37e5e5570612a21850bca6b10f53ea85b607c150e84edf61` 与 baseline
  `d36d0789a19b89f814f66130c6ca8e92ab7eaf76bde597ccba80454e93fd9f4e`，均精确匹配；
- 对 frozen source dataset 复核 ID、index 与属性，结果 `errors=[]`，计数为 8 guards、8 pairs、16 lanes、
  12 Organizer decisions、5 intents、3 languages、6 subjects、2 actions；source dataset SHA 仍为
  `42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b`；
- 直接调用未修饰本地 deterministic functions 重算固定子集，完整命中、各 semantic axis、combined 与
  critical count 均精确复现本页 baseline；
- 对 14 个本次相关 Markdown 文件检查 96 个本地链接，missing=`[]`；Prettier、冲突标记与
  `git diff --check` 均通过；
- 敏感赋值掩码扫描未发现 secret-like 值；`docs/dev-start.md` 的 Qwen key 命中为既有中文占位符，不是
  credential；
- 无上下文 Reader Testing 经两轮修正后无剩余 Critical/Important；独立一致性与安全复审未发现新的
  Critical/Important；P1 验收当时尚无可执行 small-sample 源码，文档 SHA 不能冒充后续 G1 evidence。

## 5. 后续执行状态

G1 随后已 zero-provider 完成 manifest、独立 deterministic baseline、report/scorer/gate 与 oracle 隔离；
baseline logical report/physical file/eval policy SHA 分别为
`ad3aa54d...d002 / e8bcbcb5...658b / 1cab7786...399a`。G2 也已完成固定 production CLI/source gate、
runner、journal/marker/artifact/validator 与 crash-only seal。S2 reviewed Mock/static 也已完成：
`8/8` guard、`16/16` strict/wire/verified usage、semantic `1/1/1`，但 authority 仅
`mock_quality_not_evidence`；S2 收口时正式 L2 文件保持 0。S2 未读 credential、未调用 Provider、未创建
approved tag。S2 独立提交并推送后，独立 L2 admission 冻结了 commit/tag，并取得：

```text
I_AUTHORIZE_PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_CONTROLLED_LIVE_ONCE
```

该 confirmation 与实际运行当时的数据保留/训练边界接受同时成立。普通“继续/开始/同意/所有权限”不构成
该授权。Approval/credential env 分别固定为
`PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_APPROVED` 与
`PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_DEEPSEEK_API_KEY`；通用或现有产品 key 不可替代。

唯一 L2 run `6918df4f-a4ae-4de0-aa21-c7614ed5861d` 已绑定 source/tag
`4c608445...c22af1c4`，得到 guard `8/8`、runtime `16/16/0/0`、strict/wire/verified usage
`16/16/16/16`，Tutor/Organizer/Combined semantic
`0.9141666666666668 / 1 / 0.9570833333333334`、improvement
`0.2071428571428573 / 0.7625`、usage `7032/244`、费用 `0.02256 CNY`，最终
`small_sample_quality_gate_passed / small_sample_semantic_gate`。Journal `180` 条并以
`evidence_published` 收口，artifact SHA `a1b51f...eb0d`，validator `ok=true`，无 recovery claim。

8-pair P95 仍为 `null / insufficient_sample_size_8`，不能形成 SLA/产品 authority。L2 不得重跑或追加
Provider 探测；下一步只允许 P2 zero-provider 全量门设计，不直接授权 48-case Live、产品或 main。

完整设计与计划见：

- `docs/superpowers/specs/phase-6-9-7-tutor-organizer-p1-zero-provider-semantic-gate-design.md`；
- `docs/superpowers/plans/phase-6-9-7-tutor-organizer-p1-zero-provider-semantic-gate.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-g1-contract-baseline.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-g2-runner-durability.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-s2-reviewed-mock-static.md`；
- `docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live.md`。

回顾时可以问：

- 8 对 case 为什么这样选择，如何防止按模型结果 cherry-pick？
- 为什么 small-sample deterministic baseline 不能直接复用 full 72-case baseline 数值？
- 为什么 8 个 duration 不能生成既有 P95 authority？
- 如何保证 pair 内一条 lane 失败时另一条不会被静默丢失？
- 为什么 L2 pass 也不能直接证明产品可用？
