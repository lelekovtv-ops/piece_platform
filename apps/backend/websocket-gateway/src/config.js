import { ServiceConfig, BaseConfigSchema } from '@piece/config';
import { z } from 'zod';

const schema = BaseConfigSchema.extend({
  PORT: z.coerce.number().default(4031),
  JWT_PUBLIC_KEY_BASE64: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6384'),
  WS_CORS_ORIGINS: z
    .string()
    .default('http://localhost:5200,http://localhost:4030')
    .transform((val) => val.split(',')),
});

export const config = new ServiceConfig('websocket-gateway', schema, {
  importMetaUrl: import.meta.url,
});
