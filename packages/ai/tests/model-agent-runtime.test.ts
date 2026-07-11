import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { createModelAgentBudget } from '../src/model-agent-budget';
import { createModelAgentRuntime } from '../src/model-agent-runtime';

const routeSchema = z.object({ route: z.enum(['chat', 'tutor']) }).strict();

describe('model agent runtime mock mode', () => {
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
    expect(calls).toBe(0);
  });

  it('requires an injected executor before budget reservation', async () => {
    const result = await liveRuntime({ executor: undefined }).invokeStructured(request());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected executor failure');
    expect(result.error.code).toBe('EXECUTOR_UNAVAILABLE');
    expect(result.budget.usedCalls).toBe(0);
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
      retryable: true,
    });
    expect(result.budget.usedCalls).toBe(1);
    expect(JSON.stringify(result)).not.toContain('private provider response');
    expect(JSON.stringify(result)).not.toContain('credential material');
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
              reject(new Error('raw timeout provider error'));
            },
            { once: true },
          );
        }),
    });

    const result = await runtime.invokeStructured(request());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected timeout');
    expect(result.error.code).toBe('TIMEOUT');
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
    expect(result.budget.usedCalls).toBe(0);
    expect(calls).toBe(0);
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
