import { HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import {
  ChunkPersistenceService,
  type PersistableChunk,
} from './chunk-persistence.service';

describe('ChunkPersistenceService', () => {
  const config = {
    get: jest.fn((key: keyof ServerEnv) => {
      if (key === 'RAG_MAX_CHUNKS_PER_DOCUMENT') return 2;
      if (key === 'RAG_EMBEDDING_DIMENSIONS') return 3;
      return undefined;
    }),
  } as unknown as ConfigService<ServerEnv, true>;

  const tx = {
    document: {
      findFirst: jest
        .fn<
          Promise<{ id: string } | null>,
          [
            {
              where: {
                id: string;
                userId: string;
                status?: string;
                storageKey?: string;
                contentHash?: string | null;
              };
              select: { id: true };
            },
          ]
        >()
        .mockResolvedValue({ id: 'doc_1' }),
    },
    chunk: {
      deleteMany: jest
        .fn<
          Promise<void>,
          [{ where: { documentId: string; userId: string } }]
        >()
        .mockResolvedValue(undefined),
    },
    $executeRaw: jest
      .fn<Promise<number>, [TemplateStringsArray, ...unknown[]]>()
      .mockResolvedValue(1),
    $queryRaw: jest
      .fn<Promise<{ id: string }[]>, [TemplateStringsArray, ...unknown[]]>()
      .mockResolvedValue([{ id: 'doc_1' }]),
  };

  type TransactionCallback = (transaction: typeof tx) => unknown;

  const prisma = {
    $transaction: jest
      .fn<Promise<unknown>, [TransactionCallback]>()
      .mockImplementation((callback) => Promise.resolve(callback(tx))),
  };

  const chunks: PersistableChunk[] = [
    {
      content: 'first chunk',
      embedding: [0.1, 0.2, 0.3],
      metadata: { parser: 'txt-basic', nested: { ok: true } },
      index: 0,
      tokenCount: 3,
    },
    {
      content: 'second chunk',
      embedding: [0.4, 0.5, 0.6],
      metadata: { parser: 'txt-basic' },
      index: 1,
      tokenCount: 4,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    tx.document.findFirst.mockResolvedValue({ id: 'doc_1' });
    tx.$queryRaw.mockResolvedValue([{ id: 'doc_1' }]);
  });

  function createService() {
    return new ChunkPersistenceService(
      prisma as unknown as PrismaService,
      config,
    );
  }

  it('deletes existing chunks scoped by document and user inside a transaction', async () => {
    await createService().replaceDocumentChunks({
      documentId: 'doc_1',
      userId: 'user_1',
      chunks,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc_1', userId: 'user_1' },
      select: { id: true },
    });
    expect(tx.chunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc_1', userId: 'user_1' },
    });
  });

  it('clears existing chunks scoped by document and user inside a transaction', async () => {
    await createService().clearDocumentChunks('doc_1', 'user_1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc_1', userId: 'user_1' },
      select: { id: true },
    });
    expect(tx.chunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc_1', userId: 'user_1' },
    });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects document ownership mismatch before deleting or inserting chunks', async () => {
    tx.document.findFirst.mockResolvedValue(null);

    await expect(
      createService().replaceDocumentChunks({
        documentId: 'doc_1',
        userId: 'user_2',
        chunks: [chunks[0]],
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc_1', userId: 'user_2' },
      select: { id: true },
    });
    expect(tx.chunk.deleteMany).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects stale processing snapshots before deleting or inserting chunks', async () => {
    tx.$queryRaw.mockResolvedValue([]);

    await expect(
      createService().replaceDocumentChunks({
        documentId: 'doc_1',
        userId: 'user_1',
        chunks: [chunks[0]],
        expectedDocument: {
          storageKey: 'users/user_1/knowledge/notes.txt',
          contentHash: 'sha256:abc',
        },
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_PROCESSING',
      statusCode: HttpStatus.CONFLICT,
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.chunk.deleteMany).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('locks the processing document snapshot before replacing chunks', async () => {
    await createService().replaceDocumentChunks({
      documentId: 'doc_1',
      userId: 'user_1',
      chunks: [chunks[0]],
      expectedDocument: {
        storageKey: 'users/user_1/knowledge/notes.txt',
        contentHash: 'sha256:abc',
      },
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const [queryParts, ...values] = tx.$queryRaw.mock.calls[0] ?? [];
    expect(String.raw({ raw: Array.from(queryParts ?? []) })).toContain(
      'FOR UPDATE',
    );
    expect(values).toEqual(
      expect.arrayContaining([
        'doc_1',
        'user_1',
        'users/user_1/knowledge/notes.txt',
        'sha256:abc',
      ]),
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.chunk.deleteMany.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('inserts each chunk with raw sql and generated ids', async () => {
    await createService().replaceDocumentChunks({
      documentId: 'doc_1',
      userId: 'user_1',
      chunks,
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    for (const call of tx.$executeRaw.mock.calls) {
      const values = call.slice(1);
      expect(values[0]).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
      expect(values).toEqual(
        expect.arrayContaining([
          'doc_1',
          expect.stringMatching(/^\[/),
          'user_1',
        ]),
      );
    }
  });

  it('rejects too many chunks before opening a transaction', async () => {
    await expect(
      createService().replaceDocumentChunks({
        documentId: 'doc_1',
        userId: 'user_1',
        chunks: [...chunks, chunks[0]],
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_TOO_MANY_CHUNKS',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects non-finite embedding values before sql execution', async () => {
    await expect(
      createService().replaceDocumentChunks({
        documentId: 'doc_1',
        userId: 'user_1',
        chunks: [
          {
            ...chunks[0],
            embedding: [0.1, Number.POSITIVE_INFINITY, 0.3],
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });

    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects wrong embedding vector dimensions before opening a transaction', async () => {
    await expect(
      createService().replaceDocumentChunks({
        documentId: 'doc_1',
        userId: 'user_1',
        chunks: [
          {
            ...chunks[0],
            embedding: [0.1, 0.2],
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('accepts quote-like metadata through the raw sql parameter path', async () => {
    await createService().replaceDocumentChunks({
      documentId: 'doc_1',
      userId: 'user_1',
      chunks: [
        {
          ...chunks[0],
          metadata: { title: 'a"b\'c', sourceName: 'notes.txt' },
        },
      ],
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const values = tx.$executeRaw.mock.calls[0]?.slice(1);
    expect(values).toEqual(
      expect.arrayContaining([
        JSON.stringify({ title: 'a"b\'c', sourceName: 'notes.txt' }),
      ]),
    );
  });
});
