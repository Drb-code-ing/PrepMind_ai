import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatPercent,
  getDailyReviewActivitySummary,
  getMaxDailyReviewCount,
  getRatingLabel,
  getStateLabel,
  shouldShowDailyReviewTick,
  shouldShowStatsEmptyState,
} from './review-stats-view.ts';

test('formats ratio values as percentages', () => {
  assert.equal(formatPercent(0), '0%');
  assert.equal(formatPercent(0.67), '67%');
  assert.equal(formatPercent(1), '100%');
});

test('returns max daily review count with a minimum of one', () => {
  assert.equal(getMaxDailyReviewCount([]), 1);
  assert.equal(getMaxDailyReviewCount([{ date: '2026-06-14', count: 3 }]), 3);
});

test('shows readable daily review ticks for short and long ranges', () => {
  assert.equal(shouldShowDailyReviewTick(0, 7), true);
  assert.equal(shouldShowDailyReviewTick(3, 7), true);
  assert.equal(shouldShowDailyReviewTick(6, 7), true);
  assert.equal(shouldShowDailyReviewTick(0, 30), true);
  assert.equal(shouldShowDailyReviewTick(1, 30), false);
  assert.equal(shouldShowDailyReviewTick(5, 30), true);
  assert.equal(shouldShowDailyReviewTick(29, 30), true);
});

test('summarizes daily review activity', () => {
  const result = getDailyReviewActivitySummary([
    { date: '2026-06-12', count: 0 },
    { date: '2026-06-13', count: 2 },
    { date: '2026-06-14', count: 1 },
  ]);

  assert.equal(result.activeDays, 2);
  assert.equal(result.totalCount, 3);
  assert.equal(result.maxCount, 2);
});

test('maps rating and card state labels', () => {
  assert.equal(getRatingLabel(1), '忘了');
  assert.equal(getRatingLabel(4), '轻松');
  assert.equal(getStateLabel('RELEARNING'), '重学中');
});

test('shows empty state when there are no reviews and no logs', () => {
  assert.equal(shouldShowStatsEmptyState(0, 0), true);
  assert.equal(shouldShowStatsEmptyState(1, 0), false);
});
