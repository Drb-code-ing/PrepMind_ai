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
  TUTOR_MODEL,
  TUTOR_MODEL_BASE_URL,
  TUTOR_MODEL_PRICE_CNY,
  TUTOR_MODEL_PROMPT_VERSION,
  createTutorModelBudget,
  estimateTutorRequestCostCny,
  resolveTutorLiveExecutorConfig,
  resolveTutorModelConfig,
} = await import('./tutor-model-config.ts');

const LIVE_ENV = {
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  TUTOR_AGENT_MODEL_ENABLED: 'true',
  TUTOR_AGENT_MODEL_TIMEOUT_MS: '3000',
  TUTOR_AGENT_DEEPSEEK_API_KEY: 'tutor_component_key_canary',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
};

test('Tutor model config is server-only and freezes the approved profile', async () => {
  const source = await readFile(new URL('./tutor-model-config.ts', import.meta.url), 'utf8');
  assert.equal(source.split(/\r?\n/u)[0], "import 'server-only';");
  assert.equal(TUTOR_MODEL, 'deepseek-v4-pro');
  assert.equal(TUTOR_MODEL_BASE_URL, 'https://api.deepseek.com/v1');
  assert.equal(TUTOR_MODEL_PROMPT_VERSION, 'tutor-model-candidate-v1');
  assert.deepEqual(TUTOR_MODEL_PRICE_CNY, {
    model: 'deepseek-v4-pro',
    inputPerMillion: 3,
    outputPerMillion: 6,
    requestCap: 0.006,
  });
});
test('resolves only the complete component-specific Live conjunction', () => {
  const config = resolveTutorModelConfig(LIVE_ENV);
  assert.deepEqual(config, {
    enabled: true,
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    promptVersion: 'tutor-model-candidate-v1',
    timeoutMs: 3000,
    pricingKnown: true,
    configured: true,
  });

  const executorConfig = resolveTutorLiveExecutorConfig(LIVE_ENV);
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

test('gate, mode, global gate, exact URL, component key, timeout and pricing fail closed', () => {
  const cases: Array<{ name: string; env: Record<string, unknown>; price?: unknown }> = [
    { name: 'gate off', env: { ...LIVE_ENV, TUTOR_AGENT_MODEL_ENABLED: 'false' } },
    { name: 'mock mode', env: { ...LIVE_ENV, AI_PROVIDER_MODE: 'mock' } },
    { name: 'global off', env: { ...LIVE_ENV, AI_ENABLE_LIVE_CALLS: 'false' } },
    {
      name: 'generic key only',
      env: {
        ...LIVE_ENV,
        TUTOR_AGENT_DEEPSEEK_API_KEY: '',
        DEEPSEEK_API_KEY: 'must_not_be_borrowed',
      },
    },
    { name: 'wrong path', env: { ...LIVE_ENV, AI_BASE_URL: 'https://api.deepseek.com' } },
    { name: 'wrong host', env: { ...LIVE_ENV, AI_BASE_URL: 'https://deepseek.example/v1' } },
    { name: 'wrong timeout', env: { ...LIVE_ENV, TUTOR_AGENT_MODEL_TIMEOUT_MS: '3001' } },
    {
      name: 'tampered pricing',
      env: LIVE_ENV,
      price: { ...TUTOR_MODEL_PRICE_CNY, outputPerMillion: 0 },
    },
  ];

  for (const item of cases) {
    const config = resolveTutorModelConfig(item.env, item.price ?? TUTOR_MODEL_PRICE_CNY);
    assert.equal(config.enabled, false, item.name);
    assert.equal(resolveTutorLiveExecutorConfig(item.env, item.price ?? TUTOR_MODEL_PRICE_CNY), null, item.name);
  }
});

test('does not inspect or borrow the generic DeepSeek credential', () => {
  const env = Object.defineProperty({ ...LIVE_ENV }, 'DEEPSEEK_API_KEY', {
    enumerable: true,
    get() {
      throw new Error('generic_key_getter_canary');
    },
  });

  assert.equal(resolveTutorModelConfig(env).enabled, true);
  assert.equal(resolveTutorLiveExecutorConfig(env)?.apiKey, 'tutor_component_key_canary');
});

test('creates fresh 1/1200/300 budgets and validates positive CNY usage under the cap', () => {
  const first = createTutorModelBudget();
  const second = createTutorModelBudget();
  assert.deepEqual(first, {
    maxCalls: 1,
    usedCalls: 0,
    maxInputTokens: 1200,
    usedInputTokens: 0,
    maxOutputTokens: 300,
    usedOutputTokens: 0,
  });
  assert.deepEqual(second, first);
  assert.notEqual(first, second);

  assert.equal(estimateTutorRequestCostCny({ inputTokens: 1200, outputTokens: 300 }), 0.0054);
  assert.equal(estimateTutorRequestCostCny({ inputTokens: 100, outputTokens: 20 }), 0.00042);
  assert.equal(estimateTutorRequestCostCny({ inputTokens: 0, outputTokens: 20 }), null);
  assert.equal(estimateTutorRequestCostCny({ inputTokens: 1201, outputTokens: 20 }), null);
  assert.equal(
    estimateTutorRequestCostCny(
      { inputTokens: 100, outputTokens: 20 },
      { ...TUTOR_MODEL_PRICE_CNY, requestCap: 0 },
    ),
    null,
  );
});
