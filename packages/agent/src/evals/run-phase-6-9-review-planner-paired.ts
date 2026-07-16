import {
  PHASE_695_REPORT_SCHEMA_VERSION,
  PHASE_695_SHARED_BUDGET,
  ReviewPlannerDiagnosticCode,
  phase695ReportSchema,
  reviewPlannerDiagnosticCodeSchema,
  type Phase695CaseEntry,
  type Phase695Report,
} from './phase-6-9-review-planner-contract.ts';
import {
  PHASE_695_REVIEW_PLANNER_DATASET_VERSION,
  phase695ReviewPlannerCases,
  type Phase695ReviewPlannerCase,
} from './phase-6-9-review-planner-cases.ts';

export type Phase695LiveEvaluation = Readonly<{
  strictSuccess: boolean;
  qualityPass: boolean;
  durationMs: number;
  usage: Readonly<{ inputTokens: number; outputTokens: number }>;
  diagnosticCode?: ReviewPlannerDiagnosticCode;
}>;

export type Phase695LiveDependencies = Readonly<{
  runtime: object;
  provider: string;
  model: string;
  evaluate(input: Readonly<{
    caseId: string;
    lane: 'review' | 'planner';
    runtime: object;
    provider: string;
    model: string;
    budget: typeof PHASE_695_SHARED_BUDGET;
  }>): Promise<Phase695LiveEvaluation>;
}>;

export type RunPhase695ReviewPlannerPairedInput =
  | Readonly<{ mode: 'mock' }>
  | Readonly<{ mode: 'live'; live: Phase695LiveDependencies }>;

export async function runPhase695ReviewPlannerPaired(
  input: RunPhase695ReviewPlannerPairedInput,
): Promise<Phase695Report> {
  const entries = input.mode === 'mock'
    ? phase695ReviewPlannerCases.map(mockEntry)
    : await Promise.all(phase695ReviewPlannerCases.map((testCase) => liveEntry(testCase, input.live)));
  const report = buildReport(input.mode, entries);
  return phase695ReportSchema.parse(report);
}

function mockEntry(testCase: Phase695ReviewPlannerCase): Phase695CaseEntry {
  if (testCase.executionKind === 'zero_call') return zeroCallEntry(testCase);
  return {
    caseId: testCase.id,
    lane: testCase.lane,
    executionKind: 'runtime',
    runtimeInvocations: 1,
    strictSuccess: true,
    qualityPass: true,
    criticalFailure: false,
    durationMs: 0,
    usage: { inputTokens: 0, outputTokens: 0 },
    budget: { ...PHASE_695_SHARED_BUDGET },
    gate: 'candidate_evaluated',
  };
}

async function liveEntry(
  testCase: Phase695ReviewPlannerCase,
  live: Phase695LiveDependencies,
): Promise<Phase695CaseEntry> {
  if (testCase.executionKind === 'zero_call') return zeroCallEntry(testCase);
  const evaluation = await evaluateLiveCase(testCase, live);
  const criticalFailure = testCase.criticalSemanticCase && !evaluation.qualityPass;
  return {
    caseId: testCase.id,
    lane: testCase.lane,
    executionKind: 'runtime',
    runtimeInvocations: 1,
    strictSuccess: evaluation.strictSuccess,
    qualityPass: evaluation.qualityPass,
    criticalFailure,
    durationMs: evaluation.durationMs,
    usage: evaluation.usage,
    budget: { ...PHASE_695_SHARED_BUDGET },
    gate: evaluation.strictSuccess && evaluation.qualityPass
      ? 'candidate_evaluated'
      : 'candidate_rejected',
    ...(evaluation.diagnosticCode ? { diagnosticCode: evaluation.diagnosticCode } : {}),
  };
}

function zeroCallEntry(testCase: Phase695ReviewPlannerCase): Phase695CaseEntry {
  return {
    caseId: testCase.id,
    lane: testCase.lane,
    executionKind: 'zero_call',
    runtimeInvocations: 0,
    strictSuccess: true,
    qualityPass: true,
    criticalFailure: false,
    durationMs: 0,
    usage: { inputTokens: 0, outputTokens: 0 },
    budget: { ...PHASE_695_SHARED_BUDGET },
    gate: 'zero_call',
  };
}

async function evaluateLiveCase(
  testCase: Phase695ReviewPlannerCase,
  live: Phase695LiveDependencies,
): Promise<Phase695LiveEvaluation> {
  if (!isSafeLiveDependencies(live)) return invalidEvaluation(ReviewPlannerDiagnosticCode.PreflightInvalid);
  try {
    const outcome = await live.evaluate({
      caseId: testCase.id,
      lane: testCase.lane,
      runtime: live.runtime,
      provider: live.provider,
      model: live.model,
      budget: PHASE_695_SHARED_BUDGET,
    });
    return isSafeEvaluation(outcome)
      ? outcome
      : invalidEvaluation(ReviewPlannerDiagnosticCode.InvalidResponse);
  } catch {
    return invalidEvaluation(ReviewPlannerDiagnosticCode.Transport);
  }
}

function invalidEvaluation(diagnosticCode: ReviewPlannerDiagnosticCode): Phase695LiveEvaluation {
  return {
    strictSuccess: false,
    qualityPass: false,
    durationMs: 0,
    usage: { inputTokens: 0, outputTokens: 0 },
    diagnosticCode,
  };
}

function isSafeLiveDependencies(value: unknown): value is Phase695LiveDependencies {
  try {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return typeof candidate.runtime === 'object' && candidate.runtime !== null &&
      isSafeIdentity(candidate.provider) && isSafeIdentity(candidate.model) &&
      typeof candidate.evaluate === 'function';
  } catch {
    return false;
  }
}

function isSafeIdentity(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value);
}

function isSafeEvaluation(value: unknown): value is Phase695LiveEvaluation {
  try {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    const diagnostic = candidate.diagnosticCode;
    return typeof candidate.strictSuccess === 'boolean' &&
      typeof candidate.qualityPass === 'boolean' &&
      isSafeInteger(candidate.durationMs) &&
      isSafeUsage(candidate.usage) &&
      (diagnostic === undefined || reviewPlannerDiagnosticCodeSchema.safeParse(diagnostic).success) &&
      (!candidate.strictSuccess ? diagnostic !== undefined : diagnostic === undefined);
  } catch {
    return false;
  }
}

function isSafeUsage(value: unknown): value is Phase695LiveEvaluation['usage'] {
  if (typeof value !== 'object' || value === null) return false;
  const usage = value as Record<string, unknown>;
  return isSafeInteger(usage.inputTokens) && isSafeInteger(usage.outputTokens);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function buildReport(mode: 'mock' | 'live', caseEntries: readonly Phase695CaseEntry[]): unknown {
  const runtimeEntries = caseEntries.filter((entry) => entry.executionKind === 'runtime');
  const counters = {
    caseEntries: caseEntries.length,
    zeroCallCases: caseEntries.filter((entry) => entry.executionKind === 'zero_call').length,
    runtimeInvocations: caseEntries.reduce((total, entry) => total + entry.runtimeInvocations, 0),
    strictSuccesses: caseEntries.filter((entry) => entry.strictSuccess).length,
    qualityPasses: caseEntries.filter((entry) => entry.qualityPass).length,
    criticalFailures: caseEntries.filter((entry) => entry.criticalFailure).length,
    inputTokens: caseEntries.reduce((total, entry) => total + entry.usage.inputTokens, 0),
    outputTokens: caseEntries.reduce((total, entry) => total + entry.usage.outputTokens, 0),
  } as const;
  const metrics = {
    strictSchemaSuccessRate: ratio(runtimeEntries.filter((entry) => entry.strictSuccess).length, runtimeEntries.length),
    semanticQualityRate: ratio(runtimeEntries.filter((entry) => entry.qualityPass).length, runtimeEntries.length),
    criticalFailures: counters.criticalFailures,
    p95DurationMs: nearestRank(runtimeEntries.map((entry) => entry.durationMs)),
  } as const;
  const productionDecision = mode === 'mock'
    ? 'mock_quality_not_evidence' as const
    : decideLiveDecision(counters.zeroCallCases, runtimeEntries, metrics);

  return {
    schemaVersion: PHASE_695_REPORT_SCHEMA_VERSION,
    datasetVersion: PHASE_695_REVIEW_PLANNER_DATASET_VERSION,
    mode,
    caseEntries: [...caseEntries],
    counters,
    metrics,
    productionDecision,
  };
}

function decideLiveDecision(
  zeroCallCases: number,
  runtimeEntries: readonly Phase695CaseEntry[],
  metrics: Phase695Report['metrics'],
): Phase695Report['productionDecision'] {
  if (zeroCallCases !== 26) return 'zero_call_boundary_failed';
  if (runtimeEntries.some((entry) =>
    entry.runtimeInvocations > entry.budget.maxCalls ||
    entry.usage.inputTokens > entry.budget.maxInputTokens ||
    entry.usage.outputTokens > entry.budget.maxOutputTokens,
  )) return 'budget_exceeded';
  if (metrics.strictSchemaSuccessRate !== 1) return 'strict_schema_incomplete';
  if (metrics.semanticQualityRate < 0.9) return 'semantic_quality_below_threshold';
  if (metrics.criticalFailures !== 0) return 'critical_failure';
  if (metrics.p95DurationMs > 4_500) return 'latency_budget_exceeded';
  return 'quality_gate_passed';
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function nearestRank(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(0.95 * sorted.length) - 1] ?? 0;
}
