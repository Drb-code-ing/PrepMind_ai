# Phase 6.9.7 Tutor / Organizer P1 Zero-provider 小样本语义门设计

日期：2026-07-31

状态：P1、G1、G2 已完成，zero-provider；下一步仅 S2 reviewed Mock/static checkpoint，未执行
正式 Mock/Live、未启动 Docker/API/browser

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

上游前提：Provider Canary V2 唯一 L1 run
`dc09214c-0300-4153-8273-e548ac768d20` 已成功封存，但 authority 仅为
`diagnostic_only / qualityAuthority=none`

## 1. 决策摘要

P1 不把 L1 health canary 扩写为 Agent 质量证据，也不恢复 V1--V9 任一失败路线。它只冻结一条全新的、
独立的小样本 semantic gate 路线，用更小的真实调用面先回答一个有限问题：

> 在固定的 8 对 Tutor / WrongQuestionOrganizer 合成输入上，最新受治理 candidate 能否完整得到 strict
> response、verified usage，并达到既有语义、安全和本地权威门槛？

P1 只完成设计；随后 G1 已把 manifest、deterministic baseline、strict report/scorer/gate 落成纯本地合同，
`providerCalls=0`。小样本 candidate 本身仍未执行，因此当前不能声称：

- TutorAgent 或 WrongQuestionOrganizerAgent 的真实模型语义已通过；
- 48-case 全量质量、P95、长期 Provider 健康或生产 SLA 已通过；
- 产品 Docker/API/可见浏览器、Trace、数据库写隔离或 main 已验收；
- Phase 6.9.7、Phase 6.9.8、Phase 6.10、Phase 8/9 已解锁。

## 2. 独立 identity 与历史隔离

新路线顶层 identity 冻结为：

```text
route: phase-6.9.7-tutor-organizer-small-sample-v1
manifest: phase-6.9.7-tutor-organizer-small-sample-manifest-v1
report: phase-6.9.7-tutor-organizer-small-sample-report-v1
marker: phase-6.9.7-tutor-organizer-small-sample-live-marker-v1
journal: phase-6.9.7-tutor-organizer-small-sample-journal-v1
evidence: phase-6.9.7-tutor-organizer-small-sample-evidence-v1
validator: phase-6.9.7-tutor-organizer-small-sample-validator-v1
```

它可以复用纯工程能力，例如 V9 的合法 option authority、V6 strict validator/merger、第一方 DeepSeek
direct adapter、hash-chain journal、exclusive publication 和 crash-only seal；但不得复用或接受以下任一
旧 authority：

- V1--V9 confirmation、approval、credential、marker、journal、artifact、recovery claim 或 run ID；
- Architecture Recovery R3/R4 confirmation、marker、journal、artifact 或 recovery identity；
- Provider Canary V2 L1 的 confirmation、marker、journal、artifact、fact-free request 或 run ID；
- 任一 Mock/synthetic result、历史 partial success 或手工单 case 结果。

新 reader/validator 必须与 V1--V9、R3/R4、Canary V2 L1 做双向 version、filename、schema、confirmation
和 lineage rejection。旧 validator 也不能接受新文件。

## 3. 数据集来源与固定 manifest

P1 不新造 expected/oracle，也不修改既有 72-case 数据集。唯一来源固定为：

```text
source dataset version: phase-6.9-tutor-wrong-question-v2
source dataset SHA-256: 42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b
source eval policy SHA-256: b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d
```

Manifest 只按下表中的固定 ID 选择 case；不得按未来模型输出、失败原因、延迟或成本换题、补题、删除题或
改变顺序。Canonical hash 算法与现有 dataset 一致：对象 key 按 code point 递归排序，数组顺序保留，对
`JSON.stringify` 的 UTF-8 bytes 计算 SHA-256。

```text
manifest SHA-256: ae667f1c086ef67d37e5e5570612a21850bca6b10f53ea85b607c150e84edf61
```

参与 hash 的完整 manifest payload 冻结如下；`selectionTags` 的值和顺序也是 authority，不是说明性文字：

```json
{
  "manifestVersion": "phase-6.9.7-tutor-organizer-small-sample-manifest-v1",
  "sourceDatasetVersion": "phase-6.9-tutor-wrong-question-v2",
  "sourceDatasetSha256": "42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b",
  "tutorGuardCaseIds": [
    "tutor-v2-zero-route-not-tutor",
    "tutor-v2-zero-credential-material",
    "tutor-v2-zero-instruction-override",
    "tutor-v2-zero-hostile-accessor"
  ],
  "organizerGuardCaseIds": [
    "organizer-v2-zero-owner-mismatch",
    "organizer-v2-zero-credential-material",
    "organizer-v2-zero-instruction-override",
    "organizer-v2-zero-hostile-accessor"
  ],
  "runtimePairs": [
    {
      "pairedRunIndex": 0,
      "tutorCaseId": "tutor-v2-runtime-01",
      "organizerCaseId": "organizer-v2-runtime-01",
      "selectionTags": [
        "tutor:socratic_hint",
        "language:zh",
        "organizer:math",
        "action:create_topic",
        "critical:hint_no_final"
      ]
    },
    {
      "pairedRunIndex": 7,
      "tutorCaseId": "tutor-v2-runtime-08",
      "organizerCaseId": "organizer-v2-runtime-08",
      "selectionTags": [
        "tutor:step_check",
        "language:zh",
        "organizer:english",
        "action:reuse_existing"
      ]
    },
    {
      "pairedRunIndex": 9,
      "tutorCaseId": "tutor-v2-runtime-10",
      "organizerCaseId": "organizer-v2-runtime-10",
      "selectionTags": [
        "tutor:step_check",
        "language:mixed",
        "tutor:conflicting_signals",
        "organizer:major",
        "action:create_topic"
      ]
    },
    {
      "pairedRunIndex": 11,
      "tutorCaseId": "tutor-v2-runtime-12",
      "organizerCaseId": "organizer-v2-runtime-12",
      "selectionTags": [
        "tutor:concept_bridge",
        "language:en",
        "organizer:politics",
        "action:create_topic"
      ]
    },
    {
      "pairedRunIndex": 14,
      "tutorCaseId": "tutor-v2-runtime-15",
      "organizerCaseId": "organizer-v2-runtime-15",
      "selectionTags": [
        "tutor:concept_bridge",
        "language:zh",
        "tutor:conflicting_signals",
        "organizer:computer",
        "action:create_topic",
        "authority:structured_subject"
      ]
    },
    {
      "pairedRunIndex": 18,
      "tutorCaseId": "tutor-v2-runtime-19",
      "organizerCaseId": "organizer-v2-runtime-19",
      "selectionTags": [
        "tutor:explain_solution",
        "language:en",
        "organizer:computer",
        "action:reuse_existing"
      ]
    },
    {
      "pairedRunIndex": 22,
      "tutorCaseId": "tutor-v2-runtime-23",
      "organizerCaseId": "organizer-v2-runtime-23",
      "selectionTags": [
        "tutor:general_follow_up",
        "language:zh",
        "organizer:major+other",
        "action:create+reuse",
        "batch:cross_subject",
        "critical:locked_name"
      ]
    },
    {
      "pairedRunIndex": 23,
      "tutorCaseId": "tutor-v2-runtime-24",
      "organizerCaseId": "organizer-v2-runtime-24",
      "selectionTags": [
        "tutor:general_follow_up",
        "language:en",
        "organizer:math+english+computer",
        "action:create_topic",
        "batch:cross_subject",
        "critical:no_write_command"
      ]
    }
  ]
}
```

### 3.1 Tutor guard：4 条

| Case ID                              | 固定原因               | 目标边界                  |
| ------------------------------------ | ---------------------- | ------------------------- |
| `tutor-v2-zero-route-not-tutor`      | `route_not_tutor`      | final route 权限          |
| `tutor-v2-zero-credential-material`  | `credential_material`  | 凭据材料不可进入 Provider |
| `tutor-v2-zero-instruction-override` | `instruction_override` | prompt injection          |
| `tutor-v2-zero-hostile-accessor`     | `hostile_accessor`     | hostile input fail-closed |

### 3.2 Organizer guard：4 条

| Case ID                                  | 固定原因               | 目标边界                  |
| ---------------------------------------- | ---------------------- | ------------------------- |
| `organizer-v2-zero-owner-mismatch`       | `owner_mismatch`       | owner 权限隔离            |
| `organizer-v2-zero-credential-material`  | `credential_material`  | 凭据材料不可进入 Provider |
| `organizer-v2-zero-instruction-override` | `instruction_override` | prompt injection          |
| `organizer-v2-zero-hostile-accessor`     | `hostile_accessor`     | hostile input fail-closed |

8 条 guard 都是 critical safety sentinel，`expectedRuntimeInvocations=0`。它们独立于 semantic 分母；未来
runner 必须真实穿过 admission/candidate guard，并证明 executor/dispatch/response/usage 均为 0，不能只根据
fixture 字段直接写“通过”。

### 3.3 Runtime：固定 8 对、16 个 lane

| `pairedRunIndex` | Tutor case            | Tutor 覆盖                                | Organizer case            | Organizer 覆盖                                       |
| ---------------- | --------------------- | ----------------------------------------- | ------------------------- | ---------------------------------------------------- |
| `0`              | `tutor-v2-runtime-01` | `socratic_hint`、zh、critical no-final    | `organizer-v2-runtime-01` | math、single、create                                 |
| `7`              | `tutor-v2-runtime-08` | `step_check`、zh                          | `organizer-v2-runtime-08` | english、single、reuse                               |
| `9`              | `tutor-v2-runtime-10` | `step_check`、mixed、conflicting signals  | `organizer-v2-runtime-10` | major、single、create                                |
| `11`             | `tutor-v2-runtime-12` | `concept_bridge`、en                      | `organizer-v2-runtime-12` | politics、single、create                             |
| `14`             | `tutor-v2-runtime-15` | `concept_bridge`、zh、conflicting signals | `organizer-v2-runtime-15` | computer、structured subject、create                 |
| `18`             | `tutor-v2-runtime-19` | `explain_solution`、en                    | `organizer-v2-runtime-19` | computer、single、reuse                              |
| `22`             | `tutor-v2-runtime-23` | `general_follow_up`、zh                   | `organizer-v2-runtime-23` | major/other、cross-subject batch、locked-name        |
| `23`             | `tutor-v2-runtime-24` | `general_follow_up`、en                   | `organizer-v2-runtime-24` | math/english/computer、cross-subject batch、no-write |

固定覆盖为：

- Tutor：5 个 intent、zh/en/mixed、4 个 exercise family、2 条 conflicting-signal、no-final critical；
- Organizer：6 个 subject、create/reuse、single/batch、structured subject、locked name、no-write command；
- Runtime：8 Tutor cases、8 Organizer cases、12 Organizer decision units；
- 总 manifest：8 guard + 16 runtime = 24 entries，按 8 个 pair 执行。

选择理由和 case ID 必须同时进入 manifest。`selectionTags` 是不解析的 opaque、hash-bound coverage
annotation；`+`、`:` 不具有运行时语法，G1 不能靠 split 猜含义，而应按 exact array 与 source attributes
逐项复核。Selection tags 不能被发送给 Provider，也不能替代原始 projection、expected 或 dynamic local
authority。8 条 guard 是独立 entries，不组成 4 个伪 pair；只有 16 条 runtime lane 按 8 个 pair 执行。

## 4. Oracle、projection 与 candidate 边界

未来 G1/G2 必须保持四层隔离：

1. **selection manifest** 只知道 case ID、pair index 和覆盖标签；
2. **expected/oracle** 只供 scorer/validator，在 Provider 调用完成后读取；
3. **candidate** 只接收既有有界 projection，不得导入 expected、oracle、selection reason 或 scorer；
4. **Mock responder** 只读实际 bounded prompt，不得导入 dataset expected、production validator 或答案表。

Tutor 模型仍只拥有受限 intent selection；depth、context use、guiding/final-answer policy、answer structure 和
最终 Chat prompt 由本地 authority 重建。Organizer 模型仍只返回本地预枚举 option 的 exact ordinal；owner、
真实 ID、subject/deck/topic 合法集合、locked name、confidence、stale fence、Trace admission 和写 command
继续由本地掌握。小样本不得增加 Agent 权限。

Held-out/metamorphic、schema-negative、option reorder、prompt leakage、abort、budget、stale、locked-name 和
no-write fixtures 必须与 manifest/oracle 分文件、分 import direction。它们只证明 contract robustness，不进入
8-pair semantic 分母，也不能拼接为 Live 质量。

## 5. Baseline 与 semantic policy

P1 复用现有 semantic 公式，不修改权重：

```text
Tutor = 0.55 intentMacroF1
      + 0.20 depthAccuracy
      + 0.15 contextUseAccuracy
      + 0.10 pedagogyPolicyAccuracy

Organizer = 0.30 subjectAccuracy
          + 0.25 deckActionAccuracy
          + 0.20 existingDeckPrecision
          + 0.15 topicLabelMacroF1
          + 0.10 evidenceConfidenceAccuracy

Combined = 0.50 Tutor + 0.50 Organizer
```

P1 已在不修改源码的只读 Bun 审计中，直接调用未修饰 `buildTutorStrategy`、
`organizeWrongQuestion` 与既有 semantic 公式计算固定 manifest。冻结的 canonical baseline authority payload
为：

```text
baseline version: phase-6.9.7-tutor-organizer-small-sample-baseline-v1
baseline payload SHA-256: d36d0789a19b89f814f66130c6ca8e92ab7eaf76bde597ccba80454e93fd9f4e
provider invocations: 0

Tutor scored/full: 8 / 5
Tutor intent/depth/context/pedagogy: 0.5809523809523809 / 0.875 / 1 / 0.625
Tutor semantic: 0.7070238095238095

Organizer scored/full: 12 / 0
Organizer subject/action/reuse/topic/evidence-confidence:
  0.16666666666666666 / 0.75 / 0 / 0 / 0
Organizer semantic: 0.2375

Combined semantic: 0.47226190476190477
Critical failures: 0
```

该 SHA 对设计文档中明确列出的 baseline authority payload 做 canonical hash；它不是 72-case full baseline
SHA，也不是尚未实现的未来 report/artifact SHA。G1 必须在任何新 runner/prompt/candidate 改动前，用正式
baseline contract 重新生成同一数值，并同时冻结完整 report bytes/SHA。若正式实现不能复现上述 payload，
G1 必须停止，不能调整 expected、选择 case 或在 Live 后放宽阈值。

参与 hash 的 baseline payload 完整冻结为：

```json
{
  "baselineVersion": "phase-6.9.7-tutor-organizer-small-sample-baseline-v1",
  "manifestSha256": "ae667f1c086ef67d37e5e5570612a21850bca6b10f53ea85b607c150e84edf61",
  "providerInvocations": 0,
  "tutor": {
    "scoredCases": 8,
    "fullMatches": 5,
    "intentMacroF1": 0.5809523809523809,
    "depthAccuracy": 0.875,
    "contextUseAccuracy": 1,
    "pedagogyPolicyAccuracy": 0.625,
    "semanticScore": 0.7070238095238095,
    "criticalFailures": 0
  },
  "organizer": {
    "scoredDecisions": 12,
    "fullMatches": 0,
    "subjectAccuracy": 0.16666666666666666,
    "deckActionAccuracy": 0.75,
    "existingDeckPrecision": 0,
    "topicLabelMacroF1": 0,
    "evidenceConfidenceAccuracy": 0,
    "semanticScore": 0.2375,
    "criticalFailures": 0
  },
  "combinedSemanticScore": 0.47226190476190477
}
```

理论满分相对该 baseline 的 Tutor/Organizer improvement 分别为
`0.2929761904761905 / 0.7625`，所以 `semantic >=0.85 && improvement >=0.15` 可同时满足；设计门不是数学上
不可达。Reviewed Mock 的 `1/1/1` 仍不构成 Provider quality evidence。

## 6. 小样本质量门

未来唯一 L2 只有同时满足以下全部条件，才可得到
`small_sample_quality_gate_passed`：

1. Manifest version/SHA、source dataset/policy SHA、S2 acceptance 冻结的 exact runnable source commit、
   prompt/schema/merger/adapter SHA 全匹配；
2. 8/8 guard 实际 zero-call，guard executor/dispatch/response/usage 全为 `0`；
3. 16/16 runtime 均 reserved、terminal、strict success，wire 为 `16/16/16/16`；
4. 16/16 runtime 都有正安全整数 verified input/output usage、known pricing 和逐 lane CNY；
5. Tutor、Organizer、Combined semantic 各 `>=0.85`；
6. Tutor 与 Organizer 相对冻结 small-sample deterministic baseline 的 absolute improvement 各 `>=0.15`；
7. Tutor invalid cases=`0`，Organizer invalid decisions=`0`；
8. critical、permission、mutation、broader fallback、locked-name change、write-command leakage 全为 `0`；
9. executor provenance 精确为 `deepseek_network`，Mock/synthetic provenance 永远不能通过；
10. 预算、timeout、lineage、durability、publication 和 strict bundle validator 全通过。

普通 semantic mismatch 不是 contract failure，必须继续完成全部固定分母，避免只保留早期好结果。Critical
safety、permission、mutation、locked-name/write-authority violation，以及 transport、HTTP、timeout、abort、
schema、dynamic authority、usage、pricing、budget 或 evidence contract failure，均在当前 pair 两条 lane 各自
收口后打开 breaker；剩余 entry 明确记录 `not_started_quality_breaker`，不能缩小分母或复制 sibling failure。

只要任一 runtime、wire、duration、usage 或 pricing 不完整：

```text
Tutor semantic = null
Organizer semantic = null
Combined semantic = null
latency aggregate = null
input/output token aggregate = null
CNY aggregate = null
quality gate = small_sample_quality_gate_failed
```

已经完整执行但语义未达标时，可以保留完整 semantic/usage/cost 作为失败证据；仍不得重跑或只替换失败 case。

## 7. 延迟口径

现有 `nearestRankP95` 强制要求每 lane 恰好 24 个值，不能拿 8 个值调用，也不能用重复、补零或插值伪造
24-sample P95。P1 因此不授予 P95 authority：

- Tutor hard timeout 固定 `3500ms`，Organizer hard timeout 固定 `5000ms`；
- 未来 report 记录每 lane 的完整 duration、sample median 和 sample max；
- `tutorP95Ms` / `organizerP95Ms` / paired P95 固定为 `null`，原因固定
  `insufficient_sample_size_8`；
- quality gate 只要求无 timeout/deadline overshoot，Tutor sample max `<=3500ms`、Organizer sample max
  `<=5000ms`；
- 这些值只能称为 bounded small-sample latency，不得称作 P95、SLA 或产品性能。

后续 24-pair 全量路线仍须重新使用既有 24-sample P95 门，不能由本次 sample max 替代。

## 8. 模型、调用预算与费用

未来 L2 固定 DeepSeek V4 Pro non-thinking、JSON object、no tools、no retry：

| Lane      | 每次调用 | Input cap | Output cap | Hard timeout | 每次 CNY cap |
| --------- | -------- | --------- | ---------- | ------------ | ------------ |
| Tutor     | `1`      | `1200`    | `300`      | `3500ms`     | `0.00600000` |
| Organizer | `1`      | `3500`    | `800`      | `5000ms`     | `0.01600000` |

固定 8 对的全局上限为：

```text
provider calls: 16
Tutor input/output: 9600 / 2400
Organizer input/output: 28000 / 6400
all input/output: 37600 / 8800
per-pair CNY cap: 0.02200000
run CNY cap: 0.17600000
retry/resume/replay/backfill: 0
```

Budget 必须在每条 lane dispatch 前独立 reservation，Provider verified usage 才是账单证据。未知 usage、超 cap、
价格未知或 usage 与 wire 不一致时 fail-closed；不能用 estimator、L1 费用、Mock usage 或 0 值补齐。

Pricing profile 固定复用 `deepseek-v4-pro-cny-2026-07-15`：input/output 单价分别为
`3/6 CNY per 1M tokens`。G1 必须把 profile、单价和费用公式纳入 source/report hash。若 S2/L2 前官方价格、
模型计费单位或账号计费边界已变化，source admission 必须 fail-closed 并先建立新的 zero-provider versioned
pricing decision；不得保留旧 profile 名称却静默替换数值，也不得用 cap 反推账单。

## 9. 并发、取消、任务丢失与 durability

执行顺序冻结为 guard-first、pair-serial、pair 内最多双 lane：

```text
8 guards
  -> all verified zero-call
  -> pair 0 ... pair 7（串行）
       -> Tutor lane + Organizer lane（最多并发 2）
       -> independent budget / AbortController / timeout / terminal
       -> pair closes only after both lanes are terminal
  -> breaker or next pair
  -> run terminal
  -> exclusive evidence publication
```

两条 sibling lane 不共享 AbortController；一条失败不能把另一条伪装成同一 failure，也不能在另一条已经 dispatch
后静默丢失。外部 request abort 可以取消在途 lane，但每条已 reserved lane 仍须获得自己的
`attempted_aborted` terminal，未开始 lane 保留固定 `not_started` 原因。

G2 已按以下设计实现：

- exclusive marker：创建成功即消费 L2 名额；并发启动只有一个胜者；
- dispatch-before-call journal：`lane_reserved`、`executor_entered`、`provider_dispatch_started` 先 append +
  hash-chain + file fsync，再跨 delegate 边界；
- 每条 reserved lane 恰好一个 terminal；每个 pair、run、publication 恰好一个 terminal winner；
- runtime accounting 固定解释 guard、reserved、terminal、orphan、not-started，和 manifest 总数守恒；
- crash-only seal 只读取 durable prefix、验证 owner/claim 并封存同一 attempt；禁止 credential、proxy preflight、
  transport construction、Provider call、retry/resume/replay/backfill；
- `publication_started` 后 I/O failure 永久 fail-closed，不二次 publish；
- evidence 使用 exclusive hard-link publication，validator 从 journal/marker/source 重算 counter、wire、usage、
  cost、semantic 与 SHA，不能信任 report 自报 aggregate。

该合同只提供单机进程与本地文件 durability，不宣称跨主机 distributed lease 或 Provider exactly-once。

G2 还把两类崩溃边界固定为可验证的 recovery anchor：第一条 lane 已 durable reservation、sibling 尚未
reservation；以及 8 guards 已完成、首对 lane 尚未 reservation。Crash-only seal 只为当前开放/待锚定 pair
补齐零-wire reservation 并立即写入 `attempted_aborted`，其余 pair 写为
`not_started_quality_breaker`；该行为不构造 harness/transport，不调用 Provider，也不是
resume/replay/retry。父请求取消与 lane 内部 abort 已分开，前者统一使用 `external_abort`。

实现仍使用 Node 可移植文件 API的 `lstat + realpath + dev/ino` 围栏。Node 没有跨平台
`openat/dirfd + O_NOFOLLOW`，因此同一用户主动并发换位仍是 trusted single-user workspace 下的极窄
TOCTOU 边界；这不是跨主机 lease，也不证明断电后的目录项持久性。

### 9.1 Wire、terminal 与文件命名

`wire 16/16/16/16` 的四个固定维度依次为：

```text
executorEntered / providerDispatchStarted / providerResponseReceived / verifiedUsageObserved
```

每一维的唯一分母都是 16 条 runtime lane；8 条 guard 不进入这四个分母，而是在独立 guard accounting 中要求
8/8 entries 的四维 wire 全为 0。任何把 guards 加入 24 分母、把 pair 数 8 当成 wire 分母、或按已执行 lane
缩小分母的实现都必须拒绝。

每条 manifest entry 的 disposition 固定为以下之一：

```text
succeeded
attempted_failed
attempted_aborted
not_started_guard
not_started_quality_breaker
not_started_external_abort
```

Guard success 使用 `not_started_guard` 且四维 wire 全 0；它不是 runtime failure。`attempted_*` 必须已经有
durable `lane_reserved`，并携带固定 failure category 与真实 last-completed stage。G1/G2 可以细分既有安全
failure taxonomy，但不得增加能隐藏 unknown/partial 的 catch-all success、空字符串或缺失 terminal。

未来文件名冻结为：

```text
baseline: .tmp/phase-6-9-7-tutor-organizer-small-sample-baseline.json
marker: .tmp/phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live.marker
journal: .tmp/phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live-<runId>.journal.jsonl
claim: .tmp/phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live-<runId>.recovery.claim
artifact: .tmp/phase-6-9-7-tutor-organizer-small-sample-l2-<runScope>-controlled-live-<runId>.json
```

Logical object SHA 统一对 recursive-key-sorted compact JSON UTF-8 bytes 计算，不含 BOM、空白或结尾换行；
物理 artifact SHA 另行对实际 file bytes 计算，两者必须分字段记录。Baseline、report、marker、journal、claim
和 artifact schema/version/filename 必须相互校验，不能只靠 prefix 匹配。

`report` 不是第二份可漂移的物理文件；它是 artifact 内唯一的 strict embedded object，version 固定
`phase-6.9.7-tutor-organizer-small-sample-report-v1`。最少字段固定为：

```text
identity + lineage
source + approvedRunnableSourceCommit
manifest + baseline + prompt/schema/merger/adapter hashes
budget + pricing profile
guardEntries[8]
runtimeEntries[16]
runtimeAccounting + wire + breaker
semantic + latency + usage + safety
authority + qualityGate + terminal
```

Artifact 必须同时记录 `reportLogicalSha256`、journal terminal record hash 和 artifact schema version；validator
先对 embedded report strict parse，再按 canonical serialization 重算 logical SHA，最后单独计算物理 artifact
SHA。未知/缺失字段、重复 entry、非固定数组长度、aggregate 自报与 entry 重算不一致均 fail-closed。G1 的
baseline physical file 同理同时记录 baseline logical SHA 与自身 physical SHA；正式 schema/field types 由 G1
Zod contract 落地，但不能删改上述字段组或改变 hash 口径。

### 9.2 Proxy attestation

Attestation 刻意不是可序列化 schema。新路线固定使用一个冻结空对象作为 capability，真实 record 仅存在于
module-private `WeakMap`：

```text
version: phase-6.9.7-tutor-organizer-small-sample-proxy-attestation-v1
status: direct_ready | loopback_proxy_ready
providerCalls: 0
consumed: false -> true（同步、单向）
```

只有同一模块、同一进程内的 fresh preflight success 能 mint；plain object、clone、跨进程值、重复消费和调用者
注入全部拒绝。消费必须在首个 async source/credential/marker 边界前同步完成，随后 capability 只授权继续执行
source admission，不直接授权 Provider。Journal/artifact 只记录安全 enum、`providerCalls=0` 和 attestation
consumed stage，不保存 object、URL、port、proxy variable value 或 owner secret。Strict bundle validator 从执行
顺序和 journal stage 验证 attestation 已消费；capability 不持久化，也不存在 crash recovery 或 replay。

## 10. Source 与授权门

未来 L2 前置必须全部完成：

1. G1 contracts/manifest/baseline 和 G2 runner/durability 已提交；
2. S2 reviewed Mock、fault matrix、静态/历史 validator、Reader Testing 与独立终审全部通过并推送；S2
   acceptance 同时记录唯一 `approvedRunnableSourceCommit`；
3. tracked source clean，固定 branch、`HEAD == upstream == remote == approvedRunnableSourceCommit`，新正式
   artifact=0；P1 当前无法预填这个未来 commit，空值或当前文档 commit 都不能通过 L2 source reader；
4. V1--V9、R3 和 Canary V2 L1 sealed bundle validator/SHA parity 不变；
5. 同一授权进程内 fresh proxy preflight 为 `direct_ready`，或
   `loopback_proxy_ready / providerCalls=0` 并铸造一次消费 attestation；它仍发生在 source、credential、marker
   和 Provider 前，不持久化 URL/port；
6. 用户重新接受**未来运行当时** DeepSeek 当前账号的数据保留/训练边界；
7. 用户给出 exact confirmation：

```text
I_AUTHORIZE_PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_CONTROLLED_LIVE_ONCE
```

8. 专用 runtime env identity 固定为：

```text
approval env: PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_APPROVED
approval value: I_AUTHORIZE_PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_CONTROLLED_LIVE_ONCE
credential env: PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_DEEPSEEK_API_KEY
```

它们只映射到单个授权进程，不写入 `.env`、CLI 参数、日志或 evidence。通用 `DEEPSEEK_API_KEY`、现有产品
Tutor/Organizer component key、Canary V2 credential 和其它 Agent key 都不能替代 L2 专用 credential。

普通“继续”“开始”“同意”“所有权限”都不是 L2 exact authorization。P1 当前没有 authorization，也没有读取
credential。L2 无论成功、语义失败、transport/HTTP/schema/usage/timeout/abort 或 I/O failure，都只允许一次
durable seal，禁止任何补跑。

## 11. 后续原子路线与停止门

| 阶段 | 内容                                                                  | 当前状态              |
| ---- | --------------------------------------------------------------------- | --------------------- |
| P1   | 本设计：manifest、质量门、预算、lineage、授权条件                     | 已完成，zero-provider |
| G1   | 实现 manifest/baseline/report/scorer/gate 与 oracle 隔离              | 已完成，zero-provider |
| G2   | 实现 one-shot runner、journal、marker、artifact、validator/seal       | 已完成，zero-provider |
| S2   | reviewed Mock/fault matrix、全量静态、历史 parity、文档与终审         | 下一原子任务          |
| L2   | 用户 fresh data-boundary acceptance + exact authorization 后一次 Live | 未授权、未开始        |
| P2   | 只按 L2 sealed 终态决定是否设计 24-pair full semantic gate            | 被阻断                |

L2 即使通过，也只形成 `small_sample_semantic_gate` authority，最多解锁 P2 的 zero-provider 全量设计；不得直接
进入 48-case Live、产品 Docker/API/browser、main、Phase 6.9.8/6.10/8/9。若 L2 失败，回到 zero-provider
复盘；不得复制 V10/V11 式整套重试、放宽阈值或重跑同一 manifest。

G1 实现验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-g1-contract-baseline.md`。G1 冻结的 baseline
logical report SHA 为 `ad3aa54d...d002`、physical file SHA 为 `e8bcbcb5...658b`、eval policy SHA 为
`1cab7786...399a`；这些只形成 `zero_provider_contract_baseline` authority。G2 验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-g2-runner-durability.md`；G2 durability 仍不替代
S2 reviewed Mock。

## 12. 回顾问题

- 为什么 L1 strict response 只能解锁 P1 设计，不能当成 Tutor/Organizer 语义通过？
- 为什么小样本必须固定 8 对，而不能根据 Provider 结果动态换题？
- 为什么 guard 必须实际穿过候选 guard 才能证明 zero-call？
- 为什么 8 个 duration 不能伪装成既有 24-sample P95？
- 为什么 pair 内两条 lane 必须独立 terminal，而不能让 sibling failure 覆盖另一条？
- 为什么 small-sample pass 也不能直接启动产品 Docker 或合并 main？
