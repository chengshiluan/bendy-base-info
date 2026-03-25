import { z } from 'zod';

function normalizeEmptyEnvValue(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  GITHUB_ID: z.string().min(1).optional(),
  GITHUB_SECRET: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('Bendywork Base'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_ENABLE_GITHUB_LOGIN: z.enum(['true', 'false']).optional(),
  NEXT_PUBLIC_ENABLE_EMAIL_LOGIN: z.enum(['true', 'false']).optional()
});

const normalizedEnv = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [
    key,
    normalizeEmptyEnvValue(value)
  ])
);

const parsed = envSchema.safeParse(normalizedEnv);

if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten());
  throw new Error(
    'Environment validation failed. Check server logs for details.'
  );
}

const raw = parsed.data;
const authSecret =
  raw.NEXTAUTH_SECRET ?? 'dev-only-secret-change-me-before-production';
const githubEnabled =
  raw.NEXT_PUBLIC_ENABLE_GITHUB_LOGIN === 'false'
    ? false
    : Boolean(raw.GITHUB_ID && raw.GITHUB_SECRET);
const emailEnabled =
  raw.NEXT_PUBLIC_ENABLE_EMAIL_LOGIN === 'false'
    ? false
    : Boolean(raw.UPSTASH_REDIS_REST_URL && raw.UPSTASH_REDIS_REST_TOKEN);

export const env = {
  app: {
    name: raw.NEXT_PUBLIC_APP_NAME,
    url: raw.NEXT_PUBLIC_APP_URL ?? raw.NEXTAUTH_URL ?? 'http://localhost:3000',
    isDevelopment: raw.NODE_ENV === 'development',
    isProduction: raw.NODE_ENV === 'production'
  },
  auth: {
    secret: authSecret,
    githubEnabled,
    emailEnabled,
    githubClientId: raw.GITHUB_ID,
    githubClientSecret: raw.GITHUB_SECRET
  },
  database: {
    url: raw.DATABASE_URL,
    enabled: Boolean(raw.DATABASE_URL)
  },
  redis: {
    url: raw.UPSTASH_REDIS_REST_URL,
    token: raw.UPSTASH_REDIS_REST_TOKEN,
    enabled: Boolean(raw.UPSTASH_REDIS_REST_URL && raw.UPSTASH_REDIS_REST_TOKEN)
  },
  email: {
    resendApiKey: raw.RESEND_API_KEY,
    from: raw.EMAIL_FROM,
    enabled: Boolean(raw.RESEND_API_KEY && raw.EMAIL_FROM)
  },
  storage: {
    region: raw.S3_REGION,
    bucket: raw.S3_BUCKET,
    endpoint: raw.S3_ENDPOINT,
    accessKeyId: raw.S3_ACCESS_KEY_ID,
    secretAccessKey: raw.S3_SECRET_ACCESS_KEY,
    publicBaseUrl: raw.S3_PUBLIC_BASE_URL,
    enabled: Boolean(
      raw.S3_BUCKET &&
        raw.S3_REGION &&
        raw.S3_ACCESS_KEY_ID &&
        raw.S3_SECRET_ACCESS_KEY
    )
  }
} as const;

export type AppEnv = typeof env;
