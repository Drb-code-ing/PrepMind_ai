import {
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS,
  parseReviewPlannerV11ProductAcceptanceFailure,
  readReviewPlannerV11ProductAcceptanceCheckpoints,
  reviewPlannerV11ProductAcceptanceCheckpointSchema,
  reviewPlannerV11ProductAcceptanceFailureSchema,
  serializeReviewPlannerV11ProductAcceptanceFailure,
} from './review-planner-v11-product-acceptance-diagnostics';

const checkpoint = {
  schemaVersion: 'phase-6.9.5-v11-product-acceptance-checkpoint-v1',
  component: 'review',
  slot: 'api',
  checkpoint: 'review_api_facts_before',
  providerCallState: 'not_started',
} as const;

const failure = {
  schemaVersion: 'phase-6.9.5-v11-product-acceptance-failure-v1',
  environment: 'branch',
  component: 'review',
  slot: 'api',
  checkpoint: 'review_api_facts_before',
  terminal: 'operation_failed',
  providerCallState: 'not_started',
} as const;

function checkpointRecord(
  value: (typeof REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS)[number],
  providerCallState: 'not_started' | 'indeterminate',
) {
  const [component, slot] = value.split('_') as [
    'review' | 'planner',
    'api' | 'browser',
  ];
  return {
    schemaVersion: 'phase-6.9.5-v11-product-acceptance-checkpoint-v1',
    component,
    slot,
    checkpoint: value,
    providerCallState,
  } as const;
}

describe('Review Planner V11 product-acceptance safe diagnostics', () => {
  it.each([
    'rawError',
    'prompt',
    'response',
    'url',
    'headers',
    'token',
    'credential',
    'userFact',
    'usage',
  ])('rejects the forbidden %s key in a checkpoint', (key) => {
    expect(
      reviewPlannerV11ProductAcceptanceCheckpointSchema.safeParse({
        ...checkpoint,
        [key]: 'sensitive',
      }).success,
    ).toBe(false);
  });

  it('rejects unknown enum values and impossible not_started dispatch state', () => {
    expect(
      reviewPlannerV11ProductAcceptanceCheckpointSchema.safeParse({
        ...checkpoint,
        checkpoint: 'review_api_unknown',
      }).success,
    ).toBe(false);
    expect(
      reviewPlannerV11ProductAcceptanceCheckpointSchema.safeParse({
        ...checkpoint,
        checkpoint: 'review_api_dispatch',
      }).success,
    ).toBe(false);
  });

  it('accepts only the exact public failure projection with no free text', () => {
    expect(parseReviewPlannerV11ProductAcceptanceFailure(failure)).toEqual(
      failure,
    );
    expect(serializeReviewPlannerV11ProductAcceptanceFailure(failure)).toBe(
      `${JSON.stringify(failure)}\n`,
    );
    expect(
      reviewPlannerV11ProductAcceptanceFailureSchema.safeParse({
        ...failure,
        message: 'do not disclose this',
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate or nonmonotonic checkpoint streams', () => {
    expect(() =>
      readReviewPlannerV11ProductAcceptanceCheckpoints([
        checkpoint,
        checkpoint,
      ]),
    ).toThrow('V11_PRODUCT_ACCEPTANCE_DIAGNOSTIC_INVALID');
    expect(() =>
      readReviewPlannerV11ProductAcceptanceCheckpoints([
        {
          ...checkpoint,
          checkpoint: 'review_api_trace_baseline',
        },
        checkpoint,
      ]),
    ).toThrow('V11_PRODUCT_ACCEPTANCE_DIAGNOSTIC_INVALID');
  });

  it('requires the exact V11 checkpoint prefix without skipped or cross-slot boundaries', () => {
    expect(() =>
      readReviewPlannerV11ProductAcceptanceCheckpoints([
        checkpointRecord('review_api_facts_before', 'not_started'),
      ]),
    ).toThrow('V11_PRODUCT_ACCEPTANCE_DIAGNOSTIC_INVALID');
    expect(() =>
      readReviewPlannerV11ProductAcceptanceCheckpoints([
        checkpointRecord('review_api_activate', 'not_started'),
        checkpointRecord('review_api_trace_baseline', 'not_started'),
      ]),
    ).toThrow('V11_PRODUCT_ACCEPTANCE_DIAGNOSTIC_INVALID');
    expect(() =>
      readReviewPlannerV11ProductAcceptanceCheckpoints([
        checkpointRecord('review_api_activate', 'not_started'),
        checkpointRecord('review_api_facts_before', 'not_started'),
        checkpointRecord('review_api_trace_baseline', 'not_started'),
        checkpointRecord('review_api_dispatch', 'indeterminate'),
        checkpointRecord('review_api_observation', 'indeterminate'),
        checkpointRecord('review_api_trace_wait', 'indeterminate'),
        checkpointRecord('review_api_trace_canonicalize', 'indeterminate'),
        checkpointRecord('review_api_slot_record', 'indeterminate'),
        checkpointRecord('review_browser_launch', 'not_started'),
      ]),
    ).toThrow('V11_PRODUCT_ACCEPTANCE_DIAGNOSTIC_INVALID');
  });

  it('keeps provider call state scoped to the matching component and slot', () => {
    expect(
      reviewPlannerV11ProductAcceptanceCheckpointSchema.safeParse(
        checkpointRecord('review_browser_trace_baseline', 'not_started'),
      ).success,
    ).toBe(true);
    expect(
      reviewPlannerV11ProductAcceptanceCheckpointSchema.safeParse(
        checkpointRecord('review_browser_launch', 'not_started'),
      ).success,
    ).toBe(true);
    expect(
      reviewPlannerV11ProductAcceptanceCheckpointSchema.safeParse(
        checkpointRecord('review_browser_dispatch', 'not_started'),
      ).success,
    ).toBe(false);
    expect(
      reviewPlannerV11ProductAcceptanceCheckpointSchema.safeParse(
        checkpointRecord('review_browser_observation', 'not_started'),
      ).success,
    ).toBe(false);
    expect(
      reviewPlannerV11ProductAcceptanceCheckpointSchema.safeParse(
        checkpointRecord('review_api_facts_before', 'not_started'),
      ).success,
    ).toBe(true);
    expect(
      reviewPlannerV11ProductAcceptanceCheckpointSchema.safeParse(
        checkpointRecord('review_api_dispatch', 'not_started'),
      ).success,
    ).toBe(false);
    expect(
      reviewPlannerV11ProductAcceptanceCheckpointSchema.safeParse(
        checkpointRecord('planner_api_activate', 'not_started'),
      ).success,
    ).toBe(true);
  });

  it('accepts the complete canonical checkpoint sequence with slot-local resets', () => {
    const records = REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS.map(
      (value) => {
        const [component, slot] = value.split('_') as [
          'review' | 'planner',
          'api' | 'browser',
        ];
        const slotCheckpoints =
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS.filter(
            (candidate) => candidate.startsWith(`${component}_${slot}_`),
          );
        const dispatchIndex = slotCheckpoints.indexOf(
          `${component}_${slot}_dispatch`,
        );
        return checkpointRecord(
          value,
          slotCheckpoints.indexOf(value) >= dispatchIndex
            ? 'indeterminate'
            : 'not_started',
        );
      },
    );

    expect(
      readReviewPlannerV11ProductAcceptanceCheckpoints(records),
    ).toHaveLength(REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS.length);
  });
});
