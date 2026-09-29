#!/usr/bin/env node
/**
 * layer-id-name.mjs — THE APP HAS TO KEEP UP WITH THE DESIGNER.
 *
 * The owner, 2026-09-20: "the notes are gonna be changing, they're gonna be deleted, they're
 * gonna be updated. The layer might change the name. That's what the designer does — that
 * application has to keep up with that."
 *
 * So this compares TWO LISTS, per layer, and reports three facts. No judgement, no model:
 *
 *   an id the drawing has and no marker carries   →  THE APP IS BEHIND   (add it)
 *   a marker id the drawing no longer has         →  DELETED             (retire it)
 *   an id both have, under different names        →  RENAMED             (follow it)
 *
 * THE ID IS THE IDENTITY — it never changes; a layer is deleted or updated, and a new id in an
 * old layer's place is a NEW COMPONENT. THE NAME IS THE LABEL — the designer reads names, the
 * agent reads ids, and a discrepancy is only visible when the two are held against each other.
 *
 * CARRIED BY EXPORT is not MISSING. A layer whose geometry and paint live inside the SVG an
 * element draws (an IMAGE-SVG in MCP, a frame+vector in REST) has no element of its own: the
 * asset IS the layer. Those are reported as carried, never as absent.
 *
 * Usage: node scripts/layer-id-name.mjs --capture <scope>
 * Exit 1 when the app is behind, when a marker is deleted, or when a name moved.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_DIR = join(ROOT, 'src', 'design');
const LIT_DIR = join(ROOT, 'src', 'components', 'lit');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const CAPTURE = opt('--capture', 'chat-column');
const ONE = opt('--node', null);

/* THE DRAWING, for the comparison: id → name, from the scope being checked. */
const cap = JSON.parse(readFileSync(join(DESIGN_DIR, `${CAPTURE}.json`), 'utf8'));
const drawing = new Map();
for (const n of cap.result.nodes) {
  if (ONE && n.id !== ONE) continue;
  drawing.set(n.id, String(n.name ?? ''));
}

/* EVERY DRAWING THIS REPO HAS READ, for the other half of the question. A marker is only
   DELETED if its id appears in NO capture — a component in this column may legitimately carry
   ids from a scope of its own (control-bar, small-dropdown, user-response-bubble each have
   their own). Holding one scope's markers against one capture reported 21 live markers as
   dead and buried the 93 findings that are real. Same union the value check uses. */
const knownIds = new Set();
for (const f of readdirSync(DESIGN_DIR)) {
  if (!f.endsWith('.json') || f.endsWith('-verified.json') || f === 'VALUES.json' || f === 'node-census.json') continue;
  try { for (const id of readFileSync(join(DESIGN_DIR, f), 'utf8').match(/\d+:\d+/g) || []) knownIds.add(id); } catch { /* unreadable is not a claim */ }
}

/* the code: every marker's id → { name, file } */
const markers = new Map();
const files = readdirSync(LIT_DIR, { withFileTypes: true }).filter((e) => e.name.endsWith('.ts'));
for (const f of files) {
  const text = readFileSync(join(LIT_DIR, f.name), 'utf8');
  for (const m of text.matchAll(/data-node-id="([0-9:]+)"(?:\s+data-layer-name="([^"]*)")?/g)) {
    markers.set(m[1], { name: m[2] ?? null, file: `frontend/src/components/lit/${f.name}` });
  }
}

/* A LAYER IS CARRIED BY EXPORT when an asset the element imports stands in for it. The read
   records those as the SVG's own children; the code draws the asset. Named here, once. */
const CARRIED = new Set();
for (const f of files) {
  const text = readFileSync(join(LIT_DIR, f.name), 'utf8');
  for (const m of text.matchAll(/CARRIED BY EXPORT[^\n]*\n(?:[^\n]*\n){0,6}?[^\n]*?(?:(\d+:\d+)[^\n]*){1}/g)) {
    for (const id of m[0].match(/\d+:\d+/g) ?? []) if (!markers.has(id)) CARRIED.add(id);
  }
}

const behind = [], deleted = [], renamed = [];
for (const [id, name] of drawing) {
  if (markers.has(id)) {
    const mk = markers.get(id);
    if (mk.name && mk.name !== name) renamed.push({ id, drawing: name, code: mk.name, file: mk.file });
    continue;
  }
  if (CARRIED.has(id)) continue;
  behind.push({ id, name });
}
/* a marker is DELETED only when NO drawing has its id — otherwise it belongs to another scope */
for (const [id, mk] of markers) if (!drawing.has(id) && !knownIds.has(id)) deleted.push({ id, ...mk });

console.log(`── layer ids and names: the app against the drawing (${CAPTURE})`);
console.log(`   drawing ${drawing.size} layer(s) · the code carries ${markers.size} marker(s) · ${CARRIED.size} carried by export`);
console.log('');
for (const r of renamed)  console.log(`  RENAMED       ${r.id}  drawing "${r.drawing}"  code "${r.code}"   (${r.file})`);
for (const b of behind)   console.log(`  APP IS BEHIND ${b.id}  "${b.name}"  — the drawing has it, no marker carries it`);
for (const d of deleted)  console.log(`  DELETED       ${d.id}  "${d.name ?? '(no name)'}"  — no longer in the drawing; the marker renders nothing  (${d.file})`);

const bad = behind.length + deleted.length + renamed.length;
console.log('');
if (!bad) console.log('  ok — every layer the drawing has is carried, under its own name.');
else {
  console.log(`  ${bad} finding(s). The designer changes names, deletes layers and redraws them; the app keeps up`);
  console.log('  by comparing the two lists every run. An id that is gone does not come back — a new id in its');
  console.log('  place is a NEW COMPONENT, whatever it is called.');
}
process.exit(bad ? 1 : 0);
