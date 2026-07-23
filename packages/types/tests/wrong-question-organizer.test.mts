import assert from 'node:assert/strict';
import test from 'node:test';

import {
  organizeWrongQuestionBatchResponseSchema,
  organizeWrongQuestionResponseSchema,
  wrongQuestionOrganizerRuntimeMetadataSchema,
} from '../src/api/wrong-question-organizer.ts';

const runtimeLocal = {
  source: 'local_deterministic',
  disposition: 'gate_disabled',
  degraded: false,
} as const;

const organizedItem = {
  subjectGroup: {
    id: 'subject_group_1',
    userId: 'user_1',
    subject: '高等数学',
    displayName: '高等数学',
    sortOrder: 0,
    totalCount: 1,
    unresolvedCount: 1,
    resolvedCount: 0,
    deckCount: 1,
    topKnowledgePoints: ['函数极限'],
    lastUpdatedAt: '2026-07-23T08:00:00.000Z',
    createdAt: '2026-07-23T08:00:00.000Z',
    updatedAt: '2026-07-23T08:00:00.000Z',
  },
  deck: {
    id: 'deck_1',
    userId: 'user_1',
    subjectGroupId: 'subject_group_1',
    name: '函数极限',
    description: '函数极限专题',
    source: 'AI',
    nameLocked: false,
    confidence: 0.86,
    totalCount: 1,
    unresolvedCount: 1,
    resolvedCount: 0,
    topKnowledgePoints: ['函数极限'],
    lastUpdatedAt: '2026-07-23T08:00:00.000Z',
    createdAt: '2026-07-23T08:00:00.000Z',
    updatedAt: '2026-07-23T08:00:00.000Z',
  },
  item: {
    id: 'item_1',
    deckId: 'deck_1',
    wrongQuestionId: 'wrong_1',
    reason: '根据语义主题归类。',
    confidence: 0.86,
    source: 'AI',
    createdAt: '2026-07-23T08:00:00.000Z',
    updatedAt: '2026-07-23T08:00:00.000Z',
  },
  createdSubjectGroup: true,
  createdDeck: true,
  createdItem: true,
  reason: '根据语义主题归类。',
  confidence: 0.86,
} as const;

test('wrong-question organizer runtime accepts only consistent local and hybrid states', () => {
  assert.deepEqual(
    wrongQuestionOrganizerRuntimeMetadataSchema.parse(runtimeLocal),
    runtimeLocal,
  );
  assert.deepEqual(
    wrongQuestionOrganizerRuntimeMetadataSchema.parse({
      source: 'hybrid_model',
      disposition: 'candidate_applied',
      degraded: false,
      traceId: 'organizer_run_1',
    }),
    {
      source: 'hybrid_model',
      disposition: 'candidate_applied',
      degraded: false,
      traceId: 'organizer_run_1',
    },
  );

  for (const invalid of [
    {
      source: 'hybrid_model',
      disposition: 'candidate_applied',
      degraded: false,
    },
    {
      source: 'hybrid_model',
      disposition: 'candidate_applied',
      degraded: true,
      traceId: 'organizer_run_1',
    },
    {
      source: 'local_deterministic',
      disposition: 'candidate_applied',
      degraded: false,
      traceId: 'organizer_run_1',
    },
    {
      source: 'local_deterministic',
      disposition: 'fallback_runtime_error',
      degraded: false,
    },
    {
      source: 'local_deterministic',
      disposition: 'gate_disabled',
      degraded: true,
    },
  ]) {
    assert.throws(() => wrongQuestionOrganizerRuntimeMetadataSchema.parse(invalid));
  }
});

test('single and batch responses keep runtime request-scoped and strict', () => {
  const single = organizeWrongQuestionResponseSchema.parse({
    ...organizedItem,
    runtime: {
      source: 'hybrid_model',
      disposition: 'candidate_applied',
      degraded: false,
      traceId: 'organizer_run_1',
    },
  });
  assert.equal(single.runtime.source, 'hybrid_model');

  const batch = organizeWrongQuestionBatchResponseSchema.parse({
    organizedCount: 1,
    skippedCount: 0,
    items: [organizedItem],
    runtime: {
      source: 'local_deterministic',
      disposition: 'fallback_timeout',
      degraded: true,
    },
  });
  assert.equal(batch.runtime.degraded, true);
  assert.equal(batch.items.length, 1);

  assert.throws(() =>
    organizeWrongQuestionBatchResponseSchema.parse({
      organizedCount: 1,
      skippedCount: 0,
      items: [{ ...organizedItem, runtime: runtimeLocal }],
      runtime: runtimeLocal,
    }),
  );
  assert.throws(() =>
    organizeWrongQuestionResponseSchema.parse({
      ...organizedItem,
      runtime: runtimeLocal,
      providerError: 'must-not-pass',
    }),
  );
});

test('runtime metadata rejects provider details, usage, cost, prompt, and raw mappings', () => {
  for (const forbiddenField of [
    'providerError',
    'inputTokens',
    'outputTokens',
    'estimatedCostCny',
    'prompt',
    'questionId',
    'deckId',
  ]) {
    assert.throws(() =>
      wrongQuestionOrganizerRuntimeMetadataSchema.parse({
        ...runtimeLocal,
        [forbiddenField]: 'must-not-pass',
      }),
    );
  }
});
