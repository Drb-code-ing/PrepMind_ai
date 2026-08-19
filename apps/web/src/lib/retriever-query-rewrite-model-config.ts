import 'server-only';

import type { OpenAICompatibleExecutorConfig } from '@repo/ai';
import type { RetrieverQueryRewriteCandidateConfigV1 } from '@repo/agent/retriever-query-rewrite';

const RETRIEVER_QUERY_REWRITE_CONFIG_VERSION =
  'retriever-query-rewrite-candidate-config-v1' as const;
export const RETRIEVER_QUERY_REWRITE_MODEL = 'deepseek-v4-pro' as const;
export const RETRIEVER_QUERY_REWRITE_BASE_URL = 'https://api.deepseek.com/v1' as const;
export const RETRIEVER_QUERY_REWRITE_TIMEOUT_MS = 4_000 as const;
export const RETRIEVER_QUERY_REWRITE_MAX_INPUT_TOKENS = 1_200 as const;
export const RETRIEVER_QUERY_REWRITE_MAX_OUTPUT_TOKENS = 160 as const;
const RETRIEVER_QUERY_REWRITE_MAX_COST_CNY = 0.005 as const;

export const RETRIEVER_QUERY_REWRITE_MODEL_PRICE_CNY = Object.freeze({
  model: RETRIEVER_QUERY_REWRITE_MODEL,
  inputPerMillion: 3,
  outputPerMillion: 6,
  requestCap: RETRIEVER_QUERY_REWRITE_MAX_COST_CNY,
});

export type RetrieverQueryRewriteModelConfig = RetrieverQueryRewriteCandidateConfigV1 &
  Readonly<{
    configured: boolean;
    disabledReason?:
      'gate_disabled' | 'mock_mode' | 'global_live_disabled' | 'invalid_component_config';
  }>;

type Environment = Record<string, unknown>;

type SafeEnvironmentSnapshot = Readonly<{
  AI_PROVIDER_MODE?: string;
  AI_ENABLE_LIVE_CALLS?: string;
  AI_BASE_URL?: string;
  RETRIEVER_QUERY_REWRITE_MODEL_ENABLED?: string;
  RETRIEVER_QUERY_REWRITE_MODEL_TIMEOUT_MS?: string;
}>;

export function resolveRetrieverQueryRewriteModelConfig(
  env: Environment = process.env,
): RetrieverQueryRewriteModelConfig {
  try {
    const snapshot = readNonSecretEnvironmentSnapshot(env);
    const timeoutValid = resolveTimeout(snapshot.RETRIEVER_QUERY_REWRITE_MODEL_TIMEOUT_MS) !== null;
    const baseURLValid = snapshot.AI_BASE_URL === RETRIEVER_QUERY_REWRITE_BASE_URL;
    const gateRequested = snapshot.RETRIEVER_QUERY_REWRITE_MODEL_ENABLED === 'true';

    if (!gateRequested) {
      return disabledConfig({
        configured: timeoutValid && baseURLValid,
        reason: timeoutValid && baseURLValid ? 'gate_disabled' : 'invalid_component_config',
      });
    }
    if (!timeoutValid || !baseURLValid) {
      return disabledConfig({ configured: false, reason: 'invalid_component_config' });
    }
    if (snapshot.AI_PROVIDER_MODE !== 'live') {
      return disabledConfig({ configured: true, reason: 'mock_mode' });
    }
    if (snapshot.AI_ENABLE_LIVE_CALLS !== 'true') {
      return disabledConfig({ configured: true, reason: 'global_live_disabled' });
    }

    return Object.freeze({
      schemaVersion: RETRIEVER_QUERY_REWRITE_CONFIG_VERSION,
      enabled: true,
      runtimeAuthority: 'production_live',
      mode: 'live',
      provider: 'deepseek',
      model: RETRIEVER_QUERY_REWRITE_MODEL,
      baseURL: RETRIEVER_QUERY_REWRITE_BASE_URL,
      timeoutMs: RETRIEVER_QUERY_REWRITE_TIMEOUT_MS,
      globalLiveCallsEnabled: true,
      configured: true,
    });
  } catch {
    return disabledConfig({ configured: false, reason: 'invalid_component_config' });
  }
}

/** Reads the component credential only after caller-owned eligibility has passed. */
export function resolveRetrieverQueryRewriteLiveExecutorConfig(
  env: Environment = process.env,
): OpenAICompatibleExecutorConfig | null {
  try {
    const config = resolveRetrieverQueryRewriteModelConfig(env);
    if (!config.enabled || config.runtimeAuthority !== 'production_live') return null;
    const apiKey = readPreferredCredential(
      env,
      'RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY',
      'DEEPSEEK_API_KEY',
    );
    if (apiKey === null) return null;
    return Object.freeze({
      provider: 'deepseek' as const,
      apiKey,
      baseURL: RETRIEVER_QUERY_REWRITE_BASE_URL,
      model: RETRIEVER_QUERY_REWRITE_MODEL,
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json' as const,
    });
  } catch {
    return null;
  }
}

export function estimateRetrieverQueryRewriteRequestCostCny(
  inputTokens: number,
  outputTokens: number,
): Readonly<{ estimatedCostCny: number; withinCap: boolean }> | null {
  if (
    !Number.isSafeInteger(inputTokens) ||
    inputTokens < 0 ||
    inputTokens > RETRIEVER_QUERY_REWRITE_MAX_INPUT_TOKENS ||
    !Number.isSafeInteger(outputTokens) ||
    outputTokens < 0 ||
    outputTokens > RETRIEVER_QUERY_REWRITE_MAX_OUTPUT_TOKENS
  ) {
    return null;
  }
  const estimatedCostCny =
    (inputTokens * RETRIEVER_QUERY_REWRITE_MODEL_PRICE_CNY.inputPerMillion +
      outputTokens * RETRIEVER_QUERY_REWRITE_MODEL_PRICE_CNY.outputPerMillion) /
    1_000_000;
  return Object.freeze({
    estimatedCostCny,
    withinCap: estimatedCostCny <= RETRIEVER_QUERY_REWRITE_MODEL_PRICE_CNY.requestCap,
  });
}

function readNonSecretEnvironmentSnapshot(env: Environment): SafeEnvironmentSnapshot {
  if (typeof env !== 'object' || env === null) {
    throw new Error('INVALID_RETRIEVER_QUERY_REWRITE_ENVIRONMENT');
  }
  return Object.freeze({
    AI_PROVIDER_MODE: readOptionalString(env, 'AI_PROVIDER_MODE'),
    AI_ENABLE_LIVE_CALLS: readOptionalString(env, 'AI_ENABLE_LIVE_CALLS'),
    AI_BASE_URL: readOptionalString(env, 'AI_BASE_URL'),
    RETRIEVER_QUERY_REWRITE_MODEL_ENABLED: readOptionalString(
      env,
      'RETRIEVER_QUERY_REWRITE_MODEL_ENABLED',
    ),
    RETRIEVER_QUERY_REWRITE_MODEL_TIMEOUT_MS: readOptionalString(
      env,
      'RETRIEVER_QUERY_REWRITE_MODEL_TIMEOUT_MS',
    ),
  });
}

function readOptionalString(env: Environment, key: string): string | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(env, key);
  if (descriptor === undefined) return undefined;
  if (!('value' in descriptor)) throw new Error('INVALID_RETRIEVER_QUERY_REWRITE_ENVIRONMENT');
  if (descriptor.value === undefined) return undefined;
  if (typeof descriptor.value !== 'string') {
    throw new Error('INVALID_RETRIEVER_QUERY_REWRITE_ENVIRONMENT');
  }
  return descriptor.value;
}

function readRequiredCredential(env: Environment, key: string): string | null {
  const value = readOptionalString(env, key);
  return value === undefined ? null : validateCredential(value);
}

function readPreferredCredential(
  env: Environment,
  componentKey: string,
  fallbackKey: string,
): string | null {
  const componentValue = readOptionalString(env, componentKey);
  if (componentValue !== undefined && componentValue !== '') {
    return validateCredential(componentValue);
  }
  return readRequiredCredential(env, fallbackKey);
}

function validateCredential(value: string): string | null {
  if (value !== value.trim() || value.length < 1 || value.length > 512) {
    return null;
  }
  return /^[\x21-\x7e]+$/u.test(value) ? value : null;
}

function resolveTimeout(
  value: string | undefined,
): typeof RETRIEVER_QUERY_REWRITE_TIMEOUT_MS | null {
  return value === undefined || value === '' || value === String(RETRIEVER_QUERY_REWRITE_TIMEOUT_MS)
    ? RETRIEVER_QUERY_REWRITE_TIMEOUT_MS
    : null;
}

function disabledConfig(input: {
  configured: boolean;
  reason: NonNullable<RetrieverQueryRewriteModelConfig['disabledReason']>;
}): RetrieverQueryRewriteModelConfig {
  return Object.freeze({
    schemaVersion: RETRIEVER_QUERY_REWRITE_CONFIG_VERSION,
    enabled: false,
    runtimeAuthority: 'disabled',
    mode: 'mock',
    provider: 'mock',
    model: RETRIEVER_QUERY_REWRITE_MODEL,
    baseURL: RETRIEVER_QUERY_REWRITE_BASE_URL,
    timeoutMs: RETRIEVER_QUERY_REWRITE_TIMEOUT_MS,
    globalLiveCallsEnabled: false,
    configured: input.configured,
    disabledReason: input.reason,
  });
}
