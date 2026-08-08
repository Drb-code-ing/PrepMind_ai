import {
  assertPhase698TransportEvidenceCallId,
  parsePhase698TransportEvidenceDiagnostic,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_CAPABILITY_VERSION,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
  type Phase698TransportEvidenceCapability,
  type Phase698TransportEvidenceDiagnostic,
} from './phase-6-9-8-retriever-final-response-transport-evidence-contract.ts';

export type Phase698TransportEvidenceRewriteCapability = Phase698TransportEvidenceCapability & {
  readonly family: 'rewrite';
  readonly phase: 'rewrite';
};
export type Phase698TransportEvidenceRewriteObservation = Phase698TransportEvidenceDiagnostic;

type RewriteState = {
  readonly callId: string;
  observation: Phase698TransportEvidenceRewriteObservation | null;
};

const rewriteStates = new WeakMap<object, RewriteState>();
const consumedRewriteCapabilities = new WeakSet<object>();

export function createPhase698TransportEvidenceRewriteCapability(
  callId: string,
): Phase698TransportEvidenceRewriteCapability {
  const canonicalCallId = assertPhase698TransportEvidenceCallId(callId);
  const capability = Object.freeze({
    version: PHASE_6_9_8_TRANSPORT_EVIDENCE_CAPABILITY_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    family: 'rewrite' as const,
    phase: 'rewrite' as const,
    callId: canonicalCallId,
  });
  rewriteStates.set(capability, { callId: canonicalCallId, observation: null });
  return capability;
}

export function recordPhase698TransportEvidenceRewriteObservation(
  capability: unknown,
  input: unknown,
): Phase698TransportEvidenceRewriteObservation | null {
  const state = readRewriteState(capability);
  if (!state || consumedRewriteCapabilities.has(capability as object)) return null;
  const parsed = parsePhase698TransportEvidenceDiagnostic(input);
  if (
    !parsed ||
    parsed.family !== 'rewrite' ||
    parsed.phase !== 'rewrite' ||
    parsed.callId !== state.callId
  ) {
    return null;
  }
  consumedRewriteCapabilities.add(capability as object);
  state.observation = parsed;
  return parsed;
}

export function readPhase698TransportEvidenceRewriteObservation(
  capability: unknown,
): Phase698TransportEvidenceRewriteObservation | null {
  return readRewriteState(capability)?.observation ?? null;
}

function readRewriteState(capability: unknown): RewriteState | null {
  if ((typeof capability !== 'object' && typeof capability !== 'function') || capability === null) {
    return null;
  }
  return rewriteStates.get(capability) ?? null;
}
