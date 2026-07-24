import { afterEach, describe, expect, test } from 'bun:test';
import { z } from 'zod';

import {
  createDeepSeekV4ProNonThinkingFetch,
  DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL,
  DEEPSEEK_V4_PRO_NONTHINKING_COMPLETIONS_URL,
  DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
} from '../src/model-agent-deepseek-v4-pro-nonthinking.ts';
import {
  createOpenAICompatibleStructuredExecutor,
  type ModelAgentProviderDependencies,
} from '../src/model-agent-provider.ts';
import { takeModelAgentProviderFailure } from '../src/model-agent-provider-failure.ts';
import { createModelAgentRuntime } from '../src/model-agent-runtime.ts';
import { createModelAgentBudget } from '../src/model-agent-budget.ts';

const originalFetch = globalThis.fetch;
const responseSchema = z.object({ answer: z.literal('bounded') }).strict();

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('model agent V3 zero-network compatibility harness', () => {
  test('rejects invalid config before provider construction or any fetch boundary', () => {
    let providerCalls = 0;
    let generationCalls = 0;
    const dependencies: ModelAgentProviderDependencies = {
      createProvider: () => {
        providerCalls += 1;
        return providerClient();
      },
      generateStructured: async () => {
        generationCalls += 1;
        return { object: { answer: 'bounded' } };
      },
    };

    expect(() =>
      createOpenAICompatibleStructuredExecutor(
        {
          provider: 'deepseek',
          apiKey: 'sentinel-component-key',
          baseURL: 'https://api.deepseek.com/v1?unsafe=true',
          model: DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
          structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
        },
        dependencies,
      ),
    ).toThrow('INVALID_MODEL_PROVIDER_CONFIG');
    expect(providerCalls).toBe(0);
    expect(generationCalls).toBe(0);
  });

  test('contains provider factory failure before generation and synthetic fetch dispatch', () => {
    let generationCalls = 0;
    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      throw new Error('UNEXPECTED_NETWORK_BOUNDARY');
    };
    const dependencies: ModelAgentProviderDependencies = {
      createProvider: () => {
        throw new Error('RAW_FACTORY_FAILURE_CANARY');
      },
      generateStructured: async () => {
        generationCalls += 1;
        return { object: { answer: 'bounded' } };
      },
    };

    expect(() => createExecutor(dependencies)).toThrow(
      'MODEL_AGENT_PROVIDER_INITIALIZATION_FAILED',
    );
    expect(generationCalls).toBe(0);
    expect(fetchCalls).toBe(0);
  });

  test('proves exact config, request shaping, response audit, schema handoff, and abort wiring locally', async () => {
    let delegateCalls = 0;
    let wrappedFetch: typeof fetch | undefined;
    let requestBody: Record<string, unknown> | undefined;
    const controller = new AbortController();
    globalThis.fetch = async (input, init) => {
      delegateCalls += 1;
      expect(String(input)).toBe(DEEPSEEK_V4_PRO_NONTHINKING_COMPLETIONS_URL);
      expect(init?.method).toBe('POST');
      expect(init?.signal).toBe(controller.signal);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return jsonResponse({
        choices: [{ message: { content: '{"answer":"bounded"}' } }],
        usage: { prompt_tokens: 11, completion_tokens: 5 },
      });
    };
    const dependencies: ModelAgentProviderDependencies = {
      createProvider: (config) => {
        expect(config.apiKey).toBe('sentinel-component-key');
        expect(config.baseURL).toBe(DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL);
        expect(config.fetch).toBeTypeOf('function');
        wrappedFetch = config.fetch;
        return providerClient();
      },
      generateStructured: async (input) => {
        expect(input.mode).toBe('json');
        expect(input.maxRetries).toBe(0);
        expect(input.abortSignal).toBe(controller.signal);
        expect(input.system).toBe('bounded-system');
        expect(input.prompt).toBe('bounded-user');
        if (!wrappedFetch) throw new Error('wrapped fetch missing');
        await wrappedFetch(DEEPSEEK_V4_PRO_NONTHINKING_COMPLETIONS_URL, {
          method: 'POST',
          signal: input.abortSignal,
          body: JSON.stringify({
            model: DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
            messages: [{ role: 'user', content: 'bounded-local-fixture' }],
            response_format: { type: 'json_object' },
          }),
        });
        return {
          object: { answer: 'bounded' },
          usage: { promptTokens: 11, completionTokens: 5 },
        };
      },
    };
    const executor = createExecutor(dependencies);

    const result = await executor({
      schema: responseSchema,
      systemPrompt: 'bounded-system',
      userPrompt: 'bounded-user',
      maxOutputTokens: 20,
      signal: controller.signal,
    });

    expect(result).toEqual({
      object: { answer: 'bounded' },
      usage: { inputTokens: 11, outputTokens: 5 },
    });
    expect(delegateCalls).toBe(1);
    expect(requestBody).toMatchObject({
      model: DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
    });
    expect(requestBody).not.toHaveProperty('tools');
    expect(requestBody).not.toHaveProperty('functions');
    expect(requestBody).not.toHaveProperty('json_schema');
    expect(JSON.stringify(requestBody)).not.toContain('sentinel-component-key');
  });

  test('reduces a response-audit rejection to an opaque local signal without retaining content', async () => {
    const responseCanary = 'RAW_PROVIDER_RESPONSE_CANARY';
    const controller = new AbortController();
    const wrappedFetch = createDeepSeekV4ProNonThinkingFetch(async () =>
      jsonResponse({
        choices: [{ message: { content: responseCanary, reasoning_content: responseCanary } }],
        usage: {
          prompt_tokens: 11,
          completion_tokens: 5,
          completion_tokens_details: { reasoning_tokens: 3 },
        },
      }),
    );
    let captured: unknown;
    const dependencies: ModelAgentProviderDependencies = {
      createProvider: () => providerClient(),
      generateStructured: async () => {
        await wrappedFetch(DEEPSEEK_V4_PRO_NONTHINKING_COMPLETIONS_URL, {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            model: DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
            response_format: { type: 'json_object' },
          }),
        });
        return { object: { answer: 'bounded' } };
      },
    };
    const executor = createExecutor(dependencies);

    try {
      await executor({
        schema: responseSchema,
        systemPrompt: 'bounded-system',
        userPrompt: 'bounded-user',
        maxOutputTokens: 20,
        signal: controller.signal,
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(Error);
    expect(String(captured)).not.toContain(responseCanary);
    expect(takeModelAgentProviderFailure(captured, controller.signal)).toEqual({
      category: 'unknown',
    });
  });

  test('keeps schema and timeout failures bounded without touching a network delegate', async () => {
    let executorCalls = 0;
    const schemaRuntime = createModelAgentRuntime({
      mode: 'live',
      provider: 'deepseek',
      model: DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
      liveCallsEnabled: true,
      timeoutMs: 100,
      executor: async () => {
        executorCalls += 1;
        return { object: { answer: 'wrong' }, usage: { inputTokens: 4, outputTokens: 2 } };
      },
    });
    const schemaFailure = await schemaRuntime.invokeStructured({
      runId: 'v3-zero-network-schema',
      task: 'tutor_strategy',
      schema: responseSchema,
      systemPrompt: 'bounded-system',
      userPrompt: 'bounded-user',
      estimatedInputTokens: 4,
      maxOutputTokens: 20,
      budget: createModelAgentBudget({
        maxCalls: 1,
        maxInputTokens: 100,
        maxOutputTokens: 20,
      }),
    });
    expect(schemaFailure.ok).toBe(false);
    if (schemaFailure.ok) throw new Error('expected schema failure');
    expect(schemaFailure.error.code).toBe('SCHEMA_INVALID');
    expect(schemaFailure.trace.providerFailureCategory).toBeUndefined();
    expect(executorCalls).toBe(1);

    const timeoutRuntime = createModelAgentRuntime({
      mode: 'live',
      provider: 'deepseek',
      model: DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
      liveCallsEnabled: true,
      timeoutMs: 50,
      executor: async ({ signal }) =>
        await new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('LOCAL_ABORT_CANARY')), {
            once: true,
          });
        }),
    });
    const timeoutFailure = await timeoutRuntime.invokeStructured({
      runId: 'v3-zero-network-timeout',
      task: 'wrong_question_organization',
      schema: responseSchema,
      systemPrompt: 'bounded-system',
      userPrompt: 'bounded-user',
      estimatedInputTokens: 4,
      maxOutputTokens: 20,
      budget: createModelAgentBudget({
        maxCalls: 1,
        maxInputTokens: 100,
        maxOutputTokens: 20,
      }),
    });
    expect(timeoutFailure.ok).toBe(false);
    if (timeoutFailure.ok) throw new Error('expected timeout failure');
    expect(timeoutFailure.error.code).toBe('TIMEOUT');
    expect(JSON.stringify(timeoutFailure)).not.toContain('LOCAL_ABORT_CANARY');
  });
});

function createExecutor(dependencies: ModelAgentProviderDependencies) {
  return createOpenAICompatibleStructuredExecutor(
    {
      provider: 'deepseek',
      apiKey: 'sentinel-component-key',
      baseURL: DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL,
      model: DEEPSEEK_V4_PRO_NONTHINKING_MODEL,
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    },
    dependencies,
  );
}

function providerClient() {
  return (() => ({ provider: 'local-fixture-model' })) as ReturnType<
    ModelAgentProviderDependencies['createProvider']
  >;
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
