import assert from 'node:assert/strict';

import {
  getReviewRatingLabel,
  getReviewTaskStatusFeedback,
  groupReviewTasksByStatus,
  mergeLocalPendingRatings,
} from './review-task-view.ts';

function run() {
  testGroupsReviewTasksByStatus();
  testReturnsFeedbackForSkipAndReopen();
  testReturnsReviewRatingLabels();
  testMergesLocalPendingRatingsForPendingTasksOnly();
}

function testGroupsReviewTasksByStatus() {
  const result = groupReviewTasksByStatus([
    { id: 'a', status: 'PENDING' },
    { id: 'b', status: 'COMPLETED' },
    { id: 'c', status: 'SKIPPED' },
  ]);

  assert.equal(result.pending[0]?.id, 'a');
  assert.equal(result.completed[0]?.id, 'b');
  assert.equal(result.skipped[0]?.id, 'c');
}

function testReturnsFeedbackForSkipAndReopen() {
  assert.equal(getReviewTaskStatusFeedback('skip').tone, 'neutral');
  assert.equal(getReviewTaskStatusFeedback('reopen').tone, 'success');
}

function testReturnsReviewRatingLabels() {
  assert.equal(getReviewRatingLabel(1), '忘了');
  assert.equal(getReviewRatingLabel(2), '吃力');
  assert.equal(getReviewRatingLabel(3), '掌握');
  assert.equal(getReviewRatingLabel(4), '轻松');
}

function testMergesLocalPendingRatingsForPendingTasksOnly() {
  const pendingTask = { id: 'pending_1', status: 'PENDING' as const, title: 'pending' };
  const completedTask = { id: 'completed_1', status: 'COMPLETED' as const, title: 'completed' };
  const skippedTask = { id: 'skipped_1', status: 'SKIPPED' as const, title: 'skipped' };
  const untouchedPendingTask = { id: 'pending_2', status: 'PENDING' as const, title: 'untouched' };

  const result = mergeLocalPendingRatings(
    [pendingTask, completedTask, skippedTask, untouchedPendingTask],
    {
      pending_1: { rating: 3 },
      completed_1: { rating: 4 },
      skipped_1: { rating: 2 },
    },
  );

  assert.equal(result[0]?.localStatus, 'LOCAL_RATING_PENDING');
  assert.equal(result[0]?.pendingRatingLabel, '掌握');
  assert.equal(result[1], completedTask);
  assert.equal(result[2], skippedTask);
  assert.equal(result[3], untouchedPendingTask);
}

run();
