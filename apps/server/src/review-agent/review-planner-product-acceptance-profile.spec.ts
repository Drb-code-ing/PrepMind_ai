import { serializeReviewPlannerV10ProductAcceptanceCliFailure } from './review-planner-v8-product-acceptance-composition';
import {
  REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
  parseReviewPlannerProductAcceptanceArguments,
} from './review-planner-product-acceptance-profile';

describe('Review Planner product-acceptance profiles', () => {
  it('keeps the canonical V11 failure-diagnostics namespace and schemas separate from V8/V10', () => {
    const profile = REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE;

    expect(profile.publicLedgerPath('branch')).toBe(
      'docs/acceptance/evidence/phase-6-9-5-v11-product-acceptance/branch',
    );
    expect(profile.recoveryPath('main')).toBe(
      '.tmp/phase-6-9-5-v11-product-acceptance/main',
    );
    expect(profile.browserProfilePath('branch')).toBe(
      '.tmp/phase-6-9-5-v11-product-acceptance/branch/profile-v11',
    );
    expect(profile.productConfirmation).toBe(
      '--confirm-v11-review-planner-product-acceptance',
    );
    expect(profile.recoveryConfirmation).toBe(
      '--confirm-v11-review-planner-product-acceptance-recovery-only',
    );
    expect(profile.schemas.failure).toBe(
      'phase-6.9.5-v11-product-acceptance-failure-v1',
    );
    expect(profile.schemas.checkpoint).toBe(
      'phase-6.9.5-v11-product-acceptance-checkpoint-v1',
    );
    expect(profile.schemas.manifest).toBe(
      'phase-6.9.5-v11-product-acceptance-manifest-v1',
    );
    expect(profile.schemas.executionManifest).toBe(
      'phase-6.9.5-v11-product-acceptance-execution-manifest-v1',
    );
    expect(profile.schemas.slotResult).toBe(
      'phase-6.9.5-v11-product-acceptance-slot-result-v1',
    );
    expect(profile.schemas.defaultOff).toBe(
      'phase-6.9.5-v11-product-acceptance-default-off-v1',
    );
    expect(profile.schemas.ownerIsolation).toBe(
      'phase-6.9.5-v11-product-acceptance-owner-isolation-v1',
    );
    expect(profile.schemas.cleanup).toBe(
      'phase-6.9.5-v11-product-acceptance-cleanup-v1',
    );
    expect(profile.schemas.acceptance).toBe(
      'phase-6.9.5-v11-product-acceptance-aggregate-v1',
    );
    expect(profile.schemas.success).toBe(
      'phase-6.9.5-v11-product-acceptance-success-v1',
    );
    expect(profile.executionManifestPath('branch')).toBe(
      '.tmp/phase-6-9-5-v11-product-acceptance-execution/branch',
    );
    expect(profile.executionManifestSegments('main')).toEqual([
      '.tmp',
      'phase-6-9-5-v11-product-acceptance-execution',
      'main',
    ]);
    expect(profile.publicLedgerPath('branch')).not.toBe(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath('branch'),
    );
    expect(profile.publicLedgerPath('branch')).not.toBe(
      REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath('branch'),
    );
  });

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
