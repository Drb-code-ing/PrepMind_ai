import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_V9_APPROVAL_ENV,
  PHASE_6_9_7_V9_CONFIRMATION,
  PHASE_6_9_7_V9_MARKER_PATH,
} from '../src/evals/phase-6-9-tutor-wrong-question-v9-contract.ts';
import {
  phase697V9EvidencePath,
  phase697V9JournalPath,
} from '../src/evals/phase-6-9-tutor-wrong-question-v9-durability-contract.ts';
import {
  executePhase697TutorOrganizerV9Cli,
  parsePhase697TutorOrganizerV9Cli,
  sealPhase697TutorOrganizerV9Orphan,
} from '../scripts/phase-6-9-7-tutor-wrong-question-v9-cli.ts';
import { validatePhase697TutorOrganizerV9EvidenceBundle } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v9-evidence.ts';
import { createPhase697V9SyntheticHarness } from './fixtures/phase-6-9-tutor-organizer-v9-runner.ts';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.7 V9 CLI authorization and recovery-only boundary', () => {
  test('requires the exact Live authorization and never evaluates hostile accessors', () => {
    expect(parsePhase697TutorOrganizerV9Cli({ argv: ['live'], env: {} })).toEqual({
      ok: false,
      code: 'live_authorization_required',
    });
    expect(
      parsePhase697TutorOrganizerV9Cli({
        argv: ['live', PHASE_6_9_7_V9_CONFIRMATION],
        env: { [PHASE_6_9_7_V9_APPROVAL_ENV]: 'true' },
      }),
    ).toEqual({ ok: true, mode: 'live', runScope: 'branch' });
    expect(parsePhase697TutorOrganizerV9Cli({ argv: ['seal'], env: {} })).toEqual({
      ok: true,
      mode: 'seal',
    });

    const hostile = Object.create(null) as Record<string, string | undefined>;
    let reads = 0;
    Object.defineProperty(hostile, PHASE_6_9_7_V9_APPROVAL_ENV, {
      enumerable: true,
      get() {
        reads += 1;
        return 'true';
      },
    });
    expect(
      parsePhase697TutorOrganizerV9Cli({
        argv: ['live', PHASE_6_9_7_V9_CONFIRMATION],
        env: hostile,
      }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
    expect(reads).toBe(0);
  });

  test('publishes reviewed default Mock evidence without consuming Live state', async () => {
    const root = await temporaryRoot();
    const runId = '00000000-0000-4000-8000-000000000730';
    expect(
      await executePhase697TutorOrganizerV9Cli({
        argv: ['live', PHASE_6_9_7_V9_CONFIRMATION],
        env: {
          [PHASE_6_9_7_V9_APPROVAL_ENV]: 'true',
          DEEPSEEK_API_KEY: 'generic-key-must-not-be-borrowed',
        },
        repositoryRoot: root,
      }),
    ).toEqual({ ok: false, code: 'live_configuration_invalid' });
    const mock = await executePhase697TutorOrganizerV9Cli({
      argv: ['mock'],
      env: {},
      repositoryRoot: root,
      runId,
    });
    expect(mock).toMatchObject({
      ok: true,
      gate: 'mock_quality_not_evidence',
      disposition: 'mock_direct',
      counts: {
        cases: 72,
        zeroCallCases: 24,
        runtimeCases: 48,
        pairedRequests: 24,
        organizerDecisionUnits: 32,
      },
      scheduler: {
        guardPhasePassed: true,
        breakerState: 'closed',
        dispatchedPairs: 24,
        completedPairs: 24,
      },
      wire: {
        complete: true,
        executorInvocations: 48,
        providerDispatches: 48,
        providerResponses: 48,
        verifiedUsages: 48,
      },
    });
    expect(await Bun.file(resolve(root, PHASE_6_9_7_V9_MARKER_PATH)).exists()).toBe(false);
    if (!mock.ok) throw new Error('V9 reviewed Mock CLI failed');
    const evidencePath = resolve(root, mock.evidencePath);
    expect(mock.evidencePath).toBe(
      phase697V9EvidencePath({ runId, runScope: 'branch', mode: 'mock' }),
    );
    expect(
      await validatePhase697TutorOrganizerV9EvidenceBundle({
        root,
        evidencePath,
      }),
    ).toEqual({ ok: true });
    await rm(evidencePath);
    expect(await Bun.file(evidencePath).exists()).toBe(false);
    expect(await Bun.file(resolve(root, phase697V9JournalPath(runId))).exists()).toBe(false);
  });

  test('rejects invalid Live composition before marker reservation or harness creation', async () => {
    const root = await temporaryRoot();
    const runId = '00000000-0000-4000-8000-000000000735';
    let harnessFactoryCalls = 0;
    for (const override of [
      { TUTOR_AGENT_DEEPSEEK_API_KEY: undefined },
      { WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: undefined },
      { AI_BASE_URL: 'https://example.invalid/v1' },
      { TUTOR_AGENT_MODEL_TIMEOUT_MS: '3499' },
      { WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: '5001' },
      { ROUTER_MODEL_ENABLED: 'true' },
    ]) {
      const result = await executePhase697TutorOrganizerV9Cli({
        argv: ['live', PHASE_6_9_7_V9_CONFIRMATION],
        env: { ...authorizedSyntheticLiveEnv(), ...override },
        repositoryRoot: root,
        runId,
        harnessFactory: ({ mode, runId, runScope }) => {
          harnessFactoryCalls += 1;
          return createPhase697V9SyntheticHarness({ mode, runId, runScope });
        },
      });
      expect(result).toEqual({ ok: false, code: 'live_configuration_invalid' });
      expect(await Bun.file(resolve(root, PHASE_6_9_7_V9_MARKER_PATH)).exists()).toBe(false);
      expect(await Bun.file(resolve(root, phase697V9JournalPath(runId))).exists()).toBe(false);
    }
    expect(harnessFactoryCalls).toBe(0);
  });

  test('publishes injected synthetic Mock evidence without consuming Live state', async () => {
    const root = await temporaryRoot();
    const result = await executePhase697TutorOrganizerV9Cli({
      argv: ['mock'],
      env: {},
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000731',
      harnessFactory: ({ mode, runId, runScope }) =>
        createPhase697V9SyntheticHarness({ mode, runId, runScope }),
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
    if (!result.ok) throw new Error('V9 synthetic Mock CLI failed');
    expect(await Bun.file(resolve(root, PHASE_6_9_7_V9_MARKER_PATH)).exists()).toBe(false);
    expect(
      await validatePhase697TutorOrganizerV9EvidenceBundle({
        root,
        evidencePath: resolve(root, result.evidencePath),
      }),
    ).toEqual({ ok: true });
    const unrelatedRoot = await temporaryRoot();
    expect(
      await validatePhase697TutorOrganizerV9EvidenceBundle({
        root: unrelatedRoot,
        evidencePath: resolve(root, result.evidencePath),
      }),
    ).toEqual({ ok: false, code: 'evidence_filename_invalid' });
  });

  test('consumes the marker but never enters a harness whose executor provenance drifts', async () => {
    const root = await temporaryRoot();
    let delegateCalls = 0;
    const result = await executePhase697TutorOrganizerV9Cli({
      argv: ['live', PHASE_6_9_7_V9_CONFIRMATION],
      env: authorizedSyntheticLiveEnv(),
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000734',
      harnessFactory: ({ mode, runId, runScope }) => {
        const harness = createPhase697V9SyntheticHarness({
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
    expect(await Bun.file(resolve(root, PHASE_6_9_7_V9_MARKER_PATH)).exists()).toBe(true);
  });

  test('fsyncs marker and initial journal before a synthetic Live factory and blocks replay', async () => {
    const root = await temporaryRoot();
    let markerExistedAtFactory = false;
    const result = await executePhase697TutorOrganizerV9Cli({
      argv: ['live', PHASE_6_9_7_V9_CONFIRMATION],
      env: authorizedSyntheticLiveEnv(),
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000732',
      harnessFactory: async ({ mode, runId, runScope }) => {
        markerExistedAtFactory = await Bun.file(resolve(root, PHASE_6_9_7_V9_MARKER_PATH)).exists();
        return createPhase697V9SyntheticHarness({ mode, runId, runScope });
      },
    });
    expect(markerExistedAtFactory).toBe(true);
    expect(result).toMatchObject({
      ok: true,
      gate: 'quality_gate_failed',
      disposition: 'completed_run',
    });
    if (!result.ok) throw new Error('V9 synthetic Live CLI failed');
    const marker = JSON.parse(
      await Bun.file(resolve(root, PHASE_6_9_7_V9_MARKER_PATH)).text(),
    ) as Record<string, unknown>;
    const evidence = JSON.parse(await Bun.file(resolve(root, result.evidencePath)).text()) as {
      report?: Record<string, unknown>;
    };
    expect(marker.executorProvenance).toBe('synthetic_test');
    expect(evidence.report?.executorProvenance).toBe('synthetic_test');
    expect(evidence.report?.gate).toBe('quality_gate_failed');
    expect(
      await validatePhase697TutorOrganizerV9EvidenceBundle({
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
        await validatePhase697TutorOrganizerV9EvidenceBundle({
          root,
          evidencePath: absoluteEvidencePath,
        }),
        field,
      ).toEqual({ ok: false, code: 'durability_identity_invalid' });
    }
    await Bun.write(absoluteEvidencePath, originalEvidenceBytes);
    expect(
      await executePhase697TutorOrganizerV9Cli({
        argv: ['live', PHASE_6_9_7_V9_CONFIRMATION],
        env: authorizedSyntheticLiveEnv(),
        repositoryRoot: root,
        harnessFactory: ({ mode, runId, runScope }) =>
          createPhase697V9SyntheticHarness({ mode, runId, runScope }),
      }),
    ).toEqual({ ok: false, code: 'live_already_attempted' });
  });

  test('consumes a crashed attempt and permits only zero-provider recovery sealing after owner death', async () => {
    const root = await temporaryRoot();
    const result = await executePhase697TutorOrganizerV9Cli({
      argv: ['live', PHASE_6_9_7_V9_CONFIRMATION],
      env: authorizedSyntheticLiveEnv(),
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000733',
      harnessFactory() {
        throw new Error('synthetic factory crash');
      },
    });
    expect(result).toEqual({ ok: false, code: 'execution_failed' });
    expect(await sealPhase697TutorOrganizerV9Orphan({ root, processAlive: () => true })).toEqual({
      ok: false,
      code: 'live_attempt_in_progress',
    });
    const sealed = await sealPhase697TutorOrganizerV9Orphan({
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
    expect(await sealPhase697TutorOrganizerV9Orphan({ root })).toEqual(sealed);
  });
});

function authorizedSyntheticLiveEnv() {
  return {
    [PHASE_6_9_7_V9_APPROVAL_ENV]: 'true',
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
  const root = await mkdtemp(join(tmpdir(), 'prepmind-v9-r4-cli-'));
  roots.push(root);
  return root;
}
