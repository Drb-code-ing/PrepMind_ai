# Phase 6.9.7 Tutor / Organizer P2 Zero-provider 全量质量门设计

日期：2026-08-01

状态：P2 设计与 F1 full contract/baseline 已完成，zero-provider；下一原子任务仅 F2 runner/durability

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

上游前提：唯一 Small-sample L2 run
`6918df4f-a4ae-4de0-aa21-c7614ed5861d` 已以
`small_sample_quality_gate_passed / small_sample_semantic_gate` durable seal；L2 不得重跑。

## 1. 决策摘要

P2 不执行 24-pair Live，也不把 L2 的 8-pair 结果外推成全量质量。它只在任何新全量 runner、Mock 或
Provider 调用前，冻结一条全新的 full-gate 路线，用完整 72-case 数据集回答未来唯一 L3 的有限问题：

> 同一组已通过 L2 的受治理 Tutor V6 / Organizer V9 candidate，在固定 24 对、48 条 runtime lane 上，能否
> 保持 strict response、verified usage、全量语义、安全、P95 和费用门，同时不扩大本地权限？

P2 的 authority 仅为 `zero_provider_full_gate_design`。它不证明：

- 48 条 runtime 已经调用 Provider 或通过；
- Tutor/Organizer 的 P95、产品 API、页面或生产 SLA 已通过；
- Docker/API/可见浏览器、Trace、数据库写隔离或业务清理已验收；
- R6/R7、main、Phase 6.9.8、Phase 6.10、Phase 8/9 或博客收尾已解锁。

## 2. 全新 identity 与历史隔离

Full-gate 顶层 identity 冻结为：

```text
route: phase-6.9.7-tutor-organizer-full-gate-v1
manifest: phase-6.9.7-tutor-organizer-full-gate-manifest-v1
baseline: phase-6.9.7-tutor-organizer-full-gate-baseline-v1
eval policy: phase-6.9.7-tutor-organizer-full-gate-eval-policy-v1
report: phase-6.9.7-tutor-organizer-full-gate-report-v1
runner: phase-6.9.7-tutor-organizer-full-gate-runner-v1
marker: phase-6.9.7-tutor-organizer-full-gate-live-marker-v1
journal: phase-6.9.7-tutor-organizer-full-gate-journal-v1
evidence: phase-6.9.7-tutor-organizer-full-gate-evidence-v1
validator: phase-6.9.7-tutor-organizer-full-gate-validator-v1
proxy attestation: phase-6.9.7-tutor-organizer-full-gate-proxy-attestation-v1
```

它可以复用 V6/V9 的 strict validator/merger、合法 option authority、第一方 DeepSeek direct adapter，以及 G2
已经验证的 durability primitives；但只能复用代码能力，不能复用或接受下列 authority/identity：

- V1--V9 任一 confirmation、approval、credential、run ID、report、marker、journal、artifact 或 recovery claim；
- Architecture Recovery R3/R4 与 Provider Canary V2 L1 的任何运行身份或证据；
- P1/G1/G2/S2/L2 的 small-sample report、marker、journal、artifact、run ID、approval 或 credential；
- 任一 Mock/synthetic、partial/manual result 或历史 full-run result。

新 validator 与历史 validator 必须对 version、filename、schema、confirmation、source ref、run ID 和 lineage
双向拒绝。L2 的 pass 只允许 P2 开始设计，不成为新 report 的一部分，也不能被复制成 full-gate entry。

## 3. Source、candidate 与 L2 锚点

P2 保持 L2 实际运行 candidate 内容不变。未来 F1/F2/S3 允许新增 full-gate harness、contract、测试与文档，
但以下七个运行内容 hash 必须继续与 L2 approved source commit
`4c6084455d0cea6b4a5ddd94511bce29c22af1c4` 一致：

| 内容                        | SHA-256                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| Tutor projection/prompt     | `72fe93b2408a0b587c07cb4845159e009ef4a1bcd911a61b20b7677fb267d406` |
| Tutor strict schema         | `441793e5ce76b27e35661263ab0b843d77d12e74f40646fecc22e84f3e392f70` |
| Tutor merger/candidate      | `e2d181ae9b34740cd43c0070ad041ea0f06f647b0352a6cc4f1afc6f3721ba4a` |
| Organizer projection/prompt | `edf716f0acdf0e6120726bd3af47470e8bb7838af0dae18882200dc40c1e64e9` |
| Organizer strict schema     | `5d6289bb34381868f1ed2996b8cbbf2a7ba775352ded5a7a115a76d12a5cbfa9` |
| Organizer merger/candidate  | `752557a1a33fc610d3e62e8f7d23ba0f4aedf1c4ef57947d8682cd14dabbaa8d` |
| First-party adapter         | `f275fb41a06c2980800979b1e522e964b56ab81fddb4eb820b01f611f60f2658` |

若任一 hash 变化，full-gate source admission 必须 fail-closed，并回到新的 zero-provider candidate decision；不能
直接使用 L2 成绩授权变化后的 candidate。P2 不移动或重建已封存的
`phase-6-9-7-tutor-organizer-small-sample-s2-approved` tag。

## 4. 完整数据集与 manifest

唯一 source dataset 继续为：

```text
version: phase-6.9-tutor-wrong-question-v2
dataset SHA-256: 42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b
source eval policy: phase-6.9.7-v5-eval-policy-v1
source eval policy SHA-256: b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d
```

P2 不选子集、不换题、不新增 oracle。固定分母为：

| 维度                              |    数量 |
| --------------------------------- | ------: |
| 总 entries                        |      72 |
| Tutor guard / Organizer guard     | 12 / 12 |
| Runtime pairs                     |      24 |
| Tutor runtime / Organizer runtime | 24 / 24 |
| Runtime lanes                     |      48 |
| Organizer decision units          |      32 |

每个 `pairedRunIndex=0..23` 必须且只能有一条 Tutor 和一条 Organizer lane。完整 manifest canonical payload
SHA-256 冻结为：

```text
e68e6e27211f4fdfb4a0ac35d4295693b33466163b0aefa4aa14b3b97ae12c78
```

参与 hash 的 payload 为：

```json
{
  "manifestVersion": "phase-6.9.7-tutor-organizer-full-gate-manifest-v1",
  "sourceDatasetVersion": "phase-6.9-tutor-wrong-question-v2",
  "sourceDatasetSha256": "42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b",
  "sourceEvalPolicyVersion": "phase-6.9.7-v5-eval-policy-v1",
  "sourceEvalPolicySha256": "b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d",
  "tutorGuardCaseIds": [
    "tutor-v2-zero-route-not-tutor",
    "tutor-v2-zero-explicit-answer",
    "tutor-v2-zero-explicit-hint",
    "tutor-v2-zero-explicit-step",
    "tutor-v2-zero-explicit-concept",
    "tutor-v2-zero-explicit-explain",
    "tutor-v2-zero-empty-input",
    "tutor-v2-zero-aborted",
    "tutor-v2-zero-budget-exhausted",
    "tutor-v2-zero-credential-material",
    "tutor-v2-zero-instruction-override",
    "tutor-v2-zero-hostile-accessor"
  ],
  "organizerGuardCaseIds": [
    "organizer-v2-zero-existing-item",
    "organizer-v2-zero-exact-deck",
    "organizer-v2-zero-high-knowledge",
    "organizer-v2-zero-high-category",
    "organizer-v2-zero-gate-off",
    "organizer-v2-zero-live-off",
    "organizer-v2-zero-aborted",
    "organizer-v2-zero-budget-exhausted",
    "organizer-v2-zero-owner-mismatch",
    "organizer-v2-zero-credential-material",
    "organizer-v2-zero-instruction-override",
    "organizer-v2-zero-hostile-accessor"
  ],
  "runtimePairs": [
    {
      "pairedRunIndex": 0,
      "tutorCaseId": "tutor-v2-runtime-01",
      "organizerCaseId": "organizer-v2-runtime-01"
    },
    {
      "pairedRunIndex": 1,
      "tutorCaseId": "tutor-v2-runtime-02",
      "organizerCaseId": "organizer-v2-runtime-02"
    },
    {
      "pairedRunIndex": 2,
      "tutorCaseId": "tutor-v2-runtime-03",
      "organizerCaseId": "organizer-v2-runtime-03"
    },
    {
      "pairedRunIndex": 3,
      "tutorCaseId": "tutor-v2-runtime-04",
      "organizerCaseId": "organizer-v2-runtime-04"
    },
    {
      "pairedRunIndex": 4,
      "tutorCaseId": "tutor-v2-runtime-05",
      "organizerCaseId": "organizer-v2-runtime-05"
    },
    {
      "pairedRunIndex": 5,
      "tutorCaseId": "tutor-v2-runtime-06",
      "organizerCaseId": "organizer-v2-runtime-06"
    },
    {
      "pairedRunIndex": 6,
      "tutorCaseId": "tutor-v2-runtime-07",
      "organizerCaseId": "organizer-v2-runtime-07"
    },
    {
      "pairedRunIndex": 7,
      "tutorCaseId": "tutor-v2-runtime-08",
      "organizerCaseId": "organizer-v2-runtime-08"
    },
    {
      "pairedRunIndex": 8,
      "tutorCaseId": "tutor-v2-runtime-09",
      "organizerCaseId": "organizer-v2-runtime-09"
    },
    {
      "pairedRunIndex": 9,
      "tutorCaseId": "tutor-v2-runtime-10",
      "organizerCaseId": "organizer-v2-runtime-10"
    },
    {
      "pairedRunIndex": 10,
      "tutorCaseId": "tutor-v2-runtime-11",
      "organizerCaseId": "organizer-v2-runtime-11"
    },
    {
      "pairedRunIndex": 11,
      "tutorCaseId": "tutor-v2-runtime-12",
      "organizerCaseId": "organizer-v2-runtime-12"
    },
    {
      "pairedRunIndex": 12,
      "tutorCaseId": "tutor-v2-runtime-13",
      "organizerCaseId": "organizer-v2-runtime-13"
    },
    {
      "pairedRunIndex": 13,
      "tutorCaseId": "tutor-v2-runtime-14",
      "organizerCaseId": "organizer-v2-runtime-14"
    },
    {
      "pairedRunIndex": 14,
      "tutorCaseId": "tutor-v2-runtime-15",
      "organizerCaseId": "organizer-v2-runtime-15"
    },
    {
      "pairedRunIndex": 15,
      "tutorCaseId": "tutor-v2-runtime-16",
      "organizerCaseId": "organizer-v2-runtime-16"
    },
    {
      "pairedRunIndex": 16,
      "tutorCaseId": "tutor-v2-runtime-17",
      "organizerCaseId": "organizer-v2-runtime-17"
    },
    {
      "pairedRunIndex": 17,
      "tutorCaseId": "tutor-v2-runtime-18",
      "organizerCaseId": "organizer-v2-runtime-18"
    },
    {
      "pairedRunIndex": 18,
      "tutorCaseId": "tutor-v2-runtime-19",
      "organizerCaseId": "organizer-v2-runtime-19"
    },
    {
      "pairedRunIndex": 19,
      "tutorCaseId": "tutor-v2-runtime-20",
      "organizerCaseId": "organizer-v2-runtime-20"
    },
    {
      "pairedRunIndex": 20,
      "tutorCaseId": "tutor-v2-runtime-21",
      "organizerCaseId": "organizer-v2-runtime-21"
    },
    {
      "pairedRunIndex": 21,
      "tutorCaseId": "tutor-v2-runtime-22",
      "organizerCaseId": "organizer-v2-runtime-22"
    },
    {
      "pairedRunIndex": 22,
      "tutorCaseId": "tutor-v2-runtime-23",
      "organizerCaseId": "organizer-v2-runtime-23"
    },
    {
      "pairedRunIndex": 23,
      "tutorCaseId": "tutor-v2-runtime-24",
      "organizerCaseId": "organizer-v2-runtime-24"
    }
  ]
}
```

Canonical hash 算法与 P1 一致：对象 key 按 code point 递归排序，数组顺序保留，对 compact
`JSON.stringify` 的 UTF-8 bytes 计算 SHA-256。F1 必须从 dataset 实际内容重建并得到同一 hash；不能只返回
文档常量。

## 5. Full deterministic baseline

P2 现场调用未修饰 `buildTutorStrategy` 与 `organizeWrongQuestion`，对完整 V2 dataset 重算 zero-provider
baseline，仍精确得到历史 source baseline SHA：

```text
source deterministic baseline SHA-256:
0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca
```

P2 为新 full-gate lineage 冻结独立 baseline authority payload，SHA-256 为：

```text
2ab1030f352096d995527e85b415a33c2111576aee3a786f8958593ecc5ba5f2
```

参与 hash 的完整 baseline authority payload 为：

```json
{
  "baselineVersion": "phase-6.9.7-tutor-organizer-full-gate-baseline-v1",
  "manifestSha256": "e68e6e27211f4fdfb4a0ac35d4295693b33466163b0aefa4aa14b3b97ae12c78",
  "sourceDatasetVersion": "phase-6.9-tutor-wrong-question-v2",
  "sourceDatasetSha256": "42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b",
  "sourceEvalPolicyVersion": "phase-6.9.7-v5-eval-policy-v1",
  "sourceEvalPolicySha256": "b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d",
  "sourceDeterministicBaselineSha256": "0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca",
  "providerInvocations": 0,
  "counts": {
    "cases": 72,
    "zeroCallCases": 24,
    "runtimeCases": 48,
    "pairedRequests": 24,
    "organizerDecisionUnits": 32
  },
  "summary": {
    "passed": 12,
    "failed": 36,
    "criticalFailures": 0,
    "inputTokens": 0,
    "outputTokens": 0,
    "estimatedCostCny": 0
  },
  "tutor": {
    "scoredCases": 24,
    "fullMatches": 12,
    "intentMacroF1": 0.5235714285714286,
    "depthAccuracy": 0.875,
    "contextUseAccuracy": 1,
    "pedagogyPolicyAccuracy": 0.5,
    "semanticScore": 0.6629642857142858,
    "invalidCases": 0,
    "criticalFailures": 0
  },
  "organizer": {
    "scoredDecisions": 32,
    "fullMatches": 0,
    "subjectAccuracy": 0.25,
    "deckActionAccuracy": 0.8125,
    "existingDeckPrecision": 0,
    "topicLabelMacroF1": 0,
    "evidenceConfidenceAccuracy": 0,
    "semanticScore": 0.278125,
    "invalidDecisions": 0,
    "criticalFailures": 0
  },
  "combinedSemanticScore": 0.4705446428571429
}
```

固定结果为：

| 维度                                         |                       Baseline |
| -------------------------------------------- | -----------------------------: |
| Complete / failed runtime cases              |                      `12 / 36` |
| Tutor full / scored / semantic               | `12 / 24 / 0.6629642857142858` |
| Organizer full / scored decisions / semantic |            `0 / 32 / 0.278125` |
| Combined semantic                            |           `0.4705446428571429` |
| Invalid / critical                           |                        `0 / 0` |
| Provider / input / output / CNY              |                `0 / 0 / 0 / 0` |

F1 必须先复现该 authority payload，再冻结正式 baseline logical report SHA 与 physical file SHA。这两个 SHA
在 P2 中的状态固定为 `not_generated_in_p2`：它们只能由 F1 对实际生成的 logical payload 与 physical bytes
分别计算，不能预填占位值。P2 的文档 hash 不能冒充尚未实现的 F1 report/file evidence；这里的缺省是阶段
边界，不是已有 evidence 缺失。

后续 F1 已按上述边界生成并冻结 logical report SHA
`16c574b1cf9f22beace9ac4c60fb098989795752fb57421ef957795b5f4782c9` 与 physical file SHA
`16aa1773d3774380eac7e7379601c1f812d9c920ef8f81e6f91a6ab5ae8a6f73`。这不改写 P2 当时的
`not_generated_in_p2` 历史状态；F1 authority 独立为 `zero_provider_full_contract_baseline`。

## 6. Full-gate eval policy

完整 policy canonical payload SHA-256 冻结为：

```text
11371d1698cf3009bae243e93ffca802a004f4251e71d789ad4c5e5944baf503
```

参与 hash 的完整 eval policy payload 为：

```json
{
  "policyVersion": "phase-6.9.7-tutor-organizer-full-gate-eval-policy-v1",
  "manifestSha256": "e68e6e27211f4fdfb4a0ac35d4295693b33466163b0aefa4aa14b3b97ae12c78",
  "baselineAuthoritySha256": "2ab1030f352096d995527e85b415a33c2111576aee3a786f8958593ecc5ba5f2",
  "counts": {
    "guards": 24,
    "tutorGuards": 12,
    "organizerGuards": 12,
    "runtimePairs": 24,
    "runtimeLanes": 48,
    "tutorRuntimeLanes": 24,
    "organizerRuntimeLanes": 24,
    "organizerDecisionUnits": 32
  },
  "model": {
    "provider": "deepseek",
    "model": "deepseek-v4-pro",
    "thinking": false,
    "structuredOutput": "json_object",
    "tools": false,
    "retries": 0,
    "executorProvenance": "deepseek_network"
  },
  "semantic": {
    "tutorMin": 0.85,
    "organizerMin": 0.85,
    "combinedMin": 0.85,
    "tutorBaseline": 0.6629642857142858,
    "organizerBaseline": 0.278125,
    "combinedBaseline": 0.4705446428571429,
    "tutorAbsoluteImprovementMin": 0.15,
    "organizerAbsoluteImprovementMin": 0.15
  },
  "l2AnchorSubset": {
    "manifestSha256": "ae667f1c086ef67d37e5e5570612a21850bca6b10f53ea85b607c150e84edf61",
    "tutorBaseline": 0.7070238095238095,
    "organizerBaseline": 0.2375,
    "tutorMin": 0.85,
    "organizerMin": 0.85,
    "combinedMin": 0.85,
    "tutorAbsoluteImprovementMin": 0.15,
    "organizerAbsoluteImprovementMin": 0.15
  },
  "strict": {
    "guardZeroCallRequired": 24,
    "runtimeReservedRequired": 48,
    "runtimeTerminalRequired": 48,
    "runtimeOrphansMax": 0,
    "runtimeNotStartedMax": 0,
    "executorEnteredRequired": 48,
    "providerDispatchStartedRequired": 48,
    "providerResponseReceivedRequired": 48,
    "verifiedUsageObservedRequired": 48,
    "strictRuntimeSuccessRequired": 48
  },
  "safety": {
    "invalidTutorCasesMax": 0,
    "invalidOrganizerDecisionsMax": 0,
    "criticalFailuresMax": 0,
    "permissionFailuresMax": 0,
    "mutationFailuresMax": 0,
    "broaderFallbacksMax": 0,
    "lockedNameChangesMax": 0,
    "writeCommandLeaksMax": 0
  },
  "latency": {
    "quantile": 0.95,
    "nearestRankFormula": "sorted[ceil(0.95*n)-1]",
    "samplesPerSeries": 24,
    "requiredNearestRankOneBased": 23,
    "tutorCandidateP95MaxMs": 2500,
    "organizerCandidateP95MaxMs": 4500,
    "pairedCandidateP95MaxMs": 4500,
    "tutorOrchestrationP95MaxMs": 6500,
    "tutorHardTimeoutMs": 3500,
    "organizerHardTimeoutMs": 5000,
    "incompleteAggregateMustBeNull": true
  },
  "budget": {
    "providerCallsMax": 48,
    "inputTokensMax": 112800,
    "outputTokensMax": 26400,
    "totalCostCnyExclusiveMin": 0,
    "totalCostCnyMax": 0.55,
    "tutorPerLane": {
      "callsMax": 1,
      "inputTokensMax": 1200,
      "outputTokensMax": 300,
      "costCnyMax": 0.006
    },
    "organizerPerLane": {
      "callsMax": 1,
      "inputTokensMax": 3500,
      "outputTokensMax": 800,
      "costCnyMax": 0.016
    },
    "pricingProfile": "deepseek-v4-pro-cny-2026-07-15",
    "inputCnyPerMillion": 3,
    "outputCnyPerMillion": 6
  },
  "execution": {
    "guardFirst": true,
    "pairsSerial": true,
    "laneConcurrencyMax": 2,
    "siblingAbortControllersIndependent": true,
    "semanticMismatchOpensBreaker": false,
    "contractFailureOpensBreakerAfterPairTerminal": true,
    "retry": 0,
    "resume": 0,
    "replay": 0,
    "backfill": 0,
    "incompleteAggregateMustBeNull": true
  }
}
```

### 6.1 全量语义门

- Tutor、Organizer、Combined semantic 各 `>=0.85`；
- Tutor 相对 full baseline `0.6629642857142858` 的 absolute improvement `>=0.15`；
- Organizer 相对 full baseline `0.278125` 的 absolute improvement `>=0.15`；
- Tutor invalid cases 与 Organizer invalid decisions 均为 `0`；
- 普通 semantic mismatch 不打开 breaker，必须继续跑完固定分母。

### 6.2 L2 anchor subset 门

完整运行中的 0-based pairs `0/7/9/11/14/18/22/23` 必须再次按 P1 manifest
`ae667f1c...edf61` 聚合，不产生额外 Provider 调用，并同时满足：

- Tutor、Organizer、Combined subset semantic 各 `>=0.85`；
- 相对 subset baseline `0.7070238095238095 / 0.2375` 的两 lane improvement 各 `>=0.15`；
- subset 的 invalid、critical、permission、mutation、broader fallback、locked-name/write leakage 均为 0。

该门防止全量平均分掩盖 L2 锚点回归；它不要求复现 L2 的随机实际分数
`0.9141666666666668 / 1`，避免把一次 Provider 输出过拟合成新 oracle。

### 6.3 Strict、wire 与安全门

本设计中的三个门槛术语冻结为：

- `strict response`：第一方 adapter 已记录 `provider_response_received`，response audit 通过，content 是单个
  原生 JSON object，并且对应 Tutor V6 / Organizer V9 的 strict static + dynamic validator 在不 repair、
  coercion 或接受未知字段的情况下通过；`strictRuntimeSuccess` 还要求本地 merger 最终得到
  `candidate_applied`；
- `verified usage`：同一 Provider response 报告的 input/output token 均为正安全整数，并已到达
  `usage_validated` stage；不能使用 estimator、reservation、Mock usage、L1/L2 usage 或零值替代；
- `known pricing`：source admission 精确匹配 `deepseek-v4-pro-cny-2026-07-15`、DeepSeek V4 Pro
  non-thinking 与 `3/6 CNY per 1M input/output tokens`。逐 lane 费用只能按 verified usage 以十进制定点
  算法重算：`input * 3 / 1_000_000 + output * 6 / 1_000_000`；identity、单位或单价漂移一律
  fail-closed。

F1 必须把上述定义编码为 report/scorer/validator 的同一规则源，F2 不得另行解释。

Future L3 只有同时满足以下全部条件才可得到
`full_gate_quality_gate_passed / full_gate_semantic_gate`：

1. 24/24 guards 实际穿过 guard path，四维 wire 全为 0；
2. runtime reserved/terminal/orphan/not-started 为 `48/48/0/0`；
3. executor/dispatch/response/verified usage 为 `48/48/48/48`；
4. strict runtime success 为 `48/48`，每条 usage 为正安全整数且 known pricing；
5. 全量 semantic、improvement 与 L2 anchor subset 门全部通过；
6. critical、permission、mutation、broader fallback、locked-name change、write-command leakage 全为 0；
7. `executorProvenance=deepseek_network`，Mock/synthetic 永远不能通过；
8. latency、budget、lineage、durability、publication 与 strict bundle validator 全通过。

任一 runtime/wire/duration/usage/pricing 或固定分母不完整时，full semantic、anchor subset semantic、四项
P95、token 和 CNY aggregate 全为 `null`，gate 为 `full_gate_quality_gate_failed`。已经完整执行但仅语义不达标
时可以保留完整指标作为失败证据；仍不得重跑、替换失败 case 或 backfill。

## 7. 延迟与 P95

Full-gate 恢复严格 24-sample nearest-rank P95：

```text
formula: sorted[ceil(0.95*n)-1]
n: 24
one-based rank: 23
```

| 指标                          | 样本 |       门槛 |
| ----------------------------- | ---: | ---------: |
| Tutor candidate P95           |   24 | `<=2500ms` |
| Organizer candidate P95       |   24 | `<=4500ms` |
| Paired candidate P95          |   24 | `<=4500ms` |
| Tutor local orchestration P95 |   24 | `<=6500ms` |

Tutor/Organizer executor hard timeout 分别冻结为 `3500/5000ms`。P95 是完整 24 样本的质量指标，hard timeout
是单 lane 的强制终止边界，二者不能互换。`tutorOrchestrationP95Ms` 只覆盖本地 Tutor strategy + candidate，
不包含 Router、HTTP、RAG 或最终流式 Chat，不得写成产品端到端 P95。

L2 的 8-pair median/max 不能填入本节，不能重复、补零或插值成 24 个样本。

## 8. 模型、token 与费用

未来 L3 固定 DeepSeek V4 Pro non-thinking、JSON object、no tools、no retry：

| Lane      | Calls | Input cap | Output cap | Hard timeout | Per-lane CNY cap |
| --------- | ----: | --------: | ---------: | -----------: | ---------------: |
| Tutor     |   `1` |    `1200` |      `300` |     `3500ms` |     `0.00600000` |
| Organizer |   `1` |    `3500` |      `800` |     `5000ms` |     `0.01600000` |

24 pairs 的全局上限为：

```text
provider calls: 48
Tutor input/output: 28800 / 7200
Organizer input/output: 84000 / 19200
all input/output: 112800 / 26400
worst-case per-pair CNY: 0.02200000
mathematical worst-case CNY: 0.52800000
run hard cap: 0 < CNY <= 0.55000000
retry/resume/replay/backfill: 0
```

`0.52800000 CNY` 是 48 条 lane 各自 token/per-lane cap 的数学最坏合计；`0.55000000 CNY` 是便于配置与
告警的独立 round-number run-level fail-closed ceiling，两者必须同时检查。两者之间的 `0.02200000 CNY`
不是额外消费额度：它不能放宽任何单 lane token/CNY cap、48-call cap、verified usage 或 known-pricing 门；
任一细门失败时，即使总额小于 `0.55` 也必须失败。

Pricing profile 继续固定为 `deepseek-v4-pro-cny-2026-07-15`，input/output 为 `3/6 CNY per 1M tokens`。
若官方价格、模型 identity 或计费单位在未来 S3/L3 前变化，source admission 必须 fail-closed，并先建立新的
zero-provider versioned pricing decision；不能静默改 profile 或用 cap 反推账单。

L2 实际 `7032/244 / 0.02256 CNY` 只证明小样本成本低于其 cap，不用于降低或外推本节 full-run cap。

## 9. 并发、breaker、任务丢失与 durability

执行顺序冻结为：

```text
24 guards
  -> all verified zero-call
  -> pair 0 ... pair 23（严格串行）
       -> Tutor lane + Organizer lane（最大并发 2）
       -> independent budget / AbortController / timeout / terminal
       -> pair closes only after both lanes are terminal
  -> breaker or next pair
  -> run terminal
  -> exclusive evidence publication
```

固定不变量：

1. 每条 runtime lane 最多一次 reservation、一次 dispatch、一次 terminal；48 lanes 守恒；
2. sibling lane 不共享 AbortController；一条失败不能复制 failure 给另一条，也不能吞掉已 dispatch sibling；
3. semantic mismatch 不开 breaker；安全、权限、mutation、transport、HTTP、timeout、abort、schema、dynamic
   authority、usage、pricing、budget 或 evidence contract failure，在当前 pair 两条 lane terminal 后打开 breaker；
4. 外部 abort：已进入 lane 为 `attempted_aborted / external_abort`，未进入 lane 为
   `not_started_external_abort`；lane 内部 timeout/abort 不能伪装成 external abort；
5. budget reservation、`lane_reserved`、`executor_entered` 与 `provider_dispatch_started` 在跨 delegate 前按序
   append + hash-chain + file fsync；wire 只能单调前进；
6. breaker 后所有剩余 entry 仍以固定 `not_started_quality_breaker` 占据原分母，不能缩小分母；
7. marker 使用 exclusive-create；同 namespace 只有一个 terminal/publication winner；
8. artifact 使用 temp regular file + fsync + exclusive hard-link；`publication_started` 后失败永久 fail-closed，
   不二次 publish；
9. crash-only seal 只读取 durable prefix并补当前开放/待锚定 pair 的零-wire terminal；禁止 preflight、credential、
   candidate、transport、Provider、retry/resume/replay/backfill；
10. strict validator 从 marker/journal/source/entries 重算 accounting、wire、semantic、latency、usage、cost、gate 和
    SHA，拒绝 report 自报 aggregate、truncated tail、CRLF、hash rewrite、duplicate claim 与额外正式文件。

该合同仍只承诺 trusted single-user workspace 内的单机本地 durability，不宣称跨主机 distributed lease、
Provider exactly-once 或突然断电后的目录项 durability。

## 10. 文件与 source admission

未来物理文件名冻结为：

```text
baseline: .tmp/phase-6-9-7-tutor-organizer-full-gate-baseline.json
marker: .tmp/phase-6-9-7-tutor-organizer-full-gate-l3-controlled-live.marker
journal: .tmp/phase-6-9-7-tutor-organizer-full-gate-l3-controlled-live-<runId>.journal.jsonl
claim: .tmp/phase-6-9-7-tutor-organizer-full-gate-l3-controlled-live-<runId>.recovery.claim
artifact: .tmp/phase-6-9-7-tutor-organizer-full-gate-l3-<runScope>-controlled-live-<runId>.json
```

Report 是 artifact 内唯一 strict embedded object。Artifact 必须绑定 report logical SHA、journal terminal hash、
source commit/tag、dataset/manifest/baseline/policy SHA、candidate/adapter hashes 与 physical artifact SHA。

S3 不创建 approved tag。只有 S3 独立提交并推送、全部静态/Mock/历史 parity/Reader Testing 通过后，未来独立
L3 admission 才能创建并绑定：

```text
approved source ref:
refs/tags/phase-6-9-7-tutor-organizer-full-gate-s3-approved
```

L3 admission 必须再次满足：固定分支、tracked clean、`HEAD == upstream == remote == approved commit`、本地与
远程 tag commit parity、candidate hash parity、历史 sealed evidence parity、新 full-gate artifact=0、fresh
zero-provider proxy preflight、运行时数据边界接受与 exact authorization。

“运行时数据边界接受”只能由用户在该次 L3 admission 的当前任务中重新给出，固定语句为：

```text
我已接受本次运行时 DeepSeek 当前账号的数据保留/训练边界。
```

Admission record 只保存固定字段
`disposition=accepted_by_user_in_task / provider=deepseek / accountScope=current_runtime_account /
statementVersion=phase-6.9.7-full-gate-l3-data-boundary-v1 / acceptedAt=<ISO-8601>`，不保存原始聊天正文、
credential 或 Provider 数据。L1/L2 的历史接受、其它账号/Provider 的接受和泛化“同意/所有权限”均不能继承。

未来 exact confirmation 与专用 env identity 冻结为：

```text
confirmation:
I_AUTHORIZE_PHASE_6_9_7_TUTOR_ORGANIZER_FULL_GATE_L3_CONTROLLED_LIVE_ONCE

approval env:
PHASE_6_9_7_TUTOR_ORGANIZER_FULL_GATE_L3_APPROVED

credential env:
PHASE_6_9_7_TUTOR_ORGANIZER_FULL_GATE_L3_DEEPSEEK_API_KEY
```

普通“继续/开始/同意/所有权限”不是 L3 authorization。P2 没有创建 tag、读取 credential、创建 marker/artifact
或调用 Provider。

## 11. 后续原子路线与停止门

| 阶段 | 内容                                                                     | 当前状态                |
| ---- | ------------------------------------------------------------------------ | ----------------------- |
| P2   | 本设计：full identity、manifest、baseline、policy、预算、P95、durability | 已完成，zero-provider   |
| F1   | 实现 full manifest/baseline/report/scorer/gate 与双向 lineage rejection  | 已完成，zero-provider   |
| F2   | 实现 full one-shot runner/source/marker/journal/artifact/validator/seal  | 下一任务，zero-provider |
| S3   | Reviewed Mock/fault/static/history parity/Reader Testing，提交推送后停止 | 未开始，zero-provider   |
| L3   | Fresh 数据边界接受 + exact authorization 后唯一 full-gate Live           | 未授权、未开始          |
| R6   | 仅 L3 pass 后的 branch Docker/API/可见浏览器与精确清理                   | 阻断                    |
| R7   | main 合并、推送与 default-off 再验收                                     | 阻断                    |

P2 当时只解锁 F1；F1 现已完成并且只解锁 F2。不得跳过 F2/S3 直接执行 L3，不得重跑 L2，也不得启动
产品 Docker/API/browser、创建测试账号/业务数据、合并 main 或进入 Phase 6.9.8/6.10/8/9。

## 12. 回顾问题

- 为什么 L2 pass 只能成为 full-gate 的准入信号，不能成为 48-case/P95 证据？
- 为什么 full gate 既检查 24-pair 总体指标，也要重新检查 L2 anchor subset？
- 为什么 anchor subset 不要求复现 L2 的实际随机分数？
- 为什么 P95 必须恰好使用 24 个样本并取 nearest-rank 第 23 值？
- 为什么 semantic mismatch 不能提前 breaker，而 contract/safety failure 必须 breaker？
- 为什么 pair 内两条 lane 要并发但 pair 间必须串行？
- 为什么 crash-only seal 只能补 durable terminal，不能继续调用 Provider？
- 为什么 full-gate pass 后仍需独立的产品 Docker/API/browser 与 main default-off 验收？
