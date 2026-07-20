import {
  parseReviewPlannerProductAcceptanceArguments,
  REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceEnvironment,
} from './review-planner-product-acceptance-profile';
import {
  createDefaultReviewPlannerV13ProductAcceptanceComposition,
  runReviewPlannerV13ProductAcceptanceComposition,
  type ReviewPlannerV13ProductAcceptanceCompositionPorts,
} from './review-planner-v13-product-acceptance-composition';
import {
  createDefaultReviewPlannerV13ProductAcceptanceRecoveryComposition,
  runReviewPlannerV13ProductAcceptanceRecoveryComposition,
  type ReviewPlannerV13ProductAcceptanceRecoveryCompositionPorts,
} from './review-planner-v13-product-acceptance-recovery-composition';

type V13CliKind = 'product' | 'recovery';

export type ReviewPlannerV13ProductAcceptanceCliSummary =
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

export type ReviewPlannerV13ProductAcceptanceCliPorts =
  ReviewPlannerV13ProductAcceptanceCompositionPorts;
export type ReviewPlannerV13ProductAcceptanceRecoveryCliPorts =
  ReviewPlannerV13ProductAcceptanceRecoveryCompositionPorts;

export function parseReviewPlannerV13ProductAcceptanceArguments(
  argv: readonly string[],
  kind: V13CliKind,
): Readonly<{ environment: ReviewPlannerProductAcceptanceEnvironment }> {
  return parseReviewPlannerProductAcceptanceArguments(
    REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE,
    argv,
    kind,
  );
}

export async function runReviewPlannerV13ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV13ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV13ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV13ProductAcceptanceArguments(
    input.argv,
    'product',
  );
  const defaults = createDefaultReviewPlannerV13ProductAcceptanceComposition();
  const result = await runReviewPlannerV13ProductAcceptanceComposition({
    environment,
    repoRoot: input.repoRoot,
    ports: Object.freeze({ ...defaults.ports, ...input.ports }),
  });
  return toProductSummary(result);
}

export async function runReviewPlannerV13ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV13ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV13ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV13ProductAcceptanceArguments(
    input.argv,
    'recovery',
  );
  const result = await runReviewPlannerV13ProductAcceptanceRecoveryComposition({
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

export async function executeReviewPlannerV13ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV13ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV13ProductAcceptanceCliSummary> {
  return runReviewPlannerV13ProductAcceptanceProductCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV13ProductAcceptancePorts(input.repoRoot),
  });
}

export async function executeReviewPlannerV13ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV13ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV13ProductAcceptanceCliSummary> {
  return runReviewPlannerV13ProductAcceptanceRecoveryCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV13ProductAcceptanceRecoveryComposition(
        input.repoRoot,
      ).ports,
  });
}

export function serializeReviewPlannerV13ProductAcceptanceCliSummary(
  summary: ReviewPlannerV13ProductAcceptanceCliSummary,
): string {
  return JSON.stringify(summary);
}

export function serializeReviewPlannerV13ProductAcceptanceCliFailure(
  _kind: V13CliKind,
  _error: unknown,
): string {
  void _kind;
  void _error;
  return serializeReviewPlannerV13ProductAcceptanceCliSummary(
    defaultOffSummary(),
  );
}

function createDefaultReviewPlannerV13ProductAcceptancePorts(
  repoRoot: string,
): ReviewPlannerV13ProductAcceptanceCliPorts {
  return createDefaultReviewPlannerV13ProductAcceptanceComposition(repoRoot)
    .ports;
}

function toProductSummary(
  result: Awaited<
    ReturnType<typeof runReviewPlannerV13ProductAcceptanceComposition>
  >,
): ReviewPlannerV13ProductAcceptanceCliSummary {
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

function defaultOffSummary(): ReviewPlannerV13ProductAcceptanceCliSummary {
  return Object.freeze({
    stage: 'preflight' as const,
    status: 'blocked' as const,
    code: 'default_off' as const,
  });
}
