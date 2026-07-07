# Phase 7.9.3 Outbox Dispatcher Runner Design

## 背景

Phase 7.9.1 已经新增 `OutboxEvent` 持久化表和 `OutboxService` 状态机，Phase 7.9.2 已经新增 `OutboxDispatcherService` 和显式 handler registry。现在 outbox 事件可以被手动 claim、dispatch、mark succeeded 或 retry/dead-letter，但还缺少一个受控运行入口。

Phase 7.9.3 的目标是把 dispatcher 从“可调用服务”推进到“worker 进程可自动消费”，但不引入前端页面、HTTP API、Prometheus / Grafana 或复杂调度系统。

## 目标

- 新增 `OutboxDispatcherRunnerService`，在后台进程中按固定间隔调用 `OutboxDispatcherService.dispatchBatch()`。
- runner 只在 `SERVER_ROLE=worker | both` 且 `OUTBOX_DISPATCHER_ENABLED=true` 时运行；`api` 角色不启动。
- 默认非 production 开启，production 默认关闭，生产环境需要显式设置 `OUTBOX_DISPATCHER_ENABLED=true`。
- 支持配置 batch size、tick interval、lock timeout。
- 单进程内防重入：上一轮 dispatch 未完成时，下一轮 tick 直接跳过。
- 模块销毁时清理 timer，避免测试悬挂和进程关闭时残留。
- dispatcher 执行失败只记录 warning，不打断 worker 进程。

## 非目标

- 不新增 outbox HTTP API。
- 不新增 `/knowledge` 或管理后台 UI。
- 不新增 Prometheus / Grafana / OpenTelemetry 指标。
- 不新增 BullMQ repeatable job。
- 不迁移更多业务事件到 outbox。
- 不改变 Chat、RAG prompt、模型调用、KnowledgeVerifierAgent 或前端行为。

## 方案选择

### 方案 A：worker-only 定时 tick（采用）

在 server 进程内新增轻量 runner，复用 Nest lifecycle：`onModuleInit()` 启动一次立即 tick，然后 `setInterval()` 周期 tick；`onModuleDestroy()` 清理 timer。

优点是改动小、测试简单、贴合当前 `SERVER_ROLE=api | worker | both` 边界，也和 `WorkerHeartbeatService` 的实现风格一致。

### 方案 B：Nest Schedule

引入 `@nestjs/schedule` 或类似调度模块。语义更像 cron，但当前阶段只是一个固定间隔后台循环，新增依赖和全局调度心智偏重。

### 方案 C：BullMQ repeatable job

用 BullMQ 调度 outbox dispatcher。这样会把 outbox 消费依赖到 BullMQ 上，而 outbox 本身是为了补跨进程可靠事件缺口。当前阶段先避免这层耦合。

## 配置

新增 server env：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `OUTBOX_DISPATCHER_ENABLED` | 非 production 为 `true`，production 为 `false` | 是否启动 runner |
| `OUTBOX_DISPATCHER_INTERVAL_MS` | `5000` | tick 间隔 |
| `OUTBOX_DISPATCHER_BATCH_SIZE` | `20` | 单轮最多 claim 的事件数 |
| `OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS` | `300000` | 认为 `PROCESSING` 锁超时的时间 |

默认策略和 `WORKER_OBSERVABILITY_ENABLED` 类似：开发环境默认打开，生产环境需要显式开启。

## 模块设计

新增文件：

```text
apps/server/src/outbox/outbox-dispatcher-runner.service.ts
apps/server/src/outbox/outbox-dispatcher-runner.service.spec.ts
```

修改文件：

```text
apps/server/src/config/env.ts
apps/server/src/config/env.spec.ts
apps/server/src/outbox/outbox.module.ts
AGENTS.md
DEVLOG.md
docs/ai-behavior-acceptance.md
```

`OutboxDispatcherRunnerService` 通过 constructor options 支持单元测试，也通过 `ConfigService` 支持 Nest 注入：

```ts
type OutboxDispatcherRunnerOptions = {
  role: ServerEnv['SERVER_ROLE'];
  enabled: boolean;
  intervalMs: number;
  batchSize: number;
  lockTimeoutMs: number;
  workerId?: string;
  now?: () => Date;
  logger?: Pick<Logger, 'log' | 'warn' | 'debug'>;
};
```

Nest provider 使用 factory 创建 runner，和 `WorkerHeartbeatService` 保持同类风格。

## 运行行为

启动时：

1. 如果 `enabled=false`，不 dispatch，不启动 timer。
2. 如果 `role=api`，不 dispatch，不启动 timer。
3. 如果 `role=worker | both`，先执行一次 `tick()`，再按 `intervalMs` 周期执行。

每次 tick：

1. 如果已有 tick 正在运行，记录 debug 并跳过。
2. 调用：

```ts
dispatcher.dispatchBatch({
  workerId,
  limit: batchSize,
  lockTimeoutMs,
  now: now(),
});
```

3. dispatcher 抛错时 catch 并记录 warning，不让异常冒泡到 interval。

销毁时：

1. 如果 timer 存在，`clearInterval()`。
2. 不额外修改 outbox event 状态；未完成的 `PROCESSING` 事件由已有 lock timeout 机制重新 claim。

## 安全边界

- runner 不读取或写入 outbox payload，只调用 dispatcher。
- handler registry 仍由 Phase 7.9.2 的显式 map 控制。
- runner 日志只包含 workerId、计数或错误摘要，不打印 payload、prompt、文件内容、chunk、API key、cookie 或 access token。
- production 默认关闭，避免部署后未经确认就开始消费历史事件。

## 测试策略

单元测试覆盖：

- `api` 角色不启动。
- disabled 时不启动。
- `worker` 角色 enabled 时启动并立即 dispatch。
- dispatch 参数包含 workerId、batch size、lock timeout 和 now。
- 防重入：第一轮未完成时第二轮跳过。
- dispatcher 抛错时记录 warning 且不抛出。
- `onModuleDestroy()` 清理 timer。

环境变量测试覆盖：

- 非 production 默认开启。
- production 默认关闭。
- 显式 `OUTBOX_DISPATCHER_ENABLED=true/false` 可覆盖默认值。
- batch size、interval、lock timeout 的范围约束。

验证命令：

```powershell
bun --filter @repo/server test -- outbox-dispatcher-runner
bun --filter @repo/server test -- env
bun --cwd apps/server eslint src/outbox src/config
bun --filter @repo/server build
git diff --check
```

## 验收标准

- worker / both 角色可以自动消费 outbox。
- api-only 进程不会启动 outbox runner。
- 生产环境不显式开启时不会自动消费。
- 单进程不会因为 interval 重叠并发执行两轮 dispatcher。
- runner 失败不会导致进程崩溃。
- 文档明确本阶段没有新增 metrics dashboard、HTTP API、前端 UI 或 live 模型行为。

## 后续阶段

- Phase 7.9.4：outbox summary / metrics，展示 pending、processing、dead 数量和最近错误摘要。
- Phase 7.9.5：逐步把 succeeded / failed / stale skipped 等后台任务事件写入 outbox。
- 后续生产化阶段：按部署形态考虑容器 readiness、Prometheus 指标和告警规则。
