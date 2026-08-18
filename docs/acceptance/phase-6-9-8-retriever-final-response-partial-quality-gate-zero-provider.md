# Phase 6.9.8 Retriever/FinalResponse partial quality gate（zero-provider）

## 目的

V12 的 DeepSeek candidate 已观察到 Provider response，但在本地 typed result/usage/application 合同失败，quality
breaker 随后延后剩余槽位。完整 semantic gate 继续要求全部 24 个 Provider call 成功；本任务增加一个独立的
partial projection，让工程上可以确认“transport 有限进展”和“哪些槽位被延后”，不必把它们误报为完整质量通过。

## 实现

- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-partial-quality-gate.ts`
- package export：`@repo/agent/retriever-final-response-partial-quality-gate`
- `packages/agent/tests/phase-6-9-8-retriever-final-response-partial-quality-gate.test.ts`

partial report 使用版本 `phase-6.9.8-retriever-final-response-partial-quality-gate-v1`，并保存 V12 base report 的
canonical SHA、lineage、原 gate 状态、bounded counts 和 bounded failure reasons。不会复制 Provider query、response、
prompt、字段或敏感值。

## 门槛语义

未来 runtime live report 只有同时满足以下条件才可得到
`retriever_final_response_transport_completion_authority`：

1. completion mode 为 `runtime`。
2. 8/8 guards 通过，8/8 zero-call 已验证，安全失败为 0。
3. 至少存在一个已启动且已观察到 response 的槽位。
4. 每个失败槽位都有既有 bounded failure reason。
5. execution mode 与 report authority 一致，且不是 synthetic。

通过时 gate 状态为 `partial_transport_completion`，但 `semantic.status=not_established`、
`qualityAuthority=none`，预算 input/output/cost 固定为 `null`。因此该门不代表 Retriever recall/NDCG、FinalResponse
grounding/citation、完整成本、billing、产品可用、P95 或 SLA。reviewed Mock/zero-provider 始终以
`partial_gate_failed / synthetic_authority` 收口。

## 验收证据

- focused synthetic：`1/1`，`13 expect()`。
- production-shaped partial fixture 为 started/succeeded/response/usage/deferred/failed=`4/3/3/3/20/1`；完整 semantic gate 仍失败，partial transport gate 通过。
- Agent full：`1694/1694`，`25974 expect()`，`209 files`；Agent typecheck/lint 通过。
- synthetic report 观察到有限 response 进展，但 partial gate 明确拒绝 synthetic authority。
- partial report 可被 strict schema 解析，`rawDataRetained=false`，预算三项为 `null`。
- Provider calls / credential reads / formal evidence / business writes：`0/0/0/0`。
- 未读取根 `.env`，未启动或清理 Docker、PostgreSQL、Redis、MinIO、API、浏览器；未写 Trace、BackgroundJob、Outbox。
- V12 sealed evidence、tag、授权和 validator 未重跑、未移动、未改写。

## 后续

真实 partial live 仍需从最新 `main` 建立新的 source lineage、annotated tag、data-boundary 和 exact authorization；
不得复用 V12 已消费授权或 sealed evidence。partial gate 不直接解锁 SR6 产品验收。
