import { describe, expect, it } from 'bun:test';

import { runKnowledgeAgentDeterministicBaseline } from '../src/evals/phase-6-9-knowledge-agent-baseline.ts';

describe('Phase 6.9.6 Knowledge Agent deterministic baseline', () => {
  it('runs all 48 semantic cases without provider usage', () => {
    const report = runKnowledgeAgentDeterministicBaseline();

    expect(report.datasetVersion).toBe('phase-6.9-knowledge-agents-v1');
    expect(report.mode).toBe('deterministic');
    expect(report.counts).toEqual({
      cases: 72,
      zeroCallCases: 24,
      runtimeCases: 48,
      pairedRequests: 24,
    });
    expect(report.runs).toHaveLength(48);
    expect(report.summary).toMatchObject({
      passed: 12,
      failed: 36,
      criticalFailures: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCny: 0,
      providerInvocations: 0,
    });
  });

  it('preserves the unmodified deterministic semantic measurements', () => {
    const report = runKnowledgeAgentDeterministicBaseline();

    expect(report.metrics.ok).toBe(true);
    if (!report.metrics.ok) return;
    expect(report.metrics.metrics.dedupSemanticMacroF1).toBeCloseTo(
      0.33436532507739936,
      12,
    );
    expect(report.metrics.metrics.revisionRecall).toBe(0);
    expect(report.metrics.metrics.unrelatedFalsePositiveRate).toBe(0);
    expect(report.metrics.metrics.organizerSubjectTop1).toBe(0.25);
    expect(report.metrics.metrics.organizerTagMicroF1).toBe(0);
    expect(report.metrics.metrics.organizerCollectionPairwiseF1).toBeCloseTo(
      0.4347826086956522,
      12,
    );
    expect(report.metrics.metrics.semanticScore).toBeCloseTo(
      0.23224525508143762,
      12,
    );
    expect(report.metrics.metrics.scoredRuntimeCases).toBe(48);
  });

  it('is reproducible and does not mutate frozen case fixtures', () => {
    const first = runKnowledgeAgentDeterministicBaseline();
    const second = runKnowledgeAgentDeterministicBaseline();

    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.runs)).toBe(true);
  });
});
