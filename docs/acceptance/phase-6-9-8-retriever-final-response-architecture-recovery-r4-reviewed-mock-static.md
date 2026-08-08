# Phase 6.9.8 Architecture Recovery R4：Reviewed Mock / Static 验收

> 日期：2026-08-06
>
> 分支：`drb/phase-6-9-8-retriever-final-response-contract`
>
> 当前阶段：R4 zero-provider reviewed Mock/static（历史 checkpoint）
>
> 后续结果：唯一 R5 controlled-Live 已失败封存；本文件不构成 R5 或产品 authority

## 1. 结论

R4 已完成。新的 R4 factory 先运行 Task 8 的真实生产节点/ledger reviewed Mock 路径，再把有界结果送入 R3
runner；没有读取 credential、没有访问网络、没有调用 DeepSeek/Qwen、没有创建 marker/journal/artifact 或业务写入。

R4 形成的唯一 authority 是：

```text
gate=architecture_recovery_mock_quality_not_evidence
qualityAuthority=none
```

这证明本地 contract、节点、双 wire、bounded diagnostic、runner 调度和质量 scorer 在固定 Mock fixture 上自洽，
不证明 Provider 语义质量、真实模型可用性、P95/SLA、产品 Docker/API/浏览器或 main 可用性。

## 2. 固定输入与 lineage

| 项目                    | 值                                                                 |
| ----------------------- | ------------------------------------------------------------------ |
| Recovery lineage        | `phase-6.9.8-retriever-final-response-architecture-recovery-v1`    |
| R4 run id               | `00000000-0000-4000-8000-000000000004`                             |
| manifest                | `3734b6987ebf81a2786711ad05591b06673c470a83a7dbdfeb81390de77331d8` |
| Task 8 policy           | `e7f19f34f2b8dc642eed1ecfea1189314d5ed7cf00974e7e5c4a42b099817464` |
| R4 factory SHA          | `c430cbee18c0208b4b31410599860545c261702c790716cdeaf1367c78ecc03e` |
| R4 report SHA           | `a8119f51b44d4b9a331e56fb80579a9c075ddb78c71f8b079591645e860f2843` |
| sealed Task 9C report   | `c612d6f7164d5491e54422abb2e8504cbb707aeea3b641e8c57285d957b8b4a4` |
| sealed Task 9C artifact | `7d45329debde6def4c5bc8bbda28609b507a71766ae06e00806e44eaf7b3614c` |

Task 9C namespace 仍只读；R4 不重跑、恢复、seal、replay 或改写它。

## 3. 运行路径

```text
Task 8 prompt-only reviewed Mock
  -> RetrieverQueryRewrite / Retriever node / search-port projection
  -> FinalResponse node / server-ledger / citation authority
  -> R4 bounded outcome projection
  -> R3 source-admitted scheduler (synthetic admission)
  -> runnerWire + providerWire + diagnostic transcript
  -> local report/scorer
```

Responder 只接受实际 bounded prompt；expected、oracle、评分中间值和 case-answer table 只允许出现在后置 scorer，
不能影响 candidate、retrieval 或 stream 结果。R4 report 只保留固定枚举、计数、safe reference/hash 和聚合值，
不保存 prompt、query、answer、chunk、citation text、URL、credential、raw error 或 unknown key。

## 4. 固定分母与结果

| 门                                           | 结果                                                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Guard                                        | `16/16` pass，`16/16` zero-call                                                                    |
| Rewrite pairs                                | `16/16` strict                                                                                     |
| FinalResponse                                | `16/16` strict，terminal `16/16`                                                                   |
| Provider call slots                          | `64/64`                                                                                            |
| DeepSeek lanes                               | `32/32` runner/provider/response/usage                                                             |
| Qwen lanes                                   | `32/32` runner/provider/response/usage                                                             |
| Bounded diagnostic                           | terminal `64`，`applied 64`，failed `0`，not-started `0`                                           |
| Candidate Recall@5                           | `1`                                                                                                |
| Candidate nDCG@5                             | `1`                                                                                                |
| Candidate uplift                             | `0.43076385233`                                                                                    |
| Critical target recall                       | `1`                                                                                                |
| Intent preservation                          | `1`                                                                                                |
| Grounding / citation precision / recall      | `1 / 1 / 1`                                                                                        |
| Critical notice recall                       | `1`                                                                                                |
| Unsafe rewrite / false tool / false citation | `0 / 0 / 0`                                                                                        |
| P95                                          | rewrite `0ms`，retrieval `0ms`，FinalResponse TTFT/total/end-to-end `20/50/80ms`（synthetic only） |

R4 的 synthetic accounting 为 DeepSeek `8704/225`、Qwen `4096/0`。synthetic cost `0.02951 CNY` 是用
Task 9A 冻结的本地单价快照对这两组 synthetic token 计数做预算回归（不是网络返回值，也不是账单读取）。
由于没有任何 Provider response/verified usage，`aggregateVerifiedProviderCostCny` 必须保持 `null`；这些数字不是
Provider 账单或生产成本 authority。

## 5. 安全与副作用边界

- `providerCalls=0`、`credentialReads=0`、external Provider/Qwen calls=0；
- `retry/replay/resume/backfill=false`；不创建 `BackgroundJob`、`Outbox`、数据库写入或业务文件；
- R3 runner 仍保留 guard-first、pair serial、reservation-before-dispatch、single-use capability、breaker 与
  incomplete aggregate null 语义；
- 三个 call-family 的 observation 继续由模块私有 WeakMap 签发，forged/reused/cross-call/cross-family/out-of-order
  仍 fail-closed；
- formal `approvedTag/marker/journal/artifact/recoveryClaim=0`；
- legacy Task 9C report/artifact SHA 只读 parity 保持不变。

## 6. 验收命令与证据

```powershell
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock.test.ts
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-r3-runner.test.ts packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-r3-durability.test.ts packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-r3-lineage-cli.test.ts packages/agent/tests/phase-6-9-8-retriever-final-response-task8.test.ts
bun --cwd=packages/agent run eval:phase-6-9-8:architecture-recovery:r4:mock
bunx prettier --check packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock.ts packages/agent/scripts/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock.ts packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock.test.ts
git diff --check
```

本轮 focused + R3 parity + Task 8 回归为 `29/29` tests pass、`200` assertions；R4 focused 为 `5/5`、`32`
assertions；Agent 全量回归为 `1323` tests / `165` files / `23579` expect() calls / `0` fail。独立 Reader Testing
能从本文件和 R3 设计准确回答 8 个边界问题，未发现坏链接；复审唯一补强是
明确 synthetic cost 的预算回归来源。正式 R3 CLI 未运行；R4 script 只接受 `mock`，任何 Live/seal/validate 参数都会
fail-closed。

## 7. Reader Testing：回顾时可以这样问

1. R4 为什么能报告 `64/64 applied`，却仍然不能说真实模型可用？
2. `runnerWire` 和 `providerWire` 在 R4 分别证明什么？
3. 为什么 synthetic cost 有数值，而 `aggregateVerifiedProviderCostCny` 必须是 `null`？
4. Task 8 的 prompt-only responder 如何避免读取 expected/oracle？
5. R4 为什么沿用 R3 runner，而不是直接复用 Task 8 的 48-case report？
6. 16 guards 为什么必须 zero-call，且必须先于任何 Provider slot？
7. R4 产生了哪些正式文件？为什么 `marker/journal/artifact` 都是 0？
8. R4 通过后为什么仍不能执行 R5、Docker/API/浏览器或合并 main？

Reader Testing 预期答案：R4 是固定 Mock 的本地结构/语义 checkpoint；只有新的 R5 controlled-Live 在 fresh
admission、proxy、数据边界和一次性授权全部通过后，才可能形成 branch semantic authority；R5 pass 也不自动等于
产品或 main authority。

## 8. 后续边界

R4 完成、提交、推送和独立复审后，当时的下一步才是用户单独决定是否进入 R5；该历史条件后来已履行，唯一 R5
controlled-Live 已以 `architecture_recovery_quality_gate_failed / qualityAuthority=none` 封存。R5 必须重新完成
clean tree、approved source parity、formal evidence=0、fresh proxy preflight、DeepSeek+Qwen 数据边界接受、精确
一次性授权和三项 credential late-binding；R5 失败后不得重跑，Docker/API/browser、Trace 产品验收、main 合并或
后续 Phase 仍未解锁。
