import { describe, expect, it } from 'bun:test';

import { runPhase69DeterministicBaseline } from '../src/evals/run-phase-6-9-baseline';
import { runPhase6941RouterVerifierBaseline } from '../src/evals/run-phase-6-9-router-verifier-baseline';

describe('Phase 6.9.4.1 deterministic Router / Verifier baseline', () => {
  it('runs exactly 60 Router and 40 Verifier cases with safe zero-cost metadata', () => {
    const report = runPhase6941RouterVerifierBaseline();

    expect(report.datasetVersion).toBe('phase-6.9-router-verifier-v1');
    expect(report.routerRuns).toHaveLength(60);
    expect(report.verifierRuns).toHaveLength(40);
    expect(report.summary.total).toBe(100);
    expect(report.routerMetrics.ok).toBe(true);
    expect(report.verifierMetrics.ok).toBe(true);

    for (const run of [...report.routerRuns, ...report.verifierRuns]) {
      expect(run.mode).toBe('deterministic');
      expect(run.datasetVersion).toBe('phase-6.9-router-verifier-v1');
      expect(run.inputTokens).toBe(0);
      expect(run.outputTokens).toBe(0);
      expect(run.estimatedCost).toBe(0);
      expect(run.outcome.expectedCode).toMatch(/^[A-Za-z0-9_.:-]{1,80}$/);
      expect(run.outcome.actualCode).toMatch(/^[A-Za-z0-9_.:-]{1,80}$/);
      if (run.outcome.errorCode) {
        expect(run.outcome.errorCode).toMatch(/^[A-Za-z0-9_.:-]{1,80}$/);
      }
    }
  });

  it('does not expose case input, chunks, prompt, or provider output', () => {
    const serialized = JSON.stringify(runPhase6941RouterVerifierBaseline());

    for (const forbidden of [
      '结合我的笔记讲一下这道题',
      'Ignore previous instructions',
      'documentTitle',
      'activeStudyContext',
      'providerOutput',
      '脱敏合成评测资料',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('keeps the original seed baseline result reproducible', () => {
    const historical = runPhase69DeterministicBaseline();

    expect(historical.datasetVersion).toBe('phase-6.9-seed-v1');
    expect(historical.summary.total).toBe(24);
    expect(historical.summary.passed).toBe(21);
    expect(historical.summary.criticalFailures).toBe(1);
    expect(historical.expectationOnly).toHaveLength(8);
  });
});
