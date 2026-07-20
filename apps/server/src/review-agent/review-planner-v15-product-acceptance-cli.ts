import {
  parseReviewPlannerProductAcceptanceArguments,
  REVIEW_PLANNER_V15_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceEnvironment,
} from './review-planner-product-acceptance-profile';
import {
  createDefaultReviewPlannerV15ProductAcceptanceComposition,
  runReviewPlannerV15ProductAcceptanceComposition,
  type ReviewPlannerV15ProductAcceptanceCompositionPorts,
} from './review-planner-v15-product-acceptance-composition';
import {
  createDefaultReviewPlannerV15ProductAcceptanceRecoveryComposition,
  runReviewPlannerV15ProductAcceptanceRecoveryComposition,
  type ReviewPlannerV15ProductAcceptanceRecoveryCompositionPorts,
} from './review-planner-v15-product-acceptance-recovery-composition';

type V15CliKind = 'product' | 'recovery';

export type ReviewPlannerV15ProductAcceptanceCliSummary =
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

export type ReviewPlannerV15ProductAcceptanceCliPorts =
  ReviewPlannerV15ProductAcceptanceCompositionPorts;
export type ReviewPlannerV15ProductAcceptanceRecoveryCliPorts =
  ReviewPlannerV15ProductAcceptanceRecoveryCompositionPorts;

export function parseReviewPlannerV15ProductAcceptanceArguments(
  argv: readonly string[],
  kind: V15CliKind,
): Readonly<{ environment: ReviewPlannerProductAcceptanceEnvironment }> {
  return parseReviewPlannerProductAcceptanceArguments(
    REVIEW_PLANNER_V15_PRODUCT_ACCEPTANCE_PROFILE,
    argv,
    kind,
  );
}

export async function runReviewPlannerV15ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV15ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV15ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV15ProductAcceptanceArguments(
    input.argv,
    'product',
  );
  const defaults = createDefaultReviewPlannerV15ProductAcceptanceComposition();
  const result = await runReviewPlannerV15ProductAcceptanceComposition({
    environment,
    repoRoot: input.repoRoot,
    ports: Object.freeze({ ...defaults.ports, ...input.ports }),
  });
  return toProductSummary(result);
}

export async function runReviewPlannerV15ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV15ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV15ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV15ProductAcceptanceArguments(
    input.argv,
    'recovery',
  );
  const result = await runReviewPlannerV15ProductAcceptanceRecoveryComposition({
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

export async function executeReviewPlannerV15ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV15ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV15ProductAcceptanceCliSummary> {
  return runReviewPlannerV15ProductAcceptanceProductCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV15ProductAcceptancePorts(input.repoRoot),
  });
}

export async function executeReviewPlannerV15ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV15ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV15ProductAcceptanceCliSummary> {
  return runReviewPlannerV15ProductAcceptanceRecoveryCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV15ProductAcceptanceRecoveryComposition(
        input.repoRoot,
      ).ports,
  });
}

export function serializeReviewPlannerV15ProductAcceptanceCliSummary(
  summary: ReviewPlannerV15ProductAcceptanceCliSummary,
): string {
  return JSON.stringify(summary);
}

export function serializeReviewPlannerV15ProductAcceptanceCliFailure(
  _kind: V15CliKind,
  _error: unknown,
): string {
  void _kind;
  void _error;
  return serializeReviewPlannerV15ProductAcceptanceCliSummary(
    defaultOffSummary(),
  );
}

function createDefaultReviewPlannerV15ProductAcceptancePorts(
  repoRoot: string,
): ReviewPlannerV15ProductAcceptanceCliPorts {
  return createDefaultReviewPlannerV15ProductAcceptanceComposition(repoRoot)
    .ports;
}

function toProductSummary(
  result: Awaited<
    ReturnType<typeof runReviewPlannerV15ProductAcceptanceComposition>
  >,
): ReviewPlannerV15ProductAcceptanceCliSummary {
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

function defaultOffSummary(): ReviewPlannerV15ProductAcceptanceCliSummary {
  return Object.freeze({
    stage: 'preflight' as const,
    status: 'blocked' as const,
    code: 'default_off' as const,
  });
}
