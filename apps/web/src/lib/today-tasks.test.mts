import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TODAY_TASKS,
  createEmptyTodayState,
  getTodayProgress,
  getTodayStorageKey,
  toggleTaskCompletion,
} from './today-tasks.ts';

test('builds daily task storage keys from user id and date', () => {
  assert.equal(getTodayStorageKey('user-a', '2026-06-08'), 'prepmind-today:user-a:2026-06-08');
  assert.equal(getTodayStorageKey('user-b', '2026-06-08'), 'prepmind-today:user-b:2026-06-08');
});

test('toggles task completion without mutating the previous state', () => {
  const initial = createEmptyTodayState('2026-06-08');
  const firstTaskId = TODAY_TASKS[0].id;
  const completed = toggleTaskCompletion(initial, firstTaskId);
  const reverted = toggleTaskCompletion(completed, firstTaskId);

  assert.deepEqual(initial.completedTaskIds, []);
  assert.deepEqual(completed.completedTaskIds, [firstTaskId]);
  assert.deepEqual(reverted.completedTaskIds, []);
});

test('calculates task progress from completed ids', () => {
  const state = {
    date: '2026-06-08',
    completedTaskIds: [TODAY_TASKS[0].id, TODAY_TASKS[1].id],
    updatedAt: 1,
  };

  assert.deepEqual(getTodayProgress(state), {
    completed: 2,
    total: TODAY_TASKS.length,
    percent: Math.round((2 / TODAY_TASKS.length) * 100),
  });
});
