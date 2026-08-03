import 'server-only';

import type { OpenAICompatibleExecutorConfig } from '@repo/ai';
import {
  resolvePhase697Sr6ProductReplayConfig,
  type Phase697Sr6ProductReplayConfig,
} from '@repo/agent/model-candidates';
import { TUTOR_V6_MODEL_PROMPT_VERSION as TUTOR_MODEL_PROMPT_VERSION } from '@repo/agent/tutor-v6';

import {
  TUTOR_MODEL,
  TUTOR_MODEL_PRICE_CNY,
  isExactTutorPriceProfile,
} from './tutor-model-pricing.ts';

export {
  TUTOR_MODEL,
  TUTOR_MODEL_PRICE_CNY,
  createTutorModelBudget,
  estimateTutorRequestCostCny,
} from './tutor-model-pricing.ts';

export const TUTOR_MODEL_BASE_URL = 'https://api.deepseek.com/v1' as const;
export { TUTOR_MODEL_PROMPT_VERSION };
export const TUTOR_MODEL_TIMEOUT_MS = 3_000 as const;

export type TutorModelConfig = Readonly<{
  enabled: boolean;
  mode: 'mock' | 'live';
  provider: 'mock' | 'deepseek';
  model: typeof TUTOR_MODEL;
  promptVersion: typeof TUTOR_MODEL_PROMPT_VERSION;
  timeoutMs: typeof TUTOR_MODEL_TIMEOUT_MS;
  pricingKnown: boolean;
  configured: boolean;
  runtimeAuthority: 'disabled' | 'production_live' | 'sr5_sealed_replay';
  replay?: Extract<Phase697Sr6ProductReplayConfig, { enabled: true }>;
  disabledReason?:
    'gate_disabled' | 'mock_mode' | 'global_live_disabled' | 'invalid_component_config';
}>;

type Environment = Record<string, unknown>;

type SafeEnvironmentSnapshot = Readonly<{
  AI_PROVIDER_MODE?: string;
  AI_ENABLE_LIVE_CALLS?: string;
  TUTOR_AGENT_MODEL_ENABLED?: string;
  TUTOR_AGENT_MODEL_TIMEOUT_MS?: string;
  TUTOR_AGENT_DEEPSEEK_API_KEY?: string;
  AI_BASE_URL?: string;
}>;

export function resolveTutorModelConfig(
  env: Environment = process.env,
  priceProfile: unknown = TUTOR_MODEL_PRICE_CNY,
): TutorModelConfig {
  try {
    const replay = resolvePhase697Sr6ProductReplayConfig(env, 'tutor');
    if (replay.enabled) {
      return Object.freeze({
        enabled: true,
        mode: 'mock',
        provider: 'mock',
        model: TUTOR_MODEL,
        promptVersion: TUTOR_MODEL_PROMPT_VERSION,
        timeoutMs: TUTOR_MODEL_TIMEOUT_MS,
        pricingKnown: false,
        configured: true,
        runtimeAuthority: 'sr5_sealed_replay',
        replay,
      });
    }
    const snapshot = readEnvironmentSnapshot(env);
    const pricingKnown = isExactTutorPriceProfile(priceProfile);
    const timeoutValid = resolveTimeout(snapshot.TUTOR_AGENT_MODEL_TIMEOUT_MS) !== null;
    const gateRequested = snapshot.TUTOR_AGENT_MODEL_ENABLED === 'true';

    if (!gateRequested) {
      return disabledConfig({
        configured: timeoutValid && pricingKnown,
        pricingKnown,
        reason: timeoutValid && pricingKnown ? 'gate_disabled' : 'invalid_component_config',
      });
    }
    if (!timeoutValid || !pricingKnown) {
      return disabledConfig({
        configured: false,
        pricingKnown,
        reason: 'invalid_component_config',
      });
    }
    if (snapshot.AI_PROVIDER_MODE !== 'live') {
      return disabledConfig({ configured: true, pricingKnown, reason: 'mock_mode' });
    }
    if (snapshot.AI_ENABLE_LIVE_CALLS !== 'true') {
      return disabledConfig({
        configured: true,
        pricingKnown,
        reason: 'global_live_disabled',
      });
    }
    if (
      snapshot.AI_BASE_URL !== TUTOR_MODEL_BASE_URL ||
      !isNonEmptyString(snapshot.TUTOR_AGENT_DEEPSEEK_API_KEY)
    ) {
      return disabledConfig({
        configured: false,
        pricingKnown,
        reason: 'invalid_component_config',
      });
    }

    return Object.freeze({
      enabled: true,
      mode: 'live',
      provider: 'deepseek',
      model: TUTOR_MODEL,
      promptVersion: TUTOR_MODEL_PROMPT_VERSION,
      timeoutMs: TUTOR_MODEL_TIMEOUT_MS,
      pricingKnown: true,
      configured: true,
      runtimeAuthority: 'production_live',
    });
  } catch {
    return disabledConfig({
      configured: false,
      pricingKnown: false,
      reason: 'invalid_component_config',
    });
  }
}

/** Private server composition input. Never serialize the returned credential. */
export function resolveTutorLiveExecutorConfig(
  env: Environment = process.env,
  priceProfile: unknown = TUTOR_MODEL_PRICE_CNY,
): OpenAICompatibleExecutorConfig | null {
  try {
    const config = resolveTutorModelConfig(env, priceProfile);
    if (!config.enabled || config.runtimeAuthority !== 'production_live') return null;
    const snapshot = readEnvironmentSnapshot(env);
    const apiKey = snapshot.TUTOR_AGENT_DEEPSEEK_API_KEY?.trim();
    if (!apiKey || snapshot.AI_BASE_URL !== TUTOR_MODEL_BASE_URL) return null;

    return {
      provider: 'deepseek',
      apiKey,
      baseURL: TUTOR_MODEL_BASE_URL,
      model: TUTOR_MODEL,
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    };
  } catch {
    return null;
  }
}

function readEnvironmentSnapshot(env: Environment): SafeEnvironmentSnapshot {
  if (typeof env !== 'object' || env === null) {
    throw new Error('INVALID_TUTOR_MODEL_ENVIRONMENT');
  }
  return Object.freeze({
    AI_PROVIDER_MODE: readOptionalString(env, 'AI_PROVIDER_MODE'),
    AI_ENABLE_LIVE_CALLS: readOptionalString(env, 'AI_ENABLE_LIVE_CALLS'),
    TUTOR_AGENT_MODEL_ENABLED: readOptionalString(env, 'TUTOR_AGENT_MODEL_ENABLED'),
    TUTOR_AGENT_MODEL_TIMEOUT_MS: readOptionalString(env, 'TUTOR_AGENT_MODEL_TIMEOUT_MS'),
    TUTOR_AGENT_DEEPSEEK_API_KEY: readOptionalString(env, 'TUTOR_AGENT_DEEPSEEK_API_KEY'),
    AI_BASE_URL: readOptionalString(env, 'AI_BASE_URL'),
  });
}

function readOptionalString(env: Environment, key: string): string | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(env, key);
  if (descriptor === undefined) return undefined;
  if (!('value' in descriptor)) throw new Error('INVALID_TUTOR_MODEL_ENVIRONMENT');
  if (descriptor.value === undefined) return undefined;
  if (typeof descriptor.value !== 'string') {
    throw new Error('INVALID_TUTOR_MODEL_ENVIRONMENT');
  }
  return descriptor.value;
}

function resolveTimeout(value: string | undefined): typeof TUTOR_MODEL_TIMEOUT_MS | null {
  return value === undefined || value === '' || value === String(TUTOR_MODEL_TIMEOUT_MS)
    ? TUTOR_MODEL_TIMEOUT_MS
    : null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function disabledConfig(input: {
  configured: boolean;
  pricingKnown: boolean;
  reason: NonNullable<TutorModelConfig['disabledReason']>;
}): TutorModelConfig {
  return Object.freeze({
    enabled: false,
    mode: 'mock',
    provider: 'mock',
    model: TUTOR_MODEL,
    promptVersion: TUTOR_MODEL_PROMPT_VERSION,
    timeoutMs: TUTOR_MODEL_TIMEOUT_MS,
    pricingKnown: input.pricingKnown,
    configured: input.configured,
    runtimeAuthority: 'disabled',
    disabledReason: input.reason,
  });
}
