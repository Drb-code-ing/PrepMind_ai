export const DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL = 'https://api.deepseek.com/v1' as const;
export const DEEPSEEK_V4_PRO_NONTHINKING_MODEL = 'deepseek-v4-pro' as const;
export const DEEPSEEK_V4_PRO_NONTHINKING_COMPLETIONS_URL =
  'https://api.deepseek.com/v1/chat/completions' as const;

const REQUEST_INVALID = 'DEEPSEEK_V4_PRO_NONTHINKING_REQUEST_INVALID';
const RESPONSE_INVALID = 'DEEPSEEK_V4_PRO_NONTHINKING_RESPONSE_INVALID';
const FORBIDDEN_REQUEST_FIELDS = [
  'tools',
  'tool_choice',
  'functions',
  'function_call',
  'json_schema',
] as const;
type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

export type DeepSeekV4ProUsageState = 'missing' | 'invalid' | 'positive';

export type DeepSeekV4ProNonThinkingAudit =
  | Readonly<{
      reasoning: 'not_reported';
      reasoningContentPresent: boolean;
      usageState: DeepSeekV4ProUsageState;
    }>
  | Readonly<{
      reasoning: 'reported_zero';
      reasoningContentPresent: boolean;
      reportedReasoningTokens: 0;
      usageState: DeepSeekV4ProUsageState;
    }>
  | Readonly<{
      reasoning: 'reported_positive';
      reasoningContentPresent: boolean;
      reportedReasoningTokens: number;
      usageState: DeepSeekV4ProUsageState;
    }>
  | Readonly<{
      reasoning: 'invalid_detail';
      reasoningContentPresent: boolean;
      usageState: DeepSeekV4ProUsageState;
    }>;

/**
 * Returns a V4 Pro-only OpenAI-compatible fetch middleware. It validates the
 * outgoing JSON before the delegate boundary, injects one frozen provider
 * field, and reduces any response audit to non-content metadata only.
 */
export function createDeepSeekV4ProNonThinkingFetch(
  delegate: typeof fetch,
  onAudit?: (audit: DeepSeekV4ProNonThinkingAudit) => void,
): typeof fetch {
  if (typeof delegate !== 'function') {
    throw new Error(REQUEST_INVALID);
  }

  return async (input, init) => {
    const request = parseRequest(input, init);
    const response = await delegate(DEEPSEEK_V4_PRO_NONTHINKING_COMPLETIONS_URL, {
      ...init,
      method: 'POST',
      body: JSON.stringify({
        ...request,
        thinking: { type: 'disabled' },
      }),
    });
    const audit = Object.freeze(await auditResponse(response));
    try {
      onAudit?.(audit);
    } catch {
      throw new Error(RESPONSE_INVALID);
    }
    if (
      audit.reasoning === 'reported_positive' ||
      audit.reasoning === 'invalid_detail' ||
      audit.reasoningContentPresent
    ) {
      throw new Error(RESPONSE_INVALID);
    }
    return response;
  };
}

function parseRequest(input: FetchInput, init: FetchInit): Record<string, unknown> {
  try {
    if (!isExactCompletionsUrl(input) || init?.method !== 'POST') {
      throw new Error();
    }
    const body = init.body;
    if (typeof body !== 'string') throw new Error();
    const parsed: unknown = JSON.parse(body);
    if (!isPlainRecord(parsed)) throw new Error();
    if (parsed.model !== DEEPSEEK_V4_PRO_NONTHINKING_MODEL) throw new Error();
    if (!isExactJsonObjectResponseFormat(parsed.response_format)) {
      throw new Error();
    }
    if (hasOwn(parsed, 'thinking')) throw new Error();
    if (FORBIDDEN_REQUEST_FIELDS.some((field) => hasOwn(parsed, field))) {
      throw new Error();
    }
    return parsed;
  } catch {
    throw new Error(REQUEST_INVALID);
  }
}

function isExactCompletionsUrl(input: FetchInput) {
  return (
    (typeof input === 'string' || input instanceof URL) &&
    String(input) === DEEPSEEK_V4_PRO_NONTHINKING_COMPLETIONS_URL
  );
}

function isExactJsonObjectResponseFormat(value: unknown) {
  return isPlainRecord(value) && Object.keys(value).length === 1 && value.type === 'json_object';
}

async function auditResponse(response: Response): Promise<DeepSeekV4ProNonThinkingAudit> {
  try {
    const payload: unknown = await response.clone().json();
    const message = readFirstMessage(payload);
    const reasoningContentPresent = message !== undefined && hasOwn(message, 'reasoning_content');
    const detail = readReasoningTokenDetail(payload);
    const usageState = readUsageState(payload);
    if (detail === undefined) {
      return { reasoning: 'not_reported', reasoningContentPresent, usageState };
    }
    if (!isSafeTokenCount(detail)) {
      return { reasoning: 'invalid_detail', reasoningContentPresent, usageState };
    }
    return detail === 0
      ? {
          reasoning: 'reported_zero',
          reasoningContentPresent,
          reportedReasoningTokens: 0,
          usageState,
        }
      : {
          reasoning: 'reported_positive',
          reasoningContentPresent,
          reportedReasoningTokens: detail,
          usageState,
        };
  } catch {
    return {
      reasoning: 'not_reported',
      reasoningContentPresent: false,
      usageState: 'missing',
    };
  }
}

function readFirstMessage(payload: unknown): Record<string, unknown> | undefined {
  if (!isPlainRecord(payload) || !Array.isArray(payload.choices)) return undefined;
  const first = payload.choices[0] as unknown;
  return isPlainRecord(first) && isPlainRecord(first.message) ? first.message : undefined;
}

function readReasoningTokenDetail(payload: unknown): unknown {
  if (!isPlainRecord(payload) || !isPlainRecord(payload.usage)) return undefined;
  const detail = payload.usage.completion_tokens_details;
  return isPlainRecord(detail) ? detail.reasoning_tokens : undefined;
}

function readUsageState(payload: unknown): DeepSeekV4ProUsageState {
  if (!isPlainRecord(payload) || !isPlainRecord(payload.usage)) {
    return 'missing';
  }
  if (!hasOwn(payload.usage, 'prompt_tokens') || !hasOwn(payload.usage, 'completion_tokens')) {
    return 'missing';
  }
  return isPositiveSafeInteger(payload.usage.prompt_tokens) &&
    isPositiveSafeInteger(payload.usage.completion_tokens)
    ? 'positive'
    : 'invalid';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isSafeTokenCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
