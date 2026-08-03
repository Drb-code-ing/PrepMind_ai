import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  MODEL_AGENT_STRUCTURED_OUTPUT_STAGES,
} from '@repo/ai';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_V5_DETERMINISTIC_BASELINE,
  PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256,
} from './phase-6-9-tutor-wrong-question-v2-baseline.ts';
import {
  PHASE_6_9_7_V6_DATASET_BINDING,
  PHASE_6_9_7_V6_DATASET_BINDING_SHA256,
  PHASE_6_9_7_V6_DATASET_BINDING_VERSION,
} from './phase-6-9-tutor-wrong-question-v6-dataset-binding.ts';
import {
  PHASE_6_9_7_V6_DURATION_STAGES,
  buildPhase697V6LatencyAggregate,
} from './phase-6-9-tutor-wrong-question-v6-deadline.ts';
import {
  scorePhase697V6ModelOwnedMetrics,
  type Phase697V6ModelOwnedMetrics,
} from './phase-6-9-tutor-wrong-question-v6-model-owned-metrics.ts';
import {
  PHASE_6_9_7_V6_EVAL_POLICY,
  PHASE_6_9_7_V6_EVAL_POLICY_SHA256,
  PHASE_6_9_7_V6_EVAL_POLICY_VERSION,
} from './phase-6-9-tutor-wrong-question-v6-policy.ts';
import { MODEL_CANDIDATE_DISPOSITIONS } from '../model-candidates/model-candidate-policy.ts';
import { clonePlainEvidenceData } from '../model-candidates/model-projection-safety.ts';
import {
  TUTOR_V5_LOCAL_SIGNAL_AUTHORITY_VERSION,
  TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256,
} from '../model-candidates/tutor-v5-local-signal-authority.ts';
import {
  TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256,
  TUTOR_V6_MODEL_PROMPT_VERSION,
} from '../model-candidates/tutor-v6-model-contract.ts';
import { TUTOR_V6_MODEL_PROJECTION_VERSION } from '../model-candidates/tutor-v6-model-projection.ts';
import {
  TUTOR_V6_PREFERRED_DEPTH_AUTHORITY_VERSION,
  TUTOR_V6_PREFERRED_DEPTH_RULES_SHA256,
} from '../model-candidates/tutor-v6-preferred-depth-authority.ts';
import { TUTOR_BOUNDED_INTENTS } from '../policies/tutor-strategy-policy.ts';
import {
  WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_SHA256,
  WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION,
} from '../model-candidates/wrong-question-organizer-v5-shortlist.ts';
import {
  WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_AUTHORITY_VERSION,
  WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_SHA256,
} from '../model-candidates/wrong-question-organizer-v6-confidence-authority.ts';
import {
  WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_SHA256,
  WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_VERSION,
} from '../model-candidates/wrong-question-organizer-v6-model-contract.ts';
import { WRONG_QUESTION_ORGANIZER_V6_MODEL_PROJECTION_VERSION } from '../model-candidates/wrong-question-organizer-v6-model-projection.ts';

export const PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V6 =
  'phase-6.9.7-tutor-organizer-runner-v6' as const;
export const PHASE_6_9_7_V6_RUNTIME_EVIDENCE_VERSION =
  'phase-6.9.7-v6-runtime-evidence-v1' as const;
export const PHASE_6_9_7_V6_MARKER_VERSION = 'phase-6.9.7-v6-live-marker-v1' as const;
export const PHASE_6_9_7_V6_JOURNAL_VERSION = 'phase-6.9.7-v6-journal-v1' as const;
export const PHASE_6_9_7_V6_EVIDENCE_VERSION = 'phase-6.9.7-v6-evidence-envelope-v1' as const;
export const PHASE_6_9_7_V6_RECOVERY_CLAIM_VERSION = 'phase-6.9.7-v6-recovery-claim-v1' as const;
export const PHASE_6_9_7_V6_EVIDENCE_PREFIX = 'phase-6-9-7-tutor-organizer-v6' as const;
export const PHASE_6_9_7_V6_APPROVAL_ENV = 'PHASE_6_9_7_V6_CONTROLLED_LIVE_APPROVED' as const;
export const PHASE_6_9_7_V6_CONFIRMATION =
  'I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V6_CONTROLLED_LIVE_ONCE' as const;
export const PHASE_6_9_7_V6_MARKER_PATH =
  '.tmp/phase-6-9-7-tutor-organizer-v6-controlled-live.marker' as const;
export const PHASE_6_9_7_V6_RECOVERY_CLAIM_PATH =
  '.tmp/phase-6-9-7-tutor-organizer-v6-controlled-live.recovery.claim' as const;
export const PHASE_6_9_7_V6_ROBUSTNESS_VERSION =
  'phase-6.9.7-tutor-organizer-v6-independent-robustness-v1' as const;
export const PHASE_6_9_7_V6_ROBUSTNESS_SHA256 =
  '314543fe1694c0caa2b8fc48fa79a1bfcd751eb0431664ffafb9ceee3103904b' as const;

export const PHASE_6_9_7_V6_EXECUTION_OUTCOMES = [
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

export const PHASE_6_9_7_V6_USAGE_DISPOSITIONS = [
  'verified',
  'unknown_after_attempt',
  'absent_not_attempted',
] as const;

export const PHASE_6_9_7_V6_FAILURE_CATEGORIES = [
  'none',
  'local_guard',
  'pre_dispatch_abort',
  'post_dispatch_abort',
  'runtime_timeout',
  'provider_runtime',
  'structured_output',
  'dynamic_contract',
  'local_merger',
  'stale_shortlist',
  'usage_unknown',
  'orphaned',
  'harness_internal',
] as const;

export const PHASE_6_9_7_V6_LANE_POLICY = deepFreeze({
  tutor: {
    timeoutMs: 3_500,
    componentScope: 'tutor_component',
    budget: { maxCalls: 1, maxInputTokens: 1_200, maxOutputTokens: 300 },
  },
  organizer: {
    timeoutMs: 5_000,
    componentScope: 'wrong_question_organizer_component',
    budget: { maxCalls: 1, maxInputTokens: 3_500, maxOutputTokens: 800 },
  },
});

const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const runIdSchema = z.string().uuid();
const caseIdSchema = z.string().regex(/^(tutor|organizer)-v2-(zero|runtime)-[a-z0-9-]+$/);
const agentSchema = z.enum(['tutor', 'wrong_question_organizer']);
const pairedRunIndexSchema = z.number().int().min(0).max(23);
const nonNegativeFinite = z.number().finite().nonnegative();
const providerFailureCategorySchema = z.enum(MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES);
const structuredOutputStageSchema = z.enum(MODEL_AGENT_STRUCTURED_OUTPUT_STAGES);
const lanePolicySchema = z
  .object({
    tutor: z
      .object({
        timeoutMs: z.literal(3_500),
        componentScope: z.literal('tutor_component'),
        budget: z
          .object({
            maxCalls: z.literal(1),
            maxInputTokens: z.literal(1_200),
            maxOutputTokens: z.literal(300),
          })
          .strict(),
      })
      .strict(),
    organizer: z
      .object({
        timeoutMs: z.literal(5_000),
        componentScope: z.literal('wrong_question_organizer_component'),
        budget: z
          .object({
            maxCalls: z.literal(1),
            maxInputTokens: z.literal(3_500),
            maxOutputTokens: z.literal(800),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export const PHASE_6_9_7_V6_MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(PHASE_6_9_7_V6_MARKER_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V6),
    datasetBindingVersion: z.literal(PHASE_6_9_7_V6_DATASET_BINDING_VERSION),
    datasetBindingSha256: z.literal(PHASE_6_9_7_V6_DATASET_BINDING_SHA256),
    datasetVersion: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION),
    datasetSha256: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256),
    evalPolicySha256: z.literal(PHASE_6_9_7_V6_EVAL_POLICY_SHA256),
    runId: runIdSchema,
    runScope: z.enum(['branch', 'main']),
    mode: z.literal('live'),
    executorProvenance: z.enum(['deepseek_network', 'synthetic_test']),
    ownerProcessId: z.number().int().safe().positive(),
    state: z.literal('attempt_reserved'),
  })
  .strict();

export type Phase697V6Marker = z.infer<typeof PHASE_6_9_7_V6_MARKER_SCHEMA>;

export const PHASE_6_9_7_V6_RECOVERY_CLAIM_SCHEMA = z
  .object({
    claimVersion: z.literal(PHASE_6_9_7_V6_RECOVERY_CLAIM_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V6),
    runId: runIdSchema,
    ownerProcessId: z.number().int().safe().positive(),
    ownerToken: z.string().uuid(),
    markerSha256: sha256Schema,
    journalTailSha256: sha256Schema.nullable(),
    state: z.literal('orphan_seal_claimed'),
  })
  .strict();

export type Phase697V6RecoveryClaimRecord = z.infer<typeof PHASE_6_9_7_V6_RECOVERY_CLAIM_SCHEMA>;

const safetySchema = z
  .object({
    criticalFailure: z.boolean(),
    permissionFailure: z.boolean(),
    mutationFailure: z.boolean(),
    broaderThanDeterministicFallback: z.boolean(),
  })
  .strict();

const usageSchema = z
  .object({
    inputTokens: z.number().int().safe().nonnegative(),
    outputTokens: z.number().int().safe().nonnegative(),
    estimatedCostCny: nonNegativeFinite,
  })
  .strict();

const tutorSemanticAxesSchema = z
  .object({
    agent: z.literal('tutor'),
    intent: z.boolean(),
    depth: z.boolean(),
    contextUse: z.boolean(),
    guidingPolicy: z.boolean(),
    finalAnswerBoundary: z.boolean(),
    answerStructure: z.boolean(),
  })
  .strict();

const organizerSemanticAxesSchema = z
  .object({
    agent: z.literal('wrong_question_organizer'),
    decisionUnits: z.number().int().min(1).max(12),
    subject: z.boolean(),
    deck: z.boolean(),
    topic: z.boolean(),
    confidence: z.boolean(),
  })
  .strict();

export const PHASE_6_9_7_V6_DURATION_EVIDENCE_SCHEMA = z
  .object({
    stage: z.enum(PHASE_6_9_7_V6_DURATION_STAGES),
    durationMs: nonNegativeFinite.max(PHASE_6_9_7_V6_EVAL_POLICY.latency.maxRecordedDurationMs),
    deadlineMs: z
      .number()
      .int()
      .safe()
      .positive()
      .max(PHASE_6_9_7_V6_EVAL_POLICY.latency.maxRecordedDurationMs)
      .nullable(),
    deadlineExceeded: z.boolean().nullable(),
    deadlineOvershootMs: nonNegativeFinite
      .max(PHASE_6_9_7_V6_EVAL_POLICY.latency.maxRecordedDurationMs)
      .nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const withoutDeadline = value.deadlineMs === null;
    if (
      (withoutDeadline &&
        (value.deadlineExceeded !== null || value.deadlineOvershootMs !== null)) ||
      (!withoutDeadline &&
        (value.deadlineExceeded !== value.durationMs > value.deadlineMs! ||
          value.deadlineOvershootMs !== Math.max(0, value.durationMs - value.deadlineMs!)))
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'V6 duration deadline mismatch' });
    }
  });

export const PHASE_6_9_7_V6_RUNTIME_DURATION_EVIDENCE_SCHEMA = z
  .object({
    executor: PHASE_6_9_7_V6_DURATION_EVIDENCE_SCHEMA.nullable(),
    runtimeTrace: PHASE_6_9_7_V6_DURATION_EVIDENCE_SCHEMA.nullable(),
    candidateOrchestration: PHASE_6_9_7_V6_DURATION_EVIDENCE_SCHEMA.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.executor !== null && value.executor.stage !== 'executor') ||
      (value.runtimeTrace !== null && value.runtimeTrace.stage !== 'runtime_trace') ||
      (value.candidateOrchestration !== null &&
        value.candidateOrchestration.stage !== 'candidate_orchestration')
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'V6 duration stage mismatch' });
    }
  });

const subjectDecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('keep_local') }).strict(),
  z
    .object({
      action: z.literal('select_subject'),
      subjectIndex: z.number().int().min(0).max(5),
    })
    .strict(),
]);

export const PHASE_6_9_7_V6_MODEL_OWNED_DECISION_SCHEMA = z.discriminatedUnion('agent', [
  z
    .object({
      agent: z.literal('tutor'),
      intent: z.enum(TUTOR_BOUNDED_INTENTS),
    })
    .strict(),
  z
    .object({
      agent: z.literal('wrong_question_organizer'),
      decisions: z
        .array(
          z
            .object({
              decisionId: z.string().min(1).max(160),
              subjectDecision: subjectDecisionSchema,
              deckAction: z.enum(['reuse_existing', 'create_topic']),
              targetOrdinal: z.number().int().min(0).max(19),
            })
            .strict(),
        )
        .min(1)
        .max(12),
    })
    .strict(),
]);

export const PHASE_6_9_7_V6_CASE_ENTRY_SCHEMA = z
  .object({
    runtimeEvidenceVersion: z.literal(PHASE_6_9_7_V6_RUNTIME_EVIDENCE_VERSION),
    caseId: caseIdSchema,
    agent: agentSchema,
    executionKind: z.enum(['zero_call', 'runtime']),
    pairedRunIndex: pairedRunIndexSchema.nullable(),
    runtimeInvocations: z.union([z.literal(0), z.literal(1)]),
    executionOutcome: z.enum(PHASE_6_9_7_V6_EXECUTION_OUTCOMES),
    candidateDisposition: z.enum(MODEL_CANDIDATE_DISPOSITIONS).nullable(),
    failureCategory: z.enum(PHASE_6_9_7_V6_FAILURE_CATEGORIES),
    providerFailureCategory: providerFailureCategorySchema.nullable(),
    structuredOutputStage: structuredOutputStageSchema.nullable(),
    strictRuntimeSuccess: z.boolean(),
    zeroCallVerified: z.boolean(),
    semanticAxes: z
      .discriminatedUnion('agent', [tutorSemanticAxesSchema, organizerSemanticAxesSchema])
      .nullable(),
    modelOwnedDecision: PHASE_6_9_7_V6_MODEL_OWNED_DECISION_SCHEMA.nullable(),
    durationEvidence: PHASE_6_9_7_V6_RUNTIME_DURATION_EVIDENCE_SCHEMA,
    latencyMs: nonNegativeFinite.nullable(),
    orchestrationLatencyMs: nonNegativeFinite.nullable(),
    usageDisposition: z.enum(PHASE_6_9_7_V6_USAGE_DISPOSITIONS),
    usage: usageSchema.nullable(),
    safety: safetySchema,
    dispatchRecorded: z.boolean(),
    runtimeTerminalRecorded: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
    const notStarted = value.executionOutcome.startsWith('not_started_');
    const attempted =
      value.executionOutcome === 'attempted_aborted' ||
      value.executionOutcome === 'attempted_orphaned';
    if (value.executionKind === 'zero_call') {
      if (
        value.pairedRunIndex !== null ||
        value.candidateDisposition === null ||
        value.semanticAxes !== null ||
        value.modelOwnedDecision !== null ||
        !runtimeDurationsEmpty(value.durationEvidence) ||
        value.latencyMs !== null ||
        value.orchestrationLatencyMs !== null ||
        value.usage !== null ||
        value.dispatchRecorded ||
        value.runtimeTerminalRecorded
      ) {
        issue('V6 zero-call terminal mismatch');
      }
      if (
        value.runtimeInvocations === 0 &&
        (value.executionOutcome !== 'not_started_case_guard' ||
          value.usageDisposition !== 'absent_not_attempted')
      ) {
        issue('V6 zero-call local terminal mismatch');
      }
      if (
        value.runtimeInvocations === 1 &&
        (value.executionOutcome !== 'harness_internal_error' ||
          value.usageDisposition !== 'unknown_after_attempt' ||
          value.zeroCallVerified ||
          value.failureCategory !== 'harness_internal' ||
          !value.safety.criticalFailure)
      ) {
        issue('V6 zero-call unauthorized invocation mismatch');
      }
      return;
    }
    if (value.pairedRunIndex === null || value.zeroCallVerified) {
      issue('V6 runtime identity mismatch');
    }
    if (
      value.semanticAxes !== null &&
      ((value.agent === 'tutor' && value.semanticAxes.agent !== 'tutor') ||
        (value.agent === 'wrong_question_organizer' &&
          value.semanticAxes.agent !== 'wrong_question_organizer'))
    ) {
      issue('V6 semantic agent identity mismatch');
    }
    if (
      value.modelOwnedDecision !== null &&
      ((value.agent === 'tutor' && value.modelOwnedDecision.agent !== 'tutor') ||
        (value.agent === 'wrong_question_organizer' &&
          value.modelOwnedDecision.agent !== 'wrong_question_organizer'))
    ) {
      issue('V6 model-owned agent identity mismatch');
    }
    if (notStarted) {
      if (
        value.runtimeInvocations !== 0 ||
        value.candidateDisposition !== null ||
        value.semanticAxes !== null ||
        value.modelOwnedDecision !== null ||
        !runtimeDurationsEmpty(value.durationEvidence) ||
        value.latencyMs !== null ||
        value.orchestrationLatencyMs !== null ||
        value.usageDisposition !== 'absent_not_attempted' ||
        value.usage !== null ||
        value.dispatchRecorded ||
        value.runtimeTerminalRecorded
      ) {
        issue('V6 not-started terminal mismatch');
      }
      return;
    }
    if (
      !value.dispatchRecorded ||
      !value.runtimeTerminalRecorded ||
      value.runtimeInvocations !== 1
    ) {
      issue('V6 attempted runtime ledger mismatch');
    }
    if (attempted) {
      if (
        value.usageDisposition !== 'unknown_after_attempt' ||
        value.usage !== null ||
        value.strictRuntimeSuccess ||
        value.semanticAxes !== null ||
        value.modelOwnedDecision !== null ||
        value.candidateDisposition === null
      ) {
        issue('V6 attempted terminal mismatch');
      }
      return;
    }
    if (value.executionOutcome === 'executed_success') {
      if (
        value.candidateDisposition !== 'candidate_applied' ||
        !value.strictRuntimeSuccess ||
        value.semanticAxes === null ||
        value.modelOwnedDecision === null ||
        !runtimeDurationsCompleteAndBound(value.agent, value.durationEvidence) ||
        value.latencyMs !== value.durationEvidence.runtimeTrace?.durationMs ||
        (value.agent === 'tutor' &&
          value.orchestrationLatencyMs !==
            value.durationEvidence.candidateOrchestration?.durationMs) ||
        value.usageDisposition !== 'verified' ||
        value.usage === null ||
        value.failureCategory !== 'none'
      ) {
        issue('V6 executed success mismatch');
      }
      return;
    }
    if (value.executionOutcome === 'executed_failure') {
      if (
        value.candidateDisposition === null ||
        value.strictRuntimeSuccess ||
        value.semanticAxes !== null ||
        value.modelOwnedDecision !== null ||
        value.usageDisposition === 'absent_not_attempted' ||
        (value.usageDisposition === 'verified') !== (value.usage !== null) ||
        value.failureCategory === 'none'
      ) {
        issue('V6 executed failure mismatch');
      }
    }
    if (
      value.providerFailureCategory === 'structured_output' &&
      value.structuredOutputStage === null
    ) {
      issue('V6 structured output stage missing');
    }
    if (
      value.structuredOutputStage !== null &&
      value.providerFailureCategory !== 'structured_output'
    ) {
      issue('V6 structured output category mismatch');
    }
  });

export type Phase697V6CaseEntry = z.infer<typeof PHASE_6_9_7_V6_CASE_ENTRY_SCHEMA>;

const identitiesSchema = z
  .object({
    datasetBindingVersion: z.literal(PHASE_6_9_7_V6_DATASET_BINDING_VERSION),
    datasetBindingSha256: z.literal(PHASE_6_9_7_V6_DATASET_BINDING_SHA256),
    datasetVersion: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION),
    datasetSha256: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256),
    evalPolicyVersion: z.literal(PHASE_6_9_7_V6_EVAL_POLICY_VERSION),
    evalPolicySha256: z.literal(PHASE_6_9_7_V6_EVAL_POLICY_SHA256),
    deterministicBaselineSha256: z.literal(PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256),
    tutorPromptVersion: z.literal(TUTOR_V6_MODEL_PROMPT_VERSION),
    tutorPromptContentSha256: z.literal(TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256),
    tutorProjectionVersion: z.literal(TUTOR_V6_MODEL_PROJECTION_VERSION),
    tutorSignalAuthorityVersion: z.literal(TUTOR_V5_LOCAL_SIGNAL_AUTHORITY_VERSION),
    tutorSignalAuthorityRulesSha256: z.literal(TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256),
    tutorPreferredDepthAuthorityVersion: z.literal(TUTOR_V6_PREFERRED_DEPTH_AUTHORITY_VERSION),
    tutorPreferredDepthRulesSha256: z.literal(TUTOR_V6_PREFERRED_DEPTH_RULES_SHA256),
    organizerPromptVersion: z.literal(WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_VERSION),
    organizerPromptContentSha256: z.literal(WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_SHA256),
    organizerProjectionVersion: z.literal(WRONG_QUESTION_ORGANIZER_V6_MODEL_PROJECTION_VERSION),
    organizerShortlistVersion: z.literal(WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION),
    organizerShortlistRulesSha256: z.literal(WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_SHA256),
    organizerConfidenceAuthorityVersion: z.literal(
      WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_AUTHORITY_VERSION,
    ),
    organizerConfidenceRulesSha256: z.literal(WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_SHA256),
    robustnessVersion: z.literal(PHASE_6_9_7_V6_ROBUSTNESS_VERSION),
    robustnessSha256: z.literal(PHASE_6_9_7_V6_ROBUSTNESS_SHA256),
  })
  .strict();

const aggregateSchema = z
  .object({
    complete: z.boolean(),
    strictRuntimeSuccesses: z.number().int().min(0).max(48),
    tutorSemanticScore: z.number().min(0).max(1).nullable(),
    organizerSemanticScore: z.number().min(0).max(1).nullable(),
    combinedSemanticScore: z.number().min(0).max(1).nullable(),
  })
  .strict();

const latencyAggregateSchema = z
  .object({
    complete: z.boolean(),
    tutorCandidateP95Ms: nonNegativeFinite.nullable(),
    organizerCandidateP95Ms: nonNegativeFinite.nullable(),
    pairedCandidateP95Ms: nonNegativeFinite.nullable(),
    tutorOrchestrationP95Ms: nonNegativeFinite.nullable(),
  })
  .strict();

const modelOwnedMetricSchema = z
  .object({
    correct: z.number().int().nonnegative(),
    denominator: z.number().int().positive(),
    accuracy: z.number().min(0).max(1),
    complete: z.boolean(),
    passed: z.boolean(),
  })
  .strict();

const modelOwnedMetricsSchema = z
  .object({
    tutorIntent: modelOwnedMetricSchema,
    organizerSubjectDecision: modelOwnedMetricSchema,
    organizerDeckAction: modelOwnedMetricSchema,
    organizerTargetOrdinal: modelOwnedMetricSchema,
    qualityGatePassed: z.boolean(),
  })
  .strict();

const usageAggregateSchema = z
  .object({
    complete: z.boolean(),
    providerInvocations: z.number().int().min(0).max(48),
    verifiedRuntimeCases: z.number().int().min(0).max(48),
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    estimatedCostCny: nonNegativeFinite.nullable(),
  })
  .strict();

export const PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA = z
  .object({
    runId: runIdSchema,
    runScope: z.enum(['branch', 'main']),
    mode: z.enum(['mock', 'live']),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V6),
    identities: identitiesSchema,
    provider: z.enum(['mock', 'deepseek']),
    model: z.enum(['mock', 'deepseek-v4-pro']),
    structuredOutputMode: z.enum(['mock_json_v6', 'deepseek_v4_pro_nonthinking_json']),
    executorProvenance: z.enum(['mock_synthetic', 'deepseek_network', 'synthetic_test']),
    lanePolicy: lanePolicySchema,
    counts: z
      .object({
        cases: z.literal(72),
        zeroCallCases: z.literal(24),
        runtimeCases: z.literal(48),
        pairedRequests: z.literal(24),
        organizerDecisionUnits: z.literal(32),
      })
      .strict(),
    scheduler: z
      .object({
        guardPhasePassed: z.boolean(),
        breakerState: z.enum(['closed', 'guard_failed', 'quality_gate_impossible', 'orphaned']),
        triggerCaseId: caseIdSchema.nullable(),
        triggerAgent: agentSchema.nullable(),
        triggerPairedRunIndex: pairedRunIndexSchema.nullable(),
        dispatchedPairs: z.number().int().min(0).max(24),
        completedPairs: z.number().int().min(0).max(24),
        maxConcurrentPairs: z.union([z.literal(0), z.literal(1)]),
        maxConcurrentLaneOperations: z.number().int().min(0).max(2),
      })
      .strict(),
    ledger: z
      .object({
        reservedEntries: z.number().int().min(0).max(48),
        terminalEntries: z.number().int().min(0).max(48),
        duplicateDispatchRejected: z.number().int().nonnegative(),
      })
      .strict(),
    pairedDurationEvidence: z.array(PHASE_6_9_7_V6_DURATION_EVIDENCE_SCHEMA.nullable()).length(24),
    pairedLatencySamplesMs: z.array(nonNegativeFinite.nullable()).length(24),
    caseEntries: z.array(PHASE_6_9_7_V6_CASE_ENTRY_SCHEMA).length(72),
    metrics: aggregateSchema,
    modelOwnedMetrics: modelOwnedMetricsSchema,
    latency: latencyAggregateSchema,
    usage: usageAggregateSchema,
    safety: z
      .object({
        verifiedZeroCalls: z.number().int().min(0).max(24),
        criticalFailures: z.number().int().min(0).max(72),
        providerFailures: z.number().int().min(0).max(48),
        permissionFailures: z.number().int().min(0).max(72),
        mutationFailures: z.number().int().min(0).max(72),
        broaderFallbacks: z.number().int().min(0).max(72),
      })
      .strict(),
    gate: z.enum(['mock_quality_not_evidence', 'quality_gate_passed', 'quality_gate_failed']),
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
    const expectedIds = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.map((entry) => entry.id).sort();
    const actualIds = value.caseEntries.map((entry) => entry.caseId).sort();
    if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) {
      issue('V6 fixed denominator identity mismatch');
    }
    const canonicalCases = new Map<
      string,
      (typeof PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES)[number]
    >(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.map((entry) => [entry.id, entry]));
    for (const entry of value.caseEntries) {
      const canonical = canonicalCases.get(entry.caseId);
      const expectedKind = canonical?.expectedRuntimeInvocations === 0 ? 'zero_call' : 'runtime';
      const expectedPairedRunIndex =
        canonical?.expectedRuntimeInvocations === 1 ? canonical.pairedRunIndex : null;
      if (
        canonical === undefined ||
        entry.agent !== canonical.agent ||
        entry.executionKind !== expectedKind ||
        entry.pairedRunIndex !== expectedPairedRunIndex
      ) {
        issue('V6 canonical case identity mismatch');
        continue;
      }
      if (
        canonical.agent === 'wrong_question_organizer' &&
        canonical.expectedRuntimeInvocations === 1 &&
        entry.semanticAxes?.agent === 'wrong_question_organizer' &&
        entry.semanticAxes.decisionUnits !== canonical.expected.decisions.length
      ) {
        issue('V6 organizer decision denominator mismatch');
      }
      if (
        canonical.expectedRuntimeInvocations === 1 &&
        entry.modelOwnedDecision?.agent === 'wrong_question_organizer'
      ) {
        const expectedDecisionIds = PHASE_6_9_7_V6_DATASET_BINDING.organizerModelOwnedExpectations
          .filter((expected) => expected.caseId === entry.caseId)
          .map((expected) => expected.decisionId)
          .sort();
        const actualDecisionIds = entry.modelOwnedDecision.decisions
          .map((decision) => decision.decisionId)
          .sort();
        if (JSON.stringify(expectedDecisionIds) !== JSON.stringify(actualDecisionIds)) {
          issue('V6 organizer model-owned decision identity mismatch');
        }
      }
    }
    if (
      (value.mode === 'mock' &&
        (value.provider !== 'mock' ||
          value.model !== 'mock' ||
          value.structuredOutputMode !== 'mock_json_v6' ||
          value.executorProvenance !== 'mock_synthetic' ||
          value.gate !== 'mock_quality_not_evidence')) ||
      (value.mode === 'live' &&
        (value.provider !== 'deepseek' ||
          value.model !== 'deepseek-v4-pro' ||
          value.structuredOutputMode !== 'deepseek_v4_pro_nonthinking_json' ||
          value.executorProvenance === 'mock_synthetic' ||
          value.gate === 'mock_quality_not_evidence'))
    ) {
      issue('V6 mode identity mismatch');
    }
    if (
      value.metrics.complete !== value.caseEntries.every(runtimeCaseAggregateComplete) ||
      value.usage.complete !== value.caseEntries.every(runtimeCaseUsageComplete)
    ) {
      issue('V6 aggregate completeness mismatch');
    }
    if (
      (!value.metrics.complete &&
        (value.metrics.tutorSemanticScore !== null ||
          value.metrics.organizerSemanticScore !== null ||
          value.metrics.combinedSemanticScore !== null)) ||
      (!value.latency.complete &&
        (value.latency.tutorCandidateP95Ms !== null ||
          value.latency.organizerCandidateP95Ms !== null ||
          value.latency.pairedCandidateP95Ms !== null ||
          value.latency.tutorOrchestrationP95Ms !== null)) ||
      (!value.usage.complete &&
        (value.usage.inputTokens !== null ||
          value.usage.outputTokens !== null ||
          value.usage.estimatedCostCny !== null))
    ) {
      issue('V6 incomplete aggregate must be null');
    }
    const runtimeEntries = value.caseEntries.filter((entry) => entry.executionKind === 'runtime');
    const tutorEntries = runtimeEntries.filter((entry) => entry.agent === 'tutor');
    const organizerEntries = runtimeEntries.filter(
      (entry) => entry.agent === 'wrong_question_organizer',
    );
    const strictSuccesses = runtimeEntries.filter(runtimeContractSuccessV6).length;
    const verifiedUsage = runtimeEntries.flatMap((entry) => (entry.usage ? [entry.usage] : []));
    const expectedSafety = {
      verifiedZeroCalls: value.caseEntries.filter(
        (entry) => entry.executionKind === 'zero_call' && entry.zeroCallVerified,
      ).length,
      criticalFailures: value.caseEntries.filter((entry) => entry.safety.criticalFailure).length,
      providerFailures: value.caseEntries.filter((entry) => entry.providerFailureCategory !== null)
        .length,
      permissionFailures: value.caseEntries.filter((entry) => entry.safety.permissionFailure)
        .length,
      mutationFailures: value.caseEntries.filter((entry) => entry.safety.mutationFailure).length,
      broaderFallbacks: value.caseEntries.filter(
        (entry) => entry.safety.broaderThanDeterministicFallback,
      ).length,
    };
    if (
      value.metrics.strictRuntimeSuccesses !== strictSuccesses ||
      (value.metrics.complete &&
        (value.metrics.tutorSemanticScore !== semanticScoreForSchema(tutorEntries) ||
          value.metrics.organizerSemanticScore !== semanticScoreForSchema(organizerEntries) ||
          value.metrics.combinedSemanticScore !== semanticScoreForSchema(runtimeEntries))) ||
      JSON.stringify(value.safety) !== JSON.stringify(expectedSafety)
    ) {
      issue('V6 metric or safety aggregate mismatch');
    }
    const modelOwned = scorePhase697V6ModelOwnedMetrics(
      buildPhase697V6ModelOwnedScoringInput(value.caseEntries),
    );
    if (
      !modelOwned.ok ||
      JSON.stringify(value.modelOwnedMetrics) !== JSON.stringify(modelOwned.value)
    ) {
      issue('V6 model-owned aggregate mismatch');
    }
    const expectedProviderInvocations = value.caseEntries.reduce(
      (sum, entry) => sum + entry.runtimeInvocations,
      0,
    );
    if (
      value.usage.providerInvocations !== expectedProviderInvocations ||
      value.usage.verifiedRuntimeCases !== verifiedUsage.length ||
      (value.usage.complete &&
        (value.usage.inputTokens !==
          verifiedUsage.reduce((sum, entry) => sum + entry.inputTokens, 0) ||
          value.usage.outputTokens !==
            verifiedUsage.reduce((sum, entry) => sum + entry.outputTokens, 0) ||
          value.usage.estimatedCostCny !==
            verifiedUsage.reduce((sum, entry) => sum + entry.estimatedCostCny, 0)))
    ) {
      issue('V6 usage aggregate mismatch');
    }
    const pairedDurationsMatch = value.pairedDurationEvidence.every(
      (evidence, index) =>
        (evidence === null && value.pairedLatencySamplesMs[index] === null) ||
        (evidence?.stage === 'paired_request' &&
          evidence.durationMs === value.pairedLatencySamplesMs[index]),
    );
    const expectedLatency = buildPhase697V6LatencyAggregate({
      tutorCandidateMs: tutorEntries.map((entry) => entry.latencyMs),
      organizerCandidateMs: organizerEntries.map((entry) => entry.latencyMs),
      pairedCandidateMs: value.pairedLatencySamplesMs,
      tutorOrchestrationMs: tutorEntries.map((entry) => entry.orchestrationLatencyMs),
    });
    if (
      !pairedDurationsMatch ||
      JSON.stringify(value.latency) !== JSON.stringify(expectedLatency)
    ) {
      issue('V6 latency aggregate mismatch');
    }
    const expectedGate =
      value.mode === 'mock'
        ? 'mock_quality_not_evidence'
        : phase697V6QualityGatePasses(value)
          ? 'quality_gate_passed'
          : 'quality_gate_failed';
    if (value.gate !== expectedGate) {
      issue('V6 quality gate aggregate mismatch');
    }
  });

export type Phase697TutorOrganizerV6Report = z.infer<
  typeof PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA
>;

const durabilitySchema = z
  .object({
    disposition: z.enum([
      'mock_direct',
      'completed_run',
      'orphan_sealed',
      'journal_missing_sealed',
    ]),
    markerSha256: sha256Schema.nullable(),
    journalTailSha256: sha256Schema.nullable(),
    journalSequence: z.number().int().safe().nonnegative().nullable(),
  })
  .strict();

export const PHASE_6_9_7_V6_EVIDENCE_ENVELOPE_SCHEMA = z
  .object({
    evidenceVersion: z.literal(PHASE_6_9_7_V6_EVIDENCE_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V6),
    runId: runIdSchema,
    runScope: z.enum(['branch', 'main']),
    mode: z.enum(['mock', 'live']),
    durability: durabilitySchema,
    reportSha256: sha256Schema,
    report: PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
    if (
      value.runId !== value.report.runId ||
      value.runScope !== value.report.runScope ||
      value.mode !== value.report.mode ||
      value.reportSha256 !== sha256Phase697V6Stable(value.report)
    ) {
      issue('V6 evidence identity mismatch');
    }
    if (value.durability.disposition === 'mock_direct') {
      if (
        value.mode !== 'mock' ||
        value.durability.markerSha256 !== null ||
        value.durability.journalTailSha256 !== null ||
        value.durability.journalSequence !== null
      ) {
        issue('V6 mock durability mismatch');
      }
      return;
    }
    if (value.mode !== 'live' || value.durability.markerSha256 === null) {
      issue('V6 live durability mismatch');
    }
    if (value.durability.disposition === 'journal_missing_sealed') {
      if (
        value.durability.journalTailSha256 !== null ||
        value.durability.journalSequence !== null ||
        value.report.gate !== 'quality_gate_failed'
      ) {
        issue('V6 missing journal durability mismatch');
      }
      return;
    }
    if (
      value.durability.journalTailSha256 === null ||
      value.durability.journalSequence === null ||
      (value.durability.disposition === 'orphan_sealed' &&
        value.report.gate !== 'quality_gate_failed')
    ) {
      issue('V6 journal durability mismatch');
    }
  });

export type Phase697V6EvidenceEnvelope = z.infer<typeof PHASE_6_9_7_V6_EVIDENCE_ENVELOPE_SCHEMA>;

export function buildPhase697V6EvidenceEnvelope(input: {
  report: Readonly<Phase697TutorOrganizerV6Report>;
  disposition: Phase697V6EvidenceEnvelope['durability']['disposition'];
  markerSha256: string | null;
  journalTailSha256: string | null;
  journalSequence: number | null;
}): Readonly<Phase697V6EvidenceEnvelope> | null {
  const parsed = PHASE_6_9_7_V6_EVIDENCE_ENVELOPE_SCHEMA.safeParse({
    evidenceVersion: PHASE_6_9_7_V6_EVIDENCE_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V6,
    runId: input.report.runId,
    runScope: input.report.runScope,
    mode: input.report.mode,
    durability: {
      disposition: input.disposition,
      markerSha256: input.markerSha256,
      journalTailSha256: input.journalTailSha256,
      journalSequence: input.journalSequence,
    },
    reportSha256: sha256Phase697V6Stable(input.report),
    report: input.report,
  });
  return parsed.success ? deepFreeze(parsed.data) : null;
}

export function buildPhase697V6Marker(input: {
  runId: string;
  runScope: 'branch' | 'main';
  executorProvenance?: 'deepseek_network' | 'synthetic_test';
  ownerProcessId?: number;
}): Phase697V6Marker {
  return PHASE_6_9_7_V6_MARKER_SCHEMA.parse({
    markerVersion: PHASE_6_9_7_V6_MARKER_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V6,
    datasetBindingVersion: PHASE_6_9_7_V6_DATASET_BINDING_VERSION,
    datasetBindingSha256: PHASE_6_9_7_V6_DATASET_BINDING_SHA256,
    datasetVersion: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
    datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
    evalPolicySha256: PHASE_6_9_7_V6_EVAL_POLICY_SHA256,
    runId: input.runId,
    runScope: input.runScope,
    mode: 'live',
    executorProvenance: input.executorProvenance ?? 'deepseek_network',
    ownerProcessId: input.ownerProcessId ?? process.pid,
    state: 'attempt_reserved',
  });
}

export function phase697V6JournalPath(runId: string): string | null {
  return isUuid(runId)
    ? `.tmp/phase-6-9-7-tutor-organizer-v6-controlled-live-${runId}.journal.jsonl`
    : null;
}

export function phase697V6RecoveryClaimPath(runId: string): string | null {
  return isUuid(runId)
    ? `.tmp/phase-6-9-7-tutor-organizer-v6-controlled-live-${runId}.recovery.claim`
    : null;
}

export function phase697V6EvidencePath(input: {
  runId: string;
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
}): string | null {
  return isUuid(input.runId)
    ? `.tmp/phase-6-9-7-tutor-organizer-v6-${input.runScope}-${input.mode}-${input.runId}.json`
    : null;
}

export function parsePhase697TutorOrganizerV6Report(
  input: unknown,
): Readonly<Phase697TutorOrganizerV6Report> | null {
  const cloned = clonePlainEvidenceData(input);
  if (!cloned.ok) return null;
  const parsed = PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA.safeParse(cloned.value);
  return parsed.success ? deepFreeze(parsed.data) : null;
}

export function sha256Phase697V6Stable(value: unknown): `sha256:${string}` {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(sortStableValue(value)), 'utf8')
    .digest('hex')}`;
}

export function phase697V6IdentitySnapshot() {
  return deepFreeze({
    datasetBindingVersion: PHASE_6_9_7_V6_DATASET_BINDING_VERSION,
    datasetBindingSha256: PHASE_6_9_7_V6_DATASET_BINDING_SHA256,
    datasetVersion: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
    datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
    evalPolicyVersion: PHASE_6_9_7_V6_EVAL_POLICY_VERSION,
    evalPolicySha256: PHASE_6_9_7_V6_EVAL_POLICY_SHA256,
    deterministicBaselineSha256: PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256,
    tutorPromptVersion: TUTOR_V6_MODEL_PROMPT_VERSION,
    tutorPromptContentSha256: TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256,
    tutorProjectionVersion: TUTOR_V6_MODEL_PROJECTION_VERSION,
    tutorSignalAuthorityVersion: TUTOR_V5_LOCAL_SIGNAL_AUTHORITY_VERSION,
    tutorSignalAuthorityRulesSha256: TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256,
    tutorPreferredDepthAuthorityVersion: TUTOR_V6_PREFERRED_DEPTH_AUTHORITY_VERSION,
    tutorPreferredDepthRulesSha256: TUTOR_V6_PREFERRED_DEPTH_RULES_SHA256,
    organizerPromptVersion: WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_VERSION,
    organizerPromptContentSha256: WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_SHA256,
    organizerProjectionVersion: WRONG_QUESTION_ORGANIZER_V6_MODEL_PROJECTION_VERSION,
    organizerShortlistVersion: WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION,
    organizerShortlistRulesSha256: WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_SHA256,
    organizerConfidenceAuthorityVersion: WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_AUTHORITY_VERSION,
    organizerConfidenceRulesSha256: WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_SHA256,
    robustnessVersion: PHASE_6_9_7_V6_ROBUSTNESS_VERSION,
    robustnessSha256: PHASE_6_9_7_V6_ROBUSTNESS_SHA256,
  });
}

export function runtimeContractSuccessV6(entry: Readonly<Phase697V6CaseEntry>): boolean {
  return entry.executionKind === 'runtime' && entry.strictRuntimeSuccess;
}

export function phase697V6QualityGatePasses(report: Readonly<Phase697TutorOrganizerV6Report>) {
  const policy = PHASE_6_9_7_V6_EVAL_POLICY;
  const baseline = PHASE_6_9_7_V5_DETERMINISTIC_BASELINE.metrics;
  if (!baseline.ok) return false;
  return (
    report.mode === 'live' &&
    report.executorProvenance === 'deepseek_network' &&
    report.metrics.complete &&
    report.latency.complete &&
    report.usage.complete &&
    report.modelOwnedMetrics.qualityGatePassed &&
    report.metrics.strictRuntimeSuccesses === policy.quality.strictRuntimeSuccesses &&
    (report.metrics.tutorSemanticScore ?? 0) >= policy.quality.tutorSemanticScoreMin &&
    (report.metrics.organizerSemanticScore ?? 0) >= policy.quality.organizerSemanticScoreMin &&
    (report.metrics.combinedSemanticScore ?? 0) >= policy.quality.combinedSemanticScoreMin &&
    (report.metrics.tutorSemanticScore ?? 0) - baseline.metrics.tutor.semanticScore >=
      policy.quality.tutorAbsoluteImprovementMin &&
    (report.metrics.organizerSemanticScore ?? 0) - baseline.metrics.organizer.semanticScore >=
      policy.quality.organizerAbsoluteImprovementMin &&
    report.safety.verifiedZeroCalls === policy.safety.verifiedZeroCalls &&
    report.safety.criticalFailures <= policy.safety.criticalFailuresMax &&
    report.safety.providerFailures <= policy.safety.providerFailuresMax &&
    report.safety.permissionFailures <= policy.safety.permissionFailuresMax &&
    report.safety.mutationFailures <= policy.safety.mutationFailuresMax &&
    report.safety.broaderFallbacks <= policy.safety.broaderFallbacksMax &&
    (report.latency.tutorCandidateP95Ms ?? Number.POSITIVE_INFINITY) <=
      policy.latency.tutorCandidateP95Max &&
    (report.latency.organizerCandidateP95Ms ?? Number.POSITIVE_INFINITY) <=
      policy.latency.organizerCandidateP95Max &&
    (report.latency.pairedCandidateP95Ms ?? Number.POSITIVE_INFINITY) <=
      policy.latency.pairedCandidateP95Max &&
    (report.latency.tutorOrchestrationP95Ms ?? Number.POSITIVE_INFINITY) <=
      policy.latency.tutorOrchestrationP95Max &&
    report.usage.providerInvocations <= policy.usage.providerInvocationsMax &&
    (report.usage.inputTokens ?? 0) >= policy.usage.inputTokensMin &&
    (report.usage.inputTokens ?? Number.POSITIVE_INFINITY) <= policy.usage.inputTokensMax &&
    (report.usage.outputTokens ?? 0) >= policy.usage.outputTokensMin &&
    (report.usage.outputTokens ?? Number.POSITIVE_INFINITY) <= policy.usage.outputTokensMax &&
    (report.usage.estimatedCostCny ?? 0) > policy.usage.estimatedCostCnyExclusiveMin &&
    (report.usage.estimatedCostCny ?? Number.POSITIVE_INFINITY) <= policy.usage.estimatedCostCnyMax
  );
}

function runtimeCaseAggregateComplete(entry: Phase697V6CaseEntry) {
  return entry.executionKind === 'zero_call' || entry.semanticAxes !== null;
}

function runtimeCaseUsageComplete(entry: Phase697V6CaseEntry) {
  return entry.executionKind === 'zero_call' || entry.usageDisposition === 'verified';
}

export function buildPhase697V6ModelOwnedScoringInput(entries: readonly Phase697V6CaseEntry[]) {
  const runtimeByCaseId = new Map(
    entries
      .filter((entry) => entry.executionKind === 'runtime')
      .map((entry) => [entry.caseId, entry]),
  );
  return {
    tutor: PHASE_6_9_7_V6_DATASET_BINDING.tutorModelOwnedExpectations.map((expected) => {
      const decision = runtimeByCaseId.get(expected.caseId)?.modelOwnedDecision;
      return {
        caseId: expected.caseId,
        intent: decision?.agent === 'tutor' ? decision.intent : null,
      };
    }),
    organizer: PHASE_6_9_7_V6_DATASET_BINDING.organizerModelOwnedExpectations.map((expected) => {
      const decision = runtimeByCaseId.get(expected.caseId)?.modelOwnedDecision;
      const actual =
        decision?.agent === 'wrong_question_organizer'
          ? decision.decisions.find((entry) => entry.decisionId === expected.decisionId)
          : undefined;
      return {
        decisionId: expected.decisionId,
        subjectDecision: actual?.subjectDecision ?? null,
        deckAction: actual?.deckAction ?? null,
        targetOrdinal: actual?.targetOrdinal ?? null,
      };
    }),
  } as const;
}

export function scorePhase697V6ReportModelOwnedMetrics(
  entries: readonly Phase697V6CaseEntry[],
): Phase697V6ModelOwnedMetrics {
  const scored = scorePhase697V6ModelOwnedMetrics(buildPhase697V6ModelOwnedScoringInput(entries));
  if (!scored.ok) throw new Error('PHASE_6_9_7_V6_MODEL_OWNED_METRICS_INVALID');
  return scored.value;
}

function runtimeDurationsEmpty(value: Phase697V6CaseEntry['durationEvidence']) {
  return (
    value.executor === null && value.runtimeTrace === null && value.candidateOrchestration === null
  );
}

function runtimeDurationsCompleteAndBound(
  agent: Phase697V6CaseEntry['agent'],
  value: Phase697V6CaseEntry['durationEvidence'],
) {
  const hardDeadline =
    agent === 'tutor'
      ? PHASE_6_9_7_V6_EVAL_POLICY.deadlineMs.tutorExecutorHardTimeout
      : PHASE_6_9_7_V6_EVAL_POLICY.deadlineMs.organizerExecutorHardTimeout;
  const orchestrationDeadline =
    agent === 'tutor'
      ? PHASE_6_9_7_V6_EVAL_POLICY.latency.tutorOrchestrationP95Max
      : PHASE_6_9_7_V6_EVAL_POLICY.latency.organizerCandidateP95Max;
  return (
    value.executor?.deadlineMs === hardDeadline &&
    value.executor.deadlineExceeded === false &&
    value.runtimeTrace?.deadlineMs === hardDeadline &&
    value.runtimeTrace.deadlineExceeded === false &&
    value.candidateOrchestration?.deadlineMs === orchestrationDeadline
  );
}

function semanticScoreForSchema(entries: readonly Phase697V6CaseEntry[]) {
  const axes = entries.flatMap((entry) => {
    if (entry.semanticAxes === null) return [];
    return Object.entries(entry.semanticAxes)
      .filter(
        ([key, value]) => key !== 'agent' && key !== 'decisionUnits' && typeof value === 'boolean',
      )
      .map(([, value]) => value as boolean);
  });
  return axes.length === 0 ? 0 : axes.filter(Boolean).length / axes.length;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sortStableValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('PHASE_6_9_7_V6_NON_FINITE_VALUE');
    return value;
  }
  if (Array.isArray(value)) return value.map(sortStableValue);
  if (typeof value !== 'object') throw new Error('PHASE_6_9_7_V6_UNSUPPORTED_VALUE');
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('PHASE_6_9_7_V6_NON_PLAIN_VALUE');
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortStableValue(child)]),
  );
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
