import assert from 'node:assert/strict';

import { knowledgeAgentQueryKeys } from './knowledge-agent-query-keys.ts';

const query = {
  documentId: 'doc_1',
  limit: 30,
};

assert.notDeepEqual(
  knowledgeAgentQueryKeys.suggestions('user_1', query),
  knowledgeAgentQueryKeys.suggestions('user_2', query),
);

assert.deepEqual(knowledgeAgentQueryKeys.suggestions('user_1', {}), [
  'knowledge-agent',
  'user_1',
  'suggestions',
  {
    documentId: undefined,
    limit: 20,
  },
]);
