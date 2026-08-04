import { createOpenAI } from '@ai-sdk/openai';
import { streamText, type LanguageModelV1 } from 'ai';

export const FINAL_RESPONSE_STREAM_PROVIDER_VERSION = 'final-response-stream-provider-v1' as const;
export const FINAL_RESPONSE_STREAM_PROVIDER_MODEL = 'deepseek-v4-pro' as const;
export const FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL = 'https://api.deepseek.com/v1' as const;
export const FINAL_RESPONSE_STREAM_PROVIDER_COMPLETIONS_URL =
  'https://api.deepseek.com/v1/chat/completions' as const;
export const FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS = 1_200 as const;

export const FINAL_RESPONSE_STREAM_PROVIDER_FAILURE_CODES = [
  'aborted',
  'provider_unavailable',
  'schema_invalid',
] as const;

export type FinalResponseStreamProviderFailureCode =
  (typeof FINAL_RESPONSE_STREAM_PROVIDER_FAILURE_CODES)[number];

export type FinalResponseStreamProviderConfig = Readonly<{
  apiKey: string;
  baseURL: typeof FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL;
  model: typeof FINAL_RESPONSE_STREAM_PROVIDER_MODEL;
}>;

export type FinalResponseStreamExecutorRequest = Readonly<{
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: typeof FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS;
  signal: AbortSignal;
}>;

export type FinalResponseStreamExecutorEvent =
  | Readonly<{ type: 'text_delta'; text: string }>
  | Readonly<{
      type: 'finish';
      finishReason: 'stop' | 'length' | 'content_filter';
      usage: Readonly<{ inputTokens: number; outputTokens: number }>;
    }>;

export type FinalResponseStreamExecutor = (
  request: FinalResponseStreamExecutorRequest,
) => AsyncIterable<FinalResponseStreamExecutorEvent>;

type ProviderFactory = (config: {
  apiKey: string;
  baseURL: string;
  compatibility: 'strict';
  fetch: typeof fetch;
}) => (model: string) => unknown;

type StreamTextResultLike = Readonly<{
  fullStream: AsyncIterable<unknown>;
  warnings: Promise<unknown>;
  reasoning: Promise<unknown>;
  reasoningDetails: Promise<unknown>;
  toolCalls: Promise<unknown>;
  toolResults: Promise<unknown>;
  sources: Promise<unknown>;
  files: Promise<unknown>;
}>;

type StreamTextInput = Readonly<{
  model: unknown;
  system: string;
  prompt: string;
  maxTokens: number;
  maxRetries: 0;
  maxSteps: 1;
  abortSignal: AbortSignal;
}>;

export type FinalResponseStreamProviderDependencies = Readonly<{
  fetch?: typeof fetch;
  createProvider?: ProviderFactory;
  streamText?: (input: StreamTextInput) => StreamTextResultLike;
}>;

export class FinalResponseStreamProviderError extends Error {
  readonly code: FinalResponseStreamProviderFailureCode;

  constructor(code: FinalResponseStreamProviderFailureCode) {
    super(`FINAL_RESPONSE_STREAM_${code.toUpperCase()}`);
    this.name = 'FinalResponseStreamProviderError';
    this.code = code;
  }
}

export function isFinalResponseStreamProviderError(
  value: unknown,
): value is FinalResponseStreamProviderError {
  return (
    value instanceof FinalResponseStreamProviderError &&
    FINAL_RESPONSE_STREAM_PROVIDER_FAILURE_CODES.includes(value.code)
  );
}

const defaultDependencies = Object.freeze({
  fetch: globalThis.fetch,
  createProvider: (config: Parameters<ProviderFactory>[0]) => createOpenAI(config),
  streamText: (input: StreamTextInput): StreamTextResultLike =>
    streamText({
      model: input.model as LanguageModelV1,
      system: input.system,
      prompt: input.prompt,
      maxTokens: input.maxTokens,
      maxRetries: input.maxRetries,
      maxSteps: input.maxSteps,
      abortSignal: input.abortSignal,
    }),
});

export function createFinalResponseStreamExecutor(
  configInput: FinalResponseStreamProviderConfig,
  dependenciesInput: FinalResponseStreamProviderDependencies = {},
): FinalResponseStreamExecutor {
  const config = normalizeConfig(configInput);
  const dependencies = normalizeDependencies(dependenciesInput);
  let model: unknown;
  try {
    const provider = dependencies.createProvider({
      apiKey: config.apiKey,
      baseURL: FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL,
      compatibility: 'strict',
      fetch: createDeepSeekV4ProNonThinkingStreamingFetch(dependencies.fetch),
    });
    model = provider(FINAL_RESPONSE_STREAM_PROVIDER_MODEL);
  } catch {
    throw failure('provider_unavailable');
  }

  return async function* execute(requestInput) {
    const request = normalizeRequest(requestInput);
    if (request.signal.aborted) throw failure('aborted');

    let result: StreamTextResultLike;
    try {
      result = dependencies.streamText({
        model,
        system: request.systemPrompt,
        prompt: request.userPrompt,
        maxTokens: FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS,
        maxRetries: 0,
        maxSteps: 1,
        abortSignal: request.signal,
      });
    } catch {
      throw failure(request.signal.aborted ? 'aborted' : 'provider_unavailable');
    }

    let stepStarted = 0;
    let stepFinished: SafeFinish | null = null;
    let finalFinish: SafeFinish | null = null;
    try {
      for await (const rawPart of result.fullStream) {
        if (finalFinish !== null) throw failure('schema_invalid');
        const part = snapshotPart(rawPart);
        switch (part.type) {
          case 'step-start':
            stepStarted += 1;
            if (stepStarted !== 1 || !isEmptyWarnings(part.warnings)) {
              throw failure('schema_invalid');
            }
            break;
          case 'text-delta': {
            if (stepStarted !== 1 || stepFinished !== null) throw failure('schema_invalid');
            const text = readOwnString(part.value, 'textDelta');
            if (text === null || text.length === 0) throw failure('schema_invalid');
            yield Object.freeze({ type: 'text_delta' as const, text });
            break;
          }
          case 'step-finish':
            if (stepStarted !== 1 || stepFinished !== null || !isEmptyWarnings(part.warnings)) {
              throw failure('schema_invalid');
            }
            stepFinished = parseFinish(part.value);
            break;
          case 'finish':
            if (stepStarted !== 1 || stepFinished === null) throw failure('schema_invalid');
            finalFinish = parseFinish(part.value);
            if (!sameFinish(stepFinished, finalFinish)) throw failure('schema_invalid');
            break;
          case 'error':
            throw failure(request.signal.aborted ? 'aborted' : 'provider_unavailable');
          default:
            throw failure('schema_invalid');
        }
      }

      if (stepStarted !== 1 || stepFinished === null || finalFinish === null) {
        throw failure('schema_invalid');
      }
      const [warnings, reasoning, reasoningDetails, toolCalls, toolResults, sources, files] =
        await Promise.all([
          result.warnings,
          result.reasoning,
          result.reasoningDetails,
          result.toolCalls,
          result.toolResults,
          result.sources,
          result.files,
        ]);
      if (
        !isEmptyWarnings(warnings) ||
        (reasoning !== undefined && reasoning !== '') ||
        !isEmptyArray(reasoningDetails) ||
        !isEmptyArray(toolCalls) ||
        !isEmptyArray(toolResults) ||
        !isEmptyArray(sources) ||
        !isEmptyArray(files)
      ) {
        throw failure('schema_invalid');
      }
      if (request.signal.aborted) throw failure('aborted');
      yield Object.freeze({
        type: 'finish' as const,
        finishReason: finalFinish.finishReason,
        usage: finalFinish.usage,
      });
    } catch (error) {
      if (isFinalResponseStreamProviderError(error)) throw error;
      throw failure(request.signal.aborted ? 'aborted' : 'provider_unavailable');
    }
  };
}

export function createDeepSeekV4ProNonThinkingStreamingFetch(delegate: typeof fetch): typeof fetch {
  if (typeof delegate !== 'function') throw failure('provider_unavailable');
  return async (input, init) => {
    const request = parseStreamingRequest(input, init);
    return delegate(FINAL_RESPONSE_STREAM_PROVIDER_COMPLETIONS_URL, {
      ...init,
      method: 'POST',
      body: JSON.stringify({
        ...request,
        stream_options: { include_usage: true },
        thinking: { type: 'disabled' },
      }),
    });
  };
}

type SafeFinish = Readonly<{
  finishReason: 'stop' | 'length' | 'content_filter';
  usage: Readonly<{ inputTokens: number; outputTokens: number }>;
}>;

function normalizeConfig(
  input: FinalResponseStreamProviderConfig,
): FinalResponseStreamProviderConfig {
  try {
    if (!isPlainRecord(input)) throw new Error();
    const apiKey = readOwnString(input, 'apiKey');
    const baseURL = readOwnString(input, 'baseURL');
    const model = readOwnString(input, 'model');
    if (
      apiKey === null ||
      apiKey !== apiKey.trim() ||
      apiKey.length < 1 ||
      apiKey.length > 512 ||
      !/^[\x21-\x7e]+$/u.test(apiKey) ||
      baseURL !== FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL ||
      model !== FINAL_RESPONSE_STREAM_PROVIDER_MODEL ||
      Reflect.ownKeys(input).some(
        (key) => typeof key !== 'string' || !['apiKey', 'baseURL', 'model'].includes(key),
      )
    ) {
      throw new Error();
    }
    return Object.freeze({
      apiKey,
      baseURL: FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL,
      model: FINAL_RESPONSE_STREAM_PROVIDER_MODEL,
    });
  } catch {
    throw failure('provider_unavailable');
  }
}

function normalizeDependencies(
  input: FinalResponseStreamProviderDependencies,
): Required<FinalResponseStreamProviderDependencies> {
  try {
    if (!isPlainRecord(input)) throw new Error();
    const fetchDependency = readOptionalOwnFunction(input, 'fetch') ?? defaultDependencies.fetch;
    const createProvider =
      readOptionalOwnFunction(input, 'createProvider') ?? defaultDependencies.createProvider;
    const stream = readOptionalOwnFunction(input, 'streamText') ?? defaultDependencies.streamText;
    if (
      Reflect.ownKeys(input).some(
        (key) =>
          typeof key !== 'string' || !['fetch', 'createProvider', 'streamText'].includes(key),
      )
    ) {
      throw new Error();
    }
    return Object.freeze({
      fetch: fetchDependency as typeof fetch,
      createProvider: createProvider as ProviderFactory,
      streamText: stream as (input: StreamTextInput) => StreamTextResultLike,
    });
  } catch {
    throw failure('provider_unavailable');
  }
}

function normalizeRequest(
  input: FinalResponseStreamExecutorRequest,
): FinalResponseStreamExecutorRequest {
  try {
    if (!isPlainRecord(input)) throw new Error();
    const systemPrompt = readOwnString(input, 'systemPrompt');
    const userPrompt = readOwnString(input, 'userPrompt');
    const maxOutputTokens = readOwnValue(input, 'maxOutputTokens');
    const signal = readOwnValue(input, 'signal');
    if (
      systemPrompt === null ||
      systemPrompt.length < 1 ||
      systemPrompt.length > 64_000 ||
      userPrompt === null ||
      userPrompt.length < 1 ||
      userPrompt.length > 128_000 ||
      maxOutputTokens !== FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS ||
      !isNativeAbortSignal(signal) ||
      Reflect.ownKeys(input).some(
        (key) =>
          typeof key !== 'string' ||
          !['systemPrompt', 'userPrompt', 'maxOutputTokens', 'signal'].includes(key),
      )
    ) {
      throw new Error();
    }
    return Object.freeze({ systemPrompt, userPrompt, maxOutputTokens, signal });
  } catch {
    throw failure('schema_invalid');
  }
}

function parseStreamingRequest(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
): Record<string, unknown> {
  try {
    if (
      (typeof input !== 'string' && !(input instanceof URL)) ||
      String(input) !== FINAL_RESPONSE_STREAM_PROVIDER_COMPLETIONS_URL ||
      init?.method !== 'POST' ||
      typeof init.body !== 'string'
    ) {
      throw new Error();
    }
    const parsed: unknown = JSON.parse(init.body);
    if (!isPlainRecord(parsed)) throw new Error();
    if (
      parsed.model !== FINAL_RESPONSE_STREAM_PROVIDER_MODEL ||
      parsed.stream !== true ||
      parsed.max_tokens !== FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS ||
      !Array.isArray(parsed.messages) ||
      parsed.messages.length === 0 ||
      hasOwn(parsed, 'thinking') ||
      hasOwn(parsed, 'response_format') ||
      [
        'tools',
        'tool_choice',
        'functions',
        'function_call',
        'json_schema',
        'parallel_tool_calls',
      ].some((field) => hasOwn(parsed, field))
    ) {
      throw new Error();
    }
    if (
      hasOwn(parsed, 'stream_options') &&
      (!isPlainRecord(parsed.stream_options) ||
        Reflect.ownKeys(parsed.stream_options).length !== 1 ||
        parsed.stream_options.include_usage !== true)
    ) {
      throw new Error();
    }
    return parsed;
  } catch {
    throw failure('schema_invalid');
  }
}

function snapshotPart(input: unknown): {
  type: string;
  value: Record<string, unknown>;
  warnings: unknown;
} {
  if (!isPlainRecord(input)) throw failure('schema_invalid');
  const type = readOwnString(input, 'type');
  if (type === null) throw failure('schema_invalid');
  return { type, value: input, warnings: readOwnValue(input, 'warnings') };
}

function parseFinish(input: Record<string, unknown>): SafeFinish {
  const rawReason = readOwnString(input, 'finishReason');
  const finishReason =
    rawReason === 'content-filter'
      ? ('content_filter' as const)
      : rawReason === 'stop' || rawReason === 'length'
        ? rawReason
        : null;
  const usageInput = readOwnValue(input, 'usage');
  if (finishReason === null || !isPlainRecord(usageInput)) throw failure('schema_invalid');
  const inputTokens = readOwnValue(usageInput, 'promptTokens');
  const outputTokens = readOwnValue(usageInput, 'completionTokens');
  if (!isPositiveSafeInteger(inputTokens) || !isPositiveSafeInteger(outputTokens)) {
    throw failure('schema_invalid');
  }
  return Object.freeze({
    finishReason,
    usage: Object.freeze({ inputTokens, outputTokens }),
  });
}

function sameFinish(left: SafeFinish, right: SafeFinish) {
  return (
    left.finishReason === right.finishReason &&
    left.usage.inputTokens === right.usage.inputTokens &&
    left.usage.outputTokens === right.usage.outputTokens
  );
}

function isEmptyWarnings(value: unknown) {
  return value === undefined || (Array.isArray(value) && value.length === 0);
}

function isEmptyArray(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

function readOptionalOwnFunction(input: Record<string, unknown>, key: string) {
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (descriptor === undefined) return undefined;
  if (!('value' in descriptor) || typeof descriptor.value !== 'function') throw new Error();
  return descriptor.value as (...args: never[]) => unknown;
}

function readOwnString(input: Record<string, unknown>, key: string): string | null {
  const value = readOwnValue(input, key);
  return typeof value === 'string' ? value : null;
}

function readOwnValue(input: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  try {
    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function isNativeAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function failure(code: FinalResponseStreamProviderFailureCode) {
  return new FinalResponseStreamProviderError(code);
}
