# Phase 7.9.2 Outbox Dispatcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first durable outbox consumption loop: claim events, dispatch registered handlers, mark success or retry/dead, and enqueue one real knowledge requested event.

**Architecture:** Keep `OutboxService` as the persistence state machine. Add an internal `OutboxDispatcherService` and explicit handler registry in `apps/server/src/outbox`. Integrate `DocumentProcessingJobService` by best-effort writing a safe `knowledge.document.processing.requested` outbox event after `BackgroundJob` creation, while preserving BullMQ and in-process EventBus behavior.

**Tech Stack:** NestJS 11, Prisma Client types, Jest, Bun workspace, TypeScript strict.

---

## File Structure

- Create `apps/server/src/outbox/outbox.handlers.ts`
  - Defines `OutboxEventLike`, `OutboxEventHandler`, `OutboxHandlerError`, `outboxHandlers`, and `handleKnowledgeDocumentProcessingRequested()`.
- Create `apps/server/src/outbox/outbox.handlers.spec.ts`
  - Tests valid requested payload, invalid payload error code, and extra field tolerance.
- Create `apps/server/src/outbox/outbox.dispatcher.ts`
  - Defines `OutboxDispatcherService`, `DispatchOutboxBatchInput`, `DispatchOutboxBatchResult`.
- Create `apps/server/src/outbox/outbox.dispatcher.spec.ts`
  - Tests empty batch, success, failure, unknown type, and continuing after one failed event.
- Modify `apps/server/src/outbox/outbox.module.ts`
  - Provides and exports `OutboxDispatcherService`.
- Modify `apps/server/src/knowledge-documents/knowledge-documents.module.ts`
  - Imports `OutboxModule`.
- Modify `apps/server/src/knowledge-documents/jobs/document-processing-job.service.ts`
  - Injects `OutboxService`.
  - Best-effort enqueues `knowledge.document.processing.requested` outbox event after BullMQ enqueue succeeds.
- Modify `apps/server/src/knowledge-documents/jobs/document-processing-job.service.spec.ts`
  - Adds outbox mock and TDD tests for requested event enqueue and enqueue failure isolation.
- Modify `apps/server/src/knowledge-documents/jobs/document-processing.integration.spec.ts`
  - Updates direct constructor call with the new dependency.
- Modify docs after code is verified:
  - `AGENTS.md`
  - `DEVLOG.md`
  - `docs/ai-behavior-acceptance.md`

---

## Task 1: Add Outbox Handler Registry With TDD

**Files:**
- Create: `apps/server/src/outbox/outbox.handlers.spec.ts`
- Create: `apps/server/src/outbox/outbox.handlers.ts`

- [ ] **Step 1: Write failing handler tests**

Create `apps/server/src/outbox/outbox.handlers.spec.ts`:

```ts
import {
  OutboxHandlerError,
  handleKnowledgeDocumentProcessingRequested,
  outboxHandlers,
  type OutboxEventLike,
} from './outbox.handlers';

describe('outbox handlers', () => {
  it('registers the knowledge requested handler explicitly', () => {
    expect(outboxHandlers['knowledge.document.processing.requested']).toBe(
      handleKnowledgeDocumentProcessingRequested,
    );
  });

  it('accepts a safe knowledge requested payload', async () => {
    await expect(
      handleKnowledgeDocumentProcessingRequested(
        event({
          payload: {
            userId: 'user_1',
            documentId: 'doc_1',
            backgroundJobId: 'job_1',
            force: false,
          },
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects a knowledge requested payload without required ids', async () => {
    await expect(
      handleKnowledgeDocumentProcessingRequested(
        event({
          payload: {
            userId: 'user_1',
            documentId: 'doc_1',
            force: false,
          },
        }),
      ),
    ).rejects.toMatchObject({
      code: 'OUTBOX_INVALID_PAYLOAD',
    });
  });

  it('ignores extra payload fields without using them', async () => {
    await expect(
      handleKnowledgeDocumentProcessingRequested(
        event({
          payload: {
            userId: 'user_1',
            documentId: 'doc_1',
            backgroundJobId: 'job_1',
            force: true,
            leakedText: 'this field is ignored by the handler',
          },
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('exposes a typed handler error class', () => {
    const error = new OutboxHandlerError(
      'OUTBOX_INVALID_PAYLOAD',
      'Invalid payload',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('OUTBOX_INVALID_PAYLOAD');
  });

  function event(input: { payload: Record<string, unknown> }): OutboxEventLike {
    return {
      id: 'evt_1',
      type: 'knowledge.document.processing.requested',
      payload: input.payload,
    };
  }
});
```

- [ ] **Step 2: Run RED verification**

Run:

```powershell
bun --filter @repo/server test -- outbox.handlers
```

Expected: FAIL because `./outbox.handlers` does not exist.

- [ ] **Step 3: Implement handler registry**

Create `apps/server/src/outbox/outbox.handlers.ts`:

```ts
export type OutboxEventLike = {
  id: string;
  type: string;
  payload: unknown;
};

export type OutboxEventHandler = (event: OutboxEventLike) => Promise<void>;

export class OutboxHandlerError extends Error {
  constructor(
    readonly code:
      | 'OUTBOX_INVALID_PAYLOAD'
      | 'OUTBOX_HANDLER_NOT_FOUND'
      | 'OUTBOX_HANDLER_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'OutboxHandlerError';
  }
}

export const outboxHandlers: Record<string, OutboxEventHandler> = {
  'knowledge.document.processing.requested':
    handleKnowledgeDocumentProcessingRequested,
};

export async function handleKnowledgeDocumentProcessingRequested(
  event: OutboxEventLike,
): Promise<void> {
  const payload = event.payload;
  if (!isRecord(payload)) {
    throw new OutboxHandlerError(
      'OUTBOX_INVALID_PAYLOAD',
      'Outbox event payload must be an object',
    );
  }

  assertString(payload.userId, 'userId');
  assertString(payload.documentId, 'documentId');
  assertString(payload.backgroundJobId, 'backgroundJobId');
  if (typeof payload.force !== 'boolean') {
    throw new OutboxHandlerError(
      'OUTBOX_INVALID_PAYLOAD',
      'Outbox event payload force must be boolean',
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new OutboxHandlerError(
      'OUTBOX_INVALID_PAYLOAD',
      `Outbox event payload ${field} must be a non-empty string`,
    );
  }
}
```

- [ ] **Step 4: Run GREEN verification**

Run:

```powershell
bun --filter @repo/server test -- outbox.handlers
bun --cwd apps/server eslint src/outbox
```

Expected: handler tests PASS and outbox lint PASS.

- [ ] **Step 5: Commit handler registry**

Run:

```powershell
git add apps/server/src/outbox/outbox.handlers.ts apps/server/src/outbox/outbox.handlers.spec.ts
git commit -m "feat(server): add outbox handler registry"
```

Expected: commit succeeds.

---

## Task 2: Add OutboxDispatcherService With TDD

**Files:**
- Create: `apps/server/src/outbox/outbox.dispatcher.spec.ts`
- Create: `apps/server/src/outbox/outbox.dispatcher.ts`
- Modify: `apps/server/src/outbox/outbox.module.ts`

- [ ] **Step 1: Write failing dispatcher tests**

Create `apps/server/src/outbox/outbox.dispatcher.spec.ts`:

```ts
import { OutboxDispatcherService } from './outbox.dispatcher';
import { OutboxHandlerError, type OutboxEventHandler } from './outbox.handlers';

describe('OutboxDispatcherService', () => {
  const now = new Date('2026-07-07T01:00:00.000Z');
  const outbox = {
    claimPending: jest.fn(),
    markSucceeded: jest.fn(),
    markFailedOrRetry: jest.fn(),
  };
  const handler = jest.fn<ReturnType<OutboxEventHandler>, Parameters<OutboxEventHandler>>();

  beforeEach(() => {
    jest.clearAllMocks();
    handler.mockResolvedValue(undefined);
  });

  it('returns an empty result when no events are claimed', async () => {
    outbox.claimPending.mockResolvedValue([]);

    const result = await createService().dispatchBatch({
      workerId: 'worker_1',
      now,
    });

    expect(outbox.claimPending).toHaveBeenCalledWith({
      workerId: 'worker_1',
      limit: 10,
      now,
      lockTimeoutMs: undefined,
    });
    expect(result).toEqual({ claimed: 0, succeeded: 0, failed: 0 });
  });

  it('marks an event succeeded when its handler resolves', async () => {
    outbox.claimPending.mockResolvedValue([event('evt_1', 'known.type')]);
    outbox.markSucceeded.mockResolvedValue({ id: 'evt_1', status: 'SUCCEEDED' });

    const result = await createService({ 'known.type': handler }).dispatchBatch({
      workerId: 'worker_1',
      limit: 5,
      now,
    });

    expect(handler).toHaveBeenCalledWith(event('evt_1', 'known.type'));
    expect(outbox.markSucceeded).toHaveBeenCalledWith('evt_1', 'worker_1');
    expect(result).toEqual({ claimed: 1, succeeded: 1, failed: 0 });
  });

  it('marks an event failed or retry when its handler throws', async () => {
    const error = new Error('handler boom');
    handler.mockRejectedValue(error);
    outbox.claimPending.mockResolvedValue([event('evt_1', 'known.type')]);
    outbox.markFailedOrRetry.mockResolvedValue({ id: 'evt_1', status: 'PENDING' });

    const result = await createService({ 'known.type': handler }).dispatchBatch({
      workerId: 'worker_1',
      now,
    });

    expect(outbox.markFailedOrRetry).toHaveBeenCalledWith({
      id: 'evt_1',
      workerId: 'worker_1',
      errorCode: 'OUTBOX_HANDLER_FAILED',
      error,
      now,
    });
    expect(result).toEqual({ claimed: 1, succeeded: 0, failed: 1 });
  });

  it('marks an unknown event type failed or retry', async () => {
    outbox.claimPending.mockResolvedValue([event('evt_1', 'unknown.type')]);

    const result = await createService().dispatchBatch({
      workerId: 'worker_1',
      now,
    });

    expect(outbox.markFailedOrRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'evt_1',
        errorCode: 'OUTBOX_HANDLER_NOT_FOUND',
      }),
    );
    expect(result.failed).toBe(1);
  });

  it('continues dispatching after one event fails', async () => {
    const failingHandler = jest
      .fn<ReturnType<OutboxEventHandler>, Parameters<OutboxEventHandler>>()
      .mockRejectedValue(new OutboxHandlerError('OUTBOX_INVALID_PAYLOAD', 'bad'));
    const succeedingHandler = jest
      .fn<ReturnType<OutboxEventHandler>, Parameters<OutboxEventHandler>>()
      .mockResolvedValue(undefined);
    outbox.claimPending.mockResolvedValue([
      event('evt_1', 'bad.type'),
      event('evt_2', 'good.type'),
    ]);

    const result = await createService({
      'bad.type': failingHandler,
      'good.type': succeedingHandler,
    }).dispatchBatch({ workerId: 'worker_1', now });

    expect(outbox.markFailedOrRetry).toHaveBeenCalledTimes(1);
    expect(outbox.markSucceeded).toHaveBeenCalledWith('evt_2', 'worker_1');
    expect(result).toEqual({ claimed: 2, succeeded: 1, failed: 1 });
  });

  function createService(handlers: Record<string, OutboxEventHandler> = {}) {
    return new OutboxDispatcherService(outbox as never, handlers);
  }

  function event(id: string, type: string) {
    return {
      id,
      type,
      payload: {
        userId: 'user_1',
        documentId: 'doc_1',
        backgroundJobId: 'job_1',
        force: false,
      },
    };
  }
});
```

- [ ] **Step 2: Run RED verification**

Run:

```powershell
bun --filter @repo/server test -- outbox.dispatcher
```

Expected: FAIL because `./outbox.dispatcher` does not exist.

- [ ] **Step 3: Implement dispatcher service**

Create `apps/server/src/outbox/outbox.dispatcher.ts`:

```ts
import { Injectable } from '@nestjs/common';

import { OutboxService } from './outbox.service';
import {
  OutboxHandlerError,
  outboxHandlers,
  type OutboxEventHandler,
  type OutboxEventLike,
} from './outbox.handlers';

export type DispatchOutboxBatchInput = {
  workerId: string;
  limit?: number;
  now?: Date;
  lockTimeoutMs?: number;
};

export type DispatchOutboxBatchResult = {
  claimed: number;
  succeeded: number;
  failed: number;
};

@Injectable()
export class OutboxDispatcherService {
  constructor(
    private readonly outboxService: OutboxService,
    private readonly handlers: Record<string, OutboxEventHandler> = outboxHandlers,
  ) {}

  async dispatchBatch(
    input: DispatchOutboxBatchInput,
  ): Promise<DispatchOutboxBatchResult> {
    const now = input.now ?? new Date();
    const events = await this.outboxService.claimPending({
      workerId: input.workerId,
      limit: input.limit ?? 10,
      now,
      lockTimeoutMs: input.lockTimeoutMs,
    });

    let succeeded = 0;
    let failed = 0;
    for (const event of events) {
      try {
        await this.dispatchOne(event);
        await this.outboxService.markSucceeded(event.id, input.workerId);
        succeeded += 1;
      } catch (error) {
        await this.outboxService.markFailedOrRetry({
          id: event.id,
          workerId: input.workerId,
          errorCode: getOutboxErrorCode(error),
          error,
          now,
        });
        failed += 1;
      }
    }

    return { claimed: events.length, succeeded, failed };
  }

  private async dispatchOne(event: OutboxEventLike) {
    const handler = this.handlers[event.type];
    if (!handler) {
      throw new OutboxHandlerError(
        'OUTBOX_HANDLER_NOT_FOUND',
        `No outbox handler registered for ${event.type}`,
      );
    }

    await handler(event);
  }
}

function getOutboxErrorCode(error: unknown) {
  if (error instanceof OutboxHandlerError) return error.code;
  return 'OUTBOX_HANDLER_FAILED';
}
```

- [ ] **Step 4: Export dispatcher from module**

Modify `apps/server/src/outbox/outbox.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { OutboxDispatcherService } from './outbox.dispatcher';
import { OutboxService } from './outbox.service';

@Module({
  imports: [DatabaseModule],
  providers: [OutboxService, OutboxDispatcherService],
  exports: [OutboxService, OutboxDispatcherService],
})
export class OutboxModule {}
```

- [ ] **Step 5: Run GREEN verification**

Run:

```powershell
bun --filter @repo/server test -- outbox.dispatcher outbox.handlers
bun --cwd apps/server eslint src/outbox
bun --filter @repo/server build
```

Expected: tests, outbox lint, and server build PASS.

- [ ] **Step 6: Commit dispatcher**

Run:

```powershell
git add apps/server/src/outbox/outbox.dispatcher.ts apps/server/src/outbox/outbox.dispatcher.spec.ts apps/server/src/outbox/outbox.module.ts
git commit -m "feat(server): add outbox dispatcher"
```

Expected: commit succeeds.

---

## Task 3: Enqueue Knowledge Requested Outbox Events

**Files:**
- Modify: `apps/server/src/knowledge-documents/jobs/document-processing-job.service.spec.ts`
- Modify: `apps/server/src/knowledge-documents/jobs/document-processing-job.service.ts`
- Modify: `apps/server/src/knowledge-documents/jobs/document-processing.integration.spec.ts`
- Modify: `apps/server/src/knowledge-documents/knowledge-documents.module.ts`

- [ ] **Step 1: Write failing tests for requested event enqueue**

Modify `apps/server/src/knowledge-documents/jobs/document-processing-job.service.spec.ts`:

1. Add an outbox mock near `eventBus`:

```ts
const outbox = { enqueue: jest.fn() };
```

2. In `beforeEach`, add:

```ts
outbox.enqueue.mockResolvedValue({ id: 'evt_1', status: 'PENDING' });
```

3. In `creates a background job and enqueues it after a processing claim`, add assertions after `queue.add`:

```ts
expect(outbox.enqueue).toHaveBeenCalledWith({
  type: 'knowledge.document.processing.requested',
  aggregateType: 'KnowledgeDocument',
  aggregateId: 'doc_1',
  idempotencyKey: 'knowledge-document-processing-requested:user_1:doc_1:job_1',
  payload: {
    userId: 'user_1',
    documentId: 'doc_1',
    backgroundJobId: 'job_1',
    force: false,
  },
});
```

4. Add a new test:

```ts
it('does not fail the enqueue response when outbox enqueue fails', async () => {
  const document = documentRow();
  const job = jobRow();
  prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      document: {
        findFirst: jest.fn().mockResolvedValue(document),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      backgroundJob: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(job),
      },
    }),
  );
  processing.toResponse.mockReturnValue({
    id: 'doc_1',
    status: 'PROCESSING',
  });
  outbox.enqueue.mockRejectedValue(new Error('outbox unavailable'));

  await expect(
    createService().enqueueOrRun('user_1', 'doc_1', { force: false }),
  ).resolves.toMatchObject({
    processing: { backgroundJobId: 'job_1' },
  });

  expect(queue.add).toHaveBeenCalled();
  expect(eventBus.publish).toHaveBeenCalled();
});
```

5. Update `createService()` constructor call:

```ts
return new DocumentProcessingJobService(
  prisma as never,
  queue as never,
  processing as never,
  config as never,
  eventBus as never,
  outbox as never,
);
```

- [ ] **Step 2: Run RED verification**

Run:

```powershell
bun --filter @repo/server test -- document-processing-job
```

Expected: FAIL because `DocumentProcessingJobService` does not accept or call the outbox dependency yet.

- [ ] **Step 3: Implement service integration**

Modify `apps/server/src/knowledge-documents/jobs/document-processing-job.service.ts`:

1. Add import:

```ts
import { OutboxService } from '../../outbox/outbox.service';
```

2. Add constructor dependency after `eventBus`:

```ts
private readonly outboxService: OutboxService,
```

3. After `queue.add(...)` succeeds and before the existing `eventBus.publish(...)` block, add:

```ts
try {
  await this.outboxService.enqueue({
    type: 'knowledge.document.processing.requested',
    aggregateType: 'KnowledgeDocument',
    aggregateId: claim.document.id,
    idempotencyKey: `knowledge-document-processing-requested:${userId}:${claim.document.id}:${claim.job.id}`,
    payload: {
      userId,
      documentId: claim.document.id,
      backgroundJobId: claim.job.id,
      force: input.force,
    },
  });
} catch {
  // Queue state is already durable; outbox observer failures must not fail the request.
}
```

- [ ] **Step 4: Import OutboxModule**

Modify `apps/server/src/knowledge-documents/knowledge-documents.module.ts`:

```ts
import { OutboxModule } from '../outbox/outbox.module';
```

Add `OutboxModule` to module imports:

```ts
imports: [
  AuthModule,
  BackgroundJobsModule,
  OutboxModule,
  UploadsModule,
  BullModule.registerQueue({ name: PROCESS_KNOWLEDGE_DOCUMENT_QUEUE }),
],
```

- [ ] **Step 5: Update integration spec constructor**

Modify `apps/server/src/knowledge-documents/jobs/document-processing.integration.spec.ts`.

Find `new DocumentProcessingJobService(...)` and append a safe outbox mock:

```ts
{ enqueue: async () => ({ id: 'evt_1', status: 'PENDING' }) } as never,
```

- [ ] **Step 6: Run GREEN verification**

Run:

```powershell
bun --filter @repo/server test -- document-processing-job
bun --filter @repo/server build
```

Expected: tests and build PASS.

- [ ] **Step 7: Commit requested event integration**

Run:

```powershell
git add apps/server/src/knowledge-documents/jobs/document-processing-job.service.ts apps/server/src/knowledge-documents/jobs/document-processing-job.service.spec.ts apps/server/src/knowledge-documents/jobs/document-processing.integration.spec.ts apps/server/src/knowledge-documents/knowledge-documents.module.ts
git commit -m "feat(server): enqueue knowledge requested outbox event"
```

Expected: commit succeeds.

---

## Task 4: Document Phase 7.9.2

**Files:**
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/ai-behavior-acceptance.md`

- [ ] **Step 1: Update phase status**

Update phase tables in `AGENTS.md` and `DEVLOG.md` to include:

```markdown
| Phase 7.9.2 | 已完成 | Outbox Dispatcher 最小闭环、handler registry、知识库 requested 事件入库 |
```

- [ ] **Step 2: Add boundary notes**

Add concise notes:

- `OutboxDispatcherService` claims `OutboxEvent` rows and dispatches registered handlers.
- Phase 7.9.2 only registers `knowledge.document.processing.requested`.
- The requested handler is observability-only and does not requeue BullMQ, mutate `Document`, mutate `BackgroundJob`, or write user content.
- `DocumentProcessingJobService` writes requested outbox events best-effort after BullMQ enqueue succeeds; outbox failures do not fail user requests.
- No frontend, Chat, RAG prompt, model, Prometheus, Grafana, or automatic scheduler changes.
- Payload and errors remain metadata-only and sanitized.

- [ ] **Step 3: Update AI acceptance**

Append `docs/ai-behavior-acceptance.md` section:

```markdown
## 18. Phase 7.9.2 Outbox Dispatcher

Phase 7.9.2 是后台可靠事件消费闭环，不改变 Chat、RAG prompt、模型路由、Tutor 输出、KnowledgeVerifierAgent guidance 或前端页面行为，因此不要求 live 模型 smoke。

- Dispatcher 只能执行显式注册 handler，不能根据 payload 动态执行任意函数。
- Unknown event type 必须进入 retry / dead-letter 流程，不能静默丢弃。
- `knowledge.document.processing.requested` handler 第一版只做 payload 校验，不重投 BullMQ、不改 `Document`、不改 `BackgroundJob`、不写用户内容。
- requested outbox payload 只能包含 `userId`、`documentId`、`backgroundJobId` 和 `force`。
- outbox enqueue 失败不得打断知识库 queue 主链路。
```

- [ ] **Step 4: Run document checks**

Run:

```powershell
rg "Phase 7.9.2|Outbox Dispatcher|knowledge.document.processing.requested" AGENTS.md DEVLOG.md docs/ai-behavior-acceptance.md
git diff --check
```

Expected: `rg` finds new content and diff check passes.

- [ ] **Step 5: Commit docs**

Run:

```powershell
git add AGENTS.md DEVLOG.md docs/ai-behavior-acceptance.md
git commit -m "docs: record outbox dispatcher"
```

Expected: commit succeeds.

---

## Task 5: Final Verification And Review

**Files:**
- No source edits expected unless verification finds a defect.

- [ ] **Step 1: Run targeted outbox lint**

Run:

```powershell
bun --cwd apps/server eslint src/outbox
```

Expected: PASS.

- [ ] **Step 2: Run targeted server tests**

Run:

```powershell
bun --filter @repo/server test -- outbox
bun --filter @repo/server test -- document-processing-job
```

Expected: PASS.

- [ ] **Step 3: Run server build**

Run:

```powershell
bun --filter @repo/server build
```

Expected: PASS.

- [ ] **Step 4: Run database typecheck**

Run:

```powershell
bun --cwd packages/database test
```

Expected: PASS.

- [ ] **Step 5: Run diff check**

Run:

```powershell
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 6: Dispatch final review**

Use a review subagent to inspect `main...HEAD` with focus on:

- dispatcher does not execute unregistered dynamic code.
- requested handler is observability-only.
- outbox failures do not break BullMQ enqueue.
- no sensitive payloads are persisted.
- tests cover unknown type, handler failure, and best-effort enqueue failure.

Expected: APPROVED, or apply requested fixes with tests and commit.

---

## Self-Review

- Spec coverage: Tasks cover handler registry, dispatcher, knowledge requested event enqueue, docs, and final verification.
- Placeholder scan: No placeholder steps remain; each code step gives concrete snippets and exact file paths.
- Scope control: This plan does not add scheduler loops, HTTP APIs, metrics dashboards, frontend UI, or Chat/RAG behavior changes.
- TDD compliance: Tasks 1, 2, and 3 start with failing tests before production code changes.
