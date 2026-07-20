import {
  parseReviewPlannerV12ProductAcceptanceExecutionManifest,
  parseReviewPlannerV12ProductAcceptanceManifest,
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
});
