import {
  createReviewPlannerV12ProductAcceptanceExecutionManifest,
  parseReviewPlannerV12ProductAcceptanceAggregate,
  parseReviewPlannerV12ProductAcceptanceCleanup,
  parseReviewPlannerV12ProductAcceptanceDefaultOff,
  parseReviewPlannerV12ProductAcceptanceExecutionManifest,
  parseReviewPlannerV12ProductAcceptanceFailure,
  parseReviewPlannerV12ProductAcceptanceManifest,
  parseReviewPlannerV12ProductAcceptanceOwnerIsolation,
  parseReviewPlannerV12ProductAcceptanceSlotResult,
  parseReviewPlannerV12ProductAcceptanceSuccess,
} from './review-planner-v12-product-acceptance-ledger';
import { parseReviewPlannerV12ProductAcceptanceCheckpoint } from './review-planner-v12-product-acceptance-recovery';
import { REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE } from './review-planner-product-acceptance-profile';

describe('Review Planner V12 product-acceptance ledger contracts', () => {
  const attemptSha256 = 'a'.repeat(64);

  it('rejects V11 record identities from every V12 durable contract', () => {
    expect(() =>
      parseReviewPlannerV12ProductAcceptanceManifest({
        schemaVersion:
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
        environment: 'branch',
        attemptSha256,
      }),
    ).toThrow('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
    expect(() =>
      parseReviewPlannerV12ProductAcceptanceExecutionManifest({
        schemaVersion:
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas
            .executionManifest,
        environment: 'branch',
        attemptSha256,
      }),
    ).toThrow('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
    expect(() =>
      parseReviewPlannerV12ProductAcceptanceCheckpoint({
        schemaVersion: 'phase-6.9.5-v11-product-acceptance-checkpoint-v1',
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_activate',
        providerCallState: 'not_started',
      }),
    ).toThrow('V12_PRODUCT_ACCEPTANCE_RECOVERY_RECORD_INVALID');
  });

  it('accepts only the complete V12 four-slot durable success vocabulary', () => {
    const slot = parseReviewPlannerV12ProductAcceptanceSlotResult({
      schemaVersion: 'phase-6.9.5-v12-product-acceptance-slot-result-v1',
      slot: 'review-api',
      traceSha256: 'b'.repeat(64),
    });
    const defaultOff = parseReviewPlannerV12ProductAcceptanceDefaultOff({
      schemaVersion: 'phase-6.9.5-v12-product-acceptance-default-off-v1',
      component: 'review',
      providerInvocations: 0,
      gates: {
        liveCallsEnabled: false,
        reviewAgentModelEnabled: false,
        plannerAgentModelEnabled: false,
      },
    });
    const isolation = parseReviewPlannerV12ProductAcceptanceOwnerIsolation({
      schemaVersion: 'phase-6.9.5-v12-product-acceptance-owner-isolation-v1',
      crossAccountInvisible: true,
      businessWrites: 0,
      traceSha256: [
        'b'.repeat(64),
        'c'.repeat(64),
        'd'.repeat(64),
        'e'.repeat(64),
      ],
    });
    const cleanup = parseReviewPlannerV12ProductAcceptanceCleanup({
      schemaVersion: 'phase-6.9.5-v12-product-acceptance-cleanup-v1',
      syntheticAccounts: 0,
      fixtures: 0,
      traces: 0,
      browserProfiles: 0,
      capabilities: 0,
    });
    const aggregate = parseReviewPlannerV12ProductAcceptanceAggregate({
      schemaVersion: 'phase-6.9.5-v12-product-acceptance-aggregate-v1',
      environment: 'branch',
      attemptSha256,
      requests: 4,
      durationMs: 4_000,
    });
    const success = parseReviewPlannerV12ProductAcceptanceSuccess({
      schemaVersion: 'phase-6.9.5-v12-product-acceptance-success-v1',
      environment: 'branch',
      attemptSha256,
    });

    expect(slot.slot).toBe('review-api');
    expect(defaultOff.gates.liveCallsEnabled).toBe(false);
    expect(isolation.traceSha256).toHaveLength(4);
    expect(cleanup.browserProfiles).toBe(0);
    expect(aggregate.requests).toBe(4);
    expect(success.attemptSha256).toBe(attemptSha256);
  });

  it('fails closed when a V12 durable record carries secret-like content', () => {
    expect(() =>
      parseReviewPlannerV12ProductAcceptanceSlotResult({
        schemaVersion: 'phase-6.9.5-v12-product-acceptance-slot-result-v1',
        slot: 'review-api',
        traceSha256: 'b'.repeat(64),
        prompt: 'private',
      }),
    ).toThrow('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  });

  it('requires private, non-secret resource selectors so a failed run can be cleaned exactly', () => {
    expect(() =>
      parseReviewPlannerV12ProductAcceptanceExecutionManifest({
        schemaVersion:
          'phase-6.9.5-v12-product-acceptance-execution-manifest-v1',
        environment: 'branch',
        attemptSha256,
      }),
    ).toThrow('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');

    expect(
      parseReviewPlannerV12ProductAcceptanceExecutionManifest({
        schemaVersion:
          'phase-6.9.5-v12-product-acceptance-execution-manifest-v1',
        environment: 'branch',
        attemptSha256,
        databaseUrlSha256: 'e'.repeat(64),
        resources: {
          accountId: {
            review: `v12-synthetic-account-review-${'a'.repeat(32)}`,
            planner: `v12-synthetic-account-planner-${'b'.repeat(32)}`,
          },
          fixtureId: {
            review: `v12-synthetic-fixture-review-${'c'.repeat(32)}`,
            planner: `v12-synthetic-fixture-planner-${'d'.repeat(32)}`,
          },
          browser: {
            executablePath:
              'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            profilePath:
              '.tmp/phase-6-9-5-v12-product-acceptance/branch/profile-v12',
          },
        },
      }),
    ).toMatchObject({
      resources: {
        accountId: {
          review: `v12-synthetic-account-review-${'a'.repeat(32)}`,
        },
      },
    });
  });

  it('requires an attempt-bound hash of the selected database URL without persisting the URL', () => {
    const record = {
      schemaVersion: 'phase-6.9.5-v12-product-acceptance-execution-manifest-v1',
      environment: 'branch',
      attemptSha256,
      resources: {
        accountId: {
          review: `v12-synthetic-account-review-${'a'.repeat(32)}`,
          planner: `v12-synthetic-account-planner-${'b'.repeat(32)}`,
        },
        fixtureId: {
          review: `v12-synthetic-fixture-review-${'c'.repeat(32)}`,
          planner: `v12-synthetic-fixture-planner-${'d'.repeat(32)}`,
        },
        browser: {
          executablePath:
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          profilePath:
            '.tmp/phase-6-9-5-v12-product-acceptance/branch/profile-v12',
        },
      },
    };

    expect(() =>
      parseReviewPlannerV12ProductAcceptanceExecutionManifest(record),
    ).toThrow('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
    expect(
      parseReviewPlannerV12ProductAcceptanceExecutionManifest({
        ...record,
        databaseUrlSha256: 'f'.repeat(64),
      }),
    ).toMatchObject({ databaseUrlSha256: 'f'.repeat(64) });
  });

  it('generates distinct V12-only selectors that bind cleanup to the reserved attempt', () => {
    const execution = createReviewPlannerV12ProductAcceptanceExecutionManifest({
      environment: 'branch',
      attemptSha256,
      databaseUrlSha256: 'f'.repeat(64),
    });

    expect(execution).toMatchObject({
      schemaVersion: 'phase-6.9.5-v12-product-acceptance-execution-manifest-v1',
      environment: 'branch',
      attemptSha256,
      databaseUrlSha256: 'f'.repeat(64),
      resources: {
        browser: {
          profilePath:
            '.tmp/phase-6-9-5-v12-product-acceptance/branch/profile-v12',
        },
      },
    });
    expect(execution.resources.accountId.review).toMatch(
      /^v12-synthetic-account-review-[a-f0-9]{32}$/,
    );
    expect(execution.resources.accountId.review).not.toBe(
      execution.resources.accountId.planner,
    );
  });

  it('accepts only the fixed V12 failure terminal vocabulary', () => {
    expect(
      parseReviewPlannerV12ProductAcceptanceFailure({
        schemaVersion: 'phase-6.9.5-v12-product-acceptance-failure-v1',
        environment: 'branch',
        attemptSha256,
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_activate',
        terminal: 'operation_failed',
        providerCallState: 'not_started',
      }),
    ).toMatchObject({ terminal: 'operation_failed' });
  });

  it('requires the reserved attempt hash in every recovery-authorizing failure', () => {
    expect(() =>
      parseReviewPlannerV12ProductAcceptanceFailure({
        schemaVersion: 'phase-6.9.5-v12-product-acceptance-failure-v1',
        environment: 'branch',
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_setup',
        terminal: 'operation_failed',
        providerCallState: 'not_started',
      }),
    ).toThrow('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  });
});
