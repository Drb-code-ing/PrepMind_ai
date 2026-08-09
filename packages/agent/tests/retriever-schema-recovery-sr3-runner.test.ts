import { describe, expect, test } from 'bun:test';

import {
  createPhase698RetrieverSchemaRecoverySr3ReviewedMockHarnessForTest,
  createPhase698RetrieverSchemaRecoverySr3NoopLifecycleForTest,
  runPhase698RetrieverSchemaRecoverySr3,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-runner.ts';
import { createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-source-admission.ts';

const RUN_ID = '00000000-0000-4000-8000-000000000002';

describe('Phase 6.9.8 Retriever Schema Recovery SR3 runner', () => {
  test('runs guard-first, pair-serial reviewed Mock with no Provider or credential boundary crossing', async () => {
    const admission = createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest();
    const report = await runPhase698RetrieverSchemaRecoverySr3({
      runId: RUN_ID,
      runMode: 'reviewed_mock',
      admissionCapability: admission.capability,
      harness: createPhase698RetrieverSchemaRecoverySr3ReviewedMockHarnessForTest(),
      lifecycle: createPhase698RetrieverSchemaRecoverySr3NoopLifecycleForTest(RUN_ID),
      signal: new AbortController().signal,
    });
    expect(report.gate.passed).toBe(true);
    expect(report.execution).toMatchObject({
      providerCalls: 0,
      credentialReads: 0,
      businessWrites: 0,
      syntheticInvocations: 12,
      maximumConcurrency: 1,
      retry: false,
      replay: false,
      resume: false,
    });
    expect(report.runtime).toMatchObject({
      reservations: 12,
      dispatches: 12,
      responses: 12,
      verifiedUsage: 12,
      succeeded: 12,
      notStarted: 0,
    });
  });

  test('opens a breaker on the first schema failure and preserves suffix denominator', async () => {
    const admission = createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest();
    let calls = 0;
    const base = createPhase698RetrieverSchemaRecoverySr3ReviewedMockHarnessForTest();
    const harness = Object.freeze({
      ...base,
      async invokeLane(input: Parameters<typeof base.invokeLane>[0]) {
        calls += 1;
        if (calls === 1) return { phase: 'rewrite_candidate_model', invalid: true } as never;
        return base.invokeLane(input);
      },
    });
    const report = await runPhase698RetrieverSchemaRecoverySr3({
      runId: '00000000-0000-4000-8000-000000000003',
      runMode: 'synthetic_fault',
      admissionCapability: admission.capability,
      harness,
      lifecycle: createPhase698RetrieverSchemaRecoverySr3NoopLifecycleForTest(
        '00000000-0000-4000-8000-000000000003',
      ),
      signal: new AbortController().signal,
    });
    expect(calls).toBe(1);
    expect(report.runtime).toMatchObject({
      reservations: 1,
      dispatches: 1,
      responses: 1,
      verifiedUsage: 0,
      failed: 1,
      notStarted: 11,
    });
    expect(report.gate.passed).toBe(false);
    expect(
      report.laneEntries.slice(1).every((entry) => entry.disposition.startsWith('not_started_')),
    ).toBe(true);
  });

  test('keeps a pre-aborted signal before every candidate dispatch', async () => {
    const admission = createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest();
    const controller = new AbortController();
    controller.abort();
    let invocations = 0;
    const base = createPhase698RetrieverSchemaRecoverySr3ReviewedMockHarnessForTest();
    const harness = Object.freeze({
      ...base,
      async invokeLane(input: Parameters<typeof base.invokeLane>[0]) {
        invocations += 1;
        return base.invokeLane(input);
      },
    });
    const runId = '00000000-0000-4000-8000-000000000014';
    const report = await runPhase698RetrieverSchemaRecoverySr3({
      runId,
      runMode: 'synthetic_fault',
      admissionCapability: admission.capability,
      harness,
      lifecycle: createPhase698RetrieverSchemaRecoverySr3NoopLifecycleForTest(runId),
      signal: controller.signal,
    });
    expect(invocations).toBe(0);
    expect(report.gate.passed).toBe(false);
    expect(report.runtime).toMatchObject({
      reservations: 0,
      dispatches: 0,
      responses: 0,
      verifiedUsage: 0,
      notStarted: 12,
    });
  });
});
