import { describe, expect, it } from 'bun:test';

import { runTutorWrongQuestionDeterministicBaseline } from '../src/evals/phase-6-9-tutor-wrong-question-baseline.ts';

describe('Phase 6.9.7 Tutor / WrongQuestionOrganizer deterministic baseline', () => {
  it('runs all 48 runtime cases and 32 organizer decisions without provider usage', () => {
    const report = runTutorWrongQuestionDeterministicBaseline();

    expect(report.datasetVersion).toBe('phase-6.9-tutor-wrong-question-v1');
    expect(report.datasetSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.mode).toBe('deterministic');
    expect(report.counts).toEqual({
      cases: 72,
      zeroCallCases: 24,
      runtimeCases: 48,
      pairedRequests: 24,
      organizerDecisionUnits: 32,
    });
    expect(report.runs).toHaveLength(48);
    expect(report.summary).toMatchObject({
      passed: 6,
      failed: 42,
      criticalFailures: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCny: 0,
      providerInvocations: 0,
    });
  });

  it('preserves the unmodified deterministic metric denominators and formula', () => {
    const report = runTutorWrongQuestionDeterministicBaseline();

    expect(report.metrics.ok).toBe(true);
    if (!report.metrics.ok) return;
    expect(report.metrics.metrics.tutor.scoredCases).toBe(24);
    expect(report.metrics.metrics.organizer.scoredDecisions).toBe(32);
    expect(report.metrics.metrics.tutor.intentMacroF1).toBeCloseTo(0.19733333333333336, 12);
    expect(report.metrics.metrics.tutor.depthAccuracy).toBeCloseTo(0.7916666666666666, 12);
    expect(report.metrics.metrics.tutor.contextUseAccuracy).toBe(1);
    expect(report.metrics.metrics.tutor.pedagogyPolicyAccuracy).toBe(0.25);
    expect(report.metrics.metrics.tutor.semanticScore).toBeCloseTo(0.44186666666666674, 12);
    expect(report.metrics.metrics.organizer.subjectAccuracy).toBe(0.25);
    expect(report.metrics.metrics.organizer.deckActionAccuracy).toBe(0.8125);
    expect(report.metrics.metrics.organizer.existingDeckPrecision).toBe(0);
    expect(report.metrics.metrics.organizer.topicLabelMacroF1).toBe(0);
    expect(report.metrics.metrics.organizer.evidenceConfidenceAccuracy).toBe(0);
    expect(report.metrics.metrics.organizer.semanticScore).toBeCloseTo(0.278125, 12);
    expect(report.metrics.metrics.combinedSemanticScore).toBeCloseTo(0.3599958333333334, 12);
    expect(report.metrics.metrics.combinedSemanticScore).toBeCloseTo(
      0.5 * report.metrics.metrics.tutor.semanticScore +
        0.5 * report.metrics.metrics.organizer.semanticScore,
      12,
    );
  });

  it('is byte-stable, deeply frozen, and does not mutate fixtures', () => {
    const first = runTutorWrongQuestionDeterministicBaseline();
    const second = runTutorWrongQuestionDeterministicBaseline();

    expect(JSON.stringify(second, null, 2)).toBe(JSON.stringify(first, null, 2));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.runs)).toBe(true);
  });
});
