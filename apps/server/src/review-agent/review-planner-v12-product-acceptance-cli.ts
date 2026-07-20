import {
  parseReviewPlannerProductAcceptanceArguments,
  REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceEnvironment,
} from './review-planner-product-acceptance-profile';
import {
  createDefaultReviewPlannerV12ProductAcceptanceComposition,
  runReviewPlannerV12ProductAcceptanceComposition,
  type ReviewPlannerV12ProductAcceptanceCompositionPorts,
} from './review-planner-v12-product-acceptance-composition';

type V12CliKind = 'product' | 'recovery';

export type ReviewPlannerV12ProductAcceptanceCliSummary = Readonly<{
  stage: 'preflight';
  status: 'blocked';
  code: 'default_off';
}>;

export interface ReviewPlannerV12ProductAcceptanceCliPorts extends Partial<
  Omit<ReviewPlannerV12ProductAcceptanceCompositionPorts, 'preflight'>
> {
  preflight(input: {
    environment: ReviewPlannerProductAcceptanceEnvironment;
    repoRoot: string;
  }): Promise<Readonly<{ status: 'blocked' }>>;
}

export function parseReviewPlannerV12ProductAcceptanceArguments(
  argv: readonly string[],
  kind: V12CliKind,
): Readonly<{ environment: ReviewPlannerProductAcceptanceEnvironment }> {
  return parseReviewPlannerProductAcceptanceArguments(
    REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE,
    argv,
    kind,
  );
}

export async function runReviewPlannerV12ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV12ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV12ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV12ProductAcceptanceArguments(
    input.argv,
    'product',
  );
  const defaults = createDefaultReviewPlannerV12ProductAcceptanceComposition();
  await runReviewPlannerV12ProductAcceptanceComposition({
    environment,
    repoRoot: input.repoRoot,
    ports: Object.freeze({ ...defaults.ports, ...input.ports }),
  });
  return defaultOffSummary();
}

export async function runReviewPlannerV12ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV12ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV12ProductAcceptanceCliSummary> {
  return runReviewPlannerV12ProductAcceptanceCli(input, 'recovery');
}

export async function executeReviewPlannerV12ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV12ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV12ProductAcceptanceCliSummary> {
  return runReviewPlannerV12ProductAcceptanceProductCli({
    ...input,
    ports: input.ports ?? createDefaultReviewPlannerV12ProductAcceptancePorts(),
  });
}

export async function executeReviewPlannerV12ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports?: ReviewPlannerV12ProductAcceptanceCliPorts;
}): Promise<ReviewPlannerV12ProductAcceptanceCliSummary> {
  return runReviewPlannerV12ProductAcceptanceRecoveryCli({
    ...input,
    ports: input.ports ?? createDefaultReviewPlannerV12ProductAcceptancePorts(),
  });
}

export function serializeReviewPlannerV12ProductAcceptanceCliSummary(
  summary: ReviewPlannerV12ProductAcceptanceCliSummary,
): string {
  return JSON.stringify(summary);
}

export function serializeReviewPlannerV12ProductAcceptanceCliFailure(
  _kind: V12CliKind,
  _error: unknown,
): string {
  void _kind;
  void _error;
  return serializeReviewPlannerV12ProductAcceptanceCliSummary(
    defaultOffSummary(),
  );
}

async function runReviewPlannerV12ProductAcceptanceCli(
  input: {
    argv: readonly string[];
    repoRoot: string;
    ports: ReviewPlannerV12ProductAcceptanceCliPorts;
  },
  kind: V12CliKind,
): Promise<ReviewPlannerV12ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV12ProductAcceptanceArguments(
    input.argv,
    kind,
  );
  try {
    await input.ports.preflight({
      environment,
      repoRoot: input.repoRoot,
    });
  } catch {
    // V12 Task 1 intentionally exposes no owner or runtime boundary.
  }
  return defaultOffSummary();
}

function createDefaultReviewPlannerV12ProductAcceptancePorts(): ReviewPlannerV12ProductAcceptanceCliPorts {
  return Object.freeze({
    preflight: () =>
      Promise.resolve(Object.freeze({ status: 'blocked' as const })),
  });
}

function defaultOffSummary(): ReviewPlannerV12ProductAcceptanceCliSummary {
  return Object.freeze({
    stage: 'preflight' as const,
    status: 'blocked' as const,
    code: 'default_off' as const,
  });
}
