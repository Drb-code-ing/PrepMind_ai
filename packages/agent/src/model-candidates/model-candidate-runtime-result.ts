import { z } from 'zod';

import {
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  MODEL_AGENT_STRUCTURED_OUTPUT_STAGES,
  isModelAgentRunBudget,
  type ModelAgentErrorCode,
  type ModelAgentProviderFailureCategory,
  type ModelAgentResult,
  type ModelAgentRunBudget,
  type ModelAgentTask,
  type ModelAgentTrace,
  type ModelAgentUsage,
} from '@repo/ai';

const MODEL_AGENT_ERROR_CODE_SCHEMA = z.enum([
  'INVALID_REQUEST',
  'INVALID_RUNTIME_CONFIG',
  'LIVE_CALLS_DISABLED',
  'EXECUTOR_UNAVAILABLE',
  'CALL_BUDGET_EXCEEDED',
  'INPUT_BUDGET_EXCEEDED',
  'OUTPUT_BUDGET_EXCEEDED',
  'SCHEMA_INVALID',
  'TIMEOUT',
  'ABORTED',
  'PROVIDER_ERROR',
]);

const PROVIDER_FAILURE_CATEGORY_SCHEMA = z.enum(
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
);

const RUNTIME_BUDGET_SCHEMA = z
  .object({
    maxCalls: z.number().int().safe().positive(),
    usedCalls: z.number().int().safe().min(0),
    maxInputTokens: z.number().int().safe().positive(),
    usedInputTokens: z.number().int().safe().min(0),
    maxOutputTokens: z.number().int().safe().positive(),
    usedOutputTokens: z.number().int().safe().min(0),
  })
  .strict();

const RUNTIME_USAGE_SCHEMA = z
  .object({
    inputTokens: z.number().int().safe().min(0),
    outputTokens: z.number().int().safe().min(0),
  })
  .strict();

export type SanitizeModelCandidateRuntimeResultInput<T> = {
  value: unknown;
  dataSchema: z.ZodType<T>;
  task: ModelAgentTask;
  maxOutputTokens: number;
  callerBudget: ModelAgentRunBudget;
  previewBudget: ModelAgentRunBudget;
};

export function sanitizeModelCandidateRuntimeResult<T>(
  input: SanitizeModelCandidateRuntimeResultInput<T>,
): ModelAgentResult<T> | null {
  try {
    return sanitizeModelCandidateRuntimeResultUnchecked(input);
  } catch {
    return null;
  }
}

function sanitizeModelCandidateRuntimeResultUnchecked<T>(
  input: SanitizeModelCandidateRuntimeResultInput<T>,
): ModelAgentResult<T> | null {
  if (!Number.isSafeInteger(input.maxOutputTokens) || input.maxOutputTokens <= 0) {
    return null;
  }

  const traceSchema = createRuntimeTraceSchema(input.task, input.maxOutputTokens);
  const successSchema = z
    .object({
      ok: z.literal(true),
      data: input.dataSchema,
      budget: RUNTIME_BUDGET_SCHEMA,
      usage: RUNTIME_USAGE_SCHEMA,
      trace: traceSchema,
    })
    .strict();
  const failureSchema = z
    .object({
      ok: z.literal(false),
      error: z
        .object({
          code: MODEL_AGENT_ERROR_CODE_SCHEMA,
          message: z.string(),
          retryable: z.boolean(),
          providerFailureCategory: PROVIDER_FAILURE_CATEGORY_SCHEMA.optional(),
        })
        .strict(),
      budget: RUNTIME_BUDGET_SCHEMA,
      usage: RUNTIME_USAGE_SCHEMA,
      trace: traceSchema,
    })
    .strict();

  const success = successSchema.safeParse(input.value);
  if (success.success) {
    const candidate = success.data;
    if (
      !isModelAgentRunBudget(candidate.budget) ||
      !budgetsEqual(candidate.budget, input.previewBudget) ||
      !isUsageWithinRequest(
        candidate.usage,
        candidate.budget,
        input.callerBudget,
        input.previewBudget,
        input.maxOutputTokens,
      ) ||
      !isConsistentRuntimeTrace(candidate.trace, candidate.usage) ||
      candidate.trace.status !== 'succeeded' ||
      candidate.trace.degraded ||
      candidate.trace.errorCode !== undefined ||
      candidate.trace.providerFailureCategory !== undefined ||
      candidate.trace.structuredOutputStage !== undefined
    ) {
      return null;
    }
    return {
      ok: true,
      data: candidate.data as T,
      budget: rebuildBudget(candidate.budget),
      usage: rebuildUsage(candidate.usage),
      trace: rebuildTrace(candidate.trace),
    };
  }

  const failure = failureSchema.safeParse(input.value);
  if (!failure.success) return null;
  const candidate = failure.data;
  if (
    !isModelAgentRunBudget(candidate.budget) ||
    !hasExpectedFailureBudget(
      candidate.error.code,
      candidate.budget,
      input.callerBudget,
      input.previewBudget,
    ) ||
    !isUsageWithinRequest(
      candidate.usage,
      candidate.budget,
      input.callerBudget,
      input.previewBudget,
      input.maxOutputTokens,
    ) ||
    !isConsistentRuntimeTrace(candidate.trace, candidate.usage) ||
    candidate.trace.status !== 'failed' ||
    !candidate.trace.degraded ||
    candidate.trace.errorCode !== candidate.error.code ||
    !hasConsistentProviderFailureCategory(
      candidate.error.code,
      candidate.error.providerFailureCategory,
      candidate.trace.providerFailureCategory,
    ) ||
    !hasConsistentStructuredOutputStage(
      candidate.error.code,
      candidate.trace.providerFailureCategory,
      candidate.trace.structuredOutputStage,
    )
  ) {
    return null;
  }
  return {
    ok: false,
    error: {
      code: candidate.error.code,
      message: 'Model agent runtime returned a structured failure.',
      retryable: candidate.error.retryable,
      ...(candidate.error.providerFailureCategory
        ? {
            providerFailureCategory: candidate.error.providerFailureCategory,
          }
        : {}),
    },
    budget: rebuildBudget(candidate.budget),
    usage: rebuildUsage(candidate.usage),
    trace: rebuildTrace(candidate.trace),
  };
}

function createRuntimeTraceSchema(task: ModelAgentTask, maxOutputTokens: number) {
  return z
    .object({
      runIdHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
      task: z.literal(task),
      mode: z.enum(['mock', 'live']),
      provider: z.enum(['mock', 'deepseek', 'openai']),
      model: z.string().regex(/^[A-Za-z0-9._:/-]{1,120}$/),
      status: z.enum(['succeeded', 'failed']),
      inputTokens: z.number().int().safe().min(0),
      outputTokens: z.number().int().safe().min(0),
      maxOutputTokens: z.literal(maxOutputTokens),
      durationMs: z.number().int().safe().min(0),
      degraded: z.boolean(),
      errorCode: MODEL_AGENT_ERROR_CODE_SCHEMA.optional(),
      providerFailureCategory: PROVIDER_FAILURE_CATEGORY_SCHEMA.optional(),
      structuredOutputStage: z
        .enum(MODEL_AGENT_STRUCTURED_OUTPUT_STAGES)
        .optional(),
    })
    .strict();
}

function hasConsistentProviderFailureCategory(
  errorCode: ModelAgentErrorCode,
  errorCategory: ModelAgentProviderFailureCategory | undefined,
  traceCategory: ModelAgentProviderFailureCategory | undefined,
): boolean {
  if (errorCode !== 'PROVIDER_ERROR') {
    return errorCategory === undefined && traceCategory === undefined;
  }

  return (
    (errorCategory === undefined && traceCategory === undefined) ||
    (errorCategory !== undefined && errorCategory === traceCategory)
  );
}

function hasConsistentStructuredOutputStage(
  errorCode: ModelAgentErrorCode,
  providerFailureCategory: ModelAgentProviderFailureCategory | undefined,
  structuredOutputStage: unknown,
): boolean {
  return (
    structuredOutputStage === undefined ||
    (errorCode === 'PROVIDER_ERROR' &&
      providerFailureCategory === 'structured_output')
  );
}

function hasExpectedFailureBudget(
  errorCode: ModelAgentErrorCode,
  actualBudget: ModelAgentRunBudget,
  callerBudget: ModelAgentRunBudget,
  previewBudget: ModelAgentRunBudget,
): boolean {
  switch (errorCode) {
    case 'SCHEMA_INVALID':
    case 'TIMEOUT':
    case 'PROVIDER_ERROR':
      return budgetsEqual(actualBudget, previewBudget);
    case 'ABORTED':
      return (
        budgetsEqual(actualBudget, callerBudget) ||
        budgetsEqual(actualBudget, previewBudget)
      );
    case 'INVALID_REQUEST':
    case 'LIVE_CALLS_DISABLED':
    case 'EXECUTOR_UNAVAILABLE':
    case 'CALL_BUDGET_EXCEEDED':
    case 'INPUT_BUDGET_EXCEEDED':
    case 'OUTPUT_BUDGET_EXCEEDED':
    case 'INVALID_RUNTIME_CONFIG':
      return budgetsEqual(actualBudget, callerBudget);
  }
}

function budgetsEqual(
  left: ModelAgentRunBudget,
  right: ModelAgentRunBudget,
): boolean {
  return (
    left.maxCalls === right.maxCalls &&
    left.usedCalls === right.usedCalls &&
    left.maxInputTokens === right.maxInputTokens &&
    left.usedInputTokens === right.usedInputTokens &&
    left.maxOutputTokens === right.maxOutputTokens &&
    left.usedOutputTokens === right.usedOutputTokens
  );
}

function isUsageWithinRequest(
  usage: ModelAgentUsage,
  actualBudget: ModelAgentRunBudget,
  callerBudget: ModelAgentRunBudget,
  previewBudget: ModelAgentRunBudget,
  maxOutputTokens: number,
): boolean {
  const reservedInputTokens =
    previewBudget.usedInputTokens - callerBudget.usedInputTokens;
  const reservedOutputTokens =
    previewBudget.usedOutputTokens - callerBudget.usedOutputTokens;
  if (
    reservedInputTokens < 0 ||
    reservedOutputTokens < 0 ||
    usage.outputTokens > maxOutputTokens ||
    usage.outputTokens > reservedOutputTokens
  ) {
    return false;
  }

  return (
    !budgetsEqual(actualBudget, callerBudget) ||
    (usage.inputTokens === 0 && usage.outputTokens === 0)
  );
}

function isConsistentRuntimeTrace(
  trace: ModelAgentTrace,
  usage: ModelAgentUsage,
): boolean {
  return (
    trace.inputTokens === usage.inputTokens &&
    trace.outputTokens === usage.outputTokens &&
    ((trace.mode === 'mock' && trace.provider === 'mock') ||
      (trace.mode === 'live' && trace.provider !== 'mock'))
  );
}

function rebuildBudget(value: ModelAgentRunBudget): ModelAgentRunBudget {
  return {
    maxCalls: value.maxCalls,
    usedCalls: value.usedCalls,
    maxInputTokens: value.maxInputTokens,
    usedInputTokens: value.usedInputTokens,
    maxOutputTokens: value.maxOutputTokens,
    usedOutputTokens: value.usedOutputTokens,
  };
}

function rebuildUsage(value: ModelAgentUsage): ModelAgentUsage {
  return {
    inputTokens: value.inputTokens,
    outputTokens: value.outputTokens,
  };
}

function rebuildTrace(value: ModelAgentTrace): ModelAgentTrace {
  return {
    runIdHash: value.runIdHash,
    task: value.task,
    mode: value.mode,
    provider: value.provider,
    model: value.model,
    status: value.status,
    inputTokens: value.inputTokens,
    outputTokens: value.outputTokens,
    maxOutputTokens: value.maxOutputTokens,
    durationMs: value.durationMs,
    degraded: value.degraded,
    ...(value.errorCode ? { errorCode: value.errorCode } : {}),
    ...(value.providerFailureCategory
      ? { providerFailureCategory: value.providerFailureCategory }
      : {}),
  };
}
