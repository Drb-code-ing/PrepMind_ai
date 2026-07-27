import { describe, expect, test } from 'bun:test';

import { buildPhase697V6EvidenceEnvelope } from '../src/evals/phase-6-9-tutor-wrong-question-v6-contract.ts';
import { runPhase697TutorOrganizerPairedEvalV6 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v6-paired.ts';
import {
  validatePhase697TutorOrganizerEvidenceValue,
  validatePhase697TutorOrganizerV2EvidenceValue,
} from '../scripts/validate-phase-6-9-7-tutor-wrong-question-evidence.ts';
import { validatePhase697TutorOrganizerV3EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v3-evidence.ts';
import { validatePhase697TutorOrganizerV4EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v4-evidence.ts';
import { validatePhase697TutorOrganizerV5EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v5-evidence.ts';
import {
  hasLegacyPhase697V6Lineage,
  validatePhase697TutorOrganizerV6EvidenceValue,
} from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v6-evidence.ts';
import { createPhase697V6SyntheticHarness } from './fixtures/phase-6-9-tutor-organizer-v6-runner.ts';

async function validEnvelope() {
  const report = await runPhase697TutorOrganizerPairedEvalV6(
    createPhase697V6SyntheticHarness({
      runId: '00000000-0000-4000-8000-000000000521',
    }),
  );
  const envelope = buildPhase697V6EvidenceEnvelope({
    report,
    disposition: 'mock_direct',
    markerSha256: null,
    journalTailSha256: null,
    journalSequence: null,
  });
  if (!envelope) throw new Error('V6 envelope invalid');
  return envelope;
}

describe('Phase 6.9.7 V6 R3 lineage isolation', () => {
  test('accepts a native V6 envelope while every historical validator rejects it', async () => {
    const envelope = await validEnvelope();
    expect(validatePhase697TutorOrganizerV6EvidenceValue(envelope)).toEqual({ ok: true });
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
    expect(validatePhase697TutorOrganizerV5EvidenceValue(envelope)).toEqual({
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
      'phase-6.9.7-tutor-organizer-runner-v5',
      'phase-6.9.7-v4-runtime-evidence-v1',
      'phase-6.9.7-v5-runtime-evidence-v1',
      'phase-6.9.7-v3-live-marker-v1',
      'phase-6.9.7-v3-journal-v1',
      'phase-6.9.7-v3-evidence-envelope-v1',
      'phase-6.9.7-v3-recovery-claim-v1',
      'phase-6.9.7-v4-live-marker-v1',
      'phase-6.9.7-v4-journal-v1',
      'phase-6.9.7-v4-evidence-envelope-v1',
      'phase-6.9.7-v4-recovery-claim-v1',
      'phase-6.9.7-v4-bounded-diagnostics-v1',
      'tutor-model-candidate-v1',
      'tutor-model-candidate-v2',
      'tutor-model-candidate-v3',
      'tutor-model-candidate-v4',
      'tutor-model-candidate-v5',
      'tutor-model-projection-v1',
      'wrong-question-organizer-model-candidate-v1',
      'wrong-question-organizer-model-candidate-v2',
      'wrong-question-organizer-model-candidate-v3',
      'wrong-question-organizer-model-candidate-v4',
      'wrong-question-organizer-model-candidate-v5',
      'wrong-question-organizer-model-projection-v1',
      'sha256:91be509194de33c8d99d7a09fa6ef387c6f31aa06d19d8fd970800731047fc6a',
      'sha256:2947cea2a7bc5d64c9daf29d8b371e9825bc0423d707ff173a2c5057ee9fdffd',
      'sha256:20ac5a1a60d9c900027eac4ad3a55cb4de341c0e1a27f319c8b086864d5e2c14',
      'sha256:972e1cca6cc53a651b7ee2eb32fa72046ea18a92fc4bd55da12ef1d699cb2364',
      'aa637d3a-f7c4-4549-a724-9cdbefdd89c8',
      'phase-6.9-tutor-wrong-question-v1',
      '7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e',
      '39a62241-0f51-45be-a423-0d13b0b60ae4',
      '67ce18dd-e2ed-4a05-8507-2a98898b8ede',
      'ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc',
      '0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f',
      '.tmp/phase-6-9-7-tutor-organizer-v5-controlled-live.marker',
    ];
    for (const token of tokens) {
      const mutant = { ...envelope, nested: { lineage: [{ token }] } };
      expect(hasLegacyPhase697V6Lineage(mutant)).toBe(true);
      expect(validatePhase697TutorOrganizerV6EvidenceValue(mutant)).toEqual({
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
      'sourceV5CaseId',
      'partialMetrics',
      'partialUsage',
      'partialCost',
      'legacyEvidence',
    ]) {
      const mutant = { ...envelope, nested: { [key]: 'bounded' } };
      expect(validatePhase697TutorOrganizerV6EvidenceValue(mutant)).toEqual({
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
    expect(validatePhase697TutorOrganizerV6EvidenceValue(hostile)).toEqual({
      ok: false,
      code: 'legacy_lineage_detected',
    });
    expect(getterReads).toBe(0);
  });

  test('fails closed on cyclic and symbol-keyed lineage containers', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(hasLegacyPhase697V6Lineage(cyclic)).toBe(true);
    const symbolKeyed = { [Symbol('legacy')]: 'phase-6.9.7-tutor-organizer-runner-v4' };
    expect(hasLegacyPhase697V6Lineage(symbolKeyed)).toBe(true);
  });
});
