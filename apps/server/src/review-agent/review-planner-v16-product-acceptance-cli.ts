import {
  parseReviewPlannerProductAcceptanceArguments,
  REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceEnvironment,
} from './review-planner-product-acceptance-profile';
import {
  createDefaultReviewPlannerV16ProductAcceptanceComposition,
  runReviewPlannerV16ProductAcceptanceComposition,
  type ReviewPlannerV16ProductAcceptanceCompositionPorts,
} from './review-planner-v16-product-acceptance-composition';
import {
  createDefaultReviewPlannerV16ProductAcceptanceRecoveryComposition,
  runReviewPlannerV16ProductAcceptanceRecoveryComposition,
  type ReviewPlannerV16ProductAcceptanceRecoveryCompositionPorts,
} from './review-planner-v16-product-acceptance-recovery-composition';

type V16CliKind = 'product' | 'recovery';

export type ReviewPlannerV16ProductAcceptanceCliSummary =
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

export type ReviewPlannerV16ProductAcceptanceCliPorts =
  ReviewPlannerV16ProductAcceptanceCompositionPorts;
export type ReviewPlannerV16ProductAcceptanceRecoveryCliPorts =
  ReviewPlannerV16ProductAcceptanceRecoveryCompositionPorts;

export function parseReviewPlannerV16ProductAcceptanceArguments(
  argv: readonly string[],
  kind: V16CliKind,
): Readonly<{ environment: ReviewPlannerProductAcceptanceEnvironment }> {
  return parseReviewPlannerProductAcceptanceArguments(
    REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE,
    argv,
    kind,
  );
}

export async function runReviewPlannerV16ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV16ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV16ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV16ProductAcceptanceArguments(
    input.argv,
    'product',
  );
  const defaults = createDefaultReviewPlannerV16ProductAcceptanceComposition();
  const result = await runReviewPlannerV16ProductAcceptanceComposition({
    environment,
    repoRoot: input.repoRoot,
    ports: Object.freeze({ ...defaults.ports, ...input.ports }),
  });
  return toProductSummary(result);
}

export async function runReviewPlannerV16ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV16ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV16ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV16ProductAcceptanceArguments(
    input.argv,
    'recovery',
  );
  const result = await runReviewPlannerV16ProductAcceptanceRecoveryComposition({
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

export async function executeReviewPlannerV16ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV16ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV16ProductAcceptanceCliSummary> {
  return runReviewPlannerV16ProductAcceptanceProductCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV16ProductAcceptancePorts(input.repoRoot),
  });
}

export async function executeReviewPlannerV16ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV16ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV16ProductAcceptanceCliSummary> {
  return runReviewPlannerV16ProductAcceptanceRecoveryCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV16ProductAcceptanceRecoveryComposition(
        input.repoRoot,
      ).ports,
  });
}

export function serializeReviewPlannerV16ProductAcceptanceCliSummary(
  summary: ReviewPlannerV16ProductAcceptanceCliSummary,
): string {
  return JSON.stringify(summary);
}

export function serializeReviewPlannerV16ProductAcceptanceCliFailure(
  _kind: V16CliKind,
  _error: unknown,
): string {
  void _kind;
  void _error;
  return serializeReviewPlannerV16ProductAcceptanceCliSummary(
    defaultOffSummary(),
  );
}

function createDefaultReviewPlannerV16ProductAcceptancePorts(
  repoRoot: string,
): ReviewPlannerV16ProductAcceptanceCliPorts {
  return createDefaultReviewPlannerV16ProductAcceptanceComposition(repoRoot)
    .ports;
}

function toProductSummary(
  result: Awaited<
    ReturnType<typeof runReviewPlannerV16ProductAcceptanceComposition>
  >,
): ReviewPlannerV16ProductAcceptanceCliSummary {
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

function defaultOffSummary(): ReviewPlannerV16ProductAcceptanceCliSummary {
  return Object.freeze({
    stage: 'preflight' as const,
    status: 'blocked' as const,
    code: 'default_off' as const,
  });
}
