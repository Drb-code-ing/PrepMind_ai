import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

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

const { createKnowledgeAgentApi } = await import('./knowledge-agent-api.ts');

const requests: CapturedRequest[] = [];
const knowledgeAgentApi = createKnowledgeAgentApi(
  createTestClient(requests, createSuggestionPayload()),
);

const result = await knowledgeAgentApi.getSuggestions('token_1', {
  documentId: 'doc_1',
  limit: 30,
});

assert.equal(
  requests[0].input,
  'http://localhost:3001/knowledge-agent/suggestions?limit=30&documentId=doc_1',
);
assert.equal(requests[0].method, 'GET');
assert.equal(requests[0].authorization, 'Bearer token_1');
assert.equal(result.dedup.items[0]?.kind, 'possible_revision');
assert.equal(result.organizer.collections[0]?.name, '数学资料');

function createTestClient(requests: CapturedRequest[], data: unknown) {
  return createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (input, init) => {
      requests.push({
        input: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
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

function createSuggestionPayload() {
  return {
    generatedAt: '2026-06-29T00:00:00.000Z',
    dedup: {
      summary: '发现 1 条资料关系建议。',
      items: [
        {
          kind: 'possible_revision',
          severity: 'warning',
          documentIds: ['doc_1', 'doc_2'],
          title: '疑似同一资料的不同版本',
          reason: '文件名高度相似，但内容 hash 不同。',
          recommendation: 'review_manually',
          confidence: 0.78,
          signals: ['filenameOverlap', 'differentContentHash'],
        },
      ],
      signals: ['revisionCandidate'],
    },
    organizer: {
      summary: '建议整理为 1 个资料集合。',
      collections: [
        {
          name: '数学资料',
          description: '数学相关讲义、笔记和练习资料。',
          documentIds: ['doc_1', 'doc_2'],
          reason: '至少 2 份资料都识别为数学主题。',
          confidence: 0.82,
          signals: ['subject:数学'],
        },
      ],
      tags: [
        {
          documentId: 'doc_1',
          labels: ['数学', '讲义'],
          reason: '根据资料名称和片段摘要识别出整理标签。',
          confidence: 0.8,
        },
      ],
      signals: ['topicCluster', 'documentTags'],
    },
  };
}

type CapturedRequest = {
  input: string;
  method: string;
  authorization: string | null;
};
