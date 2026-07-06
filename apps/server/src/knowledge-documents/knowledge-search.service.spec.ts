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

  it('embeds the query and merges vector and keyword candidates', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          chunkId: 'chunk_vector',
          documentId: 'doc_1',
          documentName: 'calculus.md',
          content:
            'Green theorem converts a line integral into a double integral.',
          vectorScore: 0.91,
          keywordScore: 0,
          metadata: { sectionTitle: 'Green theorem' },
        },
      ])
      .mockResolvedValueOnce([
        {
          chunkId: 'chunk_keyword',
          documentId: 'doc_1',
          documentName: 'calculus.md',
          content: 'Green theorem exact keyword note.',
          vectorScore: 0.6,
          keywordScore: 1,
          metadata: { sectionTitle: 'Green theorem' },
        },
      ]);

    const result = await createService().search('user_1', {
      query: 'Green theorem',
      topK: 5,
      minScore: 0.7,
    });

    expect(embedding.embedChunks).toHaveBeenCalledWith(['Green theorem']);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      hits: [
        {
          chunkId: 'chunk_keyword',
          documentId: 'doc_1',
          documentName: 'calculus.md',
          content: 'Green theorem exact keyword note.',
          score: 0.95,
          metadata: {
            sectionTitle: 'Green theorem',
            retrieval: {
              mode: 'hybrid',
              vectorScore: 0.6,
              keywordScore: 1,
            },
          },
        },
        {
          chunkId: 'chunk_vector',
          documentId: 'doc_1',
          documentName: 'calculus.md',
          content:
            'Green theorem converts a line integral into a double integral.',
          score: 0.91,
          metadata: {
            sectionTitle: 'Green theorem',
            retrieval: {
              mode: 'hybrid',
              vectorScore: 0.91,
              keywordScore: 0,
            },
          },
        },
      ],
    });
  });

  it('includes chunk safety metadata in search hits', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          chunkId: 'chunk_unsafe',
          documentId: 'doc_1',
          documentName: 'notes.txt',
          content: 'unsafe instruction-like note',
          vectorScore: '0.88',
          keywordScore: 0,
          metadata: {
            safety: {
              riskLevel: 'high',
              categories: ['instruction_override'],
              matchedPatterns: ['ignore_previous_instructions_zh'],
              safeForPrompt: false,
            },
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await createService().search('user_1', {
      query: 'Green theorem',
      topK: 5,
      minScore: 0.7,
    });

    expect(result.hits[0]).toMatchObject({
      chunkId: 'chunk_unsafe',
      score: 0.88,
      metadata: {
        retrieval: {
          mode: 'hybrid',
          vectorScore: 0.88,
          keywordScore: 0,
        },
        safety: {
          riskLevel: 'high',
          categories: ['instruction_override'],
          matchedPatterns: ['ignore_previous_instructions_zh'],
          safeForPrompt: false,
        },
      },
    });
  });

  it('returns empty hits when no candidate query returns rows', async () => {
    const result = await createService().search('user_1', {
      query: 'not in notes',
      topK: 5,
      minScore: 0.7,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
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
