# Phase 6.5 ReviewAgent / PlannerAgent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only ReviewAgent / PlannerAgent suggestion loop that diagnoses weak review areas and displays practical study-plan guidance without creating future tasks or calling live models.

**Architecture:** `@repo/types` defines the API contract, `@repo/agent` owns deterministic policy functions, NestJS aggregates current-user review facts and exposes a read-only `/review-agent/suggestions` endpoint, and Next.js displays the suggestion on `/plan` and `/today`. `Card`, `ReviewLog`, `ReviewTask`, `ReviewPreference`, and wrong-question organizer data remain the authority; Agent output is advisory only.

**Tech Stack:** Bun workspace, TypeScript, Zod, `@repo/agent`, NestJS 11, Prisma/PostgreSQL, TanStack Query, Next.js 16, React 19, Tailwind 4.

---

## File Structure

- Create `packages/types/src/api/review-agent.ts`: shared query, policy input/output, and API response schemas.
- Modify `packages/types/src/api/index.ts`: export the new contract from the package API barrel.
- Create `packages/types/tests/review-agent.test.mts`: schema coverage for query defaults and response shape.
- Modify `packages/agent/src/nodes/review.ts`: replace the placeholder with deterministic `analyzeReview()`.
- Modify `packages/agent/src/nodes/planner.ts`: replace the placeholder with deterministic `planStudy()`.
- Modify `packages/agent/src/index.ts`: export review and planner nodes from the package root.
- Modify `packages/agent/package.json`: add `./review` and `./planner` export subpaths.
- Create `packages/agent/tests/review.test.ts`: ReviewAgent policy tests.
- Create `packages/agent/tests/planner.test.ts`: PlannerAgent policy tests.
- Create `apps/server/src/review-agent/review-agent.controller.ts`: authenticated read-only endpoint.
- Create `apps/server/src/review-agent/review-agent.service.ts`: user-scoped data aggregation and policy orchestration.
- Create `apps/server/src/review-agent/review-agent.module.ts`: NestJS module wiring.
- Create `apps/server/src/review-agent/review-agent.service.spec.ts`: unit tests for aggregation and no-write behavior.
- Modify `apps/server/src/app.module.ts`: import `ReviewAgentModule`.
- Create or extend `apps/server/test/review-agent.e2e-spec.ts`: authenticated endpoint e2e coverage.
- Create `apps/web/src/lib/review-agent-api.ts`: API client wrapper and schema parsing.
- Create `apps/web/src/lib/review-agent-api.test.mts`: URL/query/schema tests.
- Create `apps/web/src/hooks/use-review-agent-suggestions.ts`: TanStack Query hook and stable query keys.
- Create `apps/web/src/lib/review-agent-view.ts`: UI helper functions for labels and compact copy.
- Create `apps/web/src/lib/review-agent-view.test.mts`: helper coverage.
- Create `apps/web/src/components/review-agent/review-agent-suggestion-card.tsx`: shared suggestion card for plan and today pages.
- Modify `apps/web/src/app/(main)/plan/page.tsx`: display full Agent suggestion.
- Modify `apps/web/src/app/(main)/today/page.tsx`: display compact today suggestion.
- Update `docs/data-flow.md`, `docs/roadmap.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, and `DEVLOG.md` after implementation and verification.

## Scope Rules

- Do not create `ReviewTask(source=PLANNER)`.
- Do not update `Card`, `ReviewLog`, `ReviewPreference`, `WrongQuestion`, deck, or deck item data from the new endpoint.
- Do not import `streamText`, `AI_PROVIDER_MODE`, `AI_ENABLE_LIVE_CALLS`, `OPENAI_API_KEY`, or `DEEPSEEK_API_KEY` inside `packages/agent/src/nodes/review.ts` or `packages/agent/src/nodes/planner.ts`.
- Do not hide existing `/plan` or `/today` content when the Agent suggestion endpoint fails.
- Keep all service reads scoped by the authenticated `userId`.

---

### Task 1: Shared ReviewAgent Contract

**Files:**
- Create: `packages/types/src/api/review-agent.ts`
- Modify: `packages/types/src/api/index.ts`
- Test: `packages/types/tests/review-agent.test.mts`

- [ ] **Step 1: Write the failing schema tests**

Create `packages/types/tests/review-agent.test.mts`:

```ts
import assert from 'node:assert/strict';

import {
  reviewAgentPrioritySchema,
  reviewAgentSuggestionQuerySchema,
  reviewAgentSuggestionResponseSchema,
} from '../src/api/review-agent';

testQueryDefaults();
testInvalidDaysRejected();
testValidSuggestionResponse();

function testQueryDefaults() {
  const parsed = reviewAgentSuggestionQuerySchema.parse({});

  assert.equal(parsed.days, 7);
  assert.equal(parsed.timezoneOffsetMinutes, 0);
  assert.equal(parsed.startDate, undefined);
}

function testInvalidDaysRejected() {
  assert.throws(() => reviewAgentSuggestionQuerySchema.parse({ days: 15 }));
  assert.throws(() =>
    reviewAgentSuggestionQuerySchema.parse({ startDate: '2026-02-30' }),
  );
}

function testValidSuggestionResponse() {
  assert.equal(reviewAgentPrioritySchema.parse('high'), 'high');

  const parsed = reviewAgentSuggestionResponseSchema.parse({
    generatedAt: '2026-06-22T00:00:00.000Z',
    review: {
      priority: 'high',
      summary: '逾期和低稳定度卡片较多，今天先清理高风险专题。',
      weakPoints: [
        {
          label: '格林公式',
          reason: '最近 Again 次数较高，且平均稳定度偏低。',
          priority: 'high',
          confidence: 0.88,
        },
      ],
      actions: [
        {
          title: '复盘格林公式专题',
          description: '先看错题，再完成到期复习卡。',
          targetHref: '/error-book',
        },
      ],
      signals: ['overdue', 'recentAgain', 'lowStability'],
    },
    planner: {
      headline: '今天先稳住逾期复习',
      todayFocus: '优先处理逾期卡片，再复盘格林公式。',
      weekStrategy: '未来几天保持每日 20 分钟复习。',
      capacityNotice: '预计超过当前每日容量，建议缩小今日目标。',
      suggestedBlocks: [
        {
          title: '清理逾期复习',
          minutes: 20,
          reason: '逾期卡片会拉高遗忘风险。',
          targetHref: '/today',
        },
      ],
      signals: ['capacityOver'],
    },
    planSummary: {
      overdueCount: 5,
      todayDueCount: 3,
      upcomingDueCount: 8,
      estimatedTotalMinutes: 42,
      peakDay: {
        date: '2026-06-25',
        count: 9,
      },
      intensity: 'heavy',
      capacityStatus: 'over',
      dailyMinutes: 30,
      dailyCardLimit: 12,
    },
  });

  assert.equal(parsed.review.weakPoints[0]?.label, '格林公式');
  assert.equal(parsed.planner.suggestedBlocks[0]?.targetHref, '/today');
}
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```powershell
bun --cwd packages/types test tests/review-agent.test.mts
```

Expected: FAIL because `packages/types/src/api/review-agent.ts` does not exist.

- [ ] **Step 3: Add the shared schema**

Create `packages/types/src/api/review-agent.ts`:

```ts
import { z } from 'zod';

import { reviewPreferenceSchema } from './review-preference';
import {
  reviewTaskPlanCapacityStatusSchema,
  reviewTaskPlanIntensitySchema,
  reviewTaskPlanQuerySchema,
  reviewTaskPlanResponseSchema,
} from './review-task';

export const reviewAgentPrioritySchema = z.enum(['low', 'medium', 'high']);

export const reviewAgentWeakPointInputSchema = z.object({
  label: z.string().min(1),
  subject: z.string().min(1).optional(),
  deckName: z.string().min(1).optional(),
  wrongCount: z.number().int().nonnegative(),
  recentAgainCount: z.number().int().nonnegative(),
  averageDifficulty: z.number().nonnegative(),
  averageStability: z.number().nonnegative(),
});

export const reviewAgentInputSchema = z.object({
  now: z.string().datetime(),
  weakKnowledgePoints: z.array(reviewAgentWeakPointInputSchema),
  cardSummary: z.object({
    dueCount: z.number().int().nonnegative(),
    overdueCount: z.number().int().nonnegative(),
    highDifficultyCount: z.number().int().nonnegative(),
    lowStabilityCount: z.number().int().nonnegative(),
  }),
  recentReviewSummary: z.object({
    totalReviews: z.number().int().nonnegative(),
    againCount: z.number().int().nonnegative(),
    hardCount: z.number().int().nonnegative(),
    goodCount: z.number().int().nonnegative(),
    easyCount: z.number().int().nonnegative(),
  }),
});

export const reviewAgentWeakPointSchema = z.object({
  label: z.string().min(1),
  reason: z.string().min(1),
  priority: reviewAgentPrioritySchema,
  confidence: z.number().min(0).max(1),
});

export const reviewAgentActionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  targetHref: z.string().min(1),
});

export const reviewAgentResultSchema = z.object({
  priority: reviewAgentPrioritySchema,
  summary: z.string().min(1),
  weakPoints: z.array(reviewAgentWeakPointSchema),
  actions: z.array(reviewAgentActionSchema),
  signals: z.array(z.string().min(1)),
});

export const plannerAgentInputSchema = z.object({
  review: reviewAgentResultSchema,
  plan: reviewTaskPlanResponseSchema,
  preference: reviewPreferenceSchema,
});

export const plannerAgentBlockSchema = z.object({
  title: z.string().min(1),
  minutes: z.number().int().positive(),
  reason: z.string().min(1),
  targetHref: z.string().min(1),
});

export const plannerAgentResultSchema = z.object({
  headline: z.string().min(1),
  todayFocus: z.string().min(1),
  weekStrategy: z.string().min(1),
  capacityNotice: z.string().min(1).optional(),
  suggestedBlocks: z.array(plannerAgentBlockSchema),
  signals: z.array(z.string().min(1)),
});

export const reviewAgentSuggestionQuerySchema = reviewTaskPlanQuerySchema;

export const reviewAgentSuggestionResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  review: reviewAgentResultSchema,
  planner: plannerAgentResultSchema,
  planSummary: z.object({
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
    capacityStatus: reviewTaskPlanCapacityStatusSchema,
    dailyMinutes: z.number().int().positive(),
    dailyCardLimit: z.number().int().positive(),
  }),
});

export type ReviewAgentPriority = z.infer<typeof reviewAgentPrioritySchema>;
export type ReviewAgentWeakPointInput = z.infer<typeof reviewAgentWeakPointInputSchema>;
export type ReviewAgentInput = z.infer<typeof reviewAgentInputSchema>;
export type ReviewAgentWeakPoint = z.infer<typeof reviewAgentWeakPointSchema>;
export type ReviewAgentAction = z.infer<typeof reviewAgentActionSchema>;
export type ReviewAgentResult = z.infer<typeof reviewAgentResultSchema>;
export type PlannerAgentInput = z.infer<typeof plannerAgentInputSchema>;
export type PlannerAgentBlock = z.infer<typeof plannerAgentBlockSchema>;
export type PlannerAgentResult = z.infer<typeof plannerAgentResultSchema>;
export type ReviewAgentSuggestionQuery = z.infer<typeof reviewAgentSuggestionQuerySchema>;
export type ReviewAgentSuggestionResponse = z.infer<
  typeof reviewAgentSuggestionResponseSchema
>;
```

- [ ] **Step 4: Export the contract from the API barrel**

Modify `packages/types/src/api/index.ts` by adding:

```ts
export * from './review-agent';
```

- [ ] **Step 5: Verify the type contract**

Run:

```powershell
bun --cwd packages/types test tests/review-agent.test.mts
bun --cwd packages/types typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add packages/types/src/api/review-agent.ts packages/types/src/api/index.ts packages/types/tests/review-agent.test.mts
git commit -m "feat: add review agent api contract"
```

---

### Task 2: Deterministic ReviewAgent Policy

**Files:**
- Modify: `packages/agent/src/nodes/review.ts`
- Modify: `packages/agent/src/index.ts`
- Modify: `packages/agent/package.json`
- Test: `packages/agent/tests/review.test.ts`

- [ ] **Step 1: Write the failing ReviewAgent tests**

Create `packages/agent/tests/review.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import { analyzeReview } from '../src/nodes/review';

const now = '2026-06-22T00:00:00.000Z';

describe('analyzeReview', () => {
  it('raises priority for overdue and repeated Again signals', () => {
    const result = analyzeReview({
      now,
      weakKnowledgePoints: [
        {
          label: '格林公式',
          subject: '高等数学',
          deckName: '曲线积分',
          wrongCount: 6,
          recentAgainCount: 3,
          averageDifficulty: 8.2,
          averageStability: 0.8,
        },
        {
          label: '极限计算',
          subject: '高等数学',
          wrongCount: 4,
          recentAgainCount: 1,
          averageDifficulty: 6,
          averageStability: 2.4,
        },
      ],
      cardSummary: {
        dueCount: 7,
        overdueCount: 5,
        highDifficultyCount: 4,
        lowStabilityCount: 5,
      },
      recentReviewSummary: {
        totalReviews: 12,
        againCount: 4,
        hardCount: 3,
        goodCount: 4,
        easyCount: 1,
      },
    });

    expect(result.priority).toBe('high');
    expect(result.weakPoints[0]?.label).toBe('格林公式');
    expect(result.weakPoints[0]?.priority).toBe('high');
    expect(result.actions[0]?.targetHref).toBe('/today');
    expect(result.signals).toContain('overdue');
    expect(result.signals).toContain('recentAgain');
    expect(result.signals).toContain('lowStability');
  });

  it('returns a low-pressure summary when there are no weak signals', () => {
    const result = analyzeReview({
      now,
      weakKnowledgePoints: [],
      cardSummary: {
        dueCount: 0,
        overdueCount: 0,
        highDifficultyCount: 0,
        lowStabilityCount: 0,
      },
      recentReviewSummary: {
        totalReviews: 0,
        againCount: 0,
        hardCount: 0,
        goodCount: 0,
        easyCount: 0,
      },
    });

    expect(result.priority).toBe('low');
    expect(result.weakPoints).toEqual([]);
    expect(result.actions[0]?.targetHref).toBe('/error-book');
    expect(result.signals).toContain('lowPressure');
  });
});
```

- [ ] **Step 2: Run the ReviewAgent test to verify it fails**

Run:

```powershell
bun --cwd packages/agent test tests/review.test.ts
```

Expected: FAIL because `analyzeReview` is not exported by `packages/agent/src/nodes/review.ts`.

- [ ] **Step 3: Implement `analyzeReview()`**

Replace `packages/agent/src/nodes/review.ts` with:

```ts
import type {
  ReviewAgentInput,
  ReviewAgentPriority,
  ReviewAgentResult,
  ReviewAgentWeakPointInput,
} from '@repo/types/api/review-agent';

export function analyzeReview(input: ReviewAgentInput): ReviewAgentResult {
  const sortedWeakPoints = [...input.weakKnowledgePoints]
    .sort(compareWeakPoints)
    .slice(0, 5);
  const weakPoints = sortedWeakPoints.map(toWeakPointResult);
  const signals = collectSignals(input);
  const priority = resolvePriority(input, weakPoints.map((point) => point.priority));

  if (weakPoints.length === 0 && priority === 'low') {
    return {
      priority: 'low',
      summary: '当前没有明显高风险薄弱点，保持复习节奏即可。',
      weakPoints: [],
      actions: [
        {
          title: '整理新的错题',
          description: '如果今天没有到期复习，可以把最近保存的错题补充到专题里。',
          targetHref: '/error-book',
        },
      ],
      signals: ['lowPressure'],
    };
  }

  return {
    priority,
    summary: buildSummary(input, priority, weakPoints[0]?.label),
    weakPoints,
    actions: buildActions(priority, weakPoints),
    signals,
  };
}

export const reviewNode = analyzeReview;

function compareWeakPoints(left: ReviewAgentWeakPointInput, right: ReviewAgentWeakPointInput) {
  return (
    right.recentAgainCount - left.recentAgainCount ||
    right.wrongCount - left.wrongCount ||
    right.averageDifficulty - left.averageDifficulty ||
    left.label.localeCompare(right.label)
  );
}

function toWeakPointResult(point: ReviewAgentWeakPointInput) {
  const priority = resolveWeakPointPriority(point);
  const reasonParts = [
    point.recentAgainCount > 0 ? `最近 Again ${point.recentAgainCount} 次` : '',
    point.wrongCount > 0 ? `累计关联 ${point.wrongCount} 道错题` : '',
    point.averageStability > 0 && point.averageStability < 1.5 ? '稳定度偏低' : '',
    point.averageDifficulty >= 7 ? '难度偏高' : '',
  ].filter(Boolean);

  return {
    label: point.label,
    reason: reasonParts.length ? reasonParts.join('，') : '该知识点在错题和复习记录中反复出现。',
    priority,
    confidence: calculateConfidence(point, priority),
  };
}

function resolveWeakPointPriority(point: ReviewAgentWeakPointInput): ReviewAgentPriority {
  if (point.recentAgainCount >= 3 || point.averageStability < 1.2 || point.wrongCount >= 6) {
    return 'high';
  }
  if (point.recentAgainCount >= 1 || point.averageDifficulty >= 7 || point.wrongCount >= 3) {
    return 'medium';
  }
  return 'low';
}

function resolvePriority(
  input: ReviewAgentInput,
  weakPriorities: ReviewAgentPriority[],
): ReviewAgentPriority {
  if (
    input.cardSummary.overdueCount >= 5 ||
    input.cardSummary.lowStabilityCount >= 5 ||
    input.recentReviewSummary.againCount >= 3 ||
    weakPriorities.includes('high')
  ) {
    return 'high';
  }

  if (
    input.cardSummary.overdueCount > 0 ||
    input.cardSummary.dueCount > 0 ||
    input.cardSummary.highDifficultyCount > 0 ||
    weakPriorities.includes('medium')
  ) {
    return 'medium';
  }

  return 'low';
}

function calculateConfidence(
  point: ReviewAgentWeakPointInput,
  priority: ReviewAgentPriority,
): number {
  let confidence = priority === 'high' ? 0.78 : priority === 'medium' ? 0.66 : 0.52;
  if (point.recentAgainCount > 0) confidence += 0.08;
  if (point.wrongCount >= 3) confidence += 0.06;
  if (point.deckName) confidence += 0.04;
  return Math.min(0.95, Number(confidence.toFixed(2)));
}

function collectSignals(input: ReviewAgentInput): string[] {
  const signals: string[] = [];
  if (input.cardSummary.overdueCount > 0) signals.push('overdue');
  if (input.recentReviewSummary.againCount > 0) signals.push('recentAgain');
  if (input.cardSummary.highDifficultyCount > 0) signals.push('highDifficulty');
  if (input.cardSummary.lowStabilityCount > 0) signals.push('lowStability');
  if (input.weakKnowledgePoints.length > 0) signals.push('weakKnowledgePoint');
  if (signals.length === 0) signals.push('lowPressure');
  return signals;
}

function buildSummary(
  input: ReviewAgentInput,
  priority: ReviewAgentPriority,
  topLabel: string | undefined,
) {
  if (priority === 'high') {
    return topLabel
      ? `当前复习风险偏高，优先处理「${topLabel}」以及逾期卡片。`
      : '当前复习风险偏高，优先清理逾期和低稳定度卡片。';
  }

  if (priority === 'medium') {
    return topLabel
      ? `今天有一些复习压力，可以先复盘「${topLabel}」。`
      : '今天有一些复习压力，按计划完成到期卡片即可。';
  }

  return '当前复习压力较轻，适合做错题整理和轻量巩固。';
}

function buildActions(priority: ReviewAgentPriority, weakPoints: { label: string }[]) {
  if (priority === 'high') {
    return [
      {
        title: '先完成今日复习',
        description: '优先清理逾期和低稳定度卡片，避免压力继续累积。',
        targetHref: '/today',
      },
      {
        title: '复盘薄弱专题',
        description: weakPoints[0]
          ? `围绕「${weakPoints[0].label}」回看错题解析和备注。`
          : '回到错题本按专题复盘薄弱题目。',
        targetHref: '/error-book',
      },
    ];
  }

  return [
    {
      title: '按当前节奏复习',
      description: weakPoints[0]
        ? `完成到期卡片后，补看「${weakPoints[0].label}」相关错题。`
        : '完成到期卡片后，可以整理新的错题。',
      targetHref: '/today',
    },
  ];
}
```

- [ ] **Step 4: Export ReviewAgent**

Modify `packages/agent/src/index.ts` by adding:

```ts
export * from './nodes/review.ts';
```

Modify `packages/agent/package.json` exports:

```json
"./review": "./src/nodes/review.ts"
```

- [ ] **Step 5: Verify ReviewAgent**

Run:

```powershell
bun --cwd packages/agent test tests/review.test.ts
bun --cwd packages/agent typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add packages/agent/src/nodes/review.ts packages/agent/src/index.ts packages/agent/package.json packages/agent/tests/review.test.ts
git commit -m "feat: add deterministic review agent policy"
```

---

### Task 3: Deterministic PlannerAgent Policy

**Files:**
- Modify: `packages/agent/src/nodes/planner.ts`
- Modify: `packages/agent/src/index.ts`
- Modify: `packages/agent/package.json`
- Test: `packages/agent/tests/planner.test.ts`

- [ ] **Step 1: Write the failing PlannerAgent tests**

Create `packages/agent/tests/planner.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import { planStudy } from '../src/nodes/planner';

const basePreference = {
  dailyMinutes: 30,
  dailyCardLimit: 12,
  preferredReviewTime: '20:00',
  reminderEnabled: true,
  reminderLeadMinutes: 30,
  weekendMode: 'same' as const,
  planWindowDays: 7 as const,
  updatedAt: '2026-06-22T00:00:00.000Z',
};

describe('planStudy', () => {
  it('prioritizes overdue review when capacity is over', () => {
    const result = planStudy({
      review: {
        priority: 'high',
        summary: '当前复习风险偏高。',
        weakPoints: [
          {
            label: '格林公式',
            reason: '最近 Again 次数较高。',
            priority: 'high',
            confidence: 0.88,
          },
        ],
        actions: [],
        signals: ['overdue', 'recentAgain'],
      },
      plan: createPlan({
        overdueCount: 6,
        todayDueCount: 8,
        upcomingDueCount: 12,
        capacityStatus: 'over',
        estimatedTotalMinutes: 68,
      }),
      preference: basePreference,
    });

    expect(result.headline).toContain('逾期');
    expect(result.capacityNotice).toBeDefined();
    expect(result.suggestedBlocks[0]?.targetHref).toBe('/today');
    expect(totalMinutes(result.suggestedBlocks)).toBeLessThanOrEqual(30);
    expect(result.signals).toContain('capacityOver');
  });

  it('gives a light-maintenance plan when there is little pressure', () => {
    const result = planStudy({
      review: {
        priority: 'low',
        summary: '当前没有明显高风险薄弱点。',
        weakPoints: [],
        actions: [],
        signals: ['lowPressure'],
      },
      plan: createPlan({
        overdueCount: 0,
        todayDueCount: 0,
        upcomingDueCount: 0,
        capacityStatus: 'under',
        estimatedTotalMinutes: 0,
      }),
      preference: basePreference,
    });

    expect(result.capacityNotice).toBeUndefined();
    expect(result.suggestedBlocks[0]?.targetHref).toBe('/error-book');
    expect(result.signals).toContain('lightPlan');
  });
});

function totalMinutes(blocks: Array<{ minutes: number }>) {
  return blocks.reduce((sum, block) => sum + block.minutes, 0);
}

function createPlan(input: {
  overdueCount: number;
  todayDueCount: number;
  upcomingDueCount: number;
  estimatedTotalMinutes: number;
  capacityStatus: 'under' | 'near' | 'over';
}) {
  return {
    startDate: '2026-06-22',
    endDate: '2026-06-28',
    generatedThroughDate: '2026-06-28',
    summary: {
      overdueCount: input.overdueCount,
      todayDueCount: input.todayDueCount,
      upcomingDueCount: input.upcomingDueCount,
      estimatedTotalMinutes: input.estimatedTotalMinutes,
      peakDay: input.upcomingDueCount
        ? {
            date: '2026-06-25',
            count: input.upcomingDueCount,
          }
        : null,
      intensity: input.todayDueCount + input.overdueCount > 15 ? 'heavy' : 'light',
      capacityStatus: input.capacityStatus,
      dailyMinutes: basePreference.dailyMinutes,
      dailyCardLimit: basePreference.dailyCardLimit,
    },
    days: [
      {
        date: '2026-06-22',
        label: 'Today',
        dueCount: input.todayDueCount,
        overdueCount: input.overdueCount,
        pendingCount: 0,
        completedCount: 0,
        skippedCount: 0,
        estimatedMinutes: Math.min(input.estimatedTotalMinutes, 60),
        intensity: input.todayDueCount + input.overdueCount > 15 ? 'heavy' : 'light',
        pressureScore: input.todayDueCount + input.overdueCount,
        capacityStatus: input.capacityStatus,
        reasons: [],
      },
    ],
    suggestion: {
      title: '计划建议',
      description: '按当前复习压力处理。',
      actionLabel: '去今日任务',
      actionHref: '/today',
    },
  } as const;
}
```

- [ ] **Step 2: Run the PlannerAgent test to verify it fails**

Run:

```powershell
bun --cwd packages/agent test tests/planner.test.ts
```

Expected: FAIL because `planStudy` is not exported by `packages/agent/src/nodes/planner.ts`.

- [ ] **Step 3: Implement `planStudy()`**

Replace `packages/agent/src/nodes/planner.ts` with:

```ts
import type {
  PlannerAgentBlock,
  PlannerAgentInput,
  PlannerAgentResult,
} from '@repo/types/api/review-agent';

export function planStudy(input: PlannerAgentInput): PlannerAgentResult {
  const signals = collectPlannerSignals(input);
  const dailyMinutes = input.preference.dailyMinutes;
  const topWeakPoint = input.review.weakPoints[0]?.label;
  const blocks = buildSuggestedBlocks(input, dailyMinutes);

  if (input.plan.summary.capacityStatus === 'over') {
    return {
      headline: '今天先处理逾期和高风险复习',
      todayFocus: topWeakPoint
        ? `先完成逾期卡片，再复盘「${topWeakPoint}」。`
        : '先完成逾期卡片，再处理今日到期复习。',
      weekStrategy: buildWeekStrategy(input),
      capacityNotice: '预计复习量超过当前每日容量，今天建议缩小目标，先处理最容易遗忘的部分。',
      suggestedBlocks: blocks,
      signals,
    };
  }

  if (input.review.priority === 'high') {
    return {
      headline: '今天重点修复薄弱专题',
      todayFocus: topWeakPoint
        ? `围绕「${topWeakPoint}」做一次错题复盘。`
        : '先复盘最近 Again 和 Hard 较多的错题。',
      weekStrategy: buildWeekStrategy(input),
      suggestedBlocks: blocks,
      signals,
    };
  }

  if (input.plan.summary.todayDueCount > 0 || input.plan.summary.upcomingDueCount > 0) {
    return {
      headline: '按当前节奏完成复习',
      todayFocus: '完成今日到期卡片，保持当前复习节奏。',
      weekStrategy: buildWeekStrategy(input),
      suggestedBlocks: blocks,
      signals,
    };
  }

  return {
    headline: '今天适合轻量整理',
    todayFocus: '暂无明显复习压力，可以整理错题或补充学习资料。',
    weekStrategy: '未来几天压力较轻，适合把错题专题和资料库整理得更清楚。',
    suggestedBlocks: [
      {
        title: '整理错题专题',
        minutes: Math.min(15, dailyMinutes),
        reason: '没有到期压力时，整理错题能提升后续复盘效率。',
        targetHref: '/error-book',
      },
    ],
    signals: [...signals, 'lightPlan'],
  };
}

export const plannerNode = planStudy;

function collectPlannerSignals(input: PlannerAgentInput): string[] {
  const signals: string[] = [];
  if (input.plan.summary.capacityStatus === 'over') signals.push('capacityOver');
  if (input.plan.summary.capacityStatus === 'near') signals.push('capacityNear');
  if (input.plan.summary.overdueCount > 0) signals.push('overdue');
  if (input.plan.summary.peakDay) signals.push('peakDay');
  if (input.review.priority === 'high') signals.push('highReviewPriority');
  if (signals.length === 0) signals.push('steady');
  return signals;
}

function buildSuggestedBlocks(input: PlannerAgentInput, dailyMinutes: number): PlannerAgentBlock[] {
  const blocks: PlannerAgentBlock[] = [];
  const firstBlockMinutes = clampMinutes(Math.ceil(dailyMinutes * 0.6), 10, dailyMinutes);
  const remainingMinutes = Math.max(0, dailyMinutes - firstBlockMinutes);

  if (input.plan.summary.overdueCount > 0 || input.plan.summary.todayDueCount > 0) {
    blocks.push({
      title: input.plan.summary.overdueCount > 0 ? '清理逾期复习' : '完成今日复习',
      minutes: firstBlockMinutes,
      reason: '先处理已经到期的卡片，能最快降低遗忘风险。',
      targetHref: '/today',
    });
  }

  const topWeakPoint = input.review.weakPoints[0]?.label;
  if (topWeakPoint && remainingMinutes >= 8) {
    blocks.push({
      title: `复盘 ${topWeakPoint}`,
      minutes: Math.min(remainingMinutes, 15),
      reason: input.review.weakPoints[0]?.reason ?? '该专题近期风险较高。',
      targetHref: '/error-book',
    });
  }

  if (blocks.length === 0) {
    blocks.push({
      title: '轻量整理错题',
      minutes: Math.min(15, dailyMinutes),
      reason: '当前复习压力不高，整理错题能为后续计划提供更好数据。',
      targetHref: '/error-book',
    });
  }

  return fitBlocksToBudget(blocks, dailyMinutes);
}

function buildWeekStrategy(input: PlannerAgentInput) {
  const peakDay = input.plan.summary.peakDay;
  if (peakDay) {
    return `${peakDay.date} 预计是复习高峰，建议在高峰日前提前回看相关错题专题。`;
  }
  if (input.plan.summary.upcomingDueCount > 0) {
    return '未来几天有少量到期复习，保持每日固定时间完成即可。';
  }
  return '未来几天压力较轻，适合补齐错题备注和资料库。';
}

function clampMinutes(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function fitBlocksToBudget(blocks: PlannerAgentBlock[], dailyMinutes: number) {
  let used = 0;
  return blocks.map((block, index) => {
    const remaining = Math.max(1, dailyMinutes - used);
    const minutes = index === blocks.length - 1 ? Math.min(block.minutes, remaining) : block.minutes;
    used += minutes;
    return { ...block, minutes };
  });
}
```

- [ ] **Step 4: Export PlannerAgent**

Modify `packages/agent/src/index.ts` by adding:

```ts
export * from './nodes/planner.ts';
```

Modify `packages/agent/package.json` exports:

```json
"./planner": "./src/nodes/planner.ts"
```

- [ ] **Step 5: Verify PlannerAgent**

Run:

```powershell
bun --cwd packages/agent test tests/planner.test.ts
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
```

Expected: PASS.

- [ ] **Step 6: Verify cost boundary**

Run:

```powershell
rg -n "streamText|AI_PROVIDER_MODE|AI_ENABLE_LIVE_CALLS|OPENAI_API_KEY|DEEPSEEK_API_KEY" packages/agent/src/nodes/review.ts packages/agent/src/nodes/planner.ts
```

Expected: no output.

- [ ] **Step 7: Commit**

Run:

```powershell
git add packages/agent/src/nodes/planner.ts packages/agent/src/index.ts packages/agent/package.json packages/agent/tests/planner.test.ts
git commit -m "feat: add deterministic planner agent policy"
```

---

### Task 4: Server Read-Only Suggestions API

**Files:**
- Create: `apps/server/src/review-agent/review-agent.controller.ts`
- Create: `apps/server/src/review-agent/review-agent.service.ts`
- Create: `apps/server/src/review-agent/review-agent.module.ts`
- Modify: `apps/server/src/app.module.ts`
- Test: `apps/server/src/review-agent/review-agent.service.spec.ts`

- [ ] **Step 1: Write the failing service tests**

Create `apps/server/src/review-agent/review-agent.service.spec.ts`:

```ts
import { ReviewAgentService } from './review-agent.service';
import { PrismaService } from '../database/prisma.service';
import { ReviewPreferencesService } from '../review-preferences/review-preferences.service';
import { ReviewTasksService } from '../review-tasks/review-tasks.service';

const NOW = new Date('2026-06-22T00:00:00.000Z');

describe('ReviewAgentService', () => {
  const prisma = {
    card: {
      findMany: jest.fn(),
    },
    reviewLog: {
      findMany: jest.fn(),
    },
    reviewTask: {
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const reviewTasksService = {
    getPlan: jest.fn(),
  };
  const reviewPreferencesService = {
    getByUserId: jest.fn(),
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService() {
    return new ReviewAgentService(
      prisma as unknown as PrismaService,
      reviewTasksService as unknown as ReviewTasksService,
      reviewPreferencesService as unknown as ReviewPreferencesService,
    );
  }

  it('returns read-only suggestions based on current user review signals', async () => {
    reviewTasksService.getPlan.mockResolvedValue(createPlan());
    reviewPreferencesService.getByUserId.mockResolvedValue(createPreference());
    prisma.card.findMany.mockResolvedValue([
      createCard({
        id: 'card_1',
        difficulty: 8,
        stability: 0.8,
        wrongQuestion: {
          subject: '高等数学',
          knowledgePoints: ['格林公式'],
          category: '曲线积分',
          deckItems: [
            {
              deck: {
                name: '曲线积分',
                subjectGroup: { displayName: '高等数学' },
              },
            },
          ],
        },
      }),
    ]);
    prisma.reviewLog.findMany.mockResolvedValue([
      {
        rating: 1,
        card: {
          wrongQuestion: {
            knowledgePoints: ['格林公式'],
          },
        },
      },
    ]);

    const result = await createService().getSuggestions('user_1', {
      days: 7,
      startDate: '2026-06-22',
      timezoneOffsetMinutes: -480,
    });

    expect(reviewTasksService.getPlan).toHaveBeenCalledWith('user_1', {
      days: 7,
      startDate: '2026-06-22',
      timezoneOffsetMinutes: -480,
    });
    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user_1', suspendedAt: null }),
      }),
    );
    expect(result.review.weakPoints[0]?.label).toBe('格林公式');
    expect(result.planner.suggestedBlocks.length).toBeGreaterThan(0);
    expect(result.planSummary.overdueCount).toBe(5);
  });

  it('does not write review tasks or card facts', async () => {
    reviewTasksService.getPlan.mockResolvedValue(createPlan());
    reviewPreferencesService.getByUserId.mockResolvedValue(createPreference());
    prisma.card.findMany.mockResolvedValue([]);
    prisma.reviewLog.findMany.mockResolvedValue([]);

    await createService().getSuggestions('user_1', {
      days: 7,
      timezoneOffsetMinutes: 0,
    });

    expect(prisma.reviewTask.create).not.toHaveBeenCalled();
    expect(prisma.reviewTask.createMany).not.toHaveBeenCalled();
    expect(prisma.reviewTask.update).not.toHaveBeenCalled();
    expect(prisma.reviewTask.updateMany).not.toHaveBeenCalled();
  });
});

function createPreference() {
  return {
    dailyMinutes: 30,
    dailyCardLimit: 12,
    preferredReviewTime: '20:00',
    reminderEnabled: true,
    reminderLeadMinutes: 30,
    weekendMode: 'same' as const,
    planWindowDays: 7 as const,
    updatedAt: NOW.toISOString(),
  };
}

function createPlan() {
  return {
    startDate: '2026-06-22',
    endDate: '2026-06-28',
    generatedThroughDate: '2026-06-28',
    summary: {
      overdueCount: 5,
      todayDueCount: 3,
      upcomingDueCount: 6,
      estimatedTotalMinutes: 42,
      peakDay: { date: '2026-06-24', count: 6 },
      intensity: 'heavy' as const,
      capacityStatus: 'over' as const,
      dailyMinutes: 30,
      dailyCardLimit: 12,
    },
    days: [],
    suggestion: {
      title: '先处理逾期卡',
      description: '今天先清理逾期压力。',
      actionLabel: '去今日任务',
      actionHref: '/today',
    },
  };
}

function createCard(input: Record<string, unknown>) {
  return {
    id: 'card_1',
    nextReview: new Date('2026-06-21T00:00:00.000Z'),
    difficulty: 8,
    stability: 0.8,
    wrongQuestion: {
      subject: '高等数学',
      knowledgePoints: ['格林公式'],
      category: '曲线积分',
      deckItems: [],
    },
    ...input,
  };
}
```

- [ ] **Step 2: Run the service test to verify it fails**

Run:

```powershell
bun --filter @repo/server test -- review-agent.service.spec.ts
```

Expected: FAIL because `ReviewAgentService` does not exist.

- [ ] **Step 3: Implement the service**

Create `apps/server/src/review-agent/review-agent.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { analyzeReview } from '@repo/agent/review';
import { planStudy } from '@repo/agent/planner';
import type {
  ReviewAgentInput,
  ReviewAgentSuggestionQuery,
  ReviewAgentSuggestionResponse,
  ReviewAgentWeakPointInput,
} from '@repo/types/api/review-agent';

import { PrismaService } from '../database/prisma.service';
import { ReviewPreferencesService } from '../review-preferences/review-preferences.service';
import { ReviewTasksService } from '../review-tasks/review-tasks.service';

@Injectable()
export class ReviewAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewTasksService: ReviewTasksService,
    private readonly reviewPreferencesService: ReviewPreferencesService,
  ) {}

  async getSuggestions(
    userId: string,
    input: ReviewAgentSuggestionQuery,
  ): Promise<ReviewAgentSuggestionResponse> {
    const [plan, preference, reviewInput] = await Promise.all([
      this.reviewTasksService.getPlan(userId, input),
      this.reviewPreferencesService.getByUserId(userId),
      this.buildReviewInput(userId, input.timezoneOffsetMinutes),
    ]);
    const review = analyzeReview(reviewInput);
    const planner = planStudy({ review, plan, preference });

    return {
      generatedAt: new Date().toISOString(),
      review,
      planner,
      planSummary: plan.summary,
    };
  }

  private async buildReviewInput(
    userId: string,
    timezoneOffsetMinutes: number,
  ): Promise<ReviewAgentInput> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);

    const [cards, logs] = await Promise.all([
      this.prisma.card.findMany({
        where: { userId, suspendedAt: null },
        include: {
          wrongQuestion: {
            include: {
              deckItems: {
                include: {
                  deck: {
                    include: {
                      subjectGroup: true,
                    },
                  },
                },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: [{ nextReview: 'asc' }, { updatedAt: 'desc' }],
        take: 200,
      }),
      this.prisma.reviewLog.findMany({
        where: {
          reviewedAt: { gte: since },
          card: { userId },
        },
        include: {
          card: {
            include: {
              wrongQuestion: true,
            },
          },
        },
        orderBy: { reviewedAt: 'desc' },
        take: 200,
      }),
    ]);

    const weakKnowledgePoints = buildWeakKnowledgePoints(cards, logs);
    const now = new Date();
    const localTodayStart = startOfLocalToday(now, timezoneOffsetMinutes);

    return {
      now: now.toISOString(),
      weakKnowledgePoints,
      cardSummary: {
        dueCount: cards.filter((card) => card.nextReview.getTime() <= now.getTime()).length,
        overdueCount: cards.filter((card) => card.nextReview.getTime() < localTodayStart.getTime())
          .length,
        highDifficultyCount: cards.filter((card) => card.difficulty >= 7).length,
        lowStabilityCount: cards.filter((card) => card.stability > 0 && card.stability < 1.5).length,
      },
      recentReviewSummary: {
        totalReviews: logs.length,
        againCount: logs.filter((log) => log.rating === 1).length,
        hardCount: logs.filter((log) => log.rating === 2).length,
        goodCount: logs.filter((log) => log.rating === 3).length,
        easyCount: logs.filter((log) => log.rating === 4).length,
      },
    };
  }
}

function buildWeakKnowledgePoints(cards: CardForReviewAgent[], logs: LogForReviewAgent[]) {
  const stats = new Map<string, WeakPointStats>();

  for (const card of cards) {
    const wrongQuestion = card.wrongQuestion;
    const labels = normalizeKnowledgeLabels(wrongQuestion?.knowledgePoints ?? []);
    for (const label of labels) {
      const stat = getOrCreate(stats, label);
      stat.subject = wrongQuestion?.subject || stat.subject;
      stat.deckName = wrongQuestion?.deckItems[0]?.deck.name || stat.deckName;
      stat.wrongCount += 1;
      stat.totalDifficulty += card.difficulty;
      stat.totalStability += card.stability;
      stat.cardCount += 1;
    }
  }

  for (const log of logs) {
    if (log.rating !== 1) continue;
    const labels = normalizeKnowledgeLabels(log.card.wrongQuestion?.knowledgePoints ?? []);
    for (const label of labels) {
      getOrCreate(stats, label).recentAgainCount += 1;
    }
  }

  return [...stats.entries()]
    .map(([label, stat]): ReviewAgentWeakPointInput => ({
      label,
      subject: stat.subject,
      deckName: stat.deckName,
      wrongCount: stat.wrongCount,
      recentAgainCount: stat.recentAgainCount,
      averageDifficulty: roundToOne(stat.cardCount ? stat.totalDifficulty / stat.cardCount : 0),
      averageStability: roundToOne(stat.cardCount ? stat.totalStability / stat.cardCount : 0),
    }))
    .sort(
      (left, right) =>
        right.recentAgainCount - left.recentAgainCount ||
        right.wrongCount - left.wrongCount ||
        right.averageDifficulty - left.averageDifficulty ||
        left.label.localeCompare(right.label),
    )
    .slice(0, 5);
}

function normalizeKnowledgeLabels(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function getOrCreate(map: Map<string, WeakPointStats>, label: string) {
  const existing = map.get(label);
  if (existing) return existing;

  const created: WeakPointStats = {
    wrongCount: 0,
    recentAgainCount: 0,
    totalDifficulty: 0,
    totalStability: 0,
    cardCount: 0,
  };
  map.set(label, created);
  return created;
}

function startOfLocalToday(now: Date, timezoneOffsetMinutes: number) {
  const offsetMs = timezoneOffsetMinutes * 60 * 1000;
  const localNow = new Date(now.getTime() - offsetMs);
  const localDateKey = localNow.toISOString().slice(0, 10);
  return new Date(new Date(`${localDateKey}T00:00:00.000Z`).getTime() + offsetMs);
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}

type WeakPointStats = {
  subject?: string;
  deckName?: string;
  wrongCount: number;
  recentAgainCount: number;
  totalDifficulty: number;
  totalStability: number;
  cardCount: number;
};

type CardForReviewAgent = {
  nextReview: Date;
  difficulty: number;
  stability: number;
  wrongQuestion: null | {
    subject: string;
    knowledgePoints: string[];
    deckItems: Array<{
      deck: {
        name: string;
      };
    }>;
  };
};

type LogForReviewAgent = {
  rating: number;
  card: {
    wrongQuestion: null | {
      knowledgePoints: string[];
    };
  };
};
```

- [ ] **Step 4: Implement controller and module**

Create `apps/server/src/review-agent/review-agent.controller.ts`:

```ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { reviewAgentSuggestionQuerySchema } from '@repo/types/api/review-agent';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ReviewAgentService } from './review-agent.service';

@Controller('review-agent')
@UseGuards(JwtAuthGuard)
export class ReviewAgentController {
  constructor(private readonly reviewAgentService: ReviewAgentService) {}

  @Get('suggestions')
  getSuggestions(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = reviewAgentSuggestionQuerySchema.parse(query);
    return this.reviewAgentService.getSuggestions(user.id, input);
  }
}
```

Create `apps/server/src/review-agent/review-agent.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { ReviewPreferencesModule } from '../review-preferences/review-preferences.module';
import { ReviewTasksModule } from '../review-tasks/review-tasks.module';
import { ReviewAgentController } from './review-agent.controller';
import { ReviewAgentService } from './review-agent.service';

@Module({
  imports: [DatabaseModule, ReviewTasksModule, ReviewPreferencesModule],
  controllers: [ReviewAgentController],
  providers: [ReviewAgentService],
})
export class ReviewAgentModule {}
```

Modify `apps/server/src/app.module.ts`:

```ts
import { ReviewAgentModule } from './review-agent/review-agent.module';
```

Add `ReviewAgentModule` to the `imports` array after `ReviewTasksModule`.

- [ ] **Step 5: Verify server unit tests**

Run:

```powershell
bun --filter @repo/server test -- review-agent.service.spec.ts
bun --filter @repo/server test
bun --filter @repo/server build
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add apps/server/src/review-agent apps/server/src/app.module.ts
git commit -m "feat: add review agent suggestions api"
```

---

### Task 5: Server E2E Coverage

**Files:**
- Create: `apps/server/test/review-agent.e2e-spec.ts`

- [ ] **Step 1: Write the e2e test**

Create `apps/server/test/review-agent.e2e-spec.ts` using the auth helpers already used by existing e2e specs. The test must:

```ts
it('returns authenticated read-only review agent suggestions', async () => {
  const user = await registerAndLogin(app, {
    email: 'review-agent@example.com',
    password: 'Password123!',
  });

  const response = await request(app.getHttpServer())
    .get('/review-agent/suggestions?days=7&startDate=2026-06-22&timezoneOffsetMinutes=-480')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.data.review.summary).toEqual(expect.any(String));
  expect(response.body.data.planner.headline).toEqual(expect.any(String));
  expect(response.body.data.planSummary.dailyMinutes).toEqual(expect.any(Number));
});
```

Use the repository's existing e2e app setup, cleanup, and auth helper style instead of creating a parallel test harness.

- [ ] **Step 2: Run the e2e test**

Run:

```powershell
$env:POSTGRES_PORT='5433'
$env:RAG_EMBEDDING_PROVIDER='fake'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
bun --filter @repo/server test:e2e -- review-agent.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 3: Confirm the endpoint is read-only**

Run:

```powershell
rg -n "create\\(|createMany\\(|update\\(|updateMany\\(|delete\\(" apps/server/src/review-agent
```

Expected: no write calls in `review-agent.service.ts`, except no matches or harmless import/test text.

- [ ] **Step 4: Commit**

Run:

```powershell
git add apps/server/test/review-agent.e2e-spec.ts
git commit -m "test: cover review agent suggestions endpoint"
```

---

### Task 6: Web API Client, Hook, and View Helpers

**Files:**
- Create: `apps/web/src/lib/review-agent-api.ts`
- Create: `apps/web/src/lib/review-agent-api.test.mts`
- Create: `apps/web/src/hooks/use-review-agent-suggestions.ts`
- Create: `apps/web/src/lib/review-agent-view.ts`
- Create: `apps/web/src/lib/review-agent-view.test.mts`

- [ ] **Step 1: Write failing web API and helper tests**

Create `apps/web/src/lib/review-agent-api.test.mts`:

```ts
import assert from 'node:assert/strict';

import { createReviewAgentApi } from './review-agent-api.ts';

await testGetsSuggestions();

async function testGetsSuggestions() {
  const requests: Array<{ input: string; options?: { accessToken?: string | null } }> = [];
  const api = createReviewAgentApi({
    get: async (input, options) => {
      requests.push({ input, options });
      return {
        generatedAt: '2026-06-22T00:00:00.000Z',
        review: {
          priority: 'low',
          summary: '当前复习压力较轻。',
          weakPoints: [],
          actions: [],
          signals: ['lowPressure'],
        },
        planner: {
          headline: '今天适合轻量整理',
          todayFocus: '整理错题。',
          weekStrategy: '保持节奏。',
          suggestedBlocks: [
            {
              title: '整理错题专题',
              minutes: 15,
              reason: '提高后续复盘效率。',
              targetHref: '/error-book',
            },
          ],
          signals: ['lightPlan'],
        },
        planSummary: {
          overdueCount: 0,
          todayDueCount: 0,
          upcomingDueCount: 0,
          estimatedTotalMinutes: 0,
          peakDay: null,
          intensity: 'light',
          capacityStatus: 'under',
          dailyMinutes: 30,
          dailyCardLimit: 12,
        },
      };
    },
  });

  const result = await api.getSuggestions('token_1', {
    days: 7,
    startDate: '2026-06-22',
    timezoneOffsetMinutes: -480,
  });

  assert.equal(
    requests[0]?.input,
    '/review-agent/suggestions?days=7&startDate=2026-06-22&timezoneOffsetMinutes=-480',
  );
  assert.equal(requests[0]?.options?.accessToken, 'token_1');
  assert.equal(result.planner.headline, '今天适合轻量整理');
}
```

Create `apps/web/src/lib/review-agent-view.test.mts`:

```ts
import assert from 'node:assert/strict';

import { getReviewAgentPriorityMeta, getReviewAgentShortTodayText } from './review-agent-view.ts';

testPriorityMeta();
testShortTodayText();

function testPriorityMeta() {
  assert.equal(getReviewAgentPriorityMeta('high').label, '高优先级');
  assert.match(getReviewAgentPriorityMeta('low').className, /emerald/);
}

function testShortTodayText() {
  const text = getReviewAgentShortTodayText({
    headline: '今天先处理逾期和高风险复习',
    todayFocus: '先完成逾期卡片，再复盘「格林公式」。',
    weekStrategy: '未来几天保持节奏。',
    suggestedBlocks: [],
    signals: [],
  });

  assert.equal(text, '先完成逾期卡片，再复盘「格林公式」。');
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/review-agent-api.test.mts
node --experimental-strip-types --test apps/web/src/lib/review-agent-view.test.mts
```

Expected: FAIL because the files do not exist.

- [ ] **Step 3: Implement the API client**

Create `apps/web/src/lib/review-agent-api.ts`:

```ts
import {
  reviewAgentSuggestionQuerySchema,
  reviewAgentSuggestionResponseSchema,
  type ReviewAgentSuggestionQuery,
} from '@repo/types/api/review-agent';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

export function createReviewAgentApi(client: ApiClient) {
  return {
    async getSuggestions(accessToken: string, query: ReviewAgentSuggestionQuery) {
      const parsed = reviewAgentSuggestionQuerySchema.parse(query);
      const params = new URLSearchParams();
      params.set('days', String(parsed.days));
      if (parsed.startDate) {
        params.set('startDate', parsed.startDate);
      }
      params.set('timezoneOffsetMinutes', String(parsed.timezoneOffsetMinutes));

      return reviewAgentSuggestionResponseSchema.parse(
        await client.get<unknown>(`/review-agent/suggestions?${params.toString()}`, {
          accessToken,
        }),
      );
    },
  };
}
```

- [ ] **Step 4: Implement the hook**

Create `apps/web/src/hooks/use-review-agent-suggestions.ts`:

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReviewAgentSuggestionQuery } from '@repo/types/api/review-agent';

import { apiClient } from '@/lib/api-client';
import { createReviewAgentApi } from '@/lib/review-agent-api';
import { useUserStore } from '@/stores/userStore';

const reviewAgentApi = createReviewAgentApi(apiClient);

export const reviewAgentQueryKeys = {
  all: ['review-agent'] as const,
  suggestions: (query: ReviewAgentSuggestionQuery) =>
    [...reviewAgentQueryKeys.all, 'suggestions', query] as const,
};

export function useReviewAgentSuggestions(query: ReviewAgentSuggestionQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewAgentQueryKeys.suggestions(query),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewAgentApi.getSuggestions(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}
```

- [ ] **Step 5: Implement view helpers**

Create `apps/web/src/lib/review-agent-view.ts`:

```ts
import type {
  PlannerAgentResult,
  ReviewAgentPriority,
} from '@repo/types/api/review-agent';

const priorityMeta: Record<ReviewAgentPriority, { label: string; className: string }> = {
  low: {
    label: '低压力',
    className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  medium: {
    label: '中优先级',
    className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  },
  high: {
    label: '高优先级',
    className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  },
};

export function getReviewAgentPriorityMeta(priority: ReviewAgentPriority) {
  return priorityMeta[priority];
}

export function getReviewAgentShortTodayText(planner: PlannerAgentResult) {
  return planner.todayFocus.trim() || planner.headline;
}
```

- [ ] **Step 6: Verify web utilities**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/review-agent-api.test.mts
node --experimental-strip-types --test apps/web/src/lib/review-agent-view.test.mts
bun --filter @repo/web test
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add apps/web/src/lib/review-agent-api.ts apps/web/src/lib/review-agent-api.test.mts apps/web/src/hooks/use-review-agent-suggestions.ts apps/web/src/lib/review-agent-view.ts apps/web/src/lib/review-agent-view.test.mts
git commit -m "feat: add review agent web client"
```

---

### Task 7: UI Integration on `/plan` and `/today`

**Files:**
- Create: `apps/web/src/components/review-agent/review-agent-suggestion-card.tsx`
- Modify: `apps/web/src/app/(main)/plan/page.tsx`
- Modify: `apps/web/src/app/(main)/today/page.tsx`

- [ ] **Step 1: Create shared suggestion card**

Create `apps/web/src/components/review-agent/review-agent-suggestion-card.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { ReviewAgentSuggestionResponse } from '@repo/types/api/review-agent';
import { ChevronRight, Sparkles } from 'lucide-react';

import { getReviewAgentPriorityMeta } from '@/lib/review-agent-view';

type ReviewAgentSuggestionCardProps = {
  suggestion: ReviewAgentSuggestionResponse;
  compact?: boolean;
};

export function ReviewAgentSuggestionCard({
  suggestion,
  compact = false,
}: ReviewAgentSuggestionCardProps) {
  const priority = getReviewAgentPriorityMeta(suggestion.review.priority);
  const firstBlock = suggestion.planner.suggestedBlocks[0];

  return (
    <section className="pm-glass-card pm-enter rounded-[1.5rem] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff7d6] text-[#8a6815] ring-1 ring-[#f3e6a8]">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Agent 学习建议</h2>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${priority.className}`}>
              {priority.label}
            </span>
          </div>
          <p className="mt-2 text-sm font-bold leading-6 text-[var(--pm-ink)]">
            {suggestion.planner.headline}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--pm-muted)]">
            {suggestion.planner.todayFocus}
          </p>
          {!compact ? (
            <p className="mt-1 text-xs leading-5 text-[var(--pm-muted)]">
              {suggestion.planner.weekStrategy}
            </p>
          ) : null}
          {suggestion.planner.capacityNotice ? (
            <p className="mt-2 rounded-2xl bg-amber-50/80 px-3 py-2 text-xs font-semibold leading-5 text-amber-700 ring-1 ring-amber-100">
              {suggestion.planner.capacityNotice}
            </p>
          ) : null}
          {!compact && suggestion.review.weakPoints.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggestion.review.weakPoints.slice(0, 3).map((point) => (
                <span
                  key={point.label}
                  className="rounded-full bg-[#eafff9] px-2 py-1 text-[11px] font-semibold text-[#247269] ring-1 ring-[#bdeee5]"
                >
                  {point.label}
                </span>
              ))}
            </div>
          ) : null}
          {firstBlock ? (
            <Link
              href={firstBlock.targetHref}
              className="tap-target mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white transition-all hover:bg-[#3a3047] active:scale-[0.98]"
            >
              {firstBlock.title}
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Integrate `/plan`**

Modify `apps/web/src/app/(main)/plan/page.tsx`:

Add imports:

```tsx
import { ReviewAgentSuggestionCard } from '@/components/review-agent/review-agent-suggestion-card';
import { useReviewAgentSuggestions } from '@/hooks/use-review-agent-suggestions';
```

Inside `PlanPage`, after `planQuery`:

```tsx
const reviewAgentSuggestions = useReviewAgentSuggestions({
  startDate,
  days: planWindowDays,
  timezoneOffsetMinutes,
});
```

Pass `agentSuggestion={reviewAgentSuggestions.data}` to `PlanContent`.

Update `PlanContent` props:

```tsx
function PlanContent({
  plan,
  pendingRatingSyncCount,
  agentSuggestion,
}: {
  plan: ReviewTaskPlanResponse;
  pendingRatingSyncCount: number;
  agentSuggestion?: ReviewAgentSuggestionResponse;
}) {
```

Import `ReviewAgentSuggestionResponse` type and render the card near the top of `PlanContent`, after the summary card:

```tsx
{agentSuggestion ? (
  <div className="mt-4">
    <ReviewAgentSuggestionCard suggestion={agentSuggestion} />
  </div>
) : null}
```

- [ ] **Step 3: Integrate `/today`**

Modify `apps/web/src/app/(main)/today/page.tsx`:

Add imports:

```tsx
import { ReviewAgentSuggestionCard } from '@/components/review-agent/review-agent-suggestion-card';
import { useReviewAgentSuggestions } from '@/hooks/use-review-agent-suggestions';
```

Inside `TodayPage`, near `todayReviewPlan`:

```tsx
const reviewAgentSuggestions = useReviewAgentSuggestions({
  startDate: dateKey,
  days: 1,
  timezoneOffsetMinutes,
});
```

Render after the progress summary section and before the 今日复习 section:

```tsx
{reviewAgentSuggestions.data ? (
  <div className="mt-4">
    <ReviewAgentSuggestionCard suggestion={reviewAgentSuggestions.data} compact />
  </div>
) : null}
```

- [ ] **Step 4: Verify UI compilation**

Run:

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/src/components/review-agent/review-agent-suggestion-card.tsx apps/web/src/app/(main)/plan/page.tsx apps/web/src/app/(main)/today/page.tsx
git commit -m "feat: show review planner agent suggestions"
```

---

### Task 8: Full Verification

**Files:**
- No source edits expected unless verification reveals defects.

- [ ] **Step 1: Run package checks**

Run:

```powershell
bun --cwd packages/types typecheck
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
```

Expected: PASS.

- [ ] **Step 2: Run server checks**

Run:

```powershell
$env:POSTGRES_PORT='5433'
$env:RAG_EMBEDDING_PROVIDER='fake'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
bun --filter @repo/server test
bun --filter @repo/server build
bun --filter @repo/server test:e2e
```

Expected: PASS.

- [ ] **Step 3: Run web checks**

Run:

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
```

Expected: PASS.

- [ ] **Step 4: Confirm no live model boundary regression**

Run:

```powershell
rg -n "streamText|AI_PROVIDER_MODE|AI_ENABLE_LIVE_CALLS|OPENAI_API_KEY|DEEPSEEK_API_KEY" packages/agent/src/nodes/review.ts packages/agent/src/nodes/planner.ts apps/server/src/review-agent
```

Expected: no output.

- [ ] **Step 5: Confirm no write calls in review-agent service**

Run:

```powershell
rg -n "\\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\\(" apps/server/src/review-agent
```

Expected: no output from `apps/server/src/review-agent/review-agent.service.ts`.

- [ ] **Step 6: Run diff hygiene**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only intentional tracked edits if docs are not yet updated.

---

### Task 9: Browser Experience Verification

**Files:**
- No source edits expected unless browser verification reveals defects.

- [ ] **Step 1: Start the local stack**

Run:

```powershell
$env:POSTGRES_PORT='5433'
$env:RAG_EMBEDDING_PROVIDER='fake'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
bun --filter @repo/server start:dev
```

In another terminal:

```powershell
bun --filter @repo/web dev
```

Expected: server and web dev servers start without compile errors.

- [ ] **Step 2: Verify `/plan` manually or with Playwright**

Visit the local web URL, sign in, then open `/plan`.

Expected:

- Existing plan summary, chart, daily list, and preference controls still render.
- Agent 学习建议 card appears when authenticated.
- If the endpoint has no data, the card shows low-pressure guidance instead of breaking the page.
- No text overlap on mobile width.
- Buttons have at least 44px touch targets.

- [ ] **Step 3: Verify `/today` manually or with Playwright**

Open `/today`.

Expected:

- Existing progress card, review card list, local task checklist, and bottom links still render.
- Compact Agent suggestion appears between summary and review area.
- Skipping, reopening, and rating review tasks still behave as before.

- [ ] **Step 4: Check browser console**

Expected:

- No hydration mismatch.
- No React key warnings.
- No failed request loop for `/review-agent/suggestions`.

- [ ] **Step 5: Commit fixes if browser verification reveals defects**

If any UI issue is fixed, run focused web checks and commit:

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
git add <fixed-files>
git commit -m "fix: polish review agent suggestion experience"
```

---

### Task 10: Documentation and Phase Wrap-Up

**Files:**
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `DEVLOG.md`
- Optional ignored local file: `Blog/2026-06-22-phase-6-5-review-planner-agent.md`

- [ ] **Step 1: Update data-flow docs**

In `docs/data-flow.md`, add the Phase 6.5 flow:

```text
ReviewAgent / PlannerAgent:
Card + ReviewLog + ReviewTask plan + ReviewPreference + WrongQuestionDeck
  -> GET /review-agent/suggestions
  -> @repo/agent analyzeReview() + planStudy()
  -> read-only study suggestions
  -> /plan full suggestion and /today compact suggestion
```

Also record:

- The endpoint is read-only.
- It does not create `ReviewTask(source=PLANNER)`.
- It does not call live models.
- It does not enter Dexie `mutationQueue`.

- [ ] **Step 2: Update roadmap and collaboration docs**

Update `docs/roadmap.md`, `AGENTS.md`, `CLAUDE.md`, and `README.md`:

- Mark Phase 6.5 as completed after verification.
- State that `ReviewAgent` and `PlannerAgent` are deterministic policy modules.
- State that `/review-agent/suggestions` is a read-only API.
- Keep Phase 6.6 as MemoryAgent or next selected phase.

- [ ] **Step 3: Update DEVLOG**

Append one concise `2026-06-22` entry in `DEVLOG.md`:

```md
## 2026-06-22

- Completed Phase 6.5 ReviewAgent / PlannerAgent read-only suggestion loop.
- Added shared review-agent contract, deterministic review and planner policies, authenticated suggestions API, and `/plan` / `/today` UI integration.
- Preserved FSRS / ReviewTask authority: no automatic future task creation, no live model calls, no Dexie queue writes.
- Verification: list the exact commands that passed.

### Next

- Phase 6.6: MemoryAgent planning and implementation, or the next user-selected Agent phase.
```

Keep all current pending/planning sections at the bottom if the existing DEVLOG convention requires it.

- [ ] **Step 4: Optional local blog**

If doing daily wrap-up, create or update ignored local blog:

```text
Blog/2026-06-22-phase-6-5-review-planner-agent.md
```

Do not stage `Blog/` unless the user explicitly asks to track it.

- [ ] **Step 5: Final verification after docs**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only intended tracked docs plus ignored `Blog/` if created.

- [ ] **Step 6: Commit docs**

Run:

```powershell
git add docs/data-flow.md docs/roadmap.md AGENTS.md CLAUDE.md README.md DEVLOG.md
git commit -m "docs: wrap up phase 6.5 review planner agents"
```

---

## Final Acceptance Checklist

- [ ] `packages/types` has `review-agent` schemas and tests.
- [ ] `@repo/agent/review` and `@repo/agent/planner` export deterministic policies.
- [ ] `GET /review-agent/suggestions` is authenticated, user-scoped, and read-only.
- [ ] `/plan` displays the full Agent learning suggestion.
- [ ] `/today` displays the compact Agent learning suggestion.
- [ ] Existing `/review-tasks/plan`, `/today`, `/stats`, `/error-book`, and Chat behavior does not regress.
- [ ] No live model calls or API key reads exist in the new Agent path.
- [ ] No service write calls exist in `apps/server/src/review-agent/review-agent.service.ts`.
- [ ] Full package, server, web, e2e, and browser verification passes.
- [ ] Docs are updated and committed.
