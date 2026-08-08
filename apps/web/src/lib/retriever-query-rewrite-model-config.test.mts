import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import test from 'node:test';

register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, nextResolve) {
      if (specifier === 'server-only') {
        return { url: 'data:text/javascript,export default undefined', shortCircuit: true };
      }
      return nextResolve(specifier, context);
    }
  `)}`,
  import.meta.url,
);

const {
  RETRIEVER_QUERY_REWRITE_MODEL_PRICE_CNY,
  estimateRetrieverQueryRewriteRequestCostCny,
  resolveRetrieverQueryRewriteLiveExecutorConfig,
  resolveRetrieverQueryRewriteModelConfig,
} = await import('./retriever-query-rewrite-model-config.ts');
const { createRetrieverQueryRewriteModelRuntimeBundle } =
  await import('./retriever-query-rewrite-model-runtime.ts');
const { createModelAgentRuntime } = await import('@repo/ai');

const LIVE_ENV = {
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  RETRIEVER_QUERY_REWRITE_MODEL_ENABLED: 'true',
  RETRIEVER_QUERY_REWRITE_MODEL_TIMEOUT_MS: '4000',
  RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY: 'rewrite_component_key_canary',
};

test('freezes a server-only default-off exact DeepSeek V4 Pro config without eagerly reading credential', async () => {
  const source = await readFile(
    new URL('./retriever-query-rewrite-model-config.ts', import.meta.url),
    'utf8',
  );
  assert.equal(source.split(/\r?\n/u)[0], "import 'server-only';");
  assert.deepEqual(RETRIEVER_QUERY_REWRITE_MODEL_PRICE_CNY, {
    model: 'deepseek-v4-pro',
    inputPerMillion: 3,
    outputPerMillion: 6,
    requestCap: 0.005,
  });

  let reads = 0;
  const env = Object.defineProperty(
    { ...LIVE_ENV, RETRIEVER_QUERY_REWRITE_MODEL_ENABLED: 'false' },
    'RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY',
    {
      enumerable: true,
      get() {
        reads += 1;
        return 'must_not_be_read';
      },
    },
  );
  assert.deepEqual(resolveRetrieverQueryRewriteModelConfig(env), {
    schemaVersion: 'retriever-query-rewrite-candidate-config-v1',
    enabled: false,
    runtimeAuthority: 'disabled',
    mode: 'mock',
    provider: 'mock',
    model: 'deepseek-v4-pro',
    baseURL: 'https://api.deepseek.com/v1',
    timeoutMs: 4000,
    globalLiveCallsEnabled: false,
    configured: true,
    disabledReason: 'gate_disabled',
  });
  assert.equal(reads, 0);
});

test('resolves only the exact non-secret Live conjunction and defers the component credential', () => {
  let reads = 0;
  const env = new Proxy(
    { ...LIVE_ENV },
    {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY') reads += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    },
  );
  assert.deepEqual(resolveRetrieverQueryRewriteModelConfig(env), {
    schemaVersion: 'retriever-query-rewrite-candidate-config-v1',
    enabled: true,
    runtimeAuthority: 'production_live',
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    baseURL: 'https://api.deepseek.com/v1',
    timeoutMs: 4000,
    globalLiveCallsEnabled: true,
    configured: true,
  });
  assert.equal(reads, 0);

  const executorConfig = resolveRetrieverQueryRewriteLiveExecutorConfig(env);
  assert.equal(reads, 1);
  assert.deepEqual(
    { ...executorConfig, apiKey: '[redacted]' },
    {
      provider: 'deepseek',
      apiKey: '[redacted]',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    },
  );
});

test('fails invalid config and borrowed generic or sibling credentials closed', () => {
  const cases = [
    { ...LIVE_ENV, AI_PROVIDER_MODE: 'mock' },
    { ...LIVE_ENV, AI_ENABLE_LIVE_CALLS: 'false' },
    { ...LIVE_ENV, AI_BASE_URL: 'https://api.deepseek.com' },
    { ...LIVE_ENV, RETRIEVER_QUERY_REWRITE_MODEL_TIMEOUT_MS: '3999' },
    {
      ...LIVE_ENV,
      RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY: '',
      DEEPSEEK_API_KEY: 'generic_key_must_not_be_borrowed',
      TUTOR_AGENT_DEEPSEEK_API_KEY: 'sibling_key_must_not_be_borrowed',
    },
  ];
  for (const env of cases) {
    const config = resolveRetrieverQueryRewriteModelConfig(env);
    if (env.RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY === '') {
      assert.equal(config.enabled, true);
      assert.equal(resolveRetrieverQueryRewriteLiveExecutorConfig(env), null);
    } else {
      assert.equal(config.enabled, false);
      assert.equal(resolveRetrieverQueryRewriteLiveExecutorConfig(env), null);
    }
  }
});

test('constructs credential and executor lazily and exposes a single-consume runtime factory', () => {
  let credentialReads = 0;
  let executorCalls = 0;
  let runtimeCalls = 0;
  const env = new Proxy(
    { ...LIVE_ENV },
    {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY') credentialReads += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    },
  );
  const bundle = createRetrieverQueryRewriteModelRuntimeBundle({
    env,
    createExecutor(config) {
      executorCalls += 1;
      assert.equal(config.apiKey, 'rewrite_component_key_canary');
      return async () => ({ object: {}, usage: { inputTokens: 1, outputTokens: 1 } });
    },
    createRuntime(input) {
      runtimeCalls += 1;
      assert.equal(input.mode, 'live');
      assert.equal(input.provider, 'deepseek');
      assert.equal(input.model, 'deepseek-v4-pro');
      assert.equal(input.timeoutMs, 4000);
      return createModelAgentRuntime(input);
    },
  });

  assert.equal(credentialReads, 0);
  assert.equal(executorCalls, 0);
  assert.equal(runtimeCalls, 0);
  assert.equal(bundle.config.enabled, true);
  assert.equal(typeof bundle.createRuntime().invokeStructured, 'function');
  assert.equal(credentialReads, 1);
  assert.equal(executorCalls, 1);
  assert.equal(runtimeCalls, 1);
  assert.throws(() => bundle.createRuntime(), /ALREADY_CONSUMED/u);
});

test('keeps the maximum theoretical cost within the independent 0.005 CNY cap', () => {
  assert.deepEqual(estimateRetrieverQueryRewriteRequestCostCny(1200, 160), {
    estimatedCostCny: 0.00456,
    withinCap: true,
  });
  assert.equal(estimateRetrieverQueryRewriteRequestCostCny(1201, 160), null);
  assert.equal(estimateRetrieverQueryRewriteRequestCostCny(1200, 161), null);
});

test('Docker projects the three rewrite settings only into web and keeps default false', async () => {
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
    'RETRIEVER_QUERY_REWRITE_MODEL_ENABLED',
    'RETRIEVER_QUERY_REWRITE_MODEL_TIMEOUT_MS',
    'RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY',
  ]) {
    assert.equal(beforeWeb.includes(name), false, name);
    assert.equal(web.includes(name), true, name);
    assert.equal(admin.includes(name), false, name);
  }
  assert.match(
    web,
    /RETRIEVER_QUERY_REWRITE_MODEL_ENABLED:\s*\$\{RETRIEVER_QUERY_REWRITE_MODEL_ENABLED:-false\}/u,
  );
});
