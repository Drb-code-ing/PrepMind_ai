# Phase 7.3 复盘：后台任务不只是“扔进队列”，还要能被看见

这篇博客记录 PrepMind AI 在 Phase 7.3 做的事件可观测增强。它不是一个很炫的 AI 功能，但非常适合面试讲，因为它回答了一个工程化问题：当文档解析、分块、embedding 这些长任务从同步接口迁到后台队列后，系统怎样知道它正在发生什么、有没有卡住、失败后用户能不能理解？

一句话总结：Phase 7.3 做了三件事。

1. 给 in-process `EventBus` 加失败隔离，避免一个观察者挂掉拖垮其它观察者。
2. 给 `BackgroundJob` 加账号级 summary API，让前端不用自己扫一堆任务来猜状态。
3. 在 `/knowledge` 页面展示后台任务摘要，并且只在确实有活跃任务时轮询。

## 背景：为什么队列还不够

Phase 7.1 已经把知识库文档处理接入 BullMQ。用户点击“处理资料”后，接口可以快速返回，worker 在后台解析 PDF / DOCX / TXT / Markdown，分块、生成 embedding，再写入 `Chunk` 表。

这解决了同步接口容易超时的问题，但也带来了新问题：

- 用户点完按钮后，不知道任务到底是在排队、处理中、失败了，还是已经完成。
- worker 失败时，如果只靠日志排查，前端体验会很模糊。
- 将来 OCR、提醒调度、批量 embedding 都进后台后，任务状态会越来越多。
- 多个观察者订阅同一个事件时，一个 handler 抛错不应该影响其它 handler。

所以这一步不是“再加一个队列”，而是给后台任务做一个小的控制面和观测面。

## 本次架构落点

### 1. BackgroundJob 是权威任务状态

`BackgroundJob` 仍然是 PostgreSQL 里的权威记录。它只保存脱敏元数据，例如：

- 任务状态：`QUEUED`、`ACTIVE`、`SUCCEEDED`、`FAILED`、`STALE_SKIPPED`
- 资源类型和资源 id：当前主要是 `KNOWLEDGE_DOCUMENT`
- 时间戳：requested / started / finished / updated
- 简短错误摘要和安全的 `payloadPreview`

它不保存完整文件内容、完整 RAG chunk、完整 prompt、模型回答、API key、access token 或 cookie。

这点面试里很重要：后台任务表是“观测和恢复线索”，不是另一个内容存储系统。

### 2. Summary API 给 UI 一个轻量入口

原来前端可以调用：

```http
GET /background-jobs
GET /background-jobs/:id
```

Phase 7.3 新增：

```http
GET /background-jobs/summary
```

返回大致是：

```ts
type BackgroundJobSummaryResponse = {
  activeCount: number;
  failedCount: number;
  staleSkippedCount: number;
  succeededCount: number;
  totalRecentCount: number;
  latestJob: BackgroundJobResponse | null;
};
```

这里有一个实现细节：`activeCount` 不能只统计最近 50 条任务。假设某个旧任务一直卡在 `ACTIVE`，但最近又创建了很多其它任务，如果只看最新 50 条，UI 就会误以为没有活跃任务。

所以最终实现是：

```ts
const [activeCount, jobs] = await Promise.all([
  prisma.backgroundJob.count({
    where: { userId, status: { in: ['QUEUED', 'ACTIVE'] } },
  }),
  prisma.backgroundJob.findMany({
    where: { userId },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 50,
    select: backgroundJobSelect,
  }),
]);
```

这样 `activeCount` 是账号级真实活跃任务数，失败/跳过/成功摘要仍然来自最近 50 条窗口，符合“最近任务摘要”的 UI 语义。

### 3. EventBus 先做进程内事件，不假装是可靠消息队列

这次的 `InProcessEventBus` 不是 Kafka，也不是 durable outbox。它只是当前 NestJS 进程内的轻量事件分发器。

它适合：

- 记录脱敏观察事件
- 后续挂轻量 metrics
- 让文档处理完成、失败、跳过等事件有统一入口

它不适合：

- 跨进程可靠投递
- 服务重启后的事件恢复
- 重要业务写入的唯一触发来源

因此这次设计里明确：如果以后某些事件必须可靠送达，就应该升级为 durable outbox 或专门消息系统，而不是把 in-process bus 说成“生产级可靠事件系统”。

## 这次实际发现并修掉的问题

### 问题一：一个 handler 抛错会阻断后续 handler

最初的 EventBus 如果某个订阅者抛错，后面的订阅者就收不到事件。这在观察链路里很危险，因为“日志 handler 挂了”不应该影响“metrics handler”。

修法是让 `publish()` 对每个 handler 单独 try/catch，并返回结果：

```ts
export type EventPublishResult = {
  delivered: number;
  failed: number;
};

publish(event: ServerEvent): EventPublishResult {
  const handlers = this.handlers.get(event.type);
  if (!handlers) return { delivered: 0, failed: 0 };

  let delivered = 0;
  let failed = 0;

  for (const handler of handlers) {
    try {
      handler(event);
      delivered += 1;
    } catch {
      failed += 1;
    }
  }

  return { delivered, failed };
}
```

后续又补了一点：不能只是吞掉错误，否则观察者坏了也没人知道。现在会记录脱敏 warning：

```ts
this.logger.warn(
  `EventBus handler failure: type=${event.type} delivered=${delivered} failed=${failed}`,
);
```

注意这里没有打印完整 payload。事件 payload 里可能有 userId、documentId、backgroundJobId，将来还可能扩展出更多敏感字段。可观测不等于把所有上下文都打进日志。

### 问题二：`/background-jobs/summary` 路由必须放在 `/:id` 前面

NestJS 这类路由里，如果先声明：

```ts
@Get(':id')
getById() {}
```

再声明：

```ts
@Get('summary')
summary() {}
```

`/background-jobs/summary` 可能被 `:id` 吃掉，变成查 id 为 `summary` 的 job。

所以 controller 里 summary 必须在 `:id` 前面。这是很典型的 REST 路由优先级问题，面试里可以顺手提一句，说明你不只是写接口，也会考虑框架匹配细节。

### 问题三：前端 helper 测过了，但页面接线仍可能用错

这次子代理审核发现一个真实问题：helper 里已经支持“summary 有 active job 时继续轮询”，但页面最初调用时传的是固定 `undefined`：

```ts
getBackgroundJobSummaryPollInterval({
  summary: undefined,
  shouldPollProcessingState,
  pollIntervalMs: 2000,
});
```

结果是第一次请求 summary 如果返回 `activeCount > 0`，页面也不会因为 summary 自身 active 而继续轮询。UI 可能一直停在“后台处理中”。

修法是保存最近一次 summary，作为下一次 refetch interval 判断依据：

```ts
const [backgroundJobSummaryForPolling, setBackgroundJobSummaryForPolling] =
  useState<BackgroundJobSummaryResponse>();

const backgroundJobSummaryQuery = useBackgroundJobSummary({
  enabled: documents.length > 0 || shouldPollProcessingState,
  refetchInterval: getBackgroundJobSummaryPollInterval({
    summary: backgroundJobSummaryForPolling,
    shouldPollProcessingState,
    pollIntervalMs: processingPollIntervalMs,
  }),
});

useEffect(() => {
  if (backgroundJobSummaryQuery.data) {
    setBackgroundJobSummaryForPolling(backgroundJobSummaryQuery.data);
  }
}, [backgroundJobSummaryQuery.data]);
```

这类问题很适合复盘：单测覆盖 helper 不等于集成一定正确。尤其是 React Query 的轮询配置，页面接线也要被 review。

### 问题四：summary 字段语义不能误导 UI

最开始 `activeCount` 是从最近 50 条任务里算出来的：

```ts
activeCount: items.filter((job) => job.status === 'QUEUED' || job.status === 'ACTIVE').length
```

这和 UI 文案“还有 N 个后台任务正在排队或处理中”不完全一致。因为“还有”听起来是全局真实数量，不是“最近 50 条里还有”。

最后改成数据库真实 count，避免旧 active job 被隐藏。这里背后的原则是：字段名、接口语义和 UI 文案必须对齐。否则代码没报错，但产品会误导用户。

## 这轮测试怎么做

这次测试主要覆盖工程链路，不需要真实模型。

原因是 Phase 7.3 没有改 Chat prompt、RAG prompt、TutorAgent 输出或 live model provider。真实模型验收应该用在“最终回答体验变了”的场景，而不是每个后台任务 API 都调用一次模型。

重点测试包括：

```powershell
bun packages/types/tests/background-job.test.mts
bun --filter @repo/server test -- background-jobs
bun --filter @repo/server test -- event-bus
bun --filter @repo/web test -- background-job
bun --filter @repo/web test -- background-job-view
bun --filter @repo/web build
```

另外收尾时还要跑：

```powershell
bun --cwd packages/types typecheck
bun --filter @repo/server build
bun --filter @repo/web build
git diff --check
```

如果要做浏览器 smoke，重点看 `/knowledge`：

- 有后台任务时是否显示摘要提示。
- 处理完成后是否停止活跃轮询。
- 删除、替换、处理资料后是否仍能正常刷新。
- 页面不要因为静态 `PENDING` 资料无限请求。

## 面试可以怎么讲

可以按这个结构讲：

第一层，问题背景：

> 我们的知识库处理从同步接口迁到了 BullMQ 后台队列。队列解决了接口超时，但没有自动解决“用户怎么知道任务状态”和“开发者怎么观察失败”的问题，所以我补了 BackgroundJob 控制面和事件可观测小闭环。

第二层，核心设计：

> BackgroundJob 以 PostgreSQL 为权威来源，只保存任务状态和脱敏 metadata。前端通过 `/background-jobs/summary` 获取账号级摘要，而不是自己拉一堆任务做复杂判断。EventBus 先做进程内事件分发，明确不承诺跨进程可靠投递，后续如果要可靠事件会升级 durable outbox。

第三层，边界意识：

> 我们特别限制了日志和任务表里不能保存完整 prompt、回答、RAG chunk、API key、token。EventBus handler 失败只记录事件类型和计数，不 dump payload。

第四层，踩坑和修复：

> 子代理 review 发现页面虽然有轮询 helper，但传入的 summary 固定是 undefined，导致 active job 不能靠 summary 自身持续轮询。我修成保存 latest summary 参与 interval 判断。另一个问题是 activeCount 不能只统计最近 50 条，否则旧的卡住任务会被隐藏，所以改成数据库真实 count。

第五层，为什么没有做 live 模型验收：

> 因为这轮不改 Chat 输出链路。mock / unit / build 能覆盖后台任务和 UI 工程链路；只有改 prompt、RAG 引用或 Tutor 输出时才做 live smoke。这样既控制成本，也避免把模型质量验收和工程链路验收混在一起。

## 下一步可以怎么演进

Phase 7.3 是“小而稳”的一层，不是终点。后续可以继续做：

- Swagger / OpenAPI：把核心 REST contract 文档化，方便联调和面试展示。
- Worker-only 部署：API 进程和 worker 进程真正拆开，并加 health check。
- Durable outbox：当事件需要跨进程可靠投递时，把 in-process EventBus 升级为持久化 outbox。
- Metrics：把任务成功率、失败率、平均耗时、队列积压数接入 Prometheus / Grafana。
- 更多后台任务：OCR 批处理、批量 embedding、PDF 解析、复习提醒调度都可以走同一套控制面。

这次最大的收获是：后台任务工程化不是“用了队列”就结束了。真正能上线的链路，至少要能回答三件事：任务现在在哪、失败了有没有安全可见的线索、用户界面会不会因为不知道状态而卡住。
