import {
  createDefaultReviewPlannerV11ProductAcceptanceComposition,
  createDefaultReviewPlannerV11ProductAcceptanceRecoveryComposition,
  runReviewPlannerV11ProductAcceptanceComposition,
  runReviewPlannerV11ProductAcceptanceRecoveryComposition,
  type ReviewPlannerV11ProductAcceptanceCompositionPorts,
  type ReviewPlannerV11ProductAcceptanceRecoveryCompositionPorts,
  type ReviewPlannerV8DisposableComposition,
} from './review-planner-v8-product-acceptance-composition';
import {
  parseReviewPlannerProductAcceptanceArguments,
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceEnvironment,
} from './review-planner-product-acceptance-profile';

type V11CliKind = 'product' | 'recovery';

export type ReviewPlannerV11ProductAcceptanceCliSummary =
  | Readonly<{
      stage: 'preflight' | 'owner';
      status: 'blocked';
      code: 'preflight_failed' | 'owner_active';
    }>
  | Readonly<{
      stage: 'complete';
      status: 'passed';
      environment: ReviewPlannerProductAcceptanceEnvironment;
      requestCount: 4;
    }>
  | Readonly<{
      stage: 'recovery';
      status: 'failed';
      code: 'operation_failed_recovered';
    }>
  | Readonly<{
      stage: 'recovery';
      status: 'recovered';
      environment: ReviewPlannerProductAcceptanceEnvironment;
    }>;

export function parseReviewPlannerV11ProductAcceptanceArguments(
  argv: readonly string[],
  kind: V11CliKind,
): Readonly<{ environment: ReviewPlannerProductAcceptanceEnvironment }> {
  return parseReviewPlannerProductAcceptanceArguments(
    REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
    argv,
    kind,
  );
}

export async function runReviewPlannerV11ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV11ProductAcceptanceCompositionPorts;
}): Promise<ReviewPlannerV11ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV11ProductAcceptanceArguments(
    input.argv,
    'product',
  );
  const result = await runReviewPlannerV11ProductAcceptanceComposition({
    environment,
    repoRoot: input.repoRoot,
    ports: input.ports,
  });
  if (result.status === 'recovered') {
    return Object.freeze({
      stage: 'recovery' as const,
      status: 'failed' as const,
      code: 'operation_failed_recovered' as const,
    });
  }
  if (result.status === 'passed') {
    return Object.freeze({
      stage: 'complete' as const,
      status: 'passed' as const,
      environment: result.environment,
      requestCount: 4 as const,
    });
  }
  return Object.freeze({
    stage:
      result.stage === 'owner' ? ('owner' as const) : ('preflight' as const),
    status: 'blocked' as const,
    code:
      result.stage === 'owner'
        ? ('owner_active' as const)
        : ('preflight_failed' as const),
  });
}

export async function runReviewPlannerV11ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV11ProductAcceptanceRecoveryCompositionPorts;
}): Promise<ReviewPlannerV11ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV11ProductAcceptanceArguments(
    input.argv,
    'recovery',
  );
  const result = await runReviewPlannerV11ProductAcceptanceRecoveryComposition({
    environment,
    repoRoot: input.repoRoot,
    ports: input.ports,
  });
  if (result.status === 'recovered') {
    return Object.freeze({
      stage: 'recovery' as const,
      status: 'recovered' as const,
      environment: result.environment,
    });
  }
  return Object.freeze({
    stage: result.stage,
    status: 'blocked' as const,
    code:
      result.stage === 'owner'
        ? ('owner_active' as const)
        : ('preflight_failed' as const),
  });
}

export async function executeReviewPlannerV11ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  composition?: ReviewPlannerV8DisposableComposition<ReviewPlannerV11ProductAcceptanceCompositionPorts>;
}): Promise<ReviewPlannerV11ProductAcceptanceCliSummary> {
  parseReviewPlannerV11ProductAcceptanceArguments(input.argv, 'product');
  const composition =
    input.composition ??
    createDefaultReviewPlannerV11ProductAcceptanceComposition(input.repoRoot);
  try {
    return await runReviewPlannerV11ProductAcceptanceProductCli({
      argv: input.argv,
      repoRoot: input.repoRoot,
      ports: composition.ports,
    });
  } finally {
    await composition.dispose();
  }
}

export async function executeReviewPlannerV11ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  composition?: ReviewPlannerV8DisposableComposition<ReviewPlannerV11ProductAcceptanceRecoveryCompositionPorts>;
}): Promise<ReviewPlannerV11ProductAcceptanceCliSummary> {
  parseReviewPlannerV11ProductAcceptanceArguments(input.argv, 'recovery');
  const composition =
    input.composition ??
    createDefaultReviewPlannerV11ProductAcceptanceRecoveryComposition(
      input.repoRoot,
    );
  try {
    return await runReviewPlannerV11ProductAcceptanceRecoveryCli({
      argv: input.argv,
      repoRoot: input.repoRoot,
      ports: composition.ports,
    });
  } finally {
    await composition.dispose();
  }
}

export function serializeReviewPlannerV11ProductAcceptanceCliSummary(
  summary: ReviewPlannerV11ProductAcceptanceCliSummary,
): string {
  return JSON.stringify(summary);
}

export function serializeReviewPlannerV11ProductAcceptanceCliFailure(
  kind: V11CliKind,
  error: unknown,
): string {
  if (
    error instanceof Error &&
    error.message === 'V11_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED'
  ) {
    return JSON.stringify({
      stage: 'preflight',
      status: 'blocked',
      code: 'confirmation_required',
    });
  }
  if (
    error instanceof Error &&
    error.message === 'V11_PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED'
  ) {
    return JSON.stringify({
      stage: 'recovery',
      status: 'failed',
      code: 'recovery_required',
    });
  }
  return JSON.stringify(
    kind === 'product'
      ? {
          stage: 'operation',
          status: 'failed',
          code: 'operation_failed',
        }
      : {
          stage: 'recovery',
          status: 'failed',
          code: 'recovery_required',
        },
  );
}
