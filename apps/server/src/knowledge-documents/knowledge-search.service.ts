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

type KnowledgeSearchRow = {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number | string;
  metadata: unknown;
};

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
      const rows = await this.prisma.$queryRaw<KnowledgeSearchRow[]>`
        SELECT
          c.id AS "chunkId",
          c."documentId" AS "documentId",
          d.name AS "documentName",
          c.content AS content,
          c.metadata AS metadata,
          (1 - (c.embedding <=> ${queryVector}::vector))::float AS score
        FROM "Chunk" c
        JOIN "Document" d ON d.id = c."documentId"
        WHERE
          c."userId" = ${userId}
          AND d."userId" = ${userId}
          AND d.status = 'DONE'
          AND c.embedding IS NOT NULL
          AND (1 - (c.embedding <=> ${queryVector}::vector)) >= ${input.minScore}
        ORDER BY c.embedding <=> ${queryVector}::vector ASC
        LIMIT ${input.topK}
      `;

      return {
        hits: rows.map((row) => ({
          chunkId: row.chunkId,
          documentId: row.documentId,
          documentName: row.documentName,
          content: row.content,
          score: Number(row.score),
          metadata: this.toMetadataRecord(row.metadata),
        })),
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

  private toMetadataRecord(metadata: unknown): Record<string, unknown> {
    if (
      typeof metadata === 'object' &&
      metadata !== null &&
      !Array.isArray(metadata)
    ) {
      return metadata as Record<string, unknown>;
    }

    return {};
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
