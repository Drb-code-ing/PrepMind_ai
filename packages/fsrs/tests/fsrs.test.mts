import assert from 'node:assert/strict';

import { scheduleReview, type FsrsCardState } from '../src/fsrs.ts';

const baseReviewedAt = new Date('2026-06-14T08:00:00.000Z');

function createNewCard(): FsrsCardState {
  return {
    difficulty: 5,
    stability: 0,
    retrievability: 1,
    lastReview: null,
    nextReview: baseReviewedAt,
    reviewCount: 0,
    lapses: 0,
    state: 'NEW',
  };
}

function run() {
  testGoodGraduatesNewCardToReview();
  testAgainKeepsCardShortIntervalAndAddsLapse();
  testEasySchedulesLongerThanGood();
  testReviewAgainEntersRelearning();
  testSameInputProducesSameOutput();
}

function testGoodGraduatesNewCardToReview() {
  const result = scheduleReview({
    card: createNewCard(),
    rating: 3,
    reviewedAt: baseReviewedAt,
  });

  assert.equal(result.card.state, 'REVIEW');
  assert.equal(result.card.reviewCount, 1);
  assert.equal(result.card.lapses, 0);
  assert.equal(result.log.scheduledDays, 1);
  assert.equal(result.card.nextReview.toISOString(), '2026-06-15T08:00:00.000Z');
}

function testAgainKeepsCardShortIntervalAndAddsLapse() {
  const result = scheduleReview({
    card: createNewCard(),
    rating: 1,
    reviewedAt: baseReviewedAt,
  });

  assert.equal(result.card.state, 'LEARNING');
  assert.equal(result.card.reviewCount, 1);
  assert.equal(result.card.lapses, 1);
  assert.equal(result.log.scheduledDays, 0);
  assert.equal(result.card.nextReview.toISOString(), '2026-06-14T08:10:00.000Z');
}

function testEasySchedulesLongerThanGood() {
  const good = scheduleReview({
    card: createNewCard(),
    rating: 3,
    reviewedAt: baseReviewedAt,
  });
  const easy = scheduleReview({
    card: createNewCard(),
    rating: 4,
    reviewedAt: baseReviewedAt,
  });

  assert.ok(easy.card.nextReview.getTime() > good.card.nextReview.getTime());
  assert.ok(easy.card.stability > good.card.stability);
  assert.equal(easy.log.scheduledDays, 4);
}

function testReviewAgainEntersRelearning() {
  const reviewedCard: FsrsCardState = {
    ...createNewCard(),
    difficulty: 4.5,
    stability: 3,
    retrievability: 0.6,
    lastReview: new Date('2026-06-10T08:00:00.000Z'),
    nextReview: baseReviewedAt,
    reviewCount: 3,
    lapses: 0,
    state: 'REVIEW',
  };

  const result = scheduleReview({
    card: reviewedCard,
    rating: 1,
    reviewedAt: baseReviewedAt,
  });

  assert.equal(result.card.state, 'RELEARNING');
  assert.equal(result.card.reviewCount, 4);
  assert.equal(result.card.lapses, 1);
  assert.equal(result.log.elapsedDays, 4);
}

function testSameInputProducesSameOutput() {
  const first = scheduleReview({
    card: createNewCard(),
    rating: 2,
    reviewedAt: baseReviewedAt,
  });
  const second = scheduleReview({
    card: createNewCard(),
    rating: 2,
    reviewedAt: baseReviewedAt,
  });

  assert.deepEqual(first, second);
}

run();
