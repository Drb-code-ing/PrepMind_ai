import {
  assertPhase698TransportEvidenceCallId,
  parsePhase698TransportEvidenceDiagnostic,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_CAPABILITY_VERSION,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
  type Phase698TransportEvidenceCapability,
  type Phase698TransportEvidenceDiagnostic,
} from './phase-6-9-8-retriever-final-response-transport-evidence-contract.ts';

export type Phase698TransportEvidenceQwenCapability = Phase698TransportEvidenceCapability & {
  readonly family: 'qwen';
  readonly phase: 'qwen';
};
export type Phase698TransportEvidenceQwenObservation = Phase698TransportEvidenceDiagnostic;

type QwenState = {
  readonly callId: string;
  observation: Phase698TransportEvidenceQwenObservation | null;
};

const qwenStates = new WeakMap<object, QwenState>();
const consumedQwenCapabilities = new WeakSet<object>();

export function createPhase698TransportEvidenceQwenCapability(
  callId: string,
): Phase698TransportEvidenceQwenCapability {
  const canonicalCallId = assertPhase698TransportEvidenceCallId(callId);
  const capability = Object.freeze({
    version: PHASE_6_9_8_TRANSPORT_EVIDENCE_CAPABILITY_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    family: 'qwen' as const,
    phase: 'qwen' as const,
    callId: canonicalCallId,
  });
  qwenStates.set(capability, { callId: canonicalCallId, observation: null });
  return capability;
}

export function recordPhase698TransportEvidenceQwenObservation(
  capability: unknown,
  input: unknown,
): Phase698TransportEvidenceQwenObservation | null {
  const state = readQwenState(capability);
  if (!state || consumedQwenCapabilities.has(capability as object)) return null;
  const parsed = parsePhase698TransportEvidenceDiagnostic(input);
  if (
    !parsed ||
    parsed.family !== 'qwen' ||
    parsed.phase !== 'qwen' ||
    parsed.callId !== state.callId
  ) {
    return null;
  }
  consumedQwenCapabilities.add(capability as object);
  state.observation = parsed;
  return parsed;
}

export function readPhase698TransportEvidenceQwenObservation(
  capability: unknown,
): Phase698TransportEvidenceQwenObservation | null {
  return readQwenState(capability)?.observation ?? null;
}

function readQwenState(capability: unknown): QwenState | null {
  if ((typeof capability !== 'object' && typeof capability !== 'function') || capability === null) {
    return null;
  }
  return qwenStates.get(capability) ?? null;
}
