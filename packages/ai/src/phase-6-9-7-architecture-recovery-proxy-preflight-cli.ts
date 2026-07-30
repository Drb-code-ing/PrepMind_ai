import { connect } from 'node:net';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_ENV_KEYS,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS,
  runPhase697ArchitectureRecoveryProxyPreflight,
  type Phase697ArchitectureRecoveryProxyPreflightDependencies,
  type Phase697ArchitectureRecoveryProxyPreflightResult,
} from './phase-6-9-7-architecture-recovery-proxy-preflight.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CLI_VERSION =
  'phase-6.9.7-architecture-recovery-proxy-preflight-cli-v1' as const;

export type Phase697ArchitectureRecoveryProxyPreflightCliInput = Readonly<{
  args: readonly string[];
  env: Record<string, unknown>;
  signal: AbortSignal;
}>;

type Phase697ArchitectureRecoveryProxyPreflightCliPorts = Readonly<{
  probeLoopbackListener: Phase697ArchitectureRecoveryProxyPreflightDependencies['probeLoopbackListener'];
  write(line: string): void;
}>;

const DEFAULT_PORTS: Phase697ArchitectureRecoveryProxyPreflightCliPorts = Object.freeze({
  probeLoopbackListener: probeLocalTcpListener,
  write: (line) => process.stdout.write(`${line}\n`),
});

/**
 * A zero-Provider diagnostic CLI. It accepts no arguments, reads no
 * credential, sends no payload, and never calls fetch.
 */
export async function runPhase697ArchitectureRecoveryProxyPreflightCli(
  rawInput: Phase697ArchitectureRecoveryProxyPreflightCliInput,
  rawPorts: Phase697ArchitectureRecoveryProxyPreflightCliPorts = DEFAULT_PORTS,
): Promise<0 | 1> {
  const input = readInput(rawInput);
  const ports = readPorts(rawPorts);
  if (!input || !ports || input.args.length !== 0) {
    safeWrite(
      ports?.write,
      JSON.stringify({
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CLI_VERSION,
        ok: false,
        code: 'proxy_preflight_cli_argument_invalid',
        providerCalls: 0,
      }),
    );
    return 1;
  }
  const report = await runPhase697ArchitectureRecoveryProxyPreflight(
    { env: input.env, signal: input.signal },
    { probeLoopbackListener: ports.probeLoopbackListener },
  );
  if (!safeWrite(ports.write, serializeReport(report))) return 1;
  return report.ok ? 0 : 1;
}

function serializeReport(report: Phase697ArchitectureRecoveryProxyPreflightResult) {
  return JSON.stringify({
    cliVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CLI_VERSION,
    ...report,
  });
}

async function probeLocalTcpListener(input: {
  host: '127.0.0.1' | '::1';
  port: number;
  timeoutMs: typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS;
  signal: AbortSignal;
}): Promise<boolean> {
  if (isAborted(input.signal)) return false;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const socket = connect({ host: input.host, port: input.port });
    const timer = setTimeout(() => finish(false), input.timeoutMs);
    const abort = () => finish(false);
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal.removeEventListener('abort', abort);
      socket.destroy();
      resolve(value);
    };
    input.signal.addEventListener('abort', abort, { once: true });
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function readInput(value: unknown): Phase697ArchitectureRecoveryProxyPreflightCliInput | null {
  const resolved = readExactOwnDataValues(value, ['args', 'env', 'signal']);
  if (
    !resolved ||
    !Array.isArray(resolved.args) ||
    resolved.args.some((entry) => typeof entry !== 'string') ||
    typeof resolved.env !== 'object' ||
    resolved.env === null ||
    Array.isArray(resolved.env) ||
    !isAbortSignal(resolved.signal)
  ) {
    return null;
  }
  return Object.freeze({
    args: Object.freeze(resolved.args.map((entry) => String(entry))),
    env: resolved.env as Record<string, unknown>,
    signal: resolved.signal,
  });
}

function readPorts(value: unknown): Phase697ArchitectureRecoveryProxyPreflightCliPorts | null {
  const resolved = readExactOwnDataValues(value, ['probeLoopbackListener', 'write']);
  if (
    !resolved ||
    typeof resolved.probeLoopbackListener !== 'function' ||
    typeof resolved.write !== 'function'
  ) {
    return null;
  }
  return Object.freeze({
    probeLoopbackListener:
      resolved.probeLoopbackListener as Phase697ArchitectureRecoveryProxyPreflightCliPorts['probeLoopbackListener'],
    write: resolved.write as Phase697ArchitectureRecoveryProxyPreflightCliPorts['write'],
  });
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
    const resolved = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return null;
      resolved[key] = descriptor.value;
    }
    return resolved;
  } catch {
    return null;
  }
}

function safeWrite(write: ((line: string) => void) | undefined, line: string) {
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

function isAborted(signal: AbortSignal) {
  try {
    return signal.aborted === true;
  } catch {
    return true;
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

if (import.meta.main) {
  process.exitCode = await runPhase697ArchitectureRecoveryProxyPreflightCli({
    args: process.argv.slice(2),
    env: snapshotTrustedProcessProxyEnvironment(),
    signal: new AbortController().signal,
  });
}
