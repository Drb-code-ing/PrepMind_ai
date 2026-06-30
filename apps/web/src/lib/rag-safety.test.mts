import assert from 'node:assert/strict';
import test from 'node:test';

import type { KnowledgeSearchHit } from '@repo/types/api/knowledge';

import {
  buildRagSafetyGuidance,
  selectRagHitsForPrompt,
  splitRagHitsBySafety,
} from './rag-safety.ts';

const baseHit: KnowledgeSearchHit = {
  chunkId: 'chunk_1',
  documentId: 'doc_1',
  documentName: 'notes.md',
  content: 'safe content',
  score: 0.9,
  metadata: {},
};

test('splits RAG hits by persisted safety metadata', () => {
  const highRisk = withRisk('high', false);
  const mediumRisk = withRisk('medium', true);
  const lowRisk = withRisk('low', true);
  const result = splitRagHitsBySafety([highRisk, mediumRisk, lowRisk, baseHit]);

  assert.deepEqual(
    result.blocked.map((hit) => hit.chunkId),
    ['chunk_high'],
  );
  assert.deepEqual(
    result.quotedOnly.map((hit) => hit.chunkId),
    ['chunk_medium'],
  );
  assert.deepEqual(
    result.safe.map((hit) => hit.chunkId),
    ['chunk_low', 'chunk_1'],
  );
});

test('selects prompt hits after unsafe chunks are removed', () => {
  const selected = selectRagHitsForPrompt([
    withRisk('high', false),
    withRisk('low', true, 'chunk_low_1'),
    withRisk('low', true, 'chunk_low_2'),
    withRisk('low', true, 'chunk_low_3'),
    withRisk('low', true, 'chunk_low_4'),
  ]);

  assert.deepEqual(
    selected.hits.map((hit) => hit.chunkId),
    ['chunk_low_1', 'chunk_low_2', 'chunk_low_3', 'chunk_low_4'],
  );
  assert.equal(selected.summary.blockedCount, 1);
});

test('builds concise safety guidance only when needed', () => {
  assert.equal(buildRagSafetyGuidance({ blockedCount: 0, quotedOnlyCount: 0 }), '');
  assert.match(
    buildRagSafetyGuidance({ blockedCount: 1, quotedOnlyCount: 2 }),
    /low-trust evidence/,
  );
});

function withRisk(
  riskLevel: 'low' | 'medium' | 'high',
  safeForPrompt: boolean,
  chunkId = `chunk_${riskLevel}`,
): KnowledgeSearchHit {
  return {
    ...baseHit,
    chunkId,
    metadata: {
      safety: {
        riskLevel,
        categories: riskLevel === 'low' ? [] : ['instruction_override'],
        matchedPatterns:
          riskLevel === 'low' ? [] : ['ignore_previous_instructions_en'],
        safeForPrompt,
      },
    },
  };
}
