import { describe, expect, test } from 'bun:test';

import {
  KNOWLEDGE_DEDUP_MODEL_SCHEMA,
  KNOWLEDGE_ORGANIZER_MODEL_SCHEMA,
  validateKnowledgeDedupModelDecision,
  validateKnowledgeOrganizerModelDecision,
} from '../src/model-candidates/knowledge-agent-model-contract.ts';

function validDedupDecision(pairIndexes: readonly number[] = [0, 1]) {
  return {
    decisions: pairIndexes.map((pairIndex) => ({
      pairIndex,
      relation: 'semantic_duplicate' as const,
      confidence: 'high' as const,
      evidenceCodes: ['semantic_overlap', 'same_scope'] as const,
    })),
  };
}

function validOrganizerDecision() {
  return {
    tags: [
      {
        documentIndex: 0,
        subject: 'math' as const,
        resourceType: 'notes' as const,
        topicLabels: ['二次函数'],
      },
    ],
    collections: [
      {
        memberIndexes: [0, 1],
        name: '数学·函数',
        theme: 'topic' as const,
      },
    ],
  };
}

describe('knowledge agent model contracts', () => {
  test('accepts only strict bounded Dedup output fields', () => {
    expect(KNOWLEDGE_DEDUP_MODEL_SCHEMA.safeParse(validDedupDecision()).success).toBe(true);
    expect(
      KNOWLEDGE_DEDUP_MODEL_SCHEMA.safeParse({
        decisions: [
          {
            ...validDedupDecision([0]).decisions[0],
            deleteDocument: true,
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      KNOWLEDGE_DEDUP_MODEL_SCHEMA.safeParse({
        decisions: [
          {
            ...validDedupDecision([0]).decisions[0],
            relation: 'exact_duplicate',
          },
        ],
      }).success,
    ).toBe(false);
    expect(KNOWLEDGE_DEDUP_MODEL_SCHEMA.safeParse({ decisions: new Array(13).fill(validDedupDecision([0]).decisions[0]) }).success).toBe(false);
  });

  test('rejects duplicate pairs, out-of-range indexes, and invalid evidence associations', () => {
    expect(validateKnowledgeDedupModelDecision(validDedupDecision([0, 0]), 2)).toEqual({
      ok: false,
      reasonCode: 'duplicate_pair_index',
    });
    expect(validateKnowledgeDedupModelDecision(validDedupDecision([2]), 2)).toEqual({
      ok: false,
      reasonCode: 'pair_index_out_of_range',
    });
    expect(
      validateKnowledgeDedupModelDecision(
        {
          decisions: [
            {
              pairIndex: 0,
              relation: 'complementary',
              confidence: 'high',
              evidenceCodes: ['version_signal'],
            },
          ],
        },
        1,
      ),
    ).toEqual({ ok: false, reasonCode: 'invalid_evidence_association' });
  });

  test('accepts only safe Organizer labels and strict fields', () => {
    expect(KNOWLEDGE_ORGANIZER_MODEL_SCHEMA.safeParse(validOrganizerDecision()).success).toBe(true);
    for (const topicLabel of [
      '[点击](https://example.test)',
      '<b>函数</b>',
      'https://example.test',
      'a',
      '这是一个长度超过十二字符的非法主题标签',
      '函数/导数',
    ]) {
      expect(
        KNOWLEDGE_ORGANIZER_MODEL_SCHEMA.safeParse({
          ...validOrganizerDecision(),
          tags: [{ ...validOrganizerDecision().tags[0], topicLabels: [topicLabel] }],
        }).success,
      ).toBe(false);
    }
    expect(
      KNOWLEDGE_ORGANIZER_MODEL_SCHEMA.safeParse({
        ...validOrganizerDecision(),
        writeToDatabase: true,
      }).success,
    ).toBe(false);
  });

  test('rejects duplicate or out-of-range Organizer indexes and unsorted collection members', () => {
    expect(
      validateKnowledgeOrganizerModelDecision(
        {
          ...validOrganizerDecision(),
          tags: [validOrganizerDecision().tags[0], validOrganizerDecision().tags[0]],
        },
        2,
      ),
    ).toEqual({ ok: false, reasonCode: 'duplicate_document_index' });
    expect(
      validateKnowledgeOrganizerModelDecision(
        {
          ...validOrganizerDecision(),
          tags: [{ ...validOrganizerDecision().tags[0], documentIndex: 2 }],
        },
        2,
      ),
    ).toEqual({ ok: false, reasonCode: 'document_index_out_of_range' });
    expect(
      validateKnowledgeOrganizerModelDecision(
        {
          ...validOrganizerDecision(),
          collections: [{ ...validOrganizerDecision().collections[0], memberIndexes: [1, 0] }],
        },
        2,
      ),
    ).toEqual({ ok: false, reasonCode: 'collection_members_not_sorted_unique' });
  });
});
