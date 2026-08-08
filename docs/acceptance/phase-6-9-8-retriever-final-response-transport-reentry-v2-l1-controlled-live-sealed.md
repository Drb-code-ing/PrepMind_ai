# Phase 6.9.8 Transport Re-entry V2 L1 controlled-Live durable seal

> 日期：2026-08-08
> Branch：`drb/phase-6-9-8-retriever-final-response-contract`
> Source commit：`ee3dbf91c863a3a5cd95c810a9c0cec0b26f64c6`
> Run ID：`ce0c3257-a5d9-4389-90ec-814d5e9cde34`
> Lineage：`phase-6.9.8-retriever-final-response-transport-reentry-v2`

## 1. 终态

在新 source commit 通过 clean/tracking parity、fresh proxy preflight、当次 DeepSeek/Qwen 数据边界接受与两条
exact authorization 后，L1 唯一 controlled canary 已按固定顺序完成并 durable seal：

```text
rewrite -> qwen -> final_response
```

终态为：

```text
gate=transport_reentry_v2_l1_controlled_canary_passed
passed=true
authority=controlled_live_transport_reentry_v2
qualityAuthority=none
proxy=direct_ready / providerCalls=0 (preflight)
```

这次只验证 bounded transport、strict response/usage、双 wire accounting 与 durable publication；它不是 Retriever/
FinalResponse 语义质量或产品可用性验收。

## 2. Runtime 结果

| Slot             | Provider family          | Usage (input/output/total) |      Verified cost |  Duration | Wire (runner/provider) |
| ---------------- | ------------------------ | -------------------------: | -----------------: | --------: | ---------------------- |
| `rewrite`        | DeepSeek V4 Pro          |             `85 / 13 / 98` |     `0.000333 CNY` | `1210 ms` | `1/1/1/1 + 1/1/1/1`    |
| `qwen`           | Qwen `text-embedding-v4` |              `12 / 0 / 12` |     `0.000006 CNY` |  `258 ms` | `1/1/1/1 + 1/1/1/1`    |
| `final_response` | DeepSeek V4 Pro stream   |             `48 / 15 / 63` |     `0.000234 CNY` |  `852 ms` | `1/1/1/1 + 1/1/1/1`    |
| **合计**         |                          |       **`145 / 28 / 173`** | **`0.000573 CNY`** |           | **3 slots completed**  |

Aggregate accounting：`providerCalls=3`、`credentialReads=3`、`verifiedUsageSlots=3`、breaker `open=false`、
`recoveryRequired=false`，预算上限 `0.024096 CNY` 未超出。所有 slot 均为 `completed`，`failureCode=null`，
`rawDataRetained=false`。

## 3. Durable evidence

- exclusive marker：`.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2.once.json`；物理 SHA-256
  `69c88e5e582c225cb970bd3c9e1853db95e6216015f3af10f5369808eec34044`；reservation 前快照为 `plannedSlots=3`、
  `providerCalls=0`、`credentialReads=0`、`formalEvidence=0`；
- journal：`.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2.journal.jsonl`，16 条 hash-chain 记录；
  seq `13` 为 `run_terminal`，seq `14` 为 `publication_started`，seq `15` 为 `evidence_published`；
- logical report SHA-256：`fc0409acbc6446ae3ccaf6917905ac465678006384fbf2325c839715ff1a2685`；
  physical report SHA-256：`14f1ed72ade94425e6903a30941a059bbf76409bc9bda9acd9dfaec8fca8ae9e`；
- root hard-link artifact：`phase-6-9-8-retriever-final-response-transport-reentry-v2-ce0c3257-a5d9-4389-90ec-814d5e9cde34.json`；
  physical/evidence SHA-256：`472c727db12a0115a918440795ff72b59df980521867841d778373c91484718a`；
- 独立只读 validator 返回 `ok=true`、`finalJournalEvent=evidence_published`、`journalRecords=16`、
  `formalEvidence=1`，且 artifact/report/marker lineage 与 run ID 一致。

上述 `.tmp` journal/report/marker 与 root artifact 是 sealed evidence，禁止删除、改写、重建或用 recovery/seal
覆盖。root artifact 保留 raw-free report projection，不包含 API key、credential value、用户正文或 Provider 原文。

## 4. Authority 边界

本次结果仅形成 `controlled_live_transport_reentry_v2` transport diagnostic authority，`qualityAuthority=none`：

- 可以确认：三槽真实第一方 adapter 依次得到 response、verified usage，runner/provider wire 完整，预算与 crash-only
  publication/validator 通过；
- 不能确认：Retriever recall、query rewrite uplift、FinalResponse grounded/citation 语义、Agent 质量门、P95/SLA、
  `/api/chat` 产品体验、Docker/API/browser、Trace、BackgroundJob/Outbox、业务数据或 `main` authority；
- 不得把本次 `0.000573 CNY` 或三槽成功写成产品质量通过，也不得与旧 T3/R5/Task 9C 证据拼接。

## 5. 一次性收口与下一步

L1 marker 已 durable，唯一名额已消费。无论结果成功或失败，均禁止 retry、resume、replay、backfill、追加 curl/
单 case/Provider 探测、recovery 或再次 seal。旧 T3/R5/Task 9C 的 marker、journal、artifact、SHA 与 authority 继续
保持不可变。

P1 zero-provider semantic-gate 设计已在从最新 `main` 派生的普通分支上冻结；下一原子任务是 G1 manifest/subset
baseline/scorer contract。P1 设计、计划与验收见
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate-design.md`、
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate.md`；本次 L1 成功不直接进入产品或
Phase 6.10。
