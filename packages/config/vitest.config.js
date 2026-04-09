import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../../vitest.shared.js';

export default mergeConfig(shared, defineConfig({
  test: {
    name: 'config',
    include: ['src/**/__tests__/**/*.test.js'],
    testTimeout: 10000,
  },
}));
