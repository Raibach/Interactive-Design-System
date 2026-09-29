#!/usr/bin/env node
/**
 * design-extract.mjs — DETERMINISTIC MCP-cache → value-table extractor.
 *
 * Reads each src/design/*.json (raw Figma MCP get_design_context output) and
 * mechanically extracts every design value into src/design/VALUES.json:
 * sizes, paddings, gaps, colors, fonts, shadows, radii, asset references.
 *
 * NO LLM in this loop. Every number in VALUES.json is machine-traced to a
 * Tailwind class or inline style in the MCP output. Lit components copy from
 * VALUES.json — never from a model's memory. Re-run after any MCP re-pull.
 *
 * Usage: node scripts/design-extract.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_DIR = join(ROOT, 'src', 'design');
const OUT = join(DESIGN_DIR, 'VALUES.json');

// ── Tailwind arbitrary-value class → CSS property (exact mappings only) ────
const CLASS_MAP = {
  'bg-white': () => ({ 'background-color': '#ffffff' }),
  'bg-black': () => ({ 'background-color': '#000000' }),
  'rounded-[6px]': () => ({ 'border-radius': '6px' }),
  'text-center': () => ({ 'text-align': 'center' }),
  'flex-col': () => ({ 'flex-direction': 'column' }),
  'items-center': () => ({ 'align-items': 'center' }),
  'items-start': () => ({ 'align-items': 'flex-start' }),
  'justify-center': () => ({ 'justify-content': 'center' }),
  'relative': () => ({ position: 'relative' }),
  'absolute': () => ({ position: 'absolute' }),
  'font-bold': () => ({ 'font-weight': '700' }),
  'font-semibold': () => ({ 'font-weight': '600' }),
  'not-italic': () => ({ 'font-style': 'normal' }),
  'whitespace-pre-wrap': () => ({ 'white-space': 'pre-wrap' }),
  'content-stretch': () => ({ 'align-items': 'stretch' }),
  'shrink-0': () => ({ 'flex-shrink': '0' }),
  'size-full': () => ({ width: '100%', height: '100%' }),
  'block': () => ({ display: 'block' }),
  'overflow-hidden': () => ({ overflow: 'hidden' }),
};

// Arbitrary bracket classes: p-[..] gap-[..] w-[..] h-[..] text-[..] etc.
const ARBITRARY = {
  p: 'padding', pt: 'padding-top', pr: 'padding-right', pb: 'padding-bottom', pl: 'padding-left',
  m: 'margin', mt: 'margin-top', mr: 'margin-right', mb: 'margin-bottom', ml: 'margin-left',
  mx: 'margin-x', my: 'margin-y',
  gap: 'gap', w: 'width', h: 'height', 'size': null, 'top': 'top', 'left': 'left',
  'right': 'right', 'bottom': 'bottom', 'text': null, 'leading': 'line-height',
  'rounded': 'border-radius', 'min-w': 'min-width', 'max-w': 'max-width',
  'inset': 'inset', 'z': 'z-index',
};

function classToCss(cls) {
  if (CLASS_MAP[cls]) return CLASS_MAP[cls]();
  // color literals: text-[#hex] / bg-[rgba(...)]
  let m = cls.match(/^text-\[(#hex|#[0-9a-fA-F]+|rgba?\([^)]+\)|black|white)\]$/);
  if (m) return { color: m[1] };
  m = cls.match(/^bg-\[(#hex|#[0-9a-fA-F]+|rgba?\([^)]+\))\]$/);
  if (m) return { 'background-color': m[1] };
  m = cls.match(/^text-\[(\d+)px\]$/);
  if (m) return { 'font-size': `${m[1]}px` };
  // arbitrary bracket props
  m = cls.match(/^([a-z-]+)-\[([^\]]+)\]$/);
  if (m && ARBITRARY[m[1]] !== undefined) {
    let val = m[2].replace(/_/g, ' '); // Tailwind arbitrary values use _ for spaces
    const prop = ARBITRARY[m[1]];
    if (prop) return { [prop]: val };
    // dual-axis shorthands: px → left+right, py → top+bottom, mx/my same for margins
    if (m[1] === 'px') return { 'padding-left': val, 'padding-right': val };
    if (m[1] === 'py') return { 'padding-top': val, 'padding-bottom': val };
    if (m[1] === 'mx') return { 'margin-left': val, 'margin-right': val };
    if (m[1] === 'my') return { 'margin-top': val, 'margin-bottom': val };
    if (m[1] === 'size') return { width: val, height: val };
    if (m[1] === 'text') return { }; // handled above; ignore leftovers
  }
  // drop-shadow / shadow arbitrary — ALL shadows, as box-shadow (Figma DROP_SHADOW effects)
  m = cls.match(/^(drop-)?shadow-\[([^\]]+)\]$/);
  if (m) {
    const all = m[2].replace(/_/g, ' ');
    // split on commas not inside rgba(...)
    const shadows = all.split(/,(?![^(]*\))/).map(s => s.trim()).filter(Boolean);
    return { 'box-shadow': shadows.join(', ') };
  }
  return null;
}

// Annotation attribute matcher — the name is UNTRUSTED across MCP versions.
// Matches any attribute whose name starts with "data-" and contains "annotation"
// (case-insensitive): the /^data-.*annotation/i contract applied to attribute
// names. Captures the full name (group 1) and its value (group 2).
//
// There is deliberately NO expected-name constant. A hardcoded expectation makes
// the reader depend on ONE spelling of a name the protocol says to treat as
// untrusted, and the pulls disagree with each other already:
//   · `data-development-annotations`  — MCP get_design_context
//   · `data-annotations`              — REST /v1/files/.../nodes (the STATE note)
//   · `data-interaction-annotations`  — REST nodes (the `On click:` contract)
// Three names, one contract. Names actually seen are RECORDED instead of assumed:
// `_meta.annotationAttributeNames` + the run summary, both from this same pull.
const ANNOTATION_ATTR = /(data-[a-zA-Z0-9-]*annotation[a-zA-Z0-9-]*)\s*=\s*"([^"]*)"/gi;

let nodesScanned = 0;
let annotationsFound = 0;
const attributeNamesSeen = new Set();

const VALUES = { _meta: { source: 'Figma MCP get_design_context caches', extractedAt: new Date().toISOString() } };

for (const file of readdirSync(DESIGN_DIR).filter(f => f.endsWith('.json') && f !== 'VALUES.json')) {
  const name = file.replace('.json', '');
  const raw = JSON.parse(readFileSync(join(DESIGN_DIR, file), 'utf8'));
  const text = raw.result?.content?.find(c => c.type === 'text')?.text || '';
  const body = text.split('SUPER CRITICAL')[0];

  const component = { assets: [], nodes: {} };

  // asset constants
  for (const m of body.matchAll(/const\s+(\w+)\s*=\s*"(http:\/\/localhost:3845\/assets\/[^"]+)"/g)) {
    component.assets.push({ name: m[1], url: m[2], file: 'src/assets/figma-' + m[2].split('/').pop() });
  }

  // every element with a data-node-id: collect classes → css + annotations
  for (const m of body.matchAll(/<(\w+)([^>]*?)data-node-id="([^"]+)"([^>]*?)>/g)) {
    const allAttrs = m[2] + ' ' + m[4];
    const nodeId = m[3];
    nodesScanned++;

    const nameMatch = allAttrs.match(/data-name="([^"]+)"/);
    const classMatch = allAttrs.match(/className="([^"]*)"/);
    const styleMatch = allAttrs.match(/style=\{?\{([^}]*)\}?/);

    // annotations on this node — attribute name is UNTRUSTED, match any data-*-annotation*
    const nodeAnnotations = [];
    for (const am of allAttrs.matchAll(ANNOTATION_ATTR)) {
      const attrName = am[1];
      const value = am[2];
      annotationsFound++;
      attributeNamesSeen.add(attrName);
      nodeAnnotations.push({ attribute: attrName, value });
    }
    if (nodeAnnotations.length) {
      component.annotations = component.annotations || [];
      for (const a of nodeAnnotations) component.annotations.push({ attribute: a.attribute, value: a.value, nodeId });
    }

    if (!nameMatch && !classMatch) continue;
    const css = {};
    if (classMatch) {
      for (const cls of classMatch[1].split(/\s+/).filter(Boolean)) {
        const props = classToCss(cls);
        if (props) Object.assign(css, props);
      }
    }
    if (styleMatch) css._inlineStyle = styleMatch[1].trim();
    const key = nameMatch ? nameMatch[1] : `node-${nodeId}`;
    const node = { nodeId, css };
    if (nodeAnnotations.length) node.annotations = nodeAnnotations;
    component.nodes[key] = node;
  }

  // literal text content per named text node
  for (const m of body.matchAll(/data-name="([^"]+)"[^>]*>\s*<p[^>]*>([^<]*)<\/p>/g)) {
    if (component.nodes[m[1]]) component.nodes[m[1]].text = m[2];
  }

  VALUES[name] = component;
}

VALUES._meta.annotationAttributeNames = [...attributeNamesSeen].sort();
VALUES._meta.stats = { nodesScanned, annotationsFound };

writeFileSync(OUT, JSON.stringify(VALUES, null, 2));
console.log(`extracted ${Object.keys(VALUES).length - 1} components -> ${OUT}`);
for (const [k, v] of Object.entries(VALUES)) {
  if (k === '_meta') continue;
  const ann = v.annotations ? v.annotations.length : 0;
  console.log(`  ${k}: ${Object.keys(v.nodes || {}).length} nodes, ${v.assets.length} assets, ${ann} annotations`);
}

// Loud summary + hard fail: zero annotations across the whole file set is never
// a valid outcome — it means the matcher or the scope is wrong, not that the
// designers wrote nothing.
console.log(`${nodesScanned} nodes scanned, ${annotationsFound} annotations found, attribute names seen: [${[...attributeNamesSeen].sort().join(', ') || '(none)'}]`);
if (annotationsFound === 0) {
  console.error('[design-extract] FAIL: 0 annotations found across all files. The attribute matcher or the design scope is wrong — not that designers wrote nothing.');
  process.exit(1);
}
