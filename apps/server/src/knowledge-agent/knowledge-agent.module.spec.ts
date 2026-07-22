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
import { KnowledgeAgentModule } from './knowledge-agent.module';
import {
  KNOWLEDGE_MODEL_RUNTIMES,
  type KnowledgeModelRuntimeBundle,
} from './knowledge-model-runtime.factory';

describe('KnowledgeAgentModule model runtime composition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps both candidates disabled and does not create an executor in worker role', () => {
    const runtimes = createModuleRuntimes({
      SERVER_ROLE: 'worker',
      AI_PROVIDER_MODE: 'live',
      AI_ENABLE_LIVE_CALLS: true,
      KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: true,
      KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: true,
      KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS: 4500,
      KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: 4500,
      AI_BASE_URL: 'https://api.deepseek.com/v1',
      DEEPSEEK_API_KEY: 'synthetic-worker-key',
      KNOWLEDGE_AGENT_DEEPSEEK_API_KEY: 'synthetic-knowledge-worker-key',
    });

    expect(runtimes.config).toMatchObject({
      dedupEnabled: false,
      organizerEnabled: false,
      mode: 'mock',
      provider: 'mock',
    });
    expect(createOpenAICompatibleStructuredExecutor).not.toHaveBeenCalled();
  });

  it('does not borrow the generic Review and Planner credential for Knowledge candidates', () => {
    const runtimes = createModuleRuntimes({
      SERVER_ROLE: 'api',
      AI_PROVIDER_MODE: 'live',
      AI_ENABLE_LIVE_CALLS: true,
      KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: true,
      KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: true,
      KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS: 4500,
      KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: 4500,
      AI_BASE_URL: 'https://api.deepseek.com/v1',
      DEEPSEEK_API_KEY: 'synthetic-review-planner-key',
    });

    expect(runtimes.config).toMatchObject({
      dedupEnabled: false,
      organizerEnabled: false,
      mode: 'mock',
      provider: 'mock',
    });
    expect(createOpenAICompatibleStructuredExecutor).not.toHaveBeenCalled();
  });

  it('creates the API-only Knowledge executor from its dedicated credential', () => {
    const runtimes = createModuleRuntimes({
      SERVER_ROLE: 'api',
      AI_PROVIDER_MODE: 'live',
      AI_ENABLE_LIVE_CALLS: true,
      KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: true,
      KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: true,
      KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS: 4500,
      KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: 4500,
      AI_BASE_URL: 'https://api.deepseek.com/v1',
      KNOWLEDGE_AGENT_DEEPSEEK_API_KEY: 'synthetic-knowledge-api-key',
    });

    expect(runtimes.config).toMatchObject({
      dedupEnabled: true,
      organizerEnabled: true,
      mode: 'live',
      provider: 'deepseek',
    });
    expect(createOpenAICompatibleStructuredExecutor).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'synthetic-knowledge-api-key' }),
    );
  });
});

function createModuleRuntimes(
  values: Partial<ServerEnv>,
): KnowledgeModelRuntimeBundle {
  const providers = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    KnowledgeAgentModule,
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
      candidate.provide === KNOWLEDGE_MODEL_RUNTIMES &&
      'useFactory' in candidate &&
      typeof candidate.useFactory === 'function',
  );
  if (!provider) throw new Error('knowledge runtime provider not found');

  const config = {
    get: <Key extends keyof ServerEnv>(key: Key) => values[key],
  } as ConfigService<ServerEnv, true>;
  return provider.useFactory(config) as KnowledgeModelRuntimeBundle;
}
