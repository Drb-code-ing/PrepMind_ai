import { describe, expect, test } from 'bun:test';

import {
  createModelAgentRuntime,
  reserveModelAgentBudget,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  runPhase695ReviewPlannerPaired,
  type Phase695LiveDependencies,
} from '../src/evals/run-phase-6-9-review-planner-paired.ts';
import { getPhase695CaseFixture } from '../src/evals/phase-6-9-review-planner-cases.ts';

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
    const zeroCallEntries = report.caseEntries.filter(
      (entry) => entry.executionKind === 'zero_call',
    );
    expect(zeroCallEntries).toHaveLength(26);
    expect(
      zeroCallEntries.every(
        (entry) => entry.zeroCallVerified === true,
      ),
    ).toBe(true);
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
        runtime: controlledRuntime({ reviewIndexes: [1], plannerIndexes: [1, 0], matchFixtures: true }),
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

  test('records a schema-invalid attempted runtime call instead of recasting it as zero-call', async () => {
    const report = await runPhase695ReviewPlannerPaired({
      mode: 'live',
      live: { runtime: controlledRuntime({ reviewIndexes: [1], plannerIndexes: [1, 0], invalidObject: true }), now: () => 0 },
    });

    const runtimeEntries = report.caseEntries.filter((entry) => entry.executionKind === 'runtime');
    expect(runtimeEntries.every((entry) => entry.runtimeInvocations === 1)).toBe(true);
    expect(runtimeEntries.every((entry) => entry.strictSuccess === false)).toBe(true);
    expect(runtimeEntries.every((entry) =>
      entry.usage.inputTokens === 0 && entry.usage.outputTokens === 0 &&
      entry.diagnosticCode === 'structured_output',
    )).toBe(true);
    expect(report.counters).toMatchObject({
      runtimeInvocations: 22,
      inputTokens: 0,
      outputTokens: 0,
    });
  });

  test('forces an abort-ignoring runtime to settle at the 4500ms runner timeout', async () => {
    let triggerTimeout: (() => void) | undefined;
    const report = await runPhase695ReviewPlannerPaired({
      mode: 'live',
      live: {
        runtime: {
          async invokeStructured() {
            triggerTimeout?.();
            return new Promise<never>(() => undefined);
          },
        },
        now: () => 0,
        setTimeout(callback) {
          triggerTimeout = callback;
          return 1;
        },
        clearTimeout() {},
      },
    });

    expect(report.productionDecision).not.toBe('quality_gate_passed');
    expect(report.counters.runtimeInvocations).toBe(22);
  }, 1_000);

  test('fails closed when timer setup or cleanup throws', async () => {
    const setupFailure = await runPhase695ReviewPlannerPaired({
      mode: 'live',
      live: {
        runtime: controlledRuntime({ reviewIndexes: [1], plannerIndexes: [1, 0], matchFixtures: true }),
        now: () => 0,
        setTimeout() { throw new Error('timer setup failure'); },
      },
    });
    const cleanupFailure = await runPhase695ReviewPlannerPaired({
      mode: 'live',
      live: {
        runtime: controlledRuntime({ reviewIndexes: [1], plannerIndexes: [1, 0] }),
        now: () => 0,
        clearTimeout() { throw new Error('timer cleanup failure'); },
      },
    });

    expect(setupFailure.productionDecision).not.toBe('quality_gate_passed');
    expect(cleanupFailure.productionDecision).not.toBe('quality_gate_passed');
  });

  test('cleans each completed runtime timer once without manufacturing a cleanup failure', async () => {
    const clearedHandles = new Set<number>();
    let nextHandle = 0;
    let clearAttempts = 0;
    const report = await runPhase695ReviewPlannerPaired({
      mode: 'live',
      live: {
        runtime: controlledRuntime({ reviewIndexes: [1], plannerIndexes: [1, 0], matchFixtures: true }),
        now: () => 0,
        setTimeout() { return nextHandle++; },
        clearTimeout(handle) {
          clearAttempts += 1;
          if (typeof handle !== 'number' || clearedHandles.has(handle)) {
            throw new Error('timer cleared more than once');
          }
          clearedHandles.add(handle);
        },
      },
    });

    expect(clearedHandles.size).toBe(22);
    expect(clearAttempts).toBe(22);
    expect(report.productionDecision).toBe('quality_gate_passed');
  });

  test('rejects a type-correct controlled runtime with a forged trace run identity', async () => {
    const report = await runPhase695ReviewPlannerPaired({
      mode: 'live',
      live: { runtime: forgedButTypeCorrectRuntime(), now: () => 0 },
    });

    expect(report.productionDecision).not.toBe('quality_gate_passed');
    expect(report.caseEntries.filter((entry) => entry.executionKind === 'runtime')
      .every((entry) => entry.strictSuccess === false)).toBe(true);
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
  invalidObject?: boolean;
  matchFixtures?: boolean;
}): Pick<ModelAgentRuntime, 'invokeStructured'> {
  return createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'phase-695-test',
    liveCallsEnabled: true,
    timeoutMs: 4_500,
    executor: async ({ schema, userPrompt }) => {
      const fixtureIdentity = /synthetic-(review|plan)-(\d+)-a/.exec(userPrompt);
      const fixture = input.matchFixtures && fixtureIdentity
        ? getPhase695CaseFixture(
            `${fixtureIdentity[1] === 'plan' ? 'planner' : 'review'}_${fixtureIdentity[2]}`,
          )
        : null;
      const review = fixture?.lane === 'review'
        ? fixture.expected
        : { focusIndexes: input.reviewIndexes, diagnosis: 'review_pressure' };
      const planner = fixture?.lane === 'planner'
        ? fixture.expected
        : { blockOrder: input.plannerIndexes, strategy: 'protect_overdue' };
      const object = input.invalidObject
        ? { invalid: true }
        : fixture?.expected ?? (schema.safeParse(review).success ? review : planner);
      return input.omitUsage
        ? { object }
        : { object, usage: { inputTokens: input.inputTokens ?? 40, outputTokens: 12 } };
    },
  });
}

function forgedButTypeCorrectRuntime(): Pick<ModelAgentRuntime, 'invokeStructured'> {
  return {
    async invokeStructured<T>(request: ModelAgentRequest<T>) {
      const reservation = reserveModelAgentBudget(request.budget, {
        inputTokens: request.estimatedInputTokens,
        outputTokens: request.maxOutputTokens,
      });
      if (!reservation.ok) throw new Error('fixture budget must reserve');
      const data = request.task === 'review_suggestion'
        ? { focusIndexes: [1], diagnosis: 'review_pressure' }
        : { blockOrder: [1, 0], strategy: 'protect_overdue' };
      return {
        ok: true as const,
        data: data as T,
        budget: reservation.budget,
        usage: { inputTokens: 40, outputTokens: 12 },
        trace: {
          runIdHash: `sha256:${'0'.repeat(64)}`,
          task: request.task,
          mode: 'live' as const,
          provider: 'deepseek' as const,
          model: 'phase-695-forged',
          status: 'succeeded' as const,
          inputTokens: 40,
          outputTokens: 12,
          maxOutputTokens: request.maxOutputTokens,
          durationMs: 0,
          degraded: false,
        },
      };
    },
  };
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
