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
    JWT_SECRET: z.string().min(16),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
    CORS_ORIGIN: z.string().default('http://localhost:3000'),
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
    RAG_EMBEDDING_PROVIDER: z.enum(['openai']).default('openai'),
    RAG_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
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
    OPENAI_API_KEY: optionalNonEmptyStringSchema,
  })
  .superRefine((env, context) => {
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

export type ServerEnv = z.infer<typeof envSchema>;

export function parseEnv(config: Record<string, unknown>): ServerEnv {
  return envSchema.parse(config);
}
