import {
  MODEL_CANDIDATE_DISPOSITIONS,
  type ModelCandidateDisposition,
} from '@repo/agent/model-candidates';
import {
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  type ModelAgentErrorCode,
  type ModelAgentProviderFailureCategory,
} from '@repo/ai';

const MODEL_AGENT_ERROR_CODES = Object.freeze([
  'INVALID_REQUEST',
  'INVALID_RUNTIME_CONFIG',
  'LIVE_CALLS_DISABLED',
  'EXECUTOR_UNAVAILABLE',
  'CALL_BUDGET_EXCEEDED',
  'INPUT_BUDGET_EXCEEDED',
  'OUTPUT_BUDGET_EXCEEDED',
  'SCHEMA_INVALID',
  'TIMEOUT',
  'ABORTED',
  'PROVIDER_ERROR',
] as const satisfies readonly ModelAgentErrorCode[]);

const DEFAULT_DISPOSITION: ModelCandidateDisposition = 'fallback_invalid_input';
const ABSENT_DISPOSITION = 'not_present';
const MAX_SAFE_COUNT = Number.MAX_SAFE_INTEGER;

export type SafeChatModelAgentObservation = {
  attempted: boolean;
  disposition: ModelCandidateDisposition;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  usageUnavailable?: boolean;
  errorCode?: ModelAgentErrorCode | 'UNKNOWN';
  providerFailureCategory?: ModelAgentProviderFailureCategory;
};

export type ChatModelAgentObservationAggregate = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export function projectChatModelAgentObservation(
  value: unknown,
): SafeChatModelAgentObservation {
  try {
    const attempted = readOwnData(value, 'attempted') === true;
    const disposition = toDisposition(readOwnData(value, 'disposition'));
    const usageUnavailable = readOwnData(value, 'usageUnavailable') === true;
    const usage = readOwnData(value, 'usage');
    const trace = readOwnData(value, 'trace');
    const errorCode = toErrorCode(readOwnData(trace, 'errorCode'));
    const providerFailureCategory = toProviderFailureCategory(
      readOwnData(trace, 'providerFailureCategory'),
    );

    return {
      attempted,
      disposition,
      durationMs: toSafeCount(readOwnData(trace, 'durationMs')),
      inputTokens: usageUnavailable
        ? 0
        : toSafeCount(readOwnData(usage, 'inputTokens')),
      outputTokens: usageUnavailable
        ? 0
        : toSafeCount(readOwnData(usage, 'outputTokens')),
      ...(usageUnavailable ? { usageUnavailable: true } : {}),
      ...(errorCode ? { errorCode } : {}),
      ...(providerFailureCategory ? { providerFailureCategory } : {}),
    };
  } catch {
    return emptyObservation();
  }
}

export function aggregateChatModelAgentObservations(
  router: unknown,
  verifier?: unknown,
): ChatModelAgentObservationAggregate {
  const routerObservation = projectChatModelAgentObservation(router);
  const verifierObservation =
    verifier === undefined
      ? undefined
      : projectChatModelAgentObservation(verifier);
  return aggregateProjectedObservations(routerObservation, verifierObservation);
}

export function buildChatModelAgentObservationHeaders(input: {
  router: unknown;
  verifier?: unknown;
}): Record<string, string> {
  const router = projectChatModelAgentObservation(input.router);
  const verifier =
    input.verifier === undefined
      ? undefined
      : projectChatModelAgentObservation(input.verifier);
  const aggregate = aggregateProjectedObservations(router, verifier);

  return {
    ...observationHeaders('router', router),
    ...observationHeaders('verifier', verifier),
    'x-prepmind-model-agent-calls': String(aggregate.calls),
    'x-prepmind-model-agent-input-tokens': String(aggregate.inputTokens),
    'x-prepmind-model-agent-output-tokens': String(aggregate.outputTokens),
    'x-prepmind-model-agent-total-tokens': String(aggregate.totalTokens),
  };
}

function aggregateProjectedObservations(
  router: SafeChatModelAgentObservation,
  verifier?: SafeChatModelAgentObservation,
): ChatModelAgentObservationAggregate {
  const inputTokens = saturatingAdd(
    router.inputTokens,
    verifier?.inputTokens ?? 0,
  );
  const outputTokens = saturatingAdd(
    router.outputTokens,
    verifier?.outputTokens ?? 0,
  );
  return {
    calls: Number(router.attempted) + Number(verifier?.attempted === true),
    inputTokens,
    outputTokens,
    totalTokens: saturatingAdd(inputTokens, outputTokens),
  };
}

function observationHeaders(
  agent: 'router' | 'verifier',
  observation?: SafeChatModelAgentObservation,
): Record<string, string> {
  const prefix = `x-prepmind-${agent}-model`;
  return {
    [`${prefix}-attempted`]: String(observation?.attempted ?? false),
    [`${prefix}-disposition`]: observation?.disposition ?? ABSENT_DISPOSITION,
    [`${prefix}-duration-ms`]: String(observation?.durationMs ?? 0),
    [`${prefix}-input-tokens`]: String(observation?.inputTokens ?? 0),
    [`${prefix}-output-tokens`]: String(observation?.outputTokens ?? 0),
    [`${prefix}-error-code`]: observation?.errorCode ?? 'none',
    [`${prefix}-provider-failure`]:
      observation?.providerFailureCategory ?? 'none',
  };
}

function readOwnData(value: unknown, key: string): unknown {
  try {
    if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
      return undefined;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function toDisposition(value: unknown): ModelCandidateDisposition {
  return typeof value === 'string' &&
    (MODEL_CANDIDATE_DISPOSITIONS as readonly string[]).includes(value)
    ? (value as ModelCandidateDisposition)
    : DEFAULT_DISPOSITION;
}

function toErrorCode(
  value: unknown,
): ModelAgentErrorCode | 'UNKNOWN' | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'string' &&
    (MODEL_AGENT_ERROR_CODES as readonly string[]).includes(value)
    ? (value as ModelAgentErrorCode)
    : 'UNKNOWN';
}

function toProviderFailureCategory(
  value: unknown,
): ModelAgentProviderFailureCategory | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'string' &&
    (MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES as readonly string[]).includes(value)
    ? (value as ModelAgentProviderFailureCategory)
    : 'unknown';
}

function toSafeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(MAX_SAFE_COUNT, Math.trunc(value));
}

function saturatingAdd(left: number, right: number): number {
  if (left >= MAX_SAFE_COUNT - right) return MAX_SAFE_COUNT;
  return left + right;
}

function emptyObservation(): SafeChatModelAgentObservation {
  return {
    attempted: false,
    disposition: DEFAULT_DISPOSITION,
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}
