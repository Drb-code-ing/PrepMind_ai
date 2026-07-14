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
    const provider = this.injectedProvider ?? this.createProvider(dimensions);

    if (provider.dimensions !== dimensions) {
      throw this.createEmbeddingError(
        `Embedding provider dimension ${provider.dimensions} does not match ${dimensions}`,
      );
    }

    return provider;
  }

  private createProvider(dimensions: number): ServerEmbeddingProvider {
    const providerName = this.configService.get('RAG_EMBEDDING_PROVIDER', {
      infer: true,
    });

    if (providerName === 'fake') {
      return this.createFakeProvider(dimensions);
    }

    if (providerName === 'qwen') {
      return this.createQwenProvider(dimensions);
    }

    return this.createOpenAiProvider(dimensions);
  }

  private createOpenAiProvider(dimensions: number): ServerEmbeddingProvider {
    const apiKey = this.configService.get('OPENAI_API_KEY', { infer: true });
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw this.createEmbeddingError('OpenAI API key is not configured');
    }

    const model = this.configService.get('RAG_EMBEDDING_MODEL', {
      infer: true,
    });
    const client = new OpenAI({
      apiKey: apiKey.trim(),
      timeout: this.getRequestTimeoutMs(),
    });

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

  private createQwenProvider(dimensions: number): ServerEmbeddingProvider {
    const apiKey = this.getQwenApiKey();
    if (!apiKey) {
      throw this.createEmbeddingError('Qwen API key is not configured');
    }

    const baseURL = this.configService.get('RAG_EMBEDDING_BASE_URL', {
      infer: true,
    });
    if (typeof baseURL !== 'string' || baseURL.trim().length === 0) {
      throw this.createEmbeddingError(
        'Qwen embedding base URL is not configured',
      );
    }

    const model = this.configService.get('RAG_EMBEDDING_MODEL', {
      infer: true,
    });
    const client = new OpenAI({
      apiKey,
      baseURL: baseURL.trim(),
      timeout: this.getRequestTimeoutMs(),
    });

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

  private getQwenApiKey() {
    const candidates = [
      this.configService.get('Qwen_API_KEY', { infer: true }),
      this.configService.get('QWEN_API_KEY', { infer: true }),
      this.configService.get('DASHSCOPE_API_KEY', { infer: true }),
    ];

    const apiKey = candidates.find(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    );

    return apiKey?.trim();
  }

  private getRequestTimeoutMs() {
    return this.configService.get('EMBEDDING_REQUEST_TIMEOUT_MS', {
      infer: true,
    });
  }

  private createFakeProvider(dimensions: number): ServerEmbeddingProvider {
    const model = this.configService.get('RAG_EMBEDDING_MODEL', {
      infer: true,
    });

    return {
      model: `fake:${model}`,
      dimensions,
      embedBatch: (texts) =>
        Promise.resolve(
          texts.map((text) => this.createFakeEmbedding(text, dimensions)),
        ),
    };
  }

  private createFakeEmbedding(text: string, dimensions: number): number[] {
    const vector = Array.from({ length: dimensions }, () => 0);
    const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const features = tokens.length > 0 ? tokens : Array.from(text);

    if (features.length === 0) {
      vector[0] = 1;
      return vector;
    }

    for (const feature of features) {
      const hash = this.hashFeature(feature);
      const primaryIndex = hash % dimensions;
      const secondaryIndex = (hash >>> 8) % dimensions;
      const sign = (hash & 1) === 0 ? 1 : -1;

      vector[primaryIndex] += sign;
      vector[secondaryIndex] += sign * 0.5;
    }

    const magnitude = Math.hypot(...vector);
    if (magnitude === 0) {
      vector[0] = 1;
      return vector;
    }

    return vector.map((value) => value / magnitude);
  }

  private hashFeature(feature: string): number {
    let hash = 2166136261;
    for (const char of feature) {
      hash ^= char.codePointAt(0) ?? 0;
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
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
