import {
  parseReviewPlannerProductAcceptanceArguments,
  REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceEnvironment,
} from './review-planner-product-acceptance-profile';
import {
  createDefaultReviewPlannerV19ProductAcceptanceComposition,
  runReviewPlannerV19ProductAcceptanceComposition,
  type ReviewPlannerV19ProductAcceptanceCompositionPorts,
} from './review-planner-v19-product-acceptance-composition';
import {
  createDefaultReviewPlannerV19ProductAcceptanceRecoveryComposition,
  runReviewPlannerV19ProductAcceptanceRecoveryComposition,
  type ReviewPlannerV19ProductAcceptanceRecoveryCompositionPorts,
} from './review-planner-v19-product-acceptance-recovery-composition';

type V19CliKind = 'product' | 'recovery';

export type ReviewPlannerV19ProductAcceptanceCliSummary =
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

export type ReviewPlannerV19ProductAcceptanceCliPorts =
  ReviewPlannerV19ProductAcceptanceCompositionPorts;
export type ReviewPlannerV19ProductAcceptanceRecoveryCliPorts =
  ReviewPlannerV19ProductAcceptanceRecoveryCompositionPorts;

export function parseReviewPlannerV19ProductAcceptanceArguments(
  argv: readonly string[],
  kind: V19CliKind,
): Readonly<{ environment: ReviewPlannerProductAcceptanceEnvironment }> {
  return parseReviewPlannerProductAcceptanceArguments(
    REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE,
    argv,
    kind,
  );
}

export async function runReviewPlannerV19ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV19ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV19ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV19ProductAcceptanceArguments(
    input.argv,
    'product',
  );
  const defaults = createDefaultReviewPlannerV19ProductAcceptanceComposition();
  const result = await runReviewPlannerV19ProductAcceptanceComposition({
    environment,
    repoRoot: input.repoRoot,
    ports: Object.freeze({ ...defaults.ports, ...input.ports }),
  });
  return toProductSummary(result);
}

export async function runReviewPlannerV19ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV19ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV19ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV19ProductAcceptanceArguments(
    input.argv,
    'recovery',
  );
  const result = await runReviewPlannerV19ProductAcceptanceRecoveryComposition({
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

export async function executeReviewPlannerV19ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV19ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV19ProductAcceptanceCliSummary> {
  return runReviewPlannerV19ProductAcceptanceProductCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV19ProductAcceptancePorts(input.repoRoot),
  });
}

export async function executeReviewPlannerV19ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV19ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV19ProductAcceptanceCliSummary> {
  return runReviewPlannerV19ProductAcceptanceRecoveryCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV19ProductAcceptanceRecoveryComposition(
        input.repoRoot,
      ).ports,
  });
}

export function serializeReviewPlannerV19ProductAcceptanceCliSummary(
  summary: ReviewPlannerV19ProductAcceptanceCliSummary,
): string {
  return JSON.stringify(summary);
}

export function serializeReviewPlannerV19ProductAcceptanceCliFailure(
  _kind: V19CliKind,
  _error: unknown,
): string {
  void _kind;
  void _error;
  return serializeReviewPlannerV19ProductAcceptanceCliSummary(
    defaultOffSummary(),
  );
}

function createDefaultReviewPlannerV19ProductAcceptancePorts(
  repoRoot: string,
): ReviewPlannerV19ProductAcceptanceCliPorts {
  return createDefaultReviewPlannerV19ProductAcceptanceComposition(repoRoot)
    .ports;
}

function toProductSummary(
  result: Awaited<
    ReturnType<typeof runReviewPlannerV19ProductAcceptanceComposition>
  >,
): ReviewPlannerV19ProductAcceptanceCliSummary {
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

function defaultOffSummary(): ReviewPlannerV19ProductAcceptanceCliSummary {
  return Object.freeze({
    stage: 'preflight' as const,
    status: 'blocked' as const,
    code: 'default_off' as const,
  });
}
