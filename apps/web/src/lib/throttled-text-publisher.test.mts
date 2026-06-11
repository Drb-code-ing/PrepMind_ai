import assert from 'node:assert/strict';
import test from 'node:test';

import { createThrottledTextPublisher } from './throttled-text-publisher.ts';

test('publishes only the latest pushed text while a timer is pending', () => {
  const published: string[] = [];
  const callbacks: Array<() => void> = [];

  const publisher = createThrottledTextPublisher({
    waitMs: 80,
    publish: (value) => published.push(value),
    setTimer: (callback) => {
      callbacks.push(callback);
      return callbacks.length;
    },
    clearTimer: () => {},
  });

  publisher.push('a');
  publisher.push('ab');
  publisher.push('abc');

  assert.equal(callbacks.length, 1);
  assert.deepEqual(published, []);

  callbacks[0]?.();

  assert.deepEqual(published, ['abc']);
});

test('flush publishes immediately and clears the pending timer', () => {
  const published: string[] = [];
  const cleared: unknown[] = [];
  const callbacks: Array<() => void> = [];

  const publisher = createThrottledTextPublisher({
    waitMs: 80,
    publish: (value) => published.push(value),
    setTimer: (callback) => {
      callbacks.push(callback);
      return callbacks.length;
    },
    clearTimer: (timerId) => cleared.push(timerId),
  });

  publisher.push('first');
  publisher.push('final');
  publisher.flush();

  assert.deepEqual(published, ['final']);
  assert.deepEqual(cleared, [1]);
});
