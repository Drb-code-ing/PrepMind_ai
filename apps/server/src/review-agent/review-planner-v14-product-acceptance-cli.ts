import {
  parseReviewPlannerProductAcceptanceArguments,
  REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceEnvironment,
} from './review-planner-product-acceptance-profile';
import {
  createDefaultReviewPlannerV14ProductAcceptanceComposition,
  runReviewPlannerV14ProductAcceptanceComposition,
  type ReviewPlannerV14ProductAcceptanceCompositionPorts,
} from './review-planner-v14-product-acceptance-composition';
import {
  createDefaultReviewPlannerV14ProductAcceptanceRecoveryComposition,
  runReviewPlannerV14ProductAcceptanceRecoveryComposition,
  type ReviewPlannerV14ProductAcceptanceRecoveryCompositionPorts,
} from './review-planner-v14-product-acceptance-recovery-composition';

type V14CliKind = 'product' | 'recovery';

export type ReviewPlannerV14ProductAcceptanceCliSummary =
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

export type ReviewPlannerV14ProductAcceptanceCliPorts =
  ReviewPlannerV14ProductAcceptanceCompositionPorts;
export type ReviewPlannerV14ProductAcceptanceRecoveryCliPorts =
  ReviewPlannerV14ProductAcceptanceRecoveryCompositionPorts;

export function parseReviewPlannerV14ProductAcceptanceArguments(
  argv: readonly string[],
  kind: V14CliKind,
): Readonly<{ environment: ReviewPlannerProductAcceptanceEnvironment }> {
  return parseReviewPlannerProductAcceptanceArguments(
    REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE,
    argv,
    kind,
  );
}

export async function runReviewPlannerV14ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV14ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV14ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV14ProductAcceptanceArguments(
    input.argv,
    'product',
  );
  const defaults = createDefaultReviewPlannerV14ProductAcceptanceComposition();
  const result = await runReviewPlannerV14ProductAcceptanceComposition({
    environment,
    repoRoot: input.repoRoot,
    ports: Object.freeze({ ...defaults.ports, ...input.ports }),
  });
  return toProductSummary(result);
}

export async function runReviewPlannerV14ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV14ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV14ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV14ProductAcceptanceArguments(
    input.argv,
    'recovery',
  );
  const result = await runReviewPlannerV14ProductAcceptanceRecoveryComposition({
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

export async function executeReviewPlannerV14ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV14ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV14ProductAcceptanceCliSummary> {
  return runReviewPlannerV14ProductAcceptanceProductCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV14ProductAcceptancePorts(input.repoRoot),
  });
}

export async function executeReviewPlannerV14ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV14ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV14ProductAcceptanceCliSummary> {
  return runReviewPlannerV14ProductAcceptanceRecoveryCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV14ProductAcceptanceRecoveryComposition(
        input.repoRoot,
      ).ports,
  });
}

export function serializeReviewPlannerV14ProductAcceptanceCliSummary(
  summary: ReviewPlannerV14ProductAcceptanceCliSummary,
): string {
  return JSON.stringify(summary);
}

export function serializeReviewPlannerV14ProductAcceptanceCliFailure(
  _kind: V14CliKind,
  _error: unknown,
): string {
  void _kind;
  void _error;
  return serializeReviewPlannerV14ProductAcceptanceCliSummary(
    defaultOffSummary(),
  );
}

function createDefaultReviewPlannerV14ProductAcceptancePorts(
  repoRoot: string,
): ReviewPlannerV14ProductAcceptanceCliPorts {
  return createDefaultReviewPlannerV14ProductAcceptanceComposition(repoRoot)
    .ports;
}

function toProductSummary(
  result: Awaited<
    ReturnType<typeof runReviewPlannerV14ProductAcceptanceComposition>
  >,
): ReviewPlannerV14ProductAcceptanceCliSummary {
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

function defaultOffSummary(): ReviewPlannerV14ProductAcceptanceCliSummary {
  return Object.freeze({
    stage: 'preflight' as const,
    status: 'blocked' as const,
    code: 'default_off' as const,
  });
}
