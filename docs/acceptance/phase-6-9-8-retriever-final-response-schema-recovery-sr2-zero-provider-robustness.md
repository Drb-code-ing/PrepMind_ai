# Phase 6.9.8 Retriever / FinalResponse Schema Recovery SR2 Zero-provider Robustness 验收

日期：2026-08-09

分支：`drb/phase-6-9-8-retriever-final-response-schema-recovery-sr2`

基线：`main == origin/main == 629acec49d9693f24ccded051d8d90cad77167cc`

独立 lineage：`phase-6.9.8-retriever-final-response-schema-recovery-v1`

Checkpoint authority：`zero_provider_retriever_final_response_schema_recovery_robustness`

qualityAuthority：`none`

## 1. 结论与边界

SR2 已在 SR1 的 exact-schema/parser/candidate seam 之上完成 bounded Provider-like robustness、held-out prompt-derived
responder、metamorphic 输入变换和 fault-runner 回归。测试使用 `reviewed_mock / mock / mock` 配置与 module-local synthetic
runtime；它会真实穿过 SR1 的 raw-content policy/parser、canonical projection、candidate local authority 与 sanitizer，
但不构造第一方 DeepSeek/Qwen adapter，也不发送网络请求。因此所有结果只证明结构、权限和 fail-closed 合同，不是模型
语义质量或 Provider 健康证据。

SR2 的 diagnostic 仍只保留为 candidate outcome 的 bounded sidecar；Retriever node/API boundary 会丢弃它，不进入产品
Chat、FinalResponse prompt、账单或 Trace。SR2 只解锁下一阶段 SR3 durability；不解锁正式 runner、真实 Mock 评测、
controlled-Live、产品 Docker/API/browser、`main` 或博客收尾。

全程保持：`providerCalls=0`、`credentialReads=0`、`formalEvidence=0`（marker/journal/report/artifact/recovery claim）、
`globalThis.fetch` 调用 `0`。没有读取根 `.env`，没有启动、清理或重置 Docker、PostgreSQL、Redis、MinIO、API、browser，
没有写入 Trace、BackgroundJob、Outbox 或业务数据；SR1、P1 L2、T3、R5、SR5 等历史 sealed evidence 不变。

## 2. 冻结身份与覆盖矩阵

- SR1 contract SHA：`4248db580e60ccf4b851d46ab692c867b04ba23c4bdb4b86e64bcb3b99fecf4e`；
- fixture：`phase-6.9.8-retriever-schema-recovery-sr2-robustness-v1`；
- responder：`phase-6.9.8-retriever-schema-recovery-sr2-prompt-derived-responder-v1`；
- fixture SHA：`sha256:59010e16fd665df6d497517276dbeacb3f5973036a07e8cf00010569da171505`；
- held-out 输入：`5`（中英文、物理/微积分/概率/阅读/算法混合）；
- Provider-like shape：`24`（`5` 个 canonical/extension accepted，`19` 个 syntax/envelope/type/limit rejected）；
- fault：`7`（transport、HTTP rate-limit、invalid-response、usage mismatch、trace mismatch、timeout、in-flight abort）；
- metamorphic：`4`（recent-turn reorder、irrelevant insertion、active-context key reorder、Unicode NFC/NFD extension）；
- 每个 eligible candidate dispatch 最多一次，禁止 retry；pre-abort/expired-deadline 在 runtime factory 前零调用；
- extension 只保留固定 `extension_fields_discarded` enum/bucket，Unicode/emoji/NFC/NFD 与私有 sentinel 不进入结果；
- parser/diagnostic 不保存 raw content、raw hash、字段名、Zod path/value、prompt、credential 或用户正文。

实现与测试文件：

- `packages/agent/tests/fixtures/phase-6-9-8-retriever-schema-recovery-sr2-robustness-v1.ts`；
- `packages/agent/tests/retriever-schema-recovery-sr2-helpers.ts`；
- `packages/agent/tests/retriever-schema-recovery-sr2-provider-robustness.test.ts`；
- `packages/agent/tests/retriever-schema-recovery-sr2-runtime-metamorphic.test.ts`；
- `packages/agent/tests/retriever-schema-recovery-sr2-fault-runner.test.ts`；
- `packages/agent/package.json` 中的 `eval:phase-6-9-8:schema-recovery:sr2` 入口。

## 3. 验收命令与结果

SR2 focused 命令：

```powershell
bun --filter @repo/agent eval:phase-6-9-8:schema-recovery:sr2
```

结果：`12 pass / 0 fail / 329 expect() calls`。

SR1 + SR2 + query-rewrite/node boundary 组合回归：`43 pass / 0 fail / 743 expect() calls`。

已通过的工程检查：

- `bun run --cwd packages/agent typecheck`；
- `bun run --cwd packages/agent lint`；
- `bun --filter @repo/ai test`：`345 pass / 0 fail / 2662 expect() calls`；
- `bun --filter @repo/ai typecheck`；
- `bun --filter @repo/ai lint`；
- Agent full：`1462 pass / 0 fail / 24841 expect() calls`（184 files）；
- 变更范围 Prettier 与 `git diff --check`。

Agent 全量回归已在最终源码上回放；其结果只作为回归证据，不改变本页 authority。既有全量基线与新 SR2 focused 不能
相加为语义分母，也不能拿 synthetic usage 当 Provider 计量。

## 4. 关键安全与故障证据

1. canonical、空白、escaped-key 与 bounded extension 输入都经过同一个 fresh collector；extension 被丢弃后仍只返回
   canonical rewrite，结果序列化不含 sentinel。
2. top-level drift、wrapper、prose/fence、BOM、trailing、duplicate/alias、scalar/object/array/null/type drift 与各项
   byte/depth/node/key/UTF-16 limit 均在第一次 dispatch 后 bounded fail-closed，原 query 回退且无 retry。
3. prompt-derived responder 只读取实际 bounded prompt；静态依赖扫描拒绝 `expected/oracle/baseline/scorer`、`.env`、
   credential key 与 `globalThis.fetch`。held-out 输入不使用 fixture expected 或生产 scorer。
4. recent-turn reorder 与 active-context key reorder 保持结果稳定；irrelevant insertion 不改变 original-query 保留和
   local `qualityAuthority=none`，含 prompt-injection 的 hostile context 在 dispatch 前保持 `0` runtime calls。
5. transport、HTTP rate-limit、invalid-response 映射为固定 provider category；usage/trace mismatch 统一为
   `runtime_untrusted / projected_schema / unknown`，不保留先前 parser diagnostic；timeout 与 in-flight parent abort
   各只 dispatch 一次，pre-abort/expired deadline 不创建 runtime。

## 5. Authority 与下一步

本页只形成：

`zero_provider_retriever_final_response_schema_recovery_robustness / qualityAuthority=none`

本页没有形成：DeepSeek/Qwen transport 或 semantic authority、Retriever recall/nDCG、FinalResponse grounded/citation、
P95/SLA、成本/账单、产品 `/api/chat`、Docker/API/browser、Trace、`main` 或生产可用性。SR2 完成后下一原子任务是从
最新已推送 `main` 新开普通分支完成 SR3 独立 runner/source admission/durability；仍不使用 worktree，不执行
`live`、`controlled`、`seal`、`recover`、`replay` 或 `backfill`。
