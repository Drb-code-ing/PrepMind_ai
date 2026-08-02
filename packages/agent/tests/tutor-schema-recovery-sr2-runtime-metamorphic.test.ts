import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

import { phase697V2TutorCases } from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import { runTutorSchemaRecoveryModelCandidate } from '../src/model-candidates/tutor-schema-recovery-model-candidate.ts';
import { PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_HELD_OUT_INPUTS } from './fixtures/phase-6-9-tutor-schema-recovery-sr2-robustness-v1.ts';
import {
  createSr2CandidateInput,
  createSr2PromptDerivedProviderResponse,
  createSr2TrackedRuntime,
} from './tutor-schema-recovery-sr2-helpers.ts';

const FORBIDDEN = [
  'expected',
  'oracle',
  'pairedRunIndex',
  'tutor-v2-runtime-11',
  'schema-recovery-result',
  'deterministic baseline',
  'quality_gate',
  'apiKey',
] as const;

describe('Phase 6.9.7 Tutor Schema Recovery SR2 runtime and metamorphic coverage', () => {
  test('drives all 24 frozen Tutor runtime inputs, including runtime-11, through one prompt-only dispatch', async () => {
    const runtimeCases = phase697V2TutorCases.filter(
      (entry) => entry.expectedRuntimeInvocations === 1,
    );
    expect(runtimeCases).toHaveLength(24);
    expect(runtimeCases.map((entry) => entry.id)).toContain('tutor-v2-runtime-11');
    const fingerprints = new Set<string>();

    for (const entry of runtimeCases) {
      let fingerprint = '';
      const tracked = createSr2TrackedRuntime({
        fetch: async (_url, init) => {
          const derived = createSr2PromptDerivedProviderResponse(init);
          fingerprint = derived.promptFingerprint;
          return derived.response;
        },
      });
      const result = await runTutorSchemaRecoveryModelCandidate(
        createSr2CandidateInput(
          entry.input.latestUserText,
          entry.input.activeStudyContext,
          tracked.runtime,
        ),
      );

      expect(tracked.fetchCalls(), entry.id).toBe(1);
      expect(tracked.runtimeRequests, entry.id).toHaveLength(1);
      expect(result.observation.disposition, entry.id).toBe('candidate_applied');
      expect(fingerprint, entry.id).toMatch(/^sha256:[a-f0-9]{64}$/);
      fingerprints.add(fingerprint);
      const requestBody = tracked.requestBodies()[0]!;
      for (const forbidden of FORBIDDEN)
        expect(requestBody, `${entry.id}:${forbidden}`).not.toContain(forbidden);
    }

    expect(fingerprints).toHaveLength(24);
  });

  test('keeps held-out prompts independent from the frozen eval oracle and responder implementation', async () => {
    for (const heldOut of PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_HELD_OUT_INPUTS) {
      const tracked = createSr2TrackedRuntime({
        fetch: async (_url, init) => createSr2PromptDerivedProviderResponse(init).response,
      });
      const result = await runTutorSchemaRecoveryModelCandidate(
        createSr2CandidateInput(
          heldOut.latestUserText,
          heldOut.activeStudyContext,
          tracked.runtime,
        ),
      );
      expect(tracked.fetchCalls(), heldOut.id).toBe(1);
      expect(result.observation.disposition, heldOut.id).toBe('candidate_applied');
    }

    const helperSource = await readFile(
      fileURLToPath(new URL('./tutor-schema-recovery-sr2-helpers.ts', import.meta.url)),
      'utf8',
    );
    expect(helperSource).not.toContain('phase-6-9-tutor-wrong-question-v2-cases');
    for (const forbidden of FORBIDDEN) expect(helperSource).not.toContain(`'${forbidden}'`);
  });
});
