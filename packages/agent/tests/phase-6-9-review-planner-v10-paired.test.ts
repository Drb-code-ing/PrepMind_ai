import { describe, expect, test } from 'bun:test';

import { createModelAgentRuntime } from '@repo/ai';

import {
  PHASE_695_V10_REVIEW_PLANNER_DATASET_VERSION,
  derivePhase695V10FixtureDecision,
  derivePhase695V10MockDecision,
  getPhase695V10CaseFixture,
  phase695V10ReviewPlannerCases,
} from '../src/evals/phase-6-9-review-planner-v10-cases.ts';
import { runPhase695V10ReviewPlannerPaired } from '../src/evals/run-phase-6-9-review-planner-v10-paired.ts';

describe('phase 6.9 Review Planner V10 paired runner', () => {
  test('freezes a visible-policy dataset without rewriting the V2 history', () => {
    expect(PHASE_695_V10_REVIEW_PLANNER_DATASET_VERSION).toBe(
      'phase-6.9-review-planner-v3',
    );
    expect(phase695V10ReviewPlannerCases).toHaveLength(48);
    expect(
      phase695V10ReviewPlannerCases.filter(
        (testCase) => testCase.executionKind === 'zero_call',
      ),
    ).toHaveLength(26);

    for (const testCase of phase695V10ReviewPlannerCases.filter(
      (testCase) => testCase.executionKind === 'runtime',
    )) {
      const fixture = getPhase695V10CaseFixture(testCase.id);
      expect(fixture).not.toBeNull();
      expect(derivePhase695V10FixtureDecision(fixture!)).toEqual(
        fixture!.expected,
      );
      expect(derivePhase695V10MockDecision(fixture!)).toEqual(
        fixture!.expected,
      );
    }
  });

  test('derives Mock decisions from fixture-visible options and publishes lane totals', async () => {
    const report = await runPhase695V10ReviewPlannerPaired({ mode: 'mock' });

    expect(report.productionDecision).toBe('mock_quality_not_evidence');
    expect(report.caseEntries).toHaveLength(48);
    expect(report.aggregate).toEqual({
      review: {
        caseEntries: 24,
        runtimeCases: 11,
        zeroCallCases: 13,
        strictSuccesses: 24,
        qualityPasses: 24,
        criticalFailures: 0,
      },
      planner: {
        caseEntries: 24,
        runtimeCases: 11,
        zeroCallCases: 13,
        strictSuccesses: 24,
        qualityPasses: 24,
        criticalFailures: 0,
      },
    });
  });

  test('rejects structurally valid model choices that violate the visible policy', async () => {
    const runtime = createModelAgentRuntime({
      mode: 'live',
      provider: 'deepseek',
      model: 'v10-policy-negative-test',
      liveCallsEnabled: true,
      timeoutMs: 4_500,
      executor: async ({ schema, userPrompt }) => {
        const options = JSON.parse(userPrompt).options as unknown[];
        const review = { focusIndexes: [0] };
        const planner = { blockOrder: options.map((_, index) => index) };
        return {
          object: schema.safeParse(review).success ? review : planner,
          usage: { inputTokens: 40, outputTokens: 12 },
        };
      },
    });

    const report = await runPhase695V10ReviewPlannerPaired({
      mode: 'live',
      live: { runtime, now: () => 0 },
    });

    expect(report.productionDecision).toBe('semantic_quality_below_threshold');
    expect(report.aggregate.review.qualityPasses).toBeLessThan(24);
  });
});
