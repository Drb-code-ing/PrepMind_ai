import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_CONFIRMATION,
  runReviewPlannerControlledLiveV10SemanticQualityCli,
} from './review-planner-controlled-live-eval-v10-semantic-quality.cli';

describe('Review Planner controlled Live V10 semantic quality CLI', () => {
  it('requires the isolated one-shot confirmation before constructing any capability', async () => {
    const validatePreflight = jest.fn();
    const summary = await runReviewPlannerControlledLiveV10SemanticQualityCli(
      {
        argv: ['--confirm-controlled-live-v9-deepseek-v4-pro-gate-diagnostics'],
        env: {},
        root: 'E:\\PrepMind',
        now: () => 0,
        runId: 'v10-cli-test',
      },
      { validatePreflight } as never,
    );

    expect(
      REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_CONFIRMATION,
    ).toBe('--confirm-controlled-live-v10-deepseek-v4-pro-semantic-quality');
    expect(summary).toEqual({
      status: 'diagnostic_blocked',
      gate: 'closed',
      providerAttemptCount: 0,
      pairedAdmissionCount: 0,
      usageKnown: false,
      diagnosticCode: 'preflight_invalid',
    });
    expect(validatePreflight).not.toHaveBeenCalled();
  });
});
