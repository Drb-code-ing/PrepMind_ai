# Phase 4.2 Review Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent `/stats` learning statistics page backed by server-side Review stats/logs APIs.

**Architecture:** Keep `Card` and `ReviewLog` as the source of truth in PostgreSQL. Add shared Zod contracts in `@repo/types`, aggregate statistics in NestJS `ReviewsService`, expose them through guarded `/reviews/stats` and `/reviews/logs` endpoints, then render a mobile-first stats notebook page in Next.js using TanStack Query.

**Tech Stack:** Next.js 16, React 19, TypeScript, TanStack Query, NestJS 11, Prisma, PostgreSQL, Zod, Bun.

---

## File Structure

- `packages/types/src/api/review.ts`
  - Add query/response schemas and TypeScript types for review stats and review log list.
- `packages/types/tests/review.test.mts`
  - Add runtime schema tests for stats and logs payloads.
- `apps/server/src/reviews/reviews.controller.ts`
  - Add `GET /reviews/stats` and `GET /reviews/logs` endpoints.
- `apps/server/src/reviews/reviews.service.ts`
  - Add `getStats`, `getLogs`, date-window helpers, bucket helpers, and response mappers.
- `apps/server/src/reviews/reviews.service.spec.ts`
  - Add unit tests for stats aggregation and recent logs mapping.
- `apps/server/test/reviews.e2e-spec.ts`
  - Create e2e coverage for stats/logs and user isolation.
- `apps/web/src/lib/review-api.ts`
  - Add `getStats` and `getLogs`.
- `apps/web/src/lib/review-api.test.mts`
  - Add request path/schema tests.
- `apps/web/src/hooks/use-reviews.ts`
  - Add `useReviewStats` and `useReviewLogs`.
- `apps/web/src/lib/review-stats-view.ts`
  - Add pure display helpers for percentages, labels, date buckets, and rating text.
- `apps/web/src/lib/review-stats-view.test.mts`
  - Add helper tests for chart ratios and empty-state logic.
- `apps/web/src/app/(main)/stats/page.tsx`
  - New mobile-first stats page.
- `apps/web/src/components/chat/chat-sidebar.tsx`
  - Add sidebar navigation item for stats.
- `apps/web/src/app/(main)/today/page.tsx`
  - Add bottom shortcut link to stats.
- `docs/data-flow.md`, `docs/roadmap.md`, `AGENTS.md`, `CLAUDE.md`, `DEVLOG.md`
  - Update only after implementation verification passes.

---

## Task 1: Add Shared Review Stats Contracts

**Files:**
- Modify: `packages/types/src/api/review.ts`
- Modify: `packages/types/tests/review.test.mts`

- [ ] **Step 1: Add failing type contract tests**

Extend the existing import from `../src/api/review.ts` in `packages/types/tests/review.test.mts`:

```ts
import {
  reviewLogListResponseSchema,
  reviewStatsQuerySchema,
  reviewStatsResponseSchema,
} from '../src/api/review.ts';
```

Add calls inside `run()`:

```ts
  testStatsQuery();
  testStatsResponse();
  testReviewLogListResponse();
```

Append the tests:

```ts
function testStatsQuery() {
  const result = reviewStatsQuerySchema.parse({
    range: '30d',
    endDate: '2026-06-14',
    timezoneOffsetMinutes: -480,
  });

  assert.equal(result.range, '30d');
  assert.equal(result.endDate, '2026-06-14');
  assert.equal(result.timezoneOffsetMinutes, -480);
  assert.throws(() => reviewStatsQuerySchema.parse({ range: '90d' }));
}

function testStatsResponse() {
  const result = reviewStatsResponseSchema.parse({
    range: '7d',
    fromDate: '2026-06-08',
    toDate: '2026-06-14',
    totalReviews: 3,
    reviewedCards: 2,
    dueCards: 1,
    accuracyLikeRate: 0.67,
    streakDays: 2,
    ratingCounts: {
      again: 1,
      hard: 0,
      good: 1,
      easy: 1,
    },
    stateCounts: {
      NEW: 1,
      LEARNING: 0,
      REVIEW: 2,
      RELEARNING: 0,
    },
    dailyReviews: [
      { date: '2026-06-08', count: 0 },
      { date: '2026-06-09', count: 0 },
      { date: '2026-06-10', count: 0 },
      { date: '2026-06-11', count: 0 },
      { date: '2026-06-12', count: 1 },
      { date: '2026-06-13', count: 1 },
      { date: '2026-06-14', count: 1 },
    ],
  });

  assert.equal(result.ratingCounts.good, 1);
  assert.equal(result.stateCounts.REVIEW, 2);
}

function testReviewLogListResponse() {
  const result = reviewLogListResponseSchema.parse({
    items: [
      {
        id: 'log_1',
        cardId: 'card_1',
        rating: 3,
        scheduledDays: 1,
        elapsedDays: 0,
        reviewDurationMs: 12000,
        reviewedAt: '2026-06-14T08:00:00.000Z',
        nextReview: '2026-06-15T08:00:00.000Z',
        currentCardState: 'REVIEW',
        wrongQuestion: {
          id: 'wrong_1',
          questionText: 'Compute 2x + 5 = 13.',
          subject: '数学',
          knowledgePoints: ['一元一次方程'],
          status: 'UNRESOLVED',
        },
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
  });

  assert.equal(result.items[0]?.wrongQuestion?.subject, '数学');
  assert.equal(result.items[0]?.currentCardState, 'REVIEW');
}
```

- [ ] **Step 2: Run type contract tests and verify they fail**

Run:

```powershell
node --experimental-strip-types packages/types/tests/review.test.mts
```

Expected: FAIL because `reviewStatsQuerySchema`, `reviewStatsResponseSchema`, and `reviewLogListResponseSchema` are not exported.

- [ ] **Step 3: Add review stats/log schemas**

In `packages/types/src/api/review.ts`, insert after `reviewTodayTasksResponseSchema`:

```ts
export const reviewStatsRangeSchema = z.enum(['7d', '30d']);

export const reviewStatsQuerySchema = z.object({
  range: reviewStatsRangeSchema.default('7d'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
});

export const reviewRatingCountsSchema = z.object({
  again: z.number().int().nonnegative(),
  hard: z.number().int().nonnegative(),
  good: z.number().int().nonnegative(),
  easy: z.number().int().nonnegative(),
});

export const reviewCardStateCountsSchema = z.object({
  NEW: z.number().int().nonnegative(),
  LEARNING: z.number().int().nonnegative(),
  REVIEW: z.number().int().nonnegative(),
  RELEARNING: z.number().int().nonnegative(),
});

export const reviewDailyCountSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().int().nonnegative(),
});

export const reviewStatsResponseSchema = z.object({
  range: reviewStatsRangeSchema,
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalReviews: z.number().int().nonnegative(),
  reviewedCards: z.number().int().nonnegative(),
  dueCards: z.number().int().nonnegative(),
  accuracyLikeRate: z.number().min(0).max(1),
  streakDays: z.number().int().nonnegative(),
  ratingCounts: reviewRatingCountsSchema,
  stateCounts: reviewCardStateCountsSchema,
  dailyReviews: z.array(reviewDailyCountSchema),
});

export const reviewLogWrongQuestionSchema = z.object({
  id: z.string().min(1),
  questionText: z.string(),
  subject: z.string(),
  knowledgePoints: z.array(z.string()),
  status: reviewWrongQuestionStatusSchema,
});

export const reviewLogListItemSchema = z.object({
  id: z.string().min(1),
  cardId: z.string().min(1),
  rating: reviewRatingSchema,
  scheduledDays: z.number().int().nonnegative(),
  elapsedDays: z.number().int().nonnegative(),
  reviewDurationMs: z.number().int().nonnegative().nullable(),
  reviewedAt: z.string().datetime(),
  nextReview: z.string().datetime(),
  currentCardState: reviewCardStateSchema,
  wrongQuestion: reviewLogWrongQuestionSchema.optional(),
});

export const reviewLogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const reviewLogListResponseSchema = z.object({
  items: z.array(reviewLogListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
```

Append these exports near the existing type exports:

```ts
export type ReviewStatsRange = z.infer<typeof reviewStatsRangeSchema>;
export type ReviewStatsQuery = z.infer<typeof reviewStatsQuerySchema>;
export type ReviewStatsResponse = z.infer<typeof reviewStatsResponseSchema>;
export type ReviewRatingCounts = z.infer<typeof reviewRatingCountsSchema>;
export type ReviewCardStateCounts = z.infer<typeof reviewCardStateCountsSchema>;
export type ReviewDailyCount = z.infer<typeof reviewDailyCountSchema>;
export type ReviewLogListItemResponse = z.infer<typeof reviewLogListItemSchema>;
export type ReviewLogListQuery = z.infer<typeof reviewLogListQuerySchema>;
export type ReviewLogListResponse = z.infer<typeof reviewLogListResponseSchema>;
```

- [ ] **Step 4: Run type contract tests and package typecheck**

Run:

```powershell
node --experimental-strip-types packages/types/tests/review.test.mts
bun --cwd packages/types typecheck
```

Expected: both commands exit 0. Node may emit `MODULE_TYPELESS_PACKAGE_JSON`; that warning is acceptable if exit code is 0.

- [ ] **Step 5: Commit shared contracts**

```powershell
git add packages/types/src/api/review.ts packages/types/tests/review.test.mts
git commit -m "feat: add review stats api contracts"
```

---

## Task 2: Add Backend Review Stats Unit Tests

**Files:**
- Modify: `apps/server/src/reviews/reviews.service.spec.ts`

- [ ] **Step 1: Extend Prisma mock shape**

In `apps/server/src/reviews/reviews.service.spec.ts`, extend the `prisma` mock:

```ts
const prisma = {
  $transaction: jest.fn(),
  wrongQuestion: {
    findFirst: jest.fn(),
  },
  card: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  reviewLog: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
};
```

- [ ] **Step 2: Add failing stats/logs unit tests**

Append these tests inside `describe('ReviewsService', () => { ... })`:

```ts
  it('summarizes review stats scoped to the current user', async () => {
    prisma.reviewLog.findMany.mockResolvedValue([
      { ...reviewLog, id: 'log_1', cardId: 'card_1', rating: 1, reviewedAt: new Date('2026-06-12T08:00:00.000Z') },
      { ...reviewLog, id: 'log_2', cardId: 'card_1', rating: 3, reviewedAt: new Date('2026-06-13T08:00:00.000Z') },
      { ...reviewLog, id: 'log_3', cardId: 'card_2', rating: 4, reviewedAt: new Date('2026-06-14T08:00:00.000Z') },
    ]);
    prisma.card.count.mockResolvedValue(1);
    prisma.card.groupBy.mockResolvedValue([
      { state: 'NEW', _count: { _all: 1 } },
      { state: 'REVIEW', _count: { _all: 2 } },
    ]);

    const result = await createService().getStats('user_1', {
      range: '7d',
      endDate: '2026-06-14',
      timezoneOffsetMinutes: -480,
    });

    expect(prisma.reviewLog.findMany).toHaveBeenCalledWith({
      where: {
        reviewedAt: {
          gte: new Date('2026-06-07T16:00:00.000Z'),
          lte: new Date('2026-06-14T15:59:59.999Z'),
        },
        card: { userId: 'user_1' },
      },
      select: {
        cardId: true,
        rating: true,
        reviewedAt: true,
      },
      orderBy: { reviewedAt: 'asc' },
    });
    expect(result).toMatchObject({
      range: '7d',
      fromDate: '2026-06-08',
      toDate: '2026-06-14',
      totalReviews: 3,
      reviewedCards: 2,
      dueCards: 1,
      accuracyLikeRate: 0.67,
      streakDays: 3,
      ratingCounts: { again: 1, hard: 0, good: 1, easy: 1 },
      stateCounts: { NEW: 1, LEARNING: 0, REVIEW: 2, RELEARNING: 0 },
    });
    expect(result.dailyReviews).toHaveLength(7);
    expect(result.dailyReviews.at(-1)).toEqual({ date: '2026-06-14', count: 1 });
  });

  it('returns zeroed stats when there are no review logs', async () => {
    prisma.reviewLog.findMany.mockResolvedValue([]);
    prisma.card.count.mockResolvedValue(0);
    prisma.card.groupBy.mockResolvedValue([]);

    const result = await createService().getStats('user_1', {
      range: '7d',
      endDate: '2026-06-14',
      timezoneOffsetMinutes: -480,
    });

    expect(result.totalReviews).toBe(0);
    expect(result.reviewedCards).toBe(0);
    expect(result.accuracyLikeRate).toBe(0);
    expect(result.streakDays).toBe(0);
    expect(result.dailyReviews.every((item) => item.count === 0)).toBe(true);
  });

  it('lists recent review logs scoped to the current user', async () => {
    prisma.reviewLog.findMany.mockResolvedValue([
      {
        ...reviewLog,
        card: {
          ...card,
          nextReview: new Date('2026-06-15T08:00:00.000Z'),
          wrongQuestion,
        },
      },
    ]);
    prisma.reviewLog.count.mockResolvedValue(1);

    const result = await createService().getLogs('user_1', {
      page: 1,
      pageSize: 20,
    });

    expect(prisma.reviewLog.findMany).toHaveBeenCalledWith({
      where: {
        card: { userId: 'user_1' },
      },
      include: {
        card: {
          include: { wrongQuestion: true },
        },
      },
      orderBy: { reviewedAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      items: [
        {
          id: 'log_1',
          cardId: 'card_1',
          rating: 3,
          nextReview: '2026-06-15T08:00:00.000Z',
          currentCardState: 'NEW',
          wrongQuestion: {
            id: 'wrong_1',
            subject: '数学',
          },
        },
      ],
    });
  });
```

- [ ] **Step 3: Run service tests and verify they fail**

Run:

```powershell
bun --filter @repo/server test -- reviews.service.spec.ts
```

Expected: FAIL because `getStats` and `getLogs` do not exist on `ReviewsService`.

---

## Task 3: Implement Backend Stats and Logs

**Files:**
- Modify: `apps/server/src/reviews/reviews.service.ts`
- Modify: `apps/server/src/reviews/reviews.controller.ts`

- [ ] **Step 1: Import shared query types**

In `apps/server/src/reviews/reviews.service.ts`, extend the import from `@repo/types/api/review`:

```ts
import type {
  CreateReviewCardFromWrongQuestionRequest,
  ReviewLogListQuery,
  ReviewRatingRequest,
  ReviewStatsQuery,
} from '@repo/types/api/review';
```

- [ ] **Step 2: Add `getStats` and `getLogs` service methods**

Add these methods after `getTodayTasks`:

```ts
  async getStats(userId: string, input: ReviewStatsQuery) {
    const window = this.resolveStatsWindow(input);
    const [logs, dueCards, groupedStates] = await Promise.all([
      this.prisma.reviewLog.findMany({
        where: {
          reviewedAt: {
            gte: window.fromUtc,
            lte: window.toUtc,
          },
          card: { userId },
        },
        select: {
          cardId: true,
          rating: true,
          reviewedAt: true,
        },
        orderBy: { reviewedAt: 'asc' },
      }),
      this.prisma.card.count({
        where: {
          userId,
          suspendedAt: null,
          nextReview: { lte: new Date() },
        },
      }),
      this.prisma.card.groupBy({
        by: ['state'],
        where: {
          userId,
          suspendedAt: null,
        },
        _count: { _all: true },
      }),
    ]);

    const ratingCounts = {
      again: logs.filter((log) => log.rating === 1).length,
      hard: logs.filter((log) => log.rating === 2).length,
      good: logs.filter((log) => log.rating === 3).length,
      easy: logs.filter((log) => log.rating === 4).length,
    };
    const totalReviews = logs.length;
    const masteredReviews = ratingCounts.good + ratingCounts.easy;

    return {
      range: input.range,
      fromDate: window.fromDate,
      toDate: window.toDate,
      totalReviews,
      reviewedCards: new Set(logs.map((log) => log.cardId)).size,
      dueCards,
      accuracyLikeRate:
        totalReviews === 0 ? 0 : roundRatio(masteredReviews / totalReviews),
      streakDays: this.calculateStreakDays(logs, window),
      ratingCounts,
      stateCounts: this.toStateCounts(groupedStates),
      dailyReviews: this.toDailyReviewCounts(logs, window),
    };
  }

  async getLogs(userId: string, input: ReviewLogListQuery) {
    const skip = (input.page - 1) * input.pageSize;
    const where = {
      card: { userId },
    } satisfies Prisma.ReviewLogWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.reviewLog.findMany({
        where,
        include: {
          card: {
            include: { wrongQuestion: true },
          },
        },
        orderBy: { reviewedAt: 'desc' },
        skip,
        take: input.pageSize,
      }),
      this.prisma.reviewLog.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toLogListItemResponse(item)),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }
```

- [ ] **Step 3: Add date/stat helper methods**

Add these private methods before `ensureWrongQuestionOwned`:

```ts
  private resolveStatsWindow(input: ReviewStatsQuery) {
    const rangeDays = input.range === '30d' ? 30 : 7;
    const endDate = input.endDate ?? new Date().toISOString().slice(0, 10);
    const toLocal = new Date(`${endDate}T00:00:00.000Z`);
    toLocal.setUTCDate(toLocal.getUTCDate() + 1);
    toLocal.setUTCMilliseconds(toLocal.getUTCMilliseconds() - 1);
    const fromLocal = new Date(`${endDate}T00:00:00.000Z`);
    fromLocal.setUTCDate(fromLocal.getUTCDate() - rangeDays + 1);
    const offsetMs = input.timezoneOffsetMinutes * 60 * 1000;

    return {
      rangeDays,
      fromDate: this.formatDateKey(fromLocal),
      toDate: endDate,
      fromUtc: new Date(fromLocal.getTime() + offsetMs),
      toUtc: new Date(toLocal.getTime() + offsetMs),
      timezoneOffsetMinutes: input.timezoneOffsetMinutes,
    };
  }

  private toDailyReviewCounts(
    logs: Array<{ reviewedAt: Date }>,
    window: ReviewStatsWindow,
  ) {
    const counts = new Map<string, number>();
    for (let index = 0; index < window.rangeDays; index += 1) {
      const date = new Date(`${window.fromDate}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + index);
      counts.set(this.formatDateKey(date), 0);
    }

    for (const log of logs) {
      const localTime = new Date(
        log.reviewedAt.getTime() - window.timezoneOffsetMinutes * 60 * 1000,
      );
      const key = this.formatDateKey(localTime);
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
  }

  private calculateStreakDays(
    logs: Array<{ reviewedAt: Date }>,
    window: ReviewStatsWindow,
  ) {
    const reviewedDates = new Set(
      logs.map((log) =>
        this.formatDateKey(
          new Date(log.reviewedAt.getTime() - window.timezoneOffsetMinutes * 60 * 1000),
        ),
      ),
    );
    let streak = 0;
    const cursor = new Date(`${window.toDate}T00:00:00.000Z`);
    for (let index = 0; index < window.rangeDays; index += 1) {
      const key = this.formatDateKey(cursor);
      if (!reviewedDates.has(key)) break;
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
  }

  private toStateCounts(
    groups: Array<{ state: string; _count: { _all: number } }>,
  ) {
    const counts = {
      NEW: 0,
      LEARNING: 0,
      REVIEW: 0,
      RELEARNING: 0,
    };
    for (const group of groups) {
      if (group.state in counts) {
        counts[group.state as keyof typeof counts] = group._count._all;
      }
    }
    return counts;
  }

  private formatDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private toLogListItemResponse(log: ReviewLogListRecord) {
    return {
      id: log.id,
      cardId: log.cardId,
      rating: log.rating as 1 | 2 | 3 | 4,
      scheduledDays: log.scheduledDays,
      elapsedDays: log.elapsedDays,
      reviewDurationMs: log.reviewDurationMs,
      reviewedAt: log.reviewedAt.toISOString(),
      nextReview: log.card.nextReview.toISOString(),
      currentCardState: log.card.state,
      wrongQuestion: log.card.wrongQuestion
        ? {
            id: log.card.wrongQuestion.id,
            questionText: log.card.wrongQuestion.questionText,
            subject: log.card.wrongQuestion.subject,
            knowledgePoints: log.card.wrongQuestion.knowledgePoints,
            status: log.card.wrongQuestion.status,
          }
        : undefined,
    };
  }
```

Add utility function near the bottom of the file:

```ts
function roundRatio(value: number) {
  return Math.round(value * 100) / 100;
}
```

Add types near existing `CardRecord` aliases:

```ts
type ReviewStatsWindow = {
  rangeDays: number;
  fromDate: string;
  toDate: string;
  fromUtc: Date;
  toUtc: Date;
  timezoneOffsetMinutes: number;
};

type ReviewLogListRecord = Prisma.ReviewLogGetPayload<{
  include: {
    card: {
      include: { wrongQuestion: true };
    };
  };
}>;
```

- [ ] **Step 4: Add controller routes**

In `apps/server/src/reviews/reviews.controller.ts`, extend imports:

```ts
import {
  createReviewCardFromWrongQuestionRequestSchema,
  reviewLogListQuerySchema,
  reviewRatingRequestSchema,
  reviewStatsQuerySchema,
} from '@repo/types/api/review';
```

Add routes after `getTodayTasks`:

```ts
  @Get('stats')
  getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ) {
    const input = reviewStatsQuerySchema.parse(query);
    return this.reviewsService.getStats(user.id, input);
  }

  @Get('logs')
  getLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ) {
    const input = reviewLogListQuerySchema.parse(query);
    return this.reviewsService.getLogs(user.id, input);
  }
```

- [ ] **Step 5: Run server unit tests**

Run:

```powershell
bun --filter @repo/server test -- reviews.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Run server lint/build**

Run:

```powershell
bun --filter @repo/server lint
bun --filter @repo/server build
```

Expected: both exit 0.

- [ ] **Step 7: Commit backend stats implementation**

```powershell
git add apps/server/src/reviews/reviews.service.ts apps/server/src/reviews/reviews.controller.ts apps/server/src/reviews/reviews.service.spec.ts
git commit -m "feat: add review stats api"
```

---

## Task 4: Add Backend E2E Coverage

**Files:**
- Create: `apps/server/test/reviews.e2e-spec.ts`

- [ ] **Step 1: Inspect existing e2e helpers**

Open `apps/server/test/wrong-questions.e2e-spec.ts` and reuse its Nest application setup, response envelope helpers, auth helper style, and user cleanup pattern.

- [ ] **Step 2: Create failing e2e tests**

Create `apps/server/test/reviews.e2e-spec.ts` with a `ReviewsController (e2e)` suite that follows the existing e2e helper style. Include this core test:

```ts
  it('returns review stats and logs for the current user only', async () => {
    const userA = await registerAndLogin('review-stats-a@example.com');
    const userB = await registerAndLogin('review-stats-b@example.com');
    const wrongQuestion = await createWrongQuestion(userA.accessToken, {
      questionText: 'Compute 2 + 2.',
      subject: '数学',
      category: '基础运算',
      knowledgePoints: ['加法'],
      answer: '4',
      analysis: '2 + 2 = 4.',
    });
    const cardResponse = await request(app.getHttpServer())
      .post('/reviews/cards/from-wrong-question')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ wrongQuestionId: wrongQuestion.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/reviews/cards/${cardResponse.body.data.card.id}/rating`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({
        rating: 3,
        reviewedAt: '2026-06-14T08:00:00.000Z',
        reviewDurationMs: 12000,
      })
      .expect(201);

    const stats = await request(app.getHttpServer())
      .get('/reviews/stats?range=7d&endDate=2026-06-14&timezoneOffsetMinutes=-480')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);
    expect(stats.body.data.totalReviews).toBe(1);
    expect(stats.body.data.ratingCounts.good).toBe(1);
    expect(stats.body.data.dailyReviews).toHaveLength(7);

    const logs = await request(app.getHttpServer())
      .get('/reviews/logs?page=1&pageSize=20')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .expect(200);
    expect(logs.body.data.total).toBe(1);
    expect(logs.body.data.items[0].wrongQuestion.subject).toBe('数学');

    const otherStats = await request(app.getHttpServer())
      .get('/reviews/stats?range=7d&endDate=2026-06-14&timezoneOffsetMinutes=-480')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .expect(200);
    expect(otherStats.body.data.totalReviews).toBe(0);
  });
```

Implement local helper functions in this new file if needed:

- `registerAndLogin(label)`
- `createWrongQuestion(accessToken, payload)`
- `getSuccessData(response)`
- `getErrorBody(response)`

Keep the assertions and API paths unchanged.

- [ ] **Step 3: Run e2e and verify it fails before implementation if Task 3 was not done**

If Task 3 is not implemented yet:

```powershell
bun --filter @repo/server test:e2e -- --runInBand reviews.e2e-spec.ts
```

Expected: FAIL with 404 on `/reviews/stats` or `/reviews/logs`.

If Task 3 is already implemented:

Expected: PASS after adjusting helper names.

- [ ] **Step 4: Run full server e2e**

Run:

```powershell
bun --filter @repo/server test:e2e -- --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit e2e coverage**

```powershell
git add apps/server/test/reviews.e2e-spec.ts
git commit -m "test: cover review stats api"
```

---

## Task 5: Add Frontend Review API and Hooks

**Files:**
- Modify: `apps/web/src/lib/review-api.ts`
- Modify: `apps/web/src/lib/review-api.test.mts`
- Modify: `apps/web/src/hooks/use-reviews.ts`

- [ ] **Step 1: Add failing frontend API tests**

In `apps/web/src/lib/review-api.test.mts`, add calls in `run()`:

```ts
  await testReadsReviewStats();
  await testReadsReviewLogs();
```

Append:

```ts
async function testReadsReviewStats() {
  const requests: CapturedRequest[] = [];
  const reviewApi = createReviewApi(
    createTestClient(requests, {
      range: '7d',
      fromDate: '2026-06-08',
      toDate: '2026-06-14',
      totalReviews: 1,
      reviewedCards: 1,
      dueCards: 0,
      accuracyLikeRate: 1,
      streakDays: 1,
      ratingCounts: { again: 0, hard: 0, good: 1, easy: 0 },
      stateCounts: { NEW: 0, LEARNING: 0, REVIEW: 1, RELEARNING: 0 },
      dailyReviews: [
        { date: '2026-06-08', count: 0 },
        { date: '2026-06-09', count: 0 },
        { date: '2026-06-10', count: 0 },
        { date: '2026-06-11', count: 0 },
        { date: '2026-06-12', count: 0 },
        { date: '2026-06-13', count: 0 },
        { date: '2026-06-14', count: 1 },
      ],
    }),
  );

  const result = await reviewApi.getStats('token_1', {
    range: '7d',
    endDate: '2026-06-14',
    timezoneOffsetMinutes: -480,
  });

  assert.equal(
    requests[0].input,
    'http://localhost:3001/reviews/stats?range=7d&endDate=2026-06-14&timezoneOffsetMinutes=-480',
  );
  assert.equal(requests[0].method, 'GET');
  assert.equal(result.totalReviews, 1);
}

async function testReadsReviewLogs() {
  const requests: CapturedRequest[] = [];
  const reviewApi = createReviewApi(
    createTestClient(requests, {
      items: [
        {
          id: 'log_1',
          cardId: 'card_1',
          rating: 3,
          scheduledDays: 1,
          elapsedDays: 0,
          reviewDurationMs: 12000,
          reviewedAt: '2026-06-14T08:00:00.000Z',
          nextReview: '2026-06-15T08:00:00.000Z',
          currentCardState: 'REVIEW',
          wrongQuestion: {
            id: 'wrong_1',
            questionText: 'Compute 2 + 2.',
            subject: '数学',
            knowledgePoints: ['加法'],
            status: 'UNRESOLVED',
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  );

  const result = await reviewApi.getLogs('token_1', { page: 1, pageSize: 20 });

  assert.equal(requests[0].input, 'http://localhost:3001/reviews/logs?page=1&pageSize=20');
  assert.equal(result.items[0]?.wrongQuestion?.subject, '数学');
}
```

- [ ] **Step 2: Run frontend API tests and verify they fail**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-api.test.mts
```

Expected: FAIL because `getStats` and `getLogs` do not exist.

- [ ] **Step 3: Implement review API client methods**

In `apps/web/src/lib/review-api.ts`, extend imports:

```ts
  reviewLogListResponseSchema,
  reviewStatsResponseSchema,
  type ReviewLogListQuery,
  type ReviewStatsQuery,
```

Add methods inside `createReviewApi`:

```ts
    async getStats(accessToken: string, query: ReviewStatsQuery) {
      const params = new URLSearchParams();
      params.set('range', query.range);
      if (query.endDate) params.set('endDate', query.endDate);
      params.set('timezoneOffsetMinutes', String(query.timezoneOffsetMinutes));
      return reviewStatsResponseSchema.parse(
        await client.get<unknown>(`/reviews/stats?${params.toString()}`, { accessToken }),
      );
    },

    async getLogs(accessToken: string, query: ReviewLogListQuery) {
      const params = new URLSearchParams();
      params.set('page', String(query.page));
      params.set('pageSize', String(query.pageSize));
      return reviewLogListResponseSchema.parse(
        await client.get<unknown>(`/reviews/logs?${params.toString()}`, { accessToken }),
      );
    },
```

- [ ] **Step 4: Add hooks**

In `apps/web/src/hooks/use-reviews.ts`, extend imports:

```ts
import type {
  ReviewLogListQuery,
  ReviewRatingRequest,
  ReviewStatsQuery,
} from '@repo/types/api/review';
```

Extend query keys:

```ts
  stats: (query: ReviewStatsQuery) => [...reviewQueryKeys.all, 'stats', query] as const,
  logs: (query: ReviewLogListQuery) => [...reviewQueryKeys.all, 'logs', query] as const,
```

Add hooks:

```ts
export function useReviewStats(query: ReviewStatsQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewQueryKeys.stats(query),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewApi.getStats(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useReviewLogs(query: ReviewLogListQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewQueryKeys.logs(query),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewApi.getLogs(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}
```

- [ ] **Step 5: Run frontend tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-api.test.mts
bun --filter @repo/web lint
```

Expected: both exit 0.

- [ ] **Step 6: Commit frontend API hooks**

```powershell
git add apps/web/src/lib/review-api.ts apps/web/src/lib/review-api.test.mts apps/web/src/hooks/use-reviews.ts
git commit -m "feat: add review stats hooks"
```

---

## Task 6: Add Stats View Helpers and Page

**Files:**
- Create: `apps/web/src/lib/review-stats-view.ts`
- Create: `apps/web/src/lib/review-stats-view.test.mts`
- Create: `apps/web/src/app/(main)/stats/page.tsx`
- Modify: `apps/web/src/components/chat/chat-sidebar.tsx`
- Modify: `apps/web/src/app/(main)/today/page.tsx`

- [ ] **Step 1: Add failing view helper tests**

Create `apps/web/src/lib/review-stats-view.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatPercent,
  getMaxDailyReviewCount,
  getRatingLabel,
  getStateLabel,
  shouldShowStatsEmptyState,
} from './review-stats-view.ts';

test('formats ratio values as percentages', () => {
  assert.equal(formatPercent(0), '0%');
  assert.equal(formatPercent(0.67), '67%');
  assert.equal(formatPercent(1), '100%');
});

test('returns max daily review count with a minimum of one', () => {
  assert.equal(getMaxDailyReviewCount([]), 1);
  assert.equal(getMaxDailyReviewCount([{ date: '2026-06-14', count: 3 }]), 3);
});

test('maps rating and card state labels', () => {
  assert.equal(getRatingLabel(1), '忘了');
  assert.equal(getRatingLabel(4), '轻松');
  assert.equal(getStateLabel('RELEARNING'), '重学中');
});

test('shows empty state when there are no reviews and no logs', () => {
  assert.equal(shouldShowStatsEmptyState(0, 0), true);
  assert.equal(shouldShowStatsEmptyState(1, 0), false);
});
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-stats-view.test.mts
```

Expected: FAIL because `review-stats-view.ts` does not exist.

- [ ] **Step 3: Implement view helpers**

Create `apps/web/src/lib/review-stats-view.ts`:

```ts
import type { ReviewCardState, ReviewRating } from '@repo/types/api/review';

export function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

export function getMaxDailyReviewCount(items: Array<{ count: number }>) {
  return Math.max(1, ...items.map((item) => item.count));
}

export function getRatingLabel(rating: ReviewRating) {
  const labels: Record<ReviewRating, string> = {
    1: '忘了',
    2: '吃力',
    3: '掌握',
    4: '轻松',
  };
  return labels[rating];
}

export function getStateLabel(state: ReviewCardState) {
  const labels: Record<ReviewCardState, string> = {
    NEW: '新卡',
    LEARNING: '学习中',
    REVIEW: '复习中',
    RELEARNING: '重学中',
  };
  return labels[state];
}

export function shouldShowStatsEmptyState(totalReviews: number, logTotal: number) {
  return totalReviews === 0 && logTotal === 0;
}
```

- [ ] **Step 4: Create stats page**

Create `apps/web/src/app/(main)/stats/page.tsx` with this structure:

```tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, BookOpen, CalendarDays, History, Loader2, RotateCcw, Sparkles } from 'lucide-react';

import type { ReviewStatsRange } from '@repo/types/api/review';
import { useReviewLogs, useReviewStats } from '@/hooks/use-reviews';
import { getLocalDateKey } from '@/lib/today-tasks';
import {
  formatPercent,
  getMaxDailyReviewCount,
  getRatingLabel,
  getStateLabel,
  shouldShowStatsEmptyState,
} from '@/lib/review-stats-view';

export default function StatsPage() {
  const [range, setRange] = useState<ReviewStatsRange>('7d');
  const [page, setPage] = useState(1);
  const endDate = useMemo(() => getLocalDateKey(), []);
  const timezoneOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);
  const statsQuery = useReviewStats({ range, endDate, timezoneOffsetMinutes });
  const logsQuery = useReviewLogs({ page, pageSize: 20 });
  const stats = statsQuery.data;
  const logs = logsQuery.data;
  const maxDailyCount = getMaxDailyReviewCount(stats?.dailyReviews ?? []);
  const empty = shouldShowStatsEmptyState(stats?.totalReviews ?? 0, logs?.total ?? 0);

  return (
    <div className="pm-anime-bg min-h-[100dvh] text-[var(--pm-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--pm-line)] bg-white/75 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link href="/chat" aria-label="返回聊天" className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-[#eafff9] active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--pm-muted)]">Learning stats</p>
            <h1 className="text-lg font-semibold leading-tight">学习统计</h1>
          </div>
          <div className="pm-mascot-float flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
            <BarChart3 className="h-5 w-5" />
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-3xl">
        <section className="pm-glass-card pm-enter rounded-[1.6rem] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[var(--pm-muted)]">复习成果</p>
              <p className="mt-1 text-3xl font-black leading-none text-[var(--pm-ink)]">
                {stats?.totalReviews ?? 0}
              </p>
              <p className="mt-1 text-xs text-[var(--pm-muted)]">窗口内复习次数</p>
            </div>
            <div className="flex rounded-2xl bg-white/70 p-1 ring-1 ring-[var(--pm-line)]">
              {(['7d', '30d'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setRange(item);
                    setPage(1);
                  }}
                  className={`tap-target min-h-9 rounded-xl px-3 text-xs font-bold transition-all ${
                    range === item ? 'bg-[#2b2335] text-white' : 'text-[var(--pm-muted)] hover:bg-white'
                  }`}
                >
                  {item === '7d' ? '7 天' : '30 天'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniStat label="掌握率" value={formatPercent(stats?.accuracyLikeRate ?? 0)} />
            <MiniStat label="连续复习" value={`${stats?.streakDays ?? 0} 天`} />
            <MiniStat label="复习卡" value={`${stats?.reviewedCards ?? 0} 张`} />
            <MiniStat label="当前待复习" value={`${stats?.dueCards ?? 0} 张`} />
          </div>
        </section>

        {statsQuery.isLoading || logsQuery.isLoading ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-3 text-sm text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在读取学习统计...
          </div>
        ) : statsQuery.isError || logsQuery.isError ? (
          <div className="mt-4 rounded-2xl bg-red-50/80 px-3 py-3 text-sm leading-6 text-red-600 ring-1 ring-red-100">
            统计数据读取失败，请稍后刷新重试。
          </div>
        ) : empty ? (
          <EmptyStats />
        ) : (
          <>
            <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
              <SectionTitle icon={CalendarDays} title="复习趋势" subtitle={`${stats?.fromDate} 到 ${stats?.toDate}`} />
              <div className="mt-4 flex h-32 items-end gap-1.5">
                {(stats?.dailyReviews ?? []).map((item) => (
                  <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="flex h-24 w-full items-end rounded-full bg-white/55 ring-1 ring-[var(--pm-line)]">
                      <div
                        className="w-full rounded-full bg-gradient-to-t from-[#78d6c8] to-[#ffe89a]"
                        style={{ height: `${Math.max(6, (item.count / maxDailyCount) * 100)}%` }}
                        title={`${item.date}: ${item.count}`}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-[var(--pm-muted)]">{item.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
              <SectionTitle icon={Sparkles} title="评分分布" subtitle="四档反馈会影响下次复习时间" />
              <div className="mt-3 space-y-2">
                {([
                  [1, stats?.ratingCounts.again ?? 0],
                  [2, stats?.ratingCounts.hard ?? 0],
                  [3, stats?.ratingCounts.good ?? 0],
                  [4, stats?.ratingCounts.easy ?? 0],
                ] as const).map(([rating, count]) => (
                  <DistributionRow key={rating} label={getRatingLabel(rating)} value={count} total={stats?.totalReviews ?? 0} />
                ))}
              </div>
            </section>

            <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
              <SectionTitle icon={BookOpen} title="卡片状态" subtitle="当前复习卡分布" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['NEW', 'LEARNING', 'REVIEW', 'RELEARNING'] as const).map((state) => (
                  <MiniStat key={state} label={getStateLabel(state)} value={`${stats?.stateCounts[state] ?? 0} 张`} />
                ))}
              </div>
            </section>

            <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
              <SectionTitle icon={History} title="最近复习" subtitle={`${logs?.total ?? 0} 条记录`} />
              <div className="mt-3 space-y-3">
                {(logs?.items ?? []).map((item) => (
                  <article key={item.id} className="rounded-2xl bg-white/70 p-3 ring-1 ring-[var(--pm-line)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-[#eafff9] px-2 py-0.5 text-[11px] font-bold text-[#247269]">
                        {getRatingLabel(item.rating)}
                      </span>
                      <span className="text-[11px] font-medium text-[var(--pm-muted)]">
                        {new Date(item.reviewedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6">
                      {item.wrongQuestion?.questionText ?? '复习卡'}
                    </p>
                    <p className="mt-1 text-xs text-[var(--pm-muted)]">
                      下次复习：{new Date(item.nextReview).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
```

Add these local components below the page component:

```tsx
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-[var(--pm-line)]">
      <p className="text-xs font-medium text-[var(--pm-muted)]">{label}</p>
      <p className="mt-1 text-lg font-black text-[var(--pm-ink)]">{value}</p>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof BarChart3;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-[var(--pm-muted)]">{subtitle}</p>
      </div>
    </div>
  );
}

function DistributionRow({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold">
        <span>{label}</span>
        <span className="text-[var(--pm-muted)]">{value} 次</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/70 ring-1 ring-[var(--pm-line)]">
        <div className="h-full rounded-full bg-[#78d6c8]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function EmptyStats() {
  return (
    <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-5 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-3xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
        <RotateCcw className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-base font-semibold">还没有复习统计</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--pm-muted)]">
        从错题详情加入复习计划，并在今日任务里完成一次评分后，这里会出现趋势和记录。
      </p>
      <Link href="/today" className="tap-target mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white">
        去今日任务
      </Link>
    </section>
  );
}
```

- [ ] **Step 5: Add sidebar navigation item**

In `apps/web/src/components/chat/chat-sidebar.tsx`, import `BarChart3` from `lucide-react` and add the item after 今日任务:

```ts
{ href: '/stats', label: '学习统计', hint: '复习趋势与记录', icon: BarChart3 },
```

- [ ] **Step 6: Add today page shortcut**

In `apps/web/src/app/(main)/today/page.tsx`, add a third bottom link near the existing `AI 对话` and `错题本` shortcuts:

```tsx
<Link
  href="/stats"
  className="tap-target flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/75 text-sm font-semibold text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-[0.98]"
>
  <BarChart3 className="h-4 w-4" />
  学习统计
</Link>
```

Add `BarChart3` to the lucide import list.

- [ ] **Step 7: Run frontend tests and build**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-stats-view.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all exit 0.

- [ ] **Step 8: Commit stats page**

```powershell
git add apps/web/src/lib/review-stats-view.ts apps/web/src/lib/review-stats-view.test.mts "apps/web/src/app/(main)/stats/page.tsx" apps/web/src/components/chat/chat-sidebar.tsx "apps/web/src/app/(main)/today/page.tsx"
git commit -m "feat: add learning stats page"
```

---

## Task 7: Browser Verification

**Files:**
- No source files unless verification finds a defect.

- [ ] **Step 1: Start infrastructure**

Run:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
```

Expected: PostgreSQL, Redis, and MinIO running.

- [ ] **Step 2: Apply migrations and generate client**

Run:

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --cwd packages/database prisma migrate deploy
bun run db:generate
```

Expected: no pending migration failure and Prisma client generated.

- [ ] **Step 3: Start dev servers**

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

Expected: backend listens on `3001`, frontend on `3000`.

- [ ] **Step 4: Verify stats flow in browser**

Use Playwright or manual browser:

1. Register `codex-stats-smoke-YYYYMMDD@example.com`.
2. Create a wrong question through API or UI.
3. Create a review card with `POST /reviews/cards/from-wrong-question`.
4. Open `/today`, reveal answer, submit `掌握`.
5. Open `/stats`.
6. Confirm:
   - total reviews is at least `1`.
   - rating distribution shows `掌握` count.
   - recent review list shows the wrong question.
   - sidebar has `学习统计`.
   - today page has `学习统计` shortcut.
7. Switch `7 天` and `30 天`.
8. Confirm console has no new app errors.

- [ ] **Step 5: Clean smoke account**

Run from `packages/database`:

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun -e "import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); const email='codex-stats-smoke-YYYYMMDD@example.com'; const user = await prisma.user.findUnique({ where: { email } }); if (user) await prisma.user.delete({ where: { id: user.id } }); await prisma.$disconnect();"
```

Expected: smoke user removed; cascade deletes related cards/logs.

---

## Task 8: Update Project Documents After Verification

**Files:**
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Update data flow**

Add to `docs/data-flow.md` under FSRS review:

```md
- Phase 4.2 新增 `/reviews/stats` 和 `/reviews/logs`。
- 学习统计页 `/stats` 从服务端读取 Review 聚合数据，不直接在前端扫描原始表。
- 统计数据以 `Card` / `ReviewLog` / `WrongQuestion` 为来源，按当前 `userId` 隔离。
- `/reviews/stats` 提供复习次数、掌握率、连续复习、评分分布、卡片状态分布和每日趋势。
- `/reviews/logs` 提供最近复习记录和错题摘要。
```

- [ ] **Step 2: Update roadmap/current docs**

In `docs/roadmap.md`, `AGENTS.md`, and `CLAUDE.md`, mark Phase 4.2 as completed only after all verification passes:

```md
- Phase 4.2：学习统计页、Review stats/logs API、复习趋势和最近记录已完成。
```

Keep Phase 4 overall as `进行中` because ReviewTask 数据流和离线评分策略 still remain.

- [ ] **Step 3: Update DEVLOG**

Add a same-day section entry under `2026-06-14`:

```md
**Phase 4.2 学习统计**

- 新增 Review stats/logs API，基于 Card / ReviewLog / WrongQuestion 聚合复习数据。
- 新增 `/stats` 学习统计页，展示总览、趋势、评分分布、卡片状态和最近复习记录。
- 侧边栏和今日任务页新增学习统计入口。
- 统计和日志按当前 userId 隔离，不新增 ReviewTask 表。

验证：
- `node --experimental-strip-types packages/types/tests/review.test.mts` 通过。
- `bun --filter @repo/server test` 通过。
- `bun --filter @repo/server test:e2e -- --runInBand` 通过。
- `node --experimental-strip-types apps/web/src/lib/review-api.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/review-stats-view.test.mts` 通过。
- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过。
- 浏览器统计链路验收通过。
```

- [ ] **Step 4: Run final checks**

Run:

```powershell
node --experimental-strip-types packages/types/tests/review.test.mts
bun --filter @repo/server test
bun --filter @repo/server test:e2e -- --runInBand
node --experimental-strip-types apps/web/src/lib/review-api.test.mts
node --experimental-strip-types apps/web/src/lib/review-stats-view.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
git diff --check
```

Expected: all exit 0.

- [ ] **Step 5: Commit docs**

```powershell
git add docs/data-flow.md docs/roadmap.md AGENTS.md CLAUDE.md DEVLOG.md
git commit -m "docs: record phase 4.2 review stats"
```

---

## Final Acceptance Checklist

- [ ] Shared `@repo/types/api/review` schemas cover stats and logs.
- [ ] `GET /reviews/stats` is guarded and user-scoped.
- [ ] `GET /reviews/logs` is guarded and user-scoped.
- [ ] Stats date buckets respect `timezoneOffsetMinutes`.
- [ ] `/stats` page renders empty state for users with no review history.
- [ ] `/stats` page renders total reviews, mastery rate, streak, due cards, trend bars, rating distribution, state distribution, and recent logs.
- [ ] Sidebar and today page both link to `/stats`.
- [ ] All automated tests and build commands in Task 8 pass.
- [ ] Browser smoke account is removed from the database.
