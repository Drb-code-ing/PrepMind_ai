# Phase 6.9.7 Tutor / Organizer Full-gate Schema Recovery SR3 Runner / Durability 验收

日期：2026-08-02

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

Checkpoint authority：`zero_provider_full_gate_schema_recovery_runner_durability`

Quality authority：`none`

## 1. 验收结论

SR3 已完成。它在不修改旧 Full-gate L3 evidence 的前提下，为 Schema Recovery 建立独立
`phase-6.9.7-tutor-organizer-full-gate-schema-recovery-v1` report、runner、source、CLI、marker、journal、
artifact、validator 与 crash-only recovery 合同。

本阶段证明：

- 固定 `72 cases / 24 guards / 24 runtime pairs / 48 runtime lanes / 32 Organizer decisions` 分母能在新
  lineage 下重新计算，旧 F2 只作为非持久化 scheduler/metric kernel；
- `schema_stage_started / schema_stage_succeeded / schema_stage_failed` 会进入独立 append + fsync + SHA-256
  hash-chain，且不会写入旧 F2/L3 journal；
- canonical、extension-discarded、rejected 与 not-observed schema accounting 由 case entries 重算，不能由
  artifact 自报；
- hard-link 排他发布、marker/claim 竞争、journal tail/ABA、live owner、PID reuse、发布冲突和 artifact 漂移均
  fail-closed；
- crash-only recovery 只解释 durable prefix，不创建 executor，不 retry/resume/replay/backfill，也不伪造
  usage、schema 或 semantic aggregate；
- 公共 CLI 只开放 zero-provider bundle validation 与 crash-only seal。SR5 confirmation、approval、credential、
  source admission、marker reservation、harness、executor、fetch 和 Provider port 均未开放。

本阶段不证明 reviewed Mock 质量、真实 DeepSeek 语义、Provider health、full-gate semantic/anchor/P95/token/
CNY、产品 Docker/API/browser、业务写入或 main 可用。

## 2. 独立身份与固定边界

- lineage：`phase-6.9.7-tutor-organizer-full-gate-schema-recovery-v1`；
- source manifest：`phase-6.9.7-tutor-organizer-schema-recovery-source-manifest-v1`；
- source manifest SHA：
  `1a811394b6e6c182ef33bb22c8aa5545400e8083a5f226d9d5eab5e7c40adfbb`；
- runner：`phase-6.9.7-tutor-organizer-schema-recovery-runner-v1`；
- report contract：`phase-6.9.7-tutor-organizer-schema-recovery-report-contract-v1`；
- durability：`phase-6.9.7-tutor-organizer-schema-recovery-durability-v1`；
- CLI：`phase-6.9.7-tutor-organizer-schema-recovery-cli-v1`；
- future approved ref：
  `refs/tags/phase-6-9-7-tutor-organizer-schema-recovery-sr4-approved`，本阶段未创建该 tag；
- future confirmation status：`not_frozen_before_sr5`；
- gate：Mock 只能是 `schema_recovery_mock_quality_not_evidence`；只有未来完整新 lineage controlled-Live
  quality pass 才可能形成 `schema_recovery_full_gate_semantic_gate`。

Source contract 要求 branch、HEAD、upstream、remote、approved tag commit 一致、tracked clean 且正式 artifact
为 0；SR3 只使用 synthetic test source，不形成 approved source claim。

## 3. Runner 与 Schema Stage 生命周期

Schema Recovery wrapper 私有保存 schema lifecycle；传给旧 F2 calculator 的 adapter 只暴露
`appendWireStage`，因此旧 lineage 无法观察、持久化或解释新 schema stages。

每条已 reservation 的 runtime lane 必须遵守：

1. `lane_reserved` durable；
2. `schema_stage_started` durable；
3. 既有八阶段 wire 单调 append；
4. 恰好一个 `schema_stage_succeeded` 或 `schema_stage_failed` terminal；
5. `lane_terminal`；
6. 当前 pair 两条 lane 收口后才允许 `pair_terminal`；
7. contract/safety failure 打开 breaker，后续 lane 只能是 `not_started_quality_breaker`。

Runner 遇到 schema terminal append 的不确定 I/O 失败时不会重试或改写为另一 outcome。Complete synthetic
durability fixture 产生 `24` guard、`48` lane reservation、`48` schema start、`384` wire stage、`48` schema
success、`48` lane terminal、`24` pair terminal，并以
`run_terminal -> publication_started -> evidence_published` 收口；该临时 bundle 的 authority 仍仅
`synthetic_test / qualityAuthority=none`。

## 4. Report 与 Validator

Strict validator 从 journal/artifact 重算：

- 固定 `72/24/48/24/32` counts 与 case order；
- runtime reserved/terminal/orphan/not-started；
- executor/dispatch/response/verified-usage wire；
- canonical/extension-discarded/rejected/not-observed schema accounting；
- semantic、L2 anchor、四项 P95、usage/CNY、安全指标、breaker 与 gate；
- source/report/runner/durability/lineage identity；
- marker、journal tail、logical report 与 physical artifact SHA；
- completion/publication mode 与 recovery claim。

Validator 会拒绝截断、CRLF、重排、duplicate terminal、重新 hash 后的非法状态、未知/free-text/raw 字段、
额外正式文件、旧 lineage token、硬链接冲突与发布后 artifact 修改。分母不完整时 semantic、anchor、P95、
token 与 CNY 全为 `null`。

## 5. Crash-only Recovery

Recovery 只读取 marker 与已 fsync 的 journal prefix：

- dispatch 后崩溃的首 pair 收口为 reserved/terminal/orphan/not-started `2/2/0/46`；
- 两条已 admission lane 变为 `attempted_aborted`，后续 46 lane 为
  `not_started_quality_breaker`；
- schema 未 durable terminal 时固定为 `not_observed`，不猜测 Provider 输出；
- 即使 `usage_validated` wire 已 durable，schema terminal 尚未 durable，recovery 仍保留 wire `1/1/1/1`，
  但 lane usage 与 report aggregate 保持 `null`；
- 已 durable `run_terminal` 但尚未发布时，只恢复同一 report 的 publication；
- live owner/PID reuse、claim race、journal drift 或 `publication_started` 后 hard-link conflict 均 fail-closed。

这不是继续执行或补跑 Agent，也不会读取 credential、创建 runtime 或调用 Provider。

## 6. CLI 与权限边界

固定安全入口只有：

```powershell
bun run --cwd packages/agent eval:phase-6-9-7:schema-recovery:validate
bun run --cwd packages/agent eval:phase-6-9-7:schema-recovery:seal
```

只有存在未来正式中断 attempt 时才允许按运维流程使用 crash-only seal；SR3 当前正式文件为 0，因此不要为了
“验证”手工创建 marker/journal 或运行 seal。Package 没有 Schema Recovery Live script。无参数、额外参数、
旧 confirmation、hostile accessor/getter、未知字段或输出端口失败均在任何 mutation/Provider 边界前关闭。

CLI 对 validator/seal 返回值执行 exact-own-data 白名单、UUID/SHA/枚举/计数校验；固定 lineage、
`providerCalls=0`、authority 与 operation 字段最后写入，依赖返回值不能覆盖或注入 raw text。

## 7. 验证结果

- SR3 focused：`23/23`；
- SR2/SR3/F2 compatibility：`105/105`，`3633` assertions；
- Agent full：`1167/1167`，`21651` assertions；
- AI full：`325/325`，`2378` assertions；
- Agent/AI typecheck 与 lint：通过；
- Prettier 与 `git diff --check`：通过；
- 独立 contract/security 与 test-coverage 终审：`APPROVED`，无阻断项；
- 旧 L3 只读 validator：
  `ok=true / runId=2b0ac3a0... / gate=full_gate_quality_gate_failed /
qualityAuthority=none / journalRecords=296 / finalJournalEvent=evidence_published`；
- 旧 L3 logical report SHA：
  `595e9fce929aa1cbfe3ed3982edd27fcf81f9672395ba070328b4c869f974683`；
- 旧 L3 physical artifact SHA：
  `e081939bb7f4b17235b1d9afb61d78031879bb80b9d64c952e4b86531cd7dbe5`；
- 正式 SR5 files：`0`；Schema Recovery approved tag：`0`。

## 8. Zero-provider 与副作用清单

- `.env` / credential read：`0`；
- global fetch / Provider call：`0`；
- 正式 Mock/Live/production Provider CLI：`0`；
- Docker/API/browser：`0`；
- 业务数据读写：`0`；
- 正式 SR5 tag/marker/journal/artifact/recovery claim：`0`；
- 旧 L3 evidence 修改：`0`；
- `.codex/`：保持既有本地未跟踪状态，不进入提交。

## 9. 下一任务与停止门

下一原子任务仅 SR4 zero-provider reviewed Mock/static checkpoint：fresh deterministic baseline、reviewed Mock
穿过 recovery Tutor、Organizer V9、第一方 synthetic adapter、本地 authority/merger 与 SR3 runner，并完成全量
static/history parity、Reader Testing、正式 SR5 文件/tag 为 0 的复核。

SR4 仍禁止 credential、Provider、正式 Live、Docker/API/browser、业务数据与 main。SR5--SR7、Phase
6.9.8/6.10/8/9 与博客收尾继续阻断。

## 10. 主要文件

- `packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-authority.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-contract.ts`；
- `packages/agent/src/evals/run-phase-6-9-tutor-organizer-schema-recovery.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-durability.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-cli-core.ts`；
- `packages/agent/scripts/phase-6-9-7-tutor-organizer-schema-recovery-cli.ts`；
- `packages/agent/tests/phase-6-9-tutor-organizer-schema-recovery-sr3-*.test.ts`。

## 11. 回顾时可以问

- 为什么 SR3 复用 F2 scheduler/metric kernel，却必须把 schema lifecycle 保持为私有新 lineage？
- 为什么 `schema_stage_started` 必须在 Provider/wire terminal 前 durable？
- 为什么 extension discard 要单独计数，而不能直接算 canonical？
- 为什么 `usage_validated` 已 durable 时，crash recovery 仍不能伪造 usage aggregate？
- 为什么 crash-only seal 可以完成 publication，却不能恢复 executor？
- 为什么 CLI 返回值还要做 exact-own-data 白名单，不能直接展开依赖对象？
- 为什么 SR3 完成后仍必须先做 SR4 reviewed Mock，不能直接进入 controlled-Live？
