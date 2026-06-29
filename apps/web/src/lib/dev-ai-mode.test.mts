import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDevAiModeStatus,
  getDevAiModeOverride,
  resetDevAiModeForTest,
  setDevAiMode,
} from './dev-ai-mode.ts';

test('is disabled unless explicitly enabled outside production', () => {
  resetDevAiModeForTest();

  assert.equal(buildDevAiModeStatus({ NODE_ENV: 'development' }).enabled, false);
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
      AI_DEV_MODE_SWITCH_ENABLED: '',
    }),
    null,
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

test('updates requested mode only for mock or live', () => {
  resetDevAiModeForTest();
  const env = {
    NODE_ENV: 'development',
    AI_DEV_MODE_SWITCH_ENABLED: 'true',
  };

  assert.deepEqual(setDevAiMode('live', env), { ok: true });
  assert.equal(buildDevAiModeStatus(env).requestedMode, 'live');
  assert.equal(getDevAiModeOverride(env), 'live');

  const invalidResult = setDevAiMode('bad', env);
  assert.equal(invalidResult.ok, false);
  if (!invalidResult.ok) {
    assert.equal(invalidResult.status, 400);
  }
  assert.equal(buildDevAiModeStatus(env).requestedMode, 'live');
});

test('does not update mode while the switch is disabled', () => {
  resetDevAiModeForTest();

  const result = setDevAiMode('live', {
    NODE_ENV: 'development',
    AI_DEV_MODE_SWITCH_ENABLED: '',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 404);
  }
  assert.equal(buildDevAiModeStatus({ NODE_ENV: 'development' }).requestedMode, 'mock');
});

test('reports live availability only when the live guard and api key are present', () => {
  resetDevAiModeForTest();

  const blockedStatus = buildDevAiModeStatus({
    NODE_ENV: 'development',
    AI_DEV_MODE_SWITCH_ENABLED: 'true',
    AI_ENABLE_LIVE_CALLS: '',
    DEEPSEEK_API_KEY: 'sk-test',
  });
  assert.equal(blockedStatus.liveAllowedByEnv, false);
  assert.match(blockedStatus.message ?? '', /AI_ENABLE_LIVE_CALLS/);

  const missingKeyStatus = buildDevAiModeStatus({
    NODE_ENV: 'development',
    AI_DEV_MODE_SWITCH_ENABLED: 'true',
    AI_ENABLE_LIVE_CALLS: 'true',
    DEEPSEEK_API_KEY: '',
    OPENAI_API_KEY: '',
  });
  assert.equal(missingKeyStatus.liveAllowedByEnv, false);
  assert.match(missingKeyStatus.message ?? '', /API Key|OPENAI_API_KEY|DEEPSEEK_API_KEY/);

  const readyStatus = buildDevAiModeStatus({
    NODE_ENV: 'development',
    AI_DEV_MODE_SWITCH_ENABLED: 'true',
    AI_ENABLE_LIVE_CALLS: 'true',
    DEEPSEEK_API_KEY: 'sk-test',
  });
  assert.equal(readyStatus.liveAllowedByEnv, true);
  assert.equal(readyStatus.message, null);
});
