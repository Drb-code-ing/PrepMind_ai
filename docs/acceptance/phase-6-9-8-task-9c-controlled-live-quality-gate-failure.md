# Phase 6.9.8 Task 9C controlled-Live 质量门失败验收

## 1. 结论

Phase 6.9.8 Task 9C 的唯一 controlled-Live 名额已经消费，并由正常 runtime 路径完成 durable seal。正式终态为：

- runId：`28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2`；
- gate：`task9_quality_gate_failed / passed=false`；
- authority：`controlled_live / qualityAuthority=none`；
- validator：`ok=true`；
- journal：`134` 条，最终事件 `evidence_published`；
- recovery claim：`null`。

本次结果不是“评测通过”。它只证明唯一 Task 9C 评测按冻结的 source、分母、breaker、双 Provider accounting 与
durability 合同执行，并在第二个 rewrite pair 的 DeepSeek rewrite strict schema/contract 边界失败后安全停止。它不
证明 Retriever/FinalResponse 真实语义质量、P95/SLA、产品 Docker/API/浏览器、Trace、业务写入、main 或 Phase
6.9.8 已完成。

Task 9C 不得 retry、resume、replay、backfill、补跑、重新 seal/recovery，不能删除或改写 marker/journal/artifact，
也不能用 curl、单 case、产品 API 或其它追加 Provider 探测补证。Task 10 与产品/main/后续阶段继续阻断。

## 2. Admission 与一次性授权

运行前完成并核对：

- branch：`drb/phase-6-9-8-retriever-final-response-contract`；
- `HEAD == upstream == origin branch == approved source tag commit`：
  `66a009ddb40b14d5117cfc0ec785a0d328708c5b`；
- approved tag：`phase-6-9-8-retriever-final-response-task9b-approved`，已推送远程；
- source bundle SHA：`2c1b2bb35849b1ac438359edb095cfbc230f413b58bd34eda2025d3d08e23cf8`；
- working tree clean，admission 时正式 Task 9C files=`0`；
- zero-provider proxy preflight：`loopback_proxy_ready / configured=4 / listenerProbeCalls=1 /
providerCalls=0`；
- 无关 Agent/Chat Live gate 保持关闭；
- fresh DeepSeek + Qwen 数据边界接受与 exact one-shot authorization 均与冻结常量逐字匹配；
- production CLI 按 rewrite DeepSeek、FinalResponse DeepSeek、Qwen 的顺序读取 3 项受限 runtime credential；不输出
  credential、endpoint、prompt、回答或 raw error。

Marker 创建时间为 `2026-08-05T14:45:02.888Z`，artifact 发布于
`2026-08-05T14:45:08.185Z`。本次执行没有开启产品 gate、Docker、API 或浏览器。

## 3. 固定分母与实际执行

正式分母保持 `16 guards + 16 rewrite pairs + 16 FinalResponse = 48 cases / 64 Provider calls`，没有因失败缩小：

| 项目                               | 固定分母 |                                                  实际终态 |
| ---------------------------------- | -------: | --------------------------------------------------------: |
| Guard                              |       16 |                           `16/16` pass，`16/16` zero-call |
| Provider calls                     |       64 | `4 succeeded / 1 failed / 59 not_started_quality_breaker` |
| Rewrite strict                     |       16 |                                                    `1/16` |
| FinalResponse strict               |       16 |                                                    `0/16` |
| External Provider calls            |       64 |                                                       `5` |
| Retry / replay / resume / backfill |        0 |                                           `0 / 0 / 0 / 0` |
| BackgroundJob / Outbox             |        0 |                                                   `0 / 0` |

Provider wire accounting：

| Provider | expected | attempts | dispatches | responses | verified usage |
| -------- | -------: | -------: | ---------: | --------: | -------------: |
| DeepSeek |       32 |        2 |          2 |         1 |              1 |
| Qwen     |       32 |        3 |          3 |         3 |              3 |

成功的四条 call entry 为：

1. `rewrite_01.rewrite_original_retrieval`：Qwen `1/1/1/1`，`123/0 token`，
   `0.0000615 CNY`；
2. `rewrite_01.rewrite_candidate_model`：DeepSeek `1/1/1/1`，`178/23 token`，
   `0.000672 CNY`；
3. `rewrite_01.rewrite_candidate_retrieval`：Qwen `1/1/1/1`，`137/0 token`，
   `0.0000685 CNY`；
4. `rewrite_02.rewrite_original_retrieval`：Qwen `1/1/1/1`，`108/0 token`，
   `0.000054 CNY`。

这些只是已成功 entry 的 verified usage/cost，不是 run aggregate。失败的已 dispatch DeepSeek call 没有 verified
usage，因此 DeepSeek/Qwen token/CNY 和总费用 aggregate 均按合同保持 `null`，不能把未知费用写成 0，也不能把
四条成功 entry 的费用相加冒充本次账单。

## 4. 唯一失败边界

第一个 pair `rewrite_01` 完整成功。第二个 pair 在 original Qwen retrieval 成功后，DeepSeek
`rewrite_02.rewrite_candidate_model` 形成：

```text
sequence 39  call_reserved
sequence 40  wire_stage / stage=dispatch_started
sequence 41  call_terminal
             disposition=failed
             failureReason=schema_invalid
             wire=1/1/0/0
             durationMs=895.038
sequence 43  rewrite_terminal / strict=false
```

随后 breaker 把剩余 59 次调用收为 `not_started_quality_breaker`：15 次 candidate Qwen、14 次 original Qwen、
14 次 DeepSeek rewrite 与 16 次 DeepSeek FinalResponse。没有 sibling 并发、后台补偿或重放。

`schema_invalid` 在当前 Task 9 Live harness 中是一个本地 strict schema/contract 总括边界：它可能来自 candidate
未达到 `candidate_applied`、provenance/Trace/model/usage/wire invariant 不匹配，或 runner 对返回结果的 strict
schema/phase 校验失败。Sealed evidence 不保存 Provider 原文，也没有足够的 bounded stage diagnostic 区分这些
分支。因此当前只能确认“dispatch 后未满足本地 strict rewrite contract”，不能进一步声称具体 JSON 字段、模型
回答内容或 API schema 根因。

同样不能把该终态归因于 DNS、TLS、proxy、账号、余额、模型权限、服务端、transport 或产品语义。Qwen 三次调用
均完整核验，DeepSeek 第一条 rewrite 也完整核验；这仍不足以把第二条失败归因到某个外部系统。

## 5. Gate 与不可用 aggregate

最终 gate failure reasons 为：

- `rewrite_strict`、`final_response_strict`；
- `rewrite_recall`、`rewrite_ndcg`、`rewrite_uplift`、`rewrite_critical_recall`、`rewrite_intent`；
- `final_grounding`、`citation_precision`、`citation_recall`、`critical_notice`；
- `rewrite_p95`、`retrieval_p95`、`final_ttft_p95`、`final_total_p95`、`chat_end_to_end_p95`；
- `deepseek_accounting`、`qwen_accounting`、`aggregate_cost`、`live_provider_calls`。

正式 rewrite Recall/nDCG/uplift/intent、FinalResponse grounded/citation/notice、五项 P95 与 Provider aggregate
token/CNY 全为 `null`。Safety failure 计数当前为 0，但只覆盖已运行前缀，不能提升为完整安全质量 authority。

## 6. Durability 与 validator

本次由正常 runtime publication 收口，不是 crash recovery：

- marker SHA：`32d904f1bd9f440762ed2f642ea02058c8917cc8e500082d35606a2c8c5bc064`；
- terminal sequence/hash：`132 / 6d8dabe80297bc4c8ea23d79a74d48b979b89a195e3bcdffb3195d5dbc4f4e1a`；
- sequence `133`：`publication_started`；
- sequence `134`：`evidence_published`；
- report logical SHA：`c612d6f7164d5491e54422abb2e8504cbb707aeea3b641e8c57285d957b8b4a4`；
- physical artifact SHA：`7d45329debde6def4c5bc8bbda28609b507a71766ae06e00806e44eaf7b3614c`；
- recovery claim SHA：`null`；
- strict validator：`ok=true / journalRecords=134 / finalJournalEvent=evidence_published`。

正式文件集合固定为 1 个 marker、1 个 journal、1 个 artifact、0 个 recovery claim。Artifact 已发布，因此
crash-only seal 的合法结果只能是拒绝 `already_published`；不得再执行 seal 命令。

只读复核命令：

```powershell
bun --filter @repo/agent eval:phase-6-9-8:task9:validate
```

该命令只重放和重算已封存 bundle，不读取 credential、不调用 Provider。

## 7. 影响与下一步边界

- Task 9C 的执行与证据工程合同成立，但质量门失败；
- Task 10 Docker/API/可见浏览器/Trace/权限/精确清理不得开始；
- Task 11 main/default-off 回放与远程 main 合并不得开始；
- Phase 6.9.8 未完成，Phase 6.9.9/6.9.10/6.10、Phase 8/9 与两篇博客收尾继续阻断；
- approved source tag、marker、journal 与 artifact 保持不可变。

若继续修复，下一原子任务必须是独立 zero-provider Architecture Recovery 设计，而不是 Task 9C retry。建议为 rewrite
lane 增加不保存 raw 的 bounded stage/reason diagnostic，并用 deterministic Provider-envelope、schema、usage、Trace、
local-authority、runner-result fixtures 覆盖所有 strict 分支；新 lineage、runner/durability/admission 与 reviewed Mock
通过后，是否允许新的 controlled-Live 必须再由用户单独决策和授权。

回顾时可以问：

- 为什么 Task 9C 已执行完，Phase 6.9.8 仍不能标记完成？
- 为什么 `schema_invalid + wire 1/1/0/0` 不能直接写成 Provider 返回了错误 JSON？
- 为什么 4 条成功 entry 的费用不能作为本次 run 总费用？
- 为什么 breaker 后必须保留 59 个 not-started terminal，而不能缩小分母？
- 为什么正常 `evidence_published` 后禁止再运行 crash-only seal？
- 为什么下一步应先补 bounded diagnostic，而不是再发一个单 case 请求？
