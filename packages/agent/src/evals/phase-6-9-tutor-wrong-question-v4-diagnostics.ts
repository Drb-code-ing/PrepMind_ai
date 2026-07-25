import { z } from 'zod';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION,
} from './phase-6-9-tutor-wrong-question-cases.ts';
import {
  WRONG_QUESTION_ORGANIZER_V4_FAILURE_DIAGNOSTIC_SCHEMA,
  type WrongQuestionOrganizerV4FailureDiagnostic,
} from '../model-candidates/wrong-question-organizer-model-contract.ts';
import { clonePlainModelData } from '../model-candidates/model-projection-safety.ts';

export const PHASE_6_9_7_V4_DIAGNOSTIC_VERSION = 'phase-6.9.7-v4-bounded-diagnostics-v1' as const;

export const PHASE_6_9_7_V4_EXECUTION_CLASSIFICATIONS = [
  'not_started',
  'executed_contract_failure',
  'executed_semantic_mismatch',
  'executed_semantic_match',
] as const;

export const PHASE_6_9_7_V4_NOT_STARTED_REASONS = [
  'case_guard',
  'quality_breaker',
  'parent_abort',
  'orphaned',
] as const;

export const PHASE_6_9_7_V4_CONTRACT_FAILURE_STAGES = [
  'provider_runtime',
  'raw_schema',
  'dynamic_contract',
  'local_merger',
  'usage',
  'latency',
  'safety',
] as const;

export const PHASE_6_9_7_V4_TUTOR_SEMANTIC_AXES = [
  'intent',
  'depth',
  'evidenceAssociation',
  'contextUse',
  'guidingPolicy',
  'finalAnswerBoundary',
  'answerStructure',
] as const;

export const PHASE_6_9_7_V4_ORGANIZER_SEMANTIC_AXES = [
  'subject',
  'deck',
  'topic',
  'evidence',
  'confidence',
] as const;

const boundedCount = z.number().int().safe().nonnegative();
const caseIdSchema = z.string().regex(/^(tutor|organizer)-[a-z0-9-]+$/);

export const PHASE_6_9_7_V4_TUTOR_SEMANTIC_OBSERVATION_SCHEMA = z
  .object({
    agent: z.literal('tutor'),
    axes: z
      .object({
        intent: z.boolean(),
        depth: z.boolean(),
        evidenceAssociation: z.boolean(),
        contextUse: z.boolean(),
        guidingPolicy: z.boolean(),
        finalAnswerBoundary: z.boolean(),
        answerStructure: z.boolean(),
      })
      .strict(),
    moreSpecificPrimaryEvidenceSuppressed: z.boolean().nullable(),
  })
  .strict();

export const PHASE_6_9_7_V4_ORGANIZER_SEMANTIC_OBSERVATION_SCHEMA = z
  .object({
    agent: z.literal('wrong_question_organizer'),
    axes: z
      .object({
        subject: z.boolean(),
        deck: z.boolean(),
        topic: z.boolean(),
        evidence: z.boolean(),
        confidence: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const PHASE_6_9_7_V4_SEMANTIC_OBSERVATION_SCHEMA = z
  .discriminatedUnion('agent', [
    PHASE_6_9_7_V4_TUTOR_SEMANTIC_OBSERVATION_SCHEMA,
    PHASE_6_9_7_V4_ORGANIZER_SEMANTIC_OBSERVATION_SCHEMA,
  ])
  .superRefine((observation, context) => {
    if (
      observation.agent === 'tutor' &&
      observation.moreSpecificPrimaryEvidenceSuppressed &&
      observation.axes.intent
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'suppressed primary evidence requires an intent mismatch',
      });
    }
  });

export type Phase697V4SemanticObservation = z.infer<
  typeof PHASE_6_9_7_V4_SEMANTIC_OBSERVATION_SCHEMA
>;

export const PHASE_6_9_7_V4_CASE_DIAGNOSTIC_SCHEMA = z
  .object({
    diagnosticVersion: z.literal(PHASE_6_9_7_V4_DIAGNOSTIC_VERSION),
    caseId: caseIdSchema,
    agent: z.enum(['tutor', 'wrong_question_organizer']),
    executionClassification: z.enum(PHASE_6_9_7_V4_EXECUTION_CLASSIFICATIONS),
    notStartedReason: z.enum(PHASE_6_9_7_V4_NOT_STARTED_REASONS).nullable(),
    runtimeContractSuccess: z.boolean().nullable(),
    contractFailureStage: z.enum(PHASE_6_9_7_V4_CONTRACT_FAILURE_STAGES).nullable(),
    semanticMatch: z.boolean().nullable(),
    semanticObservation: PHASE_6_9_7_V4_SEMANTIC_OBSERVATION_SCHEMA.nullable(),
    organizerDynamicFailure: WRONG_QUESTION_ORGANIZER_V4_FAILURE_DIAGNOSTIC_SCHEMA.nullable(),
  })
  .strict()
  .superRefine((entry, context) => {
    const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
    if (entry.caseId.startsWith('tutor-') !== (entry.agent === 'tutor')) {
      issue('case id and agent mismatch');
    }

    if (entry.executionClassification === 'not_started') {
      if (
        entry.notStartedReason === null ||
        entry.runtimeContractSuccess !== null ||
        entry.contractFailureStage !== null ||
        entry.semanticMatch !== null ||
        entry.semanticObservation !== null ||
        entry.organizerDynamicFailure !== null
      ) {
        issue('not-started diagnostic mismatch');
      }
      return;
    }

    if (entry.notStartedReason !== null) {
      issue('executed diagnostic cannot contain a not-started reason');
    }
    if (entry.executionClassification === 'executed_contract_failure') {
      if (
        entry.runtimeContractSuccess !== false ||
        entry.contractFailureStage === null ||
        entry.semanticMatch !== null ||
        entry.semanticObservation !== null ||
        (entry.agent === 'tutor' && entry.organizerDynamicFailure !== null) ||
        (entry.agent === 'wrong_question_organizer' &&
          (entry.contractFailureStage === 'raw_schema' ||
            entry.contractFailureStage === 'dynamic_contract') &&
          (entry.organizerDynamicFailure === null ||
            entry.organizerDynamicFailure.stage !== entry.contractFailureStage)) ||
        (entry.organizerDynamicFailure !== null &&
          entry.contractFailureStage !== entry.organizerDynamicFailure.stage)
      ) {
        issue('executed contract-failure diagnostic mismatch');
      }
      return;
    }

    const expectedSemanticMatch = entry.executionClassification === 'executed_semantic_match';
    if (
      entry.runtimeContractSuccess !== true ||
      entry.contractFailureStage !== null ||
      entry.semanticMatch !== expectedSemanticMatch ||
      entry.semanticObservation === null ||
      entry.semanticObservation?.agent !== entry.agent ||
      entry.organizerDynamicFailure !== null
    ) {
      issue('executed semantic diagnostic mismatch');
      return;
    }
    if (semanticObservationMatches(entry.semanticObservation) !== expectedSemanticMatch) {
      issue('semantic axes and classification mismatch');
    }
  });

export type Phase697V4CaseDiagnostic = z.infer<typeof PHASE_6_9_7_V4_CASE_DIAGNOSTIC_SCHEMA>;

export type Phase697V4CaseDiagnosticProjectionInput = Readonly<{
  caseId: string;
  agent: 'tutor' | 'wrong_question_organizer';
  notStartedReason: (typeof PHASE_6_9_7_V4_NOT_STARTED_REASONS)[number] | null;
  runtimeContractSuccess: boolean | null;
  contractFailureStage: (typeof PHASE_6_9_7_V4_CONTRACT_FAILURE_STAGES)[number] | null;
  semanticObservation: Phase697V4SemanticObservation | null;
  organizerDynamicFailure: WrongQuestionOrganizerV4FailureDiagnostic | null;
}>;

export function projectPhase697V4CaseDiagnostic(
  input: Phase697V4CaseDiagnosticProjectionInput,
): Readonly<Phase697V4CaseDiagnostic> | null {
  try {
    const cloned = clonePlainModelData(input);
    if (!cloned.ok) return null;
    const projectionInput = v4CaseDiagnosticProjectionInputSchema.safeParse(cloned.value);
    if (!projectionInput.success) return null;
    const safe = projectionInput.data;
    const executionClassification = classifyExecution(safe);
    if (executionClassification === null) return null;
    const semanticMatch =
      safe.runtimeContractSuccess === true && safe.semanticObservation !== null
        ? semanticObservationMatches(safe.semanticObservation)
        : null;
    const parsed = PHASE_6_9_7_V4_CASE_DIAGNOSTIC_SCHEMA.safeParse({
      diagnosticVersion: PHASE_6_9_7_V4_DIAGNOSTIC_VERSION,
      caseId: safe.caseId,
      agent: safe.agent,
      executionClassification,
      notStartedReason: safe.notStartedReason,
      runtimeContractSuccess: safe.runtimeContractSuccess,
      contractFailureStage: safe.contractFailureStage,
      semanticMatch,
      semanticObservation: safe.semanticObservation,
      organizerDynamicFailure: safe.organizerDynamicFailure,
    });
    return parsed.success ? deepFreeze(parsed.data) : null;
  } catch {
    return null;
  }
}

const v4CaseDiagnosticProjectionInputSchema = z
  .object({
    caseId: caseIdSchema,
    agent: z.enum(['tutor', 'wrong_question_organizer']),
    notStartedReason: z.enum(PHASE_6_9_7_V4_NOT_STARTED_REASONS).nullable(),
    runtimeContractSuccess: z.boolean().nullable(),
    contractFailureStage: z.enum(PHASE_6_9_7_V4_CONTRACT_FAILURE_STAGES).nullable(),
    semanticObservation: PHASE_6_9_7_V4_SEMANTIC_OBSERVATION_SCHEMA.nullable(),
    organizerDynamicFailure: WRONG_QUESTION_ORGANIZER_V4_FAILURE_DIAGNOSTIC_SCHEMA.nullable(),
  })
  .strict();

const executionClassCountsSchema = z
  .object({
    notStarted: boundedCount,
    executedContractFailures: boundedCount,
    executedSemanticMismatches: boundedCount,
    executedSemanticMatches: boundedCount,
  })
  .strict();

const tutorSemanticMismatchCountsSchema = z
  .object({
    intent: boundedCount,
    depth: boundedCount,
    evidenceAssociation: boundedCount,
    contextUse: boundedCount,
    guidingPolicy: boundedCount,
    finalAnswerBoundary: boundedCount,
    answerStructure: boundedCount,
  })
  .strict();

const contractFailureStageCountsSchema = z
  .object({
    provider_runtime: boundedCount,
    raw_schema: boundedCount,
    dynamic_contract: boundedCount,
    local_merger: boundedCount,
    usage: boundedCount,
    latency: boundedCount,
    safety: boundedCount,
  })
  .strict();

const organizerSemanticMismatchCountsSchema = z
  .object({
    subject: boundedCount,
    deck: boundedCount,
    topic: boundedCount,
    evidence: boundedCount,
    confidence: boundedCount,
  })
  .strict();

const organizerDynamicFailureCountsSchema = z
  .object({
    schema_invalid: boundedCount,
    context_invalid: boundedCount,
    question_count_mismatch: boundedCount,
    duplicate_question_index: boundedCount,
    question_index_out_of_range: boundedCount,
    known_subject_requires_keep_local: boundedCount,
    unknown_subject_requires_bounded_subject: boundedCount,
    subject_unresolved: boundedCount,
    deck_index_out_of_range: boundedCount,
    cross_subject_deck: boundedCount,
    topic_label_invalid: boundedCount,
    known_subject_evidence_missing: boundedCount,
    deck_action_evidence_missing: boundedCount,
    confidence_evidence_conflict: boundedCount,
  })
  .strict();

export const PHASE_6_9_7_V4_DIAGNOSTIC_REPORT_SCHEMA = z
  .object({
    diagnosticVersion: z.literal(PHASE_6_9_7_V4_DIAGNOSTIC_VERSION),
    datasetVersion: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION),
    datasetSha256: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256),
    counts: executionClassCountsSchema,
    contractFailureStageCounts: contractFailureStageCountsSchema,
    tutorSemanticMismatchAxisCounts: tutorSemanticMismatchCountsSchema,
    organizerSemanticMismatchAxisCounts: organizerSemanticMismatchCountsSchema,
    organizerDynamicFailureReasonCounts: organizerDynamicFailureCountsSchema,
    caseEntries: z.array(PHASE_6_9_7_V4_CASE_DIAGNOSTIC_SCHEMA).length(72),
  })
  .strict()
  .superRefine((report, context) => {
    const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
    const canonicalCases = new Map<string, 'tutor' | 'wrong_question_organizer'>(
      PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.map((entry) => [entry.id, entry.agent] as const),
    );
    const canonicalRuntime = new Map<string, 0 | 1>(
      PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.map((entry) => [
        entry.id,
        entry.expectedRuntimeInvocations,
      ]),
    );
    const ids = report.caseEntries.map((entry) => entry.caseId);
    if (
      new Set(ids).size !== 72 ||
      ids.some((id) => !canonicalCases.has(id)) ||
      report.caseEntries.some((entry) => canonicalCases.get(entry.caseId) !== entry.agent)
    ) {
      issue('V4 diagnostic case ids must be unique and canonical');
    }
    if (
      report.caseEntries.some((entry) => {
        const expectedRuntime = canonicalRuntime.get(entry.caseId);
        return expectedRuntime === 0
          ? entry.executionClassification !== 'not_started' ||
              entry.notStartedReason !== 'case_guard'
          : entry.notStartedReason === 'case_guard';
      })
    ) {
      issue('V4 guard/runtime execution classification mismatch');
    }
    const derived = deriveReportCounts(report.caseEntries);
    if (!sameJson(report.counts, derived.counts)) issue('V4 execution counts mismatch');
    if (!sameJson(report.contractFailureStageCounts, derived.contractFailureStages)) {
      issue('V4 contract failure stage counts mismatch');
    }
    if (!sameJson(report.tutorSemanticMismatchAxisCounts, derived.tutorAxes)) {
      issue('V4 Tutor semantic mismatch counts mismatch');
    }
    if (!sameJson(report.organizerSemanticMismatchAxisCounts, derived.organizerAxes)) {
      issue('V4 Organizer semantic mismatch counts mismatch');
    }
    if (!sameJson(report.organizerDynamicFailureReasonCounts, derived.organizerFailures)) {
      issue('V4 Organizer dynamic failure counts mismatch');
    }
  });

export type Phase697V4DiagnosticReport = z.infer<typeof PHASE_6_9_7_V4_DIAGNOSTIC_REPORT_SCHEMA>;

export function buildPhase697V4DiagnosticReport(
  caseEntries: readonly Phase697V4CaseDiagnostic[],
): Readonly<Phase697V4DiagnosticReport> | null {
  const cloned = clonePlainModelData(caseEntries);
  if (!cloned.ok) return null;
  const entries = z.array(PHASE_6_9_7_V4_CASE_DIAGNOSTIC_SCHEMA).length(72).safeParse(cloned.value);
  if (!entries.success) return null;
  const derived = deriveReportCounts(entries.data);
  const parsed = PHASE_6_9_7_V4_DIAGNOSTIC_REPORT_SCHEMA.safeParse({
    diagnosticVersion: PHASE_6_9_7_V4_DIAGNOSTIC_VERSION,
    datasetVersion: PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION,
    datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
    counts: derived.counts,
    contractFailureStageCounts: derived.contractFailureStages,
    tutorSemanticMismatchAxisCounts: derived.tutorAxes,
    organizerSemanticMismatchAxisCounts: derived.organizerAxes,
    organizerDynamicFailureReasonCounts: derived.organizerFailures,
    caseEntries: entries.data,
  });
  return parsed.success ? deepFreeze(parsed.data) : null;
}

function classifyExecution(
  input: Phase697V4CaseDiagnosticProjectionInput,
): (typeof PHASE_6_9_7_V4_EXECUTION_CLASSIFICATIONS)[number] | null {
  if (input.notStartedReason !== null) {
    return input.runtimeContractSuccess === null &&
      input.contractFailureStage === null &&
      input.semanticObservation === null &&
      input.organizerDynamicFailure === null
      ? 'not_started'
      : null;
  }
  if (input.runtimeContractSuccess === false) {
    return input.contractFailureStage !== null && input.semanticObservation === null
      ? 'executed_contract_failure'
      : null;
  }
  if (
    input.runtimeContractSuccess !== true ||
    input.contractFailureStage !== null ||
    input.semanticObservation === null
  ) {
    return null;
  }
  return semanticObservationMatches(input.semanticObservation)
    ? 'executed_semantic_match'
    : 'executed_semantic_mismatch';
}

function semanticObservationMatches(observation: Phase697V4SemanticObservation): boolean {
  return Object.values(observation.axes).every((matches) => matches);
}

function deriveReportCounts(caseEntries: readonly Phase697V4CaseDiagnostic[]) {
  const counts = {
    notStarted: 0,
    executedContractFailures: 0,
    executedSemanticMismatches: 0,
    executedSemanticMatches: 0,
  };
  const tutorAxes = zeroCounts(PHASE_6_9_7_V4_TUTOR_SEMANTIC_AXES);
  const organizerAxes = zeroCounts(PHASE_6_9_7_V4_ORGANIZER_SEMANTIC_AXES);
  const contractFailureStages = zeroCounts(PHASE_6_9_7_V4_CONTRACT_FAILURE_STAGES);
  const organizerFailures = {
    schema_invalid: 0,
    context_invalid: 0,
    question_count_mismatch: 0,
    duplicate_question_index: 0,
    question_index_out_of_range: 0,
    known_subject_requires_keep_local: 0,
    unknown_subject_requires_bounded_subject: 0,
    subject_unresolved: 0,
    deck_index_out_of_range: 0,
    cross_subject_deck: 0,
    topic_label_invalid: 0,
    known_subject_evidence_missing: 0,
    deck_action_evidence_missing: 0,
    confidence_evidence_conflict: 0,
  };

  for (const entry of caseEntries) {
    switch (entry.executionClassification) {
      case 'not_started':
        counts.notStarted += 1;
        break;
      case 'executed_contract_failure':
        counts.executedContractFailures += 1;
        break;
      case 'executed_semantic_mismatch':
        counts.executedSemanticMismatches += 1;
        break;
      case 'executed_semantic_match':
        counts.executedSemanticMatches += 1;
        break;
    }
    if (entry.contractFailureStage !== null) {
      contractFailureStages[entry.contractFailureStage] += 1;
    }
    if (entry.semanticObservation?.agent === 'tutor') {
      incrementFalseAxes(tutorAxes, entry.semanticObservation.axes);
    } else if (entry.semanticObservation?.agent === 'wrong_question_organizer') {
      incrementFalseAxes(organizerAxes, entry.semanticObservation.axes);
    }
    if (entry.organizerDynamicFailure !== null) {
      organizerFailures[entry.organizerDynamicFailure.reasonCode] += 1;
    }
  }
  return { counts, contractFailureStages, tutorAxes, organizerAxes, organizerFailures };
}

function zeroCounts<const TKey extends string>(keys: readonly TKey[]): Record<TKey, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>;
}

function incrementFalseAxes<TKey extends string>(
  counts: Record<TKey, number>,
  axes: Readonly<Record<TKey, boolean>>,
) {
  for (const key of Object.keys(counts) as TKey[]) {
    if (!axes[key]) counts[key] += 1;
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
