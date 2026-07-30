import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import {
  createFirstPartyDeepSeekV4ProTransportDiagnosticAdapter,
  createPhase697V7WireDiagnostics,
  FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_ADAPTER_VERSION,
  FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_ADAPTER_VERSION,
  FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_SUBTYPES,
  FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_VERSION,
  type FirstPartyDeepSeekV4ProTransportDiagnosticSubtype,
} from '../src/index.ts';
import { takeModelAgentProviderFailure } from '../src/model-agent-provider-failure.ts';

const SENTINEL_KEY = 'transport-diagnostic-synthetic-key-never-send';
const SENTINEL_PROMPT = 'transport diagnostic prompt must not enter diagnostics';
const SENTINEL_ERROR = 'transport diagnostic raw error must never be retained';
const CONFIG = Object.freeze({
  provider: 'deepseek' as const,
  apiKey: SENTINEL_KEY,
  baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-v4-pro',
});
const OUTPUT_SCHEMA = z.object({ answer: z.string() }).strict();

describe('first-party DeepSeek V4 Pro transport diagnostics', () => {
  test('keeps the sealed V1 adapter identity and freezes a separate diagnostic contract', () => {
    expect(FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_ADAPTER_VERSION).toBe(
      'first-party-deepseek-v4-pro-direct-v1',
    );
    expect(FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_ADAPTER_VERSION).toBe(
      'first-party-deepseek-v4-pro-transport-diagnostic-adapter-v1',
    );
    expect(FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_VERSION).toBe(
      'first-party-deepseek-v4-pro-transport-diagnostic-v1',
    );
    expect(FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_SUBTYPES).toEqual([
      'aborted',
      'timeout',
      'dns',
      'tls',
      'proxy',
      'connection_refused',
      'connection_reset',
      'network_unreachable',
      'unknown',
    ]);
    expect(Object.isFrozen(FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_SUBTYPES)).toBe(true);
  });

  test('classifies only fixed transport subtypes while preserving the public transport failure', async () => {
    const cases: ReadonlyArray<
      readonly [string, unknown, FirstPartyDeepSeekV4ProTransportDiagnosticSubtype]
    > = [
      ['aborted DOMException', new DOMException(SENTINEL_ERROR, 'AbortError'), 'aborted'],
      ['timeout name', errorWithName('TimeoutError'), 'timeout'],
      ['nested DNS code', errorWithCause(errorWithCode('ENOTFOUND')), 'dns'],
      ['TLS code', errorWithCode('CERT_HAS_EXPIRED'), 'tls'],
      ['proxy code', errorWithCode('ERR_PROXY_CONNECTION_FAILED'), 'proxy'],
      ['refused code', errorWithCode('ECONNREFUSED'), 'connection_refused'],
      ['reset code', errorWithCode('ECONNRESET'), 'connection_reset'],
      ['unreachable code', errorWithCode('ENETUNREACH'), 'network_unreachable'],
      ['overlong code', errorWithCode('E'.repeat(129)), 'unknown'],
      ['unknown primitive', SENTINEL_ERROR, 'unknown'],
    ];

    for (const [label, thrown, expectedSubtype] of cases) {
      const observation = await observeTransportFailure(thrown);

      expect(observation.publicFailure, label).toEqual({ category: 'transport' });
      expect(observation.diagnostic, label).toEqual({
        version: 'first-party-deepseek-v4-pro-transport-diagnostic-v1',
        subtype: expectedSubtype,
      });
      expect(Object.isFrozen(observation.diagnostic), label).toBe(true);
      expect(observation.wire, label).toMatchObject({
        state: 'failed',
        lastCompletedStage: 'provider_dispatch_started',
        failureCategory: 'transport',
        counters: {
          executorInvocations: 1,
          providerDispatches: 1,
          providerResponses: 0,
          verifiedUsages: 0,
        },
      });
      const safeBytes = JSON.stringify({
        diagnostic: observation.diagnostic,
        publicFailure: observation.publicFailure,
        wire: observation.wire,
      });
      expect(safeBytes, label).not.toContain(SENTINEL_ERROR);
      expect(safeBytes, label).not.toContain(SENTINEL_KEY);
      expect(safeBytes, label).not.toContain(SENTINEL_PROMPT);
      expect(String(observation.thrown), label).not.toContain(SENTINEL_ERROR);
    }
  });

  test('records an in-flight signal abort without rewriting the existing public abort terminal', async () => {
    const observation = await observeTransportFailure(errorWithCode('ECONNRESET'), true);

    expect(observation.diagnostic?.subtype).toBe('aborted');
    expect(observation.publicFailure).toEqual({ category: 'unknown' });
    expect(observation.wire).toMatchObject({
      state: 'failed',
      lastCompletedStage: 'provider_dispatch_started',
      failureCategory: 'post_dispatch_abort',
      counters: {
        executorInvocations: 1,
        providerDispatches: 1,
        providerResponses: 0,
        verifiedUsages: 0,
      },
    });
  });

  test('never invokes hostile error getters and bounds recursive causes', async () => {
    let getterReads = 0;
    const hostile = {} as Record<string, unknown>;
    for (const key of ['name', 'code', 'cause', 'message', 'stack']) {
      Object.defineProperty(hostile, key, {
        enumerable: true,
        get() {
          getterReads += 1;
          throw new Error(`${SENTINEL_ERROR}:${key}`);
        },
      });
    }
    const hostileObservation = await observeTransportFailure(hostile);
    expect(getterReads).toBe(0);
    expect(hostileObservation.diagnostic?.subtype).toBe('unknown');

    const cyclic = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(cyclic, 'code', { value: 'UNCLASSIFIED_CODE' });
    Object.defineProperty(cyclic, 'cause', { value: cyclic });
    const cyclicObservation = await observeTransportFailure(cyclic);
    expect(cyclicObservation.diagnostic?.subtype).toBe('unknown');

    let proxyTrapCalls = 0;
    const hostileProxy = new Proxy(Object.create(null) as Record<string, unknown>, {
      getOwnPropertyDescriptor() {
        proxyTrapCalls += 1;
        throw new Error(SENTINEL_ERROR);
      },
    });
    const proxyObservation = await observeTransportFailure(hostileProxy);
    expect(proxyTrapCalls).toBeGreaterThan(0);
    expect(proxyObservation.diagnostic?.subtype).toBe('unknown');
  });

  test('rejects forged or hostile dependencies before claiming the sealed wire capability', () => {
    let getterReads = 0;
    const hostile = {} as Record<string, unknown>;
    Object.defineProperty(hostile, 'fetch', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error(SENTINEL_ERROR);
      },
    });
    const invalidDependencies: unknown[] = [
      null,
      {},
      { fetch: 1 },
      { fetch: async () => new Response(), extra: true },
      Object.assign(Object.create(null) as Record<string, unknown>, {
        fetch: async () => new Response(),
      }),
      hostile,
    ];

    for (const dependencies of invalidDependencies) {
      const diagnostics = createPhase697V7WireDiagnostics({ appendStage() {} });
      expect(() =>
        createFirstPartyDeepSeekV4ProTransportDiagnosticAdapter(
          CONFIG,
          diagnostics.capability,
          dependencies as never,
        ),
      ).toThrow('INVALID_DEEPSEEK_TRANSPORT_DIAGNOSTIC_CONFIG');
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
    }
    expect(getterReads).toBe(0);
  });

  test('keeps production provenance without touching the default network delegate', () => {
    const diagnostics = createPhase697V7WireDiagnostics({ appendStage() {} });
    const adapter = createFirstPartyDeepSeekV4ProTransportDiagnosticAdapter(
      CONFIG,
      diagnostics.capability,
    );

    expect(adapter.version).toBe('first-party-deepseek-v4-pro-transport-diagnostic-adapter-v1');
    expect(adapter.provenance).toBe('first_party_deepseek_v4_pro_transport_diagnostic');
    expect(Object.isFrozen(adapter)).toBe(true);
    expect(adapter.readTransportDiagnostic()).toBeNull();
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

    const syntheticDiagnostics = createPhase697V7WireDiagnostics({ appendStage() {} });
    const explicitDependencyAdapter = createFirstPartyDeepSeekV4ProTransportDiagnosticAdapter(
      CONFIG,
      syntheticDiagnostics.capability,
      { fetch: async () => new Response() },
    );
    expect(explicitDependencyAdapter.provenance).toBe('synthetic_test');
    expect(Object.isFrozen(explicitDependencyAdapter)).toBe(true);
  });
});

async function observeTransportFailure(thrown: unknown, abortDuringDelegate = false) {
  const controller = new AbortController();
  const signal = controller.signal;
  const diagnostics = createPhase697V7WireDiagnostics({ appendStage() {} });
  const adapter = createFirstPartyDeepSeekV4ProTransportDiagnosticAdapter(
    CONFIG,
    diagnostics.capability,
    {
      fetch: async () => {
        if (abortDuringDelegate) controller.abort();
        throw thrown;
      },
    },
  );
  let caught: unknown;
  try {
    await adapter.executor({
      schema: OUTPUT_SCHEMA,
      systemPrompt: 'Return one strict object.',
      userPrompt: SENTINEL_PROMPT,
      maxOutputTokens: 64,
      signal,
    });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  return {
    thrown: caught,
    publicFailure: takeModelAgentProviderFailure(caught, signal),
    diagnostic: adapter.readTransportDiagnostic(),
    wire: diagnostics.readSnapshot(),
  };
}

function errorWithCode(code: string) {
  const error = new Error(SENTINEL_ERROR);
  Object.defineProperty(error, 'code', { value: code, enumerable: true });
  return error;
}

function errorWithName(name: string) {
  const error = new Error(SENTINEL_ERROR);
  Object.defineProperty(error, 'name', { value: name, enumerable: true });
  return error;
}

function errorWithCause(cause: unknown) {
  const error = new TypeError(SENTINEL_ERROR);
  Object.defineProperty(error, 'cause', { value: cause, enumerable: true });
  return error;
}
