import assert from 'node:assert/strict';

import {
  getTodayReviewTaskReadState,
  shouldHandleReviewSuggestionLocally,
  shouldShowTodayReviewEmptyNotice,
} from './review-agent-action.ts';

assert.equal(
  shouldHandleReviewSuggestionLocally({
    actionHref: '/today',
    hasPrimaryAction: true,
  }),
  true,
);
assert.equal(
  shouldHandleReviewSuggestionLocally({
    actionHref: '/error-book',
    hasPrimaryAction: true,
  }),
  false,
);
assert.equal(
  shouldHandleReviewSuggestionLocally({
    actionHref: '/plan',
    hasPrimaryAction: true,
  }),
  false,
);
assert.equal(
  shouldHandleReviewSuggestionLocally({
    actionHref: '/today',
    hasPrimaryAction: false,
  }),
  false,
);

assert.equal(
  shouldShowTodayReviewEmptyNotice({
    hasPendingReviewTask: false,
    taskQuerySucceeded: true,
  }),
  true,
);
assert.equal(
  shouldShowTodayReviewEmptyNotice({
    hasPendingReviewTask: false,
    taskQuerySucceeded: false,
  }),
  false,
);

assert.equal(
  getTodayReviewTaskReadState({ isLoading: true, isError: false, isSuccess: false }),
  'loading',
);
assert.equal(
  getTodayReviewTaskReadState({ isLoading: false, isError: true, isSuccess: false }),
  'error',
);
assert.equal(
  getTodayReviewTaskReadState({ isLoading: false, isError: false, isSuccess: false }),
  'unavailable',
);
assert.equal(
  getTodayReviewTaskReadState({ isLoading: false, isError: false, isSuccess: true }),
  'ready',
);
assert.equal(
  shouldShowTodayReviewEmptyNotice({
    hasPendingReviewTask: true,
    taskQuerySucceeded: true,
  }),
  false,
);
