/**
 * BOOT PRELOAD — the first screen's files start with the document (2026-10-24).
 *
 * The entry that stands behind the door pulls the application with a dynamic import, so the
 * browser discovered the big pieces only after the entry had parsed and run. Through the
 * tunnel every one of them then paid its own round-trip delay, in sequence: the shell arrived
 * late and the room drew in segments. This injects `<link rel="modulepreload">` for the pieces
 * the first screen cannot draw without, so they are requested with the document:
 *
 *   - the shell that holds the navigation and the six room boxes,
 *   - the first room's own program (the Console is the tab that opens),
 *   - the React runtime,
 *   - the surface registrations (every room element),
 *   - the shared style engine.
 *
 * Vite emits its own preload links for static imports only; these are the dynamic ones the
 * entry (and the shell) pull immediately. The other rooms' programs are NOT listed — they
 * belong to the tab that opens them, and preloading them would spend the tunnel on a screen the
 * person has not asked for.
 *
 * The pattern matches the build's hashed names (`WritingAreaIndex-<hash>.js`). The link block
 * is marked and replaced on every build, so a rebuild can never stack two blocks or leave a
 * stale hash behind. The page itself stays no-store: this changes what the document asks for
 * first, never how long it is kept.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist', import.meta.url));
const assetsDir = join(root, 'assets');
const pagePath = join(root, 'index.html');

const BOOT = /^(WritingAreaIndex-|ConsoleRoomContainer-|vendor-react-|custom-elements-|style-).*\.js$/;
const MARK_START = '<!-- BOOT PRELOAD (scripts/preload-boot.mjs) -->';
const MARK_END = '<!-- /BOOT PRELOAD -->';

const assets = await readdir(assetsDir).catch(() => []);
const bootFiles = assets.filter((name) => BOOT.test(name)).sort();

if (bootFiles.length === 0) {
  console.error('boot-preload: no boot chunks found under dist/assets — nothing injected');
  process.exitCode = 1;
} else {
  const links = bootFiles
    .map((name) => `    <link rel="modulepreload" crossorigin href="/assets/${name}">`)
    .join('\n');
  const block = `${MARK_START}\n${links}\n    ${MARK_END}`;

  let html = await readFile(pagePath, 'utf8');
  const existing = new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}`);
  html = existing.test(html)
    ? html.replace(existing, block)
    : html.replace('</head>', `${block}\n  </head>`);
  await writeFile(pagePath, html);

  console.log(`boot-preload: ${bootFiles.length} files requested with the document`);
  for (const name of bootFiles) console.log(`  /assets/${name}`);
}
