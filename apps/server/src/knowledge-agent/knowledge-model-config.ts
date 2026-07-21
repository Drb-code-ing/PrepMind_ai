import {
  createModelAgentBudget,
  isModelAgentRunBudget,
  reserveModelAgentBudget,
  type ModelAgentRunBudget,
  type OpenAICompatibleExecutorConfig,
} from '@repo/ai';

export const KNOWLEDGE_MODEL = 'deepseek-v4-pro';
export const KNOWLEDGE_MODEL_BASE_URL = 'https://api.deepseek.com/v1';
export const KNOWLEDGE_MODEL_PROMPT_VERSION = 'knowledge-agents-v1';

export const KNOWLEDGE_REQUEST_BUDGET: ModelAgentRunBudget = Object.freeze({
  maxCalls: 2,
  usedCalls: 0,
  maxInputTokens: 6000,
  usedInputTokens: 0,
  maxOutputTokens: 1200,
  usedOutputTokens: 0,
});

export const KNOWLEDGE_DEDUP_RESERVATION = Object.freeze({
  inputTokens: 3000,
  outputTokens: 500,
});

export const KNOWLEDGE_ORGANIZER_RESERVATION = Object.freeze({
  inputTokens: 3000,
  outputTokens: 700,
});

export const KNOWLEDGE_MODEL_PRICE_CNY = Object.freeze({
  model: KNOWLEDGE_MODEL,
  inputPerMillion: 3,
  outputPerMillion: 6,
  requestCap: 0.03,
});

const DEFAULT_TIMEOUT_MS = 4500;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 15_000;

export type KnowledgeModelConfig = Readonly<{
  dedupEnabled: boolean;
  organizerEnabled: boolean;
  dedupTimeoutMs: number;
  organizerTimeoutMs: number;
  mode: 'mock' | 'live';
  provider: 'mock' | 'deepseek';
  model: typeof KNOWLEDGE_MODEL;
  promptVersion: typeof KNOWLEDGE_MODEL_PROMPT_VERSION;
  pricingKnown: boolean;
}>;

export type KnowledgeCandidateBudgetReservations = Readonly<{
  requestBudget: ModelAgentRunBudget;
  dedupBudget: ModelAgentRunBudget;
  organizerBudget: ModelAgentRunBudget;
}>;

export function resolveKnowledgeModelConfig(
  input: Record<string, unknown>,
  priceProfile: unknown = KNOWLEDGE_MODEL_PRICE_CNY,
): KnowledgeModelConfig {
  try {
    return resolveKnowledgeModelConfigUnchecked(input, priceProfile);
  } catch {
    return disabledKnowledgeModelConfig(false);
  }
}

function resolveKnowledgeModelConfigUnchecked(
  input: Record<string, unknown>,
  priceProfile: unknown,
): KnowledgeModelConfig {
  const pricingKnown = isExactKnowledgePriceProfile(priceProfile);
  const liveEligible =
    input.AI_PROVIDER_MODE === 'live' &&
    asBoolean(input.AI_ENABLE_LIVE_CALLS) &&
    readNonEmptyString(input.AI_BASE_URL) === KNOWLEDGE_MODEL_BASE_URL &&
    readNonEmptyString(input.DEEPSEEK_API_KEY) !== null &&
    pricingKnown;
  const dedupEnabled =
    liveEligible && asBoolean(input.KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED);
  const organizerEnabled =
    liveEligible && asBoolean(input.KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED);
  const enabled = dedupEnabled || organizerEnabled;

  return Object.freeze({
    dedupEnabled,
    organizerEnabled,
    dedupTimeoutMs: resolveTimeout(
      input.KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS,
    ),
    organizerTimeoutMs: resolveTimeout(
      input.KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS,
    ),
    mode: enabled ? 'live' : 'mock',
    provider: enabled ? 'deepseek' : 'mock',
    model: KNOWLEDGE_MODEL,
    promptVersion: KNOWLEDGE_MODEL_PROMPT_VERSION,
    pricingKnown,
  });
}

/** Private server composition input. Never serialize the returned API key. */
export function resolveKnowledgeLiveExecutorConfig(
  input: Record<string, unknown>,
  priceProfile: unknown = KNOWLEDGE_MODEL_PRICE_CNY,
): OpenAICompatibleExecutorConfig | null {
  try {
    const config = resolveKnowledgeModelConfigUnchecked(input, priceProfile);
    const apiKey = readNonEmptyString(input.DEEPSEEK_API_KEY);
    const baseURL = readNonEmptyString(input.AI_BASE_URL);
    if (
      config.mode !== 'live' ||
      config.provider !== 'deepseek' ||
      apiKey === null ||
      baseURL !== KNOWLEDGE_MODEL_BASE_URL
    ) {
      return null;
    }
    return {
      provider: 'deepseek',
      apiKey,
      baseURL,
      model: KNOWLEDGE_MODEL,
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    };
  } catch {
    return null;
  }
}

export function reserveKnowledgeCandidateBudgets(
  input: ModelAgentRunBudget = KNOWLEDGE_REQUEST_BUDGET,
): KnowledgeCandidateBudgetReservations | null {
  try {
    if (!isModelAgentRunBudget(input)) return null;
    const requestBudget = Object.freeze({ ...input });
    const dedupReservation = reserveModelAgentBudget(
      requestBudget,
      KNOWLEDGE_DEDUP_RESERVATION,
    );
    if (!dedupReservation.ok) return null;
    const organizerReservation = reserveModelAgentBudget(
      dedupReservation.budget,
      KNOWLEDGE_ORGANIZER_RESERVATION,
    );
    if (!organizerReservation.ok) return null;

    return Object.freeze({
      requestBudget: Object.freeze({ ...organizerReservation.budget }),
      dedupBudget: freezeBudget(
        createModelAgentBudget({
          maxCalls: 1,
          maxInputTokens: KNOWLEDGE_DEDUP_RESERVATION.inputTokens,
          maxOutputTokens: KNOWLEDGE_DEDUP_RESERVATION.outputTokens,
        }),
      ),
      organizerBudget: freezeBudget(
        createModelAgentBudget({
          maxCalls: 1,
          maxInputTokens: KNOWLEDGE_ORGANIZER_RESERVATION.inputTokens,
          maxOutputTokens: KNOWLEDGE_ORGANIZER_RESERVATION.outputTokens,
        }),
      ),
    });
  } catch {
    return null;
  }
}

export function estimateKnowledgeRequestCostCny(
  usage: { inputTokens: number; outputTokens: number },
  priceProfile: unknown = KNOWLEDGE_MODEL_PRICE_CNY,
): number | null {
  try {
    if (
      !isExactKnowledgePriceProfile(priceProfile) ||
      !isNonNegativeSafeInteger(usage.inputTokens) ||
      !isNonNegativeSafeInteger(usage.outputTokens) ||
      usage.inputTokens > KNOWLEDGE_REQUEST_BUDGET.maxInputTokens ||
      usage.outputTokens > KNOWLEDGE_REQUEST_BUDGET.maxOutputTokens
    ) {
      return null;
    }
    const cost =
      (usage.inputTokens * priceProfile.inputPerMillion) / 1_000_000 +
      (usage.outputTokens * priceProfile.outputPerMillion) / 1_000_000;
    return cost <= priceProfile.requestCap ? cost : null;
  } catch {
    return null;
  }
}

function isExactKnowledgePriceProfile(
  value: unknown,
): value is typeof KNOWLEDGE_MODEL_PRICE_CNY {
  try {
    if (!isRecord(value)) return false;
    return (
      value.model === KNOWLEDGE_MODEL_PRICE_CNY.model &&
      value.inputPerMillion === KNOWLEDGE_MODEL_PRICE_CNY.inputPerMillion &&
      value.outputPerMillion === KNOWLEDGE_MODEL_PRICE_CNY.outputPerMillion &&
      value.requestCap === KNOWLEDGE_MODEL_PRICE_CNY.requestCap &&
      Object.keys(value).length ===
        Object.keys(KNOWLEDGE_MODEL_PRICE_CNY).length
    );
  } catch {
    return false;
  }
}

function disabledKnowledgeModelConfig(
  pricingKnown: boolean,
): KnowledgeModelConfig {
  return Object.freeze({
    dedupEnabled: false,
    organizerEnabled: false,
    dedupTimeoutMs: DEFAULT_TIMEOUT_MS,
    organizerTimeoutMs: DEFAULT_TIMEOUT_MS,
    mode: 'mock',
    provider: 'mock',
    model: KNOWLEDGE_MODEL,
    promptVersion: KNOWLEDGE_MODEL_PROMPT_VERSION,
    pricingKnown,
  });
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

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function freezeBudget(budget: ModelAgentRunBudget): ModelAgentRunBudget {
  return Object.freeze({ ...budget });
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
