import { randomUUID } from 'node:crypto';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_ENV_KEYS,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS,
  runPhase697ArchitectureRecoveryProxyPreflight,
} from '@repo/ai';
import { PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS } from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.ts';
import {
  inspectPhase698TransportReentryV2Preflight,
  projectPhase698TransportReentryV2DedicatedCapabilities,
  readPhase698TransportReentryV2RootDotEnv,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_ZERO_PROVIDER_ARGUMENT,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_DATA_BOUNDARY_ACCEPTANCE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_EXACT_AUTHORIZATION,
  type Phase698TransportReentryV2Projection,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts';
import {
  inspectPhase698TransportReentryV2L1SourceAdmission,
  type Phase698TransportReentryV2L1Ports,
  type Phase698TransportReentryV2L1Preflight,
  type Phase698TransportReentryV2L1Source,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-contract.ts';
import {
  createPhase698TransportReentryV2L1LivePorts,
  reservePhase698TransportReentryV2L1Attempt,
  runPhase698TransportReentryV2L1,
  validatePhase698TransportReentryV2L1Bundle,
  type Phase698TransportReentryV2L1Reservation,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1.ts';
import {
  executePhase698TransportReentryV2L1CliCore,
  type Phase698TransportReentryV2L1CliPorts,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-cli-core.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

type ProxyPreflightResult = Readonly<{
  ok: boolean;
  code: string;
  listenerProbeCalls: 0 | 1;
  providerCalls: 0;
}>;

const PRODUCTION_PORTS: Phase698TransportReentryV2L1CliPorts = Object.freeze({
  readSource: inspectPhase698TransportReentryV2L1SourceAdmission,
  runProxyPreflight: async ({
    env,
    signal,
  }: {
    env: Readonly<Record<string, unknown>>;
    signal: AbortSignal;
  }): Promise<ProxyPreflightResult> => {
    const result = await runPhase697ArchitectureRecoveryProxyPreflight(
      { env: snapshotProxyEnv(env), signal },
      { probeLoopbackListener },
    );
    return Object.freeze({
      ok: result.ok,
      code: result.code,
      listenerProbeCalls: result.listenerProbeCalls,
      providerCalls: result.providerCalls,
    });
  },
  readDataBoundary: () => true,
  readAuthorization: () => true,
  prepareProjection: async ({
    source,
    proxy,
  }: {
    source: Phase698TransportReentryV2L1Source;
    proxy: Phase698TransportReentryV2L1Preflight['proxy'];
    signal: AbortSignal;
  }) => {
    const c1Source = {
      lineage: source.lineage,
      branch: source.branch,
      commit: source.commit,
      trackingCommit: source.trackingCommit,
      remoteCommit: source.remoteCommit,
      approvedSourceCommit: source.approvedSourceCommit,
      workingTreeClean: true as const,
      formalArtifactCount: 0 as const,
      t2Gate: source.t2Gate,
      t3cGate: source.t3cGate,
    };
    const preflight = inspectPhase698TransportReentryV2Preflight({
      args: [PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_ZERO_PROVIDER_ARGUMENT],
      source: c1Source,
      proxy,
      dataBoundary: PHASE_6_9_8_TRANSPORT_REENTRY_V2_DATA_BOUNDARY_ACCEPTANCE,
      authorization: PHASE_6_9_8_TRANSPORT_REENTRY_V2_EXACT_AUTHORIZATION,
    });
    if (!preflight.ok) throw new Error('L1_C1_GATE_INVALID');
    const parsed = readPhase698TransportReentryV2RootDotEnv(import.meta.url, (path) =>
      readFileSync(path),
    );
    if (!parsed.ok) throw new Error('L1_ROOT_ENV_INVALID');
    const projection = projectPhase698TransportReentryV2DedicatedCapabilities(
      preflight.capability,
      parsed.values,
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS,
    );
    if (!projection.ok) throw new Error('L1_PROJECTION_INVALID');
    return projection.projection;
  },
  composePorts: (projection: unknown) => {
    if (!isProjectionShape(projection))
      return { ok: false as const, reasonCode: 'configuration' as const };
    return createPhase698TransportReentryV2L1LivePorts(projection);
  },
  reserve: ({
    root,
    admissionCapability,
    source,
  }: {
    root: string;
    admissionCapability: unknown;
    source: Phase698TransportReentryV2L1Source;
  }) => reservePhase698TransportReentryV2L1Attempt({ root, admissionCapability, source }),
  runLive: ({
    reservation,
    ports,
    signal,
  }: {
    reservation: Phase698TransportReentryV2L1Reservation;
    ports: Phase698TransportReentryV2L1Ports;
    signal: AbortSignal;
  }) => runPhase698TransportReentryV2L1({ reservation, ports, signal }),
  validate: async (root: string) => validatePhase698TransportReentryV2L1Bundle(root),
  randomUUID,
  write: (line: string) => process.stdout.write(`${line}\n`),
});

export async function runPhase698TransportReentryV2L1Cli(
  input: Readonly<{ args: readonly string[]; signal: AbortSignal }>,
) {
  if (!isCliInput(input)) return 1 as const;
  return executePhase698TransportReentryV2L1CliCore(
    {
      args: input.args,
      root: REPOSITORY_ROOT,
      proxyEnv: snapshotProxyEnv(process.env),
      signal: input.signal,
    },
    PRODUCTION_PORTS,
  );
}

function snapshotProxyEnv(env: Readonly<Record<string, unknown>>) {
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_ENV_KEYS) {
    const descriptor = Reflect.getOwnPropertyDescriptor(env, key);
    if (descriptor && 'value' in descriptor) result[key] = descriptor.value;
  }
  return Object.freeze(result);
}

function isProjectionShape(value: unknown): value is Phase698TransportReentryV2Projection {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== 4 ||
    record.lineage !== 'phase-6.9.8-retriever-final-response-transport-reentry-v2'
  )
    return false;
  for (const family of ['rewrite', 'qwen', 'final_response'] as const) {
    const capability = record[family];
    if (typeof capability !== 'object' || capability === null || Array.isArray(capability))
      return false;
    const candidate = capability as Record<string, unknown>;
    if (
      Object.keys(candidate).length !== 4 ||
      candidate.version !==
        'phase-6.9.8-retriever-final-response-transport-reentry-v2-dedicated-capability-v1' ||
      candidate.lineage !== record.lineage ||
      candidate.family !== family ||
      typeof candidate.callId !== 'string'
    )
      return false;
  }
  return true;
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

function isCliInput(
  value: unknown,
): value is Readonly<{ args: readonly string[]; signal: AbortSignal }> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 2 ||
    keys.some((key) => typeof key !== 'string' || !['args', 'signal'].includes(key))
  )
    return false;
  const args = Reflect.getOwnPropertyDescriptor(value, 'args');
  const signal = Reflect.getOwnPropertyDescriptor(value, 'signal');
  return (
    !!args &&
    'value' in args &&
    Array.isArray(args.value) &&
    args.value.every((item) => typeof item === 'string') &&
    !!signal &&
    'value' in signal &&
    signal.value instanceof AbortSignal
  );
}

if (import.meta.main) {
  process.exitCode = await runPhase698TransportReentryV2L1Cli({
    args: process.argv.slice(2),
    signal: new AbortController().signal,
  });
}
