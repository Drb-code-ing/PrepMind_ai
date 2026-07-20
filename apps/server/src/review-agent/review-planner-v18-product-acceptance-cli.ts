import {
  parseReviewPlannerProductAcceptanceArguments,
  REVIEW_PLANNER_V18_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceEnvironment,
} from './review-planner-product-acceptance-profile';
import {
  createDefaultReviewPlannerV18ProductAcceptanceComposition,
  runReviewPlannerV18ProductAcceptanceComposition,
  type ReviewPlannerV18ProductAcceptanceCompositionPorts,
} from './review-planner-v18-product-acceptance-composition';
import {
  createDefaultReviewPlannerV18ProductAcceptanceRecoveryComposition,
  runReviewPlannerV18ProductAcceptanceRecoveryComposition,
  type ReviewPlannerV18ProductAcceptanceRecoveryCompositionPorts,
} from './review-planner-v18-product-acceptance-recovery-composition';

type V18CliKind = 'product' | 'recovery';

export type ReviewPlannerV18ProductAcceptanceCliSummary =
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

export type ReviewPlannerV18ProductAcceptanceCliPorts =
  ReviewPlannerV18ProductAcceptanceCompositionPorts;
export type ReviewPlannerV18ProductAcceptanceRecoveryCliPorts =
  ReviewPlannerV18ProductAcceptanceRecoveryCompositionPorts;

export function parseReviewPlannerV18ProductAcceptanceArguments(
  argv: readonly string[],
  kind: V18CliKind,
): Readonly<{ environment: ReviewPlannerProductAcceptanceEnvironment }> {
  return parseReviewPlannerProductAcceptanceArguments(
    REVIEW_PLANNER_V18_PRODUCT_ACCEPTANCE_PROFILE,
    argv,
    kind,
  );
}

export async function runReviewPlannerV18ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV18ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV18ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV18ProductAcceptanceArguments(
    input.argv,
    'product',
  );
  const defaults = createDefaultReviewPlannerV18ProductAcceptanceComposition();
  const result = await runReviewPlannerV18ProductAcceptanceComposition({
    environment,
    repoRoot: input.repoRoot,
    ports: Object.freeze({ ...defaults.ports, ...input.ports }),
  });
  return toProductSummary(result);
}

export async function runReviewPlannerV18ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV18ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV18ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV18ProductAcceptanceArguments(
    input.argv,
    'recovery',
  );
  const result = await runReviewPlannerV18ProductAcceptanceRecoveryComposition({
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

export async function executeReviewPlannerV18ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV18ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV18ProductAcceptanceCliSummary> {
  return runReviewPlannerV18ProductAcceptanceProductCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV18ProductAcceptancePorts(input.repoRoot),
  });
}

export async function executeReviewPlannerV18ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV18ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV18ProductAcceptanceCliSummary> {
  return runReviewPlannerV18ProductAcceptanceRecoveryCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV18ProductAcceptanceRecoveryComposition(
        input.repoRoot,
      ).ports,
  });
}

export function serializeReviewPlannerV18ProductAcceptanceCliSummary(
  summary: ReviewPlannerV18ProductAcceptanceCliSummary,
): string {
  return JSON.stringify(summary);
}

export function serializeReviewPlannerV18ProductAcceptanceCliFailure(
  _kind: V18CliKind,
  _error: unknown,
): string {
  void _kind;
  void _error;
  return serializeReviewPlannerV18ProductAcceptanceCliSummary(
    defaultOffSummary(),
  );
}

function createDefaultReviewPlannerV18ProductAcceptancePorts(
  repoRoot: string,
): ReviewPlannerV18ProductAcceptanceCliPorts {
  return createDefaultReviewPlannerV18ProductAcceptanceComposition(repoRoot)
    .ports;
}

function toProductSummary(
  result: Awaited<
    ReturnType<typeof runReviewPlannerV18ProductAcceptanceComposition>
  >,
): ReviewPlannerV18ProductAcceptanceCliSummary {
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

function defaultOffSummary(): ReviewPlannerV18ProductAcceptanceCliSummary {
  return Object.freeze({
    stage: 'preflight' as const,
    status: 'blocked' as const,
    code: 'default_off' as const,
  });
}
