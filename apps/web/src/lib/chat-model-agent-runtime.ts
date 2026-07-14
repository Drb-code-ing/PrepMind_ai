import 'server-only';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  createOpenAICompatibleStructuredExecutor,
  type CreateModelAgentRuntimeInput,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
  type OpenAICompatibleExecutorConfig,
  type StructuredModelExecutor,
} from '@repo/ai';

import {
  resolveChatModelAgentConfig,
  type ChatModelAgentConfig,
} from './chat-model-agent-config.ts';

type Environment = Record<string, unknown>;

type ChatModelAgentRuntimeDependencies = {
  env?: Environment;
  createExecutor?: (
    config: OpenAICompatibleExecutorConfig,
  ) => StructuredModelExecutor;
  createRuntime?: (input: CreateModelAgentRuntimeInput) => ModelAgentRuntime;
};

export type ChatModelAgentRuntimeBundle = {
  routerRuntime: ModelAgentRuntime;
  verifierRuntime: ModelAgentRuntime;
  routerEnabled: boolean;
  verifierEnabled: boolean;
  config: ChatModelAgentConfig;
  createBudget: () => ModelAgentRunBudget;
};

const MOCK_ROUTER_RESPONSE = Object.freeze({
  route: 'chat',
  confidence: 1,
  reasonCode: 'insufficient_context',
});
const MOCK_VERIFIER_RESPONSE = Object.freeze({
  status: 'insufficient',
  evidenceCodes: Object.freeze(['off_topic_or_weak']),
});
const INVALID_CONFIG: ChatModelAgentConfig = Object.freeze({
  mode: 'mock',
  liveCallsEnabled: false,
  routerEnabled: false,
  verifierEnabled: false,
  routerTimeoutMs: 5_000,
  verifierTimeoutMs: 4_000,
  provider: 'mock',
  model: 'mock-agent-candidate',
  credentialSource: 'none',
  configured: false,
  disabledReason: 'invalid_provider_config',
});

export function createChatModelAgentRuntimeBundle(
  dependencies: ChatModelAgentRuntimeDependencies = {},
): ChatModelAgentRuntimeBundle {
  try {
    const env = dependencies.env ?? process.env;
    const createExecutor =
      dependencies.createExecutor ?? createOpenAICompatibleStructuredExecutor;
    const createRuntime = dependencies.createRuntime ?? createModelAgentRuntime;
    const snapshot = readEnvironmentSnapshot(env);
    const config = resolveChatModelAgentConfig(snapshot);

    if (!config.configured) return createDisabledBundle();

    let executor: StructuredModelExecutor | undefined;
    const liveRuntime =
      config.mode === 'live' &&
      config.liveCallsEnabled &&
      (config.routerEnabled || config.verifierEnabled) &&
      config.provider !== 'mock' &&
      config.credentialSource !== 'none';
    if (liveRuntime) {
      if (config.provider === 'mock') return createDisabledBundle();
      const providerSecrets = selectProviderSecrets(snapshot, config);
      if (providerSecrets === null) return createDisabledBundle();
      executor = createExecutor({
        provider: config.provider,
        apiKey: providerSecrets.apiKey,
        baseURL: providerSecrets.baseURL,
        model: config.model,
        structuredOutputMode: 'json_object',
      });
    }

    const internalMode = liveRuntime ? 'live' : 'mock';
    const internalProvider = liveRuntime ? config.provider : 'mock';
    const internalModel = liveRuntime ? config.model : 'mock-agent-candidate';
    const routerRuntime = createRuntime({
      mode: internalMode,
      provider: internalProvider,
      model: internalModel,
      liveCallsEnabled: liveRuntime && config.routerEnabled,
      timeoutMs: config.routerTimeoutMs,
      mockResponder: fixedMockResponder,
      ...(executor ? { executor } : {}),
    });
    const verifierRuntime = createRuntime({
      mode: internalMode,
      provider: internalProvider,
      model: internalModel,
      liveCallsEnabled: liveRuntime && config.verifierEnabled,
      timeoutMs: config.verifierTimeoutMs,
      mockResponder: fixedMockResponder,
      ...(executor ? { executor } : {}),
    });

    return {
      routerRuntime,
      verifierRuntime,
      routerEnabled: config.routerEnabled,
      verifierEnabled: config.verifierEnabled,
      config,
      createBudget,
    };
  } catch {
    return createDisabledBundle();
  }
}

function fixedMockResponder(input: { task: string }) {
  return input.task === 'knowledge_verification'
    ? { ...MOCK_VERIFIER_RESPONSE, evidenceCodes: [...MOCK_VERIFIER_RESPONSE.evidenceCodes] }
    : { ...MOCK_ROUTER_RESPONSE };
}

function createBudget(): ModelAgentRunBudget {
  return createModelAgentBudget({
    maxCalls: 2,
    maxInputTokens: 2_400,
    maxOutputTokens: 800,
  });
}

function createDisabledBundle(): ChatModelAgentRuntimeBundle {
  const routerRuntime = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'mock-agent-candidate',
    liveCallsEnabled: false,
    timeoutMs: 5_000,
    mockResponder: fixedMockResponder,
  });
  const verifierRuntime = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'mock-agent-candidate',
    liveCallsEnabled: false,
    timeoutMs: 4_000,
    mockResponder: fixedMockResponder,
  });
  return {
    routerRuntime,
    verifierRuntime,
    routerEnabled: false,
    verifierEnabled: false,
    config: { ...INVALID_CONFIG },
    createBudget,
  };
}

function readEnvironmentSnapshot(env: Environment) {
  if (typeof env !== 'object' || env === null) {
    throw new Error('INVALID_MODEL_AGENT_ENVIRONMENT');
  }
  const snapshot = {
    AI_PROVIDER_MODE: env.AI_PROVIDER_MODE,
    AI_ENABLE_LIVE_CALLS: env.AI_ENABLE_LIVE_CALLS,
    ROUTER_MODEL_ENABLED: env.ROUTER_MODEL_ENABLED,
    KNOWLEDGE_VERIFIER_MODEL_ENABLED: env.KNOWLEDGE_VERIFIER_MODEL_ENABLED,
    ROUTER_MODEL_TIMEOUT_MS: env.ROUTER_MODEL_TIMEOUT_MS,
    KNOWLEDGE_VERIFIER_MODEL_TIMEOUT_MS:
      env.KNOWLEDGE_VERIFIER_MODEL_TIMEOUT_MS,
    DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    AI_BASE_URL: env.AI_BASE_URL,
    AI_MODEL: env.AI_MODEL,
  };
  for (const value of Object.values(snapshot)) {
    if (value !== undefined && typeof value !== 'string') {
      throw new Error('INVALID_MODEL_AGENT_ENVIRONMENT');
    }
  }
  return snapshot as Record<keyof typeof snapshot, string | undefined>;
}

function selectProviderSecrets(
  env: ReturnType<typeof readEnvironmentSnapshot>,
  config: ChatModelAgentConfig,
): { apiKey: string; baseURL: string } | null {
  if (
    config.mode !== 'live' ||
    !config.configured ||
    config.provider === 'mock' ||
    config.credentialSource === 'none'
  ) {
    return null;
  }
  const apiKey =
    config.credentialSource === 'deepseek'
      ? env.DEEPSEEK_API_KEY?.trim()
      : env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseURL =
    env.AI_BASE_URL?.trim() ||
    (config.provider === 'deepseek'
      ? 'https://api.deepseek.com'
      : 'https://api.openai.com/v1');
  return { apiKey, baseURL };
}
