import assert from 'node:assert/strict';

import {
  knowledgeAgentSuggestionQuerySchema,
  knowledgeAgentSuggestionResponseSchema,
} from '../src/api/knowledge-agent.ts';

testQueryDefaults();
testValidSuggestionResponse();
testSemanticDuplicateSuggestionResponse();
testInvalidEmptyDocumentReferencesRejected();

function testQueryDefaults() {
  assert.deepEqual(knowledgeAgentSuggestionQuerySchema.parse({}), {
    limit: 20,
  });
  assert.deepEqual(
    knowledgeAgentSuggestionQuerySchema.parse({
      documentId: 'doc_1',
      limit: '50',
    }),
    {
      documentId: 'doc_1',
      limit: 50,
    },
  );
  assert.throws(() => knowledgeAgentSuggestionQuerySchema.parse({ limit: 0 }));
  assert.throws(() => knowledgeAgentSuggestionQuerySchema.parse({ limit: 51 }));
}

function testSemanticDuplicateSuggestionResponse() {
  const parsed = knowledgeAgentSuggestionResponseSchema.parse({
    generatedAt: '2026-07-21T00:00:00.000Z',
    dedup: {
      summary: '发现 1 条疑似语义重复资料。',
      items: [
        {
          kind: 'semantic_duplicate',
          severity: 'warning',
          documentIds: ['doc_left', 'doc_right'],
          title: '疑似语义重复资料',
          reason: '内容高度重合，仍需人工确认。',
          recommendation: 'review_manually',
          confidence: 0.84,
          signals: ['modelSemanticDuplicate'],
        },
      ],
      signals: ['modelSemanticDedup'],
    },
    organizer: {
      summary: '',
      collections: [],
      tags: [],
      signals: [],
    },
  });

  assert.equal(parsed.dedup.items[0]?.kind, 'semantic_duplicate');
  assert.equal(parsed.dedup.items[0]?.recommendation, 'review_manually');
}

function testValidSuggestionResponse() {
  const parsed = knowledgeAgentSuggestionResponseSchema.parse({
    generatedAt: '2026-06-29T00:00:00.000Z',
    dedup: {
      summary: '发现 1 条疑似新版资料。',
      items: [
        {
          kind: 'possible_revision',
          severity: 'warning',
          documentIds: ['doc_old', 'doc_new'],
          title: '疑似新版讲义',
          reason: '文件名高度相似，但内容 hash 不同。',
          recommendation: 'review_manually',
          confidence: 0.78,
          signals: ['filenameOverlap', 'differentContentHash'],
        },
      ],
      signals: ['revisionCandidate'],
    },
    organizer: {
      summary: '建议按数学讲义整理 2 份资料。',
      collections: [
        {
          name: '数学讲义',
          description: '数学相关讲义和笔记资料。',
          documentIds: ['doc_old', 'doc_new'],
          reason: '资料名称和摘要都包含数学主题。',
          confidence: 0.82,
          signals: ['subject:math', 'type:notes'],
        },
      ],
      tags: [
        {
          documentId: 'doc_new',
          labels: ['数学', '讲义'],
          reason: '从文件名识别出数学讲义。',
          confidence: 0.8,
        },
      ],
      signals: ['topicCluster'],
    },
  });

  assert.equal(parsed.dedup.items[0]?.kind, 'possible_revision');
  assert.equal(parsed.organizer.collections[0]?.name, '数学讲义');
}

function testInvalidEmptyDocumentReferencesRejected() {
  const validResponse = {
    generatedAt: '2026-06-29T00:00:00.000Z',
    dedup: {
      summary: '',
      items: [],
      signals: [],
    },
    organizer: {
      summary: '',
      collections: [],
      tags: [],
      signals: [],
    },
  };

  assert.throws(() =>
    knowledgeAgentSuggestionResponseSchema.parse({
      ...validResponse,
      dedup: {
        summary: '',
        signals: [],
        items: [
          {
            kind: 'exact_duplicate',
            severity: 'info',
            documentIds: [''],
            title: '重复资料',
            reason: 'hash 相同。',
            recommendation: 'use_existing',
            confidence: 0.9,
            signals: [],
          },
        ],
      },
    }),
  );
  assert.throws(() =>
    knowledgeAgentSuggestionResponseSchema.parse({
      ...validResponse,
      organizer: {
        summary: '',
        signals: [],
        tags: [],
        collections: [
          {
            name: '数学资料',
            description: '数学资料集合。',
            documentIds: [''],
            reason: '主题相同。',
            confidence: 0.8,
            signals: [],
          },
        ],
      },
    }),
  );
  assert.throws(() =>
    knowledgeAgentSuggestionResponseSchema.parse({
      ...validResponse,
      organizer: {
        summary: '',
        collections: [],
        signals: [],
        tags: [
          {
            documentId: '',
            labels: ['数学'],
            reason: '文件名包含数学。',
            confidence: 0.8,
          },
        ],
      },
    }),
  );
}
