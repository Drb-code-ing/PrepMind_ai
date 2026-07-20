import {
  parseReviewPlannerProductAcceptanceArguments,
  REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceEnvironment,
} from './review-planner-product-acceptance-profile';
import {
  createDefaultReviewPlannerV22ProductAcceptanceComposition,
  runReviewPlannerV22ProductAcceptanceComposition,
  type ReviewPlannerV22ProductAcceptanceCompositionPorts,
} from './review-planner-v22-product-acceptance-composition';
import {
  createDefaultReviewPlannerV22ProductAcceptanceRecoveryComposition,
  runReviewPlannerV22ProductAcceptanceRecoveryComposition,
  type ReviewPlannerV22ProductAcceptanceRecoveryCompositionPorts,
} from './review-planner-v22-product-acceptance-recovery-composition';

type V22CliKind = 'product' | 'recovery';

export type ReviewPlannerV22ProductAcceptanceCliSummary =
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

export type ReviewPlannerV22ProductAcceptanceCliPorts =
  ReviewPlannerV22ProductAcceptanceCompositionPorts;
export type ReviewPlannerV22ProductAcceptanceRecoveryCliPorts =
  ReviewPlannerV22ProductAcceptanceRecoveryCompositionPorts;

export function parseReviewPlannerV22ProductAcceptanceArguments(
  argv: readonly string[],
  kind: V22CliKind,
): Readonly<{ environment: ReviewPlannerProductAcceptanceEnvironment }> {
  return parseReviewPlannerProductAcceptanceArguments(
    REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE,
    argv,
    kind,
  );
}

export async function runReviewPlannerV22ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV22ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV22ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV22ProductAcceptanceArguments(
    input.argv,
    'product',
  );
  const defaults = createDefaultReviewPlannerV22ProductAcceptanceComposition();
  const result = await runReviewPlannerV22ProductAcceptanceComposition({
    environment,
    repoRoot: input.repoRoot,
    ports: Object.freeze({ ...defaults.ports, ...input.ports }),
  });
  return toProductSummary(result);
}

export async function runReviewPlannerV22ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV22ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV22ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV22ProductAcceptanceArguments(
    input.argv,
    'recovery',
  );
  const result = await runReviewPlannerV22ProductAcceptanceRecoveryComposition({
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

export async function executeReviewPlannerV22ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV22ProductAcceptanceCliPorts;
  preflightOnly?: true;
}): Promise<ReviewPlannerV22ProductAcceptanceCliSummary> {
  const ports =
    input.ports ??
    createDefaultReviewPlannerV22ProductAcceptancePorts(input.repoRoot);
  return runReviewPlannerV22ProductAcceptanceProductCli({
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

export async function executeReviewPlannerV22ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV22ProductAcceptanceRecoveryCliPorts;
}): Promise<ReviewPlannerV22ProductAcceptanceCliSummary> {
  return runReviewPlannerV22ProductAcceptanceRecoveryCli({
    ...input,
    ports:
      input.ports ??
      createDefaultReviewPlannerV22ProductAcceptanceRecoveryComposition(
        input.repoRoot,
      ).ports,
  });
}

export function serializeReviewPlannerV22ProductAcceptanceCliSummary(
  summary: ReviewPlannerV22ProductAcceptanceCliSummary,
): string {
  return JSON.stringify(summary);
}

export function serializeReviewPlannerV22ProductAcceptanceCliFailure(
  _kind: V22CliKind,
  _error: unknown,
): string {
  void _kind;
  void _error;
  return serializeReviewPlannerV22ProductAcceptanceCliSummary(
    defaultOffSummary(),
  );
}

function createDefaultReviewPlannerV22ProductAcceptancePorts(
  repoRoot: string,
): ReviewPlannerV22ProductAcceptanceCliPorts {
  return createDefaultReviewPlannerV22ProductAcceptanceComposition(repoRoot)
    .ports;
}

function toProductSummary(
  result: Awaited<
    ReturnType<typeof runReviewPlannerV22ProductAcceptanceComposition>
  >,
): ReviewPlannerV22ProductAcceptanceCliSummary {
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

function defaultOffSummary(): ReviewPlannerV22ProductAcceptanceCliSummary {
  return Object.freeze({
    stage: 'preflight' as const,
    status: 'blocked' as const,
    code: 'default_off' as const,
  });
}
