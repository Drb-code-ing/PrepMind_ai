import {
  ReviewPlannerDiagnosticCode,
  phase695ReportSchema,
  type Phase695Report,
} from '@repo/agent';
import { z } from 'zod';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
  safeReviewPlannerControlledLiveV8SummarySchema,
  type ReviewPlannerControlledLiveV8EvidenceReservation,
  type ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot,
  type ReviewPlannerControlledLiveV8Stage,
  type SafeReviewPlannerControlledLiveV8Summary,
} from './review-planner-controlled-live-eval-v8-stage-diagnostics.evidence';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V8_CONFIRMATION =
  '--confirm-controlled-live-v8-deepseek-v4-pro-stage-diagnostics' as const;

const STAGE_EVALUATOR_READY = '.stage-030-evaluator-ready' as const;
const STAGE_PROVIDER_HISTORY_VERIFIED =
  '.stage-040-provider-history-verified' as const;
const STAGE_CANARY_STARTED = '.stage-050-canary-started' as const;
const STAGE_CANARY_RETURNED = '.stage-060-canary-returned' as const;
const STAGE_PAIRED_STARTED = '.stage-070-paired-started' as const;
const STAGE_PAIRED_RETURNED = '.stage-080-paired-returned' as const;
const STAGE_REPORT_VALIDATED = '.stage-090-report-validated' as const;
const TOTAL_PROVIDER_ATTEMPTS = 23;
const PAIRED_RUNTIME_ATTEMPTS = 22;
const ZERO_CALL_CASES = 26;
const CASE_ENTRIES = 48;
const MAX_INPUT_TOKENS = 42_996;
const MAX_OUTPUT_TOKENS = 9_712;
const MAX_P95_DURATION_MS = 4_500;
const HARD_CAP_CNY = 1;

const v8CnyCostSchema = z
  .object({
    currency: z.literal('CNY'),
    nonCachedInputCnyPerMillionTokens: z.literal(3),
    outputCnyPerMillionTokens: z.literal(6),
    hardCapCny: z.literal(HARD_CAP_CNY),
    maxPairedProviderAttempts: z.literal(PAIRED_RUNTIME_ATTEMPTS),
    maxProviderAttempts: z.literal(TOTAL_PROVIDER_ATTEMPTS),
    reservedInputTokens: z.literal(MAX_INPUT_TOKENS),
    reservedOutputTokens: z.literal(MAX_OUTPUT_TOKENS),
    reservedCostCny: z.literal(0.18726),
    observedInputTokens: z.number().int().positive().max(MAX_INPUT_TOKENS),
    observedOutputTokens: z.number().int().positive().max(MAX_OUTPUT_TOKENS),
    observedCostCny: z.number().positive().max(HARD_CAP_CNY),
    withinHardCap: z.literal(true),
    priceProfileId: z.literal(
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
    ),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.observedCostCny !==
      calculateCnyCost(value.observedInputTokens, value.observedOutputTokens)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_COST_INVALID',
      });
    }
  });

const preflightResultSchema = z.union([
  z.object({ ok: z.literal(true) }).strict(),
  z
    .object({
      ok: z.literal(false),
      diagnosticCode: z.literal(ReviewPlannerDiagnosticCode.PreflightInvalid),
    })
    .strict(),
]);

const evaluatorIdentitySchema = z
  .object({
    provider: z.literal('deepseek'),
    model: z.literal('deepseek-v4-pro'),
    baseUrlIdentity: z.literal('deepseek-v1'),
    structuredOutputMode: z.literal('deepseek_v4_pro_nonthinking_json'),
    timeoutMs: z.literal(4_500),
    schemaId: z.literal('review-model-candidate-v1'),
    priceProfileId: z.literal(
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
    ),
  })
  .strict();

export type ReviewPlannerControlledLiveV8DiagnosticCode = Extract<
  SafeReviewPlannerControlledLiveV8Summary,
  { status: 'invalid_attempted' }
>['diagnosticCode'];

export type ReviewPlannerControlledLiveV8EvaluatorIdentity = Readonly<{
  provider: 'deepseek';
  model: 'deepseek-v4-pro';
  baseUrlIdentity: 'deepseek-v1';
  structuredOutputMode: 'deepseek_v4_pro_nonthinking_json';
  timeoutMs: 4_500;
  schemaId: 'review-model-candidate-v1';
  priceProfileId: typeof REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID;
}>;

export type ReviewPlannerControlledLiveV8CanaryResult =
  | Readonly<{
      kind: 'complete';
      providerAttemptCount: 1;
      usageKnown: true;
    }>
  | Readonly<{
      kind: 'failed';
      diagnosticCode: ReviewPlannerControlledLiveV8DiagnosticCode;
    }>;

export type ReviewPlannerControlledLiveV8CnyCost = Readonly<{
  currency: 'CNY';
  nonCachedInputCnyPerMillionTokens: 3;
  outputCnyPerMillionTokens: 6;
  hardCapCny: 1;
  maxPairedProviderAttempts: 22;
  maxProviderAttempts: 23;
  reservedInputTokens: 42_996;
  reservedOutputTokens: 9_712;
  reservedCostCny: 0.18726;
  observedInputTokens: number;
  observedOutputTokens: number;
  observedCostCny: number;
  withinHardCap: true;
  priceProfileId: typeof REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID;
}>;

export type ReviewPlannerControlledLiveV8PairedResult =
  | Readonly<{
      kind: 'report';
      report: unknown;
      cost: ReviewPlannerControlledLiveV8CnyCost;
    }>
  | Readonly<{
      kind: 'failed';
      diagnosticCode: ReviewPlannerControlledLiveV8DiagnosticCode;
    }>;

/** Factory-facing port. Task 4 supplies the only provider composition. */
export type ReviewPlannerControlledLiveV8EvaluatorPort =
  | Readonly<{
      state: 'ready';
      identity: ReviewPlannerControlledLiveV8EvaluatorIdentity;
      runCanary(): Promise<ReviewPlannerControlledLiveV8CanaryResult>;
      runPaired(): Promise<ReviewPlannerControlledLiveV8PairedResult>;
      providerAttemptCount(): number;
    }>
  | Readonly<{
      state: 'closed';
      identity: ReviewPlannerControlledLiveV8EvaluatorIdentity | null;
      diagnosticCode: ReviewPlannerControlledLiveV8DiagnosticCode;
      providerAttemptCount(): number;
    }>;

export type ReviewPlannerControlledLiveV8PreflightResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid;
    }>;

export type ReviewPlannerControlledLiveV8CliDependencies = Readonly<{
  validatePreflight(
    env: Record<string, unknown>,
  ): ReviewPlannerControlledLiveV8PreflightResult;
  snapshotHistoricalEvidence(
    root: string,
  ): Promise<ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot>;
  verifyHistoricalEvidence(
    input: Readonly<{
      root: string;
      snapshot: ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot;
    }>,
  ): Promise<ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot>;
  reserveEvidence(
    input: Readonly<{
      root: string;
      startedAt: string;
      runId: string;
      historicalSnapshot: ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot;
    }>,
  ): Promise<ReviewPlannerControlledLiveV8EvidenceReservation>;
  advanceStage(
    reservation: ReviewPlannerControlledLiveV8EvidenceReservation,
    stage: ReviewPlannerControlledLiveV8Stage,
  ): boolean;
  createEvaluator(
    env: Record<string, unknown>,
  ): ReviewPlannerControlledLiveV8EvaluatorPort;
  finalizeEvidence(
    input: Readonly<{
      reservation: ReviewPlannerControlledLiveV8EvidenceReservation;
      summary: SafeReviewPlannerControlledLiveV8Summary;
    }>,
  ): Promise<boolean>;
  readEvidence(
    input: Readonly<{
      root: string;
      relativePath: string;
    }>,
  ): Promise<Record<string, unknown>>;
}>;

export type ReviewPlannerControlledLiveV8CliInput = Readonly<{
  argv: readonly string[];
  env: Record<string, unknown>;
  root: string;
  now: () => number;
  runId: string;
}>;

/** The only V8 orchestration boundary; every external capability is injected. */
export async function runReviewPlannerControlledLiveV8StageDiagnosticsCli(
  input: ReviewPlannerControlledLiveV8CliInput,
  dependencies: ReviewPlannerControlledLiveV8CliDependencies,
): Promise<SafeReviewPlannerControlledLiveV8Summary> {
  if (!hasExactConfirmation(input.argv)) return blocked();
  let preflight: ReviewPlannerControlledLiveV8PreflightResult;
  try {
    preflight = preflightResultSchema.parse(
      dependencies.validatePreflight(input.env),
    );
  } catch {
    return blocked();
  }
  if (!preflight.ok) return blocked();

  let snapshot: ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot;
  try {
    snapshot = await dependencies.snapshotHistoricalEvidence(input.root);
  } catch {
    return attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo);
  }

  let reservation: ReviewPlannerControlledLiveV8EvidenceReservation;
  try {
    const startedAt = new Date(input.now()).toISOString();
    reservation = await dependencies.reserveEvidence({
      root: input.root,
      startedAt,
      runId: input.runId,
      historicalSnapshot: snapshot,
    });
  } catch {
    return attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo);
  }

  try {
    if (!(await reservation.markAttempted())) {
      return attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo);
    }
  } catch {
    return attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo);
  }

  let evaluator: ReviewPlannerControlledLiveV8EvaluatorPort;
  try {
    const candidate = dependencies.createEvaluator(input.env);
    const snapshot = snapshotEvaluator(candidate);
    if (!snapshot) throw new Error('invalid evaluator');
    evaluator = snapshot;
  } catch {
    return attempted(0, ReviewPlannerDiagnosticCode.ExecutorInit);
  }
  let observedAttempts = 0;
  const checkpointAttempts = (expected: 0 | 1 | 23) => {
    try {
      const value = evaluator.providerAttemptCount();
      if (value !== expected) return false;
      observedAttempts = expected;
      return true;
    } catch {
      return false;
    }
  };
  if (evaluator.state === 'closed') {
    return checkpointAttempts(0)
      ? attempted(observedAttempts, evaluator.diagnosticCode)
      : attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  if (!hasExactIdentity(evaluator.identity)) {
    return attempted(
      observedAttempts,
      ReviewPlannerDiagnosticCode.InvalidResponse,
    );
  }
  const advanceAtCheckpoint = (
    expected: 0 | 1 | 23,
    stage: ReviewPlannerControlledLiveV8Stage,
  ) =>
    checkpointAttempts(expected) && advance(dependencies, reservation, stage);
  if (!advanceAtCheckpoint(0, STAGE_EVALUATOR_READY)) {
    return attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  try {
    await dependencies.verifyHistoricalEvidence({ root: input.root, snapshot });
  } catch {
    return attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  if (!advanceAtCheckpoint(0, STAGE_PROVIDER_HISTORY_VERIFIED)) {
    return attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  if (!advanceAtCheckpoint(0, STAGE_CANARY_STARTED)) {
    return attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo);
  }

  let canaryResult: unknown;
  try {
    const canaryPromise = evaluator.runCanary();
    canaryResult = await canaryPromise;
  } catch {
    checkpointAttempts(1);
    return attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  if (!advanceAtCheckpoint(1, STAGE_CANARY_RETURNED)) {
    return attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  let canary: ReviewPlannerControlledLiveV8CanaryResult | null;
  try {
    canary = snapshotCanaryResult(canaryResult);
  } catch {
    return attempted(
      observedAttempts,
      ReviewPlannerDiagnosticCode.InvalidResponse,
    );
  }
  if (!canary) {
    return attempted(
      observedAttempts,
      ReviewPlannerDiagnosticCode.InvalidResponse,
    );
  }
  if (canary.kind === 'failed') {
    return attempted(observedAttempts, canary.diagnosticCode);
  }
  if (
    canary.providerAttemptCount !== 1 ||
    canary.usageKnown !== true ||
    observedAttempts !== 1
  ) {
    return attempted(
      observedAttempts,
      ReviewPlannerDiagnosticCode.InvalidResponse,
    );
  }
  if (!advanceAtCheckpoint(1, STAGE_PAIRED_STARTED)) {
    return attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo);
  }

  let pairedResult: unknown;
  try {
    const pairedPromise = evaluator.runPaired();
    pairedResult = await pairedPromise;
  } catch {
    checkpointAttempts(23);
    return attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  if (!advanceAtCheckpoint(23, STAGE_PAIRED_RETURNED)) {
    return attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  let complete: SafeReviewPlannerControlledLiveV8Summary | null = null;
  try {
    const paired = snapshotPairedResult(pairedResult);
    if (!paired) {
      return attempted(
        observedAttempts,
        ReviewPlannerDiagnosticCode.InvalidResponse,
      );
    }
    if (paired.kind === 'failed') {
      return attempted(observedAttempts, paired.diagnosticCode);
    }
    complete = buildCompleteSummary(
      paired.report,
      paired.cost,
      observedAttempts,
    );
  } catch {
    return attempted(
      observedAttempts,
      ReviewPlannerDiagnosticCode.InvalidResponse,
    );
  }
  if (!complete) {
    return attempted(
      observedAttempts,
      ReviewPlannerDiagnosticCode.InvalidResponse,
    );
  }
  if (!advanceAtCheckpoint(23, STAGE_REPORT_VALIDATED)) {
    return attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  try {
    if (
      !(await dependencies.finalizeEvidence({ reservation, summary: complete }))
    ) {
      return attempted(
        observedAttempts,
        ReviewPlannerDiagnosticCode.EvidenceIo,
      );
    }
  } catch {
    return attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo);
  }

  let committed: Record<string, unknown>;
  try {
    committed = await dependencies.readEvidence({
      root: input.root,
      relativePath: reservation.relativePath,
    });
  } catch {
    return attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  const committedSummary = projectCommittedSummary(committed);
  if (!committedSummary || !sameSummary(committedSummary, complete)) {
    return attempted(observedAttempts, ReviewPlannerDiagnosticCode.EvidenceIo);
  }
  return committedSummary;
}

/** Serializes only the strict safe projection and always terminates one line. */
export function serializeReviewPlannerControlledLiveV8StageDiagnosticsSummary(
  value: SafeReviewPlannerControlledLiveV8Summary,
) {
  return `${JSON.stringify(
    safeReviewPlannerControlledLiveV8SummarySchema.parse(value),
  )}\n`;
}

function buildCompleteSummary(
  report: Phase695Report,
  cost: ReviewPlannerControlledLiveV8CnyCost,
  providerAttemptCount: number,
): SafeReviewPlannerControlledLiveV8Summary | null {
  const zeroCallEntries = report.caseEntries.filter(
    (entry) => entry.executionKind === 'zero_call',
  );
  const runtimeEntries = report.caseEntries.filter(
    (entry) => entry.executionKind === 'runtime',
  );
  if (
    providerAttemptCount !== TOTAL_PROVIDER_ATTEMPTS ||
    report.mode !== 'live' ||
    report.productionDecision !== 'quality_gate_passed' ||
    report.counters.caseEntries !== CASE_ENTRIES ||
    report.counters.zeroCallCases !== ZERO_CALL_CASES ||
    report.counters.runtimeInvocations !== PAIRED_RUNTIME_ATTEMPTS ||
    report.counters.strictSuccesses !== CASE_ENTRIES ||
    report.counters.qualityPasses !== CASE_ENTRIES ||
    report.counters.criticalFailures !== 0 ||
    report.metrics.strictSchemaSuccessRate !== 1 ||
    report.metrics.semanticQualityRate < 0.9 ||
    report.metrics.p95DurationMs > MAX_P95_DURATION_MS ||
    zeroCallEntries.length !== ZERO_CALL_CASES ||
    zeroCallEntries.some(
      (entry) => !entry.zeroCallVerified || entry.runtimeInvocations !== 0,
    ) ||
    runtimeEntries.length !== PAIRED_RUNTIME_ATTEMPTS ||
    runtimeEntries.some(
      (entry) =>
        entry.runtimeInvocations !== 1 ||
        !entry.strictSuccess ||
        !entry.qualityPass,
    )
  ) {
    return null;
  }
  const parsed = safeReviewPlannerControlledLiveV8SummarySchema.safeParse({
    status: 'complete',
    gate: 'closed',
    providerAttemptCount: TOTAL_PROVIDER_ATTEMPTS,
    usageKnown: true,
    aggregateInputTokens: cost.observedInputTokens,
    aggregateOutputTokens: cost.observedOutputTokens,
    observedCostCny: cost.observedCostCny,
    priceProfileId:
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
    caseEntries: CASE_ENTRIES,
    zeroCallCases: ZERO_CALL_CASES,
    runtimeInvocations: PAIRED_RUNTIME_ATTEMPTS,
    strictSuccesses: report.counters.strictSuccesses,
    qualityPasses: report.counters.qualityPasses,
    criticalFailures: report.counters.criticalFailures,
  });
  return parsed.success ? parsed.data : null;
}

function calculateCnyCost(inputTokens: number, outputTokens: number) {
  return Number(((inputTokens * 3 + outputTokens * 6) / 1_000_000).toFixed(8));
}

function projectCommittedSummary(
  value: Record<string, unknown>,
): SafeReviewPlannerControlledLiveV8Summary | null {
  try {
    if (value.state !== 'finalized') return null;
    const candidate =
      value.status === 'complete'
        ? {
            status: value.status,
            gate: value.gate,
            providerAttemptCount: value.providerAttemptCount,
            usageKnown: value.usageKnown,
            aggregateInputTokens: value.aggregateInputTokens,
            aggregateOutputTokens: value.aggregateOutputTokens,
            observedCostCny: value.observedCostCny,
            priceProfileId: value.priceProfileId,
            caseEntries: value.caseEntries,
            zeroCallCases: value.zeroCallCases,
            runtimeInvocations: value.runtimeInvocations,
            strictSuccesses: value.strictSuccesses,
            qualityPasses: value.qualityPasses,
            criticalFailures: value.criticalFailures,
          }
        : {
            status: value.status,
            gate: value.gate,
            providerAttemptCount: value.providerAttemptCount,
            usageKnown: value.usageKnown,
            diagnosticCode: value.diagnosticCode,
          };
    const parsed =
      safeReviewPlannerControlledLiveV8SummarySchema.safeParse(candidate);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function sameSummary(
  left: SafeReviewPlannerControlledLiveV8Summary,
  right: SafeReviewPlannerControlledLiveV8Summary,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function advance(
  dependencies: ReviewPlannerControlledLiveV8CliDependencies,
  reservation: ReviewPlannerControlledLiveV8EvidenceReservation,
  stage: ReviewPlannerControlledLiveV8Stage,
) {
  try {
    return dependencies.advanceStage(reservation, stage) === true;
  } catch {
    return false;
  }
}

function hasExactConfirmation(argv: readonly string[]) {
  return (
    argv.length === 1 &&
    argv[0] === REVIEW_PLANNER_CONTROLLED_LIVE_V8_CONFIRMATION
  );
}

function hasExactIdentity(
  identity: ReviewPlannerControlledLiveV8EvaluatorIdentity,
) {
  return (
    identity.provider === 'deepseek' &&
    identity.model === 'deepseek-v4-pro' &&
    identity.baseUrlIdentity === 'deepseek-v1' &&
    identity.structuredOutputMode === 'deepseek_v4_pro_nonthinking_json' &&
    identity.timeoutMs === 4_500 &&
    identity.schemaId === 'review-model-candidate-v1' &&
    identity.priceProfileId ===
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID
  );
}

function snapshotEvaluator(
  value: unknown,
): ReviewPlannerControlledLiveV8EvaluatorPort | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const state = source.state;
  const identityValue = source.identity;
  const identity =
    identityValue === null
      ? null
      : evaluatorIdentitySchema.parse(identityValue);
  const providerAttemptCount = source.providerAttemptCount;
  if (typeof providerAttemptCount !== 'function') return null;
  const boundAttemptCount = providerAttemptCount.bind(value) as () => number;
  if (state === 'closed') {
    const diagnosticCode = source.diagnosticCode;
    if (!isDiagnosticCode(diagnosticCode)) return null;
    return Object.freeze({
      state,
      identity,
      diagnosticCode,
      providerAttemptCount: boundAttemptCount,
    });
  }
  if (state !== 'ready' || !identity) return null;
  const runCanary = source.runCanary;
  const runPaired = source.runPaired;
  if (typeof runCanary !== 'function' || typeof runPaired !== 'function') {
    return null;
  }
  return Object.freeze({
    state,
    identity,
    runCanary: runCanary.bind(
      value,
    ) as () => Promise<ReviewPlannerControlledLiveV8CanaryResult>,
    runPaired: runPaired.bind(
      value,
    ) as () => Promise<ReviewPlannerControlledLiveV8PairedResult>,
    providerAttemptCount: boundAttemptCount,
  });
}

function snapshotCanaryResult(
  value: unknown,
): ReviewPlannerControlledLiveV8CanaryResult | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const kind = source.kind;
  if (kind === 'complete') {
    return source.providerAttemptCount === 1 && source.usageKnown === true
      ? Object.freeze({ kind, providerAttemptCount: 1, usageKnown: true })
      : null;
  }
  if (kind !== 'failed') return null;
  const diagnosticCode = source.diagnosticCode;
  return isDiagnosticCode(diagnosticCode)
    ? Object.freeze({ kind, diagnosticCode })
    : null;
}

type ReviewPlannerControlledLiveV8PairedSnapshot =
  | Readonly<{
      kind: 'report';
      report: Phase695Report;
      cost: ReviewPlannerControlledLiveV8CnyCost;
    }>
  | Extract<ReviewPlannerControlledLiveV8PairedResult, { kind: 'failed' }>;

function snapshotPairedResult(
  value: unknown,
): ReviewPlannerControlledLiveV8PairedSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const kind = source.kind;
  if (kind === 'failed') {
    const diagnosticCode = source.diagnosticCode;
    return isDiagnosticCode(diagnosticCode)
      ? Object.freeze({ kind, diagnosticCode })
      : null;
  }
  if (kind !== 'report') return null;
  const report = phase695ReportSchema.parse(source.report);
  const cost = v8CnyCostSchema.parse(source.cost);
  return Object.freeze({ kind, report, cost });
}

function isDiagnosticCode(
  value: unknown,
): value is ReviewPlannerControlledLiveV8DiagnosticCode {
  return safeReviewPlannerControlledLiveV8SummarySchema.safeParse({
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode: value,
  }).success;
}

function isAttemptCount(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= 0 &&
    Number(value) <= TOTAL_PROVIDER_ATTEMPTS
  );
}

function blocked(): SafeReviewPlannerControlledLiveV8Summary {
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
  diagnosticCode: ReviewPlannerControlledLiveV8DiagnosticCode,
): SafeReviewPlannerControlledLiveV8Summary {
  const parsed = safeReviewPlannerControlledLiveV8SummarySchema.safeParse({
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: isAttemptCount(providerAttemptCount)
      ? providerAttemptCount
      : 0,
    usageKnown: false,
    diagnosticCode,
  });
  return parsed.success
    ? parsed.data
    : {
        status: 'invalid_attempted',
        gate: 'closed',
        providerAttemptCount: 0,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
      };
}
