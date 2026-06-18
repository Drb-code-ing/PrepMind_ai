import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';

export type PersistableChunk = {
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  index: number;
  tokenCount: number;
};

@Injectable()
export class ChunkPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<ServerEnv, true>,
  ) {}

  async replaceDocumentChunks(input: {
    documentId: string;
    userId: string;
    chunks: PersistableChunk[];
  }): Promise<void> {
    this.assertChunkLimit(input.chunks.length);
    const rows = input.chunks.map((chunk) =>
      this.createChunkRow(input.documentId, input.userId, chunk),
    );

    await this.prisma.$transaction(async (transaction) => {
      await transaction.chunk.deleteMany({
        where: { documentId: input.documentId, userId: input.userId },
      });

      for (const row of rows) {
        await transaction.$executeRaw`
          INSERT INTO "Chunk"
            ("id", "documentId", "content", "embedding", "metadata", "index", "tokenCount", "userId", "createdAt")
          VALUES
            (${row.id}, ${row.documentId}, ${row.content}, ${row.embedding}::vector, ${row.metadata}::jsonb, ${row.index}, ${row.tokenCount}, ${row.userId}, ${row.createdAt})
        `;
      }
    });
  }

  private assertChunkLimit(chunkCount: number) {
    const maxChunks = this.configService.get('RAG_MAX_CHUNKS_PER_DOCUMENT', {
      infer: true,
    });

    if (chunkCount > maxChunks) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_TOO_MANY_CHUNKS',
        '资料分块数量超过上限',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private createChunkRow(
    documentId: string,
    userId: string,
    chunk: PersistableChunk,
  ) {
    return {
      id: randomUUID(),
      documentId,
      content: chunk.content,
      embedding: this.toPgVectorLiteral(chunk.embedding),
      metadata: JSON.stringify(chunk.metadata),
      index: chunk.index,
      tokenCount: chunk.tokenCount,
      userId,
      createdAt: new Date(),
    };
  }

  private toPgVectorLiteral(vector: number[]) {
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
}
