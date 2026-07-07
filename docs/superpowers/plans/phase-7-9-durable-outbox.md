# Phase 7.9 Durable Outbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Durable Outbox foundation so PrepMind can persist internal events, claim them safely, retry failures, and avoid false reliability from in-process events.

**Architecture:** Add an `OutboxEvent` Prisma model and a focused NestJS `OutboxModule` with `OutboxService`. Phase 7.9.1 does not replace existing EventBus/BullMQ flows yet; it ships the durable state machine and tests first.

**Tech Stack:** Prisma, PostgreSQL, NestJS 11, TypeScript, Jest, Bun workspace.

---

## File Structure

- Modify `packages/database/prisma/schema.prisma`
  - Add `OutboxEventStatus` enum and `OutboxEvent` model.
- Create `packages/database/prisma/migrations/<timestamp>_add_outbox_event/migration.sql`
  - Add enum, table, unique index, and query indexes.
- Create `apps/server/src/outbox/outbox.module.ts`
  - Exports `OutboxService`.
- Create `apps/server/src/outbox/outbox.service.ts`
  - Owns enqueue, claim, success, retry, and dead-letter transitions.
- Create `apps/server/src/outbox/outbox.service.spec.ts`
  - Tests state machine behavior with mocked Prisma.
- Modify `apps/server/src/app.module.ts`
  - Imports `OutboxModule`.
- Modify `AGENTS.md`, `DEVLOG.md`, `docs/ai-behavior-acceptance.md`
  - Records Phase 7.9.1 boundary.

---

## Task 1: Add OutboxEvent Schema and Migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260707000100_add_outbox_event/migration.sql`

- [ ] **Step 1: Add Prisma enum and model**

Add near existing system enums in `packages/database/prisma/schema.prisma`:

```prisma
enum OutboxEventStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
  DEAD
}
```

Add model near `BackgroundJob`:

```prisma
model OutboxEvent {
  id             String            @id @default(cuid())
  type           String
  status         OutboxEventStatus @default(PENDING)
  aggregateType  String?
  aggregateId    String?
  idempotencyKey String?           @unique
  payload        Json
  payloadHash    String?
  attempts       Int               @default(0)
  maxAttempts    Int               @default(5)
  nextRunAt      DateTime          @default(now())
  lockedAt       DateTime?
  lockedBy       String?
  lastErrorCode  String?
  lastError      String?           @db.Text
  processedAt    DateTime?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@index([status, nextRunAt, createdAt])
  @@index([lockedBy, lockedAt])
  @@index([aggregateType, aggregateId, createdAt])
  @@index([type, status, createdAt])
}
```

- [ ] **Step 2: Add SQL migration**

Create `packages/database/prisma/migrations/20260707000100_add_outbox_event/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "aggregateType" TEXT,
    "aggregateId" TEXT,
    "idempotencyKey" TEXT,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastErrorCode" TEXT,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_idempotencyKey_key" ON "OutboxEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_nextRunAt_createdAt_idx" ON "OutboxEvent"("status", "nextRunAt", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_lockedBy_lockedAt_idx" ON "OutboxEvent"("lockedBy", "lockedAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_createdAt_idx" ON "OutboxEvent"("aggregateType", "aggregateId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_type_status_createdAt_idx" ON "OutboxEvent"("type", "status", "createdAt");
```

- [ ] **Step 3: Generate Prisma client**

Run:

```powershell
bun --cwd packages/database prisma:generate
```

Expected: Prisma client generated successfully.

- [ ] **Step 4: Verify database package typecheck**

Run:

```powershell
bun --cwd packages/database test
```

Expected: PASS.

- [ ] **Step 5: Commit schema**

Run:

```powershell
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/20260707000100_add_outbox_event/migration.sql
git commit -m "feat(database): add outbox event model"
```

Expected: commit succeeds.

---

## Task 2: Add OutboxService With TDD

**Files:**
- Create: `apps/server/src/outbox/outbox.service.spec.ts`
- Create: `apps/server/src/outbox/outbox.service.ts`
- Create: `apps/server/src/outbox/outbox.module.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/server/src/outbox/outbox.service.spec.ts`:

```ts
import { Prisma } from '@prisma/client';

import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  const now = new Date('2026-07-07T00:00:00.000Z');
  const prisma = {
    outboxEvent: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('enqueues a pending event with safe defaults', async () => {
    prisma.outboxEvent.create.mockResolvedValue(row({ status: 'PENDING' }));

    const result = await createService().enqueue({
      type: 'knowledge.document.processing.requested',
      aggregateType: 'Document',
      aggregateId: 'doc_1',
      payload: { documentId: 'doc_1' },
    });

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'knowledge.document.processing.requested',
        status: 'PENDING',
        aggregateType: 'Document',
        aggregateId: 'doc_1',
        payload: { documentId: 'doc_1' },
        maxAttempts: 5,
      }),
    });
    expect(result.status).toBe('PENDING');
  });

  it('returns existing event when idempotency key already exists', async () => {
    prisma.outboxEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.outboxEvent.findUnique.mockResolvedValue(
      row({ status: 'PENDING', idempotencyKey: 'idem_1' }),
    );

    const result = await createService().enqueue({
      type: 'knowledge.document.processing.requested',
      idempotencyKey: 'idem_1',
      payload: { documentId: 'doc_1' },
    });

    expect(prisma.outboxEvent.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: 'idem_1' },
    });
    expect(result.idempotencyKey).toBe('idem_1');
  });

  it('claims due pending events and locks them for the worker', async () => {
    prisma.outboxEvent.findMany
      .mockResolvedValueOnce([row({ id: 'evt_1', status: 'PENDING' })])
      .mockResolvedValueOnce([row({ id: 'evt_1', status: 'PROCESSING', lockedBy: 'worker_1' })]);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });

    const result = await createService().claimPending({
      workerId: 'worker_1',
      limit: 10,
      now,
    });

    expect(prisma.outboxEvent.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        OR: [
          { status: 'PENDING', nextRunAt: { lte: now } },
          {
            status: 'PROCESSING',
            lockedAt: { lt: new Date('2026-07-06T23:55:00.000Z') },
          },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 10,
    });
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'evt_1' }),
      data: expect.objectContaining({
        status: 'PROCESSING',
        lockedBy: 'worker_1',
        lockedAt: now,
        attempts: { increment: 1 },
      }),
    });
    expect(result).toHaveLength(1);
  });

  it('marks a worker-locked event as succeeded', async () => {
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValue(row({ status: 'SUCCEEDED' }));

    const result = await createService().markSucceeded('evt_1', 'worker_1');

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'evt_1', status: 'PROCESSING', lockedBy: 'worker_1' },
      data: expect.objectContaining({
        status: 'SUCCEEDED',
        lockedAt: null,
        lockedBy: null,
        processedAt: now,
      }),
    });
    expect(result?.status).toBe('SUCCEEDED');
  });

  it('retries a failed event when attempts remain', async () => {
    prisma.outboxEvent.findFirst.mockResolvedValueOnce(
      row({ id: 'evt_1', status: 'PROCESSING', attempts: 1, maxAttempts: 3 }),
    );
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValueOnce(row({ status: 'PENDING' }));

    const result = await createService().markFailedOrRetry({
      id: 'evt_1',
      workerId: 'worker_1',
      errorCode: 'HANDLER_FAILED',
      error: new Error('boom with secret-token-value'),
      now,
    });

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'evt_1', status: 'PROCESSING', lockedBy: 'worker_1' },
      data: expect.objectContaining({
        status: 'PENDING',
        lockedAt: null,
        lockedBy: null,
        lastErrorCode: 'HANDLER_FAILED',
        nextRunAt: new Date('2026-07-07T00:00:01.000Z'),
      }),
    });
    expect(result?.status).toBe('PENDING');
  });

  it('moves a failed event to dead when max attempts is reached', async () => {
    prisma.outboxEvent.findFirst.mockResolvedValueOnce(
      row({ id: 'evt_1', status: 'PROCESSING', attempts: 3, maxAttempts: 3 }),
    );
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValueOnce(row({ status: 'DEAD' }));

    const result = await createService().markFailedOrRetry({
      id: 'evt_1',
      workerId: 'worker_1',
      errorCode: 'HANDLER_FAILED',
      error: new Error('boom'),
      now,
    });

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'evt_1', status: 'PROCESSING', lockedBy: 'worker_1' },
      data: expect.objectContaining({
        status: 'DEAD',
        lockedAt: null,
        lockedBy: null,
        processedAt: now,
      }),
    });
    expect(result?.status).toBe('DEAD');
  });

  function createService() {
    return new OutboxService(prisma as never);
  }

  function row(input: {
    id?: string;
    status: string;
    attempts?: number;
    maxAttempts?: number;
    lockedBy?: string | null;
    idempotencyKey?: string | null;
  }) {
    return {
      id: input.id ?? 'evt_1',
      type: 'knowledge.document.processing.requested',
      status: input.status,
      aggregateType: 'Document',
      aggregateId: 'doc_1',
      idempotencyKey: input.idempotencyKey ?? null,
      payload: { documentId: 'doc_1' },
      payloadHash: null,
      attempts: input.attempts ?? 0,
      maxAttempts: input.maxAttempts ?? 5,
      nextRunAt: now,
      lockedAt: input.lockedBy ? now : null,
      lockedBy: input.lockedBy ?? null,
      lastErrorCode: null,
      lastError: null,
      processedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }
});
```

- [ ] **Step 2: Run RED verification**

Run:

```powershell
bun --filter @repo/server test -- outbox
```

Expected: FAIL because `./outbox.service` does not exist.

- [ ] **Step 3: Implement `OutboxService`**

Create `apps/server/src/outbox/outbox.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { sanitizeJobError } from '../jobs/job-error-sanitizer';

type JsonRecord = Prisma.InputJsonObject;

export type EnqueueOutboxEventInput = {
  type: string;
  aggregateType?: string | null;
  aggregateId?: string | null;
  idempotencyKey?: string | null;
  payload: JsonRecord;
  payloadHash?: string | null;
  maxAttempts?: number;
  nextRunAt?: Date;
};

export type ClaimOutboxEventsInput = {
  workerId: string;
  limit: number;
  now?: Date;
  lockTimeoutMs?: number;
};

export type MarkOutboxFailedInput = {
  id: string;
  workerId: string;
  errorCode: string;
  error: unknown;
  now?: Date;
};

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(input: EnqueueOutboxEventInput) {
    try {
      return await this.prisma.outboxEvent.create({
        data: {
          type: input.type,
          status: 'PENDING',
          aggregateType: input.aggregateType ?? null,
          aggregateId: input.aggregateId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          payload: input.payload,
          payloadHash: input.payloadHash ?? null,
          maxAttempts: input.maxAttempts ?? 5,
          nextRunAt: input.nextRunAt,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error) && input.idempotencyKey) {
        const existing = await this.prisma.outboxEvent.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) return existing;
      }

      throw error;
    }
  }

  async claimPending(input: ClaimOutboxEventsInput) {
    const now = input.now ?? new Date();
    const lockExpiredBefore = new Date(
      now.getTime() - (input.lockTimeoutMs ?? 5 * 60_000),
    );
    const claimableWhere = {
      OR: [
        { status: 'PENDING' as const, nextRunAt: { lte: now } },
        {
          status: 'PROCESSING' as const,
          lockedAt: { lt: lockExpiredBefore },
        },
      ],
    };
    const candidates = await this.prisma.outboxEvent.findMany({
      where: claimableWhere,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: input.limit,
    });

    const claimedIds: string[] = [];
    for (const event of candidates) {
      const result = await this.prisma.outboxEvent.updateMany({
        where: {
          id: event.id,
          OR: claimableWhere.OR,
        },
        data: {
          status: 'PROCESSING',
          lockedBy: input.workerId,
          lockedAt: now,
          attempts: { increment: 1 },
        },
      });
      if (result.count === 1) {
        claimedIds.push(event.id);
      }
    }

    if (claimedIds.length === 0) return [];
    return this.prisma.outboxEvent.findMany({
      where: { id: { in: claimedIds } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async markSucceeded(id: string, workerId: string) {
    const now = new Date();
    const result = await this.prisma.outboxEvent.updateMany({
      where: { id, status: 'PROCESSING', lockedBy: workerId },
      data: {
        status: 'SUCCEEDED',
        lockedAt: null,
        lockedBy: null,
        processedAt: now,
        lastErrorCode: null,
        lastError: null,
      },
    });

    if (result.count !== 1) return null;
    return this.findByLockedTransition(id);
  }

  async markFailedOrRetry(input: MarkOutboxFailedInput) {
    const now = input.now ?? new Date();
    const event = await this.prisma.outboxEvent.findFirst({
      where: {
        id: input.id,
        status: 'PROCESSING',
        lockedBy: input.workerId,
      },
    });

    if (!event) return null;

    const exhausted = event.attempts >= event.maxAttempts;
    const result = await this.prisma.outboxEvent.updateMany({
      where: { id: input.id, status: 'PROCESSING', lockedBy: input.workerId },
      data: exhausted
        ? {
            status: 'DEAD',
            lockedAt: null,
            lockedBy: null,
            lastErrorCode: input.errorCode,
            lastError: sanitizeJobError(input.error),
            processedAt: now,
          }
        : {
            status: 'PENDING',
            lockedAt: null,
            lockedBy: null,
            lastErrorCode: input.errorCode,
            lastError: sanitizeJobError(input.error),
            nextRunAt: new Date(now.getTime() + retryDelayMs(event.attempts)),
          },
    });

    if (result.count !== 1) return null;
    return this.findByLockedTransition(input.id);
  }

  private findByLockedTransition(id: string) {
    return this.prisma.outboxEvent.findFirst({ where: { id } });
  }
}

function retryDelayMs(attempts: number) {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, attempts - 1));
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
```

- [ ] **Step 4: Create module**

Create `apps/server/src/outbox/outbox.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { OutboxService } from './outbox.service';

@Module({
  imports: [DatabaseModule],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
```

- [ ] **Step 5: Import module in AppModule**

Modify `apps/server/src/app.module.ts`:

```ts
import { OutboxModule } from './outbox/outbox.module';
```

Add `OutboxModule` after `EventsModule`.

- [ ] **Step 6: Run GREEN verification**

Run:

```powershell
bun --filter @repo/server test -- outbox
bun --filter @repo/server build
```

Expected: PASS.

- [ ] **Step 7: Commit service**

Run:

```powershell
git add apps/server/src/outbox apps/server/src/app.module.ts
git commit -m "feat(server): add outbox service"
```

Expected: commit succeeds.

---

## Task 3: Document Phase 7.9.1

**Files:**
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/ai-behavior-acceptance.md`

- [ ] **Step 1: Update phase status**

Update phase tables to include:

```markdown
| Phase 7.9.1 | 已完成 | Durable Outbox 地基、OutboxEvent、claim / retry / dead-letter 状态机 |
```

- [ ] **Step 2: Document boundaries**

Add notes:

- OutboxEvent stores durable internal event metadata and sanitized payload only.
- Phase 7.9.1 does not replace BullMQ, BackgroundJob, or EventBus yet.
- It does not change Chat, RAG prompt, model calls, or frontend behavior.
- Metrics are designed as next step, not fully exposed in this phase.

- [ ] **Step 3: Run checks**

Run:

```powershell
rg "Phase 7.9.1|OutboxEvent|Durable Outbox" AGENTS.md DEVLOG.md docs/ai-behavior-acceptance.md
git diff --check
```

Expected: `rg` finds the new content and diff check passes.

- [ ] **Step 4: Commit docs**

Run:

```powershell
git add AGENTS.md DEVLOG.md docs/ai-behavior-acceptance.md
git commit -m "docs: record durable outbox"
```

Expected: commit succeeds.

---

## Task 4: Final Verification

**Files:**
- No source edits expected unless verification finds a defect.

- [ ] **Step 1: Run outbox tests**

Run:

```powershell
bun --filter @repo/server test -- outbox
```

Expected: PASS.

- [ ] **Step 2: Run server build**

Run:

```powershell
bun --filter @repo/server build
```

Expected: PASS.

- [ ] **Step 3: Run database typecheck**

Run:

```powershell
bun --cwd packages/database test
```

Expected: PASS.

- [ ] **Step 4: Run diff check**

Run:

```powershell
git diff --check
```

Expected: no output and exit code 0.

---

## Self-Review

- Spec coverage: The plan covers schema, migration, service API, claim/retry/dead state machine, module wiring, docs, and verification.
- Placeholder scan: No placeholder tasks remain.
- Type consistency: The service methods match the design doc names and input shapes.
- Scope check: The plan does not migrate existing EventBus publishers or expose metrics yet; those remain Phase 7.9.2+.
