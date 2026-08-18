import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildPhase698RetrieverPartialGateReport,
  parsePhase698RetrieverPartialGateReport,
  validatePhase698RetrieverPartialGateReport,
} from '../src/evals/phase-6-9-8-retriever-final-response-partial-quality-gate.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CALL_ENTRY_SCHEMA,
  buildPhase698RetrieverSchemaRecoverySr5LiveReport,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-contract.ts';
import {
  createPhase698RetrieverSchemaRecoverySr5LiveReviewedMockHarnessForTest,
  runPhase698RetrieverSchemaRecoverySr5ControlledLiveForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-runner.ts';
import { createPhase698RetrieverSchemaRecoverySr5LiveSyntheticAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-source-admission.ts';
import { reservePhase698RetrieverSchemaRecoverySr5LiveAttempt } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-durability.ts';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.8 partial quality gate', () => {
  test('keeps synthetic transport progress separate from real authority', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-partial-gate-'));
    roots.push(root);
    await mkdir(join(root, '.tmp'), { recursive: true });
    const admission = createPhase698RetrieverSchemaRecoverySr5LiveSyntheticAdmissionForTest();
    const reservation = await reservePhase698RetrieverSchemaRecoverySr5LiveAttempt({
      root,
      runId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      admissionAuthority: 'synthetic_test_live',
      reservationCapability: admission.reservationCapability,
    });
    const baseHarness = createPhase698RetrieverSchemaRecoverySr5LiveReviewedMockHarnessForTest();
    let calls = 0;
    const report = await runPhase698RetrieverSchemaRecoverySr5ControlledLiveForTest({
      runId: reservation.runId,
      repositoryRoot: root,
      admissionAuthority: 'synthetic_test_live',
      admissionCapability: admission.capability,
      harness: {
        ...baseHarness,
        invokeCall: async (input) => {
          if (calls++ === 3) throw new Error('bounded synthetic transport failure');
          return baseHarness.invokeCall(input);
        },
      },
      lifecycle: reservation.lifecycle,
      signal: new AbortController().signal,
    });

    const partial = buildPhase698RetrieverPartialGateReport({
      baseReport: report,
      executionMode: 'reviewed_mock',
    });

    expect(partial.gate).toMatchObject({
      status: 'partial_gate_failed',
      passed: false,
      authority: 'none',
      qualityAuthority: 'none',
      failureReasons: ['synthetic_authority'],
    });
    expect(partial.calls.planned).toBe(24);
    expect(partial.calls.responsesObserved).toBeGreaterThan(0);
    expect(partial.semantic).toMatchObject({ status: 'not_established', qualityAuthority: 'none' });
    expect(partial.budget).toEqual({
      inputTokens: null,
      outputTokens: null,
      verifiedCostCny: null,
    });
    expect(partial.rawDataRetained).toBe(false);
    expect(parsePhase698RetrieverPartialGateReport(partial)).toEqual(partial);
    expect(
      validatePhase698RetrieverPartialGateReport({
        report: partial,
        baseReport: report,
        executionMode: 'reviewed_mock',
      }),
    ).toEqual(partial);
    expect(JSON.stringify(partial)).not.toContain('provider_secret');

    const liveShapedReport = buildPhase698RetrieverSchemaRecoverySr5LiveReport({
      runId: report.runId,
      authority: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY,
      completionMode: report.completionMode,
      source: report.source,
      sourceBinding: report.sourceBinding,
      guardEntries: report.guardEntries,
      callEntries: report.callEntries.map((entry) =>
        PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CALL_ENTRY_SCHEMA.parse({
          ...entry,
          transportAuthority: 'external_provider',
        }),
      ),
      rewriteEntries: report.rewriteEntries,
      finalResponseEntries: report.finalResponseEntries,
    });
    const livePartial = buildPhase698RetrieverPartialGateReport({
      baseReport: liveShapedReport,
      executionMode: 'live',
    });
    expect(liveShapedReport.gate.passed).toBe(false);
    expect(livePartial.gate).toEqual({
      status: 'partial_transport_completion',
      passed: true,
      authority: 'retriever_final_response_transport_completion_authority',
      qualityAuthority: 'none',
      failureReasons: [],
    });
    expect(livePartial.calls).toMatchObject({
      started: 4,
      succeeded: 3,
      responsesObserved: 3,
      usageVerified: 3,
      deferred: 20,
      failed: 1,
    });
    expect(
      validatePhase698RetrieverPartialGateReport({
        report: { ...livePartial, rawDataRetained: true },
        baseReport: liveShapedReport,
        executionMode: 'live',
      }),
    ).toBeNull();
  });
});
