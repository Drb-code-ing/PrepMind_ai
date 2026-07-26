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
  PHASE_6_9_7_V5_EVAL_POLICY,
  PHASE_6_9_7_V5_EVAL_POLICY_SHA256,
  PHASE_6_9_7_V5_EVAL_POLICY_VERSION,
} from './phase-6-9-tutor-wrong-question-v5-policy.ts';
import { MODEL_CANDIDATE_DISPOSITIONS } from '../model-candidates/model-candidate-policy.ts';
import { clonePlainEvidenceData } from '../model-candidates/model-projection-safety.ts';
import {
  TUTOR_V5_LOCAL_SIGNAL_AUTHORITY_VERSION,
  TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256,
} from '../model-candidates/tutor-v5-local-signal-authority.ts';
import {
  TUTOR_V5_MODEL_PROMPT_CONTENT_SHA256,
  TUTOR_V5_MODEL_PROMPT_VERSION,
} from '../model-candidates/tutor-v5-model-contract.ts';
import { TUTOR_V5_MODEL_PROJECTION_VERSION } from '../model-candidates/tutor-v5-model-projection.ts';
import {
  WRONG_QUESTION_ORGANIZER_V5_MODEL_PROMPT_SHA256,
  WRONG_QUESTION_ORGANIZER_V5_MODEL_PROMPT_VERSION,
} from '../model-candidates/wrong-question-organizer-v5-model-contract.ts';
import { WRONG_QUESTION_ORGANIZER_V5_MODEL_PROJECTION_VERSION } from '../model-candidates/wrong-question-organizer-v5-model-projection.ts';
import {
  WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_SHA256,
  WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION,
} from '../model-candidates/wrong-question-organizer-v5-shortlist.ts';

export const PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V5 =
  'phase-6.9.7-tutor-organizer-runner-v5' as const;
export const PHASE_6_9_7_V5_RUNTIME_EVIDENCE_VERSION =
  'phase-6.9.7-v5-runtime-evidence-v1' as const;
export const PHASE_6_9_7_V5_MARKER_VERSION = 'phase-6.9.7-v5-live-marker-v1' as const;
export const PHASE_6_9_7_V5_JOURNAL_VERSION = 'phase-6.9.7-v5-journal-v1' as const;
export const PHASE_6_9_7_V5_EVIDENCE_VERSION = 'phase-6.9.7-v5-evidence-envelope-v1' as const;
export const PHASE_6_9_7_V5_RECOVERY_CLAIM_VERSION = 'phase-6.9.7-v5-recovery-claim-v1' as const;
export const PHASE_6_9_7_V5_EVIDENCE_PREFIX = 'phase-6-9-7-tutor-organizer-v5' as const;
export const PHASE_6_9_7_V5_APPROVAL_ENV = 'PHASE_6_9_7_V5_CONTROLLED_LIVE_APPROVED' as const;
export const PHASE_6_9_7_V5_CONFIRMATION =
  'I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V5_CONTROLLED_LIVE_ONCE' as const;
export const PHASE_6_9_7_V5_MARKER_PATH =
  '.tmp/phase-6-9-7-tutor-organizer-v5-controlled-live.marker' as const;
export const PHASE_6_9_7_V5_RECOVERY_CLAIM_PATH =
  '.tmp/phase-6-9-7-tutor-organizer-v5-controlled-live.recovery.claim' as const;

export const PHASE_6_9_7_V5_EXECUTION_OUTCOMES = [
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

export const PHASE_6_9_7_V5_USAGE_DISPOSITIONS = [
  'verified',
  'unknown_after_attempt',
  'absent_not_attempted',
] as const;

export const PHASE_6_9_7_V5_FAILURE_CATEGORIES = [
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

export const PHASE_6_9_7_V5_LANE_POLICY = deepFreeze({
  tutor: {
    timeoutMs: 3_000,
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
        timeoutMs: z.literal(3_000),
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

export const PHASE_6_9_7_V5_MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(PHASE_6_9_7_V5_MARKER_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V5),
    datasetVersion: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION),
    datasetSha256: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256),
    evalPolicySha256: z.literal(PHASE_6_9_7_V5_EVAL_POLICY_SHA256),
    runId: runIdSchema,
    runScope: z.enum(['branch', 'main']),
    mode: z.literal('live'),
    executorProvenance: z.enum(['deepseek_network', 'synthetic_test']),
    ownerProcessId: z.number().int().safe().positive(),
    state: z.literal('attempt_reserved'),
  })
  .strict();

export type Phase697V5Marker = z.infer<typeof PHASE_6_9_7_V5_MARKER_SCHEMA>;

export const PHASE_6_9_7_V5_RECOVERY_CLAIM_SCHEMA = z
  .object({
    claimVersion: z.literal(PHASE_6_9_7_V5_RECOVERY_CLAIM_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V5),
    runId: runIdSchema,
    ownerProcessId: z.number().int().safe().positive(),
    ownerToken: z.string().uuid(),
    markerSha256: sha256Schema,
    journalTailSha256: sha256Schema.nullable(),
    state: z.literal('orphan_seal_claimed'),
  })
  .strict();

export type Phase697V5RecoveryClaimRecord = z.infer<typeof PHASE_6_9_7_V5_RECOVERY_CLAIM_SCHEMA>;

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

export const PHASE_6_9_7_V5_CASE_ENTRY_SCHEMA = z
  .object({
    runtimeEvidenceVersion: z.literal(PHASE_6_9_7_V5_RUNTIME_EVIDENCE_VERSION),
    caseId: caseIdSchema,
    agent: agentSchema,
    executionKind: z.enum(['zero_call', 'runtime']),
    pairedRunIndex: pairedRunIndexSchema.nullable(),
    runtimeInvocations: z.union([z.literal(0), z.literal(1)]),
    executionOutcome: z.enum(PHASE_6_9_7_V5_EXECUTION_OUTCOMES),
    candidateDisposition: z.enum(MODEL_CANDIDATE_DISPOSITIONS).nullable(),
    failureCategory: z.enum(PHASE_6_9_7_V5_FAILURE_CATEGORIES),
    providerFailureCategory: providerFailureCategorySchema.nullable(),
    structuredOutputStage: structuredOutputStageSchema.nullable(),
    strictRuntimeSuccess: z.boolean(),
    zeroCallVerified: z.boolean(),
    semanticAxes: z
      .discriminatedUnion('agent', [tutorSemanticAxesSchema, organizerSemanticAxesSchema])
      .nullable(),
    latencyMs: nonNegativeFinite.nullable(),
    orchestrationLatencyMs: nonNegativeFinite.nullable(),
    usageDisposition: z.enum(PHASE_6_9_7_V5_USAGE_DISPOSITIONS),
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
        value.latencyMs !== null ||
        value.orchestrationLatencyMs !== null ||
        value.usage !== null ||
        value.dispatchRecorded ||
        value.runtimeTerminalRecorded
      ) {
        issue('V5 zero-call terminal mismatch');
      }
      if (
        value.runtimeInvocations === 0 &&
        (value.executionOutcome !== 'not_started_case_guard' ||
          value.usageDisposition !== 'absent_not_attempted')
      ) {
        issue('V5 zero-call local terminal mismatch');
      }
      if (
        value.runtimeInvocations === 1 &&
        (value.executionOutcome !== 'harness_internal_error' ||
          value.usageDisposition !== 'unknown_after_attempt' ||
          value.zeroCallVerified ||
          value.failureCategory !== 'harness_internal' ||
          !value.safety.criticalFailure)
      ) {
        issue('V5 zero-call unauthorized invocation mismatch');
      }
      return;
    }
    if (value.pairedRunIndex === null || value.zeroCallVerified) {
      issue('V5 runtime identity mismatch');
    }
    if (
      value.semanticAxes !== null &&
      ((value.agent === 'tutor' && value.semanticAxes.agent !== 'tutor') ||
        (value.agent === 'wrong_question_organizer' &&
          value.semanticAxes.agent !== 'wrong_question_organizer'))
    ) {
      issue('V5 semantic agent identity mismatch');
    }
    if (notStarted) {
      if (
        value.runtimeInvocations !== 0 ||
        value.candidateDisposition !== null ||
        value.semanticAxes !== null ||
        value.latencyMs !== null ||
        value.orchestrationLatencyMs !== null ||
        value.usageDisposition !== 'absent_not_attempted' ||
        value.usage !== null ||
        value.dispatchRecorded ||
        value.runtimeTerminalRecorded
      ) {
        issue('V5 not-started terminal mismatch');
      }
      return;
    }
    if (
      !value.dispatchRecorded ||
      !value.runtimeTerminalRecorded ||
      value.runtimeInvocations !== 1
    ) {
      issue('V5 attempted runtime ledger mismatch');
    }
    if (attempted) {
      if (
        value.usageDisposition !== 'unknown_after_attempt' ||
        value.usage !== null ||
        value.strictRuntimeSuccess ||
        value.semanticAxes !== null ||
        value.candidateDisposition === null
      ) {
        issue('V5 attempted terminal mismatch');
      }
      return;
    }
    if (value.executionOutcome === 'executed_success') {
      if (
        value.candidateDisposition !== 'candidate_applied' ||
        !value.strictRuntimeSuccess ||
        value.semanticAxes === null ||
        value.usageDisposition !== 'verified' ||
        value.usage === null ||
        value.failureCategory !== 'none'
      ) {
        issue('V5 executed success mismatch');
      }
      return;
    }
    if (value.executionOutcome === 'executed_failure') {
      if (
        value.candidateDisposition === null ||
        value.strictRuntimeSuccess ||
        value.semanticAxes !== null ||
        value.usageDisposition === 'absent_not_attempted' ||
        (value.usageDisposition === 'verified') !== (value.usage !== null) ||
        value.failureCategory === 'none'
      ) {
        issue('V5 executed failure mismatch');
      }
    }
    if (
      value.providerFailureCategory === 'structured_output' &&
      value.structuredOutputStage === null
    ) {
      issue('V5 structured output stage missing');
    }
    if (
      value.structuredOutputStage !== null &&
      value.providerFailureCategory !== 'structured_output'
    ) {
      issue('V5 structured output category mismatch');
    }
  });

export type Phase697V5CaseEntry = z.infer<typeof PHASE_6_9_7_V5_CASE_ENTRY_SCHEMA>;

const identitiesSchema = z
  .object({
    datasetVersion: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION),
    datasetSha256: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256),
    evalPolicyVersion: z.literal(PHASE_6_9_7_V5_EVAL_POLICY_VERSION),
    evalPolicySha256: z.literal(PHASE_6_9_7_V5_EVAL_POLICY_SHA256),
    deterministicBaselineSha256: z.literal(PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256),
    tutorPromptVersion: z.literal(TUTOR_V5_MODEL_PROMPT_VERSION),
    tutorPromptContentSha256: z.literal(TUTOR_V5_MODEL_PROMPT_CONTENT_SHA256),
    tutorProjectionVersion: z.literal(TUTOR_V5_MODEL_PROJECTION_VERSION),
    tutorAuthorityVersion: z.literal(TUTOR_V5_LOCAL_SIGNAL_AUTHORITY_VERSION),
    tutorAuthorityRulesSha256: z.literal(TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256),
    organizerPromptVersion: z.literal(WRONG_QUESTION_ORGANIZER_V5_MODEL_PROMPT_VERSION),
    organizerPromptContentSha256: z.literal(WRONG_QUESTION_ORGANIZER_V5_MODEL_PROMPT_SHA256),
    organizerProjectionVersion: z.literal(WRONG_QUESTION_ORGANIZER_V5_MODEL_PROJECTION_VERSION),
    organizerShortlistVersion: z.literal(WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION),
    organizerShortlistRulesSha256: z.literal(WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_SHA256),
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
    tutorP95Ms: nonNegativeFinite.nullable(),
    organizerP95Ms: nonNegativeFinite.nullable(),
    pairedP95Ms: nonNegativeFinite.nullable(),
    orchestrationP95Ms: nonNegativeFinite.nullable(),
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

export const PHASE_6_9_7_TUTOR_ORGANIZER_V5_REPORT_SCHEMA = z
  .object({
    runId: runIdSchema,
    runScope: z.enum(['branch', 'main']),
    mode: z.enum(['mock', 'live']),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V5),
    identities: identitiesSchema,
    provider: z.enum(['mock', 'deepseek']),
    model: z.enum(['mock', 'deepseek-v4-pro']),
    structuredOutputMode: z.enum(['mock_json_v5', 'deepseek_v4_pro_nonthinking_json']),
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
    pairedLatencySamplesMs: z.array(nonNegativeFinite.nullable()).length(24),
    caseEntries: z.array(PHASE_6_9_7_V5_CASE_ENTRY_SCHEMA).length(72),
    metrics: aggregateSchema,
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
      issue('V5 fixed denominator identity mismatch');
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
        issue('V5 canonical case identity mismatch');
        continue;
      }
      if (
        canonical.agent === 'wrong_question_organizer' &&
        canonical.expectedRuntimeInvocations === 1 &&
        entry.semanticAxes?.agent === 'wrong_question_organizer' &&
        entry.semanticAxes.decisionUnits !== canonical.expected.decisions.length
      ) {
        issue('V5 organizer decision denominator mismatch');
      }
    }
    if (
      (value.mode === 'mock' &&
        (value.provider !== 'mock' ||
          value.model !== 'mock' ||
          value.structuredOutputMode !== 'mock_json_v5' ||
          value.executorProvenance !== 'mock_synthetic' ||
          value.gate !== 'mock_quality_not_evidence')) ||
      (value.mode === 'live' &&
        (value.provider !== 'deepseek' ||
          value.model !== 'deepseek-v4-pro' ||
          value.structuredOutputMode !== 'deepseek_v4_pro_nonthinking_json' ||
          value.executorProvenance === 'mock_synthetic' ||
          value.gate === 'mock_quality_not_evidence'))
    ) {
      issue('V5 mode identity mismatch');
    }
    if (
      value.metrics.complete !== value.caseEntries.every(runtimeCaseAggregateComplete) ||
      value.latency.complete !== value.caseEntries.every(runtimeCaseLatencyComplete) ||
      value.usage.complete !== value.caseEntries.every(runtimeCaseUsageComplete)
    ) {
      issue('V5 aggregate completeness mismatch');
    }
    if (
      (!value.metrics.complete &&
        (value.metrics.tutorSemanticScore !== null ||
          value.metrics.organizerSemanticScore !== null ||
          value.metrics.combinedSemanticScore !== null)) ||
      (!value.latency.complete &&
        (value.latency.tutorP95Ms !== null ||
          value.latency.organizerP95Ms !== null ||
          value.latency.pairedP95Ms !== null ||
          value.latency.orchestrationP95Ms !== null)) ||
      (!value.usage.complete &&
        (value.usage.inputTokens !== null ||
          value.usage.outputTokens !== null ||
          value.usage.estimatedCostCny !== null))
    ) {
      issue('V5 incomplete aggregate must be null');
    }
    const runtimeEntries = value.caseEntries.filter((entry) => entry.executionKind === 'runtime');
    const tutorEntries = runtimeEntries.filter((entry) => entry.agent === 'tutor');
    const organizerEntries = runtimeEntries.filter(
      (entry) => entry.agent === 'wrong_question_organizer',
    );
    const strictSuccesses = runtimeEntries.filter(runtimeContractSuccessV5).length;
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
      issue('V5 metric or safety aggregate mismatch');
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
      issue('V5 usage aggregate mismatch');
    }
    const completeLatencies = value.pairedLatencySamplesMs.every((sample) => sample !== null);
    if (
      value.latency.complete !==
        (runtimeEntries.every((entry) => entry.latencyMs !== null) && completeLatencies) ||
      (value.latency.complete &&
        (value.latency.tutorP95Ms !==
          nearestRankP95ForSchema(tutorEntries.map((entry) => entry.latencyMs!)) ||
          value.latency.organizerP95Ms !==
            nearestRankP95ForSchema(organizerEntries.map((entry) => entry.latencyMs!)) ||
          value.latency.pairedP95Ms !==
            nearestRankP95ForSchema(value.pairedLatencySamplesMs as number[]) ||
          value.latency.orchestrationP95Ms !==
            nearestRankP95ForSchema(
              tutorEntries.map((entry) => entry.orchestrationLatencyMs ?? entry.latencyMs!),
            )))
    ) {
      issue('V5 latency aggregate mismatch');
    }
    const expectedGate =
      value.mode === 'mock'
        ? 'mock_quality_not_evidence'
        : phase697V5QualityGatePasses(value)
          ? 'quality_gate_passed'
          : 'quality_gate_failed';
    if (value.gate !== expectedGate) {
      issue('V5 quality gate aggregate mismatch');
    }
  });

export type Phase697TutorOrganizerV5Report = z.infer<
  typeof PHASE_6_9_7_TUTOR_ORGANIZER_V5_REPORT_SCHEMA
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

export const PHASE_6_9_7_V5_EVIDENCE_ENVELOPE_SCHEMA = z
  .object({
    evidenceVersion: z.literal(PHASE_6_9_7_V5_EVIDENCE_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V5),
    runId: runIdSchema,
    runScope: z.enum(['branch', 'main']),
    mode: z.enum(['mock', 'live']),
    durability: durabilitySchema,
    reportSha256: sha256Schema,
    report: PHASE_6_9_7_TUTOR_ORGANIZER_V5_REPORT_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
    if (
      value.runId !== value.report.runId ||
      value.runScope !== value.report.runScope ||
      value.mode !== value.report.mode ||
      value.reportSha256 !== sha256Phase697V5Stable(value.report)
    ) {
      issue('V5 evidence identity mismatch');
    }
    if (value.durability.disposition === 'mock_direct') {
      if (
        value.mode !== 'mock' ||
        value.durability.markerSha256 !== null ||
        value.durability.journalTailSha256 !== null ||
        value.durability.journalSequence !== null
      ) {
        issue('V5 mock durability mismatch');
      }
      return;
    }
    if (value.mode !== 'live' || value.durability.markerSha256 === null) {
      issue('V5 live durability mismatch');
    }
    if (value.durability.disposition === 'journal_missing_sealed') {
      if (
        value.durability.journalTailSha256 !== null ||
        value.durability.journalSequence !== null ||
        value.report.gate !== 'quality_gate_failed'
      ) {
        issue('V5 missing journal durability mismatch');
      }
      return;
    }
    if (
      value.durability.journalTailSha256 === null ||
      value.durability.journalSequence === null ||
      (value.durability.disposition === 'orphan_sealed' &&
        value.report.gate !== 'quality_gate_failed')
    ) {
      issue('V5 journal durability mismatch');
    }
  });

export type Phase697V5EvidenceEnvelope = z.infer<typeof PHASE_6_9_7_V5_EVIDENCE_ENVELOPE_SCHEMA>;

export function buildPhase697V5EvidenceEnvelope(input: {
  report: Readonly<Phase697TutorOrganizerV5Report>;
  disposition: Phase697V5EvidenceEnvelope['durability']['disposition'];
  markerSha256: string | null;
  journalTailSha256: string | null;
  journalSequence: number | null;
}): Readonly<Phase697V5EvidenceEnvelope> | null {
  const parsed = PHASE_6_9_7_V5_EVIDENCE_ENVELOPE_SCHEMA.safeParse({
    evidenceVersion: PHASE_6_9_7_V5_EVIDENCE_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V5,
    runId: input.report.runId,
    runScope: input.report.runScope,
    mode: input.report.mode,
    durability: {
      disposition: input.disposition,
      markerSha256: input.markerSha256,
      journalTailSha256: input.journalTailSha256,
      journalSequence: input.journalSequence,
    },
    reportSha256: sha256Phase697V5Stable(input.report),
    report: input.report,
  });
  return parsed.success ? deepFreeze(parsed.data) : null;
}

export function buildPhase697V5Marker(input: {
  runId: string;
  runScope: 'branch' | 'main';
  executorProvenance?: 'deepseek_network' | 'synthetic_test';
  ownerProcessId?: number;
}): Phase697V5Marker {
  return PHASE_6_9_7_V5_MARKER_SCHEMA.parse({
    markerVersion: PHASE_6_9_7_V5_MARKER_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V5,
    datasetVersion: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
    datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
    evalPolicySha256: PHASE_6_9_7_V5_EVAL_POLICY_SHA256,
    runId: input.runId,
    runScope: input.runScope,
    mode: 'live',
    executorProvenance: input.executorProvenance ?? 'deepseek_network',
    ownerProcessId: input.ownerProcessId ?? process.pid,
    state: 'attempt_reserved',
  });
}

export function phase697V5JournalPath(runId: string): string | null {
  return isUuid(runId)
    ? `.tmp/phase-6-9-7-tutor-organizer-v5-controlled-live-${runId}.journal.jsonl`
    : null;
}

export function phase697V5RecoveryClaimPath(runId: string): string | null {
  return isUuid(runId)
    ? `.tmp/phase-6-9-7-tutor-organizer-v5-controlled-live-${runId}.recovery.claim`
    : null;
}

export function phase697V5EvidencePath(input: {
  runId: string;
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
}): string | null {
  return isUuid(input.runId)
    ? `.tmp/phase-6-9-7-tutor-organizer-v5-${input.runScope}-${input.mode}-${input.runId}.json`
    : null;
}

export function parsePhase697TutorOrganizerV5Report(
  input: unknown,
): Readonly<Phase697TutorOrganizerV5Report> | null {
  const cloned = clonePlainEvidenceData(input);
  if (!cloned.ok) return null;
  const parsed = PHASE_6_9_7_TUTOR_ORGANIZER_V5_REPORT_SCHEMA.safeParse(cloned.value);
  return parsed.success ? deepFreeze(parsed.data) : null;
}

export function sha256Phase697V5Stable(value: unknown): `sha256:${string}` {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(sortStableValue(value)), 'utf8')
    .digest('hex')}`;
}

export function phase697V5IdentitySnapshot() {
  return deepFreeze({
    datasetVersion: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
    datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
    evalPolicyVersion: PHASE_6_9_7_V5_EVAL_POLICY_VERSION,
    evalPolicySha256: PHASE_6_9_7_V5_EVAL_POLICY_SHA256,
    deterministicBaselineSha256: PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256,
    tutorPromptVersion: TUTOR_V5_MODEL_PROMPT_VERSION,
    tutorPromptContentSha256: TUTOR_V5_MODEL_PROMPT_CONTENT_SHA256,
    tutorProjectionVersion: TUTOR_V5_MODEL_PROJECTION_VERSION,
    tutorAuthorityVersion: TUTOR_V5_LOCAL_SIGNAL_AUTHORITY_VERSION,
    tutorAuthorityRulesSha256: TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256,
    organizerPromptVersion: WRONG_QUESTION_ORGANIZER_V5_MODEL_PROMPT_VERSION,
    organizerPromptContentSha256: WRONG_QUESTION_ORGANIZER_V5_MODEL_PROMPT_SHA256,
    organizerProjectionVersion: WRONG_QUESTION_ORGANIZER_V5_MODEL_PROJECTION_VERSION,
    organizerShortlistVersion: WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION,
    organizerShortlistRulesSha256: WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_SHA256,
  });
}

export function runtimeContractSuccessV5(entry: Readonly<Phase697V5CaseEntry>): boolean {
  return entry.executionKind === 'runtime' && entry.strictRuntimeSuccess;
}

export function phase697V5QualityGatePasses(report: Readonly<Phase697TutorOrganizerV5Report>) {
  const policy = PHASE_6_9_7_V5_EVAL_POLICY;
  const baseline = PHASE_6_9_7_V5_DETERMINISTIC_BASELINE.metrics;
  if (!baseline.ok) return false;
  return (
    report.mode === 'live' &&
    report.executorProvenance === 'deepseek_network' &&
    report.metrics.complete &&
    report.latency.complete &&
    report.usage.complete &&
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
    (report.latency.tutorP95Ms ?? Number.POSITIVE_INFINITY) <= policy.latencyMs.tutorP95Max &&
    (report.latency.organizerP95Ms ?? Number.POSITIVE_INFINITY) <=
      policy.latencyMs.organizerP95Max &&
    (report.latency.pairedP95Ms ?? Number.POSITIVE_INFINITY) <= policy.latencyMs.pairedP95Max &&
    (report.latency.orchestrationP95Ms ?? Number.POSITIVE_INFINITY) <=
      policy.latencyMs.orchestrationP95Max &&
    report.usage.providerInvocations <= policy.usage.providerInvocationsMax &&
    (report.usage.inputTokens ?? 0) >= policy.usage.inputTokensMin &&
    (report.usage.inputTokens ?? Number.POSITIVE_INFINITY) <= policy.usage.inputTokensMax &&
    (report.usage.outputTokens ?? 0) >= policy.usage.outputTokensMin &&
    (report.usage.outputTokens ?? Number.POSITIVE_INFINITY) <= policy.usage.outputTokensMax &&
    (report.usage.estimatedCostCny ?? 0) > policy.usage.estimatedCostCnyExclusiveMin &&
    (report.usage.estimatedCostCny ?? Number.POSITIVE_INFINITY) <= policy.usage.estimatedCostCnyMax
  );
}

function runtimeCaseAggregateComplete(entry: Phase697V5CaseEntry) {
  return entry.executionKind === 'zero_call' || entry.semanticAxes !== null;
}

function runtimeCaseLatencyComplete(entry: Phase697V5CaseEntry) {
  return entry.executionKind === 'zero_call' || entry.latencyMs !== null;
}

function runtimeCaseUsageComplete(entry: Phase697V5CaseEntry) {
  return entry.executionKind === 'zero_call' || entry.usageDisposition === 'verified';
}

function semanticScoreForSchema(entries: readonly Phase697V5CaseEntry[]) {
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

function nearestRankP95ForSchema(values: readonly number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(0.95 * sorted.length) - 1] ?? 0;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sortStableValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('PHASE_6_9_7_V5_NON_FINITE_VALUE');
    return value;
  }
  if (Array.isArray(value)) return value.map(sortStableValue);
  if (typeof value !== 'object') throw new Error('PHASE_6_9_7_V5_UNSUPPORTED_VALUE');
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('PHASE_6_9_7_V5_NON_PLAIN_VALUE');
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
