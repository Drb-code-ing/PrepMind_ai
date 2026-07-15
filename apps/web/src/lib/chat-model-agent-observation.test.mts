import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateChatModelAgentObservations,
  buildChatModelAgentObservationHeaders,
  projectChatModelAgentObservation,
} from './chat-model-agent-observation.ts';

const CANARY = 'CANARY_prompt_query_chunk_sk-secret_https_raw-error';

test('projects only canonical candidate observation fields', () => {
  const projected = projectChatModelAgentObservation({
    attempted: true,
    disposition: 'fallback_timeout',
    usage: { inputTokens: 123, outputTokens: 45 },
    trace: {
      durationMs: 678,
      errorCode: 'TIMEOUT',
      providerFailureCategory: 'transport',
      systemPrompt: CANARY,
      baseURL: `https://${CANARY}`,
    },
    query: CANARY,
    budget: { secret: CANARY },
  });

  assert.deepEqual(projected, {
    attempted: true,
    disposition: 'fallback_timeout',
    durationMs: 678,
    inputTokens: 123,
    outputTokens: 45,
    errorCode: 'TIMEOUT',
    providerFailureCategory: 'transport',
  });
  assert.equal(JSON.stringify(projected).includes(CANARY), false);
});

test('normalizes invalid numbers and free text to fixed safe fallbacks', () => {
  const projected = projectChatModelAgentObservation({
    attempted: 'yes',
    disposition: `${CANARY}_candidate_applied`,
    usage: { inputTokens: -1, outputTokens: Number.NaN },
    trace: {
      durationMs: Number.POSITIVE_INFINITY,
      errorCode: `${CANARY}_TIMEOUT`,
      providerFailureCategory: `${CANARY}_transport`,
    },
  });

  assert.deepEqual(projected, {
    attempted: false,
    disposition: 'fallback_invalid_input',
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    errorCode: 'UNKNOWN',
    providerFailureCategory: 'unknown',
  });
  assert.equal(JSON.stringify(projected).includes(CANARY), false);

  assert.deepEqual(
    projectChatModelAgentObservation({
      attempted: true,
      disposition: 'candidate_applied',
      usageUnavailable: true,
      usage: { inputTokens: 99, outputTokens: 88 },
      trace: { durationMs: 1.9 },
    }),
    {
      attempted: true,
      disposition: 'candidate_applied',
      durationMs: 1,
      inputTokens: 0,
      outputTokens: 0,
      usageUnavailable: true,
    },
  );
});

test('preserves only a strict boolean unavailable usage marker', () => {
  const markerGetter = Object.create(null, {
    attempted: { enumerable: true, value: true },
    disposition: { enumerable: true, value: 'candidate_applied' },
    usageUnavailable: {
      enumerable: true,
      get() {
        throw new Error(CANARY);
      },
    },
    usage: {
      enumerable: true,
      value: { inputTokens: 19, outputTokens: 7 },
    },
  });
  const markerProxy = new Proxy(
    {
      attempted: true,
      disposition: 'candidate_applied',
      usage: { inputTokens: 19, outputTokens: 7 },
    },
    {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'usageUnavailable') throw new Error(CANARY);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    },
  );

  for (const value of [
    {
      attempted: true,
      disposition: 'candidate_applied',
      usageUnavailable: 'true',
      usage: { inputTokens: 19, outputTokens: 7 },
    },
    {
      attempted: true,
      disposition: 'candidate_applied',
      usageUnavailable: 1,
      usage: { inputTokens: 19, outputTokens: 7 },
    },
    markerGetter,
    markerProxy,
  ]) {
    const projected = projectChatModelAgentObservation(value);
    assert.equal(projected.usageUnavailable, undefined);
    assert.equal(projected.inputTokens, 19);
    assert.equal(projected.outputTokens, 7);
    assert.equal(JSON.stringify(projected).includes(CANARY), false);
  }

  const unavailableHeaders = buildChatModelAgentObservationHeaders({
    router: {
      attempted: true,
      disposition: 'candidate_applied',
      usageUnavailable: true,
      usage: { inputTokens: 19, outputTokens: 7 },
    },
  });
  assert.equal(unavailableHeaders['x-prepmind-router-model-input-tokens'], '0');
  assert.equal(unavailableHeaders['x-prepmind-router-model-output-tokens'], '0');
  assert.equal(
    Object.keys(unavailableHeaders).some((name) => name.includes('unavailable')),
    false,
  );
});

test('never throws for null, hostile getters, or hostile proxies', () => {
  const getter = Object.create(null, {
    attempted: {
      enumerable: true,
      get() {
        throw new Error(CANARY);
      },
    },
    disposition: { enumerable: true, value: 'candidate_applied' },
  });
  const proxy = new Proxy(
    {},
    {
      getOwnPropertyDescriptor() {
        throw new Error(CANARY);
      },
    },
  );

  for (const value of [undefined, null, getter, proxy]) {
    let projected: ReturnType<typeof projectChatModelAgentObservation> | undefined;
    assert.doesNotThrow(() => {
      projected = projectChatModelAgentObservation(value);
    });
    assert.deepEqual(projected, {
      attempted: false,
      disposition:
        value === getter ? 'candidate_applied' : 'fallback_invalid_input',
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
    assert.equal(JSON.stringify(projected).includes(CANARY), false);
  }
});

test('aggregates only projected usage and saturates every token total', () => {
  const max = Number.MAX_SAFE_INTEGER;
  const aggregate = aggregateChatModelAgentObservations(
    {
      attempted: true,
      disposition: 'candidate_applied',
      usage: { inputTokens: max, outputTokens: max },
      trace: { durationMs: max },
    },
    {
      attempted: true,
      disposition: 'fallback_runtime_error',
      usage: { inputTokens: max, outputTokens: 4 },
      trace: { durationMs: 3 },
    },
  );

  assert.deepEqual(aggregate, {
    calls: 2,
    inputTokens: max,
    outputTokens: max,
    totalTokens: max,
  });
  for (const value of Object.values(aggregate)) {
    assert.equal(Number.isSafeInteger(value), true);
    assert.equal(value >= 0, true);
  }
});

test('builds bounded fixed ASCII headers with an absent verifier marker', () => {
  const headers = buildChatModelAgentObservationHeaders({
    router: {
      attempted: true,
      disposition: 'candidate_applied',
      usage: { inputTokens: 100, outputTokens: 20 },
      trace: { durationMs: 31 },
    },
  });

  assert.deepEqual(headers, {
    'x-prepmind-router-model-attempted': 'true',
    'x-prepmind-router-model-disposition': 'candidate_applied',
    'x-prepmind-router-model-duration-ms': '31',
    'x-prepmind-router-model-input-tokens': '100',
    'x-prepmind-router-model-output-tokens': '20',
    'x-prepmind-router-model-error-code': 'none',
    'x-prepmind-router-model-provider-failure': 'none',
    'x-prepmind-verifier-model-attempted': 'false',
    'x-prepmind-verifier-model-disposition': 'not_present',
    'x-prepmind-verifier-model-duration-ms': '0',
    'x-prepmind-verifier-model-input-tokens': '0',
    'x-prepmind-verifier-model-output-tokens': '0',
    'x-prepmind-verifier-model-error-code': 'none',
    'x-prepmind-verifier-model-provider-failure': 'none',
    'x-prepmind-model-agent-calls': '1',
    'x-prepmind-model-agent-input-tokens': '100',
    'x-prepmind-model-agent-output-tokens': '20',
    'x-prepmind-model-agent-total-tokens': '120',
  });

  for (const [name, value] of Object.entries(headers)) {
    assert.match(name, /^[a-z0-9-]{1,64}$/);
    assert.match(value, /^[\x20-\x7e]{1,32}$/);
  }
});

test('headers project both observations without leaking hostile fields', () => {
  const headers = buildChatModelAgentObservationHeaders({
    router: new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error(CANARY);
        },
      },
    ),
    verifier: {
      attempted: true,
      disposition: 'fallback_runtime_error',
      usage: { inputTokens: 8, outputTokens: 5 },
      trace: {
        durationMs: 13,
        errorCode: CANARY,
        providerFailureCategory: CANARY,
        rawError: CANARY,
      },
      chunk: CANARY,
    },
  });

  assert.equal(headers['x-prepmind-router-model-attempted'], 'false');
  assert.equal(
    headers['x-prepmind-router-model-disposition'],
    'fallback_invalid_input',
  );
  assert.equal(headers['x-prepmind-verifier-model-attempted'], 'true');
  assert.equal(
    headers['x-prepmind-verifier-model-disposition'],
    'fallback_runtime_error',
  );
  assert.equal(headers['x-prepmind-verifier-model-error-code'], 'UNKNOWN');
  assert.equal(headers['x-prepmind-verifier-model-provider-failure'], 'unknown');
  assert.equal(headers['x-prepmind-model-agent-calls'], '1');
  assert.equal(headers['x-prepmind-model-agent-total-tokens'], '13');
  assert.equal(JSON.stringify(headers).includes(CANARY), false);
});
