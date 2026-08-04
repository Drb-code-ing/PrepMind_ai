import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVAL_ENV,
  PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVED_SOURCE_REF,
  PHASE_6_9_7_SCHEMA_RECOVERY_SR5_CREDENTIAL_ENV,
  PHASE_6_9_7_SCHEMA_RECOVERY_SR5_EXACT_CONFIRMATION,
  PHASE_6_9_7_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA,
  PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_PATHS,
  claimPhase697SchemaRecoverySr5ConsumedProxyAttestation,
  consumePhase697SchemaRecoverySr5ProxyAttestation,
  createPhase697SchemaRecoverySr5SyntheticProxyAttestationForTest,
  createPhase697SchemaRecoverySr5SyntheticSourceForTest,
  readPhase697SchemaRecoverySr5Approval,
  readPhase697SchemaRecoverySr5Credential,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-sr5-authority.ts';
import { computePhase697FullGateCanonicalSha256 } from '../src/evals/phase-6-9-tutor-organizer-full-gate-manifest.ts';
import { PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_BUNDLE_SHA256 } from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-sr5-source-manifest.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_SR5_CRASH_SEAL_CONFIRMATION,
  executePhase697SchemaRecoverySr5CliCore,
  type Phase697SchemaRecoverySr5CliCorePorts,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-sr5-cli-core.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_MARKER_RELATIVE_PATH,
  type Phase697SchemaRecoveryCrashSealResult,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-durability.ts';
import { runPhase697TutorOrganizerSchemaRecovery } from '../src/evals/run-phase-6-9-tutor-organizer-schema-recovery.ts';
import { runPhase697SchemaRecoverySr5Cli } from '../scripts/phase-6-9-7-tutor-organizer-schema-recovery-sr5-cli.ts';
import {
  createSr3MemoryLifecycle,
  createSr3SuccessHarness,
} from './phase-6-9-tutor-organizer-schema-recovery-sr3-helpers.ts';

const SR5_RUN_ID = '00000000-0000-4000-8000-000000000975';
const SR5_APPROVED_SOURCE_COMMIT = '67661f5f3a302b547e804c2c1839ec89898d4441';
const SR5_APPROVED_GIT_BLOB_BUNDLE_SHA256 =
  '91b52eb28c88d08faa65e5d37aeddf172c16137d19be182292e191c66bb04c56';
const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function resolveApprovedSr5SourceCommit(): string {
  return execFileSync(
    'git',
    ['rev-parse', `${PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVED_SOURCE_REF}^{commit}`],
    { cwd: REPOSITORY_ROOT, encoding: 'utf8', windowsHide: true },
  ).trim();
}

function readApprovedSr5GitBlob(path: string): Buffer {
  return execFileSync(
    'git',
    ['show', `${PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVED_SOURCE_REF}:${path}`],
    { cwd: REPOSITORY_ROOT, windowsHide: true },
  );
}

function computeApprovedSr5GitBlobBundleSha256(): string {
  return computePhase697FullGateCanonicalSha256(
    PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_PATHS.map((path) => ({
      path,
      sha256: createHash('sha256').update(readApprovedSr5GitBlob(path)).digest('hex'),
    })),
  );
}

function readApprovedSr5DetachedBundleAnchor(): string | null {
  const source = readApprovedSr5GitBlob(
    'packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-sr5-source-manifest.ts',
  ).toString('utf8');
  return source.match(/RUNNABLE_SOURCE_BUNDLE_SHA256\s*=\s*\n?\s*'([0-9a-f]{64})'/u)?.[1] ?? null;
}

describe('Phase 6.9.7 schema recovery SR5 authority and CLI', () => {
  test('uses an independent approved tag and rejects source parity drift', () => {
    const source = createPhase697SchemaRecoverySr5SyntheticSourceForTest();
    expect(source.approvedRunnableSourceRef).toBe(
      'refs/tags/phase-6-9-7-tutor-organizer-schema-recovery-sr5-approved',
    );
    expect(PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVED_SOURCE_REF).toBe(
      source.approvedRunnableSourceRef,
    );
    expect(
      PHASE_6_9_7_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA.safeParse({
        ...source,
        approvedRunnableSourceCommit: 'c'.repeat(40),
      }).success,
    ).toBe(false);
    expect(
      PHASE_6_9_7_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA.safeParse({
        ...source,
        approvedRunnableSourceRef: 'refs/tags/phase-6-9-7-tutor-organizer-full-gate-s3-approved',
      }).success,
    ).toBe(false);
  });

  test('binds the detached bundle to the immutable approved commit without later worktree coupling', () => {
    expect(new Set(PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_PATHS).size).toBe(
      PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_PATHS.length,
    );
    expect(PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_PATHS).toContain(
      'packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-sr5-authority.ts',
    );
    expect(PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_PATHS).not.toContain(
      'packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-sr5-source-manifest.ts',
    );
    expect(PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_BUNDLE_SHA256).not.toBe('0'.repeat(64));
    expect(PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_BUNDLE_SHA256).toBe(
      '61e6bb60fa2c5aa2a74d511b4ba8fbaf86ed186d8993afb9e5ddb844bb05d08c',
    );
    expect(resolveApprovedSr5SourceCommit()).toBe(SR5_APPROVED_SOURCE_COMMIT);
    expect(computeApprovedSr5GitBlobBundleSha256()).toBe(SR5_APPROVED_GIT_BLOB_BUNDLE_SHA256);
    expect(readApprovedSr5DetachedBundleAnchor()).toBe(
      PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_BUNDLE_SHA256,
    );
  });

  test('binds proxy readiness to opaque single-use SR5 capabilities', () => {
    const attestation =
      createPhase697SchemaRecoverySr5SyntheticProxyAttestationForTest('loopback_proxy_ready');
    const clone = structuredClone(attestation);
    expect(() =>
      consumePhase697SchemaRecoverySr5ProxyAttestation(clone, 'synthetic_test'),
    ).toThrow();
    expect(() =>
      consumePhase697SchemaRecoverySr5ProxyAttestation(attestation, 'controlled_live'),
    ).toThrow();
    const consumed = consumePhase697SchemaRecoverySr5ProxyAttestation(
      attestation,
      'synthetic_test',
    );
    expect(() =>
      consumePhase697SchemaRecoverySr5ProxyAttestation(attestation, 'synthetic_test'),
    ).toThrow();
    expect(() =>
      claimPhase697SchemaRecoverySr5ConsumedProxyAttestation(
        structuredClone(consumed),
        'synthetic_test',
      ),
    ).toThrow();
    expect(
      claimPhase697SchemaRecoverySr5ConsumedProxyAttestation(consumed, 'synthetic_test'),
    ).toEqual({
      version: 'phase-6.9.7-tutor-organizer-schema-recovery-sr5-proxy-attestation-v1',
      status: 'loopback_proxy_ready',
      providerCalls: 0,
    });
    expect(() =>
      claimPhase697SchemaRecoverySr5ConsumedProxyAttestation(consumed, 'synthetic_test'),
    ).toThrow();
  });

  test('accepts only the exact authorization and dedicated credential', () => {
    expect(
      readPhase697SchemaRecoverySr5Approval({
        [PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVAL_ENV]:
          PHASE_6_9_7_SCHEMA_RECOVERY_SR5_EXACT_CONFIRMATION,
      }),
    ).toBe(true);
    expect(() =>
      readPhase697SchemaRecoverySr5Approval({
        [PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVAL_ENV]: 'true',
      }),
    ).toThrow();
    expect(() =>
      readPhase697SchemaRecoverySr5Credential({ DEEPSEEK_API_KEY: 'generic-rejected' }),
    ).toThrow();
    expect(
      readPhase697SchemaRecoverySr5Credential({
        [PHASE_6_9_7_SCHEMA_RECOVERY_SR5_CREDENTIAL_ENV]: 'sr5-dedicated-test-only',
      }),
    ).toBe('sr5-dedicated-test-only');
  });

  test('fixes preflight -> source -> approval -> credential -> marker -> run -> publication', async () => {
    const trace: string[] = [];
    const output: string[] = [];
    const exitCode = await executePhase697SchemaRecoverySr5CliCore(
      validInput(),
      recordingPorts(trace, output),
    );

    expect(exitCode).toBe(0);
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
      ok: true,
      evidenceSealed: true,
      authority: 'controlled_live',
      qualityAuthority: 'schema_recovery_full_gate_semantic_gate',
      runId: SR5_RUN_ID,
      gate: 'schema_recovery_quality_gate_passed',
    });
    expect(output[0]).not.toContain('sr5-dedicated-test-only');
    expect(output[0]).not.toMatch(/https?:\/\//u);
  });

  test('stops before credential and reservation when admission or approval fails', async () => {
    const sourceTrace: string[] = [];
    const sourceOutput: string[] = [];
    expect(
      await executePhase697SchemaRecoverySr5CliCore(
        validInput(),
        recordingPorts(sourceTrace, sourceOutput, {
          async readSource() {
            sourceTrace.push('source');
            throw new Error('synthetic source failure');
          },
        }),
      ),
    ).toBe(1);
    expect(sourceTrace).toEqual(['preflight', 'consume_proxy', 'source', 'write']);
    expect(JSON.parse(sourceOutput[0]!).code).toBe('source_invalid');

    const approvalTrace: string[] = [];
    const approvalOutput: string[] = [];
    expect(
      await executePhase697SchemaRecoverySr5CliCore(
        validInput(),
        recordingPorts(approvalTrace, approvalOutput, {
          readApproval() {
            approvalTrace.push('approval');
            throw new Error('synthetic approval failure');
          },
        }),
      ),
    ).toBe(1);
    expect(approvalTrace).toEqual(['preflight', 'consume_proxy', 'source', 'approval', 'write']);
    expect(JSON.parse(approvalOutput[0]!).code).toBe('live_not_authorized');
  });

  test('rejects override arguments and keeps crash seal zero-provider', async () => {
    for (const args of [
      [],
      ['live'],
      [PHASE_6_9_7_SCHEMA_RECOVERY_SR5_EXACT_CONFIRMATION, '--retry'],
      ['--url=https://example.invalid'],
      ['--model=other'],
      ['--root=C:/override'],
      ['--output=.tmp/override.json'],
    ]) {
      const trace: string[] = [];
      const output: string[] = [];
      expect(
        await executePhase697SchemaRecoverySr5CliCore(
          { ...validInput(), args },
          recordingPorts(trace, output),
        ),
      ).toBe(1);
      expect(trace).toEqual(['write']);
      expect(JSON.parse(output[0]!).code).toBe('cli_argument_invalid');
    }

    const trace: string[] = [];
    const output: string[] = [];
    expect(
      await executePhase697SchemaRecoverySr5CliCore(
        { ...validInput(), args: [PHASE_6_9_7_SCHEMA_RECOVERY_SR5_CRASH_SEAL_CONFIRMATION] },
        recordingPorts(trace, output, {
          async seal() {
            trace.push('seal');
            return Object.freeze({
              ok: false,
              code: 'attempt_missing_or_invalid',
            }) satisfies Phase697SchemaRecoveryCrashSealResult;
          },
        }),
      ),
    ).toBe(1);
    expect(trace).toEqual(['seal', 'write']);
    expect(JSON.parse(output[0]!)).toMatchObject({
      evidenceSealed: false,
      qualityAuthority: 'none',
      providerCalls: 0,
    });
  });

  test('keeps the production entry closed and public files free of embedded secrets', async () => {
    let injectedCalls = 0;
    const exitCode = await Reflect.apply(runPhase697SchemaRecoverySr5Cli, null, [
      {
        args: [],
        signal: new AbortController().signal,
        root: 'C:/injected',
        fetch() {
          injectedCalls += 1;
        },
      },
      { preflight: () => (injectedCalls += 1) },
    ]);
    expect(exitCode).toBe(1);
    expect(runPhase697SchemaRecoverySr5Cli.length).toBe(1);
    expect(injectedCalls).toBe(0);

    const [script, packageJson] = await Promise.all([
      readFile(
        new URL(
          '../scripts/phase-6-9-7-tutor-organizer-schema-recovery-sr5-cli.ts',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ]);
    expect(script).not.toContain('sr5-dedicated-test-only');
    expect(script).not.toContain('DEEPSEEK_API_KEY=');
    expect(packageJson).not.toContain(PHASE_6_9_7_SCHEMA_RECOVERY_SR5_EXACT_CONFIRMATION);
    expect(packageJson).not.toContain(PHASE_6_9_7_SCHEMA_RECOVERY_SR5_CREDENTIAL_ENV);
  });
});

function validInput() {
  return {
    args: [PHASE_6_9_7_SCHEMA_RECOVERY_SR5_EXACT_CONFIRMATION],
    root: 'C:/synthetic-prepmind',
    authorizationEnv: Object.freeze({ synthetic: 'only' }),
    signal: new AbortController().signal,
  };
}

function recordingPorts(
  trace: string[],
  output: string[],
  overrides: Partial<Phase697SchemaRecoverySr5CliCorePorts> = {},
): Phase697SchemaRecoverySr5CliCorePorts {
  const memory = createSr3MemoryLifecycle();
  const source = createPhase697SchemaRecoverySr5SyntheticSourceForTest();
  const syntheticHarness = createSr3SuccessHarness();
  const liveHarness = Object.freeze({
    ...syntheticHarness,
    mode: 'live' as const,
    executorProvenance: 'deepseek_network' as const,
  });
  const base: Phase697SchemaRecoverySr5CliCorePorts = {
    authority: 'controlled_live',
    async preflight() {
      trace.push('preflight');
      return createPhase697SchemaRecoverySr5SyntheticProxyAttestationForTest();
    },
    consumeProxyAttestation(value) {
      trace.push('consume_proxy');
      return consumePhase697SchemaRecoverySr5ProxyAttestation(value, 'synthetic_test');
    },
    async readSource() {
      trace.push('source');
      return source;
    },
    readApproval() {
      trace.push('approval');
      return true;
    },
    readCredential() {
      trace.push('credential');
      return 'sr5-dedicated-test-only';
    },
    async reserve(input) {
      trace.push('reserve');
      return Object.freeze({
        runId: input.runId,
        markerRelativePath: PHASE_6_9_7_SCHEMA_RECOVERY_MARKER_RELATIVE_PATH,
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
      return liveHarness;
    },
    async run(input) {
      trace.push('run');
      return runPhase697TutorOrganizerSchemaRecovery(input);
    },
    async validate() {
      trace.push('validate');
      return Object.freeze({
        ok: true,
        runId: SR5_RUN_ID,
        journalRecords: 1,
        finalJournalEvent: 'evidence_published',
        reportLogicalSha256: '8'.repeat(64),
      });
    },
    async seal() {
      trace.push('seal');
      return Object.freeze({ ok: false, code: 'attempt_missing_or_invalid' });
    },
    randomUUID() {
      trace.push('uuid');
      return SR5_RUN_ID;
    },
    now() {
      trace.push('now');
      return Date.parse('2026-08-02T09:00:00.000Z');
    },
    write(line) {
      trace.push('write');
      output.push(line);
    },
  };
  return Object.freeze({ ...base, ...overrides });
}
