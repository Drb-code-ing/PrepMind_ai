import assert from 'node:assert/strict';
import test from 'node:test';

import { resetDevAiModeForTest, setDevAiMode } from './dev-ai-mode.ts';
import { resolveChatProviderStatus } from './chat-provider-status.ts';

test('uses dev ai mode override when the switch is enabled', () => {
  resetDevAiModeForTest();
  const env = {
    NODE_ENV: 'development',
    AI_DEV_MODE_SWITCH_ENABLED: 'true',
    AI_PROVIDER_MODE: 'mock',
    AI_ENABLE_LIVE_CALLS: '',
    DEEPSEEK_API_KEY: 'sk-test',
  };

  assert.deepEqual(setDevAiMode('live', env), { ok: true });
  const status = resolveChatProviderStatus(env);

  assert.equal(status.configured, false);
  assert.equal(status.mode, 'live');
});

test('falls back to env mode when the dev switch is disabled', () => {
  resetDevAiModeForTest();
  const enabledEnv = {
    NODE_ENV: 'development',
    AI_DEV_MODE_SWITCH_ENABLED: 'true',
  };

  assert.deepEqual(setDevAiMode('live', enabledEnv), { ok: true });
  const status = resolveChatProviderStatus({
    NODE_ENV: 'development',
    AI_DEV_MODE_SWITCH_ENABLED: '',
    AI_PROVIDER_MODE: 'mock',
    AI_ENABLE_LIVE_CALLS: 'true',
    DEEPSEEK_API_KEY: 'sk-test',
  });

  assert.equal(status.configured, true);
  if (status.configured) {
    assert.equal(status.mode, 'mock');
  }
});
