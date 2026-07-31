import { z } from 'zod';

import {
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY,
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_VERSION,
} from './phase-6-9-tutor-organizer-small-sample-baseline.ts';
import {
  buildTutorWrongQuestionSemanticMetrics,
  type OrganizerDecisionObservation,
  type TutorRuntimeObservation,
} from './phase-6-9-tutor-wrong-question-metrics.ts';
import {
  phase697V2OrganizerCases,
  phase697V2TutorCases,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES,
  PHASE_6_9_7_SMALL_SAMPLE_LINEAGE,
  PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_VERSION,
  PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_VERSION,
  PHASE_6_9_7_SMALL_SAMPLE_SOURCE_EVAL_POLICY_SHA256,
  canonicalPhase697SmallSampleJson,
  computePhase697SmallSampleCanonicalSha256,
} from './phase-6-9-tutor-organizer-small-sample-manifest.ts';

export const PHASE_6_9_7_SMALL_SAMPLE_ENTRY_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-entry-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_REPORT_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-report-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-eval-policy-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_PRICING_PROFILE = 'deepseek-v4-pro-cny-2026-07-15' as const;

export const PHASE_6_9_7_SMALL_SAMPLE_DISPOSITIONS = [
  'succeeded',
  'attempted_failed',
  'attempted_aborted',
  'not_started_guard',
  'not_started_quality_breaker',
  'not_started_external_abort',
] as const;

export const PHASE_6_9_7_SMALL_SAMPLE_FAILURE_CATEGORIES = [
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

export const PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY = deepFreeze({
  version: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY_VERSION,
  lineage: PHASE_6_9_7_SMALL_SAMPLE_LINEAGE,
  manifest: {
    version: PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_VERSION,
    sha256: PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256,
    sourceDatasetVersion: PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_VERSION,
    sourceDatasetSha256: PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_SHA256,
    sourceEvalPolicySha256: PHASE_6_9_7_SMALL_SAMPLE_SOURCE_EVAL_POLICY_SHA256,
  },
  baseline: {
    version: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_VERSION,
    reportSha256: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SHA256,
    tutorSemanticScore: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY.tutor.semanticScore,
    organizerSemanticScore: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY.organizer.semanticScore,
  },
  counts: {
    guards: 8,
    runtimePairs: 8,
    runtimeLanes: 16,
    tutorRuntimeCases: 8,
    organizerRuntimeCases: 8,
    organizerDecisionUnits: 12,
  },
  quality: {
    strictRuntimeSuccesses: 16,
    semanticScoreMin: 0.85,
    tutorAbsoluteImprovementMin: 0.15,
    organizerAbsoluteImprovementMin: 0.15,
    invalidCasesMax: 0,
    invalidDecisionsMax: 0,
  },
  safety: {
    verifiedZeroCalls: 8,
    criticalFailuresMax: 0,
    permissionFailuresMax: 0,
    mutationFailuresMax: 0,
    broaderFallbacksMax: 0,
    lockedNameChangesMax: 0,
    writeCommandLeaksMax: 0,
  },
  latency: {
    tutorHardTimeoutMs: 3_500,
    organizerHardTimeoutMs: 5_000,
    sampleCountPerAgent: 8,
    p95: null,
    p95Reason: 'insufficient_sample_size_8',
    aggregates: ['median', 'max'],
    incompleteAggregateMustBeNull: true,
  },
  pricing: {
    profile: PHASE_6_9_7_SMALL_SAMPLE_PRICING_PROFILE,
    inputCnyPerMillion: 3,
    outputCnyPerMillion: 6,
    precisionDecimals: 8,
  },
  laneBudget: {
    tutor: { calls: 1, inputTokensMax: 1_200, outputTokensMax: 300, cnyMax: 0.006 },
    wrongQuestionOrganizer: {
      calls: 1,
      inputTokensMax: 3_500,
      outputTokensMax: 800,
      cnyMax: 0.016,
    },
  },
  budget: {
    providerCallsMax: 16,
    inputTokensMax: 37_600,
    outputTokensMax: 8_800,
    perPairCnyMax: 0.022,
    runCnyMax: 0.176,
  },
  wire: {
    denominator: 16,
    executorEntered: 16,
    providerDispatchStarted: 16,
    providerResponseReceived: 16,
    verifiedUsageObserved: 16,
    guardsExcludedFromDenominator: true,
  },
  scheduler: {
    guardFirst: true,
    pairSerial: true,
    lanesPerPairMax: 2,
    siblingAbortControllersIndependent: true,
    semanticMismatchOpensBreaker: false,
    firstRuntimeContractFailureOpensBreaker: true,
    retry: false,
    resume: false,
    replay: false,
    backfill: false,
  },
  incompleteFormalAggregates: 'null',
  executorProvenanceRequiredForLivePass: 'deepseek_network',
});

export const PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY_SHA256 =
  computePhase697SmallSampleCanonicalSha256(PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY);
export const PHASE_6_9_7_SMALL_SAMPLE_FROZEN_EVAL_POLICY_SHA256 =
  '1cab7786af49a6a6111927f3849b283e9e9c1c143eea6d4fecfd7adb02bf399a' as const;

if (
  PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY_SHA256 !== PHASE_6_9_7_SMALL_SAMPLE_FROZEN_EVAL_POLICY_SHA256
) {
  throw new Error('PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY_SHA_MISMATCH');
}

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const commitSchema = z.string().regex(/^[0-9a-f]{40}$/);
const unitNumber = z.number().finite().min(0).max(1);
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

export const PHASE_6_9_7_SMALL_SAMPLE_WIRE_SCHEMA = z
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
    pricingProfile: z.literal(PHASE_6_9_7_SMALL_SAMPLE_PRICING_PROFILE),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.estimatedCostCny !==
      calculatePhase697SmallSampleCostCny(value.inputTokens, value.outputTokens)
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

export const PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA = z
  .object({
    entryVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_ENTRY_VERSION),
    caseId: z.string().regex(/^(tutor|organizer)-v2-(zero|runtime)-[a-z0-9-]+$/),
    agent: agentSchema,
    executionKind: z.enum(['guard', 'runtime']),
    pairedRunIndex: z.number().int().min(0).max(23).nullable(),
    disposition: z.enum(PHASE_6_9_7_SMALL_SAMPLE_DISPOSITIONS),
    failureCategory: z.enum(PHASE_6_9_7_SMALL_SAMPLE_FAILURE_CATEGORIES),
    strictRuntimeSuccess: z.boolean(),
    zeroCallVerified: z.boolean(),
    wire: PHASE_6_9_7_SMALL_SAMPLE_WIRE_SCHEMA,
    durationMs: nonNegativeFinite.nullable(),
    usage: usageSchema.nullable(),
    semantic: semanticSchema.nullable(),
    safety: safetySchema,
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
    const expected = PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.find(
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
    if (value.wire.executorEntered === 0 && value.durationMs !== null) {
      issue('duration_wire_mismatch');
    }
    if (value.executionKind === 'guard') {
      const guardSuccess =
        value.disposition === 'not_started_guard' &&
        value.failureCategory === 'none' &&
        value.zeroCallVerified &&
        !value.strictRuntimeSuccess &&
        wireZero &&
        value.durationMs === null &&
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
        value.usage === null ||
        value.semantic === null ||
        !safetyClear ||
        !semanticMatchesEntry(value)
      ) {
        issue('runtime_success_contract_mismatch');
      }
      if (value.agent === 'tutor') {
        if (
          (value.durationMs ?? Number.POSITIVE_INFINITY) >
            PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.tutorHardTimeoutMs ||
          (value.usage?.inputTokens ?? Number.POSITIVE_INFINITY) >
            PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.laneBudget.tutor.inputTokensMax ||
          (value.usage?.outputTokens ?? Number.POSITIVE_INFINITY) >
            PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.laneBudget.tutor.outputTokensMax ||
          (value.usage?.estimatedCostCny ?? Number.POSITIVE_INFINITY) >
            PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.laneBudget.tutor.cnyMax
        ) {
          issue('tutor_lane_budget_mismatch');
        }
      } else if (
        (value.durationMs ?? Number.POSITIVE_INFINITY) >
          PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.organizerHardTimeoutMs ||
        (value.usage?.inputTokens ?? Number.POSITIVE_INFINITY) >
          PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.laneBudget.wrongQuestionOrganizer.inputTokensMax ||
        (value.usage?.outputTokens ?? Number.POSITIVE_INFINITY) >
          PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.laneBudget.wrongQuestionOrganizer.outputTokensMax ||
        (value.usage?.estimatedCostCny ?? Number.POSITIVE_INFINITY) >
          PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.laneBudget.wrongQuestionOrganizer.cnyMax
      ) {
        issue('organizer_lane_budget_mismatch');
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
      (value.durationMs !== null || value.usage !== null)
    ) {
      issue('runtime_not_started_evidence_mismatch');
    }
  });

export type Phase697SmallSampleCaseEntry = z.infer<
  typeof PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA
>;

const sourceHashesSchema = z
  .object({
    tutorPromptSha256: sha256Schema,
    tutorSchemaSha256: sha256Schema,
    tutorMergerSha256: sha256Schema,
    organizerPromptSha256: sha256Schema,
    organizerSchemaSha256: sha256Schema,
    organizerMergerSha256: sha256Schema,
    adapterSha256: sha256Schema,
  })
  .strict();

const limitsSchema = z
  .object({
    pricing: z
      .object({
        profile: z.literal(PHASE_6_9_7_SMALL_SAMPLE_PRICING_PROFILE),
        inputCnyPerMillion: z.literal(3),
        outputCnyPerMillion: z.literal(6),
        precisionDecimals: z.literal(8),
      })
      .strict(),
    laneBudget: z
      .object({
        tutor: z
          .object({
            calls: z.literal(1),
            inputTokensMax: z.literal(1_200),
            outputTokensMax: z.literal(300),
            cnyMax: z.literal(0.006),
          })
          .strict(),
        wrongQuestionOrganizer: z
          .object({
            calls: z.literal(1),
            inputTokensMax: z.literal(3_500),
            outputTokensMax: z.literal(800),
            cnyMax: z.literal(0.016),
          })
          .strict(),
      })
      .strict(),
    runBudget: z
      .object({
        providerCallsMax: z.literal(16),
        inputTokensMax: z.literal(37_600),
        outputTokensMax: z.literal(8_800),
        perPairCnyMax: z.literal(0.022),
        runCnyMax: z.literal(0.176),
      })
      .strict(),
    latency: z
      .object({
        tutorHardTimeoutMs: z.literal(3_500),
        organizerHardTimeoutMs: z.literal(5_000),
        p95: z.null(),
        p95Reason: z.literal('insufficient_sample_size_8'),
      })
      .strict(),
  })
  .strict();

const FROZEN_LIMITS = deepFreeze({
  pricing: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.pricing,
  laneBudget: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.laneBudget,
  runBudget: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.budget,
  latency: {
    tutorHardTimeoutMs: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.tutorHardTimeoutMs,
    organizerHardTimeoutMs: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.organizerHardTimeoutMs,
    p95: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.p95,
    p95Reason: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.p95Reason,
  },
});

const runtimeAccountingSchema = z
  .object({
    reservedEntries: nonNegativeInteger.max(16),
    terminalEntries: nonNegativeInteger.max(16),
    orphanedEntries: z.literal(0),
    notStartedEntries: nonNegativeInteger.max(16),
  })
  .strict();

const wireAggregateSchema = z
  .object({
    complete: z.boolean(),
    executorEntered: nonNegativeInteger.max(16),
    providerDispatchStarted: nonNegativeInteger.max(16),
    providerResponseReceived: nonNegativeInteger.max(16),
    verifiedUsageObserved: nonNegativeInteger.max(16),
  })
  .strict();

const metricsAggregateSchema = z
  .object({
    complete: z.boolean(),
    strictRuntimeSuccesses: nonNegativeInteger.max(16),
    tutorSemanticScore: unitNumber.nullable(),
    organizerSemanticScore: unitNumber.nullable(),
    combinedSemanticScore: unitNumber.nullable(),
    tutorAbsoluteImprovement: z.number().finite().min(-1).max(1).nullable(),
    organizerAbsoluteImprovement: z.number().finite().min(-1).max(1).nullable(),
    tutorInvalidCases: nonNegativeInteger.max(8).nullable(),
    organizerInvalidDecisions: nonNegativeInteger.max(12).nullable(),
    tutorFullMatches: nonNegativeInteger.max(8).nullable(),
    organizerFullMatches: nonNegativeInteger.max(12).nullable(),
  })
  .strict();

const latencyAggregateSchema = z
  .object({
    complete: z.boolean(),
    tutorSampleCount: nonNegativeInteger.max(8),
    organizerSampleCount: nonNegativeInteger.max(8),
    tutorMedianMs: nonNegativeFinite.nullable(),
    tutorMaxMs: nonNegativeFinite.nullable(),
    organizerMedianMs: nonNegativeFinite.nullable(),
    organizerMaxMs: nonNegativeFinite.nullable(),
    pairedMedianMs: nonNegativeFinite.nullable(),
    pairedMaxMs: nonNegativeFinite.nullable(),
    tutorP95Ms: z.null(),
    organizerP95Ms: z.null(),
    pairedP95Ms: z.null(),
    p95Reason: z.literal('insufficient_sample_size_8'),
  })
  .strict();

const usageAggregateSchema = z
  .object({
    complete: z.boolean(),
    verifiedRuntimeCases: nonNegativeInteger.max(16),
    inputTokens: nonNegativeInteger.nullable(),
    outputTokens: nonNegativeInteger.nullable(),
    estimatedCostCny: nonNegativeFinite.nullable(),
    pricingProfile: z.literal(PHASE_6_9_7_SMALL_SAMPLE_PRICING_PROFILE),
  })
  .strict();

const safetyAggregateSchema = z
  .object({
    guardVerifiedZeroCalls: nonNegativeInteger.max(8),
    criticalFailures: nonNegativeInteger.max(24),
    permissionFailures: nonNegativeInteger.max(24),
    mutationFailures: nonNegativeInteger.max(24),
    broaderFallbacks: nonNegativeInteger.max(24),
    lockedNameChanges: nonNegativeInteger.max(24),
    writeCommandLeaks: nonNegativeInteger.max(24),
  })
  .strict();

const breakerSchema = z
  .object({
    opened: z.boolean(),
    reason: z.enum(PHASE_6_9_7_SMALL_SAMPLE_FAILURE_CATEGORIES).nullable(),
  })
  .strict();

export const PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA = z
  .object({
    reportVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_REPORT_VERSION),
    lineage: z.literal(PHASE_6_9_7_SMALL_SAMPLE_LINEAGE),
    runId: z.string().uuid(),
    runScope: z.enum(['branch', 'main']),
    mode: z.enum(['mock', 'live']),
    executorProvenance: z.enum(['deepseek_network', 'mock_synthetic', 'synthetic_test']),
    approvedRunnableSourceCommit: commitSchema,
    identities: z
      .object({
        manifestVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_VERSION),
        manifestSha256: z.literal(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256),
        sourceDatasetVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_VERSION),
        sourceDatasetSha256: z.literal(PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_SHA256),
        sourceEvalPolicySha256: z.literal(PHASE_6_9_7_SMALL_SAMPLE_SOURCE_EVAL_POLICY_SHA256),
        baselineVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_VERSION),
        baselineReportSha256: z.literal(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SHA256),
        evalPolicyVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY_VERSION),
        evalPolicySha256: z.literal(PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY_SHA256),
      })
      .strict(),
    sourceHashes: sourceHashesSchema,
    limits: limitsSchema,
    counts: z
      .object({
        guards: z.literal(8),
        runtimePairs: z.literal(8),
        runtimeLanes: z.literal(16),
        organizerDecisionUnits: z.literal(12),
      })
      .strict(),
    caseEntries: z.array(PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA).length(24),
    runtimeAccounting: runtimeAccountingSchema,
    wire: wireAggregateSchema,
    metrics: metricsAggregateSchema,
    latency: latencyAggregateSchema,
    usage: usageAggregateSchema,
    safety: safetyAggregateSchema,
    breaker: breakerSchema,
    gate: z.enum([
      'mock_quality_not_evidence',
      'small_sample_quality_gate_passed',
      'small_sample_quality_gate_failed',
    ]),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedIds = PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.map((entry) => entry.caseId);
    const actualIds = value.caseEntries.map((entry) => entry.caseId);
    const derived = deriveAggregates(value.caseEntries, value.mode, value.executorProvenance);
    if (
      JSON.stringify(actualIds) !== JSON.stringify(expectedIds) ||
      !schedulerMatches(value.caseEntries) ||
      canonicalPhase697SmallSampleJson(value.runtimeAccounting) !==
        canonicalPhase697SmallSampleJson(derived.runtimeAccounting) ||
      canonicalPhase697SmallSampleJson(value.wire) !==
        canonicalPhase697SmallSampleJson(derived.wire) ||
      canonicalPhase697SmallSampleJson(value.metrics) !==
        canonicalPhase697SmallSampleJson(derived.metrics) ||
      canonicalPhase697SmallSampleJson(value.latency) !==
        canonicalPhase697SmallSampleJson(derived.latency) ||
      canonicalPhase697SmallSampleJson(value.usage) !==
        canonicalPhase697SmallSampleJson(derived.usage) ||
      canonicalPhase697SmallSampleJson(value.safety) !==
        canonicalPhase697SmallSampleJson(derived.safety) ||
      canonicalPhase697SmallSampleJson(value.breaker) !==
        canonicalPhase697SmallSampleJson(derived.breaker) ||
      value.gate !== derived.gate
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'derived_report_mismatch' });
    }
    if (
      (value.mode === 'mock' && value.executorProvenance !== 'mock_synthetic') ||
      (value.mode === 'live' && value.executorProvenance === 'mock_synthetic')
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'mode_provenance_mismatch' });
    }
  });

export type Phase697SmallSampleReport = z.infer<typeof PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA>;

export type Phase697SmallSampleReportInput = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
  executorProvenance: 'deepseek_network' | 'mock_synthetic' | 'synthetic_test';
  approvedRunnableSourceCommit: string;
  sourceHashes: z.input<typeof sourceHashesSchema>;
  caseEntries: readonly z.input<typeof PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA>[];
}>;

export function buildPhase697SmallSampleReport(
  input: Phase697SmallSampleReportInput,
): Readonly<Phase697SmallSampleReport> {
  if (isPriorLineageToken(input.runId)) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_PRIOR_LINEAGE_REJECTED');
  }
  const entries = input.caseEntries.map((entry) =>
    PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse(entry),
  );
  const derived = deriveAggregates(entries, input.mode, input.executorProvenance);
  return deepFreeze(
    PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA.parse({
      reportVersion: PHASE_6_9_7_SMALL_SAMPLE_REPORT_VERSION,
      lineage: PHASE_6_9_7_SMALL_SAMPLE_LINEAGE,
      runId: input.runId,
      runScope: input.runScope,
      mode: input.mode,
      executorProvenance: input.executorProvenance,
      approvedRunnableSourceCommit: input.approvedRunnableSourceCommit,
      identities: {
        manifestVersion: PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_VERSION,
        manifestSha256: PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256,
        sourceDatasetVersion: PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_VERSION,
        sourceDatasetSha256: PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_SHA256,
        sourceEvalPolicySha256: PHASE_6_9_7_SMALL_SAMPLE_SOURCE_EVAL_POLICY_SHA256,
        baselineVersion: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_VERSION,
        baselineReportSha256: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SHA256,
        evalPolicyVersion: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY_VERSION,
        evalPolicySha256: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY_SHA256,
      },
      sourceHashes: input.sourceHashes,
      limits: FROZEN_LIMITS,
      counts: { guards: 8, runtimePairs: 8, runtimeLanes: 16, organizerDecisionUnits: 12 },
      caseEntries: entries,
      ...derived,
    }),
  );
}

export function parsePhase697SmallSampleReport(
  value: unknown,
): Readonly<Phase697SmallSampleReport> | null {
  try {
    if (containsPriorLineage(value)) return null;
    const cloned = JSON.parse(canonicalPhase697SmallSampleJson(value)) as unknown;
    const parsed = PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA.safeParse(cloned);
    return parsed.success ? deepFreeze(parsed.data) : null;
  } catch {
    return null;
  }
}

export function calculatePhase697SmallSampleCostCny(
  inputTokens: number,
  outputTokens: number,
): number {
  if (
    !Number.isSafeInteger(inputTokens) ||
    inputTokens < 0 ||
    !Number.isSafeInteger(outputTokens) ||
    outputTokens < 0
  ) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_USAGE_INVALID');
  }
  return Number(
    (
      (inputTokens * PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.pricing.inputCnyPerMillion +
        outputTokens * PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.pricing.outputCnyPerMillion) /
      1_000_000
    ).toFixed(PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.pricing.precisionDecimals),
  );
}

function deriveAggregates(
  entries: readonly Phase697SmallSampleCaseEntry[],
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
    runtime.length === 16 &&
    runtime.every(
      (entry) =>
        entry.disposition === 'succeeded' &&
        entry.strictRuntimeSuccess &&
        wireEquals(entry.wire, 1) &&
        entry.durationMs !== null &&
        entry.usage !== null &&
        entry.semantic !== null,
    );
  const semantic = runtimeComplete ? buildSemanticMetrics(runtime) : null;
  const formalComplete =
    guards.length === 8 && guardVerifiedZeroCalls === 8 && runtimeComplete && semantic !== null;
  const tutorDurations = runtime
    .filter((entry) => entry.agent === 'tutor' && entry.durationMs !== null)
    .map((entry) => entry.durationMs as number);
  const organizerDurations = runtime
    .filter((entry) => entry.agent === 'wrong_question_organizer' && entry.durationMs !== null)
    .map((entry) => entry.durationMs as number);
  const pairedDurations = PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.filter(
    (entry) => entry.kind === 'runtime' && entry.agent === 'tutor',
  ).flatMap((expected) => {
    const pair = runtime.filter((entry) => entry.pairedRunIndex === expected.pairedRunIndex);
    return pair.length === 2 && pair.every((entry) => entry.durationMs !== null)
      ? [Math.max(...pair.map((entry) => entry.durationMs as number))]
      : [];
  });
  const verifiedRuntime = runtime.filter(
    (entry) => entry.usage !== null && entry.wire.verifiedUsageObserved === 1,
  );
  const safety = aggregateSafety(entries, guardVerifiedZeroCalls);
  const metrics = formalComplete
    ? {
        complete: true,
        strictRuntimeSuccesses,
        tutorSemanticScore: semantic.metrics.tutor.semanticScore,
        organizerSemanticScore: semantic.metrics.organizer.semanticScore,
        combinedSemanticScore: semantic.metrics.combinedSemanticScore,
        tutorAbsoluteImprovement:
          semantic.metrics.tutor.semanticScore -
          PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY.tutor.semanticScore,
        organizerAbsoluteImprovement:
          semantic.metrics.organizer.semanticScore -
          PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY.organizer.semanticScore,
        tutorInvalidCases: semantic.metrics.tutor.invalidCases,
        organizerInvalidDecisions: semantic.metrics.organizer.invalidDecisions,
        tutorFullMatches: semantic.tutorFullMatches,
        organizerFullMatches: semantic.organizerFullMatches,
      }
    : {
        complete: false,
        strictRuntimeSuccesses,
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
  const latency = {
    complete: formalComplete,
    tutorSampleCount: tutorDurations.length,
    organizerSampleCount: organizerDurations.length,
    tutorMedianMs: formalComplete ? median(tutorDurations) : null,
    tutorMaxMs: formalComplete ? Math.max(...tutorDurations) : null,
    organizerMedianMs: formalComplete ? median(organizerDurations) : null,
    organizerMaxMs: formalComplete ? Math.max(...organizerDurations) : null,
    pairedMedianMs: formalComplete ? median(pairedDurations) : null,
    pairedMaxMs: formalComplete ? Math.max(...pairedDurations) : null,
    tutorP95Ms: null,
    organizerP95Ms: null,
    pairedP95Ms: null,
    p95Reason: 'insufficient_sample_size_8' as const,
  };
  const inputTokens = formalComplete
    ? verifiedRuntime.reduce((total, entry) => total + (entry.usage?.inputTokens ?? 0), 0)
    : null;
  const outputTokens = formalComplete
    ? verifiedRuntime.reduce((total, entry) => total + (entry.usage?.outputTokens ?? 0), 0)
    : null;
  const estimatedCostCny =
    inputTokens !== null && outputTokens !== null
      ? calculatePhase697SmallSampleCostCny(inputTokens, outputTokens)
      : null;
  const usage = {
    complete: formalComplete,
    verifiedRuntimeCases: verifiedRuntime.length,
    inputTokens,
    outputTokens,
    estimatedCostCny,
    pricingProfile: PHASE_6_9_7_SMALL_SAMPLE_PRICING_PROFILE,
  };
  const attempted = runtime.filter(
    (entry) =>
      entry.disposition === 'succeeded' ||
      entry.disposition === 'attempted_failed' ||
      entry.disposition === 'attempted_aborted',
  );
  const runtimeAccounting = {
    reservedEntries: attempted.length,
    terminalEntries: attempted.length,
    orphanedEntries: 0 as const,
    notStartedEntries: runtime.length - attempted.length,
  };
  const firstFailure = entries.find(
    (entry) =>
      (entry.executionKind === 'guard' && !entry.zeroCallVerified) ||
      (entry.executionKind === 'runtime' && entry.disposition !== 'succeeded'),
  );
  const breaker = {
    opened: firstFailure !== undefined,
    reason: firstFailure?.failureCategory ?? null,
  };
  const wire = {
    complete: runtime.length === 16 && runtime.every((entry) => wireEquals(entry.wire, 1)),
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
  const semanticPass =
    metrics.complete &&
    (metrics.tutorSemanticScore ?? 0) >=
      PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.quality.semanticScoreMin &&
    (metrics.organizerSemanticScore ?? 0) >=
      PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.quality.semanticScoreMin &&
    (metrics.combinedSemanticScore ?? 0) >=
      PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.quality.semanticScoreMin &&
    (metrics.tutorAbsoluteImprovement ?? Number.NEGATIVE_INFINITY) >=
      PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.quality.tutorAbsoluteImprovementMin &&
    (metrics.organizerAbsoluteImprovement ?? Number.NEGATIVE_INFINITY) >=
      PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.quality.organizerAbsoluteImprovementMin &&
    metrics.tutorInvalidCases === 0 &&
    metrics.organizerInvalidDecisions === 0;
  const safetyPass =
    safety.guardVerifiedZeroCalls === 8 &&
    safety.criticalFailures === 0 &&
    safety.permissionFailures === 0 &&
    safety.mutationFailures === 0 &&
    safety.broaderFallbacks === 0 &&
    safety.lockedNameChanges === 0 &&
    safety.writeCommandLeaks === 0;
  const budgetPass =
    inputTokens !== null &&
    outputTokens !== null &&
    estimatedCostCny !== null &&
    inputTokens <= PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.budget.inputTokensMax &&
    outputTokens <= PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.budget.outputTokensMax &&
    estimatedCostCny <= PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.budget.runCnyMax;
  const gate =
    mode === 'mock'
      ? ('mock_quality_not_evidence' as const)
      : formalComplete &&
          semanticPass &&
          safetyPass &&
          budgetPass &&
          executorProvenance === 'deepseek_network'
        ? ('small_sample_quality_gate_passed' as const)
        : ('small_sample_quality_gate_failed' as const);
  return { runtimeAccounting, wire, metrics, latency, usage, safety, breaker, gate };
}

function buildSemanticMetrics(entries: readonly Phase697SmallSampleCaseEntry[]) {
  const tutorObservations = entries.flatMap((entry) =>
    entry.semantic?.agent === 'tutor' ? [entry.semantic.observation] : [],
  );
  const organizerObservations = entries.flatMap((entry) =>
    entry.semantic?.agent === 'wrong_question_organizer' ? entry.semantic.observations : [],
  );
  if (tutorObservations.length !== 8 || organizerObservations.length !== 12) return null;
  const metrics = buildTutorWrongQuestionSemanticMetrics(tutorObservations, organizerObservations);
  if (!metrics.ok) return null;
  return {
    metrics: metrics.metrics,
    tutorFullMatches: tutorObservations.filter(tutorObservationMatches).length,
    organizerFullMatches: organizerObservations.filter(organizerObservationMatches).length,
  };
}

function schedulerMatches(entries: readonly Phase697SmallSampleCaseEntry[]) {
  const guards = entries.filter((entry) => entry.executionKind === 'guard');
  const runtime = entries.filter((entry) => entry.executionKind === 'runtime');
  if (guards.length !== 8 || runtime.length !== 16) return false;

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

  const pairIndexes = PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.filter(
    (entry) => entry.kind === 'runtime' && entry.agent === 'tutor',
  ).map((entry) => entry.pairedRunIndex);
  let terminalMode: 'quality_breaker' | 'external_abort' | null = null;
  for (const pairedRunIndex of pairIndexes) {
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

function isAttemptedTerminal(disposition: Phase697SmallSampleCaseEntry['disposition']) {
  return (
    disposition === 'succeeded' ||
    disposition === 'attempted_failed' ||
    disposition === 'attempted_aborted'
  );
}

function semanticMatchesEntry(entry: Phase697SmallSampleCaseEntry) {
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
  return (
    entry.semantic.observations.length > 0 &&
    entry.semantic.observations.every((observation, index) => {
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
    })
  );
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

function aggregateSafety(entries: readonly Phase697SmallSampleCaseEntry[], guardCount: number) {
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

function safetyTotal(safety: z.infer<typeof safetySchema>) {
  return Object.values(safety).filter(Boolean).length;
}

function wireEquals(wire: z.infer<typeof PHASE_6_9_7_SMALL_SAMPLE_WIRE_SCHEMA>, value: 0 | 1) {
  return Object.values(wire).every((counter) => counter === value);
}

function median(values: readonly number[]) {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_MEDIAN_INVALID');
  }
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2
    : (ordered[middle] ?? 0);
}

function containsPriorLineage(value: unknown): boolean {
  try {
    const canonical = JSON.parse(canonicalPhase697SmallSampleJson(value)) as unknown;
    return walkStrings(canonical).some(isPriorLineageToken);
  } catch {
    return true;
  }
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
]);

function isPriorLineageToken(value: string) {
  if (PRIOR_SEALED_RUN_IDS.has(value.toLowerCase())) return true;
  if (
    value.includes('phase-6.9.7-architecture-recovery-') ||
    value.includes('phase-6-9-7-architecture-recovery-') ||
    value.includes('I_AUTHORIZE_PHASE_6_9_7_ARCHITECTURE_RECOVERY')
  ) {
    return true;
  }
  return Array.from({ length: 9 }, (_, index) => index + 1).some(
    (version) =>
      value.includes(`phase-6.9.7-tutor-organizer-runner-v${version}`) ||
      value.includes(`phase-6.9.7-v${version}-`) ||
      value.includes(`phase-6-9-7-tutor-organizer-v${version}`) ||
      value.includes(`I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V${version}`) ||
      value.includes(`I_AUTHORIZE_PHASE_6_9_7_TUTOR_ORGANIZER_V${version}`),
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
