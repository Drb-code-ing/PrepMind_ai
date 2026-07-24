import { z } from 'zod';

import {
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  MODEL_AGENT_STRUCTURED_OUTPUT_STAGES,
  type ModelAgentProviderFailureCategory,
  type ModelAgentStructuredOutputStage,
} from '@repo/ai';

import type { ModelCandidateObservation } from '../model-candidates/model-candidate-policy.ts';

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
      (value.runtimeInvocations === 1 && completedStageIndex < delegateStartedIndex)
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
        value.lastCompletedStage === null ||
        value.lastCompletedStage === 'applied'
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
        value.lastCompletedStage === 'applied' ||
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
