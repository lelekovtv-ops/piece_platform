import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    clearMocks: true,
    include: ['src/**/__tests__/**/*.test.js', 'src/**/*.test.js', 'tests/**/*.test.js'],
    exclude: ['node_modules', 'dist', 'coverage'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/**/*.test.js', 'src/**/__tests__/**', 'src/index.js'],
      reporter: ['text', 'lcov'],
    },
  },
});
