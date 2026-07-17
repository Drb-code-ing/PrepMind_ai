import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, type LanguageModelV1, type Schema } from 'ai';
import type { z } from 'zod';

import type { StructuredModelExecutor } from './model-agent-contract.ts';
import {
  createTrustedModelAgentProviderFailureSignal,
  createUntrustedModelAgentProviderFailureSignal,
} from './model-agent-provider-failure.ts';
import { isSafeModelName } from './model-agent-safety.ts';
import {
  createDeepSeekV4ProNonThinkingFetch,
  DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL,
  DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
  type DeepSeekV4ProNonThinkingAudit,
} from './model-agent-deepseek-v4-pro-nonthinking.ts';
import {
  compileDeepSeekStrictToolSchemaProfiles,
  MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED,
  type ModelAgentStructuredSchemaProfile,
  type ModelAgentStructuredSchemaRegistry,
} from './model-agent-structured-schema.ts';

type BaseExecutorConfig = {
  provider: 'deepseek' | 'openai';
  apiKey: string;
  baseURL: string;
  model: string;
};

export type OpenAICompatibleExecutorConfig = BaseExecutorConfig &
  (
    | {
        structuredOutputMode?: 'json_object';
        schemaProfiles?: never;
        onNonThinkingAudit?: never;
      }
    | {
        structuredOutputMode: 'deepseek_strict_tool';
        schemaProfiles: readonly ModelAgentStructuredSchemaProfile[];
        onNonThinkingAudit?: never;
      }
    | {
        structuredOutputMode: 'deepseek_v4_pro_nonthinking_json';
        schemaProfiles?: never;
        onNonThinkingAudit?: (audit: DeepSeekV4ProNonThinkingAudit) => void;
      }
  );

type ProviderClient = ((model: string) => unknown) & {
  chat?: (
    model: string,
    settings: { structuredOutputs: true },
  ) => unknown;
};

type ProviderFactory = (config: {
  apiKey: string;
  baseURL: string;
  fetch?: typeof fetch;
}) => ProviderClient;

type GenerateStructuredBase = {
  model: unknown;
  system: string;
  prompt: string;
  maxTokens: number;
  maxRetries: 0;
  abortSignal: AbortSignal;
};

type JsonGenerateStructuredInput = GenerateStructuredBase & {
  mode: 'json';
  schema: z.ZodTypeAny;
};

type ToolGenerateStructuredInput = GenerateStructuredBase & {
  mode: 'tool';
  schema: Schema<unknown>;
  schemaName: typeof STRICT_TOOL_NAME;
  schemaDescription: typeof STRICT_TOOL_DESCRIPTION;
};

type GenerateStructuredInput =
  | JsonGenerateStructuredInput
  | ToolGenerateStructuredInput;

type PreparedGenerationInput =
  | Pick<JsonGenerateStructuredInput, 'model' | 'mode' | 'schema'>
  | Pick<
      ToolGenerateStructuredInput,
      'model' | 'mode' | 'schema' | 'schemaName' | 'schemaDescription'
    >;

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
    const result =
      input.mode === 'tool'
        ? await generateObject({
            model: input.model as LanguageModelV1,
            mode: 'tool',
            schema: input.schema,
            schemaName: input.schemaName,
            schemaDescription: input.schemaDescription,
            system: input.system,
            prompt: input.prompt,
            maxTokens: input.maxTokens,
            maxRetries: input.maxRetries,
            abortSignal: input.abortSignal,
          })
        : await generateObject({
            model: input.model as LanguageModelV1,
            mode: 'json',
            schema: input.schema,
            system: input.system,
            prompt: input.prompt,
            maxTokens: input.maxTokens,
            maxRetries: input.maxRetries,
            abortSignal: input.abortSignal,
          });
    return {
      object: result.object,
      usage: result.usage,
    };
  },
};

const STRICT_TOOL_NAME = 'model_agent_result' as const;
const STRICT_TOOL_DESCRIPTION =
  'Return exactly one validated model-agent result.' as const;

export function createOpenAICompatibleStructuredExecutor(
  config: OpenAICompatibleExecutorConfig,
  dependencies: ModelAgentProviderDependencies = defaultDependencies,
): StructuredModelExecutor {
  const trustedDependencies = dependencies === defaultDependencies;
  const normalized = normalizeProviderConfig(config);
  const schemaRegistry =
    normalized.structuredOutputMode === 'deepseek_strict_tool'
      ? compileDeepSeekStrictToolSchemaProfiles(normalized.schemaProfiles)
      : null;
  let model: unknown;
  try {
    const nonThinkingFetch =
      normalized.structuredOutputMode === 'deepseek_v4_pro_nonthinking_json'
        ? createDeepSeekV4ProNonThinkingFetch(
            globalThis.fetch,
            normalized.onNonThinkingAudit,
          )
        : undefined;
    const provider = dependencies.createProvider({
      apiKey: normalized.apiKey,
      baseURL: normalized.baseURL,
      ...(nonThinkingFetch ? { fetch: nonThinkingFetch } : {}),
    });
    if (normalized.structuredOutputMode === 'deepseek_strict_tool') {
      if (typeof provider.chat !== 'function') {
        throw new Error('STRICT_CHAT_MODEL_UNAVAILABLE');
      }
      model = provider.chat(normalized.model, { structuredOutputs: true });
    } else {
      model = provider(normalized.model);
    }
  } catch {
    throw new Error('MODEL_AGENT_PROVIDER_INITIALIZATION_FAILED');
  }

  return async (input) => {
    const generation = prepareGenerationInput({
      input,
      model,
      schemaRegistry,
    });
    try {
      const providerInput: GenerateStructuredInput = {
        ...generation,
        system: input.systemPrompt,
        prompt: input.userPrompt,
        maxTokens: input.maxOutputTokens,
        maxRetries: 0,
        abortSignal: input.signal,
      };
      const result = await dependencies.generateStructured(providerInput);

      return {
        object: result.object,
        usage: {
          inputTokens: result.usage?.promptTokens,
          outputTokens: result.usage?.completionTokens,
        },
      };
    } catch (error) {
      if (trustedDependencies) {
        throw createTrustedModelAgentProviderFailureSignal(error, input.signal);
      }
      throw createUntrustedModelAgentProviderFailureSignal(input.signal);
    }
  };
}

function normalizeProviderConfig(config: OpenAICompatibleExecutorConfig) {
  try {
    return normalizeProviderConfigUnchecked(config);
  } catch {
    throw new Error('INVALID_MODEL_PROVIDER_CONFIG');
  }
}

function normalizeProviderConfigUnchecked(config: OpenAICompatibleExecutorConfig) {
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
  const structuredOutputMode = config.structuredOutputMode ?? 'json_object';

  if (
    (config.provider !== 'deepseek' && config.provider !== 'openai') ||
    !apiKey ||
    !isSafeModelName(model) ||
    !isSafeHttpsUrl(baseURL) ||
    (structuredOutputMode !== 'json_object' &&
      structuredOutputMode !== 'deepseek_strict_tool' &&
      structuredOutputMode !== 'deepseek_v4_pro_nonthinking_json')
  ) {
    throw new Error('INVALID_MODEL_PROVIDER_CONFIG');
  }

  if (structuredOutputMode === 'deepseek_strict_tool') {
    const strictBaseURL = normalizeExactDeepSeekBetaUrl(baseURL);
    if (
      config.provider !== 'deepseek' ||
      model !== 'deepseek-v4-flash' ||
      strictBaseURL === null ||
      !Array.isArray(config.schemaProfiles) ||
      ('onNonThinkingAudit' in config &&
        config.onNonThinkingAudit !== undefined)
    ) {
      throw new Error('INVALID_MODEL_PROVIDER_CONFIG');
    }
    return {
      provider: config.provider,
      apiKey,
      baseURL: strictBaseURL,
      model,
      structuredOutputMode,
      schemaProfiles: config.schemaProfiles,
    } as const;
  }

  if (structuredOutputMode === 'deepseek_v4_pro_nonthinking_json') {
    if (
      config.provider !== 'deepseek' ||
      model !== DEEPSEEK_V4_PRO_NONTHINKING_MODEL ||
      baseURL !== DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL ||
      ('schemaProfiles' in config && config.schemaProfiles !== undefined) ||
      ('onNonThinkingAudit' in config &&
        config.onNonThinkingAudit !== undefined &&
        typeof config.onNonThinkingAudit !== 'function')
    ) {
      throw new Error('INVALID_MODEL_PROVIDER_CONFIG');
    }
    return {
      provider: 'deepseek' as const,
      apiKey,
      baseURL: DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL,
      model: DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
      structuredOutputMode,
      ...(typeof config.onNonThinkingAudit === 'function'
        ? { onNonThinkingAudit: config.onNonThinkingAudit }
        : {}),
    } as const;
  }

  if (
    ('schemaProfiles' in config && config.schemaProfiles !== undefined) ||
    ('onNonThinkingAudit' in config &&
      config.onNonThinkingAudit !== undefined)
  ) {
    throw new Error('INVALID_MODEL_PROVIDER_CONFIG');
  }
  return {
    provider: config.provider,
    apiKey,
    baseURL,
    model,
    structuredOutputMode,
  } as const;
}

function prepareGenerationInput(input: {
  input: Parameters<StructuredModelExecutor>[0];
  model: unknown;
  schemaRegistry: ModelAgentStructuredSchemaRegistry | null;
}): PreparedGenerationInput {
  try {
    return prepareGenerationInputUnchecked(input);
  } catch {
    throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
  }
}

function prepareGenerationInputUnchecked(input: {
  input: Parameters<StructuredModelExecutor>[0];
  model: unknown;
  schemaRegistry: ModelAgentStructuredSchemaRegistry | null;
}): PreparedGenerationInput {
  if (input.schemaRegistry === null) {
    return {
      model: input.model,
      mode: 'json',
      schema: input.input.schema,
    };
  }
  const profile = input.schemaRegistry.resolve(input.input.schema);
  if (profile === null) {
    throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
  }
  return {
    model: input.model,
    mode: 'tool',
    schema: profile.providerSchema,
    schemaName: STRICT_TOOL_NAME,
    schemaDescription: STRICT_TOOL_DESCRIPTION,
  };
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

function normalizeExactDeepSeekBetaUrl(value: string): string | null {
  const exact = 'https://api.deepseek.com/beta';
  if (value !== exact) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'api.deepseek.com' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    const pathname = url.pathname.endsWith('/')
      ? url.pathname.slice(0, -1)
      : url.pathname;
    return pathname === '/beta' ? exact : null;
  } catch {
    return null;
  }
}
