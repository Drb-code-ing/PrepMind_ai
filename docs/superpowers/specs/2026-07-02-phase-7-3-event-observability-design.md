# Phase 7.3 Event Observability Design

## 背景

Phase 7.0 / 7.1 已经把知识库文档处理从纯同步请求推进到 `BackgroundJob` 控制面和 BullMQ 队列模式；Phase 7.2 又补上了 RAG SafetyGuard，让用户上传资料在进入 Chat prompt 前具备低信任过滤边界。现在系统已经能“后台处理”，但还缺少一个更适合面试和生产排障的闭环：后台任务发生了什么、状态为什么变化、前端应该如何用一句话解释当前队列状态。

当前 `InProcessEventBus` 已存在，能发布知识库文档处理的 requested / succeeded / failed / stale_skipped 事件，但它还偏底层：

- 事件只面向知识库处理，缺少统一事件命名、分类和脱敏边界说明。
- `BackgroundJob` API 返回单个 job 和列表，但没有账号级摘要，前端需要自己拼“最近后台任务状态”。
- `/knowledge` 页面能显示最近 job 状态，但缺少更稳定的摘要 helper，不利于未来复用到 `/agent-trace` 或调试台。

Phase 7.3 的目标不是引入复杂 outbox 或消息中间件，而是在当前进程内事件总线基础上补齐可观测语义，为后续 OutboxEvent、Prometheus 指标、worker-only 部署和 Swagger/OpenAPI 做准备。

## 目标

1. 扩展共享类型，新增 `BackgroundJobSummaryResponse`，用于表达账号级后台任务摘要。
2. 增强 `BackgroundJobsService`，提供 `getSummary(userId)`：统计最近后台任务中的 active / failed / stale / succeeded 数量，并返回最近一条 job。
3. 增强 `GET /background-jobs/summary` API，保持 `JwtAuthGuard` 用户隔离，只返回脱敏状态摘要，不暴露 payload 原文、文档全文、chunk、prompt 或密钥。
4. 给 EventBus 增加错误隔离：单个订阅者抛错不能阻断后续订阅者，也不能影响业务主流程。
5. 给前端增加后台任务摘要 API、hook 和展示 helper，让 `/knowledge` 能用稳定文案说明“后台是否还有工作在跑”。
6. 更新开发文档和 roadmap，说明 Phase 7.3 的边界和后续 Outbox/metrics 方向。
7. 完成实现后写一篇面试学习文档，重点讲清从同步请求到队列、事件、观测摘要的演进，以及开发中遇到的边界问题。

## 非目标

- 不引入 Kafka、RabbitMQ 或持久化 outbox。
- 不把 EventBus 作为跨进程强一致消息系统。
- 不让 worker 调用 live Chat 模型。
- 不把完整 prompt、完整回答、完整 RAG chunk、文件全文、access token、refresh token 或 API key 写入事件或 `BackgroundJob`。
- 不重写现有 `/knowledge` 页面布局，只补充后台任务摘要展示。
- 不改动 RAG SafetyGuard 风险分类规则。

## 架构设计

### 事件总线

继续使用 `apps/server/src/events` 下的 `InProcessEventBus`。它是进程内解耦工具，不承诺跨进程投递。为了避免事件处理器影响主流程，`publish()` 会捕获 handler 异常并继续执行后续 handler。第一版不记录 handler 异常到数据库，只返回 publish 结果，便于测试和未来接入日志。

事件仍然保持强类型 union。Phase 7.3 不新增大量业务事件，只先把可靠性边界补齐，并在文档中把未来事件分类固定下来：

- `knowledge.document.*`：资料处理生命周期。
- `background.job.*`：后台任务状态变化摘要，后续可接入 metrics。
- `review.reminder.*`：复习提醒调度，后续 Phase 7 扩展。
- `agent.trace.*`：trace 聚合或成本统计，后续 Phase 7 扩展。

### 后台任务摘要

新增共享 contract：

```ts
backgroundJobSummaryResponseSchema = z.object({
  activeCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  staleSkippedCount: z.number().int().min(0),
  succeededCount: z.number().int().min(0),
  totalRecentCount: z.number().int().min(0),
  latestJob: backgroundJobResponseSchema.nullable(),
});
```

`getSummary(userId)` 只统计当前用户最近 50 条 job。这个窗口足够支持页面提示和开发调试，不试图替代 BI 报表。状态分组规则：

- active：`QUEUED` + `ACTIVE`
- failed：`FAILED`
- stale：`STALE_SKIPPED`
- succeeded：`SUCCEEDED`
- cancelled 暂时只计入 total，不单独显示，因为当前业务还没有取消操作入口。

### 前端摘要

前端新增：

- `backgroundJobApi.getSummary(accessToken)`
- `useBackgroundJobSummary(options)`
- `getBackgroundJobSummaryView(summary)`

`/knowledge` 页面使用摘要 helper 展示一行轻量状态：

- 有 active：提示“后台仍有 N 个任务处理中”。
- 无 active 但有 failed：提示“最近有 N 个后台任务失败，可查看资料状态后重试”。
- 无 active/failed 但有 stale：提示“有旧任务被跳过，通常是资料已替换或状态变化”。
- 全部正常或暂无任务：保持低噪音，不制造告警。

## 错误处理与安全边界

- EventBus handler 抛错时，`publish()` 不再向外抛出，避免后台事件订阅者影响文档处理主链路。
- Summary API 使用当前 `userId` 查询，不支持跨用户汇总。
- `latestJob` 沿用已有 `BackgroundJobResponse` 脱敏形态；不新增原始 payload。
- 前端只展示摘要和最近状态，不展示内部错误堆栈。
- 测试覆盖事件隔离、summary 统计和前端文案。

## 验收标准

- `GET /background-jobs/summary` 能返回当前用户最近后台任务摘要。
- EventBus 在一个 handler 抛错时仍调用其它 handler，并返回包含失败数量的结果。
- `/knowledge` 在有活跃/失败/stale job 时显示稳定摘要文案。
- 现有知识库处理、RAG SafetyGuard、Chat RAG 流程不回退。
- 文档说明 Phase 7.3 是进程内事件和只读观测增强，不是持久化 outbox。

