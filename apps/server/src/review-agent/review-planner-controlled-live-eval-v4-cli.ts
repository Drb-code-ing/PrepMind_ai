import { randomUUID } from 'node:crypto';

import {
  phase695ReportSchema,
  ReviewPlannerDiagnosticCode,
  type Phase695Report,
} from '@repo/agent';

import {
  reserveReviewPlannerControlledLiveV4Evidence,
  safeReviewPlannerControlledLiveV4SummarySchema,
  type ReviewPlannerControlledLiveV4EvidenceReservation,
  type SafeReviewPlannerControlledLiveV4Summary,
} from './review-planner-controlled-live-eval-v4-evidence';
import {
  createReviewPlannerControlledLiveV4Evaluator,
  validateReviewPlannerControlledLiveV4Preflight,
} from './review-planner-controlled-live-eval-v4.factory';

const CANARY_ATTEMPTS = 1;
const PAIRED_RUNTIME_ATTEMPTS = 22;

/** V4 output is a fixed safe projection; it never serializes private config. */
export function serializeReviewPlannerControlledLiveV4Summary(
  value: SafeReviewPlannerControlledLiveV4Summary,
) {
  const parsed = safeReviewPlannerControlledLiveV4SummarySchema.parse(value);
  return JSON.stringify({
    status: parsed.status,
    gate: parsed.gate,
    providerAttemptCount: parsed.providerAttemptCount,
    usageKnown: parsed.usageKnown,
    ...(parsed.diagnosticCode ? { diagnosticCode: parsed.diagnosticCode } : {}),
    ...(parsed.structuredOutputStage
      ? { structuredOutputStage: parsed.structuredOutputStage }
      : {}),
  });
}

/**
 * V4 does not select, re-open, or modify v1-v3. It reserves V4 evidence,
 * marks the one provider boundary, then allows the paired runner only after a
 * complete positive-usage canary.
 */
export async function executeReviewPlannerControlledLiveV4Cli(
  input: Readonly<{
    argv: readonly string[];
    env: Record<string, unknown>;
    root: string;
    now?: () => number;
    randomUUID?: () => string;
    reserveEvidence?: typeof reserveReviewPlannerControlledLiveV4Evidence;
    createEvaluator?: typeof createReviewPlannerControlledLiveV4Evaluator;
  }>,
): Promise<SafeReviewPlannerControlledLiveV4Summary> {
  if (!hasExactV4Confirmation(input.argv)) {
    return blocked(ReviewPlannerDiagnosticCode.PreflightInvalid);
  }
  const preflight = validateReviewPlannerControlledLiveV4Preflight(input.env);
  if (!preflight.ok) return blocked(preflight.diagnosticCode);
  const identity = evidenceIdentity(
    input.now ?? Date.now,
    input.randomUUID ?? randomUUID,
  );
  if (!identity) return blocked(ReviewPlannerDiagnosticCode.PreflightInvalid);

  let evidence: ReviewPlannerControlledLiveV4EvidenceReservation;
  try {
    evidence = await (
      input.reserveEvidence ?? reserveReviewPlannerControlledLiveV4Evidence
    )({
      root: input.root,
      startedAt: identity.startedAt,
      runId: identity.runId,
    });
  } catch {
    return blocked(ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  try {
    if (!(await evidence.markAttempted()))
      return finalizeOrEvidenceFailure(
        evidence,
        attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo),
      );
  } catch {
    return finalizeOrEvidenceFailure(
      evidence,
      attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo),
    );
  }

  let observedAttempts = 0;
  try {
    const evaluator = (
      input.createEvaluator ?? createReviewPlannerControlledLiveV4Evaluator
    )(input.env);
    if (!evaluator.ok) {
      return finalizeOrEvidenceFailure(
        evidence,
        attempted(0, evaluator.diagnosticCode),
      );
    }
    const readAttempts = () => {
      try {
        const value = evaluator.value.providerAttemptCount();
        if (validAttemptCount(value))
          observedAttempts = Math.max(observedAttempts, value);
      } catch {
        // Preserve the last trusted lower bound; never fabricate a zero call.
      }
      return observedAttempts;
    };

    let diagnostic;
    try {
      diagnostic = await evaluator.value.runDiagnostic();
    } catch {
      return finalizeOrEvidenceFailure(
        evidence,
        attempted(readAttempts(), ReviewPlannerDiagnosticCode.Transport),
      );
    }
    if (validAttemptCount(diagnostic.providerAttemptCount)) {
      observedAttempts = Math.max(
        observedAttempts,
        diagnostic.providerAttemptCount,
      );
    }
    const actualAttempts = readAttempts();
    if (!diagnostic.canContinue) {
      const summary = safeReviewPlannerControlledLiveV4SummarySchema.parse({
        status: diagnostic.status,
        gate: 'closed',
        providerAttemptCount: actualAttempts,
        usageKnown: diagnostic.usageKnown,
        ...(diagnostic.diagnosticCode
          ? { diagnosticCode: diagnostic.diagnosticCode }
          : {}),
        ...(diagnostic.structuredOutputStage
          ? { structuredOutputStage: diagnostic.structuredOutputStage }
          : {}),
      });
      return finalizeOrEvidenceFailure(evidence, summary);
    }
    if (
      diagnostic.status !== 'complete' ||
      diagnostic.usageKnown !== true ||
      diagnostic.providerAttemptCount !== CANARY_ATTEMPTS ||
      actualAttempts !== CANARY_ATTEMPTS
    ) {
      return finalizeOrEvidenceFailure(
        evidence,
        attempted(
          actualAttempts,
          ReviewPlannerDiagnosticCode.UsageUnverifiable,
        ),
      );
    }

    let paired;
    try {
      paired = await evaluator.value.runPairedEvaluation();
    } catch {
      return finalizeOrEvidenceFailure(
        evidence,
        attempted(readAttempts(), ReviewPlannerDiagnosticCode.Transport),
      );
    }
    const totalAttempts = readAttempts();
    if (paired.kind !== 'report') {
      return finalizeOrEvidenceFailure(
        evidence,
        attempted(totalAttempts, paired.diagnosticCode),
      );
    }
    const parsedReport = phase695ReportSchema.safeParse(paired.report);
    if (!parsedReport.success) {
      return finalizeOrEvidenceFailure(
        evidence,
        attempted(totalAttempts, ReviewPlannerDiagnosticCode.InvalidResponse),
      );
    }
    return finalizeOrEvidenceFailure(
      evidence,
      summarizePairedReport(parsedReport.data, totalAttempts),
    );
  } catch {
    return finalizeOrEvidenceFailure(
      evidence,
      attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo),
    );
  }
}

function hasExactV4Confirmation(argv: readonly string[]) {
  return argv.length === 1 && argv[0] === '--confirm-controlled-live-v4';
}

function evidenceIdentity(now: () => number, createRunId: () => string) {
  try {
    const epoch = now();
    const runId = createRunId();
    if (
      !Number.isSafeInteger(epoch) ||
      epoch < 0 ||
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
): SafeReviewPlannerControlledLiveV4Summary {
  const countsMatch =
    report.counters.runtimeInvocations === PAIRED_RUNTIME_ATTEMPTS &&
    providerAttemptCount === CANARY_ATTEMPTS + PAIRED_RUNTIME_ATTEMPTS;
  const usageKnown =
    countsMatch &&
    report.counters.inputTokens > 0 &&
    report.counters.outputTokens > 0;
  const gate =
    report.productionDecision === 'quality_gate_passed' && usageKnown
      ? 'open'
      : 'closed';
  return safeReviewPlannerControlledLiveV4SummarySchema.parse({
    status: 'complete',
    gate,
    providerAttemptCount: boundedAttempts(providerAttemptCount),
    usageKnown,
    ...(gate === 'closed'
      ? { diagnosticCode: ReviewPlannerDiagnosticCode.UsageUnverifiable }
      : {}),
  });
}

function blocked(
  diagnosticCode: ReviewPlannerDiagnosticCode,
): SafeReviewPlannerControlledLiveV4Summary {
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
): SafeReviewPlannerControlledLiveV4Summary {
  return {
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: boundedAttempts(providerAttemptCount),
    usageKnown: false,
    diagnosticCode,
  };
}

async function finalizeOrEvidenceFailure(
  evidence: ReviewPlannerControlledLiveV4EvidenceReservation,
  summary: SafeReviewPlannerControlledLiveV4Summary,
): Promise<SafeReviewPlannerControlledLiveV4Summary> {
  try {
    if (await evidence.finalize(summary)) return summary;
  } catch {
    // A completed provider attempt remains an attempted closure when evidence I/O fails.
  }
  return attempted(
    summary.providerAttemptCount,
    ReviewPlannerDiagnosticCode.EvidenceIo,
  );
}

function validAttemptCount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 48
  );
}

function boundedAttempts(value: number) {
  return validAttemptCount(value) ? value : 0;
}
