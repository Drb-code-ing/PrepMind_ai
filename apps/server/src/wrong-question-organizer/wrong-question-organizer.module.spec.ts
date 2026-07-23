jest.mock('@repo/ai', () => {
  const actual = jest.requireActual<typeof import('@repo/ai')>('@repo/ai');
  return {
    ...actual,
    createOpenAICompatibleStructuredExecutor: jest.fn(() =>
      jest.fn(() =>
        Promise.resolve({
          object: {},
          usage: { inputTokens: 1, outputTokens: 1 },
        }),
      ),
    ),
  };
});

import { MODULE_METADATA } from '@nestjs/common/constants';
import type { ConfigService } from '@nestjs/config';
import { createOpenAICompatibleStructuredExecutor } from '@repo/ai';

import type { ServerEnv } from '../config/env';
import {
  WRONG_QUESTION_ORGANIZER_MODEL_RUNTIME,
  type WrongQuestionOrganizerModelRuntimeBundle,
} from './wrong-question-organizer-model-runtime.factory';
import { WrongQuestionOrganizerModule } from './wrong-question-organizer.module';

describe('WrongQuestionOrganizerModule model runtime composition', () => {
  beforeEach(() => jest.clearAllMocks());

  it('forces the model gate off for the worker role', () => {
    const bundle = createModuleRuntime({
      ...liveValues(),
      SERVER_ROLE: 'worker',
    });

    expect(bundle.config).toMatchObject({ enabled: false, mode: 'mock' });
    expect(createOpenAICompatibleStructuredExecutor).not.toHaveBeenCalled();
  });

  it('does not borrow the generic credential', () => {
    const bundle = createModuleRuntime({
      ...liveValues(),
      WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: undefined,
      DEEPSEEK_API_KEY: 'generic-key-must-not-be-used',
    });

    expect(bundle.config).toMatchObject({ enabled: false, mode: 'mock' });
    expect(createOpenAICompatibleStructuredExecutor).not.toHaveBeenCalled();
  });

  it('creates the runtime only for api or both roles with the component credential', () => {
    for (const role of ['api', 'both'] as const) {
      jest.clearAllMocks();
      const bundle = createModuleRuntime({
        ...liveValues(),
        SERVER_ROLE: role,
      });

      expect(bundle.config).toMatchObject({
        enabled: true,
        mode: 'live',
        provider: 'deepseek',
      });
      expect(createOpenAICompatibleStructuredExecutor).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'synthetic-organizer-key' }),
      );
    }
  });
});

function liveValues(): Partial<ServerEnv> {
  return {
    SERVER_ROLE: 'api',
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: true,
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: true,
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: 5000,
    WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: 'synthetic-organizer-key',
  };
}

function createModuleRuntime(
  values: Partial<ServerEnv>,
): WrongQuestionOrganizerModelRuntimeBundle {
  const providers = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    WrongQuestionOrganizerModule,
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
      candidate.provide === WRONG_QUESTION_ORGANIZER_MODEL_RUNTIME &&
      'useFactory' in candidate &&
      typeof candidate.useFactory === 'function',
  );
  if (!provider) throw new Error('organizer runtime provider not found');
  const config = {
    get: <Key extends keyof ServerEnv>(key: Key) => values[key],
  } as ConfigService<ServerEnv, true>;
  return provider.useFactory(
    config,
  ) as WrongQuestionOrganizerModelRuntimeBundle;
}
