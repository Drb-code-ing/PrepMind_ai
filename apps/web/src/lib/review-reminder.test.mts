import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReviewReminderSummary,
  getDefaultReviewReminderPreference,
  readReviewReminderPreference,
} from './review-reminder.ts';

const tasks = [
  { id: 'task_1', status: 'PENDING', dueAt: '2026-06-15T07:00:00.000Z' },
  { id: 'task_2', status: 'PENDING', dueAt: '2026-06-15T09:00:00.000Z' },
  { id: 'task_3', status: 'COMPLETED', dueAt: '2026-06-15T06:00:00.000Z' },
] as const;

test('builds in-app review reminder summary', () => {
  const summary = buildReviewReminderSummary({
    tasks,
    pendingCount: 2,
    pendingSyncCount: 1,
    now: new Date('2026-06-15T08:00:00.000Z'),
  });

  assert.equal(summary.todayDueCount, 2);
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.nextDueLabel, '17:00');
  assert.equal(summary.pendingSyncCount, 1);
});

test('uses default reminder preference when storage is empty or invalid', () => {
  assert.deepEqual(getDefaultReviewReminderPreference(), {
    inAppEnabled: true,
    quietHoursStart: '22:30',
    quietHoursEnd: '07:30',
  });

  assert.deepEqual(readReviewReminderPreference(null), getDefaultReviewReminderPreference());
  assert.deepEqual(readReviewReminderPreference('{bad json'), getDefaultReviewReminderPreference());
});
