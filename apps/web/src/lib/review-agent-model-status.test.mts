import assert from 'node:assert/strict';

import type { ReviewPlannerModelObservations } from '@repo/types/api/review-agent';

import {
  getReviewPlannerModelStatus,
  reviewPlannerModelStatusLabels,
} from './review-agent-model-status.ts';

const allApplied = observations({
  review: { attempted: true, disposition: 'candidate_applied' },
  planner: { attempted: true, disposition: 'candidate_applied' },
});

assert.equal(getReviewPlannerModelStatus(undefined), null);
assert.equal(getReviewPlannerModelStatus(allApplied), 'applied');
assert.equal(
  getReviewPlannerModelStatus(
    observations({
      review: { attempted: true, disposition: 'candidate_applied' },
      planner: { attempted: true, disposition: 'fallback_timeout' },
    }),
  ),
  'degraded',
);
assert.equal(
  getReviewPlannerModelStatus(
    observations({
      review: { attempted: true, disposition: 'candidate_applied' },
      planner: { attempted: false, disposition: 'not_eligible' },
    }),
  ),
  null,
);
assert.equal(reviewPlannerModelStatusLabels.applied, '模型建议已应用');
assert.equal(
  reviewPlannerModelStatusLabels.degraded,
  '模型建议已降级，已保留基于学习数据的建议',
);

function observations(input: {
  review: { attempted: boolean; disposition: string };
  planner: { attempted: boolean; disposition: string };
}): ReviewPlannerModelObservations {
  return {
    version: 1,
    review: observation(input.review),
    planner: observation(input.planner),
  };
}

function observation(input: { attempted: boolean; disposition: string }) {
  return {
    attempted: input.attempted,
    disposition: input.disposition,
    durationMs: 0,
    usage: { inputTokens: 0, outputTokens: 0 },
    provenance: input.attempted ? 'live_candidate' : 'local_deterministic',
    degraded: input.disposition !== 'candidate_applied',
    cached: false,
  } as ReviewPlannerModelObservations['review'];
}
