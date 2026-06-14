import assert from 'node:assert/strict';

import {
  getReviewTaskStatusFeedback,
  groupReviewTasksByStatus,
} from './review-task-view.ts';

function run() {
  testGroupsReviewTasksByStatus();
  testReturnsFeedbackForSkipAndReopen();
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
  assert.equal(getReviewTaskStatusFeedback('skip').message, '已跳过这张复习卡');
  assert.equal(getReviewTaskStatusFeedback('reopen').message, '已恢复到待复习');
}

run();
