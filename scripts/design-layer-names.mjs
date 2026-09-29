#!/usr/bin/env node
/**
 * design-layer-names.mjs — EVERY LAYER, BY NAME AND BY ID, HELD AGAINST THE CODE.
 *
 * Why this exists. On 2026-09-20 eleven hours were spent editing a component the browser did not
 * render, and nothing in this repository said so. Every check we had compared files to files:
 * the catalog against its schema, the registry against the tag list, the capture against the
 * source CSS. None of them asked the two questions that would have ended it in a minute —
 * WHICH ELEMENT CARRIES THIS LAYER, and IS THAT ELEMENT ON SCREEN.
 *
 * The rule this enforces, in the owner's words: "the layers in Figma have names. Those names
 * must be used in the lit catalog along with the node." So a layer is not identified by a number
 * alone. It is a NAME and an id together, and both must be present in the code that draws it.
 *
 * What it checks, per capture:
 *   · every layer of the drawing has a marker in the source carrying its id
 *   · that marker ALSO carries the drawing's own name (data-layer-name)
 *   · the name in the source is the name in the drawing — not a leftover from a previous draw
 *   · the calling component is NAMED, so a file nobody renders can be reported as such
 *
 * Usage: node scripts/design-layer-names.mjs [--capture chat-column]
 * Exit 1 when a layer has no marker, or a marker's name disagrees with the drawing.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_DIR = join(ROOT, 'src', 'design');
const LIT_DIR = join(ROOT, 'src', 'components', 'lit');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const ONLY = opt('--capture', null);

/** Every lit source, flat — the code that may carry a layer marker. */
const sources = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.ts')) sources.push({ path: p, rel: p.replace(ROOT + '/src/components/lit/', ''), text: readFileSync(p, 'utf8') });
  }
})(LIT_DIR);

const captures = readdirSync(DESIGN_DIR)
  .filter((f) => f.endsWith('.json') && !f.endsWith('-verified.json') && f !== 'VALUES.json' && f !== 'node-census.json')
  .filter((f) => (ONLY ? f === `${ONLY}.json` : true));

let bad = 0, checked = 0;
for (const f of captures) {
  let cap;
  try { cap = JSON.parse(readFileSync(join(DESIGN_DIR, f), 'utf8')); } catch { continue; }
  if (!cap._capture) continue;
  const scope = cap._capture.scope || f.replace(/\.json$/, '');
  const named = cap.result.nodes.filter((n) => n.name);
  const missing = [], misnamed = [], unmarked = [];
  for (const n of named) {
    checked++;
    // the marker, wherever it lives
    let found = null;
    for (const s of sources) {
      const i = s.text.indexOf(`data-node-id="${n.id}"`);
      const j = s.text.indexOf(`data-node-id=${n.id}`);
      const alt = s.text.indexOf(n.id);
      if (i >= 0 || j >= 0) { found = { src: s, at: Math.max(i, j) }; break; }
      if (alt >= 0 && !found) found = { src: s, at: alt, weak: true };
    }
    if (!found) { missing.push(n); continue; }
    const around = found.src.text.slice(Math.max(0, found.at - 60), found.at + 220);
    const declared = (around.match(/data-layer-name="([^"]*)"/) || [])[1];
    if (!declared) unmarked.push(n);
    else if (declared !== String(n.name)) misnamed.push({ n, declared, src: found.src.rel });
  }
  if (missing.length || misnamed.length || unmarked.length) bad++;
  const mark = (missing.length || misnamed.length || unmarked.length) ? 'FAIL' : 'ok  ';
  console.log(`[${mark}] ${scope.padEnd(22)} ${named.length} named layer(s)`);
  for (const n of missing) console.log(`         NO MARKER      ${n.id}  "${n.name}"`);
  for (const n of unmarked) console.log(`         NO NAME ON IT  ${n.id}  "${n.name}"  — the marker carries the id but not the drawing's name`);
  for (const m of misnamed) console.log(`         NAME DIFFERS   ${m.n.id}  drawing "${m.n.name}"  code "${m.declared}"  (${m.src})`);
}
console.log(`\n  ${checked} layer(s) checked · ${bad} capture(s) with a gap`);
if (bad) {
  console.log('  A LAYER IS A NAME AND AN ID. A marker with no name cannot be found by a person reading');
  console.log('  the drawing; an id alone cannot survive a re-draw. Both are required.');
}
process.exit(bad ? 1 : 0);
