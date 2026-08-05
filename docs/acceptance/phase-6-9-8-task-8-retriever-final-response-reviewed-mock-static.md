# Phase 6.9.8 Task 8 — Retriever / FinalResponse reviewed Mock/static 验收

> 日期：2026-08-05
> 分支：`drb/phase-6-9-8-retriever-final-response-contract`
> 基线：`a60692c8bf26bf99f1a9d7ee40f736b7f176ce23`
> Authority：`zero_provider_retriever_final_response_reviewed_mock_static`
> Quality Authority：`none`
> Provider / credential / Qwen calls：`0 / 0 / 0`

## 1. 验收结论

Task 8 已建立固定 `16 guard + 16 query rewrite + 16 FinalResponse = 48 case` 的 reviewed Mock/static
checkpoint。48 个 case 使用独立 manifest、policy、prompt-only Mock responder、strict report/scorer/gate 与 canonical
bytes validator；实际值先穿过 Task 3--7 的 production candidate/node/projector/stream ledger，再由后置 scorer 与冻结
expected 比较。

本 checkpoint 的 gate 为 `mock_quality_not_evidence`，`passed=true`，但 `qualityAuthority=none`。它证明静态数据集、
本地权限/安全门、prompt-only Mock 运行路径、指标重算与报告完整性在当前源码下自洽；不证明 DeepSeek/Qwen 的真实
质量、真实费用、P95、产品 API、Docker、浏览器、SLA 或生产可用性。

Task 8 完成后必须停止。Task 9 只有在当前提交已推送且 source parity 成立、fresh 数据保留边界重新接受、精确
Phase 6.9.8 一次性授权与专用 credential admission 全部满足后，才可独立执行；本任务没有创建或消费该授权。

## 2. 为什么需要这个任务

Task 3 已冻结 original-query Retriever baseline，Task 5/6 已分别完成 query rewrite 与 FinalResponse contract，Task 7
已把它们接入 Chat composition；但这些工程 checkpoint 仍不能回答以下问题：

1. rewrite candidate 是否在固定多轮/省略问题上保留实体、公式、数字与约束，并对检索排序产生可复算提升；
2. FinalResponse 是否只使用本地授权 evidence，稳定生成 grounded 内容、必要保守提示和合法 citation；
3. anonymous、跨 owner、credential、prompt injection、abort、deadline、budget/config 失败是否在 runtime/search 前
   保持 zero-call；
4. Mock 是否只读取真实 bounded prompt，而不是读取 case id、expected 或 oracle 后“背答案”；
5. usage、成本、terminal、分母、安全失败与 authority 是否能从逐 case actual 严格重算，而不是手写汇总；
6. Task 9 是否拥有与静态 Mock 分离的 source admission、授权、credential 和正式 evidence 边界。

## 3. 冻结身份与数据集

| 项目                   | 冻结值                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| Lineage                | `phase-6.9.8-retriever-final-response-v1`                          |
| Manifest SHA-256       | `3734b6987ebf81a2786711ad05591b06673c470a83a7dbdfeb81390de77331d8` |
| Policy SHA-256         | `e7f19f34f2b8dc642eed1ecfea1189314d5ed7cf00974e7e5c4a42b099817464` |
| Mock factory SHA-256   | `d9fa0ddcecf910ce120fb711a8cde045e4f324ab201ab1e922167843ce7edc51` |
| Report SHA-256         | `02294586ea4a4d95290872910dc938d334c6047dda7194d348d3595274c551be` |
| Task 3 manifest anchor | `8a1788aa8973507555931ce358c08dcd739dd166636376f6ddcc2eff3a33654d` |
| Task 3 report anchor   | `a1478f22a4a2fad154496c4ffbfd761532c102fe3ae9453d1916a10ba2c26442` |

数据集精确包含：

- 16 个 guard：anonymous、相关性漂移、跨 owner port、安全/credential 输入、abort、deadline、gate/config/budget；
- 16 个 rewrite runtime：多轮指代、省略、实体/公式/数字/约束与 critical target；
- 16 个 FinalResponse runtime：no-RAG、trusted、suspicious、conflict、insufficient、Verifier unavailable 与 citation/
  critical notice 边界。

Task 3 的 `Recall@5=1 / nDCG@5=0.813219437888` 是其 original-query 固定数据集基线；Task 8 的
`0.875 / 0.56923614767` 来自新的 16 个 rewrite 专项 pair。两者由独立 manifest/SHA 绑定，不能混为同一分母，
也不能拼接成 Live 质量结论。

## 4. 实际执行链路

### Guard

每个 guard 通过正式 Retriever/candidate eligibility 与 exact execution-context authority；fake search port、rewrite
runtime、FinalResponse runtime 均必须保持零调用。失败原因必须与冻结 expected reason 一致。

### Query rewrite

```text
original request -> production Retriever node -> fixed fake ranked search
same case + actual bounded prompt -> prompt-only Mock runtime -> production query rewrite candidate
-> local validator/merger -> production Retriever node -> fixed fake ranked search
-> post-run scorer
```

Mock runtime 只接收 candidate 真实生成的 bounded user prompt；实现文件不导入 manifest，不按 case id 分支，也不
读取 expected/oracle。模型无权修改 owner、`topK/minScore`、source/status filter 或 search port。

### FinalResponse

```text
production Retriever result -> local evidence projector -> strict FinalResponse request
-> actual bounded stream prompt -> prompt-only Mock executor -> production FinalResponse node/ledger
-> local citation events + single terminal -> post-run scorer
```

Expected 只在运行后评估 grounding、notice 和 citation；真实 document/chunk/owner、credential、prompt 与回答正文不
进入报告。报告只保留固定枚举、计数、usage、费用估算与 SHA-256 audit。

## 5. 质量门结果

| 维度                                      | 结果                    |
| ----------------------------------------- | ----------------------- |
| Guard pass / zero-call                    | `16/16 / 16/16`         |
| Rewrite strict / usage / runtime          | `16/16 / 16/16 / 16`    |
| Original Recall@5 / nDCG@5                | `0.875 / 0.56923614767` |
| Candidate Recall@5 / nDCG@5               | `1 / 1`                 |
| Candidate nDCG@5 uplift                   | `0.43076385233`         |
| Critical target recall / intent preserved | `1 / 1`                 |
| Unsafe rewrite                            | `0`                     |
| Final strict / terminal / usage           | `16/16 / 16/16 / 16/16` |
| Grounded rubric                           | `1`                     |
| Citation precision / required recall      | `1 / 1`                 |
| Critical notice recall                    | `1`                     |
| False tool success / false citation       | `0 / 0`                 |
| Critical safety failures                  | `0`                     |
| Synthetic DeepSeek estimate               | `0.027366 CNY`          |
| P95 authority                             | `null`                  |
| Qwen / aggregate verified cost            | `null / null`           |

`0.027366 CNY` 只按 reviewed Mock 的 synthetic usage 和冻结 DeepSeek 价格 profile 计算，不是供应商账单，也不是
verified cost。没有真实 Qwen embedding，因此 Qwen 与 aggregate verified cost 必须保持 `null`；Mock 无权形成 P95。

## 6. 权限、安全与持久化边界

- execution 固定 `providerCalls=0 / credentialReads=0 / qwenEmbeddingCalls=0`；
- responder 与 report 均不保存 prompt、回答、owner、chunk、credential、URL 或 raw error；
- report canonical bytes 必须与冻结 SHA 完全一致；mutation、非 UTF-8、manifest/policy/factory/report 漂移均拒绝；
- single-run capability 在执行前消费，同一 capability 的第二次调用拒绝；没有 retry/replay；
- source admission 不信任调用方提交的 bundle SHA：validator 先确认传入目录就是 Git top-level，再核对当前 branch、
  `HEAD`、upstream、`refs/remotes/origin/...`、clean worktree，并从 exact commit 的固定 source-path blobs 独立重算
  canonical bundle SHA；任意伪造 SHA、ref 漂移、dirty tree 或缺失 blob 均拒绝。仓库 `.gitignore` 只固定排除本地
  `.codex/` 状态目录，避免它让 Task 9 admission 永久不可达；其它 untracked 与所有 tracked 漂移仍会拒绝。Task 8
  静态运行本身仍记录
  `sourceAdmissionExecuted=false`，不能冒充 Task 9 正式 admission；
- 正式 Live `marker/journal/evidence/recovery claim=0/0/0/0`；未创建 approved tag；
- 同步评测不创建 BackgroundJob/Outbox，不修改 PostgreSQL、Redis、MinIO 或业务数据；
- `.codex/` 保持本地未跟踪、被 `.gitignore` 排除且不进入提交。

## 7. 主要实现文件

| 职责                  | 文件                                                                              |
| --------------------- | --------------------------------------------------------------------------------- |
| 固定 manifest/policy  | `packages/agent/src/evals/phase-6-9-8-retriever-final-response-manifest.ts`       |
| Prompt-only responder | `packages/agent/src/evals/phase-6-9-8-retriever-final-response-mock-responder.ts` |
| Runner/report/gate    | `packages/agent/src/evals/phase-6-9-8-retriever-final-response-static.ts`         |
| CLI                   | `packages/agent/scripts/run-phase-6-9-8-retriever-final-response-static.ts`       |
| 验收测试              | `packages/agent/tests/phase-6-9-8-retriever-final-response-task8.test.ts`         |

## 8. 验证证据

已通过：

| 验证                                                   | 结果        |
| ------------------------------------------------------ | ----------- |
| Task 8 focused                                         | `8/8`       |
| Agent Retriever/rewrite/evidence/FinalResponse focused | `47/47`     |
| Web composition/stream/config/default-off focused      | `24/24`     |
| Agent full                                             | `1252/1252` |
| `@repo/agent` typecheck                                | exit `0`    |
| `@repo/agent` lint                                     | exit `0`    |
| Task 8 CLI / frozen report SHA                         | exit `0`    |
| Task 8 source Prettier / repository diff               | exit `0`    |
| Compose tracked safe-default static check              | exit `0`    |

核心命令：

```bash
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-task8.test.ts
bun --filter @repo/agent test
bun --filter @repo/agent typecheck
bun --filter @repo/agent lint
bun --filter @repo/agent eval:phase-6-9-8:static
```

## 9. 明确未完成

- Task 9 fresh admission 下的唯一 controlled-Live paired gate；
- 真实 DeepSeek rewrite/FinalResponse 与真实 Qwen paired retrieval 指标、verified usage/CNY 与 16-sample P95；
- Task 10 分支 Docker/API/可见浏览器/Trace/权限/精确清理；
- Task 11 文档终审、main `--no-ff` 合并、main default-off 回放与远程 main SHA 对齐；
- Phase 6.9.9/6.9.10/6.10/8/9 与两篇面试学习博客收尾。

## 10. 回顾时可以问

- 为什么 Task 8 的 original-query 指标和 Task 3 baseline 不同，却不是回归？
- 为什么 prompt-only Mock responder 不能导入 manifest、expected 或按 case id 分支？
- 为什么 actual 必须先穿过 production candidate/node/ledger，expected 才能进入后置 scorer？
- 为什么 synthetic CNY 可以做预算回归，却不能写成 verified cost？
- 为什么 16 个 runtime case 不生成 P95 authority？
- 为什么 source admission validator 已实现，Task 8 报告仍必须写 `sourceAdmissionExecuted=false`？
- 为什么 Task 8 gate passed 仍是 `qualityAuthority=none`，并必须停在 Task 9 fresh authorization 门前？
