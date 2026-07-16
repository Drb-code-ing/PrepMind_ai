import type { StructuredModelExecutor } from './model-agent-contract.ts';
import { createTrustedModelAgentStructuredOutputFailureSignal } from './model-agent-provider-failure.ts';

const DEEPSEEK_V4_BASE_URL = 'https://api.deepseek.com/v1';
const DEEPSEEK_V4_MODEL = 'deepseek-v4-flash';
const DIRECT_TRANSPORT_FAILURE = 'MODEL_AGENT_V4_TRANSPORT_FAILED';
const EXACT_JSON_FENCE = /^```json\n([\s\S]*)\n```$/;

export type TrustedDeepSeekV4JsonFetch = (
  url: string,
  init: Readonly<{
    method: 'POST';
    headers: Readonly<Record<string, string>>;
    body: string;
    signal: AbortSignal;
  }>,
) => Promise<
  Readonly<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }>
>;

export type TrustedDeepSeekV4JsonConfig = Readonly<{
  provider: 'deepseek';
  apiKey: string;
  baseURL: string;
  model: string;
}>;

/**
 * The only direct-fetch adapter permitted to emit trusted structured-output
 * stage signals. Its parser reduces provider data to fixed enum stages before
 * calling the private @repo/ai signal boundary.
 */
export function createTrustedDeepSeekV4JsonExecutor(
  config: TrustedDeepSeekV4JsonConfig,
  dependencies: Readonly<{ fetch: TrustedDeepSeekV4JsonFetch }>,
): StructuredModelExecutor {
  const normalized = normalizeConfig(config);

  return async (input) => {
    const response = await fetchCompletion({
      config: normalized,
      fetch: dependencies.fetch,
      input,
    });
    const payload = await readJsonPayload(input, response);
    const content = readOnlyCompletionContent(input, payload);
    const parsed = parseExactJsonContent(input, content);
    const schema = input.schema.safeParse(parsed);
    if (!schema.success) {
      throwStructuredOutputFailure(input, 'provider_type_validation');
    }

    return {
      object: schema.data,
      ...readSafeUsage(payload),
    };
  };
}

function normalizeConfig(
  config: TrustedDeepSeekV4JsonConfig,
): TrustedDeepSeekV4JsonConfig {
  try {
    if (
      typeof config !== 'object' ||
      config === null ||
      config.provider !== 'deepseek' ||
      typeof config.apiKey !== 'string' ||
      !config.apiKey.trim() ||
      config.baseURL !== DEEPSEEK_V4_BASE_URL ||
      config.model !== DEEPSEEK_V4_MODEL
    ) {
      throw new Error();
    }
    return {
      provider: 'deepseek',
      apiKey: config.apiKey.trim(),
      baseURL: DEEPSEEK_V4_BASE_URL,
      model: DEEPSEEK_V4_MODEL,
    };
  } catch {
    throw new Error('INVALID_MODEL_PROVIDER_CONFIG');
  }
}

async function fetchCompletion(
  input: Readonly<{
    config: TrustedDeepSeekV4JsonConfig;
    fetch: TrustedDeepSeekV4JsonFetch;
    input: Parameters<StructuredModelExecutor>[0];
  }>,
) {
  let response: Awaited<ReturnType<TrustedDeepSeekV4JsonFetch>>;
  try {
    response = await input.fetch(`${input.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: input.config.model,
        response_format: { type: 'json_object' },
        max_tokens: input.input.maxOutputTokens,
        stream: false,
        messages: [
          { role: 'system', content: input.input.systemPrompt },
          { role: 'user', content: input.input.userPrompt },
        ],
      }),
      signal: input.input.signal,
    });
  } catch {
    throw new Error(DIRECT_TRANSPORT_FAILURE);
  }
  if (!response.ok) throw new Error(DIRECT_TRANSPORT_FAILURE);
  return response;
}

async function readJsonPayload(
  input: Parameters<StructuredModelExecutor>[0],
  response: Awaited<ReturnType<TrustedDeepSeekV4JsonFetch>>,
) {
  try {
    return await response.json();
  } catch {
    throwStructuredOutputFailure(input, 'provider_json_parse');
  }
}

function readOnlyCompletionContent(
  input: Parameters<StructuredModelExecutor>[0],
  payload: unknown,
): string {
  try {
    if (!isRecord(payload)) throw new Error();
    const choices: unknown = payload.choices;
    if (!Array.isArray(choices) || choices.length !== 1) throw new Error();
    const choice: unknown = choices[0];
    if (
      !isRecord(choice) ||
      !isRecord(choice.message) ||
      typeof choice.message.content !== 'string'
    ) {
      throw new Error();
    }
    return choice.message.content;
  } catch {
    throwStructuredOutputFailure(input, 'provider_object_missing');
  }
}

function parseExactJsonContent(
  input: Parameters<StructuredModelExecutor>[0],
  content: string,
): unknown {
  try {
    const candidate = content.startsWith('```')
      ? readExactFencedPayload(content)
      : content;
    return JSON.parse(candidate);
  } catch {
    throwStructuredOutputFailure(input, 'provider_json_parse');
  }
}

function readExactFencedPayload(content: string): string {
  const matched = EXACT_JSON_FENCE.exec(content);
  if (!matched || matched.length !== 2) throw new Error();
  return matched[1];
}

function readSafeUsage(
  payload: unknown,
):
  | Readonly<{ usage: Readonly<{ inputTokens: number; outputTokens: number }> }>
  | Readonly<Record<never, never>> {
  try {
    if (!isRecord(payload) || !isRecord(payload.usage)) return {};
    const inputTokens = payload.usage.prompt_tokens;
    const outputTokens = payload.usage.completion_tokens;
    if (!isSafeTokenCount(inputTokens) || !isSafeTokenCount(outputTokens)) {
      return {};
    }
    return { usage: { inputTokens, outputTokens } };
  } catch {
    return {};
  }
}

function throwStructuredOutputFailure(
  input: Parameters<StructuredModelExecutor>[0],
  stage:
    | 'provider_json_parse'
    | 'provider_type_validation'
    | 'provider_object_missing',
): never {
  throw createTrustedModelAgentStructuredOutputFailureSignal(
    input.signal,
    stage,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeTokenCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
