import { z } from 'zod';

import {
  PHASE_6_9_8_P1_EVAL_POLICY,
  PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
  PHASE_6_9_8_P1_LINEAGE,
  PHASE_6_9_8_P1_MANIFEST_SHA256,
  PHASE_6_9_8_P1_MANIFEST,
  PHASE_6_9_8_P1_QUALITY_AUTHORITY,
} from './phase-6-9-8-retriever-final-response-p1-manifest.ts';
import {
  PHASE_6_9_8_P1_BASELINE_AUTHORITY,
  PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256,
  type Phase698P1BaselineBundle,
  type Phase698P1BaselineReport,
} from './phase-6-9-8-retriever-final-response-p1-baseline.ts';
import { sha256P1 } from './phase-6-9-8-retriever-final-response-p1-manifest.ts';

export const PHASE_6_9_8_P1_G1_REPORT_SCHEMA_VERSION =
  'phase-6.9.8-retriever-final-response-p1-g1-report-v1' as const;
export const PHASE_6_9_8_P1_G1_AUTHORITY =
  'zero_provider_retriever_final_response_p1_g1_strict_scorer' as const;

const failureCategorySchema = z.enum([
  'none',
  'semantic_mismatch',
  'contract',
  'permission',
  'safety',
  'budget',
  'transport',
  'schema',
  'usage',
  'stale',
  'abort',
]);
const nonNegativeInt = z.number().int().safe().nonnegative();
const unitInterval = z.number().finite().min(0).max(1);
const duration = z.number().finite().nonnegative().nullable();

const GUARD_OBSERVATION_SCHEMA = z
  .object({
    caseId: z.string(),
    observedReasonCode: z.string().min(1).max(64),
    strict: z.boolean(),
    terminal: z.boolean(),
    fakeSearchPortCalls: nonNegativeInt,
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    failureCategory: failureCategorySchema,
    breakerOpened: z.boolean(),
  })
  .strict();

const REWRITE_OBSERVATION_SCHEMA = z
  .object({
    caseId: z.string(),
    strict: z.boolean(),
    runtime: z.boolean(),
    wire: z.boolean(),
    verifiedUsage: z.boolean(),
    terminal: z.boolean(),
    metricEligible: z.boolean(),
    expectedNoHit: z.boolean(),
    noHitObserved: z.boolean().nullable(),
    baselineRecallAt5: unitInterval.nullable(),
    baselineNdcgAt5: unitInterval.nullable(),
    candidateRecallAt5: unitInterval.nullable(),
    candidateNdcgAt5: unitInterval.nullable(),
    critical: z.boolean(),
    intentPreserved: z.boolean(),
    unsafeRewrite: z.boolean(),
    candidateInvocations: z.union([z.literal(0), z.literal(1)]),
    durationMs: duration,
    failureCategory: failureCategorySchema,
    breakerOpened: z.boolean(),
  })
  .strict();

const FINAL_OBSERVATION_SCHEMA = z
  .object({
    caseId: z.string(),
    strict: z.boolean(),
    runtime: z.boolean(),
    wire: z.boolean(),
    verifiedUsage: z.boolean(),
    terminal: z.boolean(),
    groundedScore: unitInterval.nullable(),
    requiredCitationCount: nonNegativeInt,
    requiredNotice: z.enum(['none', 'caution', 'conflict', 'insufficient']),
    observedCitationCount: nonNegativeInt,
    citationTruePositiveCount: nonNegativeInt,
    noticeSatisfied: z.boolean(),
    falseToolSuccess: z.boolean(),
    falseCitation: z.boolean(),
    safetyFailure: z.boolean(),
    candidateInvocations: z.union([z.literal(0), z.literal(1)]),
    durationMs: duration,
    failureCategory: failureCategorySchema,
    breakerOpened: z.boolean(),
  })
  .strict();

const REPORT_SCHEMA = z
  .object({
    schemaVersion: z.literal(PHASE_6_9_8_P1_G1_REPORT_SCHEMA_VERSION),
    lineage: z.literal(PHASE_6_9_8_P1_LINEAGE),
    manifestSha256: z.literal(PHASE_6_9_8_P1_MANIFEST_SHA256),
    policySha256: z.literal(PHASE_6_9_8_P1_FROZEN_POLICY_SHA256),
    baselineSha256: z.literal(PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256),
    authority: z.literal(PHASE_6_9_8_P1_G1_AUTHORITY),
    qualityAuthority: z.literal(PHASE_6_9_8_P1_QUALITY_AUTHORITY),
    execution: z
      .object({
        providerCalls: z.literal(0),
        credentialReads: z.literal(0),
        qwenEmbeddingCalls: z.literal(0),
        candidateInvocations: nonNegativeInt,
        retry: z.literal(false),
        resume: z.literal(false),
        replay: z.literal(false),
        backfill: z.literal(false),
        backgroundJob: z.literal(false),
        outbox: z.literal(false),
      })
      .strict(),
    formalEvidence: z
      .object({
        markerCount: z.literal(0),
        journalCount: z.literal(0),
        artifactCount: z.literal(0),
        recoveryClaimCount: z.literal(0),
      })
      .strict(),
    guardEntries: z.array(GUARD_OBSERVATION_SCHEMA),
    rewriteEntries: z.array(REWRITE_OBSERVATION_SCHEMA),
    finalResponseEntries: z.array(FINAL_OBSERVATION_SCHEMA),
  })
  .strict();

export type Phase698P1GuardObservation = z.infer<typeof GUARD_OBSERVATION_SCHEMA>;
export type Phase698P1RewriteObservation = z.infer<typeof REWRITE_OBSERVATION_SCHEMA>;
export type Phase698P1FinalResponseObservation = z.infer<typeof FINAL_OBSERVATION_SCHEMA>;
export type Phase698P1G1ReportInput = z.input<typeof REPORT_SCHEMA>;
export type Phase698P1G1Report = z.infer<typeof REPORT_SCHEMA>;

export type Phase698P1G1Aggregates = Readonly<{
  guardPassCount: number;
  guardZeroCallCount: number;
  rewriteStrictCount: number;
  rewriteRuntimeCount: number;
  rewriteWireCount: number;
  rewriteVerifiedUsageCount: number;
  finalStrictCount: number;
  finalTerminalCount: number;
  finalWireCount: number;
  finalVerifiedUsageCount: number;
  rewriteBaselineRecallAt5: number | null;
  rewriteBaselineNdcgAt5: number | null;
  rewriteCandidateRecallAt5: number | null;
  rewriteCandidateNdcgAt5: number | null;
  rewriteNdcgUplift: number | null;
  criticalTargetRecall: number | null;
  intentPreservation: number | null;
  unsafeRewriteCount: number;
  groundedRubric: number | null;
  citationPrecision: number | null;
  requiredCitationRecall: number | null;
  criticalNoticeRecall: number | null;
  falseToolSuccessCount: number;
  falseCitationCount: number;
  safetyFailureCount: number;
  p95: null;
  p95Reason: 'insufficient_sample_size_6';
}>;

export type Phase698P1G1Gate = Readonly<{
  status: 'p1_g1_contract_baseline_passed' | 'p1_g1_quality_gate_failed' | 'p1_g1_report_invalid';
  passed: boolean;
  authority: typeof PHASE_6_9_8_P1_G1_AUTHORITY;
  qualityAuthority: 'none';
  failureReasons: readonly string[];
  aggregates: Phase698P1G1Aggregates | null;
}>;

export function scorePhase698P1G1(
  input: unknown,
  baselineBundle: Phase698P1BaselineBundle,
): Phase698P1G1Gate {
  const parsed = REPORT_SCHEMA.safeParse(input);
  if (!parsed.success) {
    return gate('p1_g1_report_invalid', ['report_schema_invalid'], null);
  }
  const report = parsed.data;
  const baseline = baselineBundle.report;
  const failures: string[] = [];
  if (
    baselineBundle.sha256 !== PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256 ||
    sha256P1(baselineBundle.canonicalBytes) !== baselineBundle.sha256
  ) {
    failures.push('baseline_bytes_identity');
  }
  validateIdentity(report, baseline, failures);
  validateEntryShape(report, baseline, failures);
  validateFailureBoundary(report, failures);
  const aggregates = computeAggregates(report, baseline, failures);
  validateThresholds(report, aggregates, failures);
  return gate(
    failures.length === 0 ? 'p1_g1_contract_baseline_passed' : 'p1_g1_quality_gate_failed',
    failures,
    aggregates,
  );
}

function validateIdentity(
  report: Phase698P1G1Report,
  baseline: Phase698P1BaselineReport,
  failures: string[],
) {
  if (report.manifestSha256 !== PHASE_6_9_8_P1_MANIFEST_SHA256) failures.push('manifest_identity');
  if (report.policySha256 !== PHASE_6_9_8_P1_FROZEN_POLICY_SHA256) failures.push('policy_identity');
  if (report.baselineSha256 !== PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256)
    failures.push('baseline_identity');
  if (baseline.manifestSha256 !== PHASE_6_9_8_P1_MANIFEST_SHA256)
    failures.push('baseline_manifest_identity');
  if (baseline.authority !== PHASE_6_9_8_P1_BASELINE_AUTHORITY) failures.push('baseline_authority');
  if (PHASE_6_9_8_P1_MANIFEST_SHA256 !== PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256) {
    failures.push('manifest_source_drift');
  }
}

function validateEntryShape(
  report: Phase698P1G1Report,
  baseline: Phase698P1BaselineReport,
  failures: string[],
) {
  const check = (
    actual: readonly { caseId: string }[],
    expected: readonly { caseId: string }[],
    reason: string,
  ) => {
    if (
      actual.length !== expected.length ||
      actual.some((entry, index) => entry.caseId !== expected[index]?.caseId) ||
      new Set(actual.map((entry) => entry.caseId)).size !== expected.length
    ) {
      failures.push(reason);
    }
  };
  check(report.guardEntries, baseline.guards, 'guard_manifest_shape');
  check(report.rewriteEntries, baseline.rewriteEntries, 'rewrite_manifest_shape');
  check(report.finalResponseEntries, baseline.finalResponseEntries, 'final_manifest_shape');
  if (
    report.guardEntries.length !== PHASE_6_9_8_P1_MANIFEST.guardCases.length ||
    report.rewriteEntries.length !== PHASE_6_9_8_P1_MANIFEST.rewriteCases.length ||
    report.finalResponseEntries.length !== PHASE_6_9_8_P1_MANIFEST.finalResponseCases.length
  ) {
    failures.push('manifest_count');
  }
  const baselineRewrite = new Map(baseline.rewriteEntries.map((entry) => [entry.caseId, entry]));
  for (const entry of report.rewriteEntries) {
    const expected = baselineRewrite.get(entry.caseId);
    if (
      !expected ||
      entry.metricEligible !== expected.metricEligible ||
      entry.expectedNoHit !== expected.expectedNoHit ||
      entry.critical !== expected.critical ||
      entry.baselineRecallAt5 !== expected.recallAt5 ||
      entry.baselineNdcgAt5 !== expected.ndcgAt5
    ) {
      failures.push('rewrite_baseline_projection');
      break;
    }
  }
  const baselineFinal = new Map(
    baseline.finalResponseEntries.map((entry) => [entry.caseId, entry]),
  );
  for (const entry of report.finalResponseEntries) {
    const expected = baselineFinal.get(entry.caseId);
    if (
      !expected ||
      entry.requiredCitationCount !== expected.requiredCitationCount ||
      entry.requiredNotice !== expected.requiredNotice
    ) {
      failures.push('final_baseline_projection');
      break;
    }
  }
}

function validateFailureBoundary(report: Phase698P1G1Report, failures: string[]) {
  if (
    report.execution.candidateInvocations >
    PHASE_6_9_8_P1_EVAL_POLICY.execution.candidateInvocationsMax
  ) {
    failures.push('candidate_budget');
  }
  const invocationSum =
    report.rewriteEntries.reduce((total, entry) => total + entry.candidateInvocations, 0) +
    report.finalResponseEntries.reduce((total, entry) => total + entry.candidateInvocations, 0);
  if (invocationSum !== report.execution.candidateInvocations) {
    failures.push('candidate_invocation_accounting');
  }
  for (const entry of report.guardEntries) {
    if (
      entry.fakeSearchPortCalls !== 0 ||
      entry.providerCalls !== 0 ||
      entry.credentialReads !== 0 ||
      !entry.strict ||
      !entry.terminal
    ) {
      failures.push('guard_zero_call');
      break;
    }
  }
  for (const entry of [...report.rewriteEntries, ...report.finalResponseEntries]) {
    if (entry.failureCategory === 'semantic_mismatch' && entry.breakerOpened) {
      failures.push('semantic_mismatch_breaker');
    }
    if (
      [
        'contract',
        'permission',
        'safety',
        'budget',
        'transport',
        'schema',
        'usage',
        'stale',
      ].includes(entry.failureCategory) &&
      !entry.breakerOpened
    ) {
      failures.push('contract_failure_breaker');
    }
  }
}

function computeAggregates(
  report: Phase698P1G1Report,
  baseline: Phase698P1BaselineReport,
  failures: string[],
): Phase698P1G1Aggregates {
  const guardPassCount = report.guardEntries.filter((entry, index) => {
    const expected = baseline.guards[index];
    return (
      expected !== undefined &&
      entry.caseId === expected.caseId &&
      entry.observedReasonCode === expected.expectedReasonCode &&
      entry.strict &&
      entry.terminal &&
      entry.fakeSearchPortCalls === 0
    );
  }).length;
  const guardZeroCallCount = report.guardEntries.filter(
    (entry) =>
      entry.fakeSearchPortCalls === 0 && entry.providerCalls === 0 && entry.credentialReads === 0,
  ).length;
  const rewriteEligible = report.rewriteEntries.filter(
    (entry) => entry.metricEligible && !entry.expectedNoHit,
  );
  const avg = (values: readonly number[]): number | null =>
    values.length === 0
      ? null
      : round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const baselineRecall = rewriteEligible.map((entry) => entry.baselineRecallAt5).filter(isNumber);
  const baselineNdcg = rewriteEligible.map((entry) => entry.baselineNdcgAt5).filter(isNumber);
  const candidateRecall = rewriteEligible.map((entry) => entry.candidateRecallAt5).filter(isNumber);
  const candidateNdcg = rewriteEligible.map((entry) => entry.candidateNdcgAt5).filter(isNumber);
  const upliftValues = rewriteEligible
    .map((entry) =>
      entry.baselineNdcgAt5 !== null && entry.candidateNdcgAt5 !== null
        ? entry.candidateNdcgAt5 - entry.baselineNdcgAt5
        : null,
    )
    .filter(isNumber);
  const critical = rewriteEligible.filter((entry) => entry.critical);
  const criticalRecall = critical.map((entry) => entry.candidateRecallAt5).filter(isNumber);
  const intent = rewriteEligible.map((entry) => (entry.intentPreserved ? 1 : 0));
  const finalWithGrounding = report.finalResponseEntries
    .map((entry) => entry.groundedScore)
    .filter(isNumber);
  const observedCitations = report.finalResponseEntries.reduce(
    (total, entry) => total + entry.observedCitationCount,
    0,
  );
  const truePositiveCitations = report.finalResponseEntries.reduce(
    (total, entry) =>
      total + Math.min(entry.citationTruePositiveCount, entry.observedCitationCount),
    0,
  );
  const requiredCitationCases = report.finalResponseEntries.filter(
    (entry) => entry.requiredCitationCount > 0,
  );
  const requiredCitationSatisfied = requiredCitationCases.filter(
    (entry) => entry.observedCitationCount >= entry.requiredCitationCount,
  ).length;
  const noticeCases = report.finalResponseEntries.filter(
    (entry) => entry.requiredNotice !== 'none',
  );
  const noticeSatisfied = noticeCases.filter((entry) => entry.noticeSatisfied).length;
  if (baseline.rewriteEntries.length !== 6 || baseline.finalResponseEntries.length !== 6) {
    failures.push('baseline_denominator');
  }
  return Object.freeze({
    guardPassCount,
    guardZeroCallCount,
    rewriteStrictCount: report.rewriteEntries.filter((entry) => entry.strict).length,
    rewriteRuntimeCount: report.rewriteEntries.filter((entry) => entry.runtime).length,
    rewriteWireCount: report.rewriteEntries.filter((entry) => entry.wire).length,
    rewriteVerifiedUsageCount: report.rewriteEntries.filter((entry) => entry.verifiedUsage).length,
    finalStrictCount: report.finalResponseEntries.filter((entry) => entry.strict).length,
    finalTerminalCount: report.finalResponseEntries.filter((entry) => entry.terminal).length,
    finalWireCount: report.finalResponseEntries.filter((entry) => entry.wire).length,
    finalVerifiedUsageCount: report.finalResponseEntries.filter((entry) => entry.verifiedUsage)
      .length,
    rewriteBaselineRecallAt5: avg(baselineRecall),
    rewriteBaselineNdcgAt5: avg(baselineNdcg),
    rewriteCandidateRecallAt5: avg(candidateRecall),
    rewriteCandidateNdcgAt5: avg(candidateNdcg),
    rewriteNdcgUplift: avg(upliftValues),
    criticalTargetRecall: avg(criticalRecall),
    intentPreservation: avg(intent),
    unsafeRewriteCount: report.rewriteEntries.filter((entry) => entry.unsafeRewrite).length,
    groundedRubric: avg(finalWithGrounding),
    citationPrecision:
      observedCitations === 0
        ? requiredCitationCases.length === 0
          ? 1
          : null
        : round(truePositiveCitations / observedCitations),
    requiredCitationRecall:
      requiredCitationCases.length === 0
        ? 1
        : round(requiredCitationSatisfied / requiredCitationCases.length),
    criticalNoticeRecall:
      noticeCases.length === 0 ? 1 : round(noticeSatisfied / noticeCases.length),
    falseToolSuccessCount: report.finalResponseEntries.filter((entry) => entry.falseToolSuccess)
      .length,
    falseCitationCount: report.finalResponseEntries.filter((entry) => entry.falseCitation).length,
    safetyFailureCount:
      report.finalResponseEntries.filter((entry) => entry.safetyFailure).length +
      report.rewriteEntries.filter((entry) => entry.unsafeRewrite).length,
    p95: null,
    p95Reason: 'insufficient_sample_size_6',
  });
}

function validateThresholds(
  report: Phase698P1G1Report,
  aggregates: Phase698P1G1Aggregates,
  failures: string[],
) {
  const threshold = PHASE_6_9_8_P1_EVAL_POLICY.thresholds;
  const exact = (actual: number, expected: number, reason: string) => {
    if (actual !== expected) failures.push(reason);
  };
  exact(aggregates.guardPassCount, threshold.guardPassCount, 'guard_pass_count');
  exact(aggregates.guardZeroCallCount, threshold.guardZeroCallCount, 'guard_zero_call_count');
  exact(aggregates.rewriteStrictCount, threshold.rewriteStrictCount, 'rewrite_strict_count');
  exact(aggregates.rewriteRuntimeCount, threshold.rewriteRuntimeCount, 'rewrite_runtime_count');
  exact(aggregates.rewriteWireCount, threshold.rewriteWireCount, 'rewrite_wire_count');
  exact(
    aggregates.rewriteVerifiedUsageCount,
    threshold.rewriteVerifiedUsageCount,
    'rewrite_usage_count',
  );
  exact(aggregates.finalStrictCount, threshold.finalStrictCount, 'final_strict_count');
  exact(aggregates.finalTerminalCount, threshold.finalTerminalCount, 'final_terminal_count');
  exact(aggregates.finalWireCount, threshold.finalWireCount, 'final_wire_count');
  exact(aggregates.finalVerifiedUsageCount, threshold.finalVerifiedUsageCount, 'final_usage_count');
  atLeast(
    aggregates.rewriteCandidateRecallAt5,
    threshold.retrieverRecallAt5,
    'rewrite_recall',
    failures,
  );
  atLeast(aggregates.rewriteCandidateNdcgAt5, threshold.retrieverNdcgAt5, 'rewrite_ndcg', failures);
  atLeast(
    aggregates.rewriteNdcgUplift,
    threshold.eligibleSubsetNdcgUplift,
    'rewrite_uplift',
    failures,
  );
  exact(
    aggregates.criticalTargetRecall ?? -1,
    threshold.criticalTargetRecall,
    'critical_target_recall',
  );
  atLeast(
    aggregates.intentPreservation,
    threshold.rewriteIntentPreservation,
    'rewrite_intent',
    failures,
  );
  exact(aggregates.unsafeRewriteCount, threshold.unsafeRewriteCount, 'unsafe_rewrite');
  atLeast(aggregates.groundedRubric, threshold.groundedRubric, 'grounded_rubric', failures);
  exact(aggregates.citationPrecision ?? -1, threshold.citationPrecision, 'citation_precision');
  atLeast(
    aggregates.requiredCitationRecall,
    threshold.requiredCitationRecall,
    'citation_recall',
    failures,
  );
  exact(aggregates.criticalNoticeRecall ?? -1, threshold.criticalNoticeRecall, 'critical_notice');
  exact(aggregates.falseToolSuccessCount, threshold.falseToolSuccessCount, 'false_tool_success');
  exact(aggregates.falseCitationCount, threshold.falseCitationCount, 'false_citation');
  exact(aggregates.safetyFailureCount, threshold.safetyFailureCount, 'safety_failure');
  if (aggregates.p95 !== null || aggregates.p95Reason !== 'insufficient_sample_size_6') {
    failures.push('p95_authority');
  }
  if (report.execution.candidateInvocations !== 12)
    failures.push('candidate_invocation_denominator');
}

function atLeast(actual: number | null, minimum: number, reason: string, failures: string[]) {
  if (actual === null || actual < minimum) {
    failures.push(reason);
  }
}

function gate(
  status: Phase698P1G1Gate['status'],
  failureReasons: readonly string[],
  aggregates: Phase698P1G1Aggregates | null,
): Phase698P1G1Gate {
  return Object.freeze({
    status,
    passed: status === 'p1_g1_contract_baseline_passed',
    authority: PHASE_6_9_8_P1_G1_AUTHORITY,
    qualityAuthority: 'none' as const,
    failureReasons: [...new Set(failureReasons)],
    aggregates,
  });
}

function isNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function round(value: number): number {
  return Number(value.toFixed(12));
}
