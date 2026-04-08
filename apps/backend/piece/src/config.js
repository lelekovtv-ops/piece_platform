import {
  ServiceConfig,
  BaseConfigSchema,
  DatabaseConfigSchema,
  PubSubConfigSchema,
  EmailConfigSchema,
  SecurityConfigSchema,
} from '@piece/config';
import { z } from 'zod';

const ServiceSchema = BaseConfigSchema
  .merge(DatabaseConfigSchema)
  .merge(PubSubConfigSchema)
  .merge(EmailConfigSchema)
  .merge(SecurityConfigSchema)
  .extend({
    PORT: z.coerce.number().default(4030),
    SERVICE_NAME: z.string().default('piece'),
    MONGODB_URI: z.string().default('mongodb://localhost:27022'),
    MONGODB_SYSTEM_DB: z.string().default('piece_system'),
    NATS_URL: z.string().default('nats://localhost:4223'),
    REDIS_URL: z.string().default('redis://localhost:6384'),
    FRONTEND_URL: z.string().default('http://localhost:5200'),

    INTERNAL_TOKEN: z.string().default('dev-internal-token'),
    ENCRYPTION_KEY: z.string().default('0'.repeat(64)),

    JWT_PUBLIC_KEY_BASE64: z.string().optional(),
    JWT_PRIVATE_KEY_BASE64: z.string().optional(),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().default('change-me-refresh-in-production'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

    S3_ENDPOINT: z.string().default('http://localhost:9006'),
    S3_REGION: z.string().default('eu-central-1'),
    S3_BUCKET: z.string().default('koza-uploads'),
    S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
    S3_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
    S3_FORCE_PATH_STYLE: z.string().transform((val) => val === 'true').default('true'),
    S3_PUBLIC_URL: z.string().default('http://localhost:9006/koza-uploads'),

    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    PEXELS_API_KEY: z.string().optional(),
    SJINN_API_KEY: z.string().optional(),
    TRIPO_API_KEY: z.string().optional(),

    QDRANT_URL: z.string().default('http://localhost:6337'),

    SENTRY_DSN_BACKEND: z.string().default(''),
    DISABLE_EMAIL_SENDING: z.string().transform((val) => val === 'true').default('false'),
  });

export const config = new ServiceConfig('piece', ServiceSchema, {
  importMetaUrl: import.meta.url,
});
