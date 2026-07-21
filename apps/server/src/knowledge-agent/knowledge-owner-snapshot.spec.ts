import { Prisma } from '@prisma/client';

import {
  KNOWLEDGE_OWNER_SNAPSHOT_VERSION,
  KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION,
  KnowledgeOwnerSnapshotSource,
  fingerprintKnowledgeOwnerSnapshot,
} from './knowledge-owner-snapshot';
import type {
  KnowledgeSemanticCandidateScope,
  KnowledgeSemanticCandidateSource,
  KnowledgeSemanticShortlist,
} from './knowledge-semantic-candidate.source';

describe('KnowledgeOwnerSnapshotSource', () => {
  const semantic = semanticSourceFixture();
  const source = new KnowledgeOwnerSnapshotSource(semantic.value);
  const ownerSecret = 'test-owner-secret-with-at-least-32-bytes';

  it('loads an owner-scoped, bounded, deeply frozen snapshot and replaces the tail with an out-of-window target', async () => {
    const recent = [documentRow('doc-recent-1'), documentRow('doc-recent-2')];
    const target = documentRow('doc-target', { name: '目标资料.pdf' });
    const tx = transactionFixture({ recent, target });

    const snapshot = await source.load(tx.value, {
      userId: 'owner-canary-never-serialize',
      ownerHashSecret: ownerSecret,
      documentId: 'doc-target',
      limit: 2,
    });

    expect(tx.executeReadOnly).toHaveBeenCalledWith(
      'SET TRANSACTION READ ONLY',
    );
    expect(tx.findDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'owner-canary-never-serialize' },
        take: 2,
      }),
    );
    expect(tx.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-target', userId: 'owner-canary-never-serialize' },
      }),
    );
    expect(snapshot.version).toBe(KNOWLEDGE_OWNER_SNAPSHOT_VERSION);
    expect(snapshot.shortlistVersion).toBe(
      KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION,
    );
    expect(snapshot.documents.map((document) => document.id)).toEqual([
      'doc-target',
      'doc-recent-1',
    ]);
    expect(snapshot.documents).toHaveLength(2);
    expect(snapshot.targetDocumentId).toBe('doc-target');
    expect(snapshot.ownerHash).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
    expect(snapshot.ownerHash).not.toContain('owner-canary-never-serialize');
    expect(JSON.stringify(snapshot)).not.toContain(
      'owner-canary-never-serialize',
    );
    expect(snapshot.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.documents)).toBe(true);
    expect(Object.isFrozen(snapshot.documents[0])).toBe(true);
    expect(Object.isFrozen(snapshot.documents[0]?.chunkSummaries)).toBe(true);
    expect(Object.isFrozen(snapshot.selectedChunks)).toBe(true);
    expect(Object.isFrozen(snapshot.selectedChunks[0])).toBe(true);
    expect(Object.isFrozen(snapshot.semanticPairs)).toBe(true);
    expect(Object.isFrozen(snapshot.semanticPairs[0])).toBe(true);

    target.name = 'mutation-after-load.pdf';
    target.chunks[0].content = 'mutation-after-load';
    expect(snapshot.documents[0]?.name).toBe('目标资料.pdf');
    expect(snapshot.selectedChunks[0]?.content).not.toBe('mutation-after-load');
  });

  it('keeps an in-window target once and clamps requested limits to twenty', async () => {
    const recent = Array.from({ length: 20 }, (_, index) =>
      documentRow(index === 3 ? 'doc-target' : `doc-${index}`),
    );
    const tx = transactionFixture({ recent });

    const snapshot = await source.load(tx.value, {
      userId: 'owner-1',
      ownerHashSecret: ownerSecret,
      documentId: 'doc-target',
      limit: 50,
    });

    expect(snapshot.documents).toHaveLength(20);
    expect(
      snapshot.documents.filter((document) => document.id === 'doc-target'),
    ).toHaveLength(1);
    expect(tx.findFirst).not.toHaveBeenCalled();
    expect(tx.findDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });

  it('throws the existing not-found response for a missing or cross-owner target inside the transaction', async () => {
    const tx = transactionFixture({ recent: [], target: null });

    await expect(
      source.load(tx.value, {
        userId: 'owner-1',
        ownerHashSecret: ownerSecret,
        documentId: 'doc-other-owner',
        limit: 20,
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND',
      statusCode: 404,
    });
    expect(tx.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-other-owner', userId: 'owner-1' },
      }),
    );
  });

  it('requires a non-trivial owner HMAC secret and domain-separates owner hashes', async () => {
    const tx = transactionFixture({ recent: [documentRow('doc-1')] });

    await expect(
      source.load(tx.value, {
        userId: 'owner-1',
        ownerHashSecret: '',
        limit: 20,
      }),
    ).rejects.toThrow('KNOWLEDGE_OWNER_SNAPSHOT_SECRET_INVALID');

    const first = await source.load(tx.value, {
      userId: 'owner-1',
      ownerHashSecret: ownerSecret,
      limit: 20,
    });
    const second = await source.load(tx.value, {
      userId: 'owner-2',
      ownerHashSecret: ownerSecret,
      limit: 20,
    });
    expect(first.ownerHash).not.toBe(second.ownerHash);
  });

  it('canonicalizes document and chunk order while fingerprinting every prompt-affecting field', () => {
    const material = snapshotMaterial();
    const reordered = {
      ...material,
      documents: [...material.documents].reverse(),
      selectedChunks: [...material.selectedChunks].reverse(),
      semanticPairs: [...material.semanticPairs].reverse(),
    };
    expect(fingerprintKnowledgeOwnerSnapshot(reordered)).toBe(
      fingerprintKnowledgeOwnerSnapshot(material),
    );

    for (const changed of [
      { ...material, targetDocumentId: 'doc-2' },
      {
        ...material,
        documents: material.documents.map((document, index) =>
          index === 0 ? { ...document, name: 'changed.pdf' } : document,
        ),
      },
      {
        ...material,
        selectedChunks: material.selectedChunks.map((chunk, index) =>
          index === 0 ? { ...chunk, contentHash: 'sha256:changed' } : chunk,
        ),
      },
      {
        ...material,
        selectedChunks: material.selectedChunks.map((chunk, index) =>
          index === 0 ? { ...chunk, safetyVersion: 'safety:changed' } : chunk,
        ),
      },
      {
        ...material,
        semanticPairs: material.semanticPairs.map((pair, index) =>
          index === 0
            ? { ...pair, score: 0.81, evidenceBand: 'medium' as const }
            : pair,
        ),
      },
    ]) {
      expect(fingerprintKnowledgeOwnerSnapshot(changed)).not.toBe(
        fingerprintKnowledgeOwnerSnapshot(material),
      );
    }
  });

  it('attaches the fake semantic shortlist to the snapshot and detects score drift during preflight', async () => {
    const rows = [documentRow('doc-1'), documentRow('doc-2')];
    const tx = transactionFixture({ recent: rows });
    const snapshot = await source.load(tx.value, {
      userId: 'owner-1',
      ownerHashSecret: ownerSecret,
      limit: 20,
    });

    expect(semantic.load).toHaveBeenCalledWith(
      tx.value,
      expect.objectContaining({ userId: 'owner-1' }),
    );
    const latestSemanticCall =
      semantic.load.mock.calls[semantic.load.mock.calls.length - 1];
    expect(latestSemanticCall?.[1].documents).toEqual([
      { id: 'doc-1', status: 'DONE', contentHash: 'sha256:doc-1' },
      { id: 'doc-2', status: 'DONE', contentHash: 'sha256:doc-2' },
    ]);
    expect(snapshot.semanticPairs).toEqual([
      {
        leftDocumentId: 'doc-1',
        rightDocumentId: 'doc-2',
        score: 0.9,
        evidenceBand: 'high',
      },
    ]);
    expect(JSON.stringify(snapshot)).not.toMatch(/embedding|owner-1/);

    semantic.load.mockResolvedValueOnce(
      semanticResult(rows, {
        score: 0.88,
        evidenceBand: 'medium',
      }),
    );
    const prisma = revalidationFixture(rows);
    await expect(
      source.revalidate(prisma.value, {
        userId: 'owner-1',
        ownerHashSecret: ownerSecret,
        snapshot,
      }),
    ).resolves.toBe(false);
  });

  it('revalidates the complete canonical snapshot and rejects document, chunk, safety, or selection drift', async () => {
    const row = documentRow('doc-1');
    const tx = transactionFixture({ recent: [row] });
    const snapshot = await source.load(tx.value, {
      userId: 'owner-1',
      ownerHashSecret: ownerSecret,
      limit: 20,
    });

    const prisma = revalidationFixture([row]);
    await expect(
      source.revalidate(prisma.value, {
        userId: 'owner-1',
        ownerHashSecret: ownerSecret,
        snapshot,
      }),
    ).resolves.toBe(true);
    expect(prisma.findDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'owner-1', id: { in: ['doc-1'] } },
      }),
    );

    const changedRows = [
      [
        documentRow('doc-1', {
          updatedAt: new Date('2026-07-21T09:00:00.000Z'),
        }),
      ],
      [documentRow('doc-1', { status: 'PROCESSING' })],
      [documentRow('doc-1', { contentHash: 'sha256:replacement' })],
      [documentRow('doc-1', { name: 'renamed.pdf' })],
      [
        documentRow('doc-1', {
          chunks: [
            chunkRow('doc-1-chunk-1', 'doc-1', {
              content: 'changed full content',
            }),
          ],
        }),
      ],
      [
        documentRow('doc-1', {
          chunks: [
            chunkRow('doc-1-chunk-1', 'doc-1', {
              metadata: safeMetadata({ safeForPrompt: false }),
            }),
          ],
        }),
      ],
      [],
    ];

    for (const rows of changedRows) {
      const stale = revalidationFixture(rows);
      await expect(
        source.revalidate(stale.value, {
          userId: 'owner-1',
          ownerHashSecret: ownerSecret,
          snapshot,
        }),
      ).resolves.toBe(false);
    }
  });

  it('fails closed when revalidation throws or receives a tampered snapshot', async () => {
    const row = documentRow('doc-1');
    const tx = transactionFixture({ recent: [row] });
    const snapshot = await source.load(tx.value, {
      userId: 'owner-1',
      ownerHashSecret: ownerSecret,
      limit: 20,
    });
    const throwing = {
      document: {
        findMany: jest.fn().mockRejectedValue(new Error('db body secret')),
      },
    };
    await expect(
      source.revalidate(throwing as never, {
        userId: 'owner-1',
        ownerHashSecret: ownerSecret,
        snapshot,
      }),
    ).resolves.toBe(false);

    const tampered = { ...snapshot, fingerprint: '0'.repeat(64) };
    const prisma = revalidationFixture([row]);
    await expect(
      source.revalidate(prisma.value, {
        userId: 'owner-1',
        ownerHashSecret: ownerSecret,
        snapshot: tampered,
      }),
    ).resolves.toBe(false);
    expect(prisma.findDocuments).not.toHaveBeenCalled();
  });
});

function transactionFixture(input: {
  recent: DocumentRow[];
  target?: DocumentRow | null;
}) {
  const executeReadOnly = jest.fn().mockResolvedValue(0);
  const findDocuments = jest.fn().mockResolvedValue(input.recent);
  const findFirst = jest.fn().mockResolvedValue(input.target ?? null);
  const availableChunks = [
    ...input.recent,
    ...(input.target ? [input.target] : []),
  ].flatMap((document) => document.chunks);
  const findChunks = jest
    .fn()
    .mockImplementation((args: ChunkFindManyArgs) =>
      Promise.resolve(
        availableChunks.filter((chunk) => args.where.id.in.includes(chunk.id)),
      ),
    );
  return {
    executeReadOnly,
    findDocuments,
    findFirst,
    findChunks,
    value: {
      $executeRawUnsafe: executeReadOnly,
      document: { findMany: findDocuments, findFirst },
      chunk: { findMany: findChunks },
    } as unknown as Prisma.TransactionClient,
  };
}

function revalidationFixture(rows: DocumentRow[]) {
  const findDocuments = jest.fn().mockResolvedValue(rows);
  const availableChunks = rows.flatMap((document) => document.chunks);
  const findChunks = jest
    .fn()
    .mockImplementation((args: ChunkFindManyArgs) =>
      Promise.resolve(
        availableChunks.filter((chunk) => args.where.id.in.includes(chunk.id)),
      ),
    );
  return {
    findDocuments,
    findChunks,
    value: {
      document: { findMany: findDocuments },
      chunk: { findMany: findChunks },
    } as never,
  };
}

function documentRow(
  id: string,
  overrides: Partial<DocumentRow> = {},
): DocumentRow {
  const createdAt = new Date('2026-07-21T08:00:00.000Z');
  const chunks = overrides.chunks ?? [chunkRow(`${id}-chunk-1`, id)];
  return {
    id,
    name: `${id}.pdf`,
    type: 'PDF',
    size: 1024,
    status: 'DONE',
    sourceType: 'UPLOAD',
    contentHash: `sha256:${id}`,
    processedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
    chunks,
    _count: { chunks: chunks.length },
    ...overrides,
  };
}

function chunkRow(
  id: string,
  documentId: string,
  overrides: Partial<ChunkRow> = {},
): ChunkRow {
  return {
    id,
    documentId,
    userId: 'owner-1',
    content: `完整资料内容 ${id}`,
    index: 0,
    metadata: safeMetadata(),
    ...overrides,
  };
}

function safeMetadata(overrides: Record<string, unknown> = {}) {
  return {
    safety: {
      riskLevel: 'low',
      categories: [],
      matchedPatterns: [],
      safeForPrompt: true,
      ...overrides,
    },
  };
}

function snapshotMaterial() {
  return {
    version: KNOWLEDGE_OWNER_SNAPSHOT_VERSION,
    ownerHash: `hmac-sha256:${'a'.repeat(64)}`,
    targetDocumentId: 'doc-1',
    documents: [
      {
        id: 'doc-1',
        name: '一.pdf',
        type: 'PDF' as const,
        size: 1024,
        status: 'DONE' as const,
        sourceType: 'UPLOAD' as const,
        contentHash: 'sha256:doc-1',
        chunkCount: 1,
        processedAt: '2026-07-21T08:00:00.000Z',
        createdAt: '2026-07-21T08:00:00.000Z',
        updatedAt: '2026-07-21T08:00:00.000Z',
        chunkSummaries: ['一'],
      },
      {
        id: 'doc-2',
        name: '二.pdf',
        type: 'PDF' as const,
        size: 2048,
        status: 'DONE' as const,
        sourceType: 'UPLOAD' as const,
        contentHash: 'sha256:doc-2',
        chunkCount: 1,
        processedAt: '2026-07-21T08:00:00.000Z',
        createdAt: '2026-07-21T08:00:00.000Z',
        updatedAt: '2026-07-21T08:00:00.000Z',
        chunkSummaries: ['二'],
      },
    ],
    selectedChunks: [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        index: 0,
        content: '一',
        contentHash: 'sha256:one',
        safetyVersion: 'safety:one',
        safeForModel: true,
      },
      {
        id: 'chunk-2',
        documentId: 'doc-2',
        index: 0,
        content: '二',
        contentHash: 'sha256:two',
        safetyVersion: 'safety:two',
        safeForModel: true,
      },
    ],
    semanticPairs: [
      {
        leftDocumentId: 'doc-1',
        rightDocumentId: 'doc-2',
        score: 0.9,
        evidenceBand: 'high' as const,
      },
    ],
    shortlistVersion: KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION,
  };
}

function semanticSourceFixture() {
  const load = jest.fn(
    (
      _transaction: Prisma.TransactionClient,
      scope: KnowledgeSemanticCandidateScope,
    ) => Promise.resolve(semanticResultFromScope(scope)),
  );
  return {
    load,
    value: { load } as Pick<KnowledgeSemanticCandidateSource, 'load'>,
  };
}

function semanticResultFromScope(
  scope: KnowledgeSemanticCandidateScope,
): KnowledgeSemanticShortlist {
  return semanticResult(
    scope.documents.map((document) => documentRow(document.id)),
  );
}

function semanticResult(
  rows: readonly DocumentRow[],
  pairOverrides: { score: number; evidenceBand: 'medium' | 'high' } = {
    score: 0.9,
    evidenceBand: 'high',
  },
): KnowledgeSemanticShortlist {
  const selectedChunks = rows.map((row) => ({
    id: row.chunks[0]?.id ?? `${row.id}-chunk-1`,
    documentId: row.id,
    index: row.chunks[0]?.index ?? 0,
  }));
  const first = rows[0];
  const second = rows[1];
  return {
    version: KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION,
    selectedChunks,
    pairs:
      first && second
        ? [
            {
              leftDocumentId: first.id,
              rightDocumentId: second.id,
              ...pairOverrides,
            },
          ]
        : [],
  };
}

type ChunkRow = {
  id: string;
  documentId: string;
  userId: string;
  content: string;
  index: number;
  metadata: Record<string, unknown>;
};

type ChunkFindManyArgs = {
  where: { id: { in: string[] } };
};

type DocumentRow = {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'MD' | 'TXT';
  size: number;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  sourceType: 'UPLOAD' | 'NOTE' | 'WRONG_QUESTION' | 'OCR' | 'CHAT';
  contentHash: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  chunks: ChunkRow[];
  _count: { chunks: number };
};
