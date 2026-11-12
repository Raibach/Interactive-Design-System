// THE BUILT DEMO'S OWN COPY OF LIT (2026-11-11).
//
// The preview document (draft-preview.ts / IngestModal.tsx) resolves the compiled ingests'
// `import ... from 'lit'` through an import map. On the source server the dev server answers
// /@id/lit itself; on the built demo there is no dev server, so /@id/lit falls through to the
// page and the browser refuses the whole module — "Failed to fetch dynamically imported
// module". This script bundles the lit the app itself uses into dist/id/lit.js, the address
// the built preview's import map names. It runs on every build, so the copy can never drift
// from the lit the app bundles.
import { build } from "esbuild";

const outDir = process.env.BUILD_OUTDIR || "dist";

await build({
  entryPoints: ["node_modules/lit/index.js"],
  bundle: true,
  format: "esm",
  target: "es2020",
  outfile: `${outDir}/id/lit.js`,
  logLevel: "info",
});
