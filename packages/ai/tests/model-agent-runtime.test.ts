import { describe, expect, it } from 'bun:test';
import { APICallError } from 'ai';
import { z } from 'zod';

import { createModelAgentBudget } from '../src/model-agent-budget';
import type { ModelAgentProviderFailureCategory } from '../src/model-agent-contract';
import { createTrustedModelAgentProviderFailureSignal } from '../src/model-agent-provider-failure';
import { createOpenAICompatibleStructuredExecutor } from '../src/model-agent-provider';
import { createModelAgentRuntime } from '../src/model-agent-runtime';
import { createSafeModelAgentError } from '../src/model-agent-safety';

const routeSchema = z.object({ route: z.enum(['chat', 'tutor']) }).strict();
const CANARY = 'runtime-provider-raw-canary-must-not-leak';
const PROVIDER_FAILURE_RETRYABILITY = [
  { category: 'http_auth', retryable: false },
  { category: 'http_rate_limit', retryable: true },
  { category: 'http_client', retryable: false },
  { category: 'http_server', retryable: true },
  { category: 'transport', retryable: true },
  { category: 'structured_output', retryable: false },
  { category: 'invalid_response', retryable: false },
  { category: 'unknown', retryable: false },
] as const satisfies ReadonlyArray<{
  category: ModelAgentProviderFailureCategory;
  retryable: boolean;
}>;

describe('safe model agent errors', () => {
  it.each(PROVIDER_FAILURE_RETRYABILITY)(
    'maps provider category $category to retryable=$retryable',
    ({ category, retryable }) => {
      expect(createSafeModelAgentError('PROVIDER_ERROR', category)).toEqual({
        code: 'PROVIDER_ERROR',
        message: 'Model provider request failed.',
        retryable,
        providerFailureCategory: category,
      });
    },
  );

  it('defaults a category-less provider failure to unknown', () => {
    expect(createSafeModelAgentError('PROVIDER_ERROR')).toEqual({
      code: 'PROVIDER_ERROR',
      message: 'Model provider request failed.',
      retryable: false,
      providerFailureCategory: 'unknown',
    });
  });

  it('never attaches provider failure categories to non-provider errors', () => {
    expect(createSafeModelAgentError('TIMEOUT', 'http_server')).toEqual({
      code: 'TIMEOUT',
      message: 'Model agent call timed out.',
      retryable: true,
    });
  });
});

describe('model agent runtime mock mode', () => {
  it.each(['review_suggestion', 'planner_suggestion'] as const)(
    'accepts the bounded %s task',
    async (task) => {
      const runtime = createModelAgentRuntime({
        mode: 'mock',
        provider: 'mock',
        model: 'mock-agent-runtime',
        liveCallsEnabled: false,
        timeoutMs: 100,
        mockResponder: () => ({ route: 'chat' }),
      });

      const result = await runtime.invokeStructured({ ...request(), task });

      expect(result.ok).toBe(true);
      expect(result.trace.task).toBe(task);
    },
  );

  it('parses mock output through the shared schema without a live executor', async () => {
    const runtime = createModelAgentRuntime({
      mode: 'mock',
      provider: 'mock',
      model: 'mock-agent-runtime',
      liveCallsEnabled: false,
      timeoutMs: 100,
      mockResponder: () => ({ route: 'tutor' }),
    });
    const result = await runtime.invokeStructured(request());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.code);
    expect(result.data).toEqual({ route: 'tutor' });
    expect(result.budget.usedCalls).toBe(1);
    expect(result.budget.usedInputTokens).toBe(20);
    expect(result.budget.usedOutputTokens).toBe(30);
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 0 });
    expect(result.trace).toMatchObject({
      mode: 'mock',
      provider: 'mock',
      model: 'mock-agent-runtime',
      task: 'router_fallback',
      status: 'succeeded',
      inputTokens: 20,
      outputTokens: 0,
      maxOutputTokens: 30,
      degraded: false,
    });
    expect('providerFailureCategory' in result.trace).toBe(false);
    expect(result.trace.runIdHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain('private system prompt');
    expect(JSON.stringify(result)).not.toContain('private user question');
  });

  it('returns a safe schema error after reserving the attempted call', async () => {
    const runtime = createModelAgentRuntime({
      mode: 'mock',
      provider: 'mock',
      model: 'mock-agent-runtime',
      liveCallsEnabled: false,
      timeoutMs: 100,
      mockResponder: () => ({ route: 'unknown' }),
    });
    const result = await runtime.invokeStructured(request());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected schema failure');
    expect(result.error).toEqual({
      code: 'SCHEMA_INVALID',
      message: 'Model output did not match the required schema.',
      retryable: false,
    });
    expect(result.budget.usedCalls).toBe(1);
    expect(result.trace.errorCode).toBe('SCHEMA_INVALID');
    expect('providerFailureCategory' in result.error).toBe(false);
    expect('providerFailureCategory' in result.trace).toBe(false);
    expect(JSON.stringify(result)).not.toContain('unknown');
  });

  it('contains exceptions thrown by schema transforms as safe schema failures', async () => {
    const runtime = createModelAgentRuntime({
      mode: 'mock',
      provider: 'mock',
      model: 'mock-agent-runtime',
      liveCallsEnabled: false,
      timeoutMs: 100,
      mockResponder: () => ({ route: 'chat' }),
    });
    const throwingSchema = z.unknown().transform(() => {
      throw new Error('private schema transform detail');
    });

    const result = await runtime.invokeStructured({ ...request(), schema: throwingSchema });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected schema failure');
    expect(result.error.code).toBe('SCHEMA_INVALID');
    expect(result.budget.usedCalls).toBe(1);
    expect(JSON.stringify(result)).not.toContain('private schema transform detail');
  });

  it.each([
    { systemPrompt: '', expectedCode: 'INVALID_REQUEST' },
    { userPrompt: '   ', expectedCode: 'INVALID_REQUEST' },
    { estimatedInputTokens: Number.NaN, expectedCode: 'INVALID_REQUEST' },
    { maxOutputTokens: 0, expectedCode: 'INVALID_REQUEST' },
    { maxOutputTokens: 51, expectedCode: 'OUTPUT_BUDGET_EXCEEDED' },
  ])('rejects invalid or over-budget requests before responder', async (override) => {
    let calls = 0;
    const runtime = createModelAgentRuntime({
      mode: 'mock',
      provider: 'mock',
      model: 'mock-agent-runtime',
      liveCallsEnabled: false,
      timeoutMs: 100,
      mockResponder: () => {
        calls += 1;
        return { route: 'chat' };
      },
    });
    const result = await runtime.invokeStructured({ ...request(), ...override });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected request failure');
    expect(result.error.code).toBe(override.expectedCode);
    expect(result.budget.usedCalls).toBe(0);
    expect('providerFailureCategory' in result.error).toBe(false);
    expect('providerFailureCategory' in result.trace).toBe(false);
    expect(calls).toBe(0);
  });
});

describe('model agent runtime live mode', () => {
  it('blocks live calls before budget reservation when the guard is disabled', async () => {
    let calls = 0;
    const runtime = liveRuntime({
      liveCallsEnabled: false,
      executor: async () => {
        calls += 1;
        return { object: { route: 'chat' } };
      },
    });

    const result = await runtime.invokeStructured(request());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected live guard failure');
    expect(result.error.code).toBe('LIVE_CALLS_DISABLED');
    expect(result.budget.usedCalls).toBe(0);
    expect('providerFailureCategory' in result.error).toBe(false);
    expect('providerFailureCategory' in result.trace).toBe(false);
    expect(calls).toBe(0);
  });

  it('requires an injected executor before budget reservation', async () => {
    const result = await liveRuntime({ executor: undefined }).invokeStructured(request());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected executor failure');
    expect(result.error.code).toBe('EXECUTOR_UNAVAILABLE');
    expect(result.budget.usedCalls).toBe(0);
    expect('providerFailureCategory' in result.error).toBe(false);
    expect('providerFailureCategory' in result.trace).toBe(false);
  });

  it('returns parsed live data and normalized provider usage', async () => {
    const runtime = liveRuntime({
      executor: async ({ signal }) => {
        expect(signal.aborted).toBe(false);
        return {
          object: { route: 'chat' },
          usage: { inputTokens: 22, outputTokens: 7 },
        };
      },
    });

    const result = await runtime.invokeStructured(request());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.code);
    expect(result.data).toEqual({ route: 'chat' });
    expect(result.usage).toEqual({ inputTokens: 22, outputTokens: 7 });
    expect(result.budget.usedOutputTokens).toBe(30);
    expect(result.trace).toMatchObject({
      mode: 'live',
      provider: 'deepseek',
      status: 'succeeded',
      inputTokens: 22,
      outputTokens: 7,
    });
    expect('providerFailureCategory' in result.trace).toBe(false);
  });

  it('sanitizes provider errors without returning raw provider text', async () => {
    const runtime = liveRuntime({
      executor: async () => {
        throw new Error('private provider response with credential material');
      },
    });

    const result = await runtime.invokeStructured(request());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected provider failure');
    expect(result.error).toEqual({
      code: 'PROVIDER_ERROR',
      message: 'Model provider request failed.',
      retryable: false,
      providerFailureCategory: 'unknown',
    });
    expect(result.trace.providerFailureCategory).toBe(result.error.providerFailureCategory);
    expect(result.trace.providerFailureCategory).toBe('unknown');
    expect(result.budget).toMatchObject({
      usedCalls: 1,
      usedInputTokens: 20,
      usedOutputTokens: 30,
    });
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(JSON.stringify(result)).not.toContain('private provider response');
    expect(JSON.stringify(result)).not.toContain('credential material');
  });

  it('does not hand the trusted structured-output capability to an ordinary injected executor', async () => {
    let receivedCapability: unknown = Symbol('not-called');
    const runtime = liveRuntime({
      executor: async ({ createTrustedStructuredOutputFailure }) => {
        receivedCapability = createTrustedStructuredOutputFailure;
        if (createTrustedStructuredOutputFailure) {
          throw createTrustedStructuredOutputFailure('provider_json_parse');
        }
        throw new Error(CANARY);
      },
    });

    const result = await runtime.invokeStructured(request());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected untrusted executor failure');
    expect(receivedCapability).toBeUndefined();
    expect(result.error.providerFailureCategory).toBe('unknown');
    expect('structuredOutputStage' in result.trace).toBe(false);
    expect(JSON.stringify(result)).not.toContain(CANARY);
  });

  it('propagates a trusted provider category identically to the error and trace', async () => {
    const runtime = liveRuntime({
      executor: async ({ signal }) => {
        throw createTrustedModelAgentProviderFailureSignal(apiCallError(429), signal);
      },
    });

    const result = await runtime.invokeStructured(request());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected provider failure');
    expect(result.error).toEqual({
      code: 'PROVIDER_ERROR',
      message: 'Model provider request failed.',
      retryable: true,
      providerFailureCategory: 'http_rate_limit',
    });
    expect(result.trace.providerFailureCategory).toBe(result.error.providerFailureCategory);
    expect(result.trace.errorCode).toBe(result.error.code);
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(JSON.stringify(result)).not.toContain(CANARY);
  });

  it('downgrades a trusted signal replayed in a different runtime invocation', async () => {
    const originalScope = new AbortController().signal;
    const replayedSignal = createTrustedModelAgentProviderFailureSignal(
      apiCallError(500),
      originalScope,
    );
    const runtime = liveRuntime({
      executor: async () => {
        throw replayedSignal;
      },
    });

    const result = await runtime.invokeStructured(request());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected replayed provider failure');
    expect(result.error).toEqual({
      code: 'PROVIDER_ERROR',
      message: 'Model provider request failed.',
      retryable: false,
      providerFailureCategory: 'unknown',
    });
    expect(result.trace.providerFailureCategory).toBe(result.error.providerFailureCategory);
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(JSON.stringify(result)).not.toContain(CANARY);
  });

  it('preserves http_server from the default provider through the runtime', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response(
        JSON.stringify({
          error: {
            message: CANARY,
            type: 'server_error',
          },
        }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;

    try {
      const result = await liveRuntime({
        executor: defaultProviderExecutor(),
      }).invokeStructured(request());

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected default provider failure');
      expect(result.error).toEqual({
        code: 'PROVIDER_ERROR',
        message: 'Model provider request failed.',
        retryable: true,
        providerFailureCategory: 'http_server',
      });
      expect(result.trace.providerFailureCategory).toBe(result.error.providerFailureCategory);
      expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
      expect(fetchCalls).toBe(1);
      expect(JSON.stringify(result)).not.toContain(CANARY);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('preserves structured_output from the default provider through the runtime', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response(
        JSON.stringify({
          id: 'chatcmpl-structured-output',
          object: 'chat.completion',
          created: 1,
          model: 'deepseek-test',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: '{"route":"unsafe"}' },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 21,
            completion_tokens: 8,
            total_tokens: 29,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;

    try {
      const result = await liveRuntime({
        executor: defaultProviderExecutor(),
      }).invokeStructured(request());

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected structured output failure');
      expect(result.error).toEqual({
        code: 'PROVIDER_ERROR',
        message: 'Model provider request failed.',
        retryable: false,
        providerFailureCategory: 'structured_output',
      });
      expect(result.trace.providerFailureCategory).toBe(result.error.providerFailureCategory);
      expect(result.trace.structuredOutputStage).toBe(
        'provider_type_validation',
      );
      expect('structuredOutputStage' in result.error).toBe(false);
      expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
      expect(fetchCalls).toBe(1);
      expect(JSON.stringify(result)).not.toContain('unsafe');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('aborts a timed-out executor and classifies it separately', async () => {
    let observedAbort = false;
    const runtime = liveRuntime({
      timeoutMs: 50,
      executor: ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              observedAbort = true;
              reject(createTrustedModelAgentProviderFailureSignal(apiCallError(500), signal));
            },
            { once: true },
          );
        }),
    });

    const result = await runtime.invokeStructured(request());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected timeout');
    expect(result.error.code).toBe('TIMEOUT');
    expect(result.error.retryable).toBe(true);
    expect('providerFailureCategory' in result.error).toBe(false);
    expect('providerFailureCategory' in result.trace).toBe(false);
    expect(result.budget.usedCalls).toBe(1);
    expect(observedAbort).toBe(true);
    expect(JSON.stringify(result)).not.toContain('raw timeout');
  });

  it('honors a pre-aborted external signal without calling executor', async () => {
    let calls = 0;
    const controller = new AbortController();
    controller.abort();
    const runtime = liveRuntime({
      executor: async () => {
        calls += 1;
        return { object: { route: 'chat' } };
      },
    });

    const result = await runtime.invokeStructured({
      ...request(),
      signal: controller.signal,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected abort');
    expect(result.error.code).toBe('ABORTED');
    expect('providerFailureCategory' in result.error).toBe(false);
    expect('providerFailureCategory' in result.trace).toBe(false);
    expect(result.budget.usedCalls).toBe(0);
    expect(calls).toBe(0);
  });

  it('keeps an active external abort ahead of a provider failure signal', async () => {
    const external = new AbortController();
    let observedAbort = false;
    const runtime = liveRuntime({
      executor: ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              observedAbort = true;
              reject(createTrustedModelAgentProviderFailureSignal(apiCallError(500), signal));
            },
            { once: true },
          );
        }),
    });

    const invocation = runtime.invokeStructured({ ...request(), signal: external.signal });
    external.abort();
    const result = await invocation;

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected active abort');
    expect(result.error.code).toBe('ABORTED');
    expect(result.error.retryable).toBe(false);
    expect('providerFailureCategory' in result.error).toBe(false);
    expect('providerFailureCategory' in result.trace).toBe(false);
    expect(result.budget.usedCalls).toBe(1);
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(observedAbort).toBe(true);
  });

  it('normalizes invalid provider usage to zero', async () => {
    const runtime = liveRuntime({
      executor: async () => ({
        object: { route: 'chat' },
        usage: { inputTokens: Number.MAX_VALUE, outputTokens: -4.5 },
      }),
    });

    const result = await runtime.invokeStructured(request());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.code);
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(result.budget.usedCalls).toBe(1);
  });

  it('keeps the first cancellation reason when timeout and external abort race', async () => {
    const external = new AbortController();
    const runtime = liveRuntime({
      timeoutMs: 50,
      executor: ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              external.abort();
              reject(new Error('raw provider abort'));
            },
            { once: true },
          );
        }),
    });

    const result = await runtime.invokeStructured({ ...request(), signal: external.signal });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected cancellation');
    expect(result.error.code).toBe('TIMEOUT');
  });

  it.each([
    { now: () => Number.NaN },
    { now: () => Number.POSITIVE_INFINITY },
    {
      now: (() => {
        let call = 0;
        return () => (call++ === 0 ? 100 : 50);
      })(),
    },
  ])('normalizes invalid or regressing clocks to a safe duration', async ({ now }) => {
    const result = await liveRuntime({ now }).invokeStructured(request());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.code);
    expect(result.trace.durationMs).toBe(0);
  });
});

describe('model agent runtime configuration', () => {
  it.each([
    { mode: 'invalid' },
    { provider: 'invalid' },
    { mode: 'mock', provider: 'deepseek' },
    { mode: 'live', provider: 'mock' },
    { liveCallsEnabled: 'yes' },
    { timeoutMs: Number.NaN },
    { now: 123 },
    { executor: 123 },
    { mockResponder: 123 },
    { model: 123 },
    null,
  ])('rejects invalid runtime config fail-closed', (override) => {
    const input =
      override === null
        ? null
        : {
            mode: 'mock',
            provider: 'mock',
            model: 'mock-agent-runtime',
            liveCallsEnabled: false,
            timeoutMs: 100,
            mockResponder: () => ({ route: 'chat' }),
            ...override,
          };
    expect(() =>
      createModelAgentRuntime(input as Parameters<typeof createModelAgentRuntime>[0]),
    ).toThrow(/^INVALID_RUNTIME_CONFIG$/);
  });

  it('rejects unsafe request token values before budget reservation', async () => {
    const result = await liveRuntime().invokeStructured({
      ...request(),
      estimatedInputTokens: Number.MAX_VALUE,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected invalid request');
    expect(result.error.code).toBe('INVALID_REQUEST');
    expect(result.budget.usedCalls).toBe(0);
  });

  it.each([
    null,
    { ...request(), runId: 123 },
    { ...request(), task: 'invalid_task' },
    { ...request(), signal: {} },
    { ...request(), budget: null },
    { ...request(), budget: { ...request().budget, usedCalls: Number.NaN } },
  ])('returns a safe invalid-request result for malformed runtime input', async (malformed) => {
    const invoke = liveRuntime().invokeStructured as (
      value: unknown,
    ) => ReturnType<ReturnType<typeof liveRuntime>['invokeStructured']>;

    const result = await invoke(malformed);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected invalid request');
    expect(result.error.code).toBe('INVALID_REQUEST');
    expect(Number.isSafeInteger(result.budget.maxCalls)).toBe(true);
    expect(Number.isSafeInteger(result.budget.usedCalls)).toBe(true);
    expect(Number.isSafeInteger(result.trace.maxOutputTokens)).toBe(true);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it.each([{ safeParse: () => null }, { safeParse: () => ({ success: true }) }])(
    'rejects fake schemas instead of trusting a safeParse-shaped object',
    async (schema) => {
      const result = await liveRuntime().invokeStructured({
        ...request(),
        schema: schema as unknown as typeof routeSchema,
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected invalid request');
      expect(result.error.code).toBe('INVALID_REQUEST');
      expect(result.budget.usedCalls).toBe(0);
    },
  );
});

function request() {
  return {
    runId: 'run_1',
    task: 'router_fallback' as const,
    schema: routeSchema,
    systemPrompt: 'private system prompt',
    userPrompt: 'private user question',
    estimatedInputTokens: 20,
    maxOutputTokens: 30,
    budget: createModelAgentBudget({
      maxCalls: 1,
      maxInputTokens: 100,
      maxOutputTokens: 50,
    }),
  };
}

function liveRuntime(overrides: Partial<Parameters<typeof createModelAgentRuntime>[0]> = {}) {
  return createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-test',
    liveCallsEnabled: true,
    timeoutMs: 100,
    executor: async () => ({ object: { route: 'chat' } }),
    ...overrides,
  });
}

function apiCallError(statusCode: number): APICallError {
  return new APICallError({
    message: CANARY,
    url: `https://example.invalid/${CANARY}`,
    requestBodyValues: { request: CANARY },
    statusCode,
    responseHeaders: { [CANARY]: CANARY },
    responseBody: JSON.stringify({ body: CANARY }),
    data: { raw: CANARY },
    cause: new Error(CANARY),
    isRetryable: true,
  });
}

function defaultProviderExecutor() {
  return createOpenAICompatibleStructuredExecutor({
    provider: 'deepseek',
    apiKey: 'example-redacted-key',
    baseURL: 'https://api.example.com/v1',
    model: 'deepseek-test',
  });
}
