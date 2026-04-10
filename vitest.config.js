import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/*/vitest.config.js",
      "apps/backend/*/vitest.config.js",
      "apps/frontend/vitest.config.ts",
      "tools/*/vitest.config.js",
    ],
  },
});
