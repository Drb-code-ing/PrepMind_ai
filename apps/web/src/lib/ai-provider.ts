import { createOpenAI } from '@ai-sdk/openai';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const MISSING_AI_KEY_MESSAGE =
  'AI API Key 未配置，请在 apps/web/.env.local 设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 后重启前端服务。';

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
      model: string;
      baseURL: string;
    }
  | {
      configured: false;
      message: string;
    };

export function getAiProviderStatus(env: NodeJS.ProcessEnv = process.env): AiProviderStatus {
  const apiKey = env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      configured: false,
      message: MISSING_AI_KEY_MESSAGE,
    };
  }

  return {
    configured: true,
    model: env.AI_MODEL || 'deepseek-chat',
    baseURL: env.AI_BASE_URL || DEFAULT_BASE_URL,
  };
}
