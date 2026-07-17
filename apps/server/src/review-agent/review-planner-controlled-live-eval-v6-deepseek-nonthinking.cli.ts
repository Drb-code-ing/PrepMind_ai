import { randomUUID } from 'node:crypto';

import {
  ReviewPlannerDiagnosticCode,
  phase695ReportSchema,
  type Phase695Report,
} from '@repo/agent';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PRICE_PROFILE_ID,
  finalizeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence,
  safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema,
  reserveReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence,
  snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence,
  verifyReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence,
  type ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceReservation,
  type ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot,
  type SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary,
} from './review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence';
import {
  createReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator,
  validateReviewPlannerControlledLiveV6DeepSeekNonThinkingPreflight,
  type ReviewPlannerControlledLiveV6CnyCost,
  type ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator,
  type ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceAudit,
} from './review-planner-controlled-live-eval-v6-deepseek-nonthinking.factory';

const V6_CONFIRMATION =
  '--confirm-controlled-live-v6-deepseek-v4-pro-nonthinking';
const V6_CANARY_ATTEMPTS = 1;
const V6_TOTAL_PROVIDER_ATTEMPTS = 23;
const V6_PAIRED_RUNTIME_ATTEMPTS = 22;
const V6_ZERO_CALL_CASES = 26;
const V6_CASE_ENTRIES = 48;
const V6_MAX_P95_DURATION_MS = 4_500;
const V6_MAX_INPUT_TOKENS = 42_996;
const V6_MAX_OUTPUT_TOKENS = 9_712;
const V6_HARD_CAP_CNY = 1;

type V6PreflightResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; diagnosticCode: ReviewPlannerDiagnosticCode }>;

type V6EvaluatorFactoryResult =
  | Readonly<{
      ok: true;
      value: ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator;
    }>
  | Readonly<{ ok: false; diagnosticCode: ReviewPlannerDiagnosticCode }>;

type V6CliDependencies = Readonly<{
  validatePreflight(env: Record<string, unknown>): V6PreflightResult;
  snapshotHistoricalEvidence(
    root: string,
  ): Promise<ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot>;
  verifyHistoricalEvidence(
    input: Readonly<{
      root: string;
      snapshot: ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot;
    }>,
  ): Promise<ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot>;
  reserveEvidence(
    input: Readonly<{
      root: string;
      startedAt: string;
      runId: string;
      historicalSnapshot: ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot;
    }>,
  ): Promise<ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceReservation>;
  finalizeEvidence(
    input: Readonly<{
      root: string;
      historicalSnapshot: ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot;
      reservation: ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceReservation;
      summary: SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary;
    }>,
  ): Promise<boolean>;
  createEvaluator(env: Record<string, unknown>): V6EvaluatorFactoryResult;
}>;

const defaultDependencies: V6CliDependencies = {
  validatePreflight:
    validateReviewPlannerControlledLiveV6DeepSeekNonThinkingPreflight,
  snapshotHistoricalEvidence:
    snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence,
  verifyHistoricalEvidence:
    verifyReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence,
  reserveEvidence:
    reserveReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence,
  finalizeEvidence:
    finalizeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence,
  createEvaluator:
    createReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator,
};

/**
 * This is the only V6 provider boundary. It has no fallback provider, cannot
 * open a product gate, and may consume at most one canary plus 22 frozen cases.
 */
export async function executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli(
  input: Readonly<{
    argv: readonly string[];
    env: Record<string, unknown>;
    root: string;
    now?: () => number;
    randomUUID?: () => string;
    validatePreflight?: V6CliDependencies['validatePreflight'];
    snapshotHistoricalEvidence?: V6CliDependencies['snapshotHistoricalEvidence'];
    verifyHistoricalEvidence?: V6CliDependencies['verifyHistoricalEvidence'];
    reserveEvidence?: V6CliDependencies['reserveEvidence'];
    finalizeEvidence?: V6CliDependencies['finalizeEvidence'];
    createEvaluator?: V6CliDependencies['createEvaluator'];
  }>,
): Promise<SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary> {
  if (!hasExactConfirmation(input.argv)) {
    return blocked();
  }
  const dependencies = { ...defaultDependencies, ...input };
  const preflight = dependencies.validatePreflight(input.env);
  if (!preflight.ok) return blocked();

  let snapshot: ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot;
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

  let evidence: ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceReservation;
  try {
    evidence = await dependencies.reserveEvidence({
      root: input.root,
      startedAt: identity.startedAt,
      runId: identity.runId,
      historicalSnapshot: snapshot,
    });
  } catch {
    return attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo);
  }

  let evaluator: V6EvaluatorFactoryResult | undefined;
  let observedAttempts = 0;
  const readAttempts = () => {
    if (!evaluator || !evaluator.ok) return observedAttempts;
    try {
      const value = evaluator.value.providerAttemptCount();
      if (isAttemptCount(value))
        observedAttempts = Math.max(observedAttempts, value);
    } catch {
      // Preserve the greatest trusted lower bound; do not infer an attempt.
    }
    return observedAttempts;
  };
  let terminalStarted = false;
  const close = async (
    summary: SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary,
  ) => {
    if (terminalStarted) {
      return attempted(readAttempts(), ReviewPlannerDiagnosticCode.EvidenceIo);
    }
    terminalStarted = true;
    try {
      return await finish(
        evidence,
        summary,
        dependencies,
        input.root,
        snapshot,
      );
    } catch {
      return attempted(readAttempts(), ReviewPlannerDiagnosticCode.EvidenceIo);
    }
  };

  try {
    // The V1--V5 snapshot is checked again before the marker becomes attempted.
    try {
      await dependencies.verifyHistoricalEvidence({
        root: input.root,
        snapshot,
      });
    } catch {
      return close(attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo));
    }

    try {
      if (!(await evidence.markAttempted())) {
        return close(attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo));
      }
    } catch {
      return close(attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo));
    }

    try {
      evaluator = dependencies.createEvaluator(input.env);
    } catch {
      return close(attempted(0, ReviewPlannerDiagnosticCode.ExecutorInit));
    }
    if (!evaluator.ok) {
      return close(attempted(0, evaluator.diagnosticCode));
    }

    // Rebind immutable V1--V5 history immediately before the first provider-bound
    // canary. Construction itself is offline and never consumes a provider call.
    try {
      await dependencies.verifyHistoricalEvidence({
        root: input.root,
        snapshot,
      });
    } catch {
      return close(
        attempted(readAttempts(), ReviewPlannerDiagnosticCode.EvidenceIo),
      );
    }
    const diagnostic = await evaluator.value.runDiagnostic();
    if (isAttemptCount(diagnostic.providerAttemptCount)) {
      observedAttempts = Math.max(
        observedAttempts,
        diagnostic.providerAttemptCount,
      );
    }
    const canaryAttempts = readAttempts();
    if (!diagnostic.canContinue) {
      const summary =
        diagnostic.diagnosticCode === 'thinking_not_disabled'
          ? auditViolation(canaryAttempts)
          : attempted(
              canaryAttempts,
              validDiagnosticCode(diagnostic.diagnosticCode)
                ? diagnostic.diagnosticCode
                : ReviewPlannerDiagnosticCode.InvalidResponse,
            );
      return close(summary);
    }
    if (
      diagnostic.status !== 'complete' ||
      diagnostic.usageKnown !== true ||
      diagnostic.providerAttemptCount !== V6_CANARY_ATTEMPTS ||
      canaryAttempts !== V6_CANARY_ATTEMPTS
    ) {
      return close(
        attempted(
          canaryAttempts,
          ReviewPlannerDiagnosticCode.UsageUnverifiable,
        ),
      );
    }

    const paired = await evaluator.value.runPairedEvaluation();
    const totalAttempts = readAttempts();
    if (paired.kind !== 'report') {
      const summary =
        paired.diagnosticCode === 'thinking_not_disabled'
          ? auditViolation(totalAttempts)
          : attempted(totalAttempts, paired.diagnosticCode);
      return close(summary);
    }

    const parsedReport = phase695ReportSchema.safeParse(paired.report);
    const summary =
      parsedReport.success &&
      isOpenReport(parsedReport.data, totalAttempts, paired.cost)
        ? openSummary(
            parsedReport.data,
            paired.cost,
            evaluator.value.readEvidenceNonThinkingAudit(),
          )
        : attempted(totalAttempts, ReviewPlannerDiagnosticCode.InvalidResponse);
    return close(summary);
  } catch {
    return close(
      attempted(readAttempts(), ReviewPlannerDiagnosticCode.EvidenceIo),
    );
  }
}

/** Emits a strict data-only projection; it never writes raw provider details. */
export function serializeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary(
  value: SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary,
) {
  const parsed =
    safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse(
      value,
    );
  if (parsed.status !== 'complete') {
    const base = {
      status: parsed.status,
      gate: parsed.gate,
      providerAttemptCount: parsed.providerAttemptCount,
      usageKnown: parsed.usageKnown,
      diagnosticCode: parsed.diagnosticCode,
    };
    return 'nonThinkingAudit' in parsed
      ? JSON.stringify({ ...base, nonThinkingAudit: parsed.nonThinkingAudit })
      : JSON.stringify(base);
  }
  return JSON.stringify({
    status: parsed.status,
    gate: parsed.gate,
    providerAttemptCount: parsed.providerAttemptCount,
    usageKnown: parsed.usageKnown,
    priceProfileId: parsed.priceProfileId,
    currency: parsed.currency,
    aggregateInputTokens: parsed.aggregateInputTokens,
    aggregateOutputTokens: parsed.aggregateOutputTokens,
    observedCostCny: parsed.observedCostCny,
    hardCapCny: parsed.hardCapCny,
    withinHardCap: parsed.withinHardCap,
    quality: parsed.quality,
    nonThinkingAudit: parsed.nonThinkingAudit,
  });
}

async function finish(
  evidence: ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceReservation,
  summary: SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary,
  dependencies: Pick<
    V6CliDependencies,
    'verifyHistoricalEvidence' | 'finalizeEvidence'
  >,
  root: string,
  snapshot: ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot,
): Promise<SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary> {
  let safe =
    safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.safeParse(
      summary,
    ).success
      ? summary
      : attempted(
          summary.providerAttemptCount,
          ReviewPlannerDiagnosticCode.InvalidResponse,
        );

  try {
    await dependencies.verifyHistoricalEvidence({ root, snapshot });
  } catch {
    safe = attempted(
      safe.providerAttemptCount,
      ReviewPlannerDiagnosticCode.EvidenceIo,
    );
  }
  try {
    const finalized = await dependencies.finalizeEvidence({
      root,
      historicalSnapshot: snapshot,
      reservation: evidence,
      summary: safe,
    });
    if (!finalized) {
      return attempted(
        safe.providerAttemptCount,
        ReviewPlannerDiagnosticCode.EvidenceIo,
      );
    }
  } catch {
    return attempted(
      safe.providerAttemptCount,
      ReviewPlannerDiagnosticCode.EvidenceIo,
    );
  }
  return safe;
}

function isOpenReport(
  report: Phase695Report,
  providerAttemptCount: number,
  cost: ReviewPlannerControlledLiveV6CnyCost,
) {
  const runtimeEntries = report.caseEntries.filter(
    (entry) => entry.executionKind === 'runtime',
  );
  const zeroCallEntries = report.caseEntries.filter(
    (entry) => entry.executionKind === 'zero_call',
  );
  return (
    providerAttemptCount === V6_TOTAL_PROVIDER_ATTEMPTS &&
    report.mode === 'live' &&
    report.productionDecision === 'quality_gate_passed' &&
    report.counters.caseEntries === V6_CASE_ENTRIES &&
    report.counters.zeroCallCases === V6_ZERO_CALL_CASES &&
    report.counters.runtimeInvocations === V6_PAIRED_RUNTIME_ATTEMPTS &&
    report.counters.strictSuccesses === V6_CASE_ENTRIES &&
    report.counters.qualityPasses === V6_CASE_ENTRIES &&
    report.counters.criticalFailures === 0 &&
    report.metrics.strictSchemaSuccessRate === 1 &&
    report.metrics.semanticQualityRate >= 0.9 &&
    report.metrics.p95DurationMs <= V6_MAX_P95_DURATION_MS &&
    zeroCallEntries.length === V6_ZERO_CALL_CASES &&
    zeroCallEntries.every(
      (entry) => entry.zeroCallVerified && entry.runtimeInvocations === 0,
    ) &&
    runtimeEntries.length === V6_PAIRED_RUNTIME_ATTEMPTS &&
    runtimeEntries.every(
      (entry) =>
        entry.runtimeInvocations === 1 &&
        entry.strictSuccess &&
        entry.qualityPass,
    ) &&
    isValidV6Cost(cost)
  );
}

function openSummary(
  report: Phase695Report,
  cost: ReviewPlannerControlledLiveV6CnyCost,
  nonThinkingAudit: ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceAudit,
): SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary {
  return safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse(
    {
      status: 'complete',
      gate: 'open',
      providerAttemptCount: V6_TOTAL_PROVIDER_ATTEMPTS,
      usageKnown: true,
      priceProfileId:
        REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PRICE_PROFILE_ID,
      currency: 'CNY',
      aggregateInputTokens: cost.observedInputTokens,
      aggregateOutputTokens: cost.observedOutputTokens,
      observedCostCny: cost.observedCostCny,
      hardCapCny: V6_HARD_CAP_CNY,
      withinHardCap: true,
      quality: {
        caseEntries: V6_CASE_ENTRIES,
        zeroCallCases: V6_ZERO_CALL_CASES,
        runtimeInvocations: V6_PAIRED_RUNTIME_ATTEMPTS,
        strictSuccesses: report.counters.strictSuccesses,
        qualityPasses: report.counters.qualityPasses,
        criticalFailures: report.counters.criticalFailures,
        p95DurationMs: report.metrics.p95DurationMs,
        productionDecision: report.productionDecision,
      },
      nonThinkingAudit,
    },
  );
}

function isValidV6Cost(cost: ReviewPlannerControlledLiveV6CnyCost) {
  return (
    cost.currency === 'CNY' &&
    cost.nonCachedInputCnyPerMillionTokens === 3 &&
    cost.outputCnyPerMillionTokens === 6 &&
    cost.hardCapCny === V6_HARD_CAP_CNY &&
    cost.maxPairedProviderAttempts === V6_PAIRED_RUNTIME_ATTEMPTS &&
    cost.maxProviderAttempts === V6_TOTAL_PROVIDER_ATTEMPTS &&
    cost.reservedInputTokens === V6_MAX_INPUT_TOKENS &&
    cost.reservedOutputTokens === V6_MAX_OUTPUT_TOKENS &&
    cost.reservedCostCny === 0.18726 &&
    Number.isSafeInteger(cost.observedInputTokens) &&
    cost.observedInputTokens > 0 &&
    cost.observedInputTokens <= V6_MAX_INPUT_TOKENS &&
    Number.isSafeInteger(cost.observedOutputTokens) &&
    cost.observedOutputTokens > 0 &&
    cost.observedOutputTokens <= V6_MAX_OUTPUT_TOKENS &&
    Number.isFinite(cost.observedCostCny) &&
    cost.observedCostCny >= 0 &&
    cost.observedCostCny <= V6_HARD_CAP_CNY &&
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

function blocked(): SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary {
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
  diagnosticCode: ReviewPlannerDiagnosticCode,
): SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary {
  return {
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: boundedAttempts(providerAttemptCount),
    usageKnown: false,
    diagnosticCode,
  };
}

function auditViolation(
  providerAttemptCount: number,
): SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary {
  return {
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: boundedAttempts(providerAttemptCount),
    usageKnown: false,
    diagnosticCode: 'thinking_not_disabled',
    // The evaluator keeps raw audit material private. A missing safe aggregate
    // is conservative evidence of a violated non-thinking transport contract.
    nonThinkingAudit: {
      reasoning: 'invalid_detail',
      reasoningContentPresent: false,
    },
  };
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
  return argv.length === 1 && argv[0] === V6_CONFIRMATION;
}

function validDiagnosticCode(
  value: ReviewPlannerDiagnosticCode | 'thinking_not_disabled' | undefined,
): value is ReviewPlannerDiagnosticCode {
  return Object.values(ReviewPlannerDiagnosticCode).includes(
    value as ReviewPlannerDiagnosticCode,
  );
}

function isAttemptCount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= V6_TOTAL_PROVIDER_ATTEMPTS
  );
}

function boundedAttempts(value: number) {
  return isAttemptCount(value) ? value : 0;
}
