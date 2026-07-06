import { HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { ServerEnv } from '../config/env';
import {
  EmbeddingService,
  type ServerEmbeddingProvider,
} from './embedding.service';

type EmbedBatchMock = jest.Mock<Promise<number[][]>, [string[]]>;

var mockEmbeddingsCreate = jest.fn();
var mockOpenAI = jest.fn(() => ({
  embeddings: {
    create: mockEmbeddingsCreate,
  },
}));

jest.mock('openai', () => ({
  __esModule: true,
  default: function OpenAIConstructor(...args: unknown[]) {
    return mockOpenAI(...args);
  },
}));

describe('EmbeddingService', () => {
  const configValues: Pick<
    ServerEnv,
    | 'RAG_EMBEDDING_DIMENSIONS'
    | 'RAG_EMBEDDING_BATCH_SIZE'
    | 'RAG_EMBEDDING_MODEL'
    | 'RAG_EMBEDDING_PROVIDER'
    | 'RAG_EMBEDDING_BASE_URL'
    | 'OPENAI_API_KEY'
    | 'Qwen_API_KEY'
  > = {
    RAG_EMBEDDING_DIMENSIONS: 3,
    RAG_EMBEDDING_BATCH_SIZE: 2,
    RAG_EMBEDDING_MODEL: 'fake-model',
    RAG_EMBEDDING_PROVIDER: 'openai',
    RAG_EMBEDDING_BASE_URL: undefined,
    OPENAI_API_KEY: 'test-openai-key',
    Qwen_API_KEY: undefined,
  };

  function createConfig(
    overrides: Partial<typeof configValues> = {},
  ): ConfigService<ServerEnv, true> {
    const values = { ...configValues, ...overrides };
    return {
      get: jest.fn((key: keyof typeof values) => values[key]),
    } as unknown as ConfigService<ServerEnv, true>;
  }

  function createProvider(
    embedBatch: EmbedBatchMock,
    dimensions = 3,
  ): ServerEmbeddingProvider {
    return {
      model: 'fake-provider',
      dimensions,
      embedBatch,
    };
  }

  beforeEach(() => {
    mockEmbeddingsCreate.mockReset();
    mockOpenAI.mockClear();
  });

  it('embeds chunks in configured batches with an injected provider', async () => {
    const embedBatch = jest
      .fn<Promise<number[][]>, [string[]]>()
      .mockImplementation((texts) =>
        Promise.resolve(texts.map((_, index) => [index, index + 1, index + 2])),
      );
    const service = new EmbeddingService(
      createConfig(),
      createProvider(embedBatch),
    );

    const result = await service.embedChunks(['a', 'b', 'c']);

    expect(embedBatch).toHaveBeenCalledTimes(2);
    expect(embedBatch).toHaveBeenNthCalledWith(1, ['a', 'b']);
    expect(embedBatch).toHaveBeenNthCalledWith(2, ['c']);
    expect(result).toEqual([
      [0, 1, 2],
      [1, 2, 3],
      [0, 1, 2],
    ]);
  });

  it('wraps provider failures as stable embedding errors', async () => {
    const embedBatch = jest
      .fn<Promise<number[][]>, [string[]]>()
      .mockRejectedValue(new Error('provider down'));
    const service = new EmbeddingService(
      createConfig(),
      createProvider(embedBatch),
    );

    await expect(service.embedChunks(['a'])).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });
  });

  it('rejects provider dimension mismatch before embedding', async () => {
    const embedBatch = jest.fn<Promise<number[][]>, [string[]]>();
    const service = new EmbeddingService(
      createConfig(),
      createProvider(embedBatch, 2),
    );

    await expect(service.embedChunks(['a'])).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });
    expect(embedBatch).not.toHaveBeenCalled();
  });

  it('rejects embedding count mismatch', async () => {
    const embedBatch = jest
      .fn<Promise<number[][]>, [string[]]>()
      .mockResolvedValue([[0, 1, 2]]);
    const service = new EmbeddingService(
      createConfig(),
      createProvider(embedBatch),
    );

    await expect(service.embedChunks(['a', 'b'])).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });
  });

  it('rejects vector dimension mismatch and non-finite values', async () => {
    const wrongDimensionBatch = jest
      .fn<Promise<number[][]>, [string[]]>()
      .mockResolvedValue([[0, 1]]);
    const wrongDimensions = new EmbeddingService(
      createConfig(),
      createProvider(wrongDimensionBatch),
    );
    await expect(wrongDimensions.embedChunks(['a'])).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });

    const nonFiniteBatch = jest
      .fn<Promise<number[][]>, [string[]]>()
      .mockResolvedValue([[0, Number.NaN, 2]]);
    const nonFinite = new EmbeddingService(
      createConfig(),
      createProvider(nonFiniteBatch),
    );
    await expect(nonFinite.embedChunks(['a'])).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });
  });

  it('rejects missing api key when no provider is injected', async () => {
    const service = new EmbeddingService(
      createConfig({ OPENAI_API_KEY: undefined }),
      undefined,
    );

    await expect(service.embedChunks(['a'])).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });
  });

  it('uses Qwen API key and base URL for the qwen provider', async () => {
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: [1, 0, 0] }],
    });
    const service = new EmbeddingService(
      createConfig({
        RAG_EMBEDDING_PROVIDER: 'qwen',
        RAG_EMBEDDING_MODEL: 'text-embedding-v4',
        RAG_EMBEDDING_BASE_URL:
          'https://ws-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
        OPENAI_API_KEY: undefined,
        Qwen_API_KEY: 'test-qwen-key',
      }),
      undefined,
    );

    await expect(service.embedChunks(['a'])).resolves.toEqual([[1, 0, 0]]);
    expect(mockOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-qwen-key',
      baseURL:
        'https://ws-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
    });
    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      model: 'text-embedding-v4',
      input: ['a'],
      dimensions: 3,
    });
  });

  it('rejects missing Qwen API key for the qwen provider', async () => {
    const service = new EmbeddingService(
      createConfig({
        RAG_EMBEDDING_PROVIDER: 'qwen',
        RAG_EMBEDDING_MODEL: 'text-embedding-v4',
        RAG_EMBEDDING_BASE_URL:
          'https://ws-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
        OPENAI_API_KEY: undefined,
        Qwen_API_KEY: undefined,
      }),
      undefined,
    );

    await expect(service.embedChunks(['a'])).rejects.toMatchObject({
      code: 'KNOWLEDGE_EMBEDDING_FAILED',
      statusCode: HttpStatus.BAD_GATEWAY,
    });
  });

  it('generates deterministic fake embeddings without an OpenAI API key', async () => {
    const service = new EmbeddingService(
      createConfig({
        OPENAI_API_KEY: undefined,
        RAG_EMBEDDING_PROVIDER: 'fake',
      }),
      undefined,
    );

    const [first, second, different] = await service.embedChunks([
      'green theorem smoke',
      'green theorem smoke',
      'linear algebra matrix',
    ]);

    expect(first).toHaveLength(3);
    expect(first).toEqual(second);
    expect(first).not.toEqual(different);
    expect(first.every(Number.isFinite)).toBe(true);
  });
});
