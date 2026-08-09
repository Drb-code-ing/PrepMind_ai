# Phase 6.9.8 Retriever / FinalResponse Schema Recovery SR4 验收

日期：2026-08-09
分支：`drb/phase-6-9-8-retriever-final-response-schema-recovery-sr4`
基线：`main == origin/main == 421015dbf472e008fad32200fa8a89e240818fcf`（实现前）
lineage：`phase-6.9.8-retriever-final-response-schema-recovery-v1`

## 结论

SR4 的 reviewed Mock/static 已完成。它修复了“Mock 直接把 object 交给 strict schema，导致 extension 被错误判为 schema
failure”的测试链路，并把 SR3 固定 runner 接到了实际 Retriever/FinalResponse production-shaped 节点。默认回放完整通过：

```text
authority       zero_provider_retriever_final_response_schema_recovery_sr4_reviewed_mock
qualityAuthority none
gate            schema_recovery_mock_quality_not_evidence / passed=true
providerCalls   0
credentialReads 0
businessWrites  0
formalEvidence  0
```

这只是一条 zero-provider reviewed Mock/static 证据，不是 DeepSeek/Qwen 真实质量、RAG 召回、产品 `/api/chat`、Docker/API/
browser、Trace、P95/SLA、账单或 `main` 产品可用性证据。SR4 只解锁从最新推送 `main` 新开的 fresh SR5 admission；不授权
Provider 调用。

## 实现范围

SR4 的实际节点路径固定为：

```text
actual bounded prompt
  -> prompt-only responder（不接收 expected/oracle/caseId/baseline）
  -> in-memory raw JSON
  -> parseModelAgentJsonContentWithPolicy（bounded parser + canonical projection）
  -> runRetrieverAgentNodeV1（original + rewrite candidate）
  -> createRetrieverSearchPortV1.synthetic_executor（synthetic Qwen port）
  -> projectVerifiedEvidenceBundleV1
  -> runFinalResponseAgentNodeV1（stream + terminal）
  -> local citation ledger / merger
  -> SR3 fixed-denominator runner
```

关键边界：

- raw JSON 仅在内存中短暂存在；extension 只形成固定 `extension_fields_discarded` 诊断，raw content、raw hash、字段
  名、字段值、prompt、用户正文和第三方对象引用均不保留。
- `parseModelAgentJsonContentWithPolicy` 绑定 module-owned exact schema identity；canonical projection 重新构造 plain
  `{ rewrittenQuery }`，不 coercion、default、clamp、retry 或 replay。
- parser/runtime failure 复用 SR3 `Phase698RetrieverSchemaRecoverySr3RuntimeError`，因此 schema、usage、transport、
  timeout、abort、cross-owner 会在 runner 中保持独立的 fail-closed 分类。
- expected/oracle 只允许在 runner 返回后用于静态观察；responder 审计确认没有读取这些字段。
- FinalResponse 的 citation allowlist、owner binding、RAG omission、写入隔离和本地 merger 继续由既有节点/权限边界掌握；
  SR4 不扩大 Agent、Trace、BackgroundJob、Outbox 或产品写权限。

## 身份与固定分母

```text
factoryVersion  phase-6.9.8-retriever-final-response-schema-recovery-sr4-factory-v1
factorySha256    sha256:7bc32c8ed68c3c8d76c9c983b40e771f24c0181cda7976cbc97ab1fb4c26d157
sr3ManifestSha  d14c08455126fad492f9f01ed07a1a4fd911241c62384fbd07537e4ffda1bede
sr3PolicySha    6c1f1b0388b2b595f141061cb3d0d34607b6214a4772e7cb4a17309e431cebf8
sr3ReportSha    73f0648549e02ec02de2907718d27b71fded2b76e91ac153e7df312a40951ef8
reportSha       8ec78ed0f41927ee35eab8fc4a782692415f5cdf3ef72d3b6ebbd6c4e016e4ea
guards          8
rewrite         6
finalResponse   6
reportEntries   20
candidateCalls  12
maximumConcurrency 1
```

## 默认回放结果

```text
guards                                  8/8 (zero-call 8/8)
reservations/dispatches/responses/usage 12/12/12/12
succeeded/failed/notStarted             12/0/0
Retriever original/candidate            18/6
evidence projector/FinalResponse/merger 6/6/6
synthetic Qwen port calls               18
rewrite schema                          4 canonical / 2 extension discarded / 0 rejected
FinalResponse strict                    6
rawDataRetained                         false
temporary evidence                      created=1 / remaining=0
formal namespace                        0
```

合成 usage 只用于本地 runner accounting，不是 Provider verified usage 或账单；SR4 report 的 `qualityAuthority` 永远为
`none`。

## 验收命令与结果

### SR4 focused 与组合

```powershell
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr4-reviewed-mock.test.ts
```

结果：`11 pass / 0 fail / 99 expect()`。

SR1 + SR2 + SR3 + Task 9B + SR4 组合：

```powershell
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
  packages/agent/tests/phase-6-9-8-retriever-final-response-task9b-runner.test.ts `
  packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr4-reviewed-mock.test.ts
```

结果：`74 pass / 0 fail / 734 expect()`，`15` files。

### CLI smoke、包级与跨包静态回归

```powershell
bun --cwd packages/agent eval:phase-6-9-8:schema-recovery:sr4:mock
bun --cwd packages/agent test
bun --cwd packages/ai test
bun --cwd packages/agent typecheck
bun --cwd packages/agent lint
bun --cwd packages/ai typecheck
bun --cwd packages/ai lint
bun --cwd packages/types test
bun --cwd apps/server build
bun --cwd apps/web lint
bun --cwd apps/web test
```

本次结果：

```text
SR4 focused                 11/11, 99 assertions
SR1+SR2+SR3+Task9B+SR4      74/74, 734 assertions
Agent full                  1488/1488, 25020 expect(), 190 files
AI full                     345/345, 2662 expect(), 28 files
Types                       42/42 + tsc
Server build                passed
Web lint                    passed
Web tests                   487/487
Agent/AI typecheck/lint     passed
```

`packages/types` 的 Node `MODULE_TYPELESS_PACKAGE_JSON` 仅为既有警告，不影响 `42/42 + tsc` 结果。SR4-owned TS/JSON 与新增
Markdown 的 Prettier/diff 检查在提交前再次执行；历史 Markdown 不做全仓库换行重排。

## formal namespace 与副作用核对

SR4 仅在 OS 临时目录创建一次 evidence probe，case 后 `remainingCount=0`。当前 SR4 namespace 中以下对象均为 `0`：

```text
approved tag / marker / journal / formal report / root artifact / recovery claim = 0
provider calls / credential reads / business writes = 0
```

未读取仓库根 `.env`，未调用 DeepSeek/Qwen，未运行真实 Live、curl、单 case Provider 探测、Docker/API/browser 或产品写入。
不得删除、改写或伪造历史 SR5/L3/P1/T3/R5 sealed evidence；不得使用 `docker compose down -v`、volume 删除、数据库 reset、
Redis flush 或 MinIO wipe。

## 未解锁与后续

SR4 通过只说明 schema-recovery 的工程化 reviewed Mock/static 边界成立；它不能回答真实 Provider 是否能稳定返回正确
schema，也不能证明 Retriever 召回、FinalResponse 质量、P95/SLA 或产品可用性。下一步是：

1. 将本分支代码与本验收/入口文档一阶段一提交并推送；
2. 从该提交切换 `main`，`--no-ff` 合并，再执行 SR4 focused/static/typecheck 回归并推送 `origin/main`；
3. 如需真实 SR5，重新接受当次 DeepSeek/Qwen 数据保留/训练边界，并针对新的 main source 给出唯一 exact authorization；
4. SR5 即使 semantic gate 通过，也仍需独立 SR6 产品 Docker/API/可见浏览器/Trace 验收，不能自动进入产品或博客收尾。

## main parity 回执

功能提交 `ed9e76f2` 已推送到 `origin/drb/phase-6-9-8-retriever-final-response-schema-recovery-sr4`，随后已切回 `main` 并以
`--no-ff` 合并。合并后二次回放已通过：

```text
SR4 focused       11/11, 99 assertions
SR4 combo         74/74, 734 assertions
CLI smoke         gate passed, providerCalls=0
Agent/AI typecheck passed
Agent/AI lint      passed
```

main merge=`d5029f90eea473e22ec1c80b473b5649332acf6a` 已推送；`git rev-parse main origin/main` 复核结果一致。该动作不改变
SR4 report、factory SHA、formal namespace 或 zero-provider authority。
