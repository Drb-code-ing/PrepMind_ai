import assert from 'node:assert/strict';
import test from 'node:test';

import { resetDevAiModeForTest, setDevAiMode } from './dev-ai-mode.ts';
import { resolveChatProviderRuntime, resolveChatProviderStatus } from './chat-provider-status.ts';

test('uses dev ai mode override when the switch is enabled', () => {
  resetDevAiModeForTest();
  const env = {
    NODE_ENV: 'development',
    AI_PROVIDER_MODE: 'mock',
    AI_ENABLE_LIVE_CALLS: 'false',
    DEEPSEEK_API_KEY: 'sk-test',
  };

  assert.deepEqual(setDevAiMode('live', env), { ok: true });
  const status = resolveChatProviderStatus(env);

  assert.equal(status.configured, true);
  if (status.configured) {
    assert.equal(status.mode, 'live');
  }
});

test('returns one effective environment for the whole chat model chain', () => {
  resetDevAiModeForTest();
  const env = {
    NODE_ENV: 'development',
    AI_PROVIDER_MODE: 'mock',
    AI_ENABLE_LIVE_CALLS: 'false',
    DEEPSEEK_API_KEY: 'sk-test',
  };

  assert.deepEqual(setDevAiMode('live', env), { ok: true });
  const runtime = resolveChatProviderRuntime(env);

  assert.equal(runtime.status.configured, true);
  assert.equal(runtime.environment.AI_PROVIDER_MODE, 'live');
  assert.equal(runtime.environment.AI_ENABLE_LIVE_CALLS, 'true');
  assert.equal(runtime.environment.ROUTER_MODEL_ENABLED, 'true');
  assert.equal(runtime.environment.TUTOR_AGENT_DEEPSEEK_API_KEY, 'sk-test');
});

test('falls back to env mode when the dev switch is disabled', () => {
  resetDevAiModeForTest();
  const enabledEnv = {
    NODE_ENV: 'development',
    AI_DEV_MODE_SWITCH_ENABLED: 'true',
    AI_ENABLE_LIVE_CALLS: 'true',
    DEEPSEEK_API_KEY: 'sk-test',
  };

  assert.deepEqual(setDevAiMode('live', enabledEnv), { ok: true });
  const status = resolveChatProviderStatus({
    NODE_ENV: 'development',
    AI_DEV_MODE_SWITCH_ENABLED: 'false',
    AI_PROVIDER_MODE: 'mock',
    AI_ENABLE_LIVE_CALLS: 'true',
    DEEPSEEK_API_KEY: 'sk-test',
  });

  assert.equal(status.configured, true);
  if (status.configured) {
    assert.equal(status.mode, 'mock');
  }
});
