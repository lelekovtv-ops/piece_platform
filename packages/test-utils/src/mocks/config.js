/**
 * vi.mock preset for piece/config.
 *
 * Usage:
 *   import '@piece/test-utils/mocks/config';
 */

import { vi } from 'vitest';

const configValues = {
  NODE_ENV: 'test',
  PORT: 3000,
  LOG_LEVEL: 'ERROR',
  MONGODB_URI: 'mongodb://localhost:27017',
  MONGODB_SYSTEM_DB: 'piece_system',
  REDIS_URL: 'redis://localhost:6379',
  NATS_URL: 'nats://localhost:4222',
  API_GATEWAY_URL: 'http://localhost:3100',
  INTERNAL_TOKEN: 'test-internal-token',
  ENCRYPTION_KEY: 'a'.repeat(64),
};

export const mockConfig = {
  get: vi.fn((key) => {
    const normalised = key.replace(/-/g, '_').toUpperCase();
    return configValues[key] ?? configValues[normalised] ?? undefined;
  }),

  secrets: {
    getMongoDBURI: vi.fn().mockReturnValue('mongodb://localhost:27017'),
    getInternalServiceToken: vi.fn().mockReturnValue('test-internal-token'),
    getEncryptionKey: vi.fn().mockReturnValue('a'.repeat(64)),
  },
};

vi.mock('@piece/config', () => ({
  ServiceConfig: vi.fn().mockReturnValue(mockConfig),
  BaseConfigSchema: { extend: vi.fn().mockReturnThis() },
  DatabaseConfigSchema: { extend: vi.fn().mockReturnThis() },
  PubSubConfigSchema: { extend: vi.fn().mockReturnThis() },
  InternalAuthConfigSchema: { extend: vi.fn().mockReturnThis() },
  ServiceUrlsConfigSchema: { extend: vi.fn().mockReturnThis() },
}));

/**
 * Override a config value for the current test.
 */
export function setConfigValue(key, value) {
  configValues[key] = value;
}
