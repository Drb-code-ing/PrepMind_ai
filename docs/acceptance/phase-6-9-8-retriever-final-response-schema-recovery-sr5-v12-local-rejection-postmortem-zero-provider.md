# Phase 6.9.8 SR5 V12 local-rejection postmortem（zero-provider）

日期：2026-08-17

分支：`drb/phase-6-9-8-sr5-v12-local-rejection-postmortem`

基线：`main == origin/main == 93250de20660a6022808b134ea6b431adf8a5059`

权威：`zero_provider_sr5_v12_local_rejection_postmortem`

质量权威：`qualityAuthority=none`

## 为什么需要本任务

V12 唯一 controlled-Live 已正常 runtime seal。失败槽证明 Provider response 已观察，但 Task9 typed result/usage 未验证；
历史投影只保留 `runtime_contract_invalid / adapterFailureCategory=unknown / stage=null / wire=1/1/1/0`。旧
`baseInvalid` 用一个 OR 同时覆盖 invocation、candidate application、provenance、attempted、trace、V7 state 与 wire counter，
因此封存证据不能选择具体失败项。若 candidate 未应用，旧 durable evidence 也不能继续区分本地安全拒绝、rewrite 未变化或
protected terms 漂移。

本任务只改善未来运行的诊断投影。它不修改、不迁移、不补写 V12 evidence，也不能反向推断 V12 的真实失败条件。

## 实现合同

Task9 新增以下 bounded `rewriteFailureBoundary`，顺序也是确定性的 first-failure priority：

1. `invocation_mismatch`
2. `adapter_state_mismatch`
3. `adapter_wire_mismatch`
4. `provenance_mismatch`
5. `attempted_mismatch`
6. `trace_mismatch`
7. `candidate_not_applied`

原 `failureReason`、`adapterFailureCategory`、`structuredOutputStage` 与 provider wire 语义保持不变。这样既能让未来证据定位
Task9 本地失败层，又不会把历史 report 的缺失字段解释为新结论。

只有 `candidate_not_applied` 可以携带 `rewriteCandidateDiagnostic`。该字段复用既有 strict schema，只允许：

- 固定 diagnostic version、stage 与 reason enum；
- top-level/rewritten-query type 和 extra-field-count bucket；
- bounded shape fingerprint；
- 固定 `rawDataRetained=false`。

Provider content、rewritten query、字段名、字段值、credential 与 raw error 均不保存。成功、not-started、非
`rewrite_candidate_model` lane，以及其他 rewrite boundary 携带 sidecar 时均由 schema fail-closed。

## 验收证据

- 七类原 `baseInvalid` 条件逐项命中，成功输入仍返回 `null`。
- 多条件同时失效时，六组组合用例证明 first-failure priority 不漂移。
- 三条 production-shaped synthetic fetch 分别触发：
  - `rewrite_safety_invalid`
  - `rewrite_unchanged`
  - `protected_terms_drift`
- 每条 local rejection 均真实穿过 candidate -> Task9 error -> V12 runner -> breaker -> hash-chain journal -> report ->
  hard-link artifact -> strict bundle validator。
- 每条 terminal wire=`1/1/1/0`，后续槽 attempts=`0`；external Provider calls=`0`、credential reads=`0`、business writes=`0`，
  retry/resume/replay/backfill/backgroundJob/outbox 均为 `false`。
- 注入的 raw sentinel 不进入 Error、report、journal 或 artifact。

验证结果：

```text
new focused: 13/13, 45 expect()
V10 DQ1/DQ2 + V11/V12 compatibility + postmortem: 36/36, 402 expect()
Agent full: 1693/1693, 25960 expect(), 208 files
Agent typecheck: passed
Agent lint: passed
Prettier/diff check: passed
```

历史 V12 bundle 使用只读入口重新验证：

```text
ok=true
runId=49429392-857d-4635-80cc-0bca317cf9ff
journalRecords=67
finalJournalEvent=evidence_published
reportLogicalSha256=86f4e84e1859d9c77fc3a050095f5123f16cee9a61da60cc19d79b55e2323654
physicalArtifactSha256=817bc89708813982fdfc258126607f2930f42a6aae0fef81584c35548dd9be81
```

## 运行边界

本任务没有读取根 `.env` 或 credential，没有调用 DeepSeek/Qwen，没有创建正式 marker/journal/report/artifact，没有启动或
清理 Docker、PostgreSQL、Redis、MinIO、API 或浏览器，也没有写 Trace、BackgroundJob、Outbox 或业务数据。计数为
Provider/credential/formal evidence/business writes=`0/0/0/0`。

V12 run、tag、authorization 与 sealed evidence 继续永久只读；禁止 retry/resume/replay/backfill、recover/re-seal、移动 tag、
删除/移动/格式化/改写 evidence，以及 curl、单 case或产品 API 追加 Provider 探测。本任务不形成真实模型语义质量、SR6、
产品可用、P95/SLA 或账单 authority。

下一次真实质量门必须从最新已推送 `main` 建立新的 source lineage 与 annotated tag，完成独立 source verifier，并重新接受
DeepSeek/Qwen 数据边界与 exact authorization。只有新语义门通过后，才进入 SR6 Docker/API/Trace/可见浏览器验收。

回顾时可以问：为什么 response observed 不等于 candidate applied？七类 boundary 的优先级如何避免把后续症状当成根因？
为什么 candidate sidecar 只允许在 `candidate_not_applied` 出现？如何在不保存模型原文的前提下区分 safety、unchanged 与
protected terms drift？
