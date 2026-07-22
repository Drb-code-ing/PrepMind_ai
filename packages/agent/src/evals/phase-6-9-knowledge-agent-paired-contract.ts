import { z } from 'zod';

import {
  PHASE_6_9_KNOWLEDGE_AGENT_CASES,
  PHASE_6_9_KNOWLEDGE_AGENT_DATASET_VERSION,
  type Phase69KnowledgeAgentCase,
} from './phase-6-9-knowledge-agent-cases.ts';
import {
  buildKnowledgeAgentSemanticMetrics,
  nearestRankP95,
} from './phase-6-9-knowledge-agent-metrics.ts';
import { KNOWLEDGE_MODEL_PROJECTION_VERSION } from '../model-candidates/knowledge-model-projection.ts';
import { MODEL_CANDIDATE_DISPOSITIONS } from '../model-candidates/model-candidate-policy.ts';

export const PHASE_6_9_KNOWLEDGE_PROMPT_VERSION_V1 = 'knowledge-agents-v1' as const;
export const PHASE_6_9_KNOWLEDGE_PROMPT_VERSION = 'knowledge-agents-v2' as const;
export const PHASE_6_9_KNOWLEDGE_SHORTLIST_VERSION =
  'knowledge-semantic-shortlist-v1' as const;
export const PHASE_6_9_KNOWLEDGE_BASELINE_SEMANTIC_SCORE = 0.2322452551 as const;
export const PHASE_6_9_KNOWLEDGE_PRICING_PROFILE =
  'deepseek-v4-pro-cny-2026-07-15' as const;

const unitNumber = z.number().finite().min(0).max(1);
const safeCount = z.number().int().safe().nonnegative();
const latencyValue = z.number().finite().nonnegative();
const relationSchema = z.enum([
  'semantic_duplicate',
  'possible_revision',
  'complementary',
  'unrelated',
]);
const subjectSchema = z.enum([
  'math',
  'english',
  'politics',
  'computer',
  'major',
  'other',
]);
const pairSchema = z.tuple([z.string().min(1), z.string().min(1)]);
const candidateDispositionSchema = z.enum(MODEL_CANDIDATE_DISPOSITIONS);

export const KNOWLEDGE_CASE_USAGE_SCHEMA = z
  .object({
    inputTokens: z.number().int().safe().positive(),
    outputTokens: z.number().int().safe().positive(),
    pricingKnown: z.literal(true),
    currency: z.literal('CNY'),
    pricingProfile: z.literal(PHASE_6_9_KNOWLEDGE_PRICING_PROFILE),
    estimatedCostCny: z.number().finite().positive(),
  })
  .strict();

export const KNOWLEDGE_CASE_ENTRY_SCHEMA = z
  .object({
    caseId: z.string().regex(/^(dedup|organizer)-[a-z0-9-]+$/),
    agent: z.enum(['dedup', 'organizer']),
    executionKind: z.enum(['zero_call', 'runtime']),
    pairedRunIndex: z.number().int().min(0).max(23).nullable(),
    runtimeInvocations: z.number().int().min(0).max(1),
    zeroCallReason: z.string().regex(/^[a-z0-9_]+$/).nullable(),
    zeroCallVerified: z.boolean(),
    canonicalSchemaSuccess: z.boolean(),
    rawSchemaValid: z.boolean().nullable().optional(),
    candidateDisposition: candidateDispositionSchema.nullable().optional(),
    criticalFailure: z.boolean(),
    permissionFailure: z.boolean(),
    mutationFailure: z.boolean(),
    broaderThanDeterministicFallback: z.boolean(),
    exactHashCheck: z.enum(['not_applicable', 'preserved', 'violated']),
    latencyMs: latencyValue.nullable(),
    usage: KNOWLEDGE_CASE_USAGE_SCHEMA.nullable(),
    expectedRelation: relationSchema.nullable(),
    actualRelation: relationSchema.nullable(),
    revisionExpected: z.boolean().nullable(),
    expectedSubject: subjectSchema.nullable(),
    actualSubject: subjectSchema.nullable(),
    expectedTopicLabels: z.array(z.string().min(1).max(40)),
    actualTopicLabels: z.array(z.string().min(1).max(40)),
    expectedCollectionPairs: z.array(pairSchema),
    actualCollectionPairs: z.array(pairSchema),
  })
  .strict();

export const KNOWLEDGE_SEMANTIC_METRICS_SCHEMA = z
  .object({
    baselineSemanticScore: z.literal(PHASE_6_9_KNOWLEDGE_BASELINE_SEMANTIC_SCORE),
    dedupSemanticMacroF1: unitNumber,
    revisionRecall: unitNumber,
    organizerSubjectTop1: unitNumber,
    organizerTagMicroF1: unitNumber,
    organizerCollectionPairwiseF1: unitNumber,
    unrelatedFalsePositiveRate: unitNumber,
    semanticScore: unitNumber,
    absoluteImprovement: z.number().finite(),
    exactHashPrecision: unitNumber,
    exactHashRecall: unitNumber,
    scoredRuntimeCases: z.literal(48),
    invalidRuntimeCases: z.number().int().min(0).max(48),
  })
  .strict();

export const KNOWLEDGE_LATENCY_SCHEMA = z
  .object({
    dedupSamplesMs: z.array(latencyValue).length(24),
    organizerSamplesMs: z.array(latencyValue).length(24),
    endpointSamplesMs: z.array(latencyValue).length(24),
    dedupP95Ms: latencyValue,
    organizerP95Ms: latencyValue,
    endpointP95Ms: latencyValue,
  })
  .strict();

export const KNOWLEDGE_USAGE_SCHEMA = z
  .object({
    attemptedCases: z.literal(48),
    verifiedCases: z.number().int().min(0).max(48),
    inputTokens: safeCount,
    outputTokens: safeCount,
    pricingKnown: z.boolean(),
    currency: z.literal('CNY'),
    pricingProfile: z.literal(PHASE_6_9_KNOWLEDGE_PRICING_PROFILE).nullable(),
    totalCostCny: z.number().finite().nonnegative().nullable(),
  })
  .strict();

export const KNOWLEDGE_SAFETY_SCHEMA = z
  .object({
    zeroCallVerified: z.number().int().min(0).max(24),
    canonicalSchemaSuccesses: z.number().int().min(0).max(48),
    criticalFailures: safeCount,
    permissionFailures: safeCount,
    mutationFailures: safeCount,
    broaderFallbacks: safeCount,
  })
  .strict();

const reportBaseSchema = z
  .object({
    runId: z.string().uuid(),
    runScope: z.enum(['branch', 'main']),
    mode: z.enum(['deterministic', 'mock', 'live']),
    datasetVersion: z.literal(PHASE_6_9_KNOWLEDGE_AGENT_DATASET_VERSION),
    promptVersion: z.enum([
      PHASE_6_9_KNOWLEDGE_PROMPT_VERSION_V1,
      PHASE_6_9_KNOWLEDGE_PROMPT_VERSION,
    ]),
    projectionVersion: z.literal(KNOWLEDGE_MODEL_PROJECTION_VERSION),
    shortlistVersion: z.literal(PHASE_6_9_KNOWLEDGE_SHORTLIST_VERSION),
    provider: z.enum(['none', 'mock', 'deepseek']),
    model: z.enum(['none', 'mock', 'deepseek-v4-pro']),
    counts: z
      .object({
        cases: z.literal(72),
        zeroCall: z.literal(24),
        runtime: z.literal(48),
        pairedRequests: z.literal(24),
      })
      .strict(),
    metrics: KNOWLEDGE_SEMANTIC_METRICS_SCHEMA,
    latency: KNOWLEDGE_LATENCY_SCHEMA,
    usage: KNOWLEDGE_USAGE_SCHEMA,
    safety: KNOWLEDGE_SAFETY_SCHEMA,
    caseEntries: z.array(KNOWLEDGE_CASE_ENTRY_SCHEMA).length(72),
    gate: z.enum(['quality_gate_passed', 'quality_gate_failed']),
  })
  .strict();

export type KnowledgeAgentCaseEntry = z.infer<typeof KNOWLEDGE_CASE_ENTRY_SCHEMA>;
export type KnowledgeAgentPairedReportInput = z.infer<typeof reportBaseSchema>;
export type KnowledgeAgentPairedReport = KnowledgeAgentPairedReportInput;

export const PHASE_6_9_KNOWLEDGE_AGENT_REPORT_SCHEMA = reportBaseSchema.superRefine(
  (report, context) => {
    validateModeIdentity(report, context);
    validateVersionedDiagnostics(report, context);
    validateCanonicalEntries(report, context);
    validateDerivedFields(report, context);
  },
);

function validateVersionedDiagnostics(
  report: KnowledgeAgentPairedReportInput,
  context: z.RefinementCtx,
) {
  const v2 = report.promptVersion === PHASE_6_9_KNOWLEDGE_PROMPT_VERSION;
  for (const entry of report.caseEntries) {
    const hasRaw = entry.rawSchemaValid !== undefined;
    const hasDisposition = entry.candidateDisposition !== undefined;
    if (!v2) {
      if (hasRaw || hasDisposition) {
        addIssue(context, `V1 diagnostics must remain absent: ${entry.caseId}`);
      }
      continue;
    }
    if (!hasRaw || !hasDisposition) {
      addIssue(context, `V2 diagnostics missing: ${entry.caseId}`);
      continue;
    }
    if (entry.executionKind === 'zero_call') {
      if (entry.rawSchemaValid !== null || entry.candidateDisposition !== null) {
        addIssue(context, `zero-call diagnostics mismatch: ${entry.caseId}`);
      }
      continue;
    }
    if (entry.rawSchemaValid === null || entry.candidateDisposition === null) {
      addIssue(context, `runtime diagnostics mismatch: ${entry.caseId}`);
      continue;
    }
    if (
      entry.canonicalSchemaSuccess !==
      (entry.rawSchemaValid && entry.candidateDisposition === 'candidate_applied')
    ) {
      addIssue(context, `candidate application diagnostics mismatch: ${entry.caseId}`);
    }
  }
}

export function computeKnowledgeGate(
  report: KnowledgeAgentPairedReportInput,
): 'quality_gate_passed' | 'quality_gate_failed' {
  const metrics = report.metrics;
  const latency = report.latency;
  const usage = report.usage;
  const safety = report.safety;
  const passes =
    report.mode === 'live' &&
    report.provider === 'deepseek' &&
    report.model === 'deepseek-v4-pro' &&
    safety.zeroCallVerified === 24 &&
    safety.canonicalSchemaSuccesses === 48 &&
    safety.criticalFailures === 0 &&
    safety.permissionFailures === 0 &&
    safety.mutationFailures === 0 &&
    safety.broaderFallbacks === 0 &&
    metrics.exactHashPrecision === 1 &&
    metrics.exactHashRecall === 1 &&
    metrics.dedupSemanticMacroF1 >= 0.85 &&
    metrics.revisionRecall >= 0.85 &&
    metrics.unrelatedFalsePositiveRate <= 0.1 &&
    metrics.organizerSubjectTop1 >= 0.88 &&
    metrics.organizerTagMicroF1 >= 0.8 &&
    metrics.organizerCollectionPairwiseF1 >= 0.8 &&
    metrics.absoluteImprovement >= 0.1 &&
    latency.dedupP95Ms <= 4500 &&
    latency.organizerP95Ms <= 4500 &&
    latency.endpointP95Ms <= 5200 &&
    usage.verifiedCases === 48 &&
    usage.inputTokens > 0 &&
    usage.outputTokens > 0 &&
    usage.pricingKnown &&
    usage.pricingProfile === PHASE_6_9_KNOWLEDGE_PRICING_PROFILE &&
    usage.totalCostCny !== null &&
    usage.totalCostCny > 0 &&
    usage.totalCostCny <= 1;
  return passes ? 'quality_gate_passed' : 'quality_gate_failed';
}

function validateModeIdentity(
  report: KnowledgeAgentPairedReportInput,
  context: z.RefinementCtx,
) {
  const valid =
    (report.mode === 'deterministic' && report.provider === 'none' && report.model === 'none') ||
    (report.mode === 'mock' && report.provider === 'mock' && report.model === 'mock') ||
    (report.mode === 'live' &&
      report.provider === 'deepseek' &&
      report.model === 'deepseek-v4-pro');
  if (!valid) addIssue(context, 'mode/provider/model provenance mismatch');
}

function validateCanonicalEntries(
  report: KnowledgeAgentPairedReportInput,
  context: z.RefinementCtx,
) {
  const canonical = new Map<string, Phase69KnowledgeAgentCase>(
    PHASE_6_9_KNOWLEDGE_AGENT_CASES.map((entry) => [entry.id, entry]),
  );
  const ids = report.caseEntries.map((entry) => entry.caseId);
  if (new Set(ids).size !== 72 || ids.some((id) => !canonical.has(id))) {
    addIssue(context, 'case ids must be unique and canonical');
    return;
  }
  for (const expected of PHASE_6_9_KNOWLEDGE_AGENT_CASES) {
    const actual = report.caseEntries.find((entry) => entry.caseId === expected.id);
    if (!actual || !entryMatchesCase(actual, expected)) {
      addIssue(context, `case contract mismatch: ${expected.id}`);
    }
  }
  const zeroCalls = report.caseEntries.filter((entry) => entry.executionKind === 'zero_call');
  if (
    zeroCalls.length !== 24 ||
    zeroCalls.filter((entry) => entry.agent === 'dedup').length !== 16 ||
    zeroCalls.filter((entry) => entry.agent === 'organizer').length !== 8
  ) {
    addIssue(context, 'zero-call distribution mismatch');
  }
  for (let index = 0; index < 24; index += 1) {
    const pair = report.caseEntries.filter((entry) => entry.pairedRunIndex === index);
    if (
      pair.length !== 2 ||
      pair.filter((entry) => entry.agent === 'dedup').length !== 1 ||
      pair.filter((entry) => entry.agent === 'organizer').length !== 1
    ) {
      addIssue(context, `paired run mismatch: ${index}`);
    }
  }
}

function entryMatchesCase(entry: KnowledgeAgentCaseEntry, expected: Phase69KnowledgeAgentCase) {
  const runtime = expected.expectedRuntimeInvocations === 1;
  if (
    entry.agent !== expected.agent ||
    entry.executionKind !== (runtime ? 'runtime' : 'zero_call') ||
    entry.pairedRunIndex !== (runtime ? expected.pairedRunIndex : null)
  ) {
    return false;
  }
  if (!runtime) {
    return (
      entry.zeroCallReason === expected.zeroCallReason &&
      entry.runtimeInvocations === 0 &&
      entry.latencyMs === null &&
      entry.usage === null &&
      entry.expectedRelation === null &&
      entry.expectedSubject === null
    );
  }
  if (entry.runtimeInvocations !== 1 || entry.zeroCallReason !== null || entry.latencyMs === null) {
    return false;
  }
  return expected.agent === 'dedup'
    ? entry.expectedRelation === expected.expected.relation &&
        entry.revisionExpected === (expected.expected.relation === 'possible_revision') &&
        entry.expectedSubject === null
    : entry.expectedSubject === expected.expected.subject &&
        entry.expectedRelation === null &&
        sameStrings(entry.expectedTopicLabels, expected.expected.topicLabels) &&
        samePairs(entry.expectedCollectionPairs, expected.expected.collectionPairs);
}

function validateDerivedFields(
  report: KnowledgeAgentPairedReportInput,
  context: z.RefinementCtx,
) {
  const runtime = report.caseEntries.filter((entry) => entry.executionKind === 'runtime');
  const dedup = runtime.filter((entry) => entry.agent === 'dedup');
  const organizer = runtime.filter((entry) => entry.agent === 'organizer');
  const computed = buildKnowledgeAgentSemanticMetrics(
    dedup.map((entry) => ({
      caseId: entry.caseId,
      expectedRelation: entry.expectedRelation!,
      actualRelation: entry.actualRelation,
      revisionExpected: entry.revisionExpected === true,
      validOutput: entry.canonicalSchemaSuccess,
    })),
    organizer.map((entry) => ({
      caseId: entry.caseId,
      expectedSubject: entry.expectedSubject!,
      actualSubject: entry.actualSubject,
      expectedTopicLabels: entry.expectedTopicLabels,
      actualTopicLabels: entry.actualTopicLabels,
      expectedCollectionPairs: entry.expectedCollectionPairs,
      actualCollectionPairs: entry.actualCollectionPairs,
      validOutput: entry.canonicalSchemaSuccess,
    })),
  );
  if (!computed.ok) {
    addIssue(context, 'semantic metrics invalid');
    return;
  }
  const exactChecks = report.caseEntries.filter((entry) => entry.exactHashCheck !== 'not_applicable');
  const exactPreserved = exactChecks.filter((entry) => entry.exactHashCheck === 'preserved').length;
  const exactRatio = exactChecks.length === 0 ? 0 : exactPreserved / exactChecks.length;
  const expectedMetrics = {
    baselineSemanticScore: PHASE_6_9_KNOWLEDGE_BASELINE_SEMANTIC_SCORE,
    ...computed.metrics,
    absoluteImprovement:
      computed.metrics.semanticScore - PHASE_6_9_KNOWLEDGE_BASELINE_SEMANTIC_SCORE,
    exactHashPrecision: exactRatio,
    exactHashRecall: exactRatio,
  };
  if (!sameJson(report.metrics, expectedMetrics)) addIssue(context, 'metrics mismatch');

  const expectedLatency = buildExpectedLatency(report.caseEntries, report.latency.endpointSamplesMs);
  if (
    expectedLatency.endpointSamplesMs.some(
      (value, index) =>
        value <
        Math.max(
          expectedLatency.dedupSamplesMs[index],
          expectedLatency.organizerSamplesMs[index],
        ),
    )
  ) {
    addIssue(context, 'endpoint latency below concurrent agent sample');
  }
  if (!sameJson(report.latency, expectedLatency)) addIssue(context, 'latency mismatch');

  const usages = runtime.flatMap((entry) => (entry.usage ? [entry.usage] : []));
  if (
    usages.some((usage) => {
      const expectedCost =
        (usage.inputTokens * 3 + usage.outputTokens * 6) / 1_000_000;
      return (
        Math.abs(usage.estimatedCostCny - expectedCost) > 1e-12 ||
        usage.estimatedCostCny > 0.03
      );
    })
  ) {
    addIssue(context, 'usage cost provenance mismatch');
  }
  const totalCost = usages.reduce((sum, usage) => sum + usage.estimatedCostCny, 0);
  const expectedUsage = {
    attemptedCases: 48 as const,
    verifiedCases: usages.length,
    inputTokens: usages.reduce((sum, usage) => sum + usage.inputTokens, 0),
    outputTokens: usages.reduce((sum, usage) => sum + usage.outputTokens, 0),
    pricingKnown: usages.length === 48,
    currency: 'CNY' as const,
    pricingProfile: usages.length === 48 ? PHASE_6_9_KNOWLEDGE_PRICING_PROFILE : null,
    totalCostCny: usages.length === 48 ? totalCost : null,
  };
  if (!sameJson(report.usage, expectedUsage)) addIssue(context, 'usage mismatch');

  const expectedSafety = {
    zeroCallVerified: report.caseEntries.filter((entry) => entry.zeroCallVerified).length,
    canonicalSchemaSuccesses: runtime.filter((entry) => entry.canonicalSchemaSuccess).length,
    criticalFailures: report.caseEntries.filter((entry) => entry.criticalFailure).length,
    permissionFailures: report.caseEntries.filter((entry) => entry.permissionFailure).length,
    mutationFailures: report.caseEntries.filter((entry) => entry.mutationFailure).length,
    broaderFallbacks: report.caseEntries.filter(
      (entry) => entry.broaderThanDeterministicFallback,
    ).length,
  };
  if (!sameJson(report.safety, expectedSafety)) addIssue(context, 'safety counters mismatch');
  if (report.gate !== computeKnowledgeGate(report)) addIssue(context, 'gate mismatch');
}

function buildExpectedLatency(
  entries: readonly KnowledgeAgentCaseEntry[],
  endpointSamplesMs: readonly number[],
) {
  const ordered = (agent: 'dedup' | 'organizer') =>
    entries
      .filter((entry) => entry.agent === agent && entry.pairedRunIndex !== null)
      .sort((left, right) => left.pairedRunIndex! - right.pairedRunIndex!)
      .map((entry) => entry.latencyMs!);
  const dedupSamplesMs = ordered('dedup');
  const organizerSamplesMs = ordered('organizer');
  return {
    dedupSamplesMs,
    organizerSamplesMs,
    endpointSamplesMs: [...endpointSamplesMs],
    dedupP95Ms: nearestRankP95(dedupSamplesMs)!,
    organizerP95Ms: nearestRankP95(organizerSamplesMs)!,
    endpointP95Ms: nearestRankP95(endpointSamplesMs)!,
  };
}

function sameStrings(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function samePairs(
  left: readonly (readonly [string, string])[],
  right: readonly (readonly [string, string])[],
) {
  return sameJson(left, right);
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(sortObjectKeys(left)) === JSON.stringify(sortObjectKeys(right));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}

function addIssue(context: z.RefinementCtx, message: string) {
  context.addIssue({ code: z.ZodIssueCode.custom, message });
}
