import { randomUUID } from 'node:crypto';

import { ReviewPlannerDiagnosticCode, type Phase695Report } from '@repo/agent';

import {
  reserveReviewPlannerControlledLiveEvidence,
  safeReviewPlannerControlledLiveSummarySchema,
  type SafeReviewPlannerControlledLiveSummary,
} from './review-planner-controlled-live-eval-evidence';
import { createReviewPlannerControlledLiveEvaluator } from './review-planner-controlled-live-eval.factory';

type CliDependencies = NonNullable<
  Parameters<typeof createReviewPlannerControlledLiveEvaluator>[1]
>;

export async function executeReviewPlannerControlledLiveCli(
  input: Readonly<{
    argv: readonly string[];
    env: Record<string, unknown>;
    root: string;
    now?: () => number;
    randomUUID?: () => string;
    dependencies?: CliDependencies;
    reserveEvidence?: typeof reserveReviewPlannerControlledLiveEvidence;
  }>,
): Promise<SafeReviewPlannerControlledLiveSummary> {
  if (!hasExactConfirmation(input.argv))
    return blocked(ReviewPlannerDiagnosticCode.PreflightInvalid);

  const evaluator = createReviewPlannerControlledLiveEvaluator(
    input.env,
    input.dependencies,
  );
  if (!evaluator.ok) return blocked(evaluator.diagnosticCode);

  const identity = createEvidenceIdentity(
    input.now ?? Date.now,
    input.randomUUID ?? randomUUID,
  );
  if (!identity) return blocked(ReviewPlannerDiagnosticCode.PreflightInvalid);

  let evidence: Awaited<
    ReturnType<typeof reserveReviewPlannerControlledLiveEvidence>
  >;
  try {
    evidence = await (
      input.reserveEvidence ?? reserveReviewPlannerControlledLiveEvidence
    )({
      root: input.root,
      startedAt: identity.startedAt,
      runId: identity.runId,
    });
  } catch {
    return blocked(ReviewPlannerDiagnosticCode.EvidenceIo);
  }

  if (!(await evidence.markAttempted()))
    return blocked(ReviewPlannerDiagnosticCode.EvidenceIo);

  let diagnostic;
  try {
    diagnostic = await evaluator.value.runDiagnostic();
  } catch {
    diagnostic = {
      status: 'invalid_attempted' as const,
      canContinue: false,
      providerAttemptCount: evaluator.value.providerAttemptCount(),
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
    };
  }
  if (!diagnostic.canContinue) {
    const summary: SafeReviewPlannerControlledLiveSummary = {
      status: diagnostic.status,
      gate: 'closed',
      providerAttemptCount: diagnostic.providerAttemptCount,
      usageKnown: diagnostic.usageKnown,
      ...(diagnostic.diagnosticCode
        ? { diagnosticCode: diagnostic.diagnosticCode }
        : {}),
    };
    return (await evidence.finalize(summary))
      ? summary
      : attemptedEvidenceFailure(diagnostic.providerAttemptCount);
  }

  const paired = await evaluator.value.runPairedEvaluation();
  const summary =
    paired.kind === 'report'
      ? summarizePairedReport(
          paired.report,
          evaluator.value.providerAttemptCount(),
        )
      : attemptedModelFailure(
          evaluator.value.providerAttemptCount(),
          paired.diagnosticCode,
        );
  return (await evidence.finalize(summary))
    ? summary
    : attemptedEvidenceFailure(evaluator.value.providerAttemptCount());
}

export function serializeReviewPlannerControlledLiveSummary(
  value: SafeReviewPlannerControlledLiveSummary,
) {
  const parsed = safeReviewPlannerControlledLiveSummarySchema.parse(value);
  return JSON.stringify({
    status: parsed.status,
    gate: parsed.gate,
    providerAttemptCount: parsed.providerAttemptCount,
    usageKnown: parsed.usageKnown,
    ...(parsed.diagnosticCode ? { diagnosticCode: parsed.diagnosticCode } : {}),
  });
}

function hasExactConfirmation(argv: readonly string[]) {
  return argv.length === 1 && argv[0] === '--confirm-controlled-live';
}

function createEvidenceIdentity(now: () => number, newUuid: () => string) {
  try {
    const epoch = now();
    const runId = newUuid();
    if (
      !Number.isSafeInteger(epoch) ||
      epoch < 0 ||
      typeof runId !== 'string' ||
      !/^[A-Za-z0-9._:-]{1,120}$/.test(runId)
    )
      return null;
    return { startedAt: new Date(epoch).toISOString(), runId };
  } catch {
    return null;
  }
}

function summarizePairedReport(
  report: Phase695Report,
  providerAttemptCount: number,
): SafeReviewPlannerControlledLiveSummary {
  const passed = report.productionDecision === 'quality_gate_passed';
  const usageKnown =
    passed &&
    report.counters.runtimeInvocations > 0 &&
    report.counters.inputTokens > 0 &&
    report.counters.outputTokens > 0;
  return {
    status: 'complete',
    gate: passed && usageKnown ? 'open' : 'closed',
    providerAttemptCount: safeProviderAttempts(providerAttemptCount),
    usageKnown,
  };
}

function blocked(
  diagnosticCode: ReviewPlannerDiagnosticCode,
): SafeReviewPlannerControlledLiveSummary {
  return {
    status: 'diagnostic_blocked',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode,
  };
}

function attemptedEvidenceFailure(
  providerAttemptCount: number,
): SafeReviewPlannerControlledLiveSummary {
  return {
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: safeProviderAttempts(providerAttemptCount),
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
  };
}

function attemptedModelFailure(
  providerAttemptCount: number,
  diagnosticCode:
    | ReviewPlannerDiagnosticCode.Transport
    | ReviewPlannerDiagnosticCode.InvalidResponse,
): SafeReviewPlannerControlledLiveSummary {
  return {
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: safeProviderAttempts(providerAttemptCount),
    usageKnown: false,
    diagnosticCode,
  };
}

function safeProviderAttempts(value: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 48 ? value : 0;
}
