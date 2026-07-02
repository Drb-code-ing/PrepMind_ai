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

  it('accepts the fake embedding provider for local knowledge browser smoke tests', () => {
    const env = parseEnv({
      ...requiredEnv,
      RAG_EMBEDDING_PROVIDER: 'fake',
    });

    expect(env.RAG_EMBEDDING_PROVIDER).toBe('fake');
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it('rejects the fake embedding provider in production', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        RAG_EMBEDDING_PROVIDER: 'fake',
      }),
    ).toThrow();
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

  it('enables Swagger by default outside production', () => {
    expect(parseEnv(requiredEnv).SWAGGER_ENABLED).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'test',
      }).SWAGGER_ENABLED,
    ).toBe(true);
  });

  it('disables Swagger by default in production', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
      }).SWAGGER_ENABLED,
    ).toBe(false);
  });

  it('allows explicit Swagger enablement overrides', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        SWAGGER_ENABLED: 'true',
      }).SWAGGER_ENABLED,
    ).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'development',
        SWAGGER_ENABLED: 'false',
      }).SWAGGER_ENABLED,
    ).toBe(false);
  });

  it('treats blank Swagger enablement as unset', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'development',
        SWAGGER_ENABLED: '   ',
      }).SWAGGER_ENABLED,
    ).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        SWAGGER_ENABLED: '',
      }).SWAGGER_ENABLED,
    ).toBe(false);
  });
});
