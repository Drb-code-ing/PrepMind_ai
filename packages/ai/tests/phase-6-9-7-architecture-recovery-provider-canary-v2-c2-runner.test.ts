import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SYNTHETIC_SCENARIOS,
  createPhase697ArchitectureRecoveryProviderCanaryV2C2ControlledLiveTransport,
  createPhase697ArchitectureRecoveryProviderCanaryV2C2SyntheticTransportForTesting,
  runPhase697ArchitectureRecoveryProviderCanaryV2C2Canary,
} from '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-runner.ts';

describe('Phase 6.9.7 Provider Canary V2 C2 runner', () => {
  test('uses a closed synthetic transport to prove the exact strict request locally', async () => {
    const stages: string[] = [];
    const transport =
      createPhase697ArchitectureRecoveryProviderCanaryV2C2SyntheticTransportForTesting({
        scenario: 'complete',
        appendStage: (stage) => stages.push(stage),
      });
    const report = await runPhase697ArchitectureRecoveryProviderCanaryV2C2Canary({
      transport,
      timeoutMs: 5_000,
      signal: new AbortController().signal,
    });
    expect(report).toMatchObject({
      authority: 'synthetic_test',
      executorProvenance: 'synthetic_test',
      providerHealth: 'unknown',
      outcome: 'complete',
      responseObserved: true,
      strictResponseObserved: true,
      wire: {
        state: 'succeeded',
        counters: {
          executorInvocations: 1,
          providerDispatches: 1,
          providerResponses: 1,
          verifiedUsages: 1,
        },
      },
      usage: { inputTokens: 32, outputTokens: 4 },
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
  });

  test('classifies all closed failure scenarios without retry or raw retention', async () => {
    const expected = {
      transport_dns: 'transport_failed',
      http_auth: 'response_observed',
      schema_invalid: 'response_observed',
      usage_invalid: 'response_observed',
      budget_exceeded: 'budget_exceeded',
      runner_timeout: 'timeout',
    } as const;
    for (const scenario of PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SYNTHETIC_SCENARIOS) {
      if (scenario === 'complete') continue;
      const stages: string[] = [];
      const transport =
        createPhase697ArchitectureRecoveryProviderCanaryV2C2SyntheticTransportForTesting({
          scenario,
          appendStage: (stage) => stages.push(stage),
        });
      const report = await runPhase697ArchitectureRecoveryProviderCanaryV2C2Canary({
        transport,
        timeoutMs: scenario === 'runner_timeout' ? 5 : 5_000,
        signal: new AbortController().signal,
      });
      expect(report.outcome).toBe(expected[scenario]);
      expect(report.authority).toBe('synthetic_test');
      expect(report.executorProvenance).toBe('synthetic_test');
      expect(report.providerHealth).toBe('unknown');
      expect(JSON.stringify(report)).not.toContain('c2-synthetic-raw-provider-value');
      expect(stages.filter((stage) => stage === 'provider_dispatch_started')).toHaveLength(1);
    }
  });

  test('keeps a pre-aborted run zero-dispatch and consumes no second attempt', async () => {
    const stages: string[] = [];
    const transport =
      createPhase697ArchitectureRecoveryProviderCanaryV2C2SyntheticTransportForTesting({
        scenario: 'complete',
        appendStage: (stage) => stages.push(stage),
      });
    const controller = new AbortController();
    controller.abort();
    const first = await runPhase697ArchitectureRecoveryProviderCanaryV2C2Canary({
      transport,
      timeoutMs: 5_000,
      signal: controller.signal,
    });
    const second = await runPhase697ArchitectureRecoveryProviderCanaryV2C2Canary({
      transport,
      timeoutMs: 5_000,
      signal: new AbortController().signal,
    });
    expect(first).toMatchObject({
      outcome: 'aborted',
      responseObserved: false,
      wire: { state: 'not_started' },
    });
    expect(second).toMatchObject({ outcome: 'config_invalid', wire: { state: 'not_started' } });
    expect(stages).toEqual([]);
  });

  test('contains in-flight abort and late completion behind the first terminal', async () => {
    const stages: string[] = [];
    let signalDispatch: (() => void) | undefined;
    const dispatched = new Promise<void>((resolve) => {
      signalDispatch = resolve;
    });
    const transport =
      createPhase697ArchitectureRecoveryProviderCanaryV2C2SyntheticTransportForTesting({
        scenario: 'runner_timeout',
        appendStage: (stage) => {
          stages.push(stage);
          if (stage === 'provider_dispatch_started') signalDispatch?.();
        },
      });
    const controller = new AbortController();
    const pending = runPhase697ArchitectureRecoveryProviderCanaryV2C2Canary({
      transport,
      timeoutMs: 5_000,
      signal: controller.signal,
    });
    await dispatched;
    controller.abort();
    const report = await pending;
    expect(report.outcome).toBe('aborted');
    expect(report.wire.failureCategory).toBe('post_dispatch_abort');
    expect(report.wire.counters).toEqual({
      executorInvocations: 1,
      providerDispatches: 1,
      providerResponses: 0,
      verifiedUsages: 0,
    });
    expect(stages).toEqual(['executor_entered', 'request_validated', 'provider_dispatch_started']);
  });

  test('mints the controlled transport without dispatch and rejects injection or bad credentials', () => {
    let stages = 0;
    const transport = createPhase697ArchitectureRecoveryProviderCanaryV2C2ControlledLiveTransport({
      apiKey: 'dedicated-v2-key',
      appendStage: () => {
        stages += 1;
      },
    });
    expect(transport).toEqual({
      version: 'phase-6.9.7-architecture-recovery-provider-canary-v2-transport-v1',
    });
    expect(stages).toBe(0);
    for (const input of [
      { apiKey: '', appendStage() {} },
      { apiKey: ' bad', appendStage() {} },
      { apiKey: 'ok', appendStage() {}, fetch: async () => new Response() },
      { apiKey: 'ok', appendStage() {}, retry: true },
    ]) {
      expect(() =>
        createPhase697ArchitectureRecoveryProviderCanaryV2C2ControlledLiveTransport(input as never),
      ).toThrow('INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_TRANSPORT');
    }
  });

  test('rejects forged transports and hostile run inputs as bounded config failures', async () => {
    for (const transport of [
      {},
      {
        version: 'phase-6.9.7-architecture-recovery-provider-canary-v2-transport-v1',
      },
      new Proxy(
        {},
        {
          get() {
            throw new Error('raw');
          },
        },
      ),
    ]) {
      const report = await runPhase697ArchitectureRecoveryProviderCanaryV2C2Canary({
        transport: transport as never,
        timeoutMs: 5_000,
        signal: new AbortController().signal,
      });
      expect(report).toMatchObject({
        authority: 'synthetic_test',
        outcome: 'config_invalid',
        wire: { state: 'not_started' },
      });
      expect(JSON.stringify(report)).not.toContain('raw');
    }
  });
});
