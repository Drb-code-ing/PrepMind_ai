# Phase 6 Chat Response Worker：Outbox 到 Durable Reply

更新时间：2026-08-28
状态：本原子任务已完成实现、边界加固、功能分支验收、远程推送、`--no-ff` 合并 main 和合并后复验。
分支：`drb/phase-6-chat-response-worker`

## 1. 任务目的

上一原子任务只保证 `ChatTurn`、`BackgroundJob` 和 `chat.response.requested` Outbox 在同一个
`Serializable` 事务中入库。它解决了“请求写了一半进程崩溃”的问题，但还没有执行回答。

本任务把已提交的请求变成一条可恢复的后台执行链：

```text
Outbox(chat.response.requested)
  -> Outbox dispatcher
  -> BullMQ(chat-response)
  -> ChatResponseProcessor
  -> owner-scoped input reload
  -> assistant message + ChatTurn terminal state
     + BackgroundJob terminal state
     + chat.response.completed|failed Outbox
```

它的直接价值是：队列投递与数据库事实可重试、重复消费不会重复回答、进程在模型执行前后崩溃时仍有明确的
状态对账入口，并为后续 Redis/SSE cursor、断线 replay 和 `/api/chat` turn-backed 改造提供 durable 基线。Redis Stream contract、
bounded replay 和 Worker 事件发布已在后续 [`phase-6-chat-stream-replay.md`](phase-6-chat-stream-replay.md) 独立任务实现。

## 2. 实现范围

### 2.1 Outbox 到 BullMQ

- `ChatResponseRequestedHandler` 严格解析四字段 bounded payload；不接受 prompt、owner 扩权字段或 Provider 原文。
- 重新读取并校验 `ChatTurn`、`BackgroundJob` 的 owner、会话/资源路由、输入 hash 和预算版本。
- 使用 `backgroundJob.id` 作为固定 Bull job id；`queue.add` 与数据库 link 之间发生崩溃时，下一次 Outbox 重试通过 `getJob` 恢复。
- 数据库 link 使用 CAS；不同 Bull job、不同 payload 或终态不一致均 fail-closed。
- Outbox 重试若已观察到 Worker 的 `ACTIVE` claim，会先验证同 id Bull job 再确认；若 active claim 没有可验证的 Bull 记录则
  使用可重试的 handler failure fail-closed，不擅自重置 claim 造成并发重复执行。
- 已终态 Turn 会先对账其 BackgroundJob，不会再次入队。

### 2.2 Worker claim 与执行

- `ChatResponseProcessor` 仅在 `SERVER_ROLE=worker|both` 注册，API-only 进程不启动 Bull processor。
- Worker 按 owner、资源类型、队列、job name、Bull id 和 attempt 校验后，以 Serializable 事务抢占 Turn/BackgroundJob。
- 支持有限的 Serializable 冲突重试；生成阶段使用 `AbortSignal` 和有界超时。
- 生成失败按固定错误枚举区分 retryable 与 terminal；重试只把 BackgroundJob 放回 `QUEUED`，不伪造回答。
- 同一 Turn 的响应消息 id 可由 Turn 派生，重复执行只允许验证相同内容，不能覆盖另一份回答。
- `CHAT_RESPONSE_WORKER_LOCK_DURATION_MS` 必须比 `CHAT_RESPONSE_GENERATION_TIMEOUT_MS` 至少长 30 秒；默认值为
  `180000/120000`，并在 Compose 与 env schema 中统一声明，避免 Bull lease 在生成超时前过期。

### 2.3 队列实例与配置边界

- `ChatResponseQueueModule` 是 chat response 队列的唯一注册点，由 Outbox bridge 与 Worker processor 共享，避免同名 Queue
  provider/Redis 连接重复创建。
- `CHAT_RESPONSE_WORKER_CONCURRENCY` 受 `1..8` 限制；锁时长受 `10s..900s` 限制；生成超时受 `1s..600s` 限制。
- active claim 缺失 Bull 记录时不做无 lease 的自动重置；后续可由带 lease 的恢复/巡检任务单独处理。

### 2.4 Durable terminal commit

成功路径在一个事务中提交：

1. assistant `ChatMessage`（owner/conversation/role 受校验，metadata 标出 generator 和 worker 版本）；
2. `ChatTurn=SUCCEEDED` 与 response message 引用；
3. `BackgroundJob=SUCCEEDED`、进度和 bounded result summary；
4. `chat.response.completed` OutboxEvent。

不可重试失败以同样的原子边界提交 `ChatTurn=FAILED`、`BackgroundJob=FAILED` 和
`chat.response.failed` OutboxEvent。两个终态 CAS 都检查更新计数；丢失竞争不会被静默接受。

## 3. 明确的模型边界

当前注入的 `DeterministicChatResponseGenerator` 是安全的工程基线，返回的 metadata 为
`deterministic-worker-v1`。它只用于验证 claim、重试、事务和幂等合同，**不是真实模型接入，也不代表模型质量**。
本任务未读取根 `.env`，未调用 DeepSeek/Qwen，未改变既有 `/api/chat` 的 mock/live 默认配置。真实模型必须在独立
gate、预算、数据边界和产品验收任务中接入，不能把本任务的 deterministic 结果当作 Live 证据。

## 4. 代码与测试

- `apps/server/src/chat-turns/chat-response-worker.service.ts`：claim、生成、成功/失败原子提交；
- `apps/server/src/chat-turns/chat-response.processor.ts`：BullMQ processor 与 worker role/concurrency 边界；
- `apps/server/src/chat-turns/chat-response.job.ts`：requested/completed/failed 严格 Zod 合同；
- `apps/server/src/outbox/chat-response-requested.handler.ts`：Outbox 到 BullMQ 幂等桥接；
- `apps/server/src/chat-turns/chat-turns.module.ts`、`apps/server/src/chat-turns/chat-response-queue.module.ts`、
  `apps/server/src/outbox/outbox.module.ts`：队列、handler 与 processor 注册；
- `apps/server/src/chat-turns/chat-response-worker.config.ts`：并发、生成超时和 Bull lease 的统一安全边界；
- `apps/server/src/config/env.ts`：worker 参数 schema 与 generation/lease 交叉校验；
- `apps/server/src/outbox/outbox.handlers.ts`：终态事件验证 handler；
- 对应 `*.spec.ts`：成功、终态幂等、重试、超时/失败边界、owner/路由校验、Bull add race、CAS 丢失、取消对账、role 注册和 payload schema。

## 5. 验收证据

功能分支 focused 回归：

```text
9 suites / 137 tests passed
  chat-response-worker.service.spec.ts
  chat-response-worker.config.spec.ts
  chat-response-queue.module.spec.ts
  chat-response-requested.handler.spec.ts
  chat-response.job.spec.ts
  chat-turns.module.spec.ts
  outbox.handlers.spec.ts
  chat-turn-enqueue.service.spec.ts
  config/env.spec.ts
```

静态门：

- Server build：通过；
- 目标文件 ESLint：通过；
- 目标文件 Prettier check：通过；
- `git diff --check`：通过。

新增配置/模块加固后的 Server 全量 Jest：`234` suites passed，`3` suites skipped，另有 `2` 个既有环境/历史失败（见下文），没有新增失败。
本次全量统计为 `234 passed / 2 failed / 3 skipped`（`239` suites，`2228 passed / 2 failed / 30 skipped` tests）。

Server 全量 Jest 的历史/环境失败仍单独记录，不改写为本任务失败或通过：worker-readiness CLI 的已有退出码断言
期望 `2` 但实际为 `1`，以及 operator-audit integration 无法连接本地 `127.0.0.1:5433`。本任务未为绕过它们而清空
Docker、重置数据库或修改用户数据。

## 6. 尚未完成

本任务完成的是 Worker durable baseline，不是完整产品断线恢复。以下仍是后续独立原子任务：

1. 将已实现的 Redis/SSE bounded delta stream、cursor 和断线 replay 接入 `/api/chat` 与浏览器；
2. `/api/chat` 切换到 turn-backed path，并保留旧 snapshot sync 的只读兼容窗口；
3. 全链路 ChatRunBudget ledger 与跨节点 reservation/Trace 对账；
4. Worker 使用真实模型的独立 gate、provider usage/cost 和产品 controlled smoke；
5. Docker/API/可见浏览器验收。

因此当前不能宣称“`/api/chat` 已经由该 Worker 执行”或“真实模型已接入”。

## 7. 分支与合并回执

本任务的 Git 与合并回执：

```text
feature commit: 04ef0f6fa75cef0740c7a46005d7a915fba02b4e
feature remote: origin/drb/phase-6-chat-response-worker
main merge: d034d3be7c859659d85e5e0ed48903fe9bb52ba7
main == origin/main: yes
merged-main focused: 9 suites / 137 tests passed
merged-main build: passed
merged-main ESLint: passed
merged-main Prettier check: passed
merged-main git diff --check: passed
```

Docker、PostgreSQL、Redis、MinIO 未清理；未使用 worktree；三个用户预先修改的
`wrong-question-organizer` 文件未暂存、未提交。合并后的全量 Server Jest 保持
`234 passed / 2 failed / 3 skipped` suites；两个失败仍是既有 worker-readiness 退出码断言和本地 PostgreSQL
`127.0.0.1:5433` 不可达，不能归因于本任务。Docker 未运行，因此未执行 Docker/API/浏览器集成验收。
