import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA,
  type Phase698ArchitectureRecoveryBoundedDiagnostic,
  type Phase698ArchitectureRecoveryDiagnosticStage,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.ts';
import {
  architectureRecoveryDiagnosticSequence,
  expectedPhase698ArchitectureRecoveryCallSchedule,
  type Phase698ArchitectureRecoveryCallIdentity,
  type Phase698ArchitectureRecoveryProviderWire,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-runner-contract.ts';

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_OBSERVATION_CAPABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-architecture-recovery-runner-observation-capability-v1' as const;

export type Phase698ArchitectureRecoveryRunnerObservationCapability = Readonly<{
  version: typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_OBSERVATION_CAPABILITY_VERSION;
}>;

export type Phase698ArchitectureRecoveryObservationFamily = 'rewrite' | 'qwen' | 'final_response';
export type Phase698ArchitectureRecoveryRunnerObservation = Readonly<{
  family: Phase698ArchitectureRecoveryObservationFamily;
  callId: string;
  callPhase: Phase698ArchitectureRecoveryCallIdentity['phase'];
  diagnostic: Phase698ArchitectureRecoveryBoundedDiagnostic;
  diagnosticStages: readonly Phase698ArchitectureRecoveryDiagnosticStage[];
  providerWire: Phase698ArchitectureRecoveryProviderWire;
}>;

/**
 * Validates a record already recovered from one of the three module-private capability maps.
 * This function never issues a capability; callers cannot turn arbitrary data into authority.
 */
export function validatePhase698ArchitectureRecoveryRunnerObservation(
  input: Readonly<{
    family: Phase698ArchitectureRecoveryObservationFamily;
    callId: string;
    callPhase: Phase698ArchitectureRecoveryCallIdentity['phase'];
    diagnostic: Phase698ArchitectureRecoveryBoundedDiagnostic;
    diagnosticStages: readonly Phase698ArchitectureRecoveryDiagnosticStage[];
    providerWire: Phase698ArchitectureRecoveryProviderWire;
  }>,
  expectedIdentity: Phase698ArchitectureRecoveryCallIdentity,
): Phase698ArchitectureRecoveryRunnerObservation {
  const identity = expectedPhase698ArchitectureRecoveryCallSchedule().find(
    (entry) => entry.callId === input.callId,
  );
  const diagnostic = PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA.parse(
    input.diagnostic,
  );
  const stages = Object.freeze([...input.diagnosticStages]);
  const providerWire = readProviderWire(input.providerWire);
  if (
    !identity ||
    identity.callId !== expectedIdentity.callId ||
    identity.phase !== expectedIdentity.phase ||
    identity.phase !== input.callPhase ||
    diagnostic.callPhase !== input.callPhase ||
    expectedFamily(identity) !== input.family ||
    !isExactDiagnosticPrefix(diagnostic, stages) ||
    !wireMatchesBoundary(providerWire, diagnostic.providerBoundary)
  ) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_OBSERVATION_INVALID');
  }
  return deepFreeze({
    family: input.family,
    callId: identity.callId,
    callPhase: identity.phase,
    diagnostic,
    diagnosticStages: stages,
    providerWire,
  });
}

function expectedFamily(
  identity: Phase698ArchitectureRecoveryCallIdentity,
): Phase698ArchitectureRecoveryObservationFamily {
  if (identity.phase === 'rewrite_candidate_model') return 'rewrite';
  if (identity.phase === 'final_response_model') return 'final_response';
  return 'qwen';
}

function isExactDiagnosticPrefix(
  diagnostic: Phase698ArchitectureRecoveryBoundedDiagnostic,
  stages: readonly Phase698ArchitectureRecoveryDiagnosticStage[],
) {
  const sequence = architectureRecoveryDiagnosticSequence(diagnostic.callPhase);
  const terminalIndex = sequence.indexOf(diagnostic.stage);
  if (terminalIndex < 0) return false;
  const expectedLength = diagnostic.reasonCode === 'applied' ? terminalIndex + 1 : terminalIndex;
  return (
    stages.length === expectedLength && stages.every((stage, index) => stage === sequence[index])
  );
}

function readProviderWire(value: Phase698ArchitectureRecoveryProviderWire) {
  const fields = ['executions', 'dispatches', 'responses', 'verifiedUsage'] as const;
  if (
    !isPlainRecord(value) ||
    Reflect.ownKeys(value).length !== fields.length ||
    fields.some((field) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, field);
      return (
        !descriptor ||
        !('value' in descriptor) ||
        (descriptor.value !== 0 && descriptor.value !== 1)
      );
    })
  ) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_OBSERVATION_INVALID');
  }
  const wire = Object.freeze({
    executions: readOwnNumber(value, 'executions'),
    dispatches: readOwnNumber(value, 'dispatches'),
    responses: readOwnNumber(value, 'responses'),
    verifiedUsage: readOwnNumber(value, 'verifiedUsage'),
  });
  if (
    wire.executions < wire.dispatches ||
    wire.dispatches < wire.responses ||
    wire.responses < wire.verifiedUsage
  ) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_OBSERVATION_INVALID');
  }
  return wire;
}

function wireMatchesBoundary(
  wire: Phase698ArchitectureRecoveryProviderWire,
  boundary: Phase698ArchitectureRecoveryBoundedDiagnostic['providerBoundary'],
) {
  if (boundary === 'not_dispatched') {
    return wire.dispatches === 0 && wire.responses === 0 && wire.verifiedUsage === 0;
  }
  if (boundary === 'dispatched_no_response') {
    return (
      wire.executions === 1 &&
      wire.dispatches === 1 &&
      wire.responses === 0 &&
      wire.verifiedUsage === 0
    );
  }
  if (boundary === 'response_observed') {
    return (
      wire.executions === 1 &&
      wire.dispatches === 1 &&
      wire.responses === 1 &&
      wire.verifiedUsage === 0
    );
  }
  if (boundary === 'response_and_usage_observed') {
    return (
      wire.executions === 1 &&
      wire.dispatches === 1 &&
      wire.responses === 1 &&
      wire.verifiedUsage === 1
    );
  }
  return false;
}

function readOwnNumber(value: object, key: string) {
  const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
  const observed = descriptor && 'value' in descriptor ? (descriptor.value as unknown) : undefined;
  if (typeof observed !== 'number') {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_OBSERVATION_INVALID');
  }
  return observed;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
