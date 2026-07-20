jest.mock('@repo/ai', () => {
  const actual = jest.requireActual<typeof import('@repo/ai')>('@repo/ai');
  return {
    ...actual,
    createOpenAICompatibleStructuredExecutor: jest.fn(() => {
      throw new Error('worker role must not create a live executor');
    }),
  };
});

import { MODULE_METADATA } from '@nestjs/common/constants';
import type { ConfigService } from '@nestjs/config';
import { createOpenAICompatibleStructuredExecutor } from '@repo/ai';

import type { ServerEnv } from '../config/env';
import { ReviewAgentModule } from './review-agent.module';
import {
  REVIEW_PLANNER_MODEL_RUNTIMES,
  type ReviewPlannerModelRuntimeBundle,
} from './review-planner-model-runtime.factory';

describe('ReviewAgentModule model runtime composition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps both candidates disabled and does not create an executor in worker role', () => {
    const runtimes = createModuleRuntimes({
      SERVER_ROLE: 'worker',
      AI_PROVIDER_MODE: 'live',
      AI_ENABLE_LIVE_CALLS: true,
      REVIEW_AGENT_MODEL_ENABLED: true,
      PLANNER_AGENT_MODEL_ENABLED: true,
      AI_MODEL: 'deepseek-v4-flash',
      AI_BASE_URL: 'https://api.deepseek.com/v1',
      DEEPSEEK_API_KEY: 'private-worker-key',
    });

    expect(runtimes.config).toMatchObject({
      reviewEnabled: false,
      plannerEnabled: false,
      mode: 'mock',
      provider: 'mock',
    });
    expect(createOpenAICompatibleStructuredExecutor).not.toHaveBeenCalled();
  });
});

function createModuleRuntimes(
  values: Partial<ServerEnv>,
): ReviewPlannerModelRuntimeBundle {
  const providers = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    ReviewAgentModule,
  ) as unknown[];
  const provider = providers.find(
    (
      candidate,
    ): candidate is {
      provide: symbol;
      useFactory: (config: ConfigService<ServerEnv, true>) => unknown;
    } =>
      typeof candidate === 'object' &&
      candidate !== null &&
      'provide' in candidate &&
      candidate.provide === REVIEW_PLANNER_MODEL_RUNTIMES &&
      'useFactory' in candidate &&
      typeof candidate.useFactory === 'function',
  );
  if (!provider) throw new Error('review planner runtime provider not found');

  const config = {
    get: <Key extends keyof ServerEnv>(key: Key) => values[key],
  } as ConfigService<ServerEnv, true>;
  return provider.useFactory(config) as ReviewPlannerModelRuntimeBundle;
}
