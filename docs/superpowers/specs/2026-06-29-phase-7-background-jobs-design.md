# Phase 7 Background Jobs and Event Bus Design

## 背景

Phase 6.8 已经把 PrepMind 的多 Agent 主线补齐到一个比较稳的状态：`@repo/agent` 负责确定性 policy、route metadata、策略 prompt、资料核对、错题整理、复习建议、长期记忆候选和资料管理建议；真实模型调用仍只发生在 `/api/chat`，并由 mock/live 双开关保护。

接下来最明显的工程短板不在“再多加几个 Agent 名字”，而在长任务和事件化能力。RAG 文档处理现在仍由 `POST /knowledge/documents/:id/process` 同步完成：一次请求里要读 MinIO、解析 PDF/DOCX/TXT/Markdown、分块、embedding、写 pgvector，再更新 `Document` 状态。这条链路已经有 `status + storageKey + contentHash` 快照保护和 `SELECT ... FOR UPDATE` chunk 替换锁，但它仍然受 HTTP 请求生命周期、浏览器等待、重试体验和并发吞吐限制。

Phase 7 的核心目标是把这些“耗时、可重试、需要可观测”的工作移到后台任务控制面，同时用事件总线把处理完成、索引状态、建议刷新信号和 trace/job 摘要这类后续动作逐步解耦。第一版事件总线只做本进程内 typed event，不承诺跨进程必达；跨进程可靠事件需要 outbox。这个阶段不是要放开全自主 Agent，而是先补齐让 Agent 系统生产化所需的可靠工程底座。

## 设计原则

Phase 7 延续当前项目的保守边界：

- 工作流优先，Agent 自主循环后置。文档解析、embedding、索引更新本质是可靠工作流，不交给 LLM 决定循环次数。
- 每个长任务必须有强类型 payload、状态记录、幂等边界、重试上限和失败可见性。
- 后台任务只处理已授权、已归属当前用户的数据；worker 不能信任客户端传来的 `userId` 之外的资源归属。
- 事件总线先服务工程解耦，不作为跨服务最终一致性银弹；需要持久化语义的事件进入 outbox。
- RAG 和 Agent 相关任务不能保存完整 prompt、完整回答、完整 chunk 或 API key。
- `/api/chat` 仍是唯一 live 模型调用路径；Phase 7 worker 不直接调用真实聊天模型。
- 默认开发体验保持简单：没有 Redis 或没有启用 queue mode 时，保留 inline fallback。

## 目标

Phase 7 应完成这些能力：

1. 引入 BullMQ 后台任务基础设施，复用 Docker Redis。
2. 增加 `BackgroundJob` 持久化观测表，让前端和调试台能看到任务状态、失败原因和重试次数。
3. 第一条队列落在 RAG 文档处理：上传后或用户点击处理后提交 job，worker 后台解析、分块、embedding、写入 chunks。
4. `POST /knowledge/documents/:id/process` 保持兼容，同时在 queue mode 下返回已排队状态和 job metadata。
5. `/knowledge` 页面能展示资料正在排队、处理中、失败、完成，并轮询刷新文档与 job 状态。
6. 建立 typed event bus：先覆盖 knowledge document processing 的 requested / succeeded / failed / stale skipped 事件；第一版只承诺进程内解耦。
7. 为后续 Swagger/OpenAPI、Docker worker 拆分、生产健康检查和监控指标留出清晰扩展点。

## 非目标

Phase 7 第一轮不做这些事：

- 不让 `@repo/agent` 直接调用 live 模型。
- 不把 MemoryAgent 自动注入每次 Chat。
- 不自动合并、删除、重命名 RAG 资料。
- 不把 `KnowledgeDedupAgent / KnowledgeOrganizerAgent` 改成后台自动写库。
- 不把所有现有 API 一次性迁移到事件驱动。
- 不引入 Kafka；当前规模下 Redis + BullMQ + 可选 outbox 足够。
- 不把 fake embedding 的测试结果当成真实语义检索质量验收。

## 推荐方案

采用“BullMQ 队列 + BackgroundJob 状态表 + typed event bus + feature flag”的分层方案。

```text
用户点击处理资料
  -> POST /knowledge/documents/:id/process
  -> DocumentProcessingJobService 校验 userId / documentId / force
  -> DB transaction: claim Document(status=PROCESSING) + 创建 BackgroundJob(status=QUEUED)
  -> commit 后 BullMQ add(jobId=BackgroundJob.id)
  -> 返回 document + backgroundJob metadata
  -> /knowledge 轮询 document 和 job

BullMQ worker
  -> ProcessDocumentProcessor 收到 job
  -> 条件更新并校验 BackgroundJob(status=QUEUED/ACTIVE -> ACTIVE)
  -> 校验 Document 仍属于 userId，且匹配 storageKey/contentHash snapshot
  -> DocumentProcessingService 使用 snapshot 执行解析/分块/embedding/replace chunks
  -> DONE: Document(status=DONE), BackgroundJob(status=SUCCEEDED)
  -> RETRYABLE FAILED: BackgroundJob 记录 attempt/error 后 rethrow，Document 保持 PROCESSING
  -> FINAL FAILED: attempts 耗尽或不可重试时 Document(status=FAILED), BackgroundJob(status=FAILED)
  -> STALE: 文档已被删除、状态不匹配或快照变化，旧 job 不写 chunks
```

这个方案比“继续同步请求”更适合生产，也比“一步到位全事件溯源”更轻。它先把最痛的长任务抽出来，并保留当前服务层里已经验证过的快照一致性逻辑。

## 为什么先做 RAG 文档处理

RAG 文档处理是最适合作为 Phase 7 第一刀的路径：

- 它天然耗时，涉及 IO、CPU、外部 embedding provider 和数据库 raw SQL。
- 它已有明确状态机：`PENDING -> PROCESSING -> DONE / FAILED`。
- 它已有安全快照：`storageKey + contentHash`。
- 它失败后可重试，且用户能理解“处理中 / 失败重试”的状态。
- 它会直接影响 Chat RAG、KnowledgeVerifierAgent、KnowledgeDedupAgent 和 KnowledgeOrganizerAgent，是 Agent/RAG 生产化的共同入口。

相比之下，ReviewTask 评分、WrongQuestion CRUD 仍适合同步事务；Chat streaming 更不适合放进 BullMQ，因为用户需要即时流式反馈。

## 架构分层

### JobsModule

`apps/server/src/jobs` 提供通用后台任务能力：

- Redis / BullMQ 连接配置。
- queue 注册。
- worker 是否启用的环境变量。
- `BackgroundJobService`：创建 job run、状态流转、查询当前用户任务。
- `BackgroundJobController`：只读查询 job 状态。
- `JobEventPublisher`：把状态变化发布到 typed event bus。

第一版可以在 NestJS server 进程内启用 worker；生产部署时再拆成独立 worker 进程：

```text
same image:
  server container -> HTTP API only
  worker container -> BullMQ processors only
```

### Knowledge Processing Job

`apps/server/src/knowledge-documents/jobs` 提供资料处理 job：

- `process-document.job.ts`：queue name、job name、payload schema。
- `process-document.producer.ts`：校验权限、claim document、创建 BackgroundJob、提交 BullMQ。
- `process-document.processor.ts`：读取 payload、执行处理、更新状态。
- `process-document.events.ts`：输出领域事件。

现有 `DocumentProcessingService` 不应被复制一份。它要拆成两个层次：

- public `processDocument(userId, documentId, options)`：保留 inline mode 的兼容入口，和当前行为一样，业务或技术失败会标记 `Document=FAILED`。
- internal `runProcessingPipeline(input)`：只执行读对象、解析、分块、embedding、replace chunks、mark done；它不在 catch 中自动 mark failed。
- queue wrapper `processQueuedDocument(input)`：给 BullMQ worker 使用，负责判断错误是否可重试；可重试且 attempts 未耗尽时只更新 `BackgroundJob` 并 rethrow，只有最终失败才按 snapshot 标记 `Document=FAILED`。

这样同步和异步共用同一套解析、分块、embedding、chunk replace 和 mark done 逻辑，但失败落状态由 inline wrapper 或 queue wrapper 分别处理。

### Event Bus

第一版使用进程内 typed event bus，事件结构在 `apps/server/src/events` 中集中定义。事件先服务模块解耦和测试，不承诺跨进程必达，也不直接驱动浏览器端缓存刷新；前端仍通过 TanStack Query invalidation 和 polling 观察状态。

需要跨进程、可恢复或审计的事件，写入 `OutboxEvent` 表后再由 worker 发布。Outbox 可以作为 Phase 7.2，不阻塞 Phase 7.1 的 RAG queue。

推荐事件：

```ts
type KnowledgeDocumentProcessingRequested = {
  type: 'knowledge.document.processing.requested';
  userId: string;
  documentId: string;
  backgroundJobId: string;
  contentHash: string | null;
  storageKey: string;
  requestedAt: string;
};

type KnowledgeDocumentProcessingSucceeded = {
  type: 'knowledge.document.processing.succeeded';
  userId: string;
  documentId: string;
  backgroundJobId: string;
  chunkCount: number;
  durationMs: number;
  finishedAt: string;
};

type KnowledgeDocumentProcessingFailed = {
  type: 'knowledge.document.processing.failed';
  userId: string;
  documentId: string;
  backgroundJobId: string;
  errorCode: string;
  retryable: boolean;
  finishedAt: string;
};

type KnowledgeDocumentProcessingStaleSkipped = {
  type: 'knowledge.document.processing.stale_skipped';
  userId: string;
  documentId: string;
  backgroundJobId: string;
  reason: 'document_missing' | 'snapshot_changed' | 'status_not_processing' | 'job_not_active';
  skippedAt: string;
};
```

事件 payload 不放文档正文、不放 chunk 全文、不放 embedding 向量。

## 数据模型

新增 `BackgroundJob`：

```prisma
model BackgroundJob {
  id             String              @id @default(cuid())
  userId         String
  queueName      String
  jobName        String
  bullJobId      String?             @unique
  status         BackgroundJobStatus @default(QUEUED)
  resourceType   String
  resourceId     String
  idempotencyKey String?
  dedupeKey      String?
  attempt        Int                 @default(0)
  maxAttempts    Int                 @default(3)
  progress       Int                 @default(0)
  payloadHash    String?
  payloadPreview Json?
  resultSummary  Json?
  errorCode      String?
  errorMessage   String?             @db.Text
  requestedAt    DateTime            @default(now())
  startedAt      DateTime?
  finishedAt     DateTime?
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status, createdAt])
  @@index([userId, resourceType, resourceId, createdAt])
  @@index([queueName, status, createdAt])
  @@index([dedupeKey])
}

// 同时在 User model 中增加：
// backgroundJobs BackgroundJob[]

enum BackgroundJobStatus {
  QUEUED
  ACTIVE
  SUCCEEDED
  FAILED
  CANCELLED
  STALE_SKIPPED
}
```

字段说明：

- `resourceType/resourceId` 用于把 job 关联到 `KNOWLEDGE_DOCUMENT` 等业务资源。
- `idempotencyKey` 用于同一处理请求的重复提交兜底，推荐格式为 `knowledge-process:${userId}:${documentId}:${storageKey}:${contentHash}:${force}`。
- `dedupeKey` 用于服务端判断同一资源是否已有 active job，推荐格式为 `knowledge-process-active:${userId}:${documentId}`。
- `payloadPreview` 只保存脱敏元数据，例如 documentId、contentHash、force，不保存正文。
- `resultSummary` 保存 chunkCount、durationMs、provider mode 等可观测摘要。
- `errorMessage` 需要裁剪长度，不能写入 secret、完整 prompt 或完整文档内容。

Prisma 不能直接表达 active job 的 partial unique index，需要 raw SQL migration：

```sql
CREATE UNIQUE INDEX "BackgroundJob_active_dedupeKey_unique"
ON "BackgroundJob"("dedupeKey")
WHERE "status" IN ('QUEUED', 'ACTIVE');
```

这样同一个用户的同一份资料在 `QUEUED / ACTIVE` 期间只能有一个处理 job。历史 `SUCCEEDED / FAILED / STALE_SKIPPED` 记录可以保留，不阻止用户后续重新处理。

后续如果事件需要持久化，再新增 `OutboxEvent`：

```prisma
model OutboxEvent {
  id            String   @id @default(cuid())
  type          String
  aggregateType String
  aggregateId   String
  userId        String?
  payload       Json
  status        String   @default("PENDING")
  attempts      Int      @default(0)
  nextAttemptAt DateTime?
  publishedAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([status, nextAttemptAt])
  @@index([aggregateType, aggregateId, createdAt])
  @@index([userId, createdAt])
}
```

## Job Payload Contract

资料处理 job payload：

```ts
export const processKnowledgeDocumentJobPayloadSchema = z
  .object({
    backgroundJobId: z.string().min(1),
    userId: z.string().min(1),
    documentId: z.string().min(1),
    force: z.boolean().default(false),
    snapshot: z.object({
      storageKey: z.string().min(1),
      contentHash: z.string().nullable(),
    }),
    requestedAt: z.string().datetime(),
  })
  .strict();
```

worker 执行前第一关必须条件更新并校验 `BackgroundJob`：

- `backgroundJob.id` 等于 payload backgroundJobId。
- `backgroundJob.userId` 等于 payload userId。
- `backgroundJob.resourceType === 'KNOWLEDGE_DOCUMENT'`。
- `backgroundJob.resourceId` 等于 payload documentId。
- `backgroundJob.status` 必须是 `QUEUED` 或 `ACTIVE`，然后进入 `ACTIVE`。
- 如果 job 已经是 `CANCELLED / SUCCEEDED / FAILED / STALE_SKIPPED`，worker 不能触碰 `Document` 或 `Chunk`。

第二关才重新读取当前 `Document`，并检查：

- `document.id` 等于 payload documentId。
- `document.userId` 等于 payload userId。
- `document.status === PROCESSING`。
- `document.storageKey === snapshot.storageKey`。
- `document.contentHash === snapshot.contentHash`。

任一不满足，旧 job 进入 `STALE_SKIPPED`，不能清 chunks、不能写 DONE/FAILED 覆盖当前资料。若文档已被删除，job 也进入 `STALE_SKIPPED(document_missing)`；这不是用户可见的资料处理失败。

## 幂等与并发

资料处理的关键并发规则：

1. 从 `PENDING / FAILED / DONE(force=true)` claim 到 `PROCESSING` 必须和 `BackgroundJob(QUEUED)` 创建放在同一个数据库事务里。
2. `dedupeKey` 有 active partial unique index，保证同一用户同一文档同一时间只有一个 `QUEUED / ACTIVE` job。
3. 如果文档已经是 `PROCESSING`，API 查询并返回已有 active job；如果极短窗口内未查到 job，返回 `409 KNOWLEDGE_DOCUMENT_PROCESSING`，前端继续刷新状态。
4. BullMQ `jobId` 使用 `BackgroundJob.id`，避免同一个状态记录对应多个队列任务。
5. `BullMQ add` 发生在 DB transaction commit 之后；如果 enqueue 失败，producer 按 snapshot 将 `Document` 标记为 `FAILED`，并把 `BackgroundJob` 标记为 `FAILED(ENQUEUE_FAILED)`，允许用户重新处理。
6. worker 可重复执行，但每次写 chunks 前都要通过 snapshot 条件和数据库行锁。
7. 当前仓库仍保持“`PROCESSING` 资料禁止替换上传”的边界；snapshot stale 主要防御删除、恢复、人工修复、队列延迟或后续版本放开 processing replace 时的旧 job 写回。
8. job failed 只更新同一 snapshot 的 document；不能把新版本或已删除资料标失败。

这套规则和当前同步处理链路是一致的，只是把请求中的长执行搬到了 worker。

## 重试与失败语义

BullMQ 配置建议分成 job options 和 worker/queue options，具体字段在实现时以当前 `bullmq` 版本为准：

```ts
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
  removeOnFail: { age: 60 * 60 * 24 * 7, count: 3000 },
};

const workerOptions = {
  concurrency: Number(process.env.KNOWLEDGE_PROCESSING_CONCURRENCY ?? 2),
  lockDuration: Number(process.env.KNOWLEDGE_PROCESSING_LOCK_DURATION_MS ?? 60000),
};
```

失败分类：

- 解析不到文本：业务失败，不应无限重试，`Document.status=FAILED`。
- MinIO 临时读取失败：可重试。
- embedding provider 429 / 5xx：可重试，并保留 attempts。
- schema validation 失败：不可重试，说明 producer 或代码有 bug。
- snapshot stale：不算用户失败，job 标 `STALE_SKIPPED`。

重试落状态规则：

- retryable 错误且 BullMQ 仍有剩余 attempts：`BackgroundJob.attempt/errorCode/errorMessage` 更新后 rethrow，`Document` 保持 `PROCESSING`，让下一次 retry 仍能通过 snapshot 校验。
- retryable 错误但 attempts 已耗尽：`BackgroundJob=FAILED`，并按 snapshot 将 `Document=FAILED`。
- non-retryable 业务错误：立即 `BackgroundJob=FAILED`，并按 snapshot 将 `Document=FAILED`。
- stale snapshot：`BackgroundJob=STALE_SKIPPED`，不修改 `Document`。

用户看到的错误文案仍然温和，例如“资料处理失败，请稍后重试”。详细错误码保存在 `BackgroundJob.errorCode`，用于调试和面试解释。

## API 设计

### 文档处理

保留：

```text
POST /knowledge/documents/:id/process
```

request 仍使用：

```ts
{ force?: boolean }
```

inline mode 返回现有 `KnowledgeDocumentResponse`。

queue mode 返回扩展响应：

```ts
type KnowledgeDocumentProcessResponse = KnowledgeDocumentResponse & {
  processing?: {
    mode: 'queue';
    backgroundJobId: string;
    status: 'QUEUED' | 'ACTIVE' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'STALE_SKIPPED';
    queuedAt: string;
  };
};
```

Phase 7.0/7.1 必须先更新 `packages/types/src/api/knowledge.ts` 的 `knowledgeDocumentProcessResponseSchema`，否则 Web 客户端会按旧 schema parse 并丢失 `processing.backgroundJobId`。这里的 `processing.status` 是 `BackgroundJobStatus`，不是 `Document.status`；`Document.status` 仍只使用 `PENDING / PROCESSING / DONE / FAILED`。

老前端忽略 `processing` 也不会破坏；新前端可以基于它启动轮询。

### Job 查询

新增只读 API：

```text
GET /background-jobs/:id
GET /background-jobs?resourceType=KNOWLEDGE_DOCUMENT&resourceId=:documentId&limit=10
```

约束：

- 必须 `JwtAuthGuard`。
- 只能读取当前用户自己的 jobs。
- 不返回完整 payload，只返回 `payloadPreview` 和 `resultSummary`。
- 默认按 `createdAt desc`。

第一版不提供取消和手动 retry API。用户继续通过资料卡片的“处理 / 重新处理”入口触发新 job。

## 前端设计

`/knowledge` 页面要做的是“状态可见”，不是做复杂任务中心。

页面行为：

- 用户点击处理后，资料卡片立刻显示 `PROCESSING` 或 `QUEUED`。
- 如果响应包含 `backgroundJobId`，保存到组件状态或 query cache。
- 对 `PENDING / PROCESSING` 文档开启短轮询，例如 2 秒一次，完成后停止。
- 对 active job 查询 `/background-jobs/:id`，展示 attempts、失败提示和最近状态。
- 上传、替换、处理完成、删除后失效：
  - document list/detail
  - knowledge search cache
  - knowledge agent suggestions
  - background job list for the document

移动端展示需要保持轻：

- 资料卡片状态 chip：排队中、处理中、处理失败、已入库。
- 失败状态显示短原因和重试入口。
- 不新增全屏任务中心，避免知识库页面变重。

## 配置

新增环境变量：

```text
REDIS_URL=redis://127.0.0.1:6379
BULLMQ_PREFIX=prepmind
SERVER_ROLE=both
KNOWLEDGE_PROCESSING_MODE=inline
KNOWLEDGE_PROCESSING_CONCURRENCY=2
KNOWLEDGE_PROCESSING_ATTEMPTS=3
KNOWLEDGE_PROCESSING_JOB_TIMEOUT_MS=120000
KNOWLEDGE_PROCESSING_LOCK_DURATION_MS=60000
KNOWLEDGE_PROCESSING_GLOBAL_RATE_LIMIT=30
KNOWLEDGE_PROCESSING_PER_USER_ACTIVE_LIMIT=2
EMBEDDING_REQUEST_TIMEOUT_MS=30000
```

默认：

- 本地开发默认 `inline`，避免 Redis 没启动时阻塞基础开发。
- `SERVER_ROLE` 可取 `api | worker | both`；本地 queue smoke 可用 `both`，生产建议拆成 `api` 和 `worker` 两个进程。
- Docker dev 文档推荐 queue mode 验收。
- production 不允许 fake embedding；queue mode 可作为生产推荐模式。

`KNOWLEDGE_PROCESSING_PER_USER_ACTIVE_LIMIT` 用于防止单个用户一次性提交大量 embedding 任务。第一版可以在 producer 查询当前用户 active jobs 后拒绝超限请求，后续再接 BullMQ limiter 或更细粒度配额。

## Swagger / OpenAPI

Phase 7 可以在后台任务稳定后补 Swagger：

- NestJS `/docs` 仅在 dev 或显式 `SWAGGER_ENABLED=true` 时开启。
- OpenAPI schema 覆盖 Auth、Knowledge、BackgroundJobs、Review、AgentTrace。
- 所有需要登录的接口标注 bearer auth。
- 不在 example 中放真实 token、API key、完整 prompt 或完整 chunk。

Swagger 的价值不是“好看”，而是让 Phase 7 后的长任务 API contract 更容易验收和面试讲解。

## Docker 与部署

当前 Docker Compose 已有 Redis。Phase 7 需要补齐：

- server 容器连接 `REDIS_URL=redis://redis:6379`。
- 可选新增 worker service，复用 server image。
- 新增 server scripts，例如 `start:worker` 和 `start:dev:worker`；当前仓库还没有这些脚本，不能在实现前写入启动文档当作既有命令。
- worker command 使用 `bun --filter @repo/server start:worker`，并通过 `SERVER_ROLE=worker` 启动只注册 processors 的 Nest context。
- health check 区分 HTTP API 健康和 worker queue 健康。

本地最小 queue 验收：

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:REDIS_URL='redis://127.0.0.1:6379'
$env:RAG_EMBEDDING_PROVIDER='fake'
$env:KNOWLEDGE_PROCESSING_MODE='queue'
$env:SERVER_ROLE='both'
bun --filter @repo/server start:dev
```

## Agent 架构影响

用户提供的 Agent 基础概念对 Phase 7 的直接启发是：不要把所有复杂性都塞进 LLM loop。

- ReAct 适合开放式推理；文档解析和 embedding 适合确定性后台 workflow。
- Multi-Agent 的中心化/流水线协作可以映射到生产工程：HTTP API 是 orchestrator，BullMQ worker 是 executor，EventBus 是低耦合通信层。
- 无限循环保护在后台任务里表现为 `attempts`、`backoff`、deadline、stale snapshot、最大并发，而不是让模型自己决定“再试一次”。
- State Schema 的思想落到 job payload：只保存核心变量，不把全量文档、全量 chunk 或全历史塞进任务。
- RAG 高频更新问题通过 queue + event + cache invalidation 解决，而不是让 Chat 每次临时扫描所有资料。
- Reflexion 在 Phase 7 更适合用于验收：worker 失败、RAG 引用异常、live smoke 不达标时沉淀成固定回归用例，而不是生产自动多轮自我重试。

因此 Phase 7 是 Agent 走向生产的基础设施阶段：它让长任务可靠、状态可见、失败可恢复，也让后续更自主的 Agent 能站在受控工作流之上。

## 测试策略

### 单元测试

- job payload schema：合法 payload、缺字段、空字符串、非法 datetime。
- producer：当前用户 ownership、PROCESSING 并发返回已有 job、force 行为、enqueue 失败回滚或标失败。
- processor：成功处理、解析失败、embedding 失败、snapshot stale、重复执行幂等。
- BackgroundJobService：状态流转合法性、错误信息裁剪、只读查询 user isolation。
- event bus：事件 payload 不含正文和 secret。

### 集成 / e2e

- Docker Redis + PostgreSQL + fake embedding 下完成上传、排队、worker 处理、DONE、search 命中。
- `PROCESSING` 资料替换上传返回 conflict，不允许覆盖正在处理的 snapshot。
- 人工制造 stale snapshot 或删除文档后，旧 job stale skip，不能写旧 chunks。
- 同一资料连续点击处理，只创建或返回一个 active job。
- PROCESSING 文档在 worker failed 后转 FAILED，并允许用户重新触发。

### 前端测试

- `useProcessKnowledgeDocument` 能解析 queue mode 扩展响应。
- `/knowledge` 对 PENDING/PROCESSING 文档启用轮询，DONE/FAILED 停止轮询。
- 处理完成后刷新资料列表、检索缓存和资料管理建议。
- 失败文案不撑破移动端卡片。

### 验收 smoke

1. 使用 fake embedding 上传一份 TXT。
2. 点击处理，前端显示排队或处理中。
3. worker 完成后资料变为 DONE，chunkCount 大于 0。
4. 手动检索能命中该资料。
5. 资料 `PROCESSING` 时尝试替换上传，接口返回 conflict，页面提示等待处理结束或失败后重试。
6. 人工触发 stale snapshot 测试时，旧 job 进入 `STALE_SKIPPED`，不写 chunks。
7. `/background-jobs` 只能看到当前用户任务。

## 分阶段落地

### Phase 7.0：Job Control Plane

- 引入依赖和 `JobsModule`。
- 添加 `BackgroundJob` schema、migration、共享 types。
- 添加 active dedupe partial unique raw SQL index。
- 添加只读 job API。
- 更新 `KnowledgeDocumentProcessResponse` contract，为 queue metadata 预留字段。
- 不改业务路径，先让 job 状态表和基础测试通过。

### Phase 7.1：Queued Knowledge Processing

- 拆分 `DocumentProcessingService` 的 claim 和 execution。
- 增加 document processing producer / processor。
- producer 事务内完成 Document claim 和 BackgroundJob 创建。
- processor 先校验 BackgroundJob，再校验 Document snapshot。
- 增加 job timeout、embedding request timeout、per-user active cap、stalled job 恢复测试。
- `KNOWLEDGE_PROCESSING_MODE=queue` 时走 BullMQ。
- `/knowledge` 支持 queue response 和轮询。

### Phase 7.2：Typed Event Bus and Outbox

- 建立 typed event bus。
- document processing 成功/失败发布事件。
- 需要跨进程可靠的事件进入 `OutboxEvent`。
- 先用于 cache invalidation、trace/job summary，不做复杂订阅链。

### Phase 7.3：OpenAPI and Production Diagnostics

- Swagger/OpenAPI。
- health endpoint 区分 Redis、DB、MinIO、embedding provider 配置。
- 文档更新 `docs/dev-start.md`、`docs/data-flow.md`、`AGENTS.md`。

### Phase 7.4：Worker Deployment Hardening

- Docker worker service。
- 并发、超时、attempts、retention 配置。
- 基础 Prometheus 指标预留：queue depth、success/fail count、duration。

## 风险与应对

| 风险 | 应对 |
| --- | --- |
| enqueue 成功但 DB job 未记录 | 先写 DB job，再用 `BackgroundJob.id` 作为 BullMQ jobId；enqueue 失败标记 job failed |
| DB claim 成功但 enqueue 失败导致文档卡死 PROCESSING | producer catch 中按 snapshot 将 Document 标 FAILED，并写 job error |
| claim 成功但并发请求查不到 active job | claim + job 创建放在同一 DB transaction；极短窗口 fallback 返回 409 并让前端刷新 |
| worker 重试重复写 chunks | replace chunks 继续使用 snapshot + row lock |
| 旧 worker 写回已变化资料 | 当前禁止 PROCESSING 替换上传；worker 执行前和写入前仍做双重 snapshot 校验，异常旧 job stale skip |
| Redis 未启动影响本地开发 | 默认 inline mode；queue mode 明确依赖 Redis |
| job error 泄露敏感内容 | error sanitizer 裁剪并过滤 key/token/cookie/prompt/chunk |
| 任务太多导致 embedding 成本失控 | concurrency、attempts、job timeout、per-user active cap、生产禁用 fake provider、后续增加更细 rate limit |

## 文档更新范围

实现完成后更新：

- `AGENTS.md`：Phase 7 当前状态、命令、环境变量、数据流边界。
- `docs/roadmap.md`：Phase 7.0/7.1 完成情况。
- `docs/data-flow.md`：inline mode 和 queue mode 两套 RAG 处理流。
- `docs/dev-start.md`：queue mode 启动命令和 Redis 检查。
- `docs/ai-behavior-acceptance.md`：说明后台任务不替代 live AI 小样本验收。
- `docs/dev-blog/2026-06-29-phase-7-background-jobs.md`：面试向学习博客。

## 验收标准

- `BackgroundJob` 表和 API 支持当前用户只读查询。
- queue mode 下点击处理资料能快速返回，不等待解析和 embedding 完成。
- worker 完成后 `Document.status=DONE`，chunks 正确写入，检索能命中。
- worker 失败后 `Document.status=FAILED`，job 记录错误摘要，用户可重新处理。
- 并发点击处理不会创建多个 active worker 写同一资料。
- `PROCESSING` 资料替换上传会被明确拒绝；异常旧 job 或 stale snapshot 不能覆盖当前资料。
- `/knowledge` 移动端能清楚展示排队、处理中、失败、已完成。
- inline mode 仍可用，便于无 Redis 的快速开发和单元测试。
