#!/usr/bin/env node
/**
 * design-value-check.mjs — DOES THE CODE DRAW THE VALUES THE FILE SPECIFIES?
 *
 * THIS CHECK IS FOR THE AGENT, NOT FOR THE OWNER. The owner never runs it and never
 * reads it. It exists so that a value written into a component can be checked against
 * the Figma file by something other than the judgement of whoever wrote the value —
 * because "match the Figma design exactly" was complied with, claimed, and shipped wrong
 * for ninety minutes on 2026-09-20, and every one of those failures was a value that
 * could have been compared arithmetically.
 *
 * NO MODEL IS IN THIS LOOP AND NONE MAY BE ADDED. Every fact below is read from a file
 * by this script: the drawing side from the capture (machine-written by
 * design-capture.mjs from the Figma REST API), the code side from the Lit sources. A
 * claim that cannot be computed here is reported as a blind spot — never assumed, never
 * passed. That is the whole design: it computes, it does not opine.
 *
 * THE PAIRING IS ELEMENT-LEVEL, BY NODE ID, NEVER BY NAME. An earlier version of this
 * check joined a node id to the FILE that mentioned it and then regexed the file for the
 * first value that matched — so in a file that draws four layers, all four were compared
 * against whichever value happened to come first. (That is how a gripper's gap "was 5":
 * the 5 belonged to the block above it.) Now:
 *
 *   · the marker's ENCLOSING ELEMENT is found, its classes are read, and the values come
 *     from the CSS rules that match those classes — the cascade, in file order;
 *   · a marker whose id is built at runtime (`${m.nodeId}` over a table, `${this.iconNode}`
 *     handed in by a caller) is resolved mechanically, and if it cannot be resolved the
 *     layer is reported as unsourced rather than skipped;
 *   · a VECTOR's colour is read from the ASSET the paired element draws — the fill inside
 *     the SVG the element imports. A vector whose colour lives nowhere in that asset is a
 *     discrepancy: that is the icon that was drawn cyan against the drawing's #507274
 *     while every other field matched.
 *
 * WHAT IT CANNOT COMPARE, and says so in numbers rather than passing them:
 *   · absolute position in pixels — the drawing is a 1280 frame, the application is the
 *     viewport (the owner's ruling); the values that PLACE a layer (padding, gap, size,
 *     alignment, sizing mode) are compared instead, and those are exact at any width;
 *   · a value the code does not declare at all (a size that comes from a flex share) —
 *     counted as NOT-COMPARED and reported, never read as equal;
 *   · a layer in the file with no marker anywhere above it in the code — counted as a
 *     blind spot and named.
 *
 * Usage:
 *   node scripts/design-value-check.mjs [--capture chat-column] [--limit N]
 *   node scripts/design-value-check.mjs --capture chat-column --seal   promote this run's
 *     values to the reference. A CHECK RUN NEVER SEALS ITSELF — see the note at the seal.
 *
 * Exit 1 on any discrepancy, naming the layer and both values.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_DIR = join(ROOT, 'src', 'design');
const LIT_DIR = join(ROOT, 'src', 'components', 'lit');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const CAPTURE = opt('--capture', 'chat-column');
const LIST_LIMIT = Number(opt('--limit', '40'));
const SHOW_MARKERS = args.includes('--markers');
const SEAL_NOW = args.includes('--seal');

/* `--capture all` COMPARES EVERY SCOPE THAT HAS A CAPTURE — discovered from the files
 * themselves, never from a list somebody has to remember to extend. Each scope is the same
 * comparison run in its own process, so a scope that cannot be read names itself and the
 * others still run, and the exit is 1 if ANY scope has a discrepancy. */
if (CAPTURE === 'all') {
  const scopes = readdirSync(DESIGN_DIR)
    .filter((f) => f.endsWith('.json') && !f.endsWith('-verified.json') && f !== 'VALUES.json' && f !== 'node-census.json')
    .map((f) => {
      try {
        const c = JSON.parse(readFileSync(join(DESIGN_DIR, f), 'utf8'));
        return c._capture ? { name: c._capture.scope || f.replace(/\.json$/, '') } : null;
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
  const self = fileURLToPath(import.meta.url);
  const QUIET = args.includes('--json');
  const summaries = [];
  let failed = 0, unreadable = 0, layers = 0, totalLayers = 0, totalCompared = 0, totalDiscrepancies = 0, totalUnclaimed = 0, totalUnresolved = 0, totalGone = 0;
  for (const s of scopes) {
    const r = spawnSync(process.execPath, [self, '--capture', s.name, '--json'], { encoding: 'utf8' });
    let j = null;
    try { j = JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch { j = null; }
    if (!j) {
      if (QUIET) { failed++; unreadable++; continue; }
      console.log(`\n── ${s.name} — COULD NOT RUN ───────────────────────────────`);
      console.log(`   ${(r.stderr || r.stdout || 'no output').trim().split('\n').slice(-3).join('\n   ')}`);
      failed++; unreadable++;
      continue;
    }
    summaries.push(j);
    layers += j.layers; totalLayers += j.layers; totalCompared += j.compared; totalDiscrepancies += j.discrepancies.length;
    totalUnclaimed += j.unclaimed.length; totalUnresolved += (j.unresolved || []).length; totalGone += (j.gone || []).length;
    if (QUIET) { if (j.discrepancies.length) failed++; continue; }
    console.log(`\n── ${s.name} (${j.nodeId})\n   ${j.layers} layers · ${j.compared} values compared and equal · ${j.discrepancies.length} discrepancies · ${j.unclaimed.length} unclaimed · ${j.notDeclared.length} undeclared · ${j.vectors.read} vectors, ${j.vectors.blind} blind`);
    for (const d of j.discrepancies) {
      console.log(`   FAILED  ${d.id}  ${d.name}  [${d.field}]`);
      console.log(`           file: ${d.file}`);
      console.log(`           code: ${d.code || '(nothing)'}${d.note ? '   — ' + d.note : ''}`);
    }
    for (const m of j.moved) console.log(`   MOVED   ${m.id}  ${m.name}  [${m.field}]  ${JSON.stringify(m.from)} → ${JSON.stringify(m.to)}   (code: ${m.source})`);
    if (j.discrepancies.length) failed++;
  }
  /* `--json` IN ALL-MODE TOO: the same run, read by the recommendation and by anything
     else that wants the numbers rather than the sentences. */
  if (args.includes('--json')) {
    console.log(JSON.stringify({
      scopes: summaries.map((s) => ({ scope: s.capture, nodeId: s.nodeId, layers: s.layers, compared: s.compared,
        discrepancies: s.discrepancies, unclaimed: s.unclaimed, notDeclared: s.notDeclared, vectors: s.vectors, moved: s.moved })),
      totals: { scopes: scopes.length, layers, compared: totalCompared, discrepancies: totalDiscrepancies, failed, unreadable },
      discrepancies: summaries.flatMap((s) => s.discrepancies),
      unclaimed: summaries.flatMap((s) => s.unclaimed),
  gone: summaries.flatMap((s) => s.gone || []),
    }));
    process.exit(failed ? 1 : 0);
  }
  console.log(`\n══ ALL SCOPES ══════════════════════════════════════════════`);
  console.log(`   ${scopes.length} scope(s) read · ${totalLayers} layers · ${totalCompared} values compared and equal`);
  console.log(`   ${totalDiscrepancies} discrepanc(ies) across ${failed} scope(s)${unreadable ? `, ${unreadable} scope(s) that could not be read` : ''}`);
  const unverified = totalUnclaimed + totalUnresolved + totalGone;
  console.log(`   ${failed ? 'FAIL — the code does not draw the file in the scope(s) named above'
    : unverified ? `INCOMPLETE — every compared value equals the file, but ${unverified} layer(s) across these scope(s) are claimed by no element or could not be resolved, so they are NOT verified`
      : 'PASS — every layer in every scope is claimed and every value equals the file'}`);
  process.exit(failed ? 1 : (unverified ? 2 : 0));
}

// ── colours: one normal form, so '#507274' and 'rgba(80,114,116,1)' are the same fact ──
const NAMED = { white: [255, 255, 255, 1], black: [0, 0, 0, 1], transparent: [0, 0, 0, 0] };
function color(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (NAMED[s]) return rgba(...NAMED[s]);
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return rgba(parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16), 1);
  m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (m) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    const a = m[2] ? parseInt(m[2], 16) / 255 : 1;
    return rgba(r, g, b, a);
  }
  m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3) return rgba(parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1);
  }
  return null;
}
function rgba(r, g, b, a) {
  const f = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return `rgba(${f(r)},${f(g)},${f(b)},${Math.round((a ?? 1) * 1000) / 1000})`;
}

// ── sizes: '7px' and '7' are the same fact; 2.16 and 2.16 are equal ─────
function num(v) {
  if (v === null || v === undefined) return null;
  const m = String(v).trim().match(/^(-?\d*\.?\d+)(px|%)?$/);
  return m ? Number(m[1]) : null;
}
const sameNum = (a, b) => {
  const x = num(a), y = num(b);
  return x !== null && y !== null && Math.abs(x - y) < 0.011;
};

// ── the drawing ─────────────────────────────────────────────────────────
const capPath = join(DESIGN_DIR, `${CAPTURE}.json`);
if (!existsSync(capPath)) {
  console.error(`design-value-check — FAIL: no capture at ${capPath}. Run scripts/design-capture.mjs.`);
  process.exit(2);
}
const cap = JSON.parse(readFileSync(capPath, 'utf8'));
const nodes = cap.result?.nodes || [];
const byId = new Map(nodes.map((n) => [n.id, n]));
const rootId = cap._capture?.nodeId;

/** The nearest ANCESTOR of a node that has a marker in the code. A vector is compared
 *  through the element that draws it — the icon's own artwork is inside the asset that
 *  element imports, so that is where its colour must live. */
function* ancestry(n) {
  let cur = n.parent ? byId.get(n.parent) : null;
  while (cur) { yield cur; cur = cur.parent ? byId.get(cur.parent) : null; }
}

// ── the code: markers, elements, styles ─────────────────────────────────
function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.ts') && !e.name.includes('.test.')) out.push(p);
  }
  return out;
}
const sources = walk(LIT_DIR).map((f) => ({ file: f, rel: f.slice(ROOT.length + 1), src: readFileSync(f, 'utf8') }));

/** tag name → the rules of the component that defines it, so a marker on a custom element
 *  is compared against that component's own `:host` styles (they live in ITS file, not in
 *  the file that writes the marker). */
const hostRules = new Map();
for (const s of sources) {
  const def = s.src.match(/customElements\.define\(\s*['"]([^'"]+)['"]/);
  if (def) hostRules.set(def[1], { file: s.rel, rules: cssRules(s.src) });
}

/** Every `import X from '@/assets/…'` in a file: name → the asset on disk. */
function importsOf(src) {
  const out = new Map();
  for (const m of src.matchAll(/import\s+(\w+)\s+from\s+['"]@\/(assets\/[^'"]+)['"]/g)) {
    const p = join(ROOT, 'src', m[2]);
    if (existsSync(p)) out.set(m[1], { path: p, rel: `src/${m[2]}`, text: readFileSync(p, 'utf8') });
  }
  return out;
}

/** The CSS rules of a component: selector → declarations, in source order. */
function cssRules(src) {
  const rules = [];
  /* A BACKTICK INSIDE THE STYLE BLOCK ENDS IT — escaped or not. A comment that quotes a
     class name (\`variant="lead"\`) is legal TypeScript but ended this match early, and every
     rule after it went unread: the elements it dressed reported values from rules that no
     longer existed. Escapes are consumed here, as the language does. */
  for (const block of src.matchAll(/css`((?:\\[\s\S]|[^\\`])*)`/g)) {
    /* COMMENTS GO FIRST. A comment sitting between two rules is not a selector: without
       stripping them, everything from the end of the previous rule to the next '{' was read
       as the selector — so a rule preceded by a comment (`.shell`, with the note above it)
       never matched anything, and the element it dresses reported "no border declared here"
       while the border was sitting right there in the file. */
    const text = block[1].replace(/\/\*[\s\S]*?\*\//g, '');
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      let depth = 0, end = open;
      for (; end < text.length; end++) {
        if (text[end] === '{') depth++;
        else if (text[end] === '}') { depth--; if (!depth) break; }
      }
      const selector = text.slice(i, open).trim();
      const body = text.slice(open + 1, end);
      const decls = [];
      let d = 0;
      for (const part of body.split(';')) {
        const ci = part.indexOf(':');
        if (ci < 0) continue;
        const prop = part.slice(0, ci).trim().toLowerCase();
        const value = part.slice(ci + 1).trim();
        if (prop && value) decls.push([prop, value]);
      }
      if (selector && decls.length) {
        for (const one of selector.split(',')) rules.push({ selector: one.trim(), decls });
      }
      i = end + 1;
    }
  }
  return rules;
}

/** The class names a selector asks for, ignoring pseudo-classes and attribute selectors:
 *  `.mark[data-placed='true']:hover` → ['mark']. Only the LAST compound is the element
 *  itself; an earlier part means a descendant (`.grip .row`) and never matches a marker. */
function selectorClasses(selector) {
  const last = selector.trim().split(/\s+|>/).filter(Boolean).pop() || '';
  return [...last.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
}

/** The start tag that encloses a marker: scan back to its '<', forward to its '>'. */
function startTagAt(src, start) {
  if (src[start] !== '<') return null;
  let depth = 0, quote = null, end = start;
  for (; end < src.length; end++) {
    const c = src[end];
    /* A COMMENT INSIDE A TAG IS NOT THE TAG'S CONTENT. An apostrophe in one — "the bar's own
       gripper" — opened a quote that never closed and the scan swallowed every attribute
       below it, so two instances' layers were read as one element's. Skipped here, as a
       browser does. */
    if (!quote && c === '/' && src[end + 1] === '*') {
      const close = src.indexOf('*/', end + 2);
      end = close < 0 ? src.length : close + 1;
      continue;
    }
    if (quote) { if (c === quote) quote = null; continue; }
    if (depth === 0 && (c === '"' || c === "'")) { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) break;
  }
  const text = src.slice(start, end + 1);
  const name = (text.match(/^<([A-Za-z][\w-]*)/) || [])[1] || null;
  return { text, name };
}

function tagAt(src, at) {
  // Walking back over a `${…}` attribute needs brace balance: the `}` that closes the
  // attribute BEFORE the marker (`style=${…} data-node-id=…`) is not the end of the
  // element, and treating it as one loses every marker that follows a bound attribute.
  let start = at, brace = 0;
  while (start > 0) {
    const c = src[start];
    if (c === '}') brace++;
    else if (c === '{') { if (!brace) return null; brace--; }
    else if (c === '>' && !brace) return null;
    else if (c === '<') return startTagAt(src, start);
    start--;
  }
  return null;
}

/** Attributes of a tag: static strings and `${…}` expressions, kept apart. */
function attrsOf(tagText) {
  const attrs = [];
  const body = tagText.replace(/^<[A-Za-z][\w-]*/, '').replace(/\/?>$/, '');
  let i = 0;
  while (i < body.length) {
    const m = body.slice(i).match(/^\s*([.?@]?[A-Za-z][\w:.-]*)\s*=\s*/);
    if (!m) { i++; continue; }
    i += m[0].length;
    let value, kind;
    const c = body[i];
    if (c === '"' || c === "'") {
      const close = body.indexOf(c, i + 1);
      value = body.slice(i + 1, close); kind = 'static'; i = close + 1;
    } else if (c === '{' || (c === '$' && body[i + 1] === '{')) {
      // `${…}` unquoted is an expression like `{…}` is: the brace scan must start at the
      // '{' or the value is cut at its first space.
      let j = c === '$' ? i + 1 : i, depth = 0;
      for (; j < body.length; j++) {
        if (body[j] === '{') depth++;
        else if (body[j] === '}') { depth--; if (!depth) break; }
      }
      value = body.slice(i, j + 1); kind = 'expr'; i = j + 1;
    } else {
      const m2 = body.slice(i).match(/^[^\s>]+/);
      value = m2 ? m2[0] : ''; kind = 'static'; i += value.length;
    }
    attrs.push({ name: m[1], value, kind });
  }
  return attrs;
}

/** An id attribute as an EXPRESSION, or null when it is a literal. `"${m.nodeId}"` and
 *  `${m.nodeId}` are the same expression; `?? nothing` is Lit's "no attribute". */
function exprOf(attr) {
  let v = (attr.value || '').trim();
  if (attr.kind === 'static' && !v.includes('${')) return null;
  if ((v.startsWith('${') || v.startsWith('{')) && v.endsWith('}')) {
    v = v.replace(/^\$?\{/, '').slice(0, -1);
  }
  v = v.replace(/\s*\?\?\s*nothing\s*$/, '').trim();
  return v || null;
}

/** Iteration variables of `.map((x) => …)`, so `x.nodeId` inside a template can be
 *  traced back to the array it walks. The LAST declaration before the marker wins. */
function mapParamsBefore(src, at) {
  const out = new Map();
  for (const m of src.matchAll(/(\w+)\.map\(\s*\(?\s*(\w+)\s*(?:,[^)]*)?\)?\s*=>/g)) {
    if (m.index < at) out.set(m[2], m[1]);
  }
  return out;
}

/** The literal CSS a `${…}` class/style expression holds — a ternary's branches, a
 *  template's literals — so `class="row ${on ? 'open' : ''}"` still names its classes. */
function literalsIn(expr) {
  return [...expr.matchAll(/['"`]([^'"`]*)['"`]/g)].map((m) => m[1]);
}

/** The objects of every `const X = [ … ]` table in a file, as { field → value } maps.
 *  This is how one template draws five marks with five different node ids and assets. */
function arrayTables(src) {
  const tables = new Map();
  for (const m of src.matchAll(/(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?=\s*\[/g)) {
    const open = m.index + m[0].length - 1;
    let depth = 0, end = open;
    for (; end < src.length; end++) {
      if (src[end] === '[') depth++;
      else if (src[end] === ']') { depth--; if (!depth) break; }
    }
    const items = [];
    let d = 0, cur = null;
    for (const c of src.slice(open + 1, end)) {
      if (c === '{') { d++; if (d === 1) { cur = ''; continue; } }
      else if (c === '}') { d--; if (!d) { items.push(cur); cur = null; continue; } }
      if (d >= 1 && cur !== null) cur += c;
    }
    if (items.length) tables.set(m[1], items.map(fieldsOf));
  }
  // Object literals are tables too — `const REMOVE = { tileId: '…' }`,
  // `static NODE_OF_ICON: Record<string, string> = { database: '…' }` — and are stored
  // under both their full name and their last segment (`StatusBarPromptInput.NODE_OF_ICON`).
  for (const m of src.matchAll(/(?:const|let|var|readonly|static)\s+([\w.]+)\s*(?::\s*[^=]+)?=\s*\{/g)) {
    if (/=>|\(/.test(m[0])) continue;
    const open = m.index + m[0].length - 1;
    let depth = 0, end = open;
    for (; end < src.length; end++) {
      if (src[end] === '{') depth++;
      else if (src[end] === '}') { depth--; if (!depth) break; }
    }
    const fields = fieldsOf(src.slice(open + 1, end));
    if (!fields.size) continue;
    const key = m[1].split('.').pop();
    if (!tables.has(key)) tables.set(key, [fields]);
  }
  return tables;
}

/** Top-level `name: value` pairs of an object literal, values kept as source text. */
function fieldsOf(text) {
  const out = new Map();
  let i = 0, depth = 0, quote = null;
  while (i < text.length) {
    const c = text[i];
    if (quote) { if (c === quote) quote = null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue; }
    if ('{[('.includes(c)) { depth++; i++; continue; }
    if ('}])'.includes(c)) { depth--; i++; continue; }
    if (!depth) {
      const m = text.slice(i).match(/^([A-Za-z_$][\w$]*)\s*:\s*/);
      if (m) {
        const from = i + m[0].length;
        let j = from, d2 = 0, q = null;
        for (; j < text.length; j++) {
          const ch = text[j];
          if (q) { if (ch === q) q = null; continue; }
          if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
          if ('{[('.includes(ch)) d2++;
          else if ('}])'.includes(ch)) d2--;
          else if (ch === ',' && !d2) break;
        }
        out.set(m[1], text.slice(from, j).trim());
        i = j;
        continue;
      }
    }
    i++;
  }
  return out;
}

/** A table field's value as a literal string, when it is one. */
const literalOf = (v) => {
  if (v === undefined) return null;
  const m = v.match(/^['"]([^'"]+)['"]$/);
  return m ? m[1] : null;
};

// ── the marker table ────────────────────────────────────────────────────
// One entry per layer the code claims to draw: { id, file, classes, inline, asset, rules }
const markers = [];
const unresolvable = [];

for (const s of sources) {
  const imports = importsOf(s.src);
  const rules = cssRules(s.src);
  const tables = arrayTables(s.src);
  const ownTag = (s.src.match(/customElements\.define\(\s*['"]([^'"]+)['"]/) || [])[1];

  for (const m of s.src.matchAll(/data-node-id=/g)) {
    const tag = tagAt(s.src, m.index);
    if (!tag) continue;
    const attrs = attrsOf(tag.text);
    const idAttr = attrs.find((a) => a.name === 'data-node-id');
    if (!idAttr) continue;
    const classAttr = attrs.find((a) => a.name === 'class');
    const styleAttr = attrs.find((a) => a.name === 'style');
    const srcAttr = attrs.find((a) => a.name === 'src');

    const classes = [];
    /* A CLASS THAT HANGS ON THE INSTANCE'S OWN ATTRIBUTE (`class="status ${this.barVariant
       === 'tall' ? 'tall' : ''}"`) belongs to the instance whose attribute matches — not to
       every instance of the component. Read here as pairs, applied per caller below. */
    const conditional = [];
    if (classAttr) {
      /* ONLY THE TEXT OUTSIDE `${…}` IS STATIC. Splitting the whole attribute turned the
         expression's own tokens (`===`, `?`, `'tall'`) into class names, and a component's
         conditional class then read as if every instance carried it. */
      const staticClasses = classAttr.kind === 'static'
        ? classAttr.value.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)
        : [];
      for (const lit of literalsIn(classAttr.value)) {
        for (const cls of lit.split(/\s+/)) if (cls) staticClasses.push(cls);
      }
      // `this.X === 'v' ? 'cls' : ''` and the truthy `this.X ? 'cls' : ''` are both read —
      // the second is a boolean the caller passes as an attribute, and it belongs to that
      // caller alone (a `dm` class on every instance is how a readout got DM Sans).
      const pairs = [
        ...[...classAttr.value.matchAll(/this\.(\w+)\s*===\s*'([^']+)'\s*\?\s*'([^']+)'/g)].map((m2) => ({ prop: m2[1], value: m2[2], cls: m2[3] })),
        ...[...classAttr.value.matchAll(/this\.(\w+)\s*\?\s*'([^']+)'\s*:\s*''/g)].map((m2) => ({ prop: m2[1], value: null, cls: m2[2] })),
      ];
      for (const c of pairs) {
        conditional.push(c);
        // the class name appears TWICE in a ternary (`this.x === 'tall' ? 'tall' : ''`) — the
        // test value and the result — so every occurrence must go, not just the first
        for (let at = staticClasses.indexOf(c.cls); at >= 0; at = staticClasses.indexOf(c.cls)) staticClasses.splice(at, 1);
      }
      classes.push(...staticClasses.filter(Boolean));
    }
    // inline style literals: `style=${`width: 22px; height: 22px`}` — the fallbacks count
    const inline = [];
    if (styleAttr) {
      for (const lit of literalsIn(styleAttr.value)) {
        for (const d of lit.split(';')) {
          const ci = d.indexOf(':');
          if (ci <= 0) continue;
          const prop = d.slice(0, ci).trim().toLowerCase();
          let value = d.slice(ci + 1).trim();
          /* `${this.iconSize || 22}px` IS 22 UNTIL A CALLER SAYS OTHERWISE — the element's
             own fallback is the value it draws with, and a caller that passes its own size
             is resolved separately, per instance. Written down as the number, so the
             drawing's size can be held against it; the raw expression stays in the note. */
          const fb = value.match(/\|\|\s*(\d+(?:\.\d+)?)\s*\}?\s*(px)?\s*$/);
          if (fb && value.includes('${')) value = `${fb[1]}px`;
          if (prop && value) inline.push([prop, value]);
        }
      }
    }

    const srcExpr = srcAttr ? exprOf(srcAttr) : null;
    const srcKey = srcExpr ? (srcExpr.match(/^(\w+)\.(\w+)$/) || [])[2] : null;
    const staticAsset = srcAttr && srcAttr.kind === 'static' && !srcAttr.value.includes('${') ? srcAttr.value : null;
    const emit = (id, assetName) => {
      if (!id) return;
      markers.push({ id, file: s.rel, tag: tag.name, classes, ancestors: ancestorsAt(s.src, m.index), inline, asset: assetName ? imports.get(assetName) || null : null, rules });
    };

    const idExpr = exprOf(idAttr);
    if (!idExpr) {
      emit(idAttr.value, staticAsset || (srcAttr ? (srcAttr.value.match(/(\w+)/) || [])[1] : null));
      continue;
    }
    // `data-node-id=${StatusBarPromptInput.NODE_OF_ICON[kind]}` — the element draws one of
    // several ids. Every id the map can yield is a candidate marker: the layer is drawn
    // whichever branch runs, so each one must exist and carry the element's values.
    const indexed = idExpr.match(/^([\w.]+)\[(\w+)\]$/);
    if (indexed) {
      const row = tables.get(indexed[1].split('.').pop());
      const ids = row ? [...row[0].values()].map(literalOf).filter(Boolean) : [];
      if (ids.length) { for (const id of ids) emit(id, staticAsset); continue; }
      unresolvable.push({ file: s.rel, expr: idExpr });
      continue;
    }
    // `data-node-id=${m.nodeId}` — walk the table the template walks, through the
    // iteration variable of the `.map()` it stands in.
    const prop = idExpr.match(/^(\w+)\.(\w+)$/);
    const maps = prop ? mapParamsBefore(s.src, m.index) : new Map();
    const tableVar = prop ? (tables.has(prop[1]) ? prop[1] : maps.get(prop[1]) ?? null) : null;
    const table = tableVar ? tables.get(tableVar) : null;
    if (table) {
      for (const item of table) {
        // The asset is the field the item names for it (`src`, `iconSrc`, …): a field
        // whose value is one of this file's imports.
        let assetName = srcKey ? item.get(srcKey) : null;
        if (!assetName) assetName = [...item.entries()].find(([k, v]) => /src|icon/i.test(k) && imports.has(v))?.[1];
        emit(literalOf(item.get(prop[2])), assetName);
      }
      continue;
    }
    /* `data-node-id=${id}` inside a `.map()` over a property the CALLER filled —
       `(this.gripDots || '').split(',').map((id) => …)`. Each value in the caller's
       attribute is one layer, named by the id itself; when another handed-in attribute
       names the accented one (`grip-accent`), that layer takes the accent class its CSS
       declares. */
    if (/^\w+$/.test(idExpr)) {
      let propSplit = null;
      for (const mm of s.src.slice(0, m.index).matchAll(/this\.(\w+)[\s\S]{0,120}?\.split\(/g)) propSplit = mm;
      if (propSplit) {
        const listAttr = propSplit[1].replace(/[A-Z]/g, (ch) => '-' + ch.toLowerCase());
        const accentAttr = listAttr.replace(/dots$/, 'accent');
        let named = 0;
        for (const host of sources) {
          for (const hm of host.src.matchAll(new RegExp(`<${ownTag}\\b`, 'g'))) {
            const hostTag = startTagAt(host.src, hm.index);
            if (!hostTag) continue;
            const hAttrs = attrsOf(hostTag.text);
            const listA = hAttrs.find((a) => a.name === listAttr);
            if (!listA || !listA.value) continue;
            const accentA = hAttrs.find((a) => a.name === accentAttr);
            for (const one of listA.value.split(',').map((v) => v.trim()).filter(Boolean)) {
              markers.push({
                id: one, file: host.rel, tag: tag.name,
                classes: accentA && accentA.value === one ? [...classes, 'accent'] : classes,
                ancestors: ancestorsAt(s.src, m.index),
                inline, asset: null, rules, via: `${s.rel} ← ${host.rel}`,
              });
              named++;
            }
          }
        }
        if (named) continue;
      }
    }
    // `data-node-id=${this.iconNode || ''}` — the caller hands the id and the artwork in.
    // The usages to search for are the ones of THIS component (its own registered tag),
    // not of the element the marker sits on.
    const propName = idExpr.match(/^this\.(\w+)/)?.[1];
    if (propName && ownTag) {
      const attrName = propName.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
      let found = 0;
      for (const host of sources) {
        for (const hm of host.src.matchAll(new RegExp(`<${ownTag}\\b`, 'g'))) {
          // The host tag is found with the same brace-aware scan the markers use: a
          // non-greedy /<tag[^>]*>/ stops at the first '>', which sits inside the first
          // arrow function in a bound attribute (`status-text=${(() => {…})()}`).
          const hostTag = startTagAt(host.src, hm.index);
          if (!hostTag) continue;
          const hAttrs = attrsOf(hostTag.text);
          const idA = hAttrs.find((a) => a.name === attrName);
          const staticId = idA && idA.kind === 'static' && !idA.value.includes('${') ? idA.value : null;
          if (!staticId) continue;
          const iconA = hAttrs.find((a) => a.name === 'icon');
          const iconName = iconA ? (iconA.value.match(/(\w+)/) || [])[1] : null;
          const hostImports = importsOf(host.src);
          /* THE SIZE THE CALLER PASSES IS THE SIZE THE LAYER IS DRAWN AT. The element's
             own inline style carries a fallback (`${this.iconSize || 22}px`) — a default,
             not the drawn value — so the caller's literal is what the drawing's node is
             compared against, per instance. */
          const classesHere = [...classes];
          for (const c of conditional) {
            const attrName = c.prop.replace(/[A-Z]/g, (ch) => '-' + ch.toLowerCase());
            const a = hAttrs.find((x) => x.name === attrName || x.name === `?${attrName}`);
            if (!a) continue;
            // the truthy form: the caller passes the attribute at all (Lit's `?name`)
            if (c.value === null ? true : (a.kind === 'static' && a.value === c.value)) classesHere.push(c.cls);
          }
          const sizeA = hAttrs.find((a) => a.name === 'icon-size');
          const callerInline = [...inline];
          /* ONLY THE ELEMENT THAT DRAWS THE ICON takes the icon's size and its artwork. The
             caller hands both to the COMPONENT; every other element in it (the grip, the
             row, the dots) draws something else and must not be compared against them. */
          const drawsTheIcon = !!(srcAttr || hAttrs.some((a) => a.name === 'src'));
          if (drawsTheIcon && sizeA && /^\d+(\.\d+)?$/.test(sizeA.value)) {
            callerInline.push(['width', `${sizeA.value}px`], ['height', `${sizeA.value}px`]);
          }
          markers.push({ id: staticId, file: host.rel, tag: tag.name, classes: classesHere, ancestors: ancestorsAt(s.src, m.index), inline: callerInline, asset: drawsTheIcon && iconName ? hostImports.get(iconName) || null : null, rules, via: `${s.rel} ← ${host.rel}` });
          found++;
        }
      }
      if (!found) unresolvable.push({ file: s.rel, expr: idExpr });
      continue;
    }
    unresolvable.push({ file: s.rel, expr: idExpr });
  }
}


/** The class lists of the elements ENCLOSING a position in a template, innermost first.
 *  Typography is INHERITED: a span that says nothing about its line height takes the one its
 *  parent declares — which is how the readout line was reading "not declared" while its
 *  parent's 22px (wrong, per the file) drew every turn. */
function ancestorsAt(src, at) {
  const out = [];
  let i = at;
  while (i > 0 && out.length < 6) {
    let j = i, brace = 0;
    while (j > 0) {
      const c = src[j];
      if (c === '}') brace++;
      else if (c === '{') { if (!brace) break; brace--; }
      else if (c === '>' && !brace) break;
      else if (c === '<' && !brace) break;
      j--;
    }
    if (src[j] === '>') {
      /* A `>` IS THE CLOSE OF AN OPENING TAG, NOT THE END OF THE WALK. This is the step that
         makes the walk go OUTWARD. The first `>` above a marker is the close of its PARENT's
         opening tag, so breaking on it read the marker's own element and stopped — `.readout`
         was as far out as the walk ever got, and the `.status` rule that declares the readout's
         typography was never reached, so five values per text layer read "not declared here".
         Jump to the `<` that opens that tag and read THAT one. */
      let k = j;
      while (k > 0 && src[k] !== '<') k--;
      if (src[k] !== '<') break;
      j = k;
    }
    if (src[j] !== '<') break;
    const tag = startTagAt(src, j);
    if (!tag) break;
    const attrs = attrsOf(tag.text);
    const cls = attrs.find((a) => a.name === 'class');
    if (cls) {
      const list = cls.kind === 'static'
        ? cls.value.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)
        : literalsIn(cls.value).flatMap((l) => l.split(/\s+/));
      const clean = list.filter(Boolean);
      if (clean.length) out.push(clean);
    }
    /* STEP PAST THE TAG, DO NOT RE-READ IT. `j` is the `<` just read and the next pass walks
       back from `i` to a `<`, so leaving `i` at `j` re-finds the same tag forever — an infinite
       spin at 100% CPU on the first tag with no class attribute (`chat-action-bar.ts:378`, an
       `<img>` carrying only a marker), which is why the audit's blocking check once never
       reached a verdict. `j - 1` ends the spin AND keeps the walk moving outward. Both
       properties are required; each earlier version had only one. */
    i = j - 1;
  }
  return out;
}

/** The declarations that apply to an element, in cascade order: the rules whose class part
 *  matches, then the element's own inline style (which wins, as it does in a browser).
 *  For a marker that sits on a CUSTOM ELEMENT, the declarations that place it are that
 *  component's `:host` rule — a different file from the one the marker is written in — so
 *  the host's own styles are resolved from the component that defines the tag. */
function computed(marker) {
  const decls = new Map();
  const host = hostRules.get(marker.tag);
  if (host && !marker.classes.length) {
    for (const rule of host.rules) {
      const sel = rule.selector.trim();
      if (!sel.startsWith(':host')) continue;
      for (const [p, v] of rule.decls) decls.set(p, v);
    }
  }
  for (const rule of marker.rules) {
    const want = selectorClasses(rule.selector);
    if (!want.length) continue;
    if (!want.every((c) => marker.classes.includes(c))) continue;
    for (const [p, v] of rule.decls) decls.set(p, v);
  }
  for (const [p, v] of marker.inline) decls.set(p, v);
  /* INHERITED VALUES COME FROM AN ANCESTOR. Typography is not repeated on every element, and
     a value the element does not state is not a value it does not have — it is the parent's.
     Read innermost-first, and last from the component's own :host rule. */
  const INHERITED = new Set(['font-family', 'font-size', 'font-weight', 'line-height', 'color', 'text-align', 'letter-spacing']);
  const fromAncestors = (prop) => {
    for (const classes of marker.ancestors || []) {
      let found = null;
      for (const rule of marker.rules) {
        const want = selectorClasses(rule.selector);
        if (!want.length || !want.every((c) => classes.includes(c))) continue;
        for (const [p, v] of rule.decls) if (p === prop) found = v;
      }
      if (found) return found;
    }
    if (host) {
      const sel = ':host';
      for (const rule of host.rules) {
        if (!rule.selector.trim().startsWith(sel)) continue;
        for (const [p, v] of rule.decls) if (p === prop) return v;
      }
    }
    return null;
  };
  for (const prop of INHERITED) if (!decls.has(prop)) { const v = fromAncestors(prop); if (v) decls.set(prop, v); }
  return decls;
}

function decl(decls, ...props) {
  for (const p of props) if (decls.has(p)) return decls.get(p);
  return null;
}

/** The padding a declaration set resolves to, in the order the drawing reports it. */
function padOf(decls, rtl = true) {
  /* THE SHORTHAND, THEN THE LONGHANDS THAT FOLLOW IT — in CSS the later, more specific
     declaration wins, so a `padding-top: var(…)` after `padding: 6px 20px 0` is the top
     padding, and reading the shorthand alone reported 6 where the element draws 20. */
  const shorthand = decl(decls, 'padding');
  let base = null;
  if (shorthand) {
    if (shorthand.includes('var(')) return null;   // resolved by the composition: named, not guessed
    const parts = shorthand.split(/\s+/).map((v) => num(v));
    if (!parts.length || parts.some((p) => p === null)) return null;
    /* 1 value: all four. 2: vertical, horizontal. 3: top, horizontal, bottom. 4: t, r, b, l.
       The first version folded a 3-value shorthand's BOTTOM onto its top, which reported a
       padding that is not what the element draws. */
    const p0 = parts[0];
    base = {
      paddingTop: p0,
      paddingRight: parts[1] ?? p0,
      paddingBottom: parts[2] ?? p0,
      paddingLeft: parts[3] ?? parts[1] ?? p0,
    };
  }
  const sides = { paddingTop: 'padding-top', paddingRight: 'padding-right', paddingBottom: 'padding-bottom', paddingLeft: 'padding-left' };
  const out = base || {};
  for (const [key, prop] of Object.entries(sides)) {
    const raw = decl(decls, prop);
    if (raw === null) { if (base) continue; }
    else {
      if (raw.includes('var(')) return null;      // one side is the composition's: named, not guessed
      const v = num(raw);
      if (v === null) return null;
      out[key] = v;
      continue;
    }
    if (!base) return null;
  }
  if (!base) return null;
  return out;
}

/** The fill inside an asset: every colour the SVG paints with, stroke included — an icon
 *  drawn with strokes is still drawn in a colour the file specifies. */
function assetColors(asset) {
  if (!asset) return null;
  const out = new Set();
  /* COLOUR AND ITS OPACITY BELONG TOGETHER: `fill="#933A45" fill-opacity="0.84"` IS the file's
     rgba(147,58,69,0.84). Reading the hex alone reported a 100% red against an 84% fill and
     called a correct asset wrong. Element by element, so each shape's opacity composes with
     its own paint. */
  for (const el of asset.text.matchAll(/<(?:path|rect|circle|ellipse|polygon|polyline|line)\b[^>]*>/g)) {
    const tag = el[0];
    const fill = /fill\s*=\s*"([^"]+)"/.exec(tag)?.[1];
    const stroke = /stroke\s*=\s*"([^"]+)"/.exec(tag)?.[1];
    const fo = Number(/fill-opacity\s*=\s*"([^"]+)"/.exec(tag)?.[1] ?? 1);
    const so = Number(/stroke-opacity\s*=\s*"([^"]+)"/.exec(tag)?.[1] ?? 1);
    for (const [paint, op] of [[fill, fo], [stroke, so]]) {
      if (!paint || paint === 'none') continue;
      const c = color(paint);
      if (!c) continue;
      const m = c.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
      out.add(m ? rgba(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]) * op) : c);
    }
  }
  for (const m of asset.text.matchAll(/(?:stop-color)\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)"']+\))/g)) {
    const c = color(m[1]);
    if (c) out.add(c);
  }
  return out;
}

// ── the read must be able to SEE the artwork ────────────────────────────
/* FIGMA'S MCP DOES NOT RETURN A VECTOR'S COLOUR — measured 2026-09-20: get_design_context
 * on the conversations mark (40001123:6745) answers with a React/Tailwind snippet and an
 * <img src="…/assets/….svg">, and not one `#hex` or `rgba()` anywhere in it; the same node
 * read from REST returns three VECTOR children each carrying `fill rgba(80,114,116,1)`.
 * That is why this check reads REST and not the MCP.
 *
 * So the read is ASSERTED, not assumed: a vector layer that comes back with no fill AND no
 * stroke means the drawing's colour was not delivered — the instrument is blind on that
 * layer, and a blind instrument must say so instead of comparing nothing and passing. */
const vectorish = nodes.filter((n) => n.type === 'VECTOR' || n.type === 'ELLIPSE' || n.type === 'BOOLEAN_OPERATION');
const readBlind = vectorish.filter((n) => !n.fill && !n.stroke);
const painted = vectorish.filter((n) => n.fill || n.stroke).length;

// ── the comparison ──────────────────────────────────────────────────────
const fails = [];
const notCompared = [];
let compared = 0;
const add = (node, field, fileVal, codeVal, note) => fails.push({ id: node.id, name: node.name, type: node.type, field, fileVal, codeVal, note: note || '' });
const skip = (node, field, why) => notCompared.push({ id: node.id, name: node.name, field, why });

const markerById = new Map(markers.map((m) => [m.id, m]));

for (const node of nodes) {
  const own = markerById.get(node.id);
  // A vector/ellipse is compared THROUGH the element that draws it: its colour must be
  // one of the colours inside that element's asset.
  const host = own || [...ancestry(node)].map((a) => markerById.get(a.id)).find(Boolean) || null;
  if (!host) continue;

  if (own) {
    const decls = computed(own);
    const isRoot = node.depth === 0;
    const box = (n) => n.sizingH === 'HUG' && n.sizingV === 'HUG';

    /* A TEXT LAYER'S FILL IS ITS TEXT COLOUR, not a background: comparing it here as well
       would read `background: none` as a wrong colour and report a mismatch that the
       typography block below already answers correctly against `color`. */
    if (node.fill && !node.text) {
      const code = decl(decls, 'background', 'background-color');
      if (code === null) skip(node, 'fill', 'no background declared here');
      /* A value that is not a colour at all (`none`, a gradient, a var()) is not a
         background the drawing's fill can be held against — named, not failed. */
      else if (color(code) === null) skip(node, 'fill', `declared as "${code}" — not a colour`);
      else if (color(code) !== color(node.fill)) add(node, 'fill', node.fill, code);
      else compared++;
    }
    if (node.stroke) {
      const border = decl(decls, 'border-color', 'border-top-color', 'border');
      if (border === null) skip(node, 'stroke', 'no border declared here');
      else {
        const code = border.includes('solid') || border.includes('dashed') ? border.split(/\s+(?=[a-z])/).find((p) => color(p)) || '' : border;
        if (color(code) !== color(node.stroke)) add(node, 'stroke', node.stroke, border);
        else compared++;
      }
    }
    if (node.strokeW) {
      const border = decl(decls, 'border', 'border-width');
      const w = border === null ? null : (border.match(/(\d+(?:\.\d+)?)px/) || [])[1];
      if (w === null) skip(node, 'strokeWeight', 'no border width declared here');
      else if (!sameNum(w, node.strokeW)) add(node, 'strokeWeight', node.strokeW, w);
      else compared++;
    }
    if (node.strokeAlign === 'INSIDE' && decl(decls, 'border')) {
      const bs = decl(decls, 'box-sizing');
      const note = 'the drawing puts the edge inside the height; without border-box it is added outside';
      if (bs !== 'border-box') add(node, 'strokeAlign', 'INSIDE', bs || '(no box-sizing)', note);
      else compared++;
    }
    if (node.radius) {
      const code = decl(decls, 'border-radius');
      if (code === null) skip(node, 'cornerRadius', 'no radius declared here');
      else if (!sameNum(code, node.radius)) add(node, 'cornerRadius', node.radius, code);
      else compared++;
    }
    if (node.gap !== undefined) {
      const code = decl(decls, 'gap', 'row-gap', 'column-gap');
      if (code === null) skip(node, 'itemSpacing', 'no gap declared here');
      else if (!sameNum(code, node.gap)) add(node, 'itemSpacing', node.gap, code);
      else compared++;
    }
    if (node.pad) {
      const code = padOf(decls);
      const varTop = decl(decls, 'padding-top');
      if (!code) skip(node, 'padding', varTop && varTop.includes('var(')
        ? `comes from a custom property the composition sets (${varTop}) — the value is not in this element's own rule`
        : 'no padding declared here');
      else {
        for (const side of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
          if (!sameNum(code[side], node.pad[side])) add(node, side, node.pad[side], code[side]);
          else compared++;
        }
      }
    }
    /* THE DRAWN SIZE — compared where the drawing FIXES the axis and the code declares a
       pixel size for it. A HUG/FILL axis is placed by its content or its parent (the
       application is the viewport, not the 1280 frame — the owner's ruling), so it is
       reported as not compared rather than failed against a coordinate it never had. */
    for (const [key, prop] of [['w', 'width'], ['h', 'height']]) {
      if (node[key] === undefined) continue;
      const sizing = key === 'w' ? node.sizingH : node.sizingV;
      const code = decl(decls, prop);
      if (code === null) { skip(node, prop, 'no size declared here (placed by its container)'); continue; }
      const codePx = num(/^\d*\.?\d+(px)?$/.test(code.trim()) ? code.trim() : null);
      if (codePx === null) { skip(node, prop, `declared as "${code}" — not a pixel size`); continue; }
      if (sizing && sizing !== 'FIXED') { skip(node, prop, `the drawing sizes this axis ${sizing}`); continue; }
      if (!sameNum(codePx, node[key])) add(node, prop, node[key], code);
      else compared++;
    }
    if (node.layout) {
      const dir = decl(decls, 'flex-direction');
      const display = decl(decls, 'display');
      const want = node.layout === 'VERTICAL' ? 'column' : 'row';
      if (display === null) skip(node, 'layoutMode', 'not laid out in code (block/default flow)');
      else if (dir === null && want === 'row') compared++;
      else if (dir === null) skip(node, 'layoutMode', 'no flex-direction declared here');
      else if (dir !== want) add(node, 'layoutMode', node.layout, `${display} ${dir}`);
      else compared++;
    }
    if (node.primaryAlign) {
      const code = decl(decls, 'justify-content');
      const want = node.primaryAlign === 'CENTER' ? 'center' : node.primaryAlign === 'MAX' ? 'flex-end' : 'flex-start';
      if (code === null) skip(node, 'primaryAxisAlignItems', 'no justify-content declared here');
      else if (code.trim() !== want) add(node, 'primaryAxisAlignItems', node.primaryAlign, code);
      else compared++;
    }
    if (node.counterAlign) {
      const code = decl(decls, 'align-items');
      const want = node.counterAlign === 'CENTER' ? 'center' : node.counterAlign === 'MAX' ? 'flex-end' : 'flex-start';
      if (code === null) skip(node, 'counterAxisAlignItems', 'no align-items declared here');
      else if (code.trim() !== want) add(node, 'counterAxisAlignItems', node.counterAlign, code);
      else compared++;
    }
    if (node.opacity !== undefined) {
      const code = decl(decls, 'opacity');
      if (code === null) skip(node, 'opacity', 'no opacity declared here');
      else if (!sameNum(code, node.opacity)) add(node, 'opacity', node.opacity, code);
      else compared++;
    }
    if (node.text) {
      const checks = [
        ['fontFamily', decl(decls, 'font-family'), node.text.family, (a, b) => String(a).split(',')[0].replace(/['"]/g, '').trim() === String(b).trim()],
        ['fontWeight', decl(decls, 'font-weight'), node.text.weight, (a, b) => sameNum(a, b)],
        ['fontSize', decl(decls, 'font-size'), node.text.size, (a, b) => sameNum(a, b)],
        ['lineHeight', decl(decls, 'line-height'), node.text.lh, (a, b) => sameNum(a, b) || (String(b).toLowerCase() === 'normal' && String(a).trim().toLowerCase() === 'normal')],
        ['color', decl(decls, 'color'), node.fill, (a, b) => color(a) === color(b)],
      ];
      for (const [field, code, rawWant, eq] of checks) {
        const want = field === 'lineHeight' && String(rawWant).toUpperCase() === 'AUTO' ? 'normal' : rawWant;
        if (!want) continue;
        if (typeof want === 'string' && want.endsWith('%')) { skip(node, field, 'the drawing states a percentage'); continue; }
        if (code === null) skip(node, field, 'not declared here');
        else if (!eq(code, want)) add(node, field, want, code);
        else compared++;
      }
      const align = decl(decls, 'text-align');
      if (node.text.align === 'CENTER' && align !== null) {
        if (align.trim() !== 'center') add(node, 'textAlignHorizontal', node.text.align, align);
        else compared++;
      }
    }
    /* A frame that draws artwork through an asset — an icon element. Its own fill, if any,
       must also be a colour of that artwork; the vectors under it are compared below. */
  }

  /* THE VECTORS — the layer the old check never looked at. Every vector at or under a
     paired element must be drawn in a colour the asset actually holds. */
  const isVector = node.type === 'VECTOR' || node.type === 'ELLIPSE' || node.type === 'BOOLEAN_OPERATION';
  const hasAssetHost = host.asset || [...ancestry(node)].some((a) => markerById.get(a.id)?.asset);
  if (isVector && hasAssetHost) {
    const drawingHost = own?.asset ? own : host.asset ? host : [...ancestry(node)].map((a) => markerById.get(a.id)).find((mk) => mk && mk.asset);
    const asset = drawingHost?.asset;
    const colors = assetColors(asset);
    if (!colors) skip(node, 'fill', 'the asset could not be read');
    else if (node.fill) {
      if (!colors.has(color(node.fill))) {
        add(node, 'fill', node.fill,
          [...colors].join(' / '),
          `drawn by ${asset.rel}${drawingHost.via ? ` (via ${drawingHost.via})` : ''} — the drawing's colour is not in that asset`);
      } else compared++;
    }
  }

  // A stroke on a vector must likewise be in the asset.
  if (isVector && host.asset && node.stroke) {
    const colors = assetColors(host.asset);
    if (colors && !colors.has(color(node.stroke))) add(node, 'stroke', node.stroke, [...colors].join(' / '), `drawn by ${host.asset.rel}`);
    else if (colors) compared++;
  }
}

// ── blind spots: layers nothing in the code claims ──────────────────────
/* A marker claims ITS OWN layer. The vectors under it are claimed only when the element
   draws them through an asset — that is the case where their colours were actually
   compared. Anything else stays on this list: the check never counts a layer it did not
   read as one it read. */
const claimed = new Set();
/* CARRIED BY EXPORT — its own status, not ABSENT. A mark is drawn as ONE asset: the file's
   frames and vectors inside it (40001124:7442 model-icon, 40001124:7097 the vector) have no
   element of their own because their geometry and paint are baked into the SVG the element
   imports. Calling those ABSENT would manufacture a diff no one can ever resolve; calling them
   EQUAL would claim a comparison that never happened. They are CARRIED: their values travel
   inside the asset, and the asset itself is compared to the frame it draws. */
const carried = new Set();
/* A MARKER WHOSE LAYER IS GONE IS A FINDING, NOT A NO-OP. This loop used to `continue` past
   any marker whose id the drawing does not have — silently. So when the designer deletes an
   element and Figma re-creates it under a NEW id, the code keeps pointing at the dead one and
   nothing anywhere says so: the new layer reads as unclaimed (a blind spot) while the element
   built for it reads as absent, and the two are never put next to each other. That is the
   silent hole the operating rules warn about — a dangling reference renders NOTHING and
   reports NOTHING. Collected here and reported loud. */
const gone = [];
/* A MARKER IS ONLY "GONE" IF THE DRAWING HAS IT NOWHERE. One scope's capture holds ONE
   column, and a component's markers can belong to another column's drawing — holding them
   against this capture alone reported 13 live layers as dead on the first run. The record of
   every drawing this repo has read is the design directory itself. */
const knownIds = new Set();
for (const f of readdirSync(DESIGN_DIR)) {
  if (!f.endsWith('.json')) continue;
  try { for (const id of readFileSync(join(DESIGN_DIR, f), 'utf8').match(/\d+:\d+/g) || []) knownIds.add(id); } catch { /* unreadable is not a claim */ }
}
for (const m of markers) {
  if (!byId.has(m.id)) { if (!knownIds.has(m.id)) gone.push(m); continue; }
  claimed.add(m.id);
  if (!m.asset) continue;
  const stack = [m.id];
  while (stack.length) {
    const n = byId.get(stack.pop());
    if (!n) continue;
    for (const c of n.children || []) { claimed.add(c); carried.add(c); stack.push(c); }
  }
}
const blind = nodes.filter((n) => !claimed.has(n.id));

// ── report ──────────────────────────────────────────────────────────────

/* THE CHANGE RECORD — what moved in the file since the code last matched it, and which
 * source moved with it. The seal is written by this script when a run passes; the next
 * run diffs the drawing against it, so a value the designer changed is NAMED as a change
 * rather than discovered as a failure with no history. */
const SEAL_PATH = join(DESIGN_DIR, `${CAPTURE}-verified.json`);
let seal = null;
try { seal = JSON.parse(readFileSync(SEAL_PATH, 'utf8')); } catch { seal = null; }

const moved = [];
const current = {};
for (const node of nodes) {
  const own = markerById.get(node.id);
  if (!own) continue;
  const decls = computed(own);
  for (const [field, get] of [
    ['fill', () => decl(decls, 'background', 'background-color')],
    ['stroke', () => decl(decls, 'border', 'border-color', 'border-top-color')],
    ['strokeWeight', () => decl(decls, 'border-width', 'border')],
    ['cornerRadius', () => decl(decls, 'border-radius')],
    ['itemSpacing', () => decl(decls, 'gap', 'row-gap', 'column-gap')],
    ['padding', () => JSON.stringify(padOf(decls) || null)],
    ['layoutMode', () => decl(decls, 'flex-direction')],
    ['width', () => decl(decls, 'width')],
    ['height', () => decl(decls, 'height')],
    ['fontFamily', () => decl(decls, 'font-family')],
    ['fontSize', () => decl(decls, 'font-size')],
    ['lineHeight', () => decl(decls, 'line-height')],
    ['color', () => decl(decls, 'color')],
  ]) {
    const fileValue = field === 'padding'
      ? JSON.stringify(node.pad || null)
      : field === 'fill' ? node.fill
        : field === 'stroke' ? node.stroke
          : field === 'strokeWeight' ? node.strokeW
            : field === 'cornerRadius' ? node.radius
              : field === 'itemSpacing' ? node.gap
                : field === 'layoutMode' ? node.layout
                  : field === 'width' ? node.w
                    : field === 'height' ? node.h
                      : field === 'fontFamily' ? node.text?.family
                        : field === 'fontSize' ? node.text?.size
                          : field === 'lineHeight' ? node.text?.lh
                            : field === 'color' ? node.fill : undefined;
    if (fileValue === undefined || fileValue === null) continue;
    const entry = { file: fileValue, source: own.file.replace('src/components/lit/', '') };
    current[`${node.id}.${field}`] = entry;
    const before = seal?.values?.[`${node.id}.${field}`];
    if (before && JSON.stringify(before.file) !== JSON.stringify(entry.file)) {
      moved.push({ id: node.id, name: node.name, field, from: before.file, to: entry.file, source: entry.source });
    }
  }
}
if (moved.length) {
  console.log(`   THE FILE MOVED — ${moved.length} value(s) changed since the code last matched it:`);
  for (const m of moved) {
    console.log(`      ${m.id}  ${m.name}  [${m.field}]  ${JSON.stringify(m.from)} → ${JSON.stringify(m.to)}   (code: ${m.source})`);
  }
  console.log('');
}

const named = nodes.filter((n) => claimed.has(n.id)).length;
for (const b of readBlind) {
  fails.push({
    id: b.id, name: b.name, type: b.type, field: 'fill',
    fileVal: `${b.type} ${b.w}×${b.h} with no fill and no stroke in the read`,
    codeVal: '(the read delivered no colour at all)',
    note: 'THE READ IS BLIND HERE — a vector whose colour did not arrive cannot be compared, and is not a pass',
  });
}
const summary = {
  capture: CAPTURE,
  nodeId: cap._capture?.nodeId ?? null,
  layers: nodes.length,
  named,
  compared,
  vectors: { read: vectorish.length, painted, blind: readBlind.length },
  discrepancies: fails.map((f) => ({ id: f.id, name: f.name, field: f.field, file: f.fileVal, code: f.codeVal, note: f.note })),
  unclaimed: blind.map((b) => ({ id: b.id, name: b.name, type: b.type })),
  notDeclared: notCompared.map((s) => ({ id: s.id, field: s.field, why: s.why })),
  carriedByExport: [...carried].filter((id) => byId.has(id)).map((id) => ({ id, name: byId.get(id).name, type: byId.get(id).type })),
  unresolved: unresolvable,
  gone: gone.map((m) => ({ id: m.id, file: m.file.replace('src/components/lit/', ''), tag: m.tag })),
  moved,
};
if (args.includes('--json')) {
  console.log(JSON.stringify(summary));
  /* `unverified` is declared below, on the human-readable path — reading it here threw
     `Cannot access 'unverified' before initialization`, so EVERY `--json` run exited 1 with no
     JSON at all. The audit calls the check with `--json`, so its blocking `design-value-drift`
     reported "the comparison did not run" on every scope. Same expression as the declaration. */
  process.exit(fails.length ? 1 : (blind.length + unresolvable.length + gone.length ? 2 : 0));
}

console.log(`design-value-check — capture ${CAPTURE} (${cap._capture?.nodeId} ${cap._capture?.name})`);
console.log(`   ${nodes.length} layers in the file · ${named} drawn and compared by id · ${compared} value(s) equal`);
console.log(`   ${carried.size} layer(s) CARRIED BY EXPORT (inside an asset the element draws: their values travel in the SVG, and the asset is compared to the frame it draws)`);
console.log(`   ${vectorish.length} vector layer(s) in the drawing, ${painted} carrying a colour the read delivered${readBlind.length ? `, ${readBlind.length} BLIND` : ' — the read is complete'}`);
console.log('');

if (SHOW_MARKERS) {
  console.log(`   MARKERS — what the code says it draws:`);
  for (const m of markers.sort((a, b) => a.id.localeCompare(b.id))) {
    console.log(`      ${m.id.padEnd(20)} ${m.file.replace('src/components/lit/', '')}  .${m.classes.join('.') || '(no class)'}${m.asset ? `  asset ${basename(m.asset.rel)}` : ''}${m.via ? `  via ${m.via}` : ''}`);
  }
  console.log('');
}

if (blind.length) {
  console.log(`   NOT COMPARED — ${blind.length} layer(s) with no marker in the code (a blind spot, not a pass):`);
  for (const b of blind.slice(0, LIST_LIMIT)) console.log(`      ${b.id.padEnd(20)} ${(b.name || '').slice(0, 40).padEnd(42)} ${b.type} ${b.w}×${b.h}`);
  if (blind.length > LIST_LIMIT) console.log(`      … and ${blind.length - LIST_LIMIT} more (raise --limit to see them all)`);
  console.log('');
}

if (unresolvable.length) {
  console.log(`   NOT RESOLVED — ${unresolvable.length} marker(s) the reader could not resolve to an id:`);
  for (const u of unresolvable) console.log(`      ${u.file}  ${u.expr}`);
  console.log('');
}

if (gone.length) {
  console.log(`   POINTING AT A LAYER THE DRAWING NO LONGER HAS — ${gone.length} marker(s):`);
  for (const g of gone) console.log(`      ${g.id.padEnd(20)} ${g.file.replace('src/components/lit/', '')}  <${g.tag}>`);
  console.log(`      The layer these elements were built for is not in the file any more. Either the`);
  console.log(`      drawing deleted it (remove the element and its marker) or Figma re-created it`);
  console.log(`      under a NEW id (re-point the marker at the layer the file draws today). A`);
  console.log(`      dangling reference renders nothing and reports nothing until it is said here.`);
  console.log('');
}

if (fails.length) {
  console.log(`   ${fails.length} DISCREPANCY(IES) — what the file holds, and what the code holds:`);
  console.log('');
  for (const f of fails) {
    console.log(`  FAILED  ${f.id}  ${f.name}  [${f.field}]`);
    console.log(`          file: ${f.fileVal}`);
    console.log(`          code: ${f.codeVal || '(nothing)'}${f.note ? '   — ' + f.note : ''}`);
  }
  console.log('');
}

const skipped = notCompared.filter((s) => s.field !== 'fill' || true);
console.log(`── VERDICT ─────────────────────────────────────────────────────────`);
console.log(`   ${nodes.length} layers read · ${compared} values compared and equal · ${fails.length} discrepancies · ${blind.length} unclaimed layers · ${notCompared.length} values the code does not declare`);
/* PASS MEANS THE WHOLE DRAWING WAS COMPARED - not the part of it the app happened to name.
   A run that says "every compared value equals the file" while hundreds of layers were never
   compared is a pass covering for a blind spot. So: a difference FAILs, and layers nobody
   named make the run INCOMPLETE - never a pass. */
const unverified = blind.length + unresolvable.length + gone.length;
if (fails.length) console.log(`   FAIL - ${fails.length} layer value(s) do not match the file`);
else if (unverified) console.log(`   INCOMPLETE - every compared value equals the file, but ${blind.length} layer(s) are claimed by no element and ${unresolvable.length} marker(s) could not be resolved: ${unverified} layer(s) of this drawing are NOT verified`);
else console.log(`   PASS - every layer in the drawing is claimed and every value equals the file`);

/* THE SEAL IS A FROZEN REFERENCE, AND A CHECK RUN NEVER MOVES IT.
   This used to write the seal on any run without a difference — INCLUDING an INCOMPLETE
   one. The next run then diffed the drawing against a seal that had already been advanced
   to the drawing's NEW state, so a value the designer moved was absorbed into the reference
   instead of reported against it: the drift dissolved and the following run said "nothing
   moved". That is error suppression with extra steps — the same shape as an asset named
   `chat-history` being taken as proof of the icon.
   The seal is the change record's other half, so it advances only when a person promotes it:
   `--seal`. A check run reports against the reference; it does not rewrite it. */
if (SEAL_NOW) {
  if (fails.length) {
    console.log(`   NOT SEALED - ${fails.length} value(s) still differ from the drawing; fix them before promoting this run.`);
  } else {
    writeFileSync(SEAL_PATH, JSON.stringify({
      capture: CAPTURE,
      nodeId: cap._capture?.nodeId ?? null,
      sealedAt: new Date().toISOString().slice(0, 10),
      compared,
      values: current,
    }, null, 2));
    console.log(`   SEALED - ${compared} compared value(s) become the reference the next run diffs against (${basename(SEAL_PATH)}).`);
  }
} else if (moved.length) {
  console.log(`   NOT SEALED - ${moved.length} value(s) moved against the sealed reference; carry them into the source, then re-run with --seal.`);
}
process.exit(fails.length ? 1 : (unverified ? 2 : 0));
