import {
  createModelAgentRuntime,
  createOpenAICompatibleStructuredExecutor,
} from '@repo/ai';
import type {
  ModelAgentRuntime,
  OpenAICompatibleExecutorConfig,
  StructuredModelExecutor,
} from '@repo/ai';

import {
  resolveReviewPlannerLiveExecutorConfig,
  resolveReviewPlannerModelConfig,
  type ReviewPlannerModelConfig,
} from './review-planner-model-config';

export const REVIEW_PLANNER_MODEL_RUNTIMES = Symbol(
  'REVIEW_PLANNER_MODEL_RUNTIMES',
);

export type ReviewPlannerModelRuntimeBundle = Readonly<{
  config: ReviewPlannerModelConfig;
  reviewRuntime: ModelAgentRuntime;
  plannerRuntime: ModelAgentRuntime;
}>;

type RuntimeFactoryDependencies = {
  createExecutor(
    config: OpenAICompatibleExecutorConfig,
  ): StructuredModelExecutor;
};

const defaultDependencies: RuntimeFactoryDependencies = {
  createExecutor: createOpenAICompatibleStructuredExecutor,
};

export function createReviewPlannerModelRuntimes(
  env: Record<string, unknown>,
  dependencies: RuntimeFactoryDependencies = defaultDependencies,
): ReviewPlannerModelRuntimeBundle {
  const initialConfig = resolveReviewPlannerModelConfig(env);
  const executor =
    initialConfig.reviewEnabled || initialConfig.plannerEnabled
      ? createExecutorSafely(
          resolveReviewPlannerLiveExecutorConfig(env),
          dependencies,
        )
      : undefined;
  const config = executor ? initialConfig : disableConfig(initialConfig);

  return {
    config,
    reviewRuntime: createRuntime({
      enabled: config.reviewEnabled,
      provider: config.provider,
      model: config.model,
      timeoutMs: config.reviewTimeoutMs,
      executor,
      placeholderModel: 'disabled-review-model-candidate',
    }),
    plannerRuntime: createRuntime({
      enabled: config.plannerEnabled,
      provider: config.provider,
      model: config.model,
      timeoutMs: config.plannerTimeoutMs,
      executor,
      placeholderModel: 'disabled-planner-model-candidate',
    }),
  };
}

function createExecutorSafely(
  config: OpenAICompatibleExecutorConfig | null,
  dependencies: RuntimeFactoryDependencies,
): StructuredModelExecutor | undefined {
  if (!config) return undefined;
  try {
    return dependencies.createExecutor(config);
  } catch {
    return undefined;
  }
}

function disableConfig(
  config: ReviewPlannerModelConfig,
): ReviewPlannerModelConfig {
  if (!config.reviewEnabled && !config.plannerEnabled) return config;
  return {
    ...config,
    reviewEnabled: false,
    plannerEnabled: false,
    mode: 'mock',
    provider: 'mock',
    model: 'disabled-review-planner',
  };
}

function createRuntime(input: {
  enabled: boolean;
  provider: ReviewPlannerModelConfig['provider'];
  model: string;
  timeoutMs: number;
  executor: StructuredModelExecutor | undefined;
  placeholderModel: string;
}): ModelAgentRuntime {
  if (!input.enabled || input.provider === 'mock' || !input.executor) {
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
    provider: input.provider,
    model: input.model,
    liveCallsEnabled: true,
    timeoutMs: input.timeoutMs,
    executor: input.executor,
  });
}
