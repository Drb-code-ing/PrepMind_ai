import {
  REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_CHECKPOINTS,
  type ReviewPlannerV19ProductAcceptanceCheckpoint,
  type ReviewPlannerV19ProductAcceptanceRecoveryJournal,
} from './review-planner-v19-product-acceptance-recovery';
import { REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE } from './review-planner-product-acceptance-profile';

export type ReviewPlannerV19ProductAcceptanceFailure = Readonly<{
  schemaVersion: 'phase-6.9.5-v19-product-acceptance-failure-v1';
  environment: 'branch' | 'main';
  component: 'review' | 'planner';
  slot: 'api' | 'browser';
  checkpoint: ReviewPlannerV19ProductAcceptanceCheckpoint;
  terminal: 'operation_failed';
  providerCallState: 'not_started' | 'indeterminate';
}>;

export type ReviewPlannerV19ProductAcceptanceDiagnosticsPort = Readonly<{
  checkpoint(value: ReviewPlannerV19ProductAcceptanceCheckpoint): void;
  publishFailure(): void;
}>;

export function createReviewPlannerV19ProductAcceptanceDiagnosticsPort(input: {
  environment: 'branch' | 'main';
  journal: Pick<
    ReviewPlannerV19ProductAcceptanceRecoveryJournal,
    'appendCheckpoint' | 'attemptSha256' | 'latestCheckpoint'
  >;
  recordFailure(value: ReviewPlannerV19ProductAcceptanceFailure): void;
}): ReviewPlannerV19ProductAcceptanceDiagnosticsPort {
  let published = false;
  return Object.freeze({
    checkpoint(value) {
      if (
        !(
          REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_CHECKPOINTS as readonly string[]
        ).includes(value)
      ) {
        throw new Error('V19_PRODUCT_ACCEPTANCE_DIAGNOSTIC_INVALID');
      }
      const [component, slot] = value.split('_') as [
        'review' | 'planner',
        'api' | 'browser',
      ];
      input.journal.appendCheckpoint({
        schemaVersion:
          REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE.schemas.checkpoint,
        component,
        slot,
        checkpoint: value,
        providerCallState: providerCallState(value),
      });
    },
    publishFailure() {
      if (published) return;
      const checkpoint = input.journal.latestCheckpoint();
      if (checkpoint === null) {
        throw new Error('V19_PRODUCT_ACCEPTANCE_DIAGNOSTIC_INVALID');
      }
      input.recordFailure(
        Object.freeze({
          schemaVersion:
            REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE.schemas.failure,
          environment: input.environment,
          attemptSha256: input.journal.attemptSha256(),
          component: checkpoint.component,
          slot: checkpoint.slot,
          checkpoint: checkpoint.checkpoint,
          terminal: 'operation_failed' as const,
          providerCallState: checkpoint.providerCallState,
        }),
      );
      published = true;
    },
  });
}

function providerCallState(value: ReviewPlannerV19ProductAcceptanceCheckpoint) {
  const dispatch = `${value.split('_').slice(0, 2).join('_')}_dispatch`;
  return REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_CHECKPOINTS.indexOf(value) >=
    REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_CHECKPOINTS.indexOf(
      dispatch as ReviewPlannerV19ProductAcceptanceCheckpoint,
    )
    ? 'indeterminate'
    : 'not_started';
}
