import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_SCENARIOS,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_MATRIX_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_MATRIX_VERSION,
  runPhase697ArchitectureRecoveryProviderCanaryV2C1FaultMatrix,
} from '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c1-fault-matrix.ts';
import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_CLI_VERSION,
  runPhase697ArchitectureRecoveryProviderCanaryV2C1Cli,
} from '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c1-cli.ts';

const RAW_SENTINELS = [
  'v2-c1-fault-raw-value',
  'http://127.0.0.1:7897',
  'password',
  'api.deepseek.com',
  'sk-v2-c1-never-read',
];

describe('Phase 6.9.7 Architecture Recovery Provider Canary V2 C1 fault matrix and CLI', () => {
  test('freezes a closed synthetic scenario set', () => {
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_MATRIX_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-provider-canary-v2-c1-fault-matrix-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_SCENARIOS).toEqual([
      'direct_ready',
      'loopback_ready',
      'loopback_unavailable',
      'listener_probe_failed',
      'listener_probe_hang',
      'abort_before',
      'abort_during',
      'hostile_accessor',
      'hostile_descriptor',
      'no_proxy_rejected',
      'proxy_conflict_rejected',
      'capability_replay',
      'capability_concurrency',
      'capability_clone',
      'legacy_identity_rejected',
    ]);
    expect(
      Object.isFrozen(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_SCENARIOS),
    ).toBe(true);
  });

  test('passes the closed matrix with zero Provider and no raw retention', async () => {
    const report = await runPhase697ArchitectureRecoveryProviderCanaryV2C1FaultMatrix();

    expect(report).toMatchObject({
      authority: 'synthetic_test',
      qualityAuthority: 'none',
      providerHealth: 'unknown',
      zeroNetwork: true,
      scenarioCount: 15,
      passed: 15,
      failed: 0,
      providerCalls: 0,
      downstream: {
        credentialReads: 0,
        sourceReads: 0,
        markerWrites: 0,
        providerDelegates: 0,
      },
    });
    expect(report.cases).toHaveLength(15);
    expect(report.cases.every((entry) => entry.passed && entry.providerCalls === 0)).toBe(true);
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_MATRIX_SCHEMA.parse(report),
    ).toEqual(report);
    expectNoRaw(JSON.stringify(report));
  });

  test('keeps the CLI limited to zero-network mock and fault-matrix modes', async () => {
    const mockLines: string[] = [];
    const mockExit = await runPhase697ArchitectureRecoveryProviderCanaryV2C1Cli(
      { args: ['mock'], signal: new AbortController().signal },
      {
        write(line) {
          mockLines.push(line);
        },
      },
    );
    expect(mockExit).toBe(0);
    expect(mockLines).toHaveLength(1);
    expect(JSON.parse(mockLines[0] ?? '{}')).toMatchObject({
      cliVersion: 'phase-6.9.7-architecture-recovery-provider-canary-v2-c1-cli-v1',
      mode: 'mock',
      ok: true,
      providerHealth: 'unknown',
      providerCalls: 0,
      credentialReads: 0,
      sourceReads: 0,
      markerWrites: 0,
      providerDelegates: 0,
      disposition: 'capability_consumed',
    });
    expectNoRaw(mockLines[0] ?? '');

    const matrixLines: string[] = [];
    const matrixExit = await runPhase697ArchitectureRecoveryProviderCanaryV2C1Cli(
      { args: ['fault-matrix'], signal: new AbortController().signal },
      {
        write(line) {
          matrixLines.push(line);
        },
      },
    );
    expect(matrixExit).toBe(0);
    expect(matrixLines).toHaveLength(1);
    expect(JSON.parse(matrixLines[0] ?? '{}')).toMatchObject({
      cliVersion: 'phase-6.9.7-architecture-recovery-provider-canary-v2-c1-cli-v1',
      mode: 'fault-matrix',
      ok: true,
      scenarioCount: 15,
      passed: 15,
      failed: 0,
      providerCalls: 0,
    });
    expectNoRaw(matrixLines[0] ?? '');
  });

  test('rejects Live, overrides, retries, credentials, and output arguments before work', async () => {
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_CLI_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-provider-canary-v2-c1-cli-v1',
    );
    const rejected = [
      ['live'],
      ['mock', '--out=.tmp/report.json'],
      ['fault-matrix', '--retry=1'],
      ['--url=https://api.deepseek.com'],
      ['--credential=sk-v2-c1-never-read'],
      [],
    ];

    for (const args of rejected) {
      const lines: string[] = [];
      const exitCode = await runPhase697ArchitectureRecoveryProviderCanaryV2C1Cli(
        { args, signal: new AbortController().signal },
        {
          write(line) {
            lines.push(line);
          },
        },
      );
      expect(exitCode, args.join(' ')).toBe(1);
      expect(lines, args.join(' ')).toHaveLength(1);
      expect(JSON.parse(lines[0] ?? '{}')).toEqual({
        version: 'phase-6.9.7-architecture-recovery-provider-canary-v2-c1-cli-v1',
        ok: false,
        code: 'c1_cli_argument_invalid',
        providerHealth: 'unknown',
        providerCalls: 0,
      });
      expectNoRaw(lines[0] ?? '');
    }
  });

  test('fails closed when stdout is unavailable', async () => {
    const exitCode = await runPhase697ArchitectureRecoveryProviderCanaryV2C1Cli(
      { args: ['mock'], signal: new AbortController().signal },
      {
        write() {
          throw new Error('v2-c1-fault-raw-value');
        },
      },
    );
    expect(exitCode).toBe(1);
  });
});

function expectNoRaw(value: string) {
  for (const sentinel of RAW_SENTINELS) expect(value).not.toContain(sentinel);
}
