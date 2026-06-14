# Phase 4.3 ReviewTask Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist ReviewTask records so today review tasks have stable lifecycle state, rating completion, skip, and reopen behavior.

**Architecture:** Add a Prisma `ReviewTask` model and a new `ReviewTasksModule` instead of expanding `ReviewsController`. Keep `Card` and `ReviewLog` as the FSRS scheduling and stats source of truth; `ReviewTask` records task lifecycle only. Migrate the today page from `/reviews/tasks/today` card-derived tasks to `/review-tasks/today` persisted tasks while preserving the local static study notebook tasks.

**Tech Stack:** Bun workspace, Prisma/PostgreSQL, NestJS 11, Zod shared contracts, Next.js 16, TanStack Query, React 19, TypeScript.

---

## File Structure

- `packages/database/prisma/schema.prisma`
  - Add `ReviewTask`, `ReviewTaskStatus`, `ReviewTaskSource`, and relation fields on `User`, `Card`, and `ReviewLog`.
- `packages/database/prisma/migrations/<timestamp>_add_review_tasks/migration.sql`
  - Generated migration for the new table, enums, indexes, and foreign keys.
- `packages/types/src/api/review-task.ts`
  - New shared Zod schemas and response/request types for ReviewTask APIs.
- `packages/types/src/index.ts`
  - Export `./api/review-task`.
- `packages/types/package.json`
  - Add export path `./api/review-task`.
- `packages/types/tests/review-task.test.mts`
  - Runtime schema tests for ReviewTask contracts.
- `apps/server/src/review-tasks/review-tasks.module.ts`
  - New Nest module.
- `apps/server/src/review-tasks/review-tasks.controller.ts`
  - Guarded `/review-tasks` routes.
- `apps/server/src/review-tasks/review-tasks.service.ts`
  - Lazy generation, list, rating, skip, reopen, and mappers.
- `apps/server/src/review-tasks/review-tasks.service.spec.ts`
  - Unit tests for generation, idempotency, rating completion, skip, reopen, and isolation.
- `apps/server/test/review-tasks.e2e-spec.ts`
  - End-to-end task lifecycle coverage.
- `apps/server/src/app.module.ts`
  - Import `ReviewTasksModule`.
- `apps/web/src/lib/review-task-api.ts`
  - New frontend API client.
- `apps/web/src/lib/review-task-api.test.mts`
  - API path and schema tests.
- `apps/web/src/hooks/use-review-tasks.ts`
  - TanStack Query hooks and invalidation.
- `apps/web/src/lib/review-task-view.ts`
  - Pure grouping/feedback helpers for today page.
- `apps/web/src/lib/review-task-view.test.mts`
  - Helper tests.
- `apps/web/src/app/(main)/today/page.tsx`
  - Migrate review section to persisted ReviewTask flow.
- `docs/data-flow.md`, `docs/roadmap.md`, `AGENTS.md`, `CLAUDE.md`, `DEVLOG.md`
  - Update after implementation and browser verification.

---

## Task 1: Add Prisma ReviewTask Model

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_add_review_tasks/migration.sql`

- [ ] **Step 1: Add failing schema expectation check**

Run:

```powershell
rg -n "model ReviewTask|enum ReviewTaskStatus|enum ReviewTaskSource|reviewTasks|reviewTask" packages/database/prisma/schema.prisma
```

Expected: FAIL / no matches for `model ReviewTask`.

- [ ] **Step 2: Update Prisma schema**

In `model User`, add:

```prisma
  reviewTasks ReviewTask[]
```

In `model Card`, add:

```prisma
  reviewTasks   ReviewTask[]
```

In `model ReviewLog`, add:

```prisma
  reviewTask ReviewTask?
```

After `model ReviewLog`, add:

```prisma
model ReviewTask {
  id            String           @id @default(cuid())
  userId        String
  cardId        String
  reviewLogId   String?          @unique
  scheduledDate String           @db.VarChar(10)
  dueAt         DateTime
  status        ReviewTaskStatus @default(PENDING)
  source        ReviewTaskSource @default(FSRS)
  completedAt   DateTime?
  skippedAt     DateTime?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  card      Card       @relation(fields: [cardId], references: [id], onDelete: Cascade)
  reviewLog ReviewLog? @relation(fields: [reviewLogId], references: [id], onDelete: SetNull)

  @@unique([cardId, scheduledDate])
  @@index([userId, scheduledDate, status])
  @@index([userId, status, dueAt])
}

enum ReviewTaskStatus {
  PENDING
  COMPLETED
  SKIPPED
  CANCELLED
}

enum ReviewTaskSource {
  FSRS
  MANUAL
  PLANNER
}
```

- [ ] **Step 3: Format and create migration**

Run:

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --cwd packages/database prisma format
bun --cwd packages/database prisma migrate dev --name add_review_tasks
```

Expected: migration SQL is created under `packages/database/prisma/migrations/*_add_review_tasks/`.

If Prisma generate hits Windows `EPERM` on `query_engine-windows.dll.node`, inspect running project processes:

```powershell
Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -like '*PrepMind_ai智能备考助手*'
} | Select-Object ProcessId,Name,CommandLine
```

Stop only existing project dev/watch processes, then rerun migration/generate.

- [ ] **Step 4: Verify database package**

Run:

```powershell
bun --cwd packages/database test
```

Expected: exit 0.

- [ ] **Step 5: Commit database model**

```powershell
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat: add review task model"
```

---

## Task 2: Add Shared ReviewTask Contracts

**Files:**
- Create: `packages/types/src/api/review-task.ts`
- Modify: `packages/types/src/index.ts`
- Modify: `packages/types/package.json`
- Create: `packages/types/tests/review-task.test.mts`

- [ ] **Step 1: Add failing contract tests**

Create `packages/types/tests/review-task.test.mts`:

```ts
import assert from 'node:assert/strict';

import {
  reviewTaskActionResponseSchema,
  reviewTaskListQuerySchema,
  reviewTaskListResponseSchema,
  reviewTaskRatingResponseSchema,
  reviewTaskStatusSchema,
  reviewTaskTodayQuerySchema,
  reviewTaskTodayResponseSchema,
} from '../src/api/review-task.ts';

function run() {
  testStatus();
  testTodayQuery();
  testTodayResponse();
  testListQueryAndResponse();
  testRatingResponse();
  testActionResponse();
}

function testStatus() {
  assert.equal(reviewTaskStatusSchema.parse('PENDING'), 'PENDING');
  assert.throws(() => reviewTaskStatusSchema.parse('DONE'));
}

function testTodayQuery() {
  const result = reviewTaskTodayQuerySchema.parse({
    date: '2026-06-14',
    timezoneOffsetMinutes: '-480',
    includeCompleted: 'false',
  });

  assert.equal(result.date, '2026-06-14');
  assert.equal(result.timezoneOffsetMinutes, -480);
  assert.equal(result.includeCompleted, false);
}

function testTodayResponse() {
  const result = reviewTaskTodayResponseSchema.parse({
    date: '2026-06-14',
    pendingCount: 1,
    completedCount: 1,
    skippedCount: 1,
    tasks: [createTaskPayload()],
  });

  assert.equal(result.tasks[0]?.status, 'PENDING');
  assert.equal(result.tasks[0]?.wrongQuestion?.subject, '数学');
}

function testListQueryAndResponse() {
  const query = reviewTaskListQuerySchema.parse({
    page: '2',
    pageSize: '10',
    status: 'SKIPPED',
    date: '2026-06-14',
  });
  assert.equal(query.page, 2);
  assert.equal(query.status, 'SKIPPED');

  const response = reviewTaskListResponseSchema.parse({
    items: [createTaskPayload({ status: 'SKIPPED' })],
    total: 1,
    page: 2,
    pageSize: 10,
  });
  assert.equal(response.items[0]?.status, 'SKIPPED');
}

function testRatingResponse() {
  const result = reviewTaskRatingResponseSchema.parse({
    task: createTaskPayload({ status: 'COMPLETED', reviewLogId: 'log_1' }),
    card: createCardPayload({ state: 'REVIEW' }),
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
    },
  });

  assert.equal(result.task.status, 'COMPLETED');
  assert.equal(result.log.rating, 3);
}

function testActionResponse() {
  const result = reviewTaskActionResponseSchema.parse({
    task: createTaskPayload({ status: 'SKIPPED' }),
  });

  assert.equal(result.task.status, 'SKIPPED');
}

function createTaskPayload(input: Partial<Record<string, unknown>> = {}) {
  return {
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
    card: createCardPayload(),
    wrongQuestion: {
      id: 'wrong_1',
      questionText: 'Compute 2 + 2.',
      subject: '数学',
      knowledgePoints: ['加法'],
      answer: '4',
      analysis: '2 + 2 = 4.',
      imageUrl: null,
      status: 'UNRESOLVED',
    },
    ...input,
  };
}

function createCardPayload(input: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'card_1',
    state: 'NEW',
    reviewCount: 0,
    lapses: 0,
    nextReview: '2026-06-14T08:00:00.000Z',
    ...input,
  };
}

run();
```

- [ ] **Step 2: Run contract tests and verify they fail**

Run:

```powershell
node --experimental-strip-types packages/types/tests/review-task.test.mts
```

Expected: FAIL because `../src/api/review-task.ts` does not exist.

- [ ] **Step 3: Create ReviewTask schemas**

Create `packages/types/src/api/review-task.ts`:

```ts
import { z } from 'zod';

import {
  reviewCardStateSchema,
  reviewLogSchema,
  reviewRatingResponseSchema,
  reviewWrongQuestionStatusSchema,
} from './review';

export const reviewTaskStatusSchema = z.enum([
  'PENDING',
  'COMPLETED',
  'SKIPPED',
  'CANCELLED',
]);

export const reviewTaskSourceSchema = z.enum(['FSRS', 'MANUAL', 'PLANNER']);

export const reviewTaskCardSummarySchema = z.object({
  id: z.string().min(1),
  state: reviewCardStateSchema,
  reviewCount: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  nextReview: z.string().datetime(),
});

export const reviewTaskWrongQuestionSummarySchema = z.object({
  id: z.string().min(1),
  questionText: z.string(),
  subject: z.string(),
  knowledgePoints: z.array(z.string()),
  answer: z.string(),
  analysis: z.string(),
  imageUrl: z.string().nullable(),
  status: reviewWrongQuestionStatusSchema,
});

export const reviewTaskItemSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  cardId: z.string().min(1),
  reviewLogId: z.string().nullable(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueAt: z.string().datetime(),
  status: reviewTaskStatusSchema,
  source: reviewTaskSourceSchema,
  completedAt: z.string().datetime().nullable(),
  skippedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  card: reviewTaskCardSummarySchema,
  wrongQuestion: reviewTaskWrongQuestionSummarySchema.optional(),
});

export const reviewTaskTodayQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
  includeCompleted: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? true : value === 'true')),
});

export const reviewTaskTodayResponseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pendingCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  tasks: z.array(reviewTaskItemSchema),
});

export const reviewTaskListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: reviewTaskStatusSchema.optional(),
});

export const reviewTaskListResponseSchema = z.object({
  items: z.array(reviewTaskItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export const reviewTaskRatingResponseSchema = z.object({
  task: reviewTaskItemSchema,
  card: reviewRatingResponseSchema.shape.card,
  log: reviewLogSchema,
});

export const reviewTaskActionResponseSchema = z.object({
  task: reviewTaskItemSchema,
});

export type ReviewTaskStatus = z.infer<typeof reviewTaskStatusSchema>;
export type ReviewTaskSource = z.infer<typeof reviewTaskSourceSchema>;
export type ReviewTaskCardSummaryResponse = z.infer<typeof reviewTaskCardSummarySchema>;
export type ReviewTaskWrongQuestionSummaryResponse = z.infer<
  typeof reviewTaskWrongQuestionSummarySchema
>;
export type ReviewTaskItemResponse = z.infer<typeof reviewTaskItemSchema>;
export type ReviewTaskTodayQuery = z.infer<typeof reviewTaskTodayQuerySchema>;
export type ReviewTaskTodayResponse = z.infer<typeof reviewTaskTodayResponseSchema>;
export type ReviewTaskListQuery = z.infer<typeof reviewTaskListQuerySchema>;
export type ReviewTaskListResponse = z.infer<typeof reviewTaskListResponseSchema>;
export type ReviewTaskRatingResponse = z.infer<typeof reviewTaskRatingResponseSchema>;
export type ReviewTaskActionResponse = z.infer<typeof reviewTaskActionResponseSchema>;
```

- [ ] **Step 4: Export package path**

In `packages/types/package.json`, add under `exports`:

```json
"./api/review-task": "./src/api/review-task.ts"
```

In `packages/types/src/index.ts`, add:

```ts
export * from './api/review-task';
```

- [ ] **Step 5: Run contract tests and typecheck**

Run:

```powershell
node --experimental-strip-types packages/types/tests/review-task.test.mts
bun --cwd packages/types typecheck
```

Expected: both exit 0. Node `MODULE_TYPELESS_PACKAGE_JSON` warnings are acceptable if exit code is 0.

- [ ] **Step 6: Commit shared contracts**

```powershell
git add packages/types/src/api/review-task.ts packages/types/src/index.ts packages/types/package.json packages/types/tests/review-task.test.mts
git commit -m "feat: add review task api contracts"
```

---

## Task 3: Add Backend ReviewTask Unit Tests

**Files:**
- Create: `apps/server/src/review-tasks/review-tasks.service.spec.ts`

- [ ] **Step 1: Create failing service tests**

Create `apps/server/src/review-tasks/review-tasks.service.spec.ts`:

```ts
import { ReviewTasksService } from './review-tasks.service';
import { PrismaService } from '../database/prisma.service';

describe('ReviewTasksService', () => {
  const now = new Date('2026-06-14T08:00:00.000Z');
  const card = {
    id: 'card_1',
    userId: 'user_1',
    questionId: null,
    wrongQuestionId: 'wrong_1',
    difficulty: 5,
    stability: 0,
    retrievability: 1,
    lastReview: null,
    nextReview: now,
    reviewCount: 0,
    lapses: 0,
    state: 'NEW' as const,
    suspendedAt: null,
    createdAt: now,
    updatedAt: now,
    wrongQuestion: {
      id: 'wrong_1',
      questionText: 'Compute 2 + 2.',
      subject: '数学',
      knowledgePoints: ['加法'],
      answer: '4',
      analysis: '2 + 2 = 4.',
      imageUrl: null,
      status: 'UNRESOLVED' as const,
    },
  };
  const task = {
    id: 'task_1',
    userId: 'user_1',
    cardId: 'card_1',
    reviewLogId: null,
    scheduledDate: '2026-06-14',
    dueAt: now,
    status: 'PENDING' as const,
    source: 'FSRS' as const,
    completedAt: null,
    skippedAt: null,
    createdAt: now,
    updatedAt: now,
    card,
  };
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
  };
  const prisma = {
    $transaction: jest.fn(),
    card: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    reviewTask: {
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    reviewLog: {
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );
  });

  function createService() {
    return new ReviewTasksService(prisma as unknown as PrismaService);
  }

  it('generates today tasks idempotently for due cards', async () => {
    prisma.card.findMany.mockResolvedValue([card]);
    prisma.reviewTask.createMany.mockResolvedValue({ count: 1 });
    prisma.reviewTask.findMany.mockResolvedValue([task]);

    const result = await createService().getToday('user_1', {
      date: '2026-06-14',
      timezoneOffsetMinutes: -480,
      includeCompleted: true,
    });

    expect(prisma.card.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        suspendedAt: null,
        nextReview: { lte: new Date('2026-06-14T15:59:59.999Z') },
      },
      select: { id: true, nextReview: true },
      orderBy: [{ nextReview: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    });
    expect(prisma.reviewTask.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'user_1',
          cardId: 'card_1',
          scheduledDate: '2026-06-14',
          dueAt: now,
          status: 'PENDING',
          source: 'FSRS',
        },
      ],
      skipDuplicates: true,
    });
    expect(result.pendingCount).toBe(1);
    expect(result.tasks[0]?.wrongQuestion?.subject).toBe('数学');
  });

  it('submits rating by completing the task and writing a review log', async () => {
    const updatedCard = {
      ...card,
      difficulty: 4.85,
      stability: 1,
      retrievability: 0.9,
      lastReview: now,
      nextReview: new Date('2026-06-15T08:00:00.000Z'),
      reviewCount: 1,
      state: 'REVIEW' as const,
    };
    const completedTask = {
      ...task,
      status: 'COMPLETED' as const,
      reviewLogId: 'log_1',
      completedAt: now,
      card: updatedCard,
    };
    prisma.reviewTask.findFirst.mockResolvedValue(task);
    prisma.card.update.mockResolvedValue(updatedCard);
    prisma.reviewLog.create.mockResolvedValue(reviewLog);
    prisma.reviewTask.update.mockResolvedValue(completedTask);

    const result = await createService().submitRating('user_1', 'task_1', {
      rating: 3,
      reviewedAt: now.toISOString(),
      reviewDurationMs: 12000,
    });

    expect(prisma.reviewTask.findFirst).toHaveBeenCalledWith({
      where: { id: 'task_1', userId: 'user_1' },
      include: { card: { include: { wrongQuestion: true } } },
    });
    expect(prisma.reviewTask.update).toHaveBeenCalledWith({
      where: { id: 'task_1' },
      data: {
        status: 'COMPLETED',
        reviewLogId: 'log_1',
        completedAt: now,
        skippedAt: null,
      },
      include: { card: { include: { wrongQuestion: true } } },
    });
    expect(result.task.status).toBe('COMPLETED');
    expect(result.card.state).toBe('REVIEW');
    expect(result.log.rating).toBe(3);
  });

  it('skips and reopens a pending task', async () => {
    prisma.reviewTask.findFirst.mockResolvedValueOnce(task).mockResolvedValueOnce({
      ...task,
      status: 'SKIPPED',
      skippedAt: now,
    });
    prisma.reviewTask.update
      .mockResolvedValueOnce({ ...task, status: 'SKIPPED', skippedAt: now })
      .mockResolvedValueOnce(task);

    const skipped = await createService().skip('user_1', 'task_1', now);
    const reopened = await createService().reopen('user_1', 'task_1');

    expect(skipped.task.status).toBe('SKIPPED');
    expect(reopened.task.status).toBe('PENDING');
  });
});
```

- [ ] **Step 2: Run service tests and verify they fail**

Run:

```powershell
bun --filter @repo/server test -- review-tasks.service.spec.ts
```

Expected: FAIL because `review-tasks.service.ts` does not exist.

---

## Task 4: Implement Backend ReviewTasksModule

**Files:**
- Create: `apps/server/src/review-tasks/review-tasks.module.ts`
- Create: `apps/server/src/review-tasks/review-tasks.controller.ts`
- Create: `apps/server/src/review-tasks/review-tasks.service.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Create module**

Create `apps/server/src/review-tasks/review-tasks.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ReviewTasksController } from './review-tasks.controller';
import { ReviewTasksService } from './review-tasks.service';

@Module({
  imports: [AuthModule],
  controllers: [ReviewTasksController],
  providers: [ReviewTasksService],
})
export class ReviewTasksModule {}
```

- [ ] **Step 2: Create controller**

Create `apps/server/src/review-tasks/review-tasks.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  reviewTaskListQuerySchema,
  reviewTaskTodayQuerySchema,
} from '@repo/types/api/review-task';
import { reviewRatingRequestSchema } from '@repo/types/api/review';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ReviewTasksService } from './review-tasks.service';

@Controller('review-tasks')
@UseGuards(JwtAuthGuard)
export class ReviewTasksController {
  constructor(private readonly reviewTasksService: ReviewTasksService) {}

  @Get('today')
  getToday(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = reviewTaskTodayQuerySchema.parse(query);
    return this.reviewTasksService.getToday(user.id, input);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = reviewTaskListQuerySchema.parse(query);
    return this.reviewTasksService.list(user.id, input);
  }

  @Post(':taskId/rating')
  submitRating(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    const input = reviewRatingRequestSchema.parse(body);
    return this.reviewTasksService.submitRating(user.id, taskId, input);
  }

  @Post(':taskId/skip')
  skip(@CurrentUser() user: AuthenticatedUser, @Param('taskId') taskId: string) {
    return this.reviewTasksService.skip(user.id, taskId);
  }

  @Post(':taskId/reopen')
  reopen(@CurrentUser() user: AuthenticatedUser, @Param('taskId') taskId: string) {
    return this.reviewTasksService.reopen(user.id, taskId);
  }
}
```

- [ ] **Step 3: Create service**

Create `apps/server/src/review-tasks/review-tasks.service.ts` with these public methods and helpers:

```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { scheduleReview } from '@repo/fsrs';
import type { ReviewRatingRequest } from '@repo/types/api/review';
import type {
  ReviewTaskListQuery,
  ReviewTaskTodayQuery,
} from '@repo/types/api/review-task';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReviewTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async getToday(userId: string, input: ReviewTaskTodayQuery) {
    const window = this.resolveTaskDateWindow(input);
    await this.ensureTasksForDate(userId, window);

    const statusFilter = input.includeCompleted
      ? undefined
      : { not: 'COMPLETED' as const };

    const tasks = await this.prisma.reviewTask.findMany({
      where: {
        userId,
        scheduledDate: window.date,
        status: statusFilter,
      },
      include: { card: { include: { wrongQuestion: true } } },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      date: window.date,
      pendingCount: tasks.filter((task) => task.status === 'PENDING').length,
      completedCount: tasks.filter((task) => task.status === 'COMPLETED').length,
      skippedCount: tasks.filter((task) => task.status === 'SKIPPED').length,
      tasks: tasks.map((task) => this.toTaskItemResponse(task)),
    };
  }

  async list(userId: string, input: ReviewTaskListQuery) {
    const skip = (input.page - 1) * input.pageSize;
    const where = {
      userId,
      scheduledDate: input.date,
      status: input.status,
    } satisfies Prisma.ReviewTaskWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.reviewTask.findMany({
        where,
        include: { card: { include: { wrongQuestion: true } } },
        orderBy: [{ scheduledDate: 'desc' }, { dueAt: 'asc' }],
        skip,
        take: input.pageSize,
      }),
      this.prisma.reviewTask.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toTaskItemResponse(item)),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async submitRating(userId: string, taskId: string, input: ReviewRatingRequest) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.reviewTask.findFirst({
        where: { id: taskId, userId },
        include: { card: { include: { wrongQuestion: true } } },
      });
      if (!task) throw this.taskNotFound();
      if (task.status === 'COMPLETED') throw this.taskAlreadyCompleted();
      if (task.status !== 'PENDING') throw this.taskNotPending();

      const reviewedAt = input.reviewedAt ? new Date(input.reviewedAt) : new Date();
      const scheduled = scheduleReview({
        card: {
          difficulty: task.card.difficulty,
          stability: task.card.stability,
          retrievability: task.card.retrievability,
          lastReview: task.card.lastReview,
          nextReview: task.card.nextReview,
          reviewCount: task.card.reviewCount,
          lapses: task.card.lapses,
          state: task.card.state,
        },
        rating: input.rating,
        reviewedAt,
      });

      const updatedCard = await tx.card.update({
        where: { id: task.cardId },
        data: {
          difficulty: scheduled.card.difficulty,
          stability: scheduled.card.stability,
          retrievability: scheduled.card.retrievability,
          lastReview: scheduled.card.lastReview,
          nextReview: scheduled.card.nextReview,
          reviewCount: scheduled.card.reviewCount,
          lapses: scheduled.card.lapses,
          state: scheduled.card.state,
        },
      });
      const log = await tx.reviewLog.create({
        data: {
          cardId: task.cardId,
          rating: input.rating,
          scheduledDays: scheduled.log.scheduledDays,
          elapsedDays: scheduled.log.elapsedDays,
          reviewDurationMs: input.reviewDurationMs,
          stabilityBefore: scheduled.log.stabilityBefore,
          stabilityAfter: scheduled.log.stabilityAfter,
          difficultyBefore: scheduled.log.difficultyBefore,
          difficultyAfter: scheduled.log.difficultyAfter,
          reviewedAt,
        },
      });
      const completedTask = await tx.reviewTask.update({
        where: { id: task.id },
        data: {
          status: 'COMPLETED',
          reviewLogId: log.id,
          completedAt: reviewedAt,
          skippedAt: null,
        },
        include: { card: { include: { wrongQuestion: true } } },
      });

      return {
        task: this.toTaskItemResponse(completedTask),
        card: this.toCardResponse(updatedCard),
        log: this.toLogResponse(log),
      };
    });
  }

  async skip(userId: string, taskId: string, skippedAt = new Date()) {
    const task = await this.findOwnedTask(userId, taskId);
    if (task.status === 'COMPLETED') throw this.taskAlreadyCompleted();
    if (task.status !== 'PENDING') throw this.taskNotPending();

    const updated = await this.prisma.reviewTask.update({
      where: { id: task.id },
      data: { status: 'SKIPPED', skippedAt },
      include: { card: { include: { wrongQuestion: true } } },
    });

    return { task: this.toTaskItemResponse(updated) };
  }

  async reopen(userId: string, taskId: string) {
    const task = await this.findOwnedTask(userId, taskId);
    if (task.status !== 'SKIPPED') throw this.taskNotSkipped();

    const updated = await this.prisma.reviewTask.update({
      where: { id: task.id },
      data: { status: 'PENDING', skippedAt: null },
      include: { card: { include: { wrongQuestion: true } } },
    });

    return { task: this.toTaskItemResponse(updated) };
  }

  private async ensureTasksForDate(userId: string, window: ReviewTaskDateWindow) {
    const dueCards = await this.prisma.card.findMany({
      where: {
        userId,
        suspendedAt: null,
        nextReview: { lte: window.endUtc },
      },
      select: { id: true, nextReview: true },
      orderBy: [{ nextReview: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    });

    if (dueCards.length === 0) return;

    await this.prisma.reviewTask.createMany({
      data: dueCards.map((card) => ({
        userId,
        cardId: card.id,
        scheduledDate: window.date,
        dueAt: card.nextReview,
        status: 'PENDING',
        source: 'FSRS',
      })),
      skipDuplicates: true,
    });
  }

  private async findOwnedTask(userId: string, taskId: string) {
    const task = await this.prisma.reviewTask.findFirst({
      where: { id: taskId, userId },
      include: { card: { include: { wrongQuestion: true } } },
    });
    if (!task) throw this.taskNotFound();
    return task;
  }

  private resolveTaskDateWindow(input: ReviewTaskTodayQuery): ReviewTaskDateWindow {
    const date = input.date ?? new Date().toISOString().slice(0, 10);
    const startLocal = new Date(`${date}T00:00:00.000Z`);
    const endLocal = new Date(`${date}T00:00:00.000Z`);
    endLocal.setUTCDate(endLocal.getUTCDate() + 1);
    endLocal.setUTCMilliseconds(endLocal.getUTCMilliseconds() - 1);
    const offsetMs = input.timezoneOffsetMinutes * 60 * 1000;

    return {
      date,
      startUtc: new Date(startLocal.getTime() + offsetMs),
      endUtc: new Date(endLocal.getTime() + offsetMs),
    };
  }

  private toTaskItemResponse(task: ReviewTaskRecord) {
    return {
      id: task.id,
      userId: task.userId,
      cardId: task.cardId,
      reviewLogId: task.reviewLogId,
      scheduledDate: task.scheduledDate,
      dueAt: task.dueAt.toISOString(),
      status: task.status,
      source: task.source,
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      skippedAt: task.skippedAt ? task.skippedAt.toISOString() : null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      card: {
        id: task.card.id,
        state: task.card.state,
        reviewCount: task.card.reviewCount,
        lapses: task.card.lapses,
        nextReview: task.card.nextReview.toISOString(),
      },
      wrongQuestion: task.card.wrongQuestion
        ? {
            id: task.card.wrongQuestion.id,
            questionText: task.card.wrongQuestion.questionText,
            subject: task.card.wrongQuestion.subject,
            knowledgePoints: task.card.wrongQuestion.knowledgePoints,
            answer: task.card.wrongQuestion.answer,
            analysis: task.card.wrongQuestion.analysis,
            imageUrl: task.card.wrongQuestion.imageUrl,
            status: task.card.wrongQuestion.status,
          }
        : undefined,
    };
  }

  private toCardResponse(card: CardRecord) {
    return {
      id: card.id,
      userId: card.userId,
      questionId: card.questionId,
      wrongQuestionId: card.wrongQuestionId,
      difficulty: card.difficulty,
      stability: card.stability,
      retrievability: card.retrievability,
      lastReview: card.lastReview ? card.lastReview.toISOString() : null,
      nextReview: card.nextReview.toISOString(),
      reviewCount: card.reviewCount,
      lapses: card.lapses,
      state: card.state,
      suspendedAt: card.suspendedAt ? card.suspendedAt.toISOString() : null,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    };
  }

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
    };
  }

  private taskNotFound() {
    return new AppError('REVIEW_TASK_NOT_FOUND', '复习任务不存在或无权访问', HttpStatus.NOT_FOUND);
  }

  private taskAlreadyCompleted() {
    return new AppError('REVIEW_TASK_ALREADY_COMPLETED', '这条复习任务已经完成', HttpStatus.CONFLICT);
  }

  private taskNotPending() {
    return new AppError('REVIEW_TASK_NOT_PENDING', '这条复习任务当前不能评分或跳过', HttpStatus.CONFLICT);
  }

  private taskNotSkipped() {
    return new AppError('REVIEW_TASK_NOT_SKIPPED', '只有已跳过任务可以恢复', HttpStatus.CONFLICT);
  }
}

type ReviewTaskDateWindow = {
  date: string;
  startUtc: Date;
  endUtc: Date;
};

type ReviewTaskRecord = Prisma.ReviewTaskGetPayload<{
  include: { card: { include: { wrongQuestion: true } } };
}>;

type CardRecord = Prisma.CardGetPayload<object>;
type ReviewLogRecord = Prisma.ReviewLogGetPayload<object>;
```

- [ ] **Step 4: Register module**

In `apps/server/src/app.module.ts`, import and add module:

```ts
import { ReviewTasksModule } from './review-tasks/review-tasks.module';
```

Add `ReviewTasksModule` after `ReviewsModule` in `imports`.

- [ ] **Step 5: Run backend unit tests**

Run:

```powershell
bun --filter @repo/server test -- review-tasks.service.spec.ts
bun --filter @repo/server lint
bun --filter @repo/server build
```

Expected: all exit 0.

- [ ] **Step 6: Commit backend module**

```powershell
git add apps/server/src/review-tasks apps/server/src/app.module.ts
git commit -m "feat: add review task api"
```

---

## Task 5: Add ReviewTask E2E Coverage

**Files:**
- Create: `apps/server/test/review-tasks.e2e-spec.ts`

- [ ] **Step 1: Create e2e test**

Create `apps/server/test/review-tasks.e2e-spec.ts` by following the setup style in `apps/server/test/reviews.e2e-spec.ts`. Include this core test:

```ts
it('generates, rates, skips, and reopens review tasks for the current user only', async () => {
  const userA = await registerUser('review-task-a');
  const userB = await registerUser('review-task-b');
  const firstWrong = await createWrongQuestion(userA.accessToken, 'Compute 2 + 2.');
  const firstCard = await createReviewCard(userA.accessToken, firstWrong.id);

  const today = await request(server)
    .get('/review-tasks/today?date=2026-06-14&timezoneOffsetMinutes=-480')
    .set('Authorization', `Bearer ${userA.accessToken}`)
    .expect(200);
  const todayData = getSuccessData<ReviewTaskTodayResponse>(today);
  expect(todayData.pendingCount).toBe(1);
  expect(todayData.tasks[0]?.cardId).toBe(firstCard.id);

  const duplicateToday = await request(server)
    .get('/review-tasks/today?date=2026-06-14&timezoneOffsetMinutes=-480')
    .set('Authorization', `Bearer ${userA.accessToken}`)
    .expect(200);
  expect(getSuccessData<ReviewTaskTodayResponse>(duplicateToday).tasks).toHaveLength(1);

  const rating = await request(server)
    .post(`/review-tasks/${todayData.tasks[0]!.id}/rating`)
    .set('Authorization', `Bearer ${userA.accessToken}`)
    .send({
      rating: 3,
      reviewedAt: '2026-06-14T08:00:00.000Z',
      reviewDurationMs: 12000,
    })
    .expect(201);
  const rated = getSuccessData<ReviewTaskRatingResponse>(rating);
  expect(rated.task.status).toBe('COMPLETED');
  expect(rated.task.reviewLogId).toEqual(expect.any(String));

  const secondWrong = await createWrongQuestion(userA.accessToken, 'Compute 3 + 3.');
  await createReviewCard(userA.accessToken, secondWrong.id);
  const withSecond = await request(server)
    .get('/review-tasks/today?date=2026-06-14&timezoneOffsetMinutes=-480')
    .set('Authorization', `Bearer ${userA.accessToken}`)
    .expect(200);
  const pendingTask = getSuccessData<ReviewTaskTodayResponse>(withSecond).tasks.find(
    (task) => task.status === 'PENDING',
  );
  expect(pendingTask).toBeDefined();

  const skipped = await request(server)
    .post(`/review-tasks/${pendingTask!.id}/skip`)
    .set('Authorization', `Bearer ${userA.accessToken}`)
    .expect(201);
  expect(getSuccessData<ReviewTaskActionResponse>(skipped).task.status).toBe('SKIPPED');

  const reopened = await request(server)
    .post(`/review-tasks/${pendingTask!.id}/reopen`)
    .set('Authorization', `Bearer ${userA.accessToken}`)
    .expect(201);
  expect(getSuccessData<ReviewTaskActionResponse>(reopened).task.status).toBe('PENDING');

  const otherToday = await request(server)
    .get('/review-tasks/today?date=2026-06-14&timezoneOffsetMinutes=-480')
    .set('Authorization', `Bearer ${userB.accessToken}`)
    .expect(200);
  expect(getSuccessData<ReviewTaskTodayResponse>(otherToday).tasks).toHaveLength(0);
});
```

Use local helper types imported from `@repo/types/api/review-task`, plus small local `AuthResponse`, `WrongQuestionResponse`, and `CreateReviewCardResponse` aliases.

- [ ] **Step 2: Run e2e**

Run:

```powershell
bun --filter @repo/server test:e2e -- --runInBand review-tasks.e2e-spec.ts
bun --filter @repo/server test:e2e -- --runInBand
```

Expected: both exit 0.

- [ ] **Step 3: Commit e2e coverage**

```powershell
git add apps/server/test/review-tasks.e2e-spec.ts
git commit -m "test: cover review task api"
```

---

## Task 6: Add Frontend ReviewTask API, Hooks, and View Helpers

**Files:**
- Create: `apps/web/src/lib/review-task-api.ts`
- Create: `apps/web/src/lib/review-task-api.test.mts`
- Create: `apps/web/src/hooks/use-review-tasks.ts`
- Create: `apps/web/src/lib/review-task-view.ts`
- Create: `apps/web/src/lib/review-task-view.test.mts`

- [ ] **Step 1: Add failing API tests**

Create `apps/web/src/lib/review-task-api.test.mts` with tests for:

```ts
await api.getToday('token_1', {
  date: '2026-06-14',
  timezoneOffsetMinutes: -480,
  includeCompleted: true,
});
// Expected path:
// http://localhost:3001/review-tasks/today?date=2026-06-14&timezoneOffsetMinutes=-480&includeCompleted=true

await api.submitRating('token_1', 'task_1', { rating: 3 });
// Expected path:
// http://localhost:3001/review-tasks/task_1/rating

await api.skip('token_1', 'task_1');
// Expected path:
// http://localhost:3001/review-tasks/task_1/skip

await api.reopen('token_1', 'task_1');
// Expected path:
// http://localhost:3001/review-tasks/task_1/reopen
```

Use `createApiClient` test helper style from `apps/web/src/lib/review-api.test.mts`, and response payloads parsed by `reviewTaskTodayResponseSchema`, `reviewTaskRatingResponseSchema`, and `reviewTaskActionResponseSchema`.

- [ ] **Step 2: Run API tests and verify they fail**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-task-api.test.mts
```

Expected: FAIL because `review-task-api.ts` does not exist.

- [ ] **Step 3: Implement frontend API client**

Create `apps/web/src/lib/review-task-api.ts`:

```ts
import { reviewRatingResponseSchema, type ReviewRatingRequest } from '@repo/types/api/review';
import {
  reviewTaskActionResponseSchema,
  reviewTaskListResponseSchema,
  reviewTaskRatingResponseSchema,
  reviewTaskTodayResponseSchema,
  type ReviewTaskListQuery,
  type ReviewTaskTodayQuery,
} from '@repo/types/api/review-task';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
  post: <T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null },
  ) => Promise<T>;
};

export function createReviewTaskApi(client: ApiClient) {
  return {
    async getToday(accessToken: string, query: ReviewTaskTodayQuery) {
      const params = new URLSearchParams();
      if (query.date) params.set('date', query.date);
      params.set('timezoneOffsetMinutes', String(query.timezoneOffsetMinutes));
      params.set('includeCompleted', String(query.includeCompleted));
      return reviewTaskTodayResponseSchema.parse(
        await client.get<unknown>(`/review-tasks/today?${params.toString()}`, { accessToken }),
      );
    },

    async list(accessToken: string, query: ReviewTaskListQuery) {
      const params = new URLSearchParams();
      params.set('page', String(query.page));
      params.set('pageSize', String(query.pageSize));
      if (query.date) params.set('date', query.date);
      if (query.status) params.set('status', query.status);
      return reviewTaskListResponseSchema.parse(
        await client.get<unknown>(`/review-tasks?${params.toString()}`, { accessToken }),
      );
    },

    async submitRating(accessToken: string, taskId: string, request: ReviewRatingRequest) {
      return reviewTaskRatingResponseSchema.parse(
        await client.post<unknown>(`/review-tasks/${taskId}/rating`, request, { accessToken }),
      );
    },

    async skip(accessToken: string, taskId: string) {
      return reviewTaskActionResponseSchema.parse(
        await client.post<unknown>(`/review-tasks/${taskId}/skip`, undefined, { accessToken }),
      );
    },

    async reopen(accessToken: string, taskId: string) {
      return reviewTaskActionResponseSchema.parse(
        await client.post<unknown>(`/review-tasks/${taskId}/reopen`, undefined, { accessToken }),
      );
    },
  };
}
```

Remove the unused `reviewRatingResponseSchema` import if lint flags it.

- [ ] **Step 4: Add hooks**

Create `apps/web/src/hooks/use-review-tasks.ts`:

```ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReviewRatingRequest } from '@repo/types/api/review';
import type {
  ReviewTaskListQuery,
  ReviewTaskTodayQuery,
} from '@repo/types/api/review-task';

import { apiClient } from '@/lib/api-client';
import { createReviewTaskApi } from '@/lib/review-task-api';
import { useUserStore } from '@/stores/userStore';
import { reviewQueryKeys } from './use-reviews';

const reviewTaskApi = createReviewTaskApi(apiClient);

export const reviewTaskQueryKeys = {
  all: ['review-tasks'] as const,
  today: (query: ReviewTaskTodayQuery) => [...reviewTaskQueryKeys.all, 'today', query] as const,
  list: (query: ReviewTaskListQuery) => [...reviewTaskQueryKeys.all, 'list', query] as const,
};

export function useTodayReviewTaskList(query: ReviewTaskTodayQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewTaskQueryKeys.today(query),
    queryFn: async () => {
      if (!accessToken) throw new Error('Missing access token');
      return reviewTaskApi.getToday(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useReviewTaskList(query: ReviewTaskListQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewTaskQueryKeys.list(query),
    queryFn: async () => {
      if (!accessToken) throw new Error('Missing access token');
      return reviewTaskApi.list(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useSubmitReviewTaskRating() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({ taskId, request }: { taskId: string; request: ReviewRatingRequest }) => {
      if (!accessToken) throw new Error('Missing access token');
      return reviewTaskApi.submitRating(accessToken, taskId, request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewTaskQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all });
    },
  });
}

export function useSkipReviewTask() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!accessToken) throw new Error('Missing access token');
      return reviewTaskApi.skip(accessToken, taskId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewTaskQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all });
    },
  });
}

export function useReopenReviewTask() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!accessToken) throw new Error('Missing access token');
      return reviewTaskApi.reopen(accessToken, taskId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewTaskQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all });
    },
  });
}
```

- [ ] **Step 5: Add view helper tests**

Create `apps/web/src/lib/review-task-view.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getReviewTaskStatusFeedback,
  groupReviewTasksByStatus,
} from './review-task-view.ts';

test('groups review tasks by status', () => {
  const result = groupReviewTasksByStatus([
    { id: 'a', status: 'PENDING' },
    { id: 'b', status: 'COMPLETED' },
    { id: 'c', status: 'SKIPPED' },
  ]);

  assert.equal(result.pending[0]?.id, 'a');
  assert.equal(result.completed[0]?.id, 'b');
  assert.equal(result.skipped[0]?.id, 'c');
});

test('returns feedback for skip and reopen actions', () => {
  assert.equal(getReviewTaskStatusFeedback('skip').message, '已跳过这张复习卡');
  assert.equal(getReviewTaskStatusFeedback('reopen').message, '已恢复到待复习');
});
```

- [ ] **Step 6: Implement view helpers**

Create `apps/web/src/lib/review-task-view.ts`:

```ts
import type { ReviewTaskItemResponse } from '@repo/types/api/review-task';

type MinimalTask = Pick<ReviewTaskItemResponse, 'status'> & { id: string };

export function groupReviewTasksByStatus<T extends MinimalTask>(tasks: T[]) {
  return {
    pending: tasks.filter((task) => task.status === 'PENDING'),
    completed: tasks.filter((task) => task.status === 'COMPLETED'),
    skipped: tasks.filter((task) => task.status === 'SKIPPED'),
  };
}

export function getReviewTaskStatusFeedback(action: 'skip' | 'reopen') {
  if (action === 'skip') {
    return {
      message: '已跳过这张复习卡',
      tone: 'neutral' as const,
    };
  }

  return {
    message: '已恢复到待复习',
    tone: 'success' as const,
  };
}
```

- [ ] **Step 7: Run frontend API/helper tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-task-api.test.mts
node --experimental-strip-types apps/web/src/lib/review-task-view.test.mts
bun --filter @repo/web lint
```

Expected: all exit 0.

- [ ] **Step 8: Commit frontend plumbing**

```powershell
git add apps/web/src/lib/review-task-api.ts apps/web/src/lib/review-task-api.test.mts apps/web/src/hooks/use-review-tasks.ts apps/web/src/lib/review-task-view.ts apps/web/src/lib/review-task-view.test.mts
git commit -m "feat: add review task frontend hooks"
```

---

## Task 7: Migrate Today Page to ReviewTask Flow

**Files:**
- Modify: `apps/web/src/app/(main)/today/page.tsx`

- [ ] **Step 1: Update imports**

Replace:

```ts
import type { ReviewRating, ReviewTaskResponse } from '@repo/types/api/review';
```

with:

```ts
import type { ReviewRating } from '@repo/types/api/review';
import type { ReviewTaskItemResponse } from '@repo/types/api/review-task';
```

Replace:

```ts
import { useSubmitReviewRating, useTodayReviewTasks } from '@/hooks/use-reviews';
```

with:

```ts
import {
  useReopenReviewTask,
  useSkipReviewTask,
  useSubmitReviewTaskRating,
  useTodayReviewTaskList,
} from '@/hooks/use-review-tasks';
```

Add:

```ts
import {
  getReviewTaskStatusFeedback,
  groupReviewTasksByStatus,
} from '@/lib/review-task-view';
```

- [ ] **Step 2: Replace task query and mutations**

Inside `TodayPage`, replace:

```ts
const todayReviewTasks = useTodayReviewTasks(dateKey);
const submitReviewRating = useSubmitReviewRating();
```

with:

```ts
const timezoneOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);
const todayReviewTasks = useTodayReviewTaskList({
  date: dateKey,
  timezoneOffsetMinutes,
  includeCompleted: true,
});
const groupedReviewTasks = groupReviewTasksByStatus(todayReviewTasks.data?.tasks ?? []);
const submitReviewRating = useSubmitReviewTaskRating();
const skipReviewTask = useSkipReviewTask();
const reopenReviewTask = useReopenReviewTask();
```

- [ ] **Step 3: Change revealed/feedback state keys to task id**

Keep state names but make them task based:

```ts
const [revealedTaskIds, setRevealedTaskIds] = useState<Set<string>>(new Set());
const [reviewFeedbacks, setReviewFeedbacks] = useState<Record<string, ReviewRatingFeedback>>({});
```

Update `toggleAnswer(taskId)` to use `revealedTaskIds`.

- [ ] **Step 4: Update rating handler**

Replace `rateCard(cardId, rating)` with:

```ts
const rateTask = useCallback(
  async (taskId: string, rating: ReviewRating) => {
    try {
      const result = await submitReviewRating.mutateAsync({
        taskId,
        request: {
          rating,
          reviewedAt: new Date().toISOString(),
        },
      });
      const feedback = buildReviewRatingFeedback({
        rating,
        nextReview: result.card.nextReview,
      });
      setReviewFeedbacks((prev) => ({
        ...prev,
        [taskId]: feedback,
      }));
      setRevealedTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      showNotice(`${feedback.title}，${feedback.description}`);
    } catch (error) {
      showNotice(getMutationErrorMessage(error), 'neutral');
    }
  },
  [showNotice, submitReviewRating],
);
```

- [ ] **Step 5: Add skip and reopen handlers**

Add:

```ts
const skipTask = useCallback(
  async (taskId: string) => {
    try {
      await skipReviewTask.mutateAsync(taskId);
      const feedback = getReviewTaskStatusFeedback('skip');
      showNotice(feedback.message, feedback.tone);
    } catch (error) {
      showNotice(getMutationErrorMessage(error), 'neutral');
    }
  },
  [showNotice, skipReviewTask],
);

const reopenTask = useCallback(
  async (taskId: string) => {
    try {
      await reopenReviewTask.mutateAsync(taskId);
      const feedback = getReviewTaskStatusFeedback('reopen');
      showNotice(feedback.message, feedback.tone);
    } catch (error) {
      showNotice(getMutationErrorMessage(error), 'neutral');
    }
  },
  [reopenReviewTask, showNotice],
);
```

- [ ] **Step 6: Update mini stats**

Replace:

```tsx
<MiniStat label="待复习" value={`${todayReviewTasks.data?.dueCount ?? 0} 张`} />
<MiniStat label="新卡" value={`${todayReviewTasks.data?.newCount ?? 0} 张`} />
<MiniStat label="复习卡" value={`${todayReviewTasks.data?.reviewCount ?? 0} 张`} />
```

with:

```tsx
<MiniStat label="待复习" value={`${todayReviewTasks.data?.pendingCount ?? 0} 张`} />
<MiniStat label="已完成" value={`${todayReviewTasks.data?.completedCount ?? 0} 张`} />
<MiniStat label="已跳过" value={`${todayReviewTasks.data?.skippedCount ?? 0} 张`} />
```

- [ ] **Step 7: Render pending, completed, and skipped sections**

In the review section, render:

```tsx
{todayReviewTasks.isLoading ? (
  <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-3 text-sm text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
    <Loader2 className="h-4 w-4 animate-spin" />
    正在读取复习卡...
  </div>
) : todayReviewTasks.isError ? (
  <p className="rounded-2xl bg-red-50/80 px-3 py-3 text-sm text-red-600 ring-1 ring-red-100">
    复习任务读取失败，稍后再试。
  </p>
) : groupedReviewTasks.pending.length ? (
  groupedReviewTasks.pending.map((task) => (
    <ReviewTaskCard
      key={task.id}
      task={task}
      revealed={revealedTaskIds.has(task.id)}
      feedback={reviewFeedbacks[task.id] ?? null}
      ratingPending={submitReviewRating.isPending}
      actionPending={skipReviewTask.isPending || reopenReviewTask.isPending}
      onToggleAnswer={() => toggleAnswer(task.id)}
      onRate={(rating) => void rateTask(task.id, rating)}
      onSkip={() => void skipTask(task.id)}
    />
  ))
) : (
  <p className="rounded-2xl bg-white/70 px-3 py-3 text-sm leading-6 text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
    今天没有待复习卡。可以从错题详情里把重要题目加入复习计划。
  </p>
)}

{groupedReviewTasks.completed.length ? (
  <ReviewTaskSummary title="今日已完成" tasks={groupedReviewTasks.completed} />
) : null}

{groupedReviewTasks.skipped.length ? (
  <ReviewTaskSummary
    title="已跳过"
    tasks={groupedReviewTasks.skipped}
    actionLabel="恢复"
    actionPending={reopenReviewTask.isPending}
    onAction={(taskId) => void reopenTask(taskId)}
  />
) : null}
```

- [ ] **Step 8: Update `ReviewTaskCard` props**

Change prop type from `ReviewTaskResponse` to `ReviewTaskItemResponse` and add:

```ts
actionPending: boolean;
onSkip: () => void;
```

Use task card fields through `task.card`:

```tsx
{task.card.state}
```

Add skip button under the answer toggle button:

```tsx
<button
  type="button"
  disabled={actionPending || ratingPending}
  onClick={onSkip}
  className="tap-target mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl bg-white/65 text-sm font-semibold text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-[0.98] disabled:opacity-60"
>
  <RotateCcw className="h-4 w-4" />
  今天先跳过
</button>
```

- [ ] **Step 9: Add summary component**

Add below `ReviewTaskCard`:

```tsx
function ReviewTaskSummary({
  title,
  tasks,
  actionLabel,
  actionPending,
  onAction,
}: {
  title: string;
  tasks: ReviewTaskItemResponse[];
  actionLabel?: string;
  actionPending?: boolean;
  onAction?: (taskId: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-white/55 p-3 ring-1 ring-[var(--pm-line)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-[var(--pm-muted)]">{title}</p>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-[var(--pm-muted)]">
          {tasks.length} 张
        </span>
      </div>
      <div className="mt-2 space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-2 rounded-xl bg-white/65 px-2 py-2">
            <p className="min-w-0 flex-1 truncate text-xs font-semibold">
              {task.wrongQuestion?.questionText ?? '复习卡'}
            </p>
            {actionLabel && onAction ? (
              <button
                type="button"
                disabled={actionPending}
                onClick={() => onAction(task.id)}
                className="tap-target min-h-8 rounded-xl px-2 text-xs font-bold text-[#247269] transition-all hover:bg-[#eafff9] disabled:opacity-60"
              >
                {actionLabel}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Run frontend verification**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-task-view.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all exit 0.

- [ ] **Step 11: Commit today page migration**

```powershell
git add "apps/web/src/app/(main)/today/page.tsx"
git commit -m "feat: use persisted review tasks in today page"
```

---

## Task 8: Browser Verification

**Files:**
- No source files unless verification finds a defect.

- [ ] **Step 1: Start infrastructure and apply migrations**

Run:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --cwd packages/database prisma migrate deploy
bun run db:generate
```

Expected: infrastructure running, migrations applied, Prisma client generated.

- [ ] **Step 2: Start dev servers**

Run backend:

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
bun --filter @repo/server start:dev
```

Run frontend:

```powershell
bun --filter @repo/web dev
```

Expected: backend on `3001`, frontend on `3000`.

- [ ] **Step 3: Verify task lifecycle in browser**

Use Playwright or manual browser:

1. Register `codex-review-task-smoke-YYYYMMDD@example.com`.
2. Create a wrong question through API.
3. Add it to review plan through `/reviews/cards/from-wrong-question`.
4. Open `/today`.
5. Confirm a `PENDING` review task appears.
6. Reveal answer and submit `掌握`.
7. Confirm task moves out of pending and appears in completed summary.
8. Create a second wrong question and review card.
9. Refresh `/today`, skip the second task, then reopen it.
10. Open `/stats`, confirm review count includes the completed task rating.
11. Confirm browser console has no new app errors.

- [ ] **Step 4: Clean smoke account**

Run from `packages/database`:

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun -e "import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); const email='codex-review-task-smoke-YYYYMMDD@example.com'; const user = await prisma.user.findUnique({ where: { email } }); if (user) await prisma.user.delete({ where: { id: user.id } }); await prisma.`$disconnect();"
```

Expected: smoke user removed and cascade deletes related cards, logs, and tasks.

---

## Task 9: Update Project Documents After Verification

**Files:**
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Update data-flow**

In `docs/data-flow.md`, update FSRS section:

```md
- Phase 4.3 新增 `ReviewTask` 持久化任务层。
- 今日任务页复习卡来源迁移到 `/review-tasks/today`。
- `/review-tasks/today` 会按用户本地日期懒生成当天到期任务，同一 `cardId + scheduledDate` 不重复创建。
- `/review-tasks/:taskId/rating` 在事务内更新 Card、写入 ReviewLog、完成 ReviewTask。
- 跳过与恢复只改变 ReviewTask 状态，不更新 Card，也不写 ReviewLog。
- `/stats` 仍以 ReviewLog 为复习事实来源，不改为基于 ReviewTask 统计。
```

- [ ] **Step 2: Update roadmap and agent docs**

In `docs/roadmap.md`, `AGENTS.md`, and `CLAUDE.md`, mark Phase 4.3 completed:

```md
- Phase 4.3：ReviewTask 持久化任务流、今日任务迁移、评分完成、跳过和恢复已完成。
```

Keep Phase 4 overall as ongoing because offline rating queue and reminder strategy remain.

- [ ] **Step 3: Update DEVLOG**

Add under `2026-06-14`:

```md
**Phase 4.3 ReviewTask 数据流**

- 新增 `ReviewTask` 持久化任务层和 Prisma migration。
- 新增 `/review-tasks/today`、列表、评分、跳过和恢复 API。
- 今日任务页复习卡迁移到 persisted ReviewTask 数据流。
- 评分会完成任务并关联 ReviewLog；跳过和恢复只改变任务状态。
- `/stats` 继续以 ReviewLog 为统计事实来源。

验证：

- `node --experimental-strip-types packages/types/tests/review-task.test.mts` 通过。
- `bun --cwd packages/types typecheck` 通过。
- `bun --cwd packages/database test` 通过。
- `bun --filter @repo/server test` 通过。
- `bun --filter @repo/server test:e2e -- --runInBand` 通过。
- `node --experimental-strip-types apps/web/src/lib/review-task-api.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/review-task-view.test.mts` 通过。
- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过。
- 浏览器 ReviewTask 生命周期验收通过。
```

Update bottom checklist:

```md
- [x] 更完整的 ReviewTask 数据流。
- [ ] 离线评分队列与提醒策略。
```

- [ ] **Step 4: Run final verification**

Run:

```powershell
node --experimental-strip-types packages/types/tests/review-task.test.mts
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --filter @repo/server test
bun --filter @repo/server test:e2e -- --runInBand
node --experimental-strip-types apps/web/src/lib/review-task-api.test.mts
node --experimental-strip-types apps/web/src/lib/review-task-view.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
git diff --check
```

Expected: all exit 0. Node `MODULE_TYPELESS_PACKAGE_JSON` warnings are acceptable if exit code is 0.

- [ ] **Step 5: Commit docs**

```powershell
git add docs/data-flow.md docs/roadmap.md AGENTS.md CLAUDE.md DEVLOG.md
git commit -m "docs: record phase 4.3 review task flow"
```

---

## Final Acceptance Checklist

- [ ] Prisma has `ReviewTask`, `ReviewTaskStatus`, and `ReviewTaskSource`.
- [ ] `@repo/types/api/review-task` exports schemas and types.
- [ ] `ReviewTasksModule` is registered in `AppModule`.
- [ ] `GET /review-tasks/today` lazily and idempotently creates due tasks.
- [ ] `GET /review-tasks` supports pagination and status/date filters.
- [ ] `POST /review-tasks/:taskId/rating` updates Card, creates ReviewLog, and completes ReviewTask in one transaction.
- [ ] `POST /review-tasks/:taskId/skip` marks pending task skipped without writing ReviewLog.
- [ ] `POST /review-tasks/:taskId/reopen` restores skipped task to pending.
- [ ] Today page reads persisted ReviewTask data instead of `/reviews/tasks/today`.
- [ ] Today page shows pending, completed, and skipped review task states with clear feedback.
- [ ] `/stats` still works from ReviewLog after task rating.
- [ ] Smoke test account is removed after browser verification.
- [ ] All automated verification commands in Task 9 pass.
