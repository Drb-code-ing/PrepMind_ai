import assert from 'node:assert/strict';

import { reviewAgentQueryKeys } from './review-agent-query-keys.ts';

const query = {
  days: 7,
  startDate: '2026-06-22',
  timezoneOffsetMinutes: -480,
};

assert.notDeepEqual(
  reviewAgentQueryKeys.suggestions('user_1', query),
  reviewAgentQueryKeys.suggestions('user_2', query),
);

assert.deepEqual(reviewAgentQueryKeys.suggestions('user_1', {}), [
  'review-agent',
  'user_1',
  'suggestions',
  {
    days: 7,
    startDate: undefined,
    timezoneOffsetMinutes: 0,
  },
]);
