import { appendFile, mkdtemp, open as fsOpen, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_V5_APPROVAL_ENV,
  PHASE_6_9_7_V5_CONFIRMATION,
  PHASE_6_9_7_V5_MARKER_PATH,
  sha256Phase697V5Stable,
} from '../src/evals/phase-6-9-tutor-wrong-question-v5-contract.ts';
import {
  buildPhase697V5JournalRecord,
  phase697V5JournalPath,
  projectPhase697V5TerminalEntry,
  stableJsonStringify,
} from '../src/evals/phase-6-9-tutor-wrong-question-v5-durability-contract.ts';
import { runPhase697TutorOrganizerPairedEvalV5 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v5-paired.ts';
import {
  executePhase697TutorOrganizerV5Cli,
  parsePhase697TutorOrganizerV5Cli,
  sealPhase697TutorOrganizerV5Orphan,
} from '../scripts/phase-6-9-7-tutor-wrong-question-v5-cli.ts';
import { readPhase697V5Journal } from '../scripts/phase-6-9-7-tutor-wrong-question-v5-durability.ts';
import { validatePhase697TutorOrganizerV5EvidenceBundle } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v5-evidence.ts';
import { createPhase697V5SyntheticHarness } from './fixtures/phase-6-9-tutor-organizer-v5-runner.ts';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-v5-r4-cli-'));
  roots.push(root);
  return root;
}

function authorizedLiveEnv(overrides?: Readonly<Record<string, string | undefined>>) {
  return {
    [PHASE_6_9_7_V5_APPROVAL_ENV]: 'true',
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: 'true',
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    TUTOR_AGENT_MODEL_ENABLED: 'true',
    TUTOR_AGENT_MODEL_TIMEOUT_MS: '3000',
    TUTOR_AGENT_DEEPSEEK_API_KEY: 'synthetic-tutor-component-key',
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: 'true',
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: '5000',
    WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: 'synthetic-organizer-component-key',
    ...overrides,
  };
}

describe('Phase 6.9.7 V5 R6 CLI', () => {
  test('requires exact one-time authorization and rejects hostile environment accessors', () => {
    expect(parsePhase697TutorOrganizerV5Cli({ argv: ['live'], env: {} })).toEqual({
      ok: false,
      code: 'live_authorization_required',
    });
    expect(
      parsePhase697TutorOrganizerV5Cli({
        argv: ['live', PHASE_6_9_7_V5_CONFIRMATION],
        env: { [PHASE_6_9_7_V5_APPROVAL_ENV]: 'true' },
      }),
    ).toEqual({ ok: true, mode: 'live', runScope: 'branch' });
    const hostile = Object.create(null) as Record<string, string | undefined>;
    let reads = 0;
    Object.defineProperty(hostile, PHASE_6_9_7_V5_APPROVAL_ENV, {
      enumerable: true,
      get() {
        reads += 1;
        return 'true';
      },
    });
    expect(
      parsePhase697TutorOrganizerV5Cli({
        argv: ['live', PHASE_6_9_7_V5_CONFIRMATION],
        env: hostile,
      }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
    expect(reads).toBe(0);
  });

  test('rejects incomplete Live configuration before reserving a marker', async () => {
    const root = await temporaryRoot();
    const result = await executePhase697TutorOrganizerV5Cli({
      argv: ['live', PHASE_6_9_7_V5_CONFIRMATION],
      env: {
        [PHASE_6_9_7_V5_APPROVAL_ENV]: 'true',
        DEEPSEEK_API_KEY: 'generic-key-must-not-be-borrowed',
      },
      repositoryRoot: root,
    });
    expect(result).toEqual({ ok: false, code: 'live_configuration_invalid' });
    expect(await Bun.file(resolve(root, PHASE_6_9_7_V5_MARKER_PATH)).exists()).toBe(false);
  });

  test('publishes isolated Mock evidence without creating a Live marker', async () => {
    const root = await temporaryRoot();
    const result = await executePhase697TutorOrganizerV5Cli({
      argv: ['mock'],
      env: {},
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000531',
      harnessFactory: ({ mode, runId, runScope }) =>
        createPhase697V5SyntheticHarness({ mode, runId, runScope }),
    });
    expect(result).toMatchObject({
      ok: true,
      gate: 'mock_quality_not_evidence',
      disposition: 'mock_direct',
    });
    if (!result.ok) throw new Error('mock CLI failed');
    expect(await Bun.file(resolve(root, PHASE_6_9_7_V5_MARKER_PATH)).exists()).toBe(false);
    expect(
      await validatePhase697TutorOrganizerV5EvidenceBundle({
        root,
        evidencePath: resolve(root, result.evidencePath),
      }),
    ).toEqual({ ok: true });
  });

  test('fsyncs marker and journal before invoking a synthetic Live factory', async () => {
    const root = await temporaryRoot();
    let markerExistedAtFactory = false;
    const result = await executePhase697TutorOrganizerV5Cli({
      argv: ['live', PHASE_6_9_7_V5_CONFIRMATION],
      env: authorizedLiveEnv(),
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000532',
      harnessFactory: async ({ mode, runId, runScope }) => {
        markerExistedAtFactory = await Bun.file(resolve(root, PHASE_6_9_7_V5_MARKER_PATH)).exists();
        return createPhase697V5SyntheticHarness({ mode, runId, runScope });
      },
    });
    expect(markerExistedAtFactory).toBe(true);
    expect(result).toMatchObject({
      ok: true,
      gate: 'quality_gate_failed',
      disposition: 'completed_run',
    });
    if (!result.ok) throw new Error('live synthetic CLI failed');
    expect(
      await validatePhase697TutorOrganizerV5EvidenceBundle({
        root,
        evidencePath: resolve(root, result.evidencePath),
      }),
    ).toEqual({ ok: true });
    const replay = await executePhase697TutorOrganizerV5Cli({
      argv: ['live', PHASE_6_9_7_V5_CONFIRMATION],
      env: authorizedLiveEnv(),
      repositoryRoot: root,
      harnessFactory: ({ mode, runId, runScope }) =>
        createPhase697V5SyntheticHarness({ mode, runId, runScope }),
    });
    expect(replay).toEqual({ ok: false, code: 'live_already_attempted' });
  });

  test('fails closed when an injected Live harness disagrees with marker provenance', async () => {
    const root = await temporaryRoot();
    const result = await executePhase697TutorOrganizerV5Cli({
      argv: ['live', PHASE_6_9_7_V5_CONFIRMATION],
      env: authorizedLiveEnv(),
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000538',
      harnessFactory: ({ mode, runId, runScope }) => ({
        ...createPhase697V5SyntheticHarness({ mode, runId, runScope }),
        executorProvenance: 'deepseek_network',
      }),
    });
    expect(result).toEqual({ ok: false, code: 'runtime_factory_identity_invalid' });
    expect(await Bun.file(resolve(root, PHASE_6_9_7_V5_MARKER_PATH)).exists()).toBe(true);
  });

  test('rejects evidence whose report provenance drifts from the durable marker', async () => {
    const root = await temporaryRoot();
    const result = await executePhase697TutorOrganizerV5Cli({
      argv: ['live', PHASE_6_9_7_V5_CONFIRMATION],
      env: authorizedLiveEnv(),
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000539',
      harnessFactory: ({ mode, runId, runScope }) =>
        createPhase697V5SyntheticHarness({ mode, runId, runScope }),
    });
    if (!result.ok) throw new Error('synthetic provenance fixture failed');
    const evidencePath = resolve(root, result.evidencePath);
    const envelope = JSON.parse(await Bun.file(evidencePath).text()) as {
      reportSha256: string;
      report: { executorProvenance: string; gate: string };
    };
    envelope.report.executorProvenance = 'deepseek_network';
    envelope.report.gate = 'quality_gate_passed';
    envelope.reportSha256 = sha256Phase697V5Stable(envelope.report);
    await writeFile(evidencePath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
    expect(await validatePhase697TutorOrganizerV5EvidenceBundle({ root, evidencePath })).toEqual({
      ok: false,
      code: 'durability_identity_invalid',
    });
  });

  test('consumes the marker when the injected factory crashes and seals only after owner death', async () => {
    const root = await temporaryRoot();
    const result = await executePhase697TutorOrganizerV5Cli({
      argv: ['live', PHASE_6_9_7_V5_CONFIRMATION],
      env: authorizedLiveEnv(),
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000533',
      harnessFactory() {
        throw new Error('synthetic factory crash');
      },
    });
    expect(result).toEqual({ ok: false, code: 'execution_failed' });
    expect(await sealPhase697TutorOrganizerV5Orphan({ root, processAlive: () => true })).toEqual({
      ok: false,
      code: 'live_attempt_in_progress',
    });
    const sealed = await sealPhase697TutorOrganizerV5Orphan({
      root,
      processAlive: () => false,
    });
    expect(sealed).toMatchObject({
      ok: true,
      gate: 'quality_gate_failed',
      disposition: 'orphan_sealed',
    });
    const secondSeal = await sealPhase697TutorOrganizerV5Orphan({
      root,
      processAlive: () => false,
    });
    expect(secondSeal).toEqual(sealed);
  });

  test('keeps the one-shot marker after evidence publication failure and recovers without replay', async () => {
    const root = await temporaryRoot();
    const runId = '00000000-0000-4000-8000-000000000534';
    const result = await executePhase697TutorOrganizerV5Cli({
      argv: ['live', PHASE_6_9_7_V5_CONFIRMATION],
      env: authorizedLiveEnv(),
      repositoryRoot: root,
      runId,
      harnessFactory: ({ mode, runId: harnessRunId, runScope }) =>
        createPhase697V5SyntheticHarness({ mode, runId: harnessRunId, runScope }),
      durabilityOverrides: {
        async link() {
          const error = new Error('synthetic evidence link failure') as Error & { code: string };
          error.code = 'EIO';
          throw error;
        },
      },
    });
    expect(result).toEqual({ ok: false, code: 'evidence_io_failed' });
    expect(
      await executePhase697TutorOrganizerV5Cli({
        argv: ['live', PHASE_6_9_7_V5_CONFIRMATION],
        env: authorizedLiveEnv(),
        repositoryRoot: root,
        harnessFactory: ({ mode, runId: harnessRunId, runScope }) =>
          createPhase697V5SyntheticHarness({ mode, runId: harnessRunId, runScope }),
      }),
    ).toEqual({ ok: false, code: 'live_already_attempted' });
    expect(
      await sealPhase697TutorOrganizerV5Orphan({ root, processAlive: () => false }),
    ).toMatchObject({ ok: true, disposition: 'completed_run' });
  });

  test('keeps published evidence recoverable when the final journal terminal fsync fails', async () => {
    const root = await temporaryRoot();
    const failingOpen = (async (path: string, flags: string, mode?: number) => {
      const handle = await fsOpen(path, flags as 'a', mode);
      const originalWriteFile = handle.writeFile.bind(handle);
      return new Proxy(handle, {
        get(target, property) {
          if (property === 'writeFile') {
            return async (data: string | Uint8Array) => {
              if (String(data).includes('"kind":"evidence_sealed"')) {
                throw new Error('synthetic terminal append failure');
              }
              return originalWriteFile(data);
            };
          }
          const value = Reflect.get(target, property, target) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    }) as unknown as typeof fsOpen;
    const result = await executePhase697TutorOrganizerV5Cli({
      argv: ['live', PHASE_6_9_7_V5_CONFIRMATION],
      env: authorizedLiveEnv(),
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000535',
      harnessFactory: ({ mode, runId, runScope }) =>
        createPhase697V5SyntheticHarness({ mode, runId, runScope }),
      durabilityOverrides: { open: failingOpen },
    });
    expect(result).toEqual({ ok: false, code: 'journal_io_failed' });
    expect(
      await sealPhase697TutorOrganizerV5Orphan({ root, processAlive: () => false }),
    ).toMatchObject({ ok: true, disposition: 'completed_run' });
  });

  test('rejects journal-tail drift after recovery claim acquisition', async () => {
    const root = await temporaryRoot();
    const runId = '00000000-0000-4000-8000-000000000536';
    const failed = await executePhase697TutorOrganizerV5Cli({
      argv: ['live', PHASE_6_9_7_V5_CONFIRMATION],
      env: authorizedLiveEnv(),
      repositoryRoot: root,
      runId,
      harnessFactory() {
        throw new Error('synthetic pre-run crash');
      },
    });
    expect(failed).toEqual({ ok: false, code: 'execution_failed' });
    const mockReport = await runPhase697TutorOrganizerPairedEvalV5(
      createPhase697V5SyntheticHarness({
        mode: 'mock',
        runId: '00000000-0000-4000-8000-000000000537',
      }),
    );
    const guardTerminal = mockReport.caseEntries.find(
      (entry) => entry.executionKind === 'zero_call',
    );
    if (!guardTerminal) throw new Error('guard terminal unavailable');
    const guardProjection = projectPhase697V5TerminalEntry(guardTerminal);
    if (!guardProjection) throw new Error('guard projection unavailable');
    const drifted = await sealPhase697TutorOrganizerV5Orphan({
      root,
      processAlive: () => false,
      async afterRecoveryClaimAcquiredForTest() {
        const read = await readPhase697V5Journal({ root, runId });
        if (!read.ok) throw new Error('journal unavailable');
        const record = buildPhase697V5JournalRecord({
          runId,
          sequence: read.journal.lastSequence + 1,
          previousRecordSha256: read.journal.tailSha256,
          payload: { kind: 'guard_terminal', terminal: guardProjection },
        });
        await appendFile(
          resolve(root, phase697V5JournalPath(runId)),
          `${stableJsonStringify(record)}\n`,
          'utf8',
        );
      },
    });
    expect(drifted).toEqual({ ok: false, code: 'durability_identity_invalid' });
    expect(
      await sealPhase697TutorOrganizerV5Orphan({ root, processAlive: () => false }),
    ).toMatchObject({ ok: true, gate: 'quality_gate_failed', disposition: 'orphan_sealed' });
  });
});
