import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import {
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  type ModelAgentErrorCode,
  type ModelAgentProviderFailureCategory,
} from '@repo/ai';

import { sanitizeModelCandidateRuntimeResult } from '../src/model-candidates/model-candidate-runtime-result';

const dataSchema = z.object({ route: z.literal('chat') }).strict();

const callerBudget = {
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: 100,
  usedInputTokens: 0,
  maxOutputTokens: 50,
  usedOutputTokens: 0,
};

const previewBudget = {
  maxCalls: 1,
  usedCalls: 1,
  maxInputTokens: 100,
  usedInputTokens: 20,
  maxOutputTokens: 50,
  usedOutputTokens: 30,
};

describe('model candidate runtime result sanitizer', () => {
  test.each([...MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES])(
    'preserves a consistent PROVIDER_ERROR category: %s',
    (category) => {
      const result = sanitize(failure('PROVIDER_ERROR', category, category));

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: 'Model agent runtime returned a structured failure.',
          providerFailureCategory: category,
        },
        trace: {
          errorCode: 'PROVIDER_ERROR',
          providerFailureCategory: category,
        },
      });
    },
  );

  test('accepts historical PROVIDER_ERROR results only when both categories are absent', () => {
    const result = sanitize(failure('PROVIDER_ERROR'));

    expect(result?.ok).toBe(false);
    if (!result || result.ok) throw new Error('expected a sanitized failure');
    expect(result.error.providerFailureCategory).toBeUndefined();
    expect(result.trace.providerFailureCategory).toBeUndefined();
    expect('providerFailureCategory' in result.error).toBe(false);
    expect('providerFailureCategory' in result.trace).toBe(false);
  });

  test.each([
    {
      name: 'error-only category',
      value: failure('PROVIDER_ERROR', 'unknown'),
    },
    {
      name: 'trace-only category',
      value: failure('PROVIDER_ERROR', undefined, 'unknown'),
    },
    {
      name: 'mismatched categories',
      value: failure('PROVIDER_ERROR', 'http_auth', 'http_server'),
    },
    {
      name: 'unknown free string',
      value: failure(
        'PROVIDER_ERROR',
        'RAW_PROVIDER_CATEGORY_CANARY',
        'RAW_PROVIDER_CATEGORY_CANARY',
      ),
    },
    {
      name: 'non-provider error with categories',
      value: failure('TIMEOUT', 'unknown', 'unknown'),
    },
  ])('rejects $name', ({ value }) => {
    expect(sanitize(value)).toBeNull();
  });

  test('rejects provider failure categories on success traces', () => {
    expect(
      sanitize({
        ok: true,
        data: { route: 'chat' },
        budget: previewBudget,
        usage: { inputTokens: 0, outputTokens: 0 },
        trace: {
          ...trace('succeeded'),
          degraded: false,
          providerFailureCategory: 'unknown',
        },
      }),
    ).toBeNull();
  });

  test.each([
    {
      name: 'top-level proxy',
      value: new Proxy(
        {},
        {
          get() {
            throw new Error('RAW_PROXY_CANARY');
          },
        },
      ),
    },
    {
      name: 'top-level getter',
      value: Object.defineProperty({}, 'ok', {
        enumerable: true,
        get() {
          throw new Error('RAW_GETTER_CANARY');
        },
      }),
    },
  ])('fails closed without throwing a hostile $name canary', ({ value }) => {
    let result: ReturnType<typeof sanitize> | undefined;

    expect(() => {
      result = sanitize(value);
    }).not.toThrow();
    expect(result).toBeNull();
  });

  test('rebuilds a safe failure without aliasing raw runtime metadata', () => {
    const rawMessage = 'RAW_RUNTIME_MESSAGE_CANARY Authorization: Bearer secret';
    const value = failure('PROVIDER_ERROR', 'transport', 'transport');
    value.error.message = rawMessage;

    const result = sanitize(value);

    expect(result?.ok).toBe(false);
    if (!result || result.ok) throw new Error('expected a sanitized failure');
    expect(result).not.toBe(value);
    expect(result.error).not.toBe(value.error);
    expect(result.budget).not.toBe(value.budget);
    expect(result.usage).not.toBe(value.usage);
    expect(result.trace).not.toBe(value.trace);
    expect(JSON.stringify(result)).not.toContain(rawMessage);
    expect(result.error.message).toBe('Model agent runtime returned a structured failure.');

    value.error.providerFailureCategory = 'http_auth';
    value.trace.providerFailureCategory = 'http_auth';
    value.trace.model = 'mutated-model';

    expect(result.error.providerFailureCategory).toBe('transport');
    expect(result.trace.providerFailureCategory).toBe('transport');
    expect(result.trace.model).toBe('safe-model');
  });

  test.each([
    {
      name: 'top-level extra field',
      mutate: (value: ReturnType<typeof failure>) =>
        Object.assign(value, { rawResult: 'RAW_RESULT_CANARY' }),
    },
    {
      name: 'error extra field',
      mutate: (value: ReturnType<typeof failure>) =>
        Object.assign(value.error, { rawError: 'RAW_ERROR_CANARY' }),
    },
    {
      name: 'trace extra field',
      mutate: (value: ReturnType<typeof failure>) =>
        Object.assign(value.trace, { rawTrace: 'RAW_TRACE_CANARY' }),
    },
  ])('rejects a $name instead of copying it', ({ mutate }) => {
    const value = failure('PROVIDER_ERROR', 'unknown', 'unknown');
    mutate(value);

    expect(sanitize(value)).toBeNull();
  });
});

function sanitize(value: unknown) {
  return sanitizeModelCandidateRuntimeResult({
    value,
    dataSchema,
    task: 'router_fallback',
    maxOutputTokens: 30,
    callerBudget,
    previewBudget,
  });
}

function failure(
  code: ModelAgentErrorCode,
  errorCategory?: ModelAgentProviderFailureCategory | string,
  traceCategory?: ModelAgentProviderFailureCategory | string,
) {
  return {
    ok: false as const,
    error: {
      code,
      message: 'raw runtime failure detail',
      retryable: code === 'PROVIDER_ERROR' || code === 'TIMEOUT',
      ...(errorCategory === undefined ? {} : { providerFailureCategory: errorCategory }),
    },
    budget: previewBudget,
    usage: { inputTokens: 0, outputTokens: 0 },
    trace: {
      ...trace('failed'),
      errorCode: code,
      ...(traceCategory === undefined ? {} : { providerFailureCategory: traceCategory }),
    },
  };
}

function trace(status: 'succeeded' | 'failed') {
  return {
    runIdHash: `sha256:${'a'.repeat(64)}`,
    task: 'router_fallback' as const,
    mode: 'live' as const,
    provider: 'deepseek' as const,
    model: 'safe-model',
    status,
    inputTokens: 0,
    outputTokens: 0,
    maxOutputTokens: 30,
    durationMs: 1,
    degraded: true,
  };
}
