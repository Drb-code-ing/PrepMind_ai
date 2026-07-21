import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { KnowledgeAgentService } from './knowledge-agent.service';
import { KnowledgeOwnerSnapshotSource } from './knowledge-owner-snapshot';
import type { KnowledgeSemanticCandidateSource } from './knowledge-semantic-candidate.source';

describe('KnowledgeAgentService', () => {
  const now = new Date('2026-07-21T08:00:00.000Z');
  const events: string[] = [];
  const tx = {
    $executeRawUnsafe: jest.fn(),
    document: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    chunk: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(),
    document: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    chunk: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const config = {
    get: jest.fn((key: keyof ServerEnv) =>
      key === 'JWT_SECRET'
        ? 'test-jwt-secret-with-domain-separation'
        : undefined,
    ),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    events.length = 0;

    config.get.mockImplementation((key: keyof ServerEnv) =>
      key === 'JWT_SECRET'
        ? 'test-jwt-secret-with-domain-separation'
        : undefined,
    );

    tx.$executeRawUnsafe.mockImplementation(() => {
      events.push('tx:read-only');
      return Promise.resolve(0);
    });
    tx.document.findFirst.mockImplementation(() => {
      events.push('tx:target');
      return Promise.resolve(null);
    });
    tx.document.findMany.mockImplementation(() => {
      events.push('tx:documents');
      return Promise.resolve(defaultRows());
    });
    prisma.document.findMany.mockImplementation(() => {
      events.push('revalidate:documents');
      return Promise.resolve(defaultRows());
    });
    tx.chunk.findMany.mockImplementation(() => {
      events.push('tx:chunks');
      return Promise.resolve(
        defaultRows().flatMap((document) => document.chunks),
      );
    });
    prisma.chunk.findMany.mockImplementation(() => {
      events.push('revalidate:chunks');
      return Promise.resolve(
        defaultRows().flatMap((document) => document.chunks),
      );
    });
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => {
        events.push('transaction:start');
        const result = await callback(tx);
        events.push('transaction:end');
        return result;
      },
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService() {
    const semanticSource = {
      load: jest.fn(
        (
          _transaction: unknown,
          scope: { documents: readonly { id: string }[] },
        ) =>
          Promise.resolve({
            version: 'knowledge-semantic-shortlist-v1' as const,
            selectedChunks: scope.documents.map((document) => ({
              id: `${document.id}-chunk-1`,
              documentId: document.id,
              index: 0,
            })),
            pairs: [],
          }),
      ),
    } as unknown as KnowledgeSemanticCandidateSource;
    return new KnowledgeAgentService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService<ServerEnv, true>,
      new KnowledgeOwnerSnapshotSource(semanticSource),
    );
  }

  it('loads all governed facts in one bounded RepeatableRead transaction and revalidates only after it closes', async () => {
    const result = await createService().getSuggestions('user_1', {
      limit: 50,
    });

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 2_000,
      timeout: 5_000,
    });
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      'SET TRANSACTION READ ONLY',
    );
    expect(tx.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_1' },
        take: 20,
      }),
    );
    expect(prisma.document.findFirst).not.toHaveBeenCalled();
    expect(events).toEqual([
      'transaction:start',
      'tx:read-only',
      'tx:documents',
      'tx:chunks',
      'transaction:end',
      'revalidate:documents',
      'revalidate:chunks',
    ]);
    expect(result.generatedAt).toBe(now.toISOString());
    expect(result.organizer.collections[0]?.name).toBe('数学资料');
    expect(result.organizer.tags[0]?.labels).toContain('数学');
    expect(
      result.dedup.items.some((item) => item.kind === 'complementary'),
    ).toBe(true);
  });

  it('checks and includes an out-of-window target inside the same transaction without exceeding the limit', async () => {
    const target = createDocument('doc_old', {
      name: '高等数学 导数讲义.pdf',
      contentHash: 'sha256:old',
    });
    const recent = createDocument('doc_recent', {
      name: '高等数学 导数练习.pdf',
      contentHash: 'sha256:recent',
    });
    tx.document.findMany.mockImplementationOnce(() => {
      events.push('tx:documents');
      return Promise.resolve([recent]);
    });
    tx.document.findFirst.mockImplementationOnce(() => {
      events.push('tx:target');
      return Promise.resolve(target);
    });
    prisma.document.findMany.mockImplementationOnce(() => {
      events.push('revalidate:documents');
      return Promise.resolve([target]);
    });
    tx.chunk.findMany.mockResolvedValueOnce(target.chunks);
    prisma.chunk.findMany.mockResolvedValueOnce(target.chunks);

    const result = await createService().getSuggestions('user_1', {
      documentId: 'doc_old',
      limit: 1,
    });

    expect(tx.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc_old', userId: 'user_1' },
      }),
    );
    expect(tx.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
    expect(prisma.document.findFirst).not.toHaveBeenCalled();
    for (const item of result.dedup.items) {
      expect(item.documentIds).toContain('doc_old');
      expect(item.documentIds).not.toContain('doc_recent');
    }
  });

  it('throws the existing 404 from inside the snapshot transaction for a missing or cross-owner target', async () => {
    tx.document.findMany.mockImplementationOnce(() => {
      events.push('tx:documents');
      return Promise.resolve([]);
    });
    tx.document.findFirst.mockImplementationOnce(() => {
      events.push('tx:target');
      return Promise.resolve(null);
    });

    await expect(
      createService().getSuggestions('user_1', {
        documentId: 'doc_other',
        limit: 20,
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND',
      statusCode: 404,
    });

    expect(prisma.document.findFirst).not.toHaveBeenCalled();
    expect(prisma.document.findMany).not.toHaveBeenCalled();
    expect(events).not.toContain('transaction:end');
  });

  it('returns deterministic local advice and performs no writes when preflight detects snapshot drift', async () => {
    prisma.document.findMany.mockImplementationOnce(() => {
      events.push('revalidate:documents');
      return Promise.resolve(
        defaultRows().map((row, index) =>
          index === 0
            ? { ...row, updatedAt: new Date('2026-07-21T09:00:00.000Z') }
            : row,
        ),
      );
    });

    const result = await createService().getSuggestions('user_1', {
      limit: 20,
    });

    expect(result.dedup.summary.length).toBeGreaterThan(0);
    expect(result.organizer.summary.length).toBeGreaterThan(0);
    expectNoWrites();
  });

  it('fails closed to deterministic local advice when preflight throws', async () => {
    prisma.document.findMany.mockRejectedValueOnce(new Error('db body secret'));

    const result = await createService().getSuggestions('user_1', {
      limit: 20,
    });

    expect(result.dedup.summary.length).toBeGreaterThan(0);
    expect(result.organizer.summary.length).toBeGreaterThan(0);
    expectNoWrites();
  });

  it('does not write documents or chunks while generating advice', async () => {
    await createService().getSuggestions('user_1', { limit: 20 });
    expectNoWrites();
  });

  function expectNoWrites() {
    for (const client of [prisma, tx]) {
      expect(client.document.create).not.toHaveBeenCalled();
      expect(client.document.update).not.toHaveBeenCalled();
      expect(client.document.updateMany).not.toHaveBeenCalled();
      expect(client.document.delete).not.toHaveBeenCalled();
      expect(client.document.deleteMany).not.toHaveBeenCalled();
      expect(client.chunk.create).not.toHaveBeenCalled();
      expect(client.chunk.createMany).not.toHaveBeenCalled();
      expect(client.chunk.update).not.toHaveBeenCalled();
      expect(client.chunk.updateMany).not.toHaveBeenCalled();
      expect(client.chunk.delete).not.toHaveBeenCalled();
      expect(client.chunk.deleteMany).not.toHaveBeenCalled();
    }
  }
});

function defaultRows() {
  return [
    createDocument('doc_1', {
      name: '高等数学 导数讲义.pdf',
      contentHash: 'sha256:a',
      chunks: [
        createChunk('doc_1-chunk-1', 'doc_1', {
          content: '导数 极限 函数'.repeat(30),
        }),
      ],
      chunkCount: 5,
    }),
    createDocument('doc_2', {
      name: '高等数学 导数练习.pdf',
      contentHash: 'sha256:b',
      chunks: [
        createChunk('doc_2-chunk-1', 'doc_2', { content: '导数应用题' }),
      ],
      chunkCount: 1,
    }),
  ];
}

function createDocument(
  id: string,
  overrides: Partial<DocumentRecord> & { chunkCount?: number } = {},
): DocumentRecord {
  const createdAt = new Date('2026-07-21T08:00:00.000Z');
  const chunks = overrides.chunks ?? [createChunk(`${id}-chunk-1`, id)];
  const chunkCount = overrides.chunkCount ?? chunks.length;
  return {
    id,
    name: '高等数学 导数讲义.pdf',
    type: 'PDF',
    size: 1024,
    status: 'DONE',
    sourceType: 'UPLOAD',
    contentHash: 'sha256:a',
    processedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
    chunks,
    _count: { chunks: chunkCount },
    ...overrides,
  };
}

function createChunk(
  id: string,
  documentId: string,
  overrides: Partial<ChunkRecord> = {},
): ChunkRecord {
  return {
    id,
    documentId,
    userId: 'user_1',
    content: '导数 极限 函数',
    index: 0,
    metadata: {
      safety: {
        riskLevel: 'low',
        categories: [],
        matchedPatterns: [],
        safeForPrompt: true,
      },
    },
    ...overrides,
  };
}

type ChunkRecord = {
  id: string;
  documentId: string;
  userId: string;
  content: string;
  index: number;
  metadata: Record<string, unknown>;
};

type DocumentRecord = {
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
  chunks: ChunkRecord[];
  _count: { chunks: number };
};
