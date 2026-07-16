import { describe, expect, test } from 'bun:test';

import {
  runPhase695ReviewPlannerPaired,
  type Phase695LiveDependencies,
} from '../src/evals/run-phase-6-9-review-planner-paired.ts';

describe('phase 6.9 review planner paired runner', () => {
  test('runs Mock without an executor and never presents it as quality evidence', async () => {
    const report = await runPhase695ReviewPlannerPaired({ mode: 'mock' });

    expect(report.productionDecision).toBe('mock_quality_not_evidence');
    expect(report.counters).toMatchObject({
      caseEntries: 48,
      zeroCallCases: 26,
      runtimeInvocations: 22,
      strictSuccesses: 48,
    });
    expect(report.caseEntries.every((entry) => entry.runtimeInvocations <= 1)).toBe(true);
    expect(report.caseEntries.every((entry) => entry.budget.maxCalls === 2 && entry.budget.maxInputTokens === 1950 && entry.budget.maxOutputTokens === 440)).toBe(true);
  });

  test('opens the Live quality gate only after all strict, quality, latency, budget, and zero-call conditions pass', async () => {
    const live: Phase695LiveDependencies = {
      provider: 'test-provider',
      model: 'test-model',
      runtime: {},
      async evaluate() {
        return {
          strictSuccess: true,
          qualityPass: true,
          durationMs: 4_500,
          usage: { inputTokens: 40, outputTokens: 12 },
        };
      },
    };

    const report = await runPhase695ReviewPlannerPaired({ mode: 'live', live });

    expect(report.productionDecision).toBe('quality_gate_passed');
    expect(report.metrics).toMatchObject({
      strictSchemaSuccessRate: 1,
      semanticQualityRate: 1,
      criticalFailures: 0,
      p95DurationMs: 4_500,
    });
  });

  test('records a bounded budget failure without opening the Live gate', async () => {
    const report = await runPhase695ReviewPlannerPaired({
      mode: 'live',
      live: {
        provider: 'test-provider',
        model: 'test-model',
        runtime: {},
        async evaluate() {
          return {
            strictSuccess: true,
            qualityPass: true,
            durationMs: 1,
            usage: { inputTokens: 1_951, outputTokens: 1 },
          };
        },
      },
    });

    expect(report.productionDecision).toBe('budget_exceeded');
    expect(JSON.stringify(report)).not.toContain('test-provider');
  });
});
