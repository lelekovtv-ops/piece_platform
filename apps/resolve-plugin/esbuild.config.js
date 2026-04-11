import { build } from "esbuild";

await build({
  entryPoints: ["src/main/index.js"],
  outfile: "dist/main/index.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: true,
  external: ["electron", "WorkflowIntegration"],
  define: {
    "import.meta.dirname": "__dirname",
  },
  logLevel: "info",
});
