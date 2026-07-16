import { toReviewPlannerModelObservations } from './review-planner-model-observation';

describe('review planner model observations', () => {
  it('projects an attempted fallback without prompts, facts, provider text, keys, base URLs, or raw errors', () => {
    const observations = toReviewPlannerModelObservations({
      review: {
        attempted: true,
        disposition: 'fallback_schema_invalid',
        budget: {
          maxCalls: 2,
          usedCalls: 1,
          maxInputTokens: 1950,
          usedInputTokens: 900,
          maxOutputTokens: 440,
          usedOutputTokens: 220,
        },
        usage: { inputTokens: 31, outputTokens: 0 },
        reasonCodes: ['fallback_schema_invalid', 'SCHEMA_INVALID'],
        trace: {
          runIdHash: 'sha256:runtime',
          task: 'review_suggestion',
          mode: 'live',
          provider: 'deepseek',
          model: 'deepseek-v4-flash',
          status: 'failed',
          inputTokens: 31,
          outputTokens: 0,
          maxOutputTokens: 220,
          durationMs: 41,
          degraded: true,
          errorCode: 'SCHEMA_INVALID',
        },
      },
      planner: {
        attempted: false,
        disposition: 'not_eligible',
        budget: {
          maxCalls: 2,
          usedCalls: 1,
          maxInputTokens: 1950,
          usedInputTokens: 900,
          maxOutputTokens: 440,
          usedOutputTokens: 220,
        },
        usage: { inputTokens: 0, outputTokens: 0 },
        reasonCodes: ['not_eligible'],
      },
    });

    expect(observations).toEqual({
      version: 1,
      review: {
        attempted: true,
        disposition: 'fallback_schema_invalid',
        durationMs: 41,
        usage: { inputTokens: 31, outputTokens: 0 },
        errorCode: 'SCHEMA_INVALID',
        provenance: 'live_candidate',
        degraded: true,
        cached: false,
      },
      planner: {
        attempted: false,
        disposition: 'not_eligible',
        durationMs: 0,
        usage: { inputTokens: 0, outputTokens: 0 },
        provenance: 'local_deterministic',
        degraded: true,
        cached: false,
      },
    });
    expect(JSON.stringify(observations)).not.toMatch(
      /prompt|fact|provider|deepseek|key|base.?url|raw|runtime/i,
    );
  });
});
