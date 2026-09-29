#!/usr/bin/env node
/**
 * layer-name-drift.mjs — THE CATALOG'S LAYER NAMES AGAINST THE DRAWING'S.
 *
 * THE REQUIREMENT, 2026-09-20: "I may be adding it to the lit catalogue will force you to look
 * at the name and resolve a discrepancy… now it matters. Just make it a requirement for lit
 * catalog making."
 *
 * THE FAILURE IT PREVENTS. The designer cannot see node ids. The agent read past layer names.
 * Eleven hours went into editing `output-header-area.ts` while `chat-panel.ts` drew that block
 * from `chat-header` — both files carrying the right node id, neither carrying the layer's
 * name, so nothing could say which file was on screen. And when the designer re-drew the
 * component, the code kept `Frame 886980` on a node the drawing now calls `textarea`, and
 * applied the new measurements under the old name.
 *
 * THE THREE ANSWERS, all arithmetic — the id is the identity, the name is the label:
 *   id in the catalog, not in the drawing   → DELETED      the marker renders nothing
 *   id in the drawing, not in the catalog   → NEW LAYER    nothing covers it yet
 *   id in both, names differ                → NAME MOVED   the code must follow
 *
 * A new id in an old layer's place is a NEW COMPONENT, whatever it was called.
 *
 * Usage:
 *   node scripts/layer-name-drift.mjs --capture chat-column
 *   node scripts/layer-name-drift.mjs --node 40001127:2060
 * Exit 1 when any of the three is found.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_DIR = join(ROOT, 'src', 'design');
const CATALOG = join(ROOT, 'src', 'components', 'A2UI', 'catalogs', 'prompt-composer', 'catalog.json');
const REGISTRY = join(ROOT, 'src', 'shared', 'tag-registry.ts');
const LIT_DIR = join(ROOT, 'src', 'components', 'lit');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const CAPTURE = opt('--capture', 'chat-column');
const ONE = opt('--node', null);

/* ── THE CATALOG SIDE: every layer the catalog names, id → name ─────────────────────────────
   Read from BOTH homes, because a component may be registered before it is schema'd:
     · the registry's `layers` array  (tag-registry.ts)
     · the catalog's `x-layers`       (catalog.json)
   They must agree with each other as well as with the drawing. */
function catalogLayers() {
  const out = new Map();       // nodeId → { name, where }
  const conflicts = [];

  // the registry: `{ nodeId: '…', name: "…", type: '…', size: '…' }`
  const reg = readFileSync(REGISTRY, 'utf8');
  for (const m of reg.matchAll(/\{\s*nodeId:\s*'([^']+)',\s*name:\s*("(?:[^"\\]|\\.)*"|'[^']*'),\s*type:\s*'([^']*)',\s*size:\s*'([^']*)'\s*\}/g)) {
    const name = m[2].startsWith('"') ? JSON.parse(m[2]) : m[2].slice(1, -1);
    out.set(m[1], { name, where: 'registry', type: m[3], size: m[4] });
  }

  // the catalog: `{"nodeId": "…", "name": "…", …}`
  if (existsSync(CATALOG)) {
    const cat = JSON.parse(readFileSync(CATALOG, 'utf8'));
    for (const [tag, def] of Object.entries(cat.components || {})) {
      for (const l of def['x-layers'] || []) {
        if (!l || !l.nodeId) continue;
        const existing = out.get(l.nodeId);
        if (existing && existing.name !== l.name) conflicts.push({ nodeId: l.nodeId, a: existing, b: { name: l.name, where: `catalog:${tag}` } });
        else if (!existing) out.set(l.nodeId, { name: l.name, where: `catalog:${tag}`, type: l.type, size: l.size });
      }
    }
  }
  return { layers: out, conflicts };
}

/* ── THE DRAWING SIDE: id → name, from the capture ──────────────────────────────────────── */
const cap = JSON.parse(readFileSync(join(DESIGN_DIR, `${CAPTURE}.json`), 'utf8'));
const drawing = new Map();
for (const n of cap.result.nodes) {
  if (ONE && n.id !== ONE) continue;
  drawing.set(n.id, String(n.name ?? ''));
}
/* Which lit file carries each id, so every row can name the file that must change. */
const sources = readdirSync(LIT_DIR, { withFileTypes: true })
  .filter((e) => e.name.endsWith('.ts'))
  .map((e) => ({ rel: `frontend/src/components/lit/${e.name}`, text: readFileSync(join(LIT_DIR, e.name), 'utf8') }));
const fileOf = (id) => (sources.find((s) => s.text.includes(`"${id}"`) || s.text.includes(id)) || {}).rel || null;

const { layers: catalog, conflicts } = catalogLayers();

const deleted = [], added = [], renamed = [];
for (const [id, c] of catalog) {
  if (ONE && id !== ONE) continue;
  if (!drawing.has(id)) { deleted.push({ id, ...c }); continue; }
  const dName = drawing.get(id);
  if (dName !== c.name) renamed.push({ id, catalog: c.name, drawing: dName, where: c.where, file: fileOf(id) });
}
for (const [id, name] of drawing) if (!catalog.has(id)) added.push({ id, name, file: fileOf(id) });

console.log(`── layer names: the catalog against the drawing (${CAPTURE})`);
console.log(`   catalog names ${catalog.size} layer(s) · the drawing has ${drawing.size}`);
console.log('');
for (const c of conflicts) console.log(`  INTERNAL        ${c.nodeId}  the ${c.a.where} says "${c.a.name}", the ${c.b.where} says "${c.b.name}"`);
for (const r of renamed) console.log(`  NAME MOVED      ${r.id}  catalog "${r.catalog}"  →  drawing "${r.drawing}"   (${r.file || 'no file carries it'})`);
for (const d of deleted) console.log(`  DELETED         ${d.id}  "${d.name}"  — the drawing no longer has it; the marker renders nothing  (${fileOf(d.id) || '—'})`);
for (const a of added) console.log(`  NEW LAYER       ${a.id}  "${a.name}"  — the catalog does not name it  (${a.file || 'no file carries it'})`);

const bad = conflicts.length + renamed.length + deleted.length + added.length;
console.log('');
if (!bad) console.log(`  ok — every layer the catalog names is in the drawing, under the same name.`);
else {
  console.log(`  ${bad} finding(s).`);
  console.log('  THE ID IS THE IDENTITY, THE NAME IS THE LABEL. The designer reads names; the agent reads ids;');
  console.log('  a discrepancy is only visible when the two meet, which is why the catalog must carry both.');
}
process.exit(bad ? 1 : 0);
