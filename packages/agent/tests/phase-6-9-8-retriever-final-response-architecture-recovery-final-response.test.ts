import { describe, expect, test } from 'bun:test';

import {
  FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL,
  FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS,
  FINAL_RESPONSE_STREAM_PROVIDER_MODEL,
  createFinalResponseStreamDiagnosticProvider,
  createPhase698ProviderWireDiagnostics,
  type FinalResponseStreamExecutor,
} from '@repo/ai';

import {
  completePhase698ArchitectureRecoveryFinalResponseDiagnostic,
  createPhase698ArchitectureRecoveryFinalResponseDiagnosticSession,
  recordPhase698ArchitectureRecoveryFinalResponseAdmission,
  recordPhase698ArchitectureRecoveryFinalResponseCallResult,
  recordPhase698ArchitectureRecoveryFinalResponseCitationLedger,
  recordPhase698ArchitectureRecoveryFinalResponseCost,
  recordPhase698ArchitectureRecoveryFinalResponseDelivery,
  recordPhase698ArchitectureRecoveryFinalResponseProviderObservation,
  recordPhase698ArchitectureRecoveryFinalResponseRequestContract,
  recordPhase698ArchitectureRecoveryFinalResponseStreamContract,
  recordPhase698ArchitectureRecoveryFinalResponseTerminalLedger,
  recordPhase698ArchitectureRecoveryFinalResponseTrace,
  recordPhase698ArchitectureRecoveryFinalResponseUsage,
  type Phase698ArchitectureRecoveryFinalResponseDiagnosticSession,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-final-response.ts';

const SENTINEL = 'r2-final-prompt-raw-error-credential-must-not-leak';
const CONFIG = Object.freeze({
  apiKey: 'r2-final-synthetic-key',
  baseURL: FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL,
  model: FINAL_RESPONSE_STREAM_PROVIDER_MODEL,
});
const SUCCESS_PARTS = Object.freeze([
  { type: 'step-start', warnings: [] },
  { type: 'text-delta', textDelta: '结论来自本地证据。' },
  {
    type: 'step-finish',
    warnings: [],
    finishReason: 'stop',
    usage: { promptTokens: 160, completionTokens: 20 },
  },
  {
    type: 'finish',
    finishReason: 'stop',
    usage: { promptTokens: 160, completionTokens: 20 },
  },
]);

describe('Phase 6.9.8 Architecture Recovery FinalResponse diagnostic integration', () => {
  test('keeps FinalResponse transition authority off the public Agent barrel', async () => {
    const publicModule = await import('@repo/agent');
    for (const name of [
      'createPhase698ArchitectureRecoveryFinalResponseDiagnosticSession',
      'recordPhase698ArchitectureRecoveryFinalResponseProviderObservation',
      'recordPhase698ArchitectureRecoveryFinalResponseStreamContract',
      'recordPhase698ArchitectureRecoveryFinalResponseTerminalLedger',
      'completePhase698ArchitectureRecoveryFinalResponseDiagnostic',
    ]) {
      expect(name in publicModule).toBe(false);
    }
  });

  test('reaches applied only after stream, terminal, citation, Trace, usage, cost, and delivery pass', async () => {
    const harness = createHarness(SUCCESS_PARTS);
    recordAdmissionAndRequest(harness.session);
    await collect(harness.executor);
    expect(
      recordPhase698ArchitectureRecoveryFinalResponseProviderObservation(
        harness.session.capability,
      ),
    ).toBe(true);
    expect(
      recordPhase698ArchitectureRecoveryFinalResponseStreamContract(harness.session.capability),
    ).toBe(true);
    expect(
      recordPhase698ArchitectureRecoveryFinalResponseTerminalLedger(harness.session.capability),
    ).toBe(true);
    expect(
      recordPhase698ArchitectureRecoveryFinalResponseCitationLedger(
        harness.session.capability,
        'accepted',
      ),
    ).toBe(true);
    expect(
      recordPhase698ArchitectureRecoveryFinalResponseTrace(harness.session.capability, 'accepted'),
    ).toBe(true);
    expect(recordPhase698ArchitectureRecoveryFinalResponseUsage(harness.session.capability)).toBe(
      true,
    );
    expect(
      recordPhase698ArchitectureRecoveryFinalResponseCost(harness.session.capability, 'accepted'),
    ).toBe(true);
    expect(
      recordPhase698ArchitectureRecoveryFinalResponseDelivery(
        harness.session.capability,
        'accepted',
      ),
    ).toBe(true);
    expect(
      recordPhase698ArchitectureRecoveryFinalResponseCallResult(
        harness.session.capability,
        'accepted',
      ),
    ).toBe(true);
    expect(
      completePhase698ArchitectureRecoveryFinalResponseDiagnostic(harness.session.capability),
    ).toBe(true);
    expect(harness.session.read()).toEqual({
      diagnosticVersion: 'phase-6.9.8-retriever-final-response-bounded-diagnostic-v1',
      callPhase: 'final_response_model',
      stage: 'applied',
      reasonCode: 'applied',
      providerBoundary: 'response_and_usage_observed',
      topLevelTypeBucket: 'object',
      fieldCountBucket: '2_4',
      terminalCountBucket: '1',
      rawDataRetained: false,
    });
    expect(harness.session.readSnapshot().completedStages).toEqual([
      'admission',
      'request_contract',
      'provider_dispatch',
      'provider_response',
      'stream_event_contract',
      'terminal_ledger',
      'citation_ledger',
      'trace_contract',
      'usage_contract',
      'cost_contract',
      'delivery_contract',
      'call_result_contract',
      'applied',
    ]);
    expect(JSON.stringify(harness.session.read())).not.toMatch(
      /prompt-raw|synthetic-key|deepseek\.com|credential/iu,
    );
  });

  test('maps stream, terminal, false-tool, usage, and transport failures to distinct stages', async () => {
    const cases = [
      {
        options: { throwBeforeStream: true as const },
        expected: ['provider_response', 'transport_failure', 'unknown'],
      },
      {
        options: { parts: [SUCCESS_PARTS[0], { type: 'unknown' }] },
        expected: ['stream_event_contract', 'stream_event_invalid', 'unknown'],
      },
      {
        options: { parts: [SUCCESS_PARTS[0]] },
        expected: ['terminal_ledger', 'terminal_missing', '0'],
      },
      {
        options: { parts: [SUCCESS_PARTS[0], SUCCESS_PARTS[2], SUCCESS_PARTS[2]] },
        expected: ['terminal_ledger', 'terminal_duplicate', '2_plus'],
      },
      {
        options: { parts: [...SUCCESS_PARTS, { type: 'text-delta', textDelta: 'late' }] },
        expected: ['terminal_ledger', 'terminal_not_last', '1'],
      },
      {
        options: {
          extras: { toolCalls: Promise.resolve([{ toolName: 'write', args: SENTINEL }]) },
        },
        expected: ['citation_ledger', 'false_tool_success', '1'],
      },
      {
        options: {
          parts: SUCCESS_PARTS.map((part) =>
            part.type === 'step-finish' || part.type === 'finish'
              ? { ...part, usage: { promptTokens: 0, completionTokens: 20 } }
              : part,
          ),
        },
        expected: ['usage_contract', 'usage_invalid', '1'],
      },
    ] as const;

    for (const current of cases) {
      const harness = createHarness(current.options.parts ?? SUCCESS_PARTS, current.options);
      recordAdmissionAndRequest(harness.session);
      await settle(harness.executor);
      recordUntilTerminal(harness.session);
      const diagnostic = harness.session.read();
      expect(
        [diagnostic?.stage, diagnostic?.reasonCode, diagnostic?.terminalCountBucket],
        current.expected.join('/'),
      ).toEqual(current.expected);
      expect(JSON.stringify(diagnostic)).not.toMatch(/prompt-raw|synthetic-key|credential/iu);
    }
  });

  test('keeps diagnostic authority invariant to equivalent text-delta chunking', async () => {
    const variants = [
      [
        SUCCESS_PARTS[0],
        { type: 'text-delta', textDelta: '结论来自本地证据。' },
        SUCCESS_PARTS[2],
        SUCCESS_PARTS[3],
      ],
      [
        SUCCESS_PARTS[0],
        { type: 'text-delta', textDelta: '结论来自' },
        { type: 'text-delta', textDelta: '本地证据。' },
        SUCCESS_PARTS[2],
        SUCCESS_PARTS[3],
      ],
    ] as const;
    const observed = [];
    for (const parts of variants) {
      const harness = createHarness(parts);
      recordAdmissionAndRequest(harness.session);
      const events = await collect(harness.executor);
      recordFullSuccess(harness.session);
      observed.push({
        text: events
          .filter((event) => event.type === 'text_delta')
          .map((event) => (event.type === 'text_delta' ? event.text : ''))
          .join(''),
        diagnostic: harness.session.read(),
      });
    }
    expect(observed[0]).toEqual(observed[1]);
    expect(observed[0]?.diagnostic).toMatchObject({ stage: 'applied', reasonCode: 'applied' });
  });

  test('keeps citation, Trace, cost, delivery, and result failures separate', async () => {
    const cases = [
      { stage: 'citation_ledger', status: 'grounding_invalid' },
      { stage: 'citation_ledger', status: 'critical_notice_missing' },
      { stage: 'trace_contract', status: 'trace_identity_invalid' },
      { stage: 'cost_contract', status: 'cost_mismatch' },
      { stage: 'delivery_contract', status: 'delivery_invalid' },
      { stage: 'call_result_contract', status: 'result_shape_invalid' },
    ] as const;
    for (const current of cases) {
      const harness = createHarness(SUCCESS_PARTS);
      await recordThroughTerminal(harness);
      if (current.stage === 'citation_ledger') {
        recordPhase698ArchitectureRecoveryFinalResponseCitationLedger(
          harness.session.capability,
          current.status,
        );
      } else {
        recordPhase698ArchitectureRecoveryFinalResponseCitationLedger(
          harness.session.capability,
          'accepted',
        );
        if (current.stage === 'trace_contract') {
          recordPhase698ArchitectureRecoveryFinalResponseTrace(
            harness.session.capability,
            current.status,
          );
        } else {
          recordPhase698ArchitectureRecoveryFinalResponseTrace(
            harness.session.capability,
            'accepted',
          );
          recordPhase698ArchitectureRecoveryFinalResponseUsage(harness.session.capability);
          if (current.stage === 'cost_contract') {
            recordPhase698ArchitectureRecoveryFinalResponseCost(
              harness.session.capability,
              current.status,
            );
          } else {
            recordPhase698ArchitectureRecoveryFinalResponseCost(
              harness.session.capability,
              'accepted',
            );
            if (current.stage === 'delivery_contract') {
              recordPhase698ArchitectureRecoveryFinalResponseDelivery(
                harness.session.capability,
                current.status,
              );
            } else {
              recordPhase698ArchitectureRecoveryFinalResponseDelivery(
                harness.session.capability,
                'accepted',
              );
              recordPhase698ArchitectureRecoveryFinalResponseCallResult(
                harness.session.capability,
                current.status,
              );
            }
          }
        }
      }
      expect(harness.session.read()).toMatchObject({
        stage: current.stage,
        reasonCode: current.status,
      });
    }
  });

  test('rejects forged, reused, cross-family, active, and out-of-order capabilities', async () => {
    const forged = createPhase698ArchitectureRecoveryFinalResponseDiagnosticSession({
      version: 'phase-6.9.8-provider-wire-capability-v1',
    });
    expect(forged.read()).toMatchObject({ stage: 'admission', reasonCode: 'capability_invalid' });

    const finalWire = createPhase698ProviderWireDiagnostics('final_response_stream');
    const first = createPhase698ArchitectureRecoveryFinalResponseDiagnosticSession(
      finalWire.capability,
    );
    const reused = createPhase698ArchitectureRecoveryFinalResponseDiagnosticSession(
      finalWire.capability,
    );
    expect(reused.read()).toMatchObject({ stage: 'admission', reasonCode: 'capability_invalid' });
    expect(recordPhase698ArchitectureRecoveryFinalResponseTrace(first.capability, 'accepted')).toBe(
      false,
    );
    expect(first.read()).toMatchObject({ stage: 'admission', reasonCode: 'unknown' });

    const qwenWire = createPhase698ProviderWireDiagnostics('qwen_retrieval');
    expect(
      createPhase698ArchitectureRecoveryFinalResponseDiagnosticSession(qwenWire.capability).read(),
    ).toMatchObject({ stage: 'admission', reasonCode: 'capability_invalid' });

    let release: (() => void) | undefined;
    const pendingGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const active = createHarness([], {
      fullStream: (async function* () {
        await pendingGate;
        for (const part of SUCCESS_PARTS) yield part;
      })(),
    });
    recordAdmissionAndRequest(active.session);
    const pending = collect(active.executor);
    await waitForDispatch(active.wire);
    expect(
      recordPhase698ArchitectureRecoveryFinalResponseProviderObservation(active.session.capability),
    ).toBe(false);
    expect(active.session.read()).toBeNull();
    release?.();
    await pending;
  });
});

type HarnessOptions = Readonly<{
  parts?: readonly unknown[];
  extras?: Partial<ReturnType<typeof streamResult>>;
  throwBeforeStream?: true;
  fullStream?: AsyncIterable<unknown>;
}>;

function createHarness(parts: readonly unknown[], options: HarnessOptions = {}) {
  const wire = createPhase698ProviderWireDiagnostics('final_response_stream');
  const session = createPhase698ArchitectureRecoveryFinalResponseDiagnosticSession(wire.capability);
  const provider = createFinalResponseStreamDiagnosticProvider(CONFIG, wire.capability, {
    createProvider: () => () => ({}),
    streamText: () => {
      if (options.throwBeforeStream) throw new Error(`${SENTINEL}: transport`);
      return {
        ...streamResult(options.parts ?? parts),
        ...options.extras,
        ...(options.fullStream ? { fullStream: options.fullStream } : {}),
      };
    },
  });
  return { wire, session, executor: provider.executor };
}

function recordAdmissionAndRequest(
  session: Phase698ArchitectureRecoveryFinalResponseDiagnosticSession,
) {
  expect(
    recordPhase698ArchitectureRecoveryFinalResponseAdmission(session.capability, 'accepted'),
  ).toBe(true);
  expect(
    recordPhase698ArchitectureRecoveryFinalResponseRequestContract(session.capability, 'accepted'),
  ).toBe(true);
}

async function recordThroughTerminal(harness: ReturnType<typeof createHarness>) {
  recordAdmissionAndRequest(harness.session);
  await collect(harness.executor);
  expect(
    recordPhase698ArchitectureRecoveryFinalResponseProviderObservation(harness.session.capability),
  ).toBe(true);
  expect(
    recordPhase698ArchitectureRecoveryFinalResponseStreamContract(harness.session.capability),
  ).toBe(true);
  expect(
    recordPhase698ArchitectureRecoveryFinalResponseTerminalLedger(harness.session.capability),
  ).toBe(true);
}

function recordUntilTerminal(session: Phase698ArchitectureRecoveryFinalResponseDiagnosticSession) {
  const steps = [
    () => recordPhase698ArchitectureRecoveryFinalResponseProviderObservation(session.capability),
    () => recordPhase698ArchitectureRecoveryFinalResponseStreamContract(session.capability),
    () => recordPhase698ArchitectureRecoveryFinalResponseTerminalLedger(session.capability),
    () =>
      recordPhase698ArchitectureRecoveryFinalResponseCitationLedger(session.capability, 'accepted'),
    () => recordPhase698ArchitectureRecoveryFinalResponseTrace(session.capability, 'accepted'),
    () => recordPhase698ArchitectureRecoveryFinalResponseUsage(session.capability),
  ];
  for (const step of steps) {
    if (session.read() !== null) return;
    step();
  }
}

function recordFullSuccess(session: Phase698ArchitectureRecoveryFinalResponseDiagnosticSession) {
  recordPhase698ArchitectureRecoveryFinalResponseProviderObservation(session.capability);
  recordPhase698ArchitectureRecoveryFinalResponseStreamContract(session.capability);
  recordPhase698ArchitectureRecoveryFinalResponseTerminalLedger(session.capability);
  recordPhase698ArchitectureRecoveryFinalResponseCitationLedger(session.capability, 'accepted');
  recordPhase698ArchitectureRecoveryFinalResponseTrace(session.capability, 'accepted');
  recordPhase698ArchitectureRecoveryFinalResponseUsage(session.capability);
  recordPhase698ArchitectureRecoveryFinalResponseCost(session.capability, 'accepted');
  recordPhase698ArchitectureRecoveryFinalResponseDelivery(session.capability, 'accepted');
  recordPhase698ArchitectureRecoveryFinalResponseCallResult(session.capability, 'accepted');
  completePhase698ArchitectureRecoveryFinalResponseDiagnostic(session.capability);
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

async function collect(executor: FinalResponseStreamExecutor) {
  const events = [];
  for await (const event of executor({
    systemPrompt: 'Safe final response system prompt.',
    userPrompt: SENTINEL,
    maxOutputTokens: FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS,
    signal: new AbortController().signal,
  })) {
    events.push(event);
  }
  return events;
}

async function settle(executor: FinalResponseStreamExecutor) {
  try {
    await collect(executor);
  } catch {
    // Diagnostic state is the authority; thrown provider values are intentionally ignored.
  }
}

async function waitForDispatch(wire: ReturnType<typeof createPhase698ProviderWireDiagnostics>) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (wire.readSnapshot().counters.providerDispatches === 1) return;
    await Promise.resolve();
  }
  throw new Error('FINAL_RESPONSE_DISPATCH_NOT_REACHED');
}
