import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_SMALL_SAMPLE_APPROVAL_ENV,
  PHASE_6_9_7_SMALL_SAMPLE_APPROVED_SOURCE_REF,
  PHASE_6_9_7_SMALL_SAMPLE_CREDENTIAL_ENV,
  PHASE_6_9_7_SMALL_SAMPLE_EXACT_CONFIRMATION,
  PHASE_6_9_7_SMALL_SAMPLE_SOURCE_SCHEMA,
  claimPhase697SmallSampleConsumedProxyAttestation,
  consumePhase697SmallSampleProxyAttestation,
  createPhase697SmallSampleSyntheticProxyAttestationForTest,
  readPhase697SmallSampleApproval,
  readPhase697SmallSampleCredential,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-authority.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_CRASH_SEAL_CONFIRMATION,
  executePhase697SmallSampleCliCore,
  type Phase697SmallSampleCliCorePorts,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-cli-core.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH,
  type Phase697SmallSampleCrashSealResult,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-durability.ts';
import { runPhase697SmallSampleCli } from '../scripts/phase-6-9-7-tutor-organizer-small-sample-cli.ts';
import {
  G2_RUN_ID,
  createG2MemoryLifecycle,
  createG2PassingReport,
  createG2Source,
  createG2SuccessHarness,
} from './phase-6-9-tutor-organizer-small-sample-g2-helpers.ts';

describe('Phase 6.9.7 small-sample G2 authority and CLI', () => {
  test('binds proxy readiness to two opaque single-use capabilities', () => {
    const attestation =
      createPhase697SmallSampleSyntheticProxyAttestationForTest('loopback_proxy_ready');
    const clone = structuredClone(attestation);

    expect(() => consumePhase697SmallSampleProxyAttestation({}, 'synthetic_test')).toThrow();
    expect(() => consumePhase697SmallSampleProxyAttestation(clone, 'synthetic_test')).toThrow();
    expect(() =>
      consumePhase697SmallSampleProxyAttestation(attestation, 'controlled_live'),
    ).toThrow();

    const consumed = consumePhase697SmallSampleProxyAttestation(attestation, 'synthetic_test');
    expect(() =>
      consumePhase697SmallSampleProxyAttestation(attestation, 'synthetic_test'),
    ).toThrow();
    expect(() =>
      claimPhase697SmallSampleConsumedProxyAttestation(structuredClone(consumed), 'synthetic_test'),
    ).toThrow();
    expect(claimPhase697SmallSampleConsumedProxyAttestation(consumed, 'synthetic_test')).toEqual({
      version: 'phase-6.9.7-tutor-organizer-small-sample-proxy-attestation-v1',
      status: 'loopback_proxy_ready',
      providerCalls: 0,
    });
    expect(() =>
      claimPhase697SmallSampleConsumedProxyAttestation(consumed, 'synthetic_test'),
    ).toThrow();
  });

  test('requires the independently approved S2 tag and exact source parity', () => {
    const source = createG2Source();
    expect(source.approvedRunnableSourceRef).toBe(
      'refs/tags/phase-6-9-7-tutor-organizer-small-sample-s2-approved',
    );
    expect(PHASE_6_9_7_SMALL_SAMPLE_APPROVED_SOURCE_REF).toBe(source.approvedRunnableSourceRef);
    expect(
      PHASE_6_9_7_SMALL_SAMPLE_SOURCE_SCHEMA.safeParse({
        ...source,
        approvedRunnableSourceCommit: '3'.repeat(40),
      }).success,
    ).toBe(false);
    expect(
      PHASE_6_9_7_SMALL_SAMPLE_SOURCE_SCHEMA.safeParse({
        ...source,
        approvedRunnableSourceRef: 'refs/heads/self-approved',
      }).success,
    ).toBe(false);
  });

  test('accepts only the exact approval phrase and dedicated credential key', () => {
    expect(
      readPhase697SmallSampleApproval({
        [PHASE_6_9_7_SMALL_SAMPLE_APPROVAL_ENV]: PHASE_6_9_7_SMALL_SAMPLE_EXACT_CONFIRMATION,
      }),
    ).toBe(true);
    expect(() =>
      readPhase697SmallSampleApproval({
        [PHASE_6_9_7_SMALL_SAMPLE_APPROVAL_ENV]: 'true',
      }),
    ).toThrow();
    expect(() =>
      readPhase697SmallSampleCredential({ DEEPSEEK_API_KEY: 'generic-rejected' }),
    ).toThrow();
    expect(
      readPhase697SmallSampleCredential({
        [PHASE_6_9_7_SMALL_SAMPLE_CREDENTIAL_ENV]: 'g2-dedicated-test-only',
      }),
    ).toBe('g2-dedicated-test-only');
  });

  test('fixes preflight -> source -> approval -> credential -> marker -> run -> publication', async () => {
    const trace: string[] = [];
    const output: string[] = [];
    const ports = recordingPorts(trace, output);

    const exitCode = await executePhase697SmallSampleCliCore(validInput(), ports);

    expect(exitCode).toBe(1);
    expect(trace).toEqual([
      'preflight',
      'consume_proxy',
      'source',
      'approval',
      'credential',
      'uuid',
      'now',
      'reserve',
      'create_harness',
      'run',
      'publish',
      'validate',
      'write',
    ]);
    expect(JSON.parse(output[0]!)).toMatchObject({
      evidenceSealed: true,
      authority: 'synthetic_test',
      qualityAuthority: 'none',
      runId: G2_RUN_ID,
      gate: 'small_sample_quality_gate_failed',
    });
    expect(output[0]).not.toContain('g2-dedicated-test-only');
    expect(output[0]).not.toMatch(/https?:\/\//u);
  });

  test('stops before credential and marker when source or approval fails', async () => {
    const sourceTrace: string[] = [];
    const sourceOutput: string[] = [];
    const sourcePorts = recordingPorts(sourceTrace, sourceOutput, {
      async readSource() {
        sourceTrace.push('source');
        throw new Error('synthetic source failure');
      },
    });
    expect(await executePhase697SmallSampleCliCore(validInput(), sourcePorts)).toBe(1);
    expect(sourceTrace).toEqual(['preflight', 'consume_proxy', 'source', 'write']);
    expect(JSON.parse(sourceOutput[0]!).code).toBe('source_invalid');

    const approvalTrace: string[] = [];
    const approvalOutput: string[] = [];
    const approvalPorts = recordingPorts(approvalTrace, approvalOutput, {
      readApproval() {
        approvalTrace.push('approval');
        throw new Error('synthetic approval failure');
      },
    });
    expect(await executePhase697SmallSampleCliCore(validInput(), approvalPorts)).toBe(1);
    expect(approvalTrace).toEqual(['preflight', 'consume_proxy', 'source', 'approval', 'write']);
    expect(JSON.parse(approvalOutput[0]!).code).toBe('live_not_authorized');
  });

  test('rejects every argument override before preflight or reservation', async () => {
    for (const args of [
      [],
      ['live'],
      [PHASE_6_9_7_SMALL_SAMPLE_EXACT_CONFIRMATION, '--retry'],
      ['--url=https://example.invalid'],
      ['--model=other'],
      ['--root=C:/override'],
      ['--output=.tmp/override.json'],
    ]) {
      const trace: string[] = [];
      const output: string[] = [];
      expect(
        await executePhase697SmallSampleCliCore(
          { ...validInput(), args },
          recordingPorts(trace, output),
        ),
      ).toBe(1);
      expect(trace).toEqual(['write']);
      expect(JSON.parse(output[0]!).code).toBe('cli_argument_invalid');
    }
  });

  test('keeps crash-only seal free of preflight, source, authorization, and Provider ports', async () => {
    const trace: string[] = [];
    const output: string[] = [];
    const ports = recordingPorts(trace, output, {
      async seal() {
        trace.push('seal');
        return Object.freeze({
          ok: false,
          code: 'attempt_missing_or_invalid',
        }) satisfies Phase697SmallSampleCrashSealResult;
      },
    });

    expect(
      await executePhase697SmallSampleCliCore(
        { ...validInput(), args: [PHASE_6_9_7_SMALL_SAMPLE_CRASH_SEAL_CONFIRMATION] },
        ports,
      ),
    ).toBe(1);
    expect(trace).toEqual(['seal', 'write']);
    expect(JSON.parse(output[0]!)).toMatchObject({
      evidenceSealed: false,
      qualityAuthority: 'none',
      code: 'attempt_missing_or_invalid',
    });
  });

  test('keeps the public production entry closed to injected root/fetch/model/ports', async () => {
    let injectedCalls = 0;
    const exitCode = await Reflect.apply(runPhase697SmallSampleCli, null, [
      {
        args: [],
        signal: new AbortController().signal,
        root: 'C:/injected',
        fetch() {
          injectedCalls += 1;
        },
      },
      {
        preflight() {
          injectedCalls += 1;
        },
      },
    ]);

    expect(exitCode).toBe(1);
    expect(runPhase697SmallSampleCli.length).toBe(1);
    expect(injectedCalls).toBe(0);
  });

  test('keeps the public script and package commands free of embedded credentials or approval', async () => {
    const [script, packageJson] = await Promise.all([
      readFile(
        new URL('../scripts/phase-6-9-7-tutor-organizer-small-sample-cli.ts', import.meta.url),
        'utf8',
      ),
      readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ]);
    expect(script).not.toContain('g2-dedicated-test-only');
    expect(script).not.toContain('DEEPSEEK_API_KEY=');
    expect(packageJson).not.toContain(PHASE_6_9_7_SMALL_SAMPLE_EXACT_CONFIRMATION);
    expect(packageJson).not.toContain(PHASE_6_9_7_SMALL_SAMPLE_CREDENTIAL_ENV);
  });
});

function validInput() {
  return {
    args: [PHASE_6_9_7_SMALL_SAMPLE_EXACT_CONFIRMATION],
    root: 'C:/synthetic-prepmind',
    authorizationEnv: Object.freeze({ synthetic: 'only' }),
    signal: new AbortController().signal,
  };
}

function recordingPorts(
  trace: string[],
  output: string[],
  overrides: Partial<Phase697SmallSampleCliCorePorts> = {},
): Phase697SmallSampleCliCorePorts {
  const memory = createG2MemoryLifecycle();
  const base: Phase697SmallSampleCliCorePorts = {
    authority: 'synthetic_test',
    async preflight() {
      trace.push('preflight');
      return createPhase697SmallSampleSyntheticProxyAttestationForTest();
    },
    consumeProxyAttestation(value) {
      trace.push('consume_proxy');
      return consumePhase697SmallSampleProxyAttestation(value, 'synthetic_test');
    },
    async readSource() {
      trace.push('source');
      return createG2Source();
    },
    readApproval() {
      trace.push('approval');
      return true;
    },
    readCredential() {
      trace.push('credential');
      return 'g2-dedicated-test-only';
    },
    async reserve(input) {
      trace.push('reserve');
      return Object.freeze({
        runId: input.runId,
        markerRelativePath: PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH,
        journalRelativePath: `.tmp/synthetic-${input.runId}.journal.jsonl`,
        lifecycle: memory.lifecycle,
        async publishArtifact() {
          trace.push('publish');
          return Object.freeze({
            relativePath: `.tmp/synthetic-${input.runId}.json`,
            evidenceSha256: '9'.repeat(64),
          });
        },
      });
    },
    createHarness() {
      trace.push('create_harness');
      return createG2SuccessHarness();
    },
    async run(input) {
      trace.push('run');
      return createG2PassingReport(input.runId);
    },
    async validate() {
      trace.push('validate');
      return Object.freeze({ ok: true, runId: G2_RUN_ID });
    },
    async seal() {
      trace.push('seal');
      return Object.freeze({ ok: false, code: 'attempt_missing_or_invalid' });
    },
    randomUUID() {
      trace.push('uuid');
      return G2_RUN_ID;
    },
    now() {
      trace.push('now');
      return Date.parse('2026-07-31T08:00:00.000Z');
    },
    write(line) {
      trace.push('write');
      output.push(line);
    },
  };
  return Object.freeze({ ...base, ...overrides });
}
