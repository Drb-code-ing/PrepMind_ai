# Phase 7：为什么多 Agent 系统下一步要先补 BullMQ 后台任务

Phase 6.8 做完后，PrepMind 的多 Agent 主线已经比较完整了：RouterAgent 负责路由，TutorAgent 负责讲题策略，KnowledgeVerifierAgent 负责资料核对，WrongQuestionOrganizerAgent 负责错题整理，ReviewAgent / PlannerAgent 负责复习建议，MemoryAgent 负责长期记忆候选，KnowledgeDedupAgent / KnowledgeOrganizerAgent 负责资料管理建议。

但这里有个很关键的判断：Phase 7 不应该急着继续做概念堆叠，而应该先补生产化工程底座。

原因很简单。一个真正能用的 Agent / RAG 学习产品，不只是“能回答问题”，还要能稳定处理长任务、能重试、能看到任务状态、能避免并发写坏数据、能在失败时给用户一个可恢复的路径。否则 Agent 再聪明，底层资料库一乱，用户体验还是会塌。

所以 Phase 7 的重点是：BullMQ 后台任务、事件总线、任务状态可观测，以及后续 Swagger / Docker worker / 生产诊断的工程增强。

先说明一下状态：这篇是 Phase 7 开工前的学习和执行设计博客，讲的是“为什么要这么做、准备怎么做、实现时要避开什么坑”。不是说这些代码已经全部落库完成。真正实现会按 `docs/superpowers/plans/2026-06-29-phase-7-background-jobs.md` 一步一测一提交推进。

## 问题从哪里来

当前 RAG 文档处理还是同步接口：

```text
POST /knowledge/documents/:id/process
  -> 读取 MinIO 原文件
  -> 解析 TXT / Markdown / DOCX / PDF
  -> 分块
  -> 调 embedding provider
  -> 写入 pgvector chunks
  -> 更新 Document 状态
```

这条链路已经不是玩具实现。前面 Phase 5.6 已经做了不少安全措施：

- 文档状态是 `PENDING -> PROCESSING -> DONE / FAILED`。
- 处理前会用 `status + storageKey + contentHash` claim 当前资料。
- 替换 chunks 时用 `SELECT ... FOR UPDATE` 锁住当前文档行。
- forced reprocess 会清旧 chunks，避免旧检索结果残留。
- 替换上传会保留同一个 `Document.id`，但改变 `storageKey/contentHash`，防止旧处理流写回新资料。

这些都很好，但同步接口仍然有天然问题。

第一，HTTP 请求生命周期不适合长任务。PDF 大一点、embedding 慢一点、网络抖一下，请求就会变得很难等。

第二，用户看不到真实进度。前端只能知道“处理中”或“失败”，不知道任务有没有排队、有没有重试、失败是解析失败还是 embedding provider 临时失败。

第三，迁到队列后会新增 worker retry，重试语义必须提前定义清楚。否则用户重复点处理、浏览器重发请求、worker 自动重试叠在一起，就可能造成重复执行。

第四，后续 Agent 能力会越来越依赖资料状态。Chat RAG、KnowledgeVerifierAgent、资料去重和资料组织建议，都依赖文档处理结果。如果文档处理不稳定，Agent 的上层体验也会不稳定。

所以 Phase 7 先从 RAG 文档处理异步化开始，是很自然的一步。

## 为什么是 BullMQ

项目技术栈里已经有 Redis，并且 AGENTS 规范里后续异步任务明确规划了 BullMQ。BullMQ 很适合这里：

- 支持 Redis 队列和 worker。
- 支持 attempts、backoff、jobId、并发、失败保留。
- NestJS 生态里有 `@nestjs/bullmq`。
- 对单体应用拆出 worker 进程很友好。

我们不需要一上来引 Kafka。Kafka 更适合跨服务事件流和大规模日志型场景；现在最核心的问题是“后台可靠执行一个长任务”，Redis + BullMQ 更轻，也更符合当前阶段。

面试里可以这样讲：

> 这个设计不是为了引入复杂技术，而是因为 RAG 文档处理天然是长任务：解析、embedding、pgvector 写入都可能慢或失败。把它放在 HTTP 请求里会影响用户体验和可靠性，所以 Phase 7 计划用 BullMQ 把它变成可重试、可观测、可限流的后台任务。

## 目标架构

第一版 Phase 7 的数据流大概是这样：

```text
用户点击处理资料
  -> POST /knowledge/documents/:id/process
  -> 校验 userId / documentId / force
  -> DB transaction:
       claim Document(status=PROCESSING)
       create BackgroundJob(status=QUEUED)
  -> commit 后 BullMQ add(jobId=BackgroundJob.id)
  -> 返回 document + processing.backgroundJobId
  -> /knowledge 页面轮询 document 和 job 状态

BullMQ worker
  -> 收到 process-document job
  -> 先校验 BackgroundJob 是否仍属于当前 user/resource
  -> 再校验 Document 是否仍匹配 storageKey/contentHash snapshot
  -> 执行解析、分块、embedding、replace chunks
  -> 成功：Document=DONE, BackgroundJob=SUCCEEDED
  -> 失败：按 retryable/final/stale 分类处理
```

这里有一个很重要的顺序：worker 不能只相信 BullMQ payload。它必须先查 `BackgroundJob`，再查 `Document`。

可以把 `BackgroundJob` 理解成“取号单”：用户点了处理资料，系统先发一张可查询、可追踪的任务单。`snapshot` 则像“开工前拍照留证”：记录当时的 `storageKey` 和 `contentHash`。如果 worker 开工时发现现场和照片不一致，就进入 `STALE_SKIPPED`，也就是“旧任务已过期，跳过不写入”。

因为 payload 是队列里的历史事实，而数据库是当前事实。用户可能删除资料，任务可能被取消，资料状态可能变化。如果 worker 只看 payload，就有机会写坏当前数据。

## BackgroundJob 为什么需要落库

BullMQ 自己有 job 状态，但业务里仍然需要 `BackgroundJob` 表。

原因有三个。

第一，用户要看任务状态。前端不能直接连 Redis，也不应该暴露 BullMQ 内部结构。我们需要一个账号级 API：

```text
GET /background-jobs/:id
GET /background-jobs?resourceType=KNOWLEDGE_DOCUMENT&resourceId=:documentId
```

第二，业务幂等需要数据库约束。BullMQ 的 jobId 能避免同一个队列里重复 job，但“同一用户同一文档同一时间只能有一个 active processing job”这种规则，更适合在 PostgreSQL 里用 partial unique index 表达。

第三，审计和调试需要脱敏摘要。我们只保存 job metadata，不保存文档正文、chunk 全文、prompt、回答或 API key。

设计里的核心模型可以简化成这样。实际执行计划里还会补 `payloadHash`、索引和更多状态查询字段：

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
}
```

然后用 raw SQL 加 active dedupe 约束：

```sql
CREATE UNIQUE INDEX "BackgroundJob_active_dedupeKey_unique"
ON "BackgroundJob"("dedupeKey")
WHERE "status" IN ('QUEUED', 'ACTIVE') AND "dedupeKey" IS NOT NULL;
```

这个点面试里很好讲，因为它体现的是工程判断：不是“靠代码 if 判断一下”，而是把并发不变量放到数据库约束里。

## 最容易踩的坑：重试不能提前把 Document 标 FAILED

这次文档审核里抓出来一个很关键的问题。

当前同步版 `DocumentProcessingService` 的行为是：只要处理失败，就 catch 住错误，把 `Document.status` 标成 `FAILED`，然后把原错误 rethrow。同步接口这样做没问题，因为这次请求已经结束了。

但如果搬到 BullMQ，事情就不一样了。

假设 embedding provider 第一次 429，BullMQ 还有两次 retry。如果第一次失败就把 `Document.status` 改成 `FAILED`，下一次 retry 进来时，worker 会检查：

```text
document.status === PROCESSING
storageKey === snapshot.storageKey
contentHash === snapshot.contentHash
```

这时 `status` 已经是 `FAILED`，retry 反而会被当成 stale 或不可继续。也就是说，“可重试失败”被我们自己提前变成了“不可重试状态”。

正确做法是拆分处理 pipeline 和失败落状态：

```ts
async processDocument(userId, documentId, options) {
  const document = await this.claimDocumentForProcessing(userId, documentId, options);

  try {
    return await this.runProcessingPipeline({
      userId,
      documentId,
      expectedDocument: snapshotOf(document),
    });
  } catch (error) {
    await this.markFailedForSnapshot(document, error);
    throw error;
  }
}
```

而 queue worker 不能这样简单 catch：

```ts
try {
  await processing.runProcessingPipeline(payload);
  await jobs.markSucceeded(...);
} catch (error) {
  if (isRetryable(error) && hasAttemptsLeft(job)) {
    await jobs.markRetryableFailure(...);
    throw error; // 让 BullMQ retry，Document 仍保持 PROCESSING
  }

  await jobs.markFailed(...);
  await processing.markFailedForSnapshot(...);
  throw error;
}
```

这就是 Phase 7 里最关键的语义变化：inline mode 可以失败即落 `Document=FAILED`；queue mode 只有最终失败才落 `Document=FAILED`。

实现时还要注意一个小细节：判断“是否还有下一次 retry”不能凭感觉写。要明确当前失败是否已经计入 `attemptsMade`，例如用类似 `job.attemptsMade + 1 < job.opts.attempts` 的判断，并用测试覆盖 final attempt，避免 off-by-one。对于解析不到文本这类不可恢复业务错误，也应该直接终止重试，而不是白白消耗 attempts。

## 第二个坑：claim、job 创建、enqueue 的竞态

最直觉的流程是：

```text
claim Document=PROCESSING
create BackgroundJob=QUEUED
queue.add(...)
```

但这里有竞态窗口。

如果请求 A 刚把 Document claim 成 `PROCESSING`，还没创建 `BackgroundJob`，请求 B 进来了。B 会发现 Document 已经在处理，但又查不到 active job。前端就不知道该展示哪个 job，也不知道该轮询什么。

所以设计里要求：claim Document 和 create BackgroundJob 必须放进同一个数据库事务。

```ts
const result = await prisma.$transaction(async (tx) => {
  const document = await tx.document.findFirst({
    where: { id: documentId, userId },
  });

  assertProcessable(document.status, force);

  await tx.document.updateMany({
    where: {
      id: documentId,
      userId,
      status: { in: force ? ['PENDING', 'FAILED', 'DONE'] : ['PENDING', 'FAILED'] },
      storageKey: document.storageKey,
      contentHash: document.contentHash,
    },
    data: { status: 'PROCESSING', errorMessage: null },
  });

  const backgroundJob = await tx.backgroundJob.create({
    data: {
      userId,
      queueName: 'knowledge-document-processing',
      jobName: 'process-document',
      status: 'QUEUED',
      resourceType: 'KNOWLEDGE_DOCUMENT',
      resourceId: documentId,
      dedupeKey: `knowledge-process-active:${userId}:${documentId}`,
      payloadPreview: { documentId, force },
    },
  });

  return { document, backgroundJob };
});
```

事务提交后再 `queue.add`：

```ts
await queue.add('process-document', payload, {
  jobId: backgroundJob.id,
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 86400, count: 1000 },
  removeOnFail: { age: 604800, count: 3000 },
});
```

这里计划让 BullMQ 的 `jobId` 直接使用 `BackgroundJob.id`，这样 Redis 队列里的任务和 PostgreSQL 里的任务单是一一对应的；如果保留 `bullJobId` 字段，它也应该保存这个同一个 id 或 BullMQ 返回的 id，避免出现两套身份不好追踪。

如果 enqueue 失败，就要按 snapshot 把 `Document` 标回 `FAILED`，同时把 `BackgroundJob` 标成 `FAILED(ENQUEUE_FAILED)`。否则文档会卡在 `PROCESSING`。

这也是一个面试高频点：引入队列后，不是“把任务丢进去”就完了，DB 状态和队列状态之间的边界必须设计。

## 第三个坑：API-only 进程不能启动 worker

一开始计划里有一个看似方便的兜底：如果 `SERVER_ROLE=api`，processor 的 `process()` 里直接 early return。

审核时发现这是 P0 级别问题。

为什么？因为只要 BullMQ worker 被实例化，它就可能从 Redis 抢到 job。即使 `process()` 直接 return，BullMQ 也可能把这个 job 当成“成功完成”。结果是：

- Redis job 结束了。
- `BackgroundJob` 还在 `QUEUED / ACTIVE`。
- `Document` 还在 `PROCESSING`。
- 真正 worker 没机会处理它。

所以 API-only 进程不是“启动 worker 后早退”，而是根本不能注册 worker。

计划里改成了明确的 worker role guard：

```ts
export function shouldRegisterWorkers(role: ServerEnv['SERVER_ROLE']) {
  return role === 'worker' || role === 'both';
}
```

在模块里按角色注册 provider：

```ts
const knowledgeDocumentProcessorProviders = shouldRegisterWorkers(
  process.env.SERVER_ROLE as 'api' | 'worker' | 'both',
)
  ? [DocumentProcessingProcessor]
  : [];

@Module({
  providers: [
    DocumentProcessingJobService,
    ...knowledgeDocumentProcessorProviders,
  ],
})
export class KnowledgeDocumentsModule {}
```

生产里推荐拆成：

```text
SERVER_ROLE=api     -> HTTP API only
SERVER_ROLE=worker  -> BullMQ processors only
SERVER_ROLE=both    -> 本地开发 / smoke
```

这比 `WORKER_ENABLED=true/false` 更清楚。

## 第四个坑：PROCESSING 资料替换上传仍然要阻止

设计里还有一个容易讲糊的点：旧 job stale skip 和替换上传。

当前仓库事实是：如果资料正在 `PROCESSING`，替换上传会被拒绝，返回 `KNOWLEDGE_DOCUMENT_PROCESSING`。这个边界是合理的，因为替换文件会改变 `storageKey/contentHash`，还要清 chunks、清旧 MinIO 对象，和正在处理的 worker 并发会很复杂。

所以 Phase 7 第一版不改变这个边界。

那为什么还要保留 snapshot stale skip？

因为 worker 是异步系统，防御不能只靠“正常 UI 不允许”。这些情况仍然可能发生：

- 管理员人工修复数据。
- 用户删除文档后旧 job 才开始跑。
- 后续版本放开 processing replace。
- 队列延迟导致 payload 里的 snapshot 已经不是当前事实。

所以 worker 写入前仍然要检查：

```ts
if (!document) return staleSkipped('document_missing');
if (document.status !== 'PROCESSING') return staleSkipped('status_not_processing');
if (
  document.storageKey !== payload.snapshot.storageKey ||
  document.contentHash !== payload.snapshot.contentHash
) {
  return staleSkipped('snapshot_changed');
}
```

这不是和“PROCESSING 禁止替换”矛盾，而是双保险。

面试里可以这样说：

> 第一版产品层仍然禁止 processing 状态替换上传，降低并发复杂度；worker 里的 snapshot stale skip 是防御式设计，防止队列延迟、删除、人工修复或未来放开替换时旧任务写回当前资料。

## 前端怎么变

前端不会做一个复杂任务中心。`/knowledge` 页面只需要把状态讲清楚。

用户点击处理后，queue mode 的响应会多一个字段：

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

注意这里有两个状态：

- `Document.status`: `PENDING / PROCESSING / DONE / FAILED`
- `BackgroundJob.status`: `QUEUED / ACTIVE / SUCCEEDED / FAILED / CANCELLED / STALE_SKIPPED`

不能混在一起。

前端展示可以很轻：

- `QUEUED`：排队中
- `ACTIVE`：处理中
- `FAILED`：处理失败
- `STALE_SKIPPED`：旧任务已跳过
- `DONE` 文档：已入库

轮询也不需要全局乱跑。只有存在 `PENDING / PROCESSING` 文档时，资料列表才每 2 秒刷新一次；完成或失败后停止。

```ts
const hasPendingOrProcessing = documents.some(
  (document) => document.status === 'PENDING' || document.status === 'PROCESSING',
);

useKnowledgeDocumentList(query, {
  refetchInterval: hasPendingOrProcessing ? 2000 : false,
});
```

处理完成后要失效这些缓存：

- document list/detail
- knowledge search
- knowledge agent suggestions
- background job list/detail

原因是资料处理完成会影响检索，也会影响 KnowledgeDedupAgent / KnowledgeOrganizerAgent 的资料管理建议。

## 事件总线怎么用

Phase 7 会先加一个进程内 typed event bus。它不承诺跨进程必达，不直接让浏览器刷新，只做模块解耦和测试。核心状态仍然以 DB transaction、`Document` 和 `BackgroundJob` 为事实来源；EventBus 只做 after-commit 通知，handler 失败不能影响主链路。

事件可以长这样：

```ts
type KnowledgeDocumentProcessingSucceeded = {
  type: 'knowledge.document.processing.succeeded';
  userId: string;
  documentId: string;
  backgroundJobId: string;
  chunkCount: number;
  durationMs: number;
  finishedAt: string;
};
```

为什么不一上来做 outbox？

因为第一阶段的关键路径是 queue processing 本身。Outbox 是跨进程可靠事件，需要额外表、publisher、重试和幂等消费。它值得做，但应该在 queue path 跑稳后作为 Phase 7.2。

这个判断也可以面试讲：

> 第一版计划先用进程内 typed event bus 收敛事件 contract，让模块不要直接互相调用。需要跨进程可靠投递时，再把同一套事件写入 OutboxEvent，用 worker 发布。这样可以控制第一版复杂度，不把队列、事件、可靠投递一次性全压到同一个提交里。

## 和 Agent 架构有什么关系

从 Agent 系统设计角度看，Phase 7 也能对应到 LLM、Planning、Memory、Tools、ReAct、多 Agent、Reflexion、State Schema、RAG 冲突和权限隔离这些概念。

Phase 7 和这些概念是对得上的，但不是简单地“让 Agent 自己跑任务”。

### Workflow 比 Agent 更适合文档处理

文档解析和 embedding 是明确流程：

```text
读文件 -> 解析 -> 分块 -> embedding -> 写 chunks -> 标记完成
```

这不是开放式推理，不需要 LLM 决定下一步。它应该是 workflow，由 BullMQ 保证可靠执行。

### State Schema 落到 job payload

Agent 里讲 state schema，是为了避免上下文爆炸。后台任务也一样。job payload 不能塞完整文档或完整 chunk，只保留核心变量：

```ts
{
  backgroundJobId,
  userId,
  documentId,
  force,
  snapshot: { storageKey, contentHash },
  requestedAt,
}
```

这就是任务层面的 state schema。

### Max Steps 在队列里变成 attempts / timeout / deadline

Agent 防无限循环靠 max steps。后台任务防无限重试靠：

- `attempts`
- `backoff`
- `lockDuration`
- job timeout
- per-user active cap
- stale snapshot

不是让模型“自己判断再试几次”，而是工程上明确上限。

### Reflexion 先用于验收，不急着生产自我重试

Phase 7 里 Reflexion 更适合用于验收：如果 worker 失败、RAG 引用异常、live smoke 不达标，就沉淀成固定回归用例。不要一开始就在生产里让 Agent 自我反思、自我重试、自我写库。

这也是 PrepMind 现在的主线风格：确定性 policy + 人审边界 + 可观测 trace，先保证可控，再逐步放开更强的自主性。

## 面试时可以怎么讲

实现完成后，可以用这一段作为项目表达：

> Phase 6 做完多 Agent 后，我没有继续盲目增加 autonomous loop，而是先做 Phase 7 工程化增强。因为 RAG 文档处理涉及 MinIO 读取、PDF/DOCX 解析、分块、embedding 和 pgvector 写入，本质是耗时且可重试的长任务，不适合放在 HTTP 请求里。第一版方案是 BullMQ + BackgroundJob 状态表：API 负责用户权限、claim Document 和创建 job；worker 负责后台处理；前端通过 background job API 展示排队、处理中、失败和完成。整个链路保留 `storageKey + contentHash` snapshot 校验，避免旧 job 写回当前资料。

如果面试官问“怎么保证幂等和并发安全”，可以答：

> 设计里会把 claim Document 和 create BackgroundJob 放在同一个数据库事务里；`dedupeKey` 上加 active partial unique index，保证同一用户同一文档同一时间只有一个 active job。BullMQ 的 jobId 使用 BackgroundJob.id。worker 开始时先条件更新并校验 BackgroundJob，再校验 Document 的 userId、status、storageKey 和 contentHash，写 chunks 前仍然走 snapshot + row lock。

如果问“重试怎么处理”，可以答：

> inline mode 失败可以立即标 Document=FAILED；queue mode 不行。设计里会让 retryable 错误在 attempts 未耗尽时只更新 BackgroundJob attempt/error 并 rethrow，让 BullMQ retry，Document 保持 PROCESSING。只有 attempts 耗尽或不可重试业务错误，才把 BackgroundJob 和 Document 都标失败。否则下一次 retry 会因为 Document 已经 FAILED 而无法继续。

如果问“事件总线是不是过度设计”，可以答：

> 第一版只是进程内 typed event bus，用来收敛事件 contract 和模块边界，不承诺跨进程必达。等队列处理稳定后，再用 OutboxEvent 做可靠事件投递。这个阶段先解决最痛的长任务可靠性，而不是一口气上完整事件溯源。

## 总结

Phase 7 的核心不是“加 BullMQ”这几个字，而是把 RAG 和 Agent 系统从功能可用推进到工程可控：

- 长任务从同步请求迁到后台队列。
- 用户能看到任务状态。
- 失败可以分类处理。
- retry 不会破坏 Document 状态机。
- 并发由数据库约束和 snapshot 双重保护。
- 前端通过轻量轮询展示状态。
- EventBus 先收敛 contract，Outbox 后续再做可靠投递。

这一步做好后，后续再做资料自动重算、trace 聚合、知识库高频更新、甚至更复杂的多 Agent 协作，都会稳很多。换句话说，Phase 7 是让“智能”站得住的工程地基。
