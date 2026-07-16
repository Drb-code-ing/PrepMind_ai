import { z } from 'zod';

const booleanStringSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    return value.toLowerCase() === 'true';
  });

const optionalNonEmptyStringSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(1).optional());

const operatorAuditFingerprintSecretSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(32).optional());

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
    AI_PROVIDER_MODE: z.enum(['mock', 'live']).default('mock'),
    AI_ENABLE_LIVE_CALLS: booleanStringSchema.default(false),
    AI_MODEL: z.string().trim().min(1).max(120).default('deepseek-v4-flash'),
    AI_BASE_URL: z.string().url().default('https://api.deepseek.com/v1'),
    DEEPSEEK_API_KEY: optionalNonEmptyStringSchema,
    REVIEW_AGENT_MODEL_ENABLED: booleanStringSchema.default(false),
    PLANNER_AGENT_MODEL_ENABLED: booleanStringSchema.default(false),
    REVIEW_AGENT_MODEL_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(15_000)
      .default(4_500),
    PLANNER_AGENT_MODEL_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(15_000)
      .default(4_500),
    CONVERSATION_SUMMARY_MAX_CALLS: z.coerce
      .number()
      .int()
      .min(1)
      .max(1)
      .default(1),
    CONVERSATION_SUMMARY_MAX_INPUT_TOKENS: z.coerce
      .number()
      .int()
      .min(200)
      .max(4000)
      .default(1600),
    CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS: z.coerce
      .number()
      .int()
      .min(50)
      .max(800)
      .default(400),
    CONVERSATION_SUMMARY_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(15000)
      .default(8000),
    SERVER_ROLE: z.enum(['api', 'worker', 'both']).default('both'),
    BULLMQ_PREFIX: z.string().min(1).default('prepmind'),
    JWT_SECRET: z.string().min(16),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    SWAGGER_ENABLED: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'string' && value.trim().length === 0) {
        return undefined;
      }

      return value;
    }, booleanStringSchema.optional()),
    WORKER_OBSERVABILITY_ENABLED: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'string' && value.trim().length === 0) {
        return undefined;
      }

      return value;
    }, booleanStringSchema.optional()),
    WORKER_READINESS_ENABLED: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'string' && value.trim().length === 0) {
        return undefined;
      }

      return value;
    }, booleanStringSchema.optional()),
    OUTBOX_DISPATCHER_ENABLED: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'string' && value.trim().length === 0) {
        return undefined;
      }

      return value;
    }, booleanStringSchema.optional()),
    OUTBOX_OPS_ENABLED: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'string' && value.trim().length === 0) {
        return undefined;
      }

      return value;
    }, booleanStringSchema.optional()),
    OPERATOR_AUDIT_ENABLED: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'string' && value.trim().length === 0) {
        return undefined;
      }

      return value;
    }, booleanStringSchema.optional()),
    OPERATOR_AUDIT_EXPORT_ENABLED: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'string' && value.trim().length === 0) {
        return undefined;
      }

      return value;
    }, booleanStringSchema.optional()),
    OPERATOR_AUDIT_MAINTENANCE_ENABLED: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'string' && value.trim().length === 0) {
        return undefined;
      }

      return value;
    }, booleanStringSchema.optional()),
    OPERATOR_AUDIT_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .min(1)
      .max(3650)
      .default(180),
    OPERATOR_AUDIT_EXPORT_TTL_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(168)
      .default(24),
    OPERATOR_AUDIT_EXPORT_MAX_RANGE_DAYS: z.coerce
      .number()
      .int()
      .min(1)
      .max(366)
      .default(31),
    OPERATOR_AUDIT_EXPORT_MAX_RECORDS: z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000_000)
      .default(50_000),
    OPERATOR_AUDIT_EXPORT_MAX_ARCHIVE_BYTES: z.coerce
      .number()
      .int()
      .min(1_048_576)
      .max(1_073_741_824)
      .default(67_108_864),
    OPERATOR_AUDIT_EXPORT_PER_ADMIN_ACTIVE_LIMIT: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(2),
    OPERATOR_AUDIT_EXPORT_PER_ADMIN_HOURLY_LIMIT: z.coerce
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(10),
    OPERATOR_AUDIT_EXPORT_GLOBAL_ACTIVE_LIMIT: z.coerce
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(10),
    OPERATOR_AUDIT_EXPORT_WORKER_CONCURRENCY: z.coerce
      .number()
      .int()
      .min(1)
      .max(1)
      .default(1),
    OPERATOR_AUDIT_EXPORT_BULL_LOCK_MS: z.coerce
      .number()
      .int()
      .min(10_000)
      .max(3_600_000)
      .default(600_000),
    OPERATOR_AUDIT_EXPORT_LEASE_MS: z.coerce
      .number()
      .int()
      .min(10_000)
      .max(3_600_000)
      .default(300_000),
    OPERATOR_AUDIT_EXPORT_STALE_AFTER_MS: z.coerce
      .number()
      .int()
      .min(10_000)
      .max(86_400_000)
      .default(3_600_000),
    OPERATOR_AUDIT_EXPORT_DELIVERY_RECOVERY_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(168)
      .default(24),
    OPERATOR_AUDIT_EXPORT_QUERY_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(3_600_000)
      .default(120_000),
    OPERATOR_AUDIT_FINGERPRINT_SECRET: operatorAuditFingerprintSecretSchema,
    REFRESH_COOKIE_NAME: z.string().default('prepmind_refresh'),
    MINIO_ENDPOINT: z.string().min(1).default('127.0.0.1'),
    MINIO_PORT: z.coerce.number().int().positive().default(9000),
    MINIO_USE_SSL: booleanStringSchema.default(false),
    MINIO_ACCESS_KEY: z.string().min(1).default('minioadmin'),
    MINIO_SECRET_KEY: z.string().min(1).default('minioadmin'),
    MINIO_BUCKET: z.string().min(1).default('prepmind-dev'),
    PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:3001'),
    UPLOAD_IMAGE_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(8 * 1024 * 1024),
    UPLOAD_DOCUMENT_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(20 * 1024 * 1024),
    RAG_EMBEDDING_PROVIDER: z
      .enum(['openai', 'qwen', 'fake'])
      .default('openai'),
    RAG_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
    RAG_EMBEDDING_BASE_URL: optionalNonEmptyStringSchema,
    RAG_EMBEDDING_DIMENSIONS: z.coerce
      .number()
      .int()
      .refine((value) => value === 1536)
      .default(1536),
    RAG_EMBEDDING_BATCH_SIZE: z.coerce
      .number()
      .int()
      .min(1)
      .max(128)
      .default(32),
    RAG_CHUNK_TARGET_TOKENS: z.coerce
      .number()
      .int()
      .min(100)
      .max(2000)
      .default(650),
    RAG_CHUNK_OVERLAP_TOKENS: z.coerce
      .number()
      .int()
      .min(0)
      .max(500)
      .default(80),
    RAG_CHUNK_MAX_TOKENS: z.coerce
      .number()
      .int()
      .min(200)
      .max(3000)
      .default(900),
    RAG_MAX_CHUNKS_PER_DOCUMENT: z.coerce
      .number()
      .int()
      .min(1)
      .max(2000)
      .default(500),
    KNOWLEDGE_PROCESSING_MODE: z.enum(['inline', 'queue']).default('inline'),
    KNOWLEDGE_PROCESSING_CONCURRENCY: z.coerce
      .number()
      .int()
      .min(1)
      .max(8)
      .default(2),
    KNOWLEDGE_PROCESSING_ATTEMPTS: z.coerce
      .number()
      .int()
      .min(1)
      .max(5)
      .default(3),
    KNOWLEDGE_PROCESSING_JOB_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(10_000)
      .max(600_000)
      .default(120_000),
    KNOWLEDGE_PROCESSING_LOCK_DURATION_MS: z.coerce
      .number()
      .int()
      .min(10_000)
      .max(300_000)
      .default(60_000),
    KNOWLEDGE_PROCESSING_GLOBAL_RATE_LIMIT: z.coerce
      .number()
      .int()
      .min(1)
      .max(300)
      .default(30),
    KNOWLEDGE_PROCESSING_PER_USER_ACTIVE_LIMIT: z.coerce
      .number()
      .int()
      .min(1)
      .max(10)
      .default(2),
    WORKER_HEARTBEAT_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(15_000),
    WORKER_HEARTBEAT_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(5)
      .max(600)
      .default(45),
    OUTBOX_DISPATCHER_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(5_000),
    OUTBOX_DISPATCHER_BATCH_SIZE: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20),
    OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(10_000)
      .max(3_600_000)
      .default(300_000),
    EMBEDDING_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(5_000)
      .max(120_000)
      .default(30_000),
    OPENAI_API_KEY: optionalNonEmptyStringSchema,
    Qwen_API_KEY: optionalNonEmptyStringSchema,
    QWEN_API_KEY: optionalNonEmptyStringSchema,
    DASHSCOPE_API_KEY: optionalNonEmptyStringSchema,
  })
  .superRefine((env, context) => {
    if (env.AI_PROVIDER_MODE === 'live' && env.AI_ENABLE_LIVE_CALLS) {
      if (!isSafeHttpsProviderUrl(env.AI_BASE_URL)) {
        context.addIssue({
          code: 'custom',
          path: ['AI_BASE_URL'],
          message: 'live model calls require a credential-free HTTPS base URL',
        });
      }
      if (!env.DEEPSEEK_API_KEY && !env.OPENAI_API_KEY) {
        context.addIssue({
          code: 'custom',
          path: ['DEEPSEEK_API_KEY'],
          message: 'live model calls require a supported provider API key',
        });
      }
      if (
        !resolveLiveModelProvider({
          baseURL: env.AI_BASE_URL,
          hasDeepseekKey: Boolean(env.DEEPSEEK_API_KEY),
          hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
        })
      ) {
        context.addIssue({
          code: 'custom',
          path: ['AI_BASE_URL'],
          message: 'live model provider and credential selection is ambiguous',
        });
      }
    }

    if (
      env.NODE_ENV === 'production' &&
      env.RAG_EMBEDDING_PROVIDER === 'fake'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['RAG_EMBEDDING_PROVIDER'],
        message:
          'RAG_EMBEDDING_PROVIDER=fake is only allowed outside production',
      });
    }

    if (env.RAG_CHUNK_OVERLAP_TOKENS >= env.RAG_CHUNK_TARGET_TOKENS) {
      context.addIssue({
        code: 'custom',
        path: ['RAG_CHUNK_OVERLAP_TOKENS'],
        message:
          'RAG_CHUNK_OVERLAP_TOKENS must be less than RAG_CHUNK_TARGET_TOKENS',
      });
    }

    if (env.RAG_CHUNK_TARGET_TOKENS > env.RAG_CHUNK_MAX_TOKENS) {
      context.addIssue({
        code: 'custom',
        path: ['RAG_CHUNK_TARGET_TOKENS'],
        message:
          'RAG_CHUNK_TARGET_TOKENS must be less than or equal to RAG_CHUNK_MAX_TOKENS',
      });
    }

    if (
      env.OPERATOR_AUDIT_EXPORT_LEASE_MS >=
      env.OPERATOR_AUDIT_EXPORT_BULL_LOCK_MS
    ) {
      context.addIssue({
        code: 'custom',
        path: ['OPERATOR_AUDIT_EXPORT_LEASE_MS'],
        message: 'export lease must be shorter than BullMQ lock',
      });
    }

    if (
      env.OPERATOR_AUDIT_EXPORT_STALE_AFTER_MS <=
      env.OPERATOR_AUDIT_EXPORT_BULL_LOCK_MS
    ) {
      context.addIssue({
        code: 'custom',
        path: ['OPERATOR_AUDIT_EXPORT_STALE_AFTER_MS'],
        message: 'stale repair must be longer than BullMQ lock',
      });
    }

    if (
      env.OPERATOR_AUDIT_EXPORT_QUERY_TIMEOUT_MS >=
      env.OPERATOR_AUDIT_EXPORT_STALE_AFTER_MS
    ) {
      context.addIssue({
        code: 'custom',
        path: ['OPERATOR_AUDIT_EXPORT_QUERY_TIMEOUT_MS'],
        message: 'query timeout must be shorter than stale repair threshold',
      });
    }

    if (
      env.OPERATOR_AUDIT_EXPORT_ENABLED === true &&
      env.SERVER_ROLE !== 'api' &&
      (!env.OUTBOX_DISPATCHER_ENABLED ||
        env.OPERATOR_AUDIT_MAINTENANCE_ENABLED !== true)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['OPERATOR_AUDIT_EXPORT_ENABLED'],
        message:
          'worker export requires outbox dispatcher and audit maintenance',
      });
    }

    if (
      env.NODE_ENV === 'production' &&
      (env.OPERATOR_AUDIT_ENABLED === true ||
        env.OUTBOX_OPS_ENABLED === true ||
        env.OPERATOR_AUDIT_EXPORT_ENABLED === true) &&
      !env.OPERATOR_AUDIT_FINGERPRINT_SECRET
    ) {
      context.addIssue({
        code: 'custom',
        path: ['OPERATOR_AUDIT_FINGERPRINT_SECRET'],
        message: 'production audit data paths require an HMAC secret',
      });
    }
  });

type ParsedServerEnv = z.infer<typeof envSchema>;
const embeddingRuntimeConfigFactsSchema = z
  .object({
    isProduction: z.boolean(),
    hasExplicitProvider: z.boolean(),
    hasExplicitModel: z.boolean(),
    provider: z.enum(['openai', 'qwen', 'fake']),
    hasOpenAIKey: z.boolean(),
    hasQwenKey: z.boolean(),
    hasSafeQwenBaseUrl: z.boolean(),
  })
  .superRefine((facts, context) => {
    if (facts.isProduction && !facts.hasExplicitProvider) {
      context.addIssue({
        code: 'custom',
        path: ['RAG_EMBEDDING_PROVIDER'],
        message: 'production requires an explicit embedding provider',
      });
    }
    if (
      (facts.isProduction ||
        (facts.hasExplicitProvider && facts.provider !== 'fake')) &&
      !facts.hasExplicitModel
    ) {
      context.addIssue({
        code: 'custom',
        path: ['RAG_EMBEDDING_MODEL'],
        message: 'embedding runtime requires an explicit model',
      });
    }

    if (!facts.hasExplicitProvider) return;

    if (facts.provider === 'openai' && !facts.hasOpenAIKey) {
      context.addIssue({
        code: 'custom',
        path: ['OPENAI_API_KEY'],
        message: 'OpenAI embedding provider requires an API key',
      });
    }
    if (facts.provider === 'qwen' && !facts.hasQwenKey) {
      context.addIssue({
        code: 'custom',
        path: ['QWEN_API_KEY'],
        message: 'Qwen embedding provider requires a supported API key',
      });
    }
    if (facts.provider === 'qwen' && !facts.hasSafeQwenBaseUrl) {
      context.addIssue({
        code: 'custom',
        path: ['RAG_EMBEDDING_BASE_URL'],
        message:
          'Qwen embedding provider requires a credential-free HTTPS base URL',
      });
    }
  });

export type ServerEnv = Omit<
  ParsedServerEnv,
  | 'SWAGGER_ENABLED'
  | 'WORKER_OBSERVABILITY_ENABLED'
  | 'WORKER_READINESS_ENABLED'
  | 'OUTBOX_DISPATCHER_ENABLED'
  | 'OUTBOX_OPS_ENABLED'
  | 'OPERATOR_AUDIT_ENABLED'
  | 'OPERATOR_AUDIT_EXPORT_ENABLED'
  | 'OPERATOR_AUDIT_MAINTENANCE_ENABLED'
> & {
  SWAGGER_ENABLED: boolean;
  WORKER_OBSERVABILITY_ENABLED: boolean;
  WORKER_READINESS_ENABLED: boolean;
  OUTBOX_DISPATCHER_ENABLED: boolean;
  OUTBOX_OPS_ENABLED: boolean;
  OPERATOR_AUDIT_ENABLED: boolean;
  OPERATOR_AUDIT_EXPORT_ENABLED: boolean;
  OPERATOR_AUDIT_MAINTENANCE_ENABLED: boolean;
};

export function parseEnv(config: Record<string, unknown>): ServerEnv {
  const env = envSchema.parse(config);
  assertEmbeddingRuntimeConfig(config, env);

  return {
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
    WORKER_OBSERVABILITY_ENABLED:
      env.WORKER_OBSERVABILITY_ENABLED ?? env.NODE_ENV !== 'production',
    WORKER_READINESS_ENABLED:
      env.WORKER_READINESS_ENABLED ?? env.NODE_ENV !== 'production',
    OUTBOX_DISPATCHER_ENABLED:
      env.OUTBOX_DISPATCHER_ENABLED ?? env.NODE_ENV !== 'production',
    OUTBOX_OPS_ENABLED: env.OUTBOX_OPS_ENABLED ?? env.NODE_ENV !== 'production',
    OPERATOR_AUDIT_ENABLED:
      env.OPERATOR_AUDIT_ENABLED ?? env.NODE_ENV !== 'production',
    OPERATOR_AUDIT_EXPORT_ENABLED: env.OPERATOR_AUDIT_EXPORT_ENABLED ?? false,
    OPERATOR_AUDIT_MAINTENANCE_ENABLED:
      env.OPERATOR_AUDIT_MAINTENANCE_ENABLED ?? false,
    OPERATOR_AUDIT_FINGERPRINT_SECRET:
      env.OPERATOR_AUDIT_FINGERPRINT_SECRET ??
      (env.NODE_ENV === 'production'
        ? undefined
        : 'local-dev-audit-fingerprint-change-me'),
  };
}

function assertEmbeddingRuntimeConfig(
  config: Record<string, unknown>,
  env: ParsedServerEnv,
) {
  embeddingRuntimeConfigFactsSchema.parse({
    isProduction: env.NODE_ENV === 'production',
    hasExplicitProvider: hasExplicitNonEmptyString(
      config,
      'RAG_EMBEDDING_PROVIDER',
    ),
    hasExplicitModel: hasExplicitNonEmptyString(config, 'RAG_EMBEDDING_MODEL'),
    provider: env.RAG_EMBEDDING_PROVIDER,
    hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
    hasQwenKey: Boolean(
      env.QWEN_API_KEY || env.Qwen_API_KEY || env.DASHSCOPE_API_KEY,
    ),
    hasSafeQwenBaseUrl: Boolean(
      env.RAG_EMBEDDING_BASE_URL &&
      isSafeHttpsProviderUrl(env.RAG_EMBEDDING_BASE_URL),
    ),
  });
}

function hasExplicitNonEmptyString(
  config: Record<string, unknown>,
  field: string,
) {
  const value = config[field];
  return typeof value === 'string' && value.trim().length > 0;
}

function isSafeHttpsProviderUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function resolveLiveModelProvider(input: {
  baseURL: string;
  hasDeepseekKey: boolean;
  hasOpenAIKey: boolean;
}) {
  let hostname: string;
  try {
    hostname = new URL(input.baseURL).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (hostname === 'deepseek.com' || hostname.endsWith('.deepseek.com')) {
    if (input.hasDeepseekKey) return 'deepseek' as const;
    return input.hasOpenAIKey && input.baseURL === 'https://api.deepseek.com/v1'
      ? ('openai' as const)
      : null;
  }
  if (hostname === 'openai.com' || hostname.endsWith('.openai.com')) {
    return input.hasOpenAIKey ? ('openai' as const) : null;
  }
  if (input.hasDeepseekKey === input.hasOpenAIKey) return null;
  return input.hasDeepseekKey ? ('deepseek' as const) : ('openai' as const);
}
