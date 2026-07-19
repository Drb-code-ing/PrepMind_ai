import { serializeReviewPlannerV10ProductAcceptanceCliFailure } from './review-planner-v8-product-acceptance-composition';
import {
  REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
  parseReviewPlannerProductAcceptanceArguments,
} from './review-planner-product-acceptance-profile';

describe('Review Planner product-acceptance profiles', () => {
  it('keeps V10 ledger, recovery, browser, and confirmation namespaces separate from recovered V8', () => {
    expect(
      REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath('branch'),
    ).toBe(
      'docs/acceptance/evidence/phase-6-9-5-v10-product-acceptance/branch',
    );
    expect(
      REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.recoveryPath('main'),
    ).toBe('.tmp/phase-6-9-5-v10-product-acceptance/main');
    expect(
      REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
        'branch',
      ),
    ).toBe('.tmp/phase-6-9-5-v10-product-acceptance/branch/profile-v10');
    expect(
      REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath('branch'),
    ).not.toBe(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath('branch'),
    );
    expect(
      REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.recoveryPath('branch'),
    ).not.toBe(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.recoveryPath('branch'),
    );
    expect(REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest).toBe(
      'phase-6.9.5-v10-product-acceptance-manifest-v1',
    );
    expect(
      REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
    ).not.toBe(REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest);
  });

  it('rejects confirmations from the other lineage', () => {
    expect(() =>
      parseReviewPlannerProductAcceptanceArguments(
        REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
        [
          REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.productConfirmation,
          '--environment=branch',
        ],
        'product',
      ),
    ).toThrow('V10_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED');
    expect(() =>
      parseReviewPlannerProductAcceptanceArguments(
        REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
        [
          REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.recoveryConfirmation,
          '--environment=branch',
        ],
        'recovery',
      ),
    ).toThrow('V8_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED');
  });

  it.each(['product', 'recovery'] as const)(
    'serializes a stable V10 %s confirmation rejection before composition',
    (kind) => {
      expect(
        serializeReviewPlannerV10ProductAcceptanceCliFailure(
          kind,
          new Error('V10_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED'),
        ),
      ).toBe(
        JSON.stringify({
          stage: 'preflight',
          status: 'blocked',
          code: 'confirmation_required',
        }),
      );
    },
  );
});
