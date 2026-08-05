import {
  readPhase698ProviderWireSnapshot,
  type Phase698ProviderWireCapability,
  type Phase698ProviderWireFailureCategory,
  type Phase698ProviderWireSnapshot,
} from '@repo/ai';

import {
  advancePhase698ArchitectureRecoveryDiagnosticStage,
  completePhase698ArchitectureRecoveryDiagnosticState,
  createPhase698ArchitectureRecoveryDiagnosticState,
  failPhase698ArchitectureRecoveryDiagnosticStage,
  isPhase698ArchitectureRecoveryExpectedStage,
  readPhase698ArchitectureRecoveryDiagnostic,
  readPhase698ArchitectureRecoveryDiagnosticSnapshot,
  setPhase698ArchitectureRecoveryProviderBoundary,
  setPhase698ArchitectureRecoveryShapeBuckets,
  type Phase698ArchitectureRecoveryBoundedDiagnostic,
  type Phase698ArchitectureRecoveryCallPhase,
  type Phase698ArchitectureRecoveryDiagnosticCapability,
  type Phase698ArchitectureRecoveryDiagnosticReasonCode,
  type Phase698ArchitectureRecoveryDiagnosticSnapshot,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.ts';
import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_OBSERVATION_CAPABILITY_VERSION,
  validatePhase698ArchitectureRecoveryRunnerObservation,
  type Phase698ArchitectureRecoveryRunnerObservation,
  type Phase698ArchitectureRecoveryRunnerObservationCapability,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-runner-observation.ts';
import { expectedPhase698ArchitectureRecoveryCallSchedule } from './phase-6-9-8-retriever-final-response-architecture-recovery-runner-contract.ts';

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_QWEN_DIAGNOSTIC_CAPABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-qwen-diagnostic-capability-v1' as const;

export type Phase698ArchitectureRecoveryQwenDiagnosticCapability = Readonly<{
  version: typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_QWEN_DIAGNOSTIC_CAPABILITY_VERSION;
}>;

export type Phase698ArchitectureRecoveryQwenDiagnosticSession = Readonly<{
  capability: Phase698ArchitectureRecoveryQwenDiagnosticCapability;
  read(): Phase698ArchitectureRecoveryBoundedDiagnostic | null;
  readSnapshot(): Phase698ArchitectureRecoveryDiagnosticSnapshot;
}>;

type AdmissionStatus =
  | 'accepted'
  | 'invalid_input'
  | 'principal_binding_invalid'
  | 'capability_invalid'
  | 'aborted_before_dispatch';
type RequestStatus = 'accepted' | 'invalid_input' | 'aborted_before_dispatch';
type CostStatus = 'accepted' | 'cost_mismatch';
type RankingStatus = 'accepted' | 'ranking_invalid';
type CallResultStatus = 'accepted' | 'result_shape_invalid' | 'phase_mismatch';

type QwenSessionState = {
  diagnosticCapability: Phase698ArchitectureRecoveryDiagnosticCapability;
  wireCapability: Phase698ProviderWireCapability | null;
  providerObservationRecorded: boolean;
  runnerObservationIssued: boolean;
};

const QWEN_WIRE_SEQUENCE = Object.freeze([
  'executor_entered',
  'request_validated',
  'provider_dispatch_started',
  'provider_response_received',
  'provider_envelope_validated',
  'embedding_validated',
  'usage_validated',
] as const);

const qwenCapabilities = new WeakMap<object, QwenSessionState>();
const boundWireCapabilities = new WeakSet<object>();
const qwenRunnerObservations = new WeakMap<object, Phase698ArchitectureRecoveryRunnerObservation>();
const consumedQwenRunnerObservations = new WeakSet<object>();

export function createPhase698ArchitectureRecoveryQwenDiagnosticSession(
  callPhase: Extract<
    Phase698ArchitectureRecoveryCallPhase,
    'rewrite_original_retrieval' | 'rewrite_candidate_retrieval'
  >,
  wireCapability: unknown,
): Phase698ArchitectureRecoveryQwenDiagnosticSession {
  const diagnosticCapability = createPhase698ArchitectureRecoveryDiagnosticState(callPhase);
  const capability = Object.freeze({
    version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_QWEN_DIAGNOSTIC_CAPABILITY_VERSION,
  });
  const snapshot = readWireSnapshot(wireCapability);
  const wireObject = asObject(wireCapability);
  const available =
    snapshot !== null &&
    wireObject !== null &&
    snapshot.family === 'qwen_retrieval' &&
    isUnusedWireSnapshot(snapshot) &&
    !boundWireCapabilities.has(wireObject);
  qwenCapabilities.set(capability, {
    diagnosticCapability,
    wireCapability: available ? (wireCapability as Phase698ProviderWireCapability) : null,
    providerObservationRecorded: false,
    runnerObservationIssued: false,
  });
  if (available) {
    boundWireCapabilities.add(wireObject);
  } else {
    failPhase698ArchitectureRecoveryDiagnosticStage(
      diagnosticCapability,
      'admission',
      'capability_invalid',
    );
  }
  return Object.freeze({
    capability,
    read: () => readPhase698ArchitectureRecoveryDiagnostic(diagnosticCapability),
    readSnapshot() {
      const value = readPhase698ArchitectureRecoveryDiagnosticSnapshot(diagnosticCapability);
      if (!value) throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_QWEN_STATE_MISSING');
      return value;
    },
  });
}

export function recordPhase698ArchitectureRecoveryQwenAdmission(
  capability: Phase698ArchitectureRecoveryQwenDiagnosticCapability,
  status: AdmissionStatus,
): boolean {
  return passOrFail(capability, 'admission', status, 'accepted');
}

export function recordPhase698ArchitectureRecoveryQwenRequestContract(
  capability: Phase698ArchitectureRecoveryQwenDiagnosticCapability,
  status: RequestStatus,
): boolean {
  return passOrFail(capability, 'request_contract', status, 'accepted');
}

export function recordPhase698ArchitectureRecoveryQwenProviderObservation(
  capability: Phase698ArchitectureRecoveryQwenDiagnosticCapability,
): boolean {
  const state = readSessionState(capability);
  if (!state || state.providerObservationRecorded || state.wireCapability === null) return false;
  if (
    !isPhase698ArchitectureRecoveryExpectedStage(state.diagnosticCapability, 'provider_dispatch')
  ) {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      state.diagnosticCapability,
      'provider_dispatch',
      'unknown',
    );
  }
  const snapshot = readPhase698ProviderWireSnapshot(state.wireCapability);
  if (!snapshot || snapshot.state === 'active') return false;
  state.providerObservationRecorded = true;
  return projectProviderObservation(state.diagnosticCapability, snapshot);
}

export function recordPhase698ArchitectureRecoveryQwenEmbedding(
  capability: Phase698ArchitectureRecoveryQwenDiagnosticCapability,
): boolean {
  const state = readSessionState(capability);
  const snapshot = readTerminalSnapshot(state);
  if (!state || !snapshot) return false;
  const failure = snapshot.failureCategory;
  if (
    failure === 'embedding_count_invalid' ||
    failure === 'embedding_dimension_invalid' ||
    failure === 'embedding_value_invalid'
  ) {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      state.diagnosticCapability,
      'embedding_contract',
      failure,
    );
  }
  if (!snapshot.stages.includes('embedding_validated')) {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      state.diagnosticCapability,
      'embedding_contract',
      'unknown',
    );
  }
  return advancePhase698ArchitectureRecoveryDiagnosticStage(
    state.diagnosticCapability,
    'embedding_contract',
  );
}

export function recordPhase698ArchitectureRecoveryQwenUsage(
  capability: Phase698ArchitectureRecoveryQwenDiagnosticCapability,
): boolean {
  const state = readSessionState(capability);
  const snapshot = readTerminalSnapshot(state);
  if (!state || !snapshot) return false;
  if (snapshot.failureCategory === 'usage_invalid') {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      state.diagnosticCapability,
      'usage_contract',
      'usage_invalid',
    );
  }
  if (
    snapshot.counters.providerDispatches !== 1 ||
    snapshot.counters.providerResponses !== 1 ||
    snapshot.counters.verifiedUsages !== 1 ||
    !snapshot.stages.includes('usage_validated')
  ) {
    const reason =
      snapshot.counters.providerDispatches !== 1
        ? 'dispatch_count_invalid'
        : snapshot.counters.providerResponses !== 1
          ? 'response_count_invalid'
          : 'usage_missing';
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      state.diagnosticCapability,
      'usage_contract',
      reason,
    );
  }
  if (
    !advancePhase698ArchitectureRecoveryDiagnosticStage(
      state.diagnosticCapability,
      'usage_contract',
    )
  ) {
    return false;
  }
  return setPhase698ArchitectureRecoveryProviderBoundary(
    state.diagnosticCapability,
    'response_and_usage_observed',
  );
}

export function recordPhase698ArchitectureRecoveryQwenCost(
  capability: Phase698ArchitectureRecoveryQwenDiagnosticCapability,
  status: CostStatus,
): boolean {
  return passOrFail(capability, 'cost_contract', status, 'accepted');
}

export function recordPhase698ArchitectureRecoveryQwenRanking(
  capability: Phase698ArchitectureRecoveryQwenDiagnosticCapability,
  status: RankingStatus,
): boolean {
  return passOrFail(capability, 'ranking_contract', status, 'accepted');
}

export function recordPhase698ArchitectureRecoveryQwenCallResult(
  capability: Phase698ArchitectureRecoveryQwenDiagnosticCapability,
  status: CallResultStatus,
): boolean {
  return passOrFail(capability, 'call_result_contract', status, 'accepted');
}

export function completePhase698ArchitectureRecoveryQwenDiagnostic(
  capability: Phase698ArchitectureRecoveryQwenDiagnosticCapability,
): boolean {
  const internal = readSessionState(capability)?.diagnosticCapability;
  return internal ? completePhase698ArchitectureRecoveryDiagnosticState(internal) : false;
}

/** Read-only, single-use bridge from the module-owned terminal state into the R3 runner. */
export function createPhase698ArchitectureRecoveryQwenRunnerObservation(
  capability: Phase698ArchitectureRecoveryQwenDiagnosticCapability,
  callId: string,
): Phase698ArchitectureRecoveryRunnerObservationCapability | null {
  const state = readSessionState(capability);
  if (
    !state ||
    state.runnerObservationIssued ||
    !state.providerObservationRecorded ||
    state.wireCapability === null
  ) {
    return null;
  }
  const diagnosticSnapshot = readPhase698ArchitectureRecoveryDiagnosticSnapshot(
    state.diagnosticCapability,
  );
  const wireSnapshot = readPhase698ProviderWireSnapshot(state.wireCapability);
  if (!diagnosticSnapshot?.diagnostic || !wireSnapshot || wireSnapshot.state === 'active')
    return null;
  try {
    const identity = expectedQwenIdentity(callId);
    if (!identity) return null;
    const record = validatePhase698ArchitectureRecoveryRunnerObservation(
      {
        family: 'qwen',
        callId,
        callPhase: diagnosticSnapshot.callPhase,
        diagnostic: diagnosticSnapshot.diagnostic,
        diagnosticStages: diagnosticSnapshot.completedStages,
        providerWire: {
          executions: wireSnapshot.counters.executorInvocations,
          dispatches: wireSnapshot.counters.providerDispatches,
          responses: wireSnapshot.counters.providerResponses,
          verifiedUsage: wireSnapshot.counters.verifiedUsages,
        },
      },
      identity,
    );
    const observation = Object.freeze({
      version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_OBSERVATION_CAPABILITY_VERSION,
    });
    qwenRunnerObservations.set(observation, record);
    state.runnerObservationIssued = true;
    return observation;
  } catch {
    return null;
  }
}

/** Runner-only consumer. The module-private WeakMap is the issuer authority. */
export function consumePhase698ArchitectureRecoveryQwenRunnerObservation(
  capability: unknown,
): Phase698ArchitectureRecoveryRunnerObservation | null {
  const key = asObject(capability);
  if (!key || consumedQwenRunnerObservations.has(key)) return null;
  const observation = qwenRunnerObservations.get(key);
  if (!observation) return null;
  consumedQwenRunnerObservations.add(key);
  return observation;
}

function expectedQwenIdentity(callId: string) {
  const identity = expectedPhase698ArchitectureRecoveryCallSchedule().find(
    (entry) => entry.callId === callId,
  );
  return identity &&
    (identity.phase === 'rewrite_original_retrieval' ||
      identity.phase === 'rewrite_candidate_retrieval')
    ? identity
    : null;
}

function projectProviderObservation(
  capability: Phase698ArchitectureRecoveryDiagnosticCapability,
  snapshot: Phase698ProviderWireSnapshot,
) {
  if (!isCoherentTerminalSnapshot(snapshot)) {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      capability,
      'provider_dispatch',
      'unknown',
    );
  }
  if (snapshot.counters.providerDispatches !== 1) {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      capability,
      'provider_dispatch',
      snapshot.failureCategory === 'pre_dispatch_abort' ? 'aborted_before_dispatch' : 'unknown',
    );
  }
  if (!advancePhase698ArchitectureRecoveryDiagnosticStage(capability, 'provider_dispatch')) {
    return false;
  }
  if (!setPhase698ArchitectureRecoveryProviderBoundary(capability, 'dispatched_no_response')) {
    return false;
  }
  if (snapshot.counters.providerResponses !== 1) {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      capability,
      'provider_response',
      failureBeforeResponse(snapshot.failureCategory),
    );
  }
  if (!setPhase698ArchitectureRecoveryProviderBoundary(capability, 'response_observed'))
    return false;
  const responseFailure = responseFailureReason(snapshot.failureCategory);
  if (responseFailure !== null) {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      capability,
      'provider_response',
      responseFailure,
    );
  }
  if (!advancePhase698ArchitectureRecoveryDiagnosticStage(capability, 'provider_response')) {
    return false;
  }
  if (
    !setPhase698ArchitectureRecoveryShapeBuckets(capability, {
      topLevelTypeBucket: snapshot.topLevelTypeBucket,
      fieldCountBucket: snapshot.fieldCountBucket,
    })
  ) {
    return false;
  }
  if (!snapshot.stages.includes('provider_envelope_validated')) {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      capability,
      'provider_envelope',
      snapshot.failureCategory === 'provider_envelope_invalid'
        ? 'provider_envelope_invalid'
        : 'unknown',
    );
  }
  return advancePhase698ArchitectureRecoveryDiagnosticStage(capability, 'provider_envelope');
}

function passOrFail(
  capability: Phase698ArchitectureRecoveryQwenDiagnosticCapability,
  stage:
    | 'admission'
    | 'request_contract'
    | 'cost_contract'
    | 'ranking_contract'
    | 'call_result_contract',
  status: string,
  passingStatus: string,
) {
  const internal = readSessionState(capability)?.diagnosticCapability;
  if (!internal) return false;
  if (status === passingStatus) {
    return advancePhase698ArchitectureRecoveryDiagnosticStage(internal, stage);
  }
  return failPhase698ArchitectureRecoveryDiagnosticStage(
    internal,
    stage,
    knownFailure(stage, status),
  );
}

function knownFailure(
  stage:
    | 'admission'
    | 'request_contract'
    | 'cost_contract'
    | 'ranking_contract'
    | 'call_result_contract',
  status: string,
): Phase698ArchitectureRecoveryDiagnosticReasonCode {
  const allowed: Record<typeof stage, readonly string[]> = {
    admission: [
      'invalid_input',
      'principal_binding_invalid',
      'capability_invalid',
      'aborted_before_dispatch',
    ],
    request_contract: ['invalid_input', 'aborted_before_dispatch'],
    cost_contract: ['cost_mismatch'],
    ranking_contract: ['ranking_invalid'],
    call_result_contract: ['result_shape_invalid', 'phase_mismatch'],
  };
  return allowed[stage].includes(status)
    ? (status as Phase698ArchitectureRecoveryDiagnosticReasonCode)
    : 'unknown';
}

function readSessionState(capability: unknown): QwenSessionState | null {
  if ((typeof capability !== 'object' && typeof capability !== 'function') || capability === null) {
    return null;
  }
  return qwenCapabilities.get(capability) ?? null;
}

function readTerminalSnapshot(state: QwenSessionState | null): Phase698ProviderWireSnapshot | null {
  if (!state || !state.providerObservationRecorded || state.wireCapability === null) return null;
  const snapshot = readPhase698ProviderWireSnapshot(state.wireCapability);
  return snapshot && snapshot.state !== 'active' ? snapshot : null;
}

function readWireSnapshot(value: unknown): Phase698ProviderWireSnapshot | null {
  try {
    return readPhase698ProviderWireSnapshot(value as Phase698ProviderWireCapability);
  } catch {
    return null;
  }
}

function isUnusedWireSnapshot(snapshot: Phase698ProviderWireSnapshot) {
  return (
    snapshot.state === 'active' &&
    snapshot.stages.length === 0 &&
    snapshot.lastCompletedStage === null &&
    snapshot.failureCategory === null &&
    snapshot.topLevelTypeBucket === 'not_observed' &&
    snapshot.fieldCountBucket === 'not_observed' &&
    snapshot.counters.executorInvocations === 0 &&
    snapshot.counters.providerDispatches === 0 &&
    snapshot.counters.providerResponses === 0 &&
    snapshot.counters.verifiedUsages === 0
  );
}

function isCoherentTerminalSnapshot(snapshot: Phase698ProviderWireSnapshot) {
  if (snapshot.family !== 'qwen_retrieval' || snapshot.state === 'active') return false;
  if (
    snapshot.stages.length > QWEN_WIRE_SEQUENCE.length ||
    snapshot.stages.some((stage, index) => stage !== QWEN_WIRE_SEQUENCE[index]) ||
    snapshot.lastCompletedStage !== (snapshot.stages.at(-1) ?? null) ||
    snapshot.counters.executorInvocations !==
      Number(snapshot.stages.includes('executor_entered')) ||
    snapshot.counters.providerDispatches !==
      Number(snapshot.stages.includes('provider_dispatch_started')) ||
    snapshot.counters.providerResponses !==
      Number(snapshot.stages.includes('provider_response_received')) ||
    snapshot.counters.verifiedUsages !== Number(snapshot.stages.includes('usage_validated'))
  ) {
    return false;
  }
  return snapshot.state === 'succeeded'
    ? snapshot.failureCategory === null && snapshot.stages.length === QWEN_WIRE_SEQUENCE.length
    : snapshot.failureCategory !== null;
}

function failureBeforeResponse(
  category: Phase698ProviderWireFailureCategory | null,
): Phase698ArchitectureRecoveryDiagnosticReasonCode {
  switch (category) {
    case 'transport':
      return 'transport_failure';
    case 'post_dispatch_abort':
      return 'aborted_after_dispatch';
    case 'response_not_observed':
      return 'response_not_observed';
    default:
      return 'unknown';
  }
}

function responseFailureReason(
  category: Phase698ProviderWireFailureCategory | null,
): Phase698ArchitectureRecoveryDiagnosticReasonCode | null {
  switch (category) {
    case 'http_auth':
    case 'http_rate_limit':
    case 'http_client':
    case 'http_server':
      return category;
    case 'post_dispatch_abort':
      return 'aborted_after_dispatch';
    default:
      return null;
  }
}

function asObject(value: unknown): object | null {
  return (typeof value === 'object' || typeof value === 'function') && value !== null
    ? value
    : null;
}
