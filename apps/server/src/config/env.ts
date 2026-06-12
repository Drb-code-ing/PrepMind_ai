import { z } from 'zod';

const booleanStringSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    return value.toLowerCase() === 'true';
  });

const envSchema = z.object({
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
});

export type ServerEnv = z.infer<typeof envSchema>;

export function parseEnv(config: Record<string, unknown>): ServerEnv {
  return envSchema.parse(config);
}
