# Phase 4 FSRS Review System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production FSRS review loop: wrong questions can become review cards, today's due cards can be reviewed, and ratings update scheduling state.

**Architecture:** Use a WrongQuestion-first model. `@repo/fsrs` stays a pure deterministic scheduler; NestJS owns Card / ReviewLog persistence; Next.js reads review server state with TanStack Query and keeps existing WrongQuestion / OCR / Chat flows unchanged.

**Tech Stack:** Bun workspace, TypeScript, Prisma/PostgreSQL, NestJS, Zod shared contracts, TanStack Query, Next.js 16, React 19.

---

## Scope Lock

This plan implements Phase 4.1 only:

- Card creation from an existing WrongQuestion.
- Today's due review tasks as an API view, not a persistent ReviewTask table.
- Rating submission with ReviewLog.
- WrongQuestion detail entry point.
- Today page review section.

This plan does not implement offline review queue, push reminders, decks, review heatmaps, RAG, Agent automation, or a separate review route.

## File Structure

### Shared Algorithm

- Modify `packages/fsrs/src/types.ts`
  - Owns algorithm-facing state and rating types.
- Modify `packages/fsrs/src/fsrs.ts`
  - Owns deterministic scheduling implementation.
- Modify `packages/fsrs/src/index.ts`
  - Exports stable public API.
- Create `packages/fsrs/src/fsrs.test.mts`
  - Node test runner coverage for deterministic scheduling.
- Modify `packages/fsrs/package.json`
  - Make `bun --cwd packages/fsrs test` run the test file plus typecheck.

### Shared API Contracts

- Create `packages/types/src/api/review.ts`
  - Zod schemas and TypeScript types for Review API.
- Modify `packages/types/src/api/index.ts`
  - Export review API contracts.
- Modify `packages/types/package.json`
  - Add `./api/review` export.
- Create `packages/types/tests/review.test.mts`
  - Runtime schema tests for Review API payloads.

### Database

- Modify `packages/database/prisma/schema.prisma`
  - Add `WrongQuestion.cards`, make `Card.questionId` optional, add `Card.wrongQuestionId`, add `suspendedAt`, adjust cascade behavior, add `ReviewLog.elapsedDays` and `reviewDurationMs`.
- Create Prisma migration through command:
  - `bun --filter @repo/database prisma:migrate -- --name phase_4_fsrs_review_cards`

### Server

- Create `apps/server/src/reviews/reviews.module.ts`
- Create `apps/server/src/reviews/reviews.controller.ts`
- Create `apps/server/src/reviews/reviews.service.ts`
- Create `apps/server/src/reviews/reviews.service.spec.ts`
- Modify `apps/server/src/app.module.ts`
  - Import `ReviewsModule`.

### Web

- Create `apps/web/src/lib/review-api.ts`
- Create `apps/web/src/lib/review-api.test.mts`
- Create `apps/web/src/hooks/use-reviews.ts`
- Modify `apps/web/src/app/(main)/error-book/page.tsx`
  - Add review card status and creation action in detail view.
- Modify `apps/web/src/app/(main)/today/page.tsx`
  - Add due review cards section and rating actions.

### Docs

- Modify `docs/data-flow.md`
- Modify `docs/roadmap.md`
- Modify `AGENTS.md`
- Modify `CLAUDE.md`
- Modify `DEVLOG.md`

---

## Task 1: Implement Pure FSRS Scheduler

**Files:**

- Modify: `packages/fsrs/src/types.ts`
- Modify: `packages/fsrs/src/fsrs.ts`
- Modify: `packages/fsrs/src/index.ts`
- Create: `packages/fsrs/src/fsrs.test.mts`
- Modify: `packages/fsrs/package.json`

- [ ] **Step 1: Write the failing FSRS test**

Create `packages/fsrs/src/fsrs.test.mts`:

```ts
import assert from 'node:assert/strict';

import { scheduleReview, type FsrsCardState } from './fsrs.ts';

const baseReviewedAt = new Date('2026-06-14T08:00:00.000Z');

function createNewCard(): FsrsCardState {
  return {
    difficulty: 5,
    stability: 0,
    retrievability: 1,
    lastReview: null,
    nextReview: baseReviewedAt,
    reviewCount: 0,
    lapses: 0,
    state: 'NEW',
  };
}

function run() {
  testGoodGraduatesNewCardToReview();
  testAgainKeepsCardShortIntervalAndAddsLapse();
  testEasySchedulesLongerThanGood();
  testReviewAgainEntersRelearning();
  testSameInputProducesSameOutput();
}

function testGoodGraduatesNewCardToReview() {
  const result = scheduleReview({
    card: createNewCard(),
    rating: 3,
    reviewedAt: baseReviewedAt,
  });

  assert.equal(result.card.state, 'REVIEW');
  assert.equal(result.card.reviewCount, 1);
  assert.equal(result.card.lapses, 0);
  assert.equal(result.log.scheduledDays, 1);
  assert.equal(result.card.nextReview.toISOString(), '2026-06-15T08:00:00.000Z');
}

function testAgainKeepsCardShortIntervalAndAddsLapse() {
  const result = scheduleReview({
    card: createNewCard(),
    rating: 1,
    reviewedAt: baseReviewedAt,
  });

  assert.equal(result.card.state, 'LEARNING');
  assert.equal(result.card.reviewCount, 1);
  assert.equal(result.card.lapses, 1);
  assert.equal(result.log.scheduledDays, 0);
  assert.equal(result.card.nextReview.toISOString(), '2026-06-14T08:10:00.000Z');
}

function testEasySchedulesLongerThanGood() {
  const good = scheduleReview({
    card: createNewCard(),
    rating: 3,
    reviewedAt: baseReviewedAt,
  });
  const easy = scheduleReview({
    card: createNewCard(),
    rating: 4,
    reviewedAt: baseReviewedAt,
  });

  assert.ok(easy.card.nextReview.getTime() > good.card.nextReview.getTime());
  assert.ok(easy.card.stability > good.card.stability);
  assert.equal(easy.log.scheduledDays, 4);
}

function testReviewAgainEntersRelearning() {
  const reviewedCard: FsrsCardState = {
    ...createNewCard(),
    difficulty: 4.5,
    stability: 3,
    retrievability: 0.6,
    lastReview: new Date('2026-06-10T08:00:00.000Z'),
    nextReview: baseReviewedAt,
    reviewCount: 3,
    lapses: 0,
    state: 'REVIEW',
  };

  const result = scheduleReview({
    card: reviewedCard,
    rating: 1,
    reviewedAt: baseReviewedAt,
  });

  assert.equal(result.card.state, 'RELEARNING');
  assert.equal(result.card.reviewCount, 4);
  assert.equal(result.card.lapses, 1);
  assert.equal(result.log.elapsedDays, 4);
}

function testSameInputProducesSameOutput() {
  const first = scheduleReview({
    card: createNewCard(),
    rating: 2,
    reviewedAt: baseReviewedAt,
  });
  const second = scheduleReview({
    card: createNewCard(),
    rating: 2,
    reviewedAt: baseReviewedAt,
  });

  assert.deepEqual(first, second);
}

run();
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node --experimental-strip-types packages/fsrs/src/fsrs.test.mts
```

Expected: FAIL because `scheduleReview` is not exported or not implemented.

- [ ] **Step 3: Implement the scheduler types**

Replace `packages/fsrs/src/types.ts` with:

```ts
export type Rating = 1 | 2 | 3 | 4;

export type FsrsCardStateValue = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';

export interface FsrsCardState {
  difficulty: number;
  stability: number;
  retrievability: number;
  lastReview?: Date | null;
  nextReview: Date;
  reviewCount: number;
  lapses: number;
  state: FsrsCardStateValue;
}

export interface ScheduleReviewInput {
  card: FsrsCardState;
  rating: Rating;
  reviewedAt: Date;
}

export interface ScheduleReviewResult {
  card: FsrsCardState;
  log: {
    scheduledDays: number;
    elapsedDays: number;
    stabilityBefore: number;
    stabilityAfter: number;
    difficultyBefore: number;
    difficultyAfter: number;
  };
}
```

- [ ] **Step 4: Implement minimal deterministic FSRS-compatible scheduling**

Replace `packages/fsrs/src/fsrs.ts` with:

```ts
import type {
  FsrsCardState,
  FsrsCardStateValue,
  Rating,
  ScheduleReviewInput,
  ScheduleReviewResult,
} from './types';

export type {
  FsrsCardState,
  FsrsCardStateValue,
  Rating,
  ScheduleReviewInput,
  ScheduleReviewResult,
};

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export function scheduleReview(input: ScheduleReviewInput): ScheduleReviewResult {
  const { card, rating, reviewedAt } = input;
  assertRating(rating);

  const elapsedDays = calculateElapsedDays(card.lastReview, reviewedAt);
  const stabilityBefore = normalizeNumber(card.stability, 0);
  const difficultyBefore = normalizeNumber(card.difficulty, 5);
  const nextReviewCount = card.reviewCount + 1;
  const nextLapses = rating === 1 ? card.lapses + 1 : card.lapses;
  const nextDifficulty = clampDifficulty(calculateDifficulty(difficultyBefore, rating));
  const nextStability = clampStability(calculateStability(stabilityBefore, rating, card.state));
  const nextState = calculateState(card.state, rating);
  const scheduledDays = calculateScheduledDays(rating, nextStability, nextReviewCount);
  const nextReview = addInterval(reviewedAt, rating, scheduledDays);

  return {
    card: {
      difficulty: nextDifficulty,
      stability: nextStability,
      retrievability: calculateRetrievability(reviewedAt, nextReview),
      lastReview: reviewedAt,
      nextReview,
      reviewCount: nextReviewCount,
      lapses: nextLapses,
      state: nextState,
    },
    log: {
      scheduledDays,
      elapsedDays,
      stabilityBefore,
      stabilityAfter: nextStability,
      difficultyBefore,
      difficultyAfter: nextDifficulty,
    },
  };
}

export function fsrs() {
  return {
    schedule: (card: FsrsCardState, rating: Rating, reviewedAt = new Date()) =>
      scheduleReview({ card, rating, reviewedAt }).card,
  };
}

function assertRating(rating: Rating) {
  if (![1, 2, 3, 4].includes(rating)) {
    throw new Error(`Invalid FSRS rating: ${rating}`);
  }
}

function calculateElapsedDays(lastReview: Date | null | undefined, reviewedAt: Date) {
  if (!lastReview) return 0;
  return Math.max(0, Math.floor((reviewedAt.getTime() - lastReview.getTime()) / DAY));
}

function calculateDifficulty(current: number, rating: Rating) {
  const deltaByRating: Record<Rating, number> = {
    1: 0.8,
    2: 0.3,
    3: -0.15,
    4: -0.45,
  };
  return current + deltaByRating[rating];
}

function calculateStability(current: number, rating: Rating, state: FsrsCardStateValue) {
  const base = current > 0 ? current : 1;
  if (rating === 1) return Math.max(0.2, base * 0.45);
  if (rating === 2) return state === 'NEW' ? 0.5 : base * 1.2;
  if (rating === 3) return state === 'NEW' ? 1 : base * 2.3;
  return state === 'NEW' ? 4 : base * 3.2;
}

function calculateState(current: FsrsCardStateValue, rating: Rating): FsrsCardStateValue {
  if (rating === 1) return current === 'NEW' ? 'LEARNING' : 'RELEARNING';
  if (rating === 2) return current === 'NEW' ? 'LEARNING' : 'REVIEW';
  return 'REVIEW';
}

function calculateScheduledDays(rating: Rating, stability: number, reviewCount: number) {
  if (rating === 1) return 0;
  if (rating === 2) return reviewCount <= 1 ? 0 : Math.max(1, Math.round(stability));
  if (rating === 3) return Math.max(1, Math.round(stability));
  return Math.max(4, Math.round(stability));
}

function addInterval(reviewedAt: Date, rating: Rating, scheduledDays: number) {
  if (rating === 1) return new Date(reviewedAt.getTime() + 10 * MINUTE);
  if (rating === 2 && scheduledDays === 0) return new Date(reviewedAt.getTime() + 30 * MINUTE);
  return new Date(reviewedAt.getTime() + scheduledDays * DAY);
}

function calculateRetrievability(reviewedAt: Date, nextReview: Date) {
  return nextReview.getTime() <= reviewedAt.getTime() ? 1 : 0.9;
}

function clampDifficulty(value: number) {
  return roundToTwo(Math.min(10, Math.max(1, value)));
}

function clampStability(value: number) {
  return roundToTwo(Math.max(0.1, value));
}

function normalizeNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}
```

- [ ] **Step 5: Update exports**

Replace `packages/fsrs/src/index.ts` with:

```ts
// @repo/fsrs: pure FSRS-style review scheduling, no database dependency.
export { fsrs, scheduleReview } from './fsrs';
export type {
  FsrsCardState,
  FsrsCardStateValue,
  Rating,
  ScheduleReviewInput,
  ScheduleReviewResult,
} from './types';
```

- [ ] **Step 6: Update fsrs test script**

Modify `packages/fsrs/package.json` scripts:

```json
{
  "scripts": {
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "node --experimental-strip-types src/fsrs.test.mts && tsc --noEmit"
  }
}
```

- [ ] **Step 7: Run tests**

Run:

```powershell
node --experimental-strip-types packages/fsrs/src/fsrs.test.mts
bun --cwd packages/fsrs test
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit**

```powershell
git add packages/fsrs/src/types.ts packages/fsrs/src/fsrs.ts packages/fsrs/src/index.ts packages/fsrs/src/fsrs.test.mts packages/fsrs/package.json
git commit -m "feat: implement fsrs review scheduler"
```

---

## Task 2: Add Review Shared API Contracts

**Files:**

- Create: `packages/types/src/api/review.ts`
- Modify: `packages/types/src/api/index.ts`
- Modify: `packages/types/package.json`
- Create: `packages/types/tests/review.test.mts`

- [ ] **Step 1: Write failing review schema tests**

Create `packages/types/tests/review.test.mts`:

```ts
import assert from 'node:assert/strict';

import {
  createReviewCardFromWrongQuestionRequestSchema,
  reviewRatingRequestSchema,
  reviewTodayTasksResponseSchema,
} from '../src/api/review.ts';

function run() {
  testCreateCardRequest();
  testRatingRequest();
  testTodayTasksResponse();
}

function testCreateCardRequest() {
  const result = createReviewCardFromWrongQuestionRequestSchema.parse({
    wrongQuestionId: 'wrong_1',
  });
  assert.equal(result.wrongQuestionId, 'wrong_1');
}

function testRatingRequest() {
  const result = reviewRatingRequestSchema.parse({
    rating: 4,
    reviewedAt: '2026-06-14T08:00:00.000Z',
    reviewDurationMs: 12000,
  });
  assert.equal(result.rating, 4);
}

function testTodayTasksResponse() {
  const result = reviewTodayTasksResponseSchema.parse({
    date: '2026-06-14',
    dueCount: 1,
    newCount: 1,
    learningCount: 0,
    reviewCount: 0,
    tasks: [
      {
        cardId: 'card_1',
        dueAt: '2026-06-14T08:00:00.000Z',
        state: 'NEW',
        reviewCount: 0,
        lapses: 0,
        source: 'wrongQuestion',
        wrongQuestion: {
          id: 'wrong_1',
          questionText: 'Compute 2x + 5 = 13.',
          subject: '数学',
          knowledgePoints: ['一元一次方程'],
          answer: 'x = 4',
          analysis: 'Move 5 then divide by 2.',
          imageUrl: null,
          status: 'UNRESOLVED',
        },
      },
    ],
  });

  assert.equal(result.tasks[0]?.source, 'wrongQuestion');
  assert.equal(result.tasks[0]?.wrongQuestion?.status, 'UNRESOLVED');
}

run();
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node --experimental-strip-types packages/types/tests/review.test.mts
```

Expected: FAIL because `../src/api/review.ts` does not exist.

- [ ] **Step 3: Add review contract**

Create `packages/types/src/api/review.ts`:

```ts
import { z } from 'zod';

export const reviewRatingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const reviewCardStateSchema = z.enum(['NEW', 'LEARNING', 'REVIEW', 'RELEARNING']);
export const reviewSourceSchema = z.enum(['wrongQuestion', 'question']);
export const reviewWrongQuestionStatusSchema = z.enum(['UNRESOLVED', 'RESOLVED']);

export const createReviewCardFromWrongQuestionRequestSchema = z.object({
  wrongQuestionId: z.string().min(1),
});

export const reviewCardSchema = z.object({
  id: z.string(),
  userId: z.string(),
  questionId: z.string().nullable(),
  wrongQuestionId: z.string().nullable(),
  difficulty: z.number(),
  stability: z.number(),
  retrievability: z.number(),
  lastReview: z.string().nullable(),
  nextReview: z.string(),
  reviewCount: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  state: reviewCardStateSchema,
  suspendedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const reviewLogSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  rating: reviewRatingSchema,
  scheduledDays: z.number().int().nonnegative(),
  elapsedDays: z.number().int().nonnegative(),
  reviewDurationMs: z.number().int().nonnegative().nullable(),
  stabilityBefore: z.number(),
  stabilityAfter: z.number(),
  difficultyBefore: z.number(),
  difficultyAfter: z.number(),
  reviewedAt: z.string(),
});

export const createReviewCardResponseSchema = z.object({
  card: reviewCardSchema,
  created: z.boolean(),
});

export const reviewWrongQuestionTaskSchema = z.object({
  id: z.string(),
  questionText: z.string(),
  subject: z.string(),
  knowledgePoints: z.array(z.string()),
  answer: z.string(),
  analysis: z.string(),
  imageUrl: z.string().nullable(),
  status: reviewWrongQuestionStatusSchema,
});

export const reviewTaskSchema = z.object({
  cardId: z.string(),
  dueAt: z.string(),
  state: reviewCardStateSchema,
  reviewCount: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  source: reviewSourceSchema,
  wrongQuestion: reviewWrongQuestionTaskSchema.optional(),
});

export const reviewTodayTasksResponseSchema = z.object({
  date: z.string(),
  dueCount: z.number().int().nonnegative(),
  newCount: z.number().int().nonnegative(),
  learningCount: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
  tasks: z.array(reviewTaskSchema),
});

export const reviewRatingRequestSchema = z.object({
  rating: reviewRatingSchema,
  reviewedAt: z.string().datetime().optional(),
  reviewDurationMs: z.number().int().nonnegative().optional(),
});

export const reviewRatingResponseSchema = z.object({
  card: reviewCardSchema,
  log: reviewLogSchema,
});

export const reviewCardByWrongQuestionResponseSchema = z.object({
  card: reviewCardSchema.nullable(),
});

export type ReviewRating = z.infer<typeof reviewRatingSchema>;
export type ReviewCardState = z.infer<typeof reviewCardStateSchema>;
export type CreateReviewCardFromWrongQuestionRequest = z.infer<
  typeof createReviewCardFromWrongQuestionRequestSchema
>;
export type ReviewCardResponse = z.infer<typeof reviewCardSchema>;
export type ReviewLogResponse = z.infer<typeof reviewLogSchema>;
export type CreateReviewCardResponse = z.infer<typeof createReviewCardResponseSchema>;
export type ReviewTaskResponse = z.infer<typeof reviewTaskSchema>;
export type ReviewTodayTasksResponse = z.infer<typeof reviewTodayTasksResponseSchema>;
export type ReviewRatingRequest = z.infer<typeof reviewRatingRequestSchema>;
export type ReviewRatingResponse = z.infer<typeof reviewRatingResponseSchema>;
export type ReviewCardByWrongQuestionResponse = z.infer<
  typeof reviewCardByWrongQuestionResponseSchema
>;
```

- [ ] **Step 4: Export the contract**

Modify `packages/types/package.json` exports:

```json
"./api/review": "./src/api/review.ts"
```

Modify `packages/types/src/api/index.ts`:

```ts
export * from './auth';
export * from './chat-message';
export * from './common';
export * from './ocr-question';
export * from './ocr-record';
export * from './review';
export * from './upload';
export * from './wrong-question';
```

- [ ] **Step 5: Run tests**

Run:

```powershell
node --experimental-strip-types packages/types/tests/review.test.mts
bun --cwd packages/types typecheck
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add packages/types/src/api/review.ts packages/types/src/api/index.ts packages/types/package.json packages/types/tests/review.test.mts
git commit -m "feat: add review api contracts"
```

---

## Task 3: Update Prisma Review Schema

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<generated_timestamp>_phase_4_fsrs_review_cards/migration.sql`

- [ ] **Step 1: Modify Prisma schema**

Update `WrongQuestion` relation:

```prisma
model WrongQuestion {
  id              String              @id @default(cuid())
  userId          String
  source          WrongQuestionSource @default(OCR)
  sourceRecordId  String?
  sourceGroupId   String?
  imageUrl        String?
  questionText    String              @db.Text
  subject         String
  category        String
  knowledgePoints String[]
  analysis        String              @db.Text
  answer          String              @db.Text
  errorType       String?
  userNote        String?             @db.Text
  rawContent      String?             @db.Text
  status          WrongQuestionStatus @default(UNRESOLVED)
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  cards Card[]

  @@unique([userId, sourceGroupId])
  @@index([userId, createdAt])
  @@index([userId, status])
  @@index([userId, subject])
}
```

Replace `Card`:

```prisma
model Card {
  id              String    @id @default(cuid())
  userId          String
  questionId      String?   @unique
  wrongQuestionId String?   @unique
  difficulty      Float     @default(5.0)
  stability       Float     @default(0.0)
  retrievability  Float     @default(1.0)
  lastReview      DateTime?
  nextReview      DateTime  @default(now())
  reviewCount     Int       @default(0)
  lapses          Int       @default(0)
  state           CardState @default(NEW)
  suspendedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  question      Question?      @relation(fields: [questionId], references: [id])
  wrongQuestion WrongQuestion? @relation(fields: [wrongQuestionId], references: [id], onDelete: Cascade)
  logs          ReviewLog[]

  @@index([userId, nextReview])
  @@index([userId, state])
  @@index([userId, wrongQuestionId])
}
```

Replace `ReviewLog`:

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

  card Card @relation(fields: [cardId], references: [id], onDelete: Cascade)

  @@index([cardId])
  @@index([reviewedAt])
}
```

- [ ] **Step 2: Generate migration**

Run:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --filter @repo/database prisma:migrate -- --name phase_4_fsrs_review_cards
```

Expected: Prisma creates a migration under `packages/database/prisma/migrations`.

- [ ] **Step 3: Generate Prisma client and typecheck**

Run:

```powershell
bun run db:generate
bun --cwd packages/database test
```

Expected: both commands exit 0.

- [ ] **Step 4: Commit**

```powershell
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat: add review card database schema"
```

---

## Task 4: Add NestJS Review API

**Files:**

- Create: `apps/server/src/reviews/reviews.module.ts`
- Create: `apps/server/src/reviews/reviews.controller.ts`
- Create: `apps/server/src/reviews/reviews.service.ts`
- Create: `apps/server/src/reviews/reviews.service.spec.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Write failing service tests**

Create `apps/server/src/reviews/reviews.service.spec.ts` with these cases:

```ts
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../database/prisma.service';

describe('ReviewsService', () => {
  const wrongQuestion = {
    id: 'wrong_1',
    userId: 'user_1',
    questionText: 'Compute 2x + 5 = 13.',
    subject: '数学',
    knowledgePoints: ['一元一次方程'],
    answer: 'x = 4',
    analysis: 'Move 5 then divide by 2.',
    imageUrl: null,
    status: 'UNRESOLVED' as const,
  };
  const card = {
    id: 'card_1',
    userId: 'user_1',
    questionId: null,
    wrongQuestionId: 'wrong_1',
    difficulty: 5,
    stability: 0,
    retrievability: 1,
    lastReview: null,
    nextReview: new Date('2026-06-14T08:00:00.000Z'),
    reviewCount: 0,
    lapses: 0,
    state: 'NEW' as const,
    suspendedAt: null,
    createdAt: new Date('2026-06-14T08:00:00.000Z'),
    updatedAt: new Date('2026-06-14T08:00:00.000Z'),
    wrongQuestion,
  };
  const prisma = {
    $transaction: jest.fn(),
    wrongQuestion: {
      findFirst: jest.fn(),
    },
    card: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    reviewLog: {
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createService() {
    return new ReviewsService(prisma as unknown as PrismaService);
  }

  it('creates a review card from an owned wrong question', async () => {
    prisma.wrongQuestion.findFirst.mockResolvedValue(wrongQuestion);
    prisma.card.findFirst.mockResolvedValue(null);
    prisma.card.create.mockResolvedValue(card);

    const result = await createService().createFromWrongQuestion('user_1', {
      wrongQuestionId: 'wrong_1',
    });

    expect(prisma.wrongQuestion.findFirst).toHaveBeenCalledWith({
      where: { id: 'wrong_1', userId: 'user_1' },
      select: { id: true },
    });
    expect(prisma.card.create).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        wrongQuestionId: 'wrong_1',
        nextReview: expect.any(Date),
        state: 'NEW',
      },
      include: { wrongQuestion: true },
    });
    expect(result.created).toBe(true);
    expect(result.card.wrongQuestionId).toBe('wrong_1');
  });

  it('returns an existing card instead of duplicating it', async () => {
    prisma.wrongQuestion.findFirst.mockResolvedValue(wrongQuestion);
    prisma.card.findFirst.mockResolvedValue(card);

    const result = await createService().createFromWrongQuestion('user_1', {
      wrongQuestionId: 'wrong_1',
    });

    expect(prisma.card.create).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.card.id).toBe('card_1');
  });

  it('lists due cards for the current user only', async () => {
    prisma.card.findMany.mockResolvedValue([card]);

    const result = await createService().getTodayTasks('user_1', '2026-06-14');

    expect(prisma.card.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        suspendedAt: null,
        nextReview: { lte: new Date('2026-06-14T23:59:59.999Z') },
      },
      orderBy: { nextReview: 'asc' },
      include: { wrongQuestion: true },
    });
    expect(result.dueCount).toBe(1);
    expect(result.tasks[0]?.wrongQuestion?.id).toBe('wrong_1');
  });

  it('updates card and writes review log when rating is submitted', async () => {
    const updatedCard = {
      ...card,
      state: 'REVIEW' as const,
      reviewCount: 1,
      nextReview: new Date('2026-06-15T08:00:00.000Z'),
      lastReview: new Date('2026-06-14T08:00:00.000Z'),
      stability: 1,
      difficulty: 4.85,
    };
    const log = {
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
      reviewedAt: new Date('2026-06-14T08:00:00.000Z'),
    };

    prisma.card.findFirst.mockResolvedValue(card);
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );
    prisma.card.update.mockResolvedValue(updatedCard);
    prisma.reviewLog.create.mockResolvedValue(log);

    const result = await createService().submitRating('user_1', 'card_1', {
      rating: 3,
      reviewedAt: '2026-06-14T08:00:00.000Z',
      reviewDurationMs: 12000,
    });

    expect(prisma.card.update).toHaveBeenCalledWith({
      where: { id: 'card_1' },
      data: expect.objectContaining({
        state: 'REVIEW',
        reviewCount: 1,
        lastReview: new Date('2026-06-14T08:00:00.000Z'),
      }),
      include: { wrongQuestion: true },
    });
    expect(prisma.reviewLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardId: 'card_1',
        rating: 3,
        scheduledDays: 1,
      }),
    });
    expect(result.log.id).toBe('log_1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
bun --filter @repo/server test -- reviews.service.spec.ts
```

Expected: FAIL because `ReviewsService` does not exist.

- [ ] **Step 3: Add module**

Create `apps/server/src/reviews/reviews.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [AuthModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
```

- [ ] **Step 4: Add controller**

Create `apps/server/src/reviews/reviews.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  createReviewCardFromWrongQuestionRequestSchema,
  reviewRatingRequestSchema,
} from '@repo/types/api/review';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('cards/from-wrong-question')
  createFromWrongQuestion(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = createReviewCardFromWrongQuestionRequestSchema.parse(body);
    return this.reviewsService.createFromWrongQuestion(user.id, input);
  }

  @Get('cards/by-wrong-question/:wrongQuestionId')
  getByWrongQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('wrongQuestionId') wrongQuestionId: string,
  ) {
    return this.reviewsService.getByWrongQuestion(user.id, wrongQuestionId);
  }

  @Get('tasks/today')
  getTodayTasks(@CurrentUser() user: AuthenticatedUser, @Query('date') date?: string) {
    return this.reviewsService.getTodayTasks(user.id, date);
  }

  @Post('cards/:cardId/rating')
  submitRating(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId') cardId: string,
    @Body() body: unknown,
  ) {
    const input = reviewRatingRequestSchema.parse(body);
    return this.reviewsService.submitRating(user.id, cardId, input);
  }
}
```

- [ ] **Step 5: Add service**

Create `apps/server/src/reviews/reviews.service.ts`. Use the exact public methods from the tests:

```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateReviewCardFromWrongQuestionRequest,
  ReviewRatingRequest,
} from '@repo/types/api/review';
import { scheduleReview, type FsrsCardState } from '@repo/fsrs';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromWrongQuestion(
    userId: string,
    input: CreateReviewCardFromWrongQuestionRequest,
  ) {
    await this.ensureWrongQuestionOwned(userId, input.wrongQuestionId);

    const existing = await this.prisma.card.findFirst({
      where: { userId, wrongQuestionId: input.wrongQuestionId },
      include: { wrongQuestion: true },
    });
    if (existing) {
      return { card: this.toCardResponse(existing), created: false };
    }

    const card = await this.prisma.card.create({
      data: {
        userId,
        wrongQuestionId: input.wrongQuestionId,
        nextReview: new Date(),
        state: 'NEW',
      },
      include: { wrongQuestion: true },
    });

    return { card: this.toCardResponse(card), created: true };
  }

  async getByWrongQuestion(userId: string, wrongQuestionId: string) {
    await this.ensureWrongQuestionOwned(userId, wrongQuestionId);
    const card = await this.prisma.card.findFirst({
      where: { userId, wrongQuestionId },
      include: { wrongQuestion: true },
    });

    return { card: card ? this.toCardResponse(card) : null };
  }

  async getTodayTasks(userId: string, date?: string) {
    const targetDate = date ? new Date(`${date}T00:00:00.000Z`) : new Date();
    const dateKey = targetDate.toISOString().slice(0, 10);
    const dayEnd = new Date(`${dateKey}T23:59:59.999Z`);
    const cards = await this.prisma.card.findMany({
      where: {
        userId,
        suspendedAt: null,
        nextReview: { lte: dayEnd },
      },
      orderBy: { nextReview: 'asc' },
      include: { wrongQuestion: true },
    });
    const tasks = cards.map((card) => this.toReviewTask(card));

    return {
      date: dateKey,
      dueCount: tasks.length,
      newCount: tasks.filter((task) => task.state === 'NEW').length,
      learningCount: tasks.filter((task) => task.state === 'LEARNING' || task.state === 'RELEARNING')
        .length,
      reviewCount: tasks.filter((task) => task.state === 'REVIEW').length,
      tasks,
    };
  }

  async submitRating(userId: string, cardId: string, input: ReviewRatingRequest) {
    const reviewedAt = input.reviewedAt ? new Date(input.reviewedAt) : new Date();
    const existing = await this.prisma.card.findFirst({
      where: { id: cardId, userId },
      include: { wrongQuestion: true },
    });
    if (!existing) {
      throw this.notFound();
    }

    return this.prisma.$transaction(async (tx) => {
      const scheduled = scheduleReview({
        card: this.toFsrsCard(existing),
        rating: input.rating,
        reviewedAt,
      });
      const card = await tx.card.update({
        where: { id: cardId },
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
        include: { wrongQuestion: true },
      });
      const log = await tx.reviewLog.create({
        data: {
          cardId,
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

      return {
        card: this.toCardResponse(card),
        log: this.toLogResponse(log),
      };
    });
  }

  private async ensureWrongQuestionOwned(userId: string, wrongQuestionId: string) {
    const existing = await this.prisma.wrongQuestion.findFirst({
      where: { id: wrongQuestionId, userId },
      select: { id: true },
    });
    if (!existing) {
      throw new AppError(
        'WRONG_QUESTION_NOT_FOUND',
        '错题不存在或无权访问',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private toFsrsCard(card: CardRecord): FsrsCardState {
    return {
      difficulty: card.difficulty,
      stability: card.stability,
      retrievability: card.retrievability,
      lastReview: card.lastReview,
      nextReview: card.nextReview,
      reviewCount: card.reviewCount,
      lapses: card.lapses,
      state: card.state,
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
      lastReview: card.lastReview?.toISOString() ?? null,
      nextReview: card.nextReview.toISOString(),
      reviewCount: card.reviewCount,
      lapses: card.lapses,
      state: card.state,
      suspendedAt: card.suspendedAt?.toISOString() ?? null,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    };
  }

  private toReviewTask(card: CardRecord) {
    return {
      cardId: card.id,
      dueAt: card.nextReview.toISOString(),
      state: card.state,
      reviewCount: card.reviewCount,
      lapses: card.lapses,
      source: card.wrongQuestionId ? 'wrongQuestion' : 'question',
      wrongQuestion: card.wrongQuestion
        ? {
            id: card.wrongQuestion.id,
            questionText: card.wrongQuestion.questionText,
            subject: card.wrongQuestion.subject,
            knowledgePoints: card.wrongQuestion.knowledgePoints,
            answer: card.wrongQuestion.answer,
            analysis: card.wrongQuestion.analysis,
            imageUrl: card.wrongQuestion.imageUrl,
            status: card.wrongQuestion.status,
          }
        : undefined,
    };
  }

  private toLogResponse(log: ReviewLogRecord) {
    return {
      id: log.id,
      cardId: log.cardId,
      rating: log.rating,
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

  private notFound() {
    return new AppError('REVIEW_CARD_NOT_FOUND', '复习卡片不存在', HttpStatus.NOT_FOUND);
  }
}

type CardRecord = Prisma.CardGetPayload<{ include: { wrongQuestion: true } }>;
type ReviewLogRecord = Prisma.ReviewLogGetPayload<object>;
```

- [ ] **Step 6: Register module**

Modify `apps/server/src/app.module.ts`:

```ts
import { ReviewsModule } from './reviews/reviews.module';
```

Add `ReviewsModule` to imports after `WrongQuestionsModule`.

- [ ] **Step 7: Run backend checks**

Run:

```powershell
bun run db:generate
bun --filter @repo/server test -- reviews.service.spec.ts
bun --filter @repo/server lint
bun --filter @repo/server build
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

```powershell
git add apps/server/src/reviews apps/server/src/app.module.ts
git commit -m "feat: add review card api"
```

---

## Task 5: Add Frontend Review API and Hooks

**Files:**

- Create: `apps/web/src/lib/review-api.ts`
- Create: `apps/web/src/lib/review-api.test.mts`
- Create: `apps/web/src/hooks/use-reviews.ts`

- [ ] **Step 1: Write failing API test**

Create `apps/web/src/lib/review-api.test.mts`:

```ts
import assert from 'node:assert/strict';

import { createApiClient } from './api-client.ts';
import { createReviewApi } from './review-api.ts';

async function run() {
  await testCreatesCardFromWrongQuestion();
  await testLoadsTodayTasks();
  await testSubmitsRating();
}

async function testCreatesCardFromWrongQuestion() {
  let body: unknown;
  const client = createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (_input, init) => {
      body = init?.body ? JSON.parse(String(init.body)) : undefined;
      return jsonResponse({
        success: true,
        data: {
          card: createCard(),
          created: true,
        },
        requestId: 'req_1',
      });
    },
  });

  const api = createReviewApi(client);
  const result = await api.createFromWrongQuestion('token_1', 'wrong_1');

  assert.deepEqual(body, { wrongQuestionId: 'wrong_1' });
  assert.equal(result.created, true);
  assert.equal(result.card.wrongQuestionId, 'wrong_1');
}

async function testLoadsTodayTasks() {
  const requests: string[] = [];
  const client = createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (input) => {
      requests.push(String(input));
      return jsonResponse({
        success: true,
        data: {
          date: '2026-06-14',
          dueCount: 0,
          newCount: 0,
          learningCount: 0,
          reviewCount: 0,
          tasks: [],
        },
        requestId: 'req_2',
      });
    },
  });

  const api = createReviewApi(client);
  const result = await api.getTodayTasks('token_1', '2026-06-14');

  assert.equal(requests[0], 'http://localhost:3001/reviews/tasks/today?date=2026-06-14');
  assert.equal(result.dueCount, 0);
}

async function testSubmitsRating() {
  let body: unknown;
  const client = createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (_input, init) => {
      body = init?.body ? JSON.parse(String(init.body)) : undefined;
      return jsonResponse({
        success: true,
        data: {
          card: createCard({ reviewCount: 1 }),
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
        },
        requestId: 'req_3',
      });
    },
  });

  const api = createReviewApi(client);
  const result = await api.submitRating('token_1', 'card_1', {
    rating: 3,
    reviewedAt: '2026-06-14T08:00:00.000Z',
    reviewDurationMs: 12000,
  });

  assert.deepEqual(body, {
    rating: 3,
    reviewedAt: '2026-06-14T08:00:00.000Z',
    reviewDurationMs: 12000,
  });
  assert.equal(result.log.rating, 3);
}

function createCard(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

await run();
```

- [ ] **Step 2: Run API test to verify it fails**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-api.test.mts
```

Expected: FAIL because `review-api.ts` does not exist.

- [ ] **Step 3: Add review API client**

Create `apps/web/src/lib/review-api.ts`:

```ts
import {
  createReviewCardResponseSchema,
  reviewCardByWrongQuestionResponseSchema,
  reviewRatingResponseSchema,
  reviewTodayTasksResponseSchema,
  type ReviewRatingRequest,
} from '@repo/types/api/review';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
  post: <T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null },
  ) => Promise<T>;
};

export function createReviewApi(client: ApiClient) {
  return {
    async createFromWrongQuestion(accessToken: string, wrongQuestionId: string) {
      return createReviewCardResponseSchema.parse(
        await client.post<unknown>(
          '/reviews/cards/from-wrong-question',
          { wrongQuestionId },
          { accessToken },
        ),
      );
    },

    async getByWrongQuestion(accessToken: string, wrongQuestionId: string) {
      return reviewCardByWrongQuestionResponseSchema.parse(
        await client.get<unknown>(`/reviews/cards/by-wrong-question/${wrongQuestionId}`, {
          accessToken,
        }),
      );
    },

    async getTodayTasks(accessToken: string, date?: string) {
      const query = date ? `?date=${encodeURIComponent(date)}` : '';
      return reviewTodayTasksResponseSchema.parse(
        await client.get<unknown>(`/reviews/tasks/today${query}`, { accessToken }),
      );
    },

    async submitRating(accessToken: string, cardId: string, request: ReviewRatingRequest) {
      return reviewRatingResponseSchema.parse(
        await client.post<unknown>(`/reviews/cards/${cardId}/rating`, request, {
          accessToken,
        }),
      );
    },
  };
}
```

- [ ] **Step 4: Add hooks**

Create `apps/web/src/hooks/use-reviews.ts`:

```ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReviewRatingRequest } from '@repo/types/api/review';

import { apiClient } from '@/lib/api-client';
import { createReviewApi } from '@/lib/review-api';
import { wrongQuestionQueryKeys } from './use-wrong-questions';
import { useUserStore } from '@/stores/userStore';

const reviewApi = createReviewApi(apiClient);

export const reviewQueryKeys = {
  all: ['reviews'] as const,
  today: (date?: string) => [...reviewQueryKeys.all, 'today', date ?? 'server-date'] as const,
  byWrongQuestion: (wrongQuestionId: string) =>
    [...reviewQueryKeys.all, 'by-wrong-question', wrongQuestionId] as const,
};

export function useTodayReviewTasks(date?: string) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewQueryKeys.today(date),
    queryFn: async () => {
      if (!accessToken) throw new Error('Missing access token');
      return reviewApi.getTodayTasks(accessToken, date);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useWrongQuestionReviewCard(wrongQuestionId: string | null | undefined) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewQueryKeys.byWrongQuestion(wrongQuestionId ?? ''),
    queryFn: async () => {
      if (!accessToken) throw new Error('Missing access token');
      if (!wrongQuestionId) return { card: null };
      return reviewApi.getByWrongQuestion(accessToken, wrongQuestionId);
    },
    enabled: sessionHydrated && !!accessToken && !!wrongQuestionId,
    retry: false,
  });
}

export function useCreateReviewCardFromWrongQuestion() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (wrongQuestionId: string) => {
      if (!accessToken) throw new Error('Missing access token');
      return reviewApi.createFromWrongQuestion(accessToken, wrongQuestionId);
    },
    onSuccess: (_data, wrongQuestionId) => {
      void queryClient.invalidateQueries({
        queryKey: reviewQueryKeys.byWrongQuestion(wrongQuestionId),
      });
      void queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: wrongQuestionQueryKeys.all });
    },
  });
}

export function useSubmitReviewRating() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      cardId,
      request,
    }: {
      cardId: string;
      request: ReviewRatingRequest;
    }) => {
      if (!accessToken) throw new Error('Missing access token');
      return reviewApi.submitRating(accessToken, cardId, request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all });
    },
  });
}
```

- [ ] **Step 5: Run tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/review-api.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/lib/review-api.ts apps/web/src/lib/review-api.test.mts apps/web/src/hooks/use-reviews.ts
git commit -m "feat: add review api client"
```

---

## Task 6: Connect Wrong Question Detail to Review Cards

**Files:**

- Modify: `apps/web/src/app/(main)/error-book/page.tsx`

- [ ] **Step 1: Locate selected-detail render block**

Run:

```powershell
rg "错题详情|标为已掌握|我的备注|删除错题" "apps/web/src/app/(main)/error-book/page.tsx" -n
```

Expected: output shows the detail component area and action buttons.

- [ ] **Step 2: Add imports**

Add imports near existing hooks:

```ts
import {
  useCreateReviewCardFromWrongQuestion,
  useWrongQuestionReviewCard,
} from '@/hooks/use-reviews';
```

- [ ] **Step 3: Add selected card query and mutation in the page component**

Inside `ErrorBookPage`, after `selected` state and wrong-question mutations are declared, add:

```ts
const selectedReviewCardQuery = useWrongQuestionReviewCard(selected?.id);
const createReviewCard = useCreateReviewCardFromWrongQuestion();
```

Add handler:

```ts
const addSelectedToReview = async () => {
  if (!selected) return;
  try {
    await createReviewCard.mutateAsync(selected.id);
    notifyCrudSuccess('已加入复习计划');
  } catch (error) {
    notifyCrudError(getMutationErrorMessage(error));
  }
};
```

Use existing feedback helpers in the file. If the file currently names the helpers differently, use the exact local helper names already used for note save / status toggle success and error.

- [ ] **Step 4: Add review action UI in detail action bar**

In the detail action area beside status and delete buttons, render:

```tsx
{selectedReviewCardQuery.data?.card ? (
  <button
    type="button"
    disabled
    className="tap-target flex min-h-11 items-center justify-center rounded-2xl bg-[#eafff9] px-3 text-sm font-semibold text-[#247269] ring-1 ring-[#bdeee5]"
  >
    复习中 · 下次 {formatReviewDate(selectedReviewCardQuery.data.card.nextReview)}
  </button>
) : (
  <button
    type="button"
    onClick={() => void addSelectedToReview()}
    disabled={createReviewCard.isPending || !selected}
    className="tap-target flex min-h-11 items-center justify-center rounded-2xl bg-[#86dccf] px-3 text-sm font-semibold text-[#173b37] transition-all active:scale-[0.98] disabled:bg-white/70 disabled:text-[var(--pm-muted)]"
  >
    {createReviewCard.isPending ? '加入中...' : '加入复习'}
  </button>
)}
```

Add helper near other local helpers:

```ts
function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
```

- [ ] **Step 5: Run focused checks**

Run:

```powershell
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: both commands exit 0.

- [ ] **Step 6: Manual browser check**

Start project:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

Check:

- Open `/error-book`.
- Open a wrong question detail.
- Click `加入复习`.
- Confirm button changes to `复习中`.
- Refresh page and confirm `复习中` remains.

- [ ] **Step 7: Commit**

```powershell
git add "apps/web/src/app/(main)/error-book/page.tsx"
git commit -m "feat: add wrong question review entry"
```

---

## Task 7: Add Today Review Tasks UI

**Files:**

- Modify: `apps/web/src/app/(main)/today/page.tsx`

- [ ] **Step 1: Add imports**

Add:

```ts
import { useMemo, useState } from 'react';
import type { ReviewTaskResponse, ReviewRating } from '@repo/types/api/review';
import { useSubmitReviewRating, useTodayReviewTasks } from '@/hooks/use-reviews';
```

If the file already imports `useMemo` or `useState`, merge imports instead of duplicating them.

- [ ] **Step 2: Add query and mutation**

Inside `TodayPage`, after existing local task state:

```ts
const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
const todayReviewTasks = useTodayReviewTasks(todayKey);
const submitReviewRating = useSubmitReviewRating();
const [revealedCardIds, setRevealedCardIds] = useState<Set<string>>(new Set());
```

Add handlers:

```ts
const toggleAnswer = (cardId: string) => {
  setRevealedCardIds((prev) => {
    const next = new Set(prev);
    if (next.has(cardId)) {
      next.delete(cardId);
    } else {
      next.add(cardId);
    }
    return next;
  });
};

const rateCard = async (cardId: string, rating: ReviewRating) => {
  await submitReviewRating.mutateAsync({
    cardId,
    request: {
      rating,
      reviewedAt: new Date().toISOString(),
    },
  });
};
```

- [ ] **Step 3: Add review summary to top stats**

In the summary section that currently shows progress and wrong-question count, add:

```tsx
<div className="rounded-2xl bg-white/60 px-3 py-2 ring-1 ring-[var(--pm-line)]">
  <p className="text-xs text-[var(--pm-muted)]">今日待复习</p>
  <p className="mt-1 text-lg font-bold text-[var(--pm-ink)]">
    {todayReviewTasks.data?.dueCount ?? 0} 张
  </p>
</div>
```

- [ ] **Step 4: Add review section**

Render this section above the local static task list:

```tsx
<section className="pm-glass-card pm-enter rounded-[1.5rem] p-4">
  <div className="flex items-center justify-between gap-3">
    <div>
      <h2 className="text-base font-semibold">今日复习</h2>
      <p className="mt-1 text-xs text-[var(--pm-muted)]">
        根据错题复习卡片自动生成
      </p>
    </div>
    <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#247269] ring-1 ring-[var(--pm-line)]">
      {todayReviewTasks.data?.dueCount ?? 0} 张
    </span>
  </div>

  <div className="mt-3 space-y-3">
    {todayReviewTasks.isLoading ? (
      <p className="rounded-2xl bg-white/70 px-3 py-3 text-sm text-[var(--pm-muted)]">
        正在读取今日复习...
      </p>
    ) : todayReviewTasks.data?.tasks.length ? (
      todayReviewTasks.data.tasks.map((task) => (
        <ReviewTaskCard
          key={task.cardId}
          task={task}
          revealed={revealedCardIds.has(task.cardId)}
          ratingPending={submitReviewRating.isPending}
          onToggleAnswer={() => toggleAnswer(task.cardId)}
          onRate={(rating) => void rateCard(task.cardId, rating)}
        />
      ))
    ) : (
      <p className="rounded-2xl bg-white/70 px-3 py-3 text-sm text-[var(--pm-muted)]">
        今天没有到期复习卡片。可以从错题详情里加入复习。
      </p>
    )}
  </div>
</section>
```

- [ ] **Step 5: Add `ReviewTaskCard` component**

Add below existing local components in `today/page.tsx`:

```tsx
function ReviewTaskCard({
  task,
  revealed,
  ratingPending,
  onToggleAnswer,
  onRate,
}: {
  task: ReviewTaskResponse;
  revealed: boolean;
  ratingPending: boolean;
  onToggleAnswer: () => void;
  onRate: (rating: ReviewRating) => void;
}) {
  const wrongQuestion = task.wrongQuestion;

  return (
    <article className="rounded-[1.25rem] bg-white/72 p-3 ring-1 ring-[var(--pm-line)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#247269]">
            {wrongQuestion?.subject ?? '复习卡片'} · {task.state}
          </p>
          <p className="mt-1 line-clamp-3 text-sm font-semibold leading-6 text-[var(--pm-ink)]">
            {wrongQuestion?.questionText ?? '这张复习卡片暂时没有题干'}
          </p>
          {wrongQuestion?.knowledgePoints.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {wrongQuestion.knowledgePoints.slice(0, 3).map((point) => (
                <span
                  key={point}
                  className="rounded-full bg-[#eafff9] px-2 py-0.5 text-[11px] font-semibold text-[#247269]"
                >
                  {point}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {revealed && wrongQuestion ? (
        <div className="mt-3 space-y-2 rounded-2xl bg-white/75 p-3 text-sm leading-6 ring-1 ring-[var(--pm-line)]">
          <div>
            <p className="text-xs font-semibold text-[var(--pm-muted)]">参考答案</p>
            <p className="mt-1">{wrongQuestion.answer || '暂无答案'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--pm-muted)]">解析</p>
            <p className="mt-1">{wrongQuestion.analysis || '暂无解析'}</p>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onToggleAnswer}
        className="tap-target mt-3 flex min-h-10 w-full items-center justify-center rounded-2xl bg-white/75 text-sm font-semibold text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all active:scale-[0.98]"
      >
        {revealed ? '收起答案' : '查看答案'}
      </button>

      {revealed ? (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {[
            [1, 'Again'],
            [2, 'Hard'],
            [3, 'Good'],
            [4, 'Easy'],
          ].map(([rating, label]) => (
            <button
              key={rating}
              type="button"
              disabled={ratingPending}
              onClick={() => onRate(rating as ReviewRating)}
              className="tap-target min-h-10 rounded-2xl bg-[#86dccf] text-xs font-bold text-[#173b37] transition-all active:scale-[0.96] disabled:bg-white/70 disabled:text-[var(--pm-muted)]"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 6: Run checks**

Run:

```powershell
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: both commands exit 0.

- [ ] **Step 7: Browser check**

Check:

- Add one wrong question to review from `/error-book`.
- Open `/today`.
- See the card in “今日复习”.
- Open answer.
- Click `Good`.
- Confirm card disappears or due count decreases after query invalidation.
- Refresh page and confirm the reviewed card is not due today if scheduled for tomorrow.

- [ ] **Step 8: Commit**

```powershell
git add "apps/web/src/app/(main)/today/page.tsx"
git commit -m "feat: show fsrs reviews in today tasks"
```

---

## Task 8: Final Verification and Documentation

**Files:**

- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Update data-flow**

Add a Phase 4 section to `docs/data-flow.md`:

```md
## FSRS 复习数据流

错题详情
  -> POST /reviews/cards/from-wrong-question
  -> Card(wrongQuestionId) 写入 PostgreSQL
  -> 今日任务读取 /reviews/tasks/today
  -> 用户查看答案并评分
  -> POST /reviews/cards/:cardId/rating
  -> @repo/fsrs 计算下一次复习时间
  -> 更新 Card + 写入 ReviewLog
```

Add boundary notes:

```md
- Card / ReviewLog 以 PostgreSQL 为权威来源。
- Phase 4.1 的 ReviewTask 是 API 派生视图，不单独建表。
- 复习评分第一轮不进入 Dexie mutationQueue，失败时提示用户重试。
```

- [ ] **Step 2: Update roadmap and assistant docs**

In `docs/roadmap.md`, mark Phase 4 as completed only if all browser verification passes. If only backend/API is complete, mark Phase 4.1 completed and Phase 4 still in progress.

Update `AGENTS.md` and `CLAUDE.md` current progress:

```md
Phase 4.1 — FSRS 复习闭环已完成：
- 错题可加入复习卡片。
- 今日任务可读取到期复习卡片。
- Again / Hard / Good / Easy 评分会更新 Card 并写入 ReviewLog。
```

- [ ] **Step 3: Update DEVLOG**

Append under `2026-06-14` or current development date:

```md
**Phase 4.1 FSRS 复习闭环**

- 实现 `@repo/fsrs` 纯调度算法。
- 新增 Review API contract、Prisma Card / ReviewLog 调整和 NestJS Review API。
- 错题详情支持加入复习。
- 今日任务接入到期复习卡片和 Again / Hard / Good / Easy 评分。

验证：

- `bun --cwd packages/fsrs test` 通过。
- `node --experimental-strip-types packages/types/tests/review.test.mts` 通过。
- `bun --cwd packages/types typecheck` 通过。
- `bun --filter @repo/server lint` 通过。
- `bun --filter @repo/server build` 通过。
- `bun --filter @repo/server test` 通过。
- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过。
- 浏览器验收通过：错题加入复习、今日复习、评分后刷新状态保持。
```

- [ ] **Step 4: Run full verification**

Run:

```powershell
node --experimental-strip-types packages/types/tests/review.test.mts
bun --cwd packages/types typecheck
bun --cwd packages/fsrs test
bun --cwd packages/database test
bun run db:generate
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/web lint
bun --filter @repo/web build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Browser verification**

Start infrastructure and servers:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

Verify in browser:

- Register or login.
- Save an OCR wrong question if no wrong question exists.
- Open wrong question detail.
- Click `加入复习`.
- Open `/today`.
- Reveal answer.
- Click `Good`.
- Refresh `/today`.
- Confirm card is no longer due today.
- Confirm browser console has no new business errors.

- [ ] **Step 6: Commit docs**

```powershell
git add docs/data-flow.md docs/roadmap.md AGENTS.md CLAUDE.md DEVLOG.md
git commit -m "docs: record phase 4 fsrs review flow"
```

---

## Final Completion Checklist

- [ ] `@repo/fsrs` exports deterministic scheduling and has tests.
- [ ] `@repo/types/api/review` validates all Review API payloads.
- [ ] Prisma schema supports wrong-question review cards.
- [ ] NestJS Review API is guarded by `JwtAuthGuard`.
- [ ] Review API scopes every query and mutation by `userId`.
- [ ] WrongQuestion detail can create and display review card state.
- [ ] Today page displays due review tasks.
- [ ] Rating writes `ReviewLog` and updates `Card`.
- [ ] Refreshing the app restores review state from PostgreSQL.
- [ ] Existing Chat / OCR / WrongQuestion flows still pass build and browser smoke checks.

## Self-Review Notes

- Spec coverage: all in-scope items from `2026-06-14-phase-4-fsrs-design.md` map to Tasks 1 through 8.
- Scope guard: persistent ReviewTask table, offline review queue, decks, reminders, statistics dashboard, RAG, and Agent automation stay out of this plan.
- Type consistency: this plan uses `wrongQuestionId`, `ReviewRating`, `reviewCount`, `lapses`, `nextReview`, and `ReviewTaskResponse` consistently across schema, server, and web tasks.
