import {
  parseReviewPlannerV11ProductAcceptanceAggregate,
  parseReviewPlannerV11ProductAcceptanceExecutionManifest,
  parseReviewPlannerV11ProductAcceptanceManifest,
  parseReviewPlannerV11ProductAcceptanceSlotResult,
} from './review-planner-v11-product-acceptance-execution';
import * as executionModule from './review-planner-v11-product-acceptance-execution';
import {
  REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
} from './review-planner-product-acceptance-profile';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const COMMIT_SHA = '1'.repeat(40);

const manifest = {
  schemaVersion: 'phase-6.9.5-v11-product-acceptance-manifest-v1',
  environment: 'branch',
  attemptSha256: HASH_A,
  commitSha: COMMIT_SHA,
  provider: 'deepseek',
  model: 'deepseek-v4-pro',
  accountSha256: { review: HASH_A, planner: HASH_B },
  fixtureSha256: { review: HASH_B, planner: HASH_C },
} as const;

describe('Review Planner V11 product-acceptance execution contracts', () => {
  it('does not export an active-ledger binding bypass', () => {
    expect(executionModule).not.toHaveProperty(
      'writeReviewPlannerV11ProductAcceptanceExecutionManifestFromVerifiedLedger',
    );
  });

  it('keeps every V11 successful-record identity distinct from V8/V10 and failure diagnostics', () => {
    const schemas = REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas;

    expect(schemas.manifest).toBe(
      'phase-6.9.5-v11-product-acceptance-manifest-v1',
    );
    expect(schemas.executionManifest).toBe(
      'phase-6.9.5-v11-product-acceptance-execution-manifest-v1',
    );
    expect(schemas.slotResult).toBe(
      'phase-6.9.5-v11-product-acceptance-slot-result-v1',
    );
    expect(schemas.defaultOff).toBe(
      'phase-6.9.5-v11-product-acceptance-default-off-v1',
    );
    expect(schemas.ownerIsolation).toBe(
      'phase-6.9.5-v11-product-acceptance-owner-isolation-v1',
    );
    expect(schemas.cleanup).toBe(
      'phase-6.9.5-v11-product-acceptance-cleanup-v1',
    );
    expect(schemas.acceptance).toBe(
      'phase-6.9.5-v11-product-acceptance-aggregate-v1',
    );
    expect(schemas.success).toBe(
      'phase-6.9.5-v11-product-acceptance-success-v1',
    );
    expect(schemas.manifest).not.toBe(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
    );
    expect(schemas.manifest).not.toBe(
      REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
    );
    expect(schemas.manifest).not.toBe(schemas.failure);
    expect(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.executionManifestPath(
        'branch',
      ),
    ).toBe('.tmp/phase-6-9-5-v11-product-acceptance-execution/branch');
  });

  it('rejects V8/V10 records before a successful V11 record can cross lineages', () => {
    expect(() =>
      parseReviewPlannerV11ProductAcceptanceManifest({
        ...manifest,
        schemaVersion:
          REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
      }),
    ).toThrow('V11_PRODUCT_ACCEPTANCE_EXECUTION_RECORD_INVALID');
    expect(() =>
      parseReviewPlannerV11ProductAcceptanceManifest({
        ...manifest,
        schemaVersion:
          REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
      }),
    ).toThrow('V11_PRODUCT_ACCEPTANCE_EXECUTION_RECORD_INVALID');
  });

  it.each([
    'prompt',
    'response',
    'rawError',
    'url',
    'headers',
    'token',
    'credential',
    'cookie',
    'userFact',
    'email',
    'password',
    'accessToken',
    'providerKey',
  ])('rejects the forbidden public %s key', (key) => {
    expect(() =>
      parseReviewPlannerV11ProductAcceptanceManifest({
        ...manifest,
        [key]: 'never-persist',
      }),
    ).toThrow('V11_PRODUCT_ACCEPTANCE_EXECUTION_RECORD_INVALID');
  });

  it('rejects a raw trace identifier even when the safe trace hash is present', () => {
    expect(() =>
      parseReviewPlannerV11ProductAcceptanceSlotResult({
        schemaVersion: 'phase-6.9.5-v11-product-acceptance-slot-result-v1',
        slot: 'review-api',
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
        observation: 'candidate_applied',
        provenance: 'live_candidate',
        durationMs: 1,
        traceSha256: HASH_A,
        traceId: 'raw-trace',
      }),
    ).toThrow('V11_PRODUCT_ACCEPTANCE_EXECUTION_RECORD_INVALID');
  });

  it('allows only aggregate usage and rejects all other sensitive execution material', () => {
    expect(
      parseReviewPlannerV11ProductAcceptanceAggregate({
        schemaVersion: 'phase-6.9.5-v11-product-acceptance-aggregate-v1',
        environment: 'branch',
        attemptSha256: HASH_A,
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
        observation: 'candidate_applied',
        aggregate: {
          requests: 4,
          durationMs: 4,
          usage: { input: 1, output: 1 },
          costCny: '0.00000001',
        },
        screenshotSha256: { plan: HASH_B, today: HASH_C },
        cleanup: true,
      }),
    ).toMatchObject({ aggregate: { usage: { input: 1, output: 1 } } });
    expect(() =>
      parseReviewPlannerV11ProductAcceptanceExecutionManifest({
        schemaVersion:
          'phase-6.9.5-v11-product-acceptance-execution-manifest-v1',
        environment: 'branch',
        attemptSha256: HASH_A,
        resources: {
          accountId: {
            review: 'v11-synthetic-account-review',
            planner: 'v11-synthetic-account-planner',
          },
          fixtureId: {
            review: 'v11-synthetic-fixture-review',
            planner: 'v11-synthetic-fixture-planner',
          },
          browser: {
            executablePath: 'C:\\Browser\\chrome.exe',
            profilePath: '.tmp/profile-v11',
            providerKey: 'never-persist',
          },
        },
      }),
    ).toThrow('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
  });

  it.each([
    {
      label: 'account',
      account: 'v11-synthetic-account-sk-secret',
      fixture: 'v11-synthetic-fixture-review',
    },
    {
      label: 'fixture',
      account: 'v11-synthetic-account-review',
      fixture: 'v11-synthetic-fixture-Bearer_secret',
    },
  ])(
    'rejects credential-like $label selector values',
    ({ account, fixture }) => {
      expect(() =>
        parseReviewPlannerV11ProductAcceptanceExecutionManifest({
          schemaVersion:
            'phase-6.9.5-v11-product-acceptance-execution-manifest-v1',
          environment: 'branch',
          attemptSha256: HASH_A,
          resources: {
            accountId: {
              review: account,
              planner: 'v11-synthetic-account-planner',
            },
            fixtureId: {
              review: fixture,
              planner: 'v11-synthetic-fixture-planner',
            },
            browser: {
              executablePath: 'C:\\Browser\\chrome.exe',
              profilePath: '.tmp/profile-v11',
            },
          },
        }),
      ).toThrow('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
    },
  );
});
