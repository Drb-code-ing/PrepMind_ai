import {
  createModelAgentBudget,
  createModelAgentRuntime,
  isModelAgentRunBudget,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
  type ModelAgentUsage,
} from '@repo/ai';
import type {
  PlannerAgentResult,
  ReviewAgentResult,
} from '@repo/types/api/review-agent';

import {
  runPlannerModelCandidate,
  runReviewModelCandidate,
} from '../model-candidates/review-planner-model-candidate.ts';
import {
  PHASE_695_REPORT_SCHEMA_VERSION,
  PHASE_695_SHARED_BUDGET,
  ReviewPlannerDiagnosticCode,
  phase695ReportSchema,
  type Phase695CaseEntry,
  type Phase695Report,
} from './phase-6-9-review-planner-contract.ts';
import {
  PHASE_695_REVIEW_PLANNER_DATASET_VERSION,
  getPhase695CaseFixture,
  phase695ReviewPlannerCases,
  type Phase695CaseFixture,
  type Phase695ReviewPlannerCase,
} from './phase-6-9-review-planner-cases.ts';

export const PHASE_695_CASE_TIMEOUT_MS = 4_500;

export type Phase695LiveDependencies = Readonly<{
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  now?: () => number;
  setTimeout?: (callback: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
}>;

export type RunPhase695ReviewPlannerPairedInput =
  | Readonly<{ mode: 'mock'; now?: () => number }>
  | Readonly<{ mode: 'live'; live: Phase695LiveDependencies }>;

type CandidateObservation = Readonly<{
  attempted?: unknown;
  disposition?: unknown;
  budget?: unknown;
  usage?: unknown;
  trace?: unknown;
  traceUnavailable?: unknown;
  usageUnavailable?: unknown;
  reasonCodes?: unknown;
}>;

export async function runPhase695ReviewPlannerPaired(
  input: RunPhase695ReviewPlannerPairedInput,
): Promise<Phase695Report> {
  const entries: Phase695CaseEntry[] = [];
  for (const testCase of phase695ReviewPlannerCases) {
    entries.push(await runCase(testCase, input));
  }
  return phase695ReportSchema.parse(buildReport(input.mode, entries));
}

async function runCase(
  testCase: Phase695ReviewPlannerCase,
  input: RunPhase695ReviewPlannerPairedInput,
): Promise<Phase695CaseEntry> {
  if (testCase.executionKind === 'zero_call') return zeroCallEntry(testCase);
  const fixture = getPhase695CaseFixture(testCase.id);
  if (!fixture) return rejectedEntry(testCase, 0, zeroUsage(), ReviewPlannerDiagnosticCode.PreflightInvalid);

  const dependencies = input.mode === 'mock'
    ? mockDependencies(fixture, input.now)
    : completeLiveDependencies(input.live);
  if (!isSafeDependencies(dependencies)) {
    return rejectedEntry(testCase, 0, zeroUsage(), ReviewPlannerDiagnosticCode.PreflightInvalid);
  }

  const startedAt = readMonotonicNow(dependencies.now);
  if (startedAt === null) {
    return rejectedEntry(testCase, 0, zeroUsage(), ReviewPlannerDiagnosticCode.PreflightInvalid);
  }
  const controller = new AbortController();
  const timeout = dependencies.setTimeout(
    () => controller.abort(),
    PHASE_695_CASE_TIMEOUT_MS,
  );
  try {
    const budget = createModelAgentBudget(PHASE_695_SHARED_BUDGET);
    const envelope = fixture.lane === 'review'
      ? await runReviewModelCandidate({
          runId: `phase-695:${testCase.id}`,
          deterministic: cloneReviewFixture(fixture.deterministic),
          runtime: dependencies.runtime,
          budget,
          signal: controller.signal,
        })
      : await runPlannerModelCandidate({
          runId: `phase-695:${testCase.id}`,
          deterministic: clonePlannerFixture(fixture.deterministic),
          runtime: dependencies.runtime,
          budget,
          signal: controller.signal,
        });
    const finishedAt = readMonotonicNow(dependencies.now);
    if (finishedAt === null || finishedAt < startedAt) {
      return rejectedEntry(testCase, 0, zeroUsage(), ReviewPlannerDiagnosticCode.PreflightInvalid);
    }
    return deriveCandidateEntry({
      testCase,
      fixture,
      value: envelope.value,
      observation: envelope.observation,
      expectedMode: input.mode,
      durationMs: finishedAt - startedAt,
    });
  } catch {
    return rejectedEntry(testCase, 0, zeroUsage(), ReviewPlannerDiagnosticCode.Transport);
  } finally {
    dependencies.clearTimeout(timeout);
  }
}

function mockDependencies(
  fixture: Phase695CaseFixture,
  now: (() => number) | undefined,
): Required<Phase695LiveDependencies> {
  return {
    runtime: createModelAgentRuntime({
      mode: 'mock',
      provider: 'mock',
      model: 'phase-6-9-review-planner-mock-v1',
      liveCallsEnabled: false,
      timeoutMs: PHASE_695_CASE_TIMEOUT_MS,
      mockResponder: () => fixture.lane === 'review'
        ? { focusIndexes: fixture.expected.focusIndexes, diagnosis: fixture.expected.diagnosis }
        : { blockOrder: fixture.expected.blockOrder, strategy: fixture.expected.strategy },
    }),
    now: now ?? defaultNow,
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
}

function completeLiveDependencies(
  input: Phase695LiveDependencies,
): Required<Phase695LiveDependencies> | null {
  try {
    return {
      runtime: input.runtime,
      now: input.now ?? defaultNow,
      setTimeout: input.setTimeout ?? ((callback, ms) => setTimeout(callback, ms)),
      clearTimeout: input.clearTimeout ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)),
    };
  } catch {
    return null;
  }
}

function isSafeDependencies(value: unknown): value is Required<Phase695LiveDependencies> {
  try {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return typeof candidate.runtime === 'object' && candidate.runtime !== null &&
      typeof (candidate.runtime as { invokeStructured?: unknown }).invokeStructured === 'function' &&
      typeof candidate.now === 'function' &&
      typeof candidate.setTimeout === 'function' &&
      typeof candidate.clearTimeout === 'function';
  } catch {
    return false;
  }
}

function deriveCandidateEntry(input: {
  testCase: Phase695ReviewPlannerCase;
  fixture: Phase695CaseFixture;
  value: unknown;
  observation: unknown;
  expectedMode: 'mock' | 'live';
  durationMs: number;
}): Phase695CaseEntry {
  const provenance = deriveRuntimeProvenance(input.observation, input.expectedMode);
  const strictSuccess = provenance.ok && provenance.disposition === 'candidate_applied';
  const qualityPass = strictSuccess && passesLocalRubric(input.fixture, input.value, provenance.reasonCodes);
  const diagnosticCode = strictSuccess
    ? undefined
    : provenance.diagnosticCode;

  return {
    caseId: input.testCase.id,
    lane: input.testCase.lane,
    executionKind: 'runtime',
    runtimeInvocations: provenance.runtimeInvocations,
    strictSuccess,
    qualityPass,
    criticalFailure: input.testCase.criticalSemanticCase && !qualityPass,
    durationMs: isSafeInteger(input.durationMs) ? input.durationMs : 0,
    usage: provenance.usage,
    budget: { ...PHASE_695_SHARED_BUDGET },
    gate: strictSuccess && qualityPass ? 'candidate_evaluated' : 'candidate_rejected',
    ...(diagnosticCode ? { diagnosticCode } : {}),
  };
}

function deriveRuntimeProvenance(
  raw: unknown,
  expectedMode: 'mock' | 'live',
): Readonly<{
  ok: boolean;
  disposition: string | null;
  runtimeInvocations: 0 | 1;
  usage: ModelAgentUsage;
  reasonCodes: readonly string[];
  diagnosticCode: ReviewPlannerDiagnosticCode;
}> {
  const observation = asObservation(raw);
  if (!observation || observation.attempted !== true) {
    return invalidProvenance(ReviewPlannerDiagnosticCode.InvalidResponse);
  }
  const budget = observation.budget;
  const usage = observation.usage;
  const trace = observation.trace;
  if (!isExpectedBudget(budget) || !isSafeUsage(usage) || !isExpectedTrace(trace, usage, expectedMode)) {
    return invalidProvenance(ReviewPlannerDiagnosticCode.UsageUnverifiable);
  }
  const runtimeInvocations = budget.usedCalls === 1 ? 1 : 0;
  const usageWithinCap = usage.inputTokens <= budget.maxInputTokens &&
    usage.outputTokens <= budget.maxOutputTokens;
  const usageProvenance = expectedMode === 'mock' ||
    usage.inputTokens > 0 || usage.outputTokens > 0;
  const successful = observation.disposition === 'candidate_applied' &&
    trace.status === 'succeeded' && !trace.degraded &&
    observation.traceUnavailable === undefined && observation.usageUnavailable === undefined &&
    runtimeInvocations === 1 && usageWithinCap && usageProvenance;
  return {
    ok: successful,
    disposition: typeof observation.disposition === 'string' ? observation.disposition : null,
    runtimeInvocations,
    usage: { ...usage },
    reasonCodes: safeReasonCodes(observation.reasonCodes),
    diagnosticCode: successful
      ? ReviewPlannerDiagnosticCode.InvalidResponse
      : !usageProvenance ? ReviewPlannerDiagnosticCode.UsageUnverifiable
        : usageWithinCap ? ReviewPlannerDiagnosticCode.StructuredOutput
          : ReviewPlannerDiagnosticCode.PreflightInvalid,
  };
}

function passesLocalRubric(
  fixture: Phase695CaseFixture,
  value: unknown,
  reasonCodes: readonly string[],
): boolean {
  if (fixture.lane === 'review') {
    if (!isReviewResult(value) || !reasonCodes.includes(fixture.expected.diagnosis)) return false;
    const expected = fixture.expected.focusIndexes.map((index) => fixture.deterministic.weakPoints[index]);
    return expected.length === value.weakPoints.length &&
      expected.every((point, index) => sameWeakPoint(point, value.weakPoints[index]));
  }
  if (!isPlannerResult(value) || !reasonCodes.includes(fixture.expected.strategy)) return false;
  const expected = fixture.expected.blockOrder.map((index) => fixture.deterministic.suggestedBlocks[index]);
  return expected.length === value.suggestedBlocks.length &&
    expected.every((block, index) => samePlanBlock(block, value.suggestedBlocks[index]));
}

function asObservation(value: unknown): CandidateObservation | null {
  return typeof value === 'object' && value !== null ? value : null;
}

function isExpectedBudget(value: unknown): value is ModelAgentRunBudget {
  return isModelAgentRunBudget(value) &&
    value.maxCalls === PHASE_695_SHARED_BUDGET.maxCalls &&
    value.maxInputTokens === PHASE_695_SHARED_BUDGET.maxInputTokens &&
    value.maxOutputTokens === PHASE_695_SHARED_BUDGET.maxOutputTokens &&
    value.usedCalls === 1;
}

function isSafeUsage(value: unknown): value is ModelAgentUsage {
  return typeof value === 'object' && value !== null &&
    isSafeInteger((value as { inputTokens?: unknown }).inputTokens) &&
    isSafeInteger((value as { outputTokens?: unknown }).outputTokens);
}

function isExpectedTrace(
  value: unknown,
  usage: ModelAgentUsage,
  expectedMode: 'mock' | 'live',
): value is Readonly<{ task: 'review_suggestion' | 'planner_suggestion'; mode: 'mock' | 'live'; status: 'succeeded'; degraded: false; inputTokens: number; outputTokens: number; maxOutputTokens: number }> {
  if (typeof value !== 'object' || value === null) return false;
  const trace = value as Record<string, unknown>;
  return (trace.task === 'review_suggestion' || trace.task === 'planner_suggestion') &&
    trace.mode === expectedMode && trace.status === 'succeeded' && trace.degraded === false &&
    trace.inputTokens === usage.inputTokens && trace.outputTokens === usage.outputTokens &&
    isSafeInteger(trace.maxOutputTokens) && trace.maxOutputTokens <= PHASE_695_SHARED_BUDGET.maxOutputTokens;
}

function safeReasonCodes(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? [...value] : [];
}

function invalidProvenance(diagnosticCode: ReviewPlannerDiagnosticCode) {
  return {
    ok: false,
    disposition: null,
    runtimeInvocations: 0 as const,
    usage: zeroUsage(),
    reasonCodes: [],
    diagnosticCode,
  };
}

function rejectedEntry(
  testCase: Phase695ReviewPlannerCase,
  runtimeInvocations: 0 | 1,
  usage: ModelAgentUsage,
  diagnosticCode: ReviewPlannerDiagnosticCode,
): Phase695CaseEntry {
  return {
    caseId: testCase.id,
    lane: testCase.lane,
    executionKind: 'runtime',
    runtimeInvocations,
    strictSuccess: false,
    qualityPass: false,
    criticalFailure: testCase.criticalSemanticCase,
    durationMs: 0,
    usage,
    budget: { ...PHASE_695_SHARED_BUDGET },
    gate: 'candidate_rejected',
    diagnosticCode,
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
    usage: zeroUsage(),
    budget: { ...PHASE_695_SHARED_BUDGET },
    gate: 'zero_call',
  };
}

function cloneReviewFixture(value: Readonly<ReviewAgentResult>): ReviewAgentResult {
  return JSON.parse(JSON.stringify(value)) as ReviewAgentResult;
}

function clonePlannerFixture(value: Readonly<PlannerAgentResult>): PlannerAgentResult {
  return JSON.parse(JSON.stringify(value)) as PlannerAgentResult;
}

function isReviewResult(value: unknown): value is ReviewAgentResult {
  return typeof value === 'object' && value !== null && Array.isArray((value as { weakPoints?: unknown }).weakPoints);
}

function isPlannerResult(value: unknown): value is PlannerAgentResult {
  return typeof value === 'object' && value !== null && Array.isArray((value as { suggestedBlocks?: unknown }).suggestedBlocks);
}

function sameWeakPoint(
  left: ReviewAgentResult['weakPoints'][number] | undefined,
  right: ReviewAgentResult['weakPoints'][number] | undefined,
): boolean {
  return left !== undefined && right !== undefined &&
    left.label === right.label && left.reason === right.reason &&
    left.priority === right.priority && left.confidence === right.confidence;
}

function samePlanBlock(
  left: PlannerAgentResult['suggestedBlocks'][number] | undefined,
  right: PlannerAgentResult['suggestedBlocks'][number] | undefined,
): boolean {
  return left !== undefined && right !== undefined &&
    left.title === right.title && left.minutes === right.minutes &&
    left.reason === right.reason && left.targetHref === right.targetHref;
}

function zeroUsage(): ModelAgentUsage {
  return { inputTokens: 0, outputTokens: 0 };
}

function readMonotonicNow(now: () => number): number | null {
  try {
    const value = now();
    return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
      ? Math.floor(value)
      : null;
  } catch {
    return null;
  }
}

function defaultNow(): number {
  return globalThis.performance.now();
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
  if (metrics.p95DurationMs > PHASE_695_CASE_TIMEOUT_MS) return 'latency_budget_exceeded';
  return 'quality_gate_passed';
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function nearestRank(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(0.95 * sorted.length) - 1] ?? 0;
}
