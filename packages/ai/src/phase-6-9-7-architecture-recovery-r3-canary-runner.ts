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
import { takeModelAgentProviderFailure } from './model-agent-provider-failure.ts';
import { requireModelAgentStrictJsonContent } from './model-agent-structured-output-policy.ts';
import {
  DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL,
  DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
} from './model-agent-deepseek-v4-pro-nonthinking.ts';
import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_PROFILE,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION,
  freezePhase697ArchitectureRecoveryR2CanaryReport,
  type Phase697ArchitectureRecoveryR2CanaryOutcome,
  type Phase697ArchitectureRecoveryR2CanaryReport,
} from './phase-6-9-7-architecture-recovery-r2-canary-contract.ts';
import {
  buildPhase697ArchitectureRecoveryR3CanaryReport,
  type Phase697ArchitectureRecoveryR3CanaryReport,
} from './phase-6-9-7-architecture-recovery-r3-canary-contract.ts';
import {
  createPhase697V7WireDiagnostics,
  PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
  type Phase697V7WireSnapshot,
  type Phase697V7WireStage,
} from './phase-6-9-7-v7-wire-diagnostics.ts';

export type { Phase697V7WireStage } from './phase-6-9-7-v7-wire-diagnostics.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_TRANSPORT_VERSION =
  'phase-6.9.7-architecture-recovery-r3-provider-canary-transport-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_SYNTHETIC_SCENARIOS = Object.freeze([
  'complete',
  'transport_dns',
  'http_auth',
  'schema_invalid',
  'usage_invalid',
  'budget_exceeded',
  'runner_timeout',
] as const);

export type Phase697ArchitectureRecoveryR3SyntheticScenario =
  (typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_SYNTHETIC_SCENARIOS)[number];
export type Phase697ArchitectureRecoveryR3CanaryTransport = Readonly<{
  version: typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_TRANSPORT_VERSION;
}>;
export type Phase697ArchitectureRecoveryR3CanaryRunInput = Readonly<{
  transport: Phase697ArchitectureRecoveryR3CanaryTransport;
  timeoutMs: number;
  signal: AbortSignal;
}>;

type AppendStage = (stage: Phase697V7WireStage) => void | Promise<void>;
type TransportState = {
  authority: 'synthetic_test' | 'controlled_live';
  adapter: FirstPartyDeepSeekV4ProTransportDiagnosticAdapter;
  diagnostics: ReturnType<typeof createPhase697V7WireDiagnostics>;
  used: boolean;
};

const transportStates = new WeakMap<object, TransportState>();
const INVALID_TRANSPORT = 'INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_TRANSPORT';
const SYNTHETIC_API_KEY = 'r3-synthetic-key-never-network';
const SYNTHETIC_RAW_SENTINEL = 'r3-synthetic-raw-provider-value';
const NO_WIRE_COUNTERS = Object.freeze({
  executorInvocations: 0 as const,
  providerDispatches: 0 as const,
  providerResponses: 0 as const,
  verifiedUsages: 0 as const,
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
            PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_PROFILE.systemPrompt,
          ),
        })
        .strict(),
      z
        .object({
          role: z.literal('user'),
          content: z.literal(
            PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_PROFILE.userPrompt,
          ),
        })
        .strict(),
    ]),
  })
  .strict();

/**
 * Mints the only real-network transport capability. It accepts no fetch, URL,
 * model, retry, or env port; the caller must already hold the dedicated key.
 * Construction performs no network I/O. The first executor call is the only
 * possible dispatch because both this capability and the V7 wire capability
 * are single-use.
 */
export function createPhase697ArchitectureRecoveryR3ControlledLiveCanaryTransport(input: {
  apiKey: string;
  appendStage: AppendStage;
}): Phase697ArchitectureRecoveryR3CanaryTransport {
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
    return mintTransport({ authority: 'controlled_live', adapter, diagnostics, used: false });
  } catch {
    throw new Error(INVALID_TRANSPORT);
  }
}

/** Closed synthetic transport used only to exercise the R3 runner without network. */
export function createPhase697ArchitectureRecoveryR3SyntheticCanaryTransportForTesting(input: {
  scenario: Phase697ArchitectureRecoveryR3SyntheticScenario;
  appendStage: AppendStage;
}): Phase697ArchitectureRecoveryR3CanaryTransport {
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
    return mintTransport({ authority: 'synthetic_test', adapter, diagnostics, used: false });
  } catch {
    throw new Error(INVALID_TRANSPORT);
  }
}

export async function runPhase697ArchitectureRecoveryR3Canary(
  input: Phase697ArchitectureRecoveryR3CanaryRunInput,
): Promise<Phase697ArchitectureRecoveryR3CanaryReport> {
  const normalized = readRunInput(input);
  if (!normalized) return wrap(notStartedProviderReport('synthetic_test', 'config_invalid', 1_000));
  const state = readTransportState(normalized.transport);
  if (!state || state.used) {
    return wrap(
      notStartedProviderReport(state?.authority ?? 'synthetic_test', 'config_invalid', 1_000),
    );
  }
  state.used = true;
  if (isSignalAborted(normalized.signal)) {
    return wrap(notStartedProviderReport(state.authority, 'aborted', normalized.timeoutMs));
  }

  const initialBudget = createModelAgentBudget({
    maxCalls: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxCalls,
    maxInputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxInputTokens,
    maxOutputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxOutputTokens,
  });
  const reservation = reserveModelAgentBudget(initialBudget, {
    inputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxInputTokens,
    outputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxOutputTokens,
  });
  if (!reservation.ok) {
    return wrap(
      notStartedProviderReport(state.authority, 'harness_internal', normalized.timeoutMs),
    );
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
    return wrap(notStartedProviderReport(state.authority, 'config_invalid', normalized.timeoutMs));
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
      systemPrompt: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_PROFILE.systemPrompt,
      userPrompt: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_PROFILE.userPrompt,
      maxOutputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_PROFILE.maxOutputTokens,
      signal: controller.signal,
    });
  } catch (error) {
    providerFailure = takeModelAgentProviderFailure(error, controller.signal);
  } finally {
    clearTimeout(timeout);
    try {
      normalized.signal.removeEventListener('abort', onExternalAbort);
    } catch {
      // The branded input was already read; cleanup remains best effort.
    }
    if (cancellation === 'timeout') await timeoutTransition;
  }

  let snapshot = state.diagnostics.readSnapshot();
  if (snapshot.state === 'active') {
    try {
      snapshot = await state.diagnostics.terminateRuntime('harness_internal');
    } catch {
      return wrap(
        runtimeHarnessFallback(
          state.authority,
          normalized.timeoutMs,
          state.diagnostics.readSnapshot(),
        ),
      );
    }
  }

  const diagnostic = readTransportSubtype(state.adapter);
  const usage = readUsage(result);
  const withinBudget =
    usage === null
      ? null
      : usage.inputTokens <= PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxInputTokens &&
        usage.outputTokens <= PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxOutputTokens;
  const outcome = deriveOutcome({
    cancellation,
    snapshot,
    providerFailureCategory: providerFailure?.category ?? null,
    transportSubtype: diagnostic,
    usage,
    withinBudget,
  });

  return wrap(
    runtimeProviderReport({
      authority: state.authority,
      timeoutMs: normalized.timeoutMs,
      outcome,
      snapshot,
      providerFailureCategory: cancellation === null ? (providerFailure?.category ?? null) : null,
      structuredOutputStage:
        cancellation === null ? (providerFailure?.structuredOutputStage ?? null) : null,
      transportSubtype: diagnostic,
      usage: cancellation === null ? usage : null,
      withinBudget: cancellation === null ? withinBudget : null,
    }),
  );
}

function mintTransport(state: TransportState): Phase697ArchitectureRecoveryR3CanaryTransport {
  const transport = Object.freeze({
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_TRANSPORT_VERSION,
  });
  transportStates.set(transport, state);
  return transport;
}

function readTransportState(value: unknown): TransportState | null {
  try {
    if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return null;
    return transportStates.get(value) ?? null;
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
}): Phase697ArchitectureRecoveryR2CanaryOutcome {
  if (input.snapshot.state === 'succeeded') {
    return input.usage !== null && input.withinBudget === true ? 'complete' : 'budget_exceeded';
  }
  if (
    input.cancellation === 'timeout' &&
    input.snapshot.state === 'failed' &&
    input.snapshot.failureCategory === 'runtime_timeout'
  ) {
    return 'timeout';
  }
  if (
    input.cancellation === 'external' &&
    input.snapshot.state === 'failed' &&
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
    input.providerFailureCategory === 'invalid_response' &&
    input.snapshot.failureCategory === 'invalid_response'
  ) {
    return 'response_invalid';
  }
  return 'harness_internal';
}

function runtimeProviderReport(input: {
  authority: 'synthetic_test' | 'controlled_live';
  timeoutMs: number;
  outcome: Phase697ArchitectureRecoveryR2CanaryOutcome;
  snapshot: Phase697V7WireSnapshot;
  providerFailureCategory: ModelAgentProviderFailureCategory | null;
  structuredOutputStage: ModelAgentStructuredOutputStage | null;
  transportSubtype: FirstPartyDeepSeekV4ProTransportDiagnosticSubtype | null;
  usage: Readonly<{ inputTokens: number; outputTokens: number }> | null;
  withinBudget: boolean | null;
}): Phase697ArchitectureRecoveryR2CanaryReport {
  const candidate = {
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_VERSION,
    requestVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION,
    authority: input.authority,
    provider: 'deepseek' as const,
    model: 'deepseek-v4-pro' as const,
    timeoutMs: input.timeoutMs,
    outcome: input.outcome,
    responseObserved: input.snapshot.counters.providerResponses === 1,
    providerFailureCategory: input.providerFailureCategory,
    structuredOutputStage: input.structuredOutputStage,
    transportSubtype: input.transportSubtype,
    wire: snapshotWire(input.snapshot),
    budget: snapshotBudget(true, input.usage, input.withinBudget),
    usage: input.usage,
  };
  const parsed = safeParseProviderReport(candidate);
  return parsed ?? runtimeHarnessFallback(input.authority, input.timeoutMs, input.snapshot);
}

function runtimeHarnessFallback(
  authority: 'synthetic_test' | 'controlled_live',
  timeoutMs: number,
  snapshot: Phase697V7WireSnapshot,
): Phase697ArchitectureRecoveryR2CanaryReport {
  return requireSafeProviderReport({
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_VERSION,
    requestVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION,
    authority,
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    timeoutMs,
    outcome: 'harness_internal',
    responseObserved: snapshot.counters.providerResponses === 1,
    providerFailureCategory: null,
    structuredOutputStage: null,
    transportSubtype: null,
    wire: snapshotWire(snapshot),
    budget: snapshotBudget(true, null, null),
    usage: null,
  });
}

function notStartedProviderReport(
  authority: 'synthetic_test' | 'controlled_live',
  outcome: 'config_invalid' | 'aborted' | 'harness_internal',
  timeoutMs: number,
): Phase697ArchitectureRecoveryR2CanaryReport {
  return requireSafeProviderReport({
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_VERSION,
    requestVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION,
    authority,
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    timeoutMs,
    outcome,
    responseObserved: false,
    providerFailureCategory: null,
    structuredOutputStage: null,
    transportSubtype: null,
    wire: {
      version: PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
      state: 'not_started',
      lastCompletedStage: null,
      failureCategory: null,
      counters: NO_WIRE_COUNTERS,
    },
    budget: snapshotBudget(false, null, null),
    usage: null,
  });
}

function snapshotWire(snapshot: Phase697V7WireSnapshot) {
  return {
    version: PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
    state: snapshot.state,
    lastCompletedStage: snapshot.lastCompletedStage,
    failureCategory: snapshot.failureCategory,
    counters: { ...snapshot.counters },
  } as const;
}

function snapshotBudget(
  reserved: boolean,
  usage: Readonly<{ inputTokens: number; outputTokens: number }> | null,
  withinBudget: boolean | null,
) {
  return {
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET_VERSION,
    scope: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.scope,
    maxCalls: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxCalls,
    maxInputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxInputTokens,
    maxOutputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxOutputTokens,
    hardCapCny: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.hardCapCny,
    reservedCalls: reserved ? (1 as const) : (0 as const),
    reservedInputTokens: reserved
      ? PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxInputTokens
      : (0 as const),
    reservedOutputTokens: reserved
      ? PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxOutputTokens
      : (0 as const),
    actualInputTokens: usage?.inputTokens ?? null,
    actualOutputTokens: usage?.outputTokens ?? null,
    withinBudget,
  } as const;
}

function wrap(report: Phase697ArchitectureRecoveryR2CanaryReport) {
  return buildPhase697ArchitectureRecoveryR3CanaryReport(report);
}

function safeParseProviderReport(
  value: unknown,
): Phase697ArchitectureRecoveryR2CanaryReport | null {
  try {
    const parsed = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA.safeParse(value);
    return parsed.success ? freezePhase697ArchitectureRecoveryR2CanaryReport(parsed.data) : null;
  } catch {
    return null;
  }
}

function requireSafeProviderReport(value: unknown): Phase697ArchitectureRecoveryR2CanaryReport {
  const parsed = safeParseProviderReport(value);
  if (!parsed) throw new Error('PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_REPORT_INVARIANT_FAILED');
  return parsed;
}

function readRunInput(input: unknown): Phase697ArchitectureRecoveryR3CanaryRunInput | null {
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
    transport: values.transport as Phase697ArchitectureRecoveryR3CanaryTransport,
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
    if (value === null) return null;
    if (value.version !== FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_VERSION) return null;
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
  scenario: Phase697ArchitectureRecoveryR3SyntheticScenario,
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
): value is Phase697ArchitectureRecoveryR3SyntheticScenario {
  return (
    typeof value === 'string' &&
    PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_SYNTHETIC_SCENARIOS.some((item) => item === value)
  );
}

function assertNeverScenario(value: never): never {
  void value;
  throw new Error('PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_SCENARIO_INVARIANT_FAILED');
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
