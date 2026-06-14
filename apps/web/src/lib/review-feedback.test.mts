import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReviewRatingFeedback,
  getReviewRatingOptions,
} from './review-feedback.ts';

test('review rating options explain what each rating does', () => {
  const options = getReviewRatingOptions();

  assert.deepEqual(
    options.map((option) => option.label),
    ['忘了', '吃力', '掌握', '轻松'],
  );
  assert.equal(options[0]?.effect, '10 分钟后再复习');
  assert.equal(options[1]?.effect, '30 分钟后再复习');
  assert.equal(options[2]?.effect, '约 1 天后复习');
  assert.equal(options[3]?.effect, '约 4 天后复习');
});

test('builds an inline feedback message with the selected rating and next review time', () => {
  const message = buildReviewRatingFeedback({
    rating: 3,
    nextReview: '2026-06-15T10:30:00.000Z',
    now: new Date('2026-06-14T10:00:00.000Z'),
  });

  assert.equal(message.title, '已记录：掌握');
  assert.equal(message.description, '下次复习：明天 18:30');
});

test('describes same-day review feedback without looking like nothing happened', () => {
  const message = buildReviewRatingFeedback({
    rating: 1,
    nextReview: '2026-06-14T10:10:00.000Z',
    now: new Date('2026-06-14T10:00:00.000Z'),
  });

  assert.equal(message.title, '已记录：忘了');
  assert.equal(message.description, '下次复习：今天 18:10');
});
