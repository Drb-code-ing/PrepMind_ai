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
  setPhase698ArchitectureRecoveryTerminalCountBucket,
  type Phase698ArchitectureRecoveryBoundedDiagnostic,
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

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_FINAL_RESPONSE_DIAGNOSTIC_CAPABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-stream-diagnostic-capability-v1' as const;

export type Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability = Readonly<{
  version: typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_FINAL_RESPONSE_DIAGNOSTIC_CAPABILITY_VERSION;
}>;

export type Phase698ArchitectureRecoveryFinalResponseDiagnosticSession = Readonly<{
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability;
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
type CitationStatus =
  | 'accepted'
  | 'citation_ledger_invalid'
  | 'grounding_invalid'
  | 'critical_notice_missing'
  | 'false_tool_success';
type TraceStatus = 'accepted' | 'trace_missing' | 'trace_status_invalid' | 'trace_identity_invalid';
type CostStatus = 'accepted' | 'cost_mismatch';
type DeliveryStatus = 'accepted' | 'delivery_invalid';
type CallResultStatus = 'accepted' | 'result_shape_invalid' | 'phase_mismatch';

type FinalResponseSessionState = {
  diagnosticCapability: Phase698ArchitectureRecoveryDiagnosticCapability;
  wireCapability: Phase698ProviderWireCapability | null;
  providerObservationRecorded: boolean;
  runnerObservationIssued: boolean;
};

const FINAL_RESPONSE_WIRE_SEQUENCE = Object.freeze([
  'executor_entered',
  'request_validated',
  'provider_dispatch_started',
  'provider_response_received',
  'stream_events_validated',
  'provider_terminal_validated',
  'usage_validated',
] as const);

const finalResponseCapabilities = new WeakMap<object, FinalResponseSessionState>();
const boundWireCapabilities = new WeakSet<object>();
const finalResponseRunnerObservations = new WeakMap<
  object,
  Phase698ArchitectureRecoveryRunnerObservation
>();
const consumedFinalResponseRunnerObservations = new WeakSet<object>();

export function createPhase698ArchitectureRecoveryFinalResponseDiagnosticSession(
  wireCapability: unknown,
): Phase698ArchitectureRecoveryFinalResponseDiagnosticSession {
  const diagnosticCapability =
    createPhase698ArchitectureRecoveryDiagnosticState('final_response_model');
  const capability = Object.freeze({
    version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_FINAL_RESPONSE_DIAGNOSTIC_CAPABILITY_VERSION,
  });
  const snapshot = readWireSnapshot(wireCapability);
  const wireObject = asObject(wireCapability);
  const available =
    snapshot !== null &&
    wireObject !== null &&
    snapshot.family === 'final_response_stream' &&
    isUnusedWireSnapshot(snapshot) &&
    !boundWireCapabilities.has(wireObject);
  finalResponseCapabilities.set(capability, {
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
      if (!value) {
        throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_FINAL_RESPONSE_STATE_MISSING');
      }
      return value;
    },
  });
}

export function recordPhase698ArchitectureRecoveryFinalResponseAdmission(
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability,
  status: AdmissionStatus,
): boolean {
  return passOrFail(capability, 'admission', status, 'accepted');
}

export function recordPhase698ArchitectureRecoveryFinalResponseRequestContract(
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability,
  status: RequestStatus,
): boolean {
  return passOrFail(capability, 'request_contract', status, 'accepted');
}

export function recordPhase698ArchitectureRecoveryFinalResponseProviderObservation(
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability,
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

export function recordPhase698ArchitectureRecoveryFinalResponseStreamContract(
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability,
): boolean {
  const state = readSessionState(capability);
  const snapshot = readTerminalSnapshot(state);
  if (!state || !snapshot) return false;
  if (snapshot.failureCategory === 'stream_event_invalid') {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      state.diagnosticCapability,
      'stream_event_contract',
      'stream_event_invalid',
    );
  }
  if (
    !snapshot.stages.includes('stream_events_validated') &&
    ![
      'terminal_missing',
      'terminal_duplicate',
      'terminal_not_last',
      'false_tool_success',
      'usage_invalid',
    ].includes(snapshot.failureCategory ?? '')
  ) {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      state.diagnosticCapability,
      'stream_event_contract',
      'unknown',
    );
  }
  return advancePhase698ArchitectureRecoveryDiagnosticStage(
    state.diagnosticCapability,
    'stream_event_contract',
  );
}

export function recordPhase698ArchitectureRecoveryFinalResponseTerminalLedger(
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability,
): boolean {
  const state = readSessionState(capability);
  const snapshot = readTerminalSnapshot(state);
  if (!state || !snapshot) return false;
  const mapping = terminalFailure(snapshot.failureCategory);
  if (
    !setPhase698ArchitectureRecoveryTerminalCountBucket(
      state.diagnosticCapability,
      mapping?.bucket ?? '1',
    )
  ) {
    return false;
  }
  if (mapping) {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      state.diagnosticCapability,
      'terminal_ledger',
      mapping.reason,
    );
  }
  return advancePhase698ArchitectureRecoveryDiagnosticStage(
    state.diagnosticCapability,
    'terminal_ledger',
  );
}

export function recordPhase698ArchitectureRecoveryFinalResponseCitationLedger(
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability,
  status: CitationStatus,
): boolean {
  const state = readSessionState(capability);
  const snapshot = readTerminalSnapshot(state);
  if (!state || !snapshot) return false;
  const effectiveStatus =
    snapshot.failureCategory === 'false_tool_success' ? 'false_tool_success' : status;
  return passOrFail(capability, 'citation_ledger', effectiveStatus, 'accepted');
}

export function recordPhase698ArchitectureRecoveryFinalResponseTrace(
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability,
  status: TraceStatus,
): boolean {
  return passOrFail(capability, 'trace_contract', status, 'accepted');
}

export function recordPhase698ArchitectureRecoveryFinalResponseUsage(
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability,
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

export function recordPhase698ArchitectureRecoveryFinalResponseCost(
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability,
  status: CostStatus,
): boolean {
  return passOrFail(capability, 'cost_contract', status, 'accepted');
}

export function recordPhase698ArchitectureRecoveryFinalResponseDelivery(
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability,
  status: DeliveryStatus,
): boolean {
  return passOrFail(capability, 'delivery_contract', status, 'accepted');
}

export function recordPhase698ArchitectureRecoveryFinalResponseCallResult(
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability,
  status: CallResultStatus,
): boolean {
  return passOrFail(capability, 'call_result_contract', status, 'accepted');
}

export function completePhase698ArchitectureRecoveryFinalResponseDiagnostic(
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability,
): boolean {
  const internal = readSessionState(capability)?.diagnosticCapability;
  return internal ? completePhase698ArchitectureRecoveryDiagnosticState(internal) : false;
}

/** Read-only, single-use bridge from the module-owned terminal state into the R3 runner. */
export function createPhase698ArchitectureRecoveryFinalResponseRunnerObservation(
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability,
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
    const identity = expectedFinalResponseIdentity(callId);
    if (!identity) return null;
    const record = validatePhase698ArchitectureRecoveryRunnerObservation(
      {
        family: 'final_response',
        callId,
        callPhase: 'final_response_model',
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
    finalResponseRunnerObservations.set(observation, record);
    state.runnerObservationIssued = true;
    return observation;
  } catch {
    return null;
  }
}

/** Runner-only consumer. The module-private WeakMap is the issuer authority. */
export function consumePhase698ArchitectureRecoveryFinalResponseRunnerObservation(
  capability: unknown,
): Phase698ArchitectureRecoveryRunnerObservation | null {
  const key = asObject(capability);
  if (!key || consumedFinalResponseRunnerObservations.has(key)) return null;
  const observation = finalResponseRunnerObservations.get(key);
  if (!observation) return null;
  consumedFinalResponseRunnerObservations.add(key);
  return observation;
}

function expectedFinalResponseIdentity(callId: string) {
  const identity = expectedPhase698ArchitectureRecoveryCallSchedule().find(
    (entry) => entry.callId === callId,
  );
  return identity?.phase === 'final_response_model' ? identity : null;
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
  return setPhase698ArchitectureRecoveryShapeBuckets(capability, {
    topLevelTypeBucket: snapshot.topLevelTypeBucket,
    fieldCountBucket: snapshot.fieldCountBucket,
  });
}

function passOrFail(
  capability: Phase698ArchitectureRecoveryFinalResponseDiagnosticCapability,
  stage:
    | 'admission'
    | 'request_contract'
    | 'citation_ledger'
    | 'trace_contract'
    | 'cost_contract'
    | 'delivery_contract'
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
    | 'citation_ledger'
    | 'trace_contract'
    | 'cost_contract'
    | 'delivery_contract'
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
    citation_ledger: [
      'citation_ledger_invalid',
      'grounding_invalid',
      'critical_notice_missing',
      'false_tool_success',
    ],
    trace_contract: ['trace_missing', 'trace_status_invalid', 'trace_identity_invalid'],
    cost_contract: ['cost_mismatch'],
    delivery_contract: ['delivery_invalid'],
    call_result_contract: ['result_shape_invalid', 'phase_mismatch'],
  };
  return allowed[stage].includes(status)
    ? (status as Phase698ArchitectureRecoveryDiagnosticReasonCode)
    : 'unknown';
}

function terminalFailure(category: Phase698ProviderWireFailureCategory | null): Readonly<{
  bucket: '0' | '1' | '2_plus';
  reason: Extract<
    Phase698ArchitectureRecoveryDiagnosticReasonCode,
    'terminal_missing' | 'terminal_duplicate' | 'terminal_not_last'
  >;
}> | null {
  if (category === 'terminal_missing') return { bucket: '0', reason: 'terminal_missing' };
  if (category === 'terminal_duplicate') {
    return { bucket: '2_plus', reason: 'terminal_duplicate' };
  }
  if (category === 'terminal_not_last') return { bucket: '1', reason: 'terminal_not_last' };
  return null;
}

function readSessionState(capability: unknown): FinalResponseSessionState | null {
  if ((typeof capability !== 'object' && typeof capability !== 'function') || capability === null) {
    return null;
  }
  return finalResponseCapabilities.get(capability) ?? null;
}

function readTerminalSnapshot(
  state: FinalResponseSessionState | null,
): Phase698ProviderWireSnapshot | null {
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
  if (snapshot.family !== 'final_response_stream' || snapshot.state === 'active') return false;
  if (
    snapshot.stages.length > FINAL_RESPONSE_WIRE_SEQUENCE.length ||
    snapshot.stages.some((stage, index) => stage !== FINAL_RESPONSE_WIRE_SEQUENCE[index]) ||
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
    ? snapshot.failureCategory === null &&
        snapshot.stages.length === FINAL_RESPONSE_WIRE_SEQUENCE.length
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
