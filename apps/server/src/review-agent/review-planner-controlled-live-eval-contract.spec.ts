import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import { serializeReviewPlannerControlledLiveSummary } from './review-planner-controlled-live-eval-cli';
import { safeReviewPlannerControlledLiveSummarySchema } from './review-planner-controlled-live-eval-evidence';

describe('review planner controlled Live safe summary contract', () => {
  it('rejects raw summary or evidence extras and serializes only the fixed diagnostic fields', () => {
    const rawSummary = 'CONTROLLED_LIVE_RAW_SUMMARY_CANARY';
    const rawEvidence = 'CONTROLLED_LIVE_RAW_EVIDENCE_CANARY';
    const safeSummary = {
      status: 'invalid_attempted' as const,
      gate: 'closed' as const,
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
    };

    expect(() =>
      safeReviewPlannerControlledLiveSummarySchema.parse({
        ...safeSummary,
        summary: rawSummary,
      }),
    ).toThrow();
    expect(() =>
      safeReviewPlannerControlledLiveSummarySchema.parse({
        ...safeSummary,
        evidence: rawEvidence,
      }),
    ).toThrow();
    expect(() =>
      safeReviewPlannerControlledLiveSummarySchema.parse({
        ...safeSummary,
        diagnosticCode: 'provider_json_parse',
      }),
    ).toThrow();

    const serialized = serializeReviewPlannerControlledLiveSummary(safeSummary);
    expect(JSON.parse(serialized)).toEqual(safeSummary);
    expect(serialized).not.toMatch(
      /CONTROLLED_LIVE_RAW_(SUMMARY|EVIDENCE)_CANARY/,
    );
  });
});
