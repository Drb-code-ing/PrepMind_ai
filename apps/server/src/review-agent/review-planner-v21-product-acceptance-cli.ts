import {
  parseReviewPlannerProductAcceptanceArguments,
  REVIEW_PLANNER_V21_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceEnvironment,
} from './review-planner-product-acceptance-profile';
import {
  createDefaultReviewPlannerV21ProductAcceptanceComposition,
  runReviewPlannerV21ProductAcceptanceComposition,
  type ReviewPlannerV21ProductAcceptanceCompositionPorts,
} from './review-planner-v21-product-acceptance-composition';
import {
  createDefaultReviewPlannerV21ProductAcceptanceRecoveryComposition,
  runReviewPlannerV21ProductAcceptanceRecoveryComposition,
  type ReviewPlannerV21ProductAcceptanceRecoveryCompositionPorts,
} from './review-planner-v21-product-acceptance-recovery-composition';

type V21CliKind = 'product' | 'recovery';

export type ReviewPlannerV21ProductAcceptanceCliSummary =
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

export type ReviewPlannerV21ProductAcceptanceCliPorts =
  ReviewPlannerV21ProductAcceptanceCompositionPorts;
export type ReviewPlannerV21ProductAcceptanceRecoveryCliPorts =
  ReviewPlannerV21ProductAcceptanceRecoveryCompositionPorts;

export function parseReviewPlannerV21ProductAcceptanceArguments(
  argv: readonly string[],
  kind: V21CliKind,
): Readonly<{ environment: ReviewPlannerProductAcceptanceEnvironment }> {
  return parseReviewPlannerProductAcceptanceArguments(
    REVIEW_PLANNER_V21_PRODUCT_ACCEPTANCE_PROFILE,
    argv,
    kind,
  );
}

export async function runReviewPlannerV21ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV21ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV21ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV21ProductAcceptanceArguments(
    input.argv,
    'product',
  );
  const defaults = createDefaultReviewPlannerV21ProductAcceptanceComposition();
  const result = await runReviewPlannerV21ProductAcceptanceComposition({
    environment,
    repoRoot: input.repoRoot,
    ports: Object.freeze({ ...defaults.ports, ...input.ports }),
  });
  return toProductSummary(result);
}

export async function runReviewPlannerV21ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV21ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV21ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV21ProductAcceptanceArguments(
    input.argv,
    'recovery',
  );
  const result = await runReviewPlannerV21ProductAcceptanceRecoveryComposition({
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

export async function executeReviewPlannerV21ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV21ProductAcceptanceCliPorts;
  preflightOnly?: true;
}): Promise<ReviewPlannerV21ProductAcceptanceCliSummary> {
  const ports =
    input.ports ??
    createDefaultReviewPlannerV21ProductAcceptancePorts(input.repoRoot);
  return runReviewPlannerV21ProductAcceptanceProductCli({
    ...input,
    ports: input.preflightOnly
      ? Object.freeze({
          ...ports,
          acquireOwner: () =>
            Promise.resolve(Object.freeze({ status: 'owner_active' as const })),
        })
      : ports,
  });
}

export async function executeReviewPlannerV21ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV21ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV21ProductAcceptanceCliSummary> {
  return runReviewPlannerV21ProductAcceptanceRecoveryCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV21ProductAcceptanceRecoveryComposition(
        input.repoRoot,
      ).ports,
  });
}

export function serializeReviewPlannerV21ProductAcceptanceCliSummary(
  summary: ReviewPlannerV21ProductAcceptanceCliSummary,
): string {
  return JSON.stringify(summary);
}

export function serializeReviewPlannerV21ProductAcceptanceCliFailure(
  _kind: V21CliKind,
  _error: unknown,
): string {
  void _kind;
  void _error;
  return serializeReviewPlannerV21ProductAcceptanceCliSummary(
    defaultOffSummary(),
  );
}

function createDefaultReviewPlannerV21ProductAcceptancePorts(
  repoRoot: string,
): ReviewPlannerV21ProductAcceptanceCliPorts {
  return createDefaultReviewPlannerV21ProductAcceptanceComposition(repoRoot)
    .ports;
}

function toProductSummary(
  result: Awaited<
    ReturnType<typeof runReviewPlannerV21ProductAcceptanceComposition>
  >,
): ReviewPlannerV21ProductAcceptanceCliSummary {
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

function defaultOffSummary(): ReviewPlannerV21ProductAcceptanceCliSummary {
  return Object.freeze({
    stage: 'preflight' as const,
    status: 'blocked' as const,
    code: 'default_off' as const,
  });
}
