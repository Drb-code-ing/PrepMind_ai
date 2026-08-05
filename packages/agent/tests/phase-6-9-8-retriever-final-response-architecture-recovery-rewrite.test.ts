import { describe, expect, test } from 'bun:test';

import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createPhase697V7WireDiagnostics,
  type FirstPartyDeepSeekV4ProDirectAdapter,
  type Phase697V7WireDiagnostics,
  type Phase697V7WireStage,
} from '@repo/ai';

import {
  completePhase698ArchitectureRecoveryRewriteDiagnostic,
  createPhase698ArchitectureRecoveryRewriteDiagnosticSession,
  recordPhase698ArchitectureRecoveryRewriteAdmission,
  recordPhase698ArchitectureRecoveryRewriteCallResult,
  recordPhase698ArchitectureRecoveryRewriteCandidateProjection,
  recordPhase698ArchitectureRecoveryRewriteCost,
  recordPhase698ArchitectureRecoveryRewriteLocalAuthority,
  recordPhase698ArchitectureRecoveryRewriteProviderObservation,
  recordPhase698ArchitectureRecoveryRewriteRequestContract,
  recordPhase698ArchitectureRecoveryRewriteRuntimeResult,
  recordPhase698ArchitectureRecoveryRewriteTrace,
  recordPhase698ArchitectureRecoveryRewriteUsage,
  type Phase698ArchitectureRecoveryRewriteDiagnosticSession,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-contract.ts';
import { RETRIEVER_QUERY_REWRITE_MODEL_SCHEMA } from '../src/model-candidates/retriever-query-rewrite-model-candidate.ts';

const SENTINEL_KEY = 'r1-synthetic-key-never-send';
const SENTINEL_PROMPT = 'R1 raw query and prompt must never enter diagnostics';
const CONFIG = Object.freeze({
  provider: 'deepseek' as const,
  apiKey: SENTINEL_KEY,
  baseURL: 'https://api.deepseek.com/v1' as const,
  model: 'deepseek-v4-pro' as const,
});

describe('Phase 6.9.8 Architecture Recovery rewrite diagnostic stage machine', () => {
  test('keeps every diagnostic transition off the public @repo/agent barrel', async () => {
    const publicModule = await import('@repo/agent');
    for (const name of [
      'createPhase698ArchitectureRecoveryRewriteDiagnosticSession',
      'recordPhase698ArchitectureRecoveryRewriteAdmission',
      'recordPhase698ArchitectureRecoveryRewriteProviderObservation',
      'recordPhase698ArchitectureRecoveryRewriteRuntimeResult',
      'recordPhase698ArchitectureRecoveryRewriteUsage',
      'recordPhase698ArchitectureRecoveryRewriteCost',
      'completePhase698ArchitectureRecoveryRewriteDiagnostic',
    ]) {
      expect(name in publicModule).toBe(false);
    }
  });

  test('reaches one applied terminal only after a synthetic first-party adapter proves wire observation', async () => {
    const harness = createHarness(async () =>
      successResponse({ rewrittenQuery: '根据单调且有界条件解释收敛' }, 17, 5),
    );

    recordAdmissionAndRequest(harness.session);
    expect(await executeAdapter(harness.adapter)).toMatchObject({
      object: { rewrittenQuery: '根据单调且有界条件解释收敛' },
      usage: { inputTokens: 17, outputTokens: 5 },
    });
    expect(
      recordPhase698ArchitectureRecoveryRewriteProviderObservation(harness.session.capability),
    ).toBe(true);
    expect(
      recordPhase698ArchitectureRecoveryRewriteRuntimeResult(
        harness.session.capability,
        'accepted',
      ),
    ).toBe(true);
    expect(
      recordPhase698ArchitectureRecoveryRewriteCandidateProjection(
        harness.session.capability,
        'applied',
      ),
    ).toBe(true);
    expect(
      recordPhase698ArchitectureRecoveryRewriteLocalAuthority(
        harness.session.capability,
        'accepted',
      ),
    ).toBe(true);
    expect(
      recordPhase698ArchitectureRecoveryRewriteTrace(harness.session.capability, 'accepted'),
    ).toBe(true);
    expect(recordPhase698ArchitectureRecoveryRewriteUsage(harness.session.capability)).toBe(true);
    expect(
      recordPhase698ArchitectureRecoveryRewriteCost(harness.session.capability, 'accepted'),
    ).toBe(true);
    expect(
      recordPhase698ArchitectureRecoveryRewriteCallResult(harness.session.capability, 'accepted'),
    ).toBe(true);
    expect(completePhase698ArchitectureRecoveryRewriteDiagnostic(harness.session.capability)).toBe(
      true,
    );

    expect(harness.session.read()).toEqual({
      diagnosticVersion: 'phase-6.9.8-retriever-final-response-bounded-diagnostic-v1',
      callPhase: 'rewrite_candidate_model',
      stage: 'applied',
      reasonCode: 'applied',
      providerBoundary: 'response_and_usage_observed',
      topLevelTypeBucket: 'object',
      fieldCountBucket: '1',
      terminalCountBucket: 'not_applicable',
      rawDataRetained: false,
    });
    expect(harness.session.readSnapshot().completedStages).toEqual([
      'admission',
      'request_contract',
      'provider_dispatch',
      'provider_response',
      'provider_envelope',
      'runtime_result',
      'rewrite_candidate_projection',
      'rewrite_local_authority',
      'trace_contract',
      'usage_contract',
      'cost_contract',
      'call_result_contract',
      'applied',
    ]);
    expect(harness.adapter.provenance).toBe('synthetic_test');
    expect(JSON.stringify(harness.session.read())).not.toMatch(
      /raw query|prompt|credential|api[_-]?key|rewrittenQuery|deepseek\.com/iu,
    );
  });

  test('derives transport, HTTP, envelope, and usage failures from real wire snapshots', async () => {
    const cases: ReadonlyArray<{
      fetch: typeof fetch;
      expected: Readonly<Record<string, unknown>>;
      continueToUsage?: true;
    }> = [
      {
        fetch: async () => {
          throw new Error('raw transport ' + SENTINEL_KEY);
        },
        expected: {
          stage: 'provider_response',
          reasonCode: 'transport_failure',
          providerBoundary: 'dispatched_no_response',
        },
      },
      {
        fetch: async () => new Response('', { status: 401 }),
        expected: {
          stage: 'provider_response',
          reasonCode: 'http_auth',
          providerBoundary: 'response_observed',
        },
      },
      {
        fetch: async () => successResponse({ rewrittenQuery: 'safe', extra: true }, 7, 2),
        expected: {
          stage: 'provider_envelope',
          reasonCode: 'provider_envelope_invalid',
          providerBoundary: 'response_observed',
          topLevelTypeBucket: 'unknown',
          fieldCountBucket: 'unknown',
        },
      },
      {
        fetch: async () => successResponse({ rewrittenQuery: 'safe' }, 0, 2),
        continueToUsage: true,
        expected: {
          stage: 'usage_contract',
          reasonCode: 'usage_invalid',
          providerBoundary: 'response_observed',
          topLevelTypeBucket: 'object',
          fieldCountBucket: '1',
        },
      },
    ];

    for (const item of cases) {
      const harness = createHarness(item.fetch);
      recordAdmissionAndRequest(harness.session);
      await settleAdapter(harness.adapter);
      expect(
        recordPhase698ArchitectureRecoveryRewriteProviderObservation(harness.session.capability),
      ).toBe(true);
      if (item.continueToUsage) recordToUsage(harness.session);
      expect(harness.session.read()).toMatchObject(item.expected);
      expect(JSON.stringify(harness.session.read())).not.toMatch(
        /raw transport|credential|api[_-]?key|rewrittenQuery|deepseek\.com/iu,
      );
    }
  });

  test('keeps runtime, candidate, local authority, trace, cost, and result failures distinct', async () => {
    const cases: ReadonlyArray<{
      prepare: (session: Phase698ArchitectureRecoveryRewriteDiagnosticSession) => void;
      expected: readonly [string, string, string];
    }> = [
      {
        prepare: (session) => {
          recordPhase698ArchitectureRecoveryRewriteRuntimeResult(
            session.capability,
            'runtime_result_invalid',
          );
        },
        expected: ['runtime_result', 'runtime_result_invalid', 'response_observed'],
      },
      {
        prepare: (session) => {
          recordPhase698ArchitectureRecoveryRewriteRuntimeResult(session.capability, 'accepted');
          recordPhase698ArchitectureRecoveryRewriteCandidateProjection(
            session.capability,
            'candidate_rejected',
          );
        },
        expected: ['rewrite_candidate_projection', 'candidate_rejected', 'response_observed'],
      },
      {
        prepare: (session) => {
          recordToLocalAuthority(session);
          recordPhase698ArchitectureRecoveryRewriteLocalAuthority(
            session.capability,
            'rewrite_authority_invalid',
          );
        },
        expected: ['rewrite_local_authority', 'rewrite_authority_invalid', 'response_observed'],
      },
      {
        prepare: (session) => {
          recordToTrace(session);
          recordPhase698ArchitectureRecoveryRewriteTrace(
            session.capability,
            'trace_identity_invalid',
          );
        },
        expected: ['trace_contract', 'trace_identity_invalid', 'response_observed'],
      },
      {
        prepare: (session) => {
          recordToCost(session);
          recordPhase698ArchitectureRecoveryRewriteCost(session.capability, 'cost_mismatch');
        },
        expected: ['cost_contract', 'cost_mismatch', 'response_and_usage_observed'],
      },
      {
        prepare: (session) => {
          recordToCallResult(session);
          recordPhase698ArchitectureRecoveryRewriteCallResult(
            session.capability,
            'result_shape_invalid',
          );
        },
        expected: ['call_result_contract', 'result_shape_invalid', 'response_and_usage_observed'],
      },
    ];

    for (const item of cases) {
      const harness = createHarness(async () =>
        successResponse({ rewrittenQuery: 'safe result' }, 8, 3),
      );
      await recordToRuntimeResult(harness);
      item.prepare(harness.session);
      const diagnostic = harness.session.read();
      expect([diagnostic?.stage, diagnostic?.reasonCode, diagnostic?.providerBoundary]).toEqual(
        item.expected,
      );
    }
  });

  test('does not let an active wire or caller-supplied observed text advance Provider authority', async () => {
    let release: ((response: Response) => void) | undefined;
    const response = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const harness = createHarness(() => response);
    recordAdmissionAndRequest(harness.session);
    const pending = executeAdapter(harness.adapter);
    await waitForStage(harness.diagnostics, 'provider_dispatch_started');

    const unsafeCall = recordPhase698ArchitectureRecoveryRewriteProviderObservation as unknown as (
      capability: unknown,
      callerStatus: string,
    ) => boolean;
    expect(unsafeCall(harness.session.capability, 'observed')).toBe(false);
    expect(harness.session.read()).toBeNull();
    expect(harness.session.readSnapshot().completedStages).toEqual([
      'admission',
      'request_contract',
    ]);

    release?.(successResponse({ rewrittenQuery: 'safe result' }, 8, 3));
    await pending;
    expect(
      recordPhase698ArchitectureRecoveryRewriteProviderObservation(harness.session.capability),
    ).toBe(true);
    const snapshotAfterFirst = harness.session.readSnapshot();
    expect(
      recordPhase698ArchitectureRecoveryRewriteProviderObservation(harness.session.capability),
    ).toBe(false);
    expect(harness.session.readSnapshot()).toEqual(snapshotAfterFirst);
  });

  test('rejects forged, reused, and out-of-order capabilities without a Provider call', () => {
    let providerCalls = 0;
    const forged = createPhase698ArchitectureRecoveryRewriteDiagnosticSession({
      version: 'phase-6.9.7-v7-wire-capability-v1',
    });
    expect(forged.read()).toMatchObject({
      stage: 'admission',
      reasonCode: 'capability_invalid',
      providerBoundary: 'not_dispatched',
    });

    const diagnostics = createPhase697V7WireDiagnostics({ appendStage: () => undefined });
    const first = createPhase698ArchitectureRecoveryRewriteDiagnosticSession(
      diagnostics.capability,
    );
    const reused = createPhase698ArchitectureRecoveryRewriteDiagnosticSession(
      diagnostics.capability,
    );
    expect(reused.read()).toMatchObject({
      stage: 'admission',
      reasonCode: 'capability_invalid',
    });

    expect(
      recordPhase698ArchitectureRecoveryRewriteAdmission(
        first.capability,
        'principal_binding_invalid',
      ),
    ).toBe(true);
    const firstTerminal = first.read();
    expect(recordPhase698ArchitectureRecoveryRewriteUsage(first.capability)).toBe(false);
    expect(first.read()).toEqual(firstTerminal);
    expect(diagnostics.readSnapshot().counters.providerDispatches).toBe(0);
    expect(providerCalls).toBe(0);

    const isolated = createHarness(async () => {
      providerCalls += 1;
      return successResponse({ rewrittenQuery: 'never reached' }, 1, 1);
    });
    expect(
      recordPhase698ArchitectureRecoveryRewriteTrace(isolated.session.capability, 'accepted'),
    ).toBe(false);
    expect(isolated.session.read()).toMatchObject({
      stage: 'admission',
      reasonCode: 'unknown',
      providerBoundary: 'not_dispatched',
    });
    expect(providerCalls).toBe(0);
  });

  test('maps hostile response access to bounded diagnostics without retaining raw data', async () => {
    let statusReads = 0;
    const target = successResponse({ rewrittenQuery: 'safe' }, 2, 1);
    const hostile = new Proxy(target, {
      get(inner, property) {
        if (property === 'status') {
          statusReads += 1;
          throw new Error('raw status ' + SENTINEL_KEY);
        }
        return Reflect.get(inner, property, inner);
      },
    });
    const harness = createHarness(async () => hostile);
    recordAdmissionAndRequest(harness.session);
    await settleAdapter(harness.adapter);
    expect(
      recordPhase698ArchitectureRecoveryRewriteProviderObservation(harness.session.capability),
    ).toBe(true);
    expect(statusReads).toBe(1);
    expect(harness.session.read()).toMatchObject({
      stage: 'provider_envelope',
      reasonCode: 'provider_envelope_invalid',
      providerBoundary: 'response_observed',
      rawDataRetained: false,
    });
    expect(JSON.stringify(harness.session.read())).not.toMatch(/raw status|synthetic-key/iu);
  });
});

function createHarness(delegate: typeof fetch) {
  const diagnostics = createPhase697V7WireDiagnostics({ appendStage: () => undefined });
  const session = createPhase698ArchitectureRecoveryRewriteDiagnosticSession(
    diagnostics.capability,
  );
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(CONFIG, diagnostics.capability, {
    fetch: delegate,
  });
  return { diagnostics, session, adapter };
}

function recordAdmissionAndRequest(session: Phase698ArchitectureRecoveryRewriteDiagnosticSession) {
  expect(recordPhase698ArchitectureRecoveryRewriteAdmission(session.capability, 'accepted')).toBe(
    true,
  );
  expect(
    recordPhase698ArchitectureRecoveryRewriteRequestContract(session.capability, 'accepted'),
  ).toBe(true);
}

async function recordToRuntimeResult(harness: ReturnType<typeof createHarness>) {
  recordAdmissionAndRequest(harness.session);
  await executeAdapter(harness.adapter);
  expect(
    recordPhase698ArchitectureRecoveryRewriteProviderObservation(harness.session.capability),
  ).toBe(true);
}

function recordToLocalAuthority(session: Phase698ArchitectureRecoveryRewriteDiagnosticSession) {
  expect(
    recordPhase698ArchitectureRecoveryRewriteRuntimeResult(session.capability, 'accepted'),
  ).toBe(true);
  expect(
    recordPhase698ArchitectureRecoveryRewriteCandidateProjection(session.capability, 'applied'),
  ).toBe(true);
}

function recordToTrace(session: Phase698ArchitectureRecoveryRewriteDiagnosticSession) {
  recordToLocalAuthority(session);
  expect(
    recordPhase698ArchitectureRecoveryRewriteLocalAuthority(session.capability, 'accepted'),
  ).toBe(true);
}

function recordToUsage(session: Phase698ArchitectureRecoveryRewriteDiagnosticSession) {
  recordToTrace(session);
  expect(recordPhase698ArchitectureRecoveryRewriteTrace(session.capability, 'accepted')).toBe(true);
  expect(recordPhase698ArchitectureRecoveryRewriteUsage(session.capability)).toBe(true);
}

function recordToCost(session: Phase698ArchitectureRecoveryRewriteDiagnosticSession) {
  recordToUsage(session);
}

function recordToCallResult(session: Phase698ArchitectureRecoveryRewriteDiagnosticSession) {
  recordToCost(session);
  expect(recordPhase698ArchitectureRecoveryRewriteCost(session.capability, 'accepted')).toBe(true);
}

function executeAdapter(adapter: FirstPartyDeepSeekV4ProDirectAdapter) {
  return adapter.executor({
    schema: RETRIEVER_QUERY_REWRITE_MODEL_SCHEMA,
    systemPrompt: 'Return one strict rewrite object.',
    userPrompt: SENTINEL_PROMPT,
    maxOutputTokens: 64,
    signal: new AbortController().signal,
  });
}

async function settleAdapter(adapter: FirstPartyDeepSeekV4ProDirectAdapter) {
  try {
    await executeAdapter(adapter);
  } catch {
    // The bounded wire snapshot, not the raw thrown value, is the diagnostic authority.
  }
}

function successResponse(object: unknown, inputTokens: number, outputTokens: number) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(object) } }],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        completion_tokens_details: { reasoning_tokens: 0 },
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

async function waitForStage(diagnostics: Phase697V7WireDiagnostics, stage: Phase697V7WireStage) {
  for (let iteration = 0; iteration < 100; iteration += 1) {
    if (diagnostics.readSnapshot().stages.includes(stage)) return;
    await Promise.resolve();
  }
  throw new Error(`stage not reached: ${stage}`);
}
