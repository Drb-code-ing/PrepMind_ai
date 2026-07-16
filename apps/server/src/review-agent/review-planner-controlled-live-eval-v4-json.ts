import type { StructuredModelExecutor } from '@repo/ai';

const V4_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const V4_DEEPSEEK_MODEL = 'deepseek-v4-flash';
const V4_TRANSPORT_FAILURE = 'MODEL_AGENT_V4_TRANSPORT_FAILED';
const EXACT_JSON_FENCE = /^```json\n([\s\S]*)\n```$/;

export type ReviewPlannerControlledLiveV4Fetch = (
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

type V4DeepSeekConfig = Readonly<{
  provider: 'deepseek';
  apiKey: string;
  baseURL: string;
  model: string;
}>;

type V4Dependencies = Readonly<{
  fetch: ReviewPlannerControlledLiveV4Fetch;
}>;

/**
 * V4-only opt-in executor for the isolated controlled-Live diagnostic. It is
 * deliberately not part of the general provider factory, so v1-v3 and Chat
 * preserve their frozen Vercel AI SDK transports.
 */
export function createReviewPlannerControlledLiveV4JsonExecutor(
  config: V4DeepSeekConfig,
  dependencies: V4Dependencies,
): StructuredModelExecutor {
  const normalized = normalizeV4Config(config);

  return async (input) => {
    const response = await fetchV4Completion({
      config: normalized,
      fetch: dependencies.fetch,
      input,
    });
    const payload = await readJsonPayload(input, response);
    const content = readOnlyCompletionContent(input, payload);
    const parsed = parseExactJsonContent(input, content);
    const schema = input.schema.safeParse(parsed);
    if (!schema.success)
      throwStructuredOutputFailure(input, 'provider_type_validation');

    return {
      object: schema.data,
      ...readSafeUsage(payload),
    };
  };
}

function normalizeV4Config(config: V4DeepSeekConfig): V4DeepSeekConfig {
  try {
    if (
      typeof config !== 'object' ||
      config === null ||
      config.provider !== 'deepseek' ||
      typeof config.apiKey !== 'string' ||
      !config.apiKey.trim() ||
      config.baseURL !== V4_DEEPSEEK_BASE_URL ||
      config.model !== V4_DEEPSEEK_MODEL
    ) {
      throw new Error();
    }
    return {
      provider: 'deepseek',
      apiKey: config.apiKey.trim(),
      baseURL: V4_DEEPSEEK_BASE_URL,
      model: V4_DEEPSEEK_MODEL,
    };
  } catch {
    throw new Error('INVALID_MODEL_PROVIDER_CONFIG');
  }
}

async function fetchV4Completion(
  input: Readonly<{
    config: V4DeepSeekConfig;
    fetch: ReviewPlannerControlledLiveV4Fetch;
    input: Parameters<StructuredModelExecutor>[0];
  }>,
) {
  let response: Awaited<ReturnType<ReviewPlannerControlledLiveV4Fetch>>;
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
    throw transportFailure();
  }
  if (!response.ok) throw transportFailure();
  return response;
}

async function readJsonPayload(
  input: Parameters<StructuredModelExecutor>[0],
  response: Awaited<ReturnType<ReviewPlannerControlledLiveV4Fetch>>,
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
    if (!Array.isArray(choices) || choices.length !== 1) {
      throw new Error();
    }
    const choice: unknown = choices[0];
    if (
      !isRecord(choice) ||
      !isRecord(choice.message) ||
      typeof choice.message.content !== 'string'
    ) {
      throw new Error();
    }
    // Do not interpret reasoning_content, tool arguments, or any other field
    // as a fallback. Only the one canonical content field is eligible.
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
    if (!isSafeTokenCount(inputTokens) || !isSafeTokenCount(outputTokens))
      return {};
    return { usage: { inputTokens, outputTokens } };
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeTokenCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function throwStructuredOutputFailure(
  input: Parameters<StructuredModelExecutor>[0],
  stage:
    | 'provider_json_parse'
    | 'provider_type_validation'
    | 'provider_object_missing',
): never {
  const createSignal = input.createTrustedStructuredOutputFailure;
  if (typeof createSignal !== 'function') {
    throw new Error('MODEL_AGENT_V4_STRUCTURED_OUTPUT_SIGNAL_UNAVAILABLE');
  }
  let signal: unknown;
  try {
    signal = createSignal(stage);
  } catch {
    throw new Error('MODEL_AGENT_V4_STRUCTURED_OUTPUT_SIGNAL_UNAVAILABLE');
  }
  if (!(signal instanceof Error)) {
    throw new Error('MODEL_AGENT_V4_STRUCTURED_OUTPUT_SIGNAL_UNAVAILABLE');
  }
  throw signal;
}

function transportFailure() {
  return new Error(V4_TRANSPORT_FAILURE);
}
