# Phase 7.9 Durable Outbox Design

## 背景

PrepMind 现在已经有三层后台能力：

- `InProcessEventBus`：进程内事件广播，能隔离 handler 失败，但事件不落盘。
- `BackgroundJob`：账号级后台任务状态，给用户和前端看任务是否排队、处理中、成功或失败。
- BullMQ worker：负责知识库文档处理队列，依赖 Redis，能执行耗时任务。

这些能力已经能支撑本地开发和小规模后台任务，但还有一个生产可靠性缺口：**业务状态已经写入数据库，但后续事件通知或观测动作可能丢失**。

例如知识库文档进入队列后，API 进程会 `eventBus.publish()` 一个 `knowledge.document.processing.requested` 事件。这个事件目前只存在于当前进程内存里。如果进程在 publish 前后崩溃，或者未来 API / worker 拆成多个实例，内存事件不会天然跨进程恢复。

Durable Outbox 的目标是把事件先作为数据库事实写下来，再由 worker 可靠 claim、执行、重试和标记结果。它不是替代 BullMQ，也不是替代 BackgroundJob，而是补上“事件不会因为进程生命周期丢掉”的可靠投递层。

## 目标

- 新增 `OutboxEvent` 数据模型，保存事件类型、状态、payload、重试信息、锁信息和错误摘要。
- 新增 `OutboxService`，提供 `enqueue()`、`claimPending()`、`markSucceeded()`、`markFailedOrRetry()` 等最小能力。
- 用数据库状态机表达事件流转：`PENDING -> PROCESSING -> SUCCEEDED / PENDING retry / DEAD`；`FAILED` 枚举值作为后续 dispatcher 观测或中间失败态预留，Phase 7.9.1 当前服务不会落该状态。
- 失败后按 `nextRunAt` 延迟重试，超过最大次数进入 `DEAD`。
- claim 时支持 `lockedBy` / `lockedAt`，避免多个 worker 重复处理同一事件。
- payload 必须是脱敏 JSON，不保存 API key、access token、cookie、完整 prompt、完整 RAG chunk 或真实模型回答。
- Phase 7.9.1 先做地基和单元测试，不大规模替换现有业务链路。

## 非目标

- 不替换 BullMQ 文档处理队列。
- 不替换 `BackgroundJob` 用户可见任务状态。
- 不立即把所有 `InProcessEventBus.publish()` 改成 outbox。
- 不在第一版接 Prometheus / Grafana。
- 不新增前端页面。
- 不改变 `/api/chat`、RAG prompt、模型调用或最终输出行为。

## 方案选择

### 方案 A：先做 Outbox 地基（推荐）

先新增表、service 和纯后端测试，验证事件可靠落库、claim、成功、失败重试、进入 dead 的状态机。业务接入留到 Phase 7.9.2。

优点是风险低，能把 outbox 的核心语义做准；缺点是第一步用户看不到直接页面变化。

### 方案 B：直接替换知识库处理事件

把 `DocumentProcessingJobService` 和 `DocumentProcessingProcessor` 里的 `eventBus.publish()` 直接改为 outbox。优点是功能立刻接入真实场景；缺点是会同时改动队列、任务状态、事件观察，排查面较大。

### 方案 C：直接做 metrics / observability

先给 EventBus 和 BackgroundJob 加指标。优点是展示性强；缺点是没有解决事件丢失问题，只是更容易看到问题。

本阶段采用方案 A。

## 数据模型

新增枚举：

```prisma
enum OutboxEventStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED // reserved for future dispatcher observability
  DEAD
}
```

新增模型：

```prisma
model OutboxEvent {
  id             String            @id @default(cuid())
  type           String
  status         OutboxEventStatus @default(PENDING)
  aggregateType  String?
  aggregateId    String?
  idempotencyKey String?           @unique
  payload        Json
  payloadHash    String?
  attempts       Int               @default(0)
  maxAttempts    Int               @default(5)
  nextRunAt      DateTime          @default(now())
  lockedAt       DateTime?
  lockedBy       String?
  lastErrorCode  String?
  lastError      String?           @db.Text
  processedAt    DateTime?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@index([status, nextRunAt, createdAt])
  @@index([lockedBy, lockedAt])
  @@index([aggregateType, aggregateId, createdAt])
  @@index([type, status, createdAt])
}
```

字段含义：

- `type`：事件类型，例如 `knowledge.document.processing.requested`。
- `aggregateType` / `aggregateId`：关联业务对象，便于排查和后续筛选。
- `idempotencyKey`：可选幂等键，避免同一业务事件重复写入。
- `payload`：脱敏事件数据。
- `payloadHash`：可选 payload 摘要，用于排查但不泄露完整内容。
- `attempts` / `maxAttempts`：重试控制。
- `nextRunAt`：下次可执行时间。
- `lockedAt` / `lockedBy`：claim 锁。
- `lastErrorCode` / `lastError`：脱敏错误摘要。

## OutboxService 设计

核心 API：

```ts
type EnqueueOutboxEventInput = {
  type: string;
  aggregateType?: string | null;
  aggregateId?: string | null;
  idempotencyKey?: string | null;
  payload: Record<string, unknown>;
  payloadHash?: string | null;
  maxAttempts?: number;
  nextRunAt?: Date;
};

type ClaimOutboxEventsInput = {
  workerId: string;
  limit: number;
  now?: Date;
  lockTimeoutMs?: number;
};
```

方法：

- `enqueue(input)`：写入 `PENDING` 事件；如果提供 `idempotencyKey`，重复调用返回已有事件或保持幂等。
- `claimPending(input)`：领取 `PENDING` 且 `nextRunAt <= now` 的事件，或领取超时卡在 `PROCESSING` 的事件。
- `markSucceeded(id, workerId)`：只有当前 worker 锁定的 `PROCESSING` 事件才能成功，成功后写 `processedAt` 并清理锁。
- `markFailedOrRetry(input)`：记录脱敏错误；如果 `attempts < maxAttempts`，回到 `PENDING` 并推迟 `nextRunAt`；否则进入 `DEAD`。

## Claim 策略

第一版优先使用 Prisma `updateMany` + `findMany` 的保守实现，避免一开始写复杂 raw SQL：

1. 查出候选事件 id：
   - `status=PENDING` 且 `nextRunAt <= now`
   - 或 `status=PROCESSING` 且 `lockedAt < now - lockTimeoutMs`
2. 按 `createdAt, id` 排序取 `limit`。
3. 对每个 id 执行条件 `updateMany`：
   - 当前仍满足可 claim 条件才更新为 `PROCESSING`
   - `attempts += 1`
   - 写入 `lockedBy`、`lockedAt`
4. 再读回 claim 成功的事件。

这个实现不是极致高吞吐，但足够当前阶段；后续高并发可以升级为 PostgreSQL `FOR UPDATE SKIP LOCKED` raw SQL。

## 错误与重试

`markFailedOrRetry()` 使用固定轻量 backoff：

```text
delayMs = min(60_000, 1_000 * 2 ** (attempts - 1))
```

示例：

- 第 1 次失败：1s 后重试。
- 第 2 次失败：2s 后重试。
- 第 3 次失败：4s 后重试。
- 超过 `maxAttempts`：进入 `DEAD`。

`lastError` 必须走已有 `sanitizeJobError()` 或同等脱敏逻辑，不能保存完整异常对象和敏感 payload。

## 模块边界

新增后端模块：

```text
apps/server/src/outbox/
  outbox.module.ts
  outbox.service.ts
  outbox.service.spec.ts
```

第一版不加 controller。原因：

- outbox 是系统内部可靠性设施，不直接面向普通用户。
- 生产环境不应随便公开系统级事件拓扑。
- 后续如果需要展示 summary，可以走受控的 worker observability 或 admin-only API。

## 与现有能力的关系

```text
OutboxEvent：保证事件事实可靠落库和可恢复处理
BullMQ：负责具体耗时任务队列执行
BackgroundJob：给当前用户展示任务状态
WorkerObservability：展示队列、worker heartbeat 和后台任务摘要
InProcessEventBus：仍可保留为同进程低风险通知
```

Phase 7.9.1 不改变现有 `eventBus.publish()` 的运行时行为。业务迁移会在 Phase 7.9.2 逐步做，避免一次性破坏后台处理链路。

## 测试策略

第一版以 service 单元测试为主，使用 mock Prisma：

- `enqueue()` 能创建 `PENDING` 事件并填默认 `maxAttempts`。
- `enqueue()` 在 `idempotencyKey` 冲突时返回已有事件。
- `claimPending()` 只领取到期事件，不领取未来 `nextRunAt` 事件。
- `claimPending()` 能回收超时 `PROCESSING` 事件。
- `markSucceeded()` 只允许锁定 worker 完成事件。
- `markFailedOrRetry()` 未超过次数时回到 `PENDING` 并设置 `nextRunAt`。
- `markFailedOrRetry()` 超过次数时进入 `DEAD`。
- 错误摘要必须脱敏，不能透传完整对象。

后续接入真实业务时再补 e2e 或 integration。

## 文档与验收

实现完成后更新：

- `AGENTS.md`
- `DEVLOG.md`
- `docs/ai-behavior-acceptance.md`
- 必要时新增面试博客：`docs/blogs/durable-outbox-and-worker-metrics.md`

验收命令：

```powershell
bun --filter @repo/server test -- outbox
bun --filter @repo/server build
git diff --check
```

如果涉及 Prisma schema，需要同时运行：

```powershell
bun --cwd packages/database test
```

## 后续阶段

- Phase 7.9.2：把知识库处理 requested / succeeded / failed / stale skipped 事件逐步写入 outbox。
- Phase 7.9.3：新增 outbox summary 或 metrics 接口。
- Phase 7.9.4：按部署需要接 Prometheus / Grafana 或 OpenTelemetry。
