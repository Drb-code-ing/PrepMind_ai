# Worker Readiness：为什么 `/health` 不能证明后台任务能跑

这篇文章复盘 PrepMind AI 的 Phase 7.11。它做的不是一个用户能直接点到的新功能，而是一个很典型的工程化能力：

> API 进程活着，不代表后台 worker 能消费任务。那部署前怎么判断 worker 链路真的 ready？

这个问题很适合面试讲，因为它能把后台任务、队列、心跳、outbox、CLI 退出码和部署检查串起来。

## 先说结论

Phase 7.11 增加了两种 Worker Readiness 入口：

```text
GET /worker-readiness
bun --filter @repo/server readiness:worker
```

它们回答同一个问题：当前后台 worker 链路是否可以接任务。

最终状态只有三类：

| 状态 | 含义 |
| --- | --- |
| `ready` | 依赖和后台链路都正常，可以通过 readiness |
| `degraded` | 能读到依赖，但存在风险，比如 failed jobs、inline 模式下还有历史 backlog |
| `not_ready` | 关键依赖或 worker 链路不满足当前模式要求，不建议接任务 |

CLI 退出码也对应这个语义：

| 退出码 | 含义 |
| --- | --- |
| `0` | ready |
| `1` | degraded 或 not_ready |
| `2` | CLI 自己异常、配置错误或依赖超时 |

开发人员平时可以这样跑：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:REDIS_URL='redis://127.0.0.1:6379'
$env:KNOWLEDGE_PROCESSING_MODE='queue'
$env:SERVER_ROLE='worker'
bun --filter @repo/server readiness:worker
$LASTEXITCODE
```

注意，退出码不是用户输入的，是命令结束后程序返回给终端的结果。

## 问题从哪里来

PrepMind 在 Phase 7 里逐步把知识库处理从同步接口升级成了后台任务：

- `BullMQ` 负责文档处理队列。
- `worker` 进程负责解析文档、embedding、写 chunk。
- `BackgroundJob` 负责用户可见任务状态。
- `Worker Observability` 负责开发者看 worker、queue、recent jobs。
- `Durable Outbox` 负责可靠内部事件。

这时候只看 `/health` 就不够了。

`/health` 通常只能说明 API HTTP 进程还活着，比如：

```text
GET /health -> 200 OK
```

但它回答不了：

- Redis 是否连得上？
- BullMQ 队列是否暂停？
- 队列里是否有 backlog？
- worker heartbeat 是否在线？
- outbox 是否有 dead-letter？
- queue 模式下是否有任务却没人消费？

也就是说，API 活着不等于后台任务能跑。

## 三个入口的区别

Phase 7.11 里我们把三个健康入口的职责拆清楚了。

| 入口 | 给谁用 | 回答什么问题 |
| --- | --- | --- |
| `/health` | HTTP liveness / 负载均衡 | API 进程是不是活着 |
| `/worker-observability/summary` | 开发者 / 排障 | 队列、worker、BackgroundJob、outbox 的详细观测信息 |
| `/worker-readiness` / CLI | 部署系统 / 脚本 / 本地验收 | worker 链路能不能接任务 |

`/worker-observability/summary` 更像“人看的仪表盘”。它的信息更细，适合你排查为什么失败。

`/worker-readiness` 更像“机器看的结论”。它不需要把所有细节都暴露出来，只需要给出清楚的 readiness 判断。

## Readiness 检查了哪些信号

这次的 `WorkerReadinessService` 组合了四类信号。

### 1. Redis / BullMQ 是否可读

BullMQ 的 queue counts 和 worker heartbeat 都依赖 Redis。如果 Redis 不可读，在 queue 模式下基本就不能认为 worker 链路 ready。

服务里会读 queue counts：

```ts
const [counts, isPaused] = await Promise.all([
  queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'paused'),
  queue.isPaused(),
]);
```

这些 counts 会进入 readiness 输出：

```text
waiting
active
delayed
failed
paused
```

### 2. Queue 是否暂停或积压

队列暂停是很危险的状态。哪怕 worker 在线，暂停队列也意味着不会正常消费。

简化逻辑是：

```ts
if (queuePaused) {
  return {
    status: knowledgeProcessingMode === 'queue' ? 'fail' : 'warn',
    message: 'Queue is paused.',
  };
}
```

这里有一个细节：同样是 queue 异常，在 `queue` 模式和 `inline` 模式的严重程度不同。

- `queue` 模式：用户请求会投递 BullMQ，队列不可用就是硬失败。
- `inline` 模式：业务主链路不投递 BullMQ，队列异常更像环境风险或历史任务清理问题。

所以 readiness 不能只做一个死板判断，要结合当前处理模式。

### 3. Worker heartbeat 是否在线

Phase 7.7 已经做过 worker heartbeat。worker / both 角色会定期往 Redis 写短 TTL 心跳。

readiness 会读取：

```ts
const keys = await redis.keys(`${prefix}:worker-heartbeat:*`);
const values = await redis.mget(...keys);
```

如果是 queue 模式，且队列有 backlog，但没有 worker heartbeat，这就是很明显的 `not_ready`：

```ts
if (hasBacklog && heartbeatCount === 0) {
  return {
    status: 'fail',
    message: 'Queue backlog exists but no worker heartbeat is online.',
  };
}
```

这就是 readiness 的核心价值之一：它能发现“任务在排队，但没人消费”。

### 4. Outbox 是否有 dead-letter

Phase 7.9 做了 durable outbox。outbox 里如果出现 `DEAD` event，说明自动重试已经耗尽，需要人处理。

readiness 会读取 outbox summary：

```ts
const summary = await outbox.getSummary(now);

if (summary.counts.dead > 0) {
  return {
    status: 'fail',
    message: 'Dead outbox events require operator attention.',
  };
}
```

pending / processing backlog 不一定是失败，可能只是正在处理；但 `DEAD` 是明确的风险。

## 状态怎么合成

每个检查项会给出 `pass / warn / fail`。最后再合成总状态：

```ts
function resolveOverallStatus(statuses: WorkerReadinessCheckStatus[]) {
  if (statuses.includes('fail')) return 'not_ready';
  if (statuses.includes('warn')) return 'degraded';
  return 'ready';
}
```

这个设计很朴素，但非常适合部署检查：

- 有任何硬失败，就不要接任务。
- 没有硬失败但有 warning，就允许继续但提醒风险。
- 全部 pass 才是 ready。

## 为什么要有 CLI

HTTP 接口适合 API 调试，但部署系统更喜欢命令行退出码。

比如部署脚本可以这样写：

```powershell
bun --filter @repo/server readiness:worker
if ($LASTEXITCODE -ne 0) {
  Write-Host "worker readiness failed, stop deployment"
  exit $LASTEXITCODE
}
```

这里的关键不是输出好不好看，而是退出码稳定。

这也是为什么 Phase 7.11 最后花了不少精力修 CLI。

## 这次 review 抓到的关键问题

最开始我们给 CLI 加了 timeout，但写法类似：

```ts
await Promise.race([readinessPromise, timeoutPromise]);
```

这个看起来没问题，但复审发现一个真实风险：`Promise.race` 只能让当前 await 结束，不能保证底层 Redis / Prisma / BullMQ 的连接句柄也结束。

换句话说，函数返回了，但 Node/Bun 进程可能还活着。

这对 CLI 来说是大问题。因为部署脚本要的是“命令能在固定时间内结束，并返回退出码”。如果它一直挂着，CI/CD 就会卡住。

所以最后修成：

```ts
export async function main(options: MainOptions = {}) {
  const exitCode = await runWorkerReadinessCli();
  if (options.exitProcess ?? true) {
    process.exit(exitCode);
  }

  process.exitCode = exitCode;
}
```

同时 cleanup 也加了 timeout：

```ts
await withWorkerReadinessTimeout(app.close(), timeoutMs);
```

这样坏 Redis / 坏 DB 时，真实 CLI 会在有界时间内退出，返回 `2`。

## 为什么 CLI 不能导入完整 AppModule

这是另一个很容易踩的坑。

如果 CLI 直接：

```ts
NestFactory.createApplicationContext(AppModule)
```

看起来省事，但会带来普通应用启动副作用，比如：

- BullMQ processor 被注册。
- worker heartbeat 开始写。
- outbox dispatcher runner 开始 tick。
- 其它 module lifecycle 被触发。

readiness CLI 本来只是检查环境，不能因为跑检查就开始消费任务。

所以这次单独做了 `WorkerReadinessCliModule`，只导入最小只读依赖：

```ts
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    JobsModule,
    BullModule.registerQueue({ name: PROCESS_KNOWLEDGE_DOCUMENT_QUEUE }),
  ],
  providers: [
    OutboxMetricsService,
    {
      provide: WorkerReadinessService,
      inject: [
        getQueueToken(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE),
        OutboxMetricsService,
        ConfigService,
      ],
      useFactory: (queue, outbox, config) =>
        new WorkerReadinessService(queue, outbox, config),
    },
  ],
  exports: [WorkerReadinessService],
})
export class WorkerReadinessCliModule {}
```

这个 module 不导入 `AppModule`，不注册 HTTP controller，不启动 worker processor，也不启动 outbox dispatcher。

这点面试里很好讲：健康检查应该是只读的，不能产生业务副作用。

## 为什么要 suppress raw dependency error

CLI 失败时不能把所有错误原样打印出来。

原因很简单：依赖库的错误里可能带：

- `DATABASE_URL`
- `REDIS_URL`
- token
- cookie
- API key
- 供应商错误正文
- 其它内部拓扑信息

readiness 的输出应该是受控摘要，而不是把底层异常 dump 给终端。

所以 CLI 失败时只输出：

```text
Worker readiness CLI failed: unexpected script/config/timeout failure.
```

cleanup 失败时也只输出：

```text
Worker readiness CLI cleanup failed.
```

不会打印 raw `AggregateError`、连接串或完整错误对象。

## 子进程测试为什么重要

这次不是只测一个 helper 函数，而是补了真实子进程级测试。

测试思路是：

1. 启动一个真实 CLI 子进程。
2. 给它坏的 `DATABASE_URL` 和 `REDIS_URL`。
3. 设置很短的 `WORKER_READINESS_CLI_TIMEOUT_MS`。
4. 断言它在固定时间内自己退出。
5. 断言退出码是 `2`。
6. 断言输出里没有敏感词和 raw error。

这种测试比单纯 mock promise 更有价值，因为它能覆盖真实 CLI 进程、Bun script、Nest bootstrap 和残留句柄问题。

简化后的断言大概是：

```ts
expect(result.timedOut).toBe(false);
expect(result.exitCode).toBe(2);
expect(result.output).toContain(
  'Worker readiness CLI failed: unexpected script/config/timeout failure.',
);
expect(result.output).not.toContain('DATABASE_URL');
expect(result.output).not.toContain('REDIS_URL');
expect(result.output).not.toContain('AggregateError');
```

这就是 review 能帮我们抓住的问题：单元测试绿，不代表真实命令一定有界退出。

## HTTP 入口为什么要 feature gate

`GET /worker-readiness` 是诊断入口。它虽然不返回用户私有正文，但会暴露系统级状态，比如：

- Redis 是否可用。
- 队列是否积压。
- worker 是否在线。
- outbox 是否有 dead-letter。

这些都是运维信号，不适合 production 默认公开。

所以加了：

```text
WORKER_READINESS_ENABLED
```

规则是：

- 非 production 默认开启，方便本地开发。
- production 默认关闭。
- 关闭时在认证前返回 404。

这里“认证前 404”也很重要。它避免别人通过 401/403 判断“这里有一个诊断接口，只是我没权限”。

## 前端使用产品时为什么看不到退出码

这个问题很容易混淆。

用户在浏览器里点上传、处理资料、聊天时，不会看到 CLI 退出码。因为退出码只属于“某个终端命令结束后的结果”。

前端产品里应该看：

- `/knowledge` 的 worker 健康状态条。
- 请求接口返回的状态。
- 后端 server / worker 日志。

终端里才看：

```powershell
bun --filter @repo/server readiness:worker
$LASTEXITCODE
```

所以一句话：

> UI 看状态，CLI 看退出码。

## 这次为什么不需要真实模型验收

Phase 7.11 没有改：

- `/api/chat`
- RAG prompt
- TutorAgent 输出
- KnowledgeVerifierAgent guidance
- live / mock 模型路由
- 最终模型回答内容

所以不需要 live model smoke。

它应该用：

- contract 测试
- env 测试
- service 测试
- controller 测试
- CLI 子进程测试
- build
- eslint
- 手动坏依赖 smoke

这也是一个很重要的工程判断：不是所有阶段都要拉真实模型验收。改后台 readiness，用真实模型测反而抓不到重点。

## 面试可以怎么讲

如果面试官问“你们怎么判断 worker 可用”，可以这样回答：

> 我们没有只看 API `/health`，因为 API 活着不代表 worker 能消费任务。我们单独做了 Worker Readiness，组合 Redis / BullMQ queue counts、worker heartbeat 和 outbox summary，输出 ready / degraded / not_ready。HTTP 入口给受控诊断用，CLI 给部署脚本用，退出码 0/1/2 分别表示 ready、业务链路风险、脚本或依赖异常。

如果问“为什么不用 `/worker-observability/summary` 直接部署检查”，可以回答：

> Observability 是人看的，信息更细；readiness 是机器看的，结论更稳定。部署系统不应该解析一大堆排障字段，而应该依赖明确状态和退出码。

如果问“CLI 最大坑是什么”，可以回答：

> 最大坑是 timeout 不能只写 `Promise.race`。底层 Redis、Prisma、BullMQ 连接可能留下活动句柄，导致 CLI 函数返回但进程不退出。我们最后补了真实子进程测试，并在 CLI 主入口用 `process.exit(code)` 确保部署脚本能拿到有界退出码。

如果问“怎么避免 readiness 检查产生副作用”，可以回答：

> CLI 不导入完整 `AppModule`，而是用最小只读 `WorkerReadinessCliModule`。它只初始化配置、数据库、BullMQ queue client 和 outbox metrics，不启动 HTTP API、worker processor、heartbeat 或 outbox dispatcher。

如果问“为什么 production 默认关”，可以回答：

> Readiness 返回的是系统级运维信号，不是普通用户业务数据。即使经过认证，也不适合 production 默认暴露，所以用 `WORKER_READINESS_ENABLED` 控制，非生产默认开，生产默认关，关闭时认证前 404。

## 这一阶段真正的价值

Phase 7.11 的价值不是多了一个接口，而是把后台任务从“能跑”推进到“能被部署系统判断是否可接流量”。

它补齐了几个工程化关键点：

- API liveness 和 worker readiness 分离。
- 开发者观测面和机器检查面分离。
- queue / heartbeat / outbox 多信号聚合。
- queue 模式和 inline 模式使用不同严重度。
- CLI 有稳定退出码。
- CLI 坏依赖时有界退出。
- readiness 检查只读、无副作用。
- 输出不泄露 raw error 或敏感配置。

这类能力用户平时不一定看得见，但它会直接影响部署、排障和生产可靠性。真正工程化的系统，不只要在 happy path 回答正确，还要在依赖坏掉时清楚地告诉你：现在不能接任务，而且不会卡死在检查命令里。
