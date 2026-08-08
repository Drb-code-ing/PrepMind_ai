# Phase 6.9.8 Retriever / FinalResponse P1 zero-provider semantic-gate 设计

> 日期：2026-08-08
> 状态：P1 设计已冻结；G1、G2、S2 reviewed Mock/static 与 L2 zero-provider admission contract 已在独立分支完成；
> L2 contract 仍没有真实模型或产品 authority
> 分支：`drb/phase-6-9-8-p1-semantic-gate-design`
> 基线：已合并并推送的 `main` merge `3fdb9908`
> Lineage：`phase-6.9.8-retriever-final-response-p1-v1`
> Authority：`zero_provider_retriever_final_response_p1_semantic_gate_design / qualityAuthority=none`

## 1. 决策摘要

Transport Re-entry V2 L1 的三槽真实调用已经全部返回并 durable seal，但它只证明
`rewrite -> qwen -> final_response` 的 transport、wire、verified usage 与证据持久化边界。它没有运行真实检索
语义、证据安全评分或最终回答质量，因此不能直接把 L1 推进到产品 `/api/chat`、Docker、浏览器或 `main`。

P1 先冻结一个足够小、可复算、可审计的语义门，随后按 `G1 contract/baseline -> G2 runner/durability -> S2
reviewed Mock ->（未来、另行授权的）L2 semantic canary` 逐步实现。P1 本身只写设计文档，不读取 `.env`、credential，
不构造 Provider adapter，不调用 DeepSeek/Qwen，不写正式 marker/journal/artifact、Trace、BackgroundJob、Outbox 或
业务数据。

> 后续状态（2026-08-08）：G1 已落成独立 manifest、subset deterministic baseline、candidate-only projection 与 strict
> scorer/gate；G2 又在从 `main` `a12db738` 派生的
> `drb/phase-6-9-8-g2-runner-durability` 上落成 one-shot runner、source admission、exclusive marker、hash-chain
> journal、hard-link publication、strict validator 与 crash-only recovery。G2 authority 为
> `zero_provider_retriever_final_response_p1_g2_runner_durability / qualityAuthority=none`，focused `5/5`、Agent full
> `1419/1419`、provider/credential/formal evidence `0`。随后 S2 在独立普通分支完成，固定 `8/8` guard、`16/16`
> strict/wire/synthetic usage、semantic `1/1/1`、candidate invocation `12`、synthetic Qwen port calls `17`，gate=
> `p1_mock_quality_not_evidence / qualityAuthority=none`；S2 focused `4/4`、G1+G2 `10/10`、Agent full `1423/1423`。
> 详见 `docs/acceptance/phase-6-9-8-retriever-final-response-p1-s2-reviewed-mock-static.md`。本设计文档的历史冻结输入
> 不被改写，当前只允许在 main 二次回归后重新接受数据边界并另立 L2 authorization。

## 2. 目标与非目标

### 2.1 目标

- 固定一组能覆盖认证、安全、路由、检索改写、证据引用和工具声明边界的最小语义样本；
- 让 deterministic original-query baseline、真实 Retriever node、query-rewrite candidate、evidence projector 和
  FinalResponse node 使用同一 execution context，后置 scorer 才读取 expected；
- 把模型权限限制在“建议 query/回答正文”，由本地 authority 保留 owner、检索 policy、证据 allowlist、citation、
  tool status、usage 和 terminal；
- 定义 strict、wire、usage、semantic、安全、预算和分母完整性门，任何缺失都 fail-closed；
- 预先规定串行调度、丢失任务、abort、stale、跨 owner、路由漂移和 durable publication 的生产边界，避免把重试当
  成质量证据。

### 2.2 非目标

- 不修改 L1/T3/R5/Task 9C 的 sealed bytes、marker、journal、artifact、tag、SHA 或 authority；
- 不在 P1/G1/G2/S2 读取真实凭据、访问 Provider、启动 Docker/API/browser 或接入产品写路径；
- 不用 Mock 满分、旧 Chat Live、L1 transport success 或 Task 9C 失败前缀宣称 Retriever/FinalResponse 质量通过；
- 不在六个样本上生成 P95、SLA、长期 Provider health 或生产成本 authority；
- 不引入 BackgroundJob/Outbox。未来若把生成变为异步任务，必须另立任务合同、幂等键和 Outbox 原子投递。

## 3. 独立身份、来源锚点与不可复用边界

### 3.1 P1 identity

```text
lineage:       phase-6.9.8-retriever-final-response-p1-v1
manifestSha:   e7216d072eb20e47eaea469646b4c831c180bd9248fdaae059a335a22404fab2
policySha:     ab6a453a60fad5bf7678d4f04b9f1e1c30a5ab5642580b0ea5615f4edd20d146
baselineAnchor:63748b92cfa5da4ba60c8c457c7d97e8f079a0add130adbc7698a70ccc2f503b
authority:     zero_provider_retriever_final_response_p1_semantic_gate_design
quality:       none
```

上述 SHA 是 P1 设计预先冻结的输入身份；G1 实现时必须从源码重新生成并拒绝漂移，不能由 CLI 参数覆盖。

### 3.2 来源锚点

P1 只读复用已封存的输入，不把它们的 authority 合并进 P1：

| 来源                                 | 只读身份                                                           | 用途                               |
| ------------------------------------ | ------------------------------------------------------------------ | ---------------------------------- |
| Task 8 manifest                      | `3734b6987ebf81a2786711ad05591b06673c470a83a7dbdfeb81390de77331d8` | 48-case 原始 corpus 的结构锚点     |
| Retriever original baseline manifest | `8a1788aa8973507555931ce358c08dcd739dd166636376f6ddcc2eff3a33654d` | deterministic 检索 policy/候选顺序 |
| Retriever baseline report            | `a1478f22a4a2fad154496c4ffbfd761532c102fe3ae9453d1916a10ba2c26442` | 原始 baseline 的不可变比较锚点     |
| P1 source                            | `3fdb9908`                                                         | 从最新 `main` 派生的文档基线       |

P1 reader/validator 必须双向拒绝 Task 8 全量 report、Task 9C、R5、V2 L1 及其他 Agent lineage 的 marker、
approved tag、credential confirmation 和 artifact。只允许复用纯数据结构、deterministic evaluator 和安全 parser。

## 4. 固定评测面与样本选择

P1 固定 `8 guard + 6 rewrite + 6 FinalResponse = 20` 个 entry；其中语义 lane 为 12 条，guard 不进入语义分母。
样本 ID、顺序和 selection tag 进入 manifest；expected、oracle、答案正文和 Provider projection 不进入 manifest。

### 4.1 零调用 guard（8 条）

| case       | 覆盖边界                           |
| ---------- | ---------------------------------- |
| `guard_02` | anonymous owner 禁止进入 RAG/模型  |
| `guard_03` | 原始 query 注入/不安全输入         |
| `guard_04` | 原始 query 中 credential material  |
| `guard_09` | 进入 runtime 前已 abort            |
| `guard_10` | deadline 已过期                    |
| `guard_11` | `topK` policy 漂移                 |
| `guard_15` | correlation/principal binding 漂移 |
| `guard_16` | cross-owner port 注入              |

每条 guard 必须 `providerCalls=0`、`credentialReads=0`、fake search calls=0，并返回固定 reason；任何 guard dispatch
都属于 critical failure。

### 4.2 Rewrite lane（6 条）

固定选择 `rewrite_01, rewrite_03, rewrite_05, rewrite_09, rewrite_12, rewrite_15`，覆盖中文/英文、recent turn、
active question、critical query、不同 baseline rank 和 expected no-hit。每条 lane 依次执行：

1. 用 fixed fake search port 得到 original-query baseline；
2. 在 eligibility、safety、budget、deadline、abort 和 gate 检查通过后，至多一次 query-rewrite candidate；
3. 由本地 validator 保证 rewritten query 的 required terms、长度和安全模式；
4. 再用同一 owner-scoped port 取得 candidate retrieval，并由本地 merger 选择 original 或 candidate。

模型只可返回严格 `{ rewrittenQuery }` projection；不得返回 owner、chunk/document ID、topK、filter、score、citation
或 route。

### 4.3 FinalResponse lane（6 条）

固定选择 `final_01, final_07, final_09, final_11, final_13, final_15`，覆盖 trusted、suspicious、conflict、
insufficient、无 RAG 与 tool-intent（保存）场景。每条 lane 先由本地 projector 生成 allowlist，再至多一次
FinalResponse candidate；模型只能生成正文和不确定性表达，citation event、tool execution status、terminal 和 usage
由本地 runtime/ledger 生成。

`ragIncluded=false` 时 bundle、allowlist、citation ledger 和 Markdown citation 整层清零；模型不能通过正文重新打开
RAG、执行工具或声明保存成功。

## 5. 通信图与边界

```mermaid
flowchart LR
  G[Guard gate\n8 zero-call cases] --> R0[Retriever original baseline]
  R0 --> E{Rewrite eligible?}
  E -- no --> P[Local evidence projector]
  E -- yes --> RW[Rewrite candidate\n{rewrittenQuery}]
  RW --> R1[Candidate retrieval\nowner-scoped port]
  R1 --> P
  P --> F[FinalResponse candidate]
  F --> L[Local citation / terminal / usage ledger]
  L --> S[Strict scorer + merger]
```

跨模块通信只使用现有 `AgentExecutionContextV1`、`RetrieverRequest/Result`、`VerifiedEvidenceBundleV1`、
`FinalResponseRequestV1` 和 stream event contract。DTO 不携带 bearer、cookie、数据库对象、raw prompt、完整回答或
可变 owner；AbortSignal 只作为进程内控制引用，不序列化。

| 组件                              | 可以读取/产生                                     | 明确禁止                                      |
| --------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| P1 manifest/baseline              | 固定 case、policy、deterministic facts            | expected/oracle、credential、网络             |
| Guard/Router composition          | canonical principal、route、requiresRag、deadline | 模型自行开 RAG、改 owner、扩大 policy         |
| Retriever + fake/first-party port | owner-scoped query、ranked candidate refs         | 真实 ID 越权、伪造 score、写库                |
| Query-rewrite candidate           | bounded prompt，严格 `rewrittenQuery`             | owner、ID、filter、citation、tool/action      |
| Evidence projector/Verifier       | 安全后的证据摘要、trust、citation allowlist       | 放行 blocked body、跨 owner、raw model output |
| FinalResponse candidate           | 投影后的正文上下文                                | 创建 citation/tool success/权限结论           |
| Local ledger/scorer               | strict/wire/usage/semantic aggregate              | 接受自报 aggregate、修补缺失 lane             |
| Runner/publication                | reservation、terminal、report、validator          | retry、resume、replay、业务写入、旧 lineage   |

## 6. 质量门与计算规则

### 6.1 工程完整性门

- guard `8/8` 通过且 `zero-call=8/8`；
- rewrite strict、runtime、wire、verified usage 均 `6/6`；
- FinalResponse strict、terminal、wire、verified usage 均 `6/6`；
- 每个 lane 恰好一个 terminal，最后一个 event 必须是该 terminal；unknown/missing/duplicate/跨 lane key 一律失败；
- 所有 actual 必须来自真实 node/adapter seam；responder 只看实际 bounded prompt，不导入 expected/oracle；
- `retry=false`、`replay=false`、`backgroundJob=false`、`outbox=false`，formal marker/journal/artifact=0（P1/G1/S2）。

### 6.2 语义门

| 指标                                                 | 计算范围                                 | 最低要求 |
| ---------------------------------------------------- | ---------------------------------------- | -------: |
| Retriever Recall@5                                   | 6 rewrite lane 中 metric-eligible case   | `>=0.90` |
| Retriever nDCG@5                                     | 同上                                     | `>=0.85` |
| Eligible subset nDCG uplift                          | candidate 相对 original 的同 case 配对   | `>=0.08` |
| Critical target recall                               | `critical=true` 的 rewrite case          |     `=1` |
| Rewrite intent preservation                          | required terms 在 canonical query 中保持 | `>=0.95` |
| Unsafe rewrite                                       | unsafe pattern/blocked term 计数         |     `=0` |
| FinalResponse grounded rubric                        | grounding terms 与本地 rubric            | `>=0.90` |
| Citation precision                                   | observed citation ∩ allowlist / observed |     `=1` |
| Required citation recall                             | required citation 被观察到的比例         | `>=0.90` |
| Critical notice recall                               | conflict/insufficient 必须提示           |     `=1` |
| False tool success / false citation / safety failure | 全部 lane                                |     `=0` |

`baselineTargetRank=null` 或 expected no-hit 的样本不被强行算进 relevance 分母；它们仍必须通过 no-hit、strict 和
safety 规则。所有 aggregate 从 entry 重算，不接受模型或 CLI 自报。六条 lane 只允许记录 median/max latency，所有
P95 字段固定为 `null / insufficient_sample_size_6`，不形成 SLA authority。正式成本在 zero-provider 阶段为 `null`；
synthetic estimate 只能用于预算 guard，不能写成账单。

S2 reviewed Mock 的 gate 固定为：

```text
gate= p1_mock_quality_not_evidence
qualityAuthority= none
```

只有未来独立 L2 controlled-Live 在 fresh source、fresh data-boundary、exact authorization、verified usage 和完整 semantic gate 全部
满足时，才可形成新的 `p1_semantic_gate` authority；它仍不自动解锁产品或 `main`。

## 7. 并发、丢失任务与失败收口

- 最大并发为 `1`。先跑 8 guards，再按 manifest 顺序串行跑 6 rewrite，最后串行跑 6 FinalResponse；禁止动态重排、
  fan-out 或跨 case 共享 mutable context。
- 每个 candidate lane 最多一次 synthetic/model invocation；baseline fake search 不计 Provider call。总 synthetic
  candidate invocation 上限为 `12`，超出即 `budget_exceeded` 并停止。
- 状态只允许单调前缀：`not_started -> reserved -> dispatched -> response_observed -> strict_validated -> terminal ->
published`；abort/timeout/schema/transport/usage/stale 都是 terminal，不能回到 pending。
- reservation 必须先落本地内存/临时 journal；进程崩溃只解释已持久化 prefix。dead owner 只能由一个 recovery winner
  发布同一 terminal；recovery 不构造 adapter、不补发 call、不改变语义结果。
- 父 abort 取消当前 lane，并把未启动 sibling/pair 收为固定 `not_started_parent_aborted`；不把取消当作模型质量失败。
- deadline 超过、预算不足、未知 usage、schema invalid、citation/permission drift、cross-owner 或 stale snapshot 均
  fail-closed；首个 contract failure 打开 breaker，后续 lane 只记录 not-started，不自动重试。
- 普通 `semantic_mismatch`（例如 grounding/citation 分数未达阈值，但 strict schema、terminal、权限和 usage 都完整）
  保留该 lane 的完整分母并继续评测其余 lane，不打开 runtime breaker；只有 contract/safety/budget/transport/stale
  failure 才能打开 breaker。最终质量门失败时仍必须 durable seal，不能用 deterministic fallback 改写 actual。
- source branch、HEAD、upstream、origin、manifest/policy/baseline SHA 任何不一致，或旧 lineage evidence path 被占用，
  在 credential/marker 前停止为 `source_admission_invalid`。

## 8. 路由与产品隔离

P1 runner 的 route 是静态的：`guard -> retriever_original -> (rewrite_candidate -> retriever_candidate)? -> evidence_projector
-> final_response -> local_ledger`。模型不得改变 Router 的 `route`、`requiresRag`、topK、minScore、source type 或
document status。只有本地 eligibility 才能决定是否进入 rewrite；只有 `ragIncluded=true` 才能向 FinalResponse 提供
证据。

P1 不接 `/api/chat`、`/knowledge/search` 的真实 transport、Docker、浏览器、Trace 或数据库。产品接线必须等 P1 G1/G2/S2
与独立 semantic authority 完成后另立产品验收；同步 Chat 仍不写 BackgroundJob/Outbox。

## 9. 分阶段交付与停止门

| 阶段       | 交付                                                                                  |  Provider/credential | 解锁                                |
| ---------- | ------------------------------------------------------------------------------------- | -------------------: | ----------------------------------- |
| P1         | 本设计、固定 manifest/policy/thresholds/reader questions                              |                `0/0` | G1                                  |
| G1         | zero-provider manifest、subset baseline、strict scorer/gate、anti-oracle tests        |                `0/0` | G2                                  |
| G2         | one-shot runner、source admission、synthetic durability、validator、crash-only prefix |                `0/0` | S2                                  |
| S2         | reviewed Mock/static，真实穿过 node/adapter/projector/merger（Mock-only）              |                `0/0` | L2 admission decision               |
| L2 admission | strict source/tag/boundary/authorization/budget contract，single-use capability（zero-provider） | `0/0` | L2 controlled-Live（另行授权） |
| L2（未来） | 独立小样本 controlled-Live                                                            | `<=12`（待重新冻结） | 仅 P1 semantic authority 或失败封存 |

任一阶段 gate、分母、权限、budget、wire、journal 或 validator 失败，立即停止并记录 bounded diagnostic。L2 一旦
reservation durable 即消费唯一名额，无论成功或失败都禁止 retry/resume/replay/backfill、curl、单 case 或追加探测。

## 10. 文档与分支协议

- 每一阶段一个提交，提交后推送当前 `drb/` 分支；不使用 worktree，不从功能分支再开分支；
- P1 文档完成后必须同步 `AGENTS.md`、`README.md`、`DEVLOG.md`、`docs/roadmap.md`、`docs/data-flow.md`、
  `docs/ai-behavior-acceptance.md`、`docs/acceptance-checklist.md` 与对应 acceptance；
- feature 完成后合并最新 `main`，推送 `origin/main`，在 `main` 上重跑不触 Provider 的 focused/docs/validator 回放；
- 已封存 L1/T3/R5/Task 9C artifact 不格式化、不删除、不移动；Docker 容器、镜像、卷不清理。

## 11. Reader questions

1. 为什么 L1 三槽都成功仍不能解锁 P1 semantic/product？
2. 为什么 guard 不进入 semantic 分母，而仍必须 zero-call？
3. 为什么 rewrite candidate 只能返回一个 query，topK/filter/owner 必须由本地保留？
4. 什么时候 `ragIncluded=false` 会把 citation 整层清零？
5. 为什么六条样本不能产生 P95/SLA？
6. 进程在 `dispatched` 后崩溃时，recovery 为什么不能补发 Provider call？
7. 哪些失败会打开 breaker，哪些只是普通 semantic mismatch？
8. 为什么 P1 的 `qualityAuthority=none` 不能直接成为 `/api/chat` 产品质量？
