import assert from 'node:assert/strict';

import {
  buildRatingDistributionOption,
  buildReviewTrendOption,
  buildStateDistributionOption,
} from './review-chart-options.ts';

function run() {
  testBuildsReviewTrendOption();
  testBuildsEmptyReviewTrendOption();
  testBuildsRatingDistributionOption();
  testBuildsStateDistributionOption();
}

function testBuildsReviewTrendOption() {
  const option = buildReviewTrendOption([
    { date: '2026-06-15', count: 1 },
    { date: '2026-06-16', count: 3 },
  ]);

  assert.deepEqual(option.xAxis.data, ['06-15', '06-16']);
  assert.deepEqual(option.series[0]?.data, [1, 3]);
}

function testBuildsEmptyReviewTrendOption() {
  const option = buildReviewTrendOption([]);

  assert.deepEqual(option.xAxis.data, []);
  assert.deepEqual(option.series[0]?.data, []);
}

function testBuildsRatingDistributionOption() {
  const option = buildRatingDistributionOption({
    again: 1,
    hard: 2,
    good: 3,
    easy: 4,
  });

  assert.equal(option.series[0]?.type, 'pie');
  assert.equal(option.series[0]?.data.length, 4);
  assert.deepEqual(
    option.series[0]?.data.map((item) => item.name),
    ['重来', '吃力', '掌握', '轻松'],
  );
}

function testBuildsStateDistributionOption() {
  const option = buildStateDistributionOption({
    NEW: 1,
    LEARNING: 2,
    REVIEW: 3,
    RELEARNING: 4,
  });

  assert.equal(option.series[0]?.type, 'pie');
  assert.equal(option.series[0]?.data[0]?.name, '新卡');
  assert.ok(option.series[0]?.data.some((item) => item.name === '学习中'));
  assert.ok(option.series[0]?.data.some((item) => item.name === '复习中'));
  assert.ok(option.series[0]?.data.some((item) => item.name === '重学中'));
}

run();
