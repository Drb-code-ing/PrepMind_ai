import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVAL_ENV,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_AUTHORITY,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ENV,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_EXACT_AUTHORIZATION,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE_FAILED,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_ZERO_PROVIDER_ARGUMENT,
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
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_REPORT_SCHEMA,
  runPhase698TransportEvidenceT3ZeroProvider,
  type Phase698TransportEvidenceT3Report,
  type Phase698TransportEvidenceT3SlotOutcome,
} from './phase-6-9-8-retriever-final-response-transport-evidence-t3-runner.ts';

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CLI_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t3-cli-v1' as const;

export type Phase698TransportEvidenceT3CliCoreInput = Readonly<{
  args: readonly string[];
  root: string;
  proxyEnv: Readonly<Record<string, unknown>>;
  authorizationEnv: Readonly<Record<string, unknown>>;
  signal: AbortSignal;
  syntheticOutcomes?: readonly Phase698TransportEvidenceT3SlotOutcome[];
  requestedBudgetCny?: number;
}>;

export type Phase698TransportEvidenceT3CliCorePorts = Readonly<{
  readSource(root: string): Phase698TransportEvidenceT3AdmissionResult;
  readT2Gate(): unknown;
  runProxyPreflight(input: {
    env: Readonly<Record<string, unknown>>;
    signal: AbortSignal;
    nonce: string;
  }): Promise<unknown>;
  readDataBoundary(env: Readonly<Record<string, unknown>>): true;
  readApproval(env: Readonly<Record<string, unknown>>): true;
  runZeroProvider(input: {
    signal: AbortSignal;
    outcomes?: readonly Phase698TransportEvidenceT3SlotOutcome[];
    requestedBudgetCny?: number;
  }): Phase698TransportEvidenceT3Report;
  randomUUID(): string;
  write(line: string): void;
}>;

const REQUIRED_INPUT_KEYS = ['args', 'root', 'proxyEnv', 'authorizationEnv', 'signal'] as const;
const OPTIONAL_INPUT_KEYS = ['syntheticOutcomes', 'requestedBudgetCny'] as const;
const PORT_KEYS = [
  'readSource',
  'readT2Gate',
  'runProxyPreflight',
  'readDataBoundary',
  'readApproval',
  'runZeroProvider',
  'randomUUID',
  'write',
] as const;
const UUID = z.string().uuid();
const PROXY_PREFLIGHT_TIMEOUT_MS = 1_000;

export async function executePhase698TransportEvidenceT3CliCore(
  rawInput: unknown,
  rawPorts: unknown,
): Promise<0 | 1> {
  const input = readInput(rawInput);
  const ports = readPorts(rawPorts);
  const blocked = (code: string, details: Readonly<Record<string, unknown>> = {}) => {
    safeWrite(
      ports?.write,
      JSON.stringify({
        version: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CLI_VERSION,
        operation: 'zero_provider_admission',
        ok: false,
        evidenceSealed: false,
        authority: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_AUTHORITY,
        qualityAuthority: 'none',
        providerCalls: 0,
        credentialReads: 0,
        formalEvidence: 0,
        code,
        ...details,
      }),
    );
    return 1 as const;
  };

  if (!input || !ports) return blocked('input_or_ports_invalid');
  if (
    input.args.length !== 1 ||
    input.args[0] !== PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_ZERO_PROVIDER_ARGUMENT
  ) {
    return blocked('cli_argument_invalid');
  }
  if (isAborted(input.signal)) return blocked('aborted_before_source');

  let admission: Phase698TransportEvidenceT3AdmissionResult;
  try {
    admission = ports.readSource(input.root);
    if (!isValidAdmissionResult(admission)) throw new Error('source');
  } catch {
    return blocked('source_admission_invalid');
  }
  if (isAborted(input.signal)) return blocked('aborted_after_source');

  try {
    if (!validatePhase698TransportEvidenceT3GateBinding(ports.readT2Gate())) throw new Error('t2');
    const issued = consumePhase698TransportEvidenceT3AdmissionCapability(
      admission.capability,
      admission.authority,
    );
    PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_SCHEMA.parse(admission.source);
    if (issued.source !== admission.source) throw new Error('source_binding');
  } catch {
    return blocked('t2_gate_or_capability_invalid');
  }
  if (isAborted(input.signal)) return blocked('aborted_after_t2_gate');

  let nonce: string;
  try {
    nonce = UUID.parse(ports.randomUUID());
  } catch {
    return blocked('preflight_nonce_invalid');
  }
  let proxy: Phase698TransportEvidenceT3ProxyReceipt | null;
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
  if (isAborted(input.signal)) return blocked('aborted_before_zero_provider_runner');

  let report: Phase698TransportEvidenceT3Report;
  try {
    report = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_REPORT_SCHEMA.parse(
      ports.runZeroProvider({
        signal: input.signal,
        outcomes: input.syntheticOutcomes,
        requestedBudgetCny: input.requestedBudgetCny,
      }),
    );
    if (
      report.authority !== PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_AUTHORITY ||
      report.qualityAuthority !== 'none' ||
      report.providerCalls !== 0 ||
      report.credentialReads !== 0 ||
      report.formalEvidence !== 0 ||
      report.rawDataRetained !== false
    )
      throw new Error('report_boundary');
  } catch {
    return blocked('zero_provider_runner_invalid');
  }

  const output = {
    version: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CLI_VERSION,
    operation: 'zero_provider_admission',
    ok: report.gate === PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE,
    evidenceSealed: false,
    authority: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_AUTHORITY,
    qualityAuthority: 'none',
    gate: report.gate,
    passed: report.passed,
    sourceCommit: admission.source.commit,
    proxy: {
      code: proxy.code,
      mode: proxy.mode,
      listener: proxy.listener,
      listenerProbeCalls: proxy.listenerProbeCalls,
      providerCalls: proxy.providerCalls,
    },
    slotOrder: report.slotOrder,
    startedSlots: report.startedSlots,
    notStartedQualityBreaker: report.notStartedQualityBreaker,
    notStartedExternalAbort: report.notStartedExternalAbort,
    breaker: report.breaker,
    providerCalls: report.providerCalls,
    credentialReads: report.credentialReads,
    formalEvidence: report.formalEvidence,
    rawDataRetained: report.rawDataRetained,
  };
  if (!safeWrite(ports.write, JSON.stringify(output))) return 1;
  return report.passed ? 0 : 1;
}

export const defaultPhase698TransportEvidenceT3CliPorts = Object.freeze({
  readSource: (root: string) => {
    throw new Error(`SOURCE_PORT_NOT_BOUND:${root.length}`);
  },
  readT2Gate: () => {
    throw new Error('T2_GATE_PORT_NOT_BOUND');
  },
  runProxyPreflight: async () => {
    throw new Error('PROXY_PREFLIGHT_PORT_NOT_BOUND');
  },
  readDataBoundary: readPhase698TransportEvidenceT3DataBoundary,
  readApproval: readPhase698TransportEvidenceT3Approval,
  runZeroProvider: runPhase698TransportEvidenceT3ZeroProvider,
  randomUUID,
  write: (line: string) => process.stdout.write(`${line}\n`),
} satisfies Phase698TransportEvidenceT3CliCorePorts);

function readInput(value: unknown): Phase698TransportEvidenceT3CliCoreInput | null {
  const fields = readExactOwnData(value, REQUIRED_INPUT_KEYS, OPTIONAL_INPUT_KEYS);
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
  if (
    fields.syntheticOutcomes !== undefined &&
    (!Array.isArray(fields.syntheticOutcomes) ||
      fields.syntheticOutcomes.length > 3 ||
      fields.syntheticOutcomes.some((item) => typeof item !== 'string'))
  )
    return null;
  if (
    fields.requestedBudgetCny !== undefined &&
    (typeof fields.requestedBudgetCny !== 'number' ||
      !Number.isFinite(fields.requestedBudgetCny) ||
      fields.requestedBudgetCny < 0)
  )
    return null;
  return Object.freeze({
    args: Object.freeze(fields.args.map(String)),
    root: fields.root,
    proxyEnv: fields.proxyEnv,
    authorizationEnv: fields.authorizationEnv,
    signal: fields.signal,
    syntheticOutcomes: fields.syntheticOutcomes,
    requestedBudgetCny: fields.requestedBudgetCny,
  });
}

function readPorts(value: unknown): Phase698TransportEvidenceT3CliCorePorts | null {
  const fields = readExactOwnData(value, PORT_KEYS);
  if (!fields || Object.values(fields).some((field) => typeof field !== 'function')) return null;
  return Object.freeze(fields as unknown as Phase698TransportEvidenceT3CliCorePorts);
}

function isValidAdmissionResult(
  value: unknown,
): value is Extract<Phase698TransportEvidenceT3AdmissionResult, { ok: true }> {
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
      (fields.authority === 'controlled_live' || fields.authority === 'synthetic_test') &&
      isRecord(fields.source) &&
      isRecord(fields.capability) &&
      isRecord(fields.reservationCapability)
    );
  } catch {
    return false;
  }
}

function readExactOwnData(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Record<string, unknown> | null {
  try {
    if (!isRecord(value)) return null;
    const keys = Reflect.ownKeys(value);
    const allowedKeys = [...requiredKeys, ...optionalKeys];
    if (
      keys.some((key) => typeof key !== 'string' || !allowedKeys.includes(key)) ||
      requiredKeys.some((key) => !keys.includes(key))
    )
      return null;
    const fields = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== 'string') return null;
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return null;
      fields[key] = descriptor.value;
    }
    return fields;
  } catch {
    return null;
  }
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

function safeWrite(write: ((line: string) => void) | undefined, line: string) {
  try {
    if (!write || line.length > 16_384) return false;
    write(line);
    return true;
  } catch {
    return false;
  }
}

async function runBoundedProxyPreflight(
  run: Phase698TransportEvidenceT3CliCorePorts['runProxyPreflight'],
  input: Parameters<Phase698TransportEvidenceT3CliCorePorts['runProxyPreflight']>[0],
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<null>((resolve) => {
    onAbort = () => resolve(null);
    try {
      input.signal.addEventListener('abort', onAbort, { once: true });
      if (input.signal.aborted) onAbort();
    } catch {
      resolve(null);
    }
  });
  const timedOut = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), PROXY_PREFLIGHT_TIMEOUT_MS);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => run(input)), aborted, timedOut]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (onAbort) {
      try {
        input.signal.removeEventListener('abort', onAbort);
      } catch {
        // The bounded result is already fail-closed.
      }
    }
  }
}

// Keep the explicit authorization literal in this module's static surface so
// callers cannot accidentally substitute a loose "continue" token.
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_AUTHORIZATION_LITERAL =
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_EXACT_AUTHORIZATION;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_AUTHORIZATION_ENV_KEY =
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVAL_ENV;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ENV_KEY =
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ENV;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE_LITERAL =
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE_FAILED_LITERAL =
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE_FAILED;
