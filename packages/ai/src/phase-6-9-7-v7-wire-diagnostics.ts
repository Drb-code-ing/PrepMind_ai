import type {
  ModelAgentProviderFailureCategory,
  ModelAgentStructuredOutputStage,
} from './model-agent-contract.ts';

export const PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION =
  'phase-6.9.7-v7-wire-diagnostics-v1' as const;
export const PHASE_6_9_7_V7_WIRE_CAPABILITY_VERSION = 'phase-6.9.7-v7-wire-capability-v1' as const;

export const PHASE_6_9_7_V7_WIRE_STAGES = Object.freeze([
  'executor_entered',
  'request_validated',
  'provider_dispatch_started',
  'provider_response_received',
  'response_audit_passed',
  'content_parsed',
  'schema_validated',
  'usage_validated',
] as const);

export type Phase697V7WireStage = (typeof PHASE_6_9_7_V7_WIRE_STAGES)[number];

export const PHASE_6_9_7_V7_WIRE_FAILURE_CATEGORIES = Object.freeze([
  'request_contract',
  'transport',
  'http_auth',
  'http_rate_limit',
  'http_client',
  'http_server',
  'response_audit',
  'invalid_response',
  'provider_json_parse',
  'provider_type_validation',
  'provider_object_missing',
  'usage_validation',
  'pre_dispatch_abort',
  'post_dispatch_abort',
  'runtime_timeout',
  'harness_internal',
  'evidence_io',
  'unknown',
] as const);

export type Phase697V7WireFailureCategory = (typeof PHASE_6_9_7_V7_WIRE_FAILURE_CATEGORIES)[number];

export type Phase697V7WireCapability = Readonly<{
  version: typeof PHASE_6_9_7_V7_WIRE_CAPABILITY_VERSION;
}>;

export type Phase697V7WireCounters = Readonly<{
  executorInvocations: number;
  providerDispatches: number;
  providerResponses: number;
  verifiedUsages: number;
}>;

export type Phase697V7WireSnapshot = Readonly<{
  version: typeof PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION;
  state: 'active' | 'succeeded' | 'failed';
  stages: readonly Phase697V7WireStage[];
  lastCompletedStage: Phase697V7WireStage | null;
  failureCategory: Phase697V7WireFailureCategory | null;
  usageDisposition: 'not_observed' | 'invalid' | 'verified';
  counters: Phase697V7WireCounters;
}>;

export type Phase697V7WireDiagnostics = Readonly<{
  capability: Phase697V7WireCapability;
  terminateRuntime(
    category:
      | 'pre_dispatch_abort'
      | 'post_dispatch_abort'
      | 'runtime_timeout'
      | 'harness_internal'
      | 'evidence_io'
      | 'unknown',
  ): Promise<Phase697V7WireSnapshot>;
  readSnapshot(): Phase697V7WireSnapshot;
}>;

export type Phase697V7WireProviderProjection = Readonly<{
  category: ModelAgentProviderFailureCategory;
  structuredOutputStage?: ModelAgentStructuredOutputStage;
}>;

type AppendStage = (stage: Phase697V7WireStage) => void | Promise<void>;
type InternalTerminal =
  | Readonly<{ state: 'succeeded'; failureCategory: null }>
  | Readonly<{ state: 'failed'; failureCategory: Phase697V7WireFailureCategory }>;

type InternalWireState = {
  appendStage: AppendStage;
  stages: Phase697V7WireStage[];
  terminal: InternalTerminal | null;
  usageDisposition: 'not_observed' | 'invalid' | 'verified';
  tail: Promise<void>;
  claimed: boolean;
};

const WIRE_TRANSITION_REJECTED = 'PHASE_6_9_7_V7_WIRE_TRANSITION_REJECTED';
const wireStates = new WeakMap<object, InternalWireState>();

const FAILURE_PROJECTIONS = Object.freeze({
  request_contract: { category: 'unknown' },
  transport: { category: 'transport' },
  http_auth: { category: 'http_auth' },
  http_rate_limit: { category: 'http_rate_limit' },
  http_client: { category: 'http_client' },
  http_server: { category: 'http_server' },
  response_audit: { category: 'invalid_response' },
  invalid_response: { category: 'invalid_response' },
  provider_json_parse: {
    category: 'structured_output',
    structuredOutputStage: 'provider_json_parse',
  },
  provider_type_validation: {
    category: 'structured_output',
    structuredOutputStage: 'provider_type_validation',
  },
  provider_object_missing: {
    category: 'structured_output',
    structuredOutputStage: 'provider_object_missing',
  },
  usage_validation: { category: 'unknown' },
  pre_dispatch_abort: { category: 'unknown' },
  post_dispatch_abort: { category: 'unknown' },
  runtime_timeout: { category: 'unknown' },
  harness_internal: { category: 'unknown' },
  evidence_io: { category: 'unknown' },
  unknown: { category: 'unknown' },
} as const satisfies Record<Phase697V7WireFailureCategory, Phase697V7WireProviderProjection>);

export function createPhase697V7WireDiagnostics(input: {
  appendStage: AppendStage;
}): Phase697V7WireDiagnostics {
  const appendStage = readAppendStage(input);
  const capability = Object.freeze({
    version: PHASE_6_9_7_V7_WIRE_CAPABILITY_VERSION,
  });
  const state: InternalWireState = {
    appendStage,
    stages: [],
    terminal: null,
    usageDisposition: 'not_observed',
    tail: Promise.resolve(),
    claimed: false,
  };
  wireStates.set(capability, state);

  return Object.freeze({
    capability,
    async terminateRuntime(category) {
      await failPhase697V7Wire(capability, category);
      return snapshot(state);
    },
    readSnapshot: () => snapshot(state),
  });
}

export function claimPhase697V7WireCapability(capability: Phase697V7WireCapability): boolean {
  const state = readState(capability);
  if (!state || state.claimed || state.terminal) return false;
  state.claimed = true;
  return true;
}

/** Internal adapter transition. It is intentionally not re-exported from @repo/ai. */
export async function advancePhase697V7WireStage(
  capability: Phase697V7WireCapability,
  stage: Phase697V7WireStage,
): Promise<boolean> {
  const state = requireState(capability);
  return enqueue(state, async () => {
    if (state.terminal) return false;
    const expected = PHASE_6_9_7_V7_WIRE_STAGES[state.stages.length];
    if (stage !== expected) {
      failInternal(state, 'harness_internal');
      throw transitionError();
    }
    try {
      await state.appendStage(stage);
    } catch {
      failInternal(state, 'evidence_io');
      throw transitionError();
    }
    state.stages.push(stage);
    if (stage === 'usage_validated') state.usageDisposition = 'verified';
    return true;
  });
}

/** Internal adapter/runtime terminal. It is intentionally not re-exported from @repo/ai. */
export async function failPhase697V7Wire(
  capability: Phase697V7WireCapability,
  category: Phase697V7WireFailureCategory,
): Promise<boolean> {
  const state = requireState(capability);
  return enqueue(state, async () => {
    if (state.terminal) return false;
    const safeCategory = isFailureCompatible(category, state.stages)
      ? category
      : 'harness_internal';
    if (safeCategory === 'usage_validation') state.usageDisposition = 'invalid';
    failInternal(state, safeCategory);
    return true;
  });
}

/** Internal AbortSignal transition. It is intentionally not re-exported from @repo/ai. */
export async function abortPhase697V7Wire(capability: Phase697V7WireCapability): Promise<boolean> {
  const state = requireState(capability);
  return enqueue(state, async () => {
    if (state.terminal) return false;
    const category = state.stages.includes('provider_dispatch_started')
      ? 'post_dispatch_abort'
      : 'pre_dispatch_abort';
    failInternal(state, category);
    return true;
  });
}

/** Internal adapter completion. It is intentionally not re-exported from @repo/ai. */
export async function completePhase697V7Wire(
  capability: Phase697V7WireCapability,
): Promise<boolean> {
  const state = requireState(capability);
  return enqueue(state, async () => {
    if (state.terminal) return false;
    if (
      state.stages.length !== PHASE_6_9_7_V7_WIRE_STAGES.length ||
      state.usageDisposition !== 'verified'
    ) {
      failInternal(state, 'harness_internal');
      throw transitionError();
    }
    state.terminal = Object.freeze({ state: 'succeeded', failureCategory: null });
    return true;
  });
}

export function readPhase697V7WireSnapshot(
  capability: Phase697V7WireCapability,
): Phase697V7WireSnapshot | null {
  const state = readState(capability);
  return state ? snapshot(state) : null;
}

/** Internal exhaustive compatibility projection; not re-exported from @repo/ai. */
export function projectPhase697V7WireFailure(
  category: Phase697V7WireFailureCategory,
): Phase697V7WireProviderProjection {
  return FAILURE_PROJECTIONS[category];
}

function readAppendStage(input: unknown): AppendStage {
  try {
    const values = readExactOwnDataValues(input, ['appendStage']);
    if (!values) throw new Error();
    const appendStage = values.appendStage;
    if (typeof appendStage !== 'function') throw new Error();
    return appendStage as AppendStage;
  } catch {
    throw new Error('INVALID_PHASE_6_9_7_V7_WIRE_DIAGNOSTICS');
  }
}

function readState(capability: unknown): InternalWireState | null {
  if ((typeof capability !== 'object' && typeof capability !== 'function') || capability === null) {
    return null;
  }
  return wireStates.get(capability) ?? null;
}

function requireState(capability: unknown): InternalWireState {
  const state = readState(capability);
  if (!state) throw transitionError();
  return state;
}

function enqueue<T>(state: InternalWireState, operation: () => Promise<T>): Promise<T> {
  const pending = state.tail.then(operation, operation);
  state.tail = pending.then(
    () => undefined,
    () => undefined,
  );
  return pending;
}

function failInternal(state: InternalWireState, category: Phase697V7WireFailureCategory) {
  state.terminal = Object.freeze({ state: 'failed', failureCategory: category });
}

function isFailureCompatible(
  category: Phase697V7WireFailureCategory,
  stages: readonly Phase697V7WireStage[],
) {
  const last = stages.at(-1) ?? null;
  const hasDispatch = stages.includes('provider_dispatch_started');
  switch (category) {
    case 'request_contract':
      return last === 'executor_entered';
    case 'transport':
      return last === 'provider_dispatch_started';
    case 'http_auth':
    case 'http_rate_limit':
    case 'http_client':
    case 'http_server':
    case 'response_audit':
      return last === 'provider_response_received';
    case 'invalid_response':
      return last === 'provider_dispatch_started' || last === 'provider_response_received';
    case 'provider_json_parse':
    case 'provider_object_missing':
      return last === 'response_audit_passed';
    case 'provider_type_validation':
      return last === 'content_parsed';
    case 'usage_validation':
      return last === 'schema_validated';
    case 'pre_dispatch_abort':
      return stages.length > 0 && !hasDispatch;
    case 'post_dispatch_abort':
      return hasDispatch;
    case 'runtime_timeout':
      return stages.length < PHASE_6_9_7_V7_WIRE_STAGES.length;
    case 'harness_internal':
    case 'evidence_io':
    case 'unknown':
      return true;
    default:
      return false;
  }
}

function snapshot(state: InternalWireState): Phase697V7WireSnapshot {
  const stages = Object.freeze([...state.stages]);
  const terminal = state.terminal;
  return Object.freeze({
    version: PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
    state: terminal?.state ?? 'active',
    stages,
    lastCompletedStage: stages.at(-1) ?? null,
    failureCategory: terminal?.failureCategory ?? null,
    usageDisposition: state.usageDisposition,
    counters: Object.freeze({
      executorInvocations: stages.includes('executor_entered') ? 1 : 0,
      providerDispatches: stages.includes('provider_dispatch_started') ? 1 : 0,
      providerResponses: stages.includes('provider_response_received') ? 1 : 0,
      verifiedUsages: stages.includes('usage_validated') ? 1 : 0,
    }),
  });
}

function transitionError() {
  const error = new Error(WIRE_TRANSITION_REJECTED);
  error.name = 'Phase697V7WireTransitionError';
  return error;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  } catch {
    return false;
  }
}

function readExactOwnDataValues(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (!isPlainRecord(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) {
      return null;
    }
    const values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return null;
      values[key] = descriptor.value;
    }
    return values;
  } catch {
    return null;
  }
}
