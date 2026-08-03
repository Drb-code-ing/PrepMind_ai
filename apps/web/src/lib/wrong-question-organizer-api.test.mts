import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

import { createApiClient } from './api-client.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ERR_MODULE_NOT_FOUND' &&
        specifier.startsWith('.')
      ) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const { createWrongQuestionOrganizerApi } = await import(
  './wrong-question-organizer-api.ts'
);

test('organizer API strictly parses single and batch request-level runtime metadata', async () => {
  const singleRequests: CapturedRequest[] = [];
  const singleApi = createWrongQuestionOrganizerApi(
    createTestClient(singleRequests, createSinglePayload()),
  );
  const single = await singleApi.organizeOne('token_1', 'wrong/1', {
    force: false,
  });

  assert.deepEqual(singleRequests, [
    {
      input: 'http://localhost:3001/wrong-question-organizer/organize/wrong%2F1',
      method: 'POST',
      authorization: 'Bearer token_1',
      body: { force: false },
    },
  ]);
  assert.equal(single.runtime.source, 'local_deterministic');

  const batchRequests: CapturedRequest[] = [];
  const batchApi = createWrongQuestionOrganizerApi(
    createTestClient(batchRequests, createBatchPayload()),
  );
  const batch = await batchApi.organizeBatch('token_2', { limit: 2 });

  assert.deepEqual(batchRequests, [
    {
      input: 'http://localhost:3001/wrong-question-organizer/organize-batch',
      method: 'POST',
      authorization: 'Bearer token_2',
      body: { limit: 2 },
    },
  ]);
  assert.equal(batch.runtime.disposition, 'candidate_applied');
  assert.equal(batch.items.length, 1);
  assert.equal('runtime' in batch.items[0], false);
});

test('organizer API rejects sensitive or unknown response fields after envelope unwrap', async () => {
  const invalidSingle = createSinglePayload() as Record<string, unknown>;
  invalidSingle.providerError = 'must-not-cross-the-api-boundary';
  await assert.rejects(
    () =>
      createWrongQuestionOrganizerApi(
        createTestClient([], invalidSingle),
      ).organizeOne('token_1', 'wrong_1', { force: false }),
    /unrecognized key.*providerError/i,
  );

  const invalidBatchRuntime = createBatchPayload();
  Object.assign(invalidBatchRuntime.runtime, {
    apiKey: 'must-not-cross-the-api-boundary',
  });
  await assert.rejects(
    () =>
      createWrongQuestionOrganizerApi(
        createTestClient([], invalidBatchRuntime),
      ).organizeBatch('token_1', { limit: 2 }),
    /unrecognized key.*apiKey/i,
  );

  const invalidBatchItem = createBatchPayload();
  Object.assign(invalidBatchItem.items[0], { ownerId: 'user_1' });
  await assert.rejects(
    () =>
      createWrongQuestionOrganizerApi(
        createTestClient([], invalidBatchItem),
      ).organizeBatch('token_1', { limit: 2 }),
    /unrecognized key.*ownerId/i,
  );
});

function createTestClient(requests: CapturedRequest[], data: unknown) {
  return createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (input, init) => {
      requests.push({
        input: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      return new Response(
        JSON.stringify({
          success: true,
          data,
          requestId: 'req_1',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    },
  });
}

function createSinglePayload() {
  return {
    ...createOrganizedItem(),
    runtime: {
      source: 'local_deterministic',
      disposition: 'gate_disabled',
      degraded: false,
    },
  };
}

function createBatchPayload() {
  return {
    organizedCount: 1,
    skippedCount: 0,
    items: [createOrganizedItem()],
    runtime: {
      source: 'hybrid_model',
      disposition: 'candidate_applied',
      degraded: false,
      traceId: 'organizer_run_1',
    },
  };
}

function createOrganizedItem() {
  const timestamp = '2026-07-23T08:00:00.000Z';
  return {
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
      lastUpdatedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
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
      lastUpdatedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    item: {
      id: 'item_1',
      deckId: 'deck_1',
      wrongQuestionId: 'wrong_1',
      reason: '根据语义主题归类。',
      confidence: 0.86,
      source: 'AI',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    createdSubjectGroup: true,
    createdDeck: true,
    createdItem: true,
    reason: '根据语义主题归类。',
    confidence: 0.86,
  };
}

type CapturedRequest = {
  input: string;
  method: string;
  authorization: string | null;
  body: unknown;
};
