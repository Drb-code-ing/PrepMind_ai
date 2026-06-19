import { createOpenAI } from '@ai-sdk/openai';

import {
  DEFAULT_AI_MAX_INPUT_TOKENS,
  DEFAULT_AI_MAX_OUTPUT_TOKENS,
  MOCK_AI_BASE_URL,
  MOCK_AI_MODEL,
  parseAiTokenLimit,
} from './ai-usage-guard.ts';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
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
export const aiProvider = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
  baseURL: process.env.AI_BASE_URL || DEFAULT_BASE_URL,
});

/** 默认模型 */
export const DEFAULT_MODEL = process.env.AI_MODEL || 'deepseek-chat';

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

export function getAiProviderStatus(env: NodeJS.ProcessEnv = process.env): AiProviderStatus {
  const mode = env.AI_PROVIDER_MODE === 'live' ? 'live' : 'mock';
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

  const apiKey = env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      configured: false,
      mode: 'live',
      message: MISSING_AI_KEY_MESSAGE,
    };
  }

  return {
    configured: true,
    mode: 'live',
    model: env.AI_MODEL || 'deepseek-chat',
    baseURL: env.AI_BASE_URL || DEFAULT_BASE_URL,
    maxInputTokens,
    maxOutputTokens,
  };
}
