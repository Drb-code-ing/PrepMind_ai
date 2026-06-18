import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  assertEmbeddingBatchDimensions,
  type EmbeddingProvider,
} from '@repo/rag';
import OpenAI from 'openai';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';

export type ServerEmbeddingProvider = EmbeddingProvider;

export const EMBEDDING_PROVIDER = 'EMBEDDING_PROVIDER';

@Injectable()
export class EmbeddingService {
  constructor(
    private readonly configService: ConfigService<ServerEnv, true>,
    @Inject(EMBEDDING_PROVIDER)
    private readonly injectedProvider?: ServerEmbeddingProvider,
  ) {}

  async embedChunks(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const dimensions = this.configService.get('RAG_EMBEDDING_DIMENSIONS', {
      infer: true,
    });
    const batchSize = this.configService.get('RAG_EMBEDDING_BATCH_SIZE', {
      infer: true,
    });
    const provider = this.resolveProvider(dimensions);
    const embeddings: number[][] = [];

    for (let index = 0; index < texts.length; index += batchSize) {
      const batch = texts.slice(index, index + batchSize);
      const vectors = await this.embedBatch(provider, batch);
      embeddings.push(...vectors);
    }

    return embeddings;
  }

  private resolveProvider(dimensions: number): ServerEmbeddingProvider {
    const provider =
      this.injectedProvider ?? this.createOpenAiProvider(dimensions);

    if (provider.dimensions !== dimensions) {
      throw this.createEmbeddingError(
        `Embedding provider dimension ${provider.dimensions} does not match ${dimensions}`,
      );
    }

    return provider;
  }

  private createOpenAiProvider(dimensions: number): ServerEmbeddingProvider {
    const apiKey = this.configService.get('OPENAI_API_KEY', { infer: true });
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw this.createEmbeddingError('OpenAI API key is not configured');
    }

    const model = this.configService.get('RAG_EMBEDDING_MODEL', {
      infer: true,
    });
    const client = new OpenAI({ apiKey: apiKey.trim() });

    return {
      model,
      dimensions,
      embedBatch: async (texts) => {
        const response = await client.embeddings.create({
          model,
          input: texts,
          dimensions,
        });
        return response.data.map((item) => item.embedding);
      },
    };
  }

  private async embedBatch(
    provider: ServerEmbeddingProvider,
    texts: string[],
  ): Promise<number[][]> {
    try {
      const vectors = await provider.embedBatch(texts);
      const dimensions = this.configService.get('RAG_EMBEDDING_DIMENSIONS', {
        infer: true,
      });
      assertEmbeddingBatchDimensions(vectors, dimensions, texts.length);
      return vectors;
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === 'KNOWLEDGE_EMBEDDING_FAILED'
      ) {
        throw error;
      }

      throw this.createEmbeddingError(
        'Knowledge embedding generation failed',
        error,
      );
    }
  }

  private createEmbeddingError(message: string, cause?: unknown) {
    const error = new AppError(
      'KNOWLEDGE_EMBEDDING_FAILED',
      message,
      HttpStatus.BAD_GATEWAY,
    );
    (error as AppError & { cause?: unknown }).cause = cause;
    return error;
  }
}
