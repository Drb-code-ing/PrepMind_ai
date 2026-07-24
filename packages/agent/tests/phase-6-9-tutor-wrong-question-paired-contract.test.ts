import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V2,
  PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA,
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2,
  PHASE_6_9_7_TUTOR_PROMPT_VERSION_V2,
  computePhase697TutorOrganizerGate,
} from '../src/evals/phase-6-9-tutor-wrong-question-paired-contract.ts';
import {
  createPhase697TutorOrganizerMockHarness,
  runPhase697TutorOrganizerPairedEval,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-paired.ts';

describe('phase 6.9.7 Tutor/Organizer paired report contract', () => {
  test('freezes the complete report identity and exact denominators', async () => {
    const report = await runPhase697TutorOrganizerPairedEval(
      createPhase697TutorOrganizerMockHarness(),
    );
    const parsed = PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.parse(report);

    expect(parsed.counts).toEqual({
      cases: 72,
      zeroCall: 24,
      runtime: 48,
      pairedRequests: 24,
      organizerDecisionUnits: 32,
    });
    expect(parsed.datasetSha256).toBe(
      '7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e',
    );
    expect(parsed.safety.zeroCallVerified).toBe(24);
    expect(parsed.safety.strictRuntimeSuccesses).toBe(48);
    expect(parsed.metrics.tutor.semanticScore).toBe(1);
    expect(parsed.metrics.organizer.semanticScore).toBe(1);
    expect(parsed.identities.executorProvenance).toBe('mock_synthetic');
    expect(parsed.gate).toBe('quality_gate_failed');
    expect(computePhase697TutorOrganizerGate(parsed)).toBe('quality_gate_failed');
  });

  test('rejects duplicate cases, dropped denominators, unknown fields, and tampered usage', async () => {
    const report = await runPhase697TutorOrganizerPairedEval(
      createPhase697TutorOrganizerMockHarness(),
    );
    const duplicate = report.caseEntries.map((entry, index) =>
      index === 1 ? { ...entry, caseId: report.caseEntries[0]!.caseId } : entry,
    );
    expect(
      PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.safeParse({
        ...report,
        caseEntries: duplicate,
      }).success,
    ).toBe(false);
    expect(
      PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.safeParse({
        ...report,
        caseEntries: report.caseEntries.slice(0, -1),
      }).success,
    ).toBe(false);
    expect(
      PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.safeParse({
        ...report,
        prompt: 'must-not-persist',
      }).success,
    ).toBe(false);

    const runtimeIndex = report.caseEntries.findIndex((entry) => entry.executionKind === 'runtime');
    const tampered = report.caseEntries.map((entry, index) =>
      index === runtimeIndex && entry.usage
        ? {
            ...entry,
            usage: {
              ...entry.usage,
              estimatedCostCny: entry.usage.estimatedCostCny + 0.001,
            },
          }
        : entry,
    );
    expect(
      PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.safeParse({
        ...report,
        caseEntries: tampered,
      }).success,
    ).toBe(false);
  });

  test('keeps V1 diagnostics absent and requires strict V2 diagnostic pairs', async () => {
    const report = await runPhase697TutorOrganizerPairedEval(
      createPhase697TutorOrganizerMockHarness(),
    );
    expect(
      report.caseEntries.every(
        (entry) =>
          !Object.hasOwn(entry, 'canonicalValidationStage') &&
          !Object.hasOwn(entry, 'canonicalFailureReason'),
      ),
    ).toBe(true);
    expect(
      PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.safeParse({
        ...report,
        caseEntries: report.caseEntries.map((entry) => ({
          ...entry,
          canonicalValidationStage: null,
          canonicalFailureReason: null,
        })),
      }).success,
    ).toBe(false);

    const v2Report = {
      ...report,
      runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2,
      identities: {
        ...report.identities,
        tutorPromptVersion: PHASE_6_9_7_TUTOR_PROMPT_VERSION_V2,
        organizerPromptVersion: PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V2,
      },
      caseEntries: report.caseEntries.map((entry) => ({
        ...entry,
        canonicalValidationStage:
          entry.executionKind === 'zero_call' ? null : ('applied' as const),
        canonicalFailureReason: null,
      })),
    };
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.safeParse(v2Report).success).toBe(true);
    expect(
      PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.safeParse({
        ...v2Report,
        identities: report.identities,
      }).success,
    ).toBe(false);

    const runtimeIndex = v2Report.caseEntries.findIndex(
      (entry) => entry.executionKind === 'runtime',
    );
    const invalidPairs = [
      { canonicalValidationStage: 'raw_schema', canonicalFailureReason: null },
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
        canonicalFailureReason: 'incompatible_depth',
      },
      { canonicalValidationStage: null, canonicalFailureReason: 'schema_invalid' },
      { canonicalValidationStage: 'unknown', canonicalFailureReason: null },
      { canonicalValidationStage: 'dynamic_contract', canonicalFailureReason: 'free text' },
    ];
    for (const invalidPair of invalidPairs) {
      expect(
        PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.safeParse({
          ...v2Report,
          caseEntries: v2Report.caseEntries.map((entry, index) =>
            index === runtimeIndex ? { ...entry, ...invalidPair } : entry,
          ),
        }).success,
      ).toBe(false);
    }

    const tutorRuntimeIndex = v2Report.caseEntries.findIndex(
      (entry) => entry.agent === 'tutor' && entry.executionKind === 'runtime',
    );
    expect(
      PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.safeParse({
        ...v2Report,
        caseEntries: v2Report.caseEntries.map((entry, index) =>
          index === tutorRuntimeIndex
            ? {
                ...entry,
                rawSchemaValid: true,
                candidateDisposition: 'fallback_schema_invalid',
                canonicalSchemaSuccess: false,
                strictRuntimeSuccess: false,
                tutorActual: null,
                canonicalValidationStage: 'dynamic_contract',
                canonicalFailureReason: 'subject_authority_violation',
              }
            : entry,
        ),
      }).success,
    ).toBe(false);
  });
});
