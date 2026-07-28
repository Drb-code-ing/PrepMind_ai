import type { StructuredModelExecutor } from './model-agent-contract.ts';
import { requiresModelAgentStrictJsonContent } from './model-agent-structured-output-policy.ts';
import {
  DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL,
  DEEPSEEK_V4_PRO_NONTHINKING_COMPLETIONS_URL,
  DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
} from './model-agent-deepseek-v4-pro-nonthinking.ts';
import { createTrustedFirstPartyModelAgentProviderFailureSignal } from './model-agent-provider-failure.ts';
import {
  abortPhase697V7Wire,
  advancePhase697V7WireStage,
  claimPhase697V7WireCapability,
  completePhase697V7Wire,
  failPhase697V7Wire,
  projectPhase697V7WireFailure,
  readPhase697V7WireSnapshot,
  type Phase697V7WireCapability,
  type Phase697V7WireFailureCategory,
} from './phase-6-9-7-v7-wire-diagnostics.ts';

export const FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_ADAPTER_VERSION =
  'first-party-deepseek-v4-pro-direct-v1' as const;

const ADAPTER_FAILURE = 'FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_REQUEST_FAILED';
const INVALID_CONFIG = 'INVALID_MODEL_PROVIDER_CONFIG';
const EXACT_JSON_FENCE = /^```json\n([\s\S]*)\n```$/;
const CONFIG_KEYS = ['apiKey', 'baseURL', 'model', 'provider'] as const;
const EXECUTOR_INPUT_KEYS = [
  'maxOutputTokens',
  'schema',
  'signal',
  'systemPrompt',
  'userPrompt',
] as const;
const MAX_CREDENTIAL_LENGTH = 512;
const VISIBLE_ASCII = /^[\x21-\x7e]+$/;

export type FirstPartyDeepSeekV4ProDirectConfig = Readonly<{
  provider: 'deepseek';
  apiKey: string;
  baseURL: typeof DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL;
  model: typeof DEEPSEEK_V4_PRO_NONTHINKING_MODEL;
}>;

export type FirstPartyDeepSeekV4ProDirectDependencies = Readonly<{
  fetch: typeof fetch;
}>;

export type FirstPartyDeepSeekV4ProDirectAdapter = Readonly<{
  version: typeof FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_ADAPTER_VERSION;
  provenance: 'first_party_deepseek_v4_pro_direct' | 'synthetic_test';
  executor: StructuredModelExecutor;
}>;

type NormalizedExecutorInput = Parameters<StructuredModelExecutor>[0];
type SafeUsage = Readonly<{ inputTokens: number; outputTokens: number }>;

const DEFAULT_DEPENDENCIES: FirstPartyDeepSeekV4ProDirectDependencies = Object.freeze({
  fetch: (input, init) => globalThis.fetch(input, init),
});
const FALLBACK_SCOPE = new AbortController().signal;

/**
 * Creates the V7 direct adapter only. It does not create a ModelAgentRuntime,
 * product gate, runner, retry loop, or Live evidence. A non-default delegate is
 * permanently labelled synthetic and therefore cannot claim production provenance.
 */
export function createFirstPartyDeepSeekV4ProDirectAdapter(
  config: FirstPartyDeepSeekV4ProDirectConfig,
  wireCapability: Phase697V7WireCapability,
  dependencies: FirstPartyDeepSeekV4ProDirectDependencies = DEFAULT_DEPENDENCIES,
): FirstPartyDeepSeekV4ProDirectAdapter {
  const normalized = normalizeConfig(config);
  const resolvedDependencies = normalizeDependencies(dependencies);
  if (!claimPhase697V7WireCapability(wireCapability)) throw new Error(INVALID_CONFIG);

  const executor: StructuredModelExecutor = async (input) => {
    try {
      return await executeDirect({
        config: normalized,
        input,
        wireCapability,
        delegate: resolvedDependencies.fetch,
      });
    } catch (error) {
      const requestedCategory =
        error instanceof DirectAdapterFailure
          ? error.category
          : (readPhase697V7WireSnapshot(wireCapability)?.failureCategory ?? 'unknown');
      try {
        await failPhase697V7Wire(wireCapability, requestedCategory);
      } catch {
        try {
          await failPhase697V7Wire(wireCapability, 'harness_internal');
        } catch {
          // The fixed unknown projection below is still safe if the capability was lost.
        }
      }
      const terminalCategory =
        readPhase697V7WireSnapshot(wireCapability)?.failureCategory ?? 'unknown';
      const scope = readFailureScope(input);
      throw createTrustedFirstPartyModelAgentProviderFailureSignal(
        scope,
        projectPhase697V7WireFailure(terminalCategory),
      );
    }
  };

  return Object.freeze({
    version: FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_ADAPTER_VERSION,
    provenance:
      dependencies === DEFAULT_DEPENDENCIES
        ? 'first_party_deepseek_v4_pro_direct'
        : 'synthetic_test',
    executor,
  });
}

async function executeDirect(input: {
  config: FirstPartyDeepSeekV4ProDirectConfig;
  input: Parameters<StructuredModelExecutor>[0];
  wireCapability: Phase697V7WireCapability;
  delegate: typeof fetch;
}) {
  await advanceOrStop(input.wireCapability, 'executor_entered');
  const request = normalizeExecutorInput(input.input);
  await advanceOrStop(input.wireCapability, 'request_validated');
  const abortObservation = observeAbort(request.signal, input.wireCapability);

  try {
    await abortObservation.flush();
    const init: RequestInit = {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: input.config.model,
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
        max_tokens: request.maxOutputTokens,
        stream: false,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
      }),
      signal: request.signal,
    };

    await advanceOrStop(input.wireCapability, 'provider_dispatch_started');
    await abortObservation.flush();
    let response: unknown;
    try {
      response = await input.delegate(DEEPSEEK_V4_PRO_NONTHINKING_COMPLETIONS_URL, init);
    } catch {
      throwCurrentTerminalIfPresent(input.wireCapability);
      throw new DirectAdapterFailure('transport');
    }
    if (!isResponse(response)) throw new DirectAdapterFailure('invalid_response');
    await advanceOrStop(input.wireCapability, 'provider_response_received');

    const status = readResponseStatus(response);
    if (status === null) throw new DirectAdapterFailure('invalid_response');
    const httpFailure = classifyHttpStatus(status);
    if (httpFailure) throw new DirectAdapterFailure(httpFailure);

    const payload = await readResponsePayload(response, input.wireCapability);
    if (!isPlainRecord(payload)) throw new DirectAdapterFailure('invalid_response');
    if (!passesNonThinkingAudit(payload)) throw new DirectAdapterFailure('response_audit');
    await advanceOrStop(input.wireCapability, 'response_audit_passed');

    const content = readCompletionContent(payload);
    if (content === null) throw new DirectAdapterFailure('provider_object_missing');
    const parsedContent = parseCompletionContent(content, request.schema);
    await advanceOrStop(input.wireCapability, 'content_parsed');

    const parsedSchema = parseSchema(request, parsedContent);
    await advanceOrStop(input.wireCapability, 'schema_validated');

    const usage = readPositiveUsage(payload);
    if (!usage) throw new DirectAdapterFailure('usage_validation');
    await advanceOrStop(input.wireCapability, 'usage_validated');
    if (!(await completePhase697V7Wire(input.wireCapability))) {
      throw currentTerminalFailure(input.wireCapability);
    }
    return { object: parsedSchema, usage };
  } finally {
    abortObservation.dispose();
  }
}

function normalizeConfig(config: unknown): FirstPartyDeepSeekV4ProDirectConfig {
  try {
    const values = readExactOwnDataValues(config, CONFIG_KEYS);
    if (!values) throw new Error();
    const apiKey = values.apiKey;
    if (
      values.provider !== 'deepseek' ||
      !isValidCredential(apiKey) ||
      values.baseURL !== DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL ||
      values.model !== DEEPSEEK_V4_PRO_NONTHINKING_MODEL
    ) {
      throw new Error();
    }
    return Object.freeze({
      provider: 'deepseek',
      apiKey,
      baseURL: DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL,
      model: DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
    });
  } catch {
    throw new Error(INVALID_CONFIG);
  }
}

function normalizeDependencies(dependencies: unknown): FirstPartyDeepSeekV4ProDirectDependencies {
  try {
    if (dependencies === DEFAULT_DEPENDENCIES) return DEFAULT_DEPENDENCIES;
    const values = readExactOwnDataValues(dependencies, ['fetch']);
    if (!values || typeof values.fetch !== 'function') throw new Error();
    return Object.freeze({ fetch: values.fetch as typeof fetch });
  } catch {
    throw new Error(INVALID_CONFIG);
  }
}

function normalizeExecutorInput(input: unknown): NormalizedExecutorInput {
  try {
    const values = readExactOwnDataValues(input, EXECUTOR_INPUT_KEYS);
    if (!values) throw new Error();
    const schema = values.schema as Record<string, unknown>;
    if (
      (typeof schema !== 'object' && typeof schema !== 'function') ||
      schema === null ||
      typeof schema.safeParse !== 'function' ||
      typeof values.systemPrompt !== 'string' ||
      typeof values.userPrompt !== 'string' ||
      !Number.isSafeInteger(values.maxOutputTokens) ||
      (values.maxOutputTokens as number) <= 0 ||
      !isAbortSignal(values.signal)
    ) {
      throw new Error();
    }
    return {
      schema: values.schema as NormalizedExecutorInput['schema'],
      systemPrompt: values.systemPrompt,
      userPrompt: values.userPrompt,
      maxOutputTokens: values.maxOutputTokens as number,
      signal: values.signal,
    };
  } catch {
    throw new DirectAdapterFailure('request_contract');
  }
}

async function advanceOrStop(
  capability: Phase697V7WireCapability,
  stage: Parameters<typeof advancePhase697V7WireStage>[1],
) {
  if (!(await advancePhase697V7WireStage(capability, stage))) {
    throw currentTerminalFailure(capability);
  }
}

async function readResponsePayload(
  response: Response,
  capability: Phase697V7WireCapability,
): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throwCurrentTerminalIfPresent(capability);
    if (error instanceof DirectAdapterFailure) throw error;
    throw new DirectAdapterFailure('invalid_response');
  }
}

function readResponseStatus(response: Response): number | null {
  try {
    const status = response.status;
    return Number.isSafeInteger(status) && status >= 100 && status <= 599 ? status : null;
  } catch {
    return null;
  }
}

function classifyHttpStatus(status: number): Phase697V7WireFailureCategory | null {
  if (status >= 200 && status <= 299) return null;
  if (status === 401 || status === 403) return 'http_auth';
  if (status === 429) return 'http_rate_limit';
  if (status >= 400 && status <= 499) return 'http_client';
  if (status >= 500 && status <= 599) return 'http_server';
  return 'invalid_response';
}

function passesNonThinkingAudit(payload: Record<string, unknown>) {
  try {
    const choices = payload.choices;
    const first = readFirstArrayValue(choices);
    const message = isPlainRecord(first) && isPlainRecord(first.message) ? first.message : null;
    if (message && hasOwn(message, 'reasoning_content')) return false;
    const usage = payload.usage;
    if (!isPlainRecord(usage) || !hasOwn(usage, 'completion_tokens_details')) return true;
    const details = usage.completion_tokens_details;
    if (!isPlainRecord(details)) return false;
    if (!hasOwn(details, 'reasoning_tokens')) return true;
    return details.reasoning_tokens === 0;
  } catch {
    return false;
  }
}

function readCompletionContent(payload: Record<string, unknown>): string | null {
  try {
    const choices = payload.choices;
    if (!Array.isArray(choices) || choices.length !== 1) return null;
    const first = choices[0] as unknown;
    if (!isPlainRecord(first) || !isPlainRecord(first.message)) return null;
    return typeof first.message.content === 'string' ? first.message.content : null;
  } catch {
    return null;
  }
}

function parseCompletionContent(content: string, schema: unknown): unknown {
  try {
    const candidate = requiresModelAgentStrictJsonContent(schema)
      ? content
      : content.startsWith('```')
        ? readExactFencedPayload(content)
        : content;
    return JSON.parse(candidate);
  } catch {
    throw new DirectAdapterFailure('provider_json_parse');
  }
}

function readExactFencedPayload(content: string) {
  const match = EXACT_JSON_FENCE.exec(content);
  if (!match || match.length !== 2) throw new Error();
  return match[1];
}

function parseSchema(input: NormalizedExecutorInput, value: unknown): unknown {
  try {
    const parsed = input.schema.safeParse(value);
    if (!parsed.success) throw new Error();
    return parsed.data;
  } catch {
    throw new DirectAdapterFailure('provider_type_validation');
  }
}

function readPositiveUsage(payload: Record<string, unknown>): SafeUsage | null {
  try {
    if (!isPlainRecord(payload.usage)) return null;
    const inputTokens = payload.usage.prompt_tokens;
    const outputTokens = payload.usage.completion_tokens;
    if (!isPositiveSafeInteger(inputTokens) || !isPositiveSafeInteger(outputTokens)) return null;
    return Object.freeze({ inputTokens, outputTokens });
  } catch {
    return null;
  }
}

function currentTerminalFailure(capability: Phase697V7WireCapability) {
  return new DirectAdapterFailure(
    readPhase697V7WireSnapshot(capability)?.failureCategory ?? 'unknown',
  );
}

function throwCurrentTerminalIfPresent(capability: Phase697V7WireCapability) {
  const snapshot = readPhase697V7WireSnapshot(capability);
  if (snapshot?.state === 'failed') throw currentTerminalFailure(capability);
}

function observeAbort(signal: AbortSignal, capability: Phase697V7WireCapability) {
  let transition: Promise<boolean> | null = null;
  let listening = false;
  const onAbort = () => {
    if (transition) return;
    transition = abortPhase697V7Wire(capability);
    void transition.catch(() => undefined);
  };

  try {
    signal.addEventListener('abort', onAbort, { once: true });
    listening = true;
    if (signal.aborted) onAbort();
  } catch {
    if (listening) {
      try {
        signal.removeEventListener('abort', onAbort);
      } catch {
        // A hostile signal cannot retain provider-controlled data in diagnostics.
      }
    }
    throw new DirectAdapterFailure('unknown');
  }

  return Object.freeze({
    async flush() {
      if (!transition) return;
      try {
        await transition;
      } catch {
        // The reducer owns the safe terminal category.
      }
      throw currentTerminalFailure(capability);
    },
    dispose() {
      if (!listening) return;
      listening = false;
      try {
        signal.removeEventListener('abort', onAbort);
      } catch {
        // Listener cleanup is best effort after the reducer has frozen terminal state.
      }
    },
  });
}

function readFailureScope(input: unknown): AbortSignal {
  try {
    const values = readExactOwnDataValues(input, EXECUTOR_INPUT_KEYS);
    if (!values || !isAbortSignal(values.signal)) return FALLBACK_SCOPE;
    return values.signal;
  } catch {
    return FALLBACK_SCOPE;
  }
}

function isResponse(value: unknown): value is Response {
  try {
    return value instanceof Response;
  } catch {
    return false;
  }
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  } catch {
    return false;
  }
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function readExactOwnDataValues(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (!isPlainRecord(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) {
      return null;
    }
    const values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return null;
      values[key] = descriptor.value;
    }
    return values;
  } catch {
    return null;
  }
}

function isValidCredential(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= MAX_CREDENTIAL_LENGTH &&
    value === value.trim() &&
    VISIBLE_ASCII.test(value)
  );
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function readFirstArrayValue(value: unknown): unknown {
  return Array.isArray(value) ? (value as readonly unknown[])[0] : undefined;
}

class DirectAdapterFailure extends Error {
  readonly category: Phase697V7WireFailureCategory;

  constructor(category: Phase697V7WireFailureCategory) {
    super(ADAPTER_FAILURE);
    this.name = 'FirstPartyDeepSeekV4ProDirectFailure';
    this.category = category;
  }
}
