import type { z } from 'zod';

import {
  isModelAgentRunBudget,
  type ModelAgentErrorCode,
  type ModelAgentRequest,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
  type ModelAgentTask,
} from '@repo/ai';

import { sanitizeModelCandidateRuntimeResult } from './model-candidate-runtime-result.ts';
import { clonePlainModelData } from './model-projection-safety.ts';

export const V6_SAFE_INVALID_BUDGET: ModelAgentRunBudget = Object.freeze({
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: 1,
  usedInputTokens: 0,
  maxOutputTokens: 1,
  usedOutputTokens: 0,
});

export function readV6PlainInputObject(
  input: unknown,
  allowedKeys: ReadonlySet<string>,
  requiredKeys: readonly string[],
): Readonly<{ ok: true; values: Record<string, unknown> }> | Readonly<{ ok: false }> {
  if (typeof input !== 'object' || input === null) return { ok: false };
  try {
    const prototype: unknown = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return { ok: false };
    const keys = Reflect.ownKeys(input);
    if (
      keys.some((key) => typeof key !== 'string' || !allowedKeys.has(key)) ||
      requiredKeys.some((key) => !keys.includes(key))
    ) {
      return { ok: false };
    }
    const values: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key !== 'string') return { ok: false };
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !('value' in descriptor)) return { ok: false };
      values[key] = descriptor.value;
    }
    return { ok: true, values };
  } catch {
    return { ok: false };
  }
}

export function snapshotV6Runtime(
  value: unknown,
): Pick<ModelAgentRuntime, 'invokeStructured'> | null {
  try {
    if (typeof value !== 'object' || value === null) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, 'invokeStructured');
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'function') {
      return null;
    }
    const invokeStructured = descriptor.value as ModelAgentRuntime['invokeStructured'];
    return {
      invokeStructured<T>(request: ModelAgentRequest<T>) {
        return Reflect.apply(invokeStructured, value, [request]);
      },
    };
  } catch {
    return null;
  }
}

export function snapshotV6Function(value: unknown): (() => unknown) | null {
  if (typeof value !== 'function') return null;
  const callable = value as () => unknown;
  return () => Reflect.apply(callable, undefined, []);
}

export function cloneV6Budget(value: unknown): ModelAgentRunBudget | null {
  const cloned = clonePlainModelData(value);
  if (!cloned.ok || !isModelAgentRunBudget(cloned.value)) return null;
  return {
    maxCalls: cloned.value.maxCalls,
    usedCalls: cloned.value.usedCalls,
    maxInputTokens: cloned.value.maxInputTokens,
    usedInputTokens: cloned.value.usedInputTokens,
    maxOutputTokens: cloned.value.maxOutputTokens,
    usedOutputTokens: cloned.value.usedOutputTokens,
  };
}

export function readV6AbortState(signal: AbortSignal | undefined) {
  if (signal === undefined) return { ok: true as const, aborted: false };
  try {
    return { ok: true as const, aborted: signal.aborted };
  } catch {
    return { ok: false as const };
  }
}

export async function invokeV6Structured<T>(
  input: Readonly<{
    runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
    request: ModelAgentRequest<T>;
    dataSchema: z.ZodType<T>;
    task: ModelAgentTask;
    maxOutputTokens: number;
    callerBudget: ModelAgentRunBudget;
    previewBudget: ModelAgentRunBudget;
  }>,
) {
  let rawResult: unknown;
  try {
    rawResult = await input.runtime.invokeStructured(input.request);
  } catch {
    return null;
  }
  return sanitizeModelCandidateRuntimeResult({
    value: rawResult,
    dataSchema: input.dataSchema,
    task: input.task,
    maxOutputTokens: input.maxOutputTokens,
    callerBudget: input.callerBudget,
    previewBudget: input.previewBudget,
  });
}

export function toV6ModelAgentErrorCode(code: string): ModelAgentErrorCode {
  return code === 'INVALID_MODEL_AGENT_BUDGET' ? 'INVALID_REQUEST' : (code as ModelAgentErrorCode);
}
