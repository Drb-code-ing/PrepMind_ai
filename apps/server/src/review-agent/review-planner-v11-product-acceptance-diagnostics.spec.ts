import {
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
});
