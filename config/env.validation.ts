// config/env.validation.ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string(),

  DB_HOST: z.string(),
  DB_PORT: z.string(),
  DB_NAME: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),

  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string(),

  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  REDIS_PASSWORD: z.string().optional(),

  // Telegram configuration
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_BOT_USERNAME: z.string(),

  // CORS Configuration (comma-separated URLs)
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

export type EnvVars = z.infer<typeof envSchema>;
