import { z } from 'zod';

export const BaseConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
  SERVICE_NAME: z.string().min(1).optional(),
});

export const DatabaseConfigSchema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_SYSTEM_DB: z.string().min(1).default('piece_system'),
});

export const PubSubConfigSchema = z.object({
  NATS_URL: z.string().min(1).default('nats://localhost:4222'),
});

export const InternalAuthConfigSchema = z.object({
  INTERNAL_TOKEN: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32),
});

export const ServiceUrlsConfigSchema = z.object({
  API_GATEWAY_URL: z.string().url().default('http://localhost:3100'),
});

export const EmailConfigSchema = z.object({
  FROM_EMAIL: z.string().email().default('noreply@localhost.dev'),
  FROM_NAME: z.string().min(1).default('piece'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  SES_REGION: z.string().default('eu-central-1'),
  SES_ACCESS_KEY_ID: z.string().optional(),
  SES_SECRET_ACCESS_KEY: z.string().optional(),
  SES_CONFIGURATION_SET: z.string().optional(),
  DISABLE_EMAIL_SENDING: z.string().transform((val) => val === 'true').default('false').optional(),
});

export const SecurityConfigSchema = z.object({
  TURNSTILE_SECRET_KEY: z.string().optional(),
  TURNSTILE_ENABLED: z.string().transform((val) => val === 'true').default('false'),
  BLOCKED_EMAIL_DOMAINS: z.string().optional().default(''),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().default(15),
  MAX_RESEND_PER_DAY: z.coerce.number().default(3),
});
