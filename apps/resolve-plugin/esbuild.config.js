import { build } from "esbuild";

const commonOptions = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: true,
  external: ["electron", "electron/renderer"],
  banner: {
    js: "var import_meta_url = require('url').pathToFileURL(__filename).href;",
  },
  define: {
    "import.meta.dirname": "__dirname",
    "import.meta.url": "import_meta_url",
  },
  logLevel: "info",
};

// Build main process entry point (Electron main)
await build({
  ...commonOptions,
  entryPoints: ["src/main/index.js"],
  outfile: "main.js",
});

// Build preload script (separate Electron preload)
await build({
  ...commonOptions,
  entryPoints: ["src/main/preload.js"],
  outfile: "preload.js",
  banner: {}, // Preload doesn't need import_meta_url
});
