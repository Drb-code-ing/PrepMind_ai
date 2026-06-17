import assert from 'node:assert/strict';

import { createApiClient } from './api-client.ts';
import { createReviewPreferenceApi } from './review-preference-api.ts';

async function run() {
  await testGetsReviewPreferences();
  await testPatchesReviewPreferences();
  await testRejectsInvalidPatchRequest();
}

async function testGetsReviewPreferences() {
  const requests: CapturedRequest[] = [];
  const reviewPreferenceApi = createReviewPreferenceApi(
    createTestClient(requests, createPreferencePayload()),
  );

  const result = await reviewPreferenceApi.get('token_1');

  assert.equal(requests[0].input, 'http://localhost:3001/review-preferences');
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].authorization, 'Bearer token_1');
  assert.equal(result.dailyMinutes, 25);
  assert.equal(result.dailyCardLimit, 12);
}

async function testPatchesReviewPreferences() {
  const requests: CapturedRequest[] = [];
  const reviewPreferenceApi = createReviewPreferenceApi(
    createTestClient(
      requests,
      createPreferencePayload({
        dailyMinutes: 40,
        dailyCardLimit: 18,
        weekendMode: 'lighter',
      }),
    ),
  );

  const result = await reviewPreferenceApi.patch('token_1', {
    dailyMinutes: 40,
    dailyCardLimit: 18,
    preferredReviewTime: '21:15',
    reminderEnabled: false,
    reminderLeadMinutes: 60,
    weekendMode: 'lighter',
    planWindowDays: 14,
  });

  assert.equal(requests[0].input, 'http://localhost:3001/review-preferences');
  assert.equal(requests[0].method, 'PATCH');
  assert.equal(requests[0].authorization, 'Bearer token_1');
  assert.deepEqual(requests[0].body, {
    dailyMinutes: 40,
    dailyCardLimit: 18,
    preferredReviewTime: '21:15',
    reminderEnabled: false,
    reminderLeadMinutes: 60,
    weekendMode: 'lighter',
    planWindowDays: 14,
  });
  assert.equal(result.weekendMode, 'lighter');
}

async function testRejectsInvalidPatchRequest() {
  const requests: CapturedRequest[] = [];
  const reviewPreferenceApi = createReviewPreferenceApi(
    createTestClient(requests, createPreferencePayload()),
  );

  await assert.rejects(() => reviewPreferenceApi.patch('token_1', {}));
  await assert.rejects(() =>
    reviewPreferenceApi.patch('token_1', { planWindowDays: 10 } as never),
  );
  assert.equal(requests.length, 0);
}

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

      return jsonResponse({
        success: true,
        data,
        requestId: 'req_1',
      });
    },
  });
}

function createPreferencePayload(input: Partial<Record<string, unknown>> = {}) {
  return {
    dailyMinutes: 25,
    dailyCardLimit: 12,
    preferredReviewTime: '20:30',
    reminderEnabled: true,
    reminderLeadMinutes: 30,
    weekendMode: 'same',
    planWindowDays: 7,
    updatedAt: '2026-06-17T00:00:00.000Z',
    ...input,
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

type CapturedRequest = {
  input: string;
  method: string;
  authorization: string | null;
  body: unknown;
};

await run();
