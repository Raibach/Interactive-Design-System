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
 * SEVERITY: a finding is `advisory` (a person still has to author something) or
 * `blocking` (the pipeline's own ability to see, or to stay consistent, is
 * broken). BLOCKING findings exit 1. Every severity has one home: BLOCKING below.
 *
 * CENSUS: every check in CHECK_INVENTORY reports whether it RAN and how many
 * findings it raised. Green means "every check ran and nothing blocked" — never
 * "the catalog is clean". A check that should have run and did not run is turned
 * into a blocking finding, because a check that produced nothing used to be
 * indistinguishable from a check that passed.
 *
 * Usage: node scripts/catalog-check.mjs [--catalog NAME] [--offline]
 *        --offline declares the live Figma checks skipped on purpose: the run is
 *        reported INCOMPLETE and is not treated as a missing check.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, basename, sep } from 'node:path';
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
  // The documents that state facts about this catalog. `doc-claim-drift` reads them,
  // which is what turns "drift between catalog and docs is self-announcing" from a
  // sentence into a mechanism.
  readme: join(REPO, 'README.md'),
  conformance: join(REPO, 'READ-ME', 'IMPLEMENTATION_CONFORMANCE.md'),
  // The register of what is still open — at the repository ROOT and TRACKED. It used
  // to live in a locally excluded directory, where nothing showed it as changed and a
  // clone did not have it, so every defect number quoted from it was unverifiable.
  openItems: join(REPO, 'OPEN-ITEMS.md'),
  // The ledger of FIXES — one row per finding corrected, with the commit that carries
  // the fix. The register answers "what is still open"; this answers "what did we
  // already do, and does it still hold". Separate files because they are separate
  // questions, and because a correction that regresses must be visible as a
  // regression rather than as a count quietly going back up.
  corrections: join(REPO, 'CORRECTIONS.md'),
  // The two other tracked documents that cite register numbers.
  index: join(REPO, 'INDEX.md'),
  notes: join(REPO, 'catalog-audit', 'AI-notes.md'),
  changelog: join(REPO, 'CHANGELOG.md'),
  // The pipeline the documents describe. deps.py loads exactly this one, so "the
  // count stated in the docs" means this catalog even during an ecommerce run.
  defaultSchema: join(ROOT, 'src', 'components', 'A2UI', 'catalogs', 'prompt-composer', 'catalog.json'),
  // NOT under dist/. `vite build` empties dist/, which silently deleted this
  // report and turned /api/catalog/audit into a 503 on every production build.
  out: join(ROOT, 'catalog-audit', `${CATALOG_NAME}.json`),
};

const DEFAULT_FILE_KEY = '20UPR2KQMsbAxlo5NJb1se';

// ── Finding shape ──────────────────────────────────────────────────────────
// stage:  ingest (pull) | deliver (reached the component) | gap (person's job)
// owner:  pipeline | designer
// level:  pass | advisory | blocking — resolved from BLOCKING below, one home.
const findings = [];

// ── The inventory: every check this script knows how to run ────────────────
// The point is the DENOMINATOR. The report used to list only the checks that
// raised something (`checks` was built FROM the findings), so "ran and passed"
// and "never ran" were the same absence — six checks could be dead for months
// and the readout would look identical. Each check marks itself through
// checkRan(); the census in the report carries ran + counts per check.
//   live: true → needs Figma; skipped in --offline runs and when no token exists.
const CHECK_INVENTORY = [
  { id: 'component-missing', stage: 'deliver', live: false, asserts: 'every registry entry names a component source that exists' },
  { id: 'node-id-absent', stage: 'deliver', live: false, asserts: 'every node-derived component carries its node id' },
  { id: 'provenance-missing', stage: 'deliver', live: false, asserts: 'every entry says which fields are design and which are invented' },
  { id: 'container-undeclared', stage: 'deliver', live: false, asserts: 'a component drawn inside a container declares it' },
  { id: 'event-unheard', stage: 'deliver', live: false, asserts: 'every dispatched event is heard or marked a stub' },
  { id: 'primitive-missing', stage: 'deliver', live: false, asserts: 'the theme carries every shared primitive' },
  { id: 'primitive-drift', stage: 'deliver', live: false, asserts: 'the shared primitives are referenced, not restated' },
  { id: 'tag-inert', stage: 'deliver', live: false, asserts: 'every allowlist tag is implemented (element + schema + handler)' },
  { id: 'schema-absent', stage: 'deliver', live: false, asserts: 'every implemented allowlist tag is in the schema' },
  { id: 'allowlist-absent', stage: 'deliver', live: false, asserts: 'every schema component is drawable' },
  { id: 'schema-unreachable', stage: 'deliver', live: false, asserts: 'every schema component is reachable through anyComponent' },
  { id: 'element-unclaimed', stage: 'deliver', live: false, asserts: 'every shipped element is claimed by a gate, a map entry, or a source that draws it' },
  { id: 'element-refused', stage: 'deliver', live: false, asserts: 'a behavioural element is claimed by an allowlist entry, a catalog entry, a map entry, or a source that draws it' },
  { id: 'prop-undeclared', stage: 'deliver', live: false, asserts: 'every property the catalog lets a component carry is declared by the element that draws it' },
  { id: 'attr-hardcoded', stage: 'ingest', live: false, asserts: 'the untrusted annotation attribute name is not hardcoded' },
  { id: 'node-unresolved', stage: 'ingest', live: true, asserts: 'every registry node address resolves in the file' },
  { id: 'annotation-missing', stage: 'gap', live: true, asserts: 'every resolved node carries an annotation' },
  { id: 'annotation-prose', stage: 'gap', live: true, asserts: 'every annotation is a spec, not prose' },
  { id: 'annotation-on-placement', stage: 'ingest', live: true, asserts: 'a control\'s spec is on its master, not on a placement of it' },
  { id: 'geometry-drift', stage: 'deliver', live: true, asserts: 'the node and the rendering agree' },
  { id: 'check-could-not-run', stage: 'ingest', live: false, asserts: 'no check was skipped' },
  { id: 'clean-no-jsx', stage: 'clean', live: false, asserts: 'no React/JSX/Tailwind in the component sources' },
  { id: 'doc-claim-drift', stage: 'deliver', live: false, asserts: 'the component count and names the documents state are the catalog\'s' },
  { id: 'open-items-register', stage: 'deliver', live: false, asserts: 'the register is tracked and agrees with the findings this run derived' },
  { id: 'corrections-ledger', stage: 'deliver', live: false, asserts: 'every correction the ledger records is still earned' },
];

// Severity, one home. A finding about the pipeline's own ability to SEE or to stay
// CONSISTENT blocks the run. A finding about work a person still has to author is
// advisory: it must be visible and must not stop a build. Nothing is advisory by
// accident — it is advisory because someone else, not this script, can fix it.
const BLOCKING = new Set([
  'check-could-not-run',   // the report does not know what it is talking about
  'attr-hardcoded',        // the reader depends on a name the protocol calls untrusted
  'node-unresolved',       // the address is dead: everything said about it is fiction
  'annotation-on-placement', // the spec is on a place the component was used, not on the component: nothing downstream can find it
  'component-missing',     // the map names a component source that is not there
  'primitive-drift',       // one component, two definitions
  'primitive-missing',     // a theme that silently drops the shared floor
  'schema-unreachable',    // a published catalog a client would reject
  'element-refused',       // an element with behaviour and no home: it can ship, and no check ever asks about it
  'prop-undeclared',       // a value the catalog promises the element never receives: the wire is cut in silence
  'doc-claim-drift',       // a document states something about this catalog that is false
  'open-items-register',   // the register and the run disagree — one of them is lying
  'corrections-ledger',    // a recorded fix that no longer holds: a regression wearing a fixed label
]);

const ran = new Set();
const checkRan = (id) => { ran.add(id); };
/**
 * `key` disambiguates when ONE subject legitimately carries SEVERAL findings.
 *
 * A component that dispatches four unheard events has four problems, not one
 * problem reported four times — but the id was built from the component alone, so
 * all four collided on one key. The collision was visible rather than theoretical:
 * the chat rendered them under duplicate React keys ("Encountered two children with
 * the same key, event-unheard:…"), and a reader could not tell four findings from
 * one finding printed four times. Pass the thing that makes them different.
 */
function add({ check, stage, owner, level = null, tier = null, component = null, nodeId = null, file = null, what, fix, key = null, dispatchedEvents = null }) {
  // Severity is resolved, not passed: BLOCKING is the single home for the rule.
  // A caller may still force a level — that is what the `pass` entries use.
  const resolved = level || (BLOCKING.has(check) ? 'blocking' : 'advisory');
  const finding = { id: `${check}:${component || file || nodeId || 'catalog'}${key ? `:${key}` : ''}`, check, stage, owner, level: resolved, tier, component, nodeId, file, what, fix };
  // A CHECK'S MEASUREMENTS ARE DATA, NOT A SENTENCE. Five event names inside the
  // English of `what` can only be read by a person; the same five names as a list
  // are what the repair prompt needs to WRITE the value it asks for, instead of
  // describing one that someone else has to type. `new CustomEvent('…')` in the
  // component's own source is the measurement (see dispatchNames below). Carried
  // only by the checks that make it, so the 45 findings that have no such list do
  // not grow a null-valued key that reads like a field nobody uses.
  if (dispatchedEvents && dispatchedEvents.length) finding.dispatchedEvents = dispatchedEvents;
  findings.push(finding);
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
/**
 * The event names a component's own source dispatches — one measurement, read by
 * two checks: provenance (those names are unmarked inventions until the entry says
 * otherwise) and annotation (they are the material for `On click:`). It reaches the
 * repair prompt as a list rather than as a clause inside `what`, so the prompt can
 * write the value it asks for instead of describing one to type out by hand.
 */
const dispatchNames = (name) => {
  const s = srcOf(name);
  return s ? [...s.src.matchAll(/new\s+CustomEvent\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]) : [];
};

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
    // ONE row per component per event, not one per call site. A component that
    // raises the same event from five places used to produce five identical
    // findings: the report counted 69 open under a heading of 58 distinct
    // problems, and the chat rendered them with duplicate React keys (which is
    // where "Encountered two children with the same key, event-unheard:…" came
    // from). The finding's subject is the component, not the line.
    if (!dispatched.get(m[1]).includes(s.file)) dispatched.get(m[1]).push(s.file);
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
// Listeners reached through a LOCAL HELPER — `const on = <T extends Event>(type, fn)
// => this.addEventListener(type, fn)` followed by `on<CustomEvent>('section-add', …)`.
// The event's name never appears next to addEventListener, so the sweep above cannot
// see it: three events in this app are heard exactly this way, and were reported as
// "nothing listens" while a listener was attached a few lines away. A helper is only
// trusted in a file that itself binds addEventListener, which keeps this from
// matching unrelated `on(` calls elsewhere.
for (const s of SOURCES) {
  if (!/\.addEventListener\s*\(/.test(s.src)) continue;
  for (const m of s.src.matchAll(/\bon(?:<[^>()]*>)?\(\s*['"]([a-z][a-z0-9-]+)['"]/g)) heard.add(m[1]);
}

// ═══ DELIVER — did the spec reach the component? ═══════════════════════════
// Provenance: every registry entry must say which fields came from the design
// and which were invented. An unmarked invention passes as the designer's word.
checkRan('provenance-missing');
// The subject here is the SOURCE FILE, not the registry row that names it.
//
// Provenance is a property of the file — which fields came from the design and which
// were invented — so a file with no provenance block is ONE problem however many rows
// resolve to it. Two rows do resolve to `prompt-input-section.ts` (#024), and reporting
// the same sentence once per row put two findings under one id: the chat rendered them
// under duplicate React keys ("Encountered two children with the same key,
// `provenance-missing:prompt-input-section`"), and a repair click repaired whichever
// came first. Counted once per file. The node that made it visible is not lost — the
// node-scoped findings below name it.
// Which row speaks for a file: the row whose figmaName IS the component.
//
// Two rows can resolve to one file (#024). This finding is about the file, but its node
// id is what a repair is told to open (`WritingAreaIndex.tsx:1270` writes it into the
// brief), so it has to be the component's own node — not whichever row the iteration
// yields first. Order-independent: the canonical row wins wherever it sits.
const provenanceSubjects = new Map();
for (const c of figmaMap.components) {
  if (!c.provenance) {
    const subject = c.file || c.litComponent || c.figmaNodeId;
    const known = provenanceSubjects.get(subject);
    if (!known || (c.figmaName === c.litComponent && known.figmaName !== known.litComponent)) {
      provenanceSubjects.set(subject, c);
    }
  }
}
for (const c of provenanceSubjects.values()) {
  if (!c.provenance) {
    const invented = dispatchNames(c.litComponent);
    add({
      check: 'provenance-missing', stage: 'deliver', owner: 'pipeline',
      component: c.litComponent, nodeId: c.figmaNodeId, file: c.file,
      what: `No provenance block. ${invented.length ? `${invented.length} event name(s) are unmarked inventions: ${invented.join(', ')}.` : 'Nothing marks which fields came from the design and which were invented.'}`,
      fix: `Add a "provenance" object marking each field verbatim or inferred.`,
      dispatchedEvents: invented,
    });
  }
}

// Node IDs: a component derived from Figma must carry its node id, or it cannot
// be traced back to the design it came from.
checkRan('component-missing');
checkRan('node-id-absent');
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

// Container membership: a component that renders INSIDE a container has to say so.
//
// This is the case no geometry check can reach. A button that never claims to
// belong to the rail cannot be compared against the rail's constraint — it simply
// has no constraint, and it will keep whatever size it was drawn at. Silence reads
// as fine, which is the failure mode this whole layer exists to prevent.
//
// The container names the elements it renders inside (`renderedBy`); an entry whose
// component is listed there but which does not declare the container back is the
// one that slipped in.
checkRan('container-undeclared');
for (const c of figmaMap.components) {
  if (!c.litComponent) continue;
  // The element's OWN entry is not a slot in the container — it is the element the
  // container lives inside. Only components rendered INTO it are checked.
  if (c.figmaName === c.litComponent) continue;
  for (const [name, container] of Object.entries(figmaMap.containers || {})) {
    const renderedBy = container.renderedBy || [];
    if (renderedBy.includes(c.litComponent) && c.container !== name) {
      add({ check: 'container-undeclared', stage: 'deliver', owner: 'pipeline', component: c.litComponent, nodeId: c.figmaNodeId || null, file: c.file, what: `Renders inside the "${name}" container but the entry does not declare it, so no constraint applies to it and nothing checks its geometry. It keeps whatever size it was drawn at.`, fix: `Add "container": "${name}" to the registry entry. Until then this component is unchecked by design, not by accident.` });
    }
  }
}
// Unheard events: a dispatched event nothing listens for is a dead control
// unless it is explicitly marked as an unimplemented stub.
checkRan('event-unheard');
for (const [event, by] of dispatched) {
  if (heard.has(event)) continue;
  for (const comp of by) {
    const s = srcOf(comp);
    // NO ESCAPE. A `TODO(behavior)` written in a comment used to excuse the file from
    // this check — so the escape was a claim made inside the very code that dispatches
    // the event, about itself. A dispatched event with nothing listening is a dead
    // control whether or not someone typed "undefined in Figma" beside it.
    add({ check: 'event-unheard', stage: 'deliver', owner: 'pipeline', component: comp, nodeId: null, file: s ? rel(s.path) : null, key: event, what: `Dispatches "${event}" and nothing listens — and it is not marked as a stub.`, fix: `Wire a listener, or mark it: // TODO(behavior): action undefined in Figma` });
  }
}

// ═══ DELIVER — does this theme match the shared floor? ════════════════════
// catalogs/primitives/catalog.json is the single home for components every theme
// renders. A theme restating one differently IS the drift that file exists to
// stop, so the difference fails HERE rather than surfacing later as two surfaces
// rendering the same component two ways.
if (existsSync(PATHS.primitives) && schema.components) {
  // Marked INSIDE the guard: a missing primitives catalog means these two checks
  // never ran, and the census below turns that into a blocking finding instead of
  // a silence that reads as a pass.
  checkRan('primitive-missing');
  checkRan('primitive-drift');
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

// The renderer's own resolution tables. resolveTag() consults these BEFORE the
// allowlist is ever read (a2ui-renderer.ts): an explicit composite alias, the six
// spec primitives, then the renderer-owned structural composites.
//
// This is the correction that matters in this file. The check below used to
// compare the schema to the allowlist alone and report every difference as "the
// gatekeeper rejects it, so nothing can render it" — wrong twice over:
//
//   * the server's gate is not the allowlist. It is this catalog: deps.py::
//     validate_a2ui_components validates against these `components` keys, so
//     every name in this schema is accepted by it;
//   * the renderer draws COMPOSITE_MAP / A2UI_STRUCTURAL names without the
//     allowlist being consulted at all.
//
// Ten names were reported that way — ActionGroup, ChatPanel, CompiledOutput,
// ConsoleCardGrid, DecisionDialog, SectionEditor, footer-bar, add-section-button,
// status-readout, token-cost-readout — and every one of them resolved. Nine still
// do. (ChatPanel resolves to <chat-panel>, which no element defines — a real gap,
// and a different one: it is the element that is missing, not a gate that blocks
// it. The renderer now reports that case itself.)
//
// Read out of the tables rather than listed here, so this exemption cannot rot
// the way a hand-kept list would.
const tableKeys = (src, name) => {
  const block = src.match(
    new RegExp(`(?:const|export const)\\s+${name}\\b[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`),
  );
  if (!block) return [];
  return [...block[1].matchAll(/(?:'([^']+)'|([A-Za-z_$][\w$]*))\s*:/g)].map((m) => m[1] || m[2]);
};
const RENDERER_OWNED = new Set([
  ...tableKeys(read(join(ROOT, 'src/components/lit/a2ui-renderer.ts')), 'COMPOSITE_MAP'),
  ...tableKeys(read(join(ROOT, 'src/components/lit/a2ui-primitives.ts')), 'A2UI_STRUCTURAL'),
]);

// The allowlist is the authority: it names the Lit elements that exist.
checkRan('tag-inert');
checkRan('schema-absent');
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

checkRan('allowlist-absent');
for (const tag of schemaComponents) {
  if (allowlistTags.has(tag)) continue;
  if (A2UI_PROTOCOL_COMPONENTS.includes(tag)) continue;
  // Resolved by the renderer's own tables, which are consulted first. The
  // allowlist is not its authority and the server does not gate on it.
  if (RENDERER_OWNED.has(tag)) continue;
  add({
    check: 'allowlist-absent', stage: 'deliver', owner: 'pipeline', tier: 'primitives',
    component: tag, nodeId: null, file: rel(PATHS.schema),
    what: `The "${CATALOG_NAME}" schema lists "${tag}", and nothing draws it: not a spec primitive (${A2UI_PROTOCOL_COMPONENTS.join(', ')}), not one of the renderer's own composites (${[...RENDERER_OWNED].join(', ')}), and not an allowlist tag. The server ACCEPTS the name — its gate is this file — so the model can be told to emit it and the surface answers with a "not in the catalog" block.`,
    fix: `Implement it (a Lit element plus a COMPOSITE_MAP / A2UI_STRUCTURAL entry, or an allowlist entry), or remove "${tag}" from the schema.`,
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
checkRan('schema-unreachable');
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
//
// BUT "no surface claims it" is not "nothing can draw it". Three elements were
// reported here on every run — <a2ui-renderer> (which IS the drawing code),
// <control-bar> (placed by the page) and <agent-card-element> (created by the
// renderer's own card grid). None of them is an A2UI SURFACE component: the app
// mounts them directly, so no surface has to claim them. Read the mounts from the
// APP sources — never from the element's own file, which only names itself, and
// never from the tests or the stories, which mount elements for their own sake.
const APP_SOURCES = walkSrc(join(ROOT, 'src')).filter(
  (p) => !p.startsWith(PATHS.litDir) && !p.split(sep).includes('test') && !/\.stories\./.test(p),
);
const mountedBy = (tag) => APP_SOURCES.find((p) => {
  const src = read(p);
  return src.includes(`<${tag}`) || src.includes(`createElement('${tag}'`) || src.includes(`createElement("${tag}"`);
});
/**
 * THE THIRD HOME: a PARENT ELEMENT composes it.
 *
 * This is the channel that was missing, and its absence is why seven sub-pieces of the
 * chat panel were reported as unclaimed on every run. <chat-header>, <chat-messages>,
 * <chat-input>, <chat-action-bar>, <chat-footer>, <small-dropdown> and
 * <chat-repair-actions> are drawn by <chat-panel>'s own template — "Sub-pieces are
 * internal to a parent element" (Core-Concept.md). A parent that renders the tag is a
 * claim, and reading it from the element's own file is still forbidden: the scan
 * excludes `self`, because a file naming itself names nobody.
 */
const composedBy = (tag, selfPath) => SOURCES.find((s) => s.path !== selfPath && s.src.includes(`<${tag}`));
/** THE FOURTH HOME: the Figma map names it (the design relationship is a claim too). */
const mappedBy = (tag) => figmaMap.components.find((c) => c.litComponent === tag);
checkRan('element-unclaimed');
checkRan('element-refused');
const definesElement = (src) => {
  const m = src.match(/customElements\.define\(\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
};
for (const s of SOURCES) {
  const tag = definesElement(s.src);
  if (!tag) continue; // a helper module, not an element — nothing to claim
  if (allowlistTags.has(tag) || schemaComponents.includes(tag)) continue;
  const mount = mountedBy(tag);
  const parent = composedBy(tag, s.path);
  const mapped = mappedBy(tag);
  // The claiming HOME, as a path — normalised, because the channels return different
  // shapes: the app channel and the map are strings/entries, a parent element is a
  // SOURCE object, and `rel()` takes a path.
  const claimedPath = mount || (parent && parent.path) || (mapped && mapped.file) || null;
  if (claimedPath) {
    // Claimed somewhere other than the two gates. Recorded as a PASS with its claiming
    // home, so the exemption is on the record and reasoned about, not silently dropped
    // — and so the check still shows as having run.
    findings.push({
      id: `clean:app-mounted:${tag}`, check: 'element-unclaimed', stage: 'clean', owner: 'pipeline',
      level: 'pass', tier: 'primitives', component: s.file, nodeId: null,
      file: rel(claimedPath),
      what: parent && !mount
        ? `Defines <${tag}> and a parent element draws it (${rel(parent.path)}) — a sub-piece of its parent, not an A2UI surface component.`
        : mount
          ? `Defines <${tag}> and the app mounts it directly (${rel(mount)}) — it is not an A2UI surface component, so no surface has to claim it.`
          : `Defines <${tag}> and the Figma map records where it came from (${mapped.file}) — tracked by the annotation checks even though no surface emits it.`,
      fix: null,
    });
    continue;
  }
  const dispatchedBy = dispatchNames(s.file);
  if (dispatchedBy.length) {
    // A BEHAVIOURAL element nobody has claimed. This is the refusal, not a report: an
    // element that dispatches events and belongs to no home is one the next surface can
    // emit by accident, or that a model can add and then call "new, so exempt".
    add({
      check: 'element-refused', stage: 'deliver', owner: 'pipeline', tier: 'primitives',
      component: s.file, nodeId: null, file: rel(s.path),
      what: `Defines <${tag}> and DISPATCHES ${dispatchedBy.length} event(s) — ${dispatchedBy.join(', ')} — but nothing claims it: no allowlist entry, no catalog entry, no map entry, and no source mounts or composes it. It can be added, it can ship, and no check would ever ask about it.`,
      fix: `Give it a home before it ships — an allowlist entry plus a catalog entry if a surface may emit it, a map entry if it came from the design, or a parent element that draws it. "It is new" is not one of the homes.`,
      dispatchedEvents: dispatchedBy,
    });
    continue;
  }
  add({
    check: 'element-unclaimed', stage: 'deliver', owner: 'pipeline', tier: 'primitives',
    component: s.file, nodeId: null, file: rel(s.path),
    what: `Defines <${tag}> but neither the allowlist nor the schema claims it, and the app never mounts it — nothing can render it.`,
    fix: `Add "${tag}" to the allowlist, mount it in the app, or delete the element.`,
  });
}

// ═══ DELIVER — can the element RECEIVE what the catalog promises? ══════════
// A payload prop the element does not declare is DROPPED, and the drop is nearly silent:
// the renderer's assignProps skips it and reports it to the CONSOLE only
// (a2ui-renderer.ts:128 — "an undeclared prop is reported rather than assigned
// silently"). Nothing else notices, so the value never arrives and the component draws
// its own defaults while every other check stays green.
//
// Measured 2026-09-17, and it cost the owner his afternoon: `sections` was missing from
// <prompt-section-editor>'s static properties, so the surface's
// {"sections": {"path": "/session/left_column/sections"}} was dropped on EVERY
// assignment. Every saved package drew its own empty seats; 43 rows with real content sat
// in Postgres and the screen said the database was disconnected. One declaration, and no
// check asked for it because every check read the catalog against the ALLOWLIST — which
// only names the tag — and never against the element's own property list.
//
// The catalog is where the promise is made, so the catalog is where it is checked.
checkRan('prop-undeclared');
{
  // name -> tag, as the renderer resolves it: an explicit composite alias first, then
  // the kebab of the model name, then the name itself when it is already a tag.
  const compositePairs = (() => {
    const src = read(join(ROOT, 'src/components/lit/a2ui-renderer.ts'));
    const block = src.match(/(?:const|export const)\s+COMPOSITE_MAP\b[^=]*=\s*\{([\s\S]*?)\n\};/);
    if (!block) return {};
    const out = {};
    for (const m of block[1].matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) out[m[1]] = m[2];
    return out;
  })();
  const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();
  const sourceByTag = new Map(
    SOURCES.map((s) => [definesElement(s.src), s]).filter(([t]) => t),
  );
  // Set by the renderer's own template, not by the property channel: `id` is the
  // component's address, `children` is the tree, `component` is the discriminator.
  const RENDERER_HANDLED = new Set(['component', 'children', 'id']);

  for (const [name, spec] of Object.entries(schema.components || {})) {
    // Who draws it? A component with no element of its own (a spec primitive, or one of
    // the renderer's own composites) has no property list to be held to.
    const tag = compositePairs[name]
      || (allowlistTags.has(kebab(name)) ? kebab(name) : null)
      || (allowlistTags.has(name) ? name : null);
    if (!tag) continue;
    const src = sourceByTag.get(tag);
    if (!src) continue; // no element defines it — tag-inert / element-refused say so

    const declared = new Set(
      ((src.src.match(/static properties\s*=\s*\{([\s\S]*?)\n  \};/) || [])[1] || '')
        .split('\n')
        .map((l) => (l.match(/^\s*'?([A-Za-z_$][\w$]*)'?\s*:/) || [])[1])
        .filter(Boolean),
    );

    const bound = new Set();
    for (const part of (spec.allOf || []).concat([spec])) {
      for (const prop of Object.keys(part.properties || {})) bound.add(prop);
    }

    for (const prop of bound) {
      if (RENDERER_HANDLED.has(prop) || declared.has(prop)) continue;
      add({
        check: 'prop-undeclared', stage: 'deliver', owner: 'pipeline', tier: tierOfTag(tag),
        component: tag, nodeId: null, file: rel(src.path), key: `${name}.${prop}`,
        what: `Catalog "${name}" may carry "${prop}", and <${tag}> does not declare it — the renderer DROPS it (assignProps skips undeclared props and warns to the console only), so any payload binding that property renders a component that never received the value.`,
        fix: `Declare "${prop}" in static properties of ${rel(src.path)} (add noAccessor: true when the element has a hand-written accessor), or remove "${prop}" from the "${name}" entry in catalogs/${CATALOG_NAME}/catalog.json.`,
      });
    }
  }
}

// ═══ INGEST — the pipeline's own health ════════════════════════════════════
// The annotation attribute name is untrusted; hardcoding it is forbidden.
if (existsSync(PATHS.extractor)) {
  // Inside the guard for the same reason as the primitives pair: no extractor
  // means this check never ran, which the census reports as blocking.
  checkRan('attr-hardcoded');
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

// ═══ DELIVER — do the documents still describe this catalog? ══════════════
// README §Component Catalog and IMPLEMENTATION_CONFORMANCE §4.3/R4 both state a
// component count, and both claimed that count was "asserted live ... so drift
// between catalog and docs is self-announcing". Nothing asserted anything: deps.py
// prints the number and compares it to nothing, and by the time this check existed
// the claim had already drifted from 28 to 37 — nine components, no announcement.
// The assertion belongs where the documents and the catalog are both readable, so it
// lives here, and a stale number fails the run like every other false claim.
//
// The documents describe the DEFAULT pipeline (deps.py loads prompt-composer), so
// this compares against that catalog even during an --catalog ecommerce run.
//
// A sentence that is not there cannot be false; a sentence that IS there is checked.
// A missing count or a missing list is therefore reported differently from a wrong
// one: a document that stops enumerating its catalog has lost the thing a reader can
// hold against the code, which is a regression, but it is not a lie.
checkRan('doc-claim-drift');
const countOf = (p) => { try { return Object.keys(JSON.parse(read(p)).components || {}).length; } catch { return null; } };
// Raw, on purpose: the fence that delimits the README's list is made of backticks,
// so stripping markdown anywhere near it deletes the thing being looked for. Emphasis
// is stripped at the one place it matters — the count match.
const docText = (p) => { try { return read(p); } catch { return null; } };
const catalogCount = countOf(PATHS.defaultSchema);
const docFiles = [PATHS.readme, PATHS.conformance].filter(existsSync);

if (catalogCount === null) {
  add({
    check: 'doc-claim-drift', stage: 'deliver', owner: 'pipeline', file: rel(PATHS.defaultSchema), key: 'unreadable',
    what: 'Cannot read the default pipeline\'s catalog, so the count the documents state cannot be checked against anything.',
    fix: 'Restore catalogs/prompt-composer/catalog.json.',
  });
} else {
  for (const p of docFiles) {
    const text = docText(p);
    if (text === null) continue;
    // "28 trusted components", "currently **28 trusted components**" — emphasis is
    // stripped here, so one pattern reads both forms.
    for (const m of text.replace(/[*_`]/g, '').matchAll(/(\d+)\s+trusted components/g)) {
      if (Number(m[1]) === catalogCount) continue;
      add({
        check: 'doc-claim-drift', stage: 'deliver', owner: 'pipeline', file: rel(p), key: `count:${m.index}`,
        what: `States ${m[1]} trusted components. The default pipeline's catalog defines ${catalogCount}, so this sentence describes a catalog that no longer exists.`,
        fix: `Update the number to ${catalogCount} — or fix the catalog, if the number is the one that is right.`,
      });
    }
  }
}

// The README enumerates the catalog, so the NAMES are compared as a set. A count
// alone lets a phantom survive (the list carried `featured-card`, which the catalog
// has never defined) and lets a new component arrive unannounced — neither of which
// changes the total.
if (catalogCount !== null) {
  const text = docText(PATHS.readme) || '';
  const listing = text.match(/^A2UI Basic:([\s\S]*?)```/m);
  if (!listing) {
    add({
      check: 'doc-claim-drift', stage: 'deliver', owner: 'pipeline', file: rel(PATHS.readme), key: 'list-gone',
      what: 'The README no longer enumerates the catalog, so no document states the component names a reader could hold against the catalog. The count is still checked; the names are not.',
      fix: 'Restore the fenced list in README §Component Catalog — it starts with a line `A2UI Basic:`, then names separated by ·, one block for `Workspace:` too. Or delete this check deliberately, and accept that the names are then unverified.',
    });
  } else {
    const actual = Object.keys(JSON.parse(read(PATHS.defaultSchema)).components || {});
    const stated = [...listing[1].matchAll(/[A-Za-z][A-Za-z0-9-]*/g)]
      .map((m) => m[0])
      .filter((t) => !['A2UI', 'Basic', 'Workspace'].includes(t));
    const missing = actual.filter((n) => !stated.includes(n));
    const phantom = stated.filter((n) => !actual.includes(n));
    if (missing.length || phantom.length) {
      add({
        check: 'doc-claim-drift', stage: 'deliver', owner: 'pipeline', file: rel(PATHS.readme), key: 'names',
        what: `${missing.length ? `${missing.length} component(s) the catalog defines are not listed: ${missing.join(', ')}. ` : ''}${phantom.length ? `${phantom.length} name(s) are listed that the catalog does not define: ${phantom.join(', ')}.` : ''}`.trim(),
        fix: 'Update the list in README §Component Catalog so it names the catalog exactly.',
      });
    }
    // The split sentence is optional prose, but it is a claim: when it is present it
    // has to add up. Counted by name case, which is what the two headings mean —
    // PascalCase are the A2UI Basic Catalog primitives, kebab-case the project's own.
    const basic = actual.filter((n) => /^[A-Z]/.test(n)).length;
    const lit = actual.length - basic;
    const split = text.match(/(\d+)\s+A2UI Basic Catalog primitives\s*\+\s*(\d+)\s+project-specific Lit elements/);
    if (split && (Number(split[1]) !== basic || Number(split[2]) !== lit)) {
      add({
        check: 'doc-claim-drift', stage: 'deliver', owner: 'pipeline', file: rel(PATHS.readme), key: 'split',
        what: `States ${split[1]} A2UI Basic Catalog primitives + ${split[2]} project-specific Lit elements; the catalog holds ${basic} + ${lit}.`,
        fix: `Update the split to ${basic} + ${lit}.`,
      });
    }
  }
}

// ═══ DELIVER — the register of what is still open ══════════════════════════
// The numbers this project quotes at each other lived in a file git could not see
// (`ignore-this-work-catalog-audit/`, excluded locally): `git status` never showed it
// as changed, so nothing ever prompted an update, a clone did not have it at all, and
// its counts had drifted — `event-unheard` 17→12, `tag-inert` 9→8, `element-unclaimed`
// 3→0 — while the file still stated the old ones. It is now OPEN-ITEMS.md at the
// repository root, tracked, and this check is what keeps it honest, because "someone
// will notice" is not a mechanism:
//
//   · every check in CHECK_INVENTORY has exactly one ledger row, so a new check
//     cannot be added without accounting for it;
//   · the `Recorded` count of every class IS the count this run derived;
//   · every `#NNN` cited in a tracked document (README, INDEX, the conformance doc,
//     this journal, the change log) resolves to a row;
//   · the one class whose count is a property of the machine rather than the tree
//     records `—`, and no other class may — deleting a stale number is how a stale
//     number hides (see ENV_SCOPED below);
//   · the register is present, tracked, and not excluded by a rule — the failure
//     that started all this.
//
// Structural faults block: the register and the run contradict each other, and one of
// the two is lying. The count comparison is written for ONE catalog — the register is
// scoped to the pipeline `deps.py` loads, so an `--catalog ecommerce` run checks the
// register's structure without failing on the other catalog's numbers.
checkRan('open-items-register');
const REGISTER_STATUSES = new Set(['open', 'decided', 'in-progress', 'watching', 'closed']);
const REGISTER_OWNERS = new Set(['pipeline', 'designer', 'both']);
// The one class whose count is a property of the MACHINE, not the tree. It counts whether
// Figma answered: 0 with a token, 1 without. Recording a number for it makes a run RED for
// something no reader can fix — found by running this check in a fresh clone, where it read 0
// against a run that derived 1. Such a class records `—` instead, and `—` is allowed for
// EXACTLY this set: anywhere else it would be a way to hide a stale number by deleting it,
// which is the failure this ledger exists to stop. The set can only grow deliberately, and a
// new environment-scoped class cannot hide — the first offline run reports the mismatch.
const ENV_SCOPED = new Set(['check-could-not-run']);
const onDefaultPipeline = PATHS.schema === PATHS.defaultSchema;
const registerFile = rel(PATHS.openItems);
const registerText = (() => { try { return read(PATHS.openItems); } catch { return null; } })();

// The counts are compared at the END of this file, not here — deliberately. `findings`
// is appended to as the script executes, so a comparison written at this point would
// run before the live Figma checks have raised anything, and would report every one of
// their classes as "the register records 7, this run derives 0". That is the same trap
// as a half-built report reading clean; the fix is order, not a special case.
let registerRows = [];
/** Open findings for one class — `pass` entries are not findings, by definition. */
const liveOf = (cls) => findings.filter((f) => f.check === cls && f.level !== 'pass').length;
function compareRegisterCounts() {
  if (!onDefaultPipeline || !registerRows.length) return;
  // A class whose check needs Figma cannot be compared on a run that skipped Figma:
  // its count would read 0 for a reason that is not a fix, and the ledger would be
  // accused of being stale for it. (`--offline`, or no token — the same "half-built
  // run" trap this function already moved to the end of the file to avoid.)
  const uncomparable = [];
  for (const r of registerRows) {
    if (!r.id.startsWith('check:')) continue;
    const cls = r.id.slice(6);
    // This check reports on the register itself; comparing its own count would be
    // circular — its findings ARE the signal.
    if (cls === 'open-items-register') continue;
    // `—` rows are the environment-scoped ones (see ENV_SCOPED): there is no number to
    // compare, and their absence from the comparison is reported below rather than
    // passed over in silence.
    if (!/^\d+$/.test(r.recorded)) { uncomparable.push(cls); continue; }
    const inventory = CHECK_INVENTORY.find((c) => c.id === cls);
    if (inventory && inventory.live && liveStatus !== 'complete') { uncomparable.push(cls); continue; }
    const recorded = Number(r.recorded);
    const live = liveOf(cls);
    if (recorded === live) continue;
    add({
      check: 'open-items-register', stage: 'deliver', owner: 'pipeline', file: registerFile, key: `count:${cls}`,
      what: `${cls}: the register records ${recorded}, this run derives ${live}. A number nobody re-measures is how 28 stayed in the README while the catalog held 37.`,
      fix: live === 0
        ? `The thing that derived this stopped deriving it: ${cls} → 0. Set the count to 0 and close (or re-class) the row.`
        : `Set the recorded count to ${live}, or fix what changed it.`,
    });
  }
  if (uncomparable.length) {
    const live_ = uncomparable.filter((c) => (CHECK_INVENTORY.find((i) => i.id === c) || {}).live);
    const env = uncomparable.filter((c) => !live_.includes(c));
    const parts = [];
    if (live_.length) parts.push(`${live_.join(', ')} need Figma and did not run`);
    if (env.length) parts.push(`${env.join(', ')} is recorded \`—\` because its count is a property of the machine`);
    add({ check: 'open-items-register', stage: 'deliver', owner: 'pipeline', file: registerFile, level: 'pass',
      what: `${parts.join('; ')}, so their recorded counts (${registerFile}) were not compared to anything in this run.` });
  }
}

if (registerText === null) {
  add({
    check: 'open-items-register', stage: 'deliver', owner: 'pipeline', file: registerFile, key: 'gone',
    what: 'The register is not where it is read from, so every number quoted from it — in commits, in documents, in review — resolves to nothing.',
    fix: `Restore ${registerFile} at the repository root, and keep it somewhere git can see.`,
  });
} else {
  // The ledger table only: a row whose first cell is `check:<class>` or `#NNN`. The
  // prose tables (the retired numbers) are deliberately not parsed — a register is
  // checked where it is machine-readable.
  const rows = registerText.split('\n')
    .filter((l) => /^\|\s*`?(?:check:[a-z0-9-]+|#\d{3})`?\s*\|/.test(l))
    .map((l) => {
      const c = l.split('|').slice(1, -1).map((x) => x.trim().replace(/`/g, ''));
      return { id: c[0], status: c[1], owner: c[2], recorded: c[4], witness: c[5] || '' };
    });
  const ids = new Set(rows.map((r) => r.id));

  if (!rows.length) {
    add({
      check: 'open-items-register', stage: 'deliver', owner: 'pipeline', file: registerFile, key: 'table-unreadable',
      what: 'The register exists but no ledger row parsed. The six-column table is its machine-readable half; without it this file is prose that nothing can be held against.',
      fix: 'Restore the ledger table: | ID | Status | Owner | What it is | Recorded | Witness |.',
    });
  }

  // Handed to compareRegisterCounts(), which runs at the end of the file.
  registerRows = rows;
  if (!onDefaultPipeline) {
    add({ check: 'open-items-register', stage: 'deliver', owner: 'pipeline', file: registerFile, level: 'pass',
      what: `${registerFile} is scoped to the default pipeline, so an --catalog ${CATALOG_NAME} run checks its structure but does not hold its counts against this catalog.` });
  }

  const duplicated = [...ids].filter((id) => rows.filter((r) => r.id === id).length > 1);
  if (duplicated.length) {
    add({
      check: 'open-items-register', stage: 'deliver', owner: 'pipeline', file: registerFile, key: 'duplicate',
      what: `${duplicated.join(', ')} carry more than one ledger row. Two rows for one thing is the register contradicting itself about its own status.`,
      fix: 'One row per id. A second row means the first one was not updated.',
    });
  }

  const unknown = rows.filter((r) => r.id.startsWith('check:') && !CHECK_INVENTORY.some((c) => c.id === r.id.slice(6)));
  if (unknown.length) {
    add({
      check: 'open-items-register', stage: 'deliver', owner: 'pipeline', file: registerFile, key: 'unknown-class',
      what: `${unknown.map((r) => r.id).join(', ')} name check classes this script does not run, so a reader would think they are being watched.`,
      fix: 'Correct the class name, or add the check to CHECK_INVENTORY.',
    });
  }

  const unaccounted = CHECK_INVENTORY.filter((c) => !ids.has(`check:${c.id}`));
  if (unaccounted.length) {
    add({
      check: 'open-items-register', stage: 'deliver', owner: 'pipeline', file: registerFile, key: 'unaccounted',
      what: `The script runs ${unaccounted.length} check(s) the register does not account for: ${unaccounted.map((c) => c.id).join(', ')}. Nothing here says whether what they find is being tracked.`,
      fix: 'Add a ledger row for each — open, decided, or watching.',
    });
  }

  for (const r of rows) {
    if (!REGISTER_STATUSES.has(r.status)) {
      add({ check: 'open-items-register', stage: 'deliver', owner: 'pipeline', file: registerFile, key: `status:${r.id}`,
        what: `${r.id} has status "${r.status}", which is not one of ${[...REGISTER_STATUSES].join(' / ')}.`,
        fix: 'Use the vocabulary, or extend it here so the meaning lives in one place.' });
    }
    if (!REGISTER_OWNERS.has(r.owner)) {
      add({ check: 'open-items-register', stage: 'deliver', owner: 'pipeline', file: registerFile, key: `owner:${r.id}`,
        what: `${r.id} is owned by "${r.owner}", which is nobody: the register cannot say who closes it.`,
        fix: 'pipeline, designer, or both.' });
    }
    // The closure rule, enforced: an entry that cannot name the check which would
    // retire it has to say why none is possible. That sentence is the difference
    // between an item and a wish.
    if (!/check:[a-z0-9-]+/.test(r.witness) && !/no check/i.test(r.witness)) {
      add({ check: 'open-items-register', stage: 'deliver', owner: 'pipeline', file: registerFile, key: `witness:${r.id}`,
        what: `${r.id} does not name the check that would close it, and does not say why no check is possible.`,
        fix: 'Name the check, or write "no check is possible" and the reason.' });
    }
    if (r.id.startsWith('check:')) {
      const cls = r.id.slice(6);
      if (ENV_SCOPED.has(cls)) {
        // Required to stay `—`: a number here is a claim about the machine that wrote
        // it, not about this tree.
        if (r.recorded !== '—') {
          add({ check: 'open-items-register', stage: 'deliver', owner: 'pipeline', file: registerFile, key: `recorded:${r.id}`,
            what: `${r.id} records "${r.recorded}". This class counts whether the environment answered, so the number is about the machine, not the tree — it is 0 with a Figma token and 1 without.`,
            fix: 'Record `—`, and say why in the Witness column.' });
        }
      } else if (!/^\d+$/.test(r.recorded)) {
        add({ check: 'open-items-register', stage: 'deliver', owner: 'pipeline', file: registerFile, key: `recorded:${r.id}`,
          what: `${r.id} records its count as "${r.recorded}", so there is nothing to hold against the run. This class is compared on every run, so \`—\` would hide whatever it stopped deriving.`,
          fix: 'Put the number of open findings this class derives, as a plain integer.' });
      }
    }
  }

  // The per-class count comparison used to live here. It moved to the end of the run
  // (compareRegisterCounts) because at this point the live Figma checks have not run —
  // see the note where that function is declared.


  // A `#NNN` a document cites is a claim that the thing is registered. One that
  // resolves to nothing is the same defect as a document stating a false count. The
  // change log is in this list because it is where a new number is most likely to be
  // written down first — and the least likely to be typed into a test.
  const dangling = new Set();
  for (const p of [PATHS.readme, PATHS.index, PATHS.conformance, PATHS.notes, PATHS.changelog].filter(existsSync)) {
    let text; try { text = read(p); } catch { continue; }
    for (const m of text.matchAll(/#(\d{3})(?![0-9])/g)) if (!ids.has(`#${m[1]}`)) dangling.add(`#${m[1]} in ${rel(p)}`);
  }
  if (dangling.size) {
    add({ check: 'open-items-register', stage: 'deliver', owner: 'pipeline', file: registerFile, key: 'dangling-citation',
      what: `Cited but not registered: ${[...dangling].join(', ')}.`,
      fix: 'Give it a ledger row, or correct the citation — a number that resolves to nothing is worse than no number.' });
  }

  // ── THE REGISTER IS LOCAL-ONLY NOW, AND THE GUARD IS THE NUMBERS ───────────
  //
  // This used to assert that OPEN-ITEMS.md was tracked by git and matched by no
  // ignore rule, on the grounds that a register git cannot see is one whose counts
  // drift unnoticed — which is exactly how it happened before. The owner has decided
  // the registers and the catalog audit are not published (2026-09-17: TO-DO.md,
  // OPEN-ITEMS.md, CORRECTIONS.md and catalog-audit/ are local), so visibility to git
  // is no longer something this script can require.
  //
  // The guard that actually catches drift is untouched and is the one above: every
  // count the register records is compared against the count this run derives, and a
  // disagreement fails the build. That mechanism never depended on git.
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

if (OFFLINE || !token) {
  // Figma is an import tool, not a runtime dependency: the catalogue is assembled
  // from the Lit sources, and the live Figma checks (node addresses, annotations)
  // are optional. No token (production) or --offline skips them and reports
  // INCOMPLETE — deliberately NOT a blocking finding.
  liveStatus = 'partial';
} else {
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeIds.join(',')}`, { headers: { 'X-Figma-Token': token } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // The live checks ran: mark all four HERE, so a failed fetch leaves them
    // un-run — and then the census and the check-could-not-run finding say so,
    // instead of the report claiming "no annotations" about a file nobody read.
    checkRan('node-unresolved');
    checkRan('annotation-missing');
    checkRan('annotation-prose');
    checkRan('annotation-on-placement');
    checkRan('geometry-drift');

    // ── AN INSTANCE CARRIES NO ANNOTATION: RESOLVE TO THE COMPONENT IT PLACES ──
    //
    // The registry addresses a node, and the annotation belongs to the thing that node is
    // an instance OF. Reading `node.annotations` on a placement reads an empty list, so a
    // properly annotated component reports as unannotated — and a spec written on a
    // placement is accepted, where nothing downstream can find it. Figma's node endpoint
    // returns only the ids asked for, so the components the placements point at are a
    // second request, once per run.
    const placedComponentIds = [...new Set(
      Object.values(data.nodes || {})
        .map((n) => n.document)
        .filter((d) => d && d.type === 'INSTANCE' && d.componentId)
        .map((d) => d.componentId),
    )];
    let masterNodes = {};
    if (placedComponentIds.length) {
      try {
        const mres = await fetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${placedComponentIds.join(',')}`, { headers: { 'X-Figma-Token': token } });
        if (mres.ok) masterNodes = (await mres.json()).nodes || {};
      } catch (e) {
        // The annotation then reads as absent, and the finding says which master could
        // not be read rather than claiming the master is bare.
        console.error(`[catalog-check] component fetch failed (${placedComponentIds.length} ids): ${e.message}`);
      }
    }
    const annText = (n) => (n?.annotations || []).map((a) => a.labelMarkdown || a.label || '').filter(Boolean).join('\n');
    const masterOf = (n) => (n && n.componentId ? masterNodes[n.componentId]?.document : undefined);

    /**
     * Where the spec actually is. In order: the node itself, the component an instance
     * places, the first variant of a set that carries one. `via` is reported so a finding
     * can say where it looked, and `specOnPlacement` is the case that blocks: the node is
     * an instance, the instance is annotated, and the master is not.
     */
    const readAnnotation = (node, id) => {
      const own = annText(node);
      const master = masterOf(node);
      if (own.trim()) {
        return {
          text: own, from: id, via: 'node',
          specOnPlacement: node.type === 'INSTANCE' && !annText(master).trim(),
          masterId: node.componentId || null,
        };
      }
      if (node.type === 'INSTANCE' && node.componentId) {
        const mt = annText(master);
        if (mt.trim()) return { text: mt, from: node.componentId, via: 'master' };
        return { text: '', from: node.componentId, via: 'master-missing' };
      }
      // A component SET carries no note either; its variants do.
      const variant = (node.children || []).find((ch) => annText(ch).trim());
      if (variant) return { text: annText(variant), from: variant.id, via: 'variant' };
      return { text: '', from: null, via: 'none' };
    };
    // ── The node is the subject ────────────────────────────────────────────
    // Every finding in this loop is about ONE NODE, and two registry rows can
    // resolve to one component file (#024: `functions` and `prompt-input-section`
    // both resolve to `prompt-input-section.ts`). The id is assembled from the
    // component alone, so both nodes' findings arrived under one id — and these are
    // NOT the same statement: each names its own node. Pass the node as `key`; it is
    // what makes them different. (The same collision under `provenance-missing` is
    // not a key problem: there the subject is the file, so it is counted once.)
    for (const c of figmaMap.components) {
      const id = c.figmaNodeId;
      if (!id) continue;
      const node = data.nodes?.[id]?.document;
      if (!node) {
        add({ check: 'node-unresolved', stage: 'ingest', owner: 'pipeline', component: c.litComponent, nodeId: id, key: id, file: c.file, what: `Address ${id} is not in the file. The pull returns nothing, so this component reports as "no annotation" when really the address is dead.`, fix: 'Point the registry at the component\u2019s real node id.' });
        continue;
      }
      const ann = readAnnotation(node, id);
      const where = ann.via === 'master' ? ` (read from the component it places, ${ann.from})`
        : ann.via === 'variant' ? ` (read from its variant ${ann.from})`
        : '';
      if (!ann.text.trim()) {
        const masterNote = ann.via === 'master-missing'
          ? `, and neither does the component it places (${ann.from})`
          : '';
        add({ check: 'annotation-missing', stage: 'gap', owner: 'designer', component: c.litComponent, nodeId: id, key: id, file: c.file, what: `Node ${id} ("${node.name}", ${node.type}) resolves but carries no annotation${masterNote}.`, fix: `Annotate the MASTER in Figma — a placement carries no annotation. Template: FIGMA/ANNOTATION_FIGMA_GUIDE.md`, dispatchedEvents: dispatchNames(c.litComponent) });
      } else if (ann.specOnPlacement) {
        // THE SPEC IS ON A PLACEMENT. The node is an instance, the instance is annotated,
        // and the component it places is not — so the behaviour was written somewhere the
        // component cannot carry it: the next placement of that component, and every reader
        // of its master, sees nothing. Blocking, because accepting it lets a control into
        // the catalogue on a note that is not attached to the control.
        add({
          check: 'annotation-on-placement', stage: 'ingest', owner: 'pipeline',
          component: c.litComponent, nodeId: id, key: id, file: c.file,
          what: `Node ${id} ("${node.name}", ${node.type}) is a PLACEMENT and it carries the annotation, while the component it places (${ann.masterId}) carries none. A spec on a placement belongs to one use of the component, not to the component.`,
          fix: `Move the annotation to the master (${ann.masterId}) in Figma and leave the placement bare.`,
          dispatchedEvents: dispatchNames(c.litComponent),
        });
      } else if (!isStructured(ann.text)) {
        add({ check: 'annotation-prose', stage: 'gap', owner: 'designer', component: c.litComponent, nodeId: id, key: id, file: c.file, what: `Node ${id}${where} has a note, but it is prose, not a spec — so behaviour must be invented. "${ann.text.slice(0, 90)}${ann.text.length > 90 ? '…' : ''}"`, fix: 'Rewrite using the field format (Data / On click / State / A11y).', dispatchedEvents: dispatchNames(c.litComponent) });
      }

      // ── Geometry convergence ────────────────────────────────────────────
      // A component's numbers live in two places: the Figma node (authoring) and
      // the code that renders it. When they disagree nothing says so — the code
      // holds a constant that has quietly stopped matching the design, and the
      // only way to notice is to look at both side by side, which nobody does.
      //
      // This check compares what the NODE says against what the entry DECLARES the
      // code renders, and reports the difference. It does not pick a winner: a
      // drift is a question for whoever owns the design, not something the
      // pipeline gets to settle.
      //
      // Only components that belong to a CONTAINER are checked — one that declares
      // a geometry constraint the catalogue insists on. Everything else cannot
      // drift, because there is nothing to drift from.
      //
      // The constraint is read from the CONTAINER, not from the component: a rail
      // button's numbers are a property of the rail. That is what keeps ingestion
      // free to be messy while the catalogue stays consistent — the node is
      // compared against the container, so a hand-placed node reports as drift
      // instead of silently becoming the new truth.
      const container = c.container ? figmaMap.containers?.[c.container] : null;
      const declared = container?.geometry || (c.declared && c.declared.geometry);
      const declaredWhere = container?.definedIn || (c.declared && c.declared.source) || 'the registry';
      if (declared) {
        const r1 = (n) => Math.round(n * 10) / 10;
        const frame = (node.children || []).find((n) => n.type === 'FRAME') || node;
        const kids = frame.children || [];
        const iconNode = kids.find((n) => n.type === 'RECTANGLE' || n.type === 'INSTANCE' || n.type === 'VECTOR');
        const labelNode = kids.find((n) => n.type === 'TEXT');
        const box = (n) => (n && n.absoluteBoundingBox) ? {
          x: r1(n.absoluteBoundingBox.x - frame.absoluteBoundingBox.x),
          y: r1(n.absoluteBoundingBox.y - frame.absoluteBoundingBox.y),
          w: r1(n.absoluteBoundingBox.width),
          h: r1(n.absoluteBoundingBox.height),
        } : null;
        const actual = {
          button: frame.absoluteBoundingBox ? { w: r1(frame.absoluteBoundingBox.width), h: r1(frame.absoluteBoundingBox.height) } : null,
          icon: box(iconNode),
          label: box(labelNode),
        };
        const drifts = [];
        for (const part of ['button', 'icon', 'label']) {
          const want = declared[part];
          const got = actual[part];
          if (!want || !got) continue;
          for (const prop of Object.keys(want)) {
            // 0.5px tolerance: sub-pixel differences are rounding, not intent.
            if (Math.abs(want[prop] - got[prop]) > 0.5) {
              drifts.push(`${part}.${prop} — node ${got[prop]}, code ${want[prop]}`);
            }
          }
        }
        if (drifts.length) {
          add({ check: 'geometry-drift', stage: 'deliver', owner: 'pipeline', component: c.litComponent, nodeId: id, key: id, file: c.file, what: `Node ${id} and the rendered button disagree (${drifts.join('; ')}). The constraint is ${declaredWhere}.`, fix: 'Either the node moves to the constraint, or the constraint changes once — in the catalogue, not in this component. Both are answers; silently keeping two sets of numbers is not.' });
        }
      }
    }
  } catch (e) {
    // Figma is optional (see above): a failed fetch skips the live checks and
    // reports INCOMPLETE, not blocking.
    liveStatus = 'partial';
  }
}

// ═══ CLEAN — what passes, so the readout shows when things get fixed ═══════
checkRan('clean-no-jsx');
const dirty = SOURCES.filter((s) => /className=|import React|useState/.test(s.src));
if (!dirty.length) {
  findings.push({ id: 'clean:no-jsx', check: 'clean-no-jsx', stage: 'clean', owner: 'pipeline', level: 'pass', component: null, nodeId: null, file: null, what: `No React, no JSX, no Tailwind in any of the ${SOURCES.length} component sources.`, fix: null });
}

// ═══ CENSUS — did every check actually run? ════════════════════════════════
// The report used to answer this by accident: `checks` was the set of check names
// present in the findings, so a check that ran clean and a check that never ran
// were both simply ABSENT, and the six that can vanish (primitive-missing,
// primitive-drift, schema-unreachable, container-undeclared, node-unresolved,
// check-could-not-run) could have been broken for months with an identical readout.
//
// A census check is its own implementation, so it marks itself as run. A NON-live
// check that did not run is a blocking finding: this script skipped a question it
// claims to ask. Live checks that did not run are reported as INCOMPLETE —
// --offline and a missing (or unreachable) Figma token both declare that on
// purpose: Figma is an import tool, not a runtime dependency.
// ═══ DELIVER — the corrections ledger ═══════════════════════════════════════
// A correction is a CLAIM: "this finding was fixed." A claim is only worth
// recording if it can fail, so every row is held against the run it is part of:
//
//   check:<class>            earned when the class derives ZERO open findings
//   check:<class>:<subject>  earned when NO finding in this run carries that exact id
//
// A row that is NOT earned is the one thing the register cannot express: a finding
// that was corrected and is here anyway. In the register that reads as a count that
// went back up — indistinguishable from work never done. Here it is a regression,
// named, with the commit that used to hold the fix. Blocking, like every other
// ledger-integrity failure: the record is either true or it is noise.
//
// Last, for the same reason as compareRegisterCounts(): every finding has to exist
// before a row can be held against it.
checkRan('corrections-ledger');
{
  const ledgerFile = rel(PATHS.corrections);
  let ledgerText = null;
  try { ledgerText = read(PATHS.corrections); } catch { ledgerText = null; }

  if (ledgerText === null) {
    add({
      check: 'corrections-ledger', stage: 'deliver', owner: 'pipeline', file: ledgerFile, key: 'gone',
      what: 'The corrections ledger is not where it is read from. Every "this was fixed" then resolves to nothing, and a fix that regressed is discovered by a person noticing.',
      fix: `Restore ${ledgerFile} at the repository root.`,
    });
  } else {
    // Only ledger rows: a table row whose first cell is check:<class> or
    // check:<class>:<subject>. Prose is deliberately not parsed — which is why the
    // doctrine table in that file uses a placeholder that cannot match this.
    const rows = ledgerText.split('\n')
      .filter((l) => l.trim().startsWith('|'))
      .map((l) => l.split('|').slice(1, -1).map((x) => x.trim().replace(/`/g, '')))
      .filter((c) => /^check:[a-z0-9-]+(:.+)?$/.test(c[0]))
      .map((c) => ({ finding: c[0], corrected: c[1] || '', receipt: c[2] || '' }));

    if (!rows.length) {
      add({
        check: 'corrections-ledger', stage: 'deliver', owner: 'pipeline', file: ledgerFile, key: 'table-unreadable',
        what: 'The ledger exists but no row parsed. The table is its machine-readable half; without it this file is prose that nothing can be held against.',
        fix: 'Restore the ledger table: | Finding | Corrected | Receipt | Witness |.',
      });
    }

    const uncompared = [];
    const seen = new Set();
    for (const r of rows) {
      const tail = r.finding.slice('check:'.length);
      const cls = tail.split(':')[0];
      const hasSubject = tail.includes(':');

      if (!CHECK_INVENTORY.some((c) => c.id === cls)) {
        add({
          check: 'corrections-ledger', stage: 'deliver', owner: 'pipeline', file: ledgerFile, key: `unknown-class:${r.finding}`,
          what: `The ledger records a correction for "${r.finding}", and "${cls}" is not a check this script knows. A citation to a check that does not exist cannot fail, so it cannot prove anything.`,
          fix: 'Correct the class, or add it to CHECK_INVENTORY.',
        });
        continue;
      }

      if (seen.has(r.finding)) {
        add({
          check: 'corrections-ledger', stage: 'deliver', owner: 'pipeline', file: ledgerFile, key: `duplicate:${r.finding}`,
          what: `The ledger records "${r.finding}" more than once. Two rows for one finding means one is stale, and nothing says which.`,
          fix: 'Keep one row per finding, with the latest receipt.',
        });
      }
      seen.add(r.finding);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.corrected)) {
        add({
          check: 'corrections-ledger', stage: 'deliver', owner: 'pipeline', file: ledgerFile, key: `bad-date:${r.finding}`,
          what: `"${r.finding}" dates its correction "${r.corrected}", which is not YYYY-MM-DD. A date nobody can read is a date nobody can hold against a commit.`,
          fix: 'Date it YYYY-MM-DD.',
        });
      }

      // The receipt is what separates "it was fixed" from "it is fixed". Only the
      // second can be checked, and only a commit can be looked at.
      const sha = (r.receipt.match(/\b[0-9a-f]{7,40}\b/) || [])[0];
      if (!sha) {
        add({
          check: 'corrections-ledger', stage: 'deliver', owner: 'pipeline', file: ledgerFile, key: `no-receipt:${r.finding}`,
          what: `"${r.finding}" names no commit. Without one there is nothing to look at, and a correction nobody can look at is a note.`,
          fix: 'Cite the commit that carries the fix.',
        });
      } else if (existsSync(join(REPO, '.git'))) {
        try {
          execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: REPO, stdio: 'pipe' });
        } catch {
          add({
            check: 'corrections-ledger', stage: 'deliver', owner: 'pipeline', file: ledgerFile, key: `receipt-unresolved:${r.finding}`,
            what: `"${r.finding}" cites ${sha}, and no commit in this repository answers to it. The receipt is the whole reason this ledger is trusted.`,
            fix: 'Cite a commit that resolves, or drop the row.',
          });
        }
      }

      // A class whose check needs Figma cannot be judged on a run that skipped Figma.
      // Its 0 is an ABSENCE, not a fix, and calling the row earned would be a claim
      // this run cannot support — the same "half-built report reading clean" trap
      // compareRegisterCounts already refuses. Reported as uncompared, not passed over
      // in silence.
      const inv = CHECK_INVENTORY.find((c) => c.id === cls);
      if (inv && inv.live && liveStatus !== 'complete') {
        uncompared.push(r.finding);
        continue;
      }

      // ── The one that matters ─────────────────────────────────────────────
      const earned = hasSubject
        ? !findings.some((f) => f.id === r.finding)
        : liveOf(cls) === 0;
      if (!earned) {
        add({
          check: 'corrections-ledger', stage: 'deliver', owner: 'pipeline', file: ledgerFile, key: `not-earned:${r.finding}`,
          what: `"${r.finding}" is recorded corrected on ${r.corrected} (${sha || 'no receipt'}) and this run derives it again${hasSubject ? '' : ` — ${liveOf(cls)} open finding(s) in ${cls}`}. A correction that does not hold is a regression wearing a fixed label, and a count cannot show it: the number simply goes back up.`,
          fix: 'Fix it again and update the receipt, or drop the row if the finding was never closed.',
        });
      }
    }

    if (uncompared.length) {
      add({
        check: 'corrections-ledger', stage: 'deliver', owner: 'pipeline', file: ledgerFile, level: 'pass',
        what: `${uncompared.length} correction(s) were not judged this run because their checks need Figma and Figma was not reached (${uncompared.join(', ')}). Neither earned nor refuted here — the next complete run decides.`,
      });
    }
  }
}

// The register's recorded counts, held against what this run actually derived. Last,
// on purpose: every finding has to exist before the ledger can be compared to it.
compareRegisterCounts();
checkRan('check-could-not-run');
const notRun = CHECK_INVENTORY.filter((c) => !c.live && !ran.has(c.id));
const skippedLive = CHECK_INVENTORY.filter((c) => c.live && !ran.has(c.id));
const cleanChecks = CHECK_INVENTORY.filter(
  (c) => ran.has(c.id) && !findings.some((f) => f.check === c.id && f.level !== 'pass'),
);
if (notRun.length) {
  add({
    check: 'check-could-not-run', stage: 'ingest', owner: 'pipeline',
    file: rel(join(ROOT, 'scripts', 'catalog-check.mjs')), key: 'census',
    what: `${notRun.length} check(s) did not run at all: ${notRun.map((c) => c.id).join(', ')}. Nothing in this report says whether they passed, because nothing asked.`,
    fix: 'Fix the check itself — a check that produced no output is not a check that passed.',
  });
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
  // The denominator, next to the tally. `blocking` is the only count that decides
  // the exit code; the rest is a work list.
  checksKnown: CHECK_INVENTORY.length,
  checksRan: ran.size,
  checksDidNotRun: CHECK_INVENTORY.length - ran.size,
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
  // `checks` is unchanged: the checks that RAISED something. The census is the
  // honest inventory — every check this script knows, whether it ran, and what it
  // found — so "ran and passed" can never read as "never ran" again.
  checks: [...new Set(findings.map((f) => f.check))].sort(),
  checksKnown: CHECK_INVENTORY.length,
  checksRan: ran.size,
  checkCensus: CHECK_INVENTORY.map((c) => ({
    id: c.id,
    stage: c.stage,
    live: c.live,
    asserts: c.asserts,
    ran: ran.has(c.id),
    findings: findings.filter((f) => f.check === c.id && f.level !== 'pass').length,
    passed: findings.filter((f) => f.check === c.id && f.level === 'pass').length,
  })),
  findings,
};

mkdirSync(dirname(PATHS.out), { recursive: true });
writeFileSync(PATHS.out, JSON.stringify(report, null, 2) + '\n');

const pad = (s, w) => String(s).padEnd(w);
const lines = [];
lines.push(`CATALOG CHECK — ${CATALOG_NAME} — ${report.status.toUpperCase()}`);
lines.push('='.repeat(64));
lines.push(`  open ${counts.total}   ·   pipeline ${counts.pipeline}   ·   designer ${counts.designer}   ·   blocking ${counts.blocking}`);
// The denominator. Without this line a check that never ran is invisible: it
// produces no row below, which is exactly what a check that passed produces.
lines.push(`  checks ${ran.size}/${CHECK_INVENTORY.length} ran   ·   ${cleanChecks.length} ran clean   ·   ${notRun.length + skippedLive.length} did not run`);
if (cleanChecks.length) lines.push(`  ✓ ran clean: ${cleanChecks.map((c) => c.id).join(', ')}`);
if (skippedLive.length) lines.push(`  · skipped (live): ${skippedLive.map((c) => c.id).join(', ')}${OFFLINE ? ' — declared by --offline' : ''}`);
if (notRun.length) lines.push(`  ✖ did not run: ${notRun.map((c) => c.id).join(', ')}`);
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
// The verdict, not the tally. GREEN means "every check that should have run did,
// and nothing blocking was found" — it does NOT mean the catalog is clean. The
// advisory findings are a work list owned by people, and they are printed above.
if (counts.blocking) {
  lines.push(`VERDICT: RED — ${counts.blocking} blocking finding(s)${notRun.length ? `, ${notRun.length} check(s) that never ran` : ''}.`);
} else if (report.status === 'partial') {
  lines.push(`VERDICT: INCOMPLETE — ${counts.total} advisory finding(s), ${skippedLive.length} live check(s) skipped. Not a clean result.`);
} else {
  lines.push(`VERDICT: GREEN — ${ran.size} checks ran; ${counts.total} advisory finding(s) remain, all owned by a person.`);
}
lines.push(`report → ${rel(PATHS.out)}`);
console.log(lines.join('\n'));

// A check that produced nothing at all is a broken check, not a clean catalog.
if (!findings.length) {
  console.error('\n[catalog-check] FAIL: zero findings of any kind. The matcher or the paths are wrong — not a perfect catalog.');
  process.exit(1);
}

// ── The exit contract ──────────────────────────────────────────────────────
// This is what makes a green exit mean something. The script used to finish 0 no
// matter what it found, so its exit code only ever said "the script ran" — a red
// report and a clean one were the same result to anything downstream. Blocking
// findings now fail the run; advisory ones do not, on purpose.
if (counts.blocking) {
  console.error(`\n[catalog-check] FAIL: ${counts.blocking} blocking finding(s)${notRun.length ? `, ${notRun.length} check(s) did not run` : ''}. Advisory findings do not fail the run; these do.`);
  process.exit(1);
}
