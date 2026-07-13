import { describe, expect, it } from 'bun:test';
import {
  APICallError,
  EmptyResponseBodyError,
  InvalidResponseDataError,
  JSONParseError,
  NoObjectGeneratedError,
  TypeValidationError,
} from 'ai';

import {
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  type ModelAgentError,
  type ModelAgentTrace,
} from '../src/model-agent-contract';
import {
  createTrustedModelAgentProviderFailureSignal,
  createUntrustedModelAgentProviderFailureSignal,
  takeModelAgentProviderFailureCategory,
} from '../src/model-agent-provider-failure';

const CANARY = 'provider-failure-canary-must-not-leak';
const TEST_SCOPE = new AbortController().signal;

describe('model agent provider failure contract', () => {
  it('defines the only allowed provider failure categories in stable order', () => {
    expect(MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES).toEqual([
      'http_auth',
      'http_rate_limit',
      'http_client',
      'http_server',
      'transport',
      'structured_output',
      'invalid_response',
      'unknown',
    ]);
    expect(Object.isFrozen(MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES)).toBe(true);
  });

  it('allows the shared category on safe errors and traces', () => {
    const error: ModelAgentError = {
      code: 'PROVIDER_ERROR',
      message: 'MODEL_AGENT_PROVIDER_REQUEST_FAILED',
      retryable: false,
      providerFailureCategory: 'http_auth',
    };
    const trace: ModelAgentTrace = {
      runIdHash: 'sha256:test',
      task: 'router_fallback',
      mode: 'live',
      provider: 'deepseek',
      model: 'test-model',
      status: 'failed',
      maxOutputTokens: 64,
      durationMs: 1,
      degraded: true,
      inputTokens: 0,
      outputTokens: 0,
      errorCode: 'PROVIDER_ERROR',
      providerFailureCategory: 'http_auth',
    };

    expect(error.providerFailureCategory).toBe('http_auth');
    expect(trace.providerFailureCategory).toBe('http_auth');
  });
});

describe('model agent provider failure signal', () => {
  it.each([
    {
      label: 'plain JSON parse marker object',
      error: { [Symbol.for('vercel.ai.error.AI_JSONParseError')]: true },
      officialGuard: (error: unknown) => JSONParseError.isInstance(error),
      expected: 'structured_output',
    },
    {
      label: 'plain API call marker object',
      error: {
        [Symbol.for('vercel.ai.error.AI_APICallError')]: true,
        statusCode: 401,
      },
      officialGuard: (error: unknown) => APICallError.isInstance(error),
      expected: 'http_auth',
    },
    {
      label: 'Error with a JSON parse marker',
      error: Object.assign(new Error(CANARY), {
        [Symbol.for('vercel.ai.error.AI_JSONParseError')]: true,
      }),
      officialGuard: (error: unknown) => JSONParseError.isInstance(error),
      expected: 'structured_output',
    },
    {
      label: 'Error with an API call marker',
      error: Object.assign(new Error(CANARY), {
        [Symbol.for('vercel.ai.error.AI_APICallError')]: true,
        statusCode: 401,
      }),
      officialGuard: (error: unknown) => APICallError.isInstance(error),
      expected: 'http_auth',
    },
  ])(
    'follows official cross-bundle marker semantics for a $label; marker is not provenance',
    ({ error, officialGuard, expected }) => {
      // Official Symbol.for markers provide cross-bundle compatibility, not cryptographic identity.
      // Only a private adapter catch boundary can establish trusted provenance.
      expect(officialGuard(error)).toBe(true);
      expectSanitizedSignal(
        createTrustedModelAgentProviderFailureSignal(error, TEST_SCOPE),
        expected,
      );
      expectSanitizedSignal(createUntrustedModelAgentProviderFailureSignal(TEST_SCOPE), 'unknown');
    },
  );

  it.each([
    { statusCode: 401, expected: 'http_auth' },
    { statusCode: 403, expected: 'http_auth' },
    { statusCode: 429, expected: 'http_rate_limit' },
    { statusCode: 399, expected: 'unknown' },
    { statusCode: 400, expected: 'http_client' },
    { statusCode: 422, expected: 'http_client' },
    { statusCode: 499, expected: 'http_client' },
    { statusCode: 500, expected: 'http_server' },
    { statusCode: 503, expected: 'http_server' },
    { statusCode: 599, expected: 'http_server' },
    { statusCode: undefined, expected: 'transport' },
    { statusCode: 600, expected: 'unknown' },
    { statusCode: '429', expected: 'unknown' },
    { statusCode: Number.NaN, expected: 'unknown' },
    { statusCode: Number.POSITIVE_INFINITY, expected: 'unknown' },
    { statusCode: 429.5, expected: 'unknown' },
  ] as const)(
    'classifies an API call with status $statusCode as $expected without leaking provider fields',
    ({ statusCode, expected }) => {
      const providerError = apiCallError(statusCode);
      const signal = createTrustedModelAgentProviderFailureSignal(providerError, TEST_SCOPE);

      expectSanitizedSignal(signal, expected);
      expect(signal).not.toBe(providerError);
    },
  );

  it('classifies an API call as unknown when its status getter throws', () => {
    const providerError = apiCallError(429);
    Object.defineProperty(providerError, 'statusCode', {
      configurable: true,
      get() {
        throw new Error(CANARY);
      },
    });

    expectSanitizedSignal(
      createTrustedModelAgentProviderFailureSignal(providerError, TEST_SCOPE),
      'unknown',
    );
  });

  it.each([
    {
      label: 'no object generated',
      error: () =>
        new NoObjectGeneratedError({
          message: CANARY,
          cause: new Error(CANARY),
          text: CANARY,
          response: {
            id: CANARY,
            timestamp: new Date(0),
            modelId: CANARY,
            headers: { [CANARY]: CANARY },
          },
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          finishReason: 'error',
        }),
    },
    {
      label: 'JSON parse',
      error: () => new JSONParseError({ text: CANARY, cause: new Error(CANARY) }),
    },
    {
      label: 'type validation',
      error: () =>
        new TypeValidationError({
          value: { raw: CANARY },
          cause: new Error(CANARY),
        }),
    },
  ])('classifies $label errors as structured output failures', ({ error }) => {
    expectSanitizedSignal(
      createTrustedModelAgentProviderFailureSignal(error(), TEST_SCOPE),
      'structured_output',
    );
  });

  it('keeps structured output priority when a real structured error also has an API marker', () => {
    const structuredError = new JSONParseError({
      text: CANARY,
      cause: new Error(CANARY),
    });
    Object.defineProperty(structuredError, Symbol.for('vercel.ai.error.AI_APICallError'), {
      value: true,
    });

    expectSanitizedSignal(
      createTrustedModelAgentProviderFailureSignal(structuredError, TEST_SCOPE),
      'structured_output',
    );
  });

  it.each([
    {
      label: 'empty response body',
      error: () => new EmptyResponseBodyError({ message: CANARY }),
    },
    {
      label: 'invalid response data',
      error: () =>
        new InvalidResponseDataError({
          message: CANARY,
          data: { raw: CANARY },
        }),
    },
  ])('classifies $label errors as invalid responses', ({ error }) => {
    expectSanitizedSignal(
      createTrustedModelAgentProviderFailureSignal(error(), TEST_SCOPE),
      'invalid_response',
    );
  });

  it('only classifies the outermost error and never follows cause', () => {
    const outerError = new Error(CANARY, { cause: apiCallError(401) });

    expectSanitizedSignal(
      createTrustedModelAgentProviderFailureSignal(outerError, TEST_SCOPE),
      'unknown',
    );
  });

  it('contains hostile guard inputs and treats them as unknown', () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error(CANARY);
        },
        getOwnPropertyDescriptor() {
          throw new Error(CANARY);
        },
        getPrototypeOf() {
          throw new Error(CANARY);
        },
        has() {
          throw new Error(CANARY);
        },
      },
    );

    expect(() => {
      createTrustedModelAgentProviderFailureSignal(hostile, TEST_SCOPE);
    }).not.toThrow();
    expectSanitizedSignal(
      createTrustedModelAgentProviderFailureSignal(hostile, TEST_SCOPE),
      'unknown',
    );
    expect(() => takeModelAgentProviderFailureCategory(hostile, TEST_SCOPE)).not.toThrow();
    expect(takeModelAgentProviderFailureCategory(hostile, TEST_SCOPE)).toBeUndefined();
  });

  it('only consumes exact signals in the matching invocation scope once', () => {
    const scope = new AbortController().signal;
    const wrongScope = new AbortController().signal;
    const signal = createTrustedModelAgentProviderFailureSignal(apiCallError(401), scope);
    const untrustedSignal = createUntrustedModelAgentProviderFailureSignal(scope);
    const forgedPublicObject = { category: 'http_auth' };
    const inheritedSignal = Object.create(signal) as Error;

    expect(takeModelAgentProviderFailureCategory(signal, wrongScope)).toBeUndefined();
    expect(takeModelAgentProviderFailureCategory(forgedPublicObject, scope)).toBeUndefined();
    expect(takeModelAgentProviderFailureCategory(inheritedSignal, scope)).toBeUndefined();
    expect(takeModelAgentProviderFailureCategory(signal, scope)).toBe('http_auth');
    expect(takeModelAgentProviderFailureCategory(signal, scope)).toBeUndefined();
    expect(takeModelAgentProviderFailureCategory(untrustedSignal, scope)).toBe('unknown');
    expect(takeModelAgentProviderFailureCategory(untrustedSignal, scope)).toBeUndefined();
  });

  it('stores neither the original error nor canary data in trusted or untrusted signals', () => {
    const providerError = apiCallError(401);
    const trustedSignal = createTrustedModelAgentProviderFailureSignal(providerError, TEST_SCOPE);
    const untrustedSignal = createUntrustedModelAgentProviderFailureSignal(TEST_SCOPE);

    expectSignalOwnPropertiesToBeSafe(trustedSignal, providerError);
    expectSignalOwnPropertiesToBeSafe(untrustedSignal, providerError);
  });

  it('is not exposed from the package root', async () => {
    const packageRoot = await import('../src/index');

    expect('createTrustedModelAgentProviderFailureSignal' in packageRoot).toBe(false);
    expect('createUntrustedModelAgentProviderFailureSignal' in packageRoot).toBe(false);
    expect('takeModelAgentProviderFailureCategory' in packageRoot).toBe(false);

    const internalContract = await import('../src/model-agent-provider-failure');
    expect('readModelAgentProviderFailureCategory' in internalContract).toBe(false);
  });
});

function apiCallError(statusCode: unknown): APICallError {
  return new APICallError({
    message: CANARY,
    url: `https://example.invalid/${CANARY}`,
    requestBodyValues: { request: CANARY },
    statusCode: statusCode as number | undefined,
    responseHeaders: { [CANARY]: CANARY },
    responseBody: JSON.stringify({ body: CANARY }),
    data: { raw: CANARY },
    cause: new Error(CANARY),
    isRetryable: true,
  });
}

function expectSanitizedSignal(signal: Error, expectedCategory: string): void {
  expect(signal.name).toBe('ModelAgentProviderFailure');
  expect(signal.message).toBe('MODEL_AGENT_PROVIDER_REQUEST_FAILED');
  expect((signal as Error & { cause?: unknown }).cause).toBeUndefined();
  expect(signal.name).not.toContain(CANARY);
  expect(signal.message).not.toContain(CANARY);
  expect(JSON.stringify(signal)).not.toContain(CANARY);
  expect(takeModelAgentProviderFailureCategory(signal, TEST_SCOPE)).toBe(expectedCategory);
}

const ALLOWED_SIGNAL_OWN_KEYS = [
  'message',
  'name',
  'originalLine',
  'originalColumn',
  'line',
  'column',
  'sourceURL',
  'stack',
] as const;

function expectSignalOwnPropertiesToBeSafe(signal: Error, rawError: unknown): void {
  const ownKeys = Reflect.ownKeys(signal);
  expect(ownKeys).toContain('message');
  expect(ownKeys).toContain('name');

  for (const key of ownKeys) {
    expect(typeof key).toBe('string');
    if (typeof key !== 'string') continue;
    expect(ALLOWED_SIGNAL_OWN_KEYS).toContain(key);

    const descriptor = Reflect.getOwnPropertyDescriptor(signal, key);
    expect(descriptor).toBeDefined();
    expect(descriptor?.get).toBeUndefined();
    expect(descriptor?.set).toBeUndefined();
    expect(descriptor && 'value' in descriptor).toBe(true);
    if (!descriptor || !('value' in descriptor)) continue;

    expect(descriptor.value).not.toBe(rawError);
    if (typeof descriptor.value === 'string') {
      expect(descriptor.value).not.toContain(CANARY);
    } else if (descriptor.value !== undefined) {
      expect(JSON.stringify(descriptor.value)).not.toContain(CANARY);
    }
  }

  expect((signal as Error & { cause?: unknown }).cause).toBeUndefined();
}
