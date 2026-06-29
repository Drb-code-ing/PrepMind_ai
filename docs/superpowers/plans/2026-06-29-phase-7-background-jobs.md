# Phase 7 Background Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-grade background job slice for PrepMind: a typed `BackgroundJob` control plane plus queued RAG document processing behind a feature flag.

**Architecture:** Add shared job contracts in `@repo/types`, persist job state in PostgreSQL, use BullMQ + Redis for execution, keep `DocumentProcessingService` as the single processing pipeline, and expose queue status to `/knowledge` through typed APIs and polling. Inline processing remains the default fallback; queue mode is enabled with `KNOWLEDGE_PROCESSING_MODE=queue`.

**Tech Stack:** TypeScript, Zod, Bun workspace, NestJS 11, Prisma, PostgreSQL, Redis, BullMQ, Next.js 16, TanStack Query, Tailwind 4.

---

## Scope

This plan implements Phase 7.0 and Phase 7.1 from the design doc:

- Phase 7.0: job contracts, `BackgroundJob` model, migration, read-only job API.
- Phase 7.1: BullMQ producer/processor for RAG document processing, mode switch, frontend polling.

It intentionally does not implement persistent outbox, Swagger, Prometheus, or separate production worker deployment hardening. Those remain Phase 7.2+ follow-up plans after this queue path is stable.

## File Map

- Modify `packages/types/src/api/knowledge.ts`: add queue metadata to process response.
- Create `packages/types/src/api/background-job.ts`: job status, list query, response schemas.
- Modify `packages/types/src/api/index.ts`: export background job schemas.
- Modify `packages/types/package.json`: add `./api/background-job` export.
- Create `packages/types/tests/background-job.test.mts`: schema tests.
- Create `packages/types/tests/knowledge-processing.test.mts`: process response schema tests.
- Modify `packages/database/prisma/schema.prisma`: add `BackgroundJob`, `BackgroundJobStatus`, `User.backgroundJobs`, env-backed relation.
- Create `packages/database/prisma/migrations/<timestamp>_background_jobs/migration.sql`: model table and active dedupe partial unique index.
- Modify `apps/server/package.json`: add `@nestjs/bullmq` and `bullmq`.
- Modify `apps/server/src/config/env.ts`: add queue and worker env fields.
- Create `apps/server/src/background-jobs/background-jobs.module.ts`: API module.
- Create `apps/server/src/background-jobs/background-jobs.controller.ts`: authenticated read-only job endpoints.
- Create `apps/server/src/background-jobs/background-jobs.service.ts`: status transitions and queries.
- Create `apps/server/src/background-jobs/background-jobs.service.spec.ts`: service tests.
- Create `apps/server/src/jobs/jobs.module.ts`: BullMQ root config and queue registration.
- Create `apps/server/src/jobs/redis-url.ts`: parse `REDIS_URL` into BullMQ connection options.
- Create `apps/server/src/jobs/job-error-sanitizer.ts`: redact and truncate job errors.
- Create `apps/server/src/jobs/worker-role.ts`: worker registration guard.
- Create `apps/server/src/jobs/worker-role.spec.ts`: worker registration guard tests.
- Create `apps/server/src/events/events.module.ts`: exports a singleton in-process event bus provider.
- Create `apps/server/src/events/event-bus.ts`: in-process typed event bus.
- Create `apps/server/src/events/event-bus.spec.ts`: event bus tests.
- Create `apps/server/src/knowledge-documents/jobs/process-document.job.ts`: queue constants and payload schema.
- Create `apps/server/src/knowledge-documents/jobs/document-processing-job.service.ts`: producer and mode switch.
- Create `apps/server/src/knowledge-documents/jobs/document-processing.processor.ts`: worker processor.
- Create `apps/server/src/knowledge-documents/jobs/document-processing-job.service.spec.ts`: producer tests.
- Create `apps/server/src/knowledge-documents/jobs/document-processing.processor.spec.ts`: processor tests.
- Modify `apps/server/src/knowledge-documents/document-processing.service.ts`: split claim, pipeline, inline failure handling, queued failure handling.
- Modify `apps/server/src/knowledge-documents/document-processing.service.spec.ts`: preserve inline behavior and add pipeline tests.
- Modify `apps/server/src/knowledge-documents/knowledge-documents.controller.ts`: route process calls through job service.
- Modify `apps/server/src/knowledge-documents/knowledge-documents.module.ts`: register job providers and queue module.
- Modify `apps/server/src/app.module.ts`: register `BackgroundJobsModule` and `JobsModule`.
- Create `apps/web/src/lib/background-job-api.ts`: client wrapper.
- Create `apps/web/src/lib/background-job-api.test.mts`: client tests.
- Create `apps/web/src/hooks/use-background-jobs.ts`: job query hooks.
- Modify `apps/web/src/lib/knowledge-api.ts`: parse queue process response.
- Modify `apps/web/src/hooks/use-knowledge.ts`: invalidate background job queries and support polling trigger.
- Modify `apps/web/src/app/(main)/knowledge/page.tsx`: show queued/active job status and poll while processing.
- Modify `AGENTS.md`, `docs/data-flow.md`, `docs/dev-start.md`, `docs/roadmap.md`: record Phase 7 queue mode and commands.
- Modify `docs/ai-behavior-acceptance.md`: clarify that background queue smoke does not replace live AI acceptance.

---

## Task 1: Shared Background Job Contracts

**Files:**
- Create: `packages/types/src/api/background-job.ts`
- Modify: `packages/types/src/api/knowledge.ts`
- Modify: `packages/types/src/api/index.ts`
- Modify: `packages/types/package.json`
- Test: `packages/types/tests/background-job.test.mts`
- Test: `packages/types/tests/knowledge-processing.test.mts`

- [ ] **Step 1: Write failing schema tests**

Create `packages/types/tests/background-job.test.mts`:

```ts
import assert from 'node:assert/strict';

import {
  backgroundJobListQuerySchema,
  backgroundJobResponseSchema,
} from '../src/api/background-job';

assert.deepEqual(
  backgroundJobListQuerySchema.parse({
    resourceType: 'KNOWLEDGE_DOCUMENT',
    resourceId: 'doc_1',
    limit: '10',
  }),
  {
    resourceType: 'KNOWLEDGE_DOCUMENT',
    resourceId: 'doc_1',
    limit: 10,
  },
);

const parsed = backgroundJobResponseSchema.parse({
  id: 'job_1',
  queueName: 'knowledge-document-processing',
  jobName: 'process-document',
  status: 'ACTIVE',
  resourceType: 'KNOWLEDGE_DOCUMENT',
  resourceId: 'doc_1',
  attempt: 1,
  maxAttempts: 3,
  progress: 10,
  payloadPreview: { documentId: 'doc_1', force: false },
  resultSummary: null,
  errorCode: null,
  errorMessage: null,
  requestedAt: '2026-06-29T00:00:00.000Z',
  startedAt: '2026-06-29T00:00:02.000Z',
  finishedAt: null,
  createdAt: '2026-06-29T00:00:00.000Z',
  updatedAt: '2026-06-29T00:00:02.000Z',
});

assert.equal(parsed.status, 'ACTIVE');
assert.deepEqual(parsed.payloadPreview, { documentId: 'doc_1', force: false });
```

Create `packages/types/tests/knowledge-processing.test.mts`:

```ts
import assert from 'node:assert/strict';

import { knowledgeDocumentProcessResponseSchema } from '../src/api/knowledge';

const parsed = knowledgeDocumentProcessResponseSchema.parse({
  id: 'doc_1',
  name: 'notes.txt',
  type: 'TXT',
  size: 128,
  mimeType: 'text/plain',
  status: 'PROCESSING',
  sourceType: 'UPLOAD',
  errorMessage: null,
  contentHash: 'sha256:abc',
  chunkCount: 0,
  processedAt: null,
  createdAt: '2026-06-29T00:00:00.000Z',
  updatedAt: '2026-06-29T00:00:01.000Z',
  processing: {
    mode: 'queue',
    backgroundJobId: 'job_1',
    status: 'QUEUED',
    queuedAt: '2026-06-29T00:00:01.000Z',
  },
});

assert.equal(parsed.status, 'PROCESSING');
assert.equal(parsed.processing?.status, 'QUEUED');
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
bun test packages/types/tests/background-job.test.mts
bun test packages/types/tests/knowledge-processing.test.mts
```

Expected: `background-job` import fails and `processing` metadata is not accepted by the current knowledge process schema.

- [ ] **Step 3: Implement shared schemas**

Create `packages/types/src/api/background-job.ts`:

```ts
import { z } from 'zod';

const numericQuerySchema = (defaultValue: number, min: number, max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'string') return Number(value);
    return value;
  }, z.number().int().min(min).max(max).default(defaultValue));

export const backgroundJobStatusSchema = z.enum([
  'QUEUED',
  'ACTIVE',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'STALE_SKIPPED',
]);

export const backgroundJobResourceTypeSchema = z.enum(['KNOWLEDGE_DOCUMENT']);

export const backgroundJobResponseSchema = z.object({
  id: z.string(),
  queueName: z.string(),
  jobName: z.string(),
  status: backgroundJobStatusSchema,
  resourceType: backgroundJobResourceTypeSchema,
  resourceId: z.string(),
  attempt: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  progress: z.number().int().min(0).max(100),
  payloadPreview: z.record(z.unknown()).nullable(),
  resultSummary: z.record(z.unknown()).nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  requestedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const backgroundJobListQuerySchema = z
  .object({
    resourceType: backgroundJobResourceTypeSchema.optional(),
    resourceId: z.string().trim().min(1).optional(),
    status: backgroundJobStatusSchema.optional(),
    limit: numericQuerySchema(10, 1, 50),
  })
  .strict();

export const backgroundJobListResponseSchema = z.object({
  items: z.array(backgroundJobResponseSchema),
});

export type BackgroundJobStatus = z.infer<typeof backgroundJobStatusSchema>;
export type BackgroundJobResourceType = z.infer<typeof backgroundJobResourceTypeSchema>;
export type BackgroundJobResponse = z.infer<typeof backgroundJobResponseSchema>;
export type BackgroundJobListQuery = z.infer<typeof backgroundJobListQuerySchema>;
export type BackgroundJobListResponse = z.infer<typeof backgroundJobListResponseSchema>;
```

Modify `packages/types/src/api/knowledge.ts`:

```ts
import { backgroundJobStatusSchema } from './background-job';
```

Add:

```ts
export const knowledgeDocumentProcessingMetadataSchema = z.object({
  mode: z.literal('queue'),
  backgroundJobId: z.string().min(1),
  status: backgroundJobStatusSchema,
  queuedAt: z.string().datetime(),
});
```

Change:

```ts
export const knowledgeDocumentProcessResponseSchema = knowledgeDocumentResponseSchema;
```

to:

```ts
export const knowledgeDocumentProcessResponseSchema =
  knowledgeDocumentResponseSchema.extend({
    processing: knowledgeDocumentProcessingMetadataSchema.optional(),
  });
```

Export the new type:

```ts
export type KnowledgeDocumentProcessingMetadata = z.infer<
  typeof knowledgeDocumentProcessingMetadataSchema
>;
```

Modify `packages/types/src/api/index.ts`:

```ts
export * from './background-job';
```

Modify `packages/types/package.json` exports:

```json
"./api/background-job": "./src/api/background-job.ts"
```

- [ ] **Step 4: Verify and commit**

Run:

```powershell
bun test packages/types/tests/background-job.test.mts
bun test packages/types/tests/knowledge-processing.test.mts
bun --cwd packages/types typecheck
git diff --check
```

Commit:

```powershell
git add packages/types/src/api/background-job.ts packages/types/src/api/knowledge.ts packages/types/src/api/index.ts packages/types/package.json packages/types/tests/background-job.test.mts packages/types/tests/knowledge-processing.test.mts
git commit -m "feat(types): add background job contracts"
```

---

## Task 2: Database Model and Migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_background_jobs/migration.sql`

- [ ] **Step 1: Add Prisma schema model**

Modify `packages/database/prisma/schema.prisma`:

```prisma
model User {
  // keep existing fields
  backgroundJobs BackgroundJob[]
}

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

enum BackgroundJobStatus {
  QUEUED
  ACTIVE
  SUCCEEDED
  FAILED
  CANCELLED
  STALE_SKIPPED
}
```

- [ ] **Step 2: Create migration SQL**

Run:

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --filter @repo/database prisma:migrate -- --name background_jobs --create-only
```

Open the generated migration and add the partial unique index after the table/index creation SQL:

```sql
CREATE UNIQUE INDEX "BackgroundJob_active_dedupeKey_unique"
ON "BackgroundJob"("dedupeKey")
WHERE "status" IN ('QUEUED', 'ACTIVE') AND "dedupeKey" IS NOT NULL;
```

- [ ] **Step 3: Verify database package**

Run:

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --cwd packages/database test
bun run db:generate
git diff --check
```

Expected: Prisma schema typecheck passes and client generation succeeds.

- [ ] **Step 4: Commit**

```powershell
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat(database): add background job model"
```

---

## Task 3: Server Env, Jobs Module, and Background Job API

**Files:**
- Modify: `apps/server/package.json`
- Modify: `apps/server/src/config/env.ts`
- Create: `apps/server/src/jobs/jobs.module.ts`
- Create: `apps/server/src/jobs/redis-url.ts`
- Create: `apps/server/src/jobs/job-error-sanitizer.ts`
- Create: `apps/server/src/jobs/worker-role.ts`
- Create: `apps/server/src/jobs/worker-role.spec.ts`
- Create: `apps/server/src/events/event-bus.ts`
- Create: `apps/server/src/events/events.module.ts`
- Create: `apps/server/src/events/event-bus.spec.ts`
- Create: `apps/server/src/background-jobs/background-jobs.module.ts`
- Create: `apps/server/src/background-jobs/background-jobs.controller.ts`
- Create: `apps/server/src/background-jobs/background-jobs.service.ts`
- Create: `apps/server/src/background-jobs/background-jobs.service.spec.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Write failing BackgroundJobService tests**

Create `apps/server/src/background-jobs/background-jobs.service.spec.ts`:

```ts
import { BackgroundJobsService } from './background-jobs.service';

describe('BackgroundJobsService', () => {
  const now = new Date('2026-06-29T00:00:00.000Z');
  const prisma = {
    backgroundJob: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a queued sanitized job for the current user', async () => {
    prisma.backgroundJob.create.mockResolvedValue(jobRow({ status: 'QUEUED' }));

    const result = await createService().createQueuedJob({
      userId: 'user_1',
      queueName: 'knowledge-document-processing',
      jobName: 'process-document',
      resourceType: 'KNOWLEDGE_DOCUMENT',
      resourceId: 'doc_1',
      idempotencyKey: 'knowledge-process:user_1:doc_1:key',
      dedupeKey: 'knowledge-process-active:user_1:doc_1',
      maxAttempts: 3,
      payloadPreview: { documentId: 'doc_1', force: false },
    });

    expect(prisma.backgroundJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        status: 'QUEUED',
        payloadPreview: { documentId: 'doc_1', force: false },
      }),
    });
    expect(result.status).toBe('QUEUED');
  });

  it('marks a job active only when it belongs to the same user and resource', async () => {
    prisma.backgroundJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.backgroundJob.findFirst.mockResolvedValue(jobRow({ status: 'ACTIVE' }));

    const result = await createService().markActive({
      id: 'job_1',
      userId: 'user_1',
      resourceType: 'KNOWLEDGE_DOCUMENT',
      resourceId: 'doc_1',
      attempt: 1,
    });

    expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'job_1',
        userId: 'user_1',
        resourceType: 'KNOWLEDGE_DOCUMENT',
        resourceId: 'doc_1',
        status: { in: ['QUEUED', 'ACTIVE'] },
      },
      data: expect.objectContaining({
        status: 'ACTIVE',
        attempt: 1,
        startedAt: now,
      }),
    });
    expect(result?.status).toBe('ACTIVE');
  });

  it('lists only current user jobs with resource filters', async () => {
    prisma.backgroundJob.findMany.mockResolvedValue([jobRow({ status: 'SUCCEEDED' })]);

    const result = await createService().list('user_1', {
      resourceType: 'KNOWLEDGE_DOCUMENT',
      resourceId: 'doc_1',
      limit: 10,
    });

    expect(prisma.backgroundJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user_1',
          resourceType: 'KNOWLEDGE_DOCUMENT',
          resourceId: 'doc_1',
        },
        take: 10,
      }),
    );
    expect(result.items).toHaveLength(1);
  });

  function createService() {
    return new BackgroundJobsService(prisma as never);
  }

  function jobRow(input: { status: string }) {
    return {
      id: 'job_1',
      userId: 'user_1',
      queueName: 'knowledge-document-processing',
      jobName: 'process-document',
      bullJobId: 'job_1',
      status: input.status,
      resourceType: 'KNOWLEDGE_DOCUMENT',
      resourceId: 'doc_1',
      idempotencyKey: 'idem',
      dedupeKey: 'dedupe',
      attempt: 1,
      maxAttempts: 3,
      progress: 0,
      payloadHash: null,
      payloadPreview: { documentId: 'doc_1' },
      resultSummary: null,
      errorCode: null,
      errorMessage: null,
      requestedAt: now,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }
});
```

Create `apps/server/src/events/event-bus.spec.ts`:

```ts
import { InProcessEventBus } from './event-bus';

describe('InProcessEventBus', () => {
  it('publishes typed events to subscribers and supports unsubscribe', () => {
    const bus = new InProcessEventBus();
    const received: Array<{ type: string; documentId: string }> = [];

    const unsubscribe = bus.subscribe('knowledge.document.processing.succeeded', (event) => {
      received.push(event as { type: string; documentId: string });
    });

    bus.publish({
      type: 'knowledge.document.processing.succeeded',
      userId: 'user_1',
      documentId: 'doc_1',
      backgroundJobId: 'job_1',
      chunkCount: 2,
      durationMs: 120,
      finishedAt: '2026-06-29T00:00:00.000Z',
    });
    unsubscribe();
    bus.publish({
      type: 'knowledge.document.processing.succeeded',
      userId: 'user_1',
      documentId: 'doc_2',
      backgroundJobId: 'job_2',
      chunkCount: 1,
      durationMs: 80,
      finishedAt: '2026-06-29T00:00:01.000Z',
    });

    expect(received).toEqual([
      {
        type: 'knowledge.document.processing.succeeded',
        documentId: 'doc_1',
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun --filter @repo/server test -- background-jobs
```

Expected: fail because `BackgroundJobsService` and `InProcessEventBus` do not exist.

- [ ] **Step 3: Add dependencies and env fields**

Modify `apps/server/package.json` dependencies:

```json
"@nestjs/bullmq": "^11.0.0",
"bullmq": "^5.0.0"
```

Run after editing:

```powershell
bun install
```

Modify `apps/server/src/config/env.ts`:

```ts
SERVER_ROLE: z.enum(['api', 'worker', 'both']).default('both'),
BULLMQ_PREFIX: z.string().min(1).default('prepmind'),
KNOWLEDGE_PROCESSING_MODE: z.enum(['inline', 'queue']).default('inline'),
KNOWLEDGE_PROCESSING_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
KNOWLEDGE_PROCESSING_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
KNOWLEDGE_PROCESSING_JOB_TIMEOUT_MS: z.coerce
  .number()
  .int()
  .min(10_000)
  .max(600_000)
  .default(120_000),
KNOWLEDGE_PROCESSING_LOCK_DURATION_MS: z.coerce
  .number()
  .int()
  .min(10_000)
  .max(300_000)
  .default(60_000),
KNOWLEDGE_PROCESSING_GLOBAL_RATE_LIMIT: z.coerce
  .number()
  .int()
  .min(1)
  .max(300)
  .default(30),
KNOWLEDGE_PROCESSING_PER_USER_ACTIVE_LIMIT: z.coerce
  .number()
  .int()
  .min(1)
  .max(10)
  .default(2),
EMBEDDING_REQUEST_TIMEOUT_MS: z.coerce
  .number()
  .int()
  .min(5_000)
  .max(120_000)
  .default(30_000),
```

- [ ] **Step 4: Implement jobs module and service**

Create `apps/server/src/jobs/redis-url.ts`:

```ts
export function parseRedisUrl(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname ? Number(url.pathname.slice(1) || 0) : 0,
  };
}
```

Create `apps/server/src/jobs/job-error-sanitizer.ts`:

```ts
const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /DEEPSEEK_API_KEY\s*=\s*\S+/gi,
  /OPENAI_API_KEY\s*=\s*\S+/gi,
  /Cookie:\s*[^,\n]+/gi,
];

export function sanitizeJobError(error: unknown, fallback = '后台任务执行失败') {
  const raw = error instanceof Error ? error.message : String(error || fallback);
  const redacted = SECRET_PATTERNS.reduce(
    (value, pattern) => value.replace(pattern, '[redacted]'),
    raw,
  );
  return redacted.slice(0, 500) || fallback;
}
```

Create `apps/server/src/jobs/jobs.module.ts` using `BullModule.forRootAsync` and `parseRedisUrl(config.get('REDIS_URL'))`. Register only shared connection here; feature queues are registered in their feature modules.

Create `apps/server/src/events/event-bus.ts`:

```ts
export type ServerEvent =
  | {
      type: 'knowledge.document.processing.requested';
      userId: string;
      documentId: string;
      backgroundJobId: string;
      contentHash: string | null;
      storageKey: string;
      requestedAt: string;
    }
  | {
      type: 'knowledge.document.processing.succeeded';
      userId: string;
      documentId: string;
      backgroundJobId: string;
      chunkCount: number;
      durationMs: number;
      finishedAt: string;
    }
  | {
      type: 'knowledge.document.processing.failed';
      userId: string;
      documentId: string;
      backgroundJobId: string;
      errorCode: string;
      retryable: boolean;
      finishedAt: string;
    }
  | {
      type: 'knowledge.document.processing.stale_skipped';
      userId: string;
      documentId: string;
      backgroundJobId: string;
      reason: 'document_missing' | 'snapshot_changed' | 'status_not_processing' | 'job_not_active';
      skippedAt: string;
    };

type Handler<T extends ServerEvent> = (event: T) => void;

export class InProcessEventBus {
  private readonly handlers = new Map<ServerEvent['type'], Set<Handler<ServerEvent>>>();

  publish(event: ServerEvent): void {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(event);
    }
  }

  subscribe<T extends ServerEvent['type']>(
    type: T,
    handler: Handler<Extract<ServerEvent, { type: T }>>,
  ): () => void {
    const handlers = this.handlers.get(type) ?? new Set<Handler<ServerEvent>>();
    handlers.add(handler as Handler<ServerEvent>);
    this.handlers.set(type, handlers);
    return () => handlers.delete(handler as Handler<ServerEvent>);
  }
}
```

Create `apps/server/src/events/events.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';

import { InProcessEventBus } from './event-bus';

export const EVENT_BUS = Symbol('EVENT_BUS');

@Global()
@Module({
  providers: [{ provide: EVENT_BUS, useClass: InProcessEventBus }],
  exports: [EVENT_BUS],
})
export class EventsModule {}
```

Import `EventsModule` in `AppModule` so producer and processor receive the same bus instance through Nest DI. Do not instantiate separate event buses inside feature modules.

Implement `BackgroundJobsService` with methods:

```ts
createQueuedJob(input)
findActiveForResource(userId, resourceType, resourceId)
markActive(input)
markSucceeded(input)
markRetryableFailure(input)
markFailed(input)
markStaleSkipped(input)
getById(userId, id)
list(userId, query)
```

All response mapping must use the shared `BackgroundJobResponse` shape and never return raw payload.

Create `BackgroundJobsController`:

```ts
@Controller('background-jobs')
@UseGuards(JwtAuthGuard)
export class BackgroundJobsController {
  constructor(private readonly service: BackgroundJobsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.service.list(user.id, backgroundJobListQuerySchema.parse(query));
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getById(user.id, id);
  }
}
```

Register `BackgroundJobsModule` and `JobsModule` in `AppModule`.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
bun --filter @repo/server test -- background-jobs event-bus worker-role
bun --filter @repo/server build
git diff --check
```

Commit:

```powershell
git add apps/server/package.json bun.lock apps/server/src/config/env.ts apps/server/src/jobs apps/server/src/events apps/server/src/background-jobs apps/server/src/app.module.ts
git commit -m "feat(server): add background job control plane"
```

---

## Task 4: Refactor Document Processing Pipeline

**Files:**
- Modify: `apps/server/src/knowledge-documents/document-processing.service.ts`
- Modify: `apps/server/src/knowledge-documents/document-processing.service.spec.ts`

- [ ] **Step 1: Add failing pipeline tests**

Extend `document-processing.service.spec.ts` with:

```ts
it('runs a claimed processing pipeline without marking failed on retryable provider errors', async () => {
  const failure = new Error('provider unavailable');
  embedding.embedChunks.mockRejectedValue(failure);

  await expect(
    createService().runProcessingPipeline({
      userId: 'user_1',
      documentId: 'doc_1',
      expectedDocument: {
        storageKey: 'users/user_1/knowledge/notes.txt',
        contentHash: 'sha256:abc',
      },
    }),
  ).rejects.toBe(failure);

  expect(prisma.document.updateMany).not.toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED' }),
    }),
  );
});

it('inline processDocument still marks failed for the existing synchronous contract', async () => {
  const failure = new Error('provider unavailable');
  embedding.embedChunks.mockRejectedValue(failure);

  await expect(
    createService().processDocument('user_1', 'doc_1', { force: false }),
  ).rejects.toBe(failure);

  expect(prisma.document.updateMany).toHaveBeenLastCalledWith({
    where: {
      id: 'doc_1',
      userId: 'user_1',
      status: 'PROCESSING',
      storageKey: 'users/user_1/knowledge/notes.txt',
      contentHash: 'sha256:abc',
    },
    data: {
      status: 'FAILED',
      errorMessage: '资料处理失败，请稍后重试',
    },
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun --filter @repo/server test -- document-processing
```

Expected: fail because `runProcessingPipeline` does not exist.

- [ ] **Step 3: Refactor service**

In `DocumentProcessingService`:

- Keep `processDocument(userId, documentId, options)` as the inline public method.
- Add `claimDocumentForProcessing(userId, documentId, options)` returning the claimed document snapshot.
- Add `runProcessingPipeline(input)` that receives `{ userId, documentId, expectedDocument }`.
- Move storage read, parsing, splitting, embedding, chunk replacement, and `markDone` into `runProcessingPipeline`.
- Keep `processDocument` wrapping `claimDocumentForProcessing` + `runProcessingPipeline` in a catch that calls `markFailed`.
- Keep `assertProcessable`, snapshot matching, `markDone`, `markFailed`, and `toResponse` behavior compatible with current tests.

The public method signature for the new pipeline should be:

```ts
async runProcessingPipeline(input: {
  userId: string;
  documentId: string;
  expectedDocument: { storageKey: string; contentHash: string | null };
})
```

This method must not call `markFailed` in its catch path.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
bun --filter @repo/server test -- document-processing
bun --filter @repo/server build
git diff --check
```

Commit:

```powershell
git add apps/server/src/knowledge-documents/document-processing.service.ts apps/server/src/knowledge-documents/document-processing.service.spec.ts
git commit -m "refactor(server): split document processing pipeline"
```

---

## Task 5: Knowledge Document Queue Producer

**Files:**
- Create: `apps/server/src/knowledge-documents/jobs/process-document.job.ts`
- Create: `apps/server/src/knowledge-documents/jobs/document-processing-job.service.ts`
- Create: `apps/server/src/knowledge-documents/jobs/document-processing-job.service.spec.ts`
- Modify: `apps/server/src/knowledge-documents/knowledge-documents.module.ts`

- [ ] **Step 1: Write failing producer tests**

Create `apps/server/src/knowledge-documents/jobs/document-processing-job.service.spec.ts`:

```ts
import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { DocumentProcessingJobService } from './document-processing-job.service';

describe('DocumentProcessingJobService', () => {
  const now = new Date('2026-06-29T00:00:00.000Z');
  const queue = { add: jest.fn() };
  const prisma = {
    $transaction: jest.fn(),
    document: { findFirst: jest.fn(), updateMany: jest.fn() },
    backgroundJob: { create: jest.fn(), findFirst: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
  };
  const processing = {
    processDocument: jest.fn(),
    toResponse: jest.fn(),
  };
  const eventBus = { publish: jest.fn() };
  const config = { get: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    config.get.mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        KNOWLEDGE_PROCESSING_MODE: 'queue',
        KNOWLEDGE_PROCESSING_ATTEMPTS: 3,
        KNOWLEDGE_PROCESSING_JOB_TIMEOUT_MS: 120000,
        KNOWLEDGE_PROCESSING_PER_USER_ACTIVE_LIMIT: 2,
      };
      return values[key];
    });
    queue.add.mockResolvedValue({ id: 'job_1' });
  });

  afterEach(() => jest.useRealTimers());

  it('creates a background job and enqueues it after a processing claim', async () => {
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

    const result = await createService().enqueueOrRun('user_1', 'doc_1', {
      force: false,
    });

    expect(queue.add).toHaveBeenCalledWith(
      'process-document',
      expect.objectContaining({
        backgroundJobId: 'job_1',
        userId: 'user_1',
        documentId: 'doc_1',
        snapshot: {
          storageKey: 'users/user_1/knowledge/notes.txt',
          contentHash: 'sha256:abc',
        },
      }),
      expect.objectContaining({
        jobId: 'job_1',
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 3000 },
      }),
    );
    expect(result.processing?.backgroundJobId).toBe('job_1');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'knowledge.document.processing.requested',
        documentId: 'doc_1',
        backgroundJobId: 'job_1',
      }),
    );
  });

  it('falls back to inline processing when mode is inline', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'KNOWLEDGE_PROCESSING_MODE' ? 'inline' : 3,
    );
    processing.processDocument.mockResolvedValue({ id: 'doc_1', status: 'DONE' });

    await expect(
      createService().enqueueOrRun('user_1', 'doc_1', { force: false }),
    ).resolves.toEqual({ id: 'doc_1', status: 'DONE' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('returns the existing active job when the document is already processing', async () => {
    prisma.$transaction.mockImplementation(async () => {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_PROCESSING',
        '资料正在处理中',
        HttpStatus.CONFLICT,
      );
    });
    prisma.backgroundJob.findFirst.mockResolvedValue(jobRow());
    processing.toResponse.mockReturnValue({ id: 'doc_1', status: 'PROCESSING' });

    const result = await createService().enqueueOrRun('user_1', 'doc_1', {
      force: false,
    });

    expect(result.processing?.backgroundJobId).toBe('job_1');
  });

  it('marks the job and document failed when enqueue fails after the claim transaction commits', async () => {
    const document = documentRow();
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        document: {
          findFirst: jest.fn().mockResolvedValue(document),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        backgroundJob: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockResolvedValue(jobRow()),
        },
      }),
    );
    queue.add.mockRejectedValue(new Error('redis unavailable'));

    await expect(
      createService().enqueueOrRun('user_1', 'doc_1', { force: false }),
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_DOCUMENT_PROCESSING_QUEUE_FAILED' });

    expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'job_1', userId: 'user_1' }),
        data: expect.objectContaining({ status: 'FAILED', errorCode: 'ENQUEUE_FAILED' }),
      }),
    );
    expect(prisma.document.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'doc_1',
          userId: 'user_1',
          status: 'PROCESSING',
          storageKey: 'users/user_1/knowledge/notes.txt',
          contentHash: 'sha256:abc',
        }),
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  function createService() {
    return new DocumentProcessingJobService(
      prisma as never,
      queue as never,
      processing as never,
      config as never,
      eventBus as never,
    );
  }

  function documentRow() {
    return {
      id: 'doc_1',
      userId: 'user_1',
      name: 'notes.txt',
      type: 'TXT',
      size: 128,
      mimeType: 'text/plain',
      storageKey: 'users/user_1/knowledge/notes.txt',
      status: 'PENDING',
      sourceType: 'UPLOAD',
      errorMessage: null,
      contentHash: 'sha256:abc',
      processedAt: null,
      createdAt: now,
      updatedAt: now,
      _count: { chunks: 0 },
    };
  }

  function jobRow() {
    return {
      id: 'job_1',
      status: 'QUEUED',
      requestedAt: now,
    };
  }
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun --filter @repo/server test -- document-processing-job
```

Expected: fail because producer files do not exist.

- [ ] **Step 3: Implement producer and payload schema**

Create `apps/server/src/knowledge-documents/jobs/process-document.job.ts`:

```ts
import { z } from 'zod';

export const PROCESS_KNOWLEDGE_DOCUMENT_QUEUE = 'knowledge-document-processing';
export const PROCESS_KNOWLEDGE_DOCUMENT_JOB = 'process-document';

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

export type ProcessKnowledgeDocumentJobPayload = z.infer<
  typeof processKnowledgeDocumentJobPayloadSchema
>;
```

Implement `DocumentProcessingJobService.enqueueOrRun(userId, documentId, input)`:

- If `KNOWLEDGE_PROCESSING_MODE === 'inline'`, call existing `DocumentProcessingService.processDocument`.
- If queue mode:
  - In one Prisma transaction:
    - read current user document with `_count.chunks`.
    - reject missing/cross-user.
    - reject `DONE` without force.
    - reject per-user active job limit.
    - conditional update document to `PROCESSING`.
    - create `BackgroundJob(QUEUED)` with `dedupeKey=knowledge-process-active:${userId}:${documentId}`.
  - After commit, enqueue BullMQ with `jobId=backgroundJob.id`, attempts, exponential backoff, and retention options.
  - Publish `knowledge.document.processing.requested` after enqueue succeeds.
  - If enqueue fails, mark job failed and mark document failed by snapshot.
  - Return document response extended with `processing`.
- If document is already `PROCESSING`, find active job by user/resource/status and return it.

Register `BullModule.registerQueue({ name: PROCESS_KNOWLEDGE_DOCUMENT_QUEUE })` in `KnowledgeDocumentsModule`.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
bun --filter @repo/server test -- document-processing-job
bun --filter @repo/server build
git diff --check
```

Commit:

```powershell
git add apps/server/src/knowledge-documents/jobs/process-document.job.ts apps/server/src/knowledge-documents/jobs/document-processing-job.service.ts apps/server/src/knowledge-documents/jobs/document-processing-job.service.spec.ts apps/server/src/knowledge-documents/knowledge-documents.module.ts
git commit -m "feat(server): enqueue knowledge document processing"
```

---

## Task 6: Knowledge Document Queue Processor

**Files:**
- Create: `apps/server/src/knowledge-documents/jobs/document-processing.processor.ts`
- Create: `apps/server/src/knowledge-documents/jobs/document-processing.processor.spec.ts`
- Modify: `apps/server/src/knowledge-documents/knowledge-documents.module.ts`

- [ ] **Step 1: Write failing processor tests**

Create `apps/server/src/knowledge-documents/jobs/document-processing.processor.spec.ts`:

```ts
import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { DocumentProcessingProcessor } from './document-processing.processor';

describe('DocumentProcessingProcessor', () => {
  const job = {
    id: 'job_1',
    attemptsMade: 0,
    opts: { attempts: 3 },
    data: {
      backgroundJobId: 'job_1',
      userId: 'user_1',
      documentId: 'doc_1',
      force: false,
      snapshot: {
        storageKey: 'users/user_1/knowledge/notes.txt',
        contentHash: 'sha256:abc',
      },
      requestedAt: '2026-06-29T00:00:00.000Z',
    },
  };
  const backgroundJobs = {
    markActive: jest.fn(),
    markSucceeded: jest.fn(),
    markRetryableFailure: jest.fn(),
    markFailed: jest.fn(),
    markStaleSkipped: jest.fn(),
  };
  const processing = {
    runProcessingPipeline: jest.fn(),
  };
  const eventBus = {
    publish: jest.fn(),
  };
  const prisma = {
    document: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    backgroundJobs.markActive.mockResolvedValue({ id: 'job_1', status: 'ACTIVE' });
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc_1',
      userId: 'user_1',
      status: 'PROCESSING',
      storageKey: 'users/user_1/knowledge/notes.txt',
      contentHash: 'sha256:abc',
    });
    processing.runProcessingPipeline.mockResolvedValue({
      id: 'doc_1',
      status: 'DONE',
      chunkCount: 2,
    });
  });

  it('marks active, runs the processing pipeline, and marks succeeded', async () => {
    await createProcessor().process(job as never);

    expect(backgroundJobs.markActive).toHaveBeenCalledWith({
      id: 'job_1',
      userId: 'user_1',
      resourceType: 'KNOWLEDGE_DOCUMENT',
      resourceId: 'doc_1',
      attempt: 1,
    });
    expect(processing.runProcessingPipeline).toHaveBeenCalledWith({
      userId: 'user_1',
      documentId: 'doc_1',
      expectedDocument: {
        storageKey: 'users/user_1/knowledge/notes.txt',
        contentHash: 'sha256:abc',
      },
    });
    expect(backgroundJobs.markSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job_1',
        resultSummary: expect.objectContaining({ chunkCount: 2 }),
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'knowledge.document.processing.succeeded',
        documentId: 'doc_1',
      }),
    );
  });

  it('stale skips when the document snapshot no longer matches', async () => {
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc_1',
      userId: 'user_1',
      status: 'PROCESSING',
      storageKey: 'users/user_1/knowledge/new.txt',
      contentHash: 'sha256:new',
    });

    await createProcessor().process(job as never);

    expect(backgroundJobs.markStaleSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'snapshot_changed' }),
    );
    expect(processing.runProcessingPipeline).not.toHaveBeenCalled();
  });

  it('rethrows retryable failures before attempts are exhausted', async () => {
    const failure = new Error('provider unavailable');
    processing.runProcessingPipeline.mockRejectedValue(failure);

    await expect(createProcessor().process(job as never)).rejects.toBe(failure);

    expect(backgroundJobs.markRetryableFailure).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job_1', errorCode: 'RETRYABLE_ERROR' }),
    );
    expect(backgroundJobs.markFailed).not.toHaveBeenCalled();
  });

  it('marks final failure when retry attempts are exhausted', async () => {
    const failure = new Error('provider unavailable');
    processing.runProcessingPipeline.mockRejectedValue(failure);

    await expect(
      createProcessor().process({
        ...job,
        attemptsMade: 2,
        opts: { attempts: 3 },
      } as never),
    ).rejects.toBe(failure);

    expect(backgroundJobs.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job_1', errorCode: 'RETRY_EXHAUSTED' }),
    );
    expect(backgroundJobs.markRetryableFailure).not.toHaveBeenCalled();
  });

  it('marks non-retryable business failures immediately', async () => {
    const failure = new AppError(
      'KNOWLEDGE_DOCUMENT_EMPTY_TEXT',
      '资料中没有可解析的文本',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
    processing.runProcessingPipeline.mockRejectedValue(failure);

    await expect(createProcessor().process(job as never)).rejects.toBe(failure);

    expect(backgroundJobs.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job_1',
        errorCode: 'KNOWLEDGE_DOCUMENT_EMPTY_TEXT',
      }),
    );
    expect(backgroundJobs.markRetryableFailure).not.toHaveBeenCalled();
  });

  function createProcessor() {
    return new DocumentProcessingProcessor(
      backgroundJobs as never,
      processing as never,
      prisma as never,
      eventBus as never,
    );
  }
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun --filter @repo/server test -- document-processing.processor
```

Expected: fail because processor does not exist.

- [ ] **Step 3: Implement processor**

Implement processor using `@Processor(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE)` and `WorkerHost`, but only register this provider when `SERVER_ROLE` is `worker` or `both`. Worker options must read `KNOWLEDGE_PROCESSING_CONCURRENCY` and `KNOWLEDGE_PROCESSING_LOCK_DURATION_MS` from config; queue-level limiter must use `KNOWLEDGE_PROCESSING_GLOBAL_RATE_LIMIT` when registering the queue.

Processor behavior:

- Parse `job.data` with `processKnowledgeDocumentJobPayloadSchema`.
- Call `backgroundJobs.markActive`.
- If `markActive` returns null, exit without touching document/chunks.
- Read `Document` by `{ id, userId }`.
- If missing, mark stale skipped with `document_missing`.
- If status is not `PROCESSING`, mark stale skipped with `status_not_processing`.
- If `storageKey/contentHash` differ, mark stale skipped with `snapshot_changed`.
- Run `DocumentProcessingService.runProcessingPipeline`.
- On success, mark job succeeded with `chunkCount` and `durationMs`, then publish `knowledge.document.processing.succeeded`.
- On retryable failure and attempts remain, mark retryable failure and rethrow.
- On final failure, mark job failed, call a `DocumentProcessingService.markFailedForSnapshot` helper, then publish `knowledge.document.processing.failed`.
- On stale skip, publish `knowledge.document.processing.stale_skipped`.

Do not register the BullMQ processor in `SERVER_ROLE=api`. A processor that starts and then returns early from `process()` can still steal jobs from real workers and cause Redis job completion while `BackgroundJob` and `Document` remain unfinished. Use a dynamic provider list in `KnowledgeDocumentsModule`:

```ts
const knowledgeDocumentProcessorProviders =
  shouldRegisterWorkers(process.env.SERVER_ROLE as 'api' | 'worker' | 'both')
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

Create `apps/server/src/jobs/worker-role.ts` and use it from `KnowledgeDocumentsModule`:

```ts
import type { ServerEnv } from '../config/env';

export function shouldRegisterWorkers(role: ServerEnv['SERVER_ROLE']) {
  return role === 'worker' || role === 'both';
}
```

Add `apps/server/src/jobs/worker-role.spec.ts`:

```ts
import { shouldRegisterWorkers } from './worker-role';

describe('shouldRegisterWorkers', () => {
  it('does not register BullMQ workers in api-only processes', () => {
    expect(shouldRegisterWorkers('api')).toBe(false);
    expect(shouldRegisterWorkers('worker')).toBe(true);
    expect(shouldRegisterWorkers('both')).toBe(true);
  });
});
```

The key requirement is that API-only processes must not instantiate a BullMQ worker for this queue.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
bun --filter @repo/server test -- document-processing.processor
bun --filter @repo/server build
git diff --check
```

Commit:

```powershell
git add apps/server/src/knowledge-documents/jobs/document-processing.processor.ts apps/server/src/knowledge-documents/jobs/document-processing.processor.spec.ts apps/server/src/knowledge-documents/knowledge-documents.module.ts
git commit -m "feat(server): process knowledge documents in worker"
```

---

## Task 7: Process API Mode Switch

**Files:**
- Modify: `apps/server/src/knowledge-documents/knowledge-documents.controller.ts`
- Modify: `apps/server/src/knowledge-documents/knowledge-documents.module.ts`
- Create: `apps/server/src/knowledge-documents/knowledge-documents.controller.spec.ts`

- [ ] **Step 1: Add failing controller test**

Create or extend controller test:

```ts
it('routes process requests through DocumentProcessingJobService', async () => {
  const service = { enqueueOrRun: jest.fn().mockResolvedValue({ id: 'doc_1' }) };
  const controller = new KnowledgeDocumentsController(
    {} as never,
    service as never,
  );

  await controller.process(
    { id: 'user_1', email: 'u@example.com' },
    'doc_1',
    { force: false },
  );

  expect(service.enqueueOrRun).toHaveBeenCalledWith('user_1', 'doc_1', {
    force: false,
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun --filter @repo/server test -- knowledge-documents.controller
```

Expected: fail because controller still injects `DocumentProcessingService`.

- [ ] **Step 3: Update controller wiring**

Change `KnowledgeDocumentsController` constructor to inject `DocumentProcessingJobService` instead of `DocumentProcessingService`.

Change `process()` to:

```ts
const input = knowledgeDocumentProcessRequestSchema.parse(body ?? {});
return this.documentProcessingJobService.enqueueOrRun(user.id, id, input);
```

Ensure `KnowledgeDocumentsModule` provides and exports `DocumentProcessingJobService`.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
bun --filter @repo/server test -- knowledge-documents document-processing document-processing-job
bun --filter @repo/server build
git diff --check
```

Commit:

```powershell
git add apps/server/src/knowledge-documents/knowledge-documents.controller.ts apps/server/src/knowledge-documents/knowledge-documents.module.ts apps/server/src/knowledge-documents/knowledge-documents.controller.spec.ts
git commit -m "feat(server): switch knowledge processing by mode"
```

---

## Task 8: Web Background Job Client and Knowledge Polling

**Files:**
- Create: `apps/web/src/lib/background-job-api.ts`
- Create: `apps/web/src/lib/background-job-api.test.mts`
- Create: `apps/web/src/hooks/use-background-jobs.ts`
- Modify: `apps/web/src/lib/knowledge-api.ts`
- Modify: `apps/web/src/hooks/use-knowledge.ts`
- Modify: `apps/web/src/app/(main)/knowledge/page.tsx`

- [ ] **Step 1: Write failing web client tests**

Create `apps/web/src/lib/background-job-api.test.mts`:

```ts
import assert from 'node:assert/strict';

import { createBackgroundJobApi } from './background-job-api';

const calls: string[] = [];
const api = createBackgroundJobApi({
  get: async (path) => {
    calls.push(path);
    return {
      items: [
        {
          id: 'job_1',
          queueName: 'knowledge-document-processing',
          jobName: 'process-document',
          status: 'ACTIVE',
          resourceType: 'KNOWLEDGE_DOCUMENT',
          resourceId: 'doc_1',
          attempt: 1,
          maxAttempts: 3,
          progress: 0,
          payloadPreview: { documentId: 'doc_1' },
          resultSummary: null,
          errorCode: null,
          errorMessage: null,
          requestedAt: '2026-06-29T00:00:00.000Z',
          startedAt: '2026-06-29T00:00:01.000Z',
          finishedAt: null,
          createdAt: '2026-06-29T00:00:00.000Z',
          updatedAt: '2026-06-29T00:00:01.000Z',
        },
      ],
    };
  },
});

const result = await api.list('token', {
  resourceType: 'KNOWLEDGE_DOCUMENT',
  resourceId: 'doc_1',
  limit: 10,
});

assert.equal(
  calls[0],
  '/background-jobs?resourceType=KNOWLEDGE_DOCUMENT&resourceId=doc_1&limit=10',
);
assert.equal(result.items[0]?.status, 'ACTIVE');
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun --filter @repo/web test -- background-job-api
```

Expected: fail because `background-job-api.ts` does not exist.

- [ ] **Step 3: Implement web job client and hooks**

Create `apps/web/src/lib/background-job-api.ts`:

```ts
import {
  backgroundJobListQuerySchema,
  backgroundJobListResponseSchema,
  backgroundJobResponseSchema,
  type BackgroundJobListQuery,
} from '@repo/types/api/background-job';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

export function createBackgroundJobApi(client: ApiClient) {
  return {
    async list(accessToken: string, query: BackgroundJobListQuery) {
      const parsed = backgroundJobListQuerySchema.parse(query);
      const params = new URLSearchParams();
      if (parsed.resourceType) params.set('resourceType', parsed.resourceType);
      if (parsed.resourceId) params.set('resourceId', parsed.resourceId);
      if (parsed.status) params.set('status', parsed.status);
      params.set('limit', String(parsed.limit));
      return backgroundJobListResponseSchema.parse(
        await client.get<unknown>(`/background-jobs?${params.toString()}`, {
          accessToken,
        }),
      );
    },

    async getById(accessToken: string, id: string) {
      return backgroundJobResponseSchema.parse(
        await client.get<unknown>(`/background-jobs/${id}`, { accessToken }),
      );
    },
  };
}
```

Create hooks:

```ts
export const backgroundJobQueryKeys = {
  all: ['background-jobs'] as const,
  list: (query: BackgroundJobListQuery) =>
    [...backgroundJobQueryKeys.all, 'list', query] as const,
  detail: (id: string) => [...backgroundJobQueryKeys.all, 'detail', id] as const,
};
```

`useBackgroundJobList` should accept `{ enabled?: boolean; refetchInterval?: number | false }` so `/knowledge` can poll only when there are processing documents.

- [ ] **Step 4: Update knowledge hooks and page**

Modify `useProcessKnowledgeDocument` success invalidation:

```ts
void queryClient.invalidateQueries({ queryKey: backgroundJobQueryKeys.all });
```

On `/knowledge` page:

- Detect documents where `status === 'PENDING' || status === 'PROCESSING'`.
- Modify `useKnowledgeDocumentList(query, options)` to accept `refetchInterval`, then set `refetchInterval: hasPendingOrProcessing ? 2000 : false` on the document list query.
- Display a compact status row:
  - `QUEUED`: “排队中”
  - `ACTIVE`: “处理中”
  - `FAILED`: “处理失败”
  - `STALE_SKIPPED`: “旧任务已跳过”
- Keep the existing document card actions; do not add a new task center.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
bun --filter @repo/web test -- background-job-api knowledge
bun --filter @repo/web build
git diff --check
```

Commit:

```powershell
git add apps/web/src/lib/background-job-api.ts apps/web/src/lib/background-job-api.test.mts apps/web/src/hooks/use-background-jobs.ts apps/web/src/lib/knowledge-api.ts apps/web/src/hooks/use-knowledge.ts 'apps/web/src/app/(main)/knowledge/page.tsx'
git commit -m "feat(web): show background knowledge processing"
```

---

## Task 9: Queue Mode Integration Verification

**Files:**
- Create: `apps/server/src/knowledge-documents/jobs/document-processing.integration.spec.ts`

- [ ] **Step 1: Add focused integration test**

Create `apps/server/src/knowledge-documents/jobs/document-processing.integration.spec.ts` with a producer-to-processor handoff test:

```ts
import { DocumentProcessingJobService } from './document-processing-job.service';
import { DocumentProcessingProcessor } from './document-processing.processor';

describe('queued document processing integration', () => {
  const now = new Date('2026-06-29T00:00:00.000Z');
  const enqueued: Array<{ name: string; payload: unknown; options: { jobId: string } }> = [];
  const queue = {
    add: jest.fn(async (name: string, payload: unknown, options: { jobId: string }) => {
      enqueued.push({ name, payload, options });
      return { id: options.jobId };
    }),
  };
  const eventBus = { publish: jest.fn() };
  const processing = {
    toResponse: jest.fn(),
    processDocument: jest.fn(),
    runProcessingPipeline: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        KNOWLEDGE_PROCESSING_MODE: 'queue',
        KNOWLEDGE_PROCESSING_ATTEMPTS: 3,
        KNOWLEDGE_PROCESSING_PER_USER_ACTIVE_LIMIT: 2,
      };
      return values[key];
    }),
  };
  const backgroundJobs = {
    markActive: jest.fn(),
    markSucceeded: jest.fn(),
    markRetryableFailure: jest.fn(),
    markFailed: jest.fn(),
    markStaleSkipped: jest.fn(),
  };
  const prisma = {
    $transaction: jest.fn(),
    backgroundJob: { findFirst: jest.fn(), updateMany: jest.fn() },
    document: { findFirst: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    enqueued.length = 0;
    jest.useFakeTimers().setSystemTime(now);
    processing.toResponse.mockReturnValue({
      id: 'doc_1',
      status: 'PROCESSING',
      chunkCount: 0,
    });
    processing.runProcessingPipeline.mockResolvedValue({
      id: 'doc_1',
      status: 'DONE',
      chunkCount: 2,
    });
    backgroundJobs.markActive.mockResolvedValue({ id: 'job_1', status: 'ACTIVE' });
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc_1',
      userId: 'user_1',
      status: 'PROCESSING',
      storageKey: 'users/user_1/knowledge/notes.txt',
      contentHash: 'sha256:abc',
    });
  });

  afterEach(() => jest.useRealTimers());

  it('passes the producer payload to the processor and records success', async () => {
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        document: {
          findFirst: jest.fn().mockResolvedValue(documentRow()),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        backgroundJob: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockResolvedValue(jobRow()),
        },
      }),
    );

    const producer = new DocumentProcessingJobService(
      prisma as never,
      queue as never,
      processing as never,
      config as never,
      eventBus as never,
    );
    const processor = new DocumentProcessingProcessor(
      backgroundJobs as never,
      processing as never,
      prisma as never,
      eventBus as never,
    );

    const response = await producer.enqueueOrRun('user_1', 'doc_1', { force: false });
    await processor.process({
      id: enqueued[0]?.options.jobId,
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: enqueued[0]?.payload,
    } as never);

    expect(response.processing?.backgroundJobId).toBe('job_1');
    expect(processing.runProcessingPipeline).toHaveBeenCalledWith({
      userId: 'user_1',
      documentId: 'doc_1',
      expectedDocument: {
        storageKey: 'users/user_1/knowledge/notes.txt',
        contentHash: 'sha256:abc',
      },
    });
    expect(backgroundJobs.markSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job_1',
        resultSummary: expect.objectContaining({ chunkCount: 2 }),
      }),
    );
  });

  function documentRow() {
    return {
      id: 'doc_1',
      userId: 'user_1',
      name: 'notes.txt',
      type: 'TXT',
      size: 128,
      mimeType: 'text/plain',
      storageKey: 'users/user_1/knowledge/notes.txt',
      status: 'PENDING',
      sourceType: 'UPLOAD',
      errorMessage: null,
      contentHash: 'sha256:abc',
      processedAt: null,
      createdAt: now,
      updatedAt: now,
      _count: { chunks: 0 },
    };
  }

  function jobRow() {
    return {
      id: 'job_1',
      status: 'QUEUED',
      requestedAt: now,
    };
  }
});
```

- [ ] **Step 2: Add stale snapshot integration test**

Add this test to the same file:

```ts
it('stale queued jobs do not write chunks when the document snapshot changed', async () => {
  backgroundJobs.markActive.mockResolvedValue({ id: 'job_1', status: 'ACTIVE' });
  prisma.document.findFirst.mockResolvedValue({
    id: 'doc_1',
    userId: 'user_1',
    status: 'PROCESSING',
    storageKey: 'users/user_1/knowledge/new-notes.txt',
    contentHash: 'sha256:new',
  });

  const processor = new DocumentProcessingProcessor(
    backgroundJobs as never,
    processing as never,
    prisma as never,
    eventBus as never,
  );

  await processor.process({
    id: 'job_1',
    attemptsMade: 0,
    opts: { attempts: 3 },
    data: {
      backgroundJobId: 'job_1',
      userId: 'user_1',
      documentId: 'doc_1',
      force: false,
      snapshot: {
        storageKey: 'users/user_1/knowledge/notes.txt',
        contentHash: 'sha256:abc',
      },
      requestedAt: '2026-06-29T00:00:00.000Z',
    },
  } as never);

  expect(backgroundJobs.markStaleSkipped).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'job_1',
      reason: 'snapshot_changed',
    }),
  );
  expect(processing.runProcessingPipeline).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Add processing replacement conflict test**

Extend `apps/server/src/knowledge-documents/knowledge-documents.service.spec.ts` with a queue-mode regression beside the existing `KNOWLEDGE_DOCUMENT_PROCESSING` replacement test:

```ts
it('keeps replacement upload blocked while a document is processing', async () => {
  const replacementFile = createFile({
    buffer: Buffer.from('updated notes'),
    mimeType: 'text/plain',
    originalName: 'updated-notes.txt',
  });
  prisma.document.findFirst.mockResolvedValueOnce({
    ...documentRow,
    status: 'PROCESSING',
  });

  await expect(
    createService().replaceUploadDocument('user_1', 'doc_1', replacementFile),
  ).rejects.toMatchObject({
    code: 'KNOWLEDGE_DOCUMENT_PROCESSING',
    statusCode: HttpStatus.CONFLICT,
  });

  expect(storage.saveKnowledgeDocumentObject).not.toHaveBeenCalled();
});
```

The assertion must prove Phase 7 queue mode does not silently change the current `PROCESSING` replacement boundary.

- [ ] **Step 4: Run integration verification**

Run:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:RAG_EMBEDDING_PROVIDER='fake'
$env:KNOWLEDGE_PROCESSING_MODE='queue'
bun --filter @repo/server test -- document-processing
bun --filter @repo/server test:e2e
git diff --check
```

Expected: server focused tests and e2e pass with Docker services running.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/knowledge-documents apps/server/test
git commit -m "test(server): cover queued document processing"
```

---

## Task 10: Documentation and Phase 7 Smoke Guide

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/data-flow.md`
- Modify: `docs/dev-start.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/ai-behavior-acceptance.md`

- [ ] **Step 1: Update project docs**

Document these facts:

- Phase 7.0/7.1 status after implementation.
- `KNOWLEDGE_PROCESSING_MODE=inline | queue`.
- `SERVER_ROLE=api | worker | both`.
- Redis is required only for queue mode.
- Inline processing remains the default fallback.
- `BackgroundJob` records sanitized metadata only.
- `PROCESSING` document replacement remains blocked.
- Queue mode does not change `/api/chat` live model boundaries.
- Queue smoke proves RAG processing reliability, not live model answer quality.

- [ ] **Step 2: Add smoke commands**

Add to `docs/dev-start.md`:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER='fake'
$env:REDIS_URL='redis://127.0.0.1:6379'
$env:KNOWLEDGE_PROCESSING_MODE='queue'
$env:SERVER_ROLE='both'
bun --filter @repo/server start:dev
```

- [ ] **Step 3: Final verification**

Run:

```powershell
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --filter @repo/server test
bun --filter @repo/server build
bun --filter @repo/web test
bun --filter @repo/web build
git diff --check
```

Do not run `bun --filter @repo/server lint` as a default final command because it uses `--fix` and may mutate unrelated files.

- [ ] **Step 4: Commit**

```powershell
git add AGENTS.md docs/data-flow.md docs/dev-start.md docs/roadmap.md docs/ai-behavior-acceptance.md
git commit -m "docs: record phase 7 queue mode"
```

---

## Acceptance Checklist

- [ ] `BackgroundJob` model exists, has user isolation, and has an active dedupe partial unique index.
- [ ] `GET /background-jobs` and `GET /background-jobs/:id` only return current user jobs.
- [ ] `POST /knowledge/documents/:id/process` still works in inline mode.
- [ ] Queue mode returns `processing.backgroundJobId`.
- [ ] Producer creates claim + job in one database transaction.
- [ ] Enqueue failure marks job failed and releases the document into a retryable failed state.
- [ ] Processor validates BackgroundJob before touching Document or Chunk.
- [ ] Retryable failures do not mark Document failed until attempts are exhausted.
- [ ] Snapshot mismatch produces `STALE_SKIPPED` and writes no chunks.
- [ ] `PROCESSING` document replacement remains blocked.
- [ ] `/knowledge` polls while documents are pending or processing and stops after DONE/FAILED.
- [ ] Background job payloads and events never include full document text, full chunks, prompts, answers, cookies, bearer tokens, or API keys.
