import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runPhase697ArchitectureRecoveryProviderCanaryV2C2Cli } from '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-cli.ts';
import { runPhase697ArchitectureRecoveryProviderCanaryV2C2CliForTesting } from '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-cli-testing.ts';
import {
  buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_APPROVAL_ENV,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONFIRMATION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CRASH_SEAL_CONFIRMATION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CREDENTIAL_ENV,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2Source,
} from '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-contract.ts';
import {
  reservePhase697ArchitectureRecoveryProviderCanaryV2C2,
  sealPhase697ArchitectureRecoveryProviderCanaryV2C2InterruptedAttempt,
  validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle,
} from '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-durability.ts';
import type { Phase697ArchitectureRecoveryProviderCanaryV2C2CliCorePorts } from '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-cli-core.ts';

const RUN_ID = '33333333-3333-4333-8333-333333333333';
const TEST_CREDENTIAL = 'c2-test-only-never-network';
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.7 Provider Canary V2 C2 CLI', () => {
  test('fixes preflight -> source -> approval/credential -> marker -> one fake run -> publication', async () => {
    const root = await tempRoot();
    const trace: string[] = [];
    const output: string[] = [];
    const authEnv = trackedAuthorizationEnv(trace, true, TEST_CREDENTIAL);
    let providerCalls = 0;
    let fakeRunCalls = 0;
    const ports = fakePorts({
      root,
      trace,
      output,
      onRun: () => {
        fakeRunCalls += 1;
      },
    });
    const exitCode = await runPhase697ArchitectureRecoveryProviderCanaryV2C2CliForTesting(
      {
        args: [PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONFIRMATION],
        root,
        proxyEnv: loopbackProxyEnv(),
        authorizationEnv: authEnv,
        signal: new AbortController().signal,
      },
      ports,
    );

    expect(exitCode).toBe(0);
    expect(trace).toEqual([
      'preflight_probe',
      'source',
      'approval',
      'credential',
      'uuid',
      'now',
      'reserve',
      'fake_run',
      'now',
      'validate',
      'write',
    ]);
    expect(fakeRunCalls).toBe(1);
    expect(providerCalls).toBe(0);
    expect(output).toHaveLength(1);
    expect(JSON.parse(output[0])).toMatchObject({
      ok: true,
      evidenceSealed: true,
      authority: 'controlled_live',
      qualityAuthority: 'none',
      providerHealth: 'strict_response_with_verified_usage',
      outcome: 'complete',
    });
    expect(output[0]).not.toContain(TEST_CREDENTIAL);
    expect(output[0]).not.toMatch(/127\.0\.0\.1|7897|https?:\/\//u);
    expect(
      await validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle({ root }),
    ).toMatchObject({ ok: true, runId: RUN_ID });
    providerCalls += 0;
  });

  test('stops at preflight without source, credential, marker, or Provider access', async () => {
    const root = await tempRoot();
    const trace: string[] = [];
    const output: string[] = [];
    let sourceCalls = 0;
    let reserveCalls = 0;
    let runCalls = 0;
    const authEnv = trackedAuthorizationEnv(trace, true, TEST_CREDENTIAL);
    const ports = fakePorts({
      root,
      trace,
      output,
      probeResult: false,
      sourceOverride: async () => {
        sourceCalls += 1;
        return sourceState();
      },
      reserveOverride: async (input) => {
        reserveCalls += 1;
        return reservePhase697ArchitectureRecoveryProviderCanaryV2C2(input);
      },
      onRun: () => {
        runCalls += 1;
      },
    });
    expect(
      await runPhase697ArchitectureRecoveryProviderCanaryV2C2CliForTesting(
        validInput(root, authEnv),
        ports,
      ),
    ).toBe(1);
    expect(trace).toEqual(['preflight_probe', 'write']);
    expect(sourceCalls).toBe(0);
    expect(reserveCalls).toBe(0);
    expect(runCalls).toBe(0);
    expect(JSON.parse(output[0])).toMatchObject({
      code: 'c2_preflight_rejected',
      providerCalls: 0,
      evidenceSealed: false,
    });
    expect(await listC2Files(root)).toEqual([]);
  });

  test('checks source before approval and approval before credential', async () => {
    const sourceRoot = await tempRoot();
    const sourceTrace: string[] = [];
    const sourceOutput: string[] = [];
    const sourceAuth = trackedAuthorizationEnv(sourceTrace, true, TEST_CREDENTIAL);
    const sourcePorts = fakePorts({
      root: sourceRoot,
      trace: sourceTrace,
      output: sourceOutput,
      sourceOverride: async () => {
        throw new Error('bounded');
      },
    });
    expect(
      await runPhase697ArchitectureRecoveryProviderCanaryV2C2CliForTesting(
        validInput(sourceRoot, sourceAuth),
        sourcePorts,
      ),
    ).toBe(1);
    expect(sourceTrace).toEqual(['preflight_probe', 'source', 'write']);
    expect(JSON.parse(sourceOutput[0]).code).toBe('c2_source_invalid');

    const authRoot = await tempRoot();
    const authTrace: string[] = [];
    const authOutput: string[] = [];
    const authEnv = trackedAuthorizationEnv(authTrace, false, TEST_CREDENTIAL);
    expect(
      await runPhase697ArchitectureRecoveryProviderCanaryV2C2CliForTesting(
        validInput(authRoot, authEnv),
        fakePorts({ root: authRoot, trace: authTrace, output: authOutput }),
      ),
    ).toBe(1);
    expect(authTrace).toEqual(['preflight_probe', 'source', 'approval', 'write']);
    expect(JSON.parse(authOutput[0]).code).toBe('c2_live_not_authorized');
    expect(await listC2Files(authRoot)).toEqual([]);
  });

  test('rejects invalid credential and all CLI override shapes before reservation', async () => {
    for (const credential of ['', ' bad', 'line\nbreak']) {
      const root = await tempRoot();
      const trace: string[] = [];
      const output: string[] = [];
      const authEnv = trackedAuthorizationEnv(trace, true, credential);
      expect(
        await runPhase697ArchitectureRecoveryProviderCanaryV2C2CliForTesting(
          validInput(root, authEnv),
          fakePorts({ root, trace, output }),
        ),
      ).toBe(1);
      expect(trace).toEqual(['preflight_probe', 'source', 'approval', 'credential', 'write']);
      expect(JSON.parse(output[0]).code).toBe('c2_live_configuration_invalid');
      expect(await listC2Files(root)).toEqual([]);
    }

    for (const args of [
      [],
      ['live'],
      [PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONFIRMATION, '--retry'],
      ['--url=https://example.invalid'],
      ['--model=other'],
      ['--output=.tmp/override.json'],
      ['--proxy=http://127.0.0.1:1'],
    ]) {
      const root = await tempRoot();
      const trace: string[] = [];
      const output: string[] = [];
      expect(
        await runPhase697ArchitectureRecoveryProviderCanaryV2C2CliForTesting(
          {
            ...validInput(root, trackedAuthorizationEnv(trace, true, TEST_CREDENTIAL)),
            args,
          },
          fakePorts({ root, trace, output }),
        ),
      ).toBe(1);
      expect(trace).toEqual(['write']);
      expect(JSON.parse(output[0]).code).toBe('c2_cli_argument_invalid');
      expect(await listC2Files(root)).toEqual([]);
    }
  });

  test('keeps the crash seal zero-preflight, zero-credential, and zero-Provider', async () => {
    const root = await tempRoot();
    const trace: string[] = [];
    const output: string[] = [];
    const authEnv = trackedAuthorizationEnv(trace, true, TEST_CREDENTIAL);
    const ports = fakePorts({ root, trace, output });
    const fixedPorts = {
      ...ports,
      async sealInterrupted() {
        trace.push('seal');
        return { ok: false as const, code: 'c2_seal_attempt_missing_or_invalid' as const };
      },
    };
    expect(
      await runPhase697ArchitectureRecoveryProviderCanaryV2C2CliForTesting(
        {
          args: [PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CRASH_SEAL_CONFIRMATION],
          root,
          proxyEnv: new Proxy(
            {},
            {
              ownKeys() {
                throw new Error('must not read proxy');
              },
            },
          ),
          authorizationEnv: authEnv,
          signal: new AbortController().signal,
        },
        fixedPorts,
      ),
    ).toBe(1);
    expect(trace).toEqual(['seal', 'write']);
    expect(JSON.parse(output[0])).toMatchObject({
      evidenceSealed: false,
      providerHealth: 'unknown',
      code: 'c2_seal_attempt_missing_or_invalid',
    });
  });

  test('isolates the public production entry from an injected second ports argument', async () => {
    let injectedCalls = 0;
    const exitCode = await Reflect.apply(
      runPhase697ArchitectureRecoveryProviderCanaryV2C2Cli,
      null,
      [
        {
          args: [],
          signal: new AbortController().signal,
          root: 'injected',
        },
        {
          probeLoopbackListener() {
            injectedCalls += 1;
            return true;
          },
          runControlledLive() {
            injectedCalls += 1;
            return controlledReport();
          },
        },
      ],
    );
    expect(exitCode).toBe(1);
    expect(runPhase697ArchitectureRecoveryProviderCanaryV2C2Cli.length).toBe(1);
    expect(injectedCalls).toBe(0);
  });

  test('exports the fixed production entry without exporting either injection seam', async () => {
    const packageExports = await import('../src/index.ts');

    expect(packageExports.runPhase697ArchitectureRecoveryProviderCanaryV2C2Cli).toBe(
      runPhase697ArchitectureRecoveryProviderCanaryV2C2Cli,
    );
    expect('executePhase697ArchitectureRecoveryProviderCanaryV2C2CliCore' in packageExports).toBe(
      false,
    );
    expect('runPhase697ArchitectureRecoveryProviderCanaryV2C2CliForTesting' in packageExports).toBe(
      false,
    );
  });

  test('returns failure when stdout fails after immutable evidence is already sealed', async () => {
    const root = await tempRoot();
    const trace: string[] = [];
    const authEnv = trackedAuthorizationEnv(trace, true, TEST_CREDENTIAL);
    const ports = fakePorts({ root, trace, output: [] });
    const throwingPorts = {
      ...ports,
      write() {
        trace.push('write');
        throw new Error('stdout unavailable');
      },
    };
    expect(
      await runPhase697ArchitectureRecoveryProviderCanaryV2C2CliForTesting(
        validInput(root, authEnv),
        throwingPorts,
      ),
    ).toBe(1);
    expect(
      await validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle({ root }),
    ).toMatchObject({ ok: true, runId: RUN_ID });
  });
});

function fakePorts(input: {
  root: string;
  trace: string[];
  output: string[];
  probeResult?: boolean;
  sourceOverride?: () => Promise<Phase697ArchitectureRecoveryProviderCanaryV2C2Source>;
  reserveOverride?: typeof reservePhase697ArchitectureRecoveryProviderCanaryV2C2;
  onRun?: () => void;
}): Phase697ArchitectureRecoveryProviderCanaryV2C2CliCorePorts {
  return {
    async probeLoopbackListener() {
      input.trace.push('preflight_probe');
      return input.probeResult ?? true;
    },
    async readSource() {
      input.trace.push('source');
      return input.sourceOverride ? input.sourceOverride() : sourceState();
    },
    async reserve(reservation) {
      input.trace.push('reserve');
      return (input.reserveOverride ?? reservePhase697ArchitectureRecoveryProviderCanaryV2C2)(
        reservation,
      );
    },
    async runControlledLive(run) {
      input.trace.push('fake_run');
      input.onRun?.();
      for (const stage of stages()) await run.appendWireStage(stage);
      return controlledReport();
    },
    sealInterrupted: sealPhase697ArchitectureRecoveryProviderCanaryV2C2InterruptedAttempt,
    async validate(validationInput) {
      input.trace.push('validate');
      return validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle(validationInput);
    },
    now() {
      input.trace.push('now');
      return Date.parse('2026-07-30T10:00:00.000Z');
    },
    randomUUID() {
      input.trace.push('uuid');
      return RUN_ID;
    },
    write(line) {
      input.trace.push('write');
      input.output.push(line);
    },
  };
}

async function tempRoot() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-provider-canary-v2-c2-cli-'));
  roots.push(root);
  await mkdir(join(root, '.tmp'));
  return root;
}

function validInput(root: string, authorizationEnv: Record<string, unknown>) {
  return {
    args: [PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONFIRMATION],
    root,
    proxyEnv: loopbackProxyEnv(),
    authorizationEnv,
    signal: new AbortController().signal,
  };
}

function loopbackProxyEnv() {
  return { HTTPS_PROXY: 'http://127.0.0.1:7897' };
}

function trackedAuthorizationEnv(trace: string[], approved: boolean, credential: string) {
  const target = {
    [PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_APPROVAL_ENV]: approved
      ? 'true'
      : 'false',
    [PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CREDENTIAL_ENV]: credential,
  };
  return new Proxy(target, {
    getOwnPropertyDescriptor(value, property) {
      if (property === PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_APPROVAL_ENV) {
        trace.push('approval');
      }
      if (property === PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CREDENTIAL_ENV) {
        trace.push('credential');
      }
      return Reflect.getOwnPropertyDescriptor(value, property);
    },
  });
}

function sourceState(): Phase697ArchitectureRecoveryProviderCanaryV2C2Source {
  return {
    version: 'phase-6.9.7-architecture-recovery-provider-canary-v2-source-v1',
    branch: 'codex/phase-6-9-7-tutor-wrong-question-agents',
    commit: 'a'.repeat(40),
    trackingCommit: 'a'.repeat(40),
    remoteCommit: 'a'.repeat(40),
    trackedWorktreeClean: true,
    formalArtifactCount: 0,
    r3BundleValid: true,
    r3RunId: '253a5df5-c443-4950-b517-849efb941728',
    r3MarkerSha256: '6eef1a3244b162e42fb784f7601e3518653fc40297735cfeb8ed2c2eb0c89b6a',
    r3JournalSha256: '426d64622ef71b88aa4154ca479fcc823d0d23a90c6f7daae0bb4a3cebcb7f7b',
    r3ArtifactSha256: '56fb5b1d196d2af9cc4aab5476d766d87ca9d794896e3c93df9268d13e62e6c4',
  };
}

function controlledReport() {
  return buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report({
    authority: 'controlled_live',
    executorProvenance: 'deepseek_network',
    outcome: 'complete',
    responseObserved: true,
    strictResponseObserved: true,
    providerFailureCategory: null,
    structuredOutputStage: null,
    transportSubtype: null,
    wire: {
      version: 'phase-6.9.7-v7-wire-diagnostics-v1',
      state: 'succeeded',
      lastCompletedStage: 'usage_validated',
      failureCategory: null,
      counters: {
        executorInvocations: 1,
        providerDispatches: 1,
        providerResponses: 1,
        verifiedUsages: 1,
      },
    },
    usage: { inputTokens: 32, outputTokens: 4 },
  });
}

function stages() {
  return [
    'executor_entered',
    'request_validated',
    'provider_dispatch_started',
    'provider_response_received',
    'response_audit_passed',
    'content_parsed',
    'schema_validated',
    'usage_validated',
  ] as const;
}

async function listC2Files(root: string) {
  const { readdir } = await import('node:fs/promises');
  return (await readdir(join(root, '.tmp'))).filter((name) =>
    name.startsWith('phase-6-9-7-architecture-recovery-provider-canary-v2'),
  );
}
