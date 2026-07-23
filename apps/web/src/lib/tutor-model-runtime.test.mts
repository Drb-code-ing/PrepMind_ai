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

const { createTutorModelRuntimeBundle } = await import('./tutor-model-runtime.ts');

const LIVE_ENV = {
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  TUTOR_AGENT_MODEL_ENABLED: 'true',
  TUTOR_AGENT_MODEL_TIMEOUT_MS: '3000',
  TUTOR_AGENT_DEEPSEEK_API_KEY: 'runtime_tutor_key_canary',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
};

test('Tutor runtime composition is explicitly server-only', async () => {
  const source = await readFile(new URL('./tutor-model-runtime.ts', import.meta.url), 'utf8');
  assert.equal(source.split(/\r?\n/u)[0], "import 'server-only';");
});

test('creates one fixed non-thinking Live runtime lazily without exposing its credential', async () => {
  const executorInputs: Array<Record<string, unknown>> = [];
  const runtimeInputs: Array<Record<string, unknown>> = [];
  const executor = async () => ({ object: {}, usage: { inputTokens: 1, outputTokens: 1 } });
  const bundle = createTutorModelRuntimeBundle({
    env: LIVE_ENV,
    createExecutor(input) {
      executorInputs.push(input as unknown as Record<string, unknown>);
      return executor;
    },
    createRuntime(input) {
      runtimeInputs.push(input as unknown as Record<string, unknown>);
      return { invokeStructured: async () => ({ ok: false }) } as never;
    },
  });

  assert.equal(bundle.enabled, true);
  assert.equal(executorInputs.length, 0);
  assert.equal(runtimeInputs.length, 0);

  await Promise.all([
    bundle.runtime.invokeStructured({} as never),
    bundle.runtime.invokeStructured({} as never),
  ]);

  assert.equal(executorInputs.length, 1);
  assert.deepEqual(
    { ...executorInputs[0], apiKey: '[redacted]' },
    {
      provider: 'deepseek',
      apiKey: '[redacted]',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    },
  );
  assert.equal(runtimeInputs.length, 1);
  assert.deepEqual(
    {
      mode: runtimeInputs[0]?.mode,
      provider: runtimeInputs[0]?.provider,
      model: runtimeInputs[0]?.model,
      liveCallsEnabled: runtimeInputs[0]?.liveCallsEnabled,
      timeoutMs: runtimeInputs[0]?.timeoutMs,
      executor: runtimeInputs[0]?.executor,
    },
    {
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      liveCallsEnabled: true,
      timeoutMs: 3000,
      executor,
    },
  );
  assert.equal(JSON.stringify(bundle).includes('runtime_tutor_key_canary'), false);
  assert.equal('apiKey' in bundle.config, false);
  assert.deepEqual(bundle.createBudget(), {
    maxCalls: 1,
    usedCalls: 0,
    maxInputTokens: 1200,
    usedInputTokens: 0,
    maxOutputTokens: 300,
    usedOutputTokens: 0,
  });
});

test('invalid or disabled configuration never constructs an executor', () => {
  const cases = [
    {},
    { ...LIVE_ENV, TUTOR_AGENT_MODEL_ENABLED: 'false' },
    { ...LIVE_ENV, TUTOR_AGENT_DEEPSEEK_API_KEY: '', DEEPSEEK_API_KEY: 'generic_only' },
    { ...LIVE_ENV, AI_BASE_URL: 'https://api.deepseek.com' },
    { ...LIVE_ENV, TUTOR_AGENT_MODEL_TIMEOUT_MS: '5000' },
  ];

  for (const env of cases) {
    let executorCalls = 0;
    const bundle = createTutorModelRuntimeBundle({
      env,
      createExecutor() {
        executorCalls += 1;
        throw new Error('must_not_construct');
      },
    });
    assert.equal(executorCalls, 0);
    assert.equal(bundle.enabled, false);
  }
});

test('executor construction failure is deferred to invocation and fails closed safely', async () => {
  let executorCalls = 0;
  const bundle = createTutorModelRuntimeBundle({
    env: LIVE_ENV,
    createExecutor() {
      executorCalls += 1;
      throw new Error('executor_failure_canary');
    },
  });

  assert.equal(bundle.enabled, true);
  assert.equal(executorCalls, 0);
  const result = await bundle.runtime.invokeStructured({} as never);
  assert.equal(executorCalls, 1);
  assert.equal(result.ok, false);
  assert.equal(bundle.config.configured, true);
  assert.equal(JSON.stringify(bundle).includes('executor_failure_canary'), false);
});

test('Docker injects Tutor capability only into the web service', async () => {
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
    'TUTOR_AGENT_MODEL_ENABLED',
    'TUTOR_AGENT_MODEL_TIMEOUT_MS',
    'TUTOR_AGENT_DEEPSEEK_API_KEY',
  ]) {
    assert.equal(beforeWeb.includes(name), false, name);
    assert.equal(web.includes(name), true, name);
    assert.equal(admin.includes(name), false, name);
  }
});
