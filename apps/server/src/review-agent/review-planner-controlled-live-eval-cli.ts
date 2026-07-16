import { randomUUID } from 'node:crypto';

import { ReviewPlannerDiagnosticCode, type Phase695Report } from '@repo/agent';

import {
  reserveReviewPlannerControlledLiveEvidence,
  reserveReviewPlannerControlledLiveV3Evidence,
  safeReviewPlannerControlledLiveSummarySchema,
  safeReviewPlannerControlledLiveV3SummarySchema,
  type SafeReviewPlannerControlledLiveSummary,
  type SafeReviewPlannerControlledLiveV3Summary,
} from './review-planner-controlled-live-eval-evidence';
import {
  createReviewPlannerControlledLiveEvaluator,
  createReviewPlannerControlledLiveV3Evaluator,
  validateReviewPlannerControlledLiveV3Preflight,
} from './review-planner-controlled-live-eval.factory';

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

/** The v3 serializer is intentionally separate from the frozen v1/v2 output. */
export function serializeReviewPlannerControlledLiveV3Summary(
  value: SafeReviewPlannerControlledLiveV3Summary,
) {
  const parsed = safeReviewPlannerControlledLiveV3SummarySchema.parse(value);
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
 * An independent once-only v3 state machine. Its reservation completes before
 * executor construction, so a failure cannot consume or rewrite v1/v2.
 */
export async function executeReviewPlannerControlledLiveV3Cli(
  input: Readonly<{
    argv: readonly string[];
    env: Record<string, unknown>;
    root: string;
    now?: () => number;
    randomUUID?: () => string;
    dependencies?: CliDependencies;
    reserveEvidence?: typeof reserveReviewPlannerControlledLiveV3Evidence;
    createEvaluator?: typeof createReviewPlannerControlledLiveV3Evaluator;
  }>,
): Promise<SafeReviewPlannerControlledLiveV3Summary> {
  if (!hasExactV3Confirmation(input.argv)) {
    return blockedV3(ReviewPlannerDiagnosticCode.PreflightInvalid);
  }
  const preflight = validateReviewPlannerControlledLiveV3Preflight(
    input.env,
    input.dependencies,
  );
  if (!preflight.ok) return blockedV3(preflight.diagnosticCode);

  const identity = createEvidenceIdentity(
    input.now ?? Date.now,
    input.randomUUID ?? randomUUID,
  );
  if (!identity) return blockedV3(ReviewPlannerDiagnosticCode.PreflightInvalid);

  let evidence: Awaited<
    ReturnType<typeof reserveReviewPlannerControlledLiveV3Evidence>
  >;
  try {
    evidence = await (
      input.reserveEvidence ?? reserveReviewPlannerControlledLiveV3Evidence
    )({
      root: input.root,
      startedAt: identity.startedAt,
      runId: identity.runId,
    });
  } catch {
    return blockedV3(ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  try {
    if (!(await evidence.markAttempted())) {
      return finalizeV3EvidenceOrConservativeFailure(
        evidence,
        attemptedV3EvidenceFailure(0),
        0,
      );
    }
  } catch {
    return finalizeV3EvidenceOrConservativeFailure(
      evidence,
      attemptedV3EvidenceFailure(0),
      0,
    );
  }

  let providerAttemptCount = 0;
  try {
    const evaluator = (
      input.createEvaluator ?? createReviewPlannerControlledLiveV3Evaluator
    )(input.env, input.dependencies);
    if (!evaluator.ok) {
      const summary = attemptedV3ModelFailure(0, evaluator.diagnosticCode);
      return finalizeV3EvidenceOrConservativeFailure(evidence, summary, 0);
    }
    const observeProviderAttemptCount = (value: unknown) => {
      if (
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 0 &&
        value <= 48
      ) {
        providerAttemptCount = Math.max(providerAttemptCount, value);
      }
      return providerAttemptCount;
    };
    const readProviderAttemptCount = () => {
      try {
        observeProviderAttemptCount(evaluator.value.providerAttemptCount());
      } catch {
        // Preserve the max valid count observed from diagnostic/paired output.
      }
      return providerAttemptCount;
    };

    let diagnostic;
    try {
      diagnostic = await evaluator.value.runDiagnostic();
    } catch {
      diagnostic = {
        status: 'invalid_attempted' as const,
        canContinue: false,
        providerAttemptCount: readProviderAttemptCount(),
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
      };
    }
    try {
      observeProviderAttemptCount(diagnostic.providerAttemptCount);
    } catch {
      // A hostile diagnostic getter cannot erase an earlier safe observation.
    }
    if (!diagnostic.canContinue) {
      const actualProviderAttemptCount = readProviderAttemptCount();
      const summary = safeReviewPlannerControlledLiveV3SummarySchema.parse({
        status: diagnostic.status,
        gate: 'closed',
        providerAttemptCount: actualProviderAttemptCount,
        usageKnown: diagnostic.usageKnown,
        ...(diagnostic.diagnosticCode
          ? { diagnosticCode: diagnostic.diagnosticCode }
          : {}),
        ...(diagnostic.structuredOutputStage
          ? { structuredOutputStage: diagnostic.structuredOutputStage }
          : {}),
      });
      return finalizeV3EvidenceOrConservativeFailure(
        evidence,
        summary,
        actualProviderAttemptCount,
      );
    }

    let paired;
    try {
      paired = await evaluator.value.runPairedEvaluation();
    } catch {
      paired = {
        kind: 'failed' as const,
        diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
      };
    }
    if (paired.kind === 'report') {
      try {
        observeProviderAttemptCount(paired.report.counters.runtimeInvocations);
      } catch {
        // Report fields are advisory for this safe count lower bound only.
      }
    }
    const summary =
      paired.kind === 'report'
        ? summarizeV3PairedReport(paired.report, readProviderAttemptCount())
        : attemptedV3ModelFailure(
            readProviderAttemptCount(),
            paired.diagnosticCode,
          );
    return finalizeV3EvidenceOrConservativeFailure(
      evidence,
      summary,
      readProviderAttemptCount(),
    );
  } catch {
    return finalizeV3EvidenceOrConservativeFailure(
      evidence,
      attemptedV3EvidenceFailure(providerAttemptCount),
      providerAttemptCount,
    );
  }
}

function hasExactConfirmation(argv: readonly string[]) {
  return argv.length === 1 && argv[0] === '--confirm-controlled-live';
}

function hasExactV3Confirmation(argv: readonly string[]) {
  return argv.length === 1 && argv[0] === '--confirm-controlled-live-v3';
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

function summarizeV3PairedReport(
  report: Phase695Report,
  providerAttemptCount: number,
): SafeReviewPlannerControlledLiveV3Summary {
  const summary = summarizePairedReport(report, providerAttemptCount);
  return safeReviewPlannerControlledLiveV3SummarySchema.parse(summary);
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

function blockedV3(
  diagnosticCode: ReviewPlannerDiagnosticCode,
): SafeReviewPlannerControlledLiveV3Summary {
  return {
    status: 'diagnostic_blocked',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode,
  };
}

function attemptedV3EvidenceFailure(
  providerAttemptCount: number,
): SafeReviewPlannerControlledLiveV3Summary {
  return {
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: safeProviderAttempts(providerAttemptCount),
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
  };
}

function attemptedV3ModelFailure(
  providerAttemptCount: number,
  diagnosticCode: ReviewPlannerDiagnosticCode,
): SafeReviewPlannerControlledLiveV3Summary {
  return {
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: safeProviderAttempts(providerAttemptCount),
    usageKnown: false,
    diagnosticCode,
  };
}

async function finalizeV3EvidenceOrConservativeFailure(
  evidence: Awaited<
    ReturnType<typeof reserveReviewPlannerControlledLiveV3Evidence>
  >,
  summary: SafeReviewPlannerControlledLiveV3Summary,
  providerAttemptCount: number,
): Promise<SafeReviewPlannerControlledLiveV3Summary> {
  try {
    if (await evidence.finalize(summary)) return summary;
  } catch {
    // The v3 script must never convert a post-reservation I/O failure into
    // a fabricated zero-call preflight result.
  }
  return attemptedV3EvidenceFailure(providerAttemptCount);
}

function safeProviderAttempts(value: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 48 ? value : 0;
}
