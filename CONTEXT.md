# PrepMind Domain Glossary

## ChatTurn

`ChatTurn` 是一次经认证、绑定单一用户和会话的 Chat 请求写模型。它保存请求幂等键、输入消息 id/hash、预算策略版本、生命周期状态和最终 assistant 消息引用；它不是模型执行器，也不承载 Provider 原文。

## ChatTurn lifecycle

合法生命周期为 `QUEUED -> ACTIVE -> SUCCEEDED|FAILED|CANCELLED`。状态迁移由 owner-scoped CAS 控制；终态不可被另一种终态覆盖，重复相同终态请求只返回幂等确认。

## Owner-scoped

任何 ChatTurn、Conversation、ChatMessage 的读取和迁移都必须同时携带 `userId`。客户端传入的 id 不能扩大权限，也不能通过响应消息 id 探测其他用户的数据是否存在。

## Durable answer

只有 assistant 消息和 ChatTurn 终态在同一事务中落库，才可作为回答的 durable authority。Trace、SSE 和浏览器 snapshot sync 都不能单独替代该 authority。

## Chat response worker

`chat.response.requested` 由 Outbox dispatcher 幂等桥接到固定 BullMQ job id；`SERVER_ROLE=worker|both` 才注册
`ChatResponseProcessor`。Worker 重新按 owner 加载输入，进行有限 claim/retry/Abort 处理，并在同一 Serializable 事务中提交
assistant 消息、ChatTurn 终态、BackgroundJob 终态和 `chat.response.completed|failed` Outbox。当前生成器是明确标注的
`deterministic-worker-v1` 基线，不是真实模型。队列由 `ChatResponseQueueModule` 单点注册，active claim 的 Outbox 重试必须先
验证同 id Bull 记录；缺失记录时 fail-closed。生成超时与 Bull lease 在 env schema 中保持至少 30 秒裕量。Redis/SSE replay、
`/api/chat` turn-backed 切换和真实模型 Worker 仍是后续任务。

## Reliable chat enqueue

新的 Chat 请求必须由 `ChatTurnEnqueueService` 在同一个 `Serializable` 事务中创建 `ChatTurn(QUEUED)`、
`BackgroundJob(QUEUED)` 与 `OutboxEvent(chat.response.requested)`。事务提交前不调用 Bull、Provider 或 Worker；任一写入失败全部回滚。
重复请求返回已有三件事实，Outbox payload 只允许 turn/job id、输入 hash 和预算版本等 bounded projection。可靠入队不等于 Worker、Replay 或完整断线恢复。
