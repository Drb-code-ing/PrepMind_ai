import assert from 'node:assert/strict';
import test from 'node:test';

import { createBackgroundJobApi } from './background-job-api.ts';

test('lists background jobs with resource filters', async () => {
  const calls: Array<{ path: string; accessToken?: string | null }> = [];
  const api = createBackgroundJobApi({
    get: async (path, options) => {
      calls.push({ path, accessToken: options?.accessToken });
      return {
        items: [
          {
            id: 'job_1',
            queueName: 'knowledge-document-processing',
            jobName: 'process-document',
            status: 'ACTIVE',
            resourceType: 'KNOWLEDGE_DOCUMENT',
            resourceId: 'doc_1',
            attempt: 1,
            maxAttempts: 3,
            progress: 0,
            payloadPreview: { documentId: 'doc_1' },
            resultSummary: null,
            errorCode: null,
            errorMessage: null,
            requestedAt: '2026-06-29T00:00:00.000Z',
            startedAt: '2026-06-29T00:00:01.000Z',
            finishedAt: null,
            createdAt: '2026-06-29T00:00:00.000Z',
            updatedAt: '2026-06-29T00:00:01.000Z',
          },
        ],
      };
    },
  });

  const result = await api.list('token', {
    resourceType: 'KNOWLEDGE_DOCUMENT',
    resourceId: 'doc_1',
    limit: 10,
  });

  assert.equal(
    calls[0]?.path,
    '/background-jobs?resourceType=KNOWLEDGE_DOCUMENT&resourceId=doc_1&limit=10',
  );
  assert.equal(calls[0]?.accessToken, 'token');
  assert.equal(result.items[0]?.status, 'ACTIVE');
});

test('gets the background job summary for the current account', async () => {
  const calls: Array<{ path: string; accessToken?: string | null }> = [];
  const api = createBackgroundJobApi({
    get: async (path, options) => {
      calls.push({ path, accessToken: options?.accessToken });
      return {
        activeCount: 1,
        failedCount: 0,
        staleSkippedCount: 0,
        succeededCount: 2,
        totalRecentCount: 3,
        latestJob: null,
      };
    },
  });

  const result = await api.getSummary('token');

  assert.equal(calls[0]?.path, '/background-jobs/summary');
  assert.equal(calls[0]?.accessToken, 'token');
  assert.equal(result.activeCount, 1);
});
