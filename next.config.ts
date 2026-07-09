import type { NextConfig } from "next";

/**
 * Next.js configuration for IIITH Speech Corpus Dataset Collection Platform.
 *
 * Key decisions:
 * - Turbopack config: required for ffmpeg.wasm (client-side audio conversion).
 *   Next.js 16 uses Turbopack by default; webpack config is deprecated.
 * - Security headers: defense-in-depth for an internal research tool
 * - COOP/COEP headers enable SharedArrayBuffer (required by ffmpeg.wasm)
 * - No server-side transcoding: keeps stack fully serverless per spec
 */
const nextConfig: NextConfig = {
  // ---------------------------------------------------------------------------
  // Turbopack configuration (Next.js 16+ default bundler)
  // WASM support is built into Turbopack — no extra config needed for .wasm files.
  // An empty config explicitly silences the "webpack config present, no turbopack
  // config" warning.
  // ---------------------------------------------------------------------------
  turbopack: {},

  // ---------------------------------------------------------------------------
  // Security / CORS headers
  // Cross-Origin-Embedder-Policy + Cross-Origin-Opener-Policy are required
  // for SharedArrayBuffer (needed by ffmpeg.wasm).
  // ---------------------------------------------------------------------------
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },

  // ---------------------------------------------------------------------------
  // Image optimization
  // ---------------------------------------------------------------------------
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // ---------------------------------------------------------------------------
  // TypeScript: treat type errors as build errors (strict mode)
  // ---------------------------------------------------------------------------
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint config is now in eslint.config.mjs (Next.js 16 flat config)
  // ignoreDuringBuilds defaults to false
};

export default nextConfig;
