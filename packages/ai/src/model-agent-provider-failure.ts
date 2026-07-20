import {
  APICallError,
  EmptyResponseBodyError,
  InvalidResponseDataError,
  JSONParseError,
  NoObjectGeneratedError,
  TypeValidationError,
} from 'ai';

import {
  MODEL_AGENT_STRUCTURED_OUTPUT_STAGES,
} from './model-agent-contract.ts';
import type {
  ModelAgentProviderFailureCategory,
  ModelAgentStructuredOutputStage,
} from './model-agent-contract.ts';

type ProviderFailureEntry = {
  category: ModelAgentProviderFailureCategory;
  structuredOutputStage?: ModelAgentStructuredOutputStage;
  scope: AbortSignal;
};

type ProviderFailureClassification = Readonly<{
  category: ModelAgentProviderFailureCategory;
  structuredOutputStage?: ModelAgentStructuredOutputStage;
}>;

const providerFailureCategories = new WeakMap<object, ProviderFailureEntry>();

/**
 * Only call this from the private adapter catch boundary for the default AI SDK dependencies.
 * Official SDK markers preserve cross-package compatibility; the dependency identity and
 * invocation scope at that boundary, not the marker, establish trusted provenance.
 */
export function createTrustedModelAgentProviderFailureSignal(
  error: unknown,
  scope: AbortSignal,
): Error {
  return createSignal(classifyProviderFailure(error), scope);
}

/**
 * Use this for injected/custom dependencies and outer catches whose provenance is untrusted.
 * It intentionally accepts no error and cannot inspect or retain provider-controlled data.
 */
export function createUntrustedModelAgentProviderFailureSignal(scope: AbortSignal): Error {
  return createSignal({ category: 'unknown' }, scope);
}

/**
 * Private runtime capability for a first-party direct adapter that has already
 * reduced its own parser/type failure to a fixed stage. The signal retains no
 * provider-controlled error or response. Unknown stage values fail closed as
 * ordinary unknown provider failures.
 */
export function createTrustedModelAgentStructuredOutputFailureSignal(
  scope: AbortSignal,
  stage: unknown,
): Error {
  return createSignal(
    isStructuredOutputStage(stage)
      ? { category: 'structured_output', structuredOutputStage: stage }
      : { category: 'unknown' },
    scope,
  );
}

function createSignal(
  classification: ProviderFailureClassification,
  scope: AbortSignal,
): Error {
  const signal = new Error('MODEL_AGENT_PROVIDER_REQUEST_FAILED');
  signal.name = 'ModelAgentProviderFailure';
  providerFailureCategories.set(signal, {
    category: classification.category,
    ...(classification.structuredOutputStage
      ? { structuredOutputStage: classification.structuredOutputStage }
      : {}),
    scope,
  });
  return signal;
}

/**
 * Private runtime handoff. It carries only fixed classification values, never
 * a provider exception, message, raw object, response, or model text.
 */
export function takeModelAgentProviderFailure(
  value: unknown,
  expectedScope: AbortSignal,
): ProviderFailureClassification | undefined {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return undefined;
  }

  const entry = providerFailureCategories.get(value);
  if (!entry || entry.scope !== expectedScope) return undefined;

  providerFailureCategories.delete(value);
  return {
    category: entry.category,
    ...(entry.structuredOutputStage
      ? { structuredOutputStage: entry.structuredOutputStage }
      : {}),
  };
}

export function takeModelAgentProviderFailureCategory(
  value: unknown,
  expectedScope: AbortSignal,
): ModelAgentProviderFailureCategory | undefined {
  return takeModelAgentProviderFailure(value, expectedScope)?.category;
}

function classifyProviderFailure(error: unknown): ProviderFailureClassification {
  const structuredOutputStage = classifyStructuredOutputFailure(error);
  if (structuredOutputStage) {
    return {
      category: 'structured_output',
      structuredOutputStage,
    };
  }

  if (
    safeGuard(error, EmptyResponseBodyError) ||
    safeGuard(error, InvalidResponseDataError)
  ) {
    return { category: 'invalid_response' };
  }

  if (safeGuard(error, APICallError)) {
    return { category: classifyApiCallError(error) };
  }

  return { category: 'unknown' };
}

/**
 * This classifier is intentionally kept at the AI SDK adapter boundary. It
 * examines only official error markers and never forwards an error, message,
 * parsed value, response, or raw model text past that boundary.
 */
function classifyStructuredOutputFailure(
  error: unknown,
): ModelAgentStructuredOutputStage | null {
  if (safeGuard(error, JSONParseError)) return 'provider_json_parse';
  if (safeGuard(error, TypeValidationError)) {
    return 'provider_type_validation';
  }
  if (!safeGuard(error, NoObjectGeneratedError)) return null;

  // `generateObject` wraps JSON parse and Zod/type failures in
  // `NoObjectGeneratedError`. This is the only cause chain we inspect; a
  // generic outer error's cause is untrusted and remains opaque.
  const cause = readStructuredOutputCause(error);
  if (safeGuard(cause, JSONParseError)) return 'provider_json_parse';
  if (safeGuard(cause, TypeValidationError)) {
    return 'provider_type_validation';
  }
  return 'provider_object_missing';
}

function readStructuredOutputCause(error: NoObjectGeneratedError): unknown {
  try {
    return error.cause;
  } catch {
    return undefined;
  }
}

function isStructuredOutputStage(
  value: unknown,
): value is ModelAgentStructuredOutputStage {
  return (
    typeof value === 'string' &&
    MODEL_AGENT_STRUCTURED_OUTPUT_STAGES.includes(
      value as ModelAgentStructuredOutputStage,
    )
  );
}

function classifyApiCallError(error: APICallError): ModelAgentProviderFailureCategory {
  let statusCode: unknown;
  try {
    statusCode = error.statusCode;
  } catch {
    return 'unknown';
  }

  if (statusCode === undefined) return 'transport';
  if (typeof statusCode !== 'number' || !Number.isInteger(statusCode)) return 'unknown';
  if (statusCode === 401 || statusCode === 403) return 'http_auth';
  if (statusCode === 429) return 'http_rate_limit';
  if (statusCode >= 400 && statusCode <= 499) return 'http_client';
  if (statusCode >= 500 && statusCode <= 599) return 'http_server';
  return 'unknown';
}

type AiSdkErrorGuard<T> = {
  isInstance(error: unknown): error is T;
};

function safeGuard<T>(error: unknown, errorClass: AiSdkErrorGuard<T>): error is T {
  try {
    return errorClass.isInstance(error);
  } catch {
    return false;
  }
}
