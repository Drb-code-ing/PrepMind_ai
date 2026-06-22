import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatOrganizerCountLabel,
  getDeckHref,
  getOrganizerConfidenceLabel,
  getOrganizerMasteryPercent,
  getSubjectGroupHref,
} from './wrong-question-organizer-view.ts';

test('formatOrganizerCountLabel describes empty, mastered, and unresolved counts', () => {
  assert.equal(formatOrganizerCountLabel(0, 0), '暂无错题');
  assert.equal(formatOrganizerCountLabel(12, 0), '12 道 · 已全部掌握');
  assert.equal(formatOrganizerCountLabel(12, 5), '12 道 · 5 道未掌握');
});

test('getOrganizerMasteryPercent rounds resolved count into a percentage', () => {
  assert.equal(getOrganizerMasteryPercent(0, 0), 0);
  assert.equal(getOrganizerMasteryPercent(-1, 1), 0);
  assert.equal(getOrganizerMasteryPercent(12, 5), 42);
  assert.equal(getOrganizerMasteryPercent(3, 2), 67);
});

test('getOrganizerConfidenceLabel maps confidence thresholds to Chinese labels', () => {
  assert.equal(getOrganizerConfidenceLabel(0.8), '归类稳定');
  assert.equal(getOrganizerConfidenceLabel(0.79), '建议复核');
  assert.equal(getOrganizerConfidenceLabel(0.6), '建议复核');
  assert.equal(getOrganizerConfidenceLabel(0.59), '待整理');
});

test('organizer href helpers build error book query links', () => {
  assert.equal(getSubjectGroupHref({ id: 'subject 1' }), '/error-book?subjectGroupId=subject+1');
  assert.equal(getDeckHref({ id: 'deck/1' }), '/error-book?deckId=deck%2F1');
});
