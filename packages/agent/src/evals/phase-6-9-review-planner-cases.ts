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

const REVIEW_ZERO_CALL_INDEXES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
const PLANNER_ZERO_CALL_INDEXES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);

export const phase695ReviewPlannerCases: readonly Phase695ReviewPlannerCase[] = Object.freeze([
  ...createCases('review', REVIEW_ZERO_CALL_INDEXES, new Set([21, 22])),
  ...createCases('planner', PLANNER_ZERO_CALL_INDEXES, new Set([21, 22])),
]);

function createCases(
  lane: Phase695ReviewPlannerLane,
  zeroCallIndexes: ReadonlySet<number>,
  criticalIndexes: ReadonlySet<number>,
): readonly Phase695ReviewPlannerCase[] {
  return Array.from({ length: 24 }, (_, index) => {
    const ordinal = index + 1;
    return Object.freeze({
      id: `${lane}_${ordinal}`,
      lane,
      executionKind: zeroCallIndexes.has(ordinal) ? 'zero_call' : 'runtime',
      criticalSemanticCase: criticalIndexes.has(ordinal),
    });
  });
}
