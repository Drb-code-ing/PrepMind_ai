import { z } from 'zod';

import {
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  MODEL_AGENT_STRUCTURED_OUTPUT_STAGES,
  type ModelAgentProviderFailureCategory,
  type ModelAgentStructuredOutputStage,
} from '@repo/ai';

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
  PHASE_6_9_7_CANONICAL_FAILURE_REASONS,
  PHASE_6_9_7_CANONICAL_VALIDATION_STAGES,
} from './phase-6-9-tutor-wrong-question-bounded-diagnostics.ts';
import {
  PHASE_6_9_7_CASE_ENTRY_SCHEMA,
  PHASE_6_9_7_EXECUTOR_PROVENANCES,
  PHASE_6_9_7_METRICS_SCHEMA,
  PHASE_6_9_7_ORGANIZER_BASELINE_SEMANTIC_SCORE,
  PHASE_6_9_7_ORGANIZER_SCHEMA_VERSION,
  PHASE_6_9_7_PRICING_PROFILE,
  PHASE_6_9_7_SAFETY_SCHEMA,
  PHASE_6_9_7_TUTOR_BASELINE_SEMANTIC_SCORE,
  PHASE_6_9_7_TUTOR_SCHEMA_VERSION,
} from './phase-6-9-tutor-wrong-question-paired-contract.ts';
import type { ModelCandidateObservation } from '../model-candidates/model-candidate-policy.ts';
import { TUTOR_MODEL_PROJECTION_VERSION } from '../model-candidates/tutor-model-projection.ts';
import { WRONG_QUESTION_ORGANIZER_MODEL_PROJECTION_VERSION } from '../model-candidates/wrong-question-organizer-model-projection.ts';

export const PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3 =
  'phase-6.9.7-tutor-organizer-runner-v3' as const;
export const PHASE_6_9_7_TUTOR_PROMPT_VERSION_V3 = 'tutor-model-candidate-v3' as const;
export const PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V3 =
  'wrong-question-organizer-model-candidate-v3' as const;
export const PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V3 =
  'sha256:91be509194de33c8d99d7a09fa6ef387c6f31aa06d19d8fd970800731047fc6a' as const;
export const PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V3 =
  'sha256:2947cea2a7bc5d64c9daf29d8b371e9825bc0423d707ff173a2c5057ee9fdffd' as const;
export const PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION =
  'phase-6.9.7-v3-runtime-evidence-v1' as const;

export const PHASE_6_9_7_V3_LAST_COMPLETED_STAGES = [
  'config_validated',
  'executor_ready',
  'request_validated',
  'delegate_started',
  'delegate_returned',
  'response_audit_passed',
  'structured_object_captured',
  'dynamic_contract_passed',
  'local_merger_passed',
  'applied',
] as const;

export const PHASE_6_9_7_V3_EXECUTION_OUTCOMES = [
  'executed_success',
  'executed_failure',
  'attempted_aborted',
  'attempted_orphaned',
  'not_started_case_guard',
  'not_started_quality_breaker',
  'not_started_parent_abort',
  'not_started_orphaned',
  'harness_internal_error',
] as const;

export const PHASE_6_9_7_V3_USAGE_DISPOSITIONS = [
  'verified',
  'unknown_after_attempt',
  'absent_not_attempted',
] as const;

const NOT_STARTED_OUTCOMES = new Set<string>([
  'not_started_case_guard',
  'not_started_quality_breaker',
  'not_started_parent_abort',
  'not_started_orphaned',
]);

const providerFailureCategorySchema = z.enum(MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES);
const structuredOutputStageSchema = z.enum(MODEL_AGENT_STRUCTURED_OUTPUT_STAGES);

export const PHASE_6_9_7_V3_RUNTIME_EVIDENCE_SCHEMA = z
  .object({
    runtimeEvidenceVersion: z.literal(PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION),
    runtimeInvocations: z.union([z.literal(0), z.literal(1)]),
    providerFailureCategory: providerFailureCategorySchema.nullable(),
    structuredOutputStage: structuredOutputStageSchema.nullable(),
    lastCompletedStage: z.enum(PHASE_6_9_7_V3_LAST_COMPLETED_STAGES).nullable(),
    executionOutcome: z.enum(PHASE_6_9_7_V3_EXECUTION_OUTCOMES),
    usageDisposition: z.enum(PHASE_6_9_7_V3_USAGE_DISPOSITIONS),
  })
  .strict()
  .superRefine((value, context) => {
    const addIssue = (message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, message });
    const completedStageIndex =
      value.lastCompletedStage === null
        ? -1
        : PHASE_6_9_7_V3_LAST_COMPLETED_STAGES.indexOf(value.lastCompletedStage);
    const delegateStartedIndex = PHASE_6_9_7_V3_LAST_COMPLETED_STAGES.indexOf('delegate_started');

    if (
      (value.runtimeInvocations === 0 && completedStageIndex >= delegateStartedIndex) ||
      (value.runtimeInvocations === 1 &&
        completedStageIndex < delegateStartedIndex &&
        value.executionOutcome !== 'attempted_orphaned')
    ) {
      addIssue('runtime invocation and completed stage mismatch');
    }

    if (
      value.structuredOutputStage !== null &&
      value.providerFailureCategory !== 'structured_output'
    ) {
      addIssue('structured output stage requires structured_output category');
    }

    if (value.executionOutcome === 'executed_success') {
      if (
        value.runtimeInvocations !== 1 ||
        value.usageDisposition !== 'verified' ||
        value.lastCompletedStage !== 'applied' ||
        value.providerFailureCategory !== null ||
        value.structuredOutputStage !== null
      ) {
        addIssue('executed success evidence mismatch');
      }
      return;
    }

    if (value.executionOutcome === 'executed_failure') {
      if (
        value.runtimeInvocations !== 1 ||
        value.usageDisposition === 'absent_not_attempted' ||
        value.lastCompletedStage === null
      ) {
        addIssue('executed failure evidence mismatch');
      }
      return;
    }

    if (
      value.executionOutcome === 'attempted_aborted' ||
      value.executionOutcome === 'attempted_orphaned'
    ) {
      if (
        value.runtimeInvocations !== 1 ||
        value.usageDisposition !== 'unknown_after_attempt' ||
        value.lastCompletedStage === 'applied' ||
        value.providerFailureCategory !== null ||
        value.structuredOutputStage !== null
      ) {
        addIssue('attempted terminal evidence mismatch');
      }
      return;
    }

    if (NOT_STARTED_OUTCOMES.has(value.executionOutcome)) {
      if (
        value.runtimeInvocations !== 0 ||
        value.usageDisposition !== 'absent_not_attempted' ||
        value.lastCompletedStage !== null ||
        value.providerFailureCategory !== null ||
        value.structuredOutputStage !== null
      ) {
        addIssue('not-started evidence mismatch');
      }
      return;
    }

    if (
      value.executionOutcome === 'harness_internal_error' &&
      ((value.runtimeInvocations === 0 && value.usageDisposition !== 'absent_not_attempted') ||
        (value.runtimeInvocations === 1 && value.usageDisposition !== 'unknown_after_attempt') ||
        value.providerFailureCategory !== null ||
        value.structuredOutputStage !== null)
    ) {
      addIssue('harness failure evidence mismatch');
    }
  });

export type Phase697V3RuntimeEvidence = z.infer<typeof PHASE_6_9_7_V3_RUNTIME_EVIDENCE_SCHEMA>;

export type Phase697V3RuntimeEvidenceProjectionInput = Readonly<{
  runtimeInvocations: 0 | 1;
  lastCompletedStage: Phase697V3RuntimeEvidence['lastCompletedStage'];
  executionOutcome: Phase697V3RuntimeEvidence['executionOutcome'];
  usageDisposition: Phase697V3RuntimeEvidence['usageDisposition'];
  observation: ModelCandidateObservation<string> | null;
}>;

export function projectPhase697V3RuntimeEvidence(
  input: Phase697V3RuntimeEvidenceProjectionInput,
): Readonly<Phase697V3RuntimeEvidence> | null {
  try {
    const provider = readBoundedProviderDiagnostic(input.observation);
    if (provider === null) return null;
    const parsed = PHASE_6_9_7_V3_RUNTIME_EVIDENCE_SCHEMA.safeParse({
      runtimeEvidenceVersion: PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
      runtimeInvocations: input.runtimeInvocations,
      providerFailureCategory: provider.providerFailureCategory,
      structuredOutputStage: provider.structuredOutputStage,
      lastCompletedStage: input.lastCompletedStage,
      executionOutcome: input.executionOutcome,
      usageDisposition: input.usageDisposition,
    });
    return parsed.success ? Object.freeze(parsed.data) : null;
  } catch {
    return null;
  }
}

type BoundedProviderDiagnostic = Readonly<{
  providerFailureCategory: ModelAgentProviderFailureCategory | null;
  structuredOutputStage: ModelAgentStructuredOutputStage | null;
}>;

function readBoundedProviderDiagnostic(observation: unknown): BoundedProviderDiagnostic | null {
  if (observation === null) {
    return { providerFailureCategory: null, structuredOutputStage: null };
  }
  if (!isPlainRecord(observation)) return null;
  const attempted = readOwnValue(observation, 'attempted');
  if (attempted === false) {
    return { providerFailureCategory: null, structuredOutputStage: null };
  }
  if (attempted !== true) return null;

  const trace = readOwnValue(observation, 'trace');
  if (trace === undefined) {
    return readOwnValue(observation, 'traceUnavailable') === true
      ? { providerFailureCategory: null, structuredOutputStage: null }
      : null;
  }
  if (!isPlainRecord(trace)) return null;

  const providerFailureCategory = readOwnValue(trace, 'providerFailureCategory');
  const structuredOutputStage = readOwnValue(trace, 'structuredOutputStage');
  const errorCode = readOwnValue(trace, 'errorCode');
  const status = readOwnValue(trace, 'status');
  if (
    providerFailureCategory !== undefined &&
    !MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES.includes(
      providerFailureCategory as ModelAgentProviderFailureCategory,
    )
  ) {
    return null;
  }
  if (
    structuredOutputStage !== undefined &&
    !MODEL_AGENT_STRUCTURED_OUTPUT_STAGES.includes(
      structuredOutputStage as ModelAgentStructuredOutputStage,
    )
  ) {
    return null;
  }
  if (
    (providerFailureCategory !== undefined &&
      (errorCode !== 'PROVIDER_ERROR' || status !== 'failed')) ||
    (structuredOutputStage !== undefined && providerFailureCategory !== 'structured_output')
  ) {
    return null;
  }
  return {
    providerFailureCategory:
      (providerFailureCategory as ModelAgentProviderFailureCategory | undefined) ?? null,
    structuredOutputStage:
      (structuredOutputStage as ModelAgentStructuredOutputStage | undefined) ?? null,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function readOwnValue(value: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

const safeCount = z.number().int().safe().nonnegative();
const runtimeCount = z.number().int().min(0).max(48);
const laneCount = z.number().int().min(0).max(24);
const pairedCount = z.number().int().min(0).max(24);
const latencyValue = z.number().finite().nonnegative();
const v3AgentSchema = z.enum(['tutor', 'wrong_question_organizer']);
const v3CaseIdSchema = z.string().regex(/^(tutor|organizer)-[a-z0-9-]+$/);

const providerFailureCategoryCountsSchema = z
  .object({
    http_auth: safeCount,
    http_rate_limit: safeCount,
    http_client: safeCount,
    http_server: safeCount,
    transport: safeCount,
    structured_output: safeCount,
    invalid_response: safeCount,
    unknown: safeCount,
  })
  .strict();

const structuredOutputStageCountsSchema = z
  .object({
    provider_json_parse: safeCount,
    provider_type_validation: safeCount,
    provider_object_missing: safeCount,
  })
  .strict();

const executionOutcomeCountsSchema = z
  .object({
    executed_success: safeCount,
    executed_failure: safeCount,
    attempted_aborted: safeCount,
    attempted_orphaned: safeCount,
    not_started_case_guard: safeCount,
    not_started_quality_breaker: safeCount,
    not_started_parent_abort: safeCount,
    not_started_orphaned: safeCount,
    harness_internal_error: safeCount,
  })
  .strict();

export type Phase697V3RuntimeContractProbe = Readonly<{
  executionKind: 'zero_call' | 'runtime';
  agent: 'tutor' | 'wrong_question_organizer';
  runtimeInvocations: number;
  rawSchemaValid: boolean | null;
  candidateDisposition: string | null;
  canonicalSchemaSuccess: boolean;
  canonicalValidationStage: string | null;
  canonicalFailureReason: string | null;
  latencyMs: number | null;
  usage: unknown;
  usageDisposition: Phase697V3RuntimeEvidence['usageDisposition'];
  criticalFailure: boolean;
  permissionFailure: boolean;
  mutationFailure: boolean;
  broaderThanDeterministicFallback: boolean;
}>;

export function isPhase697V3CaseUsageVerified(
  agent: 'tutor' | 'wrong_question_organizer',
  usage: unknown,
): usage is Readonly<{
  inputTokens: number;
  outputTokens: number;
  estimatedCostCny: number;
}> {
  if (!isPlainRecord(usage)) return false;
  const inputTokens = readOwnValue(usage, 'inputTokens');
  const outputTokens = readOwnValue(usage, 'outputTokens');
  const estimatedCostCny = readOwnValue(usage, 'estimatedCostCny');
  if (
    !Number.isSafeInteger(inputTokens) ||
    !Number.isSafeInteger(outputTokens) ||
    typeof estimatedCostCny !== 'number' ||
    !Number.isFinite(estimatedCostCny) ||
    (inputTokens as number) <= 0 ||
    (outputTokens as number) <= 0 ||
    estimatedCostCny <= 0
  ) {
    return false;
  }
  const inputCap = agent === 'tutor' ? 1_200 : 3_500;
  const outputCap = agent === 'tutor' ? 300 : 800;
  const costCap = agent === 'tutor' ? 0.006 : 0.016;
  const expectedCost = ((inputTokens as number) * 3 + (outputTokens as number) * 6) / 1_000_000;
  if (
    (inputTokens as number) > inputCap ||
    (outputTokens as number) > outputCap ||
    estimatedCostCny > costCap ||
    Math.abs(estimatedCostCny - expectedCost) > 1e-12
  ) {
    return false;
  }
  const pricingKnown = readOwnValue(usage, 'pricingKnown');
  const currency = readOwnValue(usage, 'currency');
  const pricingProfile = readOwnValue(usage, 'pricingProfile');
  return (
    (pricingKnown === undefined || pricingKnown === true) &&
    (currency === undefined || currency === 'CNY') &&
    (pricingProfile === undefined || pricingProfile === PHASE_6_9_7_PRICING_PROFILE)
  );
}

export function runtimeContractSuccess(entry: Phase697V3RuntimeContractProbe): boolean {
  return (
    entry.executionKind === 'runtime' &&
    entry.runtimeInvocations === 1 &&
    entry.rawSchemaValid === true &&
    entry.candidateDisposition === 'candidate_applied' &&
    entry.canonicalSchemaSuccess &&
    entry.canonicalValidationStage === 'applied' &&
    entry.canonicalFailureReason === null &&
    typeof entry.latencyMs === 'number' &&
    Number.isFinite(entry.latencyMs) &&
    entry.latencyMs >= 0 &&
    entry.usageDisposition === 'verified' &&
    isPhase697V3CaseUsageVerified(entry.agent, entry.usage) &&
    !entry.criticalFailure &&
    !entry.permissionFailure &&
    !entry.mutationFailure &&
    !entry.broaderThanDeterministicFallback
  );
}

export const PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA = PHASE_6_9_7_CASE_ENTRY_SCHEMA.extend({
  canonicalValidationStage: z.enum(PHASE_6_9_7_CANONICAL_VALIDATION_STAGES).nullable(),
  canonicalFailureReason: z.enum(PHASE_6_9_7_CANONICAL_FAILURE_REASONS).nullable(),
  runtimeEvidenceVersion: z.literal(PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION),
  providerFailureCategory: providerFailureCategorySchema.nullable(),
  structuredOutputStage: structuredOutputStageSchema.nullable(),
  lastCompletedStage: z.enum(PHASE_6_9_7_V3_LAST_COMPLETED_STAGES).nullable(),
  executionOutcome: z.enum(PHASE_6_9_7_V3_EXECUTION_OUTCOMES),
  usageDisposition: z.enum(PHASE_6_9_7_V3_USAGE_DISPOSITIONS),
  dispatchRecorded: z.boolean(),
  runtimeTerminalRecorded: z.boolean(),
}).superRefine((entry, context) => {
  const runtimeEvidence = PHASE_6_9_7_V3_RUNTIME_EVIDENCE_SCHEMA.safeParse({
    runtimeEvidenceVersion: entry.runtimeEvidenceVersion,
    runtimeInvocations: entry.runtimeInvocations,
    providerFailureCategory: entry.providerFailureCategory,
    structuredOutputStage: entry.structuredOutputStage,
    lastCompletedStage: entry.lastCompletedStage,
    executionOutcome: entry.executionOutcome,
    usageDisposition: entry.usageDisposition,
  });
  if (!runtimeEvidence.success) {
    addV3Issue(context, 'runtime evidence mismatch');
  }

  const strictSuccess = runtimeContractSuccess(entry);
  if (entry.strictRuntimeSuccess !== strictSuccess) {
    addV3Issue(context, 'runtime contract success mismatch');
  }
  if ((entry.executionOutcome === 'executed_success') !== strictSuccess) {
    addV3Issue(context, 'execution outcome success mismatch');
  }
  if (entry.usageDisposition === 'verified') {
    if (!isPhase697V3CaseUsageVerified(entry.agent, entry.usage)) {
      addV3Issue(context, 'verified usage mismatch');
    }
  } else if (entry.usage !== null) {
    addV3Issue(context, 'unverified usage must remain absent');
  }

  const structuredObjectIndex = PHASE_6_9_7_V3_LAST_COMPLETED_STAGES.indexOf(
    'structured_object_captured',
  );
  const completedIndex = entry.lastCompletedStage
    ? PHASE_6_9_7_V3_LAST_COMPLETED_STAGES.indexOf(entry.lastCompletedStage)
    : -1;
  if (
    completedIndex < structuredObjectIndex &&
    (entry.canonicalValidationStage !== null || entry.canonicalFailureReason !== null)
  ) {
    addV3Issue(context, 'pre-structured canonical diagnostics mismatch');
  }
  if (
    entry.canonicalValidationStage === 'applied' &&
    (entry.canonicalFailureReason !== null ||
      !entry.canonicalSchemaSuccess ||
      entry.candidateDisposition !== 'candidate_applied')
  ) {
    addV3Issue(context, 'applied canonical diagnostics mismatch');
  }

  const notStarted = entry.executionOutcome.startsWith('not_started_');
  if (
    (entry.runtimeInvocations === 1 && !entry.dispatchRecorded) ||
    (entry.executionKind === 'zero_call' && entry.dispatchRecorded) ||
    ((entry.executionOutcome === 'not_started_case_guard' ||
      entry.executionOutcome === 'not_started_quality_breaker') &&
      entry.dispatchRecorded) ||
    (entry.runtimeTerminalRecorded &&
      (entry.executionKind !== 'runtime' || !entry.dispatchRecorded))
  ) {
    addV3Issue(context, 'durable dispatch evidence mismatch');
  }
  if (entry.executionKind === 'zero_call') {
    if (
      entry.pairedRunIndex !== null ||
      entry.strictRuntimeSuccess ||
      entry.tutorExpected !== null ||
      entry.tutorActual !== null ||
      entry.organizerDecisions.length !== 0
    ) {
      addV3Issue(context, 'zero-call V3 entry mismatch');
    }
  } else if (entry.pairedRunIndex === null) {
    addV3Issue(context, 'runtime paired index missing');
  }

  if (entry.executionKind === 'runtime' && notStarted) {
    if (
      entry.rawSchemaValid !== null ||
      entry.candidateDisposition !== null ||
      entry.canonicalSchemaSuccess ||
      entry.canonicalValidationStage !== null ||
      entry.canonicalFailureReason !== null ||
      entry.latencyMs !== null ||
      entry.tutorOrchestrationLatencyMs !== null ||
      entry.usage !== null ||
      entry.tutorActual !== null ||
      entry.organizerDecisions.some(
        (decision) =>
          decision.actualSubject !== null ||
          decision.actualDeckAction !== null ||
          decision.actualDeckIndex !== null ||
          decision.actualTopicLabelClass !== null ||
          decision.actualConfidence !== null ||
          decision.actualEvidenceCodes.length > 0 ||
          decision.validOutput,
      )
    ) {
      addV3Issue(context, 'not-started runtime entry mismatch');
    }
  }
});

export type Phase697V3CaseEntry = z.infer<typeof PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA>;

export const PHASE_6_9_7_V3_LATENCY_SCHEMA = z
  .object({
    tutorSamplesMs: z.array(latencyValue).max(24),
    organizerSamplesMs: z.array(latencyValue).max(24),
    pairedCandidateSamplesMs: z.array(latencyValue).max(24),
    tutorOrchestrationSamplesMs: z.array(latencyValue).max(24),
    tutorSampleCount: laneCount,
    organizerSampleCount: laneCount,
    pairedCandidateSampleCount: pairedCount,
    tutorOrchestrationSampleCount: laneCount,
    latencySampleComplete: z.boolean(),
    tutorP95Ms: latencyValue.nullable(),
    organizerP95Ms: latencyValue.nullable(),
    pairedCandidateP95Ms: latencyValue.nullable(),
    tutorOrchestrationP95Ms: latencyValue.nullable(),
  })
  .strict();

export const PHASE_6_9_7_V3_USAGE_SUMMARY_SCHEMA = z
  .object({
    plannedCases: z.literal(48),
    executorStartedCases: runtimeCount,
    verifiedCases: runtimeCount,
    unknownCases: runtimeCount,
    notStartedCases: runtimeCount,
    inputTokens: safeCount,
    outputTokens: safeCount,
    pricingKnown: z.boolean(),
    currency: z.literal('CNY'),
    pricingProfile: z.literal(PHASE_6_9_7_PRICING_PROFILE).nullable(),
    totalCostCny: z.number().finite().positive().nullable(),
  })
  .strict();

const v3LaneSummarySchema = z
  .object({
    plannedCases: z.literal(24),
    dispatchLedgerEntries: laneCount,
    executorStartedCases: laneCount,
    terminalCases: z.literal(24),
    usageVerifiedCases: laneCount,
    usageUnknownCases: laneCount,
    notStartedCases: laneCount,
    abortedCases: laneCount,
    budget: z
      .object({
        maxCallsPerCase: z.literal(1),
        maxInputTokensPerCase: z.union([z.literal(1_200), z.literal(3_500)]),
        maxOutputTokensPerCase: z.union([z.literal(300), z.literal(800)]),
      })
      .strict(),
  })
  .strict();

const v3ReportBaseSchema = z
  .object({
    runId: z.string().uuid(),
    runScope: z.enum(['branch', 'main']),
    mode: z.enum(['mock', 'live']),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3),
    datasetVersion: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION),
    datasetSha256: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256),
    identities: z
      .object({
        tutorPromptVersion: z.literal(PHASE_6_9_7_TUTOR_PROMPT_VERSION_V3),
        organizerPromptVersion: z.literal(PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V3),
        tutorPromptContentSha256: z.literal(PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V3),
        organizerPromptContentSha256: z.literal(PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V3),
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
    latency: PHASE_6_9_7_V3_LATENCY_SCHEMA,
    usage: PHASE_6_9_7_V3_USAGE_SUMMARY_SCHEMA,
    safety: PHASE_6_9_7_SAFETY_SCHEMA,
    execution: z
      .object({
        executorStartedCases: z.number().int().min(0).max(72),
        usageVerifiedCases: z.number().int().min(0).max(72),
        usageUnknownCases: z.number().int().min(0).max(72),
        notStartedCases: z.number().int().min(0).max(72),
        providerFailureCategoryCounts: providerFailureCategoryCountsSchema,
        structuredOutputStageCounts: structuredOutputStageCountsSchema,
        executionOutcomeCounts: executionOutcomeCountsSchema,
      })
      .strict(),
    scheduler: z
      .object({
        guardPhasePassed: z.boolean(),
        breakerState: z.enum(['closed', 'guard_failed', 'quality_gate_impossible']),
        triggerCaseId: v3CaseIdSchema.nullable(),
        triggerAgent: v3AgentSchema.nullable(),
        triggerPairedRunIndex: z.number().int().min(0).max(23).nullable(),
        dispatchedPairs: pairedCount,
        completedPairs: pairedCount,
        maxConcurrentPairs: z.number().int().min(0).max(1),
        maxConcurrentLaneOperations: z.number().int().min(0).max(2),
      })
      .strict(),
    ledger: z
      .object({
        reservedEntries: runtimeCount,
        terminalEntries: runtimeCount,
      })
      .strict(),
    lanes: z
      .object({
        tutor: v3LaneSummarySchema,
        organizer: v3LaneSummarySchema,
      })
      .strict(),
    caseEntries: z.array(PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA).length(72),
    gate: z.enum(['quality_gate_passed', 'quality_gate_failed']),
  })
  .strict();

export type Phase697TutorOrganizerV3ReportInput = z.infer<typeof v3ReportBaseSchema>;
export type Phase697TutorOrganizerV3Report = Phase697TutorOrganizerV3ReportInput;

export const PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA = v3ReportBaseSchema.superRefine(
  (report, context) => {
    validateV3ModeIdentity(report, context);
    validateV3CanonicalCases(report, context);
    validateV3DerivedFields(report, context);
  },
);

export function computePhase697TutorOrganizerV3Gate(
  report: Phase697TutorOrganizerV3ReportInput,
): 'quality_gate_passed' | 'quality_gate_failed' {
  const passes =
    report.mode === 'live' &&
    report.provider === 'deepseek' &&
    report.model === 'deepseek-v4-pro' &&
    report.identities.structuredOutputMode === 'deepseek_v4_pro_nonthinking_json' &&
    report.identities.executorProvenance === 'deepseek_network' &&
    report.scheduler.guardPhasePassed &&
    report.scheduler.breakerState === 'closed' &&
    report.ledger.reservedEntries === 48 &&
    report.ledger.terminalEntries === 48 &&
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
    report.latency.latencySampleComplete &&
    report.latency.tutorP95Ms !== null &&
    report.latency.tutorP95Ms <= 2_500 &&
    report.latency.organizerP95Ms !== null &&
    report.latency.organizerP95Ms <= 4_500 &&
    report.latency.pairedCandidateP95Ms !== null &&
    report.latency.pairedCandidateP95Ms <= 4_500 &&
    report.latency.tutorOrchestrationP95Ms !== null &&
    report.latency.tutorOrchestrationP95Ms <= 6_500 &&
    report.usage.executorStartedCases === 48 &&
    report.usage.verifiedCases === 48 &&
    report.usage.unknownCases === 0 &&
    report.usage.notStartedCases === 0 &&
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

export type Phase697TutorOrganizerV3ReportBuildInput = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
  provider: 'mock' | 'deepseek';
  model: 'mock' | 'deepseek-v4-pro';
  structuredOutputMode: 'mock_json_v1' | 'deepseek_v4_pro_nonthinking_json';
  executorProvenance: 'mock_synthetic' | 'deepseek_network' | 'synthetic_test';
  caseEntries: readonly Phase697V3CaseEntry[];
  pairedCandidateSamplesMs: readonly number[];
  scheduler: Phase697TutorOrganizerV3ReportInput['scheduler'];
  ledger: Phase697TutorOrganizerV3ReportInput['ledger'];
}>;

export function buildPhase697TutorOrganizerV3Report(
  input: Phase697TutorOrganizerV3ReportBuildInput,
): Phase697TutorOrganizerV3Report {
  const caseEntries = [...input.caseEntries];
  const runtime = caseEntries.filter((entry) => entry.executionKind === 'runtime');
  const tutors = runtime.filter((entry) => entry.agent === 'tutor');
  const organizers = runtime.filter((entry) => entry.agent === 'wrong_question_organizer');
  const computed = buildTutorWrongQuestionSemanticMetrics(
    tutors.map((entry) => ({
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
    organizers.flatMap((entry) =>
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
  if (!computed.ok) throw new Error('PHASE_6_9_7_V3_METRICS_INVALID');

  const tutorSamplesMs = orderedV3Latency(tutors, 'latencyMs');
  const organizerSamplesMs = orderedV3Latency(organizers, 'latencyMs');
  const tutorOrchestrationSamplesMs = orderedV3Latency(tutors, 'tutorOrchestrationLatencyMs');
  const pairedCandidateSamplesMs = [...input.pairedCandidateSamplesMs];
  const report: Phase697TutorOrganizerV3ReportInput = {
    runId: input.runId,
    runScope: input.runScope,
    mode: input.mode,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3,
    datasetVersion: PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION,
    datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
    identities: {
      tutorPromptVersion: PHASE_6_9_7_TUTOR_PROMPT_VERSION_V3,
      organizerPromptVersion: PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V3,
      tutorPromptContentSha256: PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V3,
      organizerPromptContentSha256: PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V3,
      tutorSchemaVersion: PHASE_6_9_7_TUTOR_SCHEMA_VERSION,
      organizerSchemaVersion: PHASE_6_9_7_ORGANIZER_SCHEMA_VERSION,
      tutorProjectionVersion: TUTOR_MODEL_PROJECTION_VERSION,
      organizerProjectionVersion: WRONG_QUESTION_ORGANIZER_MODEL_PROJECTION_VERSION,
      structuredOutputMode: input.structuredOutputMode,
      executorProvenance: input.executorProvenance,
    },
    provider: input.provider,
    model: input.model,
    counts: {
      cases: 72,
      zeroCall: 24,
      runtime: 48,
      pairedRequests: 24,
      organizerDecisionUnits: 32,
    },
    metrics: {
      tutorBaselineSemanticScore: PHASE_6_9_7_TUTOR_BASELINE_SEMANTIC_SCORE,
      organizerBaselineSemanticScore: PHASE_6_9_7_ORGANIZER_BASELINE_SEMANTIC_SCORE,
      tutorAbsoluteImprovement:
        computed.metrics.tutor.semanticScore - PHASE_6_9_7_TUTOR_BASELINE_SEMANTIC_SCORE,
      organizerAbsoluteImprovement:
        computed.metrics.organizer.semanticScore - PHASE_6_9_7_ORGANIZER_BASELINE_SEMANTIC_SCORE,
      tutor: { ...computed.metrics.tutor, scoredCases: 24 },
      organizer: { ...computed.metrics.organizer, scoredDecisions: 32 },
      combinedSemanticScore: computed.metrics.combinedSemanticScore,
    },
    latency: {
      tutorSamplesMs,
      organizerSamplesMs,
      pairedCandidateSamplesMs,
      tutorOrchestrationSamplesMs,
      tutorSampleCount: tutorSamplesMs.length,
      organizerSampleCount: organizerSamplesMs.length,
      pairedCandidateSampleCount: pairedCandidateSamplesMs.length,
      tutorOrchestrationSampleCount: tutorOrchestrationSamplesMs.length,
      latencySampleComplete:
        tutorSamplesMs.length === 24 &&
        organizerSamplesMs.length === 24 &&
        pairedCandidateSamplesMs.length === 24 &&
        tutorOrchestrationSamplesMs.length === 24 &&
        runtime.every(runtimeContractSuccess),
      tutorP95Ms: nearestRankP95(tutorSamplesMs),
      organizerP95Ms: nearestRankP95(organizerSamplesMs),
      pairedCandidateP95Ms: nearestRankP95(pairedCandidateSamplesMs),
      tutorOrchestrationP95Ms: nearestRankP95(tutorOrchestrationSamplesMs),
    },
    usage: deriveV3Usage(runtime),
    safety: {
      zeroCallVerified: caseEntries.filter((entry) => entry.zeroCallVerified).length,
      strictRuntimeSuccesses: runtime.filter(runtimeContractSuccess).length,
      criticalFailures: caseEntries.filter((entry) => entry.criticalFailure).length,
      permissionFailures: caseEntries.filter((entry) => entry.permissionFailure).length,
      mutationFailures: caseEntries.filter((entry) => entry.mutationFailure).length,
      broaderFallbacks: caseEntries.filter((entry) => entry.broaderThanDeterministicFallback)
        .length,
    },
    execution: deriveV3Execution(caseEntries),
    scheduler: input.scheduler,
    ledger: input.ledger,
    lanes: {
      tutor: deriveV3Lane(tutors, 'tutor'),
      organizer: deriveV3Lane(organizers, 'wrong_question_organizer'),
    },
    caseEntries,
    gate: 'quality_gate_failed',
  };
  report.gate = computePhase697TutorOrganizerV3Gate(report);
  return PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA.parse(report);
}

function validateV3ModeIdentity(
  report: Phase697TutorOrganizerV3ReportInput,
  context: z.RefinementCtx,
) {
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
  if (!valid) addV3Issue(context, 'V3 mode/provider/model identity mismatch');
}

function validateV3CanonicalCases(
  report: Phase697TutorOrganizerV3ReportInput,
  context: z.RefinementCtx,
) {
  const canonical = new Map<string, Phase69TutorWrongQuestionCase>(
    PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.map((entry) => [entry.id, entry]),
  );
  const ids = report.caseEntries.map((entry) => entry.caseId);
  if (new Set(ids).size !== 72 || ids.some((id) => !canonical.has(id))) {
    addV3Issue(context, 'V3 case ids must be unique and canonical');
    return;
  }
  for (const expected of PHASE_6_9_TUTOR_WRONG_QUESTION_CASES) {
    const actual = report.caseEntries.find((entry) => entry.caseId === expected.id);
    if (!actual || !v3EntryMatchesCase(actual, expected)) {
      addV3Issue(context, `V3 case contract mismatch: ${expected.id}`);
    }
  }
  for (let pairedRunIndex = 0; pairedRunIndex < 24; pairedRunIndex += 1) {
    const pair = report.caseEntries.filter((entry) => entry.pairedRunIndex === pairedRunIndex);
    if (
      pair.length !== 2 ||
      pair.filter((entry) => entry.agent === 'tutor').length !== 1 ||
      pair.filter((entry) => entry.agent === 'wrong_question_organizer').length !== 1
    ) {
      addV3Issue(context, `V3 paired run mismatch: ${pairedRunIndex}`);
    }
  }
}

function v3EntryMatchesCase(entry: Phase697V3CaseEntry, expected: Phase69TutorWrongQuestionCase) {
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
      entry.tutorExpected === null &&
      entry.tutorActual === null &&
      entry.organizerDecisions.length === 0 &&
      (!entry.zeroCallVerified ||
        (entry.runtimeInvocations === 0 &&
          entry.observedZeroCallReason === expected.expected.zeroCallReason))
    );
  }
  if (expected.agent === 'tutor') {
    return (
      sameV3Json(entry.tutorExpected, expected.expected) && entry.organizerDecisions.length === 0
    );
  }
  return (
    entry.tutorExpected === null &&
    entry.tutorActual === null &&
    entry.organizerDecisions.length === expected.expected.decisions.length &&
    expected.expected.decisions.every((decision) => {
      const actual = entry.organizerDecisions.find(
        (candidate) => candidate.decisionIndex === decision.questionIndex,
      );
      return (
        actual !== undefined &&
        actual.expectedSubject === decision.subject &&
        actual.expectedDeckAction === decision.deckAction &&
        actual.expectedDeckIndex === (decision.deckIndex ?? null) &&
        actual.canonicalTopicLabel === decision.canonicalTopicLabel &&
        actual.expectedConfidence === decision.confidence &&
        sameV3Json(actual.requiredEvidenceCodes, decision.requiredEvidenceCodes) &&
        sameV3Json(actual.allowedEvidenceCodes, decision.allowedEvidenceCodes)
      );
    })
  );
}

function validateV3DerivedFields(
  report: Phase697TutorOrganizerV3ReportInput,
  context: z.RefinementCtx,
) {
  const runtime = report.caseEntries.filter((entry) => entry.executionKind === 'runtime');
  const tutors = runtime.filter((entry) => entry.agent === 'tutor');
  const organizers = runtime.filter((entry) => entry.agent === 'wrong_question_organizer');
  const computed = buildTutorWrongQuestionSemanticMetrics(
    tutors.map((entry) => ({
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
    organizers.flatMap((entry) =>
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
    addV3Issue(context, 'V3 semantic metrics invalid');
    return;
  }
  const expectedMetrics = {
    tutorBaselineSemanticScore: PHASE_6_9_7_TUTOR_BASELINE_SEMANTIC_SCORE,
    organizerBaselineSemanticScore: PHASE_6_9_7_ORGANIZER_BASELINE_SEMANTIC_SCORE,
    tutorAbsoluteImprovement:
      computed.metrics.tutor.semanticScore - PHASE_6_9_7_TUTOR_BASELINE_SEMANTIC_SCORE,
    organizerAbsoluteImprovement:
      computed.metrics.organizer.semanticScore - PHASE_6_9_7_ORGANIZER_BASELINE_SEMANTIC_SCORE,
    tutor: { ...computed.metrics.tutor, scoredCases: 24 as const },
    organizer: { ...computed.metrics.organizer, scoredDecisions: 32 as const },
    combinedSemanticScore: computed.metrics.combinedSemanticScore,
  };
  if (!sameV3Json(report.metrics, expectedMetrics)) addV3Issue(context, 'V3 metrics mismatch');

  const tutorSamplesMs = orderedV3Latency(tutors, 'latencyMs');
  const organizerSamplesMs = orderedV3Latency(organizers, 'latencyMs');
  const tutorOrchestrationSamplesMs = orderedV3Latency(tutors, 'tutorOrchestrationLatencyMs');
  const latencyComplete =
    tutorSamplesMs.length === 24 &&
    organizerSamplesMs.length === 24 &&
    report.latency.pairedCandidateSamplesMs.length === 24 &&
    tutorOrchestrationSamplesMs.length === 24 &&
    runtime.every(runtimeContractSuccess);
  const expectedLatency = {
    tutorSamplesMs,
    organizerSamplesMs,
    pairedCandidateSamplesMs: [...report.latency.pairedCandidateSamplesMs],
    tutorOrchestrationSamplesMs,
    tutorSampleCount: tutorSamplesMs.length,
    organizerSampleCount: organizerSamplesMs.length,
    pairedCandidateSampleCount: report.latency.pairedCandidateSamplesMs.length,
    tutorOrchestrationSampleCount: tutorOrchestrationSamplesMs.length,
    latencySampleComplete: latencyComplete,
    tutorP95Ms: nearestRankP95(tutorSamplesMs),
    organizerP95Ms: nearestRankP95(organizerSamplesMs),
    pairedCandidateP95Ms: nearestRankP95(report.latency.pairedCandidateSamplesMs),
    tutorOrchestrationP95Ms: nearestRankP95(tutorOrchestrationSamplesMs),
  };
  if (!sameV3Json(report.latency, expectedLatency)) addV3Issue(context, 'V3 latency mismatch');
  if (
    report.latency.pairedCandidateSamplesMs.some(
      (value, index) =>
        value < Math.max(tutorSamplesMs[index] ?? 0, organizerSamplesMs[index] ?? 0),
    )
  ) {
    addV3Issue(context, 'V3 paired latency window mismatch');
  }

  const expectedUsage = deriveV3Usage(runtime);
  if (!sameV3Json(report.usage, expectedUsage)) addV3Issue(context, 'V3 usage mismatch');
  const expectedSafety = {
    zeroCallVerified: report.caseEntries.filter((entry) => entry.zeroCallVerified).length,
    strictRuntimeSuccesses: runtime.filter((entry) => runtimeContractSuccess(entry)).length,
    criticalFailures: report.caseEntries.filter((entry) => entry.criticalFailure).length,
    permissionFailures: report.caseEntries.filter((entry) => entry.permissionFailure).length,
    mutationFailures: report.caseEntries.filter((entry) => entry.mutationFailure).length,
    broaderFallbacks: report.caseEntries.filter((entry) => entry.broaderThanDeterministicFallback)
      .length,
  };
  if (!sameV3Json(report.safety, expectedSafety)) addV3Issue(context, 'V3 safety mismatch');
  const expectedExecution = deriveV3Execution(report.caseEntries);
  if (!sameV3Json(report.execution, expectedExecution)) {
    addV3Issue(context, 'V3 execution summary mismatch');
  }
  const expectedLanes = {
    tutor: deriveV3Lane(tutors, 'tutor'),
    organizer: deriveV3Lane(organizers, 'wrong_question_organizer'),
  };
  if (!sameV3Json(report.lanes, expectedLanes)) addV3Issue(context, 'V3 lane summary mismatch');

  const reservedRuntime = runtime.filter(isV3LedgerReserved);
  const reservedPairIndexes = new Set(reservedRuntime.map((entry) => entry.pairedRunIndex));
  const terminalRuntime = runtime.filter((entry) => entry.runtimeTerminalRecorded);
  const completedPairIndexes = new Set(
    [...reservedPairIndexes].filter(
      (pairedRunIndex) =>
        terminalRuntime.filter((entry) => entry.pairedRunIndex === pairedRunIndex).length === 2,
    ),
  );
  if (
    report.ledger.reservedEntries !== reservedRuntime.length ||
    report.ledger.terminalEntries !== terminalRuntime.length
  ) {
    addV3Issue(context, 'V3 ledger summary mismatch');
  }
  if (
    report.scheduler.dispatchedPairs !== reservedPairIndexes.size ||
    report.scheduler.completedPairs !== completedPairIndexes.size ||
    report.scheduler.maxConcurrentPairs !== (reservedPairIndexes.size > 0 ? 1 : 0) ||
    (reservedRuntime.length === 0
      ? report.scheduler.maxConcurrentLaneOperations !== 0
      : report.scheduler.maxConcurrentLaneOperations < 1)
  ) {
    addV3Issue(context, 'V3 scheduler counters mismatch');
  }
  validateV3Breaker(report, context);
  if (report.gate !== computePhase697TutorOrganizerV3Gate(report)) {
    addV3Issue(context, 'V3 gate mismatch');
  }
}

function validateV3Breaker(report: Phase697TutorOrganizerV3ReportInput, context: z.RefinementCtx) {
  const zeroCallFailure = report.caseEntries.find(
    (entry) => entry.executionKind === 'zero_call' && !entry.zeroCallVerified,
  );
  const runtime = report.caseEntries.filter((entry) => entry.executionKind === 'runtime');
  const allRuntimeStrict = runtime.every(runtimeContractSuccess);
  const expectedState = zeroCallFailure
    ? 'guard_failed'
    : allRuntimeStrict
      ? 'closed'
      : 'quality_gate_impossible';
  if (
    report.scheduler.guardPhasePassed !== !zeroCallFailure ||
    report.scheduler.breakerState !== expectedState
  ) {
    addV3Issue(context, 'V3 breaker state mismatch');
    return;
  }
  if (expectedState === 'closed') {
    if (
      report.scheduler.triggerCaseId !== null ||
      report.scheduler.triggerAgent !== null ||
      report.scheduler.triggerPairedRunIndex !== null
    ) {
      addV3Issue(context, 'closed V3 breaker trigger mismatch');
    }
    return;
  }
  const trigger = report.caseEntries.find(
    (entry) => entry.caseId === report.scheduler.triggerCaseId,
  );
  if (
    !trigger ||
    trigger.agent !== report.scheduler.triggerAgent ||
    (expectedState === 'guard_failed'
      ? trigger.executionKind !== 'zero_call' || trigger.zeroCallVerified
      : trigger.executionKind !== 'runtime' ||
        runtimeContractSuccess(trigger) ||
        trigger.pairedRunIndex !== report.scheduler.triggerPairedRunIndex)
  ) {
    addV3Issue(context, 'V3 breaker trigger mismatch');
  }
}

function deriveV3Usage(runtime: readonly Phase697V3CaseEntry[]) {
  const verified = runtime.filter((entry) => entry.usageDisposition === 'verified' && entry.usage);
  const executorStartedCases = runtime.filter((entry) => entry.runtimeInvocations === 1).length;
  const unknownCases = runtime.filter(
    (entry) => entry.usageDisposition === 'unknown_after_attempt',
  ).length;
  const notStartedCases = runtime.filter(
    (entry) => entry.usageDisposition === 'absent_not_attempted',
  ).length;
  const pricingKnown =
    executorStartedCases === 48 &&
    verified.length === 48 &&
    unknownCases === 0 &&
    notStartedCases === 0 &&
    runtime.every(runtimeContractSuccess);
  return {
    plannedCases: 48 as const,
    executorStartedCases,
    verifiedCases: verified.length,
    unknownCases,
    notStartedCases,
    inputTokens: verified.reduce((sum, entry) => sum + entry.usage!.inputTokens, 0),
    outputTokens: verified.reduce((sum, entry) => sum + entry.usage!.outputTokens, 0),
    pricingKnown,
    currency: 'CNY' as const,
    pricingProfile: pricingKnown ? PHASE_6_9_7_PRICING_PROFILE : null,
    totalCostCny: pricingKnown
      ? verified.reduce((sum, entry) => sum + entry.usage!.estimatedCostCny, 0)
      : null,
  };
}

function deriveV3Execution(caseEntries: readonly Phase697V3CaseEntry[]) {
  return {
    executorStartedCases: caseEntries.filter((entry) => entry.runtimeInvocations === 1).length,
    usageVerifiedCases: caseEntries.filter((entry) => entry.usageDisposition === 'verified').length,
    usageUnknownCases: caseEntries.filter(
      (entry) => entry.usageDisposition === 'unknown_after_attempt',
    ).length,
    notStartedCases: caseEntries.filter((entry) =>
      entry.executionOutcome.startsWith('not_started_'),
    ).length,
    providerFailureCategoryCounts: countV3Values(
      MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
      caseEntries.map((entry) => entry.providerFailureCategory),
    ),
    structuredOutputStageCounts: countV3Values(
      MODEL_AGENT_STRUCTURED_OUTPUT_STAGES,
      caseEntries.map((entry) => entry.structuredOutputStage),
    ),
    executionOutcomeCounts: countV3Values(
      PHASE_6_9_7_V3_EXECUTION_OUTCOMES,
      caseEntries.map((entry) => entry.executionOutcome),
    ),
  };
}

function deriveV3Lane(
  entries: readonly Phase697V3CaseEntry[],
  agent: 'tutor' | 'wrong_question_organizer',
) {
  return {
    plannedCases: 24 as const,
    dispatchLedgerEntries: entries.filter(isV3LedgerReserved).length,
    executorStartedCases: entries.filter((entry) => entry.runtimeInvocations === 1).length,
    terminalCases: 24 as const,
    usageVerifiedCases: entries.filter((entry) => entry.usageDisposition === 'verified').length,
    usageUnknownCases: entries.filter((entry) => entry.usageDisposition === 'unknown_after_attempt')
      .length,
    notStartedCases: entries.filter((entry) => entry.executionOutcome.startsWith('not_started_'))
      .length,
    abortedCases: entries.filter(
      (entry) =>
        entry.executionOutcome === 'attempted_aborted' ||
        entry.executionOutcome === 'not_started_parent_abort',
    ).length,
    budget: {
      maxCallsPerCase: 1 as const,
      maxInputTokensPerCase: agent === 'tutor' ? (1_200 as const) : (3_500 as const),
      maxOutputTokensPerCase: agent === 'tutor' ? (300 as const) : (800 as const),
    },
  };
}

function isV3LedgerReserved(entry: Phase697V3CaseEntry) {
  return entry.executionKind === 'runtime' && entry.dispatchRecorded;
}

function orderedV3Latency(
  entries: readonly Phase697V3CaseEntry[],
  field: 'latencyMs' | 'tutorOrchestrationLatencyMs',
) {
  return [...entries]
    .sort((left, right) => left.pairedRunIndex! - right.pairedRunIndex!)
    .flatMap((entry) => (entry[field] === null ? [] : [entry[field]]));
}

function countV3Values<const T extends readonly string[]>(
  values: T,
  actual: readonly unknown[],
): { [Key in T[number]]: number } {
  return Object.fromEntries(
    values.map((value) => [value, actual.filter((candidate) => candidate === value).length]),
  ) as { [Key in T[number]]: number };
}

function sameV3Json(left: unknown, right: unknown) {
  return JSON.stringify(sortV3ObjectKeys(left)) === JSON.stringify(sortV3ObjectKeys(right));
}

function sortV3ObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortV3ObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortV3ObjectKeys(child)]),
  );
}

function addV3Issue(context: z.RefinementCtx, message: string) {
  context.addIssue({ code: z.ZodIssueCode.custom, message });
}
