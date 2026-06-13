import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TODAY_TASKS,
  createEmptyTodayState,
  getTodayNextAction,
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

test('recommends wrong question review when unresolved questions exist', () => {
  const state = createEmptyTodayState('2026-06-13');

  assert.deepEqual(getTodayNextAction(state, 3), {
    title: '先复习未掌握错题',
    description: '当前还有 3 道未掌握错题，建议先回看错因和备注。',
    href: '/error-book',
  });
});

test('recommends the first incomplete task when no unresolved question exists', () => {
  const state = {
    date: '2026-06-13',
    completedTaskIds: [TODAY_TASKS[0].id],
    updatedAt: 1,
  };

  assert.equal(getTodayNextAction(state, 0).title, TODAY_TASKS[1].title);
});

test('recommends summary after all tasks are completed', () => {
  const state = {
    date: '2026-06-13',
    completedTaskIds: TODAY_TASKS.map((task) => task.id),
    updatedAt: 1,
  };

  assert.deepEqual(getTodayNextAction(state, 0), {
    title: '今天的学习闭环已完成',
    description: '可以回到 AI 对话，让 PrepMind 帮你总结明天的优先级。',
    href: '/chat',
  });
});
