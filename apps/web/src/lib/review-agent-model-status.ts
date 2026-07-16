import type { ReviewPlannerModelObservations } from '@repo/types/api/review-agent';

export type ReviewPlannerModelStatus = 'applied' | 'degraded';

export const reviewPlannerModelStatusLabels: Readonly<
  Record<ReviewPlannerModelStatus, string>
> = Object.freeze({
  applied: '模型建议已应用',
  degraded: '模型建议已降级，已保留基于学习数据的建议',
});

export function getReviewPlannerModelStatus(
  observations: ReviewPlannerModelObservations | undefined,
): ReviewPlannerModelStatus | null {
  if (!observations) return null;

  const candidates = [observations.review, observations.planner];
  if (candidates.some(isAttemptedFallback)) return 'degraded';
  if (candidates.every(isApplied)) return 'applied';
  return null;
}

function isAttemptedFallback(
  observation: ReviewPlannerModelObservations['review'],
) {
  return observation.attempted === true && !isApplied(observation);
}

function isApplied(observation: ReviewPlannerModelObservations['review']) {
  return (
    observation.attempted === true &&
    observation.disposition === 'candidate_applied' &&
    observation.provenance === 'live_candidate' &&
    observation.degraded === false
  );
}
