import * as profiles from './review-planner-product-acceptance-profile';

describe('Review/Planner V19 product acceptance profile', () => {
  it('owns confirmation, schemas, evidence, recovery, execution, and browser namespaces distinct from V11 through V16', () => {
    const profile = (
      profiles as unknown as Record<
        string,
        {
          lineage: string;
          productConfirmation: string;
          recoveryConfirmation: string;
          schemas: Record<string, string>;
          publicLedgerPath(environment: 'branch'): string;
          recoveryPath(environment: 'branch'): string;
          executionManifestPath(environment: 'branch'): string;
          browserProfilePath(environment: 'branch'): string;
        }
      >
    ).REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE;

    expect(profile).toEqual(
      expect.objectContaining({
        lineage: 'v19',
        productConfirmation: '--confirm-v19-review-planner-product-acceptance',
        recoveryConfirmation:
          '--confirm-v19-review-planner-product-acceptance-recovery-only',
      }),
    );
    expect(profile.schemas.manifest).toBe(
      'phase-6.9.5-v19-product-acceptance-manifest-v1',
    );
    expect(profile.publicLedgerPath('branch')).toBe(
      'docs/acceptance/evidence/phase-6-9-5-v19-product-acceptance/branch',
    );
    expect(profile.recoveryPath('branch')).toBe(
      '.tmp/phase-6-9-5-v19-product-acceptance/branch',
    );
    expect(profile.executionManifestPath('branch')).toBe(
      '.tmp/phase-6-9-5-v19-product-acceptance-execution/branch',
    );
    expect(profile.browserProfilePath('branch')).toBe(
      '.tmp/phase-6-9-5-v19-product-acceptance/branch/profile-v19',
    );
  });
});
