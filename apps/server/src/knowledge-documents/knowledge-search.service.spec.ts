import { HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import type { PrismaService } from '../database/prisma.service';
import type { EmbeddingService } from './embedding.service';
import { KnowledgeSearchService } from './knowledge-search.service';

describe('KnowledgeSearchService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  };
  const embedding = {
    embedChunks: jest.fn(),
  };
  const config = {
    get: jest.fn((key: keyof ServerEnv) => {
      if (key === 'RAG_EMBEDDING_DIMENSIONS') return 3;
      return undefined;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    embedding.embedChunks.mockResolvedValue([[1, 0, 0]]);
    prisma.$queryRaw.mockResolvedValue([]);
  });

  it('embeds the query and maps pgvector rows to search hits', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        chunkId: 'chunk_1',
        documentId: 'doc_1',
        documentName: 'calculus.md',
        content: 'Green theorem converts a line integral into a double integral.',
        score: 0.91,
        metadata: { sectionTitle: 'Green theorem' },
      },
    ]);

    const result = await createService().search('user_1', {
      query: 'Green theorem',
      topK: 5,
      minScore: 0.7,
    });

    expect(embedding.embedChunks).toHaveBeenCalledWith(['Green theorem']);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      hits: [
        {
          chunkId: 'chunk_1',
          documentId: 'doc_1',
          documentName: 'calculus.md',
          content: 'Green theorem converts a line integral into a double integral.',
          score: 0.91,
          metadata: { sectionTitle: 'Green theorem' },
        },
      ],
    });
  });

  it('returns empty hits when pgvector returns no rows', async () => {
    const result = await createService().search('user_1', {
      query: 'not in notes',
      topK: 5,
      minScore: 0.7,
    });

    expect(result).toEqual({ hits: [] });
  });

  it('rejects an invalid query embedding before executing sql', async () => {
    embedding.embedChunks.mockResolvedValue([[1, 0]]);

    await expect(
      createService().search('user_1', {
        query: 'Green theorem',
        topK: 5,
        minScore: 0.7,
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects non-finite query embedding values before executing sql', async () => {
    embedding.embedChunks.mockResolvedValue([[1, Number.NaN, 0]]);

    await expect(
      createService().search('user_1', {
        query: 'Green theorem',
        topK: 5,
        minScore: 0.7,
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('wraps database failures as a stable search error', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));

    await expect(
      createService().search('user_1', {
        query: 'Green theorem',
        topK: 5,
        minScore: 0.7,
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_SEARCH_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });
  });

  it('does not wrap existing app errors from embedding', async () => {
    const failure = new AppError(
      'KNOWLEDGE_EMBEDDING_FAILED',
      'Embedding provider failed',
      HttpStatus.BAD_GATEWAY,
    );
    embedding.embedChunks.mockRejectedValue(failure);

    await expect(
      createService().search('user_1', {
        query: 'Green theorem',
        topK: 5,
        minScore: 0.7,
      }),
    ).rejects.toBe(failure);
  });

  function createService() {
    return new KnowledgeSearchService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService<ServerEnv, true>,
      embedding as unknown as EmbeddingService,
    );
  }
});
