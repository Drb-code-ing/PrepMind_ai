import type { StructuredModelExecutor } from './model-agent-contract.ts';
import {
  createModelAgentRuntime,
  type ModelAgentRuntime,
} from './model-agent-runtime.ts';
import { createTrustedModelAgentStructuredOutputFailureSignal } from './model-agent-provider-failure.ts';

const DEEPSEEK_V4_BASE_URL = 'https://api.deepseek.com/v1';
const DEEPSEEK_V4_MODEL = 'deepseek-v4-flash';
const DEEPSEEK_V4_TIMEOUT_MS = 4_500;
const DIRECT_TRANSPORT_FAILURE = 'MODEL_AGENT_V4_TRANSPORT_FAILED';
const EXACT_JSON_FENCE = /^```json\n([\s\S]*)\n```$/;

export type FirstPartyDeepSeekV4RuntimeConfig = Readonly<{
  provider: 'deepseek';
  apiKey: string;
  baseURL: string;
  model: string;
}>;

export type FirstPartyDeepSeekV4Runtime = Readonly<{
  runtime: ModelAgentRuntime;
  providerAttemptCount(): number;
}>;

/**
 * Builds the V4-only runtime from a private direct-fetch adapter. The adapter
 * is deliberately not returned or injected: only this first-party module can
 * reduce provider data to a trusted fixed structured-output stage.
 */
export function createFirstPartyDeepSeekV4Runtime(
  config: FirstPartyDeepSeekV4RuntimeConfig,
): FirstPartyDeepSeekV4Runtime {
  const normalized = normalizeConfig(config);
  let attempts = 0;
  const executor: StructuredModelExecutor = async (input) => {
    attempts += 1;
    return executeTrustedDeepSeekV4Json(normalized, input);
  };

  return Object.freeze({
    runtime: createModelAgentRuntime({
      mode: 'live',
      provider: 'deepseek',
      model: DEEPSEEK_V4_MODEL,
      liveCallsEnabled: true,
      timeoutMs: DEEPSEEK_V4_TIMEOUT_MS,
      executor,
    }),
    providerAttemptCount: () => boundedAttempts(attempts),
  });
}

async function executeTrustedDeepSeekV4Json(
  config: FirstPartyDeepSeekV4RuntimeConfig,
  input: Parameters<StructuredModelExecutor>[0],
) {
  const response = await fetchCompletion(config, input);
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
}

function normalizeConfig(
  config: FirstPartyDeepSeekV4RuntimeConfig,
): FirstPartyDeepSeekV4RuntimeConfig {
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
  config: FirstPartyDeepSeekV4RuntimeConfig,
  input: Parameters<StructuredModelExecutor>[0],
) {
  let response: Response;
  try {
    response = await globalThis.fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        response_format: { type: 'json_object' },
        max_tokens: input.maxOutputTokens,
        stream: false,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
      }),
      signal: input.signal,
    });
  } catch {
    throw new Error(DIRECT_TRANSPORT_FAILURE);
  }
  if (!response.ok) throw new Error(DIRECT_TRANSPORT_FAILURE);
  return response;
}

async function readJsonPayload(
  input: Parameters<StructuredModelExecutor>[0],
  response: Response,
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

function boundedAttempts(value: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 48 ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeTokenCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
