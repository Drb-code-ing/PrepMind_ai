# Phase 6.9.8 Retriever / FinalResponse P1 S2 reviewed Mock/static 验收

> 日期：2026-08-08  
> 状态：已完成（zero-provider；不形成真实 Provider、产品或 `main` authority）  
> 分支：`drb/phase-6-9-8-p1-s2-reviewed-mock`  
> 基线：`main / origin/main = 0c2faf1d`  
> Lineage：`phase-6.9.8-retriever-final-response-p1-s2-reviewed-mock-v1`

## 1. 结论

S2 reviewed Mock/static 已真实穿过既有 production-shaped candidate chain：

```text
8 zero-call guards
  -> Retriever original query
  -> query-rewrite candidate (6 lanes)
  -> synthetic Qwen search port
  -> verified-evidence projector (6 lanes)
  -> FinalResponse stream candidate (6 lanes)
  -> strict G2 runner / local scorer / local merger
```

Responder 只收到节点生成的 bounded prompt。 `expected`、`oracle`、`caseId`、baseline report、credential、Provider
与 citation authority 只存在于本地 fixture/后置 scorer，不进入 responder。检索 adapter 虽由冻结 fixture 的目标
排序/证据片段驱动，但它只属于 reviewed-Mock fixture，不能被解释为真实 Qwen 检索质量。

本次没有读取根 `.env` 或 credential，没有调用 DeepSeek/Qwen，没有网络、Docker、API、browser、Trace、BackgroundJob、
Outbox 或业务写入；正式 marker/journal/artifact/recovery claim、approved tag 均为 `0`。

## 2. 固定身份与完整性

| 项目                                  | 固定值                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------- |
| schema                                | `phase-6.9.8-retriever-final-response-p1-s2-report-v1`                    |
| authority                             | `zero_provider_retriever_final_response_p1_s2_reviewed_mock`              |
| gate                                  | `p1_mock_quality_not_evidence`                                            |
| `qualityAuthority`                    | `none`                                                                    |
| factory SHA                           | `sha256:8ad0a12ae7bd6365873631cb4908b41888617b9599fdd6865cf7e45c788f0e7d` |
| report SHA                            | `cfb48cb8108768ace9b8e5c5714344f2be74e16300d6997a5e874085275b9db5`        |
| final_11 compatibility SHA            | `b492487db888a2e2d89810faac8cc7b0e50c36b464fb6eb6cfa9a4bc4680a532`        |
| upstream manifest / policy / baseline | `f117f625...bb1ccb189` / `edaa07d1...37537f3` / `2c539b55...f611df`       |

Factory descriptor 同时绑定上述 upstream identity、Task 8 prompt-only responder factory SHA 与 final_11 compatibility
contract；factory/report validator 均使用固定字面 SHA，避免运行时自赋值导致恒真校验。

## 3. 调度、usage 与语义边界

- guards：`8/8`，每条 fake search port call `0`。
- candidate lanes：rewrite `6` + FinalResponse `6`，candidate invocations `12`，最大并发 `1`。
- 节点计数：Retriever original `18`、Retriever candidate `6`、projector `6`、FinalResponse `6`、local merger `12`。
- synthetic Qwen port calls：`17`；这是进程内 fixture 调用，不是 Provider call。
- `providerCalls=0`、`credentialReads=0`；`usageAuthority=synthetic_estimate`。
- `syntheticUsageSamples=12`、`verifiedProviderUsageSamples=0`、`syntheticEstimateCny=null`、
  `verifiedProviderCostCny=null`。G2 的 `verifiedUsage` 只作为结构性 lane 合同字段，不能当成供应商计量、账单或质量
  authority。
- rewrite 不再用 FinalResponse 价格表计算成本；synthetic review 只检查 bounded token usage，不生成 CNY authority。
- semantic axes：rewrite strict `6/6`、FinalResponse strict `6/6`、Recall@5 `1`、nDCG@5 `1`、grounded `1`、citation
  precision `1`、effective required-citation recall `1`、critical-notice recall `1`。
- P95 固定为 `null`，原因 `insufficient_sample_size_6`；S2 不产生 SLA、生产延迟或产品可用性结论。

### final_11 compatibility diagnostic

历史 G1/G2 baseline 仍冻结 `requiredCitationCount=1`，不被改写。当前 projector 对
`evidenceStatus=insufficient + expectsCitations=false` 产生 `status=insufficient`、`citationCount=0`，因此 S2
另记录：

```text
frozenRequiredCitationCount=1
effectiveRequiredCitationCount=0
projectorStatus=insufficient
projectorCitationCount=0
reasonCode=insufficient_projector_omits_citation
```

这只是 S2 compatibility diagnostic。原始 G2 gate 仍透明保留 `passed=false / failureReasons=[citation_recall]`；
S2 只在本地 projector authority 已验证时使用 effective requirement。若 baseline、manifest、输入摘要、oracle hash
或 projector contract 任一漂移，override 不生效并 fail-closed；其它 G2 failure（例如 `false_tool_success`）不会被吞掉。

## 4. 故障矩阵

已验证 semantic mismatch 与 runtime/permission 边界：

| 故障                                                 | 期望行为                                                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| unknown citation / false tool success                | 保留在语义分母，不开 breaker，记录 bounded safety failure                                       |
| schema / usage / transport / timeout / abort / stale | 每 lane 最多一次 dispatch，打开首错 breaker，后缀为 `not_started_quality_breaker`               |
| cross-owner                                          | Retriever 返回 `principal_binding_invalid`，不能伪造成功；lane 以 `permission` 终止并开 breaker |
| parent pre-abort                                     | candidate invocations `0`、wire dispatch `0`、prompt audit `0`、synthetic Qwen calls `0`        |
| compatibility + 其它 failure                         | 只移除已验证的 `citation_recall`，其它 G2 failure 原样保留                                      |

Responder audit 固定为 bounded hashes/keys/counts，不包含 `caseId`、`expected`、`oracle`、baseline、credential 或
raw Provider output；raw data 不保留。

## 5. 验收命令与结果

```text
bun test --max-concurrency=1 packages/agent/tests/phase-6-9-8-retriever-final-response-p1-s2-reviewed-mock.test.ts
4 pass / 0 fail / 73 expect() calls

bun test --max-concurrency=1 packages/agent/tests/phase-6-9-8-retriever-final-response-p1-g1.test.ts \
  packages/agent/tests/phase-6-9-8-retriever-final-response-p1-g2.test.ts
10 pass / 0 fail / 50 expect() calls

bun --filter @repo/agent test
1423 pass / 0 fail / 24241 expect() calls / 177 files

bun --filter @repo/agent typecheck
passed

bun --filter @repo/agent lint
passed

bunx eslint packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-s2-reviewed-mock.ts
passed

bunx prettier --check --end-of-line auto <S2 changed files>
passed

git diff --check
passed
```

`validatePhase698P1S2ReviewedMockBytes` 对固定 canonical bytes 返回 `ok=true`，对字节追加返回 `bytes_mismatch`；
factory validator 返回 `ok=true`。CodeGraph update-check/ensure 已在本任务开始时完成。测试使用内存/系统临时
fixture 并精确清理，未产生正式 evidence。

## 6. 变更面

- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-s2-reviewed-mock.ts`
- `packages/agent/tests/phase-6-9-8-retriever-final-response-p1-s2-reviewed-mock.test.ts`

## 7. 停止门与下一步

S2 只证明 zero-provider reviewed-Mock 的链路、边界和可重算完整性，不证明真实 DeepSeek/Qwen 语义、检索质量、P95、
账单、Docker/API/browser、`/api/chat`、Trace 或 `main` 可用性。不得重跑或改写历史 L1/T3/R5/Task 9C/SR5 evidence。

下一步只能从已推送并完成 main 回归的最新 `main` 新建独立分支，先进行文档/源码 parity 检查，再在用户重新接受当次
DeepSeek/Qwen 数据边界并给出新的 exact L2 authorization 后讨论唯一 L2 semantic canary；普通“继续”不等于该授权。
Docker 容器、镜像和卷保持原状。
