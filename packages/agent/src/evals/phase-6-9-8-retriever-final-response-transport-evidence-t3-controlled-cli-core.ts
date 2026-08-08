import { z } from 'zod';

import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_EXACT_AUTHORIZATION,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_SCHEMA,
  consumePhase698TransportEvidenceT3AdmissionCapability,
  parsePhase698TransportEvidenceT3ProxyReceipt,
  readPhase698TransportEvidenceT3Approval,
  readPhase698TransportEvidenceT3DataBoundary,
  validatePhase698TransportEvidenceT3GateBinding,
  type Phase698TransportEvidenceT3AdmissionResult,
  type Phase698TransportEvidenceT3ProxyReceipt,
} from './phase-6-9-8-retriever-final-response-transport-evidence-t3-admission.ts';
import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_AUTHORITY,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_GATE,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_REPORT_SCHEMA,
  type Phase698TransportEvidenceT3ControlledCredentials,
  type Phase698TransportEvidenceT3ControlledReport,
} from './phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-live.ts';
import type { Phase698TransportEvidenceT3ControlledReservation } from './phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-durability.ts';

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_CLI_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t3-controlled-cli-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_ARGUMENT =
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_EXACT_AUTHORIZATION;

export type Phase698TransportEvidenceT3ControlledCliInput = Readonly<{
  args: readonly string[];
  root: string;
  proxyEnv: Readonly<Record<string, unknown>>;
  authorizationEnv: Readonly<Record<string, string | undefined>>;
  signal: AbortSignal;
}>;

type LiveAdmission = Extract<Phase698TransportEvidenceT3AdmissionResult, { ok: true }>;

export type Phase698TransportEvidenceT3ControlledCliPorts = Readonly<{
  readSource(root: string): Phase698TransportEvidenceT3AdmissionResult;
  readT2Gate(): unknown;
  runProxyPreflight(input: {
    env: Readonly<Record<string, unknown>>;
    signal: AbortSignal;
    nonce: string;
  }): Promise<unknown>;
  readDataBoundary(env: Readonly<Record<string, string | undefined>>): true;
  readApproval(env: Readonly<Record<string, string | undefined>>): true;
  readCredentials(
    env: Readonly<Record<string, string | undefined>>,
  ):
    | Phase698TransportEvidenceT3ControlledCredentials
    | Promise<Phase698TransportEvidenceT3ControlledCredentials>;
  reserve(input: {
    root: string;
    runId: string;
    createdAt: string;
    source: LiveAdmission['source'];
    proxy: Phase698TransportEvidenceT3ProxyReceipt;
    reservationCapability: LiveAdmission['reservationCapability'];
  }): Promise<Phase698TransportEvidenceT3ControlledReservation>;
  runLive(input: {
    runId: string;
    credentials: Phase698TransportEvidenceT3ControlledCredentials;
    signal: AbortSignal;
    onSlotTerminal(
      slot: Phase698TransportEvidenceT3ControlledReport['slots'][number],
    ): Promise<void>;
  }): Promise<Phase698TransportEvidenceT3ControlledReport>;
  validate(input: { root: string }): Promise<
    Readonly<{
      ok: boolean;
      runId: string | null;
      gate?: string | null;
      qualityAuthority?: string | null;
      journalRecords?: number;
      finalJournalEvent?: string | null;
      reportLogicalSha256?: string | null;
      physicalArtifactSha256?: string | null;
      providerCalls?: number;
      credentialReads?: number;
    }>
  >;
  randomUUID(): string;
  now(): number;
  write(line: string): void;
}>;

const UUID = z.string().uuid();
const REQUIRED_INPUT_KEYS = ['args', 'authorizationEnv', 'proxyEnv', 'root', 'signal'] as const;
const PORT_KEYS = [
  'readSource',
  'readT2Gate',
  'runProxyPreflight',
  'readDataBoundary',
  'readApproval',
  'readCredentials',
  'reserve',
  'runLive',
  'validate',
  'randomUUID',
  'now',
  'write',
] as const;

/**
 * The only production gate for the T3 controlled canary. No credential port is
 * touched until source, T2, fresh proxy, data-boundary, exact authorization and
 * durable reservation all succeed.
 */
export async function executePhase698TransportEvidenceT3ControlledCliCore(
  rawInput: unknown,
  rawPorts: unknown,
): Promise<0 | 1> {
  const input = readInput(rawInput);
  const ports = readPorts(rawPorts);
  const blocked = (code: string, details: Readonly<Record<string, unknown>> = {}) => {
    safeWrite(
      ports?.write,
      JSON.stringify({
        version: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_CLI_VERSION,
        operation: 'controlled_live',
        ok: false,
        evidenceSealed: false,
        authority: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_AUTHORITY,
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
  if (!hasExactArgument(input.args, PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_ARGUMENT)) {
    return blocked('cli_argument_invalid');
  }
  if (isAborted(input.signal)) return blocked('aborted_before_source');

  let admission: LiveAdmission;
  try {
    const candidate = ports.readSource(input.root);
    if (!isAdmission(candidate) || candidate.authority !== 'controlled_live') throw new Error();
    PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_SCHEMA.parse(candidate.source);
    admission = candidate;
  } catch {
    return blocked('source_admission_invalid');
  }
  if (isAborted(input.signal)) return blocked('aborted_after_source');

  try {
    if (!validatePhase698TransportEvidenceT3GateBinding(ports.readT2Gate())) throw new Error();
    const issued = consumePhase698TransportEvidenceT3AdmissionCapability(
      admission.capability,
      'controlled_live',
    );
    if (issued.source !== admission.source) throw new Error();
  } catch {
    return blocked('t2_gate_or_capability_invalid');
  }
  if (isAborted(input.signal)) return blocked('aborted_after_t2_gate');

  const nonce = await safeNonce(ports.randomUUID);
  if (nonce === null) return blocked('preflight_nonce_invalid');
  let proxy: Phase698TransportEvidenceT3ProxyReceipt | null = null;
  try {
    proxy = parsePhase698TransportEvidenceT3ProxyReceipt(
      await runBoundedProxyPreflight(ports.runProxyPreflight, {
        env: input.proxyEnv,
        signal: input.signal,
        nonce,
      }),
      nonce,
    );
  } catch {
    proxy = null;
  }
  if (!proxy) return blocked('proxy_preflight_not_ready');
  if (isAborted(input.signal)) return blocked('aborted_after_proxy_preflight');

  try {
    ports.readDataBoundary(input.authorizationEnv);
  } catch {
    return blocked('data_boundary_not_accepted');
  }
  if (isAborted(input.signal)) return blocked('aborted_after_data_boundary');
  try {
    ports.readApproval(input.authorizationEnv);
  } catch {
    return blocked('exact_authorization_invalid');
  }
  if (isAborted(input.signal)) return blocked('aborted_before_reservation');

  const runId = await safeUuid(ports.randomUUID);
  const createdAt = safeDate(ports.now);
  if (runId === null || createdAt === null) return blocked('reservation_metadata_invalid');
  let reservation: Phase698TransportEvidenceT3ControlledReservation;
  try {
    reservation = await ports.reserve({
      root: input.root,
      runId,
      createdAt,
      source: admission.source,
      proxy,
      reservationCapability: admission.reservationCapability,
    });
  } catch {
    return blocked('reservation_failed');
  }

  // Credential reads are intentionally late-bound, after the one-shot marker and
  // journal reservation exist. The values never enter output or evidence.
  let credentials: Phase698TransportEvidenceT3ControlledCredentials;
  try {
    credentials = await ports.readCredentials(input.authorizationEnv);
  } catch {
    return blocked('credential_configuration_invalid', {
      reservationConsumed: true,
      reservationRunId: runId,
      crashOnlySealRequired: true,
    });
  }
  if (isAborted(input.signal)) {
    return blocked('aborted_after_reservation', {
      reservationConsumed: true,
      reservationRunId: runId,
      crashOnlySealRequired: true,
    });
  }

  let report: Phase698TransportEvidenceT3ControlledReport;
  try {
    report = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_REPORT_SCHEMA.parse(
      await ports.runLive({
        runId,
        credentials,
        signal: input.signal,
        onSlotTerminal: (slot) => reservation.appendSlotTerminal(slot),
      }),
    );
    if (report.authority !== PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_AUTHORITY)
      throw new Error();
  } catch {
    return blocked('controlled_runtime_failed', {
      reservationConsumed: true,
      reservationRunId: runId,
      crashOnlySealRequired: true,
    });
  }

  try {
    await reservation.appendRunTerminal(report);
    const published = await reservation.publishArtifact(report);
    const validation = await ports.validate({ root: input.root });
    if (!validation.ok || validation.runId !== runId) throw new Error();
    const output = {
      version: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_CLI_VERSION,
      operation: 'controlled_live',
      ok: report.gate === PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_GATE,
      evidenceSealed: true,
      authority: report.authority,
      qualityAuthority: report.qualityAuthority,
      runId,
      sourceCommit: admission.source.commit,
      proxy: {
        code: proxy.code,
        mode: proxy.mode,
        listener: proxy.listener,
        listenerProbeCalls: proxy.listenerProbeCalls,
        providerCalls: proxy.providerCalls,
      },
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
      journalRecords: validation.journalRecords ?? null,
      finalJournalEvent: validation.finalJournalEvent ?? null,
      reportLogicalSha256: validation.reportLogicalSha256 ?? null,
      artifactSha256: published.evidenceSha256,
    };
    if (!safeWrite(ports.write, JSON.stringify(output))) return 1;
    return report.gate === PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_GATE ? 0 : 1;
  } catch {
    return blocked('evidence_publication_failed', {
      reservationConsumed: true,
      reservationRunId: runId,
      crashOnlySealRequired: true,
    });
  }
}

export function readPhase698TransportEvidenceT3ControlledDataBoundary(
  env: Readonly<Record<string, string | undefined>>,
): true {
  return readPhase698TransportEvidenceT3DataBoundary(env);
}

export function readPhase698TransportEvidenceT3ControlledApproval(
  env: Readonly<Record<string, string | undefined>>,
): true {
  return readPhase698TransportEvidenceT3Approval(env);
}

function readInput(value: unknown): Phase698TransportEvidenceT3ControlledCliInput | null {
  const fields = readExactOwnData(value, REQUIRED_INPUT_KEYS);
  if (
    !fields ||
    !Array.isArray(fields.args) ||
    fields.args.some((item) => typeof item !== 'string') ||
    typeof fields.root !== 'string' ||
    fields.root.length === 0 ||
    !isRecord(fields.proxyEnv) ||
    !isRecord(fields.authorizationEnv) ||
    !isAbortSignal(fields.signal)
  )
    return null;
  return Object.freeze({
    args: Object.freeze(fields.args.map(String)),
    root: fields.root,
    proxyEnv: fields.proxyEnv,
    authorizationEnv: fields.authorizationEnv as Record<string, string | undefined>,
    signal: fields.signal,
  });
}

function readPorts(value: unknown): Phase698TransportEvidenceT3ControlledCliPorts | null {
  const fields = readExactOwnData(value, PORT_KEYS);
  if (!fields || Object.values(fields).some((field) => typeof field !== 'function')) return null;
  return Object.freeze(fields as unknown as Phase698TransportEvidenceT3ControlledCliPorts);
}

function isAdmission(value: unknown): value is LiveAdmission {
  try {
    const fields = readExactOwnData(value, [
      'ok',
      'authority',
      'source',
      'capability',
      'reservationCapability',
    ]);
    return (
      !!fields &&
      fields.ok === true &&
      fields.authority === 'controlled_live' &&
      isRecord(fields.source) &&
      isRecord(fields.capability) &&
      isRecord(fields.reservationCapability)
    );
  } catch {
    return false;
  }
}

function readExactOwnData(value: unknown, expectedKeys: readonly string[]) {
  try {
    if (!isRecord(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    )
      return null;
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

function safeWrite(write: ((line: string) => void) | undefined, line: string) {
  try {
    if (!write || line.length > 32_768) return false;
    write(line);
    return true;
  } catch {
    return false;
  }
}

async function safeNonce(factory: () => string) {
  try {
    return UUID.parse(factory());
  } catch {
    return null;
  }
}

async function safeUuid(factory: () => string) {
  return safeNonce(factory);
}

function safeDate(now: () => number) {
  try {
    const value = new Date(now()).toISOString();
    return z.string().datetime({ offset: true }).parse(value);
  } catch {
    return null;
  }
}

async function runBoundedProxyPreflight(
  run: Phase698TransportEvidenceT3ControlledCliPorts['runProxyPreflight'],
  input: Parameters<Phase698TransportEvidenceT3ControlledCliPorts['runProxyPreflight']>[0],
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<null>((resolve) => {
    onAbort = () => resolve(null);
    input.signal.addEventListener('abort', onAbort, { once: true });
    if (input.signal.aborted) onAbort();
  });
  const timedOut = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), 1_000);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => run(input)), aborted, timedOut]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (onAbort) input.signal.removeEventListener('abort', onAbort);
  }
}

function hasExactArgument(args: readonly string[], expected: string) {
  return args.length === 1 && args[0] === expected;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
