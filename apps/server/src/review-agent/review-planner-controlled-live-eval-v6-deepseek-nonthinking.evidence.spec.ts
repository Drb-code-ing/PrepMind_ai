import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PRICE_PROFILE_ID,
  REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE,
  REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE_ID,
  safeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceSchema,
  safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema,
  serializeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence,
} from './review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence';

describe('Review/Planner controlled Live V6 non-thinking evidence', () => {
  it('uses an isolated V6 profile and accepts only the fixed safe complete aggregate', () => {
    expect(REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE_ID).toBe(
      'phase-6.9.5-review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking',
    );
    expect(REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE).toEqual({
      id: REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE_ID,
      evidenceSchemaVersion:
        'phase-6.9.5-review-planner-controlled-live-evidence-v6-deepseek-v4-pro-nonthinking',
      evidenceDirectory:
        'docs/acceptance/evidence/phase-6-9-5-controlled-live-v6-deepseek-v4-pro-nonthinking',
      onceLockLeaf:
        '.review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking.once',
    });

    expect(
      safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse(
        completeSummary(),
      ),
    ).toEqual(completeSummary());
  });

  it('allows only a bounded safe audit aggregate on a thinking-not-disabled closure', () => {
    const closed = {
      status: 'invalid_attempted' as const,
      gate: 'closed' as const,
      providerAttemptCount: 1,
      usageKnown: false as const,
      diagnosticCode: 'thinking_not_disabled' as const,
      nonThinkingAudit: {
        reasoning: 'reported_positive' as const,
        reasoningContentPresent: true,
        reportedReasoningTokens: 1,
      },
    };

    expect(
      safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse(
        closed,
      ),
    ).toEqual(closed);
    expect(() =>
      safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse({
        ...closed,
        nonThinkingAudit: {
          reasoning: 'reported_positive',
          reasoningContentPresent: true,
          reportedReasoningTokens: -1,
        },
      }),
    ).toThrow();
    expect(() =>
      safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse({
        status: 'invalid_attempted',
        gate: 'closed',
        providerAttemptCount: 1,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
        nonThinkingAudit: closed.nonThinkingAudit,
      }),
    ).toThrow();
  });

  it('serializes strict reserved, attempted, and finalized records without legacy-sensitive text', () => {
    const serialized = serializeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence(
      'finalized',
      completeSummary(),
    );
    expect(
      safeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceSchema.parse(
        JSON.parse(serialized),
      ),
    ).toMatchObject({ state: 'finalized', status: 'complete' });
    expect(serialized).not.toMatch(
      /prompt|candidate|api[_-]?key|authorization|cookie|stack|bearer|-----begin|password|secret|endpoint|header|raw[_-]?output|error/i,
    );
  });

  it('rejects complete data with any unbounded, non-fixed, or unsafe field', () => {
    expect(() =>
      safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse({
        ...completeSummary(),
        providerAttemptCount: 22,
      }),
    ).toThrow();
    expect(() =>
      safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse({
        ...completeSummary(),
        quality: { ...completeSummary().quality, strictSuccesses: 22 },
      }),
    ).toThrow();
    expect(() =>
      safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse({
        ...completeSummary(),
        nonThinkingAudit: {
          reasoning: 'reported_positive',
          reasoningContentPresent: true,
          reportedReasoningTokens: 1,
        },
      }),
    ).toThrow();
  });
});

function completeSummary() {
  return {
    status: 'complete' as const,
    gate: 'open' as const,
    providerAttemptCount: 23,
    usageKnown: true as const,
    priceProfileId:
      REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PRICE_PROFILE_ID,
    currency: 'CNY' as const,
    aggregateInputTokens: 42_996,
    aggregateOutputTokens: 9_712,
    observedCostCny: 0.18726,
    hardCapCny: 1,
    withinHardCap: true as const,
    quality: {
      caseEntries: 48,
      zeroCallCases: 26,
      runtimeInvocations: 22,
      strictSuccesses: 48,
      qualityPasses: 48,
      criticalFailures: 0,
      p95DurationMs: 4_500,
      productionDecision: 'quality_gate_passed' as const,
    },
    nonThinkingAudit: {
      reasoning: 'not_reported' as const,
      reasoningContentPresent: false,
    },
  };
}
