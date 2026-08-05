import {
  PHASE_6_9_7_V7_WIRE_STAGES,
  readPhase697V7WireSnapshot,
  type Phase697V7WireCapability,
  type Phase697V7WireFailureCategory,
  type Phase697V7WireSnapshot,
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
  type Phase698ArchitectureRecoveryDiagnosticCapability,
  type Phase698ArchitectureRecoveryDiagnosticReasonCode,
  type Phase698ArchitectureRecoveryDiagnosticSnapshot,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.ts';

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_REWRITE_DIAGNOSTIC_CAPABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-rewrite-diagnostic-capability-v1' as const;

export type Phase698ArchitectureRecoveryRewriteDiagnosticCapability = Readonly<{
  version: typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_REWRITE_DIAGNOSTIC_CAPABILITY_VERSION;
}>;

export type Phase698ArchitectureRecoveryRewriteDiagnosticSession = Readonly<{
  capability: Phase698ArchitectureRecoveryRewriteDiagnosticCapability;
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
type RuntimeStatus = 'accepted' | 'runtime_result_invalid' | 'provenance_invalid';
type CandidateStatus =
  | 'applied'
  | 'candidate_not_applied'
  | 'candidate_rejected'
  | 'fallback_original'
  | 'unsafe_rewrite';
type LocalAuthorityStatus = 'accepted' | 'rewrite_authority_invalid' | 'unsafe_rewrite';
type TraceStatus = 'accepted' | 'trace_missing' | 'trace_status_invalid' | 'trace_identity_invalid';
type CostStatus = 'accepted' | 'cost_mismatch';
type CallResultStatus = 'accepted' | 'result_shape_invalid' | 'phase_mismatch';

type RewriteSessionState = {
  diagnosticCapability: Phase698ArchitectureRecoveryDiagnosticCapability;
  wireCapability: Phase697V7WireCapability | null;
  providerObservationRecorded: boolean;
};

const rewriteCapabilities = new WeakMap<object, RewriteSessionState>();
const boundWireCapabilities = new WeakSet<object>();

export function createPhase698ArchitectureRecoveryRewriteDiagnosticSession(
  wireCapability: unknown,
): Phase698ArchitectureRecoveryRewriteDiagnosticSession {
  const diagnosticCapability =
    createPhase698ArchitectureRecoveryDiagnosticState('rewrite_candidate_model');
  const capability = Object.freeze({
    version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_REWRITE_DIAGNOSTIC_CAPABILITY_VERSION,
  });
  const wireSnapshot = readWireSnapshot(wireCapability);
  const wireCapabilityObject = asObject(wireCapability);
  const wireAvailable =
    wireSnapshot !== null &&
    wireCapabilityObject !== null &&
    isUnusedWireSnapshot(wireSnapshot) &&
    !boundWireCapabilities.has(wireCapabilityObject);
  const state: RewriteSessionState = {
    diagnosticCapability,
    wireCapability: wireAvailable ? (wireCapability as Phase697V7WireCapability) : null,
    providerObservationRecorded: false,
  };
  rewriteCapabilities.set(capability, state);
  if (wireAvailable) {
    boundWireCapabilities.add(wireCapabilityObject);
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
      const snapshot = readPhase698ArchitectureRecoveryDiagnosticSnapshot(diagnosticCapability);
      if (!snapshot) throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_REWRITE_STATE_MISSING');
      return snapshot;
    },
  });
}

export function recordPhase698ArchitectureRecoveryRewriteAdmission(
  capability: Phase698ArchitectureRecoveryRewriteDiagnosticCapability,
  status: AdmissionStatus,
): boolean {
  return passOrFail(capability, 'admission', status, 'accepted');
}

export function recordPhase698ArchitectureRecoveryRewriteRequestContract(
  capability: Phase698ArchitectureRecoveryRewriteDiagnosticCapability,
  status: RequestStatus,
): boolean {
  return passOrFail(capability, 'request_contract', status, 'accepted');
}

/**
 * Projects the terminal first-party wire snapshot into the rewrite diagnostic.
 * The caller cannot supply dispatch/response/envelope statuses or response data.
 */
export function recordPhase698ArchitectureRecoveryRewriteProviderObservation(
  capability: Phase698ArchitectureRecoveryRewriteDiagnosticCapability,
): boolean {
  const state = readSessionState(capability);
  if (!state || state.providerObservationRecorded || state.wireCapability === null) return false;
  const internal = state.diagnosticCapability;
  if (!isPhase698ArchitectureRecoveryExpectedStage(internal, 'provider_dispatch')) {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      internal,
      'provider_dispatch',
      'unknown',
    );
  }
  const snapshot = readPhase697V7WireSnapshot(state.wireCapability);
  if (!snapshot || snapshot.state === 'active') return false;
  state.providerObservationRecorded = true;
  return projectRewriteProviderObservation(internal, snapshot);
}

export function recordPhase698ArchitectureRecoveryRewriteRuntimeResult(
  capability: Phase698ArchitectureRecoveryRewriteDiagnosticCapability,
  status: RuntimeStatus,
): boolean {
  return passOrFail(capability, 'runtime_result', status, 'accepted');
}

export function recordPhase698ArchitectureRecoveryRewriteCandidateProjection(
  capability: Phase698ArchitectureRecoveryRewriteDiagnosticCapability,
  status: CandidateStatus,
): boolean {
  return passOrFail(capability, 'rewrite_candidate_projection', status, 'applied');
}

export function recordPhase698ArchitectureRecoveryRewriteLocalAuthority(
  capability: Phase698ArchitectureRecoveryRewriteDiagnosticCapability,
  status: LocalAuthorityStatus,
): boolean {
  return passOrFail(capability, 'rewrite_local_authority', status, 'accepted');
}

export function recordPhase698ArchitectureRecoveryRewriteTrace(
  capability: Phase698ArchitectureRecoveryRewriteDiagnosticCapability,
  status: TraceStatus,
): boolean {
  return passOrFail(capability, 'trace_contract', status, 'accepted');
}

export function recordPhase698ArchitectureRecoveryRewriteUsage(
  capability: Phase698ArchitectureRecoveryRewriteDiagnosticCapability,
): boolean {
  const state = readSessionState(capability);
  if (!state || state.wireCapability === null || !state.providerObservationRecorded) return false;
  const internal = state.diagnosticCapability;
  const snapshot = readPhase697V7WireSnapshot(state.wireCapability);
  if (!snapshot || snapshot.state === 'active') return false;
  const failure = usageFailure(snapshot);
  if (failure !== null) {
    return failPhase698ArchitectureRecoveryDiagnosticStage(internal, 'usage_contract', failure);
  }
  if (!advancePhase698ArchitectureRecoveryDiagnosticStage(internal, 'usage_contract')) return false;
  return setPhase698ArchitectureRecoveryProviderBoundary(internal, 'response_and_usage_observed');
}

export function recordPhase698ArchitectureRecoveryRewriteCost(
  capability: Phase698ArchitectureRecoveryRewriteDiagnosticCapability,
  status: CostStatus,
): boolean {
  return passOrFail(capability, 'cost_contract', status, 'accepted');
}

export function recordPhase698ArchitectureRecoveryRewriteCallResult(
  capability: Phase698ArchitectureRecoveryRewriteDiagnosticCapability,
  status: CallResultStatus,
): boolean {
  return passOrFail(capability, 'call_result_contract', status, 'accepted');
}

export function completePhase698ArchitectureRecoveryRewriteDiagnostic(
  capability: Phase698ArchitectureRecoveryRewriteDiagnosticCapability,
): boolean {
  const internal = readInternalCapability(capability);
  return internal ? completePhase698ArchitectureRecoveryDiagnosticState(internal) : false;
}

function passOrFail(
  capability: Phase698ArchitectureRecoveryRewriteDiagnosticCapability,
  stage:
    | 'admission'
    | 'request_contract'
    | 'runtime_result'
    | 'rewrite_candidate_projection'
    | 'rewrite_local_authority'
    | 'trace_contract'
    | 'cost_contract'
    | 'call_result_contract',
  status: string,
  passingStatus: string,
) {
  const internal = readInternalCapability(capability);
  if (!internal) return false;
  if (status === passingStatus) {
    return advancePhase698ArchitectureRecoveryDiagnosticStage(internal, stage);
  }
  return failPhase698ArchitectureRecoveryDiagnosticStage(
    internal,
    stage,
    knownFailureForStage(stage, status),
  );
}

function readInternalCapability(
  capability: unknown,
): Phase698ArchitectureRecoveryDiagnosticCapability | null {
  return readSessionState(capability)?.diagnosticCapability ?? null;
}

function readSessionState(capability: unknown): RewriteSessionState | null {
  if ((typeof capability !== 'object' && typeof capability !== 'function') || capability === null) {
    return null;
  }
  return rewriteCapabilities.get(capability) ?? null;
}

function knownFailureForStage(
  stage:
    | 'admission'
    | 'request_contract'
    | 'runtime_result'
    | 'rewrite_candidate_projection'
    | 'rewrite_local_authority'
    | 'trace_contract'
    | 'cost_contract'
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
    runtime_result: ['runtime_result_invalid', 'provenance_invalid'],
    rewrite_candidate_projection: [
      'candidate_not_applied',
      'candidate_rejected',
      'fallback_original',
      'unsafe_rewrite',
    ],
    rewrite_local_authority: ['rewrite_authority_invalid', 'unsafe_rewrite'],
    trace_contract: ['trace_missing', 'trace_status_invalid', 'trace_identity_invalid'],
    cost_contract: ['cost_mismatch'],
    call_result_contract: ['result_shape_invalid', 'phase_mismatch'],
  };
  return allowed[stage].includes(status)
    ? (status as Phase698ArchitectureRecoveryDiagnosticReasonCode)
    : 'unknown';
}

function readWireSnapshot(value: unknown): Phase697V7WireSnapshot | null {
  try {
    return readPhase697V7WireSnapshot(value as Phase697V7WireCapability);
  } catch {
    return null;
  }
}

function asObject(value: unknown): object | null {
  return (typeof value === 'object' || typeof value === 'function') && value !== null
    ? value
    : null;
}

function isUnusedWireSnapshot(snapshot: Phase697V7WireSnapshot) {
  return (
    snapshot.state === 'active' &&
    snapshot.stages.length === 0 &&
    snapshot.lastCompletedStage === null &&
    snapshot.failureCategory === null &&
    snapshot.usageDisposition === 'not_observed' &&
    snapshot.counters.executorInvocations === 0 &&
    snapshot.counters.providerDispatches === 0 &&
    snapshot.counters.providerResponses === 0 &&
    snapshot.counters.verifiedUsages === 0
  );
}

function projectRewriteProviderObservation(
  capability: Phase698ArchitectureRecoveryDiagnosticCapability,
  snapshot: Phase697V7WireSnapshot,
): boolean {
  if (!isCoherentTerminalWireSnapshot(snapshot)) {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      capability,
      'provider_dispatch',
      'unknown',
    );
  }
  const dispatched = snapshot.counters.providerDispatches === 1;
  const responded = snapshot.counters.providerResponses === 1;
  if (!dispatched) {
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
  if (!responded) {
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      capability,
      'provider_response',
      responseFailureBeforeObservation(snapshot.failureCategory),
    );
  }
  const responseFailure = responseStageFailure(snapshot.failureCategory);
  if (responseFailure !== null) {
    if (!setPhase698ArchitectureRecoveryProviderBoundary(capability, 'response_observed')) {
      return false;
    }
    return failPhase698ArchitectureRecoveryDiagnosticStage(
      capability,
      'provider_response',
      responseFailure,
    );
  }
  if (!advancePhase698ArchitectureRecoveryDiagnosticStage(capability, 'provider_response')) {
    return false;
  }
  if (!setPhase698ArchitectureRecoveryProviderBoundary(capability, 'response_observed')) {
    return false;
  }
  if (snapshot.stages.includes('schema_validated')) {
    if (
      !setPhase698ArchitectureRecoveryShapeBuckets(capability, {
        topLevelTypeBucket: 'object',
        fieldCountBucket: '1',
      })
    ) {
      return false;
    }
    return advancePhase698ArchitectureRecoveryDiagnosticStage(capability, 'provider_envelope');
  }
  if (
    !setPhase698ArchitectureRecoveryShapeBuckets(capability, {
      topLevelTypeBucket: 'unknown',
      fieldCountBucket: 'unknown',
    })
  ) {
    return false;
  }
  return failPhase698ArchitectureRecoveryDiagnosticStage(
    capability,
    'provider_envelope',
    isEnvelopeFailure(snapshot.failureCategory) ? 'provider_envelope_invalid' : 'unknown',
  );
}

function isCoherentTerminalWireSnapshot(snapshot: Phase697V7WireSnapshot) {
  if (snapshot.state === 'active') return false;
  if (
    snapshot.stages.some((stage, index) => stage !== PHASE_6_9_7_V7_WIRE_STAGES[index]) ||
    snapshot.stages.length > PHASE_6_9_7_V7_WIRE_STAGES.length
  ) {
    return false;
  }
  const includes = (stage: (typeof PHASE_6_9_7_V7_WIRE_STAGES)[number]) =>
    snapshot.stages.includes(stage);
  if (
    snapshot.counters.executorInvocations !== Number(includes('executor_entered')) ||
    snapshot.counters.providerDispatches !== Number(includes('provider_dispatch_started')) ||
    snapshot.counters.providerResponses !== Number(includes('provider_response_received')) ||
    snapshot.counters.verifiedUsages !== Number(includes('usage_validated')) ||
    snapshot.lastCompletedStage !== (snapshot.stages.at(-1) ?? null)
  ) {
    return false;
  }
  if (snapshot.state === 'succeeded') {
    return (
      snapshot.failureCategory === null &&
      snapshot.stages.length === PHASE_6_9_7_V7_WIRE_STAGES.length &&
      snapshot.usageDisposition === 'verified'
    );
  }
  return snapshot.failureCategory !== null;
}

function responseFailureBeforeObservation(
  category: Phase697V7WireFailureCategory | null,
): Phase698ArchitectureRecoveryDiagnosticReasonCode {
  switch (category) {
    case 'transport':
      return 'transport_failure';
    case 'post_dispatch_abort':
      return 'aborted_after_dispatch';
    case 'runtime_timeout':
      return 'timeout';
    case 'invalid_response':
      return 'response_not_observed';
    default:
      return 'unknown';
  }
}

function responseStageFailure(
  category: Phase697V7WireFailureCategory | null,
): Phase698ArchitectureRecoveryDiagnosticReasonCode | null {
  switch (category) {
    case 'http_auth':
    case 'http_rate_limit':
    case 'http_client':
    case 'http_server':
      return category;
    case 'post_dispatch_abort':
      return 'aborted_after_dispatch';
    case 'runtime_timeout':
      return 'timeout';
    default:
      return null;
  }
}

function isEnvelopeFailure(category: Phase697V7WireFailureCategory | null) {
  return [
    'response_audit',
    'invalid_response',
    'provider_json_parse',
    'provider_type_validation',
    'provider_object_missing',
  ].includes(category ?? '');
}

function usageFailure(
  snapshot: Phase697V7WireSnapshot,
): Extract<
  Phase698ArchitectureRecoveryDiagnosticReasonCode,
  'dispatch_count_invalid' | 'response_count_invalid' | 'usage_missing' | 'usage_invalid'
> | null {
  if (snapshot.counters.providerDispatches !== 1) return 'dispatch_count_invalid';
  if (snapshot.counters.providerResponses !== 1) return 'response_count_invalid';
  if (snapshot.usageDisposition === 'invalid') return 'usage_invalid';
  if (snapshot.counters.verifiedUsages !== 1 || snapshot.usageDisposition !== 'verified') {
    return 'usage_missing';
  }
  return null;
}
