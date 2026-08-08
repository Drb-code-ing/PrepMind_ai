# Phase 6.9.8 Retriever / FinalResponse P1 zero-provider semantic-gate 验收

日期：2026-08-08
状态（本文件原始设计验收）：P1 设计完成，zero-provider；G1 后续已独立完成，G2/S2 尚未开始
分支：`drb/phase-6-9-8-p1-semantic-gate-design`
基线：`main` merge `3fdb9908`
Lineage：`phase-6.9.8-retriever-final-response-p1-v1`

> 后续状态（2026-08-08，非本次设计证据改写）：G1 已在
> `drb/phase-6-9-8-g1-manifest-baseline-scorer` 完成 manifest、subset baseline、candidate projection 与 strict
> scorer/gate；authority=`zero_provider_retriever_final_response_p1_g1_contract_baseline`、`qualityAuthority=none`，
> focused `5/5`、Agent full `1414/1414`，Provider/credential/formal evidence 均为 `0`。当前下一步为 G2 one-shot
> runner/durability，详见 `phase-6-9-8-retriever-final-response-p1-g1-contract-baseline-scorer.md`。

## 1. 本次验收结论

本次只验收 P1 的语义门设计、固定输入身份、权限/通信边界和生产失败收口规则。它不是代码实现验收，也不是
真实模型、产品 API、Docker 或浏览器验收。P1 为下一阶段 G1 提供唯一可复算的输入合同；L1 transport sealed evidence
与旧 T3/R5/Task 9C evidence 保持只读不变。

```text
authority       = zero_provider_retriever_final_response_p1_semantic_gate_design
qualityAuthority= none
providerCalls   = 0
credentialReads = 0
qwenCalls       = 0
formalEvidence  = 0
businessWrites  = 0
Docker/API/web  = not started
P95/SLA         = null / not applicable
```

## 2. 冻结 identity 与输入 SHA

```text
lineage:         phase-6.9.8-retriever-final-response-p1-v1
manifest SHA:    e7216d072eb20e47eaea469646b4c831c180bd9248fdaae059a335a22404fab2
policy SHA:      ab6a453a60fad5bf7678d4f04b9f1e1c30a5ab5642580b0ea5615f4edd20d146
baseline anchor: 63748b92cfa5da4ba60c8c457c7d97e8f079a0add130adbc7698a70ccc2f503b
Task 8 manifest: 3734b6987ebf81a2786711ad05591b06673c470a83a7dbdfeb81390de77331d8
Retriever manifest: 8a1788aa8973507555931ce358c08dcd739dd166636376f6ddcc2eff3a33654d
Retriever report:  a1478f22a4a2fad154496c4ffbfd761532c102fe3ae9453d1916a10ba2c26442
```

固定 entry 为 `guard_02/03/04/09/10/11/15/16`、`rewrite_01/03/05/09/12/15`、
`final_01/07/09/11/13/15`；顺序、selection tag 和分母由设计文档固定，CLI 不可覆盖。

## 3. 设计验收矩阵

| 检查项                  | 结论         | 证据/边界                                                          |
| ----------------------- | ------------ | ------------------------------------------------------------------ |
| owner 与 bearer         | 通过（设计） | 复用 canonical `AgentExecutionContextV1`；DTO 不带 token/owner     |
| Router/Retriever 路由   | 通过（设计） | `guard -> original -> optional rewrite -> projector -> final` 固定 |
| rewrite 权限            | 通过（设计） | 仅 `{ rewrittenQuery }`；本地保留 owner/topK/filter/citation       |
| FinalResponse 权限      | 通过（设计） | 只生成正文；ledger 生成 citation/tool/terminal/usage               |
| evidence 安全           | 通过（设计） | `ragIncluded=false` 时 bundle/allowlist/citation 全清零            |
| anti-oracle             | 通过（设计） | responder 只接收实际 bounded prompt，expected 仅后置 scorer        |
| 并发                    | 通过（设计） | 最大并发 1，固定顺序，candidate invocation 上限 12                 |
| 丢失任务/崩溃           | 通过（设计） | durable prefix 只允许同一 terminal publication，不补发 call        |
| abort/stale/cross-owner | 通过（设计） | 固定 terminal/reason，fail-closed，不回写业务                      |
| Mock authority          | 通过（设计） | `p1_mock_quality_not_evidence / qualityAuthority=none`             |
| P95/SLA                 | 通过（设计） | 六条 lane 只记录 median/max，P95 固定 null                         |

## 4. 质量门（G1 实现时强制）

```text
guards:                         8/8 pass, zero-call 8/8
rewrite strict/runtime/wire:    6/6/6/6
final strict/terminal/wire/usage: 6/6/6/6
retriever Recall@5:             >= 0.90
retriever nDCG@5:               >= 0.85
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

这些是 G1 scorer 已冻结并执行的门；G1 只完成了本地 baseline/contract 重算，不产生真实 candidate 语义分数或
`qualityAuthority`。实际 SHA、命令和零 Provider 结果见独立 G1 验收文档，不能手填或从 L1 transport evidence 推导。

## 5. 明确未做

- 未修改 `packages/agent` 运行时代码，未创建 P1 marker/journal/artifact 或 approved tag；
- 未读取根 `.env`、DeepSeek/Qwen credential，未调用 Provider 或真实 Qwen embedding；
- 未启动 Docker、Nest API、Web、可见浏览器、Trace、BackgroundJob/Outbox；
- 未创建测试账号、未写 PostgreSQL/Redis/MinIO、未改变任何产品 gate；
- 未执行 L2，也没有新的数据边界接受或 exact authorization；
- 未改写 L1/T3/R5/Task 9C 的历史 artifact、SHA、marker、journal 或 validator。

普通 semantic mismatch 只记录为 lane 结果并保留分母；contract/safety/budget/transport/stale failure 才打开 breaker。
两者都不能通过 fallback 混写，最终 gate 失败必须封存并停止。

## 6. 下一步与停止门

本文件形成时的下一步曾是 G1；该步骤现已完成。当前下一步是 G2：从最新 `main` 新建普通分支，实现 one-shot runner、
exclusive marker、hash-chain journal、hard-link publication、strict validator 与 crash-only recovery。G2 仍
zero-provider，完成后单独提交、推送并同步文档；随后合并 `main`、推送 `origin/main`，在 `main` 上做不访问 Provider
的回归验收。G1 的实现与结果见
`docs/acceptance/phase-6-9-8-retriever-final-response-p1-g1-contract-baseline-scorer.md`。

只有 S2 reviewed Mock/static 通过后，才可讨论独立 L2 admission。L2 必须重新接受当次 DeepSeek/Qwen 数据边界并提供
精确 authorization；一次 reservation 后无论成功失败都不得 retry/resume/replay/backfill、curl、单 case 或追加探测。

完整设计与实施顺序见：

- `docs/superpowers/specs/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate-design.md`
- `docs/superpowers/plans/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate.md`

## 7. 可回顾问题

1. L1 的三个真实响应为什么不能填充 P1 semantic 分数？
2. 为什么 guard 必须 zero-call，却不进入 semantic 分母？
3. `ragIncluded=false` 时哪些结构会被清零？
4. crash-only recovery 如何避免丢任务和 Provider 重放？
5. P1 完成后还缺哪些条件才能申请 L2？
