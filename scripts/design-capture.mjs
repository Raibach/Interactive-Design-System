#!/usr/bin/env node
/**
 * design-capture.mjs — THE READ. Figma REST → src/design/<scope>.json, machine-written.
 *
 * NO LLM IN THIS LOOP. Every number in the capture is the API's own, converted and
 * written by this script. Nothing here is typed by hand and nothing is inferred from a
 * name: a layer's values are read from the layer, which is the only place they exist.
 *
 * WHY REST AND NOT THE MCP: the MCP's get_design_context did not expose a vector's
 * styling, so an icon's colour was invisible to every check built on it — the owner
 * found that by opening the file himself on 2026-09-20, after an hour and a half of
 * "the design does not match". `/v1/files/{key}/nodes?geometry=paths` returns the fills
 * of a VECTOR, so the read is complete.
 *
 * THE WALK IS UNBOUNDED, deliberately: no depth limit, no node budget. A capture that
 * stops early is a blind spot that reads like a pass.
 *
 * Parent links are written (`parent`, `depth`, `children`) because a value check must be
 * able to attribute a layer to the frame that holds it — the vectors inside a mark
 * belong to that mark, and a flat list cannot say so.
 *
 * Usage:
 *   node scripts/design-capture.mjs [--scope chat-column] [--node 40001119:6026]
 *                                   [--key 20UPR2KQMsbAxlo5NJb1se] [--out src/design/x.json]
 *
 * Default scope map lives below; add a scope by adding one line to SCOPES.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(ROOT, '..');
const ENV_PATH = join(REPO, 'backend', '.env');

const SCOPES = {
  'chat-column': '40001119:6026',      // chat-panel-outer — the output column (v.4b)
  'prompt-column': '40000746:6',       // the prompt column's container
  'prompt-section': '40000746:94',     // one prompt row (the accordion's shell)
  'prompt-rail': '40000880:270',       // the formatting rail
  'prompt-accordion': '40000909:3998', // the accordion — the code's own marker; the root this
                                       // scope carried before (40000880:345) is GONE from the file
};

// ── args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const SCOPE = opt('--scope', 'chat-column');
const OUT = opt('--out', join(ROOT, 'src', 'design', `${SCOPE}.json`));

// ── the token and the file, from the repo's own env ─────────────────────
function envValue(name) {
  const text = readFileSync(ENV_PATH, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && m[1] === name) return m[2].trim().replace(/^["']|["']$/g, '');
  }
  return '';
}
const TOKEN = envValue('FIGMA_TOKEN');
const KEY = opt('--key', envValue('FIGMA_DEFAULT_FILE_KEY'));
const NODE = opt('--node', SCOPES[SCOPE]);
if (!TOKEN) { console.error('[capture] FAIL: no FIGMA_TOKEN in backend/.env'); process.exit(2); }
if (!KEY) { console.error('[capture] FAIL: no FIGMA_DEFAULT_FILE_KEY in backend/.env'); process.exit(2); }
if (SCOPE !== 'all' && !NODE) { console.error(`[capture] FAIL: unknown scope "${SCOPE}" and no --node given`); process.exit(2); }

// ── value conversion: Figma's own numbers, nothing invented ─────────────
const px = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);
const a2 = (v) => Math.round(v * 100) / 100;

/** A Figma paint → the one string form the checks compare. Alpha is the paint's own,
 *  multiplied by the paint's opacity when the file sets one. */
function paint(p) {
  if (!p || p.visible === false) return null;
  const c = p.color;
  if (!c) return p.type ? p.type : null;
  const a = (c.a ?? 1) * (p.opacity ?? 1);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a2(a)})`;
}

/** The first visible paint of a list — what the layer actually shows. */
function firstPaint(list) {
  if (!Array.isArray(list)) return null;
  for (const p of list) {
    const v = paint(p);
    if (v) return v;
  }
  return null;
}

function effect(e) {
  if (e.visible === false) return null;
  const c = paint({ color: e.color });
  const off = e.offset || { x: 0, y: 0 };
  const parts = [e.type, px(off.x), px(off.y)];
  if (e.radius !== undefined) parts.push('blur', px(e.radius));
  if (e.spread !== undefined) parts.push('spread', px(e.spread));
  parts.push(c || 'rgba(0,0,0,1)');
  return parts.join(' ');
}

function textStyle(node) {
  const s = node.style;
  if (!s) return null;
  const lh = s.lineHeight && s.lineHeight.unit === 'PIXELS'
    ? px(s.lineHeight.value)
    : s.lineHeight && s.lineHeight.unit === 'PERCENT'
      ? `${px(s.lineHeight.value)}%`
      : 'AUTO';
  const ls = s.letterSpacing && s.letterSpacing.unit === 'PIXELS' ? px(s.letterSpacing.value) : null;
  return {
    family: s.fontFamily,
    weight: s.fontWeight,
    size: px(s.fontSize),
    lh,
    ...(ls !== null ? { ls } : {}),
    align: s.textAlignHorizontal,
    valign: s.textAlignVertical,
    characters: node.characters ?? '',
  };
}

/** One Figma node → one flat record. Fields with no value are LEFT OUT, so the capture
 *  stays readable; a field's absence means the file holds nothing there. */
function record(n, parent, depth, childrenOf) {
  const r = { id: n.id, name: n.name, type: n.type };
  const box = n.absoluteBoundingBox;
  if (box) { r.w = px(box.width); r.h = px(box.height); }
  const auto = n.layoutMode && n.layoutMode !== 'NONE';
  if (auto) r.layout = n.layoutMode;
  /* A padding of 0 is a value, not an absence: written out for every auto-layout frame so
     the check compares it instead of reading a missing field as "unknown". */
  if (auto || n.paddingLeft !== undefined) {
    r.pad = {
      paddingLeft: px(n.paddingLeft ?? 0), paddingRight: px(n.paddingRight ?? 0),
      paddingTop: px(n.paddingTop ?? 0), paddingBottom: px(n.paddingBottom ?? 0),
    };
  }
  if (auto) r.gap = px(n.itemSpacing ?? 0);
  if (n.primaryAxisAlignItems && n.primaryAxisAlignItems !== 'MIN') r.primaryAlign = n.primaryAxisAlignItems;
  if (n.counterAxisAlignItems && n.counterAxisAlignItems !== 'MIN') r.counterAlign = n.counterAxisAlignItems;
  if (n.layoutSizingHorizontal) r.sizingH = n.layoutSizingHorizontal;
  if (n.layoutSizingVertical) r.sizingV = n.layoutSizingVertical;
  if (n.layoutGrow) r.grow = n.layoutGrow;
  const fill = firstPaint(n.fills);
  if (fill) r.fill = fill;
  const stroke = firstPaint(n.strokes);
  if (stroke) r.stroke = stroke;
  if (n.strokeWeight !== undefined && n.strokes && n.strokes.length) r.strokeW = px(n.strokeWeight);
  if (n.strokeAlign !== undefined && n.strokes && n.strokes.length) r.strokeAlign = n.strokeAlign;
  if (n.strokeCap) r.strokeCap = n.strokeCap;
  const effects = (n.effects || []).map(effect).filter(Boolean);
  if (effects.length) r.effects = effects;
  if (n.cornerRadius !== undefined) r.radius = px(n.cornerRadius);
  if (n.rectangleCornerRadii) r.cornerRadii = n.rectangleCornerRadii.map(px);
  if (n.opacity !== undefined && n.opacity !== 1) r.opacity = a2(n.opacity);
  if (n.blendMode && n.blendMode !== 'PASS_THROUGH' && n.blendMode !== 'NORMAL') r.blendMode = n.blendMode;
  if (n.clipsContent === true) r.clips = true;
  const t = textStyle(n);
  if (t) r.text = t;
  // THE ANNOTATIONS ARE THE DESIGNER'S OWN WORDS, carried so a reader never has to open
  // the file to read them. Every attribute whose name ends in "annotations" is read —
  // the name is untrusted across API versions (design-extract.mjs records the same).
  const notes = [];
  for (const [k, v] of Object.entries(n)) {
    if (/annotations$/i.test(k) && Array.isArray(v)) {
      for (const a of v) notes.push(typeof a === 'string' ? a : (a?.label ?? ''));
    }
  }
  if (notes.length) r.annotations = notes.filter(Boolean);
  r.parent = parent;
  r.depth = depth;
  if (childrenOf.length) r.children = childrenOf;
  return r;
}

// ── the walk: no depth limit ────────────────────────────────────────────
function walk(node, parent, depth, out) {
  const kids = (node.children || []).filter((c) => c.visible !== false);
  const rec = record(node, parent, depth, kids.map((c) => c.id));
  out.push(rec);
  for (const k of kids) walk(k, node.id, depth + 1, out);
  return out;
}

/** One scope: read it from REST, walk it to the bottom, write it. Throws on failure so a
 *  run of many scopes names the one that failed instead of stopping at the first. */
async function captureScope(name, nodeId, outPath) {
  const url = `https://api.figma.com/v1/files/${KEY}/nodes?ids=${encodeURIComponent(nodeId)}&geometry=paths`;
  const res = await fetch(url, { headers: { 'X-Figma-Token': TOKEN } });
  if (!res.ok) throw new Error(`REST ${res.status} ${res.statusText} for ${nodeId}`);
  const body = await res.json();
  const doc = body.nodes?.[nodeId]?.document;
  if (!doc) throw new Error(`node ${nodeId} not in the response — it was deleted or moved`);
  const nodes = walk(doc, null, 0, []);
  if (!nodes.length) throw new Error(`zero layers under ${nodeId} — the scope root is wrong`);
  const deepest = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  const capture = {
    _capture: {
      scope: name,
      nodeId,
      name: doc.name,
      fileKey: KEY,
      source: 'Figma REST /v1/files/{key}/nodes (geometry=paths) — every node, every style field',
      captured: new Date().toISOString().slice(0, 10),
      layers: nodes.length,
      deepestLevel: deepest,
    },
    result: { nodes },
  };
  writeFileSync(outPath, JSON.stringify(capture, null, 2));
  console.log(`[capture] ${nodes.length} layers, ${deepest} levels deep — ${nodeId} (${doc.name}) → ${outPath}`);
  return capture;
}

if (SCOPE === 'all') {
  // EVERY governed root, in one run: no scope is captured only when somebody remembers.
  const failures = [];
  for (const [name, id] of Object.entries(SCOPES)) {
    try {
      await captureScope(name, id, join(ROOT, 'src', 'design', `${name}.json`));
    } catch (e) {
      failures.push(`${name} (${id}): ${e.message}`);
    }
  }
  if (failures.length) {
    console.error(`[capture] FAIL — ${failures.length} scope(s) could not be read:`);
    for (const f of failures) console.error(`   ${f}`);
    process.exit(1);
  }
  console.log(`[capture] ${Object.keys(SCOPES).length} scope(s) written`);
} else {
  await captureScope(SCOPE, NODE, OUT);
}
