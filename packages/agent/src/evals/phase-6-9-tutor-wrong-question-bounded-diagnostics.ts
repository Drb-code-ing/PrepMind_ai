import { z } from 'zod';

import type { ModelCandidateDisposition } from '../model-candidates/model-candidate-policy.ts';

export const PHASE_6_9_7_CANONICAL_DIAGNOSTIC_ADAPTER_VERSION =
  'phase-6.9.7-canonical-diagnostic-adapter-v1' as const;

export const PHASE_6_9_7_CANONICAL_VALIDATION_STAGES = [
  'raw_schema',
  'dynamic_contract',
  'local_merger',
  'applied',
] as const;

export const PHASE_6_9_7_TUTOR_DYNAMIC_CONTRACT_FAILURE_REASONS = [
  'invalid_evidence_association',
] as const;

export const PHASE_6_9_7_ORGANIZER_DYNAMIC_CONTRACT_FAILURE_REASONS = [
  ...PHASE_6_9_7_TUTOR_DYNAMIC_CONTRACT_FAILURE_REASONS,
  'context_invalid',
  'question_count_mismatch',
  'duplicate_question_index',
  'question_index_out_of_range',
  'subject_authority_violation',
  'deck_index_out_of_range',
  'cross_subject_deck',
  'unsafe_topic_label',
] as const;

export const PHASE_6_9_7_DYNAMIC_CONTRACT_FAILURE_REASONS =
  PHASE_6_9_7_ORGANIZER_DYNAMIC_CONTRACT_FAILURE_REASONS;

export const PHASE_6_9_7_LOCAL_MERGER_FAILURE_REASONS = [
  'incompatible_depth',
  'projection_association_invalid',
] as const;

export const PHASE_6_9_7_CANONICAL_FAILURE_REASONS = [
  'schema_invalid',
  ...PHASE_6_9_7_DYNAMIC_CONTRACT_FAILURE_REASONS,
  ...PHASE_6_9_7_LOCAL_MERGER_FAILURE_REASONS,
] as const;

const rawSchemaDiagnosticSchema = z
  .object({
    canonicalValidationStage: z.literal('raw_schema'),
    canonicalFailureReason: z.literal('schema_invalid'),
  })
  .strict();

const dynamicContractDiagnosticSchema = z
  .object({
    canonicalValidationStage: z.literal('dynamic_contract'),
    canonicalFailureReason: z.enum(PHASE_6_9_7_DYNAMIC_CONTRACT_FAILURE_REASONS),
  })
  .strict();

const localMergerDiagnosticSchema = z
  .object({
    canonicalValidationStage: z.literal('local_merger'),
    canonicalFailureReason: z.enum(PHASE_6_9_7_LOCAL_MERGER_FAILURE_REASONS),
  })
  .strict();

const appliedDiagnosticSchema = z
  .object({
    canonicalValidationStage: z.literal('applied'),
    canonicalFailureReason: z.null(),
  })
  .strict();

const preStructuredDiagnosticSchema = z
  .object({
    canonicalValidationStage: z.null(),
    canonicalFailureReason: z.null(),
  })
  .strict();

export const PHASE_6_9_7_CANONICAL_DIAGNOSTIC_SCHEMA = z.discriminatedUnion(
  'canonicalValidationStage',
  [
    rawSchemaDiagnosticSchema,
    dynamicContractDiagnosticSchema,
    localMergerDiagnosticSchema,
    appliedDiagnosticSchema,
    preStructuredDiagnosticSchema,
  ],
);

export type Phase697CanonicalDiagnostic = z.infer<
  typeof PHASE_6_9_7_CANONICAL_DIAGNOSTIC_SCHEMA
>;

export const PHASE_6_9_7_PRE_STRUCTURED_CANONICAL_DIAGNOSTIC = Object.freeze({
  canonicalValidationStage: null,
  canonicalFailureReason: null,
}) satisfies Phase697CanonicalDiagnostic;

const RAW_SCHEMA_DIAGNOSTIC = Object.freeze({
  canonicalValidationStage: 'raw_schema',
  canonicalFailureReason: 'schema_invalid',
}) satisfies Phase697CanonicalDiagnostic;

const APPLIED_DIAGNOSTIC = Object.freeze({
  canonicalValidationStage: 'applied',
  canonicalFailureReason: null,
}) satisfies Phase697CanonicalDiagnostic;

const TUTOR_DYNAMIC_REASONS = new Set<string>(
  PHASE_6_9_7_TUTOR_DYNAMIC_CONTRACT_FAILURE_REASONS,
);
const ORGANIZER_DYNAMIC_REASONS = new Set<string>(
  PHASE_6_9_7_ORGANIZER_DYNAMIC_CONTRACT_FAILURE_REASONS,
);

export function resolvePhase697CanonicalDiagnostic(input: Readonly<{
  agent: 'tutor' | 'wrong_question_organizer';
  structuredObjectCaptured: boolean;
  rawSchemaValid: boolean;
  candidateDisposition: ModelCandidateDisposition;
  reasonCodes: readonly string[];
}>): Phase697CanonicalDiagnostic {
  if (!input.structuredObjectCaptured) {
    return PHASE_6_9_7_PRE_STRUCTURED_CANONICAL_DIAGNOSTIC;
  }

  if (input.candidateDisposition === 'candidate_applied') {
    if (!input.rawSchemaValid) throwUnmapped();
    return APPLIED_DIAGNOSTIC;
  }

  const reasons = new Set(input.reasonCodes);
  reasons.delete(input.candidateDisposition);
  if (!input.rawSchemaValid) return RAW_SCHEMA_DIAGNOSTIC;

  if (input.candidateDisposition !== 'fallback_schema_invalid') {
    return PHASE_6_9_7_PRE_STRUCTURED_CANONICAL_DIAGNOSTIC;
  }

  const dynamicReasons =
    input.agent === 'tutor' ? TUTOR_DYNAMIC_REASONS : ORGANIZER_DYNAMIC_REASONS;
  const dynamicMatches = [...dynamicReasons].filter((reason) => reasons.has(reason));
  const localReason =
    input.agent === 'tutor' ? 'incompatible_depth' : 'projection_association_invalid';
  const localMatch = reasons.has(localReason);

  if (dynamicMatches.length === 1 && !localMatch) {
    if (reasons.size !== 1) return throwUnmapped();
    return {
      canonicalValidationStage: 'dynamic_contract',
      canonicalFailureReason: dynamicMatches[0] as (
        typeof PHASE_6_9_7_DYNAMIC_CONTRACT_FAILURE_REASONS
      )[number],
    };
  }
  if (dynamicMatches.length === 0 && localMatch) {
    if (reasons.size !== 1) return throwUnmapped();
    return {
      canonicalValidationStage: 'local_merger',
      canonicalFailureReason: localReason,
    };
  }

  return throwUnmapped();
}

function throwUnmapped(): never {
  throw new Error('PHASE_6_9_7_CANONICAL_DIAGNOSTIC_UNMAPPED');
}
