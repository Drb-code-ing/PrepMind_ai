import {
  createModelAgentRuntime,
  createOpenAICompatibleStructuredExecutor,
  type ModelAgentRuntime,
  type OpenAICompatibleExecutorConfig,
  type StructuredModelExecutor,
} from '@repo/ai';
import { createPhase697Sr6ProductReplayRuntime } from '@repo/agent/model-candidates';

import {
  WRONG_QUESTION_ORGANIZER_MODEL,
  WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY,
  resolveWrongQuestionOrganizerLiveExecutorConfig,
  resolveWrongQuestionOrganizerModelConfig,
  type WrongQuestionOrganizerModelConfig,
} from './wrong-question-organizer-model-config';

export const WRONG_QUESTION_ORGANIZER_MODEL_RUNTIME = Symbol(
  'WRONG_QUESTION_ORGANIZER_MODEL_RUNTIME',
);

export type WrongQuestionOrganizerModelRuntimeBundle = Readonly<{
  config: WrongQuestionOrganizerModelConfig;
  runtime: ModelAgentRuntime;
}>;

export type WrongQuestionOrganizerRuntimeFactoryDependencies = Readonly<{
  createExecutor(
    config: OpenAICompatibleExecutorConfig,
  ): StructuredModelExecutor;
  pricingProfile?: unknown;
}>;

const defaultDependencies: WrongQuestionOrganizerRuntimeFactoryDependencies = {
  createExecutor: createOpenAICompatibleStructuredExecutor,
  pricingProfile: WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY,
};

export function createWrongQuestionOrganizerModelRuntime(
  env: Record<string, unknown>,
  dependencies: WrongQuestionOrganizerRuntimeFactoryDependencies = defaultDependencies,
): WrongQuestionOrganizerModelRuntimeBundle {
  const pricingProfile = readPricingProfile(dependencies);
  const initialConfig = resolveWrongQuestionOrganizerModelConfig(
    env,
    pricingProfile,
  );
  if (
    initialConfig.runtimeAuthority === 'sr5_sealed_replay' &&
    initialConfig.replay?.enabled
  ) {
    return Object.freeze({
      config: initialConfig,
      runtime: createPhase697Sr6ProductReplayRuntime({
        component: 'organizer',
        behavior: initialConfig.replay.behavior,
        maxRequests: initialConfig.replay.maxRequests,
      }),
    });
  }
  const executor = initialConfig.enabled
    ? createExecutorSafely(
        resolveWrongQuestionOrganizerLiveExecutorConfig(env, pricingProfile),
        dependencies,
      )
    : undefined;
  const config = executor ? initialConfig : disableConfig(initialConfig);
  const runtime =
    config.enabled && executor
      ? createModelAgentRuntime({
          mode: 'live',
          provider: 'deepseek',
          model: WRONG_QUESTION_ORGANIZER_MODEL,
          liveCallsEnabled: true,
          timeoutMs: config.timeoutMs,
          executor,
        })
      : createModelAgentRuntime({
          mode: 'mock',
          provider: 'mock',
          model: 'disabled-wrong-question-organizer-candidate',
          liveCallsEnabled: false,
          timeoutMs: config.timeoutMs,
        });

  return Object.freeze({ config, runtime });
}

function readPricingProfile(
  dependencies: WrongQuestionOrganizerRuntimeFactoryDependencies,
): unknown {
  try {
    return Object.hasOwn(dependencies, 'pricingProfile')
      ? dependencies.pricingProfile
      : WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY;
  } catch {
    return null;
  }
}

function createExecutorSafely(
  config: OpenAICompatibleExecutorConfig | null,
  dependencies: WrongQuestionOrganizerRuntimeFactoryDependencies,
): StructuredModelExecutor | undefined {
  if (config === null) return undefined;
  try {
    return dependencies.createExecutor(config);
  } catch {
    return undefined;
  }
}

function disableConfig(
  config: WrongQuestionOrganizerModelConfig,
): WrongQuestionOrganizerModelConfig {
  if (!config.enabled) return config;
  return Object.freeze({
    ...config,
    enabled: false,
    mode: 'mock',
    provider: 'mock',
    runtimeAuthority: 'disabled',
  });
}
