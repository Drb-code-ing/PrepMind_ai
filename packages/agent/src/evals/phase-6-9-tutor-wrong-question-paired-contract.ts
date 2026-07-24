import { z } from 'zod';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION,
  type Phase69TutorWrongQuestionCase,
} from './phase-6-9-tutor-wrong-question-cases.ts';
import {
  buildTutorWrongQuestionSemanticMetrics,
  nearestRankP95,
} from './phase-6-9-tutor-wrong-question-metrics.ts';
import {
  PHASE_6_9_7_CANONICAL_DIAGNOSTIC_SCHEMA,
  PHASE_6_9_7_CANONICAL_FAILURE_REASONS,
  PHASE_6_9_7_CANONICAL_VALIDATION_STAGES,
  PHASE_6_9_7_ORGANIZER_DYNAMIC_CONTRACT_FAILURE_REASONS,
  PHASE_6_9_7_TUTOR_DYNAMIC_CONTRACT_FAILURE_REASONS,
} from './phase-6-9-tutor-wrong-question-bounded-diagnostics.ts';
import { MODEL_CANDIDATE_DISPOSITIONS } from '../model-candidates/model-candidate-policy.ts';
import { TUTOR_MODEL_PROJECTION_VERSION } from '../model-candidates/tutor-model-projection.ts';
import { WRONG_QUESTION_ORGANIZER_MODEL_PROJECTION_VERSION } from '../model-candidates/wrong-question-organizer-model-projection.ts';

export const PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V1 =
  'phase-6.9.7-tutor-organizer-runner-v1' as const;
export const PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2 =
  'phase-6.9.7-tutor-organizer-runner-v2' as const;
export const PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION =
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V1;
export type Phase697TutorOrganizerRunnerVersion =
  | typeof PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V1
  | typeof PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2;
export const PHASE_6_9_7_TUTOR_PROMPT_VERSION_V1 = 'tutor-model-candidate-v1' as const;
export const PHASE_6_9_7_TUTOR_PROMPT_VERSION_V2 = 'tutor-model-candidate-v2' as const;
export const PHASE_6_9_7_TUTOR_PROMPT_VERSION = PHASE_6_9_7_TUTOR_PROMPT_VERSION_V1;
export const PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V1 =
  'wrong-question-organizer-model-candidate-v1' as const;
export const PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V2 =
  'wrong-question-organizer-model-candidate-v2' as const;
export const PHASE_6_9_7_ORGANIZER_PROMPT_VERSION =
  PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V1;
export const PHASE_6_9_7_TUTOR_SCHEMA_VERSION = 'tutor-model-decision-v1' as const;
export const PHASE_6_9_7_ORGANIZER_SCHEMA_VERSION =
  'wrong-question-organizer-model-decision-v1' as const;
export const PHASE_6_9_7_PRICING_PROFILE = 'deepseek-v4-pro-cny-2026-07-15' as const;
export const PHASE_6_9_7_EXECUTOR_PROVENANCES = [
  'mock_synthetic',
  'deepseek_network',
  'synthetic_test',
] as const;
export const PHASE_6_9_7_TUTOR_BASELINE_SEMANTIC_SCORE = 0.44186666666666674 as const;
export const PHASE_6_9_7_ORGANIZER_BASELINE_SEMANTIC_SCORE = 0.278125 as const;

const unitNumber = z.number().finite().min(0).max(1);
const safeCount = z.number().int().safe().nonnegative();
const latencyValue = z.number().finite().nonnegative();
const dispositionSchema = z.enum(MODEL_CANDIDATE_DISPOSITIONS);
const tutorIntentSchema = z.enum([
  'explain_solution',
  'socratic_hint',
  'step_check',
  'concept_bridge',
  'general_follow_up',
]);
const tutorDepthSchema = z.enum(['brief', 'standard', 'deep']);
const answerSectionSchema = z.enum([
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
const zeroCallReasonSchema = z.enum([
  'route_not_tutor',
  'explicit_answer_direct',
  'explicit_socratic_hint',
  'explicit_step_check',
  'explicit_concept_bridge',
  'explicit_explain_solution',
  'empty_input',
  'request_aborted',
  'budget_exhausted',
  'credential_material',
  'instruction_override',
  'hostile_accessor',
  'existing_item',
  'exact_deck_match',
  'high_confidence_knowledge_point',
  'high_confidence_category_error',
  'agent_gate_disabled',
  'live_calls_disabled',
  'owner_mismatch',
  'guard_mismatch',
]);

const tutorStrategySchema = z
  .object({
    intent: tutorIntentSchema,
    depth: tutorDepthSchema,
    contextUse: z.boolean(),
    guidingQuestion: z.boolean(),
    finalAnswer: z.boolean(),
    answerStructure: z.array(answerSectionSchema).max(6),
  })
  .strict();

const organizerDecisionObservationSchema = z
  .object({
    decisionIndex: z.number().int().min(0).max(11),
    expectedSubject: organizerSubjectSchema,
    actualSubject: organizerSubjectSchema.nullable(),
    expectedDeckAction: organizerDeckActionSchema,
    actualDeckAction: organizerDeckActionSchema.nullable(),
    expectedDeckIndex: z.number().int().min(0).max(19).nullable(),
    actualDeckIndex: z.number().int().min(0).max(19).nullable(),
    canonicalTopicLabel: z.string().min(1).max(80),
    actualTopicLabelClass: z.string().min(1).max(80).nullable(),
    expectedConfidence: organizerConfidenceSchema,
    actualConfidence: organizerConfidenceSchema.nullable(),
    requiredEvidenceCodes: z.array(organizerEvidenceCodeSchema).max(5),
    allowedEvidenceCodes: z.array(organizerEvidenceCodeSchema).max(5),
    actualEvidenceCodes: z.array(organizerEvidenceCodeSchema).max(5),
    validOutput: z.boolean(),
  })
  .strict();

export const PHASE_6_9_7_CASE_USAGE_SCHEMA = z
  .object({
    inputTokens: z.number().int().safe().positive(),
    outputTokens: z.number().int().safe().positive(),
    pricingKnown: z.literal(true),
    currency: z.literal('CNY'),
    pricingProfile: z.literal(PHASE_6_9_7_PRICING_PROFILE),
    estimatedCostCny: z.number().finite().positive(),
  })
  .strict();

export const PHASE_6_9_7_CASE_ENTRY_SCHEMA = z
  .object({
    caseId: z.string().regex(/^(tutor|organizer)-[a-z0-9-]+$/),
    agent: z.enum(['tutor', 'wrong_question_organizer']),
    executionKind: z.enum(['zero_call', 'runtime']),
    pairedRunIndex: z.number().int().min(0).max(23).nullable(),
    runtimeInvocations: z.number().int().min(0).max(1),
    observedZeroCallReason: zeroCallReasonSchema.nullable(),
    zeroCallVerified: z.boolean(),
    rawSchemaValid: z.boolean().nullable(),
    candidateDisposition: dispositionSchema.nullable(),
    canonicalSchemaSuccess: z.boolean(),
    canonicalValidationStage: z
      .enum(PHASE_6_9_7_CANONICAL_VALIDATION_STAGES)
      .nullable()
      .optional(),
    canonicalFailureReason: z
      .enum(PHASE_6_9_7_CANONICAL_FAILURE_REASONS)
      .nullable()
      .optional(),
    strictRuntimeSuccess: z.boolean(),
    criticalFailure: z.boolean(),
    permissionFailure: z.boolean(),
    mutationFailure: z.boolean(),
    broaderThanDeterministicFallback: z.boolean(),
    latencyMs: latencyValue.nullable(),
    tutorOrchestrationLatencyMs: latencyValue.nullable(),
    usage: PHASE_6_9_7_CASE_USAGE_SCHEMA.nullable(),
    tutorExpected: tutorStrategySchema.nullable(),
    tutorActual: tutorStrategySchema.nullable(),
    organizerDecisions: z.array(organizerDecisionObservationSchema).max(12),
  })
  .strict();

const tutorMetricsSchema = z
  .object({
    intentMacroF1: unitNumber,
    depthAccuracy: unitNumber,
    contextUseAccuracy: unitNumber,
    pedagogyPolicyAccuracy: unitNumber,
    semanticScore: unitNumber,
    scoredCases: z.literal(24),
    invalidCases: z.number().int().min(0).max(24),
  })
  .strict();

const organizerMetricsSchema = z
  .object({
    subjectAccuracy: unitNumber,
    deckActionAccuracy: unitNumber,
    existingDeckPrecision: unitNumber,
    topicLabelMacroF1: unitNumber,
    evidenceConfidenceAccuracy: unitNumber,
    semanticScore: unitNumber,
    scoredDecisions: z.literal(32),
    invalidDecisions: z.number().int().min(0).max(32),
  })
  .strict();

export const PHASE_6_9_7_METRICS_SCHEMA = z
  .object({
    tutorBaselineSemanticScore: z.literal(PHASE_6_9_7_TUTOR_BASELINE_SEMANTIC_SCORE),
    organizerBaselineSemanticScore: z.literal(PHASE_6_9_7_ORGANIZER_BASELINE_SEMANTIC_SCORE),
    tutorAbsoluteImprovement: z.number().finite(),
    organizerAbsoluteImprovement: z.number().finite(),
    tutor: tutorMetricsSchema,
    organizer: organizerMetricsSchema,
    combinedSemanticScore: unitNumber,
  })
  .strict();

export const PHASE_6_9_7_LATENCY_SCHEMA = z
  .object({
    tutorSamplesMs: z.array(latencyValue).length(24),
    organizerSamplesMs: z.array(latencyValue).length(24),
    pairedCandidateSamplesMs: z.array(latencyValue).length(24),
    tutorOrchestrationSamplesMs: z.array(latencyValue).length(24),
    tutorP95Ms: latencyValue,
    organizerP95Ms: latencyValue,
    pairedCandidateP95Ms: latencyValue,
    tutorOrchestrationP95Ms: latencyValue,
  })
  .strict();

export const PHASE_6_9_7_USAGE_SCHEMA = z
  .object({
    attemptedCases: z.literal(48),
    verifiedCases: z.number().int().min(0).max(48),
    inputTokens: safeCount,
    outputTokens: safeCount,
    pricingKnown: z.boolean(),
    currency: z.literal('CNY'),
    pricingProfile: z.literal(PHASE_6_9_7_PRICING_PROFILE).nullable(),
    totalCostCny: z.number().finite().nonnegative().nullable(),
  })
  .strict();

export const PHASE_6_9_7_SAFETY_SCHEMA = z
  .object({
    zeroCallVerified: z.number().int().min(0).max(24),
    strictRuntimeSuccesses: z.number().int().min(0).max(48),
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
    mode: z.enum(['mock', 'live']),
    runnerVersion: z.enum([
      PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V1,
      PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2,
    ]),
    datasetVersion: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION),
    datasetSha256: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256),
    identities: z
      .object({
        tutorPromptVersion: z.enum([
          PHASE_6_9_7_TUTOR_PROMPT_VERSION_V1,
          PHASE_6_9_7_TUTOR_PROMPT_VERSION_V2,
        ]),
        organizerPromptVersion: z.enum([
          PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V1,
          PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V2,
        ]),
        tutorSchemaVersion: z.literal(PHASE_6_9_7_TUTOR_SCHEMA_VERSION),
        organizerSchemaVersion: z.literal(PHASE_6_9_7_ORGANIZER_SCHEMA_VERSION),
        tutorProjectionVersion: z.literal(TUTOR_MODEL_PROJECTION_VERSION),
        organizerProjectionVersion: z.literal(WRONG_QUESTION_ORGANIZER_MODEL_PROJECTION_VERSION),
        structuredOutputMode: z.enum(['mock_json_v1', 'deepseek_v4_pro_nonthinking_json']),
        executorProvenance: z.enum(PHASE_6_9_7_EXECUTOR_PROVENANCES),
      })
      .strict(),
    provider: z.enum(['mock', 'deepseek']),
    model: z.enum(['mock', 'deepseek-v4-pro']),
    counts: z
      .object({
        cases: z.literal(72),
        zeroCall: z.literal(24),
        runtime: z.literal(48),
        pairedRequests: z.literal(24),
        organizerDecisionUnits: z.literal(32),
      })
      .strict(),
    metrics: PHASE_6_9_7_METRICS_SCHEMA,
    latency: PHASE_6_9_7_LATENCY_SCHEMA,
    usage: PHASE_6_9_7_USAGE_SCHEMA,
    safety: PHASE_6_9_7_SAFETY_SCHEMA,
    caseEntries: z.array(PHASE_6_9_7_CASE_ENTRY_SCHEMA).length(72),
    gate: z.enum(['quality_gate_passed', 'quality_gate_failed']),
  })
  .strict();

export type Phase697TutorOrganizerCaseEntry = z.infer<typeof PHASE_6_9_7_CASE_ENTRY_SCHEMA>;
export type Phase697TutorOrganizerReportInput = z.infer<typeof reportBaseSchema>;
export type Phase697TutorOrganizerReport = Phase697TutorOrganizerReportInput;

export const PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA = reportBaseSchema.superRefine(
  (report, context) => {
    validateModeIdentity(report, context);
    validateVersionedDiagnostics(report, context);
    validateCanonicalEntries(report, context);
    validateDerivedFields(report, context);
  },
);

function validateVersionedDiagnostics(
  report: Phase697TutorOrganizerReportInput,
  context: z.RefinementCtx,
) {
  const v2 = report.runnerVersion === PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2;
  const promptIdentityMatches = v2
    ? report.identities.tutorPromptVersion === PHASE_6_9_7_TUTOR_PROMPT_VERSION_V2 &&
      report.identities.organizerPromptVersion === PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V2
    : report.identities.tutorPromptVersion === PHASE_6_9_7_TUTOR_PROMPT_VERSION_V1 &&
      report.identities.organizerPromptVersion === PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V1;
  if (!promptIdentityMatches) {
    addIssue(context, 'runner/prompt identity mismatch');
  }
  const tutorDynamicReasons = new Set<string>(
    PHASE_6_9_7_TUTOR_DYNAMIC_CONTRACT_FAILURE_REASONS,
  );
  const organizerDynamicReasons = new Set<string>(
    PHASE_6_9_7_ORGANIZER_DYNAMIC_CONTRACT_FAILURE_REASONS,
  );
  for (const entry of report.caseEntries) {
    const hasStage = Object.hasOwn(entry, 'canonicalValidationStage');
    const hasReason = Object.hasOwn(entry, 'canonicalFailureReason');
    if (!v2) {
      if (hasStage || hasReason) {
        addIssue(context, `V1 diagnostics must remain absent: ${entry.caseId}`);
      }
      continue;
    }
    if (!hasStage || !hasReason) {
      addIssue(context, `V2 diagnostics missing: ${entry.caseId}`);
      continue;
    }

    const parsed = PHASE_6_9_7_CANONICAL_DIAGNOSTIC_SCHEMA.safeParse({
      canonicalValidationStage: entry.canonicalValidationStage,
      canonicalFailureReason: entry.canonicalFailureReason,
    });
    if (!parsed.success) {
      addIssue(context, `V2 diagnostics invalid: ${entry.caseId}`);
      continue;
    }
    const diagnostic = parsed.data;

    if (entry.executionKind === 'zero_call') {
      if (
        diagnostic.canonicalValidationStage !== null ||
        diagnostic.canonicalFailureReason !== null
      ) {
        addIssue(context, `zero-call diagnostics mismatch: ${entry.caseId}`);
      }
      continue;
    }

    if (diagnostic.canonicalValidationStage === null) {
      if (entry.canonicalSchemaSuccess || entry.strictRuntimeSuccess) {
        addIssue(context, `pre-structured diagnostics mismatch: ${entry.caseId}`);
      }
      continue;
    }

    if (diagnostic.canonicalValidationStage === 'applied') {
      if (
        entry.rawSchemaValid !== true ||
        entry.candidateDisposition !== 'candidate_applied' ||
        !entry.canonicalSchemaSuccess
      ) {
        addIssue(context, `applied diagnostics mismatch: ${entry.caseId}`);
      }
      continue;
    }

    if (entry.candidateDisposition !== 'fallback_schema_invalid' || entry.canonicalSchemaSuccess) {
      addIssue(context, `failed diagnostics disposition mismatch: ${entry.caseId}`);
    }
    if (
      diagnostic.canonicalValidationStage === 'raw_schema' &&
      entry.rawSchemaValid !== false
    ) {
      addIssue(context, `raw diagnostics mismatch: ${entry.caseId}`);
    }
    if (
      diagnostic.canonicalValidationStage !== 'raw_schema' &&
      entry.rawSchemaValid !== true
    ) {
      addIssue(context, `post-schema diagnostics mismatch: ${entry.caseId}`);
    }
    if (
      (entry.agent === 'tutor' &&
        diagnostic.canonicalFailureReason === 'projection_association_invalid') ||
      (entry.agent === 'wrong_question_organizer' &&
        diagnostic.canonicalFailureReason === 'incompatible_depth')
    ) {
      addIssue(context, `agent diagnostics mismatch: ${entry.caseId}`);
    }
    if (
      diagnostic.canonicalValidationStage === 'dynamic_contract' &&
      !(
        entry.agent === 'tutor' ? tutorDynamicReasons : organizerDynamicReasons
      ).has(diagnostic.canonicalFailureReason)
    ) {
      addIssue(context, `agent dynamic diagnostics mismatch: ${entry.caseId}`);
    }
  }
}

export function computePhase697TutorOrganizerGate(
  report: Phase697TutorOrganizerReportInput,
): 'quality_gate_passed' | 'quality_gate_failed' {
  const passes =
    report.mode === 'live' &&
    report.provider === 'deepseek' &&
    report.model === 'deepseek-v4-pro' &&
    report.identities.structuredOutputMode === 'deepseek_v4_pro_nonthinking_json' &&
    report.identities.executorProvenance === 'deepseek_network' &&
    report.safety.zeroCallVerified === 24 &&
    report.safety.strictRuntimeSuccesses === 48 &&
    report.safety.criticalFailures === 0 &&
    report.safety.permissionFailures === 0 &&
    report.safety.mutationFailures === 0 &&
    report.safety.broaderFallbacks === 0 &&
    report.metrics.tutor.semanticScore >= 0.85 &&
    report.metrics.organizer.semanticScore >= 0.85 &&
    report.metrics.tutorAbsoluteImprovement >= 0.15 &&
    report.metrics.organizerAbsoluteImprovement >= 0.15 &&
    report.latency.tutorP95Ms <= 2_500 &&
    report.latency.organizerP95Ms <= 4_500 &&
    report.latency.pairedCandidateP95Ms <= 4_500 &&
    report.latency.tutorOrchestrationP95Ms <= 6_500 &&
    report.usage.verifiedCases === 48 &&
    report.usage.inputTokens > 0 &&
    report.usage.inputTokens <= 112_800 &&
    report.usage.outputTokens > 0 &&
    report.usage.outputTokens <= 26_400 &&
    report.usage.pricingKnown &&
    report.usage.pricingProfile === PHASE_6_9_7_PRICING_PROFILE &&
    report.usage.totalCostCny !== null &&
    report.usage.totalCostCny > 0 &&
    report.usage.totalCostCny <= 0.55;
  return passes ? 'quality_gate_passed' : 'quality_gate_failed';
}

function validateModeIdentity(report: Phase697TutorOrganizerReportInput, context: z.RefinementCtx) {
  const valid =
    (report.mode === 'mock' &&
      report.provider === 'mock' &&
      report.model === 'mock' &&
      report.identities.structuredOutputMode === 'mock_json_v1' &&
      report.identities.executorProvenance === 'mock_synthetic') ||
    (report.mode === 'live' &&
      report.provider === 'deepseek' &&
      report.model === 'deepseek-v4-pro' &&
      report.identities.structuredOutputMode === 'deepseek_v4_pro_nonthinking_json' &&
      (report.identities.executorProvenance === 'deepseek_network' ||
        report.identities.executorProvenance === 'synthetic_test'));
  if (!valid) addIssue(context, 'mode/provider/model identity mismatch');
}

function validateCanonicalEntries(
  report: Phase697TutorOrganizerReportInput,
  context: z.RefinementCtx,
) {
  const canonical = new Map<string, Phase69TutorWrongQuestionCase>(
    PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.map((entry) => [entry.id, entry]),
  );
  const ids = report.caseEntries.map((entry) => entry.caseId);
  if (new Set(ids).size !== 72 || ids.some((id) => !canonical.has(id))) {
    addIssue(context, 'case ids must be unique and canonical');
    return;
  }

  for (const expected of PHASE_6_9_TUTOR_WRONG_QUESTION_CASES) {
    const actual = report.caseEntries.find((entry) => entry.caseId === expected.id);
    if (!actual || !entryMatchesCase(actual, expected)) {
      addIssue(context, `case contract mismatch: ${expected.id}`);
    }
  }

  const zeroCalls = report.caseEntries.filter((entry) => entry.executionKind === 'zero_call');
  if (
    zeroCalls.length !== 24 ||
    zeroCalls.filter((entry) => entry.agent === 'tutor').length !== 12 ||
    zeroCalls.filter((entry) => entry.agent === 'wrong_question_organizer').length !== 12
  ) {
    addIssue(context, 'zero-call distribution mismatch');
  }

  for (let pairedRunIndex = 0; pairedRunIndex < 24; pairedRunIndex += 1) {
    const pair = report.caseEntries.filter((entry) => entry.pairedRunIndex === pairedRunIndex);
    if (
      pair.length !== 2 ||
      pair.filter((entry) => entry.agent === 'tutor').length !== 1 ||
      pair.filter((entry) => entry.agent === 'wrong_question_organizer').length !== 1
    ) {
      addIssue(context, `paired run mismatch: ${pairedRunIndex}`);
    }
  }
}

function entryMatchesCase(
  entry: Phase697TutorOrganizerCaseEntry,
  expected: Phase69TutorWrongQuestionCase,
) {
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
      entry.rawSchemaValid === null &&
      entry.candidateDisposition === null &&
      !entry.canonicalSchemaSuccess &&
      !entry.strictRuntimeSuccess &&
      entry.latencyMs === null &&
      entry.tutorOrchestrationLatencyMs === null &&
      entry.usage === null &&
      entry.tutorExpected === null &&
      entry.tutorActual === null &&
      entry.organizerDecisions.length === 0
    );
  }

  if (
    entry.observedZeroCallReason !== null ||
    entry.zeroCallVerified ||
    entry.rawSchemaValid === null ||
    entry.candidateDisposition === null ||
    entry.latencyMs === null
  ) {
    return false;
  }

  if (expected.agent === 'tutor') {
    return (
      sameJson(entry.tutorExpected, expected.expected) &&
      (entry.tutorActual !== null) === entry.canonicalSchemaSuccess &&
      entry.organizerDecisions.length === 0 &&
      entry.tutorOrchestrationLatencyMs !== null
    );
  }
  return (
    entry.tutorExpected === null &&
    entry.tutorActual === null &&
    entry.tutorOrchestrationLatencyMs === null &&
    organizerExpectationsMatch(entry.organizerDecisions, expected.expected.decisions) &&
    (!entry.canonicalSchemaSuccess ||
      entry.organizerDecisions.every(
        (decision) =>
          decision.validOutput &&
          decision.actualSubject !== null &&
          decision.actualDeckAction !== null &&
          decision.actualTopicLabelClass !== null &&
          decision.actualConfidence !== null,
      ))
  );
}

function organizerExpectationsMatch(
  actual: Phase697TutorOrganizerCaseEntry['organizerDecisions'],
  expected: Extract<
    Phase69TutorWrongQuestionCase,
    { agent: 'wrong_question_organizer'; expectedRuntimeInvocations: 1 }
  >['expected']['decisions'],
) {
  if (actual.length !== expected.length) return false;
  return expected.every((decision) => {
    const entry = actual.find((candidate) => candidate.decisionIndex === decision.questionIndex);
    return (
      entry !== undefined &&
      entry.expectedSubject === decision.subject &&
      entry.expectedDeckAction === decision.deckAction &&
      entry.expectedDeckIndex === (decision.deckIndex ?? null) &&
      entry.canonicalTopicLabel === decision.canonicalTopicLabel &&
      (entry.actualTopicLabelClass === null ||
        entry.actualTopicLabelClass === decision.canonicalTopicLabel ||
        entry.actualTopicLabelClass === '__unexpected__') &&
      entry.expectedConfidence === decision.confidence &&
      sameJson(entry.requiredEvidenceCodes, decision.requiredEvidenceCodes) &&
      sameJson(entry.allowedEvidenceCodes, decision.allowedEvidenceCodes)
    );
  });
}

function validateDerivedFields(
  report: Phase697TutorOrganizerReportInput,
  context: z.RefinementCtx,
) {
  const runtime = report.caseEntries.filter((entry) => entry.executionKind === 'runtime');
  const tutorEntries = runtime.filter((entry) => entry.agent === 'tutor');
  const organizerEntries = runtime.filter((entry) => entry.agent === 'wrong_question_organizer');
  const computed = buildTutorWrongQuestionSemanticMetrics(
    tutorEntries.map((entry) => ({
      caseId: entry.caseId,
      expectedIntent: entry.tutorExpected!.intent,
      actualIntent: entry.tutorActual?.intent ?? null,
      expectedDepth: entry.tutorExpected!.depth,
      actualDepth: entry.tutorActual?.depth ?? null,
      expectedContextUse: entry.tutorExpected!.contextUse,
      actualContextUse: entry.tutorActual?.contextUse ?? null,
      expectedGuidingQuestion: entry.tutorExpected!.guidingQuestion,
      actualGuidingQuestion: entry.tutorActual?.guidingQuestion ?? null,
      expectedFinalAnswer: entry.tutorExpected!.finalAnswer,
      actualFinalAnswer: entry.tutorActual?.finalAnswer ?? null,
      expectedAnswerStructure: entry.tutorExpected!.answerStructure,
      actualAnswerStructure: entry.tutorActual?.answerStructure ?? [],
      validOutput: entry.canonicalSchemaSuccess,
    })),
    organizerEntries.flatMap((entry) =>
      entry.organizerDecisions.map((decision) => ({
        decisionId: `${entry.caseId}:q${decision.decisionIndex}`,
        expectedSubject: decision.expectedSubject,
        actualSubject: decision.actualSubject,
        expectedDeckAction: decision.expectedDeckAction,
        actualDeckAction: decision.actualDeckAction,
        expectedDeckIndex: decision.expectedDeckIndex,
        actualDeckIndex: decision.actualDeckIndex,
        canonicalTopicLabel: decision.canonicalTopicLabel,
        acceptedTopicLabels: [decision.canonicalTopicLabel],
        actualTopicLabel: decision.actualTopicLabelClass,
        expectedConfidence: decision.expectedConfidence,
        actualConfidence: decision.actualConfidence,
        requiredEvidenceCodes: decision.requiredEvidenceCodes,
        allowedEvidenceCodes: decision.allowedEvidenceCodes,
        actualEvidenceCodes: decision.actualEvidenceCodes,
        validOutput: decision.validOutput && entry.canonicalSchemaSuccess,
      })),
    ),
  );
  if (!computed.ok) {
    addIssue(context, 'semantic metrics invalid');
    return;
  }
  const expectedMetrics = {
    tutorBaselineSemanticScore: PHASE_6_9_7_TUTOR_BASELINE_SEMANTIC_SCORE,
    organizerBaselineSemanticScore: PHASE_6_9_7_ORGANIZER_BASELINE_SEMANTIC_SCORE,
    tutorAbsoluteImprovement:
      computed.metrics.tutor.semanticScore - PHASE_6_9_7_TUTOR_BASELINE_SEMANTIC_SCORE,
    organizerAbsoluteImprovement:
      computed.metrics.organizer.semanticScore - PHASE_6_9_7_ORGANIZER_BASELINE_SEMANTIC_SCORE,
    tutor: {
      ...computed.metrics.tutor,
      scoredCases: 24,
    },
    organizer: {
      ...computed.metrics.organizer,
      scoredDecisions: 32,
    },
    combinedSemanticScore: computed.metrics.combinedSemanticScore,
  };
  if (!sameJson(report.metrics, expectedMetrics)) {
    addIssue(context, 'metrics mismatch');
  }

  const tutorSamplesMs = orderedLatencies(tutorEntries);
  const organizerSamplesMs = orderedLatencies(organizerEntries);
  const tutorOrchestrationSamplesMs = tutorEntries
    .sort(comparePairedIndex)
    .map((entry) => entry.tutorOrchestrationLatencyMs!);
  const expectedLatency = {
    tutorSamplesMs,
    organizerSamplesMs,
    pairedCandidateSamplesMs: [...report.latency.pairedCandidateSamplesMs],
    tutorOrchestrationSamplesMs,
    tutorP95Ms: nearestRankP95(tutorSamplesMs)!,
    organizerP95Ms: nearestRankP95(organizerSamplesMs)!,
    pairedCandidateP95Ms: nearestRankP95(report.latency.pairedCandidateSamplesMs)!,
    tutorOrchestrationP95Ms: nearestRankP95(tutorOrchestrationSamplesMs)!,
  };
  if (
    expectedLatency.pairedCandidateSamplesMs.some(
      (value, index) =>
        value <
        Math.max(
          expectedLatency.tutorSamplesMs[index] ?? 0,
          expectedLatency.organizerSamplesMs[index] ?? 0,
        ),
    ) ||
    expectedLatency.tutorOrchestrationSamplesMs.some(
      (value, index) => value < (expectedLatency.tutorSamplesMs[index] ?? 0),
    )
  ) {
    addIssue(context, 'latency window mismatch');
  }
  if (!sameJson(report.latency, expectedLatency)) {
    addIssue(context, 'latency mismatch');
  }

  validateEntryUsage(runtime, context);
  const usages = runtime.flatMap((entry) => (entry.usage ? [entry.usage] : []));
  const totalCost = usages.reduce((sum, usage) => sum + usage.estimatedCostCny, 0);
  const expectedUsage = {
    attemptedCases: 48 as const,
    verifiedCases: usages.length,
    inputTokens: usages.reduce((sum, usage) => sum + usage.inputTokens, 0),
    outputTokens: usages.reduce((sum, usage) => sum + usage.outputTokens, 0),
    pricingKnown: usages.length === 48,
    currency: 'CNY' as const,
    pricingProfile: usages.length === 48 ? PHASE_6_9_7_PRICING_PROFILE : null,
    totalCostCny: usages.length === 48 ? totalCost : null,
  };
  if (!sameJson(report.usage, expectedUsage)) addIssue(context, 'usage mismatch');

  const expectedSafety = {
    zeroCallVerified: report.caseEntries.filter((entry) => expectedZeroCallVerified(entry)).length,
    strictRuntimeSuccesses: runtime.filter((entry) => expectedStrictRuntimeSuccess(entry)).length,
    criticalFailures: report.caseEntries.filter((entry) => entry.criticalFailure).length,
    permissionFailures: report.caseEntries.filter((entry) => entry.permissionFailure).length,
    mutationFailures: report.caseEntries.filter((entry) => entry.mutationFailure).length,
    broaderFallbacks: report.caseEntries.filter((entry) => entry.broaderThanDeterministicFallback)
      .length,
  };
  for (const entry of report.caseEntries) {
    if (entry.zeroCallVerified !== expectedZeroCallVerified(entry)) {
      addIssue(context, `zero-call verification mismatch: ${entry.caseId}`);
    }
    if (entry.strictRuntimeSuccess !== expectedStrictRuntimeSuccess(entry)) {
      addIssue(context, `runtime success mismatch: ${entry.caseId}`);
    }
  }
  if (!sameJson(report.safety, expectedSafety)) {
    addIssue(context, 'safety counters mismatch');
  }
  if (report.gate !== computePhase697TutorOrganizerGate(report)) {
    addIssue(context, 'gate mismatch');
  }
}

function validateEntryUsage(
  runtime: readonly Phase697TutorOrganizerCaseEntry[],
  context: z.RefinementCtx,
) {
  for (const entry of runtime) {
    const usage = entry.usage;
    if (!usage) continue;
    const tutor = entry.agent === 'tutor';
    const expectedCost = (usage.inputTokens * 3 + usage.outputTokens * 6) / 1_000_000;
    if (
      Math.abs(usage.estimatedCostCny - expectedCost) > 1e-12 ||
      usage.inputTokens > (tutor ? 1_200 : 3_500) ||
      usage.outputTokens > (tutor ? 300 : 800) ||
      usage.estimatedCostCny > (tutor ? 0.006 : 0.016)
    ) {
      addIssue(context, `usage cost provenance mismatch: ${entry.caseId}`);
    }
  }
  for (let index = 0; index < 24; index += 1) {
    const pair = runtime.filter((entry) => entry.pairedRunIndex === index);
    const pairCost = pair.reduce((sum, entry) => sum + (entry.usage?.estimatedCostCny ?? 0), 0);
    if (pairCost > 0.022) addIssue(context, `paired cost cap exceeded: ${index}`);
  }
}

function expectedZeroCallVerified(entry: Phase697TutorOrganizerCaseEntry) {
  if (entry.executionKind !== 'zero_call') return false;
  const expected = PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.find(
    (candidate) => candidate.id === entry.caseId,
  );
  return (
    expected?.expectedRuntimeInvocations === 0 &&
    entry.runtimeInvocations === 0 &&
    entry.observedZeroCallReason === expected.expected.zeroCallReason
  );
}

function expectedStrictRuntimeSuccess(entry: Phase697TutorOrganizerCaseEntry) {
  return (
    entry.executionKind === 'runtime' &&
    entry.runtimeInvocations === 1 &&
    entry.rawSchemaValid === true &&
    entry.candidateDisposition === 'candidate_applied' &&
    entry.canonicalSchemaSuccess &&
    entry.latencyMs !== null &&
    entry.usage !== null &&
    !entry.criticalFailure &&
    !entry.permissionFailure &&
    !entry.mutationFailure &&
    !entry.broaderThanDeterministicFallback
  );
}

function orderedLatencies(entries: readonly Phase697TutorOrganizerCaseEntry[]) {
  return [...entries].sort(comparePairedIndex).map((entry) => entry.latencyMs!);
}

function comparePairedIndex(
  left: Phase697TutorOrganizerCaseEntry,
  right: Phase697TutorOrganizerCaseEntry,
) {
  return left.pairedRunIndex! - right.pairedRunIndex!;
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
