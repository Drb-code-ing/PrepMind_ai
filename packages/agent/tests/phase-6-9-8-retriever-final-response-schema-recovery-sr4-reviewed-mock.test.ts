import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_AUTHORITY,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_FACTORY_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_FROZEN_FACTORY_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_GATE,
  buildPhase698RetrieverSchemaRecoverySr4ReviewedMockStaticV1,
  runPhase698RetrieverSchemaRecoverySr4ReviewedMockScenario,
  validatePhase698RetrieverSchemaRecoverySr4ReviewedMockBytes,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr4-reviewed-mock.ts';

const STATIC_RUN_ID = '00000000-0000-4000-8000-000000000404';

describe('Phase 6.9.8 Retriever/FinalResponse Schema Recovery SR4 reviewed Mock/static', () => {
  test('pins the independent SR4 factory identity', () => {
    expect(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_FACTORY_SHA256).toBe(
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_FROZEN_FACTORY_SHA256,
    );
  });

  test('crosses the bounded parser, production nodes, synthetic Qwen port and SR3 runner', async () => {
    let fetchCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      return Promise.reject(new Error('SR4_GLOBAL_FETCH_FORBIDDEN'));
    }) as typeof fetch;

    let bundle;
    try {
      bundle = await buildPhase698RetrieverSchemaRecoverySr4ReviewedMockStaticV1({
        runId: STATIC_RUN_ID,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchCalls).toBe(0);
    expect(bundle.report).toMatchObject({
      authority: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_AUTHORITY,
      qualityAuthority: 'none',
      execution: {
        mode: 'reviewed_mock',
        provider: 'none',
        providerCalls: 0,
        credentialReads: 0,
        candidateInvocations: 12,
        maximumConcurrency: 1,
      },
      caseCounts: {
        guards: 8,
        rewriteCandidates: 6,
        finalResponseCandidates: 6,
        candidateInvocations: 12,
        reportEntries: 20,
      },
      nodePath: {
        retrieverOriginal: 18,
        retrieverCandidate: 6,
        evidenceProjector: 6,
        finalResponse: 6,
        localMerger: 6,
      },
      schema: {
        rewriteCanonical: 4,
        rewriteExtensionsDiscarded: 2,
        rewriteRejected: 0,
        finalResponseStrict: 6,
        rawDataRetained: false,
      },
      safety: {
        crossOwnerPortRejected: true,
        finalRequestOwnerBindingRejected: true,
        ragOmissionClearsEvidence: true,
        citationAllowlistEnforced: true,
        writeIsolationEnforced: true,
        providerCalls: 0,
        credentialReads: 0,
      },
      formalEvidence: {
        approvedTagCount: 0,
        markerCount: 0,
        journalCount: 0,
        reportCount: 0,
        artifactCount: 0,
        recoveryClaimCount: 0,
      },
      temporaryEvidence: { createdCount: 1, remainingCount: 0, formalNamespaceCount: 0 },
      gate: {
        status: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_GATE,
        passed: true,
        qualityAuthority: 'none',
        failureReasons: [],
      },
    });
    expect(bundle.report.runnerReport.gate.passed).toBe(true);
    expect(bundle.report.runnerReport.runtime).toMatchObject({
      reservations: 12,
      dispatches: 12,
      responses: 12,
      verifiedUsage: 12,
      succeeded: 12,
      failed: 0,
      notStarted: 0,
    });
    expect(bundle.scenario.instrumentation.promptAudits).toHaveLength(12);
    expect(bundle.scenario.instrumentation.schemaRuntimeObservations).toEqual([
      { laneId: 'rewrite_01', extensionInjected: false, parserAccepted: true },
      { laneId: 'rewrite_02', extensionInjected: true, parserAccepted: true },
      { laneId: 'rewrite_03', extensionInjected: false, parserAccepted: true },
      { laneId: 'rewrite_04', extensionInjected: false, parserAccepted: true },
      { laneId: 'rewrite_05', extensionInjected: true, parserAccepted: true },
      { laneId: 'rewrite_06', extensionInjected: false, parserAccepted: true },
    ]);
    expect(bundle.canonicalBytes).not.toContain('sr4ExtensionSentinel');
    expect(bundle.canonicalBytes).toContain('actual_bounded_prompt');
    expect(bundle.scenario.runnerReport.laneEntries.every((entry) => entry.durationMs === 0)).toBe(
      true,
    );
  });

  test('rebuilds identical canonical bytes and validates the strict static bundle', async () => {
    const first = await buildPhase698RetrieverSchemaRecoverySr4ReviewedMockStaticV1({
      runId: STATIC_RUN_ID,
    });
    const second = await buildPhase698RetrieverSchemaRecoverySr4ReviewedMockStaticV1({
      runId: STATIC_RUN_ID,
    });

    expect(second.canonicalBytes).toBe(first.canonicalBytes);
    expect(second.sha256).toBe(first.sha256);
    await expect(
      validatePhase698RetrieverSchemaRecoverySr4ReviewedMockBytes(first.canonicalBytes),
    ).resolves.toEqual({
      ok: true,
      sha256: first.sha256,
      gate: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_GATE,
    });
    await expect(
      validatePhase698RetrieverSchemaRecoverySr4ReviewedMockBytes(
        first.canonicalBytes.replace('{', '{\n', 1),
      ),
    ).resolves.toEqual({ ok: false, reasonCode: 'bytes_not_canonical' });
  });

  test('keeps prompt audits anti-oracle and never retains raw completion content', async () => {
    const scenario = await runPhase698RetrieverSchemaRecoverySr4ReviewedMockScenario({
      runId: STATIC_RUN_ID,
    });

    expect(scenario.instrumentation.promptAudits).toHaveLength(12);
    for (const entry of scenario.instrumentation.promptAudits) {
      expect(JSON.stringify(entry.audit)).not.toContain('rewrite_');
      expect(JSON.stringify(entry.audit)).not.toContain('expected');
      expect(JSON.stringify(entry.audit)).not.toContain('oracle');
      expect(JSON.stringify(entry.audit)).not.toContain('api_key');
    }
    expect(scenario.runnerReport.schema.rawDataRetained).toBe(false);
    expect(scenario.temporaryEvidence).toEqual({
      createdCount: 1,
      remainingCount: 0,
      formalNamespaceCount: 0,
    });
  });

  test.each([
    ['schema', 'schema', 'projected_schema'],
    ['usage', 'usage', null],
    ['transport', 'transport', null],
    ['timeout', 'timeout', null],
    ['abort', 'aborted', null],
    ['cross_owner', 'permission', null],
  ] as const)(
    'fails the rewrite lane closed for %s without retry or replay',
    async (fault, reason, stage) => {
      const scenario = await runPhase698RetrieverSchemaRecoverySr4ReviewedMockScenario({
        runId: STATIC_RUN_ID,
        faults: { rewrite_03: fault },
      });
      const failed = scenario.runnerReport.laneEntries.find(
        (entry) => entry.caseId === 'rewrite_03',
      );

      expect(failed).toMatchObject({
        disposition: reason === 'timeout' || reason === 'aborted' ? reason : 'failed',
        failureReason: reason,
        wire: { reservations: 1, dispatches: 1, responses: 0, verifiedUsage: 0 },
        schemaStage: stage,
      });
      expect(scenario.runnerReport.runtime).toMatchObject({
        reservations: 5,
        dispatches: 5,
        responses: 4,
        verifiedUsage: 4,
        notStarted: 7,
      });
      expect(scenario.runnerReport.execution.retry).toBe(false);
      expect(scenario.runnerReport.execution.replay).toBe(false);
      expect(scenario.runnerReport.gate.passed).toBe(false);
    },
  );

  test('pre-abort performs no runtime dispatch and leaves all schema observations unobserved', async () => {
    const controller = new AbortController();
    controller.abort('sr4-pre-abort');
    const scenario = await runPhase698RetrieverSchemaRecoverySr4ReviewedMockScenario({
      runId: STATIC_RUN_ID,
      signal: controller.signal,
    });

    expect(scenario.runnerReport.runtime).toMatchObject({
      reservations: 0,
      dispatches: 0,
      responses: 0,
      verifiedUsage: 0,
      notStarted: 12,
    });
    expect(scenario.instrumentation.promptAudits).toHaveLength(0);
    expect(scenario.instrumentation.schemaRuntimeObservations).toHaveLength(0);
    expect(scenario.runnerReport.gate.passed).toBe(false);
  });
});
