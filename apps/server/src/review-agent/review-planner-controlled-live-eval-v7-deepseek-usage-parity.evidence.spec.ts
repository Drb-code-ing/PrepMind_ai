import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PRICE_PROFILE_ID,
  REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE,
  REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE_ID,
  safeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceSchema,
  safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema,
  serializeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence,
} from './review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence';

describe('Review/Planner controlled Live V7 usage-parity evidence', () => {
  it('uses the isolated V7 identity and strict complete aggregate', () => {
    expect(
      REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE_ID,
    ).toBe(
      'phase-6.9.5-review-planner-controlled-live-v7-deepseek-v4-pro-usage-parity',
    );
    expect(
      REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE,
    ).toEqual({
      id: REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE_ID,
      evidenceSchemaVersion:
        'phase-6.9.5-review-planner-controlled-live-evidence-v7-deepseek-v4-pro-usage-parity',
      evidenceDirectory:
        'docs/acceptance/evidence/phase-6-9-5-controlled-live-v7-deepseek-v4-pro-usage-parity',
      onceLockLeaf:
        '.review-planner-controlled-live-v7-deepseek-v4-pro-usage-parity.once',
      successCommitLeaf:
        '.review-planner-controlled-live-v7-deepseek-v4-pro-usage-parity.success',
    });
    expect(
      safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.parse(
        completeSummary(),
      ),
    ).toEqual(completeSummary());
  });

  it('allows aggregate token and cost fields only on complete summaries', () => {
    const failed = failedSummary();
    expect(
      safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.parse(
        failed,
      ),
    ).toEqual(failed);
    for (const extra of [
      { aggregateInputTokens: 1 },
      { aggregateOutputTokens: 1 },
      { observedCostCny: 0.01 },
      {
        priceProfileId:
          REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PRICE_PROFILE_ID,
      },
    ]) {
      expect(() =>
        safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.parse(
          {
            ...failed,
            ...extra,
          },
        ),
      ).toThrow();
    }
  });

  it('enforces fixed complete counters, positive bounded aggregate, and CNY cost', () => {
    for (const invalid of [
      { providerAttemptCount: 22 },
      { aggregateInputTokens: 42_997 },
      { aggregateOutputTokens: 9_713 },
      { observedCostCny: 1.01 },
      { caseEntries: 47 },
      { criticalFailures: 1 },
      { unknown: true },
    ]) {
      expect(() =>
        safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.parse(
          {
            ...completeSummary(),
            ...invalid,
          },
        ),
      ).toThrow();
    }
  });

  it('serializes strict reserved, attempted, and failure-finalized records', () => {
    const reserved =
      serializeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence(
        'reserved',
        blockedSummary(),
      );
    const attempted =
      serializeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence(
        'attempted',
        failedSummary(),
      );
    const finalized =
      serializeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence(
        'finalized',
        failedSummary(),
      );

    for (const value of [reserved, attempted, finalized]) {
      expect(
        safeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceSchema.parse(
          JSON.parse(value),
        ),
      ).toBeDefined();
    }
    expect(JSON.parse(finalized)).toMatchObject({
      state: 'finalized',
      status: 'invalid_attempted',
      gate: 'closed',
    });
    expect(() =>
      serializeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence(
        'finalized',
        completeSummary(),
      ),
    ).toThrow();
  });

  it('rejects sensitive or content-bearing fields from every strict record', () => {
    const sentinels = [
      'prompt',
      'response',
      'tokenDetail',
      'apiKey',
      'url',
      'header',
      'stack',
      'rawError',
    ];
    for (const field of sentinels) {
      expect(() =>
        safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.parse(
          {
            ...failedSummary(),
            [field]: 'V7_PRIVATE_SENTINEL',
          },
        ),
      ).toThrow();
    }
    expect(
      serializeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence(
        'finalized',
        failedSummary(),
      ),
    ).not.toMatch(
      /prompt|response|token.?detail|api.?key|url|header|stack|raw.?error|authorization|cookie|bearer|password|secret/i,
    );
    for (const extra of [
      { aggregateInputTokens: 1 },
      { aggregateOutputTokens: 1 },
      { observedCostCny: 0.01 },
      {
        priceProfileId:
          REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PRICE_PROFILE_ID,
      },
    ]) {
      expect(
        safeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceSchema.safeParse(
          {
            schemaVersion:
              REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.evidenceSchemaVersion,
            state: 'finalized',
            ...failedSummary(),
            ...extra,
          },
        ).success,
      ).toBe(false);
    }
  });
});

function blockedSummary() {
  return {
    status: 'diagnostic_blocked' as const,
    gate: 'closed' as const,
    providerAttemptCount: 0,
    usageKnown: false as const,
    diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
  };
}

function failedSummary() {
  return {
    status: 'invalid_attempted' as const,
    gate: 'closed' as const,
    providerAttemptCount: 1,
    usageKnown: false as const,
    diagnosticCode: 'provider_usage_missing' as const,
  };
}

function completeSummary() {
  return {
    status: 'complete' as const,
    gate: 'eligible_for_separate_product_acceptance' as const,
    providerAttemptCount: 23,
    usageKnown: true as const,
    aggregateInputTokens: 42_996,
    aggregateOutputTokens: 9_712,
    observedCostCny: 0.18726,
    priceProfileId:
      REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PRICE_PROFILE_ID,
    caseEntries: 48,
    zeroCallCases: 26,
    runtimeInvocations: 22,
    strictSuccesses: 48,
    qualityPasses: 48,
    criticalFailures: 0,
  };
}
