import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_V7_APPROVAL_ENV,
  PHASE_6_9_7_V7_CONFIRMATION,
  PHASE_6_9_7_V7_MARKER_PATH,
} from '../src/evals/phase-6-9-tutor-wrong-question-v7-contract.ts';
import {
  executePhase697TutorOrganizerV7Cli,
  parsePhase697TutorOrganizerV7Cli,
  sealPhase697TutorOrganizerV7Orphan,
} from '../scripts/phase-6-9-7-tutor-wrong-question-v7-cli.ts';
import { validatePhase697TutorOrganizerV7EvidenceBundle } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v7-evidence.ts';
import { createPhase697V7SyntheticHarness } from './fixtures/phase-6-9-tutor-organizer-v7-runner.ts';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.7 V7 R2 CLI authorization and recovery-only boundary', () => {
  test('requires the exact Live authorization and never evaluates hostile accessors', () => {
    expect(parsePhase697TutorOrganizerV7Cli({ argv: ['live'], env: {} })).toEqual({
      ok: false,
      code: 'live_authorization_required',
    });
    expect(
      parsePhase697TutorOrganizerV7Cli({
        argv: ['live', PHASE_6_9_7_V7_CONFIRMATION],
        env: { [PHASE_6_9_7_V7_APPROVAL_ENV]: 'true' },
      }),
    ).toEqual({ ok: true, mode: 'live', runScope: 'branch' });
    expect(parsePhase697TutorOrganizerV7Cli({ argv: ['seal'], env: {} })).toEqual({
      ok: true,
      mode: 'seal',
    });

    const hostile = Object.create(null) as Record<string, string | undefined>;
    let reads = 0;
    Object.defineProperty(hostile, PHASE_6_9_7_V7_APPROVAL_ENV, {
      enumerable: true,
      get() {
        reads += 1;
        return 'true';
      },
    });
    expect(
      parsePhase697TutorOrganizerV7Cli({
        argv: ['live', PHASE_6_9_7_V7_CONFIRMATION],
        env: hostile,
      }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
    expect(reads).toBe(0);
  });

  test('rejects incomplete Live configuration and unavailable default Mock before marker creation', async () => {
    const root = await temporaryRoot();
    expect(
      await executePhase697TutorOrganizerV7Cli({
        argv: ['live', PHASE_6_9_7_V7_CONFIRMATION],
        env: {
          [PHASE_6_9_7_V7_APPROVAL_ENV]: 'true',
          DEEPSEEK_API_KEY: 'generic-key-must-not-be-borrowed',
        },
        repositoryRoot: root,
      }),
    ).toEqual({ ok: false, code: 'live_configuration_invalid' });
    expect(
      await executePhase697TutorOrganizerV7Cli({
        argv: ['mock'],
        env: {},
        repositoryRoot: root,
      }),
    ).toEqual({ ok: false, code: 'mock_harness_unavailable' });
    expect(await Bun.file(resolve(root, PHASE_6_9_7_V7_MARKER_PATH)).exists()).toBe(false);
  });

  test('publishes injected synthetic Mock evidence without consuming Live state', async () => {
    const root = await temporaryRoot();
    const result = await executePhase697TutorOrganizerV7Cli({
      argv: ['mock'],
      env: {},
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000731',
      harnessFactory: ({ mode, runId, runScope }) =>
        createPhase697V7SyntheticHarness({ mode, runId, runScope }),
    });
    expect(result).toMatchObject({
      ok: true,
      gate: 'mock_quality_not_evidence',
      disposition: 'mock_direct',
      wire: {
        executorInvocations: 48,
        providerDispatches: 48,
        providerResponses: 48,
        verifiedUsages: 48,
      },
    });
    if (!result.ok) throw new Error('V7 synthetic Mock CLI failed');
    expect(await Bun.file(resolve(root, PHASE_6_9_7_V7_MARKER_PATH)).exists()).toBe(false);
    expect(
      await validatePhase697TutorOrganizerV7EvidenceBundle({
        root,
        evidencePath: resolve(root, result.evidencePath),
      }),
    ).toEqual({ ok: true });
    const unrelatedRoot = await temporaryRoot();
    expect(
      await validatePhase697TutorOrganizerV7EvidenceBundle({
        root: unrelatedRoot,
        evidencePath: resolve(root, result.evidencePath),
      }),
    ).toEqual({ ok: false, code: 'evidence_filename_invalid' });
  });

  test('consumes the marker but never enters a harness whose executor provenance drifts', async () => {
    const root = await temporaryRoot();
    let delegateCalls = 0;
    const result = await executePhase697TutorOrganizerV7Cli({
      argv: ['live', PHASE_6_9_7_V7_CONFIRMATION],
      env: authorizedSyntheticLiveEnv(),
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000734',
      harnessFactory: ({ mode, runId, runScope }) => {
        const harness = createPhase697V7SyntheticHarness({
          mode,
          runId,
          runScope,
          onDelegate() {
            delegateCalls += 1;
          },
        });
        return Object.freeze({
          ...harness,
          executorProvenance: 'first_party_deepseek_v4_pro_direct' as const,
        });
      },
    });
    expect(result).toEqual({ ok: false, code: 'runtime_factory_identity_invalid' });
    expect(delegateCalls).toBe(0);
    expect(await Bun.file(resolve(root, PHASE_6_9_7_V7_MARKER_PATH)).exists()).toBe(true);
  });

  test('fsyncs marker and initial journal before a synthetic Live factory and blocks replay', async () => {
    const root = await temporaryRoot();
    let markerExistedAtFactory = false;
    const result = await executePhase697TutorOrganizerV7Cli({
      argv: ['live', PHASE_6_9_7_V7_CONFIRMATION],
      env: authorizedSyntheticLiveEnv(),
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000732',
      harnessFactory: async ({ mode, runId, runScope }) => {
        markerExistedAtFactory = await Bun.file(resolve(root, PHASE_6_9_7_V7_MARKER_PATH)).exists();
        return createPhase697V7SyntheticHarness({ mode, runId, runScope });
      },
    });
    expect(markerExistedAtFactory).toBe(true);
    expect(result).toMatchObject({
      ok: true,
      gate: 'quality_gate_failed',
      disposition: 'completed_run',
    });
    if (!result.ok) throw new Error('V7 synthetic Live CLI failed');
    expect(
      await validatePhase697TutorOrganizerV7EvidenceBundle({
        root,
        evidencePath: resolve(root, result.evidencePath),
      }),
    ).toEqual({ ok: true });
    const absoluteEvidencePath = resolve(root, result.evidencePath);
    const originalEvidenceBytes = await Bun.file(absoluteEvidencePath).text();
    for (const field of ['markerSha256', 'journalTailSha256', 'journalSequence'] as const) {
      const tampered = JSON.parse(originalEvidenceBytes) as Record<string, unknown>;
      const durability = tampered.durability as Record<string, unknown>;
      durability[field] =
        field === 'journalSequence' ? Number(durability[field]) + 1 : `sha256:${'0'.repeat(64)}`;
      await Bun.write(absoluteEvidencePath, `${JSON.stringify(tampered, null, 2)}\n`);
      expect(
        await validatePhase697TutorOrganizerV7EvidenceBundle({
          root,
          evidencePath: absoluteEvidencePath,
        }),
        field,
      ).toEqual({ ok: false, code: 'durability_identity_invalid' });
    }
    await Bun.write(absoluteEvidencePath, originalEvidenceBytes);
    expect(
      await executePhase697TutorOrganizerV7Cli({
        argv: ['live', PHASE_6_9_7_V7_CONFIRMATION],
        env: authorizedSyntheticLiveEnv(),
        repositoryRoot: root,
        harnessFactory: ({ mode, runId, runScope }) =>
          createPhase697V7SyntheticHarness({ mode, runId, runScope }),
      }),
    ).toEqual({ ok: false, code: 'live_already_attempted' });
  });

  test('consumes a crashed attempt and permits only zero-provider recovery sealing after owner death', async () => {
    const root = await temporaryRoot();
    const result = await executePhase697TutorOrganizerV7Cli({
      argv: ['live', PHASE_6_9_7_V7_CONFIRMATION],
      env: authorizedSyntheticLiveEnv(),
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000733',
      harnessFactory() {
        throw new Error('synthetic factory crash');
      },
    });
    expect(result).toEqual({ ok: false, code: 'execution_failed' });
    expect(await sealPhase697TutorOrganizerV7Orphan({ root, processAlive: () => true })).toEqual({
      ok: false,
      code: 'live_attempt_in_progress',
    });
    const sealed = await sealPhase697TutorOrganizerV7Orphan({
      root,
      processAlive: () => false,
    });
    expect(sealed).toMatchObject({
      ok: true,
      gate: 'quality_gate_failed',
      disposition: 'orphan_sealed',
      wire: {
        executorInvocations: 0,
        providerDispatches: 0,
        providerResponses: 0,
        verifiedUsages: 0,
      },
    });
    expect(await sealPhase697TutorOrganizerV7Orphan({ root })).toEqual(sealed);
  });
});

function authorizedSyntheticLiveEnv() {
  return {
    [PHASE_6_9_7_V7_APPROVAL_ENV]: 'true',
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: 'true',
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    TUTOR_AGENT_MODEL_ENABLED: 'true',
    TUTOR_AGENT_MODEL_TIMEOUT_MS: '3500',
    TUTOR_AGENT_DEEPSEEK_API_KEY: 'synthetic-tutor-component-key',
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: 'true',
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: '5000',
    WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: 'synthetic-organizer-component-key',
  };
}

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-v7-r2-cli-'));
  roots.push(root);
  return root;
}
