import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatPercent,
  getMaxDailyReviewCount,
  getRatingLabel,
  getStateLabel,
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

test('maps rating and card state labels', () => {
  assert.equal(getRatingLabel(1), '忘了');
  assert.equal(getRatingLabel(4), '轻松');
  assert.equal(getStateLabel('RELEARNING'), '重学中');
});

test('shows empty state when there are no reviews and no logs', () => {
  assert.equal(shouldShowStatsEmptyState(0, 0), true);
  assert.equal(shouldShowStatsEmptyState(1, 0), false);
});
