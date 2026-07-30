import { describe, expect, test } from 'bun:test';

import {
  createPhase697ArchitectureRecoveryR3ControlledLiveCanaryTransport,
  createPhase697ArchitectureRecoveryR3SyntheticCanaryTransportForTesting,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_SYNTHETIC_SCENARIOS,
  runPhase697ArchitectureRecoveryR3Canary,
  type Phase697ArchitectureRecoveryR3CanaryTransport,
  type Phase697ArchitectureRecoveryR3SyntheticScenario,
  type Phase697V7WireStage,
} from '../src/phase-6-9-7-architecture-recovery-r3-canary-runner.ts';

const FORBIDDEN =
  /r3-synthetic-key|api\.deepseek\.com|authorization|systemPrompt|userPrompt|raw-provider|synthetic-raw/u;

describe('Phase 6.9.7 Architecture Recovery R3 canary runner', () => {
  test('uses the R2 fact-free contract through an opaque synthetic transport', async () => {
    const stages: Phase697V7WireStage[] = [];
    const transport = syntheticTransport('complete', async (stage) => {
      stages.push(stage);
    });
    const report = await run(transport);

    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_SYNTHETIC_SCENARIOS).toEqual([
      'complete',
      'transport_dns',
      'http_auth',
      'schema_invalid',
      'usage_invalid',
      'budget_exceeded',
      'runner_timeout',
    ]);
    expect(report).toMatchObject({
      authority: 'synthetic_test',
      providerReport: {
        authority: 'synthetic_test',
        outcome: 'complete',
        responseObserved: true,
        usage: { inputTokens: 32, outputTokens: 4 },
        wire: {
          state: 'succeeded',
          counters: {
            executorInvocations: 1,
            providerDispatches: 1,
            providerResponses: 1,
            verifiedUsages: 1,
          },
        },
      },
      cost: { estimatedCostCny: '0.00012000', withinHardCap: true },
    });
    expect(stages).toEqual([
      'executor_entered',
      'request_validated',
      'provider_dispatch_started',
      'provider_response_received',
      'response_audit_passed',
      'content_parsed',
      'schema_validated',
      'usage_validated',
    ]);
    expect(JSON.stringify(report)).not.toMatch(FORBIDDEN);
  });

  test('keeps transport, HTTP, schema, usage, and budget outcomes bounded', async () => {
    const cases: ReadonlyArray<
      readonly [Phase697ArchitectureRecoveryR3SyntheticScenario, string, boolean, string | null]
    > = [
      ['transport_dns', 'transport_failed', false, 'dns'],
      ['http_auth', 'response_observed', true, null],
      ['schema_invalid', 'response_observed', true, null],
      ['usage_invalid', 'response_observed', true, null],
      ['budget_exceeded', 'budget_exceeded', true, null],
    ];

    for (const [scenario, outcome, responseObserved, subtype] of cases) {
      const report = await run(syntheticTransport(scenario));
      expect(report.authority, scenario).toBe('synthetic_test');
      expect(report.providerReport.outcome, scenario).toBe(outcome);
      expect(report.providerReport.responseObserved, scenario).toBe(responseObserved);
      expect(report.providerReport.transportSubtype, scenario).toBe(subtype);
      expect(report.providerReport.wire.counters.executorInvocations, scenario).toBe(1);
      expect(report.providerReport.wire.counters.providerDispatches, scenario).toBe(1);
      expect(JSON.stringify(report), scenario).not.toMatch(FORBIDDEN);
    }
  });

  test('contains pre-abort, in-flight abort, timeout, late abort, and transport reuse', async () => {
    const pre = new AbortController();
    pre.abort();
    const preReport = await run(syntheticTransport('complete'), { signal: pre.signal });
    expect(preReport.providerReport).toMatchObject({
      outcome: 'aborted',
      responseObserved: false,
      wire: { state: 'not_started', counters: { providerDispatches: 0 } },
      budget: { reservedCalls: 0 },
    });

    const external = new AbortController();
    setTimeout(() => external.abort(), 0);
    const aborted = await run(syntheticTransport('runner_timeout'), { signal: external.signal });
    expect(aborted.providerReport.outcome).toBe('aborted');
    expect(aborted.providerReport.wire.failureCategory).toBe('post_dispatch_abort');

    const timedOutTransport = syntheticTransport('runner_timeout');
    const timedOut = await run(timedOutTransport, { timeoutMs: 5 });
    expect(timedOut.providerReport.outcome).toBe('timeout');
    expect(timedOut.providerReport.wire.failureCategory).toBe('runtime_timeout');

    const reused = await run(timedOutTransport);
    expect(reused.providerReport.outcome).toBe('config_invalid');
    expect(reused.providerReport.wire.counters.providerDispatches).toBe(0);

    const late = new AbortController();
    const complete = await run(syntheticTransport('complete'), { signal: late.signal });
    late.abort();
    expect(complete.providerReport.outcome).toBe('complete');
    expect(complete.providerReport.wire.state).toBe('succeeded');
  });

  test('does not expose a controlled-Live fetch, URL, or credential injection surface', () => {
    let fetchCalls = 0;
    const attempted = () =>
      createPhase697ArchitectureRecoveryR3ControlledLiveCanaryTransport({
        apiKey: 'invalid key with spaces',
        appendStage() {},
        fetch() {
          fetchCalls += 1;
          throw new Error('raw-provider');
        },
      } as never);
    expect(attempted).toThrow('INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_TRANSPORT');
    expect(fetchCalls).toBe(0);

    expect(() =>
      createPhase697ArchitectureRecoveryR3SyntheticCanaryTransportForTesting({
        scenario: 'complete',
        appendStage() {},
        credential: 'never',
      } as never),
    ).toThrow('INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_TRANSPORT');

    const fake = Object.freeze({
      version: 'phase-6.9.7-architecture-recovery-r3-provider-canary-transport-v1',
    }) as Phase697ArchitectureRecoveryR3CanaryTransport;
    expect(run(fake)).resolves.toMatchObject({
      authority: 'synthetic_test',
      providerReport: { outcome: 'config_invalid' },
    });
  });
});

function syntheticTransport(
  scenario: Phase697ArchitectureRecoveryR3SyntheticScenario,
  appendStage: (stage: Phase697V7WireStage) => void | Promise<void> = () => undefined,
) {
  return createPhase697ArchitectureRecoveryR3SyntheticCanaryTransportForTesting({
    scenario,
    appendStage,
  });
}

function run(
  transport: Phase697ArchitectureRecoveryR3CanaryTransport,
  options: Readonly<{ timeoutMs?: number; signal?: AbortSignal }> = {},
) {
  return runPhase697ArchitectureRecoveryR3Canary({
    transport,
    timeoutMs: options.timeoutMs ?? 1_000,
    signal: options.signal ?? new AbortController().signal,
  });
}
