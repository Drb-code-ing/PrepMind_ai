import assert from 'node:assert/strict';

import {
  createReviewCardFromWrongQuestionRequestSchema,
  reviewRatingRequestSchema,
  reviewTodayTasksResponseSchema,
} from '../src/api/review.ts';

function run() {
  testCreateCardRequest();
  testRatingRequest();
  testTodayTasksResponse();
}

function testCreateCardRequest() {
  const result = createReviewCardFromWrongQuestionRequestSchema.parse({
    wrongQuestionId: 'wrong_1',
  });

  assert.equal(result.wrongQuestionId, 'wrong_1');
}

function testRatingRequest() {
  const result = reviewRatingRequestSchema.parse({
    rating: 4,
    reviewedAt: '2026-06-14T08:00:00.000Z',
    reviewDurationMs: 12000,
  });

  assert.equal(result.rating, 4);
}

function testTodayTasksResponse() {
  const result = reviewTodayTasksResponseSchema.parse({
    date: '2026-06-14',
    dueCount: 1,
    newCount: 1,
    learningCount: 0,
    reviewCount: 0,
    tasks: [
      {
        cardId: 'card_1',
        dueAt: '2026-06-14T08:00:00.000Z',
        state: 'NEW',
        reviewCount: 0,
        lapses: 0,
        source: 'wrongQuestion',
        wrongQuestion: {
          id: 'wrong_1',
          questionText: 'Compute 2x + 5 = 13.',
          subject: '数学',
          knowledgePoints: ['一元一次方程'],
          answer: 'x = 4',
          analysis: 'Move 5 then divide by 2.',
          imageUrl: null,
          status: 'UNRESOLVED',
        },
      },
    ],
  });

  assert.equal(result.tasks[0]?.source, 'wrongQuestion');
  assert.equal(result.tasks[0]?.wrongQuestion?.status, 'UNRESOLVED');
}

run();
