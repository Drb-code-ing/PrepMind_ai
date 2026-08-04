import { describe, expect, test } from 'bun:test';

import {
  createDeepSeekV4ProNonThinkingStreamingFetch,
  createFinalResponseStreamExecutor,
  FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL,
  FINAL_RESPONSE_STREAM_PROVIDER_COMPLETIONS_URL,
  FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS,
  FINAL_RESPONSE_STREAM_PROVIDER_MODEL,
  isFinalResponseStreamProviderError,
  type FinalResponseStreamExecutorEvent,
} from '../src/final-response-stream-provider.ts';

const CONFIG = Object.freeze({
  apiKey: 'final_response_component_key_canary',
  baseURL: FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL,
  model: FINAL_RESPONSE_STREAM_PROVIDER_MODEL,
});

const SUCCESS_PARTS = Object.freeze([
  { type: 'step-start', warnings: [] },
  { type: 'text-delta', textDelta: '先判断已知条件。' },
  { type: 'text-delta', textDelta: '再代入公式。' },
  {
    type: 'step-finish',
    warnings: [],
    finishReason: 'stop',
    usage: { promptTokens: 320, completionTokens: 24 },
  },
  {
    type: 'finish',
    finishReason: 'stop',
    usage: { promptTokens: 320, completionTokens: 24 },
  },
]);

describe('FinalResponse streaming provider', () => {
  test('forces the exact DeepSeek streaming endpoint, usage stream option, and non-thinking request', async () => {
    let delegated = 0;
    const guardedFetch = createDeepSeekV4ProNonThinkingStreamingFetch((async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      delegated += 1;
      expect(String(input)).toBe(FINAL_RESPONSE_STREAM_PROVIDER_COMPLETIONS_URL);
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.model).toBe('deepseek-v4-pro');
      expect(body.stream).toBe(true);
      expect(body.max_tokens).toBe(1_200);
      expect(body.stream_options).toEqual({ include_usage: true });
      expect(body.thinking).toEqual({ type: 'disabled' });
      expect(body).not.toHaveProperty('tools');
      expect(body).not.toHaveProperty('response_format');
      return new Response('data: [DONE]\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }) as typeof fetch);

    const response = await guardedFetch(FINAL_RESPONSE_STREAM_PROVIDER_COMPLETIONS_URL, {
      method: 'POST',
      body: JSON.stringify({
        model: 'deepseek-v4-pro',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
        max_tokens: 1_200,
        stream_options: { include_usage: true },
      }),
    });
    expect(response.status).toBe(200);
    expect(delegated).toBe(1);

    for (const invalid of [
      {
        url: FINAL_RESPONSE_STREAM_PROVIDER_COMPLETIONS_URL,
        body: { model: 'deepseek-v4-pro', messages: [], stream: true, max_tokens: 1_200 },
      },
      {
        url: FINAL_RESPONSE_STREAM_PROVIDER_COMPLETIONS_URL,
        body: {
          model: 'deepseek-v4-pro',
          messages: [{ role: 'user', content: 'hello' }],
          stream: true,
          max_tokens: 1_200,
          tools: [],
        },
      },
      {
        url: 'https://api.deepseek.com/chat/completions',
        body: {
          model: 'deepseek-v4-pro',
          messages: [{ role: 'user', content: 'hello' }],
          stream: true,
          max_tokens: 1_200,
        },
      },
      {
        url: FINAL_RESPONSE_STREAM_PROVIDER_COMPLETIONS_URL,
        body: {
          model: 'deepseek-v4-pro',
          messages: [{ role: 'user', content: 'hello' }],
          stream: true,
          max_tokens: 1_199,
        },
      },
    ]) {
      await expect(
        guardedFetch(invalid.url, {
          method: 'POST',
          body: JSON.stringify(invalid.body),
        }),
      ).rejects.toMatchObject({ code: 'schema_invalid' });
    }
    expect(delegated).toBe(1);
  });

  test('streams text once with no retry/tools and returns only verified usage and finish reason', async () => {
    let providerCalls = 0;
    let streamCalls = 0;
    const executor = createFinalResponseStreamExecutor(CONFIG, {
      createProvider(config) {
        providerCalls += 1;
        expect(config.baseURL).toBe('https://api.deepseek.com/v1');
        expect(config.compatibility).toBe('strict');
        expect(typeof config.fetch).toBe('function');
        return (model) => ({ model });
      },
      streamText(input) {
        streamCalls += 1;
        expect(input.model).toEqual({ model: 'deepseek-v4-pro' });
        expect(input.maxTokens).toBe(1_200);
        expect(input.maxRetries).toBe(0);
        expect(input.maxSteps).toBe(1);
        expect(input).not.toHaveProperty('tools');
        return streamResult(SUCCESS_PARTS);
      },
    });

    expect(providerCalls).toBe(1);
    expect(streamCalls).toBe(0);
    await expect(collect(executor)).resolves.toEqual([
      { type: 'text_delta', text: '先判断已知条件。' },
      { type: 'text_delta', text: '再代入公式。' },
      {
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 320, outputTokens: 24 },
      },
    ]);
    expect(streamCalls).toBe(1);
  });

  test('fails reasoning, tools, warnings, unknown usage, unknown finish, and late stream events closed', async () => {
    const cases: readonly Readonly<{
      name: string;
      parts?: readonly unknown[];
      extras?: Partial<ReturnType<typeof streamResult>>;
      code: 'schema_invalid' | 'provider_unavailable';
    }>[] = [
      {
        name: 'reasoning event',
        parts: [SUCCESS_PARTS[0], { type: 'reasoning', textDelta: 'hidden' }],
        code: 'schema_invalid',
      },
      {
        name: 'tool event',
        parts: [SUCCESS_PARTS[0], { type: 'tool-call', toolName: 'write' }],
        code: 'schema_invalid',
      },
      {
        name: 'provider warnings',
        extras: { warnings: Promise.resolve([{ type: 'unsupported-setting' }]) },
        code: 'schema_invalid',
      },
      {
        name: 'unknown usage',
        parts: SUCCESS_PARTS.map((part) =>
          part.type === 'step-finish' || part.type === 'finish'
            ? { ...part, usage: { promptTokens: undefined, completionTokens: 24 } }
            : part,
        ),
        code: 'schema_invalid',
      },
      {
        name: 'unknown finish reason',
        parts: SUCCESS_PARTS.map((part) =>
          part.type === 'step-finish' || part.type === 'finish'
            ? { ...part, finishReason: 'tool-calls' }
            : part,
        ),
        code: 'schema_invalid',
      },
      {
        name: 'provider error',
        parts: [SUCCESS_PARTS[0], { type: 'error', error: new Error('raw') }],
        code: 'provider_unavailable',
      },
      {
        name: 'late delta',
        parts: [...SUCCESS_PARTS, { type: 'text-delta', textDelta: 'late' }],
        code: 'schema_invalid',
      },
      {
        name: 'duplicate finish',
        parts: [...SUCCESS_PARTS, SUCCESS_PARTS[SUCCESS_PARTS.length - 1]],
        code: 'schema_invalid',
      },
    ];

    for (const current of cases) {
      const executor = createFinalResponseStreamExecutor(CONFIG, {
        createProvider: () => () => ({}),
        streamText: () => ({
          ...streamResult(current.parts ?? SUCCESS_PARTS),
          ...current.extras,
        }),
      });
      try {
        await collect(executor);
        throw new Error(`expected ${current.name} to fail`);
      } catch (error) {
        expect(isFinalResponseStreamProviderError(error), current.name).toBe(true);
        if (isFinalResponseStreamProviderError(error))
          expect(error.code, current.name).toBe(current.code);
      }
    }
  });

  test('maps streaming transport rejection and mid-stream AbortSignal without retry', async () => {
    const rejected = createFinalResponseStreamExecutor(CONFIG, {
      createProvider: () => () => ({}),
      streamText: () => ({
        ...streamResult([]),
        fullStream: (async function* () {
          yield SUCCESS_PARTS[0];
          throw new Error('raw transport rejection');
        })(),
      }),
    });
    try {
      await collect(rejected);
      throw new Error('expected transport rejection');
    } catch (error) {
      expect(isFinalResponseStreamProviderError(error)).toBe(true);
      if (isFinalResponseStreamProviderError(error)) {
        expect(error.code).toBe('provider_unavailable');
        expect(error.message).not.toContain('raw transport rejection');
      }
    }

    const controller = new AbortController();
    let streamCalls = 0;
    const aborted = createFinalResponseStreamExecutor(CONFIG, {
      createProvider: () => () => ({}),
      streamText: (input) => {
        streamCalls += 1;
        return {
          ...streamResult([]),
          fullStream: (async function* () {
            yield SUCCESS_PARTS[0];
            if (!input.abortSignal.aborted) {
              await new Promise<void>((resolve) =>
                input.abortSignal.addEventListener('abort', () => resolve(), { once: true }),
              );
            }
            throw new Error('raw abort rejection');
          })(),
        };
      },
    });
    const pending = collect(aborted, controller.signal);
    await Promise.resolve();
    controller.abort();
    try {
      await pending;
      throw new Error('expected mid-stream abort');
    } catch (error) {
      expect(isFinalResponseStreamProviderError(error)).toBe(true);
      if (isFinalResponseStreamProviderError(error)) expect(error.code).toBe('aborted');
    }
    expect(streamCalls).toBe(1);
  });

  test('rejects invalid config and pre-abort before the stream executor is invoked', async () => {
    expect(() =>
      createFinalResponseStreamExecutor({
        ...CONFIG,
        baseURL: 'https://api.deepseek.com' as typeof CONFIG.baseURL,
      }),
    ).toThrow();
    expect(() =>
      createFinalResponseStreamExecutor({
        ...CONFIG,
        apiKey: '  borrowed_key  ',
      }),
    ).toThrow();

    let streamCalls = 0;
    const executor = createFinalResponseStreamExecutor(CONFIG, {
      createProvider: () => () => ({}),
      streamText: () => {
        streamCalls += 1;
        return streamResult(SUCCESS_PARTS);
      },
    });
    const controller = new AbortController();
    controller.abort();
    try {
      await collect(executor, controller.signal);
      throw new Error('expected abort');
    } catch (error) {
      expect(isFinalResponseStreamProviderError(error)).toBe(true);
      if (isFinalResponseStreamProviderError(error)) expect(error.code).toBe('aborted');
    }
    expect(streamCalls).toBe(0);
  });
});

function streamResult(parts: readonly unknown[]) {
  return {
    fullStream: (async function* () {
      for (const part of parts) yield part;
    })(),
    warnings: Promise.resolve(undefined),
    reasoning: Promise.resolve(undefined),
    reasoningDetails: Promise.resolve([]),
    toolCalls: Promise.resolve([]),
    toolResults: Promise.resolve([]),
    sources: Promise.resolve([]),
    files: Promise.resolve([]),
  };
}

async function collect(
  executor: ReturnType<typeof createFinalResponseStreamExecutor>,
  signal: AbortSignal = new AbortController().signal,
): Promise<FinalResponseStreamExecutorEvent[]> {
  const events: FinalResponseStreamExecutorEvent[] = [];
  for await (const event of executor({
    systemPrompt: 'You are a safe final response renderer.',
    userPrompt: '{"latestUserMessage":"hello"}',
    maxOutputTokens: FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS,
    signal,
  })) {
    events.push(event);
  }
  return events;
}
