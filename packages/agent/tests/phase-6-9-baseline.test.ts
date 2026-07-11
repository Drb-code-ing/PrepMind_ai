import { describe, expect, it } from 'bun:test';

import { phase69SeedCases } from '../src/evals/phase-6-9-seed-cases';
import { runPhase69DeterministicBaseline } from '../src/evals/run-phase-6-9-baseline';

describe('Phase 6.9 deterministic seed baseline', () => {
  it('has stable ids and all four target agents', () => {
    expect(phase69SeedCases).toHaveLength(32);
    expect(new Set(phase69SeedCases.map((item) => item.id)).size).toBe(phase69SeedCases.length);
    expect(new Set(phase69SeedCases.map((item) => item.agent))).toEqual(
      new Set(['router', 'verifier', 'memory', 'orchestrator']),
    );
    expect(
      phase69SeedCases.filter((item) => item.criticalSafetyCase).length,
    ).toBeGreaterThanOrEqual(4);
  });

  it('executes existing policies and keeps orchestrator expectation-only', () => {
    const report = runPhase69DeterministicBaseline();

    expect(report.datasetVersion).toBe('phase-6.9-seed-v1');
    expect(report.runs).toHaveLength(24);
    expect(report.expectationOnly).toHaveLength(8);
    expect(report.runs.every((run) => run.mode === 'deterministic')).toBe(true);
    expect(report.expectationOnly.every((item) => item.agent === 'orchestrator')).toBe(true);
    expect(report.summary.total).toBe(report.runs.length);
    expect(new Set(report.runs.map((run) => run.agent))).toEqual(
      new Set(['router', 'verifier', 'memory']),
    );
    expect({
      total: report.summary.total,
      passed: report.summary.passed,
      failed: report.summary.failed,
      criticalFailures: report.summary.criticalFailures,
      passRate: report.summary.passRate,
    }).toEqual({
      total: 24,
      passed: 21,
      failed: 3,
      criticalFailures: 1,
      passRate: 0.875,
    });
    expect(
      report.runs
        .filter((run) => !run.passed)
        .map((run) => ({ caseId: run.caseId, critical: run.criticalFailure })),
    ).toEqual([
      { caseId: 'router_ambiguous', critical: false },
      { caseId: 'verifier_trusted', critical: false },
      { caseId: 'memory_sensitive_credential', critical: true },
    ]);
  });
});
