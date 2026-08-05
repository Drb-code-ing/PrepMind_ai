import { describe, expect, test } from 'bun:test';

import {
  QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
  QWEN_TEXT_EMBEDDING_V4_MODEL,
  QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE,
  createPhase698ProviderWireDiagnostics,
  createQwenTextEmbeddingV4DiagnosticProvider,
  type QwenTextEmbeddingV4Executor,
} from '@repo/ai';

import {
  completePhase698ArchitectureRecoveryQwenDiagnostic,
  createPhase698ArchitectureRecoveryQwenDiagnosticSession,
  recordPhase698ArchitectureRecoveryQwenAdmission,
  recordPhase698ArchitectureRecoveryQwenCallResult,
  recordPhase698ArchitectureRecoveryQwenCost,
  recordPhase698ArchitectureRecoveryQwenEmbedding,
  recordPhase698ArchitectureRecoveryQwenProviderObservation,
  recordPhase698ArchitectureRecoveryQwenRanking,
  recordPhase698ArchitectureRecoveryQwenRequestContract,
  recordPhase698ArchitectureRecoveryQwenUsage,
  type Phase698ArchitectureRecoveryQwenDiagnosticSession,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-qwen.ts';

const SENTINEL = 'r2-qwen-query-credential-raw-must-not-leak';
const CONFIG = Object.freeze({
  apiKey: 'r2-qwen-synthetic-key',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: QWEN_TEXT_EMBEDDING_V4_MODEL,
  dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
  priceProfile: QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE,
});

describe('Phase 6.9.8 Architecture Recovery Qwen diagnostic integration', () => {
  test('keeps Qwen transition authority off the public Agent barrel', async () => {
    const publicModule = await import('@repo/agent');
    for (const name of [
      'createPhase698ArchitectureRecoveryQwenDiagnosticSession',
      'recordPhase698ArchitectureRecoveryQwenProviderObservation',
      'recordPhase698ArchitectureRecoveryQwenEmbedding',
      'recordPhase698ArchitectureRecoveryQwenUsage',
      'completePhase698ArchitectureRecoveryQwenDiagnostic',
    ]) {
      expect(name in publicModule).toBe(false);
    }
  });

  test('reaches applied only after a synthetic first-party Qwen wire proves every Provider stage', async () => {
    const harness = createHarness(async () => qwenResponse({}));
    recordAdmissionAndRequest(harness.session);
    await execute(harness.executor);
    expect(
      recordPhase698ArchitectureRecoveryQwenProviderObservation(harness.session.capability),
    ).toBe(true);
    expect(recordPhase698ArchitectureRecoveryQwenEmbedding(harness.session.capability)).toBe(true);
    expect(recordPhase698ArchitectureRecoveryQwenUsage(harness.session.capability)).toBe(true);
    expect(recordPhase698ArchitectureRecoveryQwenCost(harness.session.capability, 'accepted')).toBe(
      true,
    );
    expect(
      recordPhase698ArchitectureRecoveryQwenRanking(harness.session.capability, 'accepted'),
    ).toBe(true);
    expect(
      recordPhase698ArchitectureRecoveryQwenCallResult(harness.session.capability, 'accepted'),
    ).toBe(true);
    expect(completePhase698ArchitectureRecoveryQwenDiagnostic(harness.session.capability)).toBe(
      true,
    );
    expect(harness.session.read()).toEqual({
      diagnosticVersion: 'phase-6.9.8-retriever-final-response-bounded-diagnostic-v1',
      callPhase: 'rewrite_original_retrieval',
      stage: 'applied',
      reasonCode: 'applied',
      providerBoundary: 'response_and_usage_observed',
      topLevelTypeBucket: 'object',
      fieldCountBucket: '5_plus',
      terminalCountBucket: 'not_applicable',
      rawDataRetained: false,
    });
    expect(harness.session.readSnapshot().completedStages).toEqual([
      'admission',
      'request_contract',
      'provider_dispatch',
      'provider_response',
      'provider_envelope',
      'embedding_contract',
      'usage_contract',
      'cost_contract',
      'ranking_contract',
      'call_result_contract',
      'applied',
    ]);
    expect(JSON.stringify(harness.session.read())).not.toMatch(
      /query-credential|synthetic-key|dashscope|embedding/iu,
    );
  });

  test('maps transport, HTTP, envelope, embedding, and usage failures to the earliest stage', async () => {
    const cases = [
      {
        fetch: async () => {
          throw new Error(`${SENTINEL}: transport`);
        },
        expected: ['provider_response', 'transport_failure', 'dispatched_no_response'],
      },
      {
        fetch: async () => new Response('', { status: 429 }),
        expected: ['provider_response', 'http_rate_limit', 'response_observed'],
      },
      {
        fetch: async () =>
          new Response('{}', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        expected: ['provider_envelope', 'provider_envelope_invalid', 'response_observed'],
      },
      {
        fetch: async () => qwenResponse({ data: [] }),
        expected: ['embedding_contract', 'embedding_count_invalid', 'response_observed'],
      },
      {
        fetch: async () => qwenResponse({ embedding: [1] }),
        expected: ['embedding_contract', 'embedding_dimension_invalid', 'response_observed'],
      },
      {
        fetch: async () => qwenResponse({ embedding: zeroVector() }),
        expected: ['embedding_contract', 'embedding_value_invalid', 'response_observed'],
      },
      {
        fetch: async () => qwenResponse({ inputTokens: 0 }),
        expected: ['usage_contract', 'usage_invalid', 'response_observed'],
      },
    ] as const;

    for (const current of cases) {
      const harness = createHarness(current.fetch);
      recordAdmissionAndRequest(harness.session);
      await settle(harness.executor);
      recordPhase698ArchitectureRecoveryQwenProviderObservation(harness.session.capability);
      if (harness.session.read() === null) {
        recordPhase698ArchitectureRecoveryQwenEmbedding(harness.session.capability);
      }
      if (harness.session.read() === null) {
        recordPhase698ArchitectureRecoveryQwenUsage(harness.session.capability);
      }
      const diagnostic = harness.session.read();
      expect(
        [diagnostic?.stage, diagnostic?.reasonCode, diagnostic?.providerBoundary],
        current.expected.join('/'),
      ).toEqual(current.expected);
      expect(JSON.stringify(diagnostic)).not.toMatch(/query-credential|synthetic-key|dashscope/iu);
    }
  });

  test('keeps cost, ranking, and result failures separate after verified usage', async () => {
    const cases = [
      { stage: 'cost_contract', status: 'cost_mismatch', expected: 'cost_mismatch' },
      { stage: 'ranking_contract', status: 'ranking_invalid', expected: 'ranking_invalid' },
      { stage: 'call_result_contract', status: 'phase_mismatch', expected: 'phase_mismatch' },
    ] as const;
    for (const current of cases) {
      const harness = createHarness(async () => qwenResponse({}));
      await recordThroughUsage(harness);
      if (current.stage !== 'cost_contract') {
        recordPhase698ArchitectureRecoveryQwenCost(harness.session.capability, 'accepted');
      }
      if (current.stage === 'call_result_contract') {
        recordPhase698ArchitectureRecoveryQwenRanking(harness.session.capability, 'accepted');
      }
      if (current.stage === 'cost_contract') {
        recordPhase698ArchitectureRecoveryQwenCost(harness.session.capability, current.status);
      } else if (current.stage === 'ranking_contract') {
        recordPhase698ArchitectureRecoveryQwenRanking(harness.session.capability, current.status);
      } else {
        recordPhase698ArchitectureRecoveryQwenCallResult(
          harness.session.capability,
          current.status,
        );
      }
      expect(harness.session.read()).toMatchObject({
        stage: current.stage,
        reasonCode: current.expected,
        providerBoundary: 'response_and_usage_observed',
      });
    }
  });

  test('keeps indexed embedding authority invariant to Provider data order', async () => {
    const vectors = [unitVector(), secondUnitVector()];
    const diagnostics = [];
    for (const order of [
      [0, 1],
      [1, 0],
    ] as const) {
      const data = order.map((index) => ({
        object: 'embedding',
        index,
        embedding: vectors[index],
      }));
      const harness = createHarness(async () => qwenResponse({ data, inputTokens: 12 }));
      recordAdmissionAndRequest(harness.session);
      await harness.executor({
        inputs: [SENTINEL, 'bounded corpus'],
        dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
        signal: new AbortController().signal,
      });
      recordPhase698ArchitectureRecoveryQwenProviderObservation(harness.session.capability);
      recordPhase698ArchitectureRecoveryQwenEmbedding(harness.session.capability);
      recordPhase698ArchitectureRecoveryQwenUsage(harness.session.capability);
      recordPhase698ArchitectureRecoveryQwenCost(harness.session.capability, 'accepted');
      recordPhase698ArchitectureRecoveryQwenRanking(harness.session.capability, 'accepted');
      recordPhase698ArchitectureRecoveryQwenCallResult(harness.session.capability, 'accepted');
      completePhase698ArchitectureRecoveryQwenDiagnostic(harness.session.capability);
      diagnostics.push(harness.session.read());
    }
    expect(diagnostics[0]).toEqual(diagnostics[1]);
    expect(diagnostics[0]).toMatchObject({ stage: 'applied', reasonCode: 'applied' });
  });

  test('rejects active, forged, reused, cross-family, and out-of-order capabilities', async () => {
    const forged = createPhase698ArchitectureRecoveryQwenDiagnosticSession(
      'rewrite_original_retrieval',
      { version: 'phase-6.9.8-provider-wire-capability-v1' },
    );
    expect(forged.read()).toMatchObject({ stage: 'admission', reasonCode: 'capability_invalid' });

    const qwenWire = createPhase698ProviderWireDiagnostics('qwen_retrieval');
    const first = createPhase698ArchitectureRecoveryQwenDiagnosticSession(
      'rewrite_candidate_retrieval',
      qwenWire.capability,
    );
    const reused = createPhase698ArchitectureRecoveryQwenDiagnosticSession(
      'rewrite_original_retrieval',
      qwenWire.capability,
    );
    expect(reused.read()).toMatchObject({ stage: 'admission', reasonCode: 'capability_invalid' });
    expect(recordPhase698ArchitectureRecoveryQwenRanking(first.capability, 'accepted')).toBe(false);
    expect(first.read()).toMatchObject({ stage: 'admission', reasonCode: 'unknown' });

    const finalWire = createPhase698ProviderWireDiagnostics('final_response_stream');
    expect(
      createPhase698ArchitectureRecoveryQwenDiagnosticSession(
        'rewrite_original_retrieval',
        finalWire.capability,
      ).read(),
    ).toMatchObject({ stage: 'admission', reasonCode: 'capability_invalid' });

    let release: ((value: Response) => void) | undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const active = createHarness(() => pendingResponse);
    recordAdmissionAndRequest(active.session);
    const pending = execute(active.executor);
    await waitForDispatch(active.wire);
    expect(
      recordPhase698ArchitectureRecoveryQwenProviderObservation(active.session.capability),
    ).toBe(false);
    expect(active.session.read()).toBeNull();
    release?.(qwenResponse({}));
    await pending;
  });
});

function createHarness(fetch: typeof globalThis.fetch) {
  const wire = createPhase698ProviderWireDiagnostics('qwen_retrieval');
  const session = createPhase698ArchitectureRecoveryQwenDiagnosticSession(
    'rewrite_original_retrieval',
    wire.capability,
  );
  const provider = createQwenTextEmbeddingV4DiagnosticProvider(CONFIG, wire.capability, { fetch });
  return { wire, session, executor: provider.executor };
}

function recordAdmissionAndRequest(session: Phase698ArchitectureRecoveryQwenDiagnosticSession) {
  expect(recordPhase698ArchitectureRecoveryQwenAdmission(session.capability, 'accepted')).toBe(
    true,
  );
  expect(
    recordPhase698ArchitectureRecoveryQwenRequestContract(session.capability, 'accepted'),
  ).toBe(true);
}

async function recordThroughUsage(harness: ReturnType<typeof createHarness>) {
  recordAdmissionAndRequest(harness.session);
  await execute(harness.executor);
  expect(
    recordPhase698ArchitectureRecoveryQwenProviderObservation(harness.session.capability),
  ).toBe(true);
  expect(recordPhase698ArchitectureRecoveryQwenEmbedding(harness.session.capability)).toBe(true);
  expect(recordPhase698ArchitectureRecoveryQwenUsage(harness.session.capability)).toBe(true);
}

function execute(executor: QwenTextEmbeddingV4Executor) {
  return executor({
    inputs: [SENTINEL],
    dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
    signal: new AbortController().signal,
  });
}

async function settle(executor: QwenTextEmbeddingV4Executor) {
  try {
    await execute(executor);
  } catch {
    // Diagnostic state is the authority; thrown provider values are intentionally ignored.
  }
}

function qwenResponse(input: {
  data?: readonly unknown[];
  embedding?: readonly number[];
  inputTokens?: number;
}) {
  const tokens = input.inputTokens ?? 9;
  return new Response(
    JSON.stringify({
      object: 'list',
      id: 'qwen-r2-agent-synthetic',
      model: QWEN_TEXT_EMBEDDING_V4_MODEL,
      data: input.data ?? [
        { object: 'embedding', index: 0, embedding: input.embedding ?? unitVector() },
      ],
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

function secondUnitVector() {
  return Object.freeze([
    0,
    1,
    ...Array.from({ length: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS - 2 }, () => 0),
  ]);
}

async function waitForDispatch(wire: ReturnType<typeof createPhase698ProviderWireDiagnostics>) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (wire.readSnapshot().counters.providerDispatches === 1) return;
    await Promise.resolve();
  }
  throw new Error('QWEN_DISPATCH_NOT_REACHED');
}
