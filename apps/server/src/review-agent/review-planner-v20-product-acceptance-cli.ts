import {
  parseReviewPlannerProductAcceptanceArguments,
  REVIEW_PLANNER_V20_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceEnvironment,
} from './review-planner-product-acceptance-profile';
import {
  createDefaultReviewPlannerV20ProductAcceptanceComposition,
  runReviewPlannerV20ProductAcceptanceComposition,
  type ReviewPlannerV20ProductAcceptanceCompositionPorts,
} from './review-planner-v20-product-acceptance-composition';
import {
  createDefaultReviewPlannerV20ProductAcceptanceRecoveryComposition,
  runReviewPlannerV20ProductAcceptanceRecoveryComposition,
  type ReviewPlannerV20ProductAcceptanceRecoveryCompositionPorts,
} from './review-planner-v20-product-acceptance-recovery-composition';

type V20CliKind = 'product' | 'recovery';

export type ReviewPlannerV20ProductAcceptanceCliSummary =
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

export type ReviewPlannerV20ProductAcceptanceCliPorts =
  ReviewPlannerV20ProductAcceptanceCompositionPorts;
export type ReviewPlannerV20ProductAcceptanceRecoveryCliPorts =
  ReviewPlannerV20ProductAcceptanceRecoveryCompositionPorts;

export function parseReviewPlannerV20ProductAcceptanceArguments(
  argv: readonly string[],
  kind: V20CliKind,
): Readonly<{ environment: ReviewPlannerProductAcceptanceEnvironment }> {
  return parseReviewPlannerProductAcceptanceArguments(
    REVIEW_PLANNER_V20_PRODUCT_ACCEPTANCE_PROFILE,
    argv,
    kind,
  );
}

export async function runReviewPlannerV20ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV20ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV20ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV20ProductAcceptanceArguments(
    input.argv,
    'product',
  );
  const defaults = createDefaultReviewPlannerV20ProductAcceptanceComposition();
  const result = await runReviewPlannerV20ProductAcceptanceComposition({
    environment,
    repoRoot: input.repoRoot,
    ports: Object.freeze({ ...defaults.ports, ...input.ports }),
  });
  return toProductSummary(result);
}

export async function runReviewPlannerV20ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV20ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV20ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV20ProductAcceptanceArguments(
    input.argv,
    'recovery',
  );
  const result = await runReviewPlannerV20ProductAcceptanceRecoveryComposition({
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

export async function executeReviewPlannerV20ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV20ProductAcceptanceCliPorts;
  preflightOnly?: true;
}): Promise<ReviewPlannerV20ProductAcceptanceCliSummary> {
  const ports =
    input.ports ??
    createDefaultReviewPlannerV20ProductAcceptancePorts(input.repoRoot);
  return runReviewPlannerV20ProductAcceptanceProductCli({
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

export async function executeReviewPlannerV20ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV20ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV20ProductAcceptanceCliSummary> {
  return runReviewPlannerV20ProductAcceptanceRecoveryCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV20ProductAcceptanceRecoveryComposition(
        input.repoRoot,
      ).ports,
  });
}

export function serializeReviewPlannerV20ProductAcceptanceCliSummary(
  summary: ReviewPlannerV20ProductAcceptanceCliSummary,
): string {
  return JSON.stringify(summary);
}

export function serializeReviewPlannerV20ProductAcceptanceCliFailure(
  _kind: V20CliKind,
  _error: unknown,
): string {
  void _kind;
  void _error;
  return serializeReviewPlannerV20ProductAcceptanceCliSummary(
    defaultOffSummary(),
  );
}

function createDefaultReviewPlannerV20ProductAcceptancePorts(
  repoRoot: string,
): ReviewPlannerV20ProductAcceptanceCliPorts {
  return createDefaultReviewPlannerV20ProductAcceptanceComposition(repoRoot)
    .ports;
}

function toProductSummary(
  result: Awaited<
    ReturnType<typeof runReviewPlannerV20ProductAcceptanceComposition>
  >,
): ReviewPlannerV20ProductAcceptanceCliSummary {
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

function defaultOffSummary(): ReviewPlannerV20ProductAcceptanceCliSummary {
  return Object.freeze({
    stage: 'preflight' as const,
    status: 'blocked' as const,
    code: 'default_off' as const,
  });
}
