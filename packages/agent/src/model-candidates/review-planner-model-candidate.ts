import { z } from 'zod';

import {
  isModelAgentRunBudget,
  reserveModelAgentBudget,
  type ModelAgentErrorCode,
  type ModelAgentRequest,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
} from '@repo/ai';
import {
  plannerAgentResultSchema,
  reviewAgentResultSchema,
  type PlannerAgentResult,
  type ReviewAgentResult,
} from '@repo/types/api/review-agent';

import {
  ZERO_CANDIDATE_USAGE,
  canonicalCandidateReasonCodes,
  mapModelAgentErrorDisposition,
  prepareCandidateText,
  safeCandidateBudgetSnapshot,
  type ModelCandidateDisposition,
  type ModelCandidateObservation,
} from './model-candidate-policy.ts';
import { sanitizeModelCandidateRuntimeResult } from './model-candidate-runtime-result.ts';

export const MAX_PLAN_BLOCKS = 3;

export const REVIEW_MODEL_CANDIDATE_SCHEMA = z
  .object({
    focusIndexes: z.array(z.number().int().nonnegative()).min(1).max(3),
    diagnosis: z.enum(['review_pressure', 'stability_risk', 'knowledge_gap']),
  })
  .strict();

export const PLANNER_MODEL_CANDIDATE_SCHEMA = z
  .object({
    blockOrder: z.array(z.number().int().nonnegative()).min(1).max(MAX_PLAN_BLOCKS),
    strategy: z.enum(['relieve_capacity', 'protect_overdue', 'steady_progress']),
  })
  .strict();

type ReviewDecision = z.infer<typeof REVIEW_MODEL_CANDIDATE_SCHEMA>;
type PlannerDecision = z.infer<typeof PLANNER_MODEL_CANDIDATE_SCHEMA>;

export type ReviewModelCandidateReasonCode =
  | ReviewDecision['diagnosis']
  | ModelAgentErrorCode;
export type PlannerModelCandidateReasonCode =
  | PlannerDecision['strategy']
  | ModelAgentErrorCode;

export type ReviewModelCandidateInput = {
  runId: string;
  deterministic: ReviewAgentResult;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
};

export type PlannerModelCandidateInput = {
  runId: string;
  deterministic: PlannerAgentResult;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
};

export type ReviewModelCandidateEnvelope = {
  value: ReviewAgentResult;
  observation: ModelCandidateObservation<ReviewModelCandidateReasonCode>;
};

export type PlannerModelCandidateEnvelope = {
  value: PlannerAgentResult;
  observation: ModelCandidateObservation<PlannerModelCandidateReasonCode>;
};

const REVIEW_MAX_INPUT_TOKENS = 900;
const PLANNER_MAX_INPUT_TOKENS = 1050;
const MAX_OUTPUT_TOKENS = 220;
const MAX_RAW_BYTES = 16_384;
const REVIEW_MAX_SNAPSHOT_CHARS = 1_200;
const PLANNER_MAX_SNAPSHOT_CHARS = 1_500;

const REVIEW_SYSTEM_PROMPT = [
  'You select review focus indexes from a supplied deterministic snapshot.',
  'Return only strict JSON with focusIndexes and diagnosis.',
  'Do not create tasks, facts, links, minutes, instructions, or write actions.',
].join(' ');
const PLANNER_SYSTEM_PROMPT = [
  'You order supplied study-plan block indexes from a deterministic snapshot.',
  'Return only strict JSON with blockOrder and strategy.',
  'Do not create tasks, facts, links, minutes, instructions, or write actions.',
].join(' ');
const REVIEW_SCHEMA_DESCRIPTOR =
  'Output strict JSON: {"focusIndexes":[nonnegative indexes, one to three],"diagnosis":"review_pressure|stability_risk|knowledge_gap"}. No extra fields.';
const PLANNER_SCHEMA_DESCRIPTOR =
  'Output strict JSON: {"blockOrder":[nonnegative indexes, one to three],"strategy":"relieve_capacity|protect_overdue|steady_progress"}. No extra fields.';

const SAFE_REVIEW_RESULT: ReviewAgentResult = Object.freeze({
  priority: 'low',
  summary: 'Deterministic review suggestion is unavailable.',
  weakPoints: [],
  actions: [],
  signals: ['lowPressure'],
});
const SAFE_PLANNER_RESULT: PlannerAgentResult = Object.freeze({
  headline: 'Deterministic study plan is unavailable.',
  todayFocus: 'Continue with the current study plan.',
  weekStrategy: 'Keep a steady study rhythm.',
  suggestedBlocks: [],
  signals: ['normalPlan'],
});
const SAFE_INVALID_BUDGET: ModelAgentRunBudget = Object.freeze({
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: 1,
  usedInputTokens: 0,
  maxOutputTokens: 1,
  usedOutputTokens: 0,
});

export async function runReviewModelCandidate(
  input: ReviewModelCandidateInput,
): Promise<ReviewModelCandidateEnvelope> {
  const validation = validateReviewInput(input);
  if (!validation.ok) {
    return localReviewEnvelope(
      validation.value ?? { ...SAFE_REVIEW_RESULT },
      'fallback_invalid_input',
      validation.budget,
      [],
    );
  }

  const prepared = prepareSnapshot(validation.value, REVIEW_MAX_SNAPSHOT_CHARS);
  if (!prepared.ok) {
    return localReviewEnvelope(
      validation.value,
      prepared.disposition,
      validation.budget,
      [],
    );
  }
  if (validation.value.priority === 'low' || validation.value.weakPoints.length === 0) {
    return localReviewEnvelope(validation.value, 'not_eligible', validation.budget, []);
  }

  return invokeReviewCandidate(validation, prepared.text);
}

export async function runPlannerModelCandidate(
  input: PlannerModelCandidateInput,
): Promise<PlannerModelCandidateEnvelope> {
  const validation = validatePlannerInput(input);
  if (!validation.ok) {
    return localPlannerEnvelope(
      validation.value ?? { ...SAFE_PLANNER_RESULT },
      'fallback_invalid_input',
      validation.budget,
      [],
    );
  }

  const prepared = prepareSnapshot(validation.value, PLANNER_MAX_SNAPSHOT_CHARS);
  if (!prepared.ok) {
    return localPlannerEnvelope(
      validation.value,
      prepared.disposition,
      validation.budget,
      [],
    );
  }
  if (
    validation.value.suggestedBlocks.length === 0 ||
    validation.value.suggestedBlocks.length > MAX_PLAN_BLOCKS ||
    validation.value.signals.includes('lightPlan')
  ) {
    return localPlannerEnvelope(validation.value, 'not_eligible', validation.budget, []);
  }

  return invokePlannerCandidate(validation, prepared.text);
}

async function invokeReviewCandidate(
  input: ValidReviewInput,
  snapshot: string,
): Promise<ReviewModelCandidateEnvelope> {
  const userPrompt = JSON.stringify({ deterministicReview: snapshot });
  const estimatedInputTokens = estimateInputTokens([
    REVIEW_SYSTEM_PROMPT,
    userPrompt,
    REVIEW_SCHEMA_DESCRIPTOR,
  ]);
  if (estimatedInputTokens > REVIEW_MAX_INPUT_TOKENS) {
    return localReviewEnvelope(input.value, 'fallback_invalid_input', input.budget, []);
  }

  const abort = readAbortState(input.signal);
  if (!abort.ok) {
    return localReviewEnvelope({ ...SAFE_REVIEW_RESULT }, 'fallback_invalid_input', SAFE_INVALID_BUDGET, []);
  }
  if (abort.aborted) {
    return localReviewEnvelope(input.value, 'fallback_aborted', input.budget, ['ABORTED']);
  }

  const reservation = reserveModelAgentBudget(input.budget, {
    inputTokens: estimatedInputTokens,
    outputTokens: MAX_OUTPUT_TOKENS,
  });
  if (!reservation.ok) {
    return localReviewEnvelope(
      input.value,
      mapModelAgentErrorDisposition(toModelAgentErrorCode(reservation.code)),
      input.budget,
      [toModelAgentErrorCode(reservation.code)],
    );
  }

  const runtimeResult = await invokeRuntime({
    input,
    task: 'review_suggestion',
    schema: REVIEW_MODEL_CANDIDATE_SCHEMA,
    systemPrompt: REVIEW_SYSTEM_PROMPT,
    userPrompt,
    estimatedInputTokens,
    reservationBudget: reservation.budget,
  });
  if (runtimeResult === null) {
    return unavailableReviewEnvelope(input.value, reservation.budget);
  }
  if (!runtimeResult.ok) {
    const disposition = mapModelAgentErrorDisposition(runtimeResult.error.code);
    return attemptedReviewEnvelope(
      input.value,
      disposition,
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      [runtimeResult.error.code],
    );
  }

  const value = mergeReviewDecision(input.value, runtimeResult.data);
  if (!value) {
    return attemptedReviewEnvelope(
      input.value,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['SCHEMA_INVALID'],
    );
  }
  return attemptedReviewEnvelope(
    value,
    'candidate_applied',
    runtimeResult.budget,
    runtimeResult.usage,
    runtimeResult.trace,
    [runtimeResult.data.diagnosis],
  );
}

async function invokePlannerCandidate(
  input: ValidPlannerInput,
  snapshot: string,
): Promise<PlannerModelCandidateEnvelope> {
  const userPrompt = JSON.stringify({ deterministicPlanner: snapshot });
  const estimatedInputTokens = estimateInputTokens([
    PLANNER_SYSTEM_PROMPT,
    userPrompt,
    PLANNER_SCHEMA_DESCRIPTOR,
  ]);
  if (estimatedInputTokens > PLANNER_MAX_INPUT_TOKENS) {
    return localPlannerEnvelope(input.value, 'fallback_invalid_input', input.budget, []);
  }

  const abort = readAbortState(input.signal);
  if (!abort.ok) {
    return localPlannerEnvelope({ ...SAFE_PLANNER_RESULT }, 'fallback_invalid_input', SAFE_INVALID_BUDGET, []);
  }
  if (abort.aborted) {
    return localPlannerEnvelope(input.value, 'fallback_aborted', input.budget, ['ABORTED']);
  }

  const reservation = reserveModelAgentBudget(input.budget, {
    inputTokens: estimatedInputTokens,
    outputTokens: MAX_OUTPUT_TOKENS,
  });
  if (!reservation.ok) {
    return localPlannerEnvelope(
      input.value,
      mapModelAgentErrorDisposition(toModelAgentErrorCode(reservation.code)),
      input.budget,
      [toModelAgentErrorCode(reservation.code)],
    );
  }

  const runtimeResult = await invokeRuntime({
    input,
    task: 'planner_suggestion',
    schema: PLANNER_MODEL_CANDIDATE_SCHEMA,
    systemPrompt: PLANNER_SYSTEM_PROMPT,
    userPrompt,
    estimatedInputTokens,
    reservationBudget: reservation.budget,
  });
  if (runtimeResult === null) {
    return unavailablePlannerEnvelope(input.value, reservation.budget);
  }
  if (!runtimeResult.ok) {
    const disposition = mapModelAgentErrorDisposition(runtimeResult.error.code);
    return attemptedPlannerEnvelope(
      input.value,
      disposition,
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      [runtimeResult.error.code],
    );
  }

  const value = mergePlannerDecision(input.value, runtimeResult.data);
  if (!value) {
    return attemptedPlannerEnvelope(
      input.value,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['SCHEMA_INVALID'],
    );
  }
  return attemptedPlannerEnvelope(
    value,
    'candidate_applied',
    runtimeResult.budget,
    runtimeResult.usage,
    runtimeResult.trace,
    [runtimeResult.data.strategy],
  );
}

type ValidInput<T> = {
  ok: true;
  value: T;
  runId: string;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
};
type ValidReviewInput = ValidInput<ReviewAgentResult>;
type ValidPlannerInput = ValidInput<PlannerAgentResult>;
type InvalidInput<T> = { ok: false; value?: T; budget: ModelAgentRunBudget };

function validateReviewInput(input: unknown): ValidReviewInput | InvalidInput<ReviewAgentResult> {
  return validateInput(input, reviewAgentResultSchema, SAFE_REVIEW_RESULT);
}

function validatePlannerInput(input: unknown): ValidPlannerInput | InvalidInput<PlannerAgentResult> {
  return validateInput(input, plannerAgentResultSchema, SAFE_PLANNER_RESULT);
}

function validateInput<T>(
  input: unknown,
  schema: z.ZodType<T>,
  fallback: T,
): ValidInput<T> | InvalidInput<T> {
  try {
    const fallbackValue = cloneSchemaValue(schema, fallback);
    if (fallbackValue === null) {
      return { ok: false, budget: SAFE_INVALID_BUDGET };
    }
    if (typeof input !== 'object' || input === null) {
      return { ok: false, value: fallbackValue, budget: SAFE_INVALID_BUDGET };
    }
    const candidate = input as Record<string, unknown>;
    const value = cloneSchemaValue(schema, candidate.deterministic);
    const budget = cloneBudget(candidate.budget);
    const runId = candidate.runId;
    const runtime = candidate.runtime;
    const signal = candidate.signal;
    if (
      value === null ||
      budget === null ||
      typeof runId !== 'string' ||
      !runId.trim() ||
      typeof runtime !== 'object' ||
      runtime === null ||
      typeof (runtime as Record<string, unknown>).invokeStructured !== 'function' ||
      (signal !== undefined && !(signal instanceof AbortSignal))
    ) {
      return {
        ok: false,
        ...(value ? { value } : {}),
        budget: budget ?? SAFE_INVALID_BUDGET,
      };
    }
    return {
      ok: true,
      value,
      runId,
      runtime: runtime as Pick<ModelAgentRuntime, 'invokeStructured'>,
      budget,
      ...(signal !== undefined ? { signal } : {}),
    };
  } catch {
    return { ok: false, budget: SAFE_INVALID_BUDGET };
  }
}

function cloneSchemaValue<T>(schema: z.ZodType<T>, value: unknown): T | null {
  try {
    const parsed = schema.safeParse(value);
    if (!parsed.success) return null;
    const reparsed = schema.safeParse(JSON.parse(JSON.stringify(parsed.data)));
    return reparsed.success ? reparsed.data : null;
  } catch {
    return null;
  }
}

function cloneBudget(value: unknown): ModelAgentRunBudget | null {
  try {
    if (!isModelAgentRunBudget(value)) return null;
    const snapshot = {
      maxCalls: value.maxCalls,
      usedCalls: value.usedCalls,
      maxInputTokens: value.maxInputTokens,
      usedInputTokens: value.usedInputTokens,
      maxOutputTokens: value.maxOutputTokens,
      usedOutputTokens: value.usedOutputTokens,
    };
    return isModelAgentRunBudget(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

function prepareSnapshot(value: unknown, maxChars: number):
  | { ok: true; text: string }
  | { ok: false; disposition: 'fallback_invalid_input' | 'safety_blocked' } {
  try {
    const prepared = prepareCandidateText({
      value: JSON.stringify(value),
      maxRawBytes: MAX_RAW_BYTES,
      maxChars,
    });
    return prepared.ok
      ? prepared
      : { ok: false, disposition: prepared.disposition };
  } catch {
    return { ok: false, disposition: 'fallback_invalid_input' };
  }
}

function readAbortState(signal: AbortSignal | undefined):
  | { ok: true; aborted: boolean; signal?: AbortSignal }
  | { ok: false } {
  if (signal === undefined) return { ok: true, aborted: false };
  try {
    return typeof signal.aborted === 'boolean'
      ? { ok: true, aborted: signal.aborted, signal }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}

function estimateInputTokens(parts: readonly string[]): number {
  return 64 + Math.ceil(Buffer.byteLength(parts.join('\n'), 'utf8') / 3);
}

function toModelAgentErrorCode(code: string): ModelAgentErrorCode {
  return code === 'INVALID_MODEL_AGENT_BUDGET' ? 'INVALID_REQUEST' : code as ModelAgentErrorCode;
}

async function invokeRuntime<T>(input: {
  input: {
    runId: string;
    runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
    budget: ModelAgentRunBudget;
    signal?: AbortSignal;
  };
  task: 'review_suggestion' | 'planner_suggestion';
  schema: z.ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
  estimatedInputTokens: number;
  reservationBudget: ModelAgentRunBudget;
}) {
  let result: unknown;
  try {
    const request: ModelAgentRequest<T> = {
      runId: input.input.runId,
      task: input.task,
      schema: input.schema,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      estimatedInputTokens: input.estimatedInputTokens,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      budget: safeCandidateBudgetSnapshot(input.input.budget),
      ...(input.input.signal ? { signal: input.input.signal } : {}),
    };
    result = await input.input.runtime.invokeStructured(request);
  } catch {
    return null;
  }
  return sanitizeModelCandidateRuntimeResult({
    value: result,
    dataSchema: input.schema,
    task: input.task,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    callerBudget: input.input.budget,
    previewBudget: input.reservationBudget,
  });
}

function mergeReviewDecision(
  deterministic: ReviewAgentResult,
  decision: ReviewDecision,
): ReviewAgentResult | null {
  if (!hasUniqueIndexes(decision.focusIndexes, deterministic.weakPoints.length)) return null;
  return {
    ...deterministic,
    weakPoints: decision.focusIndexes.map((index) => deterministic.weakPoints[index]),
  };
}

function mergePlannerDecision(
  deterministic: PlannerAgentResult,
  decision: PlannerDecision,
): PlannerAgentResult | null {
  if (
    decision.blockOrder.length !== deterministic.suggestedBlocks.length ||
    !hasUniqueIndexes(decision.blockOrder, deterministic.suggestedBlocks.length)
  ) {
    return null;
  }
  return {
    ...deterministic,
    suggestedBlocks: decision.blockOrder.map(
      (index) => deterministic.suggestedBlocks[index],
    ),
  };
}

function hasUniqueIndexes(indexes: readonly number[], length: number): boolean {
  return (
    indexes.length > 0 &&
    indexes.every((index) => Number.isSafeInteger(index) && index >= 0 && index < length) &&
    new Set(indexes).size === indexes.length
  );
}

function localReviewEnvelope(
  value: ReviewAgentResult,
  disposition: ModelCandidateDisposition,
  budget: unknown,
  reasons: readonly ReviewModelCandidateReasonCode[],
): ReviewModelCandidateEnvelope {
  return {
    value,
    observation: {
      attempted: false,
      disposition,
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<ReviewModelCandidateReasonCode>,
  };
}

function localPlannerEnvelope(
  value: PlannerAgentResult,
  disposition: ModelCandidateDisposition,
  budget: unknown,
  reasons: readonly PlannerModelCandidateReasonCode[],
): PlannerModelCandidateEnvelope {
  return {
    value,
    observation: {
      attempted: false,
      disposition,
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<PlannerModelCandidateReasonCode>,
  };
}

function attemptedReviewEnvelope(
  value: ReviewAgentResult,
  disposition: ModelCandidateDisposition,
  budget: ModelAgentRunBudget,
  usage: { inputTokens: number; outputTokens: number },
  trace: NonNullable<Exclude<ModelCandidateObservation<ReviewModelCandidateReasonCode>, { attempted: false }>['trace']>,
  reasons: readonly ReviewModelCandidateReasonCode[],
): ReviewModelCandidateEnvelope {
  return {
    value,
    observation: {
      attempted: true,
      disposition,
      budget,
      usage,
      trace,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<ReviewModelCandidateReasonCode>,
  };
}

function attemptedPlannerEnvelope(
  value: PlannerAgentResult,
  disposition: ModelCandidateDisposition,
  budget: ModelAgentRunBudget,
  usage: { inputTokens: number; outputTokens: number },
  trace: NonNullable<Exclude<ModelCandidateObservation<PlannerModelCandidateReasonCode>, { attempted: false }>['trace']>,
  reasons: readonly PlannerModelCandidateReasonCode[],
): PlannerModelCandidateEnvelope {
  return {
    value,
    observation: {
      attempted: true,
      disposition,
      budget,
      usage,
      trace,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<PlannerModelCandidateReasonCode>,
  };
}

function unavailableReviewEnvelope(
  value: ReviewAgentResult,
  budget: ModelAgentRunBudget,
): ReviewModelCandidateEnvelope {
  return {
    value,
    observation: {
      attempted: true,
      traceUnavailable: true,
      usageUnavailable: true,
      disposition: 'fallback_runtime_error',
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes('fallback_runtime_error', []),
    },
  };
}

function unavailablePlannerEnvelope(
  value: PlannerAgentResult,
  budget: ModelAgentRunBudget,
): PlannerModelCandidateEnvelope {
  return {
    value,
    observation: {
      attempted: true,
      traceUnavailable: true,
      usageUnavailable: true,
      disposition: 'fallback_runtime_error',
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes('fallback_runtime_error', []),
    },
  };
}
