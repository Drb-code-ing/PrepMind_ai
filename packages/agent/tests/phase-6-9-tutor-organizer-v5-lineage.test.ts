import { describe, expect, test } from 'bun:test';

import { buildPhase697V5EvidenceEnvelope } from '../src/evals/phase-6-9-tutor-wrong-question-v5-contract.ts';
import { runPhase697TutorOrganizerPairedEvalV5 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v5-paired.ts';
import {
  validatePhase697TutorOrganizerEvidenceValue,
  validatePhase697TutorOrganizerV2EvidenceValue,
} from '../scripts/validate-phase-6-9-7-tutor-wrong-question-evidence.ts';
import { validatePhase697TutorOrganizerV3EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v3-evidence.ts';
import { validatePhase697TutorOrganizerV4EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v4-evidence.ts';
import {
  hasLegacyPhase697V5Lineage,
  validatePhase697TutorOrganizerV5EvidenceValue,
} from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v5-evidence.ts';
import { createPhase697V5SyntheticHarness } from './fixtures/phase-6-9-tutor-organizer-v5-runner.ts';

async function validEnvelope() {
  const report = await runPhase697TutorOrganizerPairedEvalV5(
    createPhase697V5SyntheticHarness({
      runId: '00000000-0000-4000-8000-000000000521',
    }),
  );
  const envelope = buildPhase697V5EvidenceEnvelope({
    report,
    disposition: 'mock_direct',
    markerSha256: null,
    journalTailSha256: null,
    journalSequence: null,
  });
  if (!envelope) throw new Error('V5 envelope invalid');
  return envelope;
}

describe('Phase 6.9.7 V5 R4 lineage isolation', () => {
  test('accepts a native V5 envelope while every historical validator rejects it', async () => {
    const envelope = await validEnvelope();
    expect(validatePhase697TutorOrganizerV5EvidenceValue(envelope)).toEqual({ ok: true });
    expect(validatePhase697TutorOrganizerEvidenceValue(envelope)).toEqual({
      ok: false,
      code: 'report_contract_invalid',
    });
    expect(validatePhase697TutorOrganizerV2EvidenceValue(envelope)).toEqual({
      ok: false,
      code: 'report_contract_invalid',
    });
    expect(validatePhase697TutorOrganizerV3EvidenceValue(envelope)).toEqual({
      ok: false,
      code: 'report_contract_invalid',
    });
    expect(validatePhase697TutorOrganizerV4EvidenceValue(envelope)).toEqual({
      ok: false,
      code: 'report_contract_invalid',
    });
  });

  test('recursively rejects every legacy runner, dataset, run and artifact identity', async () => {
    const envelope = await validEnvelope();
    const tokens = [
      'phase-6.9.7-tutor-organizer-runner-v1',
      'phase-6.9.7-tutor-organizer-runner-v2',
      'phase-6.9.7-tutor-organizer-runner-v3',
      'phase-6.9.7-tutor-organizer-runner-v4',
      'phase-6.9.7-v4-runtime-evidence-v1',
      'phase-6.9-tutor-wrong-question-v1',
      '7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e',
      '39a62241-0f51-45be-a423-0d13b0b60ae4',
      '67ce18dd-e2ed-4a05-8507-2a98898b8ede',
      'ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc',
      '0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f',
      '.tmp/phase-6-9-7-tutor-organizer-v3-controlled-live.marker',
    ];
    for (const token of tokens) {
      const mutant = { ...envelope, nested: { lineage: [{ token }] } };
      expect(hasLegacyPhase697V5Lineage(mutant)).toBe(true);
      expect(validatePhase697TutorOrganizerV5EvidenceValue(mutant)).toEqual({
        ok: false,
        code: 'legacy_lineage_detected',
      });
    }
  });

  test('rejects partial/source keys before schema parsing and never executes accessors', async () => {
    const envelope = await validEnvelope();
    for (const key of [
      'sourceV1CaseId',
      'sourceV2TerminalEntrySha256',
      'partialMetrics',
      'partialUsage',
      'partialCost',
      'legacyEvidence',
    ]) {
      const mutant = { ...envelope, nested: { [key]: 'bounded' } };
      expect(validatePhase697TutorOrganizerV5EvidenceValue(mutant)).toEqual({
        ok: false,
        code: 'legacy_lineage_detected',
      });
    }

    let getterReads = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, 'report', {
      enumerable: true,
      get() {
        getterReads += 1;
        return envelope.report;
      },
    });
    expect(validatePhase697TutorOrganizerV5EvidenceValue(hostile)).toEqual({
      ok: false,
      code: 'legacy_lineage_detected',
    });
    expect(getterReads).toBe(0);
  });

  test('fails closed on cyclic and symbol-keyed lineage containers', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(hasLegacyPhase697V5Lineage(cyclic)).toBe(true);
    const symbolKeyed = { [Symbol('legacy')]: 'phase-6.9.7-tutor-organizer-runner-v4' };
    expect(hasLegacyPhase697V5Lineage(symbolKeyed)).toBe(true);
  });
});
