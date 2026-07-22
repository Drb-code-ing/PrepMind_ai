import { Prisma } from '@prisma/client';

import {
  KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION,
  KNOWLEDGE_SEMANTIC_HIGH_THRESHOLD,
  KNOWLEDGE_SEMANTIC_THRESHOLD,
  KnowledgeSemanticCandidateSource,
  finalizeKnowledgeSemanticPairs,
  type KnowledgeSemanticCandidateScope,
} from './knowledge-semantic-candidate.source';

describe('KnowledgeSemanticCandidateSource', () => {
  const source = new KnowledgeSemanticCandidateSource();

  it('uses at most six safe chunks per document and the top-three cross-document mean', async () => {
    const selected = [
      ...Array.from({ length: 6 }, (_, index) => selectedRow('d1', index)),
      ...Array.from({ length: 6 }, (_, index) => selectedRow('d2', index)),
    ];
    const rows = [0.95, 0.9, 0.85, 0.1].map((score, index) =>
      pairRow('d1', 'd2', score, index),
    );
    const transaction = transactionFixture([selected, rows]);

    const result = await source.load(transaction.value, ownerScope());

    expect(result.version).toBe(KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION);
    expect(
      result.selectedChunks.filter((chunk) => chunk.documentId === 'd1'),
    ).toHaveLength(6);
    expect(
      result.selectedChunks.filter((chunk) => chunk.documentId === 'd2'),
    ).toHaveLength(6);
    expect(result.pairs[0]).toEqual({
      leftDocumentId: 'd1',
      rightDocumentId: 'd2',
      score: 0.9,
      evidenceBand: 'high',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.selectedChunks)).toBe(true);
    expect(Object.isFrozen(result.selectedChunks[0])).toBe(true);
    expect(Object.isFrozen(result.pairs)).toBe(true);
    expect(Object.isFrozen(result.pairs[0])).toBe(true);
  });

  it('binds SQL to the canonical owner and bounded document IDs without returning vectors or content', async () => {
    const transaction = transactionFixture([
      [selectedRow('d1', 0), selectedRow('d2', 0)],
      [pairRow('d1', 'd2', 0.9, 0)],
    ]);

    const result = await source.load(transaction.value, ownerScope());

    expect(transaction.queryRaw).toHaveBeenCalledTimes(2);
    for (const [statement] of transaction.queryRaw.mock.calls) {
      const query = inspectSql(statement);
      expect(query.text).toContain('"userId"');
      expect(query.values).toContain('owner-1');
      expect(query.values).toEqual(expect.arrayContaining(['d1', 'd2']));
      expect(query.values).not.toContain('other-owner-document');
      expect(query.text).toContain('vector_dims');
      expect(query.values).toContain(1536);
      expect(query.text).toContain('safeForPrompt');
    }
    expect(JSON.stringify(result)).not.toMatch(/embedding|content|owner-1/);
  });

  it('samples by stable buckets and uses only DONE owner documents with explicit safe metadata', async () => {
    const transaction = transactionFixture([[], []]);

    await source.load(transaction.value, ownerScope());

    const sampling = inspectSql(firstQueryArgument(transaction.queryRaw));
    expect(sampling.text).toContain('ntile');
    expect(sampling.text).toContain('ntile(?::integer)');
    expect(sampling.text).toContain('ORDER BY index ASC, id ASC');
    expect(sampling.text).toContain("d.status = 'DONE'");
    expect(sampling.text).toContain('c.embedding IS NOT NULL');
    expect(sampling.text).toContain("#>> '{safety,safeForPrompt}'");
  });

  it('ignores unrelated non-DONE documents without suppressing eligible DONE pairs', async () => {
    const transaction = transactionFixture([
      [selectedRow('d1', 0), selectedRow('d2', 0)],
      [pairRow('d1', 'd2', 0.9, 0)],
    ]);

    const result = await source.load(
      transaction.value,
      ownerScope({
        documents: [
          { id: 'd1', status: 'DONE', contentHash: 'hash-d1' },
          { id: 'd2', status: 'DONE', contentHash: 'hash-d2' },
          { id: 'pending', status: 'PROCESSING', contentHash: null },
        ],
      }),
    );

    expect(result.pairs).toEqual([
      {
        leftDocumentId: 'd1',
        rightDocumentId: 'd2',
        score: 0.9,
        evidenceBand: 'high',
      },
    ]);
    const sampling = inspectSql(firstQueryArgument(transaction.queryRaw));
    expect(sampling.values).not.toContain('pending');
  });

  it('keeps hostile owner and document identifiers in tagged SQL values only', async () => {
    const hostileOwner = "owner' OR TRUE --";
    const hostileLeft = "d1') OR TRUE --";
    const hostileRight = 'd2; DROP TABLE "Chunk"';
    const transaction = transactionFixture([[]]);

    await source.load(
      transaction.value,
      ownerScope({
        userId: hostileOwner,
        documents: [
          { id: hostileLeft, status: 'DONE', contentHash: null },
          { id: hostileRight, status: 'DONE', contentHash: null },
        ],
      }),
    );

    const sampling = inspectSql(firstQueryArgument(transaction.queryRaw));
    expect(sampling.text).not.toContain(hostileOwner);
    expect(sampling.text).not.toContain(hostileLeft);
    expect(sampling.text).not.toContain(hostileRight);
    expect(sampling.values).toEqual(
      expect.arrayContaining([hostileOwner, hostileLeft, hostileRight]),
    );
  });

  it('fences both vector sides by owner, provenance, safety, dimensions, and exact non-empty hash', async () => {
    const transaction = transactionFixture([
      [selectedRow('d1', 0), selectedRow('d2', 0)],
      [pairRow('d1', 'd2', 0.9, 0)],
    ]);

    await source.load(transaction.value, ownerScope());

    const pairQuery = inspectSql(queryArgumentAt(transaction.queryRaw, 1));
    expect(pairQuery.text.match(/"userId"/g)).toHaveLength(4);
    expect(pairQuery.text.match(/embedding,provider/g)).toHaveLength(2);
    expect(pairQuery.text.match(/embedding,model/g)).toHaveLength(2);
    expect(pairQuery.text.match(/embedding,dimensions/g)).toHaveLength(2);
    expect(pairQuery.text.match(/safeForPrompt/g)).toHaveLength(4);
    expect(pairQuery.text.match(/riskLevel/g)).toHaveLength(2);
    expect(pairQuery.text).toContain('vector_dims(left_chunk.embedding)');
    expect(pairQuery.text).toContain('vector_dims(right_chunk.embedding)');
    expect(pairQuery.text).toContain('left_document."contentHash" IS NULL');
    expect(pairQuery.text).toContain('right_document."contentHash" IS NULL');
    expect(pairQuery.text).toContain(
      'left_document."contentHash" <> right_document."contentHash"',
    );
  });

  it('filters exact-hash and non-target pairs locally and canonicalizes pair orientation', async () => {
    const scope = ownerScope({
      targetDocumentId: 'd1',
      documents: [
        { id: 'd1', status: 'DONE', contentHash: 'same' },
        { id: 'd2', status: 'DONE', contentHash: 'same' },
        { id: 'd3', status: 'DONE', contentHash: 'different' },
      ],
    });
    const transaction = transactionFixture([
      [selectedRow('d1', 0), selectedRow('d2', 0), selectedRow('d3', 0)],
      [
        pairRow('d2', 'd1', 0.99, 0),
        pairRow('d3', 'd1', 0.88, 0),
        pairRow('d2', 'd3', 0.95, 0),
      ],
    ]);

    const result = await source.load(transaction.value, scope);

    expect(result.pairs).toEqual([
      {
        leftDocumentId: 'd1',
        rightDocumentId: 'd3',
        score: 0.88,
        evidenceBand: 'medium',
      },
    ]);
  });

  it('applies the inclusive threshold, finite cosine validation, stable ties, and twelve-pair cap', () => {
    const rows = [
      pairRow('d2', 'd3', KNOWLEDGE_SEMANTIC_THRESHOLD, 0),
      pairRow('d1', 'd3', KNOWLEDGE_SEMANTIC_THRESHOLD, 1),
      pairRow('d1', 'd2', Number.NaN, 2),
      ...Array.from({ length: 13 }, (_, index) =>
        pairRow(`x${index}`, `y${index}`, 0.9, index + 3),
      ),
    ];
    const documents = [
      ...new Set(
        rows.flatMap((row) => [row.leftDocumentId, row.rightDocumentId]),
      ),
    ].map((id) => ({ id, status: 'DONE' as const, contentHash: `hash-${id}` }));

    const result = finalizeKnowledgeSemanticPairs({ rows, documents });

    expect(result).toHaveLength(12);
    expect(result.every((pair) => Number.isFinite(pair.score))).toBe(true);
    expect(
      result.every((pair) => pair.score >= KNOWLEDGE_SEMANTIC_THRESHOLD),
    ).toBe(true);
    expect(KNOWLEDGE_SEMANTIC_HIGH_THRESHOLD).toBe(0.9);
    expect(
      result.every(
        (pair) =>
          pair.evidenceBand ===
          (pair.score >= KNOWLEDGE_SEMANTIC_HIGH_THRESHOLD ? 'high' : 'medium'),
      ),
    ).toBe(true);
    expect(result).toEqual(
      [...result].sort(
        (left, right) =>
          right.score - left.score ||
          compareCodeUnits(left.leftDocumentId, right.leftDocumentId) ||
          compareCodeUnits(left.rightDocumentId, right.rightDocumentId),
      ),
    );
  });

  it('fails closed on unauthorized, duplicate, over-sampled, or malformed source rows', async () => {
    for (const selected of [
      [selectedRow('other-owner-document', 0)],
      [selectedRow('d1', 0), selectedRow('d1', 0)],
      Array.from({ length: 7 }, (_, index) => selectedRow('d1', index)),
      [{ ...selectedRow('d1', 0), index: -1 }],
    ]) {
      const transaction = transactionFixture([selected, []]);
      const result = await source.load(transaction.value, ownerScope());
      expect(result.selectedChunks).toEqual([]);
      expect(result.pairs).toEqual([]);
    }
  });

  it('fails the entire shortlist closed on malformed, out-of-range, mismatched, or duplicate pair rows', async () => {
    const valid = pairRow('d1', 'd2', 0.9, 0);
    const invalidPairSets: readonly unknown[][] = [
      [valid, { ...valid }],
      [{ ...valid, score: 1.01 }],
      [{ ...valid, leftDocumentId: 'd2' }],
      [{ ...valid, rightIndex: '0' }],
    ];

    for (const pairRows of invalidPairSets) {
      const transaction = transactionFixture([
        [selectedRow('d1', 0), selectedRow('d2', 0)],
        pairRows,
      ]);
      const result = await source.load(transaction.value, ownerScope());
      expect(result).toEqual({
        version: KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION,
        selectedChunks: [],
        pairs: [],
      });
    }
  });

  it('does not treat two null hashes as an exact duplicate', () => {
    const rows = [pairRow('d1', 'd2', 0.8, 0)];

    expect(
      finalizeKnowledgeSemanticPairs({
        rows,
        documents: [
          { id: 'd1', status: 'DONE', contentHash: null },
          { id: 'd2', status: 'DONE', contentHash: null },
        ],
      }),
    ).toEqual([
      {
        leftDocumentId: 'd1',
        rightDocumentId: 'd2',
        score: 0.8,
        evidenceBand: 'medium',
      },
    ]);
  });

  it('returns a frozen empty shortlist on query failure or an ineligible scope', async () => {
    const throwing = {
      $queryRaw: jest
        .fn()
        .mockRejectedValue(new Error('provider-like db body')),
    };
    const failed = await source.load(throwing as never, ownerScope());
    const ineligible = await source.load(
      transactionFixture([[], []]).value,
      ownerScope({
        documents: [{ id: 'pending', status: 'PENDING', contentHash: null }],
      }),
    );

    for (const result of [failed, ineligible]) {
      expect(result).toEqual({
        version: KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION,
        selectedChunks: [],
        pairs: [],
      });
      expect(Object.isFrozen(result)).toBe(true);
    }
  });
});

function transactionFixture(responses: unknown[][]) {
  const queue = [...responses];
  const queryRaw = jest
    .fn()
    .mockImplementation(() => Promise.resolve(queue.shift() ?? []));
  return {
    queryRaw,
    value: { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient,
  };
}

function firstQueryArgument(mock: jest.Mock): unknown {
  return queryArgumentAt(mock, 0);
}

function queryArgumentAt(mock: jest.Mock, index: number): unknown {
  const call = mock.mock.calls[index] as readonly unknown[] | undefined;
  return call?.[0];
}

function ownerScope(
  overrides: Partial<KnowledgeSemanticCandidateScope> = {},
): KnowledgeSemanticCandidateScope {
  return {
    userId: 'owner-1',
    documents: [
      { id: 'd1', status: 'DONE', contentHash: 'hash-d1' },
      { id: 'd2', status: 'DONE', contentHash: 'hash-d2' },
    ],
    ...overrides,
  };
}

function selectedRow(documentId: string, index: number) {
  return {
    id: `${documentId}-chunk-${index}`,
    documentId,
    index,
  };
}

function pairRow(
  leftDocumentId: string,
  rightDocumentId: string,
  score: number,
  index: number,
) {
  return {
    leftChunkId: `${leftDocumentId}-chunk-${index}`,
    leftDocumentId,
    leftIndex: index,
    rightChunkId: `${rightDocumentId}-chunk-${index}`,
    rightDocumentId,
    rightIndex: index,
    score,
  };
}

function inspectSql(value: unknown) {
  const statement = value as {
    strings?: readonly string[];
    values?: readonly unknown[];
  };
  return {
    text: (statement.strings ?? []).join('?').replace(/\s+/g, ' '),
    values: [...(statement.values ?? [])],
  };
}

function compareCodeUnits(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
