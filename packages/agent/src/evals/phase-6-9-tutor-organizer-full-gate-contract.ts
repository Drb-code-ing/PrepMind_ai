import { z } from 'zod';

import {
  PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY,
  PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256,
  PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256,
  PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256,
  PHASE_6_9_7_FULL_GATE_BASELINE_VERSION,
} from './phase-6-9-tutor-organizer-full-gate-baseline.ts';
import {
  PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES,
  PHASE_6_9_7_FULL_GATE_L2_ANCHOR_PAIR_INDEXES,
  PHASE_6_9_7_FULL_GATE_LINEAGE,
  PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256,
  PHASE_6_9_7_FULL_GATE_MANIFEST_VERSION,
  PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_SHA256,
  PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_VERSION,
  PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_SHA256,
  canonicalPhase697FullGateJson,
  computePhase697FullGateCanonicalSha256,
} from './phase-6-9-tutor-organizer-full-gate-manifest.ts';
import {
  buildTutorWrongQuestionSemanticMetrics,
  type OrganizerDecisionObservation,
  type TutorRuntimeObservation,
} from './phase-6-9-tutor-wrong-question-metrics.ts';
import {
  phase697V2OrganizerCases,
  phase697V2TutorCases,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';

export const PHASE_6_9_7_FULL_GATE_ENTRY_VERSION =
  'phase-6.9.7-tutor-organizer-full-gate-entry-v1' as const;
export const PHASE_6_9_7_FULL_GATE_REPORT_VERSION =
  'phase-6.9.7-tutor-organizer-full-gate-report-v1' as const;
export const PHASE_6_9_7_FULL_GATE_EVAL_POLICY_VERSION =
  'phase-6.9.7-tutor-organizer-full-gate-eval-policy-v1' as const;
export const PHASE_6_9_7_FULL_GATE_PRICING_PROFILE = 'deepseek-v4-pro-cny-2026-07-15' as const;
export const PHASE_6_9_7_FULL_GATE_L2_ANCHOR_MANIFEST_SHA256 =
  'ae667f1c086ef67d37e5e5570612a21850bca6b10f53ea85b607c150e84edf61' as const;

export const PHASE_6_9_7_FULL_GATE_SOURCE_HASHES = deepFreeze({
  tutorPromptSha256: '72fe93b2408a0b587c07cb4845159e009ef4a1bcd911a61b20b7677fb267d406',
  tutorSchemaSha256: '441793e5ce76b27e35661263ab0b843d77d12e74f40646fecc22e84f3e392f70',
  tutorMergerSha256: 'e2d181ae9b34740cd43c0070ad041ea0f06f647b0352a6cc4f1afc6f3721ba4a',
  organizerPromptSha256: 'edf716f0acdf0e6120726bd3af47470e8bb7838af0dae18882200dc40c1e64e9',
  organizerSchemaSha256: '5d6289bb34381868f1ed2996b8cbbf2a7ba775352ded5a7a115a76d12a5cbfa9',
  organizerMergerSha256: '752557a1a33fc610d3e62e8f7d23ba0f4aedf1c4ef57947d8682cd14dabbaa8d',
  adapterSha256: 'f275fb41a06c2980800979b1e522e964b56ab81fddb4eb820b01f611f60f2658',
} as const);

export const PHASE_6_9_7_FULL_GATE_EVAL_POLICY = deepFreeze({
  policyVersion: PHASE_6_9_7_FULL_GATE_EVAL_POLICY_VERSION,
  manifestSha256: PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256,
  baselineAuthoritySha256: PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256,
  counts: {
    guards: 24,
    tutorGuards: 12,
    organizerGuards: 12,
    runtimePairs: 24,
    runtimeLanes: 48,
    tutorRuntimeLanes: 24,
    organizerRuntimeLanes: 24,
    organizerDecisionUnits: 32,
  },
  model: {
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    thinking: false,
    structuredOutput: 'json_object',
    tools: false,
    retries: 0,
    executorProvenance: 'deepseek_network',
  },
  semantic: {
    tutorMin: 0.85,
    organizerMin: 0.85,
    combinedMin: 0.85,
    tutorBaseline: 0.6629642857142858,
    organizerBaseline: 0.278125,
    combinedBaseline: 0.4705446428571429,
    tutorAbsoluteImprovementMin: 0.15,
    organizerAbsoluteImprovementMin: 0.15,
  },
  l2AnchorSubset: {
    manifestSha256: PHASE_6_9_7_FULL_GATE_L2_ANCHOR_MANIFEST_SHA256,
    tutorBaseline: 0.7070238095238095,
    organizerBaseline: 0.2375,
    tutorMin: 0.85,
    organizerMin: 0.85,
    combinedMin: 0.85,
    tutorAbsoluteImprovementMin: 0.15,
    organizerAbsoluteImprovementMin: 0.15,
  },
  strict: {
    guardZeroCallRequired: 24,
    runtimeReservedRequired: 48,
    runtimeTerminalRequired: 48,
    runtimeOrphansMax: 0,
    runtimeNotStartedMax: 0,
    executorEnteredRequired: 48,
    providerDispatchStartedRequired: 48,
    providerResponseReceivedRequired: 48,
    verifiedUsageObservedRequired: 48,
    strictRuntimeSuccessRequired: 48,
  },
  safety: {
    invalidTutorCasesMax: 0,
    invalidOrganizerDecisionsMax: 0,
    criticalFailuresMax: 0,
    permissionFailuresMax: 0,
    mutationFailuresMax: 0,
    broaderFallbacksMax: 0,
    lockedNameChangesMax: 0,
    writeCommandLeaksMax: 0,
  },
  latency: {
    quantile: 0.95,
    nearestRankFormula: 'sorted[ceil(0.95*n)-1]',
    samplesPerSeries: 24,
    requiredNearestRankOneBased: 23,
    tutorCandidateP95MaxMs: 2_500,
    organizerCandidateP95MaxMs: 4_500,
    pairedCandidateP95MaxMs: 4_500,
    tutorOrchestrationP95MaxMs: 6_500,
    tutorHardTimeoutMs: 3_500,
    organizerHardTimeoutMs: 5_000,
    incompleteAggregateMustBeNull: true,
  },
  budget: {
    providerCallsMax: 48,
    inputTokensMax: 112_800,
    outputTokensMax: 26_400,
    totalCostCnyExclusiveMin: 0,
    totalCostCnyMax: 0.55,
    tutorPerLane: {
      callsMax: 1,
      inputTokensMax: 1_200,
      outputTokensMax: 300,
      costCnyMax: 0.006,
    },
    organizerPerLane: {
      callsMax: 1,
      inputTokensMax: 3_500,
      outputTokensMax: 800,
      costCnyMax: 0.016,
    },
    pricingProfile: PHASE_6_9_7_FULL_GATE_PRICING_PROFILE,
    inputCnyPerMillion: 3,
    outputCnyPerMillion: 6,
  },
  execution: {
    guardFirst: true,
    pairsSerial: true,
    laneConcurrencyMax: 2,
    siblingAbortControllersIndependent: true,
    semanticMismatchOpensBreaker: false,
    contractFailureOpensBreakerAfterPairTerminal: true,
    retry: 0,
    resume: 0,
    replay: 0,
    backfill: 0,
    incompleteAggregateMustBeNull: true,
  },
} as const);

export const PHASE_6_9_7_FULL_GATE_EVAL_POLICY_SHA256 = computePhase697FullGateCanonicalSha256(
  PHASE_6_9_7_FULL_GATE_EVAL_POLICY,
);
export const PHASE_6_9_7_FULL_GATE_FROZEN_EVAL_POLICY_SHA256 =
  '11371d1698cf3009bae243e93ffca802a004f4251e71d789ad4c5e5944baf503' as const;

if (PHASE_6_9_7_FULL_GATE_EVAL_POLICY_SHA256 !== PHASE_6_9_7_FULL_GATE_FROZEN_EVAL_POLICY_SHA256) {
  throw new Error('PHASE_6_9_7_FULL_GATE_EVAL_POLICY_SHA_MISMATCH');
}

export const PHASE_6_9_7_FULL_GATE_DISPOSITIONS = [
  'succeeded',
  'attempted_failed',
  'attempted_aborted',
  'not_started_guard',
  'not_started_quality_breaker',
  'not_started_external_abort',
] as const;

export const PHASE_6_9_7_FULL_GATE_FAILURE_CATEGORIES = [
  'none',
  'guard',
  'transport',
  'http',
  'timeout',
  'abort',
  'schema',
  'dynamic_authority',
  'usage',
  'pricing',
  'budget',
  'evidence',
  'quality_breaker',
  'external_abort',
  'internal',
] as const;

const commitSchema = z.string().regex(/^[0-9a-f]{40}$/);
const unitNumber = z.number().finite().min(0).max(1);
const finiteImprovement = z.number().finite().min(-1).max(1);
const nonNegativeFinite = z.number().finite().nonnegative();
const nonNegativeInteger = z.number().int().safe().nonnegative();
const positiveInteger = z.number().int().safe().positive();
const agentSchema = z.enum(['tutor', 'wrong_question_organizer']);
const tutorIntentSchema = z.enum([
  'explain_solution',
  'socratic_hint',
  'step_check',
  'concept_bridge',
  'general_follow_up',
]);
const tutorDepthSchema = z.enum(['brief', 'standard', 'deep']);
const tutorAnswerSectionSchema = z.enum([
  'known_conditions',
  'concept',
  'reasoning_steps',
  'common_mistake',
  'final_answer',
  'guiding_question',
]);
const organizerSubjectSchema = z.enum([
  'math',
  'english',
  'politics',
  'computer',
  'major',
  'other',
]);
const organizerDeckActionSchema = z.enum(['reuse_existing', 'create_topic']);
const organizerConfidenceSchema = z.enum(['medium', 'high']);
const organizerEvidenceCodeSchema = z.enum([
  'structured_subject',
  'semantic_topic',
  'existing_deck_overlap',
  'error_pattern',
  'insufficient_signal',
]);

export const PHASE_6_9_7_FULL_GATE_WIRE_SCHEMA = z
  .object({
    executorEntered: z.union([z.literal(0), z.literal(1)]),
    providerDispatchStarted: z.union([z.literal(0), z.literal(1)]),
    providerResponseReceived: z.union([z.literal(0), z.literal(1)]),
    verifiedUsageObserved: z.union([z.literal(0), z.literal(1)]),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.verifiedUsageObserved > value.providerResponseReceived ||
      value.providerResponseReceived > value.providerDispatchStarted ||
      value.providerDispatchStarted > value.executorEntered
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'wire_order_mismatch' });
    }
  });

const usageSchema = z
  .object({
    inputTokens: positiveInteger,
    outputTokens: positiveInteger,
    estimatedCostCny: nonNegativeFinite,
    pricingProfile: z.literal(PHASE_6_9_7_FULL_GATE_PRICING_PROFILE),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.estimatedCostCny !==
      calculatePhase697FullGateCostCny(value.inputTokens, value.outputTokens)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'usage_cost_mismatch' });
    }
  });

const safetySchema = z
  .object({
    criticalFailure: z.boolean(),
    permissionFailure: z.boolean(),
    mutationFailure: z.boolean(),
    broaderThanDeterministicFallback: z.boolean(),
    lockedNameChanged: z.boolean(),
    writeCommandLeaked: z.boolean(),
  })
  .strict();

const tutorObservationSchema = z
  .object({
    caseId: z.string().regex(/^tutor-v2-runtime-[0-9]{2}$/),
    expectedIntent: tutorIntentSchema,
    actualIntent: tutorIntentSchema.nullable(),
    expectedDepth: tutorDepthSchema,
    actualDepth: tutorDepthSchema.nullable(),
    expectedContextUse: z.boolean(),
    actualContextUse: z.boolean().nullable(),
    expectedGuidingQuestion: z.boolean(),
    actualGuidingQuestion: z.boolean().nullable(),
    expectedFinalAnswer: z.boolean(),
    actualFinalAnswer: z.boolean().nullable(),
    expectedAnswerStructure: z.array(tutorAnswerSectionSchema).max(6),
    actualAnswerStructure: z.array(tutorAnswerSectionSchema).max(6),
    validOutput: z.boolean(),
  })
  .strict();

const organizerObservationSchema = z
  .object({
    decisionId: z.string().regex(/^organizer-v2-runtime-[0-9]{2}:q[0-9]{1,2}$/),
    expectedSubject: organizerSubjectSchema,
    actualSubject: organizerSubjectSchema.nullable(),
    expectedDeckAction: organizerDeckActionSchema,
    actualDeckAction: organizerDeckActionSchema.nullable(),
    expectedDeckIndex: z.number().int().min(0).max(19).nullable(),
    actualDeckIndex: z.number().int().min(0).max(19).nullable(),
    canonicalTopicLabel: z.string().min(1).max(64),
    acceptedTopicLabels: z.array(z.string().min(1).max(64)).min(1).max(8),
    actualTopicLabel: z.string().min(1).max(64).nullable(),
    expectedConfidence: organizerConfidenceSchema,
    actualConfidence: organizerConfidenceSchema.nullable(),
    requiredEvidenceCodes: z.array(organizerEvidenceCodeSchema).max(5),
    allowedEvidenceCodes: z.array(organizerEvidenceCodeSchema).max(5),
    actualEvidenceCodes: z.array(organizerEvidenceCodeSchema).max(5),
    validOutput: z.boolean(),
  })
  .strict();

const semanticSchema = z.discriminatedUnion('agent', [
  z.object({ agent: z.literal('tutor'), observation: tutorObservationSchema }).strict(),
  z
    .object({
      agent: z.literal('wrong_question_organizer'),
      observations: z.array(organizerObservationSchema).min(1).max(3),
    })
    .strict(),
]);

const fullGateCaseEntryBaseSchema = z
  .object({
    entryVersion: z.literal(PHASE_6_9_7_FULL_GATE_ENTRY_VERSION),
    caseId: z.string().regex(/^(tutor|organizer)-v2-(zero|runtime)-[a-z0-9-]+$/),
    agent: agentSchema,
    executionKind: z.enum(['guard', 'runtime']),
    pairedRunIndex: z.number().int().min(0).max(23).nullable(),
    disposition: z.enum(PHASE_6_9_7_FULL_GATE_DISPOSITIONS),
    failureCategory: z.enum(PHASE_6_9_7_FULL_GATE_FAILURE_CATEGORIES),
    strictRuntimeSuccess: z.boolean(),
    zeroCallVerified: z.boolean(),
    wire: PHASE_6_9_7_FULL_GATE_WIRE_SCHEMA,
    durationMs: nonNegativeFinite.nullable(),
    orchestrationDurationMs: nonNegativeFinite.nullable(),
    usage: usageSchema.nullable(),
    semantic: semanticSchema.nullable(),
    safety: safetySchema,
  })
  .strict();

export type Phase697FullGateCaseEntry = z.infer<typeof fullGateCaseEntryBaseSchema>;

export const PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA = fullGateCaseEntryBaseSchema.superRefine(
  (value, context) => validateCaseEntry(value, context),
);

const sourceHashesSchema = z
  .object({
    tutorPromptSha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_HASHES.tutorPromptSha256),
    tutorSchemaSha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_HASHES.tutorSchemaSha256),
    tutorMergerSha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_HASHES.tutorMergerSha256),
    organizerPromptSha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_HASHES.organizerPromptSha256),
    organizerSchemaSha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_HASHES.organizerSchemaSha256),
    organizerMergerSha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_HASHES.organizerMergerSha256),
    adapterSha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_HASHES.adapterSha256),
  })
  .strict();

const runtimeAccountingSchema = z
  .object({
    reservedEntries: nonNegativeInteger.max(48),
    terminalEntries: nonNegativeInteger.max(48),
    orphanedEntries: z.literal(0),
    notStartedEntries: nonNegativeInteger.max(48),
  })
  .strict();

const wireAggregateSchema = z
  .object({
    complete: z.boolean(),
    executorEntered: nonNegativeInteger.max(48),
    providerDispatchStarted: nonNegativeInteger.max(48),
    providerResponseReceived: nonNegativeInteger.max(48),
    verifiedUsageObserved: nonNegativeInteger.max(48),
  })
  .strict();

const semanticAggregateSchema = z
  .object({
    complete: z.boolean(),
    tutorSemanticScore: unitNumber.nullable(),
    organizerSemanticScore: unitNumber.nullable(),
    combinedSemanticScore: unitNumber.nullable(),
    tutorAbsoluteImprovement: finiteImprovement.nullable(),
    organizerAbsoluteImprovement: finiteImprovement.nullable(),
    tutorInvalidCases: nonNegativeInteger.max(24).nullable(),
    organizerInvalidDecisions: nonNegativeInteger.max(32).nullable(),
    tutorFullMatches: nonNegativeInteger.max(24).nullable(),
    organizerFullMatches: nonNegativeInteger.max(32).nullable(),
  })
  .strict();

const anchorSafetySchema = z
  .object({
    criticalFailures: nonNegativeInteger.max(20),
    permissionFailures: nonNegativeInteger.max(20),
    mutationFailures: nonNegativeInteger.max(20),
    broaderFallbacks: nonNegativeInteger.max(20),
    lockedNameChanges: nonNegativeInteger.max(20),
    writeCommandLeaks: nonNegativeInteger.max(20),
  })
  .strict();

const anchorAggregateSchema = semanticAggregateSchema
  .extend({
    manifestSha256: z.literal(PHASE_6_9_7_FULL_GATE_L2_ANCHOR_MANIFEST_SHA256),
    runtimePairs: z.literal(8),
    runtimeLanes: z.literal(16),
    organizerDecisionUnits: z.literal(12),
    safety: anchorSafetySchema,
    passed: z.boolean(),
  })
  .strict();

const metricsAggregateSchema = semanticAggregateSchema
  .extend({
    strictRuntimeSuccesses: nonNegativeInteger.max(48),
    l2AnchorSubset: anchorAggregateSchema,
  })
  .strict();

const latencyAggregateSchema = z
  .object({
    complete: z.boolean(),
    tutorSampleCount: nonNegativeInteger.max(24),
    organizerSampleCount: nonNegativeInteger.max(24),
    pairedSampleCount: nonNegativeInteger.max(24),
    tutorOrchestrationSampleCount: nonNegativeInteger.max(24),
    tutorCandidateP95Ms: nonNegativeFinite.nullable(),
    organizerCandidateP95Ms: nonNegativeFinite.nullable(),
    pairedCandidateP95Ms: nonNegativeFinite.nullable(),
    tutorOrchestrationP95Ms: nonNegativeFinite.nullable(),
  })
  .strict();

const usageAggregateSchema = z
  .object({
    complete: z.boolean(),
    providerInvocations: nonNegativeInteger.max(48),
    verifiedRuntimeCases: nonNegativeInteger.max(48),
    inputTokens: nonNegativeInteger.nullable(),
    outputTokens: nonNegativeInteger.nullable(),
    estimatedCostCny: nonNegativeFinite.nullable(),
    pricingProfile: z.literal(PHASE_6_9_7_FULL_GATE_PRICING_PROFILE),
  })
  .strict();

const safetyAggregateSchema = z
  .object({
    guardVerifiedZeroCalls: nonNegativeInteger.max(24),
    criticalFailures: nonNegativeInteger.max(72),
    permissionFailures: nonNegativeInteger.max(72),
    mutationFailures: nonNegativeInteger.max(72),
    broaderFallbacks: nonNegativeInteger.max(72),
    lockedNameChanges: nonNegativeInteger.max(72),
    writeCommandLeaks: nonNegativeInteger.max(72),
  })
  .strict();

const breakerSchema = z
  .object({
    opened: z.boolean(),
    reason: z.enum(PHASE_6_9_7_FULL_GATE_FAILURE_CATEGORIES).nullable(),
  })
  .strict();

const fullGateReportBaseSchema = z
  .object({
    reportVersion: z.literal(PHASE_6_9_7_FULL_GATE_REPORT_VERSION),
    lineage: z.literal(PHASE_6_9_7_FULL_GATE_LINEAGE),
    runId: z.string().uuid(),
    runScope: z.enum(['branch', 'main']),
    mode: z.enum(['mock', 'live']),
    executorProvenance: z.enum(['deepseek_network', 'mock_synthetic', 'synthetic_test']),
    approvedRunnableSourceCommit: commitSchema,
    identities: z
      .object({
        manifestVersion: z.literal(PHASE_6_9_7_FULL_GATE_MANIFEST_VERSION),
        manifestSha256: z.literal(PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256),
        sourceDatasetVersion: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_VERSION),
        sourceDatasetSha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_SHA256),
        sourceEvalPolicySha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_SHA256),
        baselineVersion: z.literal(PHASE_6_9_7_FULL_GATE_BASELINE_VERSION),
        baselineAuthoritySha256: z.literal(PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256),
        baselineReportSha256: z.literal(PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256),
        baselineFileSha256: z.literal(PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256),
        evalPolicyVersion: z.literal(PHASE_6_9_7_FULL_GATE_EVAL_POLICY_VERSION),
        evalPolicySha256: z.literal(PHASE_6_9_7_FULL_GATE_EVAL_POLICY_SHA256),
        l2AnchorManifestSha256: z.literal(PHASE_6_9_7_FULL_GATE_L2_ANCHOR_MANIFEST_SHA256),
      })
      .strict(),
    sourceHashes: sourceHashesSchema,
    counts: z
      .object({
        cases: z.literal(72),
        guards: z.literal(24),
        runtimePairs: z.literal(24),
        runtimeLanes: z.literal(48),
        organizerDecisionUnits: z.literal(32),
      })
      .strict(),
    caseEntries: z.array(PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA).length(72),
    runtimeAccounting: runtimeAccountingSchema,
    wire: wireAggregateSchema,
    metrics: metricsAggregateSchema,
    latency: latencyAggregateSchema,
    usage: usageAggregateSchema,
    safety: safetyAggregateSchema,
    breaker: breakerSchema,
    gate: z.enum([
      'full_gate_mock_quality_not_evidence',
      'full_gate_quality_gate_passed',
      'full_gate_quality_gate_failed',
    ]),
    qualityAuthority: z.enum(['none', 'full_gate_semantic_gate']),
  })
  .strict();

export type Phase697FullGateReport = z.infer<typeof fullGateReportBaseSchema>;

export const PHASE_6_9_7_FULL_GATE_REPORT_SCHEMA = fullGateReportBaseSchema.superRefine(
  (value, context) => validateReport(value, context),
);

export type Phase697FullGateReportInput = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
  executorProvenance: 'deepseek_network' | 'mock_synthetic' | 'synthetic_test';
  approvedRunnableSourceCommit: string;
  caseEntries: readonly z.input<typeof PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA>[];
}>;

export function buildPhase697FullGateReport(
  input: Phase697FullGateReportInput,
): Readonly<Phase697FullGateReport> {
  if (isRejectedLineageToken(input.runId)) {
    throw new Error('PHASE_6_9_7_FULL_GATE_PRIOR_LINEAGE_REJECTED');
  }
  const entries = input.caseEntries.map((entry) =>
    PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA.parse(entry),
  );
  const derived = deriveAggregates(entries, input.mode, input.executorProvenance);
  return deepFreeze(
    PHASE_6_9_7_FULL_GATE_REPORT_SCHEMA.parse({
      reportVersion: PHASE_6_9_7_FULL_GATE_REPORT_VERSION,
      lineage: PHASE_6_9_7_FULL_GATE_LINEAGE,
      runId: input.runId,
      runScope: input.runScope,
      mode: input.mode,
      executorProvenance: input.executorProvenance,
      approvedRunnableSourceCommit: input.approvedRunnableSourceCommit,
      identities: {
        manifestVersion: PHASE_6_9_7_FULL_GATE_MANIFEST_VERSION,
        manifestSha256: PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256,
        sourceDatasetVersion: PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_VERSION,
        sourceDatasetSha256: PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_SHA256,
        sourceEvalPolicySha256: PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_SHA256,
        baselineVersion: PHASE_6_9_7_FULL_GATE_BASELINE_VERSION,
        baselineAuthoritySha256: PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256,
        baselineReportSha256: PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256,
        baselineFileSha256: PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256,
        evalPolicyVersion: PHASE_6_9_7_FULL_GATE_EVAL_POLICY_VERSION,
        evalPolicySha256: PHASE_6_9_7_FULL_GATE_EVAL_POLICY_SHA256,
        l2AnchorManifestSha256: PHASE_6_9_7_FULL_GATE_L2_ANCHOR_MANIFEST_SHA256,
      },
      sourceHashes: PHASE_6_9_7_FULL_GATE_SOURCE_HASHES,
      counts: {
        cases: 72,
        guards: 24,
        runtimePairs: 24,
        runtimeLanes: 48,
        organizerDecisionUnits: 32,
      },
      caseEntries: entries,
      ...derived,
    }),
  );
}

export function parsePhase697FullGateReport(
  value: unknown,
): Readonly<Phase697FullGateReport> | null {
  try {
    const cloned = JSON.parse(canonicalPhase697FullGateJson(value)) as unknown;
    if (containsRejectedLineage(cloned)) return null;
    const parsed = PHASE_6_9_7_FULL_GATE_REPORT_SCHEMA.safeParse(cloned);
    return parsed.success ? deepFreeze(parsed.data) : null;
  } catch {
    return null;
  }
}

export function calculatePhase697FullGateCostCny(
  inputTokens: number,
  outputTokens: number,
): number {
  if (
    !Number.isSafeInteger(inputTokens) ||
    inputTokens < 0 ||
    !Number.isSafeInteger(outputTokens) ||
    outputTokens < 0
  ) {
    throw new Error('PHASE_6_9_7_FULL_GATE_USAGE_INVALID');
  }
  return Number(
    (
      (inputTokens * PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.inputCnyPerMillion +
        outputTokens * PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.outputCnyPerMillion) /
      1_000_000
    ).toFixed(8),
  );
}

export function calculatePhase697FullGateNearestRankP95(values: readonly number[]): number {
  if (
    values.length !== PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.samplesPerSeries ||
    values.some((value) => !Number.isFinite(value) || value < 0)
  ) {
    throw new Error('PHASE_6_9_7_FULL_GATE_P95_INPUT_INVALID');
  }
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.ceil(PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.quantile * ordered.length) - 1;
  if (index !== PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.requiredNearestRankOneBased - 1) {
    throw new Error('PHASE_6_9_7_FULL_GATE_P95_RANK_INVALID');
  }
  return ordered[index] ?? 0;
}

function validateCaseEntry(value: Phase697FullGateCaseEntry, context: z.RefinementCtx) {
  const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
  const expected = PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES.find(
    (entry) => entry.caseId === value.caseId,
  );
  if (
    !expected ||
    value.agent !== expected.agent ||
    value.executionKind !== expected.kind ||
    value.pairedRunIndex !== expected.pairedRunIndex
  ) {
    issue('entry_manifest_identity_mismatch');
    return;
  }
  const wireZero = wireEquals(value.wire, 0);
  const wireFull = wireEquals(value.wire, 1);
  const safetyClear = safetyTotal(value.safety) === 0;
  if (value.usage !== null && value.wire.verifiedUsageObserved !== 1) {
    issue('usage_wire_mismatch');
  }
  if (
    value.wire.executorEntered === 0 &&
    (value.durationMs !== null || value.orchestrationDurationMs !== null)
  ) {
    issue('duration_wire_mismatch');
  }
  if (value.agent === 'wrong_question_organizer' && value.orchestrationDurationMs !== null) {
    issue('organizer_orchestration_duration_mismatch');
  }
  if (value.executionKind === 'guard') {
    const guardSuccess =
      value.disposition === 'not_started_guard' &&
      value.failureCategory === 'none' &&
      value.zeroCallVerified &&
      !value.strictRuntimeSuccess &&
      wireZero &&
      value.durationMs === null &&
      value.orchestrationDurationMs === null &&
      value.usage === null &&
      value.semantic === null &&
      safetyClear;
    const guardFailure =
      value.disposition === 'attempted_failed' &&
      value.failureCategory === 'guard' &&
      !value.zeroCallVerified &&
      !value.strictRuntimeSuccess &&
      value.semantic === null &&
      value.safety.criticalFailure;
    if (!guardSuccess && !guardFailure) issue('guard_entry_contract_mismatch');
    return;
  }
  if (value.zeroCallVerified) issue('runtime_zero_call_mismatch');
  if (value.disposition === 'not_started_guard' || value.failureCategory === 'guard') {
    issue('runtime_guard_identity_mismatch');
  }
  if (value.disposition === 'succeeded') {
    if (
      !value.strictRuntimeSuccess ||
      value.failureCategory !== 'none' ||
      !wireFull ||
      value.durationMs === null ||
      (value.agent === 'tutor' && value.orchestrationDurationMs === null) ||
      value.usage === null ||
      value.semantic === null ||
      !safetyClear ||
      !semanticMatchesEntry(value)
    ) {
      issue('runtime_success_contract_mismatch');
    }
    const laneBudget =
      value.agent === 'tutor'
        ? PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.tutorPerLane
        : PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.organizerPerLane;
    const hardTimeoutMs =
      value.agent === 'tutor'
        ? PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.tutorHardTimeoutMs
        : PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.organizerHardTimeoutMs;
    if (
      (value.durationMs ?? Number.POSITIVE_INFINITY) > hardTimeoutMs ||
      (value.usage?.inputTokens ?? Number.POSITIVE_INFINITY) > laneBudget.inputTokensMax ||
      (value.usage?.outputTokens ?? Number.POSITIVE_INFINITY) > laneBudget.outputTokensMax ||
      (value.usage?.estimatedCostCny ?? Number.POSITIVE_INFINITY) > laneBudget.costCnyMax
    ) {
      issue('runtime_lane_limit_mismatch');
    }
    return;
  }
  if (value.strictRuntimeSuccess || value.semantic !== null) {
    issue('runtime_failure_success_material_mismatch');
  }
  if (
    value.disposition === 'attempted_aborted' &&
    value.failureCategory !== 'abort' &&
    value.failureCategory !== 'external_abort'
  ) {
    issue('runtime_abort_category_mismatch');
  }
  if (
    value.disposition === 'attempted_failed' &&
    ['none', 'abort', 'quality_breaker', 'external_abort'].includes(value.failureCategory)
  ) {
    issue('runtime_failure_category_mismatch');
  }
  if (
    value.disposition === 'not_started_quality_breaker' &&
    (value.failureCategory !== 'quality_breaker' || !wireZero)
  ) {
    issue('runtime_quality_breaker_mismatch');
  }
  if (
    value.disposition === 'not_started_external_abort' &&
    (value.failureCategory !== 'external_abort' || !wireZero)
  ) {
    issue('runtime_external_abort_mismatch');
  }
  if (
    value.disposition.startsWith('not_started_') &&
    (value.durationMs !== null || value.orchestrationDurationMs !== null || value.usage !== null)
  ) {
    issue('runtime_not_started_evidence_mismatch');
  }
}

function validateReport(value: Phase697FullGateReport, context: z.RefinementCtx) {
  const expectedIds = PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES.map((entry) => entry.caseId);
  const actualIds = value.caseEntries.map((entry) => entry.caseId);
  const derived = deriveAggregates(value.caseEntries, value.mode, value.executorProvenance);
  if (
    canonicalPhase697FullGateJson(actualIds) !== canonicalPhase697FullGateJson(expectedIds) ||
    !schedulerMatches(value.caseEntries) ||
    canonicalPhase697FullGateJson(value.runtimeAccounting) !==
      canonicalPhase697FullGateJson(derived.runtimeAccounting) ||
    canonicalPhase697FullGateJson(value.wire) !== canonicalPhase697FullGateJson(derived.wire) ||
    canonicalPhase697FullGateJson(value.metrics) !==
      canonicalPhase697FullGateJson(derived.metrics) ||
    canonicalPhase697FullGateJson(value.latency) !==
      canonicalPhase697FullGateJson(derived.latency) ||
    canonicalPhase697FullGateJson(value.usage) !== canonicalPhase697FullGateJson(derived.usage) ||
    canonicalPhase697FullGateJson(value.safety) !== canonicalPhase697FullGateJson(derived.safety) ||
    canonicalPhase697FullGateJson(value.breaker) !==
      canonicalPhase697FullGateJson(derived.breaker) ||
    value.gate !== derived.gate ||
    value.qualityAuthority !== derived.qualityAuthority
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'derived_report_mismatch' });
  }
  if (
    (value.mode === 'mock' && value.executorProvenance !== 'mock_synthetic') ||
    (value.mode === 'live' && value.executorProvenance === 'mock_synthetic')
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'mode_provenance_mismatch' });
  }
  if (isRejectedLineageToken(value.runId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'prior_lineage_rejected' });
  }
}

function deriveAggregates(
  entries: readonly Phase697FullGateCaseEntry[],
  mode: 'mock' | 'live',
  executorProvenance: 'deepseek_network' | 'mock_synthetic' | 'synthetic_test',
) {
  const guards = entries.filter((entry) => entry.executionKind === 'guard');
  const runtime = entries.filter((entry) => entry.executionKind === 'runtime');
  const guardVerifiedZeroCalls = guards.filter(
    (entry) =>
      entry.disposition === 'not_started_guard' &&
      entry.zeroCallVerified &&
      wireEquals(entry.wire, 0),
  ).length;
  const strictRuntimeSuccesses = runtime.filter((entry) => entry.strictRuntimeSuccess).length;
  const runtimeComplete =
    runtime.length === 48 &&
    runtime.every(
      (entry) =>
        entry.disposition === 'succeeded' &&
        entry.strictRuntimeSuccess &&
        wireEquals(entry.wire, 1) &&
        entry.durationMs !== null &&
        (entry.agent !== 'tutor' || entry.orchestrationDurationMs !== null) &&
        entry.usage !== null &&
        entry.semantic !== null,
    );
  const fullSemantic = runtimeComplete
    ? buildSemanticAggregate(
        runtime,
        24,
        32,
        PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY.tutor.semanticScore,
        PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY.organizer.semanticScore,
      )
    : null;
  const anchorEntries = runtime.filter(
    (entry) =>
      entry.pairedRunIndex !== null &&
      PHASE_6_9_7_FULL_GATE_L2_ANCHOR_PAIR_INDEXES.includes(
        entry.pairedRunIndex as (typeof PHASE_6_9_7_FULL_GATE_L2_ANCHOR_PAIR_INDEXES)[number],
      ),
  );
  const anchorSemantic = runtimeComplete
    ? buildSemanticAggregate(
        anchorEntries,
        8,
        12,
        PHASE_6_9_7_FULL_GATE_EVAL_POLICY.l2AnchorSubset.tutorBaseline,
        PHASE_6_9_7_FULL_GATE_EVAL_POLICY.l2AnchorSubset.organizerBaseline,
      )
    : null;
  const formalComplete =
    guards.length === 24 &&
    guardVerifiedZeroCalls === 24 &&
    runtimeComplete &&
    fullSemantic !== null &&
    anchorSemantic !== null;
  const anchorSafety = aggregateAnchorSafety(anchorEntries);
  const anchorPassed =
    formalComplete &&
    anchorSemantic !== null &&
    semanticThresholdsPass(anchorSemantic, PHASE_6_9_7_FULL_GATE_EVAL_POLICY.l2AnchorSubset) &&
    Object.values(anchorSafety).every((count) => count === 0);
  const emptySemantic = emptySemanticAggregate();
  const metrics = {
    ...(formalComplete && fullSemantic !== null ? fullSemantic : emptySemantic),
    strictRuntimeSuccesses,
    l2AnchorSubset: {
      ...(formalComplete && anchorSemantic !== null ? anchorSemantic : emptySemantic),
      manifestSha256: PHASE_6_9_7_FULL_GATE_L2_ANCHOR_MANIFEST_SHA256,
      runtimePairs: 8 as const,
      runtimeLanes: 16 as const,
      organizerDecisionUnits: 12 as const,
      safety: anchorSafety,
      passed: anchorPassed,
    },
  };
  const tutorDurations = runtime
    .filter((entry) => entry.agent === 'tutor' && entry.durationMs !== null)
    .map((entry) => entry.durationMs as number);
  const organizerDurations = runtime
    .filter((entry) => entry.agent === 'wrong_question_organizer' && entry.durationMs !== null)
    .map((entry) => entry.durationMs as number);
  const tutorOrchestrationDurations = runtime
    .filter((entry) => entry.agent === 'tutor' && entry.orchestrationDurationMs !== null)
    .map((entry) => entry.orchestrationDurationMs as number);
  const pairedDurations = PHASE_6_9_7_FULL_GATE_MANIFEST_PAIR_INDEXES.flatMap((pairedRunIndex) => {
    const pair = runtime.filter((entry) => entry.pairedRunIndex === pairedRunIndex);
    return pair.length === 2 && pair.every((entry) => entry.durationMs !== null)
      ? [Math.max(...pair.map((entry) => entry.durationMs as number))]
      : [];
  });
  const latency = {
    complete: formalComplete,
    tutorSampleCount: tutorDurations.length,
    organizerSampleCount: organizerDurations.length,
    pairedSampleCount: pairedDurations.length,
    tutorOrchestrationSampleCount: tutorOrchestrationDurations.length,
    tutorCandidateP95Ms: formalComplete
      ? calculatePhase697FullGateNearestRankP95(tutorDurations)
      : null,
    organizerCandidateP95Ms: formalComplete
      ? calculatePhase697FullGateNearestRankP95(organizerDurations)
      : null,
    pairedCandidateP95Ms: formalComplete
      ? calculatePhase697FullGateNearestRankP95(pairedDurations)
      : null,
    tutorOrchestrationP95Ms: formalComplete
      ? calculatePhase697FullGateNearestRankP95(tutorOrchestrationDurations)
      : null,
  };
  const verifiedRuntime = runtime.filter(
    (entry) => entry.usage !== null && entry.wire.verifiedUsageObserved === 1,
  );
  const inputTokens = formalComplete
    ? verifiedRuntime.reduce((total, entry) => total + (entry.usage?.inputTokens ?? 0), 0)
    : null;
  const outputTokens = formalComplete
    ? verifiedRuntime.reduce((total, entry) => total + (entry.usage?.outputTokens ?? 0), 0)
    : null;
  const estimatedCostCny = formalComplete
    ? Number(
        verifiedRuntime
          .reduce((total, entry) => total + (entry.usage?.estimatedCostCny ?? 0), 0)
          .toFixed(8),
      )
    : null;
  const usage = {
    complete: formalComplete,
    providerInvocations: runtime.reduce(
      (sum, entry) => sum + entry.wire.providerDispatchStarted,
      0,
    ),
    verifiedRuntimeCases: verifiedRuntime.length,
    inputTokens,
    outputTokens,
    estimatedCostCny,
    pricingProfile: PHASE_6_9_7_FULL_GATE_PRICING_PROFILE,
  };
  const attempted = runtime.filter((entry) => isAttemptedTerminal(entry.disposition));
  const runtimeAccounting = {
    reservedEntries: attempted.length,
    terminalEntries: attempted.length,
    orphanedEntries: 0 as const,
    notStartedEntries: runtime.length - attempted.length,
  };
  const wire = {
    complete: runtime.length === 48 && runtime.every((entry) => wireEquals(entry.wire, 1)),
    executorEntered: runtime.reduce((sum, entry) => sum + entry.wire.executorEntered, 0),
    providerDispatchStarted: runtime.reduce(
      (sum, entry) => sum + entry.wire.providerDispatchStarted,
      0,
    ),
    providerResponseReceived: runtime.reduce(
      (sum, entry) => sum + entry.wire.providerResponseReceived,
      0,
    ),
    verifiedUsageObserved: runtime.reduce(
      (sum, entry) => sum + entry.wire.verifiedUsageObserved,
      0,
    ),
  };
  const safety = aggregateSafety(entries, guardVerifiedZeroCalls);
  const firstFailure = entries.find(
    (entry) =>
      (entry.executionKind === 'guard' && !entry.zeroCallVerified) ||
      (entry.executionKind === 'runtime' && entry.disposition !== 'succeeded'),
  );
  const breaker = {
    opened: firstFailure !== undefined,
    reason: firstFailure?.failureCategory ?? null,
  };
  const semanticPass =
    formalComplete &&
    fullSemantic !== null &&
    semanticThresholdsPass(fullSemantic, PHASE_6_9_7_FULL_GATE_EVAL_POLICY.semantic) &&
    anchorPassed;
  const strictPass =
    runtimeAccounting.reservedEntries === 48 &&
    runtimeAccounting.terminalEntries === 48 &&
    runtimeAccounting.orphanedEntries === 0 &&
    runtimeAccounting.notStartedEntries === 0 &&
    wire.executorEntered === 48 &&
    wire.providerDispatchStarted === 48 &&
    wire.providerResponseReceived === 48 &&
    wire.verifiedUsageObserved === 48 &&
    strictRuntimeSuccesses === 48;
  const safetyPass =
    safety.guardVerifiedZeroCalls === 24 &&
    safety.criticalFailures === 0 &&
    safety.permissionFailures === 0 &&
    safety.mutationFailures === 0 &&
    safety.broaderFallbacks === 0 &&
    safety.lockedNameChanges === 0 &&
    safety.writeCommandLeaks === 0;
  const latencyPass =
    latency.tutorCandidateP95Ms !== null &&
    latency.tutorCandidateP95Ms <=
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.tutorCandidateP95MaxMs &&
    latency.organizerCandidateP95Ms !== null &&
    latency.organizerCandidateP95Ms <=
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.organizerCandidateP95MaxMs &&
    latency.pairedCandidateP95Ms !== null &&
    latency.pairedCandidateP95Ms <=
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.pairedCandidateP95MaxMs &&
    latency.tutorOrchestrationP95Ms !== null &&
    latency.tutorOrchestrationP95Ms <=
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.tutorOrchestrationP95MaxMs;
  const budgetPass =
    usage.providerInvocations === 48 &&
    inputTokens !== null &&
    outputTokens !== null &&
    estimatedCostCny !== null &&
    inputTokens <= PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.inputTokensMax &&
    outputTokens <= PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.outputTokensMax &&
    estimatedCostCny > PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.totalCostCnyExclusiveMin &&
    estimatedCostCny <= PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.totalCostCnyMax;
  const livePass =
    formalComplete &&
    semanticPass &&
    strictPass &&
    safetyPass &&
    latencyPass &&
    budgetPass &&
    executorProvenance === 'deepseek_network';
  const gate =
    mode === 'mock'
      ? ('full_gate_mock_quality_not_evidence' as const)
      : livePass
        ? ('full_gate_quality_gate_passed' as const)
        : ('full_gate_quality_gate_failed' as const);
  const qualityAuthority = livePass ? ('full_gate_semantic_gate' as const) : ('none' as const);
  return {
    runtimeAccounting,
    wire,
    metrics,
    latency,
    usage,
    safety,
    breaker,
    gate,
    qualityAuthority,
  };
}

const PHASE_6_9_7_FULL_GATE_MANIFEST_PAIR_INDEXES = Array.from({ length: 24 }, (_, index) => index);

function buildSemanticAggregate(
  entries: readonly Phase697FullGateCaseEntry[],
  expectedTutorCases: number,
  expectedOrganizerDecisions: number,
  tutorBaseline: number,
  organizerBaseline: number,
) {
  const tutorObservations = entries.flatMap((entry) =>
    entry.semantic?.agent === 'tutor' ? [entry.semantic.observation] : [],
  );
  const organizerObservations = entries.flatMap((entry) =>
    entry.semantic?.agent === 'wrong_question_organizer' ? entry.semantic.observations : [],
  );
  if (
    tutorObservations.length !== expectedTutorCases ||
    organizerObservations.length !== expectedOrganizerDecisions
  ) {
    return null;
  }
  const result = buildTutorWrongQuestionSemanticMetrics(tutorObservations, organizerObservations);
  if (!result.ok) return null;
  return {
    complete: true,
    tutorSemanticScore: result.metrics.tutor.semanticScore,
    organizerSemanticScore: result.metrics.organizer.semanticScore,
    combinedSemanticScore: result.metrics.combinedSemanticScore,
    tutorAbsoluteImprovement: result.metrics.tutor.semanticScore - tutorBaseline,
    organizerAbsoluteImprovement: result.metrics.organizer.semanticScore - organizerBaseline,
    tutorInvalidCases: result.metrics.tutor.invalidCases,
    organizerInvalidDecisions: result.metrics.organizer.invalidDecisions,
    tutorFullMatches: tutorObservations.filter(tutorObservationMatches).length,
    organizerFullMatches: organizerObservations.filter(organizerObservationMatches).length,
  };
}

function emptySemanticAggregate() {
  return {
    complete: false,
    tutorSemanticScore: null,
    organizerSemanticScore: null,
    combinedSemanticScore: null,
    tutorAbsoluteImprovement: null,
    organizerAbsoluteImprovement: null,
    tutorInvalidCases: null,
    organizerInvalidDecisions: null,
    tutorFullMatches: null,
    organizerFullMatches: null,
  };
}

function semanticThresholdsPass(
  aggregate: NonNullable<ReturnType<typeof buildSemanticAggregate>>,
  policy: Readonly<{
    tutorMin: number;
    organizerMin: number;
    combinedMin: number;
    tutorAbsoluteImprovementMin: number;
    organizerAbsoluteImprovementMin: number;
  }>,
) {
  return (
    aggregate.tutorSemanticScore >= policy.tutorMin &&
    aggregate.organizerSemanticScore >= policy.organizerMin &&
    aggregate.combinedSemanticScore >= policy.combinedMin &&
    aggregate.tutorAbsoluteImprovement >= policy.tutorAbsoluteImprovementMin &&
    aggregate.organizerAbsoluteImprovement >= policy.organizerAbsoluteImprovementMin &&
    aggregate.tutorInvalidCases === 0 &&
    aggregate.organizerInvalidDecisions === 0
  );
}

function schedulerMatches(entries: readonly Phase697FullGateCaseEntry[]) {
  const guards = entries.filter((entry) => entry.executionKind === 'guard');
  const runtime = entries.filter((entry) => entry.executionKind === 'runtime');
  if (guards.length !== 24 || runtime.length !== 48) return false;
  const guardFailed = guards.some(
    (entry) =>
      entry.disposition !== 'not_started_guard' ||
      !entry.zeroCallVerified ||
      !wireEquals(entry.wire, 0),
  );
  if (guardFailed) {
    return runtime.every(
      (entry) =>
        entry.disposition === 'not_started_quality_breaker' &&
        entry.failureCategory === 'quality_breaker',
    );
  }
  let terminalMode: 'quality_breaker' | 'external_abort' | null = null;
  for (const pairedRunIndex of PHASE_6_9_7_FULL_GATE_MANIFEST_PAIR_INDEXES) {
    const pair = runtime.filter((entry) => entry.pairedRunIndex === pairedRunIndex);
    if (pair.length !== 2) return false;
    if (terminalMode !== null) {
      const expectedDisposition =
        terminalMode === 'quality_breaker'
          ? 'not_started_quality_breaker'
          : 'not_started_external_abort';
      if (
        !pair.every(
          (entry) =>
            entry.disposition === expectedDisposition && entry.failureCategory === terminalMode,
        )
      ) {
        return false;
      }
      continue;
    }
    if (
      pair.every(
        (entry) =>
          entry.disposition === 'not_started_external_abort' &&
          entry.failureCategory === 'external_abort',
      )
    ) {
      terminalMode = 'external_abort';
      continue;
    }
    if (!pair.every((entry) => isAttemptedTerminal(entry.disposition))) return false;
    const failed = pair.filter((entry) => entry.disposition !== 'succeeded');
    if (failed.length === 0) continue;
    terminalMode =
      failed.every(
        (entry) => entry.failureCategory === 'abort' || entry.failureCategory === 'external_abort',
      ) && failed.some((entry) => entry.failureCategory === 'external_abort')
        ? 'external_abort'
        : 'quality_breaker';
  }
  return true;
}

function isAttemptedTerminal(disposition: Phase697FullGateCaseEntry['disposition']) {
  return (
    disposition === 'succeeded' ||
    disposition === 'attempted_failed' ||
    disposition === 'attempted_aborted'
  );
}

function semanticMatchesEntry(entry: Phase697FullGateCaseEntry) {
  if (entry.semantic?.agent !== entry.agent) return false;
  if (entry.semantic.agent === 'tutor') {
    const observation = entry.semantic.observation;
    const source = phase697V2TutorCases.find((testCase) => testCase.id === entry.caseId);
    return (
      source?.expectedRuntimeInvocations === 1 &&
      observation.caseId === entry.caseId &&
      observation.expectedIntent === source.expected.intent &&
      observation.expectedDepth === source.expected.depth &&
      observation.expectedContextUse === source.expected.contextUse &&
      observation.expectedGuidingQuestion === source.expected.guidingQuestion &&
      observation.expectedFinalAnswer === source.expected.finalAnswer &&
      sameOrderedValues(observation.expectedAnswerStructure, source.expected.answerStructure) &&
      observation.validOutput &&
      observation.actualIntent !== null &&
      observation.actualDepth !== null &&
      observation.actualContextUse !== null &&
      observation.actualGuidingQuestion !== null &&
      observation.actualFinalAnswer !== null
    );
  }
  const source = phase697V2OrganizerCases.find((testCase) => testCase.id === entry.caseId);
  if (
    source?.expectedRuntimeInvocations !== 1 ||
    entry.semantic.observations.length !== source.expected.decisions.length
  ) {
    return false;
  }
  return entry.semantic.observations.every((observation, index) => {
    const expected = source.expected.decisions[index];
    return (
      expected !== undefined &&
      observation.decisionId === `${entry.caseId}:q${expected.questionIndex}` &&
      observation.expectedSubject === expected.subject &&
      observation.expectedDeckAction === expected.deckAction &&
      observation.expectedDeckIndex === (expected.deckIndex ?? null) &&
      observation.canonicalTopicLabel === expected.canonicalTopicLabel &&
      sameOrderedValues(observation.acceptedTopicLabels, expected.acceptedTopicLabels) &&
      observation.expectedConfidence === expected.confidence &&
      sameOrderedValues(observation.requiredEvidenceCodes, expected.requiredEvidenceCodes) &&
      sameOrderedValues(observation.allowedEvidenceCodes, expected.allowedEvidenceCodes) &&
      observation.validOutput &&
      observation.actualSubject !== null &&
      observation.actualDeckAction !== null &&
      observation.actualTopicLabel !== null &&
      observation.actualConfidence !== null
    );
  });
}

function tutorObservationMatches(observation: TutorRuntimeObservation) {
  return (
    observation.validOutput &&
    observation.actualIntent === observation.expectedIntent &&
    observation.actualDepth === observation.expectedDepth &&
    observation.actualContextUse === observation.expectedContextUse &&
    observation.actualGuidingQuestion === observation.expectedGuidingQuestion &&
    observation.actualFinalAnswer === observation.expectedFinalAnswer &&
    sameOrderedValues(observation.actualAnswerStructure, observation.expectedAnswerStructure)
  );
}

function organizerObservationMatches(observation: OrganizerDecisionObservation) {
  if (
    !observation.validOutput ||
    observation.actualSubject !== observation.expectedSubject ||
    observation.actualDeckAction !== observation.expectedDeckAction ||
    (observation.expectedDeckAction === 'reuse_existing' &&
      observation.actualDeckIndex !== observation.expectedDeckIndex) ||
    observation.actualTopicLabel === null ||
    observation.actualConfidence !== observation.expectedConfidence
  ) {
    return false;
  }
  const actualTopic = normalizeLabel(observation.actualTopicLabel);
  if (!observation.acceptedTopicLabels.map(normalizeLabel).includes(actualTopic)) return false;
  const actualEvidence = new Set(observation.actualEvidenceCodes);
  const allowedEvidence = new Set(observation.allowedEvidenceCodes);
  return (
    observation.requiredEvidenceCodes.every((code) => actualEvidence.has(code)) &&
    observation.actualEvidenceCodes.every((code) => allowedEvidence.has(code))
  );
}

function aggregateSafety(entries: readonly Phase697FullGateCaseEntry[], guardCount: number) {
  return {
    guardVerifiedZeroCalls: guardCount,
    criticalFailures: entries.filter((entry) => entry.safety.criticalFailure).length,
    permissionFailures: entries.filter((entry) => entry.safety.permissionFailure).length,
    mutationFailures: entries.filter((entry) => entry.safety.mutationFailure).length,
    broaderFallbacks: entries.filter((entry) => entry.safety.broaderThanDeterministicFallback)
      .length,
    lockedNameChanges: entries.filter((entry) => entry.safety.lockedNameChanged).length,
    writeCommandLeaks: entries.filter((entry) => entry.safety.writeCommandLeaked).length,
  };
}

function aggregateAnchorSafety(entries: readonly Phase697FullGateCaseEntry[]) {
  return {
    criticalFailures: entries.filter((entry) => entry.safety.criticalFailure).length,
    permissionFailures: entries.filter((entry) => entry.safety.permissionFailure).length,
    mutationFailures: entries.filter((entry) => entry.safety.mutationFailure).length,
    broaderFallbacks: entries.filter((entry) => entry.safety.broaderThanDeterministicFallback)
      .length,
    lockedNameChanges: entries.filter((entry) => entry.safety.lockedNameChanged).length,
    writeCommandLeaks: entries.filter((entry) => entry.safety.writeCommandLeaked).length,
  };
}

function wireEquals(wire: z.infer<typeof PHASE_6_9_7_FULL_GATE_WIRE_SCHEMA>, value: 0 | 1) {
  return Object.values(wire).every((counter) => counter === value);
}

function safetyTotal(safety: z.infer<typeof safetySchema>) {
  return Object.values(safety).filter(Boolean).length;
}

function containsRejectedLineage(value: unknown): boolean {
  return walkStrings(value).some(isRejectedLineageToken);
}

function walkStrings(value: unknown): readonly string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(walkStrings);
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...walkStrings(child)]);
}

const PRIOR_SEALED_RUN_IDS = new Set([
  '39a62241-0f51-45be-a423-0d13b0b60ae4',
  '67ce18dd-e2ed-4a05-8507-2a98898b8ede',
  'ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc',
  '0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f',
  'aa637d3a-f7c4-4549-a724-9cdbefdd89c8',
  'b18a0a13-a2a0-4cb0-8f9c-296271c0dfa8',
  '81529c2c-79f5-4c21-9cee-e536a2fe78e3',
  '7ff09c36-50f2-445a-b309-dc9500e5e13c',
  'c530ca02-3ece-4f11-898c-5695c8252bd5',
  '253a5df5-c443-4950-b517-849efb941728',
  'dc09214c-0300-4153-8273-e548ac768d20',
  '6918df4f-a4ae-4de0-aa21-c7614ed5861d',
]);

function isRejectedLineageToken(value: string) {
  const normalized = value.toLowerCase();
  if (PRIOR_SEALED_RUN_IDS.has(normalized)) return true;
  if (
    normalized.includes('phase-6.9.7-architecture-recovery-') ||
    normalized.includes('phase-6-9-7-architecture-recovery-') ||
    normalized.includes('phase-6.9.7-tutor-organizer-small-sample-') ||
    normalized.includes('phase-6-9-7-tutor-organizer-small-sample-') ||
    normalized.includes('i_authorize_phase_6_9_7_architecture_recovery') ||
    normalized.includes('i_authorize_phase_6_9_7_tutor_organizer_small_sample')
  ) {
    return true;
  }
  return Array.from({ length: 9 }, (_, index) => index + 1).some(
    (version) =>
      normalized.includes(`phase-6.9.7-tutor-organizer-runner-v${version}`) ||
      normalized.includes(`phase-6.9.7-v${version}-`) ||
      normalized.includes(`phase-6-9-7-tutor-organizer-v${version}`) ||
      normalized.includes(`i_accept_phase_6_9_7_tutor_organizer_v${version}`) ||
      normalized.includes(`i_authorize_phase_6_9_7_tutor_organizer_v${version}`),
  );
}

function sameOrderedValues<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeLabel(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
