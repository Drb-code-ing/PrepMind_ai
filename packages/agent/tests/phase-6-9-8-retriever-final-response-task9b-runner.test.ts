import { randomUUID } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import { createPhase698Task9ReviewedMockHarnessForTest } from '../src/evals/phase-6-9-8-retriever-final-response-task9-reviewed-mock.ts';
import {
  runPhase698Task9,
  runPhase698Task9ForTest,
  type Phase698Task9Harness,
  type Phase698Task9Lifecycle,
} from '../src/evals/phase-6-9-8-retriever-final-response-task9-runner.ts';
import { createPhase698Task9SyntheticAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-task9-source-admission.ts';

describe('Phase 6.9.8 Task 9B runner failure boundaries', () => {
  test('propagates reserve and lifecycle evidence I/O failures without converting them to Provider failures', async () => {
    const targets = [
      'reserve',
      'dispatch_started',
      'response_received',
      'usage_verified',
      'call_terminal',
    ] as const;

    for (const target of targets) {
      const runId = randomUUID();
      const sentinel = new Error(`evidence_io_${target}`);
      const harness = await createPhase698Task9ReviewedMockHarnessForTest();
      const lifecycle = failingLifecycle(runId, target, sentinel);
      const admission = createPhase698Task9SyntheticAdmissionForTest();

      await expect(
        runPhase698Task9({
          runId,
          authority: 'synthetic_test',
          credentialReads: 0,
          admissionCapability: admission.capability,
          harness,
          lifecycle,
          signal: new AbortController().signal,
        }),
      ).rejects.toBe(sentinel);
    }
  });

  test('records a thrown runtime as one failed call and closes the remaining denominator', async () => {
    const base = await createPhase698Task9ReviewedMockHarnessForTest();
    const harness: Phase698Task9Harness = Object.freeze({
      transportAuthority: 'synthetic_injected',
      runGuard: base.runGuard,
      async invokeCall() {
        throw new Error('raw provider details must not escape');
      },
    });
    const report = await runWithNoopLifecycle(harness);

    expect(report.callEntries[0]).toMatchObject({
      disposition: 'failed',
      failureReason: 'transport',
      wire: { attempts: 1, dispatches: 1, responses: 0, verifiedUsage: 0 },
      usage: null,
      verifiedCostCny: null,
    });
    expect(
      report.callEntries.slice(1).every((entry) => entry.disposition.startsWith('not_started_')),
    ).toBe(true);
    expect(JSON.stringify(report)).not.toContain('raw provider details');
    expect(report.providers.qwen).toMatchObject({
      expectedCalls: 32,
      attempts: 1,
      dispatches: 1,
      responses: 0,
      verifiedUsage: 0,
      inputTokens: null,
      outputTokens: null,
      verifiedCostCny: null,
    });
    expect(report.providers.aggregateVerifiedCostCny).toBeNull();
  });

  test('records invalid response schema only after response_received and never fabricates usage', async () => {
    const base = await createPhase698Task9ReviewedMockHarnessForTest();
    const harness: Phase698Task9Harness = Object.freeze({
      transportAuthority: 'synthetic_injected',
      runGuard: base.runGuard,
      async invokeCall() {
        return Object.freeze({ invalid: true }) as never;
      },
    });
    const report = await runWithNoopLifecycle(harness);

    expect(report.callEntries[0]).toMatchObject({
      disposition: 'failed',
      failureReason: 'schema_invalid',
      wire: { attempts: 1, dispatches: 1, responses: 1, verifiedUsage: 0 },
      usage: null,
      verifiedCostCny: null,
    });
    expect(report.rewrite.strictCount).toBe(0);
    expect(report.latency.rewriteP95Ms).toBeNull();
  });

  test('hard timeout aborts the lane once and records no response or usage', async () => {
    const base = await createPhase698Task9ReviewedMockHarnessForTest();
    const harness: Phase698Task9Harness = Object.freeze({
      transportAuthority: 'synthetic_injected',
      runGuard: base.runGuard,
      invokeCall: () => new Promise(() => undefined),
    });
    const runId = randomUUID();
    const admission = createPhase698Task9SyntheticAdmissionForTest();
    const report = await runPhase698Task9ForTest(
      {
        runId,
        authority: 'synthetic_test',
        credentialReads: 0,
        admissionCapability: admission.capability,
        harness,
        lifecycle: noopLifecycle(runId),
        signal: new AbortController().signal,
      },
      { timeoutMs: () => 1 },
    );

    expect(report.callEntries[0]).toMatchObject({
      disposition: 'timeout',
      failureReason: 'timeout',
      wire: { attempts: 1, dispatches: 1, responses: 0, verifiedUsage: 0 },
    });
    expect(report.callEntries.filter((entry) => entry.wire.attempts === 1)).toHaveLength(1);
  });

  test('classifies watchdog setup and cleanup failures as local runtime contract failures', async () => {
    for (const failure of ['setup', 'cleanup'] as const) {
      const base = await createPhase698Task9ReviewedMockHarnessForTest();
      let invocations = 0;
      const harness: Phase698Task9Harness = Object.freeze({
        transportAuthority: 'synthetic_injected',
        runGuard: base.runGuard,
        async invokeCall(input) {
          invocations += 1;
          return base.invokeCall(input);
        },
      });
      const runId = randomUUID();
      const admission = createPhase698Task9SyntheticAdmissionForTest();
      const report = await runPhase698Task9ForTest(
        {
          runId,
          authority: 'synthetic_test',
          credentialReads: 0,
          admissionCapability: admission.capability,
          harness,
          lifecycle: noopLifecycle(runId),
          signal: new AbortController().signal,
        },
        failure === 'setup'
          ? {
              setTimer: () => {
                throw new Error('watchdog setup failed');
              },
            }
          : {
              clearTimer: () => {
                throw new Error('watchdog cleanup failed');
              },
            },
      );

      expect(report.callEntries[0]).toMatchObject({
        disposition: 'failed',
        failureReason: 'runtime_contract_invalid',
        wire: { attempts: 1, dispatches: 1, responses: 0, verifiedUsage: 0 },
      });
      expect(invocations).toBe(failure === 'setup' ? 0 : 1);
    }
  });
});

async function runWithNoopLifecycle(harness: Phase698Task9Harness) {
  const runId = randomUUID();
  const admission = createPhase698Task9SyntheticAdmissionForTest();
  return runPhase698Task9({
    runId,
    authority: 'synthetic_test',
    credentialReads: 0,
    admissionCapability: admission.capability,
    harness,
    lifecycle: noopLifecycle(runId),
    signal: new AbortController().signal,
  });
}

function noopLifecycle(runId: string): Phase698Task9Lifecycle {
  return Object.freeze({
    runId,
    appendGuardTerminal: async () => undefined,
    reserveCall: async () => Object.freeze({ appendWireStage: async () => undefined }),
    appendCallTerminal: async () => undefined,
    appendRewriteTerminal: async () => undefined,
    appendFinalTerminal: async () => undefined,
    appendRunTerminal: async () => undefined,
  });
}

function failingLifecycle(
  runId: string,
  target: 'reserve' | 'dispatch_started' | 'response_received' | 'usage_verified' | 'call_terminal',
  sentinel: Error,
): Phase698Task9Lifecycle {
  return Object.freeze({
    runId,
    appendGuardTerminal: async () => undefined,
    async reserveCall() {
      if (target === 'reserve') throw sentinel;
      return Object.freeze({
        async appendWireStage(stage: string) {
          if (stage === target) throw sentinel;
        },
      });
    },
    async appendCallTerminal() {
      if (target === 'call_terminal') throw sentinel;
    },
    appendRewriteTerminal: async () => undefined,
    appendFinalTerminal: async () => undefined,
    appendRunTerminal: async () => undefined,
  });
}
