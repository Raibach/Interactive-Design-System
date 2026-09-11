#!/usr/bin/env node
/**
 * catalog-check.mjs — CATALOG HEALTH CHECK
 *
 * Answers one question: what is the condition of the component catalog?
 *
 * Runs the protocol checks over the catalog and the component sources and
 * writes a single findings list. That list is what the console chat shows on
 * load, so a design user can see what is wrong and go correct it.
 *
 * Findings are keyed by COMPONENT NAME + NODE ID, never by file path. Moving
 * files must never invalidate a finding.
 *
 * Output:
 *   frontend/catalog-audit/<pipeline>.json — machine-readable (served by the backend)
 *   stdout                                — human-readable
 *
 * FAIL LOUD: if a check cannot run, that is itself a finding. An empty list
 * and a check that never ran must never look the same.
 *
 * Usage: node scripts/catalog-check.mjs [--catalog NAME] [--offline]
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // frontend/
const REPO = join(ROOT, '..');

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt; };
const CATALOG_NAME = opt('--catalog', 'prompt-composer');
const OFFLINE = args.includes('--offline');

// ── Where things live (the single place paths are declared) ────────────────
const PATHS = {
  figmaMap: join(ROOT, 'src', 'components', 'registry.json'),
  schema: join(ROOT, 'src', 'components', 'A2UI', 'catalogs', CATALOG_NAME, 'catalog.json'),
  // The shared floor. Components every theme renders, written once here.
  primitives: join(ROOT, 'src', 'components', 'A2UI', 'catalogs', 'primitives', 'catalog.json'),
  allowlist: join(ROOT, 'src', 'shared', 'tag-registry.ts'),
  litDir: join(ROOT, 'src', 'components', 'lit'),
  extractor: join(ROOT, 'scripts', 'design-extract.mjs'),
  audit: join(ROOT, 'scripts', 'import-audit.mjs'),
  envFile: join(REPO, 'backend', '.env'),
  // NOT under dist/. `vite build` empties dist/, which silently deleted this
  // report and turned /api/catalog/audit into a 503 on every production build.
  out: join(ROOT, 'catalog-audit', `${CATALOG_NAME}.json`),
};

const DEFAULT_FILE_KEY = '20UPR2KQMsbAxlo5NJb1se';

// ── Finding shape ──────────────────────────────────────────────────────────
// stage:  ingest (pull) | deliver (reached the component) | gap (person's job)
// owner:  pipeline | designer
// level:  advisory | blocking   — nothing is blocking today; alert, don't block
const findings = [];
function add({ check, stage, owner, level = 'advisory', tier = null, component = null, nodeId = null, file = null, what, fix }) {
  findings.push({ id: `${check}:${component || file || nodeId || 'catalog'}`, check, stage, owner, level, tier, component, nodeId, file, what, fix });
}

const read = (p) => readFileSync(p, 'utf8');
const rel = (p) => p.replace(REPO + '/', '');

// ── Component sources ──────────────────────────────────────────────────────
function litFiles(dir = PATHS.litDir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) litFiles(p, acc);
    else if (e.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}
const SOURCES = litFiles().map((p) => ({ path: p, file: basename(p, '.ts'), src: read(p) }));
const srcOf = (name) => SOURCES.find((s) => s.file === name) || null;

// ── The catalog (allowlist source + schema + figma map) ────────────────────
const figmaMap = JSON.parse(read(PATHS.figmaMap));
const schema = JSON.parse(read(PATHS.schema));
const schemaComponents = Object.keys(schema.components || {});

// ── The allowlist — the gatekeeper's list, and the tier grouping ───────────
// Parsed, not imported: this is a .mjs script and tag-registry.ts is TS. The
// tier is DERIVED from each entry's surface, so membership has one home.
const allowlistSrc = read(PATHS.allowlist);
const allowlist = (() => {
  const block = allowlistSrc.slice(
    allowlistSrc.indexOf('export const TAG_REGISTRY'),
    allowlistSrc.indexOf('export type TagName'),
  );
  const out = [];
  const re = /^ {2}'([a-z0-9-]+)': \{([\s\S]*?)^ {2}\},/gm;
  let m;
  while ((m = re.exec(block))) {
    out.push({ tag: m[1], surface: (m[2].match(/surface: '([a-z-]+)'/) || [])[1] || 'both' });
  }
  return out;
})();
const allowlistTags = new Set(allowlist.map((a) => a.tag));

/** surface → tier. Mirrors CATALOG_TIERS in tag-registry.ts. */
function tierOfTag(tag) {
  const a = allowlist.find((x) => x.tag === tag);
  if (!a) return 'primitives';
  return a.surface === 'composer' ? 'prompt-composer' : a.surface === 'console' ? 'console' : 'primitives';
}

// ── Events: what is dispatched vs what is heard ────────────────────────────
const dispatched = new Map(); // event -> [component]
for (const s of SOURCES) {
  for (const m of s.src.matchAll(/new\s+CustomEvent\(\s*['"]([^'"]+)['"]/g)) {
    if (!dispatched.has(m[1])) dispatched.set(m[1], []);
    dispatched.get(m[1]).push(s.file);
  }
}
const heard = new Set();
for (const s of SOURCES) for (const m of s.src.matchAll(/@([a-z][a-z0-9-]+)=\$\{/g)) heard.add(m[1]);
// Listeners anywhere in the app, not just inside the components.
function walkSrc(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walkSrc(p, acc); }
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
for (const p of walkSrc(join(ROOT, 'src'))) {
  for (const m of read(p).matchAll(/addEventListener\(\s*['"]([^'"]+)['"]/g)) heard.add(m[1]);
}

// ═══ DELIVER — did the spec reach the component? ═══════════════════════════
// Provenance: every registry entry must say which fields came from the design
// and which were invented. An unmarked invention passes as the designer's word.
for (const c of figmaMap.components) {
  if (!c.provenance) {
    const s = srcOf(c.litComponent);
    const invented = s ? [...s.src.matchAll(/new\s+CustomEvent\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]) : [];
    add({
      check: 'provenance-missing', stage: 'deliver', owner: 'pipeline',
      component: c.litComponent, nodeId: c.figmaNodeId, file: c.file,
      what: `No provenance block. ${invented.length ? `${invented.length} event name(s) are unmarked inventions: ${invented.join(', ')}.` : 'Nothing marks which fields came from the design and which were invented.'}`,
      fix: `Add a "provenance" object marking each field verbatim or inferred.`,
    });
  }
}

// Node IDs: a component derived from Figma must carry its node id, or it cannot
// be traced back to the design it came from.
for (const c of figmaMap.components) {
  if (!c.figmaNodeId) continue;
  const s = srcOf(c.litComponent);
  if (!s) {
    add({ check: 'component-missing', stage: 'deliver', owner: 'pipeline', component: c.litComponent, nodeId: c.figmaNodeId, file: c.file, what: 'Registry entry names a component source that does not exist.', fix: 'Correct the registry entry or restore the file.' });
    continue;
  }
  if (!s.src.includes('data-node-id') && !/node\s+\d/.test(s.src)) {
    add({ check: 'node-id-absent', stage: 'deliver', owner: 'pipeline', component: c.litComponent, nodeId: c.figmaNodeId, file: c.file, what: `Derived from Figma node ${c.figmaNodeId} but carries no data-node-id anywhere.`, fix: 'Carry the node id on each mapped element.' });
  }
}

// Unheard events: a dispatched event nothing listens for is a dead control
// unless it is explicitly marked as an unimplemented stub.
for (const [event, by] of dispatched) {
  if (heard.has(event)) continue;
  for (const comp of by) {
    const s = srcOf(comp);
    if (s && s.src.includes('TODO(behavior)')) continue; // correctly marked
    add({ check: 'event-unheard', stage: 'deliver', owner: 'pipeline', component: comp, nodeId: null, file: s ? rel(s.path) : null, what: `Dispatches "${event}" and nothing listens — and it is not marked as a stub.`, fix: `Wire a listener, or mark it: // TODO(behavior): action undefined in Figma` });
  }
}

// ═══ DELIVER — does this theme match the shared floor? ════════════════════
// catalogs/primitives/catalog.json is the single home for components every theme
// renders. A theme restating one differently IS the drift that file exists to
// stop, so the difference fails HERE rather than surfacing later as two surfaces
// rendering the same component two ways.
if (existsSync(PATHS.primitives) && schema.components) {
  const primitives = JSON.parse(read(PATHS.primitives));
  for (const [name, spec] of Object.entries(primitives.components || {})) {
    const mine = schema.components[name];
    if (!mine) {
      add({
        check: 'primitive-missing', stage: 'deliver', owner: 'pipeline', tier: 'primitives',
        component: name, nodeId: null, file: rel(PATHS.schema),
        what: `The "${CATALOG_NAME}" catalog omits primitive "${name}", which every theme must carry.`,
        fix: `Copy "${name}" from catalogs/primitives/catalog.json, unchanged.`,
      });
    } else if (JSON.stringify(mine) !== JSON.stringify(spec)) {
      add({
        check: 'primitive-drift', stage: 'deliver', owner: 'pipeline', tier: 'primitives',
        component: name, nodeId: null, file: rel(PATHS.schema),
        what: `Primitive "${name}" differs from catalogs/primitives/catalog.json — the shared floor is restated here, not referenced. Two definitions of one component.`,
        fix: `Make "${name}" identical to the primitives catalog, or change it THERE if the change is meant for every theme.`,
      });
    }
  }
}

// ═══ DELIVER — do the two gates agree? ════════════════════════════════════
// Two independent gates decide what may render: the ALLOWLIST (tag-registry.ts —
// used by the event-bus gatekeeper and A2UISurfaceContainer) and the SCHEMA
// (catalog.json — used by the server). A component that passes one and fails the
// other is one the AI can be told to emit and then have rejected, or one that
// renders on a surface and 503s on another.
//
// THREE CHANNELS, NOT TWO — conflating them is what this check got wrong.
//
// The allowlist is not only the A2UI component vocabulary. It also carries the
// tags the CHAT emits as markup — <save-button/>, <prompt-section .../> — which
// the orchestrator handles over the event bus. A command tag never enters an
// updateComponents payload, so "is it in the A2UI schema?" is the wrong question
// for it. Asked anyway, it reported save-button as a 503 waiting to happen while
// it is a working command wired to the save path.
//
// The command tags are read out of the source (every `eventBus.on('<tag>'`)
// rather than listed here, so this exemption cannot rot the way a hand-kept list
// does. NOTE the walk: the handlers live in the pages (.tsx), NOT in the Lit
// sources, so scanning only the component sources silently missed every one of
// them — save-button was still reported as inert while being wired to the save
// path. Same walk as the `heard` set above, for the same reason.
const CHAT_COMMAND_TAGS = new Set(
  walkSrc(join(ROOT, 'src')).flatMap((p) =>
    [...read(p).matchAll(/eventBus\.on\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
  ),
);

// A2UI PROTOCOL components — defined by the A2UI v0.9.1 spec, not by this
// repository. They are not Lit elements, so the allowlist is NOT expected to
// name them; flagging them as drift would be noise that buries the real drift.
// Declared explicitly rather than guessed from casing, because guessing is how
// the previous version of this check produced false positives.
const A2UI_PROTOCOL_COMPONENTS = ['Text', 'Image', 'Row', 'Column', 'Card', 'Button'];

// The tags some source file actually defines an element for.
const DEFINED_TAGS = new Set(
  SOURCES
    .map((s) => (s.src.match(/customElements\.define\(\s*['"]([^'"]+)['"]/) || [])[1])
    .filter(Boolean),
);

// The allowlist is the authority: it names the Lit elements that exist.
for (const a of allowlist) {
  if (schemaComponents.includes(a.tag)) continue;
  if (CHAT_COMMAND_TAGS.has(a.tag)) continue; // a command, not a component

  // Neither gate is involved in a name that nothing implements: no element, no
  // schema, no handler. That failure is worse than a 503, not better — it is
  // SILENT — so it gets its own finding rather than borrowing a 503's wording.
  if (!DEFINED_TAGS.has(a.tag)) {
    add({
      check: 'tag-inert', stage: 'deliver', owner: 'pipeline', tier: tierOfTag(a.tag),
      component: a.tag, nodeId: null, file: rel(PATHS.allowlist),
      what: `Allowlist offers "${a.tag}" but nothing implements it — no element defines it, no schema accepts it, and no handler listens for it. The model can be told to emit it and it does nothing at all.`,
      fix: `Implement it (a Lit element plus a catalog entry), or drop "${a.tag}" from the allowlist.`,
    });
    continue;
  }

  add({
    check: 'schema-absent', stage: 'deliver', owner: 'pipeline', tier: tierOfTag(a.tag),
    component: a.tag, nodeId: null, file: rel(PATHS.allowlist),
    what: `Allowlist permits "${a.tag}" and <${a.tag}> IS defined, but the "${CATALOG_NAME}" schema does not list it — the server rejects any payload containing it (503).`,
    fix: `Add "${a.tag}" to catalogs/${CATALOG_NAME}/catalog.json, or drop it from the allowlist.`,
  });
}

for (const tag of schemaComponents) {
  if (allowlistTags.has(tag)) continue;
  if (A2UI_PROTOCOL_COMPONENTS.includes(tag)) continue;
  add({
    check: 'allowlist-absent', stage: 'deliver', owner: 'pipeline', tier: 'primitives',
    component: tag, nodeId: null, file: rel(PATHS.schema),
    what: `The "${CATALOG_NAME}" schema lists "${tag}" but the allowlist does not — the gatekeeper rejects it, so nothing can render it.`,
    fix: `Add "${tag}" to src/shared/tag-registry.ts with the right surface, or remove it from the schema.`,
  });
}

// A component the schema lists but its own anyComponent.oneOf does not.
//
// The server validates against `components` — validate_a2ui_components reads
// those KEYS — so a name missing from oneOf does not break THIS server. It
// breaks the artifact: this file is published as the catalog (see `catalogId`),
// and a client that validates a payload against $defs.anyComponent would reject
// a name the server happily accepted. Two lists in one file that disagree is
// precisely how the next drift starts, so the check is here rather than in a
// reviewer's memory.
const oneOfRefs = new Set(
  (schema.$defs?.anyComponent?.oneOf ?? [])
    .map((r) => String(r.$ref || '').replace('#/components/', ''))
    .filter(Boolean),
);
for (const name of schemaComponents) {
  if (oneOfRefs.has(name)) continue;
  add({
    check: 'schema-unreachable', stage: 'deliver', owner: 'pipeline', tier: 'primitives',
    component: name, nodeId: null, file: rel(PATHS.schema),
    what: `The schema lists "${name}" in components but not in $defs.anyComponent.oneOf — a client validating against anyComponent would reject a payload naming it, though this server accepts it.`,
    fix: `Add {"$ref": "#/components/${name}"} to $defs.anyComponent.oneOf, or remove "${name}" from components.`,
  });
}

// A Lit element in NEITHER gate is genuinely unclaimed: it ships in the bundle
// and no surface can ever render it. (This replaces a check that compared Lit
// tags straight to the schema and so mis-reported allowlist-only components.)
const definesElement = (src) => {
  const m = src.match(/customElements\.define\(\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
};
for (const s of SOURCES) {
  const tag = definesElement(s.src);
  if (!tag) continue; // a helper module, not an element — nothing to claim
  if (allowlistTags.has(tag) || schemaComponents.includes(tag)) continue;
  add({
    check: 'element-unclaimed', stage: 'deliver', owner: 'pipeline', tier: 'primitives',
    component: s.file, nodeId: null, file: rel(s.path),
    what: `Defines <${tag}> but neither the allowlist nor the schema claims it — no surface can render it.`,
    fix: `Add "${tag}" to the allowlist, or delete the element.`,
  });
}

// ═══ INGEST — the pipeline's own health ════════════════════════════════════
// The annotation attribute name is untrusted; hardcoding it is forbidden.
if (existsSync(PATHS.extractor)) {
  const ex = read(PATHS.extractor);
  const m = ex.match(/EXPECTED_ANNOTATION_ATTR\s*=\s*['"]([^'"]+)['"]/);
  if (m) {
    const seenInCaches = (() => { try { return (JSON.parse(read(join(ROOT, 'src', 'design', 'VALUES.json')))._meta || {}).annotationAttributeNames || []; } catch { return []; } })();
    const mismatch = seenInCaches.length && !seenInCaches.includes(m[1]);
    add({
      check: 'attr-hardcoded', stage: 'ingest', owner: 'pipeline', file: rel(PATHS.extractor),
      what: `Hardcodes the annotation attribute name as "${m[1]}"${mismatch ? ` but the pull emits "${seenInCaches.join(', ')}"` : ''}. The protocol says treat that name as untrusted.`,
      fix: 'Drop the expected-name constant; match by regex and record what was seen.',
    });
  }
}

// ═══ INGEST + GAP — the live file ══════════════════════════════════════════
// One REST call, joined locally. Unresolved addresses are a pipeline fault;
// a resolved node with no (or prose) annotation is the designer's job.
const STRUCTURED_FIELDS = ['Data', 'Source', 'On click', 'On drag', 'On click (', 'Track', 'State', 'Disabled', 'A11y', 'Builder', 'AI', 'Connects', 'Failure'];
const isStructured = (t) => STRUCTURED_FIELDS.some((f) => new RegExp(`^\\s*${f.replace(/[(]/g, '\\(')}`, 'm').test(t));

const fileKey = (() => {
  try { const m = read(PATHS.envFile).match(/^FIGMA_DEFAULT_FILE_KEY=(.*)$/m); return m ? m[1].trim() : DEFAULT_FILE_KEY; }
  catch { return DEFAULT_FILE_KEY; }
})();
const token = (() => { try { return (read(PATHS.envFile).match(/^FIGMA_TOKEN=(.*)$/m) || [])[1]?.trim() || null; } catch { return null; } })();

let liveStatus = 'complete';
const nodeIds = [...new Set(figmaMap.components.map((c) => c.figmaNodeId).filter(Boolean))];

if (OFFLINE) {
  liveStatus = 'partial';
} else if (!token) {
  liveStatus = 'partial';
  add({ check: 'check-could-not-run', stage: 'ingest', owner: 'pipeline', level: 'advisory', what: 'Cannot reach Figma — no token found. The live checks (node addresses, annotations) did not run.', fix: 'Set FIGMA_TOKEN in backend/.env. Until then this report is incomplete, not clean.' });
} else {
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeIds.join(',')}`, { headers: { 'X-Figma-Token': token } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    for (const c of figmaMap.components) {
      const id = c.figmaNodeId;
      if (!id) continue;
      const node = data.nodes?.[id]?.document;
      if (!node) {
        add({ check: 'node-unresolved', stage: 'ingest', owner: 'pipeline', component: c.litComponent, nodeId: id, file: c.file, what: `Address ${id} is not in the file. The pull returns nothing, so this component reports as "no annotation" when really the address is dead.`, fix: 'Point the registry at the component\u2019s real node id.' });
        continue;
      }
      const anns = node.annotations || [];
      const text = anns.map((a) => a.labelMarkdown || a.label || '').filter(Boolean).join('\n');
      if (!anns.length || !text.trim()) {
        add({ check: 'annotation-missing', stage: 'gap', owner: 'designer', component: c.litComponent, nodeId: id, file: c.file, what: `Node ${id} ("${node.name}", ${node.type}) resolves but carries no annotation.`, fix: `Annotate the variant in Figma. Template: FIGMA/ANNOTATION_FIGMA_GUIDE.md` });
      } else if (!isStructured(text)) {
        add({ check: 'annotation-prose', stage: 'gap', owner: 'designer', component: c.litComponent, nodeId: id, file: c.file, what: `Node ${id} has a note, but it is prose, not a spec — so behaviour must be invented. "${text.slice(0, 90)}${text.length > 90 ? '…' : ''}"`, fix: 'Rewrite using the field format (Data / On click / State / A11y).' });
      }
    }
  } catch (e) {
    liveStatus = 'partial';
    add({ check: 'check-could-not-run', stage: 'ingest', owner: 'pipeline', level: 'advisory', what: `Cannot reach Figma (${e.message}). The live checks did not run.`, fix: 'Restore Figma access. Until then this report is incomplete, not clean.' });
  }
}

// ═══ CLEAN — what passes, so the readout shows when things get fixed ═══════
const dirty = SOURCES.filter((s) => /className=|import React|useState/.test(s.src));
if (!dirty.length) {
  findings.push({ id: 'clean:no-jsx', check: 'clean-no-jsx', stage: 'clean', owner: 'pipeline', level: 'pass', component: null, nodeId: null, file: null, what: `No React, no JSX, no Tailwind in any of the ${SOURCES.length} component sources.`, fix: null });
}

// ═══ OUTPUT ════════════════════════════════════════════════════════════════
// Stamp every finding with its design-system tier. Derived from the allowlist, so
// a component shared by every theme reports under `primitives` and shows up in
// EACH theme's report while being repaired in exactly one place.
for (const f of findings) {
  if (!f.tier) f.tier = f.component ? tierOfTag(f.component) : 'primitives';
}

const open = findings.filter((f) => f.level !== 'pass');
const counts = {
  total: open.length,
  blocking: open.filter((f) => f.level === 'blocking').length,
  pipeline: open.filter((f) => f.owner === 'pipeline').length,
  designer: open.filter((f) => f.owner === 'designer').length,
  passed: findings.filter((f) => f.level === 'pass').length,
};

const report = {
  generatedAt: new Date().toISOString(),
  catalog: CATALOG_NAME,
  status: liveStatus,          // 'complete' | 'partial' — partial NEVER means clean
  fileKey,
  counts,
  // The design-system grouping. `primitives` is shared by every theme, so a
  // finding there appears in each theme's report and is fixed once.
  tiers: (() => {
    const t = {};
    for (const f of open) t[f.tier] = (t[f.tier] || 0) + 1;
    return t;
  })(),
  stages: ['ingest', 'deliver', 'gap'],
  checks: [...new Set(findings.map((f) => f.check))].sort(),
  findings,
};

mkdirSync(dirname(PATHS.out), { recursive: true });
writeFileSync(PATHS.out, JSON.stringify(report, null, 2) + '\n');

const pad = (s, w) => String(s).padEnd(w);
const lines = [];
lines.push(`CATALOG CHECK — ${CATALOG_NAME} — ${report.status.toUpperCase()}`);
lines.push('='.repeat(64));
lines.push(`  open ${counts.total}   ·   pipeline ${counts.pipeline}   ·   designer ${counts.designer}   ·   blocking ${counts.blocking}`);
if (report.status === 'partial') lines.push('  ⚠ INCOMPLETE — a live check did not run. This is NOT a clean result.');
lines.push('');
for (const stage of ['ingest', 'deliver', 'gap']) {
  const rows = open.filter((f) => f.stage === stage);
  if (!rows.length) continue;
  lines.push(`── ${stage.toUpperCase()} ${'─'.repeat(56 - stage.length)}`);
  for (const f of rows) {
    const label = (f.component || f.file || '(catalog)');
    lines.push(`  ${pad(f.owner === 'designer' ? '✍' : '🔧', 3)}${pad(label.length > 26 ? label.slice(0, 24) + '…' : label, 27)}${f.nodeId ? pad(f.nodeId, 16) : ''}${f.check}`);
    lines.push(`      ${f.what}`);
  }
  lines.push('');
}
const passed = findings.filter((f) => f.level === 'pass');
if (passed.length) {
  lines.push('── PASSING ' + '─'.repeat(54));
  for (const f of passed) lines.push(`  ✓ ${f.what}`);
  lines.push('');
}
lines.push(`report → ${rel(PATHS.out)}`);
console.log(lines.join('\n'));

// A check that produced nothing at all is a broken check, not a clean catalog.
if (!findings.length) {
  console.error('\n[catalog-check] FAIL: zero findings of any kind. The matcher or the paths are wrong — not a perfect catalog.');
  process.exit(1);
}
