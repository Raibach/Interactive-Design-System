import path from "path"
import { execSync } from "child_process"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import figmaAssetPlugin from './vite-plugin-figma-asset'
import figmaPreviewPlugin from './vite-plugin-figma-preview'

// Git hash for Sentry release tracking
let releaseHash = "unknown";
try {
  releaseHash = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
} catch { /* not a git repo */ }

// https://vite.dev/config/
export default defineConfig({
  define: {
    "import.meta.env.VITE_RELEASE_VERSION": JSON.stringify(releaseHash),
  },
  plugins: [react(), figmaAssetPlugin(), figmaPreviewPlugin()],
  esbuild: {
    // Target es2020 to force decorator transpilation for broader browser support
    target: 'es2020',
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // The owner, 2026-09-21: the local site is served from source, so Vite resolved
    // Lit's DEVELOPMENT build and every load printed "Lit is in dev mode. Not
    // recommended for production!". Pinning the production condition takes that
    // build out of the dev server too. React's own dev/prod choice rides on
    // process.env.NODE_ENV, which this does not touch.
    conditions: ['module', 'browser', 'production'],
  },
  build: {
    // Generate hidden source maps — Sentry needs these to de-minify stack traces.
    // "hidden" means sourceMappingURL comments are omitted from the bundle so
    // end users never see them, but .map files are still emitted for upload.
    sourcemap: "hidden",
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // ── TWO FAMILIES, BECAUSE THE GATE IS SMALL (2026-10-02) ──────────────────
        // This used to return "vendor" for every node_modules module, which put
        // React, Lit, and everything else into ONE 1.25 MB chunk loaded at boot —
        // and the sign-in gate (React and a card) waited for all of it. Measured on
        // the deployed demo: ~2.5 s before the gate could be typed into. The React
        // family now keeps its own chunk that the entry needs; every other
        // dependency rides with whoever imports it — which, after the entry/app
        // split, means the app's lazy chunks behind the pin.
        //
        // Targeted families (mui/three/tiptap/recharts, then lexical/framer-motion/
        // serverless) were removed from package.json on 2026-08-25 after source
        // audits showed zero imports; add groups back only if they return.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@tanstack|@sentry)[\\/]/.test(id)
          ) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    port: 5001,           // the site — vite serves source LIVE here, never a build
    strictPort: true,     // if 5001 is taken, fail. Never silently use another port.
    hmr: false,
    // ── THE LAB IS THE SOURCE; THE APP TREE HOLDS SYMLINKS (owner, 2026-10-03) ──────────────
    // `wireframe-lab/catalogs/<system>/` holds each ingested partition's real files, and
    // `frontend/src/components/A2UI/catalogs/<system>` is a symlink to it (the decision is
    // recorded in wireframe-lab/catalogs/README.md). Vite resolves every link to its real path,
    // which is OUTSIDE this workspace (the root is `frontend/`) — so without this line the dev
    // server refuses to serve the catalogue JSON read through a link (the room's fetches and
    // the `import.meta.glob` modules both 403). Builds are unaffected: Rollup follows links.
    fs: { allow: ['..'] },
    // The in-app browser reuses module responses from its HTTP cache even
    // across reloads and cache-busted URLs, so edits silently never reach
    // the screen. no-store (not no-cache) forbids storing them at all:
    // every load re-fetches every module. Dev only — this config never
    // reaches production builds.
    headers: {
      'Cache-Control': 'no-store',
    },
    allowedHosts: [
      'localhost',
      '.loca.lt',
      '.ngrok-free.dev',
      '.ngrok.io',
      '.ngrok-free.app',
      '.trycloudflare.com',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
    // THE PREVIEW FOLDER IS NOT SOURCE. Previews are written and deleted under `.preview/`
    // continuously — one file per ingest, gone on the next — and each write would otherwise look
    // like an edit to the project. Nothing imports from it by path (the preview arrives through
    // the plugin's own namespace), so ignoring it here changes nothing about how a preview
    // renders and stops the churn from being watched as if it were the catalogue.
    watch: {
      ignored: ['**/.preview/**'],
    },
  },
})
