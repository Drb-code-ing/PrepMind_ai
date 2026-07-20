import { randomUUID } from 'node:crypto';

import {
  ReviewPlannerDiagnosticCode,
  phase695ReportSchema,
  type Phase695Report,
} from '@repo/agent';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PRICE_PROFILE_ID,
  finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence,
  reserveReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence,
  safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema,
  snapshotReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence,
  verifyReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence,
  type ReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceReservation,
  type ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot,
  type SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
} from './review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence';
import {
  createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator,
  validateReviewPlannerControlledLiveV7DeepSeekUsageParityPreflight,
  type ReviewPlannerControlledLiveV7CnyCost,
  type ReviewPlannerControlledLiveV7DiagnosticCode,
  type ReviewPlannerControlledLiveV7FactoryResult,
} from './review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_CONFIRMATION =
  '--confirm-controlled-live-v7-deepseek-v4-pro-usage-parity' as const;

const V7_CANARY_ATTEMPTS = 1;
const V7_TOTAL_PROVIDER_ATTEMPTS = 23;
const V7_PAIRED_RUNTIME_ATTEMPTS = 22;
const V7_ZERO_CALL_CASES = 26;
const V7_CASE_ENTRIES = 48;
const V7_MAX_P95_DURATION_MS = 4_500;
const V7_MAX_INPUT_TOKENS = 42_996;
const V7_MAX_OUTPUT_TOKENS = 9_712;
const V7_HARD_CAP_CNY = 1;

type V7PreflightResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; diagnosticCode: ReviewPlannerDiagnosticCode }>;

type V7CliDependencies = Readonly<{
  validatePreflight(env: Record<string, unknown>): V7PreflightResult;
  snapshotHistoricalEvidence(
    root: string,
  ): Promise<ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot>;
  verifyHistoricalEvidence(input: {
    root: string;
    snapshot: ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot;
  }): Promise<ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot>;
  reserveEvidence(input: {
    root: string;
    startedAt: string;
    runId: string;
    historicalSnapshot: ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot;
  }): Promise<ReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceReservation>;
  finalizeEvidence(input: {
    reservation: ReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceReservation;
    summary: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary;
  }): Promise<boolean>;
  createEvaluator(
    env: Record<string, unknown>,
  ): ReviewPlannerControlledLiveV7FactoryResult;
}>;

const defaultDependencies: V7CliDependencies = {
  validatePreflight:
    validateReviewPlannerControlledLiveV7DeepSeekUsageParityPreflight,
  snapshotHistoricalEvidence:
    snapshotReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence,
  verifyHistoricalEvidence:
    verifyReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence,
  reserveEvidence:
    reserveReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence,
  finalizeEvidence:
    finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence,
  createEvaluator:
    createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator,
};

type V7CliInput = Readonly<{
  argv: readonly string[];
  env: Record<string, unknown>;
  root: string;
  now?: () => number;
  randomUUID?: () => string;
}>;

/** The only V7 orchestration boundary; tests inject every capability. */
export async function runReviewPlannerControlledLiveV7DeepSeekUsageParityCli(
  input: V7CliInput,
  overrides: Partial<V7CliDependencies> = {},
): Promise<SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary> {
  if (!hasExactConfirmation(input.argv)) return blocked();
  let dependencies: V7CliDependencies;
  let preflight: V7PreflightResult;
  try {
    dependencies = { ...defaultDependencies, ...overrides };
    preflight = dependencies.validatePreflight(input.env);
  } catch {
    return blocked();
  }
  if (!preflight.ok) return blocked();

  let snapshot: ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot;
  try {
    snapshot = await dependencies.snapshotHistoricalEvidence(input.root);
  } catch {
    return attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  const identity = evidenceIdentity(
    input.now ?? Date.now,
    input.randomUUID ?? randomUUID,
  );
  if (!identity) return blocked();

  let reservation: ReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceReservation;
  try {
    reservation = await dependencies.reserveEvidence({
      root: input.root,
      startedAt: identity.startedAt,
      runId: identity.runId,
      historicalSnapshot: snapshot,
    });
  } catch {
    return attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo);
  }

  let evaluator: ReviewPlannerControlledLiveV7FactoryResult | undefined;
  let observedAttempts = 0;
  let terminalStarted = false;
  const readAttempts = () => {
    if (!evaluator?.ok) return observedAttempts;
    try {
      const current = evaluator.value.providerAttemptCount();
      if (isAttemptCount(current)) {
        observedAttempts = Math.max(observedAttempts, current);
      }
    } catch {
      // Keep the greatest trusted lower bound without inferring an attempt.
    }
    return observedAttempts;
  };
  const close = async (
    summary: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
  ) => {
    if (terminalStarted) {
      return attempted(readAttempts(), ReviewPlannerDiagnosticCode.EvidenceIo);
    }
    terminalStarted = true;
    return finish(
      reservation,
      summary,
      dependencies,
      input.root,
      snapshot,
      readAttempts,
    );
  };

  try {
    await dependencies.verifyHistoricalEvidence({
      root: input.root,
      snapshot,
    });
    if (!(await reservation.markAttempted())) {
      return close(attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo));
    }
    await dependencies.verifyHistoricalEvidence({
      root: input.root,
      snapshot,
    });

    try {
      evaluator = dependencies.createEvaluator(input.env);
    } catch {
      return close(attempted(0, ReviewPlannerDiagnosticCode.ExecutorInit));
    }
    if (!evaluator.ok) {
      return close(attempted(0, evaluator.diagnosticCode));
    }

    await dependencies.verifyHistoricalEvidence({
      root: input.root,
      snapshot,
    });
    const diagnostic = await evaluator.value.runDiagnostic();
    if (isAttemptCount(diagnostic.providerAttemptCount)) {
      observedAttempts = Math.max(
        observedAttempts,
        diagnostic.providerAttemptCount,
      );
    }
    const canaryAttempts = readAttempts();
    if (!diagnostic.canContinue) {
      return close(
        attempted(
          canaryAttempts,
          diagnostic.diagnosticCode ??
            ReviewPlannerDiagnosticCode.InvalidResponse,
        ),
      );
    }
    if (
      diagnostic.status !== 'complete' ||
      diagnostic.usageKnown !== true ||
      diagnostic.providerAttemptCount !== V7_CANARY_ATTEMPTS ||
      canaryAttempts !== V7_CANARY_ATTEMPTS
    ) {
      return close(
        attempted(canaryAttempts, ReviewPlannerDiagnosticCode.InvalidResponse),
      );
    }

    const paired = await evaluator.value.runPairedEvaluation();
    const totalAttempts = readAttempts();
    if (paired.kind !== 'report') {
      return close(attempted(totalAttempts, paired.diagnosticCode));
    }
    const parsedReport = phase695ReportSchema.safeParse(paired.report);
    const eligible =
      parsedReport.success &&
      isEligibleReport(parsedReport.data, totalAttempts, paired.cost)
        ? complete(parsedReport.data, paired.cost)
        : null;
    const summary =
      eligible ??
      attempted(totalAttempts, ReviewPlannerDiagnosticCode.InvalidResponse);
    return close(summary);
  } catch {
    return close(
      attempted(readAttempts(), ReviewPlannerDiagnosticCode.EvidenceIo),
    );
  }
}

/** Serializes only the strict safe projection accepted by the evidence schema. */
export function serializeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary(
  value: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
) {
  return JSON.stringify(
    safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.parse(
      value,
    ),
  );
}

async function finish(
  reservation: ReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceReservation,
  requested: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
  dependencies: Pick<
    V7CliDependencies,
    'verifyHistoricalEvidence' | 'finalizeEvidence'
  >,
  root: string,
  snapshot: ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot,
  readAttempts: () => number,
) {
  let summary = safeSummary(requested, readAttempts());
  try {
    await dependencies.verifyHistoricalEvidence({ root, snapshot });
  } catch {
    summary = attempted(readAttempts(), ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  try {
    if (!(await dependencies.finalizeEvidence({ reservation, summary }))) {
      return attempted(readAttempts(), ReviewPlannerDiagnosticCode.EvidenceIo);
    }
  } catch {
    return attempted(readAttempts(), ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  return summary;
}

function isEligibleReport(
  report: Phase695Report,
  providerAttemptCount: number,
  cost: ReviewPlannerControlledLiveV7CnyCost,
) {
  const runtimeEntries = report.caseEntries.filter(
    (entry) => entry.executionKind === 'runtime',
  );
  const zeroCallEntries = report.caseEntries.filter(
    (entry) => entry.executionKind === 'zero_call',
  );
  return (
    providerAttemptCount === V7_TOTAL_PROVIDER_ATTEMPTS &&
    report.mode === 'live' &&
    report.productionDecision === 'quality_gate_passed' &&
    report.counters.caseEntries === V7_CASE_ENTRIES &&
    report.counters.zeroCallCases === V7_ZERO_CALL_CASES &&
    report.counters.runtimeInvocations === V7_PAIRED_RUNTIME_ATTEMPTS &&
    report.counters.strictSuccesses === V7_CASE_ENTRIES &&
    report.counters.qualityPasses === V7_CASE_ENTRIES &&
    report.counters.criticalFailures === 0 &&
    report.metrics.strictSchemaSuccessRate === 1 &&
    report.metrics.semanticQualityRate >= 0.9 &&
    report.metrics.p95DurationMs <= V7_MAX_P95_DURATION_MS &&
    zeroCallEntries.length === V7_ZERO_CALL_CASES &&
    zeroCallEntries.every(
      (entry) => entry.zeroCallVerified && entry.runtimeInvocations === 0,
    ) &&
    runtimeEntries.length === V7_PAIRED_RUNTIME_ATTEMPTS &&
    runtimeEntries.every(
      (entry) =>
        entry.runtimeInvocations === 1 &&
        entry.strictSuccess &&
        entry.qualityPass,
    ) &&
    isValidCost(cost)
  );
}

function complete(
  report: Phase695Report,
  cost: ReviewPlannerControlledLiveV7CnyCost,
): SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary | null {
  const parsed =
    safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.safeParse(
      {
        status: 'complete',
        gate: 'eligible_for_separate_product_acceptance',
        providerAttemptCount: V7_TOTAL_PROVIDER_ATTEMPTS,
        usageKnown: true,
        aggregateInputTokens: cost.observedInputTokens,
        aggregateOutputTokens: cost.observedOutputTokens,
        observedCostCny: cost.observedCostCny,
        priceProfileId:
          REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PRICE_PROFILE_ID,
        caseEntries: V7_CASE_ENTRIES,
        zeroCallCases: V7_ZERO_CALL_CASES,
        runtimeInvocations: V7_PAIRED_RUNTIME_ATTEMPTS,
        strictSuccesses: report.counters.strictSuccesses,
        qualityPasses: report.counters.qualityPasses,
        criticalFailures: report.counters.criticalFailures,
      },
    );
  return parsed.success ? parsed.data : null;
}

function isValidCost(cost: ReviewPlannerControlledLiveV7CnyCost) {
  return (
    cost.currency === 'CNY' &&
    cost.nonCachedInputCnyPerMillionTokens === 3 &&
    cost.outputCnyPerMillionTokens === 6 &&
    cost.hardCapCny === V7_HARD_CAP_CNY &&
    cost.maxPairedProviderAttempts === V7_PAIRED_RUNTIME_ATTEMPTS &&
    cost.maxProviderAttempts === V7_TOTAL_PROVIDER_ATTEMPTS &&
    cost.reservedInputTokens === V7_MAX_INPUT_TOKENS &&
    cost.reservedOutputTokens === V7_MAX_OUTPUT_TOKENS &&
    cost.reservedCostCny === 0.18726 &&
    Number.isSafeInteger(cost.observedInputTokens) &&
    cost.observedInputTokens > 0 &&
    cost.observedInputTokens <= V7_MAX_INPUT_TOKENS &&
    Number.isSafeInteger(cost.observedOutputTokens) &&
    cost.observedOutputTokens > 0 &&
    cost.observedOutputTokens <= V7_MAX_OUTPUT_TOKENS &&
    Number.isFinite(cost.observedCostCny) &&
    cost.observedCostCny > 0 &&
    cost.observedCostCny <= V7_HARD_CAP_CNY &&
    cost.observedCostCny ===
      calculateCnyCost(cost.observedInputTokens, cost.observedOutputTokens) &&
    cost.withinHardCap === true
  );
}

function calculateCnyCost(inputTokens: number, outputTokens: number) {
  return (
    Math.round(
      ((inputTokens * 3 + outputTokens * 6) / 1_000_000) * 100_000_000,
    ) / 100_000_000
  );
}

function blocked(): SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary {
  return {
    status: 'diagnostic_blocked',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
  };
}

function attempted(
  providerAttemptCount: number,
  diagnosticCode: ReviewPlannerControlledLiveV7DiagnosticCode,
): SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary {
  const candidate = {
    status: 'invalid_attempted' as const,
    gate: 'closed' as const,
    providerAttemptCount: boundedAttempts(providerAttemptCount),
    usageKnown: false as const,
    diagnosticCode,
  };
  const parsed =
    safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.safeParse(
      candidate,
    );
  return parsed.success
    ? parsed.data
    : {
        ...candidate,
        diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
      };
}

function safeSummary(
  value: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
  providerAttemptCount: number,
) {
  const parsed =
    safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.safeParse(
      value,
    );
  return parsed.success
    ? parsed.data
    : attempted(
        providerAttemptCount,
        ReviewPlannerDiagnosticCode.InvalidResponse,
      );
}

function evidenceIdentity(now: () => number, createRunId: () => string) {
  try {
    const epoch = now();
    const runId = createRunId();
    if (
      !Number.isSafeInteger(epoch) ||
      epoch < 0 ||
      !/^[A-Za-z0-9._:-]{1,120}$/.test(runId)
    ) {
      return null;
    }
    return { startedAt: new Date(epoch).toISOString(), runId };
  } catch {
    return null;
  }
}

function hasExactConfirmation(argv: readonly string[]) {
  return (
    argv.length === 1 &&
    argv[0] ===
      REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_CONFIRMATION
  );
}

function isAttemptCount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= V7_TOTAL_PROVIDER_ATTEMPTS
  );
}

function boundedAttempts(value: number) {
  return isAttemptCount(value) ? value : 0;
}
