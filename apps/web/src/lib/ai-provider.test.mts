import assert from 'node:assert/strict';
import test from 'node:test';

import { getAiProviderStatus } from './ai-provider.ts';

test('reports missing AI API key before starting a stream', () => {
  const status = getAiProviderStatus({
    DEEPSEEK_API_KEY: '',
    OPENAI_API_KEY: '',
    AI_MODEL: '',
    AI_BASE_URL: '',
  });

  assert.deepEqual(status, {
    configured: false,
    message: 'AI API Key 未配置，请在 apps/web/.env.local 设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 后重启前端服务。',
  });
});

test('reports provider runtime config when an AI API key exists', () => {
  const status = getAiProviderStatus({
    DEEPSEEK_API_KEY: 'sk-test',
    OPENAI_API_KEY: '',
    AI_MODEL: '',
    AI_BASE_URL: '',
  });

  assert.deepEqual(status, {
    configured: true,
    model: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com',
  });
});
