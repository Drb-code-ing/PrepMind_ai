# Phase 6.9.5 V9 Report Gate Diagnostics 设计

> 状态：用户已授权继续完成 Phase 6.9.5，并要求避免盲目重试和过度设计。本文冻结一个全新的 V9 one-shot lineage；V1--V8 的 evidence、marker、confirmation、计数和目录继续只读且不可重跑、删除、重建或改写。

## 1. 目标与非目标

V8 已证明 canary 与 paired evaluator 都返回，durable prefix 到 `.stage-080-paired-returned`，但完整 report validation 没有通过，且 23/`invalid_response` 只存在于 CLI safe stdout。V9 的唯一新增能力是在同一次 paired 返回后、report validation 前，把严格脱敏的 aggregate gate 状态 durable 写入 canonical evidence leaf，再提交 `.stage-085-safe-aggregate-written`。

V9 不修改 DeepSeek V4 Pro、non-thinking transport、48-case 数据集、1 canary + 22 paired 调用、4500ms、`42_996 / 9_712` reservation、CNY 1.00 cap、质量阈值、权限、产品 admission 或 branch/main product runner 的业务行为。产品 composition 只允许增加 paired-evidence authority adapter，使同一 runner 可读取 V9 committed success；请求预算、slot、fixtures、Trace、页面、清理和 main replay 语义不变。V9 不增加诊断型 provider 请求、重试或第二次 `runPaired()`。

## 2. 方案选择

采用 canonical provisional：V9 evidence leaf 在 `.stage-080` 后先由 provisional 替换为 strict diagnostic candidate；checked-close 成功后，以 exclusive durable rename 发布 strict `.stage-085-safe-aggregate-committed.json`，其中只保存 schema version、evidence leaf、diagnostic SHA-256 和 historical tree hash。随后无论 pass/fail 都发布零字节 `.stage-090-validation-completed`。Gate 失败时 `.090` 是最终 publication point，关闭 capability且不再覆盖 diagnostic；全部 gate 通过时才进入 `.100-.150`，以 complete candidate 原子覆盖并创建原有 hash-bound success seal。

拒绝两种替代方案：独立 sidecar 会增加 allowlist、seal 和第二证据源；仅内存 diagnostic 无法解决 `.stage-080` 后 crash/finalization 失败再次只剩 `evidence_io` 的问题。

## 3. Strict safe aggregate

落盘只写一份 immutable diagnostic candidate strict schema；`.090` failure 后，public reader在不改写文件的前提下投影 finalized safe diagnostic。固定字段为：

- `schemaVersion`、`datasetVersion`、`state=diagnostic_candidate`、`status=invalid_attempted`、`gate=closed`；
- `provider=deepseek`、`model=deepseek-v4-pro`、固定 price profile；
- `attempts`：provider count、expected 23、paired admission count、expected 22、overflow boolean、audit record count；
- `report`：`schemaValid=false`，或 schema-valid 后的 case/zero-call/runtime/strict/quality/critical 计数、semantic pass/total、P95 和 production decision；
- `usage`：只允许 `known=true` 的 aggregate 正整数边界，或 `known=false` + 固定 reason；
- `cost`：只允许 `evaluated=true` + 8 位 CNY/cap boolean，或 `evaluated=false / usage_unverifiable`；
- `gates`：`schema / quality / p95 / usage / attempt / admission / cost`，每项仅 `passed / failed / not_evaluated`；
- `terminalReason`：与首个失败 gate 对应的固定 enum，全部通过时仅为 `passed`。

`superRefine` 强制：schema invalid 时 quality/P95 为 `not_evaluated`；usage unknown 时 cost 不得伪造为 0/known；`passed` 必须满足原有 `48/26/22/48/48/0`、semantic `>=90%`、P95 `<=4500`、23 attempts、22 admissions、positive bounded usage 和 cost cap。

禁止保存 case 数组、case id、prompt、output、response、reasoning、raw/Zod error、path、URL、header、key、cookie、stack、per-case usage 或 per-case duration。Diagnostic record 永远不是 `complete`，不得包含 success commitment 或 seal 字段。

## 4. V9 stage、reader 与历史完整性

顺序固定为：

```text
.010 reserved -> .020 attempted -> .030 evaluator ready
-> .040 V1--V8 history verified
-> .050/.060 canary -> .070/.080 paired
-> diagnostic candidate durable replace -> .085 hash commit
-> .090 validation completed (pass or fail)
-> .100-.150 existing finalization -> success seal
```

V9 使用独立 directory、once marker、confirmation、eval gate、schema version、package script 与 success seal。历史 snapshot v5 覆盖 V1--V8，并固定 V8 的 once、`.010-.080` 八个零字节 stage 与唯一 231-byte provisional 的精确名称、长度和 SHA；旧树任一新增、缺失、改字节或 reparse 都在 provider 前 zero-call。

Fresh reader 先用 `.085` 中的 SHA、leaf 与 historical tree hash复核 diagnostic。`.085` 缺失或不匹配只投影 `evidence_io`；`.085` 已提交但 `.090` 缺失时返回 `evidence_io` 加安全 aggregate与 lastStage，不将其称为终态。`.090` 已提交且任一 gate failed时返回 finalized safe diagnostic；此路径不进入 finalizer。只有 complete candidate、完整 success stages、V1--V8 tree 和 hash-bound success seal 全部匹配时返回 success。Diagnostic-only、伪 complete、strict-valid tamper 或伪 seal永远不能获得产品验收资格。

## 5. Factory 与调用计数

V9 复用现有 V8 provider composition，但增加一个默认关闭的 internal safe diagnostic callback/profile identity override；V8 默认路径行为不变且不可再次执行。Callback 对同一次 `runPaired()` 的返回值做 strict clone与 aggregate 投影，恰好调用一次，不暴露 raw report。

Provider attempts、paired admissions、overflow 与 audit count由 runtime wrapper独立计数，不信任 report counters。任一 attempt usage 缺失或非法时，aggregate usage 为 unknown，cost 为 not evaluated。禁止 shell、runner、SDK、file retry；V9 仍恰好最多 23 次外部尝试。

## 6. 测试与验收

TDD 必须覆盖：

1. 每个 gate 单独失败、多 gate 固定优先级、伪造 passed、schema invalid 携带 metrics、usage unknown 携带 cost；
2. forbidden-key corpus、getter/proxy、NaN/Infinity/负数/越界与 schema extras；
3. `.080 -> diagnostic replace -> .085 hash commit -> .090` 每个 false/throw、write/flush/close/reopen/rename 和 hard-exit 边界，全部零重试；
4. rename 后未 `.085` 不公开；`.085` 后验证 aggregate SHA但不冒充终态；`.090` failure后 fresh reader才返回 finalized safe diagnostic；strict-valid tamper、unknown leaf、reparse 只返回 `evidence_io`；
5. V1--V8 任一 byte/leaf 漂移 provider 前 zero-call；reservation/finalizer capability 继续只在 WeakMap；
6. success 路径仍通过原完整门、complete candidate 与 success seal；product evidence-authority adapter只接受 V9 public reader的 committed success，diagnostic-only 永远不能进入 product runner。

离线完整门、contract/security 与 acceptance/operations 双复审通过后，才执行唯一 V9 controlled-Live。V9 complete 时复用现有 branch/main durable product runner；V9 failure 时立即封存，不启动 Docker/浏览器，不合并 main，也不重跑 V9。

## 7. 完成标准

Phase 6.9.5 只有在 V9 committed success、branch product acceptance、default-off restore、零残留、`--no-ff` 合并 main、main committed-evidence replay、main product replay、最终文档和 `origin/main` SHA 一致全部成立后才完成。其余 Agent 与 Phase 6.10 仍不在本阶段范围内。
