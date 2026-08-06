import { describe, expect, test } from 'bun:test';

import {
  FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL,
  FINAL_RESPONSE_STREAM_PROVIDER_COMPLETIONS_URL,
  FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS,
  FINAL_RESPONSE_STREAM_PROVIDER_MODEL,
  QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
  QWEN_TEXT_EMBEDDING_V4_MODEL,
  QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE,
  createFinalResponseStreamDiagnosticProvider,
  createPhase698ProviderWireDiagnostics,
  createQwenTextEmbeddingV4DiagnosticProvider,
  readPhase698ProviderWireSnapshot,
  type FinalResponseStreamExecutor,
  type FinalResponseStreamExecutorEvent,
  type Phase698ProviderWireFailureCategory,
} from '../src/index.ts';

const SENTINEL = 'r2-provider-raw-must-not-cross-wire';
const QWEN_CONFIG = Object.freeze({
  apiKey: 'r2-qwen-synthetic-key',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: QWEN_TEXT_EMBEDDING_V4_MODEL,
  dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
  priceProfile: QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE,
});
const FINAL_CONFIG = Object.freeze({
  apiKey: 'r2-final-synthetic-key',
  baseURL: FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL,
  model: FINAL_RESPONSE_STREAM_PROVIDER_MODEL,
});
const SUCCESS_PARTS = Object.freeze([
  { type: 'step-start', warnings: [] },
  { type: 'text-delta', textDelta: '先核对证据。' },
  {
    type: 'step-finish',
    warnings: [],
    finishReason: 'stop',
    usage: { promptTokens: 120, completionTokens: 18 },
  },
  {
    type: 'finish',
    finishReason: 'stop',
    usage: { promptTokens: 120, completionTokens: 18 },
  },
]);

describe('Phase 6.9.8 first-party Provider wire diagnostics', () => {
  test('exports only create/read authority and rejects forged capabilities', async () => {
    const publicModule = await import('../src/index.ts');
    for (const name of [
      'claimPhase698ProviderWireCapability',
      'advancePhase698ProviderWireStage',
      'failPhase698ProviderWire',
      'completePhase698ProviderWire',
      'setPhase698ProviderWireShapeBuckets',
    ]) {
      expect(name in publicModule).toBe(false);
    }
    expect(
      readPhase698ProviderWireSnapshot({
        version: 'phase-6.9.8-provider-wire-capability-v1',
      }),
    ).toBeNull();
  });

  test('records one successful Qwen call with exact envelope, embedding, and usage stages', async () => {
    const wire = createPhase698ProviderWireDiagnostics('qwen_retrieval');
    const provider = createQwenTextEmbeddingV4DiagnosticProvider(QWEN_CONFIG, wire.capability, {
      fetch: async () => qwenResponse({}),
    });
    const result = await provider.executor({
      inputs: ['bounded query'],
      dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
      signal: new AbortController().signal,
    });
    expect(result.usage).toEqual({ inputTokens: 7, totalTokens: 7 });
    expect(wire.readSnapshot()).toEqual({
      version: 'phase-6.9.8-provider-wire-diagnostics-v1',
      family: 'qwen_retrieval',
      state: 'succeeded',
      stages: [
        'executor_entered',
        'request_validated',
        'provider_dispatch_started',
        'provider_response_received',
        'provider_envelope_validated',
        'embedding_validated',
        'usage_validated',
      ],
      lastCompletedStage: 'usage_validated',
      failureCategory: null,
      topLevelTypeBucket: 'object',
      fieldCountBucket: '5_plus',
      counters: {
        executorInvocations: 1,
        providerDispatches: 1,
        providerResponses: 1,
        verifiedUsages: 1,
      },
    });
    await expect(
      provider.executor({
        inputs: ['second call forbidden'],
        dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: 'provider_unavailable' });
    expect(wire.readSnapshot().state).toBe('succeeded');
  });

  test('classifies Qwen transport, HTTP, envelope, embedding, and usage failures without raw data', async () => {
    const cases: ReadonlyArray<{
      fetch: typeof fetch;
      category: Phase698ProviderWireFailureCategory;
    }> = [
      {
        fetch: async () => {
          throw new Error(`${SENTINEL}: transport`);
        },
        category: 'transport',
      },
      { fetch: async () => new Response('', { status: 401 }), category: 'http_auth' },
      {
        fetch: async () =>
          new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
        category: 'provider_envelope_invalid',
      },
      { fetch: async () => qwenResponse({ data: [] }), category: 'embedding_count_invalid' },
      {
        fetch: async () => qwenResponse({ embedding: [1] }),
        category: 'embedding_dimension_invalid',
      },
      {
        fetch: async () => qwenResponse({ embedding: zeroVector() }),
        category: 'embedding_value_invalid',
      },
      { fetch: async () => qwenResponse({ inputTokens: 0 }), category: 'usage_invalid' },
    ];

    for (const current of cases) {
      const wire = createPhase698ProviderWireDiagnostics('qwen_retrieval');
      const provider = createQwenTextEmbeddingV4DiagnosticProvider(QWEN_CONFIG, wire.capability, {
        fetch: current.fetch,
      });
      await settleQwen(provider.executor);
      expect(wire.readSnapshot().failureCategory).toBe(current.category);
      expect(JSON.stringify(wire.readSnapshot())).not.toMatch(
        /raw-must-not|synthetic-key|dashscope/iu,
      );
    }
  });

  test('records one successful FinalResponse stream with terminal and verified usage stages', async () => {
    const wire = createPhase698ProviderWireDiagnostics('final_response_stream');
    const provider = createFinalResponseStreamDiagnosticProvider(
      FINAL_CONFIG,
      wire.capability,
      finalDependencies(SUCCESS_PARTS),
    );
    await expect(collectFinal(provider.executor)).resolves.toEqual([
      { type: 'text_delta', text: '先核对证据。' },
      {
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 120, outputTokens: 18 },
      },
    ]);
    expect(wire.readSnapshot()).toMatchObject({
      family: 'final_response_stream',
      state: 'succeeded',
      stages: [
        'executor_entered',
        'request_validated',
        'provider_dispatch_started',
        'provider_response_received',
        'stream_events_validated',
        'provider_terminal_validated',
        'usage_validated',
      ],
      failureCategory: null,
      topLevelTypeBucket: 'object',
      fieldCountBucket: '2_4',
      counters: {
        executorInvocations: 1,
        providerDispatches: 1,
        providerResponses: 1,
        verifiedUsages: 1,
      },
    });
  });

  test('observes bounded FinalResponse HTTP failures at the wrapped first-party fetch boundary', async () => {
    const cases = [
      { status: 401, category: 'http_auth' },
      { status: 403, category: 'http_auth' },
      { status: 429, category: 'http_rate_limit' },
      { status: 400, category: 'http_client' },
      { status: 503, category: 'http_server' },
    ] as const;

    for (const current of cases) {
      let fetchCalls = 0;
      const wire = createPhase698ProviderWireDiagnostics('final_response_stream');
      const provider = createFinalResponseStreamDiagnosticProvider(FINAL_CONFIG, wire.capability, {
        fetch: async () => {
          fetchCalls += 1;
          return new Response('', { status: current.status });
        },
        createProvider: (config) => () => ({ wireFetch: config.fetch }),
        streamText: (input) => {
          const model = input.model as Readonly<{ wireFetch: typeof fetch }>;
          return {
            ...streamResult([]),
            fullStream: (async function* () {
              await model.wireFetch(FINAL_RESPONSE_STREAM_PROVIDER_COMPLETIONS_URL, {
                method: 'POST',
                body: JSON.stringify({
                  model: FINAL_RESPONSE_STREAM_PROVIDER_MODEL,
                  messages: [{ role: 'user', content: 'bounded' }],
                  stream: true,
                  max_tokens: FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS,
                  stream_options: { include_usage: true },
                }),
                signal: input.abortSignal,
              });
              throw new Error(`${SENTINEL}: sdk http rejection`);
            })(),
          };
        },
      });
      await settleFinal(provider.executor);
      expect(fetchCalls, String(current.status)).toBe(1);
      expect(wire.readSnapshot(), String(current.status)).toMatchObject({
        failureCategory: current.category,
        counters: { providerDispatches: 1, providerResponses: 1, verifiedUsages: 0 },
      });
    }
  });

  test('classifies FinalResponse stream, terminal, tool, usage, and transport failures', async () => {
    const cases: ReadonlyArray<{
      parts?: readonly unknown[];
      extras?: Partial<ReturnType<typeof streamResult>>;
      throwBeforeStream?: true;
      category: Phase698ProviderWireFailureCategory;
    }> = [
      {
        parts: [{ type: 'step-start', warnings: [] }, { type: 'unknown' }],
        category: 'stream_event_invalid',
      },
      { parts: [{ type: 'step-start', warnings: [] }], category: 'terminal_missing' },
      {
        parts: [SUCCESS_PARTS[0], SUCCESS_PARTS[2], SUCCESS_PARTS[2]],
        category: 'terminal_duplicate',
      },
      {
        parts: [...SUCCESS_PARTS, { type: 'text-delta', textDelta: 'late' }],
        category: 'terminal_not_last',
      },
      {
        extras: { toolResults: Promise.resolve([{ toolName: 'write', result: SENTINEL }]) },
        category: 'false_tool_success',
      },
      {
        parts: SUCCESS_PARTS.map((part) =>
          part.type === 'step-finish' || part.type === 'finish'
            ? { ...part, usage: { promptTokens: 0, completionTokens: 18 } }
            : part,
        ),
        category: 'usage_invalid',
      },
      { throwBeforeStream: true, category: 'transport' },
    ];

    for (const current of cases) {
      const wire = createPhase698ProviderWireDiagnostics('final_response_stream');
      const provider = createFinalResponseStreamDiagnosticProvider(
        FINAL_CONFIG,
        wire.capability,
        current.throwBeforeStream
          ? {
              createProvider: () => () => ({}),
              streamText: () => {
                throw new Error(`${SENTINEL}: before stream`);
              },
            }
          : {
              ...finalDependencies(current.parts ?? SUCCESS_PARTS),
              streamText: () => ({
                ...streamResult(current.parts ?? SUCCESS_PARTS),
                ...current.extras,
              }),
            },
      );
      await settleFinal(provider.executor);
      expect(wire.readSnapshot().failureCategory).toBe(current.category);
      expect(JSON.stringify(wire.readSnapshot())).not.toMatch(
        /raw-must-not|synthetic-key|deepseek/iu,
      );
    }
  });

  test('keeps hostile requests and pre/in-flight aborts bounded with zero retry', async () => {
    let qwenCalls = 0;
    const qwenWire = createPhase698ProviderWireDiagnostics('qwen_retrieval');
    const qwen = createQwenTextEmbeddingV4DiagnosticProvider(QWEN_CONFIG, qwenWire.capability, {
      fetch: async (_input, init) => {
        qwenCalls += 1;
        await new Promise<void>((_resolve, reject) =>
          init?.signal?.addEventListener(
            'abort',
            () => reject(new Error(`${SENTINEL}: qwen abort`)),
            { once: true },
          ),
        );
        throw new Error('unreachable');
      },
    });
    const qwenController = new AbortController();
    const qwenPending = qwen.executor({
      inputs: ['bounded query'],
      dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
      signal: qwenController.signal,
    });
    await Promise.resolve();
    qwenController.abort();
    await qwenPending.catch(() => undefined);
    expect(qwenCalls).toBe(1);
    expect(qwenWire.readSnapshot()).toMatchObject({
      failureCategory: 'post_dispatch_abort',
      counters: { providerDispatches: 1, providerResponses: 0 },
    });

    let finalCalls = 0;
    const finalWire = createPhase698ProviderWireDiagnostics('final_response_stream');
    const finalController = new AbortController();
    finalController.abort();
    const final = createFinalResponseStreamDiagnosticProvider(FINAL_CONFIG, finalWire.capability, {
      createProvider: () => () => ({}),
      streamText: () => {
        finalCalls += 1;
        return streamResult(SUCCESS_PARTS);
      },
    });
    await settleFinal(final.executor, finalController.signal);
    expect(finalCalls).toBe(0);
    expect(finalWire.readSnapshot()).toMatchObject({
      failureCategory: 'pre_dispatch_abort',
      counters: { providerDispatches: 0, providerResponses: 0 },
    });

    let inFlightFinalCalls = 0;
    const inFlightFinalWire = createPhase698ProviderWireDiagnostics('final_response_stream');
    const inFlightFinalController = new AbortController();
    const inFlightFinal = createFinalResponseStreamDiagnosticProvider(
      FINAL_CONFIG,
      inFlightFinalWire.capability,
      {
        createProvider: () => () => ({}),
        streamText: (input) => {
          inFlightFinalCalls += 1;
          return {
            ...streamResult([]),
            fullStream: (async function* () {
              yield SUCCESS_PARTS[0];
              if (!input.abortSignal.aborted) {
                await new Promise<void>((resolve) =>
                  input.abortSignal.addEventListener('abort', () => resolve(), { once: true }),
                );
              }
              throw new Error(`${SENTINEL}: final abort`);
            })(),
          };
        },
      },
    );
    const inFlightFinalPending = collectFinal(
      inFlightFinal.executor,
      inFlightFinalController.signal,
    );
    await Promise.resolve();
    inFlightFinalController.abort();
    await inFlightFinalPending.catch(() => undefined);
    expect(inFlightFinalCalls).toBe(1);
    expect(inFlightFinalWire.readSnapshot()).toMatchObject({
      failureCategory: 'post_dispatch_abort',
      counters: { providerDispatches: 1, providerResponses: 1, verifiedUsages: 0 },
    });
  });

  test('fails hostile getter and Proxy values closed without invoking or retaining them', async () => {
    let requestGetterReads = 0;
    let fetchCalls = 0;
    const qwenWire = createPhase698ProviderWireDiagnostics('qwen_retrieval');
    const qwen = createQwenTextEmbeddingV4DiagnosticProvider(QWEN_CONFIG, qwenWire.capability, {
      fetch: async () => {
        fetchCalls += 1;
        return qwenResponse({});
      },
    });
    const hostileRequest = Object.defineProperty(
      {
        dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
        signal: new AbortController().signal,
      },
      'inputs',
      {
        enumerable: true,
        get() {
          requestGetterReads += 1;
          throw new Error(`${SENTINEL}: getter`);
        },
      },
    );
    await (qwen.executor as (value: unknown) => Promise<unknown>)(hostileRequest).catch(
      () => undefined,
    );
    expect(requestGetterReads).toBe(0);
    expect(fetchCalls).toBe(0);
    expect(qwenWire.readSnapshot().failureCategory).toBe('request_contract');

    const finalWire = createPhase698ProviderWireDiagnostics('final_response_stream');
    const hostilePart = new Proxy(
      { type: 'step-start', warnings: [] },
      {
        getPrototypeOf() {
          throw new Error(`${SENTINEL}: proxy`);
        },
      },
    );
    const final = createFinalResponseStreamDiagnosticProvider(
      FINAL_CONFIG,
      finalWire.capability,
      finalDependencies([hostilePart]),
    );
    await settleFinal(final.executor);
    expect(finalWire.readSnapshot().failureCategory).toBe('stream_event_invalid');
    expect(JSON.stringify(finalWire.readSnapshot())).not.toContain(SENTINEL);
  });
});

function qwenResponse(input: {
  data?: readonly unknown[];
  embedding?: readonly number[];
  inputTokens?: number;
}) {
  const embedding = input.embedding ?? unitVector();
  const tokens = input.inputTokens ?? 7;
  return new Response(
    JSON.stringify({
      object: 'list',
      id: 'qwen-r2-synthetic',
      model: QWEN_TEXT_EMBEDDING_V4_MODEL,
      data: input.data ?? [{ object: 'embedding', index: 0, embedding }],
      usage: { prompt_tokens: tokens, total_tokens: tokens },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function unitVector() {
  return Object.freeze([
    1,
    ...Array.from({ length: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS - 1 }, () => 0),
  ]);
}

function zeroVector() {
  return Object.freeze(Array.from({ length: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS }, () => 0));
}

async function settleQwen(
  executor: ReturnType<typeof createQwenTextEmbeddingV4DiagnosticProvider>['executor'],
) {
  try {
    await executor({
      inputs: ['bounded query'],
      dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
      signal: new AbortController().signal,
    });
  } catch {
    // The bounded wire snapshot is the only diagnostic authority.
  }
}

function finalDependencies(parts: readonly unknown[]) {
  return {
    createProvider: () => () => ({}),
    streamText: () => streamResult(parts),
  };
}

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

async function collectFinal(
  executor: FinalResponseStreamExecutor,
  signal: AbortSignal = new AbortController().signal,
) {
  const events: FinalResponseStreamExecutorEvent[] = [];
  for await (const event of executor({
    systemPrompt: 'Safe system prompt.',
    userPrompt: '{"bounded":"request"}',
    maxOutputTokens: FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS,
    signal,
  })) {
    events.push(event);
  }
  return events;
}

async function settleFinal(
  executor: FinalResponseStreamExecutor,
  signal: AbortSignal = new AbortController().signal,
) {
  try {
    await collectFinal(executor, signal);
  } catch {
    // The bounded wire snapshot is the only diagnostic authority.
  }
}
