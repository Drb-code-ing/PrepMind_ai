# Phase 6.9.8 Retriever / FinalResponse P1 G2 runner/durability 验收

> 日期：2026-08-08
> 状态：已完成（zero-provider；未形成 semantic/product/main authority）
> 分支：`drb/phase-6-9-8-g2-runner-durability`
> 基线：`main / origin/main = a12db738`
> Lineage：`phase-6.9.8-retriever-final-response-p1-g2-v1`

## 1. 结论

G2 已把 G1 的静态合同推进为可审计的 one-shot production-shaped runner。它先执行 8 条 zero-call guard，再按固定顺序
串行执行 6 条 query-rewrite 与 6 条 FinalResponse lane；每个 lane 最多一次 candidate invocation，最大并发为 1。
所有 actual 仍只来自 bounded candidate projection，expected/baseline/oracle 只在后置本地 scorer 读取。

G2 新增并验证了：

- source admission 与单次消费的 opaque capability；
- guard-first / pair-serial 调度、parent abort、stale、预算与首错 breaker；
- reservation-before-dispatch、exclusive marker、fsynced hash-chain journal；
- strict lane 状态机、report 重算、hard-link artifact publication 与 bundle validator；
- crash-only prefix recovery。Recovery 只补齐已 durable 的 terminal/publication，不构造 adapter、不补发 candidate/Provider call，
  也不是 resume/replay/backfill。

本阶段严格保持：`providerCalls=0`、`credentialReads=0`、`formalEvidence=0`，不读取根 `.env`，不启动 Docker/API/browser，
不写 Trace、BackgroundJob、Outbox 或业务数据。G2 authority 为
`zero_provider_retriever_final_response_p1_g2_runner_durability`，`qualityAuthority=none`；即使 synthetic gate 通过，
也不能宣称 DeepSeek/Qwen 语义质量或产品可用。

## 2. 固定身份与调度

| 项目                               | 固定值                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| schema                             | `phase-6.9.8-retriever-final-response-p1-g2-report-v1`                                                                               |
| durability                         | `phase-6.9.8-retriever-final-response-p1-g2-durability-v1`                                                                           |
| marker / journal / artifact        | `phase-6.9.8-retriever-final-response-p1-g2-{marker,journal,artifact}-v1`                                                            |
| lane 顺序                          | `rewrite_01, rewrite_03, rewrite_05, rewrite_09, rewrite_12, rewrite_15, final_01, final_07, final_09, final_11, final_13, final_15` |
| guards                             | `8`，全部要求 zero-call                                                                                                              |
| candidate lanes                    | `12`（rewrite `6` + FinalResponse `6`）                                                                                              |
| candidate invocation cap           | `12`                                                                                                                                 |
| max concurrency                    | `1`                                                                                                                                  |
| retry / resume / replay / backfill | `false / false / false / false`                                                                                                      |

固定执行前缀：

```text
source admission
  -> 8 guards
  -> 6 rewrite lanes (baseline -> candidate)
  -> 6 FinalResponse lanes (projector -> candidate)
  -> strict local scorer
  -> durable report/journal/artifact publication
```

普通 `semantic_mismatch` 保留完整分母并继续；contract、permission、safety、budget、transport、schema、usage、stale 或
不可恢复的 durability failure 打开 breaker，后缀固定为 `not_started_quality_breaker`。父级取消固定为
`not_started_parent_aborted`，不把取消伪装成模型质量失败。

## 3. Durability 与 recovery 证明

正式路径只允许一个 marker。每个 lane 必须先 reservation 并 fsync，再允许 dispatch；journal 通过 hash-chain 严格校验
sequence、lane 顺序、stage 顺序、source identity、marker/report identity 与 terminal prefix。publication 使用 hard-link，
同字节重复 publication 可幂等接受，冲突永久 fail-closed。

允许的单调 lane 状态为：

```text
not_started -> reserved -> dispatched -> response_observed -> strict_validated -> terminal -> published
```

crash-only recovery 仅针对 dead owner，且只从已持久化 prefix 重建固定 report；recovery claim 自身也绑定 journal tail/hash，
并以单一 winner 发布。测试证明：

- reserved-only / dispatch-before-call prefix 不会产生 Provider call；
- durable terminal 可完成 publication，不能重放已完成 lane；
- active owner、非文件 marker、多个 marker、journal 截断/CRLF/hash tamper、重复或乱序 event 均 fail-closed；
- synthetic 临时根目录在测试结束后精确清理，正式 `.tmp` evidence 保持为 0。

## 4. 实际验收证据

### 4.1 focused

```text
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-p1-g2.test.ts
5 pass / 0 fail / 23 expect() calls
```

覆盖 source drift 与 capability single-use、8 guards + 12 serial lanes、candidate-only projection、semantic mismatch 与
transport breaker、parent abort/zero-wire suffix、exclusive marker、journal tamper 与 crash-only prefix recovery。

### 4.2 Agent full

```text
bun --filter @repo/agent test
1811 pass / 0 fail / 24157 expect() calls / 176 files
```

### 4.3 synthetic CLI

执行：

```text
bun scripts/phase-6-9-8-retriever-final-response-p1-g2-cli.ts \
  RUN_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_P1_G2_ZERO_PROVIDER_ONCE
```

结果：

```text
runId=635917f2-39b4-4b55-9ae4-0a80ce7fe864
gate=g2_runner_durability_ready
providerCalls=0
credentialReads=0
formalEvidence=0
candidateInvocations=12
journalRecords=72
finalJournalEvent=evidence_published
validator.ok=true
qualityAuthority=none
reportLogicalSha256=28f76afd28dbba7b58d3cad73904533f742a94829b3173c739e7571fd2681d38
physicalArtifactSha256=7691ea79982e764ceaf4fc8bc3cbbc71981df6864b8338ef64a1517d189ec865d
```

CLI 使用 isolated synthetic root，并在退出时清理；上面的 report/artifact SHA 是该次 bounded diagnostic 的完整性回执，
不是生产 evidence，也不授予 Live/semantic authority。

### 4.4 工程检查

以下检查均通过（Windows 使用 `--end-of-line auto`，避免 `core.autocrlf` 造成伪差异）：

```text
bun --filter @repo/agent typecheck
bun --filter @repo/agent lint
bunx prettier --check --end-of-line auto <G2 changed files>
git diff --check
```

CodeGraph update-check/ensure 已完成，新增源码索引同步；本阶段未改写 `.codegraph` 之外的业务数据。

## 5. 变更面与公开边界

实现文件：

- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-g2-contract.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-g2-source-admission.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-g2-runner.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-g2-durability.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-g2-cli-core.ts`
- `packages/agent/scripts/phase-6-9-8-retriever-final-response-p1-g2-cli.ts`
- `packages/agent/tests/phase-6-9-8-retriever-final-response-p1-g2.test.ts`

package public exports 只增加 G2 contract/runner/durability/CLI-core subpath；CLI script 不接收 credential、provider 或输出路径
注入。G2 runner 仍是评测 lineage，不改变 `/api/chat`、Retriever/FinalResponse 生产 composition，也不创建异步任务。

## 6. 停止门与下一步（G2 完成时的历史记录）

G2 完成时，下一原子任务是从最新、已推送的 `main` 新建普通 git 分支，执行 S2 reviewed Mock/static。S2 需要继续保持
zero-provider，验证真实 production candidate chain、Qwen synthetic port、evidence projector、FinalResponse、strict
validator 与本地 merger 的 fault matrix；S2 gate 仍为 `p1_mock_quality_not_evidence / qualityAuthority=none`。

该历史 checkpoint 后，S2 已完成并完成 source/remote parity，且已在 `main` 二次回归；当前若另立 L2 semantic canary admission，仍必须重新接受当次
DeepSeek/Qwen 数据边界并给出精确到 source/lineage 的一次性授权；任何“继续/好的”都不替代 exact authorization。L2
成功也不自动解锁 Docker/API/browser、产品 `/api/chat` 或 `main`，这些必须另行验收、合并和推送。

已封存的 L1/T3/R5/Task 9C/SR5 evidence 不得 retry、resume、replay、backfill、seal、recovery、删除或改写；Docker
容器、镜像和卷保持原状。
