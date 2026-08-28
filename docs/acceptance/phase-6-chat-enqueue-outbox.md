# Phase 6 Chat 可靠入队：BackgroundJob + Outbox

更新时间：2026-08-28
状态：入队子任务已实现并完成 focused/merged-main 代码验收；下游 Chat Response Worker 已在独立原子任务实现，
但 Replay、`/api/chat` turn-backed 切换和真实模型 Worker 验收仍未完成。详见
`docs/acceptance/phase-6-chat-response-worker.md`。

## 1. 目标与边界

本任务建立 Chat 请求的可靠入队边界，避免 Web 进程在写入 `ChatTurn` 后、创建后台任务或事件前崩溃，留下无法继续处理的孤立 `QUEUED` turn。

一次新的 Chat 请求现在由 `ChatTurnEnqueueService` 在一个 `Serializable` Prisma 事务中按固定顺序写入：

1. `ChatTurn(QUEUED)`：owner、会话、输入消息 id/hash、幂等键和预算策略版本；
2. `BackgroundJob(QUEUED)`：`resourceType=CHAT_RESPONSE`、`resourceId=turnId`、队列/重试/去重信息；
3. `OutboxEvent(PENDING)`：`type=chat.response.requested`，供后续 dispatcher/worker 消费。

任一步失败，事务整体回滚。本入队事务本身不调用 Bull queue、Redis、Provider 或 Worker；`chat.response.requested` 的
dispatcher/worker admission 属于后续 `phase-6-chat-response-worker` 原子任务，避免把入队事实误写成回答已完成。

## 2. 实现

- `apps/server/src/chat-turns/chat-turn-enqueue.service.ts`：事务编排、Serializable 重试、重复请求配对事实校验；
- `apps/server/src/chat-turns/chat-turn.constants.ts`：Chat response queue/job/resource/event 及幂等键；
- `apps/server/src/chat-turns/chat-turns.repository.ts`：新增 caller-owned `createOrGetQueuedInTransaction`，保留旧 wrapper 兼容既有调用；
- `apps/server/src/background-jobs/background-jobs.service.ts`：新增 `createQueuedJobInTransaction`，普通创建复用同一 helper；
- `apps/server/src/outbox/outbox.handlers.ts`：入队子任务只定义 handler registry 扩展点；实际 requested bridge 与 terminal event
  handlers 见 `phase-6-chat-response-worker` 实现；
- `packages/types/src/api/background-job.ts`：加入 `CHAT_RESPONSE` resource type；
- `apps/server/src/chat-turns/chat-turns.module.ts`：导出 enqueue service，并引入 BackgroundJobs/Outbox 模块。

Outbox payload 仅允许四个字段：`turnId`、`backgroundJobId`、`inputHash`、`budgetPolicyVersion`。不写入输入正文、prompt、Provider 原文、credential 或客户端 owner 投影。Worker 必须在后续阶段根据 `turnId` 从服务端按 owner 重新加载事实，不能信任 payload 扩权。

## 3. 幂等与故障合同

- 同一 owner、同一 `clientRequestId` 且请求内容一致：返回既有 Turn、Job、Outbox 三件事实，不创建第二份工作；
- 同 key 不同 hash/会话/消息/预算版本：返回 `CHAT_TURN_IDEMPOTENCY_CONFLICT`，不写新事实；
- 不同 owner 可使用相同 client key；
- 已存在 Turn 但缺 Job 或 Outbox，或配对字段不一致：fail-closed 为 `CHAT_ENQUEUE_PAIR_MISSING`，不静默补写；
- P2034/SQLSTATE 40001 以及 ChatTurn 幂等 P2002 走有限 Serializable 重试（最多 5 次）；
- Job 或 Outbox 创建异常均由事务回滚，不会留下部分入队事实；
- Job 的 idempotency/dedupe key 与 Outbox 的 `chat.response.requested:${turnId}` 绑定 Turn；数据库已有 Outbox 唯一约束继续提供最终保护。

## 4. 验收证据

Focused enqueue contract：`8/8`；覆盖写入顺序、Job 失败回滚、Outbox 失败回滚、重复请求、幂等冲突、跨 owner、Serializable 重试和孤立 Turn fail-closed。既有 Outbox handler、repository/background-job 回归分别保持通过（`15/15`、`32/32`）；Chat requested event 此阶段不消费。

静态/构建：

- Server build：通过；
- `git diff --check`：通过；
- Prettier：目标文件通过；
- 全量 Server Jest：新增链路通过，另有两个与本任务无关的环境/历史失败：worker readiness CLI 期望退出码 `2` 实际为 `1`，以及 operator-audit integration 无法连接本地 `127.0.0.1:5433`。未把这两个失败改写为本任务通过。

本轮未启动或清理 Docker，未读取 `.env`，未调用 DeepSeek/Qwen，未写业务数据、Trace、Redis 或 MinIO。

## 5. 尚未完成

本任务仍不是完整断线恢复，也不能单独宣称“回答已可恢复”或“任务端到端不丢失”。Worker durable baseline 已在独立任务完成，
后续仍需：

1. Redis/SSE bounded cursor、断线 replay 和 `/api/chat` turn-backed 切换；
2. 全链路 budget ledger 与 Trace 对账；
3. Worker 真实模型 gate、usage/cost 和产品 controlled smoke；
4. Docker/API/可见浏览器验收。
