import 'dotenv/config';
import { z } from 'zod';

const DEV_ONLY_JWT_SECRET = 'dev-only-secret-change-me-0123456789abcdef';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/esms'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  JWT_SECRET: z.string().min(32).default(DEV_ONLY_JWT_SECRET),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  REFRESH_TOKEN_REMEMBER_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@esms.local'),
  SEED_ADMIN_PASSWORD: z.string().min(10).default('ChangeMe!2026#Admin'),
  SEED_DEMO_USERS: z.enum(['true', 'false']).default('false'),
  SEED_DEMO_PASSWORD: z.string().min(10).default('Demo!User2026#'),
});

// Blank lines in .env (e.g. "JWT_SECRET=") mean "not configured":
// drop empty values so schema defaults apply instead of failing validation.
const rawEnv = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== undefined && value !== ''),
);

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  // Logger depends on env, so this failure must go straight to stderr.
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_SECRET === DEV_ONLY_JWT_SECRET) {
  console.error('JWT_SECRET must be set to a unique value in production.');
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
