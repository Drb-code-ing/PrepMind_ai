import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getCapacityStatusLabel,
  normalizeReviewPreferenceForm,
} from './review-preference-view.ts';

test('maps capacity status labels', () => {
  assert.equal(getCapacityStatusLabel('under'), '容量充足');
  assert.equal(getCapacityStatusLabel('near'), '接近上限');
  assert.equal(getCapacityStatusLabel('over'), '超过容量');
});

test('normalizes preference form values to schema bounds', () => {
  assert.deepEqual(
    normalizeReviewPreferenceForm({
      dailyMinutes: '4.8',
      dailyCardLimit: 201,
      preferredReviewTime: '25:00',
      reminderEnabled: 'yes',
      reminderLeadMinutes: -1,
      weekendMode: 'invalid',
      planWindowDays: 99,
    }),
    {
      dailyMinutes: 5,
      dailyCardLimit: 200,
      preferredReviewTime: '20:30',
      reminderEnabled: true,
      reminderLeadMinutes: 0,
      weekendMode: 'same',
      planWindowDays: 14,
    },
  );
});

test('keeps valid preference form values', () => {
  assert.deepEqual(
    normalizeReviewPreferenceForm({
      dailyMinutes: 45,
      dailyCardLimit: '36',
      preferredReviewTime: '07:05',
      reminderEnabled: false,
      reminderLeadMinutes: '120',
      weekendMode: 'lighter',
      planWindowDays: '10',
    }),
    {
      dailyMinutes: 45,
      dailyCardLimit: 36,
      preferredReviewTime: '07:05',
      reminderEnabled: false,
      reminderLeadMinutes: 120,
      weekendMode: 'lighter',
      planWindowDays: 10,
    },
  );
});

