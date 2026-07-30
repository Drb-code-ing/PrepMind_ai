import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION,
  runPhase697ArchitectureRecoveryProxyPreflight,
  type Phase697ArchitectureRecoveryProxyPreflightDependencies,
  type Phase697ArchitectureRecoveryProxyPreflightResult,
} from './phase-6-9-7-architecture-recovery-proxy-preflight.ts';
import {
  buildPhase697ArchitectureRecoveryProviderCanaryV2C1Report,
  type Phase697ArchitectureRecoveryProviderCanaryV2C1Report,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c1-contract.ts';

declare const PROVIDER_CANARY_V2_PROXY_ATTESTATION_BRAND: unique symbol;

export type Phase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation = Readonly<{
  readonly [PROVIDER_CANARY_V2_PROXY_ATTESTATION_BRAND]: never;
}>;

export type Phase697ArchitectureRecoveryProviderCanaryV2C1Admission = Readonly<{
  report: Phase697ArchitectureRecoveryProviderCanaryV2C1Report;
  attestation: Phase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation | null;
}>;

export type Phase697ArchitectureRecoveryProviderCanaryV2AttestationConsumeResult =
  | Readonly<{
      ok: true;
      code: 'attestation_consumed';
      report: Phase697ArchitectureRecoveryProviderCanaryV2C1Report;
    }>
  | Readonly<{
      ok: false;
      code: 'attestation_invalid';
      report: null;
    }>
  | Readonly<{
      ok: false;
      code: 'attestation_replayed';
      report: Phase697ArchitectureRecoveryProviderCanaryV2C1Report;
    }>;

type AttestationState = {
  consumed: boolean;
  preflight: Phase697ArchitectureRecoveryProxyPreflightResult;
};

const ATTESTATIONS = new WeakMap<object, AttestationState>();
const INVALID_ATTESTATION_RESULT = Object.freeze({
  ok: false as const,
  code: 'attestation_invalid' as const,
  report: null,
});

/**
 * Runs only the local proxy preflight and mints an in-memory, opaque,
 * single-consume capability when it is ready. This C1 boundary has no
 * credential, source, marker, journal, artifact, fetch, or Provider port.
 */
export async function runPhase697ArchitectureRecoveryProviderCanaryV2C1(
  rawInput: Readonly<{ env: Record<string, unknown>; signal: AbortSignal }>,
  rawDependencies: Phase697ArchitectureRecoveryProxyPreflightDependencies,
): Promise<Phase697ArchitectureRecoveryProviderCanaryV2C1Admission> {
  const input = readInput(rawInput);
  const dependencies = readDependencies(rawDependencies);
  if (!input || !dependencies) return rejectedAdmission(invalidPreflight());

  let preflight: Phase697ArchitectureRecoveryProxyPreflightResult;
  try {
    preflight = await runPhase697ArchitectureRecoveryProxyPreflight(input, dependencies);
  } catch {
    return rejectedAdmission(invalidPreflight());
  }
  if (!preflight.ok || isSignalAborted(input.signal)) {
    return rejectedAdmission(
      isSignalAborted(input.signal) && preflight.ok ? abortedPreflight(preflight) : preflight,
    );
  }

  const attestation = mintAttestation(preflight);
  return Object.freeze({
    report: buildPhase697ArchitectureRecoveryProviderCanaryV2C1Report({
      preflight,
      disposition: 'preflight_ready',
    }),
    attestation,
  });
}

/**
 * Claims an attestation synchronously before any asynchronous boundary. A
 * failed consumer never returns the capability to the available state.
 */
export function consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(
  value: unknown,
): Phase697ArchitectureRecoveryProviderCanaryV2AttestationConsumeResult {
  let state: AttestationState | undefined;
  try {
    if (typeof value !== 'object' || value === null) return INVALID_ATTESTATION_RESULT;
    state = ATTESTATIONS.get(value);
  } catch {
    return INVALID_ATTESTATION_RESULT;
  }
  if (!state) return INVALID_ATTESTATION_RESULT;
  if (state.consumed) {
    return Object.freeze({
      ok: false,
      code: 'attestation_replayed',
      report: buildPhase697ArchitectureRecoveryProviderCanaryV2C1Report({
        preflight: state.preflight,
        disposition: 'capability_rejected',
      }),
    });
  }

  state.consumed = true;
  return Object.freeze({
    ok: true,
    code: 'attestation_consumed',
    report: buildPhase697ArchitectureRecoveryProviderCanaryV2C1Report({
      preflight: state.preflight,
      disposition: 'capability_consumed',
    }),
  });
}

function mintAttestation(
  preflight: Phase697ArchitectureRecoveryProxyPreflightResult,
): Phase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation {
  const attestation = Object.freeze(
    Object.create(null),
  ) as Phase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation;
  ATTESTATIONS.set(attestation, { consumed: false, preflight });
  return attestation;
}

function rejectedAdmission(
  preflight: Phase697ArchitectureRecoveryProxyPreflightResult,
): Phase697ArchitectureRecoveryProviderCanaryV2C1Admission {
  return Object.freeze({
    report: buildPhase697ArchitectureRecoveryProviderCanaryV2C1Report({
      preflight,
      disposition: 'preflight_rejected',
    }),
    attestation: null,
  });
}

function invalidPreflight(): Phase697ArchitectureRecoveryProxyPreflightResult {
  return Object.freeze({
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION,
    ok: false,
    code: 'proxy_environment_invalid',
    mode: 'undetermined',
    configuredProxyVariables: 0,
    listener: 'not_required',
    listenerProbeCalls: 0,
    providerCalls: 0,
  });
}

function abortedPreflight(
  preflight: Phase697ArchitectureRecoveryProxyPreflightResult,
): Phase697ArchitectureRecoveryProxyPreflightResult {
  return Object.freeze({
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION,
    ok: false,
    code: 'aborted',
    mode: preflight.mode,
    configuredProxyVariables: preflight.configuredProxyVariables,
    listener: 'aborted',
    listenerProbeCalls: preflight.listenerProbeCalls,
    providerCalls: 0,
  });
}

function readInput(
  value: unknown,
): Readonly<{ env: Record<string, unknown>; signal: AbortSignal }> | null {
  const fields = readExactOwnDataValues(value, ['env', 'signal']);
  if (
    !fields ||
    typeof fields.env !== 'object' ||
    fields.env === null ||
    Array.isArray(fields.env) ||
    !isAbortSignal(fields.signal)
  ) {
    return null;
  }
  return Object.freeze({ env: fields.env as Record<string, unknown>, signal: fields.signal });
}

function readDependencies(
  value: unknown,
): Phase697ArchitectureRecoveryProxyPreflightDependencies | null {
  const fields = readExactOwnDataValues(value, ['probeLoopbackListener']);
  if (!fields || typeof fields.probeLoopbackListener !== 'function') return null;
  return Object.freeze({
    probeLoopbackListener:
      fields.probeLoopbackListener as Phase697ArchitectureRecoveryProxyPreflightDependencies['probeLoopbackListener'],
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
