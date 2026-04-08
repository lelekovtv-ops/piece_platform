import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

export {
  BaseConfigSchema,
  DatabaseConfigSchema,
  PubSubConfigSchema,
  InternalAuthConfigSchema,
  ServiceUrlsConfigSchema,
  EmailConfigSchema,
  SecurityConfigSchema,
} from './schemas.js';

class SecretsManager {
  #config;

  constructor(config) {
    this.#config = config;
  }

  getMongoDBURI() {
    return this.#config.get('MONGODB_URI');
  }

  getInternalServiceToken() {
    return this.#config.get('INTERNAL_TOKEN');
  }

  getEncryptionKey() {
    return this.#config.get('ENCRYPTION_KEY');
  }
}

export class ServiceConfig {
  #values;
  #secrets;

  constructor(serviceName, schema, options = {}) {
    const { importMetaUrl } = options;

    this.#loadEnvFiles(importMetaUrl);

    const envWithServiceName = { SERVICE_NAME: serviceName, ...process.env };

    const result = schema.safeParse(envWithServiceName);

    if (!result.success) {
      const formatted = result.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');

      process.stderr.write(
        `[${serviceName}] Configuration validation failed:\n${formatted}\n`,
      );
      process.exit(1);
    }

    this.#values = Object.freeze(result.data);
    this.#secrets = new SecretsManager(this);
  }

  get(key) {
    if (!(key in this.#values)) {
      throw new Error(`Configuration key "${key}" is not defined in the schema`);
    }
    return this.#values[key];
  }

  get secrets() {
    return this.#secrets;
  }

  get all() {
    return this.#values;
  }

  #loadEnvFiles(importMetaUrl) {
    const envFiles = [];

    if (importMetaUrl) {
      const root = this.#findMonorepoRoot(importMetaUrl);
      if (root) {
        envFiles.push(resolve(root, '.env.local'));
        envFiles.push(resolve(root, '.env'));
      }
    }

    for (const envFile of envFiles) {
      if (existsSync(envFile)) {
        dotenv.config({ path: envFile });
      }
    }
  }

  #findMonorepoRoot(importMetaUrl) {
    let dir = dirname(fileURLToPath(importMetaUrl));
    const maxDepth = 10;

    for (let i = 0; i < maxDepth; i++) {
      if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
        return dir;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    return null;
  }
}
