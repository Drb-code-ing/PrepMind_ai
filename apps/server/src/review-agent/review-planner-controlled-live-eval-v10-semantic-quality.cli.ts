import { ReviewPlannerDiagnosticCode } from '@repo/agent';
import { z } from 'zod';

import {
  v10SemanticQualityDiagnosticSchema,
  type V10SemanticQualityDiagnostic,
} from './review-planner-controlled-live-eval-v10-semantic-quality.contract';
import type {
  ReviewPlannerControlledLiveV10SemanticQualityEvidenceReservation,
  ReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidenceSnapshot,
  ReviewPlannerControlledLiveV10SemanticQualityStage,
} from './review-planner-controlled-live-eval-v10-semantic-quality.evidence';
import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE_ID,
  type ReviewPlannerControlledLiveV10SemanticQualityEvaluatorPort,
} from './review-planner-controlled-live-eval-v10-semantic-quality.factory';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_CONFIRMATION =
  '--confirm-controlled-live-v10-deepseek-v4-pro-semantic-quality' as const;

const STAGES = Object.freeze({
  evaluator: '.stage-030-evaluator-ready',
  history: '.stage-040-provider-history-verified',
  canaryStarted: '.stage-050-canary-started',
  canaryReturned: '.stage-060-canary-returned',
  pairedStarted: '.stage-070-paired-started',
  pairedReturned: '.stage-080-paired-returned',
} as const);

const blockedSchema = z
  .object({
    status: z.literal('diagnostic_blocked'),
    gate: z.literal('closed'),
    providerAttemptCount: z.literal(0),
    pairedAdmissionCount: z.literal(0),
    usageKnown: z.literal(false),
    diagnosticCode: z.literal(ReviewPlannerDiagnosticCode.PreflightInvalid),
  })
  .strict();
const attemptedSchema = z
  .object({
    status: z.literal('invalid_attempted'),
    gate: z.literal('closed'),
    providerAttemptCount: z.number().int().safe().min(0).max(23),
    pairedAdmissionCount: z.literal(0),
    usageKnown: z.literal(false),
    diagnosticCode: z.literal(ReviewPlannerDiagnosticCode.EvidenceIo),
  })
  .strict();
const diagnosticSummarySchema = z
  .object({
    status: z.enum(['invalid_attempted', 'complete']),
    gate: z.literal('closed'),
    providerAttemptCount: z.number().int().safe().min(0).max(23),
    pairedAdmissionCount: z.number().int().safe().min(0).max(22),
    usageKnown: z.boolean(),
    terminalReason: z.enum([
      'passed',
      'schema_invalid',
      'quality_gate_failed',
      'p95_exceeded',
      'usage_unverifiable',
      'attempt_count_mismatch',
      'admission_count_mismatch',
      'cost_cap_exceeded',
    ]),
  })
  .strict();
const summarySchema = z.union([
  blockedSchema,
  attemptedSchema,
  diagnosticSummarySchema,
]);
export type SafeReviewPlannerControlledLiveV10SemanticQualitySummary = z.infer<
  typeof summarySchema
>;

export type ReviewPlannerControlledLiveV10SemanticQualityCliInput = Readonly<{
  argv: readonly string[];
  env: Record<string, unknown>;
  root: string;
  now: () => number;
  runId: string;
}>;
export type ReviewPlannerControlledLiveV10SemanticQualityCliDependencies =
  Readonly<{
    validatePreflight(env: Record<string, unknown>):
      | Readonly<{ ok: true }>
      | Readonly<{
          ok: false;
          diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid;
        }>;
    snapshotHistoricalEvidence(
      root: string,
    ): Promise<ReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidenceSnapshot>;
    verifyHistoricalEvidence(
      input: Readonly<{
        root: string;
        snapshot: ReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidenceSnapshot;
      }>,
    ): Promise<unknown>;
    reserveEvidence(
      input: Readonly<{
        root: string;
        startedAt: string;
        runId: string;
        historicalSnapshot: ReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidenceSnapshot;
      }>,
    ): Promise<ReviewPlannerControlledLiveV10SemanticQualityEvidenceReservation>;
    advanceStage(
      reservation: ReviewPlannerControlledLiveV10SemanticQualityEvidenceReservation,
      stage: ReviewPlannerControlledLiveV10SemanticQualityStage,
    ): Promise<boolean>;
    createEvaluator(
      env: Record<string, unknown>,
    ): ReviewPlannerControlledLiveV10SemanticQualityEvaluatorPort;
    commitDiagnostic(
      input: Readonly<{
        root: string;
        reservation: ReviewPlannerControlledLiveV10SemanticQualityEvidenceReservation;
        diagnostic: V10SemanticQualityDiagnostic;
      }>,
    ): Promise<unknown>;
    completeValidation(
      input: Readonly<{
        root: string;
        reservation: ReviewPlannerControlledLiveV10SemanticQualityEvidenceReservation;
      }>,
    ): Promise<boolean>;
    finalizeSuccess(
      input: Readonly<{
        root: string;
        reservation: ReviewPlannerControlledLiveV10SemanticQualityEvidenceReservation;
        diagnostic: V10SemanticQualityDiagnostic;
      }>,
    ): Promise<boolean>;
  }>;

export async function runReviewPlannerControlledLiveV10SemanticQualityCli(
  input: ReviewPlannerControlledLiveV10SemanticQualityCliInput,
  dependencies: ReviewPlannerControlledLiveV10SemanticQualityCliDependencies,
): Promise<SafeReviewPlannerControlledLiveV10SemanticQualitySummary> {
  if (
    input.argv.length !== 1 ||
    input.argv[0] !==
      REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_CONFIRMATION
  )
    return blocked();
  try {
    if (dependencies.validatePreflight(input.env).ok !== true) return blocked();
  } catch {
    return blocked();
  }
  let reservation: ReviewPlannerControlledLiveV10SemanticQualityEvidenceReservation | null =
    null;
  let terminal = false;
  let attempts = 0;
  try {
    const snapshot = await dependencies.snapshotHistoricalEvidence(input.root);
    reservation = await dependencies.reserveEvidence({
      root: input.root,
      startedAt: new Date(input.now()).toISOString(),
      runId: input.runId,
      historicalSnapshot: snapshot,
    });
    if (!(await reservation.markAttempted())) return attempted(attempts);
    const evaluator = dependencies.createEvaluator(input.env);
    if (
      evaluator.state !== 'ready' ||
      evaluator.profileId !==
        REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE_ID ||
      attemptsOf(evaluator) !== 0 ||
      !(await advance(dependencies, reservation, STAGES.evaluator))
    )
      return attempted(attempts);
    await dependencies.verifyHistoricalEvidence({ root: input.root, snapshot });
    if (
      !(await advance(dependencies, reservation, STAGES.history)) ||
      !(await advance(dependencies, reservation, STAGES.canaryStarted))
    )
      return attempted(attempts);
    const canary = await evaluator.runCanary();
    attempts = attemptsOf(evaluator);
    if (
      !(await advance(dependencies, reservation, STAGES.canaryReturned)) ||
      canary.kind !== 'complete' ||
      canary.providerAttemptCount !== 1 ||
      canary.usageKnown !== true ||
      attempts !== 1 ||
      !(await advance(dependencies, reservation, STAGES.pairedStarted))
    )
      return attempted(attempts);
    const paired = await evaluator.runPaired();
    attempts = attemptsOf(evaluator);
    if (
      !(await advance(dependencies, reservation, STAGES.pairedReturned)) ||
      attempts !== 23
    )
      return attempted(attempts);
    const diagnostic = v10SemanticQualityDiagnosticSchema.safeParse(
      paired.diagnostic,
    );
    if (
      !diagnostic.success ||
      (diagnostic.data.terminalReason === 'passed' &&
        paired.result.kind !== 'report')
    )
      return attempted(attempts);
    if (
      !(await dependencies.commitDiagnostic({
        root: input.root,
        reservation,
        diagnostic: diagnostic.data,
      }))
    )
      return attempted(attempts);
    if (
      !(await dependencies.completeValidation({
        root: input.root,
        reservation,
      }))
    )
      return attempted(attempts);
    if (diagnostic.data.terminalReason !== 'passed') {
      terminal = true;
      return summary(diagnostic.data, false);
    }
    if (
      !(await dependencies.finalizeSuccess({
        root: input.root,
        reservation,
        diagnostic: diagnostic.data,
      }))
    )
      return attempted(attempts);
    terminal = true;
    return summary(diagnostic.data, true);
  } catch {
    return attempted(attempts);
  } finally {
    if (reservation && !terminal) {
      try {
        await reservation.abort();
      } catch {
        // A failed abort cannot reopen an already consumed one-shot capability.
      }
    }
  }
}

export function serializeReviewPlannerControlledLiveV10SemanticQualitySummary(
  value: SafeReviewPlannerControlledLiveV10SemanticQualitySummary,
) {
  return `${JSON.stringify(summarySchema.parse(value))}\n`;
}
function attemptsOf(
  value: ReviewPlannerControlledLiveV10SemanticQualityEvaluatorPort,
) {
  try {
    const count = value.providerAttemptCount();
    return Number.isSafeInteger(count) && count >= 0 && count <= 23 ? count : 0;
  } catch {
    return 0;
  }
}
async function advance(
  d: ReviewPlannerControlledLiveV10SemanticQualityCliDependencies,
  r: ReviewPlannerControlledLiveV10SemanticQualityEvidenceReservation,
  s: ReviewPlannerControlledLiveV10SemanticQualityStage,
) {
  try {
    return (await d.advanceStage(r, s)) === true;
  } catch {
    return false;
  }
}
function blocked(): SafeReviewPlannerControlledLiveV10SemanticQualitySummary {
  return {
    status: 'diagnostic_blocked',
    gate: 'closed',
    providerAttemptCount: 0,
    pairedAdmissionCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
  };
}
function attempted(
  count: number,
): SafeReviewPlannerControlledLiveV10SemanticQualitySummary {
  return {
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount:
      Number.isSafeInteger(count) && count >= 0 && count <= 23 ? count : 0,
    pairedAdmissionCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
  };
}
function summary(
  diagnostic: V10SemanticQualityDiagnostic,
  complete: boolean,
): SafeReviewPlannerControlledLiveV10SemanticQualitySummary {
  return {
    status: complete ? 'complete' : 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: diagnostic.attempts.providerCount,
    pairedAdmissionCount: diagnostic.attempts.pairedAdmissionCount,
    usageKnown: diagnostic.usage.known,
    terminalReason: diagnostic.terminalReason,
  };
}
