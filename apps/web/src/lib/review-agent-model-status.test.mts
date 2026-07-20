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
      review: {
        attempted: true,
        disposition: 'candidate_applied',
        provenance: 'mock_candidate',
        degraded: false,
      },
      planner: {
        attempted: true,
        disposition: 'candidate_applied',
        provenance: 'mock_candidate',
        degraded: false,
      },
    }),
  ),
  'degraded',
);
assert.equal(
  getReviewPlannerModelStatus(
    observations({
      review: {
        attempted: true,
        disposition: 'candidate_applied',
        provenance: 'live_candidate',
        degraded: true,
      },
      planner: {
        attempted: true,
        disposition: 'candidate_applied',
        provenance: 'live_candidate',
        degraded: false,
      },
    }),
  ),
  'degraded',
);
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
  review: ModelObservationInput;
  planner: ModelObservationInput;
}): ReviewPlannerModelObservations {
  return {
    version: 1,
    review: observation(input.review),
    planner: observation(input.planner),
  };
}

type ModelObservationInput = {
  attempted: boolean;
  disposition: string;
  provenance?: 'local_deterministic' | 'mock_candidate' | 'live_candidate';
  degraded?: boolean;
};

function observation(input: ModelObservationInput) {
  return {
    attempted: input.attempted,
    disposition: input.disposition,
    durationMs: 0,
    usage: { inputTokens: 0, outputTokens: 0 },
    provenance:
      input.provenance ??
      (input.attempted ? 'live_candidate' : 'local_deterministic'),
    degraded: input.degraded ?? input.disposition !== 'candidate_applied',
    cached: false,
  } as ReviewPlannerModelObservations['review'];
}
