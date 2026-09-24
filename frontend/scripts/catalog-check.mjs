#!/usr/bin/env node
/**
 * catalog-check.mjs — THE CATALOG AUDIT, RESTORED.
 *
 * WHAT THIS IS. It compares three declarations that are supposed to be one fact — the catalog
 * (`src/components/A2UI/catalogs/prompt-composer/catalog.json`), the tag registry
 * (`src/shared/tag-registry.ts`), and the elements themselves — and writes what it measured to
 * `frontend/catalog-audit/prompt-composer.json`, which is what `GET /api/catalog/audit` serves
 * and what the chat rail's findings marker reads.
 *
 * WHY IT IS BACK, and why it was absent. The previous checker was deleted from the project
 * (the audit and `catalog:check` both went with it), so this endpoint answered
 * `CATALOG_AUDIT_UNAVAILABLE` — "No audit report … This is NOT a clean result" — and nothing
 * checked the drift that then accumulated: measured 2026-09-23, `AgentCanvas.children`
 * declared `{flow, seat}` while the element renders `{header, flow, footer}` and no seat slot
 * at all, so the application's OWN payload was invalid against its OWN catalog and nothing
 * said so.
 *
 * WHAT IT DOES NOT CHECK, stated rather than implied: the Figma-side checks (node provenance,
 * annotations against the design file, the `nodeId`s the old report carried) are NOT here —
 * they need the design file and an API token, and a check that cannot run must not report a
 * pass. The report is written `status: "partial"` for that reason, which the shell already
 * understands as "ran, minus Figma" (shared/catalogHealth.ts).
 *
 * RUN: `npm run catalog:check` (writes the report; exits non-zero when anything is BLOCKING).
 */
import { readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(FRONTEND, '..');
const CATALOG_NAME = 'prompt-composer';
const CATALOG_PATH = join(FRONTEND, 'src', 'components', 'A2UI', 'catalogs', CATALOG_NAME, 'catalog.json');
const ELEMENTS_DIR = join(FRONTEND, 'src', 'components', 'lit');
const REPORT_DIR = join(FRONTEND, 'catalog-audit');

/**
 * THE SOURCES THAT NAME COMPONENTS, and why exactly these two.
 *
 * A component name is emitted in a place the app OWNS: the four surface trees the server builds
 * (backend/routes/ai.py) and the canvas composition the shell performs on a Run
 * (pages/WritingAreaIndex.tsx). Reading those is how this check measures what the app actually
 * sends, rather than trusting either declaration to describe itself.
 */
const SOURCES = [
  { file: join(REPO, 'backend', 'routes', 'ai.py'), quote: '"' },
  { file: join(FRONTEND, 'src', 'pages', 'WritingAreaIndex.tsx'), quote: "'" },
];

/** The docs that make a COUNT of the catalog, checked against the catalog itself. */
const COUNT_CLAIMS = [
  join(REPO, 'README.md'),
  join(REPO, 'READ-ME', 'IMPLEMENTATION_CONFORMANCE.md'),
];

const findings = [];
const add = (f) => findings.push({
  nodeId: null,
  component: null,
  file: null,
  fix: null,
  ...f,
});

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(p));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

/**
 * TYPESCRIPT, LOADED AS A MODULE — not parsed by regex.
 *
 * Node cannot import these directly; esbuild (already here for Vite) does the one transform
 * needed and hands back real ESM. Parsing them with a regex would make this checker a second
 * declaration of their syntax, which is exactly the failure it exists to find.
 */
async function loadTs(entry, pick) {
  const out = await esbuild.build({
    entryPoints: [join(FRONTEND, 'src', entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    // THE SOURCES USE THE APP'S OWN ALIAS (`@/…`, vite.config.ts) and import assets node has no
    // loader for. Both are declared here so the module under test is the app's own module rather
    // than a copy of it — the point of asking the renderer instead of guessing from casing.
    alias: { '@': join(FRONTEND, 'src') },
    loader: { '.svg': 'text', '.jpg': 'text', '.png': 'text', '.css': 'text' },
  });
  const dir = join(FRONTEND, 'node_modules', '.cache');
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, `${entry.replace(/[^\w]/g, '_')}.${process.pid}.mjs`);
  await writeFile(tmp, out.outputFiles[0].text);
  try {
    const mod = await import(pathToFileURL(tmp).href);
    return pick(mod);
  } finally {
    await rm(tmp, { force: true });
  }
}

/**
 * THE RENDERER'S OWN RESOLVER IS THE ARBITER, and that is the whole point of this check.
 *
 * A component name is renderable when `resolveTag` claims it: the renderer owns the explicit
 * composites, A2UI's own primitives (Column, Text, Button…) and the structural ones, and it
 * returns null only when NOTHING claims the name — the case it reports as a missing component
 * rather than inventing `<row>` from the casing. Guessing the tag here (`ConsoleCardGrid` →
 * `console-card-grid`) produced six false findings the first time this script ran, every one of
 * them a primitive or a composite: a checker that cries wolf is worse than no checker.
 */
const loadResolver = async () => {
  const resolveTag = await loadTs('components/lit/a2ui-renderer.ts', (m) => m.resolveTag);
  const owned = await loadTs('components/lit/a2ui-primitives.ts', (m) => new Set([
    ...Object.values(m.A2UI_PRIMITIVES ?? {}),
    ...Object.values(m.A2UI_STRUCTURAL ?? {}),
  ]));
  return { resolveTag, rendererOwned: owned };
};
const loadRegistry = () => loadTs('shared/tag-registry.ts', (m) => m.TAG_REGISTRY ?? m.default ?? {});

/** The keys of an object literal starting at `text[from]` (a `{`), read at depth one. */
function objectKeys(text, from) {
  const keys = [];
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) break;
    } else if (depth === 1 && (ch === '"' || ch === "'")) {
      const quote = ch;
      let end = i + 1;
      while (end < text.length && text[end] !== quote) end++;
      const word = text.slice(i + 1, end);
      const after = text.slice(end + 1).match(/^\s*:/);
      if (after) keys.push(word);
      i = end;
    }
  }
  return keys;
}

/** Every `component: 'Name'` / `"component": "Name"` in a source, with the keys beside it. */
function componentsIn(text, quote) {
  const out = [];
  const needle = `${quote}component${quote}:`;
  let i = text.indexOf(needle);
  while (i !== -1) {
    const rest = text.slice(i + needle.length);
    const m = rest.match(new RegExp(`^\\s*${quote}([A-Za-z][\\w-]*)${quote}`));
    if (m) {
      const brace = text.lastIndexOf('{', i);
      out.push({ name: m[1], props: brace === -1 ? [] : objectKeys(text, brace) });
    }
    i = text.indexOf(needle, i + needle.length);
  }
  return out;
}

const main = async () => {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
  const components = catalog.components ?? {};
  const registry = await loadRegistry();
  const sources = new Map();
  for (const f of await walk(ELEMENTS_DIR)) sources.set(f, await readFile(f, 'utf8'));

  /** The element that defines a tag, by `customElements.define` — never by file-name guesswork. */
  const fileForTag = (tag) => {
    for (const [file, text] of sources) {
      if (text.includes(`customElements.define('${tag}'`) || text.includes(`customElements.define("${tag}"`)) return file;
    }
    return null;
  };
  const sourceForTag = (tag) => {
    const file = fileForTag(tag);
    return file ? sources.get(file) : null;
  };

  /*
   * ── WHAT THE APP EMITS ────────────────────────────────────────────────────
   * Every component name in the two owning sources, with the props beside it.
   */
  const emitted = new Map();
  for (const src of SOURCES) {
    const text = await readFile(src.file, 'utf8');
    for (const { name, props } of componentsIn(text, src.quote)) {
      const seen = emitted.get(name) ?? { props: new Set(), where: [] };
      props.forEach((p) => seen.props.add(p));
      if (!seen.where.includes(src.file)) seen.where.push(src.file);
      emitted.set(name, seen);
    }
  }

  // ── CHECK: every name the app emits is a component of the catalog ──────────
  for (const [name, meta] of emitted) {
    if (components[name]) continue;
    add({
      id: `catalog-member:${name}`,
      check: 'catalog-member',
      stage: 'deliver',
      owner: 'pipeline',
      level: 'blocking',
      component: name,
      file: relative(REPO, meta.where[0]),
      what: `The app emits "${name}", which is not a component of the ${CATALOG_NAME} catalog. ` +
        'The server validates every assembled tree against this catalog, so a name that is not in it is a 503.',
      fix: `Add ${name} to ${relative(REPO, CATALOG_PATH)}, or stop emitting it.`,
    });
  }

  // ── CHECK: every emitted component RESOLVES, and its tag exists ───────────
  const { resolveTag, rendererOwned } = await loadResolver();
  for (const [name] of emitted) {
    const spec = components[name];
    if (!spec) continue;
    if (spec.deprecated === true) {
      add({
        id: `component-resolves:${name}`,
        check: 'component-resolves',
        stage: 'deliver',
        owner: 'pipeline',
        level: 'advisory',
        component: name,
        file: relative(REPO, CATALOG_PATH),
        what: `"${name}" is marked deprecated in the catalog and the app still emits it, so the surface draws the deprecated entry.`,
        fix: 'Emit the component that replaced it, or un-deprecate this one.',
      });
      continue;
    }
    const resolved = resolveTag(name);
    if (!resolved) {
      add({
        id: `component-resolves:${name}`,
        check: 'component-resolves',
        stage: 'deliver',
        owner: 'pipeline',
        level: 'blocking',
        component: name,
        file: null,
        what: `Nothing claims "${name}": the renderer's resolveTag returns null for it (no composite, no ` +
          'primitive, no allowlist entry), so an assembly that names it draws a reported missing component.',
        fix: 'Add a composite mapping in a2ui-renderer.ts, or a real element plus an allowlist entry — or stop emitting the name.',
      });
      continue;
    }
    /*
     * WHAT THE RENDERER OWNS IS NOT ON THIS CHECK. A2UI_PRIMITIVES and A2UI_STRUCTURAL are tags
     * the renderer defines itself, in one loop in its own file (`customElements.define(tag,
     * ctor)` over a table) — Text, Column, Button, ConsoleCardGrid and the rest. Searching the
     * sources for a literal `customElements.define('a2ui-text')` cannot see a loop, which is
     * exactly how this check reported six components that render perfectly well as missing.
     * Everything else the resolver returns IS a real element, and the role-dropdown failure is
     * what this half is for: catalogued, allowlisted, and imported by nothing.
     */
    if (resolved.includes('-') && !rendererOwned.has(resolved) && !fileForTag(resolved)) {
      add({
        id: `component-resolves:${name}`,
        check: 'component-resolves',
        stage: 'deliver',
        owner: 'pipeline',
        level: 'blocking',
        component: name,
        file: null,
        what: `"${name}" resolves to <${resolved}> and NOTHING defines that tag — no file calls ` +
          'customElements.define for it, so the surface renders a box the browser never upgrades, with no error anywhere.',
        fix: 'Import the element where the app starts (src/main.tsx, or the Run path for the canvas), or remove the name.',
      });
    }
  }

  // ── CHECK: the slots a container declares are the slots its element renders ─
  for (const [name, spec] of Object.entries(components)) {
    const parts = [spec, ...(spec.allOf ?? [])];
    const declared = new Set();
    for (const part of parts) {
      const children = part.properties?.children;
      if (children?.properties) Object.keys(children.properties).forEach((s) => declared.add(s));
    }
    if (!declared.size) continue;
    const tag = resolveTag(name);
    if (!tag) continue; // covered by component-resolves above
    const text = sourceForTag(tag);
    if (!text) continue; // a renderer-owned primitive: no element to compare against
    const rendered = new Set([...text.matchAll(/<slot\s+name=["']([\w-]+)["']/g)].map((m) => m[1]));
    const bare = /<slot\s*(?!name)/.test(text);
    for (const slot of declared) {
      if (rendered.has(slot)) continue;
      add({
        id: `slots:${name}:${slot}`,
        check: 'slots',
        stage: 'deliver',
        owner: 'designer',
        level: 'blocking',
        component: name,
        file: relative(REPO, fileForTag(tag) ?? CATALOG_PATH),
        what: `The catalog declares a "${slot}" slot on ${name} and the element renders no slot by that ` +
          `name${bare ? ' (it has a default slot, which the envelope never fills by name)' : ''}. ` +
          'A payload written to this catalog therefore draws that child nowhere.',
        fix: `Change the catalog's children to the slots the element renders (${[...rendered].join(', ') || 'none'}), or render a "${slot}" slot.`,
      });
    }
  }

  // ── CHECK: the props the app sends are props the catalog declares ─────────
  for (const [name, meta] of emitted) {
    const spec = components[name];
    if (!spec) continue;
    const declared = new Set(['id', 'component']);
    for (const part of [spec, ...(spec.allOf ?? [])]) {
      Object.keys(part.properties ?? {}).forEach((p) => declared.add(p));
    }
    for (const prop of meta.props) {
      if (declared.has(prop)) continue;
      add({
        id: `props:${name}:${prop}`,
        check: 'props',
        stage: 'deliver',
        owner: 'designer',
        level: 'advisory',
        component: name,
        file: relative(REPO, CATALOG_PATH),
        what: `The app sends "${prop}" on ${name} and the catalog does not declare it, so the ` +
          'declaration under-describes what the surface is given.',
        fix: `Declare "${prop}" on ${name} in ${relative(REPO, CATALOG_PATH)} (with its type and meaning), or stop sending it.`,
      });
    }
  }

  // ── CHECK: the events an element dispatches are the events the registry lists
  for (const [name] of emitted) {
    const tag = resolveTag(name);
    if (!tag) continue;
    const file = fileForTag(tag);
    if (!file) continue;
    const text = sources.get(file);
    const dispatched = [...new Set([...text.matchAll(/new CustomEvent\(\s*['"]([\w:-]+)['"]/g)].map((m) => m[1]))];
    if (!dispatched.length) continue;
    const entry = Object.values(registry).find((r) => r?.tag === tag || r?.tag === name.toLowerCase());
    const listed = new Set(entry?.events ?? []);
    const missing = dispatched.filter((e) => !listed.has(e));
    if (!missing.length) continue;
    add({
      id: `events:${name}`,
      check: 'events',
      stage: 'deliver',
      owner: 'pipeline',
      level: 'advisory',
      component: name,
      file: relative(REPO, file),
      what: `<${tag}> dispatches ${missing.map((e) => `"${e}"`).join(', ')} and the tag registry does not ` +
        'list it. The registry\'s `events` is read as EMITS by some callers and as a LISTENS-FOR list by ' +
        'others, which is why an unlisted dispatch is a gap and not an error.',
      fix: `List ${missing.map((e) => `"${e}"`).join(', ')} on ${tag} in the registry — and say which direction the list means.`,
      dispatchedEvents: dispatched,
    });
  }

  // ── CHECK: the docs' count of the catalog ─────────────────────────────────
  const total = Object.keys(components).length;
  for (const file of COUNT_CLAIMS) {
    if (!existsSync(file)) continue;
    const text = await readFile(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const m = line.match(/(\d+)\s+trusted components/);
      if (!m) return;
      if (Number(m[1]) === total) return;
      add({
        id: `doc-claim-drift:${relative(REPO, file)}:${i + 1}`,
        check: 'doc-claim-drift',
        stage: 'gap',
        owner: 'pipeline',
        level: 'blocking',
        file: `${relative(REPO, file)}:${i + 1}`,
        what: `This line claims ${m[1]} trusted components; the catalog holds ${total}.`,
        fix: `Say ${total}, or fix the catalog. A count that is not measured is a claim nobody re-derives.`,
      });
    });
  }

  // If nothing was wrong anywhere, say so once per check — a report of only failures cannot
  // tell "checked and clean" from "did not check".
  const checks = [...new Set(findings.map((f) => f.check))];
  const allChecks = ['catalog-member', 'component-resolves', 'slots', 'props', 'events', 'doc-claim-drift'];

  const report = {
    generatedAt: new Date().toISOString(),
    catalog: CATALOG_NAME,
    status: 'partial', // no Figma checks ran — see the header. Not 'complete', and not a pass.
    fileKey: null,
    counts: {
      total: findings.length,
      blocking: findings.filter((f) => f.level === 'blocking').length,
      pipeline: findings.filter((f) => f.owner === 'pipeline').length,
      designer: findings.filter((f) => f.owner === 'designer').length,
      passed: allChecks.length - checks.length,
    },
    checks: allChecks,
    findings,
  };

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(join(REPORT_DIR, `${CATALOG_NAME}.json`), JSON.stringify(report, null, 2) + '\n');

  const blocking = report.counts.blocking;
  console.log(
    `catalog-check: ${total} components, ${findings.length} finding(s), ${blocking} blocking. ` +
    `Report: catalog-audit/${CATALOG_NAME}.json`,
  );
  for (const f of findings) console.log(`  [${f.level}] ${f.check} — ${f.what}`);
  process.exit(blocking ? 1 : 0);
};

main().catch((err) => {
  console.error('catalog-check could not run:', err);
  // A checker that did not run must never look like a clean catalog: no report is written, and
  // the endpoint answers CATALOG_AUDIT_UNAVAILABLE, which the shell shows as "not a clean result".
  process.exit(2);
});
