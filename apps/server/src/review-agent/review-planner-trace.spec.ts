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

  it('uses the shared governed pricing table for a metered live candidate trace', () => {
    const trace = createReviewPlannerTrace({
      runId: 'trace_live_cost_1',
      startedAt: new Date('2026-07-17T00:00:00.000Z'),
      finishedAt: new Date('2026-07-17T00:00:00.100Z'),
      deterministicReviewDurationMs: 10,
      deterministicPlannerDurationMs: 20,
      review: liveObservation(),
      planner: localObservation(),
    });

    expect(trace.pricingKnown).toBe(true);
    expect(trace.costEstimate).toBeGreaterThan(0);
    expect(trace.inputTokenEstimate).toBe(1000);
    expect(trace.outputTokenEstimate).toBe(1000);
  });

  it('does not present zero live usage as known zero cost', () => {
    const trace = createReviewPlannerTrace({
      runId: 'trace_unverifiable_cost_1',
      startedAt: new Date('2026-07-17T00:00:00.000Z'),
      finishedAt: new Date('2026-07-17T00:00:00.100Z'),
      deterministicReviewDurationMs: 10,
      deterministicPlannerDurationMs: 20,
      review: liveObservation({ inputTokens: 0, outputTokens: 0 }),
      planner: localObservation(),
    });

    expect(trace.pricingKnown).toBe(false);
    expect(trace.costEstimate).toBe(0);
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

function liveObservation(
  usage: { inputTokens: number; outputTokens: number } = {
    inputTokens: 1000,
    outputTokens: 1000,
  },
) {
  return {
    attempted: true as const,
    disposition: 'candidate_applied' as const,
    budget: {
      maxCalls: 2,
      usedCalls: 1,
      maxInputTokens: 1950,
      usedInputTokens: 1000,
      maxOutputTokens: 440,
      usedOutputTokens: 220,
    },
    usage,
    reasonCodes: ['candidate_applied', 'review_pressure'] as const,
    trace: {
      runIdHash: `sha256:${'a'.repeat(64)}`,
      task: 'review_suggestion' as const,
      mode: 'live' as const,
      provider: 'deepseek' as const,
      model: 'deepseek-v4-flash',
      status: 'succeeded' as const,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      maxOutputTokens: 220,
      durationMs: 20,
      degraded: false,
    },
  };
}
