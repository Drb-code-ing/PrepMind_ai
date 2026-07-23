import { createModelAgentBudget, type ModelAgentRunBudget } from '@repo/ai';

export const TUTOR_MODEL = 'deepseek-v4-pro' as const;

export const TUTOR_MODEL_PRICE_CNY = Object.freeze({
  model: TUTOR_MODEL,
  inputPerMillion: 3,
  outputPerMillion: 6,
  requestCap: 0.006,
});

const TUTOR_REQUEST_LIMITS = Object.freeze({
  maxCalls: 1,
  maxInputTokens: 1_200,
  maxOutputTokens: 300,
});

export function createTutorModelBudget(): ModelAgentRunBudget {
  return createModelAgentBudget(TUTOR_REQUEST_LIMITS);
}

export function estimateTutorRequestCostCny(
  usage: { inputTokens: number; outputTokens: number },
  priceProfile: unknown = TUTOR_MODEL_PRICE_CNY,
): number | null {
  try {
    if (
      !isExactTutorPriceProfile(priceProfile) ||
      !isPositiveSafeInteger(usage.inputTokens) ||
      !isPositiveSafeInteger(usage.outputTokens) ||
      usage.inputTokens > TUTOR_REQUEST_LIMITS.maxInputTokens ||
      usage.outputTokens > TUTOR_REQUEST_LIMITS.maxOutputTokens
    ) {
      return null;
    }
    const rawCost =
      (usage.inputTokens * TUTOR_MODEL_PRICE_CNY.inputPerMillion) / 1_000_000 +
      (usage.outputTokens * TUTOR_MODEL_PRICE_CNY.outputPerMillion) / 1_000_000;
    const cost = Number(rawCost.toFixed(12));
    return cost <= TUTOR_MODEL_PRICE_CNY.requestCap ? cost : null;
  } catch {
    return null;
  }
}

export function isExactTutorPriceProfile(
  value: unknown,
): value is typeof TUTOR_MODEL_PRICE_CNY {
  try {
    if (typeof value !== 'object' || value === null) return false;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== 4 ||
      keys.some(
        (key) =>
          typeof key !== 'string' ||
          !['model', 'inputPerMillion', 'outputPerMillion', 'requestCap'].includes(key),
      )
    ) {
      return false;
    }
    return (
      readOwnData(value, 'model') === TUTOR_MODEL_PRICE_CNY.model &&
      readOwnData(value, 'inputPerMillion') === TUTOR_MODEL_PRICE_CNY.inputPerMillion &&
      readOwnData(value, 'outputPerMillion') === TUTOR_MODEL_PRICE_CNY.outputPerMillion &&
      readOwnData(value, 'requestCap') === TUTOR_MODEL_PRICE_CNY.requestCap
    );
  } catch {
    return false;
  }
}

function readOwnData(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value > 0;
}
