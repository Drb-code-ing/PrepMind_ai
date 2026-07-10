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
        OPERATOR_AUDIT_FINGERPRINT_SECRET:
          'production-outbox-fingerprint-secret-32',
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

  it('enables operator audit by default outside production', () => {
    expect(parseEnv(requiredEnv).OPERATOR_AUDIT_ENABLED).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'test',
      }).OPERATOR_AUDIT_ENABLED,
    ).toBe(true);
  });

  it('disables operator audit by default in production', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
      }).OPERATOR_AUDIT_ENABLED,
    ).toBe(false);
  });

  it('allows explicit operator audit overrides and treats blanks as unset', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        OPERATOR_AUDIT_ENABLED: 'true',
        OPERATOR_AUDIT_FINGERPRINT_SECRET:
          'production-operator-fingerprint-secret-32',
      }).OPERATOR_AUDIT_ENABLED,
    ).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'development',
        OPERATOR_AUDIT_ENABLED: 'false',
      }).OPERATOR_AUDIT_ENABLED,
    ).toBe(false);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'development',
        OPERATOR_AUDIT_ENABLED: '   ',
      }).OPERATOR_AUDIT_ENABLED,
    ).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        OPERATOR_AUDIT_ENABLED: '',
      }).OPERATOR_AUDIT_ENABLED,
    ).toBe(false);
  });

  it('parses bounded operator audit export defaults with local-only fingerprinting', () => {
    expect(parseEnv(requiredEnv)).toMatchObject({
      OPERATOR_AUDIT_EXPORT_ENABLED: false,
      OPERATOR_AUDIT_MAINTENANCE_ENABLED: false,
      OPERATOR_AUDIT_RETENTION_DAYS: 180,
      OPERATOR_AUDIT_EXPORT_TTL_HOURS: 24,
      OPERATOR_AUDIT_EXPORT_MAX_RANGE_DAYS: 31,
      OPERATOR_AUDIT_EXPORT_MAX_RECORDS: 50000,
      OPERATOR_AUDIT_EXPORT_MAX_ARCHIVE_BYTES: 67108864,
      OPERATOR_AUDIT_EXPORT_PER_ADMIN_ACTIVE_LIMIT: 2,
      OPERATOR_AUDIT_EXPORT_PER_ADMIN_HOURLY_LIMIT: 10,
      OPERATOR_AUDIT_EXPORT_GLOBAL_ACTIVE_LIMIT: 10,
      OPERATOR_AUDIT_EXPORT_WORKER_CONCURRENCY: 1,
      OPERATOR_AUDIT_EXPORT_BULL_LOCK_MS: 600000,
      OPERATOR_AUDIT_EXPORT_LEASE_MS: 300000,
      OPERATOR_AUDIT_EXPORT_STALE_AFTER_MS: 3600000,
      OPERATOR_AUDIT_EXPORT_DELIVERY_RECOVERY_HOURS: 24,
      OPERATOR_AUDIT_EXPORT_QUERY_TIMEOUT_MS: 120000,
      OPERATOR_AUDIT_FINGERPRINT_SECRET:
        'local-dev-audit-fingerprint-change-me',
    });
  });

  it('keeps export and maintenance gates disabled by default in every environment', () => {
    for (const NODE_ENV of ['development', 'test', 'production'] as const) {
      const env = parseEnv({ ...requiredEnv, NODE_ENV });
      expect(env.OPERATOR_AUDIT_EXPORT_ENABLED).toBe(false);
      expect(env.OPERATOR_AUDIT_MAINTENANCE_ENABLED).toBe(false);
    }
  });

  it('requires a fingerprint secret for production operator audit queries', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        OPERATOR_AUDIT_ENABLED: 'true',
      }),
    ).toThrow();
  });

  it('requires a fingerprint secret for production outbox operations', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        OUTBOX_OPS_ENABLED: 'true',
      }),
    ).toThrow();
  });

  it('requires a fingerprint secret for production audit export API', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        SERVER_ROLE: 'api',
        OPERATOR_AUDIT_EXPORT_ENABLED: 'true',
      }),
    ).toThrow();
  });

  it('requires at least 32 trimmed characters for the fingerprint secret', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        OPERATOR_AUDIT_FINGERPRINT_SECRET: 'x',
      }),
    ).toThrow();

    expect(() =>
      parseEnv({
        ...requiredEnv,
        OPERATOR_AUDIT_FINGERPRINT_SECRET: 'short-production-secret',
      }),
    ).toThrow();

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        OPERATOR_AUDIT_ENABLED: 'true',
        OPERATOR_AUDIT_FINGERPRINT_SECRET:
          '  production-hmac-secret-at-least-32  ',
      }).OPERATOR_AUDIT_FINGERPRINT_SECRET,
    ).toBe('production-hmac-secret-at-least-32');

    expect(
      parseEnv(requiredEnv).OPERATOR_AUDIT_FINGERPRINT_SECRET?.length,
    ).toBeGreaterThanOrEqual(32);
  });

  it('rejects unsafe relative export timing thresholds', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        OPERATOR_AUDIT_EXPORT_LEASE_MS: 600000,
        OPERATOR_AUDIT_EXPORT_BULL_LOCK_MS: 600000,
      }),
    ).toThrow();

    expect(() =>
      parseEnv({
        ...requiredEnv,
        OPERATOR_AUDIT_EXPORT_STALE_AFTER_MS: 600000,
        OPERATOR_AUDIT_EXPORT_BULL_LOCK_MS: 600000,
      }),
    ).toThrow();

    expect(() =>
      parseEnv({
        ...requiredEnv,
        OPERATOR_AUDIT_EXPORT_QUERY_TIMEOUT_MS: 3600000,
        OPERATOR_AUDIT_EXPORT_STALE_AFTER_MS: 3600000,
      }),
    ).toThrow();
  });

  it('requires dispatcher and maintenance for export-capable worker roles', () => {
    for (const SERVER_ROLE of ['worker', 'both'] as const) {
      expect(() =>
        parseEnv({
          ...requiredEnv,
          SERVER_ROLE,
          OPERATOR_AUDIT_EXPORT_ENABLED: 'true',
          OUTBOX_DISPATCHER_ENABLED: 'false',
          OPERATOR_AUDIT_MAINTENANCE_ENABLED: 'true',
        }),
      ).toThrow();

      expect(() =>
        parseEnv({
          ...requiredEnv,
          SERVER_ROLE,
          OPERATOR_AUDIT_EXPORT_ENABLED: 'true',
          OUTBOX_DISPATCHER_ENABLED: 'true',
          OPERATOR_AUDIT_MAINTENANCE_ENABLED: 'false',
        }),
      ).toThrow();

      expect(
        parseEnv({
          ...requiredEnv,
          SERVER_ROLE,
          OPERATOR_AUDIT_EXPORT_ENABLED: 'true',
          OUTBOX_DISPATCHER_ENABLED: 'true',
          OPERATOR_AUDIT_MAINTENANCE_ENABLED: 'true',
        }).OPERATOR_AUDIT_EXPORT_ENABLED,
      ).toBe(true);
    }
  });
});
