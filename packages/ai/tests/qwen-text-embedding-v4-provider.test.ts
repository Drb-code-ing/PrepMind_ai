import { describe, expect, test } from 'bun:test';

import {
  calculateQwenTextEmbeddingV4CostCny,
  createQwenTextEmbeddingV4Provider,
  isQwenTextEmbeddingV4ProviderError,
  QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
  QWEN_TEXT_EMBEDDING_V4_ENDPOINT_PROFILE,
  QWEN_TEXT_EMBEDDING_V4_INPUT_PRICE_PER_MILLION_CNY,
  QWEN_TEXT_EMBEDDING_V4_MODEL,
  QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE,
  QWEN_TEXT_EMBEDDING_V4_PRICE_SOURCE_URLS,
  type QwenTextEmbeddingV4FailureCode,
  type QwenTextEmbeddingV4ProviderConfig,
} from '../src/qwen-text-embedding-v4-provider.ts';

const BASE_URL = 'https://ws-task9.cn-beijing.maas.aliyuncs.com/compatible-mode/v1';
const CONFIG: QwenTextEmbeddingV4ProviderConfig = Object.freeze({
  apiKey: 'qwen_task9_component_key_canary',
  baseURL: BASE_URL,
  model: QWEN_TEXT_EMBEDDING_V4_MODEL,
  dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
  priceProfile: QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE,
});

describe('Qwen text-embedding-v4 strict provider', () => {
  test('uses the exact Beijing OpenAI-compatible request and returns ordered verified usage/cost', async () => {
    let calls = 0;
    const provider = createQwenTextEmbeddingV4Provider(CONFIG, {
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls += 1;
        expect(String(input)).toBe(`${BASE_URL}/embeddings`);
        expect(init?.method).toBe('POST');
        expect(init?.redirect).toBe('error');
        expect(init?.credentials).toBe('omit');
        expect(init?.cache).toBe('no-store');
        expect(init?.headers).toEqual({
          authorization: `Bearer ${CONFIG.apiKey}`,
          'content-type': 'application/json',
        });
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        expect(body).toEqual({
          model: 'text-embedding-v4',
          input: ['original query', 'rewritten query'],
          dimensions: 1_536,
          encoding_format: 'float',
        });
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return jsonResponse(successPayload(2, 46, [1, 0]));
      }) as typeof fetch,
    });

    const result = await provider.executor({
      inputs: ['original query', 'rewritten query'],
      dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
      signal: new AbortController().signal,
    });

    expect(calls).toBe(1);
    expect(provider).toMatchObject({
      version: 'qwen-text-embedding-v4-provider-v1',
      provenance: 'synthetic_test',
      endpointProfile: QWEN_TEXT_EMBEDDING_V4_ENDPOINT_PROFILE,
    });
    expect(result.embeddings).toHaveLength(2);
    expect(result.embeddings[0]?.[0]).toBe(1);
    expect(result.embeddings[1]?.[1]).toBe(1);
    expect(result.usage).toEqual({ inputTokens: 46, totalTokens: 46 });
    expect(result.billing).toEqual({
      priceProfile: QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE,
      inputPerMillionCny: QWEN_TEXT_EMBEDDING_V4_INPUT_PRICE_PER_MILLION_CNY,
      verifiedCostCny: 0.000023,
    });
    expect(QWEN_TEXT_EMBEDDING_V4_PRICE_SOURCE_URLS).toEqual([
      'https://help.aliyun.com/zh/model-studio/text-embedding-v4',
      'https://help.aliyun.com/zh/model-studio/embedding-interfaces-compatible-with-openai',
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.embeddings)).toBe(true);
    expect(Object.isFrozen(result.embeddings[0])).toBe(true);
  });

  test('accepts only the frozen Beijing endpoint/model/dimensions/price and marks default transport first-party', () => {
    expect(createQwenTextEmbeddingV4Provider(CONFIG).provenance).toBe(
      'first_party_qwen_text_embedding_v4_direct',
    );
    expect(
      createQwenTextEmbeddingV4Provider({
        ...CONFIG,
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      }).endpointProfile,
    ).toBe(QWEN_TEXT_EMBEDDING_V4_ENDPOINT_PROFILE);

    const invalidConfigs: readonly unknown[] = [
      { ...CONFIG, apiKey: ' borrowed ' },
      { ...CONFIG, model: 'text-embedding-v3' },
      { ...CONFIG, dimensions: 1_024 },
      { ...CONFIG, priceProfile: 'unknown-price' },
      { ...CONFIG, baseURL: 'http://ws-task9.cn-beijing.maas.aliyuncs.com/compatible-mode/v1' },
      {
        ...CONFIG,
        baseURL: 'https://user:secret@ws-task9.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
      },
      { ...CONFIG, baseURL: `${BASE_URL}/` },
      { ...CONFIG, baseURL: `${BASE_URL}?region=beijing` },
      {
        ...CONFIG,
        baseURL: 'https://ws-task9.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
      },
      { ...CONFIG, baseURL: 'https://example.com/compatible-mode/v1' },
      { ...CONFIG, unexpected: true },
    ];

    for (const candidate of invalidConfigs) {
      expectProviderFailure(
        () => createQwenTextEmbeddingV4Provider(candidate as QwenTextEmbeddingV4ProviderConfig),
        'invalid_config',
      );
    }
  });

  test('rejects invalid request and pre-abort before fetch', async () => {
    let calls = 0;
    const provider = createQwenTextEmbeddingV4Provider(CONFIG, {
      fetch: (async () => {
        calls += 1;
        return jsonResponse(successPayload());
      }) as typeof fetch,
    });
    const signal = new AbortController().signal;
    const invalidRequests: readonly unknown[] = [
      { inputs: [], dimensions: 1_536, signal },
      { inputs: Array.from({ length: 11 }, () => 'query'), dimensions: 1_536, signal },
      { inputs: [''], dimensions: 1_536, signal },
      { inputs: [' query '], dimensions: 1_536, signal },
      { inputs: ['x'.repeat(2_001)], dimensions: 1_536, signal },
      { inputs: ['query'], dimensions: 1_024, signal },
      { inputs: ['query'], dimensions: 1_536, signal, extra: true },
    ];
    for (const request of invalidRequests) {
      await expectExecutorFailure(
        () => provider.executor(request as Parameters<typeof provider.executor>[0]),
        'invalid_request',
      );
    }

    const controller = new AbortController();
    controller.abort();
    await expectExecutorFailure(
      () =>
        provider.executor({
          inputs: ['query'],
          dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
          signal: controller.signal,
        }),
      'aborted',
    );
    expect(calls).toBe(0);
  });

  test('maps transport and HTTP failures without retries or raw error leakage', async () => {
    const cases: readonly Readonly<{
      name: string;
      response?: Response;
      error?: Error;
      code: QwenTextEmbeddingV4FailureCode;
    }>[] = [
      { name: 'transport', error: new Error(`raw ${CONFIG.apiKey}`), code: 'provider_unavailable' },
      { name: 'auth', response: jsonResponse({}, 401), code: 'http_auth' },
      { name: 'forbidden', response: jsonResponse({}, 403), code: 'http_auth' },
      { name: 'rate limit', response: jsonResponse({}, 429), code: 'http_rate_limit' },
      { name: 'client', response: jsonResponse({}, 400), code: 'http_client' },
      { name: 'server', response: jsonResponse({}, 503), code: 'http_server' },
      { name: 'redirect', response: jsonResponse({}, 302), code: 'response_invalid' },
    ];

    for (const current of cases) {
      let calls = 0;
      const provider = createQwenTextEmbeddingV4Provider(CONFIG, {
        fetch: (async () => {
          calls += 1;
          if (current.error) throw current.error;
          return current.response as Response;
        }) as typeof fetch,
      });
      const error = await captureExecutorFailure(() => execute(provider));
      expect(error.code, current.name).toBe(current.code);
      expect(error.message, current.name).not.toContain(CONFIG.apiKey);
      expect(error.message, current.name).not.toContain('raw');
      expect(calls, current.name).toBe(1);
    }
  });

  test('fails malformed payload, vector, index, usage, and content type closed', async () => {
    const base = successPayload();
    const cases: readonly Readonly<{
      name: string;
      response: Response;
      code: 'response_invalid' | 'usage_invalid';
    }>[] = [
      {
        name: 'content type',
        response: new Response(JSON.stringify(base), {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
        code: 'response_invalid',
      },
      {
        name: 'invalid json',
        response: new Response('{', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
        code: 'response_invalid',
      },
      {
        name: 'oversized body',
        response: new Response('x'.repeat(2_000_001), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
        code: 'response_invalid',
      },
      {
        name: 'unknown top-level field',
        response: jsonResponse({ ...base, extra: true }),
        code: 'response_invalid',
      },
      {
        name: 'wrong list object',
        response: jsonResponse({ ...base, object: 'embedding' }),
        code: 'response_invalid',
      },
      {
        name: 'wrong model',
        response: jsonResponse({ ...base, model: 'text-embedding-v3' }),
        code: 'response_invalid',
      },
      {
        name: 'missing request id',
        response: jsonResponse(withoutKey(base, 'id')),
        code: 'response_invalid',
      },
      {
        name: 'unknown item field',
        response: jsonResponse({ ...base, data: [{ ...base.data[0], raw: 'forbidden' }] }),
        code: 'response_invalid',
      },
      {
        name: 'wrong item object',
        response: jsonResponse({ ...base, data: [{ ...base.data[0], object: 'list' }] }),
        code: 'response_invalid',
      },
      {
        name: 'wrong vector length',
        response: jsonResponse({ ...base, data: [{ ...base.data[0], embedding: [1] }] }),
        code: 'response_invalid',
      },
      {
        name: 'zero vector',
        response: jsonResponse({
          ...base,
          data: [{ ...base.data[0], embedding: Array(1_536).fill(0) }],
        }),
        code: 'response_invalid',
      },
      {
        name: 'non-number vector',
        response: jsonResponse({
          ...base,
          data: [{ ...base.data[0], embedding: ['not-a-number', ...vector(0).slice(1)] }],
        }),
        code: 'response_invalid',
      },
      {
        name: 'out-of-range index',
        response: jsonResponse({ ...base, data: [{ ...base.data[0], index: 1 }] }),
        code: 'response_invalid',
      },
      {
        name: 'missing usage',
        response: jsonResponse(withoutKey(base, 'usage')),
        code: 'response_invalid',
      },
      {
        name: 'unknown usage field',
        response: jsonResponse({ ...base, usage: { ...base.usage, completion_tokens: 0 } }),
        code: 'usage_invalid',
      },
      {
        name: 'usage mismatch',
        response: jsonResponse({ ...base, usage: { prompt_tokens: 23, total_tokens: 24 } }),
        code: 'usage_invalid',
      },
      {
        name: 'usage zero',
        response: jsonResponse({ ...base, usage: { prompt_tokens: 0, total_tokens: 0 } }),
        code: 'usage_invalid',
      },
      {
        name: 'usage over provider limit',
        response: jsonResponse({ ...base, usage: { prompt_tokens: 8_193, total_tokens: 8_193 } }),
        code: 'usage_invalid',
      },
    ];

    for (const current of cases) {
      let calls = 0;
      const provider = createQwenTextEmbeddingV4Provider(CONFIG, {
        fetch: (async () => {
          calls += 1;
          return current.response;
        }) as typeof fetch,
      });
      const error = await captureExecutorFailure(() => execute(provider));
      expect(error.code, current.name).toBe(current.code);
      expect(calls, current.name).toBe(1);
    }

    const duplicate = successPayload(2, 46, [0, 0]);
    const duplicateProvider = createQwenTextEmbeddingV4Provider(CONFIG, {
      fetch: (async () => jsonResponse(duplicate)) as typeof fetch,
    });
    await expectExecutorFailure(
      () =>
        duplicateProvider.executor({
          inputs: ['one', 'two'],
          dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
          signal: new AbortController().signal,
        }),
      'response_invalid',
    );
  });

  test('maps an in-flight abort once and does not retain the delegate error', async () => {
    let calls = 0;
    const controller = new AbortController();
    const provider = createQwenTextEmbeddingV4Provider(CONFIG, {
      fetch: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        calls += 1;
        await new Promise<void>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new Error(`raw-abort-${CONFIG.apiKey}`)),
            { once: true },
          );
        });
        throw new Error('unreachable');
      }) as typeof fetch,
    });
    const pending = execute(provider, controller.signal);
    await Promise.resolve();
    controller.abort();
    const error = await captureExecutorFailure(() => pending);
    expect(error.code).toBe('aborted');
    expect(error.message).not.toContain(CONFIG.apiKey);
    expect(calls).toBe(1);
  });

  test('calculates the frozen Beijing input-token price exactly and rejects unknown usage', () => {
    expect(calculateQwenTextEmbeddingV4CostCny(0)).toBe(0);
    expect(calculateQwenTextEmbeddingV4CostCny(1)).toBe(0.0000005);
    expect(calculateQwenTextEmbeddingV4CostCny(1_000)).toBe(0.0005);
    expect(calculateQwenTextEmbeddingV4CostCny(1_000_000)).toBe(0.5);
    expectProviderFailure(() => calculateQwenTextEmbeddingV4CostCny(-1), 'usage_invalid');
    expectProviderFailure(() => calculateQwenTextEmbeddingV4CostCny(1.5), 'usage_invalid');
  });
});

function successPayload(
  count = 1,
  usage = 23,
  indexes: readonly number[] = Array.from({ length: count }, (_, index) => index),
) {
  return {
    object: 'list',
    data: indexes.map((index) => ({ object: 'embedding', index, embedding: vector(index) })),
    model: 'text-embedding-v4',
    usage: { prompt_tokens: usage, total_tokens: usage },
    id: 'embedding-request-task9',
  };
}

function vector(index: number): number[] {
  const embedding = Array<number>(1_536).fill(0);
  embedding[index % embedding.length] = 1;
  return embedding;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function withoutKey<T extends Record<string, unknown>>(
  input: T,
  key: keyof T,
): Record<string, unknown> {
  const clone = { ...input };
  delete clone[key];
  return clone;
}

function execute(
  provider: ReturnType<typeof createQwenTextEmbeddingV4Provider>,
  signal: AbortSignal = new AbortController().signal,
) {
  return provider.executor({
    inputs: ['query'],
    dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
    signal,
  });
}

async function captureExecutorFailure(
  callback: () => Promise<unknown>,
): Promise<Error & { code: QwenTextEmbeddingV4FailureCode }> {
  try {
    await callback();
  } catch (error) {
    expect(isQwenTextEmbeddingV4ProviderError(error)).toBe(true);
    if (isQwenTextEmbeddingV4ProviderError(error)) return error;
    throw error;
  }
  throw new Error('expected Qwen provider failure');
}

async function expectExecutorFailure(
  callback: () => Promise<unknown>,
  code: QwenTextEmbeddingV4FailureCode,
) {
  const error = await captureExecutorFailure(callback);
  expect(error.code).toBe(code);
}

function expectProviderFailure(callback: () => unknown, code: QwenTextEmbeddingV4FailureCode) {
  try {
    callback();
  } catch (error) {
    expect(isQwenTextEmbeddingV4ProviderError(error)).toBe(true);
    if (isQwenTextEmbeddingV4ProviderError(error)) expect(error.code).toBe(code);
    return;
  }
  throw new Error('expected Qwen provider failure');
}
