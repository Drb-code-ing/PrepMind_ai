import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import type {
  ReviewPlannerControlledLiveV8CanaryResult,
  ReviewPlannerControlledLiveV8DiagnosticCode,
  ReviewPlannerControlledLiveV8EvaluatorIdentity,
  ReviewPlannerControlledLiveV8PairedResult,
  ReviewPlannerControlledLiveV8PreflightResult,
} from './review-planner-controlled-live-eval-v8-stage-diagnostics.cli';
import {
  createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator,
  validateReviewPlannerControlledLiveV8StageDiagnosticsPreflight,
  type ReviewPlannerControlledLiveV8StageDiagnosticsFactoryOverrides,
} from './review-planner-controlled-live-eval-v8-stage-diagnostics.factory';
import {
  v9GateDiagnosticSchema,
  type V9GateDiagnostic,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.contract';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID =
  'phase-6.9.5-review-planner-controlled-live-v9-gate-diagnostics' as const;

export const REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED =
  'REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED' as const;

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

export function validateReviewPlannerControlledLiveV9GateDiagnosticsPreflight(
  env: Record<string, unknown>,
): ReviewPlannerControlledLiveV8PreflightResult {
  const internalEnv = resolveV9CompositionEnv(env);
  if (!internalEnv) return preflightClosed();
  try {
    return validateReviewPlannerControlledLiveV8StageDiagnosticsPreflight(
      internalEnv,
    );
  } catch {
    return preflightClosed();
  }
}

export function createReviewPlannerControlledLiveV9GateDiagnosticsEvaluator(
  env: Record<string, unknown>,
  overrides: ReviewPlannerControlledLiveV9GateDiagnosticsFactoryOverrides = {},
): ReviewPlannerControlledLiveV9GateDiagnosticsEvaluatorPort {
  const internalEnv = resolveV9CompositionEnv(env);
  if (!internalEnv) return evaluatorClosed();
  let diagnostic: V9GateDiagnostic | null = null;
  const evaluator =
    createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator(internalEnv, {
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

function resolveV9CompositionEnv(
  env: Record<string, unknown>,
): Record<string, unknown> | null {
  try {
    if (
      strictBoolean(
        env[REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED],
      ) !== true
    ) {
      return null;
    }
    const externalV8Gate = env.REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED;
    if (
      externalV8Gate !== undefined &&
      strictBoolean(externalV8Gate) !== false
    ) {
      return null;
    }
    return {
      ...env,
      REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED: 'true',
    };
  } catch {
    return null;
  }
}

function strictBoolean(value: unknown): boolean | null {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

function preflightClosed(): ReviewPlannerControlledLiveV8PreflightResult {
  return {
    ok: false as const,
    diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
  };
}

function evaluatorClosed(): ReviewPlannerControlledLiveV9GateDiagnosticsEvaluatorPort {
  return Object.freeze({
    state: 'closed' as const,
    profileId: REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID,
    identity: null,
    diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    providerAttemptCount: () => 0,
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
