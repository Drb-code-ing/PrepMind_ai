import assert from 'node:assert/strict';

import {
  getKnowledgeAgentEmptyMessage,
  getKnowledgeDedupTone,
  getKnowledgeOrganizerCollectionSummary,
  hasKnowledgeAgentSuggestions,
} from './knowledge-agent-view.ts';

assert.match(getKnowledgeAgentEmptyMessage(), /处理更多资料/);

assert.equal(
  getKnowledgeDedupTone({
    severity: 'warning',
  }),
  'warning',
);

assert.equal(
  getKnowledgeOrganizerCollectionSummary({
    name: '数学资料',
    documentIds: ['doc_1', 'doc_2'],
  }),
  '数学资料 · 2 份资料',
);

assert.equal(
  hasKnowledgeAgentSuggestions({
    dedup: { summary: '', items: [], signals: [] },
    organizer: { summary: '', collections: [], tags: [], signals: [] },
  }),
  false,
);

assert.equal(
  hasKnowledgeAgentSuggestions({
    dedup: {
      summary: '',
      items: [
        {
          kind: 'insufficient_signal',
          severity: 'info',
          documentIds: ['doc_1'],
          title: '资料关系信号不足',
          reason: '资料数量、处理状态或内容摘要不足。',
          recommendation: 'review_manually',
          confidence: 0.35,
          signals: ['insufficientSignal'],
        },
      ],
      signals: ['insufficientSignal'],
    },
    organizer: { summary: '', collections: [], tags: [], signals: [] },
  }),
  false,
);

assert.equal(
  hasKnowledgeAgentSuggestions({
    dedup: {
      summary: '',
      items: [
        {
          kind: 'complementary',
          severity: 'info',
          documentIds: ['doc_1', 'doc_2'],
          title: '同主题互补资料',
          reason: '主题相近。',
          recommendation: 'keep_both',
          confidence: 0.7,
          signals: [],
        },
      ],
      signals: [],
    },
    organizer: { summary: '', collections: [], tags: [], signals: [] },
  }),
  true,
);
