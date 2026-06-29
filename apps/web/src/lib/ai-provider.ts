import { createOpenAI } from '@ai-sdk/openai';

import {
  DEFAULT_AI_MAX_INPUT_TOKENS,
  DEFAULT_AI_MAX_OUTPUT_TOKENS,
  MOCK_AI_BASE_URL,
  MOCK_AI_MODEL,
  parseAiTokenLimit,
} from './ai-usage-guard.ts';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_LIVE_MODEL = 'deepseek-v4-flash';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const MISSING_AI_KEY_MESSAGE =
  'AI API Key 未配置，请在 apps/web/.env.local 设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 后重启前端服务。';
const LIVE_CALL_GUARD_MESSAGE =
  '真实模型调用已被成本保护拦截，请设置 AI_ENABLE_LIVE_CALLS=true 后重启前端服务。';

/**
 * 统一 AI Provider 封装
 * 切换模型只改这里，业务代码不感知
 *
 * DeepSeek / OpenAI 都兼容 OpenAI 协议，用同一个 provider
 * 切 OpenAI：baseURL 改为 https://api.openai.com/v1
 */
export function resolveAiProviderRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const deepseekKey = env.DEEPSEEK_API_KEY?.trim();
  const openaiKey = env.OPENAI_API_KEY?.trim();
  const explicitBaseURL = env.AI_BASE_URL?.trim();
  const explicitModel = env.AI_MODEL?.trim();

  if (deepseekKey) {
    return {
      apiKey: deepseekKey,
      baseURL: explicitBaseURL || DEFAULT_BASE_URL,
      model: explicitModel || DEFAULT_LIVE_MODEL,
    };
  }

  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseURL: explicitBaseURL || DEFAULT_OPENAI_BASE_URL,
      model: explicitModel || DEFAULT_OPENAI_MODEL,
    };
  }

  return {
    apiKey: '',
    baseURL: explicitBaseURL || DEFAULT_BASE_URL,
    model: explicitModel || DEFAULT_LIVE_MODEL,
  };
}

const runtimeConfig = resolveAiProviderRuntimeConfig();

export const aiProvider = createOpenAI({
  apiKey: runtimeConfig.apiKey,
  baseURL: runtimeConfig.baseURL,
});

/** 默认模型 */
export const DEFAULT_MODEL = runtimeConfig.model;

export type AiProviderStatus =
  | {
      configured: true;
      mode: 'mock' | 'live';
      model: string;
      baseURL: string;
      maxInputTokens: number;
      maxOutputTokens: number;
    }
  | {
      configured: false;
      mode: 'live';
      message: string;
    };

export function getAiProviderStatus(
  env: NodeJS.ProcessEnv = process.env,
  options: { modeOverride?: 'mock' | 'live' | null } = {},
): AiProviderStatus {
  const mode = options.modeOverride ?? (env.AI_PROVIDER_MODE === 'live' ? 'live' : 'mock');
  const maxInputTokens = parseAiTokenLimit(
    env.AI_MAX_INPUT_TOKENS,
    DEFAULT_AI_MAX_INPUT_TOKENS,
    { min: 200, max: 12000 },
  );
  const maxOutputTokens = parseAiTokenLimit(
    env.AI_MAX_OUTPUT_TOKENS,
    DEFAULT_AI_MAX_OUTPUT_TOKENS,
    { min: 100, max: 4000 },
  );

  if (mode === 'mock') {
    return {
      configured: true,
      mode: 'mock',
      model: MOCK_AI_MODEL,
      baseURL: MOCK_AI_BASE_URL,
      maxInputTokens,
      maxOutputTokens,
    };
  }

  if (env.AI_ENABLE_LIVE_CALLS !== 'true') {
    return {
      configured: false,
      mode: 'live',
      message: LIVE_CALL_GUARD_MESSAGE,
    };
  }

  const runtime = resolveAiProviderRuntimeConfig(env);

  if (!runtime.apiKey) {
    return {
      configured: false,
      mode: 'live',
      message: MISSING_AI_KEY_MESSAGE,
    };
  }

  return {
    configured: true,
    mode: 'live',
    model: runtime.model,
    baseURL: runtime.baseURL,
    maxInputTokens,
    maxOutputTokens,
  };
}
