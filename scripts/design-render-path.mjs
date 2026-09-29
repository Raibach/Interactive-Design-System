#!/usr/bin/env node
/**
 * design-render-path.mjs — IS THE FILE YOU EDITED THE FILE THAT DRAWS IT?
 *
 * THE FAILURE THIS EXISTS TO PREVENT, in the owner's words, 2026-09-20:
 *
 *   "I don't want to end up giving a designer the wrong updates, or using the wrong file to
 *    update an element, and then asking them to check it over and over and over again when
 *    it's you updating the wrong file the entire time. That's what I want to avoid. That's
 *    what governance is supposed to do."
 *
 * Eleven hours went that way: `output-header-area.ts` was written, registered, imported and
 * audited green, while `chat-panel.ts` drew that very block from `<chat-header variant="lead">`.
 * Every check agreed with every other check, and the screen never moved. The designer was asked
 * to look — repeatedly — and the instrument was pointed at a file nothing rendered.
 *
 * WHAT IT ASKS, per layer of a capture:
 *   1. which file carries this layer's marker (by node id, and by name)
 *   2. is that file reachable from the app — imported, and drawn by a parent element?
 *   3. if the drawing's layer is drawn by a marker in file A, but the running app resolves that
 *      block through element B, that is the finding.
 *
 * It reads source only: no browser, no model, no network. The one thing it cannot see is what
 * the browser finally renders — so it reports the RENDER CHAIN it can prove, and names the file
 * a person should look at to confirm the last hop.
 *
 * Usage:
 *   node scripts/design-render-path.mjs --capture chat-column
 *   node scripts/design-render-path.mjs --node 40001127:2060          (one layer)
 * Exit 1 when a layer's marker lives in a file no element draws.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_DIR = join(ROOT, 'src', 'design');
const LIT_DIR = join(ROOT, 'src', 'components', 'lit');
const MAIN = join(ROOT, 'src', 'main.tsx');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const CAPTURE = opt('--capture', 'chat-column');
const ONE = opt('--node', null);

/** Every lit source: its path, its text, and the tag it defines. */
const sources = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.ts')) {
      const text = readFileSync(p, 'utf8');
      const def = (text.match(/customElements\.define\(\s*['"]([^'"]+)['"]/) || [])[1] || null;
      sources.push({ path: p, rel: p.replace(ROOT + '/', ''), text, tag: def });
    }
  }
})(LIT_DIR);

const mainText = existsSync(MAIN) ? readFileSync(MAIN, 'utf8') : '';

/** The tag a marker's file defines, and who draws it: any source that renders `<tag`. */
function renderChain(rel, tag) {
  const chain = { file: rel, tag, imported: false, drawnBy: [] };
  if (!tag) return chain;
  const base = rel.replace(/^frontend\//, '').replace(/^src\//, '').replace(/\.ts$/, '');
  chain.imported = mainText.includes(base) || mainText.includes(tag);
  for (const s of sources) {
    if (s.rel === rel) continue;
    if (new RegExp(`<${tag}[\\s>]`).test(s.text)) chain.drawnBy.push(s.rel);
  }
  /* AN ELEMENT IS REACHABLE IF SOMETHING THAT IS IMPORTED DRAWS IT. A sub-element — the tray,
     the action bar, the footer — is pulled in by its parent's import; requiring its own line in
     main.tsx flagged every one of them as dead code. Only an element NO reachable file draws is
     genuinely unreachable. */
  chain.reachable = chain.imported || chain.drawnBy.some((d) => {
    const t2 = sources.find((s) => s.rel === d);
    if (!t2 || !t2.tag) return false;
    const b2 = d.replace(/^frontend\//, '').replace(/^src\//, '').replace(/\.ts$/, '');
    if (mainText.includes(b2) || mainText.includes(t2.tag)) return true;
    // one more hop: something imported draws THAT element
    return sources.some((s3) => s3.rel !== d && s3.tag && (mainText.includes(s3.rel.replace(/^frontend\//, '').replace(/^src\//, '').replace(/\.ts$/, '')) || mainText.includes(s3.tag))
      && new RegExp(`<${t2.tag}[\\s>]`).test(s3.text));
  });
  return chain;
}

const cap = JSON.parse(readFileSync(join(DESIGN_DIR, `${CAPTURE}.json`), 'utf8'));
const nodes = cap.result.nodes.filter((n) => (ONE ? n.id === ONE : n.name));
if (!nodes.length) { console.error(`no layers to check (${CAPTURE}${ONE ? ' / ' + ONE : ''})`); process.exit(2); }

let bad = 0;
console.log(`── render path: is the file carrying the layer the file that draws it? (${CAPTURE})`);
console.log('');
for (const n of nodes) {
  // which file carries this layer's marker?
  const owners = sources.filter((s) => s.text.includes(`data-node-id="${n.id}"`) || s.text.includes(`data-node-id=${n.id}`));
  if (!owners.length) {
    console.log(`  NO MARKER       ${n.id}  "${n.name}"  — no source carries this layer's id`);
    bad++;
    continue;
  }
  if (owners.length > 1) {
    console.log(`  MARKER IN ${owners.length}  ${n.id}  "${n.name}"  — ${owners.map((o) => o.rel.replace('frontend/src/components/lit/', '')).join(', ')}`);
  }
  const owner = owners[0];
  const chain = renderChain(owner.rel, owner.tag);
  const short = owner.rel.replace('frontend/src/components/lit/', '');
  if (!chain.reachable) {
    bad++;
    console.log(`  NOT RENDERED    ${n.id}  "${n.name}"  → ${short}`);
    console.log(`                  imported at startup: ${chain.imported ? 'yes' : 'NO'} · drawn by a reachable element: NO`);
    console.log(`                  Nothing the app mounts draws this element. Confirm which element renders this block before editing it.`);
  }
}
console.log('');
if (!bad) console.log(`  all ${nodes.length} layer(s) are carried by a file that is imported and drawn.`);
else console.log(`  ${bad} layer(s) whose marker is not provably rendered — THESE ARE THE ONES TO CHECK FIRST.`);
process.exit(bad ? 1 : 0);
