import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE,
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES,
  safeReviewPlannerControlledLiveV8SummarySchema,
  serializeReviewPlannerControlledLiveV8Evidence,
} from './review-planner-controlled-live-eval-v8-stage-diagnostics.evidence';

describe('Phase 6.9.5 V8 durable stage evidence contract', () => {
  it('freezes the isolated V8 profile and all fifteen zero-byte stages', () => {
    expect(REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE).toEqual(
      {
        id: 'phase-6.9.5-review-planner-controlled-live-v8-deepseek-v4-pro-stage-diagnostics',
        evidenceSchemaVersion:
          'phase-6.9.5-review-planner-controlled-live-evidence-v8-stage-diagnostics',
        evidenceDirectory:
          'docs/acceptance/evidence/phase-6-9-5-controlled-live-v8-deepseek-v4-pro-stage-diagnostics',
        onceLockLeaf:
          '.review-planner-controlled-live-v8-deepseek-v4-pro-stage-diagnostics.once',
        successCommitLeaf:
          '.review-planner-controlled-live-v8-deepseek-v4-pro-stage-diagnostics.success',
      },
    );
    expect(REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES).toEqual([
      '.stage-010-reserved',
      '.stage-020-attempted',
      '.stage-030-evaluator-ready',
      '.stage-040-provider-history-verified',
      '.stage-050-canary-started',
      '.stage-060-canary-returned',
      '.stage-070-paired-started',
      '.stage-080-paired-returned',
      '.stage-090-report-validated',
      '.stage-100-finalization-started',
      '.stage-110-safe-provisional-written',
      '.stage-120-internal-history-verified',
      '.stage-130-terminal-record-written',
      '.stage-140-post-terminal-history-verified',
      '.stage-150-success-commit-started',
    ]);
  });

  it('accepts only strict bounded failure and complete summaries', () => {
    expect(
      safeReviewPlannerControlledLiveV8SummarySchema.safeParse({
        status: 'invalid_attempted',
        gate: 'closed',
        providerAttemptCount: 1,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
      }).success,
    ).toBe(true);
    expect(
      safeReviewPlannerControlledLiveV8SummarySchema.safeParse({
        status: 'complete',
        gate: 'closed',
        providerAttemptCount: 23,
        usageKnown: true,
        aggregateInputTokens: 42_996,
        aggregateOutputTokens: 9_712,
        observedCostCny: 0.18726,
        priceProfileId:
          REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
        caseEntries: 48,
        zeroCallCases: 26,
        runtimeInvocations: 22,
        strictSuccesses: 48,
        qualityPasses: 48,
        criticalFailures: 0,
      }).success,
    ).toBe(true);
    expect(
      safeReviewPlannerControlledLiveV8SummarySchema.safeParse({
        status: 'complete',
        gate: 'closed',
        providerAttemptCount: 23,
        usageKnown: true,
        prompt: 'forbidden',
      }).success,
    ).toBe(false);
  });

  it('serializes only strict failure fields and rejects secret-shaped additions', () => {
    const serialized = serializeReviewPlannerControlledLiveV8Evidence({
      state: 'finalized',
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 23,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    });
    expect(JSON.parse(serialized)).toEqual({
      schemaVersion:
        REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.evidenceSchemaVersion,
      state: 'finalized',
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 23,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    });
    expect(() =>
      serializeReviewPlannerControlledLiveV8Evidence({
        state: 'finalized',
        status: 'invalid_attempted',
        gate: 'closed',
        providerAttemptCount: 0,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
        rawError: 'forbidden',
      }),
    ).toThrow();
  });
});
