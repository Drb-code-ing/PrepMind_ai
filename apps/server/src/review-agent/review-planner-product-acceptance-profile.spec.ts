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
});
