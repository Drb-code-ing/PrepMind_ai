import { randomUUID } from 'node:crypto';

import {
  ReviewPlannerDiagnosticCode,
  phase695ReportSchema,
  type Phase695Report,
} from '@repo/agent';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PRICE_PROFILE_ID,
  reserveReviewPlannerControlledLiveV5DeepSeekEvidence,
  safeReviewPlannerControlledLiveV5DeepSeekSummarySchema,
  snapshotReviewPlannerControlledLiveV5HistoricalEvidence,
  verifyReviewPlannerControlledLiveV5HistoricalEvidence,
  type ReviewPlannerControlledLiveV5DeepSeekEvidenceReservation,
  type ReviewPlannerControlledLiveV5HistoricalEvidenceSnapshot,
  type SafeReviewPlannerControlledLiveV5DeepSeekSummary,
} from './review-planner-controlled-live-eval-v5-deepseek.evidence';
import {
  createReviewPlannerControlledLiveV5DeepSeekEvaluator,
  validateReviewPlannerControlledLiveV5DeepSeekPreflight,
  type ReviewPlannerControlledLiveV5CnyCost,
  type ReviewPlannerControlledLiveV5DeepSeekEvaluator,
} from './review-planner-controlled-live-eval-v5-deepseek.factory';

const V5_CONFIRMATION = '--confirm-controlled-live-v5-deepseek-v4-pro';
const V5_CANARY_ATTEMPTS = 1;
const V5_TOTAL_PROVIDER_ATTEMPTS = 23;
const V5_PAIRED_RUNTIME_ATTEMPTS = 22;
const V5_ZERO_CALL_CASES = 26;
const V5_CASE_ENTRIES = 48;
const V5_MAX_P95_DURATION_MS = 4_500;
const V5_MAX_INPUT_TOKENS = 42_996;
const V5_MAX_OUTPUT_TOKENS = 9_712;
const V5_HARD_CAP_CNY = 1;

type V5PreflightResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; diagnosticCode: ReviewPlannerDiagnosticCode }>;

type V5EvaluatorFactoryResult =
  | Readonly<{
      ok: true;
      value: ReviewPlannerControlledLiveV5DeepSeekEvaluator;
    }>
  | Readonly<{ ok: false; diagnosticCode: ReviewPlannerDiagnosticCode }>;

type V5CliDependencies = Readonly<{
  validatePreflight(env: Record<string, unknown>): V5PreflightResult;
  snapshotHistoricalEvidence(
    root: string,
  ): Promise<ReviewPlannerControlledLiveV5HistoricalEvidenceSnapshot>;
  verifyHistoricalEvidence(
    input: Readonly<{
      root: string;
      snapshot: ReviewPlannerControlledLiveV5HistoricalEvidenceSnapshot;
    }>,
  ): Promise<ReviewPlannerControlledLiveV5HistoricalEvidenceSnapshot>;
  reserveEvidence(
    input: Readonly<{
      root: string;
      startedAt: string;
      runId: string;
    }>,
  ): Promise<ReviewPlannerControlledLiveV5DeepSeekEvidenceReservation>;
  createEvaluator(env: Record<string, unknown>): V5EvaluatorFactoryResult;
}>;

const defaultDependencies: V5CliDependencies = {
  validatePreflight: validateReviewPlannerControlledLiveV5DeepSeekPreflight,
  snapshotHistoricalEvidence:
    snapshotReviewPlannerControlledLiveV5HistoricalEvidence,
  verifyHistoricalEvidence:
    verifyReviewPlannerControlledLiveV5HistoricalEvidence,
  reserveEvidence: reserveReviewPlannerControlledLiveV5DeepSeekEvidence,
  createEvaluator: createReviewPlannerControlledLiveV5DeepSeekEvaluator,
};

/**
 * V5 has a single confirmation string and a single evidence reservation. It
 * never reads .env itself, prints provider config, or retries an invocation.
 */
export async function executeReviewPlannerControlledLiveV5DeepSeekCli(
  input: Readonly<{
    argv: readonly string[];
    env: Record<string, unknown>;
    root: string;
    now?: () => number;
    randomUUID?: () => string;
    validatePreflight?: V5CliDependencies['validatePreflight'];
    snapshotHistoricalEvidence?: V5CliDependencies['snapshotHistoricalEvidence'];
    verifyHistoricalEvidence?: V5CliDependencies['verifyHistoricalEvidence'];
    reserveEvidence?: V5CliDependencies['reserveEvidence'];
    createEvaluator?: V5CliDependencies['createEvaluator'];
  }>,
): Promise<SafeReviewPlannerControlledLiveV5DeepSeekSummary> {
  if (!hasExactConfirmation(input.argv)) {
    return blocked(ReviewPlannerDiagnosticCode.PreflightInvalid);
  }
  const dependencies = { ...defaultDependencies, ...input };
  const preflight = dependencies.validatePreflight(input.env);
  if (!preflight.ok) return blocked(preflight.diagnosticCode);

  const identity = evidenceIdentity(
    input.now ?? Date.now,
    input.randomUUID ?? randomUUID,
  );
  if (!identity) return blocked(ReviewPlannerDiagnosticCode.PreflightInvalid);

  let snapshot: ReviewPlannerControlledLiveV5HistoricalEvidenceSnapshot;
  try {
    snapshot = await dependencies.snapshotHistoricalEvidence(input.root);
  } catch {
    return blocked(ReviewPlannerDiagnosticCode.EvidenceIo);
  }

  let evidence: ReviewPlannerControlledLiveV5DeepSeekEvidenceReservation;
  try {
    evidence = await dependencies.reserveEvidence({
      root: input.root,
      startedAt: identity.startedAt,
      runId: identity.runId,
    });
  } catch {
    return blocked(ReviewPlannerDiagnosticCode.EvidenceIo);
  }

  // The historical snapshot must still be intact before creating a provider
  // executor. A failed check consumes no provider attempt.
  try {
    await dependencies.verifyHistoricalEvidence({ root: input.root, snapshot });
  } catch {
    return blocked(ReviewPlannerDiagnosticCode.EvidenceIo);
  }

  try {
    if (!(await evidence.markAttempted())) {
      return finish(
        evidence,
        attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo),
        dependencies,
        input.root,
        snapshot,
      );
    }
  } catch {
    return finish(
      evidence,
      attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo),
      dependencies,
      input.root,
      snapshot,
    );
  }

  let evaluator: V5EvaluatorFactoryResult;
  try {
    evaluator = dependencies.createEvaluator(input.env);
  } catch {
    return finish(
      evidence,
      attempted(0, ReviewPlannerDiagnosticCode.ExecutorInit),
      dependencies,
      input.root,
      snapshot,
    );
  }
  if (!evaluator.ok) {
    return finish(
      evidence,
      attempted(0, evaluator.diagnosticCode),
      dependencies,
      input.root,
      snapshot,
    );
  }

  let observedAttempts = 0;
  const readAttempts = () => {
    try {
      const value = evaluator.value.providerAttemptCount();
      if (isAttemptCount(value))
        observedAttempts = Math.max(observedAttempts, value);
    } catch {
      // Retain the highest trusted lower bound; never fabricate zero attempts.
    }
    return observedAttempts;
  };

  let diagnostic;
  try {
    diagnostic = await evaluator.value.runDiagnostic();
  } catch {
    return finish(
      evidence,
      attempted(readAttempts(), ReviewPlannerDiagnosticCode.Transport),
      dependencies,
      input.root,
      snapshot,
    );
  }
  if (isAttemptCount(diagnostic.providerAttemptCount)) {
    observedAttempts = Math.max(
      observedAttempts,
      diagnostic.providerAttemptCount,
    );
  }
  const canaryAttempts = readAttempts();
  if (!diagnostic.canContinue) {
    return finish(
      evidence,
      attempted(
        canaryAttempts,
        validDiagnosticCode(diagnostic.diagnosticCode)
          ? diagnostic.diagnosticCode
          : ReviewPlannerDiagnosticCode.InvalidResponse,
      ),
      dependencies,
      input.root,
      snapshot,
    );
  }
  if (
    diagnostic.status !== 'complete' ||
    diagnostic.usageKnown !== true ||
    diagnostic.providerAttemptCount !== V5_CANARY_ATTEMPTS ||
    canaryAttempts !== V5_CANARY_ATTEMPTS
  ) {
    return finish(
      evidence,
      attempted(canaryAttempts, ReviewPlannerDiagnosticCode.UsageUnverifiable),
      dependencies,
      input.root,
      snapshot,
    );
  }

  let paired;
  try {
    paired = await evaluator.value.runPairedEvaluation();
  } catch {
    return finish(
      evidence,
      attempted(readAttempts(), ReviewPlannerDiagnosticCode.Transport),
      dependencies,
      input.root,
      snapshot,
    );
  }
  const totalAttempts = readAttempts();
  if (paired.kind !== 'report') {
    return finish(
      evidence,
      attempted(totalAttempts, paired.diagnosticCode),
      dependencies,
      input.root,
      snapshot,
    );
  }
  const report = phase695ReportSchema.safeParse(paired.report);
  const summary =
    report.success && isOpenReport(report.data, totalAttempts, paired.cost)
      ? openSummary(report.data, paired.cost)
      : attempted(totalAttempts, ReviewPlannerDiagnosticCode.InvalidResponse);
  return finish(evidence, summary, dependencies, input.root, snapshot);
}

/** Outputs only the strict evidence projection, never configuration or text. */
export function serializeReviewPlannerControlledLiveV5DeepSeekSummary(
  value: SafeReviewPlannerControlledLiveV5DeepSeekSummary,
) {
  const parsed =
    safeReviewPlannerControlledLiveV5DeepSeekSummarySchema.parse(value);
  if (parsed.status !== 'complete') {
    return JSON.stringify({
      status: parsed.status,
      gate: parsed.gate,
      providerAttemptCount: parsed.providerAttemptCount,
      usageKnown: parsed.usageKnown,
      diagnosticCode: parsed.diagnosticCode,
    });
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
  });
}

async function finish(
  evidence: ReviewPlannerControlledLiveV5DeepSeekEvidenceReservation,
  summary: SafeReviewPlannerControlledLiveV5DeepSeekSummary,
  dependencies: Pick<V5CliDependencies, 'verifyHistoricalEvidence'>,
  root: string,
  snapshot: ReviewPlannerControlledLiveV5HistoricalEvidenceSnapshot,
): Promise<SafeReviewPlannerControlledLiveV5DeepSeekSummary> {
  let safe = safeReviewPlannerControlledLiveV5DeepSeekSummarySchema.safeParse(
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
    if (!(await evidence.finalize(safe))) {
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
  try {
    await dependencies.verifyHistoricalEvidence({ root, snapshot });
  } catch {
    safe = attempted(
      safe.providerAttemptCount,
      ReviewPlannerDiagnosticCode.EvidenceIo,
    );
    try {
      if (!(await evidence.finalize(safe))) {
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
    } finally {
      evidence.seal();
    }
    return safe;
  }
  evidence.seal();
  return safe;
}

function isOpenReport(
  report: Phase695Report,
  providerAttemptCount: number,
  cost: ReviewPlannerControlledLiveV5CnyCost,
) {
  const runtimeEntries = report.caseEntries.filter(
    (entry) => entry.executionKind === 'runtime',
  );
  const zeroCallEntries = report.caseEntries.filter(
    (entry) => entry.executionKind === 'zero_call',
  );
  return (
    providerAttemptCount === V5_TOTAL_PROVIDER_ATTEMPTS &&
    report.productionDecision === 'quality_gate_passed' &&
    report.counters.caseEntries === V5_CASE_ENTRIES &&
    report.counters.zeroCallCases === V5_ZERO_CALL_CASES &&
    report.counters.runtimeInvocations === V5_PAIRED_RUNTIME_ATTEMPTS &&
    report.metrics.p95DurationMs <= V5_MAX_P95_DURATION_MS &&
    zeroCallEntries.length === V5_ZERO_CALL_CASES &&
    zeroCallEntries.every((entry) => entry.zeroCallVerified) &&
    runtimeEntries.length === V5_PAIRED_RUNTIME_ATTEMPTS &&
    runtimeEntries.every(
      (entry) =>
        entry.runtimeInvocations === 1 &&
        entry.strictSuccess &&
        entry.qualityPass,
    ) &&
    isValidV5Cost(cost)
  );
}

function openSummary(
  report: Phase695Report,
  cost: ReviewPlannerControlledLiveV5CnyCost,
): SafeReviewPlannerControlledLiveV5DeepSeekSummary {
  const runtimeEntries = report.caseEntries.filter(
    (entry) => entry.executionKind === 'runtime',
  );
  return safeReviewPlannerControlledLiveV5DeepSeekSummarySchema.parse({
    status: 'complete',
    gate: 'open',
    providerAttemptCount: V5_TOTAL_PROVIDER_ATTEMPTS,
    usageKnown: true,
    priceProfileId: REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PRICE_PROFILE_ID,
    currency: 'CNY',
    aggregateInputTokens: cost.observedInputTokens,
    aggregateOutputTokens: cost.observedOutputTokens,
    observedCostCny: cost.observedCostCny,
    hardCapCny: V5_HARD_CAP_CNY,
    withinHardCap: true,
    quality: {
      caseEntries: V5_CASE_ENTRIES,
      zeroCallCases: V5_ZERO_CALL_CASES,
      runtimeInvocations: V5_PAIRED_RUNTIME_ATTEMPTS,
      strictSuccesses: runtimeEntries.filter((entry) => entry.strictSuccess)
        .length,
      qualityPasses: runtimeEntries.filter((entry) => entry.qualityPass).length,
      criticalFailures: report.counters.criticalFailures,
      p95DurationMs: report.metrics.p95DurationMs,
      productionDecision: report.productionDecision,
    },
  });
}

function isValidV5Cost(cost: ReviewPlannerControlledLiveV5CnyCost) {
  return (
    cost.currency === 'CNY' &&
    cost.nonCachedInputCnyPerMillionTokens === 3 &&
    cost.outputCnyPerMillionTokens === 6 &&
    cost.hardCapCny === V5_HARD_CAP_CNY &&
    cost.maxPairedProviderAttempts === V5_PAIRED_RUNTIME_ATTEMPTS &&
    cost.maxProviderAttempts === V5_TOTAL_PROVIDER_ATTEMPTS &&
    cost.reservedInputTokens === V5_MAX_INPUT_TOKENS &&
    cost.reservedOutputTokens === V5_MAX_OUTPUT_TOKENS &&
    cost.reservedCostCny === 0.18726 &&
    Number.isSafeInteger(cost.observedInputTokens) &&
    cost.observedInputTokens > 0 &&
    cost.observedInputTokens <= V5_MAX_INPUT_TOKENS &&
    Number.isSafeInteger(cost.observedOutputTokens) &&
    cost.observedOutputTokens > 0 &&
    cost.observedOutputTokens <= V5_MAX_OUTPUT_TOKENS &&
    Number.isFinite(cost.observedCostCny) &&
    cost.observedCostCny >= 0 &&
    cost.observedCostCny <= V5_HARD_CAP_CNY &&
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

function blocked(
  diagnosticCode: ReviewPlannerDiagnosticCode,
): SafeReviewPlannerControlledLiveV5DeepSeekSummary {
  return {
    status: 'diagnostic_blocked',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode,
  };
}

function attempted(
  providerAttemptCount: number,
  diagnosticCode: ReviewPlannerDiagnosticCode,
): SafeReviewPlannerControlledLiveV5DeepSeekSummary {
  return {
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: boundedAttempts(providerAttemptCount),
    usageKnown: false,
    diagnosticCode,
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
  return argv.length === 1 && argv[0] === V5_CONFIRMATION;
}

function validDiagnosticCode(
  value: ReviewPlannerDiagnosticCode | undefined,
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
    value <= V5_TOTAL_PROVIDER_ATTEMPTS
  );
}

function boundedAttempts(value: number) {
  return isAttemptCount(value) ? value : 0;
}
