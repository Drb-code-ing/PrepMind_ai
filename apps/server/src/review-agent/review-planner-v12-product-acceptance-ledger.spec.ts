import {
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

  it('accepts only the fixed V12 failure terminal vocabulary', () => {
    expect(
      parseReviewPlannerV12ProductAcceptanceFailure({
        schemaVersion: 'phase-6.9.5-v12-product-acceptance-failure-v1',
        environment: 'branch',
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_activate',
        terminal: 'operation_failed',
        providerCallState: 'not_started',
      }),
    ).toMatchObject({ terminal: 'operation_failed' });
  });
});
