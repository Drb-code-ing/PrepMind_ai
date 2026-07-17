import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PRICE_PROFILE_ID,
  REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE,
  REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE_ID,
  safeReviewPlannerControlledLiveV5DeepSeekSummarySchema,
} from './review-planner-controlled-live-eval-v5-deepseek.evidence';

describe('Review/Planner controlled Live V5 DeepSeek evidence', () => {
  it('uses a dedicated DeepSeek V4 Pro profile and CNY pricing identity', () => {
    expect(REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE_ID).toBe(
      'phase-6.9.5-review-planner-controlled-live-v5-deepseek-v4-pro',
    );
    expect(REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE).toEqual({
      id: REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE_ID,
      evidenceSchemaVersion:
        'phase-6.9.5-review-planner-controlled-live-evidence-v5-deepseek-v4-pro',
      evidenceDirectory:
        'docs/acceptance/evidence/phase-6-9-5-controlled-live-v5-deepseek-v4-pro',
      onceLockLeaf: '.review-planner-controlled-live-v5-deepseek-v4-pro.once',
    });
    expect(REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PRICE_PROFILE_ID).toBe(
      'deepseek-v4-pro-non-cached-cny-v1',
    );
  });

  it('accepts only the bounded safe complete/open aggregate', () => {
    const summary = {
      status: 'complete' as const,
      gate: 'open' as const,
      providerAttemptCount: 23,
      usageKnown: true,
      priceProfileId:
        REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PRICE_PROFILE_ID,
      currency: 'CNY' as const,
      aggregateInputTokens: 42_996,
      aggregateOutputTokens: 9_712,
      observedCostCny: 0.18726,
      hardCapCny: 1,
      withinHardCap: true,
      quality: {
        caseEntries: 48,
        zeroCallCases: 26,
        runtimeInvocations: 22,
        strictSuccesses: 22,
        qualityPasses: 22,
        criticalFailures: 0,
        p95DurationMs: 4_500,
        productionDecision: 'quality_gate_passed' as const,
      },
    };

    expect(
      safeReviewPlannerControlledLiveV5DeepSeekSummarySchema.parse(summary),
    ).toEqual(summary);
  });

  it('rejects cost/quality fields on closed evidence and rejects unsafe aggregate values', () => {
    expect(() =>
      safeReviewPlannerControlledLiveV5DeepSeekSummarySchema.parse({
        status: 'invalid_attempted',
        gate: 'closed',
        providerAttemptCount: 1,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
        currency: 'CNY',
      }),
    ).toThrow();

    expect(() =>
      safeReviewPlannerControlledLiveV5DeepSeekSummarySchema.parse({
        status: 'complete',
        gate: 'open',
        providerAttemptCount: 24,
        usageKnown: true,
        priceProfileId:
          REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PRICE_PROFILE_ID,
        currency: 'CNY',
        aggregateInputTokens: 42_996,
        aggregateOutputTokens: 9_712,
        observedCostCny: 0.18726,
        hardCapCny: 1,
        withinHardCap: true,
        quality: {
          caseEntries: 48,
          zeroCallCases: 26,
          runtimeInvocations: 22,
          strictSuccesses: 22,
          qualityPasses: 22,
          criticalFailures: 0,
          p95DurationMs: 4_500,
          productionDecision: 'quality_gate_passed',
        },
      }),
    ).toThrow();

    expect(() =>
      safeReviewPlannerControlledLiveV5DeepSeekSummarySchema.parse({
        status: 'complete',
        gate: 'open',
        providerAttemptCount: 23,
        usageKnown: true,
        priceProfileId:
          REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PRICE_PROFILE_ID,
        currency: 'CNY',
        aggregateInputTokens: 0,
        aggregateOutputTokens: 0,
        observedCostCny: 0,
        hardCapCny: 1,
        withinHardCap: true,
        quality: {
          caseEntries: 48,
          zeroCallCases: 26,
          runtimeInvocations: 22,
          strictSuccesses: 22,
          qualityPasses: 22,
          criticalFailures: 0,
          p95DurationMs: 4_500,
          productionDecision: 'quality_gate_passed',
        },
      }),
    ).toThrow();

    expect(() =>
      safeReviewPlannerControlledLiveV5DeepSeekSummarySchema.parse({
        status: 'complete',
        gate: 'open',
        providerAttemptCount: 23,
        usageKnown: true,
        priceProfileId:
          REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PRICE_PROFILE_ID,
        currency: 'CNY',
        aggregateInputTokens: 42_996,
        aggregateOutputTokens: 9_712,
        observedCostCny: 0,
        hardCapCny: 1,
        withinHardCap: true,
        quality: {
          caseEntries: 48,
          zeroCallCases: 26,
          runtimeInvocations: 22,
          strictSuccesses: 22,
          qualityPasses: 22,
          criticalFailures: 0,
          p95DurationMs: 4_500,
          productionDecision: 'quality_gate_passed',
        },
      }),
    ).toThrow();
  });
});
