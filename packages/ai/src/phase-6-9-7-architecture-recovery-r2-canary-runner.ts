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
  createPhase697V7WireDiagnostics,
  PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
  type Phase697V7WireCapability,
  type Phase697V7WireSnapshot,
} from './phase-6-9-7-v7-wire-diagnostics.ts';

const SYNTHETIC_API_KEY = 'r2-synthetic-key-never-network';
const SYNTHETIC_RAW_SENTINEL = 'r2-synthetic-raw-value-never-report';
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
const NO_WIRE_COUNTERS = Object.freeze({
  executorInvocations: 0 as const,
  providerDispatches: 0 as const,
  providerResponses: 0 as const,
  verifiedUsages: 0 as const,
});
type SyntheticFetchInput = Parameters<typeof fetch>[0];

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_SYNTHETIC_SCENARIOS = Object.freeze([
  'complete',
  'transport_aborted',
  'transport_timeout',
  'transport_dns',
  'transport_tls',
  'transport_proxy',
  'transport_refused',
  'transport_reset',
  'transport_unreachable',
  'transport_unknown',
  'http_auth',
  'http_rate_limit',
  'http_client',
  'http_server',
  'response_invalid',
  'json_invalid',
  'schema_invalid',
  'usage_invalid',
  'budget_exceeded',
  'runner_timeout',
] as const);

export type Phase697ArchitectureRecoveryR2SyntheticScenario =
  (typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_SYNTHETIC_SCENARIOS)[number];

export type Phase697ArchitectureRecoveryR2CanaryRunInput = Readonly<{
  mode: 'synthetic';
  scenario: Phase697ArchitectureRecoveryR2SyntheticScenario;
  timeoutMs: number;
  signal: AbortSignal;
}>;

/**
 * Runs one fact-free, synthetic-only canary with one reservation and no retry.
 * Its closed scenario enum is resolved to an in-module Response/throw script;
 * callers cannot inject fetch, a transport, credentials, or a network delegate.
 * A later authorized stage must add a separate controlled-Live composition.
 */
export async function runPhase697ArchitectureRecoveryR2Canary(
  input: Phase697ArchitectureRecoveryR2CanaryRunInput,
): Promise<Phase697ArchitectureRecoveryR2CanaryReport> {
  const normalized = readRunInput(input);
  if (!normalized) return notStartedReport('config_invalid', 1_000);
  if (isSignalAborted(normalized.signal)) {
    return notStartedReport('aborted', normalized.timeoutMs);
  }

  const diagnostics = createPhase697V7WireDiagnostics({ appendStage() {} });
  let rawTransport: unknown;
  try {
    rawTransport = createSyntheticTransport(normalized.scenario, diagnostics.capability);
  } catch {
    return notStartedReport('harness_internal', normalized.timeoutMs);
  }
  const transport = readSyntheticTransport(rawTransport);
  if (!transport) return notStartedReport('config_invalid', normalized.timeoutMs);

  const initialBudget = createModelAgentBudget({
    maxCalls: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxCalls,
    maxInputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxInputTokens,
    maxOutputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxOutputTokens,
  });
  const reservation = reserveModelAgentBudget(initialBudget, {
    inputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxInputTokens,
    outputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxOutputTokens,
  });
  if (!reservation.ok) return notStartedReport('harness_internal', normalized.timeoutMs);

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
    return notStartedReport('config_invalid', normalized.timeoutMs);
  }
  if (isSignalAborted(normalized.signal)) onExternalAbort();

  const timeout = setTimeout(() => {
    if (cancellation !== null) return;
    cancellation = 'timeout';
    void diagnostics
      .terminateRuntime('runtime_timeout')
      .catch(() => undefined)
      .finally(() => {
        controller.abort();
        settleTimeoutTransition?.();
      });
  }, normalized.timeoutMs);

  let result: Awaited<ReturnType<typeof transport.executor>> | null = null;
  let providerFailure:
    | Readonly<{
        category: ModelAgentProviderFailureCategory;
        structuredOutputStage?: ModelAgentStructuredOutputStage;
      }>
    | undefined;
  try {
    result = await transport.executor({
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
      // The input was a branded AbortSignal; cleanup failure cannot expose raw data.
    }
    if (cancellation === 'timeout') await timeoutTransition;
  }

  let snapshot = diagnostics.readSnapshot();
  if (snapshot.state === 'active') {
    try {
      snapshot = await diagnostics.terminateRuntime('harness_internal');
    } catch {
      return notStartedReport('harness_internal', normalized.timeoutMs);
    }
  }

  const diagnostic = readTransportSubtype(transport);
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

  const report = runtimeReport({
    timeoutMs: normalized.timeoutMs,
    outcome,
    snapshot,
    providerFailureCategory: cancellation === null ? (providerFailure?.category ?? null) : null,
    structuredOutputStage:
      cancellation === null ? (providerFailure?.structuredOutputStage ?? null) : null,
    transportSubtype: diagnostic,
    usage: cancellation === null ? usage : null,
    withinBudget: cancellation === null ? withinBudget : null,
  });
  return report;
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

function runtimeReport(input: {
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
    authority: 'synthetic_test' as const,
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
  const parsed = safeParseReport(candidate);
  if (parsed) return parsed;
  return runtimeHarnessFallback(input.timeoutMs, input.snapshot);
}

function runtimeHarnessFallback(
  timeoutMs: number,
  snapshot: Phase697V7WireSnapshot,
): Phase697ArchitectureRecoveryR2CanaryReport {
  const candidate = {
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_VERSION,
    requestVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION,
    authority: 'synthetic_test' as const,
    provider: 'deepseek' as const,
    model: 'deepseek-v4-pro' as const,
    timeoutMs,
    outcome: 'harness_internal' as const,
    responseObserved: snapshot.counters.providerResponses === 1,
    providerFailureCategory: null,
    structuredOutputStage: null,
    transportSubtype: null,
    wire: snapshotWire(snapshot),
    budget: snapshotBudget(true, null, null),
    usage: null,
  };
  return requireSafeReport(candidate);
}

function notStartedReport(
  outcome: 'config_invalid' | 'aborted' | 'harness_internal',
  timeoutMs: number,
): Phase697ArchitectureRecoveryR2CanaryReport {
  return requireSafeReport({
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_VERSION,
    requestVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION,
    authority: 'synthetic_test',
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

function safeParseReport(value: unknown): Phase697ArchitectureRecoveryR2CanaryReport | null {
  try {
    const parsed = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA.safeParse(value);
    return parsed.success ? freezePhase697ArchitectureRecoveryR2CanaryReport(parsed.data) : null;
  } catch {
    return null;
  }
}

function requireSafeReport(value: unknown): Phase697ArchitectureRecoveryR2CanaryReport {
  const parsed = safeParseReport(value);
  if (!parsed) throw new Error('PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_REPORT_INVARIANT_FAILED');
  return parsed;
}

function readRunInput(input: unknown): Phase697ArchitectureRecoveryR2CanaryRunInput | null {
  try {
    const values = readExactOwnDataValues(input, ['mode', 'scenario', 'signal', 'timeoutMs']);
    if (
      !values ||
      values.mode !== 'synthetic' ||
      !isSyntheticScenario(values.scenario) ||
      !isAbortSignal(values.signal) ||
      !Number.isSafeInteger(values.timeoutMs) ||
      (values.timeoutMs as number) < 1 ||
      (values.timeoutMs as number) > 5_000
    ) {
      return null;
    }
    return Object.freeze({
      mode: 'synthetic',
      scenario: values.scenario,
      timeoutMs: values.timeoutMs as number,
      signal: values.signal,
    });
  } catch {
    return null;
  }
}

function readSyntheticTransport(
  input: unknown,
): FirstPartyDeepSeekV4ProTransportDiagnosticAdapter | null {
  try {
    const values = readExactOwnDataValues(input, [
      'executor',
      'provenance',
      'readTransportDiagnostic',
      'version',
    ]);
    if (
      !values ||
      values.version !== FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_ADAPTER_VERSION ||
      values.provenance !== 'synthetic_test' ||
      typeof values.executor !== 'function' ||
      typeof values.readTransportDiagnostic !== 'function' ||
      !Object.isFrozen(input)
    ) {
      return null;
    }
    return input as FirstPartyDeepSeekV4ProTransportDiagnosticAdapter;
  } catch {
    return null;
  }
}

function readTransportSubtype(
  transport: FirstPartyDeepSeekV4ProTransportDiagnosticAdapter,
): FirstPartyDeepSeekV4ProTransportDiagnosticSubtype | null {
  try {
    const value = transport.readTransportDiagnostic();
    if (value === null) return null;
    const values = readExactOwnDataValues(value, ['subtype', 'version']);
    if (
      !values ||
      values.version !== FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_VERSION ||
      typeof values.subtype !== 'string'
    ) {
      return null;
    }
    const parsed = z
      .enum([
        'aborted',
        'timeout',
        'dns',
        'tls',
        'proxy',
        'connection_refused',
        'connection_reset',
        'network_unreachable',
        'unknown',
      ])
      .safeParse(values.subtype);
    return parsed.success ? parsed.data : null;
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

function createSyntheticTransport(
  scenario: Phase697ArchitectureRecoveryR2SyntheticScenario,
  capability: Phase697V7WireCapability,
): FirstPartyDeepSeekV4ProTransportDiagnosticAdapter {
  return createFirstPartyDeepSeekV4ProTransportDiagnosticAdapter(
    {
      provider: 'deepseek',
      apiKey: SYNTHETIC_API_KEY,
      baseURL: DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL,
      model: DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
    },
    capability,
    { fetch: createClosedSyntheticFetch(scenario) },
  );
}

function createClosedSyntheticFetch(
  scenario: Phase697ArchitectureRecoveryR2SyntheticScenario,
): typeof fetch {
  return async (input: SyntheticFetchInput, init?: RequestInit): Promise<Response> => {
    if (!isExactSyntheticCanaryRequest(input, init)) {
      throw new Error('R2_SYNTHETIC_REQUEST_CONTRACT_MISMATCH');
    }
    switch (scenario) {
      case 'complete':
        return syntheticSuccessResponse();
      case 'transport_aborted':
        throw syntheticErrorWithName('AbortError');
      case 'transport_timeout':
        throw syntheticErrorWithCode('ETIMEDOUT');
      case 'transport_dns':
        throw syntheticErrorWithCode('ENOTFOUND');
      case 'transport_tls':
        throw syntheticErrorWithCode('CERT_HAS_EXPIRED');
      case 'transport_proxy':
        throw syntheticErrorWithCode('ERR_PROXY_CONNECTION_FAILED');
      case 'transport_refused':
        throw syntheticErrorWithCode('ECONNREFUSED');
      case 'transport_reset':
        throw syntheticErrorWithCode('ECONNRESET');
      case 'transport_unreachable':
        throw syntheticErrorWithCode('ENETUNREACH');
      case 'transport_unknown':
        throw new Error(SYNTHETIC_RAW_SENTINEL);
      case 'http_auth':
        return syntheticStatusResponse(401);
      case 'http_rate_limit':
        return syntheticStatusResponse(429);
      case 'http_client':
        return syntheticStatusResponse(422);
      case 'http_server':
        return syntheticStatusResponse(503);
      case 'response_invalid':
        return { status: 200 } as never;
      case 'json_invalid':
        return syntheticSuccessResponse({ content: 'not-json' });
      case 'schema_invalid':
        return syntheticSuccessResponse({ content: '{"ok":false}' });
      case 'usage_invalid':
        return syntheticSuccessResponse({ inputTokens: 0 });
      case 'budget_exceeded':
        return syntheticSuccessResponse({ inputTokens: 513 });
      case 'runner_timeout':
        return await rejectSyntheticOnAbort(init?.signal);
      default:
        return assertNeverScenario(scenario);
    }
  };
}

function isExactSyntheticCanaryRequest(input: SyntheticFetchInput, init?: RequestInit): boolean {
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
    if (
      headers.get('authorization') !== `Bearer ${SYNTHETIC_API_KEY}` ||
      headers.get('content-type') !== 'application/json'
    ) {
      return false;
    }
    return SYNTHETIC_REQUEST_BODY_SCHEMA.safeParse(JSON.parse(init.body)).success;
  } catch {
    return false;
  }
}

function syntheticSuccessResponse(
  input: Readonly<{
    content?: string;
    inputTokens?: number;
    outputTokens?: number;
  }> = {},
): Response {
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

function syntheticStatusResponse(status: number): Response {
  return new Response(JSON.stringify({ error: SYNTHETIC_RAW_SENTINEL }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function syntheticErrorWithCode(code: string): Error {
  const error = new Error(SYNTHETIC_RAW_SENTINEL);
  Object.defineProperty(error, 'code', { value: code, enumerable: true });
  return error;
}

function syntheticErrorWithName(name: string): Error {
  const error = new Error(SYNTHETIC_RAW_SENTINEL);
  Object.defineProperty(error, 'name', { value: name, enumerable: true });
  return error;
}

function rejectSyntheticOnAbort(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    if (!signal) {
      reject(new Error(SYNTHETIC_RAW_SENTINEL));
      return;
    }
    const rejectAbort = () => reject(syntheticErrorWithName('AbortError'));
    if (signal.aborted) rejectAbort();
    else signal.addEventListener('abort', rejectAbort, { once: true });
  });
}

function isSyntheticScenario(
  value: unknown,
): value is Phase697ArchitectureRecoveryR2SyntheticScenario {
  return (
    typeof value === 'string' &&
    PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_SYNTHETIC_SCENARIOS.some((scenario) => scenario === value)
  );
}

function assertNeverScenario(value: never): never {
  void value;
  throw new Error('R2_SYNTHETIC_SCENARIO_INVARIANT_FAILED');
}

function isSignalAborted(signal: AbortSignal): boolean {
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
