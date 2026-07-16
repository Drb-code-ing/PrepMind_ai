import { z } from 'zod';

import type {
  ModelAgentErrorCode,
  ModelAgentMode,
  ModelAgentProvider,
  ModelAgentProviderFailureCategory,
  ModelAgentRequest,
  ModelAgentResult,
  ModelAgentRunBudget,
  ModelAgentStructuredOutputStage,
  ModelAgentTask,
  ModelAgentTrace,
  ModelAgentUsage,
  StructuredModelExecutor,
} from './model-agent-contract.ts';
import { isModelAgentRunBudget, reserveModelAgentBudget } from './model-agent-budget.ts';
import { takeModelAgentProviderFailure } from './model-agent-provider-failure.ts';
import {
  createSafeModelAgentError,
  hashModelAgentRunId,
  isSafeModelName,
} from './model-agent-safety.ts';

export type CreateModelAgentRuntimeInput = {
  mode: ModelAgentMode;
  provider: ModelAgentProvider;
  model: string;
  liveCallsEnabled: boolean;
  timeoutMs: number;
  mockResponder?: (input: { task: ModelAgentTask }) => unknown;
  executor?: StructuredModelExecutor;
  now?: () => number;
};

export type ModelAgentRuntime = {
  invokeStructured<T>(request: ModelAgentRequest<T>): Promise<ModelAgentResult<T>>;
};

export function createModelAgentRuntime(input: CreateModelAgentRuntimeInput): ModelAgentRuntime {
  validateRuntimeConfig(input);
  const now = input.now ?? Date.now;

  return {
    async invokeStructured<T>(request: ModelAgentRequest<T>) {
      const startedAt = readClock(now);
      if (!isValidRequest(request)) {
        return failure(
          input,
          request,
          getRequestBudget(request),
          'INVALID_REQUEST',
          startedAt,
          now,
        );
      }

      if (request.signal?.aborted) {
        return failure(input, request, request.budget, 'ABORTED', startedAt, now);
      }
      if (input.mode === 'live' && !input.liveCallsEnabled) {
        return failure(input, request, request.budget, 'LIVE_CALLS_DISABLED', startedAt, now);
      }
      if (input.mode === 'live' && !input.executor) {
        return failure(input, request, request.budget, 'EXECUTOR_UNAVAILABLE', startedAt, now);
      }
      if (input.mode === 'mock' && !input.mockResponder) {
        return failure(input, request, request.budget, 'EXECUTOR_UNAVAILABLE', startedAt, now);
      }

      const reservation = reserveModelAgentBudget(request.budget, {
        inputTokens: request.estimatedInputTokens,
        outputTokens: request.maxOutputTokens,
      });
      if (!reservation.ok) {
        const code =
          reservation.code === 'INVALID_MODEL_AGENT_BUDGET' ? 'INVALID_REQUEST' : reservation.code;
        return failure(input, request, request.budget, code, startedAt, now);
      }

      let output: unknown;
      let usage: ModelAgentUsage;
      try {
        if (input.mode === 'mock') {
          output = await input.mockResponder!({ task: request.task });
          usage = {
            inputTokens: request.estimatedInputTokens,
            outputTokens: 0,
          };
        } else {
          const liveExecution = await executeLive(input, request);
          if (!liveExecution.ok) {
            return failure(
              input,
              request,
              reservation.budget,
              liveExecution.code,
              startedAt,
              now,
              liveExecution.providerFailureCategory,
              liveExecution.structuredOutputStage,
            );
          }
          output = liveExecution.result.object;
          const verifiedUsage = normalizeUsage(liveExecution.result.usage);
          if (verifiedUsage === null) {
            return failure(
              input,
              request,
              reservation.budget,
              'PROVIDER_ERROR',
              startedAt,
              now,
              'invalid_response',
            );
          }
          usage = verifiedUsage;
        }
      } catch {
        const classification = classifyExecutionError();
        return failure(
          input,
          request,
          reservation.budget,
          classification.code,
          startedAt,
          now,
          classification.providerFailureCategory,
        );
      }

      let data: T;
      try {
        const parsed = request.schema.safeParse(output);
        if (!parsed.success) {
          return failure(input, request, reservation.budget, 'SCHEMA_INVALID', startedAt, now);
        }
        data = parsed.data;
      } catch {
        return failure(input, request, reservation.budget, 'SCHEMA_INVALID', startedAt, now);
      }

      return {
        ok: true,
        data,
        budget: reservation.budget,
        usage,
        trace: trace(input, request, usage, 'succeeded', startedAt, now),
      };
    },
  };
}

const TIMEOUT_ERROR = Symbol('MODEL_AGENT_TIMEOUT');
const ABORTED_ERROR = Symbol('MODEL_AGENT_ABORTED');

type LiveExecutionResult =
  | {
      ok: true;
      result: Awaited<ReturnType<StructuredModelExecutor>>;
    }
  | {
      ok: false;
      code: 'TIMEOUT' | 'ABORTED' | 'PROVIDER_ERROR';
      providerFailureCategory?: ModelAgentProviderFailureCategory;
      structuredOutputStage?: ModelAgentStructuredOutputStage;
    };

async function executeLive<T>(
  runtime: CreateModelAgentRuntimeInput,
  request: ModelAgentRequest<T>,
): Promise<LiveExecutionResult> {
  const controller = new AbortController();
  let cancellationCode: typeof TIMEOUT_ERROR | typeof ABORTED_ERROR | null = null;
  let cancellationReject: (reason: symbol) => void = () => undefined;
  const cancellation = new Promise<never>((_, reject) => {
    cancellationReject = reject;
  });
  const cancel = (code: typeof TIMEOUT_ERROR | typeof ABORTED_ERROR) => {
    if (cancellationCode !== null) return;
    cancellationCode = code;
    cancellationReject(code);
    controller.abort();
  };
  const onExternalAbort = () => cancel(ABORTED_ERROR);
  request.signal?.addEventListener('abort', onExternalAbort, { once: true });
  const timeout = setTimeout(() => cancel(TIMEOUT_ERROR), runtime.timeoutMs);

  try {
    try {
      const result = await Promise.race([
        runtime.executor!({
          schema: request.schema,
          systemPrompt: request.systemPrompt,
          userPrompt: request.userPrompt,
          maxOutputTokens: request.maxOutputTokens,
          signal: controller.signal,
        }),
        cancellation,
      ]);
      return { ok: true, result };
    } catch (error) {
      if (cancellationCode === TIMEOUT_ERROR) return { ok: false, code: 'TIMEOUT' };
      if (cancellationCode === ABORTED_ERROR) return { ok: false, code: 'ABORTED' };
      const providerFailure = takeModelAgentProviderFailure(
        error,
        controller.signal,
      ) ?? { category: 'unknown' as const };
      return {
        ok: false,
        code: 'PROVIDER_ERROR',
        providerFailureCategory: providerFailure.category,
        ...(providerFailure.structuredOutputStage
          ? { structuredOutputStage: providerFailure.structuredOutputStage }
          : {}),
      };
    }
  } finally {
    clearTimeout(timeout);
    request.signal?.removeEventListener('abort', onExternalAbort);
  }
}

function classifyExecutionError(): {
  code: ModelAgentErrorCode;
  providerFailureCategory?: ModelAgentProviderFailureCategory;
} {
  return {
    code: 'PROVIDER_ERROR',
    providerFailureCategory: 'unknown',
  };
}

function normalizeUsage(
  usage?: { inputTokens?: number; outputTokens?: number },
): ModelAgentUsage | null {
  const inputTokens = usage?.inputTokens;
  const outputTokens = usage?.outputTokens;
  if (!isVerifiedLiveTokenCount(inputTokens) || !isVerifiedLiveTokenCount(outputTokens)) {
    return null;
  }
  return { inputTokens, outputTokens };
}

function isVerifiedLiveTokenCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isVerifiedTokenCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function normalizeTokenCount(value: unknown): number {
  return isVerifiedTokenCount(value) ? value : 0;
}

function validateRuntimeConfig(input: CreateModelAgentRuntimeInput) {
  if (
    typeof input !== 'object' ||
    input === null ||
    (input.mode !== 'mock' && input.mode !== 'live') ||
    (input.provider !== 'mock' && input.provider !== 'deepseek' && input.provider !== 'openai') ||
    !isSafeModelName(input.model) ||
    typeof input.liveCallsEnabled !== 'boolean' ||
    !Number.isSafeInteger(input.timeoutMs) ||
    input.timeoutMs < 50 ||
    input.timeoutMs > 60_000 ||
    (input.now !== undefined && typeof input.now !== 'function') ||
    (input.executor !== undefined && typeof input.executor !== 'function') ||
    (input.mockResponder !== undefined && typeof input.mockResponder !== 'function') ||
    (input.mode === 'mock' && input.provider !== 'mock') ||
    (input.mode === 'live' && input.provider === 'mock')
  ) {
    throw new Error('INVALID_RUNTIME_CONFIG');
  }
}

const MODEL_AGENT_TASKS = new Set<ModelAgentTask>([
  'conversation_summary',
  'router_fallback',
  'knowledge_verification',
  'review_suggestion',
  'planner_suggestion',
  'memory_candidate_extraction',
  'tool_orchestration',
]);

function isValidRequest<T>(request: unknown): request is ModelAgentRequest<T> {
  if (typeof request !== 'object' || request === null) return false;
  const candidate = request as Record<string, unknown>;
  return !(
    typeof candidate.runId !== 'string' ||
    !candidate.runId.trim() ||
    typeof candidate.task !== 'string' ||
    !MODEL_AGENT_TASKS.has(candidate.task as ModelAgentTask) ||
    !(candidate.schema instanceof z.ZodType) ||
    typeof candidate.systemPrompt !== 'string' ||
    !candidate.systemPrompt.trim() ||
    typeof candidate.userPrompt !== 'string' ||
    !candidate.userPrompt.trim() ||
    !Number.isSafeInteger(candidate.estimatedInputTokens) ||
    (candidate.estimatedInputTokens as number) < 0 ||
    !Number.isSafeInteger(candidate.maxOutputTokens) ||
    (candidate.maxOutputTokens as number) <= 0 ||
    !isModelAgentRunBudget(candidate.budget) ||
    (candidate.signal !== undefined && !(candidate.signal instanceof AbortSignal))
  );
}

function failure<T>(
  runtime: CreateModelAgentRuntimeInput,
  request: unknown,
  budget: unknown,
  code: ModelAgentErrorCode,
  startedAt: number | null,
  now: () => number,
  providerFailureCategory?: ModelAgentProviderFailureCategory,
  structuredOutputStage?: ModelAgentStructuredOutputStage,
): ModelAgentResult<T> {
  const usage = { inputTokens: 0, outputTokens: 0 };
  const error = createSafeModelAgentError(code, providerFailureCategory);
  return {
    ok: false,
    error,
    budget: safeBudgetSnapshot(budget),
    usage,
    trace: trace(
      runtime,
      request,
      usage,
      'failed',
      startedAt,
      now,
      code,
      error.providerFailureCategory,
      structuredOutputStage,
    ),
  };
}

function trace(
  runtime: CreateModelAgentRuntimeInput,
  request: unknown,
  usage: ModelAgentUsage,
  status: ModelAgentTrace['status'],
  startedAt: number | null,
  now: () => number,
  errorCode?: ModelAgentErrorCode,
  providerFailureCategory?: ModelAgentProviderFailureCategory,
  structuredOutputStage?: ModelAgentStructuredOutputStage,
): ModelAgentTrace {
  const safeRequest = safeTraceRequest(request);
  return {
    runIdHash: hashModelAgentRunId(safeRequest.runId),
    task: safeRequest.task,
    mode: runtime.mode,
    provider: runtime.provider,
    model: runtime.model,
    status,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    maxOutputTokens: safeRequest.maxOutputTokens,
    durationMs: calculateDuration(startedAt, now),
    degraded: status === 'failed',
    ...(errorCode ? { errorCode } : {}),
    ...(providerFailureCategory ? { providerFailureCategory } : {}),
    ...(structuredOutputStage ? { structuredOutputStage } : {}),
  };
}

function getRequestBudget(request: unknown): unknown {
  if (typeof request !== 'object' || request === null) return undefined;
  return (request as Record<string, unknown>).budget;
}

function safeBudgetSnapshot(budget: unknown): ModelAgentRunBudget {
  if (!isModelAgentRunBudget(budget)) {
    return {
      maxCalls: 1,
      usedCalls: 0,
      maxInputTokens: 1,
      usedInputTokens: 0,
      maxOutputTokens: 1,
      usedOutputTokens: 0,
    };
  }
  return { ...budget };
}

function safeTraceRequest(request: unknown): {
  runId: string;
  task: ModelAgentTrace['task'];
  maxOutputTokens: number;
} {
  if (typeof request !== 'object' || request === null) {
    return { runId: 'invalid-request', task: 'invalid_request', maxOutputTokens: 0 };
  }
  const candidate = request as Record<string, unknown>;
  const task =
    typeof candidate.task === 'string' && MODEL_AGENT_TASKS.has(candidate.task as ModelAgentTask)
      ? (candidate.task as ModelAgentTask)
      : 'invalid_request';
  return {
    runId: typeof candidate.runId === 'string' ? candidate.runId : 'invalid-request',
    task,
    maxOutputTokens: normalizeTokenCount(candidate.maxOutputTokens as number | undefined),
  };
}

function readClock(now: () => number): number | null {
  try {
    const value = now();
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

function calculateDuration(startedAt: number | null, now: () => number) {
  const finishedAt = readClock(now);
  if (startedAt === null || finishedAt === null || finishedAt < startedAt) return 0;
  const duration = finishedAt - startedAt;
  return Number.isSafeInteger(duration) ? duration : 0;
}
