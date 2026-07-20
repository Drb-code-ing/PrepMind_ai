import {
  parseReviewPlannerProductAcceptanceArguments,
  REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceEnvironment,
} from './review-planner-product-acceptance-profile';
import {
  createDefaultReviewPlannerV17ProductAcceptanceComposition,
  runReviewPlannerV17ProductAcceptanceComposition,
  type ReviewPlannerV17ProductAcceptanceCompositionPorts,
} from './review-planner-v17-product-acceptance-composition';
import {
  createDefaultReviewPlannerV17ProductAcceptanceRecoveryComposition,
  runReviewPlannerV17ProductAcceptanceRecoveryComposition,
  type ReviewPlannerV17ProductAcceptanceRecoveryCompositionPorts,
} from './review-planner-v17-product-acceptance-recovery-composition';

type V17CliKind = 'product' | 'recovery';

export type ReviewPlannerV17ProductAcceptanceCliSummary =
  | Readonly<{
      stage: 'preflight' | 'owner';
      status: 'blocked';
      code: 'default_off' | 'owner_active';
    }>
  | Readonly<{
      stage: 'complete';
      status: 'passed';
      environment: ReviewPlannerProductAcceptanceEnvironment;
      requestCount: 4;
    }>
  | Readonly<{
      stage: 'operation';
      status: 'failed';
      code: 'operation_failed';
    }>
  | Readonly<{
      stage: 'recovery';
      status: 'recovered';
      environment: ReviewPlannerProductAcceptanceEnvironment;
    }>;

export type ReviewPlannerV17ProductAcceptanceCliPorts =
  ReviewPlannerV17ProductAcceptanceCompositionPorts;
export type ReviewPlannerV17ProductAcceptanceRecoveryCliPorts =
  ReviewPlannerV17ProductAcceptanceRecoveryCompositionPorts;

export function parseReviewPlannerV17ProductAcceptanceArguments(
  argv: readonly string[],
  kind: V17CliKind,
): Readonly<{ environment: ReviewPlannerProductAcceptanceEnvironment }> {
  return parseReviewPlannerProductAcceptanceArguments(
    REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE,
    argv,
    kind,
  );
}

export async function runReviewPlannerV17ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV17ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV17ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV17ProductAcceptanceArguments(
    input.argv,
    'product',
  );
  const defaults = createDefaultReviewPlannerV17ProductAcceptanceComposition();
  const result = await runReviewPlannerV17ProductAcceptanceComposition({
    environment,
    repoRoot: input.repoRoot,
    ports: Object.freeze({ ...defaults.ports, ...input.ports }),
  });
  return toProductSummary(result);
}

export async function runReviewPlannerV17ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV17ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV17ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV17ProductAcceptanceArguments(
    input.argv,
    'recovery',
  );
  const result = await runReviewPlannerV17ProductAcceptanceRecoveryComposition({
    environment,
    repoRoot: input.repoRoot,
    ports: input.ports,
  });
  return result.status === 'recovered'
    ? Object.freeze({
        stage: 'recovery' as const,
        status: 'recovered' as const,
        environment: result.environment,
      })
    : defaultOffSummary();
}

export async function executeReviewPlannerV17ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV17ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV17ProductAcceptanceCliSummary> {
  return runReviewPlannerV17ProductAcceptanceProductCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV17ProductAcceptancePorts(input.repoRoot),
  });
}

export async function executeReviewPlannerV17ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV17ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV17ProductAcceptanceCliSummary> {
  return runReviewPlannerV17ProductAcceptanceRecoveryCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV17ProductAcceptanceRecoveryComposition(
        input.repoRoot,
      ).ports,
  });
}

export function serializeReviewPlannerV17ProductAcceptanceCliSummary(
  summary: ReviewPlannerV17ProductAcceptanceCliSummary,
): string {
  return JSON.stringify(summary);
}

export function serializeReviewPlannerV17ProductAcceptanceCliFailure(
  _kind: V17CliKind,
  _error: unknown,
): string {
  void _kind;
  void _error;
  return serializeReviewPlannerV17ProductAcceptanceCliSummary(
    defaultOffSummary(),
  );
}

function createDefaultReviewPlannerV17ProductAcceptancePorts(
  repoRoot: string,
): ReviewPlannerV17ProductAcceptanceCliPorts {
  return createDefaultReviewPlannerV17ProductAcceptanceComposition(repoRoot)
    .ports;
}

function toProductSummary(
  result: Awaited<
    ReturnType<typeof runReviewPlannerV17ProductAcceptanceComposition>
  >,
): ReviewPlannerV17ProductAcceptanceCliSummary {
  if (result.status === 'passed') {
    return Object.freeze({
      stage: 'complete' as const,
      status: 'passed' as const,
      environment: result.environment,
      requestCount: 4 as const,
    });
  }
  if (result.status === 'failed') {
    return Object.freeze({
      stage: 'operation' as const,
      status: 'failed' as const,
      code: 'operation_failed' as const,
    });
  }
  if (result.stage === 'owner') {
    return Object.freeze({
      stage: 'owner' as const,
      status: 'blocked' as const,
      code: 'owner_active' as const,
    });
  }
  return defaultOffSummary();
}

function defaultOffSummary(): ReviewPlannerV17ProductAcceptanceCliSummary {
  return Object.freeze({
    stage: 'preflight' as const,
    status: 'blocked' as const,
    code: 'default_off' as const,
  });
}
