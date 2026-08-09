import { describe, expect, test } from 'bun:test';

import { runRetrieverQueryRewriteModelCandidateV1 } from '../src/model-candidates/retriever-query-rewrite-model-candidate.ts';
import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FAULT_CASES } from './fixtures/phase-6-9-8-retriever-schema-recovery-sr2-robustness-v1.ts';
import {
  createRetrieverSr2AuthenticatedContext,
  createRetrieverSr2Request,
  createRetrieverSr2TrackedRuntime,
  RETRIEVER_SCHEMA_RECOVERY_SR2_MOCK_CONFIG,
} from './retriever-schema-recovery-sr2-helpers.ts';

const ORIGINAL_QUERY = 'Why does that follow?';
const RECENT_TURNS = [
  { role: 'assistant' as const, content: 'The sequence is monotone and bounded.' },
];
const VALID_CONTENT =
  '{"rewrittenQuery":"Why does convergence follow from the sequence being monotone and bounded?"}';

describe('Phase 6.9.8 Retriever Schema Recovery SR2 faults and dispatch boundary', () => {
  test('maps transport, HTTP, and invalid-response faults to fixed trace categories with one dispatch', async () => {
    for (const fault of PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FAULT_CASES.filter(
      (entry) => entry.kind === 'provider_failure',
    )) {
      const context = createRetrieverSr2AuthenticatedContext(`fault_${fault.id}`);
      const tracked = createRetrieverSr2TrackedRuntime({
        fault: 'provider_failure',
        providerFailureCategory: fault.category,
      });
      const result = await runRetrieverQueryRewriteModelCandidateV1({
        request: createRetrieverSr2Request(context, {
          originalQuery: ORIGINAL_QUERY,
          recentTurns: RECENT_TURNS,
        }),
        context,
        config: RETRIEVER_SCHEMA_RECOVERY_SR2_MOCK_CONFIG,
        now: () => Date.parse('2026-08-09T12:00:00.000Z'),
        createRuntime: () => tracked.runtime,
      });

      expect(tracked.invokes(), fault.id).toBe(1);
      expect(tracked.requests, fault.id).toHaveLength(1);
      expect(result.rewrite.disposition, fault.id).toBe('failed_fallback_original');
      expect(result.observation.trace?.providerFailureCategory, fault.id).toBe(fault.category);
      expect(result.schemaRecoveryDiagnostic?.reasonCode, fault.id).toBe('unknown');
      expect(result.schemaRecoveryDiagnostic?.rawDataRetained, fault.id).toBe(false);
      expect(JSON.stringify(result), fault.id).not.toContain('MODEL_AGENT_PROVIDER_REQUEST_FAILED');
    }
  });

  test('closes usage and trace accounting mismatches without preserving a prior parser diagnostic', async () => {
    for (const fault of ['usage_mismatch', 'trace_mismatch'] as const) {
      const context = createRetrieverSr2AuthenticatedContext(`untrusted_${fault}`);
      const tracked = createRetrieverSr2TrackedRuntime({
        content: `${VALID_CONTENT.slice(0, -1)},"private":"SR2_PRIVATE_USAGE"}`,
        fault,
      });
      const result = await runRetrieverQueryRewriteModelCandidateV1({
        request: createRetrieverSr2Request(context, {
          originalQuery: ORIGINAL_QUERY,
          recentTurns: RECENT_TURNS,
        }),
        context,
        config: RETRIEVER_SCHEMA_RECOVERY_SR2_MOCK_CONFIG,
        now: () => Date.parse('2026-08-09T12:00:00.000Z'),
        createRuntime: () => tracked.runtime,
      });

      expect(tracked.invokes(), fault).toBe(1);
      expect(result.rewrite.disposition, fault).toBe('failed_fallback_original');
      expect(result.observation.provenance, fault).toBe('runtime_untrusted');
      expect(result.observation.traceUnavailable, fault).toBe(true);
      expect(result.schemaRecoveryDiagnostic, fault).toMatchObject({
        stage: 'projected_schema',
        reasonCode: 'unknown',
        rawDataRetained: false,
      });
      expect(JSON.stringify(result), fault).not.toContain('SR2_PRIVATE_USAGE');
    }
  });

  test('handles timeout and in-flight parent abort with exactly one dispatch and no retry', async () => {
    const timeoutContext = createRetrieverSr2AuthenticatedContext('timeout_case');
    const timeoutRuntime = createRetrieverSr2TrackedRuntime({ fault: 'timeout', timeoutMs: 50 });
    const timedOut = await runRetrieverQueryRewriteModelCandidateV1({
      request: createRetrieverSr2Request(timeoutContext, {
        originalQuery: ORIGINAL_QUERY,
        recentTurns: RECENT_TURNS,
      }),
      context: timeoutContext,
      config: RETRIEVER_SCHEMA_RECOVERY_SR2_MOCK_CONFIG,
      now: () => Date.parse('2026-08-09T12:00:00.000Z'),
      createRuntime: () => timeoutRuntime.runtime,
    });
    expect(timeoutRuntime.invokes()).toBe(1);
    expect(timedOut.observation.trace?.errorCode).toBe('TIMEOUT');
    expect(timedOut.observation).not.toHaveProperty('traceUnavailable');
    expect(timedOut.schemaRecoveryDiagnostic?.reasonCode).toBe('unknown');

    const controller = new AbortController();
    const abortContext = createRetrieverSr2AuthenticatedContext('abort_case', controller.signal);
    const abortRuntime = createRetrieverSr2TrackedRuntime({
      fault: 'in_flight_abort',
      onInvoke: () => controller.abort(),
    });
    const aborted = await runRetrieverQueryRewriteModelCandidateV1({
      request: createRetrieverSr2Request(abortContext, {
        originalQuery: ORIGINAL_QUERY,
        recentTurns: RECENT_TURNS,
      }),
      context: abortContext,
      config: RETRIEVER_SCHEMA_RECOVERY_SR2_MOCK_CONFIG,
      now: () => Date.parse('2026-08-09T12:00:00.000Z'),
      createRuntime: () => abortRuntime.runtime,
    });
    expect(abortRuntime.invokes()).toBe(1);
    expect(aborted.observation.trace?.errorCode).toBe('ABORTED');
    expect(aborted.schemaRecoveryDiagnostic?.reasonCode).toBe('unknown');
  });

  test('keeps pre-abort and expired-deadline guards before runtime dispatch', async () => {
    const controller = new AbortController();
    controller.abort();
    const abortedContext = createRetrieverSr2AuthenticatedContext('pre_abort', controller.signal);
    let abortedFactoryCalls = 0;
    const aborted = await runRetrieverQueryRewriteModelCandidateV1({
      request: createRetrieverSr2Request(abortedContext, {
        originalQuery: ORIGINAL_QUERY,
        recentTurns: RECENT_TURNS,
      }),
      context: abortedContext,
      config: RETRIEVER_SCHEMA_RECOVERY_SR2_MOCK_CONFIG,
      now: () => Date.parse('2026-08-09T12:00:00.000Z'),
      createRuntime: () => {
        abortedFactoryCalls += 1;
        throw new Error('SR2_PRE_ABORT_RUNTIME');
      },
    });

    const expiredContext = createRetrieverSr2AuthenticatedContext(
      'expired',
      new AbortController().signal,
      '2026-08-09T11:59:59.000Z',
    );
    let expiredFactoryCalls = 0;
    const expired = await runRetrieverQueryRewriteModelCandidateV1({
      request: createRetrieverSr2Request(expiredContext, {
        originalQuery: ORIGINAL_QUERY,
        recentTurns: RECENT_TURNS,
      }),
      context: expiredContext,
      config: RETRIEVER_SCHEMA_RECOVERY_SR2_MOCK_CONFIG,
      now: () => Date.parse('2026-08-09T12:00:00.000Z'),
      createRuntime: () => {
        expiredFactoryCalls += 1;
        throw new Error('SR2_EXPIRED_RUNTIME');
      },
    });

    expect(abortedFactoryCalls).toBe(0);
    expect(expiredFactoryCalls).toBe(0);
    expect(aborted.rewrite.disposition).toBe('not_eligible');
    expect(expired.rewrite.disposition).toBe('not_eligible');
    expect(aborted.observation.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(expired.observation.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});
