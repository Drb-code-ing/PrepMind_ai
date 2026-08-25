# Phase 6 ChatTurn 状态机与 Owner Repository

更新时间：2026-08-25
状态：本原子任务已实现、推送、`--no-ff` 合并并完成 merged-main 复验；尚未代表完整 Chat 断连 durability。

## 1. 本任务范围

本次只落地 ChatTurn 的数据合同和内部 repository：

- Prisma `ChatTurnStatus`、`ChatTurnErrorCode`、`ChatTurn` 模型与迁移；
- owner + conversation 复合外键、幂等唯一键、response message owner 外键；
- `QUEUED -> ACTIVE -> SUCCEEDED|FAILED|CANCELLED` 生命周期 CHECK；
- `createOrGetQueued`、owner 查询、claim、complete、fail、cancel；
- Serializable enqueue 重试、CAS 竞争、重复终态与跨 owner/会话保护测试。

本任务明确没有实现 BackgroundJob、Outbox、Worker、Redis/SSE replay、`/api/chat` 切换、真实模型调用或 Docker migration deploy。

## 2. 关键合同

- `(userId, clientRequestId)` 唯一；同 owner 同输入重复 enqueue 返回已有 turn，不重复生成；同 key 不同 conversation/hash/message ids/budget policy 返回 `CHAT_TURN_IDEMPOTENCY_CONFLICT`。
- Conversation 使用 `(conversationId, userId)` 复合外键；输入消息必须属于该 owner 和 conversation。
- 所有读取与 CAS 同时包含 `id + userId`；其他 owner 看不到 turn 的存在性。
- response message 必须属于同一 owner、conversation 且角色为 `ASSISTANT`；数据库关系使用 `Restrict`，避免删除已作为 durable response 的消息。
- 状态迁移使用 `updateMany` 的 expected-state CAS；丢失竞争只返回明确结果，不覆盖获胜者。
- `FAILED`/`CANCELLED` 必须使用固定 `ChatTurnErrorCode`；hash 必须匹配 `sha256:` 加 64 位小写十六进制。

## 3. 实现位置

- Schema：`packages/database/prisma/schema.prisma`
- Migration：`packages/database/prisma/migrations/20260825090000_chat_turn_state_machine/migration.sql`
- Repository：`apps/server/src/chat-turns/chat-turns.repository.ts`
- Module：`apps/server/src/chat-turns/chat-turns.module.ts`
- Contract tests：`apps/server/src/chat-turns/chat-turns.repository.spec.ts`
- Schema tests：`packages/database/tests/chat-turn-schema.test.mts`

## 4. 验收证据

Prisma CLI 使用显式 dummy `DATABASE_URL`；整个任务未启动 Docker、未调用 Provider，也未把任何 credential 写入证据：

```text
ChatTurnsRepository focused: 10/10
Database schema/migration tests: 9/9
Server build: passed
Database typecheck: passed
Database test/typecheck: passed
git diff --check: passed
Prisma validate: passed
Prisma client generate + repair: passed
```

功能提交 `1ce14fc9` 已推送；首次 `--no-ff` 合并为 `main=abca94ab` 并推送。merged-main 再次通过 repository `10/10`、
database `9/9`、Server build、targeted ESLint、Prisma validate 与 commit diff check。三个用户预先修改的
WrongQuestionOrganizer 文件始终未暂存、未提交；Docker 数据未清理。

## 5. 未完成与下一步

这一步只证明 ChatTurn 状态机和 owner repository 合同成立。产品仍只能宣称“流式功能可用”，不能宣称断线可恢复或任务不丢失。

下一原子任务是在同一数据库事务中创建 `BackgroundJob(QUEUED)` 与 `chat.response.requested OutboxEvent`，并补 crash-before-commit、duplicate enqueue 和 dispatcher/worker claim 测试；不得把本任务的状态机通过误写成完整 durability。
