import type {
  PlannerAgentResult,
  ReviewAgentResult,
} from '@repo/types/api/review-agent';

export const PHASE_695_REVIEW_PLANNER_DATASET_VERSION =
  'phase-6.9-review-planner-v1' as const;

export type Phase695ReviewPlannerLane = 'review' | 'planner';
export type Phase695ExecutionKind = 'runtime' | 'zero_call';

export type Phase695ReviewPlannerCase = Readonly<{
  id: `review_${number}` | `planner_${number}`;
  lane: Phase695ReviewPlannerLane;
  executionKind: Phase695ExecutionKind;
  criticalSemanticCase: boolean;
}>;

export type Phase695CaseFixture =
  | Readonly<{
      lane: 'review';
      deterministic: Readonly<ReviewAgentResult>;
      expected: Readonly<{
        focusIndexes: readonly number[];
        diagnosis: 'review_pressure' | 'stability_risk' | 'knowledge_gap';
      }>;
    }>
  | Readonly<{
      lane: 'planner';
      deterministic: Readonly<PlannerAgentResult>;
      expected: Readonly<{
        blockOrder: readonly number[];
        strategy: 'relieve_capacity' | 'protect_overdue' | 'steady_progress';
      }>;
    }>;

type InternalCase = Phase695ReviewPlannerCase & Readonly<{ fixture: Phase695CaseFixture }>;

const REVIEW_ZERO_CALL_INDEXES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
const PLANNER_ZERO_CALL_INDEXES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);

const internalCases: readonly InternalCase[] = Object.freeze([
  ...createCases('review', REVIEW_ZERO_CALL_INDEXES, new Set([21, 22])),
  ...createCases('planner', PLANNER_ZERO_CALL_INDEXES, new Set([21, 22])),
]);

export const phase695ReviewPlannerCases: readonly Phase695ReviewPlannerCase[] = Object.freeze(
  internalCases.map((testCase) => Object.freeze({
    id: testCase.id,
    lane: testCase.lane,
    executionKind: testCase.executionKind,
    criticalSemanticCase: testCase.criticalSemanticCase,
  })),
);

const fixturesByCaseId = new Map<string, Phase695CaseFixture>(
  internalCases.map((testCase) => [testCase.id, testCase.fixture]),
);

export function getPhase695CaseFixture(caseId: string): Phase695CaseFixture | null {
  return fixturesByCaseId.get(caseId) ?? null;
}

function createCases(
  lane: Phase695ReviewPlannerLane,
  zeroCallIndexes: ReadonlySet<number>,
  criticalIndexes: ReadonlySet<number>,
): readonly InternalCase[] {
  return Array.from({ length: 24 }, (_, index) => {
    const ordinal = index + 1;
    const id: InternalCase['id'] = `${lane}_${ordinal}`;
    return Object.freeze({
      id,
      lane,
      executionKind: zeroCallIndexes.has(ordinal) ? 'zero_call' : 'runtime',
      criticalSemanticCase: criticalIndexes.has(ordinal),
      fixture: lane === 'review' ? createReviewFixture(ordinal) : createPlannerFixture(ordinal),
    });
  });
}

function createReviewFixture(ordinal: number): Phase695CaseFixture {
  const deterministic: ReviewAgentResult = {
    priority: 'high',
    summary: `Synthetic review fixture ${ordinal}.`,
    weakPoints: [
      {
        label: `synthetic-review-${ordinal}-a`,
        reason: 'Synthetic deterministic signal.',
        priority: 'high',
        confidence: 0.91,
      },
      {
        label: `synthetic-review-${ordinal}-b`,
        reason: 'Synthetic deterministic signal.',
        priority: 'medium',
        confidence: 0.72,
      },
    ],
    actions: [
      {
        title: 'Synthetic review action',
        description: 'Synthetic deterministic action.',
        targetHref: '/today',
      },
    ],
    signals: ['overdue', 'highWeakPoint'],
  };
  return deepFreeze({
    lane: 'review',
    deterministic,
    expected: { focusIndexes: [1], diagnosis: 'review_pressure' },
  });
}

function createPlannerFixture(ordinal: number): Phase695CaseFixture {
  const deterministic: PlannerAgentResult = {
    headline: `Synthetic plan fixture ${ordinal}.`,
    todayFocus: 'Synthetic focus.',
    weekStrategy: 'Synthetic strategy.',
    suggestedBlocks: [
      {
        title: `synthetic-plan-${ordinal}-a`,
        minutes: 20,
        reason: 'Synthetic deterministic block.',
        targetHref: '/today',
      },
      {
        title: `synthetic-plan-${ordinal}-b`,
        minutes: 15,
        reason: 'Synthetic deterministic block.',
        targetHref: '/error-book',
      },
    ],
    signals: ['overdue', 'capacityOver'],
  };
  return deepFreeze({
    lane: 'planner',
    deterministic,
    expected: { blockOrder: [1, 0], strategy: 'protect_overdue' },
  });
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}
