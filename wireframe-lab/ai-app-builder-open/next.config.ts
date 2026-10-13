import type { NextConfig } from "next";

/**
 * ── THE DOOR'S SECTION (Raibach IDS, 2026-10-10) ────────────────────────────────────────
 * This tool is served behind the studio's single address under /builder (the vite proxy
 * forwards <studio>/builder/... here), so EVERY hand-written path in src/ must carry the
 * prefix too: Next honors `basePath` automatically for pages, links and built assets — but
 * NOT for raw fetch()/iframe/CSS urls. One literal, two consumers: `basePath` below, and
 * NEXT_PUBLIC_BUILDER_BASE_PATH, which src/lib/base-path.ts reads everywhere else. Keep in
 * sync with frontend/vite.config.ts's '/builder' proxy entry.
 */
const BUILDER_BASE_PATH = "/builder";

const nextConfig: NextConfig = {
  basePath: BUILDER_BASE_PATH,
  env: {
    NEXT_PUBLIC_BUILDER_BASE_PATH: BUILDER_BASE_PATH,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placeholders.io",
      }
    ]
  },
  // Hide the on-screen Next.js dev indicator (the bottom-left bubble shown
  // during `next dev`). Compile/runtime errors are still surfaced.
  devIndicators: false,
  // THE TUNNEL HOST IS LISTED EXPLICITLY (2026-10-10). The "*" entry alone did NOT
  // satisfy the dev-origin check — measured live: Next blocked /builder/_next/hmr from
  // astragalar-santa-unbelligerently.ngrok-free.dev while this config already read
  // ["*"], and the builder page rendered empty through the tunnel because of it.
  // Explicit hosts are what the check matches; "*" stays for its intended breadth.
  allowedDevOrigins: [
    "*",
    "astragalar-santa-unbelligerently.ngrok-free.dev",
    "raibach-ids.ngrok.dev",
    "localhost",
    "127.0.0.1",
    "192.168.105.70",
  ],
  async headers() {
    // Only cache-control headers here. CSP and CORS are handled exclusively in proxy.ts
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;
