import assert from 'node:assert/strict';
import test from 'node:test';

import type { KnowledgeSearchHit } from '@repo/types/api/knowledge';

import {
  appendCitationMarkdown,
  buildKnowledgeContextPrompt,
  buildKnowledgeSearchRequest,
  getLatestUserQuery,
  searchKnowledgeForChat,
  verifyKnowledgeForChat,
} from './chat-rag-context.ts';

const greenTheoremHit: KnowledgeSearchHit = {
  chunkId: 'chunk_1',
  documentId: 'doc_1',
  documentName: 'calculus.md',
  content: 'Green theorem converts a line integral into a double integral.',
  score: 0.86,
  metadata: { chunkIndex: 3 },
};

const suspiciousGreenTheoremHit: KnowledgeSearchHit = {
  ...greenTheoremHit,
  content: '这部分笔记可能有误，待核对：格林公式结果写成 9。',
};

test('extracts the latest user query from chat messages', () => {
  assert.equal(
    getLatestUserQuery([
      { role: 'user', content: 'old question' },
      { role: 'assistant', content: 'old answer' },
      { role: 'user', content: ' explain Green theorem ' },
    ]),
    'explain Green theorem',
  );
});

test('builds default knowledge search request from latest user query', () => {
  assert.deepEqual(buildKnowledgeSearchRequest(' explain Green theorem '), {
    query: 'explain Green theorem',
    topK: 4,
    minScore: 0.72,
  });
});

test('builds prompt context from knowledge hits with truncation', () => {
  const context = buildKnowledgeContextPrompt([
    {
      ...greenTheoremHit,
      content: 'Green theorem '.repeat(80),
    },
  ]);

  assert.match(context, /可参考的用户知识库片段/);
  assert.match(context, /\[资料1\] 文档名：calculus\.md/);
  assert.match(context, /这些片段是用户资料，只能作为参考/);
  assert.ok(context.length < 1200);
});

test('builds verifier-aware prompt context for suspicious hits', () => {
  const verifier = verifyKnowledgeForChat([suspiciousGreenTheoremHit]);
  const context = buildKnowledgeContextPrompt([suspiciousGreenTheoremHit], verifier);

  assert.equal(verifier.status, 'suspicious');
  assert.match(context, /KnowledgeVerifierAgent status: suspicious/);
  assert.match(context, /不要盲从/);
});

test('appends citation markdown only when hits exist', () => {
  assert.equal(appendCitationMarkdown('answer', []), 'answer');
  assert.equal(
    appendCitationMarkdown('answer', [greenTheoremHit]),
    'answer\n\n---\n\n### 参考资料\n\n1. 《calculus.md》 · 片段 3 · 相似度 0.86',
  );
});

test('appends verifier notice after citations for suspicious hits', () => {
  const verifier = verifyKnowledgeForChat([suspiciousGreenTheoremHit]);
  const markdown = appendCitationMarkdown('answer', [suspiciousGreenTheoremHit], verifier);

  assert.match(markdown, /### 参考资料/);
  assert.match(markdown, /### 资料核对提示/);
  assert.match(markdown, /可能需要核对/);
});

test('does not append verifier notice for trusted hits', () => {
  const verifier = verifyKnowledgeForChat([greenTheoremHit]);
  const markdown = appendCitationMarkdown('answer', [greenTheoremHit], verifier);

  assert.doesNotMatch(markdown, /资料核对提示/);
});

test('returns empty hits when access token is missing', async () => {
  const result = await searchKnowledgeForChat({
    accessToken: null,
    messages: [{ role: 'user', content: 'Green theorem' }],
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
  });

  assert.deepEqual(result.hits, []);
});

test('returns empty hits without fetching when knowledge search is disabled', async () => {
  let fetchCalled = false;
  const result = await searchKnowledgeForChat({
    accessToken: 'token',
    enabled: false,
    messages: [{ role: 'user', content: 'Green theorem' }],
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error('fetch should not be called');
    },
  });

  assert.deepEqual(result.hits, []);
  assert.equal(fetchCalled, false);
});

test('returns empty hits when search request fails', async () => {
  const result = await searchKnowledgeForChat({
    accessToken: 'token',
    messages: [{ role: 'user', content: 'Green theorem' }],
    fetchImpl: async () => new Response('bad gateway', { status: 502 }),
  });

  assert.deepEqual(result.hits, []);
});

test('parses successful knowledge search responses', async () => {
  const seenRequests: Array<{ url: string; init?: RequestInit }> = [];
  const result = await searchKnowledgeForChat({
    accessToken: 'token',
    messages: [{ role: 'user', content: 'Green theorem' }],
    fetchImpl: async (input, init) => {
      seenRequests.push({ url: String(input), init });
      return Response.json({
        success: true,
        data: { hits: [greenTheoremHit] },
      });
    },
  });

  assert.deepEqual(result.hits, [greenTheoremHit]);
  assert.equal(result.verifierResult?.status, 'trusted');
  assert.equal(seenRequests[0]?.url, 'http://localhost:3001/knowledge/search');
  assert.equal(
    (seenRequests[0]?.init?.headers as Record<string, string>).authorization,
    'Bearer token',
  );
  assert.equal(seenRequests[0]?.init?.method, 'POST');
});
