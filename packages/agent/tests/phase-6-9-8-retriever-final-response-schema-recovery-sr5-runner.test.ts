import { describe, expect, test } from 'bun:test';

import { createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';
import { createPhase698RetrieverSchemaRecoverySr5SyntheticBoundAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-source-admission.ts';
import {
  createPhase698RetrieverSchemaRecoverySr5RunnerNoopLifecycleForTest,
  createPhase698RetrieverSchemaRecoverySr5RunnerReviewedMockHarnessForTest,
  runPhase698RetrieverSchemaRecoverySr5Runner,
  type Phase698RetrieverSchemaRecoverySr5RunnerHarness,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner.ts';

const RUN_IDS = [
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000104',
] as const;

function boundAdmission() {
  return createPhase698RetrieverSchemaRecoverySr5SyntheticBoundAdmissionForTest(
    createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput(),
  );
}

function lifecycle(runId: string) {
  return createPhase698RetrieverSchemaRecoverySr5RunnerNoopLifecycleForTest(runId);
}

describe('Phase 6.9.8 Retriever / FinalResponse SR5 runner', () => {
  test('runs guard-first and pair-serial reviewed Mock with zero-provider accounting', async () => {
    const runId = RUN_IDS[0];
    const admission = boundAdmission();
    const report = await runPhase698RetrieverSchemaRecoverySr5Runner({
      runId,
      runMode: 'reviewed_mock',
      repositoryRoot: process.cwd(),
      admissionAuthority: 'synthetic_test',
      admissionCapability: admission.capability,
      harness: createPhase698RetrieverSchemaRecoverySr5RunnerReviewedMockHarnessForTest(),
      lifecycle: lifecycle(runId),
      signal: new AbortController().signal,
    });

    expect(report.gate).toMatchObject({ passed: true, qualityAuthority: 'none' });
    expect(report.execution).toMatchObject({
      providerCalls: 0,
      credentialReads: 0,
      businessWrites: 0,
      syntheticInvocations: 12,
      maximumConcurrency: 1,
      retry: false,
      replay: false,
      resume: false,
      backfill: false,
    });
    expect(report.runtime).toMatchObject({
      reservations: 12,
      dispatches: 12,
      responses: 12,
      verifiedUsage: 12,
      succeeded: 12,
      failed: 0,
      notStarted: 0,
    });
    expect(
      report.laneEntries.every((entry) => entry.transportAuthority === 'synthetic_injected'),
    ).toBe(true);
  });

  test('opens a breaker on the first schema failure without retry or sibling dispatch', async () => {
    const runId = RUN_IDS[1];
    const admission = boundAdmission();
    const base = createPhase698RetrieverSchemaRecoverySr5RunnerReviewedMockHarnessForTest();
    let invocations = 0;
    const harness: Phase698RetrieverSchemaRecoverySr5RunnerHarness = Object.freeze({
      ...base,
      async invokeLane(input) {
        invocations += 1;
        if (invocations === 1) return { phase: 'rewrite_candidate_model', invalid: true } as never;
        return base.invokeLane(input);
      },
    });

    const report = await runPhase698RetrieverSchemaRecoverySr5Runner({
      runId,
      runMode: 'synthetic_fault',
      repositoryRoot: process.cwd(),
      admissionAuthority: 'synthetic_test',
      admissionCapability: admission.capability,
      harness,
      lifecycle: lifecycle(runId),
      signal: new AbortController().signal,
    });

    expect(invocations).toBe(1);
    expect(report.gate.passed).toBe(false);
    expect(report.runtime).toMatchObject({
      reservations: 1,
      dispatches: 1,
      responses: 1,
      verifiedUsage: 0,
      failed: 1,
      notStarted: 11,
    });
    expect(
      report.laneEntries.slice(1).every((entry) => entry.disposition.startsWith('not_started_')),
    ).toBe(true);
  });

  test('keeps a pre-aborted signal provider-zero and suffix-only', async () => {
    const runId = RUN_IDS[2];
    const admission = boundAdmission();
    const controller = new AbortController();
    controller.abort();
    let invocations = 0;
    const base = createPhase698RetrieverSchemaRecoverySr5RunnerReviewedMockHarnessForTest();
    const harness: Phase698RetrieverSchemaRecoverySr5RunnerHarness = Object.freeze({
      ...base,
      async invokeLane(input) {
        invocations += 1;
        return base.invokeLane(input);
      },
    });

    const report = await runPhase698RetrieverSchemaRecoverySr5Runner({
      runId,
      runMode: 'synthetic_fault',
      repositoryRoot: process.cwd(),
      admissionAuthority: 'synthetic_test',
      admissionCapability: admission.capability,
      harness,
      lifecycle: lifecycle(runId),
      signal: controller.signal,
    });

    expect(invocations).toBe(0);
    expect(report.runtime).toMatchObject({
      reservations: 0,
      dispatches: 0,
      responses: 0,
      verifiedUsage: 0,
      succeeded: 0,
      notStarted: 12,
    });
    expect(report.execution.providerCalls).toBe(0);
  });

  test('rejects a reused bound admission capability before any lane executes', async () => {
    const runId = RUN_IDS[3];
    const admission = boundAdmission();
    const input = {
      runId,
      runMode: 'reviewed_mock' as const,
      repositoryRoot: process.cwd(),
      admissionAuthority: 'synthetic_test' as const,
      admissionCapability: admission.capability,
      harness: createPhase698RetrieverSchemaRecoverySr5RunnerReviewedMockHarnessForTest(),
      lifecycle: lifecycle(runId),
      signal: new AbortController().signal,
    };
    await runPhase698RetrieverSchemaRecoverySr5Runner(input);
    await expect(runPhase698RetrieverSchemaRecoverySr5Runner(input)).rejects.toThrow(
      'BOUND_ADMISSION_CAPABILITY_INVALID',
    );
  });
});
