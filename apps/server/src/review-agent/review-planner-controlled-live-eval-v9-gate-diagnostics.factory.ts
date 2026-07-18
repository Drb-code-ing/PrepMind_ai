import type {
  ReviewPlannerControlledLiveV8CanaryResult,
  ReviewPlannerControlledLiveV8DiagnosticCode,
  ReviewPlannerControlledLiveV8EvaluatorIdentity,
  ReviewPlannerControlledLiveV8PairedResult,
} from './review-planner-controlled-live-eval-v8-stage-diagnostics.cli';
import {
  createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator,
  type ReviewPlannerControlledLiveV8StageDiagnosticsFactoryOverrides,
} from './review-planner-controlled-live-eval-v8-stage-diagnostics.factory';
import {
  v9GateDiagnosticSchema,
  type V9GateDiagnostic,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.contract';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID =
  'phase-6.9.5-review-planner-controlled-live-v9-gate-diagnostics' as const;

export type ReviewPlannerControlledLiveV9PairedResult = Readonly<{
  result: ReviewPlannerControlledLiveV8PairedResult;
  diagnostic: V9GateDiagnostic;
}>;

export type ReviewPlannerControlledLiveV9GateDiagnosticsFactoryOverrides =
  Readonly<
    Omit<
      ReviewPlannerControlledLiveV8StageDiagnosticsFactoryOverrides,
      'onGateDiagnostic' | 'runIdProfile'
    > & {
      onGateDiagnostic?: (value: V9GateDiagnostic) => void;
    }
  >;

export type ReviewPlannerControlledLiveV9GateDiagnosticsEvaluatorPort =
  | Readonly<{
      state: 'ready';
      profileId: typeof REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID;
      identity: ReviewPlannerControlledLiveV8EvaluatorIdentity;
      runCanary(): Promise<ReviewPlannerControlledLiveV8CanaryResult>;
      runPaired(): Promise<ReviewPlannerControlledLiveV9PairedResult>;
      providerAttemptCount(): number;
    }>
  | Readonly<{
      state: 'closed';
      profileId: typeof REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID;
      identity: ReviewPlannerControlledLiveV8EvaluatorIdentity | null;
      diagnosticCode: ReviewPlannerControlledLiveV8DiagnosticCode;
      providerAttemptCount(): number;
    }>;

export function createReviewPlannerControlledLiveV9GateDiagnosticsEvaluator(
  env: Record<string, unknown>,
  overrides: ReviewPlannerControlledLiveV9GateDiagnosticsFactoryOverrides = {},
): ReviewPlannerControlledLiveV9GateDiagnosticsEvaluatorPort {
  let diagnostic: V9GateDiagnostic | null = null;
  const evaluator =
    createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator(env, {
      ...overrides,
      runIdProfile:
        REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID,
      onGateDiagnostic(value) {
        if (diagnostic) return;
        diagnostic = deepFreeze(v9GateDiagnosticSchema.parse(value));
        if (overrides.onGateDiagnostic) {
          const callbackSnapshot = deepFreeze(
            v9GateDiagnosticSchema.parse(value),
          );
          overrides.onGateDiagnostic(callbackSnapshot);
        }
      },
    });

  if (evaluator.state === 'closed') {
    return Object.freeze({
      ...evaluator,
      profileId: REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID,
    });
  }

  let pairedPromise: Promise<ReviewPlannerControlledLiveV9PairedResult> | null =
    null;
  return Object.freeze({
    state: 'ready' as const,
    profileId: REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID,
    identity: evaluator.identity,
    runCanary: () => evaluator.runCanary(),
    runPaired: () =>
      (pairedPromise ??= evaluator.runPaired().then((result) => {
        if (!diagnostic) throw new Error('V9_GATE_DIAGNOSTIC_UNAVAILABLE');
        return Object.freeze({ result, diagnostic });
      })),
    providerAttemptCount: () => evaluator.providerAttemptCount(),
  });
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}
