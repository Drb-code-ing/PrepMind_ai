# Phase 4.5.2 Review Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build account-level review preferences, upgrade `/review-tasks/plan` from count-only pressure to capacity-aware planning, and surface actionable plan guidance in `/plan` and `/today`.

**Architecture:** PostgreSQL remains the authority for review cards, logs, tasks, and new review preferences. `/review-tasks/plan` stays read-only and continues to derive future workload from `Card.nextReview`; it gains user preference and weighted pressure fields without creating future `ReviewTask` rows.

**Tech Stack:** Bun workspace, NestJS 11, Prisma, PostgreSQL, Zod contracts in `@repo/types`, Next.js 16, React 19, TanStack Query, Tailwind 4, Dexie as offline fallback for existing queued writes only.

---

## Scope

Phase 4.5.2 should ship in three independently testable slices:

1. **4.5.2-A ReviewPreference:** persist review planning preferences on the server and expose authenticated API + frontend hooks.
2. **4.5.2-B Weighted Plan:** use preferences and card metadata to calculate capacity-aware pressure in `/review-tasks/plan`.
3. **4.5.2-C Plan UI Guidance:** upgrade `/plan` and the today reminder summary so users can see why a day is heavy and what to do next.

Out of scope for this phase:

- Browser Notification API.
- Email, SMS, or push reminders.
- BullMQ scheduled reminders.
- Creating future `ReviewTask` rows before their local date arrives.
- Replacing the current lightweight FSRS implementation.

## File Map

Create:

- `packages/database/prisma/migrations/<timestamp>_add_review_preferences/migration.sql`  
  Adds the `ReviewPreference` table.
- `packages/types/src/api/review-preference.ts`  
  Shared request/response schemas for preferences.
- `apps/server/src/review-preferences/review-preferences.controller.ts`  
  Authenticated GET/PATCH endpoints.
- `apps/server/src/review-preferences/review-preferences.service.ts`  
  Preference defaults, normalization, upsert logic.
- `apps/server/src/review-preferences/review-preferences.module.ts`  
  Nest module wiring.
- `apps/server/src/review-preferences/review-preferences.service.spec.ts`  
  Unit tests for defaults, patching, and user isolation.
- `apps/web/src/lib/review-preference-api.ts`  
  Frontend API client wrapper.
- `apps/web/src/lib/review-preference-view.ts`  
  Pure helpers for labels, capacity status copy, and preference form normalization.
- `apps/web/src/lib/review-preference-view.test.mts`  
  Frontend helper tests.

Modify:

- `packages/database/prisma/schema.prisma`  
  Add `ReviewPreference` model and `User.reviewPreference` relation.
- `packages/types/src/api/index.ts`  
  Export review preference API contracts.
- `packages/types/src/api/review-task.ts`  
  Extend plan response with weighted pressure fields.
- `apps/server/src/app.module.ts`  
  Register `ReviewPreferencesModule`.
- `apps/server/src/review-tasks/review-tasks.service.ts`  
  Load review preferences and calculate weighted plan output.
- `apps/server/src/review-tasks/review-tasks.service.spec.ts`  
  Add weighted pressure and capacity tests.
- `apps/server/src/review-tasks/review-tasks.controller.ts`  
  No route changes expected; keep `/review-tasks/plan` read-only.
- `apps/web/src/hooks/use-review-tasks.ts`  
  Add preference query/mutation or import from a focused `use-review-preferences.ts` hook.
- `apps/web/src/lib/review-task-api.ts`  
  Parse the extended plan response.
- `apps/web/src/lib/review-plan-view.ts`  
  Update chart labels, tooltip, and capacity helpers.
- `apps/web/src/app/(main)/plan/page.tsx`  
  Add preference controls and plan guidance.
- `apps/web/src/app/(main)/today/page.tsx`  
  Read preference-backed reminder summary if needed.
- `docs/data-flow.md`, `docs/roadmap.md`, `DEVLOG.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`  
  Update after implementation and verification.

---

### Task 1: Add ReviewPreference Data Model

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_add_review_preferences/migration.sql`

- [ ] **Step 1: Add the Prisma model**

Add the relation on `User`:

```prisma
reviewPreference ReviewPreference?
```

Add the model near the Review section:

```prisma
model ReviewPreference {
  id                  String   @id @default(cuid())
  userId              String   @unique
  dailyMinutes        Int      @default(25)
  dailyCardLimit      Int      @default(12)
  preferredReviewTime String   @default("20:30") @db.VarChar(5)
  reminderEnabled     Boolean  @default(true)
  reminderLeadMinutes Int      @default(30)
  weekendMode         String   @default("same") @db.VarChar(16)
  planWindowDays      Int      @default(7)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Create the SQL migration**

Use Prisma migration generation if the local database is available:

```powershell
bun --cwd packages/database prisma migrate dev --name add_review_preferences
```

If generating manually, the migration SQL should be:

```sql
CREATE TABLE "ReviewPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dailyMinutes" INTEGER NOT NULL DEFAULT 25,
  "dailyCardLimit" INTEGER NOT NULL DEFAULT 12,
  "preferredReviewTime" VARCHAR(5) NOT NULL DEFAULT '20:30',
  "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  "reminderLeadMinutes" INTEGER NOT NULL DEFAULT 30,
  "weekendMode" VARCHAR(16) NOT NULL DEFAULT 'same',
  "planWindowDays" INTEGER NOT NULL DEFAULT 7,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewPreference_userId_key" ON "ReviewPreference"("userId");

ALTER TABLE "ReviewPreference"
ADD CONSTRAINT "ReviewPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Validate database package**

Run:

```powershell
bun --cwd packages/database test
```

Expected: package tests pass and Prisma schema validates.

- [ ] **Step 4: Commit**

```powershell
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat: add review preference model"
```

---

### Task 2: Add Shared ReviewPreference API Contracts

**Files:**

- Create: `packages/types/src/api/review-preference.ts`
- Modify: `packages/types/src/api/index.ts`

- [ ] **Step 1: Create schemas**

Create `packages/types/src/api/review-preference.ts`:

```ts
import { z } from 'zod';

export const reviewWeekendModeSchema = z.enum(['same', 'lighter', 'off']);

export const reviewPreferenceSchema = z.object({
  dailyMinutes: z.number().int().min(5).max(240),
  dailyCardLimit: z.number().int().min(1).max(200),
  preferredReviewTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reminderEnabled: z.boolean(),
  reminderLeadMinutes: z.number().int().min(0).max(720),
  weekendMode: reviewWeekendModeSchema,
  planWindowDays: z.union([z.literal(7), z.literal(14)]),
  updatedAt: z.string().datetime(),
});

export const reviewPreferencePatchSchema = z
  .object({
    dailyMinutes: z.number().int().min(5).max(240).optional(),
    dailyCardLimit: z.number().int().min(1).max(200).optional(),
    preferredReviewTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    reminderEnabled: z.boolean().optional(),
    reminderLeadMinutes: z.number().int().min(0).max(720).optional(),
    weekendMode: reviewWeekendModeSchema.optional(),
    planWindowDays: z.union([z.literal(7), z.literal(14)]).optional(),
  })
  .strict();

export type ReviewWeekendMode = z.infer<typeof reviewWeekendModeSchema>;
export type ReviewPreferenceResponse = z.infer<typeof reviewPreferenceSchema>;
export type ReviewPreferencePatchRequest = z.infer<typeof reviewPreferencePatchSchema>;
```

- [ ] **Step 2: Export from API index**

Add to `packages/types/src/api/index.ts`:

```ts
export * from './review-preference';
```

- [ ] **Step 3: Typecheck contracts**

Run:

```powershell
bun --cwd packages/types typecheck
```

Expected: typecheck passes.

- [ ] **Step 4: Commit**

```powershell
git add packages/types/src/api/review-preference.ts packages/types/src/api/index.ts
git commit -m "feat: add review preference contracts"
```

---

### Task 3: Add ReviewPreferences API

**Files:**

- Create: `apps/server/src/review-preferences/review-preferences.controller.ts`
- Create: `apps/server/src/review-preferences/review-preferences.service.ts`
- Create: `apps/server/src/review-preferences/review-preferences.module.ts`
- Create: `apps/server/src/review-preferences/review-preferences.service.spec.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Write service tests**

Create tests that cover:

```ts
it('returns default preferences when the user has no row yet', async () => {});
it('patches only provided fields and preserves the rest', async () => {});
it('upserts by userId so each user has one preference row', async () => {});
```

Expected defaults:

```ts
{
  dailyMinutes: 25,
  dailyCardLimit: 12,
  preferredReviewTime: '20:30',
  reminderEnabled: true,
  reminderLeadMinutes: 30,
  weekendMode: 'same',
  planWindowDays: 7,
}
```

- [ ] **Step 2: Implement service**

Expose:

```ts
getByUserId(userId: string): Promise<ReviewPreferenceResponse>
patch(userId: string, input: ReviewPreferencePatchRequest): Promise<ReviewPreferenceResponse>
```

Use `prisma.reviewPreference.findUnique({ where: { userId } })` for reads and `upsert` for writes.

- [ ] **Step 3: Implement controller**

Routes:

```ts
@Get()
get(@CurrentUser() user: AuthenticatedUser)

@Patch()
patch(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown)
```

Base path:

```ts
@Controller('review-preferences')
@UseGuards(JwtAuthGuard)
```

- [ ] **Step 4: Register module**

Import `ReviewPreferencesModule` in `apps/server/src/app.module.ts`.

- [ ] **Step 5: Run server checks**

```powershell
bun --filter @repo/server lint
bun --filter @repo/server test
bun --filter @repo/server build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/server/src/review-preferences apps/server/src/app.module.ts
git commit -m "feat: add review preference api"
```

---

### Task 4: Extend Plan Contracts For Weighted Pressure

**Files:**

- Modify: `packages/types/src/api/review-task.ts`

- [ ] **Step 1: Add capacity schemas**

Add:

```ts
export const reviewTaskPlanCapacityStatusSchema = z.enum(['under', 'near', 'over']);
```

Extend `reviewTaskPlanDaySchema`:

```ts
pressureScore: z.number().nonnegative(),
capacityStatus: reviewTaskPlanCapacityStatusSchema,
reasons: z.array(z.string()),
```

Extend `summary`:

```ts
capacityStatus: reviewTaskPlanCapacityStatusSchema,
dailyMinutes: z.number().int().positive(),
dailyCardLimit: z.number().int().positive(),
```

- [ ] **Step 2: Export type**

Add:

```ts
export type ReviewTaskPlanCapacityStatus = z.infer<
  typeof reviewTaskPlanCapacityStatusSchema
>;
```

- [ ] **Step 3: Run typecheck**

```powershell
bun --cwd packages/types typecheck
```

Expected: typecheck passes.

- [ ] **Step 4: Commit**

```powershell
git add packages/types/src/api/review-task.ts
git commit -m "feat: extend review plan pressure contract"
```

---

### Task 5: Implement Weighted Plan Calculation

**Files:**

- Modify: `apps/server/src/review-tasks/review-tasks.service.ts`
- Modify: `apps/server/src/review-tasks/review-tasks.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Add tests for:

```ts
it('uses review preferences to mark a day over capacity', async () => {});
it('adds pressure reasons for overdue and difficult cards', async () => {});
it('keeps plan read-only and does not create future ReviewTask rows', async () => {});
```

Use cards with:

```ts
{ difficulty: 8, stability: 0.8, nextReview: today }
{ difficulty: 5, stability: 3, nextReview: tomorrow }
```

Expected day fields:

```ts
pressureScore > dueCount + overdueCount
capacityStatus: 'over'
reasons includes '高难度卡片较多'
```

- [ ] **Step 2: Load preferences in `getPlan`**

Read `reviewPreference` by `userId`. If missing, use defaults from the new preference service or a shared pure helper in the ReviewTasks service.

- [ ] **Step 3: Select card metadata**

Change plan card query select from:

```ts
select: { nextReview: true }
```

to:

```ts
select: {
  nextReview: true,
  difficulty: true,
  stability: true,
}
```

- [ ] **Step 4: Calculate pressure**

Use this first-version formula:

```ts
const base = dueCount + overdueCount;
const overduePenalty = overdueCount * 1.5;
const difficultPenalty = difficultCount * 0.5;
const unstablePenalty = unstableCount * 0.35;
const pressureScore = roundToOne(base + overduePenalty + difficultPenalty + unstablePenalty);
```

Definitions:

```ts
difficultCount = cards with difficulty >= 7
unstableCount = cards with stability > 0 && stability < 1.5
estimatedMinutes = Math.max(reviewCount * 2, Math.ceil(pressureScore * 2))
```

Capacity status:

```ts
if (estimatedMinutes > dailyMinutes || reviewCount > dailyCardLimit) return 'over';
if (estimatedMinutes >= dailyMinutes * 0.8 || reviewCount >= dailyCardLimit * 0.8) return 'near';
return 'under';
```

- [ ] **Step 5: Build reasons**

Reasons should be short Chinese strings:

```ts
[
  '有逾期复习卡，建议优先处理',
  '高难度卡片较多',
  '低稳定性卡片较多',
  '超过你的每日复习容量',
]
```

- [ ] **Step 6: Run server tests**

```powershell
bun --filter @repo/server test
bun --filter @repo/server test:e2e
```

Expected: unit and e2e pass with Docker PostgreSQL running.

- [ ] **Step 7: Commit**

```powershell
git add apps/server/src/review-tasks/review-tasks.service.ts apps/server/src/review-tasks/review-tasks.service.spec.ts
git commit -m "feat: add weighted review plan pressure"
```

---

### Task 6: Add Frontend Preference Client And Hooks

**Files:**

- Create: `apps/web/src/lib/review-preference-api.ts`
- Create: `apps/web/src/lib/review-preference-view.ts`
- Create: `apps/web/src/lib/review-preference-view.test.mts`
- Create: `apps/web/src/hooks/use-review-preferences.ts`

- [ ] **Step 1: Add API client**

Expose:

```ts
get(accessToken: string): Promise<ReviewPreferenceResponse>
patch(accessToken: string, request: ReviewPreferencePatchRequest): Promise<ReviewPreferenceResponse>
```

Paths:

```ts
GET /review-preferences
PATCH /review-preferences
```

- [ ] **Step 2: Add hooks**

Use TanStack Query keys:

```ts
export const reviewPreferenceQueryKeys = {
  all: ['review-preferences'] as const,
  detail: () => [...reviewPreferenceQueryKeys.all, 'detail'] as const,
};
```

Mutation success should invalidate:

```ts
reviewPreferenceQueryKeys.all
reviewTaskQueryKeys.all
```

- [ ] **Step 3: Add view helpers**

Implement:

```ts
getCapacityStatusLabel('under') => '容量充足'
getCapacityStatusLabel('near') => '接近上限'
getCapacityStatusLabel('over') => '超过容量'
normalizeReviewPreferenceForm(input)
```

- [ ] **Step 4: Run web helper test**

```powershell
node --experimental-strip-types apps/web/src/lib/review-preference-view.test.mts
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/review-preference-api.ts apps/web/src/lib/review-preference-view.ts apps/web/src/lib/review-preference-view.test.mts apps/web/src/hooks/use-review-preferences.ts
git commit -m "feat: add review preference client"
```

---

### Task 7: Upgrade `/plan` UI

**Files:**

- Modify: `apps/web/src/app/(main)/plan/page.tsx`
- Modify: `apps/web/src/lib/review-plan-view.ts`
- Modify: `apps/web/src/lib/review-plan-view.test.mts`

- [ ] **Step 1: Update chart data**

Bar value should use:

```ts
value: day.pressureScore
```

Tooltip should include:

```ts
压力分 ${day.pressureScore}
容量 ${getCapacityStatusLabel(day.capacityStatus)}
预计 ${day.estimatedMinutes} 分钟
```

- [ ] **Step 2: Add preference card**

Add a compact card near the top of `/plan`:

```text
每日容量：25 分钟 / 12 张
提醒时间：20:30
计划窗口：7 天
```

Provide controls:

```text
dailyMinutes number input
dailyCardLimit number input
preferredReviewTime time input
reminderEnabled toggle
planWindowDays segmented 7 / 14
```

- [ ] **Step 3: Add capacity guidance**

In summary and day cards show:

```text
容量充足 / 接近上限 / 超过容量
```

If day reasons exist, render reason chips under the day card.

- [ ] **Step 4: Preserve mobile layout**

Controls must remain touch-friendly:

```text
min-height >= 44px
no horizontal overflow at 375px viewport
```

- [ ] **Step 5: Run web checks**

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/app/(main)/plan/page.tsx apps/web/src/lib/review-plan-view.ts apps/web/src/lib/review-plan-view.test.mts
git commit -m "feat: show capacity aware review plan"
```

---

### Task 8: Update Today Reminder Summary

**Files:**

- Modify: `apps/web/src/app/(main)/today/page.tsx`
- Modify: `apps/web/src/lib/review-reminder.ts`
- Modify: `apps/web/src/lib/review-reminder.test.mts`

- [ ] **Step 1: Extend reminder summary helper**

Add optional capacity fields:

```ts
dailyMinutes: number;
estimatedMinutes: number;
capacityStatus: 'under' | 'near' | 'over';
```

- [ ] **Step 2: Update today summary copy**

Show one line:

```text
今日预计 18 分钟，容量充足
```

When over capacity:

```text
今日预计 42 分钟，已超过你的每日容量
```

- [ ] **Step 3: Keep offline semantics unchanged**

Do not locally advance FSRS, `ReviewLog`, stats, or `ReviewTask` when a rating is pending sync.

- [ ] **Step 4: Run focused tests**

```powershell
node --experimental-strip-types apps/web/src/lib/review-reminder.test.mts
bun --filter @repo/web lint
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/app/(main)/today/page.tsx apps/web/src/lib/review-reminder.ts apps/web/src/lib/review-reminder.test.mts
git commit -m "feat: add capacity summary to today review"
```

---

### Task 9: Browser Verification

**Files:**

- No source changes expected unless bugs are found.

- [ ] **Step 1: Start infrastructure**

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
```

- [ ] **Step 2: Start apps**

```powershell
bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

- [ ] **Step 3: Manual flow**

Verify:

```text
Register/login smoke account
Create or use existing wrong question
Add it to review
Open /plan
Change daily minutes to a low value
Plan day changes to over capacity
Reasons render as chips
Change plan window to 14 days
Chart and daily list update
Open /today
Reminder summary reflects estimated minutes/capacity
Submit rating
Plan and stats refresh after success
```

- [ ] **Step 4: Mobile viewport**

Use browser viewport around `390x844` and confirm:

```text
No horizontal overflow
Preference controls are touch friendly
Chart labels remain readable
Reason chips wrap cleanly
```

- [ ] **Step 5: Stop local dev servers**

Stop server/web processes started for this task. Leave Docker running only if the next task needs it.

---

### Task 10: Documentation And Closeout

**Files:**

- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `DEVLOG.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update data flow**

Record:

```text
ReviewPreference is PostgreSQL authoritative account-level planning preference.
/review-tasks/plan remains read-only and derives future pressure from Card.nextReview.
Weighted pressure model uses due, overdue, difficulty, stability, estimated minutes, and user capacity.
Future ReviewTask rows are still not created by /plan.
```

- [ ] **Step 2: Update roadmap/readme/agent docs**

Mark Phase 4.5.2 complete only after browser verification and all checks pass.

- [ ] **Step 3: Update DEVLOG**

Use the existing date section for 2026-06-17. Keep todos at the bottom.

- [ ] **Step 4: Full verification**

Run:

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
git diff --check
```

- [ ] **Step 5: Commit docs**

```powershell
git add docs/data-flow.md docs/roadmap.md DEVLOG.md README.md AGENTS.md CLAUDE.md
git commit -m "docs: complete phase 4.5.2 review planning"
```

---

## Self-Review

- Spec coverage: Review preferences, weighted pressure, plan UI, today summary, tests, browser verification, and documentation are covered.
- Placeholder scan: no unresolved placeholders or open-ended implementation steps remain.
- Type consistency: `ReviewPreference`, `ReviewPreferencePatchRequest`, `pressureScore`, `capacityStatus`, and `reasons` are introduced before later tasks use them.
- Scope check: browser notifications, push systems, BullMQ reminders, and future task materialization are explicitly excluded from Phase 4.5.2.
