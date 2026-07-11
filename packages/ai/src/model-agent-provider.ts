import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, type LanguageModelV1 } from 'ai';
import type { z } from 'zod';

import type { StructuredModelExecutor } from './model-agent-contract';
import { isSafeModelName } from './model-agent-safety';

export type OpenAICompatibleExecutorConfig = {
  provider: 'deepseek' | 'openai';
  apiKey: string;
  baseURL: string;
  model: string;
};

type ProviderFactory = (config: { apiKey: string; baseURL: string }) => (model: string) => unknown;

type GenerateStructuredInput = {
  model: unknown;
  schema: z.ZodTypeAny;
  system: string;
  prompt: string;
  maxTokens: number;
  abortSignal: AbortSignal;
};

type GenerateStructuredResult = {
  object: unknown;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
};

export type ModelAgentProviderDependencies = {
  createProvider: ProviderFactory;
  generateStructured: (input: GenerateStructuredInput) => Promise<GenerateStructuredResult>;
};

const defaultDependencies: ModelAgentProviderDependencies = {
  createProvider: (config) => createOpenAI(config),
  generateStructured: async (input) => {
    const result = await generateObject({
      model: input.model as LanguageModelV1,
      schema: input.schema,
      system: input.system,
      prompt: input.prompt,
      maxTokens: input.maxTokens,
      abortSignal: input.abortSignal,
    });
    return {
      object: result.object,
      usage: result.usage,
    };
  },
};

export function createOpenAICompatibleStructuredExecutor(
  config: OpenAICompatibleExecutorConfig,
  dependencies: ModelAgentProviderDependencies = defaultDependencies,
): StructuredModelExecutor {
  const normalized = normalizeProviderConfig(config);
  let model: unknown;
  try {
    const provider = dependencies.createProvider({
      apiKey: normalized.apiKey,
      baseURL: normalized.baseURL,
    });
    model = provider(normalized.model);
  } catch {
    throw new Error('MODEL_AGENT_PROVIDER_INITIALIZATION_FAILED');
  }

  return async (input) => {
    try {
      const result = await dependencies.generateStructured({
        model,
        schema: input.schema,
        system: input.systemPrompt,
        prompt: input.userPrompt,
        maxTokens: input.maxOutputTokens,
        abortSignal: input.signal,
      });

      return {
        object: result.object,
        usage: {
          inputTokens: result.usage?.promptTokens,
          outputTokens: result.usage?.completionTokens,
        },
      };
    } catch {
      throw new Error('MODEL_AGENT_PROVIDER_REQUEST_FAILED');
    }
  };
}

function normalizeProviderConfig(config: OpenAICompatibleExecutorConfig) {
  if (
    typeof config !== 'object' ||
    config === null ||
    typeof config.apiKey !== 'string' ||
    typeof config.baseURL !== 'string' ||
    typeof config.model !== 'string'
  ) {
    throw new Error('INVALID_MODEL_PROVIDER_CONFIG');
  }
  const apiKey = config.apiKey.trim();
  const baseURL = config.baseURL.trim();
  const model = config.model.trim();

  if (
    (config.provider !== 'deepseek' && config.provider !== 'openai') ||
    !apiKey ||
    !isSafeModelName(model) ||
    !isSafeHttpsUrl(baseURL)
  ) {
    throw new Error('INVALID_MODEL_PROVIDER_CONFIG');
  }

  return { apiKey, baseURL, model };
}

function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
