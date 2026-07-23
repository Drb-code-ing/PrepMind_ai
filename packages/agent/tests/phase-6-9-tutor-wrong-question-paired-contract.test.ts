import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA,
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
});
