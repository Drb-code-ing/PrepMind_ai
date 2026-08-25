# PrepMind Domain Glossary

## ChatTurn

`ChatTurn` 是一次经认证、绑定单一用户和会话的 Chat 请求写模型。它保存请求幂等键、输入消息 id/hash、预算策略版本、生命周期状态和最终 assistant 消息引用；它不是模型执行器，也不承载 Provider 原文。

## ChatTurn lifecycle

合法生命周期为 `QUEUED -> ACTIVE -> SUCCEEDED|FAILED|CANCELLED`。状态迁移由 owner-scoped CAS 控制；终态不可被另一种终态覆盖，重复相同终态请求只返回幂等确认。

## Owner-scoped

任何 ChatTurn、Conversation、ChatMessage 的读取和迁移都必须同时携带 `userId`。客户端传入的 id 不能扩大权限，也不能通过响应消息 id 探测其他用户的数据是否存在。

## Durable answer

只有 assistant 消息和 ChatTurn 终态在同一事务中落库，才可作为回答的 durable authority。Trace、SSE 和浏览器 snapshot sync 都不能单独替代该 authority。
