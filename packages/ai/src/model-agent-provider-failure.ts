import {
  APICallError,
  EmptyResponseBodyError,
  InvalidResponseDataError,
  JSONParseError,
  NoObjectGeneratedError,
  TypeValidationError,
} from 'ai';

import type { ModelAgentProviderFailureCategory } from './model-agent-contract';

const providerFailureCategories = new WeakMap<object, ModelAgentProviderFailureCategory>();

/**
 * Only call this from the private catch boundary around the real AI SDK generateObject call.
 * Official SDK markers preserve cross-package compatibility; the adapter boundary, not the
 * marker, establishes that the caught value has trusted provenance.
 */
export function createTrustedModelAgentProviderFailureSignal(error: unknown): Error {
  return createSignal(classifyProviderFailure(error));
}

/**
 * Use this for injected/custom dependencies and outer catches whose provenance is untrusted.
 * It intentionally accepts no error and cannot inspect or retain provider-controlled data.
 */
export function createUntrustedModelAgentProviderFailureSignal(): Error {
  return createSignal('unknown');
}

function createSignal(category: ModelAgentProviderFailureCategory): Error {
  const signal = new Error('MODEL_AGENT_PROVIDER_REQUEST_FAILED');
  signal.name = 'ModelAgentProviderFailure';
  providerFailureCategories.set(signal, category);
  return signal;
}

export function readModelAgentProviderFailureCategory(
  value: unknown,
): ModelAgentProviderFailureCategory | undefined {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return undefined;
  }

  return providerFailureCategories.get(value);
}

function classifyProviderFailure(error: unknown): ModelAgentProviderFailureCategory {
  if (
    safeGuard(error, NoObjectGeneratedError) ||
    safeGuard(error, JSONParseError) ||
    safeGuard(error, TypeValidationError)
  ) {
    return 'structured_output';
  }

  if (
    safeGuard(error, EmptyResponseBodyError) ||
    safeGuard(error, InvalidResponseDataError)
  ) {
    return 'invalid_response';
  }

  if (safeGuard(error, APICallError)) {
    return classifyApiCallError(error);
  }

  return 'unknown';
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
