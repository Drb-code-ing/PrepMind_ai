# Phase 7.7 复盘：为什么 BackgroundJob 不等于 Worker 在线

这次 Phase 7.7 做的是 Worker Observability。它不是一个花哨功能，而是补上 Phase 7.6 拆分 API / worker 之后很现实的一个问题：

> 用户点了“处理资料”，任务进了队列。那我们怎么知道队列有没有积压？worker 到底在不在线？最近失败是任务问题，还是根本没人消费？

如果只看 `BackgroundJob`，其实回答不了这些问题。

## 问题从哪里来

Phase 7.6 之后，后端进程有了三种角色：

| 角色 | HTTP API | BullMQ worker |
| --- | --- | --- |
| `api` | 有 | 无 |
| `worker` | 无 | 有 |
| `both` | 有 | 有 |

这让部署边界更清楚了，但也带来一个新观察点：`worker` 进程不监听 HTTP，所以它没有 `/health`。API 进程能通过 `/health` 判断活着，worker 怎么看？

一开始我们有 `BackgroundJob`，它能记录任务状态：

- `QUEUED`
- `ACTIVE`
- `SUCCEEDED`
- `FAILED`
- `STALE_SKIPPED`

但 `BackgroundJob` 只能说明“这个账号最近有哪些任务，以及任务最后变成了什么状态”。它不能直接说明 worker 进程还活着。

举个例子：

- 有一个任务是 `QUEUED`，但没有 worker 在线，它会一直排队。
- 有 worker 在线，但任务解析失败，`BackgroundJob` 会变成 `FAILED`。
- 队列里有 waiting job，但当前用户的最近 50 条 BackgroundJob 里可能看不到。

所以我们需要把三类信号组合起来看。

## 三类信号分别回答什么

### 1. Queue counts：队列现在忙不忙

BullMQ 自己能告诉我们队列里有多少任务：

```ts
const counts = await queue.getJobCounts(
  'waiting',
  'active',
  'delayed',
  'completed',
  'failed',
  'paused',
);
```

它回答的是系统级问题：

- 有没有任务在等？
- 有没有任务正在处理？
- 有没有延迟任务？
- 最近失败数量是否增加？

注意它是系统级的，不是当前用户私有数据。也正因为如此，后面我们给 production 默认加了开关保护。

### 2. Worker heartbeat：worker 最近有没有出现过

worker-only 进程没有 HTTP `/health`，但它可以定期往 Redis 写一个短 TTL heartbeat：

```ts
await redis.set(
  `prepmind:worker-heartbeat:${workerId}`,
  JSON.stringify({
    workerId,
    serverRole: 'worker',
    queues: ['knowledge-document-processing'],
    startedAt,
    lastSeenAt: new Date().toISOString(),
  }),
  'EX',
  heartbeatTtlSeconds,
);
```

这类 heartbeat 的语义很简单：如果 key 还在，说明最近几十秒内 worker 写过心跳；如果 key 消失，说明 worker 可能挂了、卡死了，或者 Redis 连接有问题。

我们默认：

```text
WORKER_HEARTBEAT_INTERVAL_MS=15000
WORKER_HEARTBEAT_TTL_SECONDS=45
```

也就是每 15 秒写一次，45 秒没续上就视为离线。

### 3. BackgroundJob summary：当前账号最近任务怎么样

`BackgroundJob` 是用户视角的任务历史。它更适合回答：

- 我刚才点的资料处理任务到哪了？
- 最近有没有失败？
- 失败摘要是什么？
- 当前账号是否还有 active job？

它和 queue counts 的区别是：queue counts 是系统级队列负载，BackgroundJob summary 是账号级任务窗口。

## 三个信号怎么合成一个状态

Phase 7.7 里我们做了一个 `WorkerObservabilityService`，把三者合成 `healthy / degraded / attention / idle`。

核心优先级是：

```ts
if (queueBacklogWithoutWorker) {
  return 'attention';
}

if (queuePaused || hasRecentFailures) {
  return 'degraded';
}

if (queueMode && hasWorkerHeartbeat) {
  return 'healthy';
}

return 'idle';
```

翻译成人话：

- `attention`：队列里有待处理任务，但没检测到 worker 在线。这是最该看的一种。
- `degraded`：最近有任务失败，或者队列被暂停。worker 可能在线，但处理链路不健康。
- `healthy`：queue 模式下 worker 最近在线。
- `idle`：当前没明显问题，或者 inline 模式下 worker 本来不参与处理。

这里有两个容易漏掉的边界：

- `active` 也算队列活动。如果有 active job 但没有 heartbeat，不能显示成空闲。
- `paused` / `isPaused` 要进入降级判断。队列被暂停时，即使 worker 在线，也不能说后台处理健康。

这不是完美的生产监控，但它已经足够支撑本地调试、浏览器 smoke 和面试讲解。

## 为什么不直接给 worker 做 HTTP health

这是一个面试里很可能被问到的问题。

短答案：worker-only 第一版不监听 HTTP，所以不做 `/health` 是一致的。

如果为了 health 再给 worker 起一个 HTTP server，就会把 Phase 7.6 刚拆清楚的边界又揉回去。我们现在先用进程存活、日志、BullMQ、Redis heartbeat 和 BackgroundJob 状态判断健康。

后续真要生产化，可以继续加：

- CLI health check。
- BullMQ metrics。
- Prometheus exporter。
- 容器 readiness probe。
- dead letter queue。

但这些都比第一版 Redis heartbeat 更重，不适合作为本阶段的第一步。

## 这次审核里发现的安全问题

这次子代理审核抓到一个重要点：`/worker-observability/summary` 虽然有 `JwtAuthGuard`，但它返回的是系统级 queue counts 和 worker heartbeat。如果 production 长期开给所有登录用户，就会泄露一些运维信息，比如：

- 队列是否积压。
- worker 最近是否在线。
- 大致处理负载。
- worker id 和队列名。

这些不是业务隐私，但属于系统拓扑和负载信号，不应该默认给普通用户看。

所以最后加了开关：

```text
WORKER_OBSERVABILITY_ENABLED
```

规则是：

- 非 production 默认开启，方便本地调试。
- production 默认关闭。
- production 如果要临时诊断，必须显式设置 `WORKER_OBSERVABILITY_ENABLED=true`，并放在受控内网或临时窗口里使用。

Controller 里也做了 gate：

```ts
async summary(@CurrentUser() user: AuthenticatedUser) {
  if (!this.config.get('WORKER_OBSERVABILITY_ENABLED', { infer: true })) {
    throw new NotFoundException('Worker observability is disabled');
  }

  return this.service.getSummary(user.id);
}
```

这里返回 `404` 而不是把详细原因暴露出去，是为了弱化“这里有一个被关掉的运维接口”的信号。

## 前端为什么也要调整轮询

一开始 `/knowledge` 的健康状态条只在文档 `PROCESSING` 或本地刚触发处理时轮询。这个逻辑对 BackgroundJob summary 足够，但对 Worker Observability 不够。

因为可能出现这种情况：

- summary 已经显示 queue waiting > 0；
- 但当前文档列表暂时还没刷新成 `PROCESSING`；
- 如果此时停止轮询，用户看到的状态就会陈旧。

所以我们补了一个 helper：

```ts
export function getWorkerObservabilityPollInterval(
  summary: WorkerObservabilitySummaryResponse | undefined,
  isPollingProcessingState: boolean,
  pollIntervalMs: number,
) {
  if (isPollingProcessingState) return pollIntervalMs;
  if (!summary) return false;

  const hasQueueActivity =
    summary.queue.counts.waiting > 0 ||
    summary.queue.counts.active > 0 ||
    summary.queue.counts.delayed > 0 ||
    summary.queue.counts.paused > 0;

  if (hasQueueActivity || summary.backgroundJobs.activeCount > 0) {
    return pollIntervalMs;
  }

  return false;
}
```

这样只要 summary 自己还显示有队列活动或账号级 active job，就继续短轮询；真正空闲时才停下来。注意我们没有让“只有历史失败”也持续 2 秒轮询，因为那会把一个已经稳定的失败提示变成无限刷新。

## 这块怎么在面试里讲

可以这么说：

“我们把知识库处理从同步接口升级到了 BullMQ 后台队列，又把 API 和 worker 进程拆开。拆开之后，BackgroundJob 只能说明某个账号的任务状态，不能说明 worker 是否在线。所以我做了一个轻量 Worker Observability：worker / both 角色通过 BullMQ Redis 连接写短 TTL heartbeat，API 聚合 BullMQ queue counts、worker heartbeat 和 BackgroundJob summary，输出 healthy / degraded / attention / idle。前端在知识库页面展示紧凑状态条，帮助本地调试和验收。”

如果面试官问“为什么不用 BackgroundJob 判断 worker 在线”，可以回答：

“BackgroundJob 是任务事实表，不是进程心跳。一个任务卡在 QUEUED，可能是 worker 不在线，也可能只是队列延迟；一个任务 FAILED，可能是解析失败，不代表 worker 挂了。所以要把任务状态、队列状态和 worker heartbeat 分开建模，再聚合展示。”

如果问“这个接口安全吗”，可以回答：

“它有登录校验，但因为 queue counts 和 heartbeat 是系统级运维信号，不适合 production 默认暴露给普通用户。所以我们加了 `WORKER_OBSERVABILITY_ENABLED`，非生产默认开，生产默认关；生产要临时诊断必须显式开启，并放在受控环境里。”

如果问“下一步怎么生产化”，可以回答：

“这版是轻量闭环，后续可以接 BullMQ metrics、Prometheus、CLI health check、容器 readiness、dead letter queue 和 durable outbox。现在先解决本地调试和工程边界可解释性，不一次性引入完整监控平台。”

## 这一阶段的价值

Phase 7.7 的价值不是多了一个页面小条，而是把后台任务观测拆成了清楚的三层：

- queue：系统现在有没有积压。
- worker heartbeat：消费者最近有没有活着。
- BackgroundJob：当前账号任务最近结果如何。

这就是工程化里很重要的一件事：不要把不同语义的信号混成一个万能字段。能分清事实来源，后面扩监控、排故和面试讲解都会顺很多。
