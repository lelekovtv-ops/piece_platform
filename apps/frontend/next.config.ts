import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4030";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Disable Turbopack FS cache to prevent SST panics on unclean shutdowns
    turbopackFileSystemCacheForDev: false,
  },
  serverExternalPackages: [],
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${API_BASE}/v1/:path*`,
      },
      {
        source: "/internal/:path*",
        destination: `${API_BASE}/internal/:path*`,
      },
      {
        source: "/health",
        destination: `${API_BASE}/health`,
      },
    ];
  },
  images: {
    // All image URLs are relative (/img/*, /storage/*) — served via nginx proxy
    // Custom loader handles imagor URL passthrough (no server-side optimization needed)
    loader: "custom",
    loaderFile: "./src/lib/imageLoader.ts",
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ["image/webp"],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableSourceMapUpload: !process.env.SENTRY_AUTH_TOKEN,
});
