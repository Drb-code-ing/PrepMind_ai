# Phase 6.9.4.3 Router / Verifier Paired Eval（Mock 中间验收）

## 1. 定位与结论

本文件记录 Phase 6.9.4.3 的 **Fresh Mock 中间验收**。它已经完成固定数据集上的 deterministic / Mock 双 lane contract run，但 controlled-Live 尚未执行，因此 **Phase 6.9.4.3 尚未完成**。

本次 strict evidence 的结论是：

- run 为 `mock / complete`，deterministic 与 Mock lane 各覆盖 100 条 case，Live lane 为 `not_applicable`；
- deterministic baseline 保持 74/100，critical failure 为 2；
- Mock lane 的 100 条 case 全部经过 adapter，其中 28 条 eligible case 调用本地 Mock runtime 并全部 strict success，72 条 ineligible / safety case 保持 zero-call；
- provider attempt 与估算成本均为 0；input/output aggregate 为 0/0 且 `providerReported=false`，即没有 provider-reported usage；
- Router 与 Verifier 都维持 `enabled=false / paired_candidate_not_run`；
- `qualityEvidence=false`。Mock fixture 能证明工程 contract、eligibility、zero-call、安全 schema、计数与报告链路可执行，不能证明真实模型的语义质量、延迟或成本，也不能据此启用模型路径。

## 2. 执行环境与命令

| 项目 | 实际值 |
| --- | --- |
| 验收日期 | 2026-07-13 |
| 工作分支 | `codex/phase-6-9-4-3-mock-acceptance` |
| 实现基线 Git SHA | `5f89db65ef5fe76160dfa9c552804e59588053a1` |
| runner | `phase-6.9.4.3-runner-v1` |
| prompt version | `phase-6.9.4.2-candidate-v1` |
| profile / provider | `mock / mock` |
| model fixture | `phase-6-9-4-3-test-fixture-v1` |
| run status | `complete` |
| run duration | 35 ms |
| safe run id hash | `sha256:bade883031624c30ed2c63048382217c07df9910dcb97ac05446e47fd2477da5` |

实际执行命令与退出码：

| 命令 | 退出码 | 解释 |
| --- | ---: | --- |
| `bun run --cwd packages/agent eval:phase-6-9-4-3:accept-mock` | 1 | 按 Mock contract 预期退出；首次通过 no-overwrite writer 生成 evidence。complete 但两个 agent 仍 disabled，因此不是 exit 0。 |
| `bun run --cwd packages/agent eval:phase-6-9-4-3:validate -- --profile mock --file docs/acceptance/evidence/phase-6-9-4-3/mock.json` | 0 | strict schema、profile、digest、cardinality、counter、decision、usage provenance 与 canary 校验通过。 |

开始执行前两个目标文件均不存在；本次只运行了一次 evidence acceptance writer，没有覆盖或美化 CLI 生成的 JSON。证据见 [mock.json](./evidence/phase-6-9-4-3/mock.json)。

## 3. 固定数据集与可比性

| 字段 | 值 |
| --- | --- |
| dataset version | `phase-6.9-router-verifier-v1` |
| dataset digest | `sha256:b21def37330d2da109901ff9e927a612dc62cdecf1cb9383c3b8bea08c7bb019` |
| Router cases | 60 |
| Verifier cases | 40 |
| total cases | 100 |
| candidate eligible | 28 |
| zero-call | 72 |

digest 由 strict contract 固定并在 evidence validation 中重新校验。Mock 与后续 controlled-Live 必须复用同一批 28 条 eligible case，不能更换 expected、挑选有利样本或把多次 run 拼成一个报告。

100/28/72 的严格构成如下：

| 边界 | Router | Verifier | 合计 | Mock disposition |
| --- | ---: | ---: | ---: | --- |
| 全量数据集 | 60 | 40 | 100 | 全部形成 adapter observation |
| candidate eligible | ambiguous 16 | complex-conflict 8 + uncertain/stale 4 | 28 | `candidate_applied=28` |
| deterministic ineligible | high-confidence 36 | trusted 12 + insufficient 8 | 56 | `not_eligible=56` |
| safety blocked | safety-boundary 8 | prompt-injection 8 | 16 | `safety_blocked=16` |
| zero-call 合计 | 44 | 28 | 72 | `not_eligible 56 + safety_blocked 16` |

Router high-confidence case 已由本地 deterministic policy 给出高置信结果，不需要让模型重复判别，也不能为追求 candidate 分数扩大调用面；Verifier trusted / insufficient case 同理不属于本轮 semantic candidate 的授权范围。Router safety-boundary 与 Verifier prompt-injection case 则必须在 runtime 前阻断，避免模型扩大权限、越过数据最小化边界或释放不安全证据。因此这 72 条都保留本地 deterministic / safety 结果并保持零调用。

## 4. Deterministic baseline

deterministic lane 是同一份 100-case 数据集上的新鲜观测，结果仍为 **74/100，critical failure=2**。这里的总通过数按 case 的 expected/actual code 与 Router permission 一致性从 strict evidence 机械计算。

| Agent | 指标 | 实际值 |
| --- | --- | ---: |
| Router | overall accuracy | 75.00% |
| Router | ambiguous macro-F1 | 52.4675% |
| Router | high-confidence accuracy | 86.1111% |
| Router | permission-boundary pass rate | 80.00% |
| Router | critical failures | 2 |
| Verifier | overall accuracy | 72.50% |
| Verifier | complex-conflict recall | 0.00% |
| Verifier | conservative-fallback pass rate | 75.00% |
| Verifier | prompt-injection release count | 0 |
| Verifier | critical failures | 0 |

deterministic lane 不执行 candidate runtime，所以其 latency 字段为 `null`，不应被写成真实模型的 0 ms 延迟。

## 5. Mock candidate 结果

### 5.1 质量指标

| Agent | 指标 | Mock 实际值 |
| --- | --- | ---: |
| Router | overall accuracy | 91.6667% |
| Router | ambiguous macro-F1 | 100.00% |
| Router | high-confidence accuracy | 86.1111% |
| Router | permission-boundary pass rate | 93.3333% |
| Router | critical failures | 0 |
| Verifier | overall accuracy | 95.00% |
| Verifier | complex-conflict recall | 100.00% |
| Verifier | conservative-fallback pass rate | 100.00% |
| Verifier | prompt-injection release count | 0 |
| Verifier | critical failures | 0 |

Router overall accuracy 91.6667% 的分母是全部 60 条最终 adapter observation（55/60），Verifier overall accuracy 95.00% 的分母是全部 40 条最终 adapter observation（38/40）。其中 72 条 zero-call case 的本地 deterministic / safety 最终结果同样进入指标；这两个 overall 值不是 28 条 fixture 的“模型准确率”。

因此，这些值只是在全量 100-case adapter contract 上合并本地结果与固定 Mock fixture 后的观测。28 条 eligible case 的 Mock 输出由受控 fixture 固定，无法回答真实 provider 是否能稳定得到相同语义结果，也不构成 controlled-Live 质量证据。

### 5.2 Latency

| Agent | total p50 | total p95 | additional p50 | additional p95 |
| --- | ---: | ---: | ---: | ---: |
| Router | 0 ms | 2 ms | 0 ms | 2 ms |
| Verifier | 0 ms | 2 ms | 0 ms | 2 ms |

这是本地 Mock runtime 的进程内耗时，只验证 latency 字段、聚合和阈值输入链路；它不是 provider 网络延迟，也不能外推 controlled-Live p50/p95。

### 5.3 Coverage、counters、usage 与 cost

| 类别 | 字段 | 实际值 |
| --- | --- | ---: |
| coverage | observed / not run | 100 / 0 |
| coverage | runtime invocation / provider attempt | 28 / 0 |
| coverage | strict success / runtime failure | 28 / 0 |
| counters | case entries | 100 |
| counters | adapter executions | 100 |
| counters | runtime invocations | 28 |
| counters | provider attempts | 0 |
| counters | strict successes | 28 |
| counters | zero-call cases | 72 |
| aggregate usage | input / output tokens | 0 / 0 |
| aggregate usage | provider reported | `false` |
| cost | estimated cost | USD 0 |

`100 / 28 / 72` 的含义是：全部 100 条 case 都形成 adapter observation；只有标记为 candidate eligible 的 28 条进入本地 Mock runtime；其余 72 条在 eligibility 或 safety 边界内保持 zero-call。`providerAttempts=0` 进一步说明这 28 次 runtime invocation 没有跨过 provider boundary。Mock entry 内的工程输入估算不等于 provider usage；input/output aggregate 为 0/0 且 `providerReported=false`，即没有 provider-reported usage，不能把它包装成供应商 token 或账单证据。

## 6. Decision 与启用边界

| Agent | enabled | reason |
| --- | --- | --- |
| Router | `false` | `paired_candidate_not_run` |
| Verifier | `false` | `paired_candidate_not_run` |

这里的 `paired_candidate_not_run` 表示 **controlled-Live paired 质量证据尚未运行**，不表示 Mock runtime 没有运行；本次 evidence 已明确记录 `runtimeInvocations=28`，但这些调用全部是本地 Mock runtime，`providerAttempts=0`。

当前 production 行为继续使用 deterministic Router / Verifier。本次没有把 candidate 接入生产 Chat，也没有修改 enablement。Mock 指标即使优于 deterministic baseline，仍不能改变 decision，因为：

1. `qualityEvidence=false` 是本次 evidence 的显式事实；
2. Mock fixture 不具备真实模型的语义不确定性，无法证明同 case 的 Live 质量；
3. 本地 0/2 ms 延迟和 USD 0 成本不代表真实 provider 延迟、token 或成本；
4. paired gate 要求同一数据集上的 controlled-Live 质量、安全、延迟和成本证据，缺一不可。

因此，不能宣称 Router 或 Verifier 的模型路径已启用，也不能宣称 Phase 6.9.4.3 已完成。

## 7. 安全与隐私边界

对 CLI 原样生成的 evidence 执行了 strict JSON parse、contract parser 与两层隐私检查：

- exact forbidden key 扫描：`query`、`chunk`、`prompt`、`providerOutput`、`rawError`、`apiKey`、`authorization`、`cookie`，命中 0；
- credential-like value、bearer、`sk-` token 与 PEM private-key pattern 扫描，命中 0；
- query/chunk/prompt/provider output/raw error/provider/key/base URL/cookie/token/email/private-key canary 扫描，命中 0；
- evidence 中 `providerAttempts=0`，Live lane 为 `not_applicable`；
- evidence 只保留 case id、固定 code、布尔状态、计数、聚合指标、受控 provider/model identifier 与 hash 等 allowlist 字段，不复制 case 正文、完整 prompt、RAG chunk、provider output、raw error 或 credential。

这些检查是针对本次 strict evidence 与已知 forbidden pattern 的有界证据，不是通用 secret scanner 的无限保证。

## 8. 明确未执行事项与下一步

本次没有设置 Live 环境变量，没有读取或调用真实 provider，没有启动 Docker、浏览器或服务，没有创建账号、会话或业务数据，也没有访问数据库、Redis、MinIO。因而没有账号、数据库、容器或浏览器 storage 清理项。

下一步的唯一可执行导航是[实施计划 Task 5 的 Step 2–4](../superpowers/plans/2026-07-13-phase-6-9-4-3-router-verifier-paired-eval.md)：

1. Step 2 先做 0-call Live preflight rehearsal，必须证明配置失败时 `providerAttempts=0` 且不生成 Live evidence；
2. Step 3 由操作者确认本次 pricing snapshot、最大成本与临时凭据输入，禁止猜测价格、回显凭据或把它们写入仓库；
3. Step 4 再复用同一 dataset digest 与同一批 **28 条 eligible case**，执行 **单模型、单次、串行、无自动重试的 controlled-Live run**。

该 run 要保留所有已跨过 provider boundary 的 complete / incomplete / attempted-invalid 安全 evidence，再由 strict JSON 机械提取真实质量、p50/p95、provider-reported usage、pricing snapshot、估算成本和最终 decision。只有该证据完成后，才能判断 Phase 6.9.4.3 是否通过以及是否允许进入后续 enablement。本文不设置或执行 Live，不记录凭据，也不猜测价格。

## 9. 证据链

- [设计：Phase 6.9.4.3 Router / Verifier Paired Eval](../superpowers/specs/phase-6-9-4-3-router-verifier-paired-eval-design.md)
- [实施计划：2026-07-13 Phase 6.9.4.3](../superpowers/plans/2026-07-13-phase-6-9-4-3-router-verifier-paired-eval.md)
- [Fresh Mock strict evidence](./evidence/phase-6-9-4-3/mock.json)

## 10. 回顾时可以问

- 为什么总共有 100 条 case，但只有 28 次 runtime invocation，另外 72 条具体代表什么边界？
- `runtimeInvocations=28` 与 `providerAttempts=0` 为什么不矛盾？
- 为什么 Mock Router 91.6667%、Verifier 95.00% 仍然不能作为启用质量证据？
- 当前 Router / Verifier 的 decision 与 reason 分别是什么，production 行为是否改变？
- deterministic baseline 的 74/100、critical=2 与 Mock candidate 指标分别在证明什么？
- 本次明确没有执行哪些环境、账号、数据与真实模型操作？
- 下一步为什么必须复用同一 28 条 eligible case，并且只做单次、无自动重试的 controlled-Live run？
- controlled-Live 完成前，为什么不能宣称 Phase 6.9.4.3 已完成？
