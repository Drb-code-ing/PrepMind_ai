import 'server-only';

import {
  createModelAgentRuntime,
  createOpenAICompatibleStructuredExecutor,
  type CreateModelAgentRuntimeInput,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
  type OpenAICompatibleExecutorConfig,
  type StructuredModelExecutor,
} from '@repo/ai';

import {
  TUTOR_MODEL,
  TUTOR_MODEL_PROMPT_VERSION,
  TUTOR_MODEL_PRICE_CNY,
  TUTOR_MODEL_TIMEOUT_MS,
  createTutorModelBudget,
  resolveTutorLiveExecutorConfig,
  resolveTutorModelConfig,
  type TutorModelConfig,
} from './tutor-model-config.ts';

type Environment = Record<string, unknown>;

type TutorModelRuntimeDependencies = {
  env?: Environment;
  pricingProfile?: unknown;
  createExecutor?: (
    config: OpenAICompatibleExecutorConfig,
  ) => StructuredModelExecutor;
  createRuntime?: (input: CreateModelAgentRuntimeInput) => ModelAgentRuntime;
};

export type TutorModelRuntimeBundle = Readonly<{
  enabled: boolean;
  runtime: ModelAgentRuntime;
  config: TutorModelConfig;
  createBudget: () => ModelAgentRunBudget;
}>;

export function createTutorModelRuntimeBundle(
  dependencies: TutorModelRuntimeDependencies = {},
): TutorModelRuntimeBundle {
  try {
    const env = readDependency(dependencies, 'env') ?? process.env;
    const pricingProfile = Object.hasOwn(dependencies, 'pricingProfile')
      ? readDependency(dependencies, 'pricingProfile')
      : TUTOR_MODEL_PRICE_CNY;
    const createExecutor =
      readDependency(dependencies, 'createExecutor') ??
      createOpenAICompatibleStructuredExecutor;
    const createRuntime =
      readDependency(dependencies, 'createRuntime') ?? createModelAgentRuntime;
    const initialConfig = resolveTutorModelConfig(env, pricingProfile);

    if (!initialConfig.enabled) {
      return createDisabledBundle(initialConfig, createRuntime);
    }
    const runtime = createDeferredTutorRuntime({
      env,
      pricingProfile,
      config: initialConfig,
      createExecutor,
      createRuntime,
    });
    return Object.freeze({
      enabled: true,
      runtime,
      config: initialConfig,
      createBudget: createTutorModelBudget,
    });
  } catch {
    return createDisabledBundle(disabledFallbackConfig());
  }
}

function createDeferredTutorRuntime(input: {
  env: Environment;
  pricingProfile: unknown;
  config: TutorModelConfig;
  createExecutor: (config: OpenAICompatibleExecutorConfig) => StructuredModelExecutor;
  createRuntime: (input: CreateModelAgentRuntimeInput) => ModelAgentRuntime;
}): ModelAgentRuntime {
  let resolvedRuntime: Promise<ModelAgentRuntime> | undefined;
  return Object.freeze({
    async invokeStructured(request) {
      resolvedRuntime ??= Promise.resolve().then(() => resolveTutorLiveRuntime(input));
      const runtime = await resolvedRuntime;
      return runtime.invokeStructured(request);
    },
  });
}

function resolveTutorLiveRuntime(input: {
  env: Environment;
  pricingProfile: unknown;
  config: TutorModelConfig;
  createExecutor: (config: OpenAICompatibleExecutorConfig) => StructuredModelExecutor;
  createRuntime: (input: CreateModelAgentRuntimeInput) => ModelAgentRuntime;
}): ModelAgentRuntime {
  try {
    const executorConfig = resolveTutorLiveExecutorConfig(input.env, input.pricingProfile);
    if (executorConfig === null) {
      return createDisabledBundle(disableConfig(input.config), input.createRuntime).runtime;
    }
    const executor = input.createExecutor(executorConfig);
    return input.createRuntime({
      mode: 'live',
      provider: 'deepseek',
      model: TUTOR_MODEL,
      liveCallsEnabled: true,
      timeoutMs: input.config.timeoutMs,
      executor,
    });
  } catch {
    return createDisabledBundle(disableConfig(input.config), input.createRuntime).runtime;
  }
}

function createDisabledBundle(
  config: TutorModelConfig,
  createRuntime: (input: CreateModelAgentRuntimeInput) => ModelAgentRuntime =
    createModelAgentRuntime,
): TutorModelRuntimeBundle {
  let runtime: ModelAgentRuntime;
  try {
    runtime = createRuntime({
      mode: 'mock',
      provider: 'mock',
      model: 'disabled-tutor-model-candidate',
      liveCallsEnabled: false,
      timeoutMs: config.timeoutMs,
    });
  } catch {
    runtime = createModelAgentRuntime({
      mode: 'mock',
      provider: 'mock',
      model: 'disabled-tutor-model-candidate',
      liveCallsEnabled: false,
      timeoutMs: 3_000,
    });
  }
  return Object.freeze({
    enabled: false,
    runtime,
    config,
    createBudget: createTutorModelBudget,
  });
}

function disableConfig(config: TutorModelConfig): TutorModelConfig {
  return Object.freeze({
    ...config,
    enabled: false,
    mode: 'mock',
    provider: 'mock',
    configured: false,
    disabledReason: 'invalid_component_config',
  });
}

function disabledFallbackConfig(): TutorModelConfig {
  return Object.freeze({
    enabled: false,
    mode: 'mock',
    provider: 'mock',
    model: TUTOR_MODEL,
    promptVersion: TUTOR_MODEL_PROMPT_VERSION,
    timeoutMs: TUTOR_MODEL_TIMEOUT_MS,
    pricingKnown: false,
    configured: false,
    disabledReason: 'invalid_component_config',
  });
}

function readDependency<
  Key extends keyof TutorModelRuntimeDependencies,
>(
  dependencies: TutorModelRuntimeDependencies,
  key: Key,
): TutorModelRuntimeDependencies[Key] {
  const descriptor = Object.getOwnPropertyDescriptor(dependencies, key);
  if (descriptor === undefined) return undefined;
  if (!('value' in descriptor)) throw new Error('INVALID_TUTOR_MODEL_DEPENDENCY');
  return descriptor.value;
}
