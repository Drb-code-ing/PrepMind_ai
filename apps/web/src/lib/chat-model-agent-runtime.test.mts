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

const { createChatModelAgentRuntimeBundle } = await import(
  './chat-model-agent-runtime.ts'
);

const LIVE_ENV = {
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  ROUTER_MODEL_ENABLED: 'true',
  KNOWLEDGE_VERIFIER_MODEL_ENABLED: 'true',
  DEEPSEEK_API_KEY: 'runtime_deepseek_canary',
  AI_BASE_URL: 'https://api.deepseek.com',
  AI_MODEL: 'deepseek-v4-flash',
};

test('runtime composition is explicitly server-only and avoids strict-tool transport', async () => {
  const source = await readFile(
    new URL('./chat-model-agent-runtime.ts', import.meta.url),
    'utf8',
  );
  assert.equal(source.split(/\r?\n/u)[0], "import 'server-only';");
  assert.doesNotMatch(source, /deepseek_strict_tool|schemaProfiles/u);
});

test('creates two live runtimes with independent timeouts and one JSON-object executor', () => {
  const executorInputs: unknown[] = [];
  const runtimeInputs: unknown[] = [];
  const executor = async () => ({ object: {}, usage: {} });
  const bundle = createChatModelAgentRuntimeBundle({
    env: LIVE_ENV,
    createExecutor(input) {
      executorInputs.push(input);
      return executor;
    },
    createRuntime(input) {
      runtimeInputs.push(input);
      return { invokeStructured: async () => ({ ok: false }) } as never;
    },
  });

  assert.equal(bundle.routerEnabled, true);
  assert.equal(bundle.verifierEnabled, true);
  assert.equal(executorInputs.length, 1);
  assert.deepEqual(
    {
      ...executorInputs[0] as object,
      apiKey: '[redacted]',
      baseURL: '[redacted]',
    },
    {
      provider: 'deepseek',
      apiKey: '[redacted]',
      baseURL: '[redacted]',
      model: 'deepseek-v4-flash',
      structuredOutputMode: 'json_object',
    },
  );
  assert.equal(runtimeInputs.length, 2);
  const [router, verifier] = runtimeInputs as Array<Record<string, unknown>>;
  assert.deepEqual(
    {
      mode: router.mode,
      provider: router.provider,
      model: router.model,
      liveCallsEnabled: router.liveCallsEnabled,
      timeoutMs: router.timeoutMs,
    },
    {
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      liveCallsEnabled: true,
      timeoutMs: 5000,
    },
  );
  assert.equal(verifier.timeoutMs, 4000);
  assert.equal(verifier.liveCallsEnabled, true);
  assert.equal(router.executor, executor);
  assert.equal(verifier.executor, executor);
  assert.equal(JSON.stringify(bundle).includes('runtime_deepseek_canary'), false);
  assert.equal('apiKey' in bundle.config, false);
  assert.equal('baseURL' in bundle.config, false);
});

test('creates a fresh valid request budget every time', () => {
  const bundle = createChatModelAgentRuntimeBundle({ env: {} });
  const first = bundle.createBudget();
  const second = bundle.createBudget();

  assert.deepEqual(first, {
    maxCalls: 2,
    maxInputTokens: 2400,
    maxOutputTokens: 800,
    usedCalls: 0,
    usedInputTokens: 0,
    usedOutputTokens: 0,
  });
  assert.deepEqual(second, first);
  assert.notEqual(first, second);
  first.usedCalls = 1;
  assert.equal(second.usedCalls, 0);
});

test('mock responders return fixed task-shaped data without reading request text', () => {
  const runtimeInputs: Array<Record<string, unknown>> = [];
  createChatModelAgentRuntimeBundle({
    env: {},
    createRuntime(input) {
      runtimeInputs.push(input as unknown as Record<string, unknown>);
      return { invokeStructured: async () => ({ ok: false }) } as never;
    },
  });

  const routerResponder = runtimeInputs[0]?.mockResponder as (input: unknown) => unknown;
  const verifierResponder = runtimeInputs[1]?.mockResponder as (input: unknown) => unknown;
  assert.deepEqual(
    routerResponder({ task: 'router_fallback', userPrompt: 'private_router_canary' }),
    { route: 'chat', confidence: 1, reasonCode: 'insufficient_context' },
  );
  assert.deepEqual(
    verifierResponder({
      task: 'knowledge_verification',
      userPrompt: 'private_verifier_canary',
    }),
    { status: 'insufficient', evidenceCodes: ['off_topic_or_weak'] },
  );
});

test('disabled gates do not construct a live executor', () => {
  let executorCalls = 0;
  const runtimeInputs: Array<Record<string, unknown>> = [];
  const bundle = createChatModelAgentRuntimeBundle({
    env: {
      ...LIVE_ENV,
      ROUTER_MODEL_ENABLED: 'false',
      KNOWLEDGE_VERIFIER_MODEL_ENABLED: 'false',
    },
    createExecutor() {
      executorCalls += 1;
      throw new Error('must not construct');
    },
    createRuntime(input) {
      runtimeInputs.push(input as unknown as Record<string, unknown>);
      return { invokeStructured: async () => ({ ok: false }) } as never;
    },
  });

  assert.equal(executorCalls, 0);
  assert.equal(bundle.routerEnabled, false);
  assert.equal(bundle.verifierEnabled, false);
  assert.equal(runtimeInputs.every((input) => input.liveCallsEnabled === false), true);
  assert.equal(runtimeInputs.every((input) => input.executor === undefined), true);
});

test('an individually disabled runtime cannot use the shared live executor', () => {
  const runtimeInputs: Array<Record<string, unknown>> = [];
  const executor = async () => ({ object: {}, usage: {} });
  const bundle = createChatModelAgentRuntimeBundle({
    env: { ...LIVE_ENV, KNOWLEDGE_VERIFIER_MODEL_ENABLED: 'false' },
    createExecutor: () => executor,
    createRuntime(input) {
      runtimeInputs.push(input as unknown as Record<string, unknown>);
      return { invokeStructured: async () => ({ ok: false }) } as never;
    },
  });

  assert.equal(bundle.routerEnabled, true);
  assert.equal(bundle.verifierEnabled, false);
  assert.equal(runtimeInputs[0]?.liveCallsEnabled, true);
  assert.equal(runtimeInputs[1]?.liveCallsEnabled, false);
  assert.equal(runtimeInputs[0]?.executor, executor);
  assert.equal(runtimeInputs[1]?.executor, executor);
});

test('hostile dependencies and environment fail closed without leaking canaries', () => {
  const dependencyCanary = 'hostile_dependency_canary';
  const hostileDependencies = new Proxy(
    { env: LIVE_ENV },
    {
      get() {
        throw new Error(dependencyCanary);
      },
    },
  );
  const hostileBundle = createChatModelAgentRuntimeBundle(hostileDependencies as never);
  assert.equal(hostileBundle.routerEnabled, false);
  assert.equal(hostileBundle.verifierEnabled, false);
  assert.equal(hostileBundle.config.configured, false);
  assert.equal(JSON.stringify(hostileBundle).includes(dependencyCanary), false);

  const envCanary = 'hostile_runtime_env_canary';
  const env = new Proxy(
    {},
    {
      get() {
        throw new Error(envCanary);
      },
    },
  );
  const envBundle = createChatModelAgentRuntimeBundle({ env });
  assert.equal(envBundle.config.configured, false);
  assert.equal(envBundle.routerEnabled, false);
  assert.equal(envBundle.verifierEnabled, false);
  assert.equal(JSON.stringify(envBundle).includes(envCanary), false);
});

test('executor construction failures return a fixed disabled bundle', () => {
  const canary = 'provider_initialization_canary';
  const bundle = createChatModelAgentRuntimeBundle({
    env: LIVE_ENV,
    createExecutor() {
      throw new Error(canary);
    },
  });

  assert.equal(bundle.routerEnabled, false);
  assert.equal(bundle.verifierEnabled, false);
  assert.equal(bundle.config.configured, false);
  assert.equal(bundle.config.disabledReason, 'invalid_provider_config');
  assert.equal(JSON.stringify(bundle).includes(canary), false);
});
