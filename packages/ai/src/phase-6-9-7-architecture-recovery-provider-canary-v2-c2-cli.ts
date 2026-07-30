import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  executePhase697ArchitectureRecoveryProviderCanaryV2C2CliCore,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2CliCorePorts,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c2-cli-core.ts';
import {
  reservePhase697ArchitectureRecoveryProviderCanaryV2C2,
  sealPhase697ArchitectureRecoveryProviderCanaryV2C2InterruptedAttempt,
  validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c2-durability.ts';
import {
  createPhase697ArchitectureRecoveryProviderCanaryV2C2ControlledLiveTransport,
  runPhase697ArchitectureRecoveryProviderCanaryV2C2Canary,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c2-runner.ts';
import { readPhase697ArchitectureRecoveryProviderCanaryV2C2Source } from './phase-6-9-7-architecture-recovery-provider-canary-v2-c2-source.ts';
import { probePhase697ArchitectureRecoveryLoopbackListener } from './phase-6-9-7-architecture-recovery-proxy-preflight-cli.ts';
import { PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_ENV_KEYS } from './phase-6-9-7-architecture-recovery-proxy-preflight.ts';

export type Phase697ArchitectureRecoveryProviderCanaryV2C2CliInput = Readonly<{
  args: readonly string[];
  signal: AbortSignal;
}>;

const DEFAULT_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PRODUCTION_PORTS: Phase697ArchitectureRecoveryProviderCanaryV2C2CliCorePorts = Object.freeze({
  now: () => Date.now(),
  probeLoopbackListener: probePhase697ArchitectureRecoveryLoopbackListener,
  randomUUID,
  readSource: readPhase697ArchitectureRecoveryProviderCanaryV2C2Source,
  reserve: reservePhase697ArchitectureRecoveryProviderCanaryV2C2,
  async runControlledLive(input) {
    const transport = createPhase697ArchitectureRecoveryProviderCanaryV2C2ControlledLiveTransport({
      apiKey: input.credential,
      appendStage: (stage) => input.appendWireStage(stage),
    });
    return runPhase697ArchitectureRecoveryProviderCanaryV2C2Canary({
      transport,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
    });
  },
  sealInterrupted: sealPhase697ArchitectureRecoveryProviderCanaryV2C2InterruptedAttempt,
  validate: validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle,
  write: (line) => process.stdout.write(`${line}\n`),
});

/**
 * The public C2 entry has fixed production composition. It accepts no env,
 * root, fetch, URL, model, proxy, timeout, clock, UUID, writer, output path,
 * retry, resume, or replay port from a caller.
 */
export async function runPhase697ArchitectureRecoveryProviderCanaryV2C2Cli(
  rawInput: Phase697ArchitectureRecoveryProviderCanaryV2C2CliInput,
): Promise<0 | 1> {
  const input = readInput(rawInput);
  if (!input) return 1;
  return executePhase697ArchitectureRecoveryProviderCanaryV2C2CliCore(
    {
      args: input.args,
      root: DEFAULT_ROOT,
      proxyEnv: snapshotTrustedProcessProxyEnvironment(),
      authorizationEnv: process.env,
      signal: input.signal,
    },
    PRODUCTION_PORTS,
  );
}

function readInput(value: unknown): Phase697ArchitectureRecoveryProviderCanaryV2C2CliInput | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== 2 ||
      keys.some((key) => typeof key !== 'string' || (key !== 'args' && key !== 'signal'))
    ) {
      return null;
    }
    const argsDescriptor = Reflect.getOwnPropertyDescriptor(value, 'args');
    const signalDescriptor = Reflect.getOwnPropertyDescriptor(value, 'signal');
    if (
      !argsDescriptor ||
      !('value' in argsDescriptor) ||
      !Array.isArray(argsDescriptor.value) ||
      argsDescriptor.value.some((entry) => typeof entry !== 'string') ||
      !signalDescriptor ||
      !('value' in signalDescriptor) ||
      !isAbortSignal(signalDescriptor.value)
    ) {
      return null;
    }
    return Object.freeze({
      args: Object.freeze(argsDescriptor.value.map((entry) => String(entry))),
      signal: signalDescriptor.value,
    });
  } catch {
    return null;
  }
}

function snapshotTrustedProcessProxyEnvironment(): Record<string, unknown> {
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const key of PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_ENV_KEYS) {
    try {
      const value = process.env[key];
      if (value === undefined) continue;
      Object.defineProperty(snapshot, key, {
        configurable: false,
        enumerable: true,
        value,
        writable: false,
      });
    } catch {
      Object.defineProperty(snapshot, key, {
        configurable: false,
        enumerable: true,
        value: null,
        writable: false,
      });
    }
  }
  return Object.freeze(snapshot);
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

if (import.meta.main) {
  process.exitCode = await runPhase697ArchitectureRecoveryProviderCanaryV2C2Cli({
    args: process.argv.slice(2),
    signal: new AbortController().signal,
  });
}
