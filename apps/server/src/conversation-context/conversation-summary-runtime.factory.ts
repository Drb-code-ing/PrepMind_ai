import {
  createModelAgentBudget,
  createModelAgentRuntime,
  createOpenAICompatibleStructuredExecutor,
} from '@repo/ai';
import type {
  ModelAgentRuntime,
  OpenAICompatibleExecutorConfig,
  StructuredModelExecutor,
} from '@repo/ai';

import { resolveLiveModelProvider, type ServerEnv } from '../config/env';

export const CONVERSATION_SUMMARY_RUNTIME = Symbol(
  'CONVERSATION_SUMMARY_RUNTIME',
);

export type ConversationSummaryRuntimeBundle = {
  runtime: ModelAgentRuntime;
  mode: 'mock' | 'live';
  provider: 'mock' | 'deepseek' | 'openai';
  model: string;
  maxOutputTokens: number;
  createBudget(): ReturnType<typeof createModelAgentBudget>;
};

type RuntimeFactoryDependencies = {
  createExecutor(
    config: OpenAICompatibleExecutorConfig,
  ): StructuredModelExecutor;
};

type ConversationSummaryEnv = Pick<
  ServerEnv,
  | 'AI_PROVIDER_MODE'
  | 'AI_ENABLE_LIVE_CALLS'
  | 'AI_MODEL'
  | 'AI_BASE_URL'
  | 'DEEPSEEK_API_KEY'
  | 'OPENAI_API_KEY'
  | 'CONVERSATION_SUMMARY_MAX_CALLS'
  | 'CONVERSATION_SUMMARY_MAX_INPUT_TOKENS'
  | 'CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS'
  | 'CONVERSATION_SUMMARY_TIMEOUT_MS'
>;

const defaultDependencies: RuntimeFactoryDependencies = {
  createExecutor: createOpenAICompatibleStructuredExecutor,
};
const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

export function createConversationSummaryRuntime(
  env: ConversationSummaryEnv,
  dependencies: RuntimeFactoryDependencies = defaultDependencies,
): ConversationSummaryRuntimeBundle {
  const provider = resolveProvider(env);
  const executor = createLiveExecutor(env, provider, dependencies);
  const runtime = createModelAgentRuntime({
    mode: env.AI_PROVIDER_MODE,
    provider,
    model:
      env.AI_PROVIDER_MODE === 'mock'
        ? 'mock-conversation-summary'
        : env.AI_MODEL,
    liveCallsEnabled: env.AI_ENABLE_LIVE_CALLS,
    timeoutMs: env.CONVERSATION_SUMMARY_TIMEOUT_MS,
    mockResponder:
      env.AI_PROVIDER_MODE === 'mock'
        ? () => ({ summary: '对话已生成安全的滚动摘要。' })
        : undefined,
    executor,
  });

  return {
    runtime,
    mode: env.AI_PROVIDER_MODE,
    provider,
    model:
      env.AI_PROVIDER_MODE === 'mock'
        ? 'mock-conversation-summary'
        : env.AI_MODEL,
    maxOutputTokens: env.CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS,
    createBudget: () =>
      createModelAgentBudget({
        maxCalls: env.CONVERSATION_SUMMARY_MAX_CALLS,
        maxInputTokens: env.CONVERSATION_SUMMARY_MAX_INPUT_TOKENS,
        maxOutputTokens: env.CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS,
      }),
  };
}

function resolveProvider(env: ConversationSummaryEnv) {
  if (env.AI_PROVIDER_MODE === 'mock') return 'mock' as const;
  if (!env.AI_ENABLE_LIVE_CALLS) {
    try {
      const hostname = new URL(env.AI_BASE_URL).hostname.toLowerCase();
      return hostname === 'openai.com' || hostname.endsWith('.openai.com')
        ? ('openai' as const)
        : ('deepseek' as const);
    } catch {
      return 'deepseek' as const;
    }
  }
  const provider = resolveLiveModelProvider({
    baseURL: env.AI_BASE_URL,
    hasDeepseekKey: Boolean(env.DEEPSEEK_API_KEY),
    hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
  });
  if (!provider) {
    throw new Error('INVALID_CONVERSATION_SUMMARY_PROVIDER_CONFIG');
  }
  return provider;
}

function createLiveExecutor(
  env: ConversationSummaryEnv,
  provider: ConversationSummaryRuntimeBundle['provider'],
  dependencies: RuntimeFactoryDependencies,
) {
  if (
    env.AI_PROVIDER_MODE !== 'live' ||
    !env.AI_ENABLE_LIVE_CALLS ||
    provider === 'mock'
  ) {
    return undefined;
  }
  const apiKey =
    provider === 'deepseek' ? env.DEEPSEEK_API_KEY : env.OPENAI_API_KEY;
  if (!apiKey) return undefined;

  return dependencies.createExecutor({
    provider,
    apiKey,
    baseURL:
      provider === 'openai' && env.AI_BASE_URL === DEFAULT_DEEPSEEK_BASE_URL
        ? DEFAULT_OPENAI_BASE_URL
        : env.AI_BASE_URL,
    model: env.AI_MODEL,
  });
}
