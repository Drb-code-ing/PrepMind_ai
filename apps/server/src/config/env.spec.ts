import { ZodError } from 'zod';

import { parseEnv } from './env';

describe('parseEnv', () => {
  const requiredEnv = {
    DATABASE_URL: 'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind',
    JWT_SECRET: 'dev-secret-change-me',
  };
  const productionEnv = {
    ...requiredEnv,
    NODE_ENV: 'production' as const,
    RAG_EMBEDDING_PROVIDER: 'openai' as const,
    RAG_EMBEDDING_MODEL: 'text-embedding-3-small',
    OPENAI_API_KEY: 'production-openai-key',
  };

  function captureZodError(config: Record<string, unknown>) {
    try {
      parseEnv(config);
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      return error as ZodError;
    }

    throw new Error('Expected parseEnv to reject the configuration');
  }

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

  it('applies safe conversation summary model defaults', () => {
    expect(parseEnv(requiredEnv)).toMatchObject({
      AI_PROVIDER_MODE: 'mock',
      AI_ENABLE_LIVE_CALLS: false,
      AI_MODEL: 'deepseek-v4-flash',
      AI_BASE_URL: 'https://api.deepseek.com/v1',
      CONVERSATION_SUMMARY_MAX_CALLS: 1,
      CONVERSATION_SUMMARY_MAX_INPUT_TOKENS: 1600,
      CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS: 400,
      CONVERSATION_SUMMARY_TIMEOUT_MS: 8000,
      REVIEW_AGENT_MODEL_ENABLED: false,
      PLANNER_AGENT_MODEL_ENABLED: false,
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED: false,
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_COMPONENT: '',
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_CAPABILITY_SHA256: '',
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS: 0,
      REVIEW_AGENT_MODEL_TIMEOUT_MS: 4500,
      PLANNER_AGENT_MODEL_TIMEOUT_MS: 4500,
      KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: false,
      KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: false,
      KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS: 4500,
      KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: 4500,
    });
  });

  it('validates Knowledge Agent gates and bounded model timeouts', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: 'true',
        KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: 'false',
        KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS: '1000',
        KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: '15000',
      }),
    ).toMatchObject({
      KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: true,
      KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: false,
      KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS: 1000,
      KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: 15000,
    });
    expect(() =>
      parseEnv({
        ...requiredEnv,
        KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS: 999,
      }),
    ).toThrow();
    expect(() =>
      parseEnv({
        ...requiredEnv,
        KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: 15001,
      }),
    ).toThrow();
  });

  it('normalizes the dedicated server-only Knowledge Agent credential', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        KNOWLEDGE_AGENT_DEEPSEEK_API_KEY: '  synthetic-knowledge-key  ',
      }).KNOWLEDGE_AGENT_DEEPSEEK_API_KEY,
    ).toBe('synthetic-knowledge-key');
    expect(
      parseEnv({
        ...requiredEnv,
        KNOWLEDGE_AGENT_DEEPSEEK_API_KEY: '   ',
      }).KNOWLEDGE_AGENT_DEEPSEEK_API_KEY,
    ).toBeUndefined();
  });

  it('rejects out-of-range Review and Planner model timeouts while keeping gates default-off', () => {
    expect(() =>
      parseEnv({ ...requiredEnv, REVIEW_AGENT_MODEL_TIMEOUT_MS: 999 }),
    ).toThrow();
    expect(() =>
      parseEnv({ ...requiredEnv, PLANNER_AGENT_MODEL_TIMEOUT_MS: 15001 }),
    ).toThrow();
    expect(parseEnv(requiredEnv)).toMatchObject({
      REVIEW_AGENT_MODEL_ENABLED: false,
      PLANNER_AGENT_MODEL_ENABLED: false,
    });
  });

  it('accepts only an exact server-only Review product acceptance configuration', () => {
    const hash = 'a'.repeat(64);
    expect(
      parseEnv({
        ...requiredEnv,
        SERVER_ROLE: 'api',
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: 'true',
        AI_MODEL: 'deepseek-v4-pro',
        AI_BASE_URL: 'https://api.deepseek.com/v1',
        DEEPSEEK_API_KEY: 'acceptance-deepseek-key',
        REVIEW_AGENT_MODEL_ENABLED: 'true',
        PLANNER_AGENT_MODEL_ENABLED: 'false',
        REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED: 'true',
        REVIEW_PLANNER_PRODUCT_ACCEPTANCE_COMPONENT: 'review',
        REVIEW_PLANNER_PRODUCT_ACCEPTANCE_CAPABILITY_SHA256: hash,
        REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS: '2',
      }),
    ).toMatchObject({
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED: true,
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_COMPONENT: 'review',
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_CAPABILITY_SHA256: hash,
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS: 2,
    });
  });

  it.each([
    { SERVER_ROLE: 'worker' },
    { SERVER_ROLE: 'both' },
    { REVIEW_PLANNER_PRODUCT_ACCEPTANCE_COMPONENT: '' },
    { REVIEW_PLANNER_PRODUCT_ACCEPTANCE_COMPONENT: 'planner' },
    { REVIEW_PLANNER_PRODUCT_ACCEPTANCE_CAPABILITY_SHA256: 'A'.repeat(64) },
    { REVIEW_PLANNER_PRODUCT_ACCEPTANCE_CAPABILITY_SHA256: 'a'.repeat(63) },
    { REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS: '0' },
    { REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS: '1' },
    { REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS: '3' },
    { REVIEW_AGENT_MODEL_ENABLED: 'false' },
    { PLANNER_AGENT_MODEL_ENABLED: 'true' },
    { AI_PROVIDER_MODE: 'mock' },
    { AI_ENABLE_LIVE_CALLS: 'false' },
    { AI_MODEL: 'deepseek-v4-flash' },
    { AI_BASE_URL: 'https://api.openai.com/v1' },
    { DEEPSEEK_API_KEY: '' },
    { OPENAI_API_KEY: 'acceptance-openai-key' },
    { KNOWLEDGE_AGENT_DEEPSEEK_API_KEY: 'knowledge-key-must-be-isolated' },
    { KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: 'true' },
    { KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: 'true' },
    { REVIEW_AGENT_MODEL_TIMEOUT_MS: '4499' },
    { PLANNER_AGENT_MODEL_TIMEOUT_MS: '4501' },
  ])(
    'rejects invalid enabled product acceptance combination %#',
    (override) => {
      expect(() =>
        parseEnv({
          ...requiredEnv,
          SERVER_ROLE: 'api',
          AI_PROVIDER_MODE: 'live',
          AI_ENABLE_LIVE_CALLS: 'true',
          AI_MODEL: 'deepseek-v4-pro',
          AI_BASE_URL: 'https://api.deepseek.com/v1',
          DEEPSEEK_API_KEY: 'acceptance-deepseek-key',
          REVIEW_AGENT_MODEL_ENABLED: 'true',
          PLANNER_AGENT_MODEL_ENABLED: 'false',
          REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED: 'true',
          REVIEW_PLANNER_PRODUCT_ACCEPTANCE_COMPONENT: 'review',
          REVIEW_PLANNER_PRODUCT_ACCEPTANCE_CAPABILITY_SHA256: 'a'.repeat(64),
          REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS: '2',
          ...override,
        }),
      ).toThrow();
    },
  );

  it('requires an HTTPS provider and matching key only when summary live calls are enabled', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: 'true',
      }),
    ).toThrow();
    expect(() =>
      parseEnv({
        ...requiredEnv,
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: 'true',
        AI_BASE_URL: 'http://api.deepseek.com/v1',
        DEEPSEEK_API_KEY: 'test-key',
      }),
    ).toThrow();
    expect(
      parseEnv({
        ...requiredEnv,
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: 'true',
        DEEPSEEK_API_KEY: '  test-key  ',
      }).DEEPSEEK_API_KEY,
    ).toBe('test-key');
    expect(
      parseEnv({
        ...requiredEnv,
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: 'false',
      }).AI_PROVIDER_MODE,
    ).toBe('live');
    expect(
      parseEnv({
        ...requiredEnv,
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: 'true',
        KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: 'true',
        KNOWLEDGE_AGENT_DEEPSEEK_API_KEY: '  knowledge-live-key  ',
      }).KNOWLEDGE_AGENT_DEEPSEEK_API_KEY,
    ).toBe('knowledge-live-key');
    expect(() =>
      parseEnv({
        ...requiredEnv,
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: 'true',
        KNOWLEDGE_AGENT_DEEPSEEK_API_KEY: 'knowledge-key-without-gate',
      }),
    ).toThrow();
    expect(() =>
      parseEnv({
        ...requiredEnv,
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: 'true',
        DEEPSEEK_API_KEY: 'generic-key-cannot-serve-knowledge',
        KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: 'true',
      }),
    ).toThrow();
  });

  it('rejects mismatched or ambiguous live provider credentials', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: 'true',
        AI_BASE_URL: 'https://api.openai.com/v1',
        DEEPSEEK_API_KEY: 'wrong-provider-key',
      }),
    ).toThrow();
    expect(() =>
      parseEnv({
        ...requiredEnv,
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: 'true',
        AI_BASE_URL: 'https://proxy.deepseek.com/custom/v1',
        OPENAI_API_KEY: 'must-not-reach-deepseek',
      }),
    ).toThrow();
    expect(() =>
      parseEnv({
        ...requiredEnv,
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: 'true',
        AI_BASE_URL: 'https://models.example.com/v1',
        DEEPSEEK_API_KEY: 'deepseek-key',
        OPENAI_API_KEY: 'openai-key',
      }),
    ).toThrow();
  });

  it('rejects out-of-range conversation summary budgets', () => {
    for (const invalid of [
      { CONVERSATION_SUMMARY_MAX_CALLS: 2 },
      { CONVERSATION_SUMMARY_MAX_INPUT_TOKENS: 199 },
      { CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS: 801 },
      { CONVERSATION_SUMMARY_TIMEOUT_MS: 999 },
    ]) {
      expect(() => parseEnv({ ...requiredEnv, ...invalid })).toThrow();
    }
  });

  it('accepts the fake embedding provider for local knowledge browser smoke tests', () => {
    const env = parseEnv({
      ...requiredEnv,
      RAG_EMBEDDING_PROVIDER: 'fake',
    });

    expect(env.RAG_EMBEDDING_PROVIDER).toBe('fake');
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it('requires an explicit embedding provider and model in production', () => {
    const error = captureZodError({
      ...requiredEnv,
      NODE_ENV: 'production',
    });

    expect(error.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        ['RAG_EMBEDDING_PROVIDER'],
        ['RAG_EMBEDDING_MODEL'],
      ]),
    );
  });

  it.each(
    (['development', 'test'] as const).flatMap((NODE_ENV) =>
      (['openai', 'qwen'] as const).flatMap((provider) =>
        [undefined, '   '].map((model) => [NODE_ENV, provider, model] as const),
      ),
    ),
  )(
    'requires an explicit non-empty model for explicit %s %s embedding provider config (model=%p)',
    (NODE_ENV, provider, model) => {
      const error = captureZodError({
        ...requiredEnv,
        NODE_ENV,
        RAG_EMBEDDING_PROVIDER: provider,
        RAG_EMBEDDING_MODEL: model,
        RAG_EMBEDDING_BASE_URL: 'https://dashscope.example.com/compatible/v1',
        OPENAI_API_KEY: 'openai-key',
        QWEN_API_KEY: 'qwen-key',
      });

      expect(error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['RAG_EMBEDDING_MODEL'] }),
        ]),
      );
    },
  );

  it('requires a supported qwen key for an explicitly selected qwen provider', () => {
    const error = captureZodError({
      ...requiredEnv,
      RAG_EMBEDDING_PROVIDER: 'qwen',
      RAG_EMBEDDING_MODEL: 'text-embedding-v4',
      RAG_EMBEDDING_BASE_URL: 'https://dashscope.example.com/compatible/v1',
    });

    expect(error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['QWEN_API_KEY'] }),
      ]),
    );
  });

  it.each([
    ['QWEN_API_KEY', 'qwen-upper-key'],
    ['Qwen_API_KEY', 'qwen-compatible-key'],
    ['DASHSCOPE_API_KEY', 'dashscope-key'],
  ])('accepts %s for an explicitly selected qwen provider', (keyName, key) => {
    const env = parseEnv({
      ...requiredEnv,
      RAG_EMBEDDING_PROVIDER: 'qwen',
      RAG_EMBEDDING_MODEL: 'text-embedding-v4',
      RAG_EMBEDDING_BASE_URL: 'https://dashscope.example.com/compatible/v1',
      [keyName]: key,
    });

    expect(env.RAG_EMBEDDING_PROVIDER).toBe('qwen');
  });

  it.each([
    undefined,
    'http://dashscope.example.com/compatible/v1',
    'https://user:secret@dashscope.example.com/compatible/v1',
  ])(
    'rejects a missing or unsafe qwen embedding base URL without exposing it',
    (baseURL) => {
      const error = captureZodError({
        ...requiredEnv,
        RAG_EMBEDDING_PROVIDER: 'qwen',
        RAG_EMBEDDING_MODEL: 'text-embedding-v4',
        RAG_EMBEDDING_BASE_URL: baseURL,
        QWEN_API_KEY: 'sensitive-qwen-key',
      });

      expect(error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['RAG_EMBEDDING_BASE_URL'] }),
        ]),
      );
      expect(error.message).not.toContain('sensitive-qwen-key');
      if (baseURL) expect(error.message).not.toContain(baseURL);
    },
  );

  it('requires an OpenAI key for an explicitly selected OpenAI provider', () => {
    const error = captureZodError({
      ...requiredEnv,
      RAG_EMBEDDING_PROVIDER: 'openai',
      RAG_EMBEDDING_MODEL: 'text-embedding-3-small',
    });

    expect(error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['OPENAI_API_KEY'] }),
      ]),
    );
  });

  it('keeps an explicitly selected qwen provider when OpenAI credentials also exist', () => {
    const env = parseEnv({
      ...requiredEnv,
      RAG_EMBEDDING_PROVIDER: 'qwen',
      RAG_EMBEDDING_MODEL: 'text-embedding-v4',
      RAG_EMBEDDING_BASE_URL: 'https://dashscope.example.com/compatible/v1',
      QWEN_API_KEY: 'qwen-key',
      OPENAI_API_KEY: 'openai-key',
    });

    expect(env.RAG_EMBEDDING_PROVIDER).toBe('qwen');
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
        ...productionEnv,
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
        ...productionEnv,
      }).SWAGGER_ENABLED,
    ).toBe(false);
  });

  it('allows explicit Swagger enablement overrides', () => {
    expect(
      parseEnv({
        ...productionEnv,
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
        ...productionEnv,
        SWAGGER_ENABLED: '',
      }).SWAGGER_ENABLED,
    ).toBe(false);
  });

  it('enables worker observability by default only outside production', () => {
    expect(parseEnv(requiredEnv).WORKER_OBSERVABILITY_ENABLED).toBe(true);

    expect(
      parseEnv({
        ...productionEnv,
      }).WORKER_OBSERVABILITY_ENABLED,
    ).toBe(false);
  });

  it('allows explicit worker observability enablement overrides', () => {
    expect(
      parseEnv({
        ...productionEnv,
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
        ...productionEnv,
      }).OUTBOX_DISPATCHER_ENABLED,
    ).toBe(false);
  });

  it('allows explicit outbox dispatcher enablement overrides', () => {
    expect(
      parseEnv({
        ...productionEnv,
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
        ...productionEnv,
      }).OUTBOX_OPS_ENABLED,
    ).toBe(false);
  });

  it('allows explicit outbox ops enablement overrides', () => {
    expect(
      parseEnv({
        ...productionEnv,
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
        ...productionEnv,
      }).WORKER_READINESS_ENABLED,
    ).toBe(false);
  });

  it('allows explicit worker readiness overrides and treats blanks as unset', () => {
    expect(
      parseEnv({
        ...productionEnv,
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
        ...productionEnv,
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
        ...productionEnv,
      }).OPERATOR_AUDIT_ENABLED,
    ).toBe(false);
  });

  it('allows explicit operator audit overrides and treats blanks as unset', () => {
    expect(
      parseEnv({
        ...productionEnv,
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
        ...productionEnv,
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
      const env = parseEnv({
        ...(NODE_ENV === 'production' ? productionEnv : requiredEnv),
        NODE_ENV,
      });
      expect(env.OPERATOR_AUDIT_EXPORT_ENABLED).toBe(false);
      expect(env.OPERATOR_AUDIT_MAINTENANCE_ENABLED).toBe(false);
    }
  });

  it('requires a fingerprint secret for production operator audit queries', () => {
    expect(() =>
      parseEnv({
        ...productionEnv,
        OPERATOR_AUDIT_ENABLED: 'true',
      }),
    ).toThrow();
  });

  it('requires a fingerprint secret for production outbox operations', () => {
    expect(() =>
      parseEnv({
        ...productionEnv,
        OUTBOX_OPS_ENABLED: 'true',
      }),
    ).toThrow();
  });

  it('requires a fingerprint secret for production audit export API', () => {
    expect(() =>
      parseEnv({
        ...productionEnv,
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
        ...productionEnv,
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

  it('rejects audit export worker concurrency above the production invariant', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        OPERATOR_AUDIT_EXPORT_WORKER_CONCURRENCY: 2,
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
