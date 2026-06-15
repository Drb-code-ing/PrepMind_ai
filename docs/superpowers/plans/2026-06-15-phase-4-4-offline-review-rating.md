# Phase 4.4 Offline Review Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ReviewTask rating reliable under offline, weak network, and lost-response scenarios, while adding a lightweight in-app review reminder summary.

**Architecture:** Add server-side idempotency to `POST /review-tasks/:taskId/rating` with `clientMutationId` persisted on `ReviewLog`. Extend the existing Dexie mutation queue for `reviewTask/rating` commands, keep FSRS scheduling authoritative on the server, and let the Today page show local pending-sync state without pretending stats are complete. Reminder scope is in-app summary only; browser notifications, Push, BullMQ reminders, cross-device offline merge, and offline skip/reopen are excluded from Phase 4.4.

**Tech Stack:** Bun workspace, Prisma/PostgreSQL, NestJS 11, Zod shared contracts, Next.js 16, React 19, TanStack Query, Dexie, TypeScript.

---

## File Structure

- `docs/superpowers/specs/2026-06-15-phase-4-4-offline-review-rating-design.md`
  - Source design. Do not edit during implementation unless the design changes.
- `packages/types/src/api/review.ts`
  - Add `clientMutationId` validation to `ReviewRatingRequest` and `ReviewLogResponse`.
- `packages/types/src/api/review-task.ts`
  - Keep task rating response aligned with the shared log shape.
- `packages/types/tests/review.test.mts`
  - Runtime schema tests for rating request idempotency fields.
- `packages/types/tests/review-task.test.mts`
  - Runtime schema test that task rating responses accept log `clientMutationId`.
- `packages/database/prisma/schema.prisma`
  - Add nullable unique `ReviewLog.clientMutationId`.
- `packages/database/prisma/migrations/20260615000000_add_review_rating_idempotency/migration.sql`
  - SQL migration for the new nullable unique column.
- `apps/server/src/review-tasks/review-tasks.service.ts`
  - Idempotent rating flow and conflict handling.
- `apps/server/src/review-tasks/review-tasks.service.spec.ts`
  - Unit coverage for first submit, replay, conflict, completed-task mismatch, and user isolation.
- `apps/server/test/review-tasks.e2e-spec.ts`
  - API-level idempotency replay tests against PostgreSQL.
- `apps/web/src/lib/db.ts`
  - Extend mutation queue type unions and add a compound index for review rating queue reads.
- `apps/web/src/lib/mutation-queue.ts`
  - Preserve `reviewTask/rating` payloads during dedupe merge.
- `apps/web/src/lib/mutation-queue-flush.ts`
  - Flush `reviewTask/rating` through `reviewTaskApi.submitRating()` and return a flush summary.
- `apps/web/src/lib/mutation-queue-flush.test.mts`
  - Unit tests for review rating flush and error classification.
- `apps/web/src/lib/review-task-api.ts`
  - Send `clientMutationId` in rating requests after shared schema update.
- `apps/web/src/lib/review-task-api.test.mts`
  - Assert request body includes `clientMutationId`.
- `apps/web/src/lib/review-task-offline.ts`
  - New pure helper for creating review rating queue items, retryability classification, and pending-rating extraction.
- `apps/web/src/lib/review-task-offline.test.mts`
  - Tests for dedupe key, payload shape, and retryable/non-retryable errors.
- `apps/web/src/lib/review-reminder.ts`
  - New pure helper for in-app summary: due count, overdue count, next due time, pending sync count, and preference defaults.
- `apps/web/src/lib/review-reminder.test.mts`
  - Tests for reminder summary and preference parsing.
- `apps/web/src/lib/review-task-view.ts`
  - Add local pending-sync grouping and display feedback helpers.
- `apps/web/src/lib/review-task-view.test.mts`
  - Tests for pending-sync grouping and rating labels.
- `apps/web/src/hooks/use-mutation-queue-flush.ts`
  - Invalidate review task and review stats queries after successful review rating flush.
- `apps/web/src/hooks/use-review-task-pending-ratings.ts`
  - New Dexie `liveQuery` hook that exposes pending local ratings for the current user.
- `apps/web/src/hooks/use-review-tasks.ts`
  - Expose rating mutation shape used by the Today page.
- `apps/web/src/app/(main)/today/page.tsx`
  - Generate `clientMutationId`, enqueue retryable rating failures, show pending-sync state, disable conflicting actions, and render reminder summary.
- `docs/data-flow.md`, `docs/roadmap.md`, `AGENTS.md`, `CLAUDE.md`, `DEVLOG.md`
  - Update after implementation and verification.

---

## Task 1: Extend Shared Rating Contracts

**Files:**
- Modify: `packages/types/src/api/review.ts`
- Modify: `packages/types/src/api/review-task.ts`
- Modify: `packages/types/tests/review.test.mts`
- Modify: `packages/types/tests/review-task.test.mts`

- [ ] **Step 1: Write the failing request schema test**

In `packages/types/tests/review.test.mts`, replace `testRatingRequest()` with:

```ts
function testRatingRequest() {
  const mutationId = '11111111-1111-4111-8111-111111111111';
  const result = reviewRatingRequestSchema.parse({
    rating: 4,
    reviewedAt: '2026-06-14T08:00:00.000Z',
    reviewDurationMs: 12000,
    clientMutationId: mutationId,
  });

  assert.equal(result.rating, 4);
  assert.equal(result.clientMutationId, mutationId);

  const legacyResult = reviewRatingRequestSchema.parse({
    rating: 3,
  });
  assert.equal(legacyResult.clientMutationId, undefined);

  assert.throws(() =>
    reviewRatingRequestSchema.parse({
      rating: 3,
      clientMutationId: 'not-a-uuid',
    }),
  );
}
```

- [ ] **Step 2: Write the failing task rating response schema test**

In `packages/types/tests/review-task.test.mts`, update the `log` object in `testRatingResponse()`:

```ts
    log: {
      id: 'log_1',
      cardId: 'card_1',
      rating: 3,
      scheduledDays: 1,
      elapsedDays: 0,
      reviewDurationMs: 12000,
      stabilityBefore: 0,
      stabilityAfter: 1,
      difficultyBefore: 5,
      difficultyAfter: 4.85,
      reviewedAt: '2026-06-14T08:00:00.000Z',
      clientMutationId: '11111111-1111-4111-8111-111111111111',
    },
```

Add this assertion after `assert.equal(result.log.rating, 3);`:

```ts
  assert.equal(
    result.log.clientMutationId,
    '11111111-1111-4111-8111-111111111111',
  );
```

- [ ] **Step 3: Run schema tests and verify they fail**

Run:

```powershell
node --experimental-strip-types packages/types/tests/review.test.mts
node --experimental-strip-types packages/types/tests/review-task.test.mts
```

Expected:
- `review.test.mts` fails because `clientMutationId` is not present on parsed request output.
- `review-task.test.mts` fails because `clientMutationId` is not present on parsed log output.

- [ ] **Step 4: Implement shared schemas**

In `packages/types/src/api/review.ts`, add near the rating schema:

```ts
export const clientMutationIdSchema = z.string().uuid();
```

Update `reviewLogSchema`:

```ts
export const reviewLogSchema = z.object({
  id: z.string().min(1),
  cardId: z.string().min(1),
  rating: reviewRatingSchema,
  scheduledDays: z.number().int().nonnegative(),
  elapsedDays: z.number().int().nonnegative(),
  reviewDurationMs: z.number().int().nonnegative().nullable(),
  stabilityBefore: z.number(),
  stabilityAfter: z.number(),
  difficultyBefore: z.number(),
  difficultyAfter: z.number(),
  reviewedAt: z.string().datetime(),
  clientMutationId: clientMutationIdSchema.nullable(),
});
```

Update `reviewRatingRequestSchema`:

```ts
export const reviewRatingRequestSchema = z.object({
  rating: reviewRatingSchema,
  reviewedAt: z.string().datetime().optional(),
  reviewDurationMs: z.number().int().nonnegative().optional(),
  clientMutationId: clientMutationIdSchema.optional(),
});
```

In `packages/types/src/api/review-task.ts`, import the shared log schema instead of maintaining a divergent private copy. At the top, add:

```ts
import { reviewLogSchema } from './review';
```

Remove the local `const reviewLogSchema = z.object({ ... })` block from `review-task.ts`. Keep the local `reviewRatingSchema` only if other local schemas still use it.

- [ ] **Step 5: Run schema tests and typecheck**

Run:

```powershell
node --experimental-strip-types packages/types/tests/review.test.mts
node --experimental-strip-types packages/types/tests/review-task.test.mts
bun --cwd packages/types typecheck
```

Expected:
- Both Node schema tests exit with code 0.
- TypeScript exits with code 0.

- [ ] **Step 6: Commit shared contract changes**

Run:

```powershell
git add packages/types/src/api/review.ts packages/types/src/api/review-task.ts packages/types/tests/review.test.mts packages/types/tests/review-task.test.mts
git commit -m "feat: add review rating mutation id contract"
```

Expected: commit succeeds.

---

## Task 2: Add ReviewLog Idempotency Storage

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260615000000_add_review_rating_idempotency/migration.sql`

- [ ] **Step 1: Confirm current schema has no mutation id field**

Run:

```powershell
rg -n "clientMutationId" packages/database/prisma/schema.prisma packages/database/prisma/migrations
```

Expected: no matches before this task.

- [ ] **Step 2: Update Prisma schema**

In `packages/database/prisma/schema.prisma`, update `model ReviewLog`:

```prisma
model ReviewLog {
  id               String   @id @default(cuid())
  cardId           String
  rating           Int
  scheduledDays    Int
  elapsedDays      Int      @default(0)
  reviewDurationMs Int?
  stabilityBefore  Float
  stabilityAfter   Float
  difficultyBefore Float
  difficultyAfter  Float
  reviewedAt       DateTime @default(now())
  clientMutationId String?  @unique

  card       Card        @relation(fields: [cardId], references: [id], onDelete: Cascade)
  reviewTask ReviewTask?

  @@index([cardId])
  @@index([reviewedAt])
}
```

- [ ] **Step 3: Create SQL migration**

Create `packages/database/prisma/migrations/20260615000000_add_review_rating_idempotency/migration.sql`:

```sql
ALTER TABLE "ReviewLog" ADD COLUMN "clientMutationId" TEXT;

CREATE UNIQUE INDEX "ReviewLog_clientMutationId_key" ON "ReviewLog"("clientMutationId");
```

- [ ] **Step 4: Regenerate Prisma client and typecheck database package**

Run:

```powershell
bun --cwd packages/database prisma:generate
bun --cwd packages/database test
```

Expected:
- Prisma client generation succeeds.
- `tsc --noEmit` exits with code 0.

- [ ] **Step 5: Commit database storage changes**

Run:

```powershell
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/20260615000000_add_review_rating_idempotency/migration.sql
git commit -m "feat: add review rating idempotency storage"
```

Expected: commit succeeds.

---

## Task 3: Make ReviewTask Rating Idempotent on the Server

**Files:**
- Modify: `apps/server/src/review-tasks/review-tasks.service.ts`
- Modify: `apps/server/src/review-tasks/review-tasks.service.spec.ts`

- [ ] **Step 1: Extend unit test fixtures**

In `apps/server/src/review-tasks/review-tasks.service.spec.ts`, update `reviewLog`:

```ts
  const reviewLog = {
    id: 'log_1',
    cardId: 'card_1',
    rating: 3,
    scheduledDays: 1,
    elapsedDays: 0,
    reviewDurationMs: 12000,
    stabilityBefore: 0,
    stabilityAfter: 1,
    difficultyBefore: 5,
    difficultyAfter: 4.85,
    reviewedAt: now,
    clientMutationId: '11111111-1111-4111-8111-111111111111',
  };
```

Add `findUnique` to the `reviewLog` mock:

```ts
    reviewLog: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
```

In `beforeEach`, add:

```ts
    prisma.reviewLog.findUnique.mockResolvedValue(null);
```

- [ ] **Step 2: Write first-submit unit test expectations**

In the existing `submits rating by completing the task and writing a review log` test, pass `clientMutationId`:

```ts
    const result = await createService().submitRating('user_1', 'task_1', {
      rating: 3,
      reviewedAt: now.toISOString(),
      reviewDurationMs: 12000,
      clientMutationId: '11111111-1111-4111-8111-111111111111',
    });
```

Add this expectation before `expect(prisma.reviewTask.update)`:

```ts
    expect(prisma.reviewLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardId: 'card_1',
        rating: 3,
        clientMutationId: '11111111-1111-4111-8111-111111111111',
      }),
    });
```

Add this assertion at the end:

```ts
    expect(result.log.clientMutationId).toBe('11111111-1111-4111-8111-111111111111');
```

- [ ] **Step 3: Add replay unit test**

Add this test:

```ts
  it('returns the existing rating result when the same clientMutationId is retried', async () => {
    const completedTask = {
      ...task,
      status: 'COMPLETED' as const,
      reviewLogId: 'log_1',
      completedAt: now,
    };
    prisma.reviewLog.findUnique.mockResolvedValue({
      ...reviewLog,
      card,
      reviewTask: completedTask,
    });

    const result = await createService().submitRating('user_1', 'task_1', {
      rating: 3,
      reviewedAt: now.toISOString(),
      clientMutationId: '11111111-1111-4111-8111-111111111111',
    });

    expect(prisma.reviewLog.findUnique).toHaveBeenCalledWith({
      where: { clientMutationId: '11111111-1111-4111-8111-111111111111' },
      include: {
        card: true,
        reviewTask: { include: { card: { include: { wrongQuestion: true } } } },
      },
    });
    expect(prisma.reviewTask.findFirst).not.toHaveBeenCalled();
    expect(prisma.reviewLog.create).not.toHaveBeenCalled();
    expect(result.task.id).toBe('task_1');
    expect(result.log.id).toBe('log_1');
  });
```

- [ ] **Step 4: Add conflict and isolation unit tests**

Add these tests:

```ts
  it('rejects reusing one clientMutationId for a different task', async () => {
    prisma.reviewLog.findUnique.mockResolvedValue({
      ...reviewLog,
      card,
      reviewTask: {
        ...task,
        id: 'task_2',
        status: 'COMPLETED' as const,
        reviewLogId: 'log_1',
        completedAt: now,
      },
    });

    await expect(
      createService().submitRating('user_1', 'task_1', {
        rating: 3,
        clientMutationId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toMatchObject({
      code: 'REVIEW_RATING_IDEMPOTENCY_CONFLICT',
      statusCode: 409,
    });
  });

  it('rejects a completed task when the mutation id is different', async () => {
    prisma.reviewTask.findFirst.mockResolvedValue({
      ...task,
      status: 'COMPLETED' as const,
      reviewLogId: 'log_1',
      completedAt: now,
    });

    await expect(
      createService().submitRating('user_1', 'task_1', {
        rating: 3,
        clientMutationId: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_PENDING',
      statusCode: 409,
    });
  });

  it('does not expose another user rating result through clientMutationId', async () => {
    prisma.reviewLog.findUnique.mockResolvedValue({
      ...reviewLog,
      card: { ...card, userId: 'user_2' },
      reviewTask: {
        ...task,
        userId: 'user_2',
        status: 'COMPLETED' as const,
        reviewLogId: 'log_1',
        completedAt: now,
      },
    });

    await expect(
      createService().submitRating('user_1', 'task_1', {
        rating: 3,
        clientMutationId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toMatchObject({
      code: 'REVIEW_RATING_IDEMPOTENCY_CONFLICT',
      statusCode: 409,
    });
  });
```

- [ ] **Step 5: Run server unit tests and verify they fail**

Run:

```powershell
bun --filter @repo/server test -- review-tasks.service.spec.ts
```

Expected: tests fail because service does not query `reviewLog.findUnique`, does not persist `clientMutationId`, and does not return it.

- [ ] **Step 6: Implement idempotent service flow**

In `apps/server/src/review-tasks/review-tasks.service.ts`, add this helper type near the existing record types:

```ts
type ReviewLogWithTask = Prisma.ReviewLogGetPayload<{
  include: {
    card: true;
    reviewTask: { include: typeof taskInclude };
  };
}>;
```

At the start of the transaction in `submitRating`, before loading the task, add:

```ts
      if (input.clientMutationId) {
        const existing = await tx.reviewLog.findUnique({
          where: { clientMutationId: input.clientMutationId },
          include: {
            card: true,
            reviewTask: { include: taskInclude },
          },
        });

        if (existing) {
          return this.returnExistingRatingResult(userId, taskId, existing);
        }
      }
```

In `tx.reviewLog.create`, add:

```ts
          clientMutationId: input.clientMutationId,
```

Wrap the transaction to convert Prisma unique conflicts:

```ts
  async submitRating(
    userId: string,
    taskId: string,
    input: ReviewRatingRequest,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // existing transaction body
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        input.clientMutationId
      ) {
        throw this.idempotencyConflict();
      }
      throw error;
    }
  }
```

Add helper methods in the class:

```ts
  private returnExistingRatingResult(
    userId: string,
    taskId: string,
    existing: ReviewLogWithTask,
  ) {
    if (existing.card.userId !== userId) {
      throw this.idempotencyConflict();
    }
    if (!existing.reviewTask || existing.reviewTask.id !== taskId) {
      throw this.idempotencyConflict();
    }

    return {
      task: this.toTaskResponse(existing.reviewTask),
      card: this.toCardResponse(existing.card),
      log: this.toLogResponse(existing),
    };
  }

  private idempotencyConflict() {
    return new AppError(
      'REVIEW_RATING_IDEMPOTENCY_CONFLICT',
      '这次复习评分命令已经被其他任务使用，请刷新后重试',
      HttpStatus.CONFLICT,
    );
  }
```

Update `toLogResponse`:

```ts
  private toLogResponse(log: ReviewLogRecord) {
    return {
      id: log.id,
      cardId: log.cardId,
      rating: log.rating as 1 | 2 | 3 | 4,
      scheduledDays: log.scheduledDays,
      elapsedDays: log.elapsedDays,
      reviewDurationMs: log.reviewDurationMs,
      stabilityBefore: log.stabilityBefore,
      stabilityAfter: log.stabilityAfter,
      difficultyBefore: log.difficultyBefore,
      difficultyAfter: log.difficultyAfter,
      reviewedAt: log.reviewedAt.toISOString(),
      clientMutationId: log.clientMutationId,
    };
  }
```

- [ ] **Step 7: Run server unit tests**

Run:

```powershell
bun --filter @repo/server test -- review-tasks.service.spec.ts
```

Expected: all tests in `review-tasks.service.spec.ts` pass.

- [ ] **Step 8: Commit server idempotency unit work**

Run:

```powershell
git add apps/server/src/review-tasks/review-tasks.service.ts apps/server/src/review-tasks/review-tasks.service.spec.ts
git commit -m "feat: make review task rating idempotent"
```

Expected: commit succeeds.

---

## Task 4: Add ReviewTask Rating Idempotency E2E Coverage

**Files:**
- Modify: `apps/server/test/review-tasks.e2e-spec.ts`

- [ ] **Step 1: Add idempotency assertions to the lifecycle test**

In `apps/server/test/review-tasks.e2e-spec.ts`, before the rating request, define:

```ts
    const clientMutationId = '11111111-1111-4111-8111-111111111111';
```

Update the first rating request body:

```ts
      .send({
        rating: 3,
        reviewedAt: '2026-06-14T08:00:00.000Z',
        reviewDurationMs: 12000,
        clientMutationId,
      })
```

After parsing `rating`, add:

```ts
    expect(rating.log.clientMutationId).toBe(clientMutationId);
```

Add a replay request immediately after the first rating assertion:

```ts
    const replayResponse = await request(server)
      .post(`/review-tasks/${task?.id}/rating`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({
        rating: 3,
        reviewedAt: '2026-06-14T08:00:00.000Z',
        reviewDurationMs: 12000,
        clientMutationId,
      })
      .expect(201);
    const replay = reviewTaskRatingResponseSchema.parse(getSuccessData(replayResponse));
    expect(replay.log.id).toBe(rating.log.id);
    expect(replay.task.id).toBe(rating.task.id);

    const logCount = await prisma.reviewLog.count({
      where: { clientMutationId },
    });
    expect(logCount).toBe(1);
```

Add a different mutation id conflict request:

```ts
    await request(server)
      .post(`/review-tasks/${task?.id}/rating`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({
        rating: 3,
        clientMutationId: '22222222-2222-4222-8222-222222222222',
      })
      .expect(409);
```

- [ ] **Step 2: Run e2e test**

Make sure Docker PostgreSQL is running:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
```

Run:

```powershell
bun --filter @repo/server test:e2e -- --runInBand review-tasks.e2e-spec.ts
```

Expected:
- Test passes.
- `ReviewLog` count for the replayed mutation id remains 1.

- [ ] **Step 3: Commit e2e coverage**

Run:

```powershell
git add apps/server/test/review-tasks.e2e-spec.ts
git commit -m "test: cover review rating idempotency e2e"
```

Expected: commit succeeds.

---

## Task 5: Extend Dexie Mutation Queue for ReviewTask Rating

**Files:**
- Modify: `apps/web/src/lib/db.ts`
- Modify: `apps/web/src/lib/mutation-queue.ts`
- Modify: `apps/web/src/lib/mutation-queue-flush.ts`
- Modify: `apps/web/src/lib/mutation-queue-flush.test.mts`
- Create: `apps/web/src/lib/review-task-offline.ts`
- Create: `apps/web/src/lib/review-task-offline.test.mts`

- [ ] **Step 1: Create failing review task offline helper tests**

Create `apps/web/src/lib/review-task-offline.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiClientError } from './api-client.ts';
import {
  createReviewTaskRatingQueueItem,
  getReviewTaskRatingDedupeKey,
  isRetryableReviewTaskRatingError,
  readReviewTaskRatingPayload,
} from './review-task-offline.ts';

const taskSnapshot = {
  id: 'task_1',
  userId: 'user_1',
  cardId: 'card_1',
  reviewLogId: null,
  scheduledDate: '2026-06-14',
  dueAt: '2026-06-14T08:00:00.000Z',
  status: 'PENDING',
  source: 'FSRS',
  completedAt: null,
  skippedAt: null,
  createdAt: '2026-06-14T08:00:00.000Z',
  updatedAt: '2026-06-14T08:00:00.000Z',
  card: {
    id: 'card_1',
    userId: 'user_1',
    questionId: null,
    wrongQuestionId: 'wrong_1',
    difficulty: 5,
    stability: 0,
    retrievability: 1,
    lastReview: null,
    nextReview: '2026-06-14T08:00:00.000Z',
    reviewCount: 0,
    lapses: 0,
    state: 'NEW',
    suspendedAt: null,
    createdAt: '2026-06-14T08:00:00.000Z',
    updatedAt: '2026-06-14T08:00:00.000Z',
  },
} as const;

test('creates review task rating queue item with stable dedupe key', () => {
  const item = createReviewTaskRatingQueueItem({
    userId: 'user_1',
    task: taskSnapshot,
    request: {
      rating: 3,
      reviewedAt: '2026-06-14T08:10:00.000Z',
      clientMutationId: '11111111-1111-4111-8111-111111111111',
    },
  });

  assert.equal(item.entity, 'reviewTask');
  assert.equal(item.operation, 'rating');
  assert.equal(item.entityId, 'task_1');
  assert.equal(item.dedupeKey, 'user_1:reviewTask:task_1:rating');
  assert.deepEqual(readReviewTaskRatingPayload(item.payload).request, {
    rating: 3,
    reviewedAt: '2026-06-14T08:10:00.000Z',
    clientMutationId: '11111111-1111-4111-8111-111111111111',
  });
});

test('returns review rating dedupe key', () => {
  assert.equal(
    getReviewTaskRatingDedupeKey('user_1', 'task_1'),
    'user_1:reviewTask:task_1:rating',
  );
});

test('classifies retryable and terminal rating failures', () => {
  assert.equal(
    isRetryableReviewTaskRatingError(
      new ApiClientError('network', { status: 0, code: 'NETWORK_ERROR' }),
    ),
    true,
  );
  assert.equal(
    isRetryableReviewTaskRatingError(
      new ApiClientError('server', { status: 503, code: 'SERVICE_UNAVAILABLE' }),
    ),
    true,
  );
  assert.equal(
    isRetryableReviewTaskRatingError(
      new ApiClientError('unauthorized', { status: 401, code: 'AUTH_UNAUTHORIZED' }),
    ),
    false,
  );
  assert.equal(
    isRetryableReviewTaskRatingError(
      new ApiClientError('conflict', {
        status: 409,
        code: 'REVIEW_TASK_NOT_PENDING',
      }),
    ),
    false,
  );
});
```

- [ ] **Step 2: Add failing flush tests**

In `apps/web/src/lib/mutation-queue-flush.test.mts`, add:

```ts
test('flushes review task rating through provided API', async () => {
  const calls: unknown[] = [];
  const item: MutationQueueItem = {
    ...baseItem,
    entity: 'reviewTask',
    operation: 'rating',
    entityId: 'task_1',
    dedupeKey: 'user_1:reviewTask:task_1:rating',
    payload: {
      taskId: 'task_1',
      request: {
        rating: 3,
        reviewedAt: '2026-06-14T08:00:00.000Z',
        clientMutationId: '11111111-1111-4111-8111-111111111111',
      },
      taskSnapshot: { id: 'task_1', status: 'PENDING' },
    },
  };

  const result = await flushMutationItem(item, 'access-token', {
    wrongQuestions: {
      create: async () => {
        throw new Error('unexpected wrong question create');
      },
      update: async () => {
        throw new Error('unexpected wrong question update');
      },
      delete: async () => {
        throw new Error('unexpected wrong question delete');
      },
    },
    ocrRecords: {
      create: async () => {
        throw new Error('unexpected ocr create');
      },
      delete: async () => {
        throw new Error('unexpected ocr delete');
      },
    },
    reviewTasks: {
      submitRating: async (_token, taskId, request) => {
        calls.push({ taskId, request });
        return { task: { id: taskId }, card: { id: 'card_1' }, log: { id: 'log_1' } };
      },
    },
  });

  assert.equal(result.outcome, 'success');
  assert.deepEqual(calls, [
    {
      taskId: 'task_1',
      request: {
        rating: 3,
        reviewedAt: '2026-06-14T08:00:00.000Z',
        clientMutationId: '11111111-1111-4111-8111-111111111111',
      },
    },
  ]);
});

test('treats review task not pending as terminal for queued rating', () => {
  const item: MutationQueueItem = {
    ...baseItem,
    entity: 'reviewTask',
    operation: 'rating',
  };

  assert.deepEqual(
    classifyMutationFlushError(
      item,
      new ApiClientError('not pending', {
        status: 409,
        code: 'REVIEW_TASK_NOT_PENDING',
      }),
    ),
    { outcome: 'terminal', reason: 'REVIEW_TASK_NOT_PENDING' },
  );
});
```

- [ ] **Step 3: Run frontend queue tests and verify they fail**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-task-offline.test.mts
node --experimental-strip-types apps/web/src/lib/mutation-queue-flush.test.mts
```

Expected:
- First command fails because `review-task-offline.ts` does not exist.
- Second command fails because `MutationEntity` and `MutationOperation` do not support `reviewTask/rating`, and `MutationApis` has no `reviewTasks`.

- [ ] **Step 4: Implement Dexie type and schema changes**

In `apps/web/src/lib/db.ts`, update unions:

```ts
export type MutationEntity = 'wrongQuestion' | 'ocrRecord' | 'reviewTask';
export type MutationOperation = 'create' | 'update' | 'delete' | 'rating';
```

Add Dexie version 8 after version 7:

```ts
db.version(8).stores({
  messages: 'id, userId, [userId+order], role, order, createdAt',
  ocrRecords:
    'id, userId, [userId+createdAt], [userId+pendingOperation], type, groupId, createdAt, syncStatus',
  wrongQuestions:
    'id, userId, [userId+sourceGroupId], [userId+createdAt], [userId+pendingOperation], source, sourceGroupId, subject, category, errorType, status, syncStatus, createdAt, updatedAt',
  mutationQueue:
    '&id, userId, [userId+status], [userId+entity], [userId+entity+operation], dedupeKey, nextRetryAt, updatedAt',
});
```

- [ ] **Step 5: Implement review task offline helper**

Create `apps/web/src/lib/review-task-offline.ts`:

```ts
import type { ReviewRatingRequest } from '@repo/types/api/review';
import type { ReviewTaskItemResponse } from '@repo/types/api/review-task';

import { ApiClientError } from './api-client.ts';
import type { MutationQueueItem } from './db.ts';
import { createMutationQueueItem } from './mutation-queue.ts';

export type ReviewTaskRatingPayload = {
  taskId: string;
  request: ReviewRatingRequest & {
    reviewedAt: string;
    clientMutationId: string;
  };
  taskSnapshot: ReviewTaskItemResponse;
};

export function getReviewTaskRatingDedupeKey(userId: string, taskId: string) {
  return `${userId}:reviewTask:${taskId}:rating`;
}

export function createReviewTaskRatingQueueItem({
  userId,
  task,
  request,
}: {
  userId: string;
  task: ReviewTaskItemResponse;
  request: ReviewTaskRatingPayload['request'];
}) {
  return createMutationQueueItem({
    userId,
    entity: 'reviewTask',
    operation: 'rating',
    entityId: task.id,
    dedupeKey: getReviewTaskRatingDedupeKey(userId, task.id),
    payload: {
      taskId: task.id,
      request,
      taskSnapshot: task,
    } satisfies ReviewTaskRatingPayload,
  });
}

export function readReviewTaskRatingPayload(payload: unknown): ReviewTaskRatingPayload {
  if (!isReviewTaskRatingPayload(payload)) {
    throw new Error('Invalid review task rating queue payload');
  }
  return payload;
}

export function isRetryableReviewTaskRatingError(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.status === 0 || error.status >= 500;
  }

  return true;
}

export function isReviewTaskRatingItem(item: MutationQueueItem) {
  return item.entity === 'reviewTask' && item.operation === 'rating';
}

function isReviewTaskRatingPayload(value: unknown): value is ReviewTaskRatingPayload {
  if (!isRecord(value) || typeof value.taskId !== 'string') return false;
  if (!isRecord(value.request)) return false;
  return (
    typeof value.request.rating === 'number' &&
    typeof value.request.reviewedAt === 'string' &&
    typeof value.request.clientMutationId === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```

- [ ] **Step 6: Preserve rating payload during dedupe merge**

In `apps/web/src/lib/mutation-queue.ts`, add this at the top of `mergeMutationQueueItems()`:

```ts
  if (existing.entity === 'reviewTask' && existing.operation === 'rating') {
    return {
      ...incoming,
      id: existing.id,
      createdAt: existing.createdAt,
      retryCount: 0,
      lastError: undefined,
      nextRetryAt: undefined,
      status: 'pending',
    };
  }
```

This keeps a single queue item per task while allowing the most recent click to replace the previous local rating before sync.

- [ ] **Step 7: Extend mutation flush**

In `apps/web/src/lib/mutation-queue-flush.ts`, import review task API and helper:

```ts
import { createReviewTaskApi } from './review-task-api.ts';
import {
  isReviewTaskRatingItem,
  readReviewTaskRatingPayload,
} from './review-task-offline.ts';
```

Extend `MutationApis`:

```ts
type MutationApis = {
  wrongQuestions: Pick<
    ReturnType<typeof createWrongQuestionApi>,
    'create' | 'update' | 'delete'
  >;
  ocrRecords: Pick<ReturnType<typeof createOcrRecordApi>, 'create' | 'delete'>;
  reviewTasks: Pick<ReturnType<typeof createReviewTaskApi>, 'submitRating'>;
};
```

Extend `defaultApis`:

```ts
  reviewTasks: createReviewTaskApi(apiClient),
```

Add a branch in `flushMutationItem()` before OCR fallback:

```ts
    if (isReviewTaskRatingItem(item)) {
      const record = await flushReviewTaskRatingItem(item, accessToken, apis);
      return { outcome: 'success', record };
    }
```

Add the flush helper:

```ts
async function flushReviewTaskRatingItem(
  item: MutationQueueItem,
  accessToken: string,
  apis: MutationApis,
) {
  const payload = readReviewTaskRatingPayload(item.payload);
  return apis.reviewTasks.submitRating(accessToken, payload.taskId, payload.request);
}
```

Keep `classifyMutationFlushError()` rules:
- 401 and 403 return terminal unauthorized.
- status 0 and 5xx return retry.
- other API errors return terminal by code.

- [ ] **Step 8: Return flush summary**

In `apps/web/src/lib/mutation-queue-flush.ts`, add:

```ts
export type MutationQueueFlushSummary = {
  successCount: number;
  retryCount: number;
  terminalCount: number;
  reviewRatingSuccessCount: number;
};
```

At the start of `flushMutationQueue()`, initialize:

```ts
  const summary: MutationQueueFlushSummary = {
    successCount: 0,
    retryCount: 0,
    terminalCount: 0,
    reviewRatingSuccessCount: 0,
  };
```

When a result succeeds:

```ts
      summary.successCount += 1;
      if (isReviewTaskRatingItem(item)) {
        summary.reviewRatingSuccessCount += 1;
      }
      await applyFlushSuccess(item, result.record);
      continue;
```

When a result retries:

```ts
    if (result.outcome === 'retry') {
      summary.retryCount += 1;
    } else {
      summary.terminalCount += 1;
    }
```

Return summary at the end of `flushMutationQueue()`:

```ts
  return summary;
```

- [ ] **Step 9: Run queue tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-task-offline.test.mts
node --experimental-strip-types apps/web/src/lib/mutation-queue-flush.test.mts
```

Expected: both commands exit with code 0.

- [ ] **Step 10: Commit queue changes**

Run:

```powershell
git add apps/web/src/lib/db.ts apps/web/src/lib/mutation-queue.ts apps/web/src/lib/mutation-queue-flush.ts apps/web/src/lib/mutation-queue-flush.test.mts apps/web/src/lib/review-task-offline.ts apps/web/src/lib/review-task-offline.test.mts
git commit -m "feat: queue offline review task ratings"
```

Expected: commit succeeds.

---

## Task 6: Connect Offline Rating State to Today Page

**Files:**
- Modify: `apps/web/src/lib/review-task-api.ts`
- Modify: `apps/web/src/lib/review-task-api.test.mts`
- Modify: `apps/web/src/hooks/use-mutation-queue-flush.ts`
- Create: `apps/web/src/hooks/use-review-task-pending-ratings.ts`
- Modify: `apps/web/src/lib/review-task-view.ts`
- Modify: `apps/web/src/lib/review-task-view.test.mts`
- Modify: `apps/web/src/app/(main)/today/page.tsx`

- [ ] **Step 1: Add API client request body test**

In `apps/web/src/lib/review-task-api.test.mts`, update `testSubmitsRating()` request:

```ts
  const result = await reviewTaskApi.submitRating('token_1', 'task_1', {
    rating: 3,
    reviewedAt: '2026-06-14T08:00:00.000Z',
    reviewDurationMs: 12000,
    clientMutationId: '11111111-1111-4111-8111-111111111111',
  });
```

Update body assertion:

```ts
  assert.deepEqual(requests[0].body, {
    rating: 3,
    reviewedAt: '2026-06-14T08:00:00.000Z',
    reviewDurationMs: 12000,
    clientMutationId: '11111111-1111-4111-8111-111111111111',
  });
```

- [ ] **Step 2: Add pending-rating view tests**

In `apps/web/src/lib/review-task-view.test.mts`, add:

```ts
import {
  getReviewRatingLabel,
  mergeLocalPendingRatings,
} from './review-task-view.ts';
```

Add:

```ts
function testMergesLocalPendingRatings() {
  const result = mergeLocalPendingRatings(
    [{ id: 'task_1', status: 'PENDING' }],
    {
      task_1: {
        rating: 3,
        reviewedAt: '2026-06-14T08:00:00.000Z',
        clientMutationId: '11111111-1111-4111-8111-111111111111',
      },
    },
  );

  assert.equal(result[0]?.localStatus, 'LOCAL_RATING_PENDING');
  assert.equal(result[0]?.pendingRatingLabel, '掌握');
}

function testReturnsReviewRatingLabels() {
  assert.equal(getReviewRatingLabel(1), '忘记');
  assert.equal(getReviewRatingLabel(2), '困难');
  assert.equal(getReviewRatingLabel(3), '掌握');
  assert.equal(getReviewRatingLabel(4), '轻松');
}
```

Call both functions from `run()`.

- [ ] **Step 3: Run tests and verify they fail**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-task-api.test.mts
node --experimental-strip-types apps/web/src/lib/review-task-view.test.mts
```

Expected:
- API test fails until shared schema accepts `clientMutationId`.
- View test fails because pending helpers do not exist.

- [ ] **Step 4: Implement pending-rating view helpers**

In `apps/web/src/lib/review-task-view.ts`, add:

```ts
import type { ReviewRating } from '@repo/types/api/review';

type PendingRatingRequest = {
  rating: ReviewRating;
  reviewedAt: string;
  clientMutationId: string;
};

export type ReviewTaskWithLocalState<T extends MinimalTask> = T & {
  localStatus?: 'LOCAL_RATING_PENDING';
  pendingRatingLabel?: string;
};

export function getReviewRatingLabel(rating: ReviewRating) {
  const labels: Record<ReviewRating, string> = {
    1: '忘记',
    2: '困难',
    3: '掌握',
    4: '轻松',
  };
  return labels[rating];
}

export function mergeLocalPendingRatings<T extends MinimalTask>(
  tasks: T[],
  pendingByTaskId: Record<string, PendingRatingRequest>,
): Array<ReviewTaskWithLocalState<T>> {
  return tasks.map((task) => {
    const pending = pendingByTaskId[task.id];
    if (!pending || task.status !== 'PENDING') return task;

    return {
      ...task,
      localStatus: 'LOCAL_RATING_PENDING',
      pendingRatingLabel: getReviewRatingLabel(pending.rating),
    };
  });
}
```

- [ ] **Step 5: Implement Dexie pending ratings hook**

Create `apps/web/src/hooks/use-review-task-pending-ratings.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import type { ReviewRatingRequest } from '@repo/types/api/review';

import { db } from '@/lib/db';
import { readReviewTaskRatingPayload } from '@/lib/review-task-offline';

type PendingRatingRequest = ReviewRatingRequest & {
  reviewedAt: string;
  clientMutationId: string;
};

export function useReviewTaskPendingRatings(userId: string) {
  const [pendingByTaskId, setPendingByTaskId] = useState<Record<string, PendingRatingRequest>>({});
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setPendingByTaskId({});
      setPendingCount(0);
      return;
    }

    const subscription = liveQuery(async () => {
      const items = await db.mutationQueue
        .where('[userId+entity+operation]')
        .equals([userId, 'reviewTask', 'rating'])
        .toArray();

      const next: Record<string, PendingRatingRequest> = {};
      for (const item of items) {
        const payload = readReviewTaskRatingPayload(item.payload);
        next[payload.taskId] = payload.request;
      }
      return next;
    }).subscribe({
      next: (next) => {
        setPendingByTaskId(next);
        setPendingCount(Object.keys(next).length);
      },
      error: () => {
        setPendingByTaskId({});
        setPendingCount(0);
      },
    });

    return () => subscription.unsubscribe();
  }, [userId]);

  return { pendingByTaskId, pendingCount };
}
```

- [ ] **Step 6: Invalidate review queries after rating flush**

In `apps/web/src/hooks/use-mutation-queue-flush.ts`, import query client and keys:

```ts
import { useQueryClient } from '@tanstack/react-query';
import { reviewTaskQueryKeys } from './use-review-tasks';
import { reviewQueryKeys } from './use-reviews';
```

Inside `useMutationQueueFlush()`, add:

```ts
  const queryClient = useQueryClient();
```

Replace the flush call:

```ts
      const summary = await flushMutationQueue({
        userId: currentUserId,
        accessToken,
      });
      if (summary.reviewRatingSuccessCount > 0) {
        void queryClient.invalidateQueries({ queryKey: reviewTaskQueryKeys.all });
        void queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all });
      }
```

Add `queryClient` to the callback dependencies.

- [ ] **Step 7: Update Today page rating flow**

In `apps/web/src/app/(main)/today/page.tsx`, import helpers:

```ts
import { enqueueMutationQueueItem } from '@/lib/mutation-queue';
import {
  createReviewTaskRatingQueueItem,
  isRetryableReviewTaskRatingError,
} from '@/lib/review-task-offline';
import { useMutationQueueFlush } from '@/hooks/use-mutation-queue-flush';
import { useReviewTaskPendingRatings } from '@/hooks/use-review-task-pending-ratings';
```

Use pending state after `userId`:

```ts
  const { flush } = useMutationQueueFlush();
  const { pendingByTaskId, pendingCount: pendingRatingSyncCount } =
    useReviewTaskPendingRatings(userId);
```

Merge task state:

```ts
  const reviewTasksWithLocalState = mergeLocalPendingRatings(
    todayReviewTasks.data?.tasks ?? [],
    pendingByTaskId,
  );
  const groupedReviewTasks = groupReviewTasksByStatus(reviewTasksWithLocalState);
```

Change `rateTask` signature:

```ts
    async (task: ReviewTaskItemResponse, rating: ReviewRating) => {
      const reviewedAt = new Date().toISOString();
      const clientMutationId = crypto.randomUUID();
      const request = { rating, reviewedAt, clientMutationId };
      try {
        const result = await submitReviewRating.mutateAsync({
          taskId: task.id,
          request,
        });
        const feedback = buildReviewRatingFeedback({
          rating,
          nextReview: result.card.nextReview,
        });
        setReviewFeedbacks((prev) => ({
          ...prev,
          [task.id]: feedback,
        }));
        setRevealedTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
        showNotice(`${feedback.title}：${feedback.description}`);
      } catch (error) {
        if (userId && isRetryableReviewTaskRatingError(error)) {
          await enqueueMutationQueueItem(
            createReviewTaskRatingQueueItem({
              userId,
              task,
              request,
            }),
          );
          showNotice(`已选择：${getReviewRatingLabel(rating)}，等待同步`, 'neutral');
          return;
        }

        showNotice(getMutationErrorMessage(error), 'neutral');
      }
    },
```

Update card callback:

```tsx
                  onRate={(rating) => void rateTask(task, rating)}
```

Display a sync summary near the review task heading:

```tsx
            {pendingRatingSyncCount > 0 ? (
              <button
                type="button"
                onClick={() => void flush()}
                className="tap-target shrink-0 rounded-full bg-[#fff7df] px-3 py-1 text-xs font-semibold text-[#8a650f] ring-1 ring-[#ead68c] transition-all hover:bg-[#fff0c2] active:scale-95"
              >
                {pendingRatingSyncCount} 条待同步，重试
              </button>
            ) : null}
```

Pass local state into `ReviewTaskCard`:

```tsx
                  localStatus={task.localStatus}
                  pendingRatingLabel={task.pendingRatingLabel}
```

Update `ReviewTaskCard` props:

```ts
  localStatus?: 'LOCAL_RATING_PENDING';
  pendingRatingLabel?: string;
```

Inside `ReviewTaskCard`, derive:

```ts
  const localRatingPending = localStatus === 'LOCAL_RATING_PENDING';
```

Render pending message above action buttons:

```tsx
      {localRatingPending ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#fff7df] px-3 py-2 text-sm text-[#8a650f] ring-1 ring-[#ead68c]">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          <div className="min-w-0">
            <p className="font-bold">已选择：{pendingRatingLabel}，等待同步</p>
            <p className="mt-0.5 text-xs font-semibold">恢复网络后会自动保存到复习记录。</p>
          </div>
        </div>
      ) : null}
```

Disable skip and rating buttons when `localRatingPending`:

```tsx
disabled={actionPending || ratingPending || localRatingPending}
```

and:

```tsx
disabled={ratingPending || localRatingPending}
```

- [ ] **Step 8: Run frontend helper tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-task-api.test.mts
node --experimental-strip-types apps/web/src/lib/review-task-view.test.mts
```

Expected: both commands exit with code 0.

- [ ] **Step 9: Commit Today page offline state changes**

Run:

```powershell
git add apps/web/src/lib/review-task-api.ts apps/web/src/lib/review-task-api.test.mts apps/web/src/hooks/use-mutation-queue-flush.ts apps/web/src/hooks/use-review-task-pending-ratings.ts apps/web/src/lib/review-task-view.ts apps/web/src/lib/review-task-view.test.mts "apps/web/src/app/(main)/today/page.tsx"
git commit -m "feat: show offline review rating state"
```

Expected: commit succeeds.

---

## Task 7: Add In-App Review Reminder Summary

**Files:**
- Create: `apps/web/src/lib/review-reminder.ts`
- Create: `apps/web/src/lib/review-reminder.test.mts`
- Modify: `apps/web/src/app/(main)/today/page.tsx`

- [ ] **Step 1: Create failing reminder helper tests**

Create `apps/web/src/lib/review-reminder.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReviewReminderSummary,
  getDefaultReviewReminderPreference,
  readReviewReminderPreference,
} from './review-reminder.ts';

const tasks = [
  { id: 'task_1', status: 'PENDING', dueAt: '2026-06-15T07:00:00.000Z' },
  { id: 'task_2', status: 'PENDING', dueAt: '2026-06-15T09:00:00.000Z' },
  { id: 'task_3', status: 'COMPLETED', dueAt: '2026-06-15T06:00:00.000Z' },
] as const;

test('builds in-app review reminder summary', () => {
  const summary = buildReviewReminderSummary({
    tasks,
    pendingCount: 2,
    pendingSyncCount: 1,
    now: new Date('2026-06-15T08:00:00.000Z'),
  });

  assert.equal(summary.todayDueCount, 2);
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.nextDueLabel, '17:00');
  assert.equal(summary.pendingSyncCount, 1);
});

test('uses default reminder preference when storage is empty or invalid', () => {
  assert.deepEqual(getDefaultReviewReminderPreference(), {
    inAppEnabled: true,
    quietHoursStart: '22:30',
    quietHoursEnd: '07:30',
  });

  assert.deepEqual(readReviewReminderPreference(null), getDefaultReviewReminderPreference());
  assert.deepEqual(readReviewReminderPreference('{bad json'), getDefaultReviewReminderPreference());
});
```

- [ ] **Step 2: Run reminder test and verify it fails**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-reminder.test.mts
```

Expected: fails because `review-reminder.ts` does not exist.

- [ ] **Step 3: Implement reminder helper**

Create `apps/web/src/lib/review-reminder.ts`:

```ts
type ReminderTask = {
  id: string;
  status: string;
  dueAt: string;
};

export type ReviewReminderPreference = {
  inAppEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};

export function getReviewReminderPreferenceKey(userId: string) {
  return `prepmind-review-reminder:${userId}`;
}

export function getDefaultReviewReminderPreference(): ReviewReminderPreference {
  return {
    inAppEnabled: true,
    quietHoursStart: '22:30',
    quietHoursEnd: '07:30',
  };
}

export function readReviewReminderPreference(raw: string | null): ReviewReminderPreference {
  if (!raw) return getDefaultReviewReminderPreference();

  try {
    const parsed = JSON.parse(raw) as Partial<ReviewReminderPreference>;
    return {
      ...getDefaultReviewReminderPreference(),
      ...parsed,
      inAppEnabled:
        typeof parsed.inAppEnabled === 'boolean'
          ? parsed.inAppEnabled
          : getDefaultReviewReminderPreference().inAppEnabled,
      quietHoursStart:
        typeof parsed.quietHoursStart === 'string'
          ? parsed.quietHoursStart
          : getDefaultReviewReminderPreference().quietHoursStart,
      quietHoursEnd:
        typeof parsed.quietHoursEnd === 'string'
          ? parsed.quietHoursEnd
          : getDefaultReviewReminderPreference().quietHoursEnd,
    };
  } catch {
    return getDefaultReviewReminderPreference();
  }
}

export function buildReviewReminderSummary({
  tasks,
  pendingCount,
  pendingSyncCount,
  now = new Date(),
}: {
  tasks: readonly ReminderTask[];
  pendingCount: number;
  pendingSyncCount: number;
  now?: Date;
}) {
  const pendingTasks = tasks
    .filter((task) => task.status === 'PENDING')
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const overdueCount = pendingTasks.filter((task) => Date.parse(task.dueAt) < now.getTime()).length;
  const nextTask = pendingTasks.find((task) => Date.parse(task.dueAt) >= now.getTime());

  return {
    todayDueCount: pendingCount,
    overdueCount,
    nextDueLabel: nextTask ? formatTime(nextTask.dueAt) : '暂无',
    pendingSyncCount,
  };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}
```

- [ ] **Step 4: Render reminder summary on Today page**

In `apps/web/src/app/(main)/today/page.tsx`, import:

```ts
import { buildReviewReminderSummary } from '@/lib/review-reminder';
```

Create the summary after `groupedReviewTasks`:

```ts
  const reviewReminderSummary = buildReviewReminderSummary({
    tasks: reviewTasksWithLocalState,
    pendingCount: todayReviewTasks.data?.pendingCount ?? 0,
    pendingSyncCount: pendingRatingSyncCount,
  });
```

Replace the three `MiniStat` cards under the top progress panel with four cards:

```tsx
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="今日待复习" value={`${reviewReminderSummary.todayDueCount} 张`} />
            <MiniStat label="已逾期" value={`${reviewReminderSummary.overdueCount} 张`} />
            <MiniStat label="下一张" value={reviewReminderSummary.nextDueLabel} />
            <MiniStat label="待同步评分" value={`${reviewReminderSummary.pendingSyncCount} 条`} />
          </div>
```

- [ ] **Step 5: Run reminder test**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-reminder.test.mts
```

Expected: test exits with code 0.

- [ ] **Step 6: Commit reminder summary**

Run:

```powershell
git add apps/web/src/lib/review-reminder.ts apps/web/src/lib/review-reminder.test.mts "apps/web/src/app/(main)/today/page.tsx"
git commit -m "feat: add in-app review reminder summary"
```

Expected: commit succeeds.

---

## Task 8: Verification, Documentation, and Final Commit

**Files:**
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Run full focused verification**

Run:

```powershell
node --experimental-strip-types packages/types/tests/review.test.mts
node --experimental-strip-types packages/types/tests/review-task.test.mts
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --filter @repo/server test -- review-tasks.service.spec.ts
bun --filter @repo/server test:e2e -- --runInBand review-tasks.e2e-spec.ts
node --experimental-strip-types apps/web/src/lib/mutation-queue-flush.test.mts
node --experimental-strip-types apps/web/src/lib/review-task-api.test.mts
node --experimental-strip-types apps/web/src/lib/review-task-offline.test.mts
node --experimental-strip-types apps/web/src/lib/review-task-view.test.mts
node --experimental-strip-types apps/web/src/lib/review-reminder.test.mts
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/web lint
bun --filter @repo/web build
git diff --check
```

Expected:
- Every command exits with code 0.
- `git diff --check` reports no whitespace errors.

- [ ] **Step 2: Run browser acceptance**

Start services:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

Manual acceptance:

1. Log in with a test account.
2. Ensure a wrong question is added to review and a ReviewTask appears on Today.
3. Stop the backend process.
4. Open Today, reveal a review card, and click `掌握`.
5. Confirm the card shows `已选择：掌握，等待同步`.
6. Confirm rating buttons and skip button are disabled for that card.
7. Refresh Today and confirm the pending-sync state remains.
8. Restart the backend.
9. Focus the browser window or click the retry sync control.
10. Confirm the card moves to completed after sync.
11. Confirm stats increase only after sync success.
12. Confirm the database has one `ReviewLog` for the `clientMutationId`.

Expected: all 12 checks match.

- [ ] **Step 3: Update data-flow docs**

In `docs/data-flow.md`, update current review flow with:

```md
- ReviewTask rating now uses a client-generated `clientMutationId`.
- Server writes `ReviewLog.clientMutationId` and treats repeated `POST /review-tasks/:taskId/rating` calls with the same id as idempotent replays.
- Dexie `mutationQueue` supports `entity=reviewTask`, `operation=rating` for offline or retryable rating failures.
- Offline rating does not locally advance FSRS stats. The Today page only shows pending-sync state until server sync succeeds.
- `useMutationQueueFlush()` refreshes ReviewTask and Review stats queries after successful queued rating sync.
- Phase 4.4 reminder scope is in-app summary only: due count, overdue count, next due card, and pending-sync count.
```

- [ ] **Step 4: Update roadmap and agent docs**

In `docs/roadmap.md`, mark Phase 4.4 as complete and set Phase 4.5 as the next Phase 4 item:

```md
| Phase 4.4 | 已完成 | 离线评分队列、服务端幂等评分、今日复习待同步状态、in-app 提醒摘要 |
| Phase 4.5 | 下一步 | 复习提醒与长期计划策略 |
```

In `AGENTS.md` and `CLAUDE.md`, update the project snapshot and current data flow with:

```md
| Phase 4.4 | 已完成 | 离线评分队列、服务端幂等评分、今日复习待同步状态、in-app 提醒摘要 |
```

Add to current data flow:

```md
- ReviewTask 评分支持 `clientMutationId` 幂等；重复提交同一评分命令不会重复写 `ReviewLog`。
- Dexie `mutationQueue` 已支持 `reviewTask/rating`，用于离线或弱网评分补偿同步。
- 今日任务页会展示本地待同步评分，并在同步成功后刷新今日复习任务和学习统计。
```

- [ ] **Step 5: Update devlog**

In `DEVLOG.md`, add one concise entry under `2026-06-15`:

```md
### Phase 4.4 离线评分队列与提醒策略

- 为 ReviewTask 评分加入 `clientMutationId` 幂等链路，避免弱网重试重复写入 ReviewLog。
- 扩展 Dexie mutationQueue，支持 `reviewTask/rating` 离线评分补偿同步。
- 今日任务页新增待同步评分状态、重试入口和 in-app 复习提醒摘要。
- 完成 shared schema、Prisma、后端单测/e2e、前端队列和视图辅助测试。
```

Keep all planning and open items at the bottom of `DEVLOG.md` so the newest work remains easy to scan.

- [ ] **Step 6: Re-run final verification after docs**

Run:

```powershell
bun --filter @repo/web lint
bun --filter @repo/server lint
git diff --check
git status --short
```

Expected:
- Lint commands exit with code 0.
- `git diff --check` reports no whitespace errors.
- `git status --short` shows only intentional modified docs and implementation files.

- [ ] **Step 7: Commit docs and final verification state**

Run:

```powershell
git add docs/data-flow.md docs/roadmap.md AGENTS.md CLAUDE.md DEVLOG.md
git commit -m "docs: update phase 4.4 review rating flow"
```

Expected: commit succeeds.

---

## Self-Review Checklist for the Implementing Agent

- Every requirement in `docs/superpowers/specs/2026-06-15-phase-4-4-offline-review-rating-design.md` maps to a task above:
  - Server idempotency: Tasks 1, 2, 3, 4.
  - Offline rating queue: Tasks 5, 6.
  - Today pending-sync UI: Task 6.
  - In-app reminder summary: Task 7.
  - Docs and verification: Task 8.
- Do not add browser Notification permission, PWA Push, BullMQ reminders, system calendar, offline skip/reopen, or cross-device offline merge in Phase 4.4.
- Do not locally update Card, ReviewLog, or review stats when an offline rating is queued. Only the server-confirmed flush may update authoritative review data.
- Keep `clientMutationId` optional for legacy clients, but always generate it in the new Today rating flow.
- Keep `ReviewLog.clientMutationId` nullable and unique, so existing rows remain valid.
- Query idempotency results through the current user boundary. A mutation id belonging to another user must not return task, card, or log data.
- Keep commits frequent and scoped to the task boundaries above.
