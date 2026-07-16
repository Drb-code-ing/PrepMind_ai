import { createReviewPlannerTrace } from './review-planner-trace';

describe('review planner trace', () => {
  it('stores fixed ordered orchestration steps without user facts or provider text', () => {
    const trace = createReviewPlannerTrace({
      runId: 'trace_run_1',
      startedAt: new Date('2026-07-16T00:00:00.000Z'),
      finishedAt: new Date('2026-07-16T00:00:00.100Z'),
      deterministicReviewDurationMs: 10,
      deterministicPlannerDurationMs: 20,
      review: localObservation(),
      planner: localObservation(),
    });

    expect(trace.steps.map((step) => step.node)).toEqual([
      'deterministic_review',
      'review_candidate',
      'deterministic_planner',
      'planner_candidate',
    ]);
    expect(JSON.stringify(trace)).not.toMatch(
      /prompt|fact|deepseek|api.?key|base.?url|raw.error|secret/i,
    );
  });
});

function localObservation() {
  return {
    attempted: false as const,
    disposition: 'not_eligible' as const,
    budget: {
      maxCalls: 2,
      usedCalls: 0,
      maxInputTokens: 1950,
      usedInputTokens: 0,
      maxOutputTokens: 440,
      usedOutputTokens: 0,
    },
    usage: { inputTokens: 0, outputTokens: 0 },
    reasonCodes: ['not_eligible'] as const,
  };
}
