import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_V6_FROZEN_DATASET_BINDING_SHA256,
  PHASE_6_9_7_V6_SOURCE_BASELINE_SHA256,
  PHASE_6_9_7_V6_SOURCE_DATASET_SHA256,
} from '../src/evals/phase-6-9-tutor-wrong-question-v6-dataset-binding.ts';
import { PHASE_6_9_7_V6_ROBUSTNESS_SHA256 } from '../src/evals/phase-6-9-tutor-wrong-question-v6-contract.ts';
import {
  buildPhase697V9EvidenceEnvelope,
  PHASE_6_9_7_V9_DIAGNOSTIC_CONTRACT_SHA256,
  PHASE_6_9_7_V9_EVAL_POLICY_SHA256,
  PHASE_6_9_7_V9_R2_ROBUSTNESS_SHA256,
  PHASE_6_9_7_V9_RUNNER_RUNTIME_CONTRACT_SHA256,
  PHASE_6_9_7_V9_SELECTION_CONTRACT_SHA256,
  PHASE_6_9_7_V9_SEMANTIC_AUTHORITY_SHA256,
  PHASE_6_9_7_V9_SOURCE_MANIFEST_SHA256,
  PHASE_6_9_7_V9_WIRE_ALIAS,
  PHASE_6_9_7_V9_WIRE_ALIAS_SHA256,
} from '../src/evals/phase-6-9-tutor-wrong-question-v9-contract.ts';
import { assertPhase697V9PathIdentity } from '../src/evals/phase-6-9-tutor-wrong-question-v9-durability-contract.ts';
import { runPhase697TutorOrganizerPairedEvalV9 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v9-paired.ts';
import { TUTOR_V6_FROZEN_MODEL_PROMPT_CONTENT_SHA256 } from '../src/model-candidates/tutor-v6-model-contract.ts';
import { TUTOR_V6_FROZEN_PREFERRED_DEPTH_RULES_SHA256 } from '../src/model-candidates/tutor-v6-preferred-depth-authority.ts';
import { WRONG_QUESTION_ORGANIZER_V6_FROZEN_CONFIDENCE_RULES_SHA256 } from '../src/model-candidates/wrong-question-organizer-v6-confidence-authority.ts';
import { WRONG_QUESTION_ORGANIZER_V6_FROZEN_MODEL_PROMPT_SHA256 } from '../src/model-candidates/wrong-question-organizer-v6-model-contract.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_FROZEN_INPUT_ESTIMATOR_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_FROZEN_MODEL_PROMPT_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_SHA256,
} from '../src/model-candidates/wrong-question-organizer-v9-model-projection.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_FROZEN_OPTION_AUTHORITY_RULES_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_SHA256,
} from '../src/model-candidates/wrong-question-organizer-v9-option-authority.ts';
import {
  hasSensitivePhase697Evidence,
  validatePhase697TutorOrganizerEvidenceValue,
  validatePhase697TutorOrganizerV2EvidenceValue,
} from '../scripts/validate-phase-6-9-7-tutor-wrong-question-evidence.ts';
import { validatePhase697TutorOrganizerV3EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v3-evidence.ts';
import { validatePhase697TutorOrganizerV4EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v4-evidence.ts';
import { validatePhase697TutorOrganizerV5EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v5-evidence.ts';
import { validatePhase697TutorOrganizerV6EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v6-evidence.ts';
import { validatePhase697TutorOrganizerV7EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v7-evidence.ts';
import { validatePhase697TutorOrganizerV8EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v8-evidence.ts';
import {
  hasPriorPhase697V9ArtifactLineage,
  validatePhase697TutorOrganizerV9EvidenceValue,
} from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v9-evidence.ts';
import { createPhase697V9SyntheticHarness } from './fixtures/phase-6-9-tutor-organizer-v9-runner.ts';
import { PHASE_6_9_7_V9_R2_FROZEN_ROBUSTNESS_SHA256 } from './fixtures/phase-6-9-tutor-wrong-question-v9-r2-provider-shapes-v1.ts';

describe('Phase 6.9.7 V9 R3 lineage isolation', () => {
  test('keeps the frozen V2 dataset and V6 semantic authority hashes unchanged', () => {
    expect(PHASE_6_9_7_V6_SOURCE_DATASET_SHA256).toBe(
      '42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b',
    );
    expect(PHASE_6_9_7_V6_SOURCE_BASELINE_SHA256).toBe(
      '0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca',
    );
    expect(PHASE_6_9_7_V6_FROZEN_DATASET_BINDING_SHA256).toBe(
      '3306cc399730f85b3281c90f226f629873d9755325415b69a0263a0f57b96153',
    );
    expect(TUTOR_V6_FROZEN_MODEL_PROMPT_CONTENT_SHA256).toBe(
      '4f73ae60e708ed9ba08bc5533cc489626543ca09e0396777ef4d725c9656a169',
    );
    expect(WRONG_QUESTION_ORGANIZER_V6_FROZEN_MODEL_PROMPT_SHA256).toBe(
      'c5f1f662ba380283aa08ffe2dc194874c9420b1c6b34ffc86107e476101f3450',
    );
    expect(TUTOR_V6_FROZEN_PREFERRED_DEPTH_RULES_SHA256).toBe(
      'b57a828e14294f712a6547be2ac168b1d58b79cdc5b9aecbb071304f4e5ae7af',
    );
    expect(WRONG_QUESTION_ORGANIZER_V6_FROZEN_CONFIDENCE_RULES_SHA256).toBe(
      'a46eda402e8c39cdc965277375e8a2aeea27e41c98cda7fd4ba513a9cb520475',
    );
    expect(PHASE_6_9_7_V6_ROBUSTNESS_SHA256).toBe(
      '314543fe1694c0caa2b8fc48fa79a1bfcd751eb0431664ffafb9ceee3103904b',
    );
    expect(PHASE_6_9_7_V9_SOURCE_MANIFEST_SHA256).toBe(
      'sha256:dfb13b9dc97b0bb2c2d80920bdbb1147467a40a53eab24098d7d376788976651',
    );
    expect(PHASE_6_9_7_V9_SELECTION_CONTRACT_SHA256).toBe(
      'sha256:85fdf2cde033e90922d62956b921b64816eaf3a41060f40d0a39cc183ff89050',
    );
    expect(PHASE_6_9_7_V9_RUNNER_RUNTIME_CONTRACT_SHA256).toBe(
      'sha256:861121455a8365662186e0a821e88ed002095da403af8061a3bb8bea651226d3',
    );
    expect(PHASE_6_9_7_V9_WIRE_ALIAS_SHA256).toBe(
      'sha256:6ff323dfa548d4ca73ba5e8bb1ed7fa0d72be2de9ee3fe57b1080c0f98991f17',
    );
    expect(PHASE_6_9_7_V9_DIAGNOSTIC_CONTRACT_SHA256).toBe(
      'sha256:8d66f5a198060b44579c80e823d686814fa5fff6a582faa78cab2059f7ebba7f',
    );
    expect(PHASE_6_9_7_V9_EVAL_POLICY_SHA256).toBe(
      'sha256:ab8ed3539f4868d773930777c89cfc66138e44c3899c6f7ae7d6e8697386d74a',
    );
    expect(PHASE_6_9_7_V9_SEMANTIC_AUTHORITY_SHA256).toBe(
      'sha256:1982561f3e01b4bd1f15f525866df2d34e124c18cd7fb20917c4e004c264f951',
    );
    expect(PHASE_6_9_7_V9_WIRE_ALIAS).toMatchObject({
      capabilityVersion: 'phase-6.9.7-v7-wire-capability-v1',
      diagnosticsVersion: 'phase-6.9.7-v7-wire-diagnostics-v1',
      newAiWireExport: false,
    });
    expect(WRONG_QUESTION_ORGANIZER_V9_FROZEN_OPTION_AUTHORITY_RULES_SHA256).toBe(
      '1013c43950c4b351e5ffa77286ec732ef522b38a4f294dd507ecac7a42c28eec',
    );
    expect(WRONG_QUESTION_ORGANIZER_V9_FROZEN_MODEL_PROMPT_SHA256).toBe(
      'ef2ff007cb55aedf5710c86a9a70e68368e24cc06afd8a09af84024f12e5586c',
    );
    expect(WRONG_QUESTION_ORGANIZER_V9_FROZEN_INPUT_ESTIMATOR_SHA256).toBe(
      '06caeb2d5b957ce122ea11db417b65c90e852e029f1fb1e2484dbffa6fbdbada',
    );
    expect(WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_SHA256).toBe(
      WRONG_QUESTION_ORGANIZER_V9_FROZEN_OPTION_AUTHORITY_RULES_SHA256,
    );
    expect(WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_SHA256).toBe(
      WRONG_QUESTION_ORGANIZER_V9_FROZEN_MODEL_PROMPT_SHA256,
    );
    expect(WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_SHA256).toBe(
      WRONG_QUESTION_ORGANIZER_V9_FROZEN_INPUT_ESTIMATOR_SHA256,
    );
    expect(PHASE_6_9_7_V9_R2_ROBUSTNESS_SHA256).toBe(PHASE_6_9_7_V9_R2_FROZEN_ROBUSTNESS_SHA256);
    assertPhase697V9PathIdentity();
  });

  test('rejects every V1-V8 artifact namespace while permitting frozen semantic-source identities', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV9(
      createPhase697V9SyntheticHarness({ runId: '00000000-0000-4000-8000-000000000741' }),
    );
    const envelope = buildPhase697V9EvidenceEnvelope({
      report,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    if (!envelope) throw new Error('V9 envelope unavailable');
    expect(validatePhase697TutorOrganizerV9EvidenceValue(envelope)).toEqual({ ok: true });
    expect(hasPriorPhase697V9ArtifactLineage(envelope)).toBe(false);

    for (let version = 1; version <= 8; version += 1) {
      const legacy = JSON.parse(JSON.stringify(envelope)) as Record<string, unknown>;
      legacy.runnerVersion = `phase-6.9.7-tutor-organizer-runner-v${version}`;
      expect(validatePhase697TutorOrganizerV9EvidenceValue(legacy)).toEqual({
        ok: false,
        code: 'prior_lineage_detected',
      });

      const artifactTokens = [
        `phase-6.9.7-tutor-organizer-runner-v${version}`,
        `phase-6.9.7-v${version}-runtime-evidence`,
        `phase-6.9.7-v${version}-live-marker`,
        `phase-6.9.7-v${version}-journal`,
        `phase-6.9.7-v${version}-evidence-envelope`,
        `phase-6.9.7-v${version}-recovery-claim`,
        `.tmp/phase-6-9-7-tutor-organizer-v${version}-branch-live.json`,
      ];
      for (const token of artifactTokens) {
        expect(hasPriorPhase697V9ArtifactLineage({ nested: [{ token }] }), token).toBe(true);
      }

      const nestedLegacy = JSON.parse(JSON.stringify(envelope)) as Record<string, unknown>;
      const firstEntry = (nestedLegacy.report as Record<string, unknown>).caseEntries as Array<
        Record<string, unknown>
      >;
      firstEntry[0]!.runtimeEvidenceVersion = `phase-6.9.7-v${version}-runtime-evidence`;
      expect(validatePhase697TutorOrganizerV9EvidenceValue(nestedLegacy)).toEqual({
        ok: false,
        code: 'prior_lineage_detected',
      });
    }
  });

  test('is rejected by all V1-V8 validators and keeps the new fixed counter allowlist narrow', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV9(
      createPhase697V9SyntheticHarness({ runId: '00000000-0000-4000-8000-000000000742' }),
    );
    const envelope = buildPhase697V9EvidenceEnvelope({
      report,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    if (!envelope) throw new Error('V9 envelope unavailable');
    const validators = [
      validatePhase697TutorOrganizerEvidenceValue,
      validatePhase697TutorOrganizerV2EvidenceValue,
      validatePhase697TutorOrganizerV3EvidenceValue,
      validatePhase697TutorOrganizerV4EvidenceValue,
      validatePhase697TutorOrganizerV5EvidenceValue,
      validatePhase697TutorOrganizerV6EvidenceValue,
      validatePhase697TutorOrganizerV7EvidenceValue,
      validatePhase697TutorOrganizerV8EvidenceValue,
    ];
    for (const validator of validators) expect(validator(envelope).ok).toBe(false);

    expect(hasSensitivePhase697Evidence({ providerResponses: 48 })).toBe(false);
    expect(hasSensitivePhase697Evidence({ providerResponseBody: 'redacted' })).toBe(true);
    expect(hasSensitivePhase697Evidence({ rawError: 'redacted' })).toBe(true);
    expect(hasSensitivePhase697Evidence({ apiKey: 'redacted' })).toBe(true);
  });
});
