#!/usr/bin/env node
/**
 * design-export-asset.mjs — THE ARTWORK, RE-EXPORTED FROM THE LAYER THE FILE DRAWS.
 *
 * A stale asset is invisible to every value check that compares a box and a colour: the app
 * draws an OLD glyph scaled into the NEW box and the row reads EQUAL. That is what happened
 * to `figma-readout-model-mark.svg` — square 26-unit-era artwork in a 20×20 mark whose layer
 * is 18.75×17.5 — and it was found by computing the artwork's extents, not by looking.
 *
 * So the export is a command, not a memory:
 *   node scripts/design-export-asset.mjs --node 40001124:7096 --out src/assets/figma-readout-model-mark.svg
 *
 * The node exported is the FRAME the app sizes (the mark), not the vector inside it: the SVG's
 * viewBox then carries the frame's own box with the artwork inset exactly as the file draws it,
 * so rendering it at the frame's size lands the artwork where the drawing has it.
 *
 * Read-only against Figma; writes one asset file. No model in this loop.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(ROOT, '..');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const NODE = opt('--node', null);
const OUT = opt('--out', null);
if (!NODE || !OUT) {
  console.error('usage: node scripts/design-export-asset.mjs --node <nodeId> --out <path.svg>');
  process.exit(2);
}

function envValue(name) {
  const text = readFileSync(join(REPO, 'backend', '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && m[1] === name) return m[2].trim().replace(/^["']|["']$/g, '');
  }
  return '';
}
const TOKEN = envValue('FIGMA_TOKEN');
const KEY = opt('--key', envValue('FIGMA_DEFAULT_FILE_KEY'));
if (!TOKEN || !KEY) { console.error('[asset] FAIL: FIGMA_TOKEN / FIGMA_DEFAULT_FILE_KEY missing from backend/.env'); process.exit(2); }

// 1. the node's own address, so a moved or deleted layer is named rather than guessed
const nodeRes = await fetch(`https://api.figma.com/v1/files/${KEY}/nodes?ids=${encodeURIComponent(NODE)}`, { headers: { 'X-Figma-Token': TOKEN } });
if (!nodeRes.ok) { console.error(`[asset] FAIL: REST ${nodeRes.status} reading ${NODE}`); process.exit(1); }
const doc = (await nodeRes.json()).nodes?.[NODE]?.document;
if (!doc) { console.error(`[asset] FAIL: node ${NODE} is not in the file — it was deleted or moved`); process.exit(1); }

// 2. the export
const imgRes = await fetch(`https://api.figma.com/v1/images/${KEY}?ids=${encodeURIComponent(NODE)}&format=svg&svg_outline_text=false`, { headers: { 'X-Figma-Token': TOKEN } });
if (!imgRes.ok) { console.error(`[asset] FAIL: REST ${imgRes.status} exporting ${NODE}`); process.exit(1); }
const url = (await imgRes.json()).images?.[NODE];
if (!url) { console.error(`[asset] FAIL: no image URL returned for ${NODE}`); process.exit(1); }
const svgRes = await fetch(url);
if (!svgRes.ok) { console.error(`[asset] FAIL: the asset URL answered ${svgRes.status}`); process.exit(1); }
const svg = await svgRes.text();
if (!svg.includes('<svg')) { console.error('[asset] FAIL: the export is not an SVG'); process.exit(1); }

writeFileSync(join(ROOT, OUT), svg.endsWith('\n') ? svg : svg + '\n');

const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1] || '(none)';
const fills = [...new Set([...svg.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{3,8})"/g)].map((m) => m[1]))];
console.log(`[asset] ${NODE} (${doc.name}, ${doc.absoluteBoundingBox.width}×${doc.absoluteBoundingBox.height}) → ${OUT}`);
console.log(`[asset] viewBox ${vb} · colours ${fills.join(', ') || '(none)'}`);
console.log(`[asset] ${svg.length} bytes`);
