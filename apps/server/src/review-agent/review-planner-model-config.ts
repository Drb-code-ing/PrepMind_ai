import type { OpenAICompatibleExecutorConfig } from '@repo/ai';

const DEFAULT_MODEL = 'deepseek-v4-flash';
const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const DEEPSEEK_V4_PRO_MODEL = 'deepseek-v4-pro';
const DEEPSEEK_V4_PRO_BASE_URL = 'https://api.deepseek.com/v1';
const FORBIDDEN_TRANSPORT_INPUT_KEYS = [
  'schemaProfiles',
  'onNonThinkingAudit',
] as const;
const DEFAULT_TIMEOUT_MS = 4_500;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 15_000;

const ENV_KEYS = [
  'AI_PROVIDER_MODE',
  'AI_ENABLE_LIVE_CALLS',
  'REVIEW_AGENT_MODEL_ENABLED',
  'PLANNER_AGENT_MODEL_ENABLED',
  'AI_MODEL',
  'AI_BASE_URL',
  'DEEPSEEK_API_KEY',
  'OPENAI_API_KEY',
  'REVIEW_AGENT_MODEL_TIMEOUT_MS',
  'PLANNER_AGENT_MODEL_TIMEOUT_MS',
] as const;

type ReviewPlannerEnvKey = (typeof ENV_KEYS)[number];
type ReviewPlannerProvider = 'deepseek' | 'openai';
type AllowlistedReviewPlannerEnv = Record<ReviewPlannerEnvKey, unknown>;

export type ReviewPlannerModelConfig = Readonly<{
  reviewEnabled: boolean;
  plannerEnabled: boolean;
  reviewTimeoutMs: number;
  plannerTimeoutMs: number;
  mode: 'mock' | 'live';
  provider: 'mock' | ReviewPlannerProvider;
  model: string;
}>;

export function resolveReviewPlannerModelConfig(
  input: Record<string, unknown>,
): ReviewPlannerModelConfig {
  const env = readAllowlistedEnv(input);
  const live = hasForbiddenTransportInput(input)
    ? null
    : resolveLiveExecutorConfig(env);
  const reviewEnabled =
    live !== null && asBoolean(env.REVIEW_AGENT_MODEL_ENABLED);
  const plannerEnabled =
    live !== null && asBoolean(env.PLANNER_AGENT_MODEL_ENABLED);
  const enabled = reviewEnabled || plannerEnabled;

  return {
    reviewEnabled,
    plannerEnabled,
    reviewTimeoutMs: resolveTimeout(env.REVIEW_AGENT_MODEL_TIMEOUT_MS),
    plannerTimeoutMs: resolveTimeout(env.PLANNER_AGENT_MODEL_TIMEOUT_MS),
    mode: enabled ? 'live' : 'mock',
    provider: enabled ? live.provider : 'mock',
    model: enabled ? live.model : 'disabled-review-planner',
  };
}

/** Private composition input. It must never be serialized or returned from an API. */
export function resolveReviewPlannerLiveExecutorConfig(
  input: Record<string, unknown>,
): OpenAICompatibleExecutorConfig | null {
  if (hasForbiddenTransportInput(input)) return null;
  return resolveLiveExecutorConfig(readAllowlistedEnv(input));
}

function readAllowlistedEnv(
  input: Record<string, unknown>,
): AllowlistedReviewPlannerEnv {
  const env = {} as AllowlistedReviewPlannerEnv;
  for (const key of ENV_KEYS) env[key] = input[key];
  return env;
}

function resolveLiveExecutorConfig(
  env: AllowlistedReviewPlannerEnv,
): OpenAICompatibleExecutorConfig | null {
  if (
    trim(env.AI_PROVIDER_MODE) !== 'live' ||
    !asBoolean(env.AI_ENABLE_LIVE_CALLS)
  ) {
    return null;
  }

  const model = trim(env.AI_MODEL) ?? DEFAULT_MODEL;
  const baseURL = trim(env.AI_BASE_URL) ?? DEFAULT_BASE_URL;
  if (!isSafeModelName(model) || !isAllowlistedSafeHttpsBaseUrl(baseURL)) {
    return null;
  }
  const provider = resolveProvider({
    baseURL,
    deepseekKey: trim(env.DEEPSEEK_API_KEY),
    openaiKey: trim(env.OPENAI_API_KEY),
  });
  if (!provider) return null;

  if (model === DEEPSEEK_V4_PRO_MODEL) {
    if (provider.name !== 'deepseek' || baseURL !== DEEPSEEK_V4_PRO_BASE_URL) {
      return null;
    }
    return {
      provider: 'deepseek',
      apiKey: provider.apiKey,
      baseURL: DEEPSEEK_V4_PRO_BASE_URL,
      model: DEEPSEEK_V4_PRO_MODEL,
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    };
  }

  return {
    provider: provider.name,
    apiKey: provider.apiKey,
    baseURL,
    model,
    structuredOutputMode: 'json_object',
  };
}

function hasForbiddenTransportInput(input: Record<string, unknown>): boolean {
  return FORBIDDEN_TRANSPORT_INPUT_KEYS.some((key) =>
    Object.hasOwn(input, key),
  );
}

function resolveProvider(input: {
  baseURL: string;
  deepseekKey: string | undefined;
  openaiKey: string | undefined;
}): { name: ReviewPlannerProvider; apiKey: string } | null {
  let hostname: string;
  try {
    hostname = new URL(input.baseURL).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (hostname === 'deepseek.com' || hostname.endsWith('.deepseek.com')) {
    return input.deepseekKey
      ? { name: 'deepseek', apiKey: input.deepseekKey }
      : null;
  }
  if (hostname === 'openai.com' || hostname.endsWith('.openai.com')) {
    return input.openaiKey ? { name: 'openai', apiKey: input.openaiKey } : null;
  }
  return null;
}

function resolveTimeout(value: unknown): number {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(numeric) &&
    numeric >= MIN_TIMEOUT_MS &&
    numeric <= MAX_TIMEOUT_MS
    ? numeric
    : DEFAULT_TIMEOUT_MS;
}

function asBoolean(value: unknown): boolean {
  return (
    value === true ||
    (typeof value === 'string' && value.toLowerCase() === 'true')
  );
}

function trim(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isSafeModelName(value: string): boolean {
  return /^[A-Za-z0-9._:/-]{1,120}$/.test(value);
}

function isAllowlistedSafeHttpsBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (hostname === 'deepseek.com' ||
        hostname.endsWith('.deepseek.com') ||
        hostname === 'openai.com' ||
        hostname.endsWith('.openai.com'))
    );
  } catch {
    return false;
  }
}
