import 'server-only';

import type { FinalResponseStreamProviderConfig } from '@repo/ai';
import {
  FINAL_RESPONSE_AGENT_CONFIG_VERSION,
  FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY,
  FINAL_RESPONSE_AGENT_MAX_COST_CNY,
  FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS,
  FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS,
  FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY,
  FINAL_RESPONSE_AGENT_PRICE_PROFILE,
  FINAL_RESPONSE_AGENT_TIMEOUT_MS,
  type FinalResponseAgentConfigV1,
} from '@repo/agent/final-response';

export const FINAL_RESPONSE_MODEL = 'deepseek-v4-pro' as const;
export const FINAL_RESPONSE_MODEL_REF = 'deepseek-v4-pro-nonthinking-v1' as const;
export const FINAL_RESPONSE_MODEL_BASE_URL = 'https://api.deepseek.com/v1' as const;

export const FINAL_RESPONSE_MODEL_PRICE_CNY = Object.freeze({
  profile: FINAL_RESPONSE_AGENT_PRICE_PROFILE,
  model: FINAL_RESPONSE_MODEL,
  inputPerMillion: FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY,
  outputPerMillion: FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY,
  requestCap: FINAL_RESPONSE_AGENT_MAX_COST_CNY,
});

type Environment = Record<string, unknown>;

type SafeEnvironmentSnapshot = Readonly<{
  AI_PROVIDER_MODE?: string;
  AI_ENABLE_LIVE_CALLS?: string;
  AI_BASE_URL?: string;
  FINAL_RESPONSE_AGENT_MODEL_ENABLED?: string;
  FINAL_RESPONSE_AGENT_MODEL_TIMEOUT_MS?: string;
}>;

export function resolveFinalResponseModelConfig(
  env: Environment = process.env,
): FinalResponseAgentConfigV1 {
  try {
    const snapshot = readNonSecretEnvironmentSnapshot(env);
    const gateRequested = snapshot.FINAL_RESPONSE_AGENT_MODEL_ENABLED === 'true';
    const timeoutValid = resolveTimeout(snapshot.FINAL_RESPONSE_AGENT_MODEL_TIMEOUT_MS) !== null;
    const baseURLValid = snapshot.AI_BASE_URL === FINAL_RESPONSE_MODEL_BASE_URL;

    if (
      !gateRequested ||
      !timeoutValid ||
      !baseURLValid ||
      snapshot.AI_PROVIDER_MODE !== 'live' ||
      snapshot.AI_ENABLE_LIVE_CALLS !== 'true'
    ) {
      return disabledConfig();
    }

    return Object.freeze({
      schemaVersion: FINAL_RESPONSE_AGENT_CONFIG_VERSION,
      enabled: true,
      runtimeAuthority: 'production_live',
      mode: 'live',
      provider: 'deepseek',
      modelRef: FINAL_RESPONSE_MODEL_REF,
      executorProvenance: 'deepseek_network',
      timeoutMs: FINAL_RESPONSE_AGENT_TIMEOUT_MS,
      maxInputTokens: FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS,
      maxOutputTokens: FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS,
      priceProfile: FINAL_RESPONSE_AGENT_PRICE_PROFILE,
      inputPerMillionCny: FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY,
      outputPerMillionCny: FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY,
      requestCapCny: FINAL_RESPONSE_AGENT_MAX_COST_CNY,
    });
  } catch {
    return disabledConfig();
  }
}

/** Reads the dedicated component credential only after the full Live eligibility gate passes. */
export function resolveFinalResponseLiveExecutorConfig(
  env: Environment = process.env,
): FinalResponseStreamProviderConfig | null {
  try {
    const config = resolveFinalResponseModelConfig(env);
    if (!config.enabled || config.runtimeAuthority !== 'production_live') return null;
    const apiKey = readRequiredCredential(env, 'FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY');
    if (apiKey === null) return null;
    return Object.freeze({
      apiKey,
      baseURL: FINAL_RESPONSE_MODEL_BASE_URL,
      model: FINAL_RESPONSE_MODEL,
    });
  } catch {
    return null;
  }
}

export function estimateFinalResponseRequestCostCny(
  inputTokens: number,
  outputTokens: number,
): Readonly<{ estimatedCostCny: number; withinCap: boolean }> | null {
  if (
    !Number.isSafeInteger(inputTokens) ||
    inputTokens < 0 ||
    inputTokens > FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS ||
    !Number.isSafeInteger(outputTokens) ||
    outputTokens < 0 ||
    outputTokens > FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS
  ) {
    return null;
  }
  const estimatedCostCny =
    (inputTokens * FINAL_RESPONSE_MODEL_PRICE_CNY.inputPerMillion +
      outputTokens * FINAL_RESPONSE_MODEL_PRICE_CNY.outputPerMillion) /
    1_000_000;
  return Object.freeze({
    estimatedCostCny,
    withinCap: estimatedCostCny <= FINAL_RESPONSE_MODEL_PRICE_CNY.requestCap,
  });
}

function readNonSecretEnvironmentSnapshot(env: Environment): SafeEnvironmentSnapshot {
  if (typeof env !== 'object' || env === null) {
    throw new Error('INVALID_FINAL_RESPONSE_ENVIRONMENT');
  }
  return Object.freeze({
    AI_PROVIDER_MODE: readOptionalString(env, 'AI_PROVIDER_MODE'),
    AI_ENABLE_LIVE_CALLS: readOptionalString(env, 'AI_ENABLE_LIVE_CALLS'),
    AI_BASE_URL: readOptionalString(env, 'AI_BASE_URL'),
    FINAL_RESPONSE_AGENT_MODEL_ENABLED: readOptionalString(
      env,
      'FINAL_RESPONSE_AGENT_MODEL_ENABLED',
    ),
    FINAL_RESPONSE_AGENT_MODEL_TIMEOUT_MS: readOptionalString(
      env,
      'FINAL_RESPONSE_AGENT_MODEL_TIMEOUT_MS',
    ),
  });
}

function readOptionalString(env: Environment, key: string): string | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(env, key);
  if (descriptor === undefined) return undefined;
  if (!('value' in descriptor)) throw new Error('INVALID_FINAL_RESPONSE_ENVIRONMENT');
  if (descriptor.value === undefined) return undefined;
  if (typeof descriptor.value !== 'string') {
    throw new Error('INVALID_FINAL_RESPONSE_ENVIRONMENT');
  }
  return descriptor.value;
}

function readRequiredCredential(env: Environment, key: string): string | null {
  const value = readOptionalString(env, key);
  if (value === undefined || value !== value.trim() || value.length < 1 || value.length > 512) {
    return null;
  }
  return /^[\x21-\x7e]+$/u.test(value) ? value : null;
}

function resolveTimeout(value: string | undefined): typeof FINAL_RESPONSE_AGENT_TIMEOUT_MS | null {
  return value === undefined || value === '' || value === String(FINAL_RESPONSE_AGENT_TIMEOUT_MS)
    ? FINAL_RESPONSE_AGENT_TIMEOUT_MS
    : null;
}

function disabledConfig(): FinalResponseAgentConfigV1 {
  return Object.freeze({
    schemaVersion: FINAL_RESPONSE_AGENT_CONFIG_VERSION,
    enabled: false,
    runtimeAuthority: 'disabled',
    mode: 'mock',
    provider: 'mock',
    modelRef: 'mock-local-v1',
    executorProvenance: 'none',
    timeoutMs: FINAL_RESPONSE_AGENT_TIMEOUT_MS,
    maxInputTokens: FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS,
    maxOutputTokens: FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS,
    priceProfile: FINAL_RESPONSE_AGENT_PRICE_PROFILE,
    inputPerMillionCny: FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY,
    outputPerMillionCny: FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY,
    requestCapCny: FINAL_RESPONSE_AGENT_MAX_COST_CNY,
  });
}
