import assert from 'node:assert/strict';
import test from 'node:test';

import { isNearScrollBottom } from './streaming-scroll.ts';

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
