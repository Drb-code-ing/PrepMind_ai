import assert from 'node:assert/strict';
import test from 'node:test';

import { getAiProviderStatus } from './ai-provider.ts';

test('defaults to mock mode without requiring an AI API key', () => {
  const status = getAiProviderStatus({
    DEEPSEEK_API_KEY: '',
    OPENAI_API_KEY: '',
    AI_MODEL: '',
    AI_BASE_URL: '',
  });

  assert.deepEqual(status, {
    configured: true,
    mode: 'mock',
    model: 'mock-prepmind-chat',
    baseURL: 'local-mock',
    maxInputTokens: 2500,
    maxOutputTokens: 1200,
  });
});

test('keeps mock mode when an AI API key exists but live calls are not explicitly enabled', () => {
  const status = getAiProviderStatus({
    DEEPSEEK_API_KEY: 'sk-test',
    OPENAI_API_KEY: '',
    AI_MODEL: '',
    AI_BASE_URL: '',
  });

  assert.deepEqual(status, {
    configured: true,
    mode: 'mock',
    model: 'mock-prepmind-chat',
    baseURL: 'local-mock',
    maxInputTokens: 2500,
    maxOutputTokens: 1200,
  });
});

test('blocks live mode unless the live-call guard is enabled', () => {
  const status = getAiProviderStatus({
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: '',
    DEEPSEEK_API_KEY: 'sk-test',
    OPENAI_API_KEY: '',
  });

  assert.deepEqual(status, {
    configured: false,
    mode: 'live',
    message: '真实模型调用已被成本保护拦截，请设置 AI_ENABLE_LIVE_CALLS=true 后重启前端服务。',
  });
});

test('reports live provider runtime config only when live mode and guard are both enabled', () => {
  const status = getAiProviderStatus({
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: 'true',
    DEEPSEEK_API_KEY: 'sk-test',
    OPENAI_API_KEY: '',
    AI_MODEL: 'deepseek-chat',
    AI_BASE_URL: '',
    AI_MAX_INPUT_TOKENS: '1800',
    AI_MAX_OUTPUT_TOKENS: '900',
  });

  assert.deepEqual(status, {
    configured: true,
    mode: 'live',
    model: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com',
    maxInputTokens: 1800,
    maxOutputTokens: 900,
  });
});

test('uses deepseek v4 flash as the default live model for cost control', () => {
  const status = getAiProviderStatus({
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: 'true',
    DEEPSEEK_API_KEY: 'sk-test',
    OPENAI_API_KEY: '',
    AI_MODEL: '',
  });

  assert.equal(status.configured, true);
  if (status.configured) {
    assert.equal(status.model, 'deepseek-v4-flash');
  }
});
