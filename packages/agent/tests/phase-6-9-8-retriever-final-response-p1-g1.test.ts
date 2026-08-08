import { describe, expect, test } from 'bun:test';

import {
  buildPhase698P1DeterministicSubsetBaseline,
  PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256,
  validatePhase698P1BaselineBytes,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-baseline.ts';
import {
  PHASE_6_9_8_P1_EVAL_POLICY,
  PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
  PHASE_6_9_8_P1_MANIFEST,
  PHASE_6_9_8_P1_MANIFEST_SHA256,
  validatePhase698P1FrozenIdentity,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-manifest.ts';
import {
  projectP1FinalResponseCandidateInput,
  projectP1RewriteCandidateInput,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-candidate-contract.ts';
import {
  PHASE_6_9_8_P1_G1_REPORT_SCHEMA_VERSION,
  scorePhase698P1G1,
  type Phase698P1G1ReportInput,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-scorer.ts';

describe('Phase 6.9.8 Retriever / FinalResponse P1 G1 zero-provider contract', () => {
  test('freezes the 8+6+6 subset and independent source identity', () => {
    expect(PHASE_6_9_8_P1_MANIFEST.guardCases.map((entry) => entry.caseId)).toEqual([
      'guard_02',
      'guard_03',
      'guard_04',
      'guard_09',
      'guard_10',
      'guard_11',
      'guard_15',
      'guard_16',
    ]);
    expect(PHASE_6_9_8_P1_MANIFEST.rewriteCases.map((entry) => entry.caseId)).toEqual([
      'rewrite_01',
      'rewrite_03',
      'rewrite_05',
      'rewrite_09',
      'rewrite_12',
      'rewrite_15',
    ]);
    expect(PHASE_6_9_8_P1_MANIFEST.finalResponseCases.map((entry) => entry.caseId)).toEqual([
      'final_01',
      'final_07',
      'final_09',
      'final_11',
      'final_13',
      'final_15',
    ]);
    expect(PHASE_6_9_8_P1_MANIFEST_SHA256).toBe(PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256);
    expect(PHASE_6_9_8_P1_EVAL_POLICY.counts).toEqual({
      guards: 8,
      rewrite: 6,
      finalResponse: 6,
      semanticLanes: 12,
      total: 20,
    });
    expect(PHASE_6_9_8_P1_FROZEN_POLICY_SHA256).toBe(
      'edaa07d1071a93336b40d68948011a21a3e96938ca7d7b862991bb2bc37537f3',
    );
    expect(validatePhase698P1FrozenIdentity()).toEqual({
      ok: true,
      manifestSha256: PHASE_6_9_8_P1_MANIFEST_SHA256,
      policySha256: PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
    });
  });

  test('projects model-only inputs without oracle, baseline, answer, or policy fields', () => {
    const rewrite = projectP1RewriteCandidateInput(PHASE_6_9_8_P1_MANIFEST.rewriteCases[0]!);
    const finalResponse = projectP1FinalResponseCandidateInput(
      PHASE_6_9_8_P1_MANIFEST.finalResponseCases[0]!,
    );
    expect(Object.keys(rewrite).sort()).toEqual(['originalQuery', 'recentTurns']);
    expect(Object.keys(finalResponse).sort()).toEqual(['latestUserMessage', 'recentConversation']);
    const serialized = JSON.stringify({ rewrite, finalResponse });
    expect(serialized).not.toMatch(
      /baseline|oracle|expected|grounding|citation|toolIntent|threshold/iu,
    );
    expect(Object.isFrozen(rewrite)).toBe(true);
    expect(Object.isFrozen(finalResponse)).toBe(true);
  });

  test('rebuilds the deterministic subset baseline with no Provider or credential authority', async () => {
    const first = await buildPhase698P1DeterministicSubsetBaseline();
    const second = await buildPhase698P1DeterministicSubsetBaseline();
    expect(first.canonicalBytes).toBe(second.canonicalBytes);
    expect(first.sha256).toBe(PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256);
    expect(first.report).toMatchObject({
      authority: 'zero_provider_retriever_final_response_p1_deterministic_subset_baseline',
      qualityAuthority: 'deterministic_baseline_only',
      visibility: 'evaluator_only',
      caseCounts: { guards: 8, rewrite: 6, finalResponse: 6, total: 20 },
      execution: {
        provider: 'none',
        providerCalls: 0,
        credentialReads: 0,
        qwenEmbeddingCalls: 0,
        queryRewriteModelCalls: 0,
        finalResponseModelCalls: 0,
      },
    });
    expect(
      first.report.guards.every((entry) => entry.passed && entry.fakeSearchPortCalls === 0),
    ).toBe(true);
    expect(first.report.rewriteEntries).toHaveLength(6);
    expect(first.report.finalResponseEntries).toHaveLength(6);
    expect(first.canonicalBytes).not.toMatch(
      /这一步为什么要除以质量|牛顿第二定律说明合外力|target_chunk|api[_-]?key|sk-/iu,
    );
    await expect(validatePhase698P1BaselineBytes(first.canonicalBytes)).resolves.toEqual({
      ok: true,
      sha256: first.sha256,
    });
  });

  test('recomputes all G1 aggregates and passes only the zero-provider contract gate', async () => {
    const baseline = await buildPhase698P1DeterministicSubsetBaseline();
    const report = buildPassingReport(baseline.report);
    const gate = scorePhase698P1G1(report, baseline);
    const uplift = gate.aggregates?.rewriteNdcgUplift;
    expect(gate).toMatchObject({
      status: 'p1_g1_contract_baseline_passed',
      passed: true,
      qualityAuthority: 'none',
      failureReasons: [],
    });
    expect(gate.aggregates).toMatchObject({
      guardPassCount: 8,
      guardZeroCallCount: 8,
      rewriteStrictCount: 6,
      rewriteRuntimeCount: 6,
      rewriteWireCount: 6,
      rewriteVerifiedUsageCount: 6,
      finalStrictCount: 6,
      finalTerminalCount: 6,
      finalWireCount: 6,
      finalVerifiedUsageCount: 6,
      rewriteCandidateRecallAt5: 1,
      rewriteCandidateNdcgAt5: 1,
      rewriteNdcgUplift: expect.any(Number),
      criticalTargetRecall: 1,
      intentPreservation: 1,
      groundedRubric: 1,
      citationPrecision: 1,
      requiredCitationRecall: 1,
      criticalNoticeRecall: 1,
      falseToolSuccessCount: 0,
      falseCitationCount: 0,
      safetyFailureCount: 0,
      p95: null,
      p95Reason: 'insufficient_sample_size_6',
    });
    expect(uplift).toBeGreaterThanOrEqual(0.08);
  });

  test('rejects self-reported aggregate, duplicate identity, baseline drift, and unsafe breaker claims', async () => {
    const baseline = await buildPhase698P1DeterministicSubsetBaseline();
    const passing = buildPassingReport(baseline.report);
    expect(scorePhase698P1G1({ ...passing, aggregate: { quality: 1 } }, baseline)).toMatchObject({
      status: 'p1_g1_report_invalid',
      passed: false,
      failureReasons: ['report_schema_invalid'],
    });
    const duplicate = structuredClone(passing);
    duplicate.rewriteEntries[1] = { ...duplicate.rewriteEntries[0]! };
    expect(scorePhase698P1G1(duplicate, baseline).failureReasons).toContain(
      'rewrite_manifest_shape',
    );
    const drift = structuredClone(passing);
    drift.rewriteEntries[0]!.baselineNdcgAt5 = 0;
    expect(scorePhase698P1G1(drift, baseline).failureReasons).toContain(
      'rewrite_baseline_projection',
    );
    const semanticBreaker = structuredClone(passing);
    semanticBreaker.rewriteEntries[0]!.failureCategory = 'semantic_mismatch';
    semanticBreaker.rewriteEntries[0]!.breakerOpened = true;
    expect(scorePhase698P1G1(semanticBreaker, baseline).failureReasons).toContain(
      'semantic_mismatch_breaker',
    );
  });
});

function buildPassingReport(
  baseline: Awaited<ReturnType<typeof buildPhase698P1DeterministicSubsetBaseline>>['report'],
): Phase698P1G1ReportInput {
  return {
    schemaVersion: PHASE_6_9_8_P1_G1_REPORT_SCHEMA_VERSION,
    lineage: baseline.lineage,
    manifestSha256: baseline.manifestSha256,
    policySha256: PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
    baselineSha256: PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256,
    authority: 'zero_provider_retriever_final_response_p1_g1_strict_scorer',
    qualityAuthority: 'none',
    execution: {
      providerCalls: 0,
      credentialReads: 0,
      qwenEmbeddingCalls: 0,
      candidateInvocations: 12,
      retry: false,
      resume: false,
      replay: false,
      backfill: false,
      backgroundJob: false,
      outbox: false,
    },
    formalEvidence: { markerCount: 0, journalCount: 0, artifactCount: 0, recoveryClaimCount: 0 },
    guardEntries: baseline.guards.map((entry) => ({
      caseId: entry.caseId,
      observedReasonCode: entry.observedReasonCode,
      strict: true,
      terminal: true,
      fakeSearchPortCalls: 0,
      providerCalls: 0,
      credentialReads: 0,
      failureCategory: 'none' as const,
      breakerOpened: false,
    })),
    rewriteEntries: baseline.rewriteEntries.map((entry) => ({
      caseId: entry.caseId,
      strict: true,
      runtime: true,
      wire: true,
      verifiedUsage: true,
      terminal: true,
      metricEligible: entry.metricEligible,
      expectedNoHit: entry.expectedNoHit,
      noHitObserved: entry.expectedNoHit ? true : null,
      baselineRecallAt5: entry.recallAt5,
      baselineNdcgAt5: entry.ndcgAt5,
      candidateRecallAt5: entry.expectedNoHit ? null : 1,
      candidateNdcgAt5: entry.expectedNoHit ? null : 1,
      critical: entry.critical,
      intentPreserved: true,
      unsafeRewrite: false,
      candidateInvocations: 1,
      durationMs: 10,
      failureCategory: 'none' as const,
      breakerOpened: false,
    })),
    finalResponseEntries: baseline.finalResponseEntries.map((entry) => ({
      caseId: entry.caseId,
      strict: true,
      runtime: true,
      wire: true,
      verifiedUsage: true,
      terminal: true,
      groundedScore: 1,
      requiredCitationCount: entry.requiredCitationCount,
      requiredNotice: entry.requiredNotice,
      observedCitationCount: entry.requiredCitationCount,
      citationTruePositiveCount: entry.requiredCitationCount,
      noticeSatisfied: true,
      falseToolSuccess: false,
      falseCitation: false,
      safetyFailure: false,
      candidateInvocations: 1,
      durationMs: 10,
      failureCategory: 'none' as const,
      breakerOpened: false,
    })),
  };
}
