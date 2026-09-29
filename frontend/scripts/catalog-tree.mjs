#!/usr/bin/env node
/**
 * catalog-tree.mjs — THE CATALOGUE AS A TREE, DERIVED FROM THE FILES THAT ALREADY HOLD IT.
 *
 * WHAT THIS IS. The display — a catalogue, its groups, one row per element, and that element's
 * children — built from the six sources that exist today, with nothing invented:
 *
 *   schema     src/components/A2UI/catalogs/<id>/catalog.json   what is declared (+ description)
 *   allowlist  src/shared/tag-registry.ts                       what may render; surface, column, events
 *   manifest   custom-elements.json                             the props, events and slots the element declares
 *   element    src/components/lit/**.ts                         the slots it renders, the tags it composes
 *   figma map  src/components/registry.json                     the Figma node each component came from
 *   gate       catalog-audit/<id>.json                          the findings filed against it
 *   ledger     backend/logs/figma-ingest.jsonl                  its ingest history
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not invent the categories the owner's model has
 * (layout / components / actions): nothing in the repository declares them, so the grouping here
 * is the one structure that DOES exist — the allowlist's `surface` and `column`, which
 * tag-registry.ts already derives and never restates. A group node is emitted with
 * `"derived": true` and `"declared": null` so the screen can label it as derived rather than
 * pass it off as a decision someone made. A declared category is a catalogue change, not a
 * display change.
 *
 * THE HONESTY RULES, which are the reason this script exists at all:
 *   · An absent thing is reported absent, in words, and named as absent — never filled with a
 *     plausible zero: no token count, no database binding, no owner, no category.
 *   · A source that cannot be read is null WITH THE REASON, never 0.
 *   · A count is measured, never copied from a claim in a doc.
 *   · Nothing measured for one catalogue is ever used for another.
 *
 * RUN: `npm run catalog:tree` — writes `frontend/catalog-tree/<id>.json` for every catalogue,
 * writes `frontend/catalog-tree/index.json` (the systems, for a list screen), and prints the same
 * tree on stdout so the terminal is a preview of the screen. `--catalog <id>` renders one.
 * Exit 0 means the tree was built; it is a REPORT, not a gate — the gate is catalog:check.
 */
import { readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(FRONTEND, '..');
const CATALOGS_DIR = join(FRONTEND, 'src', 'components', 'A2UI', 'catalogs');
const ELEMENTS_DIR = join(FRONTEND, 'src', 'components', 'lit');
const AUDIT_DIR = join(FRONTEND, 'catalog-audit');
const OUT_DIR = join(FRONTEND, 'catalog-tree');
const MANIFEST_PATH = join(FRONTEND, 'custom-elements.json');
const FIGMA_MAP_PATH = join(FRONTEND, 'src', 'components', 'registry.json');
const LEDGER_PATH = join(REPO, 'backend', 'logs', 'figma-ingest.jsonl');

/*
 * THE ABSENCES THIS TREE REPORTS BY NAME. Each one is a thing the screen in the mock draws and
 * the data does not have; stating them once here keeps every level of the tree from inventing
 * its own polite substitute.
 */
const ABSENT = {
  tokens:
    'No token count exists anywhere: the catalogue, the manifest and the ledger carry none per element ' +
    'or per catalogue. The only token-ish numbers in the repository are session totals ' +
    '(tokenEstimate on two ledger records), which are not per-element and must not be shown as if they were.',
  owner: 'The catalogue declares no owner field. Nothing in the repository says who owns a catalogue.',
  category:
    'No declared category exists (layout / components / actions are not in any file). The groups below are ' +
    'DERIVED from the allowlist\'s surface + column — the only grouping the repository actually states. ' +
    'A real layout/component/action category has to be DECLARED per element in the catalogue.',
  binding:
    'No structure in the repository maps an action to a data source, so no database binding is shown. ' +
    'Actions are rendered as fields on the element (the events it dispatches and the events the allowlist lists).',
  figmaLayers:
    'Figma layers are not drawn: they need the design file and an API token. The Figma node each element came ' +
    'from is shown instead (registry.json), and the ingest ledger for it.',
};

async function walk(dir, ext = '.ts') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(p, ext));
    else if (entry.name.endsWith(ext) && !entry.name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

/** Load a TypeScript module the way catalog-check.mjs does — through esbuild, not a regex. */
async function loadTs(entry, pick) {
  const out = await esbuild.build({
    entryPoints: [join(FRONTEND, 'src', entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    alias: { '@': join(FRONTEND, 'src') },
    loader: { '.svg': 'text', '.jpg': 'text', '.png': 'text', '.css': 'text' },
  });
  const dir = join(FRONTEND, 'node_modules', '.cache');
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, `${entry.replace(/[^\w]/g, '_')}.tree.${process.pid}.mjs`);
  await writeFile(tmp, out.outputFiles[0].text);
  try {
    const mod = await import(pathToFileURL(tmp).href);
    return pick(mod);
  } finally {
    await rm(tmp, { force: true });
  }
}

/* ── the element source: templates, comments, slots, composed tags ────────────────────────────
 * The lesson this encodes: prose about an element (`<chat-panel>` inside a doc comment) made
 * chat-panel look like a child of ten elements. Children are read from TEMPLATES ONLY, and
 * comments inside a template are stripped before the tags are matched.
 */
function templates(text) {
  const out = [];
  const collect = (s) => {
    let i = 0;
    while ((i = s.indexOf('html`', i)) !== -1) {
      let j = i + 5;
      let depth = 0;
      let buf = '';
      const inner = [];
      while (j < s.length) {
        const ch = s[j];
        if (ch === '\\') { buf += s[j] + (s[j + 1] ?? ''); j += 2; continue; }
        if (ch === '$' && s[j + 1] === '{') { depth++; buf += '${'; j += 2; continue; }
        if (ch === '}' && depth > 0) { depth--; buf += '}'; j++; continue; }
        if (ch === '`' && depth === 0) break;
        if (depth > 0) inner.push(ch);
        else buf += ch;
        j++;
      }
      out.push(buf);
      // A template inside a ${…} is a template too — recurse rather than lose its children.
      if (inner.length) collect(inner.join(''));
      i = j + 1;
    }
  };
  collect(text);
  return out.join('\n');
}

const stripComments = (t) => t
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const renderedSlots = (text) =>
  [...new Set([...text.matchAll(/<slot\s+name=["']([\w-]+)["']/g)].map((m) => m[1]))].sort();
const hasBareSlot = (text) => /<slot\s*(?!\s*name)/.test(text);
const customElementTags = (text) =>
  [...text.matchAll(/customElements\.define\(\s*['"]([\w-]+)['"]/g)].map((m) => m[1]);
const dispatchedEvents = (text) =>
  [...new Set([...text.matchAll(/new CustomEvent\(\s*['"]([\w:-]+)['"]/g)].map((m) => m[1]))].sort();

/** Tags composed inside the element's own templates, comments stripped, self excluded. */
function composedChildren(text, selfTags) {
  const t = stripComments(templates(text));
  const found = new Set();
  for (const m of t.matchAll(/<([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b/g)) {
    const tag = m[1];
    if (tag === 'slot' || selfTags.has(tag)) continue;
    found.add(tag);
  }
  return [...found].sort();
}

/* ── reading a catalogue: declared components, their description, their declared slots ───────── */
function partsOf(spec) {
  return [spec, ...(spec.allOf ?? [])];
}
function descriptionOf(spec) {
  for (const part of partsOf(spec)) {
    if (typeof part?.description === 'string' && part.description.trim()) return part.description;
  }
  return null;
}
function declaredProps(spec) {
  const out = new Set();
  for (const part of partsOf(spec)) Object.keys(part?.properties ?? {}).forEach((p) => out.add(p));
  out.delete('children'); // children is the slot channel, not a prop
  return [...out].sort();
}
function declaredSlotNames(spec) {
  const out = new Set();
  for (const part of partsOf(spec)) {
    const children = part?.properties?.children;
    if (children?.properties) Object.keys(children.properties).forEach((s) => out.add(s));
  }
  return [...out].sort();
}

const versionOf = (catalogId) => (catalogId.match(/\/(v[\w.]+)\//) ?? [])[1] ?? null;
const shortIdOf = (catalogId, fallback) => {
  const m = catalogId.match(/\/catalogs\/([^/]+)\//);
  return m ? m[1] : fallback;
};

const main = async () => {
  const argv = process.argv.slice(2);
  const only = argv.indexOf('--catalog') !== -1 ? argv[argv.indexOf('--catalog') + 1] : null;

  /* the allowlist and the renderer's own resolver: the arbiter of "is this name renderable" */
  const registry = await loadTs('shared/tag-registry.ts', (m) => m.TAG_REGISTRY ?? m.default ?? {});
  const resolveTag = await loadTs('components/lit/a2ui-renderer.ts', (m) => m.resolveTag);
  const rendererOwned = await loadTs('components/lit/a2ui-primitives.ts', (m) => new Set([
    ...Object.values(m.A2UI_PRIMITIVES ?? {}),
    ...Object.values(m.A2UI_STRUCTURAL ?? {}),
  ]));

  /* the manifest: tagName → module, members, events, slots */
  let manifest = null;
  let manifestNote = null;
  if (existsSync(MANIFEST_PATH)) {
    const raw = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    manifest = new Map();
    for (const mod of raw.modules ?? []) {
      for (const decl of mod.declarations ?? []) {
        if (!decl.tagName) continue;
        manifest.set(decl.tagName, {
          path: mod.path,
          className: decl.name,
          members: (decl.members ?? []).map((m) => ({ name: m.name, kind: m.kind })),
          events: (decl.events ?? []).map((e) => e.name),
          slots: (decl.slots ?? []).map((s) => s.name),
        });
      }
    }
  } else {
    manifestNote = `no manifest at ${relative(REPO, MANIFEST_PATH)} — props, events and slots read from nothing`;
  }

  /* the Figma map: which node each component came from */
  const figmaMap = existsSync(FIGMA_MAP_PATH)
    ? (JSON.parse(await readFile(FIGMA_MAP_PATH, 'utf8')).components ?? [])
    : [];
  const mapByComponent = new Map(figmaMap.filter((e) => e.litComponent).map((e) => [e.litComponent, e]));

  /* the element sources, read once */
  const sourceText = new Map();
  for (const file of await walk(ELEMENTS_DIR)) sourceText.set(file, await readFile(file, 'utf8'));
  const fileForTag = (tag) => {
    for (const [file, text] of sourceText) if (customElementTags(text).includes(tag)) return file;
    return null;
  };

  /* the ledger: every record, parsed once */
  const ledgerRows = [];
  let ledgerUnreadable = 0;
  if (existsSync(LEDGER_PATH)) {
    for (const line of (await readFile(LEDGER_PATH, 'utf8')).split('\n')) {
      if (!line.trim()) continue;
      try { ledgerRows.push(JSON.parse(line)); } catch { ledgerUnreadable++; }
    }
  }
  const ledgerFor = ({ nodeId, needles }) => {
    const rows = ledgerRows.filter((r) =>
      (nodeId && r.nodeId === nodeId) ||
      (r.nodeId === undefined && false) ||
      needles.filter(Boolean).some((n) => JSON.stringify(r).includes(n)));
    return rows;
  };
  const timeline = (rows) => {
    const kinds = [];
    for (const r of rows) {
      const k = r.kind ?? '(untyped)';
      const last = kinds[kinds.length - 1];
      if (last && last.kind === k) last.n++;
      else kinds.push({ kind: k, n: 1, first: r.at, last: r.at });
      if (last && last.kind === k) last.last = r.at;
    }
    return kinds;
  };
  /** The same history, counted rather than chronological: "ingested×15 · approved×7". */
  const kindTotals = (rows) => {
    const order = [];
    const counts = new Map();
    for (const r of rows) {
      const k = r.kind ?? '(untyped)';
      if (!counts.has(k)) { counts.set(k, 0); order.push(k); }
      counts.set(k, counts.get(k) + 1);
    }
    return order.map((k) => `${k}×${counts.get(k)}`).join(' · ');
  };

  /* the gate: findings per catalogue, keyed to the component they name */
  const findingsByComponent = (auditId) => {
    const file = join(AUDIT_DIR, `${auditId}.json`);
    if (!existsSync(file)) return { report: null, note: `no audit has been run for this catalogue (${relative(REPO, file)} is absent)` };
    const report = JSON.parse(readFileSync(file, 'utf8'));
    const byComponent = new Map();
    for (const f of report.findings ?? []) {
      const key = f.component ?? '(catalogue-wide)';
      if (!byComponent.has(key)) byComponent.set(key, []);
      byComponent.get(key).push({ id: f.id, check: f.check, level: f.level, owner: f.owner, what: f.what, fix: f.fix });
    }
    return { report, byComponent, note: null };
  };

  /* ── build one system ───────────────────────────────────────────────────────────────────── */
  const buildSystem = async (dirName) => {
    const catalogPath = join(CATALOGS_DIR, dirName, 'catalog.json');
    const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
    const catalogId = catalog.catalogId ?? catalog.$id ?? null;
    const components = catalog.components ?? {};
    const ids = Object.keys(components);
    const auditId = shortIdOf(catalogId ?? '', dirName);
    const gate = findingsByComponent(auditId);

    const groups = new Map();
    const groupOf = (title) => {
      if (!groups.has(title)) groups.set(title, []);
      return groups.get(title);
    };

    let annotated = 0;
    let built = 0;
    let inManifest = 0;
    let allowlisted = 0;
    let mapped = 0;

    const elements = [];
    for (const name of ids) {
      const spec = components[name];
      const description = descriptionOf(spec);
      if (description) annotated++;

      const tag = resolveTag(name);
      const entry = tag ? registry[tag] : undefined;
      const manifestDecl = tag ? manifest?.get(tag) : undefined;
      const mapEntry = mapByComponent.get(tag ?? '') ?? null;
      const file = mapEntry?.file ?? fileForTag(tag ?? '') ?? manifestDecl?.path ?? null;
      const text = (() => {
        if (!tag) return null;
        const f = fileForTag(tag);
        if (f) return sourceText.get(f);
        if (file && sourceText.has(join(REPO, file))) return sourceText.get(join(REPO, file));
        if (file && sourceText.has(file)) return sourceText.get(file);
        return null;
      })();

      const isRendererOwned = tag ? rendererOwned.has(tag) : false;
      if (entry) allowlisted++;
      if (manifestDecl || isRendererOwned) inManifest++;
      if (mapEntry) mapped++;
      if (text || isRendererOwned) built++;

      const slotsDeclared = declaredSlotNames(spec);
      const slotsRendered = text ? renderedSlots(text) : [];
      const declaredNotRendered = slotsDeclared.filter((s) => !slotsRendered.includes(s));
      const eventsDispatched = text ? dispatchedEvents(text) : [];
      const eventsAllowlisted = entry?.events ?? [];
      const eventsNotListed = eventsDispatched.filter((e) => !eventsAllowlisted.includes(e));
      const findings = gate.byComponent?.get(name) ?? [];
      const blocking = findings.some((f) => f.level === 'blocking');

      const marks = [];
      if (findings.length) marks.push('⚠');
      if (description) marks.push('●');
      else marks.push('◐');
      if (!allowlisted) marks.push('∅');

      const propsDeclared = declaredProps(spec);
      const ledgerRowsFor = ledgerFor({
        nodeId: mapEntry?.figmaNodeId ?? null,
        needles: [tag, mapEntry?.figmaName].filter(Boolean),
      });

      elements.push({
        name,
        tag: tag ?? null,
        tagNote: tag ? null : `nothing claims "${name}": the renderer's resolveTag returns null for it, so no element can be named`,
        className: manifestDecl?.className ?? null,
        file,
        registration: {
          declared: true,
          annotated: Boolean(description),
          allowlisted: Boolean(entry),
          inManifest: Boolean(manifestDecl),
          rendererOwned: isRendererOwned,
          built: Boolean(text) || isRendererOwned,
          mapped: Boolean(mapEntry),
        },
        marks,
        findings,
        props: {
          declared: propsDeclared,
          inManifest: manifestDecl ? manifestDecl.members.filter((m) => m.kind === 'field').map((m) => m.name) : null,
          inManifestNote: manifestDecl ? null : 'the manifest declares no tag by this name — props read from the catalogue only',
        },
        events: {
          allowlisted: eventsAllowlisted,
          dispatched: eventsDispatched,
          dispatchedNotListed: eventsNotListed,
          note: eventsDispatched.length
            ? null
            : 'no source was read for this element, so its dispatched events are unknown — not "none"',
        },
        slots: {
          declared: slotsDeclared,
          rendered: slotsRendered,
          declaredNotRendered,
          bareSlot: text ? hasBareSlot(text) : null,
        },
        children: {
          slot: slotsRendered,
          composed: text ? composedChildren(text, new Set([tag].filter(Boolean))) : [],
          note: 'slot = the sanctioned channel; composed = tags found in the element\'s own templates, which the protocol docs call the wrong model for nesting',
        },
        actions: { events: [...new Set([...eventsAllowlisted, ...eventsDispatched])], binding: null, bindingNote: ABSENT.binding },
        provenance: mapEntry ? {
          figmaName: mapEntry.figmaName ?? null,
          figmaNodeId: mapEntry.figmaNodeId ?? null,
          status: mapEntry.status ?? null,
          annotation: mapEntry.annotation ?? null,
          annotationSource: mapEntry.provenance?.annotation ?? null,
        } : null,
        provenanceNote: mapEntry ? null : 'no Figma node is mapped to this component (registry.json) — it was declared, not drawn',
        ledger: {
          records: ledgerRowsFor.length,
          timeline: timeline(ledgerRowsFor),
          lastAt: ledgerRowsFor.length ? ledgerRowsFor[ledgerRowsFor.length - 1].at : null,
        },
        ledgerNote: ledgerRowsFor.length ? null : 'the ledger holds no record naming this component',
        tokens: null,
        tokensNote: ABSENT.tokens,
      });

      /* grouping is DERIVED, and it says so */
      let groupTitle;
      if (!entry) groupTitle = 'not in the allowlist';
      else if (entry.column) groupTitle = `${entry.column} column`;
      else groupTitle = `surface: ${entry.surface}`;
      groupOf(groupTitle).push(name);
    }

    /* elements the manifest knows and this catalogue does not declare — the reverse gap */
    const declaredTags = new Set(elements.map((e) => e.tag).filter(Boolean));
    const undeclared = [];
    if (manifest) {
      for (const [tag, decl] of manifest) {
        if (declaredTags.has(tag) || rendererOwned.has(tag)) continue;
        undeclared.push({ tag, className: decl.className, file: decl.path });
      }
    }

    /*
     * THE SAME ELEMENT DECLARED TWICE. A catalogue entry is keyed by the name the app emits
     * (ChatPanel), and several components are ALSO declared under their tag (chat-panel). Both
     * resolve to one element, so a tree drawn naively shows the component twice — and the two
     * entries do not always declare the same props. This is measured, not fixed: it is a
     * catalogue decision, and the display has to be able to say so.
     */
    const namesByTag = new Map();
    for (const e of elements) {
      if (!e.tag) continue;
      if (!namesByTag.has(e.tag)) namesByTag.set(e.tag, []);
      namesByTag.get(e.tag).push(e.name);
    }
    const duplicates = [...namesByTag.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([tag, names]) => ({
        tag,
        names,
        declaredPropsDiffer: new Set(names.map((n) => JSON.stringify(elements.find((e) => e.name === n).props.declared))).size > 1,
      }));
    for (const e of elements) {
      if (!e.tag) continue;
      const others = (namesByTag.get(e.tag) ?? []).filter((n) => n !== e.name);
      if (others.length) {
        e.duplicateOf = others;
        e.marks.push('⇄');
      }
    }

    /*
     * WHAT THE LEDGER CANNOT SAY. The removal records carry no nodeId and no tag — the ledger
     * records THAT a removal happened and what catalog-check said afterwards, never WHICH
     * component it was. Reporting the counts is honest; naming a component would be invention.
     */
    const removals = ledgerRows.filter((r) => r.kind === 'removed');
    const removalNote = removals.length
      ? `${removals.length} removal record(s) in ${relative(REPO, LEDGER_PATH)}, and not one names a node or a tag. ` +
        'The ledger says a removal happened and what the audit counted afterwards; it does not say what was removed. ' +
        'The counts in those verdicts are the only trace (58 components before 01:10:49Z, 57 after 01:11:58Z).'
      : `no removal records in ${relative(REPO, LEDGER_PATH)}`;

    const groupNodes = [...groups.entries()].map(([title, names]) => ({
      title,
      derived: true,
      declared: null,
      counts: {
        elements: names.length,
        annotated: elements.filter((e) => names.includes(e.name) && e.registration.annotated).length,
        findings: elements.filter((e) => names.includes(e.name) && e.findings.length).length,
      },
      elements: elements.filter((e) => names.includes(e.name)),
    }));

    /* elements that live ONLY in the ledger — ingested, approved, removed and now in no other source */
    const mapNodeIds = new Set(figmaMap.map((e) => e.figmaNodeId).filter(Boolean));
    const knownTags = new Set([...declaredTags, ...(manifest ? [...manifest.keys()] : [])]);
    const byNode = new Map();
    for (const r of ledgerRows) {
      if (!r.nodeId || !r.kind) continue; // a session-level record, not an element event
      if (mapNodeIds.has(r.nodeId)) continue;
      if (!byNode.has(r.nodeId)) byNode.set(r.nodeId, []);
      byNode.get(r.nodeId).push(r);
    }
    const ledgerOnly = [...byNode.entries()]
      .map(([nodeId, rows]) => {
        const tags = [...new Set(rows.flatMap((r) => r.tags ?? r.written ?? []))];
        return {
          nodeId,
          nodeName: rows.find((r) => r.nodeName)?.nodeName ?? null,
          records: rows.length,
          history: kindTotals(rows),
          firstAt: rows[0]?.at ?? null,
          timeline: timeline(rows),
          tags,
          inAnyCatalogue: tags.some((t) => knownTags.has(t)),
          lastAt: rows[rows.length - 1]?.at ?? null,
          lastVerdict: [...rows].reverse().find((r) => r.verdict)?.verdict ?? null,
        };
      })
      .filter((e) => e.records > 1 || e.timeline.some((t) => ['approved', 'removed', 'discarded'].includes(t.kind)))
      .sort((a, b) => b.records - a.records);

    return {
      generatedAt: new Date().toISOString(),
      system: {
        id: auditId,
        catalogId,
        title: catalog.title ?? null,
        version: versionOf(catalogId ?? ''),
        versionNote: 'the version is the /v…/ segment of the catalogId — catalog.json declares no version field of its own',
        source: relative(REPO, catalogPath),
        schema: catalog.$schema ?? null,
        description: catalog.whatThisFileIs ?? catalog.description ?? null,
        owner: null,
        ownerNote: ABSENT.owner,
        counts: {
          declared: ids.length,
          annotated,
          built,
          inManifest,
          allowlisted,
          mapped,
          inTheFigmaMap: figmaMap.filter((e) => declaredTags.has(e.litComponent)).length,
        },
        tokens: null,
        tokensNote: ABSENT.tokens,
        categoryNote: ABSENT.category,
        figmaLayersNote: ABSENT.figmaLayers,
        gate: gate.report ? {
          status: gate.report.status,
          generatedAt: gate.report.generatedAt,
          findings: gate.report.counts?.total ?? (gate.report.findings ?? []).length,
          blocking: gate.report.counts?.blocking ?? null,
          fileKey: gate.report.fileKey,
          report: relative(REPO, join(AUDIT_DIR, `${auditId}.json`)),
        } : null,
        gateNote: gate.note,
        removalNote,
        duplicateTags: duplicates,
      },
      groups: groupNodes,
      undeclared,
      ledgerOnly,
      ledgerNote: {
        records: ledgerRows.length,
        unreadable: ledgerUnreadable,
        sessionRecords: ledgerRows.filter((r) => !r.kind).length,
        removalRecords: removals.length,
        path: relative(REPO, LEDGER_PATH),
      },
    };
  };

  const catalogDirs = (await readdir(CATALOGS_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && existsSync(join(CATALOGS_DIR, d.name, 'catalog.json')))
    .map((d) => d.name)
    .filter((name) => !only || name === only);

  if (!catalogDirs.length) {
    console.error(`catalog-tree: no catalogue named "${only}" — nothing written.`);
    process.exit(2);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const index = { generatedAt: new Date().toISOString(), catalogs: [] };

  for (const dir of catalogDirs) {
    const tree = await buildSystem(dir);
    await writeFile(join(OUT_DIR, `${tree.system.id}.json`), JSON.stringify(tree, null, 2) + '\n');
    index.catalogs.push({
      id: tree.system.id,
      catalogId: tree.system.catalogId,
      title: tree.system.title,
      counts: tree.system.counts,
      gate: tree.system.gate,
      groups: tree.groups.map((g) => ({ title: g.title, elements: g.counts.elements, derived: true })),
    });
    printTree(tree);
  }
  await writeFile(join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(
    'legend: ⬤ catalogue · ▤ group (DERIVED — no declared category exists) · ▪ element · ◇ child\n' +
    '        ● annotated (the catalogue describes it) · ◐ declared, no description · ○ built, not declared\n' +
    '        ∅ not in the allowlist · ⇄ declared twice (by name and by tag) · ⚠ the gate filed a finding\n' +
    '        ⌀ present in the ingest ledger and in no other source',
  );
  console.log(`catalog-tree: ${catalogDirs.length} catalogue(s) written to ${relative(REPO, OUT_DIR)}/ + index.json`);
  process.exit(0);
};

const mark = (e) => e.marks.join('');
const row = (glyph, name, sub, counts, marks) =>
  `    ${glyph} ${name.padEnd(30)} ${(sub ?? '').padEnd(26)} ${(counts ?? '').padEnd(34)} ${marks}`;

function printTree(tree) {
  const s = tree.system;
  const line = (t = '') => console.log(t);
  line();
  line('─'.repeat(110));
  line(`⬤ ${s.title ?? s.id}  (${s.version ?? 'no version'})`);
  line(`   catalogId  ${s.catalogId}`);
  line(`   source     ${s.source}`);
  line(`   declared ${s.counts.declared} · annotated ${s.counts.annotated} · built ${s.counts.built} · ` +
    `in the manifest ${s.counts.inManifest} · allowlisted ${s.counts.allowlisted} · in the Figma map ${s.counts.inTheFigmaMap}`);
  line(`   gate       ${s.gate
    ? `${s.gate.status}: ${s.gate.findings} finding(s), ${s.gate.blocking} blocking — ${s.gate.report} (${s.gate.generatedAt})`
    : s.gateNote}`);
  line(`   tokens     none — ${ABSENT.tokens.split('.')[0]}.`);
  line(`   owner      none — ${ABSENT.owner}`);
  line(`   category   none declared — groups below are DERIVED from the allowlist's surface + column, not decided.`);
  if (s.duplicateTags.length) {
    line(`   twice      ${s.duplicateTags.length} element(s) are declared twice — once by name, once by tag ` +
      `(⇄ below)${s.duplicateTags.some((d) => d.declaredPropsDiffer) ? ', and their two declarations do not agree on props' : ''}:`);
    line(`              ${s.duplicateTags.map((d) => `${d.names.join(' + ')} → <${d.tag}>`).join(' · ')}`);
  }
  line();
  for (const g of tree.groups) {
    line(`  ▤ ${g.title}  — ${g.counts.elements} element(s) · ${g.counts.annotated} annotated · ${g.counts.findings} with findings   [derived]`);
    for (const e of g.elements) {
      const counts = `props ${e.props.declared.length} · events ${e.actions.events.length} · slots ${e.children.slot.length}`;
      line(row('▪', e.name, e.tag ?? '(nothing claims this name)', counts, mark(e)));
      for (const slot of e.children.slot) {
        const declared = e.slots.declared.includes(slot);
        line(`        ◇ slot "${slot}"${declared ? '' : '  (rendered, not declared in the catalogue)'}`);
      }
      for (const slot of e.slots.declaredNotRendered) {
        line(`        ◇ slot "${slot}"  ⚠ declared in the catalogue, rendered nowhere`);
      }
      if (e.slots.bareSlot && !e.slots.declaredNotRendered.length && !e.children.slot.length) {
        line('        ◇ a default slot, which a payload cannot address by name');
      }
      for (const child of e.children.composed) line(`        ◇ composed <${child}>`);
    }
  }
  if (tree.undeclared.length) {
    line(`  ▤ built, not declared in this catalogue  — ${tree.undeclared.length} element(s)   [derived]`);
    for (const u of tree.undeclared) line(`        ○ <${u.tag}>  ${u.className ?? ''}  ${u.file ?? ''}`);
  }
  if (tree.ledgerOnly.length) {
    line(`  ▤ in the ledger only  — ${tree.ledgerOnly.length} node(s) no other source holds   [derived]`);
    line('     (ingested, approved — and now in no catalogue, no allowlist, no map, no manifest)');
    for (const n of tree.ledgerOnly) {
      line(`        ⌀ ${n.nodeName ?? n.nodeId}  ${n.nodeId}  ${n.history}  ${n.firstAt} → ${n.lastAt}`);
      if (n.tags.length) line(`            tags written: ${n.tags.join(', ')}${n.inAnyCatalogue ? '  (STILL named by a catalogue!)' : ''}`);
    }
    line(`     removals   ${tree.system.removalNote}`);
  }
  line();
}

main().catch((err) => {
  console.error('catalog-tree could not run:', err);
  process.exit(2);
});
