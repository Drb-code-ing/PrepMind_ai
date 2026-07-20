import { serializeReviewPlannerV10ProductAcceptanceCliFailure } from './review-planner-v8-product-acceptance-composition';
import {
  REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
  parseReviewPlannerProductAcceptanceArguments,
} from './review-planner-product-acceptance-profile';

describe('Review Planner product-acceptance profiles', () => {
  it('keeps V14 roots and confirmation separate from the interrupted V13 reservation', () => {
    const profile = REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE;

    expect(profile.lineage).toBe('v14');
    expect(profile.productConfirmation).toBe(
      '--confirm-v14-review-planner-product-acceptance',
    );
    expect(profile.recoveryConfirmation).toBe(
      '--confirm-v14-review-planner-product-acceptance-recovery-only',
    );
    expect(profile.publicLedgerPath('branch')).toBe(
      'docs/acceptance/evidence/phase-6-9-5-v14-product-acceptance/branch',
    );
    expect(profile.recoveryPath('branch')).toBe(
      '.tmp/phase-6-9-5-v14-product-acceptance/branch',
    );
    expect(profile.executionManifestPath('branch')).toBe(
      '.tmp/phase-6-9-5-v14-product-acceptance-execution/branch',
    );
    expect(profile.browserProfilePath('branch')).toBe(
      '.tmp/phase-6-9-5-v14-product-acceptance/branch/profile-v14',
    );
    expect(profile.publicLedgerPath('branch')).not.toBe(
      REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath('branch'),
    );
    expect(profile.recoveryPath('branch')).not.toBe(
      REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE.recoveryPath('branch'),
    );
  });

  it('keeps V13 confirmations, schemas, and every runtime root independent from recovered V12', () => {
    const profile = REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE;

    expect(profile.lineage).toBe('v13');
    expect(profile.productConfirmation).toBe(
      '--confirm-v13-review-planner-product-acceptance',
    );
    expect(profile.recoveryConfirmation).toBe(
      '--confirm-v13-review-planner-product-acceptance-recovery-only',
    );
    expect(profile.schemas.failure).toBe(
      'phase-6.9.5-v13-product-acceptance-failure-v1',
    );
    expect(profile.publicLedgerPath('branch')).toBe(
      'docs/acceptance/evidence/phase-6-9-5-v13-product-acceptance/branch',
    );
    expect(profile.recoveryPath('main')).toBe(
      '.tmp/phase-6-9-5-v13-product-acceptance/main',
    );
    expect(profile.executionManifestPath('branch')).toBe(
      '.tmp/phase-6-9-5-v13-product-acceptance-execution/branch',
    );
    expect(profile.browserProfilePath('branch')).toBe(
      '.tmp/phase-6-9-5-v13-product-acceptance/branch/profile-v13',
    );
    expect(profile.publicLedgerPath('branch')).not.toBe(
      REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath('branch'),
    );
    expect(profile.recoveryPath('branch')).not.toBe(
      REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.recoveryPath('branch'),
    );
    expect(profile.executionManifestPath('branch')).not.toBe(
      REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.executionManifestPath(
        'branch',
      ),
    );
    expect(profile.browserProfilePath('branch')).not.toBe(
      REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
        'branch',
      ),
    );
  });

  it('keeps V12 confirmations, schemas, and all roots separate from immutable V11', () => {
    const profile = REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE;

    expect(profile.lineage).toBe('v12');
    expect(profile.productConfirmation).toBe(
      '--confirm-v12-review-planner-product-acceptance',
    );
    expect(profile.recoveryConfirmation).toBe(
      '--confirm-v12-review-planner-product-acceptance-recovery-only',
    );
    expect(profile.schemas.failure).toBe(
      'phase-6.9.5-v12-product-acceptance-failure-v1',
    );
    expect(profile.schemas.executionManifest).toBe(
      'phase-6.9.5-v12-product-acceptance-execution-manifest-v1',
    );
    expect(profile.publicLedgerPath('branch')).toBe(
      'docs/acceptance/evidence/phase-6-9-5-v12-product-acceptance/branch',
    );
    expect(profile.recoveryPath('main')).toBe(
      '.tmp/phase-6-9-5-v12-product-acceptance/main',
    );
    expect(profile.executionManifestPath('branch')).toBe(
      '.tmp/phase-6-9-5-v12-product-acceptance-execution/branch',
    );
    expect(profile.browserProfilePath('branch')).toBe(
      '.tmp/phase-6-9-5-v12-product-acceptance/branch/profile-v12',
    );
    expect(profile.publicLedgerPath('branch')).not.toBe(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath('branch'),
    );
    expect(profile.recoveryPath('branch')).not.toBe(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoveryPath('branch'),
    );
    expect(profile.executionManifestPath('branch')).not.toBe(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.executionManifestPath(
        'branch',
      ),
    );
    expect(profile.browserProfilePath('branch')).not.toBe(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
        'branch',
      ),
    );
    expect(() =>
      parseReviewPlannerProductAcceptanceArguments(
        profile,
        [
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.productConfirmation,
          '--environment=branch',
        ],
        'product',
      ),
    ).toThrow('V12_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED');
  });

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
