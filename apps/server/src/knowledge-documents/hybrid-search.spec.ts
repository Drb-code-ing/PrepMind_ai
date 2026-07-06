import { mergeHybridSearchRows } from './hybrid-search';

describe('mergeHybridSearchRows', () => {
  it('deduplicates rows and keeps the highest vector and keyword scores', () => {
    const hits = mergeHybridSearchRows({
      vectorRows: [
        row('chunk_1', { vectorScore: 0.72, keywordScore: 0 }),
        row('chunk_2', { vectorScore: 0.8, keywordScore: 0 }),
      ],
      keywordRows: [
        row('chunk_1', { vectorScore: 0.7, keywordScore: 0.9 }),
      ],
      topK: 5,
      minScore: 0,
    });

    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({
      chunkId: 'chunk_1',
      score: 0.855,
      metadata: {
        retrieval: {
          mode: 'hybrid',
          vectorScore: 0.72,
          keywordScore: 0.9,
        },
      },
    });
  });

  it('lets keyword-only exact candidates pass the min score threshold', () => {
    const hits = mergeHybridSearchRows({
      vectorRows: [],
      keywordRows: [
        row('chunk_keyword', { vectorScore: 0.31, keywordScore: 1 }),
      ],
      topK: 5,
      minScore: 0.7,
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.chunkId).toBe('chunk_keyword');
    expect(hits[0]?.score).toBe(0.95);
  });

  it('sorts by final score and applies topK', () => {
    const hits = mergeHybridSearchRows({
      vectorRows: [
        row('chunk_a', { vectorScore: 0.7, keywordScore: 0 }),
        row('chunk_b', { vectorScore: 0.96, keywordScore: 0 }),
      ],
      keywordRows: [
        row('chunk_c', { vectorScore: 0.5, keywordScore: 1 }),
      ],
      topK: 2,
      minScore: 0,
    });

    expect(hits.map((hit) => hit.chunkId)).toEqual(['chunk_b', 'chunk_c']);
  });

  it('filters rows below minScore after hybrid scoring', () => {
    const hits = mergeHybridSearchRows({
      vectorRows: [row('chunk_low', { vectorScore: 0.2, keywordScore: 0 })],
      keywordRows: [],
      topK: 5,
      minScore: 0.7,
    });

    expect(hits).toEqual([]);
  });
});

function row(
  chunkId: string,
  scores: { vectorScore: number; keywordScore: number },
) {
  return {
    chunkId,
    documentId: 'doc_1',
    documentName: 'notes.txt',
    content: `${chunkId} content`,
    metadata: { safety: { riskLevel: 'low' } },
    vectorScore: scores.vectorScore,
    keywordScore: scores.keywordScore,
  };
}
