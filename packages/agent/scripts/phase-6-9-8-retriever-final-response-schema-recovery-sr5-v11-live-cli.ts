import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_ENV_KEYS,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS,
  runPhase697ArchitectureRecoveryProxyPreflight,
} from '@repo/ai';

import {
  executePhase698RetrieverSchemaRecoverySr5LiveCliCore,
  type Phase698RetrieverSchemaRecoverySr5LiveCliInput,
  type Phase698RetrieverSchemaRecoverySr5LiveCliPorts,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v11-live-cli-core.ts';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));

export function runPhase698RetrieverSchemaRecoverySr5V11LiveCli(
  input: Phase698RetrieverSchemaRecoverySr5LiveCliInput,
) {
  return executePhase698RetrieverSchemaRecoverySr5LiveCliCore(input, PRODUCTION_PORTS);
}

const PRODUCTION_PORTS = Object.freeze({
  runProxyPreflight: ({ env, signal }) =>
    runPhase697ArchitectureRecoveryProxyPreflight(
      { env: snapshotPhase698RetrieverSchemaRecoverySr5V11LiveProxyEnv(env), signal },
      { probeLoopbackListener },
    ),
} satisfies Partial<Phase698RetrieverSchemaRecoverySr5LiveCliPorts>);

if (import.meta.main) {
  process.exitCode = await runPhase698RetrieverSchemaRecoverySr5V11LiveCli({
    args: process.argv.slice(2),
    root: repositoryRoot,
    proxyEnv: snapshotPhase698RetrieverSchemaRecoverySr5V11LiveProxyEnv(process.env),
    authorizationEnv: snapshotPhase698RetrieverSchemaRecoverySr5V11LiveAuthorizationEnv(
      process.env,
    ),
    signal: new AbortController().signal,
  });
}

export function snapshotPhase698RetrieverSchemaRecoverySr5V11LiveProxyEnv(
  env: Readonly<Record<string, unknown>>,
) {
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_ENV_KEYS) {
    try {
      const descriptor = Reflect.getOwnPropertyDescriptor(env, key);
      if (!descriptor) continue;
      const value =
        'value' in descriptor
          ? descriptor.value
          : typeof descriptor.get === 'function'
            ? Reflect.apply(descriptor.get, env, [])
            : undefined;
      if (value === undefined) continue;
      Object.defineProperty(result, key, {
        configurable: false,
        enumerable: true,
        value,
        writable: false,
      });
    } catch {
      Object.defineProperty(result, key, {
        configurable: false,
        enumerable: true,
        value: undefined,
        writable: false,
      });
    }
  }
  return Object.freeze(result);
}

export function snapshotPhase698RetrieverSchemaRecoverySr5V11LiveAuthorizationEnv(
  env: Readonly<Record<string, unknown>>,
) {
  const result = Object.create(null) as Record<string, string | undefined>;
  for (const key of [
    'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_ACCEPTED',
    'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_APPROVED',
  ]) {
    try {
      const descriptor = Reflect.getOwnPropertyDescriptor(env, key);
      if (!descriptor) continue;
      const value =
        'value' in descriptor
          ? descriptor.value
          : typeof descriptor.get === 'function'
            ? Reflect.apply(descriptor.get, env, [])
            : undefined;
      if (typeof value === 'string') result[key] = value;
    } catch {
      // Accessor failures remain absent and cannot be evaluated twice.
    }
  }
  return Object.freeze(result);
}

async function probeLoopbackListener(input: {
  host: '127.0.0.1' | '::1';
  port: number;
  timeoutMs: typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS;
  signal: AbortSignal;
}) {
  if (input.signal.aborted) return false;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const socket = connect({ host: input.host, port: input.port });
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal.removeEventListener('abort', abort);
      socket.destroy();
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), input.timeoutMs);
    const abort = () => finish(false);
    input.signal.addEventListener('abort', abort, { once: true });
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}
