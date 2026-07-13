import { createHash } from 'node:crypto';

import type {
  ModelAgentError,
  ModelAgentErrorCode,
  ModelAgentProviderFailureCategory,
} from './model-agent-contract';

const ERROR_MESSAGES: Record<ModelAgentErrorCode, string> = {
  INVALID_REQUEST: 'Model agent request is invalid.',
  INVALID_RUNTIME_CONFIG: 'Model agent runtime configuration is invalid.',
  LIVE_CALLS_DISABLED: 'Live model agent calls are disabled.',
  EXECUTOR_UNAVAILABLE: 'Model agent executor is unavailable.',
  CALL_BUDGET_EXCEEDED: 'Model agent call budget was exceeded.',
  INPUT_BUDGET_EXCEEDED: 'Model agent input budget was exceeded.',
  OUTPUT_BUDGET_EXCEEDED: 'Model agent output budget was exceeded.',
  SCHEMA_INVALID: 'Model output did not match the required schema.',
  TIMEOUT: 'Model agent call timed out.',
  ABORTED: 'Model agent call was aborted.',
  PROVIDER_ERROR: 'Model provider request failed.',
};

export function createSafeModelAgentError(
  code: ModelAgentErrorCode,
  providerFailureCategory?: ModelAgentProviderFailureCategory,
): ModelAgentError {
  if (code === 'PROVIDER_ERROR') {
    const category = providerFailureCategory ?? 'unknown';
    return {
      code,
      message: ERROR_MESSAGES[code],
      retryable:
        category === 'http_rate_limit' ||
        category === 'http_server' ||
        category === 'transport',
      providerFailureCategory: category,
    };
  }

  return {
    code,
    message: ERROR_MESSAGES[code],
    retryable: code === 'TIMEOUT',
  };
}

export function hashModelAgentRunId(runId: string) {
  return `sha256:${createHash('sha256').update(runId).digest('hex')}`;
}

export function isSafeModelName(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._:/-]{1,120}$/.test(value);
}
