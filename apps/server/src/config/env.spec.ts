import { parseEnv } from './env';

describe('parseEnv', () => {
  const requiredEnv = {
    DATABASE_URL: 'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind',
    JWT_SECRET: 'dev-secret-change-me',
  };

  it('applies RAG env defaults', () => {
    const env = parseEnv(requiredEnv);

    expect(env).toMatchObject({
      RAG_EMBEDDING_PROVIDER: 'openai',
      RAG_EMBEDDING_MODEL: 'text-embedding-3-small',
      RAG_EMBEDDING_DIMENSIONS: 1536,
      RAG_EMBEDDING_BATCH_SIZE: 32,
      RAG_CHUNK_TARGET_TOKENS: 650,
      RAG_CHUNK_OVERLAP_TOKENS: 80,
      RAG_CHUNK_MAX_TOKENS: 900,
      RAG_MAX_CHUNKS_PER_DOCUMENT: 500,
    });
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it('rejects embedding dimensions other than 1536', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        RAG_EMBEDDING_DIMENSIONS: 1024,
      }),
    ).toThrow();
  });

  it('rejects invalid chunk token relationships', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        RAG_CHUNK_OVERLAP_TOKENS: 650,
        RAG_CHUNK_TARGET_TOKENS: 650,
        RAG_CHUNK_MAX_TOKENS: 900,
      }),
    ).toThrow();

    expect(() =>
      parseEnv({
        ...requiredEnv,
        RAG_CHUNK_OVERLAP_TOKENS: 80,
        RAG_CHUNK_TARGET_TOKENS: 901,
        RAG_CHUNK_MAX_TOKENS: 900,
      }),
    ).toThrow();
  });

  it('normalizes blank OpenAI API keys to undefined and trims non-empty keys', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        OPENAI_API_KEY: '   ',
      }).OPENAI_API_KEY,
    ).toBeUndefined();

    expect(
      parseEnv({
        ...requiredEnv,
        OPENAI_API_KEY: '  test-openai-key  ',
      }).OPENAI_API_KEY,
    ).toBe('test-openai-key');
  });
});
