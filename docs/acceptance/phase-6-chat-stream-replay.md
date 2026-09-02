# Phase 6 Chat Stream Contract 与 Redis Replay

更新时间：2026-09-02
状态：实现与 focused/static 验证完成；尚未切换 `/api/chat`，也不是真实模型或生产可用性证据。

## 1. 任务目的

上一项任务已经把 `ChatTurn + BackgroundJob + Outbox` 可靠地交给 BullMQ，并能在数据库中提交最终回答；但客户端断开后没有一个
有界、可按游标读取的增量传输层。本任务补齐“事件合同 + Redis Stream 回放 + Worker 发布”这一独立层，让客户端可以：

- 用 `turnId` 查询 PostgreSQL 中的耐久状态和最终 assistant 回答；
- 用游标读取已经产生的增量事件，并在断线后从上次游标继续；
- 在 Redis 不可用或游标过期时，安全地退回状态接口，而不是把 SSE 断开误判为失败。

这一步仍不改变现有 `/api/chat` 的同步/流式产品入口，因此不会把尚未完成的 turn-backed 产品切换误报为已完成。

## 2. 合同与边界

### 2.1 事件版本

共享合同位于 `packages/types/src/api/chat-stream.ts`，版本为 `chat-turn-stream-v1`。允许的事件只有：

| 事件                 | 作用                                                    | 终态 |
| -------------------- | ------------------------------------------------------- | ---- |
| `response_started`   | 记录生成开始、`mock/live` 模式和 bounded generator 名称 | 否   |
| `text_delta`         | 传输最多 4,000 字符的一段文本                           | 否   |
| `citations`          | 传输最多 4 条已投影引用                                 | 否   |
| `response_completed` | 绑定 response message、finish reason 和 generator       | 是   |
| `response_failed`    | 固定错误码与失败阶段                                    | 是   |

事件正文禁止 prompt、credential、provider 原文和未界定的 metadata。游标采用 Redis Stream ID（`ms-seq`）格式，查询页大小为
`1..256`；合同和响应 envelope 均使用 Zod strict schema。

### 2.2 Redis 只是传输层

`ChatStreamStore` 通过 BullMQ 已有 Redis client 复用连接，不再创建第二个连接。每个 `(userId, turnId)` 映射到不可逆的 SHA-256
key：

```text
<BULLMQ_PREFIX>:chat-stream:<sha256(userId + NUL + turnId)>
```

Lua 脚本在一次原子操作内完成 sequence 分配、`XADD`、event id/hash 幂等、终态封锁、事件数/字节数 trim 和 TTL。默认上限为
`256 events / 512 KiB / 24 h`，由 `CHAT_STREAM_MAX_EVENTS`、`CHAT_STREAM_MAX_BYTES`、`CHAT_STREAM_TTL_SECONDS` 配置并经过
env schema 限制。Redis 失败只返回 bounded `unavailable`，不会回滚或重试已经提交的 PostgreSQL 终态。

### 2.3 权限与恢复权威

- `GET /chat-turns/:turnId` 和 `GET /chat-turns/:turnId/events` 均要求 JWT；查询始终按 `(userId, turnId)` 绑定。
- 状态接口只返回安全的 turn、BackgroundJob 和 assistant 字段，并校验 response message 的 owner、conversation 和 `ASSISTANT`
  角色。
- 回放接口返回 `cursorState=initial|ok|expired`、`transport=available|unavailable`、`hasMore` 和 `terminal`。
- Redis stream 缺失、故障或 cursor 过期时，客户端必须读取状态接口；PostgreSQL 才是业务事实和最终回答的权威。

## 3. Worker 发布顺序

当前 `ChatResponseWorkerService` 仍注入 `DeterministicChatResponseGenerator`（`deterministic-worker-v1`），没有读取 `.env` 或调用
DeepSeek/Qwen。成功路径顺序是：

```text
owner-scoped claim
  -> response_started
  -> bounded text_delta (0..n)
  -> PostgreSQL transaction:
       assistant message + ChatTurn + BackgroundJob + completed Outbox
  -> response_completed
```

失败路径在 durable failure transaction 后发布 `response_failed`。终态重投只补发幂等事件，不再次调用 generator。Redis 发布异常被隔离，
不会让 durable transaction 变成 Bull 重试；因此“事件可见”不是“数据库已提交”的替代品。

## 4. 代码与测试

- `packages/types/src/api/chat-stream.ts`：事件、游标、查询和状态 response contract。
- `apps/server/src/chat-turns/chat-stream.store.ts`：owner-hashed Redis Stream、Lua 原子 append、bounded replay 和故障降级。
- `apps/server/src/chat-turns/chat-turns.query.service.ts`：owner-scoped 状态/事件查询与安全投影。
- `apps/server/src/chat-turns/chat-turns.controller.ts`：JWT 保护的两个只读 endpoint。
- `apps/server/src/chat-turns/chat-response-worker.service.ts`：started/delta/terminal 发布接入。
- `apps/server/src/config/env.ts`、`chat-turns.module.ts`：stream bound 配置和既有 Queue client 复用。
- `apps/server/src/config/swagger.spec.ts`：Chat Turns tag、endpoint 和 response envelope 文档回归。

功能分支 focused 验证：

```text
Server chat-turns suites: 10 passed / 49 tests
  新增 stream store、query service、controller；覆盖重复、终态封锁、cursor 过期、坏 entry、Redis 故障、owner 和事件顺序
Server stream-related expanded tests: 5 suites / 110 tests passed
@repo/types: 43 tests passed
Server build: passed
Server target ESLint: passed
Server target Prettier check: passed
Swagger config: 8 tests passed
```

本机 Redis smoke 使用唯一测试 key 验证 sequence `0,1,2`、有序 replay、terminal 后追加拒绝，并已精确删除测试 key；没有执行
`FLUSHDB`/`FLUSHALL`。Docker Desktop 当前不可连接（`dockerDesktopLinuxEngine` pipe 不存在），所以本任务没有进行 Docker/API/可见
浏览器验收，也没有触碰 PostgreSQL、MinIO 或用户数据。

## 5. 明确未完成项

1. 现有 `/api/chat` 仍不是 turn-backed 请求入口；浏览器尚未消费上述 replay endpoint。
2. 全链路 `ChatRunBudget` ledger、跨节点 reservation、Trace 对账和 lease recovery 仍是后续原子任务。
3. Worker 仍为 deterministic generator；真实模型 Worker、usage/cost、产品 controlled-Live 和生产 SLA 均未证明。
4. Docker 恢复后还需在合并后的 `main` 做 API、headed 浏览器和精确合成数据清理验收。

因此本任务证据等级为 `implemented` + `mock/static validated`，不能写成 `product real-model smoke` 或 `production-used`。

## 6. Git 收口

```text
feature branch: drb/phase-6-chat-stream-replay
feature commit: pending
feature remote: pending
main merge: pending
main == origin/main: pending
merged-main revalidation: pending
```

收口必须遵循：显式路径提交 -> 推送功能分支 -> `git merge --no-ff` 到最新 `main` -> 推送 `main` -> 在 merged-main 重跑必要回归。
用户预修改的三个 `wrong-question-organizer` 文件及其他既有 dirty 文件不得进入本任务提交。
