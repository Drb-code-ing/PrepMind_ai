import { z } from 'zod';

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
});

export type ServerEnv = z.infer<typeof envSchema>;

export function parseEnv(config: Record<string, unknown>): ServerEnv {
  return envSchema.parse(config);
}
