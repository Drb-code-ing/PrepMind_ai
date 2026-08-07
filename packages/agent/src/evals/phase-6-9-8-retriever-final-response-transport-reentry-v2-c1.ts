import {
  inspectPhase698TransportReentryV2Preflight,
  parsePhase698TransportReentryV2DotEnv,
  projectPhase698TransportReentryV2DedicatedCapabilities,
  readPhase698TransportReentryV2RootDotEnv,
  type Phase698TransportReentryV2CallIds,
  type Phase698TransportReentryV2Failure,
  type Phase698TransportReentryV2ProjectionResult,
  type Phase698TransportReentryV2PreflightInput,
} from './phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts';

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS = Object.freeze({
  rewrite: 'rewrite_01',
  qwen: 'qwen_01',
  final_response: 'final_response_01',
} satisfies Phase698TransportReentryV2CallIds);

export type Phase698TransportReentryV2C1PreparationResult =
  | Readonly<{
      ok: true;
      projection: NonNullable<
        Extract<Phase698TransportReentryV2ProjectionResult, { ok: true }>
      >['projection'];
      providerCalls: 0;
      credentialReads: 0;
      formalEvidence: 0;
    }>
  | Phase698TransportReentryV2Failure;

/**
 * The only C1 composition entry. Preflight is evaluated before the generic
 * credential object is inspected, so a blocked gate cannot trigger a secret
 * accessor or a file read.
 */
export function preparePhase698TransportReentryV2C1Projection(
  preflightInput: Phase698TransportReentryV2PreflightInput,
  genericInput: unknown,
  callIds: Phase698TransportReentryV2CallIds = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS,
): Phase698TransportReentryV2C1PreparationResult {
  const gate = inspectPhase698TransportReentryV2Preflight(preflightInput);
  if (!gate.ok) return gate;
  const projected = projectPhase698TransportReentryV2DedicatedCapabilities(
    gate.capability,
    genericInput,
    callIds,
  );
  if (!projected.ok) return projected;
  return Object.freeze({
    ok: true as const,
    projection: projected.projection,
    providerCalls: 0 as const,
    credentialReads: 0 as const,
    formalEvidence: 0 as const,
  });
}

/**
 * Production launcher shape. The file reader is injectable for zero-provider
 * tests; no ambient environment lookup is performed here.
 */
export function preparePhase698TransportReentryV2C1ProjectionFromRootEnv(
  preflightInput: Phase698TransportReentryV2PreflightInput,
  launcherLocation: string | URL,
  readBytes: (path: string) => Uint8Array,
  callIds: Phase698TransportReentryV2CallIds = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS,
): Phase698TransportReentryV2C1PreparationResult {
  const gate = inspectPhase698TransportReentryV2Preflight(preflightInput);
  if (!gate.ok) return gate;
  const parsed = readPhase698TransportReentryV2RootDotEnv(launcherLocation, readBytes);
  if (!parsed.ok) return parsed;
  return prepareProjectionAfterConsumedGate(gate.capability, parsed.values, callIds);
}

function prepareProjectionAfterConsumedGate(
  capability: unknown,
  genericInput: unknown,
  callIds: Phase698TransportReentryV2CallIds,
): Phase698TransportReentryV2C1PreparationResult {
  const projected = projectPhase698TransportReentryV2DedicatedCapabilities(
    capability,
    genericInput,
    callIds,
  );
  if (!projected.ok) return projected;
  return Object.freeze({
    ok: true as const,
    projection: projected.projection,
    providerCalls: 0 as const,
    credentialReads: 0 as const,
    formalEvidence: 0 as const,
  });
}

export function parsePhase698TransportReentryV2C1SyntheticEnv(input: string) {
  return parsePhase698TransportReentryV2DotEnv(input);
}
