# Phase 7.6 复盘：为什么要把 API 和 Worker 拆开

这次 Phase 7.6 做的事情不算“炫”，但很像真实项目里会被面试官追问的工程点：我们已经有 BullMQ 队列和 `SERVER_ROLE=api | worker | both`，那为什么还要继续拆？答案是：之前的角色只控制“是否注册 worker processor”，还没有真正控制“这个进程到底要不要监听 HTTP 端口”。

换句话说，之前 `SERVER_ROLE=worker` 名义上是 worker，实际上还是会启动 Nest HTTP server。这在本地不一定马上爆炸，但到了生产部署、扩容、容器健康检查、端口占用和故障隔离时，就会变成一个很别扭的隐患。

## 为什么 API 和 Worker 不应该总绑在一起

API 进程和 worker 进程解决的是两类问题。

API 进程主要处理用户请求：登录、上传资料、查询任务状态、打开 Swagger、访问 `/health`。它关注的是响应时间、接口稳定性和用户体验。

Worker 进程主要处理后台任务：文档解析、分块、embedding、写 chunk、更新 BackgroundJob 状态。它关注的是吞吐、重试、任务隔离和资源消耗。

如果两者一直绑在一个进程里，会有几个问题：

- API 扩容时会顺便扩容 worker，可能导致多个 API 进程一起抢队列任务。
- Worker 跑重任务时，CPU / 内存压力可能影响 HTTP 请求响应。
- 生产上想单独扩 worker 数量，或者临时停 worker，不够直接。
- `SERVER_ROLE=worker` 还占用 API 端口，部署语义和实际行为不一致。

所以这一步的重点不是“加一个新功能”，而是把之前已经预留的角色边界落到进程启动层。

## 我们这次发现的实际问题

之前 `apps/server/src/main.ts` 的逻辑很直接：

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<ServerEnv, true>);

  // cookie / CORS / filters / interceptors / Swagger ...

  await app.listen(config.get('PORT', { infer: true }));
}
```

问题就在最后一行：不管 `SERVER_ROLE` 是 `api`、`worker` 还是 `both`，都会 `listen(PORT)`。

同时 worker processor 的注册逻辑在模块层已经有了：

```ts
export function shouldRegisterWorkers(role: ServerEnv['SERVER_ROLE']) {
  return role === 'worker' || role === 'both';
}
```

也就是说，Phase 7.1 已经解决了“哪些角色注册 worker”，但还没解决“哪些角色启动 HTTP”。Phase 7.6 补的是后半段。

## 三种角色怎么分工

现在角色语义变成这样：

| 角色 | HTTP API | BullMQ worker | 使用场景 |
| --- | --- | --- | --- |
| `api` | 启动 | 不注册 | 生产 API 进程，只接用户请求 |
| `worker` | 不启动 | 注册 | 生产 worker 进程，只消费后台任务 |
| `both` | 启动 | 注册 | 本地开发最省事，一体化跑起来 |

这个设计比较务实：本地开发不强迫你开两个终端，仍然可以用 `both`；但生产或严肃验收时，可以明确拆成 API 和 worker 两个进程。

## NestJS 里为什么 worker-only 用 application context

NestJS 不只有 HTTP app。`NestFactory.create(AppModule)` 会创建带 HTTP adapter 的应用，后面通常会调用 `listen()`。

而 `NestFactory.createApplicationContext(AppModule)` 只初始化 Nest 容器、模块、provider 和生命周期 hook，不绑定 HTTP server。对于 worker-only 进程来说，这正好够用：BullMQ processor 是 Nest provider，模块初始化后就能注册队列消费者，不需要 HTTP adapter。

Phase 7.6 把启动逻辑拆成了 helper：

```ts
export function shouldListenHttp(role: ServerEnv['SERVER_ROLE']) {
  return role === 'api' || role === 'both';
}

export async function bootstrapServer(deps: BootstrapServerDependencies = {}) {
  const serverRole = deps.serverRole ?? resolveServerRole(process.env.SERVER_ROLE);

  if (!shouldListenHttp(serverRole)) {
    await (
      deps.createApplicationContext ??
      (() => NestFactory.createApplicationContext(AppModule))
    )();
    return;
  }

  const app = await (deps.createHttpApp ?? (() => NestFactory.create(AppModule)))();
  const config = app.get(ConfigService<ServerEnv, true>);

  configureHttpApp(app, config);

  await app.listen(config.get('PORT', { infer: true }));
}
```

这里有一个小但重要的工程习惯：启动逻辑本来很难测，所以我们给 `bootstrapServer()` 留了依赖注入参数。测试里可以传假的 `createHttpApp` 和 `createApplicationContext`，不用真的启动 Nest，也能验证 `worker` 不会调用 HTTP app。

## 这次怎么测试

测试先写行为，再写实现。核心断言是：

```ts
expect(shouldListenHttp('api')).toBe(true);
expect(shouldListenHttp('both')).toBe(true);
expect(shouldListenHttp('worker')).toBe(false);
```

然后验证 bootstrap：

```ts
await bootstrapServer({
  serverRole: 'worker',
  createHttpApp,
  createApplicationContext,
});

expect(createApplicationContext).toHaveBeenCalledTimes(1);
expect(createHttpApp).not.toHaveBeenCalled();
```

这类测试的价值是，它不是在测某个 mock 的细枝末节，而是在保护生产部署语义：worker-only 不能悄悄又把 HTTP 端口占起来。

## Docker Compose 怎么配合

默认本地开发仍然保持轻量：

```powershell
$env:SERVER_ROLE='both'
$env:KNOWLEDGE_PROCESSING_MODE='inline'
bun --filter @repo/server start:dev
```

如果想验证 API / worker 拆分，可以让 API 只负责投递任务，让 worker 消费队列：

```powershell
# API 进程
$env:KNOWLEDGE_PROCESSING_MODE='queue'
$env:SERVER_ROLE='api'
bun --filter @repo/server start:dev

# Worker 进程
$env:KNOWLEDGE_PROCESSING_MODE='queue'
$env:SERVER_ROLE='worker'
bun --filter @repo/server start:dev
```

Docker Compose 里也加了 `worker` profile。默认不会自动把 worker 拉起来，避免普通本地开发变重；需要拆分验证时再显式打开：

```powershell
$env:SERVER_ROLE='api'
$env:KNOWLEDGE_PROCESSING_MODE='queue'
docker compose -f docker/docker-compose.dev.yml --profile worker up -d postgres redis minio server worker
```

## 面试里怎么讲

这块可以这样表达：

“我们在 Phase 7 做了后台任务工程化。最开始先把文档处理从同步接口抽成 BullMQ 队列，并用 BackgroundJob 记录任务状态。后来发现 `SERVER_ROLE=worker` 只控制了 worker processor 注册，但启动入口仍然总是监听 HTTP，所以角色语义不完整。于是我把 Nest bootstrap 拆成可测试 helper：`api` 创建 HTTP app，不消费队列；`worker` 创建 application context，只消费队列；`both` 保留本地开发便利。这样 API 和 worker 可以独立扩缩容，也减少重任务对 HTTP 响应的影响。”

如果面试官继续问“为什么不直接所有进程都 both”，可以回答：

“本地可以 both，因为启动简单；生产不建议所有进程都 both。API 扩容通常是为了扛请求，不应该自动增加后台任务消费者，否则队列并发、数据库写入、embedding 调用和资源占用都会变得难控。拆开之后，API 数量和 worker 数量可以按不同指标扩容。”

如果问“worker 没有 `/health` 怎么办”，可以回答：

“这一版 worker-only 不监听 HTTP，所以没有 `/health`。健康判断先靠进程存活、日志、BullMQ 队列状态和 BackgroundJob 状态。后续如果部署到容器编排，可以补 CLI health check、BullMQ metrics 或单独的 readiness 探针，但不在这一步强行引入复杂设施。”

## 后续还可以怎么演进

Phase 7.6 是进程边界，不是后台任务体系的终点。后续可以继续做：

- BullMQ metrics：观察 waiting / active / failed / delayed job。
- Dead letter queue：多次失败后进入人工排查队列。
- Durable outbox：跨进程事件需要可靠投递时，用数据库 outbox 替代纯 in-process EventBus。
- Worker readiness：按部署平台补 CLI 或 metrics 型健康检查。
- 更多后台任务：OCR 批处理、批量 embedding、PDF 深度解析、复习提醒调度。

这一步的价值在于，它把系统从“能跑”往“能部署、能扩容、能讲清边界”推进了一格。对面试来说，这类改动很适合展示工程意识：不是只会写业务接口，也会处理进程角色、资源隔离、测试保护和渐进式生产化。
