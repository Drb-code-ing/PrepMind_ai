import assert from 'node:assert/strict';

import {
  knowledgeDocumentListQuerySchema,
  knowledgeDocumentListResponseSchema,
  knowledgeDocumentResponseSchema,
  knowledgeDocumentSourceTypeSchema,
  knowledgeDocumentStatusSchema,
  knowledgeDocumentTypeSchema,
  knowledgeSearchRequestSchema,
  knowledgeSearchResponseSchema,
} from '../src/api/knowledge.ts';

function run() {
  testEnums();
  testDocumentResponse();
  testFailedDocumentResponse();
  testListQuery();
  testListResponse();
  testSearchRequest();
  testSearchResponse();
}

function testEnums() {
  assert.equal(knowledgeDocumentTypeSchema.parse('PDF'), 'PDF');
  assert.equal(knowledgeDocumentStatusSchema.parse('DONE'), 'DONE');
  assert.equal(knowledgeDocumentSourceTypeSchema.parse('UPLOAD'), 'UPLOAD');

  assert.throws(() => knowledgeDocumentTypeSchema.parse('HTML'));
  assert.throws(() => knowledgeDocumentStatusSchema.parse('READY'));
  assert.throws(() => knowledgeDocumentSourceTypeSchema.parse('WEB'));
}

function testDocumentResponse() {
  const result = knowledgeDocumentResponseSchema.parse(createDocumentPayload());

  assert.equal(result.id, 'doc_1');
  assert.equal(result.sourceType, 'UPLOAD');
  assert.equal(result.errorMessage, null);
  assert.equal(result.chunkCount, 3);
}

function testFailedDocumentResponse() {
  const result = knowledgeDocumentResponseSchema.parse(
    createDocumentPayload({
      status: 'FAILED',
      errorMessage: 'Embedding provider rejected the input.',
      processedAt: null,
      chunkCount: 0,
    }),
  );

  assert.equal(result.status, 'FAILED');
  assert.equal(result.errorMessage, 'Embedding provider rejected the input.');
  assert.equal(result.processedAt, null);
}

function testListQuery() {
  const defaultQuery = knowledgeDocumentListQuerySchema.parse({});
  assert.equal(defaultQuery.limit, 20);
  assert.equal(defaultQuery.status, undefined);

  const explicitQuery = knowledgeDocumentListQuerySchema.parse({
    status: 'FAILED',
    sourceType: 'UPLOAD',
    limit: '10',
    cursor: 'doc_1',
  });

  assert.equal(explicitQuery.status, 'FAILED');
  assert.equal(explicitQuery.sourceType, 'UPLOAD');
  assert.equal(explicitQuery.limit, 10);
  assert.equal(explicitQuery.cursor, 'doc_1');

  assert.throws(() => knowledgeDocumentListQuerySchema.parse({ limit: '0' }));
  assert.throws(() => knowledgeDocumentListQuerySchema.parse({ limit: '101' }));
  assert.throws(() => knowledgeDocumentListQuerySchema.parse({ status: 'READY' }));
}

function testListResponse() {
  const result = knowledgeDocumentListResponseSchema.parse({
    items: [createDocumentPayload()],
    nextCursor: 'doc_2',
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.nextCursor, 'doc_2');

  const empty = knowledgeDocumentListResponseSchema.parse({
    items: [],
    nextCursor: null,
  });
  assert.equal(empty.nextCursor, null);
}

function testSearchRequest() {
  const result = knowledgeSearchRequestSchema.parse({
    query: '格林公式怎么用？',
    topK: '8',
    minScore: '0.72',
  });

  assert.equal(result.query, '格林公式怎么用？');
  assert.equal(result.topK, 8);
  assert.equal(result.minScore, 0.72);

  const defaults = knowledgeSearchRequestSchema.parse({ query: '线性代数' });
  assert.equal(defaults.topK, 5);
  assert.equal(defaults.minScore, 0.7);

  assert.throws(() => knowledgeSearchRequestSchema.parse({ query: '' }));
  assert.throws(() => knowledgeSearchRequestSchema.parse({ query: 'x', topK: '0' }));
  assert.throws(() => knowledgeSearchRequestSchema.parse({ query: 'x', topK: '21' }));
  assert.throws(() => knowledgeSearchRequestSchema.parse({ query: 'x', minScore: '1.1' }));
}

function testSearchResponse() {
  const result = knowledgeSearchResponseSchema.parse({
    hits: [
      {
        chunkId: 'chunk_1',
        documentId: 'doc_1',
        documentName: '高等数学笔记.pdf',
        content: '格林公式用于将闭曲线积分转化为二重积分。',
        score: 0.86,
        metadata: { page: 3, sourceName: '高等数学笔记.pdf' },
      },
    ],
  });

  assert.equal(result.hits[0]?.documentName, '高等数学笔记.pdf');
  assert.equal(result.hits[0]?.score, 0.86);

  const empty = knowledgeSearchResponseSchema.parse({ hits: [] });
  assert.equal(empty.hits.length, 0);

  assert.throws(() =>
    knowledgeSearchResponseSchema.parse({
      hits: [{ chunkId: 'chunk_1', score: 1.2 }],
    }),
  );
}

function createDocumentPayload(input: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'doc_1',
    name: '高等数学笔记.pdf',
    type: 'PDF',
    size: 2048,
    mimeType: 'application/pdf',
    status: 'DONE',
    sourceType: 'UPLOAD',
    errorMessage: null,
    contentHash: 'sha256:abc',
    chunkCount: 3,
    processedAt: '2026-06-17T08:00:00.000Z',
    createdAt: '2026-06-17T07:59:00.000Z',
    updatedAt: '2026-06-17T08:00:00.000Z',
    ...input,
  };
}

run();
