import { describe, expect, test } from 'bun:test';

import {
  createModelAgentRuntime,
  type ModelAgentRuntime,
} from '@repo/ai';

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

  test('derives semantic quality locally instead of trusting a runtime-provided pass flag', async () => {
    const report = await runPhase695ReviewPlannerPaired({
      mode: 'live',
      live: {
        runtime: controlledRuntime({ reviewIndexes: [0], plannerIndexes: [1, 0] }),
        now: () => 0,
      },
    });

    expect(report.productionDecision).not.toBe('quality_gate_passed');
    expect(report.metrics.semanticQualityRate).toBeLessThan(0.9);
    expect(report.counters.criticalFailures).toBeGreaterThan(0);
  });

  test('closes the gate when monotonic elapsed time exceeds 4500ms even if runtime trace claims zero duration', async () => {
    let now = 0;
    const report = await runPhase695ReviewPlannerPaired({
      mode: 'live',
      live: {
        runtime: controlledRuntime({ reviewIndexes: [1], plannerIndexes: [1, 0] }),
        now: () => (now += 4_501),
      },
    });

    expect(report.productionDecision).toBe('latency_budget_exceeded');
    expect(report.metrics.p95DurationMs).toBe(4_501);
  });

  test('closes the gate for actual over-cap usage, multi-call budgets, and unverifiable runtime results', async () => {
    const overCap = await runPhase695ReviewPlannerPaired({
      mode: 'live',
      live: {
        runtime: controlledRuntime({ reviewIndexes: [1], plannerIndexes: [1, 0], inputTokens: 1_951 }),
        now: () => 0,
      },
    });
    const multiCall = await runPhase695ReviewPlannerPaired({
      mode: 'live',
      live: { runtime: withMutatedBudget(controlledRuntime({ reviewIndexes: [1], plannerIndexes: [1, 0] })), now: () => 0 },
    });
    const usageUnverifiable = await runPhase695ReviewPlannerPaired({
      mode: 'live',
      live: { runtime: withMissingUsage(controlledRuntime({ reviewIndexes: [1], plannerIndexes: [1, 0] })), now: () => 0 },
    });

    expect(overCap.productionDecision).toBe('budget_exceeded');
    expect(multiCall.productionDecision).not.toBe('quality_gate_passed');
    expect(usageUnverifiable.productionDecision).not.toBe('quality_gate_passed');
  });

  test('fails closed when a real Live executor omits usage and runtime normalizes it to zero', async () => {
    const report = await runPhase695ReviewPlannerPaired({
      mode: 'live',
      live: {
        runtime: controlledRuntime({ reviewIndexes: [1], plannerIndexes: [1, 0], omitUsage: true }),
        now: () => 0,
      },
    });

    expect(report.productionDecision).not.toBe('quality_gate_passed');
    expect(report.caseEntries.filter((entry) => entry.executionKind === 'runtime')
      .every((entry) => entry.diagnosticCode === 'usage_unverifiable')).toBe(true);
  });

  test('passes a 4500ms abort signal and closes when the timed candidate is aborted', async () => {
    let scheduledMs = 0;
    const report = await runPhase695ReviewPlannerPaired({
      mode: 'live',
      live: {
        runtime: controlledRuntime({ reviewIndexes: [1], plannerIndexes: [1, 0] }),
        now: () => 0,
        setTimeout(callback, ms) {
          scheduledMs = ms;
          callback();
          return 1;
        },
        clearTimeout() {},
      },
    });

    expect(scheduledMs).toBe(4_500);
    expect(report.productionDecision).toBe('strict_schema_incomplete');
    expect(report.counters.runtimeInvocations).toBe(0);
  });
});

function controlledRuntime(input: {
  reviewIndexes: number[];
  plannerIndexes: number[];
  inputTokens?: number;
  omitUsage?: boolean;
}): Pick<ModelAgentRuntime, 'invokeStructured'> {
  return createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'phase-695-test',
    liveCallsEnabled: true,
    timeoutMs: 4_500,
    executor: async ({ schema }) => {
      const review = { focusIndexes: input.reviewIndexes, diagnosis: 'review_pressure' };
      const object = schema.safeParse(review).success
        ? review
        : { blockOrder: input.plannerIndexes, strategy: 'protect_overdue' };
      return input.omitUsage
        ? { object }
        : { object, usage: { inputTokens: input.inputTokens ?? 40, outputTokens: 12 } };
    },
  });
}

function withMutatedBudget(
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
): Pick<ModelAgentRuntime, 'invokeStructured'> {
  return {
    async invokeStructured(request) {
      const result = await runtime.invokeStructured(request);
      return {
        ...result,
        budget: { ...result.budget, usedCalls: 2 },
      };
    },
  };
}

function withMissingUsage(
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
): Pick<ModelAgentRuntime, 'invokeStructured'> {
  return {
    async invokeStructured(request) {
      const result = await runtime.invokeStructured(request);
      return { ...result, usage: undefined } as never;
    },
  };
}
