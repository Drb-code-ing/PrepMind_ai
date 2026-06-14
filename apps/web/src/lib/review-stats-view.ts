import type { ReviewCardState, ReviewRating } from '@repo/types/api/review';

export function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

export function getMaxDailyReviewCount(items: Array<{ count: number }>) {
  return Math.max(1, ...items.map((item) => item.count));
}

export function getRatingLabel(rating: ReviewRating) {
  const labels: Record<ReviewRating, string> = {
    1: '忘了',
    2: '吃力',
    3: '掌握',
    4: '轻松',
  };
  return labels[rating];
}

export function getStateLabel(state: ReviewCardState) {
  const labels: Record<ReviewCardState, string> = {
    NEW: '新卡',
    LEARNING: '学习中',
    REVIEW: '复习中',
    RELEARNING: '重学中',
  };
  return labels[state];
}

export function shouldShowStatsEmptyState(totalReviews: number, logTotal: number) {
  return totalReviews === 0 && logTotal === 0;
}
