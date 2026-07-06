import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  KnowledgeSearchRequest,
  KnowledgeSearchResponse,
} from '@repo/types/api/knowledge';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { EmbeddingService } from './embedding.service';
import {
  type HybridSearchRow,
  mergeHybridSearchRows,
} from './hybrid-search';

@Injectable()
export class KnowledgeSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<ServerEnv, true>,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async search(
    userId: string,
    input: KnowledgeSearchRequest,
  ): Promise<KnowledgeSearchResponse> {
    const [queryEmbedding] = await this.embeddingService.embedChunks([
      input.query,
    ]);
    const embeddingDimensions = this.configService.get(
      'RAG_EMBEDDING_DIMENSIONS',
      { infer: true },
    );
    const queryVector = this.toPgVectorLiteral(
      queryEmbedding ?? [],
      embeddingDimensions,
    );

    try {
      const candidateLimit = Math.min(input.topK * 4, 50);
      const vectorRows = await this.prisma.$queryRaw<HybridSearchRow[]>`
        SELECT
          c.id AS "chunkId",
          c."documentId" AS "documentId",
          d.name AS "documentName",
          c.content AS content,
          c.metadata AS metadata,
          (1 - (c.embedding <=> ${queryVector}::vector))::float AS "vectorScore",
          0::float AS "keywordScore"
        FROM "Chunk" c
        JOIN "Document" d ON d.id = c."documentId"
        WHERE
          c."userId" = ${userId}
          AND d."userId" = ${userId}
          AND d.status = 'DONE'
          AND c.embedding IS NOT NULL
        ORDER BY c.embedding <=> ${queryVector}::vector ASC
        LIMIT ${candidateLimit}
      `;
      const keywordRows = await this.prisma.$queryRaw<HybridSearchRow[]>`
        WITH keyword_query AS (
          SELECT websearch_to_tsquery('simple', ${input.query}) AS query
        )
        SELECT
          c.id AS "chunkId",
          c."documentId" AS "documentId",
          d.name AS "documentName",
          c.content AS content,
          c.metadata AS metadata,
          (1 - (c.embedding <=> ${queryVector}::vector))::float AS "vectorScore",
          ts_rank_cd(
            to_tsvector('simple', coalesce(d.name, '') || ' ' || coalesce(c.content, '')),
            keyword_query.query
          )::float AS "keywordScore"
        FROM "Chunk" c
        JOIN "Document" d ON d.id = c."documentId"
        CROSS JOIN keyword_query
        WHERE
          c."userId" = ${userId}
          AND d."userId" = ${userId}
          AND d.status = 'DONE'
          AND c.embedding IS NOT NULL
          AND keyword_query.query @@ to_tsvector(
            'simple',
            coalesce(d.name, '') || ' ' || coalesce(c.content, '')
          )
        ORDER BY "keywordScore" DESC, "vectorScore" DESC
        LIMIT ${candidateLimit}
      `;

      return {
        hits: mergeHybridSearchRows({
          vectorRows,
          keywordRows,
          topK: input.topK,
          minScore: input.minScore,
        }),
      };
    } catch (error) {
      throw this.createSearchError(error);
    }
  }

  private toPgVectorLiteral(vector: number[], embeddingDimensions: number) {
    if (vector.length !== embeddingDimensions) {
      throw new AppError(
        'KNOWLEDGE_EMBEDDING_FAILED',
        `Expected embedding dimension ${embeddingDimensions} but received ${vector.length}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const values = vector.map((value, index) => {
      if (!Number.isFinite(value)) {
        throw new AppError(
          'KNOWLEDGE_EMBEDDING_FAILED',
          `Embedding vector contains a non-finite value at index ${index}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      return String(value);
    });

    return `[${values.join(',')}]`;
  }

  private createSearchError(cause: unknown) {
    if (cause instanceof AppError) {
      return cause;
    }

    const error = new AppError(
      'KNOWLEDGE_SEARCH_FAILED',
      'Knowledge search failed',
      HttpStatus.BAD_GATEWAY,
    );
    (error as AppError & { cause?: unknown }).cause = cause;
    return error;
  }
}
