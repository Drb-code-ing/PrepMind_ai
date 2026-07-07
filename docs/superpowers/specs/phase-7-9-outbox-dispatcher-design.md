# Phase 7.9.2 Outbox Dispatcher Design

## 背景

Phase 7.9.1 已经完成 Durable Outbox 地基：`OutboxEvent` 表、`OutboxService`、claim / retry / dead-letter 状态机和单元测试。现在系统已经能把内部事件可靠落库，但事件还没有被真正消费。也就是说，当前 outbox 解决了“事件事实能保存下来”，还没有解决“保存下来的事件如何被可靠处理”。

Phase 7.9.2 的目标是补上一个最小 dispatcher 闭环，让 outbox 事件可以从 `PENDING` 被领取、分发给 handler、成功标记为 `SUCCEEDED`，失败后按 Phase 7.9.1 的 retry / dead-letter 规则处理。

本阶段仍然不替换 BullMQ 文档处理队列，不替换 `BackgroundJob`，不改变 Chat / RAG prompt / 模型调用，也不新增前端页面。

## 目标

- 新增 `OutboxDispatcherService`，负责 claim outbox events、调用 handler、标记成功或失败。
- 新增 handler registry，用事件 `type` 映射到明确的 handler 函数。
- 第一版只支持有限事件类型，未注册事件不会被静默吞掉，而是进入 retry / dead-letter 流程并带脱敏错误摘要。
- 第一版只接入一个低风险真实事件：知识库文档处理 requested 观测事件。
- 为 `DocumentProcessingJobService` 在 queue 模式下写入 `knowledge.document.processing.requested` outbox event，同时保留现有 in-process EventBus 发布，降低迁移风险。
- dispatcher 不公开 HTTP API，不新增前端 UI，不暴露系统级事件 payload。
- 单元测试覆盖 claim、handler success、handler failure、unknown type、无事件空跑和真实 requested 事件入库。

## 非目标

- 不把所有 `eventBus.publish()` 一次性迁移到 outbox。
- 不在本阶段接 Prometheus / Grafana / OpenTelemetry。
- 不实现长期运行的 scheduler loop；第一版提供可测试的 `dispatchBatch()`，后续再决定由 worker cron、BullMQ repeatable job 或 Nest schedule 驱动。
- 不改变 `PROCESS_KNOWLEDGE_DOCUMENT_QUEUE` 的 BullMQ 投递和 worker 处理语义。
- 不改变 `BackgroundJob` 面向用户的任务状态。
- 不改变 `/knowledge` 页面行为。
- 不调用真实模型，不改变 `/api/chat` live / mock 边界。

## 方案选择

### 方案 A：最小 dispatcher + 单事件接入（推荐）

新增 dispatcher 和 handler registry，只把 `knowledge.document.processing.requested` 写入 outbox 并由 dispatcher 消费。handler 第一版做观测型处理，验证整个 durable outbox 生命周期，不影响核心文档处理链路。

优点是风险低、能闭环验证 outbox；缺点是业务可见变化较小。

### 方案 B：直接迁移知识库 requested / succeeded / failed / stale skipped

把知识库处理的四类事件全部写入 outbox 并由 dispatcher 消费。优点是覆盖更完整；缺点是同时影响 API 进程、worker processor、失败分支和 stale 分支，回归面过大。

### 方案 C：先做 metrics，不接 dispatcher

为 `OutboxEvent` 增加 summary 或指标查询。优点是展示性强；缺点是 outbox 仍然没有消费闭环，指标只能展示堆积，不能证明可靠投递。

本阶段采用方案 A。

## 架构

新增后端内部模块能力：

```text
apps/server/src/outbox/
  outbox.dispatcher.ts
  outbox.dispatcher.spec.ts
  outbox.handlers.ts
  outbox.handlers.spec.ts
  outbox.module.ts
  outbox.service.ts
```

职责边界：

- `OutboxService`：继续只负责持久状态机，提供 enqueue、claim、success、retry / dead。
- `OutboxDispatcherService`：负责批量领取事件、查找 handler、执行 handler、根据结果更新状态。
- `outbox.handlers.ts`：定义第一版 handler registry 和类型约束。
- `DocumentProcessingJobService`：在 queue 模式成功创建 `BackgroundJob` 后，best-effort 写入 requested outbox event；写入失败不影响原有 BullMQ 投递和 API 响应。

## Dispatcher 行为

核心 API：

```ts
type DispatchOutboxBatchInput = {
  workerId: string;
  limit?: number;
  now?: Date;
  lockTimeoutMs?: number;
};

type DispatchOutboxBatchResult = {
  claimed: number;
  succeeded: number;
  failed: number;
};
```

行为：

1. 调用 `outboxService.claimPending({ workerId, limit, now, lockTimeoutMs })`。
2. 对每个 claim 成功的 event：
   - 如果找到 handler：执行 handler。
   - 如果找不到 handler：抛出 `OUTBOX_HANDLER_NOT_FOUND` 风格错误。
3. handler 成功后调用 `outboxService.markSucceeded(event.id, workerId)`。
4. handler 抛错后调用 `outboxService.markFailedOrRetry({ id, workerId, errorCode, error, now })`。
5. 单个事件失败不得阻断同批次后续事件。
6. 返回本批次 claimed / succeeded / failed 计数。

## Handler Registry

第一版 handler registry 是显式 map，不让 LLM 或字符串动态决定执行任意函数：

```ts
type OutboxEventHandler = (event: OutboxEventLike) => Promise<void>;

const handlers: Record<string, OutboxEventHandler> = {
  'knowledge.document.processing.requested': handleKnowledgeDocumentProcessingRequested,
};
```

第一版 `handleKnowledgeDocumentProcessingRequested()` 是观测型 handler，不重投 BullMQ、不改 `Document`、不改 `BackgroundJob`、不写用户数据。它只验证 payload 形状是否是安全 metadata：

- `userId`
- `documentId`
- `backgroundJobId`
- `force`

如果 payload 缺少关键字段，handler 抛出可脱敏错误，让 outbox retry / dead-letter 处理。

这让 Phase 7.9.2 能闭环验证 dispatcher，又不改变文档处理业务事实来源。

## 真实事件接入

在 `DocumentProcessingJobService` queue 模式中，当前流程是：

1. claim document 为 `PROCESSING`。
2. 创建 `BackgroundJob(QUEUED)`。
3. 投递 BullMQ job。
4. 发布 in-process requested event。

Phase 7.9.2 增加一步：

```text
创建 BackgroundJob 后 -> enqueue OutboxEvent(requested)
```

推荐 `idempotencyKey`：

```text
knowledge-document-processing-requested:${userId}:${documentId}:${backgroundJobId}
```

推荐 payload：

```json
{
  "userId": "user_1",
  "documentId": "doc_1",
  "backgroundJobId": "job_1",
  "force": false
}
```

安全边界：

- 不保存文件内容。
- 不保存 chunk。
- 不保存 prompt。
- 不保存 API key、access token、cookie。
- 不保存完整错误对象。
- 不把 outbox 写入失败暴露给普通用户；最多记录脱敏 warning。

## 错误处理

- handler 未注册：`markFailedOrRetry()`，`errorCode='OUTBOX_HANDLER_NOT_FOUND'`。
- payload 形状不合法：`markFailedOrRetry()`，`errorCode='OUTBOX_INVALID_PAYLOAD'`。
- handler 内部异常：`markFailedOrRetry()`，`errorCode='OUTBOX_HANDLER_FAILED'`。
- `markFailedOrRetry()` 内部使用 Phase 7.9.1 的 `sanitizeJobError()`，继续避免敏感内容落库。
- 同批次中一个事件失败不影响其他事件。

## 启动与运行边界

Phase 7.9.2 不做自动 loop，不在应用启动时直接开启后台 while 循环。原因：

- 当前本地开发已有 `SERVER_ROLE=api | worker | both` 边界。
- 自动 loop 需要额外考虑关闭、并发 worker 数、间隔、退避、测试稳定性和生产开关。
- 第一版先把 dispatcher 做成可调用服务，后续 Phase 7.9.3 再决定用 worker role、Nest schedule 或 BullMQ repeatable job 驱动。

因此本阶段的验收重点是 service-level 行为，而不是守护进程长跑。

## 测试策略

### Dispatcher 单元测试

覆盖：

- 没有 claim 到事件时返回 `{ claimed: 0, succeeded: 0, failed: 0 }`。
- registered handler 成功时调用 `markSucceeded()`。
- handler 抛错时调用 `markFailedOrRetry()`，并继续处理后续事件。
- unknown event type 调用 `markFailedOrRetry()`。
- `limit` 默认值和 `workerId` 透传到 `claimPending()`。

### Handler 单元测试

覆盖：

- requested payload 合法时成功返回。
- 缺 `userId` / `documentId` / `backgroundJobId` 时抛出 `OUTBOX_INVALID_PAYLOAD`。
- payload 中出现多余字段不报错，但 handler 不使用它们。

### DocumentProcessingJobService 单元测试

覆盖：

- queue 模式创建 `BackgroundJob` 后调用 `outboxService.enqueue()`。
- outbox payload 只包含安全 metadata。
- outbox `idempotencyKey` 包含 userId / documentId / backgroundJobId。
- outbox enqueue 失败时不阻断原有 queue job 创建流程。

## 文档与验收

实现完成后更新：

- `AGENTS.md`
- `DEVLOG.md`
- `docs/ai-behavior-acceptance.md`

验收命令：

```powershell
bun --cwd apps/server eslint src/outbox
bun --filter @repo/server test -- outbox
bun --filter @repo/server test -- document-processing-job
bun --filter @repo/server build
git diff --check
```

本阶段不要求 live 模型 smoke，因为不改变 Chat、RAG prompt、Tutor 输出、KnowledgeVerifierAgent guidance 或模型调用策略。

## 后续阶段

- Phase 7.9.3：为 dispatcher 增加受控运行方式，例如 worker-only 定时 tick、Nest schedule 或 BullMQ repeatable job。
- Phase 7.9.4：补 outbox summary / metrics，展示 pending、processing、dead 数量和最近错误摘要。
- Phase 7.9.5：逐步迁移 succeeded / failed / stale skipped 等知识库处理事件。
