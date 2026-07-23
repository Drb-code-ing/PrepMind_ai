import {
  createModelAgentBudget,
  isModelAgentRunBudget,
  reserveModelAgentBudget,
  type ModelAgentRunBudget,
  type OpenAICompatibleExecutorConfig,
} from '@repo/ai';

export const WRONG_QUESTION_ORGANIZER_MODEL = 'deepseek-v4-pro';
export const WRONG_QUESTION_ORGANIZER_MODEL_BASE_URL =
  'https://api.deepseek.com/v1';
export const WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION =
  'wrong-question-organizer-model-candidate-v1';

export const WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET: ModelAgentRunBudget =
  Object.freeze({
    maxCalls: 1,
    usedCalls: 0,
    maxInputTokens: 3_500,
    usedInputTokens: 0,
    maxOutputTokens: 800,
    usedOutputTokens: 0,
  });

export const WRONG_QUESTION_ORGANIZER_RESERVATION = Object.freeze({
  inputTokens: 3_500,
  outputTokens: 800,
});

export const WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY = Object.freeze({
  model: WRONG_QUESTION_ORGANIZER_MODEL,
  inputPerMillion: 3,
  outputPerMillion: 6,
  requestCap: 0.016,
});

const DEFAULT_TIMEOUT_MS = 5_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 15_000;

export type WrongQuestionOrganizerModelConfig = Readonly<{
  enabled: boolean;
  timeoutMs: number;
  mode: 'mock' | 'live';
  provider: 'mock' | 'deepseek';
  model: typeof WRONG_QUESTION_ORGANIZER_MODEL;
  promptVersion: typeof WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION;
  pricingKnown: boolean;
}>;

export type WrongQuestionOrganizerCandidateBudgetReservation = Readonly<{
  requestBudget: ModelAgentRunBudget;
  candidateBudget: ModelAgentRunBudget;
}>;

export function resolveWrongQuestionOrganizerModelConfig(
  input: Record<string, unknown>,
  priceProfile: unknown = WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY,
): WrongQuestionOrganizerModelConfig {
  try {
    return resolveConfigUnchecked(input, priceProfile);
  } catch {
    return disabledConfig(false);
  }
}

/** Private server composition input. Never serialize the returned API key. */
export function resolveWrongQuestionOrganizerLiveExecutorConfig(
  input: Record<string, unknown>,
  priceProfile: unknown = WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY,
): OpenAICompatibleExecutorConfig | null {
  try {
    const config = resolveConfigUnchecked(input, priceProfile);
    const apiKey = readNonEmptyString(
      input.WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY,
    );
    const baseURL = readNonEmptyString(input.AI_BASE_URL);
    if (
      !config.enabled ||
      config.mode !== 'live' ||
      config.provider !== 'deepseek' ||
      apiKey === null ||
      baseURL !== WRONG_QUESTION_ORGANIZER_MODEL_BASE_URL
    ) {
      return null;
    }
    return {
      provider: 'deepseek',
      apiKey,
      baseURL,
      model: WRONG_QUESTION_ORGANIZER_MODEL,
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    };
  } catch {
    return null;
  }
}

export function reserveWrongQuestionOrganizerCandidateBudget(
  input: ModelAgentRunBudget = WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET,
): WrongQuestionOrganizerCandidateBudgetReservation | null {
  try {
    if (!isModelAgentRunBudget(input)) return null;
    const requestBudget = Object.freeze({ ...input });
    const reservation = reserveModelAgentBudget(
      requestBudget,
      WRONG_QUESTION_ORGANIZER_RESERVATION,
    );
    if (!reservation.ok) return null;
    return Object.freeze({
      requestBudget: freezeBudget(reservation.budget),
      candidateBudget: freezeBudget(
        createModelAgentBudget({
          maxCalls: 1,
          maxInputTokens: WRONG_QUESTION_ORGANIZER_RESERVATION.inputTokens,
          maxOutputTokens: WRONG_QUESTION_ORGANIZER_RESERVATION.outputTokens,
        }),
      ),
    });
  } catch {
    return null;
  }
}

export function estimateWrongQuestionOrganizerRequestCostCny(
  usage: { inputTokens: number; outputTokens: number },
  priceProfile: unknown = WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY,
): number | null {
  try {
    if (
      !isExactPriceProfile(priceProfile) ||
      !isPositiveSafeInteger(usage.inputTokens) ||
      !isPositiveSafeInteger(usage.outputTokens) ||
      usage.inputTokens >
        WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET.maxInputTokens ||
      usage.outputTokens >
        WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET.maxOutputTokens
    ) {
      return null;
    }
    const cost =
      (usage.inputTokens * priceProfile.inputPerMillion) / 1_000_000 +
      (usage.outputTokens * priceProfile.outputPerMillion) / 1_000_000;
    const canonicalCost = Number(cost.toFixed(12));
    return canonicalCost > 0 && canonicalCost <= priceProfile.requestCap
      ? canonicalCost
      : null;
  } catch {
    return null;
  }
}

function resolveConfigUnchecked(
  input: Record<string, unknown>,
  priceProfile: unknown,
): WrongQuestionOrganizerModelConfig {
  const pricingKnown = isExactPriceProfile(priceProfile);
  const enabled =
    input.AI_PROVIDER_MODE === 'live' &&
    asBoolean(input.AI_ENABLE_LIVE_CALLS) &&
    asBoolean(input.WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED) &&
    readNonEmptyString(input.AI_BASE_URL) ===
      WRONG_QUESTION_ORGANIZER_MODEL_BASE_URL &&
    readNonEmptyString(
      input.WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY,
    ) !== null &&
    pricingKnown;
  return Object.freeze({
    enabled,
    timeoutMs: resolveTimeout(
      input.WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS,
    ),
    mode: enabled ? 'live' : 'mock',
    provider: enabled ? 'deepseek' : 'mock',
    model: WRONG_QUESTION_ORGANIZER_MODEL,
    promptVersion: WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION,
    pricingKnown,
  });
}

function disabledConfig(
  pricingKnown: boolean,
): WrongQuestionOrganizerModelConfig {
  return Object.freeze({
    enabled: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    mode: 'mock',
    provider: 'mock',
    model: WRONG_QUESTION_ORGANIZER_MODEL,
    promptVersion: WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION,
    pricingKnown,
  });
}

function isExactPriceProfile(
  value: unknown,
): value is typeof WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY {
  try {
    if (!isRecord(value)) return false;
    return (
      value.model === WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY.model &&
      value.inputPerMillion ===
        WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY.inputPerMillion &&
      value.outputPerMillion ===
        WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY.outputPerMillion &&
      value.requestCap ===
        WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY.requestCap &&
      Object.keys(value).length ===
        Object.keys(WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY).length
    );
  } catch {
    return false;
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function freezeBudget(budget: ModelAgentRunBudget): ModelAgentRunBudget {
  return Object.freeze({ ...budget });
}
