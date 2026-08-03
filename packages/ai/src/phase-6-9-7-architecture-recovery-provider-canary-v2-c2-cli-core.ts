import {
  consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation,
  runPhase697ArchitectureRecoveryProviderCanaryV2C1,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c1.ts';
import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_APPROVAL_ENV,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONFIRMATION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CRASH_SEAL_CONFIRMATION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CREDENTIAL_ENV,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PROXY_ATTESTATION_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_SCHEMA,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2ProxyAttestation,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2Report,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2Source,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c2-contract.ts';
import type {
  Phase697ArchitectureRecoveryProviderCanaryV2C2CrashSealResult,
  Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c2-durability.ts';
import type { Phase697V7WireStage } from './phase-6-9-7-v7-wire-diagnostics.ts';
import type { Phase697ArchitectureRecoveryProxyPreflightDependencies } from './phase-6-9-7-architecture-recovery-proxy-preflight.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CLI_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-c2-cli-v1' as const;

export type Phase697ArchitectureRecoveryProviderCanaryV2C2CliCoreInput = Readonly<{
  args: readonly string[];
  root: string;
  proxyEnv: Record<string, unknown>;
  authorizationEnv: Record<string, unknown>;
  signal: AbortSignal;
}>;

export type Phase697ArchitectureRecoveryProviderCanaryV2C2CliCorePorts = Readonly<{
  probeLoopbackListener: Phase697ArchitectureRecoveryProxyPreflightDependencies['probeLoopbackListener'];
  readSource(root: string): Promise<Phase697ArchitectureRecoveryProviderCanaryV2C2Source>;
  reserve(input: {
    root: string;
    runId: string;
    createdAt: string;
    source: Phase697ArchitectureRecoveryProviderCanaryV2C2Source;
    proxyAttestation: Phase697ArchitectureRecoveryProviderCanaryV2C2ProxyAttestation;
  }): Promise<Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation>;
  runControlledLive(input: {
    credential: string;
    timeoutMs: 5_000;
    signal: AbortSignal;
    appendWireStage(stage: Phase697V7WireStage): Promise<void>;
  }): Promise<Phase697ArchitectureRecoveryProviderCanaryV2C2Report>;
  sealInterrupted(input: {
    root: string;
  }): Promise<Phase697ArchitectureRecoveryProviderCanaryV2C2CrashSealResult>;
  validate(input: { root: string }): Promise<
    Readonly<{
      ok: boolean;
      runId: string | null;
    }>
  >;
  now(): number;
  randomUUID(): string;
  write(line: string): void;
}>;

export async function executePhase697ArchitectureRecoveryProviderCanaryV2C2CliCore(
  rawInput: Phase697ArchitectureRecoveryProviderCanaryV2C2CliCoreInput,
  rawPorts: Phase697ArchitectureRecoveryProviderCanaryV2C2CliCorePorts,
): Promise<0 | 1> {
  const input = readInput(rawInput);
  const ports = readPorts(rawPorts);
  if (!input || !ports) return 1;
  const blocked = (code: string, details: Record<string, unknown> = {}) => {
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CLI_VERSION,
        ok: false,
        evidenceSealed: false,
        providerHealth: 'unknown',
        code,
        ...details,
      }),
    );
    return 1 as const;
  };

  if (hasCrashSealConfirmation(input.args)) {
    const result = await ports.sealInterrupted({ root: input.root });
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CLI_VERSION,
        evidenceSealed: result.ok,
        providerHealth: 'unknown',
        ...result,
      }),
    );
    return result.ok ? 0 : 1;
  }
  if (!hasExactConfirmation(input.args)) return blocked('c2_cli_argument_invalid');
  if (isSignalAborted(input.signal)) {
    return blocked('c2_preflight_aborted', { providerCalls: 0 });
  }

  const admission = await runPhase697ArchitectureRecoveryProviderCanaryV2C1(
    { env: input.proxyEnv, signal: input.signal },
    { probeLoopbackListener: ports.probeLoopbackListener },
  );
  if (!admission.attestation || !admission.report.preflight.ok) {
    return blocked('c2_preflight_rejected', {
      preflightCode: admission.report.preflight.code,
      listenerProbeCalls: admission.report.preflight.listenerProbeCalls,
      providerCalls: 0,
    });
  }
  const consumed = consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(
    admission.attestation,
  );
  if (!consumed.ok) {
    return blocked('c2_preflight_attestation_invalid', { providerCalls: 0 });
  }
  const proxyAttestation = toProxyAttestation(consumed.report.preflight);

  let source: Phase697ArchitectureRecoveryProviderCanaryV2C2Source;
  try {
    source = PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_SCHEMA.parse(
      await ports.readSource(input.root),
    );
  } catch {
    return blocked('c2_source_invalid', { providerCalls: 0 });
  }
  if (isSignalAborted(input.signal)) {
    return blocked('c2_source_aborted', { providerCalls: 0 });
  }

  if (
    readOwnDataString(
      input.authorizationEnv,
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_APPROVAL_ENV,
    ) !== 'true'
  ) {
    return blocked('c2_live_not_authorized', { providerCalls: 0 });
  }
  const credential = readOwnDataString(
    input.authorizationEnv,
    PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CREDENTIAL_ENV,
  );
  if (!isValidCredential(credential)) {
    return blocked('c2_live_configuration_invalid', { providerCalls: 0 });
  }
  if (isSignalAborted(input.signal)) {
    return blocked('c2_live_aborted_before_reservation', { providerCalls: 0 });
  }

  let runId: string;
  let createdAt: string;
  try {
    runId = ports.randomUUID();
    createdAt = new Date(ports.now()).toISOString();
  } catch {
    return blocked('c2_live_preflight_invalid', { providerCalls: 0 });
  }

  let reservation: Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation;
  try {
    reservation = await ports.reserve({
      root: input.root,
      runId,
      createdAt,
      source,
      proxyAttestation,
    });
  } catch {
    return blocked('c2_live_once_already_consumed_or_evidence_io', { providerCalls: 0 });
  }

  let report: Phase697ArchitectureRecoveryProviderCanaryV2C2Report;
  try {
    report = PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_SCHEMA.parse(
      await ports.runControlledLive({
        credential,
        timeoutMs: 5_000,
        signal: input.signal,
        appendWireStage: reservation.appendWireStage,
      }),
    );
    if (
      report.authority !== 'controlled_live' ||
      report.executorProvenance !== 'deepseek_network'
    ) {
      throw new Error();
    }
  } catch {
    return blocked('c2_live_runtime_or_evidence_io');
  }

  try {
    const terminal = await reservation.appendTerminal(report);
    const artifact = reservation.buildArtifact({
      generatedAt: new Date(ports.now()).toISOString(),
      report,
      terminal,
    });
    const published = await reservation.publishArtifact(artifact);
    const validation = await ports.validate({ root: input.root });
    if (!validation.ok || validation.runId !== runId) throw new Error();
    const complete = report.outcome === 'complete';
    if (
      !safeWrite(
        ports.write,
        JSON.stringify({
          version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CLI_VERSION,
          ok: complete,
          evidenceSealed: true,
          authority: report.authority,
          qualityAuthority: report.qualityAuthority,
          providerHealth: report.providerHealth,
          runId,
          outcome: report.outcome,
          responseObserved: report.responseObserved,
          strictResponseObserved: report.strictResponseObserved,
          wire: report.wire.counters,
          usage: report.usage,
          estimatedCostCny: report.cost.estimatedCostCny,
          artifactSha256: published.evidenceSha256,
        }),
      )
    ) {
      return 1;
    }
    return complete ? 0 : 1;
  } catch {
    return blocked('c2_live_evidence_io');
  }
}

function toProxyAttestation(
  preflight: Readonly<{
    version: string;
    mode: 'direct' | 'loopback_proxy' | 'undetermined';
    configuredProxyVariables: number;
    listener: 'not_required' | 'listening' | 'unavailable' | 'probe_failed' | 'aborted';
    listenerProbeCalls: 0 | 1;
    providerCalls: 0;
  }>,
) {
  return PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PROXY_ATTESTATION_SCHEMA.parse({
    version: 'phase-6.9.7-architecture-recovery-provider-canary-v2-proxy-attestation-v1',
    preflightVersion: preflight.version,
    mode: preflight.mode,
    configuredProxyVariables: preflight.configuredProxyVariables,
    listener: preflight.listener,
    listenerProbeCalls: preflight.listenerProbeCalls,
    providerCalls: preflight.providerCalls,
  });
}

function readInput(
  value: unknown,
): Phase697ArchitectureRecoveryProviderCanaryV2C2CliCoreInput | null {
  const fields = readExactOwnDataValues(value, [
    'args',
    'authorizationEnv',
    'proxyEnv',
    'root',
    'signal',
  ]);
  if (
    !fields ||
    !Array.isArray(fields.args) ||
    fields.args.some((entry) => typeof entry !== 'string') ||
    !isRecord(fields.authorizationEnv) ||
    !isRecord(fields.proxyEnv) ||
    typeof fields.root !== 'string' ||
    fields.root.length === 0 ||
    !isAbortSignal(fields.signal)
  ) {
    return null;
  }
  return Object.freeze({
    args: Object.freeze(fields.args.map((entry) => String(entry))),
    authorizationEnv: fields.authorizationEnv,
    proxyEnv: fields.proxyEnv,
    root: fields.root,
    signal: fields.signal,
  });
}

function readPorts(
  value: unknown,
): Phase697ArchitectureRecoveryProviderCanaryV2C2CliCorePorts | null {
  const fields = readExactOwnDataValues(value, [
    'now',
    'probeLoopbackListener',
    'randomUUID',
    'readSource',
    'reserve',
    'runControlledLive',
    'sealInterrupted',
    'validate',
    'write',
  ]);
  if (!fields || Object.values(fields).some((field) => typeof field !== 'function')) return null;
  return Object.freeze(
    fields as unknown as Phase697ArchitectureRecoveryProviderCanaryV2C2CliCorePorts,
  );
}

function hasExactConfirmation(args: readonly string[]) {
  try {
    return (
      args.length === 1 &&
      args[0] === PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONFIRMATION
    );
  } catch {
    return false;
  }
}

function hasCrashSealConfirmation(args: readonly string[]) {
  try {
    return (
      args.length === 1 &&
      args[0] === PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CRASH_SEAL_CONFIRMATION
    );
  } catch {
    return false;
  }
}

function readOwnDataString(value: Record<string, unknown>, key: string) {
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor && typeof descriptor.value === 'string'
      ? descriptor.value
      : null;
  } catch {
    return null;
  }
}

function isValidCredential(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 512 &&
    value === value.trim() &&
    /^[\x21-\x7e]+$/u.test(value)
  );
}

function isSignalAborted(signal: AbortSignal) {
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readExactOwnDataValues(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (!isRecord(value)) return null;
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

function safeWrite(write: (line: string) => void, line: string) {
  try {
    write(line);
    return true;
  } catch {
    return false;
  }
}
