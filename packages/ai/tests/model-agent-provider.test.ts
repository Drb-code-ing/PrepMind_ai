import { describe, expect, it } from 'bun:test';
import { APICallError } from 'ai';
import { z } from 'zod';

import { takeModelAgentProviderFailureCategory } from '../src/model-agent-provider-failure';
import { createOpenAICompatibleStructuredExecutor } from '../src/model-agent-provider';

const schema = z.object({ route: z.enum(['chat', 'tutor']) }).strict();
const CANARY = 'provider-adapter-raw-canary-must-not-leak';

describe('OpenAI-compatible model agent executor', () => {
  it('passes secrets only into provider closure and maps safe usage', async () => {
    let providerConfig: unknown;
    let invocation: Record<string, unknown> | undefined;
    const modelHandle = { kind: 'fake-model' };
    const executor = createOpenAICompatibleStructuredExecutor(
      {
        provider: 'deepseek',
        apiKey: '  example-redacted-key  ',
        baseURL: '  https://api.deepseek.com  ',
        model: '  deepseek-test  ',
      },
      {
        createProvider: (config) => {
          providerConfig = config;
          return (model) => {
            expect(model).toBe('deepseek-test');
            return modelHandle;
          };
        },
        generateStructured: async (input) => {
          invocation = input;
          return {
            object: { route: 'tutor' },
            usage: { promptTokens: 21, completionTokens: 8 },
            rawResponse: { privateHeader: 'must-not-return' },
          };
        },
      },
    );
    const controller = new AbortController();
    const result = await executor({
      schema,
      systemPrompt: 'system',
      userPrompt: 'question',
      maxOutputTokens: 40,
      signal: controller.signal,
    });

    expect(providerConfig).toEqual({
      apiKey: 'example-redacted-key',
      baseURL: 'https://api.deepseek.com',
    });
    expect(invocation).toMatchObject({
      model: modelHandle,
      mode: 'json',
      schema,
      system: 'system',
      prompt: 'question',
      maxTokens: 40,
      maxRetries: 0,
      abortSignal: controller.signal,
    });
    expect(result).toEqual({
      object: { route: 'tutor' },
      usage: { inputTokens: 21, outputTokens: 8 },
    });
    expect(Object.keys(executor)).not.toContain('apiKey');
    expect(JSON.stringify(result)).not.toContain('must-not-return');
    expect(JSON.stringify(result)).not.toContain('example-redacted-key');
  });

  it('uses the real AI SDK JSON wire mode and rejects invalid structured output', async () => {
    const originalFetch = globalThis.fetch;
    const requestBodies: Array<Record<string, unknown>> = [];
    let responseIndex = 0;
    globalThis.fetch = (async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      const content = responseIndex++ === 0 ? '{"route":"tutor"}' : '{"route":"unsafe"}';
      return new Response(
        JSON.stringify({
          id: `chatcmpl-${responseIndex}`,
          object: 'chat.completion',
          created: 1,
          model: 'deepseek-test',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content },
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
      const executor = createOpenAICompatibleStructuredExecutor({
        provider: 'deepseek',
        apiKey: 'example-redacted-key',
        baseURL: 'https://api.example.com/v1',
        model: 'deepseek-test',
      });
      const request = {
        schema,
        systemPrompt: 'system',
        userPrompt: 'question',
        maxOutputTokens: 40,
        signal: new AbortController().signal,
      };

      await expect(executor(request)).resolves.toMatchObject({
        object: { route: 'tutor' },
        usage: { inputTokens: 21, outputTokens: 8 },
      });
      expect(requestBodies[0]?.response_format).toEqual({ type: 'json_object' });
      expect(requestBodies[0]?.tools).toBeUndefined();
      const messages = requestBodies[0]?.messages as Array<{ content?: string }>;
      expect(messages[0]?.content).toContain('"route"');

      const error = await captureRejection(executor(request));
      expectSafeProviderSignal(error, 'structured_output', request.signal);
      expect(requestBodies[1]?.response_format).toEqual({ type: 'json_object' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not retry retryable provider failures inside one executor invocation', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response(
        JSON.stringify({
          error: {
            message: 'temporary provider failure',
            type: 'server_error',
          },
        }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;

    try {
      const executor = createOpenAICompatibleStructuredExecutor({
        provider: 'deepseek',
        apiKey: 'example-redacted-key',
        baseURL: 'https://api.example.com/v1',
        model: 'deepseek-test',
      });

      const invocationScope = new AbortController().signal;
      const error = await captureRejection(
        executor({
          schema,
          systemPrompt: 'system',
          userPrompt: 'question',
          maxOutputTokens: 40,
          signal: invocationScope,
        }),
      );
      expectSafeProviderSignal(error, 'http_server', invocationScope);
      expect(fetchCalls).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it.each([
    { apiKey: '', baseURL: 'https://api.deepseek.com', model: 'deepseek-test' },
    { apiKey: 'key', baseURL: 'http://api.example.com', model: 'model' },
    { apiKey: 'key', baseURL: 'not-a-url', model: 'model' },
    { apiKey: 'key', baseURL: 'https://user:pass@api.example.com', model: 'model' },
    { apiKey: 'key', baseURL: 'https://api.example.com?secret=value', model: 'model' },
    { apiKey: 'key', baseURL: 'https://api.example.com#private', model: 'model' },
    { apiKey: 'key', baseURL: 'https://api.example.com', model: '' },
  ])('rejects unsafe config before creating provider', (invalid) => {
    let calls = 0;

    expect(() =>
      createOpenAICompatibleStructuredExecutor(
        { provider: 'deepseek', ...invalid },
        {
          createProvider: () => {
            calls += 1;
            return () => ({});
          },
          generateStructured: async () => ({ object: {} }),
        },
      ),
    ).toThrow('INVALID_MODEL_PROVIDER_CONFIG');
    expect(calls).toBe(0);
  });

  it('sanitizes provider creation errors at the public adapter boundary', () => {
    expect(() =>
      createOpenAICompatibleStructuredExecutor(
        {
          provider: 'deepseek',
          apiKey: 'example-redacted-key',
          baseURL: 'https://api.deepseek.com',
          model: 'deepseek-test',
        },
        {
          createProvider: () => {
            throw new Error('raw provider creation error with https://private.example');
          },
          generateStructured: async () => ({ object: {} }),
        },
      ),
    ).toThrow(/^MODEL_AGENT_PROVIDER_INITIALIZATION_FAILED$/);
  });

  it('sanitizes invocation errors when the exported executor is called directly', async () => {
    const executor = createOpenAICompatibleStructuredExecutor(
      {
        provider: 'deepseek',
        apiKey: 'example-redacted-key',
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-test',
      },
      {
        createProvider: () => () => ({}),
        generateStructured: async () => {
          throw new Error('raw response with https://private.example and secret header');
        },
      },
    );

    await expect(
      executor({
        schema,
        systemPrompt: 'system',
        userPrompt: 'question',
        maxOutputTokens: 40,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/^MODEL_AGENT_PROVIDER_REQUEST_FAILED$/);
  });

  it.each([
    {
      label: 'real AI SDK API call error',
      createError: () => apiCallError(429),
    },
    {
      label: 'forged official AI SDK marker',
      createError: () =>
        Object.assign(new Error(CANARY), {
          [Symbol.for('vercel.ai.error.AI_APICallError')]: true,
          statusCode: 401,
          rawBody: CANARY,
        }),
    },
    {
      label: 'plain error',
      createError: () => new Error(`${CANARY} https://private.example`),
    },
  ])('downgrades an injected $label to an untrusted unknown signal', async ({ createError }) => {
    const executor = createOpenAICompatibleStructuredExecutor(
      {
        provider: 'deepseek',
        apiKey: 'example-redacted-key',
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-test',
      },
      {
        createProvider: () => () => ({}),
        generateStructured: async () => {
          throw createError();
        },
      },
    );

    const invocationScope = new AbortController().signal;
    const error = await captureRejection(
      executor({
        schema,
        systemPrompt: 'system',
        userPrompt: 'question',
        maxOutputTokens: 40,
        signal: invocationScope,
      }),
    );

    expectSafeProviderSignal(error, 'unknown', invocationScope);
  });

  it('does not trust a default executor signal replayed by injected dependencies', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: {
            message: CANARY,
            type: 'server_error',
          },
        }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch;

    try {
      const trustedExecutor = createOpenAICompatibleStructuredExecutor({
        provider: 'deepseek',
        apiKey: 'example-redacted-key',
        baseURL: 'https://api.example.com/v1',
        model: 'deepseek-test',
      });
      const trustedScope = new AbortController().signal;
      const replayedSignal = await captureRejection(
        trustedExecutor({
          schema,
          systemPrompt: 'system',
          userPrompt: 'question',
          maxOutputTokens: 40,
          signal: trustedScope,
        }),
      );

      const injectedExecutor = createOpenAICompatibleStructuredExecutor(
        {
          provider: 'deepseek',
          apiKey: 'example-redacted-key',
          baseURL: 'https://api.deepseek.com',
          model: 'deepseek-test',
        },
        {
          createProvider: () => () => ({}),
          generateStructured: async () => {
            throw replayedSignal;
          },
        },
      );
      const injectedScope = new AbortController().signal;
      const replayResult = await captureRejection(
        injectedExecutor({
          schema,
          systemPrompt: 'system',
          userPrompt: 'question',
          maxOutputTokens: 40,
          signal: injectedScope,
        }),
      );

      expect(replayResult).not.toBe(replayedSignal);
      expectSafeProviderSignal(replayResult, 'unknown', injectedScope);
      expectSafeProviderSignal(replayedSignal, 'http_server', trustedScope);
      expect(JSON.stringify(replayResult)).not.toContain(CANARY);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it.each([
    null,
    {
      provider: 'deepseek',
      apiKey: 123,
      baseURL: 'https://api.deepseek.com',
      model: 'deepseek-test',
    },
  ])('rejects malformed provider config with a fixed safe error', (config) => {
    expect(() =>
      createOpenAICompatibleStructuredExecutor(
        config as unknown as Parameters<typeof createOpenAICompatibleStructuredExecutor>[0],
      ),
    ).toThrow(/^INVALID_MODEL_PROVIDER_CONFIG$/);
  });

  it.each([
    null,
    Object.defineProperty({}, 'object', {
      get() {
        throw new Error('raw sensitive getter error');
      },
    }),
  ])('sanitizes malformed resolved provider results', async (providerResult) => {
    const executor = createOpenAICompatibleStructuredExecutor(
      {
        provider: 'deepseek',
        apiKey: 'example-redacted-key',
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-test',
      },
      {
        createProvider: () => () => ({}),
        generateStructured: async () =>
          providerResult as unknown as Awaited<
            ReturnType<
              Parameters<typeof createOpenAICompatibleStructuredExecutor>[1]['generateStructured']
            >
          >,
      },
    );

    await expect(
      executor({
        schema,
        systemPrompt: 'system',
        userPrompt: 'question',
        maxOutputTokens: 40,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/^MODEL_AGENT_PROVIDER_REQUEST_FAILED$/);
  });
});

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected provider rejection');
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

function expectSafeProviderSignal(
  error: unknown,
  expectedCategory: string,
  expectedScope: AbortSignal,
): void {
  expect(error).toBeInstanceOf(Error);
  if (!(error instanceof Error)) throw new Error('expected safe provider signal');
  expect(error.name).toBe('ModelAgentProviderFailure');
  expect(error.message).toBe('MODEL_AGENT_PROVIDER_REQUEST_FAILED');
  expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
  expect(takeModelAgentProviderFailureCategory(error, expectedScope)).toBe(expectedCategory);
  expect(JSON.stringify(error)).not.toContain(CANARY);
  expect(error.message).not.toContain(CANARY);
  expect(error.stack).not.toContain(CANARY);
}
