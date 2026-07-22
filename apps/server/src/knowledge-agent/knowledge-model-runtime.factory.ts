import {
  createModelAgentRuntime,
  createOpenAICompatibleStructuredExecutor,
  type ModelAgentRuntime,
  type OpenAICompatibleExecutorConfig,
  type StructuredModelExecutor,
} from '@repo/ai';

import {
  KNOWLEDGE_MODEL_PRICE_CNY,
  resolveKnowledgeLiveExecutorConfig,
  resolveKnowledgeModelConfig,
  type KnowledgeModelConfig,
} from './knowledge-model-config';

export const KNOWLEDGE_MODEL_RUNTIMES = Symbol('KNOWLEDGE_MODEL_RUNTIMES');

export type KnowledgeModelRuntimeBundle = Readonly<{
  config: KnowledgeModelConfig;
  dedupRuntime: ModelAgentRuntime;
  organizerRuntime: ModelAgentRuntime;
}>;

export type KnowledgeRuntimeFactoryDependencies = Readonly<{
  createExecutor(
    config: OpenAICompatibleExecutorConfig,
  ): StructuredModelExecutor;
  pricingProfile?: unknown;
}>;

const defaultDependencies: KnowledgeRuntimeFactoryDependencies = {
  createExecutor: createOpenAICompatibleStructuredExecutor,
  pricingProfile: KNOWLEDGE_MODEL_PRICE_CNY,
};

export function createKnowledgeModelRuntimes(
  env: Record<string, unknown>,
  dependencies: KnowledgeRuntimeFactoryDependencies = defaultDependencies,
): KnowledgeModelRuntimeBundle {
  const pricingProfile = readPricingProfile(dependencies);
  const initialConfig = resolveKnowledgeModelConfig(env, pricingProfile);
  const executor =
    initialConfig.dedupEnabled || initialConfig.organizerEnabled
      ? createExecutorSafely(
          resolveKnowledgeLiveExecutorConfig(env, pricingProfile),
          dependencies,
        )
      : undefined;
  const config = executor ? initialConfig : disableConfig(initialConfig);

  return Object.freeze({
    config,
    dedupRuntime: createRuntime({
      enabled: config.dedupEnabled,
      timeoutMs: config.dedupTimeoutMs,
      executor,
      placeholderModel: 'disabled-knowledge-dedup-candidate',
    }),
    organizerRuntime: createRuntime({
      enabled: config.organizerEnabled,
      timeoutMs: config.organizerTimeoutMs,
      executor,
      placeholderModel: 'disabled-knowledge-organizer-candidate',
    }),
  });
}

function readPricingProfile(
  dependencies: KnowledgeRuntimeFactoryDependencies,
): unknown {
  try {
    return Object.hasOwn(dependencies, 'pricingProfile')
      ? dependencies.pricingProfile
      : KNOWLEDGE_MODEL_PRICE_CNY;
  } catch {
    return null;
  }
}

function createExecutorSafely(
  config: OpenAICompatibleExecutorConfig | null,
  dependencies: KnowledgeRuntimeFactoryDependencies,
): StructuredModelExecutor | undefined {
  if (config === null) return undefined;
  try {
    return dependencies.createExecutor(config);
  } catch {
    return undefined;
  }
}

function disableConfig(config: KnowledgeModelConfig): KnowledgeModelConfig {
  if (!config.dedupEnabled && !config.organizerEnabled) return config;
  return Object.freeze({
    ...config,
    dedupEnabled: false,
    organizerEnabled: false,
    mode: 'mock',
    provider: 'mock',
  });
}

function createRuntime(input: {
  enabled: boolean;
  timeoutMs: number;
  executor: StructuredModelExecutor | undefined;
  placeholderModel: string;
}): ModelAgentRuntime {
  if (!input.enabled || input.executor === undefined) {
    return createModelAgentRuntime({
      mode: 'mock',
      provider: 'mock',
      model: input.placeholderModel,
      liveCallsEnabled: false,
      timeoutMs: input.timeoutMs,
    });
  }
  return createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    liveCallsEnabled: true,
    timeoutMs: input.timeoutMs,
    executor: input.executor,
  });
}
