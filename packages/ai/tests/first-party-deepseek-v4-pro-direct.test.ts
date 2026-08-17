import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createFirstPartyDeepSeekV4ProDirectAdapterV2,
  createPhase697V7WireDiagnostics,
  FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_ADAPTER_VERSION,
  FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_ADAPTER_V2_VERSION,
  PHASE_6_9_7_V7_WIRE_FAILURE_CATEGORIES,
  PHASE_6_9_7_V7_WIRE_STAGES,
  type FirstPartyDeepSeekV4ProDirectAdapter,
  type Phase697V7WireFailureCategory,
  type Phase697V7WireStage,
} from '../src/index.ts';
import {
  abortPhase697V7Wire,
  advancePhase697V7WireStage,
  completePhase697V7Wire,
  projectPhase697V7WireFailure,
} from '../src/phase-6-9-7-v7-wire-diagnostics.ts';
import { takeModelAgentProviderFailure } from '../src/model-agent-provider-failure.ts';

const SENTINEL_KEY = 'r1-synthetic-key-never-send';
const SENTINEL_PROMPT = 'r1 synthetic prompt must never enter diagnostics';
const CONFIG = Object.freeze({
  provider: 'deepseek' as const,
  apiKey: SENTINEL_KEY,
  baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-v4-pro',
});
const OUTPUT_SCHEMA = z.object({ answer: z.string() }).strict();

describe('Phase 6.9.7 V7 first-party DeepSeek V4 Pro direct adapter', () => {
  test('freezes a private wire taxonomy and exhaustively projects it to the unchanged public contract', () => {
    expect(FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_ADAPTER_VERSION).toBe(
      'first-party-deepseek-v4-pro-direct-v1',
    );
    expect(PHASE_6_9_7_V7_WIRE_STAGES).toEqual([
      'executor_entered',
      'request_validated',
      'provider_dispatch_started',
      'provider_response_received',
      'response_audit_passed',
      'content_parsed',
      'schema_validated',
      'usage_validated',
    ]);
    expect(Object.isFrozen(PHASE_6_9_7_V7_WIRE_STAGES)).toBe(true);
    expect(Object.isFrozen(PHASE_6_9_7_V7_WIRE_FAILURE_CATEGORIES)).toBe(true);

    const expected = {
      request_contract: { category: 'unknown' },
      transport: { category: 'transport' },
      http_auth: { category: 'http_auth' },
      http_rate_limit: { category: 'http_rate_limit' },
      http_client: { category: 'http_client' },
      http_server: { category: 'http_server' },
      response_audit: { category: 'invalid_response' },
      invalid_response: { category: 'invalid_response' },
      provider_json_parse: {
        category: 'structured_output',
        structuredOutputStage: 'provider_json_parse',
      },
      provider_type_validation: {
        category: 'structured_output',
        structuredOutputStage: 'provider_type_validation',
      },
      provider_object_missing: {
        category: 'structured_output',
        structuredOutputStage: 'provider_object_missing',
      },
      usage_validation: { category: 'unknown' },
      pre_dispatch_abort: { category: 'unknown' },
      post_dispatch_abort: { category: 'unknown' },
      runtime_timeout: { category: 'unknown' },
      harness_internal: { category: 'unknown' },
      evidence_io: { category: 'unknown' },
      unknown: { category: 'unknown' },
    } as const satisfies Record<Phase697V7WireFailureCategory, unknown>;

    expect(PHASE_6_9_7_V7_WIRE_FAILURE_CATEGORIES).toEqual(Object.keys(expected));
    for (const category of PHASE_6_9_7_V7_WIRE_FAILURE_CATEGORIES) {
      expect(projectPhase697V7WireFailure(category)).toEqual(expected[category]);
    }
  });

  test('constructs the exact non-thinking request and records the complete monotonic prefix', async () => {
    const committed: Phase697V7WireStage[] = [];
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const diagnostics = createPhase697V7WireDiagnostics({
      appendStage(stage) {
        committed.push(stage);
      },
    });
    const adapter = createAdapter(diagnostics.capability, async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return successResponse({ answer: 'safe result' }, 17, 5);
    });

    expect(adapter.provenance).toBe('synthetic_test');
    const signal = new AbortController().signal;
    const result = await adapter.executor(executorInput(signal));
    expect(result).toEqual({
      object: { answer: 'safe result' },
      usage: { inputTokens: 17, outputTokens: 5 },
    });
    expect(capturedUrl).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(capturedInit?.method).toBe('POST');
    expect(new Headers(capturedInit?.headers).get('authorization')).toBe(`Bearer ${SENTINEL_KEY}`);
    expect(new Headers(capturedInit?.headers).get('content-type')).toBe('application/json');
    const body = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      model: 'deepseek-v4-pro',
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
      max_tokens: 64,
      stream: false,
      messages: [
        { role: 'system', content: 'Return one strict object.' },
        { role: 'user', content: SENTINEL_PROMPT },
      ],
    });
    for (const forbidden of ['tools', 'tool_choice', 'functions', 'function_call', 'json_schema']) {
      expect(Object.prototype.hasOwnProperty.call(body, forbidden)).toBe(false);
    }

    expect(committed).toEqual(PHASE_6_9_7_V7_WIRE_STAGES);
    expect(diagnostics.readSnapshot()).toEqual({
      version: 'phase-6.9.7-v7-wire-diagnostics-v1',
      state: 'succeeded',
      stages: PHASE_6_9_7_V7_WIRE_STAGES,
      lastCompletedStage: 'usage_validated',
      failureCategory: null,
      usageDisposition: 'verified',
      counters: {
        executorInvocations: 1,
        providerDispatches: 1,
        providerResponses: 1,
        verifiedUsages: 1,
      },
    });
    const safeBytes = JSON.stringify(diagnostics.readSnapshot());
    expect(safeBytes).not.toContain(SENTINEL_KEY);
    expect(safeBytes).not.toContain(SENTINEL_PROMPT);
    expect(Object.isFrozen(diagnostics.readSnapshot())).toBe(true);
  });

  test('constructs production provenance without touching the default network delegate', () => {
    const diagnostics = diagnosticsWithoutIo();
    const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(CONFIG, diagnostics.capability);

    expect(adapter.provenance).toBe('first_party_deepseek_v4_pro_direct');
    expect(adapter.version).toBe('first-party-deepseek-v4-pro-direct-v1');
    expect(diagnostics.readSnapshot()).toMatchObject({
      state: 'active',
      stages: [],
      counters: {
        executorInvocations: 0,
        providerDispatches: 0,
        providerResponses: 0,
        verifiedUsages: 0,
      },
    });
  });

  test('rejects invalid or hostile config and dependencies before claiming the capability', () => {
    let hostileConfigReads = 0;
    const hostileConfig = { ...CONFIG } as Record<string, unknown>;
    Object.defineProperty(hostileConfig, 'apiKey', {
      enumerable: true,
      get() {
        hostileConfigReads += 1;
        throw new Error('hostile config ' + SENTINEL_KEY);
      },
    });
    const invalidConfigs: unknown[] = [
      { ...CONFIG, provider: 'openai' },
      { ...CONFIG, baseURL: 'https://example.invalid/v1' },
      { ...CONFIG, model: 'deepseek-v4-flash' },
      { ...CONFIG, apiKey: '' },
      { ...CONFIG, apiKey: ` ${SENTINEL_KEY}` },
      { ...CONFIG, apiKey: `${SENTINEL_KEY}\r\nforged` },
      { ...CONFIG, apiKey: '非可见 ASCII 凭据' },
      { ...CONFIG, apiKey: 'x'.repeat(513) },
      { ...CONFIG, extra: true },
      Object.assign({ ...CONFIG }, { [Symbol('extra')]: true }),
      Object.assign(Object.create(null) as Record<string, unknown>, CONFIG),
      hostileConfig,
      new Proxy(
        { ...CONFIG },
        {
          ownKeys() {
            throw new Error('hostile ownKeys ' + SENTINEL_KEY);
          },
        },
      ),
    ];

    for (const config of invalidConfigs) {
      const diagnostics = diagnosticsWithoutIo();
      expect(() => constructAdapter(config, diagnostics.capability)).toThrow(
        'INVALID_MODEL_PROVIDER_CONFIG',
      );
      expect(() =>
        createAdapter(diagnostics.capability, async () =>
          successResponse({ answer: 'still claimable' }, 1, 1),
        ),
      ).not.toThrow();
    }
    expect(hostileConfigReads).toBe(0);

    let hostileDependencyReads = 0;
    const hostileDependencies = {} as Record<string, unknown>;
    Object.defineProperty(hostileDependencies, 'fetch', {
      enumerable: true,
      get() {
        hostileDependencyReads += 1;
        throw new Error('hostile dependency ' + SENTINEL_KEY);
      },
    });
    for (const dependencies of [
      null,
      {},
      { fetch: 1 },
      { fetch: async () => successResponse({ answer: 'x' }, 1, 1), extra: true },
      hostileDependencies,
    ]) {
      const diagnostics = diagnosticsWithoutIo();
      expect(() => constructAdapter(CONFIG, diagnostics.capability, dependencies)).toThrow(
        'INVALID_MODEL_PROVIDER_CONFIG',
      );
      expect(() =>
        createAdapter(diagnostics.capability, async () =>
          successResponse({ answer: 'still claimable' }, 1, 1),
        ),
      ).not.toThrow();
    }
    expect(hostileDependencyReads).toBe(0);
  });

  test('awaits the dispatch durability hook and keeps the delegate at zero calls when it fails', async () => {
    let delegateCalls = 0;
    let releaseDispatch!: () => void;
    const dispatchBarrier = new Promise<void>((resolve) => {
      releaseDispatch = resolve;
    });
    const diagnostics = createPhase697V7WireDiagnostics({
      async appendStage(stage) {
        if (stage === 'provider_dispatch_started') {
          await dispatchBarrier;
          throw new Error('synthetic journal fsync failure with secret ' + SENTINEL_KEY);
        }
      },
    });
    const adapter = createAdapter(diagnostics.capability, async () => {
      delegateCalls += 1;
      return successResponse({ answer: 'must not run' }, 1, 1);
    });
    const signal = new AbortController().signal;
    const pending = adapter.executor(executorInput(signal));
    await Promise.resolve();
    expect(delegateCalls).toBe(0);
    releaseDispatch();
    const thrown = await captureFailure(pending);
    expect(delegateCalls).toBe(0);
    expect(diagnostics.readSnapshot().failureCategory).toBe('evidence_io');
    expect(diagnostics.readSnapshot().stages).toEqual(['executor_entered', 'request_validated']);
    expect(takeModelAgentProviderFailure(thrown, signal)).toEqual({ category: 'unknown' });
    expect(String(thrown)).not.toContain(SENTINEL_KEY);
  });

  test('serializes an abort queued by the dispatch hook before invoking the delegate', async () => {
    const controller = new AbortController();
    let delegateCalls = 0;
    const diagnostics = createPhase697V7WireDiagnostics({
      appendStage(stage) {
        if (stage === 'provider_dispatch_started') {
          queueMicrotask(() => controller.abort());
        }
      },
    });
    const adapter = createAdapter(diagnostics.capability, async () => {
      delegateCalls += 1;
      return successResponse({ answer: 'must not dispatch after abort wins' }, 1, 1);
    });
    const thrown = await captureFailure(adapter.executor(executorInput(controller.signal)));

    expect(delegateCalls).toBe(0);
    expect(diagnostics.readSnapshot()).toMatchObject({
      state: 'failed',
      stages: ['executor_entered', 'request_validated', 'provider_dispatch_started'],
      failureCategory: 'post_dispatch_abort',
      counters: { executorInvocations: 1, providerDispatches: 1, providerResponses: 0 },
    });
    expect(takeModelAgentProviderFailure(thrown, controller.signal)).toEqual({
      category: 'unknown',
    });
  });

  test('preserves durable dispatch and response counters when a later stage hook fails', async () => {
    let delegateCalls = 0;
    const diagnostics = createPhase697V7WireDiagnostics({
      appendStage(stage) {
        if (stage === 'response_audit_passed') {
          throw new Error('synthetic response audit journal failure ' + SENTINEL_KEY);
        }
      },
    });
    const adapter = createAdapter(diagnostics.capability, async () => {
      delegateCalls += 1;
      return successResponse({ answer: 'not admitted' }, 2, 1);
    });
    const signal = new AbortController().signal;
    const thrown = await captureFailure(adapter.executor(executorInput(signal)));

    expect(delegateCalls).toBe(1);
    expect(diagnostics.readSnapshot()).toMatchObject({
      state: 'failed',
      stages: [
        'executor_entered',
        'request_validated',
        'provider_dispatch_started',
        'provider_response_received',
      ],
      failureCategory: 'evidence_io',
      counters: {
        executorInvocations: 1,
        providerDispatches: 1,
        providerResponses: 1,
        verifiedUsages: 0,
      },
    });
    expect(takeModelAgentProviderFailure(thrown, signal)).toEqual({ category: 'unknown' });
  });

  test('never retries a rejected delegate and keeps response and usage counters at zero', async () => {
    let delegateCalls = 0;
    const diagnostics = diagnosticsWithoutIo();
    const adapter = createAdapter(diagnostics.capability, async () => {
      delegateCalls += 1;
      throw new Error('synthetic transport ' + SENTINEL_KEY);
    });
    const signal = new AbortController().signal;
    await captureFailure(adapter.executor(executorInput(signal)));

    expect(delegateCalls).toBe(1);
    expect(diagnostics.readSnapshot().counters).toEqual({
      executorInvocations: 1,
      providerDispatches: 1,
      providerResponses: 0,
      verifiedUsages: 0,
    });
  });

  test('classifies HTTP status without retaining the exact status or provider body', async () => {
    const matrix = [
      [401, 'http_auth', 'http_auth'],
      [403, 'http_auth', 'http_auth'],
      [429, 'http_rate_limit', 'http_rate_limit'],
      [400, 'http_client', 'http_client'],
      [499, 'http_client', 'http_client'],
      [500, 'http_server', 'http_server'],
      [599, 'http_server', 'http_server'],
      [300, 'invalid_response', 'invalid_response'],
      [399, 'invalid_response', 'invalid_response'],
    ] as const;
    for (const [status, privateCategory, publicCategory] of matrix) {
      const diagnostics = diagnosticsWithoutIo();
      const adapter = createAdapter(
        diagnostics.capability,
        async () => new Response(`provider secret ${SENTINEL_KEY}`, { status }),
      );
      const signal = new AbortController().signal;
      const thrown = await captureFailure(adapter.executor(executorInput(signal)));
      expect(diagnostics.readSnapshot().failureCategory, String(status)).toBe(privateCategory);
      expect(diagnostics.readSnapshot().lastCompletedStage, String(status)).toBe(
        'provider_response_received',
      );
      expect(takeModelAgentProviderFailure(thrown, signal), String(status)).toEqual({
        category: publicCategory,
      });
      expect(JSON.stringify(diagnostics.readSnapshot()), String(status)).not.toContain(
        String(status),
      );
      expect(String(thrown), String(status)).not.toContain(SENTINEL_KEY);
    }
  });

  test('accepts the inclusive HTTP success boundary only when the body contract is valid', async () => {
    for (const status of [200, 299]) {
      const diagnostics = diagnosticsWithoutIo();
      const adapter = createAdapter(
        diagnostics.capability,
        async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"answer":"success-boundary"}' } }],
              usage: { prompt_tokens: 2, completion_tokens: 1 },
            }),
            { status, headers: { 'content-type': 'application/json' } },
          ),
      );

      await expect(adapter.executor(executorInput(new AbortController().signal))).resolves.toEqual({
        object: { answer: 'success-boundary' },
        usage: { inputTokens: 2, outputTokens: 1 },
      });
      expect(diagnostics.readSnapshot()).toMatchObject({
        state: 'succeeded',
        lastCompletedStage: 'usage_validated',
        counters: { providerResponses: 1, verifiedUsages: 1 },
      });
    }

    for (const response of [
      new Response(null, { status: 204 }),
      new Response('', { status: 200 }),
    ]) {
      const diagnostics = diagnosticsWithoutIo();
      const adapter = createAdapter(diagnostics.capability, async () => response);
      const signal = new AbortController().signal;
      const thrown = await captureFailure(adapter.executor(executorInput(signal)));

      expect(diagnostics.readSnapshot()).toMatchObject({
        state: 'failed',
        failureCategory: 'invalid_response',
        lastCompletedStage: 'provider_response_received',
        counters: { providerResponses: 1, verifiedUsages: 0 },
      });
      expect(takeModelAgentProviderFailure(thrown, signal)).toEqual({
        category: 'invalid_response',
      });
    }
  });

  test('V2 accepts only an explicit null reasoning sentinel and keeps non-null reasoning rejected', async () => {
    expect(FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_ADAPTER_V2_VERSION).toBe(
      'first-party-deepseek-v4-pro-direct-v2',
    );
    const diagnostics = diagnosticsWithoutIo();
    const adapter = createFirstPartyDeepSeekV4ProDirectAdapterV2(CONFIG, diagnostics.capability, {
      fetch: async () =>
        providerResponse({
          choices: [{ message: { content: '{"answer":"nullable"}', reasoning_content: null } }],
          usage: { prompt_tokens: 2, completion_tokens: 1 },
        }),
    });
    await expect(adapter.executor(executorInput(new AbortController().signal))).resolves.toEqual({
      object: { answer: 'nullable' },
      usage: { inputTokens: 2, outputTokens: 1 },
    });
    expect(diagnostics.readSnapshot()).toMatchObject({
      state: 'succeeded',
      counters: { providerResponses: 1, verifiedUsages: 1 },
    });

    const rejectingDiagnostics = diagnosticsWithoutIo();
    const rejectingAdapter = createFirstPartyDeepSeekV4ProDirectAdapterV2(
      CONFIG,
      rejectingDiagnostics.capability,
      {
        fetch: async () =>
          providerResponse({
            choices: [{ message: { content: '{"answer":"x"}', reasoning_content: 'secret' } }],
            usage: { prompt_tokens: 2, completion_tokens: 1 },
          }),
      },
    );
    const rejectingSignal = new AbortController().signal;
    const thrown = await captureFailure(rejectingAdapter.executor(executorInput(rejectingSignal)));
    expect(takeModelAgentProviderFailure(thrown, rejectingSignal)).toEqual({
      category: 'invalid_response',
    });
    expect(rejectingDiagnostics.readSnapshot()).toMatchObject({
      state: 'failed',
      failureCategory: 'response_audit',
      counters: { providerResponses: 1, verifiedUsages: 0 },
    });
  });

  test('distinguishes transport, response audit, content, schema, and usage failures', async () => {
    const cases: readonly Readonly<{
      name: string;
      response?: () => Response;
      reject?: boolean;
      category: Phase697V7WireFailureCategory;
      publicCategory: string;
      structuredOutputStage?: string;
      lastStage: Phase697V7WireStage;
    }>[] = [
      {
        name: 'transport',
        reject: true,
        category: 'transport',
        publicCategory: 'transport',
        lastStage: 'provider_dispatch_started',
      },
      {
        name: 'outer-json',
        response: () => new Response('{not-json', { status: 200 }),
        category: 'invalid_response',
        publicCategory: 'invalid_response',
        lastStage: 'provider_response_received',
      },
      {
        name: 'reasoning-content',
        response: () =>
          providerResponse({
            choices: [{ message: { content: '{"answer":"x"}', reasoning_content: 'secret' } }],
            usage: { prompt_tokens: 2, completion_tokens: 1 },
          }),
        category: 'response_audit',
        publicCategory: 'invalid_response',
        lastStage: 'provider_response_received',
      },
      {
        name: 'positive-reasoning',
        response: () =>
          providerResponse({
            choices: [{ message: { content: '{"answer":"x"}' } }],
            usage: {
              prompt_tokens: 2,
              completion_tokens: 1,
              completion_tokens_details: { reasoning_tokens: 1 },
            },
          }),
        category: 'response_audit',
        publicCategory: 'invalid_response',
        lastStage: 'provider_response_received',
      },
      {
        name: 'missing-content',
        response: () =>
          providerResponse({
            choices: [{ message: {} }],
            usage: { prompt_tokens: 2, completion_tokens: 1 },
          }),
        category: 'provider_object_missing',
        publicCategory: 'structured_output',
        structuredOutputStage: 'provider_object_missing',
        lastStage: 'response_audit_passed',
      },
      {
        name: 'content-json',
        response: () =>
          providerResponse({
            choices: [{ message: { content: '{bad-content' } }],
            usage: { prompt_tokens: 2, completion_tokens: 1 },
          }),
        category: 'provider_json_parse',
        publicCategory: 'structured_output',
        structuredOutputStage: 'provider_json_parse',
        lastStage: 'response_audit_passed',
      },
      {
        name: 'schema',
        response: () => successResponse({ wrong: true }, 2, 1),
        category: 'provider_type_validation',
        publicCategory: 'structured_output',
        structuredOutputStage: 'provider_type_validation',
        lastStage: 'content_parsed',
      },
      {
        name: 'usage',
        response: () => successResponse({ answer: 'x' }, 0, 1),
        category: 'usage_validation',
        publicCategory: 'unknown',
        lastStage: 'schema_validated',
      },
    ];

    for (const item of cases) {
      const diagnostics = diagnosticsWithoutIo();
      const adapter = createAdapter(diagnostics.capability, async () => {
        if (item.reject) throw new Error('raw provider failure ' + SENTINEL_KEY);
        return item.response!();
      });
      const signal = new AbortController().signal;
      const thrown = await captureFailure(adapter.executor(executorInput(signal)));
      expect(diagnostics.readSnapshot().failureCategory, item.name).toBe(item.category);
      expect(diagnostics.readSnapshot().lastCompletedStage, item.name).toBe(item.lastStage);
      expect(takeModelAgentProviderFailure(thrown, signal), item.name).toEqual({
        category: item.publicCategory,
        ...(item.structuredOutputStage
          ? { structuredOutputStage: item.structuredOutputStage }
          : {}),
      });
      expect(String(thrown), item.name).not.toContain(SENTINEL_KEY);
      expect(JSON.stringify(diagnostics.readSnapshot()), item.name).not.toContain(SENTINEL_KEY);
    }
  });

  test('accepts both not-reported and explicitly zero reasoning details', async () => {
    for (const completionTokensDetails of [undefined, {}, { reasoning_tokens: 0 }]) {
      const diagnostics = diagnosticsWithoutIo();
      const adapter = createAdapter(diagnostics.capability, async () =>
        providerResponse({
          choices: [{ message: { content: '{"answer":"x"}' } }],
          usage: {
            prompt_tokens: 2,
            completion_tokens: 1,
            ...(completionTokensDetails === undefined
              ? {}
              : { completion_tokens_details: completionTokensDetails }),
          },
        }),
      );
      await expect(adapter.executor(executorInput(new AbortController().signal))).resolves.toEqual({
        object: { answer: 'x' },
        usage: { inputTokens: 2, outputTokens: 1 },
      });
      expect(diagnostics.readSnapshot().state).toBe('succeeded');
    }
  });

  test('accepts only the exact optional JSON fence and rejects malformed fenced content', async () => {
    const accepted = diagnosticsWithoutIo();
    const acceptedAdapter = createAdapter(accepted.capability, async () =>
      providerResponse({
        choices: [{ message: { content: '```json\n{"answer":"fenced"}\n```' } }],
        usage: { prompt_tokens: 2, completion_tokens: 1 },
      }),
    );
    await expect(
      acceptedAdapter.executor(executorInput(new AbortController().signal)),
    ).resolves.toMatchObject({ object: { answer: 'fenced' } });

    for (const content of [
      '```JSON\n{"answer":"x"}\n```',
      '```json\r\n{"answer":"x"}\r\n```',
      '```json\n{"answer":"x"}\n```\n',
    ]) {
      const diagnostics = diagnosticsWithoutIo();
      const adapter = createAdapter(diagnostics.capability, async () =>
        providerResponse({
          choices: [{ message: { content } }],
          usage: { prompt_tokens: 2, completion_tokens: 1 },
        }),
      );
      const signal = new AbortController().signal;
      const thrown = await captureFailure(adapter.executor(executorInput(signal)));
      expect(diagnostics.readSnapshot().failureCategory).toBe('provider_json_parse');
      expect(takeModelAgentProviderFailure(thrown, signal)).toEqual({
        category: 'structured_output',
        structuredOutputStage: 'provider_json_parse',
      });
    }
  });

  test('rejects every non-positive or unsafe usage shape after schema validation', async () => {
    const invalidUsageValues = [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1'];
    for (const inputTokens of invalidUsageValues) {
      const diagnostics = diagnosticsWithoutIo();
      const adapter = createAdapter(diagnostics.capability, async () =>
        providerResponse({
          choices: [{ message: { content: '{"answer":"x"}' } }],
          usage:
            inputTokens === undefined
              ? { completion_tokens: 1 }
              : { prompt_tokens: inputTokens, completion_tokens: 1 },
        }),
      );
      const signal = new AbortController().signal;
      await captureFailure(adapter.executor(executorInput(signal)));
      expect(diagnostics.readSnapshot()).toMatchObject({
        failureCategory: 'usage_validation',
        lastCompletedStage: 'schema_validated',
        usageDisposition: 'invalid',
      });
    }
  });

  test('rejects pre-dispatch abort and invalid request input before the delegate', async () => {
    for (const input of [
      executorInput(AbortSignal.abort()),
      { ...executorInput(new AbortController().signal), maxOutputTokens: 0 },
    ]) {
      let calls = 0;
      const diagnostics = diagnosticsWithoutIo();
      const adapter = createAdapter(diagnostics.capability, async () => {
        calls += 1;
        return successResponse({ answer: 'unexpected' }, 1, 1);
      });
      const thrown = await captureFailure(adapter.executor(input));
      expect(calls).toBe(0);
      expect(diagnostics.readSnapshot().failureCategory).toBe(
        input.signal.aborted ? 'pre_dispatch_abort' : 'request_contract',
      );
      expect(takeModelAgentProviderFailure(thrown, input.signal)).toEqual({
        category: 'unknown',
      });
    }
  });

  test('treats non-Response values and hostile or abnormal statuses as invalid responses', async () => {
    const abnormal = [
      {} as Response,
      responseWithStatus(100),
      responseWithStatus(199),
      responseWithStatus(200.5),
      responseWithStatus(600),
      responseWithStatus(Number.NaN),
      responseWithStatus(Number.POSITIVE_INFINITY),
      responseWithThrowingStatus(),
    ];
    for (const response of abnormal) {
      const diagnostics = diagnosticsWithoutIo();
      const adapter = createAdapter(diagnostics.capability, async () => response);
      const signal = new AbortController().signal;
      const thrown = await captureFailure(adapter.executor(executorInput(signal)));
      expect(diagnostics.readSnapshot().failureCategory).toBe('invalid_response');
      expect(takeModelAgentProviderFailure(thrown, signal)).toEqual({
        category: 'invalid_response',
      });
    }
  });

  test('serializes reducer transitions and fails closed on duplicate, skipped, forged, or reused capability', async () => {
    const duplicate = diagnosticsWithoutIo();
    await advancePhase697V7WireStage(duplicate.capability, 'executor_entered');
    await expect(
      advancePhase697V7WireStage(duplicate.capability, 'executor_entered'),
    ).rejects.toThrow('PHASE_6_9_7_V7_WIRE_TRANSITION_REJECTED');
    expect(duplicate.readSnapshot().failureCategory).toBe('harness_internal');

    const skipped = diagnosticsWithoutIo();
    await expect(
      advancePhase697V7WireStage(skipped.capability, 'request_validated'),
    ).rejects.toThrow('PHASE_6_9_7_V7_WIRE_TRANSITION_REJECTED');
    expect(skipped.readSnapshot().failureCategory).toBe('harness_internal');

    const forged = Object.freeze({
      version: 'phase-6.9.7-v7-wire-capability-v1',
    }) as typeof skipped.capability;
    expect(() => createAdapter(forged, async () => successResponse({ answer: 'x' }, 1, 1))).toThrow(
      'INVALID_MODEL_PROVIDER_CONFIG',
    );

    const claimed = diagnosticsWithoutIo();
    createAdapter(claimed.capability, async () => successResponse({ answer: 'x' }, 1, 1));
    expect(() =>
      createAdapter(claimed.capability, async () => successResponse({ answer: 'x' }, 1, 1)),
    ).toThrow('INVALID_MODEL_PROVIDER_CONFIG');

    const incomplete = diagnosticsWithoutIo();
    await advancePhase697V7WireStage(incomplete.capability, 'executor_entered');
    await expect(completePhase697V7Wire(incomplete.capability)).rejects.toThrow(
      'PHASE_6_9_7_V7_WIRE_TRANSITION_REJECTED',
    );
    expect(incomplete.readSnapshot().failureCategory).toBe('harness_internal');

    const aborted = diagnosticsWithoutIo();
    await advancePhase697V7WireStage(aborted.capability, 'executor_entered');
    await abortPhase697V7Wire(aborted.capability);
    await abortPhase697V7Wire(aborted.capability);
    expect(aborted.readSnapshot()).toMatchObject({
      state: 'failed',
      failureCategory: 'pre_dispatch_abort',
      counters: { executorInvocations: 1, providerDispatches: 0 },
    });
  });

  test('rejects every duplicate or skipped stage without changing frozen prefix counters', async () => {
    for (let index = 0; index < PHASE_6_9_7_V7_WIRE_STAGES.length; index += 1) {
      const duplicate = diagnosticsWithoutIo();
      for (let prefix = 0; prefix <= index; prefix += 1) {
        await advancePhase697V7WireStage(duplicate.capability, PHASE_6_9_7_V7_WIRE_STAGES[prefix]!);
      }
      const beforeDuplicate = duplicate.readSnapshot();
      await expect(
        advancePhase697V7WireStage(duplicate.capability, PHASE_6_9_7_V7_WIRE_STAGES[index]!),
      ).rejects.toThrow('PHASE_6_9_7_V7_WIRE_TRANSITION_REJECTED');
      const afterDuplicate = duplicate.readSnapshot();
      expect(afterDuplicate.stages).toEqual(beforeDuplicate.stages);
      expect(afterDuplicate.counters).toEqual(beforeDuplicate.counters);
      expect(afterDuplicate.failureCategory).toBe('harness_internal');
      expect(
        await advancePhase697V7WireStage(duplicate.capability, PHASE_6_9_7_V7_WIRE_STAGES.at(-1)!),
      ).toBe(false);
      expect(duplicate.readSnapshot().counters).toEqual(beforeDuplicate.counters);

      if (index + 1 >= PHASE_6_9_7_V7_WIRE_STAGES.length) continue;
      const skipped = diagnosticsWithoutIo();
      for (let prefix = 0; prefix < index; prefix += 1) {
        await advancePhase697V7WireStage(skipped.capability, PHASE_6_9_7_V7_WIRE_STAGES[prefix]!);
      }
      const beforeSkip = skipped.readSnapshot();
      await expect(
        advancePhase697V7WireStage(skipped.capability, PHASE_6_9_7_V7_WIRE_STAGES[index + 1]!),
      ).rejects.toThrow('PHASE_6_9_7_V7_WIRE_TRANSITION_REJECTED');
      expect(skipped.readSnapshot().stages).toEqual(beforeSkip.stages);
      expect(skipped.readSnapshot().counters).toEqual(beforeSkip.counters);
      expect(skipped.readSnapshot().failureCategory).toBe('harness_internal');
    }
  });

  test('lets the first terminal win and drains a late response after runtime timeout', async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchPending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const diagnostics = diagnosticsWithoutIo();
    const adapter = createAdapter(diagnostics.capability, async () => fetchPending);
    const signal = new AbortController().signal;
    const execution = adapter.executor(executorInput(signal));
    await waitForStage(diagnostics.readSnapshot, 'provider_dispatch_started');
    await diagnostics.terminateRuntime('runtime_timeout');
    resolveFetch(successResponse({ answer: 'late provider text' }, 4, 2));
    const thrown = await captureFailure(execution);
    expect(diagnostics.readSnapshot().failureCategory).toBe('runtime_timeout');
    expect(diagnostics.readSnapshot().lastCompletedStage).toBe('provider_dispatch_started');
    expect(diagnostics.readSnapshot().counters.providerResponses).toBe(0);
    expect(takeModelAgentProviderFailure(thrown, signal)).toEqual({ category: 'unknown' });
  });

  test('lets post-dispatch abort win and drains a later Response without counting it', async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchPending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const controller = new AbortController();
    const diagnostics = diagnosticsWithoutIo();
    const adapter = createAdapter(diagnostics.capability, async () => fetchPending);
    const execution = adapter.executor(executorInput(controller.signal));
    await waitForStage(diagnostics.readSnapshot, 'provider_dispatch_started');
    controller.abort();
    resolveFetch(successResponse({ answer: 'late after abort' }, 4, 2));
    const thrown = await captureFailure(execution);

    expect(diagnostics.readSnapshot()).toMatchObject({
      state: 'failed',
      failureCategory: 'post_dispatch_abort',
      lastCompletedStage: 'provider_dispatch_started',
      counters: { providerDispatches: 1, providerResponses: 0, verifiedUsages: 0 },
    });
    expect(takeModelAgentProviderFailure(thrown, controller.signal)).toEqual({
      category: 'unknown',
    });
  });

  test('drains late delegate rejection after timeout or abort without replacing the first terminal', async () => {
    for (const terminal of ['runtime_timeout', 'post_dispatch_abort'] as const) {
      let rejectFetch!: (reason: unknown) => void;
      const fetchPending = new Promise<Response>((_resolve, reject) => {
        rejectFetch = reject;
      });
      void fetchPending.catch(() => undefined);
      const controller = new AbortController();
      const diagnostics = diagnosticsWithoutIo();
      const adapter = createAdapter(diagnostics.capability, () => fetchPending);
      const execution = adapter.executor(executorInput(controller.signal));
      const failure = captureFailure(execution);
      await waitForStage(diagnostics.readSnapshot, 'provider_dispatch_started');

      if (terminal === 'runtime_timeout') {
        await diagnostics.terminateRuntime(terminal);
      } else {
        controller.abort();
        await waitForFailureCategory(diagnostics.readSnapshot, terminal);
      }
      rejectFetch(new Error(`late delegate rejection ${SENTINEL_KEY}`));
      const thrown = await failure;

      expect(diagnostics.readSnapshot()).toMatchObject({
        state: 'failed',
        failureCategory: terminal,
        lastCompletedStage: 'provider_dispatch_started',
        counters: { providerDispatches: 1, providerResponses: 0, verifiedUsages: 0 },
      });
      expect(String(thrown)).not.toContain(SENTINEL_KEY);
      expect(takeModelAgentProviderFailure(thrown, controller.signal)).toEqual({
        category: 'unknown',
      });
    }
  });

  test('preserves a committed response when abort wins before body audit and freezes success against late abort', async () => {
    let releaseBody!: () => void;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        releaseBody = () => {
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify({
                choices: [{ message: { content: '{"answer":"x"}' } }],
                usage: { prompt_tokens: 2, completion_tokens: 1 },
              }),
            ),
          );
          controller.close();
        };
      },
    });
    const controller = new AbortController();
    const diagnostics = diagnosticsWithoutIo();
    const adapter = createAdapter(
      diagnostics.capability,
      async () => new Response(body, { status: 200 }),
    );
    const execution = adapter.executor(executorInput(controller.signal));
    await waitForStage(diagnostics.readSnapshot, 'provider_response_received');
    controller.abort();
    releaseBody();
    await captureFailure(execution);
    expect(diagnostics.readSnapshot().failureCategory).toBe('post_dispatch_abort');
    expect(diagnostics.readSnapshot().lastCompletedStage).toBe('provider_response_received');

    const completed = diagnosticsWithoutIo();
    const completedAdapter = createAdapter(completed.capability, async () =>
      successResponse({ answer: 'winner' }, 2, 1),
    );
    await completedAdapter.executor(executorInput(new AbortController().signal));
    await completed.terminateRuntime('post_dispatch_abort');
    await completed.terminateRuntime('runtime_timeout');
    expect(completed.readSnapshot().state).toBe('succeeded');
    expect(completed.readSnapshot().failureCategory).toBeNull();
  });

  test('preserves a committed response when timeout wins before body audit', async () => {
    let releaseBody!: () => void;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        releaseBody = () => {
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify({
                choices: [{ message: { content: '{"answer":"x"}' } }],
                usage: { prompt_tokens: 2, completion_tokens: 1 },
              }),
            ),
          );
          controller.close();
        };
      },
    });
    const diagnostics = diagnosticsWithoutIo();
    const adapter = createAdapter(
      diagnostics.capability,
      async () => new Response(body, { status: 200 }),
    );
    const signal = new AbortController().signal;
    const execution = adapter.executor(executorInput(signal));
    await waitForStage(diagnostics.readSnapshot, 'provider_response_received');
    await diagnostics.terminateRuntime('runtime_timeout');
    releaseBody();
    const thrown = await captureFailure(execution);

    expect(diagnostics.readSnapshot()).toMatchObject({
      state: 'failed',
      failureCategory: 'runtime_timeout',
      lastCompletedStage: 'provider_response_received',
      counters: { providerDispatches: 1, providerResponses: 1, verifiedUsages: 0 },
    });
    expect(takeModelAgentProviderFailure(thrown, signal)).toEqual({ category: 'unknown' });
  });

  test('keeps the first terminal immutable across complete, abort, and timeout races', async () => {
    const succeeded = diagnosticsWithoutIo();
    for (const stage of PHASE_6_9_7_V7_WIRE_STAGES) {
      await advancePhase697V7WireStage(succeeded.capability, stage);
    }
    expect(await completePhase697V7Wire(succeeded.capability)).toBe(true);
    expect(await abortPhase697V7Wire(succeeded.capability)).toBe(false);
    await succeeded.terminateRuntime('runtime_timeout');
    expect(succeeded.readSnapshot()).toMatchObject({
      state: 'succeeded',
      failureCategory: null,
      counters: { verifiedUsages: 1 },
    });

    const aborted = diagnosticsWithoutIo();
    await advancePhase697V7WireStage(aborted.capability, 'executor_entered');
    expect(await abortPhase697V7Wire(aborted.capability)).toBe(true);
    expect(await completePhase697V7Wire(aborted.capability)).toBe(false);
    await aborted.terminateRuntime('runtime_timeout');
    expect(aborted.readSnapshot()).toMatchObject({
      state: 'failed',
      failureCategory: 'pre_dispatch_abort',
      counters: { executorInvocations: 1, providerDispatches: 0 },
    });

    const timedOut = diagnosticsWithoutIo();
    await advancePhase697V7WireStage(timedOut.capability, 'executor_entered');
    await timedOut.terminateRuntime('runtime_timeout');
    expect(await abortPhase697V7Wire(timedOut.capability)).toBe(false);
    expect(await completePhase697V7Wire(timedOut.capability)).toBe(false);
    expect(timedOut.readSnapshot()).toMatchObject({
      state: 'failed',
      failureCategory: 'runtime_timeout',
      counters: { executorInvocations: 1, providerDispatches: 0 },
    });
  });
});

function createAdapter(
  capability: ReturnType<typeof createPhase697V7WireDiagnostics>['capability'],
  delegate: typeof fetch,
): FirstPartyDeepSeekV4ProDirectAdapter {
  return createFirstPartyDeepSeekV4ProDirectAdapter(CONFIG, capability, { fetch: delegate });
}

function constructAdapter(
  config: unknown,
  capability: ReturnType<typeof createPhase697V7WireDiagnostics>['capability'],
  dependencies?: unknown,
) {
  const factory = createFirstPartyDeepSeekV4ProDirectAdapter as unknown as (
    config: unknown,
    capability: ReturnType<typeof createPhase697V7WireDiagnostics>['capability'],
    dependencies?: unknown,
  ) => FirstPartyDeepSeekV4ProDirectAdapter;
  return factory(config, capability, dependencies);
}

function diagnosticsWithoutIo() {
  return createPhase697V7WireDiagnostics({ appendStage: () => undefined });
}

function executorInput(signal: AbortSignal) {
  return {
    schema: OUTPUT_SCHEMA,
    systemPrompt: 'Return one strict object.',
    userPrompt: SENTINEL_PROMPT,
    maxOutputTokens: 64,
    signal,
  };
}

function successResponse(object: unknown, inputTokens: number, outputTokens: number) {
  return providerResponse({
    choices: [{ message: { content: JSON.stringify(object) } }],
    usage: {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      completion_tokens_details: { reasoning_tokens: 0 },
    },
  });
}

function providerResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function responseWithStatus(status: number): Response {
  const target = successResponse({ answer: 'x' }, 2, 1);
  return new Proxy(target, {
    get(inner, property) {
      if (property === 'status') return status;
      return Reflect.get(inner, property, inner);
    },
  });
}

function responseWithThrowingStatus(): Response {
  const target = successResponse({ answer: 'x' }, 2, 1);
  return new Proxy(target, {
    get(inner, property) {
      if (property === 'status') throw new Error('hostile status ' + SENTINEL_KEY);
      return Reflect.get(inner, property, inner);
    },
  });
}

async function captureFailure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected failure');
}

async function waitForStage(
  read: () => Readonly<{ stages: readonly Phase697V7WireStage[] }>,
  stage: Phase697V7WireStage,
) {
  for (let iteration = 0; iteration < 100; iteration += 1) {
    if (read().stages.includes(stage)) return;
    await Promise.resolve();
  }
  throw new Error(`stage not reached: ${stage}`);
}

async function waitForFailureCategory(
  read: () => Readonly<{ failureCategory: Phase697V7WireFailureCategory | null }>,
  category: Phase697V7WireFailureCategory,
) {
  for (let iteration = 0; iteration < 100; iteration += 1) {
    if (read().failureCategory === category) return;
    await Promise.resolve();
  }
  throw new Error(`failure category not reached: ${category}`);
}
