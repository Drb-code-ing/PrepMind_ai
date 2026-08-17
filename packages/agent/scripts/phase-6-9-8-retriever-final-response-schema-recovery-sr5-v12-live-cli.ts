import { connect } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
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
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-cli-core.ts';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const directHostReentryKey =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V12_DIRECT_HOST_REENTRY';
const proxyEnvironmentNames = new Set(['http_proxy', 'https_proxy', 'all_proxy', 'no_proxy']);

export function runPhase698RetrieverSchemaRecoverySr5V12LiveCli(
  input: Phase698RetrieverSchemaRecoverySr5LiveCliInput,
) {
  return executePhase698RetrieverSchemaRecoverySr5LiveCliCore(input, PRODUCTION_PORTS);
}

const PRODUCTION_PORTS = Object.freeze({
  runProxyPreflight: ({ env, signal }) =>
    runPhase697ArchitectureRecoveryProxyPreflight(
      { env: snapshotPhase698RetrieverSchemaRecoverySr5V12LiveProxyEnv(env), signal },
      { probeLoopbackListener },
    ),
} satisfies Partial<Phase698RetrieverSchemaRecoverySr5LiveCliPorts>);

if (import.meta.main) {
  if (process.env[directHostReentryKey] === '1') {
    process.exitCode = await runPhase698RetrieverSchemaRecoverySr5V12LiveCli({
      args: process.argv.slice(2),
      root: repositoryRoot,
      proxyEnv: snapshotPhase698RetrieverSchemaRecoverySr5V12LiveProxyEnv(process.env),
      authorizationEnv: snapshotPhase698RetrieverSchemaRecoverySr5V12LiveAuthorizationEnv(
        process.env,
      ),
      signal: new AbortController().signal,
    });
  } else {
    try {
      const child = spawn(
        process.execPath,
        ['--no-env-file', fileURLToPath(import.meta.url), ...process.argv.slice(2)],
        {
          cwd: repositoryRoot,
          env: createPhase698RetrieverSchemaRecoverySr5V12DirectHostProcessEnv(process.env),
          stdio: 'inherit',
          windowsHide: true,
        },
      );
      const [exitCode] = (await once(child, 'exit')) as [number | null, NodeJS.Signals | null];
      process.exitCode = exitCode ?? 1;
    } catch {
      console.error(
        JSON.stringify({
          version: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-cli-v3',
          ok: false,
          authority: 'controlled_live_retriever_final_response_schema_recovery_sr5_v12',
          qualityAuthority: 'none',
          providerCalls: 0,
          credentialReads: 0,
          businessWrites: 0,
          formalEvidence: 0,
          code: 'direct_host_reentry_failed',
        }),
      );
      process.exitCode = 1;
    }
  }
}

export function createPhase698RetrieverSchemaRecoverySr5V12DirectHostProcessEnv(
  env: Readonly<Record<string, unknown>>,
) {
  const result = Object.create(null) as Record<string, string>;
  for (const key of Reflect.ownKeys(env)) {
    if (typeof key !== 'string' || proxyEnvironmentNames.has(key.toLowerCase())) continue;
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
      // Unreadable ambient values are not required by the isolated child.
    }
  }
  result[directHostReentryKey] = '1';
  return Object.freeze(result);
}

export function snapshotPhase698RetrieverSchemaRecoverySr5V12LiveProxyEnv(
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

export function snapshotPhase698RetrieverSchemaRecoverySr5V12LiveAuthorizationEnv(
  env: Readonly<Record<string, unknown>>,
) {
  const result = Object.create(null) as Record<string, string | undefined>;
  for (const key of [
    'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V12_DATA_BOUNDARY_ACCEPTED',
    'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V12_APPROVED',
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
