# Phase 7.7 Worker Observability 设计

## 背景

Phase 7.6 已经把 API / worker 启动角色拆开：

- `SERVER_ROLE=api`：启动 HTTP API，不注册 BullMQ worker processor。
- `SERVER_ROLE=worker`：只创建 Nest application context，不监听 HTTP 端口，只注册 worker processor。
- `SERVER_ROLE=both`：本地一体化模式，HTTP 与 worker 同进程。

拆分之后，下一个自然问题是：当知识库文档处理进入 queue 模式时，我们怎么判断 worker 是否真的在线、队列是否堆积、最近任务是否失败？

当前已有 `BackgroundJob` 和 `/background-jobs/summary`，可以看到账号级任务状态，但它只能回答“任务现在是什么状态”，不能直接回答“有没有 worker 进程在消费队列”。因此 Phase 7.7 需要补一个轻量 worker 可观测闭环。

## 目标

- 增加一个账号级 worker / queue summary API，帮助前端和开发者判断后台处理是否健康。
- 在 worker / both 进程中写入 Redis heartbeat，让 API 进程能判断最近是否有 worker 在线。
- 暴露 `document-processing` BullMQ 队列的安全计数摘要，例如 waiting / active / delayed / completed / failed。
- 在 `/knowledge` 页面展示一个轻量后台处理健康条，帮助用户理解“正在排队”“worker 未检测到”“最近任务失败”等状态。
- 保持文档处理业务语义不变，不改已有 `POST /knowledge/documents/:id/process` 的 inline / queue 行为。
- 新增文档继续使用语义文件名，不加日期前缀。

## 非目标

- 不接入 Prometheus / Grafana；这些属于 Phase 10 生产级观测。
- 不引入 dead letter queue；失败重试和死信策略后续单独设计。
- 不把 worker-only 改成监听 HTTP；`SERVER_ROLE=worker` 仍然不提供 `/health`。
- 不做公开、匿名或全局监控接口；本阶段 API 仍经过 `JwtAuthGuard`。
- 不在 heartbeat 中保存用户数据、文档内容、prompt、RAG chunk、API key、token 或 cookie。
- 不改变 BackgroundJob 表结构，优先复用现有任务状态和 Redis。

## 方案选择

### 方案 A：只复用 BackgroundJob summary

优点是改动最小，前端已经有任务摘要基础。缺点也很明显：当任务一直 `QUEUED` 时，它无法区分“任务很多但 worker 正在消费”和“根本没有 worker 在线”。

### 方案 B：Redis heartbeat + BullMQ queue counts（推荐）

worker / both 进程定期写 Redis heartbeat，API summary 读取 heartbeat 并结合 BullMQ `getJobCounts()` 和 BackgroundJob summary 生成健康信号。

优点是实现轻量、和当前 Redis / BullMQ 依赖一致，也能回答 Phase 7.6 拆分后最关键的问题：worker 进程是否在线。缺点是 heartbeat 不是持久审计，只表示最近在线状态。

### 方案 C：Prometheus / Grafana 指标化

最接近生产监控，但当前项目还没进入 Phase 10，过早引入会增加配置、部署和文档成本。它适合后续承接 Phase 7.7 的信号，而不是当前第一版。

本阶段采用方案 B。

## 后端设计

### Shared Contract

新增 `@repo/types/api/worker-observability`，定义 `workerObservabilitySummaryResponseSchema`。

建议响应结构：

```ts
type WorkerObservabilitySummaryResponse = {
  server: {
    role: 'api' | 'worker' | 'both';
    knowledgeProcessingMode: 'inline' | 'queue';
  };
  queue: {
    name: 'document-processing';
    counts: {
      waiting: number;
      active: number;
      delayed: number;
      completed: number;
      failed: number;
      paused: number;
    };
    isPaused: boolean;
    hasBacklog: boolean;
  };
  workers: {
    heartbeatTtlSeconds: number;
    onlineCount: number;
    latestHeartbeat: {
      workerId: string;
      serverRole: 'worker' | 'both';
      queues: string[];
      startedAt: string;
      lastSeenAt: string;
    } | null;
  };
  backgroundJobs: {
    activeCount: number;
    failedCount: number;
    staleSkippedCount: number;
    succeededCount: number;
    totalRecentCount: number;
    latestJob: BackgroundJobResponse | null;
  };
  signals: {
    status: 'healthy' | 'degraded' | 'attention' | 'idle';
    hasWorkerHeartbeat: boolean;
    queueModeWithoutWorker: boolean;
    queueBacklogWithoutWorker: boolean;
    hasRecentFailures: boolean;
    message: string;
  };
};
```

`message` 使用中文短句，便于前端直接展示，例如：

- `后台处理空闲。`
- `后台处理正常，worker 最近在线。`
- `已有待处理任务，但暂未检测到 worker 在线。`
- `最近有后台任务失败，请查看任务详情。`

### Redis Heartbeat

新增 worker heartbeat service，建议放在 `apps/server/src/worker-observability/`。

仅当 `SERVER_ROLE=worker | both` 时启用 heartbeat。`SERVER_ROLE=api` 不写 heartbeat。

Redis key 设计：

```text
prepmind:worker-heartbeat:<workerId>
```

如果配置了 `BULLMQ_PREFIX`，heartbeat key 可以使用同一 prefix 前缀，便于本地和测试隔离：

```text
<BULLMQ_PREFIX>:worker-heartbeat:<workerId>
```

heartbeat payload 只包含脱敏运行元数据：

```json
{
  "workerId": "hostname-pid-random",
  "serverRole": "worker",
  "queues": ["document-processing"],
  "startedAt": "2026-07-05T10:00:00.000Z",
  "lastSeenAt": "2026-07-05T10:00:15.000Z"
}
```

默认间隔和 TTL：

- `WORKER_HEARTBEAT_INTERVAL_MS=15000`
- `WORKER_HEARTBEAT_TTL_SECONDS=45`

TTL 约为心跳间隔的 3 倍，避免短暂 event loop 抖动导致误报。测试环境可以通过依赖注入使用 fake clock / fake Redis，不依赖真实等待。

### Queue Summary

新增 `WorkerObservabilityService`：

- 注入 BullMQ `Queue`：`PROCESS_KNOWLEDGE_DOCUMENT_QUEUE`。
- 调用 `queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused')`。
- 调用 `queue.isPaused()` 判断是否暂停。
- 调用 `BackgroundJobsService.getSummary(userId)` 复用账号级任务摘要。
- 调用 heartbeat repository 从 Redis 读取最近 worker heartbeat。

第一版只观测 `document-processing` 队列，因为当前 BullMQ 只服务知识库文档处理。后续新增 OCR / reminder / batch embedding 队列时，再扩展为多队列数组。

### API

新增 controller：

```text
GET /worker-observability/summary
```

要求：

- 经过 `JwtAuthGuard`。
- 不返回全局用户数据。
- Queue counts 是系统队列级指标，BackgroundJob summary 是当前账号级指标；文档需要明确这个边界。
- 不返回 Redis 连接串、hostname 之外的敏感环境信息、API key、token、cookie 或原始 job payload。

### 健康信号规则

第一版规则保持简单可解释：

```text
hasBacklog = waiting + delayed > 0
hasWorkerHeartbeat = onlineCount > 0
queueModeWithoutWorker = KNOWLEDGE_PROCESSING_MODE=queue && !hasWorkerHeartbeat
queueBacklogWithoutWorker = hasBacklog && !hasWorkerHeartbeat
hasRecentFailures = backgroundJobs.failedCount > 0 || queue.counts.failed > 0
```

状态优先级：

1. `attention`：`queueBacklogWithoutWorker=true`，提示有待处理任务但未检测到 worker。
2. `degraded`：`hasRecentFailures=true`，提示最近有失败任务。
3. `healthy`：queue 模式下有 worker heartbeat，且没有失败或明显堆积风险。
4. `idle`：inline 模式或没有队列任务时，提示后台处理空闲。

这不是生产 SLO，只是开发和产品内提示。后续接 Prometheus 后再引入更严谨的阈值。

## 前端设计

### 展示位置

在 `/knowledge` 页面新增一个轻量后台处理健康条，放在现有资料状态摘要和后台任务摘要附近。

展示内容：

- 状态文案：来自 `signals.message`。
- 小型计数：等待、处理中、失败。
- worker 状态：`worker 在线` / `暂未检测到 worker`。
- 最近任务失败时，引导用户查看已有后台任务摘要，不新建复杂详情页。

### UI 边界

- 不做独立监控大盘。
- 不展示原始 Redis key、workerId 全量细节或系统敏感配置。
- API 请求失败时不影响资料上传、处理、替换、删除和检索；只显示“后台健康状态暂不可用”。
- `KNOWLEDGE_PROCESSING_MODE=inline` 时，文案应避免吓用户：可以显示“当前为同步处理模式，队列 worker 不参与处理”。

## 数据流

```text
worker / both 进程启动
  -> WorkerHeartbeatService onModuleInit
  -> 每 15 秒写 Redis heartbeat，TTL 45 秒
  -> worker 退出或崩溃后 heartbeat 自动过期

用户打开 /knowledge
  -> GET /worker-observability/summary
  -> WorkerObservabilityService 读取 env role / processing mode
  -> BullMQ Queue getJobCounts + isPaused
  -> Redis 扫描 worker heartbeat
  -> BackgroundJobsService.getSummary(userId)
  -> 组合 signals
  -> /knowledge 展示后台处理健康条
```

## 测试策略

### packages/types

- 新增 schema 测试，确保 summary response 能 parse。
- 验证 `signals.status` 枚举和 heartbeat 字段边界。

### server 单元测试

- `WorkerHeartbeatService`：
  - `api` role 不写 heartbeat。
  - `worker` / `both` role 写 heartbeat，并设置 TTL。
  - payload 不包含敏感字段。
- `WorkerObservabilityService`：
  - 有 backlog 且无 worker heartbeat -> `attention`。
  - queue 模式有 heartbeat 且无失败 -> `healthy`。
  - 最近失败任务存在 -> `degraded`。
  - inline 模式无任务 -> `idle`。
- Controller 测试：
  - 接口经过 `JwtAuthGuard`。
  - 返回 schema 结构正确。

### web 测试

- `/knowledge` 健康条渲染：
  - worker 在线。
  - worker 未检测到且有排队任务。
  - 最近任务失败。
  - API 失败降级。

### 验收命令

```powershell
bun --cwd packages/types typecheck
bun packages/types/tests/worker-observability.test.mts
bun --filter @repo/server test -- worker-observability
bun --filter @repo/web test -- knowledge
bun --filter @repo/server build
bun --filter @repo/web build
git diff --check
```

如 Docker 可用，可补静态配置验收：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker config
```

本阶段不改 Chat prompt、RAG prompt、模型路由或真实模型调用链路，因此不需要 live 模型 smoke。

## 文档更新

实现完成后更新：

- `AGENTS.md`
- `DEVLOG.md`
- `docs/data-flow.md`
- `docs/dev-start.md`
- `docs/roadmap.md`
- 新增学习博客：`docs/blogs/phase-7-worker-observability.md`

博客重点讲：

- 为什么 BackgroundJob 不等于 worker 在线状态。
- 为什么 worker-only 不提供 HTTP health。
- Redis heartbeat 的取舍。
- Queue counts、heartbeat、BackgroundJob 三类信号如何互补。
- 面试中如何描述“从能跑到能观测”的工程化演进。

## 风险与边界

- Redis 不可用时，queue 模式本身也不可用；summary 应返回 degraded 或可解释错误，而不是让页面崩溃。
- heartbeat 只能证明最近有 worker 进程写过 Redis，不能证明某个 job 一定会成功处理。
- BullMQ completed / failed counts 可能是队列生命周期累计值；前端文案要避免把它解释成“当前账号失败数量”。当前账号维度仍以 BackgroundJob summary 为准。
- 多 worker 时第一版只展示 online count 和 latest heartbeat，不展开 worker 列表，避免 UI 和隐私边界复杂化。
- 这是产品内与开发调试可观测，不替代生产监控、告警、SLO 或供应商账单。
