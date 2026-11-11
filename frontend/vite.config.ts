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
    // DYNAMIC CHUNKS LOAD WHEN THEY ARE ASKED FOR, NOT AT BOOT (owner, 2026-10-21: *"shouldn't it
    // load chunks when you select the tab for that?"*). Vite's default is to emit a preload list
    // inside the entry chunk and fetch every dynamically-imported chunk at startup. Measured
    // through the tunnel: `figma-layers-view` (55 kB, 1.08 s) and `governance-trace-source` were
    // downloaded before the console painted, for panels nobody had opened. Off: the room, the
    // Design tab and the Figma tree are fetched the moment their code runs, and not before.
    modulePreload: false,
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
    // ── THE CATALOGUES LIVE IN THIS TREE (2026-10-03; symlink lore retired 2026-10-15) ──────
    // This block once described: real partition files in the lab (`wireframe-lab/catalogs/`,
    // now `product/catalogs/`), and `frontend/src/components/A2UI/catalogs/<system>` a
    // symlink to it — Vite resolves links to their real path, OUTSIDE this workspace (the
    // root is `frontend/`), so `fs.allow` kept the dev server serving the catalogue JSON
    // (the room's fetches and the `import.meta.glob` modules both 403'd otherwise). The
    // symlinks are gone: a full sweep of this tree (2026-10-15) finds none, and each
    // partition under `A2UI/catalogs/<system>/` is a real directory holding its files.
    // `fs.allow` is kept unchanged — removing it is its own decision, not this rename
    // pass. Builds were never affected: Rollup follows links.
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
      // 2026-10-19: the studio is served through the ngrok tunnel
      // (astragalar-santa-unbelligerently.ngrok-free.dev -> localhost:5001).
      // Vite refuses any host not listed here with "Blocked request" BEFORE app code
      // runs, so the tunnel 403s silently without this entry. A leading dot = every
      // subdomain of that domain (ngrok free static domains live on .ngrok-free.dev;
      // .ngrok-free.app kept for the other free-tier suffix).
      '.ngrok-free.dev',
      '.ngrok-free.app',
      // .loca.lt and .trycloudflare.com stay until their own use is confirmed dead.
      '.loca.lt',
      '.trycloudflare.com',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // ── THE DOOR'S SECTIONS (2026-10-10) ────────────────────────────────────────────────
      // One public address serves every room: these paths forward <studio>/builder, /dev
      // and /governance to the tools' own ports, so embeds work for EVERY visitor (through
      // the tunnel too) without any localhost address inside the page. The path is forwarded
      // AS-IS — each tool is mounted under its own section server-side — and the rooms' env
      // addresses in backend/.env name the same sections (keep the three in sync).
      '/builder': {
        target: 'http://localhost:3223',
        changeOrigin: true,
        ws: true,
      },
      '/dev': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        ws: true,
      },
      '/governance': {
        target: 'http://localhost:3100',
        changeOrigin: true,
        ws: true,
      },
      '/posthog': {
        target: 'http://localhost:8200',
        changeOrigin: true,
        ws: true,
      },
      // The UX application's bundler bakes root-absolute `/static/…` asset URLs; it is mounted
      // under /posthog, so those resolve here and are rewritten to the real path. Nothing else
      // in the studio uses /static (the app is /assets, the backend is /api).
      '/static': {
        target: 'http://localhost:8200',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/static/, '/posthog/static'),
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
  // ── THE TUNNEL'S DOOR (2026-10-19) ────────────────────────────────────────────────────────
  // Through ngrok, the dev server's 215 unbundled modules (16 MB) took ~25 s per load. The
  // tunnel now serves THIS BUILT PREVIEW: the same four doors, bundled and cacheable. The
  // source server on :5001 stays exactly what it was — live edits, no build in the way.
  // `npx vite build` refreshes dist/; preview serves it on :4173.
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/builder': {
        target: 'http://localhost:3223',
        changeOrigin: true,
        ws: true,
      },
      '/dev': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        ws: true,
      },
      '/governance': {
        target: 'http://localhost:3100',
        changeOrigin: true,
        ws: true,
      },
      '/posthog': {
        target: 'http://localhost:8200',
        changeOrigin: true,
        ws: true,
      },
      '/static': {
        target: 'http://localhost:8200',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/static/, '/posthog/static'),
      },
    },
  },
})
