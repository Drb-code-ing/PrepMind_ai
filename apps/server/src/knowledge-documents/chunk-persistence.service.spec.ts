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
      return undefined;
    }),
  } as unknown as ConfigService<ServerEnv, true>;

  const tx = {
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
    expect(tx.chunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc_1', userId: 'user_1' },
    });
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
});
