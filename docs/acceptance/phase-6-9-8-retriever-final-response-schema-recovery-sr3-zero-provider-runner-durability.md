# Phase 6.9.8 Retriever / FinalResponse Schema Recovery SR3 验收

日期：2026-08-09
分支：`drb/phase-6-9-8-retriever-final-response-schema-recovery-sr3`
基线：`main == origin/main == 849af1c84231a4c0fbe54426ddae02d0a1b28a30`（实现提交前）
lineage：`phase-6.9.8-retriever-final-response-schema-recovery-v1`

## 结论

SR3 的 zero-provider runner/source-admission/durability 实现与回归已完成。它建立了独立的
`8 guards + 6 rewrite candidates + 6 FinalResponse candidates` 合同（20 个 report entries、12 次候选调用），并把
guard-first、pair-interleaved、最大并发 1、每 lane 单次 dispatch、首错 breaker、reservation-before-dispatch、fsynced
hash-chain journal、hard-link artifact、严格重算 validator 和 crash-only prefix recovery 固定为可审计边界。

本阶段只形成：

```text
authority       zero_provider_retriever_final_response_schema_recovery_runner_durability
qualityAuthority none
gate            schema_recovery_mock_quality_not_evidence（reviewed Mock）
providerCalls   0
credentialReads 0
businessWrites  0
formalEvidence  0
```

这不是 DeepSeek/Qwen 语义质量、RAG 召回、产品 `/api/chat`、Docker/API/browser、Trace、P95/SLA 或 `main` 产品可用性
证据；不解锁 SR4 之外的 semantic/product authority。不得把 synthetic usage 或 reviewed Mock 当供应商账单。

## 实现与边界

- contract 固定 lineage、manifest/policy/source identity，分母为 `8/6/6/12/20`，预算为 input `37600`、output `8800`、
  总成本 `0.176 CNY`，最大并发 `1`，禁止 retry/replay/resume/backfill/BackgroundJob/Outbox。
- source admission 同时提供 Git-verified 生产 seam（branch、HEAD、upstream、origin、approved ref、clean tree、正式
  evidence=0、source bundle hash）和 synthetic-only 测试 seam；capability 使用模块私有 WeakMap/WeakSet 单次消费。
- durability 只接受 `synthetic_test` 或已重新校验 source drift 的 `git_verified` admission；marker 固定
  `providerCalls=0 / credentialReads=0 / businessWrites=0`。根目录与 formal 文件均 fail-closed 防 symlink、非文件、
  越界路径与 hard-link inode 漂移。
- journal 以 fsync 后的 hash chain 记录 reservation、guard、lane stage/terminal、run terminal、recovery claim、
  publication_started、evidence_published；recovery 只补 durable prefix，不创建 executor、不重放调用、不恢复 sibling。
- CLI 增加严格的 zero-provider `run`、`validate`、crash-only `recover/seal` 参数；脚本默认在 OS 临时目录使用 reviewed Mock，
  以避免把正式 evidence 写入仓库；SIGINT/SIGTERM 映射为 AbortSignal，最终状态仍需经 crash-only seal/validator。

## 身份冻结

```text
branch       drb/phase-6-9-8-retriever-final-response-schema-recovery-sr3
approvedRef  refs/tags/phase-6-9-8-retriever-final-response-schema-recovery-sr3-approved
manifestSha  d14c08455126fad492f9f01ed07a1a4fd911241c62384fbd07537e4ffda1bede
policySha    6c1f1b0388b2b595f141061cb3d0d34607b6214a4772e7cb4a17309e431cebf8
sr2Fixture   59010e16fd665df6d497517276dbeacb3f5973036a07e8cf00010569da171505
```

根导出 `packages/agent/src/index.ts` 已纳入 source bundle path，防止公共 export 漂移绕过 source parity；CLI 的 validate/recover 默认
路径固定解析到仓库根，不会把正式 bundle 错当成 `packages` 子目录。

## 验收证据

### focused / 组合

```text
SR3 focused: 15/15 tests, 49 expect() calls, 5 files
SR1 + SR2 + SR3 + Task 9B: 63/63 tests, 635 expect() calls, 14 files
Agent full: 1477/1477 tests, 24908 expect() calls, 189 files
AI full: 345/345 tests, 2662 expect() calls, 28 files
```

执行命令：

```powershell
bun test packages/agent/tests/retriever-schema-recovery-sr3-contract.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr3-durability.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr3-runner.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr3-source-admission.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr3-cli.test.ts

# 组合命令：SR1 + SR2 + SR3 + Task 9B（14 files）
bun test packages/agent/tests/retriever-schema-recovery-contract.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr2-provider-robustness.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr2-runtime-metamorphic.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr2-fault-runner.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr3-contract.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr3-durability.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr3-runner.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr3-source-admission.test.ts `
  packages/agent/tests/retriever-schema-recovery-sr3-cli.test.ts `
  packages/agent/tests/phase-6-9-8-retriever-final-response-task9b-contract.test.ts `
  packages/agent/tests/phase-6-9-8-retriever-final-response-task9b-durability.test.ts `
  packages/agent/tests/phase-6-9-8-retriever-final-response-task9b-lineage-cli.test.ts `
  packages/agent/tests/phase-6-9-8-retriever-final-response-task9b-live-config.test.ts `
  packages/agent/tests/phase-6-9-8-retriever-final-response-task9b-runner.test.ts

bun --cwd packages/agent test
bun --cwd packages/ai test
bun --cwd packages/agent typecheck
bun --cwd packages/agent lint
git diff --check
```

组合命令本次回放为 `63/63`、`635` assertions；不要把旧 SR2/SR3 handoff 中的 `59/619` 或早期 `62/632` 计数当作当前证据。

### synthetic CLI 回放

```text
reservations/dispatches/responses/verifiedUsage = 12/12/12/12
succeeded = 12
input/output = 8040/3600
verifiedCostCny = 0.006732（synthetic estimate，仅用于 runner accounting）
journalRecords = 72
providerCalls/credentialReads/businessWrites = 0/0/0
```

`bun --cwd packages/agent eval:phase-6-9-8:schema-recovery:sr3` 使用临时 root，运行结束后删除临时 root。公开
`...:validate` 在当前仓库没有正式 SR3 bundle 时返回 `ok=false`，这是 fail-closed 的预期，不创建文件；未执行
`recover/seal`，也未传入任何 Live、credential 或 `.env` 参数。

## 未解锁与下一步

SR3 仍未创建 approved tag、正式 marker/journal/report/artifact/recovery claim，未读取 root `.env`，未调用 DeepSeek/Qwen，
未启动 Docker/API/browser。下一阶段是 SR4 reviewed Mock/static：将 SR3 runner 接到 Retriever、evidence projector、
FinalResponse 与 local merger，完成独立 zero-provider 语义/权限/Trace 边界后再决定是否进入 fresh SR5 admission。

历史 SR0/SR1/SR2 事实保持不可变；任何未来 controlled-Live 都必须重新接受当次 DeepSeek/Qwen 数据边界并给出绑定新 source
的 exact authorization。
