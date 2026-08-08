import { describe, expect, test } from 'bun:test';

import {
  buildPhase698P1S2ReviewedMockStaticV1,
  PHASE_6_9_8_P1_S2_FACTORY_FROZEN_SHA256,
  PHASE_6_9_8_P1_S2_GATE,
  PHASE_6_9_8_P1_S2_REPORT_FROZEN_SHA256,
  runPhase698P1S2ReviewedMockScenario,
  validatePhase698P1S2ReviewedMockBytes,
  validatePhase698P1S2ReviewedMockFactory,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-s2-reviewed-mock.ts';

describe('Phase 6.9.8 P1 S2 reviewed Mock/static', () => {
  test('runs the real node/projector path with bounded synthetic usage and no Provider evidence', async () => {
    const bundle = await buildPhase698P1S2ReviewedMockStaticV1();

    expect(bundle.report.gate).toEqual({
      status: PHASE_6_9_8_P1_S2_GATE,
      passed: true,
      failureReasons: [],
    });
    expect(bundle.report.execution).toMatchObject({
      mode: 'reviewed_mock',
      responderInput: 'actual_bounded_prompt',
      usageAuthority: 'synthetic_estimate',
      syntheticUsageSamples: 12,
      verifiedProviderUsageSamples: 0,
      syntheticEstimateCny: null,
      verifiedProviderCostCny: null,
      provider: 'none',
      providerCalls: 0,
      credentialReads: 0,
      candidateInvocations: 12,
      maxConcurrency: 1,
      retry: false,
      resume: false,
      replay: false,
      backfill: false,
      backgroundJob: false,
      outbox: false,
    });
    expect(bundle.report.nodePath).toEqual({
      retrieverOriginal: 18,
      retrieverCandidate: 6,
      evidenceProjector: 6,
      finalResponse: 6,
      localMerger: 12,
    });
    expect(bundle.report.semantic).toMatchObject({
      rewriteStrict: 6,
      finalResponseStrict: 6,
      rewriteRecallAt5: 1,
      rewriteNdcgAt5: 1,
      finalGrounded: 1,
      citationPrecision: 1,
      requiredCitationRecall: 1,
      criticalNoticeRecall: 1,
      p95: null,
      p95Reason: 'insufficient_sample_size_6',
    });
    expect(bundle.report.formalEvidence).toEqual({
      markerCount: 0,
      journalCount: 0,
      artifactCount: 0,
      recoveryClaimCount: 0,
    });
    expect(bundle.report.baselineCompatibility).toEqual({
      caseId: 'final_11',
      frozenRequiredCitationCount: 1,
      effectiveRequiredCitationCount: 0,
      projectorStatus: 'insufficient',
      projectorCitationCount: 0,
      applied: true,
      reasonCode: 'insufficient_projector_omits_citation',
    });
    expect(bundle.report.runnerGate).toMatchObject({
      passed: false,
      failureReasons: ['citation_recall'],
    });

    expect(bundle.instrumentation).toMatchObject({
      guardNodeInvocations: 8,
      rewriteNodeInvocations: 6,
      retrieverOriginalInvocations: 18,
      retrieverCandidateInvocations: 6,
      finalResponseNodeInvocations: 6,
      evidenceProjectorInvocations: 6,
      syntheticQwenPortCalls: 17,
    });
    expect(bundle.instrumentation.promptAudits).toHaveLength(12);
    expect(bundle.instrumentation.projectorResults).toHaveLength(6);
    expect(JSON.stringify(bundle.instrumentation.promptAudits)).not.toMatch(
      /caseId|expected|oracle|credential|baselineReport/iu,
    );
    expect(validatePhase698P1S2ReviewedMockFactory()).toEqual({
      ok: true,
      sha256: PHASE_6_9_8_P1_S2_FACTORY_FROZEN_SHA256,
    });
    expect(bundle.sha256).toBe(PHASE_6_9_8_P1_S2_REPORT_FROZEN_SHA256);
    expect(await validatePhase698P1S2ReviewedMockBytes(bundle.canonicalBytes)).toEqual({
      ok: true,
      sha256: PHASE_6_9_8_P1_S2_REPORT_FROZEN_SHA256,
      gate: PHASE_6_9_8_P1_S2_GATE,
    });
    expect(await validatePhase698P1S2ReviewedMockBytes(`${bundle.canonicalBytes}\n`)).toEqual({
      ok: false,
      reasonCode: 'bytes_mismatch',
    });
  });

  test('keeps semantic mismatches in the denominator but opens the breaker for runtime faults', async () => {
    const semantic = await runPhase698P1S2ReviewedMockScenario({
      faults: { final_01: 'unknown_citation' },
    });
    expect(semantic.run.report.execution).toMatchObject({
      candidateInvocations: 12,
      breakerReason: null,
    });
    expect(semantic.run.report.finalResponseEntries[0]).toMatchObject({
      strict: false,
      falseCitation: true,
      failureCategory: 'semantic_mismatch',
      breakerOpened: false,
    });

    for (const fault of ['schema', 'usage', 'transport', 'timeout', 'stale'] as const) {
      const runtimeFailure = await runPhase698P1S2ReviewedMockScenario({
        faults: { rewrite_01: fault },
      });
      expect(runtimeFailure.run.report.execution.candidateInvocations).toBe(1);
      expect(runtimeFailure.run.report.execution.breakerReason).toBe(
        fault === 'timeout' ? 'transport' : fault,
      );
      expect(runtimeFailure.run.report.laneTerminals[0]?.breakerOpened).toBe(true);
      expect(runtimeFailure.run.report.laneTerminals.at(-1)?.disposition).toBe(
        'not_started_quality_breaker',
      );
    }

    for (const fault of ['schema', 'usage', 'transport', 'timeout', 'abort'] as const) {
      const runtimeFailure = await runPhase698P1S2ReviewedMockScenario({
        faults: { final_01: fault },
      });
      expect(runtimeFailure.run.report.execution.candidateInvocations).toBe(7);
      expect(runtimeFailure.run.report.execution.breakerReason).toBe(
        fault === 'timeout' ? 'transport' : fault,
      );
      expect(runtimeFailure.run.report.laneTerminals[6]?.breakerOpened).toBe(true);
      expect(runtimeFailure.run.report.laneTerminals.at(-1)?.disposition).toBe(
        'not_started_quality_breaker',
      );
    }
  });

  test('fails closed for false tool success, unknown citation, and cross-owner input', async () => {
    const falseTool = await runPhase698P1S2ReviewedMockScenario({
      faults: { final_01: 'false_tool_success' },
    });
    expect(falseTool.run.report.finalResponseEntries[0]).toMatchObject({
      strict: false,
      falseToolSuccess: true,
      failureCategory: 'semantic_mismatch',
    });
    expect(falseTool.run.report.execution.breakerReason).toBeNull();

    const crossOwner = await runPhase698P1S2ReviewedMockScenario({
      faults: { final_01: 'cross_owner' },
    });
    expect(crossOwner.run.report.finalResponseEntries[0]).toMatchObject({
      strict: false,
      wire: false,
      failureCategory: 'permission',
      breakerOpened: true,
    });
    expect(crossOwner.run.report.execution.breakerReason).toBe('permission');
    expect(crossOwner.instrumentation.syntheticQwenPortCalls).toBe(12);
    expect(crossOwner.instrumentation.retrieverOriginalInvocations).toBe(13);

    const retainedFailure = await buildPhase698P1S2ReviewedMockStaticV1({
      faults: { final_01: 'false_tool_success' },
    });
    expect(retainedFailure.report.baselineCompatibility.applied).toBe(true);
    expect(retainedFailure.report.runnerGate.failureReasons).toContain('citation_recall');
    expect(retainedFailure.report.gate.passed).toBe(false);
    expect(retainedFailure.report.gate.failureReasons).toContain('false_tool_success');
    expect(retainedFailure.report.gate.failureReasons).not.toContain('citation_recall');
  });

  test('pre-abort leaves every candidate lane at zero wire and does not create formal evidence', async () => {
    const controller = new AbortController();
    controller.abort('s2_pre_abort');
    const aborted = await runPhase698P1S2ReviewedMockScenario({ signal: controller.signal });

    expect(aborted.run.report.execution.candidateInvocations).toBe(0);
    expect(aborted.run.report.laneTerminals.every((entry) => entry.wire.dispatch === 0)).toBe(true);
    expect(aborted.run.report.formalEvidence).toEqual({
      markerCount: 0,
      journalCount: 0,
      artifactCount: 0,
      recoveryClaimCount: 0,
    });
    expect(aborted.instrumentation.promptAudits).toHaveLength(0);
    expect(aborted.instrumentation.syntheticQwenPortCalls).toBe(0);
  });
});
