import {
  decideProductionDecision,
  type Phase695CaseEntry,
  type Phase695ProductionDecision,
} from './phase-6-9-review-planner-contract.ts';
import {
  PHASE_695_V10_REVIEW_PLANNER_DATASET_VERSION,
  derivePhase695V10MockDecision,
  getPhase695V10CaseFixture,
  phase695V10ReviewPlannerCases,
} from './phase-6-9-review-planner-v10-cases.ts';
import {
  runPhase695ReviewPlannerEntries,
  type Phase695DatasetAdapter,
  type Phase695LiveDependencies,
} from './run-phase-6-9-review-planner-paired.ts';

export const PHASE_695_V10_REPORT_SCHEMA_VERSION =
  'phase-6.9-review-planner-v10-report-v1' as const;

export type Phase695V10LiveDependencies = Phase695LiveDependencies;
export type RunPhase695V10ReviewPlannerPairedInput =
  | Readonly<{ mode: 'mock'; now?: () => number }>
  | Readonly<{ mode: 'live'; live: Phase695V10LiveDependencies }>;

type LaneAggregate = Readonly<{
  caseEntries: number;
  runtimeCases: number;
  zeroCallCases: number;
  strictSuccesses: number;
  qualityPasses: number;
  criticalFailures: number;
}>;

export type Phase695V10Report = Readonly<{
  schemaVersion: typeof PHASE_695_V10_REPORT_SCHEMA_VERSION;
  datasetVersion: typeof PHASE_695_V10_REVIEW_PLANNER_DATASET_VERSION;
  mode: 'mock' | 'live';
  caseEntries: readonly Phase695CaseEntry[];
  aggregate: Readonly<{ review: LaneAggregate; planner: LaneAggregate }>;
  counters: Readonly<{
    caseEntries: number;
    zeroCallCases: number;
    runtimeInvocations: number;
    strictSuccesses: number;
    qualityPasses: number;
    criticalFailures: number;
    inputTokens: number;
    outputTokens: number;
  }>;
  metrics: Readonly<{
    strictSchemaSuccessRate: number;
    semanticQualityRate: number;
    criticalFailures: number;
    p95DurationMs: number;
  }>;
  productionDecision: Phase695ProductionDecision;
}>;

const phase695V10Dataset: Phase695DatasetAdapter = Object.freeze({
  cases: phase695V10ReviewPlannerCases,
  getFixture: getPhase695V10CaseFixture,
  mockDecision: derivePhase695V10MockDecision,
});

export async function runPhase695V10ReviewPlannerPaired(
  input: RunPhase695V10ReviewPlannerPairedInput,
): Promise<Phase695V10Report> {
  const entries = await runPhase695ReviewPlannerEntries(
    input,
    phase695V10Dataset,
  );
  const runtimeEntries = entries.filter((entry) => entry.executionKind === 'runtime');
  const zeroCallEntries = entries.filter((entry) => entry.executionKind === 'zero_call');
  const counters = Object.freeze({
    caseEntries: entries.length,
    zeroCallCases: zeroCallEntries.length,
    runtimeInvocations: entries.reduce(
      (total, entry) => total + entry.runtimeInvocations,
      0,
    ),
    strictSuccesses: entries.filter((entry) => entry.strictSuccess).length,
    qualityPasses: entries.filter((entry) => entry.qualityPass).length,
    criticalFailures: entries.filter((entry) => entry.criticalFailure).length,
    inputTokens: entries.reduce(
      (total, entry) => total + entry.usage.inputTokens,
      0,
    ),
    outputTokens: entries.reduce(
      (total, entry) => total + entry.usage.outputTokens,
      0,
    ),
  });
  const metrics = Object.freeze({
    strictSchemaSuccessRate: ratio(
      runtimeEntries.filter((entry) => entry.strictSuccess).length,
      runtimeEntries.length,
    ),
    semanticQualityRate: ratio(
      runtimeEntries.filter((entry) => entry.qualityPass).length,
      runtimeEntries.length,
    ),
    criticalFailures: counters.criticalFailures,
    p95DurationMs: nearestRank(runtimeEntries.map((entry) => entry.durationMs)),
  });
  const productionDecision = input.mode === 'mock'
    ? 'mock_quality_not_evidence' as const
    : decideProductionDecision({
      mode: input.mode,
      zeroCallEntries,
      runtimeEntries,
      metrics,
    });
  return Object.freeze({
    schemaVersion: PHASE_695_V10_REPORT_SCHEMA_VERSION,
    datasetVersion: PHASE_695_V10_REVIEW_PLANNER_DATASET_VERSION,
    mode: input.mode,
    caseEntries: entries,
    aggregate: Object.freeze({
      review: aggregateLane(entries, 'review'),
      planner: aggregateLane(entries, 'planner'),
    }),
    counters,
    metrics,
    productionDecision,
  });
}

function aggregateLane(
  entries: readonly Phase695CaseEntry[],
  lane: 'review' | 'planner',
): LaneAggregate {
  const selected = entries.filter((entry) => entry.lane === lane);
  return Object.freeze({
    caseEntries: selected.length,
    runtimeCases: selected.filter((entry) => entry.executionKind === 'runtime').length,
    zeroCallCases: selected.filter((entry) => entry.executionKind === 'zero_call').length,
    strictSuccesses: selected.filter((entry) => entry.strictSuccess).length,
    qualityPasses: selected.filter((entry) => entry.qualityPass).length,
    criticalFailures: selected.filter((entry) => entry.criticalFailure).length,
  });
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function nearestRank(values: readonly number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(0.95 * sorted.length) - 1] ?? 0;
}
