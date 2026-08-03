import { z } from 'zod';

import {
  createFirstPartyDeepSeekV4ProTransportDiagnosticAdapter,
  FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_ADAPTER_VERSION,
  FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_VERSION,
  type FirstPartyDeepSeekV4ProTransportDiagnosticAdapter,
  type FirstPartyDeepSeekV4ProTransportDiagnosticSubtype,
} from './first-party-deepseek-v4-pro-transport-diagnostic.ts';
import { createModelAgentBudget, reserveModelAgentBudget } from './model-agent-budget.ts';
import type {
  ModelAgentProviderFailureCategory,
  ModelAgentStructuredOutputStage,
} from './model-agent-contract.ts';
import {
  DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL,
  DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
} from './model-agent-deepseek-v4-pro-nonthinking.ts';
import { takeModelAgentProviderFailure } from './model-agent-provider-failure.ts';
import { requireModelAgentStrictJsonContent } from './model-agent-structured-output-policy.ts';
import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c1-contract.ts';
import {
  buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_WIRE_SCHEMA,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2Outcome,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2Report,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2Wire,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c2-contract.ts';
import {
  createPhase697V7WireDiagnostics,
  PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
  type Phase697V7WireSnapshot,
  type Phase697V7WireStage,
} from './phase-6-9-7-v7-wire-diagnostics.ts';

export type { Phase697V7WireStage } from './phase-6-9-7-v7-wire-diagnostics.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_TRANSPORT_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-transport-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SYNTHETIC_SCENARIOS =
  Object.freeze([
    'complete',
    'transport_dns',
    'http_auth',
    'schema_invalid',
    'usage_invalid',
    'budget_exceeded',
    'runner_timeout',
  ] as const);

export type Phase697ArchitectureRecoveryProviderCanaryV2C2SyntheticScenario =
  (typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SYNTHETIC_SCENARIOS)[number];
export type Phase697ArchitectureRecoveryProviderCanaryV2C2Transport = Readonly<{
  version: typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_TRANSPORT_VERSION;
}>;
export type Phase697ArchitectureRecoveryProviderCanaryV2C2RunInput = Readonly<{
  transport: Phase697ArchitectureRecoveryProviderCanaryV2C2Transport;
  timeoutMs: number;
  signal: AbortSignal;
}>;

type AppendStage = (stage: Phase697V7WireStage) => void | Promise<void>;
type TransportState = {
  authority: 'synthetic_test' | 'controlled_live';
  executorProvenance: 'synthetic_test' | 'deepseek_network';
  adapter: FirstPartyDeepSeekV4ProTransportDiagnosticAdapter;
  diagnostics: ReturnType<typeof createPhase697V7WireDiagnostics>;
  used: boolean;
};

const TRANSPORT_STATES = new WeakMap<object, TransportState>();
const INVALID_TRANSPORT =
  'INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_TRANSPORT';
const SYNTHETIC_API_KEY = 'c2-synthetic-key-never-network';
const SYNTHETIC_RAW_SENTINEL = 'c2-synthetic-raw-provider-value';
const NO_WIRE = Object.freeze({
  version: PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
  state: 'not_started' as const,
  lastCompletedStage: null,
  failureCategory: null,
  counters: Object.freeze({
    executorInvocations: 0 as const,
    providerDispatches: 0 as const,
    providerResponses: 0 as const,
    verifiedUsages: 0 as const,
  }),
});
const CANARY_OUTPUT_SCHEMA = requireModelAgentStrictJsonContent(
  z.object({ ok: z.literal(true) }).strict(),
);
const SYNTHETIC_REQUEST_BODY_SCHEMA = z
  .object({
    model: z.literal('deepseek-v4-pro'),
    thinking: z.object({ type: z.literal('disabled') }).strict(),
    response_format: z.object({ type: z.literal('json_object') }).strict(),
    max_tokens: z.literal(16),
    stream: z.literal(false),
    messages: z.tuple([
      z
        .object({
          role: z.literal('system'),
          content: z.literal(
            PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.systemPrompt,
          ),
        })
        .strict(),
      z
        .object({
          role: z.literal('user'),
          content: z.literal(
            PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.userPrompt,
          ),
        })
        .strict(),
    ]),
  })
  .strict();

/** Construction is zero-network; the first executor call consumes the capability. */
export function createPhase697ArchitectureRecoveryProviderCanaryV2C2ControlledLiveTransport(input: {
  apiKey: string;
  appendStage: AppendStage;
}): Phase697ArchitectureRecoveryProviderCanaryV2C2Transport {
  const values = readExactOwnDataValues(input, ['apiKey', 'appendStage']);
  if (!values || !isValidCredential(values.apiKey) || typeof values.appendStage !== 'function') {
    throw new Error(INVALID_TRANSPORT);
  }
  try {
    const diagnostics = createPhase697V7WireDiagnostics({
      appendStage: values.appendStage as AppendStage,
    });
    const adapter = createFirstPartyDeepSeekV4ProTransportDiagnosticAdapter(
      {
        provider: 'deepseek',
        apiKey: values.apiKey,
        baseURL: DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL,
        model: DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
      },
      diagnostics.capability,
    );
    if (adapter.provenance !== 'first_party_deepseek_v4_pro_transport_diagnostic') {
      throw new Error();
    }
    return mintTransport({
      authority: 'controlled_live',
      executorProvenance: 'deepseek_network',
      adapter,
      diagnostics,
      used: false,
    });
  } catch {
    throw new Error(INVALID_TRANSPORT);
  }
}

/** Closed module-owned fake fetch; never accepts caller transport or network ports. */
export function createPhase697ArchitectureRecoveryProviderCanaryV2C2SyntheticTransportForTesting(input: {
  scenario: Phase697ArchitectureRecoveryProviderCanaryV2C2SyntheticScenario;
  appendStage: AppendStage;
}): Phase697ArchitectureRecoveryProviderCanaryV2C2Transport {
  const values = readExactOwnDataValues(input, ['appendStage', 'scenario']);
  if (
    !values ||
    typeof values.appendStage !== 'function' ||
    !isSyntheticScenario(values.scenario)
  ) {
    throw new Error(INVALID_TRANSPORT);
  }
  try {
    const diagnostics = createPhase697V7WireDiagnostics({
      appendStage: values.appendStage as AppendStage,
    });
    const adapter = createFirstPartyDeepSeekV4ProTransportDiagnosticAdapter(
      {
        provider: 'deepseek',
        apiKey: SYNTHETIC_API_KEY,
        baseURL: DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL,
        model: DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
      },
      diagnostics.capability,
      { fetch: createClosedSyntheticFetch(values.scenario) },
    );
    if (adapter.provenance !== 'synthetic_test') throw new Error();
    return mintTransport({
      authority: 'synthetic_test',
      executorProvenance: 'synthetic_test',
      adapter,
      diagnostics,
      used: false,
    });
  } catch {
    throw new Error(INVALID_TRANSPORT);
  }
}

export async function runPhase697ArchitectureRecoveryProviderCanaryV2C2Canary(
  input: Phase697ArchitectureRecoveryProviderCanaryV2C2RunInput,
): Promise<Phase697ArchitectureRecoveryProviderCanaryV2C2Report> {
  const normalized = readRunInput(input);
  if (!normalized) return notStartedReport('synthetic_test', 'synthetic_test', 'config_invalid');
  const state = readTransportState(normalized.transport);
  if (!state || state.used) {
    return notStartedReport(
      state?.authority ?? 'synthetic_test',
      state?.executorProvenance ?? 'synthetic_test',
      'config_invalid',
    );
  }
  state.used = true;
  if (isSignalAborted(normalized.signal)) {
    return notStartedReport(state.authority, state.executorProvenance, 'aborted');
  }

  const budget = createModelAgentBudget({
    maxCalls: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxCalls,
    maxInputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxInputTokens,
    maxOutputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxOutputTokens,
  });
  const reservation = reserveModelAgentBudget(budget, {
    inputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxInputTokens,
    outputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxOutputTokens,
  });
  if (!reservation.ok) {
    return notStartedReport(state.authority, state.executorProvenance, 'harness_internal');
  }

  const controller = new AbortController();
  let cancellation: 'external' | 'timeout' | null = null;
  let settleTimeoutTransition: (() => void) | null = null;
  const timeoutTransition = new Promise<void>((resolve) => {
    settleTimeoutTransition = resolve;
  });
  const onExternalAbort = () => {
    if (cancellation !== null) return;
    cancellation = 'external';
    controller.abort();
  };
  try {
    normalized.signal.addEventListener('abort', onExternalAbort, { once: true });
  } catch {
    return notStartedReport(state.authority, state.executorProvenance, 'config_invalid');
  }
  if (isSignalAborted(normalized.signal)) onExternalAbort();

  const timeout = setTimeout(() => {
    if (cancellation !== null) return;
    cancellation = 'timeout';
    void state.diagnostics
      .terminateRuntime('runtime_timeout')
      .catch(() => undefined)
      .finally(() => {
        controller.abort();
        settleTimeoutTransition?.();
      });
  }, normalized.timeoutMs);

  let result: Awaited<ReturnType<typeof state.adapter.executor>> | null = null;
  let providerFailure:
    | Readonly<{
        category: ModelAgentProviderFailureCategory;
        structuredOutputStage?: ModelAgentStructuredOutputStage;
      }>
    | undefined;
  try {
    result = await state.adapter.executor({
      schema: CANARY_OUTPUT_SCHEMA,
      systemPrompt:
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.systemPrompt,
      userPrompt: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.userPrompt,
      maxOutputTokens:
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.maxOutputTokens,
      signal: controller.signal,
    });
  } catch (error) {
    providerFailure = takeModelAgentProviderFailure(error, controller.signal);
  } finally {
    clearTimeout(timeout);
    try {
      normalized.signal.removeEventListener('abort', onExternalAbort);
    } catch {
      // Cleanup is best effort after the branded input has been consumed.
    }
    if (cancellation === 'timeout') await timeoutTransition;
  }

  let snapshot = state.diagnostics.readSnapshot();
  if (snapshot.state === 'active') {
    try {
      snapshot = await state.diagnostics.terminateRuntime('harness_internal');
    } catch {
      return fallbackReport(state, state.diagnostics.readSnapshot());
    }
  }

  const transportSubtype = readTransportSubtype(state.adapter);
  const usage = readUsage(result);
  const withinBudget =
    usage === null
      ? null
      : usage.inputTokens <=
          PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxInputTokens &&
        usage.outputTokens <=
          PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxOutputTokens;
  const outcome = deriveOutcome({
    cancellation,
    snapshot,
    providerFailureCategory: providerFailure?.category ?? null,
    transportSubtype,
    usage,
    withinBudget,
  });

  try {
    return buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report({
      authority: state.authority,
      executorProvenance: state.executorProvenance,
      outcome,
      responseObserved: snapshot.counters.providerResponses === 1,
      strictResponseObserved: snapshot.state === 'succeeded',
      providerFailureCategory: cancellation === null ? (providerFailure?.category ?? null) : null,
      structuredOutputStage:
        cancellation === null ? (providerFailure?.structuredOutputStage ?? null) : null,
      transportSubtype,
      wire: snapshotWire(snapshot),
      usage: cancellation === null ? usage : null,
    });
  } catch {
    return fallbackReport(state, snapshot);
  }
}

function mintTransport(
  state: TransportState,
): Phase697ArchitectureRecoveryProviderCanaryV2C2Transport {
  const transport = Object.freeze({
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_TRANSPORT_VERSION,
  });
  TRANSPORT_STATES.set(transport, state);
  return transport;
}

function readTransportState(value: unknown): TransportState | null {
  try {
    if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return null;
    return TRANSPORT_STATES.get(value) ?? null;
  } catch {
    return null;
  }
}

function deriveOutcome(input: {
  cancellation: 'external' | 'timeout' | null;
  snapshot: Phase697V7WireSnapshot;
  providerFailureCategory: ModelAgentProviderFailureCategory | null;
  transportSubtype: FirstPartyDeepSeekV4ProTransportDiagnosticSubtype | null;
  usage: Readonly<{ inputTokens: number; outputTokens: number }> | null;
  withinBudget: boolean | null;
}): Phase697ArchitectureRecoveryProviderCanaryV2C2Outcome {
  if (input.snapshot.state === 'succeeded') {
    return input.usage !== null && input.withinBudget === true ? 'complete' : 'budget_exceeded';
  }
  if (input.cancellation === 'timeout' && input.snapshot.failureCategory === 'runtime_timeout') {
    return 'timeout';
  }
  if (
    input.cancellation === 'external' &&
    (input.snapshot.failureCategory === 'pre_dispatch_abort' ||
      input.snapshot.failureCategory === 'post_dispatch_abort')
  ) {
    return 'aborted';
  }
  if (input.snapshot.counters.providerResponses === 1) return 'response_observed';
  if (
    input.providerFailureCategory === 'transport' &&
    input.transportSubtype !== null &&
    input.snapshot.failureCategory === 'transport'
  ) {
    return 'transport_failed';
  }
  if (
    input.providerFailureCategory === 'invalid_response' ||
    input.providerFailureCategory === 'structured_output'
  ) {
    return 'response_invalid';
  }
  return 'harness_internal';
}

function notStartedReport(
  authority: 'synthetic_test' | 'controlled_live',
  executorProvenance: 'synthetic_test' | 'deepseek_network',
  outcome: 'config_invalid' | 'aborted' | 'harness_internal',
) {
  return buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report({
    authority,
    executorProvenance,
    outcome,
    responseObserved: false,
    strictResponseObserved: false,
    providerFailureCategory: null,
    structuredOutputStage: null,
    transportSubtype: null,
    wire: NO_WIRE,
    usage: null,
  });
}

function fallbackReport(state: TransportState, snapshot: Phase697V7WireSnapshot) {
  try {
    return buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report({
      authority: state.authority,
      executorProvenance: state.executorProvenance,
      outcome: 'harness_internal',
      responseObserved: snapshot.counters.providerResponses === 1,
      strictResponseObserved: false,
      providerFailureCategory: null,
      structuredOutputStage: null,
      transportSubtype: null,
      wire: snapshotWire(snapshot),
      usage: null,
    });
  } catch {
    return notStartedReport(state.authority, state.executorProvenance, 'harness_internal');
  }
}

function snapshotWire(
  snapshot: Phase697V7WireSnapshot,
): Phase697ArchitectureRecoveryProviderCanaryV2C2Wire {
  if (snapshot.state === 'active') {
    throw new Error('PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_WIRE_ACTIVE');
  }
  const parsed = PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_WIRE_SCHEMA.parse({
    version: PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
    state: snapshot.state,
    lastCompletedStage: snapshot.lastCompletedStage,
    failureCategory: snapshot.failureCategory,
    counters: snapshot.counters,
  });
  return Object.freeze({
    ...parsed,
    counters: Object.freeze({ ...parsed.counters }),
  });
}

function readRunInput(
  input: unknown,
): Phase697ArchitectureRecoveryProviderCanaryV2C2RunInput | null {
  const values = readExactOwnDataValues(input, ['signal', 'timeoutMs', 'transport']);
  if (
    !values ||
    !isAbortSignal(values.signal) ||
    !Number.isSafeInteger(values.timeoutMs) ||
    (values.timeoutMs as number) < 1 ||
    (values.timeoutMs as number) > 5_000 ||
    !readTransportState(values.transport)
  ) {
    return null;
  }
  return Object.freeze({
    transport: values.transport as Phase697ArchitectureRecoveryProviderCanaryV2C2Transport,
    timeoutMs: values.timeoutMs as number,
    signal: values.signal,
  });
}

function readTransportSubtype(
  adapter: FirstPartyDeepSeekV4ProTransportDiagnosticAdapter,
): FirstPartyDeepSeekV4ProTransportDiagnosticSubtype | null {
  try {
    if (adapter.version !== FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_ADAPTER_VERSION) {
      return null;
    }
    const value = adapter.readTransportDiagnostic();
    if (
      value === null ||
      value.version !== FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_VERSION
    ) {
      return null;
    }
    return value.subtype;
  } catch {
    return null;
  }
}

function readUsage(
  result: Awaited<ReturnType<FirstPartyDeepSeekV4ProTransportDiagnosticAdapter['executor']>> | null,
): Readonly<{ inputTokens: number; outputTokens: number }> | null {
  try {
    if (!result || !isPlainRecord(result.usage)) return null;
    const values = readExactOwnDataValues(result.usage, ['inputTokens', 'outputTokens']);
    if (
      !values ||
      !isPositiveSafeInteger(values.inputTokens) ||
      !isPositiveSafeInteger(values.outputTokens)
    ) {
      return null;
    }
    return Object.freeze({
      inputTokens: values.inputTokens,
      outputTokens: values.outputTokens,
    });
  } catch {
    return null;
  }
}

function createClosedSyntheticFetch(
  scenario: Phase697ArchitectureRecoveryProviderCanaryV2C2SyntheticScenario,
): typeof fetch {
  return async (input, init): Promise<Response> => {
    if (!isExactSyntheticRequest(input, init)) throw new Error(SYNTHETIC_RAW_SENTINEL);
    switch (scenario) {
      case 'complete':
        return syntheticSuccessResponse();
      case 'transport_dns': {
        const error = new Error(SYNTHETIC_RAW_SENTINEL);
        Object.defineProperty(error, 'code', { value: 'ENOTFOUND', enumerable: true });
        throw error;
      }
      case 'http_auth':
        return new Response(JSON.stringify({ error: SYNTHETIC_RAW_SENTINEL }), { status: 401 });
      case 'schema_invalid':
        return syntheticSuccessResponse({ content: '{"ok":false}' });
      case 'usage_invalid':
        return syntheticSuccessResponse({ inputTokens: 0 });
      case 'budget_exceeded':
        return syntheticSuccessResponse({ inputTokens: 513 });
      case 'runner_timeout':
        return await rejectOnAbort(init?.signal);
      default:
        return assertNeverScenario(scenario);
    }
  };
}

function isExactSyntheticRequest(input: Parameters<typeof fetch>[0], init?: RequestInit) {
  try {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : null;
    if (
      url !== 'https://api.deepseek.com/v1/chat/completions' ||
      init?.method !== 'POST' ||
      !(init.signal instanceof AbortSignal) ||
      typeof init.body !== 'string'
    ) {
      return false;
    }
    const headers = new Headers(init.headers);
    return (
      headers.get('authorization') === `Bearer ${SYNTHETIC_API_KEY}` &&
      headers.get('content-type') === 'application/json' &&
      SYNTHETIC_REQUEST_BODY_SCHEMA.safeParse(JSON.parse(init.body)).success
    );
  } catch {
    return false;
  }
}

function syntheticSuccessResponse(
  input: Readonly<{ content?: string; inputTokens?: number; outputTokens?: number }> = {},
) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: input.content ?? '{"ok":true}' } }],
      usage: {
        prompt_tokens: input.inputTokens ?? 32,
        completion_tokens: input.outputTokens ?? 4,
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function rejectOnAbort(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const fail = () => {
      const error = new Error(SYNTHETIC_RAW_SENTINEL);
      Object.defineProperty(error, 'name', { value: 'AbortError', enumerable: true });
      reject(error);
    };
    if (!signal || signal.aborted) fail();
    else signal.addEventListener('abort', fail, { once: true });
  });
}

function isSyntheticScenario(
  value: unknown,
): value is Phase697ArchitectureRecoveryProviderCanaryV2C2SyntheticScenario {
  return (
    typeof value === 'string' &&
    PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SYNTHETIC_SCENARIOS.some(
      (item) => item === value,
    )
  );
}

function assertNeverScenario(value: never): never {
  void value;
  throw new Error('PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SCENARIO_INVARIANT');
}

function isSignalAborted(signal: AbortSignal) {
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isValidCredential(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 512 &&
    value === value.trim() &&
    /^[\x21-\x7e]+$/u.test(value)
  );
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
