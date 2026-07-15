import type {
  ModelAgentBudgetErrorCode,
  ModelAgentRunBudget,
} from './model-agent-contract.ts';

type ModelAgentBudgetLimits = {
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
};

type ModelAgentBudgetReservation = {
  inputTokens: number;
  outputTokens: number;
};

export type ModelAgentBudgetReservationResult =
  | { ok: true; budget: ModelAgentRunBudget }
  | { ok: false; code: ModelAgentBudgetErrorCode };

export function createModelAgentBudget(limits: ModelAgentBudgetLimits): ModelAgentRunBudget {
  if (
    !isPositiveInteger(limits.maxCalls) ||
    !isPositiveInteger(limits.maxInputTokens) ||
    !isPositiveInteger(limits.maxOutputTokens)
  ) {
    throw new Error('INVALID_MODEL_AGENT_BUDGET');
  }

  return {
    ...limits,
    usedCalls: 0,
    usedInputTokens: 0,
    usedOutputTokens: 0,
  };
}

export function reserveModelAgentBudget(
  budget: ModelAgentRunBudget,
  reservation: ModelAgentBudgetReservation,
): ModelAgentBudgetReservationResult {
  if (
    !isModelAgentRunBudget(budget) ||
    !isNonNegativeInteger(reservation.inputTokens) ||
    !isNonNegativeInteger(reservation.outputTokens)
  ) {
    return { ok: false, code: 'INVALID_MODEL_AGENT_BUDGET' };
  }
  if (1 > budget.maxCalls - budget.usedCalls) {
    return { ok: false, code: 'CALL_BUDGET_EXCEEDED' };
  }
  if (reservation.inputTokens > budget.maxInputTokens - budget.usedInputTokens) {
    return { ok: false, code: 'INPUT_BUDGET_EXCEEDED' };
  }
  if (reservation.outputTokens > budget.maxOutputTokens - budget.usedOutputTokens) {
    return { ok: false, code: 'OUTPUT_BUDGET_EXCEEDED' };
  }

  return {
    ok: true,
    budget: {
      ...budget,
      usedCalls: budget.usedCalls + 1,
      usedInputTokens: budget.usedInputTokens + reservation.inputTokens,
      usedOutputTokens: budget.usedOutputTokens + reservation.outputTokens,
    },
  };
}

export function isModelAgentRunBudget(budget: unknown): budget is ModelAgentRunBudget {
  if (typeof budget !== 'object' || budget === null) return false;
  const candidate = budget as Record<string, unknown>;
  return (
    isPositiveInteger(candidate.maxCalls) &&
    isNonNegativeInteger(candidate.usedCalls) &&
    candidate.usedCalls <= candidate.maxCalls &&
    isPositiveInteger(candidate.maxInputTokens) &&
    isNonNegativeInteger(candidate.usedInputTokens) &&
    candidate.usedInputTokens <= candidate.maxInputTokens &&
    isPositiveInteger(candidate.maxOutputTokens) &&
    isNonNegativeInteger(candidate.usedOutputTokens) &&
    candidate.usedOutputTokens <= candidate.maxOutputTokens
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
