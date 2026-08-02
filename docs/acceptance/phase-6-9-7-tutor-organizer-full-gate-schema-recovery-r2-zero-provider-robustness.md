# Phase 6.9.7 Tutor / Organizer Full-gate Schema Recovery SR2 Zero-provider Robustness 验收

日期：2026-08-02

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

Checkpoint authority：`zero_provider_full_gate_schema_recovery_robustness`

Quality authority：`none`

## 1. 验收结论

SR2 已完成。它为 SR1 的 Tutor schema-recovery contract/candidate 增加独立、固定身份的
Provider-like、held-out、metamorphic、schema-negative、fault 与 runner robustness 证据，并保持全程
zero-provider。

本阶段证明：

- SR1 parser/candidate 能在第一方 DeepSeek direct adapter 的 injected synthetic fetch 路径中处理常见
  Provider JSON 形状，而不是只在 parser 单元测试中通过；
- 全部 24 个 frozen Tutor runtime case（包含 `tutor-v2-runtime-11`）都能以一次 prompt-only synthetic
  dispatch 穿过 recovery candidate、本地 authority 与 merger；
- schema、transport、HTTP、response-audit、usage、budget 与 abort 失败保持 fail-closed、single dispatch、
  no retry；
- recovery candidate 的 schema failure 接入既有 F2 in-memory runner 后，会先收口已 admission 的 sibling，
  再打开 breaker，固定分母不会丢失；
- responder 不读取 expected/oracle/scorer/production validator，不把 case identity 或隐藏答案写入请求。

本阶段不证明真实 DeepSeek 语义质量、full-gate semantic/anchor/P95/token/CNY、Provider health、正式
Mock/Live、产品 Docker/API/browser 或 main 可用。

## 2. 固定 fixture 与身份

独立 fixture：
`packages/agent/tests/fixtures/phase-6-9-tutor-schema-recovery-sr2-robustness-v1.ts`

- fixture version：`phase-6.9.7-tutor-schema-recovery-sr2-robustness-v1`；
- prompt-only responder version：
  `phase-6.9.7-tutor-schema-recovery-sr2-prompt-hash-responder-v1`；
- frozen fixture SHA：
  `sha256:43248bfa7156c29eafa110b475a8998611209dd808847be79dacd1c02460d41e`；
- frozen V2 dataset SHA：
  `42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b`；
- SR1 parser contract SHA：
  `e2453faeb077faa76ab018a038790cd5a7e73f617be800c0958c098361511579`；
- V6 prompt logical SHA：
  `4f73ae60e708ed9ba08bc5533cc489626543ca09e0396777ef4d725c9656a169`；
- V6 preferred-depth rules SHA：
  `b57a828e14294f712a6547be2ac168b1d58b79cdc5b9aecbb071304f4e5ae7af`；
- prompt/parser+diagnostic/projection/merger/recovery-adapter source SHA 均进入 fixture identity，并由测试按当前
  source bytes 重算。

Fixture 固定 18 个 Provider shape（5 accepted、13 rejected）、5 个 held-out Tutor 输入与 4 个 adapter
fault。它不保存 expected decision、baseline、quality gate、Provider raw output 或 credential。

## 3. Prompt-only responder 与 anti-oracle

Synthetic responder 只接收 direct adapter 实际发送的 request body：

1. 有界解析 system/user message、`json_object` response format 与 max tokens；
2. 从 user prompt 中读取本地投影已经公开的 `eligibleIntents[].intentIndex`；
3. 对 responder version + system prompt + user prompt 做 SHA-256；
4. 仅在该请求的 eligible ordinal 集合内按 hash 确定一个 index；
5. 返回 strict `{"intentIndex": n}`。

Responder helper 不导入 V2 cases、expected/oracle、scorer、formal report、production Mock/Live CLI 或旧 L3
evidence。测试逐条扫描实际 request bytes，确认不包含 `expected`、`oracle`、`pairedRunIndex`、
`tutor-v2-runtime-11`、`schema-recovery-result`、baseline/quality-gate 标识或 `apiKey`。

这里的 hash selection 只证明 bounded prompt -> eligible ordinal -> local authority/merger 的结构鲁棒性，不是
语义正确答案，也不产生 semantic quality authority。

## 4. Provider shape 与结构边界

已在 direct adapter synthetic provenance 下覆盖：

- canonical JSON、JSON whitespace、escaped `intentIndex` key 与 extension-first/key-order 变化；
- extra scalar/string/boolean/null、nested object/array 与 Unicode extension；
- missing、alias、string、null、fraction、range；
- top-level array、double-encoded JSON、wrapper、Markdown fence、BOM、trailing data；
- canonical/escaped duplicate key；
- UTF-8 byte、depth、node 与 key limit。

Accepted extension 只形成 `extension_fields_discarded` bounded diagnostic，随后在 `applied` stage 收口；raw
extension key/value 不进入 result。Rejected shape 均只执行一次 dispatch，不 retry；diagnostic 固定
`rawDataRetained=false`，不回显原始 content。

## 5. Runtime、fault 与 runner 边界

### 5.1 全部 Tutor runtime

- frozen runtime cases：`24/24`；
- 明确包含：`tutor-v2-runtime-11`；
- synthetic adapter dispatch：每 case `1`，共 `24`；
- runtime request：每 case `1`；
- disposition：结构路径均为 `candidate_applied`；
- 24 个 prompt fingerprint 均为独立 bounded SHA。

该结果不与 expected intent 比分；expected 只保留在测试文件外的 frozen dataset 中，responder 无法访问。

### 5.2 Fault matrix

- transport：wire `transport`，公开 trace `transport`；
- HTTP 429：wire/public `http_rate_limit`；
- non-thinking response audit：wire `response_audit`，公开安全投影 `invalid_response`；
- missing usage：wire `usage_validation`，公开安全投影 `unknown`；
- budget exhausted：provider dispatch `0`；
- pre-dispatch abort：provider dispatch `0`；
- in-flight abort：dispatch `1` 后 `fallback_aborted`；
- post-runtime abort：完整一次 synthetic runtime 后 `fallback_aborted`。

所有 attempted fault 均为 exactly one dispatch、no retry；raw synthetic error 不进入 candidate output。

### 5.3 Pair sibling 与 breaker

SR2 schema failure 通过既有 F2 memory lifecycle 接入 full-gate runner：

- reserved/terminal/orphan/not-started：`2/2/0/46`；
- Tutor first lane：`attempted_failed / schema`；
- Organizer sibling：`succeeded / strictRuntimeSuccess=true`；
- 后续 lanes：`46` 条 `not_started_quality_breaker`；
- breaker：`opened=true / reason=schema`；
- Tutor synthetic Provider dispatch：`1`。

该 lifecycle 只使用内存 Map/trace，不创建 marker、journal、artifact 或 recovery claim；在 SR2 完成时，
新 lineage runner/durability 仍由后续 SR3 负责。SR3 现已独立完成，不回填本 checkpoint authority。

## 6. 验证结果

- SR2 focused：`9/9` tests，`484` assertions；
- SR1/SR2/V9 R2/F2 compatibility：`51/51` tests，`1133` assertions；
- Agent full：`1144/1144` tests，`21463` assertions；
- AI full：`325/325` tests，`2378` assertions；
- Agent/AI typecheck 与 lint：通过；
- Prettier 与 `git diff --check`：通过；
- 独立代码/安全与文档/边界终审：无阻断项；
- 历史 L3 只读 validator：
  `ok=true / runId=2b0ac3a0... / gate=full_gate_quality_gate_failed /
qualityAuthority=none / journalRecords=296 / finalJournalEvent=evidence_published`；
- L3 logical report SHA：
  `595e9fce929aa1cbfe3ed3982edd27fcf81f9672395ba070328b4c869f974683`；
- L3 physical artifact SHA：
  `e081939bb7f4b17235b1d9afb61d78031879bb80b9d64c952e4b86531cd7dbe5`。

## 7. Zero-provider 与副作用清单

- `.env` / credential read：`0`；
- global fetch / Provider call：`0`；
- injected fetch provenance：`synthetic_test`；
- 正式 Mock/Live/production CLI：`0`；
- Docker/API/browser：`0`；
- 业务数据读写：`0`；
- 新 approved tag/marker/journal/artifact/recovery claim：`0`；
- 旧 L3 evidence 修改：`0`；
- `.codex/`：保持既有本地未跟踪状态，不进入提交。

## 8. 后续状态与停止门

SR3 已随后以 zero-provider 完成独立 report/runner/source/CLI/marker/journal/artifact/recovery/validator identity
与 bounded schema stage durability；验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r3-runner-durability.md`。

SR4 reviewed Mock/static 随后已 zero-provider 完成，并只形成
`schema_recovery_mock_quality_not_evidence / qualityAuthority=none`。唯一 SR5 run `63f8a76b...04cb` 随后以
`schema_recovery_full_gate_semantic_gate` durable seal；它不改写本页、旧 L3 或 SR4，也不形成产品 authority。
当前下一原子任务仅 SR6 分支产品验收。最新验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r5-controlled-live-quality-gate-pass.md`。

## 9. 主要文件

- `packages/agent/tests/fixtures/phase-6-9-tutor-schema-recovery-sr2-robustness-v1.ts`；
- `packages/agent/tests/tutor-schema-recovery-sr2-helpers.ts`；
- `packages/agent/tests/tutor-schema-recovery-sr2-provider-robustness.test.ts`；
- `packages/agent/tests/tutor-schema-recovery-sr2-runtime-metamorphic.test.ts`；
- `packages/agent/tests/tutor-schema-recovery-sr2-fault-runner.test.ts`；
- `packages/agent/src/model-candidates/tutor-schema-recovery-contract.ts`；
- `packages/agent/src/model-candidates/tutor-schema-recovery-model-candidate.ts`。

## 10. 回顾时可以问

- 为什么 responder 必须只从实际 bounded prompt 的 eligible ordinals 选择，而不能固定返回 0--4？
- 为什么 24/24 `candidate_applied` 仍然不是语义质量通过？
- 为什么 `response_audit` 在公开 Trace 中会投影为 `invalid_response`？
- extension discard 如何避免放宽 depth、answer structure 与写权限？
- 为什么 SR2 复用 F2 memory lifecycle，却不能声称新 lineage durability 已完成？
- 为什么 SR2 后必须先完成 SR3 durability，才能进入 SR4 reviewed Mock，而不能直接运行 Provider？
