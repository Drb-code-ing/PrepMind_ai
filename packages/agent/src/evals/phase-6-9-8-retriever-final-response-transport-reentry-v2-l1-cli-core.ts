import {
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_AUTHORITY,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_EXACT_ARGUMENT,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_GATE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_REPORT_SCHEMA,
  type Phase698TransportReentryV2L1AdmissionResult,
  type Phase698TransportReentryV2L1Preflight,
  type Phase698TransportReentryV2L1Ports,
  type Phase698TransportReentryV2L1Report,
  type Phase698TransportReentryV2L1Source,
} from './phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-contract.ts';
import type { Phase698TransportReentryV2L1Reservation } from './phase-6-9-8-retriever-final-response-transport-reentry-v2-l1.ts';

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_CLI_VERSION =
  'phase-6.9.8-retriever-final-response-transport-reentry-v2-l1-cli-v1' as const;

type Awaitable<T> = T | Promise<T>;

export type Phase698TransportReentryV2L1CliInput = Readonly<{
  args: readonly string[];
  root: string;
  proxyEnv: Readonly<Record<string, unknown>>;
  signal: AbortSignal;
}>;

export type Phase698TransportReentryV2L1CliPorts = Readonly<{
  readSource(root: string): Phase698TransportReentryV2L1AdmissionResult;
  runProxyPreflight(input: {
    env: Readonly<Record<string, unknown>>;
    signal: AbortSignal;
  }): Promise<unknown>;
  readDataBoundary(): true;
  readAuthorization(): true;
  prepareProjection(input: {
    source: Phase698TransportReentryV2L1Source;
    proxy: Phase698TransportReentryV2L1Preflight['proxy'];
    signal: AbortSignal;
  }): Awaitable<unknown>;
  composePorts(
    projection: unknown,
  ):
    | { ok: true; ports: Phase698TransportReentryV2L1Ports }
    | { ok: false; reasonCode: 'configuration' };
  reserve(input: {
    root: string;
    admissionCapability: unknown;
    source: Phase698TransportReentryV2L1Source;
  }): Promise<Phase698TransportReentryV2L1Reservation>;
  runLive(input: {
    reservation: Phase698TransportReentryV2L1Reservation;
    ports: Phase698TransportReentryV2L1Ports;
    signal: AbortSignal;
  }): Promise<
    Readonly<{
      report: Phase698TransportReentryV2L1Report;
      validation: {
        ok: boolean;
        journalRecords: number;
        reportLogicalSha256: string | null;
        physicalArtifactSha256: string | null;
      };
      recoveryRequired: boolean;
    }>
  >;
  validate(root: string): Promise<{
    ok: boolean;
    journalRecords: number;
    reportLogicalSha256: string | null;
    physicalArtifactSha256: string | null;
  }>;
  randomUUID(): string;
  write(line: string): void;
}>;

const REQUIRED_INPUT_KEYS = ['args', 'proxyEnv', 'root', 'signal'] as const;
const REQUIRED_PORT_KEYS = [
  'readSource',
  'runProxyPreflight',
  'readDataBoundary',
  'readAuthorization',
  'prepareProjection',
  'composePorts',
  'reserve',
  'runLive',
  'validate',
  'randomUUID',
  'write',
] as const;

export async function executePhase698TransportReentryV2L1CliCore(
  rawInput: unknown,
  rawPorts: unknown,
): Promise<0 | 1> {
  const input = readInput(rawInput);
  const ports = readPorts(rawPorts);
  const blocked = (code: string, details: Readonly<Record<string, unknown>> = {}) => {
    safeWrite(
      ports?.write,
      JSON.stringify({
        version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_CLI_VERSION,
        operation: 'controlled_canary',
        ok: false,
        evidenceSealed: false,
        authority: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_AUTHORITY,
        qualityAuthority: 'none',
        providerCalls: 0,
        credentialReads: 0,
        code,
        ...details,
      }),
    );
    return 1 as const;
  };
  if (!input || !ports) return blocked('input_or_ports_invalid');
  if (!hasExactArgument(input.args)) return blocked('cli_argument_invalid');
  if (input.signal.aborted) return blocked('aborted_before_source');

  let admission: Extract<Phase698TransportReentryV2L1AdmissionResult, { ok: true }>;
  try {
    const candidate = ports.readSource(input.root);
    if (!candidate.ok || candidate.authority !== 'git_verified') throw new Error();
    admission = candidate;
  } catch {
    return blocked('source_admission_invalid');
  }
  if (input.signal.aborted) return blocked('aborted_after_source');

  let proxy: Phase698TransportReentryV2L1Preflight['proxy'];
  try {
    const candidate = await ports.runProxyPreflight({ env: input.proxyEnv, signal: input.signal });
    proxy = parseProxy(candidate);
  } catch {
    return blocked('proxy_preflight_not_ready');
  }
  if (input.signal.aborted) return blocked('aborted_after_proxy_preflight');
  try {
    ports.readDataBoundary();
  } catch {
    return blocked('data_boundary_not_accepted');
  }
  if (input.signal.aborted) return blocked('aborted_after_data_boundary');
  try {
    ports.readAuthorization();
  } catch {
    return blocked('exact_authorization_invalid');
  }
  if (input.signal.aborted) return blocked('aborted_before_configuration');

  let projection: unknown;
  try {
    projection = await ports.prepareProjection({
      source: admission.source,
      proxy,
      signal: input.signal,
    });
  } catch {
    return blocked('credential_configuration_invalid');
  }
  const composed = ports.composePorts(projection);
  if (!composed.ok) return blocked('configuration_invalid');
  if (input.signal.aborted) return blocked('aborted_before_reservation');

  let reservation: Phase698TransportReentryV2L1Reservation;
  try {
    reservation = await ports.reserve({
      root: input.root,
      admissionCapability: admission.c2Admission.capability,
      source: admission.source,
    });
  } catch {
    return blocked('reservation_failed');
  }
  if (input.signal.aborted)
    return blocked('aborted_after_reservation', {
      reservationConsumed: true,
      reservationRunId: reservation.runId,
      crashOnlySealRequired: true,
    });

  let runtime: Readonly<{
    report: Phase698TransportReentryV2L1Report;
    validation: {
      ok: boolean;
      journalRecords: number;
      reportLogicalSha256: string | null;
      physicalArtifactSha256: string | null;
    };
    recoveryRequired: boolean;
  }>;
  try {
    runtime = await ports.runLive({ reservation, ports: composed.ports, signal: input.signal });
    PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_REPORT_SCHEMA.parse(runtime.report);
  } catch {
    return blocked('controlled_runtime_failed', {
      reservationConsumed: true,
      reservationRunId: reservation.runId,
      crashOnlySealRequired: true,
    });
  }
  try {
    const validation = runtime.validation.ok
      ? runtime.validation
      : await ports.validate(input.root);
    if (!validation.ok) throw new Error();
    const report = runtime.report;
    const output = {
      version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_CLI_VERSION,
      operation: 'controlled_canary',
      ok: report.gate === PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_GATE,
      evidenceSealed: true,
      authority: report.authority,
      qualityAuthority: report.qualityAuthority,
      runId: reservation.runId,
      sourceCommit: admission.source.commit,
      proxy: { code: proxy.code, providerCalls: 0, listenerProbeCalls: proxy.listenerProbeCalls },
      gate: report.gate,
      passed: report.passed,
      slotOrder: report.slotOrder,
      slots: report.slots.map((slot) => ({
        slot: slot.slot,
        sequence: slot.sequence,
        disposition: slot.disposition,
        failureCode: slot.failureCode,
        runnerWire: slot.runnerWire,
        providerWire: slot.providerWire,
        providerCalls: slot.providerCalls,
        credentialReads: slot.credentialReads,
        usage: slot.usage,
        verifiedCostCny: slot.verifiedCostCny,
        durationMs: slot.durationMs,
        diagnostic: slot.diagnostic,
      })),
      breaker: report.breaker,
      providerCalls: report.providerCalls,
      credentialReads: report.credentialReads,
      verifiedUsageSlots: report.verifiedUsageSlots,
      verifiedCostCny: report.verifiedCostCny,
      budgetCnyMax: report.budgetCnyMax,
      journalRecords: validation.journalRecords,
      reportLogicalSha256: validation.reportLogicalSha256,
      artifactSha256: validation.physicalArtifactSha256,
      recoveryRequired: runtime.recoveryRequired,
    };
    if (!safeWrite(ports.write, JSON.stringify(output))) return 1;
    return report.passed ? 0 : 1;
  } catch {
    return blocked('evidence_publication_failed', {
      reservationConsumed: true,
      reservationRunId: reservation.runId,
      crashOnlySealRequired: true,
    });
  }
}

function parseProxy(value: unknown): Phase698TransportReentryV2L1Preflight['proxy'] {
  if (typeof value !== 'object' || value === null) throw new Error();
  const candidate = value as Record<string, unknown>;
  if (
    candidate.ok !== true ||
    (candidate.code !== 'direct_ready' && candidate.code !== 'loopback_proxy_ready') ||
    candidate.providerCalls !== 0 ||
    (candidate.listenerProbeCalls !== 0 && candidate.listenerProbeCalls !== 1)
  )
    throw new Error();
  return Object.freeze({
    code: candidate.code,
    providerCalls: 0 as const,
    listenerProbeCalls: candidate.listenerProbeCalls,
  });
}
function hasExactArgument(args: readonly string[]) {
  return args.length === 1 && args[0] === PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_EXACT_ARGUMENT;
}
function readInput(value: unknown): Phase698TransportReentryV2L1CliInput | null {
  const fields = readExact(value, REQUIRED_INPUT_KEYS);
  if (
    !fields ||
    !Array.isArray(fields.args) ||
    fields.args.some((item) => typeof item !== 'string') ||
    typeof fields.root !== 'string' ||
    fields.root.length === 0 ||
    !isRecord(fields.proxyEnv) ||
    !isAbortSignal(fields.signal)
  )
    return null;
  return Object.freeze({
    args: Object.freeze(fields.args.map(String)),
    root: fields.root,
    proxyEnv: fields.proxyEnv,
    signal: fields.signal,
  });
}
function readPorts(value: unknown): Phase698TransportReentryV2L1CliPorts | null {
  const fields = readExact(value, REQUIRED_PORT_KEYS);
  if (!fields || Object.values(fields).some((item) => typeof item !== 'function')) return null;
  return Object.freeze(fields as unknown as Phase698TransportReentryV2L1CliPorts);
}
function readExact(value: unknown, keys: readonly string[]) {
  if (!isRecord(value)) return null;
  const own = Reflect.ownKeys(value);
  if (
    own.length !== keys.length ||
    own.some((key) => typeof key !== 'string' || !keys.includes(key))
  )
    return null;
  const output = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) return null;
    output[key] = descriptor.value;
  }
  return output;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isAbortSignal(value: unknown): value is AbortSignal {
  return typeof AbortSignal !== 'undefined' && value instanceof AbortSignal;
}
function safeWrite(write: ((line: string) => void) | undefined, line: string) {
  try {
    if (!write || line.length > 32_768) return false;
    write(line);
    return true;
  } catch {
    return false;
  }
}
