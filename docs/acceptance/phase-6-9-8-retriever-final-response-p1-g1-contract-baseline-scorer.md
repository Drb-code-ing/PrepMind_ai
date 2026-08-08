# Phase 6.9.8 Retriever / FinalResponse P1 G1 contract、baseline 与 scorer 验收

日期：2026-08-08
状态：G1 已完成，zero-provider；下一步为 G2 one-shot runner/durability
分支：`drb/phase-6-9-8-g1-manifest-baseline-scorer`
基线：`main` / `origin/main` `9a3c32e2`（G1 从该 clean source 派生）
Lineage：`phase-6.9.8-retriever-final-response-p1-v1`

## 1. 验收结论

G1 已把 P1 设计冻结的最小语义样本落成可执行、可复算、fail-closed 的本地合同：独立 manifest、subset
deterministic baseline、candidate-only projection 与 strict report/scorer/gate 均已实现。G1 只证明输入身份、
baseline 重算、候选边界和聚合校验自洽，不证明真实模型语义、Provider health、产品 `/api/chat`、Docker/API/browser、
Trace 或 `main` 产品 authority。

```text
authority       = zero_provider_retriever_final_response_p1_g1_contract_baseline
qualityAuthority= none
providerCalls   = 0
credentialReads = 0
qwenCalls       = 0
formalEvidence  = 0
businessWrites  = 0
Docker/API/web  = not started
P95/SLA         = null / insufficient_sample_size_6
```

G1 的 scorer 测试会构造严格、无网络的候选报告来验证聚合算法和失败优先级；这些 synthetic observations 不是
Provider 结果，也不会提升 `qualityAuthority`。

## 2. 固定身份与分母

```text
P1 manifest SHA = f117f6257b2d412912d0a50b322c23d74ca194ea37667a614c45549bb1ccb189
P1 policy SHA   = edaa07d1071a93336b40d68948011a21a3e96938ca7d7b862991bb2bc37537f3
subset baseline = 2c539b55be531a91a016655b8318454292b6ac286cd826d9c6e39796b5f611df
lineage         = phase-6.9.8-retriever-final-response-p1-v1
```

| lane             | 固定 case                                                                        |            语义分母 |
| ---------------- | -------------------------------------------------------------------------------- | ------------------: |
| guard            | `guard_02, guard_03, guard_04, guard_09, guard_10, guard_11, guard_15, guard_16` | 8（必须 zero-call） |
| rewrite          | `rewrite_01, rewrite_03, rewrite_05, rewrite_09, rewrite_12, rewrite_15`         |                   6 |
| FinalResponse    | `final_01, final_07, final_09, final_11, final_13, final_15`                     |                   6 |
| semantic lanes   | rewrite + FinalResponse                                                          |                  12 |
| manifest entries | 全部固定 entry                                                                   |                  20 |

rewrite baseline 的只读映射为：`01→runtime_03`、`03→runtime_05`、`05→runtime_07`、`09→runtime_11`、
`12→runtime_14`、`15→runtime_15`。Baseline 使用 fixed fake composition port，搜索、rewrite model、FinalResponse
model、Qwen 和 credential 计数全部为零。

## 3. 实现边界

- manifest 从 Task 8 与 Retriever original-query baseline 读取只读输入，重新生成并校验独立 SHA；CLI、环境变量和
  外部参数不能覆盖顺序、case 或 policy。
- selection label 使用中性的 slot 标签（例如 `p1_rewrite_slot_01`），不把 critical、expected、evidence 或
  baseline oracle 泄漏给候选模型。
- candidate contract 只投影实际 bounded prompt 所需字段：rewrite 为 `originalQuery/recentTurns/activeContext`，
  FinalResponse 为 `latestUserMessage/recentConversation`；`caseId`、expected、baseline、citation、tool、质量阈值
  等评测字段不进入 projection。
- baseline report 只保存脱敏 hash、排序引用和 bounded metric；canonical bytes、manifest identity 与 baseline SHA
  均由本地重算，invalid UTF-8、字节漂移和 identity 漂移 fail-closed。
- scorer 严格重算所有 lane、wire、verified-usage、预算、安全和 semantic aggregate，拒绝自报 aggregate、重复/缺失/
  乱序 case、旧 lineage、计数不一致和 candidate invocation 超过 `12`。
- contract/permission/safety/budget/transport/schema/usage/stale failure 必须打开 breaker；普通
  `semantic_mismatch` 不得打开 breaker。`semantic_mismatch + breaker=true` 会被 scorer 拒绝。
- 六条语义 lane 的样本不足以形成 P95/SLA，正式值固定为 `null`，原因固定为 `insufficient_sample_size_6`。

## 4. 质量门（已冻结并由 scorer 执行）

```text
guards:                         8/8 pass, zero-call 8/8
rewrite strict/runtime/wire:    6/6/6/6
final strict/terminal/wire:     6/6/6
verified usage:                 rewrite 6/6, FinalResponse 6/6
Recall@5:                       >= 0.90
nDCG@5:                         >= 0.85
eligible subset uplift:         >= 0.08
critical target recall:         1
rewrite intent preservation:    >= 0.95
unsafe rewrite:                 0
grounded rubric:                >= 0.90
citation precision:             1
required citation recall:       >= 0.90
critical notice recall:         1
false tool/citation/safety:     0
P95/SLA authority:              null
```

只有完整、严格、零安全失败的 G1 contract report 才能得到
`p1_g1_contract_baseline_passed`；G1 仍固定 `qualityAuthority=none`，不能把本地 synthetic scorer 结果写成模型质量
通过。

## 5. 验收命令与结果

以下命令均在 `E:/PrepMind_ai智能备考助手/packages/agent` 或仓库根执行，未读取 `.env`，未启动 Docker/API/browser：

```text
packages/agent/node_modules/.bin/prettier.exe --check \
  packages/agent/src/index.ts \
  packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-manifest.ts \
  packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-baseline.ts \
  packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-scorer.ts \
  packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-candidate-contract.ts \
  packages/agent/tests/phase-6-9-8-retriever-final-response-p1-g1.test.ts
bun run typecheck
bun run lint
bun test --max-concurrency=1 tests/phase-6-9-8-retriever-final-response-p1-g1.test.ts
bun test --max-concurrency=1 tests
```

结果：

- Prettier、TypeScript `--noEmit`、ESLint 全部通过；
- focused `5 pass / 0 fail / 27 expect()`；
- Agent full `1414 pass / 0 fail / 24108 expect()`，175 files；
- focused 测试稳定使用 `--max-concurrency=1`，避免 Bun 并发调度造成 Git fixture 偶发超过 5 秒的测试级超时；业务合同和
  production code 未因该调度差异改变。

## 6. 未做事项与停止门

- 未读取真实 `.env`/DeepSeek/Qwen credential，未调用 Provider 或真实 Qwen embedding；
- 未创建 approved tag、正式 marker/journal/report/artifact/recovery claim，未写 Trace、BackgroundJob、Outbox 或
  PostgreSQL/Redis/MinIO；
- 未启动 Docker、Nest API、Web 或可见浏览器，未执行产品账号验收；
- 不修改或重跑已封存的 V2 L1、T3、R5、Task 9C 等 evidence。

下一步必须从最新、已推送并合入的 `main` 新建普通 git 分支 `drb/phase-6-9-8-g2-runner-durability`（不得从 G1 分支
再开分支、不得使用 worktree），实现 one-shot runner、exclusive marker、hash-chain journal、hard-link publication、
strict validator 与 crash-only recovery。G2 仍 zero-provider；G2 与后续 S2 完成后，才可申请独立 L2，并且必须重新接受
当次 DeepSeek/Qwen 数据边界和 exact authorization。

## 7. 可回顾问题

1. 为什么 G1 需要独立 manifest/baseline SHA，而不能直接把 Task 8 的 48-case report 当作当前 authority？
2. 为什么 candidate projection 要删除 `caseId`、expected、baseline、citation 和质量阈值？
3. 为什么 semantic mismatch 不打开 breaker，而 schema/usage/permission failure 必须打开？
4. 为什么六条语义 lane 的 P95 固定为 `null`，不能用 median/max 冒充 SLA？
5. G1 通过后，G2 的 marker/journal/crash-only 解决哪类丢失任务问题，为什么仍不能重放 Provider call？
