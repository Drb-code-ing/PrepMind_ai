import {
  assertPhase698TransportEvidenceCallId,
  parsePhase698TransportEvidenceDiagnostic,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_CAPABILITY_VERSION,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
  type Phase698TransportEvidenceCapability,
  type Phase698TransportEvidenceDiagnostic,
} from './phase-6-9-8-retriever-final-response-transport-evidence-contract.ts';

export type Phase698TransportEvidenceFinalResponseCapability =
  Phase698TransportEvidenceCapability & {
    readonly family: 'final_response';
    readonly phase: 'final_response';
  };
export type Phase698TransportEvidenceFinalResponseObservation = Phase698TransportEvidenceDiagnostic;

type FinalResponseState = {
  readonly callId: string;
  observation: Phase698TransportEvidenceFinalResponseObservation | null;
};

const finalResponseStates = new WeakMap<object, FinalResponseState>();
const consumedFinalResponseCapabilities = new WeakSet<object>();

export function createPhase698TransportEvidenceFinalResponseCapability(
  callId: string,
): Phase698TransportEvidenceFinalResponseCapability {
  const canonicalCallId = assertPhase698TransportEvidenceCallId(callId);
  const capability = Object.freeze({
    version: PHASE_6_9_8_TRANSPORT_EVIDENCE_CAPABILITY_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    family: 'final_response' as const,
    phase: 'final_response' as const,
    callId: canonicalCallId,
  });
  finalResponseStates.set(capability, { callId: canonicalCallId, observation: null });
  return capability;
}

export function recordPhase698TransportEvidenceFinalResponseObservation(
  capability: unknown,
  input: unknown,
): Phase698TransportEvidenceFinalResponseObservation | null {
  const state = readFinalResponseState(capability);
  if (!state || consumedFinalResponseCapabilities.has(capability as object)) return null;
  const parsed = parsePhase698TransportEvidenceDiagnostic(input);
  if (
    !parsed ||
    parsed.family !== 'final_response' ||
    parsed.phase !== 'final_response' ||
    parsed.callId !== state.callId
  ) {
    return null;
  }
  consumedFinalResponseCapabilities.add(capability as object);
  state.observation = parsed;
  return parsed;
}

export function readPhase698TransportEvidenceFinalResponseObservation(
  capability: unknown,
): Phase698TransportEvidenceFinalResponseObservation | null {
  return readFinalResponseState(capability)?.observation ?? null;
}

function readFinalResponseState(capability: unknown): FinalResponseState | null {
  if ((typeof capability !== 'object' && typeof capability !== 'function') || capability === null) {
    return null;
  }
  return finalResponseStates.get(capability) ?? null;
}
