import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatOrganizerCountLabel,
  getDeckHref,
  getOrganizerConfidenceLabel,
  getOrganizerMasteryPercent,
  getWrongQuestionOrganizerSourceView,
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

test('organizer source view gives degraded fallback priority over semantic and local states', () => {
  assert.deepEqual(
    getWrongQuestionOrganizerSourceView({
      source: 'local_deterministic',
      disposition: 'fallback_timeout',
      degraded: true,
    }),
    {
      tone: 'degraded',
      label: '安全回退',
      description: '语义判断未通过安全门，已使用本地规则完成整理。',
    },
  );
  assert.deepEqual(
    getWrongQuestionOrganizerSourceView({
      source: 'hybrid_model',
      disposition: 'candidate_applied',
      degraded: false,
      traceId: 'organizer_run_1',
    }),
    {
      tone: 'semantic',
      label: '语义整理',
      description: '本次使用了受治理的语义判断，最终分类仍由本地规则确认。',
    },
  );
  assert.deepEqual(
    getWrongQuestionOrganizerSourceView({
      source: 'local_deterministic',
      disposition: 'gate_disabled',
      degraded: false,
    }),
    {
      tone: 'local',
      label: '本地规则',
      description: '本次由本地规则完成整理，错题功能不受影响。',
    },
  );
});
