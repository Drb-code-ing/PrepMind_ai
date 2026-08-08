import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import test from 'node:test';

import type { FinalResponseStreamExecutor } from '@repo/ai';

register(
  'data:text/javascript,' +
    encodeURIComponent(
      [
        'export async function resolve(specifier, context, nextResolve) {',
        "  if (specifier === 'server-only') return { url: 'data:text/javascript,export default undefined', shortCircuit: true };",
        '  try { return await nextResolve(specifier, context); } catch (error) {',
        "    if (/^\\.\\.?\\//u.test(specifier) && !/\\.[cm]?[jt]sx?$/u.test(specifier)) return nextResolve(specifier + '.ts', context);",
        '    throw error;',
        '  }',
        '}',
      ].join('\n'),
    ),
  import.meta.url,
);

const {
  FINAL_RESPONSE_MODEL_PRICE_CNY,
  estimateFinalResponseRequestCostCny,
  resolveFinalResponseLiveExecutorConfig,
  resolveFinalResponseModelConfig,
} = await import('./final-response-model-config.ts');
const { createFinalResponseModelRuntimeBundle } = await import('./final-response-model-runtime.ts');

const LIVE_ENV = {
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  FINAL_RESPONSE_AGENT_MODEL_ENABLED: 'true',
  FINAL_RESPONSE_AGENT_MODEL_TIMEOUT_MS: '20000',
  FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY: 'final_response_component_key_canary',
};

const DISABLED_CONFIG = {
  schemaVersion: 'final-response-agent-config-v1',
  enabled: false,
  runtimeAuthority: 'disabled',
  mode: 'mock',
  provider: 'mock',
  modelRef: 'mock-local-v1',
  executorProvenance: 'none',
  timeoutMs: 20000,
  maxInputTokens: 2500,
  maxOutputTokens: 1200,
  priceProfile: 'deepseek-v4-pro-cny-2026-07-15',
  inputPerMillionCny: 3,
  outputPerMillionCny: 6,
  requestCapCny: 0.015,
};

test('freezes a server-only default-off FinalResponse config without eagerly reading credential', async () => {
  const source = await readFile(
    new URL('./final-response-model-config.ts', import.meta.url),
    'utf8',
  );
  assert.equal(source.split(/\r?\n/u)[0], "import 'server-only';");
  assert.deepEqual(FINAL_RESPONSE_MODEL_PRICE_CNY, {
    profile: 'deepseek-v4-pro-cny-2026-07-15',
    model: 'deepseek-v4-pro',
    inputPerMillion: 3,
    outputPerMillion: 6,
    requestCap: 0.015,
  });

  let reads = 0;
  const env = Object.defineProperty(
    { ...LIVE_ENV, FINAL_RESPONSE_AGENT_MODEL_ENABLED: 'false' },
    'FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY',
    {
      enumerable: true,
      get() {
        reads += 1;
        return 'must_not_be_read';
      },
    },
  );
  assert.deepEqual(resolveFinalResponseModelConfig(env), DISABLED_CONFIG);
  assert.equal(resolveFinalResponseLiveExecutorConfig(env), null);
  assert.equal(reads, 0);
});

test('resolves only the exact Live conjunction and defers the dedicated component credential', () => {
  let reads = 0;
  const env = new Proxy(
    { ...LIVE_ENV },
    {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY') reads += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    },
  );
  assert.deepEqual(resolveFinalResponseModelConfig(env), {
    schemaVersion: 'final-response-agent-config-v1',
    enabled: true,
    runtimeAuthority: 'production_live',
    mode: 'live',
    provider: 'deepseek',
    modelRef: 'deepseek-v4-pro-nonthinking-v1',
    executorProvenance: 'deepseek_network',
    timeoutMs: 20000,
    maxInputTokens: 2500,
    maxOutputTokens: 1200,
    priceProfile: 'deepseek-v4-pro-cny-2026-07-15',
    inputPerMillionCny: 3,
    outputPerMillionCny: 6,
    requestCapCny: 0.015,
  });
  assert.equal(reads, 0);
  assert.deepEqual(
    { ...resolveFinalResponseLiveExecutorConfig(env), apiKey: '[redacted]' },
    {
      apiKey: '[redacted]',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
    },
  );
  assert.equal(reads, 1);
});

test('fails invalid config and borrowed generic or sibling credentials closed', () => {
  for (const env of [
    { ...LIVE_ENV, AI_PROVIDER_MODE: 'mock' },
    { ...LIVE_ENV, AI_ENABLE_LIVE_CALLS: 'false' },
    { ...LIVE_ENV, AI_BASE_URL: 'https://api.deepseek.com' },
    { ...LIVE_ENV, FINAL_RESPONSE_AGENT_MODEL_TIMEOUT_MS: '19999' },
  ]) {
    assert.deepEqual(resolveFinalResponseModelConfig(env), DISABLED_CONFIG);
    assert.equal(resolveFinalResponseLiveExecutorConfig(env), null);
  }

  const borrowedOnly = {
    ...LIVE_ENV,
    FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY: '',
    DEEPSEEK_API_KEY: 'generic_key_must_not_be_borrowed',
    TUTOR_AGENT_DEEPSEEK_API_KEY: 'sibling_key_must_not_be_borrowed',
    RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY: 'sibling_key_must_not_be_borrowed',
  };
  assert.equal(resolveFinalResponseModelConfig(borrowedOnly).enabled, true);
  assert.equal(resolveFinalResponseLiveExecutorConfig(borrowedOnly), null);
});

test('constructs the credential and executor lazily through a single-consume factory', () => {
  let credentialReads = 0;
  let executorCalls = 0;
  const env = new Proxy(
    { ...LIVE_ENV },
    {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY') credentialReads += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    },
  );
  const expectedExecutor: FinalResponseStreamExecutor = async function* () {
    yield { type: 'text_delta' as const, text: 'ok' };
  };
  const bundle = createFinalResponseModelRuntimeBundle({
    env,
    createExecutor(config) {
      executorCalls += 1;
      assert.equal(config.apiKey, 'final_response_component_key_canary');
      return expectedExecutor;
    },
  });

  assert.equal(bundle.config.enabled, true);
  assert.equal(credentialReads, 0);
  assert.equal(executorCalls, 0);
  assert.equal(bundle.createExecutor(), expectedExecutor);
  assert.equal(credentialReads, 1);
  assert.equal(executorCalls, 1);
  assert.throws(() => bundle.createExecutor(), /ALREADY_CONSUMED/u);
});

test('keeps the maximum theoretical cost within the independent 0.015 CNY cap', () => {
  assert.deepEqual(estimateFinalResponseRequestCostCny(2500, 1200), {
    estimatedCostCny: 0.0147,
    withinCap: true,
  });
  assert.equal(estimateFinalResponseRequestCostCny(2501, 1200), null);
  assert.equal(estimateFinalResponseRequestCostCny(2500, 1201), null);
});

test('Docker projects the three FinalResponse settings only into web and keeps default false', async () => {
  const compose = await readFile(
    new URL('../../../../docker/docker-compose.dev.yml', import.meta.url),
    'utf8',
  );
  const webStart = compose.indexOf('\n  web:');
  const adminStart = compose.indexOf('\n  admin:');
  assert.ok(webStart >= 0 && adminStart > webStart);
  const beforeWeb = compose.slice(0, webStart);
  const web = compose.slice(webStart, adminStart);
  const admin = compose.slice(adminStart);
  for (const name of [
    'FINAL_RESPONSE_AGENT_MODEL_ENABLED',
    'FINAL_RESPONSE_AGENT_MODEL_TIMEOUT_MS',
    'FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY',
  ]) {
    assert.equal(beforeWeb.includes(name), false, name);
    assert.equal(web.includes(name), true, name);
    assert.equal(admin.includes(name), false, name);
  }
  assert.match(
    web,
    /FINAL_RESPONSE_AGENT_MODEL_ENABLED:\s*\$\{FINAL_RESPONSE_AGENT_MODEL_ENABLED:-false\}/u,
  );
});
