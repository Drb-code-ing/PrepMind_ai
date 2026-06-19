import assert from 'node:assert/strict';
import test from 'node:test';

import { createApiClient } from './api-client.ts';
import { createKnowledgeApi } from './knowledge-api.ts';

test('uploads a knowledge document with multipart form data and bearer token', async () => {
  const requests: CapturedRequest[] = [];
  const api = createKnowledgeApi({
    client: createTestClient(requests, createDocumentPayload({ id: 'doc_upload' })),
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (input, init) => {
      requests.push({
        input: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
        contentType: new Headers(init?.headers).get('content-type'),
        body: init?.body,
      });

      return jsonResponse({
        success: true,
        data: createDocumentPayload({ id: 'doc_upload' }),
        requestId: 'req_1',
      });
    },
  });

  const file = new File(['# calculus'], 'calculus.md', { type: 'text/markdown' });
  const result = await api.uploadDocument('token_1', file);

  assert.equal(requests[0]?.input, 'http://localhost:3001/knowledge/documents');
  assert.equal(requests[0]?.method, 'POST');
  assert.equal(requests[0]?.authorization, 'Bearer token_1');
  assert.equal(requests[0]?.contentType, null);
  assert.ok(requests[0]?.body instanceof FormData);
  assert.equal(result.id, 'doc_upload');
  assert.equal(result.status, 'PENDING');
});

test('lists documents with filters and cursor', async () => {
  const requests: CapturedRequest[] = [];
  const api = createKnowledgeApi({
    client: createTestClient(requests, {
      items: [createDocumentPayload({ status: 'DONE', chunkCount: 3 })],
      nextCursor: 'doc_next',
    }),
    baseUrl: 'http://localhost:3001',
  });

  const result = await api.listDocuments('token_1', {
    status: 'DONE',
    sourceType: 'UPLOAD',
    limit: 10,
    cursor: 'doc_cursor',
  });

  assert.equal(
    requests[0]?.input,
    'http://localhost:3001/knowledge/documents?status=DONE&sourceType=UPLOAD&limit=10&cursor=doc_cursor',
  );
  assert.equal(requests[0]?.method, 'GET');
  assert.equal(requests[0]?.authorization, 'Bearer token_1');
  assert.equal(result.items[0]?.chunkCount, 3);
  assert.equal(result.nextCursor, 'doc_next');
});

test('gets, processes, deletes, and searches knowledge documents', async () => {
  const detailRequests: CapturedRequest[] = [];
  const detailApi = createKnowledgeApi({
    client: createTestClient(detailRequests, createDocumentPayload({ id: 'doc_1' })),
    baseUrl: 'http://localhost:3001',
  });

  await detailApi.getDocument('token_1', 'doc_1');
  assert.equal(detailRequests[0]?.input, 'http://localhost:3001/knowledge/documents/doc_1');
  assert.equal(detailRequests[0]?.method, 'GET');
  assert.equal(detailRequests[0]?.authorization, 'Bearer token_1');

  const processRequests: CapturedRequest[] = [];
  const processApi = createKnowledgeApi({
    client: createTestClient(processRequests, createDocumentPayload({ status: 'DONE' })),
    baseUrl: 'http://localhost:3001',
  });

  const processed = await processApi.processDocument('token_1', 'doc_1', { force: true });
  assert.equal(
    processRequests[0]?.input,
    'http://localhost:3001/knowledge/documents/doc_1/process',
  );
  assert.equal(processRequests[0]?.method, 'POST');
  assert.equal(processRequests[0]?.authorization, 'Bearer token_1');
  assert.deepEqual(processRequests[0]?.jsonBody, { force: true });
  assert.equal(processed.status, 'DONE');

  const deleteRequests: CapturedRequest[] = [];
  const deleteApi = createKnowledgeApi({
    client: createTestClient(deleteRequests, { ok: true }),
    baseUrl: 'http://localhost:3001',
  });

  const deleted = await deleteApi.deleteDocument('token_1', 'doc_1');
  assert.equal(deleteRequests[0]?.input, 'http://localhost:3001/knowledge/documents/doc_1');
  assert.equal(deleteRequests[0]?.method, 'DELETE');
  assert.equal(deleteRequests[0]?.authorization, 'Bearer token_1');
  assert.deepEqual(deleted, { ok: true });

  const searchRequests: CapturedRequest[] = [];
  const searchApi = createKnowledgeApi({
    client: createTestClient(searchRequests, {
      hits: [
        {
          chunkId: 'chunk_1',
          documentId: 'doc_1',
          documentName: 'calculus.md',
          content: 'Green theorem reference',
          score: 0.86,
          metadata: { chunkIndex: 2 },
        },
      ],
    }),
    baseUrl: 'http://localhost:3001',
  });

  const searched = await searchApi.search('token_1', {
    query: 'Green theorem',
    topK: 5,
    minScore: 0.7,
  });

  assert.equal(searchRequests[0]?.input, 'http://localhost:3001/knowledge/search');
  assert.equal(searchRequests[0]?.method, 'POST');
  assert.equal(searchRequests[0]?.authorization, 'Bearer token_1');
  assert.deepEqual(searchRequests[0]?.jsonBody, {
    query: 'Green theorem',
    topK: 5,
    minScore: 0.7,
  });
  assert.equal(searched.hits[0]?.documentName, 'calculus.md');
});

test('parses responses through the shared knowledge schemas', async () => {
  const api = createKnowledgeApi({
    client: createTestClient([], createDocumentPayload({ status: 'ARCHIVED' })),
    baseUrl: 'http://localhost:3001',
  });

  await assert.rejects(
    () => api.getDocument('token_1', 'doc_1'),
    (error) => error instanceof Error && error.name === 'ZodError',
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
        contentType: new Headers(init?.headers).get('content-type'),
        jsonBody: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      return jsonResponse({
        success: true,
        data,
        requestId: 'req_1',
      });
    },
  });
}

function createDocumentPayload(input: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'doc_1',
    name: 'calculus.md',
    type: 'MD',
    size: 1024,
    mimeType: 'text/markdown',
    status: 'PENDING',
    sourceType: 'UPLOAD',
    errorMessage: null,
    contentHash: 'hash_1',
    chunkCount: 0,
    processedAt: null,
    createdAt: '2026-06-19T08:00:00.000Z',
    updatedAt: '2026-06-19T08:00:00.000Z',
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
  contentType: string | null;
  body?: unknown;
  jsonBody?: unknown;
};
