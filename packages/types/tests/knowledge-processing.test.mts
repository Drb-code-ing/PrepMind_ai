import assert from 'node:assert/strict';

import { knowledgeDocumentProcessResponseSchema } from '../src/api/knowledge';

const parsed = knowledgeDocumentProcessResponseSchema.parse({
  id: 'doc_1',
  name: 'notes.txt',
  type: 'TXT',
  size: 128,
  mimeType: 'text/plain',
  status: 'PROCESSING',
  sourceType: 'UPLOAD',
  errorMessage: null,
  contentHash: 'sha256:abc',
  chunkCount: 0,
  processedAt: null,
  createdAt: '2026-06-29T00:00:00.000Z',
  updatedAt: '2026-06-29T00:00:01.000Z',
  processing: {
    mode: 'queue',
    backgroundJobId: 'job_1',
    status: 'QUEUED',
    queuedAt: '2026-06-29T00:00:01.000Z',
  },
});

assert.equal(parsed.status, 'PROCESSING');
assert.equal(parsed.processing?.status, 'QUEUED');
