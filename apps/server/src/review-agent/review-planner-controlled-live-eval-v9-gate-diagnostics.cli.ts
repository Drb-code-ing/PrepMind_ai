import { ReviewPlannerDiagnosticCode } from '@repo/agent';
import { z } from 'zod';

import {
  v9GateDiagnosticSchema,
  type V9GateDiagnostic,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.contract';
import type {
  ReviewPlannerControlledLiveV9DiagnosticCommitment,
  ReviewPlannerControlledLiveV9EvidenceReservation,
  ReviewPlannerControlledLiveV9HistoricalEvidenceSnapshot,
  ReviewPlannerControlledLiveV9Stage,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.evidence';
import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID,
  type ReviewPlannerControlledLiveV9GateDiagnosticsEvaluatorPort,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.factory';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V9_CONFIRMATION =
  '--confirm-controlled-live-v9-deepseek-v4-pro-gate-diagnostics' as const;

const STAGE_EVALUATOR_READY = '.stage-030-evaluator-ready' as const;
const STAGE_PROVIDER_HISTORY_VERIFIED =
  '.stage-040-provider-history-verified' as const;
const STAGE_CANARY_STARTED = '.stage-050-canary-started' as const;
const STAGE_CANARY_RETURNED = '.stage-060-canary-returned' as const;
const STAGE_PAIRED_STARTED = '.stage-070-paired-started' as const;
const STAGE_PAIRED_RETURNED = '.stage-080-paired-returned' as const;

type BlockedSummary = Readonly<{
  status: 'diagnostic_blocked';
  gate: 'closed';
  providerAttemptCount: 0;
  pairedAdmissionCount: 0;
  usageKnown: false;
  diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid;
}>;

type AttemptedSummary = Readonly<{
  status: 'invalid_attempted';
  gate: 'closed';
  providerAttemptCount: number;
  pairedAdmissionCount: 0;
  usageKnown: false;
  diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo;
}>;

type DiagnosticSummary = Readonly<{
  status: 'invalid_attempted' | 'complete';
  gate: 'closed';
  providerAttemptCount: number;
  pairedAdmissionCount: number;
  usageKnown: boolean;
  terminalReason: V9GateDiagnostic['terminalReason'];
}>;

export type SafeReviewPlannerControlledLiveV9Summary =
  | BlockedSummary
  | AttemptedSummary
  | DiagnosticSummary;

const blockedSummarySchema = z
  .object({
    status: z.literal('diagnostic_blocked'),
    gate: z.literal('closed'),
    providerAttemptCount: z.literal(0),
    pairedAdmissionCount: z.literal(0),
    usageKnown: z.literal(false),
    diagnosticCode: z.literal(ReviewPlannerDiagnosticCode.PreflightInvalid),
  })
  .strict();

const attemptedSummarySchema = z
  .object({
    status: z.literal('invalid_attempted'),
    gate: z.literal('closed'),
    providerAttemptCount: z.number().int().safe().min(0).max(23),
    pairedAdmissionCount: z.literal(0),
    usageKnown: z.literal(false),
    diagnosticCode: z.literal(ReviewPlannerDiagnosticCode.EvidenceIo),
  })
  .strict();

const terminalReasonSchema = z.enum([
  'passed',
  'schema_invalid',
  'quality_gate_failed',
  'p95_exceeded',
  'usage_unverifiable',
  'attempt_count_mismatch',
  'admission_count_mismatch',
  'cost_cap_exceeded',
]);

const diagnosticSummarySchema = z
  .object({
    status: z.enum(['invalid_attempted', 'complete']),
    gate: z.literal('closed'),
    providerAttemptCount: z.number().int().safe().min(0).max(23),
    pairedAdmissionCount: z.number().int().safe().min(0).max(22),
    usageKnown: z.boolean(),
    terminalReason: terminalReasonSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.status === 'complete') !== (value.terminalReason === 'passed')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'status_terminal_reason_mismatch',
      });
    }
  });

const safeSummarySchema = z.union([
  blockedSummarySchema,
  attemptedSummarySchema,
  diagnosticSummarySchema,
]);

export type ReviewPlannerControlledLiveV9CliInput = Readonly<{
  argv: readonly string[];
  env: Record<string, unknown>;
  root: string;
  now: () => number;
  runId: string;
}>;

export type ReviewPlannerControlledLiveV9CliDependencies = Readonly<{
  validatePreflight(env: Record<string, unknown>):
    | Readonly<{ ok: true }>
    | Readonly<{
        ok: false;
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid;
      }>;
  snapshotHistoricalEvidence(
    root: string,
  ): Promise<ReviewPlannerControlledLiveV9HistoricalEvidenceSnapshot>;
  verifyHistoricalEvidence(
    input: Readonly<{
      root: string;
      snapshot: ReviewPlannerControlledLiveV9HistoricalEvidenceSnapshot;
    }>,
  ): Promise<ReviewPlannerControlledLiveV9HistoricalEvidenceSnapshot>;
  reserveEvidence(
    input: Readonly<{
      root: string;
      startedAt: string;
      runId: string;
      historicalSnapshot: ReviewPlannerControlledLiveV9HistoricalEvidenceSnapshot;
    }>,
  ): Promise<ReviewPlannerControlledLiveV9EvidenceReservation>;
  advanceStage(
    reservation: ReviewPlannerControlledLiveV9EvidenceReservation,
    stage: ReviewPlannerControlledLiveV9Stage,
  ): boolean;
  createEvaluator(
    env: Record<string, unknown>,
  ): ReviewPlannerControlledLiveV9GateDiagnosticsEvaluatorPort;
  commitDiagnostic(
    input: Readonly<{
      reservation: ReviewPlannerControlledLiveV9EvidenceReservation;
      diagnostic: V9GateDiagnostic;
    }>,
  ): Promise<ReviewPlannerControlledLiveV9DiagnosticCommitment | null>;
  completeValidation(
    reservation: ReviewPlannerControlledLiveV9EvidenceReservation,
  ): boolean;
  finalizeSuccess(
    reservation: ReviewPlannerControlledLiveV9EvidenceReservation,
  ): Promise<boolean>;
}>;

export async function runReviewPlannerControlledLiveV9GateDiagnosticsCli(
  input: ReviewPlannerControlledLiveV9CliInput,
  dependencies: ReviewPlannerControlledLiveV9CliDependencies,
): Promise<SafeReviewPlannerControlledLiveV9Summary> {
  if (!hasExactConfirmation(input.argv)) return blocked();
  try {
    if (dependencies.validatePreflight(input.env).ok !== true) return blocked();
  } catch {
    return blocked();
  }

  let reservation: ReviewPlannerControlledLiveV9EvidenceReservation | null =
    null;
  let terminalClosed = false;
  let observedAttempts = 0;
  try {
    const snapshot = await dependencies.snapshotHistoricalEvidence(input.root);
    reservation = await dependencies.reserveEvidence({
      root: input.root,
      startedAt: new Date(input.now()).toISOString(),
      runId: input.runId,
      historicalSnapshot: snapshot,
    });
    if (!(await reservation.markAttempted()))
      return attempted(observedAttempts);

    const evaluator = dependencies.createEvaluator(input.env);
    if (
      evaluator.state !== 'ready' ||
      evaluator.profileId !==
        REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID ||
      !checkpointAttempts(evaluator, 0)
    ) {
      return attempted(observedAttempts);
    }
    if (!advance(dependencies, reservation, STAGE_EVALUATOR_READY)) {
      return attempted(observedAttempts);
    }
    await dependencies.verifyHistoricalEvidence({
      root: input.root,
      snapshot,
    });
    if (
      !advance(dependencies, reservation, STAGE_PROVIDER_HISTORY_VERIFIED) ||
      !advance(dependencies, reservation, STAGE_CANARY_STARTED)
    ) {
      return attempted(observedAttempts);
    }

    let canary: Awaited<ReturnType<typeof evaluator.runCanary>>;
    try {
      canary = await evaluator.runCanary();
    } catch {
      observedAttempts = readAttempts(evaluator, 1, observedAttempts);
      return attempted(observedAttempts);
    }
    observedAttempts = readAttempts(evaluator, 1, observedAttempts);
    if (
      !advance(dependencies, reservation, STAGE_CANARY_RETURNED) ||
      canary.kind !== 'complete' ||
      canary.providerAttemptCount !== 1 ||
      canary.usageKnown !== true ||
      observedAttempts !== 1 ||
      !advance(dependencies, reservation, STAGE_PAIRED_STARTED)
    ) {
      return attempted(observedAttempts);
    }

    let paired: Awaited<ReturnType<typeof evaluator.runPaired>>;
    try {
      paired = await evaluator.runPaired();
    } catch {
      observedAttempts = readAttempts(evaluator, 23, observedAttempts);
      return attempted(observedAttempts);
    }
    observedAttempts = readAttempts(evaluator, 23, observedAttempts);
    if (
      !advance(dependencies, reservation, STAGE_PAIRED_RETURNED) ||
      observedAttempts !== 23
    ) {
      return attempted(observedAttempts);
    }
    const parsedDiagnostic = v9GateDiagnosticSchema.safeParse(
      paired.diagnostic,
    );
    if (!parsedDiagnostic.success) return attempted(observedAttempts);
    const resultKind = readPairedResultKind(paired.result);
    if (
      parsedDiagnostic.data.terminalReason === 'passed' &&
      resultKind !== 'report'
    ) {
      return attempted(observedAttempts);
    }

    const commitment = await dependencies.commitDiagnostic({
      reservation,
      diagnostic: parsedDiagnostic.data,
    });
    if (!commitment) return attempted(observedAttempts);
    if (!dependencies.completeValidation(reservation)) {
      return attempted(observedAttempts);
    }
    if (parsedDiagnostic.data.terminalReason !== 'passed') {
      terminalClosed = true;
      return diagnosticSummary(parsedDiagnostic.data, false);
    }
    if (!(await dependencies.finalizeSuccess(reservation))) {
      return attempted(observedAttempts);
    }
    terminalClosed = true;
    return diagnosticSummary(parsedDiagnostic.data, true);
  } catch {
    return attempted(observedAttempts);
  } finally {
    if (reservation && !terminalClosed) safeAbort(reservation);
  }
}

function readPairedResultKind(value: unknown): 'report' | 'failed' | null {
  try {
    if (!value || typeof value !== 'object') return null;
    const kind = (value as { kind?: unknown }).kind;
    return kind === 'report' || kind === 'failed' ? kind : null;
  } catch {
    return null;
  }
}

/** Serializes only the strict safe projection and always terminates one line. */
export function serializeReviewPlannerControlledLiveV9GateDiagnosticsSummary(
  value: SafeReviewPlannerControlledLiveV9Summary,
) {
  return `${JSON.stringify(safeSummarySchema.parse(value))}\n`;
}

function hasExactConfirmation(argv: readonly string[]) {
  return (
    argv.length === 1 &&
    argv[0] === REVIEW_PLANNER_CONTROLLED_LIVE_V9_CONFIRMATION
  );
}

function advance(
  dependencies: ReviewPlannerControlledLiveV9CliDependencies,
  reservation: ReviewPlannerControlledLiveV9EvidenceReservation,
  stage: ReviewPlannerControlledLiveV9Stage,
) {
  try {
    return dependencies.advanceStage(reservation, stage) === true;
  } catch {
    return false;
  }
}

function checkpointAttempts(
  evaluator: ReviewPlannerControlledLiveV9GateDiagnosticsEvaluatorPort,
  expected: number,
) {
  try {
    return evaluator.providerAttemptCount() === expected;
  } catch {
    return false;
  }
}

function readAttempts(
  evaluator: ReviewPlannerControlledLiveV9GateDiagnosticsEvaluatorPort,
  expected: number,
  fallback: number,
) {
  try {
    const value = evaluator.providerAttemptCount();
    return value === expected ? value : fallback;
  } catch {
    return fallback;
  }
}

function safeAbort(
  reservation: ReviewPlannerControlledLiveV9EvidenceReservation,
) {
  try {
    reservation.abort();
  } catch {
    // Early exits remain a fixed safe summary even when cleanup fails.
  }
}

function blocked(): BlockedSummary {
  return {
    status: 'diagnostic_blocked',
    gate: 'closed',
    providerAttemptCount: 0,
    pairedAdmissionCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
  };
}

function attempted(providerAttemptCount: number): AttemptedSummary {
  return {
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount:
      Number.isSafeInteger(providerAttemptCount) &&
      providerAttemptCount >= 0 &&
      providerAttemptCount <= 23
        ? providerAttemptCount
        : 0,
    pairedAdmissionCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
  };
}

function diagnosticSummary(
  diagnostic: V9GateDiagnostic,
  complete: boolean,
): DiagnosticSummary {
  return {
    status: complete ? 'complete' : 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: diagnostic.attempts.providerCount,
    pairedAdmissionCount: diagnostic.attempts.pairedAdmissionCount,
    usageKnown: diagnostic.usage.known,
    terminalReason: diagnostic.terminalReason,
  };
}
