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

test('builds under-capacity review reminder summary', () => {
  const summary = buildReviewReminderSummary({
    tasks,
    pendingCount: 2,
    pendingSyncCount: 0,
    capacity: {
      dailyMinutes: 30,
      estimatedMinutes: 18,
      capacityStatus: 'under',
    },
    now: new Date('2026-06-15T08:00:00.000Z'),
  });

  assert.equal(summary.dailyMinutes, 30);
  assert.equal(summary.estimatedMinutes, 18);
  assert.equal(summary.capacityStatus, 'under');
  assert.equal(summary.capacityLabel, '今日预计 18 分钟，容量充足');
});

test('builds near-capacity review reminder summary', () => {
  const summary = buildReviewReminderSummary({
    tasks,
    pendingCount: 2,
    pendingSyncCount: 0,
    capacity: {
      dailyMinutes: 30,
      estimatedMinutes: 25,
      capacityStatus: 'near',
    },
    now: new Date('2026-06-15T08:00:00.000Z'),
  });

  assert.equal(summary.dailyMinutes, 30);
  assert.equal(summary.estimatedMinutes, 25);
  assert.equal(summary.capacityStatus, 'near');
  assert.equal(summary.capacityLabel, '今日预计 25 分钟，接近你的每日容量');
});

test('builds over-capacity review reminder summary', () => {
  const summary = buildReviewReminderSummary({
    tasks,
    pendingCount: 2,
    pendingSyncCount: 0,
    capacity: {
      dailyMinutes: 30,
      estimatedMinutes: 42,
      capacityStatus: 'over',
    },
    now: new Date('2026-06-15T08:00:00.000Z'),
  });

  assert.equal(summary.dailyMinutes, 30);
  assert.equal(summary.estimatedMinutes, 42);
  assert.equal(summary.capacityStatus, 'over');
  assert.equal(summary.capacityLabel, '今日预计 42 分钟，已超过你的每日容量');
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

test('uses valid stored reminder preference fields over defaults', () => {
  assert.deepEqual(
    readReviewReminderPreference('{"quietHoursStart":"21:00","inAppEnabled":false}'),
    {
      inAppEnabled: false,
      quietHoursStart: '21:00',
      quietHoursEnd: '07:30',
    },
  );
});

test('falls back to default quiet hours when stored values are invalid', () => {
  assert.deepEqual(
    readReviewReminderPreference('{"quietHoursStart":"99:99","quietHoursEnd":"abc"}'),
    getDefaultReviewReminderPreference(),
  );
});

test('ignores non-pending tasks for overdue and next due reminders', () => {
  const summary = buildReviewReminderSummary({
    tasks: [
      { status: 'COMPLETED', dueAt: '2026-06-15T07:00:00.000Z' },
      { status: 'SKIPPED', dueAt: '2026-06-15T09:00:00.000Z' },
    ],
    pendingCount: 0,
    pendingSyncCount: 0,
    now: new Date('2026-06-15T08:00:00.000Z'),
  });

  assert.equal(summary.overdueCount, 0);
  assert.equal(summary.nextDueLabel, '暂无');
});
