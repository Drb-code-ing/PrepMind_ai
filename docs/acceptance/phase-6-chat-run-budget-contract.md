# Phase 6 ChatRunBudget 合同验收

更新时间：2026-09-05
状态：共享类型合同以及 Prisma schema/migration 已实现；运行时 repository、跨节点 CAS、Worker 接入和真实模型验收未实现。

## 1. 目的

为一个 `ChatTurn` 建立 owner-bound、可审计且有界的 run-level 预算合同。该合同让 Router、Tutor、Retriever、Verifier、FinalResponse
和 Worker 使用同一组 calls、tokens、cost 上限，并把 reservation 的生命周期和 Trace 对账事实限制在安全字段内，避免各节点各算一套
预算或把 prompt/provider 原文写入数据库。

## 2. 本次实现

- 在 `@repo/types` 新增 `chat-run-budget` API contract，并从 package 根入口和子路径导出。
- 定义 policy、ledger、reservation request、reservation、usage 和 bounded ledger event 的 Zod strict schema 与 TypeScript 类型。
- 支持 `ROUTER`、`TUTOR`、`RETRIEVER`、`VERIFIER`、`FINAL_RESPONSE`、`WORKER` stage。
- 支持 `RESERVED -> DISPATCHED -> SETTLED|UNCERTAIN` 以及未 dispatch 时的 `RELEASED` 生命周期；settled usage 只能在结算状态出现。
- 成本以安全范围内的微 CNY 整数表示；owner、turn、ledger、reservation 绑定字段均为有界 ID。
- event 只允许 bounded ids、枚举、时间和 usage，strict schema 会拒绝未知字段及 prompt、provider response、API key 等原始载荷。
- Prisma 已新增 owner-bound `ChatRunBudget`、`ChatRunBudgetReservation`、`ChatRunBudgetEvent` 及复合外键、索引和生命周期 CHECK；迁移
  不携带 prompt、provider 原文或凭据字段。

## 3. 验证证据

在分支 `drb/chat-run-budget-contract` 执行：

```text
packages/types: 49 passed, 0 failed
typecheck: passed
Prettier: passed
```

测试覆盖数值边界、unknown/raw payload 拒绝、reservation 生命周期以及 settlement/cancellation event 语义。证据等级为
`implemented + mock/static validated`；本次未读取 `.env`、未调用 DeepSeek/Qwen 或其他 Provider、未触碰 Docker 数据。

## 4. 明确未完成项

这次已完成合同和数据库结构，但不代表功能已经拥有可运行的预算账本。后续 ticket 05 切片必须实现：

1. Prisma `ChatRunBudget`、reservation、ledger event 持久化及 owner/turn 外键。
2. Serializable/CAS reservation service，覆盖并发超限、取消释放、dispatch 后 uncertain 和重复请求幂等。
3. Worker/Agent stage 接入统一 ledger，结算真实 usage/cost，并与 terminal Outbox、Redis stream、Trace 做 bounded reconciliation。
4. crash/recovery、跨节点竞争和产品链路回归；默认仍保持 mock/off，真实模型需另有授权和独立 controlled-Live 证据。

## 5. 复核入口

- 合同源码：`packages/types/src/api/chat-run-budget.ts`
- 合同测试：`packages/types/tests/chat-run-budget.test.mts`
- 设计与实施顺序：[`phase-6-chat-durability-budget-design.md`](phase-6-chat-durability-budget-design.md)
- Agent 矩阵：[`phase-6-agent-runtime-audit.md`](phase-6-agent-runtime-audit.md)
