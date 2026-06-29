import assert from 'node:assert/strict';

import {
  getKnowledgeAgentEmptyMessage,
  getKnowledgeDedupTone,
  getKnowledgeOrganizerCollectionSummary,
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
