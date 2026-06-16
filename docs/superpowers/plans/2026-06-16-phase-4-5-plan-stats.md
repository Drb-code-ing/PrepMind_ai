# Phase 4.5.1 Review Plan And Stats Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/plan` long-term review plan preview and upgrade `/stats` with client-only ECharts while keeping ReviewTask, ReviewLog, and offline rating behavior stable.

**Architecture:** Add a shared Zod contract for `GET /review-tasks/plan`, implement a read-only backend plan preview from `Card.nextReview`, then consume it in a new `/plan` page. Add a small client-only ECharts wrapper and pure option builders so `/plan` and `/stats` can share chart infrastructure without SSR hydration risk.

**Tech Stack:** Bun workspace, TypeScript, Next.js 16, React 19, NestJS 11, Prisma, PostgreSQL, TanStack Query, Zod, ECharts, Dexie.

---

## File Structure

- Modify: `packages/types/src/api/review-task.ts`
  - Add plan query/response schemas and exported TypeScript types.
- Modify: `packages/types/tests/review-task.test.mts`
  - Add contract tests for plan query defaults, validation, and response parsing.
- Modify: `apps/server/src/review-tasks/review-tasks.controller.ts`
  - Add `GET /review-tasks/plan`.
- Modify: `apps/server/src/review-tasks/review-tasks.service.ts`
  - Add `getPlan()` plus private helpers for date windows, day labels, intensity, and plan suggestions.
- Modify: `apps/server/src/review-tasks/review-tasks.service.spec.ts`
  - Add service tests proving user isolation, local-date grouping, overdue/today/upcoming counts, suspended-card filtering, and no future task creation.
- Modify: `apps/server/test/review-tasks.e2e-spec.ts`
  - Add e2e coverage for authenticated plan reads and invalid query rejection.
- Modify: `apps/web/package.json`
  - Add `echarts`.
- Modify: `bun.lock`
  - Updated by `bun add --filter @repo/web echarts`.
- Modify: `apps/web/src/lib/review-task-api.ts`
  - Add `getPlan()`.
- Modify: `apps/web/src/lib/review-task-api.test.mts`
  - Add request-building and schema parsing test for `getPlan()`.
- Modify: `apps/web/src/hooks/use-review-tasks.ts`
  - Add query key and `useReviewTaskPlan()`.
- Create: `apps/web/src/lib/review-plan-view.ts`
  - Pure helpers for plan summary labels, intensity styles, empty state, and ECharts bar options.
- Create: `apps/web/src/lib/review-plan-view.test.mts`
  - Unit tests for plan helpers and chart options.
- Create: `apps/web/src/lib/review-chart-options.ts`
  - Pure ECharts option builders for stats trend, rating distribution, and state distribution.
- Create: `apps/web/src/lib/review-chart-options.test.mts`
  - Unit tests for `/stats` chart option builders.
- Create: `apps/web/src/components/charts/base-echart.tsx`
  - Client-only dynamic ECharts wrapper with resize and dispose.
- Create: `apps/web/src/app/(main)/plan/page.tsx`
  - New long-term review plan page.
- Modify: `apps/web/src/app/(main)/today/page.tsx`
  - Add a lightweight `/plan` entry while preserving today execution behavior.
- Modify: `apps/web/src/components/chat/chat-sidebar.tsx`
  - Add a sidebar nav item for `/plan`.
- Modify: `apps/web/src/app/(main)/stats/page.tsx`
  - Replace custom SVG trend and basic bars with ECharts-backed charts.
- Modify at closeout: `docs/data-flow.md`, `docs/roadmap.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `DEVLOG.md`
  - Sync Phase 4.5.1 implementation details after verification.
- Create at closeout: `docs/dev-blog/2026-06-16-phase-4-5-review-plan-and-echarts.md`
  - Detailed daily development blog.

## Task 1: Shared Plan Contract

**Files:**
- Modify: `packages/types/src/api/review-task.ts`
- Modify: `packages/types/tests/review-task.test.mts`

- [ ] **Step 1: Write failing contract tests**

Add imports in `packages/types/tests/review-task.test.mts`:

```ts
import {
  reviewTaskPlanQuerySchema,
  reviewTaskPlanResponseSchema,
} from '../src/api/review-task.ts';
```

Call new tests from `run()`:

```ts
function run() {
  testStatus();
  testTodayQuery();
  testTodayResponse();
  testListQueryAndResponse();
  testRatingResponse();
  testActionResponse();
  testPlanQuery();
  testPlanResponse();
}
```

Add these tests:

```ts
function testPlanQuery() {
  const defaultQuery = reviewTaskPlanQuerySchema.parse({
    timezoneOffsetMinutes: '-480',
  });
  assert.equal(defaultQuery.days, 7);
  assert.equal(defaultQuery.timezoneOffsetMinutes, -480);
  assert.equal(defaultQuery.startDate, undefined);

  const explicitQuery = reviewTaskPlanQuerySchema.parse({
    days: '14',
    startDate: '2026-06-16',
    timezoneOffsetMinutes: '0',
  });
  assert.equal(explicitQuery.days, 14);
  assert.equal(explicitQuery.startDate, '2026-06-16');

  assert.throws(() => reviewTaskPlanQuerySchema.parse({ days: '0' }));
  assert.throws(() => reviewTaskPlanQuerySchema.parse({ days: '15' }));
  assert.throws(() => reviewTaskPlanQuerySchema.parse({ startDate: '2026/06/16' }));
}

function testPlanResponse() {
  const result = reviewTaskPlanResponseSchema.parse({
    startDate: '2026-06-16',
    endDate: '2026-06-22',
    generatedThroughDate: '2026-06-22',
    summary: {
      overdueCount: 1,
      todayDueCount: 2,
      upcomingDueCount: 3,
      estimatedTotalMinutes: 12,
      peakDay: { date: '2026-06-18', count: 3 },
      intensity: 'normal',
    },
    days: [
      {
        date: '2026-06-16',
        label: '今天',
        dueCount: 2,
        overdueCount: 1,
        pendingCount: 1,
        completedCount: 0,
        skippedCount: 0,
        estimatedMinutes: 4,
        intensity: 'light',
      },
    ],
    suggestion: {
      title: '先处理逾期卡',
      description: '今天先完成 1 张逾期卡，再进入正常复习节奏。',
      actionLabel: '去今日任务',
      actionHref: '/today',
    },
  });

  assert.equal(result.summary.peakDay?.date, '2026-06-18');
  assert.equal(result.days[0]?.intensity, 'light');
}
```

- [ ] **Step 2: Run contract test and verify it fails**

Run:

```powershell
bun --cwd packages/types test
```

Expected: FAIL because `reviewTaskPlanQuerySchema` and `reviewTaskPlanResponseSchema` are not exported.

- [ ] **Step 3: Add plan schemas and types**

In `packages/types/src/api/review-task.ts`, add after `reviewTaskListResponseSchema`:

```ts
export const reviewTaskPlanIntensitySchema = z.enum(['light', 'normal', 'heavy']);

export const reviewTaskPlanQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(14).default(7),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
});

export const reviewTaskPlanDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string(),
  dueCount: z.number().int().nonnegative(),
  overdueCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  estimatedMinutes: z.number().int().nonnegative(),
  intensity: reviewTaskPlanIntensitySchema,
});

export const reviewTaskPlanResponseSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedThroughDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  summary: z.object({
    overdueCount: z.number().int().nonnegative(),
    todayDueCount: z.number().int().nonnegative(),
    upcomingDueCount: z.number().int().nonnegative(),
    estimatedTotalMinutes: z.number().int().nonnegative(),
    peakDay: z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        count: z.number().int().nonnegative(),
      })
      .nullable(),
    intensity: reviewTaskPlanIntensitySchema,
  }),
  days: z.array(reviewTaskPlanDaySchema),
  suggestion: z.object({
    title: z.string(),
    description: z.string(),
    actionLabel: z.string(),
    actionHref: z.string(),
  }),
});
```

Add exports near the existing type exports:

```ts
export type ReviewTaskPlanIntensity = z.infer<typeof reviewTaskPlanIntensitySchema>;
export type ReviewTaskPlanQuery = z.infer<typeof reviewTaskPlanQuerySchema>;
export type ReviewTaskPlanDayResponse = z.infer<typeof reviewTaskPlanDaySchema>;
export type ReviewTaskPlanResponse = z.infer<typeof reviewTaskPlanResponseSchema>;
```

- [ ] **Step 4: Run contract test and verify it passes**

Run:

```powershell
bun --cwd packages/types test
```

Expected: PASS.

- [ ] **Step 5: Commit contract changes**

```powershell
git add packages/types/src/api/review-task.ts packages/types/tests/review-task.test.mts
git commit -m "feat: add review task plan contract"
```

## Task 2: Backend ReviewTask Plan API

**Files:**
- Modify: `apps/server/src/review-tasks/review-tasks.controller.ts`
- Modify: `apps/server/src/review-tasks/review-tasks.service.ts`
- Modify: `apps/server/src/review-tasks/review-tasks.service.spec.ts`
- Modify: `apps/server/test/review-tasks.e2e-spec.ts`

- [ ] **Step 1: Write failing service tests**

In `apps/server/src/review-tasks/review-tasks.service.spec.ts`, add tests inside `describe('ReviewTasksService', () => { ... })`:

```ts
it('previews a 7 day plan from card nextReview without creating future tasks', async () => {
  const overdueCard = { ...card, id: 'card_overdue', nextReview: new Date('2026-06-15T08:00:00.000Z') };
  const todayCard = { ...card, id: 'card_today', nextReview: new Date('2026-06-16T08:00:00.000Z') };
  const futureCard = { ...card, id: 'card_future', nextReview: new Date('2026-06-18T08:00:00.000Z') };
  prisma.card.findMany.mockResolvedValue([overdueCard, todayCard, futureCard]);
  prisma.reviewTask.findMany.mockResolvedValue([
    { ...task, scheduledDate: '2026-06-16', status: 'PENDING' },
  ]);

  const result = await createService().getPlan('user_1', {
    startDate: '2026-06-16',
    days: 7,
    timezoneOffsetMinutes: -480,
  });

  expect(prisma.card.findMany).toHaveBeenCalledWith({
    where: {
      userId: 'user_1',
      suspendedAt: null,
      nextReview: { lte: new Date('2026-06-22T15:59:59.999Z') },
    },
    select: { id: true, nextReview: true },
    orderBy: [{ nextReview: 'asc' }, { createdAt: 'asc' }],
    take: 500,
  });
  expect(prisma.reviewTask.createMany).not.toHaveBeenCalled();
  expect(result.startDate).toBe('2026-06-16');
  expect(result.endDate).toBe('2026-06-22');
  expect(result.summary.overdueCount).toBe(1);
  expect(result.summary.todayDueCount).toBe(1);
  expect(result.summary.upcomingDueCount).toBe(1);
  expect(result.days.find((day) => day.date === '2026-06-16')?.overdueCount).toBe(1);
  expect(result.days.find((day) => day.date === '2026-06-18')?.dueCount).toBe(1);
});

it('returns an empty plan when there are no due cards', async () => {
  prisma.card.findMany.mockResolvedValue([]);
  prisma.reviewTask.findMany.mockResolvedValue([]);

  const result = await createService().getPlan('user_1', {
    startDate: '2026-06-16',
    days: 7,
    timezoneOffsetMinutes: -480,
  });

  expect(result.summary.estimatedTotalMinutes).toBe(0);
  expect(result.summary.peakDay).toBeNull();
  expect(result.summary.intensity).toBe('light');
  expect(result.suggestion.actionHref).toBe('/error-book');
});
```

- [ ] **Step 2: Run backend service test and verify it fails**

Run:

```powershell
bun --filter @repo/server test -- review-tasks.service.spec.ts
```

Expected: FAIL because `getPlan` does not exist.

- [ ] **Step 3: Implement controller endpoint**

In `apps/server/src/review-tasks/review-tasks.controller.ts`, add import:

```ts
reviewTaskPlanQuerySchema,
```

Add method before `@Get()` list:

```ts
@Get('plan')
getPlan(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
  const input = reviewTaskPlanQuerySchema.parse(query);
  return this.reviewTasksService.getPlan(user.id, input);
}
```

- [ ] **Step 4: Implement service plan preview**

In `apps/server/src/review-tasks/review-tasks.service.ts`, extend imports:

```ts
ReviewTaskPlanIntensity,
ReviewTaskPlanQuery,
```

Add constants near `taskInclude`:

```ts
const reviewMinutesPerCard = 2;
```

Add method inside `ReviewTasksService`:

```ts
async getPlan(userId: string, input: ReviewTaskPlanQuery) {
  const window = this.resolvePlanWindow(input.startDate, input.days, input.timezoneOffsetMinutes);
  const [cards, tasks] = await Promise.all([
    this.prisma.card.findMany({
      where: {
        userId,
        suspendedAt: null,
        nextReview: { lte: window.endUtc },
      },
      select: { id: true, nextReview: true },
      orderBy: [{ nextReview: 'asc' }, { createdAt: 'asc' }],
      take: 500,
    }),
    this.prisma.reviewTask.findMany({
      where: {
        userId,
        scheduledDate: { gte: window.startDate, lte: window.endDate },
      },
      select: { scheduledDate: true, status: true },
    }),
  ]);

  const dayMap = new Map(
    window.days.map((date, index) => [
      date,
      {
        date,
        label: this.formatPlanDayLabel(index, date),
        dueCount: 0,
        overdueCount: 0,
        pendingCount: 0,
        completedCount: 0,
        skippedCount: 0,
        estimatedMinutes: 0,
        intensity: 'light' as ReviewTaskPlanIntensity,
      },
    ]),
  );

  let overdueCount = 0;
  for (const cardItem of cards) {
    if (cardItem.nextReview < window.startUtc) {
      overdueCount += 1;
      const firstDay = dayMap.get(window.startDate);
      if (firstDay) firstDay.overdueCount += 1;
      continue;
    }

    const dateKey = this.toLocalDateKey(cardItem.nextReview, window.timezoneOffsetMinutes);
    const day = dayMap.get(dateKey);
    if (day) day.dueCount += 1;
  }

  for (const taskItem of tasks) {
    const day = dayMap.get(taskItem.scheduledDate);
    if (!day) continue;
    if (taskItem.status === 'PENDING') day.pendingCount += 1;
    if (taskItem.status === 'COMPLETED') day.completedCount += 1;
    if (taskItem.status === 'SKIPPED') day.skippedCount += 1;
  }

  const days = Array.from(dayMap.values()).map((day) => {
    const totalCount = day.dueCount + day.overdueCount;
    return {
      ...day,
      estimatedMinutes: totalCount * reviewMinutesPerCard,
      intensity: this.resolvePlanIntensity(totalCount),
    };
  });

  const today = days[0];
  const upcomingDueCount = days.slice(1).reduce((sum, day) => sum + day.dueCount, 0);
  const peakDay = days.reduce<{ date: string; count: number } | null>((peak, day) => {
    const count = day.dueCount + day.overdueCount;
    if (count === 0) return peak;
    if (!peak || count > peak.count) return { date: day.date, count };
    return peak;
  }, null);
  const estimatedTotalMinutes = days.reduce((sum, day) => sum + day.estimatedMinutes, 0);

  return {
    startDate: window.startDate,
    endDate: window.endDate,
    generatedThroughDate: window.endDate,
    summary: {
      overdueCount,
      todayDueCount: today?.dueCount ?? 0,
      upcomingDueCount,
      estimatedTotalMinutes,
      peakDay,
      intensity: this.resolvePlanIntensity(peakDay?.count ?? 0),
    },
    days,
    suggestion: this.buildPlanSuggestion({
      overdueCount,
      todayDueCount: today?.dueCount ?? 0,
      upcomingDueCount,
      peakDay,
    }),
  };
}
```

Add private helpers before `resolveDateWindow()`:

```ts
private resolvePlanWindow(
  startDate: string | undefined,
  daysCount: number,
  timezoneOffsetMinutes: number,
) {
  const first = this.resolveDateWindow(startDate, timezoneOffsetMinutes);
  const days = Array.from({ length: daysCount }, (_, index) =>
    this.addDays(first.dateKey, index),
  );
  const endDate = days[days.length - 1] ?? first.dateKey;
  const end = this.resolveDateWindow(endDate, timezoneOffsetMinutes);

  return {
    startDate: first.dateKey,
    endDate,
    startUtc: first.startUtc,
    endUtc: end.endUtc,
    timezoneOffsetMinutes,
    days,
  };
}

private addDays(dateKey: string, days: number) {
  const value = new Date(`${dateKey}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

private toLocalDateKey(value: Date, timezoneOffsetMinutes: number) {
  return new Date(value.getTime() - timezoneOffsetMinutes * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

private formatPlanDayLabel(index: number, dateKey: string) {
  if (index === 0) return '今天';
  if (index === 1) return '明天';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

private resolvePlanIntensity(count: number): ReviewTaskPlanIntensity {
  if (count >= 16) return 'heavy';
  if (count >= 6) return 'normal';
  return 'light';
}

private buildPlanSuggestion(input: {
  overdueCount: number;
  todayDueCount: number;
  upcomingDueCount: number;
  peakDay: { date: string; count: number } | null;
}) {
  if (input.overdueCount > 0) {
    return {
      title: '先处理逾期卡',
      description: `今天先完成 ${input.overdueCount} 张逾期卡，再进入正常复习节奏。`,
      actionLabel: '去今日任务',
      actionHref: '/today',
    };
  }

  if (input.todayDueCount > 0) {
    return {
      title: '今天保持节奏',
      description: `今天有 ${input.todayDueCount} 张到期卡，完成后统计页会同步更新。`,
      actionLabel: '去今日任务',
      actionHref: '/today',
    };
  }

  if (input.upcomingDueCount > 0 && input.peakDay) {
    return {
      title: '提前看一下高峰日',
      description: `${input.peakDay.date} 预计 ${input.peakDay.count} 张，可以提前留出复习时间。`,
      actionLabel: '查看错题本',
      actionHref: '/error-book',
    };
  }

  return {
    title: '当前复习压力很轻',
    description: '暂时没有到期卡，可以从错题本挑选重要题目加入复习。',
    actionLabel: '去错题本',
    actionHref: '/error-book',
  };
}
```

- [ ] **Step 5: Run service tests**

Run:

```powershell
bun --filter @repo/server test -- review-tasks.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Add e2e coverage**

In `apps/server/test/review-tasks.e2e-spec.ts`, add authenticated tests matching existing helper style:

```ts
it('returns the current user review task plan', async () => {
  const token = await registerAndLogin(app, 'plan-user@example.com');
  await createWrongQuestionAndReviewCard(app, token);

  const response = await request(app.getHttpServer())
    .get('/review-tasks/plan?days=7&startDate=2026-06-16&timezoneOffsetMinutes=-480')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data.startDate).toBe('2026-06-16');
  expect(response.body.data.days).toHaveLength(7);
});

it('rejects invalid review task plan ranges', async () => {
  const token = await registerAndLogin(app, 'plan-invalid@example.com');

  await request(app.getHttpServer())
    .get('/review-tasks/plan?days=15&timezoneOffsetMinutes=-480')
    .set('Authorization', `Bearer ${token}`)
    .expect(400);
});
```

Also import `reviewTaskPlanResponseSchema` from `@repo/types/api/review-task` in that e2e file:

```ts
import {
  reviewTaskActionResponseSchema,
  reviewTaskPlanResponseSchema,
  reviewTaskRatingResponseSchema,
  reviewTaskTodayResponseSchema,
} from '@repo/types/api/review-task';
```

The e2e file already contains `registerAndLogin(label)`, `createWrongQuestion(accessToken, payload)`, `server`, `prisma`, and `getSuccessData(response)`. Use those exact helpers for the new tests.

- [ ] **Step 7: Run backend e2e**

Run with Docker PostgreSQL running:

```powershell
$env:POSTGRES_PORT='5433'
bun --filter @repo/server test:e2e -- review-tasks.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit backend API**

```powershell
git add apps/server/src/review-tasks/review-tasks.controller.ts apps/server/src/review-tasks/review-tasks.service.ts apps/server/src/review-tasks/review-tasks.service.spec.ts apps/server/test/review-tasks.e2e-spec.ts
git commit -m "feat: add review task plan api"
```

## Task 3: Frontend Plan API, Hook, And View Helpers

**Files:**
- Modify: `apps/web/src/lib/review-task-api.ts`
- Modify: `apps/web/src/lib/review-task-api.test.mts`
- Modify: `apps/web/src/hooks/use-review-tasks.ts`
- Create: `apps/web/src/lib/review-plan-view.ts`
- Create: `apps/web/src/lib/review-plan-view.test.mts`

- [ ] **Step 1: Write failing API and helper tests**

In `apps/web/src/lib/review-task-api.test.mts`, call `testReadsPlan()` from `run()` and add:

```ts
async function testReadsPlan() {
  const requests: CapturedRequest[] = [];
  const reviewTaskApi = createReviewTaskApi(
    createTestClient(requests, {
      startDate: '2026-06-16',
      endDate: '2026-06-22',
      generatedThroughDate: '2026-06-22',
      summary: {
        overdueCount: 1,
        todayDueCount: 2,
        upcomingDueCount: 3,
        estimatedTotalMinutes: 12,
        peakDay: { date: '2026-06-18', count: 3 },
        intensity: 'normal',
      },
      days: [
        {
          date: '2026-06-16',
          label: '今天',
          dueCount: 2,
          overdueCount: 1,
          pendingCount: 1,
          completedCount: 0,
          skippedCount: 0,
          estimatedMinutes: 4,
          intensity: 'light',
        },
      ],
      suggestion: {
        title: '先处理逾期卡',
        description: '今天先完成 1 张逾期卡，再进入正常复习节奏。',
        actionLabel: '去今日任务',
        actionHref: '/today',
      },
    }),
  );

  const result = await reviewTaskApi.getPlan('token_1', {
    startDate: '2026-06-16',
    days: 7,
    timezoneOffsetMinutes: -480,
  });

  assert.equal(
    requests[0].input,
    'http://localhost:3001/review-tasks/plan?days=7&startDate=2026-06-16&timezoneOffsetMinutes=-480',
  );
  assert.equal(result.summary.overdueCount, 1);
}
```

Create `apps/web/src/lib/review-plan-view.test.mts`:

```ts
import assert from 'node:assert/strict';

import {
  buildPlanBarOption,
  getPlanIntensityLabel,
  shouldShowPlanEmptyState,
} from './review-plan-view.ts';

function run() {
  testIntensityLabels();
  testEmptyState();
  testPlanChartOption();
}

function testIntensityLabels() {
  assert.equal(getPlanIntensityLabel('light'), '轻松');
  assert.equal(getPlanIntensityLabel('normal'), '正常');
  assert.equal(getPlanIntensityLabel('heavy'), '偏重');
}

function testEmptyState() {
  assert.equal(shouldShowPlanEmptyState(0, 0, 0), true);
  assert.equal(shouldShowPlanEmptyState(1, 0, 0), false);
}

function testPlanChartOption() {
  const option = buildPlanBarOption([
    {
      date: '2026-06-16',
      label: '今天',
      dueCount: 2,
      overdueCount: 1,
      pendingCount: 1,
      completedCount: 0,
      skippedCount: 0,
      estimatedMinutes: 6,
      intensity: 'light',
    },
  ]);

  assert.deepEqual(option.xAxis.data, ['今天']);
  assert.deepEqual(option.series[0].data, [3]);
}

run();
```

- [ ] **Step 2: Run web tests and verify failures**

Run:

```powershell
bun --filter @repo/web test
```

Expected: FAIL because `getPlan()` and `review-plan-view.ts` do not exist.

- [ ] **Step 3: Implement frontend API and hook**

In `apps/web/src/lib/review-task-api.ts`, import:

```ts
reviewTaskPlanResponseSchema,
type ReviewTaskPlanQuery,
```

Add method before `list()`:

```ts
async getPlan(accessToken: string, query: ReviewTaskPlanQuery) {
  const params = new URLSearchParams();
  params.set('days', String(query.days));
  if (query.startDate) {
    params.set('startDate', query.startDate);
  }
  params.set('timezoneOffsetMinutes', String(query.timezoneOffsetMinutes));

  return reviewTaskPlanResponseSchema.parse(
    await client.get<unknown>(`/review-tasks/plan?${params.toString()}`, {
      accessToken,
    }),
  );
},
```

In `apps/web/src/hooks/use-review-tasks.ts`, import `ReviewTaskPlanQuery` and add:

```ts
plan: (query: ReviewTaskPlanQuery) =>
  [...reviewTaskQueryKeys.all, 'plan', query] as const,
```

Add hook:

```ts
export function useReviewTaskPlan(query: ReviewTaskPlanQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewTaskQueryKeys.plan(query),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewTaskApi.getPlan(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}
```

- [ ] **Step 4: Implement plan helpers**

Create `apps/web/src/lib/review-plan-view.ts`:

```ts
import type {
  ReviewTaskPlanDayResponse,
  ReviewTaskPlanIntensity,
} from '@repo/types/api/review-task';

export function getPlanIntensityLabel(intensity: ReviewTaskPlanIntensity) {
  if (intensity === 'heavy') return '偏重';
  if (intensity === 'normal') return '正常';
  return '轻松';
}

export function getPlanIntensityClassName(intensity: ReviewTaskPlanIntensity) {
  if (intensity === 'heavy') return 'bg-[#fff2e5] text-[#9b5a1c] ring-[#f2d0aa]';
  if (intensity === 'normal') return 'bg-[#eef7ff] text-[#315f86] ring-[#cfe5f8]';
  return 'bg-[#eafff9] text-[#247269] ring-[#bdeee5]';
}

export function shouldShowPlanEmptyState(
  overdueCount: number,
  todayDueCount: number,
  upcomingDueCount: number,
) {
  return overdueCount + todayDueCount + upcomingDueCount === 0;
}

export function buildPlanBarOption(days: ReviewTaskPlanDayResponse[]) {
  return {
    animationDuration: 420,
    grid: { left: 8, right: 8, top: 24, bottom: 24, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (items: Array<{ name: string; value: number }>) => {
        const item = items[0];
        return item ? `${item.name}<br/>预计复习 ${item.value} 张` : '';
      },
    },
    xAxis: {
      type: 'category',
      data: days.map((day) => day.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dce9e4' } },
      axisLabel: { color: '#75837d', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#edf4f0', type: 'dashed' } },
      axisLabel: { color: '#75837d', fontSize: 11 },
    },
    series: [
      {
        name: '预计复习',
        type: 'bar',
        barWidth: '42%',
        data: days.map((day) => day.dueCount + day.overdueCount),
        itemStyle: {
          borderRadius: [8, 8, 4, 4],
          color: '#78d6c8',
        },
      },
    ],
  };
}
```

- [ ] **Step 5: Run web tests**

Run:

```powershell
bun --filter @repo/web test
```

Expected: PASS.

- [ ] **Step 6: Commit frontend data layer**

```powershell
git add apps/web/src/lib/review-task-api.ts apps/web/src/lib/review-task-api.test.mts apps/web/src/hooks/use-review-tasks.ts apps/web/src/lib/review-plan-view.ts apps/web/src/lib/review-plan-view.test.mts
git commit -m "feat: add review plan frontend data layer"
```

## Task 4: ECharts Base Component And Stats Options

**Files:**
- Modify: `apps/web/package.json`
- Modify: `bun.lock`
- Create: `apps/web/src/components/charts/base-echart.tsx`
- Create: `apps/web/src/lib/review-chart-options.ts`
- Create: `apps/web/src/lib/review-chart-options.test.mts`

- [ ] **Step 1: Add ECharts dependency**

Run:

```powershell
bun add --filter @repo/web echarts
```

Expected: `apps/web/package.json` contains `echarts`, and `bun.lock` is updated.

- [ ] **Step 2: Write failing chart option tests**

Create `apps/web/src/lib/review-chart-options.test.mts`:

```ts
import assert from 'node:assert/strict';

import {
  buildRatingDistributionOption,
  buildReviewTrendOption,
  buildStateDistributionOption,
} from './review-chart-options.ts';

function run() {
  testTrendOption();
  testRatingDistributionOption();
  testStateDistributionOption();
}

function testTrendOption() {
  const option = buildReviewTrendOption([
    { date: '2026-06-15', count: 1 },
    { date: '2026-06-16', count: 3 },
  ]);

  assert.deepEqual(option.xAxis.data, ['06-15', '06-16']);
  assert.deepEqual(option.series[0].data, [1, 3]);
}

function testRatingDistributionOption() {
  const option = buildRatingDistributionOption({
    again: 1,
    hard: 2,
    good: 3,
    easy: 4,
  });

  assert.equal(option.series[0].type, 'pie');
  assert.equal(option.series[0].data.length, 4);
}

function testStateDistributionOption() {
  const option = buildStateDistributionOption({
    NEW: 1,
    LEARNING: 2,
    REVIEW: 3,
    RELEARNING: 4,
  });

  assert.equal(option.series[0].type, 'pie');
  assert.equal(option.series[0].data[0].name, '新卡');
}

run();
```

- [ ] **Step 3: Run web tests and verify chart option failure**

Run:

```powershell
bun --filter @repo/web test
```

Expected: FAIL because `review-chart-options.ts` does not exist.

- [ ] **Step 4: Create ECharts option builders**

Create `apps/web/src/lib/review-chart-options.ts`:

```ts
import type { ReviewStatsResponse } from '@repo/types/api/review';

export function buildReviewTrendOption(items: Array<{ date: string; count: number }>) {
  return {
    animationDuration: 420,
    grid: { left: 8, right: 10, top: 24, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: items.map((item) => item.date.slice(5)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dce9e4' } },
      axisLabel: { color: '#75837d', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#edf4f0', type: 'dashed' } },
      axisLabel: { color: '#75837d', fontSize: 11 },
    },
    series: [
      {
        name: '复习次数',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: items.map((item) => item.count),
        lineStyle: { width: 2, color: '#64c8bd' },
        itemStyle: { color: '#64c8bd' },
        areaStyle: { color: 'rgba(120, 214, 200, 0.18)' },
      },
    ],
  };
}

export function buildRatingDistributionOption(
  ratingCounts: ReviewStatsResponse['ratingCounts'],
) {
  return {
    animationDuration: 420,
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, icon: 'circle', textStyle: { color: '#75837d', fontSize: 11 } },
    series: [
      {
        name: '评分',
        type: 'pie',
        radius: ['48%', '70%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        label: { color: '#5b6863', fontSize: 11 },
        data: [
          { name: '重来', value: ratingCounts.again, itemStyle: { color: '#f2a77f' } },
          { name: '困难', value: ratingCounts.hard, itemStyle: { color: '#f4cf72' } },
          { name: '掌握', value: ratingCounts.good, itemStyle: { color: '#78d6c8' } },
          { name: '轻松', value: ratingCounts.easy, itemStyle: { color: '#8ebff0' } },
        ],
      },
    ],
  };
}

export function buildStateDistributionOption(stateCounts: ReviewStatsResponse['stateCounts']) {
  return {
    animationDuration: 420,
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, icon: 'circle', textStyle: { color: '#75837d', fontSize: 11 } },
    series: [
      {
        name: '卡片状态',
        type: 'pie',
        radius: ['48%', '70%'],
        center: ['50%', '44%'],
        label: { color: '#5b6863', fontSize: 11 },
        data: [
          { name: '新卡', value: stateCounts.NEW, itemStyle: { color: '#8ebff0' } },
          { name: '学习中', value: stateCounts.LEARNING, itemStyle: { color: '#f4cf72' } },
          { name: '复习中', value: stateCounts.REVIEW, itemStyle: { color: '#78d6c8' } },
          { name: '重学中', value: stateCounts.RELEARNING, itemStyle: { color: '#c7b7ff' } },
        ],
      },
    ],
  };
}
```

- [ ] **Step 5: Create client-only chart component**

Create `apps/web/src/components/charts/base-echart.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

type BaseEChartProps = {
  option: object;
  className?: string;
  ariaLabel: string;
};

export default function BaseEChart({ option, className, ariaLabel }: BaseEChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let chart: { setOption: (option: object, notMerge?: boolean) => void; resize: () => void; dispose: () => void } | null = null;

    async function mount() {
      if (!containerRef.current) return;

      try {
        const echarts = await import('echarts');
        if (disposed || !containerRef.current) return;
        chart = echarts.init(containerRef.current);
        chart.setOption(option, true);
        resizeObserver = new ResizeObserver(() => chart?.resize());
        resizeObserver.observe(containerRef.current);
      } catch {
        if (!disposed) setFailed(true);
      }
    }

    void mount();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      chart?.dispose();
    };
  }, [option]);

  if (failed) {
    return (
      <div className={className} role="img" aria-label={ariaLabel}>
        <div className="flex h-full min-h-40 items-center justify-center rounded-2xl bg-white/70 text-xs font-semibold text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
          图表加载失败，数据仍可在下方查看
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={className} role="img" aria-label={ariaLabel} />;
}
```

- [ ] **Step 6: Run web tests and build type check via lint**

Run:

```powershell
bun --filter @repo/web test
bun --filter @repo/web lint
```

Expected: PASS.

- [ ] **Step 7: Commit chart infrastructure**

```powershell
git add apps/web/package.json bun.lock apps/web/src/components/charts/base-echart.tsx apps/web/src/lib/review-chart-options.ts apps/web/src/lib/review-chart-options.test.mts
git commit -m "feat: add review chart infrastructure"
```

## Task 5: `/plan` Page And Navigation

**Files:**
- Create: `apps/web/src/app/(main)/plan/page.tsx`
- Modify: `apps/web/src/app/(main)/today/page.tsx`
- Modify: `apps/web/src/components/chat/chat-sidebar.tsx`

- [ ] **Step 1: Implement `/plan` page**

Create `apps/web/src/app/(main)/plan/page.tsx` with these imports and structure:

```tsx
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarDays,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

import BaseEChart from '@/components/charts/base-echart';
import { useReviewTaskPendingRatings } from '@/hooks/use-review-task-pending-ratings';
import { useReviewTaskPlan } from '@/hooks/use-review-tasks';
import {
  buildPlanBarOption,
  getPlanIntensityClassName,
  getPlanIntensityLabel,
  shouldShowPlanEmptyState,
} from '@/lib/review-plan-view';
import { getLocalDateKey } from '@/lib/today-tasks';
import { useUserStore } from '@/stores/userStore';

export default function PlanPage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const userId = currentUser?.id ?? '';
  const startDate = useMemo(() => getLocalDateKey(), []);
  const timezoneOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);
  const planQuery = useReviewTaskPlan({ startDate, days: 7, timezoneOffsetMinutes });
  const { pendingCount: pendingSyncCount } = useReviewTaskPendingRatings(userId);
  const plan = planQuery.data;
  const empty =
    plan &&
    shouldShowPlanEmptyState(
      plan.summary.overdueCount,
      plan.summary.todayDueCount,
      plan.summary.upcomingDueCount,
    );

  return (
    <div className="pm-anime-bg min-h-[100dvh] text-[var(--pm-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--pm-line)] bg-white/75 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link href="/chat" aria-label="返回聊天" className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-[#eafff9] active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--pm-muted)]">Review plan</p>
            <h1 className="text-lg font-semibold leading-tight">复习计划</h1>
            <p className="mt-0.5 text-xs text-[var(--pm-muted)]">未来 7 天的复习压力预览</p>
          </div>
          <div className="pm-mascot-float flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eafff9] text-[#247269] ring-1 ring-[#bdeee5]">
            <CalendarDays className="h-5 w-5" />
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-3xl">
        {planQuery.isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-3 text-sm text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在读取复习计划...
          </div>
        ) : planQuery.isError ? (
          <section className="rounded-2xl bg-red-50/85 px-3 py-3 text-sm leading-6 text-red-600 ring-1 ring-red-100">
            <p>复习计划读取失败，请稍后刷新重试。</p>
            <button type="button" onClick={() => void planQuery.refetch()} className="tap-target mt-2 inline-flex min-h-9 items-center justify-center rounded-xl bg-white px-3 text-xs font-bold text-red-600 ring-1 ring-red-100">
              重新读取
            </button>
          </section>
        ) : plan ? (
          <>
            <section className="pm-glass-card pm-enter rounded-[1.6rem] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[var(--pm-muted)]">未来 7 天预计</p>
                  <p className="mt-1 text-3xl font-black leading-none text-[var(--pm-ink)]">
                    {plan.summary.overdueCount + plan.summary.todayDueCount + plan.summary.upcomingDueCount}
                    <span className="ml-1 text-sm font-bold text-[var(--pm-muted)]">张</span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--pm-muted)]">预计 {plan.summary.estimatedTotalMinutes} 分钟</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${getPlanIntensityClassName(plan.summary.intensity)}`}>
                  {getPlanIntensityLabel(plan.summary.intensity)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <PlanMiniStat label="已逾期" value={`${plan.summary.overdueCount} 张`} />
                <PlanMiniStat label="今日到期" value={`${plan.summary.todayDueCount} 张`} />
                <PlanMiniStat label="未来到期" value={`${plan.summary.upcomingDueCount} 张`} />
                <PlanMiniStat label="待同步" value={`${pendingSyncCount} 条`} />
              </div>
            </section>

            {empty ? <PlanEmpty /> : (
              <>
                <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
                  <SectionTitle icon={BarChart3} title="7 日压力" subtitle={`${plan.startDate} 到 ${plan.endDate}`} />
                  <BaseEChart option={buildPlanBarOption(plan.days)} className="mt-3 h-56 w-full" ariaLabel="未来 7 天复习压力柱状图" />
                </section>
                <section className="mt-4 space-y-3">
                  {plan.days.map((day) => (
                    <article key={day.date} className="pm-glass-card pm-enter rounded-[1.35rem] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{day.label}</p>
                          <p className="mt-1 text-xs text-[var(--pm-muted)]">{day.date} · 预计 {day.estimatedMinutes} 分钟</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${getPlanIntensityClassName(day.intensity)}`}>
                          {getPlanIntensityLabel(day.intensity)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--pm-line)] pt-3">
                        <span className="text-xs font-semibold text-[var(--pm-muted)]">
                          {day.dueCount + day.overdueCount} 张预计复习
                        </span>
                        <Link href="/today" className="tap-target inline-flex min-h-9 items-center justify-center rounded-xl bg-white/75 px-3 text-xs font-bold text-[#247269] ring-1 ring-[var(--pm-line)]">
                          {day.date === plan.startDate ? '去处理' : '查看今日'}
                        </Link>
                      </div>
                    </article>
                  ))}
                </section>
              </>
            )}

            <section className="mt-4 rounded-[1.35rem] border border-[#bdeee5] bg-[#eafff9]/75 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/75 text-[#247269] ring-1 ring-[#bdeee5]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{plan.suggestion.title}</p>
                  <p className="mt-1 text-xs leading-5 text-[#4f6963]">{plan.suggestion.description}</p>
                  <Link href={plan.suggestion.actionHref} className="tap-target mt-3 inline-flex min-h-10 items-center justify-center rounded-2xl bg-[#2b2335] px-3 text-xs font-semibold text-white">
                    {plan.suggestion.actionLabel}
                  </Link>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
```

Add local helper components in the same file:

```tsx
function PlanMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/60 px-3 py-2 ring-1 ring-[var(--pm-line)]">
      <p className="text-[11px] font-medium text-[var(--pm-muted)]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[var(--pm-ink)]">{value}</p>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof CalendarDays;
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

function PlanEmpty() {
  return (
    <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-5 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-3xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
        <RotateCcw className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-base font-semibold">未来几天很轻松</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--pm-muted)]">
        当前没有明显复习压力，可以从错题本挑选重要题目加入复习。
      </p>
      <Link href="/error-book" className="tap-target mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white">
        <BookOpen className="h-4 w-4" />
        去错题本
      </Link>
    </section>
  );
}
```

- [ ] **Step 2: Add navigation entries**

In `apps/web/src/components/chat/chat-sidebar.tsx`, import `CalendarClock` from `lucide-react`, then insert after `/today`:

```ts
{ href: '/plan', label: '复习计划', hint: '未来到期与复习压力', icon: CalendarClock },
```

In `apps/web/src/app/(main)/today/page.tsx`, import `CalendarClock`, then add a bottom quick action next to stats:

```tsx
<Link
  href="/plan"
  className="tap-target flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/75 text-sm font-semibold text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-[0.98]"
>
  <CalendarClock className="h-4 w-4" />
  复习计划
</Link>
```

If the existing bottom grid is `sm:grid-cols-3`, change it to `sm:grid-cols-4`.

- [ ] **Step 3: Run frontend checks**

Run:

```powershell
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: PASS.

- [ ] **Step 4: Commit plan page**

```powershell
git add "apps/web/src/app/(main)/plan/page.tsx" "apps/web/src/app/(main)/today/page.tsx" apps/web/src/components/chat/chat-sidebar.tsx
git commit -m "feat: add review plan page"
```

## Task 6: `/stats` ECharts Redesign

**Files:**
- Modify: `apps/web/src/app/(main)/stats/page.tsx`

- [ ] **Step 1: Replace custom chart usage**

In `apps/web/src/app/(main)/stats/page.tsx`, add imports:

```ts
import BaseEChart from '@/components/charts/base-echart';
import {
  buildRatingDistributionOption,
  buildReviewTrendOption,
  buildStateDistributionOption,
} from '@/lib/review-chart-options';
```

Remove `ReviewTrendChart`, `buildSmoothPath`, and `DistributionRow` from the file after the JSX no longer references them.

Replace the trend chart call with:

```tsx
<BaseEChart
  option={buildReviewTrendOption(dailyReviews)}
  className="mt-4 h-56 w-full"
  ariaLabel="复习趋势折线图"
/>
```

Replace rating distribution rows with:

```tsx
<BaseEChart
  option={buildRatingDistributionOption(stats?.ratingCounts ?? {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  })}
  className="mt-3 h-64 w-full"
  ariaLabel="评分分布环形图"
/>
```

Replace or augment card state grid with:

```tsx
<BaseEChart
  option={buildStateDistributionOption(stats?.stateCounts ?? {
    NEW: 0,
    LEARNING: 0,
    REVIEW: 0,
    RELEARNING: 0,
  })}
  className="mt-3 h-64 w-full"
  ariaLabel="卡片状态分布环形图"
/>
```

Keep recent logs list and pagination behavior unchanged.

- [ ] **Step 2: Run frontend tests and build**

Run:

```powershell
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: PASS.

- [ ] **Step 3: Commit stats redesign**

```powershell
git add "apps/web/src/app/(main)/stats/page.tsx"
git commit -m "feat: upgrade review stats charts"
```

## Task 7: Full Verification And Browser QA

**Files:**
- No planned source edits unless verification exposes defects.

- [ ] **Step 1: Run full automated checks**

Run:

```powershell
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
bun --filter @repo/server test
bun --filter @repo/server lint
bun --filter @repo/server build
bun --cwd packages/types typecheck
bun --cwd packages/types test
bun --cwd packages/database test
bun --cwd packages/fsrs test
```

Expected: all PASS.

- [ ] **Step 2: Run backend e2e with Docker services**

Run:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
bun --filter @repo/server test:e2e
```

Expected: PASS.

- [ ] **Step 3: Start local project for browser validation**

Run server:

```powershell
$env:POSTGRES_PORT='5433'
bun --filter @repo/server start:dev
```

Run web in another terminal:

```powershell
bun --filter @repo/web dev
```

Expected: web app opens on the printed localhost port, server listens on `localhost:3001`.

- [ ] **Step 4: Browser validation checklist**

Validate with Playwright or manual browser:

```text
1. Login succeeds.
2. Sidebar contains "复习计划".
3. /plan loads without hydration error.
4. /plan chart canvas is nonblank.
5. /plan mobile viewport 390x844 has no horizontal overflow or text overlap.
6. /stats trend, rating, and card-state charts render.
7. Switching 7 天 / 30 天 on /stats updates trend chart.
8. /today still reads review tasks and rating buttons still work.
9. If a pending offline rating exists, /plan summary displays the pending sync count.
```

- [ ] **Step 5: Fix defects if verification exposes them**

If browser validation exposes a defect, return to the task that owns that file, update only the relevant source and test files, rerun that task's verification command, and commit with one of these focused messages:

```powershell
git commit -m "fix: stabilize review plan page"
git commit -m "fix: stabilize review stats charts"
git commit -m "fix: stabilize review task plan api"
```

## Task 8: Documentation, Devlog, Blog, And Final Commit

**Files:**
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `DEVLOG.md`
- Create: `docs/dev-blog/2026-06-16-phase-4-5-review-plan-and-echarts.md`

- [ ] **Step 1: Update data flow and roadmap**

In `docs/data-flow.md`, add Phase 4.5.1 facts:

```text
Review plan: /review-tasks/plan provides a read-only future review pressure preview from Card.nextReview. It does not create future ReviewTask rows; /review-tasks/today remains the execution entry and lazy generator for today's tasks.
Stats charts: /stats uses client-only ECharts components for visualization while keeping /reviews/stats and /reviews/logs as the server-side statistics sources.
```

In `docs/roadmap.md`, mark Phase 4.5.1 complete under Phase 4 and keep Phase 4.5.2 as reminder strategy follow-up.

- [ ] **Step 2: Update root collaboration docs**

Update `AGENTS.md`, `CLAUDE.md`, and `README.md` with:

```text
Phase 4.5.1 已完成：新增 /plan 复习计划页、/review-tasks/plan 计划预览 API，并用 ECharts 优化 /stats。未来计划仅预览 Card.nextReview，不提前生成未来 ReviewTask。
```

- [ ] **Step 3: Update DEVLOG**

In `DEVLOG.md`, add a single 2026-06-16 entry with all work for the day grouped together. Keep todos and planning at the bottom of the entry.

Use this structure:

```md
## 2026-06-16

### Phase 4.5.1 复习计划与统计图表

- 新增 `/review-tasks/plan` 只读计划预览 API。
- 新增 `/plan` 复习计划页。
- `/stats` 改用 client-only ECharts 展示趋势、评分分布和卡片状态。
- 保持未来 ReviewTask 不提前生成，今日任务仍由 `/review-tasks/today` 执行。

### 验证

- `bun --filter @repo/web test`
- `bun --filter @repo/web lint`
- `bun --filter @repo/web build`
- `bun --filter @repo/server test`
- `bun --filter @repo/server test:e2e`
- `bun --filter @repo/server lint`
- `bun --filter @repo/server build`
- `bun --cwd packages/types typecheck`
- `bun --cwd packages/types test`
- `bun --cwd packages/database test`
- `bun --cwd packages/fsrs test`

### 待办

- Phase 4.5.2：复习提醒策略增强。
- Phase 5：RAG 知识库与 pgvector 检索。
```

- [ ] **Step 4: Add detailed development blog**

Create `docs/dev-blog/2026-06-16-phase-4-5-review-plan-and-echarts.md` with these sections:

```md
# Phase 4.5.1：从今日复习到长期计划，顺手把统计页做成真正可展示的图表页

## 背景

## 为什么未来计划不能提前生成 ReviewTask

## /review-tasks/plan 的数据口径

## /plan 页面如何承接今日任务

## 为什么这次引入 ECharts

## Next.js 中如何避免 ECharts hydration 问题

## /stats 的展示升级但统计口径不变

## 验证和踩坑

## 下一步
```

Use these concrete section points:

```md
## 背景

- Phase 4.4 已有今日任务、离线评分队列和提醒摘要。
- 用户缺少未来 7 天复习压力预览，统计页也需要更适合展示。

## 为什么未来计划不能提前生成 ReviewTask

- ReviewTask 是执行层任务，不是长期预测表。
- 用户今天评分会改变 Card.nextReview，提前生成未来任务会变脏。
- Phase 4.5.1 只读 Card.nextReview 作为计划预览。

## /review-tasks/plan 的数据口径

- overdue 来自 startDate 之前到期的未暂停 Card。
- today 来自 startDate 当天到期的未暂停 Card。
- upcoming 来自窗口内未来日期到期的未暂停 Card。
- 已存在 ReviewTask 只用于显示 pending/completed/skipped 状态。

## /plan 页面如何承接今日任务

- /plan 展示未来压力和建议。
- /today 继续负责执行、评分、跳过、恢复和离线评分待同步。

## 为什么这次引入 ECharts

- 原手绘图表可维护但表现力有限。
- ECharts 提升趋势、评分分布和状态分布的可读性。

## Next.js 中如何避免 ECharts hydration 问题

- 图表组件 client-only。
- useEffect 动态 import('echarts')。
- ResizeObserver 负责 resize。
- unmount 时 dispose。

## /stats 的展示升级但统计口径不变

- /reviews/stats 和 /reviews/logs 仍是唯一统计来源。
- ReviewLog 仍是复习事实来源。

## 验证和踩坑

- 写入实际运行过的测试、build、e2e 和浏览器验收结果。
- 记录 ECharts SSR、移动端布局或日期口径相关问题。

## 下一步

- Phase 4.5.2 做提醒策略增强。
- Phase 5 进入 RAG 知识库。
```

Do not mention résumé work.

- [ ] **Step 5: Run final doc diff and whitespace check**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only intended docs and implementation files changed.

- [ ] **Step 6: Commit closeout docs**

```powershell
git add docs/data-flow.md docs/roadmap.md AGENTS.md CLAUDE.md README.md DEVLOG.md docs/dev-blog/2026-06-16-phase-4-5-review-plan-and-echarts.md
git commit -m "docs: close phase 4.5 plan and stats"
```

## Final Integration

- [ ] **Step 1: Confirm branch state**

```powershell
git status --short --branch
git log --oneline -5
```

Expected: clean worktree and latest commits show Task 1 through closeout docs.

- [ ] **Step 2: Stop local dev processes**

Stop any `next dev`, `nest start --watch`, or related project processes started for validation.

- [ ] **Step 3: Report final status**

Final report must include:

```text
- Implemented /plan and /review-tasks/plan.
- Upgraded /stats with ECharts.
- Confirmed future plan preview does not create future ReviewTask rows.
- Listed exact tests/build/e2e/browser checks run.
- Listed final commit hashes.
```
