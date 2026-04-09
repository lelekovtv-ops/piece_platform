import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

describe('ServiceConfig', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function createConfig(envOverrides, schema) {
    process.env.NODE_ENV = 'development';
    Object.assign(process.env, envOverrides);
    const { ServiceConfig, BaseConfigSchema } = await import('../index.js');
    const testSchema = schema || BaseConfigSchema.extend({
      FROM_EMAIL: z.string().email().default('noreply@localhost.dev'),
      FROM_NAME: z.string().min(1).default('piece'),
    });
    return new ServiceConfig('test-service', testSchema, {});
  }

  it('should use defaults when env vars are empty strings', async () => {
    const config = await createConfig({
      FROM_EMAIL: '',
      FROM_NAME: '',
    });
    expect(config.get('FROM_EMAIL')).toBe('noreply@localhost.dev');
    expect(config.get('FROM_NAME')).toBe('piece');
  });

  it('should use provided values when env vars are non-empty', async () => {
    const config = await createConfig({
      FROM_EMAIL: 'admin@example.com',
      FROM_NAME: 'MyApp',
    });
    expect(config.get('FROM_EMAIL')).toBe('admin@example.com');
    expect(config.get('FROM_NAME')).toBe('MyApp');
  });

  it('should use defaults when env vars are not set at all', async () => {
    delete process.env.FROM_EMAIL;
    delete process.env.FROM_NAME;
    const config = await createConfig({});
    expect(config.get('FROM_EMAIL')).toBe('noreply@localhost.dev');
    expect(config.get('FROM_NAME')).toBe('piece');
  });

  it('should handle optional fields with empty strings', async () => {
    const { ServiceConfig, BaseConfigSchema } = await import('../index.js');
    const schema = BaseConfigSchema.extend({
      OPTIONAL_KEY: z.string().optional(),
    });
    process.env.NODE_ENV = 'development';
    process.env.OPTIONAL_KEY = '';
    const config = new ServiceConfig('test-service', schema, {});
    expect(config.get('OPTIONAL_KEY')).toBeUndefined();
  });
});
