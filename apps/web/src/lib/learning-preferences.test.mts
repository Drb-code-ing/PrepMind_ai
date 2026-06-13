import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_LEARNING_PREFERENCES,
  createLearningPreferenceStorageKey,
  normalizeLearningPreferences,
  readLearningPreferences,
  writeLearningPreferences,
} from './learning-preferences.ts';

function installLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    },
    configurable: true,
  });
  return store;
}

test('builds per-user learning preference storage keys', () => {
  assert.equal(createLearningPreferenceStorageKey('user-a'), 'prepmind-preferences:user-a');
  assert.equal(createLearningPreferenceStorageKey('user-b'), 'prepmind-preferences:user-b');
});

test('normalizes partial and invalid learning preferences', () => {
  const normalized = normalizeLearningPreferences({
    examGoal: '高数期末强化',
    explanationStyle: 'invalid',
    dailyIntensity: 'intense',
    updatedAt: 'bad',
  });

  assert.deepEqual(normalized, {
    ...DEFAULT_LEARNING_PREFERENCES,
    examGoal: '高数期末强化',
    dailyIntensity: 'intense',
  });
});

test('reads defaults when no browser storage exists', () => {
  Reflect.deleteProperty(globalThis, 'window');
  assert.deepEqual(readLearningPreferences('user-a'), DEFAULT_LEARNING_PREFERENCES);
});

test('persists preferences per user', () => {
  installLocalStorage();

  writeLearningPreferences('user-a', {
    examGoal: '考研数学一',
    explanationStyle: 'socratic',
    dailyIntensity: 'light',
    updatedAt: 100,
  });
  writeLearningPreferences('user-b', {
    examGoal: '英语六级',
    explanationStyle: 'detailed',
    dailyIntensity: 'intense',
    updatedAt: 200,
  });

  assert.deepEqual(readLearningPreferences('user-a'), {
    examGoal: '考研数学一',
    explanationStyle: 'socratic',
    dailyIntensity: 'light',
    updatedAt: 100,
  });
  assert.deepEqual(readLearningPreferences('user-b'), {
    examGoal: '英语六级',
    explanationStyle: 'detailed',
    dailyIntensity: 'intense',
    updatedAt: 200,
  });
});
