import {
  consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation,
  runPhase697ArchitectureRecoveryProviderCanaryV2C1,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c1.ts';
import { runPhase697ArchitectureRecoveryProviderCanaryV2C1FaultMatrix } from './phase-6-9-7-architecture-recovery-provider-canary-v2-c1-fault-matrix.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_CLI_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-c1-cli-v1' as const;

export type Phase697ArchitectureRecoveryProviderCanaryV2C1CliInput = Readonly<{
  args: readonly string[];
  signal: AbortSignal;
}>;

type Phase697ArchitectureRecoveryProviderCanaryV2C1CliPorts = Readonly<{
  write(line: string): void;
}>;

const DEFAULT_PORTS: Phase697ArchitectureRecoveryProviderCanaryV2C1CliPorts = Object.freeze({
  write: (line) => process.stdout.write(`${line}\n`),
});

/**
 * C1 exposes only closed zero-network modes. It never snapshots process.env
 * and accepts no Live, credential, URL, proxy, retry, or output override.
 */
export async function runPhase697ArchitectureRecoveryProviderCanaryV2C1Cli(
  rawInput: Phase697ArchitectureRecoveryProviderCanaryV2C1CliInput,
  rawPorts: Phase697ArchitectureRecoveryProviderCanaryV2C1CliPorts = DEFAULT_PORTS,
): Promise<0 | 1> {
  const input = readInput(rawInput);
  const ports = readPorts(rawPorts);
  if (!input || !ports || !isAllowedArgs(input.args)) {
    safeWrite(ports?.write, serializeRejected('c1_cli_argument_invalid'));
    return 1;
  }
  if (isSignalAborted(input.signal)) {
    safeWrite(ports.write, serializeRejected('c1_cli_aborted'));
    return 1;
  }

  if (input.args[0] === 'mock') {
    const admission = await runPhase697ArchitectureRecoveryProviderCanaryV2C1(
      { env: {}, signal: input.signal },
      {
        async probeLoopbackListener() {
          return true;
        },
      },
    );
    const consumed = consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(
      admission.attestation,
    );
    const report = consumed.report ?? admission.report;
    const output = JSON.stringify({
      cliVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_CLI_VERSION,
      mode: 'mock',
      ok: consumed.ok,
      authority: report.authority,
      qualityAuthority: report.qualityAuthority,
      providerHealth: report.providerHealth,
      zeroNetwork: report.zeroNetwork,
      providerCalls: report.downstream.providerCalls,
      credentialReads: report.downstream.credentialReads,
      sourceReads: report.downstream.sourceReads,
      markerWrites: report.downstream.markerWrites,
      providerDelegates: report.downstream.providerDelegates,
      disposition: report.disposition,
      preflightCode: report.preflight.code,
      attestationCode: consumed.code,
    });
    if (!safeWrite(ports.write, output)) return 1;
    return consumed.ok ? 0 : 1;
  }

  const matrix = await runPhase697ArchitectureRecoveryProviderCanaryV2C1FaultMatrix();
  const output = JSON.stringify({
    cliVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_CLI_VERSION,
    mode: 'fault-matrix',
    ok: matrix.failed === 0,
    authority: matrix.authority,
    qualityAuthority: matrix.qualityAuthority,
    providerHealth: matrix.providerHealth,
    zeroNetwork: matrix.zeroNetwork,
    scenarioCount: matrix.scenarioCount,
    passed: matrix.passed,
    failed: matrix.failed,
    providerCalls: matrix.providerCalls,
    credentialReads: matrix.downstream.credentialReads,
    sourceReads: matrix.downstream.sourceReads,
    markerWrites: matrix.downstream.markerWrites,
    providerDelegates: matrix.downstream.providerDelegates,
  });
  if (!safeWrite(ports.write, output)) return 1;
  return matrix.failed === 0 ? 0 : 1;
}

function serializeRejected(code: 'c1_cli_argument_invalid' | 'c1_cli_aborted') {
  return JSON.stringify({
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_CLI_VERSION,
    ok: false,
    code,
    providerHealth: 'unknown',
    providerCalls: 0,
  });
}

function isAllowedArgs(args: readonly string[]): args is readonly ['mock' | 'fault-matrix'] {
  return args.length === 1 && (args[0] === 'mock' || args[0] === 'fault-matrix');
}

function readInput(value: unknown): Phase697ArchitectureRecoveryProviderCanaryV2C1CliInput | null {
  const fields = readExactOwnDataValues(value, ['args', 'signal']);
  if (
    !fields ||
    !Array.isArray(fields.args) ||
    !fields.args.every((argument) => typeof argument === 'string') ||
    !isAbortSignal(fields.signal)
  ) {
    return null;
  }
  return Object.freeze({ args: Object.freeze([...fields.args]), signal: fields.signal });
}

function readPorts(value: unknown): Phase697ArchitectureRecoveryProviderCanaryV2C1CliPorts | null {
  const fields = readExactOwnDataValues(value, ['write']);
  if (!fields || typeof fields.write !== 'function') return null;
  return Object.freeze({ write: fields.write as (line: string) => void });
}

function readExactOwnDataValues(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) {
      return null;
    }
    const fields = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return null;
      fields[key] = descriptor.value;
    }
    return fields;
  } catch {
    return null;
  }
}

function safeWrite(write: ((line: string) => void) | undefined, line: string): boolean {
  try {
    if (!write) return false;
    write(line);
    return true;
  } catch {
    return false;
  }
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

function isSignalAborted(signal: AbortSignal): boolean {
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}

if (import.meta.main) {
  process.exitCode = await runPhase697ArchitectureRecoveryProviderCanaryV2C1Cli({
    args: process.argv.slice(2),
    signal: new AbortController().signal,
  });
}
