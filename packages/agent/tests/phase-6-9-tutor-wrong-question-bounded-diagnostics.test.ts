import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_CANONICAL_DIAGNOSTIC_SCHEMA,
  resolvePhase697CanonicalDiagnostic,
} from '../src/evals/phase-6-9-tutor-wrong-question-bounded-diagnostics.ts';

describe('phase 6.9.7 Tutor/Organizer bounded diagnostics', () => {
  test('accepts only the frozen stage and reason combinations', () => {
    for (const diagnostic of [
      {
        canonicalValidationStage: 'raw_schema',
        canonicalFailureReason: 'schema_invalid',
      },
      {
        canonicalValidationStage: 'dynamic_contract',
        canonicalFailureReason: 'invalid_evidence_association',
      },
      {
        canonicalValidationStage: 'local_merger',
        canonicalFailureReason: 'incompatible_depth',
      },
      {
        canonicalValidationStage: 'local_merger',
        canonicalFailureReason: 'projection_association_invalid',
      },
      { canonicalValidationStage: 'applied', canonicalFailureReason: null },
      { canonicalValidationStage: null, canonicalFailureReason: null },
    ] as const) {
      expect(PHASE_6_9_7_CANONICAL_DIAGNOSTIC_SCHEMA.safeParse(diagnostic).success).toBe(true);
    }

    for (const diagnostic of [
      { canonicalValidationStage: 'raw_schema', canonicalFailureReason: null },
      {
        canonicalValidationStage: 'raw_schema',
        canonicalFailureReason: 'incompatible_depth',
      },
      {
        canonicalValidationStage: 'dynamic_contract',
        canonicalFailureReason: 'schema_invalid',
      },
      {
        canonicalValidationStage: 'local_merger',
        canonicalFailureReason: 'invalid_evidence_association',
      },
      {
        canonicalValidationStage: 'applied',
        canonicalFailureReason: 'projection_association_invalid',
      },
      { canonicalValidationStage: null, canonicalFailureReason: 'schema_invalid' },
      { canonicalValidationStage: 'transport', canonicalFailureReason: null },
      { canonicalValidationStage: 'dynamic_contract', canonicalFailureReason: 'free text' },
    ]) {
      expect(PHASE_6_9_7_CANONICAL_DIAGNOSTIC_SCHEMA.safeParse(diagnostic).success).toBe(false);
    }
  });

  test('maps Tutor raw, dynamic, merger, applied, and pre-structured failures', () => {
    expect(
      resolvePhase697CanonicalDiagnostic({
        agent: 'tutor',
        structuredObjectCaptured: true,
        rawSchemaValid: false,
        candidateDisposition: 'fallback_schema_invalid',
        reasonCodes: ['schema_invalid'],
      }),
    ).toEqual({
      canonicalValidationStage: 'raw_schema',
      canonicalFailureReason: 'schema_invalid',
    });
    expect(
      resolvePhase697CanonicalDiagnostic({
        agent: 'tutor',
        structuredObjectCaptured: true,
        rawSchemaValid: true,
        candidateDisposition: 'fallback_schema_invalid',
        reasonCodes: ['invalid_evidence_association'],
      }),
    ).toEqual({
      canonicalValidationStage: 'dynamic_contract',
      canonicalFailureReason: 'invalid_evidence_association',
    });
    expect(
      resolvePhase697CanonicalDiagnostic({
        agent: 'tutor',
        structuredObjectCaptured: true,
        rawSchemaValid: true,
        candidateDisposition: 'fallback_schema_invalid',
        reasonCodes: ['incompatible_depth'],
      }),
    ).toEqual({
      canonicalValidationStage: 'local_merger',
      canonicalFailureReason: 'incompatible_depth',
    });
    expect(
      resolvePhase697CanonicalDiagnostic({
        agent: 'tutor',
        structuredObjectCaptured: true,
        rawSchemaValid: true,
        candidateDisposition: 'candidate_applied',
        reasonCodes: ['implicit_hint_request'],
      }),
    ).toEqual({ canonicalValidationStage: 'applied', canonicalFailureReason: null });
    expect(
      resolvePhase697CanonicalDiagnostic({
        agent: 'tutor',
        structuredObjectCaptured: false,
        rawSchemaValid: false,
        candidateDisposition: 'fallback_runtime_error',
        reasonCodes: ['RUNTIME_ERROR'],
      }),
    ).toEqual({ canonicalValidationStage: null, canonicalFailureReason: null });
  });

  test('maps Organizer dynamic and merger failures without accepting unknown reasons', () => {
    expect(
      resolvePhase697CanonicalDiagnostic({
        agent: 'wrong_question_organizer',
        structuredObjectCaptured: true,
        rawSchemaValid: true,
        candidateDisposition: 'fallback_schema_invalid',
        reasonCodes: ['subject_authority_violation'],
      }),
    ).toEqual({
      canonicalValidationStage: 'dynamic_contract',
      canonicalFailureReason: 'subject_authority_violation',
    });
    expect(
      resolvePhase697CanonicalDiagnostic({
        agent: 'wrong_question_organizer',
        structuredObjectCaptured: true,
        rawSchemaValid: true,
        candidateDisposition: 'fallback_schema_invalid',
        reasonCodes: ['projection_association_invalid'],
      }),
    ).toEqual({
      canonicalValidationStage: 'local_merger',
      canonicalFailureReason: 'projection_association_invalid',
    });
    expect(() =>
      resolvePhase697CanonicalDiagnostic({
        agent: 'wrong_question_organizer',
        structuredObjectCaptured: true,
        rawSchemaValid: true,
        candidateDisposition: 'fallback_schema_invalid',
        reasonCodes: ['semantic_organization'],
      }),
    ).toThrow('PHASE_6_9_7_CANONICAL_DIAGNOSTIC_UNMAPPED');
    expect(() =>
      resolvePhase697CanonicalDiagnostic({
        agent: 'wrong_question_organizer',
        structuredObjectCaptured: true,
        rawSchemaValid: true,
        candidateDisposition: 'fallback_schema_invalid',
        reasonCodes: ['invalid_evidence_association', 'semantic_organization'],
      }),
    ).toThrow('PHASE_6_9_7_CANONICAL_DIAGNOSTIC_UNMAPPED');
  });
});
