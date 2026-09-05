import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDevAiModeStatus,
  getDevAiModeOverride,
  resetDevAiModeForTest,
  resolveDevAiModeRuntimeEnvironment,
  setDevAiMode,
} from './dev-ai-mode.ts';

test('is enabled by default only in an explicitly local runtime', () => {
  resetDevAiModeForTest();

  assert.equal(buildDevAiModeStatus({ NODE_ENV: 'development' }).enabled, true);
  assert.equal(
    buildDevAiModeStatus({
      NODE_ENV: 'production',
      AI_DEV_MODE_SWITCH_ENABLED: 'true',
    }).enabled,
    false,
  );
  assert.equal(
    getDevAiModeOverride({
      NODE_ENV: 'development',
      AI_DEV_MODE_SWITCH_ENABLED: 'false',
    }),
    null,
  );
});

test('is enabled by default in a local standalone container and can be explicitly disabled', () => {
  resetDevAiModeForTest();
  const env = {
    NODE_ENV: 'production',
    PREPMIND_LOCAL_DEV_TOOLS_ENABLED: 'true',
  };

  const status = buildDevAiModeStatus(env);

  assert.equal(status.enabled, true);
  assert.equal(status.activeMode, 'mock');
  assert.equal(getDevAiModeOverride(env), 'mock');
  assert.equal(
    buildDevAiModeStatus({ ...env, AI_DEV_MODE_SWITCH_ENABLED: 'false' }).enabled,
    false,
  );
});

test('defaults to mock when enabled', () => {
  resetDevAiModeForTest();
  const env = {
    NODE_ENV: 'development',
    AI_DEV_MODE_SWITCH_ENABLED: 'true',
  };
  const status = buildDevAiModeStatus(env);

  assert.equal(status.enabled, true);
  assert.equal(status.envMode, 'mock');
  assert.equal(status.activeMode, 'mock');
  assert.equal(status.requestedMode, 'mock');
  assert.equal(status.liveAllowedByEnv, false);
  assert.equal(getDevAiModeOverride(env), 'mock');
});

test('live selection is the local runtime consent and supplies safe chat defaults', () => {
  resetDevAiModeForTest();
  const env = {
    NODE_ENV: 'development',
    AI_PROVIDER_MODE: 'mock',
    AI_ENABLE_LIVE_CALLS: 'false',
    AI_BASE_URL: 'https://api.deepseek.com',
    DEEPSEEK_API_KEY: 'sk-test',
  };

  assert.deepEqual(setDevAiMode('live', env), { ok: true });
  const status = buildDevAiModeStatus(env);
  assert.equal(status.requestedMode, 'live');
  assert.equal(status.activeMode, 'live');
  assert.equal(status.liveAllowedByEnv, true);
  assert.equal(getDevAiModeOverride(env), 'live');

  const runtimeEnv = resolveDevAiModeRuntimeEnvironment(env);
  assert.equal(runtimeEnv.AI_PROVIDER_MODE, 'live');
  assert.equal(runtimeEnv.AI_ENABLE_LIVE_CALLS, 'true');
  assert.equal(runtimeEnv.AI_BASE_URL, 'https://api.deepseek.com/v1');
  assert.equal(runtimeEnv.ROUTER_MODEL_ENABLED, 'true');
  assert.equal(runtimeEnv.KNOWLEDGE_VERIFIER_MODEL_ENABLED, 'true');
  assert.equal(runtimeEnv.TUTOR_AGENT_MODEL_ENABLED, 'true');
  assert.equal(runtimeEnv.RETRIEVER_QUERY_REWRITE_MODEL_ENABLED, 'true');
  assert.equal(runtimeEnv.FINAL_RESPONSE_AGENT_MODEL_ENABLED, 'true');
  assert.equal(runtimeEnv.TUTOR_AGENT_DEEPSEEK_API_KEY, 'sk-test');

  const invalidResult = setDevAiMode('bad', env);
  assert.equal(invalidResult.ok, false);
  if (!invalidResult.ok) {
    assert.equal(invalidResult.status, 400);
  }
  assert.equal(buildDevAiModeStatus(env).requestedMode, 'live');
});

test('keeps an explicitly disabled component gate while defaulting missing gates on', () => {
  resetDevAiModeForTest();
  const env = {
    NODE_ENV: 'development',
    ROUTER_MODEL_ENABLED: 'false',
    DEEPSEEK_API_KEY: 'sk-test',
  };

  assert.deepEqual(setDevAiMode('live', env), { ok: true });
  const runtimeEnv = resolveDevAiModeRuntimeEnvironment(env);
  assert.equal(runtimeEnv.ROUTER_MODEL_ENABLED, 'false');
  assert.equal(runtimeEnv.KNOWLEDGE_VERIFIER_MODEL_ENABLED, 'true');
});

test('allows selecting live without a key but reports that the provider is not ready', () => {
  resetDevAiModeForTest();
  const env = {
    NODE_ENV: 'development',
    AI_PROVIDER_MODE: 'mock',
    DEEPSEEK_API_KEY: '',
    OPENAI_API_KEY: '',
  };

  assert.deepEqual(setDevAiMode('live', env), { ok: true });

  const status = buildDevAiModeStatus(env);
  assert.equal(status.requestedMode, 'live');
  assert.equal(status.activeMode, 'live');
  assert.equal(status.liveAllowedByEnv, false);
  assert.match(status.message ?? '', /API Key|OPENAI_API_KEY|DEEPSEEK_API_KEY/);
  assert.equal(resolveDevAiModeRuntimeEnvironment(env).AI_ENABLE_LIVE_CALLS, 'true');
});

test('does not update mode while the switch is disabled', () => {
  resetDevAiModeForTest();

  const result = setDevAiMode('live', {
    NODE_ENV: 'development',
    AI_DEV_MODE_SWITCH_ENABLED: 'false',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 404);
  }
  assert.equal(buildDevAiModeStatus({ NODE_ENV: 'development' }).requestedMode, 'mock');
});

test('reports live readiness from provider config without requiring a manual live guard', () => {
  resetDevAiModeForTest();

  const missingKeyStatus = buildDevAiModeStatus({
    NODE_ENV: 'development',
    AI_ENABLE_LIVE_CALLS: 'false',
    DEEPSEEK_API_KEY: '',
    OPENAI_API_KEY: '',
  });
  assert.equal(missingKeyStatus.liveAllowedByEnv, false);
  assert.match(missingKeyStatus.message ?? '', /API Key|OPENAI_API_KEY|DEEPSEEK_API_KEY/);

  const readyStatus = buildDevAiModeStatus({
    NODE_ENV: 'development',
    AI_ENABLE_LIVE_CALLS: 'false',
    DEEPSEEK_API_KEY: 'sk-test',
  });
  assert.equal(readyStatus.liveAllowedByEnv, true);
  assert.equal(readyStatus.message, null);
});

test('mock selection overrides a live base environment without mutating it', () => {
  resetDevAiModeForTest();
  const env = {
    NODE_ENV: 'development',
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: 'true',
    DEEPSEEK_API_KEY: 'sk-test',
  };

  const runtimeEnv = resolveDevAiModeRuntimeEnvironment(env);

  assert.equal(runtimeEnv.AI_PROVIDER_MODE, 'mock');
  assert.equal(env.AI_PROVIDER_MODE, 'live');
});
