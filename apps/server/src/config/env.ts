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

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
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
  });

type ParsedServerEnv = z.infer<typeof envSchema>;
export type ServerEnv = Omit<
  ParsedServerEnv,
  | 'SWAGGER_ENABLED'
  | 'WORKER_OBSERVABILITY_ENABLED'
  | 'WORKER_READINESS_ENABLED'
  | 'OUTBOX_DISPATCHER_ENABLED'
  | 'OUTBOX_OPS_ENABLED'
> & {
  SWAGGER_ENABLED: boolean;
  WORKER_OBSERVABILITY_ENABLED: boolean;
  WORKER_READINESS_ENABLED: boolean;
  OUTBOX_DISPATCHER_ENABLED: boolean;
  OUTBOX_OPS_ENABLED: boolean;
};

export function parseEnv(config: Record<string, unknown>): ServerEnv {
  const env = envSchema.parse(config);

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
  };
}
