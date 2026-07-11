import assert from 'node:assert/strict';

import {
  backgroundJobListQuerySchema,
  backgroundJobResponseSchema,
  backgroundJobSummaryResponseSchema,
} from '../src/api/background-job.ts';

assert.deepEqual(
  backgroundJobListQuerySchema.parse({
    resourceType: 'KNOWLEDGE_DOCUMENT',
    resourceId: 'doc_1',
    limit: '10',
  }),
  {
    resourceType: 'KNOWLEDGE_DOCUMENT',
    resourceId: 'doc_1',
    limit: 10,
  },
);

const parsed = backgroundJobResponseSchema.parse({
  id: 'job_1',
  queueName: 'knowledge-document-processing',
  jobName: 'process-document',
  status: 'ACTIVE',
  resourceType: 'KNOWLEDGE_DOCUMENT',
  resourceId: 'doc_1',
  attempt: 1,
  maxAttempts: 3,
  progress: 10,
  payloadPreview: { documentId: 'doc_1', force: false },
  resultSummary: null,
  errorCode: null,
  errorMessage: null,
  requestedAt: '2026-06-29T00:00:00.000Z',
  startedAt: '2026-06-29T00:00:02.000Z',
  finishedAt: null,
  createdAt: '2026-06-29T00:00:00.000Z',
  updatedAt: '2026-06-29T00:00:02.000Z',
});

assert.equal(parsed.status, 'ACTIVE');
assert.deepEqual(parsed.payloadPreview, { documentId: 'doc_1', force: false });

const summary = backgroundJobSummaryResponseSchema.parse({
  activeCount: 1,
  failedCount: 2,
  staleSkippedCount: 1,
  succeededCount: 3,
  totalRecentCount: 7,
  latestJob: null,
});

assert.equal(summary.activeCount, 1);
assert.equal(summary.latestJob, null);
