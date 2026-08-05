export const PHASE_6_9_8_PROVIDER_WIRE_DIAGNOSTICS_VERSION =
  'phase-6.9.8-provider-wire-diagnostics-v1' as const;
export const PHASE_6_9_8_PROVIDER_WIRE_CAPABILITY_VERSION =
  'phase-6.9.8-provider-wire-capability-v1' as const;

export const PHASE_6_9_8_PROVIDER_WIRE_FAMILIES = [
  'qwen_retrieval',
  'final_response_stream',
] as const;

export const PHASE_6_9_8_PROVIDER_WIRE_STAGES = [
  'executor_entered',
  'request_validated',
  'provider_dispatch_started',
  'provider_response_received',
  'provider_envelope_validated',
  'embedding_validated',
  'stream_events_validated',
  'provider_terminal_validated',
  'usage_validated',
] as const;

export const PHASE_6_9_8_PROVIDER_WIRE_FAILURE_CATEGORIES = [
  'request_contract',
  'pre_dispatch_abort',
  'post_dispatch_abort',
  'transport',
  'http_auth',
  'http_rate_limit',
  'http_client',
  'http_server',
  'response_not_observed',
  'provider_envelope_invalid',
  'embedding_count_invalid',
  'embedding_dimension_invalid',
  'embedding_value_invalid',
  'stream_event_invalid',
  'terminal_missing',
  'terminal_duplicate',
  'terminal_not_last',
  'false_tool_success',
  'usage_invalid',
  'unknown',
] as const;

export const PHASE_6_9_8_PROVIDER_WIRE_TOP_LEVEL_TYPE_BUCKETS = [
  'object',
  'array',
  'string',
  'number',
  'boolean',
  'null',
  'not_observed',
  'unknown',
] as const;

export const PHASE_6_9_8_PROVIDER_WIRE_FIELD_COUNT_BUCKETS = [
  '0',
  '1',
  '2_4',
  '5_plus',
  'not_observed',
  'unknown',
] as const;

export type Phase698ProviderWireFamily = (typeof PHASE_6_9_8_PROVIDER_WIRE_FAMILIES)[number];
export type Phase698ProviderWireStage = (typeof PHASE_6_9_8_PROVIDER_WIRE_STAGES)[number];
export type Phase698ProviderWireFailureCategory =
  (typeof PHASE_6_9_8_PROVIDER_WIRE_FAILURE_CATEGORIES)[number];
export type Phase698ProviderWireTopLevelTypeBucket =
  (typeof PHASE_6_9_8_PROVIDER_WIRE_TOP_LEVEL_TYPE_BUCKETS)[number];
export type Phase698ProviderWireFieldCountBucket =
  (typeof PHASE_6_9_8_PROVIDER_WIRE_FIELD_COUNT_BUCKETS)[number];

export type Phase698ProviderWireCapability = Readonly<{
  version: typeof PHASE_6_9_8_PROVIDER_WIRE_CAPABILITY_VERSION;
}>;

export type Phase698ProviderWireSnapshot = Readonly<{
  version: typeof PHASE_6_9_8_PROVIDER_WIRE_DIAGNOSTICS_VERSION;
  family: Phase698ProviderWireFamily;
  state: 'active' | 'succeeded' | 'failed';
  stages: readonly Phase698ProviderWireStage[];
  lastCompletedStage: Phase698ProviderWireStage | null;
  failureCategory: Phase698ProviderWireFailureCategory | null;
  topLevelTypeBucket: Phase698ProviderWireTopLevelTypeBucket;
  fieldCountBucket: Phase698ProviderWireFieldCountBucket;
  counters: Readonly<{
    executorInvocations: number;
    providerDispatches: number;
    providerResponses: number;
    verifiedUsages: number;
  }>;
}>;

export type Phase698ProviderWireDiagnostics = Readonly<{
  capability: Phase698ProviderWireCapability;
  readSnapshot(): Phase698ProviderWireSnapshot;
}>;

type InternalState = {
  family: Phase698ProviderWireFamily;
  claimed: boolean;
  stages: Phase698ProviderWireStage[];
  terminal: Readonly<{
    state: 'succeeded' | 'failed';
    failureCategory: Phase698ProviderWireFailureCategory | null;
  }> | null;
  topLevelTypeBucket: Phase698ProviderWireTopLevelTypeBucket;
  fieldCountBucket: Phase698ProviderWireFieldCountBucket;
};

const STAGES_BY_FAMILY = Object.freeze({
  qwen_retrieval: Object.freeze([
    'executor_entered',
    'request_validated',
    'provider_dispatch_started',
    'provider_response_received',
    'provider_envelope_validated',
    'embedding_validated',
    'usage_validated',
  ] as const),
  final_response_stream: Object.freeze([
    'executor_entered',
    'request_validated',
    'provider_dispatch_started',
    'provider_response_received',
    'stream_events_validated',
    'provider_terminal_validated',
    'usage_validated',
  ] as const),
} satisfies Record<Phase698ProviderWireFamily, readonly Phase698ProviderWireStage[]>);

const states = new WeakMap<object, InternalState>();

export function createPhase698ProviderWireDiagnostics(
  family: Phase698ProviderWireFamily,
): Phase698ProviderWireDiagnostics {
  if (!PHASE_6_9_8_PROVIDER_WIRE_FAMILIES.includes(family)) {
    throw new Error('INVALID_PHASE_6_9_8_PROVIDER_WIRE_FAMILY');
  }
  const capability = Object.freeze({
    version: PHASE_6_9_8_PROVIDER_WIRE_CAPABILITY_VERSION,
  });
  const state: InternalState = {
    family,
    claimed: false,
    stages: [],
    terminal: null,
    topLevelTypeBucket: 'not_observed',
    fieldCountBucket: 'not_observed',
  };
  states.set(capability, state);
  return Object.freeze({
    capability,
    readSnapshot: () => snapshot(state),
  });
}

/** Internal first-party adapter transition. It is not re-exported from @repo/ai. */
export function claimPhase698ProviderWireCapability(
  capability: Phase698ProviderWireCapability,
  family: Phase698ProviderWireFamily,
): boolean {
  const state = readState(capability);
  if (
    !state ||
    state.family !== family ||
    state.claimed ||
    state.terminal !== null ||
    state.stages.length !== 0
  ) {
    return false;
  }
  state.claimed = true;
  state.stages.push('executor_entered');
  return true;
}

/** Internal first-party adapter transition. It is not re-exported from @repo/ai. */
export function advancePhase698ProviderWireStage(
  capability: Phase698ProviderWireCapability,
  stage: Phase698ProviderWireStage,
): boolean {
  const state = readState(capability);
  if (!state || !state.claimed || state.terminal !== null) return false;
  const sequence = STAGES_BY_FAMILY[state.family];
  const expected = sequence[state.stages.length];
  if (stage !== expected) {
    failInternal(state, 'unknown');
    return false;
  }
  state.stages.push(stage);
  return true;
}

/** Internal first-party adapter transition. It is not re-exported from @repo/ai. */
export function failPhase698ProviderWire(
  capability: Phase698ProviderWireCapability,
  category: Phase698ProviderWireFailureCategory,
): boolean {
  const state = readState(capability);
  if (!state || !state.claimed || state.terminal !== null) return false;
  failInternal(state, isFailureCompatible(state, category) ? category : 'unknown');
  return true;
}

/** Internal first-party adapter transition. It is not re-exported from @repo/ai. */
export function completePhase698ProviderWire(capability: Phase698ProviderWireCapability): boolean {
  const state = readState(capability);
  if (!state || !state.claimed || state.terminal !== null) return false;
  if (state.stages.length !== STAGES_BY_FAMILY[state.family].length) {
    failInternal(state, 'unknown');
    return false;
  }
  state.terminal = Object.freeze({ state: 'succeeded', failureCategory: null });
  return true;
}

/** Internal first-party adapter transition. It is not re-exported from @repo/ai. */
export function setPhase698ProviderWireShapeBuckets(
  capability: Phase698ProviderWireCapability,
  input: Readonly<{
    topLevelTypeBucket: Phase698ProviderWireTopLevelTypeBucket;
    fieldCountBucket: Phase698ProviderWireFieldCountBucket;
  }>,
): boolean {
  const state = readState(capability);
  if (
    !state ||
    state.terminal !== null ||
    !state.stages.includes('provider_response_received') ||
    state.topLevelTypeBucket !== 'not_observed' ||
    state.fieldCountBucket !== 'not_observed' ||
    !PHASE_6_9_8_PROVIDER_WIRE_TOP_LEVEL_TYPE_BUCKETS.includes(input.topLevelTypeBucket) ||
    !PHASE_6_9_8_PROVIDER_WIRE_FIELD_COUNT_BUCKETS.includes(input.fieldCountBucket)
  ) {
    return false;
  }
  state.topLevelTypeBucket = input.topLevelTypeBucket;
  state.fieldCountBucket = input.fieldCountBucket;
  return true;
}

export function readPhase698ProviderWireSnapshot(
  capability: Phase698ProviderWireCapability,
): Phase698ProviderWireSnapshot | null {
  const state = readState(capability);
  return state ? snapshot(state) : null;
}

function readState(capability: unknown): InternalState | null {
  if ((typeof capability !== 'object' && typeof capability !== 'function') || capability === null) {
    return null;
  }
  return states.get(capability) ?? null;
}

function failInternal(state: InternalState, category: Phase698ProviderWireFailureCategory) {
  state.terminal = Object.freeze({ state: 'failed', failureCategory: category });
}

function isFailureCompatible(state: InternalState, category: Phase698ProviderWireFailureCategory) {
  const last = state.stages.at(-1) ?? null;
  const hasDispatch = state.stages.includes('provider_dispatch_started');
  const hasResponse = state.stages.includes('provider_response_received');
  switch (category) {
    case 'request_contract':
      return last === 'executor_entered';
    case 'pre_dispatch_abort':
      return state.claimed && !hasDispatch;
    case 'post_dispatch_abort':
      return hasDispatch;
    case 'transport':
    case 'response_not_observed':
      return hasDispatch && !hasResponse;
    case 'http_auth':
    case 'http_rate_limit':
    case 'http_client':
    case 'http_server':
    case 'provider_envelope_invalid':
      return hasResponse;
    case 'embedding_count_invalid':
    case 'embedding_dimension_invalid':
    case 'embedding_value_invalid':
      return state.family === 'qwen_retrieval' && last === 'provider_envelope_validated';
    case 'stream_event_invalid':
    case 'terminal_missing':
    case 'terminal_duplicate':
    case 'terminal_not_last':
    case 'false_tool_success':
      return state.family === 'final_response_stream' && hasResponse;
    case 'usage_invalid':
      return (
        (state.family === 'qwen_retrieval' && last === 'embedding_validated') ||
        (state.family === 'final_response_stream' && hasResponse)
      );
    case 'unknown':
      return true;
    default:
      return false;
  }
}

function snapshot(state: InternalState): Phase698ProviderWireSnapshot {
  const stages = Object.freeze([...state.stages]);
  return Object.freeze({
    version: PHASE_6_9_8_PROVIDER_WIRE_DIAGNOSTICS_VERSION,
    family: state.family,
    state: state.terminal?.state ?? 'active',
    stages,
    lastCompletedStage: stages.at(-1) ?? null,
    failureCategory: state.terminal?.failureCategory ?? null,
    topLevelTypeBucket: state.topLevelTypeBucket,
    fieldCountBucket: state.fieldCountBucket,
    counters: Object.freeze({
      executorInvocations: state.claimed ? 1 : 0,
      providerDispatches: stages.includes('provider_dispatch_started') ? 1 : 0,
      providerResponses: stages.includes('provider_response_received') ? 1 : 0,
      verifiedUsages: stages.includes('usage_validated') ? 1 : 0,
    }),
  });
}
