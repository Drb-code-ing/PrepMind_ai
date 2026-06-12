import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyScrollPositionToAutoScrollState,
  applyUserIntentToAutoScrollState,
  isNearScrollBottom,
  type AutoScrollState,
} from './streaming-scroll.ts';

test('detects when scroll position is close enough to the bottom', () => {
  assert.equal(
    isNearScrollBottom({
      scrollHeight: 1000,
      scrollTop: 650,
      clientHeight: 300,
      threshold: 80,
    }),
    true,
  );
});

test('detects when user has scrolled away from the bottom', () => {
  assert.equal(
    isNearScrollBottom({
      scrollHeight: 1000,
      scrollTop: 500,
      clientHeight: 300,
      threshold: 80,
    }),
    false,
  );
});

test('pauses auto scroll immediately when the user starts interacting', () => {
  assert.deepEqual(applyUserIntentToAutoScrollState(), {
    shouldAutoScroll: false,
    userScrollIntent: true,
  });
});

test('resumes auto scroll only after the user returns to the bottom', () => {
  const pausedState: AutoScrollState = {
    shouldAutoScroll: false,
    userScrollIntent: true,
  };

  assert.deepEqual(
    applyScrollPositionToAutoScrollState(pausedState, {
      scrollHeight: 1000,
      scrollTop: 500,
      clientHeight: 300,
      threshold: 24,
    }),
    pausedState,
  );

  assert.deepEqual(
    applyScrollPositionToAutoScrollState(pausedState, {
      scrollHeight: 1000,
      scrollTop: 976,
      clientHeight: 24,
      threshold: 24,
    }),
    {
      shouldAutoScroll: true,
      userScrollIntent: false,
    },
  );
});
