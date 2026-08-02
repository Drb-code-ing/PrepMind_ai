import { describe, expect, test } from 'bun:test';

import { PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_PROFILE } from '../src/phase-6-9-7-architecture-recovery-r2-canary-contract.ts';
import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_SYNTHETIC_SCENARIOS,
  runPhase697ArchitectureRecoveryR2Canary,
  type Phase697ArchitectureRecoveryR2CanaryRunInput,
  type Phase697ArchitectureRecoveryR2SyntheticScenario,
} from '../src/phase-6-9-7-architecture-recovery-r2-canary-runner.ts';

const RAW_CANARY = 'r2-raw-provider-value-must-not-leak';
const FORBIDDEN =
  /r2-synthetic-key|api\.deepseek\.com|authorization|systemPrompt|userPrompt|raw-provider|synthetic-raw/u;

describe('Phase 6.9.7 Architecture Recovery R2 canary runner', () => {
  test('uses a closed fact-free scenario and returns a frozen bounded report', async () => {
    expect(Object.isFrozen(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_SYNTHETIC_SCENARIOS)).toBe(true);
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_PROFILE).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      nonThinking: true,
      jsonObject: true,
      stream: false,
      tools: false,
      retry: false,
      maxOutputTokens: 16,
      systemPrompt: 'Return exactly one JSON object with ok=true. Use no tools or external facts.',
      userPrompt: 'Run the fact-free provider health canary.',
    });

    const report = await runScenario('complete');
    expect(report).toMatchObject({
      authority: 'synthetic_test',
      outcome: 'complete',
      responseObserved: true,
      providerFailureCategory: null,
      transportSubtype: null,
      usage: { inputTokens: 32, outputTokens: 4 },
      wire: {
        state: 'succeeded',
        lastCompletedStage: 'usage_validated',
        counters: {
          executorInvocations: 1,
          providerDispatches: 1,
          providerResponses: 1,
          verifiedUsages: 1,
        },
      },
      budget: { scope: 'per_invocation', reservedCalls: 1, withinBudget: true },
    });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.wire)).toBe(true);
    expect(Object.isFrozen(report.budget)).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(FORBIDDEN);
  });

  test('classifies every fixed transport subtype without retry or raw error retention', async () => {
    const cases: ReadonlyArray<readonly [Phase697ArchitectureRecoveryR2SyntheticScenario, string]> =
      [
        ['transport_aborted', 'aborted'],
        ['transport_timeout', 'timeout'],
        ['transport_dns', 'dns'],
        ['transport_tls', 'tls'],
        ['transport_proxy', 'proxy'],
        ['transport_refused', 'connection_refused'],
        ['transport_reset', 'connection_reset'],
        ['transport_unreachable', 'network_unreachable'],
        ['transport_unknown', 'unknown'],
      ];

    for (const [scenario, subtype] of cases) {
      const report = await runScenario(scenario);
      expect(report.outcome, scenario).toBe('transport_failed');
      expect(report.responseObserved, scenario).toBe(false);
      expect(report.providerFailureCategory, scenario).toBe('transport');
      expect(report.transportSubtype, scenario).toBe(subtype);
      expect(report.wire.counters, scenario).toEqual({
        executorInvocations: 1,
        providerDispatches: 1,
        providerResponses: 0,
        verifiedUsages: 0,
      });
      expect(JSON.stringify(report), scenario).not.toMatch(FORBIDDEN);
    }
  });

  test('distinguishes HTTP response, response/schema/usage, and budget failures', async () => {
    const cases = [
      {
        scenario: 'http_auth',
        outcome: 'response_observed',
        category: 'http_auth',
        stage: null,
        responseObserved: true,
      },
      {
        scenario: 'http_rate_limit',
        outcome: 'response_observed',
        category: 'http_rate_limit',
        stage: null,
        responseObserved: true,
      },
      {
        scenario: 'http_client',
        outcome: 'response_observed',
        category: 'http_client',
        stage: null,
        responseObserved: true,
      },
      {
        scenario: 'http_server',
        outcome: 'response_observed',
        category: 'http_server',
        stage: null,
        responseObserved: true,
      },
      {
        scenario: 'response_invalid',
        outcome: 'response_invalid',
        category: 'invalid_response',
        stage: null,
        responseObserved: false,
      },
      {
        scenario: 'json_invalid',
        outcome: 'response_observed',
        category: 'structured_output',
        stage: 'provider_json_parse',
        responseObserved: true,
      },
      {
        scenario: 'schema_invalid',
        outcome: 'response_observed',
        category: 'structured_output',
        stage: 'provider_type_validation',
        responseObserved: true,
      },
      {
        scenario: 'usage_invalid',
        outcome: 'response_observed',
        category: 'unknown',
        stage: null,
        responseObserved: true,
      },
      {
        scenario: 'budget_exceeded',
        outcome: 'budget_exceeded',
        category: null,
        stage: null,
        responseObserved: true,
      },
    ] as const;

    for (const item of cases) {
      const report = await runScenario(item.scenario);
      expect(report.outcome, item.scenario).toBe(item.outcome);
      expect(report.providerFailureCategory, item.scenario).toBe(item.category);
      expect(report.structuredOutputStage, item.scenario).toBe(item.stage);
      expect(report.responseObserved, item.scenario).toBe(item.responseObserved);
      expect(report.transportSubtype, item.scenario).toBeNull();
      expect(JSON.stringify(report), item.scenario).not.toMatch(FORBIDDEN);
    }
  });

  test('keeps pre-abort, in-flight abort, timeout, and late abort terminals consistent', async () => {
    const preAborted = new AbortController();
    preAborted.abort();
    const preReport = await runScenario('complete', { signal: preAborted.signal });
    expect(preReport).toMatchObject({
      outcome: 'aborted',
      responseObserved: false,
      wire: { state: 'not_started', counters: { providerDispatches: 0 } },
      budget: { reservedCalls: 0 },
    });

    const external = new AbortController();
    setTimeout(() => external.abort(), 0);
    const inFlightReport = await runScenario('runner_timeout', { signal: external.signal });
    expect(inFlightReport.outcome).toBe('aborted');
    expect(inFlightReport.wire.state).toBe('failed');
    expect(inFlightReport.wire.failureCategory).toBe('post_dispatch_abort');

    const timeoutReport = await runScenario('runner_timeout', { timeoutMs: 5 });
    expect(timeoutReport.outcome).toBe('timeout');
    expect(timeoutReport.wire.state).toBe('failed');
    expect(timeoutReport.wire.failureCategory).toBe('runtime_timeout');
    expect(timeoutReport.wire.counters.providerDispatches).toBe(1);

    const late = new AbortController();
    const completeReport = await runScenario('complete', { signal: late.signal });
    late.abort();
    expect(completeReport.outcome).toBe('complete');
    expect(completeReport.wire.state).toBe('succeeded');
  });

  test('has no fetch or transport injection surface and contains hostile input', async () => {
    const controller = new AbortController();
    const attemptedNetworkInjection = await runPhase697ArchitectureRecoveryR2Canary({
      mode: 'synthetic',
      scenario: 'complete',
      timeoutMs: 1_000,
      signal: controller.signal,
      fetch: globalThis.fetch,
    } as Phase697ArchitectureRecoveryR2CanaryRunInput);
    expect(attemptedNetworkInjection).toMatchObject({
      outcome: 'config_invalid',
      authority: 'synthetic_test',
      wire: { state: 'not_started', counters: { executorInvocations: 0 } },
    });

    const attemptedTransportInjection = await runPhase697ArchitectureRecoveryR2Canary({
      mode: 'synthetic',
      scenario: 'complete',
      timeoutMs: 1_000,
      signal: controller.signal,
      createTransport: () => {
        throw new Error(RAW_CANARY);
      },
    } as Phase697ArchitectureRecoveryR2CanaryRunInput);
    expect(attemptedTransportInjection.outcome).toBe('config_invalid');
    expect(JSON.stringify(attemptedTransportInjection)).not.toContain(RAW_CANARY);

    let getterReads = 0;
    const invalid = {} as Record<string, unknown>;
    for (const key of ['mode', 'scenario', 'timeoutMs', 'signal']) {
      Object.defineProperty(invalid, key, {
        enumerable: true,
        get() {
          getterReads += 1;
          throw new Error(RAW_CANARY);
        },
      });
    }
    const invalidReport = await runPhase697ArchitectureRecoveryR2Canary(
      invalid as Phase697ArchitectureRecoveryR2CanaryRunInput,
    );
    expect(getterReads).toBe(0);
    expect(invalidReport.outcome).toBe('config_invalid');

    const proxyReport = await runPhase697ArchitectureRecoveryR2Canary(
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error(RAW_CANARY);
          },
        },
      ) as Phase697ArchitectureRecoveryR2CanaryRunInput,
    );
    expect(proxyReport.outcome).toBe('config_invalid');
    expect(JSON.stringify(proxyReport)).not.toContain(RAW_CANARY);
  });

  test('defines the one-call budget per invocation without creating Live authority', async () => {
    const reports = await Promise.all([runScenario('complete'), runScenario('complete')]);
    for (const report of reports) {
      expect(report.authority).toBe('synthetic_test');
      expect(report.budget.scope).toBe('per_invocation');
      expect(report.budget.reservedCalls).toBe(1);
      expect(report.wire.counters.executorInvocations).toBe(1);
      expect(report.wire.counters.providerDispatches).toBe(1);
    }
  });
});

function runScenario(
  scenario: Phase697ArchitectureRecoveryR2SyntheticScenario,
  options: Readonly<{ timeoutMs?: number; signal?: AbortSignal }> = {},
) {
  return runPhase697ArchitectureRecoveryR2Canary({
    mode: 'synthetic',
    scenario,
    timeoutMs: options.timeoutMs ?? 1_000,
    signal: options.signal ?? new AbortController().signal,
  });
}
