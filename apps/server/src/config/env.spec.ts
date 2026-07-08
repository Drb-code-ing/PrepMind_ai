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

  it('accepts qwen embedding provider settings', () => {
    const env = parseEnv({
      ...requiredEnv,
      RAG_EMBEDDING_PROVIDER: 'qwen',
      RAG_EMBEDDING_MODEL: 'text-embedding-v4',
      RAG_EMBEDDING_BASE_URL:
        'https://ws-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
      Qwen_API_KEY: '  test-qwen-key  ',
    });

    expect(env.RAG_EMBEDDING_PROVIDER).toBe('qwen');
    expect(env.RAG_EMBEDDING_MODEL).toBe('text-embedding-v4');
    expect(env.RAG_EMBEDDING_BASE_URL).toBe(
      'https://ws-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
    );
    expect(env.Qwen_API_KEY).toBe('test-qwen-key');
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

  it('enables worker observability by default only outside production', () => {
    expect(parseEnv(requiredEnv).WORKER_OBSERVABILITY_ENABLED).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
      }).WORKER_OBSERVABILITY_ENABLED,
    ).toBe(false);
  });

  it('allows explicit worker observability enablement overrides', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        WORKER_OBSERVABILITY_ENABLED: 'true',
      }).WORKER_OBSERVABILITY_ENABLED,
    ).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'development',
        WORKER_OBSERVABILITY_ENABLED: 'false',
      }).WORKER_OBSERVABILITY_ENABLED,
    ).toBe(false);
  });

  it('enables outbox dispatcher by default outside production', () => {
    const env = parseEnv(requiredEnv);

    expect(env.OUTBOX_DISPATCHER_ENABLED).toBe(true);
    expect(env.OUTBOX_DISPATCHER_INTERVAL_MS).toBe(5000);
    expect(env.OUTBOX_DISPATCHER_BATCH_SIZE).toBe(20);
    expect(env.OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS).toBe(300000);
  });

  it('disables outbox dispatcher by default in production', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
      }).OUTBOX_DISPATCHER_ENABLED,
    ).toBe(false);
  });

  it('allows explicit outbox dispatcher enablement overrides', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        OUTBOX_DISPATCHER_ENABLED: 'true',
      }).OUTBOX_DISPATCHER_ENABLED,
    ).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'development',
        OUTBOX_DISPATCHER_ENABLED: 'false',
      }).OUTBOX_DISPATCHER_ENABLED,
    ).toBe(false);
  });

  it('parses outbox dispatcher numeric controls', () => {
    const env = parseEnv({
      ...requiredEnv,
      OUTBOX_DISPATCHER_INTERVAL_MS: '1500',
      OUTBOX_DISPATCHER_BATCH_SIZE: '7',
      OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS: '45000',
    });

    expect(env.OUTBOX_DISPATCHER_INTERVAL_MS).toBe(1500);
    expect(env.OUTBOX_DISPATCHER_BATCH_SIZE).toBe(7);
    expect(env.OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS).toBe(45000);
  });

  it('enables outbox ops by default outside production', () => {
    expect(parseEnv(requiredEnv).OUTBOX_OPS_ENABLED).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'test',
      }).OUTBOX_OPS_ENABLED,
    ).toBe(true);
  });

  it('disables outbox ops by default in production', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
      }).OUTBOX_OPS_ENABLED,
    ).toBe(false);
  });

  it('allows explicit outbox ops enablement overrides', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        OUTBOX_OPS_ENABLED: 'true',
      }).OUTBOX_OPS_ENABLED,
    ).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'development',
        OUTBOX_OPS_ENABLED: 'false',
      }).OUTBOX_OPS_ENABLED,
    ).toBe(false);
  });

  it('enables worker readiness by default outside production', () => {
    expect(parseEnv(requiredEnv).WORKER_READINESS_ENABLED).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'test',
      }).WORKER_READINESS_ENABLED,
    ).toBe(true);
  });

  it('disables worker readiness by default in production', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
      }).WORKER_READINESS_ENABLED,
    ).toBe(false);
  });

  it('allows explicit worker readiness overrides and treats blanks as unset', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        WORKER_READINESS_ENABLED: 'true',
      }).WORKER_READINESS_ENABLED,
    ).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'development',
        WORKER_READINESS_ENABLED: 'false',
      }).WORKER_READINESS_ENABLED,
    ).toBe(false);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'development',
        WORKER_READINESS_ENABLED: '   ',
      }).WORKER_READINESS_ENABLED,
    ).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        WORKER_READINESS_ENABLED: '',
      }).WORKER_READINESS_ENABLED,
    ).toBe(false);
  });
});
