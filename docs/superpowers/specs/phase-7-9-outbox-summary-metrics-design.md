# Phase 7.9.4 Outbox Summary / Metrics Design

## 背景

Phase 7.9.1 已经有 `OutboxEvent` 持久事件表和 retry / dead-letter 状态机，Phase 7.9.2 已经有 dispatcher，Phase 7.9.3 已经有 worker-only runner。现在 outbox 可以落库、消费和自动 tick，但开发者还缺少一个轻量观察面：当前是否有 outbox 积压、有没有 `DEAD` 事件、最近失败的错误码是什么。

Phase 7.9.4 的目标是补齐“看得见”的闭环。它不是业务功能页，也不是生产监控大盘，而是把 outbox 的安全 summary 接入现有 Worker Observability，让本地调试、面试讲解和后续 metrics 接入有稳定的数据口径。

## 目标

- 新增 outbox summary 能力，统计 outbox 状态数量、最老 pending 事件年龄和最近错误摘要。
- summary 只返回安全元数据，不返回 payload、prompt、chunk、文件内容、API key、token、cookie 或完整错误正文。
- 将 outbox summary 接入 `GET /worker-observability/summary` 的 response contract。
- Worker Observability 的健康信号把 outbox backlog / dead-letter 纳入判断。
- 保持账号级 `BackgroundJob` summary 与系统级 outbox / queue summary 的语义区分。

## 非目标

- 不新增独立 outbox HTTP API。
- 不新增前端 UI 或 `/knowledge` 页面展示。
- 不接 Prometheus / Grafana / OpenTelemetry。
- 不新增 outbox admin 操作，不支持重放、删除、跳过或手动修复。
- 不迁移更多业务事件到 outbox。
- 不改变 Chat、RAG prompt、模型调用或前端页面行为。

## 数据口径

新增 response 字段：

```ts
outbox: {
  counts: {
    pending: number;
    processing: number;
    succeeded: number;
    failed: number;
    dead: number;
    total: number;
  };
  hasBacklog: boolean;
  oldestPendingAgeMs: number | null;
  recentErrors: Array<{
    id: string;
    type: string;
    status: 'PENDING' | 'PROCESSING' | 'FAILED' | 'DEAD';
    lastErrorCode: string | null;
    attempts: number;
    maxAttempts: number;
    updatedAt: string;
  }>;
}
```

说明：

- `counts` 是系统级 outbox 状态计数，不按当前用户隔离，因为 outbox 是后台基础设施信号。
- `hasBacklog` 在 `pending + processing > 0` 时为 true。
- `oldestPendingAgeMs` 只看最早的 `PENDING` 事件；没有 pending 时为 null。
- `recentErrors` 只返回最近少量 `PENDING / PROCESSING / FAILED / DEAD` 且有 `lastErrorCode` 或 `lastError` 的事件摘要。
- `recentErrors` 不返回 `payload`、`lastError` 正文、`aggregateId` 或用户内容，避免泄露内部业务对象和错误正文。

## 服务设计

新增 `OutboxMetricsService`：

```text
apps/server/src/outbox/outbox-metrics.service.ts
apps/server/src/outbox/outbox-metrics.service.spec.ts
```

职责：

- 读取 Prisma `outboxEvent`。
- 计算状态计数。
- 查询最老 pending 事件并计算年龄。
- 查询最近错误摘要。
- 返回纯 summary DTO。

`OutboxModule` 导出 `OutboxMetricsService`，`WorkerObservabilityModule` import `OutboxModule` 并注入该 service。

## Worker Observability 集成

`WorkerObservabilityService.getSummary()` 现有并行读取：

- BullMQ queue counts
- queue pause 状态
- Redis worker heartbeat
- 当前账号 BackgroundJob summary

Phase 7.9.4 增加：

- 系统级 outbox summary

健康信号调整：

- `hasOutboxBacklog = outbox.hasBacklog`
- `hasDeadOutboxEvents = outbox.counts.dead > 0`
- `hasRecentFailures = backgroundJobs.failedCount > 0 || counts.failed > 0 || hasDeadOutboxEvents`
- status 判断中 dead outbox 进入 `degraded`。
- outbox backlog 不直接等同 degraded，因为 pending / processing 可能只是正常积压；但它会在 signals 中显式返回，供后续 UI 或 metrics 使用。

## 安全边界

- 不返回 outbox payload。
- 不返回完整 `lastError`。
- 不返回 `aggregateId`，避免把业务资源 id 暴露到系统级 summary。
- 不返回 userId、documentId、backgroundJobId 之外的业务内容；第一版 recentErrors 甚至不返回这些业务 id。
- production 是否暴露仍受现有 `WORKER_OBSERVABILITY_ENABLED` 控制，Phase 7.9.4 不放宽任何鉴权。

## 测试策略

新增 tests：

- `OutboxMetricsService`
  - 统计各状态数量和 total。
  - pending 存在时计算 oldest pending age。
  - 无 pending 时 oldest age 为 null。
  - recentErrors 只包含安全字段，不包含 payload / lastError / aggregateId。
- `worker-observability` contract
  - types schema 要求 outbox 字段。
  - service summary 返回 outbox。
  - dead outbox 事件会使 status degraded，并设置 `hasDeadOutboxEvents=true`。
  - pending outbox backlog 会设置 `hasOutboxBacklog=true`，但不单独把 idle 变 degraded。

## 验证命令

```powershell
bun --filter @repo/server test -- outbox-metrics
bun --filter @repo/server test -- worker-observability
bun --cwd packages/types typecheck
bun --cwd apps/server eslint src/outbox src/worker-observability
bun --filter @repo/server build
git diff --check
```

## 验收标准

- `/worker-observability/summary` contract 包含 outbox summary。
- outbox summary 不泄露 payload、lastError 正文、aggregateId 或用户内容。
- dead outbox 会出现在健康信号里。
- 本阶段不新增前端、不新增 outbox admin API、不新增生产监控栈。
- 文档明确 Phase 7.9.4 只是只读观测增强，不改变 Chat / RAG / live model 行为。

## 后续阶段

- Phase 7.9.5：逐步把 succeeded / failed / stale skipped 等后台任务事件写入 outbox。
- 后续生产观测：把 outbox summary 转为 Prometheus metrics，并按部署形态设计告警。
- 后续面试博客：完整复盘 BullMQ、BackgroundJob、EventBus、Durable Outbox、Dispatcher Runner 和 Summary/Metrics 的分工。
