import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  executeReviewPlannerControlledLiveV3Cli,
  serializeReviewPlannerControlledLiveSummary,
  serializeReviewPlannerControlledLiveV3Summary,
} from './review-planner-controlled-live-eval-cli';
import {
  safeReviewPlannerControlledLiveSummarySchema,
  safeReviewPlannerControlledLiveV1SummarySchema,
  safeReviewPlannerControlledLiveV2SummarySchema,
  safeReviewPlannerControlledLiveV3SummarySchema,
} from './review-planner-controlled-live-eval-evidence';

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

  it('serializes the v3 stage only for the exact safe failed tuple', () => {
    const summary = {
      status: 'invalid_attempted' as const,
      gate: 'closed' as const,
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
      structuredOutputStage: 'provider_object_missing' as const,
    };

    expect(
      JSON.parse(serializeReviewPlannerControlledLiveV3Summary(summary)),
    ).toEqual(summary);
    expect(() =>
      serializeReviewPlannerControlledLiveV3Summary({
        ...summary,
        status: 'complete',
      }),
    ).toThrow();
    expect(() =>
      serializeReviewPlannerControlledLiveSummary(summary),
    ).toThrow();
  });

  it('blocks a non-v3 confirmation before reservation or executor construction', async () => {
    const reserveEvidence = jest.fn();
    const createExecutor = jest.fn();

    await expect(
      executeReviewPlannerControlledLiveV3Cli({
        argv: ['--confirm-controlled-live'],
        env: {
          AI_PROVIDER_MODE: 'live',
          AI_ENABLE_LIVE_CALLS: 'true',
          REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'true',
          REVIEW_AGENT_MODEL_ENABLED: 'false',
          PLANNER_AGENT_MODEL_ENABLED: 'false',
        },
        root: 'never-opened-for-invalid-v3-confirmation',
        dependencies: { createExecutor },
        reserveEvidence,
      }),
    ).resolves.toEqual({
      status: 'diagnostic_blocked',
      gate: 'closed',
      providerAttemptCount: 0,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
    expect(reserveEvidence).not.toHaveBeenCalled();
    expect(createExecutor).not.toHaveBeenCalled();
  });
});

describe('review planner controlled Live v3 safe summary contract', () => {
  const structuredOutputFailure = {
    status: 'invalid_attempted' as const,
    gate: 'closed' as const,
    providerAttemptCount: 1,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
  };

  it('keeps the static structured-output stage exclusive to the v3 failed tuple', () => {
    const withStage = {
      ...structuredOutputFailure,
      structuredOutputStage: 'provider_type_validation' as const,
    };

    expect(() =>
      safeReviewPlannerControlledLiveV1SummarySchema.parse(withStage),
    ).toThrow();
    expect(() =>
      safeReviewPlannerControlledLiveV2SummarySchema.parse(withStage),
    ).toThrow();
    expect(
      safeReviewPlannerControlledLiveV3SummarySchema.parse(withStage),
    ).toEqual(withStage);

    expect(() =>
      safeReviewPlannerControlledLiveV3SummarySchema.parse({
        ...withStage,
        status: 'complete',
      }),
    ).toThrow();
    expect(() =>
      safeReviewPlannerControlledLiveV3SummarySchema.parse({
        ...withStage,
        usageKnown: true,
      }),
    ).toThrow();
    expect(() =>
      safeReviewPlannerControlledLiveV3SummarySchema.parse({
        ...withStage,
        structuredOutputStage: 'provider_json_parse_canary',
      }),
    ).toThrow();
  });
});
