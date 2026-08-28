export const CHAT_RESPONSE_WORKER_LOCK_MARGIN_MS = 30_000;
export const DEFAULT_CHAT_RESPONSE_GENERATION_TIMEOUT_MS = 120_000;
export const DEFAULT_CHAT_RESPONSE_WORKER_LOCK_DURATION_MS = 180_000;
export const DEFAULT_CHAT_RESPONSE_WORKER_CONCURRENCY = 2;

const MAX_CHAT_RESPONSE_GENERATION_TIMEOUT_MS = 600_000;
const MAX_CHAT_RESPONSE_WORKER_LOCK_DURATION_MS = 900_000;

export function resolveChatResponseWorkerConcurrency(
  rawValue = process.env.CHAT_RESPONSE_WORKER_CONCURRENCY,
) {
  return boundedInteger(
    rawValue,
    1,
    8,
    DEFAULT_CHAT_RESPONSE_WORKER_CONCURRENCY,
  );
}

export function resolveChatResponseGenerationTimeout(
  rawValue = process.env.CHAT_RESPONSE_GENERATION_TIMEOUT_MS,
) {
  return boundedInteger(
    rawValue,
    1_000,
    MAX_CHAT_RESPONSE_GENERATION_TIMEOUT_MS,
    DEFAULT_CHAT_RESPONSE_GENERATION_TIMEOUT_MS,
  );
}

export function resolveChatResponseWorkerLockDuration(
  rawValue = process.env.CHAT_RESPONSE_WORKER_LOCK_DURATION_MS,
  generationTimeoutMs = resolveChatResponseGenerationTimeout(),
) {
  const minimum = generationTimeoutMs + CHAT_RESPONSE_WORKER_LOCK_MARGIN_MS;
  const configured = integerValue(rawValue);
  if (configured === undefined) {
    return Math.min(
      MAX_CHAT_RESPONSE_WORKER_LOCK_DURATION_MS,
      Math.max(DEFAULT_CHAT_RESPONSE_WORKER_LOCK_DURATION_MS, minimum),
    );
  }
  return Math.min(
    MAX_CHAT_RESPONSE_WORKER_LOCK_DURATION_MS,
    Math.max(10_000, configured, minimum),
  );
}

function boundedInteger(
  rawValue: string | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  const value = integerValue(rawValue);
  return value !== undefined && value >= minimum && value <= maximum
    ? value
    : fallback;
}

function integerValue(rawValue: string | undefined) {
  const value = Number(rawValue);
  return Number.isSafeInteger(value) ? value : undefined;
}
