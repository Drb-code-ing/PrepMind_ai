# Phase 7 Worker 部署拆分设计

## 背景

Phase 7.1 已经把知识库文档处理接入 BullMQ，并通过 `SERVER_ROLE=api | worker | both` 控制是否注册 worker processor。但当前 `main.ts` 不区分进程角色，无论 `SERVER_ROLE` 是什么都会启动 HTTP server。这会导致 `SERVER_ROLE=worker` 名义上是 worker，实际上仍然占用 API 端口，不利于生产部署、横向扩缩容和故障隔离。

同时，从本阶段开始，新建文档文件名不再使用日期前缀，改用语义文件名，方便在 `docs/blogs`、`docs/superpowers/specs` 和 `docs/superpowers/plans` 中查找。

## 目标

- `SERVER_ROLE=api`：启动 HTTP API，不注册 BullMQ worker processor。
- `SERVER_ROLE=worker`：只初始化 Nest application context，让 BullMQ worker 消费队列，不监听 HTTP 端口。
- `SERVER_ROLE=both`：保持本地开发兼容，既启动 HTTP API，也注册 worker processor。
- 把 bootstrap 逻辑拆成可测试的小函数，避免只能靠端到端启动验证。
- 更新本地启动、路线图、数据流和面试学习博客，讲清为什么要拆 API / worker 进程。

## 非目标

- 不引入 Kubernetes、Helm、PM2 或新的部署平台。
- 不重写 BullMQ 队列、重试策略、死信队列或 durable outbox。
- 不改变 `POST /knowledge/documents/:id/process` 的业务语义。
- 不改变 Chat、RAG prompt、模型路由或真实模型调用链路。
- 不批量重命名历史带日期的文档，避免破坏已有引用。

## 方案

新增一个 server bootstrap helper，把“是否监听 HTTP”和“是否只初始化 application context”从 `main.ts` 中拆出来：

- `shouldListenHttp(role)`：`api` 和 `both` 返回 `true`，`worker` 返回 `false`。
- `bootstrapServer()`：读取 `SERVER_ROLE`，创建 Nest app 或 application context。
- HTTP 模式下继续执行 cookie parser、CORS、全局 filter、全局 interceptor、Swagger setup 和 `app.listen(PORT)`。
- worker-only 模式下使用 `NestFactory.createApplicationContext(AppModule)`，不注册 HTTP adapter，不调用 `listen()`，只依赖模块初始化时注册的 BullMQ processor。

Worker provider 仍沿用已有 `shouldRegisterWorkers()`：

- `api` 不注册 processor，避免 API 进程抢队列任务。
- `worker` / `both` 注册 processor。

## 健康检查与可观测边界

第一版 worker-only 进程不提供 HTTP `/health`，因为它本身不监听端口。可观测方式先保持简单：

- 启动日志明确打印当前 `SERVER_ROLE`。
- API 模式继续通过 `/health` 检查。
- worker 模式由进程存活、日志和 BullMQ / BackgroundJob 状态判断。

后续如果需要容器级 worker readiness，可以再补专门的 CLI health check 或 BullMQ metrics。

## 测试策略

- 为 bootstrap helper 写单元测试：
  - `worker` 不监听 HTTP。
  - `api` 和 `both` 监听 HTTP。
  - worker-only 模式不调用 HTTP app 的 cookie/CORS/Swagger 配置。
- 保留并扩展 worker role 测试：
  - `api` 不注册 workers。
  - `worker` / `both` 注册 workers。
- 运行服务端 build 和 server test。
- 如 Docker 可用，补一个 compose 配置静态检查；不强制在本阶段跑完整容器验收。

## 文档命名规范

从 Phase 7.6 开始，新文档使用语义文件名：

- 设计文档：`docs/superpowers/specs/phase-7-worker-split-design.md`
- 执行计划：`docs/superpowers/plans/phase-7-worker-split.md`
- 学习博客：`docs/blogs/phase-7-worker-split.md`

历史文档暂不批量改名。以后如果需要统一文档索引，可以单独做一次文档整理任务。
